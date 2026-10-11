import assert from "node:assert/strict";
import test from "node:test";
import { createGeometryLayout, GEOMETRY_CONFIGURATIONS } from "./geometry-model.js";

const SUPER_CELL = 3;
const EXPECTED_NEIGHBOR_COUNTS = Object.freeze({
  cp:6, ci:8, cf:12, tp:6, ti:10, op:6, oc:6, oi:10, of:8,
  mp:6, mc:6, ap:6, hp:8, hr:10, hcp:12, diamond:4, kagome:6,
  "hex-diamond":[4,4,4,4], fluorite:[8,8,8,8,4,4,4,4,4,4,4,4], "corner-octahedra":[6,2,2,2],
  "perovskite-cage":[0,6,2,2,2], "bronze-channels":[8,8,2,2,2,2,3,3,3,3], "zeolite-cages":[4,4,4,4,4,4,4,4,4,4,4,4],
});
const EXPECTED_EDGE_COUNTS = Object.freeze({
  cp:54, ci:125, cf:450, tp:54, ti:161, op:54, oc:111, oi:161, of:300,
  mp:54, mc:111, ap:54, hp:66, hr:243, hcp:201, diamond:333, kagome:183,
  "hex-diamond":159, fluorite:665, "corner-octahedra":135, "perovskite-cage":135, "bronze-channels":359, "zeolite-cages":549,
});

function degreesFor(layout) {
  const degrees = new Array(layout.positions.length).fill(0);
  for (const [from, to] of layout.bondPairs) {
    degrees[from] += 1;
    degrees[to] += 1;
  }
  return degrees;
}

function distance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

test("primitive cubic 3×3×3 bond graph covers every expected nearest-neighbor edge", () => {
  const configuration = GEOMETRY_CONFIGURATIONS.find(item => item.id === "cp");
  const layout = createGeometryLayout(configuration, SUPER_CELL);
  const degrees = degreesFor(layout);
  const degreeCounts = degrees.reduce((counts, degree) => {
    counts[degree] = (counts[degree] ?? 0) + 1;
    return counts;
  }, {});

  assert.equal(layout.positions.length, 27);
  assert.equal(layout.bondPairs.length, 54);
  assert.deepEqual(degreeCounts, { 3:8, 4:12, 5:6, 6:1 });
  assert.equal(degrees[13], 6, "the central particle connects in all six lattice directions");
});

test("primitive tetragonal includes its closest and second-closest directions", () => {
  const configuration = GEOMETRY_CONFIGURATIONS.find(item => item.id === "tp");
  const layout = createGeometryLayout(configuration, SUPER_CELL);

  assert.deepEqual(layout.neighborDistanceShellsSquared, [.74 ** 2, 1]);
  assert.equal(degreesFor(layout)[13], 6, "the central particle connects along all three lattice axes");
});

test("all 23 configurations preserve interior three-dimensional neighbor coverage", () => {
  assert.equal(GEOMETRY_CONFIGURATIONS.length, 23);

  for (const configuration of GEOMETRY_CONFIGURATIONS) {
    const layout = createGeometryLayout(configuration, SUPER_CELL);
    const degrees = degreesFor(layout);
    const cellIndex = (1 * SUPER_CELL * SUPER_CELL + 1 * SUPER_CELL + 1) * configuration.basis.length;
    const interiorDegrees = degrees.slice(cellIndex, cellIndex + configuration.basis.length);

    assert.equal(layout.positions.length, configuration.basis.length * SUPER_CELL ** 3, `${configuration.name}: particle count`);
    assert.equal(layout.bondPairs.length, EXPECTED_EDGE_COUNTS[configuration.id], `${configuration.name}: edge count`);
    const expectedDegrees = EXPECTED_NEIGHBOR_COUNTS[configuration.id];
    assert.deepEqual(interiorDegrees, Array.isArray(expectedDegrees) ? expectedDegrees : new Array(configuration.basis.length).fill(expectedDegrees), `${configuration.name}: interior coordination`);

    const seen = new Set();
    for (const [from, to] of layout.bondPairs) {
      assert.ok(from >= 0 && from < to && to < layout.positions.length, `${configuration.name}: pair index range`);
      const key = `${from}:${to}`;
      assert.equal(seen.has(key), false, `${configuration.name}: duplicate edge ${key}`);
      seen.add(key);
      const distanceSquared = distance(layout.positions[from], layout.positions[to]) ** 2;
      assert.ok(layout.neighborDistanceShellsSquared.some(shell => Math.abs(distanceSquared - shell) <= shell * 1e-5), `${configuration.name}: edge is in a selected neighbor shell`);
    }

    assert.equal(layout.bondSegments.length, layout.bondPairs.length, `${configuration.name}: each edge has one rendered segment`);
    for (const segment of layout.bondSegments) {
      assert.ok(segment.start.every(Number.isFinite) && segment.end.every(Number.isFinite), `${configuration.name}: finite segment coordinates`);
      assert.ok(Math.abs(distance(segment.start, layout.positions[segment.from]) - 0.17) < 1e-10, `${configuration.name}: segment starts at the source sphere surface`);
      assert.ok(Math.abs(distance(segment.end, layout.positions[segment.to]) - 0.17) < 1e-10, `${configuration.name}: segment ends at the target sphere surface`);
    }
  }
});

test("the catalog contains the 14 Bravais lattice types and nine related crystal motifs", () => {
  const bravaisIds = ["cp", "ci", "cf", "tp", "ti", "op", "oc", "oi", "of", "mp", "mc", "ap", "hp", "hr"];
  const expectedBasisCounts = { cp:1, ci:2, cf:4, tp:1, ti:2, op:1, oc:2, oi:2, of:4, mp:1, mc:2, ap:1, hp:1, hr:3 };
  const ids = GEOMETRY_CONFIGURATIONS.map(configuration => configuration.id);

  assert.equal(new Set(ids).size, 23, "configuration IDs are unique");
  assert.deepEqual(ids.filter(id => bravaisIds.includes(id)), bravaisIds);
  assert.equal(GEOMETRY_CONFIGURATIONS.filter(configuration => configuration.group === "Related patterns").length, 9);
  for (const id of bravaisIds) {
    const configuration = GEOMETRY_CONFIGURATIONS.find(item => item.id === id);
    assert.equal(configuration.basis.length, expectedBasisCounts[id], `${configuration.name}: conventional-cell centering points`);
  }
});

test("Bravais lattice metrics match their named crystal family geometry", () => {
  const length = vector => Math.hypot(...vector);
  const cosine = (left, right) => left.reduce((sum, value, axis) => sum + value * right[axis], 0) / (length(left) * length(right));
  const nearlyEqual = (left, right) => Math.abs(left - right) < 1e-6;
  const byId = Object.fromEntries(GEOMETRY_CONFIGURATIONS.map(configuration => [configuration.id, configuration]));

  for (const id of ["cp", "ci", "cf"]) {
    const vectors = byId[id].lattice;
    assert.ok(vectors.every(vector => nearlyEqual(length(vector), 1)), `${id}: cubic axes have equal lengths`);
    assert.ok(vectors.every((vector, index) => vectors.slice(index + 1).every(other => nearlyEqual(cosine(vector, other), 0))), `${id}: cubic axes are perpendicular`);
  }
  for (const id of ["tp", "ti"]) {
    const lengths = byId[id].lattice.map(length);
    assert.equal(lengths.filter(value => nearlyEqual(value, 1)).length, 2, `${id}: two equal tetragonal axes`);
    assert.ok(byId[id].lattice.every((vector, index) => byId[id].lattice.slice(index + 1).every(other => nearlyEqual(cosine(vector, other), 0))), `${id}: tetragonal axes are perpendicular`);
  }
  for (const id of ["op", "oc", "oi", "of"]) {
    const vectors = byId[id].lattice;
    assert.equal(new Set(vectors.map(vector => length(vector).toFixed(5))).size, 3, `${id}: orthorhombic axes have distinct lengths`);
    assert.ok(vectors.every((vector, index) => vectors.slice(index + 1).every(other => nearlyEqual(cosine(vector, other), 0))), `${id}: orthorhombic axes are perpendicular`);
  }
  for (const id of ["mp", "mc"]) {
    const vectors = byId[id].lattice;
    assert.ok(Math.abs(cosine(vectors[0], vectors[2])) > 0.1, `${id}: monoclinic cell has an oblique angle`);
    assert.ok(nearlyEqual(cosine(vectors[0], vectors[1]), 0) && nearlyEqual(cosine(vectors[1], vectors[2]), 0), `${id}: the remaining axis is perpendicular to the oblique plane`);
  }
  const triclinic = byId.ap.lattice;
  assert.ok(triclinic.every((vector, index) => triclinic.slice(index + 1).every(other => Math.abs(cosine(vector, other)) > 0.01)), "triclinic cell has no right angles");
  const hexagonal = byId.hp.lattice;
  assert.ok(nearlyEqual(length(hexagonal[0]), length(hexagonal[1])), "hexagonal basal axes have equal lengths");
  assert.ok(nearlyEqual(cosine(hexagonal[0], hexagonal[1]), 0.5), "hexagonal basal vectors meet at 60 degrees in this coordinate setting");
  assert.ok(nearlyEqual(cosine(hexagonal[0], hexagonal[2]), 0) && nearlyEqual(cosine(hexagonal[1], hexagonal[2]), 0), "hexagonal axis is perpendicular to the basal plane");
  assert.equal(byId.hr.basis.length, 3, "rhombohedral lattice is displayed in its R-centered hexagonal setting");
});

test("new framework geometries retain their characteristic coordination and site layout", () => {
  const perovskite = GEOMETRY_CONFIGURATIONS.find(configuration => configuration.id === "perovskite-cage");
  const bronze = GEOMETRY_CONFIGURATIONS.find(configuration => configuration.id === "bronze-channels");
  const zeolite = GEOMETRY_CONFIGURATIONS.find(configuration => configuration.id === "zeolite-cages");

  assert.deepEqual(perovskite.basis[0], [0, 0, 0], "perovskite cage site sits at the cubic-cell corner in this origin choice");
  assert.deepEqual(perovskite.basis[1], [.5, .5, .5], "perovskite octahedral framework site sits at the body center");
  assert.equal(bronze.basis.length, 10, "tetragonal bronze framework repeats ten octahedral-center sites");
  assert.ok(bronze.lattice[2][2] < bronze.lattice[0][0], "tetragonal bronze channel motif has a shorter stacking period");
  assert.equal(zeolite.basis.length, 12, "the SOD-type framework uses the 12-site cubic conventional-cell motif");
});

test("geometry layout rejects invalid supercell sizes and particle radii", () => {
  const configuration = GEOMETRY_CONFIGURATIONS[0];
  assert.throws(() => createGeometryLayout(configuration, 0), RangeError);
  assert.throws(() => createGeometryLayout(configuration, 1.5), RangeError);
  assert.throws(() => createGeometryLayout(configuration, 1, -0.1), RangeError);
  assert.throws(() => createGeometryLayout(configuration, 1, Infinity), RangeError);
});
