import test from "node:test";
import assert from "node:assert/strict";
import {
  makeHydrogenicPreset,
  makeSimulationPreset,
  SI_CONSTANTS,
  SI_INTERACTION_COUPLING,
  SIMULATION_UNITS,
  toSIValues,
  toSimulationParticle,
} from "../spin-particle-si.js";
import { stepParticles } from "../spin-particle.js";

const closeRelative = (actual, expected, tolerance = 1e-12) => {
  assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * tolerance, `${actual} should match ${expected}`);
};

test("electron and proton presets use CODATA masses, charges, moments, and gyromagnetic ratios", () => {
  const [proton, electron] = makeHydrogenicPreset(2);
  assert.equal(proton.mass, SI_CONSTANTS.protonMass);
  assert.equal(electron.mass, SI_CONSTANTS.electronMass);
  assert.equal(proton.charge, SI_CONSTANTS.elementaryCharge);
  assert.equal(electron.charge, -SI_CONSTANTS.elementaryCharge);
  assert.equal(proton.gyromagneticRatio, SI_CONSTANTS.protonGyromagneticRatio);
  assert.equal(electron.gyromagneticRatio, SI_CONSTANTS.electronGyromagneticRatio);
  closeRelative(Math.hypot(...proton.magneticMoment), Math.abs(SI_CONSTANTS.protonMagneticMoment));
  closeRelative(Math.hypot(...electron.magneticMoment), Math.abs(SI_CONSTANTS.electronMagneticMoment));
});

test("expanded hydrogenic initial conditions preserve a nonrelativistic reduced-mass orbit", () => {
  const [proton, electron] = makeHydrogenicPreset(2);
  const separation = Math.hypot(...proton.position.map((value, axis) => electron.position[axis] - value));
  closeRelative(separation, SI_CONSTANTS.bohrRadius * 2.4);
  const relativeVelocity = Math.hypot(...proton.velocity.map((value, axis) => electron.velocity[axis] - value));
  const reducedMass = SI_CONSTANTS.electronMass * SI_CONSTANTS.protonMass /
    (SI_CONSTANTS.electronMass + SI_CONSTANTS.protonMass);
  const expectedRelativeVelocity = SI_CONSTANTS.electronBohrSpeed *
    Math.sqrt(SI_CONSTANTS.electronMass / reducedMass) / Math.sqrt(2.4);
  closeRelative(relativeVelocity, expectedRelativeVelocity);
  assert.ok(Math.hypot(...electron.velocity) / 299792458 < 0.01);
  const momentum = proton.velocity.map((value, axis) => proton.mass * value + electron.mass * electron.velocity[axis]);
  assert.ok(Math.hypot(...momentum) < 1e-39, "the initial atom has zero center-of-mass momentum within floating-point precision");
});

test("cloud pair centers use deterministic random placement with clear spacing", () => {
  const particles=makeHydrogenicPreset(12,"cloud");
  assert.deepEqual(particles,makeHydrogenicPreset(12,"cloud"),"the seeded randomized layout is reproducible");
  const centers=[];
  for(let index=0;index<particles.length;index+=2){
    const proton=particles[index], electron=particles[index+1];
    centers.push(proton.position.map((value,axis)=>
      (proton.mass*value+electron.mass*electron.position[axis])/(proton.mass+electron.mass)/SIMULATION_UNITS.length));
  }
  const radii=centers.map(center=>Math.hypot(...center));
  assert.ok(radii.some(radius=>radius<2) && radii.some(radius=>radius>3),"pair centers occupy a spread through the cloud volume");
  for(let left=0;left<centers.length;left+=1){
    for(let right=left+1;right<centers.length;right+=1){
      assert.ok(Math.hypot(...centers[left].map((value,axis)=>value-centers[right][axis]))>=3,
        "pair centers keep the minimum separation needed to distinguish force cones");
    }
  }
});

test("the SI unit conversion round-trips all six model fields", () => {
  const original = makeHydrogenicPreset(2)[1];
  const internal = toSimulationParticle(original);
  assert.equal(internal.mass, 1);
  assert.equal(internal.charge, -1);
  closeRelative(internal.gyromagneticRatio, -1.00115965218, 1e-8);
  const restored = toSIValues(internal);
  for (const field of ["mass", "charge", "gyromagneticRatio"]) closeRelative(restored[field], original[field]);
  for (const field of ["position", "velocity", "magneticMoment"]) {
    restored[field].forEach((value, index) => closeRelative(value, original[field][index]));
  }
});

test("SI-derived Coulomb and magnetic coefficients are dimensionless in the chosen units", () => {
  assert.ok(SI_INTERACTION_COUPLING.electric > 2.5 && SI_INTERACTION_COUPLING.electric < 2.6);
  assert.ok(SI_INTERACTION_COUPLING.magnetic > 2.8e-5 && SI_INTERACTION_COUPLING.magnetic < 2.9e-5);
  assert.equal(SIMULATION_UNITS.length, 1e-10);
  assert.equal(SIMULATION_UNITS.time, 1e-16);
});

test("cloud creates the requested pairs and dipole layout creates one complete pair", () => {
  for (const arrangement of ["cloud", "dipole"]) {
    const physical = makeHydrogenicPreset(12, arrangement);
    const expectedParticles = arrangement === "dipole" ? 2 : 12;
    assert.equal(physical.length, expectedParticles);
    assert.equal(physical.reduce((sum, particle) => sum + particle.charge, 0), 0);
    assert.ok(physical.every(particle => Number.isFinite(particle.mass) && particle.mass > 0));
    assert.equal(makeSimulationPreset(12, arrangement).length, expectedParticles);
  }
  const [proton, electron] = makeHydrogenicPreset(2, "cloud");
  const centerOfMass = proton.position.map((value, axis) =>
    (proton.mass * value + electron.mass * electron.position[axis]) / (proton.mass + electron.mass));
  assert.ok(Math.hypot(...centerOfMass) < 1e-25);
  assert.throws(() => makeHydrogenicPreset(3), /even integer/);
  assert.throws(() => makeHydrogenicPreset(4, "unknown"), /arrangement/);
});

test("a physical twelve-body preset remains finite through a short RK4 run", () => {
  const initial = makeSimulationPreset(12);
  let particles = initial;
  for (let frame = 0; frame < 80; frame += 1) {
    particles = stepParticles(particles, {
      dt: 0.02,
      substeps: 2,
      softening: 0.02,
      electricCoupling: SI_INTERACTION_COUPLING.electric,
      magneticCoupling: SI_INTERACTION_COUPLING.magnetic,
    });
  }
  assert.ok(particles.every(particle => [...particle.position, ...particle.velocity, ...particle.magneticMoment].every(Number.isFinite)));
  particles.forEach((particle, index) => {
    closeRelative(Math.hypot(...particle.magneticMoment), Math.hypot(...initial[index].magneticMoment));
  });
});

test("the maximum 32-body UI configuration remains finite at SI baseline coupling", () => {
  let particles = makeSimulationPreset(32);
  for (let frame = 0; frame < 60; frame += 1) {
    particles = stepParticles(particles, {
      dt: 0.02,
      substeps: 2,
      softening: 0.02,
      electricCoupling: SI_INTERACTION_COUPLING.electric,
      magneticCoupling: SI_INTERACTION_COUPLING.magnetic,
    });
  }
  assert.ok(particles.every(particle => [...particle.position, ...particle.velocity, ...particle.magneticMoment].every(Number.isFinite)));
});
