// Fitted-sheet cloth toy. Pure module: no browser globals at top level (SSR safe).
// The sheet is a grid of points joined by constraints and rendered as triangles;
// each triangle remembers which layer it sits on, so folds stack correctly.
export const W = 1000;
export const H = 640;
export const NX = 32;
export const NY = 21;
export const S = 18;
const N = NX * NY;
const QX = NX - 1;
const QY = NY - 1;
const TN = QX * QY * 2;
const EL = 5; // elastic cells from each corner
const FRICTION = 0.8;
const ITER = 18;
export const SNAP = 46;
const GRAB = 40;
const TRI_REST = S * S; // a triangle's cross product when lying flat
const FLIP_T = TRI_REST * 0.12;
const ORIG_AREA = QX * S * QY * S;

type Con = { a: number; b: number; rest: number; ks: number; kc: number; el: boolean };
type Edge = [number, number, boolean];
export type SheetStats = { flipped: number; maxGroup: number; welded: number };
export type Judge = { score: number; compact: number; rect: number; weld: number; ball: boolean; flat: boolean };

const idx = (i: number, j: number) => j * NX + i;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function rng(seed: number) {
  let s = seed >>> 0 || 7;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export class Sheet {
  x = new Float32Array(N);
  y = new Float32Array(N);
  px = new Float32Array(N);
  py = new Float32Array(N);
  rx = new Float32Array(N);
  ry = new Float32Array(N);
  bx = new Float32Array(N);
  sx = new Float32Array(N);
  sy = new Float32Array(N);
  by = new Float32Array(N);
  cons: Con[] = [];
  elKeys = new Set<number>();
  ta = new Int32Array(TN);
  tb = new Int32Array(TN);
  tc = new Int32Array(TN);
  tz = new Float32Array(TN);
  ts = new Int8Array(TN);
  ptTris: number[][] = [];
  triEdges: (Edge[] | undefined)[] = [];
  corners: number[];
  groups: number[][] = [];
  held = -1;
  heldSet = new Set<number>();
  tx = 0;
  ty = 0;
  level = 0;
  anim: null | { kind: "shake" | "ball"; t: number; n: number } = null;
  frozen = false;
  balled = false;
  private order: number[] = [];

  constructor(seed: number) {
    const ox = (W - (NX - 1) * S) / 2;
    const oy = (H - (NY - 1) * S) / 2;
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const k = idx(i, j);
        this.rx[k] = ox + i * S;
        this.ry[k] = oy + j * S;
      }
    this.corners = [idx(0, 0), idx(NX - 1, 0), idx(NX - 1, NY - 1), idx(0, NY - 1)];
    const add = (a: number, b: number, rest: number, el: boolean) => {
      if (el) this.elKeys.add(a * N + b);
      this.cons.push({ a, b, rest: el ? S * 0.42 : rest, ks: el ? 0.28 : 1, kc: el ? 0.28 : 0.25, el });
    };
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        if (i < NX - 1) add(idx(i, j), idx(i + 1, j), S, (j === 0 || j === NY - 1) && (i < EL || i >= NX - 1 - EL));
        if (j < NY - 1) add(idx(i, j), idx(i, j + 1), S, (i === 0 || i === NX - 1) && (j < EL || j >= NY - 1 - EL));
        if (i < NX - 1 && j < NY - 1) {
          this.cons.push({ a: idx(i, j), b: idx(i + 1, j + 1), rest: S * Math.SQRT2, ks: 0.6, kc: 0.05, el: false });
          this.cons.push({ a: idx(i + 1, j), b: idx(i, j + 1), rest: S * Math.SQRT2, ks: 0.6, kc: 0.05, el: false });
        }
      }
    let t = 0;
    for (let k = 0; k < N; k++) this.ptTris.push([]);
    const tri = (a: number, b: number, c: number) => {
      this.ta[t] = a;
      this.tb[t] = b;
      this.tc[t] = c;
      this.ptTris[a].push(t);
      this.ptTris[b].push(t);
      this.ptTris[c].push(t);
      this.order.push(t);
      t++;
    };
    for (let j = 0; j < QY; j++)
      for (let i = 0; i < QX; i++) {
        const a = idx(i, j);
        const b = a + 1;
        const c = a + NX + 1;
        const d = a + NX;
        if (((i + j) & 1) === 0) {
          tri(a, b, c);
          tri(a, c, d);
        } else {
          tri(a, b, d);
          tri(b, c, d);
        }
      }
    const edges: [number, number][] = [];
    for (let i = 0; i < QX; i++) edges.push([idx(i, 0), idx(i + 1, 0)], [idx(i + 1, QY), idx(i, QY)]);
    for (let j = 0; j < QY; j++) edges.push([idx(QX, j), idx(QX, j + 1)], [idx(0, j + 1), idx(0, j)]);
    for (const [p0, p1] of edges) {
      const owner = this.ptTris[p0].find((tt) => this.ta[tt] === p1 || this.tb[tt] === p1 || this.tc[tt] === p1);
      if (owner === undefined) continue;
      (this.triEdges[owner] ??= []).push([p0, p1, this.isEl(p0, p1)]);
    }
    this.scramble(seed);
  }

  private isEl(a: number, b: number) {
    return this.elKeys.has(a * N + b) || this.elKeys.has(b * N + a);
  }

  // Fresh out of the dryer: start flat, then let a "hand" make a few careless
  // drags with the same physics the player uses, so the folds look natural.
  scramble(seed: number) {
    const r = rng(seed);
    this.x.set(this.rx);
    this.y.set(this.ry);
    this.px.set(this.rx);
    this.py.set(this.ry);
    this.tz.fill(0);
    this.groups = [];
    this.frozen = false;
    this.balled = false;
    this.anim = null;
    this.held = -1;
    this.heldSet = new Set();
    this.level = 0;
    this.updateSigns(true);
    const edge: number[] = [];
    for (let i = 0; i < NX; i++) edge.push(idx(i, 0), idx(i, NY - 1));
    for (let j = 1; j < NY - 1; j++) edge.push(idx(0, j), idx(NX - 1, j));
    for (let m = 0; m < 3; m++) {
      const k = r() < 0.55 ? this.corners[(r() * 4) | 0] : edge[(r() * edge.length) | 0];
      const gx = W / 2 + (r() - 0.5) * 240;
      const gy = H / 2 + (r() - 0.5) * 150;
      this.held = k;
      this.heldSet = new Set([k]);
      this.level += 1;
      const x0 = this.x[k];
      const y0 = this.y[k];
      for (let t = 1; t <= 48; t++) {
        const f = Math.min(1, t / 36);
        this.move(x0 + (gx - x0) * f, y0 + (gy - y0) * f);
        this.step();
      }
      this.held = -1;
      this.heldSet = new Set();
      for (let t = 0; t < 6; t++) this.step();
    }
    for (let t = 0; t < 24; t++) this.step();
    this.groups = [];
  }

  groupOf(k: number): number[] | null {
    for (const g of this.groups) if (g.includes(k)) return g;
    return null;
  }

  private triCross(t: number) {
    const a = this.ta[t];
    const b = this.tb[t];
    const c = this.tc[t];
    return (this.x[b] - this.x[a]) * (this.y[c] - this.y[a]) - (this.y[b] - this.y[a]) * (this.x[c] - this.x[a]);
  }

  private updateSigns(init = false) {
    for (let t = 0; t < TN; t++) {
      const cr = this.triCross(t);
      // Hysteresis: nearly collapsed triangles keep their side, so fold lines don't flicker.
      const s = init ? (cr >= 0 ? 1 : -1) : cr > FLIP_T ? 1 : cr < -FLIP_T ? -1 : this.ts[t];
      // A triangle that turns over belongs to the most recent fold, even if it
      // finishes turning after the hand lets go.
      if (!init && s !== this.ts[t]) this.tz[t] = this.level;
      this.ts[t] = s;
    }
    for (const k of this.heldSet) for (const t of this.ptTris[k]) this.tz[t] = this.level;
  }

  private pointZ(k: number) {
    let z = -1;
    for (const t of this.ptTris[k]) z = Math.max(z, this.tz[t]);
    return z;
  }

  pick(wx: number, wy: number) {
    let best = -1;
    let bestScore = -Infinity;
    for (let k = 0; k < N; k++) {
      const d = Math.hypot(this.x[k] - wx, this.y[k] - wy);
      if (d < GRAB) {
        const isC = this.corners.includes(k);
        const sc = this.pointZ(k) * 1000 - d + (isC ? (d < 24 ? 1e6 : 12) : 0);
        if (sc > bestScore) {
          bestScore = sc;
          best = k;
        }
      }
    }
    return best;
  }

  nearCorner(wx: number, wy: number) {
    let best = -1;
    let bd = GRAB;
    for (const c of this.corners) {
      const d = Math.hypot(this.x[c] - wx, this.y[c] - wy);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  grab(wx: number, wy: number) {
    if (this.anim || this.frozen) return false;
    const k = this.pick(wx, wy);
    if (k < 0) return false;
    this.held = k;
    this.heldSet = new Set(this.groupOf(k) ?? [k]);
    this.level += 1;
    this.tx = wx;
    this.ty = wy;
    return true;
  }

  move(wx: number, wy: number) {
    this.tx = Math.max(10, Math.min(W - 10, wx));
    this.ty = Math.max(10, Math.min(H - 10, wy));
  }

  // Returns the size of the welded corner group if a corner got tucked in.
  release(): number {
    const h = this.held;
    let result = 0;
    if (h >= 0 && this.corners.includes(h)) {
      const mine = this.groupOf(h) ?? [h];
      let merged = [...mine];
      for (const c of this.corners) {
        if (merged.includes(c)) continue;
        if (Math.min(Math.hypot(this.x[c] - this.x[h], this.y[c] - this.y[h]), Math.hypot(this.x[c] - this.tx, this.y[c] - this.ty)) < SNAP) {
          merged = [...new Set([...merged, ...(this.groupOf(c) ?? [c])])];
        }
      }
      if (merged.length > mine.length) {
        this.groups = this.groups.filter((g) => !g.some((k) => merged.includes(k)));
        this.groups.push(merged);
        result = merged.length;
      }
    }
    this.held = -1;
    this.heldSet = new Set();
    return result;
  }

  snapTargets() {
    if (this.held < 0 || !this.corners.includes(this.held)) return [];
    const hx = this.x[this.held];
    const hy = this.y[this.held];
    return this.corners
      .filter((c) => !this.heldSet.has(c))
      .map((c) => ({ x: this.x[c], y: this.y[c], hot: Math.hypot(this.x[c] - hx, this.y[c] - hy) < SNAP }));
  }

  shake() {
    if (this.frozen) return;
    this.release();
    this.groups = [];
    this.tz.fill(0);
    this.level = 0;
    this.anim = { kind: "shake", t: 0, n: 52 };
  }

  ball(seed: number) {
    if (this.frozen) return;
    this.release();
    const r = rng(seed);
    this.groups = [];
    for (let k = 0; k < N; k++) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * 58;
      this.bx[k] = W / 2 + Math.cos(a) * rad;
      this.by[k] = H / 2 + Math.sin(a) * rad * 0.85;
    }
    for (let t = 0; t < TN; t++) this.tz[t] = (r() * 8) | 0;
    this.anim = { kind: "ball", t: 0, n: 46 };
    this.balled = true;
  }

  step() {
    if (this.frozen) return;
    const { x, y, px, py } = this;
    for (let k = 0; k < N; k++) {
      const vx = (x[k] - px[k]) * FRICTION;
      const vy = (y[k] - py[k]) * FRICTION;
      px[k] = x[k];
      py[k] = y[k];
      x[k] += vx;
      y[k] += vy;
    }
    this.sx.set(x);
    this.sy.set(y);
    const hs = this.heldSet;
    let hx = 0;
    let hy = 0;
    if (this.held >= 0) {
      const cx = x[this.held];
      const cy = y[this.held];
      const dx = this.tx - cx;
      const dy = this.ty - cy;
      const d = Math.hypot(dx, dy);
      const m = d > 42 ? 42 / d : 1;
      hx = cx + dx * m;
      hy = cy + dy * m;
    }
    for (let it = 0; it < ITER; it++) {
      if (hs.size) for (const k of hs) { x[k] = hx; y[k] = hy; }
      for (const c of this.cons) {
        const a = c.a;
        const b = c.b;
        const dx = x[b] - x[a];
        const dy = y[b] - y[a];
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1e-4) continue;
        let target = c.rest;
        let k: number;
        if (c.el) {
          if (d > S) { target = S; k = 1; } else k = c.ks;
        } else k = d > c.rest ? c.ks : c.kc;
        const wa = hs.has(a) ? 0 : 1;
        const wb = hs.has(b) ? 0 : 1;
        const sum = wa + wb;
        if (!sum) continue;
        const f = ((d - target) / d) * k;
        x[a] += (dx * f * wa) / sum;
        y[a] += (dy * f * wa) / sum;
        x[b] -= (dx * f * wb) / sum;
        y[b] -= (dy * f * wb) / sum;
      }
      for (const g of this.groups) {
        if (hs.has(g[0])) { for (const k of g) { x[k] = hx; y[k] = hy; } continue; }
        let sx = 0;
        let sy = 0;
        for (const k of g) { sx += x[k]; sy += y[k]; }
        sx /= g.length;
        sy /= g.length;
        for (const k of g) { x[k] = sx; y[k] = sy; }
      }
    }
    if (!this.anim) {
      // Coulomb-ish friction against the mattress: points far from the hand stick
      // until enough tension builds up; the lifted flap near the hand slides freely.
      let hrx = 1e9;
      let hry = 1e9;
      for (const k of hs) { hrx = this.rx[k]; hry = this.ry[k]; }
      for (let k = 0; k < N; k++) {
        if (hs.has(k)) continue;
        const i = k % NX;
        const j = (k / NX) | 0;
        let w = hs.size ? Math.max(0, Math.min(1, (Math.hypot(this.rx[k] - hrx, this.ry[k] - hry) - 60) / 160)) : 1;
        if ((i < 4 || i > NX - 5) && (j < 4 || j > NY - 5)) w *= 0.35;
        const th = 2.2 * w;
        if (th <= 0) continue;
        const dx = x[k] - this.sx[k];
        const dy = y[k] - this.sy[k];
        const d = Math.hypot(dx, dy);
        if (d <= th) { x[k] = this.sx[k]; y[k] = this.sy[k]; }
        else { const m = 1 - th / d; x[k] = this.sx[k] + dx * m; y[k] = this.sy[k] + dy * m; }
      }
    }
    if (this.anim) {
      const an = this.anim;
      const p = an.t / an.n;
      for (let k = 0; k < N; k++) {
        if (an.kind === "shake") {
          const i = k % NX;
          const wob = Math.sin(an.t * 0.9 - i * 0.45) * (1 - p) * 16 * (1 - i / (NX - 1));
          x[k] += (this.rx[k] - x[k]) * 0.2;
          y[k] += (this.ry[k] + wob - y[k]) * 0.2;
        } else {
          x[k] += (this.bx[k] - x[k]) * 0.16;
          y[k] += (this.by[k] - y[k]) * 0.16;
        }
      }
      an.t++;
      if (an.t >= an.n) {
        if (an.kind === "ball") this.frozen = true;
        this.anim = null;
      }
    }
    for (let k = 0; k < N; k++) {
      if (x[k] < 8) x[k] = 8; else if (x[k] > W - 8) x[k] = W - 8;
      if (y[k] < 8) y[k] = 8; else if (y[k] > H - 8) y[k] = H - 8;
    }
    if (this.balled) {
      for (let t = 0; t < TN; t++) this.ts[t] = this.triCross(t) >= 0 ? 1 : -1;
    } else this.updateSigns();
  }

  stats(): SheetStats {
    let f = 0;
    for (let t = 0; t < TN; t++) if (this.ts[t] < 0) f++;
    let maxGroup = 1;
    let welded = 0;
    for (const g of this.groups) { maxGroup = Math.max(maxGroup, g.length); welded += g.length; }
    return { flipped: f / TN, maxGroup, welded };
  }

  judge(): Judge {
    if (this.balled) return { score: 3, compact: 1, rect: 0, weld: 0, ball: true, flat: false };
    const pts: number[][] = [];
    for (let k = 0; k < N; k++) pts.push([this.x[k], this.y[k]]);
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo: number[][] = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    const up: number[][] = [];
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    const hull = lo.slice(0, -1).concat(up.slice(0, -1));
    let area = 0;
    for (let i = 0; i < hull.length; i++) { const a = hull[i]; const b = hull[(i + 1) % hull.length]; area += a[0] * b[1] - b[0] * a[1]; }
    area = Math.abs(area) / 2;
    let rectArea = Infinity;
    for (let deg = 0; deg < 90; deg += 2) {
      const t = (deg * Math.PI) / 180;
      const c = Math.cos(t);
      const s = Math.sin(t);
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const p of hull) {
        const u = p[0] * c + p[1] * s;
        const v = -p[0] * s + p[1] * c;
        u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
      }
      rectArea = Math.min(rectArea, (u1 - u0) * (v1 - v0));
    }
    const fill = rectArea > 0 ? area / rectArea : 0;
    const compact = clamp01((1 - area / ORIG_AREA) / 0.72);
    const rect = clamp01((fill - 0.55) / 0.4);
    const st = this.stats();
    const weld = st.welded ? (st.maxGroup - 1) / 3 : 0;
    const score = Math.round(100 * (0.4 * rect + 0.35 * compact + 0.25 * weld));
    return { score, compact, rect, weld, ball: false, flat: compact < 0.15 };
  }

  draw(ctx: CanvasRenderingContext2D, hover: number) {
    const { x, y, tz, ta, tb, tc } = this;
    const order = this.order;
    const ts = this.ts;
    order.sort((p, q) => tz[p] - tz[q] || ts[q] - ts[p] || p - q);
    const triPath = (t: number, ox: number, oy: number) => {
      ctx.moveTo(x[ta[t]] + ox, y[ta[t]] + oy);
      ctx.lineTo(x[tb[t]] + ox, y[tb[t]] + oy);
      ctx.lineTo(x[tc[t]] + ox, y[tc[t]] + oy);
      ctx.closePath();
    };
    ctx.fillStyle = "rgba(40,38,30,0.10)";
    ctx.beginPath();
    for (const t of order) triPath(t, 6, 9);
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    let start = 0;
    while (start < order.length) {
      const z = tz[order[start]];
      let end = start;
      while (end < order.length && tz[order[end]] === z) end++;
      if (start > 0) {
        ctx.fillStyle = "rgba(40,38,30,0.12)";
        ctx.beginPath();
        for (let n = start; n < end; n++) triPath(order[n], 2.5, 4);
        ctx.fill();
      }
      for (let n = start; n < end; n++) {
        const t = order[n];
        // Colour follows how far the triangle has actually turned over, so creases
        // read as a soft rolled edge instead of hard grid teeth.
        const cr = this.triCross(t) / TRI_REST;
        const f = clamp01((cr + 0.6) / 1.2);
        const turn = f * f * (3 - 2 * f);
        const shade = 0.8 + 0.2 * Math.min(1, Math.abs(cr) * 1.6);
        const col = `hsl(213 ${(26 + 4 * turn).toFixed(1)}% ${((85 - 14 * turn) * shade).toFixed(1)}%)`;
        ctx.beginPath();
        triPath(t, 0, 0);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.7;
        ctx.stroke();
        const edges = this.triEdges[t];
        if (!edges) continue;
        for (const [p0, p1, el] of edges) {
          ctx.strokeStyle = el ? "#4A5F78" : "#6F86A1";
          ctx.lineWidth = el ? 3.4 : 1.7;
          ctx.beginPath();
          ctx.moveTo(x[p0], y[p0]);
          ctx.lineTo(x[p1], y[p1]);
          ctx.stroke();
          if (el) {
            const mx = (x[p0] + x[p1]) / 2;
            const my = (y[p0] + y[p1]) / 2;
            const dx = x[p1] - x[p0];
            const dy = y[p1] - y[p0];
            const d = Math.hypot(dx, dy) || 1;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(mx - (dy / d) * 3.5, my + (dx / d) * 3.5);
            ctx.lineTo(mx + (dy / d) * 3.5, my - (dx / d) * 3.5);
            ctx.stroke();
          }
        }
      }
      start = end;
    }
    for (const t of this.snapTargets()) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, SNAP, 0, Math.PI * 2);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = t.hot ? "#1C1C1A" : "rgba(28,28,26,0.28)";
      ctx.lineWidth = t.hot ? 2 : 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      if (t.hot) {
        ctx.fillStyle = "rgba(28,28,26,0.06)";
        ctx.fill();
      }
    }
    for (const g of this.groups) {
      ctx.beginPath();
      ctx.arc(x[g[0]], y[g[0]], 4 + g.length, 0, Math.PI * 2);
      ctx.fillStyle = "#1C1C1A";
      ctx.fill();
      ctx.strokeStyle = "#FBFAF7";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const ring = this.held >= 0 ? this.held : hover;
    if (ring >= 0) {
      ctx.beginPath();
      ctx.arc(x[ring], y[ring], this.held >= 0 ? 13 : 11, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(28,28,26,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

export function tierFor(j: Judge) {
  if (j.ball) return { tier: "Rolled into a ball", line: "The method most people choose, eventually. Top shelf of the closet it is." };
  if (j.flat) return { tier: "Still a sheet", line: "This is the before photo. Were you planning to put it back on the bed?" };
  if (j.score >= 88) return { tier: "Hotel standard", line: "Crisp corners. This could live in a linen closet with dignity." };
  if (j.score >= 70) return { tier: "Parent-approved", line: "Close enough that nobody will refold it behind your back." };
  if (j.score >= 50) return { tier: "Closet secret", line: "Once the door is shut, only you will know." };
  if (j.score >= 30) return { tier: "Folded, ish", line: "The corners are still not on speaking terms." };
  return { tier: "Mostly a lump", line: "The elastic won today. It usually does." };
}
