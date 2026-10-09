import { mount, generateRainbowColors } from "../../library/three-viz/src/index.js?v=city-rainbow-20261009";
import { canadianCities } from "./canadian-cities.js?v=canada-hourly-20261009f";
import { cityTemperatureAdapter } from "./city-temperature-adapter.js?v=canada-hourly-20261009f";

const API = "https://api.weather.gc.ca/collections/citypageweather-realtime/items";
const $ = selector => document.querySelector(selector);
const ui = {
  viewport:$("#viewport"), loading:$("#loading"), source:$("#source-note"), error:$("#weather-error"), dataSize:$("#data-size"),
  units:$("#units-select"), horizon:$("#horizon-select"), sort:$("#sort-select"), cityCount:$("#city-count"), pointCount:$("#point-count"),
  cityFilter:$("#city-filter"), cityList:$("#city-list"), coverage:$("#coverage-note"), status:$("#status-text"), heading:$("#stage-heading"),
  subheading:$("#stage-subheading"), legend:$("#stage-legend"), selection:$("#selection-readout"), camera:$("#camera-mode"), reset:$("#reset-view"),
  play:$("#play-toggle"), slider:$("#time-slider"), timeValue:$("#time-value"), screenshot:$("#screenshot-download"), fullscreen:$("#fullscreen-toggle"),
};
const forecasts = new Map();
const longitudes = new Map();
const defaultCityIds = ["bc-74", "ab-52", "ab-50", "mb-38", "on-143", "on-118", "qc-147", "qc-133", "ns-19", "nl-24"];
const selected = new Set(defaultCityIds);
let controller;
let commonTimes = [];
let ready = false;
let renderRevision = 0;

function showError(message = "") { ui.error.hidden = !message; ui.error.textContent = message; }
function numericTemperature(value) {
  const candidate = value?.value?.en ?? value?.value ?? value?.en ?? value;
  const parsed = Number(String(candidate ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
function recordsFrom(feature) {
  const properties = feature?.properties ?? {};
  const raw = properties.hourlyForecastGroup?.hourlyForecasts ?? properties.hourlyForecasts ?? [];
  const rows = (Array.isArray(raw) ? raw : [raw]).map(row => ({
    timestamp:String(row.timestamp ?? row.dateTime ?? ""),
    value:numericTemperature(row.temperature),
  })).filter(row => row.timestamp && row.value !== null);
  return rows;
}
async function fetchCity(city) {
  const params = new URLSearchParams({ f:"json", q:city.query, limit:"10", lang:"en" });
  const response = await fetch(`${API}?${params}`, { headers:{ Accept:"application/geo+json, application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const feature = (data.features ?? []).find(item => String(item.id).toLowerCase() === city.id.toLowerCase());
  if (!feature) throw new Error("City forecast was not in ECCC search results");
  const longitude = feature.geometry?.coordinates?.[0];
  if (Number.isFinite(longitude)) longitudes.set(city.id, longitude);
  const rows = recordsFrom(feature);
  if (!rows.length) throw new Error("ECCC returned no hourly temperature values");
  forecasts.set(city.id, rows);
  return city;
}
async function loadCities() {
  ready = false; ui.loading.hidden = false; ui.loading.textContent = "LOADING 39 CANADIAN CITY FORECASTS…";
  ui.status.textContent = "LOADING ECCC"; ui.source.textContent = "Loading hourly forecast data from Environment and Climate Change Canada.";
  const failures = [];
  let completed = 0;
  const queue = [...canadianCities];
  const worker = async () => {
    while (queue.length) {
      const city = queue.shift(); if (!city) return;
      try { await fetchCity(city); } catch (error) { failures.push({ city, error }); }
      completed += 1;
      ui.status.textContent = `ECCC ${completed}/${canadianCities.length}`;
    }
  };
  await Promise.all(Array.from({ length:6 }, worker));
  const available = canadianCities.filter(city => forecasts.has(city.id));
  if (!available.length) {
    ui.loading.hidden = true; ui.status.textContent = "DATA REQUEST FAILED";
    showError("Could not load an ECCC city forecast. Check the connection and reload the page.");
    ui.coverage.textContent = failures.slice(0, 3).map(({ city, error }) => `${city.name}: ${error.message}`).join("\n");
    return;
  }
  const timeSets = available.map(city => new Set(forecasts.get(city.id).map(row => row.timestamp)));
  commonTimes = forecasts.get(available[0].id).map(row => row.timestamp).filter(time => timeSets.every(set => set.has(time)));
  if (!commonTimes.length) {
    commonTimes = forecasts.get(available[0].id).map(row => row.timestamp);
  }
  for (const city of canadianCities) if (!forecasts.has(city.id)) selected.delete(city.id);
  ready = true;
  ui.dataSize.textContent = `${available.length}/${canadianCities.length}`;
  ui.source.textContent = `Environment and Climate Change Canada · MSC GeoMet · ${new Date().toLocaleTimeString([], { hour:"numeric", minute:"2-digit" })} browser time`;
  ui.coverage.textContent = failures.length
    ? `${available.length} cities loaded · ${failures.length} unavailable (omitted).`
    : `${available.length} cities loaded · ${commonTimes.length} shared hourly forecast times · timestamps shown in UTC.`;
  ui.subheading.textContent = `${available.length} CITY FORECASTS · UTC HOURS · SHARED TEMPERATURE SCALE`;
  renderCityChoices();
  await renderVisualization();
}
function displayRows(city, count) {
  const byTime = new Map((forecasts.get(city.id) ?? []).map(row => [row.timestamp, row]));
  return commonTimes.slice(0, count).flatMap(timestamp => {
    const row = byTime.get(timestamp);
    if (!row) return [];
    return [{ timestamp, value:ui.units.value === "F" ? row.value * 9 / 5 + 32 : row.value }];
  });
}
function cityTemperatureNow(city) {
  const firstTime = commonTimes[0];
  const row = (forecasts.get(city.id) ?? []).find(item => item.timestamp === firstTime);
  if (!row) return null;
  return ui.units.value === "F" ? row.value * 9 / 5 + 32 : row.value;
}
function visibleCities() {
  const cities = canadianCities.filter(city => selected.has(city.id) && forecasts.has(city.id));
  const order = ui.sort.value;
  return cities.sort((a, b) => {
    if (order === "name") return a.name.localeCompare(b.name, "en");
    if (order === "warmest") return (cityTemperatureNow(b) ?? -Infinity) - (cityTemperatureNow(a) ?? -Infinity);
    if (order === "coldest") return (cityTemperatureNow(a) ?? Infinity) - (cityTemperatureNow(b) ?? Infinity);
    return (longitudes.get(a.id) ?? 0) - (longitudes.get(b.id) ?? 0);
  });
}
function renderCityChoices() {
  const filter = ui.cityFilter.value.trim().toLocaleLowerCase();
  ui.cityList.replaceChildren();
  [...canadianCities].sort((a,b) => (longitudes.get(a.id) ?? 0) - (longitudes.get(b.id) ?? 0)).filter(city => `${city.name} ${city.province}`.toLocaleLowerCase().includes(filter)).forEach(city => {
    const label = document.createElement("label"); label.className = "city-choice";
    const input = document.createElement("input"); input.type = "checkbox"; input.checked = selected.has(city.id); input.disabled = !forecasts.has(city.id); input.dataset.city = city.id;
    const name = document.createElement("span"); name.textContent = `${city.name}, ${city.province}`;
    label.append(input, name); ui.cityList.append(label);
  });
}
function formatUtc(value, options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-CA", { timeZone:"UTC", hour:"numeric", minute:"2-digit", ...options }).format(date);
}
function renderLegend(cities) {
  ui.legend.replaceChildren();
  const title = document.createElement("strong"); title.textContent = `Temperature scale · °${ui.units.value}`; ui.legend.append(title);
  const scale = document.createElement("div"); scale.textContent = ui.units.value === "F" ? "−40°F to 104°F · shared across cities" : "−40°C to 40°C · shared across cities"; ui.legend.append(scale);
  cities.forEach(city => {
    const row = document.createElement("div"); row.className = "legend-row";
    const chip = document.createElement("i"); chip.className = "legend-chip"; chip.style.backgroundColor = `#${city.color.toString(16).padStart(6,"0")}`;
    const label = document.createElement("span"); label.textContent = `${city.name}, ${city.province}`;
    row.append(chip, label); ui.legend.append(row);
  });
}
async function renderVisualization() {
  if (!ready) return;
  const revision = ++renderRevision;
  const orderedCities = visibleCities();
  const palette = generateRainbowColors(orderedCities.length, { saturation:0.82, lightness:0.59 });
  const cities = orderedCities.map((city, index) => ({ ...city, color:palette[index], forecasts:displayRows(city, Number(ui.horizon.value)) }));
  const pointCount = cities.reduce((sum, city) => sum + city.forecasts.length, 0);
  ui.cityCount.textContent = String(cities.length); ui.pointCount.textContent = String(pointCount);
  ui.heading.textContent = "CANADIAN HOURLY TEMPERATURES";
  renderLegend(cities);
  controller?.dispose(); controller = undefined; ui.viewport.querySelector("canvas")?.remove();
  ui.play.dataset.playing = "false"; ui.play.textContent = "PLAY HOURS";
  ui.loading.hidden = false; ui.loading.textContent = "BUILDING CANADA TEMPERATURE MAP…";
  if (!cities.length || !pointCount) {
    ui.loading.hidden = true; ui.status.textContent = "SELECT A CITY"; showError("Select at least one city with available forecast data."); return;
  }
  showError("");
  try {
    const targetY = 3.8;
    const laneSpan = Math.max(0.88, (cities.length - 1) * 0.88);
    const hourSpan = Math.max(0.88, (Number(ui.horizon.value) - 1) * 0.88);
    const distance = Math.max(20, Math.hypot(hourSpan * 0.55, 14, laneSpan * 0.72));
    const cameraPosition = [distance * 0.72, targetY + distance * 0.58, distance * 0.85];
    const orthographicHeight = Math.max(18, laneSpan * 1.18);
    const nextController = await mount(ui.viewport, {
      adapter:cityTemperatureAdapter, data:{ cities, timestamps:commonTimes.slice(0, Number(ui.horizon.value)), unit:ui.units.value }, configuration:{ backgroundColor:0x202832 },
      renderer:{ antialias:true, maxPixelRatio:1.5, preserveDrawingBuffer:true, powerPreference:"high-performance", toneMapping:"ACESFilmicToneMapping", toneMappingExposure:1.08 },
      camera:{ type:"perspective", modes:["perspective","orthographic"], position:cameraPosition, target:[0,targetY,0], fov:40, orthographicHeight },
      controls:{ enabled:true, enableDamping:true, dampingFactor:0.065, minDistance:4, maxDistance:140 },
      callbacks:{
        onError:error => { ui.status.textContent="RENDER ERROR"; showError(error.message); },
        onSelection:selection => {
          if (!selection) return;
          ui.selection.textContent = `${selection.label}\n${Object.entries(selection.values ?? {}).map(([key,value]) => `${key}: ${String(value)}`).join(" · ")}`;
        },
        onTime:index => { ui.slider.value=String(index); ui.timeValue.textContent=`${formatUtc(commonTimes[index])} UTC`; },
      },
    });
    if (revision !== renderRevision) { nextController.dispose(); return; }
    controller = nextController;
    ui.camera.disabled = !controller.capabilities.includes("cameraModes");
    ui.slider.min="0"; ui.slider.max=String(Math.max(0, Number(ui.horizon.value)-1)); ui.slider.value="0";
    ui.slider.disabled = Number(ui.horizon.value) < 2;
    ui.timeValue.textContent = `${formatUtc(commonTimes[0])} UTC`;
    controller.setTime(0); ui.camera.value="perspective";
    ui.subheading.textContent=`${cities.length} CITIES · NEXT ${ui.horizon.value} HOURS · SHARED °${ui.units.value} SCALE`;
    ui.status.textContent="ECCC · READY"; ui.loading.hidden=true;
    ui.selection.textContent="Select a colored city marker to inspect its forecast temperature and UTC time.";
  } catch (error) {
    if (revision !== renderRevision) return;
    controller?.dispose(); controller=undefined; ui.viewport.querySelector("canvas")?.remove();
    ui.status.textContent="RENDER FAILED"; showError(error.message); ui.loading.hidden=true;
  }
}
function exportFrame() {
  const source=ui.viewport.querySelector("canvas");
  if (!source) throw new Error("Wait for the forecast scene to finish rendering first.");
  const canvas=document.createElement("canvas"); canvas.width=Math.max(1280,source.width); canvas.height=Math.round(canvas.width*source.height/source.width);
  const ctx=canvas.getContext("2d"); ctx.fillStyle="#202832"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(source,0,0,canvas.width,canvas.height);
  const scale=canvas.width/source.width; ctx.fillStyle="rgba(8,13,19,.78)"; ctx.fillRect(22*scale,20*scale,460*scale,47*scale);
  ctx.fillStyle="#e8edf4"; ctx.font=`600 ${Math.max(12,Math.round(15*scale))}px system-ui`; ctx.fillText(`Canada hourly temperatures · ${ui.cityCount.textContent} cities`,36*scale,44*scale);
  ctx.fillStyle="#9eb2c5"; ctx.font=`${Math.max(10,Math.round(11*scale))}px ui-monospace,monospace`; ctx.fillText(`Shared °${ui.units.value} scale · Environment and Climate Change Canada`,36*scale,60*scale);
  return canvas;
}
function downloadBlob(blob, filename) { const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=filename; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),3000); }

ui.cityFilter.addEventListener("input", renderCityChoices);
ui.cityList.addEventListener("change", event => {
  const id=event.target?.dataset?.city; if (!id) return;
  event.target.checked ? selected.add(id) : selected.delete(id);
  renderVisualization();
});
$("#select-all").addEventListener("click", () => { canadianCities.forEach(city => { if (forecasts.has(city.id)) selected.add(city.id); }); renderCityChoices(); renderVisualization(); });
$("#select-none").addEventListener("click", () => { selected.clear(); renderCityChoices(); renderVisualization(); });
ui.units.addEventListener("change", renderVisualization); ui.horizon.addEventListener("change", renderVisualization); ui.sort.addEventListener("change", renderVisualization);
ui.camera.addEventListener("change", () => { try { controller?.setCameraMode(ui.camera.value); } catch (error) { showError(error.message); } });
ui.reset.addEventListener("click", () => controller?.resetView());
ui.slider.addEventListener("input", () => {
  const index=Number(ui.slider.value); ui.timeValue.textContent=`${formatUtc(commonTimes[index])} UTC`; controller?.setTime(index);
});
ui.play.addEventListener("click", () => {
  if (!controller) return;
  if (ui.play.dataset.playing === "true") { controller.pause(); ui.play.dataset.playing="false"; ui.play.textContent="PLAY HOURS"; }
  else { controller.setTime(0); ui.slider.value="0"; ui.play.dataset.playing="true"; ui.play.textContent="PAUSE HOURS"; controller.play(); }
});
ui.screenshot.addEventListener("click", () => {
  try { exportFrame().toBlob(blob => { if (!blob) { showError("Chrome could not encode the screenshot."); return; } downloadBlob(blob,"canada-hourly-temperatures.png"); ui.status.textContent="PNG READY"; },"image/png"); }
  catch (error) { showError(error.message); }
});
ui.fullscreen.addEventListener("click", async () => { if (!document.fullscreenElement) await $(".stage").requestFullscreen(); else await document.exitFullscreen(); });
document.addEventListener("fullscreenchange", () => { const active=Boolean(document.fullscreenElement); ui.fullscreen.setAttribute("aria-pressed",String(active)); ui.fullscreen.textContent=active?"EXIT FULLSCREEN":"FULLSCREEN"; });

loadCities();
