import * as common from './shared/csv-support.js';
const { addSceneLights, mapBars, validRows, selected, valueOf } = common;
import { barChartPlotter } from './bar-chart-plotter.js';
export function makeBarPlotter(mapping, aggregate) {
  return Object.freeze({
    capabilities: Object.freeze(["selection"]),
    create(context, definition, initialRows) {
      let bars = mapBars(initialRows, mapping, aggregate);
      const base = barChartPlotter.create(context, {
        ...definition,
        configuration: { ...definition.configuration, barChart: { mappings: { categoryX: "categoryX", categoryZ: "categoryZ", value: "value" }, color: 0x59bce9, material: { type: "standard", metalness: .12, roughness: .3 } } },
      }, bars);
      return {
        capabilities: ["selection"],
        update(rows) { bars = mapBars(rows, mapping, aggregate); return base.update(bars); },
        describeSelection(hit) {
          const bar = bars[hit.instanceId];
          if (!bar) return undefined;
          return { id: bar.id, label: `${bar.categoryX} / ${bar.categoryZ}`, values: { [mapping.categoryX]: bar.categoryX, [mapping.categoryZ]: bar.categoryZ, [mapping.value]: bar.rawValue, rows: bar.rows.map(row => row.__rowNumber) } };
        },
        dispose() { base.dispose(); },
      };
    },
  });
}
