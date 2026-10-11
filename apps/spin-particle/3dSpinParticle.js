import { mount } from "../../library/three-viz/src/index.js?v=20261010v";
import { makeSimulationPreset, SI_INTERACTION_COUPLING, SIMULATION_UNITS, toSIValues } from "./spin-particle-si.js?v=20261010e";
import { spinParticlePlotter } from "./spin-particle-plotter.js?v=20261010s";

const $ = selector => document.querySelector(selector);
const ui = {
  viewport:$("#viewport"), loading:$("#loading"), status:$("#status-note"), stageStatus:$("#stage-status"), statusDot:$("#status-dot"), error:$("#error-message"),
  count:$("#particle-count"), countControls:$("#particle-count-controls"), countValue:$("#particle-count-value"), countLabel:$("#particle-count-label"), preset:$("#system-preset"),
  softening:$("#softening"), softeningValue:$("#softening-value"), speed:$("#simulation-speed"), speedValue:$("#speed-value"),
  fieldVectors:$("#field-vectors"), fieldIsosurfaces:$("#field-isosurfaces"), fieldConeIso:$("#field-cone-iso"), fieldMultiple:$("#field-multiple"),
  fieldSolid:$("#field-solid"), fieldWireframe:$("#field-wireframe"),
  fieldVectorElectric:$("#field-vector-electric"), fieldVectorMagnetic:$("#field-vector-magnetic"),
  fieldSurfaceElectric:$("#field-surface-electric"), fieldSurfaceMagnetic:$("#field-surface-magnetic"),
  fieldSurfaceCount:$("#field-surface-count"), fieldSurfaceCountValue:$("#field-surface-count-value"), fieldResolution:$("#field-resolution"), fieldResolutionValue:$("#field-resolution-value"),
  fieldVectorScale:$("#field-vector-scale"), fieldVectorScaleValue:$("#field-vector-scale-value"),
  fieldConeIsoSize:$("#field-cone-iso-size"), fieldConeIsoSizeValue:$("#field-cone-iso-size-value"),
  fieldThreshold:$("#field-threshold"), fieldThresholdValue:$("#field-threshold-value"), fieldTubeRadius:$("#field-tube-radius"), fieldTubeRadiusValue:$("#field-tube-radius-value"),
  play:$("#play-toggle"), step:$("#step-once"), reset:$("#reset-system"), time:$("#time-readout"), selection:$("#selection-readout"), legend:$("#legend-meta"),
};
let controller;
let particles = [];
let running = false;

function setError(message = "") {
  ui.error.hidden = !message;
  ui.error.textContent = message;
  if (message) {
    ui.status.textContent = "RENDER ERROR · PAUSED";
    ui.stageStatus.textContent = "ERROR";
    ui.statusDot.className = "status-dot error";
  }
}

function makeParticleSet(count, preset) {
  ui.countControls.hidden = preset === "dipole";
  return makeSimulationPreset(count, preset === "dipole" ? "dipole" : "cloud");
}

function interactionValues() {
  return {
    softening:Number(ui.softening.value),
    electricCoupling:SI_INTERACTION_COUPLING.electric,
    magneticCoupling:SI_INTERACTION_COUPLING.magnetic,
  };
}

function currentSettings() {
  return {
    interaction:interactionValues(),
    simulationSpeed:Number(ui.speed.value),
    fieldOptions:{
      vectors:ui.fieldVectors.checked, isosurfaces:ui.fieldIsosurfaces.checked, coneIso:ui.fieldConeIso.checked,
      multiple:ui.fieldMultiple.checked, solid:ui.fieldSolid.checked, wireframe:ui.fieldWireframe.checked,
      vectorElectric:ui.fieldVectorElectric.checked, vectorMagnetic:ui.fieldVectorMagnetic.checked,
      surfaceElectric:ui.fieldSurfaceElectric.checked, surfaceMagnetic:ui.fieldSurfaceMagnetic.checked,
      vectorScale:Number(ui.fieldVectorScale.value),
      coneIsoScale:Number(ui.fieldConeIsoSize.value),
      surfaceCount:Number(ui.fieldSurfaceCount.value), resolution:Number(ui.fieldResolution.value),
      threshold:Number(ui.fieldThreshold.value), tubeRadius:Number(ui.fieldTubeRadius.value),
    },
  };
}

function updateReadouts(elapsed = 0, particleCount = particles.length) {
  ui.time.textContent = `t = ${(elapsed * SIMULATION_UNITS.time * 1e15).toFixed(3)} fs`;
  ui.countValue.textContent = String(particleCount);
  ui.countLabel.textContent = `${particleCount} bodies`;
  ui.legend.textContent = `${particleCount} particles · pairwise sum`;
}

function setRunning(value) {
  running = Boolean(value);
  if (running) controller?.play();
  else controller?.pause();
  ui.play.textContent = running ? "PAUSE" : "PLAY";
  ui.play.setAttribute("aria-pressed", String(running));
  ui.stageStatus.textContent = running ? "RUNNING" : "PAUSED";
  ui.status.textContent = running ? "FIELD EVOLVING" : "READY · PAUSED";
  ui.statusDot.className = running ? "status-dot ready" : "status-dot";
}

async function resetSystem() {
  if (!controller) return;
  setRunning(false);
  particles = makeParticleSet(Number(ui.count.value), ui.preset.value);
  ui.selection.textContent = "Select a particle to inspect all six model fields.";
  delete ui.selection.dataset.particleType;
  updateReadouts(0, particles.length);
  try {
    await controller.update({ particles, ...currentSettings() });
    setError("");
  } catch (error) {
    setError(error.message);
  }
}

function renderSelection(selection) {
  const normalized = selection?.values;
  if (!normalized) return;
  if (selection.kind === "field-sample") {
    delete ui.selection.dataset.particleType;
    const v = value => Number(value).toExponential(3);
    ui.selection.textContent = `${selection.label}\nfield sample at [${normalized.x.toFixed(2)}, ${normalized.y.toFixed(2)}, ${normalized.z.toFixed(2)}] Å\n|E| ${v(normalized.electricMagnitudeVPerM)} V/m\nE [${v(normalized.electricX_VPerM)}, ${v(normalized.electricY_VPerM)}, ${v(normalized.electricZ_VPerM)}] V/m\n|B| ${v(normalized.magneticMagnitudeTesla)} T\nB [${v(normalized.magneticX_Tesla)}, ${v(normalized.magneticY_Tesla)}, ${v(normalized.magneticZ_Tesla)}] T`;
    return;
  }
  const values = toSIValues(normalized);
  const formatVector = vector => `[${vector.map(item => item.toExponential(3)).join(", ")}]`;
  const formatPosition = vector => `[${vector.map(item => (item / SIMULATION_UNITS.length).toFixed(3)).join(", ")}]`;
  const type = values.charge < 0 ? "electron" : "proton";
  ui.selection.dataset.particleType = type;
  ui.selection.textContent = `${selection.label} · ${type}\nmass ${values.mass.toExponential(4)} kg · charge ${values.charge.toExponential(4)} C\nposition ${formatPosition(values.position)} Å\nvelocity ${formatVector(values.velocity)} m/s\nmagnetic moment ${formatVector(values.magneticMoment)} J/T\ngyromagnetic ratio ${values.gyromagneticRatio.toExponential(4)} s⁻¹ T⁻¹`;
}

async function start() {
  try {
    particles = makeParticleSet(Number(ui.count.value), ui.preset.value);
    const cameraPosition = [9, 7, 11];
    controller = await mount(ui.viewport, {
      plotter:spinParticlePlotter,
      data:{
        particles,
        ...currentSettings(),
        onFrame:(elapsed, count) => updateReadouts(elapsed, count),
      },
      configuration:{ backgroundColor:0x202832 },
      renderer:{ antialias:true, maxPixelRatio:1.5, powerPreference:"high-performance", toneMapping:"ACESFilmicToneMapping", toneMappingExposure:1.08 },
      camera:{ type:"perspective", modes:["perspective", "orthographic"], position:cameraPosition, target:[0,0,0], fov:42, orthographicHeight:12 },
      controls:{ enabled:true, enableDamping:true, dampingFactor:0.065, minDistance:5, maxDistance:32 },
      callbacks:{
        onError:error => setError(error.message),
        onLayerError:(layer, error) => setError(`${layer} field layer: ${error.message}`),
        onSelection:renderSelection,
      },
    });
    ui.loading.hidden = true;
    updateReadouts(0, particles.length);
    setRunning(false);
  } catch (error) {
    ui.loading.hidden = true;
    setError(error.message);
  }
}

ui.play.addEventListener("click", () => setRunning(!running));
ui.step.addEventListener("click", async () => {
  if (!controller || running) return;
  try { await controller.update({ step:0.02 }); setError(""); }
  catch (error) { setError(error.message); }
});
ui.reset.addEventListener("click", resetSystem);
ui.count.addEventListener("input", () => { updateReadouts(0, Number(ui.count.value)); });
ui.count.addEventListener("change", resetSystem);
ui.preset.addEventListener("change", resetSystem);
ui.softening.addEventListener("input", () => {
  ui.softeningValue.textContent = `${Number(ui.softening.value).toFixed(3)} Å`;
  controller?.update(currentSettings()).catch(error => setError(error.message));
});
ui.speed.addEventListener("input", () => {
  ui.speedValue.textContent = `${Number(ui.speed.value).toFixed(2)}×`;
  controller?.update(currentSettings()).catch(error => setError(error.message));
});
for (const checkbox of [ui.fieldVectors, ui.fieldConeIso, ui.fieldWireframe, ui.fieldVectorElectric, ui.fieldVectorMagnetic, ui.fieldSurfaceElectric, ui.fieldSurfaceMagnetic]) {
  checkbox.addEventListener("change", () => controller?.update(currentSettings()).catch(error => setError(error.message)));
}
ui.fieldIsosurfaces.addEventListener("change", () => {
  if (!ui.fieldIsosurfaces.checked) ui.fieldConeIso.checked = false;
  controller?.update(currentSettings()).catch(error => setError(error.message));
});
ui.fieldMultiple.addEventListener("change", () => {
  if (ui.fieldMultiple.checked) ui.fieldSolid.checked = false;
  controller?.update(currentSettings()).catch(error => setError(error.message));
});
ui.fieldSolid.addEventListener("change", () => {
  if (ui.fieldSolid.checked) ui.fieldMultiple.checked = false;
  controller?.update(currentSettings()).catch(error => setError(error.message));
});
ui.fieldSurfaceCount.addEventListener("input", () => {
  ui.fieldSurfaceCountValue.textContent = ui.fieldSurfaceCount.value;
  controller?.update(currentSettings()).catch(error => setError(error.message));
});
ui.fieldVectorScale.addEventListener("input", () => {
  ui.fieldVectorScaleValue.textContent = `${Number(ui.fieldVectorScale.value).toFixed(1)}×`;
  controller?.update(currentSettings()).catch(error => setError(error.message));
});
ui.fieldConeIsoSize.addEventListener("input", () => {
  ui.fieldConeIsoSizeValue.textContent = `${Number(ui.fieldConeIsoSize.value).toFixed(1)}×`;
  controller?.update(currentSettings()).catch(error => setError(error.message));
});
ui.fieldResolution.addEventListener("input", () => {
  ui.fieldResolutionValue.textContent = `${ui.fieldResolution.value}³`;
  controller?.update(currentSettings()).catch(error => setError(error.message));
});
ui.fieldThreshold.addEventListener("input", () => {
  ui.fieldThresholdValue.textContent = Number(ui.fieldThreshold.value).toFixed(2);
  controller?.update(currentSettings()).catch(error => setError(error.message));
});
ui.fieldTubeRadius.addEventListener("input", () => {
  ui.fieldTubeRadiusValue.textContent = Number(ui.fieldTubeRadius.value).toFixed(3);
  controller?.update(currentSettings()).catch(error => setError(error.message));
});

$("#reset-view").addEventListener("click", () => controller?.resetView());
$("#fullscreen-toggle").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement === $("#stage")) await document.exitFullscreen();
    else await $("#stage").requestFullscreen();
  }
  catch { setError("Fullscreen is unavailable in this browser."); }
});
document.addEventListener("fullscreenchange", () => {
  const fullscreen = document.fullscreenElement === $("#stage");
  $("#stage").classList.toggle("science-stage-fullscreen", fullscreen);
  $("#fullscreen-toggle").textContent = fullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN";
  $("#fullscreen-toggle").setAttribute("aria-pressed", String(fullscreen));
});

start();
