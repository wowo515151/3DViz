import * as common from './shared/csv-support.js';
const { addSceneLights, mapBars, projectedColumn, validRows, selected, categoryValue, valueOf, gridForSurface, scalarGridForVolume, displayNumber, extent, parseNumeric, scaleLinear, PALETTE } = common;
import { extractIsosurface } from './shared/isosurface.js';
import { createWireframe } from './shared/wireframe.js';
export function makeIsosurfacePlotter(mapping, options) {
  return Object.freeze({
    capabilities:Object.freeze(["selection","thresholds","layers"]),
    create(context,definition,initialRows){
      const {THREE,scene,resources}=context;
      const removeLights=addSceneLights(THREE,scene);
      const group=new THREE.Group();group.name="csv-isosurfaces";scene.add(group);
      let rows=initialRows, grid, threshold=options.threshold, shells=[], wireframes=[];
      let nested=Boolean(options.nested), wireframeVisible=Boolean(options.wireframe);
      function clear(){
        for(const shell of shells){group.remove(shell.mesh);resources.release(shell.geometry);resources.release(shell.material);}
        for(const wire of wireframes){group.remove(wire.object);resources.release(wire.geometry);resources.release(wire.material);}
        shells=[];wireframes=[];
      }
      function levels(){
        if(!nested) return [threshold];
        const [low,high]=grid.scalarExtent;
        const levels=[low+(high-low)*.25,threshold,low+(high-low)*.75].filter((value,index,array)=>array.findIndex(other=>Math.abs(other-value)<1e-10)===index).sort((a,b)=>a-b);
        return levels;
      }
      function build(){
        clear();grid=scalarGridForVolume(rows,mapping);
        if(!Number.isFinite(threshold)) threshold=(grid.scalarExtent[0]+grid.scalarExtent[1])/2;
        const selectedLevels=levels();
        selectedLevels.forEach((level,index)=>{
          const surface=extractIsosurface(grid,level);
          const geometry=resources.track(new THREE.BufferGeometry());
          geometry.setAttribute("position",new THREE.Float32BufferAttribute(surface.positions,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
          const color=options.color ?? PALETTE[index%PALETTE.length];
          const material=resources.track(new THREE.MeshStandardMaterial({color,roughness:.3,metalness:.12,side:THREE.DoubleSide,transparent:selectedLevels.length>1,opacity:selectedLevels.length>1?0.46:1,depthWrite:selectedLevels.length===1}));
          const mesh=new THREE.Mesh(geometry,material);mesh.userData.triangleRows=surface.triangleRows;mesh.userData.threshold=level;mesh.name=`csv-isosurface-${displayNumber(level)}`;group.add(mesh);
          shells.push({mesh,geometry,material,threshold:level,triangleCount:surface.triangleCount});
          const wire=createWireframe(THREE,geometry,{color:options.wireframeColor ?? color,opacity:.68,full:true});
          resources.track(wire.geometry); resources.track(wire.material);
          wire.object.visible=wireframeVisible;wire.object.name=`csv-isosurface-wire-${displayNumber(level)}`;group.add(wire.object);
          wireframes.push({object:wire.object,geometry:wire.geometry,material:wire.material});
        });
      }
      build();
      return {
        capabilities:["selection","thresholds","layers"],
        update(nextRows){rows=nextRows;build();context.requestRender();},
        setThreshold(value){if(!Number.isFinite(value))throw new Error("Isosurface threshold must be numeric.");if(value<=grid.scalarExtent[0]||value>=grid.scalarExtent[1])throw new Error("Choose an isosurface threshold strictly between the minimum and maximum scalar values.");threshold=value;build();},
        setLayerVisible(id,visible){
          if(id==="wireframe"){wireframeVisible=Boolean(visible);wireframes.forEach(wire=>{wire.object.visible=wireframeVisible;});return;}
          if(id==="multiple"){nested=Boolean(visible);build();context.requestRender();return;}
          throw new Error(`Unknown isosurface layer: ${id}`);
        },
        describeSelection(hit){const row=hit.object?.userData?.triangleRows?.[hit.faceIndex];return row?{id:`row-${row.__rowNumber}`,label:`Isosurface cell near row ${row.__rowNumber}`,values:{...row}}:undefined;},
        dispose(){clear();scene.remove(group);removeLights();},
        get thresholds(){return shells.map(shell=>shell.threshold);},
      };
    },
  });
}
