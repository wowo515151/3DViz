/** Create the common glossy, metallic finish used by solid and linear-field geometry. */
export function createCarPaintMaterial(THREE, color, options = {}) {
  const Material = typeof THREE.MeshPhysicalMaterial === "function"
    ? THREE.MeshPhysicalMaterial
    : THREE.MeshStandardMaterial;
  if (typeof Material !== "function") throw new Error("Glossy plotter materials need Three.js physical or standard materials.");
  return new Material({
    color,
    roughness: 0.28,
    metalness: 0.2,
    ...(Material === THREE.MeshPhysicalMaterial ? { clearcoat: 1, clearcoatRoughness: 0.12 } : {}),
    ...options,
  });
}
