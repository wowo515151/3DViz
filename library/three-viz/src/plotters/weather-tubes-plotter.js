

export const weatherTubesPlotter = Object.freeze({
  capabilities: Object.freeze(["selection", "time", "animation"]),
  create(context, definition, input) {
    const { THREE, scene, resources } = context;
    const rows = input.rows ?? [];
    const metricDefinition = key => input.metricDefinitions?.[key] ?? { label: key, unit: "", color: 0xb5c5d8 };
    const keys = input.keys ?? [];
    const keyExtents = new Map(keys.map(key => {
      const values = rows.map(row => row.metrics[key]).filter(Number.isFinite);
      return [key, { min: Math.min(...values), max: Math.max(...values) }];
    }));
    const normalY = (key, value) => {
      const extent = keyExtents.get(key);
      return extent.max === extent.min ? 1.8 : 0.45 + ((value - extent.min) / (extent.max - extent.min)) * 2.7;
    };
    const laneZ = index => (index - (keys.length - 1) / 2) * 1.45;
    const x = index => (index - (rows.length - 1) / 2) * Math.min(1.05, 18 / Math.max(1, rows.length - 1));
    const scale = Math.min(1.05, 18 / Math.max(1, rows.length - 1));
    const root = new THREE.Group();
    root.name = "weather-forecast-signals";
    scene.add(root);

    const hemi = new THREE.HemisphereLight(0xb7dcff, 0x10151c, 1.25);
    const keyLight = new THREE.DirectionalLight(0xf1f8ff, 1.7);
    const rimLight = new THREE.DirectionalLight(0x6b9dff, 0.55);
    keyLight.position.set(-5, 10, 8);
    rimLight.position.set(7, 4, -8);
    scene.add(hemi, keyLight, rimLight);

    const lineMaterial = key => resources.track(new THREE.MeshStandardMaterial({ color: metricDefinition(key).color, metalness: 0.12, roughness: 0.3, emissive: metricDefinition(key).color, emissiveIntensity: 0.06 }));
    const markerGeometry = resources.track(new THREE.SphereGeometry(0.085, 14, 10));
    const pointIndex = new Map();

    keys.forEach((key, lane) => {
      const series = rows.flatMap((row, step) => Number.isFinite(row.metrics[key]) ? [{ step, value: row.metrics[key], x: x(step), y: normalY(key, row.metrics[key]), z: laneZ(lane), row }] : []);
      if (!series.length) return;
      const segments = [];
      for (const point of series) {
        const segment = segments.at(-1);
        if (!segment || point.step !== segment.at(-1).step + 1) segments.push([point]);
        else segment.push(point);
      }
      segments.filter(segment => segment.length > 1).forEach((segment, segmentIndex) => {
        const points = segment.map(point => new THREE.Vector3(point.x, point.y, point.z));
        const curve = new THREE.CatmullRomCurve3(points);
        const tube = new THREE.Mesh(resources.track(new THREE.TubeGeometry(curve, Math.max(24, segment.length * 7), 0.025, 7, false)), lineMaterial(key));
        tube.name = `weather-line-${key}-${segmentIndex}`;
        tube.raycast = () => {};
        root.add(tube);
      });
      const material = lineMaterial(key);
      const markers = new THREE.InstancedMesh(markerGeometry, material, series.length);
      markers.name = `weather-markers-${key}`;
      markers.userData.metricKey = key;
      const transform = new THREE.Object3D();
      series.forEach((point, index) => {
        transform.position.set(point.x, point.y, point.z);
        transform.scale.setScalar(1);
        transform.updateMatrix();
        markers.setMatrixAt(index, transform.matrix);
        markers.setColorAt(index, new THREE.Color(metricDefinition(key).color));
        pointIndex.set(`${key}:${index}`, point);
      });
      markers.instanceMatrix.needsUpdate = true;
      markers.computeBoundingSphere();
      root.add(markers);
    });

    const grid = new THREE.GridHelper(Math.max(10, (rows.length - 1) * scale + 2), Math.max(10, rows.length), 0x425364, 0x354351);
    grid.position.y = 0.35;
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    grid.raycast = () => {};
    scene.add(grid);
    resources.track(grid.geometry);
    if (Array.isArray(grid.material)) grid.material.forEach(resources.track); else resources.track(grid.material);

    const cursor = new THREE.Group();
    const cursorGeometry = resources.track(new THREE.CylinderGeometry(0.012, 0.012, 4.5, 8));
    const cursorMaterial = resources.track(new THREE.MeshBasicMaterial({ color: 0xe7f4ff, transparent: true, opacity: 0.58 }));
    const cursorMesh = new THREE.Mesh(cursorGeometry, cursorMaterial);
    cursorMesh.raycast = () => {};
    cursor.add(cursorMesh);
    cursor.position.x = x(0);
    scene.add(cursor);

    return {
      capabilities: ["selection", "time", "animation"],
      update() {},
      setTime(step) {
        const next = Math.max(0, Math.min(rows.length - 1, Math.round(step)));
        cursor.position.x = x(next);
        context.requestRender();
      },
      updateFrame({ elapsedSeconds }) {
        const step = Math.floor(elapsedSeconds * 1.5) % Math.max(1, rows.length);
        cursor.position.x = x(step);
        definition.callbacks?.onTime?.(step);
      },
      describeSelection(hit) {
        const key = hit.object?.userData?.metricKey;
        const point = pointIndex.get(`${key}:${hit.instanceId}`);
        if (!point) return null;
        const metric = metricDefinition(key);
        return {
          label: metric.label,
          values: {
            forecast: point.row.label,
            value: `${point.value}${metric.unit ? ` ${metric.unit}` : ""}`,
            interval: "ECCC forecast interval",
            conditions: point.row.description || "Forecast details are supplied by ECCC.",
          },
        };
      },
      dispose() {
        scene.remove(root, cursor, grid, hemi, keyLight, rimLight);
        root.traverse(object => { if (object.isMesh && object !== rayTarget) { object.geometry?.dispose?.(); object.material?.dispose?.(); } });
        cursor.traverse(object => { object.geometry?.dispose?.(); object.material?.dispose?.(); });
        grid.geometry.dispose();
        if (Array.isArray(grid.material)) grid.material.forEach(material => material.dispose()); else grid.material.dispose();
        hemi.dispose?.(); keyLight.dispose?.(); rimLight.dispose?.();
      },
    };
  },
});
