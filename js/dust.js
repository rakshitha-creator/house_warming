// Floating gold dust in warm light — a small 2D canvas layer.
export class Dust {
  constructor(canvas, { count = 60, reduce = false } = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.reduce = reduce;
    const mobile = matchMedia('(max-width: 700px)').matches;
    this.n = Math.round(count * (mobile ? 0.55 : 1));
    this.running = false;
    this.p = [];
    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    addEventListener('resize', this.resize);
    this.resize();
    for (let i = 0; i < this.n; i++) this.p.push(this.spawn(true));
    new IntersectionObserver(([e]) => (e.isIntersecting ? this.start() : this.stop())).observe(canvas);
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const r = this.c.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.c.width = Math.max(1, r.width * dpr); this.c.height = Math.max(1, r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  spawn(anywhere) {
    const depth = Math.random();
    return {
      x: Math.random() * (this.w || innerWidth),
      y: anywhere ? Math.random() * (this.h || innerHeight) : (this.h || innerHeight) + 10,
      r: 0.6 + depth * 2.2,
      vy: -(0.08 + depth * 0.35),
      vx: (Math.random() - 0.5) * 0.12,
      ph: Math.random() * Math.PI * 2,
      a: 0.25 + depth * 0.55,
    };
  }
  start() { if (this.running || this.reduce) { if (this.reduce) this.draw(0); return; } this.running = true; requestAnimationFrame(this.tick); }
  stop() { this.running = false; }
  tick(t) { if (!this.running) return; this.draw(t); requestAnimationFrame(this.tick); }
  draw(t) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      p.y += p.vy; p.x += p.vx + Math.sin(t * 0.0006 + p.ph) * 0.15;
      if (p.y < -10) this.p[i] = this.spawn(false);
      const tw = 0.65 + 0.35 * Math.sin(t * 0.002 + p.ph * 3);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      g.addColorStop(0, `rgba(255,226,160,${p.a * tw})`);
      g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
