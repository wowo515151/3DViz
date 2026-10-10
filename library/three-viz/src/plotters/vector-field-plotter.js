import * as common from './shared/csv-support.js?v=car-paint-20261010a';
import { createCarPaintMaterial } from './shared/materials.js?v=car-paint-20261010a';
const { addSceneLights, mapBars, projectedColumn, validRows, selected, categoryValue, valueOf, gridForSurface, scalarGridForVolume, displayNumber, extent, parseNumeric, scaleLinear, PALETTE } = common;
export function makeVectorPlotter(mapping, vectorScale = 0.55, options = {}) {
  return Object.freeze({
    capabilities: Object.freeze(options.animated ? ["animation"] : []),
    create(context, definition, initialRows) {
      const { THREE, scene, resources } = context;
      const removeLights = addSceneLights(THREE, scene, context.renderer);
      const group = new THREE.Group(); group.name = "csv-vector-field"; scene.add(group);
      const helpers = [];
      const staticResources = [];
      let animatedGlyphs;
      let animatedGeometry;
      let animatedMaterial;
      let animatedRows = [];
      const clear = () => {
        for (const arrow of helpers.splice(0)) group.remove(arrow);
        for (const resource of staticResources.splice(0)) resources.release(resource);
      };
      const build = rows => {
        clear();
        if (animatedGlyphs) {
          group.remove(animatedGlyphs);
          resources.release(animatedGlyphs);
          animatedGlyphs = undefined;
        }
        if (animatedGeometry) { resources.release(animatedGeometry); animatedGeometry = undefined; }
        if (animatedMaterial) { resources.release(animatedMaterial); animatedMaterial = undefined; }
        const fields = [mapping.x,mapping.y,mapping.z,mapping.u,mapping.v,mapping.w];
        const usable = validRows(rows, fields).filter(({row}) => fields.every(key => valueOf(row,key) !== null));
        if (!usable.length) throw new Error("Vector mode needs rows with three numeric positions and three numeric vector components.");
        const step = Math.max(1, Math.ceil(usable.length / 400));
        const chosen = usable.filter((_, index) => index % step === 0);
        if (chosen.length > 400) throw new Error("Vector glyph limit exceeded; choose fewer rows or filter the CSV.");
        const positions = chosen.map(({row}) => [valueOf(row,mapping.x),valueOf(row,mapping.y),valueOf(row,mapping.z)]);
        const components = chosen.map(({row}) => [valueOf(row,mapping.u),valueOf(row,mapping.v),valueOf(row,mapping.w)]);
        const pExtent = [0,1,2].map(axis => extent(positions.map(p => p[axis])));
        const positionBounds = options.positionBounds ?? [[-3.5,3.5],[-3.5,3.5],[-3.5,3.5]];
        if (!Array.isArray(positionBounds) || positionBounds.length !== 3 || positionBounds.some(range => !Array.isArray(range) || range.length !== 2 || !Number.isFinite(range[0]) || !Number.isFinite(range[1]) || range[1] <= range[0])) {
          throw new Error("Vector position bounds must contain three finite increasing ranges.");
        }
        const mapPosition = (value, axis) => {
          const [minimum, maximum] = positionBounds[axis];
          const [dataMinimum, dataMaximum] = pExtent[axis];
          const fraction = dataMaximum === dataMinimum ? 0.5 : (value - dataMinimum) / (dataMaximum - dataMinimum);
          return minimum + fraction * (maximum - minimum);
        };
        const magnitudes = components.map(v => Math.hypot(...v));
        const maxLength = Math.max(...magnitudes,1e-9);
        if (options.animated) {
          if (typeof THREE.ConeGeometry !== "function" || typeof THREE.InstancedMesh !== "function" || typeof THREE.Matrix4 !== "function" || typeof THREE.Quaternion !== "function" || typeof THREE.Vector3 !== "function") {
            throw new Error("Animated vector cones require Three.js cone and instancing support.");
          }
          animatedGeometry = resources.track(new THREE.ConeGeometry(options.coneRadius ?? 0.12, options.coneLength ?? 0.32, 16));
          animatedMaterial = resources.track(createCarPaintMaterial(THREE, options.color ?? 0x45caff));
          animatedGlyphs = resources.track(new THREE.InstancedMesh(animatedGeometry, animatedMaterial, chosen.length));
          animatedGlyphs.name = "animated-field-cones";
          animatedGlyphs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          animatedGlyphs.frustumCulled = false;
          const previousPositions = new Map(animatedRows.map(glyph => [glyph.key, glyph.position]));
          animatedRows = chosen.map(({row}, index) => {
            const direction = new THREE.Vector3(...components[index]);
            const magnitude = magnitudes[index];
            const key = row.id ?? row.__rowNumber ?? index;
            const initialPosition = new THREE.Vector3(...positions[index].map(mapPosition));
            const position = previousPositions.get(key)?.clone() ?? initialPosition;
            if (magnitude > 0) direction.normalize();
            return { key, direction, position, magnitude, row };
          });
          group.add(animatedGlyphs);
          updateAnimatedGlyphs(0);
          return { count: chosen.length, sampled: chosen.length < usable.length, maxMagnitude: maxLength };
        }
        const color = options.color ?? PALETTE[0];
        const shaftGeometry = resources.track(new THREE.CylinderGeometry(1, 1, 1, 12));
        const coneGeometry = resources.track(new THREE.ConeGeometry(1, 1, 16));
        const material = resources.track(createCarPaintMaterial(THREE, color));
        staticResources.push(shaftGeometry, coneGeometry, material);
        chosen.forEach(({row}, index) => {
          const v = components[index], direction = new THREE.Vector3(...v);
          if (direction.lengthSq() === 0) return;
          const magnitude = Math.hypot(...v);
          const origin = new THREE.Vector3(...positions[index].map(mapPosition));
          const length = .25 + magnitude / maxLength * vectorScale;
          const headLength = Math.min(.28,length*.28), headRadius = Math.min(.18,length*.2);
          const shaftLength = Math.max(.01,length-headLength), shaftRadius = Math.max(.012,headRadius*.2);
          const arrow = new THREE.Group();
          arrow.position.copy(origin);
          arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction.normalize());
          const shaft = new THREE.Mesh(shaftGeometry, material);
          shaft.scale.set(shaftRadius,shaftLength,shaftRadius);
          shaft.position.y=shaftLength/2;
          const cone = new THREE.Mesh(coneGeometry, material);
          cone.scale.set(headRadius,headLength,headRadius);
          cone.position.y=shaftLength+headLength/2;
          arrow.add(shaft,cone);
          arrow.userData.sourceRow=row; arrow.name="painted-field-arrow"; group.add(arrow); helpers.push(arrow);
        });
        return { count: chosen.length, sampled: chosen.length < usable.length, maxMagnitude: maxLength };
      };
      const updateAnimatedGlyphs = deltaSeconds => {
        if (!animatedGlyphs) return;
        const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
        const matrix = new THREE.Matrix4();
        const scale = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);
        animatedRows.forEach((glyph, index) => {
          glyph.position.addScaledVector(glyph.direction, glyph.magnitude * delta);
          // Keep the flow continuous in the finite normalized grid by wrapping at its boundaries.
          glyph.position.set(...[0,1,2].map(axis => {
            const [minimum, maximum] = options.positionBounds?.[axis] ?? [-3.5,3.5];
            const width = maximum - minimum;
            return minimum + (((glyph.position.getComponent(axis) - minimum) % width) + width) % width;
          }));
          quaternion.setFromUnitVectors(up, glyph.direction.lengthSq() > 0 ? glyph.direction : up);
          // Cone geometry uses its local Y axis for length; X/Z set radius by field strength.
          scale.set(glyph.magnitude, 1, glyph.magnitude);
          matrix.compose(glyph.position, quaternion, scale);
          animatedGlyphs.setMatrixAt(index, matrix);
        });
        animatedGlyphs.instanceMatrix.needsUpdate = true;
      };
      let report = build(initialRows);
      return {
        capabilities: options.animated ? ["animation"] : [],
        update(rows) { report = build(rows); context.requestRender(); },
        ...(options.animated ? { updateFrame({ deltaSeconds }) { updateAnimatedGlyphs(deltaSeconds); } } : {}),
        dispose() {
          clear();
          if (animatedGlyphs) resources.release(animatedGlyphs);
          if (animatedGeometry) resources.release(animatedGeometry);
          if (animatedMaterial) resources.release(animatedMaterial);
          removeLights();
          scene.remove(group);
        },
        get report() { return report; },
      };
    },
  });
}
