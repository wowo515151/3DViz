import { assert } from "../core/errors.js";

const forbiddenPathParts = new Set(["__proto__", "prototype", "constructor"]);

function readPath(record, path) {
  const parts = Array.isArray(path) ? path : String(path).split(".");
  let current = record;
  for (const part of parts) {
    assert(typeof part === "string" && part.length > 0 && !forbiddenPathParts.has(part), "INVALID_FIELD_PATH", "Coordinate field paths must use safe, non-empty property names.");
    current = current?.[part];
  }
  return current;
}

function normalizeAxis(axis, label) {
  assert(axis && typeof axis === "object", "INVALID_AXIS_MAPPING", `${label} mapping must be an object.`);
  assert(typeof axis.field === "string" || Array.isArray(axis.field), "INVALID_AXIS_FIELD", `${label}.field must be a property path.`);
  const baseline = axis.baseline ?? 0;
  const scale = axis.scale ?? 1;
  const direction = axis.direction ?? 1;
  assert(typeof baseline === "number" && Number.isFinite(baseline), "INVALID_AXIS_BASELINE", `${label}.baseline must be finite.`);
  assert(typeof scale === "number" && Number.isFinite(scale) && scale > 0, "INVALID_AXIS_SCALE", `${label}.scale must be positive and finite.`);
  assert(direction === 1 || direction === -1, "INVALID_AXIS_DIRECTION", `${label}.direction must be 1 or -1.`);
  return Object.freeze({ field: axis.field, baseline, scale, direction });
}

/**
 * Create a mapper from explicitly named source fields to world coordinates.
 * World value = (source value - baseline) * scale * direction.
 * This transforms positions only; it never mutates the input record.
 */
export function createCoordinateMapper(mapping) {
  assert(mapping && typeof mapping === "object", "INVALID_COORDINATE_MAPPING", "A coordinate mapping object is required.");
  const axes = Object.freeze({
    x: normalizeAxis(mapping.x, "x"),
    y: normalizeAxis(mapping.y, "y"),
    z: normalizeAxis(mapping.z, "z"),
  });

  function map(record) {
    assert(record !== null && typeof record === "object", "INVALID_COORDINATE_RECORD", "A coordinate source record must be an object.");
    const point = {};
    for (const name of ["x", "y", "z"]) {
      const axis = axes[name];
      const raw = readPath(record, axis.field);
      assert(typeof raw === "number" && Number.isFinite(raw), "INVALID_COORDINATE_VALUE", `The source value for world ${name.toUpperCase()} must be finite.`, { axis: name, field: axis.field, value: raw });
      point[name] = (raw - axis.baseline) * axis.scale * axis.direction;
    }
    return point;
  }

  return Object.freeze({ axes, map, mapMany(records) { assert(Array.isArray(records), "INVALID_COORDINATE_RECORDS", "mapMany requires an array."); return records.map(map); } });
}
