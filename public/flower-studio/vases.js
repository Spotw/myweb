import * as THREE from './vendor/three.module.js';

export const VASES = [
  { id: 'classic', name: 'Gốm cổ điển' },
  { id: 'ribbed', name: 'Sọc đứng' },
  { id: 'round', name: 'Bình bầu' },
  { id: 'handled', name: 'Bình có quai' },
];
const profiles = {
  classic: [[.32,0],[.4,.04],[.49,.15],[.54,.39],[.53,.65],[.44,.91],[.31,1.12],[.26,1.3],[.27,1.36]],
  ribbed: [[.30,0],[.36,.04],[.38,.15],[.38,.4],[.38,.8],[.37,1.05],[.30,1.22],[.26,1.3],[.27,1.36]],
  round: [[.27,0],[.4,.05],[.54,.2],[.60,.4],[.59,.6],[.49,.82],[.32,1.02],[.26,1.19],[.27,1.36]],
  handled: [[.30,0],[.38,.05],[.42,.25],[.43,.6],[.40,.9],[.34,1.1],[.26,1.26],[.26,1.3],[.27,1.36]],
};
export function createVase(parent, color) {
  const group = new THREE.Group(); group.position.set(.75, .13, 0); parent.add(group);
  const material = new THREE.MeshStandardMaterial({color,roughness:.87,side:THREE.DoubleSide});
  const inside = new THREE.MeshStandardMaterial({color:'#514d35',roughness:1,side:THREE.DoubleSide});
  function add(geometry,mat=material) {const m=new THREE.Mesh(geometry,mat);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
  function setStyle(id) {
    if (!profiles[id]) return;
    for (const child of [...group.children]) {child.geometry.dispose();group.remove(child);}
    const outer = profiles[id];
    const inner = [...outer].reverse().slice(0,-1).map(([r,y])=>[Math.max(.03,r-.045),Math.max(.08,y)]);
    const points = [...outer,...inner,[0,.08]].map(([r,y])=>new THREE.Vector2(r,y));
    const geometry = new THREE.LatheGeometry(points,160);
    if(id==='ribbed') {
      const pos=geometry.attributes.position;
      for(let i=0;i<pos.count;i++) {const x=pos.getX(i),z=pos.getZ(i),y=pos.getY(i),r=Math.hypot(x,z); if(r<.001)continue; const a=Math.atan2(z,x),delta=.012*Math.cos(a*40)*Math.sin(Math.PI*Math.min(1,y/1.36));pos.setXYZ(i,x*(r+delta)/r,y,z*(r+delta)/r);}
      geometry.computeVertexNormals();
    }
    add(geometry);
    if(id==='classic') for(let i=0;i<19;i++){const y=.15+i*.039,r=.53-.12*((y-.45)/.55)**2; const ring=add(new THREE.TorusGeometry(r,.003,4,80));ring.position.y=y;ring.rotation.x=Math.PI/2;}
    if(id==='handled') {const handle=add(new THREE.TorusGeometry(.27,.055,12,64));handle.position.set(.43,.74,0);handle.scale.set(.85,1.35,1);}
    const mouth=add(new THREE.CircleGeometry(.225,48),inside);mouth.position.y=1.29;mouth.rotation.x=-Math.PI/2;
    const rim=add(new THREE.TorusGeometry(.25,.018,8,80));rim.rotation.x=Math.PI/2;rim.position.y=1.355;
    group.userData.style=id;
  }
  return {setStyle,setColor:color=>material.color.set(color)};
}
