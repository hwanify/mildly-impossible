// The worldwide tally behind "Top 18% worldwide": for each game, how many goes ended on each score.
// Kept as a histogram (game, bucket, n), so a lookup reads a few hundred rows at most however many
// people play. Anyone can post a score; values are clamped to the game's range.
import type { D1Database } from "@cloudflare/workers-types";
import { SCORE_GAMES } from "./scoreGames";

export type Standing = { top: number; rank: number; total: number };

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });

export async function scoreApi(request: Request, db: D1Database | undefined): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/api/score") return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "no" }, 405);
  if (!db) return json({ error: "no database" }, 503);
  let body: { game?: unknown; value?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "bad body" }, 400);
  }
  const g = typeof body.game === "string" ? SCORE_GAMES[body.game] : undefined;
  const value = Number(body.value);
  if (!g || !Number.isFinite(value)) return json({ error: "no such game" }, 400);
  const bucket = Math.round(Math.min(g.max, Math.max(g.min, value)) * g.step);
  const game = body.game as string;
  await db
    .prepare("INSERT INTO score_tally (game, bucket, n) VALUES (?, ?, 1) ON CONFLICT (game, bucket) DO UPDATE SET n = n + 1")
    .bind(game, bucket)
    .run();
  const cmp = g.better === "high" ? ">" : "<";
  const r = await db
    .prepare(`SELECT COALESCE(SUM(n), 0) AS total, COALESCE(SUM(CASE WHEN bucket ${cmp} ? THEN n ELSE 0 END), 0) AS ahead FROM score_tally WHERE game = ?`)
    .bind(bucket, game)
    .first<{ total: number; ahead: number }>();
  const total = r?.total ?? 1;
  const rank = (r?.ahead ?? 0) + 1;
  return json({ top: Math.max(1, Math.ceil((100 * rank) / total)), rank, total } satisfies Standing);
}
