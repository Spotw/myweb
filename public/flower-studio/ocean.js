import * as THREE from './vendor/three.module.js';
import { daylightAt } from './daylight.js';
import { LANDSCAPES } from './landscapes.js';

export function createOceanWindow(scene, ambient, sunlight, renderer, render) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1536;
  const ctx = canvas.getContext('2d'), horizon = 895;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const view = new THREE.Mesh(new THREE.PlaneGeometry(2.14, 3.4), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  view.position.set(-2.12, 3.45, -.77); scene.add(view);
  const fraction = n => Math.sin(n * 127.1 + 311.7) * 43758.5453 % 1;
  const noise = n => Math.abs(fraction(n));
  const images = new Map();
  let active = LANDSCAPES[0], request = 0;
  async function setLandscape(id) {
    const next = LANDSCAPES.find(item=>item.id===id); if(!next) throw new Error('Unknown landscape');
    const currentRequest=++request;
    if(next.image && !images.has(id)) {
      const image=new Image(); image.src=new URL(`./assets/${next.image}`,import.meta.url).href;
      await image.decode(); images.set(id,image);
    }
    if(currentRequest!==request)return;
    active=next;refresh();
  }

  function refresh() {
    const state = daylightAt(), { hour, daylight, progress } = state;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, state.skyTop); sky.addColorStop(1, state.skyHorizon);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, horizon);
    if (state.night) {
      for (let i = 0; i < 65; i++) {
        ctx.fillStyle = `rgba(237,244,255,${.25 + noise(i + 4) * .5})`;
        ctx.beginPath(); ctx.arc(35 + noise(i) * (canvas.width - 70), 25 + noise(i + 200) * 660, .9 + noise(i + 400) * 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    const solarX = canvas.width * (.14 + progress * .72), solarY = horizon - Math.sin(progress * Math.PI) * 660;
    const moonProgress = ((hour + 6) % 24) / 12;
    const moonX = canvas.width * (.17 + Math.min(1, moonProgress) * .64), moonY = 300 + Math.cos(moonProgress * Math.PI) * 150;
    const lightX = state.sunVisible ? solarX : moonX;
    if (state.sunVisible || state.night) {
      const px = state.sunVisible ? solarX : moonX, py = state.sunVisible ? solarY : moonY;
      const glow = ctx.createRadialGradient(px, py, 15, px, py, state.night ? 120 : 215);
      glow.addColorStop(0, state.night ? '#ddeafc55' : '#fff1c8cc'); glow.addColorStop(1, '#fff1c800');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, horizon);
      ctx.fillStyle = state.night ? '#e9eff4' : daylight > .4 ? '#fff9da' : '#ffe5b0';
      ctx.beginPath(); ctx.arc(px, py, state.night ? 32 : 43, 0, Math.PI * 2); ctx.fill();
    }
    // Thin distant clouds, kept translucent so the sky remains the main subject.
    ctx.save(); ctx.globalAlpha = state.night ? .045 : .2;
    ctx.fillStyle = '#fff8ed';
    for (let i = 0; i < 6; i++) {
      const x = canvas.width * (.08 + noise(i + 40) * .83), y = 160 + noise(i + 60) * 500;
      ctx.beginPath(); ctx.ellipse(x, y, 95 + noise(i + 80) * 85, 9 + noise(i + 100) * 9, -.03, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const sea = ctx.createLinearGradient(0, horizon, 0, 1536); sea.addColorStop(0, state.seaTop); sea.addColorStop(1, state.seaBottom);
    ctx.fillStyle = sea; ctx.fillRect(0, horizon, canvas.width, 1536 - horizon);
    // Atmospheric haze softens the horizon without hiding its straight line.
    ctx.fillStyle = state.skyHorizon; ctx.globalAlpha = .25; ctx.fillRect(0, horizon, canvas.width, 3); ctx.globalAlpha = 1;
    for (let i = 0; i < 110; i++) {
      const depth = (i + .5) / 110, y = horizon + depth * depth * 640;
      const drift = Math.sin(hour * .7 + i * 2.39);
      ctx.strokeStyle = i % 3 ? `rgba(224,242,239,${state.night ? .055 : .12})` : 'rgba(18,57,82,.14)';
      ctx.lineWidth = .7 + depth * 2.1; ctx.beginPath();
      const start = noise(i + 900) * canvas.width - 80, width = 40 + depth * 210;
      ctx.moveTo(start, y); ctx.quadraticCurveTo(start + width * .45, y - 3 * depth, start + width, y + drift * 2); ctx.stroke();
      if (state.sunVisible || state.night) {
        const length = 8 + depth * 150 * noise(i + 750), offset = drift * (10 + depth * 45);
        ctx.strokeStyle = state.night ? 'rgba(216,234,246,.16)' : `rgba(255,239,190,${.13 + (1 - daylight) * .18})`;
        ctx.beginPath(); ctx.moveTo(lightX - length / 2 + offset, y); ctx.lineTo(lightX + length / 2 + offset, y); ctx.stroke();
      }
    }
    if(active.image) {
      const image=images.get(active.id), targetRatio=canvas.width/canvas.height;
      // Cover-crop only the artwork; this mesh and the frame keep their original dimensions.
      if(active.framing) {
        // Keep Totoro and the umbrella below the crossbar, to the left of the mullion.
        // Extend the sky/outer foliage at the edges without stretching the subject.
        const height=canvas.height*active.framing.height, width=height*image.naturalWidth/image.naturalHeight;
        const x=canvas.width*active.framing.x, y=canvas.height*active.framing.y;
        ctx.drawImage(image,0,0,image.naturalWidth,image.naturalHeight*.35,0,0,canvas.width,y);
        ctx.drawImage(image,0,0,image.naturalWidth*.12,image.naturalHeight,0,y,x,height);
        ctx.drawImage(image,image.naturalWidth*.75,0,image.naturalWidth*.25,image.naturalHeight,x+width,y,canvas.width-x-width,height);
        ctx.drawImage(image,x,y,width,height);
      } else {
      const cropWidth=Math.min(image.naturalWidth,image.naturalHeight*targetRatio);
      const cropHeight=Math.min(image.naturalHeight,image.naturalWidth/targetRatio);
      const sourceX=(image.naturalWidth-cropWidth)*(active.focus??.5), sourceY=(image.naturalHeight-cropHeight)*.5;
      ctx.drawImage(image,sourceX,sourceY,cropWidth,cropHeight,0,0,canvas.width,canvas.height);
      }
      const dim=state.night ? .35 : daylight<.25 ? .10 : 0;
      if(dim){ctx.fillStyle=`rgba(13,27,55,${dim})`;ctx.fillRect(0,0,canvas.width,canvas.height);}
    }
    texture.needsUpdate = true;
    ambient.intensity = 1.05 + daylight * 1.65;
    ambient.color.set(state.night ? '#b9cbef' : '#fff8e8');
    sunlight.intensity = state.night ? .25 : .55 + daylight * 2.85;
    sunlight.color.set(state.night ? '#b3cafa' : daylight < .35 ? '#ffc29a' : '#fff2d4');
    sunlight.position.set(-4 + progress * 6, 2.4 + daylight * 4, 5);
    renderer.toneMappingExposure = state.night ? .98 : 1.12 + daylight * .1;
    const label = document.querySelector('.light-label');
    label.replaceChildren();
    const icon = document.createElement('span'); icon.textContent = state.night ? '☾' : '☀'; icon.setAttribute('aria-hidden', 'true');
    const caption = document.createElement('span'); caption.textContent = `${active.id==='ocean'?state.phase:active.name} · ${state.time}`;
    label.append(icon, caption); label.title = 'Theo giờ trên thiết bị · Chu kỳ mặt trời minh họa 06:00–18:00';
    document.querySelector('.workspace').classList.toggle('night', state.night);
    document.querySelector('#scene').setAttribute('aria-label', `Bình hoa bên cửa sổ. ${active.description}. ${state.phase}, ${state.time}, theo giờ thiết bị.`);
    document.querySelector('#scene').dataset.landscape=active.id;
    render();
  }
  refresh();
  // Re-read the clock, rather than incrementing time, to recover from sleep or clock changes.
  const timer = setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('focus', refresh);
  function setWidthScale(scale) { const width=Math.max(256,Math.round(1536*2.14*scale/3.4)); if(canvas.width!==width){texture.dispose();canvas.width=width;refresh();} }
  return { refresh, timer, setLandscape, setWidthScale };
}
