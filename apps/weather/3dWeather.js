import { mount, barChartAdapter } from "../../library/three-viz/src/index.js";
import { normalizeFeature, metricDefinition, makeSignalRecords, makeTemperatureBars, formatValue } from "./weather-data.js?v=weather-data-20261009";
import { weatherSignalAdapter } from "./weather-adapter.js?v=weather-data-20261009";

const API = "https://api.weather.gc.ca/collections/citypageweather-realtime/items";
const $ = selector => document.querySelector(selector);
const ui = {
  viewport: $("#viewport"), loading: $("#loading"), search: $("#location-search"), searchButton: $("#search-button"), location: $("#location-select"),
  source: $("#source-note"), error: $("#weather-error"), dataSize: $("#data-size"), mode: $("#mode-select"), activeMode: $("#active-mode"), mapping: $("#mapping-note"),
  rowCount: $("#row-count"), fieldCount: $("#field-count"), current: $("#current-conditions"), currentTime: $("#current-time"), table: $("#forecast-table"),
  status: $("#status-text"), heading: $("#stage-heading"), subheading: $("#stage-subheading"), legend: $("#stage-legend"), selection: $("#selection-readout"),
  camera: $("#camera-mode"), reset: $("#reset-view"), play: $("#play-toggle"), time: $("#time-control"), slider: $("#time-slider"), timeValue: $("#time-value"),
  screenshot: $("#screenshot-download"), video: $("#video-download"), videoDuration: $("#video-duration"), fullscreen: $("#fullscreen-toggle"),
};

let locations = [];
let current = null;
let controller;
let searchAbort;
let searchTimer;
let videoCancelled = false;
let activeRecorder;

function showError(message = "") { ui.error.hidden = !message; ui.error.textContent = message; }
function asArray(value) { return value == null ? [] : Array.isArray(value) ? value : [value]; }
function displayLocation(location) { return [location.city, location.region].filter(Boolean).join(", "); }
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

async function searchLocations(query) {
  searchAbort?.abort();
  const abort = new AbortController(); searchAbort = abort;
  if (query.trim().length < 2) { showError("Enter at least two letters to search ECCC locations."); return; }
  locations = []; ui.location.replaceChildren(); ui.location.hidden = true;
  ui.status.textContent = "SEARCHING ECCC"; ui.searchButton.disabled = true; showError("");
  const params = new URLSearchParams({ f: "json", q: `*${query.trim()}*`, limit: "20", lang: "en" });
  try {
    const response = await fetch(`${API}?${params}`, { signal: abort.signal, headers: { Accept: "application/geo+json, application/json" } });
    if (!response.ok) throw new Error(`ECCC returned HTTP ${response.status}.`);
    const data = await response.json();
    locations = asArray(data.features).map(normalizeFeature).filter(item => item.id !== undefined);
    const normalizedQuery = query.trim().toLocaleLowerCase();
    locations.sort((a, b) => Number(!a.city.toLocaleLowerCase().startsWith(normalizedQuery)) - Number(!b.city.toLocaleLowerCase().startsWith(normalizedQuery)) || a.city.localeCompare(b.city));
    ui.location.replaceChildren();
    locations.forEach((location, index) => {
      const option = document.createElement("option"); option.value = String(index); option.textContent = displayLocation(location); ui.location.append(option);
    });
    ui.location.hidden = locations.length < 2;
    if (!locations.length) throw new Error("No matching locations were returned. Try a larger nearby city or a different spelling.");
    ui.status.textContent = `${locations.length} LOCATION${locations.length === 1 ? "" : "S"} FOUND`;
    ui.source.textContent = `${locations.length} ECCC location${locations.length === 1 ? "" : "s"} found. Select a result to load its current conditions and forecast.`;
    if (locations.length === 1) await loadLocation(0);
    else {
      ui.location.value = "0";
      showError("Select a matching location from the list.");
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    ui.status.textContent = "DATA REQUEST FAILED";
    showError(`${error.message} Check the network connection and ECCC API availability, then search again.`);
    ui.source.textContent = "Source: ECCC MSC GeoMet City Page Weather API (experimental collection).";
  } finally { if (searchAbort === abort) ui.searchButton.disabled = false; }
}

function addCard(parent, label, value) {
  const card = document.createElement("div"); card.className = "condition-card";
  const name = document.createElement("span"); name.textContent = label;
  const reading = document.createElement("strong"); reading.textContent = value;
  card.append(name, reading); parent.append(card);
}

function renderCurrentConditions() {
  ui.current.replaceChildren();
  const fields = [
    ["Temperature", current.currentMetrics.temperature, "°C"], ["Humidity", current.currentMetrics.humidity, "%"],
    ["Dew point", current.currentMetrics.dewpoint, "°C"], ["Wind", current.currentMetrics.wind, "km/h"],
    ["Wind gust", current.currentMetrics.gust, "km/h"], ["Pressure", current.currentMetrics.pressure, "kPa"],
  ].filter(([, value]) => Number.isFinite(value));
  if (!fields.length) { const note = document.createElement("p"); note.className = "field-note"; note.textContent = "ECCC did not return current-condition measurements for this location."; ui.current.append(note); }
  else fields.forEach(([label, value, unit]) => addCard(ui.current, label, `${Number(value.toFixed(1))} ${unit}`));
  ui.currentTime.textContent = current.updated ? formatDate(current.updated) : current.currentLabel || "LIVE";
}

function renderTable() {
  const table = document.createElement("table");
  const thead = document.createElement("thead"); const header = document.createElement("tr");
  const isHourly = ui.mode.value === "hourly";
  const columns = isHourly
    ? [["temperature", "Temperature"], ["humidex", "Humidex"], ["humidity", "Humidity"], ["precipitation", "Precip. chance"], ["wind", "Wind"], ["gust", "Gust"], ["uv", "UV"], ["windChill", "Wind chill"]]
    : [["temperature", "Temperature high / low"], ["humidity", "Humidity"], ["humidex", "Humidex"], ["wind", "Wind"], ["gust", "Gust"], ["uv", "UV"]];
  ["Forecast interval", ...columns.map(([, label]) => label)].forEach(label => { const th = document.createElement("th"); th.textContent = label; header.append(th); });
  thead.append(header); const tbody = document.createElement("tbody");
  const rows = isHourly ? current.hourlyRows : current.periodRows;
  rows.slice(0, 72).forEach(row => {
    const tr = document.createElement("tr"); const label = document.createElement("td"); label.textContent = row.label; tr.append(label);
    columns.forEach(([key], columnIndex) => {
      const td = document.createElement("td");
      if (key === "temperature" && (Number.isFinite(row.metrics.high) || Number.isFinite(row.metrics.low))) {
        const high = Number.isFinite(row.metrics.high) ? `High ${formatValue(row.metrics.high, "temperature")}` : "";
        const low = Number.isFinite(row.metrics.low) ? `Low ${formatValue(row.metrics.low, "temperature")}` : "";
        td.textContent = [high, low].filter(Boolean).join(" / ");
      } else td.textContent = key in row.metrics ? formatValue(row.metrics[key], key) : "—";
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(thead, tbody); ui.table.replaceChildren(table);
}

function rowsForMode() { return ui.mode.value === "hourly" ? current.hourlyRows : current.periodRows; }
function keysForRows(rows) {
  const wanted = ui.mode.value === "periods" ? ["temperature", "high", "low", "humidity", "humidex", "wind", "gust", "uv"] : ["temperature", "humidex", "precipitation", "wind", "gust", "uv", "windChill"];
  return wanted.filter(key => rows.some(row => Number.isFinite(row.metrics[key])));
}

function legendMarkup(keys, mode) {
  const title = document.createElement("strong"); title.textContent = mode === "bars" ? "Daily temperature · °C" : "Weather variables · native units";
  ui.legend.replaceChildren(title);
  if (mode === "bars") {
    for (const key of ["high", "low"]) {
      const definition = metricDefinition(key);
      const row = document.createElement("div"); row.className = "legend-row"; const chip = document.createElement("i"); chip.className = "legend-chip"; chip.style.background = definition.hue;
      const span = document.createElement("span"); span.textContent = `${definition.short} · °C`; row.append(chip, span); ui.legend.append(row);
    }
    return;
  }
  keys.forEach(key => {
    const row = document.createElement("div"); row.className = "legend-row"; const chip = document.createElement("i"); chip.className = "legend-chip"; chip.style.background = metricDefinition(key).hue;
    const span = document.createElement("span"); span.textContent = `${metricDefinition(key).short} · ${metricDefinition(key).unit || "index"}`; row.append(chip, span); ui.legend.append(row);
  });
  const note = document.createElement("div"); note.textContent = "Y uses separate normalized scales. Read exact units in the panel."; note.style.marginTop = "5px"; note.style.color = "#8799aa"; ui.legend.append(note);
}

async function renderVisualization() {
  if (!current) return;
  const mode = ui.mode.value;
  const rows = rowsForMode();
  if (!rows.length) {
    controller?.dispose(); controller = undefined; ui.viewport.querySelector("canvas")?.remove();
    ui.loading.hidden = true;
    showError(`ECCC returned no ${mode === "periods" ? "day/night forecast periods" : "hourly forecast values"} for this location.`);
    ui.status.textContent = "NO FORECAST DATA"; return;
  }
  showError(""); ui.loading.hidden = false; ui.loading.textContent = "BUILDING 3D FORECAST…";
  controller?.dispose(); controller = undefined;
  ui.play.dataset.playing = "false";
  ui.play.textContent = "PLAY FORECAST";
  const keys = keysForRows(rows);
  const data = mode === "bars" ? makeTemperatureBars(current.periodRows) : makeSignalRecords(rows, keys);
  if (!data.length) { ui.loading.hidden = true; ui.status.textContent = "NO NUMERIC FORECAST DATA"; showError("ECCC returned forecast records, but no numeric high or low temperatures for this visualization."); return; }
  const adapter = mode === "bars" ? barChartAdapter : weatherSignalAdapter;
  const config = mode === "bars" ? { barChart: { color: metricDefinition("temperature").color, material: { type: "standard", metalness: 0.12, roughness: 0.3 } } } : { weather: { mode, keys } };
  const barMinimum = mode === "bars" ? Math.min(0, ...data.map(record => record.value)) : 0;
  const barMaximum = mode === "bars" ? Math.max(0, ...data.map(record => record.value)) : 0;
  const barSpan = Math.max(1, barMaximum - barMinimum);
  const cameraTargetY = mode === "bars" ? (barMinimum + barMaximum) / 2 : 1.7;
  const cameraDistance = mode === "bars" ? Math.max(18, barSpan * 1.9) : 0;
  const cameraPosition = mode === "bars" ? [cameraDistance * 0.55, cameraTargetY + cameraDistance * 0.35, cameraDistance * 0.75] : [8.5, 7.5, 10.5];
  const orthographicHeight = mode === "bars" ? Math.max(14, barSpan * 1.5) : 12;
  try {
    controller = await mount(ui.viewport, {
      adapter, data: mode === "bars" ? data : { rows, keys, records: data }, configuration: { ...config, backgroundColor: 0x202832 },
      renderer: { antialias: true, maxPixelRatio: 1.5, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMapping: "ACESFilmicToneMapping", toneMappingExposure: 1.1 },
      camera: { type: "perspective", modes: ["perspective", "orthographic"], position: cameraPosition, target: [0, cameraTargetY, 0], fov: 42, orthographicHeight },
      controls: { enabled: true, enableDamping: true, dampingFactor: 0.065, minDistance: 2.4, maxDistance: 90 },
      callbacks: {
        onError: error => { ui.status.textContent = "RENDER ERROR"; showError(error.message); },
        onSelection: selection => {
          const bar = mode === "bars" ? data.find(record => record.id === selection?.id) : undefined;
          showSelection(bar ? {
            label: bar.label,
            values: { forecast: bar.categoryX, temperature: `${String(bar.value)} °C`, kind: `${bar.categoryZ} temperature` },
          } : selection);
        },
        onTime: index => { if (ui.mode.value !== "bars") { ui.slider.value = String(index); ui.timeValue.textContent = rows[index]?.label || String(index + 1); } },
      },
    });
    ui.camera.disabled = !controller.capabilities.includes("cameraModes");
    ui.time.hidden = !controller.capabilities.includes("time"); ui.play.hidden = !controller.capabilities.includes("animation");
    ui.play.textContent = "PLAY FORECAST";
    if (controller.capabilities.includes("time")) {
      ui.slider.min = "0"; ui.slider.max = String(Math.max(0, rows.length - 1)); ui.slider.value = "0"; ui.slider.disabled = rows.length < 2;
      ui.timeValue.textContent = rows[0].label || "0"; controller.setTime(0);
    }
    ui.heading.textContent = `${current.city.toLocaleUpperCase()} WEATHER FORECAST`;
    ui.subheading.textContent = `${displayLocation(current)} · ${mode === "bars" ? "DAILY TEMPERATURE" : mode === "periods" ? "DAY AND NIGHT FORECASTS" : "HOURLY FORECAST SIGNALS"}`;
    ui.activeMode.textContent = mode === "bars" ? "TEMP BARS" : mode === "periods" ? "DAY / NIGHT" : "HOURLY SIGNALS";
    ui.mapping.textContent = mode === "bars" ? "X = forecast period · Y = temperature (°C) · Z = high or low." : "X = ordered forecast interval · Y = normalized signal value · Z = weather variable lane.";
    ui.rowCount.textContent = String(rows.length); ui.fieldCount.textContent = String(keys.length);
    legendMarkup(keys, mode);
    ui.status.textContent = "ECCC · READY";
    ui.loading.hidden = true;
    ui.camera.value = "perspective";
    ui.selection.textContent = "Select a colored forecast marker or temperature bar to inspect its source value.";
  } catch (error) {
    controller?.dispose(); controller = undefined; ui.viewport.querySelector("canvas")?.remove(); ui.status.textContent = "RENDER FAILED"; showError(error.message); ui.loading.hidden = true;
  }
}

function showSelection(selection) {
  if (!selection) return;
  ui.selection.textContent = `${selection.label ?? selection.id}\n${Object.entries(selection.values ?? {}).map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`).join(" · ")}`;
}

async function loadLocation(index) {
  const location = locations[index]; if (!location) return;
  current = location; ui.location.value = String(index); ui.loading.hidden = false; ui.loading.textContent = "LOADING ECCC FORECAST…";
  ui.source.textContent = `Source: Environment and Climate Change Canada · MSC GeoMet. City Page Weather collection (experimental).`;
  ui.dataSize.textContent = location.id || "ECCC";
  renderCurrentConditions(); renderTable(); await renderVisualization();
}

function stageCanvas() { return ui.viewport.querySelector("canvas"); }
function exportFrame(angle = null, outputCanvas = null) {
  const source = stageCanvas();
  if (!source || !current) throw new Error("Load a location and wait for its 3D forecast to finish rendering first.");
  if (angle !== null) controller?.setOrbitAngle(angle);
  const width = Math.max(1280, source.width); const height = Math.round(width * source.height / source.width);
  const canvas = outputCanvas ?? document.createElement("canvas");
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#202832"; ctx.fillRect(0, 0, width, height); ctx.drawImage(source, 0, 0, width, height);
  const scale = width / source.width; const font = Math.max(12, Math.round(12 * scale));
  ctx.fillStyle = "rgba(8,13,19,.78)"; ctx.fillRect(22 * scale, 20 * scale, Math.min(width - 44 * scale, 490 * scale), (52 + Math.min(8, Object.keys(current.currentMetrics).filter(key => Number.isFinite(current.currentMetrics[key])).length) * 17) * scale);
  ctx.fillStyle = "#e8edf4"; ctx.font = `600 ${font}px system-ui`; ctx.fillText(`${displayLocation(current)} · ${ui.activeMode.textContent}`, 36 * scale, 43 * scale);
  ctx.fillStyle = "#9eb2c5"; ctx.font = `${Math.max(10, Math.round(font * 0.78))}px ui-monospace,monospace`;
  const keys = ui.mode.value === "bars" ? ["high", "low"] : keysForRows(rowsForMode());
  const exportLegend = ui.mode.value === "bars"
    ? [["high", "High temperature · °C"], ["low", "Low temperature · °C"]]
    : keys.map(key => [key, `${metricDefinition(key).short} · ${metricDefinition(key).unit || "index"}`]);
  exportLegend.forEach(([key, label], index) => {
    const x = 36 * scale + (index % 3) * 152 * scale; const y = (65 + Math.floor(index / 3) * 17) * scale;
    ctx.fillStyle = metricDefinition(key).hue; ctx.beginPath(); ctx.arc(x, y - 3 * scale, 3.3 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#b9c8d7"; ctx.fillText(label, x + 8 * scale, y);
  });
  ctx.fillStyle = "rgba(8,13,19,.72)"; ctx.fillRect(22 * scale, height - 43 * scale, Math.min(width - 44 * scale, 690 * scale), 24 * scale);
  ctx.fillStyle = "#9eb2c5"; ctx.font = `${Math.max(9, Math.round(font * 0.7))}px ui-monospace,monospace`;
  ctx.fillText("DATA SOURCE: ENVIRONMENT AND CLIMATE CHANGE CANADA · MSC GeoMet", 34 * scale, height - 27 * scale);
  return canvas;
}

function downloadBlob(blob, filename) { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 3000); }
function safeSlug(value) { return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "weather"; }

ui.searchButton.addEventListener("click", () => searchLocations(ui.search.value));
ui.search.addEventListener("keydown", event => { if (event.key === "Enter") searchLocations(ui.search.value); });
ui.search.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { if (ui.search.value.trim().length >= 3) searchLocations(ui.search.value); }, 650); });
ui.location.addEventListener("change", () => loadLocation(Number(ui.location.value)));
ui.mode.addEventListener("change", () => { renderTable(); renderVisualization(); });
ui.camera.addEventListener("change", () => { try { controller?.setCameraMode(ui.camera.value); } catch (error) { showError(error.message); } });
ui.reset.addEventListener("click", () => controller?.resetView());
ui.slider.addEventListener("input", () => {
  const rows = rowsForMode(); const index = Number(ui.slider.value); ui.timeValue.textContent = rows[index]?.label || String(index + 1);
  controller?.setTime(index);
});
ui.play.addEventListener("click", () => {
  if (!controller) return;
  if (ui.play.dataset.playing === "true") { controller.pause(); ui.play.dataset.playing = "false"; ui.play.textContent = "PLAY FORECAST"; }
  else { ui.slider.value = "0"; ui.play.dataset.playing = "true"; ui.play.textContent = "PAUSE FORECAST"; controller.play(); }
});
ui.screenshot.addEventListener("click", () => {
  try {
    exportFrame().toBlob(blob => {
      if (!blob) { ui.status.textContent = "PNG EXPORT FAILED"; showError("Chrome could not encode the screenshot. Try again after the scene finishes rendering."); return; }
      downloadBlob(blob, `${safeSlug(current.city)}-3dweather.png`); ui.status.textContent = "PNG READY";
    }, "image/png");
  }
  catch (error) { showError(error.message); }
});
ui.video.addEventListener("click", async () => {
  if (activeRecorder?.state === "recording") { videoCancelled = true; ui.status.textContent = "CANCELLING VIDEO…"; return; }
  let stream; let initial; let recorder;
  try {
    initial = controller?.getCameraPose();
    const base = exportFrame(0); stream = base.captureStream(30);
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error("This browser does not support WebM video recording.");
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 }); const chunks = [];
    const duration = Number(ui.videoDuration.value); const start = performance.now();
    videoCancelled = false; ui.video.disabled = false; ui.video.textContent = "CANCEL VIDEO"; ui.status.textContent = "RECORDING 360° ORBIT";
    activeRecorder = recorder;
    const finished = new Promise((resolve, reject) => { recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); }; recorder.onerror = () => reject(recorder.error || new Error("Video capture failed.")); recorder.onstop = resolve; });
    recorder.start(150);
    await new Promise((resolve, reject) => {
      const tick = now => {
        if (videoCancelled || now - start >= duration * 1000) { if (recorder.state !== "inactive") recorder.stop(); resolve(); return; }
        try {
          const fraction = (now - start) / (duration * 1000);
          exportFrame(fraction * Math.PI * 2, base);
          requestAnimationFrame(tick);
        } catch (error) { if (recorder.state !== "inactive") recorder.stop(); reject(error); }
      };
      requestAnimationFrame(tick);
    });
    await finished;
    if (videoCancelled) ui.status.textContent = "CAPTURE CANCELLED";
    else { downloadBlob(new Blob(chunks, { type: mime }), `${safeSlug(current.city)}-3dweather-orbit.webm`); ui.status.textContent = "VIDEO READY"; }
  } catch (error) { showError(error.message); ui.status.textContent = "VIDEO CAPTURE FAILED"; }
  finally {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    if (initial) { try { controller?.setCameraPose(initial); } catch {} }
    activeRecorder = undefined; ui.video.disabled = false; ui.video.textContent = "DOWNLOAD 360° VIDEO"; videoCancelled = false;
  }
});
ui.fullscreen.addEventListener("click", async () => {
  if (!document.fullscreenElement) await $(".stage").requestFullscreen(); else await document.exitFullscreen();
});
document.addEventListener("fullscreenchange", () => {
  const active = Boolean(document.fullscreenElement); ui.fullscreen.setAttribute("aria-pressed", String(active)); ui.fullscreen.textContent = active ? "EXIT FULLSCREEN" : "FULLSCREEN";
});

searchLocations("Edmonton");
