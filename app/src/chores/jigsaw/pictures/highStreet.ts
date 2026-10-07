// The High Street: six terraced houses with shops underneath, the kind of scene jigsaws are made
// of. Busy on purpose, so most pieces have something on them you can place.
import { BW, BH, rng, rect, ell, poly, line, text, person as stockPerson, grain, SKIN, type Box, type Ctx, type PersonOpts, type Scene } from "./common";

const LABELS: Box[] = [];
const lab = (name: string, x: number, y: number, w: number, h: number) => LABELS.push({ x, y, w, h, name });

const EAVES = 250;
const FASCIA = 538;
const AWNING = 578;
const SHOP = 606;
const PAVE = 690;
const KERB = 772;
const ROAD = 780;
const FEET = 760;
const HW = BW / 6;

type Win =
  | { kind: "curtains"; col: string; pat?: "stripes" | "dots"; colour: string }
  | { kind: "cat" | "wave" | "plant" | "lamp" | "tolet" | "fish" | "teddy" | "blinds" | "reader" | "bird" | "phone" | "boxes" | "laundry" | "dark" | "telescope" | "guitar" | "scarf" | "telly" | "clock" | "man" };

const C = (col: string, colour: string, pat?: "stripes" | "dots"): Win => ({ kind: "curtains", col, colour, pat });
const K = (kind: Exclude<Win["kind"], "curtains">): Win => ({ kind }) as Win;

const HOUSES = [
  { wall: "#AE5B42", name: "the red brick house", ridge: 150, brick: true, chim: 160, shop: "BAKERY", sc: "#2F5D4A", ink: "#E8C66A", stripe: "#2F5D4A",
    wins: [C("#C9A23F", "mustard", "stripes"), K("cat"), C("#7D8C9E", "grey"), K("plant"), K("dark"), K("wave")] },
  { wall: "#E2D3AE", name: "the cream house", ridge: 176, chim: 30, dormer: true, shop: "LAUNDERETTE", sc: "#2D4C9A", ink: "#FFFEFA", stripe: "#2D4C9A",
    wins: [K("lamp"), C("#B5654A", "rust", "dots"), K("tolet"), C("#4F7A5A", "green"), K("reader"), C("#E2C7C0", "pink")] },
  { wall: "#A3B79D", name: "the green house", ridge: 138, chim: 168, shop: "FISH & CHIPS", sc: "#B03A2E", ink: "#FFFEFA", stripe: "#B03A2E",
    wins: [K("blinds"), K("teddy"), C("#2D4C9A", "blue"), K("fish"), C("#C0533F", "red", "stripes"), K("bird")] },
  { wall: "#91A8C0", name: "the blue house", ridge: 186, chim: 26, aerial: true, shop: "KEYS CUT", sc: "#2A2927", ink: "#E3B556", stripe: "#E3B556",
    wins: [C("#E3B556", "yellow"), K("telescope"), K("dark"), K("phone"), C("#6B4E7A", "purple", "dots"), K("laundry")] },
  { wall: "#D8AA52", name: "the yellow house", ridge: 160, chim: 164, dormer: true, shop: "NEWSAGENT", sc: "#7A2E2E", ink: "#FFFEFA", stripe: "#7A2E2E",
    wins: [K("guitar"), C("#9C6B3E", "brown"), K("scarf"), C("#8FAE8A", "sage", "stripes"), K("telly"), K("boxes")] },
  { wall: "#D8A6A0", name: "the pink house", ridge: 172, chim: 34, shop: "FLOWERS", sc: "#5E4A72", ink: "#FFFEFA", stripe: "#5E4A72",
    wins: [K("clock"), C("#3E6E8E", "navy"), K("plant"), C("#D98C5F", "orange"), K("cat"), K("man")] },
];

const WIN_NAMES: Record<string, string> = {
  cat: "the cat in the window",
  wave: "the woman waving",
  plant: "the plant in the window",
  lamp: "the lamp in the window",
  tolet: "the TO LET sign",
  fish: "the goldfish",
  teddy: "the teddy bear",
  blinds: "the window with the blinds",
  reader: "the man reading the paper",
  bird: "the budgie",
  phone: "the woman on the phone",
  boxes: "the window full of boxes",
  laundry: "the washing in the window",
  dark: "a dark window",
  telescope: "the telescope",
  guitar: "the guitar",
  scarf: "the scarf in the window",
  telly: "the telly",
  clock: "the clock",
  man: "the man waving",
};

const WX = (h: number, k: number) => h * HW + 17 + k * 69;
const WY = [272, 392];
const WW = 52;
const WH = 80;

// Names for everything, in the order things are drawn (later ones sit on top).
lab("the sky", 0, 0, BW, EAVES);
lab("a cloud", 860, 44, 150, 64);
lab("a cloud", 1120, 92, 170, 60);
lab("a cloud", 40, 118, 150, 52);
lab("the birds", 960, 26, 110, 40);
lab("Derek's banner", 120, 38, 438, 52);
lab("the little plane", 556, 34, 76, 46);
HOUSES.forEach((hs, h) => {
  const x0 = h * HW;
  lab(hs.name, x0, EAVES, HW, FASCIA - EAVES);
  lab("the roof", x0, hs.ridge, HW, EAVES - hs.ridge);
  lab("a chimney", x0 + hs.chim - 6, hs.ridge - 52, 48, 62);
  hs.wins.forEach((w, n) => {
    const name = w.kind === "curtains" ? `the window with the ${w.colour} curtains` : WIN_NAMES[w.kind];
    lab(name, WX(h, n % 3) - 4, WY[(n / 3) | 0] - 6, WW + 8, WH + 16);
  });
  lab(`the ${shopName(hs.shop)}`, x0, FASCIA, HW, PAVE - FASCIA);
});
lab("the kite", 610, 70, 70, 120);
lab("the cat on the roof", 548, 104, 44, 40);
lab("the pigeons on the roof", 940, 140, 90, 26);
lab("the pavement", 0, PAVE, BW, KERB - PAVE);
lab("the road", 0, KERB, BW, BH - KERB);
lab("the lamp post", 434, 440, 30, FEET - 440);
lab("the lamp post", 882, 440, 30, FEET - 440);
lab("the bins", 506, 676, 80, 86);
lab("the bench", 600, 708, 112, 56);
lab("the woman on the bench", 620, 650, 50, 100);
lab("the pigeons", 700, 742, 90, 22);
lab("the post box", 808, 680, 44, 82);
lab("the postman", 760, 648, 46, 114);
lab("the board about the jigsaw", 1004, 680, 72, 84);
lab("the flowers outside the shop", 1076, 692, 80, 70);
lab("the woman with the shopping", 150, 646, 60, 116);
lab("the man with the dog", 278, 646, 44, 116);
lab("the dog", 320, 718, 52, 44);
lab("the boy with the balloon", 456, 676, 34, 86);
lab("the red balloon", 470, 520, 44, 160);
lab("the woman on the phone", 944, 646, 40, 116);
lab("the blue car", 30, 754, 270, 104);
lab("the man on the bike", 538, 740, 120, 116);
lab("the bus", 1150, 512, BW - 1150, BH - 512);

function shopName(s: string) {
  return { BAKERY: "bakery", LAUNDERETTE: "launderette", "FISH & CHIPS": "chip shop", "KEYS CUT": "key cutter's", NEWSAGENT: "newsagent's", FLOWERS: "florist's" }[s] ?? "shop";
}

/** Places worth starting the puzzle from: things you'd find first on the lid. */
const LANDMARKS = [
  { x: 340, y: 62 }, // the banner
  { x: 112, y: 560 }, // the bakery sign
  { x: 560, y: 120 }, // the cat on the roof
  { x: 1250, y: 650 }, // the bus
  { x: 830, y: 720 }, // the post box
];

const person = (ctx: Ctx, x: number, o: PersonOpts) => stockPerson(ctx, x, { feet: FEET, ...o });

function windowContents(ctx: Ctx, w: Win, x: number, y: number, rand: () => number) {
  const gx = x + 5;
  const gy = y + 5;
  const gw = WW - 10;
  const gh = WH - 10;
  const lit = ["lamp", "reader", "wave", "man", "phone", "telly", "guitar", "clock", "bird", "teddy"].includes(w.kind);
  // the room behind the glass
  const g = ctx.createLinearGradient(gx, gy, gx, gy + gh);
  if (w.kind === "telly") {
    g.addColorStop(0, "#6F8FB5");
    g.addColorStop(1, "#3E5672");
  } else if (lit) {
    g.addColorStop(0, "#E9CF96");
    g.addColorStop(1, "#C9A46A");
  } else {
    g.addColorStop(0, "#56636D");
    g.addColorStop(1, "#38424A");
  }
  ctx.fillStyle = g;
  ctx.fillRect(gx, gy, gw, gh);
  const cx = gx + gw / 2;
  const bottom = gy + gh;
  switch (w.kind) {
    case "curtains": {
      ctx.fillStyle = "rgba(233,207,150,.55)";
      ctx.fillRect(gx + 12, gy, gw - 24, gh);
      for (const side of [0, 1]) {
        const x0 = side ? gx + gw : gx;
        const dir = side ? -1 : 1;
        ctx.fillStyle = w.col;
        ctx.beginPath();
        ctx.moveTo(x0, gy);
        ctx.lineTo(x0 + dir * 17, gy);
        ctx.quadraticCurveTo(x0 + dir * 8, gy + gh * 0.45, x0 + dir * 13, bottom);
        ctx.lineTo(x0, bottom);
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.clip();
        if (w.pat === "stripes") for (let k = 2; k < 18; k += 5) rect(ctx, x0 + dir * k - (side ? 2 : 0), gy, 2, gh, "rgba(255,254,250,.4)");
        if (w.pat === "dots") for (let yy = gy + 4; yy < bottom; yy += 7) for (let k = 3; k < 17; k += 6) ell(ctx, x0 + dir * (k + ((yy / 7) % 2) * 3), yy, 1.3, 1.3, "rgba(255,254,250,.55)");
        for (let k = 4; k < 16; k += 5) rect(ctx, x0 + dir * k, gy, 1, gh, "rgba(28,28,26,.14)");
        ctx.restore();
      }
      rect(ctx, gx - 2, gy - 2, gw + 4, 4, "#6B5B48");
      break;
    }
    case "cat": {
      const c = rand() < 0.5 ? "#C9783E" : "#3A3631";
      ell(ctx, cx + 2, bottom - 12, 12, 11, c);
      ell(ctx, cx - 5, bottom - 26, 8, 7, c);
      poly(ctx, [cx - 12, bottom - 30, cx - 10, bottom - 38, cx - 6, bottom - 32], c);
      poly(ctx, [cx - 3, bottom - 32, cx + 1, bottom - 38, cx + 2, bottom - 30], c);
      line(ctx, [cx + 12, bottom - 6, cx + 18, bottom - 3, cx + 17, bottom - 14], c, 3);
      ell(ctx, cx - 8, bottom - 27, 1.2, 1.2, "#E3D25A");
      ell(ctx, cx - 2, bottom - 27, 1.2, 1.2, "#E3D25A");
      break;
    }
    case "wave":
    case "man": {
      const coat = w.kind === "wave" ? "#C0533F" : "#4F7A5A";
      ell(ctx, cx, bottom + 4, 15, 26, coat);
      line(ctx, [cx + 10, bottom - 14, cx + 18, bottom - 34, cx + 14, bottom - 52], coat, 6);
      ell(ctx, cx + 14, bottom - 54, 4, 4, SKIN[w.kind === "wave" ? 0 : 2]);
      ell(ctx, cx, bottom - 30, 9, 11, SKIN[w.kind === "wave" ? 0 : 2]);
      ctx.fillStyle = w.kind === "wave" ? "#6B4A2E" : "#2A2927";
      ctx.beginPath();
      ctx.ellipse(cx, bottom - 34, 10, 9, 0, Math.PI, 0);
      ctx.fill();
      if (w.kind === "wave") rect(ctx, cx - 10, bottom - 34, 4, 16, "#6B4A2E");
      break;
    }
    case "plant": {
      rect(ctx, cx - 9, bottom - 16, 18, 16, "#B5654A");
      for (let k = 0; k < 11; k++) {
        const a = -Math.PI / 2 + (k - 5) * 0.28;
        ell(ctx, cx + Math.cos(a) * 15, bottom - 18 + Math.sin(a) * 22, 10, 4, k % 2 ? "#4F7A5A" : "#6E9A63", a);
      }
      break;
    }
    case "lamp": {
      ell(ctx, cx, gy + 22, 22, 22, "rgba(255,240,190,.5)");
      poly(ctx, [cx - 11, gy + 30, cx + 11, gy + 30, cx + 7, gy + 14, cx - 7, gy + 14], "#F4E1A6");
      rect(ctx, cx - 1.5, gy + 30, 3, gh - 32, "#4A3B2E");
      rect(ctx, cx - 8, bottom - 3, 16, 3, "#4A3B2E");
      break;
    }
    case "tolet": {
      rect(ctx, gx + 4, gy + 18, gw - 8, 30, "#FFFEFA");
      text(ctx, "TO", cx, gy + 27, 10, "#B03A2E", "Work Sans", 700);
      text(ctx, "LET", cx, gy + 39, 10, "#B03A2E", "Work Sans", 700);
      break;
    }
    case "fish": {
      ell(ctx, cx, bottom - 13, 15, 13, "rgba(190,220,232,.85)");
      ell(ctx, cx + 2, bottom - 13, 6, 3.5, "#E07B2E");
      poly(ctx, [cx - 3, bottom - 13, cx - 8, bottom - 17, cx - 8, bottom - 9], "#E07B2E");
      rect(ctx, cx - 12, bottom - 25, 24, 2, "rgba(255,255,255,.6)");
      break;
    }
    case "teddy": {
      ell(ctx, cx, bottom - 13, 13, 13, "#9C6B3E");
      ell(ctx, cx, bottom - 33, 10, 9, "#9C6B3E");
      ell(ctx, cx - 8, bottom - 41, 4, 4, "#9C6B3E");
      ell(ctx, cx + 8, bottom - 41, 4, 4, "#9C6B3E");
      ell(ctx, cx, bottom - 30, 4, 3, "#D9B48A");
      ell(ctx, cx - 4, bottom - 35, 1.3, 1.3, "#1C1C1A");
      ell(ctx, cx + 4, bottom - 35, 1.3, 1.3, "#1C1C1A");
      break;
    }
    case "blinds": {
      for (let yy = gy; yy < gy + gh * 0.62; yy += 5) rect(ctx, gx, yy, gw, 4, "#E7E2D5");
      rect(ctx, cx - 0.5, gy + gh * 0.62, 1, 12, "#9C958A");
      break;
    }
    case "reader": {
      rect(ctx, gx + 2, bottom - 26, gw - 4, 26, "#7A4E3A");
      ell(ctx, cx + 1, bottom - 40, 7, 8, SKIN[3]);
      rect(ctx, gx + 6, bottom - 44, gw - 12, 24, "#ECE8DD");
      for (let k = 0; k < 4; k++) rect(ctx, gx + 9, bottom - 40 + k * 5, gw - 18, 1.6, "rgba(28,28,26,.45)");
      rect(ctx, cx - 0.5, bottom - 44, 1, 24, "rgba(28,28,26,.3)");
      break;
    }
    case "bird": {
      ctx.strokeStyle = "#B8A27A";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, gy + 34, 14, Math.PI, 0);
      ctx.lineTo(cx + 14, gy + 58);
      ctx.lineTo(cx - 14, gy + 58);
      ctx.closePath();
      ctx.stroke();
      for (let k = -9; k <= 9; k += 6) line(ctx, [cx + k, gy + 22 + Math.abs(k) * 0.4, cx + k, gy + 58], "#B8A27A", 1);
      ell(ctx, cx, gy + 44, 5, 7, "#7DB85C");
      ell(ctx, cx, gy + 37, 3.6, 3.6, "#E8D84F");
      line(ctx, [cx - 12, gy + 48, cx + 12, gy + 48], "#8A6A44", 1.6);
      line(ctx, [cx, gy + 18, cx, gy + 10], "#B8A27A", 1.4);
      break;
    }
    case "phone": {
      ell(ctx, cx - 2, bottom + 4, 13, 26, "#6B4E7A");
      ell(ctx, cx - 2, bottom - 30, 8.5, 10, SKIN[1]);
      ctx.fillStyle = "#2A2927";
      ctx.beginPath();
      ctx.ellipse(cx - 2, bottom - 33, 10, 10, 0, Math.PI, 0);
      ctx.fill();
      rect(ctx, cx + 4, bottom - 46, 4, 26, "#2A2927");
      line(ctx, [cx + 8, bottom - 14, cx + 12, bottom - 26, cx + 7, bottom - 32], "#6B4E7A", 5);
      rect(ctx, cx + 5, bottom - 38, 4, 9, "#1C1C1A");
      break;
    }
    case "boxes": {
      const cols = ["#C9A57A", "#B8925F", "#D4B48A"];
      let k = 0;
      for (let yy = bottom - 20; yy > gy - 4; yy -= 19)
        for (let xx = gx - 3 + (k % 2) * 6; xx < gx + gw; xx += 22) {
          rect(ctx, xx, yy, 21, 18, cols[k++ % 3]);
          rect(ctx, xx + 8, yy, 5, 18, "rgba(232,220,186,.8)");
        }
      break;
    }
    case "laundry": {
      line(ctx, [gx, gy + 14, gx + gw, gy + 16], "#E7E2D5", 1);
      const items = ["#C0533F", "#FFFEFA", "#2D4C9A", "#E3B556"];
      for (let k = 0; k < 4; k++) {
        const xx = gx + 2 + k * 10;
        if (k % 2) rect(ctx, xx, gy + 15, 8, 18, items[k]);
        else poly(ctx, [xx, gy + 15, xx + 9, gy + 15, xx + 9, gy + 26, xx + 4, gy + 30, xx + 2, gy + 26], items[k]);
      }
      break;
    }
    case "dark": {
      poly(ctx, [gx + 6, gy + gh, gx + 18, gy, gx + 26, gy, gx + 14, gy + gh], "rgba(255,255,255,.08)");
      break;
    }
    case "telescope": {
      line(ctx, [cx, bottom - 20, cx - 10, bottom, cx, bottom - 20, cx + 10, bottom, cx, bottom - 20, cx, bottom], "#3A3631", 1.6);
      ctx.save();
      ctx.translate(cx, bottom - 22);
      ctx.rotate(-0.6);
      rect(ctx, -6, -4, 30, 8, "#C9A23F");
      rect(ctx, 22, -5, 6, 10, "#A9852E");
      ctx.restore();
      break;
    }
    case "guitar": {
      ctx.save();
      ctx.translate(cx + 2, bottom - 8);
      ctx.rotate(-0.25);
      ell(ctx, 0, -6, 10, 9, "#B5733A");
      ell(ctx, 0, -20, 8, 7, "#B5733A");
      ell(ctx, 0, -12, 3, 3, "#3A2A1E");
      rect(ctx, -1.8, -50, 3.6, 30, "#5A3E28");
      rect(ctx, -3, -56, 6, 7, "#3A2A1E");
      ctx.restore();
      break;
    }
    case "scarf": {
      for (let k = 0; k < 9; k++) rect(ctx, gx + 4, gy + 10 + k * 6, gw - 8, 6, k % 2 ? "#FFFEFA" : "#B03A2E");
      for (let k = 0; k < 6; k++) rect(ctx, gx + 6 + k * 6, gy + 64, 2, 5, "#B03A2E");
      break;
    }
    case "telly": {
      rect(ctx, gx + 6, bottom - 34, gw - 12, 24, "#2A2927");
      rect(ctx, gx + 9, bottom - 31, gw - 18, 18, "#9FC3E0");
      ell(ctx, cx, bottom - 22, 6, 4, "#E3B556");
      rect(ctx, cx - 8, bottom - 10, 16, 10, "#6B5B48");
      break;
    }
    case "clock": {
      ell(ctx, cx, gy + 28, 15, 15, "#FFFEFA");
      ctx.strokeStyle = "#3A3631";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, gy + 28, 15, 0, Math.PI * 2);
      ctx.stroke();
      line(ctx, [cx, gy + 28, cx, gy + 18], "#1C1C1A", 1.6);
      line(ctx, [cx, gy + 28, cx + 8, gy + 31], "#1C1C1A", 1.6);
      break;
    }
  }
}

function sashBars(ctx: Ctx, x: number, y: number) {
  rect(ctx, x + 3, y + WH / 2 - 2, WW - 6, 4, "#EFEBE1");
  rect(ctx, x + WW / 2 - 1.2, y + 3, 2.4, WH - 6, "#EFEBE1");
}

function shopDisplay(ctx: Ctx, shop: string, x: number, y: number, w: number, h: number, rand: () => number) {
  const bottom = y + h;
  switch (shop) {
    case "BAKERY": {
      for (let s = 0; s < 3; s++) rect(ctx, x + 4, y + 22 + s * 22, w - 8, 3, "#C9B79A");
      for (let s = 0; s < 3; s++)
        for (let k = 0; k < 6; k++) ell(ctx, x + 14 + k * 21, y + 16 + s * 22, 9, 6, ["#C08A4A", "#A86E35", "#D9A55E"][(s + k) % 3]);
      rect(ctx, x + w - 34, y + 30, 24, 14, "#FFFEFA");
      rect(ctx, x + w - 30, y + 18, 16, 12, "#FFFEFA");
      ell(ctx, x + w - 22, y + 16, 3, 3, "#C0533F");
      break;
    }
    case "LAUNDERETTE": {
      for (let k = 0; k < 4; k++) {
        const mx = x + 18 + k * 34;
        rect(ctx, mx - 15, y + 16, 30, h - 16, "#ECEAE4");
        ell(ctx, mx, y + 44, 11, 11, "#2A2927");
        ell(ctx, mx, y + 44, 8.5, 8.5, ["#C0533F", "#7DB0D8", "#E3B556", "#A9BFA4"][k]);
        poly(ctx, [mx - 6, y + 46, mx + 4, y + 40, mx + 6, y + 48], "rgba(255,255,255,.55)");
      }
      break;
    }
    case "FISH & CHIPS": {
      rect(ctx, x + 6, y + 8, 60, 44, "#2A2927");
      ["COD 4.80", "CHIPS 2.90", "PEAS 1.20"].forEach((s, k) => text(ctx, s, x + 36, y + 15 + k * 10, 7.5, "#FFFEFA", "Courier Prime", 700));
      rect(ctx, x + 4, y + h - 26, w - 8, 26, "#B9BDBF");
      rect(ctx, x + 76, y + h - 38, 34, 12, "#E3C76A");
      ell(ctx, x + 112, y + 22, 26, 11, "#E3B556");
      poly(ctx, [x + 88, y + 22, x + 76, y + 12, x + 76, y + 32], "#E3B556");
      ell(ctx, x + 126, y + 19, 2, 2, "#1C1C1A");
      break;
    }
    case "KEYS CUT": {
      rect(ctx, x + 6, y + 6, w - 12, 46, "#7A5A3C");
      for (let r = 0; r < 3; r++)
        for (let k = 0; k < 9; k++) {
          const kx = x + 14 + k * 14;
          const ky = y + 12 + r * 14;
          ell(ctx, kx, ky, 3, 3, ["#E3B556", "#C9CCCB", "#C98F5E"][(r + k) % 3]);
          rect(ctx, kx - 1, ky, 2, 8, ["#E3B556", "#C9CCCB", "#C98F5E"][(r + k) % 3]);
        }
      text(ctx, "WHILE U WAIT", x + w / 2, y + 60, 10, "#E3B556", "Work Sans", 700);
      break;
    }
    case "NEWSAGENT": {
      for (let k = 0; k < 5; k++) rect(ctx, x + 6 + k * 24, y + 10, 20, 28, ["#F4F1EA", "#E7C9C3", "#F4F1EA", "#C9D7E0", "#F4F1EA"][k]);
      for (let k = 0; k < 5; k++) rect(ctx, x + 8 + k * 24, y + 14, 16, 4, "#1C1C1A");
      for (let k = 0; k < 6; k++) {
        const jx = x + 12 + k * 22;
        rect(ctx, jx - 8, y + 48, 16, 26, "rgba(230,240,240,.7)");
        for (let s = 0; s < 6; s++) ell(ctx, jx - 4 + (s % 2) * 8, y + 54 + Math.floor(s / 2) * 7, 3, 3, ["#C0533F", "#E3B556", "#7DB85C", "#D98CB0", "#7DB0D8"][(k + s) % 5]);
        rect(ctx, jx - 8, y + 46, 16, 3, "#C0533F");
      }
      break;
    }
    case "FLOWERS": {
      for (let k = 0; k < 14; k++) ell(ctx, x + 10 + rand() * (w - 20), y + 14 + rand() * (h - 30), 6, 6, ["#C0533F", "#E3B556", "#D98CB0", "#FFFEFA", "#8E6BB0"][k % 5]);
      for (let k = 0; k < 10; k++) ell(ctx, x + 10 + rand() * (w - 20), y + 20 + rand() * (h - 30), 7, 3, "#4F7A5A", rand() * 3);
      break;
    }
  }
}

/** Draws the whole picture into ctx, in world units (0..BW, 0..BH). Same picture every time. */
function draw(ctx: Ctx) {
  const rand = rng(24680);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, BW, BH);
  ctx.clip();

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, EAVES);
  sky.addColorStop(0, "#A9C3D3");
  sky.addColorStop(1, "#DDE5E0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, BW, EAVES);
  ell(ctx, 1250, 48, 26, 26, "rgba(255,250,228,.7)");
  const cloud = (x: number, y: number, s: number) => {
    for (const [dx, dy, r] of [[0, 0, 26], [28, -12, 30], [58, 0, 24], [30, 8, 26], [-22, 8, 16], [80, 8, 14]])
      ell(ctx, x + dx * s, y + dy * s, r * s * 1.2, r * s * 0.8, "#F6F4EE");
    rect(ctx, x - 24 * s, y + 10 * s, 120 * s, 10 * s, "#F6F4EE");
  };
  cloud(890, 76, 1);
  cloud(1150, 122, 1.1);
  cloud(70, 146, 0.9);
  for (const [bx, by] of [[970, 40], [992, 32], [1010, 46], [1040, 36], [1060, 52]]) line(ctx, [bx - 6, by - 4, bx, by, bx + 6, by - 4], "#4A4945", 1.6);
  // the plane and its banner
  line(ctx, [556, 62, 600, 58], "#4A4945", 1.2);
  ctx.fillStyle = "#FFFEFA";
  ctx.beginPath();
  ctx.moveTo(124, 44);
  for (let x = 124; x <= 556; x += 18) ctx.lineTo(x, 44 + Math.sin(x / 40) * 4);
  for (let x = 556; x >= 124; x -= 18) ctx.lineTo(x, 80 + Math.sin(x / 40) * 4);
  ctx.closePath();
  ctx.fill();
  text(ctx, "HAPPY 40TH DEREK", 340, 63, 26, "#B03A2E", "Work Sans", 700);
  poly(ctx, [592, 58, 584, 38, 594, 38, 606, 56], "#B03A2E");
  ell(ctx, 612, 60, 26, 7.5, "#E8E4DA");
  ell(ctx, 624, 56, 7, 4, "#5F7C96");
  ell(ctx, 612, 63, 13, 3, "#B03A2E");
  rect(ctx, 600, 57, 22, 2, "#B03A2E");
  line(ctx, [639, 50, 639, 70], "#3A3631", 1.6);

  // houses
  HOUSES.forEach((hs, h) => {
    const x0 = h * HW;
    // roof
    rect(ctx, x0, hs.ridge, HW, EAVES - hs.ridge, h % 2 ? "#5F6670" : "#6E6560");
    for (let y = hs.ridge + 10; y < EAVES; y += 10) rect(ctx, x0, y, HW, 1.2, "rgba(20,20,20,.22)");
    for (let y = hs.ridge; y < EAVES; y += 10) for (let x = x0 + ((y / 10) % 2) * 9; x < x0 + HW; x += 18) rect(ctx, x, y, 1, 10, "rgba(20,20,20,.14)");
    rect(ctx, x0, hs.ridge - 4, HW, 7, "#8A5A44");
    // chimney
    const cx = x0 + hs.chim;
    rect(ctx, cx, hs.ridge - 42, 38, 46, hs.brick ? "#9C4E39" : "#A65F49");
    for (let y = hs.ridge - 36; y < hs.ridge; y += 7) rect(ctx, cx, y, 38, 1, "rgba(30,20,15,.25)");
    rect(ctx, cx - 3, hs.ridge - 46, 44, 6, "#8D857A");
    for (let k = 0; k < 3; k++) rect(ctx, cx + 3 + k * 12, hs.ridge - 58, 8, 13, "#B66A45");
    if (hs.aerial || h === 2) {
      line(ctx, [cx + 26, hs.ridge - 58, cx + 26, hs.ridge - 96], "#3A3631", 2);
      for (let k = 0; k < 4; k++) line(ctx, [cx + 14 + k * 3, hs.ridge - 88 + k * 4, cx + 38 - k * 3, hs.ridge - 88 + k * 4], "#3A3631", 1.4);
    }
    if (hs.dormer) {
      const dx = x0 + HW / 2 - 26;
      poly(ctx, [dx - 6, EAVES - 52, dx + 26, EAVES - 76, dx + 58, EAVES - 52], "#5A5550");
      rect(ctx, dx, EAVES - 52, 52, 46, hs.wall);
      rect(ctx, dx + 10, EAVES - 46, 32, 34, "#EFEBE1");
      rect(ctx, dx + 13, EAVES - 43, 26, 28, "#4E5A63");
      rect(ctx, dx + 25, EAVES - 43, 2, 28, "#EFEBE1");
    }
    // the wall
    rect(ctx, x0, EAVES, HW, FASCIA - EAVES, hs.wall);
    if (hs.brick) {
      for (let y = EAVES + 6; y < FASCIA; y += 7) rect(ctx, x0, y, HW, 1, "rgba(60,30,20,.2)");
      for (let y = EAVES; y < FASCIA; y += 7) for (let x = x0 + ((y / 7) % 2) * 7; x < x0 + HW; x += 14) rect(ctx, x, y, 1, 7, "rgba(60,30,20,.14)");
    } else {
      for (let k = 0; k < 160; k++) rect(ctx, x0 + rand() * HW, EAVES + rand() * (FASCIA - EAVES), 2, 2, "rgba(60,50,40,.05)");
    }
    rect(ctx, x0, EAVES, HW, 8, "rgba(28,28,26,.14)");
    rect(ctx, x0, 498, HW, 6, "rgba(255,255,255,.25)");
    // windows
    hs.wins.forEach((w, n) => {
      const x = WX(h, n % 3);
      const y = WY[(n / 3) | 0];
      rect(ctx, x - 4, y - 6, WW + 8, 6, "rgba(239,235,225,.9)");
      rect(ctx, x, y, WW, WH, "#EFEBE1");
      windowContents(ctx, w, x, y, rand);
      if (!["blinds", "boxes", "scarf", "tolet"].includes(w.kind)) sashBars(ctx, x, y);
      rect(ctx, x - 5, y + WH, WW + 10, 6, "#E2DDD2");
      if ((n / 3) | 0 && (h === 0 || h === 2 || h === 5) && w.kind !== "cat") {
        rect(ctx, x - 2, y + WH + 6, WW + 4, 10, "#7A5A3C");
        for (let k = 0; k < 7; k++) ell(ctx, x + 2 + k * 8, y + WH + 4 - (k % 2) * 3, 4, 4, ["#C0533F", "#E3B556", "#D98CB0", "#FFFEFA"][(k + h) % 4]);
      }
    });
    // downpipe between houses
    rect(ctx, x0 + HW - 4, EAVES, 4, FASCIA - EAVES, "rgba(40,40,38,.55)");
    rect(ctx, x0, EAVES - 3, HW, 5, "#3A3631");
    // the shop
    rect(ctx, x0, FASCIA, HW, PAVE - FASCIA, "#3A3631");
    rect(ctx, x0 + 4, FASCIA, HW - 8, AWNING - FASCIA, hs.sc);
    rect(ctx, x0 + 4, FASCIA, HW - 8, 3, "rgba(255,255,255,.18)");
    text(ctx, hs.shop, x0 + HW / 2, FASCIA + 21, hs.shop.length > 9 ? 19 : 23, hs.ink, "Libre Caslon Text", 700);
    // awning
    for (let k = 0; k < 8; k++) {
      const ax = x0 + 4 + k * ((HW - 8) / 8);
      const aw = (HW - 8) / 8;
      poly(ctx, [ax, AWNING, ax + aw, AWNING, ax + aw * 1.06, SHOP, ax + aw * 0.06, SHOP], k % 2 ? "#F4F1EA" : hs.stripe);
      ell(ctx, ax + aw * 0.56, SHOP, aw / 2, 4, k % 2 ? "#F4F1EA" : hs.stripe);
    }
    // display window and door
    const dw = 150;
    rect(ctx, x0 + 8, SHOP + 8, dw, PAVE - SHOP - 14, "#5C6A72");
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + 8, SHOP + 8, dw, PAVE - SHOP - 14);
    ctx.clip();
    shopDisplay(ctx, hs.shop, x0 + 8, SHOP + 8, dw, PAVE - SHOP - 14, rand);
    poly(ctx, [x0 + 30, PAVE, x0 + 60, SHOP + 8, x0 + 74, SHOP + 8, x0 + 44, PAVE], "rgba(255,255,255,.12)");
    ctx.restore();
    rect(ctx, x0 + 166, SHOP + 4, 50, PAVE - SHOP - 4, "#2A2927");
    rect(ctx, x0 + 170, SHOP + 8, 42, PAVE - SHOP - 8, h % 2 ? "#4A5F78" : "#5C4632");
    rect(ctx, x0 + 175, SHOP + 13, 32, 30, "#8FA2AE");
    ell(ctx, x0 + 205, SHOP + 58, 2.5, 2.5, "#E3B556");
    text(ctx, String(12 + h * 2), x0 + 191, SHOP + 52, 9, "#FFFEFA", "Work Sans", 600);
    if (h === 1) text(ctx, "OPEN", x0 + 191, SHOP + 28, 9, "#B03A2E", "Work Sans", 700);
  });

  // the kite, stuck on the aerial of the green house
  {
    const ax = 2 * HW + 168 + 26;
    const ay = HOUSES[2].ridge - 96;
    line(ctx, [ax, ay, 650, 96], "#3A3631", 0.8);
    poly(ctx, [650, 74, 670, 96, 650, 128, 630, 96], "#E3B556");
    poly(ctx, [650, 74, 670, 96, 650, 96], "#C0533F");
    poly(ctx, [630, 96, 650, 128, 650, 96], "#C0533F");
    line(ctx, [650, 128, 640, 146, 652, 160, 640, 176], "#3A3631", 0.8);
    for (const [bx, by] of [[642, 144], [650, 160], [641, 174]]) ell(ctx, bx, by, 4, 2, "#2D4C9A", 0.6);
  }
  // the cat on the green house's roof
  {
    const cx = 568;
    const cy = HOUSES[2].ridge - 4;
    ell(ctx, cx, cy - 12, 13, 12, "#2A2927");
    ell(ctx, cx - 3, cy - 12, 7, 9, "#FFFEFA");
    ell(ctx, cx - 1, cy - 30, 9, 8, "#2A2927");
    poly(ctx, [cx - 9, cy - 34, cx - 8, cy - 43, cx - 3, cy - 36], "#2A2927");
    poly(ctx, [cx + 1, cy - 36, cx + 6, cy - 43, cx + 8, cy - 33], "#2A2927");
    line(ctx, [cx + 12, cy - 6, cx + 22, cy - 2, cx + 26, cy - 14], "#2A2927", 3.5);
    ell(ctx, cx - 4, cy - 31, 1.3, 1.3, "#E3D25A");
    ell(ctx, cx + 2, cy - 31, 1.3, 1.3, "#E3D25A");
  }
  // pigeons on the yellow house's ridge
  for (const px of [952, 980, 1012]) {
    const py = HOUSES[4].ridge - 6;
    ell(ctx, px, py - 6, 10, 7, "#8E949A");
    ell(ctx, px + 7, py - 13, 5, 5, "#6E747A");
    poly(ctx, [px + 11, py - 13, px + 16, py - 12, px + 11, py - 11], "#C98F5E");
  }

  // pavement and road
  rect(ctx, 0, PAVE, BW, KERB - PAVE, "#CBC7BE");
  for (let x = 0; x < BW; x += 64) rect(ctx, x, PAVE, 1.5, KERB - PAVE, "rgba(80,76,70,.25)");
  rect(ctx, 0, PAVE + 40, BW, 1.5, "rgba(80,76,70,.25)");
  for (let k = 0; k < 400; k++) rect(ctx, rand() * BW, PAVE + rand() * (KERB - PAVE), 2, 2, "rgba(60,56,50,.08)");
  rect(ctx, 0, KERB, BW, ROAD - KERB, "#DEDAD2");
  rect(ctx, 0, ROAD - 2, BW, 2, "rgba(28,28,26,.25)");
  rect(ctx, 0, ROAD, BW, BH - ROAD, "#5B5955");
  for (let k = 0; k < 700; k++) rect(ctx, rand() * BW, ROAD + rand() * (BH - ROAD), 2, 2, k % 2 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.08)");
  rect(ctx, 0, ROAD + 6, BW, 3, "#E3B54A");
  rect(ctx, 0, ROAD + 12, BW, 3, "#E3B54A");
  for (let x = 20; x < BW; x += 90) rect(ctx, x, BH - 14, 50, 5, "#E9E6DE");
  ell(ctx, 760, 832, 26, 9, "#4A4844");
  for (let k = -2; k <= 2; k++) rect(ctx, 742, 830 + k * 3, 36, 1, "rgba(0,0,0,.25)");
  ell(ctx, 420, 838, 48, 9, "rgba(169,195,211,.55)");

  // lamp posts
  for (const lx of [448, 896]) {
    rect(ctx, lx - 4, 450, 8, FEET - 450, "#2F3A36");
    rect(ctx, lx - 7, FEET - 20, 14, 20, "#2F3A36");
    poly(ctx, [lx - 14, 452, lx + 14, 452, lx + 9, 470, lx - 9, 470], "#2F3A36");
    poly(ctx, [lx - 10, 452, lx + 10, 452, lx + 6, 432, lx - 6, 432], "#F4E1A6");
    poly(ctx, [lx - 12, 432, lx + 12, 432, lx, 420], "#2F3A36");
  }
  // bins
  rect(ctx, 508, 690, 34, 66, "#3E6E4E");
  rect(ctx, 506, 684, 38, 8, "#2F5A3E");
  rect(ctx, 548, 694, 34, 62, "#2A2927");
  rect(ctx, 546, 688, 38, 8, "#1C1C1A");
  ell(ctx, 516, 756, 5, 5, "#1C1C1A");
  ell(ctx, 574, 756, 5, 5, "#1C1C1A");
  // bench
  rect(ctx, 604, 716, 104, 8, "#8A6440");
  rect(ctx, 604, 728, 104, 8, "#8A6440");
  rect(ctx, 600, 740, 112, 8, "#9C7450");
  rect(ctx, 610, 748, 6, 14, "#2A2927");
  rect(ctx, 696, 748, 6, 14, "#2A2927");
  // post box
  rect(ctx, 812, 692, 36, 70, "#B8352A");
  ell(ctx, 830, 692, 20, 10, "#B8352A");
  rect(ctx, 818, 708, 24, 4, "#2A2927");
  rect(ctx, 822, 720, 16, 10, "#F4F1EA");
  rect(ctx, 808, 756, 44, 6, "#2A2927");
  text(ctx, "GR", 830, 744, 9, "#E3B556", "Libre Caslon Text", 700);
  // A-board outside the newsagent
  poly(ctx, [1010, 762, 1040, 684, 1070, 762], "#2A2927");
  rect(ctx, 1016, 698, 48, 54, "#FFFEFA");
  text(ctx, "LOCAL", 1040, 708, 9.5, "#1C1C1A", "Libre Caslon Text", 700);
  text(ctx, "MAN", 1040, 720, 9.5, "#1C1C1A", "Libre Caslon Text", 700);
  text(ctx, "FINISHES", 1040, 732, 8, "#1C1C1A", "Libre Caslon Text", 700);
  text(ctx, "JIGSAW", 1040, 744, 9.5, "#B03A2E", "Libre Caslon Text", 700);
  // flower buckets
  for (let k = 0; k < 3; k++) {
    const bx = 1088 + k * 22;
    for (let f = 0; f < 6; f++) ell(ctx, bx + (f - 2.5) * 4, 712 - (f % 3) * 6, 5, 5, ["#C0533F", "#E3B556", "#D98CB0", "#8E6BB0"][(f + k) % 4]);
    rect(ctx, bx - 9, 722, 18, 40, "#6E7A80");
  }

  // people
  person(ctx, 180, { coat: "#C0533F", legs: "#2A2927", skin: SKIN[0], hair: "#6B4A2E" });
  for (const [bx, c] of [[156, "#F4F1EA"], [204, "#E3B556"]] as const) {
    rect(ctx, bx - 9, 700, 18, 22, c);
    line(ctx, [bx - 4, 700, bx, 690, bx + 4, 700], "#8D857A", 1.4);
  }
  person(ctx, 300, { coat: "#4F7A5A", legs: "#4A5F78", skin: SKIN[2], hair: "#1C1C1A", arm: "lead" });
  line(ctx, [314, 702, 340, 728], "#C0533F", 1.4);
  ell(ctx, 346, 742, 18, 10, "#9C6B3E");
  ell(ctx, 360, 730, 8, 8, "#9C6B3E");
  ell(ctx, 357, 724, 4, 6, "#6E4A2A", 0.5);
  rect(ctx, 334, 748, 4, 12, "#9C6B3E");
  rect(ctx, 354, 748, 4, 12, "#9C6B3E");
  line(ctx, [329, 740, 320, 732], "#9C6B3E", 3);
  person(ctx, 472, { coat: "#E3B556", legs: "#4A5F78", skin: SKIN[3], hair: "#C9783E", h: 78 });
  line(ctx, [484, 694, 492, 600], "#3A3631", 0.8);
  ell(ctx, 492, 580, 18, 22, "#C0392B");
  ell(ctx, 486, 572, 5, 7, "rgba(255,255,255,.35)");
  // the woman on the bench, sitting
  ell(ctx, 645, 708, 13, 22, "#2D4C9A");
  rect(ctx, 634, 722, 28, 9, "#2D4C9A");
  rect(ctx, 654, 728, 8, 30, "#2A2927");
  ell(ctx, 645, 676, 9, 11, SKIN[4]);
  ctx.fillStyle = "#3A2A1E";
  ctx.beginPath();
  ctx.ellipse(645, 673, 10, 9, 0, Math.PI, 0);
  ctx.fill();
  for (const px of [716, 744, 768]) {
    ell(ctx, px, 754, 8, 5, "#8E949A");
    ell(ctx, px + 6, 748, 4, 4, "#6E747A");
  }
  person(ctx, 782, { coat: "#4A5F78", legs: "#2A2927", skin: SKIN[1], hair: "#2A2927", hat: "#2A2927" });
  rect(ctx, 762, 702, 16, 24, "#9C7450");
  person(ctx, 964, { coat: "#6B4E7A", legs: "#2A2927", skin: SKIN[0], hair: "#E3B556", arm: "phone" });

  // the blue car
  {
    const x = 34;
    const y = 852;
    ctx.fillStyle = "#4D6F95";
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x, y - 46);
    ctx.quadraticCurveTo(x + 6, y - 54, x + 40, y - 56);
    ctx.lineTo(x + 70, y - 92);
    ctx.lineTo(x + 190, y - 92);
    ctx.lineTo(x + 232, y - 58);
    ctx.quadraticCurveTo(x + 262, y - 54, x + 264, y - 40);
    ctx.lineTo(x + 264, y - 18);
    ctx.closePath();
    ctx.fill();
    poly(ctx, [x + 78, y - 84, x + 128, y - 84, x + 128, y - 58, x + 54, y - 58], "#C9D7E0");
    poly(ctx, [x + 136, y - 84, x + 186, y - 84, x + 216, y - 58, x + 136, y - 58], "#C9D7E0");
    rect(ctx, x + 2, y - 36, 260, 3, "rgba(255,255,255,.25)");
    for (const wx of [x + 58, x + 206]) {
      ell(ctx, wx, y - 14, 22, 22, "#1C1C1A");
      ell(ctx, wx, y - 14, 10, 10, "#B9BDBF");
    }
    ell(ctx, x + 258, y - 46, 5, 4, "#F4E1A6");
  }
  // the man on the bike
  {
    const by = 846;
    for (const wx of [556, 638]) {
      ctx.strokeStyle = "#1C1C1A";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wx, by - 22, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    line(ctx, [556, by - 22, 590, by - 22, 620, by - 52, 576, by - 52, 556, by - 22], "#2D4C9A", 3);
    line(ctx, [590, by - 22, 576, by - 58, 638, by - 22, 622, by - 62], "#2D4C9A", 3);
    line(ctx, [570, by - 60, 584, by - 60], "#1C1C1A", 4);
    line(ctx, [578, by - 62, 596, by - 104, 622, by - 66], "#D97B2E", 9);
    line(ctx, [586, by - 70, 594, by - 40, 604, by - 30], "#2A2927", 6);
    ell(ctx, 600, by - 116, 10, 11, SKIN[1]);
    ctx.fillStyle = "#E3B556";
    ctx.beginPath();
    ctx.ellipse(600, by - 120, 12, 10, 0, Math.PI, 0);
    ctx.fill();
  }
  // the bus, mostly out of the picture
  {
    const x = 1152;
    ctx.fillStyle = "#B23A2E";
    ctx.beginPath();
    ctx.moveTo(x + 14, 514);
    ctx.lineTo(BW + 10, 514);
    ctx.lineTo(BW + 10, 846);
    ctx.lineTo(x, 846);
    ctx.lineTo(x, 528);
    ctx.quadraticCurveTo(x, 514, x + 14, 514);
    ctx.fill();
    rect(ctx, x + 6, 524, 80, 22, "#1C1C1A");
    text(ctx, "NOT IN SERVICE", x + 46, 535, 9.5, "#E3B556", "Courier Prime", 700);
    for (let k = 0; k < 3; k++) {
      rect(ctx, x + 96 + k * 64, 552, 56, 60, "#3E4B55");
      ell(ctx, x + 124 + k * 64, 600, 10, 12, SKIN[k % 5]);
      rect(ctx, x + 96 + k * 64, 694, 56, 64, "#3E4B55");
    }
    rect(ctx, x + 8, 552, 80, 92, "#3E4B55");
    rect(ctx, x + 8, 664, 80, 100, "#4E5A63");
    ell(ctx, x + 40, 718, 11, 13, SKIN[3]);
    rect(ctx, x + 26, 732, 30, 32, "#4A5F78");
    rect(ctx, x, 648, BW - x, 8, "#E8E2D6");
    rect(ctx, x, 770, BW - x, 30, "#8A2B22");
    ell(ctx, x + 70, 840, 26, 26, "#1C1C1A");
    ell(ctx, x + 70, 840, 12, 12, "#B9BDBF");
    ell(ctx, x + 10, 786, 6, 5, "#F4E1A6");
  }

  grain(ctx, rand);
  ctx.restore();
}

export const highStreet: Scene = { title: "The High Street", draw, labels: LABELS, landmarks: LANDMARKS };
