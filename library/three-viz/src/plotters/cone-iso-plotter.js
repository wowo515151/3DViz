import { addSceneLights, valueOf, PALETTE, scalarGridForVolume } from './shared/csv-support.js?v=cone-plotters-20261010a';
import { extractIsosurface } from './shared/isosurface.js';
import { createCarPaintMaterial } from './shared/materials.js?v=car-paint-20261010a';
import { coneHeightForMagnitude } from './vector-field-plotter.js?v=cone-plotters-20261010b';
import { generateColorShades } from '../utils/shades.js?v=shades-20261010v';

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
    capabilities: Object.freeze(["selection", "thresholds", "layers", "surfaceCount"]),
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
      let rows = initialRows;
      let threshold = options.threshold;
      let nested = Boolean(options.nested);
      let surfaceCount = normalizeSurfaceCount(options.surfaceCount ?? 5);
      let glyphSets = [];
      let report;

      const clearGlyphs = () => {
        for (const set of glyphSets) {
          group.remove(set.glyphs);
          resources.release(set.glyphs);
          resources.release(set.material);
        }
        glyphSets = [];
      };
      const build = () => {
        if (rows.some(row => [vectorMapping.u, vectorMapping.v, vectorMapping.w].some(key => valueOf(row, key) === null))) {
          throw new Error("ConeIso needs three numeric vector components at every scalar-grid sample.");
        }
        const grid = scalarGridForVolume(rows, mapping);
        if (!Number.isFinite(threshold)) threshold = (grid.scalarExtent[0] + grid.scalarExtent[1]) / 2;
        const [low, high] = grid.scalarExtent;
        const levels = nested
          ? Array.from({ length: surfaceCount }, (_, index) => low + (high - low) * (index + 1) / (surfaceCount + 1))
          : [threshold];
        if (levels.some(level => level <= low || level >= high)) throw new Error("Choose ConeIso thresholds strictly between the minimum and maximum scalar values.");
        const colors = nested ? generateColorShades(options.color ?? PALETTE[0], levels.length) : [options.color ?? PALETTE[0]];
        const maximumMagnitude = Math.max(...rows.map(row => Math.hypot(
          valueOf(row, vectorMapping.u), valueOf(row, vectorMapping.v), valueOf(row, vectorMapping.w),
        )), 1e-9);
        clearGlyphs();
        const levelReports = levels.map((level, levelIndex) => {
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
            candidates.push({ center, vector, magnitude, area, row: surface.triangleRows[offset / 3], threshold: level });
          }
          if (!candidates.length) return { threshold: level, color: colors[levelIndex], count: 0 };
          const levelMaterial = resources.track(createCarPaintMaterial(THREE, colors[levelIndex]));
          const glyphs = resources.track(new THREE.InstancedMesh(geometry, levelMaterial, candidates.length));
          glyphs.name = `cone-iso-facets-${levelIndex + 1}`;
          glyphs.frustumCulled = false;
          glyphs.userData.coneIsoFacets = candidates;
          glyphs.userData.threshold = level;
          glyphs.userData.color = colors[levelIndex];
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
          glyphSets.push({ glyphs, material: levelMaterial });
          return { threshold: level, color: colors[levelIndex], count: candidates.length };
        });
        report = { count: levelReports.reduce((sum, level) => sum + level.count, 0), levels: levelReports, minimumArea, threshold, sampled: false };
      };

      build();
      return {
        capabilities: ["selection", "thresholds", "layers", "surfaceCount"],
        update(nextRows) { rows = nextRows; build(); context.requestRender(); },
        setThreshold(value) {
          const next = Number(value);
          if (!Number.isFinite(next)) throw new Error("ConeIso threshold must be numeric.");
          threshold = next;
          build();
          context.requestRender();
        },
        setLayerVisible(id, visible) {
          if (id !== "multiple") throw new Error(`Unknown ConeIso layer: ${id}`);
          const next = Boolean(visible);
          if (next === nested) return;
          nested = next;
          build();
          context.requestRender();
        },
        setSurfaceCount(value) {
          const next = normalizeSurfaceCount(value);
          if (next === surfaceCount) return;
          surfaceCount = next;
          build();
          context.requestRender();
        },
        describeSelection(hit) {
          const facet = hit.object?.userData?.coneIsoFacets?.[hit.instanceId];
          if (!facet) return undefined;
          return {
            id: `facet-${hit.instanceId}`,
            label: `ConeIso facet · threshold ${facet.threshold.toFixed(3)} · area ${facet.area.toFixed(4)}`,
            values: { x: facet.center[0], y: facet.center[1], z: facet.center[2], area: facet.area, fieldMagnitude: facet.magnitude, ...facet.row },
          };
        },
        dispose() {
          clearGlyphs();
          resources.release(geometry);
          removeLights();
          scene.remove(group);
        },
        get report() { return report; },
      };
    },
  });
}

function normalizeSurfaceCount(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 2 || count > 20) throw new Error("Surface count must be a whole number from 2 to 20.");
  return count;
}
