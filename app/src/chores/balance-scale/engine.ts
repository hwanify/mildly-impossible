// "Balance the Scale": a big beam balance in the middle of the room. Drag things from the tray onto
// either pan, from an ant to a blue whale. Every single thing weighs a little differently from the
// last one of its kind, nothing shows its exact weight, and "level" means within half an ant.
// Pure module, SSR safe (no globals at top level).
export const W = 1000;
export const H = 640;

const PIVOT = { x: 500, y: 168 };
const ARM = 330;
const STRING = 150;
const PAN_W = 250;
const MAX_A = 0.28;
const GAIN = 20;
const TRAY_Y = 556;
/** Within this many grams, the scale counts as perfectly level: one microgram, a three-thousandth of an ant. */
export const LEVEL = 1e-6;

export type Kind = "ant" | "rice" | "paperclip" | "egg" | "apple" | "mug" | "cat" | "person" | "piano" | "car" | "elephant" | "whale" | "house";
type Spec = { name: string; plural: string; g: number; sd: number; aspect: number };

// grams, and how much one varies from the next (fraction, roughly one standard deviation)
export const KINDS: Record<Kind, Spec> = {
  ant: { name: "Ant", plural: "ants", g: 0.003, sd: 0.25, aspect: 0.5 },
  rice: { name: "Rice", plural: "grains of rice", g: 0.025, sd: 0.2, aspect: 0.42 },
  paperclip: { name: "Paperclip", plural: "paperclips", g: 1.0, sd: 0.05, aspect: 0.36 },
  egg: { name: "Egg", plural: "eggs", g: 58, sd: 0.12, aspect: 1.28 },
  apple: { name: "Apple", plural: "apples", g: 180, sd: 0.2, aspect: 1 },
  mug: { name: "Mug", plural: "mugs", g: 350, sd: 0.08, aspect: 0.9 },
  cat: { name: "Cat", plural: "cats", g: 4300, sd: 0.25, aspect: 1 },
  person: { name: "Person", plural: "people", g: 72000, sd: 0.22, aspect: 2.5 },
  piano: { name: "Piano", plural: "pianos", g: 280000, sd: 0.12, aspect: 0.95 },
  car: { name: "Car", plural: "cars", g: 1450000, sd: 0.15, aspect: 0.42 },
  elephant: { name: "Elephant", plural: "elephants", g: 5.5e6, sd: 0.2, aspect: 0.78 },
  whale: { name: "Whale", plural: "whales", g: 1.3e8, sd: 0.25, aspect: 0.4 },
  house: { name: "House", plural: "houses", g: 1.6e8, sd: 0.3, aspect: 0.95 },
};
export const ORDER: Kind[] = ["ant", "rice", "paperclip", "egg", "apple", "mug", "cat", "person", "piano", "car", "elephant", "whale", "house"];
const POUR = new Set<Kind>(["ant", "rice", "paperclip"]);

export type Item = { kind: Kind; g: number };
type Side = 0 | 1;
type Drag = { kind: Kind; g: number | null; x: number; y: number; over: Side | null; hold: number; poured: number; next: number };
type Rect = { side: Side; kind: Kind; x: number; y: number; w: number; h: number; f: number };
export type BalanceEvent = { type: "drop"; kind: Kind; side: Side; first: boolean } | { type: "pour"; kind: Kind } | { type: "lift"; kind: Kind } | { type: "level" } | { type: "unlevel" } | { type: "left"; kind: Kind; side: Side };

function rng(seed: number) {
  let s = seed >>> 0 || 17;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000003) / 1000003;
  };
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Drawn size (the longer side) of a kind, on a log scale from ant to house. */
export function sizeOf(kind: Kind) {
  return 14 + 14 * Math.log10(KINDS[kind].g / 0.003);
}

export function fmtMass(g: number) {
  const a = Math.abs(g);
  const sig = (v: number) => {
    const t = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return t.includes(".") ? t.replace(/0+$/, "").replace(/\.$/, "") : t;
  };
  if (a < 1) return `${sig(a * 1000)} mg`;
  if (a < 1000) return `${sig(a)} g`;
  if (a < 1e6) return `${sig(a / 1000)} kg`;
  return `${sig(a / 1e6)} t`;
}

// Precise sums: add small numbers first.
function total(items: Item[]) {
  const v = items.map((i) => i.g).sort((a, b) => a - b);
  let s = 0;
  let c = 0;
  for (const x of v) {
    const y = x - c;
    const t = s + y;
    c = t - s - y;
    s = t;
  }
  return s;
}

export class Balance {
  pans: [Item[], Item[]] = [[], []];
  sums: [number, number] = [0, 0];
  theta = 0;
  omega = 0;
  swing: [number, number] = [0, 0];
  swingV: [number, number] = [0, 0];
  drag: Drag | null = null;
  hover: { x: number; y: number } | null = null;
  level = false;
  seen = new Set<Kind>();
  private rand: () => number;
  private rects: Rect[] = [];
  private bump: [number, number] = [0, 0];

  constructor(seed: number) {
    this.rand = rng(seed);
  }

  /** One real object of a kind: never quite the same weight twice. */
  make(kind: Kind): number {
    const k = KINDS[kind];
    // a clipped normal, by Box-Muller
    const u = Math.max(1e-9, this.rand());
    const v = this.rand();
    const z = clamp(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v), -2.2, 2.2);
    return k.g * (1 + k.sd * z) * (1 + (this.rand() - 0.5) * 1e-6);
  }

  get diff() {
    return this.sums[0] - this.sums[1];
  }
  get count() {
    return this.pans[0].length + this.pans[1].length;
  }
  get both() {
    return this.pans[0].length > 0 && this.pans[1].length > 0;
  }

  private recount() {
    this.sums = [total(this.pans[0]), total(this.pans[1])];
  }

  add(side: Side, kind: Kind, g = this.make(kind)) {
    this.pans[side].push({ kind, g });
    this.recount();
    // a little knock, more for heavy things relative to what's already there
    const all = this.sums[0] + this.sums[1];
    const k = clamp(g / (all + 1e-9), 0, 1);
    this.omega += (side === 0 ? -1 : 1) * 0.6 * k;
    this.swingV[side] += (this.rand() - 0.5) * 0.4 * Math.sqrt(k);
    this.bump[side] = Math.min(1, this.bump[side] + 0.4 * Math.sqrt(k) + 0.05);
  }

  private takeOne(side: Side, kind: Kind): number | null {
    const list = this.pans[side];
    for (let i = list.length - 1; i >= 0; i--)
      if (list[i].kind === kind) {
        const [it] = list.splice(i, 1);
        this.recount();
        return it.g;
      }
    return null;
  }

  reset() {
    this.pans = [[], []];
    this.recount();
    this.drag = null;
    this.omega += (this.rand() - 0.5) * 0.1;
  }

  /** How far off it is, in the units of whatever is closest. */
  describe(): string {
    if (!this.both) return this.count ? "Put something on the other side." : "Both pans are empty. Technically level.";
    const d = this.diff;
    const a = Math.abs(d);
    if (a < LEVEL) return "Perfectly level.";
    const side = d > 0 ? "Left" : "Right";
    if (a < KINDS.ant.g * 0.001) return `${side} is heavier by less than a thousandth of an ant.`;
    if (a < KINDS.ant.g * 0.01) return `${side} is heavier by less than a hundredth of an ant.`;
    if (a < KINDS.ant.g * 0.1) return `${side} is heavier by less than a tenth of an ant.`;
    if (a < KINDS.ant.g * 0.5) return `${side} is heavier by less than half an ant.`;
    let pick: Kind = "ant";
    for (const k of ORDER) if (KINDS[k].g <= a * 1.25) pick = k;
    const n = Math.max(1, Math.round(a / KINDS[pick].g));
    const what = n === 1 ? (pick === "rice" ? "a grain of rice" : `${/^[aeiou]/i.test(KINDS[pick].name) ? "an" : "a"} ${KINDS[pick].name.toLowerCase()}`) : `${n} ${KINDS[pick].plural}`;
    return `${side} is heavier by about ${what}.`;
  }

  // ---------- layout ----------

  private beamEnd(side: Side) {
    const s = side === 0 ? -1 : 1;
    return { x: PIVOT.x + s * ARM * Math.cos(this.theta), y: PIVOT.y + s * ARM * Math.sin(this.theta) };
  }
  private panAt(side: Side) {
    const e = this.beamEnd(side);
    const a = this.swing[side];
    return { x: e.x + Math.sin(a) * STRING, y: e.y + Math.cos(a) * STRING };
  }

  private trayRects() {
    const n = ORDER.length;
    const slot = 70;
    const x0 = W / 2 - (n * slot) / 2;
    return ORDER.map((k, i) => ({ kind: k, x: x0 + i * slot, y: TRAY_Y + 6, w: slot, h: H - TRAY_Y - 12 }));
  }

  private groups(side: Side) {
    const counts = new Map<Kind, number>();
    for (const it of this.pans[side]) counts.set(it.kind, (counts.get(it.kind) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => KINDS[b[0]].g - KINDS[a[0]].g);
  }

  // Groups piled on a pan, biggest at the bottom, in rows. A tall pile shrinks to fit under the ceiling.
  private layout(side: Side) {
    const p = this.panAt(side);
    const groups = this.groups(side);
    const maxH = Math.min(270, p.y - 24);
    let f = 1;
    for (let tries = 0; ; tries++) {
      const { rects, height } = this.pack(p, groups, f, side);
      if (height <= maxH || tries > 12) return rects;
      f *= 0.86;
    }
  }

  private pack(p: { x: number; y: number }, groups: [Kind, number][], f: number, side: Side) {
    const out: Rect[] = [];
    const maxW = PAN_W - 26;
    let row: Rect[] = [];
    let rowW = 0;
    let y = p.y - 6;
    const flush = () => {
      if (!row.length) return;
      const h = Math.max(...row.map((r) => r.h));
      let x = p.x - rowW / 2;
      for (const r of row) {
        r.x = x;
        r.y = y - r.h;
        x += r.w + 6 * f;
        out.push(r);
      }
      y -= h + 2;
      row = [];
      rowW = 0;
    };
    for (const [kind, n] of groups) {
      const { w, h } = dims(kind);
      // small things get their count beside them, not on top
      const ww = (w + (n > 1 ? (w < 40 ? 34 : 8) : 0)) * f;
      if (row.length && rowW + 6 * f + ww > maxW) flush();
      row.push({ side, kind, x: 0, y: 0, w: ww, h: (h + (n > 1 ? 4 : 0)) * f, f });
      rowW += (row.length > 1 ? 6 * f : 0) + ww;
    }
    flush();
    return { rects: out, height: p.y - 6 - y };
  }

  private sideAt(x: number, y: number): Side | null {
    if (y > TRAY_Y || y < 40) return null;
    return x < W / 2 ? 0 : 1;
  }

  // ---------- input ----------

  cursorAt(x: number, y: number): "grab" | "default" {
    if (this.trayHit(x, y) || this.rectHit(x, y)) return "grab";
    return "default";
  }
  private trayHit(x: number, y: number) {
    return this.trayRects().find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ?? null;
  }
  private rectHit(x: number, y: number) {
    for (let i = this.rects.length - 1; i >= 0; i--) {
      const r = this.rects[i];
      if (x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 4 && y <= r.y + r.h + 4) return r;
    }
    return null;
  }

  down(x: number, y: number): BalanceEvent | null {
    const t = this.trayHit(x, y);
    if (t) {
      this.drag = { kind: t.kind, g: null, x, y, over: null, hold: 0, poured: 0, next: 0 };
      return null;
    }
    const r = this.rectHit(x, y);
    if (r) {
      const g = this.takeOne(r.side, r.kind);
      if (g === null) return null;
      this.omega += (r.side === 0 ? 1 : -1) * 0.2 * clamp(g / (this.sums[0] + this.sums[1] + g), 0, 1);
      this.drag = { kind: r.kind, g, x, y, over: r.side, hold: 0, poured: 0, next: 0 };
      return { type: "lift", kind: r.kind };
    }
    return null;
  }

  move(x: number, y: number) {
    this.hover = { x, y };
    if (!this.drag) return;
    const over = this.sideAt(x, y);
    if (over !== this.drag.over) {
      this.drag.hold = 0;
      this.drag.next = 0;
    }
    this.drag.x = x;
    this.drag.y = y;
    this.drag.over = over;
  }

  up(): BalanceEvent | null {
    const d = this.drag;
    this.drag = null;
    if (!d || d.over === null) return null;
    // small things that were being poured just stop
    if (d.poured > 0) return null;
    const first = !this.seen.has(d.kind);
    this.seen.add(d.kind);
    this.add(d.over, d.kind, d.g ?? undefined);
    return { type: "drop", kind: d.kind, side: d.over, first };
  }

  leave() {
    this.hover = null;
  }

  step(dt: number): BalanceEvent[] {
    const out: BalanceEvent[] = [];
    // pour tiny things while held over a pan: faster the longer you hold
    const d = this.drag;
    if (d && d.over !== null && d.g === null && POUR.has(d.kind)) {
      d.hold += dt;
      if (d.hold > 0.35) {
        const rate = Math.min(60, 4 + (d.hold - 0.35) * 22);
        d.next -= dt;
        let n = 0;
        while (d.next <= 0 && n < 6) {
          this.add(d.over, d.kind);
          d.poured++;
          d.next += 1 / rate;
          n++;
        }
        if (n) {
          if (!this.seen.has(d.kind)) {
            this.seen.add(d.kind);
            out.push({ type: "drop", kind: d.kind, side: d.over, first: true });
          }
          out.push({ type: "pour", kind: d.kind });
        }
      }
    }
    // the living things do not stay put forever
    for (const s of [0, 1] as const) {
      const list = this.pans[s];
      let ants = 0;
      let cats = 0;
      for (const it of list) {
        if (it.kind === "ant") ants++;
        else if (it.kind === "cat") cats++;
      }
      const who: Kind | null = ants && this.rand() < ants * 0.002 * dt ? "ant" : cats && this.rand() < cats * 0.01 * dt ? "cat" : null;
      if (who) {
        const idx = list.map((it, i) => (it.kind === who ? i : -1)).filter((i) => i >= 0);
        const i = idx[Math.floor(this.rand() * idx.length)];
        const [gone] = list.splice(i, 1);
        this.recount();
        this.omega += (s === 0 ? 1 : -1) * 0.3 * clamp(gone.g / (this.sums[0] + this.sums[1] + gone.g), 0, 1);
        out.push({ type: "left", kind: who, side: s });
      }
    }
    // the beam: a damped spring towards where the weights put it
    const all = this.sums[0] + this.sums[1];
    const target = all > 0 ? -MAX_A * Math.tanh((GAIN * this.diff) / all) : 0;
    const k = 26;
    const c = 3.2;
    this.omega += (-(this.theta - target) * k - this.omega * c) * dt;
    this.theta = clamp(this.theta + this.omega * dt, -MAX_A - 0.04, MAX_A + 0.04);
    // pans swing a little from the beam's motion
    for (const s of [0, 1] as const) {
      const acc = (s === 0 ? 1 : -1) * this.omega * 0.12;
      this.swingV[s] += (-this.swing[s] * 9 - this.swingV[s] * 1.6 - acc) * dt;
      this.swing[s] = clamp(this.swing[s] + this.swingV[s] * dt, -0.25, 0.25);
      this.bump[s] = Math.max(0, this.bump[s] - dt * 3);
    }
    const lvl = this.both && Math.abs(this.diff) < LEVEL;
    if (lvl !== this.level) {
      this.level = lvl;
      out.push({ type: lvl ? "level" : "unlevel" });
    }
    return out;
  }

  /** Put the beam where it would come to rest (for still frames). */
  settle() {
    const all = this.sums[0] + this.sums[1];
    this.theta = all > 0 ? -MAX_A * Math.tanh((GAIN * this.diff) / all) : 0;
    this.omega = 0;
  }

  // ---------- drawing ----------

  draw(ctx: CanvasRenderingContext2D, opts: { tray?: boolean } = {}) {
    const tray = opts.tray ?? true;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // room
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#F7F4EE");
    g.addColorStop(1, "#EFEAE1");
    ctx.fillStyle = g;
    ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.fillStyle = "#E7DDCC";
    ctx.fillRect(-W, 520, W * 3, H);
    ctx.fillStyle = "rgba(60,50,35,0.08)";
    ctx.fillRect(-W, 519, W * 3, 2);

    this.drawStand(ctx);
    this.rects = [];
    for (const s of [0, 1] as const) this.drawPan(ctx, s);
    this.drawBeam(ctx);
    this.drawDial(ctx);
    if (tray) this.drawTray(ctx);
    const d = this.drag;
    if (d) {
      if (d.over !== null) {
        const p = this.panAt(d.over);
        ctx.strokeStyle = "rgba(74,95,120,0.35)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 4, PAN_W / 2 + 10, 22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const { h } = dims(d.kind);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.translate(d.x, d.y + h / 2);
      drawKind(ctx, d.kind, dims(d.kind));
      ctx.restore();
    } else if (tray && this.hover) {
      const t = this.trayHit(this.hover.x, this.hover.y);
      if (t) this.tip(ctx, t.x + t.w / 2, t.y - 8, `${KINDS[t.kind].name}, about ${fmtMass(KINDS[t.kind].g)}`);
      else {
        const r = this.rectHit(this.hover.x, this.hover.y);
        if (r) {
          const n = this.pans[r.side].filter((i) => i.kind === r.kind).length;
          this.tip(ctx, r.x + r.w / 2, r.y - 8, n > 1 ? `${n} ${KINDS[r.kind].plural}` : `${KINDS[r.kind].name}`);
        }
      }
    }
  }

  private tip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
    ctx.font = '500 13px "Inter Tight", system-ui, sans-serif';
    const w = ctx.measureText(text).width + 16;
    const bx = clamp(x - w / 2, 6, W - w - 6);
    ctx.fillStyle = "rgba(28,28,26,0.88)";
    roundRect(ctx, bx, y - 24, w, 24, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(text, bx + 8, y - 7.5);
  }

  private drawStand(ctx: CanvasRenderingContext2D) {
    // base
    ctx.fillStyle = "rgba(28,28,26,0.08)";
    ctx.beginPath();
    ctx.ellipse(PIVOT.x, 522, 120, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3B3A37";
    roundRect(ctx, PIVOT.x - 100, 500, 200, 20, 6);
    ctx.fill();
    ctx.fillStyle = "#57554F";
    roundRect(ctx, PIVOT.x - 70, 486, 140, 18, 5);
    ctx.fill();
    // column
    const cg = ctx.createLinearGradient(PIVOT.x - 14, 0, PIVOT.x + 14, 0);
    cg.addColorStop(0, "#4A4945");
    cg.addColorStop(0.45, "#6E6C66");
    cg.addColorStop(1, "#3B3A37");
    ctx.fillStyle = cg;
    ctx.fillRect(PIVOT.x - 13, PIVOT.y + 10, 26, 480 - PIVOT.y);
    for (let y = PIVOT.y + 60; y < 470; y += 70) {
      ctx.fillStyle = "#57554F";
      roundRect(ctx, PIVOT.x - 17, y, 34, 7, 3);
      ctx.fill();
    }
    // the fork at the top
    ctx.fillStyle = "#3B3A37";
    ctx.beginPath();
    ctx.moveTo(PIVOT.x - 26, PIVOT.y + 24);
    ctx.lineTo(PIVOT.x + 26, PIVOT.y + 24);
    ctx.lineTo(PIVOT.x + 16, PIVOT.y - 4);
    ctx.lineTo(PIVOT.x - 16, PIVOT.y - 4);
    ctx.closePath();
    ctx.fill();
  }

  private drawBeam(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(PIVOT.x, PIVOT.y);
    ctx.rotate(this.theta);
    ctx.fillStyle = "rgba(28,28,26,0.10)";
    ctx.beginPath();
    ctx.moveTo(-ARM - 6, 5);
    ctx.lineTo(0, 12);
    ctx.lineTo(ARM + 6, 5);
    ctx.lineTo(ARM + 6, 9);
    ctx.lineTo(-ARM - 6, 9);
    ctx.fill();
    ctx.fillStyle = "#2E2D2A";
    ctx.beginPath();
    ctx.moveTo(-ARM - 8, -4);
    ctx.quadraticCurveTo(0, -14, ARM + 8, -4);
    ctx.lineTo(ARM + 8, 4);
    ctx.quadraticCurveTo(0, 12, -ARM - 8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-ARM, -3.5);
    ctx.quadraticCurveTo(0, -12, ARM, -3.5);
    ctx.stroke();
    // end hooks
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#2E2D2A";
      ctx.beginPath();
      ctx.arc(s * ARM, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8C877C";
      ctx.beginPath();
      ctx.arc(s * ARM, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // pointer, standing up from the pivot
    ctx.strokeStyle = "#2E2D2A";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -62);
    ctx.stroke();
    ctx.fillStyle = "#C4553A";
    ctx.beginPath();
    ctx.moveTo(-4, -60);
    ctx.lineTo(0, -74);
    ctx.lineTo(4, -60);
    ctx.fill();
    ctx.restore();
    // pivot cap
    ctx.fillStyle = "#57554F";
    ctx.beginPath();
    ctx.arc(PIVOT.x, PIVOT.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#C9C2B4";
    ctx.beginPath();
    ctx.arc(PIVOT.x, PIVOT.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // The fine dial on the column: how far off, on a log scale from a microgram to a thousand tonnes.
  private drawDial(ctx: CanvasRenderingContext2D) {
    const cx = PIVOT.x;
    const cy = 300;
    const R = 54;
    ctx.fillStyle = "#FBFAF7";
    ctx.strokeStyle = "#CFC7B8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const span = 2.0; // radians either side
    const labels: [number, string][] = [
      [0, "g"],
      [3, "kg"],
      [6, "t"],
    ];
    ctx.strokeStyle = "#B7AFA0";
    ctx.lineWidth = 1;
    for (let e = -6; e <= 9; e++) {
      const f = (e + 6) / 15;
      for (const s of [-1, 1]) {
        const a = -Math.PI / 2 + s * f * span;
        const len = labels.some((l) => l[0] === e) ? 8 : 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len));
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#8A877F";
    ctx.font = '500 8px "Inter Tight", system-ui, sans-serif';
    ctx.textAlign = "center";
    for (const [e, t] of labels) {
      const f = (e + 6) / 15;
      for (const s of [-1, 1]) {
        const a = -Math.PI / 2 + s * f * span;
        ctx.fillText(t, cx + Math.cos(a) * (R - 15), cy + Math.sin(a) * (R - 15) + 3);
      }
    }
    ctx.fillStyle = "#6B6A65";
    ctx.font = '600 7px "Inter Tight", system-ui, sans-serif';
    ctx.fillText("LEFT", cx - 22, cy + 40);
    ctx.fillText("RIGHT", cx + 22, cy + 40);
    ctx.fillText("LEVEL", cx, cy - R + 18);
    ctx.textAlign = "start";
    // needle
    const d = this.both ? this.diff : 0;
    const a = Math.abs(d);
    const f = a < LEVEL ? 0 : clamp((Math.log10(a) + 6) / 15, 0.02, 1);
    const ang = -Math.PI / 2 + (d > 0 ? -1 : 1) * f * span;
    ctx.strokeStyle = this.level ? "#4A5F78" : "#1C1C1A";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * (R - 4), cy + Math.sin(ang) * (R - 4));
    ctx.stroke();
    ctx.fillStyle = "#1C1C1A";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4A5F78";
    ctx.lineWidth = 2;
    this.line(ctx, cx, cy - R - 2, cx, cy - R + 6);
  }

  private drawPan(ctx: CanvasRenderingContext2D, side: Side) {
    const e = this.beamEnd(side);
    const p = this.panAt(side);
    const half = PAN_W / 2;
    // strings
    ctx.strokeStyle = "#6B6A65";
    ctx.lineWidth = 1.5;
    for (const dx of [-half + 6, 0, half - 6]) this.line(ctx, e.x, e.y, p.x + dx, p.y - 2);
    // shadow on the floor
    ctx.fillStyle = "rgba(28,28,26,0.06)";
    ctx.beginPath();
    ctx.ellipse(p.x, 524, half * 0.8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // what's on it
    const bump = this.bump[side];
    for (const r of this.layout(side)) {
      const n = this.pans[side].filter((i) => i.kind === r.kind).length;
      const d0 = dims(r.kind);
      const dm = { w: d0.w * r.f, h: d0.h * r.f };
      const ox = r.x;
      ctx.save();
      ctx.translate(0, -bump * 3);
      for (let c = Math.min(n, 3) - 1; c >= 0; c--) {
        ctx.save();
        ctx.translate(ox + dm.w / 2 + c * 4 * r.f, r.y + r.h - c * 2 * r.f);
        if (c) ctx.globalAlpha = 0.85;
        drawKind(ctx, r.kind, dm);
        ctx.restore();
      }
      if (n > 1) {
        const label = `×${n}`;
        ctx.font = '600 11px "Inter Tight", system-ui, sans-serif';
        const tw = ctx.measureText(label).width + 10;
        const small = dm.w < 40 * r.f;
        const bx = small ? r.x + dm.w + 8 * r.f + tw / 2 - 4 : r.x + r.w - tw / 2;
        const by = small ? r.y + r.h - 16 : r.y - 4;
        ctx.fillStyle = "#1C1C1A";
        roundRect(ctx, bx - tw / 2 + 4, by, tw, 16, 8);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(label, bx - tw / 2 + 9, by + 12);
      }
      ctx.restore();
      this.rects.push(r);
    }
    // the dish
    ctx.fillStyle = "#2E2D2A";
    ctx.beginPath();
    ctx.moveTo(p.x - half, p.y - 4);
    ctx.lineTo(p.x + half, p.y - 4);
    ctx.quadraticCurveTo(p.x + half - 10, p.y + 18, p.x, p.y + 20);
    ctx.quadraticCurveTo(p.x - half + 10, p.y + 18, p.x - half, p.y - 4);
    ctx.fill();
    ctx.fillStyle = "#57554F";
    roundRect(ctx, p.x - half - 4, p.y - 7, PAN_W + 8, 6, 3);
    ctx.fill();
  }

  private drawTray(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(251,250,247,0.92)";
    ctx.fillRect(-W, TRAY_Y, W * 3, H);
    ctx.fillStyle = "#E2DFD8";
    ctx.fillRect(-W, TRAY_Y, W * 3, 1);
    for (const r of this.trayRects()) {
      const hot = this.hover && !this.drag && this.hover.x >= r.x && this.hover.x < r.x + r.w && this.hover.y >= r.y && this.hover.y < r.y + r.h;
      if (hot) {
        ctx.fillStyle = "rgba(74,95,120,0.08)";
        roundRect(ctx, r.x + 3, r.y, r.w - 6, r.h, 8);
        ctx.fill();
      }
      const s = clamp(sizeOf(r.kind) * 0.42, 14, 44);
      const dm = fit(r.kind, s);
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + 46 - (44 - dm.h) / 2);
      drawKind(ctx, r.kind, dm);
      ctx.restore();
      ctx.fillStyle = "#6B6A65";
      ctx.font = '500 10.5px "Inter Tight", system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(KINDS[r.kind].name, r.x + r.w / 2, r.y + r.h - 4);
      ctx.textAlign = "start";
    }
  }

  private line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

function fit(kind: Kind, s: number) {
  const a = KINDS[kind].aspect;
  const w = a > 1 ? s / a : s;
  return { w, h: w * a };
}
function dims(kind: Kind) {
  return fit(kind, sizeOf(kind));
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

// Each thing, drawn standing on (0,0), w wide and h tall.
function drawKind(ctx: CanvasRenderingContext2D, kind: Kind, { w, h }: { w: number; h: number }) {
  const ell = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  };
  const lw = (v: number) => (ctx.lineWidth = Math.max(0.6, v));
  switch (kind) {
    case "ant": {
      ctx.strokeStyle = "#1C1C1A";
      lw(w * 0.05);
      for (const x of [-0.12, 0.02, 0.16]) {
        ctx.beginPath();
        ctx.moveTo(w * x, -h * 0.45);
        ctx.lineTo(w * (x - 0.08), 0);
        ctx.moveTo(w * x, -h * 0.45);
        ctx.lineTo(w * (x + 0.1), 0);
        ctx.stroke();
      }
      ctx.fillStyle = "#1C1C1A";
      ell(-w * 0.28, -h * 0.5, w * 0.2, h * 0.3);
      ctx.fill();
      ell(w * 0.03, -h * 0.5, w * 0.12, h * 0.2);
      ctx.fill();
      ell(w * 0.3, -h * 0.55, w * 0.13, h * 0.24);
      ctx.fill();
      break;
    }
    case "rice": {
      ctx.fillStyle = "#F1EBDD";
      ctx.strokeStyle = "#C9C0AE";
      lw(w * 0.04);
      ell(0, -h / 2, w / 2, h / 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "paperclip": {
      ctx.strokeStyle = "#8C8F93";
      lw(w * 0.055);
      ctx.beginPath();
      const r1 = h * 0.45;
      ctx.moveTo(w * 0.1, -h * 0.05);
      ctx.lineTo(-w * 0.5 + r1, -h * 0.05);
      ctx.arc(-w * 0.5 + r1, -h * 0.5, r1, Math.PI / 2, (3 * Math.PI) / 2);
      ctx.lineTo(w * 0.5 - r1, -h * 0.95);
      ctx.arc(w * 0.5 - r1, -h * 0.5, r1, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(-w * 0.3, -h * 0.05);
      ctx.moveTo(-w * 0.3, -h * 0.05);
      ctx.lineTo(-w * 0.3 + 0.001, -h * 0.05);
      const r2 = h * 0.28;
      ctx.moveTo(-w * 0.3, -h * 0.22);
      ctx.lineTo(w * 0.32, -h * 0.22);
      ctx.arc(w * 0.32, -h * 0.5, r2, Math.PI / 2, -Math.PI / 2, true);
      ctx.lineTo(-w * 0.2, -h * 0.78);
      ctx.stroke();
      break;
    }
    case "egg": {
      ctx.fillStyle = "#F2E6D0";
      ctx.strokeStyle = "rgba(120,96,64,0.25)";
      lw(w * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.bezierCurveTo(w * 0.42, -h, w * 0.55, -h * 0.25, 0, 0);
      ctx.bezierCurveTo(-w * 0.55, -h * 0.25, -w * 0.42, -h, 0, -h);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "apple": {
      ctx.fillStyle = "#C4553A";
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.78);
      ctx.bezierCurveTo(w * 0.35, -h * 0.98, w * 0.62, -h * 0.6, w * 0.4, -h * 0.18);
      ctx.bezierCurveTo(w * 0.28, h * 0.02, w * 0.1, -h * 0.02, 0, -h * 0.06);
      ctx.bezierCurveTo(-w * 0.1, -h * 0.02, -w * 0.28, h * 0.02, -w * 0.4, -h * 0.18);
      ctx.bezierCurveTo(-w * 0.62, -h * 0.6, -w * 0.35, -h * 0.98, 0, -h * 0.78);
      ctx.fill();
      ctx.strokeStyle = "#5A4632";
      lw(w * 0.05);
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.78);
      ctx.lineTo(w * 0.04, -h * 0.98);
      ctx.stroke();
      ctx.fillStyle = "#7A8F5A";
      ell(w * 0.16, -h * 0.92, w * 0.13, h * 0.06, -0.5);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ell(-w * 0.2, -h * 0.55, w * 0.08, h * 0.14, 0.3);
      ctx.fill();
      break;
    }
    case "mug": {
      ctx.strokeStyle = "#4A5F78";
      lw(w * 0.09);
      ctx.beginPath();
      ctx.arc(w * 0.3, -h * 0.5, h * 0.22, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.fillStyle = "#4A5F78";
      roundRect(ctx, -w * 0.5, -h, w * 0.78, h, w * 0.08);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(-w * 0.42, -h * 0.9, w * 0.08, h * 0.75);
      break;
    }
    case "cat": {
      ctx.fillStyle = "#8C877C";
      ctx.strokeStyle = "#8C877C";
      lw(w * 0.08);
      ctx.beginPath();
      ctx.moveTo(w * 0.28, -h * 0.06);
      ctx.quadraticCurveTo(w * 0.62, -h * 0.05, w * 0.48, -h * 0.4);
      ctx.stroke();
      ell(0, -h * 0.32, w * 0.34, h * 0.32);
      ctx.fill();
      ell(-w * 0.06, -h * 0.72, w * 0.22, h * 0.2);
      ctx.fill();
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.06 + s * w * 0.2, -h * 0.75);
        ctx.lineTo(-w * 0.06 + s * w * 0.17, -h * 0.98);
        ctx.lineTo(-w * 0.06 + s * w * 0.04, -h * 0.88);
        ctx.fill();
      }
      ctx.fillStyle = "#1C1C1A";
      for (const s of [-1, 1]) {
        ell(-w * 0.06 + s * w * 0.08, -h * 0.74, w * 0.025, h * 0.035);
        ctx.fill();
      }
      break;
    }
    case "person": {
      ctx.fillStyle = "#3B3A37";
      roundRect(ctx, -w * 0.3, -h * 0.46, w * 0.26, h * 0.46, w * 0.1);
      ctx.fill();
      roundRect(ctx, w * 0.04, -h * 0.46, w * 0.26, h * 0.46, w * 0.1);
      ctx.fill();
      ctx.fillStyle = "#4A5F78";
      roundRect(ctx, -w * 0.42, -h * 0.8, w * 0.84, h * 0.4, w * 0.3);
      ctx.fill();
      ctx.fillStyle = "#D9C2B0";
      ell(0, -h * 0.89, w * 0.24, h * 0.1);
      ctx.fill();
      ctx.fillStyle = "#3B3A37";
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.92, w * 0.25, h * 0.08, 0, Math.PI, 0);
      ctx.fill();
      break;
    }
    case "piano": {
      ctx.fillStyle = "#2E2D2A";
      roundRect(ctx, -w * 0.5, -h, w, h * 0.92, w * 0.04);
      ctx.fill();
      ctx.fillRect(-w * 0.44, -h * 0.1, w * 0.06, h * 0.1);
      ctx.fillRect(w * 0.38, -h * 0.1, w * 0.06, h * 0.1);
      ctx.fillStyle = "#F6F4EF";
      ctx.fillRect(-w * 0.46, -h * 0.5, w * 0.92, h * 0.1);
      ctx.fillStyle = "#2E2D2A";
      for (let i = 0; i < 14; i++) if (i % 7 !== 2 && i % 7 !== 6) ctx.fillRect(-w * 0.46 + (i + 0.7) * (w * 0.92 / 14), -h * 0.5, w * 0.025, h * 0.06);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      lw(1);
      ctx.strokeRect(-w * 0.38, -h * 0.9, w * 0.76, h * 0.32);
      break;
    }
    case "car": {
      ctx.fillStyle = "#A9A59C";
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, -h * 0.22);
      ctx.lineTo(-w * 0.48, -h * 0.5);
      ctx.lineTo(-w * 0.26, -h * 0.56);
      ctx.lineTo(-w * 0.14, -h * 0.94);
      ctx.lineTo(w * 0.22, -h * 0.94);
      ctx.lineTo(w * 0.36, -h * 0.56);
      ctx.lineTo(w * 0.5, -h * 0.48);
      ctx.lineTo(w * 0.5, -h * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#DCE2E6";
      ctx.beginPath();
      ctx.moveTo(-w * 0.21, -h * 0.58);
      ctx.lineTo(-w * 0.11, -h * 0.86);
      ctx.lineTo(w * 0.02, -h * 0.86);
      ctx.lineTo(w * 0.02, -h * 0.58);
      ctx.moveTo(w * 0.06, -h * 0.58);
      ctx.lineTo(w * 0.06, -h * 0.86);
      ctx.lineTo(w * 0.19, -h * 0.86);
      ctx.lineTo(w * 0.29, -h * 0.58);
      ctx.fill();
      for (const x of [-0.3, 0.3]) {
        ctx.fillStyle = "#2E2D2A";
        ell(w * x, -h * 0.2, h * 0.2, h * 0.2);
        ctx.fill();
        ctx.fillStyle = "#8C877C";
        ell(w * x, -h * 0.2, h * 0.08, h * 0.08);
        ctx.fill();
      }
      break;
    }
    case "elephant": {
      ctx.fillStyle = "#9A968D";
      for (const x of [-0.34, -0.14, 0.12, 0.3]) {
        roundRect(ctx, w * x - w * 0.07, -h * 0.4, w * 0.14, h * 0.4, w * 0.03);
        ctx.fill();
      }
      ell(-w * 0.02, -h * 0.52, w * 0.4, h * 0.3);
      ctx.fill();
      ell(w * 0.36, -h * 0.66, w * 0.15, h * 0.18);
      ctx.fill();
      ctx.strokeStyle = "#9A968D";
      lw(w * 0.07);
      ctx.beginPath();
      ctx.moveTo(w * 0.46, -h * 0.6);
      ctx.quadraticCurveTo(w * 0.56, -h * 0.3, w * 0.48, -h * 0.08);
      ctx.stroke();
      ctx.fillStyle = "#8A867D";
      ell(w * 0.27, -h * 0.64, w * 0.1, h * 0.17);
      ctx.fill();
      ctx.fillStyle = "#1C1C1A";
      ell(w * 0.4, -h * 0.72, w * 0.015, h * 0.022);
      ctx.fill();
      ctx.strokeStyle = "#9A968D";
      lw(w * 0.02);
      ctx.beginPath();
      ctx.moveTo(-w * 0.42, -h * 0.6);
      ctx.lineTo(-w * 0.48, -h * 0.4);
      ctx.stroke();
      break;
    }
    case "whale": {
      ctx.fillStyle = "#5E7184";
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, -h * 0.5);
      ctx.bezierCurveTo(-w * 0.5, -h * 1.0, w * 0.2, -h * 1.05, w * 0.36, -h * 0.55);
      ctx.lineTo(w * 0.5, -h * 0.85);
      ctx.lineTo(w * 0.47, -h * 0.4);
      ctx.lineTo(w * 0.5, -h * 0.05);
      ctx.lineTo(w * 0.36, -h * 0.38);
      ctx.bezierCurveTo(w * 0.2, 0, -w * 0.5, 0, -w * 0.5, -h * 0.5);
      ctx.fill();
      ctx.fillStyle = "#C9D1D8";
      ctx.beginPath();
      ctx.moveTo(-w * 0.48, -h * 0.36);
      ctx.bezierCurveTo(-w * 0.3, -h * 0.05, w * 0.1, -h * 0.05, w * 0.3, -h * 0.34);
      ctx.bezierCurveTo(w * 0.1, -h * 0.18, -w * 0.3, -h * 0.2, -w * 0.48, -h * 0.36);
      ctx.fill();
      ctx.fillStyle = "#1C1C1A";
      ell(-w * 0.33, -h * 0.5, w * 0.012, h * 0.03);
      ctx.fill();
      break;
    }
    case "house": {
      ctx.fillStyle = "#EDE6D6";
      ctx.fillRect(-w * 0.42, -h * 0.58, w * 0.84, h * 0.58);
      ctx.fillStyle = "#6B5A48";
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, -h * 0.56);
      ctx.lineTo(0, -h);
      ctx.lineTo(w * 0.5, -h * 0.56);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(w * 0.18, -h * 0.94, w * 0.1, h * 0.2);
      ctx.fillStyle = "#4A5F78";
      ctx.fillRect(-w * 0.08, -h * 0.3, w * 0.16, h * 0.3);
      ctx.fillStyle = "#C9D1D8";
      for (const x of [-0.3, 0.16]) ctx.fillRect(w * x, -h * 0.46, w * 0.14, h * 0.12);
      ctx.strokeStyle = "rgba(60,50,35,0.25)";
      lw(1);
      ctx.strokeRect(-w * 0.42, -h * 0.58, w * 0.84, h * 0.58);
      break;
    }
  }
}

export { drawKind, dims };
