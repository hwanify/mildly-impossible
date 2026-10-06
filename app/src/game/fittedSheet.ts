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
// The two sides of the cloth: printed denim on the right side, plain and pale on the wrong side.
const FRONT = "#6E86A4";
const STRIPE = "rgba(255,255,255,0.2)";
const BACK = "#DDE3EA";
const HEM = "rgba(40,54,74,0.7)";
const OUTLINE = "#2B3A4F";
const FLIP_T = TRI_REST * 0.12;
const ORIG_AREA = QX * S * QY * S;

type Con = { a: number; b: number; rest: number; ks: number; kc: number; el: boolean };
type Edge = [number, number, boolean];
type Chain = { c: number[]; pts: number[][]; votes: number };
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
  /** Inner edges as [p0, p1, triangle, triangle]. */
  inner: [number, number, number, number][] = [];
  /** The inner edges the front-side stripes run along. */
  stripes: [number, number, number, number][] = [];
  /** Triangles sharing an edge with each triangle. */
  nbr: number[][] = [];
  /** The side each triangle is drawn on (its real side, minus small specks). */
  ds = new Int8Array(TN);
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
    // Inner edges shared by two triangles: where the two sit on different sides, that's a crease.
    const shared = new Map<number, number[]>();
    for (let tt = 0; tt < TN; tt++) {
      const v = [this.ta[tt], this.tb[tt], this.tc[tt]];
      for (let e = 0; e < 3; e++) {
        const p = v[e];
        const q = v[(e + 1) % 3];
        const key = Math.min(p, q) * N + Math.max(p, q);
        const list = shared.get(key);
        if (list) list.push(tt);
        else shared.set(key, [tt]);
      }
    }
    for (const [key, ts] of shared) {
      if (ts.length !== 2) continue;
      const p = Math.floor(key / N);
      const q = key % N;
      this.inner.push([p, q, ts[0], ts[1]]);
      (this.nbr[ts[0]] ??= []).push(ts[1]);
      (this.nbr[ts[1]] ??= []).push(ts[0]);
      // the print: pinstripes along every other column of the grid, on the right side of the cloth only
      if (p % NX === q % NX && (p % NX) % 2 === 1) this.stripes.push([p, q, ts[0], ts[1]]);
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

  // A fold runs across the grid, so the edges where the cloth turns over make a staircase.
  // Join them into chains, smooth the chains, and fill the notches up to the smoothed line in
  // the colour of the side on top. No line: the colours and the layer shadows show the fold.
  private smoothCreases(ctx: CanvasRenderingContext2D, chains: Chain[]) {
    const { x, y } = this;
    for (const { c, pts, votes } of chains) {
      // fill the notches between the jagged edge and its smoothed line, in the colour on top
      ctx.beginPath();
      ctx.moveTo(x[c[0]], y[c[0]]);
      for (let i = 1; i < c.length; i++) ctx.lineTo(x[c[i]], y[c[i]]);
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = votes > 0 ? FRONT : BACK;
      ctx.fill();
    }
  }

  // Every crease edge, grouped by the layer it belongs to (the upper of its two triangles).
  private creaseEdges() {
    const { ds, tz } = this;
    const byZ = new Map<number, number[]>();
    this.inner.forEach(([, , t0, t1], e) => {
      if (ds[t0] === ds[t1]) return;
      const z = Math.max(tz[t0], tz[t1]);
      const l = byZ.get(z);
      if (l) l.push(e);
      else byZ.set(z, [e]);
    });
    return byZ;
  }

  // The creases in one layer, as smoothed chains of points.
  private creaseChains(edges: number[]) {
    const { x, y, tz } = this;
    const found: Chain[] = [];
    const ts = this.ds;
    const next = new Map<number, number[]>();
    const top = new Map<number, number>(); // per edge key: the side showing on top
    const link = (a: number, b: number) => {
      const l = next.get(a);
      if (l) l.push(b);
      else next.set(a, [b]);
    };
    for (const e of edges) {
      const [p0, p1, t0, t1] = this.inner[e];
      link(p0, p1);
      link(p1, p0);
      const upper = tz[t0] === tz[t1] ? -1 : tz[t0] > tz[t1] ? ts[t0] : ts[t1];
      top.set(Math.min(p0, p1) * N + Math.max(p0, p1), upper);
    }
    if (!next.size) return found;
    // snip the one-edge spurs that stick out at the corners of the staircase
    const unlink = (a: number, b: number) => next.set(a, (next.get(a) ?? []).filter((v) => v !== b));
    for (let pass = 0; pass < 2; pass++)
      for (const [v, ns] of [...next]) {
        if (ns.length !== 1) continue;
        const u = ns[0];
        if ((next.get(u)?.length ?? 0) < 3) continue;
        unlink(v, u);
        unlink(u, v);
      }
    const used = new Set<number>();
    const key = (a: number, b: number) => Math.min(a, b) * N + Math.max(a, b);
    const walk = (from: number, to: number) => {
      const chain = [from, to];
      used.add(key(from, to));
      let prev = from;
      let cur = to;
      for (;;) {
        const ns = next.get(cur) ?? [];
        if (ns.length !== 2) break;
        const nx = ns[0] === prev ? ns[1] : ns[0];
        if (used.has(key(cur, nx))) break;
        used.add(key(cur, nx));
        chain.push(nx);
        prev = cur;
        cur = nx;
      }
      return chain;
    };
    const chains: number[][] = [];
    // open chains first (from their ends or branch points), then whatever loops are left
    for (const [v, ns] of next) if (ns.length !== 2) for (const n of ns) if (!used.has(key(v, n))) chains.push(walk(v, n));
    for (const [v, ns] of next) for (const n of ns) if (!used.has(key(v, n))) chains.push(walk(v, n));
    for (const c of chains) {
      const closed = c.length > 3 && c[0] === c[c.length - 1];
      // tiny rings are crumple noise, not folds
      if ((closed && c.length < 9) || c.length < 3) continue;
      let pts = c.map((k) => [x[k], y[k]]);
      // iron out the zigzag first (a few passes of a 1-2-1 average), then round it off
      for (let it = 0; it < 3 && pts.length > 2; it++) {
        const out = pts.map((p) => [...p]);
        const n = pts.length;
        for (let i = 0; i < n; i++) {
          const atEnd = i === 0 || i === n - 1;
          if (atEnd && !closed) continue;
          const a = pts[atEnd ? n - 2 : i - 1];
          const b = pts[atEnd ? 1 : i + 1];
          out[i] = [(a[0] + 2 * pts[i][0] + b[0]) / 4, (a[1] + 2 * pts[i][1] + b[1]) / 4];
        }
        if (closed) out[n - 1] = out[0];
        pts = out;
      }
      // Chaikin, twice, keeping the ends where they are
      for (let it = 0; it < 2 && pts.length > 2; it++) {
        const out = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
          const [ax, ay] = pts[i];
          const [bx, by] = pts[i + 1];
          out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
        }
        out.push(pts[pts.length - 1]);
        pts = out;
      }
      if (closed) {
        // a thin pocket of the other side, not worth smoothing
        let area = 0;
        for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
        if (Math.abs(area) / 2 < 1600) continue;
      }
      let votes = 0;
      for (let i = 0; i < c.length - 1; i++) votes += top.get(key(c[i], c[i + 1])) ?? -1;
      found.push({ c, pts, votes });
    }
    return found;
  }

  // A patch of up to three triangles turned over among cloth that isn't is a crumple, not a
  // fold: draw it on its neighbours' side so it doesn't show up as a speck of the other colour.
  private despeckle() {
    const { ts, ds } = this;
    ds.set(ts);
    const seen = new Uint8Array(TN);
    const comp: number[] = [];
    for (let t = 0; t < TN; t++) {
      if (seen[t]) continue;
      comp.length = 0;
      comp.push(t);
      seen[t] = 1;
      for (let i = 0; i < comp.length; i++)
        for (const o of this.nbr[comp[i]] ?? [])
          if (!seen[o] && ts[o] === ts[t]) {
            seen[o] = 1;
            comp.push(o);
          }
      if (comp.length <= 3) for (const k of comp) ds[k] = -ts[t];
    }
  }

  draw(ctx: CanvasRenderingContext2D, hover: number) {
    this.drawCloth(ctx);
    this.drawMarks(ctx, hover);
  }

  private drawCloth(ctx: CanvasRenderingContext2D) {
    const { x, y, tz, ta, tb, tc } = this;
    const order = this.order;
    this.despeckle();
    const ts = this.ds;
    order.sort((p, q) => tz[p] - tz[q] || ts[q] - ts[p] || p - q);
    const triPath = (t: number, ox: number, oy: number) => {
      ctx.moveTo(x[ta[t]] + ox, y[ta[t]] + oy);
      ctx.lineTo(x[tb[t]] + ox, y[tb[t]] + oy);
      ctx.lineTo(x[tc[t]] + ox, y[tc[t]] + oy);
      ctx.closePath();
    };
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // Every triangle, wound the same way, as one shape (so they merge with no seams).
    const wound = (t: number) => {
      const a = ta[t];
      const b = this.triCross(t) >= 0 ? tb[t] : tc[t];
      const c = b === tb[t] ? tc[t] : tb[t];
      ctx.moveTo(x[a], y[a]);
      ctx.lineTo(x[b], y[b]);
      ctx.lineTo(x[c], y[c]);
      ctx.closePath();
    };
    const whole = () => {
      ctx.beginPath();
      for (const t of order) wound(t);
    };
    // The creases of each layer, worked out once per frame.
    const creases = new Map<number, Chain[]>();
    for (const [z, edges] of this.creaseEdges()) creases.set(z, this.creaseChains(edges));
    const chains = [...creases.values()].flat();
    // A soft band along every crease. Inside the pile the cloth covers it; on the outside it
    // rounds off the staircase the grid leaves where the cloth folds over.
    const bands = () => {
      ctx.beginPath();
      for (const { pts } of chains) {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      }
    };
    // its shadow on the mattress
    ctx.fillStyle = "rgba(40,38,30,0.10)";
    ctx.beginPath();
    for (const t of order) triPath(t, 6, 9);
    ctx.fill();
    // One outline around the whole pile: stroke its edges thick and dark, then cover that with
    // a single pale fill of all of it, so only the outside half of the stroke is left.
    // (The outside can only be the hem or somewhere near a fold, so only those get stroked.)
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    for (let t = 0; t < TN; t++) for (const [p0, p1] of this.triEdges[t] ?? []) {
      ctx.moveTo(x[p0], y[p0]);
      ctx.lineTo(x[p1], y[p1]);
    }
    for (const [p0, p1, t0, t1] of this.inner) {
      if (this.ts[t0] === this.ts[t1]) continue;
      ctx.moveTo(x[p0], y[p0]);
      ctx.lineTo(x[p1], y[p1]);
    }
    ctx.stroke();
    ctx.lineWidth = 9 + 3.6;
    bands();
    ctx.stroke();
    ctx.fillStyle = BACK;
    whole();
    ctx.fill();
    ctx.strokeStyle = BACK;
    ctx.lineWidth = 9;
    bands();
    ctx.stroke();
    // Each side as one shape: every triangle wound the same way, so they merge with no seams.
    const sidePath = (from: number, to: number, side: number) => {
      ctx.beginPath();
      for (let n = from; n < to; n++) if (ts[order[n]] === side) wound(order[n]);
    };
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
      const here = (t: number) => tz[t] === z;
      // the right side: denim, with its pinstripes
      sidePath(start, end, 1);
      ctx.fillStyle = FRONT;
      ctx.fill();
      ctx.strokeStyle = STRIPE;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (const [p0, p1, t0, t1] of this.stripes) {
        if (!((here(t0) && ts[t0] > 0) || (here(t1) && ts[t1] > 0))) continue;
        ctx.moveTo(x[p0], y[p0]);
        ctx.lineTo(x[p1], y[p1]);
      }
      ctx.stroke();
      // the wrong side: plain and pale
      sidePath(start, end, -1);
      ctx.fillStyle = BACK;
      ctx.fill();
      // creases, where the cloth turns over; drawn with the upper of the two layers
      this.smoothCreases(ctx, creases.get(z) ?? []);
      // the hem goes on last, so nothing in this layer paints over it; thin, because the
      // outline around the whole pile does the heavy lifting (elastic is a bit thicker)
      for (const el of [false, true]) {
        ctx.strokeStyle = HEM;
        ctx.lineWidth = el ? 2.6 : 1.3;
        ctx.beginPath();
        for (let n = start; n < end; n++) {
          const edges = this.triEdges[order[n]];
          if (!edges) continue;
          for (const [p0, p1, e] of edges) {
            if (e !== el) continue;
            ctx.moveTo(x[p0], y[p0]);
            ctx.lineTo(x[p1], y[p1]);
          }
        }
        ctx.stroke();
      }
      start = end;
    }
  }

  // Corner targets, tucked corners and the hand, on top of everything.
  private drawMarks(ctx: CanvasRenderingContext2D, hover: number) {
    const { x, y } = this;
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
