import test from "node:test";
import assert from "node:assert/strict";
import {
  computeParticleInteractions,
  createSpinParticle,
  createSpinParticleSystem,
  stepParticles,
  validateSpinParticles,
} from "../spin-particle.js";

const pair = () => [
  createSpinParticle({ id:"a", position:[-1, 0, 0], charge:1 }),
  createSpinParticle({ id:"b", position:[1, 0, 0], charge:-1 }),
];

test("creates independent particles with the six required physical fields", () => {
  const position = [1,2,3];
  const particle = createSpinParticle({ id:1, position, velocity:[4,5,6], mass:2, charge:-1, magneticMoment:[0,0,1], gyromagneticRatio:3 });
  assert.deepEqual(Object.keys(particle).sort(), ["charge","gyromagneticRatio","id","magneticMoment","mass","position","velocity"].sort());
  assert.notEqual(particle.position, position);
  assert.deepEqual(particle.position, position);
  assert.deepEqual(particle.magneticMoment, [0,0,1]);
});

test("rejects malformed vectors, invalid mass, and repeated identifiers", () => {
  assert.throws(() => createSpinParticle({ id:"x", position:[0, NaN, 0] }), /three finite numbers/);
  assert.throws(() => createSpinParticle({ id:"x", mass:0 }), /mass must be positive/);
  assert.throws(() => validateSpinParticles([pair()[0], pair()[0]]), /duplicated/);
});

test("an isolated neutral particle has no force or magnetic field", () => {
  const particle = createSpinParticle({ id:"free", position:[0,0,0], velocity:[1,2,3], magneticMoment:[0,1,0] });
  const { forces, magneticFields } = computeParticleInteractions([particle]);
  assert.deepEqual(forces, [[0,0,0]]);
  assert.deepEqual(magneticFields, [[0,0,0]]);
});

test("opposite charges accelerate toward one another and like charges repel", () => {
  const attractionInteractions = computeParticleInteractions(pair());
  const attraction = attractionInteractions.forces;
  assert.ok(attraction[0][0] > 0);
  assert.ok(attraction[1][0] < 0);
  assert.deepEqual(attractionInteractions.electricForces, attraction, "Coulomb force is reported as the electric contribution");
  assert.deepEqual(attractionInteractions.magneticForces, [[0,0,0],[0,0,0]]);
  const repulsion = computeParticleInteractions(pair().map(particle => ({ ...particle, charge:1 }))).forces;
  assert.ok(repulsion[0][0] < 0);
  assert.ok(repulsion[1][0] > 0);
});

test("softened Coulomb force matches its analytic vector and action–reaction pair", () => {
  const r = [0.7, -0.2, 0.4];
  const softening = 0.3;
  const coupling = 1.7;
  const particles = [
    createSpinParticle({ id:"target", position:r, charge:2 }),
    createSpinParticle({ id:"source", charge:-3 }),
  ];
  const { electricForces } = computeParticleInteractions(particles, { softening, electricCoupling:coupling, magneticCoupling:0 });
  const denominator = (r.reduce((sum, value) => sum + value * value, softening ** 2)) ** 1.5;
  const expected = r.map(value => coupling * 2 * -3 * value / denominator);
  expected.forEach((value, axis) => assert.ok(Math.abs(value - electricForces[0][axis]) < 1e-12));
  electricForces[0].forEach((value, axis) => assert.ok(Math.abs(value + electricForces[1][axis]) < 1e-12));
});

test("moving charge and magnetic moment contribute magnetic fields", () => {
  const observer = createSpinParticle({ id:"observer", position:[0,1,0] });
  const movingCharge = createSpinParticle({ id:"charge", position:[0,0,0], velocity:[1,0,0], charge:1 });
  const chargeField = computeParticleInteractions([observer, movingCharge]).magneticFields[0];
  assert.ok(chargeField[2] > 0);
  const dipole = createSpinParticle({ id:"dipole", position:[0,0,0], magneticMoment:[0,0,1] });
  const dipoleField = computeParticleInteractions([observer, dipole]).magneticFields[0];
  assert.ok(dipoleField[2] < 0);
});

test("magnetic dipole and moving-charge force gradients match finite differences of μ·B", () => {
  const interaction = { softening:0.23, electricCoupling:0, magneticCoupling:0.8 };
  const target = createSpinParticle({ id:"target", position:[0.63,-0.41,0.28], magneticMoment:[0.4,-0.7,0.2] });
  const source = createSpinParticle({ id:"source", velocity:[0.3,0.8,-0.5], charge:-0.9, magneticMoment:[-0.2,0.5,0.6] });
  const force = computeParticleInteractions([target, source], interaction).magneticForces[0];
  const energyLike = position => {
    const shifted = { ...target, position };
    const field = computeParticleInteractions([shifted, source], interaction).magneticFields[0];
    return target.magneticMoment.reduce((sum, value, axis) => sum + value * field[axis], 0);
  };
  const h = 1e-5;
  force.forEach((value, axis) => {
    const plus = target.position.slice(); plus[axis] += h;
    const minus = target.position.slice(); minus[axis] -= h;
    const derivative = (energyLike(plus) - energyLike(minus)) / (2 * h);
    assert.ok(Math.abs(value - derivative) < 2e-8, `axis ${axis}: analytic ${value}, finite difference ${derivative}`);
  });
});

test("moving charges and magnetic dipoles produce nonzero pair forces", () => {
  const moving = [
    createSpinParticle({ id:"a", position:[0,0,0], velocity:[0,0,1], charge:1 }),
    createSpinParticle({ id:"b", position:[0,0,1], velocity:[1,0,0], charge:-1 }),
  ];
  const movingInteractions = computeParticleInteractions(moving);
  const movingForces = movingInteractions.forces;
  assert.notDeepEqual(movingForces, [[0,0,0],[0,0,0]]);
  const magneticContributions = movingInteractions.magneticForces;
  assert.ok(magneticContributions.some(force => Math.hypot(...force) > 0), "velocity-dependent forces are reported as magnetic contributions");
  movingForces.forEach((force, index) => force.forEach((component, axis) => {
    assert.ok(Math.abs(component - movingInteractions.electricForces[index][axis] - magneticContributions[index][axis]) < 1e-12,
      "total force equals the sum of electric and magnetic contributions");
  }));
  const dipoles = [
    createSpinParticle({ id:"a", position:[-1,0,0], magneticMoment:[0,0,1] }),
    createSpinParticle({ id:"b", position:[1,0,0], magneticMoment:[0,0,1] }),
  ];
  const dipoleForces = computeParticleInteractions(dipoles).forces;
  assert.ok(dipoleForces[0][0] < 0);
  assert.ok(dipoleForces[1][0] > 0);
});

test("RK4 advances positions and preserves magnetic moment magnitude", () => {
  const particles = [
    createSpinParticle({ id:"moving", position:[0,0,0], velocity:[1,0,0], magneticMoment:[1,0,0], gyromagneticRatio:2 }),
    createSpinParticle({ id:"field", position:[0,0,1], magneticMoment:[0,0,1], gyromagneticRatio:2 }),
  ];
  const initial = particles[1].magneticMoment;
  const next = stepParticles(particles, { dt:0.01 });
  assert.ok(next[0].position[0] > 0);
  assert.ok(Math.abs(Math.hypot(...next[1].magneticMoment) - Math.hypot(...initial)) < 1e-12);
  assert.ok(next[0].magneticMoment[1] < 0, "dμ/dt = γ(μ × B) rotates toward negative y here");
  assert.deepEqual(particles[0].position, [0,0,0], "stepParticles must not mutate input arrays");
});

test("softening keeps coincident particles finite", () => {
  const coincident = [
    createSpinParticle({ id:"a", position:[0,0,0], charge:1, magneticMoment:[1,0,0] }),
    createSpinParticle({ id:"b", position:[0,0,0], charge:-1, magneticMoment:[0,1,0] }),
  ];
  const result = stepParticles(coincident, { dt:0.001, substeps:2 });
  assert.ok(result.every(particle => [...particle.position, ...particle.velocity, ...particle.magneticMoment].every(Number.isFinite)));
});

test("a small preset-like system remains finite through repeated updates", () => {
  const particles = Array.from({ length:8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    const charge = index % 2 === 0 ? 1 : -1;
    return createSpinParticle({
      id:index,
      position:[2 * Math.cos(angle), 0.5 * Math.sin(2 * angle), 2 * Math.sin(angle)],
      velocity:[-0.12 * Math.sin(angle), 0.03 * Math.cos(angle), 0.12 * Math.cos(angle)],
      mass:0.8 + 0.1 * (index % 3),
      charge,
      magneticMoment:[0.35 * Math.cos(angle), 0.25 * Math.sin(angle), 0.3 * charge],
      gyromagneticRatio:charge,
    });
  });
  let current = particles;
  for (let frame = 0; frame < 120; frame += 1) current = stepParticles(current, { dt:1 / 120, substeps:2 });
  assert.ok(current.every(particle => [...particle.position, ...particle.velocity, ...particle.magneticMoment].every(Number.isFinite)));
  current.forEach((particle, index) => assert.ok(Math.abs(Math.hypot(...particle.magneticMoment) - Math.hypot(...particles[index].magneticMoment)) < 1e-12));
});

test("the system steps, tracks elapsed time, and resets from a clean copy", () => {
  const system = createSpinParticleSystem(pair());
  const stepped = system.step(0.01, 2);
  assert.equal(system.elapsedTime, 0.01);
  assert.notDeepEqual(stepped, pair());
  system.reset(pair());
  assert.equal(system.elapsedTime, 0);
  assert.deepEqual(system.particles.map(p => p.position), [[-1,0,0],[1,0,0]]);
});

test("reset is insulated from later edits to the caller's original particle array", () => {
  const original = pair();
  const system = createSpinParticleSystem(original, { electricCoupling:0, magneticCoupling:0 });
  original[0].position[0] = 500;
  original[0].magneticMoment[1] = 800;
  system.reset();
  assert.equal(system.particles[0].position[0], -1);
  assert.equal(system.particles[0].magneticMoment[1], 0);
});

test("elapsed time overflow leaves system state and time unchanged", () => {
  const system = createSpinParticleSystem([createSpinParticle({ id:"still" })], { electricCoupling:0, magneticCoupling:0 });
  system.step(Number.MAX_VALUE);
  assert.throws(() => system.step(Number.MAX_VALUE), /elapsed time exceeded/);
  assert.equal(system.elapsedTime, Number.MAX_VALUE);
  assert.deepEqual(system.particles[0].position, [0,0,0]);
});

test("rejects non-positive timesteps and invalid softening", () => {
  assert.throws(() => stepParticles(pair(), { dt:0 }), /dt must be positive/);
  assert.throws(() => computeParticleInteractions(pair(), { softening:-1 }), /softening must be/);
  assert.throws(() => computeParticleInteractions(pair().map((particle,index)=>({...particle,charge:index===0?10:-10})), { electricCoupling:Number.MAX_VALUE }), /finite numeric range/);
});
