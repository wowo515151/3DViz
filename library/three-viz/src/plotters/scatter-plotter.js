import * as common from './shared/csv-support.js';
const { addSceneLights, mapBars, projectedColumn, validRows, selected, categoryValue, valueOf, gridForSurface, scalarGridForVolume, displayNumber, extent, parseNumeric, scaleLinear, PALETTE } = common;
import { pointCloudPlotter } from './point-cloud-plotter.js';
export function makeScatterPlotter(mapping) {
  return Object.freeze({
    capabilities: Object.freeze(["selection"]),
    create(context, definition, initialRows) {
      let rows = validRows(initialRows, [mapping.x, mapping.y, mapping.z]).map(item => item.row);
      if (rows.length < 1) throw new Error("No rows contain all selected scatter coordinates.");
      const build = sourceRows => {
        const x = projectedColumn(sourceRows, mapping.x), y = projectedColumn(sourceRows, mapping.y), z = projectedColumn(sourceRows, mapping.z);
        return sourceRows.map((row, index) => ({ id: `point-${index}`, label: `Row ${row.__rowNumber}`, x: x.values[index], y: y.values[index], z: z.values[index], source: row }));
      };
      let points = build(rows);
      const base = pointCloudPlotter.create(context, { ...definition, configuration: { ...definition.configuration, pointCloud: { color: 0x64c6f1, size: 0.13 } } }, points);
      return {
        capabilities: ["selection"],
        update(nextRows) { rows = validRows(nextRows, [mapping.x, mapping.y, mapping.z]).map(item => item.row); points = build(rows); return base.update(points); },
        describeSelection(hit) {
          const row = points[hit.index]?.source;
          return row ? { id: `row-${row.__rowNumber}`, label: `CSV row ${row.__rowNumber}`, values: selected([row])[0] } : undefined;
        },
        dispose() { base.dispose(); },
      };
    },
  });
}
