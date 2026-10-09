/** Build a disposable wireframe layer around an existing Three.js geometry. */
export function createWireframe(THREE, geometry, { color = 0xd6f4ff, opacity = 0.64, threshold = 1, full = false } = {}) {
  const WireGeometry = full ? THREE.WireframeGeometry : THREE.EdgesGeometry;
  if (typeof WireGeometry !== "function" || typeof THREE.LineBasicMaterial !== "function" || typeof THREE.LineSegments !== "function") {
    throw new Error("Wireframe display needs Three.js edge geometry and line classes.");
  }
  const wireGeometry = full ? new WireGeometry(geometry) : new WireGeometry(geometry, threshold);
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  const object = new THREE.LineSegments(wireGeometry, material);
  return { object, geometry: wireGeometry, material };
}
