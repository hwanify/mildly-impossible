// The Market: a town square on market day, the clock tower and old shop fronts behind two rows of
// striped stalls, the crowd in between. Busy on purpose, so most pieces have something on them.
import { BW, BH, rng, rect, ell, poly, line, text, person, grain, SKIN, type Box, type Ctx, type PersonOpts, type Scene } from "./common";

const LABELS: Box[] = [];
const lab = (name: string, x: number, y: number, w: number, h: number) => LABELS.push({ x, y, w, h, name });

const FASCIA = 330;
const GROUND = 440;
const BACK_AWN = 386;
const BACK_COUNTER = 470;
const CROWD = 612;
const FRONT_AWN = 588;
const FRONT_COUNTER = 712;
const CLOTH = 772;
const COBBLE = 808;

const FACADES = [
  { x: 0, w: 150, top: 112, wall: "#D8AA52", roof: "gable", shop: "BUTCHER", sc: "#7A2E2E", name: "the yellow house" },
  { x: 150, w: 150, top: 146, wall: "#A3B79D", roof: "flat", shop: "TEA ROOM", sc: "#2F5D4A", name: "the green house" },
  { x: 300, w: 160, top: 98, wall: "#AE5B42", roof: "step", shop: "BANK", sc: "#2A2927", name: "the old bank" },
  { x: 460, w: 150, top: 132, wall: "#E2D3AE", roof: "gable", shop: "BOOKS", sc: "#2D4C9A", name: "the cream house" },
  { x: 734, w: 146, top: 124, wall: "#91A8C0", roof: "flat", shop: "CHEMIST", sc: "#4F7A5A", name: "the blue house" },
  { x: 880, w: 150, top: 100, wall: "#D8A6A0", roof: "gable", shop: "WOOL SHOP", sc: "#5E4A72", name: "the pink house" },
  { x: 1030, w: 160, top: 144, wall: "#E2D3AE", roof: "flat", shop: "IRONMONGER", sc: "#B03A2E", name: "the ironmonger's" },
  { x: 1190, w: 154, top: 114, wall: "#8FAE8A", roof: "step", shop: "THE CROWN", sc: "#2A2927", name: "the pub" },
] as const;

type Stall = { x: number; w: number; a: string; b: string; name: string; sign: string; ink?: string };
const BACK: Stall[] = [
  { x: 14, w: 226, a: "#4F7A5A", b: "#F4F1EA", name: "the flower stall", sign: "FLOWERS" },
  { x: 262, w: 260, a: "#B4513A", b: "#F4F1EA", name: "the bread stall", sign: "BREAD & CAKES" },
  { x: 800, w: 252, a: "#D8AA52", b: "#F4F1EA", name: "the cheese stall", sign: "CHEESE", ink: "#8A6420" },
  { x: 1076, w: 254, a: "#2D4C9A", b: "#F4F1EA", name: "the egg and honey stall", sign: "EGGS & HONEY" },
];
const FRONT: Stall[] = [
  { x: -10, w: 330, a: "#B03A2E", b: "#F4F1EA", name: "the fruit stall", sign: "J. PRICE & SONS  FRUIT" },
  { x: 338, w: 310, a: "#4F7A5A", b: "#E3B556", name: "the veg stall", sign: "FRESH VEG" },
  { x: 666, w: 286, a: "#3E6E8E", b: "#F4F1EA", name: "the fish stall", sign: "FRESH FISH" },
  { x: 970, w: 196, a: "#6B4E7A", b: "#E3B556", name: "the sock stall", sign: "SOCKS" },
];

type Shopper = { x: number; dy?: number; coat: string; legs: string; s: number; hair: string; h?: number; hat?: string; bag?: string; arm?: "up" | "phone"; name: string };
const CROWD_PEOPLE: Shopper[] = [
  { dy: 14, x: 40, coat: "#6B4E7A", legs: "#2A2927", s: 0, hair: "#C9C2B4", bag: "#E3B556", h: 104, name: "the woman with the shopping bag" },
  { dy: 6, x: 108, coat: "#3E6E8E", legs: "#4A5F78", s: 2, hair: "#1C1C1A", hat: "#6B5B48", h: 104, name: "the man in the flat cap" },
  { dy: 8, x: 178, coat: "#D98C5F", legs: "#2A2927", s: 3, hair: "#6B4A2E", arm: "phone", h: 100, name: "the woman on the phone" },
  { dy: 10, x: 262, coat: "#4F7A5A", legs: "#2A2927", s: 1, hair: "#2A2927", bag: "#F4F1EA", h: 104, name: "a shopper" },
  { x: 330, coat: "#E3B556", legs: "#4A5F78", s: 0, hair: "#C9783E", h: 76, name: "the girl" },
  { dy: 12, x: 404, coat: "#B03A2E", legs: "#2A2927", s: 4, hair: "#3A2A1E", bag: "#A3B79D", h: 104, name: "the woman in red" },
  { dy: 4, x: 548, coat: "#2D4C9A", legs: "#2A2927", s: 2, hair: "#1C1C1A", arm: "up", h: 104, name: "the man waving" },
  { dy: 16, x: 704, coat: "#9C6B3E", legs: "#4A5F78", s: 0, hair: "#E3B556", bag: "#B4513A", h: 98, name: "a shopper" },
  { dy: 8, x: 776, coat: "#5F6670", legs: "#2A2927", s: 3, hair: "#C9C2B4", hat: "#2A2927", h: 104, name: "the man in the hat" },
  { dy: 6, x: 852, coat: "#D8A6A0", legs: "#4A5F78", s: 1, hair: "#1C1C1A", bag: "#2D4C9A", h: 104, name: "the woman with the shopping bag" },
  { dy: 12, x: 950, coat: "#3E6E4E", legs: "#2A2927", s: 4, hair: "#6B4A2E", h: 104, name: "a shopper" },
  { dy: 10, x: 1030, coat: "#E3B556", legs: "#2A2927", s: 2, hair: "#2A2927", bag: "#F4F1EA", h: 102, name: "a shopper" },
  { dy: 2, x: 1110, coat: "#B4513A", legs: "#4A5F78", s: 0, hair: "#C9783E", arm: "phone", h: 104, name: "the man on the phone" },
  { dy: 14, x: 1190, coat: "#2D4C9A", legs: "#2A2927", s: 3, hair: "#E3B556", bag: "#D8AA52", h: 104, name: "a shopper" },
  { dy: 8, x: 1270, coat: "#6B4E7A", legs: "#2A2927", s: 1, hair: "#1C1C1A", hat: "#B03A2E", h: 104, name: "a shopper" },
];

// Names for everything, in the order things are drawn (later ones sit on top).
lab("the cobbles", 0, 0, BW, BH);
lab("the sky", 0, 0, BW, 150);
lab("a cloud", 60, 20, 170, 56);
lab("a cloud", 900, 30, 170, 56);
lab("the pigeons in the sky", 1110, 20, 120, 50);
for (const f of FACADES) {
  lab(f.name, f.x, f.top - (f.roof === "gable" ? 60 : 30), f.w, FASCIA - f.top + 60);
  lab(`the ${f.shop === "THE CROWN" ? "pub sign" : f.shop.toLowerCase() === "bank" ? "bank" : f.shop.toLowerCase() + "'s"}`.replace("tea room's", "tea room").replace("wool shop's", "wool shop").replace("books's", "bookshop"), f.x, FASCIA, f.w, GROUND - FASCIA);
}
lab("the clock tower", 610, 0, 124, GROUND);
lab("the clock", 632, 118, 80, 80);
lab("the weathervane", 650, 0, 44, 40);
lab("the bunting", 0, 150, BW, 70);
lab("the sign on the clock tower", 626, 338, 92, 44);
for (const s of BACK) lab(s.name, s.x, BACK_AWN - 6, s.w, 150);
lab("the coffee cart", 560, 440, 120, 100);
for (const p of CROWD_PEOPLE) lab(p.name, p.x - 24, CROWD + (p.dy ?? 0) - (p.h ?? 112) - 4, 48, (p.h ?? 112) + 8);
lab("the pram", 456, 540, 70, 74);
lab("the dog", 610, 574, 60, 40);
lab("the man selling the cheese", 900, 400, 50, 70);
lab("the STRONG CHEESE sign", 960, 420, 90, 42);
lab("the jars of honey", 1220, 440, 100, 36);
lab("the eggs", 1100, 440, 110, 36);
lab("the buckets of flowers", 14, 420, 226, 100);
lab("the loaves", 270, 440, 240, 40);
for (const s of FRONT) lab(s.name, Math.max(0, s.x), FRONT_AWN - 6, s.w, COBBLE - FRONT_AWN + 6);
lab("the apples", 10, 680, 90, 40);
lab("the oranges", 100, 680, 70, 40);
lab("the bananas", 170, 680, 70, 40);
lab("the lemons", 240, 680, 70, 40);
lab("the carrots", 350, 680, 70, 40);
lab("the cabbages", 420, 680, 70, 40);
lab("the tomatoes", 490, 680, 70, 40);
lab("the aubergines", 560, 680, 80, 40);
lab("the MOSTLY ONIONS sign", 520, 640, 120, 36);
lab("the fish on ice", 680, 680, 200, 40);
lab("the lobster", 880, 670, 64, 50);
lab("the fishmonger", 760, 620, 50, 70);
lab("the socks", 980, 640, 180, 80);
lab("the greengrocer", 200, 620, 50, 70);
lab("the busker", 1186, 650, 110, 160);
lab("the guitar case", 1180, 812, 110, 40);
lab("the busker's sign", 1288, 756, 56, 58);
lab("the pigeons", 380, 810, 200, 54);
lab("the pigeons", 1000, 816, 160, 48);
lab("the crates", 0, 800, 120, 64);
lab("the dropped apple", 690, 828, 40, 30);
lab("the shopping trolley bag", 860, 790, 50, 74);
lab("a shopper right at the front", 300, 780, 60, BH - 780);
lab("a man right at the front", 628, 776, 60, BH - 776);
lab("a shopper right at the front", 932, 784, 74, BH - 784);

/** Places worth starting the puzzle from: things you'd find first on the lid. */
const LANDMARKS = [
  { x: 672, y: 158 }, // the clock
  { x: 126, y: 470 }, // the flower stall
  { x: 1000, y: 440 }, // the cheese sign
  { x: 790, y: 700 }, // the fish stall
  { x: 1240, y: 760 }, // the busker
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

function pigeon(ctx: Ctx, x: number, y: number, flip = false, peck = false) {
  const d = flip ? -1 : 1;
  ell(ctx, x, y - 7, 11, 7, "#8E949A");
  ell(ctx, x - d * 4, y - 8, 7, 4, "#6E747A");
  poly(ctx, [x - d * 10, y - 8, x - d * 18, y - 6, x - d * 10, y - 4], "#5F6670");
  const hx = x + d * (peck ? 11 : 8);
  const hy = y - (peck ? 3 : 15);
  ell(ctx, hx, hy, 4.5, 4.5, "#6E747A");
  ell(ctx, x + d * 6, y - 10, 3, 3, "#7FA08E");
  poly(ctx, [hx + d * 4, hy - 1, hx + d * 8, hy + 1, hx + d * 4, hy + 1.5], "#C98F5E");
  ell(ctx, hx + d * 1.5, hy - 1, 0.9, 0.9, "#E3B556");
  line(ctx, [x - 2, y - 1, x - 3, y + 2], "#C0533F", 1.4);
  line(ctx, [x + 3, y - 1, x + 3, y + 2], "#C0533F", 1.4);
}

function card(ctx: Ctx, x: number, y: number, lines: string[], minW = 46, kraft = false) {
  const w = Math.max(minW, Math.max(...lines.map((l) => l.length)) * 5.3 + 8);
  const h = 6 + lines.length * 10;
  line(ctx, [x, y + h / 2, x, y + h / 2 + 12], "#6B5B48", 1.4);
  rect(ctx, x - w / 2, y - h / 2, w, h, kraft ? "#D9C29A" : "#FFFEFA");
  lines.forEach((s, k) => text(ctx, s, x, y - h / 2 + 8 + k * 10, 8.5, k === lines.length - 1 && lines.length > 1 ? "#B03A2E" : "#1C1C1A", "Courier Prime", 700));
}

function awning(ctx: Ctx, s: Stall, top: number, depth: number) {
  const n = Math.round(s.w / 26);
  const sw = s.w / n;
  rect(ctx, s.x + 4, top, 4, 0, s.a);
  for (let k = 0; k < n; k++) {
    const x0 = s.x + k * sw;
    poly(ctx, [x0 + 6, top, x0 + sw + 6, top, x0 + sw, top + depth, x0, top + depth], k % 2 ? s.b : s.a);
    ell(ctx, x0 + sw / 2, top + depth, sw / 2, 5, k % 2 ? s.b : s.a);
  }
  rect(ctx, s.x + 6, top - 3, s.w, 4, "rgba(28,28,26,.35)");
}

function crate(ctx: Ctx, x: number, y: number, w: number, h: number) {
  rect(ctx, x, y, w, h, "#B8925F");
  for (let k = 0; k < 3; k++) rect(ctx, x, y + 3 + k * (h / 3), w, 2, "rgba(60,40,20,.3)");
  rect(ctx, x, y, 3, h, "#8A6440");
  rect(ctx, x + w - 3, y, 3, h, "#8A6440");
}

function heap(ctx: Ctx, x: number, y: number, w: number, rand: () => number, draw1: (cx: number, cy: number, k: number) => void, step = 13, rows = 3) {
  let k = 0;
  for (let r = rows - 1; r >= 0; r--) {
    const inset = r * 6;
    for (let cx = x + 7 + inset + (r % 2) * 5; cx < x + w - 6 - inset; cx += step) draw1(cx + (rand() - 0.5) * 2, y - r * 8 + (rand() - 0.5) * 2, k++);
  }
}

function fruitStall(ctx: Ctx, rand: () => number) {
  const y = 704;
  const boxes: [number, (cx: number, cy: number, k: number) => void][] = [
    [14, (cx, cy, k) => { ell(ctx, cx, cy, 6.5, 6, k % 3 ? "#B03A2E" : "#8FAE5A"); ell(ctx, cx - 2, cy - 2, 1.6, 1.6, "rgba(255,255,255,.4)"); }],
    [100, (cx, cy) => { ell(ctx, cx, cy, 6.5, 6.5, "#E07B2E"); ell(ctx, cx + 1, cy - 4, 1.2, 1.2, "#4F7A5A"); }],
    [170, (cx, cy) => { ctx.strokeStyle = "#E3C24A"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy - 10, 10, 0.4, 2.4); ctx.stroke(); }],
    [240, (cx, cy) => ell(ctx, cx, cy, 6.5, 5, "#EBD45A", 0.3)],
  ];
  for (const [bx, f] of boxes) {
    crate(ctx, bx, y - 4, 66, 30);
    heap(ctx, bx, y - 4, 66, rand, f);
  }
  card(ctx, 50, 666, ["APPLES", "4 FOR 1.00"]);
  card(ctx, 136, 668, ["ORANGES", "50p"], 44, true);
  card(ctx, 206, 668, ["BANANAS", "20p"]);
  card(ctx, 276, 666, ["LEMONS", "3 FOR 1.00"], 50, true);
}

function vegStall(ctx: Ctx, rand: () => number) {
  const y = 704;
  const boxes: [number, (cx: number, cy: number, k: number) => void][] = [
    [352, (cx, cy) => { poly(ctx, [cx - 4, cy - 4, cx + 4, cy - 4, cx, cy + 10], "#E07B2E"); line(ctx, [cx, cy - 4, cx - 2, cy - 10, cx, cy - 4, cx + 3, cy - 10], "#6E9A63", 1.6); }],
    [422, (cx, cy) => { ell(ctx, cx, cy, 8, 7.5, "#7DA05E"); line(ctx, [cx - 4, cy - 4, cx, cy + 4, cx + 4, cy - 4], "#A9C48A", 1); }],
    [492, (cx, cy) => { ell(ctx, cx, cy, 6, 5.5, "#C0392B"); ell(ctx, cx, cy - 4, 2.2, 1.4, "#4F7A5A"); }],
    [562, (cx, cy) => { ell(ctx, cx, cy, 9, 5, "#5E3E6A", 0.5); ell(ctx, cx - 6, cy - 4, 2.5, 2, "#4F7A5A"); }],
  ];
  for (const [bx, f] of boxes) {
    crate(ctx, bx, y - 4, 66, 30);
    heap(ctx, bx, y - 4, 66, rand, f, 14);
  }
  card(ctx, 386, 668, ["CARROTS", "80p"], 46, true);
  card(ctx, 456, 664, ["CABBAGE", "1.00"]);
  rect(ctx, 520, 638, 118, 30, "#FFFEFA");
  text(ctx, "MIXED VEG BAG", 579, 646, 8.5, "#1C1C1A", "Courier Prime", 700);
  text(ctx, "(MOSTLY ONIONS)", 579, 659, 8.5, "#B03A2E", "Courier Prime", 700);
}

function fishStall(ctx: Ctx, rand: () => number) {
  const y = 704;
  rect(ctx, 676, y - 26, 272, 26, "#DCE8EC");
  for (let k = 0; k < 60; k++) rect(ctx, 678 + rand() * 266, y - 24 + rand() * 22, 3, 3, "rgba(255,255,255,.8)");
  for (let r = 0; r < 2; r++)
    for (let k = 0; k < 9; k++) {
      const fx = 690 + k * 21 + r * 8;
      const fy = y - 18 + r * 10;
      const c = ["#8E9EA8", "#B9A28A", "#9FB0B8"][(k + r) % 3];
      ell(ctx, fx, fy, 10, 3.6, c, 0.15);
      poly(ctx, [fx - 9, fy - 1, fx - 15, fy - 5, fx - 15, fy + 3], c);
      ell(ctx, fx + 7, fy - 1, 1, 1, "#1C1C1A");
    }
  ell(ctx, 908, y - 12, 18, 9, "#B4513A");
  ell(ctx, 888, y - 12, 6, 5, "#B4513A");
  for (const s of [-1, 1]) {
    line(ctx, [920, y - 12 + s * 4, 934, y - 12 + s * 14], "#B4513A", 3);
    ell(ctx, 938, y - 12 + s * 16, 6, 4, "#B4513A");
  }
  for (let k = 0; k < 4; k++) line(ctx, [900 + k * 5, y - 4, 898 + k * 5, y + 2], "#B4513A", 1.4);
  card(ctx, 730, 664, ["COD", "4.00/lb"]);
  card(ctx, 820, 662, ["FRESH TODAY", "(ISH)"], 66, true);
  card(ctx, 908, 668, ["LOBSTER", "ASK"], 46);
}

function sockStall(ctx: Ctx) {
  const cols = ["#B03A2E", "#E3B556", "#2D4C9A", "#4F7A5A", "#D8A6A0", "#6B4E7A", "#D98C5F"];
  line(ctx, [980, 636, 1158, 636], "#3A3631", 1.4);
  for (let k = 0; k < 9; k++) {
    const sx = 986 + k * 19;
    const c = cols[k % 7];
    const c2 = cols[(k + 3) % 7];
    rect(ctx, sx, 636, 10, 30, c);
    rect(ctx, sx, 662, 16, 9, c);
    for (let s = 0; s < 3; s++) rect(ctx, sx, 641 + s * 8, 10, 3, c2);
    rect(ctx, sx + 12, 662, 4, 9, c2);
  }
  for (let k = 0; k < 7; k++) {
    const bx = 984 + k * 25;
    for (let r = 0; r < 2; r++) ell(ctx, bx + 10, 694 - r * 8, 11, 5, cols[(k + r * 2) % 7]);
  }
  card(ctx, 1068, 616, ["3 PAIRS 5.00", "ODD ONES FREE"], 76);
}

function backStallContents(ctx: Ctx, s: Stall, rand: () => number) {
  const y = BACK_COUNTER;
  switch (s.sign) {
    case "FLOWERS": {
      for (let t = 0; t < 2; t++)
        for (let k = 0; k < 6; k++) {
          const bx = 32 + k * 36 + t * 14;
          const by = y - 4 - t * 26;
          rect(ctx, bx - 11, by - 18, 22, 20, "#6E7A80");
          rect(ctx, bx - 11, by - 18, 22, 3, "#8E9AA0");
          const fc = ["#C0533F", "#E3B556", "#D98CB0", "#FFFEFA", "#8E6BB0", "#E07B2E"][(k + t * 3) % 6];
          for (let f = 0; f < 7; f++) line(ctx, [bx + (f - 3) * 2, by - 18, bx + (f - 3) * 4, by - 34 - (f % 3) * 4], "#4F7A5A", 1.2);
          for (let f = 0; f < 7; f++) ell(ctx, bx + (f - 3) * 4 + (rand() - 0.5) * 2, by - 36 - (f % 3) * 4, 4.5, 4.5, fc);
        }
      card(ctx, 210, 412, ["TULIPS", "3.00"], 42, true);
      break;
    }
    case "BREAD & CAKES": {
      for (let k = 0; k < 7; k++) {
        const bx = 284 + k * 30;
        ell(ctx, bx, y - 10, 13, 9, ["#C08A4A", "#A86E35", "#D9A55E"][k % 3]);
        for (let c = -1; c <= 1; c++) line(ctx, [bx + c * 5 - 2, y - 15, bx + c * 5 + 2, y - 7], "rgba(255,240,210,.55)", 1.4);
      }
      for (let k = 0; k < 4; k++) {
        ctx.save();
        ctx.translate(300 + k * 14, y - 32);
        ctx.rotate(-0.9);
        ell(ctx, 0, 0, 22, 4, "#C9954E");
        ctx.restore();
      }
      rect(ctx, 400, y - 40, 40, 24, "#F4F1EA");
      rect(ctx, 400, y - 44, 40, 6, "#D98CB0");
      ell(ctx, 420, y - 48, 4, 4, "#C0392B");
      rect(ctx, 452, y - 34, 30, 18, "#8A5A3C");
      rect(ctx, 452, y - 34, 30, 5, "#F4F1EA");
      for (let k = 0; k < 4; k++) ell(ctx, 496 + (k % 2) * 12, y - 30 + Math.floor(k / 2) * 10, 6, 5, "#E3B556");
      card(ctx, 330, 406, ["SOURDOUGH", "4.00"], 58);
      break;
    }
    case "CHEESE": {
      for (let k = 0; k < 4; k++) {
        const cx = 826 + k * 34;
        rect(ctx, cx - 14, y - 22, 28, 18, k % 2 ? "#E8C66A" : "#D8AA52");
        ell(ctx, cx, y - 22, 14, 5, k % 2 ? "#F0D88A" : "#E8C66A");
        rect(ctx, cx - 14, y - 6, 28, 2, "rgba(60,40,20,.2)");
      }
      for (let k = 0; k < 3; k++) poly(ctx, [948 + k * 30, y - 4, 972 + k * 30, y - 4, 972 + k * 30, y - 24], ["#F0D88A", "#F4F1EA", "#E8B04A"][k]);
      for (let k = 0; k < 5; k++) ell(ctx, 954 + k * 18, y - 8, 2, 2, "rgba(150,110,40,.4)");
      rect(ctx, 1030, y - 26, 18, 22, "#C04A3A");
      rect(ctx, 966, 424, 82, 36, "#2A2927");
      text(ctx, "STRONG CHEESE", 1007, 434, 8.5, "#F4F1EA", "Courier Prime", 700);
      text(ctx, "WE DID WARN YOU", 1007, 450, 8, "#E3B556", "Courier Prime", 700);
      break;
    }
    case "EGGS & HONEY": {
      for (let k = 0; k < 3; k++) {
        const tx = 1104 + k * 36;
        rect(ctx, tx, y - 16, 32, 12, "#B9AE98");
        for (let e = 0; e < 4; e++) ell(ctx, tx + 5 + e * 7.3, y - 18, 3.4, 4.2, k === 1 ? "#F4F1EA" : "#D9B48A");
      }
      for (let k = 0; k < 6; k++) {
        const jx = 1224 + k * 16;
        rect(ctx, jx - 6, y - 24, 12, 20, "#D99A2E");
        rect(ctx, jx - 6, y - 28, 12, 4, ["#B03A2E", "#F4F1EA", "#2D4C9A"][k % 3]);
        rect(ctx, jx - 4, y - 18, 8, 6, "#F4F1EA");
      }
      card(ctx, 1150, 418, ["6 EGGS", "2.40"], 50, true);
      card(ctx, 1280, 418, ["HONEY", "5.00"]);
      break;
    }
  }
}

function stallholder(ctx: Ctx, x: number, y: number, coat: string, skin: string, hair: string, apron: string, cap?: string) {
  ell(ctx, x, y + 28, 18, 30, coat);
  rect(ctx, x - 10, y + 12, 20, 40, apron);
  for (let k = 0; k < 3; k++) rect(ctx, x - 10, y + 16 + k * 10, 20, 3, "rgba(255,255,255,.4)");
  ell(ctx, x, y - 4, 10, 12, skin);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 11, 9, 0, Math.PI, 0);
  ctx.fill();
  if (cap) {
    rect(ctx, x - 11, y - 18, 22, 8, cap);
    rect(ctx, x, y - 12, 15, 3, cap);
  }
}

function stall(ctx: Ctx, s: Stall, awnTop: number, awnDepth: number, counterTop: number, counterBot: number, front: boolean) {
  rect(ctx, s.x + 6, awnTop, 4, counterBot - awnTop, "#3A3631");
  rect(ctx, s.x + s.w - 4, awnTop, 4, counterBot - awnTop, "#3A3631");
  rect(ctx, s.x + 6, counterTop, s.w - 6, counterBot - counterTop, front ? "#F4F1EA" : "#E7E2D5");
  if (front) {
    for (let k = 0; k < s.w; k += 22) ell(ctx, s.x + 10 + k, counterBot, 11, 4, "#F4F1EA");
    rect(ctx, s.x + 6, counterTop, s.w - 6, 6, s.a);
    text(ctx, s.sign, s.x + s.w / 2 + 3, (counterTop + counterBot) / 2 + 2, s.sign.length > 12 ? 16 : 20, s.ink ?? s.a, "Libre Caslon Text", 700);
    for (let k = 0; k < s.w - 10; k += 14) rect(ctx, s.x + 10 + k, counterBot - 10, 7, 4, s.a);
  } else {
    rect(ctx, s.x + 6, counterTop, s.w - 6, 4, s.a);
    text(ctx, s.sign, s.x + s.w / 2 + 3, (counterTop + counterBot) / 2 + 2, 13, s.ink ?? s.a, "Libre Caslon Text", 700);
  }
  awning(ctx, s, awnTop, awnDepth);
}

function facade(ctx: Ctx, f: (typeof FACADES)[number], i: number, rand: () => number) {
  const { x, w, top } = f;
  if (f.roof === "gable") {
    poly(ctx, [x - 2, top + 2, x + w / 2, top - 56, x + w + 2, top + 2], "#5F6670");
    for (let k = 1; k < 6; k++) line(ctx, [x + (w / 2) * (k / 6), top - 56 * (k / 6) + 2, x + w - (w / 2) * (k / 6), top - 56 * (k / 6) + 2], "rgba(20,20,20,.18)", 1);
    rect(ctx, x + w / 2 - 12, top - 34, 24, 28, "#EFEBE1");
    rect(ctx, x + w / 2 - 9, top - 31, 18, 22, "#4E5A63");
    rect(ctx, x + w - 36, top - 52, 18, 30, "#A65F49");
    rect(ctx, x + w - 39, top - 56, 24, 6, "#8D857A");
  } else if (f.roof === "step") {
    rect(ctx, x, top - 26, w, 28, f.wall);
    rect(ctx, x + 20, top - 46, w - 40, 22, f.wall);
    rect(ctx, x + 50, top - 62, w - 100, 18, f.wall);
    for (const [sx, sw, sy] of [[x, w, top - 26], [x + 20, w - 40, top - 46], [x + 50, w - 100, top - 62]]) rect(ctx, sx - 2, sy - 3, sw + 4, 5, "#D6D0C2");
    text(ctx, i === 2 ? "1887" : "1902", x + w / 2, top - 34, 11, "#F4F1EA", "Libre Caslon Text", 700);
  } else {
    rect(ctx, x, top - 14, w, 16, f.wall);
    rect(ctx, x - 2, top - 16, w + 4, 5, "#D6D0C2");
    for (let k = 0; k < 5; k++) rect(ctx, x + 10 + k * (w - 20) / 4 - 4, top - 30, 8, 16, "#D6D0C2");
  }
  rect(ctx, x, top, w, FASCIA - top, f.wall);
  if (f.wall === "#AE5B42") {
    for (let y = top + 6; y < FASCIA; y += 7) rect(ctx, x, y, w, 1, "rgba(60,30,20,.2)");
    for (let y = top; y < FASCIA; y += 7) for (let xx = x + ((y / 7) % 2) * 7; xx < x + w; xx += 14) rect(ctx, xx, y, 1, 7, "rgba(60,30,20,.14)");
  } else for (let k = 0; k < 120; k++) rect(ctx, x + rand() * w, top + rand() * (FASCIA - top), 2, 2, "rgba(60,50,40,.06)");
  rect(ctx, x + w - 3, top, 3, FASCIA - top, "rgba(28,28,26,.25)");
  const rows = FASCIA - top > 200 ? [top + 26, top + 116] : [top + 20, top + 104];
  const extra = ["cat", "box", "dark", "curtain", "lit", "washing", "box", "lit", "dark", "curtain", "cat", "lit", "curtain", "dark", "box", "lit"];
  rows.forEach((wy, r) =>
    [0, 1, 2].forEach((c) => {
      const ww = (w - 40) / 3;
      const wx = x + 12 + c * (ww + 8);
      const wh = Math.min(76, FASCIA - wy - 26);
      const kind = extra[(i * 6 + r * 3 + c) % extra.length];
      rect(ctx, wx - 3, wy - 4, ww + 6, 5, "#EFEBE1");
      rect(ctx, wx, wy, ww, wh, "#EFEBE1");
      rect(ctx, wx + 3, wy + 3, ww - 6, wh - 6, kind === "lit" ? "#D9BB7E" : "#4E5A63");
      if (kind === "curtain") {
        const cc = ["#B03A2E", "#2D4C9A", "#4F7A5A", "#E3B556"][(i + c) % 4];
        poly(ctx, [wx + 3, wy + 3, wx + 14, wy + 3, wx + 8, wy + wh - 3, wx + 3, wy + wh - 3], cc);
        poly(ctx, [wx + ww - 3, wy + 3, wx + ww - 14, wy + 3, wx + ww - 8, wy + wh - 3, wx + ww - 3, wy + wh - 3], cc);
      }
      if (kind === "cat") {
        ell(ctx, wx + ww / 2, wy + wh - 12, 9, 8, "#C9783E");
        ell(ctx, wx + ww / 2 - 4, wy + wh - 22, 6, 5, "#C9783E");
        poly(ctx, [wx + ww / 2 - 9, wy + wh - 25, wx + ww / 2 - 8, wy + wh - 31, wx + ww / 2 - 5, wy + wh - 26], "#C9783E");
        poly(ctx, [wx + ww / 2 - 2, wy + wh - 26, wx + ww / 2, wy + wh - 31, wx + ww / 2 + 1, wy + wh - 24], "#C9783E");
      }
      if (kind === "box") {
        rect(ctx, wx - 2, wy + wh, ww + 4, 8, "#7A5A3C");
        for (let k = 0; k < 5; k++) ell(ctx, wx + 3 + k * (ww / 4.5), wy + wh - 2 - (k % 2) * 3, 4, 4, ["#C0533F", "#E3B556", "#D98CB0", "#FFFEFA"][(k + i) % 4]);
      }
      if (kind === "washing") {
        line(ctx, [wx + 3, wy + 10, wx + ww - 3, wy + 12], "#E7E2D5", 1);
        for (let k = 0; k < 3; k++) rect(ctx, wx + 6 + k * 10, wy + 11, 7, 14, ["#C0533F", "#FFFEFA", "#E3B556"][k]);
      }
      if (kind === "lit") rect(ctx, wx + ww / 2 - 1, wy + 3, 2, wh - 6, "#EFEBE1");
      rect(ctx, wx - 3, wy + wh, ww + 6, 4, "#E2DDD2");
    }),
  );
  // the shop
  rect(ctx, x, FASCIA, w, GROUND - FASCIA, "#3A3631");
  rect(ctx, x + 4, FASCIA, w - 8, 26, f.sc);
  const label = f.shop === "THE CROWN" ? "THE CROWN" : f.shop;
  text(ctx, label, x + w / 2, FASCIA + 13, label.length > 8 ? 13 : 15, "#F4E1A6", "Libre Caslon Text", 700);
  rect(ctx, x + 8, FASCIA + 30, w - 50, GROUND - FASCIA - 34, "#5C6A72");
  rect(ctx, x + w - 38, FASCIA + 30, 30, GROUND - FASCIA - 30, i % 2 ? "#5C4632" : "#2F5D4A");
  ell(ctx, x + w - 14, FASCIA + 72, 2, 2, "#E3B556");
  poly(ctx, [x + 20, GROUND, x + 40, FASCIA + 30, x + 50, FASCIA + 30, x + 30, GROUND], "rgba(255,255,255,.12)");
  if (f.shop === "BUTCHER") for (let k = 0; k < 4; k++) ell(ctx, x + 22 + k * 22, FASCIA + 44, 7, 10, "#B4513A");
  if (f.shop === "BOOKS") for (let k = 0; k < 12; k++) rect(ctx, x + 12 + k * 8, FASCIA + 36, 6, 20, ["#B03A2E", "#2D4C9A", "#E3B556", "#4F7A5A"][k % 4]);
  if (f.shop === "THE CROWN") {
    const px = x + 30;
    const py = FASCIA + 46;
    poly(ctx, [px - 12, py + 8, px - 12, py - 6, px - 6, py, px, py - 10, px + 6, py, px + 12, py - 6, px + 12, py + 8], "#E3B556");
    for (let k = 0; k < 3; k++) rect(ctx, x + 60 + k * 14, FASCIA + 60, 8, 22, "#C9A23F");
  }
}

/** Draws the whole picture into ctx, in world units (0..BW, 0..BH). Same picture every time. */
function draw(ctx: Ctx) {
  const rand = rng(97531);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, BW, BH);
  ctx.clip();

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, 220);
  sky.addColorStop(0, "#A3BFD2");
  sky.addColorStop(1, "#E2E5DC");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, BW, 260);
  cloud(ctx, 100, 46, 1.2);
  cloud(ctx, 940, 56, 1.2);
  cloud(ctx, 400, 30, 0.7);
  for (const [px, py] of [[1120, 40], [1150, 30], [1176, 46], [1206, 34]]) {
    ell(ctx, px, py, 8, 3, "#6E747A");
    line(ctx, [px - 10, py - 5, px - 3, py, px + 3, py, px + 10, py - 6], "#5F6670", 2);
  }

  // the square behind the stalls
  rect(ctx, 0, GROUND, BW, BH - GROUND, "#BDB4A4");

  // houses and the clock tower
  FACADES.forEach((f, i) => facade(ctx, f, i, rand));
  {
    const x = 610;
    const w = 124;
    rect(ctx, x, 60, w, GROUND - 60, "#C9B58C");
    for (let y = 70; y < GROUND; y += 12) rect(ctx, x, y, w, 1.2, "rgba(90,70,40,.22)");
    for (let y = 60; y < GROUND; y += 12) for (let xx = x + ((y / 12) % 2) * 10; xx < x + w; xx += 20) rect(ctx, xx, y, 1, 12, "rgba(90,70,40,.16)");
    rect(ctx, x - 6, 54, w + 12, 10, "#B5A27A");
    poly(ctx, [x - 4, 56, x + w / 2, -10, x + w + 4, 56], "#5F7C76");
    for (let k = 1; k < 5; k++) line(ctx, [x + (w / 2) * (k / 5), 56 - 66 * (k / 5), x + w - (w / 2) * (k / 5), 56 - 66 * (k / 5)], "rgba(20,40,40,.25)", 1);
    line(ctx, [x + w / 2, 18, x + w / 2, 2], "#2A2927", 2);
    poly(ctx, [x + w / 2, 8, x + w / 2 + 18, 10, x + w / 2 + 22, 6, x + w / 2 + 12, 5], "#2A2927");
    line(ctx, [x + w / 2 - 10, 14, x + w / 2 + 10, 14], "#2A2927", 1.4);
    // belfry
    for (let k = 0; k < 3; k++) {
      const bx = x + 18 + k * 32;
      rect(ctx, bx, 76, 22, 30, "#3A3631");
      ctx.fillStyle = "#3A3631";
      ctx.beginPath();
      ctx.arc(bx + 11, 76, 11, Math.PI, 0);
      ctx.fill();
    }
    ell(ctx, x + w / 2, 98, 8, 9, "#C9A23F");
    // the clock
    const cx = x + w / 2;
    const cy = 158;
    ell(ctx, cx, cy, 38, 38, "#2A2927");
    ell(ctx, cx, cy, 33, 33, "#F4F1EA");
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      rect(ctx, cx + Math.cos(a) * 27 - 1.5, cy + Math.sin(a) * 27 - 1.5, 3, 3, "#1C1C1A");
    }
    line(ctx, [cx, cy, cx + 14, cy + 8], "#1C1C1A", 3);
    line(ctx, [cx, cy, cx - 4, cy - 26], "#1C1C1A", 2);
    ell(ctx, cx, cy, 3, 3, "#B03A2E");
    // windows and door
    for (const wy of [222, 290]) {
      rect(ctx, cx - 10, wy, 20, 40, "#3A3631");
      ctx.fillStyle = "#3A3631";
      ctx.beginPath();
      ctx.arc(cx, wy, 10, Math.PI, 0);
      ctx.fill();
      rect(ctx, cx - 1, wy - 6, 2, 46, "#C9B58C");
    }
    rect(ctx, cx - 46, 340, 92, 40, "#2A2927");
    text(ctx, "CLOCK RUNS SLOW", cx, 352, 9, "#F4F1EA", "Libre Caslon Text", 700);
    text(ctx, "SINCE 1887", cx, 368, 9, "#E3B556", "Libre Caslon Text", 700);
    rect(ctx, cx - 18, 404, 36, 36, "#5C4632");
    ctx.fillStyle = "#5C4632";
    ctx.beginPath();
    ctx.arc(cx, 404, 18, Math.PI, 0);
    ctx.fill();
    rect(ctx, cx - 1, 390, 2, 50, "rgba(0,0,0,.3)");
  }

  // bunting
  const strands: [number, number, number, number][] = [[0, 168, 610, 188], [734, 186, BW, 162], [0, 236, 610, 200], [734, 206, BW, 240], [150, 150, 460, 160], [880, 152, 1190, 150]];
  strands.forEach(([x0, y0, x1, y1], s) => {
    const sag = 30;
    ctx.strokeStyle = "#3A3631";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1);
    ctx.stroke();
    const n = Math.round((x1 - x0) / 22);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const bx = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * ((x0 + x1) / 2) + t * t * x1;
      const by = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * ((y0 + y1) / 2 + sag * 2) + t * t * y1;
      poly(ctx, [bx - 6, by, bx + 6, by, bx, by + 14], ["#B03A2E", "#E3B556", "#2D4C9A", "#4F7A5A", "#F4F1EA", "#D98C5F"][(k + s) % 6]);
    }
  });

  // cobbles
  for (let y = GROUND; y < BH + 10; y += 11) {
    const t = (y - GROUND) / (BH - GROUND);
    const cw = 9 + t * 7;
    for (let x = ((y / 11) % 2) * cw * 0.5 - cw; x < BW + cw; x += cw * 1.1 + 1) {
      ell(ctx, x, y, cw / 2, 4.6, rand() < 0.5 ? "#A9A090" : "#B3AA99");
    }
  }
  for (let k = 0; k < 400; k++) rect(ctx, rand() * BW, GROUND + rand() * (BH - GROUND), 2, 2, "rgba(40,36,30,.12)");

  // back stalls
  for (const s of BACK) {
    rect(ctx, s.x + 8, BACK_AWN, s.w - 8, BACK_COUNTER - BACK_AWN, "rgba(40,36,30,.35)");
    if (s.sign === "CHEESE") stallholder(ctx, 924, 422, "#F4F1EA", SKIN[0], "#C9C2B4", "#2D4C9A", "#2D4C9A");
    if (s.sign === "FLOWERS") stallholder(ctx, 120, 412, "#4F7A5A", SKIN[2], "#1C1C1A", "#7A5A3C");
    if (s.sign === "BREAD & CAKES") stallholder(ctx, 440, 410, "#F4F1EA", SKIN[3], "#E3B556", "#B4513A");
    if (s.sign === "EGGS & HONEY") stallholder(ctx, 1200, 416, "#9C6B3E", SKIN[4], "#6B4A2E", "#F4F1EA", "#4F7A5A");
    stall(ctx, s, BACK_AWN, 28, BACK_COUNTER, BACK_COUNTER + 46, false);
    backStallContents(ctx, s, rand);
  }
  // the coffee cart
  {
    const x = 566;
    rect(ctx, x, 470, 108, 56, "#2F5D4A");
    rect(ctx, x, 470, 108, 6, "#E3B556");
    text(ctx, "COFFEE", x + 54, 494, 13, "#F4F1EA", "Libre Caslon Text", 700);
    text(ctx, "FLAT WHITE 3.80", x + 54, 512, 7, "#E3B556", "Courier Prime", 700);
    rect(ctx, x + 70, 450, 26, 20, "#B9BDBF");
    rect(ctx, x + 10, 456, 12, 14, "#F4F1EA");
    rect(ctx, x + 26, 458, 10, 12, "#F4F1EA");
    for (const wx of [x + 18, x + 90]) {
      ell(ctx, wx, 530, 10, 10, "#1C1C1A");
      ell(ctx, wx, 530, 4, 4, "#B9BDBF");
    }
    poly(ctx, [x - 4, 446, x + 112, 446, x + 104, 436, x + 4, 436], "#B03A2E");
  }

  // the crowd
  for (const p of CROWD_PEOPLE) {
    const h = p.h ?? 112;
    const feet = CROWD + (p.dy ?? 0);
    small(ctx, p.x, feet, h, { coat: p.coat, legs: p.legs, skin: SKIN[p.s], hair: p.hair, hat: p.hat, arm: p.arm });
    if (p.bag) {
      const s = h / 112;
      rect(ctx, p.x - 26 * s, feet - 62 * s, 18 * s, 22 * s, p.bag);
      line(ctx, [p.x - 22 * s, feet - 62 * s, p.x - 17 * s, feet - 74 * s, p.x - 12 * s, feet - 62 * s], "#6B5B48", 1.4);
      if (p.bag === "#F4F1EA") line(ctx, [p.x - 22 * s, feet - 64 * s, p.x - 20 * s, feet - 72 * s], "#6E9A63", 3);
    }
  }
  // the pram
  {
    const x = 470;
    ctx.fillStyle = "#2D4C9A";
    ctx.beginPath();
    ctx.moveTo(x, 560);
    ctx.lineTo(x + 46, 560);
    ctx.quadraticCurveTo(x + 46, 596, x + 20, 596);
    ctx.lineTo(x, 596);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 46, 562, 20, Math.PI, Math.PI * 1.5);
    ctx.lineTo(x + 46, 562);
    ctx.fill();
    line(ctx, [x, 560, x - 10, 548, x - 16, 548], "#3A3631", 2);
    for (const wx of [x + 6, x + 38]) {
      ctx.strokeStyle = "#1C1C1A";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, 604, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ell(ctx, x + 32, 556, 6, 5, SKIN[3]);
  }
  // the dog
  ell(ctx, 636, 596, 18, 9, "#3A3631");
  ell(ctx, 656, 586, 8, 7, "#3A3631");
  ell(ctx, 652, 581, 4, 6, "#1C1C1A", 0.5);
  for (const lx of [624, 632, 642, 650]) line(ctx, [lx, 600, lx, 612], "#3A3631", 3.5);
  line(ctx, [620, 592, 610, 582], "#3A3631", 3);
  line(ctx, [560, 534, 648, 588], "#B03A2E", 1.2);

  // front stalls
  stallholder(ctx, 226, 634, "#3E6E8E", SKIN[1], "#1C1C1A", "#B03A2E", "#B03A2E");
  stallholder(ctx, 600, 618, "#E3B556", SKIN[0], "#6B4A2E", "#4F7A5A");
  stallholder(ctx, 784, 632, "#F4F1EA", SKIN[2], "#1C1C1A", "#3E6E8E", "#F4F1EA");
  stallholder(ctx, 1132, 640, "#D8A6A0", SKIN[3], "#C9C2B4", "#6B4E7A");
  for (const s of FRONT) {
    rect(ctx, s.x + 8, FRONT_COUNTER - 30, s.w - 8, 30, "#8A6440");
    rect(ctx, s.x + 8, CLOTH, s.w - 8, COBBLE - CLOTH, "rgba(40,36,30,.45)");
    stall(ctx, s, FRONT_AWN, 34, FRONT_COUNTER, CLOTH, true);
  }
  fruitStall(ctx, rand);
  vegStall(ctx, rand);
  fishStall(ctx, rand);
  sockStall(ctx);
  // under the tables
  for (const [ux, c] of [[30, "#B03A2E"], [150, "#E3C24A"], [400, "#7DA05E"], [520, "#C9A57A"]] as const) {
    crate(ctx, ux, 782, 70, 26);
    heap(ctx, ux, 786, 70, rand, (cx, cy) => ell(ctx, cx, cy, 6, 5, c), 12, 1);
  }
  rect(ctx, 700, 784, 60, 24, "#F4F1EA");
  rect(ctx, 700, 784, 60, 5, "#3E6E8E");
  text(ctx, "ICE", 730, 798, 9, "#3E6E8E", "Work Sans", 700);
  for (const [bx, c] of [[996, "#C9A57A"], [1060, "#B8925F"]] as const) {
    rect(ctx, bx, 780, 56, 28, c);
    rect(ctx, bx + 22, 780, 12, 28, "rgba(232,220,186,.8)");
  }

  // the busker
  {
    const x = 1236;
    rect(ctx, x - 22, 760, 44, 40, "#8A6440");
    for (let k = 0; k < 3; k++) rect(ctx, x - 22, 766 + k * 12, 44, 2, "rgba(40,30,20,.3)");
    rect(ctx, x - 14, 740, 10, 54, "#2A2927");
    rect(ctx, x + 4, 740, 10, 54, "#2A2927");
    rect(ctx, x - 14, 736, 28, 10, "#2A2927");
    ell(ctx, x - 9, 800, 9, 5, "#2A2927");
    ell(ctx, x + 9, 800, 9, 5, "#2A2927");
    ell(ctx, x, 712, 18, 32, "#B4513A");
    ell(ctx, x, 664, 12, 14, SKIN[4]);
    ctx.fillStyle = "#3A2A1E";
    ctx.beginPath();
    ctx.ellipse(x, 660, 13, 11, 0, Math.PI, 0);
    ctx.fill();
    rect(ctx, x - 14, 650, 28, 6, "#2D4C9A");
    rect(ctx, x - 10, 642, 20, 10, "#2D4C9A");
    ell(ctx, x - 4, 676, 8, 4, "#3A2A1E");
    ctx.save();
    ctx.translate(x + 2, 724);
    ctx.rotate(-0.5);
    ell(ctx, -14, 0, 16, 14, "#C98F5E");
    ell(ctx, 6, 0, 12, 11, "#C98F5E");
    ell(ctx, -6, 0, 5, 5, "#3A2A1E");
    rect(ctx, 14, -3, 46, 6, "#5A3E28");
    rect(ctx, 58, -5, 12, 10, "#3A2A1E");
    ctx.restore();
    line(ctx, [x - 14, 700, x - 6, 724], "#B4513A", 7);
    line(ctx, [x + 14, 696, x + 30, 704, x + 40, 698], "#B4513A", 7);
    // the case
    rect(ctx, 1186, 818, 100, 26, "#2A2927");
    rect(ctx, 1190, 822, 92, 18, "#7A2E2E");
    for (let k = 0; k < 9; k++) ell(ctx, 1198 + rand() * 76, 826 + rand() * 10, 3, 3, k % 3 ? "#C9A23F" : "#B9BDBF");
    // the sign
    poly(ctx, [1286, 814, 1292, 756, 1342, 756, 1342, 814], "#D9C29A");
    text(ctx, "REQUESTS", 1316, 766, 8, "#1C1C1A", "Courier Prime", 700);
    text(ctx, "50p", 1316, 777, 8, "#1C1C1A", "Courier Prime", 700);
    text(ctx, "STOPPING", 1316, 791, 8, "#B03A2E", "Courier Prime", 700);
    text(ctx, "5.00", 1316, 803, 8.5, "#B03A2E", "Courier Prime", 700);
  }

  // the front of the picture
  crate(ctx, 4, 816, 56, 40);
  crate(ctx, 54, 830, 60, 34);
  heap(ctx, 54, 834, 60, rand, (cx, cy) => ell(ctx, cx, cy, 6, 5.5, "#8FAE5A"), 12, 2);
  heap(ctx, 4, 820, 56, rand, (cx, cy) => ell(ctx, cx, cy, 6, 5, "#E07B2E"), 12, 2);
  ell(ctx, 708, 846, 9, 8, "#B03A2E");
  ell(ctx, 705, 843, 2, 2, "rgba(255,255,255,.4)");
  line(ctx, [708, 838, 710, 832], "#6B4A2E", 1.6);
  rect(ctx, 760, 846, 30, 3, "#C9954E");
  for (const [px, py, f, pk] of [[400, 838, false, true], [444, 852, true, false], [496, 832, false, false], [552, 850, true, true], [1020, 840, false, true], [1066, 856, true, false], [1120, 836, false, false], [1170, 852, true, true]] as const) pigeon(ctx, px, py, f, pk);
  for (let k = 0; k < 14; k++) ell(ctx, 420 + rand() * 140, 840 + rand() * 20, 1.6, 1.2, "#D9B48A");
  // the shopping trolley bag
  rect(ctx, 866, 806, 36, 46, "#4F7A5A");
  for (let k = 0; k < 4; k++) rect(ctx, 866, 812 + k * 10, 36, 3, "#E3B556");
  line(ctx, [900, 806, 908, 790, 900, 786], "#3A3631", 2.5);
  ell(ctx, 872, 856, 6, 6, "#1C1C1A");
  ell(ctx, 896, 856, 6, 6, "#1C1C1A");
  for (let k = 0; k < 4; k++) line(ctx, [876 + k * 6, 806, 878 + k * 6, 796], "#6E9A63", 3);

  // shoppers right in front
  small(ctx, 330, 960, 170, { coat: "#5E4A72", legs: "#2A2927", skin: SKIN[3], hair: "#6B4A2E" });
  small(ctx, 658, 966, 176, { coat: "#C9A23F", legs: "#2A2927", skin: SKIN[1], hair: "#1C1C1A", hat: "#3A3631" });
  small(ctx, 962, 958, 166, { coat: "#3E6E4E", legs: "#2A2927", skin: SKIN[0], hair: "#C9783E" });
  rect(ctx, 976, 838, 26, 30, "#B4513A");

  grain(ctx, rand);
  ctx.restore();
}

export const market: Scene = { title: "The Market", draw, labels: LABELS, landmarks: LANDMARKS };
