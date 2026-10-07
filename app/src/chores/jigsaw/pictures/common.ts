// What every picture is made with: a few flat drawing helpers, a stock person, and the Scene shape.
// Pictures are drawn in world units, 0..BW across and 0..BH down (1344 x 864), the same every time.
import { BW, BH, rng } from "../puzzle";

export { BW, BH, rng };

export type Ctx = CanvasRenderingContext2D;

/** A named bit of the picture, for "Someone put in a bit of {name}." Later boxes sit on top. */
export type Box = { x: number; y: number; w: number; h: number; name: string };

export type Scene = {
  /** Printed on the note by the board, e.g. "The High Street". */
  title: string;
  /** Draws the whole picture into ctx, in world units. Deterministic. */
  draw: (ctx: Ctx) => void;
  /** Names for the bits of the picture, in drawing order (later ones win). The first should cover everything. */
  labels: Box[];
  /** Five or so spots (world units) that a puzzle starts with done around them: things you'd recognise. */
  landmarks: { x: number; y: number }[];
};

export function labelIn(labels: Box[], x: number, y: number): string {
  for (let k = labels.length - 1; k >= 0; k--) {
    const b = labels[k];
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b.name;
  }
  return "the picture";
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}
export function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}
export function poly(ctx: Ctx, pts: number[], fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}
export function line(ctx: Ctx, pts: number[], stroke: string, w: number) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}
/** Centred text. Fonts the site loads: "Work Sans", "Libre Caslon Text", "Courier Prime". */
export function text(ctx: Ctx, s: string, x: number, y: number, size: number, fill: string, font = "Work Sans", weight = 600) {
  ctx.fillStyle = fill;
  ctx.font = `${weight} ${size}px "${font}", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

export const SKIN = ["#EAC6A4", "#C98F68", "#8A5A3C", "#F0D2B6", "#B57C58"];

export type PersonOpts = {
  coat: string;
  legs: string;
  skin: string;
  hair: string;
  /** Height in world units, default 112. */
  h?: number;
  /** Where the feet are, default 760. */
  feet?: number;
  arm?: "up" | "phone" | "lead" | "bags" | "stick";
  hat?: string;
};

/** A person standing, seen from the front, feet at (x, feet). */
export function person(ctx: Ctx, x: number, o: PersonOpts) {
  const h = o.h ?? 112;
  const FEET = o.feet ?? 760;
  const top = FEET - h;
  const head = h * 0.13;
  rect(ctx, x - 9, FEET - h * 0.45, 7, h * 0.45 - 4, o.legs);
  rect(ctx, x + 2, FEET - h * 0.45, 7, h * 0.45 - 4, o.legs);
  ell(ctx, x - 6, FEET - 3, 7, 4, "#2A2927");
  ell(ctx, x + 6, FEET - 3, 7, 4, "#2A2927");
  ctx.fillStyle = o.coat;
  ctx.beginPath();
  ctx.moveTo(x - 12, top + head * 2.1);
  ctx.quadraticCurveTo(x, top + head * 1.8, x + 12, top + head * 2.1);
  ctx.lineTo(x + 14, FEET - h * 0.4);
  ctx.lineTo(x - 14, FEET - h * 0.4);
  ctx.closePath();
  ctx.fill();
  const sh = top + head * 2.3;
  if (o.arm === "up") line(ctx, [x + 11, sh, x + 22, sh - 22, x + 20, sh - 40], o.coat, 6);
  else if (o.arm === "phone") line(ctx, [x + 11, sh, x + 16, sh + 16, x + 7, sh - 8], o.coat, 6);
  else line(ctx, [x + 12, sh, x + 16, sh + 36], o.coat, 6);
  line(ctx, [x - 12, sh, x - 16, sh + 36], o.coat, 6);
  if (o.arm === "phone") rect(ctx, x + 4, sh - 18, 5, 10, "#2A2927");
  ell(ctx, x, top + head, head * 0.85, head, o.skin);
  ctx.fillStyle = o.hair;
  ctx.beginPath();
  ctx.ellipse(x, top + head * 0.75, head * 0.9, head * 0.72, 0, Math.PI, 0);
  ctx.fill();
  if (o.hat) {
    rect(ctx, x - head, top + head * 0.2, head * 2, head * 0.5, o.hat);
    rect(ctx, x - head * 1.25, top + head * 0.6, head * 2.5, head * 0.18, o.hat);
  }
}

/** A faint paper grain over the finished print. Call last. */
export function grain(ctx: Ctx, rand: () => number) {
  for (let k = 0; k < 9000; k++) rect(ctx, rand() * BW, rand() * BH, 1.4, 1.4, k % 2 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.035)");
}
