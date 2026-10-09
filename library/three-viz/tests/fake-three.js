export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(other) { return this.set(other.x, other.y, other.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  distanceTo(other) { return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z); }
}

export class Scene {
  constructor() { this.children = []; }
  add(object) { if (!this.children.includes(object)) this.children.push(object); object.parent = this; }
  remove(object) { this.children = this.children.filter(item => item !== object); object.parent = null; }
}

class Camera {
  constructor() { this.position = new Vector3(); this.up = new Vector3(0, 1, 0); this.projectionUpdates = 0; }
  lookAt(target) { this.target = target.clone(); }
  updateProjectionMatrix() { this.projectionUpdates += 1; }
}

export class PerspectiveCamera extends Camera {
  constructor(fov, aspect, near, far) { super(); Object.assign(this, { fov, aspect, near, far }); }
}

export class OrthographicCamera extends Camera {
  constructor(left, right, top, bottom, near, far) { super(); Object.assign(this, { left, right, top, bottom, near, far }); }
}

export class FakeCanvas {
  constructor() { this.listeners = new Map(); this.parentNode = null; this.width = 300; this.height = 150; }
  addEventListener(type, callback) { const list = this.listeners.get(type) ?? []; list.push(callback); this.listeners.set(type, list); }
  removeEventListener(type, callback) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== callback)); }
  dispatch(type, event = {}) { for (const callback of this.listeners.get(type) ?? []) callback(event); }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
}

export class WebGLRenderer {
  static instances = [];
  static failRender = false;
  constructor(options) { this.options = options; this.domElement = new FakeCanvas(); this.calls = { render: 0, dispose: 0, sizes: [], pixelRatios: [], loops: [] }; WebGLRenderer.instances.push(this); }
  setPixelRatio(value) { this.calls.pixelRatios.push(value); }
  setSize(width, height) { this.domElement.width = width; this.domElement.height = height; this.calls.sizes.push([width, height]); }
  render(scene, camera) { if (WebGLRenderer.failRender) throw new Error("renderer failure"); this.calls.render += 1; this.lastRender = { scene, camera }; }
  setAnimationLoop(callback) { this.loop = callback; this.calls.loops.push(callback); }
  tick(timestamp) { this.loop?.(timestamp); }
  dispose() { this.calls.dispose += 1; }
}

export class BufferGeometry {
  constructor() { this.attributes = {}; this.disposeCalls = 0; }
  setAttribute(name, attribute) { this.attributes[name] = attribute; }
  computeBoundingSphere() { this.boundingSphereComputed = true; }
  dispose() { this.disposeCalls += 1; }
}

export class Float32BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; }
}

export class PointsMaterial {
  constructor(options) { this.options = options; this.color = { set(value) { this.value = value; } }; this.disposeCalls = 0; }
  dispose() { this.disposeCalls += 1; }
}

export class Points {
  constructor(geometry, material) { Object.assign(this, { geometry, material }); }
}

export class BoxGeometry {
  constructor(...args) { this.args = args; this.disposeCalls = 0; }
  dispose() { this.disposeCalls += 1; }
}

export class MeshBasicMaterial {
  constructor(options) { this.options = options; this.color = { set(value) { this.value = value; } }; this.disposeCalls = 0; }
  dispose() { this.disposeCalls += 1; }
}

export class Object3D {
  constructor() {
    this.position = new Vector3();
    this.scale = new Vector3(1, 1, 1);
    this.matrix = {};
  }
  updateMatrix() { this.matrix = { position: this.position.clone(), scale: this.scale.clone() }; }
}

export class InstancedMesh {
  constructor(geometry, material, count) {
    Object.assign(this, { geometry, material, count, matrices: [], instanceMatrix: { needsUpdate: false }, disposeCalls: 0 });
  }
  setMatrixAt(index, matrix) { this.matrices[index] = matrix; }
  computeBoundingBox() { this.boundingBoxComputed = true; }
  computeBoundingSphere() { this.boundingSphereComputed = true; }
  dispose() { this.disposeCalls += 1; }
}

export class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } }

export class Raycaster {
  static hits = [];
  setFromCamera(pointer, camera) { this.pointer = pointer; this.camera = camera; }
  intersectObjects(objects) { this.objects = objects; return Raycaster.hits; }
}

export function fakeRuntime() {
  WebGLRenderer.instances = [];
  WebGLRenderer.failRender = false;
  Raycaster.hits = [];
  return {
    THREE: {
      Scene,
      WebGLRenderer,
      PerspectiveCamera,
      OrthographicCamera,
      Vector3,
      Vector2,
      Raycaster,
      BufferGeometry,
      Float32BufferAttribute,
      PointsMaterial,
      Points,
      BoxGeometry,
      MeshBasicMaterial,
      Object3D,
      InstancedMesh,
      SRGBColorSpace: "srgb",
    },
  };
}

export class FakeDocument {
  constructor() { this.hidden = false; this.listeners = new Map(); this.defaultView = { devicePixelRatio: 1, performance: { now: () => 1000 } }; }
  addEventListener(type, callback) { const list = this.listeners.get(type) ?? []; list.push(callback); this.listeners.set(type, list); }
  removeEventListener(type, callback) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== callback)); }
  dispatch(type) { for (const callback of this.listeners.get(type) ?? []) callback(); }
}

export class FakeContainer {
  constructor(width = 640, height = 480) {
    this.clientWidth = width;
    this.clientHeight = height;
    this.children = [];
    this.listeners = new Map();
    this.ownerDocument = new FakeDocument();
  }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  removeChild(child) { this.children = this.children.filter(item => item !== child); child.parentNode = null; return child; }
  getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight, left: 0, top: 0 }; }
}
