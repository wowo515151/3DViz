const SQRT_EPSILON = 1e-12;

export const DEFAULT_INTERACTION = Object.freeze({
  softening: 0.32,
  electricCoupling: 0.7,
  magneticCoupling: 0.035,
});

const finite = value => typeof value === "number" && Number.isFinite(value);
const vector = (value, label) => {
  if (!Array.isArray(value) || value.length !== 3 || value.some(item => !finite(item))) {
    throw new TypeError(`${label} must be an array of three finite numbers.`);
  }
  return value.slice();
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const multiply = (a, scalar) => [a[0] * scalar, a[1] * scalar, a[2] * scalar];
const magnitude = value => Math.hypot(value[0], value[1], value[2]);
const safeDenominator = value => Math.max(value, SQRT_EPSILON);

function normalizeInteraction(options = {}) {
  const result = { ...DEFAULT_INTERACTION, ...options };
  if (!finite(result.softening) || result.softening < 0) throw new RangeError("softening must be finite and non-negative.");
  if (!finite(result.electricCoupling) || result.electricCoupling < 0) throw new RangeError("electricCoupling must be finite and non-negative.");
  if (!finite(result.magneticCoupling) || result.magneticCoupling < 0) throw new RangeError("magneticCoupling must be finite and non-negative.");
  return result;
}

export function createSpinParticle({
  id,
  position = [0, 0, 0],
  velocity = [0, 0, 0],
  mass = 1,
  charge = 0,
  magneticMoment = [0, 0, 0],
  gyromagneticRatio = 1,
} = {}) {
  if ((typeof id !== "string" && typeof id !== "number") || String(id).trim() === "") {
    throw new TypeError("id must be a non-empty string or finite number.");
  }
  if (typeof id === "number" && !finite(id)) throw new TypeError("Numeric ids must be finite.");
  if (!finite(mass) || mass <= 0) throw new RangeError("mass must be positive and finite.");
  if (!finite(charge)) throw new TypeError("charge must be finite.");
  if (!finite(gyromagneticRatio)) throw new TypeError("gyromagneticRatio must be finite.");
  return {
    id,
    position: vector(position, "position"),
    velocity: vector(velocity, "velocity"),
    mass,
    charge,
    magneticMoment: vector(magneticMoment, "magneticMoment"),
    gyromagneticRatio,
  };
}

export function validateSpinParticles(particles) {
  if (!Array.isArray(particles)) throw new TypeError("particles must be an array.");
  const ids = new Set();
  for (const particle of particles) {
    if (!particle || typeof particle !== "object") throw new TypeError("Each particle must be an object.");
    const normalized = createSpinParticle(particle);
    const key = String(normalized.id);
    if (ids.has(key)) throw new RangeError(`Particle id '${key}' is duplicated.`);
    ids.add(key);
  }
  return particles;
}

function cloneParticle(particle) {
  return {
    id: particle.id,
    position: particle.position.slice(),
    velocity: particle.velocity.slice(),
    mass: particle.mass,
    charge: particle.charge,
    magneticMoment: particle.magneticMoment.slice(),
    gyromagneticRatio: particle.gyromagneticRatio,
  };
}

function magneticFieldAt(target, source, options) {
  const r = subtract(target.position, source.position);
  const squaredDistance = dot(r, r) + options.softening ** 2;
  const distance = Math.sqrt(safeDenominator(squaredDistance));
  const inverseCube = 1 / distance ** 3;
  const inverseFifth = inverseCube / (distance * distance);
  const fromCharge = multiply(cross(source.velocity, r), options.magneticCoupling * source.charge * inverseCube);
  const projection = dot(source.magneticMoment, r);
  const fromDipole = multiply(subtract(multiply(r, 3 * projection * inverseFifth), multiply(source.magneticMoment, inverseCube)), options.magneticCoupling);
  return add(fromCharge, fromDipole);
}

function dipoleGradientForce(r, targetMoment, sourceMoment, options) {
  const squaredDistance = dot(r, r) + options.softening ** 2;
  const distance = Math.sqrt(safeDenominator(squaredDistance));
  const inverseFifth = 1 / distance ** 5;
  const inverseSeventh = inverseFifth / squaredDistance;
  const targetProjection = dot(targetMoment, r);
  const sourceProjection = dot(sourceMoment, r);
  const mutualProjection = dot(targetMoment, sourceMoment);
  const first = multiply(add(multiply(targetMoment, sourceProjection), multiply(sourceMoment, targetProjection)), 3 * inverseFifth);
  const second = multiply(r, -15 * targetProjection * sourceProjection * inverseSeventh);
  const third = multiply(r, 3 * mutualProjection * inverseFifth);
  return multiply(add(add(first, second), third), options.magneticCoupling);
}

function chargeFieldGradientForce(r, targetMoment, sourceCharge, sourceVelocity, options) {
  const squaredDistance = dot(r, r) + options.softening ** 2;
  const distance = Math.sqrt(safeDenominator(squaredDistance));
  const inverseCube = 1 / distance ** 3;
  const inverseFifth = inverseCube / squaredDistance;
  const numerator = dot(targetMoment, cross(sourceVelocity, r));
  const numeratorGradient = cross(targetMoment, sourceVelocity);
  const gradient = subtract(multiply(numeratorGradient, inverseCube), multiply(r, 3 * numerator * inverseFifth));
  return multiply(gradient, options.magneticCoupling * sourceCharge);
}

/** Sum instantaneous, softened pair forces and magnetic fields for all particles. */
export function computeParticleInteractions(particles, interaction = {}) {
  validateSpinParticles(particles);
  const options = normalizeInteraction(interaction);
  const forces = particles.map(() => [0, 0, 0]);
  const electricForces = particles.map(() => [0, 0, 0]);
  const magneticForces = particles.map(() => [0, 0, 0]);
  const magneticFields = particles.map(() => [0, 0, 0]);
  for (let i = 0; i < particles.length; i += 1) {
    const target = particles[i];
    for (let j = 0; j < particles.length; j += 1) {
      if (i === j) continue;
      const source = particles[j];
      const r = subtract(target.position, source.position);
      const squaredDistance = dot(r, r) + options.softening ** 2;
      const distance = Math.sqrt(safeDenominator(squaredDistance));
      const inverseCube = 1 / distance ** 3;
      const field = magneticFieldAt(target, source, options);
      magneticFields[i] = add(magneticFields[i], field);

      // Coulomb force is the normalized-unit analogue of k q_i q_j r_hat/r^2.
      const electricForce = multiply(r, options.electricCoupling * target.charge * source.charge * inverseCube);
      // Moving charges and permanent dipoles both source B; a moving charge feels q v x B.
      const magneticLorentzForce = multiply(cross(target.velocity, field), target.charge);
      const fieldGradientForce = add(
        chargeFieldGradientForce(r, target.magneticMoment, source.charge, source.velocity, options),
        dipoleGradientForce(r, target.magneticMoment, source.magneticMoment, options),
      );
      const magneticForce = add(magneticLorentzForce, fieldGradientForce);
      electricForces[i] = add(electricForces[i], electricForce);
      magneticForces[i] = add(magneticForces[i], magneticForce);
      forces[i] = add(forces[i], add(electricForce, magneticForce));
    }
  }
  if ([...forces, ...electricForces, ...magneticForces, ...magneticFields].some(result => result.some(value => !finite(value)))) {
    throw new RangeError("Interaction magnitudes exceeded the finite numeric range.");
  }
  return { forces, electricForces, magneticForces, magneticFields };
}

function derivative(particles, interaction) {
  const { forces, magneticFields } = computeParticleInteractions(particles, interaction);
  return particles.map((particle, index) => ({
    position: particle.velocity,
    velocity: multiply(forces[index], 1 / particle.mass),
    magneticMoment: multiply(cross(particle.magneticMoment, magneticFields[index]), particle.gyromagneticRatio),
  }));
}

function stage(particles, k, scale) {
  return particles.map((particle, index) => ({
    ...particle,
    position: add(particle.position, multiply(k[index].position, scale)),
    velocity: add(particle.velocity, multiply(k[index].velocity, scale)),
    magneticMoment: add(particle.magneticMoment, multiply(k[index].magneticMoment, scale)),
  }));
}

function addWeighted(initial, a, b, c, d, dt) {
  return initial.map((particle, index) => {
    const combine = key => add(particle[key], multiply(add(add(a[index][key], multiply(b[index][key], 2)), add(multiply(c[index][key], 2), d[index][key])), dt / 6));
    const moment = combine("magneticMoment");
    const initialMagnitude = magnitude(particle.magneticMoment);
    const finalMagnitude = magnitude(moment);
    return {
      ...particle,
      position: combine("position"),
      velocity: combine("velocity"),
      // Renormalize after each RK4 step so intrinsic spin magnitude cannot drift.
      magneticMoment: initialMagnitude === 0 || finalMagnitude === 0 ? particle.magneticMoment.slice() : multiply(moment, initialMagnitude / finalMagnitude),
    };
  });
}

/** Advance a particle set by dt using RK4; the input particles are left untouched. */
export function stepParticles(particles, { dt, substeps = 1, ...interaction } = {}) {
  validateSpinParticles(particles);
  if (!finite(dt) || dt <= 0) throw new RangeError("dt must be positive and finite.");
  if (!Number.isSafeInteger(substeps) || substeps < 1 || substeps > 256) throw new RangeError("substeps must be an integer from 1 to 256.");
  const options = normalizeInteraction(interaction);
  const step = dt / substeps;
  let current = particles.map(cloneParticle);
  for (let iteration = 0; iteration < substeps; iteration += 1) {
    const k1 = derivative(current, options);
    const k2 = derivative(stage(current, k1, step / 2), options);
    const k3 = derivative(stage(current, k2, step / 2), options);
    const k4 = derivative(stage(current, k3, step), options);
    current = addWeighted(current, k1, k2, k3, k4, step);
    validateSpinParticles(current);
  }
  return current;
}

export function createSpinParticleSystem(particles, interaction = {}) {
  validateSpinParticles(particles);
  const options = normalizeInteraction(interaction);
  let current = particles.map(cloneParticle);
  let elapsedTime = 0;
  return Object.freeze({
    get particles() { return current.map(cloneParticle); },
    get elapsedTime() { return elapsedTime; },
    step(dt, substeps = 1) {
      current = stepParticles(current, { ...options, dt, substeps });
      elapsedTime += dt;
      return current.map(cloneParticle);
    },
    reset(nextParticles = particles) {
      validateSpinParticles(nextParticles);
      current = nextParticles.map(cloneParticle);
      elapsedTime = 0;
      return current.map(cloneParticle);
    },
    setInteraction(next = {}) { Object.assign(options, normalizeInteraction({ ...options, ...next })); },
  });
}
