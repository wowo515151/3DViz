import { SIMULATION_UNITS, SI_CONSTANTS } from "./spin-particle-si.js";

const MU0_OVER_4PI = SI_CONSTANTS.vacuumPermeability / (4 * Math.PI);
const E_FIELD_UNIT = (1 / (4 * Math.PI * SI_CONSTANTS.vacuumPermittivity)) * SIMULATION_UNITS.charge / SIMULATION_UNITS.length ** 2;
const B_FIELD_UNIT = MU0_OVER_4PI * SIMULATION_UNITS.charge * SIMULATION_UNITS.velocity / SIMULATION_UNITS.length ** 2;

/** Sample softened, instantaneous E and B fields in the app's angstrom-scale coordinates.
 * The fields are quasi-static snapshots: radiation and retardation are intentionally omitted.
 */
export function sampleParticleFields(particles, {
  resolution = 15,
  extent = 5.5,
  softening = 0.02,
  electricCouplingScale = 1,
  magneticCouplingScale = 1,
} = {}) {
  if (!Array.isArray(particles) || particles.length === 0) throw new TypeError("At least one particle is required to sample fields.");
  if (!Number.isSafeInteger(resolution) || resolution < 3 || resolution > 31) throw new RangeError("Field resolution must be an integer from 3 to 31.");
  if (!Number.isFinite(extent) || extent <= 0 || !Number.isFinite(softening) || softening <= 0) throw new RangeError("Field extent and softening must be positive and finite.");
  if (![electricCouplingScale, magneticCouplingScale].every(value => Number.isFinite(value) && value >= 0)) throw new RangeError("Field couplings must be nonnegative and finite.");

  const step = 2 * extent / (resolution - 1);
  const epsilon2 = softening * softening;
  const rows = [];
  let electricPeak = 0, magneticPeak = 0, rowNumber = 1;
  for (let ix = 0; ix < resolution; ix++) {
    const x = -extent + ix * step;
    for (let iy = 0; iy < resolution; iy++) {
      const y = -extent + iy * step;
      for (let iz = 0; iz < resolution; iz++) {
        const z = -extent + iz * step;
        let ex = 0, ey = 0, ez = 0, bx = 0, by = 0, bz = 0;
        for (const particle of particles) {
          const rx = x - particle.position[0], ry = y - particle.position[1], rz = z - particle.position[2];
          const r2 = rx * rx + ry * ry + rz * rz + epsilon2;
          const inverseR = 1 / Math.sqrt(r2), inverseR3 = inverseR / r2;
          const inverseR5 = inverseR3 / r2;
          const charge = particle.charge;
          const eScale = electricCouplingScale * charge * inverseR3;
          ex += eScale * rx; ey += eScale * ry; ez += eScale * rz;

          const [vx, vy, vz] = particle.velocity;
          const qvx = vy * rz - vz * ry, qvy = vz * rx - vx * rz, qvz = vx * ry - vy * rx;
          const moment = particle.magneticMoment;
          const momentDotR = moment[0] * rx + moment[1] * ry + moment[2] * rz;
          const bScale = magneticCouplingScale;
          const bDipoleScale = bScale * SIMULATION_UNITS.magneticMoment /
            (SIMULATION_UNITS.charge * SIMULATION_UNITS.velocity * SIMULATION_UNITS.length);
          const bMotionScale = bScale * charge;
          bx += bMotionScale * qvx * inverseR3 + bDipoleScale * (3 * rx * momentDotR * inverseR5 - moment[0] * inverseR3);
          by += bMotionScale * qvy * inverseR3 + bDipoleScale * (3 * ry * momentDotR * inverseR5 - moment[1] * inverseR3);
          bz += bMotionScale * qvz * inverseR3 + bDipoleScale * (3 * rz * momentDotR * inverseR5 - moment[2] * inverseR3);
        }
        const eMagnitude = Math.hypot(ex, ey, ez), bMagnitude = Math.hypot(bx, by, bz);
        electricPeak = Math.max(electricPeak, eMagnitude);
        magneticPeak = Math.max(magneticPeak, bMagnitude);
        rows.push({
          id:`field-${rowNumber}`, __rowNumber:rowNumber, label:`Field sample ${rowNumber}`,
          x, y, z, electricX:ex, electricY:ey, electricZ:ez, magneticX:bx, magneticY:by, magneticZ:bz,
          electricMagnitude:eMagnitude, magneticMagnitude:bMagnitude,
        });
        rowNumber++;
      }
    }
  }
  const electricScale = Math.max(electricPeak, Number.MIN_VALUE);
  const magneticScale = Math.max(magneticPeak, Number.MIN_VALUE);
  return rows.map(row => ({
    ...row,
    ex:row.electricX / electricScale, ey:row.electricY / electricScale, ez:row.electricZ / electricScale,
    bx:row.magneticX / magneticScale, by:row.magneticY / magneticScale, bz:row.magneticZ / magneticScale,
    electricMagnitude:row.electricMagnitude / electricScale,
    magneticMagnitude:row.magneticMagnitude / magneticScale,
    electricMagnitudeVPerM:row.electricMagnitude *
      E_FIELD_UNIT,
    electricX_VPerM:row.electricX * E_FIELD_UNIT, electricY_VPerM:row.electricY * E_FIELD_UNIT, electricZ_VPerM:row.electricZ * E_FIELD_UNIT,
    magneticMagnitudeTesla:row.magneticMagnitude * B_FIELD_UNIT,
    magneticX_Tesla:row.magneticX * B_FIELD_UNIT, magneticY_Tesla:row.magneticY * B_FIELD_UNIT, magneticZ_Tesla:row.magneticZ * B_FIELD_UNIT,
  }));
}

export function fieldRowsForComponent(rows, component) {
  const electric = component === "electric";
  const suffix = electric ? "e" : "b";
  return rows.map(row => ({
    ...row,
    u:row[`${suffix}x`], v:row[`${suffix}y`], w:row[`${suffix}z`],
    value:row[`${component}Magnitude`],
  }));
}
