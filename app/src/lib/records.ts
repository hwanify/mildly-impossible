// What you've done on this device: per game, your best (as a number and as printed on the receipt),
// how many goes, and where your best stood worldwide. Lives in localStorage; never leaves the browser.
import { isBetter, type Better } from "./scoreGames";

export type Rec = { best: number; text: string; plays: number; top?: number };
const KEY = "mi-records";

export function readRecords(): Record<string, Rec> {
  try {
    const r = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, Rec>;
    return r && typeof r === "object" ? r : {};
  } catch {
    return {};
  }
}

function write(all: Record<string, Rec>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private window: it just won't be remembered */
  }
}

/** Notes down one go. Returns your previous record (null on a first go) and whether this beat it. */
export function noteResult(slug: string, value: number, text: string, better: Better): { prev: Rec | null; isBest: boolean } {
  const all = readRecords();
  const prev = all[slug] ?? null;
  const isBest = !prev || isBetter(better, value, prev.best);
  all[slug] = isBest ? { best: value, text, plays: (prev?.plays ?? 0) + 1 } : { ...prev, plays: prev.plays + 1 };
  write(all);
  return { prev, isBest };
}

/** Where your best stands worldwide, once the tally has answered. */
export function noteTop(slug: string, top: number) {
  const all = readRecords();
  if (!all[slug]) return;
  all[slug].top = top;
  write(all);
}

/** For games without a score: counts things done, e.g. jigsaw pieces put in. */
export function noteCount(slug: string, one: string, many: string) {
  const all = readRecords();
  const n = (all[slug]?.best ?? 0) + 1;
  all[slug] = { best: n, text: `${n} ${n === 1 ? one : many}`, plays: (all[slug]?.plays ?? 0) + 1 };
  write(all);
}
