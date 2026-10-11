import { createSpinParticle } from "./spin-particle.js";

// CODATA 2022 values. Positions are shown in angstroms, masses in electron-mass
// units, and time in 0.1 fs units inside the numerical solver.
export const SI_CONSTANTS = Object.freeze({
  elementaryCharge: 1.602176634e-19,
  electronMass: 9.1093837139e-31,
  protonMass: 1.67262192595e-27,
  electronMagneticMoment: -9.2847646917e-24,
  protonMagneticMoment: 1.41060679545e-26,
  electronGyromagneticRatio: -1.76085962784e11,
  protonGyromagneticRatio: 2.6752218708e8,
  bohrRadius: 5.29177210544e-11,
  vacuumPermittivity: 8.8541878188e-12,
  vacuumPermeability: 1.25663706127e-6,
  electronBohrSpeed: 2.18769126216e6,
});

export const SIMULATION_UNITS = Object.freeze({
  length: 1e-10, // m, one angstrom
  time: 1e-16, // s, 0.1 femtoseconds
  mass: SI_CONSTANTS.electronMass,
  charge: SI_CONSTANTS.elementaryCharge,
  velocity: 1e6, // m/s
  magneticMoment: SI_CONSTANTS.elementaryCharge * (1e-10 ** 2) / 1e-16, // A m²
});

const coulombConstant = 1 / (4 * Math.PI * SI_CONSTANTS.vacuumPermittivity);
export const SI_INTERACTION_COUPLING = Object.freeze({
  electric: coulombConstant * SIMULATION_UNITS.charge ** 2 * SIMULATION_UNITS.time ** 2 /
    (SIMULATION_UNITS.mass * SIMULATION_UNITS.length ** 3),
  magnetic: (SI_CONSTANTS.vacuumPermeability / (4 * Math.PI)) * SIMULATION_UNITS.charge ** 2 /
    (SIMULATION_UNITS.mass * SIMULATION_UNITS.length),
});

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = vector => {
  const norm = Math.hypot(...vector) || 1;
  return vector.map(value => value / norm);
};

/** Convert one six-field SI particle into the stable internal unit system. */
export function toSimulationParticle(particle) {
  const { length, time, mass, charge, velocity, magneticMoment } = SIMULATION_UNITS;
  return createSpinParticle({
    id: particle.id,
    position: particle.position.map(value => value / length),
    velocity: particle.velocity.map(value => value / velocity),
    mass: particle.mass / mass,
    charge: particle.charge / charge,
    magneticMoment: particle.magneticMoment.map(value => value / magneticMoment),
    gyromagneticRatio: particle.gyromagneticRatio * mass / charge,
  });
}

/** Restore SI values for readable UI diagnostics and data export. */
export function toSIValues(particle) {
  const { length, time, mass, charge, velocity, magneticMoment } = SIMULATION_UNITS;
  return {
    mass: particle.mass * mass,
    charge: particle.charge * charge,
    position: particle.position.map(value => value * length),
    velocity: particle.velocity.map(value => value * velocity),
    magneticMoment: particle.magneticMoment.map(value => value * magneticMoment),
    gyromagneticRatio: particle.gyromagneticRatio * charge / mass,
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomUnitVector(random) {
  const z = random() * 2 - 1;
  const angle = random() * Math.PI * 2;
  const radial = Math.sqrt(1 - z * z);
  return [radial * Math.cos(angle), z, radial * Math.sin(angle)];
}

function makeAtomCenters(atomCount, arrangement, random) {
  if (arrangement === "dipole") {
    return [[0, 0, 0]];
  }
  if (atomCount === 1) return [[0, 0, 0]];
  const cloudRadius = Math.min(2.2 * Math.cbrt(atomCount), 4.2);
  const minimumSpacing = 3;
  const centers = [];
  for (let attempts = 0; centers.length < atomCount && attempts < atomCount * 20000; attempts += 1) {
    const direction = randomUnitVector(random);
    const radius = cloudRadius * Math.cbrt(random());
    const candidate = direction.map(value => value * radius);
    if (centers.every(center => Math.hypot(...center.map((value, axis) => value - candidate[axis])) >= minimumSpacing)) {
      centers.push(candidate);
    }
  }
  if (centers.length !== atomCount) throw new RangeError("Could not place the requested particle pairs with the minimum spacing.");
  return centers;
}

/**
 * Make neutral hydrogenic starting pairs using CODATA electron/proton properties,
 * expanded 2.4-Bohr-radius separation, and reduced-mass circular-orbit initial velocities.
 * This is a classical initial condition, not a quantum hydrogen solution.
 */
export function makeHydrogenicPreset(count = 12, arrangement = "cloud") {
  if (!Number.isSafeInteger(count) || count < 2 || count % 2 !== 0 || count > 32) {
    throw new RangeError("count must be an even integer from 2 to 32.");
  }
  if (arrangement !== "cloud" && arrangement !== "dipole") {
    throw new RangeError("arrangement must be 'cloud' or 'dipole'.");
  }

  const { elementaryCharge, electronMass, protonMass, electronMagneticMoment,
    protonMagneticMoment, electronGyromagneticRatio, protonGyromagneticRatio,
    bohrRadius, electronBohrSpeed } = SI_CONSTANTS;
  const totalMass = electronMass + protonMass;
  const reducedMass = electronMass * protonMass / totalMass;
  const separation = 2.4 * bohrRadius;
  const relativeSpeed = electronBohrSpeed * Math.sqrt(electronMass / reducedMass) * Math.sqrt(bohrRadius / separation);
  const random = seededRandom(0x51A7 + count + (arrangement === "dipole" ? 0xD1B : 0));
  const centersAngstrom = makeAtomCenters(count / 2, arrangement, random);
  const particles = [];

  centersAngstrom.forEach((center, atomIndex) => {
    const phase = random() * Math.PI * 2;
    const normal = randomUnitVector(random);
    const reference = Math.abs(normal[1]) > 0.92 ? [1, 0, 0] : [0, 1, 0];
    const basisA = unit(cross(normal, reference));
    const basisB = cross(normal, basisA);
    const orbitalAngle = random() * Math.PI * 2;
    const radial = unit(basisA.map((value, axis) => value * Math.cos(orbitalAngle) + basisB[axis] * Math.sin(orbitalAngle)));
    const tangent = unit(cross(normal, radial));
    const protonRadius = separation * electronMass / totalMass;
    const electronRadius = separation * protonMass / totalMass;
    const protonPosition = center.map((value, axis) => (value * 1e-10) - radial[axis] * protonRadius);
    const electronPosition = center.map((value, axis) => (value * 1e-10) + radial[axis] * electronRadius);
    const protonSpeed = relativeSpeed * electronMass / totalMass;
    const electronSpeed = relativeSpeed * protonMass / totalMass;
    const spinAxis = randomUnitVector(random);

    particles.push({
      id: atomIndex * 2 + 1,
      position: protonPosition,
      velocity: tangent.map(value => -value * protonSpeed),
      mass: protonMass,
      charge: elementaryCharge,
      magneticMoment: spinAxis.map(value => value * protonMagneticMoment),
      gyromagneticRatio: protonGyromagneticRatio,
    });
    particles.push({
      id: atomIndex * 2 + 2,
      position: electronPosition,
      velocity: tangent.map(value => value * electronSpeed),
      mass: electronMass,
      charge: -elementaryCharge,
      // Electron magnetic moment points opposite its spin angular momentum.
      magneticMoment: spinAxis.map(value => value * electronMagneticMoment),
      gyromagneticRatio: electronGyromagneticRatio,
    });
  });
  return particles;
}

export function makeSimulationPreset(count = 12, arrangement = "cloud") {
  return makeHydrogenicPreset(count, arrangement).map(toSimulationParticle);
}
