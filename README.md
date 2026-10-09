# 3DViz

**Status — 2026-10-09:** The repository contains a reusable Three.js plotter library and a Weather preview app. The CSV and live weather-signal development tools remain under the workspace's `Tools/` directory and import this repository's library.

3DViz is a collection of interactive 3D visualizations for science, technology, and multidimensional data. The home page is a small animated introduction with links to the available apps. It is not itself a visualization app.

## Apps

- **Weather in 3D:** open [`apps/weather/3dWeather.html`](apps/weather/3dWeather.html). It uses the public Environment and Climate Change Canada City Page Weather API. The service is experimental and may change. The page includes the source and licence attribution.
- **CSV plotters:** reusable bar, scatter, histogram, surface, trajectory, vector-field, time-slice, and isosurface plotters are included in the library. The CSV explorer UI remains a local development tool under `Tools/3dCsv/`.

## Layout

- `index.html` and `style.css`: animated, responsive GitHub Pages landing page.
- `apps/weather/`: Weather preview UI, data normalization, and the city-temperature plotter.
- `library/three-viz/src/`: shared browser visualization library, including its individual plotters and common wireframe/isosurface helpers.
- `library/three-viz/tests/`: development tests for the library; not loaded by the website.
- `LICENSE`: MIT License for this repository.

The Weather app imports the library from this repository. The CSV and weather-signal tools served from the `Sites` workspace use relative paths to this same library folder. Three.js 0.186.0 and its OrbitControls addon load from the pinned jsDelivr URLs in the Weather page's import map; no Three.js source is vendored here. The library test double is local development code.

## Run locally

Serve the repository root with any static HTTP server, then open `/` for the landing page or `/apps/weather/3dWeather.html` for the Weather app. The browser needs network access to jsDelivr and the ECCC API for the live forecast.

To run the library's dependency-free tests from the repository root:

```text
node --test library/three-viz/tests/backend.test.js
```

## Attribution and contact

Weather data is provided by Environment and Climate Change Canada under its [Open Data Licence](https://eccc-msc.github.io/open-data/licence/readme_en/). Three.js is provided at runtime by jsDelivr; see the [Three.js project and licence](https://github.com/mrdoob/three.js/blob/dev/LICENSE). The visible **Contact the Developer** links lead to [Warren Harding's LinkedIn profile](https://www.linkedin.com/in/warren-harding-29a0a673/).

## License

The code in this repository is released under the [MIT License](LICENSE).
