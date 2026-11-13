import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('ocean depth animates only while visible and respects reduced motion and context loss', () => {
  const source = readFileSync(new URL('../public/flower-studio/ocean-depth.js', import.meta.url), 'utf8');
  const callbacks = new Set(), media = [], tweens = [];
  const target = new EventTarget(), document = new EventTarget(), window = new EventTarget();
  target.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 600 });
  document.hidden = false;
  let observer, renders = 0;
  window.gsap = {
    quickTo: (target, key) => {
      const move = value => { target[key] = value; };
      move.tween = { pause() {} }; return move;
    },
    to: (target, options) => { target.value = options.value; tweens.push(target); },
    killTweensOf: target => { tweens.splice(tweens.indexOf(target), 1); },
    ticker: { add: fn => callbacks.add(fn), remove: fn => callbacks.delete(fn) },
  };
  const context = vm.createContext({
    window, document, performance: { now: () => 1000 },
    THREE: {
      Vector2: class { constructor() { this.set(0, 0); } set(x, y) { this.x = x; this.y = y; } },
      ShaderMaterial: class { constructor(options) { Object.assign(this, options); } },
      MathUtils: { clamp: (value, min, max) => Math.max(min, Math.min(max, value)) },
    },
    matchMedia: () => { const query = new EventTarget(); query.matches = false; media.push(query); return query; },
    IntersectionObserver: class { constructor(callback) { observer = callback; } observe() {} },
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), context);
  const depth = context.createOceanDepth({}, { domElement: target }, () => renders++);
  const uniforms = depth.material.uniforms;
  depth.update(.7, true, 1.4);
  assert.equal(uniforms.lightX.value, .7);
  assert.equal(uniforms.night.value, 1);
  assert.equal(uniforms.aspect.value, 1.4);
  assert.equal(callbacks.size, 0);
  observer([{ isIntersecting: true }]);
  assert.equal(callbacks.size, 1);
  const video = { videoWidth: 1920, videoHeight: 1080, plays: 0, pauses: 0,
    play() { this.plays++; return Promise.resolve(); }, pause() { this.pauses++; } };
  const videoMap = {};
  depth.setSource(videoMap, video, .28);
  depth.update(.7, false, .6);
  assert.equal(video.plays, 1);
  assert.equal(uniforms.map.value, videoMap);
  assert.equal(uniforms.ocean.value, 0);
  assert.equal(uniforms.focus.value, .28);
  assert.ok(Math.abs(uniforms.crop.value.x - .3375) < .0001);
  assert.equal(uniforms.crop.value.y, 1);
  callbacks.values().next().value(0, 16);
  assert.ok(uniforms.time.value > 0);
  assert.equal(renders, 1);
  document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(callbacks.size, 0);
  assert.equal(video.pauses, 1);
  // Changing this preference while hidden must also clear the previous motion state.
  uniforms.pointer.value.set(.8, .2);
  media[0].matches = true; media[0].dispatchEvent(new Event('change'));
  assert.equal(uniforms.strength.value, 0);
  assert.equal(uniforms.pointer.value.x, 0);
  document.hidden = false; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(callbacks.size, 0);
  media[0].matches = false; media[0].dispatchEvent(new Event('change'));
  assert.equal(callbacks.size, 1);
  assert.equal(video.plays, 2);
  depth.setSource({});
  depth.update(.7, false, 1);
  assert.equal(video.pauses, 2);
  assert.equal(uniforms.ocean.value, 1);
  assert.equal(uniforms.crop.value.x, 1);
  observer([{ isIntersecting: false }]);
  assert.equal(callbacks.size, 0);
  observer([{ isIntersecting: true }]);
  assert.equal(callbacks.size, 1);
  target.dispatchEvent(new Event('webglcontextlost'));
  assert.equal(callbacks.size, 0);
});
