import { addSceneLights, valueOf, PALETTE, scalarGridForVolume } from './shared/csv-support.js?v=cone-plotters-20261010a';
import { extractIsosurface } from './shared/isosurface.js';
import { createCarPaintMaterial } from './shared/materials.js?v=car-paint-20261010a';
import { coneHeightForMagnitude } from './vector-field-plotter.js?v=cone-plotters-20261010b';

const SCENE_HALF_EXTENT = 2.5;

export function triangleArea(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  return Math.hypot(...cross) / 2;
}

function bracket(axis, value) {
  if (value <= axis[0]) return [0, 0, 0];
  const last = axis.length - 1;
  if (value >= axis[last]) return [last, last, 0];
  let upper = 1;
  while (axis[upper] < value) upper += 1;
  const lower = upper - 1;
  return [lower, upper, (value - axis[lower]) / (axis[upper] - axis[lower])];
}

function sampleField(grid, worldPosition, vectorMapping) {
  const dataPosition = worldPosition.map(coordinate => (coordinate / (SCENE_HALF_EXTENT * 2) + 0.5));
  const brackets = grid.axes.map((axis, dimension) => {
    const value = axis[0] + dataPosition[dimension] * (axis.at(-1) - axis[0]);
    return bracket(axis, value);
  });
  const vector = [0, 0, 0];
  for (let mask = 0; mask < 8; mask += 1) {
    const indices = brackets.map(([low, high], axis) => (mask & (1 << axis)) ? high : low);
    const weight = brackets.reduce((product, [low, , fraction], axis) => product * ((mask & (1 << axis)) ? fraction : 1 - fraction), 1);
    const row = grid.cells[indices[0]][indices[1]][indices[2]].row;
    for (let component = 0; component < 3; component += 1) vector[component] += valueOf(row, vectorMapping[["u", "v", "w"][component]]) * weight;
  }
  return vector;
}

export function makeConeIsoPlotter(mapping, vectorMapping, options = {}) {
  return Object.freeze({
    capabilities: Object.freeze(["selection", "thresholds"]),
    create(context, definition, initialRows) {
      const { THREE, scene, resources } = context;
      const removeLights = addSceneLights(THREE, scene, context.renderer);
      const group = new THREE.Group();
      group.name = "cone-iso-plotter";
      scene.add(group);
      const minimumArea = Number(options.minimumArea ?? 0.002);
      const maximumHeight = Number(options.maximumHeight ?? 0.22);
      if (!Number.isFinite(minimumArea) || minimumArea < 0) throw new Error("Minimum facet area must be a finite, nonnegative number.");
      if (!Number.isFinite(maximumHeight) || maximumHeight <= 0) throw new Error("Maximum cone height must be a positive number.");
      const geometry = resources.track(new THREE.ConeGeometry(0.25, 1, options.radialSegments ?? 12));
      const material = resources.track(createCarPaintMaterial(THREE, options.color ?? PALETTE[0]));
      let rows = initialRows;
      let threshold = options.threshold;
      let glyphs;
      let selectedFacets = [];
      let report;

      const clearGlyphs = () => {
        if (!glyphs) return;
        group.remove(glyphs);
        resources.release(glyphs);
        glyphs = undefined;
      };
      const build = () => {
        if (rows.some(row => [vectorMapping.u, vectorMapping.v, vectorMapping.w].some(key => valueOf(row, key) === null))) {
          throw new Error("ConeIso needs three numeric vector components at every scalar-grid sample.");
        }
        const grid = scalarGridForVolume(rows, mapping);
        const level = Number.isFinite(threshold) ? threshold : (grid.scalarExtent[0] + grid.scalarExtent[1]) / 2;
        if (level <= grid.scalarExtent[0] || level >= grid.scalarExtent[1]) throw new Error("Choose a ConeIso threshold strictly between the minimum and maximum scalar values.");
        const surface = extractIsosurface(grid, level);
        const candidates = [];
        for (let offset = 0; offset < surface.positions.length; offset += 9) {
          const a = Array.from(surface.positions.slice(offset, offset + 3));
          const b = Array.from(surface.positions.slice(offset + 3, offset + 6));
          const c = Array.from(surface.positions.slice(offset + 6, offset + 9));
          const area = triangleArea(a, b, c);
          if (area <= minimumArea) continue;
          const center = a.map((value, axis) => (value + b[axis] + c[axis]) / 3);
          const vector = sampleField(grid, center, vectorMapping);
          const magnitude = Math.hypot(...vector);
          candidates.push({ center, vector, magnitude, area, row: surface.triangleRows[offset / 3] });
        }
        const maximumMagnitude = Math.max(...rows.map(row => Math.hypot(
          valueOf(row, vectorMapping.u), valueOf(row, vectorMapping.v), valueOf(row, vectorMapping.w),
        )), 1e-9);
        clearGlyphs();
        if (candidates.length) {
          glyphs = resources.track(new THREE.InstancedMesh(geometry, material, candidates.length));
          glyphs.name = "cone-iso-facets";
          glyphs.frustumCulled = false;
          const matrix = new THREE.Matrix4();
          candidates.forEach((facet, index) => {
            const position = new THREE.Vector3(...facet.center);
            const direction = facet.magnitude > 0 ? new THREE.Vector3(...facet.vector).normalize() : new THREE.Vector3(0, 1, 0);
            const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            const height = coneHeightForMagnitude(facet.magnitude, maximumMagnitude, maximumHeight);
            matrix.compose(position, orientation, new THREE.Vector3(height, height, height));
            glyphs.setMatrixAt(index, matrix);
          });
          glyphs.instanceMatrix.needsUpdate = true;
          group.add(glyphs);
        }
        selectedFacets = candidates;
        threshold = level;
        report = { count: candidates.length, minimumArea, threshold: level, sampled: false };
      };

      build();
      return {
        capabilities: ["selection", "thresholds"],
        update(nextRows) { rows = nextRows; build(); context.requestRender(); },
        setThreshold(value) {
          const next = Number(value);
          if (!Number.isFinite(next)) throw new Error("ConeIso threshold must be numeric.");
          threshold = next;
          build();
          context.requestRender();
        },
        describeSelection(hit) {
          const facet = selectedFacets[hit.instanceId];
          if (!facet) return undefined;
          return {
            id: `facet-${hit.instanceId}`,
            label: `ConeIso facet · area ${facet.area.toFixed(4)}`,
            values: { x: facet.center[0], y: facet.center[1], z: facet.center[2], area: facet.area, fieldMagnitude: facet.magnitude, ...facet.row },
          };
        },
        dispose() {
          clearGlyphs();
          resources.release(geometry);
          resources.release(material);
          removeLights();
          scene.remove(group);
        },
        get report() { return report; },
      };
    },
  });
}
