// Which games keep a score, which way is better, and how finely the worldwide tally counts it.
// Shared by the receipts (lib/records.ts, components/ResultBest.tsx) and the server (lib/scores.ts).
export type Better = "high" | "low";
export type ScoreGame = { better: Better; min: number; max: number; /** tally buckets per unit */ step: number };

export const SCORE_GAMES: Record<string, ScoreGame> = {
  mug: { better: "high", min: 0, max: 100, step: 1 },
  "fitted-sheet": { better: "high", min: 0, max: 100, step: 1 },
  pizza: { better: "low", min: 1, max: 100, step: 100 },
  clementine: { better: "low", min: 1, max: 999, step: 1 },
  "price-sticker": { better: "high", min: 0, max: 100, step: 1 },
  "balance-scale": { better: "low", min: 1, max: 999, step: 1 },
  building: { better: "high", min: 0, max: 9999, step: 1 },
};

export const isBetter = (better: Better, a: number, b: number) => (better === "high" ? a > b : a < b);
