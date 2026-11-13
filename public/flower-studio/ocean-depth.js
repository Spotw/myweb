import * as THREE from './vendor/three.module.js';

export function createOceanDepth(texture, renderer, render) {
  const { gsap } = window;
  const uniforms = {
    map: { value: texture },
    time: { value: 0 },
    pointer: { value: new THREE.Vector2() },
    strength: { value: 0 },
    lightX: { value: .5 },
    night: { value: 0 },
    aspect: { value: 1 },
    ocean: { value: 1 },
    crop: { value: new THREE.Vector2(1, 1) },
    focus: { value: .5 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      uniform float time;
      uniform float strength;
      uniform vec2 pointer;
      uniform float ocean;
      void main() {
        vUv = uv;
        vec3 p = position;
        float depth = ocean * (1.0 - smoothstep(0.0, .4173, uv.y));
        float edge = sin(uv.x * 3.14159) * sin(uv.y * 3.14159);
        p.z += strength * edge * (.025 * depth * sin(uv.y * 45.0 - time * .7)
          + pointer.x * (uv.x - .5) * .035);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform float time;
      uniform vec2 pointer;
      uniform float strength;
      uniform float lightX;
      uniform float night;
      uniform float aspect;
      uniform float ocean;
      uniform vec2 crop;
      uniform float focus;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        float sea = ocean * (1.0 - smoothstep(.414, .418, uv.y));
        float depth = clamp((.4173 - uv.y) / .4173, 0.0, 1.0);
        float edge = smoothstep(0.0, .035, uv.x) * smoothstep(0.0, .035, 1.0 - uv.x)
          * smoothstep(0.0, .025, uv.y) * smoothstep(0.0, .025, 1.0 - uv.y);
        float swell = sin(uv.y * 85.0 - time * .75 + sin(uv.x * 12.0 + time * .2));
        // Far ripples stay small; the foreground moves more strongly behind the fixed frame.
        uv.x += strength * edge * (pointer.x * mix(.003, .016, depth)
          + sea * swell * depth * .004 / max(aspect, .5));
        uv.y += strength * edge * sea * depth * (.0015 * swell + pointer.y * .004);
        uv = uv * crop + vec2((1.0 - crop.x) * focus, (1.0 - crop.y) * .5);
        vec4 sampleColor = texture2D(map, clamp(uv, .001, .999));
        if (ocean < .5) sampleColor = sRGBTransferEOTF(sampleColor);
        vec3 color = sampleColor.rgb;
        float wave = sin(vUv.y * 260.0 / (.4 + depth) - time * (1.0 + depth)
          + sin(vUv.x * 28.0 * aspect + time * .23) * 2.0);
        float crest = smoothstep(.82, 1.0, wave);
        float broken = smoothstep(.1, .8, sin(vUv.x * 115.0 * aspect
          + sin(vUv.y * 170.0) * 3.0 + time * .4));
        float reflection = exp(-pow((uv.x - lightX + swell * .012)
          / (.018 + depth * .16), 2.0));
        vec3 glint = mix(vec3(1.0, .88, .64), vec3(.65, .79, 1.0), night);
        color += strength * sea * edge * crest * broken
          * (.012 + reflection * .19) * glint * (.3 + depth * .7);
        color *= 1.0 - strength * sea * depth * (1.0 - wave) * .025;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const target = renderer.domElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const moveX = gsap.quickTo(uniforms.pointer.value, 'x', { duration: 1.2, ease: 'power3.out' });
  const moveY = gsap.quickTo(uniforms.pointer.value, 'y', { duration: 1.2, ease: 'power3.out' });
  let visible = false, running = false, lost = false, lastFrame = 0;
  let video = null;
  function syncVideo() {
    if (!video) return;
    if (running) video.play().catch(() => { /* Keep the decoded still frame if autoplay is blocked. */ });
    else video.pause();
  }
  function tick(_time, delta) {
    uniforms.time.value += Math.min(delta, 64) / 1000;
    const now = performance.now();
    if (now - lastFrame < 1000 / 30) return;
    lastFrame = now;
    render();
  }
  function sync() {
    const animate = visible && !document.hidden && !reduced.matches && !lost;
    if (reduced.matches) {
      uniforms.strength.value = 0;
      uniforms.pointer.value.set(0, 0);
      if (!lost) render();
    }
    if (animate === running) return;
    running = animate;
    syncVideo();
    if (running) {
      gsap.to(uniforms.strength, { value: 1, duration: 1.8, overwrite: true });
      gsap.ticker.add(tick);
    } else {
      gsap.ticker.remove(tick);
      gsap.killTweensOf(uniforms.strength);
      moveX.tween.pause(); moveY.tween.pause();
    }
  }
  target.addEventListener('pointermove', event => {
    if (!running || !finePointer.matches || event.pointerType === 'touch') return;
    const rect = target.getBoundingClientRect();
    moveX(THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1));
    moveY(THREE.MathUtils.clamp(1 - (event.clientY - rect.top) / rect.height * 2, -1, 1));
  });
  target.addEventListener('pointerleave', () => { if (running) { moveX(0); moveY(0); } });
  target.addEventListener('webglcontextlost', () => { lost = true; sync(); });
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
  observer.observe(target);
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { visible = false; sync(); });
  window.addEventListener('pageshow', () => { visible = target.getBoundingClientRect().width > 0; sync(); });
  return {
    material,
    setSource(map, nextVideo = null, focus = .5) {
      if (video !== nextVideo) video?.pause();
      video = nextVideo;
      uniforms.map.value = map;
      uniforms.ocean.value = video ? 0 : 1;
      uniforms.focus.value = focus;
      syncVideo();
    },
    update(lightX, night, aspect) {
      uniforms.lightX.value = lightX;
      uniforms.night.value = Number(night);
      uniforms.aspect.value = aspect;
      const sourceAspect = video ? video.videoWidth / video.videoHeight : aspect;
      uniforms.crop.value.set(Math.min(1, aspect / sourceAspect), Math.min(1, sourceAspect / aspect));
    },
  };
}
