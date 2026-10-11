import test from "node:test";
import assert from "node:assert/strict";
import { createSpinParticle } from "../spin-particle.js";
import { fieldRowsForComponent, sampleParticleFields } from "../spin-particle-fields.js";

const center = (rows, x = 0, y = 0, z = 0) => rows.find(row => row.x === x && row.y === y && row.z === z);

test("electric samples sum charge fields with the correct direction and normalization", () => {
  const particles = [createSpinParticle({ id:"source", position:[-0.5, 0, 0], charge:2 })];
  const rows = sampleParticleFields(particles, { resolution:3, extent:1, softening:0.01 });
  const sample = center(rows);
  assert.ok(sample.electricX > 0);
  assert.equal(sample.electricY, 0);
  assert.equal(sample.electricZ, 0);
  assert.ok(sample.electricMagnitudeVPerM > 0);
  assert.equal(Math.max(...rows.map(row => row.electricMagnitude)), 1);
  assert.ok(rows.every(row => Number.isFinite(row.electricMagnitude)));
});

test("moving charges and permanent dipoles both contribute to the magnetic field", () => {
  const moving = sampleParticleFields([
    createSpinParticle({ id:"moving", position:[-0.5, 0, 0], velocity:[0, 1, 0], charge:1 }),
  ], { resolution:3, extent:1, softening:0.01 });
  assert.ok(center(moving).magneticZ < 0); // v × r points toward -z

  const dipole = sampleParticleFields([
    createSpinParticle({ id:"dipole", position:[-0.5, 0, 0], magneticMoment:[0, 0, 1] }),
  ], { resolution:3, extent:1, softening:0.01 });
  assert.ok(center(dipole).magneticZ < 0); // equatorial dipole field opposes its moment
  assert.ok(center(dipole).magneticMagnitudeTesla > 0);
});

test("coincident samples stay finite and component rows map vectors for shared plotters", () => {
  const rows = sampleParticleFields([
    createSpinParticle({ id:"source", position:[0, 0, 0], charge:-1, magneticMoment:[0, 0, 1] }),
  ], { resolution:3, extent:1, softening:0.001 });
  assert.ok(rows.every(row => [row.electricMagnitude, row.magneticMagnitude, row.electricMagnitudeVPerM,
    row.magneticMagnitudeTesla].every(Number.isFinite)));
  const electric = fieldRowsForComponent(rows, "electric");
  assert.equal(electric.length, rows.length);
  assert.equal(electric[0].value, rows[0].electricMagnitude);
  assert.equal(electric[0].u, rows[0].ex);
  assert.equal(electric[0].v, rows[0].ey);
  assert.equal(electric[0].w, rows[0].ez);
});

test("sampled single-particle fields convert back to realistic SI magnitudes", () => {
  const particle = createSpinParticle({ id:"electron", position:[0, 0, 0], velocity:[0, 1, 0], charge:-1 });
  const row = center(sampleParticleFields([particle], { resolution:3, extent:1, softening:0.001 }), 1, 0, 0);
  const coulombField = 8.9875517923e9 * 1.602176634e-19 / 1e-20;
  const magneticField = 1e-7 * 1.602176634e-19 * 1e6 / 1e-20;
  assert.ok(Math.abs(row.electricMagnitudeVPerM - coulombField) / coulombField < 0.001);
  assert.ok(Math.abs(row.magneticMagnitudeTesla - magneticField) / magneticField < 0.001);
});
