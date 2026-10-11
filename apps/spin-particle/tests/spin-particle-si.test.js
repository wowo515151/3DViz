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
import { computeParticleInteractions, stepParticles } from "../spin-particle.js";

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

test("unit-scaled solver Coulomb force converts back to the SI point-charge force", () => {
  const proton = toSimulationParticle({
    id:"p", position:[0,0,0], velocity:[0,0,0], mass:SI_CONSTANTS.protonMass,
    charge:SI_CONSTANTS.elementaryCharge, magneticMoment:[0,0,0], gyromagneticRatio:SI_CONSTANTS.protonGyromagneticRatio,
  });
  const electron = toSimulationParticle({
    id:"e", position:[1e-10,0,0], velocity:[0,0,0], mass:SI_CONSTANTS.electronMass,
    charge:-SI_CONSTANTS.elementaryCharge, magneticMoment:[0,0,0], gyromagneticRatio:SI_CONSTANTS.electronGyromagneticRatio,
  });
  const normalized = computeParticleInteractions([proton,electron], {
    softening:0, electricCoupling:SI_INTERACTION_COUPLING.electric, magneticCoupling:SI_INTERACTION_COUPLING.magnetic,
  }).electricForces[1][0];
  const siForce = normalized * SIMULATION_UNITS.mass * SIMULATION_UNITS.length / SIMULATION_UNITS.time ** 2;
  const coulombForce = SI_CONSTANTS.elementaryCharge ** 2 /
    (4 * Math.PI * SI_CONSTANTS.vacuumPermittivity * 1e-20);
  assert.ok(Math.abs(siForce + coulombForce) / coulombForce < 1e-12);
});

test("unit-scaled magnetic Lorentz force and spin-precession rate match SI scales", () => {
  const proton = toSimulationParticle({
    id:"p", position:[0,0,0], velocity:[0,SIMULATION_UNITS.velocity,0], mass:SI_CONSTANTS.protonMass,
    charge:SI_CONSTANTS.elementaryCharge, magneticMoment:[0,0,0], gyromagneticRatio:SI_CONSTANTS.protonGyromagneticRatio,
  });
  const electron = toSimulationParticle({
    id:"e", position:[SIMULATION_UNITS.length,0,0], velocity:[SIMULATION_UNITS.velocity,0,0], mass:SI_CONSTANTS.electronMass,
    charge:-SI_CONSTANTS.elementaryCharge, magneticMoment:[0,0,0], gyromagneticRatio:SI_CONSTANTS.electronGyromagneticRatio,
  });
  const normalizedForce = computeParticleInteractions([proton,electron], {
    electricCoupling:0, magneticCoupling:SI_INTERACTION_COUPLING.magnetic, softening:0,
  }).magneticForces[1][1];
  const forceUnit = SIMULATION_UNITS.mass * SIMULATION_UNITS.length / SIMULATION_UNITS.time ** 2;
  const siForce = normalizedForce * forceUnit;
  const expectedLorentzForce = -SI_CONSTANTS.vacuumPermeability / (4*Math.PI) *
    SI_CONSTANTS.elementaryCharge ** 2 * SIMULATION_UNITS.velocity ** 2 / SIMULATION_UNITS.length ** 2;
  assert.ok(Math.abs(siForce - expectedLorentzForce) / expectedLorentzForce < 1e-12);

  const electronSim = toSimulationParticle({
    id:"g", position:[0,0,0], velocity:[0,0,0], mass:SI_CONSTANTS.electronMass,
    charge:-SI_CONSTANTS.elementaryCharge, magneticMoment:[0,0,0], gyromagneticRatio:SI_CONSTANTS.electronGyromagneticRatio,
  });
  const magneticFieldUnit = SI_CONSTANTS.vacuumPermeability / (4*Math.PI) *
    SI_CONSTANTS.elementaryCharge * SIMULATION_UNITS.velocity / SIMULATION_UNITS.length ** 2;
  const normalizedPrecessionScale = electronSim.gyromagneticRatio * SI_INTERACTION_COUPLING.magnetic;
  const siPrecessionScale = SI_CONSTANTS.electronGyromagneticRatio * magneticFieldUnit * SIMULATION_UNITS.time;
  closeRelative(normalizedPrecessionScale, siPrecessionScale);
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
