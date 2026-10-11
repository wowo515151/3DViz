import { computeParticleInteractions, createSpinParticleSystem, validateSpinParticles } from "./spin-particle.js?force-arrows-20261010a";
import { makeVectorPlotter, makeIsosurfacePlotter, makeConeIsoPlotter } from "../../library/three-viz/src/index.js?spin-particle-field-scale-20261010d";
import { addSceneLights } from "../../library/three-viz/src/plotters/shared/csv-support.js?spin-particle-shading-20261010a";
import { createCarPaintMaterial } from "../../library/three-viz/src/plotters/shared/materials.js?spin-particle-shading-20261010a";
import { fieldRowsForComponent, sampleParticleFields } from "./spin-particle-fields.js?v=20261010b";
import { SI_INTERACTION_COUPLING } from "./spin-particle-si.js";

const COLORS = Object.freeze({ proton:0x287a48, electron:0x7042a0, neutral:0x9aaabc, moment:0x8bd9d0 });
const UP = Object.freeze([0, 1, 0]);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const FIELD_COLORS = Object.freeze({ electric:0xed5363, magnetic:0x529cff });
const FIELD_EXTENT = 5.5;
const SHARED_ISOSURFACE_HALF_EXTENT = 2.5;
const FIELD_SURFACE_SCALE = FIELD_EXTENT / SHARED_ISOSURFACE_HALF_EXTENT;
const MAX_FORCE_ARROW_LENGTH = 0.4;
const MOMENT_CONE_LENGTH = 0.32;

export const spinParticlePlotter = Object.freeze({
  capabilities:Object.freeze(["animation", "selection"]),
  create(context, _definition, input) {
    const { THREE, scene, resources } = context;
    validateSpinParticles(input.particles);
    let system = createSpinParticleSystem(input.particles, input.interaction);
    let interactionOptions = { softening:0.32, electricCoupling:SI_INTERACTION_COUPLING.electric, magneticCoupling:SI_INTERACTION_COUPLING.magnetic, ...input.interaction };
    let simulationSpeed = clamp(Number(input.simulationSpeed ?? 1), 0.05, 3);
    const fieldOptions = { vectors:false, isosurfaces:false, coneIso:true,
      vectorElectric:true, vectorMagnetic:true, surfaceElectric:true, surfaceMagnetic:true,
      multiple:false, surfaceCount:5, resolution:21, solid:false, wireframe:false, tubeRadius:0.006, threshold:0.28, vectorScale:2.5, coneIsoScale:1.5,
      ...input.fieldOptions };
    const fieldComponentEnabled = (type, component) => {
      const view = type === "vectors" ? "vector" : "surface";
      const componentName = component === "electric" ? "Electric" : "Magnetic";
      return Boolean(fieldOptions[`${view}${componentName}`]);
    };
    const fieldTypeEnabled = type => Boolean(fieldOptions[type] && (type !== "coneIso" || fieldOptions.isosurfaces));
    const fieldTypeGroups = new Map();
    const fieldGroups = new Map();
    const fieldPlotters = new Map();
    let fieldRefreshElapsed = 0;
    const group = new THREE.Group();
    group.name = "spin-particle-system";
    scene.add(group);

    const removeParticleLights = addSceneLights(THREE, scene, context.renderer);

    for (const type of ["vectors", "isosurfaces", "coneIso"]) {
      const typeGroup = new THREE.Group();
      typeGroup.name = `spin-particle-fields-${type}`;
      typeGroup.visible = fieldTypeEnabled(type);
      group.add(typeGroup);
      fieldTypeGroups.set(type, typeGroup);
      for (const component of ["electric", "magnetic"]) {
        const componentGroup = new THREE.Group();
        componentGroup.name = `spin-particle-${component}-${type}`;
        // Shared volume plotters map source coordinates into +/-2.5; expand those meshes back to the field grid's +/-5.5 Å.
        if (type !== "vectors") componentGroup.scale?.set(FIELD_SURFACE_SCALE, FIELD_SURFACE_SCALE, FIELD_SURFACE_SCALE);
        componentGroup.visible = fieldComponentEnabled(type, component);
        typeGroup.add(componentGroup);
        fieldGroups.set(`${type}:${component}`, componentGroup);
      }
    }

    const componentFieldRows = (rows, component) => fieldRowsForComponent(rows, component);
    const createFieldPlotter = (type, component, rows) => {
      const color = FIELD_COLORS[component];
      const scalarMapping = { x:"x", y:"y", z:"z", value:"value" };
      const vectorMapping = { x:"x", y:"y", z:"z", u:"u", v:"v", w:"w" };
      let plotter;
      if (type === "vectors") plotter = makeVectorPlotter(vectorMapping, 0.2 * Number(fieldOptions.vectorScale), {
        color, magnitudeExponent:0.2,
        positionBounds:[[-FIELD_EXTENT, FIELD_EXTENT], [-FIELD_EXTENT, FIELD_EXTENT], [-FIELD_EXTENT, FIELD_EXTENT]],
      });
      else if (type === "isosurfaces") plotter = makeIsosurfacePlotter(scalarMapping, {
        threshold:fieldOptions.threshold, nested:fieldOptions.multiple, surfaceVisible:fieldOptions.solid,
        surfaceCount:fieldOptions.surfaceCount,
        tubeRadius:fieldOptions.tubeRadius, wireframe:fieldOptions.wireframe,
        color, wireframeColor:color,
      });
      else plotter = makeConeIsoPlotter(scalarMapping, vectorMapping, {
        maximumHeight:0.22 * Number(fieldOptions.coneIsoScale), minimumArea:0.002, threshold:fieldOptions.threshold,
        nested:fieldOptions.multiple, surfaceCount:fieldOptions.surfaceCount, color,
      });
      const instance = plotter.create({ ...context, scene:fieldGroups.get(`${type}:${component}`) }, _definition, rows);
      fieldPlotters.set(`${type}:${component}`, { instance, type, component });
    };

    const applyFieldOptions = changed => {
      for (const { instance, type } of fieldPlotters.values()) {
        try {
          if (type === "vectors") {
            if (changed.has("vectorScale")) instance.setMaximumHeight?.(0.2 * Number(fieldOptions.vectorScale));
          } else if (type === "isosurfaces") {
            if (changed.has("solid")) instance.setLayerVisible?.("surface", Boolean(fieldOptions.solid));
            if (changed.has("wireframe")) instance.setLayerVisible?.("wireframe", Boolean(fieldOptions.wireframe));
            if (changed.has("multiple")) instance.setLayerVisible?.("multiple", Boolean(fieldOptions.multiple));
            if (changed.has("surfaceCount")) instance.setSurfaceCount?.(Number(fieldOptions.surfaceCount));
            if (changed.has("tubeRadius")) instance.setTubeRadius?.(Number(fieldOptions.tubeRadius));
            if (changed.has("threshold")) instance.setThreshold?.(Number(fieldOptions.threshold));
          } else if (type === "coneIso") {
            if (changed.has("coneIsoScale")) instance.setMaximumHeight?.(0.22 * Number(fieldOptions.coneIsoScale));
            if (changed.has("multiple")) instance.setLayerVisible?.("multiple", Boolean(fieldOptions.multiple));
            if (changed.has("surfaceCount")) instance.setSurfaceCount?.(Number(fieldOptions.surfaceCount));
            if (changed.has("threshold")) instance.setThreshold?.(Number(fieldOptions.threshold));
          }
        } catch (error) { _definition.callbacks?.onLayerError?.(type, error); }
      }
    };

    const visibleFieldTypes = () => ["vectors", "isosurfaces", "coneIso"].filter(fieldTypeEnabled);
    const fieldsVisible = () => visibleFieldTypes().some(type =>
      ["electric", "magnetic"].some(component => fieldComponentEnabled(type, component)));
    const updateFieldPlotters = () => {
      if (!fieldsVisible()) return;
      const rows = sampleParticleFields(system.particles, {
        resolution:Number(fieldOptions.resolution), extent:FIELD_EXTENT,
        softening:Math.max(Number(interactionOptions.softening), 0.002),
        electricCouplingScale:interactionOptions.electricCoupling / SI_INTERACTION_COUPLING.electric,
        magneticCouplingScale:interactionOptions.magneticCoupling / SI_INTERACTION_COUPLING.magnetic,
      });
      for (const component of ["electric", "magnetic"]) {
        const peak = rows.reduce((maximum, row) => Math.max(maximum, row[`${component}Magnitude`]), 0);
        for (const type of ["vectors", "isosurfaces", "coneIso"]) {
          fieldGroups.get(`${type}:${component}`).visible = Boolean(fieldTypeEnabled(type) && fieldComponentEnabled(type, component) && peak > 0);
        }
      }
      for (const type of visibleFieldTypes()) {
        for (const component of ["electric", "magnetic"]) {
          if (!fieldComponentEnabled(type, component)) continue;
          if (!fieldGroups.get(`${type}:${component}`).visible) continue;
          const key = `${type}:${component}`;
          let plotter = fieldPlotters.get(key);
          if (!plotter) {
            try { createFieldPlotter(type, component, componentFieldRows(rows, component)); }
            catch (error) { _definition.callbacks?.onLayerError?.(type, error); continue; }
            plotter = fieldPlotters.get(key);
          } else {
            try { plotter.instance.update(componentFieldRows(rows, component)); }
            catch (error) { _definition.callbacks?.onLayerError?.(type, error); }
          }
        }
      }
      context.requestRender();
    };

    const grid = new THREE.GridHelper(12, 24, 0x536879, 0x354553);
    grid.position.y = -3.2;
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    resources.track(grid.geometry);
    resources.track(grid.material);
    group.add(grid);

    const particleGeometry = resources.track(new THREE.SphereGeometry(0.17, 32, 24));
    const particleMaterial = resources.track(createCarPaintMaterial(THREE, 0xffffff, {
      roughness:0.2, metalness:0.72, envMapIntensity:1.9,
      ...(typeof THREE.MeshPhysicalMaterial === "function" ? { clearcoat:0.75, clearcoatRoughness:0.12 } : {}),
    }));
    const momentConeGeometry = resources.track(new THREE.ConeGeometry(0.18, 1, 16));
    const forceConeGeometry = resources.track(new THREE.ConeGeometry(0.24, 1, 16));
    const momentMaterial = resources.track(createCarPaintMaterial(THREE, COLORS.moment, {
      roughness:0.18, metalness:0.68, envMapIntensity:2,
      ...(typeof THREE.MeshPhysicalMaterial === "function" ? { clearcoat:0.85, clearcoatRoughness:0.1 } : {}),
    }));
    const electricForceMaterial = resources.track(createCarPaintMaterial(THREE, FIELD_COLORS.electric, { roughness:0.22, metalness:0.45, envMapIntensity:1.5 }));
    const magneticForceMaterial = resources.track(createCarPaintMaterial(THREE, FIELD_COLORS.magnetic, { roughness:0.22, metalness:0.45, envMapIntensity:1.5 }));
    let markerMesh;
    let momentCones;
    let electricForceCones;
    let magneticForceCones;
    let selectedParticles = [];
    let drawMatrix = new THREE.Matrix4();
    let drawPosition = new THREE.Vector3();
    let drawScale = new THREE.Vector3();
    let drawRotation = new THREE.Quaternion();
    let momentOrientation = new THREE.Quaternion();
    const up = new THREE.Vector3(...UP);

    const rebuild = () => {
      const particles = system.particles;
      for (const mesh of [markerMesh, momentCones, electricForceCones, magneticForceCones]) {
        if (!mesh) continue;
        group.remove(mesh);
        resources.release(mesh);
      }
      markerMesh = new THREE.InstancedMesh(particleGeometry, particleMaterial, particles.length);
      markerMesh.name = "spin-particles";
      markerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      markerMesh.userData.spinParticleMarkers = true;
      resources.track(markerMesh);
      group.add(markerMesh);

      momentCones = new THREE.InstancedMesh(momentConeGeometry, momentMaterial, particles.length);
      momentCones.name = "magnetic-moment-cones";
      momentCones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      resources.track(momentCones);
      group.add(momentCones);

      electricForceCones = new THREE.InstancedMesh(forceConeGeometry, electricForceMaterial, particles.length);
      electricForceCones.name = "electric-force-cones";
      electricForceCones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      resources.track(electricForceCones);
      group.add(electricForceCones);
      magneticForceCones = new THREE.InstancedMesh(forceConeGeometry, magneticForceMaterial, particles.length);
      magneticForceCones.name = "magnetic-force-cones";
      magneticForceCones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      resources.track(magneticForceCones);
      group.add(magneticForceCones);

      selectedParticles = particles;
      updateGeometry();
    };

    const updateGeometry = () => {
      const particles = system.particles;
      selectedParticles = particles;
      const { electricForces, magneticForces } = computeParticleInteractions(particles, interactionOptions);
      const electricPeak = Math.max(...electricForces.map(force => Math.hypot(...force)), Number.MIN_VALUE);
      const magneticPeak = Math.max(...magneticForces.map(force => Math.hypot(...force)), Number.MIN_VALUE);
      const setForceGlyph = (coneMesh, index, position, force, peak) => {
        const magnitude = Math.hypot(...force);
        if (magnitude <= Number.EPSILON || peak === Number.MIN_VALUE) {
          drawMatrix.makeScale(0, 0, 0);
          coneMesh.setMatrixAt(index, drawMatrix);
          return;
        }
        const direction = new THREE.Vector3(...force).normalize();
        const orientation = momentOrientation.setFromUnitVectors(up, direction);
        // A single cone rests at the marker sphere and points outward with a short force-scaled length.
        const totalLength = MAX_FORCE_ARROW_LENGTH * magnitude / peak;
        drawPosition.set(...position).addScaledVector(direction, 0.17 + totalLength * 0.5);
        drawScale.setScalar(totalLength);
        drawMatrix.compose(drawPosition, orientation, drawScale);
        coneMesh.setMatrixAt(index, drawMatrix);
      };
      particles.forEach((particle, index) => {
        const chargeColor = particle.charge > 0 ? COLORS.proton : particle.charge < 0 ? COLORS.electron : COLORS.neutral;
        // Marker size identifies a body; it does not encode the electron/proton mass ratio.
        const particleScale = 1;
        drawPosition.set(particle.position[0], particle.position[1], particle.position[2]);
        drawScale.setScalar(particleScale);
        drawMatrix.compose(drawPosition, drawRotation.identity(), drawScale);
        markerMesh.setMatrixAt(index, drawMatrix);
        markerMesh.setColorAt(index, new THREE.Color(chargeColor));

        const momentMagnitude = Math.hypot(...particle.magneticMoment);
        const momentDirection = new THREE.Vector3(...particle.magneticMoment);
        if (momentMagnitude > 1e-8) {
          momentDirection.normalize();
          // Moment glyphs show direction only because proton/electron moments differ by ~658×.
          const coneLength = MOMENT_CONE_LENGTH;
          const orientation = momentOrientation.setFromUnitVectors(up, momentDirection);
          drawPosition.set(...particle.position).addScaledVector(momentDirection, 0.17 + coneLength * 0.5);
          drawScale.setScalar(coneLength);
          drawMatrix.compose(drawPosition, orientation, drawScale);
          momentCones.setMatrixAt(index, drawMatrix);
        } else {
          drawMatrix.makeScale(0, 0, 0);
          momentCones.setMatrixAt(index, drawMatrix);
        }
        setForceGlyph(electricForceCones, index, particle.position, electricForces[index], electricPeak);
        setForceGlyph(magneticForceCones, index, particle.position, magneticForces[index], magneticPeak);
      });
      markerMesh.instanceMatrix.needsUpdate = true;
      if (markerMesh.instanceColor) markerMesh.instanceColor.needsUpdate = true;
      momentCones.instanceMatrix.needsUpdate = true;
      electricForceCones.instanceMatrix.needsUpdate = true;
      magneticForceCones.instanceMatrix.needsUpdate = true;
    };

    rebuild();
    updateFieldPlotters();
    return {
      capabilities:["animation", "selection"],
      update(next = {}) {
        let refreshFields = false;
        if (Number.isFinite(next.step) && next.step > 0) {
          system.step(next.step * simulationSpeed, next.substeps ?? 2);
          updateGeometry();
          refreshFields = true;
          input.onFrame?.(system.elapsedTime, system.particles.length);
        }
        if (Array.isArray(next.particles)) {
          system.reset(next.particles);
          rebuild();
          refreshFields = true;
        }
        if (next.interaction && Object.entries(next.interaction).some(([key, value]) => interactionOptions[key] !== value)) {
          system.setInteraction(next.interaction);
          interactionOptions = { ...interactionOptions, ...next.interaction };
          refreshFields = true;
        }
        if (next.simulationSpeed !== undefined) simulationSpeed = clamp(Number(next.simulationSpeed), 0.05, 3);
        if (next.fieldOptions && Object.entries(next.fieldOptions).some(([key, value]) => fieldOptions[key] !== value)) {
          const changed = new Set(Object.entries(next.fieldOptions).filter(([key, value]) => fieldOptions[key] !== value).map(([key]) => key));
          Object.assign(fieldOptions, next.fieldOptions);
          for (const [type, typeGroup] of fieldTypeGroups) typeGroup.visible = fieldTypeEnabled(type);
          for (const [key, fieldGroup] of fieldGroups) {
            const [type, component] = key.split(":");
            fieldGroup.visible = Boolean(fieldTypeEnabled(type) && fieldComponentEnabled(type, component));
          }
          applyFieldOptions(changed);
          if (["vectors", "isosurfaces", "coneIso", "vectorElectric", "vectorMagnetic", "surfaceElectric", "surfaceMagnetic", "resolution"].some(key => changed.has(key))) refreshFields = true;
        }
        updateGeometry();
        if (refreshFields) updateFieldPlotters();
      },
      updateFrame({ deltaSeconds }) {
        if (deltaSeconds <= 0) return;
        system.step(Math.min(deltaSeconds, 1 / 30) * simulationSpeed, 2);
        updateGeometry();
        fieldRefreshElapsed += deltaSeconds;
        if (fieldRefreshElapsed >= 0.12) {
          fieldRefreshElapsed = 0;
          updateFieldPlotters();
        }
        input.onFrame?.(system.elapsedTime, system.particles.length);
      },
      describeSelection(hit) {
        if (!hit.object || hit.object === markerMesh || hit.object?.userData?.spinParticleMarkers) {
          const particle = selectedParticles[hit.instanceId];
          if (particle) return {
            label:`Particle ${particle.id}`,
            values:{ mass:particle.mass, charge:particle.charge, position:particle.position, velocity:particle.velocity, magneticMoment:particle.magneticMoment, gyromagneticRatio:particle.gyromagneticRatio },
          };
        }
        for (const { instance } of fieldPlotters.values()) {
          const sample = instance.describeSelection?.(hit);
          if (sample?.values?.electricMagnitudeVPerM !== undefined) return { ...sample, kind:"field-sample" };
        }
        return undefined;
      },
      dispose() {
        for (const { instance } of fieldPlotters.values()) instance.dispose?.();
        fieldPlotters.clear();
        for (const resource of [markerMesh, momentCones, electricForceCones, magneticForceCones,
          particleGeometry, particleMaterial, momentConeGeometry, momentMaterial, forceConeGeometry, electricForceMaterial, magneticForceMaterial]) {
          if (resource) resources.release(resource);
        }
        scene.remove(group);
        removeParticleLights();
      },
    };
  },
});
