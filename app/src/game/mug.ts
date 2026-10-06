// "Carry a Full Mug": side view of a room. Pure module, SSR safe (no globals at top level).
export const W = 1000;
export const H = 640;
const FLOOR = 560;
const COUNTER = { x0: 0, x1: 210, top: 392 };
const MACHINE = { x0: 25, x1: 105, y0: 288 };
const DESK = { x0: 760, x1: 1000, top: 410 };
const LAPTOP = { x0: 915, x1: 990, y0: 334 };
const COASTER_X = 845;
const RUG = { x0: 290, x1: 720 };
const LAMP = { ax: 380, len: 290, r: 44 };
const LEAVES = [
  { x: 585, y: 332, r: 34 },
  { x: 626, y: 298, r: 40 },
  { x: 668, y: 336, r: 32 },
  { x: 620, y: 360, r: 30 },
  { x: 598, y: 398, r: 25 },
  { x: 646, y: 402, r: 25 },
];
const POT = { x0: 594, x1: 652, y0: 474 };
const STEM = { x0: 615, x1: 627, y0: 380 };
const CAT = { x: 470, y: FLOOR - 14 };
const MW = 58; // glass body
const MH = 70;
const IW = 48; // inside
const RIM = 62;
const FULL_ML = 380;
export const START_ML = 350;
const G = 1.15; // how hard the coffee leans when you accelerate
const K = 0.18; // hand spring
const C = 0.55;

export type MugState = "rest" | "held" | "landed" | "falling" | "broken";
export type MugEvent = "pickup" | "lamp" | "plant" | "spill" | "cat" | "putback" | "dropped" | "delivered";
type Drop = { x: number; y: number; vx: number; vy: number };
type Stain = { x: number; r: number; floor: boolean };
type Shard = { x: number; y: number; vx: number; vy: number; a: number; va: number; s: number };
type Rect = { x0: number; x1: number; y0: number; y1: number };

const SOLIDS: Rect[] = [
  { x0: COUNTER.x0, x1: COUNTER.x1, y0: COUNTER.top, y1: H },
  { x0: MACHINE.x0, x1: MACHINE.x1, y0: MACHINE.y0, y1: COUNTER.top },
  { x0: DESK.x0, x1: DESK.x1, y0: DESK.top, y1: DESK.top + 18 },
  { x0: LAPTOP.x0, x1: LAPTOP.x1, y0: LAPTOP.y0, y1: DESK.top },
  { x0: POT.x0, x1: POT.x1, y0: POT.y0, y1: FLOOR },
  { x0: STEM.x0, x1: STEM.x1, y0: STEM.y0, y1: POT.y0 },
];

function rng(seed: number) {
  let s = seed >>> 0 || 17;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class MugGame {
  state: MugState = "rest";
  x = 140;
  y = COUNTER.top - MH / 2;
  vx = 0;
  vy = 0;
  ax = 0;
  ay = 0;
  tx = 0;
  ty = 0;
  offX = 0;
  offY = 0;
  tilt = 0;
  level = (START_ML / FULL_ML) * RIM;
  th = 0;
  thv = 0;
  b = 0;
  bv = 0;
  rip = 0;
  ripv = 0;
  temp = 72;
  frames = 0;
  started = false;
  landedFor = 0;
  lampA = 0;
  lampV = 0;
  plantWob = 0;
  plantWobV = 0;
  cat: "asleep" | "awake" | "gone" = "asleep";
  catX = CAT.x;
  catT = 0;
  rugStains = 0;
  drops: Drop[] = [];
  stains: Stain[] = [];
  shards: Shard[] = [];
  delivered = false;
  dropped = false;
  private r: () => number;
  private cool: Record<string, number> = {};
  private spilledOnce = false;
  private steamT = 0;
  private lastAx = 0;

  constructor(seed: number) {
    this.r = rng(seed);
  }

  get ml() {
    return Math.max(0, Math.round((this.level / RIM) * FULL_ML));
  }
  get onCoaster() {
    return Math.abs(this.x - COASTER_X) < 30;
  }

  private once(key: string, frames: number) {
    const now = this.frames;
    if ((this.cool[key] ?? -1e9) > now) return false;
    this.cool[key] = now + frames;
    return true;
  }

  hitMug(px: number, py: number) {
    return Math.abs(px - this.x) < MW / 2 + 18 && Math.abs(py - this.y) < MH / 2 + 14;
  }

  down(px: number, py: number): MugEvent | null {
    if (this.state !== "rest" || !this.hitMug(px, py)) return null;
    this.state = "held";
    this.started = true;
    this.offX = px - this.x;
    this.offY = py - this.y;
    this.tx = this.x;
    this.ty = this.y;
    return "pickup";
  }

  move(px: number, py: number) {
    this.tx = clamp(px - this.offX, MW / 2, W - MW / 2);
    this.ty = clamp(py - this.offY, MH / 2, FLOOR - MH / 2);
  }

  up(): MugEvent | null {
    if (this.state !== "held") return null;
    const bottom = this.y + MH / 2;
    const surf = this.surfaceUnder(this.x);
    if (surf !== null && bottom > surf - 46 && bottom <= surf + 2) {
      const impact = Math.max(0, this.vy) + (surf - bottom) * 0.12;
      this.y = surf - MH / 2;
      this.bv -= impact * 0.9;
      this.thv += this.vx * 0.01;
      this.vx = this.vy = 0;
      if (surf === COUNTER.top) {
        this.state = "rest";
        return "putback";
      }
      this.state = "landed";
      this.landedFor = 0;
      return null;
    }
    this.state = "falling";
    this.dropped = true;
    return "dropped";
  }

  private surfaceUnder(x: number) {
    if (x - MW / 2 >= COUNTER.x0 && x + MW / 2 <= COUNTER.x1 && x - MW / 2 >= MACHINE.x1) return COUNTER.top;
    if (x - MW / 2 >= DESK.x0 && x + MW / 2 <= LAPTOP.x0) return DESK.top;
    return null;
  }

  private lampBob() {
    return { x: LAMP.ax + Math.sin(this.lampA) * LAMP.len, y: Math.cos(this.lampA) * LAMP.len };
  }

  // push the mug out of anything solid; returns how hard it hit
  private collide(): MugEvent | null {
    let ev: MugEvent | null = null;
    const hw = MW / 2;
    const hh = MH / 2;
    const hitCircle = (cx: number, cy: number, r: number) => {
      const qx = clamp(cx, this.x - hw, this.x + hw);
      const qy = clamp(cy, this.y - hh, this.y + hh);
      let dx = qx - cx;
      let dy = qy - cy;
      let d = Math.hypot(dx, dy);
      if (d >= r) return 0;
      if (d < 1e-3) {
        dx = this.x - cx;
        dy = this.y - cy;
        d = Math.hypot(dx, dy) || 1;
      }
      const nx = dx / d;
      const ny = dy / d;
      this.x += nx * (r - d);
      this.y += ny * (r - d);
      return this.bounce(nx, ny);
    };
    for (const s of SOLIDS) {
      const ox = Math.min(this.x + hw, s.x1) - Math.max(this.x - hw, s.x0);
      const oy = Math.min(this.y + hh, s.y1) - Math.max(this.y - hh, s.y0);
      if (ox <= 0 || oy <= 0) continue;
      if (ox < oy) {
        const nx = this.x < (s.x0 + s.x1) / 2 ? -1 : 1;
        this.x += nx * ox;
        this.bounce(nx, 0);
      } else {
        const ny = this.y < (s.y0 + s.y1) / 2 ? -1 : 1;
        this.y += ny * oy;
        this.bounce(0, ny);
      }
    }
    const bob = this.lampBob();
    const jl = hitCircle(bob.x, bob.y, LAMP.r);
    if (jl > 0) {
      this.lampV += clamp(-this.vx * 0.0016, -0.03, 0.03) + (this.x < bob.x ? 0.004 : -0.004);
      if (jl > 0.6 && this.once("lamp", 40)) ev = "lamp";
    }
    let jp = 0;
    for (const l of LEAVES) jp = Math.max(jp, hitCircle(l.x, l.y, l.r));
    if (jp > 0) {
      this.plantWobV += clamp(this.vx * 0.01, -0.08, 0.08);
      if (jp > 0.6 && this.once("plant", 40)) ev = "plant";
    }
    this.x = clamp(this.x, hw, W - hw);
    this.y = clamp(this.y, hh, FLOOR - hh);
    return ev;
  }

  private bounce(nx: number, ny: number) {
    const vn = this.vx * nx + this.vy * ny;
    if (vn >= 0) return 0;
    this.vx -= 1.3 * vn * nx;
    this.vy -= 1.3 * vn * ny;
    if (vn > -0.9) return 0; // resting contact, not a knock
    // a knock sloshes the coffee
    this.thv += -vn * 0.012 * (nx === 0 ? (this.r() - 0.5) : -nx);
    this.bv += -vn * 0.35 * (ny < 0 ? 1 : -0.5);
    this.ripv += -vn * 0.4;
    return -vn;
  }

  step(): MugEvent[] {
    const out: MugEvent[] = [];
    this.frames++;
    if (this.started && this.temp > 20) this.temp -= 0.006;
    const pvx = this.vx;
    const pvy = this.vy;
    if (this.state === "held") {
      this.vx += K * (this.tx - this.x) - C * this.vx;
      this.vy += K * (this.ty - this.y) - C * this.vy;
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > 34) {
        this.vx *= 34 / sp;
        this.vy *= 34 / sp;
      }
      this.x += this.vx;
      this.y += this.vy;
      const ev = this.collide();
      if (ev) out.push(ev);
    } else if (this.state === "falling") {
      this.vy += 0.6;
      this.x += this.vx;
      this.y += this.vy;
      this.tilt += 0.06 * Math.sign(this.vx || 1);
      if (this.y + MH / 2 >= FLOOR) this.shatter();
    } else {
      this.vx = this.vy = 0;
    }
    this.ax = this.vx - pvx;
    this.ay = this.vy - pvy;

    if (this.state === "held" || this.state === "landed" || this.state === "rest") {
      const tiltTarget = this.state === "held" ? clamp(-this.ax * 0.05 - this.vx * 0.004, -0.22, 0.22) : 0;
      this.tilt += (tiltTarget - this.tilt) * 0.2;
      // slosh: the surface leans against the acceleration and swings back and forth
      const thEq = Math.atan(-this.ax / G);
      this.thv += 0.045 * (thEq - this.th) - 0.022 * this.thv;
      this.th = clamp(this.th + this.thv, -1.1, 1.1);
      if (Math.abs(this.th) >= 1.1) this.thv *= -0.3;
      this.bv += -0.09 * this.b - 0.04 * this.bv + this.ay * 0.7;
      this.b = clamp(this.b + this.bv, -20, 24);
      this.ripv += -0.3 * this.rip - 0.06 * this.ripv + Math.abs(this.ax - this.lastAx) * 0.25;
      this.lastAx = this.ax;
      this.rip += this.ripv;
      if (this.spill()) out.push("spill");
    }
    if (this.state === "landed") {
      this.landedFor++;
      const calm = Math.abs(this.thv) + Math.abs(this.bv) < 0.02;
      if (!this.delivered && this.landedFor > 50 && (calm || this.landedFor > 180)) {
        this.delivered = true;
        out.push("delivered");
      }
    }

    for (const d of this.drops) {
      d.vy += 0.42;
      d.x += d.vx;
      d.y += d.vy;
    }
    const keep: Drop[] = [];
    for (const d of this.drops) {
      if (this.cat === "asleep" && Math.abs(d.x - this.catX) < 34 && d.y > CAT.y - 18 && d.y < CAT.y + 10) {
        this.cat = "awake";
        this.catT = 0;
        out.push("cat");
        continue;
      }
      if (d.y >= FLOOR) {
        this.addStain(d.x);
        continue;
      }
      if (SOLIDS.some((s) => d.x > s.x0 && d.x < s.x1 && d.y > s.y0 && d.y < s.y1)) continue;
      if (d.x < -20 || d.x > W + 20) continue;
      keep.push(d);
    }
    this.drops = keep;

    if (this.cat === "awake") {
      this.catT++;
      if (this.catT > 26) this.catX -= 9;
      if (this.catX < -80) this.cat = "gone";
    }
    this.lampV += -0.0021 * Math.sin(this.lampA) - 0.006 * this.lampV;
    this.lampA += this.lampV;
    this.plantWobV += -0.08 * this.plantWob - 0.06 * this.plantWobV;
    this.plantWob += this.plantWobV;
    for (const s of this.shards) {
      if (s.y < FLOOR - 2) {
        s.vy += 0.5;
        s.x += s.vx;
        s.y += s.vy;
        s.a += s.va;
      } else {
        s.y = FLOOR - 2;
        s.vx *= 0.7;
        s.x += s.vx;
        s.vy = 0;
      }
    }
    this.steamT += 1;
    return out;
  }

  private surfaceAt(xr: number) {
    const rel = this.th - this.tilt;
    return this.level + this.b + Math.tan(rel) * xr + this.rip * 0.6 * Math.sin((xr / IW) * Math.PI * 2);
  }

  private spill() {
    let spilled = false;
    for (const s of [-1, 1]) {
      const xr = (s * IW) / 2;
      const excess = this.surfaceAt(xr) - RIM;
      if (excess <= 0 || this.level <= 0) continue;
      const amt = Math.min(this.level, excess * 0.06 + 0.04);
      this.level -= amt;
      spilled = true;
      const n = Math.min(4, 1 + Math.floor(excess / 3));
      const c = Math.cos(this.tilt);
      const sn = Math.sin(this.tilt);
      const lx = xr;
      const ly = -MH / 2 + 2;
      const wx = this.x + lx * c - ly * sn;
      const wy = this.y + lx * sn + ly * c;
      for (let i = 0; i < n; i++) {
        this.drops.push({
          x: wx + s * this.r() * 3,
          y: wy,
          vx: this.vx * 0.8 + s * (0.6 + this.r() * 1.8),
          vy: this.vy * 0.6 - this.r() * 2.2 - Math.max(0, excess) * 0.05,
        });
      }
    }
    if (spilled && !this.spilledOnce) this.spilledOnce = true;
    return spilled && this.once("spill", 50);
  }

  private addStain(x: number) {
    const onRug = x > RUG.x0 && x < RUG.x1;
    const near = this.stains.find((s) => Math.abs(s.x - x) < s.r * 0.8);
    if (near) near.r = Math.min(30, near.r + 0.6);
    else {
      this.stains.push({ x, r: 3 + this.r() * 3, floor: !onRug });
      if (onRug) this.rugStains++;
    }
  }

  private shatter() {
    this.state = "broken";
    this.y = FLOOR - MH / 2;
    const n = Math.max(30, Math.round(this.level * 1.2));
    for (let i = 0; i < n; i++) {
      this.drops.push({ x: this.x + (this.r() - 0.5) * 30, y: FLOOR - 6, vx: (this.r() - 0.5) * 9, vy: -this.r() * 7 });
    }
    this.level = 0;
    for (let i = 0; i < 14; i++) {
      this.shards.push({
        x: this.x + (this.r() - 0.5) * 30,
        y: FLOOR - 10 - this.r() * 20,
        vx: (this.r() - 0.5) * 8,
        vy: -this.r() * 6,
        a: this.r() * 6,
        va: (this.r() - 0.5) * 0.4,
        s: 5 + this.r() * 10,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // floor and baseboard
    ctx.fillStyle = "#E7DDCC";
    ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.strokeStyle = "rgba(120,96,64,0.12)";
    ctx.lineWidth = 1;
    for (let y = FLOOR + 14; y < H; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#EFEAE1";
    ctx.fillRect(0, FLOOR - 12, W, 12);
    ctx.fillStyle = "rgba(60,50,35,0.08)";
    ctx.fillRect(0, FLOOR - 1, W, 2);

    // rug and stains
    ctx.fillStyle = "#FBFAF6";
    ctx.fillRect(RUG.x0, FLOOR - 3, RUG.x1 - RUG.x0, 9);
    ctx.strokeStyle = "#E3DED3";
    ctx.strokeRect(RUG.x0, FLOOR - 3, RUG.x1 - RUG.x0, 9);
    ctx.strokeStyle = "#D9D3C6";
    for (let x = RUG.x0 - 8; x <= RUG.x0; x += 4) this.line(ctx, x, FLOOR + 1, x + 6, FLOOR + 1);
    for (let x = RUG.x1; x <= RUG.x1 + 8; x += 4) this.line(ctx, x, FLOOR + 1, x - 6, FLOOR + 1);
    for (const st of this.stains) {
      ctx.fillStyle = st.floor ? "rgba(95,62,32,0.45)" : "rgba(110,70,36,0.6)";
      ctx.beginPath();
      ctx.ellipse(st.x, FLOOR + (st.floor ? 6 : 1), st.r, st.r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // counter, coffee machine
    ctx.fillStyle = "#E6E0D5";
    ctx.fillRect(COUNTER.x0, COUNTER.top, COUNTER.x1 - COUNTER.x0, FLOOR - COUNTER.top);
    ctx.fillStyle = "#CFC7B8";
    ctx.fillRect(COUNTER.x0, COUNTER.top, COUNTER.x1 - COUNTER.x0 + 6, 12);
    ctx.strokeStyle = "rgba(60,50,35,0.18)";
    ctx.strokeRect(14, COUNTER.top + 26, 86, FLOOR - COUNTER.top - 40);
    ctx.strokeRect(112, COUNTER.top + 26, 86, FLOOR - COUNTER.top - 40);
    ctx.fillStyle = "#3B3A37";
    this.round(ctx, MACHINE.x0, MACHINE.y0, MACHINE.x1 - MACHINE.x0, COUNTER.top - MACHINE.y0, 8);
    ctx.fill();
    ctx.fillStyle = "#57554F";
    ctx.fillRect(MACHINE.x0 + 14, MACHINE.y0 + 42, 34, 8);
    ctx.fillStyle = "#8C877C";
    ctx.beginPath();
    ctx.arc(MACHINE.x0 + 58, MACHINE.y0 + 20, 6, 0, Math.PI * 2);
    ctx.fill();

    // desk, laptop, coaster
    ctx.fillStyle = "#D8CCB8";
    ctx.fillRect(DESK.x0, DESK.top, DESK.x1 - DESK.x0, 18);
    ctx.fillStyle = "#C7B9A2";
    ctx.fillRect(DESK.x0 + 16, DESK.top + 18, 12, FLOOR - DESK.top - 18);
    ctx.fillRect(DESK.x1 - 28, DESK.top + 18, 12, FLOOR - DESK.top - 18);
    ctx.fillStyle = "#A9A59C";
    ctx.save();
    ctx.translate(LAPTOP.x0 + 4, DESK.top);
    ctx.rotate(-0.22);
    this.round(ctx, 0, -76, 8, 76, 3);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#B8B4AA";
    ctx.fillRect(LAPTOP.x0, DESK.top - 6, LAPTOP.x1 - LAPTOP.x0, 6);
    ctx.fillStyle = "#C9A77E";
    this.round(ctx, COASTER_X - 34, DESK.top - 4, 68, 5, 2);
    ctx.fill();

    // plant
    ctx.save();
    ctx.translate(623, POT.y0);
    ctx.rotate(this.plantWob * 0.15);
    ctx.translate(-623, -POT.y0);
    ctx.strokeStyle = "#5E7A5A";
    ctx.lineWidth = 6;
    this.line(ctx, 621, POT.y0, 621, STEM.y0 - 20);
    for (const l of LEAVES) {
      ctx.fillStyle = l.r > 33 ? "#6F8C68" : "#7E9B76";
      ctx.beginPath();
      ctx.ellipse(l.x, l.y, l.r, l.r * 0.72, (l.x - 621) * 0.012, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(40,60,36,0.25)";
      ctx.lineWidth = 1.2;
      this.line(ctx, l.x - l.r * 0.7, l.y, l.x + l.r * 0.7, l.y);
    }
    ctx.restore();
    ctx.fillStyle = "#C98F6B";
    ctx.beginPath();
    ctx.moveTo(POT.x0 - 4, POT.y0);
    ctx.lineTo(POT.x1 + 4, POT.y0);
    ctx.lineTo(POT.x1 - 4, FLOOR);
    ctx.lineTo(POT.x0 + 4, FLOOR);
    ctx.closePath();
    ctx.fill();

    // cat
    if (this.cat !== "gone") this.drawCat(ctx);

    // lamp
    const bob = this.lampBob();
    ctx.strokeStyle = "#55524C";
    ctx.lineWidth = 2;
    this.line(ctx, LAMP.ax, 0, bob.x, bob.y - 30);
    ctx.save();
    ctx.translate(bob.x, bob.y);
    ctx.rotate(-this.lampA);
    const glow = ctx.createRadialGradient(0, 30, 4, 0, 30, 120);
    glow.addColorStop(0, "rgba(255,236,190,0.35)");
    glow.addColorStop(1, "rgba(255,236,190,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 50, 120, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4A5F78";
    ctx.beginPath();
    ctx.moveTo(-14, -32);
    ctx.lineTo(14, -32);
    ctx.lineTo(54, 22);
    ctx.lineTo(-54, 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FFF4D6";
    ctx.beginPath();
    ctx.ellipse(0, 23, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (const sh of this.shards) {
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.a);
      ctx.fillStyle = "rgba(225,232,236,0.9)";
      ctx.strokeStyle = "rgba(120,130,140,0.6)";
      ctx.beginPath();
      ctx.moveTo(-sh.s / 2, 0);
      ctx.lineTo(sh.s / 2, -sh.s / 3);
      ctx.lineTo(sh.s / 4, sh.s / 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (this.state !== "broken") this.drawMug(ctx);
    ctx.fillStyle = "#6B4A2E";
    for (const d of this.drops) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMug(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);
    const top = -MH / 2;
    const bot = MH / 2;
    // shadow on a surface
    if (this.state !== "held" && this.state !== "falling") {
      ctx.fillStyle = "rgba(40,36,28,0.12)";
      ctx.beginPath();
      ctx.ellipse(0, bot + 1, MW / 2 + 4, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // coffee, seen through the glass
    const innerBot = bot - 5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-IW / 2, top, IW, innerBot - top);
    ctx.clip();
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const xr = -IW / 2 + (IW * i) / 24;
      const h = clamp(this.surfaceAt(xr), 0, RIM + 6);
      const y = innerBot - h;
      if (i === 0) ctx.moveTo(xr, y);
      else ctx.lineTo(xr, y);
    }
    ctx.lineTo(IW / 2, innerBot);
    ctx.lineTo(-IW / 2, innerBot);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, top, 0, innerBot);
    cg.addColorStop(0, "#7A5434");
    cg.addColorStop(1, "#4E3320");
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = "#B88C5E";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const xr = -IW / 2 + (IW * i) / 24;
      const y = innerBot - clamp(this.surfaceAt(xr), 0, RIM + 6);
      if (i === 0) ctx.moveTo(xr, y);
      else ctx.lineTo(xr, y);
    }
    ctx.stroke();
    ctx.restore();
    // glass body and handle
    ctx.strokeStyle = "rgba(110,118,124,0.75)";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(235,242,246,0.28)";
    this.round(ctx, -MW / 2, top, MW, MH, 7);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(MW / 2, top + 14);
    ctx.bezierCurveTo(MW / 2 + 22, top + 12, MW / 2 + 22, bot - 16, MW / 2, bot - 18);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(110,118,124,0.6)";
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 3;
    this.line(ctx, -MW / 2 + 7, top + 10, -MW / 2 + 7, bot - 12);
    ctx.strokeStyle = "rgba(110,118,124,0.45)";
    ctx.lineWidth = 1;
    this.line(ctx, -MW / 2 + 2, bot - 5, MW / 2 - 2, bot - 5);
    // hand on the handle
    if (this.state === "held" || this.state === "falling") {
      ctx.fillStyle = this.state === "held" ? "#E6C0A0" : "rgba(230,192,160,0)";
      if (this.state === "held") {
        this.round(ctx, MW / 2 + 6, top + 4, 34, 46, 14);
        ctx.fill();
        ctx.strokeStyle = "rgba(28,28,26,0.25)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = "#DDB592";
        for (let i = 0; i < 3; i++) {
          this.round(ctx, MW / 2 - 2, top + 16 + i * 11, 18, 9, 4.5);
          ctx.fill();
        }
      }
    }
    ctx.restore();
    // steam
    if (this.temp > 40 && this.state !== "falling") {
      const a = clamp((this.temp - 40) / 40, 0, 1) * 0.35;
      ctx.strokeStyle = `rgba(150,150,150,${a})`;
      ctx.lineWidth = 2;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          const yy = this.y - MH / 2 - 6 - i * 4;
          const xx = this.x + k * 12 + Math.sin(this.steamT * 0.07 + i * 0.6 + k) * 4;
          if (i === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
    }
  }

  private drawCat(ctx: CanvasRenderingContext2D) {
    const x = this.catX;
    const y = CAT.y;
    ctx.fillStyle = "#8F8C86";
    if (this.cat === "asleep") {
      ctx.beginPath();
      ctx.ellipse(x, y, 34, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 26, y - 4, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 34, y - 11);
      ctx.lineTo(x - 31, y - 22);
      ctx.lineTo(x - 25, y - 13);
      ctx.fill();
      ctx.strokeStyle = "#8F8C86";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x + 30, y + 4);
      ctx.quadraticCurveTo(x + 46, y + 8 + Math.sin(this.steamT * 0.03) * 3, x + 26, y + 12);
      ctx.stroke();
      ctx.strokeStyle = "rgba(40,40,40,0.5)";
      ctx.lineWidth = 1.2;
      this.line(ctx, x - 31, y - 4, x - 26, y - 4);
    } else {
      const run = this.catT > 26;
      const hop = run ? Math.abs(Math.sin(this.catT * 0.5)) * 6 : 0;
      ctx.beginPath();
      ctx.ellipse(x, y - 10 - hop, 30, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 30, y - 22 - hop, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 37, y - 28 - hop);
      ctx.lineTo(x - 35, y - 40 - hop);
      ctx.lineTo(x - 28, y - 30 - hop);
      ctx.fill();
      ctx.strokeStyle = "#8F8C86";
      ctx.lineWidth = 5;
      for (const lx of [-18, -8, 12, 22]) this.line(ctx, x + lx, y - 4 - hop, x + lx + (run ? Math.sin(this.catT + lx) * 6 : 0), y + 2);
      ctx.lineWidth = 6;
      this.line(ctx, x + 28, y - 12 - hop, x + 46, y - 34 - hop);
    }
  }

  private line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  private round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
}

export type MugResult = { ml: number; temp: number; rug: number; cat: "asleep" | "awake" | "gone"; time: number; coaster: boolean; dropped: boolean };

export function mugTier(r: MugResult) {
  const pct = r.ml / START_ML;
  if (r.dropped) return { tier: "Gravity", line: "The mug is now several smaller mugs." };
  if (pct >= 0.995 && r.rug === 0) return { tier: "Barista hands", line: "Not a single drop. Suspicious, honestly." };
  if (pct >= 0.95) return { tier: "Steady", line: r.rug ? "A drop or two. Nobody will notice. The rug noticed." : "A drop or two. Nobody will notice." };
  if (pct >= 0.8) return { tier: "Trail of evidence", line: "Anyone could follow you from the kitchen." };
  if (pct >= 0.5) return { tier: "Half full", line: "An optimist would call this a good result." };
  return { tier: "Mostly on the floor", line: "You carried a mug. The coffee took a different route." };
}
