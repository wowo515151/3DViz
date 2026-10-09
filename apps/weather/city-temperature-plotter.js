import { createGrid3D, createLabeledBox } from "../../library/three-viz/src/index.js?v=forecast-labels-20261009k";

const CUBE_SIZE = 20;
const HALF = CUBE_SIZE / 2;
const compactCityCodes = Object.freeze({
  "Prince George":"PGE", "Greater Sudbury":"GSU", "Kitchener-Waterloo":"KW", "Thunder Bay":"THB",
  "Trois-Rivières":"TRI", "Saint John":"SAJ", "St. John's":"STJ", Winnipeg:"WPG", Windsor:"WND",
  Montréal:"MTL", Moncton:"MCT",
});
function cityEdgeLabel(city) {
  const code = compactCityCodes[city.name]
    ?? city.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase();
  return code;
}

export const cityTemperaturePlotter = Object.freeze({
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

    const axisLabels = (values, count, format) => {
      if (!values.length) return [];
      const labelCount = Math.min(values.length, count);
      return Array.from({ length:labelCount }, (_, slot) => {
        const index = labelCount === 1 ? 0 : Math.round(slot * (values.length - 1) / (labelCount - 1));
        const position = values.length === 1 ? 0 : -HALF + (index / (values.length - 1)) * CUBE_SIZE;
        return { text:format(values[index], index), position, key:index };
      });
    };
    const axisGrid = createGrid3D(context, {
      size:CUBE_SIZE,
      divisions:20,
      xLabels:axisLabels(timestamps, 5, value => new Intl.DateTimeFormat("en-CA", { timeZone:"UTC", hour:"numeric" }).format(new Date(value))),
      yLabels:axisLabels(Array.from({ length:5 }, (_, index) => tempMin + (index / 4) * (tempMax - tempMin)), 5, value => `${Number(value.toFixed(1))}°${unit}`),
      zLabels:[...cities].reverse().map((city, index) => ({
        text:laneCount > 15 ? cityEdgeLabel(city) : `${city.name}, ${city.province}`,
        position:laneCount === 1 ? 0 : -HALF + (index / (laneCount - 1)) * CUBE_SIZE,
        key:city.id,
        color:city.color,
        ...(laneCount > 15 ? { fontSize:16, worldUnitsPerPixel:0.01, paddingX:3, paddingY:2 } : {}),
      })),
      labelColor:0x778b98,
      labelFontSize:18,
      labelWorldUnitsPerPixel:0.014,
      labelPaddingX:5,
      labelPaddingY:3,
      labelGap:0.04,
      xLabelGap:0,
      yLabelGap:0,
      zLabelGap:0.04,
      gridColor:0x354351,
      majorGridColor:0x526678,
      opacity:0.2,
    });
    root.add(axisGrid.object3D);
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

    });

    // A compact color-backed label sits by each black node and remains camera-facing.
    pointRecords.forEach(point => {
      const value = `${Number(point.forecast.value.toFixed(1))}°`;
      const label = createLabeledBox(context, value, point.city.color ?? 0x9bdcff, {
        fontSize:20, worldUnitsPerPixel:0.016, paddingX:5, paddingY:3, depth:0.04,
      });
      label.position.set(point.x, point.y + (point.y > HALF - 0.75 ? -0.3 : 0.3), point.z);
      label.userData.temperaturePoint = point;
      label.name = `temperature-label-${point.city.id}-${point.hour}`;
      root.add(label);
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
        axisGrid.dispose();
        scene.remove(root, hemi, keyLight, rimLight);
        hemi.dispose?.(); keyLight.dispose?.(); rimLight.dispose?.();
      },
    };
  },
});
