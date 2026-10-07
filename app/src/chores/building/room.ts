// The building's shared state: everything in it that anybody can fix, carry off or make a mess
// of, shared by everyone who has ever been in. Pure logic, run by the room server and, when
// there's no connection, by the page itself.
import type { Presence, RoomKind } from "../../lib/roomHub";
import { deeds, residents, type NpcDeed } from "./npc";
import { BASEMENT, DOOR_MS, LAST, LIFT_BOTTOM, LIFT_MS, LIFT_TOP, LOBBY, WALK_X0, WALK_X1, floorY, levelAt } from "./world";

export type Lift = {
  /** The storey it's at, or left from. */
  at: number;
  /** The storey it's going to (same as `at` when it's standing still). */
  to: number;
  /** When it was sent on its way (it leaves once the doors have shut). */
  t0: number;
  /** The doors are open until then. */
  open: number;
  queue: number[];
};

/** A sock on the line (0), blown onto the roof (1), or blown off the building into the street (2). */
export type SockAt = 0 | 1 | 2;

export type ItemKind = "remote" | "bag" | "roll" | "mop" | "sponge" | "menus";
const ITEM_KINDS: ItemKind[] = ["remote", "bag", "roll", "mop", "sponge", "menus"];

/** Clothes on the coat stand on Floor 5: anyone can put one on, and it comes off by itself. */
export type Garment = "hat" | "scarf" | "gown" | "coat";
export const GARMENTS: Garment[] = ["hat", "scarf", "gown", "coat"];
export const WEAR_MS = 60_000;
/** Something that can be picked up and put down anywhere: on a floor (l), at x, dy above the
 *  floor (on a table, a shelf…), or in somebody's hand. l is -1 while it's out of the building. */
export type Item = { id: string; kind: ItemKind; l: number; x: number; dy: number; held: string };

export type MarkKind = "ring" | "soup" | "mud" | "water" | "hair" | "print";
/** A mark: a mug ring, a drip, mud, a puddle, cat hair, a footprint (of whatever the feet
 *  were in). At world x, y; strength s when made at t (some dry off as time passes). */
export type Mark = { k: MarkKind; x: number; y: number; s: number; t: number; c?: MarkKind; by?: string };

export type BuildingState = {
  v: 4;
  /** The picture on Floor 5: degrees off level, times straightened, when. */
  frame: { a: number; n: number; t: number };
  /** The kitchen tap on Floor 3: how far open (0..1), drips counted up to time t, times shut. */
  tap: { h: number; drips: number; t: number; n: number };
  lift: Lift;
  /** Nine socks, and the last gust: which sock it took, when, and where it put it. */
  socks: { at: SockAt[]; t: number; gust: { i: number; t: number; to: SockAt } | null };
  /** The aerial's bearing in degrees. */
  aerial: number;
  lamp: boolean;
  /** The fridge door: 0 shut, 1 wide open. */
  fridge: number;
  /** Boxes still packed, and how many have been opened. */
  boxes: { n: number; opened: number };
  /** Dirty plates by the sink. */
  dishes: number;
  /** The plant on Floor 2: its water at time t (it dries out as time passes). */
  plant: { w: number; t: number };
  /** Where the desk chair is: 444 pushed in, 511 out. */
  chair: number;
  /** The doormat's angle in degrees. */
  mat: number;
  /** Pizza menus stuffed into post box 4B (everybody's end up there). */
  menus: number;
  /** The basement light is on until then. */
  light: number;
  /** The washing machine runs until then; socks that came out alone. */
  washer: { until: number; lone: number };
  items: Item[];
  marks: Mark[];
  /** The shoes by the front door: tidy (false) or all over the place. */
  shoes: boolean;
  /** Sheets left on the roll in the loo. */
  loo: number;
  /** Bags taken out to the bins, ever; and when the next one will be full. */
  bins: { out: number; next: number };
  /** Which channel the telly on 2 is on. */
  tv: number;
  /** Who is standing on the mat, by the shoes, by the chair (stepping in is what knocks them). */
  zone: { mat: string[]; chair: string[]; shoes: string[] };
  /** Whose feet are dirty, with what, for how many more steps, and where they last stepped. */
  feet: Record<string, { c: MarkKind; n: number; x: number; y: number }>;
  /** Who's wearing what off the coat stand, until when ("" when it's on the stand). */
  wear: Record<Garment, { by: string; until: number }>;
  /** Where each carried bag last dripped. */
  drip: Record<string, { x: number; y: number }>;
  /** The residents' doings are applied up to this time. */
  npcAt: number;
  visits: number;
};

// The frame hangs on a nail that lets it settle in steps of this many degrees. Level is one of
// them: it can be got exactly straight (until the cat).
export const FRAME_STEP = 0.25;
export const frameSnap = (a: number) => {
  const q = Math.round(a / FRAME_STEP) * FRAME_STEP;
  return Math.round(Math.max(-12, Math.min(12, q)) * 100) / 100 || 0;
};
const GUST_MS = 2.5 * 60 * 1000;
export const LIGHT_MS = 30 * 1000;
export const WASH_MS = 60 * 1000;
export const BOXES_MIN = 3;
export const MAIL_BOXES = 12;
export const CHAIR_IN = 444;
export const CHAIR_OUT = 511;
export const chairIn = (x: number) => x < 456;
export const TV_CHANNELS = ["WEATHER", "SNOOKER", "SHOPPING", "QUIZ"];
const BAG_MS = 90 * 1000;
const MAX_MARKS = 160;
/** Footprints you leave after stepping in something. */
export const FEET_STEPS = 6;

// Where people knock things over just by walking past (world x ranges; see the engine).
export const MAT_X = [244, 340];
export const SHOES_X = [336, 396];
export const CHAIR_X = [478, 544];
export const CHAIR_LEVEL = 4;

/** Things you can put stuff down on: floor, x range, height above the floor. */
export const SURFACES: { l: number; x0: number; x1: number; dy: number; name: string }[] = [
  { l: 1, x0: 414, x1: 626, dy: 46, name: "sofa" },
  { l: 2, x0: 462, x1: 608, dy: 22, name: "mattress" },
  { l: 3, x0: 430, x1: 520, dy: 190, name: "shelf" },
  { l: 3, x0: 414, x1: 746, dy: 104, name: "counter" },
  { l: 4, x0: 302, x1: 468, dy: 76, name: "desk" },
  { l: LOBBY, x0: 522, x1: 658, dy: 40, name: "bench" },
  { l: BASEMENT, x0: 642, x1: 730, dy: 96, name: "washer" },
  { l: BASEMENT, x0: 300, x1: 362, dy: 150, name: "store" },
];
// Where things go when they're put where they belong.
export const BINS = { l: BASEMENT, x0: 396, x1: 474 };
export const LOO = { l: LOBBY, x0: 686, x1: 750 };
export const KITCHEN_BIN = { l: 3, x: 404 };
const HOMES: Record<ItemKind, { l: number; x0: number; x1: number; dy: number }> = {
  remote: { l: 4, x0: 302, x1: 468, dy: 76 },
  bag: { l: BASEMENT, x0: BINS.x0, x1: BINS.x1, dy: 0 },
  roll: { l: LOBBY, x0: LOO.x0, x1: LOO.x1, dy: 0 },
  mop: { l: BASEMENT, x0: 364, x1: 396, dy: 0 },
  sponge: { l: BASEMENT, x0: 300, x1: 362, dy: 150 },
  menus: { l: BASEMENT, x0: BINS.x0, x1: BINS.x1, dy: 0 },
};
export const isHome = (it: { kind: ItemKind; l: number; x: number; dy: number }) => {
  const h = HOMES[it.kind];
  return it.l === h.l && it.x >= h.x0 && it.x <= h.x1 && it.dy === h.dy;
};
const ROLL_HOME = { l: BASEMENT, x: 316, dy: 150 };

/** How strong a mark is now: puddles dry off quickly, footprints slowly, the rest stay. */
export function markNow(m: Mark, now: number) {
  const life = m.k === "water" ? 45_000 : m.k === "print" ? (m.c === "water" ? 60_000 : 6 * 60_000) : 0;
  if (!life) return m.s;
  return m.s * Math.max(0, 1 - (now - m.t) / life);
}
/** How clean the building is, in percent. */
export function cleanliness(s: BuildingState, now: number) {
  let dirt = 0;
  for (const m of s.marks) if (m.k !== "water") dirt += markNow(m, now) * (m.k === "print" ? 0.4 : 1);
  return Math.max(0, Math.min(100, Math.round(100 - dirt * 2.2)));
}

/** Drips a second: shut, it still drips now and then; a little open, faster; open, it runs. */
export function dripRate(h: number) {
  if (h <= 0) return 1 / 7;
  if (h < 0.18) return 1 / 7 + (h / 0.18) * 2.4;
  return 6 + h * 12;
}
export const drips = (s: BuildingState, now: number) => s.tap.drips + (dripRate(s.tap.h) * Math.max(0, now - s.tap.t)) / 1000;

/** The aerial's signal, in percent. Pointed the best way it gets 94, never more. */
const BEST = 215;
export const signal = (deg: number) => Math.round(94 * ((1 + Math.cos(((deg - BEST) * Math.PI) / 180)) / 2));

/** The plant's water now: it loses a little every minute. Under 0.3 it wilts, over 1 it drowns. */
export const water = (s: BuildingState, now: number) => Math.max(0, s.plant.w - (Math.max(0, now - s.plant.t) / 60000) * 0.06);
export const plantMood = (w: number) => (w < 0.3 ? "dry" : w > 1 ? "drowned" : "fine");

/** Where the lift is (in storeys, fractional while it moves). */
export function liftLevel(l: Lift, now: number) {
  if (l.to === l.at) return l.at;
  const start = Math.max(l.t0, l.open);
  if (now < start) return l.at;
  const d = Math.abs(l.to - l.at);
  const p = (now - start) / LIFT_MS;
  if (p >= d) return l.to;
  return l.at + Math.sign(l.to - l.at) * p;
}
export const doorsOpen = (l: Lift, now: number) => now < l.open && liftLevel(l, now) === l.at;

const isLiftLevel = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= LIFT_TOP && v <= LIFT_BOTTOM;
const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);

function call(l: Lift, level: number, now: number) {
  if (l.to === l.at) {
    if (level === l.at) {
      l.open = Math.max(l.open, now + DOOR_MS);
      return;
    }
    l.to = level;
    l.t0 = now;
    return;
  }
  if (level !== l.to && !l.queue.includes(level) && l.queue.length < 6) l.queue.push(level);
}

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const kickMat = (s: BuildingState) => (s.mat = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 8));
export const heldBy = (s: BuildingState, who: string) => s.items.find((i) => i.held === who) ?? null;

export function addMark(s: BuildingState, m: Mark) {
  s.marks.push(m);
  if (s.marks.length > MAX_MARKS) {
    // forget the faintest
    let worst = 0;
    for (let i = 1; i < s.marks.length; i++) if (markNow(s.marks[i], m.t) < markNow(s.marks[worst], m.t)) worst = i;
    s.marks.splice(worst, 1);
  }
}

function freshItems(): Item[] {
  return [
    { id: "remote", kind: "remote", l: 2, x: 486, dy: 22, held: "" },
    { id: "bag", kind: "bag", l: 3, x: KITCHEN_BIN.x, dy: 0, held: "" },
    { id: "roll", kind: "roll", l: ROLL_HOME.l, x: ROLL_HOME.x, dy: ROLL_HOME.dy, held: "" },
    { id: "mop", kind: "mop", l: BASEMENT, x: 380, dy: 0, held: "" },
    // two more mops, left about where they were last needed
    { id: "mop2", kind: "mop", l: 3, x: 440, dy: 0, held: "" },
    { id: "mop3", kind: "mop", l: LOBBY, x: 672, dy: 0, held: "" },
    { id: "sponge", kind: "sponge", l: BASEMENT, x: 344, dy: 150, held: "" },
    // the menus out of 4B, when somebody has taken them out (until then, nowhere)
    { id: "menus", kind: "menus", l: -1, x: 0, dy: 0, held: "" },
  ];
}

function fresh(now: number): BuildingState {
  const marks: Mark[] = [];
  // a building that has been lived in: rings, a trail of soup, some mud by the door
  marks.push({ k: "ring", x: 560, y: floorY(1) - 46, s: 0.8, t: now }, { k: "ring", x: 380, y: floorY(4) - 76, s: 0.7, t: now });
  for (let i = 0; i < 5; i++) marks.push({ k: "soup", x: 404 - i * 46, y: floorY(3), s: 0.7, t: now });
  for (let i = 0; i < 4; i++) marks.push({ k: "print", c: "mud", x: 300 + i * 38, y: floorY(LOBBY), s: 0.6, t: now });
  marks.push({ k: "hair", x: 520, y: floorY(1) - 46, s: 0.8, t: now });
  return {
    v: 4,
    frame: { a: 1.35, n: 0, t: 0 },
    tap: { h: 0.32, drips: 0, t: now, n: 0 },
    lift: { at: 2, to: 2, t0: now, open: 0, queue: [] },
    socks: { at: [0, 1, 0, 0, 1, 0, 0, 0, 1], t: now, gust: null },
    aerial: 60,
    lamp: false,
    fridge: 1,
    boxes: { n: 14, opened: 0 },
    dishes: 5,
    plant: { w: 0.1, t: now },
    chair: CHAIR_OUT,
    mat: 9,
    menus: 6,
    light: 0,
    washer: { until: 0, lone: 0 },
    items: freshItems(),
    marks,
    shoes: true,
    loo: 1,
    bins: { out: 0, next: 0 },
    tv: 0,
    wear: { hat: { by: "", until: 0 }, scarf: { by: "", until: 0 }, gown: { by: "", until: 0 }, coat: { by: "", until: 0 } },
    zone: { mat: [], chair: [], shoes: [] },
    feet: {},
    drip: {},
    npcAt: now,
    visits: 0,
  };
}

/** Apply what the residents did. */
function deed(s: BuildingState, d: NpcDeed, t: number) {
  const item = (id: string) => s.items.find((i) => i.id === id);
  switch (d) {
    case "fridge":
      s.fridge = 1;
      break;
    case "dish":
      s.dishes = Math.min(8, s.dishes + 1);
      break;
    case "mat":
      kickMat(s);
      break;
    case "shoes":
      s.shoes = true;
      break;
    case "mail":
      s.menus = Math.min(12, s.menus + 4);
      break;
    case "frame":
      s.frame.a = frameSnap(s.frame.a + (Math.random() < 0.5 ? -1 : 1) * FRAME_STEP * (1 + Math.floor(Math.random() * 3)));
      break;
    case "remoteTake": {
      const r = item("remote");
      if (r && !r.held && r.l === 4) r.held = "npc:cat";
      break;
    }
    case "remoteDrop": {
      // wherever the cat has got to: on whatever it's sitting on, or the floor
      const r = item("remote");
      const cat = residents(t).find((c) => c.id === "cat");
      if (r && r.held === "npc:cat" && cat) {
        const l = levelAt(cat.y);
        const x = Math.max(WALK_X0, Math.min(WALK_X1, Math.round(cat.x)));
        const dy = SURFACES.some((f) => f.l === l && f.dy === cat.lift && x >= f.x0 && x <= f.x1) ? cat.lift : 0;
        Object.assign(r, { held: "", l, x, dy });
      }
      break;
    }
    case "hair": {
      const cat = residents(t).find((r) => r.id === "cat");
      if (cat) for (let i = 0; i < 2; i++) addMark(s, { k: "hair", x: cat.x - 10 + i * 18, y: cat.y - cat.lift, s: 0.8, t });
      break;
    }
    case "mud":
      for (let i = 0; i < 7; i++) addMark(s, { k: "print", c: "mud", x: 300 + i * 42, y: floorY(LOBBY), s: 0.85 - i * 0.07, t });
      break;
    case "loo":
      s.loo = Math.max(1, s.loo - 15);
      break;
  }
}

/** Put an item down: where it lands, and what happens if that's where it belongs. */
function putDown(s: BuildingState, it: Item, l: number, x: number, dy: number, now: number) {
  it.held = "";
  if ((it.kind === "bag" || it.kind === "menus") && l === BINS.l && x >= BINS.x0 && x <= BINS.x1) {
    // out it goes; the kitchen bin will be full again soon enough (and 4B sooner)
    it.l = -1;
    if (it.kind === "bag") {
      s.bins.out++;
      s.bins.next = now + BAG_MS;
    }
    return;
  }
  if (it.kind === "roll" && l === LOO.l && x >= LOO.x0 && x <= LOO.x1) {
    s.loo = 40;
    Object.assign(it, ROLL_HOME);
    return;
  }
  Object.assign(it, { l, x, dy });
}

export const building: RoomKind<BuildingState> = {
  init: fresh,

  revive(raw, now) {
    const s = raw as Partial<BuildingState> & { v?: number };
    if (!s || !s.frame || !s.tap) return null;
    if (s.v === 4) {
      const n = { ...fresh(now), ...s, zone: { mat: [], chair: [], shoes: [] }, feet: {}, drip: {}, npcAt: Math.max(s.npcAt ?? 0, now - 60_000) } as BuildingState;
      // things the building no longer has, and anything new to it since it was last saved
      n.items = n.items.filter((i) => ITEM_KINDS.includes(i.kind));
      for (const it of freshItems()) if (!n.items.some((i) => i.id === it.id)) n.items.push(it);
      n.wear = fresh(now).wear;
      if (typeof n.menus !== "number") n.menus = 6;
      // nobody is holding anything any more
      for (const it of n.items) if (it.held && !it.held.startsWith("npc:")) it.held = "";
      return n;
    }
    // an older building: keep the picture, the tap and the visitors' book
    const n = fresh(now);
    n.frame = { a: s.frame.a, n: s.frame.n, t: s.frame.t };
    n.tap = s.tap;
    n.visits = s.visits ?? 0;
    return n;
  },

  act(s, who, msg, now) {
    switch (msg.what) {
      case "hello":
        s.visits++;
        return true;
      case "frame": {
        const a = num(msg.a, -12, 12);
        if (a === null) return false;
        s.frame.a = frameSnap(a);
        if (!msg.live) {
          s.frame.n++;
          s.frame.t = now;
        }
        return true;
      }
      case "tap": {
        const h0 = num(msg.h, 0, 1);
        if (h0 === null) return false;
        const h = Math.round(h0 * 100) / 100;
        s.tap.drips = drips(s, now);
        s.tap.t = now;
        if (h === 0 && s.tap.h > 0) s.tap.n++;
        s.tap.h = h;
        return true;
      }
      case "call":
        if (!isLiftLevel(msg.level)) return false;
        call(s.lift, msg.level, now);
        return true;
      case "sock": {
        const i = msg.i;
        if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= s.socks.at.length || s.socks.at[i] !== 1) return false;
        if (msg.to !== 0) return false;
        s.socks.at[i] = 0;
        return true;
      }
      case "aerial": {
        const a = num(msg.a, -1e6, 1e6);
        if (a === null) return false;
        s.aerial = ((Math.round(a) % 360) + 360) % 360;
        return true;
      }
      case "lamp":
        s.lamp = !s.lamp;
        return true;
      case "fridge": {
        const d = num(msg.d, 0, 1);
        if (d === null) return false;
        s.fridge = Math.round(d * 100) / 100;
        return true;
      }
      case "box":
        if (s.boxes.n <= BOXES_MIN) return false;
        s.boxes.opened++;
        // every third box has another box in it
        if (s.boxes.opened % 3 !== 0) s.boxes.n--;
        return true;
      case "dish":
        if (s.dishes <= 0) return false;
        s.dishes--;
        return true;
      case "water": {
        const amt = num(msg.amt, 0, 0.3);
        if (amt === null) return false;
        s.plant.w = Math.min(1.6, water(s, now) + amt);
        s.plant.t = now;
        return true;
      }
      case "chair": {
        const x = num(msg.x, CHAIR_IN, 540);
        if (x === null) return false;
        s.chair = Math.round(x);
        return true;
      }
      case "mat":
        // as straight as a mat gets
        s.mat = Math.random() < 0.5 ? -0.8 : 0.8;
        return true;
      case "shoes":
        s.shoes = false;
        return true;
      case "menus": {
        // empty 4B into your hands (if nobody's already walking about with a pile)
        const m = s.items.find((i) => i.kind === "menus");
        if (!m || s.menus <= 0 || m.l >= 0 || m.held || heldBy(s, who)) return false;
        m.held = who;
        s.menus = 0;
        return true;
      }
      case "light":
        s.light = now + LIGHT_MS;
        return true;
      case "wash":
        if (now < s.washer.until) return false;
        s.washer.until = now + WASH_MS;
        return true;
      case "tv":
        if (heldBy(s, who)?.kind !== "remote") return false;
        s.tv = (s.tv + 1) % TV_CHANNELS.length;
        return true;
      case "wear": {
        // off the stand and on (or back on the stand, if it's yours)
        const g = msg.g as Garment;
        if (!GARMENTS.includes(g)) return false;
        const w = s.wear[g];
        if (w.by === who) {
          s.wear[g] = { by: "", until: 0 };
          return true;
        }
        if (w.by && now < w.until) return false;
        s.wear[g] = { by: who, until: now + WEAR_MS };
        return true;
      }
      case "pick": {
        const it = s.items.find((i) => i.id === msg.id);
        if (!it || it.held || it.l < 0 || heldBy(s, who)) return false;
        it.held = who;
        return true;
      }
      case "drop": {
        const it = heldBy(s, who);
        const l = msg.l;
        const x = num(msg.x, WALK_X0, WALK_X1);
        const dy = num(msg.dy, 0, 200);
        if (!it || it.id !== msg.id || typeof l !== "number" || !Number.isInteger(l) || l < 0 || l > LAST || x === null || dy === null) return false;
        if (dy && !SURFACES.some((f) => f.l === l && f.dy === dy && x >= f.x0 && x <= f.x1)) return false;
        putDown(s, it, l, Math.round(x), dy, now);
        return true;
      }
      case "scrub": {
        // a mop for floors, a sponge for anything; either way, wipe what's under it
        const tool = heldBy(s, who);
        const x = num(msg.x, 0, 1000);
        const y = num(msg.y, 0, 4000);
        if (!tool || (tool.kind !== "mop" && tool.kind !== "sponge") || x === null || y === null) return false;
        const r = tool.kind === "mop" ? 28 : 20;
        let hit = false;
        for (const m of s.marks) {
          if (Math.abs(m.x - x) > r || Math.abs(m.y - y) > (tool.kind === "mop" ? 14 : 20)) continue;
          if (m.k === "water" && tool.kind === "mop") continue;
          m.s = markNow(m, now) - 0.34;
          m.t = now;
          hit = true;
        }
        s.marks = s.marks.filter((m) => markNow(m, now) > 0.04);
        // and a mop leaves the floor wet
        const fy = floorY(levelAt(y));
        if (tool.kind === "mop" && Math.abs(y - fy) < 16 && Math.random() < 0.35 && !s.marks.some((m) => m.k === "water" && Math.abs(m.x - x) < 22 && m.y === fy))
          addMark(s, { k: "water", x, y: fy, s: 0.8, t: now });
        return hit || tool.kind === "mop";
      }
    }
    return false;
  },

  tick(s, now, people, observer) {
    let changed = false;
    // the residents get up to their usual
    if (now > s.npcAt) {
      for (const d of deeds(Math.max(s.npcAt, now - 10 * 60_000), now)) {
        deed(s, d.deed, d.t);
        changed = true;
      }
      s.npcAt = now;
    }
    // a gust takes a sock off the line: onto the roof, or now and then over the edge
    if (now - s.socks.t > GUST_MS) {
      s.socks.t = now;
      const up = s.socks.at.map((a, i) => (a === 0 ? i : -1)).filter((i) => i >= 0);
      if (up.length) {
        const i = pick(up);
        const to: SockAt = Math.random() < 0.3 ? 2 : 1;
        s.socks.at[i] = to;
        s.socks.gust = { i, t: now, to };
        changed = true;
      }
    }
    if (s.washer.until && now >= s.washer.until) {
      s.washer.until = 0;
      s.washer.lone++;
      // one sock comes back from the street, by way of the wash, onto the roof
      const lost = s.socks.at.indexOf(2);
      if (lost >= 0) s.socks.at[lost] = 1;
      changed = true;
    }
    // clothes come off by themselves after a while (or when whoever had them on has gone)
    for (const g of GARMENTS) {
      const w = s.wear[g];
      if (w.by && (now >= w.until || (!observer && !w.by.startsWith("npc:") && !people.has(w.by)))) {
        s.wear[g] = { by: "", until: 0 };
        changed = true;
      }
    }
    // the kitchen bin fills up again
    const bag = s.items.find((i) => i.kind === "bag");
    if (bag && bag.l < 0 && !bag.held && now >= s.bins.next) {
      Object.assign(bag, { l: 3, x: KITCHEN_BIN.x, dy: 0 });
      changed = true;
    }
    // things in the hands of people who have gone: dropped where they were last seen
    for (const it of s.items) {
      if (!it.held || it.held.startsWith("npc:")) continue;
      const p = people.get(it.held);
      if (p) {
        it.l = levelAt(p[1]);
        it.x = Math.max(WALK_X0, Math.min(WALK_X1, p[0]));
        it.dy = 0;
        // a bin bag leaks, all the way
        if (it.kind === "bag" && p[3]) {
          const last = s.drip[it.id];
          if (!last || Math.hypot(p[0] - last.x, p[1] - last.y) > 80) {
            s.drip[it.id] = { x: p[0], y: p[1] };
            addMark(s, { k: "soup", x: p[0] + p[2] * 12, y: p[1], s: 0.5, t: now });
            changed = true;
          }
        }
      } else if (!observer) {
        it.held = "";
        changed = true;
      }
    }
    // feet: step in something wet and you take it with you, a footprint at a time
    for (const [id, p] of people) {
      const [x, y, dir, walking] = p;
      if (!walking) continue;
      // (and what you stepped in gets fainter: you took some of it with you)
      const wet = s.marks.find((m) => (m.k === "soup" || m.k === "mud" || m.k === "water") && Math.abs(m.x - x) < 16 && Math.abs(m.y - y) < 8 && markNow(m, now) > 0.35);
      if (wet && (!s.feet[id] || s.feet[id].n < FEET_STEPS - 1)) {
        s.feet[id] = { c: wet.k, n: FEET_STEPS, x, y };
        wet.s = markNow(wet, now) - 0.2;
        wet.t = now;
      }
      const f = s.feet[id];
      if (f && f.n > 0 && Math.hypot(x - f.x, y - f.y) > 36) {
        addMark(s, { k: "print", c: f.c, x: x - dir * 4, y, s: 0.2 + 0.6 * (f.n / FEET_STEPS), t: now, by: id });
        f.n--;
        f.x = x;
        f.y = y;
        changed = true;
      }
      if (f && f.n <= 0) delete s.feet[id];
    }
    for (const id of Object.keys(s.feet)) if (!people.has(id)) delete s.feet[id];
    // stepping onto the mat rucks it up (about half the time)
    const onMat: string[] = [];
    for (const [id, p] of people) {
      const [x, y] = p;
      const l = levelAt(y);
      if (l === LOBBY && x > MAT_X[0] && x < MAT_X[1]) onMat.push(id);
    }
    for (const id of onMat)
      if (!s.zone.mat.includes(id) && Math.abs(s.mat) < 3 && Math.random() < 0.5) {
        kickMat(s);
        changed = true;
      }
    s.zone = { mat: onMat, chair: [], shoes: [] };
    const l = s.lift;
    if (l.to !== l.at && liftLevel(l, now) === l.to) {
      const arrived = Math.max(l.t0, l.open) + Math.abs(l.to - l.at) * LIFT_MS;
      l.at = l.to;
      l.open = arrived + DOOR_MS;
      const next = l.queue.shift();
      if (next !== undefined && next !== l.at) {
        l.to = next;
        l.t0 = l.open;
      }
      changed = true;
    }
    return { changed };
  },
};

export const lightOn = (s: BuildingState, now: number) => now < s.light;
export const washing = (s: BuildingState, now: number) => now < s.washer.until;
export { BASEMENT };
export type { Presence };
