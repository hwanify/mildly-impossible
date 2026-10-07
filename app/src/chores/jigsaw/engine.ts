// The table: the board with the puzzle so far, a note saying which puzzle it is, and your one piece
// lying next to the board on a slip that says "yours". No picture on a lid: the bits already done
// are all there is to go on. Canvas 2D in a fixed 1000x640 view; the board is a camera you can
// zoom and drag. No window or document at import time: canvases come in through `mk`.
import { COLS, ROWS, COUNT, P, BW, BH, TAB, SHIFT, type Cut, type Edge, makeCut, sideEdge, fitsHole, islands, count, placedAround } from "./puzzle";
import { labelIn, type Scene } from "./pictures/common";

export const W = 1000;
export const H = 640;
/** How far a tab can reach past its cell. */
const M = 0.4 * P;
/** Resolution of the cached board, in pixels per world unit. Closer than that, pieces are drawn live. */
const CS = 1.25;
const AREA = { x: 16, y: 16, w: 728, h: 608 };
const NOTE = { x: 784, y: 24, w: 196, h: 104 };
const SLIP = { x: 792, y: 182, w: 182, h: 250 };
/** Where your piece lies, and how big it is there (view units per world unit). */
const HOME = { x: 884, y: 318 };
const HOME_S = 1.75;
const BTNS = [
  { id: "in", x: 16, y: 594, w: 34, h: 30, label: "+" },
  { id: "out", x: 56, y: 594, w: 34, h: 30, label: "−" },
  { id: "fit", x: 96, y: 594, w: 46, h: 30, label: "all" },
] as const;

export const PIECES = COUNT;

export type JigsawEvent =
  | { t: "deal"; cell: number; label: string }
  | { t: "grab" }
  | { t: "fitsWrong" }
  | { t: "nearly" }
  | { t: "placed"; cell: number; label: string; goes: number; met: boolean; finished: boolean };

type Tween = { tx: number; ty: number; ts: number; dur: number; delay?: number; then?: () => void; start?: number; fx?: number; fy?: number; fs?: number };
/** Your piece, in view units: x, y its centre, s its size (view units per world unit). */
type Loose = { cell: number; ang: number; x: number; y: number; s: number; lift: number; lock: boolean; tw: Tween[] };
type Grab =
  | { kind: "piece"; id: number; dx: number; dy: number; s0: number; sx: number; sy: number; t0: number; moved: boolean }
  | { kind: "pan"; id: number; sx: number; sy: number; ox: number; oy: number }
  | { kind: "pinch"; d0: number; z0: number; wx: number; wy: number };

export type Hover = "btn" | "piece" | "table" | null;

type Pt = [number, number];
function edgePoints(e: Edge): Pt[] {
  const t = TAB[e.k % 2];
  const b = SHIFT[Math.floor(e.k / 2)];
  const { c, d } = e;
  const pts: Pt[] = [
    [0, 0],
    [0.2, 0],
    [0.5 + b + d, -t + c],
    [0.5 - t + b, t + c],
    [0.5 - 2 * t + b - d, 3 * t + c],
    [0.5 + 2 * t + b - d, 3 * t + c],
    [0.5 + t + b, t + c],
    [0.5 + b + d, -t + c],
    [0.8, 0],
    [1, 0],
  ];
  return pts.map(([u, v]) => [u, v * e.s]);
}

/** The outline of piece i, centred on (0, 0). */
export function piecePath(cut: Cut, i: number): Path2D {
  const h = P / 2;
  const path = new Path2D();
  path.moveTo(-h, -h);
  // origin, along, across for each side as the cut stores it; bottom and left are walked backwards
  const sides: [number, number, number, number, number, number][] = [
    [-h, -h, P, 0, 0, P],
    [h, -h, 0, P, P, 0],
    [-h, h, P, 0, 0, P],
    [-h, -h, 0, P, P, 0],
  ];
  for (let p = 0; p < 4; p++) {
    const { e, rev } = sideEdge(cut, i, p);
    const [ox, oy, ux, uy, nx, ny] = sides[p];
    if (!e) {
      path.lineTo(rev ? ox : ox + ux, rev ? oy : oy + uy);
      continue;
    }
    let pts = edgePoints(e).map(([u, v]) => [ox + u * ux + v * nx, oy + u * uy + v * ny] as Pt);
    if (rev) pts = pts.reverse();
    for (let k = 1; k < 10; k += 3) path.bezierCurveTo(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], pts[k + 2][0], pts[k + 2][1]);
  }
  path.closePath();
  return path;
}

export const cellX = (i: number) => (i % COLS) * P + P / 2;
export const cellY = (i: number) => ((i / COLS) | 0) * P + P / 2;

/** Draws the picture's bit for cell i into a piece centred on (0, 0) (clip already set). */
function paintPiece(ctx: CanvasRenderingContext2D, pic: HTMLCanvasElement, scale: number, i: number) {
  const x0 = cellX(i) - P / 2 - M;
  const y0 = cellY(i) - P / 2 - M;
  // keep the source rectangle inside the picture (Safari draws nothing otherwise)
  const sx = Math.max(0, x0);
  const sy = Math.max(0, y0);
  const sw = Math.min(BW, x0 + P + 2 * M) - sx;
  const sh = Math.min(BH, y0 + P + 2 * M) - sy;
  ctx.drawImage(pic, sx * scale, sy * scale, sw * scale, sh * scale, sx - x0 - P / 2 - M, sy - y0 - P / 2 - M, sw, sh);
}

function seam(ctx: CanvasRenderingContext2D, path: Path2D) {
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,.2)";
  ctx.lineWidth = 0.7;
  ctx.translate(0.5, 0.5);
  ctx.stroke(path);
  ctx.translate(-0.5, -0.5);
  ctx.strokeStyle = "rgba(28,28,26,.3)";
  ctx.lineWidth = 0.8;
  ctx.stroke(path);
}

function penRing(ctx: CanvasRenderingContext2D, i: number) {
  ctx.strokeStyle = "rgba(45,76,154,.8)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  const a = (i * 2.399) % (Math.PI * 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, P * 0.34, P * 0.3, a, 0.3, Math.PI * 2 + 0.6);
  ctx.stroke();
}

/** A still of a board: backing and the placed pieces, in world units. For thumbnails and the hub. */
export function drawBoard(ctx: CanvasRenderingContext2D, pic: HTMLCanvasElement, scale: number, placed: Uint8Array, cut: Cut) {
  ctx.fillStyle = "#D6CEBF";
  ctx.fillRect(0, 0, BW, BH);
  const paths: Path2D[] = [];
  for (let i = 0; i < COUNT; i++) {
    if (!placed[i]) continue;
    paths[i] = piecePath(cut, i);
    ctx.save();
    ctx.translate(cellX(i), cellY(i));
    ctx.clip(paths[i]);
    paintPiece(ctx, pic, scale, i);
    ctx.restore();
  }
  for (let i = 0; i < COUNT; i++) {
    if (!placed[i]) continue;
    ctx.save();
    ctx.translate(cellX(i), cellY(i));
    seam(ctx, paths[i]);
    ctx.restore();
  }
}

export class Jigsaw {
  readonly cut: Cut;
  placed: Uint8Array;
  mine: Set<number>;
  loose: Loose | null = null;
  goes = 0;
  hover: Hover = null;
  grab: Grab | null = null;
  /** When the finished puzzle gets tipped back in the box and the next one starts (epoch ms). */
  nextAt: number | null = null;
  onEvent: (e: JigsawEvent) => void = () => {};

  private z = 1;
  private ox = 0;
  private oy = 0;
  private fitZ = 1;
  private zMax = 3;
  private devScale = 1;
  private paths: Path2D[] = [];
  private cache: HTMLCanvasElement;
  private appear: { cell: number; t0: number }[] = [];
  private pointers = new Map<number, { x: number; y: number }>();
  private now = 0;

  constructor(
    private pic: HTMLCanvasElement,
    private picScale: number,
    mk: (w: number, h: number) => HTMLCanvasElement,
    readonly scene: Scene,
    readonly no: number,
    placed: Uint8Array,
    mine: number[],
  ) {
    this.cut = makeCut(1000 + no);
    this.placed = placed;
    this.mine = new Set(mine);
    for (let i = 0; i < COUNT; i++) this.paths[i] = piecePath(this.cut, i);
    this.cache = mk(Math.round(BW * CS), Math.round(BH * CS));
    this.fit();
    this.rebuild();
  }

  get left() {
    return COUNT - count(this.placed);
  }

  label(i: number) {
    return labelIn(this.scene.labels, cellX(i), cellY(i));
  }

  /** Device pixels per view unit, and CSS pixels per view unit, from the wrapper on resize. */
  setScreen(devScale: number, cssScale: number) {
    this.devScale = devScale;
    this.zMax = Math.max(this.fitZ * 2.2, 130 / (P * cssScale));
  }

  fit() {
    this.fitZ = Math.min(AREA.w / BW, AREA.h / BH);
    this.z = this.fitZ;
    this.ox = AREA.x + (AREA.w - BW * this.z) / 2;
    this.oy = AREA.y + (AREA.h - BH * this.z) / 2;
  }

  private zoomAt(x: number, y: number, f: number) {
    const z = Math.min(this.zMax, Math.max(this.fitZ * 0.85, this.z * f));
    this.ox = x - ((x - this.ox) * z) / this.z;
    this.oy = y - ((y - this.oy) * z) / this.z;
    this.z = z;
    this.clamp();
  }

  private clamp() {
    const bw = BW * this.z;
    const bh = BH * this.z;
    this.ox = Math.min(660, Math.max(100 - bw, this.ox));
    this.oy = Math.min(540, Math.max(100 - bh, this.oy));
  }

  toView(x: number, y: number) {
    return { x: x * this.z + this.ox, y: y * this.z + this.oy };
  }

  private toWorld(x: number, y: number) {
    return { x: (x - this.ox) / this.z, y: (y - this.oy) / this.z };
  }

  /** Redraws the cached board from scratch. */
  private rebuild() {
    const ctx = this.cache.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cache.width, this.cache.height);
    ctx.setTransform(CS, 0, 0, CS, 0, 0);
    const skip = new Set(this.appear.map((a) => a.cell));
    for (let i = 0; i < COUNT; i++) {
      if (!this.placed[i] || skip.has(i)) continue;
      ctx.save();
      ctx.translate(cellX(i), cellY(i));
      ctx.clip(this.paths[i]);
      paintPiece(ctx, this.pic, this.picScale, i);
      ctx.restore();
    }
    for (let i = 0; i < COUNT; i++) {
      if (!this.placed[i] || skip.has(i)) continue;
      ctx.save();
      ctx.translate(cellX(i), cellY(i));
      seam(ctx, this.paths[i]);
      if (this.mine.has(i)) penRing(ctx, i);
      ctx.restore();
    }
  }

  // ---- what you do ----

  private emit(e: JigsawEvent) {
    this.onEvent(e);
  }

  /** Puts piece `cell` on the slip by the board as yours. */
  deal(cell: number) {
    if (this.loose || cell < 0 || cell >= COUNT || this.placed[cell]) return;
    this.loose = { cell, ang: 0.5, x: HOME.x + 30, y: HOME.y - 50, s: HOME_S * 1.2, lift: 1, lock: false, tw: [{ tx: HOME.x, ty: HOME.y, ts: HOME_S, dur: 280 }] };
    this.goes = 0;
    this.emit({ t: "deal", cell, label: this.label(cell) });
  }

  /** Your piece went in somewhere else (someone else put it in): it's gone. */
  lose() {
    this.loose = null;
    this.grab = null;
  }

  /** Someone else put a piece in. */
  othersPlace(cell: number): { label: string; met: boolean; finished: boolean } | null {
    if (cell < 0 || this.placed[cell] || this.loose?.cell === cell) return null;
    const before = islands(this.placed);
    this.placed[cell] = 1;
    this.appear.push({ cell, t0: this.now });
    return { label: this.label(cell), met: islands(this.placed) < before, finished: !this.left };
  }

  private home(delay = 0, then?: () => void): Tween {
    return { tx: HOME.x, ty: HOME.y, ts: HOME_S, dur: 260, delay, then };
  }

  private drop() {
    const L = this.loose;
    if (!L) return;
    const w = this.toWorld(L.x, L.y);
    const c = Math.floor(w.x / P);
    const r = Math.floor(w.y / P);
    const hole = r * COLS + c;
    const hx = c * P + P / 2;
    const hy = r * P + P / 2;
    // not over a hole that has anything next to it: it goes back on its slip
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS || this.placed[hole] || Math.hypot(w.x - hx, w.y - hy) > 0.42 * P || (hole !== L.cell && !placedAround(this.placed, hole))) {
      L.tw = [this.home()];
      return;
    }
    this.goes++;
    const at = this.toView(hx, hy);
    if (hole === L.cell) {
      L.lock = true;
      L.tw = [{ tx: at.x, ty: at.y, ts: this.z, dur: 110, then: () => this.place() }];
      return;
    }
    if (hole !== L.cell && fitsHole(this.cut, this.placed, L.cell, 0, hole)) {
      // it goes in. the picture doesn't match. out it comes.
      L.lock = true;
      L.tw = [{ tx: at.x, ty: at.y, ts: this.z, dur: 110 }, this.home(450, () => (L.lock = false))];
      this.emit({ t: "fitsWrong" });
      return;
    }
    let ux = L.x - at.x;
    let uy = L.y - at.y;
    const d = Math.hypot(ux, uy);
    if (d < 2) {
      ux = 0.6;
      uy = 0.8;
    } else {
      ux /= d;
      uy /= d;
    }
    const k = 0.6 * P * this.z;
    L.tw = [{ tx: at.x + ux * k, ty: at.y + uy * k, ts: this.z, dur: 120 }, this.home(160)];
    this.emit({ t: "nearly" });
  }

  private place() {
    const L = this.loose;
    if (!L) return;
    const before = islands(this.placed);
    this.placed[L.cell] = 1;
    this.mine.add(L.cell);
    const met = islands(this.placed) < before;
    this.loose = null;
    this.rebuild();
    const finished = !this.left;
    this.emit({ t: "placed", cell: L.cell, label: this.label(L.cell), goes: this.goes, met, finished });
  }

  // ---- pointer ----

  private hitPiece(x: number, y: number) {
    const L = this.loose;
    if (!L || L.lock) return false;
    const d = Math.hypot(x - L.x, y - L.y);
    return d < P * 0.62 * L.s || d < 22;
  }

  private hitAt(x: number, y: number): Hover {
    if (BTNS.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)) return "btn";
    if (this.hitPiece(x, y)) return "piece";
    return "table";
  }

  down(id: number, x: number, y: number) {
    this.pointers.set(id, { x, y });
    if (this.pointers.size === 2 && (!this.grab || this.grab.kind === "pan")) {
      const [a, b] = [...this.pointers.values()];
      const w = this.toWorld((a.x + b.x) / 2, (a.y + b.y) / 2);
      this.grab = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: this.z, wx: w.x, wy: w.y };
      return;
    }
    if (this.grab) return;
    const hit = this.hitAt(x, y);
    if (hit === "btn") {
      const b = BTNS.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)!;
      if (b.id === "fit") this.fit();
      else this.zoomAt(AREA.x + AREA.w / 2, AREA.y + AREA.h / 2, b.id === "in" ? 1.5 : 1 / 1.5);
      return;
    }
    if (hit === "piece" && this.loose) {
      this.loose.tw = [];
      this.grab = { kind: "piece", id, dx: this.loose.x - x, dy: this.loose.y - y, s0: this.loose.s, sx: x, sy: y, t0: this.now, moved: false };
      this.emit({ t: "grab" });
      return;
    }
    this.grab = { kind: "pan", id, sx: x, sy: y, ox: this.ox, oy: this.oy };
  }

  move(id: number, x: number, y: number) {
    if (this.pointers.has(id)) this.pointers.set(id, { x, y });
    const g = this.grab;
    if (!g) {
      this.hover = this.hitAt(x, y);
      return;
    }
    if (g.kind === "piece" && g.id === id && this.loose) {
      if (Math.hypot(x - g.sx, y - g.sy) > 5) g.moved = true;
      const k = this.loose.s / g.s0;
      this.loose.x = x + g.dx * k;
      this.loose.y = y + g.dy * k;
    } else if (g.kind === "pan" && g.id === id) {
      this.ox = g.ox + (x - g.sx);
      this.oy = g.oy + (y - g.sy);
      this.clamp();
    } else if (g.kind === "pinch" && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.z = Math.min(this.zMax, Math.max(this.fitZ * 0.85, (g.z0 * d) / g.d0));
      this.ox = (a.x + b.x) / 2 - g.wx * this.z;
      this.oy = (a.y + b.y) / 2 - g.wy * this.z;
      this.clamp();
    }
  }

  up(id: number, cancel: boolean) {
    this.pointers.delete(id);
    const g = this.grab;
    if (!g) return;
    if (g.kind === "piece" && g.id === id) {
      this.grab = null;
      const L = this.loose;
      if (!L) return;
      if (cancel || !g.moved) L.tw = [this.home()];
      else this.drop();
    } else if (g.kind === "pan" && g.id === id) this.grab = null;
    else if (g.kind === "pinch" && this.pointers.size < 2) this.grab = null;
  }

  leave() {
    this.hover = null;
  }

  wheel(x: number, y: number, dy: number, pinch: boolean) {
    this.zoomAt(x, y, Math.exp(-dy * (pinch ? 0.01 : 0.0015)));
  }

  // ---- time ----

  step(now: number) {
    const dt = this.now ? Math.min(0.05, (now - this.now) / 1000) : 0;
    this.now = now;
    const L = this.loose;
    if (L) {
      const tw = L.tw[0];
      if (tw) {
        if (tw.start === undefined) {
          tw.start = now + (tw.delay ?? 0);
          tw.fx = L.x;
          tw.fy = L.y;
          tw.fs = L.s;
        }
        if (now >= tw.start) {
          const k = Math.min(1, (now - tw.start) / tw.dur);
          const e = ease(k);
          L.x = tw.fx! + (tw.tx - tw.fx!) * e;
          L.y = tw.fy! + (tw.ty - tw.fy!) * e;
          L.s = tw.fs! + (tw.ts - tw.fs!) * e;
          if (k >= 1) {
            L.tw.shift();
            tw.then?.();
          }
        }
      }
      // carried over the board, it shrinks to the board's size so it can be compared
      if (this.grab?.kind === "piece") L.s += (this.z - L.s) * Math.min(1, dt * 10);
      L.ang += (0 - L.ang) * Math.min(1, dt * 16);
      L.lift += ((this.grab?.kind === "piece" ? 1 : 0) - L.lift) * Math.min(1, dt * 14);
    }
    if (this.appear.length && this.appear.every((a) => now - a.t0 > 700)) {
      this.appear = [];
      this.rebuild();
    }
  }

  // ---- drawing ----

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#ECE7DD";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.z, this.z);
    ctx.save();
    ctx.shadowColor = "rgba(28,28,26,.2)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#CFC6B6";
    ctx.fillRect(-8, -8, BW + 16, BH + 16);
    ctx.restore();
    ctx.fillStyle = "#D9D1C2";
    ctx.fillRect(0, 0, BW, BH);
    ctx.strokeStyle = "rgba(28,28,26,.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, BW, BH);
    const appearing = new Set(this.appear.map((a) => a.cell));
    if (this.z * this.devScale <= CS * 1.15) ctx.drawImage(this.cache, 0, 0, BW, BH);
    else this.drawLive(ctx, appearing);
    for (const a of this.appear) {
      const k = Math.min(1, (this.now - a.t0) / 600);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(cellX(a.cell), cellY(a.cell));
      ctx.scale(1.25 - 0.25 * ease(k), 1.25 - 0.25 * ease(k));
      ctx.save();
      ctx.clip(this.paths[a.cell]);
      paintPiece(ctx, this.pic, this.picScale, a.cell);
      ctx.restore();
      seam(ctx, this.paths[a.cell]);
      ctx.restore();
    }
    ctx.restore();
    this.drawHud(ctx);
    const L = this.loose;
    if (L) {
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.rotate(L.ang);
      const s = L.s * (1 + 0.06 * L.lift);
      ctx.scale(s, s);
      // shadows are in device pixels: grow them with the piece so it still looks lifted up close
      const ds = Math.max(1, L.s * this.devScale * 0.7);
      ctx.save();
      ctx.shadowColor = "rgba(28,28,26,.38)";
      ctx.shadowBlur = (4 + 12 * L.lift) * ds;
      ctx.shadowOffsetY = (2 + 7 * L.lift) * ds;
      ctx.fillStyle = "#BDB4A4";
      ctx.fill(this.paths[L.cell]);
      ctx.restore();
      ctx.save();
      ctx.clip(this.paths[L.cell]);
      paintPiece(ctx, this.pic, this.picScale, L.cell);
      ctx.restore();
      ctx.strokeStyle = "rgba(28,28,26,.55)";
      ctx.lineWidth = 1.1;
      ctx.stroke(this.paths[L.cell]);
      ctx.restore();
    }
  }

  /** Close up: draws the placed pieces in view straight from the picture, sharp. */
  private drawLive(ctx: CanvasRenderingContext2D, skip: Set<number>) {
    const a = this.toWorld(0, 0);
    const b = this.toWorld(W, H);
    const c0 = Math.max(0, Math.floor(a.x / P) - 1);
    const c1 = Math.min(COLS - 1, Math.floor(b.x / P) + 1);
    const r0 = Math.max(0, Math.floor(a.y / P) - 1);
    const r1 = Math.min(ROWS - 1, Math.floor(b.y / P) + 1);
    for (let pass = 0; pass < 2; pass++)
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const i = r * COLS + c;
          if (!this.placed[i] || skip.has(i)) continue;
          ctx.save();
          ctx.translate(cellX(i), cellY(i));
          if (pass === 0) {
            ctx.clip(this.paths[i]);
            paintPiece(ctx, this.pic, this.picScale, i);
          } else {
            seam(ctx, this.paths[i]);
            if (this.mine.has(i)) penRing(ctx, i);
          }
          ctx.restore();
        }
  }

  private paper(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rot: number) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rot);
    ctx.translate(-w / 2, -h / 2);
    ctx.save();
    ctx.shadowColor = "rgba(28,28,26,.14)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#FFFEFA";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D) {
    ctx.textBaseline = "middle";
    // zoom buttons
    ctx.textAlign = "center";
    for (const b of BTNS) {
      ctx.save();
      ctx.shadowColor = "rgba(28,28,26,.12)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = "#FFFEFA";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.restore();
      ctx.fillStyle = "#1C1C1A";
      ctx.font = b.id === "fit" ? `500 13px "Work Sans", sans-serif` : `400 20px "Work Sans", sans-serif`;
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    }
    // which puzzle this is
    ctx.save();
    this.paper(ctx, NOTE.x, NOTE.y, NOTE.w, NOTE.h, 0.012);
    ctx.textAlign = "left";
    ctx.fillStyle = "#6B6A65";
    ctx.font = `500 11px "Work Sans", sans-serif`;
    ctx.fillText(`PUZZLE NO. ${this.no}`, 14, 22);
    ctx.fillStyle = "#1C1C1A";
    ctx.font = `400 19px "Libre Caslon Text", serif`;
    ctx.fillText(this.scene.title, 14, 48);
    ctx.fillStyle = "#2D4C9A";
    ctx.font = `400 25px "Reenie Beanie", cursive`;
    ctx.fillText(`${COUNT - this.left} of ${COUNT} in`, 14, 80);
    ctx.restore();
    // your slip
    ctx.save();
    this.paper(ctx, SLIP.x, SLIP.y, SLIP.w, SLIP.h, -0.02);
    ctx.fillStyle = "#2D4C9A";
    ctx.strokeStyle = "#2D4C9A";
    ctx.lineCap = "round";
    ctx.textAlign = "left";
    if (!this.left) {
      ctx.font = `400 34px "Reenie Beanie", cursive`;
      ctx.fillText("it's done.", 22, 60);
      ctx.font = `400 25px "Reenie Beanie", cursive`;
      const ms = this.nextAt === null ? 0 : Math.max(0, this.nextAt - Date.now());
      const sec = Math.ceil(ms / 1000);
      ctx.fillText("the next one", 22, 120);
      ctx.fillText(`starts in ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`, 22, 148);
    } else {
      ctx.font = `400 36px "Reenie Beanie", cursive`;
      ctx.fillText("yours", 18, 30);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(84, 32);
      ctx.quadraticCurveTo(108, 40, 112, 66);
      ctx.moveTo(104, 58);
      ctx.lineTo(112, 68);
      ctx.lineTo(118, 57);
      ctx.stroke();
      if (!this.loose) {
        ctx.font = `400 24px "Reenie Beanie", cursive`;
        ctx.textAlign = "center";
        ctx.fillText("another one's coming", SLIP.w / 2, 136);
      }
    }
    ctx.restore();
  }
}

function ease(k: number) {
  return k < 0 ? 0 : k > 1 ? 1 : 1 - (1 - k) * (1 - k) * (1 - k);
}
