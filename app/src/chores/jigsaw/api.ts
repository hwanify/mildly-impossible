// The one shared jigsaw, on the server. Everyone's board is the puzzle's starting bits plus every
// piece anyone has put in. Each visitor holds one piece at a time (handed out here, so two people
// never get the same one). When the last piece goes in, the next puzzle starts five minutes later.
// The store is D1 on the site; a memory one stands in for local testing.
import type { D1Database } from "@cloudflare/workers-types";
import { COUNT, count, pack, pickPiece, startBoard } from "./puzzle";
import { sceneFor } from "./pictures";

export const REST_MS = 5 * 60 * 1000;
const HOLD_MS = 15 * 60 * 1000;

export type Board = { no: number; doneAt: number | null; board: string; now: number };
export type Deal = Board & { cell: number };
export type Placed = Board & { ok: boolean; finished: boolean };

export interface Store {
  state(): Promise<{ no: number; doneAt: number | null }>;
  /** Moves on to puzzle `no + 1` if it is still `no`. */
  advance(no: number): Promise<void>;
  finish(no: number, at: number): Promise<void>;
  pieces(no: number): Promise<number[]>;
  /** Puts a piece in; false if it was already in. */
  put(no: number, cell: number, at: number): Promise<boolean>;
  /** Pieces other people are holding right now. */
  held(no: number, now: number, except: string): Promise<number[]>;
  hold(who: string, no: number, cell: number, until: number): Promise<void>;
  drop(who: string): Promise<void>;
}

const starts = new Map<number, Uint8Array>();
function start(no: number) {
  let b = starts.get(no);
  if (!b) {
    b = startBoard(sceneFor(no).landmarks, 75, no);
    starts.set(no, b);
  }
  return b;
}

async function board(store: Store, no: number) {
  const placed = start(no).slice();
  for (const i of await store.pieces(no)) if (i >= 0 && i < COUNT) placed[i] = 1;
  return placed;
}

/** The current puzzle, moving on to the next one first if the finished one has rested long enough. */
async function current(store: Store, now: number) {
  let s = await store.state();
  if (s.doneAt !== null && now >= s.doneAt + REST_MS) {
    await store.advance(s.no);
    s = await store.state();
  }
  return s;
}

// open to other origins: a custom domain may have to reach the API on the higgsfield.app host
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });

const okWho = (w: unknown): w is string => typeof w === "string" && /^[a-z0-9]{8,40}$/.test(w);

/** Handles /api/jigsaw, /api/jigsaw/deal and /api/jigsaw/place; anything else returns null. */
export async function jigsawApi(request: Request, store: Store): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/jigsaw")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const now = Date.now();
  const s = await current(store, now);
  const out = async (): Promise<Board> => ({ no: s.no, doneAt: s.doneAt, board: pack(await board(store, s.no)), now });

  if (url.pathname === "/api/jigsaw" && request.method === "GET") return json(await out());

  if (request.method !== "POST") return json({ error: "no" }, 405);
  let body: { who?: unknown; no?: unknown; cell?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad body" }, 400);
  }
  if (!okWho(body.who)) return json({ error: "who?" }, 400);
  const who = body.who;

  if (url.pathname === "/api/jigsaw/deal") {
    const placed = await board(store, s.no);
    if (count(placed) === COUNT) return json({ ...(await out()), cell: -1 } satisfies Deal);
    // skip pieces other people are holding, unless that's all there is left
    const taken = placed.slice();
    for (const i of await store.held(s.no, now, who)) taken[i] = 1;
    let cell = pickPiece(taken, Math.random);
    if (cell < 0 || taken[cell]) cell = pickPiece(placed, Math.random);
    await store.hold(who, s.no, cell, now + HOLD_MS);
    return json({ no: s.no, doneAt: s.doneAt, board: pack(placed), now, cell } satisfies Deal);
  }

  if (url.pathname === "/api/jigsaw/place") {
    const cell = Number(body.cell);
    if (body.no !== s.no || !Number.isInteger(cell) || cell < 0 || cell >= COUNT) return json({ ...(await out()), ok: false, finished: false } satisfies Placed);
    const ok = !start(s.no)[cell] && (await store.put(s.no, cell, now));
    await store.drop(who);
    const placed = await board(store, s.no);
    const finished = ok && count(placed) === COUNT;
    if (finished) await store.finish(s.no, now);
    return json({ no: s.no, doneAt: finished ? now : s.doneAt, board: pack(placed), now, ok, finished } satisfies Placed);
  }
  return json({ error: "no" }, 404);
}

/** The site's store: three small tables (migrations/0002_jigsaw.sql). */
export function d1Store(db: D1Database): Store {
  return {
    async state() {
      await db.prepare("INSERT OR IGNORE INTO jigsaw_state (id, no, done_at) VALUES (1, 1, NULL)").run();
      const r = await db.prepare("SELECT no, done_at FROM jigsaw_state WHERE id = 1").first<{ no: number; done_at: number | null }>();
      return { no: r?.no ?? 1, doneAt: r?.done_at ?? null };
    },
    async advance(no) {
      await db.batch([
        db.prepare("UPDATE jigsaw_state SET no = no + 1, done_at = NULL WHERE id = 1 AND no = ?").bind(no),
        db.prepare("DELETE FROM jigsaw_holds WHERE no <= ?").bind(no),
      ]);
    },
    async finish(no, at) {
      await db.prepare("UPDATE jigsaw_state SET done_at = ? WHERE id = 1 AND no = ? AND done_at IS NULL").bind(at, no).run();
    },
    async pieces(no) {
      const r = await db.prepare("SELECT cell FROM jigsaw_pieces WHERE no = ?").bind(no).all<{ cell: number }>();
      return r.results.map((x) => x.cell);
    },
    async put(no, cell, at) {
      const r = await db.prepare("INSERT OR IGNORE INTO jigsaw_pieces (no, cell, placed_at) VALUES (?, ?, ?)").bind(no, cell, at).run();
      return (r.meta?.changes ?? 0) > 0;
    },
    async held(no, now, except) {
      const r = await db.prepare("SELECT cell FROM jigsaw_holds WHERE no = ? AND until > ? AND who != ?").bind(no, now, except).all<{ cell: number }>();
      return r.results.map((x) => x.cell);
    },
    async hold(who, no, cell, until) {
      await db.prepare("INSERT OR REPLACE INTO jigsaw_holds (who, no, cell, until) VALUES (?, ?, ?, ?)").bind(who, no, cell, until).run();
    },
    async drop(who) {
      await db.prepare("DELETE FROM jigsaw_holds WHERE who = ?").bind(who).run();
    },
  };
}

/** A store that forgets everything when the process stops. For local testing. */
export function memoryStore(): Store {
  const st = { no: 1, doneAt: null as number | null };
  const pieces = new Map<number, Set<number>>();
  const holds = new Map<string, { no: number; cell: number; until: number }>();
  const of = (no: number) => {
    let p = pieces.get(no);
    if (!p) pieces.set(no, (p = new Set()));
    return p;
  };
  return {
    async state() {
      return { ...st };
    },
    async advance(no) {
      if (st.no !== no) return;
      st.no++;
      st.doneAt = null;
      holds.clear();
    },
    async finish(no, at) {
      if (st.no === no && st.doneAt === null) st.doneAt = at;
    },
    async pieces(no) {
      return [...of(no)];
    },
    async put(no, cell) {
      const p = of(no);
      if (p.has(cell)) return false;
      p.add(cell);
      return true;
    },
    async held(no, now, except) {
      return [...holds].filter(([w, h]) => w !== except && h.no === no && h.until > now).map(([, h]) => h.cell);
    },
    async hold(who, no, cell, until) {
      holds.set(who, { no, cell, until });
    },
    async drop(who) {
      holds.delete(who);
    },
  };
}
