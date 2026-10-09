import { assert } from "../core/errors.js";

const isArrayLike = value => Array.isArray(value) || (ArrayBuffer.isView(value) && !(value instanceof DataView));
const isFiniteNumber = value => typeof value === "number" && Number.isFinite(value);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function requireRecord(value, label) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), "INVALID_RECORD", `${label} must be an object.`);
}

function requireStableId(value, label) {
  assert((typeof value === "string" && value.trim().length > 0) || (typeof value === "number" && Number.isFinite(value)), "INVALID_ID", `${label} must have a non-empty string or finite numeric id.`);
}

function requireFinite(value, label) {
  assert(isFiniteNumber(value), "INVALID_NUMBER", `${label} must be a finite number.`, { value });
}

function requireFloat32(value, label) {
  requireFinite(value, label);
  assert(Number.isFinite(Math.fround(value)), "FLOAT32_RANGE", `${label} is outside the finite Float32 geometry range.`, { value });
}

function requireUniqueIds(items, label) {
  const ids = new Set();
  for (let index = 0; index < items.length; index += 1) {
    const id = items[index]?.id;
    requireStableId(id, `${label}[${index}]`);
    assert(!ids.has(id), "DUPLICATE_ID", `${label} contains duplicate id '${String(id)}'.`, { index, id });
    ids.add(id);
  }
}

export function validatePointRecords(records) {
  assert(Array.isArray(records), "INVALID_POINTS", "Point records must be an array.");
  requireUniqueIds(records, "points");
  for (let index = 0; index < records.length; index += 1) {
    const point = records[index];
    requireRecord(point, `points[${index}]`);
    for (const axis of ["x", "y", "z"]) requireFloat32(point[axis], `points[${index}].${axis}`);
  }
  return records;
}

export function validateOrderedSeries(series) {
  assert(Array.isArray(series), "INVALID_SERIES", "Ordered series must be an array.");
  requireUniqueIds(series, "series");
  for (let s = 0; s < series.length; s += 1) {
    const item = series[s];
    requireRecord(item, `series[${s}]`);
    assert(Array.isArray(item.samples), "INVALID_SAMPLES", `series[${s}].samples must be an array.`);
    let previous;
    let orderKey;
    for (let i = 0; i < item.samples.length; i += 1) {
      const sample = item.samples[i];
      requireRecord(sample, `series[${s}].samples[${i}]`);
      const hasTime = hasOwn(sample, "time");
      const hasSequence = hasOwn(sample, "sequence");
      assert(hasTime !== hasSequence, "INVALID_SERIES_ORDER", `series[${s}].samples[${i}] must contain exactly one ordering field: time or sequence.`);
      const currentOrderKey = hasTime ? "time" : "sequence";
      assert(orderKey === undefined || currentOrderKey === orderKey, "INCONSISTENT_SERIES_ORDER", `series[${s}] must use the same ordering field for every sample.`);
      orderKey = currentOrderKey;
      const order = sample[orderKey];
      requireFinite(order, `series[${s}].samples[${i}].${orderKey}`);
      assert(previous === undefined || order > previous, "UNORDERED_SERIES", `series[${s}] samples must have strictly increasing ${orderKey} values.`, { index: i, value: order });
      previous = order;
      for (const axis of ["x", "y", "z"]) requireFinite(sample[axis], `series[${s}].samples[${i}].${axis}`);
      if (hasOwn(sample, "value")) requireFinite(sample.value, `series[${s}].samples[${i}].value`);
    }
  }
  return series;
}

function requireNumericArray(values, label) {
  assert(isArrayLike(values), "INVALID_ARRAY", `${label} must be an array or typed array.`);
  for (let i = 0; i < values.length; i += 1) requireFinite(values[i], `${label}[${i}]`);
}

export function validateSurfaceMesh(mesh) {
  requireRecord(mesh, "mesh");
  requireNumericArray(mesh.positions, "mesh.positions");
  assert(mesh.positions.length >= 9 && mesh.positions.length % 3 === 0, "INVALID_MESH_POSITIONS", "Mesh positions must contain at least three XYZ vertices.");
  const vertexCount = mesh.positions.length / 3;
  assert(isArrayLike(mesh.indices) && mesh.indices.length >= 3 && mesh.indices.length % 3 === 0, "INVALID_MESH_INDICES", "Mesh indices must contain one or more complete triangles.");
  for (let i = 0; i < mesh.indices.length; i += 1) {
    const index = mesh.indices[i];
    assert(Number.isInteger(index) && index >= 0 && index < vertexCount, "MESH_INDEX_OUT_OF_RANGE", `mesh.indices[${i}] does not refer to an existing vertex.`, { index, vertexCount });
  }
  if (mesh.vertexValues !== undefined) {
    requireNumericArray(mesh.vertexValues, "mesh.vertexValues");
    assert(mesh.vertexValues.length === vertexCount, "MESH_VERTEX_VALUE_COUNT", "Mesh vertexValues length must match the number of vertices.");
  }
  if (mesh.faceValues !== undefined) {
    requireNumericArray(mesh.faceValues, "mesh.faceValues");
    assert(mesh.faceValues.length === mesh.indices.length / 3, "MESH_FACE_VALUE_COUNT", "Mesh faceValues length must match the number of triangles.");
  }
  return mesh;
}

function validateGrid(grid, valueKey, components) {
  requireRecord(grid, "grid");
  assert(Array.isArray(grid.dimensions) && grid.dimensions.length === 3, "INVALID_GRID_DIMENSIONS", "Grid dimensions must contain three positive integers.");
  for (let i = 0; i < 3; i += 1) assert(Number.isSafeInteger(grid.dimensions[i]) && grid.dimensions[i] > 0, "INVALID_GRID_DIMENSIONS", `grid.dimensions[${i}] must be a positive safe integer.`);
  assert(Array.isArray(grid.origin) && grid.origin.length === 3, "INVALID_GRID_ORIGIN", "Grid origin must contain three finite coordinates.");
  assert(Array.isArray(grid.spacing) && grid.spacing.length === 3, "INVALID_GRID_SPACING", "Grid spacing must contain three finite values.");
  for (let i = 0; i < 3; i += 1) {
    requireFinite(grid.origin[i], `grid.origin[${i}]`);
    requireFinite(grid.spacing[i], `grid.spacing[${i}]`);
    assert(grid.spacing[i] !== 0, "INVALID_GRID_SPACING", `grid.spacing[${i}] must not be zero.`);
  }
  assert(grid.sampleLocation === "vertex" || grid.sampleLocation === "cell", "INVALID_SAMPLE_LOCATION", "Grid sampleLocation must be 'vertex' or 'cell'.");
  const sampleCount = grid.dimensions.reduce((product, dimension) => product * dimension, 1);
  assert(Number.isSafeInteger(sampleCount) && sampleCount <= Number.MAX_SAFE_INTEGER / components, "GRID_TOO_LARGE", "Grid dimensions exceed the safe sample count.");
  const values = grid[valueKey];
  requireNumericArray(values, `grid.${valueKey}`);
  assert(values.length === sampleCount * components, "GRID_VALUE_COUNT", `grid.${valueKey} must contain ${sampleCount * components} scalar values.`, { expected: sampleCount * components, actual: values.length });
  return grid;
}

export function validateRegularScalarGrid(grid) {
  return validateGrid(grid, "values", 1);
}

export function validateRegularVectorGrid(grid) {
  return validateGrid(grid, "vectors", 3);
}

export function validateNetwork(network) {
  requireRecord(network, "network");
  assert(Array.isArray(network.nodes), "INVALID_NETWORK_NODES", "Network nodes must be an array.");
  assert(Array.isArray(network.edges), "INVALID_NETWORK_EDGES", "Network edges must be an array.");
  requireUniqueIds(network.nodes, "network.nodes");
  const nodeIds = new Set(network.nodes.map(node => node.id));
  network.nodes.forEach((node, i) => requireRecord(node, `network.nodes[${i}]`));
  network.edges.forEach((edge, i) => {
    requireRecord(edge, `network.edges[${i}]`);
    assert(nodeIds.has(edge.source), "UNKNOWN_EDGE_NODE", `network.edges[${i}].source does not identify a node.`);
    assert(nodeIds.has(edge.target), "UNKNOWN_EDGE_NODE", `network.edges[${i}].target does not identify a node.`);
  });
  return network;
}

function shapeSignature(value, seen = new Set()) {
  if (value === null) return "null";
  if (ArrayBuffer.isView(value)) {
    const length = value instanceof DataView ? value.byteLength : value.length;
    return `typed:${value.constructor.name}:${length}`;
  }
  if (Array.isArray(value)) {
    assert(!seen.has(value), "CYCLIC_FRAME_DATA", "Time-frame data must not contain cycles.");
    seen.add(value);
    const result = `array:${value.length}[${value.map(item => shapeSignature(item, seen)).join(",")}]`;
    seen.delete(value);
    return result;
  }
  if (typeof value === "object") {
    assert(!seen.has(value), "CYCLIC_FRAME_DATA", "Time-frame data must not contain cycles.");
    seen.add(value);
    const result = `object:{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${shapeSignature(value[key], seen)}`).join(",")}}`;
    seen.delete(value);
    return result;
  }
  return typeof value;
}

export function validateTimeSeries(timeSeries) {
  requireRecord(timeSeries, "timeSeries");
  assert(Array.isArray(timeSeries.frames) && timeSeries.frames.length > 0, "INVALID_TIME_FRAMES", "Time series must contain at least one frame.");
  let previous;
  let signature;
  for (let i = 0; i < timeSeries.frames.length; i += 1) {
    const frame = timeSeries.frames[i];
    requireRecord(frame, `timeSeries.frames[${i}]`);
    requireFinite(frame.time, `timeSeries.frames[${i}].time`);
    assert(previous === undefined || frame.time > previous, "UNORDERED_TIME_FRAMES", "Time frames must be strictly ordered.", { index: i, time: frame.time });
    previous = frame.time;
    assert(frame.data !== undefined, "MISSING_FRAME_DATA", `timeSeries.frames[${i}] must contain data.`);
    const currentSignature = frame.shape === undefined ? shapeSignature(frame.data) : shapeSignature(frame.shape);
    if (signature === undefined) signature = currentSignature;
    assert(currentSignature === signature, "INCOMPATIBLE_TIME_FRAMES", "Time frames must have compatible data shapes.", { index: i });
  }
  return timeSeries;
}
