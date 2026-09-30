// ================================================================
//  visuals.js — ЗОНА НАПАРНИКА (визуал). Геймплей этот файл не трогает.
//  Детализированное оперение и воздушные следы. Сигнатуры экспортов не менять:
//  от них зависит остальной код.
// ================================================================
import * as THREE from 'three';

// ---------- палитры биомов ----------
// ground: 4 цвета от низа к верху (низина, склон, скала, снег)
export const BIOMES = [
  { name: 'Степь',     fog: '#e7c99e', skyTop: '#477ba2', skyMid: '#dfc7a6',
    ground: ['#78974f', '#b2aa6b', '#8e7854', '#fff4ea'], rock: '#847154', sun: '#fff1c9' },
  { name: 'Чарын',     fog: '#f2a07a', skyTop: '#6a5aa8', skyMid: '#f0806a',
    ground: ['#d9894a', '#c8603a', '#9c3d2c', '#f5d6c0'], rock: '#6e2e22', sun: '#ffe2b0' },
  { name: 'Тянь-Шань', fog: '#b9cfda', skyTop: '#386d9a', skyMid: '#a5c5d5',
    ground: ['#779775', '#8d9a95', '#71828d', '#ffffff'], rock: '#657986', sun: '#fff6e8' },
  { name: 'Ночь',      fog: '#2a3358', skyTop: '#0b1030', skyMid: '#34406e',
    ground: ['#3d4a5e', '#4d5670', '#3a3f5c', '#c8d4f0'], rock: '#252a44', sun: '#e8eeff' },
];

// ---------- беркут ----------
// Возвращает Group, «нос» смотрит в -Z. Внутри wingL / wingR — точки вращения у плеча.
export function createEagle() {
  const eagle = new THREE.Group();
  eagle.name = 'golden-eagle';

  // Original procedural feather surface, shared by all feathers. Fine diagonal
  // barbs live in a texture instead of bright geometric lines or extra meshes.
  const tw = 512, th = 512, pixels = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const u = (x % 256) / 255, v = y / (th - 1), edge = Math.abs(u - 0.5) * 2;
      const vein = Math.sin(v * 670 - edge * 48 + Math.sin(v * 37) * 0.7);
      const fine = Math.sin(v * 1440 - edge * 110);
      const shaft = Math.exp(-Math.pow((u - 0.5) * 95, 2));
      let value = 224 + vein * 9 + fine * 3 + shaft * 22;
      if(x >= 256) {
        // Overlapping contour feathers follow the curved body via sphere UVs.
        const row=Math.floor(v*23),fy=(v*23)%1,fx=((u*19+(row%2)*.5)%1-.5)*2;
        const rim=Math.exp(-Math.pow((fy-(.73-.30*fx*fx))*30,2));
        const hair=Math.sin(fy*47-Math.abs(fx)*10+Math.sin(row)*.9);
        value=212+fy*19-rim*28+hair*7;
      }
      value = Math.min(255, Math.max(0, Math.round(value)));
      const i = (y * tw + x) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = x < 5 && y < 5 ? 255 : value;
      pixels[i + 3] = 255;
    }
  }
  const featherMap = new THREE.DataTexture(pixels, tw, th, THREE.RGBAFormat);
  featherMap.magFilter = THREE.LinearFilter;
  featherMap.minFilter = THREE.LinearMipmapLinearFilter;
  featherMap.generateMipmaps = true; featherMap.anisotropy = 4; featherMap.needsUpdate = true;
  const plumage = new THREE.MeshStandardMaterial({ vertexColors: true, map: featherMap,
    bumpMap: featherMap, bumpScale: 0.012, roughness: 0.92, metalness: 0 });
  const keratin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0 });
  const eyesMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.19, metalness: 0 });
  const bodyParts = [], headParts = [], beakParts = [], eyeParts = [], tailParts = [];
  let featherCount = 0;
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  const color = new THREE.Color();
  function add(list, g, hex, position = [0, 0, 0], scale = [1, 1, 1], angles = [0, 0, 0]) {
    quaternion.setFromEuler(new THREE.Euler(...angles));
    matrix.compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(matrix);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.color) {
      color.set(hex);
      const colors = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) colors.set([color.r, color.g, color.b], i);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    list.push(flat);
  }
  function finish(list, name, material = plumage) {
    const g = new THREE.BufferGeometry();
    for (const [attr, size] of [['position', 3], ['normal', 3], ['color', 3], ['uv', 2]]) {
      const data = new Float32Array(list.reduce((n, part) => n + part.attributes[attr].array.length, 0));
      let offset = 0;
      for (const part of list) { data.set(part.attributes[attr].array, offset); offset += part.attributes[attr].array.length; }
      g.setAttribute(attr, new THREE.BufferAttribute(data, size));
    }
    list.forEach((part) => part.dispose());
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material); mesh.name = name; return mesh;
  }
  function oval(list, hex, p, s, angles = [0, 0, 0], detail = 16) {
    const g = new THREE.SphereGeometry(1, detail, Math.max(8, Math.floor(detail * 0.65)));
    if(list===bodyParts||list===headParts) {
      const uv=g.attributes.uv;
      for(let i=0;i<uv.count;i++) {
        uv.setX(i,.503+uv.getX(i)*.492);
        if(list===headParts && p[2]>-1.7)uv.setY(i,uv.getY(i)*.60);
      }
      if(list===headParts && s[0]>.3) {
        const pos=g.attributes.position,colors=new Float32Array(pos.count*3);
        const base=new THREE.Color(hex),gold=new THREE.Color('#977240');
        for(let i=0;i<pos.count;i++) {
          const dorsal=Math.max(0,pos.getY(i));
          const back=p[2]>-1.7?1:THREE.MathUtils.smoothstep(pos.getZ(i),-.1,.9);
          const c=base.clone().lerp(gold,dorsal*back*.73);
          colors.set([c.r,c.g,c.b],i*3);
        }
        g.setAttribute('color',new THREE.BufferAttribute(colors,3));
      }
    } else g.attributes.uv.array.fill(0);
    add(list, g, hex, p, s, angles);
  }
  function shade(hex, variation) { return new THREE.Color(hex).multiplyScalar(variation); }
  function conformLastFeather(list, surface, lift) {
    const g=list[list.length-1],p=g.attributes.position,n=g.attributes.normal;
    for(let i=0;i<p.count;i++)p.setY(i,surface(p.getX(i),p.getZ(i))+lift+(n.getY(i)>=0?.0015:-.0015));
    g.computeVertexNormals();
  }

  // Cambered vanes with smooth normals and rounded ends. Each feather has a
  // slightly asymmetric outline; large primaries bend upward at their tips.
  function feather(list, base, tip, width, hex, large = false, seed = 0, roll = 0) {
    featherCount++;
    const dx = tip[0] - base[0], dz = tip[2] - base[2], dy = tip[1] - base[1];
    const length = Math.hypot(dx, dz), segments = large ? 12 : 6, cross = large ? 5 : 3;
    const vertices = [], uvs = [], colors = [], indices = [];
    const baseColor = new THREE.Color(hex);
    for (let ring = 0; ring <= segments; ring++) {
      const t = ring / segments;
      let profile;
      if (t < 0.2) profile = 0.22 + t * 1.4;
      else if (t < 0.78) profile = 0.50 - (t - 0.2) * 0.085;
      else profile = 0.451 * Math.sqrt(Math.max(0.0001, 1 - Math.pow((t - 0.78) / 0.22, 2)));
      const curve = Math.sin(t * Math.PI) * width * (large ? 0.07 : 0.04);
      for (let face = 0; face < 2; face++) {
        for (let j = 0; j < cross; j++) {
          const s = j / (cross - 1) * 2 - 1;
          const asymmetry = s < 0 ? 0.87 : 1.04;
          const notch = large && Math.abs(s) > 0.9 ? Math.sin(t * 91 + seed) * 0.005 : 0;
          const x = s * (profile + notch) * width * asymmetry + Math.sin(t * Math.PI) * width * 0.035;
          const camber = (1 - s * s) * width * 0.045 * Math.sin(t * Math.PI);
          const thickness = width * 0.012 * Math.sin(t * Math.PI);
          vertices.push(x, dy * t + curve + (face === 0 ? camber + thickness : -thickness), t * length);
          uvs.push((0.5 + s * profile * asymmetry)*.496, t);
          const edge = Math.pow(Math.abs(s), 5) * 0.09;
          const band = large ? 0.07 * Math.pow(0.5 + Math.sin(t * 23 + seed * 0.3) * 0.5, 3) : 0;
          const c = baseColor.clone().multiplyScalar((0.69 + Math.sqrt(t) * 0.29 + edge - band) * (face ? 0.88 : 1));
          colors.push(c.r, c.g, c.b);
        }
      }
    }
    const stride = cross * 2;
    for (let ring = 0; ring < segments; ring++) {
      for (let face = 0; face < 2; face++) {
        for (let j = 0; j < cross - 1; j++) {
          const a = ring * stride + face * cross + j, b = a + stride;
          if (face === 0) indices.push(a, b, a + 1, a + 1, b, b + 1);
          else indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
      for (const j of [0, cross - 1]) {
        const a = ring * stride + j, b = a + stride;
        if (j === 0) indices.push(a, a + cross, b, a + cross, b + cross, b);
        else indices.push(a, b, a + cross, a + cross, b, b + cross);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices); g.computeVertexNormals();
    add(list, g, hex, base, [1, 1, 1], [0, Math.atan2(dx, dz), roll]);
  }

  // Streamlined body and full breast with fine contour-feather texture.
  oval(bodyParts, '#3f3026', [0, -0.02, 0.10], [0.72, 0.59, 1.62], [0, 0, 0], 24);
  oval(bodyParts, '#463426', [0, -0.16, -0.63], [0.64, 0.55, 0.95], [0, 0, 0], 20);
  const backSurface=(x,z)=>-.02+.59*Math.sqrt(Math.max(.015,1-(x/.72)**2-((z-.10)/1.62)**2));
  for(let row=0;row<7;row++) {
    for(let col=-3;col<=3;col++) {
      const x=col*.145,z=-.90+row*.27;
      feather(bodyParts,[x,0,z],[x*1.04,0,z+.48],.25,
        shade('#594331',.94+((col+row+10)%4)*.025));
      conformLastFeather(bodyParts,backSurface,.019+(6-row)*.008+(col+3)*.002);
    }
  }
  

  // A small raptor head with a dark crown, golden lanceolate nape feathers,
  // deep-set amber eyes, and a low, projecting supraorbital ridge.
  oval(headParts, '#5c4430', [0, 0.16, -1.30], [0.34, 0.31, 0.78], [0, 0, 0], 24);
  oval(headParts, '#53422e', [0, 0.26, -1.96], [0.31, 0.26, 0.54], [0, 0, 0], 24);
  const napeSurface=(x,z)=>Math.max(
    .16+.31*Math.sqrt(Math.max(0,1-(x/.34)**2-((z+1.30)/.78)**2)),
    .26+.26*Math.sqrt(Math.max(0,1-(x/.31)**2-((z+1.96)/.54)**2)));
  for(let row=0;row<5;row++) {
    for(let col=-2;col<=2;col++) {
      const x=col*.09,z=-1.92+row*.18;
      feather(headParts,[x,0,z],[x*1.06,0,z+.31],.155,
        shade('#87623a',.94+((col+row+7)%3)*.035));
      conformLastFeather(headParts,napeSurface,.020+(4-row)*.005+(col+2)*.0015);
    }
  }

  for (const side of [-1, 1]) {
    
    oval(headParts, '#342c23', [side * 0.266, 0.321, -2.13], [0.039, 0.060, 0.077], [0, 0, 0], 16);
    oval(eyeParts, '#a47938', [side * 0.294, 0.328, -2.147], [0.015, 0.041, 0.046], [0, 0, 0], 20);
    oval(eyeParts, '#090b0b', [side * 0.307, 0.329, -2.159], [0.006, 0.025, 0.028], [0, 0, 0], 16);
    oval(eyeParts, '#e9e1c9', [side * 0.314, 0.343, -2.169], [0.003, 0.006, 0.008], [0, 0, 0], 10);
    oval(headParts, '#55432f', [side * 0.252, 0.382, -2.13], [0.056, 0.020, 0.160], [0, 0, side * -0.10], 16);
  }
  oval(beakParts, '#a78c46', [0, 0.18, -2.39], [0.152, 0.105, 0.15], [0, 0, 0], 20);
  // Smooth tapered bill loft follows the downward hook instead of an extrusion.
  const billPath = [[0.20,-2.43,.14,.095],[0.22,-2.51,.128,.097],
    [0.22,-2.60,.105,.089],[0.18,-2.68,.075,.072],[0.10,-2.75,.047,.053],
    [0.01,-2.77,.025,.033],[-0.07,-2.74,.006,.008]];
  const billVertices = [], billIndices = [];
  for (let i = 0; i < billPath.length; i++) {
    const [y,z,rx,ry] = billPath[i];
    const prev = billPath[Math.max(0,i-1)], next = billPath[Math.min(billPath.length-1,i+1)];
    const dy = next[0]-prev[0], dz = next[1]-prev[1], distance = Math.hypot(dy,dz);
    for (let j = 0; j < 16; j++) {
      const angle = j / 16 * Math.PI * 2;
      billVertices.push(Math.cos(angle) * rx, y + Math.sin(angle) * ry * -dz/distance, z + Math.sin(angle) * ry * dy/distance);
      if (i < billPath.length - 1) {
        const a = i * 16 + j, b = i * 16 + (j + 1) % 16;
        billIndices.push(a,a+16,b,b,a+16,b+16);
      }
    }
  }
  const bill = new THREE.BufferGeometry();
  bill.setAttribute('position',new THREE.Float32BufferAttribute(billVertices,3));bill.setIndex(billIndices);bill.computeVertexNormals();
  add(beakParts,bill,'#343a3c');
  oval(beakParts, '#292d2c', [0, 0.095, -2.48], [0.103, 0.035, 0.19], [0.035, 0, 0], 16);
  for (const side of [-1,1]) oval(beakParts,'#292b22',[side*.14,.213,-2.40],[.008,.020,.041],[0,0,0],12);

  const tuckedToeParts=[];
  // Feathered legs and tucked, curved talons, visible from below.
  for (const side of [-1,1]) {
    oval(bodyParts,'#503b29',[side*.35,-.48,.59],[.19,.23,.42],[0,0,0],16);
    oval(beakParts,'#ad8b45',[side*.32,-.65,.85],[.12,.095,.26],[0,0,0],12);
    for(let toe=0;toe<3;toe++) {
      const x=side*.32+(toe-1)*.075;
      oval(tuckedToeParts,'#92753e',[x,-.66,1.02],[.038,.045,.20],[0,0,0],10);
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,-.65,1.15),new THREE.Vector3(x,-.70,1.24),new THREE.Vector3(x,-.77,1.23)]);
      add(tuckedToeParts,new THREE.TubeGeometry(curve,6,.021,5,false),'#272722');
    }
  }
  for (let i=0;i<12;i++) {
    const spread=(i-5.5)/5.5;
    feather(tailParts,[spread*.28,-.02,1.08],[spread*1.11,-.12,3.36-Math.abs(spread)*.21],.39,
      shade('#655340',.91+(i%4)*.035),true,i);
  }
  eagle.add(finish(bodyParts,'body'));
  const head=new THREE.Group();head.name='head';head.position.set(0,.16,-1.3);
  // Feet remain in body space; the bill and eyes follow the stabilized head.
    const footPieces = beakParts.splice(beakParts.length - 2, 2);
  // The two feet were appended before the tail and have their own body mesh.
  const feet=finish([...footPieces,...tuckedToeParts],'tucked-feet',keratin);eagle.add(feet);
  for(const mesh of [finish(headParts,'head-plumage'),finish(beakParts,'bill',keratin),finish(eyeParts,'eyes',eyesMaterial)]) {
    mesh.geometry.translate(0,-.16,1.3);head.add(mesh);
  }
  const tail=finish(tailParts,'tail');tail.geometry.translate(0,0,-1.08);tail.position.z=1.08;
  eagle.add(head,tail);eagle.userData.head=head;eagle.userData.tail=tail;

  function makeWing(side) {
    const wing=new THREE.Group(),inner=[],outer=[];
    wing.position.set(side*.50,.16,-.35);
    // Smooth airfoil volume under the feathers, rounded at the leading edge.
    const sections=[[0,-.58,.70,.16],[.65,-.93,1.08,.18],[1.4,-1.10,1.30,.16],
      [2.25,-1.04,1.15,.12],[3.1,-.79,.85,.08],[3.5,-.48,.57,.045]];
    const vertices=[],indices=[],uv=[];
    for(let i=0;i<sections.length;i++) {
      const [x,front,back,h]=sections[i];
      for(let j=0;j<20;j++) {
        const angle=j/20*Math.PI*2;
        vertices.push(side*x,Math.sin(angle)*h,(front+back)/2-Math.cos(angle)*(back-front)/2);uv.push(0,0);
        if(i<sections.length-1) {
          const a=i*20+j,b=i*20+(j+1)%20;
          if(side>0)indices.push(a,b,a+20,b,b+20,a+20);
          else indices.push(a,a+20,b,b,a+20,b+20);
        }
      }
    }
    const core=new THREE.BufferGeometry();core.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    core.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));core.setIndex(indices);core.computeVertexNormals();
    add(inner,core,'#45372b');
    oval(outer,'#4c3b2c',[side*3.42,.015,.12],[.55,.075,.66],[0,side*.2,0],16);
    for(let i=0;i<16;i++) {
      const x=.26+i*.207,rootZ=.08+Math.max(0,x-2.0)*.09;
      feather(x>3.0?outer:inner,[side*x,-.013,rootZ],[side*(x+.20),-.07,2.13+Math.sin(i*.19)*.15],.38,
        shade('#655440',.92+(i%5)*.023),true,i);
    }
    const tips=[[6.30,-1.03],[6.70,-.60],[6.98,-.03],[7.03,.62],[6.85,1.28],
      [6.48,1.85],[5.98,2.27],[5.40,2.50],[4.80,2.55],[4.20,2.43]];
    tips.forEach(([x,z],i)=>feather(outer,[side*(3.58-i*.043),.013,-.50+i*.16],
      [side*x,.10+Math.sin(i*.35)*.06,z],i<3?.46:.53,shade('#514639',.91+(i%3)*.04),true,i));
    // Closely overlapping contour feathers; no thick raised tiles or gold bars.
    for(let row=0;row<4;row++) {
      for(let i=0;i<20;i++) {
        const jitter=Math.sin(i*2.7+row*1.9);
        const x=.08+i*.20+(row%2)*.075+jitter*.019;
        const front=-.79-Math.sin(Math.min(x,3.7)/3.7*Math.PI)*.21+Math.max(0,x-3)*.27;
        const z=front+row*.34+jitter*.035,y=.14+(3-row)*.036-Math.max(0,x-2.0)*.033;
        feather(x>3.12?outer:inner,[side*x,y,z],[side*(x+.16+jitter*.04),y-.012,z+.69+row*.045+jitter*.055],.30+jitter*.022,
          shade(row<2?'#58432e':'#6b5138',.90+((i*7+row*3)%7)*.024),false,i+row);
      }
    }
    for(let i=0;i<24;i++) {
      const x=.10+i*.145;
      const front=-.82-Math.sin(x/3.6*Math.PI)*.28+Math.max(0,x-2.8)*.26;
      feather(x>3.12?outer:inner,[side*x,.09,front-.02],[side*(x+.08),.19,front+.43],.205,
        shade('#51402c',.92+(i%4)*.025));
    }
    for(let i=0;i<19;i++) {
      const x=.12+i*.18;
      feather(x>3.1?outer:inner,[side*x,-.11,-.39],[side*(x+.12),-.12,.43],.30,'#45362a');
    }
    wing.add(finish(inner,side<0?'left-feathers':'right-feathers'));
    const wrist=new THREE.Group();wrist.name=side<0?'wristL':'wristR';wrist.position.x=side*3.25;
    const hand=finish(outer,side<0?'left-primaries':'right-primaries');hand.geometry.translate(-side*3.25,0,0);
    wrist.add(hand);wing.add(wrist);wing.userData.wrist=wrist;
    for(let layer=0;layer<2;layer++) {
      const i=layer?5:3,[x,z]=tips[i],anchor=new THREE.Object3D();
      anchor.name=(layer?'trailInner':'trailTip')+(side<0?'L':'R');
      anchor.position.set(side*(x-3.25),.10+Math.sin(i*.35)*.06,z);wrist.add(anchor);
    }
    return wing;
  }
  const wingL=makeWing(-1),wingR=makeWing(1);wingL.name='wingL';wingR.name='wingR';
  eagle.add(wingL,wingR);eagle.userData.wingL=wingL;eagle.userData.wingR=wingR;
  eagle.userData.isBerkut=true;eagle.userData.featherCount=featherCount;

  // Лапы для атаки: обычно спрятаны (поджатые лапы нарисованы в туловище), перед поимкой
  // выдвигаются вперёд и вниз. rotation.x: -1.3 — назад под хвост, 0.6 — вперёд к добыче, 0 — вниз с добычей.
  const legMat=new THREE.MeshLambertMaterial({color:'#503b29'}),skinMat=new THREE.MeshLambertMaterial({color:'#b8923f'});
  const clawMat=new THREE.MeshLambertMaterial({color:'#272722'});
  eagle.userData.talons=[-1,1].map((side)=>{
    const hip=new THREE.Group();hip.position.set(side*.33,-.5,.45);hip.visible=false;
    const thigh=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),legMat);thigh.scale.set(.15,.4,.15);thigh.position.y=-.35;
    const shin=new THREE.Mesh(new THREE.CylinderGeometry(.05,.055,.4,6),skinMat);shin.position.y=-.8;
    hip.add(thigh,shin);
    const palm=new THREE.Group();palm.position.y=-1.02;hip.add(palm);
    const pad=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),skinMat);
    pad.scale.set(.12,.065,.14);palm.add(pad);
    const fingers=[];
    for(let i=0;i<4;i++) {
      const rear=i===3, angle=rear?Math.PI:(i-1)*.38;
      const root=new THREE.Group();root.rotation.y=angle;
      root.position.set(rear?0:(i-1)*.065,0,rear?.06:-.06);palm.add(root);
      const curl=new THREE.Group();root.add(curl);
      const length=rear?.20:.24+(i===1?.045:0);
      const segment=(len,r)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.85,r,len,6),skinMat);m.rotation.x=Math.PI/2;m.position.z=-len/2;return m;};
      curl.add(segment(length,.035));
      const joint=new THREE.Group();joint.position.z=-length;curl.add(joint);
      joint.add(segment(.16,.029));
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,-.14),new THREE.Vector3(0,-.025,-.23),new THREE.Vector3(0,-.11,-.27)]);
      joint.add(new THREE.Mesh(new THREE.TubeGeometry(curve,5,.02,5,false),clawMat));
      fingers.push({root,curl,joint,angle,rear});
    }
    hip.userData.palm=palm;hip.userData.fingers=fingers;hip.userData.side=side;
    eagle.add(hip);return hip;
  });
  // сюда вешается добыча, пока беркут несёт её в когтях
  const carry=new THREE.Group();carry.position.set(0,-1.75,.45);eagle.add(carry);eagle.userData.carry=carry;
  eagle.scale.setScalar(1.9);
  return eagle;
}

// ---------- сурок ----------
// Возвращает Group: холмик с норой и userData.body — стоящий «столбиком» сурок,
// мордой к +Z (навстречу беркуту). Геймплей опускает body вниз, когда сурок прячется.
let marmotMats = null;
export function createMarmot() {
  const lam = (color) => new THREE.MeshLambertMaterial({ color });
  marmotMats ||= { fur: lam('#b07a42'), belly: lam('#dcb47c'), dark: lam('#4a3020'),
    dirt: lam('#7a5a3a'), hole: new THREE.MeshBasicMaterial({ color: '#1a120c' }) };
  const m = marmotMats, ball = new THREE.IcosahedronGeometry(1, 1);
  const part = (mat, sx, sy, sz, x, y, z) => {
    const p = new THREE.Mesh(ball, mat);
    p.scale.set(sx, sy, sz); p.position.set(x, y, z);
    return p;
  };

  const group = new THREE.Group();
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 0.6, 8), m.dirt);
  mound.position.y = 0.1;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 8), m.hole);
  hole.rotation.x = -Math.PI / 2; hole.position.y = 0.41;
  group.add(mound, hole);

  const body = new THREE.Group();
  body.add(
    part(m.fur, 0.8, 1.15, 0.7, 0, 1.2, 0),          // туловище
    part(m.belly, 0.55, 0.8, 0.35, 0, 1.1, 0.42),    // светлое брюшко
    part(m.fur, 0.55, 0.5, 0.55, 0, 2.45, 0.05),     // голова
    part(m.belly, 0.28, 0.2, 0.22, 0, 2.3, 0.5),     // мордочка
    part(m.dark, 0.1, 0.1, 0.05, -0.22, 2.55, 0.46), // глаза
    part(m.dark, 0.1, 0.1, 0.05, 0.22, 2.55, 0.46),
    part(m.fur, 0.14, 0.12, 0.08, -0.36, 2.88, 0),   // уши
    part(m.fur, 0.14, 0.12, 0.08, 0.36, 2.88, 0),
    part(m.fur, 0.14, 0.2, 0.14, -0.3, 1.95, 0.62), // лапки у груди
    part(m.fur, 0.14, 0.2, 0.14, 0.3, 1.95, 0.62),
    part(m.dark, 0.2, 0.2, 0.55, 0, 0.45, -0.75),    // хвост
  );
  group.add(body);
  group.userData.body = body;
  group.scale.setScalar(1.3);
  return group;
}

// ---------- свечение над добычей ----------
// Мягкое тёплое пятно, чтобы добычу было видно издалека и в тумане
let preyGlowMat = null;
function preyGlow(size) {
  if (!preyGlowMat) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,236,170,0.9)'); g.addColorStop(0.35, 'rgba(255,214,120,0.45)'); g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    preyGlowMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false });
  }
  const s = new THREE.Sprite(preyGlowMat);
  s.scale.set(size, size, 1);
  return s;
}

// ---------- общее для добычи ----------
// Гранёный шар: у каждой грани своя нормаль — low-poly, как у скал
let facetBall = null;
function facet(mat, sx, sy, sz, x, y, z) {
  if (!facetBall) { facetBall = new THREE.IcosahedronGeometry(1, 1); facetBall.computeVertexNormals(); }
  const p = new THREE.Mesh(facetBall, mat);
  p.scale.set(sx, sy, sz); p.position.set(x, y, z);
  return p;
}
const lam = (color) => new THREE.MeshLambertMaterial({ color });

// ---------- кеклик ----------
// Group клювом к +Z, масштаб 1.8. userData: wingL / wingR — плечо (rotation.z — взмах),
// у каждого крыла userData.hand — кисть с маховыми перьями (сгиб); head, tail.
let keklikMats = null;
export function createKeklik() {
  keklikMats ||= { back: lam('#9a8878'), grey: lam('#a3a9b3'), belly: lam('#e6cfa3'), cream: lam('#f1e6cf'),
    black: lam('#1b1716'), chestnut: lam('#8a4a2a'), red: lam('#d23a2a'), rufous: lam('#b5653a'),
    primary: lam('#7a6b5e'), leg: lam('#d06a5a') };
  const m = keklikMats;
  const group = new THREE.Group();

  // туловище: серо-бурая спина, серо-голубая грудь, песочное брюхо
  group.add(
    facet(m.back, 0.47, 0.36, 0.74, 0, 0.08, -0.02),
    facet(m.grey, 0.43, 0.4, 0.42, 0, 0.02, 0.42),
    facet(m.belly, 0.38, 0.28, 0.58, 0, -0.16, 0),
    facet(m.grey, 0.26, 0.26, 0.26, 0, 0.28, 0.66), // шея
  );
  // бока: светлое поле с косыми чёрными и рыжими полосами
  for (const side of [-1, 1]) {
    group.add(facet(m.cream, 0.07, 0.22, 0.34, side * 0.4, -0.02, -0.04));
    for (let i = 0; i < 5; i++) {
      const z = -0.3 + i * 0.12;
      for (const [mat, dz] of [[m.black, 0], [m.chestnut, 0.045]]) {
        const bar = facet(mat, 0.03, 0.2, 0.025, side * 0.445, -0.02, z + dz);
        bar.rotation.x = -0.35;
        group.add(bar);
      }
    }
  }

  // голова: серая шапочка, светлое горло в чёрном «ожерелье» через глаза, красные клюв и кольцо у глаза
  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.82);
  head.add(facet(m.grey, 0.25, 0.24, 0.27, 0, 0, 0), facet(m.cream, 0.19, 0.14, 0.14, 0, -0.1, 0.12));
  const necklace = new THREE.CatmullRomCurve3([
    [0, 0.1, 0.25], [-0.18, 0.05, 0.14], [-0.21, -0.12, 0.03], [0, -0.25, 0.1],
    [0.21, -0.12, 0.03], [0.18, 0.05, 0.14]].map((v) => new THREE.Vector3(...v)), true);
  head.add(new THREE.Mesh(new THREE.TubeGeometry(necklace, 24, 0.035, 5, true), m.black));
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), m.black);
    eye.position.set(side * 0.2, 0.05, 0.1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 5, 12), m.red);
    ring.position.copy(eye.position); ring.rotation.y = Math.PI / 2;
    head.add(eye, ring);
  }
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.17, 6), m.red);
  bill.position.set(0, 0, 0.32); bill.rotation.x = Math.PI / 2;
  head.add(bill);
  group.add(head);

  // хвост веером: крайние перья рыжие
  const tail = new THREE.Group();
  tail.position.set(0, 0.08, -0.66); tail.rotation.x = 0.15;
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Group();
    f.rotation.y = (i - 3) * 0.16;
    const blade = facet(i < 2 || i > 4 ? m.rufous : m.back, 0.06, 0.018, 0.22, 0, 0, -0.2);
    f.add(blade);
    tail.add(f);
  }
  group.add(tail);

  // лапки поджаты в полёте
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.26, 5), m.leg);
    leg.position.set(side * 0.1, -0.34, -0.12); leg.rotation.x = Math.PI / 2 - 0.3;
    group.add(leg);
  }

  // крылья: плечо с кроющими перьями и кисть с пятью маховыми
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(side * 0.33, 0.18, 0.1);
    wing.add(facet(m.back, 0.42, 0.05, 0.26, side * 0.38, 0, 0));
    const hand = new THREE.Group();
    hand.position.x = side * 0.72;
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Group();
      f.rotation.y = side * (0.28 - i * 0.14);
      f.add(facet(m.primary, 0.34, 0.022, 0.075, side * 0.28, 0, 0));
      hand.add(f);
    }
    wing.add(hand);
    wing.userData.hand = hand;
    group.add(wing);
    group.userData[side < 0 ? 'wingL' : 'wingR'] = wing;
  }
  group.userData.head = head;
  group.userData.tail = tail;
  group.add(preyGlow(4.5));
  group.scale.setScalar(1.8);
  return group;
}

// ---------- козлёнок тау-теке ----------
// Group: скальный уступ и userData.body — козлёнок мордой к +Z, масштаб 2.2.
// body.userData: neck (поворот головы), ears, tail, legs — для движений на уступе и в когтях.
let ibexMats = null;
export function createIbexKid() {
  // светло-песочная шерсть и тёмный уступ — силуэт читается на серой скале
  ibexMats ||= { coat: lam('#e0c28e'), light: lam('#f6ecd9'), stripe: lam('#5a3d26'), black: lam('#2a2019'),
    horn: lam('#6d5c46'), nose: lam('#3b2a1c'), ledge: lam('#454c55'), pebble: lam('#5a626b') };
  const m = ibexMats;
  const group = new THREE.Group();
  const ledge = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), m.ledge);
  ledge.scale.set(2.4, 0.7, 1.9); ledge.position.y = -0.3;
  group.add(ledge);
  for (const [x, z, s] of [[1.5, 0.9, 0.3], [-1.7, -0.6, 0.25], [1.2, -1.1, 0.2], [-1.3, 1.0, 0.18]])
    group.add(facet(m.pebble, s, s * 0.7, s, x, 0.25, z));

  const body = new THREE.Group();
  // туловище на длинных ногах: грудь, зад, светлое брюхо, тёмный «ремень» по спине
  body.add(
    facet(m.coat, 0.44, 0.36, 0.72, 0, 1.4, 0),
    facet(m.coat, 0.36, 0.38, 0.34, 0, 1.42, 0.5),
    facet(m.coat, 0.38, 0.36, 0.34, 0, 1.44, -0.5),
    facet(m.light, 0.34, 0.2, 0.6, 0, 1.2, 0.02),
    facet(m.stripe, 0.07, 0.05, 0.8, 0, 1.75, 0),
  );

  // шея и голова: крупная голова, большие уши, маленькие рожки назад
  const neck = new THREE.Group();
  neck.position.set(0, 1.62, 0.62);
  const neckPart = facet(m.coat, 0.17, 0.34, 0.19, 0, 0.18, 0.08);
  neckPart.rotation.x = 0.35;
  neck.add(neckPart);
  const head = new THREE.Group();
  head.position.set(0, 0.45, 0.2);
  head.add(
    facet(m.coat, 0.22, 0.24, 0.3, 0, 0, 0),
    facet(m.coat, 0.14, 0.14, 0.2, 0, -0.08, 0.26),   // морда
    facet(m.nose, 0.09, 0.07, 0.06, 0, -0.07, 0.43),  // нос
    facet(m.light, 0.1, 0.1, 0.14, 0, -0.16, 0.15),   // светлый подбородок
  );
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), m.black);
    eye.position.set(side * 0.17, 0.05, 0.12);
    head.add(eye);
    const horn = new THREE.CatmullRomCurve3([[0, 0, 0], [0, 0.12, -0.03], [0, 0.2, -0.12], [0, 0.22, -0.2]]
      .map(([x, y, z]) => new THREE.Vector3(x + side * 0.08, y + 0.18, z + 0.02)));
    head.add(new THREE.Mesh(new THREE.TubeGeometry(horn, 8, 0.03, 5, false), m.horn));
  }
  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Group();
    ear.position.set(side * 0.17, 0.13, -0.02);
    const leaf = facet(m.coat, 0.06, 0.18, 0.1, side * 0.1, 0.02, 0);
    leaf.rotation.z = -side * 1.0;
    ear.add(leaf);
    head.add(ear);
    return ear;
  });
  neck.add(head);
  body.add(neck);

  // короткий тёмный хвостик
  const tail = new THREE.Group();
  tail.position.set(0, 1.6, -0.78);
  const tailPart = facet(m.stripe, 0.07, 0.12, 0.06, 0, 0.02, -0.05);
  tailPart.rotation.x = -0.5;
  tail.add(tailPart);
  body.add(tail);

  // ноги: бедро, светлая голень с тёмной полосой спереди, копытце
  const legs = [];
  for (const [x, z] of [[-0.22, 0.48], [0.22, 0.48], [-0.22, -0.48], [0.22, -0.48]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 1.2, z);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.068, 0.56, 6), m.light);
    shin.position.y = -0.72;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.02), m.stripe);
    stripe.position.set(0, -0.72, 0.06);
    leg.add(facet(m.coat, 0.1, 0.28, 0.12, 0, -0.22, 0), facet(m.coat, 0.075, 0.08, 0.08, 0, -0.44, 0), // бедро и колено
      shin, stripe, facet(m.black, 0.08, 0.07, 0.1, 0, -1.18, 0.01));
    body.add(leg);
    legs.push(leg);
  }

  const glow = preyGlow(5);
  glow.position.y = 1.6;
  body.add(glow); // в body — исчезает вместе с пойманным козлёнком
  body.userData = { neck, head, ears, tail, legs };
  group.add(body);
  group.userData.body = body;
  group.scale.setScalar(2.2);
  return group;
}


// ---------- скальный выступ Тянь-Шаня ----------
// Гранёный зуб от подножия стены до плоской площадки, на которой стоит козлёнок.
// Вершина — в (0, h, 0); основание сдвинуто на lean по x, к стене. Снег на пологих гранях у вершины.
export const SPUR_TOP = 3.2, SPUR_BASE = 6.5; // радиусы вершины и основания, м
export const spurMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
export function createSpur(h, lean, seed) {
  let st = seed >>> 0;
  const rand = () => (st = (Math.imul(st, 1664525) + 1013904223) >>> 0) / 4294967296;
  let g = new THREE.CylinderGeometry(SPUR_TOP, SPUR_BASE, h, 7, 5);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  const jitter = new Map(); // одинаковый сдвиг для совпадающих вершин — без щелей на шве
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
    if (!jitter.has(key)) jitter.set(key, [(rand() - 0.5) * 1.6, (rand() - 0.5) * 1.2]);
    const [j, jy] = jitter.get(key), t = y / h;
    const flatTop = y > h - 0.01;                   // площадка на вершине остаётся ровной
    p.setXYZ(i, x * (1 + j * 0.12) + lean * (1 - t), flatTop ? y : Math.max(0, y + jy), z * (1 + j * 0.12));
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  const pos = g.attributes.position, nrm = g.attributes.normal, colors = [];
  const rock = new THREE.Color('#87929b'), snow = new THREE.Color('#e6edf0'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    c.copy(rock).multiplyScalar(0.82 + rand() * 0.3 + Math.sin(y * 1.3) * 0.04); // полосы породы
    if (nrm.getY(i) > 0.55 && y > h - 4) c.lerp(snow, 0.85);
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

// ---------- небо, солнце, горы, свет, туман ----------
export function createSky(scene) {
  const b = BIOMES[0];
  scene.fog = new THREE.Fog(new THREE.Color(b.fog), 120, 520);

  const uniforms = {
    top: { value: new THREE.Color(b.skyTop) },
    mid: { value: new THREE.Color(b.skyMid) },
    bot: { value: new THREE.Color(b.fog) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1200, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 top,mid,bot; varying vec3 vP;
        void main(){ float h=vP.y;
          vec3 c = h>0.08 ? mix(mid,top,smoothstep(0.08,0.55,h)) : mix(bot,mid,smoothstep(-0.05,0.08,h));
          float glow=pow(max(0.,dot(normalize(vP),normalize(vec3(-160.,170.,-900.)))),48.);
          c+=vec3(.22,.14,.055)*glow;
          gl_FragColor=vec4(c,1.0);}`,
    })
  );
  scene.add(sky);

  const sun = new THREE.Mesh(new THREE.CircleGeometry(24, 48), new THREE.MeshBasicMaterial({ color: b.sun, fog: false }));
  scene.add(sun);

  const hemi = new THREE.HemisphereLight('#e3edf2', '#736c47', 0.85);
  const dir = new THREE.DirectionalLight('#ffd08a', 1.1);
  scene.add(hemi, dir, dir.target);

  // дальние горы-силуэты
  const mountMat = new THREE.MeshLambertMaterial({ color: '#819193' });
  const snowMat = new THREE.MeshLambertMaterial({ color: '#fff4ea' });
  const mountains = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const r = 40 + Math.random() * 60, h = 90 + Math.random() * 120;
    const seg = 5 + Math.floor(Math.random() * 3);
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg, 1), mountMat);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.32, seg, 1), snowMat);
    cap.position.y = h * 0.34 + 0.5; mesh.add(cap);
    mesh.position.set((Math.random() - 0.5) * 1400, h / 2 - 20, -700 - Math.random() * 250);
    mesh.rotation.y = Math.random() * Math.PI;
    mountains.add(mesh);
  }
  scene.add(mountains);

  const api = {
    uniforms, sun, hemi, dir, mountMat,
    update(playerPos /* , timeOfDay01 */) {
      sky.position.set(playerPos.x, 0, playerPos.z);
      sun.position.set(playerPos.x - 160, 170, playerPos.z - 900);
      mountains.position.set(playerPos.x * 0.3, 0, playerPos.z);
      dir.position.set(playerPos.x - 80, 120, playerPos.z - 200);
      dir.target.position.copy(playerPos);
    },
  };
  scene.userData.sky = api;
  return api;
}

// ---------- плавный переход между биомами ----------
// i — индекс нового биома, t — 0..1 (0 = ещё предыдущий, 1 = полностью новый)
const _a = new THREE.Color(), _b = new THREE.Color();
function mixHex(from, to, t, out) { return out.copy(_a.set(from)).lerp(_b.set(to), t); }

export function applyBiome(scene, i, t) {
  const sky = scene.userData.sky;
  if (!sky) return;
  const to = BIOMES[i % BIOMES.length];
  const from = BIOMES[(i - 1 + BIOMES.length) % BIOMES.length];
  mixHex(from.skyTop, to.skyTop, t, sky.uniforms.top.value);
  mixHex(from.skyMid, to.skyMid, t, sky.uniforms.mid.value);
  mixHex(from.fog, to.fog, t, sky.uniforms.bot.value);
  mixHex(from.fog, to.fog, t, scene.fog.color);
  mixHex(from.sun, to.sun, t, sky.sun.material.color);
  // ночью свет тусклее и холоднее
  const night = (n) => (n.name === 'Ночь' ? 1 : 0);
  const k = night(from) + (night(to) - night(from)) * t;
  sky.hemi.intensity = 0.85 - 0.40 * k;
  sky.dir.intensity = 1.1 - 0.6 * k;
  sky.dir.color.set('#ffd08a').lerp(_b.set('#9fb4ff'), k);
}

// ---------- воздушные следы ----------
// World-space history follows the feather tips, including banking and flapping.
// Fixed buffers keep the cost constant; no textures or postprocessing dependency.
function createWingTrails(scene, eagle, camera) {
  const capacity = 128, lifetime = 1.15;
  const group = new THREE.Group();
  group.name = 'berkut-wing-trails';
  scene.add(group);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { strength: { value: 0.8 } },
    vertexShader: `varying vec2 vUv; varying float vPower;
      attribute float power;
      void main() { vUv = uv; vPower = power;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; varying float vPower; uniform float strength;
      void main() {
        float edge = abs(vUv.x * 2.0 - 1.0);
        float core = exp(-edge * edge * 52.0);
        float halo = pow(max(0.0, 1.0 - edge), 2.0);
        float fade = pow(max(0.0, 1.0 - vUv.y), 1.65);
        vec3 color = mix(vec3(0.60, 0.78, 1.0), vec3(1.0, 0.91, 0.70), core);
        float alpha = (core * 0.82 + halo * 0.28) * fade * strength * vPower;
        gl_FragColor = vec4(color, alpha);
      }`,
  });
  const streams = [];
  for (const side of [-1, 1]) {
    const wing = side < 0 ? eagle.userData.wingL : eagle.userData.wingR;
    for (let layer = 0; layer < 2; layer++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 6), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(capacity * 4), 2).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('power', new THREE.BufferAttribute(new Float32Array(capacity * 2).fill(layer ? 0.38 : 1), 1));
      const indices = [];
      for (let i = 0; i < capacity - 1; i++) {
        const j = i * 2; indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
      }
      geometry.setIndex(indices); geometry.setDrawRange(0, 0);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false; mesh.renderOrder = 2;
      group.add(mesh);
      streams.push({ wing, layer, geometry, mesh,
        tip: wing.getObjectByName((layer ? 'trailInner' : 'trailTip') + (side < 0 ? 'L' : 'R')),
        anchor: new THREE.Vector3(side * (layer ? 5.68 : 6.49), 0.20, layer ? 2.13 : 0.99),
        points: Array.from({ length: capacity }, () => new THREE.Vector3()),
      });
    }
  }
  const times = new Float64Array(capacity);
  const previous = new THREE.Vector3(), position = new THREE.Vector3();
  const center = new THREE.Vector3(), tangent = new THREE.Vector3();
  const view = new THREE.Vector3(), across = new THREE.Vector3();
  let head = -1, count = 0, lastTime = null, lastSample = -Infinity, speed = 0;
  function clear() {
    head = -1; count = 0; speed = 0; lastSample = -Infinity;
    for (const stream of streams) stream.geometry.setDrawRange(0, 0);
  }
  return {
    update(now) {
      eagle.updateWorldMatrix(true, true);
      eagle.getWorldPosition(position);
      const dt = lastTime === null ? 0 : now - lastTime;
      const dz = previous.z - position.z;
      const reset = lastTime === null || dt > 0.25 || dt <= 0 || dz < -0.05 || position.distanceTo(previous) > 35;
      if (reset || !eagle.visible) clear();
      else speed += (Math.max(0, dz / dt) - speed) * Math.min(1, dt * 9);
      // A restart, tab suspension or stopped game must never connect old paths.
      const moving = !reset && eagle.visible && dz > 0.0001;
      while (count && now - times[(head - count + 1 + capacity) % capacity] > lifetime) count--;
      if (moving && now - lastSample >= 1 / 90) {
        head = (head + 1) % capacity;
        count = Math.min(capacity, count + 1); times[head] = now; lastSample = now;
        for (const stream of streams) {
          if (stream.tip) stream.points[head].setFromMatrixPosition(stream.tip.matrixWorld);
          else stream.points[head].copy(stream.anchor).applyMatrix4(stream.wing.matrixWorld);
        }
      }
      group.position.copy(position);
      material.uniforms.strength.value = 0.75 + Math.min(speed / 140, 1) * 0.65;
      const width = 0.72 + Math.min(speed / 140, 1) * 0.95;
      for (const stream of streams) {
        const p = stream.geometry.attributes.position, uv = stream.geometry.attributes.uv;
        for (let i = 0; i < count; i++) {
          const index = (head - i + capacity) % capacity;
          const age = Math.min(1, (now - times[index]) / lifetime);
          center.copy(stream.points[index]);
          const before = stream.points[(head - Math.max(0, i - 1) + capacity) % capacity];
          const after = stream.points[(head - Math.min(count - 1, i + 1) + capacity) % capacity];
          tangent.subVectors(after, before).normalize();
          view.subVectors(camera.position, center).normalize();
          across.crossVectors(tangent, view);
          if (across.lengthSq() < 0.000001) across.set(1, 0, 0);
          across.normalize().multiplyScalar(width * (stream.layer ? 0.52 : 1) * (0.36 + Math.sin(age * Math.PI) * 0.64));
          center.sub(position);
          for (let edge = 0; edge < 2; edge++) {
            const sign = edge ? 1 : -1;
            p.setXYZ(i * 2 + edge, center.x + across.x * sign, center.y + across.y * sign, center.z + across.z * sign);
            uv.setXY(i * 2 + edge, edge, age);
          }
        }
        stream.geometry.setDrawRange(0, Math.max(0, count - 1) * 6);
        p.needsUpdate = true; uv.needsUpdate = true;
      }
      previous.copy(position); lastTime = now;
    },
    dispose() {
      streams.forEach((s) => s.geometry.dispose()); material.dispose(); scene.remove(group);
    },
  };
}

// ---------- отрисовка ----------
export function createPostFX(renderer, scene, camera) {
  let eagle, trails;
  return {
    render() {
      if (!eagle) {
        scene.traverse((object) => { if (object.userData.isBerkut) eagle = object; });
        if (eagle) trails = createWingTrails(scene, eagle, camera);
      }
      if (trails) trails.update(performance.now() / 1000);
      renderer.render(scene, camera);
    },
    setSize(/* w, h */) {},
    dispose() { if (trails) trails.dispose(); trails = undefined; eagle = undefined; },
  };
}
