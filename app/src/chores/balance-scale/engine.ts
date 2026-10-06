// "Balance the Scale": a big beam balance in the middle of the room. Drag things from the tray onto
// either pan, from an ant to a blue whale. Every single thing weighs a little differently from the
// last one of its kind, nothing shows its exact weight, and "level" means within half an ant.
// The pans and everything on them are rigid bodies (planck.js, loaded lazily by the page and handed
// in with attach()); whatever slides off and drops past the floor is gone.
// Pure module, SSR safe (no globals at top level).
import type * as Planck from "planck";

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
const S = 30; // pixels per physics metre
const HZ = 1 / 60;
const FLOOR = 520;

type Side = 0 | 1;
/** One real thing in the room: on a pan, in the air, or on its way out. */
export type Item = { id: number; kind: Kind; g: number; x: number; y: number; a: number; body: Planck.Body | null; on: [number, number]; fixed: Side | null; fade: number; vy: number; vmax: number };
type Held = { kind: Kind; g: number | null; x: number; y: number; over: Side | null; hold: number; poured: number; next: number };
export type BalanceEvent =
  | { type: "drop"; kind: Kind; first: boolean }
  | { type: "pour"; kind: Kind }
  | { type: "lift"; kind: Kind }
  | { type: "level" }
  | { type: "unlevel" }
  | { type: "left"; kind: Kind }
  | { type: "fell"; kind: Kind };

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
  return 10 + 12 * Math.log10(KINDS[kind].g / 0.003);
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
function total(v: number[]) {
  v.sort((a, b) => a - b);
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

// The collider for each kind, in pixels around the middle of its drawn box.
function outline(kind: Kind, w: number, h: number): { circle: number } | { poly: [number, number][] } {
  const box = (bw = w, bh = h): [number, number][] => [
    [-bw / 2, -bh / 2],
    [bw / 2, -bh / 2],
    [bw / 2, bh / 2],
    [-bw / 2, bh / 2],
  ];
  const oct = (c: number): [number, number][] => {
    const x = w / 2;
    const y = h / 2;
    return [
      [-x + c, -y],
      [x - c, -y],
      [x, -y + c],
      [x, y - c * 0.3],
      [x - c * 0.3, y],
      [-x + c * 0.3, y],
      [-x, y - c * 0.3],
      [-x, -y + c],
    ];
  };
  const ellipse = (): [number, number][] => Array.from({ length: 8 }, (_, i) => [(Math.cos((i * Math.PI) / 4) * w) / 2, (Math.sin((i * Math.PI) / 4) * h) / 2]);
  switch (kind) {
    case "apple":
      return { circle: Math.min(w, h) / 2 };
    case "rice":
    case "egg":
      return { poly: ellipse() };
    case "whale":
      // rounder underneath than on top, so things can stand on its back
      return {
        poly: [
          [-w / 2, h * 0.05],
          [-w * 0.36, -h * 0.4],
          [w * 0.2, -h * 0.42],
          [w / 2, -h * 0.1],
          [w / 2, h * 0.2],
          [w * 0.2, h / 2],
          [-w * 0.3, h / 2],
          [-w * 0.47, h * 0.3],
        ],
      };
    case "cat":
    case "elephant":
      return { poly: oct(Math.min(w, h) * 0.32) };
    case "car":
      return { poly: oct(Math.min(w, h) * 0.45) };
    case "person":
      return { poly: box(w * 0.84, h) };
    case "house":
      return {
        poly: [
          [-w / 2, h / 2],
          [-w / 2, -h * 0.06],
          [0, -h / 2],
          [w / 2, -h * 0.06],
          [w / 2, h / 2],
        ],
      };
    default:
      return { poly: box() };
  }
}

export class Balance {
  items: Item[] = [];
  sums: [number, number] = [0, 0];
  counts: [number, number] = [0, 0];
  theta = 0;
  omega = 0;
  drag: Held | null = null;
  hover: { x: number; y: number } | null = null;
  level = false;
  seen = new Set<Kind>();
  private rand: () => number;
  private pl: typeof Planck | null = null;
  private world: Planck.World | null = null;
  private panBodies: Planck.Body[] = [];
  private time = 0;
  private acc = 0;
  private nextId = 1;
  private fellSaid = false;

  constructor(seed: number) {
    this.rand = rng(seed);
  }

  /** Bring in the physics (loaded lazily by the page). */
  attach(pl: typeof Planck) {
    this.pl = pl;
    const world = (this.world = new pl.World({ gravity: { x: 0, y: 26 } }));
    for (const s of [0, 1] as const) {
      const p = this.panAt(s);
      const b = world.createBody({ type: "kinematic", position: { x: p.x / S, y: p.y / S } });
      const half = PAN_W / 2;
      // the plate is thicker underneath than it looks, so nothing small slips through it
      b.createFixture(new pl.Box(half / S, 12 / S, { x: 0, y: 12 / S }, 0), { friction: 0.9 });
      for (const dx of [-1, 1]) b.createFixture(new pl.Box(3 / S, 7 / S, { x: (dx * (half - 3)) / S, y: -6 / S }, 0), { friction: 0.9 });
      this.panBodies.push(b);
    }
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
    return this.counts[0] + this.counts[1];
  }
  get both() {
    return this.counts[0] > 0 && this.counts[1] > 0;
  }

  private onSide(it: Item): Side | null {
    if (it.fade > 0) return null;
    if (it.fixed !== null) return it.fixed;
    if (!it.body) return null;
    const t0 = this.time - it.on[0];
    const t1 = this.time - it.on[1];
    if (t0 < 0.25 && t0 <= t1) return 0;
    if (t1 < 0.25) return 1;
    return null;
  }

  private recount() {
    const v: [number[], number[]] = [[], []];
    for (const it of this.items) {
      const s = this.onSide(it);
      if (s !== null) v[s].push(it.g);
    }
    this.counts = [v[0].length, v[1].length];
    this.sums = [total(v[0]), total(v[1])];
  }

  /** Put a thing into the world at (x, y), lifted until it is clear of everything else. */
  spawn(kind: Kind, x: number, y: number, g = this.make(kind)): Item {
    const it: Item = { id: this.nextId++, kind, g, x, y, a: 0, body: null, on: [-9, -9], fixed: null, fade: 0, vy: 0, vmax: 0 };
    const pl = this.pl;
    const world = this.world;
    if (pl && world) {
      const { w, h } = dims(kind);
      const hw = w / 2 / S;
      const hh = h / 2 / S;
      let cy = y / S;
      const cx = x / S;
      for (let i = 0; i < 300; i++) {
        let hit = false;
        world.queryAABB({ lowerBound: { x: cx - hw + 0.02, y: cy - hh + 0.02 }, upperBound: { x: cx + hw - 0.02, y: cy + hh - 0.02 } }, () => {
          hit = true;
          return false;
        });
        if (!hit) break;
        cy -= 3 / S;
      }
      const body = world.createBody({ type: "dynamic", position: { x: cx, y: cy }, angularDamping: 0.4, linearDamping: 0.05 });
      const shape = outline(kind, w, h);
      const pm = 1 + 3 * Math.log10(KINDS[kind].g / 0.003); // physics mass, squashed so a whale can sit on an ant
      let area: number;
      if ("circle" in shape) {
        area = Math.PI * (shape.circle / S) ** 2;
        body.createFixture(new pl.Circle(shape.circle / S), { density: pm / area, friction: 0.8, restitution: 0.02 });
      } else {
        const pts = shape.poly.map(([px, py]) => ({ x: px / S, y: py / S }));
        area = 0;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          area += a.x * b.y - b.x * a.y;
        }
        area = Math.abs(area) / 2;
        body.createFixture(new pl.Polygon(pts), { density: pm / area, friction: 0.8, restitution: 0.02 });
      }
      body.setUserData(it);
      it.body = body;
      // a terminal speed, so small things never move more than part of their own thickness per step
      it.vmax = clamp((Math.min(w, h) / S) * 40, 4, 16);
      it.y = cy * S;
    }
    this.items.push(it);
    return it;
  }

  /** For still frames without physics: a thing resting on a pan at an offset from its middle. */
  place(side: Side, kind: Kind, g: number, dx: number, dy: number, a = 0) {
    const p = this.panAt(side);
    const { h } = dims(kind);
    this.items.push({ id: this.nextId++, kind, g, x: p.x + dx, y: p.y - h / 2 - dy, a, body: null, on: [-9, -9], fixed: side, fade: 0, vy: 0, vmax: 0 });
    this.recount();
  }

  private vanish(it: Item) {
    if (it.body && this.world) this.world.destroyBody(it.body);
    it.body = null;
    it.fade = 1;
  }

  reset() {
    for (const it of this.items) if (it.body && this.world) this.world.destroyBody(it.body);
    this.items = [];
    this.drag = null;
    this.recount();
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

  // ---------- geometry ----------

  private beamEnd(side: Side) {
    const s = side === 0 ? -1 : 1;
    return { x: PIVOT.x + s * ARM * Math.cos(this.theta), y: PIVOT.y + s * ARM * Math.sin(this.theta) };
  }
  private panAt(side: Side) {
    const e = this.beamEnd(side);
    return { x: e.x, y: e.y + STRING };
  }

  private trayRects() {
    const n = ORDER.length;
    const slot = 70;
    const x0 = W / 2 - (n * slot) / 2;
    return ORDER.map((k, i) => ({ kind: k, x: x0 + i * slot, y: TRAY_Y + 6, w: slot, h: H - TRAY_Y - 12 }));
  }

  private sideAt(x: number, y: number): Side | null {
    if (y > TRAY_Y || y < 40) return null;
    return x < W / 2 ? 0 : 1;
  }

  // ---------- input ----------

  cursorAt(x: number, y: number): "grab" | "default" {
    return this.trayHit(x, y) || this.itemAt(x, y) ? "grab" : "default";
  }
  private trayHit(x: number, y: number) {
    return this.trayRects().find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ?? null;
  }
  private itemAt(x: number, y: number): Item | null {
    const world = this.world;
    if (!world) return null;
    const p = { x: x / S, y: y / S };
    let found: Item | null = null;
    const r = 4 / S;
    world.queryAABB({ lowerBound: { x: p.x - r, y: p.y - r }, upperBound: { x: p.x + r, y: p.y + r } }, (f) => {
      const it = f.getBody().getUserData() as Item | null;
      if (!it) return true;
      // a little slack for tiny things
      const ok = f.testPoint(p) || dims(it.kind).w < 24;
      if (ok) found = it;
      return !ok;
    });
    return found;
  }

  down(x: number, y: number): BalanceEvent | null {
    const t = this.trayHit(x, y);
    if (t) {
      this.drag = { kind: t.kind, g: null, x, y, over: null, hold: 0, poured: 0, next: 0 };
      return null;
    }
    const it = this.itemAt(x, y);
    if (it) {
      if (it.body && this.world) this.world.destroyBody(it.body);
      this.items = this.items.filter((o) => o !== it);
      this.recount();
      this.drag = { kind: it.kind, g: it.g, x, y, over: this.sideAt(x, y), hold: 0, poured: 0, next: 0 };
      return { type: "lift", kind: it.kind };
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
    // let go over the tray: it goes back
    if (!d || d.y > TRAY_Y) return null;
    if (d.poured > 0) return null;
    const first = !this.seen.has(d.kind);
    this.seen.add(d.kind);
    this.spawn(d.kind, d.x, d.y, d.g ?? undefined);
    return { type: "drop", kind: d.kind, first };
  }

  leave() {
    this.hover = null;
  }

  step(dt: number): BalanceEvent[] {
    const out: BalanceEvent[] = [];
    this.time += dt;
    // pour tiny things while held over a pan: faster the longer you hold
    const d = this.drag;
    if (d && d.over !== null && d.g === null && POUR.has(d.kind)) {
      d.hold += dt;
      if (d.hold > 0.35) {
        const rate = Math.min(30, 4 + (d.hold - 0.35) * 12);
        d.next -= dt;
        let n = 0;
        while (d.next <= 0 && n < 3) {
          this.spawn(d.kind, d.x + (this.rand() - 0.5) * 16, d.y);
          d.poured++;
          d.next += 1 / rate;
          n++;
        }
        if (n) {
          if (!this.seen.has(d.kind)) {
            this.seen.add(d.kind);
            out.push({ type: "drop", kind: d.kind, first: true });
          }
          out.push({ type: "pour", kind: d.kind });
        }
      }
    }
    // physics, in fixed steps; the pans follow the beam
    const world = this.world;
    if (world) {
      this.acc = Math.min(this.acc + dt, HZ * 4);
      while (this.acc >= HZ) {
        this.acc -= HZ;
        for (const s of [0, 1] as const) {
          const b = this.panBodies[s];
          const p = this.panAt(s);
          const q = b.getPosition();
          b.setLinearVelocity({ x: (p.x / S - q.x) / HZ, y: (p.y / S - q.y) / HZ });
        }
        world.step(HZ, 10, 6);
        for (const it of this.items) {
          if (!it.body) continue;
          const v = it.body.getLinearVelocity();
          const sp = Math.hypot(v.x, v.y);
          if (sp > it.vmax) it.body.setLinearVelocity({ x: (v.x * it.vmax) / sp, y: (v.y * it.vmax) / sp });
        }
        this.beamStep(HZ);
      }
      // who is resting on which pan, through whatever they are resting on
      for (const s of [0, 1] as const) {
        const seen = new Set<Planck.Body>([this.panBodies[s]]);
        const queue = [this.panBodies[s]];
        while (queue.length) {
          const b = queue.pop()!;
          for (let e = b.getContactList(); e; e = e.next) {
            if (!e.contact.isTouching() || !e.other || seen.has(e.other)) continue;
            const it = e.other.getUserData() as Item | null;
            if (!it) continue;
            seen.add(e.other);
            it.on[s] = this.time;
            queue.push(e.other);
          }
        }
      }
      for (const it of this.items) {
        if (!it.body) continue;
        const p = it.body.getPosition();
        it.x = p.x * S;
        it.y = p.y * S;
        it.a = it.body.getAngle();
        // off the edge and down past the floor: gone
        if (it.y > FLOOR + 10 || it.x < -150 || it.x > W + 150) {
          it.vy = it.body.getLinearVelocity().y * S;
          this.vanish(it);
          if (!this.fellSaid) {
            this.fellSaid = true;
            out.push({ type: "fell", kind: it.kind });
          }
        }
      }
    } else this.beamStep(dt);
    // the vanishing
    for (const it of this.items)
      if (it.fade > 0) {
        it.fade -= dt * 2.2;
        it.y += it.vy * dt;
        it.vy += 600 * dt;
      }
    this.items = this.items.filter((it) => it.fade > 0 || it.body || it.fixed !== null);
    this.recount();
    // the living things do not stay put forever
    for (const s of [0, 1] as const) {
      const here = this.items.filter((it) => this.onSide(it) === s && (it.kind === "ant" || it.kind === "cat"));
      const ants = here.filter((it) => it.kind === "ant");
      const cats = here.filter((it) => it.kind === "cat");
      const who = ants.length && this.rand() < ants.length * 0.002 * dt ? ants : cats.length && this.rand() < cats.length * 0.01 * dt ? cats : null;
      if (who) {
        const it = who[Math.floor(this.rand() * who.length)];
        it.vy = -40;
        this.vanish(it);
        this.recount();
        out.push({ type: "left", kind: it.kind });
      }
    }
    const lvl = this.both && Math.abs(this.diff) < LEVEL;
    if (lvl !== this.level) {
      this.level = lvl;
      out.push({ type: lvl ? "level" : "unlevel" });
    }
    return out;
  }

  // the beam: a damped spring towards where the weights put it
  private beamStep(dt: number) {
    const all = this.sums[0] + this.sums[1];
    const target = all > 0 ? -MAX_A * Math.tanh((GAIN * this.diff) / all) : 0;
    // a heavy beam: slow and nearly critically damped, and never accelerating the pans faster than
    // gravity, so what is on a rising pan stays on it
    const alpha = clamp(-(this.theta - target) * 5 - this.omega * 4.4, -1.9, 1.9);
    this.omega = clamp(this.omega + alpha * dt, -0.7, 0.7);
    this.theta = clamp(this.theta + this.omega * dt, -MAX_A - 0.04, MAX_A + 0.04);
  }

  /** Put the beam where it would come to rest (for still frames). */
  settle() {
    const all = this.sums[0] + this.sums[1];
    const old = this.theta;
    this.theta = all > 0 ? -MAX_A * Math.tanh((GAIN * this.diff) / all) : 0;
    this.omega = 0;
    // fixed things ride along with their pan
    for (const s of [0, 1] as const) {
      const was = (() => {
        const t = this.theta;
        this.theta = old;
        const p = this.panAt(s);
        this.theta = t;
        return p;
      })();
      const now = this.panAt(s);
      for (const it of this.items)
        if (it.fixed === s) {
          it.x += now.x - was.x;
          it.y += now.y - was.y;
        }
    }
  }

  // ---------- drawing ----------

  draw(ctx: CanvasRenderingContext2D, opts: { tray?: boolean } = {}) {
    const tray = opts.tray ?? true;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#F7F4EE");
    g.addColorStop(1, "#EFEAE1");
    ctx.fillStyle = g;
    ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.fillStyle = "#E7DDCC";
    ctx.fillRect(-W, FLOOR, W * 3, H);
    ctx.fillStyle = "rgba(60,50,35,0.08)";
    ctx.fillRect(-W, FLOOR - 1, W * 3, 2);

    this.drawStand(ctx);
    for (const s of [0, 1] as const) this.drawPan(ctx, s);
    for (const it of this.items) {
      const dm = dims(it.kind);
      ctx.save();
      if (it.fade > 0) ctx.globalAlpha = clamp(it.fade, 0, 1);
      ctx.translate(it.x, it.y);
      ctx.rotate(it.a);
      ctx.translate(0, dm.h / 2);
      drawKind(ctx, it.kind, dm);
      ctx.restore();
    }
    this.drawBeam(ctx);
    this.drawDial(ctx);
    if (tray) this.drawTray(ctx);
    const d = this.drag;
    if (d) {
      if (d.over !== null && d.y < TRAY_Y) {
        const p = this.panAt(d.over);
        ctx.strokeStyle = "rgba(74,95,120,0.35)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 2, PAN_W / 2 + 10, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const dm = dims(d.kind);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.translate(d.x, d.y + dm.h / 2);
      drawKind(ctx, d.kind, dm);
      ctx.restore();
    } else if (tray && this.hover) {
      const t = this.trayHit(this.hover.x, this.hover.y);
      if (t) this.tip(ctx, t.x + t.w / 2, t.y - 8, `${KINDS[t.kind].name}, about ${fmtMass(KINDS[t.kind].g)}`);
      else {
        const it = this.itemAt(this.hover.x, this.hover.y);
        if (it) this.tip(ctx, it.x, it.y - dims(it.kind).h / 2 - 8, KINDS[it.kind].name);
      }
    }
  }

  private drawPan(ctx: CanvasRenderingContext2D, side: Side) {
    const e = this.beamEnd(side);
    const p = this.panAt(side);
    const half = PAN_W / 2;
    ctx.strokeStyle = "#6B6A65";
    ctx.lineWidth = 1.5;
    for (const dx of [-half + 3, 0, half - 3]) this.line(ctx, e.x, e.y, p.x + dx, p.y - (dx ? 12 : 0));
    ctx.fillStyle = "rgba(28,28,26,0.06)";
    ctx.beginPath();
    ctx.ellipse(p.x, FLOOR + 4, half * 0.8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // the dish, the plate and its little lips
    ctx.fillStyle = "#2E2D2A";
    ctx.beginPath();
    ctx.moveTo(p.x - half, p.y + 4);
    ctx.lineTo(p.x + half, p.y + 4);
    ctx.quadraticCurveTo(p.x + half - 10, p.y + 24, p.x, p.y + 26);
    ctx.quadraticCurveTo(p.x - half + 10, p.y + 24, p.x - half, p.y + 4);
    ctx.fill();
    ctx.fillStyle = "#57554F";
    roundRect(ctx, p.x - half, p.y, PAN_W, 6, 3);
    ctx.fill();
    for (const dx of [-1, 1]) {
      roundRect(ctx, p.x + dx * (half - 3) - 3, p.y - 13, 6, 16, 2);
      ctx.fill();
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
      const s = clamp(sizeOf(r.kind) * 0.5, 14, 44);
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
