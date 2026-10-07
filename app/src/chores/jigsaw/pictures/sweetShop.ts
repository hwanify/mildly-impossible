// The Sweet Shop: an old-fashioned sweet shop from behind the till's side of the room, all jars,
// with the shopkeeper, a child at the counter, a cat in the window and the street outside.
import { BW, BH, rng, rect, ell, poly, line, text, grain, SKIN, type Box, type Ctx, type Scene } from "./common";

const LABELS: Box[] = [];
const lab = (name: string, x: number, y: number, w: number, h: number) => LABELS.push({ x, y, w, h, name });

const CEIL = 24;
const ROW_TOPS = [30, 130, 230, 330, 430];
const ROWH = 90;
const PLANK = 10;
const SH_L = 18;
const SH_R = 882;
const BAYS: [number, number][] = [[SH_L + 10, 446], [458, SH_R - 10]];
const COUNTER = { x: 150, w: 730, top: 552 };
const FLOOR = 812;
const WIN = { x: 900, y: 90, w: 270, h: 410 };
const DOOR = { x: 1190, y: 170, w: 144 };

type Shape = "round" | "big" | "humbug" | "drop" | "cube" | "wrapped" | "stick" | "disc" | "baby" | "twist" | "powder" | "bean" | "empty";
type Sweet = { name: string; tag: string; shape: Shape; cols: string[] };
const SWEETS: Sweet[] = [
  { name: "humbugs", tag: "HUMBUGS", shape: "humbug", cols: ["#1C1C1A", "#4A3226"] },
  { name: "sherbet lemons", tag: "SHERBET LEMONS", shape: "drop", cols: ["#F2D24A", "#E8C23A"] },
  { name: "pear drops", tag: "PEAR DROPS", shape: "drop", cols: ["#E7A0B0", "#F2D24A"] },
  { name: "cola cubes", tag: "COLA CUBES", shape: "cube", cols: ["#8A4A2E", "#A85A34"] },
  { name: "aniseed balls", tag: "ANISEED BALLS", shape: "round", cols: ["#7A2E2E", "#5A2020"] },
  { name: "gobstoppers", tag: "GOB- STOPPERS", shape: "big", cols: ["#C0533F", "#7DB0D8", "#F2D24A", "#7DA05A", "#D98CB0"] },
  { name: "jelly babies", tag: "JELLY BABIES", shape: "baby", cols: ["#C0533F", "#F2D24A", "#7DA05A", "#E08A3E", "#D98CB0", "#2A2927"] },
  { name: "liquorice", tag: "LIQUORICE", shape: "twist", cols: ["#1C1C1A", "#2A2927"] },
  { name: "fudge", tag: "FUDGE", shape: "cube", cols: ["#D9B07A", "#C99A5E"] },
  { name: "toffees", tag: "TOFFEES", shape: "wrapped", cols: ["#C9A23F", "#B4513A"] },
  { name: "mint imperials", tag: "MINT IMPERIALS", shape: "round", cols: ["#FFFEFA", "#E6E2D6"] },
  { name: "flying saucers", tag: "FLYING SAUCERS", shape: "disc", cols: ["#E7A0B0", "#F2D24A", "#9FD0E0", "#F4F1EA"] },
  { name: "rhubarb and custards", tag: "RHUBARB & CUSTARD", shape: "drop", cols: ["#D98C9C", "#F2D24A"] },
  { name: "chocolate limes", tag: "CHOC LIMES", shape: "drop", cols: ["#8FBF6A", "#A3CC80"] },
  { name: "bonbons", tag: "BON BONS", shape: "powder", cols: ["#F4C2CF", "#FFFEFA", "#F2D24A"] },
  { name: "barley sugar", tag: "BARLEY SUGAR", shape: "stick", cols: ["#E8A84A", "#D9963A"] },
  { name: "coconut mushrooms", tag: "COCONUT MUSHROOMS", shape: "round", cols: ["#F0D2B6", "#E7A0B0"] },
  { name: "fruit salads", tag: "FRUIT SALADS", shape: "wrapped", cols: ["#E7A0B0", "#F2D24A"] },
  { name: "blackjacks", tag: "BLACK JACKS", shape: "wrapped", cols: ["#1C1C1A", "#6B4E7A"] },
  { name: "jelly beans", tag: "JELLY BEANS", shape: "bean", cols: ["#C0533F", "#F2D24A", "#7DA05A", "#E08A3E", "#D98CB0", "#FFFEFA", "#6B4E7A"] },
  { name: "cough candy", tag: "COUGH CANDY", shape: "stick", cols: ["#C97A5A", "#B4663E"] },
  { name: "midget gems", tag: "MIDGET GEMS", shape: "round", cols: ["#C0533F", "#7DA05A", "#F2D24A", "#E08A3E", "#1C1C1A"] },
  { name: "rock", tag: "ROCK", shape: "stick", cols: ["#E7A0B0", "#F4F1EA"] },
  { name: "chocolate buttons", tag: "CHOC BUTTONS", shape: "disc", cols: ["#6B4A36", "#5A3A2A"] },
];
const EMPTY: Sweet = { name: "nothing", tag: "EMPTY", shape: "empty", cols: [] };

type Jar = { x: number; base: number; w: number; h: number; s: Sweet; lid: string; lvl: number; price?: string };
const LIDS = ["#B4513A", "#C9A23F", "#1C1C1A", "#F4F1EA", "#2F5D4A", "#B4513A", "#C9A23F"];
const JARS: Jar[] = (() => {
  const rand = rng(5150);
  const out: Jar[] = [];
  let prev = -1;
  ROW_TOPS.forEach((top, r) => {
    const base = top + ROWH;
    for (const [l, rgt] of BAYS) {
      const row: Jar[] = [];
      let x = l + 3;
      for (;;) {
        const w = 50 + Math.floor(rand() * 14);
        if (x + w > rgt) break;
        let si = Math.floor(rand() * SWEETS.length);
        if (si === prev) si = (si + 5) % SWEETS.length;
        prev = si;
        const h = 62 + Math.floor(rand() * 24);
        row.push({ x, base, w, h, s: SWEETS[si], lid: LIDS[Math.floor(rand() * LIDS.length)], lvl: 0.4 + rand() * 0.55, price: rand() < 0.45 ? `${[8, 10, 12, 15, 18, 20, 25, 30][Math.floor(rand() * 8)]}p` : undefined });
        x += w + 6;
      }
      const spare = rgt - x;
      row.forEach((j, i) => (j.x += (spare * i) / Math.max(1, row.length - 1)));
      out.push(...row);
    }
  });
  const e = out[Math.floor(out.length * 0.45)];
  e.s = EMPTY;
  e.price = "FREE";
  return out;
})();

// Names for everything, in the order things are drawn (later ones sit on top).
lab("the wall", 0, 0, BW, BH);
lab("the shelves", SH_L, ROW_TOPS[0] - 6, SH_R - SH_L, ROW_TOPS[4] + ROWH + PLANK - ROW_TOPS[0] + 6);
for (const j of JARS) lab(j.s === EMPTY ? "the empty jar" : `a jar of ${j.s.name}`, j.x - 2, j.base - j.h - 2, j.w + 4, j.h + 16);
lab("the gumball machine", 18, 596, 86, 256);
lab("the shop sign", 900, 34, 270, 46);
lab("the clock", 1218, 38, 88, 92);
lab("the shop window", WIN.x, WIN.y, WIN.w, WIN.h);
lab("the street outside", WIN.x + 10, WIN.y + 10, WIN.w - 20, WIN.h - 20);
lab("the post office across the road", 990, 170, 140, 120);
lab("the man with the umbrella", 930, 330, 60, 130);
lab("the bike", 1060, 410, 90, 60);
lab("the letters on the window", WIN.x + 20, WIN.y + 24, WIN.w - 40, 56);
lab("the window ledge", WIN.x - 10, 490, WIN.w + 20, 36);
lab("the jar of rock in the window", 912, 384, 64, 116);
lab("the tins of toffee", 988, 444, 70, 56);
lab("the cat in the window", 1074, 404, 92, 130);
lab("the door", DOOR.x, DOOR.y, DOOR.w, FLOOR - DOOR.y);
lab("the CLOSED sign", 1226, 288, 92, 64);
lab("the shop bell", 1190, 140, 64, 76);
lab("the door handle", 1196, 500, 30, 40);
lab("the floor", 0, FLOOR, BW, BH - FLOOR);
lab("the counter", COUNTER.x, COUNTER.top, COUNTER.w, FLOOR - COUNTER.top + 10);
lab("the pick and mix", 180, 590, 670, 170);
lab("the shopkeeper", 488, 350, 152, 210);
lab("the jar the shopkeeper is holding", 580, 452, 64, 72);
lab("the paper bags", 160, 488, 70, 66);
lab("the scales", 232, 440, 150, 116);
lab("the brass weights", 330, 500, 54, 54);
lab("the bell on the counter", 410, 520, 44, 34);
lab("the till", 652, 430, 146, 124);
lab("the lollipops", 806, 420, 80, 136);
lab("the chalkboard", 900, 576, 210, 280);
lab("the child at the counter", 66, 640, 106, 216);
lab("the coin", 150, 540, 30, 22);
lab("the doormat", 1196, 822, 136, 40);
lab("the shop cat's bowl", 1110, 822, 60, 26);
lab("the dropped lollipop", 540, 830, 64, 30);
lab("the notice on the counter", 530, 774, 120, 26);

/** Places worth starting the puzzle from: things you'd find first on the lid. */
const LANDMARKS = [
  { x: 220, y: 170 }, // the jars
  { x: 560, y: 410 }, // the shopkeeper
  { x: 110, y: 700 }, // the child
  { x: 1035, y: 140 }, // the window letters
  { x: 1005, y: 710 }, // the chalkboard
];

function rrPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  rrPath(ctx, x, y, w, h, r);
  ctx.fill();
}
function ring(ctx: Ctx, x: number, y: number, r: number, stroke: string, w: number) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function sweetsIn(ctx: Ctx, s: Sweet, x: number, top: number, w: number, bottom: number, rand: () => number) {
  if (s.shape === "empty") return;
  rect(ctx, x, top, w, bottom - top, s.cols[1] ?? s.cols[0]);
  const step = s.shape === "big" ? 12 : s.shape === "stick" ? 6 : 8;
  let k = 0;
  for (let y = bottom - step / 2; y > top - step / 2; y -= step * 0.8)
    for (let px = x + ((y / step) % 2) * (step / 2) - 2; px < x + w + 2; px += step) {
      const c = s.cols[(k++ + Math.floor(rand() * 3)) % s.cols.length];
      const jx = px + (rand() - 0.5) * 3;
      const jy = y + (rand() - 0.5) * 3;
      switch (s.shape) {
        case "round": ell(ctx, jx, jy, 4, 4, c); ell(ctx, jx - 1.3, jy - 1.3, 1.2, 1.2, "rgba(255,255,255,.4)"); break;
        case "big": ell(ctx, jx, jy, 6.5, 6.5, c); ell(ctx, jx - 2, jy - 2, 2, 2, "rgba(255,255,255,.45)"); break;
        case "humbug": ell(ctx, jx, jy, 5, 3.6, c, rand()); line(ctx, [jx - 3, jy - 1, jx + 3, jy + 1], "#F4F1EA", 1); break;
        case "drop": ell(ctx, jx, jy, 4.5, 3.4, c, rand() * 3); if (s.name.startsWith("rhubarb")) ell(ctx, jx + 1.5, jy, 2.4, 2.6, "#F2D24A"); break;
        case "cube": rect(ctx, jx - 3.5, jy - 3.5, 7, 7, c); rect(ctx, jx - 3.5, jy - 3.5, 7, 1.5, "rgba(255,255,255,.3)"); break;
        case "wrapped": rect(ctx, jx - 3, jy - 2.5, 6, 5, c); poly(ctx, [jx - 3, jy, jx - 6, jy - 3, jx - 6, jy + 3], c); poly(ctx, [jx + 3, jy, jx + 6, jy - 3, jx + 6, jy + 3], c); break;
        case "stick": rect(ctx, jx - 1.8, top - 6 + (k % 3) * 3, 3.6, bottom - top + 6, c); if (s.name === "rock") rect(ctx, jx - 1.8, top - 6 + (k % 3) * 3, 3.6, 3, "#F4F1EA"); break;
        case "disc": ell(ctx, jx, jy, 5, 2.5, c); break;
        case "baby": ell(ctx, jx, jy + 1, 3, 3.6, c); ell(ctx, jx, jy - 3.5, 2.2, 2.2, c); break;
        case "twist": line(ctx, [jx - 4, jy + 4, jx + 4, jy - 4], c, 3); break;
        case "powder": ell(ctx, jx, jy, 4.5, 4.5, c); ell(ctx, jx + 1, jy + 1, 1, 1, "rgba(255,255,255,.8)"); break;
        case "bean": ell(ctx, jx, jy, 3.6, 2.4, c, rand() * 3); break;
      }
    }
}

function wrapTag(s: string, maxChars: number) {
  const out: string[] = [];
  for (const word of s.split(" ")) {
    const last = out[out.length - 1];
    if (last && (last + " " + word).length <= maxChars) out[out.length - 1] = last + " " + word;
    else out.push(word);
  }
  return out;
}

function jar(ctx: Ctx, j: Jar, rand: () => number) {
  const top = j.base - j.h;
  const neck = 12;
  const gy = top + neck;
  rr(ctx, j.x, gy, j.w, j.h - neck, 7, "rgba(214,228,226,.55)");
  ctx.save();
  rrPath(ctx, j.x, gy, j.w, j.h - neck, 7);
  ctx.clip();
  const fillTop = gy + (j.h - neck) * (1 - j.lvl);
  sweetsIn(ctx, j.s, j.x, fillTop, j.w, j.base, rand);
  ctx.restore();
  rect(ctx, j.x + j.w * 0.18, top + 4, j.w * 0.64, neck - 2, "rgba(214,228,226,.6)");
  rect(ctx, j.x + j.w * 0.14, top - 2, j.w * 0.72, 9, j.lid);
  rect(ctx, j.x + j.w * 0.14, top + 2, j.w * 0.72, 1.4, "rgba(0,0,0,.2)");
  rect(ctx, j.x + 4, gy + 6, 3, j.h - neck - 14, "rgba(255,255,255,.5)");
  rect(ctx, j.x + j.w - 8, gy + 8, 2, j.h - neck - 20, "rgba(255,255,255,.25)");
  // the label
  const lines = wrapTag(j.s.tag, Math.floor((j.w - 8) / 4.4));
  const lh = 9;
  const lw = j.w - 8;
  const ly = gy + (j.h - neck) * 0.42 - (lines.length * lh) / 2;
  rect(ctx, j.x + 4, ly - 3, lw, lines.length * lh + 6, "#F7F0DA");
  rect(ctx, j.x + 4, ly - 3, lw, 1.5, j.lid === "#F4F1EA" ? "#B4513A" : j.lid);
  lines.forEach((s, k) => text(ctx, s, j.x + j.w / 2, ly + 4 + k * lh, s.length > 9 ? 6.4 : 7.4, "#2D4C9A", "Courier Prime", 700));
  if (j.price) {
    line(ctx, [j.x + j.w / 2 - 6, j.base + 2, j.x + j.w / 2 - 4, j.base + 6], "#3A3631", 0.8);
    rect(ctx, j.x + j.w / 2 - 12, j.base + 4, 22, 11, "#FFFEFA");
    text(ctx, j.price, j.x + j.w / 2 - 1, j.base + 10, 7.5, "#B4513A", "Courier Prime", 700);
  }
}

function street(ctx: Ctx, x: number, y: number, w: number, h: number, rand: () => number) {
  const sky = ctx.createLinearGradient(0, y, 0, y + 120);
  sky.addColorStop(0, "#A9C3D3");
  sky.addColorStop(1, "#DDE5E0");
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  // houses across the road
  const fronts: [number, string][] = [[900, "#AE5B42"], [990, "#E2D3AE"], [1130, "#91A8C0"], [1240, "#D8AA52"]];
  for (const [fx, c] of fronts) {
    const fw = fx === 990 ? 140 : 110;
    rect(ctx, fx, 150, fw, 270, c);
    rect(ctx, fx, 144, fw, 8, "#5F6670");
    for (let k = 0; k < 3; k++) {
      rect(ctx, fx + 12 + k * (fw / 3), 186, fw / 3 - 22, 44, "#EFEBE1");
      rect(ctx, fx + 15 + k * (fw / 3), 189, fw / 3 - 28, 38, k % 2 ? "#56636D" : "#C9A46A");
    }
    if (c === "#AE5B42") for (let yy = 156; yy < 420; yy += 7) rect(ctx, fx, yy, fw, 1, "rgba(60,30,20,.2)");
  }
  rect(ctx, 990, 250, 140, 26, "#B03A2E");
  text(ctx, "POST OFFICE", 1060, 263, 13, "#FFFEFA", "Libre Caslon Text", 700);
  rect(ctx, 1000, 290, 60, 120, "#5C6A72");
  rect(ctx, 1076, 290, 40, 130, "#2F5D4A");
  ell(ctx, 1108, 356, 2.5, 2.5, "#E3B556");
  rect(ctx, 1150, 330, 30, 90, "#7A2E2E");
  // pavement, kerb and road
  rect(ctx, x, 420, w, 40, "#CBC7BE");
  for (let px = 880; px < 1340; px += 40) rect(ctx, px, 420, 1.4, 40, "rgba(80,76,70,.25)");
  rect(ctx, x, 458, w, 4, "#E2DED6");
  rect(ctx, x, 462, w, 60, "#5B5955");
  for (let k = 0; k < 80; k++) rect(ctx, x + rand() * w, 462 + rand() * 40, 2, 2, "rgba(255,255,255,.08)");
  rect(ctx, x, 488, w, 3, "#E3B54A");
  // post box and the man with the umbrella
  rect(ctx, 1136, 380, 22, 50, "#B8352A");
  ell(ctx, 1147, 380, 12, 6, "#B8352A");
  rect(ctx, 1141, 392, 12, 3, "#2A2927");
  const px = 958;
  rect(ctx, px - 7, 404, 6, 48, "#2A2927");
  rect(ctx, px + 2, 404, 6, 48, "#2A2927");
  rr(ctx, px - 13, 362, 26, 50, 6, "#4F7A5A");
  ell(ctx, px, 352, 9, 10, SKIN[1]);
  line(ctx, [px + 10, 372, px + 18, 360, px + 18, 336], "#4F7A5A", 5);
  line(ctx, [px + 18, 340, px + 18, 314], "#2A2927", 1.6);
  ctx.fillStyle = "#B4513A";
  ctx.beginPath();
  ctx.ellipse(px + 18, 316, 34, 20, 0, Math.PI, 0);
  ctx.fill();
  for (let k = -1; k <= 1; k++) line(ctx, [px + 18, 296, px + 18 + k * 22, 316], "rgba(0,0,0,.15)", 1);
  // a bike against the post office
  for (const wx of [1072, 1124]) ring(ctx, wx, 448, 15, "#1C1C1A", 2.5);
  line(ctx, [1072, 448, 1096, 448, 1114, 426, 1084, 426, 1072, 448], "#2D4C9A", 2.5);
  line(ctx, [1096, 448, 1084, 420, 1124, 448, 1114, 420], "#2D4C9A", 2.5);
  line(ctx, [1078, 420, 1090, 420], "#1C1C1A", 3);
  rect(ctx, 1108, 410, 14, 10, "#B8925F");
}

/** Draws the whole picture into ctx, in world units (0..BW, 0..BH). Same picture every time. */
function draw(ctx: Ctx) {
  const rand = rng(8642);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, BW, BH);
  ctx.clip();

  // candy-striped wall
  rect(ctx, 0, 0, BW, FLOOR, "#EBD8D0");
  for (let x = 0; x < BW; x += 28) rect(ctx, x, 0, 12, FLOOR, "#E2C5BD");
  for (let x = 6; x < BW; x += 28) for (let y = 14 + ((x / 28) % 2) * 20; y < FLOOR; y += 40) ell(ctx, x, y, 1.6, 1.6, "rgba(180,81,58,.35)");
  rect(ctx, 0, 0, BW, CEIL, "#2F5D4A");
  rect(ctx, 0, CEIL, BW, 4, "#C9A23F");
  for (let x = 10; x < BW; x += 40) poly(ctx, [x, CEIL + 4, x + 20, CEIL + 4, x + 10, CEIL + 14], "#2F5D4A");

  // the shelves
  rect(ctx, SH_L, ROW_TOPS[0] - 6, SH_R - SH_L, ROW_TOPS[4] + ROWH + PLANK - ROW_TOPS[0] + 6, "#E9DCC4");
  for (let x = SH_L; x < SH_R; x += 22) rect(ctx, x, ROW_TOPS[0], 1.2, 500, "rgba(120,90,60,.15)");
  for (const top of ROW_TOPS) {
    rect(ctx, SH_L, top - 6, SH_R - SH_L, 8, "rgba(0,0,0,.08)");
    rect(ctx, SH_L, top + ROWH, SH_R - SH_L, PLANK, "#8A6440");
    rect(ctx, SH_L, top + ROWH, SH_R - SH_L, 2, "#A27B52");
  }
  for (const ux of [SH_L, 446, SH_R - 10]) rect(ctx, ux, ROW_TOPS[0] - 6, ux === 446 ? 12 : 10, 520, "#7A5236");
  rect(ctx, SH_L - 6, ROW_TOPS[0] - 10, SH_R - SH_L + 12, 8, "#6B4A36");
  for (const j of JARS) jar(ctx, j, rand);

  // gumball machine by the shelves
  {
    rect(ctx, 52, 740, 12, 104, "#B4513A");
    ell(ctx, 58, 846, 30, 7, "#8A2B22");
    rr(ctx, 30, 676, 56, 70, 8, "#B4513A");
    rect(ctx, 44, 698, 28, 22, "#C9CCCB");
    ell(ctx, 58, 709, 8, 8, "#9EA3A3");
    rect(ctx, 50, 726, 16, 10, "#2A2927");
    text(ctx, "1p", 58, 688, 9, "#F4F1EA", "Work Sans", 700);
    ell(ctx, 58, 640, 38, 38, "rgba(214,228,226,.65)");
    ctx.save();
    ctx.beginPath();
    ctx.arc(58, 640, 36, 0, Math.PI * 2);
    ctx.clip();
    for (let y = 672; y > 618; y -= 9) for (let x = 24 + ((y / 9) % 2) * 4; x < 96; x += 9) ell(ctx, x, y, 4.4, 4.4, ["#C0533F", "#F2D24A", "#7DB0D8", "#7DA05A", "#F4F1EA", "#D98CB0"][Math.floor(rand() * 6)]);
    ctx.restore();
    ell(ctx, 44, 624, 8, 5, "rgba(255,255,255,.45)", -0.6);
    rect(ctx, 46, 600, 24, 6, "#B4513A");
  }

  // the right-hand wall: panelling, sign, clock, window and door
  {
    rect(ctx, 888, 520, BW - 888, FLOOR - 520, "#2F5D4A");
    for (const px of [904, 1012]) {
      rect(ctx, px, 560, 90, 220, "#3E7560");
      rect(ctx, px + 6, 566, 78, 208, "#2F5D4A");
    }
    rect(ctx, 888, 520, BW - 888, 6, "#C9A23F");
    rect(ctx, 900, 36, 270, 44, "#1C1C1A");
    rect(ctx, 904, 40, 262, 36, "#2F5D4A");
    text(ctx, "M. PARFITT & DAUGHTER", 1035, 52, 12, "#E3B556", "Libre Caslon Text", 700);
    text(ctx, "CONFECTIONERS  EST. 1931", 1035, 68, 8, "#F4F1EA", "Work Sans", 600);
    // clock
    ell(ctx, 1262, 84, 40, 40, "#6B4A36");
    ell(ctx, 1262, 84, 33, 33, "#FFFEFA");
    for (let k = 0; k < 12; k++) rect(ctx, 1262 + Math.cos(k * 0.5236) * 27 - 1.2, 84 + Math.sin(k * 0.5236) * 27 - 1.2, 2.4, 2.4, "#1C1C1A");
    line(ctx, [1262, 84, 1262, 62], "#1C1C1A", 2.4);
    line(ctx, [1262, 84, 1278, 92], "#1C1C1A", 3);
    // window
    rect(ctx, WIN.x, WIN.y, WIN.w, WIN.h, "#EFEBE1");
    ctx.save();
    ctx.beginPath();
    ctx.rect(WIN.x + 10, WIN.y + 10, WIN.w - 20, WIN.h - 20);
    ctx.clip();
    street(ctx, WIN.x + 10, WIN.y + 10, WIN.w - 20, WIN.h - 20, rand);
    // gold letters, back to front from in here
    ctx.save();
    ctx.translate(WIN.x + WIN.w / 2, WIN.y + 56);
    ctx.scale(-1, 1);
    text(ctx, "SWEETS", 0, 0, 40, "#C9A23F", "Libre Caslon Text", 700);
    text(ctx, "& TOBACCONIST", 0, 30, 12, "#C9A23F", "Work Sans", 700);
    ctx.restore();
    poly(ctx, [940, 500, 1000, 100, 1020, 100, 960, 500], "rgba(255,255,255,.1)");
    ctx.restore();
    for (const bx of [WIN.x + WIN.w / 3, WIN.x + (2 * WIN.w) / 3]) rect(ctx, bx - 3, WIN.y, 6, WIN.h, "#EFEBE1");
    rect(ctx, WIN.x, WIN.y + 150, WIN.w, 6, "#EFEBE1");
    // the door
    const { x: dx, y: dy, w: dw } = DOOR;
    rect(ctx, dx - 6, dy - 6, dw + 12, FLOOR - dy + 6, "#1C1C1A");
    rect(ctx, dx, dy, dw, FLOOR - dy, "#7A2E2E");
    rect(ctx, dx + 16, dy + 30, dw - 32, 240, "#EFEBE1");
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx + 20, dy + 34, dw - 40, 232);
    ctx.clip();
    street(ctx, dx + 20, dy + 34, dw - 40, 232, rand);
    ctx.restore();
    rect(ctx, dx + dw / 2 - 2, dy + 30, 4, 240, "#EFEBE1");
    for (const py of [dy + 300, dy + 460]) {
      rect(ctx, dx + 16, py, dw - 32, 140, "#6A2626");
      rect(ctx, dx + 22, py + 6, dw - 44, 128, "#7A2E2E");
    }
    rect(ctx, dx + 40, dy + 430, 64, 12, "#C9A23F");
    rect(ctx, dx + 46, dy + 434, 52, 4, "#1C1C1A");
    ell(ctx, dx + 18, 520, 8, 8, "#C9A23F");
    rect(ctx, dx + 14, 520, 8, 14, "#C9A23F");
    // the sign on the door
    line(ctx, [1250, 270, 1272, 290, 1294, 270], "#3A3631", 1.2);
    rect(ctx, 1228, 290, 88, 58, "#FFFEFA");
    rect(ctx, 1232, 294, 80, 50, "#2F5D4A");
    text(ctx, "CLOSED", 1272, 312, 15, "#FFFEFA", "Libre Caslon Text", 700);
    text(ctx, "(from outside: OPEN)", 1272, 332, 6.5, "#E3B556", "Courier Prime", 700);
    // the bell
    line(ctx, [1194, 150, 1222, 150], "#C9A23F", 3);
    ctx.strokeStyle = "#C9A23F";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let k = 0; k <= 30; k++) {
      const t = k / 30;
      const yy = 150 + t * 34;
      const xx = 1222 + Math.sin(t * Math.PI * 6) * 5;
      if (k === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.fillStyle = "#C9A23F";
    ctx.beginPath();
    ctx.moveTo(1210, 206);
    ctx.quadraticCurveTo(1210, 184, 1222, 184);
    ctx.quadraticCurveTo(1234, 184, 1234, 206);
    ctx.closePath();
    ctx.fill();
    rect(ctx, 1206, 204, 32, 4, "#A9852E");
    ell(ctx, 1222, 210, 3, 3, "#A9852E");
    ell(ctx, 1216, 192, 3, 5, "rgba(255,255,255,.35)");
  }

  // the window ledge: rock, toffee tins and the cat
  {
    rect(ctx, WIN.x - 10, 498, WIN.w + 20, 14, "#8A6440");
    rect(ctx, WIN.x - 10, 512, WIN.w + 20, 4, "rgba(0,0,0,.2)");
    rr(ctx, 916, 400, 56, 98, 8, "rgba(214,228,226,.55)");
    for (let k = 0; k < 9; k++) {
      rect(ctx, 922 + k * 5.4, 386 + (k % 3) * 6, 4.4, 110 - (k % 3) * 6, k % 2 ? "#E7A0B0" : "#F2B8C6");
      rect(ctx, 922 + k * 5.4, 386 + (k % 3) * 6, 4.4, 3, "#F4F1EA");
    }
    rect(ctx, 920, 440, 48, 20, "#F7F0DA");
    text(ctx, "ROCK", 944, 450, 9, "#2D4C9A", "Courier Prime", 700);
    for (let k = 0; k < 3; k++) {
      const ty = 498 - (k + 1) * 18;
      const tx = 990 + (k % 2) * 6;
      rect(ctx, tx, ty, 62 - k * 6, 18, ["#B4513A", "#2D4C9A", "#C9A23F"][k]);
      rect(ctx, tx, ty, 62 - k * 6, 3, "rgba(255,255,255,.25)");
      text(ctx, "TOFFEE", tx + (62 - k * 6) / 2, ty + 10, 8, "#F4F1EA", "Work Sans", 700);
    }
    // cat sitting up, black and white
    const cx = 1112;
    ell(ctx, cx, 470, 26, 30, "#1C1C1A");
    ell(ctx, cx - 4, 476, 13, 20, "#FFFEFA");
    ell(ctx, cx, 428, 18, 16, "#1C1C1A");
    poly(ctx, [cx - 16, 422, cx - 14, 404, cx - 4, 416], "#1C1C1A");
    poly(ctx, [cx + 4, 416, cx + 14, 404, cx + 16, 422], "#1C1C1A");
    ell(ctx, cx, 436, 7, 6, "#FFFEFA");
    ell(ctx, cx - 7, 426, 2.4, 2.4, "#E3D25A");
    ell(ctx, cx + 7, 426, 2.4, 2.4, "#E3D25A");
    ell(ctx, cx, 433, 1.8, 1.4, "#D98C9C");
    ell(ctx, cx - 10, 498, 7, 4, "#FFFEFA");
    ell(ctx, cx + 4, 498, 7, 4, "#FFFEFA");
    line(ctx, [cx + 24, 490, cx + 34, 500, cx + 32, 524, cx + 40, 532], "#1C1C1A", 6);
  }

  // floor
  rect(ctx, 0, FLOOR, BW, BH - FLOOR, "#E8E2D2");
  for (let y = FLOOR, r = 0; y < BH; y += 26, r++)
    for (let x = 0, c = 0; x < BW; x += 26, c++) {
      if ((r + c) % 2) rect(ctx, x, y, 26, 26, "#2A2927");
      else if ((c * 7 + r * 3) % 9 === 0) rect(ctx, x, y, 26, 26, "#B4513A");
      else if ((c * 5 + r) % 13 === 0) line(ctx, [x + 4, y + 6, x + 12, y + 14, x + 22, y + 18], "rgba(60,50,40,.5)", 1);
    }
  rect(ctx, 0, FLOOR, BW, 5, "rgba(0,0,0,.25)");
  // dropped sweets and wrappers
  for (let k = 0; k < 46; k++) {
    const sx = 180 + rand() * 900;
    const sy = FLOOR + 10 + rand() * 44;
    const c = ["#C0533F", "#F2D24A", "#7DA05A", "#E7A0B0", "#7DB0D8", "#F4F1EA", "#E08A3E"][k % 7];
    if (k % 5 === 0) {
      rect(ctx, sx - 4, sy - 3, 8, 6, c);
      poly(ctx, [sx - 4, sy, sx - 8, sy - 3, sx - 8, sy + 3], c);
      poly(ctx, [sx + 4, sy, sx + 8, sy - 3, sx + 8, sy + 3], c);
    } else ell(ctx, sx, sy, 4, 4, c);
  }
  // a dropped lollipop and the doormat
  line(ctx, [560, 846, 600, 834], "#F4F1EA", 2.4);
  ell(ctx, 556, 848, 11, 11, "#7DB0D8");
  ring(ctx, 556, 848, 6, "rgba(255,255,255,.6)", 2);
  rect(ctx, 1196, 822, 136, 40, "#9C7450");
  for (let x = 1198; x < 1330; x += 5) rect(ctx, x, 824, 2, 36, "rgba(60,40,20,.3)");
  text(ctx, "MIND THE STEP", 1264, 842, 9, "#3A2A1E", "Work Sans", 700);

  // the shopkeeper, behind the counter
  {
    const cx = 560;
    ctx.fillStyle = "#C9D7E0";
    ctx.beginPath();
    ctx.moveTo(cx - 48, 560);
    ctx.lineTo(cx - 52, 470);
    ctx.quadraticCurveTo(cx - 50, 446, cx - 20, 442);
    ctx.lineTo(cx + 20, 442);
    ctx.quadraticCurveTo(cx + 50, 446, cx + 52, 470);
    ctx.lineTo(cx + 48, 560);
    ctx.closePath();
    ctx.fill();
    for (let x = cx - 50; x < cx + 50; x += 8) rect(ctx, x, 446, 3, 114, "rgba(45,76,154,.35)");
    rect(ctx, cx - 34, 470, 68, 90, "#F7F4EC");
    rect(ctx, cx - 26, 446, 52, 30, "#F7F4EC");
    line(ctx, [cx - 26, 448, cx - 20, 440], "#F7F4EC", 4);
    line(ctx, [cx + 26, 448, cx + 20, 440], "#F7F4EC", 4);
    rect(ctx, cx - 16, 500, 32, 22, "rgba(0,0,0,.06)");
    rect(ctx, cx - 9, 432, 18, 12, SKIN[3]);
    poly(ctx, [cx - 12, 438, cx, 444, cx - 12, 450], "#B4513A");
    poly(ctx, [cx + 12, 438, cx, 444, cx + 12, 450], "#B4513A");
    ell(ctx, cx, 444, 3, 3, "#8A2B22");
    ell(ctx, cx, 404, 24, 28, SKIN[3]);
    ell(ctx, cx - 24, 406, 5, 7, SKIN[3]);
    ell(ctx, cx + 24, 406, 5, 7, SKIN[3]);
    ell(ctx, cx - 20, 392, 8, 12, "#ECE8DD");
    ell(ctx, cx + 20, 392, 8, 12, "#ECE8DD");
    ring(ctx, cx - 9, 400, 7, "#3A3631", 1.6);
    ring(ctx, cx + 9, 400, 7, "#3A3631", 1.6);
    line(ctx, [cx - 2, 400, cx + 2, 400], "#3A3631", 1.6);
    ell(ctx, cx - 9, 400, 1.6, 1.6, "#1C1C1A");
    ell(ctx, cx + 9, 400, 1.6, 1.6, "#1C1C1A");
    ell(ctx, cx, 412, 3, 4, "#D9A080");
    ell(ctx, cx - 7, 420, 9, 4, "#ECE8DD", 0.2);
    ell(ctx, cx + 7, 420, 9, 4, "#ECE8DD", -0.2);
    line(ctx, [cx - 5, 428, cx + 5, 428], "#8A5A3C", 1.4);
    // arms and the jar he is holding
    line(ctx, [cx - 46, 466, cx - 30, 520, cx + 20, 506], "#C9D7E0", 13);
    line(ctx, [cx + 46, 466, cx + 54, 510, cx + 34, 500], "#C9D7E0", 13);
    rr(ctx, 584, 458, 54, 64, 7, "rgba(214,228,226,.6)");
    ctx.save();
    rrPath(ctx, 584, 458, 54, 64, 7);
    ctx.clip();
    sweetsIn(ctx, SWEETS[5], 584, 478, 54, 522, rand);
    ctx.restore();
    rect(ctx, 596, 452, 30, 8, "#B4513A");
    rect(ctx, 590, 482, 42, 18, "#F7F0DA");
    text(ctx, "GOB-", 611, 487, 6.5, "#2D4C9A", "Courier Prime", 700);
    text(ctx, "STOPPERS", 611, 495, 6.5, "#2D4C9A", "Courier Prime", 700);
    ell(ctx, cx + 22, 506, 8, 7, SKIN[3]);
    ell(ctx, cx + 34, 500, 8, 7, SKIN[3]);
  }

  // the counter
  {
    const { x, w, top } = COUNTER;
    rect(ctx, x, top + 16, w, FLOOR - top - 16, "#2F5D4A");
    rect(ctx, x + 24, top + 34, w - 48, 178, "#EFEBE1");
    rect(ctx, x + 30, top + 40, w - 60, 166, "#E6DCC4");
    for (let s = 0; s < 3; s++) {
      const ty = top + 46 + s * 54;
      for (let k = 0; k < 13; k++) {
        const tx = x + 36 + k * 51;
        rect(ctx, tx, ty, 46, 44, "#F4F1EA");
        const sw = SWEETS[(k * 7 + s * 5) % SWEETS.length];
        ctx.save();
        ctx.beginPath();
        ctx.rect(tx + 3, ty + 3, 40, 38);
        ctx.clip();
        sweetsIn(ctx, sw, tx + 3, ty + 14, 40, ty + 41, rand);
        ctx.restore();
        rect(ctx, tx + 8, ty + 3, 30, 10, "#FFFEFA");
        text(ctx, `${[2, 3, 5, 1, 4][(k + s) % 5]}p`, tx + 23, ty + 8.5, 7, "#B4513A", "Courier Prime", 700);
      }
      rect(ctx, x + 30, ty + 46, w - 60, 4, "#C9B79A");
    }
    poly(ctx, [x + 80, top + 206, x + 180, top + 40, x + 210, top + 40, x + 110, top + 206], "rgba(255,255,255,.18)");
    poly(ctx, [x + 420, top + 206, x + 520, top + 40, x + 535, top + 40, x + 435, top + 206], "rgba(255,255,255,.14)");
    for (let k = 0; k < 4; k++) {
      rect(ctx, x + 24 + k * 172, top + 222, 164, 30, "#3E7560");
      rect(ctx, x + 30 + k * 172, top + 228, 152, 18, "#2F5D4A");
    }
    rect(ctx, x, FLOOR - 10, w, 10, "#1C1C1A");
    rect(ctx, x + 380, top + 226, 120, 22, "#F4F1EA");
    text(ctx, "PLEASE DO NOT", x + 440, top + 232, 7, "#B4513A", "Work Sans", 700);
    text(ctx, "LEAN ON THE GLASS", x + 440, top + 242, 7, "#B4513A", "Work Sans", 700);
    for (const [sx, c] of [[x + 60, "#C0533F"], [x + 250, "#2D4C9A"], [x + 640, "#E3B556"]] as const) {
      ell(ctx, sx, top + 237, 10, 10, c);
      ell(ctx, sx, top + 237, 5, 5, "#F4F1EA");
    }
    rect(ctx, x - 8, top, w + 16, 18, "#8A6440");
    rect(ctx, x - 8, top, w + 16, 3, "#A27B52");
    rect(ctx, x - 8, top + 15, w + 16, 3, "rgba(0,0,0,.25)");
  }

  // things on the counter
  {
    const T = COUNTER.top;
    // paper bags
    for (let k = 0; k < 4; k++) {
      rect(ctx, 162 + (k % 2) * 3, T - 6 - k * 6, 60, 6, "#F4F1EA");
      for (let s = 0; s < 6; s++) rect(ctx, 166 + (k % 2) * 3 + s * 10, T - 6 - k * 6, 4, 6, "#D98C9C");
    }
    poly(ctx, [176, T - 30, 214, T - 30, 218, T - 64, 172, T - 64], "#F4F1EA");
    for (let s = 0; s < 5; s++) rect(ctx, 178 + s * 8, T - 64, 3, 34, "#D98C9C");
    poly(ctx, [172, T - 64, 180, T - 70, 190, T - 64, 200, T - 70, 210, T - 64, 218, T - 64], "#F4F1EA");
    for (let k = 0; k < 4; k++) ell(ctx, 184 + k * 8, T - 66, 4, 4, ["#C0533F", "#F2D24A", "#7DA05A", "#D98CB0"][k]);
    // scales
    rect(ctx, 240, T - 10, 140, 10, "#A9852E");
    rect(ctx, 300, T - 80, 10, 70, "#C9A23F");
    line(ctx, [250, T - 84, 360, T - 76], "#A9852E", 5);
    ell(ctx, 305, T - 82, 6, 6, "#C9A23F");
    poly(ctx, [298, T - 78, 312, T - 78, 305, T - 98], "#A9852E");
    line(ctx, [256, T - 84, 246, T - 52, 256, T - 84, 284, T - 52], "#A9852E", 1.4);
    ctx.fillStyle = "#C9A23F";
    ctx.beginPath();
    ctx.ellipse(265, T - 52, 30, 16, 0, 0, Math.PI);
    ctx.fill();
    for (let k = 0; k < 8; k++) ell(ctx, 244 + k * 6, T - 54 - (k % 2) * 3, 4, 3, "#F2D24A");
    rect(ctx, 252, T - 40, 26, 30, "#A9852E");
    rect(ctx, 336, T - 70, 46, 6, "#A9852E");
    rect(ctx, 354, T - 64, 10, 54, "#A9852E");
    for (const [wx, ww, wh] of [[338, 18, 14], [358, 14, 10], [374, 10, 8]] as const) {
      rect(ctx, wx, T - 70 - wh, ww, wh, "#B9844A");
      rect(ctx, wx + ww / 2 - 2, T - 74 - wh, 4, 4, "#B9844A");
    }
    // counter bell
    ell(ctx, 432, T - 4, 16, 4, "#3A3631");
    ctx.fillStyle = "#C9CCCB";
    ctx.beginPath();
    ctx.ellipse(432, T - 6, 13, 14, 0, Math.PI, 0);
    ctx.fill();
    rect(ctx, 430, T - 26, 4, 6, "#9EA3A3");
    ell(ctx, 427, T - 14, 3, 4, "rgba(255,255,255,.5)");
    // the till
    poly(ctx, [656, T, 796, T, 786, T - 70, 666, T - 70], "#B9844A");
    rect(ctx, 670, T - 112, 112, 44, "#A9733E");
    rect(ctx, 684, T - 106, 84, 18, "#1C1C1A");
    text(ctx, "0.20", 726, T - 97, 12, "#F2D24A", "Courier Prime", 700);
    rect(ctx, 700, T - 124, 52, 14, "#FFFEFA");
    text(ctx, "NO SALE", 726, T - 117, 8, "#B4513A", "Work Sans", 700);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) ell(ctx, 680 + k * 15 + r * 3, T - 56 + r * 14, 5, 5, r === 2 && k === 6 ? "#B4513A" : "#ECE8DD");
    rect(ctx, 660, T - 12, 132, 12, "#8A5A30");
    ell(ctx, 726, T - 6, 6, 3, "#E3B556");
    line(ctx, [790, T - 50, 806, T - 60, 810, T - 54], "#3A3631", 4);
    // lollipop stand
    rect(ctx, 812, T - 20, 66, 20, "#B8925F");
    for (let k = 0; k < 7; k++) {
      const lx = 818 + k * 9;
      const lh = 50 + ((k * 23) % 40);
      line(ctx, [lx, T - 20, lx + (k % 2 ? 3 : -3), T - 20 - lh], "#F4F1EA", 2);
      const c = ["#C0533F", "#F2D24A", "#7DA05A", "#E08A3E", "#D98CB0", "#7DB0D8", "#6B4E7A"][k];
      const ly = T - 20 - lh;
      ell(ctx, lx + (k % 2 ? 3 : -3), ly, 13, 13, c);
      ctx.strokeStyle = "rgba(255,255,255,.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let a = 0; a < 14; a++) {
        const rr2 = a * 0.85;
        const px = lx + (k % 2 ? 3 : -3) + Math.cos(a * 0.9) * rr2;
        const py = ly + Math.sin(a * 0.9) * rr2;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // the coin
    ell(ctx, 164, T - 6, 8, 3, "#C9A23F");
    ell(ctx, 164, T - 7, 6, 2, "#E3B556");
  }

  // the child at the counter, on tiptoe
  {
    const cx = 112;
    const feet = 852;
    rect(ctx, cx - 12, feet - 70, 9, 62, SKIN[0]);
    rect(ctx, cx + 3, feet - 70, 9, 62, SKIN[0]);
    rect(ctx, cx - 12, feet - 30, 9, 22, "#ECE8DD");
    rect(ctx, cx + 3, feet - 30, 9, 22, "#ECE8DD");
    ell(ctx, cx - 8, feet - 4, 8, 5, "#7A2E2E");
    ell(ctx, cx + 8, feet - 4, 8, 5, "#7A2E2E");
    rect(ctx, cx - 18, feet - 100, 36, 34, "#3E4B55");
    rr(ctx, cx - 22, feet - 170, 44, 80, 10, "#B4513A");
    rect(ctx, cx - 22, feet - 132, 44, 8, "#F2D24A");
    line(ctx, [cx - 18, feet - 160, cx - 28, feet - 120, cx - 26, feet - 96], "#B4513A", 9);
    ell(ctx, cx - 26, feet - 94, 5, 5, SKIN[0]);
    line(ctx, [cx + 16, feet - 162, cx + 40, feet - 230, cx + 46, feet - 290], "#B4513A", 9);
    ell(ctx, cx + 47, feet - 296, 6, 6, SKIN[0]);
    ell(ctx, cx, feet - 194, 22, 24, SKIN[0]);
    ctx.fillStyle = "#6B4A2E";
    ctx.beginPath();
    ctx.ellipse(cx, feet - 200, 23, 20, 0, Math.PI, 0);
    ctx.fill();
    rect(ctx, cx - 24, feet - 206, 48, 8, "#2D4C9A");
    rect(ctx, cx - 26, feet - 202, 52, 4, "#24407F");
    ell(ctx, cx - 8, feet - 192, 2, 2.4, "#1C1C1A");
    ell(ctx, cx + 8, feet - 192, 2, 2.4, "#1C1C1A");
    line(ctx, [cx - 5, feet - 182, cx, feet - 179, cx + 5, feet - 182], "#8A5A3C", 1.6);
    ell(ctx, cx - 13, feet - 184, 3, 2, "rgba(217,140,156,.6)");
    ell(ctx, cx + 13, feet - 184, 3, 2, "rgba(217,140,156,.6)");
  }

  // the chalkboard
  {
    line(ctx, [920, 852, 960, 590], "#6B4A36", 7);
    line(ctx, [1090, 852, 1050, 590], "#6B4A36", 7);
    rect(ctx, 914, 584, 182, 218, "#8A6440");
    rect(ctx, 922, 592, 166, 202, "#2A2927");
    for (let k = 0; k < 40; k++) rect(ctx, 924 + rand() * 160, 594 + rand() * 196, 6, 1, "rgba(255,255,255,.06)");
    text(ctx, "TODAY", 1005, 610, 14, "#F4F1EA", "Libre Caslon Text", 700);
    const rows: [string, string][] = [["Humbugs", "15p"], ["Sherbet lemons", "20p"], ["Fudge", "40p"], ["Pear drops", "18p"], ["Gobstoppers", "5p ea"]];
    rows.forEach(([n, p], k) => {
      ctx.fillStyle = "#F4F1EA";
      ctx.font = `700 9.5px "Courier Prime", system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(n, 930, 634 + k * 16);
      ctx.textAlign = "right";
      ctx.fillText(p, 1080, 634 + k * 16);
    });
    rect(ctx, 930, 714, 150, 1.4, "rgba(244,241,234,.5)");
    text(ctx, "No, we don't do", 1005, 728, 9.5, "#F2D24A", "Courier Prime", 700);
    text(ctx, "half a quarter.", 1005, 742, 9.5, "#F2D24A", "Courier Prime", 700);
    ell(ctx, 960, 772, 7, 7, "#E7A0B0");
    ell(ctx, 980, 772, 7, 7, "#F2D24A");
    ell(ctx, 1000, 772, 7, 7, "#7DB0D8");
    line(ctx, [1020, 772, 1060, 772], "#F4F1EA", 1.4);
    rect(ctx, 916, 794, 178, 8, "#8A6440");
    rect(ctx, 960, 790, 18, 4, "#F4F1EA");
  }
  // the cat's bowl by the door
  poly(ctx, [1114, 846, 1166, 846, 1160, 826, 1120, 826], "#2D4C9A");
  ell(ctx, 1140, 826, 20, 4, "#24407F");
  text(ctx, "TOM", 1140, 837, 8, "#F4F1EA", "Work Sans", 700);

  grain(ctx, rand);
  ctx.restore();
}

export const sweetShop: Scene = { title: "The Sweet Shop", draw, labels: LABELS, landmarks: LANDMARKS };
