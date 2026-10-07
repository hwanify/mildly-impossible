// The Funfair: an evening fair with a big wheel, a carousel, a helter-skelter and the stalls,
// lights coming on as the sky goes from orange to blue. Busy on purpose, so most pieces can be placed.
import { BW, BH, rng, rect, ell, poly, line, text, person as stockPerson, grain, SKIN, type Box, type Ctx, type PersonOpts, type Scene } from "./common";

const LABELS: Box[] = [];
const lab = (name: string, x: number, y: number, w: number, h: number) => LABELS.push({ x, y, w, h, name });

const GROUND = 560;
const FEET = 846;
const WHEEL = { x: 300, y: 250, r: 196 };
const CARS = 12;
const carAt = (k: number) => {
  const a = (k / CARS) * Math.PI * 2 + 0.12;
  return { x: WHEEL.x + Math.cos(a) * WHEEL.r, y: WHEEL.y + Math.sin(a) * WHEEL.r };
};
const CAR_COLS = ["#B4513A", "#2D4C9A", "#E3B556", "#4F7A5A", "#D98CB0", "#6B4E7A"];
const CAROUSEL = { x: 720, top: 248, rim: 330, base: 524 };
const POLES = [584, 630, 676, 722, 768, 814, 860];
const HELTER = { x: 1190, top: 120, base: GROUND };
const POSTS = [36, 120, 204, 288, 372, 456, 540, 624, 708, 792, 876, 960, 1044, 1128, 1212, 1296];
const STRINGS: [number, number, number, number][] = [
  [-10, 300, 524, 300],
  [524, 300, 920, 300],
  [920, 300, 1354, 280],
];
const FIREWORKS: [number, number, number, string][] = [[640, 104, 50, "#F2C94C"], [930, 66, 40, "#F2A7C0"], [1300, 240, 34, "#A8E0C8"], [36, 120, 36, "#BFE3F0"]];
const sag = (s: [number, number, number, number], t: number) => [s[0] + (s[2] - s[0]) * t, s[1] + (s[3] - s[1]) * t + Math.sin(Math.PI * t) * 46] as const;

lab("the evening sky", 0, 0, BW, BH);
lab("the stars", 0, 0, BW, 140);
lab("the moon", 1010, 30, 70, 70);
FIREWORKS.forEach(([x, y, r]) => lab("a firework", x - r - 6, y - r - 6, r * 2 + 12, r * 2 + 12));
lab("the balloon that got away", 806, 100, 40, 110);
lab("the ground", 0, GROUND, BW, BH - GROUND);
lab("the big wheel", WHEEL.x - WHEEL.r - 10, WHEEL.y - WHEEL.r - 10, WHEEL.r * 2 + 20, GROUND - WHEEL.y + WHEEL.r + 10);
lab("the middle of the big wheel", WHEEL.x - 34, WHEEL.y - 34, 68, 68);
for (let k = 0; k < CARS; k++) {
  const c = carAt(k);
  lab("a car on the big wheel", c.x - 22, c.y - 6, 44, 44);
}
lab("the big top", 890, 206, 244, 316);
lab("the flag on the big top", 1004, 180, 40, 44);
lab("the helter-skelter", HELTER.x - 80, HELTER.top - 70, 160, HELTER.base - HELTER.top + 70);
lab("the boy on the helter-skelter", 1206, 250, 50, 46);
lab("the fortune teller's tent", 1250, 400, 94, 160);
lab("the carousel", 560, CAROUSEL.top - 20, 320, CAROUSEL.base - CAROUSEL.top + 50);
lab("the carousel sign", 600, CAROUSEL.rim, 240, 40);
POLES.forEach((x, k) => lab(k % 3 === 1 ? "a carousel horse with a rider" : "a carousel horse", x - 26, 404 + (k % 2) * 26, 52, 64));
lab("the lights", 0, 280, BW, 70);
lab("the coconut shy", 0, 430, 304, 270);
lab("the coconuts", 30, 540, 230, 50);
lab("the sign about the coconuts", 196, 588, 96, 44);
lab("the candy floss stand", 312, 440, 212, 260);
lab("the queue for the carousel", 560, 560, 200, 90);
lab("the ticket booth", 800, 556, 74, 100);
lab("the hook-a-duck", 900, 500, 236, 200);
lab("the yellow ducks", 914, 650, 210, 40);
lab("the prizes", 920, 548, 196, 80);
lab("the toffee apple stand", 1138, 538, 206, 162);
lab("the man with the kid on his shoulders", 34, 676, 60, 174);
lab("the girl with the candy floss", 130, 720, 50, 130);
lab("the couple holding hands", 210, 714, 76, 136);
lab("the boy with the toffee apple", 318, 744, 46, 106);
lab("the man who won the giant teddy", 384, 704, 106, 146);
lab("the giant teddy", 430, 720, 64, 128);
lab("the balloon seller", 500, 712, 56, 138);
lab("the balloons", 470, 560, 120, 160);
lab("the goldfish in a bag", 618, 744, 44, 46);
lab("the woman with the goldfish", 590, 716, 56, 134);
lab("the children running", 676, 740, 80, 110);
lab("the old couple with the chips", 770, 710, 82, 140);
lab("the man with the hot dog", 870, 710, 52, 140);
lab("the teenager on the phone", 950, 710, 44, 140);
lab("the pram", 1036, 770, 70, 76);
lab("the boy who dropped his ice cream", 1116, 740, 70, 110);
lab("the ice cream on the ground", 1150, 830, 44, 26);
lab("the couple sharing popcorn", 1196, 714, 72, 136);
lab("the man in the hi-vis vest", 1278, 704, 50, 146);
lab("the dog", 704, 820, 54, 34);

const LANDMARKS = [
  { x: 300, y: 250 }, // the big wheel's hub
  { x: 720, y: 350 }, // the carousel sign
  { x: 1190, y: 110 }, // the helter-skelter's roof
  { x: 150, y: 470 }, // the coconut shy sign
  { x: 1010, y: 660 }, // the ducks
];

const person = (ctx: Ctx, x: number, o: PersonOpts) => stockPerson(ctx, x, { feet: FEET, h: 120, ...o });

function bulb(ctx: Ctx, x: number, y: number, col = "#F8E3A0") {
  ell(ctx, x, y, 6, 6, "rgba(255,226,150,.22)");
  ell(ctx, x, y, 2.4, 2.4, col);
}

function head(ctx: Ctx, x: number, y: number, r: number, skin: string, hair: string) {
  ell(ctx, x, y, r * 0.85, r, skin);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.25, r * 0.9, r * 0.75, 0, Math.PI, 0);
  ctx.fill();
}

function stripes(ctx: Ctx, pts: number[], cols: string[], x0: number, x1: number, step: number, y0: number, y1: number) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.clip();
  for (let x = x0, k = 0; x < x1; x += step, k++) rect(ctx, x, y0, step + 0.5, y1 - y0, cols[k % cols.length]);
  ctx.restore();
}

function canopy(ctx: Ctx, x: number, y: number, w: number, a: string, b: string) {
  const n = Math.round(w / 22);
  const sw = w / n;
  for (let k = 0; k < n; k++) {
    poly(ctx, [x + k * sw, y, x + (k + 1) * sw, y, x + (k + 1) * sw, y + 22, x + k * sw, y + 22], k % 2 ? b : a);
    ell(ctx, x + k * sw + sw / 2, y + 22, sw / 2, 6, k % 2 ? b : a);
  }
}

function horse(ctx: Ctx, x: number, y: number, col: string, saddle: string, rider?: [string, string, string]) {
  ell(ctx, x, y, 22, 11, col);
  line(ctx, [x + 16, y - 4, x + 26, y - 20], col, 10);
  ell(ctx, x + 30, y - 22, 10, 6, col, 0.4);
  line(ctx, [x + 18, y - 8, x + 22, y - 22, x + 26, y - 26], "#C9A23F", 4);
  line(ctx, [x + 14, y + 6, x + 26, y + 12, x + 34, y + 8], col, 4);
  line(ctx, [x + 6, y + 8, x + 12, y + 22], col, 4);
  line(ctx, [x - 14, y + 6, x - 26, y + 18], col, 4);
  line(ctx, [x - 8, y + 8, x - 12, y + 24], col, 4);
  line(ctx, [x - 20, y - 2, x - 30, y + 10], "#C9A23F", 4);
  rect(ctx, x - 8, y - 12, 16, 8, saddle);
  ell(ctx, x + 32, y - 24, 1.4, 1.4, "#1C1C1A");
  if (rider) {
    ell(ctx, x, y - 22, 9, 13, rider[0]);
    line(ctx, [x + 2, y - 10, x + 6, y + 6], rider[0], 5);
    head(ctx, x, y - 40, 7, rider[1], rider[2]);
  }
}

function draw(ctx: Ctx) {
  const rand = rng(97531);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, BW, BH);
  ctx.clip();

  // the sky
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, "#1D2648");
  sky.addColorStop(0.35, "#3E4673");
  sky.addColorStop(0.62, "#8F6A7A");
  sky.addColorStop(0.82, "#D88A5A");
  sky.addColorStop(1, "#EDB566");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, BW, GROUND);
  for (let k = 0; k < 150; k++) {
    const x = rand() * BW;
    const y = Math.pow(rand(), 1.6) * 230;
    const r = rand() < 0.15 ? 1.8 : 0.9;
    ell(ctx, x, y, r, r, `rgba(255,250,230,${(0.9 - y / 300).toFixed(2)})`);
  }
  for (const [sx, sy] of [[560, 40], [880, 60], [1290, 30], [140, 34]]) {
    line(ctx, [sx - 5, sy, sx + 5, sy], "rgba(255,250,230,.8)", 1.2);
    line(ctx, [sx, sy - 5, sx, sy + 5], "rgba(255,250,230,.8)", 1.2);
  }
  ell(ctx, 1044, 64, 26, 26, "#F4ECCB");
  ell(ctx, 1056, 56, 24, 24, "#27305A");
  ell(ctx, 1056, 56, 24, 24, "rgba(29,38,72,.0)");
  // distant town along the horizon
  for (let x = 0; x < BW; x += 28) {
    const h = 14 + ((x * 7919) % 30);
    rect(ctx, x, GROUND - h - 30, 26, h + 30, "#5C4A5E");
    if ((x / 28) % 3 === 0) rect(ctx, x + 8, GROUND - h - 22, 4, 5, "#F2D48A");
  }
  // fireworks
  for (const [fx, fy, r, c] of FIREWORKS) {
    ell(ctx, fx, fy, r * 0.5, r * 0.5, "rgba(255,240,200,.08)");
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      line(ctx, [fx + Math.cos(a) * r * 0.25, fy + Math.sin(a) * r * 0.25, fx + Math.cos(a) * r * 0.85, fy + Math.sin(a) * r * 0.85 + 3], c, 1.6);
      ell(ctx, fx + Math.cos(a) * r, fy + Math.sin(a) * r + 4, 2, 2, c);
    }
    ell(ctx, fx, fy, 3, 3, "#FFFEFA");
    line(ctx, [fx, fy + r + 30, fx + 2, fy + r * 0.3], "rgba(255,240,200,.25)", 1.4);
  }

  // the balloon that got away
  ell(ctx, 826, 128, 14, 17, "#C0392B");
  ell(ctx, 821, 121, 4, 6, "rgba(255,255,255,.3)");
  poly(ctx, [824, 145, 828, 145, 826, 149], "#C0392B");
  line(ctx, [826, 149, 820, 170, 830, 190, 824, 206], "rgba(240,230,210,.7)", 0.8);

  // the big wheel
  {
    const { x, y, r } = WHEEL;
    line(ctx, [x, y, x - 120, GROUND], "#3A3E52", 12);
    line(ctx, [x, y, x + 120, GROUND], "#3A3E52", 12);
    line(ctx, [x - 80, 460, x + 80, 460], "#3A3E52", 6);
    line(ctx, [x - 80, 460, x + 40, 350, x - 40, 350, x + 80, 460], "#3A3E52", 3);
    ctx.strokeStyle = "#E2D3AE";
    for (const rr of [r, r - 16]) {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    const zig: number[] = [];
    for (let k = 0; k <= 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      const rr = k % 2 ? r : r - 16;
      zig.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    line(ctx, zig, "#D6C7A6", 1.6);
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      line(ctx, [x, y, x + Math.cos(a) * (r - 16), y + Math.sin(a) * (r - 16)], "#C9BB9A", 2);
    }
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 60, 0, Math.PI * 2);
    ctx.stroke();
    ell(ctx, x, y, 26, 26, "#B4513A");
    ell(ctx, x, y, 14, 14, "#E3B556");
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      bulb(ctx, x + Math.cos(a) * 20, y + Math.sin(a) * 20);
    }
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2;
      bulb(ctx, x + Math.cos(a) * (r + 1), y + Math.sin(a) * (r + 1), k % 3 ? "#F8E3A0" : "#F2A7A0");
    }
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      bulb(ctx, x + Math.cos(a) * 60, y + Math.sin(a) * 60, "#BFE3F0");
    }
    for (let k = 0; k < CARS; k++) {
      const c = carAt(k);
      const col = CAR_COLS[k % CAR_COLS.length];
      line(ctx, [c.x, c.y, c.x, c.y + 10], "#3A3631", 2);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 12, 18, 7, 0, Math.PI, 0);
      ctx.fill();
      rect(ctx, c.x - 16, c.y + 12, 32, 4, col);
      rect(ctx, c.x - 2, c.y + 14, 4, 8, col);
      poly(ctx, [c.x - 18, c.y + 22, c.x + 18, c.y + 22, c.x + 14, c.y + 38, c.x - 14, c.y + 38], col);
      rect(ctx, c.x - 18, c.y + 22, 36, 3, "rgba(255,255,255,.3)");
      if (k % 4 !== 2) {
        head(ctx, c.x - 7, c.y + 20, 5, SKIN[k % 5], ["#2A2927", "#E3B556", "#6B4A2E"][k % 3]);
        if (k % 2) head(ctx, c.x + 7, c.y + 20, 5, SKIN[(k + 2) % 5], "#C9783E");
      }
    }
  }

  // the big top
  {
    stripes(ctx, [890, 330, 1130, 330, 1010, 222], ["#B4513A", "#F0E4CC"], 890, 1130, 20, 222, 330);
    stripes(ctx, [900, 330, 1120, 330, 1120, 524, 900, 524], ["#F0E4CC", "#B4513A"], 900, 1120, 20, 330, 524);
    for (let k = 0; k < 11; k++) ell(ctx, 900 + k * 20 + 10, 332, 10, 6, k % 2 ? "#2D4C9A" : "#E3B556");
    poly(ctx, [978, 524, 1010, 380, 1042, 524], "#2A2236");
    poly(ctx, [978, 524, 1010, 380, 990, 524], "#B4513A");
    line(ctx, [1010, 222, 1010, 190], "#3A3631", 2);
    poly(ctx, [1010, 190, 1036, 197, 1010, 204], "#E3B556");
    text(ctx, "CIRCUS", 1010, 300, 15, "#2D4C9A", "Libre Caslon Text", 700);
    for (let k = 0; k < 6; k++) line(ctx, [900 + k * 44, 524, 880 + k * 50, GROUND + 4], "#5E4A3A", 1);
  }

  // the helter-skelter
  {
    const { x, top, base } = HELTER;
    const pts: { px: number; py: number; front: boolean }[] = [];
    const turns = 4.5;
    for (let k = 0; k <= 180; k++) {
      const t = k / 180;
      const a = t * turns * Math.PI * 2;
      pts.push({ px: x + Math.sin(a) * 64, py: top + 60 + t * (base - top - 90) + Math.cos(a) * 12, front: Math.cos(a) > 0 });
    }
    const slide = (front: boolean) => {
      for (let k = 0; k < pts.length - 1; k++) {
        if (pts[k].front !== front) continue;
        line(ctx, [pts[k].px, pts[k].py, pts[k + 1].px, pts[k + 1].py], front ? "#E3B556" : "#B8913A", 16);
        line(ctx, [pts[k].px, pts[k].py + 8, pts[k + 1].px, pts[k + 1].py + 8], front ? "#B4513A" : "#7A3A2A", 3);
      }
    };
    slide(false);
    stripes(ctx, [x - 36, top, x + 36, top, x + 40, base, x - 40, base], ["#B4513A", "#F0E4CC"], x - 40, x + 40, 10, top, base);
    for (let y = top + 60; y < base - 30; y += 64) {
      rect(ctx, x - 7, y, 14, 18, "#2A2236");
      ell(ctx, x, y, 7, 5, "#2A2236");
    }
    stripes(ctx, [x - 54, top + 2, x + 54, top + 2, x, top - 66], ["#2D4C9A", "#E3B556"], x - 54, x + 54, 13.5, top - 66, top + 2);
    line(ctx, [x, top - 66, x, top - 90], "#3A3631", 2);
    poly(ctx, [x, top - 90, x + 24, top - 84, x, top - 78], "#B4513A");
    for (let k = 0; k < 9; k++) bulb(ctx, x - 52 + k * 13, top + 4);
    slide(true);
    line(ctx, [pts[180].px, pts[180].py, pts[180].px + 70, base - 6], "#E3B556", 16);
    const rider = pts[34];
    rect(ctx, rider.px - 14, rider.py - 2, 28, 5, "#7A5A3C");
    ell(ctx, rider.px, rider.py - 12, 9, 10, "#2D4C9A");
    line(ctx, [rider.px - 4, rider.py - 18, rider.px - 14, rider.py - 30], "#2D4C9A", 4);
    line(ctx, [rider.px + 4, rider.py - 18, rider.px + 14, rider.py - 30], "#2D4C9A", 4);
    head(ctx, rider.px, rider.py - 28, 7, SKIN[0], "#C9783E");
    rect(ctx, x - 30, base - 40, 60, 40, "#5C4632");
    rect(ctx, x - 24, base - 34, 48, 16, "#F4F1EA");
    text(ctx, "50p", x, base - 26, 11, "#B4513A", "Work Sans", 700);
  }
  // the fortune teller's tent
  {
    stripes(ctx, [1250, 470, 1344, 470, 1344, GROUND, 1256, GROUND], ["#6B4E7A", "#E3B556"], 1250, 1344, 14, 470, GROUND);
    stripes(ctx, [1240, 472, 1360, 472, 1310, 404], ["#6B4E7A", "#E3B556"], 1240, 1360, 14, 404, 472);
    poly(ctx, [1286, GROUND, 1306, 486, 1326, GROUND], "#2A2236");
    ell(ctx, 1306, 532, 7, 7, "#BFE3F0");
    rect(ctx, 1258, 478, 38, 14, "#2A2236");
    text(ctx, "MYSTIC", 1277, 485, 8, "#E3B556", "Work Sans", 700);
    poly(ctx, [1310, 404, 1318, 392, 1314, 404], "#E3B556");
  }

  // the carousel
  {
    const { x, top, rim, base } = CAROUSEL;
    rect(ctx, 572, rim + 40, 296, base - rim - 40, "#3A2E3A");
    rect(ctx, x - 22, rim + 40, 44, base - rim - 40, "#C9A23F");
    for (let k = 0; k < 3; k++) rect(ctx, x - 16, rim + 50 + k * 46, 32, 38, "#BFD0D6");
    for (let k = 0; k < 3; k++) poly(ctx, [x - 14, rim + 86 + k * 46, x - 4, rim + 52 + k * 46, x + 2, rim + 52 + k * 46, x - 8, rim + 86 + k * 46], "rgba(255,255,255,.35)");
    const cols = ["#F0E4CC", "#B4513A", "#E3B556", "#2D4C9A"];
    for (let k = 0; k < 12; k++) {
      const x0 = 560 + k * (320 / 12);
      poly(ctx, [x0, rim + 2, x0 + 320 / 12, rim + 2, x + (k - 5) * 1.2, top, x + (k - 6) * 1.2, top], cols[k % 4]);
    }
    rect(ctx, x - 4, top - 24, 8, 26, "#C9A23F");
    ell(ctx, x, top - 26, 7, 7, "#E3B556");
    poly(ctx, [x, top - 54, x + 22, top - 46, x, top - 38], "#B4513A");
    line(ctx, [x, top - 54, x, top - 26], "#3A3631", 2);
    rect(ctx, 556, rim, 328, 40, "#2D4C9A");
    rect(ctx, 556, rim, 328, 4, "#C9A23F");
    rect(ctx, 556, rim + 36, 328, 4, "#C9A23F");
    text(ctx, "GALLOPERS", x, rim + 21, 20, "#E3B556", "Libre Caslon Text", 700);
    for (let k = 0; k < 16; k++) ell(ctx, 566 + k * 20.5, rim + 44, 10.2, 7, k % 2 ? "#B4513A" : "#E3B556");
    for (let k = 0; k < 6; k++) {
      bulb(ctx, 576 + k * 12, rim + 20);
      bulb(ctx, 804 + k * 12, rim + 20);
    }
    for (let k = 0; k < 12; k++) bulb(ctx, 566 + k * 28, rim + 2);
    const horseCols = ["#F4F1EA", "#3A3631", "#C9A57A", "#F4F1EA", "#8A5A3C", "#F4F1EA", "#3A3631"];
    const saddles = ["#B4513A", "#2D4C9A", "#4F7A5A", "#6B4E7A", "#B4513A", "#E3B556", "#2D4C9A"];
    POLES.forEach((px, k) => {
      line(ctx, [px, rim + 46, px, base], "#D9B04A", 3);
      for (let j = 0; j < 4; j++) rect(ctx, px - 2, rim + 52 + j * 30, 4, 3, "#F4E1A6");
      const hy = 436 + (k % 2) * 26;
      const rider: [string, string, string] | undefined = k % 3 === 1 ? [["#C0533F", "#E3B556", "#4F7A5A"][k % 3], SKIN[k % 5], "#6B4A2E"] : undefined;
      horse(ctx, px, hy, horseCols[k], saddles[k], rider);
    });
    rect(ctx, 556, base, 328, 22, "#7A2E2E");
    rect(ctx, 556, base, 328, 4, "#C9A23F");
    for (let k = 0; k < 16; k++) bulb(ctx, 566 + k * 20.5, base + 13);
    rect(ctx, 700, base + 22, 40, 8, "#5C4632");
    rect(ctx, 692, base + 30, 56, 8, "#5C4632");
  }

  // the light poles and strings
  for (const px of [524, 920]) {
    rect(ctx, px - 3, 280, 6, GROUND - 280, "#3A3E52");
    ell(ctx, px, 280, 5, 5, "#3A3E52");
  }
  STRINGS.forEach((s) => {
    const pts: number[] = [];
    for (let t = 0; t <= 1.0001; t += 0.05) pts.push(...sag(s, t));
    line(ctx, pts, "#2A2927", 1.2);
    const bulbCols = ["#F8E3A0", "#F2A7A0", "#BFE3F0", "#C8E6A0"];
    for (let k = 1; k < 26; k++) {
      const [bx, by] = sag(s, k / 26);
      bulb(ctx, bx, by + 3, bulbCols[k % 4]);
    }
  });

  // the ground
  {
    const g = ctx.createLinearGradient(0, GROUND, 0, BH);
    g.addColorStop(0, "#6B6A4A");
    g.addColorStop(1, "#3E3F30");
    ctx.fillStyle = g;
    ctx.fillRect(0, GROUND, BW, BH - GROUND);
    ctx.fillStyle = "rgba(110,84,60,.45)";
    ctx.beginPath();
    ctx.moveTo(0, 740);
    ctx.quadraticCurveTo(670, 690, BW, 730);
    ctx.lineTo(BW, BH);
    ctx.lineTo(0, BH);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < 700; k++) {
      const x = rand() * BW;
      const y = GROUND + rand() * (BH - GROUND);
      line(ctx, [x, y, x + 5 - rand() * 10, y + 1 - rand() * 3], k % 2 ? "rgba(226,196,120,.4)" : "rgba(30,26,20,.2)", 1.2);
    }
    line(ctx, [0, 700, 300, 712, 520, 700, 700, 716, 900, 704, 1344, 712], "#1C1C1A", 2.4);
  }

  // the coconut shy
  {
    rect(ctx, 6, 470, 292, 230, "#2F5A3E");
    rect(ctx, 20, 440, 264, 32, "#F0E4CC");
    rect(ctx, 20, 440, 264, 3, "#B4513A");
    text(ctx, "COCONUT SHY", 152, 458, 20, "#B4513A", "Libre Caslon Text", 700);
    for (const px of [16, 290]) rect(ctx, px - 4, 440, 8, 260, "#8A5A3C");
    canopy(ctx, 6, 472, 292, "#B4513A", "#F0E4CC");
    rect(ctx, 14, 506, 276, 110, "#264A33");
    for (let k = 0; k < 6; k++) {
      const cx = 46 + k * 42;
      rect(ctx, cx - 2, 572, 4, 44, "#C9A57A");
      poly(ctx, [cx - 9, 572, cx + 9, 572, cx + 5, 562, cx - 5, 562], "#C9A57A");
      if (k !== 3) {
        ell(ctx, cx, 552, 14, 13, "#6B4A2E");
        for (let j = 0; j < 8; j++) line(ctx, [cx - 10 + j * 3, 542 + (j % 3), cx - 9 + j * 3, 560], "rgba(30,20,10,.4)", 1);
        ell(ctx, cx - 4, 548, 2, 2, "#3A2A1E");
        ell(ctx, cx + 3, 548, 2, 2, "#3A2A1E");
      }
    }
    ell(ctx, 166, 600, 12, 10, "#6B4A2E");
    for (let k = 0; k < 10; k++) bulb(ctx, 26 + k * 28, 504);
    rect(ctx, 200, 590, 88, 40, "#F4F1EA");
    text(ctx, "NO COCONUT", 244, 600, 9, "#1C1C1A", "Work Sans", 700);
    text(ctx, "HAS FALLEN", 244, 611, 9, "#1C1C1A", "Work Sans", 700);
    text(ctx, "SINCE 1987", 244, 622, 9, "#B4513A", "Work Sans", 700);
    // the counter
    rect(ctx, 6, 630, 292, 12, "#C9A57A");
    stripes(ctx, [6, 642, 298, 642, 298, 700, 6, 700], ["#B4513A", "#F0E4CC"], 6, 298, 18, 642, 700);
    rect(ctx, 30, 612, 36, 20, "#6E7A80");
    for (let k = 0; k < 5; k++) ell(ctx, 36 + k * 6, 612, 4, 4, "#F4F1EA");
    text(ctx, "3 BALLS FOR A POUND", 104, 660, 12, "#1C1C1A", "Courier Prime", 700);
    ell(ctx, 100, 610, 10, 18, "#4F7A5A");
    head(ctx, 100, 584, 9, SKIN[2], "#2A2927");
  }

  // the candy floss stand
  {
    rect(ctx, 318, 480, 200, 220, "#F0E4CC");
    rect(ctx, 312, 446, 212, 34, "#D98CB0");
    text(ctx, "CANDY FLOSS", 418, 464, 19, "#FFFEFA", "Libre Caslon Text", 700);
    canopy(ctx, 312, 480, 212, "#D98CB0", "#FFFEFA");
    rect(ctx, 324, 514, 188, 112, "#5A3E4E");
    for (let k = 0; k < 7; k++) {
      const bx = 340 + k * 26;
      line(ctx, [bx, 514, bx, 524], "#E2D3AE", 1);
      ell(ctx, bx, 538, 11, 14, k % 2 ? "#BFD8EE" : "#F2B8CC");
      rect(ctx, bx - 11, 524, 22, 4, "rgba(255,255,255,.5)");
      poly(ctx, [bx - 8, 528, bx - 4, 528, bx - 6, 548], "rgba(255,255,255,.25)");
    }
    ell(ctx, 380, 600, 16, 22, "#2D4C9A");
    head(ctx, 380, 572, 9, SKIN[3], "#E3B556");
    ell(ctx, 458, 600, 30, 14, "#C9CCCB");
    ell(ctx, 458, 590, 26, 14, "#F7CFDC");
    ell(ctx, 448, 584, 12, 8, "#FAE0E8");
    ell(ctx, 470, 586, 10, 7, "#F2B8CC");
    rect(ctx, 312, 626, 212, 12, "#B8925F");
    stripes(ctx, [318, 638, 518, 638, 518, 700, 318, 700], ["#D98CB0", "#FFFEFA"], 318, 518, 20, 638, 700);
    rect(ctx, 360, 652, 112, 30, "#FFFEFA");
    text(ctx, "ONLY 2.50", 416, 667, 15, "#B4513A", "Courier Prime", 700);
    for (let k = 0; k < 9; k++) bulb(ctx, 324 + k * 24, 444);
  }

  // the queue for the carousel and the ticket booth
  const qp = (x: number, o: PersonOpts) => stockPerson(ctx, x, { feet: 650, h: 84, ...o });
  qp(584, { coat: "#4F7A5A", legs: "#2A2927", skin: SKIN[1], hair: "#2A2927" });
  qp(614, { coat: "#E3B556", legs: "#4A5F78", skin: SKIN[0], hair: "#C9783E", h: 56 });
  qp(646, { coat: "#B4513A", legs: "#2A2927", skin: SKIN[4], hair: "#6B4A2E" });
  qp(682, { coat: "#6B4E7A", legs: "#2A2927", skin: SKIN[2], hair: "#1C1C1A" });
  qp(722, { coat: "#2D4C9A", legs: "#4A5F78", skin: SKIN[3], hair: "#E3B556", h: 62 });
  {
    rect(ctx, 804, 574, 66, 80, "#7A2E2E");
    poly(ctx, [798, 576, 876, 576, 837, 552], "#C9A23F");
    rect(ctx, 812, 590, 50, 30, "#E9CF96");
    head(ctx, 837, 610, 8, SKIN[4], "#9A9A9A");
    rect(ctx, 812, 624, 50, 14, "#F4F1EA");
    text(ctx, "TICKETS", 837, 631, 9, "#7A2E2E", "Work Sans", 700);
  }

  // the hook-a-duck
  {
    rect(ctx, 906, 520, 224, 180, "#F0E4CC");
    rect(ctx, 900, 498, 236, 28, "#2D4C9A");
    text(ctx, "HOOK A DUCK", 1018, 512, 17, "#E3B556", "Libre Caslon Text", 700);
    canopy(ctx, 900, 526, 236, "#E3B556", "#2D4C9A");
    rect(ctx, 912, 560, 212, 74, "#3E4A6A");
    // prizes
    const teddy = (tx: number, ty: number, c: string, s = 1) => {
      ell(ctx, tx, ty + 10 * s, 10 * s, 10 * s, c);
      ell(ctx, tx, ty - 6 * s, 8 * s, 7 * s, c);
      ell(ctx, tx - 6 * s, ty - 12 * s, 3 * s, 3 * s, c);
      ell(ctx, tx + 6 * s, ty - 12 * s, 3 * s, 3 * s, c);
      ell(ctx, tx, ty - 4 * s, 3 * s, 2 * s, "#F4E1A6");
    };
    for (let k = 0; k < 9; k++) line(ctx, [924 + k * 23, 560, 924 + k * 23, 570], "#E2D3AE", 1);
    teddy(924, 584, "#9C6B3E");
    teddy(947, 584, "#D98CB0");
    teddy(970, 584, "#BFD8EE");
    poly(ctx, [988, 572, 1004, 574, 1012, 604, 1002, 606], "#E3B556");
    teddy(1039, 584, "#E3B556");
    ell(ctx, 1062, 588, 10, 18, "#4F7A5A");
    ell(ctx, 1062, 576, 4, 4, "#F4F1EA");
    teddy(1085, 584, "#9C6B3E");
    teddy(1108, 584, "#F4F1EA");
    for (let k = 0; k < 8; k++) teddy(926 + k * 26, 616, ["#B4513A", "#E3B556", "#2D4C9A", "#D98CB0"][k % 4], 0.6);
    text(ctx, "EVERY DUCK A WINNER*", 1018, 640, 9, "#1C1C1A", "Work Sans", 700);
    // the trough and ducks
    rect(ctx, 906, 648, 224, 52, "#B4513A");
    rect(ctx, 914, 652, 208, 22, "#6FA3B8");
    for (let k = 0; k < 4; k++) rect(ctx, 914 + k * 54, 660 + (k % 2) * 6, 26, 2, "rgba(255,255,255,.35)");
    for (let k = 0; k < 10; k++) {
      const dx = 926 + k * 20;
      const dy = 662 + (k % 2) * 4;
      ell(ctx, dx, dy, 8, 5, "#F2C94C");
      ell(ctx, dx + 5, dy - 6, 4.5, 4.5, "#F2C94C");
      poly(ctx, [dx + 9, dy - 6, dx + 13, dy - 5, dx + 9, dy - 4], "#D9773A");
      line(ctx, [dx + 5, dy - 10, dx + 5, dy - 14], "#3A3631", 1);
    }
    text(ctx, "*NOT EVERY DUCK", 1018, 688, 9, "#FFFEFA", "Work Sans", 700);
    line(ctx, [960, 700, 990, 640], "#C9A57A", 2);
    line(ctx, [990, 640, 990, 652], "#3A3631", 1);
    line(ctx, [1086, 700, 1060, 646], "#C9A57A", 2);
    for (let k = 0; k < 10; k++) bulb(ctx, 910 + k * 24, 497);
  }

  // the toffee apple stand
  {
    rect(ctx, 1144, 580, 200, 120, "#F0E4CC");
    rect(ctx, 1138, 540, 206, 28, "#7A2E2E");
    text(ctx, "TOFFEE APPLES", 1240, 554, 15, "#F4E1A6", "Libre Caslon Text", 700);
    canopy(ctx, 1138, 568, 206, "#7A2E2E", "#F4E1A6");
    rect(ctx, 1150, 600, 188, 56, "#4A3640");
    for (let r = 0; r < 2; r++)
      for (let k = 0; k < 8; k++) {
        const ax = 1166 + k * 22 + r * 10;
        const ay = 624 + r * 22;
        line(ctx, [ax, ay - 6, ax, ay - 18], "#E2D3AE", 1.6);
        ell(ctx, ax, ay, 8, 8, "#A8281E");
        ell(ctx, ax - 3, ay - 3, 2.4, 2, "rgba(255,255,255,.55)");
      }
    rect(ctx, 1144, 656, 200, 10, "#B8925F");
    stripes(ctx, [1144, 666, 1344, 666, 1344, 700, 1144, 700], ["#7A2E2E", "#F4E1A6"], 1144, 1344, 20, 666, 700);
    for (let k = 0; k < 8; k++) bulb(ctx, 1150 + k * 26, 538);
  }

  // the crowd
  {
    // man with a child on his shoulders
    person(ctx, 64, { coat: "#4A5F78", legs: "#2A2927", skin: SKIN[1], hair: "#2A2927" });
    ell(ctx, 64, 714, 10, 14, "#E3B556");
    line(ctx, [58, 724, 50, 744, 54, 756], "#2D4C9A", 5);
    line(ctx, [70, 724, 78, 744, 74, 756], "#2D4C9A", 5);
    line(ctx, [72, 708, 86, 690], "#E3B556", 4);
    line(ctx, [56, 708, 52, 728], "#E3B556", 4);
    head(ctx, 64, 694, 8, SKIN[1], "#2A2927");
    // girl with candy floss
    person(ctx, 154, { coat: "#D98CB0", legs: "#2A2927", skin: SKIN[0], hair: "#C9783E", h: 92, arm: "up" });
    line(ctx, [174, 760, 174, 736], "#E2D3AE", 1.6);
    ell(ctx, 174, 730, 13, 12, "#F7CFDC");
    ell(ctx, 170, 726, 6, 5, "#FAE0E8");
    // couple
    person(ctx, 226, { coat: "#B4513A", legs: "#2A2927", skin: SKIN[2], hair: "#1C1C1A" });
    person(ctx, 262, { coat: "#4F7A5A", legs: "#4A5F78", skin: SKIN[0], hair: "#E3B556", h: 112 });
    // boy with a toffee apple
    person(ctx, 340, { coat: "#2D4C9A", legs: "#2A2927", skin: SKIN[3], hair: "#6B4A2E", h: 84, arm: "up" });
    line(ctx, [360, 780, 360, 760], "#E2D3AE", 1.6);
    ell(ctx, 360, 754, 8, 8, "#A8281E");
    // the giant teddy and the man who won it
    person(ctx, 404, { coat: "#6B4E7A", legs: "#2A2927", skin: SKIN[4], hair: "#3A2A1E" });
    {
      const tx = 460;
      ell(ctx, tx, 800, 30, 34, "#E3A6C0");
      ell(ctx, tx, 752, 24, 22, "#E3A6C0");
      ell(ctx, tx - 18, 734, 8, 8, "#E3A6C0");
      ell(ctx, tx + 18, 734, 8, 8, "#E3A6C0");
      ell(ctx, tx, 758, 9, 6, "#F4E1E8");
      ell(ctx, tx - 8, 748, 2.4, 2.4, "#1C1C1A");
      ell(ctx, tx + 8, 748, 2.4, 2.4, "#1C1C1A");
      ell(ctx, tx - 20, 838, 12, 8, "#E3A6C0");
      ell(ctx, tx + 20, 838, 12, 8, "#E3A6C0");
      rect(ctx, tx - 12, 772, 24, 6, "#2D4C9A");
      line(ctx, [416, 764, 436, 784], "#6B4E7A", 6);
    }
    // the balloon seller
    {
      const strings: [number, number, string][] = [[490, 600, "#B4513A"], [516, 586, "#E3B556"], [544, 598, "#2D4C9A"], [568, 614, "#4F7A5A"], [502, 632, "#D98CB0"], [530, 622, "#6B4E7A"], [556, 646, "#D9773A"], [484, 660, "#F4F1EA"], [580, 670, "#B4513A"]];
      for (const [bx, by] of strings) line(ctx, [bx, by + 18, 528, 742], "rgba(240,230,210,.7)", 0.8);
      for (const [bx, by, c] of strings) {
        ell(ctx, bx, by, 14, 17, c);
        ell(ctx, bx - 4, by - 6, 3.5, 5, "rgba(255,255,255,.3)");
      }
      person(ctx, 528, { coat: "#C9A23F", legs: "#3A3631", skin: SKIN[1], hair: "#9A9A9A", arm: "up", hat: "#3A3631" });
    }
    // the woman with the goldfish
    person(ctx, 616, { coat: "#2D4C9A", legs: "#2A2927", skin: SKIN[0], hair: "#6B4A2E" });
    line(ctx, [628, 760, 640, 764], "#2D4C9A", 5);
    line(ctx, [640, 760, 640, 752], "#E2D3AE", 1);
    ell(ctx, 640, 772, 12, 14, "rgba(190,220,232,.8)");
    ell(ctx, 641, 774, 5, 3, "#E07B2E");
    poly(ctx, [636, 774, 632, 771, 632, 777], "#E07B2E");
    // children running
    for (const [cx, c] of [[694, "#B4513A"], [734, "#E3B556"]] as const) {
      line(ctx, [cx, 806, cx - 10, 826, cx - 18, 834], "#2A2927", 5);
      line(ctx, [cx, 806, cx + 8, 826, cx + 14, 840], "#2A2927", 5);
      poly(ctx, [cx - 8, 808, cx + 8, 808, cx + 12, 778, cx - 4, 776], c);
      line(ctx, [cx + 8, 784, cx + 20, 794], c, 4);
      line(ctx, [cx - 2, 784, cx - 14, 776], c, 4);
      head(ctx, cx + 4, 766, 8, SKIN[(cx / 10) % 5 | 0], "#2A2927");
    }
    // the dog
    ell(ctx, 728, 840, 14, 7, "#C9A57A");
    ell(ctx, 742, 832, 6, 6, "#C9A57A");
    line(ctx, [716, 838, 708, 828], "#C9A57A", 2.6);
    rect(ctx, 720, 844, 3, 8, "#C9A57A");
    rect(ctx, 734, 844, 3, 8, "#C9A57A");
    // the old couple with chips
    person(ctx, 790, { coat: "#8A6440", legs: "#3A3631", skin: SKIN[3], hair: "#E7E2D5", hat: "#3A3631" });
    person(ctx, 828, { coat: "#7A2E2E", legs: "#3A3631", skin: SKIN[0], hair: "#E7E2D5", h: 110 });
    for (const cx of [806, 814]) {
      rect(ctx, cx - 6, 774, 12, 12, "#F4F1EA");
      for (let k = 0; k < 4; k++) rect(ctx, cx - 5 + k * 3, 768, 2, 8, "#E3C76A");
    }
    // the man with the hot dog
    person(ctx, 894, { coat: "#3A3E52", legs: "#4A5F78", skin: SKIN[2], hair: "#1C1C1A", arm: "phone" });
    rect(ctx, 896, 744, 18, 6, "#D9A55E");
    rect(ctx, 898, 742, 14, 3, "#A8281E");
    // the teenager on the phone
    person(ctx, 970, { coat: "#4F7A5A", legs: "#2A2927", skin: SKIN[4], hair: "#2A2927", arm: "phone" });
    ell(ctx, 978, 740, 5, 4, "rgba(191,227,240,.6)");
    // the pram
    {
      const py = 840;
      ctx.fillStyle = "#6B4E7A";
      ctx.beginPath();
      ctx.moveTo(1044, py - 36);
      ctx.lineTo(1088, py - 36);
      ctx.quadraticCurveTo(1088, py - 14, 1066, py - 14);
      ctx.lineTo(1050, py - 14);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(1084, py - 36, 16, Math.PI, Math.PI * 1.5);
      ctx.lineTo(1084, py - 36);
      ctx.fill();
      line(ctx, [1044, py - 36, 1036, py - 52], "#2A2927", 2.4);
      ctx.strokeStyle = "#2A2927";
      ctx.lineWidth = 2;
      for (const wx of [1052, 1080]) {
        ctx.beginPath();
        ctx.arc(wx, py - 6, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      line(ctx, [1060, py - 40, 1064, py - 70], "rgba(240,230,210,.7)", 0.8);
      ell(ctx, 1064, py - 82, 10, 12, "#E3B556");
    }
    // the boy who dropped his ice cream
    person(ctx, 1138, { coat: "#B4513A", legs: "#2D4C9A", skin: SKIN[0], hair: "#E3B556", h: 86 });
    line(ctx, [1132, 778, 1134, 784], "#BFE3F0", 1.6);
    line(ctx, [1144, 778, 1142, 784], "#BFE3F0", 1.6);
    poly(ctx, [1158, 846, 1186, 846, 1176, 834], "#D9A55E");
    ell(ctx, 1168, 842, 12, 6, "#F4E1E8");
    ell(ctx, 1170, 836, 3, 2, "#B4513A");
    // the couple sharing popcorn
    person(ctx, 1212, { coat: "#E3B556", legs: "#3A3631", skin: SKIN[2], hair: "#1C1C1A" });
    person(ctx, 1250, { coat: "#2D4C9A", legs: "#2A2927", skin: SKIN[1], hair: "#6B4A2E", h: 114 });
    stripes(ctx, [1222, 770, 1242, 770, 1238, 794, 1226, 794], ["#B4513A", "#F4F1EA"], 1222, 1242, 4, 770, 794);
    for (let k = 0; k < 5; k++) ell(ctx, 1225 + k * 3.6, 768 - (k % 2) * 3, 3, 3, "#F4E1A6");
    // the man in the hi-vis vest
    person(ctx, 1302, { coat: "#D6E04A", legs: "#2A2927", skin: SKIN[3], hair: "#9A9A9A" });
    rect(ctx, 1290, 762, 24, 3, "#E2E2DA");
    rect(ctx, 1290, 774, 24, 3, "#E2E2DA");
    rect(ctx, 1312, 760, 14, 20, "#8A6440");
    rect(ctx, 1314, 764, 10, 14, "#F4F1EA");
  }

  grain(ctx, rand);
  ctx.restore();
}

export const funfair: Scene = { title: "The Funfair", draw, labels: LABELS, landmarks: LANDMARKS };
