// Cut the Pizza Equally: straight cuts across a slightly irregular pizza.
// Pure TypeScript + canvas 2D, fixed 1000x640 world. No window/document at import time.

export const W = 1000;
export const H = 640;
export const CX = 500;
export const CY = 322;
export const R = 246;
export const SLICES = 8;

type P = { x: number; y: number };

export type Piece = { poly: P[]; area: number; cx: number; cy: number; ox: number; oy: number };

export type CutEvent = "miss" | "cut" | "center" | "crumb" | "halves" | "quarters" | "eight";

export type PizzaResult = {
  pcts: number[]; // the 8 largest pieces, % of the whole pizza, largest first
  ratio: number; // largest / smallest of those 8
  biggest: number;
  smallest: number;
  off: number; // average distance from 12.5%, relative, in %
  crumbs: number; // pieces beyond the 8 largest
  cuts: number;
};

const mulberry = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function measure(poly: P[]) {
  let a = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const c = p.x * q.y - q.x * p.y;
    a += c;
    x += (p.x + q.x) * c;
    y += (p.y + q.y) * c;
  }
  if (Math.abs(a) < 1e-9) return { area: 0, cx: poly[0]?.x ?? 0, cy: poly[0]?.y ?? 0 };
  return { area: Math.abs(a / 2), cx: x / (3 * a), cy: y / (3 * a) };
}

// Keep the part of a convex polygon where nx*x + ny*y >= d.
function clip(poly: P[], nx: number, ny: number, d: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = nx * p.x + ny * p.y - d;
    const sq = nx * q.x + ny * q.y - d;
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return out;
}

type Topping = { x: number; y: number; r: number; a: number };

export class Pizza {
  outline: P[] = [];
  pieces: Piece[] = [];
  total = 0;
  cx = CX;
  cy = CY;
  cuts = 0;
  served = false;
  drag: { a: P; b: P } | null = null;
  lastCut: { a: P; b: P; t: number } | null = null;
  private pepperoni: Topping[] = [];
  private blobs: Topping[] = [];
  private basil: Topping[] = [];
  private wob: number[] = [];

  constructor(seed: number) {
    const rnd = mulberry(seed);
    const a1 = rnd() * 6.28;
    const a2 = rnd() * 6.28;
    const a3 = rnd() * 6.28;
    // Low-frequency wobble keeps the outline convex, so every piece stays convex too.
    const N = 160;
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2;
      const r = R * (1 + 0.022 * Math.sin(2 * th + a1) + 0.014 * Math.sin(3 * th + a2) + 0.006 * Math.sin(5 * th + a3));
      this.outline.push({ x: CX + Math.cos(th) * r, y: CY + Math.sin(th) * r });
    }
    const m = measure(this.outline);
    this.total = m.area;
    this.cx = m.cx;
    this.cy = m.cy;
    this.pieces = [{ poly: this.outline, area: m.area, cx: m.cx, cy: m.cy, ox: 0, oy: 0 }];
    for (let i = 0; i < 9; i++) this.wob.push(rnd() * 6.28);

    let tries = 0;
    while (this.pepperoni.length < 17 && tries++ < 600) {
      const ang = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * R * 0.74;
      const t = { x: CX + Math.cos(ang) * d, y: CY + Math.sin(ang) * d, r: 19 + rnd() * 6, a: rnd() * 6.28 };
      if (this.pepperoni.every((o) => Math.hypot(o.x - t.x, o.y - t.y) > o.r + t.r + 6)) this.pepperoni.push(t);
    }
    for (let i = 0; i < 26; i++) {
      const ang = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * R * 0.78;
      this.blobs.push({ x: CX + Math.cos(ang) * d, y: CY + Math.sin(ang) * d, r: 8 + rnd() * 16, a: rnd() * 6.28 });
    }
    for (let i = 0; i < 6; i++) {
      const ang = rnd() * Math.PI * 2;
      const d = (0.2 + rnd() * 0.5) * R;
      this.basil.push({ x: CX + Math.cos(ang) * d, y: CY + Math.sin(ang) * d, r: 9 + rnd() * 4, a: rnd() * 6.28 });
    }
  }

  get count() {
    return this.pieces.length;
  }

  /** A straight cut along the line through a and b. The cutter keeps rolling to the edge. */
  cut(a: P, b: P): CutEvent | null {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 24 || this.served) return null;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const d = nx * a.x + ny * a.y;
    const next: Piece[] = [];
    let split = false;
    let crumb = false;
    for (const pc of this.pieces) {
      // Pieces are drawn shifted apart; cut them where they are on screen.
      const dd = d - (nx * pc.ox + ny * pc.oy);
      const L = clip(pc.poly, nx, ny, dd);
      const Rr = clip(pc.poly, -nx, -ny, -dd);
      const ml = L.length > 2 ? measure(L) : null;
      const mr = Rr.length > 2 ? measure(Rr) : null;
      if (!ml || !mr || ml.area < 0.5 || mr.area < 0.5) {
        next.push(pc);
        continue;
      }
      split = true;
      for (const [poly, m] of [
        [L, ml],
        [Rr, mr],
      ] as const) {
        if (m.area < this.total * 0.015) crumb = true;
        next.push({ poly, area: m.area, cx: m.cx, cy: m.cy, ox: pc.ox, oy: pc.oy });
      }
    }
    if (!split) return "miss";
    const before = this.pieces.length;
    this.pieces = next;
    this.cuts++;
    this.lastCut = { a, b, t: 0 };
    const n = next.length;
    if (n >= SLICES) {
      this.served = true;
      return "eight";
    }
    if (crumb) return "crumb";
    if (this.cuts === 1 && Math.abs(nx * this.cx + ny * this.cy - d) < 5) return "center";
    if (before < 2 && n >= 2 && this.cuts === 1) return "halves";
    if (before < 4 && n >= 4) return "quarters";
    return "cut";
  }

  result(): PizzaResult {
    const areas = this.pieces.map((p) => p.area).sort((a, b) => b - a);
    const top = areas.slice(0, SLICES);
    const pcts = top.map((a) => (a / this.total) * 100);
    const biggest = pcts[0] ?? 0;
    const smallest = pcts[pcts.length - 1] ?? 0;
    const ideal = 100 / SLICES;
    const off = (pcts.reduce((s, p) => s + Math.abs(p - ideal), 0) / Math.max(1, pcts.length) / ideal) * 100;
    return {
      pcts,
      ratio: smallest > 0 ? biggest / smallest : Infinity,
      biggest,
      smallest,
      off,
      crumbs: Math.max(0, areas.length - SLICES),
      cuts: this.cuts,
    };
  }

  /** Ease pieces apart a little so the cuts show. */
  step() {
    const gap = this.served ? 10 : 5;
    for (const p of this.pieces) {
      const dx = p.cx - this.cx;
      const dy = p.cy - this.cy;
      const dist = Math.hypot(dx, dy);
      const k = dist < 1 ? 0 : (gap * Math.min(1, dist / 40)) / dist;
      p.ox += (dx * k - p.ox) * 0.18;
      p.oy += (dy * k - p.oy) * 0.18;
    }
    if (this.lastCut) {
      this.lastCut.t += 1;
      if (this.lastCut.t > 24) this.lastCut = null;
    }
  }

  /** Jump the pieces straight to their resting offsets (for stills). */
  settle() {
    for (let i = 0; i < 80; i++) this.step();
  }

  private path(ctx: CanvasRenderingContext2D, poly: P[], s = 1, ox = 0, oy = 0) {
    ctx.beginPath();
    poly.forEach((p, i) => {
      const x = CX + (p.x - CX) * s + ox;
      const y = CY + (p.y - CY) * s + oy;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
  }

  private drawPizza(ctx: CanvasRenderingContext2D) {
    // crust
    this.path(ctx, this.outline);
    ctx.fillStyle = "#D9AE74";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#BF925A";
    ctx.stroke();
    this.path(ctx, this.outline, 0.955);
    ctx.fillStyle = "#E4BE86";
    ctx.fill();
    // sauce
    this.path(ctx, this.outline, 0.885);
    ctx.fillStyle = "#B4513A";
    ctx.fill();
    // cheese, with a wavy edge so a little sauce peeks out
    ctx.beginPath();
    const n = this.outline.length;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const p = this.outline[i];
      const s = 0.85 + 0.018 * Math.sin(7 * th + this.wob[0]) + 0.012 * Math.sin(11 * th + this.wob[1]);
      const x = CX + (p.x - CX) * s;
      const y = CY + (p.y - CY) * s;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "#EFD08C";
    ctx.fill();
    ctx.fillStyle = "#F5DFA6";
    for (const b of this.blobs) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r, b.r * 0.7, b.a, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of this.pepperoni) {
      ctx.beginPath();
      ctx.arc(p.x + 1.5, p.y + 2, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(120,60,30,.18)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "#A9442F";
      ctx.fill();
      ctx.fillStyle = "#8E3626";
      for (let k = 0; k < 4; k++) {
        const ang = p.a + k * 1.7;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(ang) * p.r * 0.5, p.y + Math.sin(ang) * p.r * 0.5, p.r * 0.13, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const b of this.basil) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r, b.r * 0.5, b.a, 0, Math.PI * 2);
      ctx.fillStyle = "#6E8758";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.a) * b.r * 0.8, b.y - Math.sin(b.a) * b.r * 0.8);
      ctx.lineTo(b.x + Math.cos(b.a) * b.r * 0.8, b.y + Math.sin(b.a) * b.r * 0.8);
      ctx.strokeStyle = "#58704A";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  draw(ctx: CanvasRenderingContext2D, opts: { labels?: boolean; labelScale?: number } = {}) {
    // board
    ctx.beginPath();
    ctx.ellipse(CX + 4, CY + 10, R * 1.17, R * 1.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(28,28,26,.07)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CX, CY, R * 1.15, 0, Math.PI * 2);
    ctx.fillStyle = "#EADFCB";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#D6C8AF";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CX, CY, R * 1.08, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(190,170,138,.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    for (const pc of this.pieces) {
      ctx.save();
      ctx.translate(pc.ox, pc.oy);
      this.path(ctx, pc.poly);
      ctx.clip();
      this.drawPizza(ctx);
      ctx.restore();
    }

    if (this.lastCut) {
      const { a, b, t } = this.lastCut;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      ctx.beginPath();
      ctx.moveTo(a.x - ux * 600, a.y - uy * 600);
      ctx.lineTo(a.x + ux * 600, a.y + uy * 600);
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - t / 24)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (this.drag) {
      const { a, b } = this.drag;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = "rgba(28,28,26,.55)";
      ctx.setLineDash([7, 6]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      this.drawCutter(ctx, b.x, b.y, Math.atan2(b.y - a.y, b.x - a.x));
    }

    if (opts.labels) this.drawLabels(ctx, opts.labelScale ?? 1);
  }

  private drawCutter(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(-58, -26);
    ctx.lineTo(-62, -18);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fillStyle = "#1C1C1A";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(226,223,216,.92)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#6B6A65";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#1C1C1A";
    ctx.fill();
    ctx.restore();
  }

  private drawLabels(ctx: CanvasRenderingContext2D, k: number) {
    const sorted = [...this.pieces].sort((a, b) => b.area - a.area);
    const slices = sorted.slice(0, SLICES);
    const big = slices[0];
    const small = slices[slices.length - 1];
    ctx.font = `600 ${17 * k}px "Inter Tight", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const pc of slices) {
      const label = `${((pc.area / this.total) * 100).toFixed(1)}%`;
      // Nudge the label outward a little, toward the meaty part of the slice.
      const dx = pc.cx - this.cx;
      const dy = pc.cy - this.cy;
      const dist = Math.hypot(dx, dy) || 1;
      const push = dist < 30 ? 0 : 0.12 * R;
      const x = pc.cx + pc.ox + (dx / dist) * push;
      const y = pc.cy + pc.oy + (dy / dist) * push;
      const w = ctx.measureText(label).width + 16 * k;
      const fill = pc === big ? "#1C1C1A" : pc === small ? "#4A5F78" : "rgba(251,250,247,.94)";
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - 13 * k, w, 26 * k, 13 * k);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.fillStyle = pc === big || pc === small ? "#fff" : "#1C1C1A";
      ctx.fillText(label, x, y + k);
    }
  }
}

export function ratioText(ratio: number) {
  if (!Number.isFinite(ratio)) return "∞";
  return ratio < 1.1 ? ratio.toFixed(2) : ratio < 10 ? ratio.toFixed(1) : String(Math.round(ratio));
}

export function pizzaTier(ratio: number) {
  if (ratio < 1.06) return { tier: "Suspiciously fair", line: "Did you bring a protractor?" };
  if (ratio < 1.15) return { tier: "Fair enough", line: "Nobody will say anything. Out loud." };
  if (ratio < 1.35) return { tier: "Someone will notice", line: "There is one slice everyone is pretending not to want." };
  if (ratio < 1.8) return { tier: "Noticeably uneven", line: "Whoever picks first wins." };
  if (ratio < 3) return { tier: "A negotiation", line: "The big one has already been claimed." };
  return { tier: "Family meeting", line: "One slice is mostly crust and good intentions." };
}
