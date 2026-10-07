// The puzzle as rules: the grid, how it was cut (every edge's tab), which holes a piece would
// physically go into, and which piece comes out of the box next. Pure: no window, no document,
// so a server can hand pieces out by the same rules later.

export const COLS = 28;
export const ROWS = 18;
export const COUNT = COLS * ROWS;
/** One piece, in world units. The board is BW x BH. */
export const P = 48;
export const BW = COLS * P;
export const BH = ROWS * P;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One cut between two pieces. s: which way the tab sticks out. k: its shape (0-5), from two tab
 *  sizes times three positions along the edge. c, d: a little wobble that only changes the look. */
export type Edge = { s: 1 | -1; k: number; c: number; d: number };
export const TAB = [0.095, 0.112];
export const SHIFT = [-0.055, 0, 0.055];

/** h: the edge along the top of cell (c, r) is h[r * COLS + c], rows 0..ROWS (0 and ROWS are the frame, null).
 *  v: the edge along the left of cell (c, r) is v[r * (COLS + 1) + c], columns 0..COLS (0 and COLS are the frame). */
export type Cut = { h: (Edge | null)[]; v: (Edge | null)[] };

export function makeCut(seed: number): Cut {
  const rand = rng(seed);
  const edge = (): Edge => ({ s: rand() < 0.5 ? 1 : -1, k: Math.floor(rand() * 6), c: (rand() - 0.5) * 0.05, d: (rand() - 0.5) * 0.05 });
  const h: (Edge | null)[] = [];
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c < COLS; c++) h.push(r === 0 || r === ROWS ? null : edge());
  const v: (Edge | null)[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS; c++) v.push(c === 0 || c === COLS ? null : edge());
  return { h, v };
}

/** Side p of a piece (0 top, 1 right, 2 bottom, 3 left): the edge, whether the piece walks it the
 *  other way round (going clockwise), and which way is out. */
export function sideEdge(cut: Cut, i: number, p: number): { e: Edge | null; rev: boolean; out: 1 | -1 } {
  const c = i % COLS;
  const r = (i / COLS) | 0;
  if (p === 0) return { e: cut.h[r * COLS + c], rev: false, out: -1 };
  if (p === 1) return { e: cut.v[r * (COLS + 1) + c + 1], rev: false, out: 1 };
  if (p === 2) return { e: cut.h[(r + 1) * COLS + c], rev: true, out: 1 };
  return { e: cut.v[r * (COLS + 1) + c], rev: true, out: -1 };
}

/** What side p looks like, walking round the piece clockwise: "f" for flat, else tab in or out,
 *  its size and where it sits. Two sides that read the same are the same shape. */
export function sideShape(cut: Cut, i: number, p: number): string {
  const { e, rev, out } = sideEdge(cut, i, p);
  if (!e) return "f";
  const shift = Math.floor(e.k / 2);
  return `${out * e.s > 0 ? "o" : "i"}${e.k % 2}${rev ? 2 - shift : shift}`;
}

/** The cell across side p, or -1 at the frame. */
export function across(i: number, p: number): number {
  const c = i % COLS;
  const r = (i / COLS) | 0;
  if (p === 0) return r > 0 ? i - COLS : -1;
  if (p === 1) return c < COLS - 1 ? i + 1 : -1;
  if (p === 2) return r < ROWS - 1 ? i + COLS : -1;
  return c > 0 ? i - 1 : -1;
}

export function placedAround(placed: Uint8Array, i: number): number {
  let n = 0;
  for (let p = 0; p < 4; p++) {
    const j = across(i, p);
    if (j >= 0 && placed[j]) n++;
  }
  return n;
}

/** Would `piece`, turned `rot` quarter turns clockwise, physically go into `hole`? Only the sides
 *  that already have a piece (or the frame) next to them count. A flat side never goes inside. */
export function fitsHole(cut: Cut, placed: Uint8Array, piece: number, rot: number, hole: number): boolean {
  for (let p = 0; p < 4; p++) {
    const have = sideShape(cut, piece, (p - rot + 8) % 4);
    const want = sideShape(cut, hole, p);
    const j = across(hole, p);
    if (j < 0 || placed[j]) {
      if (have !== want) return false;
    } else if (have === "f") return false;
  }
  return true;
}

/** The next piece out of the box: always one that goes next to a bit that's already done, more
 *  likely the more of its sides are done, so the holes left are never too hard. -1 when empty. */
export function pickPiece(placed: Uint8Array, rand: () => number, skip = -1): number {
  const cand: number[] = [];
  const weight: number[] = [];
  let total = 0;
  let loose = -1;
  for (let i = 0; i < COUNT; i++) {
    if (placed[i] || i === skip) continue;
    loose = i;
    const n = placedAround(placed, i);
    if (!n) continue;
    cand.push(i);
    weight.push(n * n);
    total += n * n;
  }
  if (!cand.length) return loose;
  let x = rand() * total;
  for (let k = 0; k < cand.length; k++) {
    x -= weight[k];
    if (x <= 0) return cand[k];
  }
  return cand[cand.length - 1];
}

/** How many separate bits of the picture are on the board. */
export function islands(placed: Uint8Array): number {
  const seen = new Uint8Array(COUNT);
  let n = 0;
  const stack: number[] = [];
  for (let i = 0; i < COUNT; i++) {
    if (!placed[i] || seen[i]) continue;
    n++;
    seen[i] = 1;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop()!;
      for (let p = 0; p < 4; p++) {
        const k = across(j, p);
        if (k >= 0 && placed[k] && !seen[k]) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
  }
  return n;
}

export function count(placed: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < COUNT; i++) n += placed[i];
  return n;
}

/** A board as it is handed over: a few 3x3 bits done around the given spots (world coordinates),
 *  then `grow` more pieces put in the way people would put them in. */
export function startBoard(spots: { x: number; y: number }[], grow: number, seed: number): Uint8Array {
  const placed = new Uint8Array(COUNT);
  for (const s of spots) {
    const c0 = Math.min(COLS - 2, Math.max(1, Math.floor(s.x / P)));
    const r0 = Math.min(ROWS - 2, Math.max(1, Math.floor(s.y / P)));
    for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) placed[r * COLS + c] = 1;
  }
  const rand = rng(seed);
  for (let k = 0; k < grow; k++) {
    const i = pickPiece(placed, rand);
    if (i < 0) break;
    placed[i] = 1;
  }
  return placed;
}

/** The board as a short string (one bit a piece), for sending over the wire. */
export function pack(placed: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(COUNT / 8));
  for (let i = 0; i < COUNT; i++) if (placed[i]) bytes[i >> 3] |= 1 << (i & 7);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function unpack(s: string): Uint8Array {
  const placed = new Uint8Array(COUNT);
  const raw = atob(s);
  for (let i = 0; i < COUNT; i++) if ((raw.charCodeAt(i >> 3) >> (i & 7)) & 1) placed[i] = 1;
  return placed;
}
