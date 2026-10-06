// Fitted-sheet cloth toy. Pure module: no browser globals at top level (SSR safe).
export const W = 1000;
export const H = 640;
export const NX = 24;
export const NY = 16;
export const S = 24;
const N = NX * NY;
const QX = NX - 1;
const QN = (NX - 1) * (NY - 1);
const EL = 4; // elastic cells from each corner
const FRICTION = 0.8;
const ITER = 14;
export const SNAP = 46;
const GRAB = 40;
const REST_AREA = S * S;
const ORIG_AREA = (NX - 1) * S * (NY - 1) * S;

type Con = { a: number; b: number; rest: number; ks: number; kc: number; el: boolean };
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
  qz = new Float32Array(QN);
  qs = new Int8Array(QN);
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
    for (let q = 0; q < QN; q++) this.order.push(q);
    this.scramble(seed);
  }

  private isEl(a: number, b: number) {
    return this.elKeys.has(a * N + b) || this.elKeys.has(b * N + a);
  }

  // Fresh out of the dryer: flat sheet folded twice along random lines.
  scramble(seed: number) {
    const r = rng(seed);
    this.x.set(this.rx);
    this.y.set(this.ry);
    this.qz.fill(0);
    this.groups = [];
    this.frozen = false;
    this.balled = false;
    this.anim = null;
    for (let f = 1; f <= 2; f++) {
      const cx = W / 2 + (r() - 0.5) * 160;
      const cy = H / 2 + (r() - 0.5) * 90;
      const ang = r() * Math.PI;
      const flip = r() < 0.5 ? 1 : -1;
      const nx = Math.cos(ang) * flip;
      const ny = Math.sin(ang) * flip;
      const mark = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        const d = (this.x[k] - cx) * nx + (this.y[k] - cy) * ny;
        if (d > 0) {
          this.x[k] -= 2 * d * nx;
          this.y[k] -= 2 * d * ny;
          mark[k] = 1;
        }
      }
      for (let q = 0; q < QN; q++) {
        const i = q % QX;
        const j = (q / QX) | 0;
        const a = idx(i, j);
        if (mark[a] && mark[a + 1] && mark[a + NX] && mark[a + NX + 1]) this.qz[q] = f;
      }
    }
    for (let k = 0; k < N; k++) {
      this.x[k] = Math.max(20, Math.min(W - 20, this.x[k] + (r() - 0.5) * 4));
      this.y[k] = Math.max(20, Math.min(H - 20, this.y[k] + (r() - 0.5) * 4));
    }
    this.px.set(this.x);
    this.py.set(this.y);
    this.level = 2;
    this.updateSigns(true);
  }

  groupOf(k: number): number[] | null {
    for (const g of this.groups) if (g.includes(k)) return g;
    return null;
  }

  private quadCross(q: number) {
    const i = q % QX;
    const j = (q / QX) | 0;
    const a = idx(i, j);
    const b = a + 1;
    const c = a + NX + 1;
    const d = a + NX;
    return (this.x[c] - this.x[a]) * (this.y[d] - this.y[b]) - (this.y[c] - this.y[a]) * (this.x[d] - this.x[b]);
  }

  private updateSigns(init = false) {
    const hs = this.heldSet;
    for (let q = 0; q < QN; q++) {
      const s = this.quadCross(q) >= 0 ? 1 : -1;
      if (!init && s !== this.qs[q] && this.held >= 0) this.qz[q] = this.level;
      this.qs[q] = s;
      if (hs.size) {
        const a = idx(q % QX, (q / QX) | 0);
        if (hs.has(a) || hs.has(a + 1) || hs.has(a + NX) || hs.has(a + NX + 1)) this.qz[q] = this.level;
      }
    }
  }

  private pointZ(k: number) {
    const i = k % NX;
    const j = (k / NX) | 0;
    let z = -1;
    for (let dj = -1; dj <= 0; dj++)
      for (let di = -1; di <= 0; di++) {
        const qi = i + di;
        const qj = j + dj;
        if (qi >= 0 && qj >= 0 && qi < QX && qj < NY - 1) z = Math.max(z, this.qz[qj * QX + qi]);
      }
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
    this.qz.fill(0);
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
    for (let q = 0; q < QN; q++) this.qz[q] = (r() * 8) | 0;
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
      for (let q = 0; q < QN; q++) this.qs[q] = this.quadCross(q) >= 0 ? 1 : -1;
    } else this.updateSigns();
  }

  stats(): SheetStats {
    let f = 0;
    for (let q = 0; q < QN; q++) if (this.qs[q] < 0) f++;
    let maxGroup = 1;
    let welded = 0;
    for (const g of this.groups) { maxGroup = Math.max(maxGroup, g.length); welded += g.length; }
    return { flipped: f / QN, maxGroup, welded };
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
    const { x, y, qz, qs } = this;
    const order = this.order;
    order.sort((p, q) => qz[p] - qz[q] || p - q);
    const quadPath = (q: number, ox: number, oy: number) => {
      const a = idx(q % QX, (q / QX) | 0);
      ctx.moveTo(x[a] + ox, y[a] + oy);
      ctx.lineTo(x[a + 1] + ox, y[a + 1] + oy);
      ctx.lineTo(x[a + NX + 1] + ox, y[a + NX + 1] + oy);
      ctx.lineTo(x[a + NX] + ox, y[a + NX] + oy);
      ctx.closePath();
    };
    ctx.fillStyle = "rgba(28,52,96,0.11)";
    ctx.beginPath();
    for (const q of order) quadPath(q, 6, 9);
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    let start = 0;
    while (start < order.length) {
      const z = qz[order[start]];
      let end = start;
      while (end < order.length && qz[order[end]] === z) end++;
      if (start > 0) {
        ctx.fillStyle = "rgba(28,52,96,0.13)";
        ctx.beginPath();
        for (let n = start; n < end; n++) quadPath(order[n], 2.5, 4);
        ctx.fill();
      }
      for (let n = start; n < end; n++) {
        const q = order[n];
        const i = q % QX;
        const j = (q / QX) | 0;
        const ratio = Math.min(1, Math.abs(this.quadCross(q)) / 2 / REST_AREA);
        const shade = 0.76 + 0.24 * ratio;
        const pocket = (i < 2 || i >= QX - 2) && (j < 2 || j >= NY - 3);
        let col: string;
        if (qs[q] > 0) {
          const base = (i % 4 === 1 ? 65 : 73) - (pocket ? 7 : 0);
          col = `hsl(212 82% ${(base * shade).toFixed(1)}%)`;
        } else {
          col = `hsl(210 70% ${((pocket ? 82 : 89) * shade).toFixed(1)}%)`;
        }
        ctx.beginPath();
        quadPath(q, 0, 0);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        const a = idx(i, j);
        const edges: [number, number][] = [];
        if (j === 0) edges.push([a, a + 1]);
        if (i === QX - 1) edges.push([a + 1, a + NX + 1]);
        if (j === NY - 2) edges.push([a + NX + 1, a + NX]);
        if (i === 0) edges.push([a + NX, a]);
        for (const [p0, p1] of edges) {
          const el = this.isEl(p0, p1);
          ctx.strokeStyle = el ? "#2459A0" : "#3B78C2";
          ctx.lineWidth = el ? 4.2 : 2.4;
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
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(mx - (dy / d) * 4, my + (dx / d) * 4);
            ctx.lineTo(mx + (dy / d) * 4, my - (dx / d) * 4);
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
      ctx.strokeStyle = t.hot ? "#FF5A4E" : "rgba(27,31,42,0.35)";
      ctx.lineWidth = t.hot ? 3 : 2;
      ctx.stroke();
      ctx.setLineDash([]);
      if (t.hot) {
        ctx.fillStyle = "rgba(255,90,78,0.14)";
        ctx.fill();
      }
    }
    for (const g of this.groups) {
      ctx.beginPath();
      ctx.arc(x[g[0]], y[g[0]], 6 + g.length, 0, Math.PI * 2);
      ctx.fillStyle = "#FF5A4E";
      ctx.fill();
      ctx.strokeStyle = "#1B1F2A";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    const ring = this.held >= 0 ? this.held : hover;
    if (ring >= 0) {
      ctx.beginPath();
      ctx.arc(x[ring], y[ring], this.held >= 0 ? 13 : 11, 0, Math.PI * 2);
      ctx.strokeStyle = "#1B1F2A";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
}

export function tierFor(j: Judge) {
  if (j.ball) return { tier: "공 완성", line: "축하합니다. 결국 대부분이 고르는 방법을 고르셨습니다. 옷장 맨 위 칸에 던져 넣으세요." };
  if (j.flat) return { tier: "아직 펼친 상태", line: "이건 개기 전입니다. 침대에 다시 씌우실 건가요?" };
  if (j.score >= 88) return { tier: "호텔 하우스키핑급", line: "각이 살아 있습니다. 서랍 속에서도 빛날 겁니다." };
  if (j.score >= 70) return { tier: "엄마 합격선", line: "\"그래도 이건 좀 낫네\" 소리를 들을 수 있는 수준입니다." };
  if (j.score >= 50) return { tier: "옷장 속 비밀", line: "문 닫으면 아무도 모릅니다. 당신만 압니다." };
  if (j.score >= 30) return { tier: "갰다기보단 접었다", line: "모서리들이 아직 서로 낯을 가립니다." };
  return { tier: "뭉친 것에 가까움", line: "고무줄이 이겼습니다. 오늘은 고무줄의 날입니다." };
}
