// The Park: a sunny afternoon with a pond, a bandstand, a cafe kiosk and everyone out at once.
// Busy on purpose, so most pieces have something on them you can place.
import { BW, BH, rng, rect, ell, poly, line, text, person as stockPerson, grain, SKIN, type Box, type Ctx, type PersonOpts, type Scene } from "./common";

const LABELS: Box[] = [];
const lab = (name: string, x: number, y: number, w: number, h: number) => LABELS.push({ x, y, w, h, name });

const HORIZON = 262;
const POND = { x: 300, y: 482, rx: 262, ry: 88 };
const pathY = (x: number) => 640 - 50 * Math.sin((Math.PI * x) / BW);
const PATH_W = 46;

type TreeKind = "oak" | "poplar" | "fir" | "willow" | "birch" | "beech" | "blossom" | "lime";
const TREE_NAMES: Record<TreeKind, string> = {
  oak: "an oak tree",
  poplar: "a poplar",
  fir: "a fir tree",
  willow: "the weeping willow",
  birch: "a silver birch",
  beech: "the copper beech",
  blossom: "the blossom tree",
  lime: "a lime tree",
};
const TREE_DIMS: Record<TreeKind, [number, number]> = {
  oak: [64, 172], poplar: [26, 222], fir: [46, 195], willow: [84, 180], birch: [42, 178], beech: [68, 176], blossom: [58, 150], lime: [52, 202],
};
const TREES: { x: number; y: number; k: TreeKind; s: number }[] = [
  { x: 40, y: 338, k: "oak", s: 1 },
  { x: 140, y: 318, k: "poplar", s: 1 },
  { x: 215, y: 332, k: "fir", s: 0.95 },
  { x: 300, y: 322, k: "birch", s: 1 },
  { x: 390, y: 336, k: "lime", s: 1 },
  { x: 480, y: 330, k: "blossom", s: 0.95 },
  { x: 562, y: 320, k: "poplar", s: 0.9 },
  { x: 640, y: 334, k: "oak", s: 1.05 },
  { x: 884, y: 330, k: "beech", s: 1 },
  { x: 968, y: 326, k: "lime", s: 0.95 },
  { x: 1046, y: 318, k: "birch", s: 0.9 },
  { x: 1112, y: 328, k: "fir", s: 1 },
  { x: 1200, y: 336, k: "oak", s: 1.05 },
  { x: 1282, y: 318, k: "poplar", s: 1 },
  { x: 1336, y: 340, k: "blossom", s: 0.9 },
];
const WILLOW = { x: 46, y: 452, k: "willow" as TreeKind, s: 1.05 };
const treeBox = (t: { x: number; y: number; k: TreeKind; s: number }) => {
  const [w, h] = TREE_DIMS[t.k];
  return { x: t.x - w * t.s, y: t.y - h * t.s, w: 2 * w * t.s, h: h * t.s + 6 };
};

// the skyline, worked out once so labels and drawing agree
const SKYLINE: { x: number; w: number; h: number; col: string }[] = [];
{
  const r = rng(515);
  const cols = ["#B9B2A6", "#A9B0B4", "#C3A898", "#B7BBAE", "#CDBFA3"];
  for (let x = -10; x < BW; ) {
    const w = 34 + Math.floor(r() * 46);
    if (x > 700 && x < 800) {
      x = 800;
      continue;
    }
    SKYLINE.push({ x, w, h: 26 + Math.floor(r() * 44), col: cols[Math.floor(r() * cols.length)] });
    x += w + 2;
  }
}

const DUCKS: [number, number, number][] = [
  [140, 448, 1], [166, 456, 1], [470, 420, -1], [330, 534, 1], [352, 540, 0], [372, 546, 0], [392, 552, 0], [500, 498, -1], [96, 498, 1],
];
const SWANS: [number, number, number][] = [[380, 452, -1], [440, 478, -1]];
const CHAIRS = [712, 752, 848, 888];
const PATH_PEOPLE = [
  { x: 160, name: "a jogger" },
  { x: 384, name: "the man with the dogs" },
  { x: 500, name: "the woman with the pram" },
  { x: 940, name: "a jogger" },
  { x: 1048, name: "the couple holding hands" },
  { x: 1300, name: "the old lady with the stick" },
];

lab("the sky", 0, 0, BW, BH);
lab("the grass", 0, HORIZON - 10, BW, BH - HORIZON + 10);
lab("the sun", 1214, 20, 72, 72);
lab("a cloud", 120, 34, 170, 64);
lab("a cloud", 560, 22, 160, 56);
lab("a cloud", 880, 112, 150, 52);
lab("the birds", 250, 110, 120, 40);
lab("the hot air balloon", 1000, 14, 92, 140);
lab("the rooftops", 0, 186, BW, HORIZON - 186);
lab("the church", 728, 52, 72, 212);
lab("the block of flats", 1150, 150, 62, 112);
TREES.forEach((t) => {
  const b = treeBox(t);
  lab(TREE_NAMES[t.k], b.x, b.y, b.w, b.h);
});
lab("the pond", POND.x - POND.rx - 8, POND.y - POND.ry - 8, POND.rx * 2 + 16, POND.ry * 2 + 16);
lab("the lily pads", 110, 500, 80, 40);
lab("the reeds", 500, 410, 50, 60);
lab("the toy boat", 214, 512, 40, 44);
DUCKS.forEach(([x, y]) => lab("a duck", x - 16, y - 18, 32, 26));
lab("the mother duck and her ducklings", 318, 518, 88, 40);
SWANS.forEach(([x, y]) => lab("a swan", x - 30, y - 42, 60, 54));
lab("the rowing boat", 196, 430, 112, 62);
{
  const b = treeBox(WILLOW);
  lab("the weeping willow", b.x, b.y, b.w, b.h);
}
lab("the path", 0, 540, BW, 130);
lab("the bandstand", 676, 250, 248, 222);
lab("the brass band", 716, 368, 172, 70);
CHAIRS.forEach((x) => lab("a deck chair", x - 18, 500, 36, 52));
lab("the sign about the ducks", 540, 400, 102, 156);
lab("the girl feeding the duck", 620, 494, 40, 70);
lab("the duck being fed", 588, 536, 46, 26);
lab("the swings", 922, 360, 88, 112);
lab("the slide", 1010, 380, 56, 92);
lab("the bench by the swings", 950, 498, 100, 54);
lab("the man reading", 976, 470, 40, 76);
lab("the cafe kiosk", 1060, 286, 244, 186);
lab("the cafe menu", 1214, 390, 70, 72);
lab("the woman behind the counter", 1110, 392, 60, 50);
lab("the man in the queue", 1074, 428, 32, 80);
lab("a cafe table", 1084, 474, 76, 90);
PATH_PEOPLE.forEach((p) => lab(p.name, p.x - 26, pathY(p.x) - 86, 60, 96));
lab("the pram", 516, pathY(540) - 46, 54, 52);
lab("the flower bed", 6, 712, 250, 112);
lab("the gardener", 246, 692, 40, 108);
lab("the wheelbarrow", 284, 742, 84, 58);
lab("the boy with the kite", 386, 744, 40, 100);
lab("the kite", 430, 52, 70, 128);
lab("the picnic", 430, 724, 220, 112);
lab("the family having a picnic", 520, 690, 120, 90);
lab("the dog after the sandwiches", 630, 790, 64, 44);
lab("the bench", 682, 714, 128, 70);
lab("the old couple on the bench", 704, 684, 82, 80);
lab("the pigeons", 692, 790, 120, 30);
lab("the lamp post", 830, 620, 30, 220);
lab("the bin", 866, 778, 36, 58);
lab("the boys playing football", 916, 740, 170, 100);
lab("the man asleep under a newspaper", 1100, 704, 144, 52);
lab("the woman sunbathing", 150, 672, 130, 40);
lab("the dog chasing the frisbee", 944, 676, 60, 40);
lab("the squirrel", 1226, 680, 44, 40);
lab("the flower bed", 1164, 748, 180, 90);
lab("the KEEP OFF THE GRASS sign", 1296, 680, 46, 84);

const LANDMARKS = [
  { x: 800, y: 380 }, // the bandstand
  { x: 590, y: 440 }, // the duck sign
  { x: 1180, y: 340 }, // the cafe
  { x: 540, y: 776 }, // the picnic
  { x: 260, y: 470 }, // the rowing boat
];

const person = (ctx: Ctx, x: number, o: PersonOpts) => stockPerson(ctx, x, o);

function capHead(ctx: Ctx, x: number, y: number, r: number, skin: string, hair: string) {
  ell(ctx, x, y, r * 0.85, r, skin);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.25, r * 0.9, r * 0.75, 0, Math.PI, 0);
  ctx.fill();
}

function sitter(ctx: Ctx, x: number, seat: number, coat: string, legs: string, skin: string, hair: string, s = 1) {
  rect(ctx, x - 9 * s, seat + 2 * s, 7 * s, 20 * s, legs);
  rect(ctx, x + 2 * s, seat + 2 * s, 7 * s, 20 * s, legs);
  rect(ctx, x - 11 * s, seat - 6 * s, 22 * s, 10 * s, legs);
  ell(ctx, x, seat - 18 * s, 12 * s, 18 * s, coat);
  capHead(ctx, x, seat - 42 * s, 9 * s, skin, hair);
}

function runner(ctx: Ctx, x: number, feet: number, coat: string, legs: string, skin: string, hair: string, h = 84) {
  const hip = feet - h * 0.45;
  line(ctx, [x, hip, x - 10, feet - 18, x - 22, feet - 10], legs, 6);
  line(ctx, [x, hip, x + 10, feet - 12, x + 10, feet - 2], legs, 6);
  ell(ctx, x + 12, feet - 2, 6, 3.5, "#2A2927");
  ell(ctx, x - 24, feet - 10, 6, 3.5, "#2A2927");
  poly(ctx, [x - 10, hip + 2, x + 10, hip + 2, x + 13, hip - h * 0.36, x - 7, hip - h * 0.38], coat);
  const sh = hip - h * 0.32;
  line(ctx, [x + 8, sh, x + 18, sh + 12, x + 26, sh + 2], coat, 5);
  line(ctx, [x - 4, sh, x - 14, sh + 14, x - 6, sh + 22], coat, 5);
  capHead(ctx, x + 4, sh - 12, h * 0.12, skin, hair);
}

function duck(ctx: Ctx, x: number, y: number, dir: number, s = 1, drake = true) {
  const body = drake ? "#8C7A62" : "#9C8466";
  ell(ctx, x, y, 13 * s, 7 * s, body);
  poly(ctx, [x - dir * 10 * s, y - 2 * s, x - dir * 18 * s, y - 7 * s, x - dir * 10 * s, y + 3 * s], body);
  ell(ctx, x + dir * 1 * s, y - 2 * s, 7 * s, 3 * s, drake ? "#B7AE9C" : "#7E6A50");
  ell(ctx, x + dir * 10 * s, y - 9 * s, 5.5 * s, 5 * s, drake ? "#2F6B4A" : "#7E6A50");
  if (drake) rect(ctx, x + dir * 7 * s - 3 * s, y - 5 * s, 6 * s, 1.6 * s, "#F4F1EA");
  poly(ctx, [x + dir * 14 * s, y - 10 * s, x + dir * 21 * s, y - 8 * s, x + dir * 14 * s, y - 7 * s], "#D9A13A");
  ell(ctx, x + dir * 11 * s, y - 10.5 * s, 1, 1, "#1C1C1A");
}

function swan(ctx: Ctx, x: number, y: number, dir: number) {
  ell(ctx, x, y, 26, 11, "#F6F4EE");
  poly(ctx, [x - dir * 20, y - 4, x - dir * 32, y - 14, x - dir * 22, y + 4], "#F6F4EE");
  ell(ctx, x - dir * 4, y - 4, 14, 6, "#E7E2D5");
  ctx.strokeStyle = "#F6F4EE";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + dir * 16, y - 4);
  ctx.bezierCurveTo(x + dir * 28, y - 16, x + dir * 10, y - 30, x + dir * 18, y - 38);
  ctx.stroke();
  ell(ctx, x + dir * 21, y - 38, 5, 4, "#F6F4EE");
  poly(ctx, [x + dir * 24, y - 40, x + dir * 32, y - 36, x + dir * 24, y - 35], "#D9773A");
  ell(ctx, x + dir * 22, y - 39, 1.2, 1.2, "#1C1C1A");
}

function tree(ctx: Ctx, t: { x: number; y: number; k: TreeKind; s: number }, rand: () => number) {
  const { x, y, s } = t;
  ell(ctx, x, y, 36 * s, 6 * s, "rgba(40,60,30,.25)");
  const blob = (cx: number, cy: number, rx: number, ry: number, cols: string[], n: number) => {
    ell(ctx, cx, cy, rx, ry, cols[0]);
    for (let k = 0; k < n; k++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 0.8;
      ell(ctx, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rx * 0.28, ry * 0.24, cols[1 + (k % (cols.length - 1))]);
    }
  };
  switch (t.k) {
    case "oak":
      rect(ctx, x - 7 * s, y - 70 * s, 14 * s, 70 * s, "#6B4E36");
      line(ctx, [x, y - 60 * s, x - 22 * s, y - 92 * s], "#6B4E36", 5 * s);
      blob(x, y - 112 * s, 62 * s, 56 * s, ["#5B7A45", "#6E8E52", "#4C6A3B", "#7C9A5C"], 22);
      break;
    case "lime":
      rect(ctx, x - 6 * s, y - 70 * s, 12 * s, 70 * s, "#5E4A3A");
      blob(x, y - 126 * s, 50 * s, 74 * s, ["#7FA05A", "#8DB066", "#6A8C4C"], 20);
      break;
    case "beech":
      rect(ctx, x - 7 * s, y - 64 * s, 14 * s, 64 * s, "#7A746A");
      blob(x, y - 116 * s, 66 * s, 58 * s, ["#7A4A44", "#8E5A4E", "#683C38", "#9A6656"], 22);
      break;
    case "poplar":
      rect(ctx, x - 4 * s, y - 40 * s, 8 * s, 40 * s, "#5E4A3A");
      blob(x, y - 124 * s, 25 * s, 98 * s, ["#6A8A48", "#7A9A56", "#587A3E"], 14);
      break;
    case "fir":
      rect(ctx, x - 5 * s, y - 30 * s, 10 * s, 30 * s, "#5A4030");
      for (let k = 0; k < 4; k++) {
        const ty = y - 24 * s - k * 40 * s;
        const tw = (46 - k * 9) * s;
        poly(ctx, [x - tw, ty, x + tw, ty, x, ty - 64 * s], k % 2 ? "#3E5E44" : "#365640");
      }
      break;
    case "birch":
      rect(ctx, x - 5 * s, y - 100 * s, 10 * s, 100 * s, "#ECE8DD");
      for (let k = 0; k < 7; k++) rect(ctx, x - 5 * s + (k % 2) * 4 * s, y - 92 * s + k * 13 * s, 6 * s, 2.5 * s, "#2A2927");
      blob(x, y - 124 * s, 42 * s, 54 * s, ["#A3B86A", "#B6C97A", "#8EA65A"], 18);
      rect(ctx, x - 3 * s, y - 100 * s, 6 * s, 30 * s, "#ECE8DD");
      break;
    case "blossom":
      rect(ctx, x - 6 * s, y - 56 * s, 12 * s, 56 * s, "#5E4438");
      blob(x, y - 98 * s, 58 * s, 50 * s, ["#E2B6BC", "#EEC9CC", "#D49BA6", "#F4DCDC"], 26);
      for (let k = 0; k < 18; k++) ell(ctx, x + (rand() - 0.5) * 90 * s, y - 2 + rand() * 8, 2, 1.2, "#EEC9CC");
      break;
    case "willow": {
      rect(ctx, x - 8 * s, y - 80 * s, 16 * s, 80 * s, "#5E4A3A");
      blob(x + 10, y - 128 * s, 80 * s, 50 * s, ["#9AAE5E", "#A9BC6C", "#879C50"], 16);
      for (let k = 0; k < 34; k++) {
        const sx = x + 10 - 78 * s + k * 4.6 * s;
        const top = y - 128 * s + Math.abs(k - 17) * 1.6;
        const len = 70 + ((k * 37) % 50);
        line(ctx, [sx, top, sx + 2, top + len * s], k % 2 ? "#879C50" : "#A9BC6C", 3.2);
      }
      break;
    }
  }
}

function deckChair(ctx: Ctx, x: number, y: number, col: string, who?: [string, string, string]) {
  line(ctx, [x - 14, y, x - 8, y - 46, x + 14, y], "#8A6440", 2.6);
  line(ctx, [x + 12, y, x + 6, y - 46], "#8A6440", 2.6);
  poly(ctx, [x - 10, y - 44, x + 6, y - 44, x + 12, y - 12, x - 12, y - 12], col);
  for (let k = 0; k < 3; k++) poly(ctx, [x - 7 + k * 6, y - 44, x - 4 + k * 6, y - 44, x - 2 + k * 7, y - 12, x - 5 + k * 7, y - 12], "#F4F1EA");
  if (who) {
    ell(ctx, x, y - 22, 10, 13, who[0]);
    rect(ctx, x - 8, y - 14, 6, 14, who[0]);
    rect(ctx, x + 2, y - 14, 6, 14, who[0]);
    capHead(ctx, x, y - 40, 7.5, who[1], who[2]);
  }
}

function bench(ctx: Ctx, x: number, y: number, w: number) {
  rect(ctx, x, y - 34, w, 7, "#7E5C3E");
  rect(ctx, x, y - 24, w, 7, "#7E5C3E");
  rect(ctx, x - 4, y - 12, w + 8, 7, "#946C48");
  rect(ctx, x + 6, y - 5, 5, 6, "#2A2927");
  rect(ctx, x + w - 11, y - 5, 5, 6, "#2A2927");
  rect(ctx, x + 6, y - 36, 4, 26, "#2A2927");
  rect(ctx, x + w - 10, y - 36, 4, 26, "#2A2927");
}

function flowerBed(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rand: () => number) {
  ell(ctx, cx, cy + 4, rx + 6, ry + 6, "#C9C1AE");
  ell(ctx, cx, cy, rx, ry, "#6E5238");
  const cols = ["#C0533F", "#E3B556", "#D98CB0", "#F4F1EA", "#8E6BB0", "#D9773A"];
  for (let r = 0; r < 6; r++) {
    const yy = cy - ry + 14 + r * ((ry * 2 - 20) / 6);
    const half = rx * Math.sqrt(Math.max(0, 1 - ((yy - cy) / ry) ** 2)) - 8;
    for (let xx = cx - half; xx <= cx + half; xx += 10) {
      line(ctx, [xx, yy, xx, yy - 10], "#4F7A5A", 1.6);
      ell(ctx, xx + 3, yy - 6, 3.5, 2, "#5E8A55", 0.6);
      const c = cols[(r + Math.floor((xx - cx) / 30) + 12) % cols.length];
      ell(ctx, xx, yy - 12, 4, 4.4, c);
      if (rand() < 0.4) ell(ctx, xx, yy - 13, 1.4, 1.4, "rgba(255,255,255,.4)");
    }
  }
}

function draw(ctx: Ctx) {
  const rand = rng(31337);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, BW, BH);
  ctx.clip();

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, "#93B5CC");
  sky.addColorStop(1, "#E4E8DA");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, BW, HORIZON);
  ell(ctx, 1250, 56, 46, 46, "rgba(255,246,214,.35)");
  ell(ctx, 1250, 56, 30, 30, "#FBF0C8");
  const cloud = (x: number, y: number, s: number) => {
    for (const [dx, dy, r] of [[0, 0, 26], [28, -12, 30], [58, 0, 24], [30, 8, 26], [-22, 8, 16], [80, 8, 14]])
      ell(ctx, x + dx * s, y + dy * s, r * s * 1.2, r * s * 0.8, "#F6F4EE");
    rect(ctx, x - 24 * s, y + 10 * s, 120 * s, 10 * s, "#F6F4EE");
  };
  cloud(170, 66, 1);
  cloud(600, 50, 0.95);
  cloud(920, 136, 0.85);
  for (const [bx, by] of [[262, 130], [284, 120], [306, 134], [330, 124], [352, 138]]) line(ctx, [bx - 6, by - 4, bx, by, bx + 6, by - 4], "#4A4945", 1.6);
  // hot air balloon
  {
    const bx = 1046;
    const by = 64;
    const cols = ["#B4513A", "#E3B556", "#F4F1EA", "#2D4C9A", "#E3B556", "#B4513A"];
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(bx, by, 40, 48, 0, 0, Math.PI * 2);
    ctx.clip();
    cols.forEach((c, k) => rect(ctx, bx - 40 + k * 13.4, by - 50, 13.6, 100, c));
    ctx.restore();
    poly(ctx, [bx - 30, by + 32, bx + 30, by + 32, bx + 10, by + 62, bx - 10, by + 62], "#B4513A");
    line(ctx, [bx - 10, by + 62, bx - 9, by + 76, bx + 10, by + 62, bx + 9, by + 76], "#3A3631", 1);
    rect(ctx, bx - 11, by + 76, 22, 16, "#8A6440");
    ell(ctx, bx - 4, by + 72, 3.5, 3.5, SKIN[0]);
    ell(ctx, bx + 5, by + 72, 3.5, 3.5, SKIN[2]);
  }

  // the skyline
  for (const h of SKYLINE) {
    const top = HORIZON - h.h;
    rect(ctx, h.x, top, h.w, h.h, h.col);
    poly(ctx, [h.x - 2, top, h.x + h.w / 2, top - 12, h.x + h.w + 2, top], "#8F8C88");
    rect(ctx, h.x + h.w * 0.7, top - 16, 6, 12, "#9C8478");
    for (let wy = top + 6; wy < HORIZON - 8; wy += 12) for (let wx = h.x + 5; wx < h.x + h.w - 6; wx += 11) rect(ctx, wx, wy, 5, 6, "rgba(90,96,104,.45)");
  }
  // church
  rect(ctx, 742, 168, 44, 96, "#C7BBA6");
  poly(ctx, [740, 170, 788, 170, 764, 56], "#8F8C88");
  rect(ctx, 762, 40, 3, 18, "#6E6A64");
  rect(ctx, 757, 46, 13, 3, "#6E6A64");
  ell(ctx, 764, 190, 9, 9, "#F4F1EA");
  line(ctx, [764, 190, 764, 184, 764, 190, 769, 191], "#3A3631", 1.2);
  ctx.fillStyle = "#6E6A64";
  ctx.beginPath();
  ctx.ellipse(764, 222, 6, 10, 0, Math.PI, 0);
  ctx.fill();
  rect(ctx, 758, 222, 12, 12, "#6E6A64");
  rect(ctx, 700, 216, 42, 48, "#BDB19C");
  poly(ctx, [698, 218, 744, 218, 744, 196], "#8F8C88");
  // block of flats
  rect(ctx, 1154, 156, 54, 108, "#A6A49C");
  for (let wy = 164; wy < 256; wy += 12) for (let wx = 1160; wx < 1204; wx += 10) rect(ctx, wx, wy, 6, 7, (wx + wy) % 3 ? "#8E949A" : "#E3D29A");

  // grass
  const grass = ctx.createLinearGradient(0, HORIZON, 0, BH);
  grass.addColorStop(0, "#A9BC86");
  grass.addColorStop(0.5, "#8DA868");
  grass.addColorStop(1, "#6E8E50");
  ctx.fillStyle = grass;
  ctx.fillRect(0, HORIZON - 4, BW, BH - HORIZON + 4);
  for (let k = 0; k < 18; k++) {
    const x = k * 96 - 300;
    poly(ctx, [x, BH, x + 48, BH, x + 348, HORIZON, x + 300, HORIZON], "rgba(255,255,230,.06)");
  }
  for (let k = 0; k < 1500; k++) {
    const x = rand() * BW;
    const y = HORIZON + rand() * (BH - HORIZON);
    const s = 0.5 + (y - HORIZON) / (BH - HORIZON);
    line(ctx, [x, y, x + 1.5 * s, y - 5 * s], k % 3 ? "rgba(50,80,30,.22)" : "rgba(220,235,180,.3)", 1.2);
  }
  for (let k = 0; k < 260; k++) {
    const x = rand() * BW;
    const y = 640 + rand() * (BH - 640);
    ell(ctx, x, y, 2.2, 2.2, k % 4 ? "#F6F4EE" : "#E3C64A");
  }

  // trees
  for (const t of TREES) tree(ctx, t, rand);

  // the pond
  ell(ctx, POND.x, POND.y + 4, POND.rx + 10, POND.ry + 9, "#A49270");
  const water = ctx.createLinearGradient(0, POND.y - POND.ry, 0, POND.y + POND.ry);
  water.addColorStop(0, "#9DBFC6");
  water.addColorStop(1, "#5E8C9A");
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let k = 0; k < 140; k++) {
    const x = POND.x - POND.rx + rand() * POND.rx * 2;
    const y = POND.y - POND.ry + rand() * POND.ry * 2;
    rect(ctx, x, y, 8 + rand() * 14, 1.6, "rgba(255,255,255,.28)");
  }
  ell(ctx, 120, 420, 90, 30, "rgba(100,130,80,.25)");
  ctx.restore();
  // lily pads
  for (const [lx, ly, r] of [[124, 516, 9], [146, 524, 11], [168, 512, 8], [138, 506, 7], [176, 528, 9]]) {
    ell(ctx, lx, ly, r, r * 0.6, "#5E8A55");
    poly(ctx, [lx, ly, lx + r, ly - 2, lx + r, ly + 2], "#7FA0A6");
  }
  ell(ctx, 147, 520, 4, 3, "#E9B8C4");
  ell(ctx, 147, 518, 2, 2, "#F4F1EA");
  // reeds
  for (const [rx0, ry0] of [[506, 466], [66, 566]]) {
    for (let k = 0; k < 9; k++) {
      const x = rx0 + k * 4.5;
      const top = ry0 - 30 - ((k * 13) % 22);
      line(ctx, [x, ry0, x + (k % 3) - 1, top], "#4F7A3E", 2);
      if (k % 3 === 0) rect(ctx, x - 2, top + 2, 4, 12, "#6B4A2E");
    }
  }
  // the rowing boat
  {
    const bx = 250;
    const by = 470;
    poly(ctx, [bx - 50, by - 8, bx + 50, by - 8, bx + 38, by + 12, bx - 40, by + 12], "#8A5A3C");
    rect(ctx, bx - 50, by - 10, 100, 4, "#B07A4E");
    line(ctx, [bx - 30, by - 14, bx - 56, by + 18], "#C9A57A", 3);
    line(ctx, [bx + 26, by - 14, bx + 52, by + 18], "#C9A57A", 3);
    ell(ctx, bx, by - 22, 11, 14, "#2D4C9A");
    capHead(ctx, bx, by - 42, 8, SKIN[3], "#E3B556");
    line(ctx, [bx - 8, by - 26, bx - 28, by - 14], "#2D4C9A", 4);
    line(ctx, [bx + 8, by - 26, bx + 26, by - 14], "#2D4C9A", 4);
    ell(ctx, bx + 30, by - 18, 6, 9, "#C0533F");
    capHead(ctx, bx + 30, by - 32, 6, SKIN[1], "#2A2927");
    ell(ctx, bx - 60, by + 18, 8, 2, "rgba(255,255,255,.4)");
  }
  // toy boat
  poly(ctx, [218, 548, 250, 548, 244, 556, 222, 556], "#B4513A");
  line(ctx, [234, 548, 234, 514], "#3A3631", 1.4);
  poly(ctx, [236, 516, 236, 544, 252, 544], "#F6F4EE");
  poly(ctx, [232, 520, 232, 544, 216, 544], "#E3B556");
  // ducks and swans
  DUCKS.forEach(([x, y, d], k) => {
    if (d === 0) duck(ctx, x, y, 1, 0.55, false);
    else duck(ctx, x, y, d, 1, k % 3 !== 1);
  });
  duck(ctx, 320, 528, 1, 1, false);
  SWANS.forEach(([x, y, d]) => swan(ctx, x, y, d));
  for (const [x, y] of DUCKS) ell(ctx, x, y + 6, 14, 2, "rgba(255,255,255,.3)");
  tree(ctx, WILLOW, rand);

  // the paths
  const pathPts: number[] = [];
  for (let x = -20; x <= BW + 20; x += 16) pathPts.push(x, pathY(x));
  line(ctx, [800, 600, 800, 466], "#B9AA88", 38);
  line(ctx, [1180, 620, 1180, 468], "#B9AA88", 38);
  line(ctx, pathPts, "#B9AA88", PATH_W + 6);
  line(ctx, [800, 600, 800, 466], "#DDD0AE", 32);
  line(ctx, [1180, 620, 1180, 468], "#DDD0AE", 32);
  line(ctx, pathPts, "#DDD0AE", PATH_W);
  for (let k = 0; k < 900; k++) {
    const x = rand() * BW;
    rect(ctx, x, pathY(x) + (rand() - 0.5) * (PATH_W - 6), 2, 2, k % 2 ? "rgba(120,100,70,.3)" : "rgba(255,255,255,.4)");
  }

  // the bandstand
  {
    rect(ctx, 690, 438, 220, 34, "#AE5B42");
    for (let y = 444; y < 472; y += 7) rect(ctx, 690, y, 220, 1, "rgba(60,30,20,.25)");
    for (let k = 0; k < 4; k++) rect(ctx, 700 + k * 56, 446, 20, 22, "#7A3E30");
    rect(ctx, 684, 432, 232, 8, "#D8CBB0");
    // band behind the railings
    const uni = "#2D4C9A";
    const band: [number, string][] = [[730, "tuba"], [772, "drum"], [818, "trumpet"], [862, "trombone"]];
    band.forEach(([bx, inst], k) => {
      ell(ctx, bx, 410, 13, 24, uni);
      ell(ctx, bx, 380, 8, 9, SKIN[(k + 1) % 5]);
      rect(ctx, bx - 9, 366, 18, 6, "#B4513A");
      rect(ctx, bx - 10, 371, 20, 2.5, "#1C1C1A");
      if (inst === "tuba") {
        ell(ctx, bx + 6, 410, 12, 16, "#D9B04A");
        ell(ctx, bx + 4, 392, 10, 6, "#E9C866");
        ell(ctx, bx + 4, 392, 6, 3, "#8A6A2A");
      } else if (inst === "drum") {
        rect(ctx, bx - 16, 404, 32, 26, "#F4F1EA");
        rect(ctx, bx - 16, 404, 32, 4, "#B4513A");
        rect(ctx, bx - 16, 426, 32, 4, "#B4513A");
        line(ctx, [bx - 16, 408, bx, 426, bx + 16, 408], "#D9B04A", 1.4);
      } else if (inst === "trumpet") {
        line(ctx, [bx + 4, 384, bx + 26, 384], "#D9B04A", 3);
        poly(ctx, [bx + 24, 384, bx + 32, 378, bx + 32, 390], "#E9C866");
      } else {
        line(ctx, [bx + 2, 382, bx + 30, 382, bx + 30, 390, bx + 12, 390], "#D9B04A", 2.4);
        poly(ctx, [bx + 30, 382, bx + 38, 376, bx + 38, 388], "#E9C866");
      }
    });
    rect(ctx, 690, 412, 220, 3, "#2F5A3E");
    for (let x = 694; x < 910; x += 8) rect(ctx, x, 412, 2, 22, "#2F5A3E");
    for (let k = 0; k < 6; k++) {
      const cx = 694 + k * 42.4;
      rect(ctx, cx - 3, 344, 6, 90, "#2F5A3E");
      rect(ctx, cx - 5, 344, 10, 5, "#2F5A3E");
      poly(ctx, [cx - 3, 352, cx - 14, 346, cx + 14, 346, cx + 3, 352], "#2F5A3E");
    }
    // roof
    const roofCols = ["#B4513A", "#F4F1EA"];
    for (let k = 0; k < 8; k++) {
      const x0 = 678 + k * 30.5;
      poly(ctx, [x0, 338, x0 + 30.5, 338, 800 + (k - 3) * 2, 274, 800 + (k - 4) * 2, 274], roofCols[k % 2]);
    }
    rect(ctx, 676, 334, 248, 10, "#2F5A3E");
    for (let x = 680; x < 920; x += 12) ell(ctx, x + 6, 344, 6, 4, "#2F5A3E");
    rect(ctx, 796, 256, 8, 20, "#2F5A3E");
    ell(ctx, 800, 254, 6, 6, "#D9B04A");
    // bunting
    for (let k = 0; k < 18; k++) {
      const x0 = 686 + k * 12.6;
      poly(ctx, [x0, 350 + Math.sin(k) * 1.5, x0 + 10, 350, x0 + 5, 360], ["#C0533F", "#E3B556", "#2D4C9A", "#4F7A5A"][k % 4]);
    }
    // the music
    for (const [nx, ny] of [[938, 300], [962, 280], [952, 318], [976, 304]]) {
      ell(ctx, nx, ny, 4.5, 3.4, "#1C1C1A", -0.4);
      line(ctx, [nx + 4, ny - 1, nx + 4, ny - 18, nx + 10, ny - 14], "#1C1C1A", 1.6);
    }
  }
  // deck chairs
  CHAIRS.forEach((x, k) => {
    const who: [string, string, string] | undefined = k === 1 ? undefined : [["#C0533F", "#6B4E7A", "#4F7A5A", "#D9773A"][k], SKIN[k], ["#E3B556", "#2A2927", "#9A9A9A", "#6B4A2E"][k]];
    deckChair(ctx, x, 548, ["#2D4C9A", "#4F7A5A", "#C0533F", "#E3B556"][k], who);
  });

  // the sign, and a girl doing exactly that
  {
    rect(ctx, 588, 440, 5, 116, "#5E4438");
    rect(ctx, 544, 402, 94, 66, "#2F5A3E");
    rect(ctx, 548, 406, 86, 58, "#F4F1EA");
    text(ctx, "PLEASE", 591, 418, 11, "#1C1C1A", "Work Sans", 700);
    text(ctx, "DO NOT FEED", 591, 434, 11, "#1C1C1A", "Work Sans", 700);
    text(ctx, "THE DUCKS", 591, 450, 11, "#B4513A", "Work Sans", 700);
    person(ctx, 638, { coat: "#D98CB0", legs: "#2D4C9A", skin: SKIN[3], hair: "#C9783E", h: 64, feet: 560 });
    line(ctx, [627, 524, 618, 536], "#D98CB0", 5);
    rect(ctx, 612, 534, 8, 5, "#E8C98E");
    duck(ctx, 604, 554, 1, 0.9, true);
    for (const [cx, cy] of [[620, 556], [626, 552], [614, 560]]) ell(ctx, cx, cy, 2, 1.5, "#E8C98E");
  }

  // the playground
  {
    line(ctx, [930, 470, 944, 370, 958, 470], "#C0533F", 5);
    line(ctx, [988, 470, 1002, 370, 1016, 470], "#C0533F", 5);
    line(ctx, [944, 370, 1002, 370], "#C0533F", 5);
    line(ctx, [960, 372, 956, 440, 966, 372, 972, 440], "#3A3631", 1);
    rect(ctx, 952, 440, 24, 5, "#2A2927");
    line(ctx, [982, 372, 990, 430, 988, 372, 996, 430], "#3A3631", 1);
    rect(ctx, 984, 430, 18, 5, "#2A2927");
    ell(ctx, 993, 418, 7, 10, "#E3B556");
    capHead(ctx, 993, 402, 6, SKIN[0], "#6B4A2E");
    line(ctx, [990, 426, 1002, 438], "#2D4C9A", 4);
    line(ctx, [1018, 470, 1018, 392], "#8E949A", 3);
    line(ctx, [1030, 470, 1030, 392], "#8E949A", 3);
    for (let y = 400; y < 470; y += 10) line(ctx, [1018, y, 1030, y], "#8E949A", 2);
    poly(ctx, [1028, 390, 1036, 390, 1066, 464, 1058, 468], "#E3B556");
    rect(ctx, 1016, 388, 18, 5, "#4F7A5A");
    line(ctx, [1056, 468, 1070, 468], "#E3B556", 4);
  }
  bench(ctx, 952, 546, 92);
  sitter(ctx, 996, 534, "#4F7A5A", "#3A3631", SKIN[2], "#9A9A9A");
  rect(ctx, 982, 498, 30, 20, "#ECE8DD");
  for (let k = 0; k < 3; k++) rect(ctx, 985, 502 + k * 5, 24, 1.5, "rgba(28,28,26,.45)");

  // the cafe kiosk
  {
    rect(ctx, 1072, 334, 218, 138, "#E2D3AE");
    for (let y = 340; y < 472; y += 9) rect(ctx, 1072, y, 218, 1, "rgba(80,60,40,.12)");
    rect(ctx, 1062, 324, 238, 12, "#2F5A3E");
    rect(ctx, 1118, 288, 128, 36, "#F4F1EA");
    rect(ctx, 1118, 288, 128, 4, "#2F5A3E");
    text(ctx, "PARK CAFE", 1182, 308, 18, "#2F5A3E", "Libre Caslon Text", 700);
    for (let k = 0; k < 12; k++) {
      const ax = 1074 + k * 18;
      poly(ctx, [ax, 340, ax + 18, 340, ax + 18, 366, ax, 366], k % 2 ? "#F4F1EA" : "#B4513A");
      ell(ctx, ax + 9, 366, 9, 5, k % 2 ? "#F4F1EA" : "#B4513A");
    }
    rect(ctx, 1088, 384, 116, 60, "#5C4632");
    rect(ctx, 1092, 388, 108, 52, "#E9CF96");
    rect(ctx, 1096, 398, 26, 30, "#B9BDBF");
    rect(ctx, 1104, 392, 10, 6, "#8E949A");
    rect(ctx, 1100, 410, 4, 3, "#2A2927");
    ell(ctx, 1144, 410, 12, 16, "#F4F1EA");
    capHead(ctx, 1144, 388, 8, SKIN[4], "#3A2A1E");
    rect(ctx, 1088, 436, 116, 8, "#8A6440");
    ell(ctx, 1176, 428, 14, 4, "#F4F1EA");
    ell(ctx, 1176, 420, 10, 8, "#C08A4A");
    rect(ctx, 1166, 420, 20, 2, "#F4F1EA");
    for (let k = 0; k < 3; k++) {
      rect(ctx, 1124 + k * 9, 428, 7, 8, "#F4F1EA");
    }
    // menu board
    rect(ctx, 1214, 388, 68, 72, "#8A6440");
    rect(ctx, 1218, 392, 60, 64, "#2F3A36");
    ["TEA 1.50", "CAKE 2.80", "SCONE 2.20", "BREAD -", "(DUCKS)"].forEach((s, k) =>
      text(ctx, s, 1248, 402 + k * 12, 8.5, k > 2 ? "#E3B556" : "#F4F1EA", "Courier Prime", 700),
    );
    // ice cream sign
    poly(ctx, [1288, 400, 1302, 400, 1295, 430], "#D9A55E");
    ell(ctx, 1295, 396, 9, 8, "#EEC9CC");
    person(ctx, 1088, { coat: "#4A5F78", legs: "#2A2927", skin: SKIN[0], hair: "#6B4A2E", h: 78, feet: 506 });
  }
  // cafe tables
  for (const [tx, umb] of [[1122, "#2D4C9A"], [1252, "#4F7A5A"]] as const) {
    rect(ctx, tx - 1.5, 486, 3, 46, "#3A3631");
    poly(ctx, [tx - 38, 498, tx + 38, 498, tx, 476], umb);
    for (let k = 0; k < 4; k++) poly(ctx, [tx - 38 + k * 19 + 6, 498, tx - 38 + k * 19 + 12, 498, tx, 476], "#F4F1EA");
    rect(ctx, tx - 22, 530, 44, 5, "#ECE8DD");
    line(ctx, [tx - 16, 535, tx - 18, 560, tx + 16, 535, tx + 18, 560], "#3A3631", 2);
    rect(ctx, tx - 8, 524, 6, 6, "#F4F1EA");
    ell(ctx, tx + 8, 528, 6, 2, "#F4F1EA");
    ell(ctx, tx + 8, 525, 4, 3, "#C9A57A");
  }
  sitter(ctx, 1088, 540, "#C0533F", "#2A2927", SKIN[1], "#2A2927", 0.85);
  sitter(ctx, 1158, 540, "#E3B556", "#4A5F78", SKIN[0], "#9A9A9A", 0.85);
  sitter(ctx, 1286, 540, "#6B4E7A", "#2A2927", SKIN[4], "#C9783E", 0.85);

  // people on the path
  const pf = (x: number) => pathY(x) + 10;
  runner(ctx, 160, pf(160), "#C0533F", "#2A2927", SKIN[1], "#2A2927");
  person(ctx, 384, { coat: "#4F7A5A", legs: "#4A5F78", skin: SKIN[0], hair: "#9A9A9A", arm: "lead", h: 84, feet: pf(384) });
  line(ctx, [398, pf(384) - 40, 420, pf(400) - 16], "#C0533F", 1.2);
  line(ctx, [398, pf(384) - 40, 452, pf(430) - 18], "#2D4C9A", 1.2);
  for (const [dx, col, s] of [[426, "#2A2927", 0.8], [458, "#C9A57A", 1]] as const) {
    const dy = pf(dx) - 6;
    ell(ctx, dx, dy - 8 * s, 14 * s, 7 * s, col);
    ell(ctx, dx + 13 * s, dy - 15 * s, 6 * s, 6 * s, col);
    rect(ctx, dx - 10 * s, dy - 4 * s, 3, 8 * s, col);
    rect(ctx, dx + 7 * s, dy - 4 * s, 3, 8 * s, col);
    line(ctx, [dx - 13 * s, dy - 10 * s, dx - 20 * s, dy - 18 * s], col, 2.4);
  }
  person(ctx, 500, { coat: "#6B4E7A", legs: "#2A2927", skin: SKIN[2], hair: "#2A2927", h: 84, feet: pf(500) });
  {
    const py = pf(540);
    ctx.save();
    ctx.translate(-110, 0);
    ctx.fillStyle = "#2D4C9A";
    ctx.beginPath();
    ctx.moveTo(628, py - 36);
    ctx.lineTo(672, py - 36);
    ctx.quadraticCurveTo(672, py - 14, 650, py - 14);
    ctx.lineTo(634, py - 14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(668, py - 36, 16, Math.PI, Math.PI * 1.5);
    ctx.lineTo(668, py - 36);
    ctx.fill();
    line(ctx, [628, py - 36, 620, py - 50], "#3A3631", 2.4);
    for (const wx of [636, 664]) {
      ctx.strokeStyle = "#3A3631";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, py - 6, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  runner(ctx, 940, pf(940), "#E3B556", "#2D4C9A", SKIN[2], "#1C1C1A");
  person(ctx, 1036, { coat: "#D9773A", legs: "#4A5F78", skin: SKIN[0], hair: "#C9783E", h: 84, feet: pf(1036) });
  person(ctx, 1062, { coat: "#4A5F78", legs: "#2A2927", skin: SKIN[4], hair: "#2A2927", h: 88, feet: pf(1062) });
  line(ctx, [1048, pf(1036) - 46, 1050, pf(1036) - 40], SKIN[0], 4);
  person(ctx, 1300, { coat: "#8E6BB0", legs: "#2A2927", skin: SKIN[3], hair: "#E7E2D5", h: 80, feet: pf(1300) });
  line(ctx, [1316, pf(1300) - 44, 1320, pf(1300)], "#3A3631", 2.4);

  // left flower bed and the gardener
  flowerBed(ctx, 128, 770, 116, 46, rand);
  person(ctx, 264, { coat: "#4F7A5A", legs: "#6B5B48", skin: SKIN[1], hair: "#6B4A2E", h: 98, feet: 798, hat: "#C9A57A" });
  {
    poly(ctx, [290, 752, 352, 752, 342, 782, 300, 782], "#6E7A80");
    ell(ctx, 321, 752, 30, 6, "#6E5238");
    for (const [fx, c] of [[306, "#C0533F"], [318, "#E3B556"], [332, "#D98CB0"]] as const) {
      line(ctx, [fx, 752, fx, 738], "#4F7A5A", 1.6);
      ell(ctx, fx, 736, 4, 4, c);
    }
    ell(ctx, 350, 790, 9, 9, "#2A2927");
    line(ctx, [300, 780, 290, 798, 296, 780, 280, 764], "#3A3631", 3);
    line(ctx, [342, 782, 350, 790], "#3A3631", 3);
  }
  // the boy with the kite
  person(ctx, 404, { coat: "#E3B556", legs: "#2D4C9A", skin: SKIN[2], hair: "#1C1C1A", h: 80, feet: 840, arm: "up" });
  {
    ctx.strokeStyle = "#3A3631";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(424, 760);
    ctx.quadraticCurveTo(520, 380, 466, 110);
    ctx.stroke();
    poly(ctx, [466, 58, 490, 88, 466, 124, 442, 88], "#C0533F");
    poly(ctx, [466, 58, 490, 88, 466, 88], "#2D4C9A");
    poly(ctx, [442, 88, 466, 124, 466, 88], "#2D4C9A");
    line(ctx, [466, 124, 456, 142, 470, 158, 458, 176], "#3A3631", 0.8);
    for (const [bx, by] of [[458, 140], [468, 156], [459, 172]]) ell(ctx, bx, by, 4, 2, "#E3B556", 0.6);
  }

  // the picnic
  {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(452, 730);
    ctx.lineTo(650, 730);
    ctx.lineTo(636, 832);
    ctx.lineTo(434, 832);
    ctx.closePath();
    ctx.fillStyle = "#F4F1EA";
    ctx.fill();
    ctx.clip();
    for (let x = 420; x < 660; x += 24) rect(ctx, x, 720, 12, 120, "rgba(192,83,63,.55)");
    for (let y = 730; y < 840; y += 20) rect(ctx, 420, y, 240, 10, "rgba(192,83,63,.55)");
    ctx.restore();
    sitter(ctx, 560, 750, "#2D4C9A", "#3A3631", SKIN[0], "#6B4A2E");
    sitter(ctx, 604, 752, "#E3B556", "#4F7A5A", SKIN[2], "#1C1C1A");
    sitter(ctx, 538, 770, "#D98CB0", "#2A2927", SKIN[3], "#E3B556", 0.65);
    // basket
    rect(ctx, 474, 750, 46, 30, "#B8925F");
    for (let k = 0; k < 4; k++) rect(ctx, 474, 754 + k * 7, 46, 2, "#8A6440");
    ctx.strokeStyle = "#8A6440";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(497, 752, 16, Math.PI, 0);
    ctx.stroke();
    // food
    for (const [px, py] of [[500, 806], [560, 812], [600, 800]]) ell(ctx, px, py, 14, 6, "#FFFEFA");
    poly(ctx, [492, 806, 508, 806, 500, 798], "#E8C98E");
    ell(ctx, 556, 810, 5, 4, "#C0533F");
    ell(ctx, 566, 811, 5, 4, "#7DB85C");
    rect(ctx, 590, 792, 20, 10, "#F0D2B6");
    rect(ctx, 590, 794, 20, 3, "#D98CB0");
    rect(ctx, 530, 782, 8, 22, "#4F7A5A");
    rect(ctx, 532, 778, 4, 5, "#3A3631");
    rect(ctx, 460, 806, 10, 12, "#F4F1EA");
    rect(ctx, 616, 812, 10, 12, "#F4F1EA");
  }
  // the dog after the sandwiches
  {
    const dx = 664;
    const dy = 822;
    ell(ctx, dx, dy - 10, 20, 10, "#F4F1EA");
    ell(ctx, dx - 6, dy - 12, 8, 6, "#3A3631");
    ell(ctx, dx - 20, dy - 18, 9, 8, "#F4F1EA");
    ell(ctx, dx - 22, dy - 24, 4, 7, "#3A3631", 0.4);
    poly(ctx, [dx - 28, dy - 20, dx - 40, dy - 18, dx - 34, dy - 14], "#E8C98E");
    for (const lx of [dx - 14, dx - 6, dx + 8, dx + 15]) rect(ctx, lx, dy - 4, 3.5, 10, "#F4F1EA");
    line(ctx, [dx + 18, dy - 14, dx + 28, dy - 24], "#F4F1EA", 3);
  }
  // the bench with the old couple, and pigeons
  bench(ctx, 688, 776, 116);
  sitter(ctx, 724, 762, "#8A6440", "#4A5F78", SKIN[0], "#E7E2D5");
  sitter(ctx, 764, 762, "#4A5F78", "#2A2927", SKIN[3], "#E7E2D5");
  rect(ctx, 754, 708, 20, 8, "#2A2927");
  rect(ctx, 750, 714, 28, 2.5, "#2A2927");
  for (const px of [702, 726, 754, 782, 800]) {
    ell(ctx, px, 806, 9, 6, "#8E949A");
    ell(ctx, px + 7, 800, 4.5, 4.5, "#6E747A");
    poly(ctx, [px + 11, 800, px + 15, 801, px + 11, 802], "#C98F5E");
  }
  // sunbather, molehill, frisbee
  {
    poly(ctx, [156, 684, 274, 684, 270, 708, 152, 708], "#2D4C9A");
    for (let k = 0; k < 6; k++) rect(ctx, 160 + k * 19, 684, 8, 24, "rgba(244,241,234,.5)");
    rect(ctx, 186, 690, 60, 12, "#C0533F");
    rect(ctx, 244, 690, 22, 6, SKIN[0]);
    ell(ctx, 176, 696, 9, 8, SKIN[0]);
    ell(ctx, 172, 694, 8, 7, "#E3B556");
    rect(ctx, 166, 690, 16, 4, "#1C1C1A");
    ell(ctx, 694, 690, 18, 8, "#6E5238");
    ell(ctx, 690, 686, 6, 3, "#8A6E50");
    ell(ctx, 1020, 674, 12, 4, "#E3B556");
    ell(ctx, 1020, 673, 7, 2, "#F4E1A6");
    const dx = 968;
    const dy = 708;
    ell(ctx, dx, dy - 10, 18, 8, "#3A3631");
    ell(ctx, dx + 18, dy - 20, 8, 7, "#3A3631");
    poly(ctx, [dx + 22, dy - 24, dx + 32, dy - 22, dx + 24, dy - 16], "#3A3631");
    line(ctx, [dx - 10, dy - 6, dx - 20, dy + 2, dx - 10, dy - 6, dx - 14, dy + 4, dx + 10, dy - 6, dx + 20, dy, dx + 10, dy - 6, dx + 4, dy + 4], "#3A3631", 3.4);
    line(ctx, [dx - 16, dy - 12, dx - 26, dy - 22], "#3A3631", 3);
  }
  // lamp post and bin
  rect(ctx, 841, 640, 8, 196, "#2F3A36");
  rect(ctx, 838, 820, 14, 16, "#2F3A36");
  poly(ctx, [831, 642, 859, 642, 854, 660, 836, 660], "#2F3A36");
  poly(ctx, [835, 642, 855, 642, 851, 622, 839, 622], "#F4E1A6");
  poly(ctx, [833, 622, 857, 622, 845, 610], "#2F3A36");
  rect(ctx, 870, 784, 28, 50, "#3E6E4E");
  rect(ctx, 868, 780, 32, 6, "#2F5A3E");
  rect(ctx, 874, 796, 20, 10, "#F4F1EA");
  text(ctx, "LITTER", 884, 801, 5.5, "#2F5A3E", "Work Sans", 700);
  // football
  for (const [jx, c] of [[912, "#C0533F"], [946, "#C0533F"], [1052, "#2D4C9A"], [1086, "#2D4C9A"]] as const) {
    poly(ctx, [jx - 10, 832, jx + 10, 832, jx + 8, 822, jx - 8, 822], c);
    rect(ctx, jx - 14, 822, 6, 6, c);
    rect(ctx, jx + 8, 822, 6, 6, c);
  }
  runner(ctx, 952, 830, "#C0533F", "#F4F1EA", SKIN[0], "#C9783E", 74);
  person(ctx, 1046, { coat: "#2D4C9A", legs: "#F4F1EA", skin: SKIN[2], hair: "#1C1C1A", h: 72, feet: 830, arm: "up" });
  ell(ctx, 990, 812, 10, 10, "#F4F1EA");
  for (const [bx, by] of [[990, 812], [985, 806], [996, 818]]) ell(ctx, bx, by, 2.6, 2.6, "#1C1C1A");
  // the man asleep under a newspaper
  {
    const y = 742;
    rect(ctx, 1150, y - 8, 70, 16, "#4A5F78");
    ell(ctx, 1150, y, 18, 14, "#8A6440");
    rect(ctx, 1218, y - 5, 18, 10, "#2A2927");
    ell(ctx, 1238, y - 2, 6, 7, "#2A2927");
    rect(ctx, 1106, y - 18, 36, 26, "#ECE8DD");
    rect(ctx, 1108, y - 16, 32, 5, "#1C1C1A");
    for (let k = 0; k < 3; k++) rect(ctx, 1110, y - 8 + k * 5, 28, 1.5, "rgba(28,28,26,.45)");
    text(ctx, "z", 1124, y - 32, 13, "#2D4C9A", "Libre Caslon Text", 400);
    text(ctx, "z", 1134, y - 44, 10, "#2D4C9A", "Libre Caslon Text", 400);
  }
  // squirrel
  {
    const sx = 1248;
    const sy = 716;
    ctx.strokeStyle = "#B5733A";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(sx + 6, sy - 2);
    ctx.quadraticCurveTo(sx + 24, sy - 10, sx + 14, sy - 28);
    ctx.stroke();
    ell(ctx, sx, sy - 8, 7, 9, "#B5733A");
    ell(ctx, sx - 4, sy - 19, 5, 5, "#B5733A");
    poly(ctx, [sx - 6, sy - 22, sx - 4, sy - 28, sx - 2, sy - 22], "#B5733A");
    ell(ctx, sx - 8, sy - 10, 3, 3, "#6B4A2E");
    ell(ctx, sx - 6, sy - 20, 1, 1, "#1C1C1A");
  }
  // right flower bed and the sign
  flowerBed(ctx, 1262, 796, 100, 40, rand);
  rect(ctx, 1316, 720, 4, 44, "#5E4438");
  rect(ctx, 1298, 684, 40, 38, "#F4F1EA");
  rect(ctx, 1298, 684, 40, 3, "#2F5A3E");
  text(ctx, "KEEP", 1318, 694, 8, "#2F5A3E", "Work Sans", 700);
  text(ctx, "OFF THE", 1318, 704, 7, "#2F5A3E", "Work Sans", 700);
  text(ctx, "GRASS", 1318, 714, 8, "#2F5A3E", "Work Sans", 700);

  grain(ctx, rand);
  ctx.restore();
}

export const park: Scene = { title: "The Park", draw, labels: LABELS, landmarks: LANDMARKS };
