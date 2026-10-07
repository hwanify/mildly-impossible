// The people (and the cat) who actually live in the building, and cause most of the trouble.
// Each follows a fixed daily-ish routine that repeats, worked out from the clock alone, so every
// visitor sees the same thing at the same moment without anything being sent, and the room
// server applies the trouble they cause at the same moments. Pure TypeScript.
import { BASEMENT, LOBBY, ROOF, floorY } from "./world";

export type NpcId = "man" | "courier" | "cat";
export type NpcDeed =
  | "fridge" | "dish" | "mat" | "shoes" | "mail" | "frame" | "remoteTake" | "remoteDrop" | "hair" | "mud" | "loo";
export type Pose = "walk" | "stand" | "look" | "sleep" | "sit" | "swat" | "post";

/** The flight of stairs from `level` down to the next: its top and bottom x. (Shared with the engine.) */
export const topX = (level: number) => (level % 2 === 0 ? 112 : 222);
export const botX = (level: number) => (level % 2 === 0 ? 222 : 112);

/** A walk from one spot to another, by the stairs if it's another floor. */
export function route(la: number, xa: number, lb: number, xb: number): [number, number][] {
  const pts: [number, number][] = [[xa, floorY(la)]];
  if (lb > la) {
    for (let l = la; l < lb; l++) pts.push([topX(l), floorY(l)], [botX(l), floorY(l + 1)]);
  } else if (lb < la) {
    for (let l = la; l > lb; l--) pts.push([botX(l - 1), floorY(l)], [topX(l - 1), floorY(l - 1)]);
  }
  pts.push([xb, floorY(lb)]);
  return pts;
}

type Cmd =
  | { go: [number, number] }
  | { wait: number; pose?: Pose; lift?: number }
  | { deed: NpcDeed }
  | { appear: [number, number] }
  | { vanish: number };

type Seg =
  | { t0: number; t1: number; kind: "walk"; pts: [number, number][]; lens: number[]; len: number }
  | { t0: number; t1: number; kind: "wait"; x: number; y: number; pose: Pose; lift: number }
  | { t0: number; t1: number; kind: "gone" };

type Plan = { id: NpcId; speed: number; phase: number; segs: Seg[]; deeds: { t: number; deed: NpcDeed }[]; period: number };

function plan(id: NpcId, speed: number, phase: number, start: [number, number], cmds: Cmd[]): Plan {
  const segs: Seg[] = [];
  const deeds: { t: number; deed: NpcDeed }[] = [];
  let t = 0;
  let [l, x] = start;
  for (const c of cmds) {
    if ("go" in c) {
      const pts = route(l, x, c.go[0], c.go[1]);
      const lens = [0];
      for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const len = lens[lens.length - 1];
      const d = (len / speed) * 1000;
      segs.push({ t0: t, t1: t + d, kind: "walk", pts, lens, len });
      t += d;
      [l, x] = c.go;
    } else if ("wait" in c) {
      segs.push({ t0: t, t1: t + c.wait, kind: "wait", x, y: floorY(l), pose: c.pose ?? "stand", lift: c.lift ?? 0 });
      t += c.wait;
    } else if ("deed" in c) {
      deeds.push({ t, deed: c.deed });
    } else if ("appear" in c) {
      [l, x] = c.appear;
    } else {
      segs.push({ t0: t, t1: t + c.vanish, kind: "gone" });
      t += c.vanish;
    }
  }
  return { id, speed, phase, segs, deeds, period: t };
}

const S = 1000;
const PLANS: Plan[] = [
  // The man from 4. Sleeps on his mattress, gets up for the fridge, wanders down to leave a plate
  // in a kitchen that isn't his, watches somebody else's telly, uses the loo in the lobby (the
  // last sheet, as always), and goes back to bed.
  plan("man", 70, 0, [2, 535], [
    { wait: 60 * S, pose: "sleep" },
    { go: [2, 660] },
    { deed: "fridge" },
    { wait: 7 * S, pose: "look" },
    { go: [3, 476] },
    { deed: "dish" },
    { wait: 3 * S, pose: "stand" },
    { go: [4, 520] },
    { wait: 8 * S, pose: "look" },
    { go: [LOBBY, 300] },
    { deed: "mat" },
    { go: [LOBBY, 716] },
    { wait: 6 * S, pose: "stand" },
    { deed: "loo" },
    { go: [2, 535] },
  ]),
  // The courier: in through the front door with the weather on his boots, over the mat and the
  // shoes, a menu in the wrong box, and out.
  plan("courier", 95, 41 * S, [LOBBY, 290], [
    { vanish: 150 * S },
    { appear: [LOBBY, 290] },
    { deed: "mat" },
    { deed: "mud" },
    { deed: "shoes" },
    { go: [LOBBY, 598] },
    { wait: 4 * S, pose: "post" },
    { deed: "mail" },
    { go: [LOBBY, 290] },
  ]),
];

export type NpcView = { id: NpcId; x: number; y: number; dir: number; pose: Pose; lift: number };

// The cat goes where it likes. Its wanderings are made up afresh every couple of minutes, from
// the clock, so every page dreams up the same cat.
const CAT_BLOCK = 120 * S;
const CAT_SPEED = 250;
type CatSpot = { l: number; x: number; lift: number; pose: Pose; rest: [number, number]; deeds: NpcDeed[] };
const CAT_SPOTS: CatSpot[] = [
  { l: BASEMENT, x: 686, lift: 96, pose: "sleep", rest: [6, 14], deeds: ["hair"] }, // the warm washing machine
  { l: 1, x: 512, lift: 70, pose: "swat", rest: [2, 3], deeds: ["frame"] }, // the back of the sofa, under the picture
  { l: 1, x: 566, lift: 46, pose: "sleep", rest: [5, 12], deeds: ["hair"] }, // the sofa itself
  { l: ROOF, x: 650, lift: 0, pose: "sit", rest: [3, 8], deeds: [] }, // by the tank
  { l: ROOF, x: 330, lift: 0, pose: "sit", rest: [2, 5], deeds: [] }, // under the socks
  { l: 3, x: 606, lift: 104, pose: "sit", rest: [2, 6], deeds: [] }, // the kitchen counter, obviously
  { l: 4, x: 330, lift: 76, pose: "sit", rest: [2, 4], deeds: ["remoteTake"] }, // the desk, by the remote
  { l: 2, x: 540, lift: 22, pose: "sleep", rest: [4, 10], deeds: ["hair"] }, // the man's mattress
  { l: LOBBY, x: 590, lift: 40, pose: "sit", rest: [2, 5], deeds: [] }, // the bench
  { l: 4, x: 690, lift: 0, pose: "sit", rest: [1, 3], deeds: [] }, // the plant
  { l: LOBBY, x: 470, lift: 0, pose: "sit", rest: [1, 3], deeds: [] },
  { l: 2, x: 300, lift: 0, pose: "sit", rest: [1, 3], deeds: [] },
];

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const routeLen = (la: number, xa: number, lb: number, xb: number) => {
  const pts = route(la, xa, lb, xb);
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return d;
};
/** Where the cat ends up at the end of block n (and so starts block n+1). */
const catEnd = (n: number) => Math.floor(mulberry(n * 7919 + 17)() * CAT_SPOTS.length);

const catCache = new Map<number, Plan>();
/** The cat's plan for the two minutes starting at n × CAT_BLOCK. */
function catPlan(n: number): Plan {
  const hit = catCache.get(n);
  if (hit) return hit;
  const r = mulberry(n * 104729 + 3);
  const start = CAT_SPOTS[catEnd(n - 1)];
  const end = CAT_SPOTS[catEnd(n)];
  const cmds: Cmd[] = [];
  let t = 0;
  let at = start;
  const time = (a: CatSpot, b: CatSpot) => (routeLen(a.l, a.x, b.l, b.x) / CAT_SPEED) * 1000;
  // a bit more of wherever it woke up
  const first = (1 + r() * 3) * S;
  cmds.push({ wait: first, pose: start.pose, lift: start.lift });
  t += first;
  for (let k = 0; k < 40; k++) {
    // now and then a mad dash up and down the floor it's on, for no reason
    if (r() < 0.3) {
      const xa = 160 + r() * 560;
      const xb = 160 + r() * 560;
      const d = ((Math.abs(at.x - xa) + Math.abs(xa - xb) + Math.abs(xb - at.x)) / CAT_SPEED) * 1000;
      if (t + d + time(at, end) + 2 * S < CAT_BLOCK) {
        cmds.push({ go: [at.l, xa] }, { go: [at.l, xb] }, { go: [at.l, at.x] });
        t += d;
      }
    }
    const next = CAT_SPOTS[Math.floor(r() * CAT_SPOTS.length)];
    if (next === at) continue;
    const rest = (next.rest[0] + r() * (next.rest[1] - next.rest[0])) * S;
    const go = time(at, next);
    if (t + go + rest + time(next, end) + 2 * S > CAT_BLOCK) break;
    cmds.push({ go: [next.l, next.x] });
    // wherever it lands, it drops the remote if it has it
    cmds.push({ deed: "remoteDrop" });
    for (const d of next.deeds) cmds.push({ deed: d });
    cmds.push({ wait: rest, pose: next.pose, lift: next.lift });
    t += go + rest;
    at = next;
  }
  if (at !== end) {
    cmds.push({ go: [end.l, end.x] });
    cmds.push({ deed: "remoteDrop" });
    for (const d of end.deeds) cmds.push({ deed: d });
  }
  const p = plan("cat", CAT_SPEED, 0, [start.l, start.x], cmds);
  // whatever's left of the two minutes, it spends where it ended up
  p.segs.push({ t0: p.period, t1: CAT_BLOCK, kind: "wait", x: end.x, y: floorY(end.l), pose: end.pose, lift: end.lift });
  p.period = CAT_BLOCK;
  if (catCache.size > 6) catCache.delete(catCache.keys().next().value as number);
  catCache.set(n, p);
  return p;
}

/** Where everybody who lives here is at time t (ms since 1970, room time). */
export function residents(t: number): NpcView[] {
  const out: NpcView[] = [];
  const n = Math.floor(t / CAT_BLOCK);
  for (const p of [...PLANS, catPlan(n)]) {
    const c = p.id === "cat" ? t - n * CAT_BLOCK : (((t + p.phase) % p.period) + p.period) % p.period;
    const seg = p.segs.find((s) => c >= s.t0 && c < s.t1);
    if (!seg || seg.kind === "gone") continue;
    if (seg.kind === "wait") {
      out.push({ id: p.id, x: seg.x, y: seg.y, dir: 1, pose: seg.pose, lift: seg.lift });
      continue;
    }
    const d = ((c - seg.t0) / (seg.t1 - seg.t0)) * seg.len;
    let i = 1;
    while (i < seg.pts.length - 1 && seg.lens[i] < d) i++;
    const [x0, y0] = seg.pts[i - 1];
    const [x1, y1] = seg.pts[i];
    const k = seg.lens[i] - seg.lens[i - 1] || 1;
    const f = (d - seg.lens[i - 1]) / k;
    out.push({ id: p.id, x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, dir: x1 >= x0 ? 1 : -1, pose: "walk", lift: 0 });
  }
  return out;
}

/** What the residents did between two moments (from, to], oldest first. */
export function deeds(from: number, to: number): { t: number; who: NpcId; deed: NpcDeed }[] {
  const out: { t: number; who: NpcId; deed: NpcDeed }[] = [];
  if (to <= from) return out;
  for (let n = Math.floor(from / CAT_BLOCK); n <= Math.floor(to / CAT_BLOCK); n++)
    for (const d of catPlan(n).deeds) {
      const t = n * CAT_BLOCK + d.t;
      if (t > from && t <= to) out.push({ t, who: "cat", deed: d.deed });
    }
  for (const p of PLANS)
    for (const d of p.deeds) {
      // times t with (t + phase) mod period == d.t
      let k = Math.floor((from + p.phase - d.t) / p.period) + 1;
      for (let t = k * p.period + d.t - p.phase; t <= to; k++, t = k * p.period + d.t - p.phase) if (t > from) out.push({ t, who: p.id, deed: d.deed });
    }
  return out.sort((a, b) => a.t - b.t);
}

export const NPC_LINES: Record<NpcDeed, string> = {
  fridge: "The man from 4 opened the fridge. Again.",
  dish: "He left a plate. He doesn't live on 3.",
  mat: "Somebody stepped on the mat.",
  shoes: "The courier kicked his shoes off. Everywhere.",
  mail: "More pizza menus in 4B.",
  frame: "The cat knocked the picture.",
  remoteTake: "The cat has the remote.",
  remoteDrop: "The cat left the remote on the sofa.",
  hair: "The cat moulted a bit.",
  mud: "The courier didn't wipe his feet.",
  loo: "He used the last sheet. Of course he did.",
};
/** The floor each deed happens on, for whether you'd see it (-1: wherever the cat is). */
export const DEED_LEVEL: Record<NpcDeed, number> = {
  fridge: 2, dish: 3, mat: LOBBY, shoes: LOBBY, mail: LOBBY, frame: 1,
  remoteTake: -1, remoteDrop: -1, hair: -1, mud: LOBBY, loo: LOBBY,
};
