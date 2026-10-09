import { createLabeledBox } from "./labeled-box.js?v=forecast-labels-20261009i";

function finitePositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite.`);
  return value;
}

function sign(value) { return value < 0 ? -1 : 1; }

function normalizeLabels(labels, extent) {
  if (!Array.isArray(labels)) throw new TypeError("Grid axis labels must be arrays.");
  if (labels.length < 2) return labels.map((item, index) => ({
    text:String(item?.text ?? item ?? ""),
    position:Number.isFinite(item?.position) ? item.position : 0,
    key:item?.key ?? index,
    color:item?.color,
    fontSize:item?.fontSize,
    worldUnitsPerPixel:item?.worldUnitsPerPixel,
    paddingX:item?.paddingX,
    paddingY:item?.paddingY,
    normalPosition:Number.isFinite(item?.normalPosition) ? item.normalPosition : undefined,
  }));
  return labels.map((item, index) => ({
    text:String(item?.text ?? item ?? ""),
    position:Number.isFinite(item?.position) ? item.position : -extent / 2 + (index / (labels.length - 1)) * extent,
    key:item?.key ?? index,
    color:item?.color,
    fontSize:item?.fontSize,
    worldUnitsPerPixel:item?.worldUnitsPerPixel,
    paddingX:item?.paddingX,
    paddingY:item?.paddingY,
    normalPosition:Number.isFinite(item?.normalPosition) ? item.normalPosition : undefined,
  }));
}

/** A two-axis grid plane in 3D space, with optional camera-facing box labels. */
export function createGrid2D(context, {
  width = 10,
  height = width,
  divisionsX = 10,
  divisionsY = divisionsX,
  xLabels = [],
  yLabels = [],
  labelColor = 0x8397a8,
  labelWorldUnitsPerPixel = 0.01,
  labelFontSize = 18,
  labelPaddingX = 5,
  labelPaddingY = 3,
  labelGap = 0.025,
  labelDepth = 0.045,
  labelNormalOffset = 0,
  gridColor = 0x526678,
  majorGridColor = 0x8198aa,
  opacity = 0.22,
} = {}) {
  const { THREE, resources } = context ?? {};
  if (!THREE?.BufferGeometry || !THREE?.LineSegments || !resources?.track) {
    throw new TypeError("createGrid2D() needs the Three.js runtime and a resource owner.");
  }
  finitePositive(width, "width"); finitePositive(height, "height");
  if (!Number.isFinite(labelNormalOffset) || labelNormalOffset < 0) throw new RangeError("labelNormalOffset must be finite and non-negative.");
  if (!Number.isInteger(divisionsX) || divisionsX < 1 || !Number.isInteger(divisionsY) || divisionsY < 1) {
    throw new RangeError("Grid divisions must be positive integers.");
  }

  const group = new THREE.Group();
  group.name = "grid-2d";
  const vertices = [];
  const majorVertices = [];
  for (let index = 0; index <= divisionsX; index += 1) {
    const x = -width / 2 + (index / divisionsX) * width;
    const target = index === 0 || index === divisionsX || index % 5 === 0 ? majorVertices : vertices;
    target.push(x, -height / 2, 0, x, height / 2, 0);
  }
  for (let index = 0; index <= divisionsY; index += 1) {
    const y = -height / 2 + (index / divisionsY) * height;
    const target = index === 0 || index === divisionsY || index % 5 === 0 ? majorVertices : vertices;
    target.push(-width / 2, y, 0, width / 2, y, 0);
  }
  const addLines = (positions, color, name, lineOpacity) => {
    if (!positions.length) return;
    const geometry = resources.track(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const material = resources.track(new THREE.LineBasicMaterial({ color, transparent:true, opacity:lineOpacity, depthTest:true, depthWrite:false }));
    const lines = new THREE.LineSegments(geometry, material);
    lines.name = name; lines.frustumCulled = false; lines.raycast = () => {};
    group.add(lines);
  };
  addLines(vertices, gridColor, "grid-2d-minor-lines", opacity * 0.78);
  addLines(majorVertices, majorGridColor, "grid-2d-major-lines", opacity);

  const xValues = normalizeLabels(xLabels, width).filter(item => item.text);
  const yValues = normalizeLabels(yLabels, height).filter(item => item.text);
  const xGroup = new THREE.Group(); xGroup.name = "grid-2d-x-labels"; group.add(xGroup);
  const yGroup = new THREE.Group(); yGroup.name = "grid-2d-y-labels"; group.add(yGroup);
  const xBoxes = xValues.map(item => {
    const box = createLabeledBox(context, item.text, item.color ?? labelColor, {
      fontSize:item.fontSize ?? labelFontSize, worldUnitsPerPixel:item.worldUnitsPerPixel ?? labelWorldUnitsPerPixel,
      paddingX:item.paddingX ?? labelPaddingX, paddingY:item.paddingY ?? labelPaddingY, depth:labelDepth,
    });
    box.name = `grid-x-label-${item.key}`;
    box.userData.axis = "x"; box.userData.axisPosition = item.position;
    xGroup.add(box); return box;
  });
  const yBoxes = yValues.map(item => {
    const box = createLabeledBox(context, item.text, item.color ?? labelColor, {
      fontSize:item.fontSize ?? labelFontSize, worldUnitsPerPixel:item.worldUnitsPerPixel ?? labelWorldUnitsPerPixel,
      paddingX:item.paddingX ?? labelPaddingX, paddingY:item.paddingY ?? labelPaddingY, depth:labelDepth,
    });
    box.name = `grid-y-label-${item.key}`;
    box.userData.axis = "y"; box.userData.axisPosition = item.position;
    if (Number.isFinite(item.normalPosition)) box.userData.normalPosition = item.normalPosition;
    yGroup.add(box); return box;
  });
  const labelBoxes = Object.freeze([
    ...xBoxes.map(box => Object.freeze({ axis:"x", box, group:xGroup })),
    ...yBoxes.map(box => Object.freeze({ axis:"y", box, group:yGroup })),
  ]);

  let xVisible = xBoxes.length > 0;
  let yVisible = yBoxes.length > 0;
  let disposed = false;
  function setLabelVisibility({ x = xVisible, y = yVisible, render = true } = {}) {
    if (disposed) return;
    xVisible = Boolean(x); yVisible = Boolean(y);
    xGroup.visible = xVisible; yGroup.visible = yVisible;
    if (render) context.requestRender?.();
  }
  function update(camera) {
    if (disposed || !camera) return;
    group.updateMatrixWorld(true);
    camera.updateMatrixWorld?.(true);
    const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
    const localCamera = group.worldToLocal(cameraPosition);
    const xEdge = sign(localCamera.x) * (width / 2 + labelGap);
    const yEdge = sign(localCamera.y) * (height / 2 + labelGap);
    const frontZ = sign(localCamera.z) * (labelDepth / 2 + 0.008 + labelNormalOffset);
    for (const box of xBoxes) {
      box.visible = true;
      box.position.set(box.userData.axisPosition, yEdge, frontZ);
    }
    for (const box of yBoxes) {
      box.visible = true;
      box.position.set(xEdge, box.userData.axisPosition, frontZ);
    }
    // Both label rows share the same physical cube corner at the nearest ends.
    // Keep the X-axis label there and hide the coincident Y-axis label.
    const cornerTolerance = 1e-5;
    const xCorner = sign(localCamera.x) * width / 2;
    const yCorner = sign(localCamera.y) * height / 2;
    if (xBoxes.some(box => Math.abs(box.userData.axisPosition - xCorner) < cornerTolerance)) {
      const coincidentY = yBoxes.find(box => Math.abs(box.userData.axisPosition - yCorner) < cornerTolerance);
      if (coincidentY) coincidentY.visible = false;
    }
    xGroup.updateMatrixWorld(true); yGroup.updateMatrixWorld(true);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
  }

  return Object.freeze({ object3D:group, labelBoxes, setLabelVisibility, update, dispose });
}
