import test from "node:test";
import assert from "node:assert/strict";
import { createResourceRegistry } from "../../../library/three-viz/src/core/resource-registry.js";
import { computeParticleInteractions, createSpinParticle } from "../spin-particle.js";
import { spinParticlePlotter } from "../spin-particle-plotter.js";
import { fakeThree } from "./fake-three.js";

test("plotter creates, animates, selects, resets, and disposes a particle scene", () => {
  const registry=createResourceRegistry();
  const resources=registry.createOwner("test-scene");
  const scene=new fakeThree.Group();
  const frameReports=[];
  const context={THREE:fakeThree,scene,resources,renderer:{},requestRender(){this.renderCount=(this.renderCount??0)+1;}};
  const particles=[
    createSpinParticle({id:"positive",position:[-1,0,0],charge:1,magneticMoment:[0,0,0.5]}),
    createSpinParticle({id:"negative",position:[1,0,0],charge:-1,magneticMoment:[0,0,-0.5]}),
  ];
  const instance=spinParticlePlotter.create(context,{}, {particles,onFrame:(time,count)=>frameReports.push({time,count})});
  const group=scene.children.find(child=>child.name==="spin-particle-system");
  assert.ok(group);
  const markers=group.children.find(child=>child.name==="spin-particles");
  const momentCones=group.children.find(child=>child.name==="magnetic-moment-cones");
  const electricForceCones=group.children.find(child=>child.name==="electric-force-cones");
  const magneticForceCones=group.children.find(child=>child.name==="magnetic-force-cones");
  assert.equal(markers.count,2);
  assert.equal(momentCones.count,2,"one moment cone slot is created per particle");
  assert.ok(momentCones.matrices.every(matrix=>matrix.scale.y===0.32),"moment cones keep a compact fixed direction-only size");
  assert.ok(Math.abs(momentCones.matrices[0].position.z-0.33)<1e-12,"moment cone bases start on the sphere surface");
  assert.equal(electricForceCones.count,2,"one electric-force cone slot is created per particle");
  assert.equal(magneticForceCones.count,2,"one magnetic-force cone slot is created per particle");
  assert.ok(electricForceCones.matrices.some(matrix=>matrix.scale.y>0),"nonzero electric forces draw cones");
  assert.ok(magneticForceCones.matrices.some(matrix=>matrix.scale.y>0),"nonzero magnetic forces draw cones");
  assert.equal(markers.colors[0].value,0x287a48,"protons use the dark green particle color");
  assert.equal(markers.colors[1].value,0x7042a0,"electrons use the dark purple particle color");
  assert.equal(instance.describeSelection({instanceId:0}).label,"Particle positive");
  instance.update({step:0.01});
  instance.updateFrame({deltaSeconds:0.02});
  assert.equal(frameReports.length,2);
  assert.ok(frameReports[1].time>frameReports[0].time);
  instance.update({particles:[createSpinParticle({id:"replacement",position:[0,0,0]})]});
  assert.equal(group.children.find(child=>child.name==="spin-particles").count,1);
  assert.equal(group.children.find(child=>child.name==="electric-force-cones").count,1,"force cones rebuild with particle count");
  assert.equal(group.children.some(child=>child.name==="velocity-vectors"),false);
  instance.dispose();
  resources.dispose();
  registry.disposeAll();
  assert.equal(scene.children.length,0);
  assert.equal(registry.stats.resources,0);
});

test("electric force cone lengths follow each particle's relative net electric force", () => {
  const registry=createResourceRegistry();
  const resources=registry.createOwner("force-arrow-scene");
  const scene=new fakeThree.Group();
  const context={THREE:fakeThree,scene,resources,renderer:{},requestRender(){}};
  const particles=[
    createSpinParticle({id:"left",position:[0,0,0],charge:1}),
    createSpinParticle({id:"middle",position:[1,0,0],charge:-1}),
    createSpinParticle({id:"right",position:[3,0,0],charge:-1}),
  ];
  const instance=spinParticlePlotter.create(context,{}, {particles,interaction:{softening:0.1,magneticCoupling:0}});
  const group=scene.children.find(child=>child.name==="spin-particle-system");
  const cones=group.children.find(child=>child.name==="electric-force-cones");
  const lengths=cones.matrices.map(matrix=>matrix.scale.y);
  const electricForces=computeParticleInteractions(particles,{softening:0.1,magneticCoupling:0}).electricForces;
  const expectedRatio=Math.hypot(...electricForces[2]) / Math.hypot(...electricForces[0]);
  assert.ok(Math.abs(Math.max(...lengths)-0.4)<1e-12,"the strongest cone uses a compact 0.4 Å total length");
  assert.ok(lengths[2] > 0 && lengths[2] < lengths[0],"weaker net force is shown with a shorter arrow");
  assert.ok(Math.abs(lengths[2] / lengths[0] - expectedRatio) < 1e-6,"arrow lengths preserve the net-force ratio");
  const leftConeBaseX=cones.matrices[0].position.x-lengths[0]/2;
  assert.ok(Math.abs(leftConeBaseX-0.17)<1e-12,"force cone base sits at the particle sphere surface in the force direction");
  instance.dispose();
  resources.dispose();
  registry.disposeAll();
});

test("plotter independently toggles E and B components for vector and isosurface layers", () => {
  const registry=createResourceRegistry();
  const resources=registry.createOwner("field-test-scene");
  const scene=new fakeThree.Group();
  const context={THREE:fakeThree,scene,resources,renderer:{},requestRender(){this.renderCount=(this.renderCount??0)+1;}};
  const particles=[
    createSpinParticle({id:"source",position:[-1,0,0],velocity:[0,0.2,0],charge:1,magneticMoment:[0,0,0.4]}),
    createSpinParticle({id:"partner",position:[1,0,0],velocity:[0,-0.2,0],charge:-1,magneticMoment:[0,0,-0.4]}),
  ];
  const instance=spinParticlePlotter.create(context,{}, {particles,fieldOptions:{vectors:false,isosurfaces:true,resolution:3}});
  const group=scene.children.find(child=>child.name==="spin-particle-system");
  const vectorGroup=group.children.find(child=>child.name==="spin-particle-fields-vectors");
  const isosurfacesGroup=group.children.find(child=>child.name==="spin-particle-fields-isosurfaces");
  const coneIsoGroup=group.children.find(child=>child.name==="spin-particle-fields-coneIso");
  const isoElectric=isosurfacesGroup.children.find(child=>child.name==="spin-particle-electric-isosurfaces");
  assert.ok(vectorGroup);
  assert.equal(vectorGroup.visible,false,"vector layers start hidden when their checkbox defaults off");
  assert.equal(coneIsoGroup.visible,true,"ConeIso can be enabled within Isosurfaces");
  instance.update({fieldOptions:{vectors:true}});
  assert.equal(vectorGroup.visible,true,"enabling Vector field reveals its parent scene group");
  assert.equal(isoElectric.scale.x,2.2);
  assert.equal(isoElectric.scale.y,2.2);
  assert.equal(isoElectric.scale.z,2.2);
  assert.ok(vectorGroup.children.find(child=>child.name==="spin-particle-electric-vectors").children.some(child=>child.name==="csv-vector-field-cones"));
  assert.ok(vectorGroup.children.find(child=>child.name==="spin-particle-magnetic-vectors").children.some(child=>child.name==="csv-vector-field-cones"));
  const electricPlotterGroup=vectorGroup.children.find(child=>child.name==="spin-particle-electric-vectors").children.find(child=>child.name==="csv-vector-field-cones");
  const electricGlyphs=electricPlotterGroup.children.find(child=>child.name==="field-cones");
  const maxHeight=() => Math.max(...electricGlyphs.matrices.map(matrix=>matrix.scale.y));
  assert.equal(maxHeight(),0.5,"default vector arrows peak at a compact half-angstrom height");
  instance.update({fieldOptions:{vectorScale:2}});
  assert.equal(maxHeight(),0.4);
  const priorRenderCount=context.renderCount;
  instance.update({step:0.002});
  assert.ok(context.renderCount>priorRenderCount);
  instance.update({fieldOptions:{vectorElectric:false}});
  assert.equal(vectorGroup.children.find(child=>child.name==="spin-particle-electric-vectors").visible,false);
  assert.equal(vectorGroup.children.find(child=>child.name==="spin-particle-magnetic-vectors").visible,true);
  assert.equal(isoElectric.visible,true,"vector component selection leaves isosurface components unchanged");
  instance.update({fieldOptions:{surfaceElectric:false}});
  assert.equal(isoElectric.visible,false);
  assert.equal(vectorGroup.children.find(child=>child.name==="spin-particle-magnetic-vectors").visible,true);
  instance.update({fieldOptions:{isosurfaces:false}});
  assert.equal(isosurfacesGroup.visible,false);
  assert.equal(coneIsoGroup.visible,false,"ConeIso hides when Isosurfaces is off");
  instance.dispose();
  resources.dispose();
  registry.disposeAll();
  assert.equal(scene.children.length,0);
  assert.equal(registry.stats.resources,0);
});
