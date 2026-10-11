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
  // Quasi-static moving-point-charge field B = μ0/(4π) q(v×r)/r³;
  // dipole field below is its standard point-dipole form. Softening replaces r² by r²+a².
  // References: MIT OCW 8.02, Ch. 9 §9.5 (moving charge and dipole fields),
  // https://ocw.mit.edu/courses/8-02-physics-ii-electricity-and-magnetism-spring-2007/378f66ab154c54f34f58ab72fbcf9414_ch9sourc_b_field.pdf
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
  // Differentiate μ_target·B_dipole with respect to r: F = ∇(μ·B),
  // using U = -μ·B and ∇·B = 0. The softened kernel is differentiated consistently.
  // Reference: MIT OCW 8.02T, Ch. 8, magnetic dipole force and energy,
  // https://ocw.mit.edu/courses/8-02t-electricity-and-magnetism-spring-2005/90510e513af27a2dde30b890a61bbcd1_ch8magneti_field.pdf
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
  // Differentiate μ_target·B_moving-charge; the same source-field convention is
  // given in MIT OCW 8.02, Ch. 9 §9.5 (URL in magneticFieldAt above).
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

      // Coulomb force is k q_i q_j r/r³ (softened here with r²+a²).
      // Reference: OpenStax University Physics Vol. 2, §5.3,
      // https://openstax.org/books/university-physics-volume-2/pages/5-3-coulombs-law
      const electricForce = multiply(r, options.electricCoupling * target.charge * source.charge * inverseCube);
      // Lorentz force q(v×B), plus magnetic-energy-gradient forces on the fixed dipole.
      // References: OpenStax Ch. 11 key equations (Lorentz force and dipole energy),
      // https://openstax.org/books/university-physics-volume-2/pages/11-key-equations
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
    // Newton's equations are dx/dt = v and dv/dt = ΣF/m.
    // Reference: OpenStax Physics, §4.3 Newton's Second Law,
    // https://openstax.org/books/physics/pages/4-3-newtons-second-law-of-motion
    position: particle.velocity,
    velocity: multiply(forces[index], 1 / particle.mass),
    // Apply the requested semiclassical precession law dμ/dt = γ(μ×B).
    // Its torque convention τ=μ×B is listed in OpenStax Ch. 11 key equations;
    // the explicit gyromagnetic conversion/sign follows the SpinParticle specification.
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
    // Classical four-stage, fourth-order Runge–Kutta integration (RK4).
    // Reference: MIT OCW 18.03SC, Numerical Methods / Better Methods,
    // https://ocw.mit.edu/courses/18-03sc-differential-equations-fall-2011/resources/better-methods/
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
  const initialParticles = particles.map(cloneParticle);
  let current = initialParticles.map(cloneParticle);
  let elapsedTime = 0;
  return Object.freeze({
    get particles() { return current.map(cloneParticle); },
    get elapsedTime() { return elapsedTime; },
    step(dt, substeps = 1) {
      if (!finite(dt) || dt <= 0) throw new RangeError("dt must be positive and finite.");
      const nextElapsedTime = elapsedTime + dt;
      if (!finite(nextElapsedTime)) throw new RangeError("elapsed time exceeded the finite numeric range.");
      const nextParticles = stepParticles(current, { ...options, dt, substeps });
      current = nextParticles;
      elapsedTime = nextElapsedTime;
      return current.map(cloneParticle);
    },
    reset(nextParticles = initialParticles) {
      validateSpinParticles(nextParticles);
      current = nextParticles.map(cloneParticle);
      elapsedTime = 0;
      return current.map(cloneParticle);
    },
    setInteraction(next = {}) { Object.assign(options, normalizeInteraction({ ...options, ...next })); },
  });
}
