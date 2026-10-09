import * as common from './shared/csv-support.js';
const { addSceneLights, mapBars, projectedColumn, validRows, selected, categoryValue, valueOf, gridForSurface, scalarGridForVolume, displayNumber, extent, parseNumeric, scaleLinear, PALETTE } = common;
export function makeTrajectoryPlotter(mapping) {
  return Object.freeze({
    capabilities: Object.freeze(["selection", "time", "animation"]),
    create(context, definition, initialRows) {
      const { THREE, scene, resources } = context;
      if (!mapping.time) throw new Error("Choose a numeric time or sequence column for trajectory playback.");
      const removeLights=addSceneLights(THREE,scene);
      const group = new THREE.Group(); group.name = "csv-trajectories"; scene.add(group);
      const palettes = PALETTE;
      let entries = [];
      const timeValues = [];
      function clear() { for (const entry of entries) { group.remove(entry.line); group.remove(entry.marker); resources.release(entry.geometry); resources.release(entry.markerGeometry); resources.release(entry.lineMaterial); resources.release(entry.markerMaterial); } entries = []; timeValues.length = 0; }
      function build(rows) {
        clear();
        const usable = validRows(rows, [mapping.x, mapping.y, mapping.z, mapping.time]);
        if (usable.length < 2) throw new Error("A trajectory needs at least two complete rows.");
        const grouped = new Map();
        for (const { row, index } of usable) {
          const time = valueOf(row, mapping.time), x = valueOf(row, mapping.x), y = valueOf(row, mapping.y), z = valueOf(row, mapping.z);
          if ([time, x, y, z].some(value => value === null)) continue;
          const key = mapping.series ? row[mapping.series] : "Series 1";
          const list = grouped.get(key) ?? []; list.push({ row, index, time, x, y, z }); grouped.set(key, list); timeValues.push(time);
        }
        const timeMin = Math.min(...timeValues), timeMax = Math.max(...timeValues);
        if (grouped.size > 16) throw new Error("Trajectory mode is limited to 16 series at once.");
        const allPoints = [...grouped.values()].flat();
        const axisExtents = [
          extent(allPoints.map(point => point.x)),
          extent(allPoints.map(point => point.y)),
          extent(allPoints.map(point => point.z)),
        ];
        let seriesIndex = 0;
        for (const [name, samples] of grouped) {
          samples.sort((a, b) => a.time - b.time);
          if (samples.some((sample, index) => index > 0 && sample.time === samples[index - 1].time)) throw new Error(`Series “${name}” has duplicate times; time values must be unique per series.`);
          samples.forEach(point => { point.position = new THREE.Vector3(scaleLinear(point.x,...axisExtents[0]), scaleLinear(point.y,...axisExtents[1]), scaleLinear(point.z,...axisExtents[2])); });
          const geometry = resources.track(new THREE.BufferGeometry());
          geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(samples.flatMap(point => [point.position.x,point.position.y,point.position.z])), 3));
          geometry.computeBoundingSphere();
          const lineMaterial = resources.track(new THREE.LineBasicMaterial({ color: palettes[seriesIndex % palettes.length], transparent: true, opacity: .76 }));
          const line = new THREE.Line(geometry, lineMaterial); line.name = `trajectory-${seriesIndex}`; group.add(line);
          const markerGeometry = resources.track(new THREE.SphereGeometry(.11, 16, 12));
          const markerMaterial = resources.track(new THREE.MeshStandardMaterial({ color: palettes[seriesIndex % palettes.length], emissive: palettes[seriesIndex % palettes.length], emissiveIntensity: .15, metalness: .12, roughness: .3 }));
          const marker = new THREE.Mesh(markerGeometry, markerMaterial); marker.userData.seriesName = String(name); group.add(marker);
          entries.push({ name, samples, line, lineMaterial, geometry, marker, markerGeometry, markerMaterial });
          seriesIndex += 1;
        }
        if (!entries.length) throw new Error("No rows have valid numeric trajectory coordinates and times.");
        return { min: timeMin, max: timeMax };
      }
      let timeRange = build(initialRows), currentTime = timeRange.min;
      function positionAt(entry, time) {
        const samples = entry.samples;
        let right = samples.findIndex(point => point.time >= time);
        if (right < 0) right = samples.length - 1;
        if (right === 0) return samples[0];
        const a = samples[right - 1], b = samples[right];
        const fraction = b.time === a.time ? 0 : (time - a.time) / (b.time - a.time);
        return { position: new THREE.Vector3().lerpVectors(a.position, b.position, Math.max(0, Math.min(1, fraction))), row: fraction < .5 ? a.row : b.row };
      }
      function setTime(time) { currentTime = Math.max(timeRange.min, Math.min(timeRange.max, Number(time))); entries.forEach(entry => { entry.marker.position.copy(positionAt(entry, currentTime).position); }); }
      setTime(currentTime);
      return {
        capabilities: ["selection", "time", "animation"],
        update(rows) { timeRange = build(rows); setTime(timeRange.min); context.requestRender(); },
        setTime,
        updateFrame({ elapsedSeconds }) { if (timeRange.max > timeRange.min) setTime(timeRange.min + (elapsedSeconds % 8) / 8 * (timeRange.max - timeRange.min)); },
        describeSelection(hit) { const entry = entries.find(item => item.marker === hit.object); if (!entry) return undefined; const point = positionAt(entry, currentTime); return { id: `row-${point.row.__rowNumber}`, label: `${entry.name} · ${displayNumber(currentTime)}`, values: selected([point.row])[0] }; },
        dispose() { clear(); scene.remove(group); removeLights(); },
        get timeRange() { return timeRange; },
      };
    },
  });
}
