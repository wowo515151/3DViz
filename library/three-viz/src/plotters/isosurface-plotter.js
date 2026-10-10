import * as common from './shared/csv-support.js?v=car-paint-20261010a';
const { addSceneLights, mapBars, projectedColumn, validRows, selected, categoryValue, valueOf, gridForSurface, scalarGridForVolume, displayNumber, extent, parseNumeric, scaleLinear, PALETTE } = common;
import { extractIsosurface } from './shared/isosurface.js';
import { createWireframe } from './shared/wireframe.js?v=car-paint-20261010a';
import { createCarPaintMaterial } from './shared/materials.js?v=car-paint-20261010a';
import { generateColorShades } from '../utils/shades.js?v=shades-20261010v';
export function makeIsosurfacePlotter(mapping, options) {
  return Object.freeze({
    capabilities:Object.freeze(["selection","thresholds","layers","tubeRadius","surfaceCount"]),
    create(context,definition,initialRows){
      const {THREE,scene,resources}=context;
      const removeLights=addSceneLights(THREE,scene,context.renderer);
      const group=new THREE.Group();group.name="csv-isosurfaces";scene.add(group);
      let rows=initialRows, grid, threshold=options.threshold, shells=[], wireframes=[];
      let nested=Boolean(options.nested), surfaceVisible=options.surfaceVisible !== false, wireframeVisible=Boolean(options.wireframe), tubeRadius=Math.max(0,Number(options.tubeRadius??0)), surfaceCount=normalizeSurfaceCount(options.surfaceCount??5);
      function clear(){
        for(const shell of shells){group.remove(shell.mesh);resources.release(shell.geometry);resources.release(shell.material);}
        shells=[];clearWireframes();
      }
      function clearWireframes(){
        for(const wire of wireframes){group.remove(wire.object);resources.release(wire.geometry);resources.release(wire.material);}
        wireframes=[];
      }
      function buildWireframes(){
        clearWireframes();
        for(const shell of shells){
          const wire=createWireframe(THREE,shell.geometry,{color:shell.wireframeColor,opacity:1,full:true,tubeRadius});
          resources.track(wire.geometry);resources.track(wire.material);
          wire.object.visible=wireframeVisible;wire.object.name=`csv-isosurface-wire-${displayNumber(shell.threshold)}`;group.add(wire.object);
          wireframes.push({object:wire.object,geometry:wire.geometry,material:wire.material});
        }
      }
      function levels(){
        if(!nested) return [threshold];
        const [low,high]=grid.scalarExtent;
        return Array.from({length:surfaceCount},(_,index)=>low+(high-low)*(index+1)/(surfaceCount+1));
      }
      function build(){
        clear();grid=scalarGridForVolume(rows,mapping);
        if(!Number.isFinite(threshold)) threshold=(grid.scalarExtent[0]+grid.scalarExtent[1])/2;
        const selectedLevels=levels();
        const shades=nested?generateColorShades(options.color??PALETTE[0],selectedLevels.length):[];
        const solidLevel=selectedLevels.reduce((nearest,level)=>Math.abs(level-threshold)<Math.abs(nearest-threshold)?level:nearest,selectedLevels[0]);
        selectedLevels.forEach((level,index)=>{
          const surface=extractIsosurface(grid,level);
          const geometry=resources.track(new THREE.BufferGeometry());
          geometry.setAttribute("position",new THREE.Float32BufferAttribute(surface.positions,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
          const color=nested?shades[index]:(options.color ?? PALETTE[index%PALETTE.length]);
          const wireframeColor=nested?color:(options.wireframeColor ?? color);
          const material=resources.track(createCarPaintMaterial(THREE,color,{side:THREE.DoubleSide,transparent:false,opacity:1,depthWrite:true}));
          const isSolidLevel=selectedLevels.length===1||level===solidLevel;
          const mesh=new THREE.Mesh(geometry,material);mesh.visible=surfaceVisible&&isSolidLevel;mesh.userData.triangleRows=surface.triangleRows;mesh.userData.threshold=level;mesh.name=`csv-isosurface-${displayNumber(level)}`;group.add(mesh);
          shells.push({mesh,geometry,material,threshold:level,triangleCount:surface.triangleCount,isSolidLevel,color,wireframeColor});
        });
        buildWireframes();
      }
      build();
      return {
        capabilities:["selection","thresholds","layers","tubeRadius","surfaceCount"],
        update(nextRows){rows=nextRows;build();context.requestRender();},
        setThreshold(value){if(!Number.isFinite(value))throw new Error("Isosurface threshold must be numeric.");if(value<=grid.scalarExtent[0]||value>=grid.scalarExtent[1])throw new Error("Choose an isosurface threshold strictly between the minimum and maximum scalar values.");threshold=value;build();},
        setLayerVisible(id,visible){
          if(id==="surface"){
            surfaceVisible=Boolean(visible);
            if(surfaceVisible&&nested){nested=false;build();}else shells.forEach(shell=>{shell.mesh.visible=surfaceVisible&&shell.isSolidLevel;});
            context.requestRender();return;
          }
          if(id==="wireframe"){wireframeVisible=Boolean(visible);wireframes.forEach(wire=>{wire.object.visible=wireframeVisible;});context.requestRender();return;}
          if(id==="multiple"){nested=Boolean(visible)&&!surfaceVisible;build();context.requestRender();return;}
          throw new Error(`Unknown isosurface layer: ${id}`);
        },
        setTubeRadius(value){const next=Number(value);if(!Number.isFinite(next)||next<0)throw new Error("Tube radius must be zero or a positive number.");if(next===tubeRadius)return;tubeRadius=next;buildWireframes();context.requestRender();},
        setSurfaceCount(value){const next=normalizeSurfaceCount(value);if(next===surfaceCount)return;surfaceCount=next;build();context.requestRender();},
        describeSelection(hit){const row=hit.object?.userData?.triangleRows?.[hit.faceIndex];return row?{id:`row-${row.__rowNumber}`,label:`Isosurface cell near row ${row.__rowNumber}`,values:{...row}}:undefined;},
        dispose(){clear();scene.remove(group);removeLights();},
        get thresholds(){return shells.map(shell=>shell.threshold);},
      };
    },
  });
}

function normalizeSurfaceCount(value){const count=Number(value);if(!Number.isSafeInteger(count)||count<2||count>20)throw new Error("Surface count must be a whole number from 2 to 20.");return count;}
