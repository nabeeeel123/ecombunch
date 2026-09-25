import Lenis from 'lenis';
import { initScene } from './scene.js';

const CFG = window.NABVISIONS || {};
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------------------------------------------------------------
// Config-driven content
// ---------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const email = CFG.email || 'hello@nabvisions.com';

$$('[data-email]').forEach((a) => { a.href = `mailto:${email}`; a.textContent = email; });
if (CFG.booking) {
  $$('[data-book]').forEach((a) => { a.href = CFG.booking; a.target = '_blank'; a.rel = 'noopener'; });
}
const contactList = $('#contactList');
if (CFG.whatsapp) {
  contactList.insertAdjacentHTML('beforeend',
    `<li><span>WhatsApp</span><a href="https://wa.me/${esc(CFG.whatsapp)}" target="_blank" rel="noopener">+${esc(CFG.whatsapp)}</a></li>`);
}
if (CFG.booking) {
  contactList.insertAdjacentHTML('beforeend',
    `<li><span>Book a call</span><a href="${esc(CFG.booking)}" target="_blank" rel="noopener">Pick a time →</a></li>`);
}
const socials = Object.entries(CFG.socials || {}).filter(([, url]) => url);
if (socials.length) {
  $('#socials').innerHTML = socials
    .map(([name, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(name[0].toUpperCase() + name.slice(1))}</a>`)
    .join('');
}
if ((CFG.portfolio || []).length) {
  $('#caseStudies').innerHTML =
    '<h3 class="case-title">Client results</h3><div class="grid grid-3">' +
    CFG.portfolio.map((p) => `
      <a class="card case tilt" href="${esc(p.link || '#')}" target="_blank" rel="noopener">
        <span class="pill ${p.platform === 'TikTok' ? 'pill-tt' : 'pill-yt'}">${esc(p.platform)}</span>
        <h3>${esc(p.name)}</h3><p>${esc(p.niche)}</p>
        <div class="stats">${(p.stats || []).map((s) => `<div><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`).join('')}</div>
      </a>`).join('') + '</div>';
}
$('#year').textContent = new Date().getFullYear();

// ---------------------------------------------------------------
// Split headings into words for the reveal animation
// ---------------------------------------------------------------
function split(el) {
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const grad = node.classList && node.classList.contains('grad');
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const outer = document.createElement('span');
          outer.className = 'w';
          const inner = document.createElement('span');
          inner.className = 'wi' + (grad ? ' grad' : '');
          inner.style.transitionDelay = `${i++ * 45}ms`;
          inner.textContent = part;
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
        child.replaceWith(frag);
        if (grad) node.classList.remove('grad');
      } else if (child.nodeType === 1) {
        walk(child);
      }
    });
  };
  walk(el);
}
$$('[data-split]').forEach(split);

// ---------------------------------------------------------------
// Scroll reveals
// ---------------------------------------------------------------
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
function startReveals() {
  $$('.reveal, [data-split]').forEach((el) => { if (!el.closest('.hero')) io.observe(el); });
}

// ---------------------------------------------------------------
// Smooth scroll
// ---------------------------------------------------------------
let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.09, anchors: { offset: -70 }, smoothWheel: true });
}

// ---------------------------------------------------------------
// Nav
// ---------------------------------------------------------------
const nav = $('.nav');
const toggle = $('#navToggle');
const links = $('#navLinks');
toggle.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  toggle.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', open);
});
links.addEventListener('click', (e) => {
  if (e.target.closest('a')) { links.classList.remove('open'); toggle.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
});
let lastY = 0;
function navOnScroll(y) {
  nav.classList.toggle('scrolled', y > 20);
  nav.classList.toggle('hide', y > lastY && y > 400 && !links.classList.contains('open'));
  lastY = y;
}

// ---------------------------------------------------------------
// Cursor + magnetic buttons + tilt cards (desktop only)
// ---------------------------------------------------------------
if (finePointer && !reducedMotion) {
  document.documentElement.classList.add('has-cursor');
  const dot = $('.cursor-dot'), ring = $('.cursor-ring');
  let mx = -100, my = -100, rx = -100, ry = -100;
  window.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  const loop = () => {
    rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
    dot.style.transform = `translate(${mx}px, ${my}px)`;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(loop);
  };
  loop();
  document.addEventListener('pointerover', (e) => {
    ring.classList.toggle('hover', !!e.target.closest('a, button, summary, input, select, textarea, .tilt'));
  });

  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.tilt');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.style.setProperty('--rx', `${(0.5 - py) * 8}deg`);
    card.style.setProperty('--ry', `${(px - 0.5) * 10}deg`);
    card.style.setProperty('--gx', `${px * 100}%`);
    card.style.setProperty('--gy', `${py * 100}%`);
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest('.tilt');
    if (card && !card.contains(e.relatedTarget)) { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); }
  });
}

// ---------------------------------------------------------------
// Pipeline step highlighting (driven by the 3D scene)
// ---------------------------------------------------------------
const steps = $$('.pipe-steps li');
const pipeBar = $('.pipe-bar span');
const pipeDesc = $('.pipe-desc');
function onStage(stage, prog) {
  if (pipeDesc && steps[stage]) pipeDesc.textContent = steps[stage].querySelector('p').textContent;
  steps.forEach((li, i) => li.classList.toggle('active', i === stage));
  steps.forEach((li, i) => li.classList.toggle('done', i < stage));
  if (pipeBar) pipeBar.style.transform = `scaleX(${prog})`;
}

// ---------------------------------------------------------------
// 3D scene
// ---------------------------------------------------------------
let scene = null;
try {
  scene = initScene({
    canvas: $('#gl'), hero: $('.hero'), pipeline: $('#process'),
    heroAnchor: $('.hero-stage'), pipeAnchor: $('.pipe-stage'),
    clips: CFG.clips || [], onStage, reducedMotion,
  });
} catch (err) {
  console.warn('WebGL unavailable, using fallback', err);
  document.documentElement.classList.add('no-webgl');
}
if (!scene) {
  // Without the 3D scene, still keep the step list in sync with scroll
  const pipe = $('#process');
  window.addEventListener('scroll', () => {
    const r = pipe.getBoundingClientRect();
    const p = Math.min(Math.max(-r.top / (r.height - window.innerHeight), 0), 1);
    onStage(Math.min(Math.floor(p * 5), 4), p);
  }, { passive: true });
}

function raf(time) {
  if (lenis) lenis.raf(time);
  navOnScroll(window.scrollY);
  if (scene) scene.update();
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ---------------------------------------------------------------
// Preloader → intro
// ---------------------------------------------------------------
const loader = $('.loader');
const count = $('.loader-count');
const minTime = reducedMotion ? 0 : 1100;
const start = performance.now();
function tickLoader() {
  const p = Math.min((performance.now() - start) / Math.max(minTime, 1), 1);
  count.textContent = String(Math.round(p * 100)).padStart(3, '0');
  if (p < 1) requestAnimationFrame(tickLoader);
  else {
    loader.classList.add('done');
    document.documentElement.classList.add('ready');
    $$('.hero [data-split], .hero .reveal').forEach((el) => el.classList.add('in'));
    startReveals();
    setTimeout(() => loader.remove(), 1200);
  }
}
tickLoader();

// ---------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------
const form = $('#contactForm');
const status = $('#formStatus');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.className = 'form-status';
  if (!form.checkValidity()) {
    status.textContent = 'Please add your name, a valid email and a message.';
    status.classList.add('error');
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  if (!CFG.formEndpoint) {
    const body = `Name: ${data.name}\nEmail: ${data.email}\nService: ${data.service}\n\n${data.message}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent('New enquiry: ' + data.service)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Opening your email app…';
    return;
  }
  status.textContent = 'Sending…';
  try {
    const res = await fetch(CFG.formEndpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error();
    form.reset();
    status.textContent = "Thanks! We'll get back to you within 24 hours.";
  } catch {
    status.textContent = `Something went wrong. Please email us at ${email}.`;
    status.classList.add('error');
  }
});
