// The Kitchen: a lived-in kitchen seen straight on, with every surface in use. Busy on purpose,
// so almost any piece has a jar, a magnet, a tile or a bit of the cat on it.
import { BW, BH, rng, rect, ell, poly, line, text, grain, SKIN, type Box, type Ctx, type Scene } from "./common";

const LABELS: Box[] = [];
const lab = (name: string, x: number, y: number, w: number, h: number) => LABELS.push({ x, y, w, h, name });

const CEIL = 22;
const WORK = 520;
const CAB = 538;
const KICK = 732;
const FLOOR = 744;
const RUN_L = 290;
const RUN_R = 1070;
const TILE_Y = 340;
const TILE = 30;
const WIN = { x: 384, y: 70, w: 296, h: 312 };
const SILL = 382;
const TABLE = { x: 430, w: 440, top: 700 };
const SHELF_X = 712;
const SHELVES = [128, 222, 316];
const PLATE_SHELVES = [190, 290, 390];
const RAIL = 352;
const FRIDGE = { x: 1084, y: 140, w: 216, h: FLOOR - 140 };

type Item = { k: "jar" | "tin" | "box" | "bottle" | "books" | "eggs" | "plant"; what: string; w: number; h: number; c: string; lid?: string; tag?: string; lvl?: number; name: string };
const J = (what: string, w: number, h: number, c: string, lid: string, tag: string, lvl = 0.8, name = `a jar of ${what}`): Item => ({ k: "jar", what, w, h, c, lid, tag, lvl, name });
const T = (what: string, w: number, h: number, c: string, tag: string, name = `a tin of ${what}`): Item => ({ k: "tin", what, w, h, c, tag, name });
const B = (what: string, w: number, h: number, c: string, tag: string, name: string): Item => ({ k: "box", what, w, h, c, tag, name });

const SHELF_ITEMS: Item[][] = [
  [
    T("cocoa", 30, 46, "#6B4A36", "COCOA"),
    J("pasta", 40, 64, "#D9B25E", "#B4513A", "PASTA"),
    J("rice", 32, 54, "#F1ECDD", "#2D4C9A", "RICE", 0.7),
    B("tea", 44, 60, "#2F5D4A", "TEA", "the box of tea"),
    { k: "bottle", what: "oil", w: 20, h: 82, c: "rgba(201,162,63,.85)", tag: "OIL", name: "the bottle of olive oil" },
    J("lentils", 32, 50, "#C9703E", "#3A3631", "LENTILS", 0.6),
    T("golden syrup", 32, 40, "#4F7A5A", "SYRUP"),
    B("string", 70, 52, "#C9A57A", "STRING", "the box of string too short to use"),
    J("coffee", 30, 54, "#4A3226", "#C9A23F", "COFFEE", 0.5),
  ],
  [
    J("sugar", 36, 60, "#F7F4EC", "#8FA58A", "SUGAR", 0.65),
    J("biscuits", 42, 56, "#C79A5B", "#B4513A", "BISCUITS", 0.9),
    T("beans", 30, 40, "#5E8FA8", "BEANS"),
    T("tomatoes", 30, 40, "#B4513A", "TOMS"),
    J("buttons", 30, 44, "#E3B556", "#6B4E7A", "BUTTONS", 0.75),
    { k: "books", what: "cookbooks", w: 72, h: 34, c: "", name: "the pile of cookbooks" },
    J("spaghetti", 26, 76, "#E2C27A", "#3A3631", "", 0.95, "the jar of spaghetti"),
    { k: "bottle", what: "vinegar", w: 18, h: 66, c: "rgba(140,90,60,.75)", tag: "VIN", name: "the bottle of vinegar" },
    J("raisins", 30, 46, "#5A3A3A", "#C9A23F", "RAISINS", 0.55),
  ],
  [
    J("flour", 42, 66, "#F2EEE4", "#2D4C9A", "FLOUR", 0.6),
    T("peas", 30, 40, "#7DA05A", "PEAS"),
    T("soup", 32, 46, "#C0392B", "SOUP"),
    B("cereal", 46, 74, "#E3B556", "FLAKES", "the box of cornflakes"),
    J("teabags", 36, 54, "#D8C6A2", "#B4513A", "TEABAGS", 0.7),
    J("honey", 30, 40, "#D99A2E", "#E8DCC0", "HONEY", 0.85),
    { k: "eggs", what: "eggs", w: 56, h: 24, c: "#C9C2B2", name: "the egg box" },
    T("custard", 30, 40, "#E8C44A", "CUSTARD"),
    J("marbles", 30, 44, "#7DB0D8", "#3A3631", "???", 0.7, "the jar of something"),
  ],
];

function shelfPositions() {
  return SHELF_ITEMS.map((row) => {
    let x = SHELF_X + 2;
    return row.map((it) => {
      const at = x;
      x += it.w + 5;
      return at;
    });
  });
}
const SHELF_X_AT = shelfPositions();

// Plates on the dresser, made once so labels and drawing agree.
type Plate = { x: number; r: number; rim: string; mid: string; pat: number };
const PLATES: Plate[][] = (() => {
  const rand = rng(9071);
  const rims = ["#2D4C9A", "#B4513A", "#E3B556", "#8FA58A", "#F4F1EA", "#D98C9C", "#6B4E7A", "#C9A23F"];
  return PLATE_SHELVES.map(() => {
    const row: Plate[] = [];
    let x = 42;
    while (x < 262) {
      const r = 17 + Math.floor(rand() * 10);
      if (x + r > 268) break;
      row.push({ x: x + r * 0.2, r, rim: rims[Math.floor(rand() * rims.length)], mid: rand() < 0.5 ? "#F4F1EA" : "#E8E2D2", pat: Math.floor(rand() * 5) });
      x += r * 1.55 + 2;
    }
    return row;
  });
})();

type Tile = { c: number; r: number; kind: "delft" | "lemon" | "sage" | "crack" | "gone" | "check" | "tomato" };
const ODD_TILES: Tile[] = [
  { c: 2, r: 1, kind: "delft" },
  { c: 4, r: 4, kind: "sage" },
  { c: 9, r: 0, kind: "lemon" },
  { c: 17, r: 1, kind: "crack" },
  { c: 21, r: 2, kind: "delft" },
  { c: 24, r: 0, kind: "gone" },
  { c: 13, r: 0, kind: "tomato" },
  { c: 0, r: 3, kind: "check" },
  { c: 7, r: 5, kind: "crack" },
  { c: 22, r: 5, kind: "sage" },
  { c: 15, r: 4, kind: "delft" },
  { c: 25, r: 3, kind: "lemon" },
];

// Names for everything, in the order things are drawn (later ones sit on top).
lab("the kitchen wall", 0, 0, BW, BH);
lab("the floor", 0, FLOOR, BW, BH - FLOOR);
lab("the tiles", RUN_L, TILE_Y, RUN_R - RUN_L, WORK - TILE_Y);
for (const t of ODD_TILES.filter((t) => t.kind === "gone" || t.kind === "tomato" || t.kind === "check")) {
  const n = { delft: "the blue tile", lemon: "the tile with the lemon", sage: "the green tile", crack: "the cracked tile", gone: "the missing tile", check: "the odd checked tile", tomato: "the tile with the tomato" }[t.kind];
  lab(n, RUN_L + t.c * TILE, TILE_Y + t.r * TILE, TILE, TILE);
}
lab("the dresser", 10, 60, 282, FLOOR - 60);
PLATE_SHELVES.forEach((s, k) => lab(["the top row of plates", "the middle row of plates", "the bottom row of plates"][k], 30, s - 58, 242, 58));
lab("the teacups on hooks", 30, PLATE_SHELVES[0] + 4, 242, 32);
lab("the teacups on hooks", 30, PLATE_SHELVES[1] + 4, 242, 32);
lab("the big platter", 40, 34, 64, 64);
lab("the basket on the dresser", 118, 62, 76, 36);
lab("the jug on the dresser", 216, 54, 48, 44);
lab("the jug of flowers", 36, 370, 60, 66);
lab("the pile of post", 108, 404, 62, 30);
lab("the shortbread tin", 176, 404, 56, 30);
lab("the photo on the dresser", 238, 384, 44, 50);
lab("the calendar", 294, 88, 70, 176);
lab("the key rack", 298, 272, 64, 56);
lab("the curtain", 364, 56, 48, 260);
lab("the curtain", 650, 56, 48, 260);
lab("the window", WIN.x, WIN.y, WIN.w, WIN.h);
lab("the garden", WIN.x + 12, WIN.y + 12, WIN.w - 24, WIN.h - 24);
lab("the apple tree", 396, 92, 98, 180);
lab("the washing on the line", 470, 180, 120, 60);
lab("the shed", 568, 172, 100, 110);
lab("the cat on the fence", 488, 210, 40, 40);
lab("the garden gnome", 596, 300, 30, 50);
lab("the bird feeder", 456, 152, 24, 44);
lab("the lamp", 500, 22, 64, 48);
lab("the plants on the windowsill", 376, 330, 312, 66);
lab("the shelves", SHELF_X - 8, 30, 360, 300);
SHELF_ITEMS.forEach((row, r) => row.forEach((it, k) => lab(it.name, SHELF_X_AT[r][k], SHELVES[r] - it.h, it.w, it.h)));
lab("the frying pan", 700, RAIL, 62, 100);
lab("the copper pan", 764, RAIL, 52, 84);
lab("the blue pan", 822, RAIL, 46, 74);
lab("the utensils", 880, RAIL, 176, 110);
lab("the worktop", RUN_L, WORK - 8, RUN_R - RUN_L, CAB - WORK + 8);
lab("the cupboards", RUN_L, CAB, RUN_R - RUN_L, FLOOR - CAB);
lab("the toaster", 296, 448, 82, 74);
lab("the sink", 436, 470, 190, 54);
lab("the washing-up liquid", 446, 462, 26, 52);
lab("the dish rack", 624, 466, 80, 56);
lab("the radio", 706, 400, 90, 122);
lab("the cooker", 800, 512, 180, FLOOR - 512);
lab("the kettle", 814, 452, 72, 62);
lab("the saucepan on the cooker", 892, 466, 84, 48);
lab("the tea towel", 818, 560, 48, 74);
lab("the washing machine", 620, CAB, 180, KICK - CAB);
lab("the bread bin", 986, 458, 82, 64);
lab("the clock", 1170, 36, 70, 72);
lab("the biscuit barrel on the fridge", 1092, 92, 64, 48);
lab("the basket on the fridge", 1246, 104, 58, 36);
lab("the fridge", FRIDGE.x, FRIDGE.y, FRIDGE.w, FRIDGE.h);
lab("the postcard", 1124, 164, 76, 54);
lab("the takeaway menu", 1210, 156, 64, 96);
lab("the school photo", 1118, 232, 56, 60);
lab("the fridge magnet letters", 1186, 262, 100, 30);
lab("the child's drawing", 1120, 364, 96, 84);
lab("the shopping list", 1222, 356, 64, 116);
lab("the note about the milk", 1118, 460, 160, 70);
lab("the swimming certificate", 1196, 540, 90, 72);
lab("the photo of the dog", 1116, 562, 66, 66);
lab("the dentist card", 1130, 648, 80, 36);
lab("the apron", 1304, 180, 40, 190);
lab("the mop and bucket", 1300, 400, 44, FLOOR - 400 + 110);
lab("the table", TABLE.x, TABLE.top - 10, TABLE.w, BH - TABLE.top + 10);
lab("the tablecloth", TABLE.x, TABLE.top - 10, TABLE.w, 66);
lab("the newspaper", 440, 640, 62, 60);
lab("the box of oats", 504, 612, 50, 88);
lab("the milk bottle", 554, 632, 30, 68);
lab("the bowl of cereal", 584, 660, 56, 40);
lab("the teapot", 638, 618, 84, 82);
lab("the mug", 720, 660, 34, 40);
lab("the boiled egg", 752, 656, 22, 44);
lab("the jam", 774, 660, 26, 40);
lab("the fruit bowl", 798, 628, 72, 72);
lab("the chair", 340, 620, 96, BH - 620);
lab("the chair", 876, 640, 104, BH - 640);
lab("the basket of potatoes", 34, 650, 112, 94);
lab("the pile of old newspapers", 170, 676, 96, 68);
lab("the recycling box", 292, 674, 112, 70);
lab("the oven glove", 368, 556, 30, 60);
lab("the pedal bin", 990, 640, 74, 104);
lab("the cat on the chair", 878, 700, 92, 62);
lab("the slippers", 170, 810, 90, 44);
lab("the ball of wool", 290, 816, 50, 36);
lab("the toast on the floor", 620, 822, 60, 26);
lab("the cat bowl", 1004, 806, 76, 40);
lab("the laundry basket", 1096, 750, 140, 104);

/** Places worth starting the puzzle from: things you'd find first on the lid. */
const LANDMARKS = [
  { x: 150, y: 250 }, // the dresser plates
  { x: 530, y: 230 }, // the window
  { x: 880, y: 180 }, // the jars
  { x: 1190, y: 470 }, // the milk notes
  { x: 925, y: 730 }, // the cat on the chair
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
function tag(ctx: Ctx, s: string, cx: number, cy: number, w: number, size = 7.5) {
  rect(ctx, cx - w / 2, cy - 7, w, 14, "#F4EEDC");
  text(ctx, s, cx, cy + 0.5, size, "#1C1C1A", "Courier Prime", 700);
}

function jarContents(ctx: Ctx, it: Item, x: number, y: number, w: number, h: number, rand: () => number) {
  const top = y + h * (1 - (it.lvl ?? 0.8));
  rect(ctx, x, top, w, y + h - top, it.c);
  const n = Math.floor(w * (y + h - top) / 22);
  for (let k = 0; k < n; k++) {
    const px = x + rand() * w;
    const py = top + rand() * (y + h - top);
    switch (it.what) {
      case "pasta": ell(ctx, px, py, 4, 2.4, k % 2 ? "#C99A42" : "#E8C77A", rand() * 3); break;
      case "rice": rect(ctx, px, py, 2.4, 1.2, "rgba(190,180,160,.7)"); break;
      case "lentils": ell(ctx, px, py, 2, 2, k % 2 ? "#E08A50" : "#A85A2E"); break;
      case "coffee": rect(ctx, px, py, 1.6, 1.6, "#2E1E16"); break;
      case "sugar": case "flour": rect(ctx, px, py, 1.5, 1.5, "rgba(150,140,120,.3)"); break;
      case "teabags": if (k % 3 === 0) rect(ctx, px - 6, py - 5, 12, 10, k % 2 ? "#C9B48A" : "#E2D3B2"); break;
      case "buttons": ell(ctx, px, py, 3, 3, ["#C0533F", "#2D4C9A", "#4F7A5A", "#F4F1EA", "#6B4E7A"][k % 5]); break;
      case "raisins": ell(ctx, px, py, 2, 1.6, "#2E1E1E"); break;
      case "honey": if (k % 4 === 0) rect(ctx, px, py, 3, 1.5, "rgba(255,230,160,.4)"); break;
      case "marbles": if (k % 2 === 0) { ell(ctx, px, py, 4, 4, ["#C0533F", "#E3B556", "#4F7A5A", "#2D4C9A"][k % 4]); ell(ctx, px - 1.2, py - 1.2, 1.2, 1.2, "rgba(255,255,255,.6)"); } break;
    }
  }
  if (it.what === "biscuits") for (let yy = y + h - 8; yy > top; yy -= 9) ell(ctx, x + w / 2, yy, w / 2 - 2, 4, (yy / 9) % 2 > 1 ? "#B5844A" : "#D7A866");
  if (it.what === "spaghetti") for (let xx = x + 2; xx < x + w - 1; xx += 2.5) rect(ctx, xx, y - 16 + ((xx * 7) % 5), 1.4, h + 16, "#E8CF8A");
}

function shelfItem(ctx: Ctx, it: Item, x: number, base: number, rand: () => number) {
  const top = base - it.h;
  switch (it.k) {
    case "jar": {
      const gy = top + 9;
      const gh = it.h - 9;
      rr(ctx, x, gy, it.w, gh, 5, "rgba(214,228,226,.6)");
      ctx.save();
      rrPath(ctx, x, gy, it.w, gh, 5);
      ctx.clip();
      jarContents(ctx, it, x, gy, it.w, gh, rand);
      ctx.restore();
      if (it.what === "spaghetti") break;
      rect(ctx, x + 3, gy + 4, 3, gh - 10, "rgba(255,255,255,.45)");
      rect(ctx, x + 2, top, it.w - 4, 10, it.lid!);
      rect(ctx, x + 2, top + 3, it.w - 4, 1.4, "rgba(0,0,0,.18)");
      rect(ctx, x + 2, top + 6, it.w - 4, 1.4, "rgba(0,0,0,.18)");
      if (it.tag) tag(ctx, it.tag, x + it.w / 2, gy + gh * 0.5, it.w - 6, it.tag.length > 6 ? 6 : 7.5);
      break;
    }
    case "tin": {
      rect(ctx, x, top + 3, it.w, it.h - 3, "#B9BDBF");
      ell(ctx, x + it.w / 2, top + 3, it.w / 2, 3, "#D8DBDB");
      rect(ctx, x, top + 9, it.w, it.h - 14, it.c);
      rect(ctx, x, top + 9, it.w, 2, "rgba(255,255,255,.25)");
      text(ctx, it.tag!, x + it.w / 2, top + it.h / 2 + 3, it.tag!.length > 5 ? 5.5 : 7, "#FFFEFA", "Work Sans", 700);
      rect(ctx, x + it.w - 6, top + 9, 3, it.h - 14, "rgba(0,0,0,.12)");
      break;
    }
    case "box": {
      rect(ctx, x, top, it.w, it.h, it.c);
      rect(ctx, x + it.w - 6, top, 6, it.h, "rgba(0,0,0,.14)");
      if (it.what === "string") {
        text(ctx, "STRING", x + it.w / 2, top + 13, 9, "#1C1C1A", "Libre Caslon Text", 700);
        text(ctx, "too short", x + it.w / 2, top + 27, 7.5, "#1C1C1A", "Courier Prime", 700);
        text(ctx, "to use", x + it.w / 2, top + 37, 7.5, "#1C1C1A", "Courier Prime", 700);
        line(ctx, [x + 50, top, x + 54, top - 6, x + 60, top - 3], "#F4F1EA", 1.4);
      } else if (it.what === "tea") {
        text(ctx, "TEA", x + it.w / 2, top + 18, 12, "#E3B556", "Libre Caslon Text", 700);
        ell(ctx, x + it.w / 2 - 3, top + 40, 10, 7, "#FFFEFA");
        rect(ctx, x + it.w / 2 + 6, top + 36, 5, 6, "#FFFEFA");
      } else {
        text(ctx, it.tag!, x + it.w / 2 - 2, top + 14, 9, "#B4513A", "Work Sans", 700);
        ell(ctx, x + it.w / 2 - 3, top + 46, 14, 8, "#FFFEFA");
        for (let k = 0; k < 5; k++) ell(ctx, x + it.w / 2 - 10 + k * 4, top + 42, 3, 2, "#D9A55E");
        ell(ctx, x + 12, top + 26, 6, 6, "#C0533F");
      }
      break;
    }
    case "bottle": {
      rect(ctx, x + it.w / 2 - 3, top, 6, 8, "#3A3631");
      rect(ctx, x + it.w / 2 - 3.5, top + 8, 7, it.h * 0.3, it.c);
      rr(ctx, x, top + it.h * 0.36, it.w, it.h * 0.64, 4, it.c);
      tag(ctx, it.tag!, x + it.w / 2, top + it.h * 0.68, it.w - 2, 6);
      rect(ctx, x + 2, top + it.h * 0.4, 2, it.h * 0.5, "rgba(255,255,255,.4)");
      break;
    }
    case "books": {
      const cols = ["#2D4C9A", "#B4513A", "#C9A23F", "#4F7A5A"];
      for (let k = 0; k < 3; k++) {
        const bw = it.w - [0, 10, 4][k];
        const bx = x + [0, 6, 1][k];
        const by = base - (k + 1) * 11;
        rect(ctx, bx, by, bw, 11, cols[k]);
        rect(ctx, bx + 4, by + 4, bw - 10, 1.5, "rgba(255,254,250,.5)");
      }
      rr(ctx, x + 22, top - 2, 30, 4, 2, "#E3B556");
      break;
    }
    case "eggs": {
      rect(ctx, x, base - 14, it.w, 14, it.c);
      for (let k = 0; k < 4; k++) ell(ctx, x + 8 + k * 13, base - 15, 6, 7, k === 2 ? "#F4EEE0" : "#D9B48A");
      rect(ctx, x, base - 14, it.w, 2, "rgba(0,0,0,.12)");
      break;
    }
  }
}

function plate(ctx: Ctx, p: Plate, cy: number) {
  ell(ctx, p.x, cy, p.r, p.r, p.rim);
  ell(ctx, p.x, cy, p.r * 0.72, p.r * 0.72, p.mid);
  switch (p.pat) {
    case 0:
      for (let k = 0; k < 10; k++) ell(ctx, p.x + Math.cos(k * 0.628) * p.r * 0.86, cy + Math.sin(k * 0.628) * p.r * 0.86, 1.8, 1.8, "#F4F1EA");
      break;
    case 1:
      ell(ctx, p.x, cy, p.r * 0.4, p.r * 0.4, "#2D4C9A");
      ell(ctx, p.x, cy, p.r * 0.25, p.r * 0.25, "#F4F1EA");
      break;
    case 2:
      for (let k = 0; k < 5; k++) ell(ctx, p.x + Math.cos(k * 1.256) * p.r * 0.3, cy + Math.sin(k * 1.256) * p.r * 0.3, p.r * 0.17, p.r * 0.17, "#D98C9C");
      ell(ctx, p.x, cy, p.r * 0.12, p.r * 0.12, "#E3B556");
      break;
    case 3:
      ring(ctx, p.x, cy, p.r * 0.55, "#4F7A5A", 1.5);
      break;
    default:
      ell(ctx, p.x - p.r * 0.2, cy - p.r * 0.2, p.r * 0.2, p.r * 0.12, "rgba(255,255,255,.45)", -0.6);
  }
}

function cup(ctx: Ctx, x: number, y: number, c: string) {
  line(ctx, [x, y - 6, x, y - 1], "#C9A23F", 1.4);
  poly(ctx, [x - 9, y, x + 9, y, x + 7, y + 16, x - 7, y + 16], c);
  ring(ctx, x + 10, y + 6, 4, c, 2.4);
  rect(ctx, x - 9, y, 18, 2.5, "rgba(255,255,255,.4)");
}

function tile(ctx: Ctx, x: number, y: number, t: Tile["kind"] | null) {
  if (t === "gone") {
    rect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, "#B8AE9A");
    for (let k = 0; k < 8; k++) rect(ctx, x + 4 + ((k * 7) % 20), y + 4 + ((k * 11) % 22), 3, 1.5, "rgba(80,70,60,.3)");
    return;
  }
  rect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, t === "sage" ? "#9DB59A" : "#EEEAE0");
  rect(ctx, x + 2, y + 2, TILE - 6, 2, "rgba(255,255,255,.6)");
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  if (t === "delft") {
    ring(ctx, cx, cy, 8, "#2D4C9A", 1.6);
    for (let k = 0; k < 4; k++) ell(ctx, cx + Math.cos(k * 1.57) * 4, cy + Math.sin(k * 1.57) * 4, 2.6, 2.6, "#2D4C9A");
    for (const [dx, dy] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) ell(ctx, cx + dx, cy + dy, 3, 3, "#2D4C9A");
  } else if (t === "lemon") {
    ell(ctx, cx, cy + 2, 8, 6, "#E3C24A", -0.3);
    ell(ctx, cx + 5, cy - 6, 4, 2, "#4F7A5A", 0.5);
  } else if (t === "tomato") {
    ell(ctx, cx, cy + 2, 8, 7, "#B4513A");
    poly(ctx, [cx - 4, cy - 5, cx, cy - 2, cx + 4, cy - 5, cx, cy - 7], "#4F7A5A");
  } else if (t === "crack") {
    line(ctx, [x + 4, y + 6, x + 12, y + 14, x + 10, y + 20, x + 22, y + 27], "rgba(60,50,40,.55)", 1);
  } else if (t === "check") {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) rect(ctx, x + 1 + i * 7, y + 1 + j * 7, 7, 7, "#B4513A");
  }
}

function garden(ctx: Ctx, rand: () => number) {
  const gx = WIN.x + 12;
  const gy = WIN.y + 12;
  const gw = WIN.w - 24;
  const gh = WIN.h - 24;
  const sky = ctx.createLinearGradient(0, gy, 0, gy + 160);
  sky.addColorStop(0, "#A9C3D3");
  sky.addColorStop(1, "#E2E8E0");
  ctx.fillStyle = sky;
  ctx.fillRect(gx, gy, gw, gh);
  for (const [dx, dy, r] of [[560, 112, 18], [584, 104, 22], [608, 114, 16], [586, 118, 20]]) ell(ctx, dx, dy, r * 1.2, r * 0.75, "#F6F4EE");
  ell(ctx, 650, 100, 14, 14, "rgba(255,250,228,.8)");
  // far trees and the neighbour's roof
  poly(ctx, [600, 200, 640, 160, 680, 200], "#8A6E5E");
  rect(ctx, 610, 196, 60, 30, "#C9B79A");
  for (let k = 0; k < 14; k++) ell(ctx, gx + k * 22, 214 - (k % 3) * 6, 18, 16, k % 2 ? "#6F8F5E" : "#5E7F52");
  // fence
  rect(ctx, gx, 218, gw, 50, "#A7835C");
  for (let x = gx; x < gx + gw; x += 13) rect(ctx, x, 218, 1.5, 50, "rgba(60,40,25,.35)");
  rect(ctx, gx, 230, gw, 3, "rgba(60,40,25,.3)");
  // lawn
  rect(ctx, gx, 266, gw, gh - (266 - gy), "#8DAA6E");
  for (let x = gx; x < gx + gw; x += 36) rect(ctx, x, 266, 18, gh, "rgba(255,255,255,.07)");
  // flower bed
  rect(ctx, gx, 268, gw, 12, "#7A5A3C");
  for (let k = 0; k < 40; k++) ell(ctx, gx + rand() * gw, 266 + rand() * 10, 3, 3, ["#C0533F", "#E3B556", "#D98CB0", "#FFFEFA", "#8E6BB0"][k % 5]);
  // the shed
  rect(ctx, 580, 196, 80, 86, "#7D6A55");
  for (let x = 580; x < 660; x += 9) rect(ctx, x, 196, 1.4, 86, "rgba(30,20,10,.25)");
  poly(ctx, [572, 200, 620, 172, 668, 200], "#3E3B38");
  rect(ctx, 590, 222, 26, 60, "#5E4A38");
  rect(ctx, 626, 214, 24, 20, "#C9D7E0");
  rect(ctx, 637, 214, 2, 20, "#7D6A55");
  ell(ctx, 612, 254, 2, 2, "#E3B556");
  // the apple tree and the washing line
  rect(ctx, 430, 180, 12, 100, "#6B4E38");
  for (const [dx, dy, r] of [[410, 140, 26], [440, 112, 32], [470, 140, 26], [440, 152, 28], [416, 168, 18], [464, 172, 18]]) ell(ctx, dx, dy, r, r * 0.9, "#557A4A");
  for (let k = 0; k < 9; k++) ell(ctx, 410 + rand() * 66, 110 + rand() * 70, 3.5, 3.5, "#C0533F");
  line(ctx, [446, 194, 580, 210], "#E8E4DA", 1);
  const clothes: [number, string, number][] = [[480, "#B4513A", 0], [506, "#FFFEFA", 1], [530, "#2D4C9A", 2], [552, "#E3B556", 1]];
  for (const [x, c, kind] of clothes) {
    const y = 194 + (x - 446) * 0.12;
    if (kind === 0) poly(ctx, [x - 10, y, x + 10, y, x + 14, y + 8, x + 8, y + 8, x + 8, y + 28, x - 8, y + 28, x - 8, y + 8, x - 14, y + 8], c);
    else if (kind === 1) rect(ctx, x - 9, y, 18, 24, c);
    else poly(ctx, [x - 5, y, x + 1, y, x + 1, y + 16, x + 8, y + 20, x + 6, y + 24, x - 5, y + 20], c);
    rect(ctx, x - 1, y - 3, 2, 5, "#C9A23F");
  }
  // bird feeder in the tree
  line(ctx, [468, 150, 468, 164], "#3A3631", 1);
  rect(ctx, 462, 164, 12, 22, "rgba(200,220,220,.8)");
  rect(ctx, 463, 172, 10, 13, "#C9A57A");
  ell(ctx, 478, 180, 5, 4, "#4A6E9A");
  ell(ctx, 481, 176, 3, 3, "#E3B556");
  // the neighbour's cat on the fence
  ell(ctx, 506, 210, 11, 8, "#3A3631");
  ell(ctx, 498, 202, 7, 6, "#3A3631");
  poly(ctx, [493, 199, 494, 191, 498, 197], "#3A3631");
  poly(ctx, [500, 197, 504, 191, 505, 199], "#3A3631");
  line(ctx, [516, 212, 520, 228], "#3A3631", 3);
  ell(ctx, 496, 202, 1, 1, "#E3D25A");
  ell(ctx, 501, 202, 1, 1, "#E3D25A");
  // the gnome
  ell(ctx, 610, 338, 9, 11, "#2D4C9A");
  ell(ctx, 610, 324, 6, 6, SKIN[3]);
  poly(ctx, [602, 324, 618, 324, 610, 302], "#B4513A");
  poly(ctx, [604, 328, 616, 328, 610, 340], "#F4F1EA");
  ell(ctx, 610, 349, 12, 3, "rgba(0,0,0,.2)");
  // a path and a ball on the lawn
  poly(ctx, [520, 370, 540, 280, 556, 280, 580, 370], "#C9BFAE");
  ell(ctx, 450, 330, 8, 8, "#C0533F");
  rect(ctx, 446, 326, 3, 3, "rgba(255,255,255,.5)");
}

function fridge(ctx: Ctx) {
  const { x, y, w, h } = FRIDGE;
  ell(ctx, x + w / 2, y + h, w / 2 + 6, 6, "rgba(0,0,0,.18)");
  rr(ctx, x, y, w, h, 16, "#B9CCD6");
  rect(ctx, x, y + 196, w, 6, "#8FA4B0");
  rect(ctx, x + w - 10, y + 20, 4, h - 40, "rgba(255,255,255,.3)");
  rr(ctx, x + 10, y + 132, 8, 52, 3, "#E8E4DA");
  rr(ctx, x + 10, y + 214, 8, 90, 3, "#E8E4DA");
  rect(ctx, x + 20, y + h - 22, w - 40, 14, "#8FA4B0");
  for (let k = 0; k < 8; k++) rect(ctx, x + 26 + k * 22, y + h - 19, 14, 2, "#6E8290");
  // postcard
  ctx.save();
  ctx.translate(1162, 192);
  ctx.rotate(-0.06);
  rect(ctx, -36, -24, 72, 48, "#FFFEFA");
  rect(ctx, -33, -21, 66, 24, "#7DB0D8");
  rect(ctx, -33, 3, 66, 18, "#E3CF96");
  poly(ctx, [-20, 3, -10, -12, 0, 3], "#6E747A");
  ell(ctx, 16, -12, 5, 5, "#F4E1A6");
  text(ctx, "WISH YOU WERE", 0, 13, 6.5, "#B4513A", "Work Sans", 700);
  ell(ctx, 0, -22, 4, 4, "#C0533F");
  ctx.restore();
  // takeaway menu
  rect(ctx, 1212, 158, 60, 92, "#FFFEFA");
  rect(ctx, 1212, 158, 60, 18, "#B4513A");
  text(ctx, "TAKEAWAY", 1242, 167, 7.5, "#FFFEFA", "Work Sans", 700);
  for (let k = 0; k < 9; k++) {
    rect(ctx, 1217, 184 + k * 7, 34 - (k % 3) * 5, 2, "rgba(28,28,26,.5)");
    rect(ctx, 1258, 184 + k * 7, 9, 2, "rgba(28,28,26,.5)");
  }
  ell(ctx, 1242, 160, 4, 4, "#E3B556");
  // school photo
  rect(ctx, 1120, 234, 52, 56, "#F4F1EA");
  rect(ctx, 1124, 238, 44, 40, "#7D8C9E");
  ell(ctx, 1146, 252, 8, 9, SKIN[0]);
  ctx.fillStyle = "#C9783E";
  ctx.beginPath();
  ctx.ellipse(1146, 249, 9, 8, 0, Math.PI, 0);
  ctx.fill();
  ell(ctx, 1146, 280, 14, 16, "#B4513A");
  rect(ctx, 1124, 278, 44, 8, "#F4F1EA");
  ell(ctx, 1132, 236, 4, 4, "#4F7A5A");
  // magnet letters
  const letters: [string, string][] = [["M", "#C0533F"], ["U", "#E3B556"], ["M", "#2D4C9A"], ["x", "#4F7A5A"], ["?", "#6B4E7A"]];
  letters.forEach(([s, c], k) => text(ctx, s, 1198 + k * 19, 276 + (k % 2) * 4, 20, c, "Work Sans", 700));
  // child's drawing
  ctx.save();
  ctx.translate(1168, 406);
  ctx.rotate(0.04);
  rect(ctx, -46, -40, 92, 80, "#FFFEFA");
  ell(ctx, 30, -26, 8, 8, "#E3C24A");
  for (let k = 0; k < 8; k++) line(ctx, [30 + Math.cos(k * 0.8) * 10, -26 + Math.sin(k * 0.8) * 10, 30 + Math.cos(k * 0.8) * 14, -26 + Math.sin(k * 0.8) * 14], "#E3C24A", 1.4);
  rect(ctx, -34, -6, 34, 30, "#C0533F");
  poly(ctx, [-38, -6, -17, -26, 4, -6], "#2D4C9A");
  rect(ctx, -22, 8, 10, 16, "#E3B556");
  line(ctx, [16, 6, 16, 22, 10, 32, 16, 22, 22, 32], "#1C1C1A", 1.6);
  line(ctx, [8, 12, 24, 12], "#1C1C1A", 1.6);
  ell(ctx, 16, 0, 5, 5, "#1C1C1A");
  line(ctx, [-44, 34, 44, 34], "#4F7A5A", 3);
  ell(ctx, 32, 28, 6, 4, "#C9783E");
  ctx.restore();
  ell(ctx, 1168, 368, 4, 4, "#2D4C9A");
  // shopping list
  rect(ctx, 1224, 358, 60, 112, "#F7F2E2");
  for (let k = 0; k < 12; k++) rect(ctx, 1224, 372 + k * 8, 60, 0.8, "rgba(45,76,154,.35)");
  ["milk", "eggs", "bread", "bin bags", "milk", "string", "MILK"].forEach((s, k) => text(ctx, s, 1252, 377 + k * 13, 8, "#2D4C9A", "Courier Prime", 700));
  line(ctx, [1236, 377 + 4 * 13, 1268, 377 + 4 * 13], "#2D4C9A", 1);
  ell(ctx, 1254, 360, 5, 5, "#C0533F");
  // the milk notes
  const notes: [number, number, string, string[], number][] = [
    [1120, 474, "#F2DC7A", ["BUY", "MILK"], -0.08],
    [1172, 482, "#E7B9C3", ["BOUGHT", "MILK"], 0.05],
    [1224, 476, "#B9D7E0", ["WHO", "DRANK", "IT"], -0.04],
  ];
  for (const [nx, ny, c, lines, rot] of notes) {
    ctx.save();
    ctx.translate(nx + 26, ny + 24);
    ctx.rotate(rot);
    rect(ctx, -26, -24, 52, 50, c);
    rect(ctx, -26, -24, 52, 6, "rgba(0,0,0,.06)");
    lines.forEach((s, k) => text(ctx, s, 0, -6 + k * 12 - (lines.length - 2) * 5, s.length > 4 ? 9 : 11, "#1C1C1A", "Courier Prime", 700));
    ctx.restore();
  }
  // certificate
  rect(ctx, 1198, 542, 86, 68, "#FFFEFA");
  rect(ctx, 1202, 546, 78, 60, "#F4EEDC");
  text(ctx, "SWIMMING", 1241, 558, 9, "#2D4C9A", "Libre Caslon Text", 700);
  text(ctx, "10 metres", 1241, 572, 8, "#1C1C1A", "Courier Prime", 700);
  for (let k = 0; k < 3; k++) rect(ctx, 1214, 582 + k * 6, 54, 1.4, "rgba(28,28,26,.35)");
  ell(ctx, 1268, 598, 6, 6, "#C9A23F");
  ell(ctx, 1240, 544, 4, 4, "#4F7A5A");
  // photo of the dog
  ctx.save();
  ctx.translate(1148, 594);
  ctx.rotate(-0.1);
  rect(ctx, -30, -30, 60, 60, "#FFFEFA");
  rect(ctx, -26, -26, 52, 44, "#9DB59A");
  ell(ctx, 0, 6, 16, 12, "#9C6B3E");
  ell(ctx, 2, -8, 10, 9, "#9C6B3E");
  ell(ctx, -8, -8, 4, 8, "#6E4A2A", 0.3);
  ell(ctx, 12, -8, 4, 8, "#6E4A2A", -0.3);
  ell(ctx, 2, -4, 3, 2, "#1C1C1A");
  ctx.restore();
  // dentist card
  rect(ctx, 1132, 650, 76, 32, "#FFFEFA");
  text(ctx, "DENTIST", 1170, 660, 8, "#2D4C9A", "Work Sans", 700);
  text(ctx, "TUES 9.40", 1170, 672, 8, "#1C1C1A", "Courier Prime", 700);
  // magnets scattered
  const mags: [number, number, string][] = [[1246, 650, "#C0533F"], [1272, 668, "#E3B556"], [1230, 690, "#4F7A5A"], [1110, 330, "#E3B556"], [1280, 316, "#C0533F"], [1110, 540, "#6B4E7A"], [1186, 540, "#2D4C9A"], [1270, 236, "#4F7A5A"]];
  for (const [mx, my, c] of mags) {
    ell(ctx, mx, my, 7, 7, c);
    ell(ctx, mx - 2, my - 2, 2, 2, "rgba(255,255,255,.45)");
  }
  // a strawberry and a banana magnet
  poly(ctx, [1258, 700, 1274, 700, 1266, 716], "#C0533F");
  poly(ctx, [1258, 700, 1266, 694, 1274, 700], "#4F7A5A");
  ctx.strokeStyle = "#E3C24A";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(1110, 720, 12, 0.2, 1.8);
  ctx.stroke();
}

/** Draws the whole picture into ctx, in world units (0..BW, 0..BH). Same picture every time. */
function draw(ctx: Ctx) {
  const rand = rng(31337);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, BW, BH);
  ctx.clip();

  // wallpaper with little sprigs
  rect(ctx, 0, 0, BW, FLOOR, "#E9DFC6");
  for (let y = CEIL + 8, r = 0; y < FLOOR; y += 30, r++)
    for (let x = (r % 2) * 13 + 4; x < BW; x += 26) {
      line(ctx, [x, y + 6, x, y - 3], "rgba(79,122,90,.35)", 1);
      ell(ctx, x - 3, y, 3, 1.6, "rgba(79,122,90,.35)", 0.6);
      ell(ctx, x + 3, y + 2, 3, 1.6, "rgba(79,122,90,.35)", -0.6);
      if ((x + r) % 3 === 0) ell(ctx, x, y - 4, 1.8, 1.8, "rgba(180,81,58,.45)");
    }
  rect(ctx, 0, 0, BW, CEIL, "#D8CDB2");
  rect(ctx, 0, CEIL, BW, 4, "#F2ECDD");
  rect(ctx, 0, CEIL + 4, BW, 3, "rgba(0,0,0,.08)");

  // the floor: diamond lino
  rect(ctx, 0, FLOOR, BW, BH - FLOOR, "#E4D9C2");
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, FLOOR, BW, BH - FLOOR);
  ctx.clip();
  for (let y = FLOOR - 20, r = 0; y < BH + 20; y += 20, r++)
    for (let x = (r % 2) * 22 - 22; x < BW + 22; x += 44) poly(ctx, [x, y, x + 22, y + 20, x, y + 40, x - 22, y + 20], (r + Math.floor(x / 44)) % 3 === 0 ? "#A5584A" : "#B86A55");
  ctx.restore();
  for (let k = 0; k < 500; k++) rect(ctx, rand() * BW, FLOOR + rand() * (BH - FLOOR), 2, 2, "rgba(60,40,30,.08)");
  rect(ctx, 0, FLOOR, BW, 6, "rgba(0,0,0,.12)");

  // tiles
  rect(ctx, RUN_L, TILE_Y, RUN_R - RUN_L, WORK - TILE_Y, "#CFC8B8");
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 26; c++) {
      const odd = ODD_TILES.find((t) => t.c === c && t.r === r);
      tile(ctx, RUN_L + c * TILE, TILE_Y + r * TILE, odd ? odd.kind : null);
    }

  // the dresser
  {
    rect(ctx, 30, 104, 242, 330, "#6F8F92");
    for (let x = 30; x < 272; x += 20) rect(ctx, x, 104, 1.5, 330, "rgba(20,30,30,.25)");
    rect(ctx, 16, 96, 270, 14, "#88A6A8");
    rect(ctx, 10, 90, 282, 8, "#9DB9B9");
    rect(ctx, 16, 104, 14, 330, "#88A6A8");
    rect(ctx, 272, 104, 14, 330, "#88A6A8");
    PLATE_SHELVES.forEach((s, i) => {
      PLATES[i].forEach((p) => plate(ctx, p, s - p.r - 2));
      rect(ctx, 30, s - 22, 242, 3, "#9DB9B9");
      rect(ctx, 30, s, 242, 8, "#9DB9B9");
      rect(ctx, 30, s + 8, 242, 2, "rgba(0,0,0,.2)");
    });
    const cupCols = ["#B4513A", "#F4F1EA", "#2D4C9A", "#E3B556", "#D98C9C", "#4F7A5A", "#F4F1EA"];
    for (const [s, off] of [[PLATE_SHELVES[0], 0], [PLATE_SHELVES[1], 3]] as const)
      for (let k = 0; k < 7; k++) cup(ctx, 46 + k * 33 + (off ? 8 : 0), s + 16, cupCols[(k + off) % 7]);
    // on top
    ell(ctx, 72, 66, 30, 30, "#E3D7B8");
    ell(ctx, 72, 66, 22, 22, "#2D4C9A");
    ell(ctx, 72, 66, 16, 16, "#E3D7B8");
    for (let k = 0; k < 8; k++) ell(ctx, 72 + Math.cos(k * 0.785) * 26, 66 + Math.sin(k * 0.785) * 26, 2, 2, "#2D4C9A");
    rect(ctx, 120, 66, 72, 26, "#B8925F");
    for (let x = 122; x < 192; x += 6) rect(ctx, x, 66, 2, 26, "rgba(90,60,30,.35)");
    for (let y = 70; y < 92; y += 6) rect(ctx, 120, y, 72, 1.5, "rgba(90,60,30,.3)");
    line(ctx, [128, 68, 156, 46, 184, 68], "#8A6440", 3);
    poly(ctx, [222, 92, 258, 92, 254, 62, 260, 56, 226, 56, 226, 62], "#F4F1EA");
    rect(ctx, 224, 70, 32, 6, "#B4513A");
    ring(ctx, 220, 74, 7, "#F4F1EA", 3);
    // the base
    rect(ctx, 10, 432, 282, 14, "#9DB9B9");
    rect(ctx, 16, 446, 270, 286, "#88A6A8");
    for (let k = 0; k < 3; k++) {
      rect(ctx, 22 + k * 88, 452, 82, 52, "#7C9A9C");
      ell(ctx, 63 + k * 88, 478, 4, 4, "#C9A23F");
    }
    for (let k = 0; k < 2; k++) {
      rect(ctx, 22 + k * 132, 512, 126, 214, "#7C9A9C");
      rect(ctx, 34 + k * 132, 524, 102, 190, "#88A6A8");
      ell(ctx, k ? 164 : 140, 618, 4, 4, "#C9A23F");
    }
    rect(ctx, 16, 726, 270, 18, "#5E7A7C");
    // things on the dresser
    poly(ctx, [48, 432, 84, 432, 80, 406, 86, 398, 50, 398, 54, 406], "#E3B556");
    for (let k = 0; k < 9; k++) ell(ctx, 52 + rand() * 30, 378 + rand() * 18, 6, 6, ["#C0533F", "#FFFEFA", "#D98CB0", "#8E6BB0"][k % 4]);
    for (let k = 0; k < 6; k++) ell(ctx, 50 + rand() * 34, 392 + rand() * 6, 6, 2.5, "#4F7A5A", rand() * 3);
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(138, 430 - k * 6);
      ctx.rotate((k % 2 ? 1 : -1) * 0.05);
      rect(ctx, -28, -6, 56, 6, ["#FFFEFA", "#E8D8B0", "#C9D7E0", "#FFFEFA"][k]);
      ctx.restore();
    }
    rect(ctx, 120, 405, 10, 6, "#B4513A");
    ell(ctx, 204, 432, 26, 6, "#2F5D4A");
    rect(ctx, 178, 410, 52, 22, "#2F5D4A");
    ell(ctx, 204, 410, 26, 6, "#3E7560");
    text(ctx, "SHORTBREAD", 204, 422, 6.5, "#E3B556", "Work Sans", 700);
    rect(ctx, 242, 388, 36, 44, "#C9A23F");
    rect(ctx, 246, 392, 28, 36, "#C9D7E0");
    ell(ctx, 254, 410, 5, 6, SKIN[1]);
    ell(ctx, 266, 408, 5, 6, SKIN[0]);
    rect(ctx, 248, 416, 24, 12, "#4F7A5A");
  }

  // calendar and key rack
  {
    line(ctx, [330, 86, 330, 94], "#3A3631", 1.4);
    rect(ctx, 296, 92, 66, 170, "#FFFEFA");
    rect(ctx, 300, 96, 58, 52, "#8FA58A");
    poly(ctx, [300, 148, 318, 112, 334, 136, 344, 120, 358, 148], "#5E6E7A");
    poly(ctx, [313, 122, 318, 112, 323, 122], "#FFFEFA");
    text(ctx, "OCTOBER", 329, 158, 9, "#B4513A", "Libre Caslon Text", 700);
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 7; c++) {
        const x = 300 + c * 8.3;
        const y = 168 + r * 17;
        rect(ctx, x, y, 7.5, 16, "#F2EEE2");
        const n = r * 7 + c;
        if (n % 5 === 2) line(ctx, [x + 1, y + 3, x + 6, y + 13], "#2D4C9A", 1);
        if (n === 9 || n === 23) ring(ctx, x + 3.7, y + 8, 4, "#B4513A", 1.2);
        if (n === 16) rect(ctx, x, y, 7.5, 16, "#F2DC7A");
      }
    text(ctx, "bins!", 340, 254, 8, "#2D4C9A", "Courier Prime", 700);
    rect(ctx, 300, 278, 60, 40, "#9C7450");
    text(ctx, "KEYS", 330, 286, 7.5, "#F4F1EA", "Work Sans", 700);
    const keyCols = ["#E3B556", "#C9CCCB", "#C98F5E", "#C9CCCB"];
    for (let k = 0; k < 4; k++) {
      const kx = 308 + k * 14;
      line(ctx, [kx, 296, kx, 300], "#3A3631", 1.4);
      ring(ctx, kx, 304, 3.4, keyCols[k], 1.6);
      rect(ctx, kx - 1, 306, 2, 12 + (k % 2) * 6, keyCols[k]);
      if (k === 2) rect(ctx, kx - 5, 312, 10, 8, "#C0533F");
    }
  }

  // the window
  {
    rect(ctx, WIN.x, WIN.y, WIN.w, WIN.h, "#EFEBE1");
    garden(ctx, rand);
    rect(ctx, WIN.x + WIN.w / 2 - 4, WIN.y + 12, 8, WIN.h - 24, "#EFEBE1");
    rect(ctx, WIN.x + 12, 222, WIN.w - 24, 8, "#EFEBE1");
    rect(ctx, WIN.x + 12, WIN.y + 12, WIN.w - 24, 3, "rgba(0,0,0,.1)");
    poly(ctx, [420, 360, 470, 90, 486, 90, 436, 360], "rgba(255,255,255,.1)");
    rect(ctx, WIN.x - 8, SILL, WIN.w + 16, 14, "#F4F1EA");
    rect(ctx, WIN.x - 8, SILL + 14, WIN.w + 16, 3, "rgba(0,0,0,.15)");
    // curtains
    line(ctx, [358, 60, 704, 60], "#8A6440", 4);
    for (const [cx, dir] of [[366, 1], [698, -1]] as const) {
      const x0 = cx;
      ctx.fillStyle = "#C9A23F";
      ctx.beginPath();
      ctx.moveTo(x0, 58);
      ctx.lineTo(x0 + dir * 40, 58);
      ctx.quadraticCurveTo(x0 + dir * 18, 200, x0 + dir * 30, 312);
      ctx.lineTo(x0, 312);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (let y = 66; y < 312; y += 14) for (let k = 0; k < 4; k++) ell(ctx, x0 + dir * (6 + k * 10 + ((y / 14) % 2) * 5), y, 2.2, 2.2, "rgba(255,254,250,.55)");
      for (let k = 6; k < 40; k += 9) rect(ctx, x0 + dir * k, 58, 1.2, 260, "rgba(28,28,26,.15)");
      ctx.restore();
      rect(ctx, x0 + (dir > 0 ? 0 : -24), 210, 24, 6, "#B4513A");
    }
    // pendant lamp
    line(ctx, [532, 0, 532, 40], "#3A3631", 1.4);
    poly(ctx, [508, 66, 556, 66, 544, 40, 520, 40], "#2F5D4A");
    ell(ctx, 532, 66, 24, 4, "#F4E1A6");
    // sill things
    rect(ctx, 398, 362, 26, 20, "#B4513A");
    for (let k = 0; k < 9; k++) ell(ctx, 411 + Math.cos(-1.57 + (k - 4) * 0.35) * 14, 360 + Math.sin(-1.57 + (k - 4) * 0.35) * 16, 7, 3.5, k % 2 ? "#4F7A5A" : "#6E9A63", -1.57 + (k - 4) * 0.35);
    ell(ctx, 474, 374, 11, 7, "#E3C24A");
    ell(ctx, 482, 364, 6, 6, "#E3C24A");
    poly(ctx, [487, 364, 494, 366, 487, 368], "#C9703E");
    ell(ctx, 483, 362, 1.2, 1.2, "#1C1C1A");
    rect(ctx, 512, 368, 22, 14, "#2D4C9A");
    for (let k = 0; k < 3; k++) rect(ctx, 516 + k * 6, 346 + k * 3, 3, 22 - k * 3, "#6E9A63");
    rect(ctx, 600, 364, 20, 18, "#E3D7B8");
    rr(ctx, 604, 336, 12, 30, 6, "#6E9A63");
    rr(ctx, 596, 346, 8, 14, 4, "#6E9A63");
    rr(ctx, 616, 342, 8, 14, 4, "#6E9A63");
    ell(ctx, 610, 336, 3, 3, "#D98CB0");
    rect(ctx, 640, 370, 30, 12, "#8FA58A");
    for (let k = 0; k < 5; k++) ell(ctx, 645 + k * 5, 364 - (k % 2) * 4, 4, 4, "#C0533F");
  }

  // the shelves of jars
  {
    for (const s of SHELVES) {
      rect(ctx, SHELF_X - 8, s, 360, 9, "#A27B52");
      rect(ctx, SHELF_X - 8, s + 9, 360, 3, "rgba(0,0,0,.15)");
      for (const bx of [SHELF_X + 10, SHELF_X + 320]) poly(ctx, [bx, s + 9, bx + 12, s + 9, bx, s + 26], "#3A3631");
    }
    SHELF_ITEMS.forEach((row, r) => row.forEach((it, k) => shelfItem(ctx, it, SHELF_X_AT[r][k], SHELVES[r], rand)));
    // a trailing plant at the end of the top shelf
    rect(ctx, 1036, 104, 22, 24, "#E3D7B8");
    for (let k = 0; k < 12; k++) ell(ctx, 1046 + Math.sin(k) * 8, 104 + k * 9, 6, 3.5, k % 2 ? "#4F7A5A" : "#6E9A63", k);
  }

  // the rail of pans and utensils
  {
    line(ctx, [706, RAIL, 1056, RAIL], "#3A3631", 4);
    ell(ctx, 706, RAIL, 4, 4, "#3A3631");
    ell(ctx, 1056, RAIL, 4, 4, "#3A3631");
    const hook = (x: number) => line(ctx, [x, RAIL, x, RAIL + 6], "#3A3631", 1.6);
    hook(730);
    rect(ctx, 727, RAIL + 4, 6, 36, "#2A2927");
    ell(ctx, 730, RAIL + 66, 28, 28, "#2E2E2C");
    ell(ctx, 730, RAIL + 66, 22, 22, "#3E3E3B");
    ell(ctx, 722, RAIL + 58, 8, 5, "rgba(255,255,255,.08)", -0.6);
    hook(790);
    rect(ctx, 787, RAIL + 4, 6, 30, "#8A5A3C");
    ell(ctx, 790, RAIL + 56, 24, 24, "#B9744A");
    ell(ctx, 790, RAIL + 56, 18, 18, "#A3633C");
    ell(ctx, 783, RAIL + 50, 6, 3, "rgba(255,230,200,.35)", -0.6);
    hook(845);
    rect(ctx, 842, RAIL + 4, 6, 26, "#2A2927");
    ell(ctx, 845, RAIL + 48, 21, 21, "#F4F1EA");
    ell(ctx, 845, RAIL + 48, 18, 18, "#4C6E9A");
    hook(892);
    line(ctx, [892, RAIL + 6, 892, RAIL + 66], "#9EA3A3", 3);
    ell(ctx, 892, RAIL + 74, 12, 9, "#9EA3A3");
    hook(918);
    line(ctx, [918, RAIL + 6, 918, RAIL + 40], "#B4513A", 4);
    for (let k = -2; k <= 2; k++) {
      ctx.strokeStyle = "#B9BDBF";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(918, RAIL + 60, 4 + Math.abs(k) * 2.5, 22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    hook(954);
    line(ctx, [954, RAIL + 6, 954, RAIL + 26], "#3A3631", 3);
    ell(ctx, 954, RAIL + 44, 18, 18, "#B9BDBF");
    for (let k = -14; k <= 14; k += 4) line(ctx, [954 + k, RAIL + 30 + Math.abs(k) * 0.3, 954 + k, RAIL + 58 - Math.abs(k) * 0.3], "rgba(60,60,60,.4)", 0.8);
    for (let k = -14; k <= 14; k += 4) line(ctx, [940 + Math.abs(k) * 0.3, RAIL + 44 + k, 968 - Math.abs(k) * 0.3, RAIL + 44 + k], "rgba(60,60,60,.4)", 0.8);
    hook(988);
    line(ctx, [988, RAIL + 6, 988, RAIL + 52], "#C9A57A", 4);
    rect(ctx, 980, RAIL + 52, 16, 26, "#2A2927");
    for (let k = 0; k < 3; k++) rect(ctx, 983 + k * 4, RAIL + 56, 2, 18, "#E9DFC6");
    for (const [x, len] of [[1012, 76], [1030, 62]] as const) {
      hook(x);
      line(ctx, [x, RAIL + 6, x, RAIL + len], "#C99A5A", 4);
      ell(ctx, x, RAIL + len + 6, 6, 9, "#C99A5A");
    }
    hook(1048);
    rect(ctx, 1040, RAIL + 8, 16, 40, "#B4513A");
    ell(ctx, 1048, RAIL + 50, 9, 8, "#B4513A");
    for (let k = 0; k < 4; k++) rect(ctx, 1040, RAIL + 14 + k * 9, 16, 3, "#F4F1EA");
  }

  // the cupboards under the worktop
  {
    rect(ctx, RUN_L, CAB, RUN_R - RUN_L, KICK - CAB, "#8FA38C");
    const doors = [[294, 66], [364, 66], [434, 92], [530, 86], [984, 82]];
    for (const [x, w] of doors) {
      rect(ctx, x, CAB + 6, w, KICK - CAB - 12, "#9DB09A");
      rect(ctx, x + 8, CAB + 14, w - 16, KICK - CAB - 28, "#8FA38C");
      ell(ctx, x + (x % 2 ? w - 10 : 10), CAB + 30, 3.5, 3.5, "#C9A23F");
    }
    rect(ctx, RUN_L, KICK, RUN_R - RUN_L, FLOOR - KICK, "#5E6E5C");
    // the washing machine
    rect(ctx, 620, CAB, 180, KICK - CAB, "#EEEBE3");
    rect(ctx, 620, CAB, 180, 26, "#E2DED3");
    rect(ctx, 628, CAB + 8, 50, 10, "#C9C5BA");
    ell(ctx, 770, CAB + 13, 8, 8, "#B9BDBF");
    ell(ctx, 750, CAB + 13, 3, 3, "#C0533F");
    ell(ctx, 710, 630, 52, 52, "#C9C5BA");
    ell(ctx, 710, 630, 42, 42, "#5F6E78");
    ctx.save();
    ctx.beginPath();
    ctx.arc(710, 630, 40, 0, Math.PI * 2);
    ctx.clip();
    for (let k = 0; k < 9; k++) ell(ctx, 690 + rand() * 40, 630 + rand() * 40, 14, 8, ["#B4513A", "#F4F1EA", "#2D4C9A", "#E3B556", "#D98CB0"][k % 5], rand() * 3);
    poly(ctx, [680, 620, 720, 590, 730, 600, 690, 630], "rgba(255,255,255,.2)");
    ctx.restore();
  }

  // the worktop
  rect(ctx, RUN_L - 4, WORK, RUN_R - RUN_L + 8, CAB - WORK, "#B98A5A");
  rect(ctx, RUN_L - 4, WORK, RUN_R - RUN_L + 8, 3, "#CFA371");
  for (let x = RUN_L; x < RUN_R; x += 37) rect(ctx, x, WORK + 3, 1.2, CAB - WORK - 3, "rgba(80,50,20,.2)");

  // the cooker
  {
    rect(ctx, 800, 512, 180, FLOOR - 512, "#E9E2CF");
    rect(ctx, 796, 506, 188, 8, "#2A2927");
    rect(ctx, 806, 526, 168, 26, "#D8D0BA");
    for (let k = 0; k < 5; k++) {
      ell(ctx, 826 + k * 32, 539, 8, 8, "#2A2927");
      rect(ctx, 825 + k * 32, 532, 2, 6, "#E9E2CF");
    }
    rect(ctx, 812, 562, 156, 3, "#B9BDBF");
    rect(ctx, 816, 572, 148, 148, "#D8D0BA");
    rect(ctx, 832, 590, 116, 74, "#3A3631");
    const glow = ctx.createLinearGradient(0, 590, 0, 664);
    glow.addColorStop(0, "#6A4A30");
    glow.addColorStop(1, "#D98C4A");
    ctx.fillStyle = glow;
    ctx.fillRect(836, 594, 108, 66);
    rect(ctx, 852, 646, 76, 6, "#2A2927");
    ell(ctx, 890, 638, 26, 10, "#B5733A");
    ell(ctx, 890, 634, 18, 6, "#D9A55E");
    rect(ctx, 806, 730, 168, 14, "#2A2927");
    // tea towel on the rail
    rect(ctx, 822, 560, 40, 70, "#F4F1EA");
    for (let k = 0; k < 4; k++) rect(ctx, 822, 572 + k * 14, 40, 5, "#B4513A");
    rect(ctx, 834, 560, 3, 70, "rgba(45,76,154,.5)");
  }

  // things on the worktop
  {
    // toaster
    rr(ctx, 300, 460, 76, 60, 12, "#B9BDBF");
    rect(ctx, 316, 450, 18, 14, "#D9A55E");
    rect(ctx, 342, 454, 18, 10, "#C08A4A");
    rect(ctx, 312, 460, 26, 4, "#3A3631");
    rect(ctx, 340, 460, 26, 4, "#3A3631");
    rect(ctx, 306, 470, 6, 34, "rgba(255,255,255,.4)");
    rect(ctx, 376, 486, 6, 8, "#2A2927");
    ell(ctx, 338, 500, 7, 3, "rgba(0,0,0,.1)");
    // sink
    rect(ctx, 446, 492, 168, 22, "#3E4B55");
    ell(ctx, 480, 494, 16, 5, "#F4F1EA");
    ell(ctx, 498, 488, 12, 12, "#E3B556");
    ell(ctx, 498, 488, 8, 8, "#F4F1EA");
    rect(ctx, 562, 476, 8, 30, "#2D4C9A");
    for (let k = 0; k < 14; k++) ell(ctx, 470 + rand() * 120, 494 + rand() * 10, 4 + rand() * 4, 4 + rand() * 3, "rgba(255,255,255,.85)");
    rect(ctx, 440, 512, 180, 10, "#C9CCCB");
    rect(ctx, 440, 512, 180, 2, "#E8EAEA");
    rect(ctx, 526, 470, 8, 26, "#C9CCCB");
    line(ctx, [530, 472, 530, 460, 552, 460, 552, 470], "#C9CCCB", 5);
    ell(ctx, 516, 482, 6, 4, "#C9CCCB");
    ell(ctx, 544, 482, 6, 4, "#C9CCCB");
    rr(ctx, 450, 470, 16, 44, 4, "#6E9A63");
    rect(ctx, 454, 462, 8, 10, "#F4F1EA");
    tag(ctx, "LEMON", 458, 492, 14, 4.5);
    rr(ctx, 594, 504, 20, 10, 2, "#E3C24A");
    rect(ctx, 594, 504, 20, 3, "#4F7A5A");
    // dish rack
    rect(ctx, 626, 506, 76, 14, "#9EA3A3");
    for (let k = 0; k < 4; k++) ell(ctx, 640 + k * 9, 492, 5, 18, ["#F4F1EA", "#E3B556", "#F4F1EA", "#8FA58A"][k]);
    poly(ctx, [676, 486, 696, 486, 694, 506, 678, 506], "#B4513A");
    for (let x = 628; x < 702; x += 6) rect(ctx, x, 500, 1.4, 20, "#7E8484");
    // radio
    rr(ctx, 708, 458, 86, 62, 8, "#B4513A");
    rect(ctx, 714, 466, 40, 48, "#E3D7B8");
    for (let y = 470; y < 512; y += 5) rect(ctx, 716, y, 36, 2, "rgba(90,60,40,.4)");
    rect(ctx, 760, 466, 28, 18, "#F4EEDC");
    for (let k = 0; k < 6; k++) rect(ctx, 763 + k * 4, 470, 1, 6, "#1C1C1A");
    rect(ctx, 772, 468, 1.6, 14, "#B4513A");
    ell(ctx, 766, 500, 6, 6, "#3A3631");
    ell(ctx, 782, 500, 6, 6, "#3A3631");
    line(ctx, [786, 458, 812, 404], "#B9BDBF", 2);
    ell(ctx, 812, 404, 2.4, 2.4, "#B9BDBF");
    rect(ctx, 730, 452, 34, 6, "#3A3631");
    // kettle on the hob
    ell(ctx, 850, 482, 32, 28, "#B9BDBF");
    rect(ctx, 818, 482, 64, 24, "#B9BDBF");
    ell(ctx, 850, 506, 32, 6, "#9EA3A3");
    line(ctx, [828, 460, 850, 450, 872, 460], "#2A2927", 5);
    poly(ctx, [818, 480, 806, 462, 812, 460, 824, 476], "#9EA3A3");
    ell(ctx, 840, 476, 6, 12, "rgba(255,255,255,.45)");
    ell(ctx, 850, 456, 5, 3, "#2A2927");
    // saucepan with steam
    rect(ctx, 900, 482, 66, 26, "#B4513A");
    rect(ctx, 900, 478, 66, 5, "#C9CCCB");
    rect(ctx, 966, 486, 14, 4, "#2A2927");
    ell(ctx, 933, 476, 6, 3, "#2A2927");
    for (const sx of [920, 940]) line(ctx, [sx, 470, sx - 5, 460, sx + 3, 450, sx - 2, 440], "rgba(255,255,255,.7)", 2);
    // bread bin
    rr(ctx, 988, 464, 78, 56, 14, "#E9E2CF");
    rect(ctx, 988, 500, 78, 20, "#E9E2CF");
    rect(ctx, 994, 476, 66, 2, "rgba(0,0,0,.1)");
    text(ctx, "BREAD", 1027, 492, 12, "#2F5D4A", "Libre Caslon Text", 700);
    rect(ctx, 1017, 506, 20, 4, "#B9BDBF");
  }

  // the clock, the stuff on the fridge, the fridge
  {
    ell(ctx, 1205, 72, 33, 33, "#2F5D4A");
    ell(ctx, 1205, 72, 27, 27, "#FFFEFA");
    for (let k = 0; k < 12; k++) rect(ctx, 1205 + Math.cos(k * 0.5236) * 22 - 1.2, 72 + Math.sin(k * 0.5236) * 22 - 1.2, 2.4, 2.4, "#1C1C1A");
    line(ctx, [1205, 72, 1205, 54], "#1C1C1A", 2.2);
    line(ctx, [1205, 72, 1219, 80], "#1C1C1A", 2.6);
    line(ctx, [1205, 72, 1190, 62], "#B4513A", 1);
    fridge(ctx);
    rr(ctx, 1096, 100, 54, 40, 6, "#D98C5F");
    ell(ctx, 1123, 98, 22, 5, "#B4513A");
    ell(ctx, 1123, 92, 6, 4, "#B4513A");
    text(ctx, "BISCUITS", 1123, 120, 7, "#FFFEFA", "Work Sans", 700);
    rect(ctx, 1248, 112, 54, 28, "#B8925F");
    for (let x = 1250; x < 1302; x += 6) rect(ctx, x, 112, 2, 28, "rgba(90,60,30,.35)");
    ell(ctx, 1262, 108, 8, 8, "#E3C24A");
    ell(ctx, 1280, 106, 8, 8, "#C0533F");
    ell(ctx, 1292, 110, 7, 7, "#7DA05A");
  }

  // apron on a hook, mop and bucket
  {
    line(ctx, [1324, 172, 1324, 184], "#3A3631", 2);
    line(ctx, [1314, 186, 1324, 182, 1334, 186], "#E3D7B8", 2);
    poly(ctx, [1310, 188, 1338, 188, 1342, 230, 1350, 236, 1350, 366, 1304, 366, 1304, 236, 1312, 230], "#2D4C9A");
    for (let x = 1306; x < 1350; x += 8) rect(ctx, x, 236, 3, 130, "rgba(255,254,250,.3)");
    rect(ctx, 1312, 280, 28, 24, "#24407F");
    line(ctx, [1336, 410, 1314, 820], "#C99A5A", 5);
    for (let k = -4; k <= 4; k++) line(ctx, [1314, 820, 1312 + k * 4, 852], "#E8E2D2", 3);
    poly(ctx, [1288, 800, 1344, 800, 1338, 858, 1294, 858], "#C0533F");
    rect(ctx, 1288, 798, 56, 6, "#A84436");
  }

  // the table and breakfast
  {
    const { x, w, top } = TABLE;
    ell(ctx, x + w / 2, BH - 6, w / 2, 8, "rgba(0,0,0,.14)");
    rect(ctx, x + 16, top + 50, 14, BH - top - 50, "#8A6440");
    rect(ctx, x + w - 30, top + 50, 14, BH - top - 50, "#8A6440");
    rect(ctx, x + 16, top + 50, 14, 6, "rgba(0,0,0,.25)");
    rect(ctx, x + w - 30, top + 50, 14, 6, "rgba(0,0,0,.25)");
    rect(ctx, x - 6, top - 6, w + 12, 8, "#F4EEE0");
    rect(ctx, x - 6, top + 2, w + 12, 54, "#F4F1EA");
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 6, top + 2, w + 12, 54);
    ctx.clip();
    for (let gx = x - 6; gx < x + w + 6; gx += 14) rect(ctx, gx, top + 2, 7, 54, "rgba(180,81,58,.35)");
    for (let gy = top + 2; gy < top + 56; gy += 14) rect(ctx, x - 6, gy, w + 12, 7, "rgba(180,81,58,.35)");
    ctx.restore();
    for (let gx = x - 6; gx < x + w + 6; gx += 14) ell(ctx, gx + 7, top + 56, 7, 3, "#F4F1EA");
    // newspaper
    ctx.save();
    ctx.translate(472, 670);
    ctx.rotate(-0.12);
    rect(ctx, -28, -28, 56, 56, "#ECE8DD");
    text(ctx, "THE DAILY", 0, -20, 7, "#1C1C1A", "Libre Caslon Text", 700);
    rect(ctx, -24, -12, 48, 2.5, "#1C1C1A");
    for (let k = 0; k < 6; k++) {
      rect(ctx, -24, -4 + k * 5, 22, 1.4, "rgba(28,28,26,.45)");
      rect(ctx, 2, -4 + k * 5, 22, 1.4, "rgba(28,28,26,.45)");
    }
    ctx.restore();
    // oats
    rect(ctx, 506, 614, 46, 84, "#D8AA52");
    rect(ctx, 546, 614, 6, 84, "rgba(0,0,0,.12)");
    text(ctx, "OATS", 528, 630, 12, "#2F5D4A", "Libre Caslon Text", 700);
    ell(ctx, 528, 664, 14, 8, "#FFFEFA");
    for (let k = 0; k < 6; k++) ell(ctx, 520 + k * 3, 661, 2, 1.5, "#C9A57A");
    ell(ctx, 528, 646, 6, 6, "#B4513A");
    // milk
    rr(ctx, 556, 640, 24, 58, 8, "#F7F6F1");
    rect(ctx, 560, 634, 16, 10, "#F7F6F1");
    ell(ctx, 568, 634, 8, 2.5, "#C9CCCB");
    rect(ctx, 560, 670, 16, 2, "rgba(0,0,0,.08)");
    // bowl of cereal
    poly(ctx, [586, 678, 636, 678, 628, 698, 594, 698], "#2D4C9A");
    for (let k = 0; k < 7; k++) ell(ctx, 592 + k * 6, 676 - (k % 2) * 2, 3.5, 2.5, "#D9A55E");
    line(ctx, [628, 672, 644, 650], "#B9BDBF", 2.5);
    rect(ctx, 588, 684, 46, 3, "rgba(255,255,255,.3)");
    // teapot in a cosy
    ctx.fillStyle = "#4F7A5A";
    ctx.beginPath();
    ctx.ellipse(680, 698, 36, 60, 0, Math.PI, 0);
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let y = 640; y < 700; y += 10) rect(ctx, 640, y, 80, 4, y % 20 ? "#E3B556" : "#F4F1EA");
    ctx.restore();
    ell(ctx, 680, 638, 8, 8, "#B4513A");
    poly(ctx, [644, 680, 630, 660, 636, 658, 648, 672], "#E9E2CF");
    ring(ctx, 718, 676, 9, "#E9E2CF", 4);
    // mug
    rect(ctx, 722, 664, 26, 34, "#E3D7B8");
    rect(ctx, 722, 676, 26, 8, "#2D4C9A");
    ring(ctx, 750, 680, 7, "#E3D7B8", 4);
    ell(ctx, 735, 664, 13, 3, "#7A4E3A");
    // boiled egg
    poly(ctx, [754, 698, 772, 698, 768, 684, 758, 684], "#B4513A");
    ell(ctx, 763, 672, 9, 13, "#E8D2B0");
    rect(ctx, 754, 660, 18, 6, "#E8D2B0");
    ell(ctx, 763, 664, 7, 2.5, "#F2C94A");
    // jam
    rect(ctx, 776, 668, 22, 30, "#9A2E2E");
    rect(ctx, 774, 662, 26, 8, "#F4F1EA");
    for (let k = 0; k < 4; k++) rect(ctx, 774 + k * 7, 662, 3.5, 8, "#B4513A");
    tag(ctx, "JAM", 787, 684, 18, 6);
    // fruit bowl
    for (const [fx, fy, r, c] of [[814, 656, 10, "#C0533F"], [832, 650, 11, "#E08A3E"], [850, 656, 10, "#7DA05A"], [824, 640, 9, "#C0533F"], [842, 636, 9, "#E08A3E"]] as const) {
      ell(ctx, fx, fy, r, r, c);
      ell(ctx, fx - 3, fy - 3, 2.5, 2.5, "rgba(255,255,255,.35)");
    }
    ctx.strokeStyle = "#E3C24A";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(834, 620, 26, 0.6, 2.2);
    ctx.stroke();
    poly(ctx, [800, 664, 870, 664, 858, 690, 812, 690], "#F4F1EA");
    for (let k = 0; k < 6; k++) rect(ctx, 808 + k * 10, 668, 5, 16, "#2D4C9A");
    rect(ctx, 822, 690, 26, 8, "#F4F1EA");
  }

  // the chairs
  {
    const chair = (x0: number, back: 1 | -1) => {
      const seat = 752;
      const bx = back > 0 ? x0 + 84 : x0;
      rect(ctx, x0 + 4, seat + 10, 8, BH - seat, "#7A5236");
      rect(ctx, x0 + 76, seat + 10, 8, BH - seat, "#7A5236");
      rect(ctx, bx - 2, 630, 12, BH - 630, "#8A6440");
      rect(ctx, x0, seat, 92, 12, "#9C7450");
      rect(ctx, x0 + 4, 820, 80, 5, "#7A5236");
      ell(ctx, bx + 4, 628, 8, 6, "#8A6440");
    };
    chair(346, -1);
    chair(878, 1);
    // the cat on the seat, curled up
    ell(ctx, 924, 734, 40, 20, "#C9783E");
    for (let k = 0; k < 5; k++) ell(ctx, 902 + k * 12, 728, 2.5, 14, "rgba(120,60,30,.35)", 0.3);
    ell(ctx, 896, 738, 16, 13, "#C9783E");
    poly(ctx, [884, 730, 884, 716, 894, 726], "#C9783E");
    poly(ctx, [898, 726, 906, 714, 908, 728], "#C9783E");
    line(ctx, [890, 740, 896, 742, 902, 740], "#5A3A22", 1.4);
    ell(ctx, 897, 746, 2, 1.4, "#D98C9C");
    ctx.strokeStyle = "#C9783E";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(924, 742, 36, 0.3, 2.4);
    ctx.stroke();
    ell(ctx, 958, 752, 6, 4, "#F4F1EA");
  }

  // things standing in front of the cupboards
  {
    poly(ctx, [36, 676, 144, 676, 136, 744, 44, 744], "#B8925F");
    for (let y = 682; y < 744; y += 7) rect(ctx, 40, y, 100, 2, "rgba(90,60,30,.3)");
    line(ctx, [48, 676, 90, 646, 132, 676], "#8A6440", 4);
    for (let k = 0; k < 9; k++) ell(ctx, 50 + k * 10, 674 - (k % 3) * 3, 8, 6, k % 3 === 1 ? "#C9A04A" : "#A97C52");
    ell(ctx, 120, 664, 8, 9, "#C9A04A");
    line(ctx, [120, 655, 122, 646], "#7DA05A", 2);
    for (let k = 0; k < 9; k++) {
      ctx.save();
      ctx.translate(218, 740 - k * 7);
      ctx.rotate(((k * 37) % 7 - 3) * 0.015);
      rect(ctx, -44, -6, 88, 7, k % 3 ? "#E8E4DA" : "#D8D2C2");
      rect(ctx, -40, -4, 30, 1.5, "rgba(28,28,26,.35)");
      ctx.restore();
    }
    line(ctx, [176, 700, 260, 700], "#C9A57A", 1.6);
    rect(ctx, 294, 692, 108, 52, "#2D4C9A");
    rect(ctx, 294, 692, 108, 6, "#24407F");
    for (const [bx, h, c] of [[306, 52, "rgba(79,122,90,.85)"], [322, 44, "rgba(140,90,60,.8)"], [340, 58, "rgba(201,220,220,.85)"], [362, 40, "rgba(79,122,90,.85)"], [384, 48, "rgba(201,220,220,.85)"]] as const) {
      rect(ctx, bx - 6, 692 - h * 0.5, 12, h * 0.5, c);
      rect(ctx, bx - 2.5, 692 - h * 0.5 - 12, 5, 12, c);
    }
    text(ctx, "RECYCLING", 348, 718, 9, "#FFFEFA", "Work Sans", 700);
    // oven glove on a cupboard knob
    rr(ctx, 370, 562, 26, 50, 10, "#E3B556");
    rr(ctx, 388, 578, 12, 22, 6, "#E3B556");
    for (let y = 568; y < 610; y += 8) rect(ctx, 372, y, 22, 2, "#B4513A");
    // pedal bin
    rr(ctx, 994, 652, 66, 92, 8, "#C9CCCB");
    rect(ctx, 990, 648, 74, 10, "#9EA3A3");
    rect(ctx, 1000, 664, 6, 70, "rgba(255,255,255,.4)");
    rect(ctx, 1014, 738, 26, 6, "#3A3631");
    line(ctx, [1010, 650, 1006, 636, 1016, 630], "#F4F1EA", 3);
  }

  // things on the floor
  {
    for (const [sx, c] of [[190, "#6B4E7A"], [228, "#6B4E7A"]] as const) {
      ell(ctx, sx, 832, 18, 9, c, sx > 200 ? 0.2 : -0.1);
      ell(ctx, sx + 6, 828, 9, 5, "#E8DCC0", sx > 200 ? 0.2 : -0.1);
    }
    ell(ctx, 314, 836, 14, 13, "#2D4C9A");
    for (let k = -2; k <= 2; k++) line(ctx, [304, 830 + k * 4, 324, 834 + k * 4], "rgba(255,255,255,.3)", 1);
    line(ctx, [326, 840, 346, 846, 380, 844], "#2D4C9A", 1.4);
    rect(ctx, 630, 828, 40, 12, "#C08A4A");
    rect(ctx, 630, 836, 40, 4, "#E8C66A");
    poly(ctx, [1010, 842, 1074, 842, 1066, 820, 1018, 820], "#D98C9C");
    ell(ctx, 1042, 820, 24, 4, "#B07080");
    text(ctx, "CAT", 1042, 832, 9, "#FFFEFA", "Work Sans", 700);
    // laundry basket
    for (const [lx, ly, c] of [[1120, 762, "#2D4C9A"], [1150, 756, "#F4F1EA"], [1184, 760, "#E3B556"], [1214, 766, "#B4513A"], [1166, 770, "#8FA58A"]] as const) ell(ctx, lx, ly, 22, 12, c, 0.2);
    line(ctx, [1214, 766, 1236, 800, 1240, 830], "#B4513A", 5);
    poly(ctx, [1100, 770, 1236, 770, 1226, 852, 1110, 852], "#C9A57A");
    for (let y = 776; y < 852; y += 8) rect(ctx, 1104, y, 128, 2, "rgba(90,60,30,.3)");
    for (let x = 1112; x < 1230; x += 10) rect(ctx, x, 770, 2, 82, "rgba(90,60,30,.2)");
  }

  grain(ctx, rand);
  ctx.restore();
}

export const kitchen: Scene = { title: "The Kitchen", draw, labels: LABELS, landmarks: LANDMARKS };
