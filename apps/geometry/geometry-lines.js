export function replaceLineGeometryPoints(THREE, geometry, points) {
  const positions = points.flatMap(point => [point.x, point.y, point.z]);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
}
