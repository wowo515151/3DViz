function colorHex(color) {
  return `#${(Number(color) >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
}

function contrastingText(color) {
  const red = (color >> 16) & 255;
  const green = (color >> 8) & 255;
  const blue = color & 255;
  return (red * 0.299 + green * 0.587 + blue * 0.114) > 155 ? "#111820" : "#ffffff";
}

/** Create a compact, color-backed 3D label that billboards toward the active camera. */
export function createLabeledBox({ THREE, resources }, text, color, {
  fontSize = 24,
  worldUnitsPerPixel = 0.01,
  paddingX = 8,
  paddingY = 5,
  depth = 0.055,
  fontFamily = "system-ui, sans-serif",
} = {}) {
  if (!THREE?.BoxGeometry || !THREE?.CanvasTexture || !THREE?.Mesh || !resources?.track) {
    throw new TypeError("createLabeledBox() needs the Three.js runtime and a resource owner.");
  }
  if (typeof text !== "string" || !text.length) throw new TypeError("Label text must be a non-empty string.");
  if (!Number.isFinite(worldUnitsPerPixel) || worldUnitsPerPixel <= 0) throw new RangeError("worldUnitsPerPixel must be positive and finite.");
  const backgroundColor = Number(color) >>> 0;
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (!measure) throw new Error("A 2D canvas is required to create a text label.");
  measure.font = `600 ${fontSize}px ${fontFamily}`;
  const textWidth = Math.ceil(measure.measureText(text).width);
  const canvasWidth = Math.max(1, textWidth + paddingX * 2);
  const canvasHeight = Math.ceil(fontSize * 1.3 + paddingY * 2);
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = colorHex(backgroundColor);
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.strokeStyle = "rgba(8, 13, 19, .55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvasWidth - 2, canvasHeight - 2);
  ctx.fillStyle = contrastingText(backgroundColor);
  ctx.textBaseline = "middle";
  ctx.fillText(text, paddingX, canvasHeight / 2, textWidth);

  const texture = resources.track(new THREE.CanvasTexture(canvas));
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  const frontMaterial = resources.track(new THREE.MeshBasicMaterial({ map:texture, side:THREE.DoubleSide, toneMapped:false, depthWrite:false }));
  const sideMaterial = resources.track(new THREE.MeshBasicMaterial({ color:backgroundColor, toneMapped:false }));
  const geometry = resources.track(new THREE.BoxGeometry(canvasWidth * worldUnitsPerPixel, canvasHeight * worldUnitsPerPixel, depth));
  const box = new THREE.Mesh(geometry, [sideMaterial, sideMaterial, sideMaterial, sideMaterial, frontMaterial, sideMaterial]);
  box.name = "labeled-box";
  box.userData.labelText = text;
  box.userData.labeledBoxSize = Object.freeze({ width:canvasWidth * worldUnitsPerPixel, height:canvasHeight * worldUnitsPerPixel, depth });
  box.frustumCulled = false;
  box.onBeforeRender = (_renderer, _scene, camera) => box.quaternion.copy(camera.quaternion);
  return box;
}
