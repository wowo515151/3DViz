import { VisualizationError, assert } from "../core/errors.js";

const forbiddenPathParts = new Set(["__proto__", "prototype", "constructor"]);

function readField(record, path) {
  let value = record;
  for (const part of String(path).split(".")) {
    assert(part.length > 0 && !forbiddenPathParts.has(part), "INVALID_FIELD_PATH", "Bar chart field mappings must use safe property names.");
    value = value?.[part];
  }
  return value;
}

function getMappings(configuration) {
  const mappings = configuration.barChart?.mappings ?? {};
  return {
    categoryX: mappings.categoryX ?? "categoryX",
    categoryZ: mappings.categoryZ ?? "categoryZ",
    value: mappings.value ?? "value",
  };
}

function validateBars(records, mapping) {
  assert(Array.isArray(records), "INVALID_BAR_DATA", "Bar chart data must be an array of records.");
  const ids = new Set();
  const combinations = new Set();
  return records.map((record, index) => {
    assert(record !== null && typeof record === "object" && !Array.isArray(record), "INVALID_BAR_RECORD", `bar data[${index}] must be an object.`);
    const id = record.id;
    assert((typeof id === "string" && id.trim().length > 0) || (typeof id === "number" && Number.isFinite(id)), "INVALID_ID", `bar data[${index}] must have a non-empty string or finite numeric id.`);
    assert(!ids.has(id), "DUPLICATE_ID", `Bar chart data contains duplicate id '${String(id)}'.`);
    ids.add(id);
    const categoryX = readField(record, mapping.categoryX);
    const categoryZ = readField(record, mapping.categoryZ);
    const value = readField(record, mapping.value);
    for (const [name, category] of [["categoryX", categoryX], ["categoryZ", categoryZ]]) {
      assert((typeof category === "string" && category.length > 0) || (typeof category === "number" && Number.isFinite(category)), `INVALID_${name.toUpperCase()}`, `bar data[${index}].${name} must be a non-empty string or finite number.`);
    }
    assert(typeof value === "number" && Number.isFinite(value), "INVALID_BAR_VALUE", `bar data[${index}] value must be finite.`);
    assert(Number.isFinite(Math.fround(value)), "BAR_VALUE_FLOAT32_RANGE", `bar data[${index}] value exceeds the supported Float32 geometry range.`);
    const combination = JSON.stringify([typeof categoryX, categoryX, typeof categoryZ, categoryZ]);
    assert(!combinations.has(combination), "DUPLICATE_BAR_CATEGORY", `More than one record maps to the category pair (${String(categoryX)}, ${String(categoryZ)}).`, { index });
    combinations.add(combination);
    return { id, categoryX, categoryZ, value, source: record };
  });
}

function createInstances(THREE, geometry, material, bars, barWidth) {
  const mesh = new THREE.InstancedMesh(geometry, material, bars.length);
  mesh.name = "categorical-3d-bars";
  const object = new THREE.Object3D();
  const categoriesX = [...new Set(bars.map(bar => bar.categoryX))];
  const categoriesZ = [...new Set(bars.map(bar => bar.categoryZ))];
  const xIndex = new Map(categoriesX.map((category, index) => [category, index]));
  const zIndex = new Map(categoriesZ.map((category, index) => [category, index]));
  bars.forEach((bar, index) => {
    object.position.set(xIndex.get(bar.categoryX) - (categoriesX.length - 1) / 2, bar.value / 2, zIndex.get(bar.categoryZ) - (categoriesZ.length - 1) / 2);
    object.scale.set(barWidth, Math.abs(bar.value), barWidth);
    object.updateMatrix();
    mesh.setMatrixAt(index, object.matrix);
  });
  if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox?.();
  mesh.computeBoundingSphere?.();
  return mesh;
}

/** Instanced 3D bar chart with two categorical horizontal axes. It creates no DOM/UI. */
export const barChartPlotter = Object.freeze({
  capabilities: Object.freeze(["selection"]),
  create(context, definition, initialData) {
    const { THREE, scene, resources } = context;
    if (typeof THREE.InstancedMesh !== "function" || typeof THREE.BoxGeometry !== "function" || typeof THREE.MeshBasicMaterial !== "function" || typeof THREE.Object3D !== "function") {
      throw new VisualizationError("INSTANCED_BARS_UNAVAILABLE", "The runtime does not provide the Three.js instanced-bar classes.");
    }
    let settings = definition.configuration.barChart ?? {};
    let barWidth = settings.barWidth ?? 0.8;
    assert(typeof barWidth === "number" && Number.isFinite(barWidth) && barWidth > 0 && barWidth <= 1, "INVALID_BAR_WIDTH", "barChart.barWidth must be greater than zero and at most one.");
    const mapping = getMappings(definition.configuration);
    let bars = validateBars(initialData, mapping);
    let geometry = resources.track(new THREE.BoxGeometry(1, 1, 1));
    const paint = settings.material ?? {};
    const useStandardMaterial = paint.type === "standard";
    let paintLights = [];
    if (useStandardMaterial) {
      if (typeof THREE.MeshStandardMaterial !== "function" || typeof THREE.HemisphereLight !== "function" || typeof THREE.DirectionalLight !== "function") {
        throw new VisualizationError("BAR_PAINT_UNAVAILABLE", "Standard bar paint requires Three.js standard materials and lights.");
      }
      const hemi = new THREE.HemisphereLight(0x9bdcff, 0x10151c, 1.25);
      const key = new THREE.DirectionalLight(0xe2f6ff, 1.7);
      const rim = new THREE.DirectionalLight(0x388dce, 0.55);
      key.position.set(-4, 7, 6);
      rim.position.set(6, 2, -5);
      paintLights = [hemi, key, rim];
      scene.add(...paintLights);
    }
    let material = resources.track(useStandardMaterial
      ? new THREE.MeshStandardMaterial({ color: settings.color ?? 0x4ea5ff, metalness: paint.metalness ?? 0.12, roughness: paint.roughness ?? 0.3, side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ color: settings.color ?? 0x4ea5ff }));
    let instances = resources.track(createInstances(THREE, geometry, material, bars, barWidth));
    scene.add(instances);

    return {
      capabilities: ["selection"],
      update(nextData, configuration = {}) {
        const nextSettings = {
          ...settings,
          ...(configuration.barChart ?? {}),
          mappings: {
            ...(settings.mappings ?? {}),
            ...(configuration.barChart?.mappings ?? {}),
          },
        };
        const nextMapping = getMappings({
          ...definition.configuration,
          ...configuration,
          barChart: nextSettings,
        });
        const nextBars = validateBars(nextData, nextMapping);
        const nextWidth = nextSettings.barWidth ?? 0.8;
        assert(typeof nextWidth === "number" && Number.isFinite(nextWidth) && nextWidth > 0 && nextWidth <= 1, "INVALID_BAR_WIDTH", "barChart.barWidth must be greater than zero and at most one.");
        let nextInstances = instances;
        if (nextBars.length !== bars.length || nextWidth !== barWidth) {
          nextInstances = resources.track(createInstances(THREE, geometry, material, nextBars, nextWidth));
          scene.add(nextInstances);
          scene.remove(instances);
          resources.release(instances);
          instances = nextInstances;
        } else {
          const object = new THREE.Object3D();
          const categoriesX = [...new Set(nextBars.map(bar => bar.categoryX))];
          const categoriesZ = [...new Set(nextBars.map(bar => bar.categoryZ))];
          const xIndex = new Map(categoriesX.map((category, index) => [category, index]));
          const zIndex = new Map(categoriesZ.map((category, index) => [category, index]));
          nextBars.forEach((bar, index) => {
            object.position.set(xIndex.get(bar.categoryX) - (categoriesX.length - 1) / 2, bar.value / 2, zIndex.get(bar.categoryZ) - (categoriesZ.length - 1) / 2);
            object.scale.set(nextWidth, Math.abs(bar.value), nextWidth);
            object.updateMatrix();
            instances.setMatrixAt(index, object.matrix);
          });
          instances.instanceMatrix.needsUpdate = true;
          instances.computeBoundingBox?.();
          instances.computeBoundingSphere?.();
        }
        bars = nextBars;
        settings = nextSettings;
        barWidth = nextWidth;
        if (configuration.barChart?.color !== undefined) material.color?.set?.(configuration.barChart.color);
        context.requestRender();
      },
      describeSelection(hit) {
        const bar = bars[hit.instanceId];
        if (!bar) return undefined;
        return Object.freeze({
          id: bar.id,
          label: String(bar.source.label ?? bar.id),
          values: Object.freeze({ categoryX: bar.categoryX, categoryZ: bar.categoryZ, value: bar.value }),
        });
      },
      dispose() {
        scene.remove(instances);
        paintLights.forEach(light => scene.remove(light));
        paintLights = [];
        resources.release(instances);
        resources.release(geometry);
        resources.release(material);
      },
    };
  },
});
