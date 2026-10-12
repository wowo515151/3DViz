# 3DViz

**GitHub Pages:** [wowo515151.github.io/3DViz](https://wowo515151.github.io/3DViz/)

**Development status:** 3DViz is under active development. Apps and scientific visualizations may change as they are reviewed and refined.

**Status — 2026-10-12:** Weather, Science, and SpinParticle are beta apps. Geometry explores repeating particle arrangements, and 4D Solutions is a curated catalog of named exact Maxwell and Einstein–Maxwell families. Its live field renderer currently covers flat-spacetime solutions; curved entries are symbolic references. The repository also contains a reusable Three.js plotter library. Beta status describes functioning code; it does not imply calibrated scientific results. The CSV and live weather-signal development tools remain under the workspace's `Tools/` directory and import this repository's library.

3DViz is a collection of interactive 3D visualizations for science, technology, and multidimensional data. The home page is a small animated introduction with links to the available apps. It is not itself a visualization app.

## Apps

- **Weather in 3D:** open [`apps/weather/3dWeather.html`](apps/weather/3dWeather.html). It uses the public Environment and Climate Change Canada City Page Weather API. The service is experimental and may change. The page includes the source and licence attribution.
- **Science in 3D:** open [`apps/science/3dScience.html`](apps/science/3dScience.html). It demonstrates the shared plotters with a normalized dipole electromagnetic field. Its implementation requirements are documented in [`apps/science/3dScienceSpec.txt`](apps/science/3dScienceSpec.txt).
- **SpinParticle:** open [`apps/spin-particle/3dSpinParticle.html`](apps/spin-particle/3dSpinParticle.html). It demonstrates an N-body point-particle model initialized with CODATA electron and proton properties. SI values are converted to stable atomic-scale simulation units.
- **Geometry:** open [`apps/geometry/3dGeometry.html`](apps/geometry/3dGeometry.html). It explores the 14 Bravais lattice types and nine related crystal structure motifs with an adjustable supercell, including perovskite cages, tetragonal channels, and tetrahedral cages. Download a PNG of the current view with its geometry legend. These are common geometric forms seen in crystals, shown as idealized point arrangements rather than external crystal shapes or specific materials. References include the [International Union of Crystallography](https://www.iucr.org/who-we-are/commissions/commission-on-crystallographic-nomenclature/published-reports/bravais), [OpenStax](https://openstax.org/books/chemistry/pages/10-6-lattice-structures-in-crystalline-solids), [International Zeolite Association](https://www.iza-structure.org/databases/DatabaseHelp_Structures.php), and a [review of tetragonal channel topology](https://pmc.ncbi.nlm.nih.gov/articles/PMC3895978/).
- **4D Solutions:** open [`apps/solutions/4dSolutions.html`](apps/solutions/4dSolutions.html). Its searchable catalog contains 50 entries across general analytic representations, named flat-space fields, exact structured and accelerating beams, localized pulses, curved Einstein–Maxwell electrovacua (including product geometries, black-hole branches, wave families, and Ernst–Harrison solution generators), and exact curved-coordinate Maxwell fields. Six flat-space fields have live vector samplers; those with spatially varying magnitudes also support adjustable isosurfaces. Other entries show symbolic forms and source references without claiming a flat-space rendering. The catalog represents broad solution-generating families; arbitrary spectra, potentials, multipole coefficients, and analytic initial data make the full solution space infinite-dimensional.
- **Plotter library:** reusable bar, scatter, histogram, surface, trajectory, vector-field cone, ConeIso, time-slice, and isosurface plotters are included in the library. The CSV explorer UI remains a local development tool under `Tools/3dCsv/`.

## Layout

- `index.html` and `style.css`: animated, responsive GitHub Pages landing page.
- `apps/weather/`: Weather beta UI, data normalization, and the city-temperature plotter.
- `apps/science/`: dipole-field plotter demo, application spec, and implementation task list.
- `apps/spin-particle/`: N-body particle model, Three.js plotter adapter, science-inspired app UI, and unit tests.
- `apps/geometry/`: geometric arrangement definitions, reusable instanced-sphere plotter, and supercell/configuration controls. The interactive viewer presents common geometric forms seen in crystals, including 14 Bravais lattices and nine related structure motifs; it does not represent specific chemicals.
- `apps/solutions/`: searchable 50-entry catalog of analytic Maxwell and Einstein–Maxwell representations/families, symbolic formulas and references, six live flat-space samplers, and field-magnitude isosurface controls.
- `library/three-viz/src/`: shared browser visualization library, including its individual plotters, ConeIso facet sampling, and common wireframe/isosurface helpers.
- `library/three-viz/tests/`: development tests for the library; not loaded by the website.
- `LICENSE`: MIT License for this repository.

The Weather app imports the library from this repository. The CSV and weather-signal tools served from the `Sites` workspace use relative paths to this same library folder. Three.js 0.186.0 and its OrbitControls addon load from the pinned jsDelivr URLs in the Weather page's import map; no Three.js source is vendored here. The library test double is local development code.

SpinParticle uses the same pinned Three.js 0.186.0 runtime URLs as the other apps. It uses electron/proton mass, charge, magnetic moment, and gyromagnetic ratio values from CODATA 2022, then converts them to internal units of Å, 10⁶ m/s, and 0.1 fs. Coupling sliders scale the SI-derived Coulomb and magnetic coefficients. The hydrogenic presets are classical initial conditions rather than quantum states. Softening is artificial; the model omits retardation, radiation, induced electric fields, and relativistic effects.

## Run locally

Serve the repository root with any static HTTP server, then open `/` for the landing page, `/apps/weather/3dWeather.html` for Weather, `/apps/science/3dScience.html` for Science, `/apps/spin-particle/3dSpinParticle.html` for SpinParticle, or `/apps/geometry/3dGeometry.html` for the Geometry explorer. The browser needs network access to jsDelivr for Three.js; Weather also uses the ECCC API when its snapshot is unavailable.

To run the library's dependency-free tests from the repository root:

```text
node --test library/three-viz/tests/backend.test.js
```

To run the SpinParticle unit tests:

```text
node --test apps/spin-particle/tests/*.test.js
```

To run the Geometry bond-coverage tests:

```text
node --test apps/geometry/geometry-model.test.mjs
node --test apps/geometry/geometry-lines.test.mjs
node --test apps/geometry/geometry-ui.test.mjs
```

## Attribution and contact

Weather data is provided by Environment and Climate Change Canada under its [Open Data Licence](https://eccc-msc.github.io/open-data/licence/readme_en/). Three.js is provided at runtime by jsDelivr; see the [Three.js project and licence](https://github.com/mrdoob/three.js/blob/dev/LICENSE). The visible **Contact the Developer** links lead to [Warren Harding's LinkedIn profile](https://www.linkedin.com/in/warren-harding-29a0a673/).

## License

The code in this repository is released under the [MIT License](LICENSE).
