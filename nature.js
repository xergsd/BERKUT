// nature.js — живое окружение: трава, цветы, камни, деревья, кусты, река,
// облака, пыльца, звёзды, тень беркута, птицы и антилопы. Перенесено из BERKUT 3 без перьев и потоков.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { height, riverCenter, riverLevel, biomeAt } from './world.js';
import { BIOMES } from './visuals.js';

const TAU = Math.PI * 2;
const dummy = new THREE.Object3D(), color = new THREE.Color();
const clamp = THREE.MathUtils.clamp;
export function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function matrix(mesh, i, x,y,z, sx,sy,sz, yaw=0, roll=0) {
  dummy.position.set(x,y,z); dummy.rotation.set(0,yaw,roll); dummy.scale.set(sx,sy,sz);
  dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
}
function batch(geo,mat,n,parent) {
  const m=new THREE.InstancedMesh(geo,mat,n); m.frustumCulled=false;
  parent.add(m); return m;
}
function grassGeometry() {
  const v=[];
  for(let i=0;i<3;i++) {
    const a=i*Math.PI/3, x=Math.cos(a)*.20,z=Math.sin(a)*.20;
    v.push(-x,0,-z,x,0,z,x*.45+.12,.6,z*.45, -x,0,-z,x*.45+.12,.6,z*.45,.25,1,0);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();return g;
}
function windMaterial(time) {
  const m=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide});
  m.onBeforeCompile=s=>{
    s.uniforms.windTime=time;
    s.vertexShader='uniform float windTime;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 root = instanceMatrix * vec4(0.,0.,0.,1.);
      float gust = sin(root.x*.08 + root.z*.055 + windTime*1.8);
      transformed.x += position.y * position.y * (.15 + gust*.25);
      transformed.z += position.y * position.y * sin(windTime*1.3+root.x*.1)*.10;`);
  }; return m;
}
function glowTexture() {
  const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.15,'rgba(255,244,195,.8)');g.addColorStop(1,'rgba(255,240,180,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);
}
function cloudTexture() {
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const ctx=c.getContext('2d');
  for(const [x,y,r] of [[40,72,35],[72,60,43],[111,48,45],[146,59,49],[191,73,40],[218,79,27]]){
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.55,'rgba(255,255,255,.65)');g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,256,128);
  }
  return new THREE.CanvasTexture(c);
}

class NatureChunk {
  constructor(owner,z) {
    this.owner=owner;this.group=new THREE.Group();owner.scene.add(this.group);
    const a=owner.assets;
    this.grass=batch(a.grass,a.wind,1700,this.group);
    this.flowers=batch(a.flower,a.flowerMat,96,this.group);
    this.stones=batch(a.stone,a.stoneMat,80,this.group);
    this.trunks=batch(a.trunk,a.trunkMat,66,this.group);
    this.crowns=batch(a.crown,a.leafMat,110,this.group);
    this.bushes=batch(a.crown,a.leafMat,45,this.group);
    this.river=new THREE.Mesh(new THREE.BufferGeometry(),owner.waterMat);this.river.frustumCulled=false;this.group.add(this.river);
    this.place(z);
  }
  place(z) {
    this.z=z;this.group.position.z=z;
    const rand=seeded(Math.round(z)*31+9329);
    // растительность региона (regions.js: flora)
    const f=BIOMES[biomeAt(z)].flora, pine=f.tree==='pine', saxaul=f.tree==='saxaul';
    const grassColors=f.grass;
    for(let i=0;i<1700;i++) {
      const patch=Math.floor(i/9),x=Math.sin(patch*12.53+z)*152+(rand()-.5)*12, local=Math.cos(patch*5.79)*100+(rand()-.5)*14,wz=z+local;
      const wet=Math.abs(x-riverCenter(wz))<10;
      const h=.6+rand()*1.9, bare=(i*0.618)%1>=f.grassShare; // в пустыне трава редкая
      const show=wet||bare?0:1; // прятать целиком: при нулевой ширине пучок остаётся тёмной чёрточкой
      matrix(this.grass,i,x,height(x,wz),local,show,h*show,show,rand()*TAU);
      this.grass.setColorAt(i,color.set(grassColors[i%grassColors.length]));
    }
    for(let i=0;i<96;i++) {
      const patch=Math.floor(i/12),x=(patch%2?-1:1)*(17+patch*9)+Math.sin(i*7)*5;
      const local=Math.sin(patch*9)*86+Math.cos(i*3)*6,wz=z+local;
      const bloom=f.flowers===true?.5:f.flowers==='dry'?.12:0; // в Чарыне мелкие, в пустыне нет
      matrix(this.flowers,i,x,height(x,wz)+.55,local,bloom?.35:0,bloom,bloom?.35:0,i);
      this.flowers.setColorAt(i,color.set(i%3===0?'#f4c968':i%3===1?'#cf977c':'#b9a5d5'));
    }
    for(let i=0;i<80;i++) {
      const x=(rand()-.5)*340,local=(rand()-.5)*CONFIG.chunkLen,wz=z+local,s=.25+rand()*1.4;
      matrix(this.stones,i,x,height(x,wz),local,s,s*.6,s*.85,rand()*TAU);
      this.stones.setColorAt(i,color.set(f.stone).multiplyScalar(.75+rand()*.4));
    }
    for(let i=0;i<22;i++) {
      const local=(rand()-.5)*CONFIG.chunkLen,wz=z+local;
      // Trees never become invisible obstacles in the flight corridor.
      const x=i<14?riverCenter(wz)+(i%2?1:-1)*(17+rand()*16):-(90+rand()*80);
      const y=height(x,wz),slope=Math.max(Math.abs(height(x+3,wz)-height(x-3,wz)),Math.abs(height(x,wz+3)-height(x,wz-3)));
      const grow=slope>4||!f.tree?.001:1; // без деревьев (Мангистау) — прячем
      const h=(4+rand()*7)*f.treeSize*grow,w=(1.6+rand()*1.8)*grow*(saxaul?.8:1);
      matrix(this.trunks,i*3,x,y+h*.35,local,.34,h*.8,.34);
      matrix(this.trunks,i*3+1,x-w*.3,y+h*.55,local,.19,h*.4,.19,i,.65);
      matrix(this.trunks,i*3+2,x+w*.3,y+h*.61,local,.16,h*.36,.16,i,-.65);
      this.crowns.geometry=pine?this.owner.assets.pine:this.owner.assets.crown;
      for(let k=0;k<5;k++) {
        const off=pine?0:Math.sin(k*2.4)*w*.64;
        const scale=pine?(1-k*.15):(.85+(k%2)*.23);
        // саксаул — низкий, с плоской редкой кроной
        const thick=pine?.32:saxaul?.12:.22;
        matrix(this.crowns,i*5+k,x+off,y+h*(.57+k*.09),local+(pine?0:Math.cos(k*2.4)*w*.55),w*scale,h*thick,w*scale,i);
        this.crowns.setColorAt(i*5+k,color.set(f.crown).multiplyScalar(.85+rand()*.3));
      }
    }
    for(let i=0;i<45;i++) {
      const x=(rand()-.5)*320,local=(rand()-.5)*220,wz=z+local,s=.5+rand()*1.5;
      const slope=Math.abs(height(x+2,wz)-height(x-2,wz));
      const size=slope>4?.001:s;
      matrix(this.bushes,i,x,height(x,wz)+size*.35,local,size,size*.65,size,i);
      this.bushes.setColorAt(i,color.set(f.bush));
    }
    for(const b of [this.grass,this.flowers,this.stones,this.trunks,this.crowns,this.bushes]) {
      b.instanceMatrix.needsUpdate=true;if(b.instanceColor)b.instanceColor.needsUpdate=true;
    }
    const positions=[],uv=[],indices=[];
    for(let i=0;i<=72;i++) {
      const local=-CONFIG.chunkLen/2+i*CONFIG.chunkLen/72,wz=z+local;
      for(let side=0;side<2;side++){
        positions.push(riverCenter(wz)+(side?1:-1)*7.2,riverLevel(wz),local);uv.push(side,wz/30);
      }
      if(i<72){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    this.river.geometry.dispose();this.river.geometry=g;
    this.setQuality(this.owner.quality);
  }
  setQuality(q) {
    this.grass.count=q==='high'?1700:340;this.flowers.count=q==='high'?96:48;this.stones.count=q==='high'?80:35;
  }
}

export class Nature {
  constructor(scene,world) {
    this.scene=scene;this.world=world;this.time={value:0};this.quality='high';this.night=0;
    this.assets={grass:grassGeometry(),wind:windMaterial(this.time),
      flower:new THREE.IcosahedronGeometry(1,0),flowerMat:new THREE.MeshLambertMaterial({color:0xffffff}),
      stone:new THREE.IcosahedronGeometry(1,1),stoneMat:new THREE.MeshLambertMaterial({color:0xffffff}),
      trunk:new THREE.CylinderGeometry(.65,1,1,5),trunkMat:new THREE.MeshLambertMaterial({color:'#5d4733'}),
      crown:new THREE.IcosahedronGeometry(1,1),pine:new THREE.ConeGeometry(1,2,7),leafMat:new THREE.MeshLambertMaterial({color:0xffffff})};
    this.waterMat=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{time:this.time,night:{value:0},fogColor:{value:scene.fog?.color || new THREE.Color('#e7c99e')}},
      vertexShader:`varying vec2 vUv; varying float vDepth; void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vDepth=-p.z;gl_Position=projectionMatrix*p;}`,
      fragmentShader:`uniform float time,night;uniform vec3 fogColor;varying vec2 vUv;varying float vDepth;
        void main(){float wave=sin(vUv.y*34.-time*2.+sin(vUv.x*18.+time));
        float glint=pow(max(0.,wave),22.)*.10;float edge=smoothstep(.36,.5,abs(vUv.x-.5));
        vec3 c=mix(vec3(.10,.25,.23),vec3(.29,.49,.40),.4+sin(vUv.y*3.+time*.3)*.12);
        c+=glint*(1.-edge);c=mix(c,vec3(.69,.72,.54),edge*.75);c*=1.-night*.65;
        c=mix(c,fogColor,smoothstep(160.,510.,vDepth));float alpha=smoothstep(0.,.05,vUv.x)*(1.-smoothstep(.95,1.,vUv.x));gl_FragColor=vec4(c,alpha);}`});
    this.chunks=new Map();
    for(const c of world.chunks)this.chunks.set(c,new NatureChunk(this,c.userData.z));
    world.onChunk=(mesh,z)=>this.chunks.get(mesh)?.place(z);
    this.makeAtmosphere();this.makeWildlife();
    this.reset();
  }
  makeAtmosphere() {
    this.cloudMat=new THREE.MeshBasicMaterial({map:cloudTexture(),color:'#fff4df',transparent:true,opacity:.66,depthWrite:false,fog:false});
    this.clouds=batch(new THREE.PlaneGeometry(1,1),this.cloudMat,16,this.scene);
    this.cloudSeeds=[];const rand=seeded(591);
    for(let i=0;i<16;i++)this.cloudSeeds.push({x:Math.sin(i*9)*470,y:130+(i%4)*27,z:-180-i*60,s:110+rand()*110});
    this.sparkTexture=glowTexture();
    const g=new THREE.BufferGeometry(),v=new Float32Array(180*3);
    for(let i=0;i<180;i++){v[i*3]=(rand()-.5)*160;v[i*3+1]=rand()*55;v[i*3+2]=(rand()-.5)*180;}
    g.setAttribute('position',new THREE.BufferAttribute(v,3));this.pollenBase=v.slice();
    this.pollen=new THREE.Points(g,new THREE.PointsMaterial({map:this.sparkTexture,color:'#f8daa2',size:.38,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.pollen.frustumCulled=false;this.scene.add(this.pollen);
    const stars=new Float32Array(400*3);
    for(let i=0;i<400;i++){const a=rand()*TAU,b=rand()*.90+.06;stars[i*3]=Math.cos(a)*850*Math.sqrt(1-b*b);stars[i*3+1]=b*850;stars[i*3+2]=Math.sin(a)*850*Math.sqrt(1-b*b);}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(stars,3));
    this.stars=new THREE.Points(sg,new THREE.PointsMaterial({color:'#d6e5ff',size:3.2,map:this.sparkTexture,transparent:true,opacity:0,depthWrite:false,fog:false}));this.scene.add(this.stars);
    // A soft silhouette hugs the sampled terrain beneath the eagle.
    const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d');
    ctx.filter='blur(5px)';ctx.fillStyle='rgba(22,25,24,.52)';ctx.beginPath();
    ctx.moveTo(64,32);ctx.lineTo(71,53);ctx.lineTo(122,59);ctx.lineTo(114,72);ctx.lineTo(72,67);ctx.lineTo(72,96);ctx.lineTo(56,96);ctx.lineTo(56,67);ctx.lineTo(12,72);ctx.lineTo(6,59);ctx.lineTo(57,53);ctx.fill();
    this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(25,20,6,6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,opacity:.4,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}));
    this.shadow.geometry.rotateX(-Math.PI/2);this.scene.add(this.shadow);
  }
  makeWildlife() {
    const mat=new THREE.MeshLambertMaterial({color:'#3e342c',side:THREE.DoubleSide});
    const wing=new THREE.BufferGeometry();wing.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,2.7,.08,.65,2.25,0,1.05,0,0,0,2.25,0,1.05,.25,0,.65],3));wing.computeVertexNormals();
    this.birdWings=batch(wing,mat,48,this.scene);
    this.birdBodies=batch(new THREE.SphereGeometry(1,6,4),mat,24,this.scene);
    const sand=new THREE.MeshLambertMaterial({color:'#bf9a63'}),dark=new THREE.MeshLambertMaterial({color:'#493c30'});
    this.animals=batch(new THREE.SphereGeometry(1,7,5),sand,32,this.scene);
    this.legs=batch(new THREE.CylinderGeometry(.10,.07,1,5),dark,32,this.scene);
    this.horns=batch(new THREE.ConeGeometry(.1,1,5),dark,16,this.scene);
    this.herds=[{x:-80,z:-145},{x:135,z:-460}];
    this.flocks=[{x:-25,y:65,z:-140},{x:65,y:85,z:-390},{x:-100,y:110,z:-630}];
  }
  reset() {
    this.herds[0].z=-145;this.herds[1].z=-460;
    this.flocks.forEach((f,i)=>f.z=-140-i*245);
  }
  setQuality(q){this.quality=q;for(const c of this.chunks.values())c.setQuality(q);this.pollen.geometry.setDrawRange(0,q==='high'?180:75);}
  // p — позиция беркута
  update(dt,time,p) {
    this.time.value=time;
    // ночь — у региона с флагом night (сейчас таких нет): звёзды, светлячки, тёмная вода
    const n=BIOMES.length,phase=Math.max(0,-p.z)/CONFIG.biomeEvery,stage=Math.floor(phase),biome=stage%n;
    const mix=stage===0?1:clamp((phase-stage)*CONFIG.biomeEvery/CONFIG.biomeBlend,0,1);
    const dark=(b)=>BIOMES[b].night?1:0;
    this.night=dark((biome+n-1)%n)*(1-mix)+dark(biome)*mix;this.waterMat.uniforms.night.value=this.night;
    this.cloudMat.color.set('#ffe5c5').lerp(color.set('#485775'),this.night);
    for(let i=0;i<16;i++){const c=this.cloudSeeds[i];matrix(this.clouds,i,c.x+Math.sin(time*.025+i)*25,c.y,p.z+c.z,c.s,c.s*.48,1);}
    this.clouds.instanceMatrix.needsUpdate=true;
    this.stars.position.z=p.z;this.stars.material.opacity=this.night*.85;
    this.pollen.position.set(p.x,0,p.z);
    this.pollen.material.size=.28+this.night*.65;this.pollen.material.color.set(this.night>.5?'#bcf7ba':'#ffe0ab');
    const pp=this.pollen.geometry.attributes.position;
    for(let i=0;i<pp.count;i++)pp.setXYZ(i,this.pollenBase[i*3]+Math.sin(time*.7+i)*2,this.pollenBase[i*3+1]+Math.sin(time+i*.9),((this.pollenBase[i*3+2]+time*6)%180+180)%180-90);
    pp.needsUpdate=true;
    const sh=this.shadow.geometry.attributes.position,agl=Math.max(0,p.y-height(p.x,p.z));
    for(let i=0;i<sh.count;i++)sh.setY(i,height(sh.getX(i)+p.x,sh.getZ(i)+p.z)+.20);
    sh.needsUpdate=true;this.shadow.position.set(p.x,0,p.z);this.shadow.material.opacity=clamp(.52-agl*.009,.08,.5)*(1-this.night*.8);
    this.updateWildlife(p,time,dt);
  }
  updateWildlife(p,time,dt) {
    for(let f=0;f<3;f++){
      const flock=this.flocks[f];if(flock.z>p.z+90)flock.z=p.z-650;
      flock.z-=dt*15;
      for(let j=0;j<8;j++){
        const i=f*8+j,x=flock.x+Math.sin(time*.2+f)*22+(j%2?1:-1)*Math.ceil(j/2)*6,z=flock.z+Math.ceil(j/2)*7;
        const y=flock.y+Math.sin(time*.6+j*.2)*2, flap=Math.sin(time*4.2-j*.7)*.35;
        matrix(this.birdBodies,i,x,y,z,.22,.24,.9);
        matrix(this.birdWings,i*2,x,y,z,1,1,1,0,flap);
        matrix(this.birdWings,i*2+1,x,y,z,-1,1,1,0,-flap);
      }
    }
    for(let h=0;h<2;h++){
      const herd=this.herds[h];if(herd.z>p.z+80)herd.z=p.z-620;
      herd.z-=dt*(Math.abs(herd.z-p.z)<100?3.5:.3);
      for(let j=0;j<4;j++){
        const i=h*4+j,x=herd.x+j*3+Math.sin(time*.5+j)*2,z=herd.z+j*7;
        const y=height(x,z),near=Math.abs(z-p.z)<100,pace=time*(near?8:1.2)+j;
        matrix(this.animals,i*4,x,y+1.7,z,.70,.8,1.8,0);
        matrix(this.animals,i*4+1,x,y+2.6,z-1.35,.38,1.1,.4,0,-.12);
        matrix(this.animals,i*4+2,x,y+3.35,z-1.8,.4,.38,.7);
        matrix(this.animals,i*4+3,x,y+1.85,z+1.8,.13,.15,.65);
        for(let k=0;k<4;k++)matrix(this.legs,i*4+k,x+(k%2?.48:-.48),y+.7,z+(k<2?-1:1)+Math.sin(pace+k*2)*.20,.9,1.5,.9,0,Math.sin(pace+k*2)*.16);
        for(let k=0;k<2;k++)matrix(this.horns,i*2+k,x+(k?.22:-.22),y+4,z-1.55,1,1.05,1,0,k?.15:-.15);
      }
    }
    for(const m of [this.birdBodies,this.birdWings,this.animals,this.legs,this.horns])m.instanceMatrix.needsUpdate=true;
  }
}
