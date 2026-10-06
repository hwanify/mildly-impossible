// "Peel a Clementine in One Piece": top view of a clementine on a plate. Pure module, SSR safe.
// The peel is a grid of small cells over the fruit. Pulling tears cells off at the front of a
// strip, one small cluster at a time, but the peel only tears so fast: pull faster than that,
// turn too sharply or pull through a narrow neck and the strip snaps off.
// Your cursor is the tear: the front follows it as fast as the peel allows, and what has come off
// trails behind it as a real strip (a chain of nodes with height) hanging off the fruit.
export const W = 1000;
export const H = 640;
const CX = 400;
const CY = 318;
const R = 205;
const CELL = 12;
const BLOB = CELL * 0.85;
const STRIP = 17; // radius of peel that comes off with each step of the tear
const STEP_PX = CELL * 0.8; // pulled length per step
const CM_PER_PX = 0.02;
const HUG = 0.07;
const PILE_SCALE = 0.36;
const TAIL_LIFT = 24; // how high the torn end is lifted while you hold it
const LIFT_DRAW = 0.45; // on screen, things that are higher sit a little further up
const GRAV = 0.42;
const NAPKIN = { x: 838, y: 330, rot: 0.04 };

export type PeelEvent = "dig" | "dig-again" | "start" | "snap" | "free" | "release" | "regrab" | "clean" | "pick" | "long" | "tear";
export type SnapReason = "fast" | "turn" | "neck";
export type FruitKind = "tight" | "normal" | "loose";
export type PeelResult = { pieces: number; threads: number; picked: number; time: number; longestCm: number; kind: FruitKind };

const KINDS: Record<FruitKind, { rate: number; lim: number; threads: number; len: number }> = {
  tight: { rate: 2.2, lim: -3, threads: 0.8, len: 0.8 },
  normal: { rate: 2.6, lim: 0, threads: 1, len: 1 },
  loose: { rate: 3.0, lim: 5, threads: 1.6, len: 1.35 },
};

type Cell = { x: number; y: number; att: boolean; piece: number; shade: number; gland: boolean; gx: number; gy: number };
type Thread = { x1: number; y1: number; qx: number; qy: number; x2: number; y2: number; w: number };
type PathPt = { x: number; y: number; w: number };
type Node = { x: number; y: number; z: number; px: number; py: number; pz: number; rest: number; w: number };
type Piece = {
  id: number;
  cells: number;
  path: PathPt[];
  nodes: Node[];
  state: "hanging" | "falling" | "done";
  fall: number;
  // the tear front
  ax: number;
  ay: number;
  dx: number;
  dy: number;
  width: number;
  jitter: number;
  progress: number;
  sf: number; // how close to the tear limit the pull runs, 0..1
  // where it ends up on the napkin
  px: number;
  py: number;
  rot: number;
  ox: number;
  oy: number;
};
type Grip = { piece: number; hx: number; hy: number };
type Tug = { i: number; x: number; y: number };
type Drop = { x: number; y: number; vx: number; vy: number; life: number; r: number };

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

const PITH = "#F5E9D2";
const RIND = "#EC8A34";
const RIND_EDGE = "#D7731F";

export class Peel {
  rand: () => number;
  kind: FruitKind;
  cells: (Cell | null)[] = [];
  cols: number;
  total = 0;
  attached = 0;
  threads: Thread[] = [];
  pieces: Piece[] = [];
  grip: Grip | null = null;
  tug: Tug | null = null;
  drops: Drop[] = [];
  started = false;
  clean = false;
  picked = 0;
  strain = 0;
  snapReason: SnapReason = "fast";
  longSaid = false;
  stemThreads = false;
  segOffset: number;
  private oranges: string[];
  private ox = CX - R - CELL;
  private oy = CY - R - CELL;

  constructor(seed: number) {
    this.rand = rng(seed);
    const k = this.rand();
    this.kind = k < 0.3 ? "tight" : k < 0.7 ? "normal" : "loose";
    // a loose one is a little duller and puffier, a tight one shinier
    this.oranges = this.kind === "loose" ? ["#E3812D", "#DE7A28", "#E78831"] : this.kind === "tight" ? ["#EE8A2C", "#EA8227", "#F19334"] : ["#E9852D", "#E57F28", "#EC8B33"];
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
  get hangingCount() {
    return this.pieces.filter((p) => p.state === "hanging").length;
  }
  get longestCm() {
    let best = 0;
    for (const p of this.pieces) best = Math.max(best, p.path.length);
    return Math.round(best * STEP_PX * CM_PER_PX);
  }
  get holding() {
    return !!this.grip || !!this.tug;
  }
  /** The strip in your hand, if any. */
  get active(): Piece | null {
    return this.grip ? this.pieces[this.grip.piece] : null;
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

  /** The torn end of a hanging strip near (x, y): that is where you pick it back up. */
  private frontAt(x: number, y: number) {
    let best: Piece | null = null;
    let bd = 30;
    for (const pc of this.pieces) {
      if (pc.state !== "hanging") continue;
      const n = pc.nodes[pc.nodes.length - 1];
      const d = Math.hypot(n.x - x, n.y - n.z * LIFT_DRAW - y);
      if (d < bd) {
        bd = d;
        best = pc;
      }
    }
    return best;
  }

  private threadPoint(t: Thread, u: number) {
    const v = 1 - u;
    return { x: v * v * t.x1 + 2 * v * u * t.qx + u * u * t.x2, y: v * v * t.y1 + 2 * v * u * t.qy + u * u * t.y2 };
  }

  private threadAt(x: number, y: number) {
    let best = -1;
    let bd = 11;
    this.threads.forEach((t, i) => {
      for (let s = 0; s <= 8; s++) {
        const p = this.threadPoint(t, s / 8);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    });
    return best;
  }

  hover(x: number, y: number): "strip" | "peel" | "thread" | null {
    if (this.frontAt(x, y)) return "strip";
    if (this.peelAt(x, y) >= 0) return "peel";
    if (this.threadAt(x, y) >= 0) return "thread";
    return null;
  }

  down(x: number, y: number): PeelEvent | null {
    const hit = this.frontAt(x, y);
    if (hit) {
      this.grip = { piece: hit.id, hx: x, hy: y };
      return "regrab";
    }
    const k = this.peelAt(x, y);
    if (k >= 0) {
      const first = !this.started;
      const edge = this.neighbours(k).some((c) => !c.att);
      this.startPiece(k, x, y);
      return first ? "dig" : edge ? "start" : "dig-again";
    }
    const t = this.threadAt(x, y);
    if (t >= 0) this.tug = { i: t, x, y };
    return null;
  }

  move(x: number, y: number): PeelEvent | null {
    if (this.grip) {
      this.grip.hx = clamp(x, 0, W);
      this.grip.hy = clamp(y, 0, H);
    }
    const tg = this.tug;
    if (tg) {
      tg.x = x;
      tg.y = y;
      const t = this.threads[tg.i];
      const m = this.threadPoint(t, 0.5);
      // a strand stretches a little, then lets go of the fruit
      if (Math.hypot(x - m.x, y - m.y) > 18) {
        this.threads.splice(tg.i, 1);
        this.tug = null;
        this.picked++;
        return "pick";
      }
    }
    return null;
  }

  up(): PeelEvent | null {
    if (this.tug) {
      this.tug = null;
      return null;
    }
    if (this.grip) {
      this.grip = null;
      return "release";
    }
    return null;
  }

  private node(x: number, y: number, rest: number, w: number): Node {
    return { x, y, z: 0, px: x, py: y, pz: 0, rest, w };
  }

  private startPiece(k: number, hx: number, hy: number) {
    const c = this.cells[k]!;
    const id = this.pieces.length;
    const a = Math.atan2(c.y - CY, c.x - CX) + Math.PI / 2;
    const pc: Piece = {
      id,
      cells: 0,
      path: [{ x: c.x, y: c.y, w: 22 }],
      nodes: [this.node(c.x, c.y, 0, 22)],
      state: "hanging",
      fall: 0,
      ax: c.x,
      ay: c.y,
      dx: Math.cos(a),
      dy: Math.sin(a),
      width: 0,
      jitter: this.rand() * 6,
      progress: 0,
      sf: 0,
      px: 0,
      py: 0,
      rot: 0,
      ox: 0,
      oy: 0,
    };
    this.pieces.push(pc);
    this.started = true;
    let n = 0;
    this.forNear(c.x, c.y, 14, (cc) => {
      if (cc.att) {
        this.detach(cc, id);
        n++;
      }
    });
    pc.width = n;
    this.grip = { piece: id, hx, hy };
    // a fine citrus mist
    for (let i = 0; i < 14; i++) {
      const ang = this.rand() * Math.PI * 2;
      const sp = 1 + this.rand() * 3.2;
      this.drops.push({ x: c.x, y: c.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.2, life: 1, r: 1 + this.rand() * 1.8 });
    }
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
      // the white core at the stem, where every strand starts
      this.stemThreads = true;
      for (let i = 0; i < 4; i++) {
        const a = this.rand() * Math.PI * 2;
        this.addThread(CX + Math.cos(a) * 22, CY + Math.sin(a) * 22, 1.4);
      }
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

  private addThread(x: number, y: number, scale = 1) {
    if (Math.hypot(x - CX, y - CY) > R - 6) return;
    // pith strands run pole to pole, so from the top they point at the stem
    const a = Math.atan2(y - CY, x - CX) + (this.rand() - 0.5) * 0.5;
    const len = (18 + this.rand() * 40) * KINDS[this.kind].len * scale;
    const ux = Math.cos(a) * len * 0.5;
    const uy = Math.sin(a) * len * 0.5;
    const bend = (this.rand() - 0.5) * 12;
    this.threads.push({
      x1: x - ux,
      y1: y - uy,
      x2: x + ux,
      y2: y + uy,
      qx: x - Math.sin(a) * bend,
      qy: y + Math.cos(a) * bend,
      w: 1.1 + this.rand() * 1.2,
    });
  }

  /** The strip comes away from the fruit (or the hand) and drops. */
  private drop(pc: Piece) {
    if (pc.state !== "hanging") return;
    pc.state = "falling";
    pc.fall = 50;
    if (this.grip?.piece === pc.id) this.grip = null;
  }

  /** Done falling: it goes on the napkin, laid out the way it came off the fruit. */
  private settle(pc: Piece) {
    pc.state = "done";
    let sx = 0;
    let sy = 0;
    for (const q of pc.path) {
      sx += q.x;
      sy += q.y;
    }
    pc.ox = sx / pc.path.length;
    pc.oy = sy / pc.path.length;
    pc.rot = this.rand() * Math.PI * 2;
    const slot = this.pieces.filter((q) => q.state === "done").length - 1;
    if (slot < 8) {
      pc.px = 778 + (slot % 2) * 118 + (this.rand() - 0.5) * 16;
      pc.py = 160 + Math.floor(slot / 2) * 112 + (this.rand() - 0.5) * 14;
    } else {
      pc.px = 750 + this.rand() * 175;
      pc.py = 130 + this.rand() * 400;
    }
  }

  /** Tear one more step of peel in the direction of the pull. */
  private advance(pc: Piece, out: PeelEvent[]) {
    const g = this.grip!;
    const kind = KINDS[this.kind];
    let dx = g.hx - pc.ax;
    let dy = g.hy - pc.ay;
    const dl = Math.hypot(dx, dy) || 1;
    dx = 0.75 * (dx / dl) + 0.25 * pc.dx;
    dy = 0.75 * (dy / dl) + 0.25 * pc.dy;
    const nl = Math.hypot(dx, dy) || 1;
    dx /= nl;
    dy /= nl;
    let best: Cell | null = null;
    let bestScore = -Infinity;
    let stuck = false;
    const gap = Math.hypot(g.hx - pc.ax, g.hy - pc.ay);
    this.forNear(pc.ax, pc.ay, CELL * 3, (c, k, d) => {
      if (!c.att) return;
      const nbs = this.neighbours(k);
      if (!nbs.some((nb) => nb.piece === pc.id)) return;
      stuck = true;
      const dot = ((c.x - pc.ax) * dx + (c.y - pc.ay) * dy) / (d || 1);
      if (dot < -0.75) return;
      // peel tears more easily along an edge that is already free, so strips hug the last turn,
      // and it tears towards the cursor rather than past it
      let open = 0;
      for (const nb of nbs) if (!nb.att) open++;
      const toCursor = Math.hypot(c.x - g.hx, c.y - g.hy);
      // every step of the tear has to close in on the cursor, never run off ahead of it
      if (toCursor > gap - 2) return;
      const score = dot - (0.22 * d) / CELL + HUG * open - (0.25 * toCursor) / CELL;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    });
    if (!best) {
      // still attached, just not in the direction you are pulling: wait for you to steer
      if (stuck) {
        pc.progress = 0;
        return;
      }
      this.drop(pc);
      out.push("free");
      return;
    }
    const b: Cell = best;
    let n = 0;
    // near the edge the strip takes the rest of the way to the rim with it (that is the underside)
    const rb = Math.hypot(b.x - CX, b.y - CY);
    const rim = rb > R - 45;
    this.forNear(b.x, b.y, rim ? 30 : STRIP, (c, _k, d) => {
      if (c.att && (d <= STRIP || Math.hypot(c.x - CX, c.y - CY) > rb - 4)) {
        this.detach(c, pc.id);
        n++;
      }
    });
    this.afterTear(pc.id, b.x, b.y);
    if (this.rand() < (0.03 + 0.4 * pc.sf * pc.sf) * kind.threads) this.addThread(b.x + (this.rand() - 0.5) * 14, b.y + (this.rand() - 0.5) * 14);
    const w = 18 + Math.min(n, 9) * 1.8;
    const last = pc.nodes[pc.nodes.length - 1];
    pc.nodes.push(this.node(b.x, b.y, Math.max(6, Math.hypot(b.x - last.x, b.y - last.y)), w));
    pc.dx = dx;
    pc.dy = dy;
    pc.ax = b.x;
    pc.ay = b.y;
    pc.width = n;
    pc.path.push({ x: b.x, y: b.y, w });
    out.push("tear");
    if (this.attached > 0 && this.attached <= 4) {
      for (const c of this.cells) if (c && c.att) this.detach(c, pc.id);
    }
    if (!this.longSaid && pc.cells > this.total * 0.5) {
      this.longSaid = true;
      out.push("long");
    }
  }

  /** Tear limit for the current pull, in px of stretch. */
  private limit(pc: Piece, g: Grip) {
    let dx = g.hx - pc.ax;
    let dy = g.hy - pc.ay;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    const turn = dx * pc.dx + dy * pc.dy;
    // a fresh dig is held by the whole thumbnail-sized patch, not by the width of the strip yet
    const w = pc.path.length < 5 ? Math.max(pc.width, 6) : pc.width;
    const base = 26 + KINDS[this.kind].lim + 3.6 * Math.min(w, 9) + pc.jitter;
    // a sharp turn only counts once you are actually pulling, not while the cursor sits on the tear
    const sharp = turn < -0.1 && dl > 22;
    return { lim: sharp ? base * 0.62 : base, turn: sharp ? turn : 1 };
  }

  /** Is there still peel attached next to this tear front? */
  private holdsAt(x: number, y: number) {
    let held = false;
    this.forNear(x, y, CELL * 3, (c) => {
      if (c.att) held = true;
    });
    return held;
  }

  step(dt: number): PeelEvent[] {
    const out: PeelEvent[] = [];
    const f = clamp(dt, 0, 0.05) * 60;
    this.strain *= 0.8;
    const g = this.grip;
    const pc = this.active;
    if (g && pc && pc.state === "hanging") {
      // the tear follows the cursor; the gap between them is the stretch
      const tension = Math.hypot(g.hx - pc.ax, g.hy - pc.ay);
      const { lim, turn } = this.limit(pc, g);
      this.strain = clamp(tension / lim, 0, 1);
      if (tension > lim) {
        this.snapReason = pc.width <= 2 && pc.path.length >= 5 ? "neck" : turn < -0.1 ? "turn" : "fast";
        const extra = 1 + Math.floor(this.rand() * 2);
        for (let i = 0; i < extra; i++) this.addThread(pc.ax + (this.rand() - 0.5) * 16, pc.ay + (this.rand() - 0.5) * 16);
        this.drop(pc);
        out.push("snap");
      } else if (tension > 0) {
        const max = KINDS[this.kind].rate;
        const rate = Math.min(tension * 0.15, max);
        pc.sf = pc.sf * 0.8 + (rate / max) * 0.2;
        pc.progress += rate * f;
        while (this.grip && pc.state === "hanging" && pc.progress >= STEP_PX) {
          pc.progress -= STEP_PX;
          this.advance(pc, out);
        }
      } else {
        pc.sf *= 0.9;
        pc.progress = Math.max(0, pc.progress - 0.2 * f);
      }
    }
    // a strip whose last bit of attached peel went with another strip just falls off
    for (const q of this.pieces) {
      if (q.state === "hanging" && this.attached > 0 && !this.holdsAt(q.ax, q.ay)) {
        this.drop(q);
        out.push("free");
      }
    }
    if (!this.clean && this.attached === 0) {
      for (const q of this.pieces) this.drop(q);
      this.grip = null;
      this.clean = true;
      out.push("clean");
    }
    for (const q of this.pieces) {
      if (q.state === "done") continue;
      this.simulate(q, f);
      if (q.state === "falling" && (q.fall -= f) <= 0) this.settle(q);
    }
    for (const d of this.drops) {
      d.x += d.vx * f;
      d.y += d.vy * f;
      d.vy += 0.12 * f;
      d.life -= 0.035 * f;
    }
    this.drops = this.drops.filter((d) => d.life > 0);
    return out;
  }

  /** Verlet rope: gravity, the dome of the fruit shrugging things off its sides, friction where it lies. */
  private simulate(pc: Piece, f: number) {
    const ns = pc.nodes;
    const g = this.grip && this.grip.piece === pc.id ? this.grip : null;
    const hanging = pc.state === "hanging";
    const last = ns.length - 1;
    const pin = () => {
      if (!hanging) return;
      const fr = ns[last];
      if (g) {
        // held: the torn end sits under the cursor, lifted a little, and the rest trails behind
        fr.x = g.hx;
        fr.y = g.hy + TAIL_LIFT * LIFT_DRAW;
        fr.z = TAIL_LIFT;
      } else {
        fr.x = pc.ax;
        fr.y = pc.ay;
        fr.z = 0;
      }
    };
    const subs = f > 1.5 ? 2 : 1;
    for (let s = 0; s < subs; s++) {
      for (const n of ns) {
        let vx = (n.x - n.px) * 0.985;
        let vy = (n.y - n.py) * 0.985;
        const vz = (n.z - n.pz) * 0.985;
        n.px = n.x;
        n.py = n.y;
        n.pz = n.z;
        if (n.z <= 0.5) {
          vx *= 0.8;
          vy *= 0.8;
          const dx = n.x - CX;
          const dy = n.y - CY;
          const r = Math.hypot(dx, dy);
          if (r < R && r > 1) {
            const sl = 0.3 * (r / R);
            vx += (dx / r) * sl;
            vy += (dy / r) * sl;
          }
        }
        n.x += vx;
        n.y += vy;
        n.z += vz - GRAV;
        if (n.z < 0) n.z = 0;
      }
      pin();
      for (let it = 0; it < 10; it++) {
        for (let i = 1; i < ns.length; i++) this.link(ns[i - 1], ns[i], ns[i].rest, false);
        // peel is stiff: it curls but does not fold flat on itself
        for (let i = 2; i < ns.length; i++) this.link(ns[i - 2], ns[i], (ns[i].rest + ns[i - 1].rest) * 0.8, true);
        for (const n of ns) if (n.z < 0) n.z = 0;
        pin();
      }
    }
  }

  private link(a: Node, b: Node, rest: number, minOnly: boolean) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dy, dz) || 0.001;
    if (minOnly && d >= rest) return;
    const k = ((d - rest) / d) * 0.5;
    a.x += dx * k;
    a.y += dy * k;
    a.z += dz * k;
    b.x -= dx * k;
    b.y -= dy * k;
    b.z -= dz * k;
  }

  result(time: number): PeelResult {
    for (const q of this.pieces) if (q.state === "falling") this.settle(q);
    return { pieces: this.pieceCount, threads: this.threads.length, picked: this.picked, time, longestCm: this.longestCm, kind: this.kind };
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

    this.drawNapkin(ctx);

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
    this.threads.forEach((t, i) => {
      ctx.lineWidth = t.w;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      if (this.tug && this.tug.i === i) {
        // stretched up off the fruit by your fingers
        ctx.quadraticCurveTo(this.tug.x, this.tug.y, t.x2, t.y2);
        ctx.stroke();
        ctx.lineWidth = t.w * 0.7;
        ctx.strokeStyle = "rgba(255,255,255,.9)";
      } else ctx.quadraticCurveTo(t.qx, t.qy, t.x2, t.y2);
      ctx.stroke();
      ctx.strokeStyle = "#FBF5E8";
    });
    // peel: a pale pith rim under each patch, then the rind
    ctx.fillStyle = PITH;
    ctx.beginPath();
    for (const c of this.cells) {
      if (!c || !c.att) continue;
      ctx.moveTo(c.x + BLOB + 1.4, c.y);
      ctx.arc(c.x, c.y, BLOB + 1.4, 0, Math.PI * 2);
    }
    ctx.fill();
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = this.oranges[s];
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

    this.drawStrips(ctx);

    // mist
    for (const d of this.drops) {
      ctx.fillStyle = `rgba(255,176,70,${d.life * 0.7})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawNapkin(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(NAPKIN.x, NAPKIN.y);
    ctx.rotate(NAPKIN.rot);
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
    for (const pc of this.pieces) {
      if (pc.state !== "done") continue;
      ctx.save();
      ctx.translate(pc.px, pc.py);
      ctx.rotate(pc.rot);
      ctx.scale(PILE_SCALE, PILE_SCALE);
      ctx.translate(-pc.ox, -pc.oy);
      drawLaidOut(ctx, pc);
      ctx.restore();
    }
  }

  /** Every strip still on the fruit or on its way down, the lower ones first. */
  private drawStrips(ctx: CanvasRenderingContext2D) {
    const live = this.pieces.filter((pc) => pc.state !== "done");
    if (!live.length) return;
    const avgZ = (pc: Piece) => pc.nodes.reduce((a, n) => a + n.z, 0) / pc.nodes.length;
    live.sort((a, b) => avgZ(a) - avgZ(b));
    ctx.save();
    // shadows: the higher a bit is, the further its shadow falls
    for (const pc of live) {
      const pts = pc.nodes.map((n) => ({ x: n.x + 3 + n.z * 0.35, y: n.y + 5 + n.z * 0.3 }));
      strokeRibbon(ctx, pts, stripWidth(pc), "rgba(60,40,10,.13)");
    }
    for (const pc of live) {
      const pts = pc.nodes.map((n) => ({ x: n.x, y: n.y - n.z * LIFT_DRAW }));
      const lift = avgZ(pc);
      strokeRibbon(ctx, pts, stripWidth(pc) * (1 + lift * 0.003), null);
    }
    const pc = this.active;
    if (pc && this.strain > 0.55) {
      // white stretch marks right where it is about to go
      const g = this.grip!;
      const d = Math.hypot(g.hx - pc.ax, g.hy - pc.ay) || 1;
      const nx = -(g.hy - pc.ay) / d;
      const ny = (g.hx - pc.ax) / d;
      ctx.strokeStyle = `rgba(255,255,255,${(this.strain - 0.55) * 2})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(pc.ax + nx * i * 6, pc.ay + ny * i * 6);
        ctx.lineTo(pc.ax + nx * i * 6 + (g.hx - pc.ax) * 0.14, pc.ay + ny * i * 6 + (g.hy - pc.ay) * 0.14);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** All the peel, laid out flat in a w x h box, for the result card. */
  drawTrophy(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const done = this.pieces.filter((p) => p.state === "done");
    if (!done.length) return;
    const boxes = done.map((pc) => {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      const c = Math.cos(pc.rot);
      const s = Math.sin(pc.rot);
      for (const q of pc.path) {
        const x = (q.x - pc.ox) * c - (q.y - pc.oy) * s;
        const y = (q.x - pc.ox) * s + (q.y - pc.oy) * c;
        x0 = Math.min(x0, x - 14);
        y0 = Math.min(y0, y - 14);
        x1 = Math.max(x1, x + 14);
        y1 = Math.max(y1, y + 14);
      }
      return { pc, x0, y0, x1, y1 };
    });
    // same scale for every piece, so crumbs look like crumbs
    let sc = 0.55;
    let spots: { x: number; y: number }[] = [];
    for (let tries = 0; tries < 40; tries++, sc *= 0.9) {
      spots = [];
      let x = 0;
      let y = 0;
      let row = 0;
      let ok = true;
      for (const b of boxes) {
        const bw = (b.x1 - b.x0) * sc;
        const bh = (b.y1 - b.y0) * sc;
        if (x > 0 && x + bw > w) {
          x = 0;
          y += row + 6;
          row = 0;
        }
        if (bw > w || y + bh > h) ok = false;
        spots.push({ x: x - b.x0 * sc, y: y - b.y0 * sc });
        x += bw + 6;
        row = Math.max(row, bh);
      }
      if (ok && y + row <= h) {
        // centre the whole arrangement
        let maxX = 0;
        boxes.forEach((b, i) => (maxX = Math.max(maxX, spots[i].x + b.x1 * sc)));
        const offX = (w - maxX) / 2;
        const offY = (h - (y + row)) / 2;
        spots = spots.map((p) => ({ x: p.x + offX, y: p.y + offY }));
        break;
      }
    }
    boxes.forEach((b, i) => {
      ctx.save();
      ctx.translate(spots[i].x, spots[i].y);
      ctx.scale(sc, sc);
      ctx.rotate(b.pc.rot);
      ctx.translate(-b.pc.ox, -b.pc.oy);
      drawLaidOut(ctx, b.pc);
      ctx.restore();
    });
  }
}

/** A piece of peel as it lies flat: the strip it was torn as, rind up. */
function drawLaidOut(ctx: CanvasRenderingContext2D, pc: Piece) {
  const w = stripWidth(pc);
  strokeRibbon(ctx, pc.path.map((q) => ({ x: q.x + 5, y: q.y + 8 })), w, "rgba(60,40,10,.12)");
  strokeRibbon(ctx, pc.path, w, null);
}

function stripWidth(pc: Piece) {
  const ws = pc.path.map((q) => q.w).sort((a, b) => a - b);
  return ws[Math.floor(ws.length / 2)];
}

/** Draw a run of points as one smooth strip, through the midpoints so the joins do not show. */
function tracePath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], from: number, to: number) {
  ctx.beginPath();
  ctx.moveTo(pts[from].x, pts[from].y);
  if (to === from) {
    ctx.lineTo(pts[from].x + 0.1, pts[from].y);
    return;
  }
  for (let i = from + 1; i < to; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[to].x, pts[to].y);
}

/** A strip of peel: darker rind edge, rind face with oil glands. With `flat` set, one colour (shadows). */
function strokeRibbon(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], w: number, flat: string | null) {
  if (!pts.length) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const n = pts.length - 1;
  ctx.strokeStyle = flat ?? RIND_EDGE;
  ctx.lineWidth = w;
  tracePath(ctx, pts, 0, n);
  ctx.stroke();
  if (flat) return;
  ctx.strokeStyle = RIND;
  ctx.lineWidth = Math.max(2, w - 6);
  tracePath(ctx, pts, 0, n);
  ctx.stroke();
  ctx.fillStyle = "rgba(170,70,10,.25)";
  for (let k = 0; k < n; k++) {
    ctx.beginPath();
    ctx.arc((pts[k].x + pts[k + 1].x) / 2 + 2, (pts[k].y + pts[k + 1].y) / 2 - 2, 1, 0, Math.PI * 2);
    ctx.arc(pts[k].x - 3, pts[k].y + 3, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function peelTier(r: Pick<PeelResult, "pieces" | "threads">) {
  if (r.pieces === 1 && r.threads === 0) return { tier: "Clementine whisperer", line: "One piece, no white bits. Nobody is going to believe you." };
  if (r.pieces === 1)
    return {
      tier: "One piece",
      line: r.threads > 30 ? "The peel is perfect. The fruit looks like it walked through a cobweb." : "One continuous peel. Lay it out and admire it.",
    };
  if (r.pieces <= 3) return { tier: "Nearly", line: "Close enough to call it one piece, as long as nobody checks the napkin." };
  if (r.pieces <= 8) return { tier: "Normal person", line: "A normal pile of peel next to a normal clementine." };
  return { tier: "Confetti", line: "You did not so much peel it as take it apart." };
}

/** Run a calm, scripted peel for the hub thumbnail: follow the edge of the peel, like a person would. */
export function demoPeel(seed: number, upTo: number) {
  const g = new Peel(seed);
  let hx = CX + 3;
  let hy = CY + 3;
  g.down(hx, hy);
  for (let i = 0; i < 4000 && g.active && g.peeled < upTo; i++) {
    const p = g.active;
    // aim at the attached peel just ahead of the tear, at a steady hand speed
    let tx = p.ax + p.dx * 12;
    let ty = p.ay + p.dy * 12;
    let best = -Infinity;
    for (const c of g.cells) {
      if (!c || !c.att) continue;
      const d = Math.hypot(c.x - p.ax, c.y - p.ay);
      if (d > 40 || d < 6) continue;
      const sc = ((c.x - p.ax) * p.dx + (c.y - p.ay) * p.dy) / d - d / 80;
      if (sc > best) {
        best = sc;
        tx = c.x;
        ty = c.y;
      }
    }
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
