import * as THREE from './vendor/three.module.js';
import { createOceanWindow } from './ocean.js';
import { createVase, VASES } from './vases.js';
import { LANDSCAPES } from './landscapes.js';

const flowers = [
  { id: 'rose', name: 'Hoa hồng', sub: 'Cánh lớn ôm tâm xoắn', color: '#d8868a' },
  { id: 'sunflower', name: 'Hoa hướng dương', sub: 'Một chút nắng vàng', color: '#edbc46' },
  { id: 'hydrangea', name: 'Hoa cẩm tú cầu', sub: 'Cụm tròn, từng bông bốn cánh', color: '#9bafd4' },
  { id: 'lily', name: 'Hoa lily', sub: 'Cánh hồng, nhị nâu & nụ thon', color: '#edb6ca' },
  { id: 'tulip', name: 'Hoa tulip', sub: 'Cúp hoa hồng phấn & trắng kem', color: '#e8a9bf', palette: ['#e8a9bf', '#fff1ce'] },
  { id: 'daisy', name: 'Hoa cúc', sub: 'Mộc mạc & trong trẻo', color: '#fff4d5' },
  { id: 'pingpong', name: 'Cúc ping pong', sub: 'Cầu hoa vàng, xanh, hồng & tím', color: '#d9bb35', palette: ['#e8c632', '#9eb64c', '#dca7c2', '#9d5587'] },
  { id: 'carnation', name: 'Hoa cẩm chướng', sub: 'Cánh diềm xòe, viền lượn sóng', color: '#d899b0' },
  { id: 'bluestar', name: 'Hoa sao xanh', sub: 'Một khoảng trời xanh', color: '#89b9d2' },
  { id: 'snapdragon', name: 'Hoa mõm sói', sub: 'Chùm hoa vươn cao, nụ xanh', color: '#e5a1a8', palette: ['#e5a1a8', '#f0cf65', '#bf4968', '#fff0d3'] },
  { id: 'ranunculus', name: 'Hoa mao lương', sub: 'Bông khum, cánh kem ôm nhiều lớp', color: '#fff7e4' },
  { id: 'lilyvalley', name: 'Hoa linh lan', sub: 'Chuông trắng trên cành cong', color: '#fff8e8' },
  { id: 'sprayrose', name: 'Hoa hồng chùm', sub: 'Nhiều bông & nụ trên một cành', color: '#e17aa0' },
  { id: 'eucalyptus', name: 'Lá khuynh diệp', sub: 'Xanh bạc & nhẹ nhàng', color: '#8aab99', leaf: true },
  { id: 'fern', name: 'Lá dương sỉ', sub: 'Một nét xanh tự nhiên', color: '#628353', leaf: true },
  { id: 'dracaena', name: 'Lá thiết mộc lan', sub: 'Dáng lá dài thanh thoát', color: '#759652', leaf: true },
];
const defaults = { rose: 3, hydrangea: 2, tulip: 3, eucalyptus: 3 };
const MAX = 40, STORAGE = 'hien-nha-flower-studio-v1';
let counts = { ...defaults }, vaseColor = '#e7ddc9', vaseStyle = 'classic', landscape = 'ocean', renderer, scene, camera, bouquet, vaseController, scenery, ready = false;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE));
  if (saved && typeof saved.counts === 'object') {
    let remaining = MAX;
    counts = Object.fromEntries(flowers.map(f => { const n = Math.min(remaining, Math.max(0, Math.floor(Number(saved.counts[f.id]) || 0))); remaining -= n; return [f.id, n]; }));
    if (['#e7ddc9', '#bd7960', '#829482', '#697b8c'].includes(saved.vaseColor)) vaseColor = saved.vaseColor;
    if (VASES.some(v=>v.id===saved.vaseStyle)) vaseStyle=saved.vaseStyle;
    if (LANDSCAPES.some(s=>s.id===saved.landscape)) landscape=saved.landscape;
  }
} catch { /* Storage may be disabled; editing still works. */ }
const total = () => flowers.reduce((n, f) => n + (counts[f.id] || 0), 0);
let toastTimer;
function notify(message) { const el = document.querySelector('#status'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3000); }
function save() { try { localStorage.setItem(STORAGE, JSON.stringify({ counts, vaseColor, vaseStyle, landscape })); } catch { /* Optional persistence. */ } }

function thumbnail(f) {
  let shapes = '<path d="M20 39 Q16 26 21 14" fill="none" stroke="#80956d" stroke-width="1.3"/><ellipse cx="16" cy="29" rx="5" ry="2" fill="#8fa27b" transform="rotate(30 16 29)"/>';
  if (f.leaf) {
    for (let i = 0; i < 5; i++) shapes += `<ellipse cx="${i % 2 ? 24 : 17}" cy="${8 + i * 5}" rx="${f.id === 'dracaena' ? 3 : 4}" ry="${f.id === 'dracaena' ? 13 : 3}" fill="${f.color}" transform="rotate(${i % 2 ? 35 : -35} ${i % 2 ? 24 : 17} ${8 + i * 5})"/>`;
  } else if (f.id === 'lilyvalley') {
    shapes = '<path d="M22 40 Q30 12 16 5" fill="none" stroke="#7b985b" stroke-width="1.4"/>';
    for (let i = 0; i < 5; i++) shapes += `<path d="M${17 + i * 2} ${8 + i * 5} l-6 3 m-3 0 q-5 1-4 7 q4 3 9 0 q0-6-5-7" fill="#fffdf0" stroke="#ccd4ba" stroke-width=".8"/>`;
  } else if (f.id === 'carnation') {
    for (let j = 0; j < 3; j++) { const r = 10 - j * 2.8; const points = Array.from({length:48},(_,i)=>{const a=i*Math.PI/24, radius=r*(i%2?.8:1);return `${20+Math.cos(a)*radius},${15+Math.sin(a)*radius}`;}).join(' '); shapes += `<polygon points="${points}" fill="${f.color}" stroke="#b9768c" stroke-width=".8"/>`; }
  } else if (f.id === 'hydrangea') {
    for(let j=0;j<12;j++){const a=j*2.4,r=8*Math.sqrt(j/12),cx=20+Math.cos(a)*r,cy=15+Math.sin(a)*r;for(let k=0;k<4;k++)shapes+=`<ellipse cx="${cx}" cy="${cy-2.4}" rx="2.2" ry="3" fill="${f.color}" stroke="#718bb1" stroke-width=".4" transform="rotate(${k*90} ${cx} ${cy})"/>`;}
  } else if (f.id === 'rose' || f.id === 'sprayrose') {
    for(let j=0;j<3;j++)for(let k=0;k<5;k++)shapes+=`<ellipse cx="20" cy="${8+j*2.7}" rx="${6-j*1.5}" ry="${5-j}" fill="${f.color}" stroke="#b9768c" stroke-width=".8" transform="rotate(${k*72+j*35} 20 15)"/>`;
    if (f.id === 'sprayrose') shapes += `<path d="M20 29 L8 21 M20 31 L32 21" stroke="#80956d" fill="none"/><circle cx="8" cy="19" r="5" fill="${f.color}"/><circle cx="32" cy="18" r="5" fill="${f.color}"/>`;
  } else if (f.id === 'ranunculus') {
    for(let layer=0;layer<4;layer++)for(let j=0;j<6;j++)shapes+=`<ellipse cx="20" cy="${10+layer*1.4}" rx="${4.2-layer*.7}" ry="${4-layer*.6}" fill="${layer<2?'#fff7e4':'#f4e9c5'}" stroke="#d8cfb0" stroke-width=".55" transform="rotate(${j*60+layer*29} 20 15)"/>`;
  } else if (f.id === 'tulip') {
    shapes += `<path d="M10 7 Q9 27 20 27 Q31 27 30 7 Q25 3 21 8 Q16 3 10 7" fill="${f.color}" stroke="#c78b9e" stroke-width=".7"/><path d="M16 6 Q13 19 20 26 Q27 18 24 6" fill="#f6c9d8" stroke="#d29bab" stroke-width=".7"/>`;
  } else if (f.id === 'pingpong') {
    shapes += `<circle cx="20" cy="15" r="11" fill="${f.color}"/>`;
    for (let i = 0; i < 65; i++) { const a = i * 2.4, r = 10 * Math.sqrt(i / 65); shapes += `<path d="M${20 + Math.cos(a) * r} ${15 + Math.sin(a) * r} l1 -2" stroke="#999a3d" stroke-width=".6"/>`; }
  } else if (f.id === 'snapdragon') {
    shapes += '<path d="M20 29 L20 4" stroke="#80956d"/>';
    for (let i = 0; i < 8; i++) shapes += `<ellipse cx="${i % 2 ? 23 : 17}" cy="${7 + i * 2.8}" rx="${2 + i * .3}" ry="3" fill="${f.color}" stroke="#bf7c86" stroke-width=".5"/>`;
  } else {
    const n = f.id === 'tulip' ? 5 : f.id === 'bluestar' ? 5 : 9;
    for (let i = 0; i < n; i++) shapes += `<ellipse cx="20" cy="10" rx="${f.id === 'hydrangea' ? 5 : 3.8}" ry="7" fill="${f.color}" stroke="#6b735318" stroke-width=".5" transform="rotate(${i * 360 / n} 20 16)"/>`;
    shapes += `<circle cx="20" cy="16" r="${f.id === 'sunflower' ? 5 : 3}" fill="${f.id === 'sunflower' ? '#74502f' : f.id === 'rose' ? '#c27277' : '#d8bb62'}"/>`;
  }
  return `<svg viewBox="0 0 40 44" aria-hidden="true">${shapes}</svg>`;
}
document.querySelector('#catalog').innerHTML = flowers.map(f => `<div class="flower-row" data-id="${f.id}" data-kind="${f.leaf ? 'leaf' : 'flower'}"><div class="flower-thumb">${thumbnail(f)}</div><div class="flower-info"><span class="flower-name">${f.name}</span><span class="flower-subtitle">${f.sub}</span></div><div class="counter"><button data-delta="-1" aria-label="Bớt một cành ${f.name.toLowerCase()}">−</button><output aria-label="Số cành ${f.name.toLowerCase()}">0</output><button data-delta="1" aria-label="Thêm một cành ${f.name.toLowerCase()}">+</button></div></div>`).join('');
for (const tab of document.querySelectorAll('.tab')) tab.querySelector('span').textContent = flowers.filter(f => tab.dataset.filter === 'all' || (tab.dataset.filter === 'leaf' ? f.leaf : !f.leaf)).length;
function updateUI() {
  const n = total();
  for (const row of document.querySelectorAll('.flower-row')) {
    const count = counts[row.dataset.id] || 0;
    row.querySelector('output').textContent = count;
    row.classList.toggle('chosen', count > 0);
    row.querySelector('[data-delta="-1"]').disabled = count === 0;
    row.querySelector('[data-delta="1"]').disabled = n >= MAX;
  }
  document.querySelector('#total').textContent = `${n} cành trong bình`;
  document.querySelector('#clear').disabled = n === 0;
  document.querySelector('#vase-name').textContent=VASES.find(v=>v.id===vaseStyle).name;
  document.querySelector('#landscape-name').textContent=LANDSCAPES.find(s=>s.id===landscape).name;
  const vaseIndex=VASES.findIndex(v=>v.id===vaseStyle), landscapeIndex=LANDSCAPES.findIndex(s=>s.id===landscape);
  document.querySelector('#vase-step').textContent=`KIỂU BÌNH · ${vaseIndex+1}/${VASES.length}`;
  document.querySelector('#landscape-step').textContent=`NGOÀI Ô CỬA · ${landscapeIndex+1}/${LANDSCAPES.length}`;
  document.querySelector('#change-vase').title=`Đổi sang ${VASES[(vaseIndex+1)%VASES.length].name}`;
  document.querySelector('#change-landscape').title=`Đổi sang ${LANDSCAPES[(landscapeIndex+1)%LANDSCAPES.length].name}`;
  for (const swatch of document.querySelectorAll('.swatch')) { const chosen = swatch.dataset.color === vaseColor; swatch.classList.toggle('selected', chosen); swatch.setAttribute('aria-pressed', chosen); }
}
document.querySelector('#catalog').addEventListener('click', event => {
  const button = event.target.closest('[data-delta]'); if (!button) return;
  const id = button.closest('.flower-row').dataset.id, delta = Number(button.dataset.delta);
  if (delta > 0 && total() >= MAX) return;
  counts[id] = Math.max(0, (counts[id] || 0) + delta); change();
});
for (const tab of document.querySelectorAll('.tab')) tab.addEventListener('click', () => {
  for (const other of document.querySelectorAll('.tab')) { other.classList.toggle('active', other === tab); other.setAttribute('aria-pressed', other === tab); }
  for (const row of document.querySelectorAll('.flower-row')) row.hidden = tab.dataset.filter !== 'all' && row.dataset.kind !== tab.dataset.filter;
});
for (const swatch of document.querySelectorAll('.swatch')) swatch.addEventListener('click', () => { vaseColor = swatch.dataset.color; if (vaseController) vaseController.setColor(vaseColor); updateUI(); save(); render(); });
document.querySelector('#change-vase').addEventListener('click',()=>{
  if(!ready)return;
  vaseStyle=VASES[(VASES.findIndex(v=>v.id===vaseStyle)+1)%VASES.length].id;
  vaseController.setStyle(vaseStyle); document.querySelector('#scene').dataset.vaseStyle=vaseStyle;
  updateUI();save();render();notify(`Đã đổi bình: ${VASES.find(v=>v.id===vaseStyle).name}.`);
});
async function applyLandscape(id) {
  const button=document.querySelector('#change-landscape'); button.disabled=true;button.setAttribute('aria-busy','true');
  const previous=scenery ? document.querySelector('#scene').dataset.landscape : 'ocean';
  try {await scenery.setLandscape(id);landscape=id;updateUI();save();}
  catch(error){console.error(error);landscape=previous||'ocean';updateUI();save();notify('Chưa tải được cảnh quan. Bạn có thể bấm để thử lại.');}
  finally{button.disabled=!ready;button.removeAttribute('aria-busy');}
}
document.querySelector('#change-landscape').addEventListener('click',()=>{
  if(!ready)return;
  const next=LANDSCAPES[(LANDSCAPES.findIndex(s=>s.id===landscape)+1)%LANDSCAPES.length];
  void applyLandscape(next.id);
});
document.querySelector('#clear').addEventListener('click', () => { counts = {}; change(); notify('Bình đã sẵn sàng cho một ý tưởng mới.'); });
const presets = [defaults, { ranunculus: 5, lilyvalley: 4, eucalyptus: 2 }, { lily: 3, bluestar: 4, dracaena: 2 }, { tulip: 9, fern: 2 }, { hydrangea: 5, eucalyptus: 3 }, { pingpong: 9, fern: 3 }, { carnation: 7, sprayrose: 3, eucalyptus: 2 }, { snapdragon: 7, ranunculus: 3, fern: 2 }];
let presetIndex = 0;
document.querySelector('#inspire').addEventListener('click', () => { presetIndex = (presetIndex + 1) % presets.length; counts = { ...presets[presetIndex] }; change(); notify('Một chút cảm hứng mới dành cho bạn.'); });
document.querySelector('#export').addEventListener('click', () => {
  if (!ready) return;
  try { render(); const link = document.createElement('a'); link.download = 'hien-nha-binh-hoa.png'; link.href = renderer.domElement.toDataURL('image/png'); link.click(); notify('Đã lưu khoảnh khắc nở hoa.'); } catch { notify('Chưa thể lưu ảnh. Vui lòng thử lại.'); }
});
function change() { updateUI(); save(); if (ready) { rebuild(); render(); } }
updateUI();
const flowerPanel=document.querySelector('#flower-panel'), flowerToggle=document.querySelector('#toggle-flowers');
flowerToggle.addEventListener('click',()=>{
  if(flowerPanel.open){flowerPanel.close();return;}
  flowerPanel.showModal();flowerToggle.setAttribute('aria-expanded','true');
  document.body.classList.add('flower-panel-open');
});
document.querySelector('#close-flowers').addEventListener('click',()=>flowerPanel.close());
flowerPanel.addEventListener('cancel',event=>{event.preventDefault();flowerPanel.close();});
flowerPanel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();flowerPanel.close();}});
flowerPanel.addEventListener('close',()=>{
  flowerToggle.setAttribute('aria-expanded','false');document.body.classList.remove('flower-panel-open');flowerToggle.focus({preventScroll:true});
});
flowerPanel.addEventListener('click',event=>{
  if(event.target!==flowerPanel)return;
  const box=flowerPanel.getBoundingClientRect();
  if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)flowerPanel.close();
});

const materials = new Map();
function mat(color, roughness = .72) { const normalized = new THREE.Color(color); const key = `${normalized.getHexString()}:${roughness}`; if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color: normalized, roughness, side: THREE.DoubleSide })); return materials.get(key); }
function mesh(geometry, material, parent, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geometry, material); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }
function box(parent, x, y, z, w, h, d, color) { return mesh(new THREE.BoxGeometry(w, h, d), mat(color), parent, x, y, z); }
const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
function orb(parent, color, x, y, z, sx, sy = sx, sz = sx) { const o = mesh(sphereGeo, mat(color), parent, x, y, z); o.scale.set(sx, sy, sz); return o; }
function rod(parent, from, to, radius = .018, color = '#5d7850') {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
  const o = mesh(new THREE.CylinderGeometry(radius * .75, radius, direction.length(), 6), mat(color), parent);
  o.position.copy(a.add(b).multiplyScalar(.5)); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return o;
}
// Curved, cupped petal surfaces shared across all stems of each species.
const petalCache = new Map();
function petalGeo(length, width, cup, ruffle = 0) {
  const key = [length, width, cup, ruffle].join(':'); if (petalCache.has(key)) return petalCache.get(key);
  const vertices = [], indices = [], rows = 18, cols = 12;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    for (let j = 0; j <= cols; j++) {
      const u = j / cols * 2 - 1;
      vertices.push(u * width * Math.pow(Math.sin(Math.PI * t), .65) * .5, length * t, cup * t * t + u * u * .08 + Math.sin(t * 25 + u * 12) * ruffle * t);
      if (i < rows && j < cols) { const n = i * (cols + 1) + j; indices.push(n, n + 1, n + cols + 1, n + 1, n + cols + 2, n + cols + 1); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); petalCache.set(key, g); return g;
}
function petals(parent, color, number, length, width, cup, spread = 0, phase = 0, ruffle = 0) {
  for (let i = 0; i < number; i++) {
    const p = mesh(petalGeo(length, width, cup, ruffle), mat(color), parent);
    p.rotation.z = i * Math.PI * 2 / number + phase;
    p.rotation.x = spread;
  }
}
function leaf(parent, x, y, z, angle, size = .5, color = '#71906b', width = .25) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.z = angle; group.rotation.y = .3; parent.add(group);
  mesh(petalGeo(size, width, .06), mat(color), group);
  rod(group, [0, 0, .005], [0, size * .88, .05], .005, '#a0ad7d'); return group;
}
// Radial cup patches form overlapping tulip petals instead of flat blades.
function tulipPetal() {
  if (petalCache.has('tulip-cup')) return petalCache.get('tulip-cup');
  const p = [], ids = [], rows = 20, cols = 12;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, radius = .045 + .19 * Math.sin(Math.PI * t * .84);
    for (let j = 0; j <= cols; j++) {
      const u = j / cols * 2 - 1, a = u * .69;
      p.push(Math.sin(a) * radius, t * .49 - .15 - .025 * u * u * t, Math.cos(a) * radius);
      if (i < rows && j < cols) { const k = i * (cols + 1) + j; ids.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ids); g.computeVertexNormals(); petalCache.set('tulip-cup', g); return g;
}
function bellGeometry() {
  if (petalCache.has('bell')) return petalCache.get('bell');
  // Hollow bell with an open, six-lobed flared rim; its opening points down.
  const profile = [[.005,.085],[.055,.076],[.087,.035],[.092,-.015],[.081,-.064],[.102,-.083]].map(([r,y])=>new THREE.Vector2(r,y));
  const g = new THREE.LatheGeometry(profile, 36), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -.06) { const a = Math.atan2(pos.getX(i), pos.getZ(i)); pos.setY(i, pos.getY(i) + .015 * Math.cos(a * 6)); }
  g.computeVertexNormals(); petalCache.set('bell', g); return g;
}
function ranunculusPetal(radius) {
  const key = `ranunculus-cup:${radius}`; if (petalCache.has(key)) return petalCache.get(key);
  const p = [], ids = [], rows = 22, cols = 18;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    for (let j = 0; j <= cols; j++) {
      const u = j / cols * 2 - 1;
      // Broad rounded rim, rising sides and a gently folded lip form a thin bowl.
      const a = u * .91 * Math.pow(Math.sin(Math.PI * t * .85), .35);
      const r = radius * (.18 + .82 * t) * (1 - .12 * u * u * t);
      const depth = radius * (.40 * Math.sin(Math.PI * t * .7) + .1 * u * u * t + .05 * u + .012 * Math.sin(u * 9) * t * t);
      p.push(Math.sin(a) * r, Math.cos(a) * r, depth);
      if (i < rows && j < cols) { const k = i * (cols + 1) + j; ids.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ids); g.computeVertexNormals(); petalCache.set(key, g); return g;
}
function sculptedPetal(radius, kind) {
  const key = `${kind}-petal:${radius}`; if (petalCache.has(key)) return petalCache.get(key);
  const p = [], ids = [], rows = 20, cols = kind === 'carnation' ? 32 : 18;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    for (let j = 0; j <= cols; j++) {
      const u = j / cols * 2 - 1, carn = kind === 'carnation';
      const a = u * (carn ? .48 : .95) * Math.pow(Math.sin(Math.PI * t), .35);
      const fringe = carn ? .065 * Math.sin(u * 27 + 1) * t ** 5 : 0;
      const r = radius * (.22 + .78 * t + fringe);
      const depth = carn ? .045 * Math.sin(t * Math.PI) + .016 * Math.sin(u * 23 + t * 7) * t ** 3 + .018 * u
        : .12 * (1 - t) ** 2 - .055 * t * t + .07 * u * u * t + .035 * u;
      p.push(Math.sin(a) * r, Math.cos(a) * r, depth);
      if (i < rows && j < cols) { const k = i * (cols + 1) + j; ids.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ids); g.computeVertexNormals(); petalCache.set(key, g); return g;
}
function flowerHead(id, color, parent) {
  const head = new THREE.Group(); parent.add(head);
  // Flower faces turn toward the fixed camera with a natural upward tilt.
  head.rotation.x = -.18;
  if (id === 'rose' || id === 'sprayrose') {
    // Few broad, cupped petals form a chalice with a tightly rolled central bud.
    for (let layer = 0; layer < 5; layer++) {
      const radius = .34 * (1 - layer * .17), number = layer < 3 ? 5 : 3;
      for (let j = 0; j < number; j++) {
        const p = mesh(sculptedPetal(radius, 'rose'), mat(new THREE.Color(color).offsetHSL(0, .01 * layer, -.018 * layer)), head);
        p.rotation.z = j * Math.PI * 2 / number + layer * .74;
        p.position.z = layer * .035 + j * .002;
      }
    }
    const bud = orb(head, new THREE.Color(color).offsetHSL(0, .03, -.09), 0, 0, .245, .036, .047, .035); bud.rotation.z = -.6;
    for (let j = 0; j < 5; j++) { const sepal = mesh(petalGeo(.23, .065, -.04), mat('#648047'), head, 0, 0, -.07); sepal.rotation.z = j * Math.PI * 2 / 5; }
  } else if (id === 'carnation') {
    // A wide, irregular ruffled crown and a narrow calyx distinguish it from roses.
    for (let layer = 0; layer < 6; layer++) {
      const radius = .30 * (1 - layer * .125);
      for (let j = 0; j < 10; j++) {
        const p = mesh(sculptedPetal(radius, 'carnation'), mat(new THREE.Color(color).offsetHSL(0, 0, ((j + layer) % 3 - 1) * .024)), head);
        p.rotation.z = j * Math.PI / 5 + layer * 1.37 + Math.sin(j * 3.7) * .11;
        p.rotation.x = Math.sin(j * 2.4 + layer) * .24;
        p.rotation.y = Math.cos(j * 2.4 + layer) * .18;
        p.scale.setScalar(1 + Math.sin(j * 3.1 + layer * 2.4) * .075);
        p.position.z = layer * .026 + Math.cos(j * 2.4) * .008;
      }
    }
    orb(head, color, 0, 0, .155, .07, .06, .035);
    orb(head, '#658449', 0, -.17, -.06, .095, .17, .08);
  } else if (id === 'ranunculus') {
    // Rounded cream petals overlap in a cupped bloom, rather than a flat pinwheel.
    const layers = 8;
    orb(head, '#f7edcf', 0, 0, -.025, .26, .26, .10);
    for (let layer = 0; layer < layers; layer++) {
      const ring = new THREE.Group(); head.add(ring); ring.position.z = layer * .019;
      const size = .34 * (1 - layer * .115);
      const shade = new THREE.Color('#fff8e7').lerp(new THREE.Color('#eddfb3'), layer / (layers - 1) * .65);
      const number = layer < 5 ? 7 : 5;
      for (let j = 0; j < number; j++) {
        const p = mesh(ranunculusPetal(size), mat(shade), ring);
        p.rotation.z = j * Math.PI * 2 / number + layer * .53;
        p.position.z = j * .002;
        p.scale.setScalar(1 + Math.sin(j * 2.7 + layer) * .025);
      }
    }
    orb(head, '#e9e1bc', 0, 0, .161, .028, .023, .016);
    for (let j = 0; j < 5; j++) { const sepal = mesh(petalGeo(.21, .075, -.045), mat('#7a9451'), head, 0, -.035, -.065); sepal.rotation.z = j * Math.PI * 2 / 5; }
    head.scale.setScalar(.68);
  } else if (id === 'hydrangea') {
    // Individual rounded, four-lobed florets face out from a domed cluster.
    for (let i = 0; i < 32; i++) {
      const a = i * 2.39996, r = .405 * Math.sqrt((i + .5) / 32), group = new THREE.Group();
      const center = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, .34 * Math.sqrt(1 - (r / .44) ** 2));
      group.position.copy(center); group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(center.x * .45, center.y * .45, center.z).normalize()); group.rotateZ(a); head.add(group);
      const shade = new THREE.Color(color).offsetHSL((i % 3 - 1) * .012, 0, (i % 4) * .022);
      for(let j=0;j<4;j++) { const angle=j*Math.PI/2; const p=orb(group,shade,Math.cos(angle)*.044,Math.sin(angle)*.044,.008,.045,.034,.014); p.rotation.z=angle; }
      orb(group, '#d6dfbf', 0, 0, .027, .013, .013, .012);
    }
    leaf(head, -.08, -.29, -.05, -.95, .36, '#527648', .23);
    leaf(head, .08, -.29, -.05, .95, .36, '#62804b', .23);
  } else if (id === 'sunflower' || id === 'daisy' || id === 'bluestar') {
    const star = id === 'bluestar', sun = id === 'sunflower';
    petals(head, color, star ? 5 : sun ? 19 : 15, sun ? .48 : star ? .19 : .28, sun ? .16 : star ? .13 : .105, .07);
    if (sun) petals(head, '#e9ac2e', 19, .39, .12, -.01, 0, .15);
    orb(head, sun ? '#705033' : '#d4b75e', 0, 0, .07, sun ? .195 : star ? .035 : .085, sun ? .195 : star ? .035 : .085, .07);
    if (sun) for (let i = 0; i < 42; i++) { const a = i * 2.4, r = .17 * Math.sqrt(i / 42); orb(head, '#977249', Math.cos(a) * r, Math.sin(a) * r, .135, .012); }
  } else if (id === 'lily') {
    petals(head, '#f9e5df', 3, .56, .33, -.15, 0, .22);
    petals(head, color, 3, .53, .28, -.11, 0, .22 + Math.PI / 3);
    // Narrow rose midribs and scattered dark freckles follow each pointed tepal.
    for (let j = 0; j < 6; j++) {
      const a = j * Math.PI / 3 + .22, detail = new THREE.Group(); detail.rotation.z = a; head.add(detail);
      mesh(petalGeo(.42, .075, -.09), mat('#dc8faa'), detail, 0, .025, .012);
      for (let k = 0; k < 12; k++) { const t = .09 + (k % 6) * .035, side = k % 2 ? 1 : -1; orb(detail, '#a54e70', side * (.02 + (k % 3) * .014), t, -.15 * (t / .56) ** 2 + .025, .006, .009, .004); }
      const end = [Math.cos(a) * .15, Math.sin(a) * .15, .29]; rod(head, [0, 0, .015], end, .007, '#afba6b');
      const anther = orb(head, '#684138', ...end, .018, .058, .018); anther.rotation.z = a;
    }
    rod(head, [0, 0, 0], [.025, .025, .34], .009, '#a7bb6d'); orb(head, '#bbc889', .025, .025, .34, .022);
  } else if (id === 'tulip') {
    head.rotation.x = .13;
    for (let i = 0; i < 6; i++) {
      const p = mesh(tulipPetal(), mat(i % 2 ? color : new THREE.Color(color).offsetHSL(0, -.02, .035)), head);
      p.rotation.y = i * Math.PI / 3; if (i % 2) p.scale.set(.93, .96, .93);
    }
  } else if (id === 'pingpong') {
    orb(head, new THREE.Color(color).multiplyScalar(.82), 0, 0, 0, .248);
    const blooms = new THREE.InstancedMesh(petalGeo(.085, .035, .027), mat(color), 420);
    const transform = new THREE.Object3D();
    for (let i = 0; i < 420; i++) {
      const y = 1 - 2 * (i + .5) / 420, r = Math.sqrt(1 - y * y), a = i * 2.39996;
      const normal = new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
      transform.position.copy(normal).multiplyScalar(.242); transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal); transform.rotateY(a); transform.updateMatrix(); blooms.setMatrixAt(i, transform.matrix);
    }
    blooms.castShadow = true; blooms.receiveShadow = true; head.add(blooms);
  }
  return head;
}
function makeStem(f, index, n) {
  if (f.palette) f = { ...f, color: f.palette[index % f.palette.length] };
  const stem = new THREE.Group(); bouquet.add(stem);
  const angle = index * 2.39996 + .5, ring = Math.sqrt((index + .5) / Math.max(n, 5));
  const x = Math.cos(angle) * ring * 1.08;
  const z = Math.sin(angle) * ring * .42 + .18;
  const height = 2.96 + Math.sin(index * 1.7) * .33 + (f.leaf ? .22 : 0) + (f.id === 'snapdragon' ? .18 : 0);
  const base = [.08 * Math.cos(angle), 1.05, .05], tip = [x, height, z];
  if (f.id === 'lilyvalley') {
    const top = height - .18, direction = x > 0 ? -1 : 1;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...base), new THREE.Vector3(x + direction * .38, top + .35, z), new THREE.Vector3(x + direction * .53, top - .05, z));
    mesh(new THREE.TubeGeometry(curve, 30, .012, 6, false), mat('#719044'), stem);
    for (let j = 0; j < 8; j++) {
      const t = .48 + j * .065, anchor = curve.getPoint(t), side = j % 2 ? -1 : 1;
      const end = anchor.clone().add(new THREE.Vector3(side * .12, -.11, .03));
      const pedicel = new THREE.QuadraticBezierCurve3(anchor, anchor.clone().add(new THREE.Vector3(side * .13, .015, .02)), end);
      mesh(new THREE.TubeGeometry(pedicel, 8, .005, 5, false), mat('#8ca35d'), stem);
      const bell = mesh(bellGeometry(), mat(f.color), stem, end.x, end.y - .065, end.z);
      bell.scale.setScalar(1 - j * .045); bell.rotation.z = side * .18;
    }
    leaf(stem, base[0], 1.32, .09, -.32, 1.12, '#648447', .4);
    leaf(stem, base[0], 1.34, .06, .4, 1.28, '#78954f', .36);
    return;
  }
  const xAt = t => base[0] + (x - base[0]) * t;
  const yAt = t => base[1] + (height - base[1]) * t;
  const zAt = t => base[2] + (z - base[2]) * t;
  // End these stems at the last leaf node, with a terminal leaf covering the tip.
  const leafTip = f.id === 'eucalyptus' ? .28 + 7 * .085 : f.id === 'fern' ? .25 + 11 * .06 : 1;
  rod(stem, base, [xAt(leafTip), yAt(leafTip), zAt(leafTip)], f.leaf ? .014 : .021);
  const tipAngle = -Math.atan2(x - base[0], height - base[1]);
  if (f.leaf) {
    if (f.id === 'eucalyptus') {
      for (let j = 0; j < 8; j++) { const t = .28 + j * .085, side = j % 2 ? 1 : -1;
        const l = orb(stem, j % 3 ? '#8eaa97' : '#9bb5a4', xAt(t) + side * .13, yAt(t), zAt(t), .15 - j * .006, .105, .028); l.rotation.z = side * .5;
        rod(stem, [xAt(t), yAt(t) - .03, zAt(t)], [xAt(t) + side * .13, yAt(t), zAt(t)], .008);
      }
      const terminal = orb(stem, '#9bb5a4', xAt(leafTip), yAt(leafTip), zAt(leafTip), .07, .105, .03);
      terminal.rotation.z = tipAngle;
    } else if (f.id === 'fern') {
      for (let j = 0; j < 12; j++) { const t = .25 + j * .06; for (const side of [-1, 1]) leaf(stem, xAt(t), yAt(t), zAt(t), side * 1.05, .37 * (1 - t) + .08, '#668153', .095); }
      leaf(stem, xAt(leafTip), yAt(leafTip), zAt(leafTip), tipAngle, .15, '#668153', .08);
    } else {
      for (let j = 0; j < 3; j++) leaf(stem, xAt(.3 + j * .18), yAt(.3 + j * .18), z * .5, (j % 2 ? -1 : 1) * .4 + x * .25, 1.05 - j * .14, j % 2 ? '#8da35b' : '#64834f', .23);
    }
  } else {
    const narrow = f.id === 'carnation' || f.id === 'snapdragon', tulip = f.id === 'tulip';
    leaf(stem, xAt(.4), yAt(.4), z * .4, tulip ? -.32 : -.8, tulip ? .95 : .48, narrow ? '#76958a' : '#65834f', narrow ? .07 : tulip ? .3 : .22);
    leaf(stem, xAt(.67), yAt(.67), z * .67, tulip ? .28 : .85, tulip ? .7 : .4, '#718d56', narrow ? .065 : .22);
    if (f.id === 'snapdragon') {
      for (let j = 0; j < 13; j++) {
        const t = .53 + j * .033, side = j % 2 ? -1 : 1, h = new THREE.Group(); h.position.set(xAt(t) + side * .075, yAt(t), z * t + .04); h.rotation.z = side * -.4; stem.add(h);
        const size = 1 - j * .041; h.scale.setScalar(size);
        // Distinct upper hood and two lower lips around a darker throat.
        orb(h, f.color, 0, .035, .035, .105, .082, .095);
        orb(h, f.color, -.046, -.047, .09, .065, .048, .075);
        orb(h, f.color, .046, -.047, .09, .065, .048, .075);
        orb(h, '#c6aa71', 0, -.015, .115, .03, .018, .012);
      }
      for (let j = 0; j < 5; j++) orb(stem, '#9bae63', xAt(.96) + (j % 2 ? -.025 : .025), yAt(.96) + j * .047, z, .04 - j * .005, .057 - j * .006, .035);
    } else if (f.id === 'sprayrose') {
      for (let j = 0; j < 4; j++) {
        const a = j * 2.4, end = [x + Math.cos(a) * .26, height + Math.sin(a) * .2, z + Math.cos(a) * .08];
        rod(stem, [xAt(.65), yAt(.65), z * .65], end, .01);
        const h = flowerHead(f.id, f.color, stem); h.position.set(...end); h.scale.setScalar(.57 + j * .04); h.rotation.z = Math.cos(a) * .3;
      }
      for (let j = 0; j < 2; j++) { const bx = x + (j ? .27 : -.23), by = height + .28 + j * .05; rod(stem, [xAt(.8), yAt(.8), z * .8], [bx, by, z], .008); orb(stem, '#65874a', bx, by, z, .065, .1, .06); orb(stem, f.color, bx, by + .045, z + .015, .05, .07, .05); }
    } else if (f.id === 'lily') {
      for (let j = 0; j < 2; j++) {
        const end = [x + (j ? .25 : -.14), height + (j ? .16 : -.07), z + (j ? -.08 : .08)];
        rod(stem, [xAt(.72), yAt(.72), z * .72], end, .012); const h = flowerHead(f.id, f.color, stem); h.position.set(...end); h.scale.setScalar(j ? .68 : .88); h.rotation.z = j ? -.3 : .2;
      }
      const bud = [x - .21, height + .39, z - .08]; rod(stem, [xAt(.8), yAt(.8), z * .8], bud, .012);
      orb(stem, '#a1ae70', ...bud, .085, .23, .075); orb(stem, '#e4c4c5', bud[0], bud[1] + .055, bud[2] + .024, .068, .175, .056);
      leaf(stem, xAt(.77), yAt(.77), z * .77, -.9, .56, '#506e40', .23);
    } else if (f.id === 'bluestar') {
      for (let j = 0; j < 4; j++) { const a = j * 2.4, end = [x + Math.cos(a) * .22, height + Math.sin(a) * .17, z + .04]; rod(stem, [xAt(.8), yAt(.8), z * .8], end, .008); flowerHead(f.id, f.color, stem).position.set(...end); }
    } else {
      const h = flowerHead(f.id, f.color, stem); h.position.set(...tip); h.rotation.z = -x * .15;
    }
  }
}
function disposeBouquet() {
  if (!bouquet) return;
  // Cached petal/sphere geometry and materials are reused; only unique stems are disposed.
  const shared = new Set([sphereGeo, ...petalCache.values()]);
  bouquet.traverse(o => { if (o.isMesh && !shared.has(o.geometry)) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
  scene.remove(bouquet);
}
function rebuild() {
  disposeBouquet(); bouquet = new THREE.Group(); bouquet.position.set(.75, .18, 0); scene.add(bouquet);
  const stems = flowers.flatMap(f => Array.from({ length: counts[f.id] || 0 }, () => f));
  // Interleave species rather than putting each type into a separate block.
  const mixed = stems.map((f, i) => ({ f, order: Math.sin((i + 1) * 83.17) })).sort((a, b) => a.order - b.order);
  mixed.forEach(({ f }, i) => makeStem(f, i, mixed.length));
}
function render() { if (renderer && scene && camera) renderer.render(scene, camera); }
function init() {
  const container = document.querySelector('#scene');
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22;
  container.append(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color('#e8e6da');
  camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 50);
  // The optical axis is perpendicular to the back wall: fixed front view, no orbit.
  camera.position.set(.05, 2.75, 12); camera.lookAt(.05, 2.75, 0);
  const ambient = new THREE.HemisphereLight('#fff8e8', '#b4b09a', 2.7); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff2d4', 3.4); sun.position.set(-3, 6, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -7; sun.shadow.camera.right = 7; sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -4; sun.shadow.normalBias = .035; sun.shadow.bias = -.0003; sun.shadow.radius = 5; scene.add(sun);
  box(scene, 0, 3, -1.1, 25, 16, .2, '#e3e1d4');
  // The ocean plane sits inside the recessed timber window, behind its mullions.
  const windowGroup = new THREE.Group(); scene.add(windowGroup);
  box(windowGroup, -2.12, 3.45, -.9, 2.45, 3.55, .16, '#c9d3c6');
  scenery = createOceanWindow(windowGroup, ambient, sun, renderer, render);
  for (const x of [-3.34, -.9]) box(windowGroup, x, 3.45, -.59, .075, 3.6, .19, '#f7f4e6');
  for (const y of [1.67, 5.23]) box(windowGroup, -2.12, y, -.59, 2.53, .075, .19, '#f7f4e6');
  box(windowGroup, -2.12, 1.61, -.4, 2.7, .12, .65, '#e9e5d5');
  windowGroup.traverse(object => { if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });
  box(scene, 0, -.22, .1, 25, .5, 6, '#aa805a');
  box(scene, 0, .065, .1, 25, .09, 6, '#c7a37a');
  // Subtle wood grain lines.
  for (let i = 0; i < 35; i++) box(scene, 0, .113, -2.6 + i * .17, 25, .001, .003, i % 3 ? '#c3a079' : '#d1af87');
  vaseController=createVase(scene,vaseColor);vaseController.setStyle(vaseStyle);
  document.querySelector('#scene').dataset.vaseStyle=vaseStyle;
  // A small closed book and a stone dish balance the still life.
  const book = new THREE.Group(); book.position.set(-1.15, .16, .2); book.rotation.y = -.15; scene.add(book);
  box(book, 0, 0, 0, .86, .06, .58, '#9aa18b'); box(book, 0, .055, 0, .81, .055, .54, '#ebe6d5'); box(book, 0, .09, 0, .86, .025, .58, '#a6ac95');
  const dish = mesh(new THREE.CylinderGeometry(.3, .27, .035, 48), mat('#c9c2ab'), scene, 2.15, .15, .3); dish.scale.z = .7;
  orb(scene, '#ddd6bf', 2.13, .18, .3, .14, .035, .1);
  ready = true; rebuild(); document.querySelector('#loading').remove(); document.querySelector('#export').disabled = false;
  document.querySelector('#change-vase').disabled=false;
  document.querySelector('#change-landscape').disabled=false;
  if(landscape!=='ocean')void applyLandscape(landscape);
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight, aspect = w / h;
    const viewHeight = aspect < .85 ? 6.25 : 6.45;
    camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    camera.position.x = aspect < .85 ? .35 : -.15;
    camera.updateProjectionMatrix(); renderer.setSize(w, h);
    // Anchor the right edge and extend the complete window to the viewport left edge.
    const windowRight=-.845, originalLeft=-3.395;
    const left=Math.min(originalLeft,camera.position.x+camera.left);
    const widthScale=(windowRight-left)/(windowRight-originalLeft);
    windowGroup.scale.x=widthScale;windowGroup.position.x=windowRight*(1-widthScale);
    scenery.setWidthScale(widthScale);render();
  };
  new ResizeObserver(resize).observe(container); resize();
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); ready = false; for(const id of ['export','change-vase','change-landscape'])document.querySelector(`#${id}`).disabled=true; notify('Hiển thị 3D bị gián đoạn. Hãy tải lại trang để tiếp tục.'); });
}
try { init(); } catch (error) { console.error(error); document.querySelector('#loading').textContent = 'Không thể mở không gian 3D. Hãy bật WebGL hoặc thử trình duyệt Chrome/Edge mới nhất.'; document.querySelector('#scene canvas')?.remove(); }
