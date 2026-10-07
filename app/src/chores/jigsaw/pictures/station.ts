// The Station: a big old railway station under an iron-and-glass roof, two trains in and nobody leaving.
// Busy on purpose, so most pieces have something on them you can place.
import { BW, BH, rng, rect, ell, poly, line, text, person as stockPerson, grain, SKIN, type Box, type Ctx, type PersonOpts, type Scene } from "./common";

const LABELS: Box[] = [];
const lab = (name: string, x: number, y: number, w: number, h: number) => LABELS.push({ x, y, w, h, name });

const ARCH = { x: 672, y: 300, rx: 720, ry: 300 };
const WALL = 160;
const TB = 300; // the far train's roof
const ISLAND = 416;
const TA = 500; // the near train's roof
const EDGE = 676;
const FEET = 842;

type Seat = "face" | "two" | "dog" | "empty" | "kid" | "sleep" | "paper" | "cup";
const A_WIN: Seat[] = ["face", "empty", "kid", "two", "paper", "empty", "dog", "face", "sleep", "cup", "two", "empty", "face", "kid", "two", "paper"];
const B_WIN: Seat[] = ["face", "empty", "two", "face", "empty", "paper", "face", "dog", "empty", "two", "face", "empty", "kid", "face", "empty", "two", "face", "sleep", "empty", "face", "two", "empty", "face", "cup", "empty", "face", "two", "empty", "face", "kid", "face", "empty"];
const A_X = (k: number) => 360 + k * 62 + Math.floor(k / 4) * 30;
const B_X = (k: number) => 10 + k * 36 + Math.floor(k / 8) * 28;
const SEAT_NAMES: Partial<Record<Seat, string>> = {
  dog: "the dog on the train",
  kid: "the child at the train window",
  sleep: "the man asleep on the train",
  paper: "the man reading on the train",
  cup: "the woman with a cup of tea",
};

const ROWS: [string, string, string, string][] = [
  ["09:14", "BRIGHTON", "1", "ON TIME"],
  ["09:22", "SWINDON", "3", "ON TIME"],
  ["09:30", "READING", "2", "BOARDING"],
  ["09:41", "CREWE", "4", "CANCELLED"],
  ["09:52", "YORK", "1", "ON TIME"],
  ["07:15", "MARGATE", "2", "DELAYED"],
];

lab("the station", 0, 0, BW, BH);
lab("the glass roof", 0, 0, BW, WALL);
lab("the brick wall at the end", 0, 0, 120, 200);
lab("the brick wall at the end", 1224, 0, 120, 200);
lab("the iron girder", 0, 136, BW, 28);
lab("the pigeons on the girder", 268, 112, 90, 30);
lab("the station clock", 616, 30, 112, 118);
lab("the back wall", 0, WALL, BW, TB - WALL);
lab("the poster for Hastings", 36, 172, 90, 120);
lab("the poster for tea", 222, 172, 84, 120);
lab("the lost property sign", 322, 176, 110, 54);
lab("the departures board", 466, 164, 412, 136);
lab("the timetable on the wall", 906, 172, 96, 120);
lab("the poster about the yellow line", 1104, 172, 90, 120);
lab("the green train", 0, TB - 8, BW, ISLAND - TB + 8);
lab("the engine of the green train", 1196, TB - 30, 148, 120);
lab("the island platform", 0, ISLAND, BW, TA - ISLAND);
B_WIN.forEach((w, k) => {
  const n = SEAT_NAMES[w];
  if (n && k % 2 === 0) lab(n, B_X(k) - 2, TB + 14, 28, 40);
});
lab("the platform 2 sign", 424, 360, 44, 36);
lab("the platform 3 sign", 872, 360, 44, 36);
lab("the family with the luggage", 170, 400, 110, 96);
lab("the man running for the train", 380, 404, 60, 94);
lab("the bench on the island", 640, 446, 120, 52);
lab("the woman knitting", 686, 404, 40, 92);
lab("the vending machine", 850, 412, 44, 86);
lab("the guard with the flag", 1076, 400, 60, 98);
lab("the red train", 230, TA - 6, BW - 230, EDGE - TA + 6);
lab("the front of the red train", 230, TA - 4, 110, 170);
A_WIN.forEach((w, k) => {
  const n = SEAT_NAMES[w];
  if (n) lab(n, A_X(k) - 4, 524, 52, 70);
});
lab("the platform", 0, EDGE, BW, BH - EDGE);
lab("the yellow line", 0, EDGE + 12, BW, 14);
lab("the platform 1 sign", 278, 434, 70, 54);
lab("the column", 304, WALL, 18, EDGE - WALL);
lab("the column", 1080, WALL, 18, EDGE - WALL);
lab("the tannoy", 312, 380, 46, 40);
lab("the newspaper kiosk", 0, 470, 230, 384);
lab("the headline board", 168, 740, 82, 108);
lab("the porter", 300, 714, 48, 130);
lab("the porter's trolley", 346, 690, 132, 158);
lab("the woman with the suitcase", 500, 706, 76, 140);
lab("the man with the map", 600, 706, 52, 140);
lab("the couple saying goodbye", 690, 706, 70, 140);
lab("the pigeon", 772, 812, 56, 36);
lab("the crumbs", 816, 828, 40, 18);
lab("the bench", 868, 756, 128, 90);
lab("the man with the coffee", 896, 726, 40, 110);
lab("the man with the briefcase", 1010, 712, 70, 134);
lab("the station cafe", 1104, 470, 240, 384);
lab("the cakes in the cafe window", 1130, 610, 130, 60);
lab("the cafe sign", 1118, 486, 214, 46);

const LANDMARKS = [
  { x: 672, y: 92 }, // the clock
  { x: 300, y: 230 }, // posters
  { x: 110, y: 600 }, // the kiosk
  { x: 1220, y: 520 }, // the cafe sign
  { x: 700, y: 560 }, // the red train
];

const person = (ctx: Ctx, x: number, o: PersonOpts) => stockPerson(ctx, x, { feet: FEET, h: 124, ...o });

function head(ctx: Ctx, x: number, y: number, r: number, skin: string, hair: string) {
  ell(ctx, x, y, r * 0.85, r, skin);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.25, r * 0.9, r * 0.75, 0, Math.PI, 0);
  ctx.fill();
}

function seat(ctx: Ctx, w: Seat, x: number, y: number, ww: number, wh: number, k: number) {
  const r = wh * 0.2;
  const cx = x + ww / 2;
  const by = y + wh;
  const coat = ["#C0533F", "#2D4C9A", "#E3B556", "#4F7A5A", "#6B4E7A", "#D9773A"][k % 6];
  const hair = ["#2A2927", "#6B4A2E", "#E3B556", "#9A9A9A", "#C9783E"][k % 5];
  const sk = SKIN[k % 5];
  const body = (bx: number, c: string) => ell(ctx, bx, by + r * 0.4, r * 1.3, r * 1.4, c);
  switch (w) {
    case "face":
      body(cx, coat);
      head(ctx, cx, by - r * 1.2, r, sk, hair);
      break;
    case "two":
      body(cx - r * 0.9, coat);
      body(cx + r * 0.9, "#4A5F78");
      head(ctx, cx - r * 0.9, by - r * 1.2, r * 0.85, sk, hair);
      head(ctx, cx + r * 0.9, by - r * 1.1, r * 0.8, SKIN[(k + 2) % 5], "#2A2927");
      break;
    case "kid":
      head(ctx, cx, by - r * 0.6, r * 0.9, sk, hair);
      ell(ctx, cx - r * 1.1, by - r * 1.0, r * 0.35, r * 0.45, sk);
      ell(ctx, cx + r * 1.1, by - r * 1.0, r * 0.35, r * 0.45, sk);
      break;
    case "dog":
      ell(ctx, cx, by - r * 0.7, r * 0.95, r * 0.85, "#C9A57A");
      ell(ctx, cx - r * 0.8, by - r * 0.9, r * 0.35, r * 0.7, "#8A6440", 0.3);
      ell(ctx, cx + r * 0.8, by - r * 0.9, r * 0.35, r * 0.7, "#8A6440", -0.3);
      ell(ctx, cx, by - r * 0.35, r * 0.25, r * 0.2, "#1C1C1A");
      ell(ctx, cx - r * 0.35, by - r * 0.95, 1, 1, "#1C1C1A");
      ell(ctx, cx + r * 0.35, by - r * 0.95, 1, 1, "#1C1C1A");
      ell(ctx, cx, by - r * 0.05, r * 0.2, r * 0.3, "#C0533F");
      break;
    case "sleep":
      body(cx, coat);
      ctx.save();
      ctx.translate(cx + r * 0.5, by - r);
      ctx.rotate(0.5);
      head(ctx, 0, 0, r, sk, hair);
      ctx.restore();
      break;
    case "paper":
      body(cx, coat);
      head(ctx, cx, by - r * 1.4, r * 0.9, sk, hair);
      rect(ctx, cx - r * 1.5, by - r * 1.2, r * 3, r * 1.6, "#ECE8DD");
      for (let j = 0; j < 3; j++) rect(ctx, cx - r * 1.3, by - r * 0.9 + j * r * 0.4, r * 2.6, 1.2, "rgba(28,28,26,.45)");
      break;
    case "cup":
      body(cx, coat);
      head(ctx, cx, by - r * 1.2, r, sk, hair);
      rect(ctx, cx + r * 0.6, by - r * 0.6, r * 0.6, r * 0.7, "#F4F1EA");
      line(ctx, [cx + r * 0.9, by - r * 0.8, cx + r * 1.0, by - r * 1.6], "rgba(255,255,255,.6)", 1);
      break;
    case "empty":
      rect(ctx, x + ww * 0.15, by - wh * 0.45, ww * 0.7, wh * 0.45, "rgba(120,80,60,.45)");
      break;
  }
}

function suitcase(ctx: Ctx, x: number, y: number, w: number, h: number, col: string) {
  rect(ctx, x, y, w, h, col);
  rect(ctx, x + w * 0.35, y - 4, w * 0.3, 4, "#3A3631");
  rect(ctx, x, y + h * 0.3, w, 2, "rgba(0,0,0,.2)");
  rect(ctx, x + 3, y + 3, 4, h - 6, "rgba(255,255,255,.15)");
}

function bench(ctx: Ctx, x: number, y: number, w: number) {
  rect(ctx, x, y - 34, w, 7, "#7E5C3E");
  rect(ctx, x, y - 24, w, 7, "#7E5C3E");
  rect(ctx, x - 4, y - 12, w + 8, 7, "#946C48");
  rect(ctx, x + 6, y - 36, 5, 36, "#2F3A36");
  rect(ctx, x + w - 11, y - 36, 5, 36, "#2F3A36");
}

function sitter(ctx: Ctx, x: number, seatY: number, coat: string, legs: string, skin: string, hair: string, s = 1) {
  rect(ctx, x - 9 * s, seatY + 2 * s, 7 * s, 22 * s, legs);
  rect(ctx, x + 2 * s, seatY + 2 * s, 7 * s, 22 * s, legs);
  rect(ctx, x - 11 * s, seatY - 6 * s, 22 * s, 10 * s, legs);
  ell(ctx, x, seatY - 18 * s, 12 * s, 18 * s, coat);
  head(ctx, x, seatY - 42 * s, 9 * s, skin, hair);
}

function pigeon(ctx: Ctx, x: number, y: number, s = 1, dir = 1) {
  ell(ctx, x, y - 6 * s, 11 * s, 7 * s, "#8E949A");
  poly(ctx, [x - dir * 9 * s, y - 8 * s, x - dir * 18 * s, y - 4 * s, x - dir * 9 * s, y - 2 * s], "#6E747A");
  ell(ctx, x + dir * 8 * s, y - 14 * s, 5 * s, 5 * s, "#6E747A");
  rect(ctx, x + dir * 5 * s - 2 * s, y - 11 * s, 4 * s, 3 * s, "#6E9A8A");
  poly(ctx, [x + dir * 12 * s, y - 15 * s, x + dir * 17 * s, y - 13 * s, x + dir * 12 * s, y - 12 * s], "#C98F5E");
  ell(ctx, x + dir * 9 * s, y - 15 * s, 0.9 * s, 0.9 * s, "#C0533F");
  line(ctx, [x, y, x, y + 4 * s], "#C98F5E", 1.4 * s);
}

function draw(ctx: Ctx) {
  const rand = rng(8642);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, BW, BH);
  ctx.clip();

  // end walls behind the arch
  rect(ctx, 0, 0, BW, WALL + 40, "#9C5A44");
  for (let y = 4; y < WALL + 40; y += 8) rect(ctx, 0, y, BW, 1, "rgba(50,25,15,.22)");
  for (let y = 0; y < WALL + 40; y += 8) for (let x = ((y / 8) % 2) * 8; x < BW; x += 16) rect(ctx, x, y, 1, 8, "rgba(50,25,15,.16)");
  // the glass roof
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ARCH.x, ARCH.y, ARCH.rx, ARCH.ry, 0, Math.PI, 0);
  ctx.closePath();
  const glass = ctx.createLinearGradient(0, 0, 0, ARCH.y);
  glass.addColorStop(0, "#AFC4CF");
  glass.addColorStop(0.6, "#D3DDDC");
  glass.addColorStop(1, "#E6E6DC");
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.clip();
  for (let k = 0; k < 40; k++) {
    const a = Math.PI + (k / 40) * Math.PI;
    const x0 = ARCH.x + Math.cos(a) * ARCH.rx * 1.1;
    const y0 = ARCH.y + Math.sin(a) * ARCH.ry * 1.1;
    poly(ctx, [ARCH.x, ARCH.y, x0, y0, ARCH.x + Math.cos(a + 0.04) * ARCH.rx * 1.1, ARCH.y + Math.sin(a + 0.04) * ARCH.ry * 1.1], k % 3 ? "rgba(255,255,255,.12)" : "rgba(90,110,120,.1)");
  }
  ctx.strokeStyle = "#3E4A50";
  for (const f of [0.86, 0.72, 0.58, 0.44]) {
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(ARCH.x, ARCH.y, ARCH.rx * f, ARCH.ry * f, 0, Math.PI, 0);
    ctx.stroke();
  }
  for (let k = 1; k < 24; k++) {
    const a = Math.PI + (k / 24) * Math.PI;
    line(ctx, [ARCH.x + Math.cos(a) * ARCH.rx * 0.3, ARCH.y + Math.sin(a) * ARCH.ry * 0.3, ARCH.x + Math.cos(a) * ARCH.rx, ARCH.y + Math.sin(a) * ARCH.ry], "#3E4A50", k % 4 ? 2 : 4);
  }
  for (let k = 0; k < 6; k++) ell(ctx, 120 + k * 230, 40 + (k % 2) * 30, 30, 4, "rgba(255,255,255,.35)", -0.3);
  ctx.restore();
  ctx.strokeStyle = "#2F3A40";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(ARCH.x, ARCH.y, ARCH.rx, ARCH.ry, 0, Math.PI, 0);
  ctx.stroke();
  // the girder with its lattice
  rect(ctx, 0, 138, BW, 5, "#2F3A40");
  rect(ctx, 0, 158, BW, 5, "#2F3A40");
  const lat: number[] = [];
  for (let x = 0; x <= BW; x += 20) lat.push(x, (x / 20) % 2 ? 158 : 142);
  line(ctx, lat, "#2F3A40", 2);
  for (let x = 40; x < BW; x += 120) for (const dx of [-14, 14]) line(ctx, [x, 158, x + dx * 4, 210], "#2F3A40", 2);
  pigeon(ctx, 286, 138, 1, 1);
  pigeon(ctx, 314, 138, 1, -1);
  pigeon(ctx, 342, 138, 0.9, 1);
  // the clock
  line(ctx, [656, 0, 656, 50], "#2F3A40", 3);
  line(ctx, [688, 0, 688, 50], "#2F3A40", 3);
  rect(ctx, 640, 46, 64, 8, "#2F3A40");
  ell(ctx, 672, 96, 50, 50, "#2F3A40");
  ell(ctx, 672, 96, 45, 45, "#C9A23F");
  ell(ctx, 672, 96, 40, 40, "#FFFEFA");
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    line(ctx, [672 + Math.cos(a) * 33, 96 + Math.sin(a) * 33, 672 + Math.cos(a) * 38, 96 + Math.sin(a) * 38], "#1C1C1A", k % 3 ? 2 : 4);
  }
  text(ctx, "SLOW", 672, 116, 8, "#7A2E2E", "Libre Caslon Text", 700);
  const hand = (frac: number, len: number, w: number) => {
    const a = frac * Math.PI * 2 - Math.PI / 2;
    line(ctx, [672, 96, 672 + Math.cos(a) * len, 96 + Math.sin(a) * len], "#1C1C1A", w);
  };
  hand(9.22 / 12, 20, 4);
  hand(13 / 60, 31, 2.6);
  ell(ctx, 672, 96, 3, 3, "#B4513A");
  ell(ctx, 672, 146, 6, 5, "#2F3A40");

  // the back wall
  rect(ctx, 0, WALL, BW, TB - WALL, "#D6C7A6");
  for (let y = WALL + 10; y < TB; y += 10) rect(ctx, 0, y, BW, 1, "rgba(80,60,40,.12)");
  rect(ctx, 0, WALL, BW, 8, "#B4A483");
  const archWin = (x: number) => {
    rect(ctx, x, 200, 44, 90, "#5C6A72");
    ell(ctx, x + 22, 200, 22, 22, "#5C6A72");
    rect(ctx, x + 20, 180, 4, 110, "#D6C7A6");
    rect(ctx, x, 236, 44, 3, "#D6C7A6");
    poly(ctx, [x + 4, 290, x + 18, 196, x + 26, 196, x + 12, 290], "rgba(255,255,255,.12)");
  };
  archWin(146);
  archWin(1028);
  archWin(1222);
  archWin(1286);
  // posters
  {
    rect(ctx, 40, 176, 82, 112, "#E3B556");
    rect(ctx, 40, 238, 82, 50, "#7DB0C8");
    ell(ctx, 81, 222, 18, 18, "#F4E1A6");
    for (let k = 0; k < 4; k++) rect(ctx, 40, 246 + k * 10, 82, 3, "rgba(255,255,255,.4)");
    rect(ctx, 40, 268, 82, 20, "#E2CFA6");
    text(ctx, "HASTINGS", 81, 186, 11, "#7A2E2E", "Libre Caslon Text", 700);
    text(ctx, "IT'S FINE", 81, 200, 9, "#2D4C9A", "Work Sans", 700);
    rect(ctx, 226, 176, 76, 112, "#2D4C9A");
    ell(ctx, 264, 240, 30, 6, "#F4F1EA");
    poly(ctx, [246, 210, 282, 210, 276, 238, 252, 238], "#F4F1EA");
    ctx.strokeStyle = "#F4F1EA";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(282, 222, 8, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    rect(ctx, 248, 212, 32, 5, "#9C6B3E");
    line(ctx, [258, 204, 254, 196, 258, 188], "#F4F1EA", 1.6);
    line(ctx, [270, 204, 266, 196, 270, 188], "#F4F1EA", 1.6);
    text(ctx, "HAVE A", 264, 256, 10, "#F4F1EA", "Libre Caslon Text", 700);
    text(ctx, "NICE CUP", 264, 270, 10, "#E3B556", "Libre Caslon Text", 700);
    rect(ctx, 326, 182, 102, 44, "#2A2927");
    text(ctx, "LOST", 377, 196, 11, "#F4F1EA", "Work Sans", 700);
    text(ctx, "PROPERTY", 368, 212, 10, "#E3B556", "Work Sans", 700);
    poly(ctx, [404, 208, 414, 208, 414, 204, 422, 212, 414, 220, 414, 216, 404, 216], "#E3B556");
    rect(ctx, 340, 240, 76, 50, "#5C4632");
    rect(ctx, 346, 246, 64, 40, "#4A5F78");
    rect(ctx, 352, 266, 20, 16, "#C0533F");
    ell(ctx, 392, 274, 10, 8, "#9C6B3E");
    line(ctx, [358, 252, 358, 266], "#3A3631", 2);
    rect(ctx, 910, 176, 88, 112, "#F4F1EA");
    text(ctx, "TIMETABLE", 954, 186, 8.5, "#1C1C1A", "Work Sans", 700);
    for (let r = 0; r < 12; r++) for (let c = 0; c < 4; c++) rect(ctx, 916 + c * 20, 196 + r * 7.5, 16, 3, r % 4 ? "rgba(28,28,26,.35)" : "rgba(180,81,58,.6)");
    rect(ctx, 1108, 176, 82, 112, "#F4F1EA");
    rect(ctx, 1108, 240, 82, 12, "#E3B556");
    text(ctx, "PLEASE", 1149, 192, 9.5, "#1C1C1A", "Work Sans", 700);
    text(ctx, "STAND", 1149, 206, 9.5, "#1C1C1A", "Work Sans", 700);
    text(ctx, "BEHIND", 1149, 220, 9.5, "#1C1C1A", "Work Sans", 700);
    text(ctx, "THE LINE", 1149, 268, 9.5, "#B4513A", "Work Sans", 700);
    head(ctx, 1149, 230, 6, SKIN[0], "#2A2927");
  }
  // the departures board
  {
    line(ctx, [500, 142, 500, 168], "#2F3A40", 3);
    line(ctx, [844, 142, 844, 168], "#2F3A40", 3);
    rect(ctx, 466, 164, 412, 136, "#2F3A40");
    rect(ctx, 474, 172, 396, 120, "#1A1C1E");
    text(ctx, "DEPARTURES", 672, 184, 13, "#E3B556", "Courier Prime", 700);
    const cols = [500, 612, 726, 806];
    ["TIME", "TO", "PLAT", "EXPECTED"].forEach((s, k) => text(ctx, s, cols[k], 200, 9, "#9A9A8A", "Courier Prime", 700));
    ROWS.forEach((r, i) => {
      const y = 216 + i * 14;
      text(ctx, r[0], cols[0], y, 11.5, "#E3B556", "Courier Prime", 700);
      ctx.textAlign = "left";
      ctx.fillText(r[1], 552, y);
      text(ctx, r[2], cols[2], y, 11.5, "#E3B556", "Courier Prime", 700);
      text(ctx, r[3], cols[3], y, 11.5, r[3] === "ON TIME" || r[3] === "BOARDING" ? "#E3B556" : "#E0644E", "Courier Prime", 700);
    });
  }

  // the green train, far side
  {
    rect(ctx, 0, TB + 4, BW, 100, "#2A2927");
    rect(ctx, 0, 406, BW, 12, "#6B6258");
    for (let x = 0; x < BW; x += 14) rect(ctx, x, 408, 8, 4, "#4A4440");
    for (let c = 0; c < 4; c++) {
      const x0 = -20 + c * 316;
      const w = c === 3 ? 286 : 308;
      rect(ctx, x0, TB, w, 8, "#8E949A");
      rect(ctx, x0, TB + 6, w, 92, "#3E6E4E");
      rect(ctx, x0, TB + 64, w, 8, "#E2D3AE");
      rect(ctx, x0, TB + 96, w, 8, "#2A2927");
      for (const wx of [x0 + 30, x0 + w - 50]) {
        ell(ctx, wx, 408, 8, 8, "#2A2927");
        ell(ctx, wx + 20, 408, 8, 8, "#2A2927");
      }
      rect(ctx, x0 + w / 2 - 12, TB + 10, 24, 84, "#335E40");
      rect(ctx, x0 + w / 2 - 8, TB + 16, 16, 24, "#8FA2AE");
    }
    B_WIN.forEach((w, k) => {
      const x = B_X(k);
      if (x > 1196) return;
      rect(ctx, x, TB + 16, 24, 38, "#CFC6AE");
      seat(ctx, w, x, TB + 16, 24, 38, k);
      rect(ctx, x, TB + 16, 24, 2, "rgba(255,255,255,.4)");
    });
    // the engine
    const ex = 1214;
    rect(ctx, ex, TB - 10, 130, 108, "#2F5A3E");
    rect(ctx, ex, TB + 64, 130, 8, "#E2D3AE");
    rect(ctx, ex + 12, TB + 4, 40, 34, "#8FA2AE");
    head(ctx, ex + 30, TB + 28, 8, SKIN[2], "#2A2927");
    rect(ctx, ex + 20, TB + 16, 20, 4, "#2A2927");
    rect(ctx, ex + 66, TB + 20, 60, 30, "#E3B556");
    text(ctx, "47 211", ex + 96, TB + 35, 11, "#2A2927", "Courier Prime", 700);
    rect(ctx, ex, TB + 96, 130, 8, "#2A2927");
    for (const wx of [ex + 24, ex + 50, ex + 90, ex + 116]) ell(ctx, wx, 408, 9, 9, "#2A2927");
  }
  // the island platform
  {
    const pf = ctx.createLinearGradient(0, ISLAND, 0, TA);
    pf.addColorStop(0, "#BDB7AA");
    pf.addColorStop(1, "#CFC9BC");
    ctx.fillStyle = pf;
    ctx.fillRect(0, ISLAND, BW, TA - ISLAND);
    rect(ctx, 0, ISLAND, BW, 6, "#E2DDD2");
    rect(ctx, 0, ISLAND + 8, BW, 4, "#E3B54A");
    for (let x = 0; x < BW; x += 48) rect(ctx, x, ISLAND + 14, 1.4, TA - ISLAND - 14, "rgba(80,76,70,.2)");
    rect(ctx, 0, 456, BW, 1.4, "rgba(80,76,70,.2)");
    for (let k = 0; k < 300; k++) rect(ctx, rand() * BW, ISLAND + 14 + rand() * (TA - ISLAND - 14), 2, 2, "rgba(60,56,50,.1)");
  }
  // columns
  for (const cx of [134, 446, 894]) {
    rect(ctx, cx - 4, WALL, 8, ISLAND + 60 - WALL, "#2F5A3E");
    rect(ctx, cx - 8, WALL, 16, 8, "#2F5A3E");
    rect(ctx, cx - 7, ISLAND + 50, 14, 14, "#2F5A3E");
    ctx.strokeStyle = "#2F5A3E";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx - 26, WALL + 6, 22, 0, Math.PI / 2);
    ctx.arc(cx + 26, WALL + 6, 22, Math.PI / 2, Math.PI);
    ctx.stroke();
  }
  for (const [sx, n] of [[446, "2"], [894, "3"]] as const) {
    rect(ctx, sx - 20, 362, 40, 32, "#F4F1EA");
    rect(ctx, sx - 20, 362, 40, 3, "#B4513A");
    text(ctx, n, sx, 380, 20, "#1C1C1A", "Libre Caslon Text", 700);
  }
  // people on the island
  const IF = 494;
  const ip = (x: number, o: PersonOpts) => stockPerson(ctx, x, { feet: IF, h: 80, ...o });
  ip(196, { coat: "#C0533F", legs: "#2A2927", skin: SKIN[1], hair: "#2A2927" });
  ip(226, { coat: "#E3B556", legs: "#4A5F78", skin: SKIN[1], hair: "#2A2927", h: 52 });
  suitcase(ctx, 240, 466, 30, 26, "#2D4C9A");
  suitcase(ctx, 170, 470, 16, 22, "#6B4E7A");
  {
    const x = 410;
    line(ctx, [x, 458, x - 14, 476, x - 22, 490], "#2A2927", 6);
    line(ctx, [x, 458, x + 12, 478, x + 22, 486], "#2A2927", 6);
    poly(ctx, [x - 10, 460, x + 10, 460, x + 18, 428, x - 2, 424], "#6B4E7A");
    line(ctx, [x + 12, 432, x + 26, 444, x + 34, 436], "#6B4E7A", 5);
    line(ctx, [x + 2, 430, x - 12, 446, x - 20, 440], "#6B4E7A", 5);
    rect(ctx, x - 30, 436, 16, 12, "#5C4632");
    head(ctx, x + 10, 414, 9, SKIN[0], "#C9783E");
    line(ctx, [x - 30, 418, x - 42, 418], "#9A9A9A", 1.4);
    line(ctx, [x - 28, 428, x - 44, 428], "#9A9A9A", 1.4);
  }
  bench(ctx, 644, 494, 112);
  sitter(ctx, 706, 482, "#D98CB0", "#2A2927", SKIN[3], "#E7E2D5", 0.9);
  line(ctx, [696, 470, 718, 458], "#8A6440", 1.6);
  line(ctx, [700, 458, 716, 472], "#8A6440", 1.6);
  ell(ctx, 708, 470, 6, 4, "#C0533F");
  rect(ctx, 852, 414, 40, 80, "#B4513A");
  rect(ctx, 858, 422, 28, 40, "#2A2927");
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) rect(ctx, 860 + c * 9, 425 + r * 9, 6, 6, ["#E3B556", "#7DB85C", "#F4F1EA", "#D98CB0"][(r + c) % 4]);
  rect(ctx, 858, 470, 28, 8, "#1C1C1A");
  ip(1104, { coat: "#2A2927", legs: "#2A2927", skin: SKIN[3], hair: "#9A9A9A", hat: "#2A2927", arm: "up" });
  poly(ctx, [1124, 382, 1144, 386, 1124, 396], "#4F9A4A");
  line(ctx, [1124, 382, 1124, 410], "#3A3631", 1.6);
  rect(ctx, 1094, 438, 20, 3, "#E3B556");
  ip(1186, { coat: "#4F7A5A", legs: "#2A2927", skin: SKIN[2], hair: "#1C1C1A", arm: "phone" });
  ip(1270, { coat: "#E2D3AE", legs: "#4A5F78", skin: SKIN[0], hair: "#6B4A2E" });
  suitcase(ctx, 1282, 470, 22, 22, "#B4513A");

  // the red train, near side
  {
    rect(ctx, 0, TA, BW, EDGE - TA, "#4A4440");
    rect(ctx, 230, 656, BW, 20, "#5A524A");
    rect(ctx, 230, 660, BW, 4, "#9A9A9A");
    for (let c = 0; c < 4; c++) {
      const x0 = 344 + c * 278;
      rect(ctx, x0, TA, 272, 10, "#8E949A");
      rect(ctx, x0, TA + 8, 272, 132, "#B4513A");
      rect(ctx, x0, TA + 100, 272, 10, "#E3B556");
      rect(ctx, x0, TA + 138, 272, 14, "#2A2927");
      for (const wx of [x0 + 34, x0 + 64, x0 + 210, x0 + 240]) {
        ell(ctx, wx, 658, 12, 12, "#2A2927");
        ell(ctx, wx, 658, 4, 4, "#8E949A");
      }
    }
    A_WIN.forEach((w, k) => {
      const x = A_X(k);
      rect(ctx, x - 3, 525, 50, 66, "#8A3A2A");
      rect(ctx, x, 528, 44, 60, "#D9CDB4");
      seat(ctx, w, x, 528, 44, 60, k + 3);
      rect(ctx, x, 528, 44, 3, "rgba(255,255,255,.45)");
      poly(ctx, [x + 6, 588, x + 22, 528, x + 30, 528, x + 14, 588], "rgba(255,255,255,.1)");
    });
    for (let c = 0; c < 4; c++) {
      const dx = 344 + c * 278 + 248;
      rect(ctx, dx, TA + 14, 22, 122, "#9C4430");
      rect(ctx, dx + 4, TA + 22, 14, 30, "#8FA2AE");
      rect(ctx, dx + 14, TA + 70, 3, 12, "#E3B556");
    }
    // the cab
    ctx.fillStyle = "#B4513A";
    ctx.beginPath();
    ctx.moveTo(344, TA);
    ctx.lineTo(282, TA + 4);
    ctx.quadraticCurveTo(238, TA + 40, 236, TA + 110);
    ctx.lineTo(236, TA + 152);
    ctx.lineTo(344, TA + 152);
    ctx.closePath();
    ctx.fill();
    poly(ctx, [236, TA + 100, 344, TA + 100, 344, TA + 152, 236, TA + 152], "#E3B556");
    poly(ctx, [284, TA + 12, 336, TA + 12, 336, TA + 56, 256, TA + 56], "#5C6A72");
    head(ctx, 312, TA + 42, 10, SKIN[4], "#9A9A9A");
    rect(ctx, 300, TA + 30, 24, 5, "#2A2927");
    ell(ctx, 248, TA + 128, 7, 6, "#FFFEFA");
    rect(ctx, 236, TA + 152, 108, 4, "#2A2927");
    ell(ctx, 290, 658, 12, 12, "#2A2927");
    rect(ctx, 256, TA + 70, 48, 20, "#2A2927");
    text(ctx, "BRIGHTON", 280, TA + 80, 8, "#E3B556", "Courier Prime", 700);
  }

  // the near platform
  {
    const pf = ctx.createLinearGradient(0, EDGE, 0, BH);
    pf.addColorStop(0, "#C9C3B6");
    pf.addColorStop(1, "#A8A296");
    ctx.fillStyle = pf;
    ctx.fillRect(0, EDGE, BW, BH - EDGE);
    rect(ctx, 0, EDGE, BW, 10, "#E2DDD2");
    rect(ctx, 0, EDGE + 14, BW, 8, "#E3B54A");
    for (let k = 0; k < 40; k++) {
      const x0 = k * 48 - 300;
      line(ctx, [x0 + 300 * 0.3, EDGE + 24, x0, BH], "rgba(80,76,70,.18)", 1.4);
    }
    for (const y of [740, 790, 846]) rect(ctx, 0, y, BW, 1.4, "rgba(80,76,70,.18)");
    for (let k = 0; k < 500; k++) rect(ctx, rand() * BW, EDGE + 24 + rand() * (BH - EDGE - 24), 2, 2, k % 2 ? "rgba(60,56,50,.1)" : "rgba(255,255,255,.12)");
    for (const [sx, sy] of [[460, 800], [1000, 852], [760, 760]]) ell(ctx, sx, sy, 6, 3, "rgba(60,56,50,.25)");
  }
  // columns on the near platform
  for (const cx of [312, 1088]) {
    rect(ctx, cx - 5, WALL, 10, EDGE + 30 - WALL, "#2F5A3E");
    rect(ctx, cx - 9, EDGE + 16, 18, 16, "#2F5A3E");
    rect(ctx, cx - 10, WALL, 20, 8, "#2F5A3E");
  }
  rect(ctx, 282, 438, 62, 46, "#F4F1EA");
  rect(ctx, 282, 438, 62, 4, "#B4513A");
  text(ctx, "1", 313, 464, 30, "#1C1C1A", "Libre Caslon Text", 700);
  // tannoy
  poly(ctx, [324, 394, 340, 386, 340, 418, 324, 410], "#8E949A");
  rect(ctx, 316, 396, 8, 12, "#6E747A");
  for (const r of [8, 14]) {
    ctx.strokeStyle = "#3A3631";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(340, 402, r, -0.6, 0.6);
    ctx.stroke();
  }

  // the newspaper kiosk
  {
    rect(ctx, 0, 520, 222, 322, "#2F5A3E");
    rect(ctx, 0, 480, 230, 44, "#264A33");
    text(ctx, "NEWS", 115, 502, 26, "#E3B556", "Libre Caslon Text", 700);
    rect(ctx, 0, 524, 230, 6, "#E3B556");
    rect(ctx, 10, 540, 200, 120, "#E9CF96");
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 6; c++) {
        const mx = 16 + c * 32;
        const my = 546 + r * 38;
        rect(ctx, mx, my, 26, 32, ["#C0533F", "#F4F1EA", "#2D4C9A", "#E3B556", "#D98CB0", "#4F7A5A"][(r * 2 + c) % 6]);
        rect(ctx, mx + 3, my + 4, 20, 4, "rgba(255,255,255,.7)");
        rect(ctx, mx + 5, my + 14, 16, 12, "rgba(28,28,26,.2)");
      }
    ell(ctx, 120, 646, 16, 20, "#C0533F");
    head(ctx, 120, 622, 10, SKIN[1], "#2A2927");
    rect(ctx, 6, 660, 210, 14, "#8A6440");
    for (let k = 0; k < 6; k++) {
      rect(ctx, 12 + k * 34, 648, 30, 14, "#ECE8DD");
      rect(ctx, 14 + k * 34, 651, 26, 3, "#1C1C1A");
    }
    rect(ctx, 10, 690, 200, 140, "#264A33");
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      rect(ctx, 18 + c * 38, 700 + r * 42, 32, 36, "#ECE8DD");
      rect(ctx, 20 + c * 38, 704 + r * 42, 28, 6, "#1C1C1A");
      for (let j = 0; j < 3; j++) rect(ctx, 21 + c * 38, 715 + r * 42 + j * 6, 26, 1.6, "rgba(28,28,26,.4)");
    }
    // headline board
    poly(ctx, [176, 846, 209, 744, 242, 846], "#2A2927");
    rect(ctx, 182, 758, 54, 74, "#FFFEFA");
    text(ctx, "TRAIN", 209, 770, 10, "#1C1C1A", "Libre Caslon Text", 700);
    text(ctx, "ON TIME:", 209, 784, 9, "#1C1C1A", "Libre Caslon Text", 700);
    text(ctx, "NATION", 209, 802, 10, "#B4513A", "Libre Caslon Text", 700);
    text(ctx, "STUNNED", 209, 816, 9, "#B4513A", "Libre Caslon Text", 700);
  }

  // the porter and his trolley
  person(ctx, 322, { coat: "#2D4C9A", legs: "#2A2927", skin: SKIN[2], hair: "#2A2927", hat: "#2D4C9A" });
  rect(ctx, 310, 726, 24, 3, "#E3B556");
  {
    rect(ctx, 352, 800, 120, 10, "#3A3631");
    line(ctx, [352, 805, 340, 744], "#3A3631", 4);
    ell(ctx, 372, 822, 13, 13, "#2A2927");
    ell(ctx, 452, 822, 13, 13, "#2A2927");
    ell(ctx, 372, 822, 5, 5, "#9A9A9A");
    ell(ctx, 452, 822, 5, 5, "#9A9A9A");
    suitcase(ctx, 360, 760, 108, 40, "#8A5A3C");
    suitcase(ctx, 368, 728, 86, 32, "#2D4C9A");
    suitcase(ctx, 376, 702, 60, 26, "#C9A23F");
    rect(ctx, 438, 712, 30, 16, "#B4513A");
    poly(ctx, [446, 700, 470, 700, 466, 712, 450, 712], "#4F7A5A");
    rect(ctx, 384, 768, 14, 10, "#F4F1EA");
  }
  // the woman with the suitcase
  person(ctx, 520, { coat: "#C0533F", legs: "#2A2927", skin: SKIN[0], hair: "#E3B556" });
  line(ctx, [534, 760, 550, 778], "#3A3631", 2.4);
  suitcase(ctx, 542, 776, 30, 52, "#6B4E7A");
  ell(ctx, 548, 832, 4, 4, "#2A2927");
  ell(ctx, 566, 832, 4, 4, "#2A2927");
  // the man with the map
  person(ctx, 626, { coat: "#9C7450", legs: "#4A5F78", skin: SKIN[3], hair: "#9A9A9A", arm: "phone" });
  rect(ctx, 610, 734, 40, 26, "#F4E1A6");
  line(ctx, [614, 740, 628, 752, 640, 738, 646, 756], "#2D4C9A", 1.4);
  rect(ctx, 630, 734, 1, 26, "rgba(28,28,26,.3)");
  // the couple saying goodbye
  person(ctx, 708, { coat: "#4F7A5A", legs: "#2A2927", skin: SKIN[1], hair: "#2A2927" });
  person(ctx, 736, { coat: "#E3B556", legs: "#4A5F78", skin: SKIN[4], hair: "#6B4A2E", h: 116 });
  line(ctx, [718, 750, 728, 756], "#4F7A5A", 6);
  ell(ctx, 722, 724, 4, 3.5, "#C0533F");
  suitcase(ctx, 746, 800, 28, 38, "#4A5F78");
  // the pigeon
  pigeon(ctx, 796, 836, 1.6, 1);
  for (const [cx, cy] of [[828, 838], [836, 834], [842, 840], [846, 836]]) ell(ctx, cx, cy, 2.4, 1.6, "#E8C98E");
  // the bench and the man with the coffee
  bench(ctx, 872, 842, 120);
  sitter(ctx, 916, 830, "#4A5F78", "#2A2927", SKIN[2], "#1C1C1A");
  rect(ctx, 924, 794, 9, 12, "#F4F1EA");
  rect(ctx, 924, 792, 9, 3, "#8A6440");
  line(ctx, [926, 788, 928, 778, 926, 770], "rgba(255,255,255,.6)", 1.2);
  rect(ctx, 952, 808, 30, 18, "#ECE8DD");
  // the man with the briefcase, late
  person(ctx, 1030, { coat: "#3A3631", legs: "#3A3631", skin: SKIN[0], hair: "#6B4A2E", arm: "up" });
  rect(ctx, 1042, 774, 30, 22, "#5C4632");
  rect(ctx, 1052, 770, 10, 4, "#3A3631");
  rect(ctx, 1026, 752, 8, 16, "#C0533F");

  // the station cafe
  {
    rect(ctx, 1104, 470, 240, 380, "#E2D3AE");
    for (let y = 476; y < 850; y += 9) rect(ctx, 1104, y, 240, 1, "rgba(80,60,40,.1)");
    rect(ctx, 1110, 484, 234, 50, "#7A2E2E");
    text(ctx, "STATION CAFE", 1226, 509, 22, "#F4F1EA", "Libre Caslon Text", 700);
    for (let k = 0; k < 13; k++) {
      const ax = 1104 + k * 18.6;
      poly(ctx, [ax, 536, ax + 18.6, 536, ax + 18.6, 560, ax, 560], k % 2 ? "#F4F1EA" : "#7A2E2E");
      ell(ctx, ax + 9.3, 560, 9.3, 5, k % 2 ? "#F4F1EA" : "#7A2E2E");
    }
    rect(ctx, 1118, 574, 152, 150, "#5C4632");
    rect(ctx, 1124, 580, 140, 138, "#E9CF96");
    rect(ctx, 1124, 660, 140, 4, "#8A6440");
    // cakes
    for (let k = 0; k < 4; k++) {
      const cx = 1140 + k * 34;
      ell(ctx, cx, 656, 14, 4, "#F4F1EA");
      if (k % 2) {
        rect(ctx, cx - 10, 638, 20, 16, "#C08A4A");
        rect(ctx, cx - 10, 644, 20, 3, "#F4F1EA");
        ell(ctx, cx, 636, 3, 3, "#C0533F");
      } else {
        ell(ctx, cx, 648, 10, 7, "#D9A55E");
        ell(ctx, cx, 644, 8, 3, "#F4E1A6");
      }
    }
    head(ctx, 1194, 604, 10, SKIN[3], "#C9783E");
    ell(ctx, 1194, 630, 16, 14, "#F4F1EA");
    for (let k = 0; k < 3; k++) {
      rect(ctx, 1136 + k * 12, 690, 9, 12, "#F4F1EA");
      line(ctx, [1140 + k * 12, 686, 1142 + k * 12, 676], "rgba(255,255,255,.7)", 1.2);
    }
    rect(ctx, 1226, 680, 30, 30, "#B9BDBF");
    rect(ctx, 1234, 672, 14, 8, "#8E949A");
    poly(ctx, [1130, 718, 1150, 580, 1162, 580, 1142, 718], "rgba(255,255,255,.14)");
    rect(ctx, 1280, 574, 56, 270, "#5C4632");
    rect(ctx, 1286, 580, 44, 120, "#8FA2AE");
    ell(ctx, 1290, 720, 3, 3, "#E3B556");
    rect(ctx, 1290, 596, 36, 20, "#F4F1EA");
    text(ctx, "OPEN", 1308, 606, 9, "#B4513A", "Work Sans", 700);
    rect(ctx, 1118, 730, 152, 6, "#8A6440");
    // a table outside
    rect(ctx, 1142, 780, 70, 6, "#ECE8DD");
    rect(ctx, 1174, 786, 5, 50, "#3A3631");
    rect(ctx, 1160, 832, 34, 4, "#3A3631");
    rect(ctx, 1150, 770, 9, 10, "#F4F1EA");
    ell(ctx, 1194, 778, 9, 3, "#F4F1EA");
    ell(ctx, 1194, 774, 6, 3, "#C08A4A");
    sitter(ctx, 1240, 800, "#D98CB0", "#2A2927", SKIN[1], "#2A2927", 1.1);
  }

  grain(ctx, rand);
  ctx.restore();
}

export const station: Scene = { title: "The Station", draw, labels: LABELS, landmarks: LANDMARKS };
