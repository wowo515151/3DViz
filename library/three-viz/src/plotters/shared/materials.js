/** Create the common glossy, metallic finish used by solid and linear-field geometry. */
const carPaintScenes = new WeakMap();

/** Keep one procedural softbox reflection environment alive while scene plotters use it. */
export function retainCarPaintEnvironment(THREE, scene, renderer) {
  if (!scene || !renderer || typeof THREE.PMREMGenerator !== "function" || typeof THREE.PlaneGeometry !== "function" || typeof THREE.MeshBasicMaterial !== "function") return () => {};
  let environmentScene = scene;
  while (environmentScene.parent && !environmentScene.isScene) environmentScene = environmentScene.parent;
  const existing = carPaintScenes.get(environmentScene);
  if (existing) {
    existing.references += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseCarPaintEnvironment(environmentScene, existing);
    };
  }
  if (environmentScene.environment) return () => {};

  let generator, target;
  const studio = new THREE.Scene();
  const panelMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const panels = [];
  try {
    const addPanel = (width, height, position, rotation) => {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), panelMaterial);
      panel.position.set(...position);
      panel.rotation.set(...rotation);
      studio.add(panel);
      panels.push(panel);
    };
    addPanel(16, 6, [0, 8, 0], [Math.PI / 2, 0, 0]);
    addPanel(18, 2, [-8, 3, 0], [0, Math.PI / 2, 0]);
    addPanel(18, 2, [8, 3, 0], [0, -Math.PI / 2, 0]);
    addPanel(8, 2, [0, 2.5, 9], [0, Math.PI, 0]);
    generator = new THREE.PMREMGenerator(renderer);
    generator.compileEquirectangularShader?.();
    target = generator.fromScene(studio, 0.04);
    environmentScene.environment = target.texture;
    const state = { references: 1, target, previous: null };
    carPaintScenes.set(environmentScene, state);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseCarPaintEnvironment(environmentScene, state);
    };
  } catch {
    target?.dispose?.();
    return () => {};
  } finally {
    for (const panel of panels) panel.geometry.dispose();
    panelMaterial.dispose();
    generator?.dispose?.();
  }
}

function releaseCarPaintEnvironment(scene, state) {
  state.references -= 1;
  if (state.references > 0) return;
  if (scene.environment === state.target.texture) scene.environment = state.previous;
  state.target.dispose();
  carPaintScenes.delete(scene);
}

export function createCarPaintMaterial(THREE, color, options = {}) {
  const Material = typeof THREE.MeshPhysicalMaterial === "function"
    ? THREE.MeshPhysicalMaterial
    : THREE.MeshStandardMaterial;
  if (typeof Material !== "function") throw new Error("Glossy plotter materials need Three.js physical or standard materials.");
  return new Material({
    color,
    roughness: 0.16,
    metalness: 1,
    reflectivity: 1,
    envMapIntensity: 1.5,
    ...(Material === THREE.MeshPhysicalMaterial ? { clearcoat: 0, clearcoatRoughness: 0.01, ior: 1.52 } : {}),
    ...options,
  });
}
