import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PhoneScreen, MonitorScreen } from './screens.js';

const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

function glowTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function screenTexture(painter, renderer) {
  const tex = new THREE.CanvasTexture(painter.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function makeDevice({ w, h, d, radius, screenW, screenH, texture, glowColor, bodyMat }) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 6, radius), bodyMat);
  group.add(body);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  );
  screen.position.z = d / 2 + 0.002;
  group.add(screen);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 2.6, h * 2.2),
    new THREE.MeshBasicMaterial({
      map: glowTexture(glowColor), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.55,
    })
  );
  glow.position.z = -d / 2 - 0.35;
  group.add(glow);
  return group;
}

function makeVideo(src) {
  const v = document.createElement('video');
  Object.assign(v, { src, muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto' });
  v.setAttribute('muted', '');
  v.setAttribute('playsinline', '');
  v.play().catch(() => {
    const resume = () => { v.play().catch(() => {}); window.removeEventListener('pointerdown', resume); };
    window.addEventListener('pointerdown', resume);
  });
  return v;
}

export function initScene({ canvas, hero, pipeline, heroAnchor, pipeAnchor, clips = [], onStage, reducedMotion }) {
  const isMobile = window.matchMedia('(max-width: 820px)').matches || navigator.maxTouchPoints > 0;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  const purple = new THREE.DirectionalLight(0x7c5cff, 3);
  purple.position.set(-5, 3, 2);
  const cyan = new THREE.DirectionalLight(0x22d3ee, 2.2);
  cyan.position.set(5, -2, 3);
  scene.add(purple, cyan, new THREE.AmbientLight(0xffffff, 0.25));

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x14141f, metalness: 0.85, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15,
  });

  // Screens
  const phoneA = new PhoneScreen({ hueA: 265, hueB: 230, lines: ['5 FACTS', 'NOBODY', 'TELLS YOU'], handle: '@factsdaily', caption: 'Number 3 surprised everyone 👀', seed: 0 });
  const phoneB = new PhoneScreen({ hueA: 190, hueB: 330, lines: ['POV:', 'YOUR CHANNEL', 'POSTS DAILY'], handle: '@nabvisions', caption: 'Consistency is the whole game', seed: 2.3 });
  const monitor = new MonitorScreen();
  const videos = clips.slice(0, 3).map((src) => (src ? makeVideo(src) : null));
  [phoneA.video, monitor.video, phoneB.video] = [videos[0] || null, videos[1] || null, videos[2] || null];

  const texA = screenTexture(phoneA, renderer);
  const texB = screenTexture(phoneB, renderer);
  const texM = screenTexture(monitor, renderer);

  const root = new THREE.Group();
  scene.add(root);

  const mon = makeDevice({ w: 3.3, h: 1.95, d: 0.1, radius: 0.06, screenW: 3.18, screenH: 1.79, texture: texM, glowColor: 'rgba(124,92,255,0.9)', bodyMat });
  const phA = makeDevice({ w: 0.92, h: 1.86, d: 0.09, radius: 0.04, screenW: 0.84, screenH: 1.74, texture: texA, glowColor: 'rgba(168,85,247,0.9)', bodyMat });
  const phB = makeDevice({ w: 0.92, h: 1.86, d: 0.09, radius: 0.04, screenW: 0.84, screenH: 1.74, texture: texB, glowColor: 'rgba(34,211,238,0.9)', bodyMat });
  root.add(mon, phA, phB);

  // Neon rings
  const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.012, 16, 200), ringMat(0x7c5cff, 0.9));
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.008, 16, 200), ringMat(0x22d3ee, 0.6));
  const rings = new THREE.Group();
  rings.add(ring1, ring2);
  root.add(rings);

  // Particles
  const count = isMobile ? 500 : 1400;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const cA = new THREE.Color(0x7c5cff), cB = new THREE.Color(0x22d3ee), tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 3;
    tmp.copy(cA).lerp(cB, Math.random());
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.05, map: glowTexture('rgba(255,255,255,1)'), vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8,
  }));
  scene.add(particles);

  // ---- Layout -------------------------------------------------
  const view = { halfW: 4, halfH: 2.5, portrait: false };
  let lastW = 0, lastH = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === lastW && Math.abs(h - lastH) < 120) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    view.portrait = aspect < 0.95;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = view.portrait ? Math.max(8, 2.55 / (tanH * aspect)) : 8;
    camera.updateProjectionMatrix();
    view.halfH = camera.position.z * tanH;
    view.halfW = view.halfH * aspect;
  }
  resize();
  window.addEventListener('resize', resize);

  const objs = [mon, phA, phB];
  const state = objs.map(() => ({ p: new THREE.Vector3(), r: new THREE.Euler(), s: 1, init: false }));
  const target = objs.map(() => ({ p: new THREE.Vector3(), r: new THREE.Euler(), s: 1 }));

  // Map a DOM element's box to world space at z = 0
  function anchorToWorld(el) {
    const c = canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cx = (r.left + r.width / 2 - c.left) / c.width;
    const cy = (r.top + r.height / 2 - c.top) / c.height;
    return { x: (cx * 2 - 1) * view.halfW, y: -(cy * 2 - 1) * view.halfH, w: (r.width / c.width) * view.halfW * 2, h: (r.height / c.height) * view.halfH * 2 };
  }

  function heroLayout(prog, t) {
    const a = anchorToWorld(heroAnchor);
    const s = Math.min(Math.max(Math.min(a.w / 4.7, a.h / 2.6), 0.4), 1.2);
    const ax = a.x, ay = a.y;
    const spread = 1 + prog * 0.9;
    const f = reducedMotion ? 0 : 1;
    target[0].p.set(ax + 0.1 * s, ay + 0.35 * s, -1.1);
    target[0].r.set(0.05, -0.32 + prog * 0.5, 0);
    target[1].p.set(ax - 1.75 * s * spread, ay - 0.4 * s + Math.sin(t * 0.9) * 0.08 * f, 0.55 + prog * 1.5);
    target[1].r.set(0.08, 0.38 + prog * 0.8, 0.06);
    target[2].p.set(ax + 1.85 * s * spread, ay - 0.3 * s + Math.sin(t * 0.8 + 1.5) * 0.08 * f, 0.25 + prog);
    target[2].r.set(-0.04, -0.5 - prog * 0.8, -0.05);
    target[0].s = s; target[1].s = s; target[2].s = s;
    rings.position.set(ax + 0.1 * s, ay + 0.35 * s, -2.2);
    rings.scale.setScalar(s);
  }

  function pipelineLayout(prog, t) {
    const a = anchorToWorld(pipeAnchor);
    const s = Math.min(Math.max(Math.min(a.w / (view.portrait ? 5.2 : 5.6), a.h / 2.8), 0.4), 1.3);
    const ax = a.x, ay = a.y;
    const flank = smooth(0.78, 0.9, prog);
    const orbit = prog * Math.PI * 2 + t * 0.15;
    target[0].p.set(ax, ay + 0.1, 0);
    target[0].r.set(0.02, -0.22 + Math.sin(prog * Math.PI * 2) * 0.12, 0);
    target[0].s = s;
    const oA = new THREE.Vector3(ax + Math.cos(orbit) * 2.3 * s, ay + Math.sin(orbit) * 0.9 * s, -1.6);
    const oB = new THREE.Vector3(ax + Math.cos(orbit + Math.PI) * 2.3 * s, ay + Math.sin(orbit + Math.PI) * 0.9 * s, -1.6);
    const fA = new THREE.Vector3(ax - 1.55 * s, ay - 0.55 * s, 0.9);
    const fB = new THREE.Vector3(ax + 1.55 * s, ay - 0.55 * s, 0.9);
    target[1].p.copy(oA.lerp(fA, flank));
    target[2].p.copy(oB.lerp(fB, flank));
    target[1].r.set(0, THREE.MathUtils.lerp(Math.sin(orbit) * 0.5, 0.35, flank), 0);
    target[2].r.set(0, THREE.MathUtils.lerp(-Math.sin(orbit) * 0.5, -0.35, flank), 0);
    target[1].s = s * THREE.MathUtils.lerp(0.7, 0.85, flank);
    target[2].s = s * THREE.MathUtils.lerp(0.7, 0.85, flank);
    rings.position.set(ax, ay + 0.1, -2.4);
    rings.scale.setScalar(s * 1.05);
  }

  // ---- Input --------------------------------------------------
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // ---- Loop ---------------------------------------------------
  let lastTime = performance.now();
  let t = 0, frame = 0, mode = 'hero', lastStage = -1, visible = true;

  function update() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const vh = window.innerHeight;
    const hr = hero.getBoundingClientRect();
    const pr = pipeline.getBoundingClientRect();
    const heroVisible = hr.bottom > 0;
    const pipeVisible = pr.top < vh && pr.bottom > 0;
    const nowVisible = heroVisible || pipeVisible;
    if (nowVisible !== visible) {
      visible = nowVisible;
      canvas.style.visibility = visible ? 'visible' : 'hidden';
    }
    if (!visible) return false;

    t += reducedMotion ? 0 : dt;
    frame++;

    const newMode = pr.top < vh * 1.5 ? 'pipeline' : 'hero';
    const snap = newMode !== mode && !pipeVisible && !heroVisible;
    mode = newMode;

    let stage = 0, stageT = 0;
    if (mode === 'pipeline') {
      const prog = clamp01(-pr.top / (pr.height - vh));
      const sf = Math.min(prog * 5, 4.999);
      stage = Math.floor(sf);
      stageT = sf - stage;
      pipelineLayout(prog, t);
      if (stage !== lastStage) { lastStage = stage; onStage && onStage(stage, prog); }
      else onStage && onStage(stage, prog, true);
    } else {
      heroLayout(clamp01(-hr.top / Math.max(hr.height, 1)), t);
    }

    mouse.sx = damp(mouse.sx, mouse.x, 4, dt);
    mouse.sy = damp(mouse.sy, mouse.y, 4, dt);
    root.rotation.y = mouse.sx * 0.18;
    root.rotation.x = mouse.sy * 0.1;

    objs.forEach((o, i) => {
      const s = state[i], g = target[i];
      if (!s.init || snap) {
        s.p.copy(g.p); s.r.copy(g.r); s.s = g.s; s.init = true;
      } else {
        const k = 5;
        s.p.set(damp(s.p.x, g.p.x, k, dt), damp(s.p.y, g.p.y, k, dt), damp(s.p.z, g.p.z, k, dt));
        s.r.set(damp(s.r.x, g.r.x, k, dt), damp(s.r.y, g.r.y, k, dt), damp(s.r.z, g.r.z, k, dt));
        s.s = damp(s.s, g.s, k, dt);
      }
      o.position.copy(s.p);
      o.rotation.copy(s.r);
      o.scale.setScalar(s.s);
    });

    ring1.rotation.set(0.35 + Math.sin(t * 0.4) * 0.12, Math.sin(t * 0.3) * 0.35, t * 0.1);
    ring2.rotation.set(-0.3 + Math.cos(t * 0.35) * 0.1, Math.cos(t * 0.25) * 0.4, -t * 0.08);
    particles.rotation.y = t * 0.015 + mouse.sx * 0.05;
    particles.position.y = window.scrollY * 0.0015;

    // Repaint screens (every other frame on mobile)
    if (!isMobile || frame % 2 === 0) {
      phoneA.draw(t); texA.needsUpdate = true;
      phoneB.draw(t); texB.needsUpdate = true;
      monitor.draw(t, mode, stage, stageT); texM.needsUpdate = true;
    }

    renderer.render(scene, camera);
    return true;
  }

  return { update, resize };
}
