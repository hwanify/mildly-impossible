export type TapeResult = { time: number; tears: number; slips: number; lost: number; light: boolean; scissors: boolean };

export function tapeTier(r: TapeResult) {
  if (r.scissors) return { tier: "Scissors", line: "Technically a solution. The roll will remember this." };
  if (r.tears === 0 && r.lost === 0 && r.time < 45000 && !r.light) return { tier: "Warehouse veteran", line: "Thumbnail of steel. Movers fear you." };
  if (r.tears === 0 && r.lost === 0) return { tier: "Clean pull", line: "One piece, full width. Rarer than it should be." };
  if (r.lost <= 2) return { tier: "Got there eventually", line: "A thin sliver of tape now lives somewhere on that roll forever." };
  return { tier: "Tape archaeologist", line: "You have uncovered several layers of history." };
}
