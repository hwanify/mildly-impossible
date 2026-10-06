// "Peel a Clementine in One Piece": top view of a clementine on a plate. Pure module, SSR safe.
// The peel is a grid of small cells over the fruit. Pulling the strip tears cells off at the
// front, one small cluster at a time, but the peel only tears so fast: pull faster than that,
// turn too sharply or pull through a narrow neck and the strip snaps into a separate piece.
export const W = 1000;
export const H = 640;
const CX = 400;
const CY = 318;
const R = 205;
const CELL = 12;
const BLOB = CELL * 0.85;
const STRIP = 17; // radius of peel that comes off with each step of the tear
const STEP_PX = CELL * 0.8; // pulled length per step
const MAX_RATE = 2.6; // fastest the peel tears, px per 60 Hz frame
const CM_PER_PX = 0.02;
const HUG = 0.07;
const PILE_SCALE = 0.36;

export type PeelEvent = "dig" | "dig-again" | "start" | "snap" | "free" | "release" | "regrab" | "abandon" | "clean" | "pick" | "long";
export type SnapReason = "fast" | "turn" | "neck";
export type PeelResult = { pieces: number; threads: number; picked: number; time: number; longestCm: number };

type Cell = { x: number; y: number; att: boolean; piece: number; shade: number; gland: boolean; gx: number; gy: number };
type Thread = { x1: number; y1: number; qx: number; qy: number; x2: number; y2: number; w: number };
type PathPt = { x: number; y: number };
type Piece = { cells: number; path: PathPt[]; done: boolean; px: number; py: number; rot: number; pithUp: boolean; ox: number; oy: number };
type Pull = {
  piece: number;
  ax: number; // tear front
  ay: number;
  dax: number; // drawn front, eased
  day: number;
  hx: number; // hand
  hy: number;
  grabbing: boolean;
  progress: number;
  width: number;
  dx: number; // last tear direction
  dy: number;
  jitter: number;
  sf: number; // how close to the tear limit the pull runs, 0..1
};

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

const ORANGES = ["#E9852D", "#E57F28", "#EC8B33"];
const PITH = "#F5E9D2";

export class Peel {
  rand: () => number;
  cells: (Cell | null)[] = [];
  cols: number;
  total = 0;
  attached = 0;
  threads: Thread[] = [];
  pieces: Piece[] = [];
  pull: Pull | null = null;
  started = false;
  clean = false;
  picked = 0;
  strain = 0;
  snapReason: SnapReason = "fast";
  longSaid = false;
  stemThreads = false;
  segOffset: number;
  private ox = CX - R - CELL;
  private oy = CY - R - CELL;

  constructor(seed: number) {
    this.rand = rng(seed);
    this.segOffset = this.rand() * Math.PI * 2;
    this.cols = Math.ceil((2 * R + 2 * CELL) / CELL);
    for (let j = 0; j < this.cols; j++) {
      for (let i = 0; i < this.cols; i++) {
        // jittered centres so torn edges come out ragged instead of on a grid
        const x = this.ox + (i + 0.5 + (this.rand() - 0.5) * 0.55) * CELL;
        const y = this.oy + (j + 0.5 + (this.rand() - 0.5) * 0.55) * CELL;
        if (Math.hypot(x - CX, y - CY) > R + CELL * 0.35) {
          this.cells.push(null);
          continue;
        }
        const r = this.rand();
        this.cells.push({
          x,
          y,
          att: true,
          piece: -1,
          shade: r < 0.6 ? 0 : r < 0.82 ? 1 : 2,
          gland: this.rand() < 0.55,
          gx: x + (this.rand() - 0.5) * CELL,
          gy: y + (this.rand() - 0.5) * CELL,
        });
        this.total++;
      }
    }
    this.attached = this.total;
  }

  get peeled() {
    return 1 - this.attached / this.total;
  }
  get pieceCount() {
    return this.pieces.length;
  }
  get longestCm() {
    let best = 0;
    for (const p of this.pieces) best = Math.max(best, p.path.length);
    return Math.round(best * STEP_PX * CM_PER_PX);
  }
  get holding() {
    return !!this.pull?.grabbing;
  }

  private idx(x: number, y: number) {
    const i = Math.floor((x - this.ox) / CELL);
    const j = Math.floor((y - this.oy) / CELL);
    if (i < 0 || j < 0 || i >= this.cols || j >= this.cols) return -1;
    return j * this.cols + i;
  }

  private forNear(x: number, y: number, rad: number, fn: (c: Cell, k: number, d: number) => void) {
    const i0 = Math.floor((x - rad - this.ox) / CELL);
    const i1 = Math.floor((x + rad - this.ox) / CELL);
    const j0 = Math.floor((y - rad - this.oy) / CELL);
    const j1 = Math.floor((y + rad - this.oy) / CELL);
    for (let j = Math.max(0, j0); j <= Math.min(this.cols - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(this.cols - 1, i1); i++) {
        const k = j * this.cols + i;
        const c = this.cells[k];
        if (!c) continue;
        const d = Math.hypot(c.x - x, c.y - y);
        if (d <= rad) fn(c, k, d);
      }
    }
  }

  private neighbours(k: number) {
    const i = k % this.cols;
    const j = (k - i) / this.cols;
    const out: Cell[] = [];
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= this.cols || jj >= this.cols) continue;
        const c = this.cells[jj * this.cols + ii];
        if (c) out.push(c);
      }
    return out;
  }

  /** Attached peel under (x, y), or -1. */
  peelAt(x: number, y: number) {
    if (Math.hypot(x - CX, y - CY) > R + 4) return -1;
    let best = -1;
    let bd = CELL * 0.95;
    this.forNear(x, y, CELL * 0.95, (c, k, d) => {
      if (c.att && d < bd) {
        bd = d;
        best = k;
      }
    });
    return best;
  }

  private threadAt(x: number, y: number) {
    let best = -1;
    let bd = 11;
    this.threads.forEach((t, i) => {
      for (let s = 0; s <= 6; s++) {
        const u = s / 6;
        const v = 1 - u;
        const px = v * v * t.x1 + 2 * v * u * t.qx + u * u * t.x2;
        const py = v * v * t.y1 + 2 * v * u * t.qy + u * u * t.y2;
        const d = Math.hypot(px - x, py - y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    });
    return best;
  }

  hover(x: number, y: number): "hand" | "peel" | "thread" | null {
    const p = this.pull;
    if (p && !p.grabbing && Math.hypot(x - p.hx, y - p.hy) < 34) return "hand";
    if (this.peelAt(x, y) >= 0) return "peel";
    if (this.threadAt(x, y) >= 0) return "thread";
    return null;
  }

  down(x: number, y: number): PeelEvent | null {
    const p = this.pull;
    if (p && !p.grabbing && Math.hypot(x - p.hx, y - p.hy) < 34) {
      p.grabbing = true;
      p.hx = x;
      p.hy = y;
      return "regrab";
    }
    const k = this.peelAt(x, y);
    if (k >= 0) {
      let abandoned = false;
      if (p) {
        this.finish(p.piece);
        this.pull = null;
        abandoned = true;
      }
      const first = !this.started;
      const edge = this.neighbours(k).some((c) => !c.att);
      this.startPiece(k, x, y);
      if (abandoned) return "abandon";
      return first ? "dig" : edge ? "start" : "dig-again";
    }
    const t = this.threadAt(x, y);
    if (t >= 0) {
      this.threads.splice(t, 1);
      this.picked++;
      return "pick";
    }
    return null;
  }

  move(x: number, y: number) {
    const p = this.pull;
    if (p && p.grabbing) {
      p.hx = clamp(x, 0, W);
      p.hy = clamp(y, 0, H);
    }
  }

  up(): PeelEvent | null {
    const p = this.pull;
    if (p && p.grabbing) {
      p.grabbing = false;
      return "release";
    }
    return null;
  }

  private startPiece(k: number, hx: number, hy: number) {
    const c = this.cells[k]!;
    const id = this.pieces.length;
    this.pieces.push({ cells: 0, path: [{ x: c.x, y: c.y }], done: false, px: 0, py: 0, rot: 0, pithUp: false, ox: 0, oy: 0 });
    this.started = true;
    let n = 0;
    this.forNear(c.x, c.y, 14, (cc) => {
      if (cc.att) {
        this.detach(cc, id);
        n++;
      }
    });
    const a = Math.atan2(c.y - CY, c.x - CX) + Math.PI / 2;
    this.pull = {
      piece: id,
      ax: c.x,
      ay: c.y,
      dax: c.x,
      day: c.y,
      hx,
      hy,
      grabbing: true,
      progress: 0,
      width: n,
      dx: Math.cos(a),
      dy: Math.sin(a),
      jitter: this.rand() * 6,
      sf: 0,
    };
    this.afterTear(id, c.x, c.y);
  }

  private detach(c: Cell, piece: number) {
    c.att = false;
    c.piece = piece;
    this.pieces[piece].cells++;
    this.attached--;
  }

  /** Bits of peel with almost nothing left holding them come along with the strip. */
  private afterTear(piece: number, x: number, y: number) {
    for (let pass = 0; pass < 2; pass++) {
      this.forNear(x, y, CELL * 3.2, (c, k) => {
        if (!c.att) return;
        let held = 0;
        for (const nb of this.neighbours(k)) if (nb.att) held++;
        if (held <= 2) this.detach(c, piece);
      });
    }
    // crumbs of peel cut off from the rest are not worth calling a piece
    this.forNear(x, y, CELL * 4.5, (c, k) => {
      if (!c.att) return;
      const crumb = this.crumb(k, 14);
      if (crumb) for (const q of crumb) this.detach(this.cells[q]!, piece);
    });
    if (!this.stemThreads && Math.hypot(x - CX, y - CY) < STRIP) {
      this.stemThreads = true;
      for (let i = 0; i < 3; i++) this.addThread(CX + (this.rand() - 0.5) * 10, CY + (this.rand() - 0.5) * 10);
    }
  }

  /** The attached patch around k if it has fewer than `cap` cells, else null. */
  private crumb(k: number, cap: number) {
    const seen = new Set([k]);
    const todo = [k];
    while (todo.length) {
      const q = todo.pop()!;
      const i = q % this.cols;
      const j = (q - i) / this.cols;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= this.cols || jj >= this.cols) continue;
          const nk = jj * this.cols + ii;
          if (seen.has(nk) || !this.cells[nk]?.att) continue;
          seen.add(nk);
          if (seen.size >= cap) return null;
          todo.push(nk);
        }
    }
    return [...seen];
  }

  private addThread(x: number, y: number) {
    if (Math.hypot(x - CX, y - CY) > R - 6) return;
    // pith strands run pole to pole, so from the top they point at the stem
    const a = Math.atan2(y - CY, x - CX) + (this.rand() - 0.5) * 0.7;
    const len = 12 + this.rand() * 24;
    const ux = Math.cos(a) * len * 0.5;
    const uy = Math.sin(a) * len * 0.5;
    const bend = (this.rand() - 0.5) * 9;
    this.threads.push({
      x1: x - ux,
      y1: y - uy,
      x2: x + ux,
      y2: y + uy,
      qx: x - Math.sin(a) * bend,
      qy: y + Math.cos(a) * bend,
      w: 1.3 + this.rand() * 1.1,
    });
  }

  private finish(id: number) {
    const pc = this.pieces[id];
    if (pc.done) return;
    pc.done = true;
    let sx = 0;
    let sy = 0;
    for (const q of pc.path) {
      sx += q.x;
      sy += q.y;
    }
    pc.ox = sx / pc.path.length;
    pc.oy = sy / pc.path.length;
    pc.rot = this.rand() * Math.PI * 2;
    pc.pithUp = this.rand() < 0.35;
    const slot = this.pieces.filter((q) => q.done).length - 1;
    if (slot < 8) {
      pc.px = 778 + (slot % 2) * 118 + (this.rand() - 0.5) * 16;
      pc.py = 160 + Math.floor(slot / 2) * 112 + (this.rand() - 0.5) * 14;
    } else {
      pc.px = 750 + this.rand() * 175;
      pc.py = 130 + this.rand() * 400;
    }
  }

  /** Tear one more step of peel in the direction of the pull. */
  private advance(): PeelEvent | null {
    const p = this.pull!;
    const piece = this.pieces[p.piece];
    let dx = p.hx - p.ax;
    let dy = p.hy - p.ay;
    const dl = Math.hypot(dx, dy) || 1;
    dx = 0.75 * (dx / dl) + 0.25 * p.dx;
    dy = 0.75 * (dy / dl) + 0.25 * p.dy;
    const nl = Math.hypot(dx, dy) || 1;
    dx /= nl;
    dy /= nl;
    let best: Cell | null = null;
    let bestK = -1;
    let bestScore = -Infinity;
    this.forNear(p.ax, p.ay, CELL * 3, (c, k, d) => {
      if (!c.att) return;
      const nbs = this.neighbours(k);
      if (!nbs.some((nb) => nb.piece === p.piece)) return;
      const dot = ((c.x - p.ax) * dx + (c.y - p.ay) * dy) / (d || 1);
      if (dot < -0.4) return;
      // peel tears more easily along an edge that is already free, so strips hug the last turn
      let open = 0;
      for (const nb of nbs) if (!nb.att) open++;
      const score = dot - (0.22 * d) / CELL + HUG * open;
      if (score > bestScore) {
        bestScore = score;
        best = c;
        bestK = k;
      }
    });
    if (!best || bestK < 0) {
      this.finish(p.piece);
      this.pull = null;
      return this.attached === 0 ? this.markClean() : "free";
    }
    const b: Cell = best;
    let n = 0;
    // near the edge the strip takes the rest of the way to the rim with it (that is the underside)
    const rb = Math.hypot(b.x - CX, b.y - CY);
    const rim = rb > R - 45;
    this.forNear(b.x, b.y, rim ? 30 : STRIP, (c, _k, d) => {
      if (c.att && (d <= STRIP || Math.hypot(c.x - CX, c.y - CY) > rb - 4)) {
        this.detach(c, p.piece);
        n++;
      }
    });
    this.afterTear(p.piece, b.x, b.y);
    if (this.rand() < 0.03 + 0.4 * p.sf * p.sf) this.addThread(b.x + (this.rand() - 0.5) * 14, b.y + (this.rand() - 0.5) * 14);
    p.dx = dx;
    p.dy = dy;
    p.ax = b.x;
    p.ay = b.y;
    p.width = n;
    piece.path.push({ x: b.x, y: b.y });
    if (this.attached > 0 && this.attached <= 4) {
      for (const c of this.cells) if (c && c.att) this.detach(c, p.piece);
    }
    if (this.attached === 0) {
      this.finish(p.piece);
      this.pull = null;
      return this.markClean();
    }
    if (!this.longSaid && piece.cells > this.total * 0.5) {
      this.longSaid = true;
      return "long";
    }
    return null;
  }

  private markClean(): PeelEvent {
    this.clean = true;
    return "clean";
  }

  /** Tear limit for the current pull, in px of stretch. */
  private limit(p: Pull) {
    let dx = p.hx - p.ax;
    let dy = p.hy - p.ay;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    const turn = dx * p.dx + dy * p.dy;
    // a fresh dig is held by the whole thumbnail-sized patch, not by the width of the strip yet
    const w = this.pieces[p.piece].path.length < 5 ? Math.max(p.width, 6) : p.width;
    const base = 20 + 3.6 * Math.min(w, 9) + p.jitter;
    return { lim: turn < -0.1 ? base * 0.62 : base, turn };
  }

  reachOf(p: Pull) {
    return Math.min(70, 14 + this.pieces[p.piece].cells * 0.9);
  }

  step(dt: number): PeelEvent[] {
    const out: PeelEvent[] = [];
    const p = this.pull;
    const f = clamp(dt, 0, 0.05) * 60;
    this.strain *= 0.8;
    if (p) {
      p.dax += (p.ax - p.dax) * Math.min(1, 0.35 * f);
      p.day += (p.ay - p.day) * Math.min(1, 0.35 * f);
    }
    if (p && p.grabbing) {
      const tension = Math.hypot(p.hx - p.ax, p.hy - p.ay) - this.reachOf(p);
      const { lim, turn } = this.limit(p);
      this.strain = clamp(tension / lim, 0, 1);
      if (tension > lim) {
        this.snapReason = p.width <= 2 && this.pieces[p.piece].path.length >= 5 ? "neck" : turn < -0.1 ? "turn" : "fast";
        const extra = 1 + Math.floor(this.rand() * 2);
        for (let i = 0; i < extra; i++) this.addThread(p.ax + (this.rand() - 0.5) * 16, p.ay + (this.rand() - 0.5) * 16);
        this.finish(p.piece);
        this.pull = null;
        out.push("snap");
      } else if (tension > 0) {
        const rate = Math.min(tension * 0.1, MAX_RATE);
        p.sf = p.sf * 0.8 + (rate / MAX_RATE) * 0.2;
        p.progress += rate * f;
        while (this.pull && p.progress >= STEP_PX) {
          p.progress -= STEP_PX;
          const ev = this.advance();
          if (ev) out.push(ev);
        }
      } else {
        p.sf *= 0.9;
        p.progress = Math.max(0, p.progress - 0.2 * f);
      }
    }
    // the last of the peel can also come away with a fresh dig or a crumb
    if (!this.clean && this.attached === 0) {
      if (this.pull) this.finish(this.pull.piece);
      this.pull = null;
      out.push(this.markClean());
    }
    return out;
  }

  result(time: number): PeelResult {
    return { pieces: this.pieceCount, threads: this.threads.length, picked: this.picked, time, longestCm: this.longestCm };
  }

  // ---------- drawing ----------

  draw(ctx: CanvasRenderingContext2D) {
    // plate
    ctx.save();
    ctx.fillStyle = "rgba(60,50,30,.07)";
    ctx.beginPath();
    ctx.ellipse(CX + 6, CY + 16, 262, 256, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FDFCF9";
    ctx.strokeStyle = "#E2DFD8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(CX, CY + 6, 258, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CX, CY + 6, 222, 0, Math.PI * 2);
    ctx.strokeStyle = "#EEEBE4";
    ctx.stroke();
    // fruit shadow
    ctx.fillStyle = "rgba(90,60,20,.13)";
    ctx.beginPath();
    ctx.ellipse(CX + 10, CY + 18, R + 2, R - 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // a napkin for the peel
    ctx.save();
    ctx.translate(838, 330);
    ctx.rotate(0.04);
    ctx.fillStyle = "rgba(60,50,30,.05)";
    ctx.fillRect(-128, -232, 262, 470);
    ctx.fillStyle = "#F3F0EA";
    ctx.strokeStyle = "#E2DFD8";
    ctx.lineWidth = 1.2;
    ctx.fillRect(-132, -238, 260, 466);
    ctx.strokeRect(-132, -238, 260, 466);
    ctx.beginPath();
    ctx.moveTo(-132, -5);
    ctx.lineTo(128, -5);
    ctx.strokeStyle = "#E9E5DD";
    ctx.stroke();
    ctx.restore();
    this.drawPile(ctx);

    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.clip();
    // flesh
    const fg = ctx.createRadialGradient(CX, CY, 10, CX, CY, R);
    fg.addColorStop(0, "#F7C27A");
    fg.addColorStop(1, "#EFA24A");
    ctx.fillStyle = fg;
    ctx.fillRect(CX - R, CY - R, 2 * R, 2 * R);
    ctx.strokeStyle = "rgba(255,238,212,.7)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let s = 0; s < 10; s++) {
      const a = this.segOffset + (s / 10) * Math.PI * 2 + Math.sin(s * 3.1) * 0.06;
      ctx.moveTo(CX, CY);
      ctx.quadraticCurveTo(CX + Math.cos(a + 0.05) * R * 0.5, CY + Math.sin(a + 0.05) * R * 0.5, CX + Math.cos(a) * R, CY + Math.sin(a) * R);
    }
    ctx.stroke();
    // pith strands
    ctx.strokeStyle = "#FBF5E8";
    ctx.lineCap = "round";
    for (const t of this.threads) {
      ctx.lineWidth = t.w;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.quadraticCurveTo(t.qx, t.qy, t.x2, t.y2);
      ctx.stroke();
    }
    // peel: a pale pith rim under each patch, then the rind
    ctx.fillStyle = PITH;
    ctx.beginPath();
    for (const c of this.cells) {
      if (!c || !c.att) continue;
      ctx.moveTo(c.x + BLOB + 2.4, c.y);
      ctx.arc(c.x, c.y, BLOB + 2.4, 0, Math.PI * 2);
    }
    ctx.fill();
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = ORANGES[s];
      ctx.beginPath();
      for (const c of this.cells) {
        if (!c || !c.att || c.shade !== s) continue;
        ctx.moveTo(c.x + BLOB, c.y);
        ctx.arc(c.x, c.y, BLOB, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.fillStyle = "rgba(170,70,10,.22)";
    ctx.beginPath();
    for (const c of this.cells) {
      if (!c || !c.att || !c.gland) continue;
      ctx.moveTo(c.gx + 1, c.gy);
      ctx.arc(c.gx, c.gy, 1, 0, Math.PI * 2);
    }
    ctx.fill();
    // stem
    const sk = this.idx(CX, CY);
    if (sk >= 0 && this.cells[sk]?.att) {
      ctx.fillStyle = "#6E7240";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = i % 2 ? 3 : 7;
        ctx.lineTo(CX + Math.cos(a) * r, CY + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
    // roundness
    const sh = ctx.createRadialGradient(CX - 70, CY - 80, 10, CX - 20, CY - 20, R * 1.35);
    sh.addColorStop(0, "rgba(255,255,255,.24)");
    sh.addColorStop(0.45, "rgba(255,255,255,0)");
    sh.addColorStop(1, "rgba(90,30,0,.3)");
    ctx.fillStyle = sh;
    ctx.fillRect(CX - R, CY - R, 2 * R, 2 * R);
    ctx.restore();

    this.drawStrip(ctx);
  }

  private drawPile(ctx: CanvasRenderingContext2D) {
    for (const pc of this.pieces) {
      if (!pc.done) continue;
      ctx.save();
      ctx.translate(pc.px, pc.py);
      ctx.rotate(pc.rot);
      ctx.scale(PILE_SCALE, PILE_SCALE);
      ctx.translate(-pc.ox, -pc.oy);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const trace = (dx: number, dy: number) => {
        ctx.beginPath();
        ctx.moveTo(pc.path[0].x + dx, pc.path[0].y + dy);
        if (pc.path.length === 1) ctx.lineTo(pc.path[0].x + dx + 0.1, pc.path[0].y + dy);
        for (const q of pc.path) ctx.lineTo(q.x + dx, q.y + dy);
        ctx.stroke();
      };
      ctx.strokeStyle = "rgba(60,40,10,.12)";
      ctx.lineWidth = 26;
      trace(5, 8);
      ctx.strokeStyle = "#E47A24";
      ctx.lineWidth = 26;
      trace(0, 0);
      if (pc.pithUp) {
        ctx.strokeStyle = PITH;
        ctx.lineWidth = 18;
        trace(0, 0);
      }
      ctx.restore();
    }
  }

  private drawStrip(ctx: CanvasRenderingContext2D) {
    const p = this.pull;
    if (!p) return;
    const ax = p.dax;
    const ay = p.day;
    const d = Math.hypot(p.hx - ax, p.hy - ay) || 1;
    const reach = this.reachOf(p);
    const nx = -(p.hy - ay) / d;
    const ny = (p.hx - ax) / d;
    const side = nx * p.dx + ny * p.dy > 0 ? -1 : 1;
    const sag = Math.max(0, reach - d) * 0.55 + 5;
    const mx = (ax + p.hx) / 2 + nx * sag * side;
    const my = (ay + p.hy) / 2 + ny * sag * side;
    const w = (12 + Math.min(p.width, 9) * 1.6) * (1 - 0.35 * this.strain);
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(60,40,10,.14)";
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(ax + 4, ay + 9);
    ctx.quadraticCurveTo(mx + 6, my + 12, p.hx + 7, p.hy + 14);
    ctx.stroke();
    ctx.strokeStyle = "#E07A22";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(mx, my, p.hx, p.hy);
    ctx.stroke();
    ctx.strokeStyle = PITH;
    ctx.lineWidth = Math.max(2, w - 7);
    ctx.stroke();
    if (this.strain > 0.55) {
      // white stretch marks right where it is about to go
      ctx.strokeStyle = `rgba(255,255,255,${(this.strain - 0.55) * 2})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(ax + nx * i * 6, ay + ny * i * 6);
        ctx.lineTo(ax + nx * i * 6 + (p.hx - ax) * 0.14, ay + ny * i * 6 + (p.hy - ay) * 0.14);
      }
      ctx.stroke();
    }
    // the part already pulled off, bunched up in the hand
    const steps = this.pieces[p.piece].path.length;
    if (steps > 4) {
      const s = Math.min(26, 5 + Math.sqrt(steps) * 1.5);
      ctx.fillStyle = "#E47A24";
      ctx.beginPath();
      ctx.arc(p.hx, p.hy, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PITH;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.hx + 1, p.hy - 1, s * 0.62, 0.4, 4.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.hx - 2, p.hy + 1, s * 0.3, 2, 6);
      ctx.stroke();
    }
    if (!p.grabbing) {
      ctx.strokeStyle = "rgba(28,28,26,.35)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(p.hx, p.hy, Math.max(16, Math.min(30, 9 + Math.sqrt(steps) * 1.5)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

export function peelTier(r: Pick<PeelResult, "pieces" | "threads">) {
  if (r.pieces === 1 && r.threads === 0) return { tier: "Clementine whisperer", line: "One piece, no white bits. Nobody is going to believe you." };
  if (r.pieces === 1)
    return {
      tier: "One piece",
      line: r.threads > 30 ? "The peel is perfect. The fruit looks like it walked through a cobweb." : "One continuous peel. Lay it out and admire it.",
    };
  if (r.pieces <= 3) return { tier: "Nearly", line: "Close enough to call it one piece, as long as nobody checks the table." };
  if (r.pieces <= 8) return { tier: "Normal person", line: "A normal pile of peel next to a normal clementine." };
  return { tier: "Confetti", line: "You did not so much peel it as take it apart." };
}

/** Run a calm, scripted peel (outward spiral from the stem) for the hub thumbnail. */
export function demoPeel(seed: number, upTo: number) {
  const g = new Peel(seed);
  let hx = CX + 3;
  let hy = CY + 3;
  g.down(hx, hy);
  for (let i = 0; i < 4000 && g.pull && g.peeled < upTo; i++) {
    const p = g.pull;
    // aim a little ahead along the turn, at a steady hand speed
    const r = Math.max(25, Math.hypot(p.ax - CX, p.ay - CY));
    const a = Math.atan2(p.ay - CY, p.ax - CX);
    const ch = g.reachOf(p) + 22;
    const phi = Math.min(0.5, Math.asin(Math.min(1, ch / (2 * r))));
    const tx = p.ax + ch * (-Math.sin(a) * Math.cos(phi) - Math.cos(a) * Math.sin(phi));
    const ty = p.ay + ch * (Math.cos(a) * Math.cos(phi) - Math.sin(a) * Math.sin(phi));
    const d = Math.hypot(tx - hx, ty - hy);
    if (d > 0) {
      hx += ((tx - hx) / d) * Math.min(d, 2.4);
      hy += ((ty - hy) / d) * Math.min(d, 2.4);
    }
    g.move(hx, hy);
    g.step(1 / 60);
  }
  return g;
}
