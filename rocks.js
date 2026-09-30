// Faceted formations share one draw call; collision follows each solid piece.
import * as THREE from 'three';

const point = new THREE.Vector3(), closest = new THREE.Vector3();
const triangle = new THREE.Triangle(), ray = new THREE.Ray();
const rayDirection = new THREE.Vector3(1, .173, .071).normalize();

// style — скалы региона (regions.js: rocks): color, tall, profile, bands, snow, moss, shelves, kinds
export function makeFormation(style, seed, ground, forceKind) {
  let state = seed >>> 0;
  const rand = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const choice = rand();
  const [arch, boulders, split] = style.kinds;
  const kind = forceKind || (choice < arch ? 'arch' : choice < boulders ? 'boulders' : choice < split ? 'split' : 'ridge');
  const positions = [], colors = [], pieces = [];
  const tint = new THREE.Color(style.color), moss = style.moss && new THREE.Color(style.moss);
  const size = .8 + rand() * .4;
  function storePiece(geo,x,z) {
    const p=geo.attributes.position;
    geo.computeVertexNormals(); geo.computeBoundingBox();
    const normals=geo.attributes.normal, shade=.87+rand()*.23;
    for(let i=0;i<p.count;i+=3) {
      const h=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3, ny=normals.getY(i);
      const band=style.bands?Math.sin(h*1.4)*.09:0;
      const c=tint.clone().multiplyScalar(shade+band+(rand()-.5)*.10);
      if(style.snow&&h>ground(x,z)+15&&ny>.36)c.lerp(new THREE.Color(0xe6edf0),.8);
      else if(moss&&ny>.6)c.lerp(moss,.18);
      for(let j=0;j<3;j++){positions.push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));colors.push(c.r,c.g,c.b);}
    }
    pieces.push({box:geo.boundingBox.clone(),vertices:Float32Array.from(p.array)});
    geo.dispose();
  }
  function crag(pier = false) {
    const verts=[], ids=[], rings=[0,.4,.78,1], radii=pier?[1,.98,.90,.83]:style.profile==='mesa'?[1,.96,.80,.64]:style.profile==='peak'?[1,.87,.51,.16]:[1,.9,.60,.30];
    const sides=6, irregular=Array.from({length:sides},()=>.85+rand()*.3);
    rings.forEach((y,k)=>{for(let j=0;j<sides;j++){
      const a=j*Math.PI*2/sides;
      verts.push(Math.cos(a)*radii[k]*irregular[j]+y*.17,y,Math.sin(a)*radii[k]*irregular[j]);
    }});
    for(let k=0;k<3;k++)for(let j=0;j<sides;j++){
      const a=k*sides+j,b=k*sides+(j+1)%sides,c=b+sides,d=a+sides;
      ids.push(a,d,b,b,d,c);
    }
    for(let j=1;j<sides-1;j++){ids.push(0,j,j+1);ids.push(18,18+j+1,18+j);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(ids);
    const flat=g.toNonIndexed();g.dispose();return flat;
  }
  function groundFoot(x,z,width,depth) {
    return Math.min(ground(x,z),ground(x-width,z),ground(x+width,z),ground(x,z-depth),ground(x,z+depth))-.9;
  }
  function piece(x, z, width, tall, depth, y, tilt = 0, pier = false) {
    // Closed convex polyhedra give broad feet and broken shoulders, never cylinders.
    const geo = tall>width*1.9 || pier ? crag(pier) : new THREE.DodecahedronGeometry(1, 0);
    const p = geo.attributes.position;
    const angle = rand() * Math.PI * 2, cs = Math.cos(angle), sn = Math.sin(angle);
    geo.computeBoundingBox();
    const minY = geo.boundingBox.min.y, rangeY = geo.boundingBox.max.y - minY;
    const foot = y ?? groundFoot(x,z,width,depth);
    for (let i = 0; i < p.count; i++) {
      const h = (p.getY(i) - minY) / rangeY;
      const px = p.getX(i) * width, pz = p.getZ(i) * depth;
      p.setXYZ(i, x + px * cs - pz * sn + h * tilt, foot + h * tall, z + px * sn + pz * cs);
    }
    storePiece(geo,x,z);
  }

  let opening = null;
  if (kind === 'arch') {
    // Two grounded piers and a segmented lintel; no collision volume in the opening.
    const floor = Math.max(ground(-15,0),ground(0,0),ground(15,0));
    const spring = floor + 19;
    for(const x of [-15,15]) {
      const foot=groundFoot(x,0,7,5);
      piece(x,0,7,spring+5-foot,5,foot,0,true);
    }
    for(let i=0;i<9;i++) {
      const a=i*Math.PI/9,b=(i+1)*Math.PI/9, v=[];
      for(const z of [-4.5,4.5])for(const [angle,rx,ry] of [[a,20,14],[b,20,14],[b,10,6],[a,10,6]])
        v.push(Math.cos(angle)*rx,spring+Math.sin(angle)*ry,z);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
      g.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);
      const flat=g.toNonIndexed();g.dispose();storePiece(flat,0,0);
    }
    opening = new THREE.Vector3(0,floor+14,0);
  } else {
    const count = kind === 'boulders' ? 5 : kind === 'ridge' ? 6 : 4;
    const tall = (kind === 'boulders' ? 11 : style.tall) * size;
    for(let i=0;i<count;i++) {
      const x = kind === 'ridge' ? (i-(count-1)/2)*4.4 : (i%2===0?-1:1)*(2.8+i*1.3);
      const z = (rand()-.5)*10;
      const h = tall * (i===0?1:.45+rand()*.4);
      const w = (kind==='boulders'?7:5.2+rand()*3)*size;
      piece(x,z,w,h,4.5+rand()*2.5,undefined,(rand()-.5)*5);
      // Charyn and Mangystau shelves visibly overlap the main cliffs.
      if(style.shelves && kind!=='boulders') piece(x-1,z+1,w*1.15,h*.36,5,undefined,1);
    }
  }
  // Talus around the feet, leaving the arch passage clear.
  for(let i=0;i<10;i++) {
    const a=rand()*Math.PI*2, radius=10+rand()*7;
    let x=Math.cos(a)*radius, z=Math.sin(a)*radius*.55;
    if(kind==='arch') x=(i%2?1:-1)*(13+rand()*8);
    const w=1+rand()*2.3;
    piece(x,z,w,w*(.7+rand()),w*.8);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return {geometry,pieces,kind,opening,bounds:geometry.boundingBox.clone()};
}

// Sphere-to-triangle distance plus an inside test, including open arches and crevices.
export function touchesFormation(formation, local, radius) {
  if(formation.bounds.distanceToPoint(local)>radius) return false;
  for(const part of formation.pieces) {
    if(part.box.distanceToPoint(local)>radius) continue;
    const v=part.vertices, hits=[];
    ray.set(local,rayDirection);
    for(let i=0;i<v.length;i+=9) {
      triangle.a.fromArray(v,i);triangle.b.fromArray(v,i+3);triangle.c.fromArray(v,i+6);
      triangle.closestPointToPoint(local,closest);
      if(closest.distanceToSquared(local)<=radius*radius) return true;
      if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,point)) {
        const d=point.distanceToSquared(local);
        if(!hits.some(h=>Math.abs(h-d)<.0001)) hits.push(d);
      }
    }
    if(hits.length%2===1) return true;
  }
  return false;
}
