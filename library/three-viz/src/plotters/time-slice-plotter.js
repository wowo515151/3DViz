import * as common from './shared/csv-support.js';
const { addSceneLights, mapBars, projectedColumn, validRows, selected, categoryValue, valueOf, gridForSurface, scalarGridForVolume, displayNumber, extent, parseNumeric, scaleLinear, PALETTE } = common;
import { pointCloudPlotter } from './point-cloud-plotter.js';
export function makeTimeSlicePlotter(mapping) {
  return Object.freeze({
    capabilities: Object.freeze(["selection", "time", "animation"]),
    create(context, definition, initialRows) {
      let rows = [];
      let times = [];
      let currentTime = 0;
      let points = [];
      const build = sourceRows => {
        const usable = validRows(sourceRows, [mapping.x, mapping.y, mapping.z, mapping.value, mapping.time])
          .filter(({ row }) => [mapping.x, mapping.y, mapping.z, mapping.value, mapping.time].every(field => valueOf(row, field) !== null));
        if (!usable.length) throw new Error("Time-slice mode needs numeric X, Y, Z, value, and time columns.");
        rows = usable.map(item => item.row);
        times = [...new Set(rows.map(row => valueOf(row, mapping.time)))].sort((a, b) => a - b);
        if (!times.length) throw new Error("No numeric time values are available for slicing.");
        currentTime = Math.max(times[0], Math.min(times.at(-1), currentTime));
        const axes = [mapping.x, mapping.y, mapping.z].map(field => extent(rows.map(row => valueOf(row, field))));
        const active = rows.filter(row => valueOf(row, mapping.time) === currentTime);
        points = active.map((row, index) => ({
          id: `slice-${row.__rowNumber ?? index}`,
          label: `CSV row ${row.__rowNumber ?? index + 1}`,
          x: scaleLinear(valueOf(row, mapping.x), ...axes[0]),
          y: scaleLinear(valueOf(row, mapping.y), ...axes[1]),
          z: scaleLinear(valueOf(row, mapping.z), ...axes[2]),
          source: row,
        }));
        if (!points.length) throw new Error("The selected time has no valid points.");
      };
      build(initialRows);
      const base = pointCloudPlotter.create(context, {
        ...definition,
        configuration: { ...definition.configuration, pointCloud: { color: 0x64c6f1, size: 0.16 } },
      }, points);
      const updatePoints = () => base.update(points);
      const setTime = time => {
        const nearest = times.reduce((best, candidate) => Math.abs(candidate - Number(time)) < Math.abs(best - Number(time)) ? candidate : best, times[0]);
        currentTime = nearest;
        const active = rows.filter(row => valueOf(row, mapping.time) === currentTime);
        const axes = [mapping.x, mapping.y, mapping.z].map(field => extent(rows.map(row => valueOf(row, field))));
        points = active.map((row, index) => ({ id: `slice-${row.__rowNumber ?? index}`, label: `CSV row ${row.__rowNumber ?? index + 1}`, x: scaleLinear(valueOf(row, mapping.x), ...axes[0]), y: scaleLinear(valueOf(row, mapping.y), ...axes[1]), z: scaleLinear(valueOf(row, mapping.z), ...axes[2]), source: row }));
        updatePoints();
      };
      setTime(currentTime);
      return {
        capabilities: ["selection", "time", "animation"],
        update(nextRows) { currentTime = times[0]; build(nextRows); updatePoints(); context.requestRender(); },
        setTime,
        updateFrame({ elapsedSeconds }) { if (times.length > 1) setTime(times[Math.floor(elapsedSeconds * 1.5) % times.length]); },
        describeSelection(hit) { const row = points[hit.index]?.source; return row ? { id: `row-${row.__rowNumber}`, label: `Time ${displayNumber(currentTime)} · row ${row.__rowNumber}`, values: selected([row])[0] } : undefined; },
        dispose() { base.dispose(); },
        get timeRange() { return { min: times[0], max: times.at(-1) }; },
      };
    },
  });
}
