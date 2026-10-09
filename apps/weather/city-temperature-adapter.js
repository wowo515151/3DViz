export const cityTemperatureAdapter = Object.freeze({
  capabilities: Object.freeze(["selection", "time", "animation"]),
  create(context, definition, input) {
    const { THREE, scene, resources } = context;
    const cities = input.cities ?? [];
    const timestamps = input.timestamps ?? [];
    const unit = input.unit ?? "C";
    const range = unit === "F" ? [-40, 104] : [-40, 40];
    const width = Math.max(1, timestamps.length - 1);
    const laneCount = Math.max(1, cities.length);
    const x = index => (index - (timestamps.length - 1) / 2) * 0.88;
    const z = lane => (lane - (laneCount - 1) / 2) * 0.88;
    const y = value => 0.5 + ((value - range[0]) / (range[1] - range[0])) * 6.1;
    const root = new THREE.Group(); root.name = "canadian-city-hourly-temperatures"; scene.add(root);
    const hemi = new THREE.HemisphereLight(0xb7dcff, 0x10151c, 1.3);
    const keyLight = new THREE.DirectionalLight(0xf1f8ff, 1.5); keyLight.position.set(-5, 12, 7);
    const rimLight = new THREE.DirectionalLight(0x6b9dff, 0.5); rimLight.position.set(8, 4, -9);
    scene.add(hemi, keyLight, rimLight);

    const markerGeometry = resources.track(new THREE.SphereGeometry(0.105, 14, 10));
    const pointRecords = [];
    cities.forEach((city, lane) => city.forecasts.forEach((forecast, hour) => {
      if (!Number.isFinite(forecast.value)) return;
      pointRecords.push({ city, forecast, hour, lane, x:x(hour), y:y(forecast.value), z:z(lane) });
    }));
    const markers = new THREE.InstancedMesh(markerGeometry, resources.track(new THREE.MeshStandardMaterial({ metalness:0.08, roughness:0.32, emissive:0x16202b })), pointRecords.length);
    markers.name = "city-temperature-markers";
    const markerTransform = new THREE.Object3D();
    pointRecords.forEach((point, index) => {
      markerTransform.position.set(point.x, point.y, point.z); markerTransform.scale.setScalar(1); markerTransform.updateMatrix();
      markers.setMatrixAt(index, markerTransform.matrix);
      markers.setColorAt(index, new THREE.Color(point.city.color ?? 0x9bdcff));
    });
    markers.instanceMatrix.needsUpdate = true; markers.instanceColor.needsUpdate = true; markers.computeBoundingSphere(); root.add(markers);

    cities.forEach((city, lane) => {
      const valid = city.forecasts.flatMap((forecast, hour) => Number.isFinite(forecast.value) ? [new THREE.Vector3(x(hour), y(forecast.value), z(lane))] : []);
      if (valid.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(valid);
      const material = resources.track(new THREE.MeshStandardMaterial({ color:city.color ?? 0x9bdcff, metalness:0.08, roughness:0.32, emissive:city.color ?? 0x9bdcff, emissiveIntensity:0.07 }));
      const tube = new THREE.Mesh(resources.track(new THREE.TubeGeometry(curve, Math.max(30, valid.length * 6), 0.025, 7, false)), material);
      tube.name = `temperature-line-${city.id}`; tube.raycast = () => {}; root.add(tube);
    });

    const gridSize = Math.max(width * 0.88 + 1, laneCount * 0.88 + 1);
    const grid = new THREE.GridHelper(gridSize, Math.max(10, laneCount), 0x425364, 0x354351);
    grid.position.y = 0.45; grid.material.transparent = true; grid.material.opacity = 0.25; grid.raycast = () => {}; scene.add(grid);
    resources.track(grid.geometry); if (Array.isArray(grid.material)) grid.material.forEach(resources.track); else resources.track(grid.material);

    const cursor = new THREE.Group();
    const cursorGeometry = resources.track(new THREE.CylinderGeometry(0.014, 0.014, 6.6, 8));
    const cursorMaterial = resources.track(new THREE.MeshBasicMaterial({ color:0xe7f4ff, transparent:true, opacity:0.45 }));
    const cursorMesh = new THREE.Mesh(cursorGeometry, cursorMaterial); cursorMesh.raycast = () => {}; cursor.add(cursorMesh); cursor.position.set(x(0), 3.8, 0); scene.add(cursor);

    function setTime(step) { const next = Math.max(0, Math.min(timestamps.length - 1, Math.round(step))); cursor.position.x = x(next); context.requestRender(); }
    return {
      capabilities:["selection", "time", "animation"], update() {}, setTime,
      updateFrame({ elapsedSeconds }) { setTime(Math.floor(elapsedSeconds * 1.2) % Math.max(1, timestamps.length)); definition.callbacks?.onTime?.(Math.floor(elapsedSeconds * 1.2) % Math.max(1, timestamps.length)); },
      describeSelection(hit) {
        const point = pointRecords[hit.instanceId]; if (!point) return null;
        const stamp = new Date(point.forecast.timestamp);
        const time = Number.isNaN(stamp.valueOf()) ? point.forecast.timestamp : new Intl.DateTimeFormat("en-CA", { timeZone:"UTC", weekday:"short", hour:"numeric", minute:"2-digit", timeZoneName:"short" }).format(stamp);
        return { label:`${point.city.name}, ${point.city.province}`, values:{ forecast:time, temperature:`${Number(point.forecast.value.toFixed(1))} °${unit}`, region:point.city.region } };
      },
      dispose() {
        scene.remove(root, cursor, grid, hemi, keyLight, rimLight);
        root.traverse(object => { if (object.isMesh) { object.geometry?.dispose?.(); if (Array.isArray(object.material)) object.material.forEach(material => material.dispose()); else object.material?.dispose?.(); } });
        cursor.traverse(object => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
        grid.geometry.dispose(); if (Array.isArray(grid.material)) grid.material.forEach(material => material.dispose()); else grid.material.dispose();
        hemi.dispose?.(); keyLight.dispose?.(); rimLight.dispose?.();
      },
    };
  },
});
