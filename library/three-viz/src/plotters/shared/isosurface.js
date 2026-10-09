const CUBE_CORNERS = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const TETRAHEDRA = [[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
const TETRA_EDGES = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];

export function extractIsosurface(grid, threshold) {
  const [xs,ys,zs]=grid.axes;
  const positions=[];
  const triangleRows=[];
  const interpolate=(a,b)=>{
    const fraction=a.value===b.value?0:(threshold-a.value)/(b.value-a.value);
    return [
      a.position[0]+(b.position[0]-a.position[0])*fraction,
      a.position[1]+(b.position[1]-a.position[1])*fraction,
      a.position[2]+(b.position[2]-a.position[2])*fraction,
    ];
  };
  const emit=(a,b,c,row)=>{ positions.push(...a,...b,...c); triangleRows.push(row,row,row); };
  for(let ix=0;ix<xs.length-1;ix+=1) for(let iy=0;iy<ys.length-1;iy+=1) for(let iz=0;iz<zs.length-1;iz+=1){
    const corners=CUBE_CORNERS.map(([dx,dy,dz])=>{
      const cell=grid.cells[ix+dx][iy+dy][iz+dz];
      return { value:cell.value, row:cell.row, position:[grid.world(xs,ix+dx),grid.world(ys,iy+dy),grid.world(zs,iz+dz)] };
    });
    const cellRow=grid.cells[ix][iy][iz].row;
    for(const tetra of TETRAHEDRA){
      const points=tetra.map(index=>corners[index]);
      const inside=points.map((point,index)=>point.value>=threshold?index:-1).filter(index=>index>=0);
      const outside=points.map((point,index)=>point.value<threshold?index:-1).filter(index=>index>=0);
      if(inside.length===0||inside.length===4) continue;
      if(inside.length===1||inside.length===3){
        const pivot=inside.length===1?inside[0]:outside[0];
        const others=inside.length===1?outside:inside;
        const tri=others.map(index=>interpolate(points[pivot],points[index]));
        emit(tri[0],tri[1],tri[2],cellRow);
      } else {
        const [i0,i1]=inside,[o0,o1]=outside;
        const p0=interpolate(points[i0],points[o0]),p1=interpolate(points[i0],points[o1]);
        const p2=interpolate(points[i1],points[o1]),p3=interpolate(points[i1],points[o0]);
        emit(p0,p1,p2,cellRow); emit(p0,p2,p3,cellRow);
      }
    }
  }
  if(!positions.length) throw new Error(`No scalar grid surface crosses threshold ${String(threshold)}.`);
  return { positions:new Float32Array(positions), triangleRows, triangleCount:positions.length/9 };
}
