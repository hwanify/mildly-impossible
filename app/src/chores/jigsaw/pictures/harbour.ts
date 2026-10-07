// The Harbour: a fishing harbour seen from the near quay, houses stacked up the hill behind, the
// lighthouse on the harbour wall and the boats in between. Busy on purpose, so most pieces can be placed.
import { BW, BH, rng, rect, ell, poly, line, text, person, grain, SKIN, type Box, type Ctx, type PersonOpts, type Scene } from "./common";

const LABELS: Box[] = [];
const lab = (name: string, x: number, y: number, w: number, h: number) => LABELS.push({ x, y, w, h, name });

const HORIZON = 272;
const FAR_QUAY = 384;
const WATER = 402;
const NEAR_QUAY = 712;
const WALL_TOP = 350;
const WALL_X = 968;

const COLOURS: [string, string][] = [
  ["#D8A6A0", "pink"], ["#91A8C0", "blue"], ["#D8AA52", "yellow"], ["#A3B79D", "green"], ["#F4F1EA", "white"],
  ["#B4513A", "red"], ["#E2D3AE", "cream"], ["#D98C5F", "orange"], ["#8FAE8A", "sage"], ["#B9A9C9", "lilac"],
];

type House = { x: number; w: number; base: number; h: number; col: number; roof: "gable" | "flat" | "hip"; tier: number; shop?: string };
const HOUSES: House[] = [];
{
  const r = rng(4242);
  const tiers = [
    { x0: -10, x1: 720, w: 66, h: 64, base: (x: number) => 168 - (700 - x) * 0.1 },
    { x0: -16, x1: 850, w: 80, h: 84, base: (x: number) => 276 - (840 - x) * 0.085 },
  ];
  let c = 0;
  tiers.forEach((t, tier) => {
    for (let x = t.x0; x < t.x1; ) {
      const w = t.w + Math.round((r() - 0.5) * 20);
      if (!(tier === 0 && x + w > 380 && x < 470)) HOUSES.push({ x, w, base: Math.round(t.base(x + w / 2)), h: t.h + Math.round(r() * 16), col: (c = (c + 3 + Math.floor(r() * 3)) % COLOURS.length), roof: r() < 0.6 ? "gable" : r() < 0.5 ? "hip" : "flat", tier });
      x += w;
    }
  });
  const front: [number, string | undefined][] = [[96, "CHANDLERY"], [90, undefined], [104, "THE ANCHOR"], [88, undefined], [100, "GALLERY"], [92, undefined], [108, "POST OFFICE"], [94, undefined], [110, "FISH SHOP"]];
  let x = -6;
  front.forEach(([w, shop], k) => {
    HOUSES.push({ x, w, base: FAR_QUAY, h: 104 + ((k * 7) % 3) * 8, col: (k * 3 + 1) % COLOURS.length, roof: k % 3 === 1 ? "flat" : "gable", tier: 2, shop });
    x += w;
  });
}

type Boat = { x: number; w: number; wl: number; hull: string; trim: string; name: string; mast?: boolean; tilt?: number };
const BOATS: Boat[] = [
  { x: 380, w: 190, wl: 470, hull: "#B03A2E", trim: "#F4F1EA", name: "BRENDA" },
  { x: 900, w: 180, wl: 466, hull: "#D8AA52", trim: "#2A2927", name: "PROBABLY FINE", tilt: -0.05 },
  { x: 110, w: 200, wl: 528, hull: "#2D4C9A", trim: "#F4F1EA", name: "DORIS", mast: true },
  { x: 620, w: 240, wl: 566, hull: "#3E6E4E", trim: "#E3B556", name: "GOOD INTENT", mast: true },
  { x: 1094, w: 230, wl: 604, hull: "#2A3A4E", trim: "#E3B556", name: "KATHLEEN", mast: true },
];

// Names for everything, in the order things are drawn (later ones sit on top).
lab("the harbour", 0, 0, BW, BH);
lab("the sky", 0, 0, BW, HORIZON);
lab("a cloud", 1040, 40, 180, 56);
lab("a cloud", 700, 30, 150, 50);
lab("the hill", 0, 0, 960, FAR_QUAY);
lab("the sea", WALL_X, HORIZON, BW - WALL_X, WALL_TOP - HORIZON);
lab("the ship far out", 1150, 248, 130, 30);
lab("the gulls", 820, 50, 140, 50);
for (const h of HOUSES) {
  const [, cname] = COLOURS[h.col];
  const shopName: Record<string, string> = { CHANDLERY: "the chandlery", "THE ANCHOR": "the pub", GALLERY: "the gallery", "POST OFFICE": "the post office", "FISH SHOP": "the fish shop" };
  const name = h.shop ? shopName[h.shop] : `the ${cname} house`;
  lab(name, Math.max(0, h.x), h.base - h.h - (h.roof === "flat" ? 10 : 30), h.w, h.h + (h.roof === "flat" ? 10 : 30));
}
lab("the church", 372, 14, 96, 128);
lab("the harbour wall", WALL_X, WALL_TOP - 6, BW - WALL_X, 50);
lab("the lighthouse", 984, 100, 70, 260);
lab("the man fishing off the wall", 1180, 290, 60, 64);
lab("the hut on the harbour wall", 1260, 312, 70, 42);
lab("the far quay", 0, FAR_QUAY, WALL_X, 20);
lab("the water", 0, WATER, BW, NEAR_QUAY - WATER);
for (const b of BOATS) lab(`the boat called ${b.name.charAt(0) + b.name.slice(1).toLowerCase().replace(/ (\w)/g, (m) => m)}`, b.x - 10, b.wl - (b.mast ? 130 : 80), b.w + 20, (b.mast ? 130 : 80) + 40);
lab("the rowing boat", 400, 630, 140, 50);
lab("the dinghy", 40, 660, 130, 44);
lab("a buoy", 580, 470, 30, 30);
lab("a buoy", 860, 640, 30, 30);
lab("a buoy", 300, 610, 30, 30);
lab("the swan", 1000, 520, 50, 40);
lab("the kayak", 136, 590, 128, 46);
lab("the ducks", 906, 674, 80, 28);
lab("the seal", 1056, 648, 40, 36);
lab("the near quay", 0, NEAR_QUAY, BW, BH - NEAR_QUAY);
lab("the lobster pots", 0, 730, 150, 134);
lab("the fish crates", 150, 760, 100, 104);
lab("the fishermen", 250, 730, 100, 134);
lab("the nets", 340, 790, 110, 74);
lab("the bollard", 450, 780, 60, 60);
lab("the gull on the bollard", 456, 740, 50, 44);
lab("the painter at the easel", 520, 720, 120, 144);
lab("the bench", 640, 776, 90, 88);
lab("the couple eating chips", 644, 730, 84, 100);
lab("the chip kiosk", 730, 680, 190, 184);
lab("the queue for chips", 910, 740, 50, 124);
lab("the tide times board", 960, 720, 110, 144);
lab("the boy crabbing", 1080, 730, 60, 110);
lab("the bucket of crabs", 1130, 806, 40, 40);
lab("the dog", 1150, 790, 60, 50);
lab("the old anchor", 1210, 760, 70, 104);
lab("the lamp post", 1290, 620, 40, 244);
lab("the woman with the ice cream", 1306, 740, 38, 124);

/** Places worth starting the puzzle from: things you'd find first on the lid. */
const LANDMARKS = [
  { x: 418, y: 96 }, // the church
  { x: 1018, y: 210 }, // the lighthouse
  { x: 210, y: 510 }, // Doris
  { x: 1210, y: 590 }, // Kathleen
  { x: 820, y: 780 }, // the chip kiosk
];

/** The stock person drawn at any size, scaled as a whole so they keep their proportions. */
function small(ctx: Ctx, x: number, feet: number, h: number, o: Omit<PersonOpts, "h" | "feet">) {
  ctx.save();
  ctx.translate(x, feet);
  ctx.scale(h / 112, h / 112);
  person(ctx, 0, { ...o, feet: 0 });
  ctx.restore();
}

function cloud(ctx: Ctx, x: number, y: number, s: number) {
  for (const [dx, dy, r] of [[0, 0, 22], [26, -10, 26], [54, 0, 22], [28, 6, 24], [-20, 6, 14], [76, 6, 12]])
    ell(ctx, x + dx * s, y + dy * s, r * s * 1.2, r * s * 0.75, "#F6F4EE");
}

function gull(ctx: Ctx, x: number, y: number, s = 1) {
  line(ctx, [x - 9 * s, y - 4 * s, x - 3 * s, y - 5 * s, x, y, x + 3 * s, y - 5 * s, x + 9 * s, y - 4 * s], "#4A4945", 1.6);
}

function sittingGull(ctx: Ctx, x: number, y: number, flip = false) {
  const d = flip ? -1 : 1;
  ell(ctx, x, y - 9, 13, 8, "#F4F1EA");
  ell(ctx, x - d * 4, y - 11, 10, 5, "#9EA4AA");
  poly(ctx, [x - d * 10, y - 12, x - d * 20, y - 10, x - d * 10, y - 6], "#3A3631");
  ell(ctx, x + d * 9, y - 19, 6, 6, "#F4F1EA");
  poly(ctx, [x + d * 14, y - 20, x + d * 23, y - 17, x + d * 14, y - 16], "#E3B556");
  ell(ctx, x + d * 10, y - 21, 1.2, 1.2, "#1C1C1A");
  line(ctx, [x - 2, y - 2, x - 2, y + 4], "#E3B556", 1.6);
  line(ctx, [x + 3, y - 2, x + 3, y + 4], "#E3B556", 1.6);
}

function house(ctx: Ctx, h: House) {
  const [wall] = COLOURS[h.col];
  const top = h.base - h.h;
  const roofCol = h.tier === 2 ? "#5F6670" : h.col % 2 ? "#6E6560" : "#5F6670";
  if (h.roof === "gable") {
    poly(ctx, [h.x - 3, top + 2, h.x + h.w / 2, top - 30, h.x + h.w + 3, top + 2], roofCol);
    rect(ctx, h.x + h.w * 0.7, top - 30, 12, 22, "#A65F49");
    rect(ctx, h.x + h.w * 0.7 - 2, top - 33, 16, 4, "#8D857A");
  } else if (h.roof === "hip") {
    poly(ctx, [h.x - 3, top + 2, h.x + 14, top - 22, h.x + h.w - 14, top - 22, h.x + h.w + 3, top + 2], roofCol);
    rect(ctx, h.x + 10, top - 34, 10, 16, "#A65F49");
  } else {
    rect(ctx, h.x - 2, top - 8, h.w + 4, 10, wall);
    rect(ctx, h.x - 3, top - 10, h.w + 6, 4, "#D6D0C2");
  }
  rect(ctx, h.x, top, h.w, h.base - top, wall);
  rect(ctx, h.x + h.w - 3, top, 3, h.base - top, "rgba(28,28,26,.2)");
  rect(ctx, h.x, top, h.w, 4, "rgba(28,28,26,.15)");
  const s = h.tier === 0 ? 0.62 : h.tier === 1 ? 0.8 : 1;
  const ww = 16 * s;
  const wh = 22 * s;
  const cols = Math.max(2, Math.floor((h.w - 10) / (ww + 12 * s)));
  const gap = (h.w - cols * ww) / (cols + 1);
  const rows = h.tier === 2 ? 2 : 2;
  const shopH = h.shop ? 46 : 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const wx = h.x + gap + c * (ww + gap);
      const wy = top + 10 * s + r * (wh + 14 * s);
      if (wy + wh > h.base - shopH - 6) continue;
      const lit = (h.col + r * 3 + c * 5) % 7 === 0;
      rect(ctx, wx - 2, wy - 2, ww + 4, wh + 4, "#EFEBE1");
      rect(ctx, wx, wy, ww, wh, lit ? "#D9BB7E" : "#4E5A63");
      rect(ctx, wx, wy + wh / 2 - 0.8, ww, 1.6, "#EFEBE1");
      if ((h.col + c + r) % 5 === 1) rect(ctx, wx - 2, wy + wh + 2, ww + 4, 3, ["#C0533F", "#E3B556", "#D98CB0"][(c + r) % 3]);
    }
  if (h.tier > 0 && !h.shop) {
    const dx = h.x + h.w / 2 - 8 * s;
    rect(ctx, dx, h.base - 26 * s, 16 * s, 26 * s, ["#2D4C9A", "#B03A2E", "#2F5D4A", "#3A3631", "#E3B556"][h.col % 5]);
  }
  if (h.shop) {
    rect(ctx, h.x + 4, h.base - 46, h.w - 8, 16, "#2A2927");
    text(ctx, h.shop, h.x + h.w / 2, h.base - 38, h.shop.length > 9 ? 9 : 10.5, "#F4E1A6", "Libre Caslon Text", 700);
    rect(ctx, h.x + 6, h.base - 28, h.w - 34, 28, "#5C6A72");
    rect(ctx, h.x + h.w - 24, h.base - 28, 16, 28, "#5C4632");
    if (h.shop === "FISH SHOP") for (let k = 0; k < 4; k++) ell(ctx, h.x + 16 + k * 16, h.base - 14, 7, 3, "#B9C7CC");
    if (h.shop === "GALLERY") for (let k = 0; k < 3; k++) rect(ctx, h.x + 12 + k * 20, h.base - 24, 14, 12, ["#E3B556", "#91A8C0", "#B4513A"][k]);
    if (h.shop === "THE ANCHOR") {
      rect(ctx, h.x + h.w - 30, h.base - 80, 22, 26, "#2A2927");
      line(ctx, [h.x + h.w - 19, h.base - 76, h.x + h.w - 19, h.base - 60], "#E3B556", 2);
      line(ctx, [h.x + h.w - 26, h.base - 64, h.x + h.w - 19, h.base - 58, h.x + h.w - 12, h.base - 64], "#E3B556", 2);
    }
    if (h.shop === "POST OFFICE") rect(ctx, h.x + h.w / 2 - 6, h.base - 26, 12, 22, "#B8352A");
    if (h.shop === "CHANDLERY") for (let k = 0; k < 3; k++) ell(ctx, h.x + 18 + k * 18, h.base - 14, 6, 6, ["#D98C5F", "#F4F1EA", "#B03A2E"][k]);
  }
}

function boat(ctx: Ctx, b: Boat, rand: () => number) {
  const { x, w, wl } = b;
  ctx.save();
  ctx.translate(x + w / 2, wl);
  if (b.tilt) ctx.rotate(b.tilt);
  const hw = w / 2;
  // reflection
  ctx.save();
  ctx.globalAlpha = 0.22;
  poly(ctx, [-hw + 8, 2, hw - 4, 2, hw - 18, 30, -hw + 24, 30], b.hull);
  rect(ctx, -hw * 0.3, 30, w * 0.26, 24, "#F4F1EA");
  ctx.restore();
  for (let k = 0; k < 5; k++) rect(ctx, -hw + rand() * w, 8 + k * 9, 20 + rand() * 30, 1.6, "rgba(255,255,255,.3)");
  // hull
  ctx.fillStyle = b.hull;
  ctx.beginPath();
  ctx.moveTo(-hw, -34);
  ctx.lineTo(hw + 10, -40);
  ctx.quadraticCurveTo(hw - 4, -6, hw - 22, 2);
  ctx.lineTo(-hw + 18, 2);
  ctx.quadraticCurveTo(-hw + 2, -8, -hw, -34);
  ctx.fill();
  rect(ctx, -hw, -38, w + 8, 5, b.trim);
  rect(ctx, -hw + 14, -6, w - 34, 4, "rgba(0,0,0,.25)");
  text(ctx, b.name, -hw * 0.25, -20, b.name.length > 10 ? 11 : 13, b.trim, "Work Sans", 700);
  text(ctx, `PZ ${(b.name.length * 37) % 300}`, hw - 30, -20, 8, b.trim, "Work Sans", 600);
  for (let k = 0; k < 3; k++) ell(ctx, -hw + 20 + k * 22, -6, 8, 4, ["#F4F1EA", "#D98C5F", "#F4F1EA"][k]);
  // wheelhouse
  const wx = hw * 0.25;
  rect(ctx, wx, -78, 46, 40, "#F4F1EA");
  rect(ctx, wx - 3, -82, 52, 6, "#3A3631");
  for (let k = 0; k < 3; k++) rect(ctx, wx + 5 + k * 13, -70, 10, 12, "#4E5A63");
  if (b.mast) {
    rect(ctx, -hw * 0.45, -130, 4, 92, "#6B5B48");
    line(ctx, [-hw * 0.45 + 2, -128, -hw + 4, -38], "#3A3631", 0.8);
    line(ctx, [-hw * 0.45 + 2, -128, wx, -80], "#3A3631", 0.8);
    rect(ctx, -hw * 0.45 - 12, -104, 28, 3, "#6B5B48");
    poly(ctx, [-hw * 0.45 + 4, -130, -hw * 0.45 + 22, -124, -hw * 0.45 + 4, -118], b.trim === "#2A2927" ? "#B03A2E" : b.trim);
  }
  // gear on deck
  for (let k = 0; k < 2; k++) {
    const px = -hw + 30 + k * 26;
    rect(ctx, px, -54, 22, 16, "#7A5A3C");
    for (let s = 0; s < 3; s++) rect(ctx, px + 2 + s * 7, -54, 1.4, 16, "#C9B79A");
  }
  ell(ctx, wx + 64, -44, 10, 6, "#4F7A5A");
  ctx.restore();
}

function lobsterPot(ctx: Ctx, x: number, y: number) {
  rect(ctx, x - 22, y - 26, 44, 26, "#5A4A3A");
  ctx.fillStyle = "#6B5B48";
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 26);
  ctx.quadraticCurveTo(x, y - 46, x + 22, y - 26);
  ctx.fill();
  for (let k = -18; k <= 18; k += 6) line(ctx, [x + k, y - 2, x + k * 0.9, y - 26 - (1 - (k / 22) ** 2) * 18], "#B9A07A", 1);
  for (let yy = y - 6; yy > y - 36; yy -= 8) line(ctx, [x - 20, yy, x + 20, yy], "#B9A07A", 0.8);
  ell(ctx, x, y - 12, 6, 6, "#2A2927");
  rect(ctx, x - 22, y - 2, 44, 3, "#3A3631");
}

/** Draws the whole picture into ctx, in world units (0..BW, 0..BH). Same picture every time. */
function draw(ctx: Ctx) {
  const rand = rng(86420);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, BW, BH);
  ctx.clip();

  // sky and the sea beyond the wall
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, "#9DBBD0");
  sky.addColorStop(1, "#E5E3D6");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, BW, HORIZON);
  ell(ctx, 1260, 150, 30, 30, "rgba(255,248,220,.8)");
  cloud(ctx, 1070, 70, 1.3);
  cloud(ctx, 724, 52, 1);
  cloud(ctx, 1240, 210, 0.7);
  for (const [gx, gy, s] of [[830, 80, 1], [860, 66, 1.2], [896, 86, 0.9], [930, 70, 1.1], [1180, 120, 0.8]]) gull(ctx, gx, gy, s);
  const sea = ctx.createLinearGradient(0, HORIZON, 0, WALL_TOP);
  sea.addColorStop(0, "#4E7590");
  sea.addColorStop(1, "#6E98A8");
  ctx.fillStyle = sea;
  ctx.fillRect(WALL_X - 40, HORIZON, BW, WALL_TOP - HORIZON + 10);
  for (let k = 0; k < 120; k++) {
    const x = WALL_X - 20 + rand() * (BW - WALL_X + 20);
    const y = HORIZON + 4 + rand() * (WALL_TOP - HORIZON - 6);
    line(ctx, [x, y, x + 5, y - 1.5, x + 10, y], "rgba(255,255,255,.25)", 1);
  }
  poly(ctx, [1156, 268, 1278, 268, 1270, 276, 1164, 276], "#3A3631");
  rect(ctx, 1240, 254, 24, 14, "#E2D3AE");
  rect(ctx, 1176, 258, 50, 10, "#B4513A");
  rect(ctx, 1250, 246, 6, 8, "#3A3631");
  poly(ctx, [1084, 300, 1112, 300, 1108, 306, 1088, 306], "#F4F1EA");
  poly(ctx, [1098, 298, 1098, 276, 1110, 298], "#F4F1EA");

  // the hill
  ctx.fillStyle = "#8FA878";
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.bezierCurveTo(260, 22, 560, 50, 760, 120);
  ctx.bezierCurveTo(880, 170, 940, 260, 990, FAR_QUAY + 10);
  ctx.lineTo(0, FAR_QUAY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let k = 0; k < 160; k++) ell(ctx, rand() * 980, 20 + rand() * 360, 8 + rand() * 8, 6 + rand() * 4, k % 3 ? "#7A9866" : "#A3B48A");
  for (let k = 0; k < 14; k++) {
    const tx = 40 + rand() * 900;
    const ty = 60 + rand() * 260;
    rect(ctx, tx - 1.5, ty, 3, 12, "#6B5B48");
    ell(ctx, tx, ty - 4, 10, 12, "#5E7E52");
  }
  ctx.restore();
  // the church on top
  {
    const x = 380;
    ctx.save();
    ctx.translate(0, 22);
    rect(ctx, x, 64, 80, 54, "#D6D0C2");
    poly(ctx, [x - 4, 66, x + 40, 36, x + 84, 66], "#5F6670");
    rect(ctx, x + 54, 30, 26, 88, "#D6D0C2");
    poly(ctx, [x + 50, 32, x + 67, -4, x + 84, 32], "#5F6670");
    line(ctx, [x + 67, -2, x + 67, 12], "#3A3631", 1.6);
    line(ctx, [x + 62, 4, x + 72, 4], "#3A3631", 1.6);
    ell(ctx, x + 67, 48, 7, 7, "#F4F1EA");
    line(ctx, [x + 67, 48, x + 67, 43, x + 67, 48, x + 70, 49], "#1C1C1A", 1.2);
    for (let k = 0; k < 3; k++) {
      rect(ctx, x + 8 + k * 15, 80, 8, 18, "#4E5A63");
      ell(ctx, x + 12 + k * 15, 80, 4, 4, "#4E5A63");
    }
    rect(ctx, x + 60, 96, 14, 22, "#5C4632");
    ctx.restore();
  }

  // houses, back to front
  for (const h of HOUSES) house(ctx, h);
  // washing between two houses
  line(ctx, [250, 182, 318, 186], "#3A3631", 0.8);
  for (let k = 0; k < 5; k++) rect(ctx, 256 + k * 12, 183, 8, 12, ["#C0533F", "#F4F1EA", "#2D4C9A", "#E3B556", "#F4F1EA"][k]);

  // far quay
  rect(ctx, 0, FAR_QUAY, 1000, WATER - FAR_QUAY, "#9A9284");
  for (let x = 0; x < 1000; x += 26) rect(ctx, x, FAR_QUAY, 1.5, WATER - FAR_QUAY, "rgba(40,36,30,.3)");
  rect(ctx, 0, FAR_QUAY, 1000, 3, "#C9C2B4");
  for (const [px, c, s] of [[120, "#B03A2E", 0], [196, "#2D4C9A", 2], [262, "#E3B556", 3], [430, "#4F7A5A", 1], [520, "#6B4E7A", 4], [610, "#D98C5F", 0], [700, "#3E6E8E", 2], [868, "#B4513A", 3]] as const)
    small(ctx, px, FAR_QUAY, 34, { coat: c, legs: "#2A2927", skin: SKIN[s], hair: s % 2 ? "#1C1C1A" : "#6B4A2E" });

  // harbour wall and lighthouse
  {
    poly(ctx, [WALL_X, WALL_TOP, BW, WALL_TOP - 4, BW, 406, WALL_X - 20, 406], "#8A8376");
    rect(ctx, WALL_X, WALL_TOP - 6, BW - WALL_X, 8, "#B3AA99");
    for (let x = WALL_X; x < BW; x += 30) for (let y = WALL_TOP + 2; y < 406; y += 14) rect(ctx, x + ((y / 14) % 2) * 15, y, 1.4, 14, "rgba(40,36,30,.35)");
    for (let y = WALL_TOP + 16; y < 406; y += 14) rect(ctx, WALL_X - 10, y, BW, 1.4, "rgba(40,36,30,.3)");
    for (let x = WALL_X + 20; x < BW; x += 40) rect(ctx, x, WALL_TOP - 14, 4, 10, "#3A3631");
    // the hut
    rect(ctx, 1268, WALL_TOP - 36, 56, 32, "#2D4C9A");
    poly(ctx, [1262, WALL_TOP - 34, 1296, WALL_TOP - 50, 1330, WALL_TOP - 34], "#B4513A");
    rect(ctx, 1278, WALL_TOP - 28, 12, 10, "#F4F1EA");
    rect(ctx, 1300, WALL_TOP - 30, 12, 26, "#F4F1EA");
    // fisherman on the wall
    small(ctx, 1200, WALL_TOP - 4, 50, { coat: "#E3B556", legs: "#2A2927", skin: SKIN[0], hair: "#C9C2B4", hat: "#E3B556" });
    line(ctx, [1210, WALL_TOP - 30, 1244, WALL_TOP - 66], "#3A3631", 1.4);
    line(ctx, [1244, WALL_TOP - 66, 1252, WALL_TOP + 58], "#3A3631", 0.5);
    // the lighthouse
    const lx = 1018;
    poly(ctx, [lx - 26, WALL_TOP - 4, lx + 26, WALL_TOP - 4, lx + 17, 150, lx - 17, 150], "#F4F1EA");
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lx - 26, WALL_TOP - 4);
    ctx.lineTo(lx + 26, WALL_TOP - 4);
    ctx.lineTo(lx + 17, 150);
    ctx.lineTo(lx - 17, 150);
    ctx.closePath();
    ctx.clip();
    for (const by of [180, 240, 300]) rect(ctx, lx - 30, by, 60, 26, "#B03A2E");
    rect(ctx, lx + 6, 150, 20, 200, "rgba(28,28,26,.12)");
    ctx.restore();
    rect(ctx, lx - 4, 210, 8, 12, "#3E4B55");
    rect(ctx, lx - 4, 270, 8, 12, "#3E4B55");
    rect(ctx, lx - 6, WALL_TOP - 26, 12, 22, "#2F3A36");
    rect(ctx, lx - 24, 144, 48, 8, "#2F3A36");
    for (let k = 0; k < 5; k++) rect(ctx, lx - 22 + k * 11, 134, 1.6, 10, "#2F3A36");
    rect(ctx, lx - 13, 116, 26, 28, "#F4E1A6");
    for (let k = 0; k < 3; k++) rect(ctx, lx - 13 + k * 12, 116, 2, 28, "#2F3A36");
    poly(ctx, [lx - 18, 116, lx + 18, 116, lx, 98], "#B03A2E");
    ell(ctx, lx, 96, 4, 4, "#2F3A36");
    poly(ctx, [lx + 13, 122, lx + 90, 104, lx + 90, 140, lx + 13, 138], "rgba(255,248,210,.35)");
  }

  // the water
  const water = ctx.createLinearGradient(0, WATER, 0, NEAR_QUAY);
  water.addColorStop(0, "#6E98A0");
  water.addColorStop(1, "#3C6478");
  ctx.fillStyle = water;
  ctx.fillRect(0, WATER, BW, NEAR_QUAY - WATER);
  // reflections of the front houses and the lighthouse
  for (const h of HOUSES.filter((h) => h.tier === 2)) {
    for (let y = WATER; y < WATER + 90; y += 6) {
      const wob = Math.sin(y / 5 + h.x) * 3;
      rect(ctx, h.x + 4 + wob, y, h.w - 8, 4, COLOURS[h.col][0]);
    }
  }
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = water;
  ctx.fillRect(0, WATER, BW, 92);
  ctx.restore();
  for (let y = 410; y < 520; y += 7) {
    const wob = Math.sin(y / 4) * 3;
    rect(ctx, 1000 + wob, y, 36, 4, y % 3 ? "rgba(244,241,234,.35)" : "rgba(176,58,46,.3)");
  }
  for (let k = 0; k < 420; k++) {
    const y = WATER + 4 + rand() * (NEAR_QUAY - WATER - 8);
    const t = (y - WATER) / (NEAR_QUAY - WATER);
    const x = rand() * BW;
    const w = 8 + t * 22;
    line(ctx, [x, y, x + w / 2, y - 1 - t * 2, x + w, y], k % 3 ? "rgba(255,255,255,.2)" : "rgba(20,40,60,.18)", 1 + t);
  }
  // buoys
  for (const [bx, by, c] of [[594, 488, "#D98C5F"], [874, 658, "#E3B556"], [314, 628, "#B03A2E"]] as const) {
    ell(ctx, bx, by + 4, 14, 4, "rgba(255,255,255,.35)");
    ell(ctx, bx, by - 4, 9, 9, c);
    ell(ctx, bx - 3, by - 7, 2.5, 2.5, "rgba(255,255,255,.5)");
  }
  // the swan
  ell(ctx, 1022, 548, 16, 8, "#F4F1EA");
  line(ctx, [1030, 544, 1034, 530, 1030, 522], "#F4F1EA", 4);
  poly(ctx, [1030, 520, 1040, 523, 1030, 525], "#D98C5F");
  ell(ctx, 1022, 556, 20, 3, "rgba(255,255,255,.3)");
  // boats
  for (const b of BOATS) boat(ctx, b, rand);
  // gulls on Good Intent
  sittingGull(ctx, 676, 524);
  sittingGull(ctx, 700, 524, true);
  // the rowing boat
  {
    small(ctx, 468, 666, 48, { coat: "#B03A2E", legs: "#2A2927", skin: SKIN[2], hair: "#1C1C1A", hat: "#2D4C9A" });
    poly(ctx, [404, 652, 534, 652, 520, 670, 418, 670], "#A86E35");
    rect(ctx, 404, 650, 130, 4, "#F4F1EA");
    ell(ctx, 470, 676, 70, 5, "rgba(255,255,255,.3)");
    line(ctx, [446, 644, 404, 680], "#8A6440", 2.5);
    line(ctx, [490, 644, 532, 680], "#8A6440", 2.5);
    text(ctx, "LITTLE ERIC", 470, 662, 7, "#F4F1EA", "Work Sans", 700);
  }
  // the kayak, the ducks and the seal
  ell(ctx, 200, 622, 58, 7, "#D98C5F");
  ell(ctx, 200, 618, 12, 4, "#2A2927");
  small(ctx, 200, 628, 40, { coat: "#4F7A5A", legs: "#2A2927", skin: SKIN[0], hair: "#6B4A2E" });
  ell(ctx, 200, 622, 58, 6, "#D98C5F");
  line(ctx, [172, 596, 228, 616], "#3A3631", 2);
  ell(ctx, 172, 596, 5, 2.5, "#E3B556", 0.35);
  ell(ctx, 228, 616, 5, 2.5, "#E3B556", 0.35);
  ell(ctx, 200, 632, 64, 4, "rgba(255,255,255,.3)");
  for (const [dx, dy] of [[920, 690], [948, 684], [972, 694]]) {
    ell(ctx, dx, dy, 9, 5, "#8A6A44");
    ell(ctx, dx + 7, dy - 6, 4, 4, "#3E6E4E");
    poly(ctx, [dx + 10, dy - 6, dx + 15, dy - 5, dx + 10, dy - 4], "#E3B556");
  }
  ell(ctx, 1076, 666, 10, 12, "#6E6A62");
  ell(ctx, 1080, 662, 1.5, 1.5, "#1C1C1A");
  ell(ctx, 1072, 662, 1.5, 1.5, "#1C1C1A");
  ell(ctx, 1076, 668, 3, 2, "#3A3631");
  ell(ctx, 1076, 678, 18, 4, "rgba(255,255,255,.35)");
  // the dinghy, tied up
  poly(ctx, [44, 684, 164, 684, 152, 700, 56, 700], "#E2D3AE");
  rect(ctx, 44, 682, 120, 4, "#2D4C9A");
  ell(ctx, 104, 706, 64, 4, "rgba(255,255,255,.3)");
  rect(ctx, 80, 676, 40, 8, "#D98C5F");

  // the near quay
  rect(ctx, 0, NEAR_QUAY, BW, 22, "#6E6A62");
  for (let x = 0; x < BW; x += 42) rect(ctx, x, NEAR_QUAY, 1.5, 22, "rgba(20,20,20,.35)");
  rect(ctx, 0, NEAR_QUAY, BW, 3, "#9A9284");
  rect(ctx, 0, NEAR_QUAY + 22, BW, BH - NEAR_QUAY - 22, "#C3BBAA");
  for (let y = NEAR_QUAY + 22; y < BH; y += 24) {
    rect(ctx, 0, y, BW, 1.5, "rgba(60,56,50,.22)");
    for (let x = ((y / 24) % 2) * 30; x < BW; x += 60) rect(ctx, x, y, 1.5, 24, "rgba(60,56,50,.2)");
  }
  for (let k = 0; k < 300; k++) rect(ctx, rand() * BW, NEAR_QUAY + 22 + rand() * 120, 2, 2, "rgba(60,56,50,.1)");
  line(ctx, [140, 690, 150, 714, 172, 744], "#D9C29A", 2);

  // lobster pots
  for (const [px, py] of [[28, 800], [76, 800], [124, 800], [52, 770], [100, 770], [76, 740], [30, 864], [80, 864], [128, 864]]) lobsterPot(ctx, px, py);
  for (const [fx, fy, c] of [[20, 820, "#D98C5F"], [140, 818, "#E3B556"], [102, 830, "#D98C5F"]] as const) ell(ctx, fx, fy, 8, 6, c);
  // fish crates
  for (let k = 0; k < 4; k++) {
    const cy = 856 - k * 24;
    const cx = 170 + (k % 2) * 6;
    rect(ctx, cx, cy - 24, 70, 24, k % 2 ? "#2D6E8E" : "#D98C5F");
    rect(ctx, cx + 4, cy - 20, 62, 3, "rgba(255,255,255,.3)");
    if (k === 3) for (let f = 0; f < 4; f++) ell(ctx, cx + 12 + f * 15, cy - 26, 8, 3.5, "#9FB0B8", 0.2);
  }
  text(ctx, "J.TREGEAR", 206, 850, 8, "#F4F1EA", "Work Sans", 700);
  // fishermen
  for (const [fx, s, hat] of [[278, 1, "#E3B556"], [322, 3, "#1C1C1A"]] as const) {
    small(ctx, fx, 856, 122, { coat: "#E3B556", legs: "#E3B556", skin: SKIN[s], hair: "#6B4A2E", hat });
    rect(ctx, fx - 9, 840, 7, 14, "#2A2927");
    rect(ctx, fx + 2, 840, 7, 14, "#2A2927");
  }
  rect(ctx, 296, 780, 16, 12, "#F4F1EA");
  // nets
  ctx.fillStyle = "#4F7A5A";
  ctx.beginPath();
  ctx.moveTo(344, 862);
  ctx.quadraticCurveTo(350, 800, 396, 796);
  ctx.quadraticCurveTo(446, 800, 450, 862);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let k = 0; k < 14; k++) line(ctx, [344 + k * 8, 864, 364 + k * 6, 796], "rgba(255,255,255,.25)", 1);
  for (let k = 0; k < 14; k++) line(ctx, [344 + k * 8, 796, 330 + k * 9, 864], "rgba(0,0,0,.2)", 1);
  ctx.restore();
  ell(ctx, 420, 830, 30, 14, "#D98C5F");
  for (let k = 0; k < 6; k++) ell(ctx, 358 + k * 16, 812 + (k % 2) * 20, 5, 5, ["#E3B556", "#F4F1EA", "#B03A2E"][k % 3]);
  // bollard and the gull
  rect(ctx, 462, 800, 34, 34, "#2A2927");
  ell(ctx, 479, 800, 22, 8, "#2A2927");
  ell(ctx, 479, 798, 18, 5, "#3A3631");
  line(ctx, [470, 810, 440, 716, 400, 680], "#C9B79A", 2.2);
  sittingGull(ctx, 480, 792);
  // the painter
  {
    line(ctx, [586, 862, 600, 760, 614, 862], "#8A6440", 3);
    line(ctx, [600, 760, 600, 862], "#8A6440", 3);
    rect(ctx, 572, 752, 64, 52, "#F4F1EA");
    rect(ctx, 576, 756, 56, 16, "#9DBBD0");
    rect(ctx, 576, 772, 56, 14, "#D8A6A0");
    rect(ctx, 590, 772, 12, 14, "#91A8C0");
    rect(ctx, 604, 772, 12, 14, "#E3B556");
    rect(ctx, 576, 786, 56, 14, "#5E8EA0");
    poly(ctx, [600, 794, 620, 794, 616, 798, 604, 798], "#B03A2E");
    small(ctx, 546, 864, 116, { coat: "#6B4E7A", legs: "#2A2927", skin: SKIN[0], hair: "#C9C2B4", arm: "up" });
    rect(ctx, 534, 750, 24, 6, "#2A2927");
    rect(ctx, 538, 744, 16, 6, "#2A2927");
    line(ctx, [566, 788, 580, 780], "#8A6440", 2);
  }
  // bench and the couple with chips
  for (const [cx, coat, s, hair] of [[664, "#2D4C9A", 1, "#1C1C1A"], [706, "#B4513A", 3, "#E3B556"]] as const) {
    ell(ctx, cx, 790, 14, 26, coat);
    rect(ctx, cx - 10, 806, 24, 10, coat);
    rect(ctx, cx + 6, 812, 8, 34, "#2A2927");
    ell(ctx, cx, 754, 10, 12, SKIN[s]);
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(cx, 750, 11, 10, 0, Math.PI, 0);
    ctx.fill();
    rect(ctx, cx - 4, 784, 16, 12, "#F4F1EA");
    for (let k = 0; k < 4; k++) rect(ctx, cx - 2 + k * 3, 778, 2, 8, "#E3C76A");
  }
  rect(ctx, 646, 814, 84, 8, "#8A6440");
  rect(ctx, 646, 798, 84, 6, "#8A6440");
  rect(ctx, 652, 822, 5, 30, "#2A2927");
  rect(ctx, 720, 822, 5, 30, "#2A2927");
  sittingGull(ctx, 690, 856, true);
  // the chip kiosk
  {
    const x = 740;
    rect(ctx, x, 724, 170, 136, "#F4F1EA");
    for (let k = 0; k < 170; k += 10) rect(ctx, x + k, 724, 1.2, 136, "rgba(28,28,26,.1)");
    poly(ctx, [x - 10, 726, x + 180, 726, x + 168, 694, x + 2, 694], "#2D4C9A");
    for (let k = 0; k < 9; k++) {
      const ax = x - 6 + k * 21;
      poly(ctx, [ax, 726, ax + 21, 726, ax + 21, 740, ax, 740], k % 2 ? "#F4F1EA" : "#B03A2E");
      ell(ctx, ax + 10.5, 740, 10.5, 4, k % 2 ? "#F4F1EA" : "#B03A2E");
    }
    text(ctx, "CHIPS & ICES", x + 85, 710, 15, "#F4F1EA", "Libre Caslon Text", 700);
    rect(ctx, x + 10, 752, 96, 52, "#3A3631");
    ell(ctx, x + 50, 774, 10, 11, SKIN[4]);
    ell(ctx, x + 50, 768, 11, 6, "#F4F1EA");
    rect(ctx, x + 38, 784, 24, 20, "#F4F1EA");
    rect(ctx, x + 72, 778, 26, 22, "#B9BDBF");
    rect(ctx, x + 6, 804, 104, 6, "#8A6440");
    for (let k = 0; k < 3; k++) {
      poly(ctx, [x + 16 + k * 14, 804, x + 24 + k * 14, 804, x + 20 + k * 14, 796], "#D9A55E");
      ell(ctx, x + 20 + k * 14, 793, 5, 4, ["#F4F1EA", "#D8A6A0", "#A3B79D"][k]);
    }
    rect(ctx, x + 114, 750, 50, 76, "#2A2927");
    const menu: [string, string][] = [["CHIPS", "3.20"], ["CRAB", "6.50"], ["COD", "8.90"], ["CONE", "2.80"], ["PASTY", "4.10"]];
    menu.forEach(([a, b], k) => {
      text(ctx, a, x + 128, 760 + k * 12, 7, "#F4F1EA", "Courier Prime", 700);
      text(ctx, b, x + 152, 760 + k * 12, 7, "#E3B556", "Courier Prime", 700);
    });
    rect(ctx, x + 10, 820, 100, 34, "#B03A2E");
    text(ctx, "DO NOT FEED", x + 60, 831, 8, "#F4F1EA", "Work Sans", 700);
    text(ctx, "THE GULLS", x + 60, 844, 8, "#F4F1EA", "Work Sans", 700);
    sittingGull(ctx, x + 40, 694);
  }
  small(ctx, 934, 862, 112, { coat: "#3E6E4E", legs: "#4A5F78", skin: SKIN[1], hair: "#1C1C1A", arm: "phone" });
  // tide board
  {
    const x = 968;
    rect(ctx, x + 6, 800, 6, 62, "#3A3631");
    rect(ctx, x + 88, 800, 6, 62, "#3A3631");
    rect(ctx, x, 724, 100, 82, "#2D4C9A");
    rect(ctx, x + 4, 728, 92, 74, "#F4F1EA");
    text(ctx, "TIDE TIMES", x + 50, 738, 10, "#2D4C9A", "Libre Caslon Text", 700);
    text(ctx, "HIGH 06:12", x + 50, 754, 8.5, "#1C1C1A", "Courier Prime", 700);
    text(ctx, "LOW  12:26", x + 50, 766, 8.5, "#1C1C1A", "Courier Prime", 700);
    text(ctx, "HIGH 18:40", x + 50, 778, 8.5, "#1C1C1A", "Courier Prime", 700);
    text(ctx, "SUBJECT TO MOON", x + 50, 792, 7, "#B03A2E", "Courier Prime", 700);
  }
  // the boy crabbing
  small(ctx, 1104, 840, 80, { coat: "#E3B556", legs: "#2D4C9A", skin: SKIN[3], hair: "#C9783E" });
  line(ctx, [1116, 788, 1132, 760, 1140, 720], "#B03A2E", 1);
  line(ctx, [1140, 720, 1142, 712], "#B03A2E", 1);
  poly(ctx, [1136, 820, 1162, 820, 1158, 844, 1140, 844], "#B03A2E");
  rect(ctx, 1136, 818, 26, 4, "#F4F1EA");
  for (let k = 0; k < 3; k++) ell(ctx, 1142 + k * 7, 818, 4, 3, "#B4513A");
  // the dog
  ell(ctx, 1180, 832, 20, 10, "#F4F1EA");
  ell(ctx, 1174, 830, 8, 6, "#3A3631");
  ell(ctx, 1200, 820, 9, 8, "#F4F1EA");
  ell(ctx, 1206, 820, 5, 4, "#3A3631");
  ell(ctx, 1196, 814, 4, 7, "#3A3631", 0.4);
  for (const lx of [1166, 1174, 1188, 1194]) line(ctx, [lx, 838, lx, 852], "#F4F1EA", 4);
  line(ctx, [1162, 828, 1152, 818], "#F4F1EA", 3);
  // the old anchor
  {
    const ax = 1244;
    rect(ctx, ax - 4, 772, 8, 80, "#3A3631");
    ctx.strokeStyle = "#3A3631";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ax, 768, 8, 0, Math.PI * 2);
    ctx.stroke();
    rect(ctx, ax - 22, 788, 44, 7, "#3A3631");
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(ax, 822, 30, 0.2, Math.PI - 0.2);
    ctx.stroke();
    poly(ctx, [ax - 36, 822, ax - 26, 812, ax - 22, 830], "#3A3631");
    poly(ctx, [ax + 36, 822, ax + 26, 812, ax + 22, 830], "#3A3631");
    rect(ctx, ax - 30, 852, 60, 10, "#8A8376");
  }
  // lamp post and the woman with the ice cream
  {
    const lx = 1300;
    rect(ctx, lx - 4, 640, 8, 222, "#2F3A36");
    rect(ctx, lx - 7, 842, 14, 20, "#2F3A36");
    poly(ctx, [lx - 14, 642, lx + 14, 642, lx + 9, 658, lx - 9, 658], "#2F3A36");
    poly(ctx, [lx - 10, 642, lx + 10, 642, lx + 6, 624, lx - 6, 624], "#F4E1A6");
    poly(ctx, [lx - 12, 624, lx + 12, 624, lx, 612], "#2F3A36");
    rect(ctx, lx - 22, 690, 44, 20, "#B03A2E");
    ell(ctx, lx + 20, 700, 14, 6, "#F4F1EA");
    ell(ctx, lx + 20, 700, 5, 2, "#B03A2E");
    small(ctx, 1326, 864, 116, { coat: "#D8A6A0", legs: "#2A2927", skin: SKIN[2], hair: "#3A2A1E", arm: "up" });
    poly(ctx, [1340, 744, 1350, 744, 1345, 758], "#D9A55E");
    ell(ctx, 1345, 742, 6, 5, "#F4F1EA");
  }

  grain(ctx, rand);
  ctx.restore();
}

export const harbour: Scene = { title: "The Harbour", draw, labels: LABELS, landmarks: LANDMARKS };
