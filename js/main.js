import { Dust } from './dust.js';
import { Journey, REST } from './journey.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const C = window.INVITE || {};

/* ---------- event details from config ---------- */
const mapsHref = C.mapsUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(C.mapsQuery || 'Anantapur, Andhra Pradesh, India');
$$('.js-map').forEach((a) => (a.href = mapsHref));
$$('[data-bind]').forEach((el) => {
  const v = C[el.dataset.bind] || '';
  el.textContent = v;
  el.classList.toggle('placeholder', /^\[.*\]$/.test(v.trim()));
});

/* ---------- ambient dust ---------- */
$$('canvas.dust').forEach((c) => new Dust(c, { count: +c.dataset.count || 50, reduce }));

/* ---------- 3D or fallback ---------- */
const useGL = !reduce && Journey.supported();
if (useGL) root.classList.add('gl');
let journey = null;

/* ---------- music ---------- */
const music = $('#music');
const soundBtn = $('#soundBtn');
let muted = false;
try { muted = localStorage.getItem('hw-muted') === '1'; } catch {}
function setMuted(m) {
  muted = m;
  soundBtn.setAttribute('aria-pressed', String(m));
  soundBtn.setAttribute('aria-label', m ? 'Turn music on' : 'Turn music off');
  try { localStorage.setItem('hw-muted', m ? '1' : '0'); } catch {}
  if (m) gsap.to(music, { volume: 0, duration: 0.6, onComplete: () => music.pause() });
  else startMusic();
}
function startMusic() {
  if (muted) return;
  music.volume = 0;
  music.play().then(() => gsap.to(music, { volume: 0.5, duration: 2.5 })).catch(() => {});
}
soundBtn.addEventListener('click', () => setMuted(!muted));
setMuted(muted); music.pause();
document.addEventListener('visibilitychange', () => {
  if (!root.classList.contains('entered')) return;
  if (document.hidden) music.pause(); else if (!muted) music.play().catch(() => {});
});

/* ---------- loader ---------- */
const essentials = ['p4-temple-hall.webp', 'p8-kolam.webp', 'p1-toran-frame.webp', 'door-entrance-poster.webp'].map((f) => 'assets/media/' + f);
const lineEl = $('.loader-line span');
let done = 0; const total = essentials.length + 1;
const tickLoad = () => lineEl.style.setProperty('--p', (++done / total).toFixed(2));
Promise.all([
  ...essentials.map((src) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = () => { tickLoad(); r(); }; i.src = src; })),
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(tickLoad),
  new Promise((r) => setTimeout(r, reduce ? 300 : 1500)),
]).then(showOpening);
setTimeout(() => { if (!$('#loader').classList.contains('done')) showOpening(); }, 7000);

/* ---------- opening ---------- */
let openingShown = false;
function showOpening() {
  if (openingShown) return; openingShown = true;
  $('#loader').classList.add('done');
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  if (reduce) {
    tl.fromTo('.op-copy > *', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, stagger: 0.1 });
    return;
  }
  tl.from('.op-back', { scale: 1.2, autoAlpha: 0, duration: 2.4 })
    .from('.op-mid', { scale: 1.12, autoAlpha: 0, duration: 2.2 }, 0.2)
    .from('.op-front', { yPercent: -8, autoAlpha: 0, duration: 2.4, ease: 'power2.out' }, 0.5)
    .from('.op-title', { autoAlpha: 0, y: 24, letterSpacing: '0.08em', duration: 1.8 }, 1.0)
    .from('.op-tagline', { autoAlpha: 0, y: 14, duration: 1.2 }, 1.7)
    .from('.op-names', { autoAlpha: 0, y: 14, duration: 1.2 }, 2.1)
    .from('.btn-enter', { autoAlpha: 0, scale: 0.92, duration: 1.0 }, 2.6);

  // depth parallax: farther layers move less than nearer ones
  const layers = [['.op-back', 12], ['.op-mid', 24], ['.op-front', 46], ['.op-copy', -10]];
  const movers = layers.map(([s, k]) => ({ k, x: gsap.quickTo(s, 'x', { duration: 1.2, ease: 'power3' }), y: gsap.quickTo(s, 'y', { duration: 1.2, ease: 'power3' }) }));
  const onMove = (e) => {
    const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
    movers.forEach((m) => { m.x(-nx * m.k); m.y(-ny * m.k * 0.7); });
  };
  if (!mobile) addEventListener('pointermove', onMove, { passive: true });
  else gsap.to('.op-front', { x: 10, y: 6, duration: 6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  $('#opening').addEventListener('entered', () => removeEventListener('pointermove', onMove), { once: true });
}

/* ---------- enter → door video → hero ---------- */
const portal = $('#portal');
const video = $('#portalVideo');
let finished = false;

$('#enterBtn').addEventListener('click', () => {
  $('#enterBtn').disabled = true;
  startMusic();
  if (reduce) return finishIntro(true);
  video.preload = 'auto';
  const tl = gsap.timeline();
  tl.to('.op-copy', { autoAlpha: 0, y: -18, duration: 0.6, ease: 'power2.in' })
    .to('.op-back', { scale: 1.25, duration: 1.7, ease: 'power2.in' }, 0.05)
    .to('.op-mid', { scale: 1.5, duration: 1.7, ease: 'power2.in' }, 0.05)
    .to('.op-front', { scale: 2.1, yPercent: -12, autoAlpha: 0, duration: 1.5, ease: 'power2.in' }, 0.05)
    .set(portal, { visibility: 'visible' }, 1.05)
    .to(portal, { opacity: 1, duration: 0.7, ease: 'power1.out' }, 1.05)
    .add(playPortal, 1.1);
});

function playPortal() {
  $('#opening').dispatchEvent(new Event('entered'));
  gsap.set('#opening', { autoAlpha: 0 });
  const p = video.play();
  if (p && p.catch) p.catch(() => finishIntro());
  const safety = setTimeout(() => finishIntro(), 12000);
  video.addEventListener('timeupdate', () => { if (video.currentTime > 7.7) { clearTimeout(safety); finishIntro(); } });
  video.addEventListener('ended', () => finishIntro(), { once: true });
  video.addEventListener('error', () => finishIntro(), { once: true });
  $$('source', video).forEach((s) => s.addEventListener('error', () => finishIntro(), { once: true }));
}
$('#skipBtn').addEventListener('click', () => finishIntro());

function finishIntro(instant = false) {
  if (finished) return; finished = true;
  const reveal = () => {
    root.classList.remove('locked');
    root.classList.add('entered');
    gsap.set('#opening', { display: 'none' });
    scrollTo(0, 0);
    ScrollTrigger.refresh();
    heroIn();
    // build the 3D walk once the hero has settled, or as soon as the guest scrolls
    if (useGL) {
      const go = () => { removeEventListener('scroll', go); prepareJourney(); };
      addEventListener('scroll', go, { passive: true });
      setTimeout(go, reduce ? 0 : 2600);
    }
  };
  if (instant) { reveal(); gsap.set(portal, { display: 'none' }); return; }
  gsap.timeline()
    .to('.portal-flash', { opacity: 1, duration: 0.55, ease: 'power2.in' })
    .add(reveal)
    .to(portal, { autoAlpha: 0, duration: 1.1, ease: 'power2.out', onComplete: () => { video.pause(); gsap.set(portal, { display: 'none' }); } });
}

/* ---------- hero: one image, three depths ---------- */
const diorama = $('#diorama');
function heroIn() {
  if (reduce) return;
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from(diorama, { z: -260, rotationX: 9, duration: 2.2 })
    .fromTo('.d-toran', { '--drop': '-70px' }, { '--drop': '0px', duration: 2.0, ease: 'elastic.out(0.6,0.55)' }, 0.25)
    .from('.d-copy > *', { autoAlpha: 0, y: 16, duration: 1.1, stagger: 0.14 }, 0.7)
    .from('.scroll-cue', { autoAlpha: 0, duration: 1 }, 2);
}
if (!reduce) {
  if (!mobile) {
    const rx = gsap.quickTo(diorama, 'rotationX', { duration: 1.4, ease: 'power3' });
    const ry = gsap.quickTo(diorama, 'rotationY', { duration: 1.4, ease: 'power3' });
    addEventListener('pointermove', (e) => {
      if (scrollY > innerHeight) return;
      ry((e.clientX / innerWidth - 0.5) * 9);
      rx(-(e.clientY / innerHeight - 0.5) * 6);
    }, { passive: true });
  } else {
    gsap.to(diorama, { rotationY: 3, rotationX: -1.5, duration: 5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }
  // leaving the hero: the frame tips back and recedes, as if we walk past it
  gsap.to('.hero-stage', {
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
    z: 0, scale: 0.86, rotationX: 10, opacity: 0.25, ease: 'none', transformPerspective: 1200,
  });
}

/* ---------- the journey ---------- */
function prepareJourney() {
  if (journey || !useGL) return;
  try {
    journey = new Journey($('#journeyGL'), { mobile });
  } catch (e) {
    console.warn('WebGL unavailable, using the simple layout', e);
    root.classList.remove('gl'); ScrollTrigger.refresh(); setupFallbackJourney(); return;
  }
  journey.load().catch((e) => console.error('Journey assets failed', e));
  new IntersectionObserver(([en]) => journey.setVisible(en.isIntersecting), { rootMargin: '20% 0px' }).observe($('#journey'));
  buildJourneyTimeline();
}

function buildJourneyTimeline() {
  const st = journey.state;
  const S = Object.fromEntries($$('.scene').map((el) => [el.dataset.scene, el]));
  gsap.set(Object.values(S), { autoAlpha: 0 });
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#journey', start: 'top top', end: 'bottom bottom', scrub: mobile ? 0.5 : 0.9 },
  });
  const show = (el, at) => tl.fromTo(el, { autoAlpha: 0, y: 26, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: 'power2.out' }, at);
  const hide = (el, at) => tl.to(el, { autoAlpha: 0, y: -22, scale: 1.03, duration: 0.4, ease: 'power1.in' }, at);
  const travel = (to, dur, at, ease = 'power1.inOut') => tl.to(st, { z: to, duration: dur, ease }, at);

  let t = 0;
  // A — approach the carved door
  travel(REST('a'), 2, t, 'power1.out'); show(S.a, 1.3); t += 2;
  travel(REST('a') - 0.35, 0.9, t); t += 0.9;
  hide(S.a, t - 0.25);
  // the doors open, we step through
  tl.to(st, { open: 1, duration: 1.5, ease: 'power1.inOut' }, t);
  travel(2.4, 1.5, t, 'power1.in'); t += 1.5;
  // B — welcome
  travel(REST('b'), 2.3, t, 'power2.out'); t += 2.3; show(S.b, t - 0.7);
  travel(REST('b') - 0.4, 1.0, t); t += 1.0; hide(S.b, t - 0.1);
  // C — bells and lamps
  travel(REST('c'), 2.1, t); t += 2.1; show(S.c, t - 0.6);
  travel(REST('c') - 0.4, 1.0, t); t += 1.0; hide(S.c, t - 0.1);
  // D — the invitation
  travel(REST('d'), 2.1, t); t += 2.1; show(S.d, t - 0.6);
  travel(REST('d') - 0.3, 1.6, t); t += 1.6; hide(S.d, t - 0.1);
  // E — the final blessing, stays
  travel(REST('e'), 2.1, t); t += 2.1; show(S.e, t - 0.6);
  travel(REST('e') - 0.3, 1.2, t); t += 1.2;
}

function setupFallbackJourney() {
  $$('.scene video').forEach((v) => {
    new IntersectionObserver(([en]) => { if (en.isIntersecting) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause(); }).observe(v);
  });
  if (reduce) return;
  $$('.scene-copy').forEach((el) => gsap.from(el, { autoAlpha: 0, y: 30, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 80%' } }));
}
if (!useGL) setupFallbackJourney();

/* ---------- progress ---------- */
gsap.to('#progressBar', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

/* ---------- gatefold invitation card ---------- */
const seal = $('#seal'), inside = $('.gate-inside'), hint = $('#cardHint');
inside.inert = true;
gsap.set('.gi-copy > *', { autoAlpha: 0 });
const cardTl = gsap.timeline({ paused: true, defaults: { ease: 'power3.inOut' } })
  .to(seal, { scale: 0.5, autoAlpha: 0, duration: 0.4, ease: 'back.in(2)' })
  .to('.flap-l', { rotationY: -164, duration: reduce ? 0.01 : 1.4 }, 0.2)
  .to('.flap-r', { rotationY: 164, duration: reduce ? 0.01 : 1.4 }, 0.34)
  .fromTo('.gi-copy > *', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out' }, 0.95);
seal.addEventListener('click', () => {
  seal.setAttribute('aria-expanded', 'true');
  inside.inert = false;
  hint.textContent = 'Close it to fold the card again.';
  cardTl.timeScale(1).play().eventCallback('onComplete', () => $('#closeCard').focus({ preventScroll: true }));
});
$('#closeCard').addEventListener('click', () => {
  seal.setAttribute('aria-expanded', 'false');
  hint.textContent = 'Tap the seal to open it.';
  cardTl.timeScale(1.4).reverse().eventCallback('onReverseComplete', () => { inside.inert = true; seal.focus({ preventScroll: true }); });
});
if (!reduce) {
  gsap.from('.gate', { scrollTrigger: { trigger: '#card', start: 'top 75%' }, rotationX: 18, y: 60, autoAlpha: 0, duration: 1.4, ease: 'power3.out', clearProps: 'transform' });
}

/* ---------- RSVP via WhatsApp ---------- */
const form = $('#rsvpForm'), countEl = $('#guestCount'), errEl = $('#formError');
let guests = 2;
$$('.stepper button').forEach((b) => b.addEventListener('click', () => {
  guests = Math.min(15, Math.max(1, guests + +b.dataset.step));
  countEl.textContent = guests;
}));
form.addEventListener('change', () => {
  const attending = form.attend.value === 'yes';
  $('.guests').style.opacity = attending ? '' : '.4';
  $$('.stepper button').forEach((b) => (b.disabled = !attending));
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = form.name.value.trim();
  if (!name) { errEl.textContent = 'Add your name so Sita & Ram know who is replying.'; form.name.focus(); return; }
  errEl.textContent = '';
  const yes = form.attend.value === 'yes';
  const lines = [
    'Namaskaram Sita & Ram!',
    `RSVP for your Gruhapravesam${C.date && !/^\[/.test(C.date) ? ' on ' + C.date : ''}`,
    `Name: ${name}`,
    yes ? `Joyfully attending, ${guests} ${guests === 1 ? 'guest' : 'guests'}` : 'Sending blessings from afar',
  ];
  const note = form.note.value.trim();
  if (note) lines.push(`Note: ${note}`);
  const num = (C.whatsappNumber || '').replace(/\D/g, '');
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
});
