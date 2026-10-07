// The Beach: a busy seaside afternoon, pier and sea at the top, the sand full of towels, beach huts
// and the ice cream van along the front. Busy on purpose, so most pieces have something on them.
import { BW, BH, rng, rect, ell, poly, line, text, person, grain, SKIN, type Box, type Ctx, type PersonOpts, type Scene } from "./common";

const LABELS: Box[] = [];
const lab = (name: string, x: number, y: number, w: number, h: number) => LABELS.push({ x, y, w, h, name });

const HORIZON = 150;
const SHORE = 374;
const WALL = 700;
const PROM = 718;
const HUT_W = 92;
const HUT_X = (i: number) => 6 + i * 112;

const HUTS = [
  { wall: "#B4513A", door: "#F4F1EA", roof: "#5F6670", colour: "red" },
  { wall: "#E2D3AE", door: "#2D4C9A", roof: "#6E6560", colour: "cream" },
  { wall: "#91A8C0", door: "#F4F1EA", roof: "#5F6670", colour: "blue" },
  { wall: "#D8AA52", door: "#2F5D4A", roof: "#6E6560", colour: "yellow" },
  { wall: "#A3B79D", door: "#F4F1EA", roof: "#5F6670", colour: "green" },
  { wall: "#D8A6A0", door: "#5E4A72", roof: "#6E6560", colour: "pink" },
  { wall: "#3E6E8E", door: "#E3B556", roof: "#5F6670", colour: "navy" },
  { wall: "#F4F1EA", door: "#B03A2E", roof: "#6E6560", colour: "white" },
  { wall: "#6B4E7A", door: "#E2D3AE", roof: "#5F6670", colour: "purple" },
];

// Everything on the sand: [kind, x, y, variant]. Drawn back to front by y.
type Kind =
  | "towel" | "towel2" | "reader" | "sunburnt" | "umbrella" | "deckchair" | "sandcastle" | "bucket" | "ball" | "dog" | "sign"
  | "lifeguard" | "flag" | "kite" | "detector" | "paddler" | "windbreak" | "coolbox" | "picnic" | "gull" | "crab" | "radio"
  | "digger" | "frisbee" | "shells" | "buried";
const ITEMS: [Kind, number, number, number][] = [
  ["paddler", 70, 398, 0],
  ["crab", 150, 404, 0],
  ["sign", 214, 446, 0],
  ["dog", 268, 438, 0],
  ["ball", 340, 416, 0],
  ["shells", 690, 402, 0],
  ["detector", 420, 452, 0],
  ["sandcastle", 540, 432, 0],
  ["digger", 624, 440, 0],
  ["towel", 760, 432, 0],
  ["kite", 900, 468, 0],
  ["flag", 978, 430, 0],
  ["lifeguard", 1066, 470, 0],
  ["flag", 1170, 430, 1],
  ["paddler", 1260, 398, 1],
  ["towel", 64, 494, 1],
  ["umbrella", 170, 520, 0],
  ["deckchair", 260, 520, 0],
  ["deckchair", 318, 524, 1],
  ["towel2", 470, 506, 2],
  ["umbrella", 600, 520, 1],
  ["coolbox", 690, 500, 0],
  ["reader", 800, 510, 3],
  ["deckchair", 952, 526, 2],
  ["sunburnt", 1170, 510, 0],
  ["bucket", 1290, 486, 0],
  ["windbreak", 70, 590, 0],
  ["deckchair", 200, 588, 3],
  ["towel", 340, 572, 4],
  ["umbrella", 452, 596, 2],
  ["picnic", 572, 578, 0],
  ["frisbee", 700, 590, 0],
  ["frisbee", 1214, 470, 1],
  ["umbrella", 860, 600, 3],
  ["towel2", 950, 580, 5],
  ["deckchair", 1066, 596, 4],
  ["deckchair", 1124, 600, 5],
  ["radio", 1250, 570, 0],
  ["bucket", 34, 664, 1],
  ["towel", 140, 660, 6],
  ["umbrella", 260, 676, 4],
  ["towel2", 380, 656, 7],
  ["deckchair", 500, 676, 6],
  ["gull", 580, 664, 0],
  ["buried", 680, 662, 0],
  ["umbrella", 800, 684, 5],
  ["deckchair", 900, 676, 7],
  ["windbreak", 1000, 670, 1],
  ["towel", 1130, 664, 8],
  ["umbrella", 1258, 680, 0],
  ["ball", 1320, 640, 1],
];

const TOWELS = [
  ["#2D4C9A", "#F4F1EA"], ["#E3B556", "#B4513A"], ["#D8A6A0", "#F4F1EA"], ["#4F7A5A", "#E3B556"], ["#B03A2E", "#F4F1EA"],
  ["#91A8C0", "#2D4C9A"], ["#6B4E7A", "#E3B556"], ["#D98C5F", "#F4F1EA"], ["#3E6E8E", "#D8A6A0"],
];
const SUITS = ["#B03A2E", "#2D4C9A", "#E3B556", "#4F7A5A", "#6B4E7A", "#D98C5F", "#1C1C1A", "#D8A6A0", "#3E6E8E"];
const UMBRELLAS = [["#B03A2E", "#F4F1EA"], ["#2D4C9A", "#E3B556"], ["#4F7A5A", "#F4F1EA"], ["#D98C5F", "#F4F1EA"], ["#6B4E7A", "#E3B556"], ["#3E6E8E", "#F4F1EA"]];
const CHAIRS = ["#B03A2E", "#2D4C9A", "#4F7A5A", "#D8AA52", "#6B4E7A", "#B4513A", "#3E6E8E", "#D98C5F"];

const NAMES: Record<Kind, [string, number, number, number, number]> = {
  towel: ["a sunbather on a towel", -50, -22, 100, 44],
  towel2: ["the couple on the towels", -64, -26, 128, 52],
  reader: ["the woman reading on her towel", -52, -40, 104, 62],
  sunburnt: ["the sunburnt man", -60, -24, 120, 48],
  umbrella: ["a beach umbrella", -50, -84, 100, 92],
  deckchair: ["a deckchair", -28, -62, 56, 68],
  sandcastle: ["the sandcastle", -60, -64, 120, 84],
  bucket: ["the bucket and spade", -22, -36, 44, 44],
  ball: ["the beach ball", -14, -14, 28, 28],
  dog: ["the dog", -30, -28, 62, 40],
  sign: ["the NO DOGS sign", -34, -74, 68, 78],
  lifeguard: ["the empty lifeguard chair", -44, -132, 88, 140],
  flag: ["a red and yellow flag", -6, -84, 34, 88],
  kite: ["the boy with the kite", -18, -76, 36, 80],
  detector: ["the man with the metal detector", -36, -82, 72, 86],
  paddler: ["someone paddling", -18, -80, 36, 86],
  windbreak: ["the windbreak", -60, -40, 120, 46],
  coolbox: ["the cool box", -26, -26, 52, 34],
  picnic: ["the family picnic", -66, -46, 132, 70],
  gull: ["the gull with the chips", -30, -30, 60, 40],
  crab: ["the crab", -18, -12, 36, 24],
  radio: ["the radio", -40, -30, 80, 44],
  digger: ["the girl digging", -26, -50, 54, 56],
  frisbee: ["the frisbee players", -20, -82, 40, 86],
  shells: ["the shells", -24, -10, 48, 20],
  buried: ["the man buried in the sand", -50, -26, 100, 46],
};

// Names for everything, in the order things are drawn (later ones sit on top).
lab("the sand", 0, 0, BW, BH);
lab("the sky", 0, 0, BW, HORIZON);
lab("a cloud", 70, 26, 150, 52);
lab("a cloud", 520, 18, 160, 52);
lab("a cloud", 1000, 56, 150, 50);
lab("the gulls", 340, 80, 130, 40);
lab("the hot air balloon", 228, 14, 64, 104);
lab("the kite", 866, 36, 64, 110);
lab("the sea", 0, HORIZON, BW, SHORE - HORIZON);
lab("the ship on the horizon", 470, 120, 170, 36);
lab("a little sailing boat", 1000, 150, 50, 46);
lab("the sailing boat", 720, 160, 120, 108);
lab("the swimmers", 470, 290, 110, 40);
lab("the swimmers", 820, 330, 50, 26);
lab("the lilo", 610, 318, 80, 30);
lab("the paddle boarder", 880, 220, 60, 76);
lab("the rubber ring", 960, 318, 46, 30);
lab("the buoy", 1060, 226, 34, 44);
lab("the pedalo", 560, 210, 70, 44);
lab("the headland", 1110, 80, BW - 1110, SHORE - 80);
lab("the cottage on the cliff", 1196, 80, 90, 64);
lab("the rocks", 1110, 330, BW - 1110, 50);
lab("the pier", 0, 228, 440, 124);
lab("the amusements", 286, 166, 132, 104);
lab("the man fishing off the pier", 140, 200, 70, 120);
for (const [kind, x, y] of [...ITEMS].sort((a, b) => a[2] - b[2])) {
  const [name, dx, dy, w, h] = NAMES[kind];
  lab(name, x + dx, y + dy, w, h);
}
lab("the promenade", 0, WALL - 12, BW, BH - WALL + 12);
HUTS.forEach((h, i) => lab(`the ${h.colour} beach hut`, HUT_X(i), 704, HUT_W, BH - 704));
lab("the man with the cup of tea", 336, 770, 40, 94);
lab("the bike", 552, 800, 60, 60);
lab("the lamp post", 994, 600, 30, 264);
lab("the ice cream van", 1030, 708, 250, 150);
lab("the queue for ice cream", 1284, 740, BW - 1284, 124);

/** Places worth starting the puzzle from: things you'd find first on the lid. */
const LANDMARKS = [
  { x: 360, y: 220 }, // the amusements
  { x: 780, y: 220 }, // the sailing boat
  { x: 540, y: 410 }, // the sandcastle
  { x: 1150, y: 790 }, // the ice cream van
  { x: 200, y: 800 }, // the beach huts
];

function cloud(ctx: Ctx, x: number, y: number, s: number) {
  for (const [dx, dy, r] of [[0, 0, 22], [26, -10, 26], [54, 0, 22], [28, 6, 24], [-20, 6, 14], [76, 6, 12]])
    ell(ctx, x + dx * s, y + dy * s, r * s * 1.2, r * s * 0.75, "#F6F4EE");
}

function gullFlying(ctx: Ctx, x: number, y: number, s = 1) {
  line(ctx, [x - 8 * s, y - 4 * s, x - 3 * s, y - 5 * s, x, y, x + 3 * s, y - 5 * s, x + 8 * s, y - 4 * s], "#4A4945", 1.6);
}

function lying(ctx: Ctx, x: number, y: number, suit: string, skin: string, hair: string, flip = false) {
  const d = flip ? -1 : 1;
  rect(ctx, Math.min(x + d * 6, x + d * 36), y - 5, 30, 4, skin);
  rect(ctx, Math.min(x + d * 6, x + d * 36), y + 1, 30, 4, skin);
  ell(ctx, x - d * 6, y, 18, 8, skin);
  ell(ctx, x - d * 2, y, 11, 8, suit);
  if (suit !== "#1C1C1A" && suit !== "#2D4C9A") ell(ctx, x - d * 16, y, 7, 7.5, suit);
  ell(ctx, x - d * 32, y, 8, 7.5, skin);
  ell(ctx, x - d * 35, y, 6, 7.5, hair);
  line(ctx, [x - d * 22, y - 7, x - d * 8, y - 10, x + d * 2, y - 9], skin, 3.5);
}

function towelBase(ctx: Ctx, x: number, y: number, w: number, h: number, col: string, stripe: string) {
  ell(ctx, x + 4, y + 4, w / 2 + 2, h / 2, "rgba(120,90,50,.14)");
  rect(ctx, x - w / 2, y - h / 2, w, h, col);
  for (let k = 8; k < w; k += 16) rect(ctx, x - w / 2 + k, y - h / 2, 5, h, stripe);
  for (let k = 0; k < w; k += 4) rect(ctx, x - w / 2 + k, y + h / 2, 2, 3, stripe);
}

function umbrella(ctx: Ctx, x: number, y: number, a: string, b: string) {
  ell(ctx, x + 10, y + 2, 42, 9, "rgba(120,90,50,.18)");
  line(ctx, [x, y, x - 2, y - 70], "#6B5B48", 3);
  const top = y - 82;
  const segs = 8;
  for (let k = 0; k < segs; k++) {
    const x0 = x - 48 + (k * 96) / segs;
    const x1 = x0 + 96 / segs;
    const ya = top + 20 + Math.abs(k - 3.5) * 1.6;
    poly(ctx, [x - 2, top, x0, ya + 6, (x0 + x1) / 2, ya + 10, x1, ya + 6], k % 2 ? b : a);
  }
  ell(ctx, x - 2, top, 3, 3, a);
}

function deckchair(ctx: Ctx, x: number, y: number, col: string, sitter: number) {
  line(ctx, [x - 18, y, x + 12, y - 52], "#8A6440", 3);
  line(ctx, [x + 16, y, x + 2, y - 26], "#8A6440", 3);
  line(ctx, [x - 20, y - 22, x + 18, y - 22], "#8A6440", 3);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + 12, y - 54);
  ctx.quadraticCurveTo(x - 2, y - 24, x - 16, y - 18);
  ctx.lineTo(x - 10, y - 12);
  ctx.quadraticCurveTo(x + 6, y - 22, x + 22, y - 52);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.clip();
  for (let k = -30; k < 30; k += 8) rect(ctx, x + k, y - 60, 4, 60, "#F4F1EA");
  ctx.restore();
  if (sitter % 2 === 0) {
    const skin = SKIN[sitter % 5];
    ell(ctx, x + 6, y - 34, 9, 12, SUITS[(sitter + 3) % 9]);
    line(ctx, [x - 2, y - 24, x - 16, y - 22, x - 20, y - 6], skin, 5);
    ell(ctx, x + 12, y - 50, 7, 8, skin);
    ell(ctx, x + 13, y - 54, 8, 5, ["#6B4A2E", "#C9C2B4", "#1C1C1A", "#C9783E"][sitter % 4]);
    if (sitter === 0) {
      rect(ctx, x - 2, y - 46, 14, 3, "#F4F1EA");
      poly(ctx, [x, y - 46, x + 10, y - 46, x + 5, y - 52], "#F4F1EA");
    }
    if (sitter === 2) rect(ctx, x - 8, y - 36, 12, 10, "#E3B556");
  }
}

/** The stock person drawn smaller, scaled as a whole so they keep their proportions. */
function small(ctx: Ctx, x: number, feet: number, h: number, o: Omit<PersonOpts, "h" | "feet">) {
  ctx.save();
  ctx.translate(x, feet);
  ctx.scale(h / 112, h / 112);
  person(ctx, 0, { ...o, feet: 0 });
  ctx.restore();
}

function standing(ctx: Ctx, x: number, feet: number, suit: string, skin: string, hair: string, arm?: "up" | "phone", h = 72) {
  small(ctx, x, feet, h, { coat: suit, legs: skin, skin, hair, arm });
}

function drawItem(ctx: Ctx, kind: Kind, x: number, y: number, v: number, rand: () => number) {
  switch (kind) {
    case "towel": {
      const [c, s] = TOWELS[v % 9];
      towelBase(ctx, x, y, 92, 30, c, s);
      lying(ctx, x, y, SUITS[(v + 2) % 9], SKIN[v % 5], ["#6B4A2E", "#1C1C1A", "#E3B556", "#C9783E"][v % 4], v % 2 === 1);
      if (v % 3 === 0) {
        ell(ctx, x + 36, y - 20, 6, 4, "#1C1C1A");
        rect(ctx, x + 40, y - 22, 12, 4, "#1C1C1A");
      }
      break;
    }
    case "towel2": {
      const [c, s] = TOWELS[v % 9];
      const [c2, s2] = TOWELS[(v + 4) % 9];
      towelBase(ctx, x - 30, y, 64, 32, c, s);
      towelBase(ctx, x + 34, y + 4, 64, 32, c2, s2);
      lying(ctx, x - 26, y, SUITS[v % 9], SKIN[(v + 1) % 5], "#3A2A1E");
      lying(ctx, x + 38, y + 4, SUITS[(v + 3) % 9], SKIN[(v + 3) % 5], "#C9783E");
      rect(ctx, x - 64, y + 18, 10, 14, "#E3B556");
      break;
    }
    case "reader": {
      towelBase(ctx, x, y + 8, 96, 30, "#E3B556", "#2D4C9A");
      ell(ctx, x - 6, y - 10, 13, 18, "#B03A2E");
      line(ctx, [x - 2, y + 4, x + 30, y + 8, x + 40, y + 6], SKIN[3], 7);
      ell(ctx, x - 6, y - 32, 8, 9, SKIN[3]);
      ell(ctx, x - 7, y - 36, 10, 7, "#1C1C1A");
      rect(ctx, x + 2, y - 22, 18, 13, "#F4F1EA");
      rect(ctx, x + 10, y - 22, 1, 13, "#9C958A");
      rect(ctx, x + 2, y - 22, 18, 3, "#2D4C9A");
      ell(ctx, x - 6, y - 40, 15, 4, "#D8C08A");
      ell(ctx, x - 6, y - 43, 8, 5, "#D8C08A");
      break;
    }
    case "sunburnt": {
      towelBase(ctx, x, y, 110, 32, "#F4F1EA", "#3E6E8E");
      lying(ctx, x, y, "#2D4C9A", "#D9654A", "#9C958A");
      ell(ctx, x - 26, y - 1, 4, 3, "#F4F1EA");
      rect(ctx, x + 34, y - 26, 20, 12, "#F4F1EA");
      text(ctx, "SPF 4", x + 44, y - 20, 6, "#B03A2E", "Work Sans", 700);
      break;
    }
    case "umbrella": {
      const [a, b] = UMBRELLAS[v % 6];
      umbrella(ctx, x, y, a, b);
      break;
    }
    case "deckchair":
      deckchair(ctx, x, y, CHAIRS[v % 8], v);
      break;
    case "sandcastle": {
      ell(ctx, x, y + 4, 58, 16, "#8FB7C2");
      ell(ctx, x, y + 2, 46, 11, "#D9C08A");
      rect(ctx, x - 40, y - 22, 80, 24, "#CDB079");
      for (const tx of [-34, 22]) {
        rect(ctx, x + tx, y - 44, 14, 24, "#C4A56E");
        for (let k = 0; k < 3; k++) rect(ctx, x + tx + k * 5, y - 48, 3, 5, "#C4A56E");
      }
      rect(ctx, x - 12, y - 52, 24, 32, "#CDB079");
      for (let k = 0; k < 4; k++) rect(ctx, x - 12 + k * 7, y - 57, 4, 6, "#CDB079");
      ctx.fillStyle = "#6E5A3E";
      ctx.beginPath();
      ctx.arc(x, y - 4, 7, Math.PI, 0);
      ctx.fill();
      rect(ctx, x - 7, y - 4, 14, 6, "#6E5A3E");
      line(ctx, [x, y - 57, x, y - 78], "#3A3631", 1.4);
      poly(ctx, [x, y - 78, x + 14, y - 74, x, y - 70], "#B03A2E");
      for (let k = 0; k < 6; k++) ell(ctx, x - 30 + k * 12, y - 10, 2, 2, "#F4F1EA");
      break;
    }
    case "bucket": {
      const c = v ? "#2D4C9A" : "#B03A2E";
      poly(ctx, [x - 12, y - 24, x + 12, y - 24, x + 9, y, x - 9, y], c);
      rect(ctx, x - 12, y - 24, 24, 4, v ? "#E3B556" : "#F4F1EA");
      ctx.strokeStyle = "#3A3631";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y - 22, 12, Math.PI, 0);
      ctx.stroke();
      line(ctx, [x + 16, y + 2, x + 6, y - 30], "#8A6440", 2.5);
      poly(ctx, [x + 14, y - 4, x + 22, y - 2, x + 20, y + 8, x + 12, y + 6], v ? "#E3B556" : "#4F7A5A");
      ell(ctx, x - 16, y + 2, 6, 3, "#CDB079");
      break;
    }
    case "ball": {
      const cols = ["#B03A2E", "#F4F1EA", "#2D4C9A", "#F4F1EA", "#E3B556", "#F4F1EA"];
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = cols[(k + v) % 6];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, 12, (k * Math.PI) / 3, ((k + 1) * Math.PI) / 3);
        ctx.fill();
      }
      ell(ctx, x, y, 3, 3, "#F4F1EA");
      break;
    }
    case "dog": {
      ell(ctx, x, y - 12, 20, 10, "#9C6B3E");
      ell(ctx, x + 20, y - 22, 9, 8, "#9C6B3E");
      ell(ctx, x + 27, y - 20, 5, 4, "#7A5030");
      ell(ctx, x + 17, y - 26, 4, 7, "#6E4A2A", 0.5);
      for (const [lx, a] of [[-14, -6], [-6, 4], [8, -4], [14, 8]]) line(ctx, [x + lx, y - 6, x + lx + a, y + 6], "#9C6B3E", 4);
      line(ctx, [x - 18, y - 16, x - 28, y - 26], "#9C6B3E", 3);
      ell(ctx, x + 21, y - 24, 1.4, 1.4, "#1C1C1A");
      break;
    }
    case "sign": {
      rect(ctx, x - 3, y - 40, 6, 42, "#6B5B48");
      rect(ctx, x - 32, y - 72, 64, 36, "#F4F1EA");
      rect(ctx, x - 32, y - 72, 64, 4, "#B03A2E");
      text(ctx, "NO DOGS", x, y - 60, 11, "#1C1C1A", "Work Sans", 700);
      text(ctx, "ON THE BEACH", x, y - 46, 7.5, "#1C1C1A", "Work Sans", 600);
      break;
    }
    case "lifeguard": {
      for (const lx of [-30, 30]) line(ctx, [x + lx, y, x + lx * 0.5, y - 90], "#F4F1EA", 5);
      for (const ly of [-24, -48, -72]) line(ctx, [x - 28, y + ly, x + 28, y + ly], "#F4F1EA", 3);
      rect(ctx, x - 24, y - 96, 48, 8, "#B03A2E");
      rect(ctx, x - 22, y - 128, 6, 34, "#B03A2E");
      rect(ctx, x + 16, y - 128, 6, 34, "#B03A2E");
      rect(ctx, x - 22, y - 124, 44, 20, "#B03A2E");
      rect(ctx, x - 18, y - 120, 36, 14, "#F4F1EA");
      text(ctx, "BACK IN", x, y - 116, 6.5, "#1C1C1A", "Work Sans", 700);
      text(ctx, "10 MIN", x, y - 109, 6.5, "#B03A2E", "Work Sans", 700);
      rect(ctx, x - 14, y - 84, 28, 14, "#E3B556");
      text(ctx, "LIFEGUARD", x, y - 77, 4.6, "#B03A2E", "Work Sans", 700);
      ell(ctx, x - 26, y + 2, 8, 3, "rgba(120,90,50,.2)");
      break;
    }
    case "flag": {
      line(ctx, [x, y, x, y - 80], "#3A3631", 2);
      rect(ctx, x + 1, y - 80, 26, 12, "#B03A2E");
      rect(ctx, x + 1, y - 68, 26, 12, "#E3B556");
      break;
    }
    case "kite": {
      standing(ctx, x, y, "#2D4C9A", SKIN[1], "#1C1C1A", "up", 62);
      break;
    }
    case "detector": {
      small(ctx, x, y, 78, { coat: "#4F7A5A", legs: "#A3916E", skin: SKIN[0], hair: "#C9C2B4", hat: "#6B5B48" });
      line(ctx, [x + 14, y - 44, x + 30, y - 6], "#3A3631", 2);
      ell(ctx, x + 32, y - 3, 10, 4, "#3A3631");
      rect(ctx, x - 26, y - 70, 10, 12, "#2A2927");
      break;
    }
    case "paddler": {
      ell(ctx, x, y, 22, 6, "rgba(255,255,255,.55)");
      standing(ctx, x, y, v ? "#E3B556" : "#6B4E7A", SKIN[v ? 2 : 3], v ? "#1C1C1A" : "#E3B556", v ? "up" : undefined, 72);
      rect(ctx, x - 12, y - 10, 24, 10, "rgba(143,183,194,.7)");
      break;
    }
    case "windbreak": {
      const cols = v ? ["#2D4C9A", "#F4F1EA", "#B03A2E"] : ["#4F7A5A", "#E3B556", "#F4F1EA"];
      for (let k = 0; k < 6; k++) {
        const x0 = x - 56 + k * 19;
        poly(ctx, [x0, y - 34 + k * 0.8, x0 + 19, y - 34 + (k + 1) * 0.8, x0 + 19, y, x0, y], cols[k % 3]);
      }
      for (let k = 0; k <= 6; k++) rect(ctx, x - 58 + k * 19, y - 38, 3, 42, "#8A6440");
      break;
    }
    case "coolbox": {
      rect(ctx, x - 22, y - 20, 44, 26, "#3E6E8E");
      rect(ctx, x - 24, y - 24, 48, 7, "#F4F1EA");
      rect(ctx, x - 6, y - 28, 12, 4, "#F4F1EA");
      rect(ctx, x + 24, y - 6, 6, 12, "#B03A2E");
      rect(ctx, x + 32, y - 4, 6, 10, "#4F7A5A");
      break;
    }
    case "picnic": {
      rect(ctx, x - 62, y - 22, 124, 40, "#F4F1EA");
      for (let k = 0; k < 124; k += 16) rect(ctx, x - 62 + k, y - 22, 8, 40, "rgba(176,58,46,.75)");
      for (let k = 0; k < 40; k += 16) rect(ctx, x - 62, y - 22 + k, 124, 8, "rgba(176,58,46,.45)");
      rect(ctx, x - 16, y - 12, 32, 20, "#A86E35");
      rect(ctx, x - 16, y - 12, 32, 4, "#8A5A30");
      for (let k = 0; k < 3; k++) poly(ctx, [x + 22 + k * 10, y + 6, x + 30 + k * 10, y + 6, x + 26 + k * 10, y - 2], "#E3C76A");
      for (const [px, c, s] of [[-44, "#2D4C9A", 0], [44, "#B03A2E", 2]] as const) {
        ell(ctx, x + px, y - 18, 11, 16, c);
        ell(ctx, x + px, y - 40, 8, 9, SKIN[s]);
        ell(ctx, x + px, y - 44, 9, 6, s ? "#1C1C1A" : "#6B4A2E");
      }
      ell(ctx, x + 2, y - 30, 7, 10, "#E3B556");
      ell(ctx, x + 2, y - 46, 6, 7, SKIN[3]);
      break;
    }
    case "frisbee": {
      standing(ctx, x, y, v ? "#D98C5F" : "#3E6E8E", SKIN[v ? 4 : 1], v ? "#6B4A2E" : "#1C1C1A", "up", 70);
      if (v) ell(ctx, x - 40, y - 56, 10, 3.5, "#E3B556", -0.2);
      break;
    }
    case "gull": {
      rect(ctx, x + 6, y - 6, 22, 14, "#F4F1EA");
      for (let k = 0; k < 6; k++) rect(ctx, x + 8 + k * 3.5, y - 12 + (k % 2) * 3, 2.5, 10, "#E3C76A");
      ell(ctx, x - 6, y - 12, 14, 9, "#F4F1EA");
      ell(ctx, x - 10, y - 14, 10, 5, "#9EA4AA");
      ell(ctx, x + 6, y - 22, 6, 6, "#F4F1EA");
      poly(ctx, [x + 11, y - 22, x + 19, y - 19, x + 11, y - 19], "#E3B556");
      ell(ctx, x + 7, y - 23, 1.2, 1.2, "#1C1C1A");
      rect(ctx, x - 8, y - 4, 2, 8, "#E3B556");
      rect(ctx, x - 2, y - 4, 2, 8, "#E3B556");
      break;
    }
    case "crab": {
      ell(ctx, x, y, 10, 7, "#B4513A");
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) line(ctx, [x + s * 7, y + 1 + k * 2, x + s * 15, y + 4 + k * 3], "#B4513A", 1.4);
        ell(ctx, x + s * 13, y - 8, 4, 3, "#B4513A");
      }
      ell(ctx, x - 3, y - 6, 1.3, 1.3, "#1C1C1A");
      ell(ctx, x + 3, y - 6, 1.3, 1.3, "#1C1C1A");
      break;
    }
    case "shells": {
      for (let k = 0; k < 7; k++) ell(ctx, x - 22 + k * 7, y + (k % 3) * 3 - 3, 3, 2.4, ["#F4F1EA", "#D8A6A0", "#E3C76A"][k % 3]);
      line(ctx, [x - 20, y + 7, x - 6, y + 4, x + 10, y + 8], "#4F7A5A", 2);
      break;
    }
    case "radio": {
      towelBase(ctx, x + 8, y, 92, 30, "#4F7A5A", "#F4F1EA");
      lying(ctx, x + 18, y, "#E3B556", SKIN[2], "#1C1C1A", true);
      rect(ctx, x - 36, y - 26, 30, 18, "#B03A2E");
      ell(ctx, x - 28, y - 17, 5, 5, "#2A2927");
      ell(ctx, x - 14, y - 17, 5, 5, "#2A2927");
      line(ctx, [x - 10, y - 26, x - 2, y - 40], "#9C958A", 1.2);
      for (const [nx, ny] of [[-6, -36], [6, -30]]) {
        ell(ctx, x + nx, y + ny, 3, 2.2, "#2D4C9A", -0.4);
        line(ctx, [x + nx + 2.5, y + ny, x + nx + 2.5, y + ny - 9, x + nx + 6, y + ny - 6], "#2D4C9A", 1.2);
      }
      break;
    }
    case "digger": {
      ell(ctx, x - 6, y + 2, 18, 6, "#B79B67");
      ell(ctx, x + 8, y - 18, 10, 13, "#D8A6A0");
      ell(ctx, x + 10, y - 36, 7, 8, SKIN[4]);
      ell(ctx, x + 10, y - 40, 8, 5, "#E3B556");
      line(ctx, [x + 4, y - 22, x - 8, y - 10, x - 12, y], SKIN[4], 4);
      line(ctx, [x - 10, y - 4, x - 18, y - 10], "#E3B556", 3);
      for (let k = 0; k < 5; k++) ell(ctx, x - 22 + rand() * 12, y - 12 - rand() * 14, 2, 2, "#CDB079");
      break;
    }
    case "buried": {
      ell(ctx, x, y, 44, 14, "#CDB079");
      ell(ctx, x - 6, y - 4, 38, 9, "#D9C08A");
      ell(ctx, x - 44, y - 4, 9, 9, SKIN[1]);
      ell(ctx, x - 46, y - 8, 9, 5, "#1C1C1A");
      ell(ctx, x + 38, y - 6, 5, 4, SKIN[1]);
      ell(ctx, x + 38, y + 4, 5, 4, SKIN[1]);
      ell(ctx, x + 14, y + 16, 8, 3, "#B03A2E");
      break;
    }
  }
}

function hut(ctx: Ctx, i: number) {
  const h = HUTS[i];
  const x = HUT_X(i);
  const top = 760;
  const bottom = 856;
  ell(ctx, x + HUT_W / 2 + 6, bottom + 2, HUT_W / 2 + 6, 6, "rgba(28,28,26,.18)");
  rect(ctx, x, top, HUT_W, bottom - top, h.wall);
  for (let k = 8; k < HUT_W; k += 9) rect(ctx, x + k, top, 1.2, bottom - top, "rgba(28,28,26,.13)");
  poly(ctx, [x - 8, top + 2, x + HUT_W / 2, 708, x + HUT_W + 8, top + 2], h.roof);
  poly(ctx, [x - 8, top + 2, x + HUT_W / 2, 708, x + HUT_W / 2, 716, x + 2, top + 2], "rgba(255,255,255,.1)");
  rect(ctx, x - 8, top - 1, HUT_W + 16, 4, "#F4F1EA");
  ell(ctx, x + HUT_W / 2, 738, 8, 8, "#F4F1EA");
  text(ctx, String(i + 31), x + HUT_W / 2, 738, 8, "#1C1C1A", "Work Sans", 700);
  const open = i === 2 || i === 5;
  rect(ctx, x + 22, top + 12, HUT_W - 44, bottom - top - 12, open ? "#3A3631" : h.door);
  if (open) {
    rect(ctx, x + 22, top + 12, 6, bottom - top - 12, h.door);
    rect(ctx, x + HUT_W - 28, top + 12, 6, bottom - top - 12, h.door);
    rect(ctx, x + 30, top + 30, 32, 3, "#8A6440");
    rect(ctx, x + 34, top + 20, 8, 10, "#B03A2E");
    rect(ctx, x + 46, top + 22, 10, 8, "#F4F1EA");
    ell(ctx, x + 46, top + 60, 10, 12, i === 2 ? "#E3B556" : "#91A8C0");
  } else {
    for (let k = 0; k < 4; k++) rect(ctx, x + 26 + k * 11, top + 12, 2, bottom - top - 12, "rgba(255,255,255,.18)");
    rect(ctx, x + HUT_W / 2 - 8, top + 24, 16, 14, "rgba(28,28,26,.25)");
    ell(ctx, x + HUT_W - 28, top + 54, 2.5, 2.5, "#3A3631");
  }
  rect(ctx, x - 4, bottom, HUT_W + 8, 8, "#8A6440");
}

/** Draws the whole picture into ctx, in world units (0..BW, 0..BH). Same picture every time. */
function draw(ctx: Ctx) {
  const rand = rng(51515);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, BW, BH);
  ctx.clip();

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, "#9DBBD0");
  sky.addColorStop(1, "#E3E6DC");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, BW, HORIZON);
  ell(ctx, 730, 48, 28, 28, "rgba(255,248,220,.85)");
  ell(ctx, 730, 48, 40, 40, "rgba(255,248,220,.25)");
  cloud(ctx, 110, 54, 1.1);
  cloud(ctx, 560, 44, 1.2);
  cloud(ctx, 1040, 82, 1.1);
  cloud(ctx, 1240, 30, 0.7);
  for (const [gx, gy, s] of [[350, 98, 1], [376, 90, 1.2], [404, 104, 0.9], [440, 92, 1.1], [1180, 60, 0.9], [470, 108, 0.8]]) gullFlying(ctx, gx, gy, s);
  // hot air balloon
  {
    const bx = 260;
    const by = 46;
    const cols = ["#B03A2E", "#E3B556", "#2D4C9A", "#E3B556", "#B03A2E"];
    for (let k = 0; k < 5; k++) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(bx, by, 26, 30, 0, 0, Math.PI * 2);
      ctx.clip();
      rect(ctx, bx - 26 + k * 10.4, by - 32, 10.4, 64, cols[k]);
      ctx.restore();
    }
    poly(ctx, [bx - 18, by + 22, bx + 18, by + 22, bx + 7, by + 44, bx - 7, by + 44], cols[2]);
    line(ctx, [bx - 7, by + 44, bx - 6, by + 56], "#3A3631", 1);
    line(ctx, [bx + 7, by + 44, bx + 6, by + 56], "#3A3631", 1);
    rect(ctx, bx - 8, by + 56, 16, 11, "#8A6440");
  }
  // the kite, flown from the sand
  {
    const kx = 898;
    const ky = 58;
    line(ctx, [kx, ky + 22, 911, 402], "#3A3631", 0.8);
    poly(ctx, [kx, ky - 22, kx + 20, ky, kx, ky + 26, kx - 20, ky], "#2D4C9A");
    poly(ctx, [kx, ky - 22, kx + 20, ky, kx, ky], "#E3B556");
    poly(ctx, [kx - 20, ky, kx, ky + 26, kx, ky], "#E3B556");
    line(ctx, [kx, ky + 26, kx - 12, ky + 46, kx + 4, ky + 64, kx - 8, ky + 82], "#3A3631", 0.8);
    for (const [bx, by] of [[kx - 9, ky + 44], [kx + 2, ky + 62], [kx - 7, ky + 80]]) ell(ctx, bx, by, 5, 2.5, "#B03A2E", 0.6);
  }

  // sea
  const sea = ctx.createLinearGradient(0, HORIZON, 0, SHORE);
  sea.addColorStop(0, "#3E6680");
  sea.addColorStop(0.55, "#5E8EA0");
  sea.addColorStop(1, "#93BDBF");
  ctx.fillStyle = sea;
  ctx.fillRect(0, HORIZON, BW, SHORE - HORIZON);
  for (let k = 0; k < 520; k++) {
    const y = HORIZON + 4 + rand() * (SHORE - HORIZON - 8);
    const t = (y - HORIZON) / (SHORE - HORIZON);
    const x = rand() * BW;
    const w = 6 + t * 18;
    line(ctx, [x, y, x + w / 2, y - 1.5 - t * 2, x + w, y], k % 3 ? "rgba(255,255,255,.22)" : "rgba(30,50,70,.18)", 1 + t);
  }
  rect(ctx, 0, HORIZON, BW, 2, "rgba(30,50,70,.35)");
  // ship on the horizon
  poly(ctx, [478, 146, 630, 146, 618, 156, 490, 156], "#3A3631");
  rect(ctx, 520, 132, 70, 14, "#E2D3AE");
  rect(ctx, 528, 136, 54, 3, "#5F6670");
  rect(ctx, 560, 120, 10, 12, "#B03A2E");
  for (let k = 0; k < 4; k++) rect(ctx, 494 + k * 8, 138, 7, 8, ["#B4513A", "#2D4C9A", "#D8AA52", "#4F7A5A"][k]);
  ell(ctx, 566, 112, 8, 4, "rgba(220,220,214,.7)");
  // little sailing boat far out
  poly(ctx, [1004, 186, 1046, 186, 1040, 194, 1010, 194], "#F4F1EA");
  poly(ctx, [1024, 184, 1024, 152, 1042, 184], "#F4F1EA");
  poly(ctx, [1022, 184, 1022, 158, 1008, 184], "#B4513A");
  // the sailing boat
  {
    const x = 780;
    const wl = 256;
    poly(ctx, [x - 54, wl - 16, x + 58, wl - 16, x + 44, wl + 2, x - 44, wl + 2], "#2D4C9A");
    rect(ctx, x - 54, wl - 18, 112, 4, "#F4F1EA");
    text(ctx, "MARGARET", x + 4, wl - 7, 8, "#F4F1EA", "Work Sans", 700);
    rect(ctx, x - 2, wl - 96, 4, 80, "#6B5B48");
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + 4, wl - 94);
    ctx.lineTo(x + 50, wl - 22);
    ctx.lineTo(x + 4, wl - 22);
    ctx.closePath();
    ctx.clip();
    for (let k = 0; k < 8; k++) rect(ctx, x, wl - 96 + k * 10, 60, 10, k % 2 ? "#F4F1EA" : "#B03A2E");
    ctx.restore();
    poly(ctx, [x - 4, wl - 88, x - 4, wl - 22, x - 42, wl - 22], "#F4F1EA");
    poly(ctx, [x + 2, wl - 96, x + 18, wl - 92, x + 2, wl - 88], "#E3B556");
    ell(ctx, x - 20, wl - 28, 5, 6, SKIN[0]);
    ell(ctx, x - 20, wl - 32, 6, 3, "#E3B556");
    for (let k = 0; k < 4; k++) line(ctx, [x - 46 + k * 30, wl + 6, x - 30 + k * 30, wl + 6], "rgba(255,255,255,.5)", 1.5);
    poly(ctx, [x - 44, wl + 2, x + 44, wl + 2, x + 40, wl + 10, x - 40, wl + 10], "rgba(30,50,90,.3)");
  }
  // pedalo
  poly(ctx, [566, 240, 622, 240, 616, 250, 572, 250], "#F4F1EA");
  ell(ctx, 594, 236, 18, 6, "#E3B556");
  ell(ctx, 584, 226, 5, 6, SKIN[1]);
  ell(ctx, 602, 226, 5, 6, SKIN[3]);
  ell(ctx, 584, 222, 6, 3, "#1C1C1A");
  ell(ctx, 602, 222, 6, 3, "#B4513A");
  poly(ctx, [566, 240, 556, 232, 568, 236], "#E3B556");
  // paddle boarder
  poly(ctx, [880, 288, 940, 288, 934, 292, 886, 292], "#E3B556");
  standing(ctx, 910, 288, "#B03A2E", SKIN[2], "#1C1C1A", undefined, 58);
  line(ctx, [924, 236, 934, 296], "#3A3631", 2);
  // buoy
  poly(ctx, [1066, 264, 1088, 264, 1082, 236, 1072, 236], "#D98C5F");
  rect(ctx, 1068, 252, 18, 5, "#F4F1EA");
  line(ctx, [1077, 236, 1077, 228], "#3A3631", 2);
  ell(ctx, 1077, 266, 16, 4, "rgba(255,255,255,.4)");
  // swimmers and floats
  for (const [sx, sy, s, c] of [[486, 312, 0, "#1C1C1A"], [522, 304, 3, "#E3B556"], [560, 318, 2, "#B03A2E"]] as const) {
    ell(ctx, sx, sy + 6, 13, 4, "rgba(255,255,255,.45)");
    ell(ctx, sx, sy, 6, 7, SKIN[s]);
    ell(ctx, sx, sy - 3, 7, 4.5, c);
  }
  line(ctx, [522, 300, 530, 288, 536, 282], SKIN[3], 3);
  {
    rect(ctx, 616, 324, 70, 16, "#D98C5F");
    for (let k = 0; k < 6; k++) rect(ctx, 622 + k * 11, 324, 2, 16, "rgba(255,255,255,.35)");
    lying(ctx, 652, 330, "#2D4C9A", SKIN[0], "#6B4A2E");
  }
  ctx.strokeStyle = "#B03A2E";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(983, 334, 16, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = 0; k < 4; k++) {
    ctx.strokeStyle = "#F4F1EA";
    ctx.beginPath();
    ctx.ellipse(983, 334, 16, 7, 0, k * 1.57, k * 1.57 + 0.4);
    ctx.stroke();
  }
  ell(ctx, 983, 328, 5, 6, SKIN[4]);
  ell(ctx, 983, 325, 6, 3, "#3A2A1E");
  ell(ctx, 846, 346, 18, 5, "rgba(255,255,255,.45)");
  ell(ctx, 834, 342, 6, 6, SKIN[2]);
  ell(ctx, 834, 339, 6.5, 4, "#B03A2E");
  line(ctx, [840, 340, 856, 334, 866, 342], SKIN[2], 3);

  // the headland
  poly(ctx, [1104, SHORE, 1140, 250, 1170, 170, 1214, 118, 1270, 96, 1344, 88, BW, SHORE], "#C7B48A");
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(1104, SHORE);
  ctx.lineTo(1140, 250);
  ctx.lineTo(1170, 170);
  ctx.lineTo(1214, 118);
  ctx.lineTo(1270, 96);
  ctx.lineTo(1344, 88);
  ctx.lineTo(BW, SHORE);
  ctx.closePath();
  ctx.clip();
  for (let y = 120; y < SHORE; y += 14) rect(ctx, 1100, y + ((y / 14) % 2) * 3, 260, 2, "rgba(110,90,60,.22)");
  for (let k = 0; k < 30; k++) rect(ctx, 1110 + rand() * 234, 130 + rand() * 230, 1.5, 10 + rand() * 18, "rgba(110,90,60,.25)");
  poly(ctx, [1150, 220, 1170, 170, 1214, 118, 1270, 96, 1344, 88, 1344, 130, 1280, 140, 1230, 160, 1190, 200], "#7E9A6A");
  for (let k = 0; k < 40; k++) ell(ctx, 1170 + rand() * 174, 110 + rand() * 40, 5, 3, "#6E8A5A");
  line(ctx, [1180, 196, 1210, 170, 1236, 160, 1260, 140, 1300, 128, 1344, 122], "#D9C9A0", 2.5);
  ctx.restore();
  rect(ctx, 1222, 104, 46, 26, "#F4F1EA");
  poly(ctx, [1216, 106, 1245, 84, 1274, 106], "#B4513A");
  rect(ctx, 1230, 112, 9, 10, "#3E6E8E");
  rect(ctx, 1250, 112, 9, 18, "#2D4C9A");
  rect(ctx, 1256, 80, 6, 14, "#8A5A44");
  for (const [gx, gy] of [[1160, 226], [1196, 216], [1228, 228]]) {
    ell(ctx, gx, gy, 7, 4.5, "#F4F1EA");
    ell(ctx, gx + 5, gy - 5, 3.5, 3.5, "#F4F1EA");
    ell(ctx, gx - 2, gy - 1, 5, 2.5, "#9EA4AA");
  }
  for (let k = 0; k < 16; k++) ell(ctx, 1110 + k * 15 + rand() * 6, SHORE - 18 + rand() * 18, 12 + rand() * 6, 9 + rand() * 4, k % 2 ? "#6E6A62" : "#857F74");
  for (let k = 0; k < 8; k++) ell(ctx, 1120 + k * 30, SHORE - 6, 10, 3, "rgba(255,255,255,.6)");

  // the pier
  {
    const deck = 262;
    for (let x = 6; x < 430; x += 34) {
      rect(ctx, x, deck + 10, 6, 78, "#5A4A3A");
      ell(ctx, x + 3, deck + 88, 9, 2.5, "rgba(255,255,255,.5)");
      rect(ctx, x, deck + 92, 6, 12, "rgba(60,50,40,.25)");
      if (x + 34 < 430) {
        line(ctx, [x + 3, deck + 14, x + 37, deck + 50], "#5A4A3A", 2);
        line(ctx, [x + 37, deck + 14, x + 3, deck + 50], "#5A4A3A", 2);
        line(ctx, [x + 3, deck + 50, x + 37, deck + 82], "#5A4A3A", 1.6);
        line(ctx, [x + 37, deck + 50, x + 3, deck + 82], "#5A4A3A", 1.6);
      }
    }
    rect(ctx, 0, deck, 434, 12, "#6E5A44");
    rect(ctx, 0, deck + 12, 434, 3, "#3A3631");
    rect(ctx, 0, deck - 16, 300, 2, "#F4F1EA");
    for (let x = 4; x < 300; x += 12) rect(ctx, x, deck - 16, 1.6, 16, "#F4F1EA");
    // people on the pier
    const folk: [number, string, string, number][] = [[20, "#B03A2E", "#2A2927", 0], [50, "#2D4C9A", "#4A5F78", 2], [92, "#E3B556", "#2A2927", 3], [236, "#4F7A5A", "#2A2927", 1], [262, "#6B4E7A", "#4A5F78", 4]];
    for (const [px, c, l, s] of folk) small(ctx, px, deck, 40, { coat: c, legs: l, skin: SKIN[s], hair: s % 2 ? "#1C1C1A" : "#6B4A2E" });
    // the fisherman
    small(ctx, 168, deck, 44, { coat: "#3E6E4E", legs: "#2A2927", skin: SKIN[0], hair: "#C9C2B4", hat: "#E3B556" });
    line(ctx, [174, deck - 20, 206, deck - 58], "#3A3631", 1.4);
    line(ctx, [206, deck - 58, 200, deck + 50], "#3A3631", 0.5);
    rect(ctx, 150, deck - 8, 10, 8, "#7A5A3C");
    // lamp posts with a gull
    for (const lx of [130, 214]) {
      rect(ctx, lx - 1.5, deck - 44, 3, 44, "#2F3A36");
      ell(ctx, lx, deck - 46, 5, 5, "#F4E1A6");
    }
    ell(ctx, 130, deck - 55, 6, 4, "#F4F1EA");
    ell(ctx, 134, deck - 59, 3, 3, "#F4F1EA");
    // the amusements
    const ax = 296;
    rect(ctx, ax, 204, 116, deck - 204, "#E2D3AE");
    rect(ctx, ax, 204, 116, 4, "#B03A2E");
    ctx.fillStyle = "#3E6E4E";
    ctx.beginPath();
    ctx.ellipse(ax + 58, 204, 36, 26, 0, Math.PI, 0);
    ctx.fill();
    ell(ctx, ax + 14, 200, 10, 10, "#3E6E4E");
    ell(ctx, ax + 102, 200, 10, 10, "#3E6E4E");
    line(ctx, [ax + 58, 178, ax + 58, 160], "#3A3631", 1.6);
    poly(ctx, [ax + 58, 160, ax + 74, 165, ax + 58, 170], "#B03A2E");
    rect(ctx, ax + 8, 212, 100, 14, "#B03A2E");
    text(ctx, "AMUSEMENTS", ax + 58, 219.5, 10, "#F4E1A6", "Libre Caslon Text", 700);
    for (let k = 0; k < 4; k++) {
      const wx = ax + 10 + k * 26;
      rect(ctx, wx, 234, 16, 22, "#F4E1A6");
      ctx.fillStyle = "#F4E1A6";
      ctx.beginPath();
      ctx.arc(wx + 8, 234, 8, Math.PI, 0);
      ctx.fill();
      rect(ctx, wx + 3, 240, 10, 8, ["#B03A2E", "#2D4C9A", "#4F7A5A", "#E3B556"][k]);
    }
    for (let k = 0; k < 12; k++) ell(ctx, ax + 4 + k * 10, 208, 2, 2, k % 2 ? "#E3B556" : "#F4F1EA");
  }

  // the sand
  const sand = ctx.createLinearGradient(0, SHORE, 0, WALL);
  sand.addColorStop(0, "#C9B184");
  sand.addColorStop(0.1, "#D9C394");
  sand.addColorStop(1, "#E9D6A8");
  ctx.fillStyle = sand;
  ctx.fillRect(0, SHORE, BW, WALL - SHORE);
  rect(ctx, 0, SHORE, BW, 26, "rgba(120,100,70,.18)");
  ctx.fillStyle = "rgba(244,241,234,.85)";
  ctx.beginPath();
  ctx.moveTo(0, SHORE - 4);
  for (let x = 0; x <= BW; x += 12) ctx.lineTo(x, SHORE + 3 + Math.sin(x / 26) * 3 + Math.sin(x / 9) * 1.5);
  ctx.lineTo(BW, SHORE - 4);
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 900; k++) rect(ctx, rand() * BW, SHORE + 26 + rand() * (WALL - SHORE - 26), 2, 2, k % 2 ? "rgba(120,90,50,.16)" : "rgba(255,255,255,.2)");
  for (let k = 0; k < 18; k++) {
    const fx = 120 + k * 22;
    ell(ctx, fx, 392 + (k % 2) * 6, 2.5, 4, "rgba(120,90,50,.3)");
  }
  for (let k = 0; k < 14; k++) ell(ctx, 1080 + k * 10, 482 + (k % 2) * 5 + k * 1.5, 2, 3.5, "rgba(120,90,50,.25)");
  for (let k = 0; k < 30; k++) ell(ctx, rand() * BW, SHORE + 30 + rand() * 300, 1.6, 1.2, ["#F4F1EA", "#D8A6A0", "#8E949A"][k % 3]);
  // everything on the sand, back to front
  for (const [kind, x, y, v] of [...ITEMS].sort((a, b) => a[2] - b[2])) drawItem(ctx, kind, x, y, v, rand);

  // sea wall and promenade
  rect(ctx, 0, WALL - 4, BW, PROM - WALL + 4, "#B9B2A4");
  for (let x = 0; x < BW; x += 36) rect(ctx, x, WALL - 4, 1.5, PROM - WALL + 4, "rgba(60,56,50,.3)");
  rect(ctx, 0, WALL - 6, BW, 4, "#D6D0C2");
  rect(ctx, 0, WALL - 14, BW, 3, "#3E6E8E");
  for (let x = 6; x < BW; x += 28) rect(ctx, x, WALL - 16, 3, 12, "#3E6E8E");
  rect(ctx, 0, PROM, BW, BH - PROM, "#D8D2C4");
  for (let x = 0; x < BW; x += 56) rect(ctx, x, PROM, 1.5, BH - PROM, "rgba(80,76,70,.2)");
  for (let y = PROM + 36; y < BH; y += 36) rect(ctx, 0, y, BW, 1.5, "rgba(80,76,70,.2)");
  for (let k = 0; k < 300; k++) rect(ctx, rand() * BW, PROM + rand() * (BH - PROM), 2, 2, "rgba(60,56,50,.08)");
  // bunting along the huts
  ctx.strokeStyle = "#3A3631";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < HUTS.length - 1; i++) {
    const x0 = HUT_X(i) + HUT_W / 2;
    const x1 = HUT_X(i + 1) + HUT_W / 2;
    ctx.moveTo(x0, 712);
    ctx.quadraticCurveTo((x0 + x1) / 2, 736, x1, 712);
  }
  ctx.stroke();
  for (let i = 0; i < HUTS.length - 1; i++) {
    const x0 = HUT_X(i) + HUT_W / 2;
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      const bx = x0 + t * 112;
      const by = 712 + 4 * 12 * t * (1 - t);
      poly(ctx, [bx - 4, by, bx + 4, by, bx, by + 9], ["#B03A2E", "#E3B556", "#2D4C9A", "#4F7A5A", "#F4F1EA"][(k + i) % 5]);
    }
  }
  HUTS.forEach((_, i) => hut(ctx, i));
  // in front of the huts
  {
    const x = 356;
    rect(ctx, x - 12, 830, 4, 26, "#8A6440");
    rect(ctx, x + 10, 830, 4, 26, "#8A6440");
    person(ctx, x, { coat: "#F4F1EA", legs: "#4A5F78", skin: SKIN[1], hair: "#C9C2B4", h: 84, feet: 860 });
    rect(ctx, x + 12, 806, 8, 9, "#2D4C9A");
    rect(ctx, 316, 846, 16, 12, "#2D4C9A");
    rect(ctx, 320, 838, 8, 8, "#2D4C9A");
  }
  {
    for (const wx of [566, 600]) {
      ctx.strokeStyle = "#1C1C1A";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(wx, 844, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
    line(ctx, [566, 844, 582, 844, 596, 824, 576, 824, 566, 844], "#B03A2E", 2.5);
    line(ctx, [582, 844, 574, 818, 600, 844, 594, 816], "#B03A2E", 2.5);
    line(ctx, [568, 816, 580, 816], "#1C1C1A", 3);
    rect(ctx, 590, 808, 14, 10, "#8A6440");
  }
  // lamp post
  rect(ctx, 1004, 612, 8, 248, "#2F3A36");
  rect(ctx, 1000, 838, 16, 22, "#2F3A36");
  poly(ctx, [994, 614, 1022, 614, 1016, 630, 1000, 630], "#2F3A36");
  poly(ctx, [998, 614, 1018, 614, 1014, 596, 1002, 596], "#F4E1A6");
  poly(ctx, [996, 596, 1020, 596, 1008, 584], "#2F3A36");
  rect(ctx, 990, 680, 36, 24, "#2D4C9A");
  text(ctx, "BEACH", 1008, 688, 7, "#F4F1EA", "Work Sans", 700);
  line(ctx, [1000, 697, 1015, 697], "#F4F1EA", 1.6);
  poly(ctx, [1014, 693, 1019, 697, 1014, 701], "#F4F1EA");

  // the ice cream van
  {
    const x = 1036;
    const y = 852;
    ctx.fillStyle = "#EFE6D2";
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x, y - 104);
    ctx.quadraticCurveTo(x, y - 116, x + 12, y - 116);
    ctx.lineTo(x + 200, y - 116);
    ctx.lineTo(x + 222, y - 76);
    ctx.lineTo(x + 240, y - 70);
    ctx.lineTo(x + 240, y - 20);
    ctx.closePath();
    ctx.fill();
    rect(ctx, x, y - 52, 240, 14, "#D8A6A0");
    rect(ctx, x, y - 40, 240, 4, "#B4513A");
    poly(ctx, [x + 202, y - 108, x + 218, y - 78, x + 202, y - 78], "#9FB8C6");
    rect(ctx, x + 22, y - 106, 128, 46, "#3A3631");
    rect(ctx, x + 18, y - 110, 136, 6, "#D8A6A0");
    for (let k = 0; k < 4; k++) {
      const cx = x + 36 + k * 30;
      poly(ctx, [cx - 6, y - 70, cx + 6, y - 70, cx, y - 56], "#D9A55E");
      ell(ctx, cx, y - 74, 8, 7, ["#F4F1EA", "#D8A6A0", "#A3B79D", "#8A5A3C"][k]);
    }
    ell(ctx, x + 70, y - 92, 9, 10, SKIN[3]);
    ell(ctx, x + 70, y - 97, 10, 5, "#6B4A2E");
    rect(ctx, x + 62, y - 84, 16, 14, "#F4F1EA");
    rect(ctx, x + 160, y - 104, 32, 54, "#F4F1EA");
    text(ctx, "CONE", x + 176, y - 97, 6, "#1C1C1A", "Courier Prime", 700);
    text(ctx, "3.50", x + 176, y - 90, 6, "#B03A2E", "Courier Prime", 700);
    text(ctx, "FLAKE", x + 176, y - 81, 6, "#1C1C1A", "Courier Prime", 700);
    text(ctx, "1.00", x + 176, y - 74, 6, "#B03A2E", "Courier Prime", 700);
    text(ctx, "NO", x + 176, y - 65, 6, "#1C1C1A", "Courier Prime", 700);
    text(ctx, "CHANGE", x + 176, y - 58, 6, "#1C1C1A", "Courier Prime", 700);
    rect(ctx, x + 40, y - 140, 80, 24, "#B4513A");
    text(ctx, "ICES", x + 80, y - 128, 15, "#F4F1EA", "Libre Caslon Text", 700);
    poly(ctx, [x + 150, y - 132, x + 166, y - 132, x + 158, y - 116], "#D9A55E");
    ell(ctx, x + 158, y - 136, 10, 8, "#F4F1EA");
    ell(ctx, x + 158, y - 144, 6, 6, "#F4F1EA");
    rect(ctx, x + 161, y - 152, 3, 12, "#6E4A2A");
    text(ctx, "Mr Softly", x + 100, y - 30, 11, "#B4513A", "Libre Caslon Text", 700);
    for (const wx of [x + 50, x + 194]) {
      ell(ctx, wx, y - 6, 17, 17, "#1C1C1A");
      ell(ctx, wx, y - 6, 7, 7, "#B9BDBF");
    }
    ell(ctx, x + 236, y - 58, 4, 4, "#F4E1A6");
  }
  // the queue
  person(ctx, 1302, { coat: "#B03A2E", legs: "#E3B556", skin: SKIN[2], hair: "#1C1C1A", h: 96, feet: 858 });
  rect(ctx, 1294, 790, 16, 8, "#E3B556");
  text(ctx, "LIFEGUARD", 1302, 794, 3.6, "#B03A2E", "Work Sans", 700);
  person(ctx, 1336, { coat: "#4F7A5A", legs: "#2A2927", skin: SKIN[0], hair: "#E3B556", h: 90, feet: 858 });
  small(ctx, 1022, 858, 60, { coat: "#E3B556", legs: "#2D4C9A", skin: SKIN[3], hair: "#C9783E", arm: "up" });
  poly(ctx, [1029, 786, 1037, 786, 1033, 798], "#D9A55E");
  ell(ctx, 1033, 784, 5, 4, "#D8A6A0");

  grain(ctx, rand);
  ctx.restore();
}

export const beach: Scene = { title: "The Beach", draw, labels: LABELS, landmarks: LANDMARKS };
