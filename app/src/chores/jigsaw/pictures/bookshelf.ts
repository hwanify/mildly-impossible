// The Bookshelf: a whole wall of shelves, hundreds of spines and the things people keep in front
// of them, with a ladder, a reading chair and a lamp. Every shelf is different on purpose.
import { BW, BH, rng, rect, ell, poly, line, text, grain, SKIN, type Box, type Ctx, type Scene } from "./common";

const LABELS: Box[] = [];
const lab = (name: string, x: number, y: number, w: number, h: number) => LABELS.push({ x, y, w, h, name });

const CASE_L = 30;
const CASE_R = 1314;
const TOP = 20;
const UP = 14;
const BAYW = (CASE_R - CASE_L - UP * 7) / 6;
const ROWH = 98;
const BOARD = 14;
const ROWS = 6;
const rowTop = (r: number) => TOP + 14 + r * (ROWH + BOARD);
const rowBase = (r: number) => rowTop(r) + ROWH;
const bayX = (b: number) => CASE_L + UP + b * (BAYW + UP);
const PLINTH = rowBase(ROWS - 1);
const FLOOR = PLINTH + 30;

type Genre = { name: string; cols: string[]; w: [number, number]; h: [number, number]; ink: string; gold?: boolean };
const GENRES: Genre[] = [
  { name: "the paperbacks", cols: ["#D98C3E", "#4F7A5A", "#2D4C9A", "#E8E2D2", "#B4513A"], w: [9, 15], h: [58, 70], ink: "#1C1C1A" },
  { name: "the crime novels", cols: ["#1C1C1A", "#B4513A", "#E3B556", "#2A2927", "#7A2E2E"], w: [13, 22], h: [64, 80], ink: "#F4F1EA" },
  { name: "the cookery books", cols: ["#C0533F", "#E3B556", "#7DA05A", "#E08A3E", "#F4F1EA"], w: [18, 30], h: [72, 92], ink: "#1C1C1A" },
  { name: "the poetry books", cols: ["#8FA58A", "#D8A6A0", "#C9D7E0", "#E3D7B8", "#B8A6C8"], w: [5, 10], h: [58, 80], ink: "#1C1C1A" },
  { name: "the old leather books", cols: ["#6B4A36", "#7A5236", "#5A3A2A", "#8A6440", "#4A3226"], w: [18, 28], h: [72, 94], ink: "#E3B556", gold: true },
  { name: "the children's books", cols: ["#2D4C9A", "#E3B556", "#C0533F", "#D98CB0", "#7DB0D8", "#7DA05A"], w: [8, 18], h: [78, 96], ink: "#FFFEFA" },
  { name: "the travel guides", cols: ["#2D4C9A", "#4F7A5A", "#B4513A", "#E3B556"], w: [12, 18], h: [62, 74], ink: "#FFFEFA" },
  { name: "the art books", cols: ["#F4F1EA", "#1C1C1A", "#E3B556", "#B4513A", "#C9D7E0"], w: [22, 36], h: [84, 96], ink: "#1C1C1A" },
  { name: "the science books", cols: ["#5F6E78", "#7D8C9E", "#E8E2D2", "#4F7A5A", "#3E4B55"], w: [15, 26], h: [70, 88], ink: "#F4F1EA" },
  { name: "the novels", cols: ["#A3B79D", "#D8AA52", "#91A8C0", "#AE5B42", "#E2D3AE", "#6B4E7A"], w: [12, 24], h: [66, 86], ink: "#1C1C1A" },
  { name: "the gardening books", cols: ["#4F7A5A", "#6E9A63", "#A3B79D", "#E3D7B8", "#2F5D4A"], w: [14, 24], h: [70, 88], ink: "#F4F1EA" },
  { name: "the encyclopaedias", cols: ["#7A2E2E"], w: [22, 22], h: [88, 88], ink: "#E3B556", gold: true },
];

const TITLES = ["DUST", "LATER", "MOSTLY TRUE", "UNREAD", "VOL. 2", "SOUP", "THE END", "WAIT", "MAPS", "BIRDS", "ROADS", "TIDES", "FERNS", "HOPE", "TAX", "KNOTS", "CLOUDS", "MOTHS", "RAIN", "THE SEA", "BREAD", "SLEEP", "HILLS", "OWLS", "STONES", "EMMA", "MOSS", "NOISE", "JAM", "LISTS", "MUD", "STAIRS", "TEA", "BEES", "BONES", "QUIET", "KEYS", "VOL. 1", "VOL. 3"];

type Thing = { k: string; x: number; w: number; name: string };
type Book = { x: number; w: number; h: number; c: string; deco: number; lean: number; title?: string; serif: boolean };
type Cell = { r: number; b: number; genre: Genre; books: Book[]; things: Thing[] };
type Spec = "B" | [string, number, string];

const SPEC: Spec[][][] = [
  [["B", ["plant", 44, "the trailing plant"]], ["B", ["clock", 64, "the clock"], "B"], [["flat", 70, "the pile of books lying down"], "B"], ["B", ["globe", 84, "the globe"]], ["B"], [["vase", 40, "the vase of dried flowers"], "B", ["flat", 62, "the pile of books lying down"]]],
  [["B"], [["photo", 52, "the wedding photo"], "B"], ["B", ["boat", 112, "the model boat"]], ["B"], [["cat", 124, "the cat asleep on the shelf"], "B"], ["B", ["bookend", 22, "the elephant bookend"]]],
  [["B", ["mug", 30, "the mug of pens"]], ["B"], [["bookend", 22, "the elephant bookend"], "B", ["photo", 46, "the photo of the dog"]], ["B", ["plant", 50, "the spider plant"]], [["flat", 72, "the pile of books lying down"], "B"], [["trophy", 44, "the third place trophy"], "B"]],
  [[["photo", 54, "the photo of the seaside"], "B"], ["B"], ["B", ["candle", 28, "the candlestick"], ["flat", 60, "the pile of books lying down"]], [["owl", 42, "the china owl"], "B"], ["B"], ["B", ["box", 70, "the wooden box"]]],
  [["B", ["pencils", 30, "the jar of pencils"]], ["B"], [["shells", 64, "the shells"], "B"], ["B"], ["B"], [["flat", 60, "the pile of books lying down"], "B"]],
  [[["records", 120, "the records"], "B"], ["B"], [["games", 124, "the board games"], "B"], ["B"], ["B"], [["files", 96, "the box files"], "B"]],
];

const CELLS: Cell[] = (() => {
  const rand = rng(424242);
  const out: Cell[] = [];
  let enc = 0;
  let t = 0;
  for (let r = 0; r < ROWS; r++)
    for (let b = 0; b < 6; b++) {
      const genre = GENRES[(r * 5 + b * 7 + (r % 2) * 3) % GENRES.length];
      const spec = SPEC[r][b];
      const x0 = bayX(b) + 3;
      const avail = BAYW - 6;
      const fixed = spec.reduce((s, e) => s + (e === "B" ? 0 : e[1] + 4), 0);
      const runs = spec.filter((e) => e === "B").length;
      const runW = (avail - fixed) / Math.max(1, runs);
      const books: Book[] = [];
      const things: Thing[] = [];
      let x = x0;
      for (const e of spec) {
        if (e !== "B") {
          things.push({ k: e[0], x: x + 2, w: e[1], name: e[2] });
          x += e[1] + 4;
          continue;
        }
        const end = x + runW;
        const run: Book[] = [];
        for (;;) {
          const finish = r === 3 && b === 1 && run.length === 1;
          let w = finish ? 24 : genre.w[0] + rand() * (genre.w[1] - genre.w[0]);
          if (x + w > end) {
            const left = end - x - (rand() < 0.5 ? 0 : 12);
            if (left < Math.max(5, genre.w[0] * 0.7)) break;
            w = Math.min(left, genre.w[1]);
          }
          const h = finish ? 92 : Math.min(ROWH - 3, genre.h[0] + rand() * (genre.h[1] - genre.h[0]));
          const c = genre.cols[Math.floor(rand() * genre.cols.length)];
          let title: string | undefined;
          if (genre.name === "the encyclopaedias") title = "ABCDEFGHIJKLMNOPRSTW"[enc++ % 20];
          else if (w >= 13 && rand() < 0.5) title = TITLES[t++ % TITLES.length];
          if (finish) title = "HOW TO FINISH THINGS";
          run.push({ x, w, h, c: finish ? "#E3B556" : c, deco: Math.floor(rand() * 5), lean: 0, title, serif: rand() < 0.5 });
          x += w + 0.6;
        }
        const gap = end - x;
        if (gap > 8 && run.length > 2) {
          const last = run[run.length - 1];
          const prevRight = last.x - 0.6;
          const a = Math.min(0.5, Math.asin(Math.min(1, (gap + 2) / last.h)));
          last.lean = a;
          last.x = prevRight + last.h * Math.sin(a);
        } else if (gap > 1 && run.length) run.forEach((bk, i) => (bk.x += (gap * i) / run.length));
        books.push(...run);
        x = end;
      }
      out.push({ r, b, genre, books, things });
    }
  return out;
})();

// Names for everything, in the order things are drawn (later ones sit on top).
lab("the wall", 0, 0, BW, BH);
lab("the bookcase", CASE_L, TOP, CASE_R - CASE_L, FLOOR - TOP);
for (const c of CELLS) {
  lab(c.genre.name, bayX(c.b), rowTop(c.r), BAYW, ROWH);
  for (const th of c.things) lab(th.name, th.x, rowTop(c.r), th.w, ROWH);
}
lab("the book called HOW TO FINISH THINGS", bayX(1), rowTop(3), 60, ROWH);
lab("the cat's tail", bayX(4) + 90, rowBase(1), 40, 50);
lab("the brass rail", CASE_L, TOP - 4, CASE_R - CASE_L, 14);
lab("the ladder", 316, TOP, 76, BH - TOP);
lab("the floor", 0, FLOOR, BW, BH - FLOOR);
lab("the rug", 380, FLOOR + 40, 860, BH - FLOOR - 40);
lab("the books on the floor", 40, FLOOR - 40, 200, 90);
lab("the slippers", 250, 820, 80, 36);
lab("the footstool", 690, 770, 150, 94);
lab("the reading chair", 860, 520, 300, BH - 520);
lab("the blanket on the chair", 900, 640, 120, 150);
lab("the open book on the chair", 1086, 594, 64, 30);
lab("the knitting basket", 790, 690, 70, 60);
lab("the lamp", 1150, 380, 120, BH - 380);
lab("the side table", 1206, 720, 106, BH - 720);
lab("the mug of tea", 1220, 690, 36, 32);
lab("the reading glasses", 1260, 702, 44, 18);

/** Places worth starting the puzzle from: things you'd find first on the lid. */
const LANDMARKS = [
  { x: 770, y: 92 }, // the globe
  { x: 580, y: 196 }, // the model boat
  { x: 960, y: 212 }, // the cat on the shelf
  { x: 118, y: 660 }, // the records
  { x: 1020, y: 700 }, // the reading chair
];

function ring(ctx: Ctx, x: number, y: number, r: number, stroke: string, w: number) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}
function vtext(ctx: Ctx, s: string, x: number, y: number, size: number, fill: string, font: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  text(ctx, s, 0, 0, size, fill, font, 700);
  ctx.restore();
}
const light = (c: string) => ["#F4F1EA", "#E8E2D2", "#E3D7B8", "#C9D7E0", "#E3B556", "#E2D3AE", "#D8AA52", "#A3B79D", "#D8A6A0", "#91A8C0", "#7DB0D8", "#8FA58A", "#B8A6C8"].includes(c);

function book(ctx: Ctx, bk: Book, base: number, g: Genre) {
  ctx.save();
  ctx.translate(bk.x, base);
  if (bk.lean) ctx.rotate(-bk.lean);
  const { w, h } = bk;
  rect(ctx, 0, -h, w, h, bk.c);
  rect(ctx, w - Math.max(1.5, w * 0.12), -h, Math.max(1.5, w * 0.12), h, "rgba(0,0,0,.14)");
  rect(ctx, 0, -h, Math.max(1, w * 0.1), h, "rgba(255,255,255,.12)");
  const ink = light(bk.c) ? "#1C1C1A" : g.ink === "#1C1C1A" ? "#F4F1EA" : g.ink;
  const deco = g.gold ? 0 : bk.deco;
  if (deco === 0) {
    const gc = g.gold ? "#C9A23F" : ink;
    rect(ctx, 0, -h + 6, w, 2, gc);
    rect(ctx, 0, -h + 10, w, 1, gc);
    rect(ctx, 0, -10, w, 2, gc);
  } else if (deco === 1) rect(ctx, 0, -h + 8, w, h * 0.16, light(bk.c) ? "#B4513A" : "#F4F1EA");
  else if (deco === 2) rect(ctx, w * 0.2, -14, w * 0.6, 6, ink);
  else if (deco === 3) ell(ctx, w / 2, -h + 12, Math.min(3, w * 0.25), Math.min(3, w * 0.25), ink);
  if (bk.title) {
    let size = Math.min(9, w * 0.55);
    const room = h - (deco === 0 ? 30 : 26);
    const est = (s: number) => s * 0.62 * bk.title!.length;
    while (size > 4.5 && est(size) > room) size -= 0.5;
    if (est(size) <= room) vtext(ctx, bk.title, w / 2 + 0.5, -h / 2 - 2, size, ink, bk.serif ? "Libre Caslon Text" : "Work Sans");
  }
  ctx.restore();
}

function thing(ctx: Ctx, th: Thing, base: number, rand: () => number) {
  const { x, w } = th;
  const cx = x + w / 2;
  switch (th.k) {
    case "flat": {
      const cols = ["#2D4C9A", "#B4513A", "#E3B556", "#4F7A5A", "#E8E2D2", "#6B4E7A", "#1C1C1A"];
      let y = base;
      const n = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const bh = 9 + rand() * 7;
        const bw = w - rand() * 16;
        const bx = x + rand() * (w - bw);
        rect(ctx, bx, y - bh, bw, bh, cols[Math.floor(rand() * cols.length)]);
        rect(ctx, bx + 3, y - bh + 2, bw - 6, 1.2, "rgba(255,255,255,.35)");
        rect(ctx, bx, y - 2, bw, 2, "rgba(0,0,0,.15)");
        y -= bh;
      }
      if (rand() < 0.6) {
        ell(ctx, cx, y - 9, 9, 9, "rgba(201,220,230,.8)");
        rect(ctx, cx - 8, y - 3, 16, 3, "#6B4A36");
        ell(ctx, cx - 2, y - 11, 2, 2, "#FFFEFA");
      }
      break;
    }
    case "plant": {
      rect(ctx, cx - 14, base - 30, 28, 30, "#B5654A");
      rect(ctx, cx - 16, base - 32, 32, 6, "#C97A5A");
      for (let k = 0; k < 9; k++) ell(ctx, cx + (k - 4) * 4, base - 40 - Math.abs(4 - k) * -2, 9, 3.5, k % 2 ? "#4F7A5A" : "#6E9A63", -1.2 + k * 0.3);
      for (const dir of [-1, 1]) for (let k = 0; k < 8; k++) ell(ctx, cx + dir * (12 + Math.sin(k) * 4), base - 20 + k * 9, 6, 3, k % 2 ? "#4F7A5A" : "#6E9A63", k * 0.8);
      break;
    }
    case "clock": {
      ctx.fillStyle = "#6B4A36";
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x, base - 44);
      ctx.quadraticCurveTo(cx, base - 84, x + w, base - 44);
      ctx.lineTo(x + w, base);
      ctx.closePath();
      ctx.fill();
      rect(ctx, x - 3, base - 6, w + 6, 6, "#4A3226");
      ell(ctx, cx, base - 46, 20, 20, "#C9A23F");
      ell(ctx, cx, base - 46, 17, 17, "#FFFEFA");
      for (let k = 0; k < 12; k++) rect(ctx, cx + Math.cos(k * 0.5236) * 13 - 1, base - 46 + Math.sin(k * 0.5236) * 13 - 1, 2, 2, "#1C1C1A");
      line(ctx, [cx, base - 46, cx - 6, base - 55], "#1C1C1A", 2);
      line(ctx, [cx, base - 46, cx + 10, base - 43], "#1C1C1A", 1.4);
      break;
    }
    case "globe": {
      rect(ctx, cx - 16, base - 6, 32, 6, "#4A3226");
      rect(ctx, cx - 2, base - 18, 4, 14, "#C9A23F");
      ell(ctx, cx, base - 52, 34, 34, "#6F9AB8");
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, base - 52, 34, 0, Math.PI * 2);
      ctx.clip();
      poly(ctx, [cx - 30, base - 70, cx - 8, base - 80, cx - 2, base - 62, cx - 14, base - 44, cx - 24, base - 50], "#A3B79D");
      poly(ctx, [cx + 4, base - 60, cx + 22, base - 72, cx + 34, base - 54, cx + 18, base - 30, cx + 8, base - 40], "#D8AA52");
      poly(ctx, [cx - 12, base - 30, cx + 2, base - 26, cx - 4, base - 18], "#A3B79D");
      ell(ctx, cx - 14, base - 66, 8, 5, "rgba(255,255,255,.3)", -0.5);
      ctx.restore();
      ctx.strokeStyle = "#C9A23F";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, base - 52, 39, Math.PI * 0.6, Math.PI * 2.4);
      ctx.stroke();
      break;
    }
    case "vase": {
      ctx.fillStyle = "#2D4C9A";
      ctx.beginPath();
      ctx.moveTo(cx - 8, base - 50);
      ctx.quadraticCurveTo(cx - 22, base - 20, cx - 12, base);
      ctx.lineTo(cx + 12, base);
      ctx.quadraticCurveTo(cx + 22, base - 20, cx + 8, base - 50);
      ctx.closePath();
      ctx.fill();
      for (let k = 0; k < 3; k++) ell(ctx, cx, base - 34 + k * 10, 12 - k, 1.6, "rgba(255,254,250,.6)");
      for (let k = 0; k < 6; k++) {
        const ex = cx + (k - 2.5) * 6;
        const ey = base - 80 - (k % 3) * 6;
        line(ctx, [cx, base - 48, ex, ey], "#8A6440", 1.2);
        ell(ctx, ex, ey, 3.5, 3.5, ["#D8AA52", "#C97A5A", "#E8E2D2"][k % 3]);
      }
      break;
    }
    case "photo": {
      const ph = Math.min(70, w * 1.25);
      rect(ctx, x, base - ph, w, ph, "#C9A23F");
      rect(ctx, x + 5, base - ph + 5, w - 10, ph - 10, th.name.includes("dog") ? "#A3B79D" : th.name.includes("seaside") ? "#7DB0D8" : "#E8E2D2");
      if (th.name.includes("dog")) {
        ell(ctx, cx, base - 18, 12, 9, "#3A3631");
        ell(ctx, cx + 4, base - 30, 8, 7, "#3A3631");
        ell(ctx, cx - 2, base - 32, 3, 6, "#2A2927", 0.4);
      } else if (th.name.includes("seaside")) {
        rect(ctx, x + 5, base - 26, w - 10, 21, "#E3CF96");
        rect(ctx, x + 5, base - 32, w - 10, 6, "#2D4C9A");
        ell(ctx, cx - 6, base - 22, 4, 5, SKIN[1]);
        ell(ctx, cx + 8, base - 22, 4, 5, SKIN[3]);
        rect(ctx, cx - 10, base - 17, 8, 8, "#C0533F");
        rect(ctx, cx + 4, base - 17, 8, 8, "#E3B556");
      } else {
        ell(ctx, cx - 7, base - 38, 5, 6, SKIN[0]);
        ell(ctx, cx + 7, base - 38, 5, 6, SKIN[2]);
        poly(ctx, [cx - 13, base - 8, cx - 1, base - 8, cx - 4, base - 32, cx - 10, base - 32], "#FFFEFA");
        rect(ctx, cx + 2, base - 32, 10, 24, "#2A2927");
      }
      rect(ctx, x + 2, base - 4, w - 4, 4, "#8A6440");
      break;
    }
    case "boat": {
      rect(ctx, cx - 30, base - 8, 60, 8, "#6B4A36");
      rect(ctx, cx - 22, base - 20, 4, 12, "#6B4A36");
      rect(ctx, cx + 18, base - 20, 4, 12, "#6B4A36");
      poly(ctx, [x + 4, base - 34, x + w - 4, base - 34, x + w - 20, base - 18, x + 16, base - 18], "#7A2E2E");
      rect(ctx, x + 8, base - 34, w - 14, 4, "#1C1C1A");
      rect(ctx, cx - 2, base - 96, 3, 62, "#4A3226");
      rect(ctx, cx + 30, base - 80, 2, 46, "#4A3226");
      poly(ctx, [cx - 4, base - 92, cx - 4, base - 40, cx - 40, base - 40], "#F4F1EA");
      poly(ctx, [cx + 4, base - 90, cx + 4, base - 40, cx + 28, base - 42, cx + 26, base - 86], "#E8E2D2");
      poly(ctx, [cx + 33, base - 76, cx + 33, base - 42, cx + 50, base - 42], "#F4F1EA");
      poly(ctx, [cx + 1, base - 96, cx + 14, base - 92, cx + 1, base - 88], "#B4513A");
      line(ctx, [x + 4, base - 34, cx - 2, base - 96, x + w - 2, base - 36], "rgba(28,28,26,.5)", 0.8);
      break;
    }
    case "cat": {
      ell(ctx, cx + 4, base - 24, 52, 24, "#8E949A");
      for (let k = 0; k < 7; k++) ell(ctx, cx - 20 + k * 10, base - 36, 2.5, 12, "rgba(60,60,60,.35)", 0.25);
      ell(ctx, x + 20, base - 18, 18, 15, "#8E949A");
      poly(ctx, [x + 6, base - 26, x + 6, base - 42, x + 16, base - 30], "#8E949A");
      poly(ctx, [x + 22, base - 31, x + 30, base - 44, x + 33, base - 28], "#8E949A");
      poly(ctx, [x + 9, base - 29, x + 9, base - 38, x + 14, base - 31], "#D98C9C");
      line(ctx, [x + 12, base - 18, x + 17, base - 16, x + 22, base - 18], "#2A2927", 1.4);
      line(ctx, [x + 26, base - 18, x + 31, base - 16, x + 36, base - 18], "#2A2927", 1.4);
      ell(ctx, x + 22, base - 11, 2, 1.5, "#D98C9C");
      ell(ctx, x + 40, base - 6, 14, 6, "#F4F1EA");
      line(ctx, [x + 100, base - 8, x + 108, base + 8, x + 104, base + 30, x + 112, base + 44], "#8E949A", 7);
      for (let k = 0; k < 3; k++) rect(ctx, x + 102 + k * 2, base + 8 + k * 12, 8, 3, "rgba(60,60,60,.4)");
      break;
    }
    case "bookend": {
      rect(ctx, x, base - 6, w, 6, "#6E747A");
      ell(ctx, cx, base - 30, w / 2 + 2, 20, "#8E949A");
      ell(ctx, cx - 4, base - 46, 10, 10, "#8E949A");
      line(ctx, [cx - 12, base - 44, cx - 16, base - 26, cx - 12, base - 18], "#8E949A", 5);
      ell(ctx, cx - 1, base - 46, 5, 7, "#7E848A");
      rect(ctx, x + 2, base - 18, 5, 14, "#8E949A");
      rect(ctx, x + w - 7, base - 18, 5, 14, "#8E949A");
      ell(ctx, cx - 7, base - 48, 1.2, 1.2, "#1C1C1A");
      break;
    }
    case "mug": {
      rect(ctx, x + 3, base - 30, w - 10, 30, "#C0533F");
      ring(ctx, x + w - 6, base - 16, 6, "#C0533F", 3);
      for (let k = 0; k < 5; k++) line(ctx, [x + 7 + k * 3, base - 28, x + 4 + k * 4.5, base - 54 - (k % 2) * 6], ["#2D4C9A", "#1C1C1A", "#E3B556", "#B4513A", "#4F7A5A"][k], 2.4);
      rect(ctx, x + 3, base - 20, w - 10, 3, "#F4F1EA");
      break;
    }
    case "trophy": {
      rect(ctx, x + 6, base - 12, w - 12, 12, "#3A3631");
      rect(ctx, cx - 3, base - 28, 6, 16, "#C9A23F");
      poly(ctx, [x + 6, base - 62, x + w - 6, base - 62, cx + 8, base - 30, cx - 8, base - 30], "#C9A23F");
      ring(ctx, x + 6, base - 52, 6, "#C9A23F", 2.4);
      ring(ctx, x + w - 6, base - 52, 6, "#C9A23F", 2.4);
      text(ctx, "3rd", cx, base - 48, 9, "#7A5236", "Libre Caslon Text", 700);
      text(ctx, "BEST", cx, base - 7, 5, "#E3B556", "Work Sans", 700);
      break;
    }
    case "candle": {
      rect(ctx, x + 4, base - 6, w - 8, 6, "#C9A23F");
      rect(ctx, cx - 3, base - 34, 6, 28, "#C9A23F");
      rect(ctx, cx - 5, base - 64, 10, 32, "#F4EEDC");
      line(ctx, [cx, base - 64, cx, base - 70], "#1C1C1A", 1);
      poly(ctx, [cx - 4, base - 64, cx + 5, base - 64, cx + 4, base - 56], "rgba(220,210,190,.9)");
      break;
    }
    case "owl": {
      ell(ctx, cx, base - 26, 18, 26, "#E8E2D2");
      ell(ctx, cx - 7, base - 36, 7, 7, "#FFFEFA");
      ell(ctx, cx + 7, base - 36, 7, 7, "#FFFEFA");
      ell(ctx, cx - 7, base - 36, 3, 3, "#1C1C1A");
      ell(ctx, cx + 7, base - 36, 3, 3, "#1C1C1A");
      poly(ctx, [cx - 3, base - 30, cx + 3, base - 30, cx, base - 24], "#D98C3E");
      poly(ctx, [cx - 16, base - 46, cx - 12, base - 56, cx - 6, base - 48], "#E8E2D2");
      poly(ctx, [cx + 16, base - 46, cx + 12, base - 56, cx + 6, base - 48], "#E8E2D2");
      for (let k = 0; k < 6; k++) ell(ctx, cx - 6 + (k % 3) * 6, base - 16 + Math.floor(k / 3) * 7, 2.5, 2, "#2D4C9A");
      break;
    }
    case "box": {
      rect(ctx, x, base - 40, w, 40, "#8A6440");
      rect(ctx, x, base - 44, w, 8, "#7A5236");
      for (let k = 0; k < 4; k++) rect(ctx, x, base - 34 + k * 8, w, 1.2, "rgba(40,20,10,.3)");
      rect(ctx, cx - 6, base - 34, 12, 10, "#C9A23F");
      ell(ctx, cx, base - 29, 1.6, 1.6, "#1C1C1A");
      break;
    }
    case "pencils": {
      rect(ctx, x + 2, base - 34, w - 4, 34, "rgba(201,220,220,.7)");
      for (let k = 0; k < 6; k++) {
        const px = x + 6 + k * 3.6;
        rect(ctx, px, base - 58 + (k % 3) * 5, 3, 56, ["#E3B556", "#C0533F", "#2D4C9A", "#4F7A5A", "#E3B556", "#6B4E7A"][k]);
        poly(ctx, [px, base - 58 + (k % 3) * 5, px + 3, base - 58 + (k % 3) * 5, px + 1.5, base - 63 + (k % 3) * 5], "#E8C8A0");
      }
      rect(ctx, x + 4, base - 30, 3, 26, "rgba(255,255,255,.5)");
      break;
    }
    case "shells": {
      for (let k = 0; k < 5; k++) {
        const sx = x + 8 + k * 12;
        ctx.fillStyle = ["#F0D2B6", "#E8E2D2", "#D8A6A0", "#E3D7B8", "#C9B79A"][k];
        ctx.beginPath();
        ctx.moveTo(sx - 7, base);
        ctx.quadraticCurveTo(sx, base - 22 - (k % 2) * 8, sx + 7, base);
        ctx.fill();
        for (let j = -1; j <= 1; j++) line(ctx, [sx, base - 2, sx + j * 4, base - 14], "rgba(120,90,70,.4)", 0.8);
      }
      ell(ctx, x + w - 10, base - 6, 9, 6, "#7D8C9E");
      ell(ctx, x + 16, base - 4, 6, 4, "#5F6E78");
      break;
    }
    case "records": {
      for (let k = 0; k < 26; k++) rect(ctx, x + k * 3.4, base - 90, 3, 90, k % 5 === 2 ? "#E8E2D2" : k % 3 ? "#2A2927" : "#4A4945");
      ctx.save();
      ctx.translate(x + 92, base);
      ctx.rotate(-0.18);
      rect(ctx, 0, -86, 86, 86, "#E3B556");
      ell(ctx, 43, -43, 28, 28, "#B4513A");
      ell(ctx, 43, -43, 10, 10, "#E3B556");
      text(ctx, "SIDE B", 43, -76, 8, "#1C1C1A", "Work Sans", 700);
      ctx.restore();
      break;
    }
    case "games": {
      const boxes: [number, string, string, string][] = [
        [18, "#2D4C9A", "CHESS", "#F4F1EA"],
        [16, "#4F7A5A", "SNAKES & LADDERS", "#F4F1EA"],
        [20, "#E3B556", "JIGSAW 1000 pcs (998)", "#1C1C1A"],
        [14, "#B4513A", "DRAUGHTS", "#F4F1EA"],
      ];
      let y = base;
      boxes.forEach(([bh, c, s, ink], k) => {
        const bw = w - (k % 2) * 8;
        rect(ctx, x + (k % 2) * 4, y - bh, bw, bh, c);
        rect(ctx, x + (k % 2) * 4, y - 2, bw, 2, "rgba(0,0,0,.2)");
        text(ctx, s, x + (k % 2) * 4 + bw / 2, y - bh / 2, Math.min(9, bh * 0.5), ink, "Work Sans", 700);
        y -= bh;
      });
      break;
    }
    case "files": {
      const tags = ["TAX", "TAX", "BILLS", "MISC", "MISC 2"];
      for (let k = 0; k < 5; k++) {
        const fx = x + k * (w / 5);
        rect(ctx, fx, base - 86, w / 5 - 1.5, 86, ["#3E4B55", "#3E4B55", "#7A2E2E", "#2F5D4A", "#2F5D4A"][k]);
        rect(ctx, fx + 3, base - 70, w / 5 - 7.5, 26, "#F4EEDC");
        vtext(ctx, tags[k], fx + (w / 5) / 2 - 0.5, base - 57, 6.5, "#1C1C1A", "Courier Prime");
        ring(ctx, fx + (w / 5) / 2 - 0.5, base - 22, 4, "rgba(0,0,0,.5)", 2);
      }
      break;
    }
  }
}

/** Draws the whole picture into ctx, in world units (0..BW, 0..BH). Same picture every time. */
function draw(ctx: Ctx) {
  const rand = rng(97531);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, BW, BH);
  ctx.clip();

  // wall
  rect(ctx, 0, 0, BW, FLOOR, "#3E5A4E");
  for (let y = 0; y < FLOOR; y += 24) for (let x = (y / 24) % 2 ? 0 : 12; x < BW; x += 24) ell(ctx, x, y, 2, 2, "rgba(201,162,63,.35)");

  // the case
  rect(ctx, CASE_L, TOP, CASE_R - CASE_L, PLINTH - TOP + 4, "#7A5236");
  rect(ctx, CASE_L - 8, TOP - 6, CASE_R - CASE_L + 16, 20, "#8A6440");
  rect(ctx, CASE_L - 8, TOP + 12, CASE_R - CASE_L + 16, 3, "rgba(0,0,0,.25)");
  for (let b = 0; b < 6; b++)
    for (let r = 0; r < ROWS; r++) {
      const x = bayX(b);
      const y = rowTop(r);
      rect(ctx, x, y, BAYW, ROWH, "#4A3A2E");
      for (let px = x + 18; px < x + BAYW; px += 26) rect(ctx, px, y, 1.4, ROWH, "rgba(0,0,0,.25)");
      rect(ctx, x, y, BAYW, 10, "rgba(0,0,0,.25)");
      rect(ctx, x, y + ROWH, BAYW, BOARD, "#8A6440");
      rect(ctx, x, y + ROWH, BAYW, 2, "#A27B52");
      rect(ctx, x, y + ROWH + BOARD - 2, BAYW, 2, "rgba(0,0,0,.25)");
    }
  for (let b = 0; b <= 6; b++) {
    const x = CASE_L + b * (BAYW + UP);
    rect(ctx, x, TOP + 14, UP, PLINTH - TOP - 14, "#7A5236");
    rect(ctx, x + UP - 3, TOP + 14, 3, PLINTH - TOP - 14, "rgba(0,0,0,.2)");
  }
  rect(ctx, CASE_L - 6, PLINTH, CASE_R - CASE_L + 12, FLOOR - PLINTH, "#6B4A36");
  rect(ctx, CASE_L - 6, PLINTH, CASE_R - CASE_L + 12, 4, "#8A6440");
  for (let b = 0; b < 6; b++) rect(ctx, bayX(b) + 20, PLINTH + 10, BAYW - 40, 12, "rgba(0,0,0,.15)");

  // books and things
  for (const c of CELLS) {
    const base = rowBase(c.r);
    for (const bk of c.books) book(ctx, bk, base, c.genre);
    for (const th of c.things) thing(ctx, th, base, rand);
  }
  // a bookmark and a book pulled half out
  rect(ctx, bayX(3) + 60, rowTop(4) + 10, 4, 30, "#B4513A");

  // the brass rail and the ladder
  rect(ctx, CASE_L, TOP + 2, CASE_R - CASE_L, 5, "#C9A23F");
  for (const rx of [CASE_L + 10, 400, 760, 1120, CASE_R - 12]) rect(ctx, rx - 2, TOP, 4, 12, "#A9852E");
  {
    const lx = [[330, TOP + 4, 318, BH], [384, TOP + 4, 388, BH]];
    for (const [x1, y1, x2, y2] of lx) {
      line(ctx, [x1, y1, x2, y2], "#A27B52", 8);
      line(ctx, [x1 + 2, y1, x2 + 2, y2], "rgba(255,255,255,.15)", 2);
    }
    for (let y = TOP + 60; y < BH - 10; y += 62) {
      const t = (y - TOP) / (BH - TOP);
      line(ctx, [330 + (318 - 330) * t, y, 384 + (388 - 384) * t, y], "#8A6440", 6);
    }
    ell(ctx, 330, TOP + 6, 6, 6, "#C9A23F");
    ell(ctx, 384, TOP + 6, 6, 6, "#C9A23F");
  }

  // floor and rug
  rect(ctx, 0, FLOOR, BW, BH - FLOOR, "#9C7450");
  for (let y = FLOOR + 14; y < BH; y += 16) rect(ctx, 0, y, BW, 1.4, "rgba(40,20,10,.3)");
  for (let y = FLOOR, r = 0; y < BH; y += 16, r++) for (let x = (r * 173) % 240; x < BW; x += 240) rect(ctx, x, y, 1.4, 16, "rgba(40,20,10,.3)");
  rect(ctx, 0, FLOOR, BW, 6, "rgba(0,0,0,.2)");
  {
    const rx = 380;
    const ry = FLOOR + 40;
    rect(ctx, rx, ry, 860, BH - ry, "#B4513A");
    rect(ctx, rx + 10, ry + 8, 840, BH - ry, "#7A2E2E");
    rect(ctx, rx + 22, ry + 18, 816, BH - ry, "#C9A23F");
    rect(ctx, rx + 28, ry + 24, 804, BH - ry, "#2D4C9A");
    for (let x = rx + 40; x < rx + 830; x += 36) {
      poly(ctx, [x, ry + 50, x + 12, ry + 36, x + 24, ry + 50, x + 12, ry + 64], "#E3B556");
      ell(ctx, x + 12, ry + 50, 3, 3, "#B4513A");
    }
    for (let x = rx; x < rx + 860; x += 6) line(ctx, [x, ry, x, ry - 6], "#E8E2D2", 1.2);
  }
  // books piled on the floor
  {
    const cols = ["#2D4C9A", "#B4513A", "#E3B556", "#4F7A5A", "#E8E2D2", "#6B4E7A", "#1C1C1A", "#91A8C0"];
    for (const [px, n] of [[60, 6], [140, 4], [196, 2]] as const) {
      let y = FLOOR + 40;
      for (let k = 0; k < n; k++) {
        const bh = 10 + ((k * 7 + px) % 6);
        const bw = 70 - ((k * 13 + px) % 18);
        const bx = px - bw / 2 + ((k * 5) % 9) - 4;
        rect(ctx, bx, y - bh, bw, bh, cols[(k + px) % cols.length]);
        rect(ctx, bx + 4, y - bh + 3, bw - 8, 1.4, "rgba(255,255,255,.35)");
        y -= bh;
      }
    }
    ctx.save();
    ctx.translate(196, FLOOR + 18);
    ctx.rotate(0.3);
    poly(ctx, [-30, 0, 0, -6, 30, 0, 30, 6, 0, 0, -30, 6], "#F4F1EA");
    rect(ctx, -30, 4, 60, 3, "#2D4C9A");
    ctx.restore();
  }
  // slippers
  ell(ctx, 268, 838, 18, 9, "#6B4E7A", -0.1);
  ell(ctx, 304, 842, 18, 9, "#6B4E7A", 0.15);
  ell(ctx, 274, 834, 9, 5, "#E8DCC0", -0.1);
  ell(ctx, 310, 838, 9, 5, "#E8DCC0", 0.15);

  // footstool
  rect(ctx, 704, 836, 10, 28, "#4A3226");
  rect(ctx, 816, 836, 10, 28, "#4A3226");
  rr(ctx, 694, 792, 142, 46, 10, "#4F7A5A");
  for (let x = 704; x < 830; x += 16) ell(ctx, x, 812, 2, 2, "#2F5D4A");
  rect(ctx, 728, 780, 60, 12, "#E3B556");
  rect(ctx, 734, 770, 52, 10, "#2D4C9A");
  // knitting basket
  poly(ctx, [792, 716, 858, 716, 852, 760, 798, 760], "#B8925F");
  for (let y = 722; y < 760; y += 6) rect(ctx, 794, y, 62, 1.5, "rgba(90,60,30,.35)");
  ell(ctx, 808, 712, 12, 10, "#C0533F");
  ell(ctx, 830, 708, 12, 11, "#E3B556");
  ell(ctx, 848, 714, 9, 8, "#7DB0D8");
  line(ctx, [820, 700, 846, 680], "#C9CCCB", 2);
  line(ctx, [826, 702, 856, 690], "#C9CCCB", 2);

  // the reading chair
  {
    const C = "#C9A23F";
    const D = "#A9852E";
    rect(ctx, 884, 836, 14, 28, "#4A3226");
    rect(ctx, 1122, 836, 14, 28, "#4A3226");
    rr(ctx, 900, 524, 220, 200, 40, C);
    for (let x = 916; x < 1110; x += 22) rect(ctx, x, 560, 2, 150, "rgba(0,0,0,.08)");
    for (let k = 0; k < 6; k++) ell(ctx, 930 + k * 32, 600, 2.5, 2.5, D);
    rr(ctx, 864, 620, 66, 220, 26, D);
    rr(ctx, 1090, 620, 66, 220, 26, D);
    rr(ctx, 868, 616, 58, 28, 14, C);
    rr(ctx, 1094, 616, 58, 28, 14, C);
    rr(ctx, 920, 728, 180, 60, 16, C);
    rr(ctx, 914, 780, 192, 60, 10, D);
    // blanket over the arm
    poly(ctx, [904, 640, 1020, 650, 1012, 790, 920, 798], "#E8E2D2");
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(904, 640);
    ctx.lineTo(1020, 650);
    ctx.lineTo(1012, 790);
    ctx.lineTo(920, 798);
    ctx.closePath();
    ctx.clip();
    for (let x = 900; x < 1030; x += 20) rect(ctx, x, 630, 8, 180, "rgba(45,76,154,.5)");
    for (let y = 640; y < 810; y += 20) rect(ctx, 900, y, 130, 8, "rgba(180,81,58,.45)");
    ctx.restore();
    for (let x = 922; x < 1012; x += 6) line(ctx, [x, 796, x, 806], "#E8E2D2", 1.4);
    // book left open on the arm
    poly(ctx, [1092, 612, 1122, 600, 1152, 612, 1152, 620, 1122, 610, 1092, 620], "#F4F1EA");
    poly(ctx, [1092, 620, 1122, 610, 1152, 620, 1150, 624, 1122, 614, 1094, 624], "#B4513A");
  }
  // the lamp
  {
    const lx = 1196;
    const glow = ctx.createRadialGradient(lx, 470, 10, lx, 470, 150);
    glow.addColorStop(0, "rgba(255,236,180,.45)");
    glow.addColorStop(1, "rgba(255,236,180,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(lx - 150, 320, 300, 300);
    rect(ctx, lx - 3, 470, 6, BH - 476, "#3A3631");
    ell(ctx, lx, BH - 6, 30, 6, "#3A3631");
    poly(ctx, [lx - 56, 474, lx + 56, 474, lx + 36, 396, lx - 36, 396], "#E8D2A0");
    for (let k = 0; k < 7; k++) rect(ctx, lx - 50 + k * 16, 474, 2, 8, "#B4513A");
    rect(ctx, lx - 56, 470, 112, 5, "#B4513A");
    poly(ctx, [lx - 40, 474, lx + 40, 474, lx + 26, 486, lx - 26, 486], "rgba(255,240,190,.8)");
  }
  // side table with tea and glasses
  {
    rect(ctx, 1214, 732, 98, 10, "#6B4A36");
    rect(ctx, 1222, 742, 8, BH - 742, "#4A3226");
    rect(ctx, 1296, 742, 8, BH - 742, "#4A3226");
    rect(ctx, 1222, 800, 82, 6, "#4A3226");
    rect(ctx, 1230, 786, 66, 14, "#2D4C9A");
    rect(ctx, 1226, 700, 26, 32, "#F4F1EA");
    ring(ctx, 1254, 714, 7, "#F4F1EA", 3.5);
    rect(ctx, 1226, 708, 26, 6, "#4F7A5A");
    for (const sx of [1234, 1244]) line(ctx, [sx, 696, sx - 4, 684, sx + 2, 672], "rgba(255,255,255,.5)", 1.6);
    ring(ctx, 1272, 722, 8, "#1C1C1A", 2);
    ring(ctx, 1292, 722, 8, "#1C1C1A", 2);
    line(ctx, [1280, 722, 1284, 722], "#1C1C1A", 2);
    line(ctx, [1264, 722, 1258, 730], "#1C1C1A", 1.6);
  }

  grain(ctx, rand);
  ctx.restore();
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export const bookshelf: Scene = { title: "The Bookshelf", draw, labels: LABELS, landmarks: LANDMARKS };
