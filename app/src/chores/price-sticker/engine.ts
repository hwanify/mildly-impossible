// "Peel the Price Sticker": top-down view of a new hardcover with a price sticker on it.
// The sticker is a grid of small cells. Peeling is a paper fold: the corner you hold (C) is folded
// over to the pointer (P), and every cell on C's side of the perpendicular bisector lifts off.
// Peel too fast and it tears or leaves glue. Pure module, SSR safe (no globals at top level).
export const W = 1000;
export const H = 640;

const SW = 200; // sticker size, local units
const SH = 124;
const CELL = 4;
const NX = SW / CELL;
const NY = SH / CELL;
const RAD = 8;
const ORIGIN = { x: 352, y: 292 };
const ANG = -0.05;
const BOOK = { x0: 262, y0: 34, x1: 738, y1: 606 };
const DOT = { x: 152, y: 92, r: 20 }; // the "-30%" sticker on top: double the glue under it
const TS = 3; // texture resolution per local unit

// Peel speed thresholds, in local units per second of front advance, weighted by glue strength.
export const CLEAN = 150;
export const RISKY = 215;
export const SPEED_MAX = 320;
const YANK = 1000; // pointer pull speed that rips it outright

const STUCK = 1;
const FLAP = 2;
const GONE = 3;
const GLUE = 1;
const FUZZ = 2;

export type StickerState = "loose" | "held" | "bare" | "scratch" | "done";
export type StickerEvent = "grab" | "release" | "slip" | "tear" | "free" | "glue" | "middle" | "busy" | "scratch" | "lift" | "done";
type V = { x: number; y: number };
type Flyer = { cells: number[]; c: V; d: V; r: number; t: number };
type Scrap = { x: number; y: number; a: number; w: number; h: number };
type Tex = { c: CanvasImageSource; g: CanvasRenderingContext2D };

function rng(seed: number) {
  let s = seed >>> 0 || 17;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Smooth value noise on a coarse grid, sampled at cell centres.
function noiseField(rand: () => number, gx: number, gy: number) {
  const g = Array.from({ length: (gx + 1) * (gy + 1) }, rand);
  return (u: number, v: number) => {
    const x = u * gx;
    const y = v * gy;
    const i = Math.min(gx - 1, Math.floor(x));
    const j = Math.min(gy - 1, Math.floor(y));
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const at = (a: number, b: number) => g[b * (gx + 1) + a];
    const top = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
    const bot = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
    return top + (bot - top) * sy;
  };
}

function inRounded(x: number, y: number) {
  const cx = clamp(x, RAD, SW - RAD);
  const cy = clamp(y, RAD, SH - RAD);
  return (x - cx) ** 2 + (y - cy) ** 2 <= RAD * RAD;
}

function makeCanvas(w: number, h: number): Tex | null {
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(w, h);
    const g = c.getContext("2d") as unknown as CanvasRenderingContext2D | null;
    return g ? { c, g } : null;
  }
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  return g ? { c, g } : null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Sticker {
  state: StickerState = "loose";
  cell = new Uint8Array(NX * NY);
  res = new Uint8Array(NX * NY);
  glue = new Float32Array(NX * NY);
  total = 0;
  stuck = 0;
  // the current flap: corner C folded towards P, allowed directions around n0
  c: V = { x: 0, y: 0 };
  n0: V = { x: 1, y: 0 };
  p: V = { x: 0, y: 0 };
  base: V = { x: 0, y: 0 };
  grabAt: V = { x: 0, y: 0 };
  ptr: V = { x: 0, y: 0 };
  front = 0;
  speed = 0;
  jerk = 0; // how fast the tip is being pulled back, for yanks
  stress = 0;
  pieces = 0;
  scratches = 0;
  started = false;
  glued = false;
  claimed = 0; // cells lifted in the last step (for sound)
  scratchAt = -1;
  travel = 0;
  flyers: Flyer[] = [];
  scraps: Scrap[] = [];
  private n1: (u: number, v: number) => number;
  private n2: (u: number, v: number) => number;
  private rand: () => number;
  private time = 0;
  private front_ = new Uint8Array(NX * NY);
  private fibres: number[] = [];
  private tex: Tex | null = null;
  private weave: CanvasPattern | null = null;
  private bars: number[] = [];

  constructor(seed: number) {
    this.rand = rng(seed);
    const strength = noiseField(this.rand, 6, 4);
    this.n1 = noiseField(this.rand, 9, 6);
    this.n2 = noiseField(this.rand, 14, 9);
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const x = (i + 0.5) * CELL;
        const y = (j + 0.5) * CELL;
        const k = j * NX + i;
        if (!inRounded(x, y)) continue;
        this.cell[k] = STUCK;
        const dd = Math.hypot(x - DOT.x, y - DOT.y);
        this.glue[k] = 0.85 + strength(x / SW, y / SH) * 0.3 + 0.65 * Math.exp(-((dd / (DOT.r + 2)) ** 4));
        this.fibres.push(this.rand() * Math.PI, this.rand() * Math.PI);
        this.total++;
      }
    this.stuck = this.total;
    for (let x = 0; x < 62; ) {
      const w = this.rand() < 0.35 ? 2.2 : this.rand() < 0.5 ? 1.4 : 0.8;
      this.bars.push(x, w);
      x += w + 0.8 + this.rand() * 1.4;
    }
    // the shop left one corner lifted, as a treat
    this.startFlap({ x: 2.5, y: 2.5 }, norm({ x: SW, y: SH }), 26);
  }

  get peeled() {
    return 1 - this.stuck / this.total;
  }
  get glueCells() {
    let n = 0;
    for (let k = 0; k < this.res.length; k++) if (this.res[k]) n++;
    return n;
  }
  get clean() {
    return 1 - this.glueCells / this.total;
  }
  get hasFlap() {
    return this.state === "loose" || this.state === "held";
  }

  // world <-> sticker-local
  toLocal(x: number, y: number): V {
    const dx = x - ORIGIN.x;
    const dy = y - ORIGIN.y;
    const c = Math.cos(-ANG);
    const s = Math.sin(-ANG);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }

  private at(i: number, j: number) {
    return i < 0 || j < 0 || i >= NX || j >= NY ? 0 : this.cell[j * NX + i];
  }
  // a stuck cell next to a spot where paper was torn or lifted away
  private torn(k: number) {
    const i = k % NX;
    const j = (k - i) / NX;
    return this.at(i - 1, j) === GONE || this.at(i + 1, j) === GONE || this.at(i, j - 1) === GONE || this.at(i, j + 1) === GONE;
  }
  private center(k: number): V {
    return { x: ((k % NX) + 0.5) * CELL, y: (Math.floor(k / NX) + 0.5) * CELL };
  }

  private startFlap(c: V, n0: V, reach: number) {
    this.c = c;
    this.n0 = n0;
    this.p = { x: c.x + n0.x * reach, y: c.y + n0.y * reach };
    const k0 = reach / 2;
    for (let k = 0; k < this.cell.length; k++) {
      if (this.cell[k] !== STUCK) continue;
      const m = this.center(k);
      if ((m.x - c.x) * n0.x + (m.y - c.y) * n0.y < k0 && Math.hypot(m.x - c.x, m.y - c.y) < reach) {
        this.cell[k] = FLAP;
        this.stuck--;
      }
    }
    this.claim(this.p, false);
    this.measureFront();
    this.state = "loose";
  }

  // Fold C onto P: lift every stuck cell on C's side of the bisector that touches the flap.
  private claim(p: V, live: boolean, dt = 1) {
    const dx = p.x - this.c.x;
    const dy = p.y - this.c.y;
    const r = Math.hypot(dx, dy);
    if (r < 1) return [] as number[];
    const d = { x: dx / r, y: dy / r };
    const half = r / 2;
    const inside = (k: number) => {
      const m = this.center(k);
      return (m.x - this.c.x) * d.x + (m.y - this.c.y) * d.y < half;
    };
    const queue: number[] = [];
    for (let k = 0; k < this.cell.length; k++) if (this.cell[k] === FLAP) queue.push(k);
    const got: number[] = [];
    while (queue.length) {
      const k = queue.pop()!;
      const i = k % NX;
      const j = (k - i) / NX;
      const nb = [i > 0 ? k - 1 : -1, i < NX - 1 ? k + 1 : -1, j > 0 ? k - NX : -1, j < NY - 1 ? k + NX : -1];
      for (const q of nb) {
        if (q < 0 || this.cell[q] !== STUCK || !inside(q)) continue;
        this.cell[q] = FLAP;
        got.push(q);
        queue.push(q);
      }
    }
    this.stuck -= got.length;
    if (!live) return got;
    let a = 0;
    for (const k of got) a += this.glue[k];
    const inst = (a * CELL * CELL) / dt / (Math.max(this.front, 4) * CELL);
    if (got.length && this.jerk * (a / got.length) > YANK) {
      // a yank: it tears before any of this lifts
      for (const k of got) this.cell[k] = STUCK;
      this.stuck += got.length;
      return null;
    }
    this.speed += (inst - this.speed) * (1 - Math.exp(-dt / 0.12));
    const v = this.speed;
    const pGlue = clamp((v - CLEAN) / (RISKY - CLEAN), 0, 1) * 0.5;
    const pFuzz = clamp((v - RISKY) / 120, 0, 1) * 0.5;
    for (const k of got) {
      const m = this.center(k);
      const u = m.x / SW;
      const w = m.y / SH;
      const g = (this.glue[k] - 0.85) * 0.5;
      if (this.n2(u, w) < pFuzz) this.res[k] = FUZZ;
      else if (this.n1(u, w) < pGlue + g * pGlue) this.res[k] = GLUE;
    }
    return got;
  }

  private measureFront() {
    let n = 0;
    this.front_.fill(0);
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        if (this.cell[k] !== STUCK) continue;
        if (this.at(i - 1, j) === FLAP || this.at(i + 1, j) === FLAP || this.at(i, j - 1) === FLAP || this.at(i, j + 1) === FLAP) {
          this.front_[k] = 1;
          n++;
        }
      }
    this.front = n;
    return n;
  }

  private fold(): { d: V; r: number } {
    const dx = this.p.x - this.c.x;
    const dy = this.p.y - this.c.y;
    const r = Math.max(1e-3, Math.hypot(dx, dy));
    return { d: { x: dx / r, y: dy / r }, r };
  }

  // The tip can only go back over the sticker, within ~78 degrees of the way it started.
  private constrain(t: V): V {
    const dx = t.x - this.c.x;
    const dy = t.y - this.c.y;
    const r = Math.hypot(dx, dy);
    if (r < 1e-6) return t;
    const ux = dx / r;
    const uy = dy / r;
    const dot = ux * this.n0.x + uy * this.n0.y;
    const lim = 0.2;
    if (dot >= lim) return t;
    const side = this.n0.x * uy - this.n0.y * ux >= 0 ? 1 : -1;
    const a = Math.acos(lim) * side;
    const bx = this.n0.x * Math.cos(a) - this.n0.y * Math.sin(a);
    const by = this.n0.x * Math.sin(a) + this.n0.y * Math.cos(a);
    const along = Math.max(0, dx * bx + dy * by);
    return { x: this.c.x + bx * along, y: this.c.y + by * along };
  }

  private hitFlap(q: V) {
    if (!this.hasFlap) return false;
    if (Math.hypot(q.x - this.p.x, q.y - this.p.y) < 26) return true;
    const { d, r } = this.fold();
    const s = (q.x - this.c.x) * d.x + (q.y - this.c.y) * d.y - r / 2;
    // beyond the crease you see either a slack bit lying in place or a folded bit, mirrored
    if (s <= 0) return false;
    const m = { x: q.x - 2 * s * d.x, y: q.y - 2 * s * d.y };
    return this.at(Math.floor(q.x / CELL), Math.floor(q.y / CELL)) === FLAP || this.at(Math.floor(m.x / CELL), Math.floor(m.y / CELL)) === FLAP;
  }

  private edgeNear(q: V, within: number) {
    let best = -1;
    let bd = within;
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        if (this.at(i, j) !== STUCK) continue;
        if (this.at(i - 1, j) === STUCK && this.at(i + 1, j) === STUCK && this.at(i, j - 1) === STUCK && this.at(i, j + 1) === STUCK) continue;
        const dd = Math.hypot((i + 0.5) * CELL - q.x, (j + 0.5) * CELL - q.y);
        if (dd < bd) {
          bd = dd;
          best = j * NX + i;
        }
      }
    return best;
  }

  cursorAt(x: number, y: number): "grab" | "default" {
    if (this.state === "done") return "default";
    const q = this.toLocal(x, y);
    if (this.hasFlap) return this.hitFlap(q) ? "grab" : "default";
    return this.edgeNear(q, 12) >= 0 ? "grab" : "default";
  }

  down(x: number, y: number): StickerEvent | null {
    if (this.state === "done") return null;
    const q = this.toLocal(x, y);
    this.ptr = q;
    if (this.hasFlap) {
      if (this.hitFlap(q)) {
        this.state = "held";
        this.started = true;
        this.base = { ...this.p };
        this.grabAt = q;
        return "grab";
      }
      const i = Math.floor(q.x / CELL);
      const j = Math.floor(q.y / CELL);
      return this.at(i, j) === STUCK ? "busy" : null;
    }
    const e = this.edgeNear(q, 12);
    if (e >= 0) {
      this.state = "scratch";
      this.scratchAt = e;
      this.travel = 0;
      this.scratches++;
      return "scratch";
    }
    const i = Math.floor(q.x / CELL);
    const j = Math.floor(q.y / CELL);
    return this.at(i, j) === STUCK ? "middle" : null;
  }

  move(x: number, y: number): StickerEvent | null {
    const q = this.toLocal(x, y);
    const moved = Math.hypot(q.x - this.ptr.x, q.y - this.ptr.y);
    this.ptr = q;
    if (this.state !== "scratch") return null;
    this.travel += moved;
    if (this.travel < 45) return null;
    // a fingernail finally gets under it
    const b = this.center(this.scratchAt);
    let sx = 0;
    let sy = 0;
    for (let k = 0; k < this.cell.length; k++) {
      if (this.cell[k] !== STUCK) continue;
      const m = this.center(k);
      if (Math.hypot(m.x - b.x, m.y - b.y) < 18) {
        sx += m.x - b.x;
        sy += m.y - b.y;
      }
    }
    const n0 = Math.hypot(sx, sy) > 1 ? norm({ x: sx, y: sy }) : norm({ x: SW / 2 - b.x, y: SH / 2 - b.y });
    this.startFlap({ x: b.x - n0.x * 2.5, y: b.y - n0.y * 2.5 }, n0, 14);
    this.state = "held";
    this.base = { ...this.p };
    this.grabAt = q;
    this.started = true;
    this.speed = 0;
    this.stress = 0;
    return "lift";
  }

  up(): StickerEvent | null {
    if (this.state === "held") {
      this.state = "loose";
      return this.peeled < 0.97 ? "release" : null;
    }
    if (this.state === "scratch") this.state = "bare";
    return null;
  }

  private detach(cells: number[]) {
    const { d, r } = this.fold();
    this.flyers.push({ cells, c: { ...this.c }, d, r, t: this.time });
    for (const k of cells) this.cell[k] = GONE;
    this.pieces++;
    this.speed = 0;
    this.jerk = 0;
    this.stress = 0;
  }

  private tear() {
    // a ragged line: some of the front comes along, some of the flap stays behind
    const flap: number[] = [];
    for (let k = 0; k < this.cell.length; k++) if (this.cell[k] === FLAP) flap.push(k);
    this.measureFront();
    for (let k = 0; k < this.cell.length; k++)
      if (this.front_[k] && this.rand() < 0.45) {
        this.cell[k] = FLAP;
        this.stuck--;
        if (this.rand() < 0.5) this.res[k] = FUZZ;
        flap.push(k);
      }
    for (const k of flap) {
      const i = k % NX;
      const j = (k - i) / NX;
      const touches = this.at(i - 1, j) === STUCK || this.at(i + 1, j) === STUCK || this.at(i, j - 1) === STUCK || this.at(i, j + 1) === STUCK;
      if (touches && this.rand() < 0.3) {
        this.cell[k] = STUCK;
        this.res[k] = 0;
        this.stuck++;
      }
    }
    this.detach(flap.filter((k) => this.cell[k] === FLAP));
    this.state = "bare";
  }

  step(dt: number): StickerEvent[] {
    const out: StickerEvent[] = [];
    this.time += dt;
    this.claimed = 0;
    this.flyers = this.flyers.filter((f) => {
      if (this.time - f.t < 0.7) return true;
      this.addScrap(f.cells.length);
      return false;
    });
    if (this.state === "done") return out;
    if (this.state === "held") {
      const target = { x: this.base.x + this.ptr.x - this.grabAt.x, y: this.base.y + this.ptr.y - this.grabAt.y };
      const p = this.constrain(target);
      if (Math.hypot(target.x - p.x, target.y - p.y) > 80) {
        this.state = "loose";
        out.push("slip");
      } else {
        const { d } = this.fold();
        const pull = ((p.x - this.p.x) * d.x + (p.y - this.p.y) * d.y) / dt;
        this.jerk += (pull - this.jerk) * (1 - Math.exp(-dt / 0.05));
        this.p = p;
        const hadGlue = this.glueCells > 0;
        const got = this.claim(p, true, dt);
        if (got === null) {
          this.tear();
          out.push("tear");
        } else {
          this.claimed = got.length;
          const v = this.speed;
          this.stress = v > RISKY ? this.stress + ((v - RISKY) / 60) * 4 * dt : Math.max(0, this.stress - dt * 0.9);
          if (!hadGlue && !this.glued && this.glueCells > 0) {
            this.glued = true;
            out.push("glue");
          }
          if (this.stress >= 1) {
            this.tear();
            out.push("tear");
          }
        }
      }
    } else {
      this.speed *= Math.exp(-dt / 0.1);
      this.jerk = 0;
      this.stress = Math.max(0, this.stress - dt * 0.9);
    }
    if (this.hasFlap) {
      const f = this.measureFront();
      if (f === 0) {
        const flap: number[] = [];
        for (let k = 0; k < this.cell.length; k++) if (this.cell[k] === FLAP) flap.push(k);
        this.detach(flap);
        this.state = "bare";
        if (this.stuck > 0) out.push("free");
      }
    }
    if (this.state === "bare" || this.state === "scratch") {
      if (this.stuck < 10) {
        // crumbs too small to get a nail under: they are part of the book now
        for (let k = 0; k < this.cell.length; k++)
          if (this.cell[k] === STUCK) {
            this.cell[k] = GONE;
            this.res[k] = FUZZ;
          }
        this.stuck = 0;
        this.state = "done";
        out.push("done");
      }
    }
    return out;
  }

  private addScrap(n: number) {
    const s = Math.sqrt(n / this.total);
    const i = this.scraps.length;
    this.scraps.push({
      x: 830 + ((i * 47) % 120) + this.rand() * 18,
      y: 470 + ((i * 31) % 90) + this.rand() * 14,
      a: this.rand() * Math.PI,
      w: 18 + s * 58,
      h: 10 + s * 30,
    });
  }

  /** For the hub thumbnail: a sticker caught mid-peel. */
  pose(tx: number, ty: number) {
    this.p = this.constrain({ x: tx, y: ty });
    this.claim(this.p, false);
    this.measureFront();
    this.state = "loose";
  }

  invalidate() {
    this.tex = null;
  }

  // ---------- drawing ----------

  draw(ctx: CanvasRenderingContext2D) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this.drawTable(ctx);
    this.drawBook(ctx);
    const tex = (this.tex ??= this.makeTexture());

    ctx.save();
    ctx.translate(ORIGIN.x, ORIGIN.y);
    ctx.rotate(ANG);
    this.drawResidue(ctx);
    // stuck paper. Along the crease, cells are cut to the fold line so the edge is straight.
    const flap = this.hasFlap;
    if (tex) {
      ctx.save();
      const keep = (k: number) => this.cell[k] === STUCK && !(flap && this.front_[k]);
      this.cellsPath(ctx, (k) => keep(k) && !this.torn(k));
      // torn edges are ragged, not square
      for (let k = 0; k < this.cell.length; k++) {
        if (!keep(k) || !this.torn(k)) continue;
        const m = this.center(k);
        const h = hash(k);
        const rr = 2.3 + h * 1.1;
        const jx = m.x + (hash(k + 7) - 0.5) * 1.6;
        const jy = m.y + (hash(k + 13) - 0.5) * 1.6;
        ctx.moveTo(jx + rr, jy);
        ctx.arc(jx, jy, rr, 0, Math.PI * 2);
      }
      ctx.clip();
      ctx.drawImage(tex.c, 0, 0, SW, SH);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let k = 0; k < this.cell.length; k++) {
        if (!keep(k) || !this.torn(k) || hash(k + 3) < 0.4) continue;
        const m = this.center(k);
        const a = hash(k + 5) * Math.PI * 2;
        ctx.moveTo(m.x + Math.cos(a) * 2, m.y + Math.sin(a) * 2);
        ctx.lineTo(m.x + Math.cos(a) * 4.6, m.y + Math.sin(a) * 4.6);
      }
      ctx.stroke();
      if (flap) {
        const { d, r } = this.fold();
        ctx.save();
        this.halfPlane(ctx, this.c, d, r, 1);
        ctx.clip();
        this.cellsPath(ctx, (k) => this.front_[k] === 1 || this.cell[k] === FLAP);
        ctx.clip();
        ctx.drawImage(tex.c, 0, 0, SW, SH);
        ctx.restore();
      }
    }
    if (flap) this.drawFlap(ctx, tex);
    for (const f of this.flyers) this.drawFlyer(ctx, tex, f);
    ctx.restore();
  }

  private drawTable(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#F3EFE8");
    g.addColorStop(1, "#ECE7DE");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(120,96,64,0.05)";
    ctx.lineWidth = 1;
    for (let y = 22; y < H; y += 46) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * 0.3, y + 6, W * 0.6, y - 5, W, y + 3);
      ctx.stroke();
    }
    // the bits you already got off
    for (const s of this.scraps) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a);
      ctx.fillStyle = "rgba(28,28,26,0.08)";
      roundRect(ctx, -s.w / 2 + 1.5, -s.h / 2 + 2.5, s.w, s.h, 3);
      ctx.fill();
      ctx.fillStyle = "#EDE9E1";
      ctx.beginPath();
      ctx.moveTo(-s.w / 2, -s.h / 2 + 2);
      ctx.quadraticCurveTo(0, -s.h / 2 - 3, s.w / 2, -s.h / 2 + 1);
      ctx.lineTo(s.w / 2 - 2, s.h / 2);
      ctx.quadraticCurveTo(0, s.h / 2 + 2, -s.w / 2 + 1, s.h / 2 - 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(28,28,26,0.12)";
      ctx.stroke();
      ctx.strokeStyle = "rgba(28,28,26,0.10)";
      ctx.beginPath();
      ctx.moveTo(-s.w * 0.15, -s.h / 2);
      ctx.lineTo(s.w * 0.1, s.h / 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBook(ctx: CanvasRenderingContext2D) {
    const { x0, y0, x1, y1 } = BOOK;
    const w = x1 - x0;
    const h = y1 - y0;
    ctx.fillStyle = "rgba(28,28,26,0.07)";
    roundRect(ctx, x0 + 7, y0 + 10, w, h, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(28,28,26,0.07)";
    roundRect(ctx, x0 + 3, y0 + 4, w, h, 6);
    ctx.fill();
    ctx.fillStyle = "#4A5F78";
    roundRect(ctx, x0, y0, w, h, 6);
    ctx.fill();
    if (!this.weave) {
      const t = makeCanvas(6, 6);
      if (t) {
        t.g.fillStyle = "rgba(255,255,255,0.05)";
        t.g.fillRect(0, 0, 6, 1);
        t.g.fillRect(0, 3, 6, 1);
        t.g.fillStyle = "rgba(0,0,0,0.06)";
        t.g.fillRect(0, 0, 1, 6);
        t.g.fillRect(3, 0, 1, 6);
        this.weave = ctx.createPattern(t.c, "repeat");
      }
    }
    if (this.weave) {
      ctx.fillStyle = this.weave;
      roundRect(ctx, x0, y0, w, h, 6);
      ctx.fill();
    }
    // spine hinge
    ctx.fillStyle = "rgba(10,18,30,0.16)";
    ctx.fillRect(x0, y0, 26, h);
    ctx.strokeStyle = "rgba(10,18,30,0.28)";
    ctx.lineWidth = 2;
    this.line(ctx, x0 + 30, y0 + 2, x0 + 30, y1 - 2);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    this.line(ctx, x0 + 32.5, y0 + 2, x0 + 32.5, y1 - 2);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, x0 + 0.5, y0 + 0.5, w - 1, h - 1, 6);
    ctx.stroke();
    // debossed title
    const mid = (x0 + 30 + x1) / 2;
    ctx.textAlign = "center";
    ctx.font = 'italic 48px "Instrument Serif", Georgia, serif';
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillText("The Practice Room", mid, y0 + 141);
    ctx.fillStyle = "rgba(12,20,32,0.42)";
    ctx.fillText("The Practice Room", mid, y0 + 140);
    ctx.font = '500 12px "Inter Tight", system-ui, sans-serif';
    ctx.fillStyle = "rgba(12,20,32,0.38)";
    ctx.fillText("A   N O V E L   I N   S M A L L   T A S K S", mid, y0 + 176);
    ctx.fillText("M I L D L Y   P R E S S", mid, y1 - 40);
    ctx.textAlign = "start";
  }

  private drawResidue(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(14,22,36,0.30)";
    ctx.beginPath();
    for (let k = 0; k < this.res.length; k++) {
      if (this.res[k] !== GLUE || this.cell[k] === STUCK) continue;
      const m = this.center(k);
      ctx.moveTo(m.x + 3.4, m.y);
      ctx.arc(m.x, m.y, 3.4, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    for (let k = 0; k < this.res.length; k++) {
      if (this.res[k] !== GLUE || this.cell[k] === STUCK || k % 3) continue;
      const m = this.center(k);
      ctx.moveTo(m.x, m.y);
      ctx.arc(m.x - 0.8, m.y - 0.8, 0.9, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = "rgba(246,243,236,0.55)";
    ctx.beginPath();
    for (let k = 0; k < this.res.length; k++) {
      if (this.res[k] !== FUZZ || this.cell[k] === STUCK) continue;
      const m = this.center(k);
      ctx.moveTo(m.x + 2.8, m.y);
      ctx.arc(m.x, m.y, 2.8, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.strokeStyle = "rgba(250,248,242,0.8)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    let f = 0;
    for (let k = 0; k < this.res.length; k++) {
      if (this.cell[k] === 0) continue;
      f += 2;
      if (this.res[k] !== FUZZ || this.cell[k] === STUCK) continue;
      const m = this.center(k);
      for (const a of [this.fibres[f - 2], this.fibres[f - 1]]) {
        ctx.moveTo(m.x - Math.cos(a) * 3, m.y - Math.sin(a) * 3);
        ctx.lineTo(m.x + Math.cos(a) * 3, m.y + Math.sin(a) * 3);
      }
    }
    ctx.stroke();
  }

  private cellsPath(ctx: CanvasRenderingContext2D, keep: (k: number) => boolean) {
    ctx.beginPath();
    for (let j = 0; j < NY; j++) {
      let i = 0;
      while (i < NX) {
        if (!keep(j * NX + i)) {
          i++;
          continue;
        }
        const s = i;
        while (i < NX && keep(j * NX + i)) i++;
        ctx.rect(s * CELL, j * CELL, (i - s) * CELL, CELL);
      }
    }
  }

  private flatShadow(ctx: CanvasRenderingContext2D, keep: (k: number) => boolean, lift: number) {
    for (const [o, a] of [
      [lift, 0.07],
      [lift * 0.45, 0.1],
    ]) {
      ctx.save();
      ctx.translate(o * 0.5, o);
      this.cellsPath(ctx, keep);
      ctx.fillStyle = `rgba(14,22,36,${a})`;
      ctx.fill();
      ctx.restore();
    }
  }

  private reflect(ctx: CanvasRenderingContext2D, c: V, d: V, r: number) {
    const k = c.x * d.x + c.y * d.y + r / 2;
    ctx.transform(1 - 2 * d.x * d.x, -2 * d.x * d.y, -2 * d.x * d.y, 1 - 2 * d.y * d.y, 2 * k * d.x, 2 * k * d.y);
  }

  private drawBack(ctx: CanvasRenderingContext2D, tex: Tex | null, keep: (k: number) => boolean, crease?: { c: V; d: V; r: number }) {
    ctx.save();
    roundRect(ctx, 0, 0, SW, SH, RAD);
    ctx.clip();
    this.cellsPath(ctx, keep);
    ctx.clip();
    ctx.fillStyle = "#EAE6DE";
    ctx.fillRect(0, 0, SW, SH);
    if (tex) {
      // the print shows through, mirrored
      ctx.globalAlpha = 0.07;
      ctx.drawImage(tex.c, 0, 0, SW, SH);
      ctx.globalAlpha = 1;
    }
    if (crease) {
      const { c, d, r } = crease;
      const lx = c.x + d.x * (r / 2);
      const ly = c.y + d.y * (r / 2);
      const g = ctx.createLinearGradient(lx, ly, lx - d.x * 9, ly - d.y * 9);
      g.addColorStop(0, "rgba(255,255,255,0.85)");
      g.addColorStop(0.35, "rgba(255,255,255,0.25)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-SW, -SH, SW * 3, SH * 3);
    }
    ctx.restore();
  }

  private drawFlap(ctx: CanvasRenderingContext2D, tex: Tex | null) {
    const { d, r } = this.fold();
    const half = r / 2;
    const side = (k: number) => {
      const m = this.center(k);
      return (m.x - this.c.x) * d.x + (m.y - this.c.y) * d.y < half;
    };
    const slack = (k: number) => this.cell[k] === FLAP && !side(k);
    const folded = (k: number) => this.cell[k] === FLAP && side(k);
    // slack bits lie back down, loosely
    this.flatShadow(ctx, slack, 2.5);
    if (tex) {
      ctx.save();
      roundRect(ctx, 0, 0, SW, SH, RAD);
      ctx.clip();
      this.cellsPath(ctx, slack);
      ctx.clip();
      ctx.drawImage(tex.c, 0, 0, SW, SH);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(0, 0, SW, SH);
      ctx.restore();
    }
    // the folded-back part, adhesive side up
    const crease = (k: number) => (this.cell[k] === FLAP && side(k)) || this.front_[k] === 1;
    for (const [ox, oy] of [
      [2, 4],
      [0.8, 1.6],
    ]) {
      ctx.save();
      ctx.translate(ox, oy);
      this.reflect(ctx, this.c, d, r);
      this.halfPlane(ctx, this.c, d, r, -1);
      ctx.clip();
      this.cellsPath(ctx, crease);
      ctx.fillStyle = "rgba(14,22,36,0.10)";
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    this.reflect(ctx, this.c, d, r);
    this.halfPlane(ctx, this.c, d, r, -1);
    ctx.clip();
    this.drawBack(ctx, tex, crease, { c: this.c, d, r });
    ctx.restore();
  }

  // The side of the fold line towards P (1) or towards C (-1), as a clip path.
  private halfPlane(ctx: CanvasRenderingContext2D, c: V, d: V, r: number, side: 1 | -1) {
    const lx = c.x + d.x * (r / 2);
    const ly = c.y + d.y * (r / 2);
    const tx = -d.y * 2000;
    const ty = d.x * 2000;
    const fx = d.x * 2000 * side;
    const fy = d.y * 2000 * side;
    ctx.beginPath();
    ctx.moveTo(lx + tx, ly + ty);
    ctx.lineTo(lx - tx, ly - ty);
    ctx.lineTo(lx - tx + fx, ly - ty + fy);
    ctx.lineTo(lx + tx + fx, ly + ty + fy);
    ctx.closePath();
  }

  private drawFlyer(ctx: CanvasRenderingContext2D, tex: Tex | null, f: Flyer) {
    const t = clamp((this.time - f.t) / 0.7, 0, 1);
    const set = new Set(f.cells);
    const keep = (k: number) => set.has(k);
    ctx.save();
    ctx.globalAlpha = 1 - t * t;
    ctx.translate(f.d.x * 60 * t, f.d.y * 60 * t - 30 * t);
    this.reflect(ctx, f.c, f.d, f.r);
    ctx.save();
    ctx.translate(3, 5);
    this.cellsPath(ctx, keep);
    ctx.fillStyle = "rgba(14,22,36,0.10)";
    ctx.fill();
    ctx.restore();
    this.drawBack(ctx, tex, keep);
    ctx.restore();
  }

  private makeTexture(): Tex | null {
    const t = makeCanvas(SW * TS, SH * TS);
    if (!t) return null;
    const g = t.g;
    g.scale(TS, TS);
    roundRect(g, 0.5, 0.5, SW - 1, SH - 1, RAD);
    g.fillStyle = "#FFFFFF";
    g.fill();
    g.strokeStyle = "rgba(28,28,26,0.14)";
    g.lineWidth = 0.6;
    g.stroke();
    // tamper cuts along the border
    g.strokeStyle = "rgba(28,28,26,0.10)";
    g.lineWidth = 0.5;
    g.setLineDash([3, 3]);
    roundRect(g, 4.5, 4.5, SW - 9, SH - 9, RAD - 3);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#6B6A65";
    g.font = '600 8px "Inter Tight", system-ui, sans-serif';
    g.fillText("HOUSE & HOME · BOOKS", 13, 21);
    g.font = '500 10px "Inter Tight", system-ui, sans-serif';
    g.fillText("was 18.00", 13, 38);
    g.strokeStyle = "#6B6A65";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(12, 34.5);
    g.lineTo(60, 34.5);
    g.stroke();
    g.fillStyle = "#1C1C1A";
    g.font = '600 44px "Inter Tight", system-ui, sans-serif';
    g.fillText("12.99", 10, 82);
    // barcode
    g.fillStyle = "#1C1C1A";
    for (let i = 0; i < this.bars.length; i += 2) g.fillRect(124 + this.bars[i], 14, this.bars[i + 1], 44);
    g.font = '500 6.5px "Inter Tight", system-ui, sans-serif';
    g.fillText("5 012345 678900", 128, 66);
    g.fillStyle = "#6B6A65";
    g.font = '500 6.5px "Inter Tight", system-ui, sans-serif';
    g.fillText("SKU 40417-2 · PLEASE KEEP RECEIPT", 13, 108);
    // the second sticker, stuck on top
    g.fillStyle = "rgba(28,28,26,0.12)";
    g.beginPath();
    g.arc(DOT.x + 0.6, DOT.y + 1, DOT.r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#C4553A";
    g.beginPath();
    g.arc(DOT.x, DOT.y, DOT.r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#FFFFFF";
    g.textAlign = "center";
    g.font = '600 12px "Inter Tight", system-ui, sans-serif';
    g.fillText("−30%", DOT.x, DOT.y + 2);
    g.font = '500 5.5px "Inter Tight", system-ui, sans-serif';
    g.fillText("TODAY ONLY", DOT.x, DOT.y + 10);
    return t;
  }

  private line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

function hash(k: number) {
  let h = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function norm(v: V): V {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

export type StickerResult = { clean: number; pieces: number; glue: number; scratches: number; time: number };

export function stickerTier(r: StickerResult) {
  const pct = r.clean;
  if (pct < 0.6) return { tier: "Tacky", line: "The book is now permanently, slightly sticky." };
  if (r.pieces >= 4) return { tier: "Confetti", line: "You did not peel it so much as take it apart." };
  if (r.pieces >= 2) return { tier: "In instalments", line: `It came off in ${r.pieces} pieces. The price is still legible.` };
  if (pct >= 0.99) return { tier: "Factory fresh", line: "One piece, no glue. Nobody will ever know what it cost." };
  if (pct >= 0.9) return { tier: "In one go", line: "A faint sticky ghost remains. It will collect lint for years." };
  return { tier: "One piece, some glue", line: "The sticker left. Its glue decided to stay." };
}
