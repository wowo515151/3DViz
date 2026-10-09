import { createLabeledBox } from "../../library/three-viz/src/index.js?v=cube-box-20261009b";

const CUBE_SIZE = 20;
const HALF = CUBE_SIZE / 2;

export const cityTemperatureAdapter = Object.freeze({
  capabilities: Object.freeze(["selection"]),
  create(context, _definition, input) {
    const { THREE, scene, resources } = context;
    const cities = input.cities ?? [];
    const timestamps = input.timestamps ?? [];
    const unit = input.unit ?? "C";
    const laneCount = Math.max(1, cities.length);
    const hourCount = Math.max(1, timestamps.length);
    const [dataMin, dataMax] = input.temperatureRange ?? [-40, 40];
    const safeMin = Number.isFinite(dataMin) ? dataMin : -40;
    const safeMax = Number.isFinite(dataMax) ? dataMax : 40;
    const tempMin = safeMin === safeMax ? safeMin - 0.5 : safeMin;
    const tempMax = safeMin === safeMax ? safeMax + 0.5 : safeMax;
    const x = index => hourCount === 1 ? 0 : -HALF + (index / (hourCount - 1)) * CUBE_SIZE;
    // West-to-east indices descend in depth, putting Vancouver at the near-left corner.
    const z = lane => laneCount === 1 ? 0 : HALF - (lane / (laneCount - 1)) * CUBE_SIZE;
    const y = value => tempMin === tempMax ? 0 : -HALF + ((value - tempMin) / (tempMax - tempMin)) * CUBE_SIZE;
    const root = new THREE.Group(); root.name = "canadian-city-hourly-temperatures"; scene.add(root);
    const hemi = new THREE.HemisphereLight(0xb7dcff, 0x10151c, 1.3);
    const keyLight = new THREE.DirectionalLight(0xf1f8ff, 1.5); keyLight.position.set(-5, 12, 7);
    const rimLight = new THREE.DirectionalLight(0x6b9dff, 0.5); rimLight.position.set(8, 4, -9);
    scene.add(hemi, keyLight, rimLight);

    // Three square grids and an outline make the shared x/time, y/temperature, z/city cube explicit.
    const addGrid = (rotation, position) => {
      const grid = new THREE.GridHelper(CUBE_SIZE, 20, 0x8198aa, 0x526678);
      grid.rotation.set(...rotation); grid.position.set(...position); grid.material.transparent = true; grid.material.opacity = 0.2;
      grid.raycast = () => {}; scene.add(grid);
      resources.track(grid.geometry);
      if (Array.isArray(grid.material)) grid.material.forEach(resources.track); else resources.track(grid.material);
    };
    addGrid([0, 0, 0], [0, -HALF, 0]);
    addGrid([Math.PI / 2, 0, 0], [0, 0, -HALF]);
    addGrid([0, 0, Math.PI / 2], [-HALF, 0, 0]);
    const pointRecords = [];
    cities.forEach((city, lane) => city.forecasts.forEach((forecast, hour) => {
      if (!Number.isFinite(forecast.value)) return;
      pointRecords.push({ city, forecast, hour, lane, x:x(hour), y:y(forecast.value), z:z(lane) });
    }));
    const markerGeometry = resources.track(new THREE.SphereGeometry(0.11, 14, 10));
    const markerMaterial = resources.track(new THREE.MeshStandardMaterial({ color:0x080b0e, metalness:0.05, roughness:0.36 }));
    const markers = new THREE.InstancedMesh(markerGeometry, markerMaterial, pointRecords.length);
    markers.name = "city-temperature-markers";
    const markerTransform = new THREE.Object3D();
    pointRecords.forEach((point, index) => {
      markerTransform.position.set(point.x, point.y, point.z); markerTransform.updateMatrix();
      markers.setMatrixAt(index, markerTransform.matrix);
    });
    markers.instanceMatrix.needsUpdate = true; markers.computeBoundingSphere(); root.add(markers);

    cities.forEach((city, lane) => {
      const valid = city.forecasts.flatMap((forecast, hour) => Number.isFinite(forecast.value) ? [new THREE.Vector3(x(hour), y(forecast.value), z(lane))] : []);
      if (valid.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(valid);
        const color = city.color ?? 0x9bdcff;
        const material = resources.track(new THREE.MeshStandardMaterial({ color, metalness:0.08, roughness:0.32, emissive:color, emissiveIntensity:0.07 }));
        const tube = new THREE.Mesh(resources.track(new THREE.TubeGeometry(curve, Math.max(30, valid.length * 6), 0.035, 7, false)), material);
        tube.name = `temperature-line-${city.id}`; tube.raycast = () => {}; root.add(tube);
      }

      // Matching city tabs bracket the line at its first and last forecast hour.
      const cityColor = city.color ?? 0x9bdcff;
      for (const [hour, side] of [[0, "start"], [hourCount - 1, "end"]]) {
        const label = createLabeledBox(context, `${city.name}, ${city.province}`, cityColor, { fontSize:22, worldUnitsPerPixel:0.02, paddingX:7, paddingY:4 });
        const labelWidth = label.userData.labeledBoxSize.width;
        const endpoint = city.forecasts.findLast(forecast => Number.isFinite(forecast.value));
        const endpointForecast = side === "start" ? city.forecasts.find(forecast => Number.isFinite(forecast.value)) : endpoint;
        const endpointY = endpointForecast ? y(endpointForecast.value) : -HALF;
        const labelY = endpointY + (endpointY > HALF - 1 ? -0.65 : 0.65);
        label.position.set(x(hour) + (side === "start" ? -labelWidth / 2 - 0.18 : labelWidth / 2 + 0.18), labelY, z(lane));
        label.name = `city-label-${side}-${city.id}`; label.raycast = () => {}; root.add(label);
      }
    });

    // A compact color-backed label sits by each black node and remains camera-facing.
    const pointLabels = [];
    pointRecords.forEach(point => {
      const value = `${Number(point.forecast.value.toFixed(1))}°`;
      const label = createLabeledBox(context, value, point.city.color ?? 0x9bdcff, {
        fontSize:20, worldUnitsPerPixel:0.016, paddingX:5, paddingY:3, depth:0.04,
      });
      label.position.set(point.x, point.y + (point.y > HALF - 0.75 ? -0.3 : 0.3), point.z);
      label.userData.temperaturePoint = point;
      label.name = `temperature-label-${point.city.id}-${point.hour}`;
      root.add(label); pointLabels.push(label);
    });

    return {
      capabilities:["selection"], update() {},
      describeSelection(hit) {
        const point = hit.object?.userData?.temperaturePoint ?? pointRecords[hit.instanceId];
        if (!point) return null;
        const stamp = new Date(point.forecast.timestamp);
        const time = Number.isNaN(stamp.valueOf()) ? point.forecast.timestamp : new Intl.DateTimeFormat("en-CA", { timeZone:"UTC", weekday:"short", hour:"numeric", minute:"2-digit", timeZoneName:"short" }).format(stamp);
        return { label:`${point.city.name}, ${point.city.province}`, values:{ forecast:time, temperature:`${Number(point.forecast.value.toFixed(1))} °${unit}`, region:point.city.region } };
      },
      dispose() {
        scene.remove(root, hemi, keyLight, rimLight);
        hemi.dispose?.(); keyLight.dispose?.(); rimLight.dispose?.();
      },
    };
  },
});
