// "Peel the Price Sticker": top-down view of a new hardcover with a price sticker on it.
// The sticker is a grid of small cells. Peeling is a paper fold: the corner you hold (C) is folded
// over to the pointer (P), and every cell on C's side of the perpendicular bisector lifts off.
// Peel too fast and it tears or leaves glue. The wider the strip coming up at once, the slower you have
// to go, so working in from several edges beats one big pull. A thin film of the strongest glue always
// stays behind, and rubbing it with a thumb only goes so far. Every round rolls a different sticker: kind, size,
// angle, position, which corner is lifted (if any), extra stickers on top, hidden glue, and
// sometimes an older sticker underneath. Pure module, SSR safe (no globals at top level).
export const W = 1000;
export const H = 640;
export const SPEED_MAX = 320;

const CELL = 4;
const RAD = 8;
const BOOK = { x0: 262, y0: 34, x1: 738, y1: 606 };
const TS = 3; // texture resolution per local unit

const STUCK = 1;
const FLAP = 2;
const GONE = 3;
const PARKED = 4; // part of a flap you let go of: it stays folded back where you left it
const GLUE = 1;
const FUZZ = 2;
const LINT = 3; // glue rubbed into little grey balls
const WIDE = 16; // a peel front up to this many cells long is fine; past it, it gets touchy

export type Kind = "paper" | "vinyl" | "security" | "round" | "aged";
type Props = { name: string; intro: string; glueAt: number; tearAt: number; tearMul: number; yank: number; residue: number; fuzz: boolean };

// glueAt: peel speed where glue starts staying behind. tearAt: where it starts to tear.
// Speeds are in local units per second of front advance, weighted by glue strength.
export const KINDS: Record<Kind, Props> = {
  paper: { name: "Paper label", intro: "A paper label. The usual kind.", glueAt: 150, tearAt: 215, tearMul: 1, yank: 1000, residue: 1, fuzz: true },
  vinyl: { name: "Vinyl label", intro: "Vinyl. It won't tear. It will leave glue.", glueAt: 128, tearAt: 290, tearMul: 0.5, yank: 1500, residue: 1.25, fuzz: false },
  security: { name: "Security label", intro: "The kind with little cuts in it. So that it tears.", glueAt: 150, tearAt: 200, tearMul: 1.15, yank: 850, residue: 1, fuzz: true },
  round: { name: "Round label", intro: "A round one. No corners, only opinions.", glueAt: 150, tearAt: 215, tearMul: 1, yank: 1000, residue: 1, fuzz: true },
  aged: { name: "Old label", intro: "", glueAt: 130, tearAt: 195, tearMul: 1.3, yank: 850, residue: 1.25, fuzz: true },
};

const SHOPS = ["HOUSE & HOME · BOOKS", "PAGE & PARCEL", "THE BOOK BARN", "CORNER BOOKS", "NOVEL IDEAS"];
const PRICES = [4.99, 7.5, 9.95, 12.99, 14.0, 18.99, 24.0, 32.5];
const BADGES: [string, string, string][] = [
  ["−30%", "TODAY ONLY", "#C4553A"],
  ["SALE", "", "#C4553A"],
  ["2 FOR 1", "SELECTED", "#C9922E"],
  ["NEW", "", "#4A5F78"],
  ["−50%", "CLEARANCE", "#C4553A"],
  ["SIGNED", "COPY", "#1C1C1A"],
];

export type StickerState = "loose" | "held" | "bare" | "scratch" | "rub" | "rubbing" | "done";
export type StickerEvent =
  | "grab"
  | "release"
  | "slip"
  | "tear"
  | "free"
  | "glue"
  | "stubborn"
  | "middle"
  | "scratch"
  | "lift"
  | "under"
  | "wide"
  | "strain"
  | "rub"
  | "pill"
  | "done";
type V = { x: number; y: number };
type Shape = { round: boolean; x: number; y: number; w: number; h: number };
type Badge = { x: number; y: number; r: number; text: string; sub: string; color: string };
type Blob = { x: number; y: number; r: number; s: number };
type Tex = { c: CanvasImageSource; g: CanvasRenderingContext2D };
type Fold = { c: V; p: V; n0: V };
type Glyph = { ch: string; x0: number; x1: number; y0: number; y1: number };
type Layer = {
  kind: Kind;
  shape: Shape;
  price: string;
  was: string | null;
  shop: string;
  badges: Badge[];
  blobs: Blob[];
  cuts: number[][];
  lift: { c: V; n0: V } | null;
  bars: number[];
  tex: Tex | null;
  glyphs: Glyph[]; // where each character of the price is printed, filled in with the texture
};
type Flyer = { cells: number[]; c: V; d: V; r: number; t: number; tex: Tex | null; shape: Shape; vinyl: boolean };
type Scrap = { x: number; y: number; a: number; w: number; h: number };

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

// Smooth value noise on a coarse grid, sampled in [0,1]².
function noiseField(rand: () => number, gx: number, gy: number) {
  const g = Array.from({ length: (gx + 1) * (gy + 1) }, rand);
  return (u: number, v: number) => {
    const x = clamp(u, 0, 1) * gx;
    const y = clamp(v, 0, 1) * gy;
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

function inShape(s: Shape, x: number, y: number) {
  if (s.round) {
    const r = s.w / 2;
    return (x - s.x - r) ** 2 + (y - s.y - r) ** 2 <= r * r;
  }
  const cx = clamp(x, s.x + RAD, s.x + s.w - RAD);
  const cy = clamp(y, s.y + RAD, s.y + s.h - RAD);
  return (x - cx) ** 2 + (y - cy) ** 2 <= RAD * RAD;
}

function shapePath(ctx: CanvasRenderingContext2D, s: Shape, inset = 0) {
  if (s.round) {
    ctx.beginPath();
    ctx.arc(s.x + s.w / 2, s.y + s.h / 2, s.w / 2 - inset, 0, Math.PI * 2);
  } else roundRect(ctx, s.x + inset, s.y + inset, s.w - inset * 2, s.h - inset * 2, Math.max(1, RAD - inset * 0.6));
}

function segDist(px: number, py: number, s: number[]) {
  const [x0, y0, x1, y1] = s;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = clamp(((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - x0 - dx * t, py - y0 - dy * t);
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

const money = (v: number) => v.toFixed(2);
const snap = (v: number) => Math.round(v / CELL) * CELL;

export class Sticker {
  state: StickerState = "bare";
  // grid, in sticker-local units (CELL each); covers every layer
  nx: number;
  ny: number;
  gw: number;
  gh: number;
  origin: V = { x: 0, y: 0 };
  ang = 0;
  /** Where the action happens, in world units: the camera centres here on small screens. */
  view: V = { x: W / 2, y: H / 2 };
  layers: Layer[] = [];
  li = 0;
  cell: Uint8Array;
  res: Uint8Array;
  glue: Float32Array;
  weak: Uint8Array;
  film: Uint8Array; // the strongest glue: it always stays on the book
  fuzzOf: Uint8Array; // which layer a bit of paper fuzz came from (its print shows through)
  own: Uint8Array; // for parked cells: which parked flap (1-based)
  parked: (Fold | null)[] = [];
  total = 0;
  layerTotal = 0;
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
  edges = 0; // edges a flap was lifted from
  rubbed = 0;
  started = false;
  glued = false;
  claimed = 0; // cells lifted in the last step (for sound)
  scratchAt = -1;
  travel = 0;
  flyers: Flyer[] = [];
  scraps: Scrap[] = [];
  private n1: (u: number, v: number) => number;
  private n2: (u: number, v: number) => number;
  private strength: (u: number, v: number) => number;
  private rand: () => number;
  private time = 0;
  private front_: Uint8Array;
  private fibres: Float32Array;
  private weave: CanvasPattern | null = null;
  private stubborn = 0; // 0 not yet, 1 just hit, 2 said
  private stubbornHit = false;
  private wideSaid = false;
  private strainSaid = false;
  private pillSaid = false;

  constructor(seed: number, opts: { thumb?: boolean } = {}) {
    const rand = (this.rand = rng(seed));
    rand();
    this.strength = noiseField(rand, 6, 4);
    this.n1 = noiseField(rand, 9, 6);
    this.n2 = noiseField(rand, 14, 9);

    // --- roll the sticker ---
    const thumb = !!opts.thumb;
    const roll = rand();
    const kind: Kind = thumb ? "paper" : roll < 0.35 ? "paper" : roll < 0.6 ? "vinyl" : roll < 0.8 ? "security" : "round";
    const round = kind === "round";
    const w = round ? snap(116 + rand() * 30) : snap(168 + rand() * 52);
    const h = round ? w : snap(104 + rand() * 32);
    const top: Shape = { round, x: 0, y: 0, w, h };
    let under: Shape | null = null;
    if (!thumb && rand() < 0.24) {
      const dw = round ? 0 : snap((rand() - 0.5) * 16);
      const dh = round ? 0 : snap((rand() - 0.5) * 12);
      const ox = (rand() < 0.5 ? -1 : 1) * (5 + rand() * 7);
      const oy = (rand() < 0.5 ? -1 : 1) * (3 + rand() * 6);
      under = { round, x: ox - dw / 2, y: oy - dh / 2, w: w + dw, h: h + dh };
    }
    // grid covers both, one cell of margin
    const x0 = Math.min(0, under ? under.x : 0) - CELL;
    const y0 = Math.min(0, under ? under.y : 0) - CELL;
    const x1 = Math.max(w, under ? under.x + under.w : 0) + CELL;
    const y1 = Math.max(h, under ? under.y + under.h : 0) + CELL;
    for (const s of [top, under]) {
      if (!s) continue;
      s.x -= x0;
      s.y -= y0;
    }
    this.nx = Math.ceil((x1 - x0) / CELL);
    this.ny = Math.ceil((y1 - y0) / CELL);
    this.gw = this.nx * CELL;
    this.gh = this.ny * CELL;
    const n = this.nx * this.ny;
    this.cell = new Uint8Array(n);
    this.res = new Uint8Array(n);
    this.glue = new Float32Array(n);
    this.weak = new Uint8Array(n);
    this.film = new Uint8Array(n);
    this.fuzzOf = new Uint8Array(n);
    this.own = new Uint8Array(n);
    this.front_ = new Uint8Array(n);
    this.fibres = new Float32Array(n * 2).map(() => rand() * Math.PI);

    const topPrice = PRICES[Math.floor(rand() * PRICES.length)];
    this.layers.push(this.makeLayer(kind, top, topPrice, thumb || rand() < 0.8, thumb ? 1 : rand() < 0.3 ? 0 : rand() < 0.7 ? 1 : 2, true));
    if (under) this.layers.push(this.makeLayer("aged", under, Math.max(2.99, topPrice - 2 - Math.floor(rand() * 4)), rand() < 0.4, 0, false));
    for (let k = 0; k < n; k++) {
      const m = this.center(k);
      if (this.layers.some((l) => inShape(l.shape, m.x, m.y))) this.total++;
    }

    // --- place it on the book, so the pull has room in front of it ---
    this.ang = thumb ? -0.05 : (rand() - 0.5) * 0.5;
    const L = this.layers[0];
    const sc = { x: L.shape.x + L.shape.w / 2, y: L.shape.y + L.shape.h / 2 };
    const reach = Math.hypot(L.shape.w, L.shape.h) * (round ? 0.72 : 1);
    const nw = L.lift ? this.rot(L.lift.n0) : { x: 0, y: 0 };
    const target = { x: 520 + (rand() - 0.5) * 70, y: 330 + (rand() - 0.5) * 50 };
    const half = Math.max(w, h) / 2 + 10;
    const wc = {
      x: clamp(target.x - nw.x * reach * 0.5, BOOK.x0 + 34 + half, BOOK.x1 - half),
      y: clamp(target.y - nw.y * reach * 0.5, BOOK.y0 + half, BOOK.y1 - half),
    };
    if (thumb) {
      // the hub card always shows the top-left corner coming up
      wc.x = 452;
      wc.y = 354;
      L.lift = { c: { x: L.shape.x + 2.5, y: L.shape.y + 2.5 }, n0: norm({ x: L.shape.w, y: L.shape.h }) };
    }
    const r = this.rot(sc);
    this.origin = { x: wc.x - r.x, y: wc.y - r.y };
    // any edge can be peeled, so small screens centre on the sticker itself
    this.view = { x: clamp(wc.x, 330, 670), y: clamp(wc.y, 215, 425) };
    this.activate(0);
  }

  private makeLayer(kind: Kind, shape: Shape, price: number, lifted: boolean, nBadges: number, fresh: boolean): Layer {
    const rand = this.rand;
    const inside = (x: number, y: number, m: number) =>
      shape.round
        ? Math.hypot(x - shape.x - shape.w / 2, y - shape.y - shape.h / 2) < shape.w / 2 - m
        : x > shape.x + m && x < shape.x + shape.w - m && y > shape.y + m && y < shape.y + shape.h - m;
    const pick = (m: number) => {
      for (let t = 0; t < 40; t++) {
        const x = shape.x + rand() * shape.w;
        const y = shape.y + rand() * shape.h;
        if (inside(x, y, m)) return { x, y };
      }
      return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
    };
    const badges: Badge[] = [];
    const used = new Set<number>();
    for (let b = 0; b < nBadges; b++) {
      const r = 15 + rand() * 6;
      let at = pick(r + 4);
      for (let t = 0; t < 20 && badges.some((o) => Math.hypot(o.x - at.x, o.y - at.y) < o.r + r + 4); t++) at = pick(r + 4);
      let i = Math.floor(rand() * BADGES.length);
      while (used.has(i)) i = (i + 1) % BADGES.length;
      used.add(i);
      badges.push({ ...at, r, text: BADGES[i][0], sub: BADGES[i][1], color: BADGES[i][2] });
    }
    const blobs: Blob[] = [];
    const nb = 1 + (rand() < 0.5 ? 1 : 0);
    for (let b = 0; b < nb; b++) blobs.push({ ...pick(10), r: 12 + rand() * 10, s: 0.4 + rand() * 0.3 });
    const cuts: number[][] = [];
    if (kind === "security") {
      // short cuts in from the edges and a few in the middle, so it breaks into pieces
      const { x, y, w, h } = shape;
      for (let u = x + 14 + rand() * 8; u < x + w - 12; u += 18 + rand() * 10) {
        cuts.push([u, y + 1, u + (rand() - 0.5) * 4, y + 8 + rand() * 4]);
        cuts.push([u + 6, y + h - 1, u + 6 + (rand() - 0.5) * 4, y + h - 8 - rand() * 4]);
      }
      for (let v = y + 16 + rand() * 6; v < y + h - 12; v += 20 + rand() * 10) {
        cuts.push([x + 1, v, x + 8 + rand() * 4, v + (rand() - 0.5) * 4]);
        cuts.push([x + w - 1, v + 6, x + w - 8 - rand() * 4, v + 6 + (rand() - 0.5) * 4]);
      }
      for (let i = 0; i < 3; i++) {
        const a = pick(16);
        const t = rand() * Math.PI;
        cuts.push([a.x - Math.cos(t) * 6, a.y - Math.sin(t) * 6, a.x + Math.cos(t) * 6, a.y + Math.sin(t) * 6]);
      }
    }
    let lift: Layer["lift"] = null;
    if (lifted) {
      if (shape.round) {
        const a = rand() * Math.PI * 2;
        const r = shape.w / 2;
        const cx = shape.x + r;
        const cy = shape.y + r;
        lift = { c: { x: cx + Math.cos(a) * (r - 1.5), y: cy + Math.sin(a) * (r - 1.5) }, n0: { x: -Math.cos(a), y: -Math.sin(a) } };
      } else {
        const i = Math.floor(rand() * 4);
        const sx = i % 2 ? -1 : 1;
        const sy = i < 2 ? 1 : -1;
        const c = { x: sx > 0 ? shape.x + 2.5 : shape.x + shape.w - 2.5, y: sy > 0 ? shape.y + 2.5 : shape.y + shape.h - 2.5 };
        lift = { c, n0: norm({ x: sx * shape.w, y: sy * shape.h }) };
      }
    }
    const bars: number[] = [];
    for (let x = 0; x < 62; ) {
      const bw = rand() < 0.35 ? 2.2 : rand() < 0.5 ? 1.4 : 0.8;
      bars.push(x, bw);
      x += bw + 0.8 + rand() * 1.4;
    }
    const pct = badges.find((b) => b.text.startsWith("−"));
    const full = price * (pct ? 1 / (1 - parseInt(pct.text.slice(1)) / 100) : 1.3 + rand() * 0.4);
    const was = fresh && (pct || rand() < 0.4) ? money(Math.ceil(full) - (rand() < 0.6 ? 0.01 : 0)) : null;
    return { kind, shape, price: money(price), was, shop: SHOPS[Math.floor(rand() * SHOPS.length)], badges, blobs, cuts, lift, bars, tex: null, glyphs: [] };
  }

  /** Sticker kind of the layer in play. */
  get L() {
    return this.layers[this.li];
  }
  get props() {
    return KINDS[this.L.kind];
  }
  get lifted() {
    return this.L.lift !== null;
  }
  get peeled() {
    return this.layerTotal ? 1 - this.stuck / this.layerTotal : 1;
  }
  get glueCells() {
    let n = 0;
    for (let k = 0; k < this.res.length; k++) if (this.res[k] && this.cell[k] !== STUCK) n++;
    return n;
  }
  get clean() {
    return 1 - this.glueCells / this.total;
  }
  get hasFlap() {
    return this.state === "loose" || this.state === "held";
  }
  get rubbing() {
    return this.state === "rub" || this.state === "rubbing";
  }
  /** How much longer the peel front is than a comfortable corner. */
  get wide() {
    return clamp(this.front / WIDE, 1, 4);
  }
  /** Peel speeds where glue starts staying behind and where it tears, for the strip coming up right now. */
  get glueAt() {
    return this.props.glueAt / this.wide ** 0.4;
  }
  get tearAt() {
    return this.props.tearAt / this.wide ** 0.7;
  }
  get lint() {
    let n = 0;
    for (let k = 0; k < this.res.length; k++) if (this.res[k] === LINT) n++;
    return n;
  }
  /** The part of a price that can still be read through what's left on the cover, e.g. ".99". */
  get readable() {
    let best = "";
    this.layers.forEach((L, li) => {
      const s = L.glyphs
        .map((g) => {
          let tot = 0;
          let fz = 0;
          for (let j = Math.floor(g.y0 / CELL); j <= Math.floor(g.y1 / CELL); j++)
            for (let i = Math.floor(g.x0 / CELL); i <= Math.floor(g.x1 / CELL); i++) {
              if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) continue;
              const k = j * this.nx + i;
              tot++;
              if (this.cell[k] === STUCK || (this.res[k] === FUZZ && this.fuzzOf[k] === li)) fz++;
            }
          return tot && fz / tot > 0.45 ? g.ch : "·";
        })
        .join("")
        .replace(/^·+|·+$/g, "");
      if (s.replace(/·/g, "").length > best.replace(/·/g, "").length) best = s;
    });
    return best;
  }
  /** World position of the sticker's middle (for the hub thumbnail camera). */
  get middle(): V {
    const s = this.layers[0].shape;
    const r = this.rot({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
    return { x: this.origin.x + r.x, y: this.origin.y + r.y };
  }

  private rot(v: V): V {
    const c = Math.cos(this.ang);
    const s = Math.sin(this.ang);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  }

  // world -> sticker-local
  toLocal(x: number, y: number): V {
    const dx = x - this.origin.x;
    const dy = y - this.origin.y;
    const c = Math.cos(-this.ang);
    const s = Math.sin(-this.ang);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }

  private at(i: number, j: number) {
    return i < 0 || j < 0 || i >= this.nx || j >= this.ny ? 0 : this.cell[j * this.nx + i];
  }
  // a stuck cell next to a spot where paper was torn or lifted away
  private torn(k: number) {
    const i = k % this.nx;
    const j = (k - i) / this.nx;
    return this.at(i - 1, j) === GONE || this.at(i + 1, j) === GONE || this.at(i, j - 1) === GONE || this.at(i, j + 1) === GONE;
  }
  private center(k: number): V {
    return { x: ((k % this.nx) + 0.5) * CELL, y: (Math.floor(k / this.nx) + 0.5) * CELL };
  }

  // Put a layer in play: its cells become stuck paper.
  private activate(li: number) {
    this.li = li;
    const L = this.L;
    const aged = L.kind === "aged" ? 1.15 : 1;
    const s = L.shape;
    // the barcode is where the glue is strongest, on a round one the middle
    const bar = s.round ? null : { x0: s.x + s.w - 78, x1: s.x + s.w - 10, y0: s.y + 10, y1: s.y + 20 + Math.min(44, s.h - 70) };
    const mid = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
    this.stuck = 0;
    for (let k = 0; k < this.cell.length; k++) {
      const m = this.center(k);
      this.weak[k] = 0;
      if (!inShape(L.shape, m.x, m.y)) {
        this.cell[k] = 0;
        continue;
      }
      this.cell[k] = STUCK;
      this.stuck++;
      let g = 0.85 + this.strength(m.x / this.gw, m.y / this.gh) * 0.3;
      for (const b of L.badges) g += 0.65 * Math.exp(-((Math.hypot(m.x - b.x, m.y - b.y) / (b.r + 2)) ** 4));
      for (const b of L.blobs) g += b.s * Math.exp(-((Math.hypot(m.x - b.x, m.y - b.y) / b.r) ** 2));
      if (bar && m.x > bar.x0 && m.x < bar.x1 && m.y > bar.y0 && m.y < bar.y1) g += 0.35;
      if (s.round) g += 0.3 * Math.exp(-((Math.hypot(m.x - mid.x, m.y - mid.y) / (s.w * 0.18)) ** 2));
      this.glue[k] = g * aged;
      if (L.cuts.some((s) => segDist(m.x, m.y, s) < 2.3)) this.weak[k] = 1;
    }
    this.layerTotal = this.stuck;
    this.pieces++;
    this.parked = [];
    // the top few percent of glue never lets go of the cover
    const gs: number[] = [];
    for (let k = 0; k < this.cell.length; k++) if (this.cell[k] === STUCK) gs.push(this.glue[k]);
    gs.sort((a, b) => a - b);
    const q = gs[Math.floor(gs.length * 0.97)] ?? Infinity;
    for (let k = 0; k < this.cell.length; k++) if (this.cell[k] === STUCK) this.film[k] = this.glue[k] >= q ? 1 : 0;
    this.speed = 0;
    this.jerk = 0;
    this.stress = 0;
    this.stubborn = 0;
    this.front_.fill(0);
    if (L.lift) {
      this.startFlap(L.lift.c, L.lift.n0, 26);
      this.edges++;
    } else this.state = "bare";
  }

  private startFlap(c: V, n0: V, reach: number) {
    this.c = c;
    this.n0 = n0;
    this.p = { x: c.x + n0.x * reach, y: c.y + n0.y * reach };
    for (let k = 0; k < this.cell.length; k++) {
      if (this.cell[k] !== STUCK) continue;
      const m = this.center(k);
      if ((m.x - c.x) * n0.x + (m.y - c.y) * n0.y < reach / 2 && Math.hypot(m.x - c.x, m.y - c.y) < reach) {
        this.cell[k] = FLAP;
        this.res[k] = 0;
        this.stuck--;
      }
    }
    this.wideSaid = false;
    this.strainSaid = false;
    this.claim(this.p, false);
    this.measureFront();
    this.state = "loose";
  }

  // Fold C onto P: lift every stuck cell on C's side of the bisector that touches the flap.
  private claim(p: V, live: boolean, dt = 1): number[] | null {
    const dx = p.x - this.c.x;
    const dy = p.y - this.c.y;
    const r = Math.hypot(dx, dy);
    if (r < 1) return [];
    const d = { x: dx / r, y: dy / r };
    const half = r / 2;
    const inside = (k: number) => {
      const m = this.center(k);
      return (m.x - this.c.x) * d.x + (m.y - this.c.y) * d.y < half;
    };
    const nx = this.nx;
    const queue: number[] = [];
    for (let k = 0; k < this.cell.length; k++) if (this.cell[k] === FLAP) queue.push(k);
    const got: number[] = [];
    while (queue.length) {
      const k = queue.pop()!;
      const i = k % nx;
      const j = (k - i) / nx;
      const nb = [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, j > 0 ? k - nx : -1, j < this.ny - 1 ? k + nx : -1];
      for (const q of nb) {
        if (q < 0 || this.cell[q] !== STUCK || !inside(q)) continue;
        this.cell[q] = FLAP;
        got.push(q);
        queue.push(q);
      }
    }
    this.stuck -= got.length;
    // whatever glue was on this paper (from a sticker above) goes with it
    for (const k of got) this.res[k] = 0;
    if (!live) return got;
    const P = this.props;
    let a = 0;
    for (const k of got) a += this.glue[k];
    if (got.length && this.jerk * (a / got.length) > P.yank) {
      // a yank: it tears before any of this lifts
      for (const k of got) this.cell[k] = STUCK;
      this.stuck += got.length;
      return null;
    }
    const inst = (a * CELL * CELL) / dt / (Math.max(this.front, 4) * CELL);
    this.speed += (inst - this.speed) * (1 - Math.exp(-dt / 0.12));
    const v = this.speed;
    const pGlue = clamp((v - this.glueAt) / 65, 0, 1) * 0.5 * P.residue;
    const pFuzz = P.fuzz ? clamp((v - this.tearAt) / 120, 0, 1) * 0.5 : 0;
    let weak = 0;
    for (const k of got) {
      const m = this.center(k);
      const u = m.x / this.gw;
      const w = m.y / this.gh;
      const g = (this.glue[k] - 0.85) * 0.5;
      if (this.n2(u, w) < pFuzz) {
        this.res[k] = FUZZ;
        this.fuzzOf[k] = this.li;
      } else if (this.film[k] || this.n1(u, w) < pGlue + g * pGlue) this.res[k] = GLUE;
      if (this.weak[k]) weak++;
      if (this.glue[k] > 1.38 && !this.stubborn) this.stubbornHit = true;
    }
    // the cuts give way under any hurry
    this.stress += weak * 0.024 * clamp(v / this.glueAt, 0.3, 2.2);
    return got;
  }

  private measureFront() {
    let n = 0;
    this.front_.fill(0);
    for (let j = 0; j < this.ny; j++)
      for (let i = 0; i < this.nx; i++) {
        const k = j * this.nx + i;
        if (this.cell[k] !== STUCK) continue;
        if (this.at(i - 1, j) === FLAP || this.at(i + 1, j) === FLAP || this.at(i, j - 1) === FLAP || this.at(i, j + 1) === FLAP) {
          this.front_[k] = 1;
          n++;
        }
      }
    this.front = n;
    return n;
  }

  private fold(f: { c: V; p: V } = this): { d: V; r: number } {
    const dx = f.p.x - f.c.x;
    const dy = f.p.y - f.c.y;
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
    const lim = 0.2;
    if (ux * this.n0.x + uy * this.n0.y >= lim) return t;
    const side = this.n0.x * uy - this.n0.y * ux >= 0 ? 1 : -1;
    const a = Math.acos(lim) * side;
    const bx = this.n0.x * Math.cos(a) - this.n0.y * Math.sin(a);
    const by = this.n0.x * Math.sin(a) + this.n0.y * Math.cos(a);
    const along = Math.max(0, dx * bx + dy * by);
    return { x: this.c.x + bx * along, y: this.c.y + by * along };
  }

  private hitFlap(q: V) {
    return this.hasFlap && this.hitFold(q, this, (k) => this.cell[k] === FLAP);
  }

  private hitFold(q: V, f: Fold, mine: (k: number) => boolean) {
    if (Math.hypot(q.x - f.p.x, q.y - f.p.y) < 26) return true;
    const { d, r } = this.fold(f);
    const s = (q.x - f.c.x) * d.x + (q.y - f.c.y) * d.y - r / 2;
    // beyond the crease you see either a slack bit lying in place or a folded bit, mirrored
    if (s <= 0) return false;
    const m = { x: q.x - 2 * s * d.x, y: q.y - 2 * s * d.y };
    const cellAt = (v: V) => {
      const i = Math.floor(v.x / CELL);
      const j = Math.floor(v.y / CELL);
      return i >= 0 && j >= 0 && i < this.nx && j < this.ny && mine(j * this.nx + i);
    };
    return cellAt(q) || cellAt(m);
  }

  /** The parked flap under the pointer (1-based id), or 0. */
  private parkedAt(q: V) {
    for (let i = this.parked.length - 1; i >= 0; i--) {
      const f = this.parked[i];
      if (f && this.hitFold(q, f, (k) => this.cell[k] === PARKED && this.own[k] === i + 1)) return i + 1;
    }
    return 0;
  }

  /** Let go of the flap you had: it stays folded back as it is. */
  private park() {
    if (!this.hasFlap) return;
    let id = this.parked.indexOf(null) + 1;
    if (!id) id = this.parked.push(null);
    this.parked[id - 1] = { c: { ...this.c }, p: { ...this.p }, n0: { ...this.n0 } };
    for (let k = 0; k < this.cell.length; k++)
      if (this.cell[k] === FLAP) {
        this.cell[k] = PARKED;
        this.own[k] = id;
      }
    this.front_.fill(0);
    this.front = 0;
    this.state = "bare";
  }

  /** Pick a parked flap back up, exactly as it was left. */
  private unpark(id: number) {
    const f = this.parked[id - 1];
    if (!f) return;
    for (let k = 0; k < this.cell.length; k++) if (this.cell[k] === PARKED && this.own[k] === id) this.cell[k] = FLAP;
    this.parked[id - 1] = null;
    this.c = f.c;
    this.p = f.p;
    this.n0 = f.n0;
    this.state = "loose";
    this.measureFront();
    this.wideSaid = false;
    this.strainSaid = false;
  }

  // Stuck cells right next to a set of lifted cells: the peel line.
  private frontOf(mine: (k: number) => boolean) {
    const out = new Uint8Array(this.cell.length);
    for (let j = 0; j < this.ny; j++)
      for (let i = 0; i < this.nx; i++) {
        const k = j * this.nx + i;
        if (this.cell[k] !== STUCK) continue;
        if ((i > 0 && mine(k - 1)) || (i < this.nx - 1 && mine(k + 1)) || (j > 0 && mine(k - this.nx)) || (j < this.ny - 1 && mine(k + this.nx))) out[k] = 1;
      }
    return out;
  }

  private edgeNear(q: V, within: number) {
    let best = -1;
    let bd = within;
    for (let j = 0; j < this.ny; j++)
      for (let i = 0; i < this.nx; i++) {
        if (this.at(i, j) !== STUCK) continue;
        // any side works, including the line where a loosened bit meets glued paper
        if (this.at(i - 1, j) === STUCK && this.at(i + 1, j) === STUCK && this.at(i, j - 1) === STUCK && this.at(i, j + 1) === STUCK) continue;
        const dd = Math.hypot((i + 0.5) * CELL - q.x, (j + 0.5) * CELL - q.y);
        if (dd < bd) {
          bd = dd;
          best = j * this.nx + i;
        }
      }
    return best;
  }

  private onCell(q: V) {
    return this.at(Math.floor(q.x / CELL), Math.floor(q.y / CELL));
  }

  cursorAt(x: number, y: number): "grab" | "default" {
    if (this.state === "done") return "default";
    const q = this.toLocal(x, y);
    if (this.rubbing) return this.overBook(x, y) ? "grab" : "default";
    if (this.hitFlap(q) || this.parkedAt(q)) return "grab";
    return this.edgeNear(q, 12) >= 0 ? "grab" : "default";
  }

  private overBook(x: number, y: number) {
    return x > BOOK.x0 && x < BOOK.x1 && y > BOOK.y0 && y < BOOK.y1;
  }

  // The way into the glued paper from a point near its edge.
  private inward(b: V): V {
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
    const s = this.L.shape;
    if (Math.hypot(sx, sy) > 1) return norm({ x: sx, y: sy });
    const to = { x: s.x + s.w / 2 - b.x, y: s.y + s.h / 2 - b.y };
    return Math.hypot(to.x, to.y) > 1 ? norm(to) : { x: 1, y: 0 };
  }

  /** Done with the thumb: wrap it as it is. */
  wrap() {
    this.state = "done";
  }

  private rubAlong(a: V, b: V): StickerEvent | null {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len / 3));
    const R = 8;
    let pilled = false;
    for (let s = 1; s <= steps; s++) {
      const x = a.x + ((b.x - a.x) * s) / steps;
      const y = a.y + ((b.y - a.y) * s) / steps;
      for (let j = Math.floor((y - R) / CELL); j <= Math.floor((y + R) / CELL); j++)
        for (let i = Math.floor((x - R) / CELL); i <= Math.floor((x + R) / CELL); i++) {
          if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) continue;
          if (Math.hypot((i + 0.5) * CELL - x, (j + 0.5) * CELL - y) > R) continue;
          const k = j * this.nx + i;
          const r = this.res[k];
          if (r === FUZZ) {
            if (this.rand() < 0.2) this.res[k] = 0;
          } else if (r === GLUE) {
            // thumbs move glue around more than they remove it
            const roll = this.rand();
            if (roll < 0.012) {
              this.res[k] = LINT;
              pilled = true;
            } else if (!this.film[k] && roll < 0.07) this.res[k] = 0;
          }
        }
    }
    this.rubbed += len;
    if (pilled && !this.pillSaid) {
      this.pillSaid = true;
      return "pill";
    }
    return null;
  }

  down(x: number, y: number): StickerEvent | null {
    if (this.state === "done") return null;
    const q = this.toLocal(x, y);
    this.ptr = q;
    if (this.rubbing) {
      if (!this.overBook(x, y)) return null;
      this.state = "rubbing";
      return "rub";
    }
    const onPaper = this.onCell(q) === STUCK;
    const id = this.hitFlap(q) ? 0 : this.parkedAt(q);
    if (this.hitFlap(q) || id) {
      if (id) {
        this.park();
        this.unpark(id);
        this.speed = 0;
        this.stress = 0;
      }
      this.state = "held";
      this.started = true;
      this.base = { ...this.p };
      this.grabAt = q;
      return "grab";
    }
    const e = this.edgeNear(q, 12);
    if (e >= 0) {
      this.park();
      this.state = "scratch";
      this.scratchAt = e;
      this.travel = 0;
      this.scratches++;
      this.started = true;
      return "scratch";
    }
    return onPaper ? "middle" : null;
  }

  move(x: number, y: number): StickerEvent | null {
    const q = this.toLocal(x, y);
    const moved = Math.hypot(q.x - this.ptr.x, q.y - this.ptr.y);
    const prev = this.ptr;
    this.ptr = q;
    if (this.state === "rubbing") return this.rubAlong(prev, q);
    if (this.state !== "scratch") return null;
    this.travel += moved;
    if (this.travel < 45) return null;
    // a fingernail finally gets under it
    const b = this.center(this.scratchAt);
    const n0 = this.inward(b);
    this.startFlap({ x: b.x - n0.x * 2.5, y: b.y - n0.y * 2.5 }, n0, 14);
    this.edges++;
    this.state = "held";
    this.base = { ...this.p };
    this.grabAt = q;
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
    if (this.state === "rubbing") this.state = "rub";
    return null;
  }

  private detach(cells: number[], f: Fold = this) {
    const { d, r } = this.fold(f);
    this.flyers.push({ cells, c: { ...f.c }, d, r, t: this.time, tex: this.L.tex, shape: this.L.shape, vinyl: this.L.kind === "vinyl" });
    for (const k of cells) this.cell[k] = GONE;
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
        this.res[k] = this.props.fuzz && this.rand() < 0.5 ? FUZZ : 0;
        flap.push(k);
      }
    for (const k of flap) {
      const i = k % this.nx;
      const j = (k - i) / this.nx;
      const touches = this.at(i - 1, j) === STUCK || this.at(i + 1, j) === STUCK || this.at(i, j - 1) === STUCK || this.at(i, j + 1) === STUCK;
      if (touches && this.rand() < 0.3) {
        this.cell[k] = STUCK;
        this.res[k] = 0;
        this.stuck++;
      }
    }
    this.detach(flap.filter((k) => this.cell[k] === FLAP));
    this.pieces++;
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
    if (this.state === "done" || this.rubbing) return out;
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
          const P = this.props;
          const tearAt = this.tearAt;
          this.stress = v > tearAt ? this.stress + ((v - tearAt) / 60) * 4 * P.tearMul * dt : Math.max(0, this.stress - dt * 0.9);
          if (!this.wideSaid && this.wide > 1.9 && got.length > 0) {
            this.wideSaid = true;
            out.push("wide");
          }
          if (!this.strainSaid && this.stress > 0.45) {
            this.strainSaid = true;
            out.push("strain");
          }
          if (!hadGlue && !this.glued && this.glueCells > 0) {
            this.glued = true;
            out.push("glue");
          }
          if (this.stubbornHit && !this.stubborn) {
            this.stubborn = 1;
            out.push("stubborn");
          }
          this.stubbornHit = false;
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
      if (this.measureFront() === 0) {
        const flap: number[] = [];
        for (let k = 0; k < this.cell.length; k++) if (this.cell[k] === FLAP) flap.push(k);
        this.detach(flap);
        this.state = "bare";
        if (this.stuck > 0) out.push("free");
      }
    }
    // a parked flap with nothing glued next to it any more just comes away
    this.parked.forEach((f, i) => {
      if (!f) return;
      const mine = (k: number) => this.cell[k] === PARKED && this.own[k] === i + 1;
      if (this.frontOf(mine).some((v) => v === 1)) return;
      const cells: number[] = [];
      for (let k = 0; k < this.cell.length; k++) if (mine(k)) cells.push(k);
      this.detach(cells, f);
      this.parked[i] = null;
      if (this.stuck > 0) out.push("free");
    });
    if ((this.state === "bare" || this.state === "scratch") && this.stuck < 10) {
      // crumbs too small to get a nail under: they are part of the book now
      for (let k = 0; k < this.cell.length; k++)
        if (this.cell[k] === STUCK) {
          this.cell[k] = GONE;
          this.res[k] = FUZZ;
          this.fuzzOf[k] = this.li;
        }
      this.stuck = 0;
      // any parked flaps come away with the last of it
      this.parked.forEach((f, i) => {
        if (!f) return;
        const cells: number[] = [];
        for (let k = 0; k < this.cell.length; k++) if (this.cell[k] === PARKED && this.own[k] === i + 1) cells.push(k);
        this.detach(cells, f);
      });
      this.parked = [];
      if (this.li + 1 < this.layers.length) {
        this.activate(this.li + 1);
        out.push("under");
      } else {
        this.state = "rub";
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

  /** For the hub thumbnail: the sticker caught part of the way off. */
  pose(frac: number) {
    const s = this.L.shape;
    const reach = Math.hypot(s.w, s.h);
    this.p = this.constrain({ x: this.c.x + this.n0.x * reach * 2 * frac, y: this.c.y + this.n0.y * reach * 2 * frac });
    this.claim(this.p, false);
    this.measureFront();
    this.state = "loose";
  }

  invalidate() {
    for (const l of this.layers) l.tex = null;
  }

  // ---------- drawing ----------

  draw(ctx: CanvasRenderingContext2D) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this.drawTable(ctx);
    this.drawBook(ctx);
    for (const l of this.layers) l.tex ??= this.makeTexture(l);
    const tex = this.L.tex;

    ctx.save();
    ctx.translate(this.origin.x, this.origin.y);
    ctx.rotate(this.ang);
    // older stickers underneath, still whole
    for (let i = this.layers.length - 1; i > this.li; i--) {
      const t = this.layers[i].tex;
      if (t) ctx.drawImage(t.c, 0, 0, this.gw, this.gh);
    }
    this.drawResidue(ctx);
    // every flap: the one in hand last, the parked ones as they were left
    const flap = this.hasFlap;
    const folds: { f: Fold; mine: (k: number) => boolean; front: Uint8Array }[] = [];
    this.parked.forEach((f, i) => {
      if (!f) return;
      const mine = (k: number) => this.cell[k] === PARKED && this.own[k] === i + 1;
      folds.push({ f, mine, front: this.frontOf(mine) });
    });
    if (flap) folds.push({ f: this, mine: (k) => this.cell[k] === FLAP, front: this.front_ });
    const onFront = (k: number) => folds.some((o) => o.front[k] === 1);
    // stuck paper. Along each crease, cells are cut to the fold line so the edge is straight.
    if (tex) {
      ctx.save();
      const keep = (k: number) => this.cell[k] === STUCK && !onFront(k);
      this.cellsPath(ctx, (k) => keep(k) && !this.torn(k));
      // torn edges are ragged, not square
      for (let k = 0; k < this.cell.length; k++) {
        if (!keep(k) || !this.torn(k)) continue;
        const m = this.center(k);
        const rr = 2.3 + hash(k) * 1.1;
        const jx = m.x + (hash(k + 7) - 0.5) * 1.6;
        const jy = m.y + (hash(k + 13) - 0.5) * 1.6;
        ctx.moveTo(jx + rr, jy);
        ctx.arc(jx, jy, rr, 0, Math.PI * 2);
      }
      ctx.clip();
      ctx.drawImage(tex.c, 0, 0, this.gw, this.gh);
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
    }
    for (const o of folds) {
      if (tex) {
        const { d, r } = this.fold(o.f);
        ctx.save();
        this.halfPlane(ctx, o.f.c, d, r, 1);
        ctx.clip();
        this.cellsPath(ctx, (k) => o.front[k] === 1 || o.mine(k));
        ctx.clip();
        ctx.drawImage(tex.c, 0, 0, this.gw, this.gh);
        ctx.restore();
      }
      this.drawFlap(ctx, tex, o.f, o.mine, (k) => o.front[k] === 1);
    }
    if (flap) {
      // paper going white along the peel line: it's about to give
      if (this.stress > 0.05) {
        this.cellsPath(ctx, (k) => this.front_[k] === 1);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, this.stress * 0.8)})`;
        ctx.fill();
      }
    }
    for (const f of this.flyers) this.drawFlyer(ctx, f);
    ctx.restore();
  }

  private drawTable(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#F3EFE8");
    g.addColorStop(1, "#ECE7DE");
    ctx.fillStyle = g;
    ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.strokeStyle = "rgba(120,96,64,0.05)";
    ctx.lineWidth = 1;
    for (let y = 22; y < H; y += 46) {
      ctx.beginPath();
      ctx.moveTo(-W, y);
      ctx.bezierCurveTo(W * 0.3, y + 6, W * 0.6, y - 5, W * 2, y + 3);
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
    const show = (k: number, kind: number) => this.res[k] === kind && this.cell[k] !== STUCK;
    ctx.fillStyle = "rgba(14,22,36,0.30)";
    ctx.beginPath();
    for (let k = 0; k < this.res.length; k++) {
      if (!show(k, GLUE)) continue;
      const m = this.center(k);
      ctx.moveTo(m.x + 3.4, m.y);
      ctx.arc(m.x, m.y, 3.4, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    for (let k = 0; k < this.res.length; k++) {
      if (!show(k, GLUE) || k % 3) continue;
      const m = this.center(k);
      ctx.moveTo(m.x, m.y);
      ctx.arc(m.x - 0.8, m.y - 0.8, 0.9, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = "rgba(246,243,236,0.55)";
    ctx.beginPath();
    for (let k = 0; k < this.res.length; k++) {
      if (!show(k, FUZZ)) continue;
      const m = this.center(k);
      ctx.moveTo(m.x + 2.8, m.y);
      ctx.arc(m.x, m.y, 2.8, 0, Math.PI * 2);
    }
    ctx.fill();
    // the paper layer that stayed still carries a faint print
    this.layers.forEach((L, li) => {
      if (!L.tex) return;
      ctx.save();
      this.cellsPath(ctx, (k) => show(k, FUZZ) && this.fuzzOf[k] === li);
      ctx.clip();
      ctx.globalAlpha = 0.62;
      ctx.drawImage(L.tex.c, 0, 0, this.gw, this.gh);
      ctx.restore();
    });
    // lint: rubbed glue, balled up
    for (let k = 0; k < this.res.length; k++) {
      if (!show(k, LINT)) continue;
      const m = this.center(k);
      const x = m.x + (hash(k + 11) - 0.5) * 2;
      const y = m.y + (hash(k + 17) - 0.5) * 2;
      ctx.fillStyle = "rgba(70,68,62,0.55)";
      ctx.beginPath();
      ctx.arc(x, y, 1.5 + hash(k + 19), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(x - 0.5, y - 0.5, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(250,248,242,0.8)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let k = 0; k < this.res.length; k++) {
      if (!show(k, FUZZ)) continue;
      const m = this.center(k);
      for (const a of [this.fibres[k * 2], this.fibres[k * 2 + 1]]) {
        ctx.moveTo(m.x - Math.cos(a) * 3, m.y - Math.sin(a) * 3);
        ctx.lineTo(m.x + Math.cos(a) * 3, m.y + Math.sin(a) * 3);
      }
    }
    ctx.stroke();
  }

  private cellsPath(ctx: CanvasRenderingContext2D, keep: (k: number) => boolean) {
    ctx.beginPath();
    const nx = this.nx;
    for (let j = 0; j < this.ny; j++) {
      let i = 0;
      while (i < nx) {
        if (!keep(j * nx + i)) {
          i++;
          continue;
        }
        const s = i;
        while (i < nx && keep(j * nx + i)) i++;
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

  private drawBack(ctx: CanvasRenderingContext2D, tex: Tex | null, keep: (k: number) => boolean, vinyl: boolean, crease?: { c: V; d: V; r: number }) {
    ctx.save();
    this.cellsPath(ctx, keep);
    ctx.clip();
    ctx.fillStyle = vinyl ? "#E4E6E6" : "#EAE6DE";
    ctx.fillRect(0, 0, this.gw, this.gh);
    if (tex) {
      // the print shows through, mirrored
      ctx.globalAlpha = 0.07;
      ctx.drawImage(tex.c, 0, 0, this.gw, this.gh);
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
      ctx.fillRect(-this.gw, -this.gh, this.gw * 3, this.gh * 3);
    }
    ctx.restore();
  }

  private drawFlap(ctx: CanvasRenderingContext2D, tex: Tex | null, f: Fold, mine: (k: number) => boolean, front: (k: number) => boolean) {
    const { d, r } = this.fold(f);
    const half = r / 2;
    const c = f.c;
    const side = (k: number) => {
      const m = this.center(k);
      return (m.x - c.x) * d.x + (m.y - c.y) * d.y < half;
    };
    const slack = (k: number) => mine(k) && !side(k);
    // slack bits lie back down, loosely
    this.flatShadow(ctx, slack, 2.5);
    if (tex) {
      ctx.save();
      this.cellsPath(ctx, slack);
      ctx.clip();
      ctx.drawImage(tex.c, 0, 0, this.gw, this.gh);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(0, 0, this.gw, this.gh);
      ctx.restore();
    }
    // the folded-back part, adhesive side up
    const crease = (k: number) => (mine(k) && side(k)) || front(k);
    for (const [ox, oy] of [
      [2, 4],
      [0.8, 1.6],
    ]) {
      ctx.save();
      ctx.translate(ox, oy);
      this.reflect(ctx, c, d, r);
      this.halfPlane(ctx, c, d, r, -1);
      ctx.clip();
      this.cellsPath(ctx, crease);
      ctx.fillStyle = "rgba(14,22,36,0.10)";
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    this.reflect(ctx, c, d, r);
    this.halfPlane(ctx, c, d, r, -1);
    ctx.clip();
    shapePath(ctx, this.L.shape);
    ctx.clip();
    this.drawBack(ctx, tex, crease, this.L.kind === "vinyl", { c, d, r });
    ctx.restore();
  }

  private drawFlyer(ctx: CanvasRenderingContext2D, f: Flyer) {
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
    shapePath(ctx, f.shape);
    ctx.clip();
    this.drawBack(ctx, f.tex, keep, f.vinyl);
    ctx.restore();
  }

  private makeTexture(L: Layer): Tex | null {
    const t = makeCanvas(this.gw * TS, this.gh * TS);
    if (!t) return null;
    const g = t.g;
    g.scale(TS, TS);
    const s = L.shape;
    const aged = L.kind === "aged";
    const ink = aged ? "#5A554B" : "#1C1C1A";
    const muted = aged ? "#8C8574" : "#6B6A65";
    shapePath(g, s, 0.5);
    g.fillStyle = aged ? "#F1E8CF" : "#FFFFFF";
    g.fill();
    g.strokeStyle = "rgba(28,28,26,0.14)";
    g.lineWidth = 0.6;
    g.stroke();
    g.save();
    shapePath(g, s, 0.5);
    g.clip();
    if (L.kind === "vinyl") {
      // a coloured band and a gloss
      g.fillStyle = "#4A5F78";
      g.fillRect(s.x, s.y, s.w, 15);
      const gl = g.createLinearGradient(s.x, s.y, s.x + s.w, s.y + s.h);
      gl.addColorStop(0.3, "rgba(255,255,255,0)");
      gl.addColorStop(0.42, "rgba(220,228,236,0.55)");
      gl.addColorStop(0.5, "rgba(255,255,255,0)");
      g.fillStyle = gl;
      g.fillRect(s.x, s.y, s.w, s.h);
    }
    if (aged) {
      g.fillStyle = "rgba(160,130,70,0.08)";
      for (let i = 0; i < 18; i++) {
        g.beginPath();
        g.arc(s.x + hash(i * 3) * s.w, s.y + hash(i * 3 + 1) * s.h, 2 + hash(i * 3 + 2) * 7, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
    if (L.kind === "paper" || L.kind === "round") {
      g.strokeStyle = "rgba(28,28,26,0.10)";
      g.lineWidth = 0.5;
      g.setLineDash([3, 3]);
      shapePath(g, s, 4.5);
      g.stroke();
      g.setLineDash([]);
    }
    const font = (wt: number, px: number) => `${wt} ${px}px "Inter Tight", system-ui, sans-serif`;
    if (s.round) {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      g.textAlign = "center";
      g.fillStyle = muted;
      g.font = font(600, 7);
      g.fillText(L.shop, cx, cy - s.h * 0.24);
      if (L.was) {
        g.font = font(500, 9);
        g.fillText(`was ${L.was}`, cx, cy - s.h * 0.1);
        const ww = g.measureText(`was ${L.was}`).width;
        g.strokeStyle = muted;
        g.lineWidth = 0.8;
        this.line(g, cx - ww / 2 - 1, cy - s.h * 0.1 - 3.5, cx + ww / 2 + 1, cy - s.h * 0.1 - 3.5);
      }
      g.fillStyle = ink;
      const rp = Math.round(s.w * 0.26);
      g.font = font(600, rp);
      g.fillText(L.price, cx, cy + s.h * 0.15);
      L.glyphs = glyphs(g, L.price, cx - g.measureText(L.price).width / 2, cy + s.h * 0.15, rp);
      g.fillStyle = muted;
      g.font = font(500, 6);
      g.fillText("PLEASE KEEP RECEIPT", cx, cy + s.h * 0.3);
      g.textAlign = "start";
    } else {
      const x = s.x;
      const y = s.y + (L.kind === "vinyl" ? 8 : 0);
      if (L.kind === "vinyl") {
        g.fillStyle = "#FFFFFF";
        g.font = font(600, 8);
        g.fillText(L.shop, x + 13, s.y + 10.5);
      } else {
        g.fillStyle = muted;
        g.font = font(600, 8);
        g.fillText(L.shop, x + 13, y + 21);
      }
      if (L.was) {
        g.fillStyle = muted;
        g.font = font(500, 10);
        g.fillText(`was ${L.was}`, x + 13, y + 38);
        g.strokeStyle = muted;
        g.lineWidth = 0.8;
        this.line(g, x + 12, y + 34.5, x + 15 + g.measureText(`was ${L.was}`).width, y + 34.5);
      }
      g.fillStyle = ink;
      g.font = font(600, 100);
      const px = Math.round(Math.min(s.h * 0.36, (100 * (s.w - 98)) / g.measureText(L.price).width));
      g.font = font(600, px);
      g.fillText(L.price, x + 10, y + 40 + px * 0.8);
      L.glyphs = glyphs(g, L.price, x + 10, y + 40 + px * 0.8, px);
      // barcode
      const bh = Math.min(44, s.h - 70);
      const bx = x + s.w - 76;
      for (let i = 0; i < L.bars.length; i += 2) g.fillRect(bx + L.bars[i], y + 14, L.bars[i + 1], bh);
      g.font = font(500, 6.5);
      g.fillText("5 012345 678900", bx + 4, y + 22 + bh);
      g.fillStyle = muted;
      g.fillText(aged ? "SKU 11208-9 · OLD STOCK" : "SKU 40417-2 · PLEASE KEEP RECEIPT", x + 13, s.y + s.h - 13);
    }
    if (L.kind === "security") {
      g.strokeStyle = "rgba(28,28,26,0.28)";
      g.lineWidth = 0.55;
      g.beginPath();
      for (const c of L.cuts) {
        g.moveTo(c[0], c[1]);
        g.lineTo(c[2], c[3]);
      }
      g.stroke();
    }
    // stickers on the sticker
    for (const b of L.badges) {
      g.fillStyle = "rgba(28,28,26,0.12)";
      g.beginPath();
      g.arc(b.x + 0.6, b.y + 1, b.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = b.color;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#FFFFFF";
      g.textAlign = "center";
      g.font = font(600, b.text.length > 4 ? 8.5 : 11.5);
      g.fillText(b.text, b.x, b.y + (b.sub ? 2 : 4));
      if (b.sub) {
        g.font = font(500, 5);
        g.fillText(b.sub, b.x, b.y + 9.5);
      }
      g.textAlign = "start";
    }
    return t;
  }

  private line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

function glyphs(g: CanvasRenderingContext2D, text: string, x: number, base: number, px: number): Glyph[] {
  return [...text].map((ch, i) => {
    const x0 = x + g.measureText(text.slice(0, i)).width;
    return { ch, x0, x1: x0 + g.measureText(ch).width, y0: base - px * 0.72, y1: base };
  });
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

export type StickerResult = {
  clean: number;
  pieces: number;
  layers: number;
  glue: number;
  lint: number;
  edges: number;
  readable: string;
  time: number;
  kind: string;
};

// There is no perfect tier: the strongest glue always stays, so the best you can do is "nearly".
export function stickerTier(r: StickerResult) {
  const pct = r.clean;
  const extra = r.pieces - r.layers; // pieces beyond one per sticker
  const still = r.readable ? ` And they can still read '${r.readable}'.` : "";
  if (pct < 0.6) return { tier: "Tacky", line: `The book is now permanently, slightly sticky.${still}` };
  if (extra >= 3) return { tier: "Confetti", line: `You did not peel it so much as take it apart.${still}` };
  if (r.readable) return { tier: "They'll know", line: `Whatever else happens, they can still read '${r.readable}'.` };
  if (extra >= 1) return { tier: "In instalments", line: `It came off in ${r.pieces} pieces. At least the price went with them.` };
  if (r.lint > 12) return { tier: "Lint magnet", line: "The glue stayed and invited friends." };
  if (pct >= 0.95) return { tier: "Nearly", line: "There is always a little glue. Wrap it quickly." };
  return { tier: "One piece, some glue", line: "The sticker left. Its glue decided to stay." };
}
