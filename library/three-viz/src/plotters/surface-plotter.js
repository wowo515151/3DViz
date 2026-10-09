import * as common from './shared/csv-support.js';
import { createWireframe } from './shared/wireframe.js';
const { addSceneLights, mapBars, projectedColumn, validRows, selected, categoryValue, valueOf, gridForSurface, scalarGridForVolume, displayNumber, extent, parseNumeric, scaleLinear, PALETTE } = common;
export function makeSurfacePlotter(mapping) {
  return Object.freeze({
    capabilities: Object.freeze(["selection", "layers"]),
    create(context, definition, initialRows) {
      const { THREE, scene, resources } = context;
      if (!THREE.BufferGeometry || !THREE.Mesh) throw new Error("Surface display needs Three.js mesh support.");
      const removeLights = addSceneLights(THREE, scene);
      const group = new THREE.Group(); group.name = "csv-surface"; scene.add(group);
      let mesh, wire, grid;
      function clear() {
        if (mesh) { group.remove(mesh); resources.release(mesh.geometry); resources.release(mesh.material); mesh = undefined; }
        if (wire) { group.remove(wire); resources.release(wire.geometry); resources.release(wire.material); wire = undefined; }
      }
      function build(rows) {
        grid = gridForSurface(rows, mapping);
        const geometry = resources.track(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(grid.positions, 3));
        geometry.setIndex(grid.indices);
        geometry.computeVertexNormals(); geometry.computeBoundingSphere();
        const material = resources.track(new THREE.MeshStandardMaterial({ color: 0x53b9e6, roughness: .3, metalness: .12, side: THREE.DoubleSide, flatShading: false }));
        mesh = new THREE.Mesh(geometry, material); mesh.name = "csv-surface-mesh"; group.add(mesh);
        const layer = createWireframe(THREE, geometry, { color: 0xd6f4ff, opacity: .64 });
        resources.track(layer.geometry); resources.track(layer.material);
        wire = layer.object; wire.name = "csv-surface-wireframe"; group.add(wire);
      }
      build(initialRows);
      return {
        capabilities: ["selection", "layers"],
        update(rows) { clear(); build(rows); context.requestRender(); },
        setLayerVisible(id, visible) { if (id !== "wireframe") throw new Error(`Unknown surface layer: ${id}`); wire.visible = Boolean(visible); },
        describeSelection(hit) {
          const row = grid.faceCellRows[hit.faceIndex];
          return row ? { id: `row-${row.__rowNumber}`, label: `Surface cell near row ${row.__rowNumber}`, values: selected([row])[0] } : undefined;
        },
        dispose() { clear(); scene.remove(group); removeLights(); },
      };
    },
  });
}
