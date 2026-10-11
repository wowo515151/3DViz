export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x=x; this.y=y; this.z=z; return this; }
  setScalar(value) { return this.set(value, value, value); }
  setScalar(value) { return this.set(value, value, value); }
  addScaledVector(vector, scale) { this.x+=vector.x*scale; this.y+=vector.y*scale; this.z+=vector.z*scale; return this; }
  normalize() { const length=Math.hypot(this.x,this.y,this.z)||1; return this.set(this.x/length,this.y/length,this.z/length); }
}

export class Quaternion {
  identity() { this.x=0; this.y=0; this.z=0; this.w=1; return this; }
  setFromUnitVectors(from, to) { this.from=from; this.to=to; return this; }
}

export class Matrix4 {
  compose(position, rotation, scale) { this.position={...position}; this.rotation=rotation; this.scale={...scale}; return this; }
  makeScale(x,y,z) { this.scale={x,y,z}; return this; }
}

export class Object3D {
  constructor() { this.children=[]; this.position=new Vector3(); this.scale=new Vector3(1,1,1); this.userData={}; this.visible=true; }
  add(...objects) { objects.forEach(object=>{if(!this.children.includes(object)){this.children.push(object);object.parent=this;}}); }
  remove(...objects) { objects.forEach(object=>{this.children=this.children.filter(child=>child!==object);object.parent=null;}); }
}
export class Group extends Object3D {}
export class HemisphereLight extends Object3D { constructor(...args){super();this.args=args;} dispose(){this.disposed=true;} }
export class DirectionalLight extends HemisphereLight {}
export class GridHelper extends Object3D { constructor(...args){super();this.args=args;this.geometry=new Geometry();this.material=new Material();} }
export class Geometry { constructor(...args){this.args=args;this.attributes={};this.disposed=false;} setAttribute(key,value){this.attributes[key]=value;} getAttribute(key){return this.attributes[key];} dispose(){this.disposed=true;} }
export class SphereGeometry extends Geometry {}
export class CylinderGeometry extends Geometry {}
export class ConeGeometry extends Geometry {}
export class BufferGeometry extends Geometry {}
export class Float32BufferAttribute {
  constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.needsUpdate=false;}
  setXYZ(index,x,y,z){const offset=index*3;this.array[offset]=x;this.array[offset+1]=y;this.array[offset+2]=z;}
}
export class Material { constructor(options={}){this.options=options;this.disposed=false;} dispose(){this.disposed=true;} }
export class MeshStandardMaterial extends Material {}
export class LineBasicMaterial extends Material {}
export class Color { constructor(value){this.value=value;} }
export class InstancedMesh extends Object3D {
  constructor(geometry,material,count){super();Object.assign(this,{geometry,material,count,matrices:[],colors:[],instanceMatrix:{needsUpdate:false,setUsage(value){this.usage=value;}},instanceColor:{needsUpdate:false},disposeCalls:0});}
  setMatrixAt(index,matrix){this.matrices[index]={position:{...matrix.position},rotation:matrix.rotation,scale:{...matrix.scale}};}
  setColorAt(index,color){this.colors[index]=color;}
  dispose(){this.disposeCalls+=1;}
}
export class LineSegments extends Object3D { constructor(geometry,material){super();this.geometry=geometry;this.material=material;} }
export const DynamicDrawUsage="dynamic";
export const fakeThree={Vector3,Quaternion,Matrix4,Group,HemisphereLight,DirectionalLight,GridHelper,SphereGeometry,CylinderGeometry,ConeGeometry,BufferGeometry,Float32BufferAttribute,MeshStandardMaterial,LineBasicMaterial,Color,InstancedMesh,LineSegments,DynamicDrawUsage};
