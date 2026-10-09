import { barChartPlotter } from './bar-chart-plotter.js';
import * as common from './shared/csv-support.js';
const { addSceneLights, mapBars, projectedColumn, validRows, selected, categoryValue, valueOf, gridForSurface, scalarGridForVolume, displayNumber, extent, parseNumeric, scaleLinear, PALETTE } = common;
export function makeHistogramPlotter(mapping, binCount) {
  return Object.freeze({
    capabilities: Object.freeze(["selection"]),
    create(context, definition, initialRows) {
      const build = rows => {
        const usable = validRows(rows, [mapping.x, mapping.z]).map(item => item.row);
        if (usable.length < 2) throw new Error("A 3D histogram needs at least two rows with numeric X and Z values.");
        const xValues = usable.map(row => valueOf(row, mapping.x)), zValues = usable.map(row => valueOf(row, mapping.z));
        if (xValues.some(v => v === null) || zValues.some(v => v === null)) throw new Error("Histogram axes must both be numeric columns.");
        const [xMin, xMax] = extent(xValues), [zMin, zMax] = extent(zValues);
        const xWidth = (xMax - xMin || 1) / binCount, zWidth = (zMax - zMin || 1) / binCount;
        const groups = new Map();
        usable.forEach((row, i) => {
          const bx = Math.min(binCount - 1, Math.floor((xValues[i] - xMin) / xWidth));
          const bz = Math.min(binCount - 1, Math.floor((zValues[i] - zMin) / zWidth));
          const key = `${bx}:${bz}`;
          const bin = groups.get(key) ?? { bx, bz, count: 0, rows: [] };
          bin.count += 1; bin.rows.push(row); groups.set(key, bin);
        });
        const max = Math.max(...[...groups.values()].map(item => item.count));
        return [...groups.values()].map((bin, i) => ({ id: `bin-${i}`, categoryX: `${displayNumber(xMin + bin.bx * xWidth)}–${displayNumber(xMin + (bin.bx + 1) * xWidth)}`, categoryZ: `${displayNumber(zMin + bin.bz * zWidth)}–${displayNumber(zMin + (bin.bz + 1) * zWidth)}`, value: bin.count / max * 4, rawCount: bin.count, rows: bin.rows }));
      };
      let bins = build(initialRows);
      const base = barChartPlotter.create(context, { ...definition, configuration: { ...definition.configuration, barChart: { mappings: { categoryX: "categoryX", categoryZ: "categoryZ", value: "value" }, color: 0xe6a452, barWidth: Math.min(.8, 4 / binCount), material: { type: "standard", metalness: .12, roughness: .3 } } } }, bins);
      return {
        capabilities: ["selection"],
        update(rows) { bins = build(rows); return base.update(bins); },
        describeSelection(hit) {
          const bin = bins[hit.instanceId];
          return bin ? { id: bin.id, label: `Bin ${bin.categoryX} × ${bin.categoryZ}`, values: { count: bin.rawCount, sourceRows: bin.rows.map(row => row.__rowNumber) } } : undefined;
        },
        dispose() { base.dispose(); },
      };
    },
  });
}
