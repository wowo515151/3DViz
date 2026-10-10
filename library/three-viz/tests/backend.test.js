import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePointRecords,
  validateOrderedSeries,
  validateSurfaceMesh,
  validateRegularScalarGrid,
  validateRegularVectorGrid,
  validateNetwork,
  validateTimeSeries,
} from "../src/data/validation.js";
import { createCoordinateMapper } from "../src/data/coordinate-mapping.js";
import { createResourceRegistry } from "../src/core/resource-registry.js";
import { createViewerWithRuntime, mount } from "../src/core/mount.js";
import { pointCloudPlotter } from "../src/plotters/point-cloud-plotter.js";
import { coneHeightForMagnitude } from "../src/plotters/vector-field-plotter.js";
import { makeConeIsoPlotter, triangleArea } from "../src/plotters/cone-iso-plotter.js";
import { makeVectorPlotter } from "../src/plotters/vector-field-plotter.js";
import { barChartPlotter } from "../src/plotters/bar-chart-plotter.js";
import { VisualizationError } from "../src/core/errors.js";
import { rgbToHsl } from "../src/utils/colors.js";
import { generateColorShades } from "../src/utils/shades.js";
import { FakeContainer, fakeRuntime, Raycaster, WebGLRenderer } from "./fake-three.js";

function errorCode(code) {
  return error => error instanceof VisualizationError && error.code === code;
}

test("validates point, series, mesh, grids, network, and time-frame structures", () => {
  const points = [{ id: "p1", x: 1, y: 2, z: 3 }];
  assert.equal(validatePointRecords(points), points);
  assert.equal(validateOrderedSeries([{ id: "s1", samples: [{ time: 1, x: 0, y: 1, z: 2 }, { time: 2, x: 2, y: 3, z: 4 }] }]).length, 1);
  assert.equal(validateOrderedSeries([{ id: "s2", samples: [{ sequence: 1, x: 0, y: 1, z: 2 }, { sequence: 2, x: 2, y: 3, z: 4 }] }]).length, 1);
  assert.equal(validateSurfaceMesh({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] }).indices.length, 3);
  assert.equal(validateRegularScalarGrid({ dimensions: [2, 2, 1], origin: [0, 0, 0], spacing: [1, 1, 1], sampleLocation: "vertex", values: [0, 1, 2, 3] }).values.length, 4);
  assert.equal(validateRegularVectorGrid({ dimensions: [1, 1, 1], origin: [0, 0, 0], spacing: [1, 1, 1], sampleLocation: "cell", vectors: [0, 1, 0] }).vectors.length, 3);
  assert.equal(validateNetwork({ nodes: [{ id: "a" }, { id: "b" }], edges: [{ source: "a", target: "b" }] }).edges.length, 1);
  assert.equal(validateTimeSeries({ frames: [{ time: 1, data: [1, 2] }, { time: 2, data: [3, 4] }] }).frames.length, 2);
});

test("generates evenly spaced, hue-preserving shades from light to dark", () => {
  const redShades = generateColorShades(0xed5363, 5);
  const blueShades = generateColorShades(0x529cff, 3);
  assert.equal(redShades.length, 5);
  assert.equal(blueShades.length, 3);
  assert.deepEqual(generateColorShades(0xed5363, 0), []);
  assert.ok(redShades[0] > redShades.at(-1));
  assert.ok(blueShades[0] > blueShades.at(-1));
  assert.notEqual(redShades[0], redShades.at(-1));
  const redLightness = redShades.map(color => rgbToHsl(color).lightness);
  const expectedStep = (0.38 - 0.72) / (redLightness.length - 1);
  assert.ok(redLightness.slice(1).every((value, index) => Math.abs((value - redLightness[index]) - expectedStep) < 0.01));
  assert.equal(blueShades[0], 0x70adff);
  assert.equal(blueShades.at(-1), 0x0053c2);
  assert.throws(() => generateColorShades(-1, 3), RangeError);
  assert.throws(() => generateColorShades(0xed5363, -1), RangeError);
});

test("cone plotters share magnitude-proportional sizing and ConeIso facet area math", () => {
  const smallHeight = coneHeightForMagnitude(0.25, 1, 0.22);
  const largeHeight = coneHeightForMagnitude(1, 1, 0.22);
  assert.equal(smallHeight, 0.055);
  assert.equal(largeHeight, 0.22);
  assert.equal(smallHeight / 2, 0.0275);
  assert.equal(largeHeight / 2, 0.11);
  assert.equal(triangleArea([0, 0, 0], [1, 0, 0], [0, 1, 0]), 0.5);
  assert.equal(triangleArea([0, 0, 0], [2, 0, 0], [0, 3, 0]), 3);
  assert.equal(coneHeightForMagnitude(0, 1), 0);
});

test("vector and ConeIso plotters instance cones at samples and eligible facet centers", () => {
  class TestGroup {
    constructor() { this.children = []; }
    add(object) { this.children.push(object); object.parent = this; }
    remove(object) { this.children = this.children.filter(item => item !== object); object.parent = null; }
  }
  class TestVector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
    normalize() { const length = Math.hypot(this.x, this.y, this.z) || 1; return this.set(this.x / length, this.y / length, this.z / length); }
  }
  class TestQuaternion { setFromUnitVectors(from, to) { this.from = from; this.to = to; return this; } }
  class TestMatrix4 { compose(position, quaternion, scale) { Object.assign(this, { position, quaternion, scale }); return this; } }
  class TestConeGeometry { constructor(radius, height) { Object.assign(this, { radius, height }); } dispose() {} }
  class TestMaterial { constructor(options) { this.options = options; } dispose() {} }
  class TestInstances {
    constructor(geometry, material, count) { Object.assign(this, { geometry, material, count, matrices: [], instanceMatrix: {}, userData: {} }); }
    setMatrixAt(index, matrix) { this.matrices[index] = { ...matrix }; }
    dispose() {}
  }
  const THREE = { Group: TestGroup, Vector3: TestVector3, Quaternion: TestQuaternion, Matrix4: TestMatrix4, ConeGeometry: TestConeGeometry, MeshStandardMaterial: TestMaterial, InstancedMesh: TestInstances };
  const scene = new TestGroup();
  const registry = createResourceRegistry();
  const resources = registry.createOwner("cones");
  const context = { THREE, scene, resources, requestRender() {} };
  const vectorMapping = { x: "x", y: "y", z: "z", u: "u", v: "v", w: "w" };
  const vectorRows = [
    { id: "low", x: 0, y: 0, z: 0, u: 1, v: 0, w: 0 },
    { id: "high", x: 1, y: 1, z: 1, u: 0, v: 2, w: 0 },
  ];
  const vector = makeVectorPlotter(vectorMapping, 0.22, { positionBounds: [[-1, 1], [-1, 1], [-1, 1]] }).create(context, {}, vectorRows);
  const vectorGroup = scene.children[0];
  const vectorInstances = vectorGroup.children[0];
  assert.equal(vectorInstances.count, vectorRows.length);
  assert.equal(vectorInstances.geometry.radius * 2, vectorInstances.geometry.height / 2);
  assert.equal(vectorInstances.matrices[0].scale.y, 0.11);
  assert.equal(vectorInstances.matrices[1].scale.y, 0.22);
  assert.equal(vectorInstances.matrices[0].position.x, -1);
  assert.equal(vector.describeSelection({ instanceId: 1 }).id, "high");
  vector.dispose();

  const rows = [];
  for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) {
    rows.push({ x, y, z, value: x, u: 0, v: 0, w: 1 });
  }
  const coneIso = makeConeIsoPlotter(
    { x: "x", y: "y", z: "z", value: "value" },
    { u: "u", v: "v", w: "w" },
    { threshold: 0.5, minimumArea: 0, maximumHeight: 0.22, color: 0xed5363 },
  ).create(context, {}, rows);
  const coneIsoGroup = scene.children[0];
  const facetCones = coneIsoGroup.children[0];
  assert.ok(coneIso.report.count > 0);
  assert.equal(facetCones.geometry.radius * 2, facetCones.geometry.height / 2);
  assert.equal(facetCones.count, coneIso.report.count);
  assert.ok(facetCones.matrices.every(matrix => Math.abs(matrix.position.x) < 1e-6));
  assert.ok(facetCones.matrices.every(matrix => matrix.quaternion.to.z === 1));
  assert.ok(Math.abs(coneIso.describeSelection({ object: facetCones, instanceId: 0 }).values.fieldMagnitude - 1) < 1e-9);
  coneIso.setLayerVisible("multiple", true);
  coneIso.setSurfaceCount(3);
  assert.equal(coneIso.report.levels.length, 3);
  assert.equal(coneIsoGroup.children.length, 3);
  assert.deepEqual(coneIso.report.levels.map(level => level.color), generateColorShades(0xed5363, 3));
  assert.ok(coneIso.report.levels.every(level => level.count > 0));
  const coarseFacetCount = coneIso.report.count;
  const finerRows = [];
  for (let xi = 0; xi < 5; xi += 1) for (let yi = 0; yi < 5; yi += 1) for (let zi = 0; zi < 5; zi += 1) {
    const x = xi / 4, y = yi / 4, z = zi / 4;
    finerRows.push({ x, y, z, value: x, u: 0, v: 0, w: 1 });
  }
  coneIso.update(finerRows);
  assert.ok(coneIso.report.count > coarseFacetCount, "multiple ConeIso levels should gain facets as tessellation increases");
  coneIso.dispose();

  const filtered = makeConeIsoPlotter(
    { x: "x", y: "y", z: "z", value: "value" },
    { u: "u", v: "v", w: "w" },
    { threshold: 0.5, minimumArea: 100, maximumHeight: 0.22 },
  ).create(context, {}, rows);
  assert.equal(filtered.report.count, 0);
  assert.equal(scene.children[0].children.length, 0);
  filtered.dispose();
  resources.dispose();
});

test("rejects malformed samples, duplicate identifiers, mesh indices, and incompatible grids", () => {
  assert.throws(() => validatePointRecords([{ id: "x", x: 0, y: 0, z: NaN }]), errorCode("INVALID_NUMBER"));
  assert.throws(() => validatePointRecords([{ id: "x", x: 0, y: 0, z: 0 }, { id: "x", x: 1, y: 1, z: 1 }]), errorCode("DUPLICATE_ID"));
  assert.throws(() => validateOrderedSeries([{ id: "s", samples: [{ time: 2, x: 0, y: 0, z: 0 }, { time: 1, x: 0, y: 0, z: 0 }] }]), errorCode("UNORDERED_SERIES"));
  assert.throws(() => validateOrderedSeries([{ id: "mixed", samples: [{ time: 1, x: 0, y: 0, z: 0 }, { sequence: 2, x: 1, y: 1, z: 1 }] }]), errorCode("INCONSISTENT_SERIES_ORDER"));
  assert.throws(() => validateOrderedSeries([{ id: "ambiguous", samples: [{ time: 1, sequence: 1, x: 0, y: 0, z: 0 }] }]), errorCode("INVALID_SERIES_ORDER"));
  assert.throws(() => validateSurfaceMesh({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 4] }), errorCode("MESH_INDEX_OUT_OF_RANGE"));
  assert.throws(() => validateRegularScalarGrid({ dimensions: [2, 2, 2], origin: [0, 0, 0], spacing: [1, 1, 1], sampleLocation: "vertex", values: [0] }), errorCode("GRID_VALUE_COUNT"));
  assert.throws(() => validateNetwork({ nodes: [{ id: "a" }], edges: [{ source: "a", target: "missing" }] }), errorCode("UNKNOWN_EDGE_NODE"));
  assert.throws(() => validateTimeSeries({ frames: [{ time: 1, data: [1] }, { time: 2, data: [1, 2] }] }), errorCode("INCOMPATIBLE_TIME_FRAMES"));
  assert.throws(() => validateTimeSeries({ frames: [{ time: 1, data: { nested: [1] } }, { time: 2, data: { nested: [1, 2] } }] }), errorCode("INCOMPATIBLE_TIME_FRAMES"));
  assert.throws(() => validateTimeSeries({ frames: [{ time: 1, data: new DataView(new ArrayBuffer(4)) }, { time: 2, data: new DataView(new ArrayBuffer(8)) }] }), errorCode("INCOMPATIBLE_TIME_FRAMES"));
  assert.throws(() => validatePointRecords([{ id: "huge", x: Number.MAX_VALUE, y: 0, z: 0 }]), errorCode("FLOAT32_RANGE"));
});

test("coordinate mapper applies baseline, scale, and direction without mutating source", () => {
  const mapper = createCoordinateMapper({
    x: { field: "position.east", baseline: 10, scale: 2 },
    y: { field: "height", baseline: 100, scale: 0.5, direction: -1 },
    z: { field: "depth" },
  });
  const source = { position: { east: 12 }, height: 90, depth: -4 };
  assert.deepEqual(mapper.map(source), { x: 4, y: 5, z: -4 });
  assert.deepEqual(source, { position: { east: 12 }, height: 90, depth: -4 });
  assert.throws(() => createCoordinateMapper({ x: { field: "constructor.prototype.x" }, y: { field: "y" }, z: { field: "z" } }).map({}), errorCode("INVALID_FIELD_PATH"));
});

test("resource registry disposes shared resources only after the last owner releases them", () => {
  const registry = createResourceRegistry();
  const a = registry.createOwner("a");
  const b = registry.createOwner("b");
  const resource = { disposed: 0, dispose() { this.disposed += 1; } };
  a.track(resource);
  a.track(resource);
  b.track(resource);
  a.dispose();
  assert.equal(resource.disposed, 0);
  b.release(resource);
  assert.equal(resource.disposed, 1);
  b.dispose();
  assert.equal(resource.disposed, 1);
  assert.equal(registry.stats.resources, 0);
});

test("point-cloud plotter updates geometry and describes a stable selected record", () => {
  const runtime = fakeRuntime().THREE;
  const scene = { children: [], add(object) { this.children.push(object); }, remove(object) { this.children = this.children.filter(item => item !== object); } };
  const registry = createResourceRegistry();
  const resources = registry.createOwner("points");
  const plotter = pointCloudPlotter.create({ THREE: runtime, scene, resources, requestRender() {} }, { configuration: { pointCloud: {} } }, [{ id: "a", x: 0, y: 1, z: 2 }, { id: "b", x: 3, y: 4, z: 5 }]);
  const previous = scene.children[0].geometry;
  assert.equal(plotter.describeSelection({ index: 1 }).id, "b");
  plotter.update([{ id: "c", x: 6, y: 7, z: 8 }]);
  assert.equal(previous.disposeCalls, 1);
  assert.equal(plotter.describeSelection({ index: 0 }).id, "c");
  plotter.dispose();
  resources.dispose();
  assert.equal(scene.children.length, 0);
});

test("bar plotter maps category pairs to instances and preserves selection values", () => {
  const runtime = fakeRuntime().THREE;
  const scene = { children: [], add(object) { this.children.push(object); }, remove(object) { this.children = this.children.filter(item => item !== object); } };
  const registry = createResourceRegistry();
  const resources = registry.createOwner("bars");
  const records = [
    { id: "one", categoryX: "A", categoryZ: "north", value: 4 },
    { id: "two", categoryX: "B", categoryZ: "south", value: -2 },
  ];
  const plotter = barChartPlotter.create({ THREE: runtime, scene, resources, requestRender() {} }, { configuration: { barChart: {} } }, records);
  const bars = scene.children[0];
  assert.equal(bars.count, 2);
  assert.equal(bars.matrices[0].position.y, 2);
  assert.equal(plotter.describeSelection({ instanceId: 1 }).values.value, -2);
  assert.throws(() => plotter.update([{ ...records[0], id: "duplicate" }, { ...records[0], id: "other" }]), errorCode("DUPLICATE_BAR_CATEGORY"));
  plotter.update([{ id: "three", categoryX: "C", categoryZ: "east", value: 1 }]);
  assert.equal(plotter.describeSelection({ instanceId: 0 }).id, "three");
  plotter.dispose();
  resources.dispose();
  assert.equal(scene.children.length, 0);
});

test("bar plotter preserves custom field mappings across partial style updates", () => {
  const runtime = fakeRuntime().THREE;
  const scene = { children: [], add(object) { this.children.push(object); }, remove(object) { this.children = this.children.filter(item => item !== object); } };
  const resources = createResourceRegistry().createOwner("mapped-bars");
  const plotter = barChartPlotter.create({ THREE: runtime, scene, resources, requestRender() {} }, {
    configuration: { barChart: { mappings: { categoryX: "xcat", categoryZ: "zcat", value: "amount" } } },
  }, [{ id: "initial", xcat: "A", zcat: "North", amount: 7 }]);
  plotter.update([{ id: "next", xcat: "B", zcat: "South", amount: 9 }], { barChart: { color: "red" } });
  assert.deepEqual(plotter.describeSelection({ instanceId: 0 }).values, { categoryX: "B", categoryZ: "South", value: 9 });
  plotter.dispose();
  resources.dispose();
});

test("viewer initializes, updates, switches camera, forwards capabilities, and disposes", async () => {
  const container = new FakeContainer();
  const calls = { update: 0, dispose: 0, time: undefined, tubeRadius: undefined, surfaceCount: undefined };
  const plotter = {
    capabilities: ["time", "tubeRadius", "surfaceCount"],
    create() {
      return {
        update() { calls.update += 1; },
        setTime(value) { calls.time = value; },
        setTubeRadius(value) { calls.tubeRadius = value; },
        setSurfaceCount(value) { calls.surfaceCount = value; },
        dispose() { calls.dispose += 1; },
      };
    },
  };
  const controller = await createViewerWithRuntime(container, { plotter, data: [], configuration: {}, camera: { modes: ["perspective", "orthographic"] } }, fakeRuntime());
  assert.equal(container.children.length, 1);
  assert.ok(controller.capabilities.includes("time"));
  await controller.update([], {});
  controller.setTime(12);
  controller.setTubeRadius(0.02);
  controller.setSurfaceCount(6);
  controller.setCameraMode("orthographic");
  assert.equal(controller.cameraMode, "orthographic");
  controller.setOrbitAngle(Math.PI / 2);
  assert.ok(Math.abs(WebGLRenderer.instances.at(-1).lastRender.camera.position.z) < 1e-10);
  const savedPose = controller.getCameraPose();
  controller.setOrbitAngle(Math.PI);
  controller.setCameraPose(savedPose);
  assert.deepEqual(controller.getCameraPose(), savedPose);
  assert.equal(calls.update, 1);
  assert.equal(calls.time, 12);
  assert.equal(calls.tubeRadius, 0.02);
  assert.equal(calls.surfaceCount, 6);
  controller.dispose();
  assert.equal(container.children.length, 0);
  assert.equal(calls.dispose, 1);
  assert.equal(WebGLRenderer.instances[0].calls.dispose, 1);
  await assert.rejects(controller.update([], {}), errorCode("VIEWER_DISPOSED"));
});

test("viewer reports plotter update errors and preserves the rejected update", async () => {
  const container = new FakeContainer();
  const errors = [];
  const updateError = new Error("invalid update");
  const plotter = {
    create() { return { update() { throw updateError; }, dispose() {} }; },
  };
  const controller = await createViewerWithRuntime(container, { plotter, data: [], configuration: {}, callbacks: { onError: error => errors.push(error) } }, fakeRuntime());
  await assert.rejects(controller.update([], {}), error => error === updateError);
  assert.deepEqual(errors, [updateError]);
  controller.dispose();
});

test("viewer selection callback reports plotter identifiers", async () => {
  const container = new FakeContainer();
  let selected;
  const plotter = {
    capabilities: ["selection"],
    create() { return { update() {}, dispose() {}, describeSelection: hit => ({ id: hit.id }) }; },
  };
  const controller = await createViewerWithRuntime(container, { plotter, data: [], configuration: {}, callbacks: { onSelection: value => { selected = value; } } }, fakeRuntime());
  Raycaster.hits = [{ id: "stable-id", index: 0 }];
  container.children[0].dispatch("pointerup", { clientX: 20, clientY: 30 });
  assert.deepEqual(selected, { id: "stable-id" });
  controller.dispose();
  Raycaster.hits = [];
});

test("viewer reports selection plotter errors through onError", async () => {
  const container = new FakeContainer();
  const errors = [];
  const plotter = {
    capabilities: ["selection"],
    create() { return { update() {}, dispose() {}, describeSelection() { throw new Error("selection failure"); } }; },
  };
  const controller = await createViewerWithRuntime(container, { plotter, data: [], configuration: {}, callbacks: { onError: error => errors.push(error.message) } }, fakeRuntime());
  Raycaster.hits = [{ id: "x" }];
  container.children[0].dispatch("pointerup", { clientX: 20, clientY: 30 });
  assert.deepEqual(errors, ["selection failure"]);
  controller.dispose();
  Raycaster.hits = [];
});

test("animation advances through the renderer loop and stops when hidden", async () => {
  const container = new FakeContainer();
  const frames = [];
  const plotter = {
    capabilities: ["animation"],
    create() { return { update() {}, updateFrame(frame) { frames.push(frame); }, dispose() {} }; },
  };
  const controller = await createViewerWithRuntime(container, { plotter, data: [], configuration: {} }, fakeRuntime());
  const renderer = WebGLRenderer.instances[0];
  controller.play();
  renderer.tick(1000);
  renderer.tick(1016);
  assert.equal(frames.length, 2);
  assert.ok(frames[1].deltaSeconds > 0 && frames[1].deltaSeconds < 0.1);
  container.ownerDocument.hidden = true;
  container.ownerDocument.dispatch("visibilitychange");
  assert.equal(renderer.loop, null);
  container.ownerDocument.hidden = false;
  container.ownerDocument.dispatch("visibilitychange");
  assert.equal(typeof renderer.loop, "function");
  controller.pause();
  assert.equal(renderer.loop, null);
  controller.dispose();
});

test("viewer rolls back canvas and GPU resources when plotter construction fails", async () => {
  const container = new FakeContainer();
  const plotter = { create() { throw new Error("plotter build failure"); } };
  await assert.rejects(
    createViewerWithRuntime(container, { plotter, data: [], configuration: {} }, fakeRuntime()),
    error => error instanceof VisualizationError && error.code === "MOUNT_FAILED",
  );
  assert.equal(container.children.length, 0);
  assert.equal(WebGLRenderer.instances[0].calls.dispose, 1);
});

test("viewer rejects and rolls back when the first render fails", async () => {
  const container = new FakeContainer();
  const plotter = { create() { return { update() {}, dispose() {} }; } };
  const runtime = fakeRuntime();
  WebGLRenderer.failRender = true;
  await assert.rejects(
    createViewerWithRuntime(container, { plotter, data: [], configuration: {} }, runtime),
    error => error instanceof VisualizationError && error.code === "MOUNT_FAILED",
  );
  assert.equal(container.children.length, 0);
  assert.equal(WebGLRenderer.instances[0].calls.dispose, 1);
  WebGLRenderer.failRender = false;
});

test("invalid camera settings fail before renderer or canvas allocation", async () => {
  const container = new FakeContainer();
  const plotter = { create() { return { update() {}, dispose() {} }; } };
  await assert.rejects(
    createViewerWithRuntime(container, { plotter, data: [], configuration: {}, camera: { fov: 180 } }, fakeRuntime()),
    errorCode("INVALID_CAMERA_FOV"),
  );
  assert.equal(WebGLRenderer.instances.length, 0);
  assert.equal(container.children.length, 0);
});

test("public mount reports an unavailable local Three.js runtime without leaving UI", async () => {
  const container = new FakeContainer();
  const plotter = { create() { throw new Error("must not run"); } };
  await assert.rejects(mount(container, { plotter, data: [], configuration: {} }), errorCode("THREE_LOAD_FAILED"));
  assert.equal(container.children.length, 0);
});
