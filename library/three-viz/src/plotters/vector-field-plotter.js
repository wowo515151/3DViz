import * as common from './shared/csv-support.js';
const { addSceneLights, mapBars, projectedColumn, validRows, selected, categoryValue, valueOf, gridForSurface, scalarGridForVolume, displayNumber, extent, parseNumeric, scaleLinear, PALETTE } = common;
export function makeVectorPlotter(mapping, vectorScale) {
  return Object.freeze({
    capabilities: Object.freeze([]),
    create(context, definition, initialRows) {
      const { THREE, scene, resources } = context;
      const group = new THREE.Group(); group.name = "csv-vector-field"; scene.add(group);
      const helpers = [];
      const clear = () => { for (const arrow of helpers.splice(0)) { group.remove(arrow); for (const resource of arrow.userData.resources) resources.release(resource); } };
      const build = rows => {
        clear();
        const fields = [mapping.x,mapping.y,mapping.z,mapping.u,mapping.v,mapping.w];
        const usable = validRows(rows, fields).filter(({row}) => fields.every(key => valueOf(row,key) !== null));
        if (!usable.length) throw new Error("Vector mode needs rows with three numeric positions and three numeric vector components.");
        const step = Math.max(1, Math.ceil(usable.length / 400));
        const chosen = usable.filter((_, index) => index % step === 0);
        if (chosen.length > 400) throw new Error("Vector glyph limit exceeded; choose fewer rows or filter the CSV.");
        const positions = chosen.map(({row}) => [valueOf(row,mapping.x),valueOf(row,mapping.y),valueOf(row,mapping.z)]);
        const components = chosen.map(({row}) => [valueOf(row,mapping.u),valueOf(row,mapping.v),valueOf(row,mapping.w)]);
        const pExtent = [0,1,2].map(axis => extent(positions.map(p => p[axis])));
        const magnitudes = components.map(v => Math.hypot(...v));
        const maxLength = Math.max(...magnitudes,1e-9);
        chosen.forEach(({row}, index) => {
          const p = positions[index], v = components[index], direction = new THREE.Vector3(...v);
          if (direction.lengthSq() === 0) return;
          const origin = new THREE.Vector3(...p.map((value, axis) => scaleLinear(value, pExtent[axis][0], pExtent[axis][1])));
          const length = .25 + Math.hypot(...v) / maxLength * vectorScale;
          const arrow = new THREE.ArrowHelper(direction.normalize(), origin, length, PALETTE[index % PALETTE.length], Math.min(.28,length*.28), Math.min(.18,length*.2));
          const owned = [arrow.line.geometry, arrow.line.material, arrow.cone.geometry, arrow.cone.material];
          owned.forEach(resource => resources.track(resource));
          arrow.userData.resources = owned; arrow.userData.sourceRow = row; group.add(arrow); helpers.push(arrow);
        });
        return { count: chosen.length, sampled: chosen.length < usable.length, maxMagnitude: maxLength };
      };
      let report = build(initialRows);
      return { capabilities: [], update(rows) { report = build(rows); context.requestRender(); }, dispose() { clear(); scene.remove(group); }, get report() { return report; } };
    },
  });
}
