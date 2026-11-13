import * as THREE from './vendor/three.module.js';
import { daylightAt } from './daylight.js';
import { LANDSCAPES } from './landscapes.js';
import { createOceanDepth } from './ocean-depth.js';

export function createOceanWindow(scene, ambient, sunlight, renderer, render, vaseLight) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1536;
  const ctx = canvas.getContext('2d'), horizon = 895;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const depth = createOceanDepth(texture, renderer, render);
  const view = new THREE.Mesh(new THREE.PlaneGeometry(2.14, 3.4, 48, 64), depth.material);
  view.position.set(-2.12, 3.45, -.77); scene.add(view);
  const fraction = n => Math.sin(n * 127.1 + 311.7) * 43758.5453 % 1;
  const noise = n => Math.abs(fraction(n));
  const videos = new Map();
  let active = LANDSCAPES[0], request = 0;
  async function loadVideo(definition) {
    if (videos.has(definition.id)) return videos.get(definition.id);
    const video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
    video.src = new URL(`./assets/${definition.video}`, import.meta.url).href;
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => finish(new Error('Video load timed out')), 20000);
        function finish(error) {
          clearTimeout(timeout);
          video.removeEventListener('loadeddata', loaded);
          video.removeEventListener('error', failed);
          if (error) reject(error); else resolve();
        }
        const loaded = () => finish(), failed = () => finish(new Error('Video unavailable'));
        video.addEventListener('loadeddata', loaded, { once: true });
        video.addEventListener('error', failed, { once: true });
        video.load();
      });
      const map = new THREE.VideoTexture(video); map.colorSpace = THREE.SRGBColorSpace;
      const media = { video, map }; videos.set(definition.id, media); return media;
    } catch (error) {
      video.removeAttribute('src'); video.load(); throw error;
    }
  }
  async function setLandscape(id) {
    const next = LANDSCAPES.find(item => item.id === id);
    if (!next) throw new Error('Unknown landscape');
    const currentRequest = ++request;
    const media = next.video ? await loadVideo(next) : null;
    if (currentRequest !== request) return;
    active = next;
    depth.setSource(media?.map || texture, media?.video || null, next.focus ?? .5);
    refresh();
  }

  function refresh() {
    const clock = daylightAt();
    const state = active.id === 'stars' ? { ...clock, night: true, daylight: 0, sunVisible: false }
      : active.id === 'hillside' ? { ...clock, night: false, daylight: .9, sunVisible: true } : clock;
    const { hour, daylight, progress } = state;
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
    texture.needsUpdate = true;
    depth.update(lightX / canvas.width, state.night, canvas.width / canvas.height);
    ambient.intensity = 1.05 + daylight * 1.65;
    ambient.color.set(state.night ? '#b9cbef' : '#fff8e8');
    sunlight.intensity = state.night ? .25 : .55 + daylight * 2.85;
    sunlight.color.set(state.night ? '#b3cafa' : daylight < .35 ? '#ffc29a' : '#fff2d4');
    sunlight.position.set(-4 + progress * 6, 2.4 + daylight * 4, 5);
    const oceanUplight = active.id === 'ocean' && state.night;
    vaseLight.visible = active.id === 'stars' || oceanUplight;
    if (oceanUplight) {
      // Rise by sqrt(3) over a horizontal distance of 1: a 60-degree uplight above the tabletop.
      vaseLight.position.set(.15, .2, .8);
      vaseLight.target.position.set(.75, .2 + Math.sqrt(3), 0);
      vaseLight.intensity = 10;
    } else {
      vaseLight.position.set(-2.25, 5.8, 4);
      vaseLight.target.position.set(.75, .8, 0);
      vaseLight.intensity = 110;
    }
    renderer.toneMappingExposure = state.night ? .98 : 1.12 + daylight * .1;
    const label = document.querySelector('.light-label');
    label.replaceChildren();
    const icon = document.createElement('span'); icon.textContent = state.night ? '☾' : '☀'; icon.setAttribute('aria-hidden', 'true');
    const caption = document.createElement('span'); caption.textContent = `${active.id==='ocean'?state.phase:active.name} · ${state.time}`;
    label.append(icon, caption); label.title = active.video ? 'Cảnh chuyển động từ video gốc' : 'Theo giờ trên thiết bị · Chu kỳ mặt trời minh họa 06:00–18:00';
    document.querySelector('.workspace').classList.toggle('night', state.night);
    document.querySelector('#scene').setAttribute('aria-label', `Bình hoa bên cửa sổ. ${active.description}. ${active.video ? active.name : state.phase}, ${state.time}.`);
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
