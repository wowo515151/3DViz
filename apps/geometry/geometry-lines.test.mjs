import assert from "node:assert/strict";
import test from "node:test";
import { replaceLineGeometryPoints } from "./geometry-lines.js";
import { createGeometryLayout, GEOMETRY_CONFIGURATIONS } from "./geometry-model.js";

class FakeFloat32BufferAttribute {
  constructor(array, itemSize) {
    this.array = new Float32Array(array);
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
  }
}

class FakeBufferGeometry {
  setAttribute(name, attribute) {
    this.attributes ??= {};
    this.attributes[name] = attribute;
  }

  computeBoundingSphere() {}
}

const THREE = { Float32BufferAttribute: FakeFloat32BufferAttribute };

function pointsFor(configuration) {
  const layout = createGeometryLayout(configuration, 3, 0.17);
  return layout.bondSegments.flatMap(segment => [segment.start, segment.end].map(([x, y, z]) => ({ x, y, z })));
}

test("configuration changes replace the bond buffer and remove old trailing lines", () => {
  const geometry = new FakeBufferGeometry();
  const bcc = GEOMETRY_CONFIGURATIONS.find(configuration => configuration.id === "ci");
  const primitiveCubic = GEOMETRY_CONFIGURATIONS.find(configuration => configuration.id === "cp");

  replaceLineGeometryPoints(THREE, geometry, pointsFor(bcc));
  assert.equal(geometry.attributes.position.count, 250, "BCC starts with 125 bonds");

  const cubicPoints = pointsFor(primitiveCubic);
  replaceLineGeometryPoints(THREE, geometry, cubicPoints);

  assert.equal(geometry.attributes.position.count, 108, "primitive cubic has exactly 54 bonds after switching");
  assert.equal(geometry.attributes.position.array.length, cubicPoints.length * 3);
});
