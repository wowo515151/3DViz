export const GEOMETRY_CONFIGURATIONS = Object.freeze([
  { id:"cp", name:"Primitive cubic", group:"Cubic", note:"One lattice point per cell", lattice:[[1,0,0],[0,1,0],[0,0,1]], basis:[[0,0,0]], glyph:"cube" },
  { id:"ci", name:"Body-centered cubic", group:"Cubic", note:"Corner and body-center points", lattice:[[1,0,0],[0,1,0],[0,0,1]], basis:[[0,0,0],[.5,.5,.5]], glyph:"cube" },
  { id:"cf", name:"Face-centered cubic", group:"Cubic", note:"Corner and face-center points", lattice:[[1,0,0],[0,1,0],[0,0,1]], basis:[[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0]], glyph:"cube" },
  { id:"tp", name:"Primitive tetragonal", group:"Tetragonal", note:"Rectangular cell with a square base", lattice:[[1,0,0],[0,.74,0],[0,0,1]], basis:[[0,0,0]], glyph:"cube" },
  { id:"ti", name:"Body-centered tetragonal", group:"Tetragonal", note:"Tetragonal cell plus body center", lattice:[[1,0,0],[0,.74,0],[0,0,1]], basis:[[0,0,0],[.5,.5,.5]], glyph:"cube" },
  { id:"op", name:"Primitive orthorhombic", group:"Orthorhombic", note:"Three unequal perpendicular axes", lattice:[[1,0,0],[0,.78,0],[0,0,.62]], basis:[[0,0,0]], glyph:"cube" },
  { id:"oc", name:"Base-centered orthorhombic", group:"Orthorhombic", note:"Orthorhombic cell with base centers", lattice:[[1,0,0],[0,.78,0],[0,0,.62]], basis:[[0,0,0],[.5,.5,0]], glyph:"cube" },
  { id:"oi", name:"Body-centered orthorhombic", group:"Orthorhombic", note:"Orthorhombic cell plus body center", lattice:[[1,0,0],[0,.78,0],[0,0,.62]], basis:[[0,0,0],[.5,.5,.5]], glyph:"cube" },
  { id:"of", name:"Face-centered orthorhombic", group:"Orthorhombic", note:"Orthorhombic cell with face centers", lattice:[[1,0,0],[0,.78,0],[0,0,.62]], basis:[[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0]], glyph:"cube" },
  { id:"mp", name:"Primitive monoclinic", group:"Monoclinic", note:"One oblique angle in the cell", lattice:[[1,0,0],[0,.82,0],[.34,0,.78]], basis:[[0,0,0]], glyph:"cube" },
  { id:"mc", name:"Base-centered monoclinic", group:"Monoclinic", note:"Oblique cell with base centers", lattice:[[1,0,0],[0,.82,0],[.34,0,.78]], basis:[[0,0,0],[.5,.5,0]], glyph:"cube" },
  { id:"ap", name:"Primitive triclinic", group:"Triclinic", note:"Three unequal, oblique axes", lattice:[[1,0,0],[.22,.91,0],[.18,.26,.84]], basis:[[0,0,0]], glyph:"cube" },
  { id:"hp", name:"Primitive hexagonal", group:"Hexagonal", note:"Triangular layers stacked in space", lattice:[[1,0,0],[.5,0,.8660254],[0,1.42,0]], basis:[[0,0,0]], glyph:"hex" },
  { id:"hr", name:"Rhombohedral", group:"Rhombohedral", note:"Three points in a hexagonal setting", lattice:[[1,0,0],[.5,0,.8660254],[0,1.42,0]], basis:[[0,0,0],[2/3,1/3,1/3],[1/3,2/3,2/3]], glyph:"hex" },
  { id:"hcp", name:"Hexagonal close-packed", group:"Related patterns", note:"Close-packed layers in an AB sequence", lattice:[[1,0,0],[.5,0,.8660254],[0,1.63299,0]], basis:[[0,0,0],[1/3,1/3,.5]], glyph:"hex" },
  { id:"diamond", name:"Diamond cubic", group:"Related patterns", note:"Two interleaved tetrahedral motifs", lattice:[[1,0,0],[0,1,0],[0,0,1]], basis:[[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0],[.25,.25,.25],[.25,.75,.75],[.75,.25,.75],[.75,.75,.25]], glyph:"cube" },
  { id:"kagome", name:"Kagome layers", group:"Related patterns", note:"Three-point triangular net repeated by layer", lattice:[[1,0,0],[.5,0,.8660254],[0,1.55,0]], basis:[[0,0,0],[.5,0,0],[0,.5,0]], glyph:"layer" },
  { id:"hex-diamond", name:"Hexagonal diamond (lonsdaleite)", group:"Related patterns", note:"Four-connected net with ABAB stacking", lattice:[[1,0,0],[.5,0,.8660254],[0,1.63299,0]], basis:[[1/3,1/3,0],[2/3,2/3,.5],[1/3,1/3,.375],[2/3,2/3,.875]], glyph:"hex" },
  { id:"fluorite", name:"Fluorite arrangement", group:"Related patterns", note:"FCC points with tetrahedral sites filled", lattice:[[1,0,0],[0,1,0],[0,0,1]], basis:[[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0],[.25,.25,.25],[.25,.25,.75],[.25,.75,.25],[.75,.25,.25],[.75,.75,.25],[.75,.25,.75],[.25,.75,.75],[.75,.75,.75]], glyph:"cube" },
  { id:"corner-octahedra", name:"Corner-sharing octahedra", group:"Related patterns", note:"Repeated octahedral framework", lattice:[[1,0,0],[0,1,0],[0,0,1]], basis:[[.5,.5,.5],[.5,.5,0],[.5,0,.5],[0,.5,.5]], glyph:"cube" },
  { id:"perovskite-cage", name:"Perovskite cage framework", group:"Related patterns", note:"Corner-sharing octahedra around a cubic cage site", lattice:[[1,0,0],[0,1,0],[0,0,1]], basis:[[0,0,0],[.5,.5,.5],[.5,.5,0],[.5,0,.5],[0,.5,.5]], glyph:"cube" },
  { id:"bronze-channels", name:"Tetragonal bronze channels", group:"Related patterns", note:"Square and pentagonal channels in a tetragonal net", lattice:[[1,0,0],[0,1,0],[0,0,.32]], basis:[[0,0,0],[.5,.5,.5],[.07,.21,.5],[.79,.07,.5],[.93,.79,.5],[.21,.93,.5],[.43,.71,0],[.71,.43,0],[.57,.29,0],[.29,.57,0]], glyph:"layer" },
  { id:"zeolite-cages", name:"Zeolite-style cage framework", group:"Related patterns", note:"SOD-type four-connected net enclosing repeating cages", lattice:[[1,0,0],[0,1,0],[0,0,1]], basis:[[.25,.5,0],[.75,.5,0],[0,.25,.5],[0,.75,.5],[.5,0,.25],[.5,0,.75],[.25,0,.5],[.75,0,.5],[.5,.25,0],[.5,.75,0],[0,.5,.25],[0,.5,.75]], glyph:"hex" },
]);

const squaredDistance = (left, right) => (left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2 + (left[2] - right[2]) ** 2;

function cartesianPosition(lattice, fractional) {
  return [0, 1, 2].map(axis => lattice.reduce((sum, vector, index) => sum + vector[axis] * fractional[index], 0));
}

function threeDimensionalNeighborShells(configuration) {
  const candidates = [];
  for (let i = -1; i <= 1; i += 1) {
    for (let j = -1; j <= 1; j += 1) {
      for (let k = -1; k <= 1; k += 1) {
        for (const from of configuration.basis) {
          for (const to of configuration.basis) {
            const fractional = [i + to[0] - from[0], j + to[1] - from[1], k + to[2] - from[2]];
            if (fractional.every(value => Math.abs(value) < 1e-10)) continue;
            const displacement = cartesianPosition(configuration.lattice, fractional);
            candidates.push({ distanceSquared: squaredDistance(displacement, [0, 0, 0]), displacement });
          }
        }
      }
    }
  }

  const shells = [];
  for (const candidate of candidates.sort((left, right) => left.distanceSquared - right.distanceSquared)) {
    const shell = shells.at(-1);
    if (!shell || Math.abs(candidate.distanceSquared - shell.distanceSquared) > Math.max(candidate.distanceSquared, shell.distanceSquared) * 1e-5) {
      shells.push({ distanceSquared: candidate.distanceSquared, displacements: [candidate.displacement] });
    } else {
      shell.displacements.push(candidate.displacement);
    }
  }

  const independentDirections = [];
  const selectedShells = [];
  for (const shell of shells) {
    const additions = [];
    for (const displacement of shell.displacements) {
      const residual = displacement.slice();
      for (const direction of [...independentDirections, ...additions]) {
        const projection = residual.reduce((sum, value, axis) => sum + value * direction[axis], 0);
        for (let axis = 0; axis < 3; axis += 1) residual[axis] -= projection * direction[axis];
      }
      const length = Math.hypot(...residual);
      if (length > Math.sqrt(shell.distanceSquared) * 1e-8) additions.push(residual.map(value => value / length));
      if (independentDirections.length + additions.length === 3) break;
    }
    if (additions.length === 0) continue;
    selectedShells.push(shell.distanceSquared);
    independentDirections.push(...additions);
    if (independentDirections.length === 3) return selectedShells;
  }
  return selectedShells;
}

export function createGeometryLayout(configuration, supercell, particleRadius = 0.17) {
  if (!Number.isInteger(supercell) || supercell < 1) throw new RangeError("Supercell size must be a positive integer.");
  if (!Number.isFinite(particleRadius) || particleRadius < 0) throw new RangeError("Particle radius must be a finite, non-negative number.");
  const basisCenter = configuration.basis.reduce((sum, basis) => sum.map((value, axis) => value + basis[axis]), [0, 0, 0])
    .map(value => value / configuration.basis.length);
  const center = basisCenter.map(value => value + (supercell - 1) / 2);
  const positions = [];
  for (let i = 0; i < supercell; i += 1) {
    for (let j = 0; j < supercell; j += 1) {
      for (let k = 0; k < supercell; k += 1) {
        for (const basis of configuration.basis) {
          const fractional = [i + basis[0] - center[0], j + basis[1] - center[1], k + basis[2] - center[2]];
          positions.push(cartesianPosition(configuration.lattice, fractional));
        }
      }
    }
  }

  const neighborDistanceShellsSquared = threeDimensionalNeighborShells(configuration);
  const bondPairs = [];
  const bondSegments = [];
  for (let from = 0; from < positions.length; from += 1) {
    for (let to = from + 1; to < positions.length; to += 1) {
      const distanceSquared = squaredDistance(positions[from], positions[to]);
      if (neighborDistanceShellsSquared.some(shell => Math.abs(distanceSquared - shell) <= shell * 1e-5)) {
        bondPairs.push([from, to]);
        const distance = Math.sqrt(squaredDistance(positions[from], positions[to]));
        const trim = particleRadius / distance;
        const start = positions[from].map((value, axis) => value + (positions[to][axis] - value) * trim);
        const end = positions[to].map((value, axis) => value - (value - positions[from][axis]) * trim);
        bondSegments.push({ from, to, start, end });
      }
    }
  }
  return { positions, bondPairs, bondSegments, neighborDistanceShellsSquared };
}
