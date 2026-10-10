import { addSceneLights, validRows, valueOf, extent, PALETTE } from './shared/csv-support.js?v=cone-plotters-20261010a';
import { createCarPaintMaterial } from './shared/materials.js?v=car-paint-20261010a';

const UP = Object.freeze([0, 1, 0]);
const DEFAULT_POSITION_BOUNDS = Object.freeze([[-3.5, 3.5], [-3.5, 3.5], [-3.5, 3.5]]);

export function coneHeightForMagnitude(magnitude, maximumMagnitude, maximumHeight = 0.22) {
  if (!Number.isFinite(magnitude) || magnitude <= 0 || !Number.isFinite(maximumMagnitude) || maximumMagnitude <= 0) return 0;
  return maximumHeight * magnitude / maximumMagnitude;
}

export function makeVectorPlotter(mapping, vectorScale = 0.22, options = {}) {
  return Object.freeze({
    capabilities: Object.freeze(["selection"]),
    create(context, definition, initialRows) {
      const { THREE, scene, resources } = context;
      const maximumHeight = Number(options.maximumHeight ?? vectorScale);
      if (!Number.isFinite(maximumHeight) || maximumHeight <= 0) throw new Error("Maximum cone height must be a positive number.");
      const removeLights = addSceneLights(THREE, scene, context.renderer);
      const group = new THREE.Group();
      group.name = "csv-vector-field-cones";
      scene.add(group);

      // Uniform instance scaling keeps the cone's height exactly twice its diameter.
      const coneGeometry = resources.track(new THREE.ConeGeometry(0.25, 1, options.radialSegments ?? 12));
      const material = resources.track(createCarPaintMaterial(THREE, options.color ?? PALETTE[0]));
      let glyphs;
      let glyphRows = [];
      let report;

      const usableRows = rows => {
        const fields = [mapping.x, mapping.y, mapping.z, mapping.u, mapping.v, mapping.w];
        const usable = validRows(rows, fields).filter(({ row }) => fields.every(key => valueOf(row, key) !== null));
        if (!usable.length) throw new Error("Vector mode needs rows with three numeric positions and three numeric vector components.");
        return usable;
      };
      const bounds = options.positionBounds ?? DEFAULT_POSITION_BOUNDS;
      if (!Array.isArray(bounds) || bounds.length !== 3 || bounds.some(range => !Array.isArray(range) || range.length !== 2 || !Number.isFinite(range[0]) || !Number.isFinite(range[1]) || range[1] <= range[0])) {
        throw new Error("Vector position bounds must contain three finite increasing ranges.");
      }
      const mapPosition = (value, axis, sourceExtents) => {
        const [minimum, maximum] = bounds[axis];
        const [dataMinimum, dataMaximum] = sourceExtents[axis];
        const fraction = dataMaximum === dataMinimum ? 0.5 : (value - dataMinimum) / (dataMaximum - dataMinimum);
        return minimum + fraction * (maximum - minimum);
      };

      const build = rows => {
        const usable = usableRows(rows);
        const positions = usable.map(({ row }) => [mapping.x, mapping.y, mapping.z].map(key => valueOf(row, key)));
        const components = usable.map(({ row }) => [mapping.u, mapping.v, mapping.w].map(key => valueOf(row, key)));
        const positionExtents = [0, 1, 2].map(axis => extent(positions.map(point => point[axis])));
        const magnitudes = components.map(vector => Math.hypot(...vector));
        const maximumMagnitude = Math.max(...magnitudes, 1e-9);
        const sourceRows = usable.map(({ row }) => row);
        const matrices = positions.map((position, index) => {
          const direction = new THREE.Vector3(...components[index]);
          const magnitude = magnitudes[index];
          const worldPosition = new THREE.Vector3(...position.map((value, axis) => mapPosition(value, axis, positionExtents)));
          const height = coneHeightForMagnitude(magnitude, maximumMagnitude, maximumHeight);
          const scale = new THREE.Vector3(height, height, height);
          const orientation = new THREE.Quaternion();
          orientation.setFromUnitVectors(new THREE.Vector3(...UP), magnitude > 0 ? direction.normalize() : new THREE.Vector3(...UP));
          return { position: worldPosition, orientation, scale };
        });

        if (glyphs && glyphs.count !== matrices.length) {
          group.remove(glyphs);
          resources.release(glyphs);
          glyphs = undefined;
        }
        if (!glyphs) {
          glyphs = resources.track(new THREE.InstancedMesh(coneGeometry, material, matrices.length));
          glyphs.name = "field-cones";
          glyphs.frustumCulled = false;
          group.add(glyphs);
        }
        const matrix = new THREE.Matrix4();
        matrices.forEach((transform, index) => {
          matrix.compose(transform.position, transform.orientation, transform.scale);
          glyphs.setMatrixAt(index, matrix);
        });
        glyphs.instanceMatrix.needsUpdate = true;
        glyphRows = sourceRows;
        report = { count: matrices.length, sampled: false, maxMagnitude: maximumMagnitude };
      };

      build(initialRows);
      return {
        capabilities: ["selection"],
        update(rows) { build(rows); context.requestRender(); },
        describeSelection(hit) {
          const row = glyphRows[hit.instanceId];
          return row ? { id: row.id ?? `row-${row.__rowNumber}`, label: row.label ?? `Vector sample ${row.__rowNumber ?? hit.instanceId + 1}`, values: { ...row } } : undefined;
        },
        dispose() {
          if (glyphs) resources.release(glyphs);
          resources.release(coneGeometry);
          resources.release(material);
          removeLights();
          scene.remove(group);
        },
        get report() { return report; },
      };
    },
  });
}
