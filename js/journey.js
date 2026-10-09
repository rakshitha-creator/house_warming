// The walk-through: a Three.js corridor built only from the supplied pins.
// Each scene is the original image on a plane, split into depth layers
// (frame in front, picture behind, blurred copy far behind) so the camera's
// movement produces real parallax. The carved door (pin 3) is cut into two
// leaves that swing open on hinges.
import * as THREE from '../vendor/three.module.min.js';

THREE.ColorManagement.enabled = false;

const M = 'assets/media/';
const IMG_ASPECT = 9 / 16;           // every journey asset is 1080x1920 / 720x1280
const FOV = 42;
const DV = 5;                        // resting distance in front of each scene
export const Z = { a: 0, b: -12, c: -24, d: -36, e: -48 };

const VS = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const FS = /* glsl */`
uniform sampler2D map;
uniform float opacity;
uniform vec4 uvRect;      // sub-rectangle of the texture (x, y, w, h)
uniform vec4 hole;        // transparent rect in local uv (x0,y0,x1,y1)
uniform float holeOn;
uniform vec4 keep;        // keep only what lies outside this rect (frame layer)
uniform float keepOn;
uniform float soft;
uniform float bright;
uniform vec3 tint;
uniform float edgeShade;  // darkens toward the free edge of a door leaf
uniform float edgeSide;  // 0 = shade toward right edge, 1 = toward left edge
uniform float blur;      // >0: soft multi-tap blur (backdrop)
varying vec2 vUv;
void main(){
  vec2 uv = uvRect.xy + vUv * uvRect.zw;
  vec4 c = texture2D(map, uv);
  if (blur > 0.0) {
    vec4 acc = c;
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 2.39996;
      float r = blur * sqrt((float(i) + 0.5) / 12.0);
      acc += texture2D(map, uv + vec2(cos(a), sin(a)) * r);
    }
    c = acc / 13.0;
  }
  float a = 1.0;
  if (holeOn > 0.5) {
    float inside = step(hole.x, vUv.x) * step(vUv.x, hole.z) * step(hole.y, vUv.y) * step(vUv.y, hole.w);
    a *= 1.0 - inside;
  }
  if (keepOn > 0.5) {
    vec2 d = max(keep.xy - vUv, vUv - keep.zw);
    a *= smoothstep(-soft, soft * 0.25, max(d.x, d.y));
  }
  float ex = mix(vUv.x, 1.0 - vUv.x, edgeSide);
  c.rgb *= bright * tint * (1.0 - edgeShade * smoothstep(0.2, 1.0, ex));
  gl_FragColor = vec4(c.rgb, a * opacity);
}`;

const GLOW_FS = /* glsl */`
uniform float opacity;
varying vec2 vUv;
void main(){
  vec2 p = vUv - 0.5; p.x *= 1.15; p.y *= 0.7;
  float r = length(p);
  vec3 col = mix(vec3(1.0, 0.9, 0.68), vec3(0.92, 0.52, 0.16), smoothstep(0.0, 0.45, r));
  float a = pow(smoothstep(0.55, 0.0, r), 1.6);
  gl_FragColor = vec4(col * a, a) * opacity;
}`;

function mat(tex, o = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
    uniforms: {
      map: { value: tex }, opacity: { value: 1 },
      uvRect: { value: new THREE.Vector4(...(o.uvRect || [0, 0, 1, 1])) },
      hole: { value: new THREE.Vector4(...(o.hole || [0, 0, 0, 0])) }, holeOn: { value: o.hole ? 1 : 0 },
      keep: { value: new THREE.Vector4(...(o.keep || [0, 0, 0, 0])) }, keepOn: { value: o.keep ? 1 : 0 },
      soft: { value: o.soft ?? 0.05 },
      bright: { value: o.bright ?? 1 }, tint: { value: new THREE.Color(...(o.tint || [1, 1, 1])) },
      edgeShade: { value: 0 }, edgeSide: { value: o.edgeSide ?? 0 }, blur: { value: o.blur ?? 0 },
    },
  });
}

// Very soft copy of an image for the far backdrop: progressive downscale.
function blurTexture(img) {
  let src = img, w = img.naturalWidth || img.videoWidth, h = img.naturalHeight || img.videoHeight;
  for (const tw of [360, 128]) {
    const c = document.createElement('canvas');
    c.width = tw; c.height = Math.round(tw * h / w);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    src = c;
  }
  const t = new THREE.CanvasTexture(src);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export class Journey {
  constructor(canvas, { mobile = false } = {}) {
    this.canvas = canvas;
    this.mobile = mobile;
    this.state = { z: Z.a + 15, open: 0 };
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.scenes = {};
    this.visible = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x1c110a, 1);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 120);
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    this.onResize = this.onResize.bind(this);
    addEventListener('resize', this.onResize);
    addEventListener('pointermove', (e) => {
      this.pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
    this.buildDust();
  }

  static supported() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  }

  async load() {
    const [door, marigold, brass, couple, bellsPoster] = await Promise.all([
      loadImg(M + 'p3-carved-door.webp'), loadImg(M + 'p6-marigold-frame.webp'),
      loadImg(M + 'p7-brass-frame.webp'), loadImg(M + 'p9-doorway-couple.webp'),
      loadImg(M + 'temple-bells-poster.webp'),
    ]);
    const tex = (img) => { const t = new THREE.Texture(img); t.needsUpdate = true; t.anisotropy = 4; return t; };

    // Scene A — the carved door, with leaves that open
    this.scenes.a = this.makeScene(Z.a, tex(door), blurTexture(door), {
      hole: [0.207, 0.224, 0.796, 0.797], door: true,
    });
    // Scene B — marigold & banana-leaf frame floats in front of the wall
    this.scenes.b = this.makeScene(Z.b, tex(marigold), blurTexture(marigold), { keep: [0.2, 0.16, 0.8, 0.86] });
    // Scene C — temple bells (pin 5 video)
    this.video = document.createElement('video');
    Object.assign(this.video, { muted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' });
    this.video.setAttribute('playsinline', ''); this.video.setAttribute('muted', '');
    this.video.src = M + 'temple-bells.mp4';
    const posterTex = tex(bellsPoster);
    this.scenes.c = this.makeScene(Z.c, posterTex, blurTexture(bellsPoster), { video: true, dark: true });
    this.video.addEventListener('playing', () => {
      const vt = new THREE.VideoTexture(this.video);
      vt.minFilter = vt.magFilter = THREE.LinearFilter; vt.generateMipmaps = false;
      this.scenes.c.layers.forEach((l) => { if (l.userData.video) l.material.uniforms.map.value = vt; });
    }, { once: true });
    // Scene D — the main invitation on the brass-lamp frame
    this.scenes.d = this.makeScene(Z.d, tex(brass), blurTexture(brass), { keep: [0.15, 0.2, 0.85, 0.93] });
    // Scene E — illustrated doorway with the couple
    this.scenes.e = this.makeScene(Z.e, tex(couple), blurTexture(couple), { keep: [0.2, 0.2, 0.8, 0.87] });

    this.onResize();
    this.ready = true;
    this.renderOnce();
  }

  makeScene(z, tex, blurTex, o) {
    const g = new THREE.Group();
    g.position.z = z;
    this.scene.add(g);
    const plane = () => new THREE.PlaneGeometry(1, 1);
    const layers = [];
    const base = Math.round(100 + z);   // farther scenes draw first

    // far backdrop (fills the screen on wide displays)
    const back = new THREE.Mesh(plane(), mat(blurTex, { bright: o.dark ? 0.6 : 0.4, tint: [1.1, 0.88, 0.68], blur: 0.03 }));
    back.userData = { role: 'back', base: o.dark ? 0.9 : 0.85 };
    back.renderOrder = base; g.add(back); layers.push(back);

    // the picture itself
    const main = new THREE.Mesh(plane(), mat(tex, { hole: o.hole }));
    main.userData = { role: 'main', base: 1, video: !!o.video };
    main.renderOrder = base + 2; g.add(main); layers.push(main);

    if (o.keep) {
      // frame layer pulled toward the camera; shows only the ornament border
      const front = new THREE.Mesh(plane(), mat(tex, { keep: o.keep, soft: 0.045 }));
      front.userData = { role: 'front', base: 1, dz: 0.75 };
      front.renderOrder = base + 4; g.add(front); layers.push(front);
    }

    const s = { group: g, z, layers, o };

    if (o.door) {
      const [x0, y0, x1, y1] = o.hole;
      const glow = new THREE.Mesh(plane(), new THREE.ShaderMaterial({
        vertexShader: VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, uniforms: { opacity: { value: 0 } },
      }));
      glow.userData = { role: 'glow' };
      glow.renderOrder = base + 1; g.add(glow);
      const mk = (rect, side) => {
        const geo = new THREE.PlaneGeometry(1, 1);
        geo.translate(side === 'l' ? 0.5 : -0.5, 0, 0);       // hinge on the outer edge
        const m = new THREE.Mesh(geo, mat(tex, { uvRect: rect, edgeSide: side === 'l' ? 0 : 1 }));
        m.renderOrder = base + 3; g.add(m); return m;
      };
      s.leafL = mk([x0, y0, 0.5 - x0, y1 - y0], 'l');
      s.leafR = mk([0.5, y0, x1 - 0.5, y1 - y0], 'r');
      s.glow = glow;
    }
    return s;
  }

  buildDust() {
    const n = this.mobile ? 380 : 950;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = 16 - Math.random() * 90;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, pr: { value: this.renderer.getPixelRatio() } },
      vertexShader: /* glsl */`
        attribute float seed; uniform float time; uniform float pr; varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + time * (0.05 + seed * 0.12) + 4.0, 8.0) - 4.0;
          p.x += sin(time * 0.3 + seed * 30.0) * 0.15;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vA = smoothstep(0.6, 2.5, d) * (1.0 - smoothstep(14.0, 26.0, d)) * (0.45 + 0.55 * sin(time * 1.7 + seed * 40.0) * 0.5 + 0.25);
          gl_PointSize = (1.2 + seed * 3.2) * pr * (6.0 / max(d, 0.5));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        void main(){
          float r = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, r) * vA;
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * a, a);
        }`,
    });
    const pts = new THREE.Points(geo, this.dustMat);
    pts.renderOrder = 1000; pts.frustumCulled = false;
    this.scene.add(pts);
  }

  onResize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const visH = (d) => 2 * d * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const A = w / h;
    const cover = A < IMG_ASPECT * 1.35;
    const vh = visH(DV), vw = vh * A;
    const H = cover ? Math.max(vh, vw / IMG_ASPECT) * 1.01 : vh * 0.96;
    const W = H * IMG_ASPECT;
    this.cover = cover;
    // tell the HTML overlay how wide the picture is on screen
    document.documentElement.style.setProperty('--cardw', ((W / vw) * w).toFixed(0) + 'px');

    for (const s of Object.values(this.scenes)) {
      for (const l of s.layers) {
        const r = l.userData.role;
        if (r === 'back') {
          const d = DV + 3;
          const bh = Math.max(visH(d), visH(d) * A / IMG_ASPECT) * 2.2;   // still fills the view when far away
          l.scale.set(bh * IMG_ASPECT, bh, 1); l.position.z = -3;
        } else if (r === 'front') {
          const k = (DV - l.userData.dz) / DV;
          l.scale.set(W * k, H * k, 1); l.position.z = l.userData.dz;
        } else {
          l.scale.set(W, H, 1);
        }
      }
      if (s.o.door) {
        const [x0, y0, x1, y1] = s.o.hole;
        const cy = ((y0 + y1) / 2 - 0.5) * H, lh = (y1 - y0) * H;
        s.leafL.scale.set((0.5 - x0) * W, lh, 1); s.leafL.position.set((x0 - 0.5) * W, cy, 0.004);
        s.leafR.scale.set((x1 - 0.5) * W, lh, 1); s.leafR.position.set((x1 - 0.5) * W, cy, 0.004);
        s.glow.scale.set((x1 - x0) * W * 1.6, lh * 1.25, 1); s.glow.position.set(0, cy, -0.5);
      }
    }
    this.renderOnce();
  }

  setVisible(v) {
    this.visible = v;
    if (v && !this.raf) { this.clock.getDelta(); this.raf = requestAnimationFrame(this.loop); }
  }

  renderOnce() { if (this.ready) { this.update(0); this.renderer.render(this.scene, this.camera); } }

  update(dt) {
    const t = this.clock.elapsedTime;
    const p = this.pointer;
    const ease = 1 - Math.pow(0.001, dt);
    p.x += (p.tx - p.x) * ease * 0.6; p.y += (p.ty - p.y) * ease * 0.6;
    const swayX = this.mobile ? Math.sin(t * 0.35) * 0.12 : p.x * 0.38;
    const swayY = this.mobile ? Math.sin(t * 0.27) * 0.06 : -p.y * 0.24;
    const cz = this.state.z;
    this.camera.position.set(swayX, swayY, cz);
    this.camera.lookAt(swayX * 0.25, swayY * 0.25, cz - 10);
    this.dustMat.uniforms.time.value = t;

    for (const [key, s] of Object.entries(this.scenes)) {
      const d = cz - s.z;
      let op = smooth(21, 9.5, d);                                  // emerges from the dark
      op *= key === 'a' ? smooth(0.15, 0.7, d) : smooth(0.9, 3.7, d); // dissolves as we pass
      s.group.visible = op > 0.002;
      for (const l of s.layers) l.material.uniforms.opacity.value = op * (l.userData.base ?? 1);
      if (s.o.door) {
        const o = this.state.open;
        const e = o * o * (3 - 2 * o);
        s.leafL.rotation.y = e * 1.75; s.leafR.rotation.y = -e * 1.75;
        for (const leaf of [s.leafL, s.leafR]) {
          leaf.material.uniforms.opacity.value = op;
          leaf.material.uniforms.edgeShade.value = e * 0.55;
          leaf.material.uniforms.bright.value = 1 - e * 0.2;
        }
        s.glow.material.uniforms.opacity.value = op * (0.18 + e * 0.6);
      }
    }
    // play the bells only while they're near
    if (this.video) {
      const near = Math.abs(cz - (Z.c + DV)) < 14 && this.visible;
      if (near && this.video.paused) this.video.play().catch(() => {});
      else if (!near && !this.video.paused) this.video.pause();
    }
  }

  loop() {
    this.raf = null;
    if (!this.visible) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.ready) { this.update(dt); this.renderer.render(this.scene, this.camera); }
    this.raf = requestAnimationFrame(this.loop);
  }
}

export const REST = (k) => Z[k] + DV;
