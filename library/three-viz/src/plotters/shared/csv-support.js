import { retainCarPaintEnvironment } from './materials.js?v=car-paint-20261010a';

const MISSING = new Set(["", "na", "n/a", "null", "nan"]);
export function parseNumeric(value) {
  const text = String(value ?? "").trim();
  if (MISSING.has(text.toLowerCase())) return null;
  if (!/^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function extent(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 0];
  return [Math.min(...finite), Math.max(...finite)];
}

export function scaleLinear(value, low, high, radius = 3.5) {
  if (high === low) return 0;
  return ((value - low) / (high - low) - 0.5) * radius * 2;
}

export function displayNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat(undefined, { maximumSignificantDigits: 5 }).format(value) : "—";
}


export const PALETTE = [0x51c5f0, 0xf4b55f, 0xa994ff, 0x83dcba, 0xff7e7e, 0xe7dc77, 0x69a3ff];
export const validRows = (rows, fields) => rows.map((row, index) => ({ row, index })).filter(({ row }) => fields.every(field => field === "__rowNumber" || (row[field] !== undefined && row[field] !== "")));
export const selected = rows => rows.map(row => Object.fromEntries(Object.entries(row)));
export const categoryValue = (rows, field) => {
  const values = [...new Set(rows.map(row => row[field]))];
  if (values.some(value => value === undefined || value === "")) throw new Error(`Choose a non-empty column for ${field}.`);
  return new Map(values.map((value, index) => [value, index]));
};
export const valueOf = (row, field) => parseNumeric(row[field]);

export function addSceneLights(THREE, scene, renderer) {
  const releaseEnvironment = retainCarPaintEnvironment(THREE, scene, renderer);
  if (typeof THREE.HemisphereLight !== "function" || typeof THREE.DirectionalLight !== "function") return releaseEnvironment;
  const ambient = new THREE.HemisphereLight(0xb4d9ee, 0x111820, 1.15);
  const key = new THREE.DirectionalLight(0xe8f6ff, 1.7);
  const rim = new THREE.DirectionalLight(0x388dce, .55);
  key.position.set(-4, 7, 6);
  rim.position.set(6, 2, -5);
  scene.add(ambient, key, rim);
  return () => { scene.remove(ambient); scene.remove(key); scene.remove(rim); releaseEnvironment(); };
}

export function mapBars(rows, mapping, aggregate) {
  const entries = validRows(rows, [mapping.categoryX, mapping.categoryZ, mapping.value]);
  if (!entries.length) throw new Error("No rows contain all selected bar-chart values.");
  const groups = new Map();
  for (const { row, index } of entries) {
    const value = valueOf(row, mapping.value);
    if (value === null) continue;
    const key = JSON.stringify([row[mapping.categoryX], row[mapping.categoryZ]]);
    const group = groups.get(key) ?? { x: row[mapping.categoryX], z: row[mapping.categoryZ], values: [], rows: [], rowIndices: [] };
    group.values.push(value); group.rows.push(row); group.rowIndices.push(index); groups.set(key, group);
  }
  if (!groups.size) throw new Error("The selected value column has no numeric rows.");
  const result = [...groups.values()].map((group, index) => {
    if (group.values.length > 1 && aggregate === "reject") throw new Error("Several rows share a category pair. Choose an aggregation rule to combine them.");
    const rawValue = aggregate === "count" ? group.values.length : aggregate === "mean" ? group.values.reduce((a, b) => a + b, 0) / group.values.length : aggregate === "min" ? Math.min(...group.values) : aggregate === "max" ? Math.max(...group.values) : group.values.reduce((a, b) => a + b, 0);
    return { id: `bar-${index}`, categoryX: group.x, categoryZ: group.z, rawValue, rows: group.rows, rowIndices: group.rowIndices };
  });
  const max = Math.max(...result.map(item => Math.abs(item.rawValue)), 1e-30);
  return result.map(item => ({ ...item, value: item.rawValue / max * 4 }));
}

export function projectedColumn(rows, field) {
  const raw = rows.map(row => row[field]);
  const numeric = raw.map(parseNumeric);
  if (numeric.every(value => value !== null)) {
    const [min, max] = extent(numeric);
    return { values: numeric.map(value => scaleLinear(value, min, max, 3.4)), legend: `${field}: ${displayNumber(min)} to ${displayNumber(max)}`, categories: null };
  }
  const categories = new Map([...new Set(raw)].map((value, index, all) => [value, scaleLinear(index, 0, Math.max(1, all.length - 1), 3.4)]));
  return { values: raw.map(value => categories.get(value)), legend: `${field}: ${categories.size} equally spaced categories`, categories: [...categories.keys()] };
}

export function gridForSurface(rows, mapping) {
  const usable = validRows(rows, [mapping.x, mapping.z, mapping.height]);
  if (usable.length < 4) throw new Error("A surface requires at least four complete rows forming a 2 by 2 grid.");
  const xs = [...new Set(usable.map(item => valueOf(item.row, mapping.x)))].sort((a, b) => a - b);
  const zs = [...new Set(usable.map(item => valueOf(item.row, mapping.z)))].sort((a, b) => a - b);
  if (xs.length < 2 || zs.length < 2 || xs.length * zs.length !== usable.length) throw new Error("Surface rows must form a complete regular grid with unique X/Z coordinate pairs.");
  const regular = values => values.slice(2).every((value, index) => Math.abs((value - values[index + 1]) - (values[1] - values[0])) < Math.max(1, Math.abs(values[1] - values[0])) * 1e-6);
  if (!regular(xs) || !regular(zs)) throw new Error("Surface X and Z coordinates must be regularly spaced; no interpolation is performed.");
  const cells = Array.from({ length: xs.length }, () => Array(zs.length));
  for (const item of usable) {
    const x = valueOf(item.row, mapping.x), z = valueOf(item.row, mapping.z);
    const ix = xs.indexOf(x), iz = zs.indexOf(z);
    if (cells[ix][iz]) throw new Error(`Surface coordinate pair (${x}, ${z}) is duplicated.`);
    cells[ix][iz] = item;
  }
  if (cells.some(line => line.some(item => !item))) throw new Error("Surface grid has missing coordinate pairs. Missing cells are not interpolated.");
  const heights = usable.map(item => valueOf(item.row, mapping.height));
  const [hMin, hMax] = extent(heights);
  const positions = new Float32Array(xs.length * zs.length * 3);
  const sourceRows = [];
  cells.forEach((line, ix) => line.forEach((item, iz) => {
    const offset = (ix * zs.length + iz) * 3;
    positions[offset] = scaleLinear(xs[ix], xs[0], xs.at(-1));
    positions[offset + 1] = scaleLinear(valueOf(item.row, mapping.height), hMin, hMax, 1.8);
    positions[offset + 2] = scaleLinear(zs[iz], zs[0], zs.at(-1));
    sourceRows.push(item.row);
  }));
  const indices = [];
  const faceCellRows = [];
  for (let ix = 0; ix < xs.length - 1; ix += 1) for (let iz = 0; iz < zs.length - 1; iz += 1) {
    const a = ix * zs.length + iz, b = (ix + 1) * zs.length + iz, c = ix * zs.length + iz + 1, d = (ix + 1) * zs.length + iz + 1;
    indices.push(a, b, d, a, d, c);
    faceCellRows.push(cells[ix][iz].row, cells[ix][iz].row);
  }
  return { positions, indices, faceCellRows, sourceRows, xExtent: [xs[0], xs.at(-1)], zExtent: [zs[0], zs.at(-1)], hExtent: [hMin, hMax] };
}

export function scalarGridForVolume(rows, mapping) {
  const usable = validRows(rows, [mapping.x, mapping.y, mapping.z, mapping.value]);
  if (usable.length < 8) throw new Error("An isosurface needs a complete regular grid with at least 2 samples on each axis.");
  if(usable.some(({row})=>[mapping.x,mapping.y,mapping.z,mapping.value].some(key=>valueOf(row,key)===null))) throw new Error("Isosurface coordinates and scalar values must all be numeric.");
  const axes = [mapping.x, mapping.y, mapping.z].map(key => [...new Set(usable.map(item => valueOf(item.row,key)))].sort((a,b)=>a-b));
  if (axes.some(axis => axis.length < 2) || axes.reduce((count, axis) => count * axis.length, 1) !== usable.length) throw new Error("Isosurface rows must form a complete regular 3D grid with unique coordinate triples.");
  const regular = values => values.slice(2).every((value,index)=>Math.abs((value-values[index+1])-(values[1]-values[0])) < Math.max(1,Math.abs(values[1]-values[0]))*1e-6);
  if (axes.some(axis => !regular(axis))) throw new Error("Isosurface X/Y/Z coordinates must be regularly spaced. Interpolation is not performed.");
  const [xs,ys,zs] = axes;
  const cells = Array.from({length:xs.length},()=>Array.from({length:ys.length},()=>Array(zs.length)));
  for (const item of usable) {
    const row = item.row, x = valueOf(row,mapping.x), y = valueOf(row,mapping.y), z = valueOf(row,mapping.z);
    const ix=xs.indexOf(x), iy=ys.indexOf(y), iz=zs.indexOf(z);
    if (cells[ix][iy][iz]) throw new Error(`Isosurface coordinate (${x}, ${y}, ${z}) is duplicated.`);
    const value=valueOf(row,mapping.value);
    if (value===null) throw new Error(`Isosurface row ${row.__rowNumber} has a missing or nonnumeric scalar value.`);
    cells[ix][iy][iz]={row,value};
  }
  if (cells.some(plane=>plane.some(line=>line.some(cell=>!cell)))) throw new Error("Isosurface grid has missing coordinate triples.");
  const [low,high]=extent(usable.map(item=>valueOf(item.row,mapping.value)));
  const world = (axis,index) => scaleLinear(axis[index],axis[0],axis.at(-1),2.5);
  return { axes, cells, scalarExtent:[low,high], world };
}
