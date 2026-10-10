import { createCarPaintMaterial } from './materials.js?v=car-paint-20261010a';
/** Build a disposable line or tubular wireframe layer around an existing Three.js geometry. */
export function createWireframe(THREE, geometry, { color = 0xd6f4ff, opacity = 0.64, threshold = 1, full = false, tubeRadius = 0 } = {}) {
  const WireGeometry = full ? THREE.WireframeGeometry : THREE.EdgesGeometry;
  if (typeof WireGeometry !== "function") throw new Error("Wireframe display needs Three.js edge geometry support.");
  const wireGeometry = full ? new WireGeometry(geometry) : new WireGeometry(geometry, threshold);
  const tubular = Number.isFinite(tubeRadius) && tubeRadius > 0;
  if (tubular) {
    if (typeof THREE.CylinderGeometry !== "function" || (typeof THREE.MeshPhysicalMaterial !== "function" && typeof THREE.MeshStandardMaterial !== "function") || typeof THREE.InstancedMesh !== "function" || typeof THREE.Matrix4 !== "function" || typeof THREE.Quaternion !== "function" || typeof THREE.Vector3 !== "function") {
      wireGeometry.dispose();
      throw new Error("Tubular wireframes need Three.js cylinder instancing support.");
    }
    const positions = wireGeometry.getAttribute("position");
    const count = Math.floor((positions?.count ?? 0) / 2);
    const tubeGeometry = new THREE.CylinderGeometry(tubeRadius, tubeRadius, 1, 12, 1);
    const material = createCarPaintMaterial(THREE, color);
    const object = new THREE.InstancedMesh(tubeGeometry, material, count);
    const matrix = new THREE.Matrix4();
    const midpoint = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    const quaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let index = 0; index < count; index += 1) {
      const first = index * 2;
      const start = new THREE.Vector3(positions.getX(first), positions.getY(first), positions.getZ(first));
      const end = new THREE.Vector3(positions.getX(first + 1), positions.getY(first + 1), positions.getZ(first + 1));
      direction.subVectors(end, start);
      const length = direction.length();
      if (length <= 1e-9) { scale.set(0, 0, 0); }
      else {
        midpoint.addVectors(start, end).multiplyScalar(0.5);
        quaternion.setFromUnitVectors(up, direction.normalize());
        scale.set(1, length, 1);
      }
      matrix.compose(length > 1e-9 ? midpoint : start, quaternion, scale);
      object.setMatrixAt(index, matrix);
    }
    object.instanceMatrix.needsUpdate = true;
    object.name = "tubular-wireframe";
    wireGeometry.dispose();
    return { object, geometry: tubeGeometry, material };
  }
  if (typeof THREE.LineBasicMaterial !== "function" || typeof THREE.LineSegments !== "function") {
    wireGeometry.dispose();
    throw new Error("Wireframe display needs Three.js line classes.");
  }
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  const object = new THREE.LineSegments(wireGeometry, material);
  return { object, geometry: wireGeometry, material };
}
