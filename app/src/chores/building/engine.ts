// The Building: a block of flats in cross-section that everyone walks around in at once. The
// pointer is where you want to be; your little person walks there, taking the stairs (or the
// lift) between floors. A few things in the building are shared by everyone, and none of them
// can quite be fixed. Pure TypeScript + canvas 2D, no browser globals at import time.
import {
  BASEMENT,
  CAR_X0,
  CAR_X1,
  FH,
  H,
  LAST,
  LEVELS,
  LIFT_BOTTOM,
  LIFT_TOP,
  LOBBY,
  ROOF,
  ROOF_Y,
  SHAFT_X0,
  SHAFT_X1,
  STAIR_X0,
  STAIR_X1,
  W,
  WALK_X0,
  WALK_X1,
  WALL_X0,
  WALL_X1,
  WORLD_H,
  floorY,
  levelAt,
} from "./world";
import { DEED_LEVEL, NPC_LINES, botX, deeds, residents, topX, type NpcView } from "./npc";
import {
  BINS,
  FEET_STEPS,
  BOXES_MIN,
  CHAIR_IN,
  KITCHEN_BIN,
  LOO,
  MAT_X,
  SURFACES,
  TV_CHANNELS,
  building,
  chairIn,
  cleanliness,
  heldBy,
  isHome,
  markNow,
  GARMENTS,
  type Garment,
  type Item,
  type ItemKind,
  type Mark,
  doorsOpen,
  dripRate,
  drips,
  frameSnap,
  liftLevel,
  lightOn,
  plantMood,
  signal,
  washing,
  water,
  type BuildingState,
} from "./room";

export { W, H, LEVELS };

const INK = "#1C1C1A";
const PEN = "#2D4C9A";
const SKIN = ["#EAD3B8", "#D9B48F", "#C08E64", "#8D5B3B", "#F0DCC6"];
export const HUES = ["#C0533F", "#2D4C9A", "#4F7A5A", "#B98A2E", "#7A5C8E", "#3E7C86", "#A35D7A", "#5E6B3A"];
const WALLS = ["#DCE6EC", "#E9DFCC", "#E3E1D6", "#DDE4DA", "#E8DAD2", "#E4E0D4", "#CFCAC0"];

const WALK = 250; // px a second
const STAIR_MS = 900; // one flight
const SLAB = 14;
const REACH = 170;
const CAM_FEET = 440; // where your feet sit on screen
// the floor buttons down the right-hand side
const IND_Y0 = 70;
const IND_STEP = 40;

// The thing everybody gets their hands on.
const FRAME = { level: 1, x: 520, y: floorY(1) - 156, w: 132, h: 92 };
const TAP = { level: 3, x: 566, y: floorY(3) - 128 };
const HANDLE = { x: TAP.x + 26, y: TAP.y - 8 };
const CALL_X = 772;

/** Things you can only look at, for a note. Rects in world coords. */
const NOTES: { level: number; x: number; y: number; w: number; h: number; note: string }[] = [
  { level: ROOF, x: 600, y: ROOF_Y - 150, w: 110, h: 150, note: "Do not drink. Nobody knows why it says that." },
  { level: 1, x: 410, y: floorY(1) - 74, w: 220, h: 74, note: "The cushions have been flipped to the good side." },
  { level: 2, x: 456, y: floorY(2) - 34, w: 158, h: 34, note: "A mattress on the floor. Temporary, since 2022." },
  { level: 3, x: 280, y: floorY(3) - 196, w: 110, h: 100, note: "The neighbour's window. You looked." },
  { level: 3, x: 640, y: floorY(3) - 130, w: 70, h: 30, note: "One fork, drying since Tuesday." },
  { level: 4, x: 300, y: floorY(4) - 66, w: 160, h: 66, note: "Every cable is the same black. One of them is important." },
  { level: LOBBY, x: 400, y: floorY(LOBBY) - 190, w: 90, h: 70, note: "LIFT IS FINE NOW. Management, 2019." },
  { level: BASEMENT, x: 300, y: floorY(BASEMENT) - 100, w: 70, h: 100, note: "Forty-one umbrellas. Nobody owns any of them." },
  { level: BASEMENT, x: 470, y: floorY(BASEMENT) - 190, w: 140, h: 190, note: "It makes a noise every eleven minutes. It is fine." },
];
const FRONT_DOOR = { x: 254, y: floorY(LOBBY) - 112, w: 72, h: 112 };

export const LEVEL_LINES = [
  "The roof. Socks everywhere.",
  "Floor 5. The picture is not straight.",
  "Floor 4. Someone left the fridge open.",
  "Floor 3. You can hear the tap.",
  "Floor 2. The telly is all snow.",
  "The lobby. Mind the mat.",
  "The basement. The light is on a timer.",
];

export type Fix =
  | "frame" | "tap" | "socks" | "aerial" | "lamp" | "fridge" | "boxes" | "dishes" | "plant" | "chair" | "mat" | "mail" | "light" | "washer"
  | "clean" | "back" | "bins" | "loo" | Garment;

type Thing = {
  id: Fix;
  level: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** What you'd do to it right now, shown when you point at it; null when there's nothing to do. */
  verb: (s: BuildingState, now: number) => string | null;
  /** Click it: returns the line to show, and whether that counts as fixing it. */
  use?: (b: Building, now: number) => { line: string; fixed: boolean };
  /** Or take hold of it and drag. */
  grab?: (b: Building, now: number) => Hold | null;
};

// The coat rail on Floor 5: four hooks, four things to put on.
const RAIL_Y = floorY(1) - 176;
const HOOK_X: Record<Garment, number> = { hat: 254, scarf: 278, gown: 302, coat: 326 };
const HANG: Record<Garment, number> = { hat: 26, scarf: 80, gown: 116, coat: 96 };
export const GARMENT_NAMES: Record<Garment, string> = { hat: "bobble hat", scarf: "scarf", gown: "dressing gown", coat: "raincoat" };
const WEAR_LINES: Record<Garment, string> = {
  hat: "A bobble hat. Slightly too small. Everybody can see.",
  scarf: "A very long scarf. It trails.",
  gown: "Somebody's dressing gown. Still warm.",
  coat: "A raincoat. It never rains in here.",
};
const onStand = (s: BuildingState, g: Garment, now: number) => !s.wear[g].by || now >= s.wear[g].until;
const coatThing = (g: Garment): Thing => ({
  id: g, level: 1, x: HOOK_X[g] - 11, y: RAIL_Y, w: 22, h: HANG[g] + 4,
  verb: (s, now) => (onStand(s, g, now) ? `put on the ${GARMENT_NAMES[g]}` : null),
  use: (b) => {
    b.act({ what: "wear", g });
    return { line: WEAR_LINES[g], fixed: false };
  },
});

const boxName = (i: number) => `${(i % 4) + 1}${"ABC"[Math.floor(i / 4)]}`;
const Y = floorY;

// Where things are. The fridge door is hinged at its left edge and swings out towards you.
const FRIDGE = { x: 640, w: 80, h: 168 };
const fridgeEdge = (d: number) => FRIDGE.x + FRIDGE.w - 160 * d;
const LINE_Y = ROOF_Y - 112;
const CAN_HOME = { x: 642, y: Y(4) };
const PLANT_X = 702;
const RACK = { x0: 632, x1: 716 };

/** Everything in the building that anybody can do something about. */
const THINGS: Thing[] = [
  ...GARMENTS.map(coatThing),
  {
    id: "socks", level: ROOF, x: 290, y: ROOF_Y - 40, w: 270, h: 40,
    verb: (s) => (s.socks.at.includes(1) ? "pick one up" : null),
    grab: (b) => {
      const i = b.fallenSock();
      return i < 0 ? null : { kind: "sock", i };
    },
  },
  { id: "aerial", level: ROOF, x: 404, y: ROOF_Y - 206, w: 62, h: 160, verb: () => "drag to turn", grab: (b) => ({ kind: "aerial", a0: b.state.aerial, x0: b.px, a: b.state.aerial, sent: 0 }) },
  {
    id: "frame", level: 1, x: FRAME.x - FRAME.w / 2 - 12, y: FRAME.y - FRAME.h / 2 - 36, w: FRAME.w + 24, h: FRAME.h + 48,
    verb: () => "drag it level",
    grab: (b) => ({ kind: "frame", a0: b.state.frame.a, x0: b.px, a: b.state.frame.a, sent: 0 }),
  },
  {
    id: "lamp", level: 1, x: 722, y: Y(1) - 160, w: 54, h: 160,
    verb: (s) => (s.lamp ? "switch off" : "switch on"),
    use: (b) => {
      b.act({ what: "lamp" });
      return b.state.lamp ? { line: "On. It flickers a bit.", fixed: true } : { line: "Off. Back to the gloom.", fixed: false };
    },
  },
  {
    id: "fridge", level: 2, x: 556, y: Y(2) - 172, w: 168, h: 172,
    verb: (s) => (s.fridge > 0.03 ? "drag the door shut" : "drag it open"),
    grab: (b) => ({ kind: "fridge", d: b.state.fridge, v: 0, t: performance.now(), sent: 0 }),
  },
  {
    id: "boxes", level: 2, x: 258, y: Y(2) - 180, w: 186, h: 180,
    verb: (s) => (s.boxes.n > BOXES_MIN ? "unpack one" : null),
    use: (b) => {
      const before = b.state.boxes.n;
      b.act({ what: "box" });
      const n = b.state.boxes.n;
      if (n === before) return { line: "Inside: another box. It says MISC.", fixed: true };
      return { line: n <= BOXES_MIN ? "Three left. These three are staying." : `Unpacked one. ${n} to go.`, fixed: true };
    },
  },
  { id: "dishes", level: 3, x: 432, y: Y(3) - 168, w: 84, h: 66, verb: (s) => (s.dishes ? "drag one to the rack" : null), grab: () => ({ kind: "plate" }) },
  { id: "tap", level: 3, x: HANDLE.x - 34, y: HANDLE.y - 34, w: 66, h: 54, verb: () => "drag down to shut", grab: (b) => ({ kind: "tap", h0: b.state.tap.h, y0: b.py, h: b.state.tap.h, sent: 0 }) },
  {
    id: "plant", level: 4, x: CAN_HOME.x - 24, y: CAN_HOME.y - 40, w: 48, h: 40,
    verb: () => "pick up the can",
    grab: () => ({ kind: "can", poured: 0, sent: 0 }),
  },
  {
    id: "chair", level: 4, x: 420, y: Y(4) - 102, w: 128, h: 102,
    verb: (s) => (chairIn(s.chair) ? null : "drag it in"),
    grab: (b) => ({ kind: "chair", x: b.state.chair, sent: 0 }),
  },
  {
    id: "mat", level: LOBBY, x: MAT_X[0], y: Y(LOBBY) - 30, w: MAT_X[1] - MAT_X[0], h: 30,
    verb: (s) => (Math.abs(s.mat) >= 3 ? "straighten it" : null),
    use: (b) => {
      b.act({ what: "mat" });
      return { line: "Straight. Well, nearly. Don't step on it.", fixed: true };
    },
  },
  {
    id: "mail", level: LOBBY, x: 516, y: Y(LOBBY) - 176, w: 158, h: 114,
    verb: (s) => (s.menus > 0 ? "empty 4B" : null),
    use: (b) => {
      const pile = b.state.items.find((i) => i.kind === "menus");
      if (pile && (pile.l >= 0 || pile.held)) return { line: "Somebody's already left a pile of menus about. Bin those first.", fixed: false };
      if (b.carrying()) return { line: "Your hands are full.", fixed: false };
      b.act({ what: "menus" });
      return { line: "A fistful of pizza menus, none for anyone in 4B. The bins are in the basement.", fixed: true };
    },
  },
  {
    id: "light", level: BASEMENT, x: 244, y: Y(BASEMENT) - 136, w: 40, h: 62,
    verb: (s, now) => (lightOn(s, now) ? "keep it on" : "switch on"),
    use: (b) => {
      b.act({ what: "light" });
      return { line: "Light on. For thirty seconds.", fixed: true };
    },
  },
  {
    id: "washer", level: BASEMENT, x: 636, y: Y(BASEMENT) - 104, w: 100, h: 104,
    verb: (s, now) => (washing(s, now) ? null : "start a wash"),
    use: (b) => {
      b.act({ what: "wash" });
      return { line: "Running. It takes a minute.", fixed: true };
    },
  },
];

export const FIX_NAMES: Record<Fix, string> = {
  frame: "Picture", tap: "Tap", socks: "Socks", aerial: "Aerial", lamp: "Lamp", fridge: "Fridge", boxes: "Boxes",
  dishes: "Dishes", plant: "Plant", chair: "Chair", mat: "Doormat", mail: "Post", light: "Basement light", washer: "Washing",
  clean: "Floors", back: "Putting away", bins: "Bins", loo: "Loo roll",
  hat: "Hat", scarf: "Scarf", gown: "Dressing gown", coat: "Raincoat",
};

/** How something you fixed is doing now. */
export function fixStatus(id: Fix, s: BuildingState, now: number) {
  switch (id) {
    case "frame": return s.frame.a === 0 ? "level, for now" : `${Math.abs(s.frame.a).toFixed(2)}° off`;
    case "tap": return s.tap.h === 0 ? "still dripping" : "running again";
    case "socks": { const n = s.socks.at.filter((a) => a !== 0).length; return n ? `${n} blown off again` : "on the line, for now"; }
    case "aerial": return `${signal(s.aerial)}% signal`;
    case "lamp": return s.lamp ? "on, flickering" : "off again";
    case "fridge": return s.fridge === 0 ? "shut, for now" : "open again";
    case "boxes": return `${s.boxes.n} still packed`;
    case "dishes": return s.dishes ? `${s.dishes} plates again` : "clear, for now";
    case "plant": { const m = plantMood(water(s, now)); return m === "fine" ? "fine, for now" : m === "dry" ? "thirsty again" : "drowning"; }
    case "chair": return chairIn(s.chair) ? "pushed in" : "out again";
    case "mat": return Math.abs(s.mat) < 3 ? "nearly straight" : "crooked again";
    case "mail": return s.menus ? "4B is stuffed again" : "empty, for now";
    case "light": return lightOn(s, now) ? "on" : "dark again";
    case "washer": return `${s.washer.lone} lone sock${s.washer.lone === 1 ? "" : "s"}`;
    case "clean": return `${cleanliness(s, now)}% clean`;
    case "back": { const n = s.items.filter((i) => i.l >= 0 && !i.held && !isHome(i)).length; return n ? `${n} things out of place` : "all put away"; }
    case "bins": return s.items.some((i) => i.kind === "bag" && i.l >= 0) ? "full again" : "empty, for now";
    case "loo": return s.loo <= 1 ? "last sheet again" : `${s.loo} sheets`;
    default: return "";
  }
}

type Mode = "walk" | "stairs" | "car";
type Other = { x: number; y: number; tx: number; ty: number; dir: number; walking: number; gesture: number; hue: number; phase: number; seen: number };
type Hold =
  | { kind: "frame"; a0: number; x0: number; a: number; sent: number }
  | { kind: "tap"; h0: number; y0: number; h: number; sent: number }
  | { kind: "fridge"; d: number; v: number; t: number; sent: number }
  | { kind: "sock"; i: number }
  | { kind: "can"; poured: number; sent: number }
  | { kind: "plate" }
  | { kind: "aerial"; a0: number; x0: number; a: number; sent: number }
  | { kind: "chair"; x: number; sent: number }
  | { kind: "scrub"; tool: "mop" | "sponge"; moved: number; lx: number; ly: number; sent: number };

export type BuildingEvent = { k: "level"; level: number; first: boolean } | { k: "say"; text: string; ms?: number } | { k: "leave" };


export class Building {
  state: BuildingState;
  offset = 0; // server clock minus ours
  myId = "";
  hue: number;
  skin: number;
  // me
  x = 520;
  y = floorY(LOBBY);
  level = LOBBY;
  mode: Mode = "walk";
  stair: { from: number; to: number; t: number; x0: number; x1: number; y0: number; y1: number } | null = null;
  dir = 1;
  phase = 0;
  walking = false;
  gesture = 0;
  gestureUntil = 0;
  // the pointer, in screen coords
  px = 520;
  py = 470;
  pointerIn = false;
  cam = floorY(LOBBY) - CAM_FEET;
  /** How far the view has been scrolled away from you (with the wheel). */
  look = 0;
  hold: Hold | null = null;
  others = new Map<string, Other>();
  visited = new Set<number>([LOBBY]);
  met = new Set<string>();
  /** What you've fixed, and when. */
  fixes = new Map<Fix, number>();
  onEvent: (e: BuildingEvent) => void = () => {};
  send: (msg: Record<string, unknown>) => void = () => {};
  /** Somewhere on another floor you clicked: you walk there, stairs and all. */
  goal: { level: number; x: number } | null = null;
  private lastCall = "";
  /** The button went down on something out of reach (world coords): do it on arrival. */
  private pending: { x: number; y: number; drag: boolean } | null = null;
  /** Where you last clicked something: you stay put until the pointer moves away from it. */
  private anchor: { x: number; y: number } | null = null;
  private nextDrop = 0;
  /** Drops on their way down from the tap. */
  drops: { t: number }[] = [];
  /** The residents' doings are announced up to this time. */
  private toldAt = 0;
  private lastGust = 0;
  private purr = 0;
  private steppedAt = 0;
  /** Marks you wiped, things you put back, footprints you tracked about. */
  stats = { cleaned: 0, back: 0, tracked: 0 };

  constructor(seed: number) {
    this.state = building.init(Date.now());
    this.hue = seed % HUES.length;
    this.skin = Math.floor(seed / 7) % SKIN.length;
    this.x = 420 + (seed % 200);
    this.cam = this.camFor(this.y);
  }

  now() {
    return Date.now() + this.offset;
  }

  setState(s: BuildingState, serverNow?: number) {
    if (serverNow !== undefined) this.sync(serverNow);
    this.state = s;
  }

  sync(serverNow: number) {
    const off = serverNow - Date.now();
    this.offset = this.offset ? this.offset * 0.8 + off * 0.2 : off;
  }

  /** Everyone else, as the room sends them: [id, x, y, dir, walking, gesture, hue]. */
  setPeople(ps: (string | number)[][]) {
    const t = Date.now();
    for (const row of ps) {
      const [id, x, y, dir, walking, gesture, hue] = row as [string, number, number, number, number, number, number];
      if (id === this.myId || typeof id !== "string") continue;
      const o = this.others.get(id);
      if (o) Object.assign(o, { tx: x, ty: y, dir, walking, gesture, hue, seen: t });
      else this.others.set(id, { x, y, tx: x, ty: y, dir, walking, gesture, hue, phase: 0, seen: t });
      this.met.add(id);
    }
    for (const [id, o] of this.others) if (t - o.seen > 3000) this.others.delete(id);
  }

  presence() {
    return [Math.round(this.x), Math.round(this.y), this.dir, this.walking ? 1 : 0, this.gesture, this.hue, this.level];
  }

  /** Do something to the shared state: send it, and do it here too so it shows at once. */
  act(msg: Record<string, unknown>) {
    building.act(this.state, this.myId || "me", msg, this.now());
    this.send({ t: "do", ...msg });
  }

  private camFor(y: number) {
    return Math.max(0, Math.min(WORLD_H - H, y - CAM_FEET + this.look));
  }

  /** Scroll the view up or down (the wheel), to see what's on other floors. */
  scroll(dy: number) {
    const base = this.y - CAM_FEET;
    this.look = Math.max(-base, Math.min(WORLD_H - H - base, this.look + dy));
  }

  pointer(sx: number, sy: number, inside = true) {
    this.px = sx;
    this.py = sy;
    if (this.anchor && Math.hypot(sx - this.anchor.x, sy - this.anchor.y) > 28) this.anchor = null;
    this.pointerIn = inside;
    if (this.hold) this.drag();
  }

  world() {
    return { x: this.px, y: this.cam + this.py };
  }

  private near(level: number, x: number) {
    return this.mode === "walk" && this.level === level && Math.abs(this.x - x) < REACH;
  }

  /** The floor button on the right the pointer is over, if any. */
  private floorButton() {
    if (this.px < W - 52) return -1;
    const l = Math.round((this.py - IND_Y0) / IND_STEP);
    return l >= 0 && l <= LAST && Math.abs(this.py - (IND_Y0 + l * IND_STEP)) < 16 ? l : -1;
  }

  /** The cat, if the pointer is on it. */
  private catAt(x: number, y: number) {
    return residents(this.now()).find((r) => r.id === "cat" && Math.abs(r.x - x) < 26 && y < r.y - r.lift + 4 && y > r.y - r.lift - 30) ?? null;
  }

  /** Who I am in the shared state. */
  me() {
    return this.myId || "me";
  }

  /** What I'm carrying. */
  carrying() {
    return heldBy(this.state, this.me());
  }

  /** The loose item at a spot, if any. */
  private itemAt(x: number, y: number) {
    const l = levelAt(y);
    let best: Item | null = null;
    let bd = 26;
    for (const it of this.state.items) {
      if (it.held || it.l !== l) continue;
      const iy = floorY(l) - it.dy;
      const h = it.kind === "mop" ? 76 : 30;
      if (y < iy - h || y > iy + 6) continue;
      const d = Math.abs(it.x - x);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  /** Where something you're carrying would go if you put it down here. */
  private dropSpot(it: Item, wx: number, wy: number) {
    const l = this.targetLevel(wy);
    const x = Math.round(Math.max(WALK_X0, Math.min(WALK_X1, wx)));
    const surf = SURFACES.find((f) => f.l === l && x >= f.x0 && x <= f.x1 && Math.abs(wy - (floorY(l) - f.dy)) < 26);
    const spot = { l, x, dy: surf ? surf.dy : 0 };
    let verb = surf ? `put it on the ${surf.name}` : "put it down";
    if ((it.kind === "bag" || it.kind === "menus") && l === BINS.l && x >= BINS.x0 && x <= BINS.x1) verb = "throw it out";
    else if (it.kind === "roll" && l === LOO.l && x >= LOO.x0 && x <= LOO.x1) verb = "put the new roll on";
    else if (isHome({ kind: it.kind, ...spot })) verb = "put it back";
    return { ...spot, verb };
  }

  private overTv(x: number, y: number) {
    return levelAt(y) === 4 && x > 344 && x < 430 && y > Y(4) - 134 && y < Y(4) - 78;
  }

  /** What pointing here would do: the outline to draw and the word to show, or null. */
  target(): { x: number; y: number; w: number; h: number; verb: string; drag: boolean; ring?: boolean } | null {
    const fb = this.floorButton();
    if (fb >= 0) return fb === this.level ? null : { x: W - 44, y: this.cam + IND_Y0 + fb * IND_STEP - 15, w: 30, h: 30, verb: `go to ${LEVELS[fb].name.toLowerCase()}`, drag: false };
    const w = this.world();
    const now = this.now();
    const l = levelAt(w.y);
    const cat = this.carrying() ? null : this.catAt(w.x, w.y);
    if (cat) return { x: cat.x - 22, y: cat.y - cat.lift - 30, w: 44, h: 32, verb: "stroke the cat", drag: false };
    const held = this.carrying();
    const coat = held ? this.thingAt(w.x, w.y) : null;
    if (coat && (GARMENTS as string[]).includes(coat.id)) {
      const verb = coat.verb(this.state, now);
      if (verb) return { x: coat.x, y: coat.y, w: coat.w, h: coat.h, verb, drag: false };
    }
    if (held && this.targetLevel(w.y) === this.level) {
      if (held.kind === "remote" && this.overTv(w.x, w.y)) return { x: 344, y: Y(4) - 134, w: 86, h: 56, verb: "change the channel", drag: false };
      const other = this.itemAt(w.x, w.y);
      if (other) {
        const iy = floorY(other.l) - other.dy;
        return { x: other.x - 16, y: iy - 30, w: 32, h: 34, verb: `swap it for the ${ITEM_NAMES[other.kind]}`, drag: false };
      }
      if (held.kind === "mop" || held.kind === "sponge")
        return { x: w.x - 16, y: w.y - 10, w: 32, h: 20, verb: held.kind === "mop" ? "drag to mop, click to put down" : "drag to scrub, click to put down", drag: true };
      const d = this.dropSpot(held, w.x, w.y);
      return { x: d.x - 14, y: floorY(d.l) - d.dy - 14, w: 28, h: 12, verb: d.verb, drag: false, ring: true };
    }
    const item = held ? null : this.itemAt(w.x, w.y);
    if (item) {
      const iy = floorY(item.l) - item.dy;
      const h = item.kind === "mop" ? 76 : 26;
      return { x: item.x - 16, y: iy - h, w: 32, h: h + 4, verb: `pick up the ${ITEM_NAMES[item.kind]}`, drag: false };
    }
    if (!held && this.overTv(w.x, w.y)) return { x: 344, y: Y(4) - 134, w: 86, h: 56, verb: "where's the remote?", drag: false };
    const t = held ? null : this.thingAt(w.x, w.y);
    if (t) {
      const verb = t.verb(this.state, now);
      if (verb) return { x: t.x, y: t.y, w: t.w, h: t.h, verb, drag: !!t.grab };
    }
    if (this.overCall(w.x, w.y)) return { x: CALL_X - 12, y: Y(l) - 88, w: 24, h: 36, verb: "call the lift", drag: false };
    if (this.overFront(w.x, w.y)) return { ...FRONT_DOOR, verb: "leave", drag: false };
    const n = this.noteAt(w.x, w.y);
    if (n) return { x: n.x, y: n.y, w: n.w, h: n.h, verb: "look", drag: false };
    // another floor: say where clicking would take you
    const tl = this.targetLevel(w.y);
    if (tl !== this.level && this.mode !== "car") {
      const fx = Math.max(WALK_X0, Math.min(WALK_X1, w.x));
      const verb = tl < this.level ? `go up to ${LEVELS[tl].name.toLowerCase()}` : `go down to ${LEVELS[tl].name.toLowerCase()}`;
      return { x: fx - 14, y: Y(tl) - 14, w: 28, h: 12, verb, drag: false, ring: true };
    }
    return null;
  }

  /** What the pointer is over, for the cursor. */
  hover(): "grab" | "pointer" | "" {
    if (this.hold) return "grab";
    const t = this.target();
    return t ? (t.drag ? "grab" : "pointer") : "";
  }

  /** The thing at a spot that there's something to do to (the smallest, if they overlap). */
  private thingAt(x: number, y: number) {
    const l = levelAt(y);
    const now = this.now();
    const hits = THINGS.filter((t) => t.level === l && x > t.x && x < t.x + t.w && y > t.y && y < t.y + t.h && t.verb(this.state, now));
    hits.sort((a, b) => a.w * a.h - b.w * b.h);
    return hits[0] ?? null;
  }

  /** The sock on the roof nearest the pointer. */
  fallenSock() {
    const px = this.world().x;
    let best = -1;
    let bd = 60;
    this.state.socks.at.forEach((a, i) => {
      const d = Math.abs(sockFloorX(i) - px);
      if (a === 1 && d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  private overCall(x: number, y: number) {
    const l = levelAt(y);
    return l >= LIFT_TOP && l <= LIFT_BOTTOM && Math.abs(x - CALL_X) < 14 && Math.abs(y - (floorY(l) - 70)) < 18;
  }
  private overFront(x: number, y: number) {
    return levelAt(y) === LOBBY && x > FRONT_DOOR.x && x < FRONT_DOOR.x + FRONT_DOOR.w && y > FRONT_DOOR.y && y < FRONT_DOOR.y + FRONT_DOOR.h;
  }
  private noteAt(x: number, y: number) {
    const l = levelAt(y);
    return NOTES.find((n) => n.level === l && x > n.x && x < n.x + n.w && y > n.y && y < n.y + n.h) ?? null;
  }

  down(sx: number, sy: number) {
    this.pointer(sx, sy);
    this.pending = null;
    this.anchor = null;
    const fb = this.floorButton();
    if (fb >= 0) {
      if (fb !== this.level) this.go(fb, this.x);
      return;
    }
    const w = this.world();
    const r = this.press(w.x, w.y, false);
    if (r === "far") {
      // out of reach: walk over, and do it on arrival
      const t = this.thingAt(w.x, w.y);
      this.pending = { x: w.x, y: w.y, drag: !!t?.grab };
      const l = levelAt(w.y);
      if (l !== this.level) this.go(l, t ? t.x + t.w / 2 : w.x);
    } else if (r === "none") {
      const tl = this.targetLevel(w.y);
      if (tl !== this.level) this.go(tl, w.x);
      else if (this.goal) {
        // clicking your own floor on the way somewhere: never mind, then
        this.goal = null;
        this.say("Never mind.");
      }
    }
  }

  /** Walk to somewhere on another floor. */
  go(level: number, x: number) {
    this.goal = { level, x: Math.max(WALK_X0, Math.min(WALK_X1, x)) };
    this.look = 0;
  }

  /** Press at a spot. Returns "far" if it's something you have to walk over to first. */
  private press(wx: number, wy: number, again: boolean): "far" | "done" | "none" {
    const now = this.now();
    const cat = this.carrying() ? null : this.catAt(wx, wy);
    if (cat) {
      if (Math.abs(this.x - cat.x) > REACH || this.level !== levelAt(cat.y)) return "far";
      this.purr = now;
      this.say(cat.pose === "sleep" ? "Prrr. It didn't wake up." : "Prrr.");
      this.anchor = { x: this.px, y: this.py };
      return "done";
    }
    if (this.overCall(wx, wy)) {
      const l = levelAt(wy);
      if (this.level !== l || this.mode !== "walk") return "far";
      this.act({ what: "call", level: l });
      this.say(`Called. It's on ${LEVELS[this.state.lift.at].short}.`);
      return "done";
    }
    // carrying something: use it here, or put it down here
    const held = this.carrying();
    // you can put something on with your hands full
    const coat = this.thingAt(wx, wy);
    if (held && coat && (GARMENTS as string[]).includes(coat.id) && coat.use) {
      if (!this.near(coat.level, coat.x + coat.w / 2)) return "far";
      this.say(coat.use(this, now).line);
      this.anchor = { x: this.px, y: this.py };
      return "done";
    }
    if (held) {
      if (this.targetLevel(wy) !== this.level || this.mode !== "walk") return again ? "none" : "far";
      if (held.kind === "remote" && this.overTv(wx, wy)) {
        if (Math.abs(this.x - 387) > REACH) return "far";
        this.act({ what: "tv" });
        this.say(`${TV_CHANNELS[this.state.tv].toLowerCase()}. ${TV_LINES[this.state.tv]}`);
        return "done";
      }
      // pointing at something else you could carry: swap
      const other = this.itemAt(wx, wy);
      if (other) {
        if (this.level !== other.l || Math.abs(this.x - other.x) > REACH) return "far";
        this.putDown(held, this.dropSpot(held, other.x + 20, floorY(other.l) - other.dy));
        this.act({ what: "pick", id: other.id });
        this.say(`Swapped. ${PICK_LINES[other.kind]}`);
        return "done";
      }
      if ((held.kind === "mop" || held.kind === "sponge") && !again) {
        this.hold = { kind: "scrub", tool: held.kind, moved: 0, lx: wx, ly: wy, sent: 0 };
        this.gesture = 3;
        return "done";
      }
      const d = this.dropSpot(held, wx, wy);
      if (Math.abs(this.x - d.x) > REACH) return "far";
      this.putDown(held, d);
      return "done";
    }
    const item = this.itemAt(wx, wy);
    if (item) {
      if (this.level !== item.l || this.mode !== "walk" || Math.abs(this.x - item.x) > REACH) return "far";
      this.act({ what: "pick", id: item.id });
      this.say(PICK_LINES[item.kind]);
      this.anchor = { x: this.px, y: this.py };
      this.goal = null;
      return "done";
    }
    if (this.overTv(wx, wy)) {
      this.say("No remote. Somebody's had it.");
      return "done";
    }
    const t = this.thingAt(wx, wy);
    if (t) {
      // something you drag you can take hold of from anywhere on its floor (you walk over as you
      // drag); something you click, you have to be next to
      if (t.grab ? this.level !== t.level || this.mode !== "walk" : !this.near(t.level, t.x + t.w / 2)) return "far";
      if (t.grab) {
        // a drag only starts with the button down on it
        if (again && !this.pending?.drag) return "none";
        const h = t.grab(this, now);
        if (!h) return "none";
        this.hold = h;
        this.gesture = 3;
        this.goal = null;
        return "done";
      }
      if (t.use) {
        const r = t.use(this, now);
        if (r.fixed) this.fixes.set(t.id, now);
        this.gesture = 3;
        this.gestureUntil = now + 500;
        this.say(r.line);
        // having done something to it, stay put rather than walk into it
        this.anchor = { x: this.px, y: this.py };
        this.goal = null;
        return "done";
      }
    }
    if (this.overFront(wx, wy)) {
      if (this.level !== LOBBY || this.mode !== "walk") return "far";
      this.onEvent({ k: "leave" });
      return "done";
    }
    const note = this.noteAt(wx, wy);
    if (note) {
      if (note.level !== this.level || this.mode !== "walk") return "far";
      this.say(note.note, 3400);
      return "done";
    }
    if (again) return "none";
    // nothing there: wave
    this.gesture = 1;
    this.gestureUntil = now + 1400;
    return "none";
  }

  up() {
    // a click on something far away still happens when you get there; a drag doesn't
    if (this.pending?.drag) this.pending = null;
    const h = this.hold;
    this.hold = null;
    if (!h) return;
    this.gesture = 0;
    const now = this.now();
    const w = this.world();
    this.anchor = { x: this.px, y: this.py };
    switch (h.kind) {
      case "scrub": {
        // hardly moved: that was a click, so put the thing down
        const it = this.carrying();
        if (h.moved < 8 && it) {
          const d = this.dropSpot(it, w.x, w.y);
          if (Math.abs(this.x - d.x) <= REACH && d.l === this.level) this.putDown(it, d);
        }
        break;
      }
      case "frame": {
        this.act({ what: "frame", a: h.a });
        this.fixes.set("frame", now);
        const off = Math.abs(this.state.frame.a);
        this.say(off === 0 ? "Level. Exactly level. Enjoy it while it lasts." : `${off.toFixed(2)}° off. Not quite.`);
        break;
      }
      case "tap":
        this.act({ what: "tap", h: h.h });
        if (h.h === 0) this.fixes.set("tap", now);
        this.say(h.h === 0 ? "Off. Mostly." : h.h >= 0.18 ? "That's running." : "Dripping, then.");
        break;
      case "fridge":
        if (h.d < 0.07) {
          // swung shut hard, it bounces back open; eased shut, it stays
          if (h.v < -2.2) {
            this.act({ what: "fridge", d: 0.24 });
            this.say("Slammed. It bounced back open.");
          } else {
            this.act({ what: "fridge", d: 0 });
            this.fixes.set("fridge", now);
            this.say("Shut. Gently. It stays.");
          }
        } else this.act({ what: "fridge", d: h.d });
        break;
      case "sock":
        if (w.y > LINE_Y - 30 && w.y < LINE_Y + 34 && w.x > 296 && w.x < 534) {
          this.act({ what: "sock", i: h.i, to: 0 });
          this.fixes.set("socks", now);
          const left = this.state.socks.at.filter((a) => a === 1).length;
          this.say(left ? `Pegged. ${left} still on the roof.` : "On the line. Until the wind.");
        } else this.say("Dropped it. Hang it on the line.");
        break;
      case "can": {
        if (h.poured > 0) this.act({ what: "water", amt: h.poured });
        const m = plantMood(water(this.state, now));
        if (h.sent || h.poured) {
          if (m === "drowned") this.say("Too much. Now it's drowning.");
          else if (m === "dry") this.say("Still thirsty. Hold it over the plant.");
          else {
            this.fixes.set("plant", now);
            this.say("About right. For now.");
          }
        } else this.say("Hold the can over the plant to pour.");
        break;
      }
      case "plate":
        if (w.x > RACK.x0 && w.x < RACK.x1 && w.y > Y(3) - 160 && w.y < Y(3) - 80) {
          this.act({ what: "dish" });
          this.fixes.set("dishes", now);
          this.say(this.state.dishes ? `One done. ${this.state.dishes} to go.` : "Sink's clear. Someone will be along.");
        } else this.say("Back on the pile. The rack is on the right.");
        break;
      case "aerial": {
        this.act({ what: "aerial", a: h.a });
        const sg = signal(h.a);
        if (sg >= 80) this.fixes.set("aerial", now);
        this.say(sg >= 94 ? "94%. As good as it gets." : `Signal ${sg}%. The telly on 2 agrees.`);
        break;
      }
      case "chair":
        if (chairIn(h.x)) {
          // it's on wheels: it rolls back out a little
          this.act({ what: "chair", x: CHAIR_IN + 9 });
          this.fixes.set("chair", now);
          this.say("Pushed in. It rolled back a bit.");
        } else this.act({ what: "chair", x: h.x });
        break;
    }
  }

  say(text: string, ms?: number) {
    this.onEvent({ k: "say", text, ms });
  }

  private putDown(it: Item, d: { l: number; x: number; dy: number; verb: string }) {
    const now = this.now();
    const home = d.verb === "put it back" || d.verb === "throw it out" || d.verb === "put the new roll on";
    this.act({ what: "drop", id: it.id, l: d.l, x: d.x, dy: d.dy });
    this.anchor = { x: this.px, y: this.py };
    if (home) {
      this.stats.back++;
      this.fixes.set(it.kind === "bag" || it.kind === "menus" ? "bins" : it.kind === "roll" ? "loo" : "back", now);
    }
    this.say(
      d.verb === "throw it out" ? (it.kind === "menus" ? "Recycled. The courier's on his way with more." : "Out. The kitchen bin will be full again by the time you're back up.") :
      d.verb === "put the new roll on" ? "A new roll. Forty sheets. Give it an hour." :
      home ? "Back where it lives. For now." :
      DROP_LINES[it.kind],
    );
  }

  private drag() {
    const h = this.hold;
    if (!h) return;
    const t = Date.now();
    const w = this.world();
    switch (h.kind) {
      case "scrub": {
        h.moved += Math.hypot(w.x - h.lx, w.y - h.ly);
        h.lx = w.x;
        h.ly = w.y;
        if (h.moved > 8 && t - h.sent > 90 && levelAt(w.y) === this.level) {
          h.sent = t;
          const before = this.state.marks.filter((m) => m.k !== "water").length;
          this.act({ what: "scrub", x: Math.round(w.x), y: Math.round(w.y) });
          const gone = before - this.state.marks.filter((m) => m.k !== "water").length;
          if (gone > 0) {
            this.stats.cleaned += gone;
            this.fixes.set("clean", this.now());
          }
        }
        break;
      }
      case "frame":
        // drag sideways to turn it; it only settles in steps, and never on level
        h.a = frameSnap(h.a0 + (this.px - h.x0) * 0.05);
        if (t - h.sent > 160 && h.a !== this.state.frame.a) {
          h.sent = t;
          this.act({ what: "frame", a: h.a, live: true });
        }
        break;
      case "tap":
        // drag up to open it, down to shut it
        h.h = Math.max(0, Math.min(1, Math.round((h.h0 - (this.py - h.y0) * 0.006) * 100) / 100));
        if (t - h.sent > 160 && h.h !== this.state.tap.h) {
          h.sent = t;
          this.act({ what: "tap", h: h.h });
        }
        break;
      case "fridge": {
        // the door's free edge follows the pointer
        const d = Math.max(0, Math.min(1, (FRIDGE.x + FRIDGE.w - w.x) / 160));
        const now = performance.now();
        const dt = Math.max(1, now - h.t) / 1000;
        h.v = h.v * 0.5 + ((d - h.d) / dt) * 0.5;
        h.d = d;
        h.t = now;
        if (t - h.sent > 200) {
          h.sent = t;
          this.act({ what: "fridge", d });
        }
        break;
      }
      case "aerial":
        h.a = h.a0 + (this.px - h.x0) * 0.9;
        if (t - h.sent > 160) {
          h.sent = t;
          this.act({ what: "aerial", a: h.a });
        }
        break;
      case "chair":
        h.x = Math.max(CHAIR_IN, Math.min(540, w.x));
        if (t - h.sent > 200) {
          h.sent = t;
          this.act({ what: "chair", x: h.x });
        }
        break;
    }
  }

  step(dt: number) {
    const now = this.now();
    // with nobody to keep time for it, time passes here
    const s = this.state;
    const was = { mat: Math.abs(s.mat) < 3, chair: chairIn(s.chair), lone: s.washer.lone, feet: s.feet[this.me()]?.n ?? 0 };
    const wearing = GARMENTS.filter((g) => s.wear[g].by === this.me());
    building.tick(s, now, new Map([[this.me(), this.presence()]]), !!this.myId);
    for (const g of wearing) if (s.wear[g].by !== this.me()) this.say(`The ${GARMENT_NAMES[g]} came off. It does that.`);
    const feet = s.feet[this.me()]?.n ?? 0;
    if (feet < was.feet) this.stats.tracked += was.feet - feet;
    if (feet === FEET_STEPS && was.feet < FEET_STEPS && now - this.steppedAt > 20000) {
      this.steppedAt = now;
      this.say(FEET_LINES[s.feet[this.me()].c] ?? "You stepped in something.");
    }
    if (this.mode === "walk") {
      if (was.mat && Math.abs(s.mat) >= 3 && this.level === LOBBY && this.x > MAT_X[0] && this.x < MAT_X[1]) this.say("You stepped on the mat.");
    }
    if (s.washer.lone > was.lone && this.level === BASEMENT) this.say("Done. One sock came out. Just the one.");
    // what the residents got up to, if you were there to see it
    if (!this.toldAt) this.toldAt = now;
    for (const d of deeds(this.toldAt, now)) if (DEED_LEVEL[d.deed] === this.level) this.say(NPC_LINES[d.deed]);
    this.toldAt = now;
    const g = s.socks.gust;
    if (g && g.t !== this.lastGust) {
      if (this.lastGust && now - g.t < 4000 && (this.level === ROOF || g.to === 2)) this.say(g.to === 2 ? "A sock just went past the window." : "A gust took a sock.");
      this.lastGust = g.t;
    }
    // pouring
    if (this.hold?.kind === "can") {
      const w = this.world();
      if (Math.abs(w.x - PLANT_X) < 44 && w.y < Y(4) - 70 && w.y > Y(4) - 230) {
        this.hold.poured += dt * 0.3;
        if (this.hold.poured >= 0.12) {
          this.act({ what: "water", amt: this.hold.poured });
          this.hold.poured = 0;
          this.hold.sent = 1;
        }
      }
    }
    if (!this.hold && this.gesture && now > this.gestureUntil) this.gesture = 0;
    if (this.pending && !this.hold && this.press(this.pending.x, this.pending.y, true) !== "far") this.pending = null;
    this.move(dt, now);
    for (const o of this.others.values()) {
      const k = 1 - Math.exp(-dt * 12);
      o.x += (o.tx - o.x) * k;
      o.y += (o.ty - o.y) * k;
      if (o.walking) o.phase += dt * 11;
    }
    const k = 1 - Math.exp(-dt * 4.5);
    this.cam += (this.camFor(this.y) - this.cam) * k;
    // the tap, dripping at whatever rate everyone left it at
    const rate = dripRate(this.hold?.kind === "tap" ? this.hold.h : this.state.tap.h);
    if (rate < 5) {
      if (!this.nextDrop || this.nextDrop > now + 8000) this.nextDrop = now + 1000 / rate;
      if (now >= this.nextDrop) {
        this.drops.push({ t: now });
        this.nextDrop = now + 1000 / rate;
      }
    } else this.nextDrop = 0;
    this.drops = this.drops.filter((d) => now - d.t < 500);
  }

  private move(dt: number, now: number) {
    const w = this.world();
    const lift = this.state.lift;
    const ll = liftLevel(lift, now);
    const open = doorsOpen(lift, now);
    // follow the pointer along your own floor; other floors you go to by clicking
    const follow = this.pointerIn && !this.anchor && !this.goal && this.targetLevel(w.y) === this.level;
    let tl = this.goal ? this.goal.level : this.level;
    let tx = this.goal ? this.goal.x : follow ? w.x : this.x;
    if (this.hold) {
      tl = this.level;
      tx = this.holdSpot(this.hold);
    }
    const was = this.level;
    this.walking = false;
    if (this.mode === "stairs" && this.stair) {
      const s = this.stair;
      s.t += (dt * 1000) / STAIR_MS;
      const p = Math.min(1, s.t);
      this.x = s.x0 + (s.x1 - s.x0) * p;
      this.y = s.y0 + (s.y1 - s.y0) * p;
      this.dir = s.x1 > s.x0 ? 1 : -1;
      this.walking = true;
      this.phase += dt * 14;
      if (p >= 1) {
        this.level = s.to;
        this.mode = "walk";
        this.stair = null;
      }
    } else if (this.mode === "car") {
      this.y = floorY(ll);
      this.level = Math.round(ll);
      const stopped = ll === lift.at && lift.to === lift.at;
      const here = open && ll === lift.at;
      const wantOut = (this.goal ? this.goal.level === this.level : follow && w.x < SHAFT_X0) || tl === ROOF;
      if (here && wantOut) {
        this.mode = "walk";
        this.walkTo(WALK_X1 - 10, dt);
      } else {
        this.walkTo(follow ? Math.max(CAR_X0 + 14, Math.min(CAR_X1 - 14, w.x)) : this.x, dt, CAR_X0 + 14, CAR_X1 - 14);
        const want = Math.max(LIFT_TOP, Math.min(LIFT_BOTTOM, tl));
        const key = `${lift.at}>${want}`;
        if (stopped && want !== this.level && this.lastCall !== key) {
          this.lastCall = key;
          this.act({ what: "call", level: want });
        }
      }
    } else {
      const wantCar = !this.hold && tl === this.level && ((follow && w.x > SHAFT_X0) || (this.goal && this.goal.x > SHAFT_X0 - 20)) && this.level >= LIFT_TOP && this.level <= LIFT_BOTTOM;
      if (wantCar) {
        if (open && ll === this.level && lift.at === this.level) {
          this.walkTo(CAR_X0 + 40, dt, WALK_X0, CAR_X1 - 14);
          if (this.x > CAR_X0 + 4) {
            this.mode = "car";
            this.lastCall = "";
            this.goal = null;
          }
        } else {
          // wait by the doors, having pressed the button (once is enough; it doesn't help)
          this.walkTo(WALK_X1, dt);
          const key = `call${this.level}`;
          if (this.lastCall !== key && this.x > WALK_X1 - 30) {
            this.lastCall = key;
            this.act({ what: "call", level: this.level });
          }
        }
      } else if (tl === this.level) {
        this.walkTo(tx, dt);
        if (this.goal && Math.abs(this.x - this.goal.x) < 3) this.goal = null;
      } else {
        // the stairs: down from the top of this floor's flight, or up from the bottom of the one above
        const down = tl > this.level;
        const from = down ? this.level : this.level - 1;
        const start = down ? topX(from) : botX(from);
        if (Math.abs(this.x - start) > 3) this.walkTo(start, dt, STAIR_X0 + 12, WALK_X1);
        else {
          this.mode = "stairs";
          this.stair = down
            ? { from: this.level, to: this.level + 1, t: 0, x0: topX(from), x1: botX(from), y0: floorY(from), y1: floorY(from + 1) }
            : { from: this.level, to: this.level - 1, t: 0, x0: botX(from), x1: topX(from), y0: floorY(from + 1), y1: floorY(from) };
        }
      }
      this.y = floorY(this.level);
    }
    if (this.level !== was) {
      const first = !this.visited.has(this.level);
      this.visited.add(this.level);
      this.look = 0;
      this.lastCall = this.mode === "car" ? this.lastCall : "";
      this.onEvent({ k: "level", level: this.level, first });
    }
  }

  /** Where you stand while holding something. */
  private holdSpot(h: Hold) {
    switch (h.kind) {
      case "frame":
        return FRAME.x - 60;
      case "tap":
        return TAP.x - 40;
      case "fridge":
        return fridgeEdge(h.d) - 30;
      case "aerial":
        return 380;
      case "chair":
        return h.x + 36;
      case "scrub":
        return this.world().x - this.dir * (h.tool === "mop" ? 40 : 18);
      default:
        return Math.max(WALK_X0, Math.min(WALK_X1, this.world().x - 34));
    }
  }

  /** The level the pointer asks for. The floor you're on keeps a margin below its floor line, so
   *  pointing at your own feet doesn't send you downstairs. */
  private targetLevel(wy: number) {
    const l = this.level;
    if (wy > floorY(l) + 60) return levelAt(wy - 60);
    if (l > 0 && wy < floorY(l - 1) - 10) return levelAt(wy);
    return l;
  }

  private walkTo(tx: number, dt: number, x0 = WALK_X0, x1 = WALK_X1) {
    const target = Math.max(x0, Math.min(x1, tx));
    const d = target - this.x;
    if (Math.abs(d) < 2) return;
    const s = Math.min(Math.abs(d), WALK * dt);
    this.x += Math.sign(d) * s;
    this.dir = d > 0 ? 1 : -1;
    this.walking = s > 0.5;
    if (this.walking) this.phase += dt * 11;
  }

  frameAngle() {
    return this.hold?.kind === "frame" ? this.hold.a : this.state.frame.a;
  }
  tapOpen() {
    return this.hold?.kind === "tap" ? this.hold.h : this.state.tap.h;
  }
  fridgeDoor() {
    return this.hold?.kind === "fridge" ? this.hold.d : this.state.fridge;
  }
  aerialDeg() {
    return this.hold?.kind === "aerial" ? this.hold.a : this.state.aerial;
  }
  chairX() {
    return this.hold?.kind === "chair" ? this.hold.x : this.state.chair;
  }
  purring(now: number) {
    return now - this.purr < 1600;
  }
  dripCount() {
    return Math.floor(drips(this.state, this.now()));
  }

  // ─── drawing ───────────────────────────────────────────────────────────────

  draw(ctx: CanvasRenderingContext2D) {
    const now = this.now();
    const cam = this.cam;
    ctx.save();
    ctx.translate(0, -cam);
    const top = cam - 20;
    const bottom = cam + H + 20;
    this.drawOutside(ctx, top, bottom);
    for (let l = 0; l <= LAST; l++) {
      const y1 = floorY(l);
      const y0 = l === ROOF ? 0 : floorY(l - 1);
      if (y1 + SLAB < top || y0 > bottom) continue;
      this.drawStorey(ctx, l, now);
    }
    this.drawShaft(ctx, now, top, bottom);
    for (let l = 0; l <= LAST; l++) {
      const y = floorY(l);
      if (y + SLAB + 40 < top || y - FH > bottom) continue;
      this.drawSlab(ctx, l);
    }
    // what's been spilt, trodden in, left behind; and the things lying about
    for (const m of this.state.marks) if (m.y > top - 20 && m.y < bottom + 20) drawMark(ctx, m, markNow(m, now));
    this.drawNotes(ctx, top, bottom);
    for (const it of this.state.items) if (!it.held && it.l >= 0) drawItem(ctx, it.kind, it.x, floorY(it.l) - it.dy, 0, it.id);
    // the people, the ones further back first
    const people: { id: string; x: number; y: number; dir: number; walking: number; gesture: number; hue: number; phase: number; me: boolean }[] = [];
    for (const [id, o] of this.others) people.push({ ...o, id, me: false });
    people.push({ id: this.me(), x: this.x, y: this.y, dir: this.dir, walking: this.walking ? 1 : 0, gesture: this.gesture, hue: this.hue, phase: this.phase, me: true });
    for (const p of people) if (p.walking && p.y > top && p.y < bottom) thud(ctx, p.x, p.y, p.phase);
    // the people who live here
    for (const r of residents(now)) if (r.y > top - 60 && r.y < bottom + 60) drawResident(ctx, r, now, this.purring(now));
    for (const p of people)
      if (p.y > top - 60 && p.y < bottom + 60) drawPerson(ctx, p.x, p.y, p.hue, p.dir, p.phase, !!p.walking, p.gesture, p.me ? this.skin : (p.hue * 3) % SKIN.length, p.me, this.wornBy(p.me ? this.me() : p.id, now));
    this.drawFlyingSocks(ctx, now);
    this.drawHeld(ctx, now);
    this.drawCarried(ctx, now);
    lights(ctx, this, now);
    // in the dark you can still see where you are
    if (this.level === BASEMENT && !lightOn(this.state, now)) hand(ctx, "you", this.x, this.y - 62, 18, "center", "#9FB6E8");
    // what pointing here would do: a pen outline and a word
    const t = this.pointerIn && !this.hold ? this.target() : null;
    if (t) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "rgba(45,76,154,0.75)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (t.ring) ctx.ellipse(t.x + t.w / 2, t.y + t.h, 16, 5, 0, 0, Math.PI * 2);
      else ctx.roundRect(t.x - 4, t.y - 4, t.w + 8, t.h + 8, 8);
      ctx.stroke();
      ctx.restore();
      // for the floor buttons the word goes to the left; elsewhere, above
      if (t.x > W - 60) {
        ctx.font = "22px 'Reenie Beanie', cursive";
        const tw = ctx.measureText(t.verb).width;
        ctx.fillStyle = "rgba(251,250,247,0.92)";
        ctx.fillRect(t.x - tw - 18, t.y + t.h / 2 - 12, tw + 12, 24);
        hand(ctx, t.verb, t.x - 12, t.y + t.h / 2 + 6, 22, "right", PEN);
      }
      const ty = t.ring ? t.y - 24 : Math.max(t.y - 10, this.cam + 24);
      if (t.x <= W - 60) {
      ctx.font = "22px 'Reenie Beanie', cursive";
      const tw = ctx.measureText(t.verb).width;
      ctx.fillStyle = "rgba(251,250,247,0.9)";
      ctx.fillRect(t.x + t.w / 2 - tw / 2 - 6, ty - 18, tw + 12, 24);
      hand(ctx, t.verb, t.x + t.w / 2, ty, 22, "center", PEN);
      }
    }
    // where you're pointing, when the person isn't there yet
    if (this.pointerIn && !this.hold && !t) {
      const w = this.world();
      ctx.strokeStyle = "rgba(45,76,154,0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(w.x, floorY(this.targetLevel(w.y)) - 2, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    this.drawIndicator(ctx);
    // on the roof, the telly on 2 in a corner, so you can see what the aerial is doing
    if (this.level === ROOF || this.hold?.kind === "aerial") telly(ctx, 18, 18, 132, 84, signal(this.aerialDeg()), now, "the telly on 2");
  }

  /** What somebody has on from the coat rail. */
  wornBy(id: string, now: number) {
    return GARMENTS.filter((g) => this.state.wear[g].by === id && now < this.state.wear[g].until);
  }

  /** Things in people's hands: yours, everybody else's, the residents'. */
  private drawCarried(ctx: CanvasRenderingContext2D, now: number) {
    const rs = residents(now);
    for (const it of this.state.items) {
      if (!it.held) continue;
      let p: { x: number; y: number; dir: number } | undefined;
      if (it.held === this.me()) {
        // a mop or a sponge goes where you're scrubbing
        if (this.hold?.kind === "scrub") {
          const w = this.world();
          if (it.kind === "mop") {
            line(ctx, this.x + this.dir * 10, this.y - 32, w.x, w.y - 4, "#8C6A4A", 3);
            drawItem(ctx, "mop", w.x, w.y, 0, it.id, true);
          } else drawItem(ctx, "sponge", w.x, w.y + 4, 0, it.id);
          continue;
        }
        p = { x: this.x, y: this.y, dir: this.dir };
      } else if (it.held.startsWith("npc:")) {
        const r = rs.find((r) => `npc:${r.id}` === it.held);
        if (r) p = { x: r.x, y: r.y - r.lift + (r.id === "cat" ? 18 : 0), dir: r.dir };
      } else {
        const o = this.others.get(it.held);
        if (o) p = { x: o.x, y: o.y, dir: o.dir };
      }
      if (!p) continue;
      drawItem(ctx, it.kind, p.x + p.dir * 15, p.y - (it.kind === "mop" ? 8 : 26), p.dir, it.id);
    }
  }

  /** Notes people stick up when things get on their nerves. */
  private drawNotes(ctx: CanvasRenderingContext2D, top: number, bottom: number) {
    const s = this.state;
    const now = this.now();
    const notes: { l: number; x: number; dy: number; text: string[] }[] = [];
    if (s.items.some((i) => i.kind === "mop" && !i.held && i.l >= 0 && i.l !== BASEMENT && i.l !== 3 && i.l !== LOBBY))
      notes.push({ l: 3, x: 335, dy: 190, text: ["whoever keeps leaving", "the mop about:", "we know."] });
    const prints = s.marks.filter((m) => m.k === "print" && markNow(m, now) > 0.15).length;
    if (prints >= 10) notes.push({ l: LOBBY, x: 456, dy: 106, text: ["SHOES OFF.", "this means you."] });
    const remote = s.items.find((i) => i.kind === "remote");
    if (remote && remote.l !== 4) notes.push({ l: 4, x: 486, dy: 200, text: ["has anyone seen", "the remote?"] });
    if (s.loo <= 1) notes.push({ l: LOBBY, x: 718, dy: 150, text: ["last sheet.", "again."] });
    if (s.items.some((i) => i.kind === "bag" && i.l === 3 && !i.held)) notes.push({ l: 3, x: 330, dy: 70, text: ["bin day was", "tuesday."] });
    if (s.marks.filter((m) => m.k === "hair").length >= 5) notes.push({ l: 1, x: 330, dy: 186, text: ["the cat is NOT", "allowed on the sofa."] });
    for (const n of notes) {
      const y = floorY(n.l) - n.dy;
      if (y < top - 60 || y > bottom + 20) continue;
      ctx.save();
      ctx.translate(n.x, y);
      ctx.rotate(((n.x * 7) % 9) / 100 - 0.04);
      const w = 112;
      const h = 16 + n.text.length * 15;
      ctx.fillStyle = "#FBF0A8";
      ctx.fillRect(-w / 2, 0, w, h);
      ctx.fillStyle = "rgba(232,220,186,0.9)";
      ctx.fillRect(-14, -5, 28, 10);
      n.text.forEach((t, i) => hand(ctx, t, 0, 20 + i * 15, 17, "center", INK));
      ctx.restore();
    }
  }

  /** What you're carrying: the watering can (pouring, if it's over the plant), a plate. */
  private drawHeld(ctx: CanvasRenderingContext2D, now: number) {
    const h = this.hold;
    if (!h) return;
    const w = this.world();
    if (h.kind === "can") {
      const over = Math.abs(w.x - PLANT_X) < 44 && w.y < Y(4) - 70 && w.y > Y(4) - 230;
      can(ctx, w.x + 10, w.y + 14, over ? -0.6 : 0);
      if (over) {
        ctx.strokeStyle = "rgba(120,170,200,0.85)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const sx = w.x - 22 + i * 3;
          ctx.beginPath();
          ctx.moveTo(sx, w.y + 4);
          ctx.lineTo(sx + Math.sin(now / 50 + i) * 2, Y(4) - 60);
          ctx.stroke();
        }
      }
    } else if (h.kind === "plate") {
      ctx.fillStyle = "#F4F1EA";
      ctx.beginPath();
      ctx.ellipse(w.x, w.y, 30, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#C0533F";
      ctx.fillRect(w.x - 8, w.y - 3, 8, 2);
    }
  }

  private drawOutside(ctx: CanvasRenderingContext2D, top: number, bottom: number) {
    const ground = floorY(LOBBY);
    const sky = ctx.createLinearGradient(0, 0, 0, ground);
    sky.addColorStop(0, "#D7E3EA");
    sky.addColorStop(1, "#EEF0EA");
    ctx.fillStyle = sky;
    ctx.fillRect(0, Math.max(0, top), W, Math.min(ground, bottom) - Math.max(0, top));
    if (bottom > ground) {
      ctx.fillStyle = "#CBBFA8";
      ctx.fillRect(0, ground, W, bottom - ground);
      ctx.fillStyle = "rgba(28,28,26,0.08)";
      for (let i = 0; i < 60; i++) {
        const x = (i * 157) % W;
        const y = ground + 30 + ((i * 89) % (WORLD_H - ground));
        if (x > WALL_X0 - 10 && x < WALL_X1 + 10) continue;
        ctx.fillRect(x, y, 3, 2);
      }
      // the pavement
      ctx.fillStyle = "#B4AB9B";
      ctx.fillRect(0, ground, WALL_X0, 10);
      ctx.fillRect(WALL_X1, ground, W - WALL_X1, 10);
    }
    // socks the wind took, on the pavement
    this.state.socks.at.forEach((at, i) => {
      const g = this.state.socks.gust;
      if (at === 2 && !(g && g.i === i && this.now() - g.t < SOCK_FLIGHT[2])) sock(ctx, 18 + ((i * 13) % 46), ground - 3, SOCKS[i], 1.5 + (i % 2) * 0.4, 0);
    });
    // a lamp post and a bit of street outside
    if (top < ground && bottom > ground - 260) {
      line(ctx, 40, ground, 40, ground - 210, INK, 3);
      line(ctx, 40, ground - 210, 58, ground - 214, INK, 3);
      ctx.fillStyle = "#F3E7B5";
      ctx.beginPath();
      ctx.ellipse(60, ground - 210, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // the building's outline: walls from the roof down into the ground
    ctx.fillStyle = "#B9B1A3";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    const wy = ROOF_Y - 22;
    const wh = floorY(LAST) + SLAB - wy;
    ctx.fillRect(WALL_X0 - 8, wy, STAIR_X0 - WALL_X0 + 8, wh);
    ctx.strokeRect(WALL_X0 - 8, wy, STAIR_X0 - WALL_X0 + 8, wh);
    ctx.fillRect(SHAFT_X1, wy, WALL_X1 + 8 - SHAFT_X1, wh);
    ctx.strokeRect(SHAFT_X1, wy, WALL_X1 + 8 - SHAFT_X1, wh);
  }

  private drawStorey(ctx: CanvasRenderingContext2D, l: number, now: number) {
    const y1 = floorY(l);
    const y0 = y1 - FH + SLAB;
    if (l === ROOF) {
      this.drawRoof(ctx, now);
      return;
    }
    // the flat
    ctx.fillStyle = WALLS[l];
    ctx.fillRect(STAIR_X1 + 8, y0, SHAFT_X0 - STAIR_X1 - 8, FH - SLAB);
    // the stairwell, with the flight down from the floor above
    ctx.fillStyle = "#D6D0C4";
    ctx.fillRect(STAIR_X0, y0, STAIR_X1 - STAIR_X0, FH - SLAB);
    ctx.fillStyle = "rgba(28,28,26,0.13)";
    ctx.font = "64px 'Libre Caslon Text', Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(LEVELS[l].short, (STAIR_X0 + STAIR_X1) / 2, y0 + 92);
    stairs(ctx, l - 1);
    // the wall between the stairs and the flat, with a doorway
    ctx.fillStyle = "#B9B1A3";
    ctx.fillRect(STAIR_X1, y0, 8, FH - SLAB - 84);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(STAIR_X1, y0, 8, FH - SLAB - 84);
    const flats: ((ctx: CanvasRenderingContext2D, y: number, b: Building, now: number) => void)[] = [() => {}, floor5, floor4, floor3, floor2, lobby, basement];
    flats[l](ctx, y1, this, now);
  }

  private drawRoof(ctx: CanvasRenderingContext2D, now: number) {
    const y = ROOF_Y;
    // the stair hut and the lift motor room
    ctx.fillStyle = "#C9C2B5";
    ctx.fillRect(STAIR_X0, y - 120, STAIR_X1 - STAIR_X0, 120);
    ctx.fillRect(SHAFT_X0, y - 96, SHAFT_X1 - SHAFT_X0, 96);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(STAIR_X0, y - 120, STAIR_X1 - STAIR_X0, 120);
    ctx.strokeRect(SHAFT_X0, y - 96, SHAFT_X1 - SHAFT_X0, 96);
    ctx.fillStyle = "#8D857A";
    ctx.fillRect(STAIR_X1 - 50, y - 84, 36, 84);
    ctx.fillStyle = "rgba(28,28,26,0.5)";
    ctx.font = "11px 'Work Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LIFT MOTOR", (SHAFT_X0 + SHAFT_X1) / 2, y - 64);
    ctx.fillText("KEEP OUT", (SHAFT_X0 + SHAFT_X1) / 2, y - 50);
    // parapet
    ctx.fillStyle = "#B9B1A3";
    ctx.fillRect(WALL_X0 - 8, y - 22, 14, 22);
    ctx.fillRect(WALL_X1 - 6, y - 22, 14, 22);
    // the aerial: its crossbars foreshorten as it turns
    line(ctx, 435, y, 435, y - 200, INK, 2);
    const span = 6 + 22 * Math.abs(Math.cos((this.aerialDeg() * Math.PI) / 180));
    for (let i = 0; i < 4; i++) {
      const w = span * (1 - i * 0.16);
      line(ctx, 435 - w, y - 190 + i * 22, 435 + w, y - 190 + i * 22, INK, 1.6);
    }
    // the water tank
    ctx.fillStyle = "#9FB0B5";
    ctx.fillRect(610, y - 150, 90, 104);
    ctx.strokeRect(610, y - 150, 90, 104);
    line(ctx, 620, y - 46, 616, y, INK, 2);
    line(ctx, 690, y - 46, 694, y, INK, 2);
    ctx.fillStyle = INK;
    ctx.font = "10px 'Work Sans', sans-serif";
    ctx.fillText("NOT FOR", 655, y - 104);
    ctx.fillText("DRINKING", 655, y - 92);
    // the washing line, flapping; socks the wind took lie on the roof
    line(ctx, 300, y, 300, y - 120, INK, 2);
    line(ctx, 530, y, 530, y - 120, INK, 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(300, y - 112);
    ctx.quadraticCurveTo(415, y - 98, 530, y - 112);
    ctx.stroke();
    const wind = Math.sin(now / 700) * 4;
    const g = this.state.socks.gust;
    const held = this.hold?.kind === "sock" ? this.hold.i : -1;
    this.state.socks.at.forEach((at, i) => {
      if (i === held) return;
      if (g && g.i === i && now - g.t < SOCK_FLIGHT[g.to]) return;
      if (at === 0) {
        const sx = sockX(i);
        const t = (sx - 300) / 230;
        sock(ctx, sx, LINE_Y + 4 * t * (1 - t) * 14, SOCKS[i], 0, wind);
      } else if (at === 1) sock(ctx, sockFloorX(i), y - 4, SOCKS[i], 1.35 + ((i % 3) - 1) * 0.3, 0);
    });
  }

  /** Socks in the air: blown off the line, or carried by you. Drawn over everything. */
  private drawFlyingSocks(ctx: CanvasRenderingContext2D, now: number) {
    const g = this.state.socks.gust;
    if (g && now - g.t < SOCK_FLIGHT[g.to]) {
      const p = (now - g.t) / SOCK_FLIGHT[g.to];
      const x0 = sockX(g.i);
      if (g.to === 1) {
        // a tumble onto the roof
        const x = x0 + (sockFloorX(g.i) - x0) * p;
        const yy = LINE_Y + (ROOF_Y - 4 - LINE_Y) * p - Math.sin(p * Math.PI) * 60;
        sock(ctx, x, yy, SOCKS[g.i], p * 7, 0);
      } else {
        // off the edge, and all the way down the outside of the building
        const edge = 0.25;
        let x: number;
        let yy: number;
        if (p < edge) {
          const q = p / edge;
          x = x0 + (40 - x0) * q;
          yy = LINE_Y - Math.sin(q * Math.PI) * 70 + (ROOF_Y - 30 - LINE_Y) * q;
        } else {
          const q = (p - edge) / (1 - edge);
          x = 40 + Math.sin(q * 18) * 12;
          yy = ROOF_Y - 30 + (floorY(LOBBY) - 6 - (ROOF_Y - 30)) * q;
        }
        sock(ctx, x, yy, SOCKS[g.i], now / 200, 0);
      }
    }
    if (this.hold?.kind === "sock") {
      const w = this.world();
      sock(ctx, w.x - 4, w.y - 4, SOCKS[this.hold.i], 0.2, 0);
    }
  }

  private drawSlab(ctx: CanvasRenderingContext2D, l: number) {
    const y = floorY(l);
    ctx.fillStyle = "#A9A195";
    ctx.fillRect(WALL_X0 - 8, y, WALL_X1 - WALL_X0 + 16, SLAB);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(WALL_X0 - 8, y, WALL_X1 - WALL_X0 + 16, SLAB);
    // a hole in the slab where the stairs go through
    if (l < LAST) {
      ctx.fillStyle = "#D6D0C4";
      const a = Math.min(topX(l), botX(l)) - 4;
      ctx.fillRect(a + 8, y, 90, SLAB + 1);
    }
    // and where the lift shaft does
    if (l >= LIFT_TOP - 1 && l < LIFT_BOTTOM) {
      ctx.fillStyle = "#77716A";
      ctx.fillRect(SHAFT_X0 + 2, y, SHAFT_X1 - SHAFT_X0 - 4, SLAB + 1);
    }
  }

  private drawShaft(ctx: CanvasRenderingContext2D, now: number, top: number, bottom: number) {
    const y0 = floorY(LIFT_TOP - 1) + SLAB;
    const y1 = floorY(LIFT_BOTTOM);
    ctx.fillStyle = "#77716A";
    ctx.fillRect(SHAFT_X0, Math.max(y0, top), SHAFT_X1 - SHAFT_X0, Math.min(y1, bottom) - Math.max(y0, top));
    const lift = this.state.lift;
    const ll = liftLevel(lift, now);
    const cy = floorY(ll);
    // cables
    line(ctx, (CAR_X0 + CAR_X1) / 2 - 6, y0, (CAR_X0 + CAR_X1) / 2 - 6, cy - 108, "#2E2C28", 1.5);
    line(ctx, (CAR_X0 + CAR_X1) / 2 + 6, y0, (CAR_X0 + CAR_X1) / 2 + 6, cy - 108, "#2E2C28", 1.5);
    // the car
    ctx.fillStyle = "#D9CFB8";
    ctx.fillRect(CAR_X0, cy - 108, CAR_X1 - CAR_X0, 108);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(CAR_X0, cy - 108, CAR_X1 - CAR_X0, 108);
    ctx.fillStyle = "rgba(28,28,26,0.12)";
    ctx.fillRect(CAR_X0 + 8, cy - 100, 10, 30);
    // the doors on every floor: open only where the car is standing
    const open = doorsOpen(lift, now);
    for (let l = LIFT_TOP; l <= LIFT_BOTTOM; l++) {
      const fy = floorY(l);
      if (fy < top - 20 || fy - 120 > bottom) continue;
      const here = open && lift.at === l;
      // the doors slide shut over their last 400ms
      const g = here ? Math.max(0.1, Math.min(1, (lift.open - now) / 400)) : 0;
      ctx.fillStyle = "#9A948A";
      ctx.fillRect(SHAFT_X0 - 4, fy - 112, 10, 112 - (here ? 112 * g : 0));
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(SHAFT_X0 - 4, fy - 112, 10, 112 - (here ? 112 * g : 0));
      // the call button and the floor display above the door
      ctx.fillStyle = "#EDE7DA";
      ctx.fillRect(CALL_X - 7, fy - 82, 14, 24);
      ctx.strokeRect(CALL_X - 7, fy - 82, 14, 24);
      const called = lift.queue.includes(l) || (lift.to === l && lift.to !== lift.at);
      ctx.fillStyle = called ? "#E0A33A" : "#8D857A";
      ctx.beginPath();
      ctx.arc(CALL_X, fy - 70, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2E2C28";
      ctx.fillRect(SHAFT_X0 - 34, fy - 136, 30, 16);
      ctx.fillStyle = "#E7B54A";
      ctx.font = "11px 'Courier Prime', monospace";
      ctx.textAlign = "center";
      ctx.fillText(LEVELS[Math.round(ll)].short + (lift.to > lift.at ? "↓" : lift.to < lift.at ? "↑" : ""), SHAFT_X0 - 19, fy - 124);
    }
  }

  /** The storey indicator on the right: where you are, and where everybody else is. */
  private drawIndicator(ctx: CanvasRenderingContext2D) {
    const x = W - 30;
    const y0 = 70;
    const step = 40;
    ctx.save();
    const hot = this.pointerIn ? this.floorButton() : -1;
    for (let l = 0; l <= LAST; l++) {
      const y = y0 + l * step;
      const me = l === this.level;
      ctx.fillStyle = me ? INK : l === hot || this.goal?.level === l ? "#DCE4F5" : "rgba(251,250,247,0.85)";
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = me ? "#FBFAF7" : INK;
      ctx.font = "13px 'Work Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(LEVELS[l].short, x, y + 4.5);
      let n = 0;
      for (const o of this.others.values()) if (levelAt(o.ty) === l) n++;
      for (let i = 0; i < Math.min(n, 5); i++) {
        ctx.fillStyle = PEN;
        ctx.beginPath();
        ctx.arc(x - 22 - i * 7, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

// ─── the flats ────────────────────────────────────────────────────────────────

function floor5(ctx: CanvasRenderingContext2D, y: number, b: Building, now: number) {
  // a sofa, the lamp, and the picture
  rug(ctx, 380, y, 300, "#C9B79A");
  sofa(ctx, 410, y, 220, "#7D8C9E");
  lamp(ctx, 748, y, b.state.lamp, now);
  plant(ctx, 366, y, 0.9, "fine");
  // the coat rail, with whatever's still on it
  ctx.fillStyle = "#8C6A4A";
  ctx.fillRect(240, RAIL_Y - 6, 100, 6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(240, RAIL_Y - 6, 100, 6);
  for (const g of GARMENTS) {
    const hx = HOOK_X[g];
    line(ctx, hx, RAIL_Y, hx, RAIL_Y + 6, INK, 2);
    if (onStand(b.state, g, now)) hanging(ctx, g, hx, RAIL_Y + 6);
  }
  const a = b.frameAngle();
  const { x, y: fy, w, h } = FRAME;
  // the nail and the wire
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x, fy - h / 2 - 22, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, fy - h / 2 - 22);
  ctx.rotate((a * Math.PI) / 180);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 14, 22);
  ctx.lineTo(0, 0);
  ctx.lineTo(w / 2 - 14, 22);
  ctx.stroke();
  ctx.translate(0, 22 + h / 2);
  ctx.fillStyle = "#6B4E33";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = "#F4EFE2";
  ctx.fillRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18);
  // a print of some hills
  ctx.fillStyle = "#A9BFA4";
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 9, h / 2 - 9);
  ctx.quadraticCurveTo(-20, -18, 10, h / 2 - 30);
  ctx.quadraticCurveTo(30, -10, w / 2 - 9, h / 2 - 22);
  ctx.lineTo(w / 2 - 9, h / 2 - 9);
  ctx.fill();
  ctx.fillStyle = "#E3B556";
  ctx.beginPath();
  ctx.arc(24, -12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  // the spirit level somebody left on top of it
  ctx.fillStyle = "#E2C24B";
  ctx.fillRect(-36, -h / 2 - 12, 72, 12);
  ctx.strokeRect(-36, -h / 2 - 12, 72, 12);
  ctx.fillStyle = "#CFE3D0";
  ctx.fillRect(-12, -h / 2 - 9, 24, 6);
  line(ctx, -4, -h / 2 - 9, -4, -h / 2 - 3, "rgba(28,28,26,0.5)", 1);
  line(ctx, 4, -h / 2 - 9, 4, -h / 2 - 3, "rgba(28,28,26,0.5)", 1);
  const bub = Math.max(-9, Math.min(9, a * 14));
  ctx.fillStyle = "#FBFAF7";
  ctx.beginPath();
  ctx.ellipse(bub, -h / 2 - 6, 3.6, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // how far off it is, in pencil on the wall
  hand(ctx, a === 0 ? "level!" : `${Math.abs(a).toFixed(2)}° off`, x + w / 2 + 16, fy + 4, 22, "left", a === 0 ? PEN : INK);
  if (b.state.frame.n) hand(ctx, `straightened ${b.state.frame.n.toLocaleString("en")} times`, x + w / 2 + 16, fy + 24, 17, "left", "rgba(28,28,26,0.55)");
}

function floor4(ctx: CanvasRenderingContext2D, y: number, b: Building, now: number) {
  // the boxes, however many are still packed
  const labels = ["KITCHEN?", "BOOKS", "MISC", "CABLES", "MISC 2", "SHOES?", "MISC", "PLATES", "MISC 3", "DO NOT", "MISC", "WINTER", "MISC", "??"];
  const n = b.state.boxes.n;
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const off = row % 2 ? 10 : 0;
    box(ctx, 262 + col * 58 + off, y - row * 34, 56, 34, labels[i % labels.length]);
  }
  if (b.state.boxes.opened) hand(ctx, `${b.state.boxes.opened} unpacked`, 350, y - 34 * Math.ceil(n / 3) - 12, 17, "center", "rgba(28,28,26,0.55)");
  // a mattress on the floor
  ctx.fillStyle = "#EDE6D6";
  ctx.fillRect(460, y - 22, 150, 22);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(460, y - 22, 150, 22);
  ctx.fillStyle = "#D7CFC0";
  ctx.fillRect(470, y - 30, 40, 10);
  ctx.strokeRect(470, y - 30, 40, 10);
  // the fridge, its door hinged on the left and swinging out towards you
  const d = b.fridgeDoor();
  const fx = FRIDGE.x;
  const fw = FRIDGE.w;
  const fh = FRIDGE.h;
  const edge = fridgeEdge(d);
  // the inside: shelves, eleven sauces, the light on when the door's open at all
  ctx.fillStyle = d > 0.02 ? "#FFF6D2" : "#F2F1EC";
  ctx.fillRect(fx, y - fh, fw, fh);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(fx, y - fh, fw, fh);
  for (let r = 0; r < 3; r++) line(ctx, fx + 4, y - 130 + r * 40, fx + fw - 4, y - 130 + r * 40, "rgba(28,28,26,0.4)", 1.5);
  const sauces = ["#C0533F", "#E3B556", "#4F7A5A", "#7A3B2E", "#E07A3A", "#C0533F", "#B98A2E", "#5C3A2E", "#E3B556", "#9C2F2F", "#4F7A5A"];
  sauces.forEach((c, i) => {
    const r = Math.floor(i / 4);
    const sx = fx + 10 + (i % 4) * 17;
    ctx.fillStyle = c;
    ctx.fillRect(sx, y - 130 + r * 40 - 22, 9, 22);
    ctx.fillStyle = INK;
    ctx.fillRect(sx + 2, y - 130 + r * 40 - 27, 5, 5);
  });
  if (d > 0.3) {
    ctx.fillStyle = `rgba(255,240,180,${0.35 * Math.min(1, d)})`;
    ctx.beginPath();
    ctx.moveTo(fx, y - fh);
    ctx.lineTo(Math.min(fx, edge) - 50, y);
    ctx.lineTo(fx + fw, y);
    ctx.fill();
  }
  // the door: a panel from the hinge to its free edge, bigger at the edge as it comes towards you
  const grow = 10 * Math.sin(Math.min(1, d) * Math.PI * 0.75);
  ctx.fillStyle = "#EEEDE7";
  ctx.beginPath();
  ctx.moveTo(fx, y - fh);
  ctx.lineTo(edge, y - fh - grow);
  ctx.lineTo(edge, y + grow * 0.4);
  ctx.lineTo(fx, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (d < 0.5) {
    // the front of the door, still mostly facing you: handle, magnets, the shopping list
    const fwd = (edge - fx) / fw;
    line(ctx, fx, y - 112, edge, y - 112 - grow * 0.4, INK, 1.2);
    line(ctx, edge - 10 * fwd, y - 150, edge - 10 * fwd, y - 128, INK, 2);
    if (fwd > 0.6) {
      ctx.fillStyle = "#E0A33A";
      for (let i = 0; i < 3; i++) ctx.fillRect(fx + (10 + i * 12) * fwd, y - 160, 7 * fwd, 10);
      hand(ctx, "milk", fx + (fw / 2) * fwd, y - 84, 18, "center", "rgba(28,28,26,0.4)");
    }
  }
  // left open, it complains
  if (b.state.fridge > 0.03 && b.hold?.kind !== "fridge" && Math.floor(now / 600) % 2) hand(ctx, "beep", fx + fw / 2, y - fh - 12, 20, "center", "#C0533F");
}

function floor3(ctx: CanvasRenderingContext2D, y: number, b: Building, now: number) {
  // a kitchen: window, counter, sink and that tap
  ctx.fillStyle = "#CFDDE6";
  ctx.fillRect(280, y - 196, 110, 96);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(280, y - 196, 110, 96);
  line(ctx, 335, y - 196, 335, y - 100, INK, 1.5);
  ctx.fillStyle = "#F0D98C";
  ctx.fillRect(350, y - 170, 18, 26);
  // counter and cupboards
  ctx.fillStyle = "#C9B79A";
  ctx.fillRect(420, y - 96, 320, 96);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(420, y - 96, 320, 96);
  for (let i = 1; i < 4; i++) line(ctx, 420 + i * 80, y - 88, 420 + i * 80, y, INK, 1);
  ctx.fillStyle = "#8E8476";
  ctx.fillRect(412, y - 104, 336, 10);
  ctx.strokeRect(412, y - 104, 336, 10);
  // the sink
  ctx.fillStyle = "#B8C0C4";
  ctx.fillRect(520, y - 104, 96, 8);
  // the pile of plates waiting by the sink
  for (let i = 0; i < b.state.dishes - (b.hold?.kind === "plate" ? 1 : 0); i++) {
    const py = y - 108 - i * 7;
    ctx.fillStyle = i % 2 ? "#F4F1EA" : "#E9E4D8";
    ctx.beginPath();
    ctx.ellipse(472 + ((i * 5) % 7) - 3, py, 30, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (i % 3 === 1) {
      ctx.fillStyle = "#C0533F";
      ctx.fillRect(462 + i, py - 3, 8, 2);
    }
  }
  // the mug shelf, and the kitchen bin (with the bag in it, or waiting beside it)
  ctx.fillStyle = "#A07A55";
  ctx.fillRect(428, y - 190, 94, 7);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(428, y - 190, 94, 7);
  ctx.fillStyle = "#8E9396";
  ctx.fillRect(KITCHEN_BIN.x - 12, y - 34, 24, 34);
  ctx.strokeRect(KITCHEN_BIN.x - 12, y - 34, 24, 34);
  ctx.fillRect(KITCHEN_BIN.x - 14, y - 38, 28, 5);
  // the dish rack with its fork
  line(ctx, 640, y - 104, 708, y - 104, INK, 1.2);
  for (let i = 0; i < 6; i++) line(ctx, 644 + i * 12, y - 104, 644 + i * 12, y - 118, INK, 1);
  line(ctx, 690, y - 104, 698, y - 126, "#8E8E8E", 2);
  // the tap: a spout, and a lever you pull up to open
  const h = b.tapOpen();
  ctx.strokeStyle = "#9AA3A8";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(TAP.x + 10, y - 104);
  ctx.lineTo(TAP.x + 10, TAP.y - 14);
  ctx.quadraticCurveTo(TAP.x + 10, TAP.y - 26, TAP.x - 4, TAP.y - 26);
  ctx.lineTo(TAP.x - 14, TAP.y - 22);
  ctx.stroke();
  ctx.lineCap = "butt";
  const ang = -0.15 - h * 1.1;
  ctx.strokeStyle = "#6F787D";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(TAP.x + 12, TAP.y - 10);
  ctx.lineTo(TAP.x + 12 + Math.cos(ang) * 30, TAP.y - 10 + Math.sin(ang) * 30);
  ctx.stroke();
  ctx.fillStyle = "#6F787D";
  ctx.beginPath();
  ctx.arc(TAP.x + 12, TAP.y - 10, 5, 0, Math.PI * 2);
  ctx.fill();
  // water
  const sx = TAP.x - 15;
  const sy = TAP.y - 20;
  const rate = dripRate(h);
  if (rate >= 5) {
    ctx.strokeStyle = "rgba(120,170,200,0.85)";
    ctx.lineWidth = 1.5 + h * 5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let i = 1; i <= 8; i++) ctx.lineTo(sx + Math.sin(now / 60 + i) * 0.8, sy + (i / 8) * (y - 104 - sy));
    ctx.stroke();
  } else {
    for (const d of b.drops) {
      const p = (now - d.t) / 500;
      ctx.fillStyle = "rgba(120,170,200,0.9)";
      ctx.beginPath();
      ctx.ellipse(sx, sy + p * p * (y - 104 - sy), 2.4, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // the note taped to the cupboard
  ctx.fillStyle = "#FBF6DF";
  ctx.save();
  ctx.translate(560, y - 214);
  ctx.rotate(-0.04);
  ctx.fillRect(0, 0, 150, 56);
  ctx.fillStyle = "rgba(232,220,186,0.9)";
  ctx.fillRect(56, -6, 40, 12);
  ctx.restore();
  hand(ctx, "drips so far:", 570, y - 190, 18, "left");
  hand(ctx, b.dripCount().toLocaleString("en"), 570, y - 168, 24, "left", PEN);
}

function floor2(ctx: CanvasRenderingContext2D, y: number, b: Building, now: number) {
  const s = b.state;
  // the chair, pushed in under the desk or not
  const cx = b.chairX();
  const tucked = chairIn(cx);
  if (tucked) chair(ctx, cx, y);
  // somebody's home office: a desk, the telly they work on, cables
  ctx.fillStyle = "#B98C5E";
  ctx.fillRect(300, y - 76, 170, 10);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(300, y - 76, 170, 10);
  line(ctx, 308, y - 66, 308, y, INK, 3);
  line(ctx, 462, y - 66, 462, y, INK, 3);
  ctx.fillStyle = "#2E2C28";
  ctx.fillRect(344, y - 134, 86, 56);
  const sg = signal(b.aerialDeg());
  ctx.fillStyle = "#9FB6C9";
  ctx.fillRect(349, y - 129, 76, 46);
  // the picture (whichever channel the remote last left it on), through however much snow
  const ch = s.tv;
  ctx.fillStyle = ["#9FB6C9", "#3F7A4F", "#E39A5A", "#6A5A9C"][ch];
  ctx.fillRect(349, y - 129, 76, 46);
  if (ch === 0) {
    ctx.fillStyle = "#6F9A6A";
    ctx.fillRect(349, y - 100, 76, 17);
    ctx.fillStyle = "#E3B556";
    ctx.beginPath();
    ctx.arc(404, y - 116, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (ch === 1) {
    for (const [bx, by, c] of [[372, -110, "#C0533F"], [392, -104, "#F4F1EA"], [404, -114, "#1C1C1A"]] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(bx, y + by, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ch === 2) {
    ctx.fillStyle = "#F4F1EA";
    ctx.fillRect(360, y - 122, 30, 28);
    ctx.fillStyle = "#C0533F";
    ctx.font = "9px 'Work Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("£19.99", 394, y - 104);
  } else {
    ctx.fillStyle = "#E3B556";
    ctx.font = "16px 'Libre Caslon Text', serif";
    ctx.textAlign = "center";
    ctx.fillText("?", 387, y - 100);
  }
  const snow = 1 - sg / 100;
  const seed = Math.floor(now / 80);
  for (let i = 0; i < 260 * snow; i++) {
    const r = (seed * 9301 + i * 49297) % 233280;
    ctx.fillStyle = r % 2 ? "rgba(250,250,250,0.85)" : "rgba(60,60,60,0.75)";
    ctx.fillRect(349 + (r % 76), y - 129 + ((r >> 3) % 46), 2, 2);
  }
  ctx.fillStyle = "#E7B54A";
  ctx.font = "10px 'Courier Prime', monospace";
  ctx.textAlign = "right";
  ctx.fillText(`${sg}%`, 423, y - 86);
  line(ctx, 387, y - 78, 387, y - 76, INK, 3);
  // cables
  ctx.strokeStyle = "#1C1C1A";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(400 + i * 8, y - 66);
    ctx.bezierCurveTo(380 + i * 14, y - 10, 330 - i * 6, y - 30 + i * 4, 310 + i * 10, y - 2);
    ctx.stroke();
  }
  if (!tucked) chair(ctx, cx, y);
  // a bookshelf
  ctx.fillStyle = "#A07A55";
  ctx.fillRect(570, y - 190, 60, 190);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(570, y - 190, 60, 190);
  const spines = ["#C0533F", "#2D4C9A", "#E3D7BE", "#4F7A5A", "#B98A2E"];
  for (let k = 0; k < 4; k++) {
    line(ctx, 570, y - 190 + 46 * (k + 1), 630, y - 190 + 46 * (k + 1), INK, 1.2);
    for (let j = 0; j < 6; j++) {
      ctx.fillStyle = spines[(k * 3 + j) % spines.length];
      ctx.fillRect(574 + j * 9, y - 190 + 46 * k + 10, 7, 36);
    }
  }
  // the plant, thirsty or drowning or, briefly, fine
  const mood = plantMood(water(s, now));
  if (mood === "drowned") {
    ctx.fillStyle = "rgba(120,170,200,0.55)";
    ctx.beginPath();
    ctx.ellipse(702, y - 1, 46, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  plant(ctx, PLANT_X, y, 1.15, mood);
  // the watering can, where it lives, unless somebody's holding it
  if (b.hold?.kind !== "can") can(ctx, CAN_HOME.x, y, 0);
}

function lobby(ctx: CanvasRenderingContext2D, y: number, b: Building) {
  const s = b.state;
  // the front door, daylight behind it
  const d = FRONT_DOOR;
  ctx.fillStyle = "#EEF0EA";
  ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(d.x, d.y, d.w, d.h);
  line(ctx, d.x + d.w / 2, d.y, d.x + d.w / 2, d.y + d.h, INK, 2);
  ctx.fillStyle = INK;
  ctx.font = "11px 'Work Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("WAY OUT", d.x + d.w / 2, d.y - 8);
  // the doormat: flat when straight, rucked up when it isn't
  const mx0 = MAT_X[0] + 4;
  const mx1 = MAT_X[1] - 4;
  const ruck = Math.min(1, Math.abs(s.mat) / 10);
  ctx.fillStyle = "#9C6B3E";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (ruck < 0.3) {
    ctx.rect(mx0, y - 5, mx1 - mx0, 5);
  } else {
    // one end folded back on itself
    const fold = s.mat > 0 ? mx1 - 26 * ruck : mx0 + 26 * ruck;
    ctx.moveTo(mx0, y);
    ctx.lineTo(mx1, y);
    if (s.mat > 0) {
      ctx.lineTo(mx1, y - 4);
      ctx.quadraticCurveTo(fold + 6, y - 22 * ruck, fold - 10, y - 5);
      ctx.lineTo(mx0, y - 5);
    } else {
      ctx.lineTo(mx1, y - 5);
      ctx.lineTo(fold + 10, y - 5);
      ctx.quadraticCurveTo(fold - 6, y - 22 * ruck, mx0, y - 4);
    }
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  // the noticeboard
  ctx.fillStyle = "#C2A27A";
  ctx.lineWidth = 3;
  ctx.fillRect(400, y - 190, 90, 70);
  ctx.strokeRect(400, y - 190, 90, 70);
  ctx.fillStyle = "#FBFAF7";
  ctx.fillRect(410, y - 182, 70, 46);
  hand(ctx, "LIFT IS", 445, y - 166, 15, "center");
  hand(ctx, "FINE NOW", 445, y - 150, 15, "center");
  // the post boxes, one of them with something sticking out
  ctx.fillStyle = "#A9A69E";
  ctx.fillRect(520, y - 170, 150, 104);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(520, y - 170, 150, 104);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++) {
      const bx = 526 + c * 36;
      const by = y - 164 + r * 32;
      ctx.strokeRect(bx, by, 32, 28);
      line(ctx, bx + 8, by + 8, bx + 24, by + 8, INK, 1);
      ctx.fillStyle = "rgba(28,28,26,0.5)";
      ctx.font = "8px 'Work Sans', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(boxName(r * 4 + c), bx + 3, by + 24);
      if (r * 4 + c === 7) {
        // 4B, stuffed with pizza menus
        for (let k = 0; k < Math.min(6, Math.ceil(s.menus / 2)); k++) {
          ctx.save();
          ctx.translate(bx + 16, by + 8);
          ctx.rotate(-0.5 + k * 0.22);
          ctx.fillStyle = ["#E3B556", "#C0533F", "#F4EFE2", "#4F7A5A", "#E07A3A", "#FBFAF7"][k];
          ctx.fillRect(-6, -18, 16, 18);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 0.8;
          ctx.strokeRect(-6, -18, 16, 18);
          ctx.restore();
        }
      }
    }
  // a bench
  ctx.fillStyle = "#8C6A4A";
  ctx.fillRect(520, y - 40, 140, 10);
  line(ctx, 530, y - 30, 530, y, INK, 3);
  line(ctx, 650, y - 30, 650, y, INK, 3);
  // the loo, and the roll on its holder (one sheet left, usually)
  ctx.fillStyle = "#D9D2C2";
  ctx.fillRect(LOO.x0 + 4, y - 120, LOO.x1 - LOO.x0 - 8, 120);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(LOO.x0 + 4, y - 120, LOO.x1 - LOO.x0 - 8, 120);
  ctx.fillStyle = INK;
  ctx.font = "11px 'Work Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("WC", (LOO.x0 + LOO.x1) / 2, y - 100);
  ctx.beginPath();
  ctx.arc(LOO.x1 - 14, y - 60, 2, 0, Math.PI * 2);
  ctx.fill();
  const rollR = 3 + Math.min(1, s.loo / 40) * 7;
  ctx.fillStyle = "#FBFAF7";
  ctx.beginPath();
  ctx.arc(LOO.x0 - 2, y - 66, rollR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#FBFAF7";
  ctx.fillRect(LOO.x0 - 2 - (s.loo <= 1 ? 3 : 4), y - 66, s.loo <= 1 ? 6 : 8, s.loo <= 1 ? 10 : 18);
  // how clean the building is, pinned up by the management
  ctx.fillStyle = "#FBFAF7";
  ctx.fillRect(452, y - 116, 40, 22);
  hand(ctx, `${cleanliness(s, b.now())}% clean`, 472, y - 100, 14, "center", PEN);

}

function basement(ctx: CanvasRenderingContext2D, y: number, b: Building, now: number) {
  const s = b.state;
  // the light switch on its timer
  ctx.fillStyle = "#EDE7DA";
  ctx.fillRect(252, y - 128, 24, 40);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.strokeRect(252, y - 128, 24, 40);
  const on = lightOn(s, now);
  ctx.fillStyle = on ? "#F3D36B" : "#8D857A";
  ctx.fillRect(259, on ? y - 122 : y - 108, 10, 14);
  ctx.fillStyle = "rgba(28,28,26,0.55)";
  ctx.font = "8px 'Work Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TIMER", 264, y - 80);
  // the cleaning shelf, the mop's corner, and the big bins
  ctx.fillStyle = "#A07A55";
  ctx.fillRect(296, y - 150, 70, 6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(296, y - 150, 70, 6);
  hand(ctx, "cleaning", 331, y - 156, 15, "center", "rgba(28,28,26,0.5)");
  ctx.fillStyle = "#4F6B55";
  ctx.fillRect(BINS.x0 + 4, y - 58, BINS.x1 - BINS.x0 - 8, 58);
  ctx.strokeRect(BINS.x0 + 4, y - 58, BINS.x1 - BINS.x0 - 8, 58);
  ctx.fillStyle = "#3E5544";
  ctx.fillRect(BINS.x0, y - 64, BINS.x1 - BINS.x0, 8);
  ctx.strokeRect(BINS.x0, y - 64, BINS.x1 - BINS.x0, 8);
  ctx.fillStyle = "#F4F1EA";
  ctx.font = "9px 'Work Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BINS", (BINS.x0 + BINS.x1) / 2, y - 30);
  hand(ctx, `${s.bins.out} bags out`, (BINS.x0 + BINS.x1) / 2, y - 72, 15, "center", "rgba(28,28,26,0.55)");
  // the umbrella bin
  ctx.fillStyle = "#6F6A63";
  ctx.fillRect(310, y - 52, 50, 52);
  ctx.strokeRect(310, y - 52, 50, 52);
  const cols = ["#2D4C9A", "#C0533F", "#1C1C1A", "#4F7A5A", "#B98A2E", "#7A5C8E"];
  for (let i = 0; i < 9; i++) {
    const x = 314 + i * 5;
    line(ctx, x, y - 52, x - 6 + i * 1.6, y - 96 + (i % 3) * 6, cols[i % cols.length], 3);
  }
  // the boiler, pipes and all
  ctx.fillStyle = "#C2B9A6";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.fillRect(480, y - 180, 120, 180);
  ctx.strokeRect(480, y - 180, 120, 180);
  ctx.fillStyle = "#2E2C28";
  ctx.fillRect(520, y - 60, 40, 30);
  ctx.fillStyle = "#E07A3A";
  ctx.fillRect(528, y - 52, 24, 14);
  ctx.fillStyle = "#FBFAF7";
  ctx.beginPath();
  ctx.arc(540, y - 130, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  line(ctx, 540, y - 130, 548, y - 140, "#C0533F", 2);
  line(ctx, 500, y - 180, 500, y - FH + 20, "#8E8476", 8);
  line(ctx, 580, y - 180, 580, y - FH + 20, "#8E8476", 8);
  line(ctx, 580, y - 210, WALK_X1, y - 210, "#8E8476", 8);
  // the washing machine: it shakes while it runs
  const run = washing(s, now);
  const jig = run ? Math.sin(now / 40) * 1.5 : 0;
  const wx = 640 + jig;
  ctx.fillStyle = "#EDEBE5";
  ctx.fillRect(wx, y - 96, 92, 96);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(wx, y - 96, 92, 96);
  line(ctx, wx, y - 78, wx + 92, y - 78, INK, 1.2);
  ctx.fillStyle = "#9FB6C9";
  ctx.beginPath();
  ctx.arc(wx + 46, y - 40, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (run) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    const a = now / 120;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(wx + 46, y - 40, 14, a + i * 2.1, a + i * 2.1 + 0.9);
      ctx.stroke();
    }
    ctx.fillStyle = "#3E7C86";
    ctx.fillRect(wx + 70, y - 90, 8, 6);
  }
  hand(ctx, `lone socks: ${s.washer.lone}`, 686, y - 106, 18, "center", PEN);
}

/** The basement in the dark, and Floor 5 with its lamp off; drawn over everything. */
function lights(ctx: CanvasRenderingContext2D, b: Building, now: number) {
  const s = b.state;
  const x0 = STAIR_X1 + 8;
  const w = SHAFT_X0 - x0;
  const storey = (l: number) => [floorY(l - 1) + SLAB, floorY(l) - floorY(l - 1) - SLAB] as const;
  {
    const [y0, h] = storey(1);
    if (!s.lamp) {
      ctx.fillStyle = "rgba(36,36,56,0.2)";
      ctx.fillRect(x0, y0, w, h);
    } else {
      const flick = Math.sin(now / 37) * Math.sin(now / 113) > 0.92 ? 0.05 : 0.2;
      const g = ctx.createRadialGradient(748, y0 + 80, 10, 748, y0 + 80, 320);
      g.addColorStop(0, `rgba(255,226,140,${flick})`);
      g.addColorStop(1, "rgba(255,226,140,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, w, h);
    }
  }
  if (!lightOn(s, now)) {
    const [y0, h] = storey(BASEMENT);
    ctx.fillStyle = "rgba(14,14,20,0.86)";
    ctx.fillRect(x0, y0, w, h);
    // the switch glows, as they do
    ctx.fillStyle = "rgba(243,211,107,0.85)";
    ctx.fillRect(259, floorY(BASEMENT) - 108, 10, 14);
  }
}

// ─── bits ─────────────────────────────────────────────────────────────────────

function stairs(ctx: CanvasRenderingContext2D, from: number) {
  if (from < 0) return;
  const x0 = topX(from);
  const x1 = botX(from);
  const y0 = floorY(from) + SLAB;
  const y1 = floorY(from + 1);
  const n = 12;
  ctx.fillStyle = "#B3AA9C";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 0; i < n; i++) {
    const ax = x0 + ((x1 - x0) * i) / n;
    const ay = y0 + ((y1 - y0) * (i + 1)) / n;
    ctx.lineTo(ax, ay);
    ctx.lineTo(x0 + ((x1 - x0) * (i + 1)) / n, ay);
  }
  ctx.lineTo(x1, y1 + 2);
  ctx.lineTo(x1 - (x1 - x0) * 0.08, y1 + 2);
  ctx.lineTo(x0, y0 + 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // the handrail
  ctx.strokeStyle = "#6B4E33";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0 - 30 + 14);
  ctx.lineTo(x1, y1 - 30);
  ctx.stroke();
}

function thud(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number) {
  // footsteps, as the people downstairs hear them
  if (Math.sin(phase) < 0.6) return;
  ctx.strokeStyle = "rgba(28,28,26,0.35)";
  ctx.lineWidth = 1;
  const cy = y + SLAB + 6;
  for (const dx of [-8, 0, 8]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, cy);
    ctx.lineTo(x + dx * 1.6, cy + 6);
    ctx.stroke();
  }
}

export function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hue: number,
  dir: number,
  phase: number,
  walking: boolean,
  gesture: number,
  skin: number,
  me: boolean,
  wear: Garment[] = [],
) {
  const c0 = HUES[((hue % HUES.length) + HUES.length) % HUES.length];
  // a dressing gown or a raincoat goes over everything, sleeves and all
  const c = wear.includes("coat") ? "#E8C33A" : wear.includes("gown") ? "#C9A2B8" : c0;
  ctx.save();
  ctx.lineCap = "round";
  // shadow
  ctx.fillStyle = me ? "rgba(45,76,154,0.25)" : "rgba(28,28,26,0.14)";
  ctx.beginPath();
  ctx.ellipse(x, y - 1, me ? 12 : 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  const sw = walking ? Math.sin(phase) * 6 : 0;
  const bob = walking ? Math.abs(Math.cos(phase)) * 1.5 : 0;
  // legs
  ctx.strokeStyle = "#3A3631";
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(x - 3, y - 16 - bob);
  ctx.lineTo(x - 3 + sw, y);
  ctx.moveTo(x + 3, y - 16 - bob);
  ctx.lineTo(x + 3 - sw, y);
  ctx.stroke();
  // body
  ctx.fillStyle = c;
  ctx.beginPath();
  if (wear.includes("gown") || wear.includes("coat")) ctx.roundRect(x - 10, y - 39 - bob, 20, wear.includes("gown") ? 33 : 28, 6);
  else ctx.roundRect(x - 8, y - 38 - bob, 16, 24, 6);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  if (wear.includes("gown")) line(ctx, x - 10, y - 24 - bob, x + 10, y - 24 - bob, "#8C5A72", 2);
  if (wear.includes("coat")) {
    // the hood, behind the head
    ctx.fillStyle = "#E8C33A";
    ctx.beginPath();
    ctx.arc(x - dir * 3, y - 46 - bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // arms
  ctx.strokeStyle = c;
  ctx.lineWidth = 3.6;
  const sy = y - 33 - bob;
  ctx.beginPath();
  if (gesture === 1) {
    const wv = Math.sin(Date.now() / 90) * 5;
    ctx.moveTo(x + 6 * dir, sy);
    ctx.lineTo(x + 12 * dir + wv, sy - 16);
    ctx.moveTo(x - 6 * dir, sy);
    ctx.lineTo(x - 8 * dir, sy + 14);
  } else if (gesture === 2) {
    ctx.moveTo(x + 6 * dir, sy);
    ctx.lineTo(x + 24 * dir, sy - 2);
    ctx.moveTo(x - 6 * dir, sy);
    ctx.lineTo(x - 8 * dir, sy + 14);
  } else if (gesture === 3) {
    ctx.moveTo(x + 6 * dir, sy);
    ctx.lineTo(x + 18 * dir, sy - 12);
    ctx.moveTo(x - 6 * dir, sy);
    ctx.lineTo(x + 10 * dir, sy - 8);
  } else {
    ctx.moveTo(x + 6, sy);
    ctx.lineTo(x + 8 - sw * 0.5, sy + 14);
    ctx.moveTo(x - 6, sy);
    ctx.lineTo(x - 8 + sw * 0.5, sy + 14);
  }
  ctx.stroke();
  // head
  ctx.fillStyle = SKIN[skin % SKIN.length];
  ctx.beginPath();
  ctx.arc(x + dir * 1, y - 47 - bob, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + dir * 4.5, y - 48 - bob, 1.2, 0, Math.PI * 2);
  ctx.fill();
  if (wear.includes("scarf")) {
    // round the neck, and a long tail that trails behind
    ctx.fillStyle = "#C0533F";
    ctx.fillRect(x - 8, y - 40 - bob, 16, 5);
    ctx.strokeStyle = "#C0533F";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - dir * 6, y - 38 - bob);
    ctx.quadraticCurveTo(x - dir * 18, y - 30 - bob + Math.sin(phase) * 3, x - dir * 30, y - 26 - bob + Math.sin(phase * 1.3) * 5);
    ctx.stroke();
    ctx.strokeStyle = "#F4F1EA";
    ctx.lineWidth = 1.5;
    for (const k of [0.4, 0.7]) {
      const sx = x - dir * (6 + 24 * k);
      line(ctx, sx, y - 36 - bob + k * 8, sx, y - 32 - bob + k * 8, "#F4F1EA", 2);
    }
  }
  if (wear.includes("hat")) {
    // a bobble hat, perched (it's slightly too small)
    ctx.fillStyle = "#2D4C9A";
    ctx.beginPath();
    ctx.arc(x + dir, y - 52 - bob, 7, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#E8E2D0";
    ctx.fillRect(x + dir - 7, y - 53 - bob, 14, 3);
    ctx.beginPath();
    ctx.arc(x + dir, y - 61 - bob, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (me) hand(ctx, "you", x, y - (wear.includes("hat") ? 70 : 62) - bob, 18, "center", PEN);
  ctx.restore();
}

/** One of the things on the coat rail, hanging off its hook at (x, y). */
function hanging(ctx: CanvasRenderingContext2D, g: Garment, x: number, y: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  if (g === "hat") {
    ctx.fillStyle = "#2D4C9A";
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 18);
    ctx.quadraticCurveTo(x, y - 2, x + 9, y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#E8E2D0";
    ctx.fillRect(x - 9, y + 15, 18, 4);
    ctx.beginPath();
    ctx.arc(x, y + 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (g === "scarf") {
    for (const dx of [-3, 3]) {
      ctx.fillStyle = "#C0533F";
      ctx.fillRect(x + dx - 3, y, 6, 74);
      ctx.strokeRect(x + dx - 3, y, 6, 74);
      ctx.fillStyle = "#F4F1EA";
      for (let k = 1; k < 4; k++) ctx.fillRect(x + dx - 3, y + k * 18, 6, 3);
    }
  } else {
    const long = g === "gown";
    ctx.fillStyle = long ? "#C9A2B8" : "#E8C33A";
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x + 11, y + (long ? 110 : 90));
    ctx.lineTo(x - 11, y + (long ? 110 : 90));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (long) line(ctx, x - 8, y + 48, x + 8, y + 48, "#8C5A72", 2);
    else line(ctx, x, y + 6, x, y + 88, "rgba(28,28,26,0.4)", 1);
  }
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string, w: number) {
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function hand(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, align: CanvasTextAlign = "left", c = INK) {
  ctx.fillStyle = c;
  ctx.font = `${size}px 'Reenie Beanie', cursive`;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string) {
  ctx.fillStyle = "#C9A57A";
  ctx.fillRect(x, y - h, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.strokeRect(x, y - h, w, h);
  ctx.fillStyle = "rgba(232,220,186,0.9)";
  ctx.fillRect(x + w / 2 - 6, y - h, 12, h * 0.5);
  hand(ctx, label, x + w / 2, y - h * 0.3, 16, "center");
}

function sofa(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, c: string) {
  ctx.fillStyle = c;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y - 74, w, 44, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x - 10, y - 46, w + 20, 34, 8);
  ctx.fill();
  ctx.stroke();
  line(ctx, x + w / 2, y - 46, x + w / 2, y - 14, INK, 1);
  line(ctx, x + 6, y - 12, x + 6, y, INK, 3);
  line(ctx, x + w - 6, y - 12, x + w - 6, y, INK, 3);
}

const SOCKS = ["#C0533F", "#2D4C9A", "#E8E2D0", "#4F7A5A", "#B98A2E", "#E8E2D0", "#7A5C8E", "#3E7C86", "#C0533F"];
const sockX = (i: number) => 318 + i * 23;
/** Where each sock lands when the wind puts it on the roof. */
const sockFloorX = (i: number) => 310 + ((i * 67) % 230);
/** How long a sock is in the air: onto the roof, or down to the street. */
const SOCK_FLIGHT: Record<number, number> = { 0: 0, 1: 1200, 2: 4200 };

const ITEM_NAMES: Record<ItemKind, string> = { remote: "remote", bag: "bin bag", roll: "loo roll", mop: "mop", sponge: "sponge", menus: "pizza menus" };
const PICK_LINES: Record<ItemKind, string> = {
  remote: "Got the remote. The telly is on 2.",
  bag: "The bin bag. It's leaking a bit.",
  roll: "A new loo roll. The loo is in the lobby.",
  mop: "The mop. Drag to mop.",
  sponge: "The sponge. Drag to scrub.",
  menus: "Pizza menus. The bins are in the basement.",
};
const DROP_LINES: Record<ItemKind, string> = {
  remote: "Down. Somebody will look for that.",
  bag: "Left it there. It's still leaking.",
  roll: "Down. The loo is in the lobby.",
  mop: "Put the mop down. Wet floor.",
  sponge: "Put the sponge down.",
  menus: "Left the menus there. Somebody will read one.",
};
const TV_LINES = ["Rain, mostly.", "Somebody is thinking about a shot.", "A knife that cuts a shoe.", "Nobody knows the answer."];
const FEET_LINES: Partial<Record<string, string>> = {
  soup: "You stepped in the bin juice.",
  mud: "You stepped in the mud. You'll be taking it upstairs.",
  water: "Wet floor. Your feet are wet now.",
};

/** A mark on the floor, a table, a shelf, at strength a. */
function drawMark(ctx: CanvasRenderingContext2D, m: Mark, a: number) {
  if (a <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  switch (m.k) {
    case "ring":
      ctx.strokeStyle = "rgba(110,72,40,0.85)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y - 1, 7, 2.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "soup":
    case "mud":
      ctx.fillStyle = m.k === "soup" ? "rgba(150,110,40,0.75)" : "rgba(92,66,40,0.8)";
      ctx.beginPath();
      ctx.ellipse(m.x, m.y - 1, 10, 2.6, 0, 0, Math.PI * 2);
      ctx.ellipse(m.x + 7, m.y - 1, 4, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "water":
      ctx.fillStyle = "rgba(140,185,215,0.6)";
      ctx.beginPath();
      ctx.ellipse(m.x, m.y - 1, 15, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "hair":
      ctx.strokeStyle = "rgba(70,66,60,0.8)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(m.x - 6 + i * 4, m.y - 2);
        ctx.quadraticCurveTo(m.x - 4 + i * 4, m.y - 6, m.x - 1 + i * 4, m.y - 2);
        ctx.stroke();
      }
      break;
    case "print": {
      ctx.fillStyle = m.c === "soup" ? "rgba(150,110,40,0.7)" : m.c === "water" ? "rgba(140,185,215,0.6)" : "rgba(92,66,40,0.75)";
      ctx.beginPath();
      ctx.ellipse(m.x - 4, m.y - 1, 5, 1.8, 0, 0, Math.PI * 2);
      ctx.ellipse(m.x + 5, m.y - 1.5, 5, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/** Something loose: lying where it was left (y is what it stands on), or in somebody's hand. */
function drawItem(ctx: CanvasRenderingContext2D, kind: ItemKind, x: number, y: number, dir: number, id: string, mopping = false) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  switch (kind) {
    case "remote":
      ctx.fillStyle = "#2E2C28";
      ctx.fillRect(x - 10, y - 5, 20, 5);
      ctx.fillStyle = "#C0533F";
      ctx.fillRect(x + 5, y - 4, 3, 2);
      break;
    case "bag":
      ctx.fillStyle = "#2E2C28";
      ctx.beginPath();
      ctx.moveTo(x - 12, y);
      ctx.quadraticCurveTo(x - 15, y - 20, x - 4, y - 24);
      ctx.lineTo(x - 2, y - 30);
      ctx.lineTo(x + 3, y - 30);
      ctx.lineTo(x + 4, y - 24);
      ctx.quadraticCurveTo(x + 15, y - 20, x + 12, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case "roll":
      ctx.fillStyle = "#FBFAF7";
      ctx.fillRect(x - 6, y - 12, 12, 12);
      ctx.strokeRect(x - 6, y - 12, 12, 12);
      ctx.beginPath();
      ctx.ellipse(x, y - 12, 6, 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "mop":
      if (!mopping) line(ctx, x + (dir || 1) * 6, y - 76, x, y - 6, "#8C6A4A", 3);
      ctx.fillStyle = "#D9D2C2";
      for (let i = 0; i < 7; i++) line(ctx, x - 9 + i * 3, y - 7, x - 11 + i * 3.6, y, "#C9C2B2", 2);
      ctx.fillRect(x - 10, y - 9, 20, 4);
      break;
    case "menus":
      ["#E3B556", "#C0533F", "#F4EFE2", "#4F7A5A"].forEach((c, k) => {
        ctx.fillStyle = c;
        ctx.save();
        ctx.translate(x, y - 2 - k * 2);
        ctx.rotate((k - 1.5) * 0.12);
        ctx.fillRect(-9, -3, 18, 3);
        ctx.strokeRect(-9, -3, 18, 3);
        ctx.restore();
      });
      break;
    case "sponge":
      ctx.fillStyle = "#E3C64A";
      ctx.fillRect(x - 9, y - 7, 18, 4);
      ctx.fillStyle = "#4F7A5A";
      ctx.fillRect(x - 9, y - 3, 18, 3);
      ctx.strokeRect(x - 9, y - 7, 18, 7);
      break;
  }
  ctx.restore();
}

function can(ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = "#4F7A5A";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.roundRect(-14, -28, 28, 28, 4);
  ctx.fill();
  ctx.stroke();
  // the spout and the handle
  ctx.beginPath();
  ctx.moveTo(-12, -18);
  ctx.lineTo(-32, -34);
  ctx.lineTo(-34, -30);
  ctx.lineTo(-14, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(2, -30, 10, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}

/** A little telly showing whatever the aerial can get. */
function telly(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sg: number, now: number, label: string) {
  ctx.fillStyle = "#2E2C28";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#9FB6C9";
  ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
  ctx.fillStyle = "#6F9A6A";
  ctx.fillRect(x + 6, y + h * 0.62, w - 12, h * 0.38 - 6);
  ctx.fillStyle = "#E3B556";
  ctx.beginPath();
  ctx.arc(x + w * 0.72, y + h * 0.35, 7, 0, Math.PI * 2);
  ctx.fill();
  const snow = 1 - sg / 100;
  const seed = Math.floor(now / 80);
  for (let i = 0; i < 600 * snow; i++) {
    const r = (seed * 9301 + i * 49297) % 233280;
    ctx.fillStyle = r % 2 ? "rgba(250,250,250,0.85)" : "rgba(60,60,60,0.75)";
    ctx.fillRect(x + 6 + (r % (w - 14)), y + 6 + ((r >> 3) % (h - 14)), 2, 2);
  }
  ctx.fillStyle = "#E7B54A";
  ctx.font = "11px 'Courier Prime', monospace";
  ctx.textAlign = "right";
  ctx.fillText(`${sg}%`, x + w - 9, y + h - 10);
  hand(ctx, label, x + 4, y + h + 18, 18, "left", INK);
}

/** The man from 4, the courier, and the cat. */
function drawResident(ctx: CanvasRenderingContext2D, r: NpcView, now: number, purring: boolean) {
  const walking = r.pose === "walk";
  const phase = now / 90;
  if (r.id === "cat") {
    // the cat doesn't walk anywhere: it trots
    drawCat(ctx, r.x, r.y - r.lift, r.dir, r.pose, now / 40, purring);
    return;
  }
  if (r.id === "man" && r.pose === "sleep") {
    // asleep on the mattress, under a blanket
    ctx.fillStyle = "#8C9A76";
    ctx.beginPath();
    ctx.roundRect(r.x - 46, r.y - 34, 84, 14, 6);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = SKIN[1];
    ctx.beginPath();
    ctx.arc(r.x + 46, r.y - 32, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    hand(ctx, "z", r.x + 58, r.y - 46 - (Math.floor(now / 700) % 3) * 6, 18, "left", PEN);
    return;
  }
  const hue = r.id === "man" ? 7 : 1;
  drawPerson(ctx, r.x, r.y, hue, r.dir, phase, walking, r.pose === "post" || r.pose === "look" ? 3 : 0, r.id === "man" ? 1 : 3, false);
  if (r.id === "man") {
    // grey hair and glasses
    ctx.fillStyle = "#B9B5AC";
    ctx.beginPath();
    ctx.arc(r.x + r.dir, r.y - 51, 8.5, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + r.dir * 3 - 3, r.y - 50, 6, 4);
  } else {
    // the courier's cap, and a parcel
    ctx.fillStyle = "#C0533F";
    ctx.fillRect(r.x - 9 + r.dir * 2, r.y - 57, 18, 5);
    ctx.fillRect(r.x + r.dir * 8, r.y - 54, r.dir * 8, 3);
    ctx.fillStyle = "#C9A57A";
    ctx.fillRect(r.x + r.dir * 6 - 8, r.y - 34, 16, 12);
    ctx.strokeStyle = INK;
    ctx.strokeRect(r.x + r.dir * 6 - 8, r.y - 34, 16, 12);
  }
}

function drawCat(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, pose: string, phase: number, purring: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = "#3A3631";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  if (pose === "sleep") {
    // a curled-up loaf
    ctx.beginPath();
    ctx.ellipse(0, -8, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, -10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, -15);
    ctx.lineTo(11, -20);
    ctx.lineTo(14, -15);
    ctx.fill();
  } else {
    const sit = pose === "sit" || pose === "swat";
    // body
    ctx.beginPath();
    if (sit) ctx.ellipse(-2, -12, 9, 11, -0.2, 0, Math.PI * 2);
    else ctx.ellipse(0, -12, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // legs
    if (!sit) {
      const s = Math.sin(phase) * 3;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#3A3631";
      for (const [lx, o] of [[-10, s], [-4, -s], [8, -s], [12, s]] as const) {
        ctx.beginPath();
        ctx.moveTo(lx, -8);
        ctx.lineTo(lx + o, 0);
        ctx.stroke();
      }
    }
    // tail
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#3A3631";
    ctx.beginPath();
    ctx.moveTo(sit ? -9 : -15, -12);
    ctx.quadraticCurveTo(-24, sit ? -6 : -30, sit ? -18 : -22, sit ? 0 : -32 + Math.sin(phase / 2) * 3);
    ctx.stroke();
    // head and ears
    const hx = sit ? 4 : 16;
    const hy = sit ? -26 : -18;
    ctx.beginPath();
    ctx.arc(hx, hy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx - 5, hy - 3);
    ctx.lineTo(hx - 3, hy - 10);
    ctx.lineTo(hx, hy - 5);
    ctx.lineTo(hx + 3, hy - 10);
    ctx.lineTo(hx + 5, hy - 3);
    ctx.fill();
    ctx.fillStyle = "#E3B556";
    ctx.fillRect(hx + 2, hy - 2, 2, 2);
    if (pose === "swat") {
      // a paw up at the picture
      ctx.strokeStyle = "#3A3631";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hx, hy + 6);
      ctx.lineTo(hx + 10 + Math.sin(phase * 2) * 4, hy - 22);
      ctx.stroke();
    }
  }
  ctx.restore();
  if (purring) hand(ctx, "prrr", x, y - 38, 18, "center", PEN);
}

function sock(ctx: CanvasRenderingContext2D, sx: number, sy: number, c: string, rot: number, wind: number) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(rot);
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(7, 0);
  ctx.lineTo(7 + wind * 0.5, 20);
  ctx.lineTo(14 + wind, 26);
  ctx.lineTo(12 + wind, 31);
  ctx.lineTo(wind * 0.5, 26);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(28,28,26,0.6)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function chair(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#4E5A66";
  ctx.fillRect(x - 21, y - 96, 40, 50);
  ctx.fillRect(x - 27, y - 50, 54, 10);
  line(ctx, x, y - 40, x, y - 10, INK, 3);
  line(ctx, x - 15, y - 6, x + 15, y - 6, INK, 3);
}

function lamp(ctx: CanvasRenderingContext2D, x: number, y: number, on: boolean, now: number) {
  line(ctx, x, y, x, y - 130, INK, 2);
  line(ctx, x - 14, y, x + 14, y, INK, 3);
  const flick = on && Math.sin(now / 37) * Math.sin(now / 113) > 0.92;
  ctx.fillStyle = on && !flick ? "#FFE9A0" : "#E2D6AE";
  ctx.beginPath();
  ctx.moveTo(x - 18, y - 128);
  ctx.lineTo(x + 18, y - 128);
  ctx.lineTo(x + 11, y - 156);
  ctx.lineTo(x - 11, y - 156);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

function plant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, mood: "dry" | "fine" | "drowned") {
  ctx.fillStyle = "#B4673F";
  ctx.beginPath();
  ctx.moveTo(x - 14 * s, y - 30 * s);
  ctx.lineTo(x + 14 * s, y - 30 * s);
  ctx.lineTo(x + 10 * s, y);
  ctx.lineTo(x - 10 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = mood === "dry" ? "#A89A5C" : mood === "drowned" ? "#3F5E44" : "#5C8A5E";
  // thirsty or drowning, the leaves hang down
  const droop = mood === "fine" ? 0.38 : 0.62;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * droop;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 22 * s, y - 30 * s + Math.sin(a) * 30 * s, 6 * s, 15 * s, a + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function rug(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y - 4, w, 4);
}
