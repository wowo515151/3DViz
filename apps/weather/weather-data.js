const first = (...values) => values.find(value => value !== undefined && value !== null && value !== "");
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];

function at(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function numeric(...values) {
  for (const value of values) {
    const candidate = typeof value === "object" && value !== null ? first(value.value?.en, value.value, value.calculated?.en, value.calculated, value.en) : value;
    if (candidate === null || candidate === undefined || candidate === "") continue;
    const number = Number(String(candidate).replace(/,/g, ""));
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function text(...values) {
  const value = first(...values);
  if (value === undefined) return "";
  if (typeof value === "object") return String(first(value.en, value.value?.en, value.value, value.text?.en, ""));
  return String(value);
}

function getMetric(record, paths) { return numeric(...paths.map(path => at(record, path))); }

function paletteColor(index) {
  const hue = index * 45;
  const chroma = 0.78 * 0.72;
  const segment = hue / 60;
  const x = chroma * (1 - Math.abs(segment % 2 - 1));
  const rgb = segment < 1 ? [chroma, x, 0] : segment < 2 ? [x, chroma, 0] : segment < 3 ? [0, chroma, x] : segment < 4 ? [0, x, chroma] : segment < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const offset = 0.58 - chroma / 2;
  const channels = rgb.map(value => Math.round((value + offset) * 255));
  const color = (channels[0] << 16) | (channels[1] << 8) | channels[2];
  return { color, hue: `#${color.toString(16).padStart(6, "0")}` };
}

export const metricCatalog = Object.freeze({
  temperature: { label: "Temperature", short: "Temp", unit: "°C", ...paletteColor(0) },
  humidex: { label: "Humidex", short: "Humidex", unit: "", ...paletteColor(1) },
  humidity: { label: "Relative humidity", short: "Humidity", unit: "%", ...paletteColor(2) },
  precipitation: { label: "Precipitation chance", short: "Precip. chance", unit: "%", ...paletteColor(3) },
  wind: { label: "Wind speed", short: "Wind", unit: "km/h", ...paletteColor(4) },
  gust: { label: "Wind gust", short: "Gust", unit: "km/h", ...paletteColor(5) },
  uv: { label: "UV index", short: "UV", unit: "", ...paletteColor(6) },
  windChill: { label: "Wind chill", short: "Wind chill", unit: "°C", ...paletteColor(7) },
});

const hourlyFields = [
  ["temperature", ["temperature.value.en", "temperature.value", "temperature"]],
  ["humidex", ["humidex.value.en", "humidex.value", "humidex.calculated.en", "humidex"]],
  ["precipitation", ["lop.value.en", "lop.value", "lop"]],
  ["wind", ["wind.speed.value.en", "wind.speed.value", "wind.speed"]],
  ["gust", ["wind.gust.value.en", "wind.gust.value", "wind.gust"]],
  ["uv", ["uv.index.value.en", "uv.index.value", "uv.index"]],
  ["windChill", ["windChill.value.en", "windChill.value", "windchill.value.en", "windchill.value"]],
];

const periodFields = [
  ["temperature", ["temperatures.temp_high.value.en", "temperatures.temp_high", "temperatures.temperature.value.en", "temperatures.temperature.value", "temperature.value.en", "temperature"]],
  ["humidity", ["relativeHumidity.value.en", "relativeHumidity.value", "relativeHumidity", "relative_humidity.value.en"]],
  ["humidex", ["humidex.calculated.en", "humidex.value.en", "humidex.calculated", "humidex.value"]],
  ["wind", ["winds.periods.speed.value.en", "winds.periods.speed.value", "wind.speed.value.en", "wind.speed.value"]],
  ["gust", ["winds.periods.gust.value.en", "winds.periods.gust.value", "wind.gust.value.en", "wind.gust.value"]],
  ["uv", ["uv.index.value.en", "uv.index.value", "uv.index"]],
];

function metricValues(record, definitions) {
  const metrics = {};
  for (const [key, paths] of definitions) {
    let value = getMetric(record, paths);
    if (value === null && (key === "wind" || key === "gust")) {
      const parts = arr(at(record, "winds.periods"));
      value = numeric(...parts.map(part => key === "wind" ? first(at(part, "speed.value.en"), at(part, "speed.value"), part.speed) : first(at(part, "gust.value.en"), at(part, "gust.value"), part.gust)));
    }
    if (value !== null) metrics[key] = value;
  }
  return metrics;
}

export function normalizeFeature(feature) {
  const properties = feature?.properties ?? {};
  const hourly = arr(first(at(properties, "hourlyForecastGroup.hourlyForecasts"), properties.hourlyForecasts));
  const forecastPeriods = arr(first(at(properties, "forecastGroup.forecasts"), properties.forecasts));
  const current = properties.currentConditions ?? {};
  const currentMetrics = {
    temperature: getMetric(current, ["temperature.value.en", "temperature.value", "temperature"]),
    humidity: getMetric(current, ["relativeHumidity.value.en", "relativeHumidity.value", "relativeHumidity"]),
    dewpoint: getMetric(current, ["dewpoint.value.en", "dewpoint.value", "dewpoint"]),
    wind: getMetric(current, ["wind.speed.value.en", "wind.speed.value", "wind.speed"]),
    gust: getMetric(current, ["wind.gust.value.en", "wind.gust.value", "wind.gust"]),
    pressure: getMetric(current, ["pressure.value.en", "pressure.value", "pressure"]),
    windChill: getMetric(current, ["windChill.value.en", "windChill.value", "windchill.value.en"]),
  };
  const hourlyRows = hourly.map((record, index) => {
    const timestamp = text(record.timestamp, record.dateTime, record.period?.value?.en, record.period);
    return {
      id: `hour-${index}`,
      label: timestamp || `Hour ${index + 1}`,
      timestamp,
      description: text(record.condition?.value?.en, record.condition, record.textSummary?.en, record.textSummary),
      metrics: metricValues(record, hourlyFields),
      raw: record,
    };
  }).filter(row => Object.keys(row.metrics).length > 0);

  const periodRows = forecastPeriods.map((record, index) => {
    const period = text(record.period?.value?.en, record.period, record.textForecastName?.en, record.textForecastName, record.name?.en);
    const temperature = metricValues(record, periodFields);
    const high = numeric(at(record, "temperatures.temp_high.value.en"), at(record, "temperatures.temp_high"), at(record, "temperature.high.value.en"), at(record, "temperature.high"));
    const low = numeric(at(record, "temperatures.temp_low.value.en"), at(record, "temperatures.temp_low"), at(record, "temperature.low.value.en"), at(record, "temperature.low"));
    let classifiedHigh = high; let classifiedLow = low;
    const temperatureItems = arr(record.temperatures?.temperature ?? record.temperatures);
    for (const item of temperatureItems) {
      const kind = text(item.class?.value?.en, item.class?.en, item.class, item.type?.en, item.type).toLowerCase();
      const value = numeric(item.temperature, item.value, item);
      if (kind.includes("high")) classifiedHigh ??= value;
      if (kind.includes("low")) classifiedLow ??= value;
    }
    if (classifiedHigh !== null) temperature.high = classifiedHigh;
    if (classifiedLow !== null) temperature.low = classifiedLow;
    const metrics = { ...temperature };
    if (Number.isFinite(metrics.high) || Number.isFinite(metrics.low)) delete metrics.temperature;
    if (metrics.temperature !== undefined && (period.toLowerCase().includes("night") || period.toLowerCase().includes("overnight"))) {
      metrics.low = metrics.temperature;
      delete metrics.temperature;
    }
    return {
      id: `period-${index}`,
      label: period || `Period ${index + 1}`,
      timestamp: "",
      description: text(record.textSummary?.en, record.textSummary, record.text?.en, record.text),
      metrics,
      raw: record,
    };
  }).filter(row => Object.keys(row.metrics).length > 0);

  return {
    id: feature.id,
    city: text(properties.name?.en, properties.name, properties.city?.en, properties.city, "Canadian location"),
    region: text(properties.region?.en, properties.province?.en, properties.region, properties.province),
    updated: text(properties.dateTime ?? properties.lastUpdated, current.dateTime ?? current.timestamp),
    currentLabel: text(current.condition?.value?.en, current.condition, current.iconCode),
    currentMetrics,
    hourlyRows,
    periodRows,
    properties,
  };
}

export function makeSignalRecords(rows, keys) {
  return rows.flatMap((row, index) => keys.flatMap((key, lane) => {
    const value = row.metrics[key];
    if (!Number.isFinite(value)) return [];
    return [{ id: `${row.id}-${key}`, rowIndex: index, lane, key, value, label: row.label, timestamp: row.timestamp, description: row.description }];
  }));
}

export function makeTemperatureBars(rows) {
  return rows.flatMap((row, index) => ["high", "low"].flatMap(key => {
    const value = row.metrics[key];
    if (!Number.isFinite(value)) return [];
    const kind = key === "high" ? "High" : "Low";
    return [{ id: `${row.id}-${key}`, label: `${row.label} · ${kind} temperature`, categoryX: row.label || String(index + 1), categoryZ: kind, value, row, kind: key }];
  }));
}

export function formatValue(value, key) {
  const definition = metricCatalog[key];
  if (!Number.isFinite(value)) return "—";
  return `${String(value)}${definition?.unit ? ` ${definition.unit}` : ""}`;
}

export function metricDefinition(key) {
  if (key === "high" || key === "low") return { ...metricCatalog.temperature, label: `Temperature ${key}`, short: key === "high" ? "High" : "Low" };
  return metricCatalog[key] ?? { label: key, short: key, unit: "", color: 0xb5c5d8, hue: "#b5c5d8" };
}
