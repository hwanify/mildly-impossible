import { useEffect, useRef, useState } from "react";
import { noteResult, noteTop } from "../lib/records";
import { SCORE_GAMES } from "../lib/scoreGames";
import type { Standing } from "../lib/scores";

// The bit of a receipt that remembers you: your best on this device, and where this go stands
// against everyone's. Notes the go down once, when the receipt is printed.
const API_HOST = "https://impossible-chores.higgsfield.app";

async function postScore(game: string, value: number): Promise<Standing> {
  const body = JSON.stringify({ game, value });
  const go = async (base: string) => {
    const res = await fetch(base + "/api/score", { method: "POST", headers: { "content-type": "application/json" }, body });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) throw new Error(String(res.status));
    return (await res.json()) as Standing;
  };
  const host = window.location.hostname;
  // a local test server (localhost only), else this host, else the site's own host (custom domains)
  const q = new URLSearchParams(window.location.search).get("api");
  if (q && (host === "localhost" || host === "127.0.0.1")) return go(q);
  try {
    return await go("");
  } catch (e) {
    if (host.endsWith(".higgsfield.app") || host === "localhost") throw e;
    return go(API_HOST);
  }
}

export function ResultBest({ game, value, text }: { game: string; value: number; text: string }) {
  const done = useRef(false);
  const [mine, setMine] = useState<{ prevText: string | null; isBest: boolean } | null>(null);
  const [world, setWorld] = useState<Standing | null>(null);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const g = SCORE_GAMES[game];
    if (!g) return;
    const { prev, isBest } = noteResult(game, value, text, g.better);
    setMine({ prevText: prev?.text ?? null, isBest });
    postScore(game, value)
      .then((s) => {
        setWorld(s);
        if (isBest) noteTop(game, s.top);
      })
      .catch(() => {
        /* no tally today */
      });
  }, [game, value, text]);

  if (!mine) return null;
  return (
    <div className="result-best">
      <div>{mine.prevText === null ? "First go. Your best, for now." : mine.isBest ? "New personal best. Nobody will ask." : `Your best: ${mine.prevText}`}</div>
      {world && <div>{world.total < 20 ? `${ordinal(world.rank)} of ${world.total} so far, worldwide.` : `Top ${world.top}% worldwide.`}</div>}
    </div>
  );
}

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}
