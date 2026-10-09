import { createGrid2D } from "./grid-2d.js?v=forecast-labels-20261009e";

function sign(value) { return value < 0 ? -1 : 1; }

/** A cubic 3D grid composed from three camera-aware 2D grid planes. */
export function createGrid3D(context, {
  size = 10,
  divisions = 10,
  xLabels = [],
  yLabels = [],
  zLabels = [],
  labelColor = 0x8397a8,
  labelWorldUnitsPerPixel = 0.01,
  labelFontSize = 18,
  labelPaddingX = 5,
  labelPaddingY = 3,
  labelGap = 0.025,
  gridColor = 0x526678,
  majorGridColor = 0x8198aa,
  opacity = 0.22,
} = {}) {
  const { THREE } = context ?? {};
  if (!THREE?.Group || !THREE?.Matrix4 || !context?.getActiveCamera) {
    throw new TypeError("createGrid3D() needs a Three.js context with an active camera.");
  }
  if (!Number.isFinite(size) || size <= 0) throw new RangeError("size must be positive and finite.");
  if (!Number.isInteger(divisions) || divisions < 1) throw new RangeError("divisions must be a positive integer.");
  const half = size / 2;
  const group = new THREE.Group(); group.name = "grid-3d";
  const shared = { width:size, height:size, divisionsX:divisions, divisionsY:divisions, labelColor, labelWorldUnitsPerPixel, labelFontSize, labelPaddingX, labelPaddingY, labelGap, gridColor, majorGridColor, opacity };
  const xy = createGrid2D(context, { ...shared, xLabels, yLabels });
  const xz = createGrid2D(context, { ...shared, xLabels:[], yLabels:zLabels });
  const yz = createGrid2D(context, { ...shared, xLabels:[], yLabels:[] });
  xy.object3D.name = "grid-3d-xy-plane";
  xz.object3D.name = "grid-3d-xz-plane"; xz.object3D.rotation.x = Math.PI / 2;
  yz.object3D.name = "grid-3d-yz-plane";
  yz.object3D.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(1, 0, 0),
  ));
  group.add(xy.object3D, xz.object3D, yz.object3D);
  let disposed = false;
  const labelVisibility = { x:true, y:true, z:true };
  function update(camera = context.getActiveCamera()) {
    if (disposed || !camera) return;
    group.parent?.updateMatrixWorld?.(true);
    group.updateMatrixWorld(true);
    camera.updateMatrixWorld?.(true);
    const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
    const localCamera = group.worldToLocal(cameraPosition);
    const xSide = sign(localCamera.x);
    const ySide = sign(localCamera.y);
    const zSide = sign(localCamera.z);
    // Keep each plane at the far wall so the plotted data stays unobstructed.
    xy.object3D.position.set(0, 0, -zSide * half);
    xz.object3D.position.set(0, -ySide * half, 0);
    yz.object3D.position.set(-xSide * half, 0, 0);
    group.updateMatrixWorld(true);
    xy.update(camera); xz.update(camera); yz.update(camera);
  }
  function setAxisLabelsVisible(next = {}) {
    if (disposed) return;
    if (Object.prototype.hasOwnProperty.call(next, "x")) labelVisibility.x = Boolean(next.x);
    if (Object.prototype.hasOwnProperty.call(next, "y")) labelVisibility.y = Boolean(next.y);
    if (Object.prototype.hasOwnProperty.call(next, "z")) labelVisibility.z = Boolean(next.z);
    xy.setLabelVisibility({ x:labelVisibility.x, y:labelVisibility.y, render:false });
    xz.setLabelVisibility({ y:labelVisibility.z, render:false });
    // The YZ plane intentionally owns no label rows, preventing duplicate axes.
    yz.setLabelVisibility({ x:false, y:false, render:false });
    update();
    context.requestRender?.();
  }
  const unregisterCameraListener = context.onCameraChange?.(update);
  function dispose() {
    if (disposed) return;
    disposed = true;
    unregisterCameraListener?.();
    xy.dispose(); xz.dispose(); yz.dispose();
    group.removeFromParent();
  }
  update();
  return Object.freeze({ object3D:group, update, setAxisLabelsVisible, dispose });
}
