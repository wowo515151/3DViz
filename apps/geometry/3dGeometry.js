import { mount, createCarPaintMaterial } from "../../library/three-viz/src/index.js?v=geometry-20261011a";
import { addSceneLights } from "../../library/three-viz/src/plotters/shared/csv-support.js?v=geometry-20261011a";
import { GEOMETRY_CONFIGURATIONS as CONFIGURATIONS, createGeometryLayout } from "./geometry-model.js?v=geometry-patterns-20261011a";
import { replaceLineGeometryPoints } from "./geometry-lines.js?v=geometry-buffer-fix-20261011a";
import { renderConfigurationList, updateGeometryReadouts, updateSceneStatus } from "./geometry-ui.js?v=geometry-ui-20261011a";
const PARTICLE_RADIUS = .17;

const $ = selector => document.querySelector(selector);
const ui = {
  list:$("#configuration-list"), size:$("#supercell-size"), sizeValue:$("#supercell-value"), sizeCaption:$("#supercell-caption"),
  count:$("#configuration-count"), title:$("#stage-heading"), subtitle:$("#stage-subheading"), total:$("#particle-total"),
  legend:$("#legend-name"), meta:$("#legend-meta"), viewport:$("#viewport"), loading:$("#loading"), error:$("#error-message"),
  statusDot:$("#scene-status"), statusText:$("#scene-status-label"),
};
let selectedId = "ci";
let controller;

function selectConfiguration(id) {
  selectedId = id;
  updateGeometryReadouts(ui, CONFIGURATIONS, selectedId, Number(ui.size.value));
  controller?.update({ configuration:CONFIGURATIONS.find(item => item.id === id), supercell:Number(ui.size.value) });
}

const geometryPlotter = Object.freeze({
  create(context, _definition, data) {
    const { THREE, scene, resources, renderer } = context;
    const root = new THREE.Group();
    root.name = "geometric-tiling";
    scene.add(root);
    const releaseLights = addSceneLights(THREE, scene, renderer);
    const pointGeometry = resources.track(new THREE.SphereGeometry(PARTICLE_RADIUS, 32, 24));
    const pointMaterial = resources.track(createCarPaintMaterial(THREE, 0x438fe8, {
      roughness:.2, metalness:.72, envMapIntensity:1.9,
      ...(typeof THREE.MeshPhysicalMaterial === "function" ? { clearcoat:.75, clearcoatRoughness:.12 } : {}),
    }));
    const capacity = Math.max(...CONFIGURATIONS.map(configuration => configuration.basis.length)) * 6 ** 3;
    const bondGeometry = resources.track(new THREE.BufferGeometry());
    const bondMaterial = resources.track(new THREE.LineBasicMaterial({ color:0x9bcff1, transparent:true, opacity:.62, depthWrite:false }));
    const bonds = new THREE.LineSegments(bondGeometry, bondMaterial);
    bonds.name = "nearest-neighbor-bonds";
    resources.track(bonds);
    root.add(bonds);

    const points = new THREE.InstancedMesh(pointGeometry, pointMaterial, capacity);
    points.name = "repeated-particle-positions";
    points.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    resources.track(points);
    root.add(points);

    const cellGeometry = resources.track(new THREE.BufferGeometry());
    const cellMaterial = resources.track(new THREE.LineBasicMaterial({ color:0x77bce7, transparent:true, opacity:.32, depthWrite:false }));
    const cell = new THREE.LineSegments(cellGeometry, cellMaterial);
    cell.name = "supercell-outline";
    resources.track(cell);
    root.add(cell);

    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(1,1,1);
    const identityRotation = new THREE.Quaternion();
    const edges = [];
    for (let corner = 0; corner < 8; corner += 1) {
      for (const bit of [1,2,4]) {
        if (corner & bit) continue;
        const neighbor = corner | bit;
        edges.push([corner, neighbor]);
      }
    }

    const rebuild = ({ configuration, supercell }) => {
      const vectors = configuration.lattice.map(vector => new THREE.Vector3(...vector));
      const layout = createGeometryLayout(configuration, supercell, PARTICLE_RADIUS);
      const particlePositions = layout.positions.map(coordinates => new THREE.Vector3(...coordinates));
      for (let index = 0; index < particlePositions.length; index += 1) {
        matrix.compose(particlePositions[index], identityRotation, scale);
        points.setMatrixAt(index, matrix);
      }
      points.count = particlePositions.length;
      points.instanceMatrix.needsUpdate = true;
      points.computeBoundingSphere();

      const bondLinePoints = [];
      for (const segment of layout.bondSegments) {
        bondLinePoints.push(new THREE.Vector3(...segment.start), new THREE.Vector3(...segment.end));
      }
      replaceLineGeometryPoints(THREE, bondGeometry, bondLinePoints);
      bonds.visible = bondLinePoints.length > 0;

      const cellOrigin = vectors.reduce((origin, vector) => origin.addScaledVector(vector, -supercell / 2), new THREE.Vector3());
      const corners = Array.from({ length:8 }, (_, corner) => {
        const vertex = cellOrigin.clone();
        for (const [bit, vectorIndex] of [[1,0],[2,1],[4,2]]) if (corner & bit) vertex.addScaledVector(vectors[vectorIndex], supercell);
        return vertex;
      });
      const linePoints = [];
      for (const [from, to] of edges) linePoints.push(corners[from], corners[to]);
      replaceLineGeometryPoints(THREE, cellGeometry, linePoints);
    };

    rebuild(data);
    return {
      update(next) { rebuild(next); },
      dispose() {
        scene.remove(root);
        releaseLights();
      },
    };
  },
});

async function start() {
  renderConfigurationList(document, ui.list, ui.count, CONFIGURATIONS, selectedId, selectConfiguration);
  updateGeometryReadouts(ui, CONFIGURATIONS, selectedId, Number(ui.size.value));
  try {
    controller = await mount(ui.viewport, {
      plotter:geometryPlotter,
      data:{ configuration:CONFIGURATIONS.find(item => item.id === selectedId), supercell:Number(ui.size.value) },
      configuration:{ backgroundColor:0x202832 },
      renderer:{ antialias:true, maxPixelRatio:1.5, powerPreference:"high-performance", toneMapping:"ACESFilmicToneMapping", toneMappingExposure:1.08 },
      camera:{ type:"perspective", position:[7.4,5.7,8.8], target:[0,0,0], fov:42 },
      controls:{ enabled:true, enableDamping:true, dampingFactor:.065, minDistance:3, maxDistance:24 },
      callbacks:{ onError(error) { ui.error.hidden = false; ui.error.textContent = error.message; updateSceneStatus(ui, "error"); } },
    });
    ui.loading.hidden = true;
    updateSceneStatus(ui, "ready");
  } catch (error) {
    ui.loading.hidden = true;
    ui.error.hidden = false;
    ui.error.textContent = `${error.message} Check the pinned Three.js runtime connection and browser WebGL support.`;
    updateSceneStatus(ui, "error");
  }
}

ui.size.addEventListener("input", () => {
  updateGeometryReadouts(ui, CONFIGURATIONS, selectedId, Number(ui.size.value));
  controller?.update({ configuration:CONFIGURATIONS.find(item => item.id === selectedId), supercell:Number(ui.size.value) });
});
updateSceneStatus(ui, "loading");
start();
