# SpinParticle

SpinParticle is a browser-side N-body component and an interactive Three.js demo. `spin-particle.js` contains the reusable pairwise solver; `spin-particle-si.js` defines the CODATA 2022 electron/proton values and the SI/unit conversions; `spin-particle-plotter.js` adapts the model to the shared 3DViz viewer; `3dSpinParticle.js` handles UI controls and deterministic hydrogenic starting configurations. The app uses the repository's pinned Three.js 0.186.0/jsDelivr import-map runtime. No source or executable dependency is vendored.

## Physical values and units

The preset particles use measured 2022 CODATA values. Electron charge is negative; the signed electron gyromagnetic ratio and magnetic moment are negative relative to spin angular momentum. Proton values are positive.

| Quantity | Electron | Proton |
| --- | ---: | ---: |
| Mass | `9.1093837139e-31 kg` | `1.67262192595e-27 kg` |
| Charge | `-1.602176634e-19 C` | `+1.602176634e-19 C` |
| Magnetic moment magnitude | `9.2847646917e-24 J/T` | `1.41060679545e-26 J/T` |
| Signed gyromagnetic ratio | `-1.76085962784e11 s⁻¹/T` | `+2.6752218708e8 s⁻¹/T` |

The solver uses dimensionless values derived from SI scales: length `1e-10 m` (1 Å), time `1e-16 s` (0.1 fs), mass `mₑ`, charge `e`, velocity `1e6 m/s`, and magnetic moment `e·L²/T`. The displayed selection details convert the six fields back to SI, with position shown in Å. Time is displayed in femtoseconds. The particle markers have equal size; magnetic-moment glyphs show direction only because the electron and proton moments differ by about 658×.

Electric and magnetic interactions use the SI-derived baseline coefficients. The softening-length control is in Å and changes the point-particle force kernel.

The Hydrogenic cloud uses the selected particle count; Single electron–proton pair always shows one pair centered at the origin. Pair centers use a seeded random layout with at least 3 Å between centers. The particles in each pair start 2.4 Bohr radii apart, with reduced-mass circular-orbit velocities adjusted for that radius. These are illustrative classical initial conditions, not quantum hydrogen states or stable predictions of atomic structure.

## Live field views

The Science UI's spatial field plotters are available for SpinParticle: vector cones, isosurfaces, and ConeIso facet cones. Electric and magnetic components can be toggled independently for vector fields and isosurfaces. Field samples are recomputed from the current particle positions, velocities, charges, and permanent magnetic moments as the simulation steps, with a short refresh interval during playback. Electric fields sum softened Coulomb source fields; magnetic fields sum moving-charge and permanent-dipole fields. These are quasi-static snapshots without radiation or retardation.

Each component is normalized independently to make its shape visible. Select a field glyph or surface to inspect the local vector and magnitude in SI units. Shared controls include grid resolution, shell threshold, multiple shells, solid surfaces, wireframes, surface count, and wireframe tube radius. Electromagnetic wave controls are not part of the simulator.

Every particle also shows its net electric-force cone (red) and net magnetic-force cone (blue). Electric cones contain the Coulomb contribution; magnetic cones contain Lorentz and magnetic-energy-gradient contributions. Cone lengths are normalized independently within each force type, with the strongest force reaching 0.4 Å, so lengths compare particles for the same force type rather than electric force against magnetic force. Each cone base sits at its particle's surface and points along its net force.

The field grid spans ±5.5 Å to cover both presets. The vector-size sliders scale vector-field and ConeIso arrows independently; vector peak height defaults to 0.5 Å and uses a compressed magnitude scale to keep weaker arrows visible, while ConeIso peak height defaults to 0.33 Å. The shared isosurface plotter's ±2.5 output bounds are expanded to match the field grid.

## Interactions and limits

For displacement `r = x_target - x_source` and softening length `a`, the solver uses `s² = |r|² + a²`. It sums Coulomb forces proportional to `q_i q_j r / s³`; magnetic fields from moving charges proportional to `q_j (v_j × r) / s³`; dipole fields proportional to `3 r (μ_j · r) / s⁵ - μ_j / s³`; magnetic Lorentz force `q_i v_i × B`; and force from the local magnetic energy gradient `∇(μ_i · B)`. Moments evolve using the specified `dμ/dt = γ(μ × B)` law. Classical fourth-order Runge–Kutta advances translation and moment direction, then preserves each initial moment magnitude.

The solver is instantaneous and nonrelativistic. It omits field retardation, radiation, induced electric fields, self-fields, contact/collision dynamics, electric dipoles, and quantum effects. Softening regularizes close encounters; it does not represent finite-sized particles. Since field momentum and retardation are omitted, particle-only momentum and energy are not guaranteed to be conserved.

## Run and test

Serve the repository root over HTTP, then open `apps/spin-particle/3dSpinParticle.html`. The browser needs access to the same pinned jsDelivr Three.js runtime as the other 3DViz apps.

Run all dependency-free SpinParticle tests from the repository root:

```text
node --test apps/spin-particle/tests/*.test.js
```

The formulas use standard Coulomb/Lorentz, Biot–Savart, and magnetic dipole conventions; the spin-precession sign follows the supplied specification. Constants: [NIST CODATA 2022 electron mass, magnetic moment, and gyromagnetic ratio](https://physics.nist.gov/cuu/pdf/JPCRD2022CODATA.pdf), [proton mass](https://physics.nist.gov/cgi-bin/cuu/Value?mp%7Csearch_for=mass+proton), [proton magnetic moment](https://physics.nist.gov/cgi-bin/cuu/Value?mup%7Csearch_for=magnetic+moment), [proton gyromagnetic ratio](https://physics.nist.gov/cgi-bin/cuu/Value?gammap%7Csearch_for=ratio), and [elementary charge](https://physics.nist.gov/cuu/Constants/Value/e.html). Formula references: [OpenStax University Physics Vol. 2, Chapter 11 key equations](https://openstax.org/books/university-physics-volume-2/pages/11-key-equations), [Chapter 12 Biot–Savart law](https://openstax.org/books/university-physics-volume-2/pages/12-1-the-biot-savart-law), and [Chapter 12 moving point-charge field](https://openstax.org/books/university-physics-volume-2/pages/12-additional-problems).
