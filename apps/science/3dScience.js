import {
  mount,
  pointCloudPlotter,
  barChartPlotter,
  makeBarPlotter,
  makeScatterPlotter,
  makeSurfacePlotter,
  makeHistogramPlotter,
  makeTrajectoryPlotter,
  makeVectorPlotter,
  makeTimeSlicePlotter,
  makeIsosurfacePlotter,
  weatherTubesPlotter,
} from "../../library/three-viz/src/index.js?v=20261009a";

const $ = selector => document.querySelector(selector);
const PALETTE = Object.freeze({ electric: 0xed5363, magnetic: 0x529cff });
const GRID = 11;
const HALF_EXTENT = 2.7;
const FIELD_EPSILON = 0.38;
const SIMULATION_CYCLE = Math.PI * 2;
const SELECTORS = Object.freeze({
  isosurfaces: "#layer-isosurfaces", vectors: "#layer-vectors", surface: "#layer-surface",
  scatter: "#layer-scatter", points: "#layer-points", histogram: "#layer-histogram",
  bars: "#layer-bars", csvBars: "#layer-csv-bars", trajectories: "#layer-trajectories",
  timeSlice: "#layer-time-slice", weatherTubes: "#layer-weather-tubes",
});

const state = {
  phase: 0,
  frequency: 1,
  amplitude: 1,
  threshold: 0.28,
  playing: true,
  vectorsVisible: false,
  animatedVectors: false,
  electricVisible: true,
  magneticVisible: true,
  lastDataUpdate: 0,
  controller: undefined,
  currentField: undefined,
};

function numericField(record, component) {
  return component === "electric" ? record.electricMagnitude : record.magneticMagnitude;
}

function dipoleAt(x, y, z, phase, frequency, amplitude) {
  const distance = Math.hypot(x, y, z);
  if (distance < FIELD_EPSILON) {
    return { ex: 0, ey: 0, ez: 0, bx: 0, by: 0, bz: 0, eMagnitude: 0, bMagnitude: 0 };
  }
  const nx = x / distance, ny = y / distance, nz = z / distance;
  const retarded = phase - distance * frequency * 1.15;
  const p = Math.cos(retarded) * amplitude;
  const pDot = Math.sin(retarded) * amplitude;
  const inverseR = 1 / distance;
  const inverseR2 = inverseR * inverseR;
  const inverseR3 = inverseR2 * inverseR;
  const radialScale = 3 * nz;
  const ex = ((radialScale * nx) * inverseR3 + (radialScale * nx) * pDot * inverseR2 - nx * p * inverseR) * 0.12;
  const ey = ((radialScale * ny) * inverseR3 + (radialScale * ny) * pDot * inverseR2 - ny * p * inverseR) * 0.12;
  const ez = ((radialScale * nz - 1) * inverseR3 + (radialScale * nz - 1) * pDot * inverseR2 + (1 - nz * nz) * p * inverseR) * 0.12;
  const magneticScale = (pDot * inverseR2 + p * inverseR) * 0.22;
  const bx = -ny * magneticScale;
  const by = nx * magneticScale;
  const bz = 0;
  return { ex, ey, ez, bx, by, bz, eMagnitude: Math.hypot(ex, ey, ez), bMagnitude: Math.hypot(bx, by, bz) };
}

function generateField(phase = state.phase, frequency = state.frequency, amplitude = state.amplitude) {
  const records = [];
  const step = (HALF_EXTENT * 2) / (GRID - 1);
  let electricPeak = 0, magneticPeak = 0;
  let rowNumber = 1;
  for (let ix = 0; ix < GRID; ix += 1) {
    const x = -HALF_EXTENT + step * ix;
    for (let iy = 0; iy < GRID; iy += 1) {
      const y = -HALF_EXTENT + step * iy;
      for (let iz = 0; iz < GRID; iz += 1) {
        const z = -HALF_EXTENT + step * iz;
        const field = dipoleAt(x, y, z, phase, frequency, 1);
        electricPeak = Math.max(electricPeak, field.eMagnitude);
        magneticPeak = Math.max(magneticPeak, field.bMagnitude);
        records.push({
          id: `sample-${rowNumber}`, __rowNumber: rowNumber, label: `Grid sample ${rowNumber}`,
          x, y, z,
          ex: field.ex, ey: field.ey, ez: field.ez,
          bx: field.bx, by: field.by, bz: field.bz,
          electricMagnitude: field.eMagnitude,
          magneticMagnitude: field.bMagnitude,
          phase,
        });
        rowNumber += 1;
      }
    }
  }
  const eScale = Math.max(electricPeak, 1e-9), bScale = Math.max(magneticPeak, 1e-9);
  return records.map(record => ({
    ...record,
    ex: record.ex / eScale * amplitude, ey: record.ey / eScale * amplitude, ez: record.ez / eScale * amplitude,
    bx: record.bx / bScale * amplitude, by: record.by / bScale * amplitude, bz: record.bz / bScale * amplitude,
    electricMagnitude: Math.min(1, record.electricMagnitude / eScale * amplitude),
    magneticMagnitude: Math.min(1, record.magneticMagnitude / bScale * amplitude),
  }));
}

function makeProbePaths(frames) {
  const paths = [];
  for (let index = 0; index < 8; index += 1) {
    const seedIndex = Math.floor((index + 1) * (frames[0].length - 1) / 9);
    const seed = frames[0][seedIndex];
    for (let sampleIndex = 0; sampleIndex < frames.length; sampleIndex += 1) {
      const time = sampleIndex / Math.max(1, frames.length - 1);
      const record = frames[sampleIndex][seedIndex];
      paths.push({
        __rowNumber: paths.length + 1,
        x: seed.x + record.ex * 0.48,
        y: seed.y + record.ey * 0.48,
        z: seed.z + record.ez * 0.48,
        time,
        series: `Probe ${index + 1}`,
      });
    }
  }
  return paths;
}

function makeTimeSeries() {
  const frames = [];
  const timeCount = 8;
  for (let index = 0; index < timeCount; index += 1) {
    const phase = (index / (timeCount - 1)) * SIMULATION_CYCLE;
    frames.push(generateField(phase, state.frequency, state.amplitude));
  }
  const timeRows = frames.flatMap((frame, time) => frame.filter((_, index) => index % 4 === 0).map(row => ({ ...row, value: row.electricMagnitude, time })));
  const weatherRows = frames.map((frame, index) => {
    let electric = 0, magnetic = 0;
    for (let sample = 0; sample < frame.length; sample += 1) {
      electric += frame[sample].electricMagnitude;
      magnetic += frame[sample].magneticMagnitude;
    }
    const phase = (index / (timeCount - 1)) * SIMULATION_CYCLE;
    return {
      label: `Phase ${phase.toFixed(2)} rad`,
      description: "Dipole field magnitude averaged across the normalized sample volume.",
      metrics: { electric: electric / frame.length, magnetic: magnetic / frame.length },
    };
  });
  return { frames, timeRows, weatherRows, paths: makeProbePaths(frames) };
}

function fieldSlice(records, component = "electric") {
  const centerIndex = Math.floor(GRID / 2);
  return records.filter(record => Math.abs(record.y) < 1e-8).map(record => ({
    ...record,
    categoryX: `X${String(Math.round((record.x + HALF_EXTENT) / (HALF_EXTENT * 2) * (GRID - 1))).padStart(2, "0")}`,
    categoryZ: `Z${String(Math.round((record.z + HALF_EXTENT) / (HALF_EXTENT * 2) * (GRID - 1))).padStart(2, "0")}`,
    regionX: `X${Math.floor((record.x + HALF_EXTENT) / (HALF_EXTENT * 2) * 4)}`,
    regionZ: `Z${Math.floor((record.z + HALF_EXTENT) / (HALF_EXTENT * 2) * 4)}`,
    value: numericField(record, component),
    height: numericField(record, component),
    component,
    __rowNumber: record.__rowNumber ?? centerIndex,
  }));
}

function layerData(id, component, currentRecords, timeRows, paths, weatherRows) {
  const componentKey = component === "electric" ? "electric" : "magnetic";
  const suffix = component === "electric" ? "e" : "b";
  const field = currentRecords.map(record => ({
    ...record,
    u: record[`${suffix}x`], v: record[`${suffix}y`], w: record[`${suffix}z`],
    value: numericField(record, component),
  }));
  const probes = field.filter((_, index) => index % 4 === 0);
  const slice = fieldSlice(field, component);
  if (id === "surface") return slice;
  if (id === "scatter") return probes;
  if (id === "points") return probes;
  if (id === "histogram") return field;
  if (id === "bars" || id === "csvBars") return slice;
  if (id === "trajectories") return paths;
  if (id === "timeSlice") return timeRows;
  if (id === "weatherTubes") return { rows: weatherRows, keys: ["electric", "magnetic"], metricDefinitions: {
    electric: { label: "Electric field", unit: " norm", color: PALETTE.electric },
    magnetic: { label: "Magnetic field", unit: " norm", color: PALETTE.magnetic },
  } };
  if (id === "isosurfaces") return field;
  if (id === "vectors" || id === "animatedVectors") return field;
  return field;
}

function compositeDipolePlotter(initialLayers) {
  const plotters = [];
  const layerGroups = new Map();
  const componentGroups = new Map();
  const vectorModes = { static: [], animated: [] };
  let currentPhase = 0;
  let updateClock = 0;
  let lastUpdatePhase = -1;

  return {
    capabilities: ["selection", "time", "animation", "layers", "thresholds"],
    create(context, definition, initialData) {
      const { THREE } = context;
      let dataset = initialData;
      const makeGroup = (name, parent) => {
        const group = new THREE.Group();
        group.name = name;
        parent.add(group);
        return group;
      };
      const getTypeGroups = id => [...layerGroups.entries()].filter(([key]) => key.startsWith(`${id}:`)).map(([, group]) => group);
      const createComponent = name => {
        const group = makeGroup(`science-component-${name}`, context.scene);
        group.visible = name === "electric" ? state.electricVisible : state.magneticVisible;
        componentGroups.set(name, group);
        return group;
      };
      createComponent("electric");
      createComponent("magnetic");

      const add = ({ id, component, plotter, groupKey, dataId = id, configuration = {}, dataMap, enabled = false, mode }) => {
        const componentGroup = component ? componentGroups.get(component) : context.scene;
        const layerGroupKey = `${groupKey}:${component ?? "global"}`;
        const layerGroup = layerGroups.get(layerGroupKey) ?? makeGroup(`science-layer-${layerGroupKey}`, componentGroup);
        layerGroups.set(layerGroupKey, layerGroup);
        const sceneLayer = makeGroup(`science-plotter-${id}`, layerGroup);
        const plotterData = dataMap ? dataMap(initialData, component) : layerData(dataId, component, initialData.field, initialData.timeRows, initialData.paths, initialData.weatherRows);
        try {
          const instance = plotter.create({ ...context, scene: sceneLayer }, {
            ...definition,
            configuration: { ...definition.configuration, ...configuration },
          }, plotterData);
          plotters.push({ id, component, groupKey, sceneLayer, instance, dataId, dataMap, configuration, mode });
          sceneLayer.visible = true;
          if (mode) vectorModes[mode].push(sceneLayer);
        } catch (error) {
          layerGroup.remove(sceneLayer);
          sceneLayer.visible = false;
          definition.callbacks?.onLayerError?.(groupKey, error);
        }
      };

      add({ id: "electric-iso", component: "electric", dataId: "isosurfaces", plotter: makeIsosurfacePlotter({ x: "x", y: "y", z: "z", value: "value" }, { threshold: state.threshold, nested: true, wireframe: true, color: PALETTE.electric, wireframeColor: 0xffb5bc }), groupKey: "isosurfaces", enabled: initialLayers.has("isosurfaces") });
      add({ id: "magnetic-iso", component: "magnetic", dataId: "isosurfaces", plotter: makeIsosurfacePlotter({ x: "x", y: "y", z: "z", value: "value" }, { threshold: state.threshold, nested: true, wireframe: true, color: PALETTE.magnetic, wireframeColor: 0xb5d4ff }), groupKey: "isosurfaces", enabled: initialLayers.has("isosurfaces") });
      add({ id: "electric-vector", component: "electric", dataId: "vectors", plotter: makeVectorPlotter({ x: "x", y: "y", z: "z", u: "u", v: "v", w: "w" }, 0.62, { color: PALETTE.electric }), groupKey: "vectors", mode: "static" });
      add({ id: "magnetic-vector", component: "magnetic", dataId: "vectors", plotter: makeVectorPlotter({ x: "x", y: "y", z: "z", u: "u", v: "v", w: "w" }, 0.62, { color: PALETTE.magnetic }), groupKey: "vectors", mode: "static" });
      add({ id: "electric-cones", component: "electric", dataId: "vectors", plotter: makeVectorPlotter({ x: "x", y: "y", z: "z", u: "u", v: "v", w: "w" }, 0.62, { animated: true, color: PALETTE.electric, cycleDuration: 3.6, maxTravel: 0.72 }), groupKey: "vectors", mode: "animated" });
      add({ id: "magnetic-cones", component: "magnetic", dataId: "vectors", plotter: makeVectorPlotter({ x: "x", y: "y", z: "z", u: "u", v: "v", w: "w" }, 0.62, { animated: true, color: PALETTE.magnetic, cycleDuration: 3.6, maxTravel: 0.72 }), groupKey: "vectors", mode: "animated" });
      add({ id: "electric-surface", component: "electric", dataId: "surface", plotter: makeSurfacePlotter({ x: "x", z: "z", height: "height" }), groupKey: "surface" });
      add({ id: "magnetic-surface", component: "magnetic", dataId: "surface", plotter: makeSurfacePlotter({ x: "x", z: "z", height: "height" }), groupKey: "surface" });
      add({ id: "electric-scatter", component: "electric", dataId: "scatter", plotter: makeScatterPlotter({ x: "x", y: "y", z: "z" }), groupKey: "scatter" });
      add({ id: "magnetic-scatter", component: "magnetic", dataId: "scatter", plotter: makeScatterPlotter({ x: "x", y: "y", z: "z" }), groupKey: "scatter" });
      add({ id: "electric-points", component: "electric", dataId: "points", plotter: pointCloudPlotter, groupKey: "points", configuration: { pointCloud: { color: PALETTE.electric, size: 0.065 } } });
      add({ id: "magnetic-points", component: "magnetic", dataId: "points", plotter: pointCloudPlotter, groupKey: "points", configuration: { pointCloud: { color: PALETTE.magnetic, size: 0.065 } } });
      add({ id: "electric-histogram", component: "electric", dataId: "histogram", plotter: makeHistogramPlotter({ x: "x", z: "z" }, 8), groupKey: "histogram" });
      add({ id: "magnetic-histogram", component: "magnetic", dataId: "histogram", plotter: makeHistogramPlotter({ x: "x", z: "z" }, 8), groupKey: "histogram" });
      add({ id: "electric-bars", component: "electric", dataId: "bars", plotter: barChartPlotter, groupKey: "bars", configuration: { barChart: { mappings: { categoryX: "categoryX", categoryZ: "categoryZ", value: "value" }, color: PALETTE.electric, barWidth: 0.65 } } });
      add({ id: "magnetic-bars", component: "magnetic", dataId: "bars", plotter: barChartPlotter, groupKey: "bars", configuration: { barChart: { mappings: { categoryX: "categoryX", categoryZ: "categoryZ", value: "value" }, color: PALETTE.magnetic, barWidth: 0.65 } } });
      add({ id: "electric-csv-bars", component: "electric", dataId: "csvBars", plotter: makeBarPlotter({ categoryX: "regionX", categoryZ: "regionZ", value: "value" }, "mean"), groupKey: "csvBars" });
      add({ id: "magnetic-csv-bars", component: "magnetic", dataId: "csvBars", plotter: makeBarPlotter({ categoryX: "regionX", categoryZ: "regionZ", value: "value" }, "mean"), groupKey: "csvBars" });
      add({ id: "electric-trajectories", component: "electric", plotter: makeTrajectoryPlotter({ x: "x", y: "y", z: "z", time: "time", series: "series" }), groupKey: "trajectories", dataMap: data => data.paths });
      add({ id: "electric-time-slice", component: "electric", plotter: makeTimeSlicePlotter({ x: "x", y: "y", z: "z", value: "value", time: "time" }), groupKey: "timeSlice", dataMap: data => data.timeRows });
      add({ id: "field-weather-tubes", plotter: weatherTubesPlotter, groupKey: "weatherTubes", dataMap: data => ({ rows: data.weatherRows, keys: ["electric", "magnetic"], metricDefinitions: {
        electric: { label: "Electric field", unit: " norm", color: PALETTE.electric },
        magnetic: { label: "Magnetic field", unit: " norm", color: PALETTE.magnetic },
      } }) });

      layerGroups.forEach((group, key) => {
        group.visible = key.startsWith("isosurfaces:");
      });
      vectorModes.static.forEach(group => { group.visible = false; });
      vectorModes.animated.forEach(group => { group.visible = false; });

      const dataFor = (plotter, field = generateField(currentPhase), sourceData = dataset) => {
        const data = { ...sourceData, field };
        return plotter.dataMap ? plotter.dataMap(data, plotter.component) : layerData(plotter.dataId, plotter.component, field, data.timeRows, data.paths, data.weatherRows);
      };
      const isLayerVisible = plotter => {
        for (let parent = plotter.sceneLayer; parent; parent = parent.parent) if (parent.visible === false) return false;
        return true;
      };
      const refreshSpatialLayers = () => {
        const field = generateField(currentPhase);
        state.currentField = field;
        for (const plotter of plotters) {
          if (plotter.groupKey === "timeSlice" || plotter.groupKey === "trajectories" || plotter.groupKey === "weatherTubes") continue;
          if (!isLayerVisible(plotter)) continue;
          try { plotter.instance.update(dataFor(plotter, field)); }
          catch (error) { definition.callbacks?.onLayerError?.(plotter.groupKey, error); }
        }
        context.requestRender();
      };
      const updateLayerVisibility = () => {
        const vectorOn = getTypeGroups("vectors").some(group => group.visible);
        vectorModes.static.forEach(group => { group.visible = vectorOn && !state.animatedVectors; });
        vectorModes.animated.forEach(group => { group.visible = vectorOn && state.animatedVectors; });
        context.requestRender();
      };
      const setTime = phase => {
        if (!Number.isFinite(Number(phase))) throw new Error("Wave phase must be a finite number.");
        currentPhase = ((Number(phase) % SIMULATION_CYCLE) + SIMULATION_CYCLE) % SIMULATION_CYCLE;
        state.phase = currentPhase;
        refreshSpatialLayers();
        const sliceTime = (currentPhase / SIMULATION_CYCLE) * 7;
        for (const plotter of plotters) {
          if (plotter.groupKey === "timeSlice" || plotter.groupKey === "trajectories" || plotter.groupKey === "weatherTubes") {
            const time = plotter.groupKey === "trajectories" ? currentPhase / SIMULATION_CYCLE : plotter.groupKey === "weatherTubes" ? sliceTime : sliceTime;
            try { plotter.instance.setTime?.(time); } catch { /* The next animation frame may use the complete sample range. */ }
          }
        }
      };
      const toggleLayer = (id, visible) => {
        if (id === "electric" || id === "magnetic") {
          componentGroups.get(id).visible = Boolean(visible);
        } else if (id === "multiple" || id === "wireframe") {
          for (const plotter of plotters.filter(item => item.groupKey === "isosurfaces")) plotter.instance.setLayerVisible?.(id, Boolean(visible));
        } else if (id === "vector-mode") {
          state.animatedVectors = Boolean(visible);
          updateLayerVisibility();
        } else if (layerGroups.has(id)) {
          layerGroups.get(id).visible = Boolean(visible);
          if (id === "vectors") updateLayerVisibility();
        } else {
          getTypeGroups(id).forEach(group => { group.visible = Boolean(visible); });
          if (id === "vectors") updateLayerVisibility();
        }
        context.requestRender();
      };

      for (const [key, selector] of Object.entries(SELECTORS)) {
        getTypeGroups(key).forEach(group => { group.visible = $(selector).checked; });
      }
      updateLayerVisibility();

      return {
        capabilities: ["selection", "time", "animation", "layers", "thresholds"],
        update(nextData) {
          dataset = nextData;
          currentPhase = nextData.phase ?? currentPhase;
          for (const plotter of plotters) {
            try { plotter.instance.update(dataFor(plotter, nextData.field, dataset)); }
            catch (error) { definition.callbacks?.onLayerError?.(plotter.groupKey, error); }
          }
          context.requestRender();
        },
        updateFrame({ elapsedSeconds, deltaSeconds }) {
          const nextPhase = ((elapsedSeconds * state.frequency * (Math.PI * 2)) % SIMULATION_CYCLE + SIMULATION_CYCLE) % SIMULATION_CYCLE;
          updateClock += deltaSeconds;
          for (const plotter of plotters) {
            if (isLayerVisible(plotter) && (!plotter.mode || plotter.mode === "animated")) plotter.instance.updateFrame?.({ elapsedSeconds, deltaSeconds });
          }
          if (updateClock > 0.18 && Math.abs(nextPhase - lastUpdatePhase) > 0.06) {
            currentPhase = nextPhase;
            state.phase = currentPhase;
            lastUpdatePhase = nextPhase;
            updateClock = 0;
            refreshSpatialLayers();
            definition.callbacks?.onTime?.(currentPhase);
          }
        },
        setTime,
        setThreshold(value) {
          state.threshold = Number(value);
          plotters.filter(plotter => plotter.groupKey === "isosurfaces").forEach(plotter => plotter.instance.setThreshold?.(state.threshold));
        },
        setLayerVisible: toggleLayer,
        describeSelection(hit) {
          let group = hit.object;
          const knownLayerGroups = [...layerGroups.values()];
          while (group && !knownLayerGroups.includes(group)) group = group.parent;
          if (!group) return undefined;
          const plotter = plotters.find(item => {
            let current = hit.object;
            while (current && current !== item.sceneLayer) current = current.parent;
            return current === item.sceneLayer;
          });
          return plotter?.instance.describeSelection?.(hit);
        },
        dispose() {
          for (const plotter of [...plotters].reverse()) {
            try { plotter.instance.dispose(); } catch (error) { definition.callbacks?.onLayerError?.(plotter.groupKey, error); }
          }
          for (const group of layerGroups.values()) group.parent?.remove(group);
          for (const group of componentGroups.values()) context.scene.remove(group);
        },
      };
    },
  };
}

function makeInitialData() {
  const field = generateField(0);
  const { timeRows, paths, weatherRows } = makeTimeSeries();
  return { field, timeRows, paths, weatherRows, phase: 0 };
}

function updateFieldParameters() {
  const data = makeInitialData();
  state.controller.update({ ...data, field: generateField(state.phase), phase: state.phase });
}

function showError(message = "") {
  const error = $("#error-message");
  error.hidden = !message;
  error.textContent = message;
}

function updateReadouts(phase = state.phase) {
  const display = (phase % SIMULATION_CYCLE).toFixed(2);
  $("#phase-value").textContent = display;
  $("#phase").value = display;
  $("#phase-readout").textContent = `PHASE ${display}`;
  $("#legend-phase").textContent = `PHASE ${display} RAD`;
  $("#frequency-value").textContent = `${state.frequency.toFixed(1)}×`;
  $("#amplitude-value").textContent = state.amplitude.toFixed(1);
  $("#threshold-value").textContent = state.threshold.toFixed(2);
}

function updatePlotterControls() {
  state.vectorsVisible = $("#layer-vectors").checked;
  $("#vector-options").hidden = !state.vectorsVisible;
  $("#animated-cones").disabled = !state.vectorsVisible;
  state.animatedVectors = $("#animated-cones").checked;
  state.electricVisible = $("#show-electric").checked;
  state.magneticVisible = $("#show-magnetic").checked;
  if (!state.electricVisible && !state.magneticVisible) {
    $("#show-magnetic").checked = true;
    state.magneticVisible = true;
  }
  $("#legend-electric").hidden = !state.electricVisible;
  $("#legend-magnetic").hidden = !state.magneticVisible;
  if (state.controller) {
    state.controller.setLayerVisible("electric", state.electricVisible);
    state.controller.setLayerVisible("magnetic", state.magneticVisible);
    for (const [key, selector] of Object.entries(SELECTORS)) state.controller.setLayerVisible(key, $(selector).checked);
    state.controller.setLayerVisible("multiple", $("#multiple-surfaces").checked);
    state.controller.setLayerVisible("wireframe", $("#iso-wireframes").checked);
    state.controller.setLayerVisible("vector-mode", state.animatedVectors);
  }
}

function makeExportCanvas() {
  const source = $("#viewport canvas");
  if (!source) throw new Error("Wait for the field to finish rendering before exporting.");
  const canvas = document.createElement("canvas");
  const scale = Math.max(1, 1600 / source.width);
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas export is not available in this browser.");
  ctx.fillStyle = "#202832";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  drawLegend(ctx, canvas.width, canvas.height);
  return canvas;
}

function drawLegend(ctx, width, height) {
  const scale = width / 1200;
  const visibleComponents = [
    ...(state.electricVisible ? [["E · electric field", "#ed5363"]] : []),
    ...(state.magneticVisible ? [["B · magnetic field", "#529cff"]] : []),
  ];
  const boxHeight = (51 + visibleComponents.length * 20 + 8) * scale;
  const x = 26 * scale, y = height - (boxHeight + 22 * scale), boxWidth = 275 * scale;
  ctx.fillStyle = "rgba(10,16,22,.88)";
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.strokeStyle = "rgba(185,204,225,.35)";
  ctx.strokeRect(x, y, boxWidth, boxHeight);
  ctx.fillStyle = "#e5edf5";
  ctx.font = `600 ${Math.round(13 * scale)}px system-ui`;
  ctx.fillText("FIELD AMPLITUDE · NORMALIZED", x + 14 * scale, y + 21 * scale);
  ctx.font = `${Math.round(13 * scale)}px system-ui`;
  visibleComponents.forEach(([label, color], index) => {
    const lineY = y + (42 + index * 20) * scale;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + 19 * scale, lineY, 4 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#dce5ee"; ctx.fillText(label, x + 31 * scale, lineY + 4 * scale);
  });
  ctx.fillStyle = "#9aaaba";
  ctx.font = `${Math.round(10 * scale)}px ui-monospace,monospace`;
  ctx.fillText(`DIPOLE · PHASE ${state.phase.toFixed(2)} RAD`, x + 14 * scale, y + boxHeight - 7 * scale);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function setExportStatus(message, error = false) {
  const output = $("#export-status");
  output.textContent = message;
  output.style.color = error ? "#ffb4bc" : "";
}

function downloadScreenshot() {
  try {
    makeExportCanvas().toBlob(blob => {
      if (!blob) { setExportStatus("PNG encoding failed in this browser.", true); return; }
      downloadBlob(blob, "3dscience-electromagnetic-field.png");
      setExportStatus("PNG saved with the field legend.");
    }, "image/png");
  } catch (error) { setExportStatus(error.message, true); }
}

function downloadOrbitVideo() {
  const recorderType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(type => window.MediaRecorder?.isTypeSupported?.(type));
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream || !recorderType) {
    setExportStatus("Video capture is not supported by this browser.", true);
    return;
  }
  if (!state.controller) { setExportStatus("Wait for the field to finish rendering first.", true); return; }
  const pose = state.controller.getCameraPose();
  const offsetX = pose.position[0] - pose.target[0], offsetY = pose.position[1] - pose.target[1], offsetZ = pose.position[2] - pose.target[2];
  const initialAngle = Math.atan2(offsetX, offsetZ);
  const wasPlaying = state.playing;
  const canvas = makeExportCanvas();
  const stream = canvas.captureStream(30);
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType: recorderType, videoBitsPerSecond: 5_000_000 });
  const durationMs = 12000;
  let startedAt;
  setExportStatus("Recording one 360° camera orbit…");
  recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
  recorder.onerror = () => setExportStatus("The browser stopped video recording unexpectedly.", true);
  recorder.onstop = () => {
    try {
      state.controller?.setCameraPose(pose);
      if (wasPlaying) state.controller?.play();
      else state.controller?.pause();
      stream.getTracks().forEach(track => track.stop());
      if (!chunks.length) { setExportStatus("The browser produced no video frames.", true); return; }
      downloadBlob(new Blob(chunks, { type: "video/webm" }), "3dscience-360-field-orbit.webm");
      setExportStatus("360° WebM saved with the field legend.");
    } catch (error) { setExportStatus(error.message, true); }
  };
  try { recorder.start(250); }
  catch (error) { stream.getTracks().forEach(track => track.stop()); setExportStatus(error.message, true); return; }
  const drawFrame = now => {
    if (!startedAt) startedAt = now;
    const fraction = Math.min(1, (now - startedAt) / durationMs);
    const angle = initialAngle + fraction * Math.PI * 2;
    try {
      state.controller?.setOrbitAngle(angle);
      const ctx = canvas.getContext("2d");
      const source = $("#viewport canvas");
      if (ctx && source) {
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        drawLegend(ctx, canvas.width, canvas.height);
      }
    } catch (error) {
      recorder.stop(); setExportStatus(error.message, true); return;
    }
    if (fraction < 1) requestAnimationFrame(drawFrame);
    else recorder.stop();
  };
  requestAnimationFrame(drawFrame);
}

async function start() {
  const loading = $("#loading");
  const status = $("#status-text");
  try {
    const data = makeInitialData();
    state.currentField = data.field;
    const active = new Set(Object.entries(SELECTORS).filter(([, selector]) => $(selector).checked).map(([key]) => key));
    state.controller = await mount($("#viewport"), {
      plotter: compositeDipolePlotter(active),
      data,
      configuration: { backgroundColor: 0x202832, autoplay: true },
      renderer: { antialias: true, maxPixelRatio: 1.5, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMapping: "ACESFilmicToneMapping", toneMappingExposure: 1.08 },
      camera: { type: "perspective", position: [8.5, 6.5, 9], target: [0, 0, 0], fov: 42, modes: ["perspective", "orthographic"], orthographicHeight: 8 },
      controls: { enabled: true, enableDamping: true, dampingFactor: 0.065, minDistance: 5, maxDistance: 22 },
      callbacks: {
        onError(error) { status.textContent = "VIEW ERROR"; showError(error.message); $("#status-dot").className = "status-dot error"; },
        onSelection(selection) {
          if (!selection) return;
          const values = Object.entries(selection.values ?? {}).filter(([, value]) => typeof value !== "object").slice(0, 6).map(([key, value]) => `${key}: ${String(value)}`);
          $("#selection-note").textContent = `${selection.label}\n${values.join(" · ")}`;
        },
        onLayerError(layer, error) { showError(`${layer}: ${error.message}`); },
        onTime(phase) { updateReadouts(phase); },
      },
    });
    loading.hidden = true;
    status.textContent = "FIELD RUNNING";
    $("#status-dot").className = "status-dot ready";
    $("#stage-heading").textContent = "DIPOLE FIELD / NESTED ISOSURFACES";
    $("#stage-subheading").textContent = `${GRID}³ REGULAR GRID · E RED · B BLUE · NORMALIZED UNITS`;
    updatePlotterControls();
    updateReadouts();
    $("#phase").addEventListener("input", event => {
      const phase = Number(event.target.value);
      state.controller.setTime(phase);
      updateReadouts(phase);
    });
    $("#frequency").addEventListener("input", event => {
      state.frequency = Number(event.target.value);
      updateFieldParameters();
      updateReadouts();
    });
    $("#field-amplitude").addEventListener("input", event => {
      state.amplitude = Number(event.target.value);
      updateFieldParameters();
      $("#amplitude-value").textContent = state.amplitude.toFixed(1);
    });
    $("#iso-threshold").addEventListener("input", event => {
      state.threshold = Number(event.target.value);
      $("#threshold-value").textContent = state.threshold.toFixed(2);
      try { state.controller.setThreshold(state.threshold); showError(""); }
      catch (error) { showError(error.message); }
    });
    $("#play-toggle").addEventListener("click", () => {
      state.playing = !state.playing;
      state.playing ? state.controller.play() : state.controller.pause();
      $("#play-toggle").textContent = state.playing ? "PAUSE FIELD" : "PLAY FIELD";
      $("#play-toggle").setAttribute("aria-pressed", String(state.playing));
      status.textContent = state.playing ? "FIELD RUNNING" : "FIELD PAUSED";
    });
    $("#reset-time").addEventListener("click", () => { state.controller.setTime(0); updateReadouts(0); });
    $("#reset-view").addEventListener("click", () => state.controller.resetView());
    $("#download-image").addEventListener("click", downloadScreenshot);
    $("#download-video").addEventListener("click", downloadOrbitVideo);
    $("#fullscreen-toggle").addEventListener("click", async () => {
      try {
        if (document.fullscreenElement === $("#stage")) await document.exitFullscreen();
        else await $("#stage").requestFullscreen();
      } catch { showError("Fullscreen is unavailable in this browser."); }
    });
    document.addEventListener("fullscreenchange", () => {
      const fullscreen = document.fullscreenElement === $("#stage");
      $("#stage").classList.toggle("science-stage-fullscreen", fullscreen);
      $("#fullscreen-toggle").textContent = fullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN";
      $("#fullscreen-toggle").setAttribute("aria-pressed", String(fullscreen));
    });
    for (const [key, selector] of Object.entries(SELECTORS)) {
      $(selector).addEventListener("change", () => {
        if (key === "vectors") {
          state.vectorsVisible = $(selector).checked;
          $("#vector-options").hidden = !state.vectorsVisible;
          $("#animated-cones").disabled = !state.vectorsVisible;
        }
        state.controller.setLayerVisible(key, $(selector).checked);
        if (key === "vectors") state.controller.setLayerVisible("vector-mode", $("#animated-cones").checked);
      });
    }
    $("#show-electric").addEventListener("change", updatePlotterControls);
    $("#show-magnetic").addEventListener("change", updatePlotterControls);
    $("#animated-cones").addEventListener("change", event => state.controller.setLayerVisible("vector-mode", event.target.checked));
    $("#multiple-surfaces").addEventListener("change", event => state.controller.setLayerVisible("multiple", event.target.checked));
    $("#iso-wireframes").addEventListener("change", event => state.controller.setLayerVisible("wireframe", event.target.checked));
  } catch (error) {
    loading.hidden = true;
    status.textContent = "VIEW FAILED";
    $("#status-dot").className = "status-dot error";
    showError(error.message);
  }
}

$("#frequency").addEventListener("input", event => { state.frequency = Number(event.target.value); $("#frequency-value").textContent = `${state.frequency.toFixed(1)}×`; });
start();
