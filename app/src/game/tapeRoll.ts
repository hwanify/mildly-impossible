// Clear packing-tape roll toy. Pure module: no browser globals at top level (SSR safe).
// The roll is seen in a 3/4 view: a front face (circle) plus a body extruded along D.
export const W = 1000;
export const H = 640;
export const PX_PER_CM = 14;
export const GOAL_CM = 25;
const GOAL = GOAL_CM * PX_PER_CM;
const CX = 390;
const CY = 372;
const R = 168; // outer radius of the tape
const RC = 74; // outer radius of the cardboard core
const DX = 96; // tape width, drawn along this vector
const DY = -72;
const STEP = 2.4; // thickness of one layer: the only clue where the end is
const RIM = 36;
const TEAR_LEN = 80;
const V_WARN = 1.3; // world px per ms
const V_TEAR = 2.0;
const CATCH_MAX = 0.1; // radians per pointer event
const LIFT_MAX = 0.06;
const TAU = Math.PI * 2;

export type Phase = "find" | "lift" | "tab" | "peel" | "won";
export type TapeEvent = "bump" | "bump-fast" | "catch" | "slip" | "lifted" | "tear" | "snap" | "won";
type Pt = { x: number; y: number };

const wrap = (a: number) => {
  let v = (a + Math.PI) % TAU;
  if (v < 0) v += TAU;
  return v - Math.PI;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const polar = (a: number, r: number): Pt => ({ x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r });

function rng(seed: number) {
  let s = seed >>> 0 || 11;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export class TapeRoll {
  phase: Phase = "find";
  c: number; // nail direction (sign of angle change) that catches the edge
  end: number; // angle of the free end on the rim
  rot = 0;
  lift = 0;
  touching = false;
  holding = false;
  lastA: number | null = null;
  nailA: number | null = null;
  jiggle = 0;
  light = false;
  P: Pt = { x: 0, y: 0 };
  L = 0;
  tau = 0;
  tearAt: number | null = null;
  tearSide = 0;
  speed = 0;
  stress = 0;
  lastT = 0;
  frame = 0;
  falling: { pts: Pt[]; t: number } | null = null;
  bumps = 0;
  wrongBumps = 0;
  tears = 0;
  slips = 0;
  private r: () => number;
  private specks: { a: number; rr: number; s: number }[] = [];

  constructor(seed: number) {
    this.r = rng(seed);
    this.c = this.r() < 0.5 ? 1 : -1;
    this.end = this.r() * TAU - Math.PI;
    for (let i = 0; i < 9; i++)
      this.specks.push({ a: this.r() * TAU, rr: RC + 18 + this.r() * (R - RC - 26), s: 0.7 + this.r() * 1.3 });
  }

  get cm() {
    return this.L / PX_PER_CM;
  }

  tabTip(): Pt {
    return polar(this.end - this.c * 0.07, R + 26);
  }

  down(x: number, y: number, t: number): TapeEvent | null {
    if (this.phase === "won") return null;
    if (this.phase === "tab" || this.phase === "peel") {
      const tip = this.phase === "tab" ? this.tabTip() : this.P;
      if (Math.hypot(x - tip.x, y - tip.y) < 56) {
        if (this.phase === "tab") {
          this.phase = "peel";
          this.P = tip;
          this.tau = this.end;
          const e = polar(this.end, R);
          this.L = Math.hypot(tip.x - e.x, tip.y - e.y);
        }
        this.holding = true;
        this.lastT = t;
        this.speed = 0;
      }
      return null;
    }
    const d = Math.hypot(x - CX, y - CY);
    if (Math.abs(d - R) < RIM) {
      this.touching = true;
      this.lastA = Math.atan2(y - CY, x - CX);
      this.nailA = this.lastA;
    }
    return null;
  }

  move(x: number, y: number, t: number): TapeEvent | null {
    if (this.holding) return this.pull(x, y, t);
    const d = Math.hypot(x - CX, y - CY);
    const a = Math.atan2(y - CY, x - CX);
    if (!this.touching) {
      this.nailA = (this.phase === "find" || this.phase === "lift") && Math.abs(d - R) < RIM ? a : null;
      return null;
    }
    if (Math.abs(d - R) > RIM * 1.7) {
      this.nailA = null;
      this.lastA = null;
      return null;
    }
    this.nailA = a;
    if (this.lastA === null) {
      this.lastA = a;
      return null;
    }
    const prev = this.lastA;
    const da = wrap(a - prev);
    this.lastA = a;
    if (da === 0 || Math.abs(da) > 0.5) return null;
    if (this.phase === "find") {
      const toEnd = wrap(this.end - prev);
      const crossed = Math.sign(toEnd) === Math.sign(da) && Math.abs(toEnd) <= Math.abs(da);
      if (!crossed) return null;
      this.jiggle = 1;
      this.bumps++;
      if (Math.sign(da) === this.c) {
        if (Math.abs(da) > CATCH_MAX) return "bump-fast";
        this.phase = "lift";
        this.lift = 0;
        return "catch";
      }
      this.wrongBumps++;
      return "bump";
    }
    if (this.phase === "lift") {
      if (Math.sign(da) === this.c) {
        if (Math.abs(da) > LIFT_MAX) {
          this.phase = "find";
          this.lift = 0;
          this.slips++;
          this.jiggle = 1;
          return "slip";
        }
        this.lift += Math.abs(da) / 0.32;
        if (this.lift >= 1) {
          this.lift = 1;
          this.phase = "tab";
          this.touching = false;
          this.nailA = null;
          return "lifted";
        }
      } else this.lift = Math.max(0, this.lift - Math.abs(da) / 0.32);
    }
    return null;
  }

  up(): TapeEvent | null {
    const wasLifting = this.phase === "lift";
    this.touching = false;
    this.holding = false;
    this.lastA = null;
    if (wasLifting) {
      this.phase = "find";
      this.lift = 0;
      this.slips++;
      return "slip";
    }
    return null;
  }

  private tangent(px: number, py: number) {
    const dx = px - CX;
    const dy = py - CY;
    const d = Math.hypot(dx, dy);
    const phi = Math.atan2(dy, dx);
    const al = Math.acos(Math.min(1, R / d));
    for (const tau of [phi - al, phi + al]) {
      const tp = polar(tau, R);
      // The strip leaves the roll opposite to the way the layer continues around it.
      const fx = this.c * Math.sin(tau);
      const fy = -this.c * Math.cos(tau);
      if ((px - tp.x) * fx + (py - tp.y) * fy > 0) return tau;
    }
    return phi;
  }

  private pull(x: number, y: number, t: number): TapeEvent | null {
    let px = clamp(x, 14, W - 14);
    let py = clamp(y, 14, H - 14);
    const d = Math.hypot(px - CX, py - CY);
    if (d < R + 10) {
      const k = (R + 10) / (d || 1);
      px = CX + (px - CX) * k;
      py = CY + (py - CY) * k;
    }
    const dt = Math.max(4, t - this.lastT);
    const v = Math.hypot(px - this.P.x, py - this.P.y) / dt;
    this.lastT = t;
    this.speed = this.speed * 0.5 + v * 0.5;
    this.P = { x: px, y: py };
    this.tau = this.tangent(px, py);
    const tp = polar(this.tau, R);
    const dist = Math.hypot(px - tp.x, py - tp.y);
    let ev: TapeEvent | null = null;
    if (dist > this.L) {
      this.rot -= (this.c * (dist - this.L)) / R;
      if (this.tearAt === null && this.speed > V_TEAR) {
        this.tearAt = this.L;
        this.tearSide = this.r() < 0.5 ? 0 : 1;
        this.tears++;
        ev = "tear";
      }
      this.L = dist;
      if (this.tearAt !== null && this.L - this.tearAt >= TEAR_LEN) return this.snap();
      if (this.tearAt === null && this.L >= GOAL) {
        this.phase = "won";
        this.holding = false;
        return "won";
      }
    }
    return ev;
  }

  private snap(): TapeEvent {
    this.falling = { pts: this.stripPolygon(), t: 0 };
    this.end = this.tau;
    this.phase = "find";
    this.holding = false;
    this.L = 0;
    this.tearAt = null;
    this.lift = 0;
    this.stress = 0;
    return "snap";
  }

  step() {
    this.frame++;
    this.jiggle *= 0.86;
    if (!this.holding) this.speed *= 0.8;
    else this.speed *= 0.93;
    this.stress = clamp((this.speed - V_WARN) / (V_TEAR - V_WARN), 0, 1);
    if (this.falling && ++this.falling.t > 55) this.falling = null;
  }

  private stripFront(n = 28): Pt[] {
    const tp = polar(this.tau, R);
    const P = this.P;
    const dist = Math.hypot(P.x - tp.x, P.y - tp.y);
    const slack = Math.sqrt(Math.max(0, this.L * this.L - dist * dist)) * 0.5;
    const mx = (P.x + tp.x) / 2;
    const my = (P.y + tp.y) / 2 + slack;
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const a = (1 - s) * (1 - s);
      const b = 2 * (1 - s) * s;
      const c = s * s;
      pts.push({ x: a * P.x + b * mx + c * tp.x, y: a * P.y + b * my + c * tp.y });
    }
    return pts;
  }

  // Front edge from the tip (s = 0) to the roll (s = L); a tear eats the width diagonally.
  stripPolygon(): Pt[] {
    const f = this.stripFront();
    const n = f.length - 1;
    const L = this.L || 1;
    const front: Pt[] = [];
    const back: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * L;
      let lo = 0;
      let hi = 1;
      if (this.tearAt !== null && s > this.tearAt) {
        const k = Math.min(1, (s - this.tearAt) / TEAR_LEN);
        if (this.tearSide === 0) lo = k;
        else hi = 1 - k;
      }
      front.push({ x: f[i].x + DX * lo, y: f[i].y + DY * lo });
      back.push({ x: f[i].x + DX * hi, y: f[i].y + DY * hi });
    }
    return front.concat(back.reverse());
  }

  draw(ctx: CanvasRenderingContext2D) {
    const bx = CX + DX;
    const by = CY + DY;
    const ang = Math.atan2(DY, DX) + Math.PI / 2;
    const nx = Math.cos(ang) * R;
    const ny = Math.sin(ang) * R;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // table shadow
    ctx.fillStyle = "rgba(40,38,30,0.09)";
    ctx.beginPath();
    ctx.ellipse(CX + DX * 0.5 + 18, CY + R * 0.93, R * 1.22, 24, 0, 0, TAU);
    ctx.fill();

    // body of the roll
    const body = ctx.createLinearGradient(CX + nx, CY + ny, CX - nx, CY - ny);
    body.addColorStop(0, "#B79E72");
    body.addColorStop(0.45, "#D2BC92");
    body.addColorStop(1, "#A88F64");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(bx, by, R, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(CX + nx, CY + ny);
    ctx.lineTo(bx + nx, by + ny);
    ctx.lineTo(bx - nx, by - ny);
    ctx.lineTo(CX - nx, CY - ny);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.lineWidth = 9;
    const sa = ang + Math.PI + 0.55;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(sa) * (R - 6), CY + Math.sin(sa) * (R - 6));
    ctx.lineTo(bx + Math.cos(sa) * (R - 6), by + Math.sin(sa) * (R - 6));
    ctx.stroke();

    // front face: a spiral whose last turn ends in a one-layer step
    const outer = () => {
      const steps = 220;
      for (let k = 0; k <= steps; k++) {
        const f = k / steps;
        const p = polar(this.end + this.c * f * TAU, R - STEP * f);
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
    };
    const face = ctx.createRadialGradient(CX - 40, CY - 50, RC, CX, CY, R);
    face.addColorStop(0, "#E4D3AF");
    face.addColorStop(1, "#CDB487");
    ctx.fillStyle = face;
    ctx.beginPath();
    outer();
    ctx.moveTo(CX + RC, CY);
    ctx.arc(CX, CY, RC, 0, TAU, true);
    ctx.fill("evenodd");
    ctx.strokeStyle = "rgba(120,96,58,0.07)";
    ctx.lineWidth = 1;
    for (let r = RC + 6; r < R - 4; r += 5.5) {
      ctx.beginPath();
      ctx.arc(CX, CY, r, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(CX, CY, R - 30, Math.PI * 1.05, Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = "rgba(90,72,40,0.35)";
    for (const s of this.specks) {
      const p = polar(s.a + this.rot, s.rr);
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.s, 0, TAU);
      ctx.fill();
    }
    // cardboard core
    ctx.fillStyle = "#C4A77B";
    ctx.beginPath();
    ctx.arc(CX, CY, RC, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ECE7DC";
    ctx.beginPath();
    ctx.arc(CX, CY, RC - 13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(40,38,30,0.08)";
    ctx.beginPath();
    ctx.arc(CX + 10, CY - 8, RC - 13, 0, TAU);
    ctx.arc(CX, CY, RC - 13, 0, TAU, true);
    ctx.fill();
    ctx.strokeStyle = "rgba(90,70,40,0.45)";
    ctx.lineWidth = 1.5;
    const s0 = polar(this.rot * 1, RC - 13);
    const s1 = polar(this.rot * 1, RC);
    ctx.beginPath();
    ctx.moveTo(s0.x, s0.y);
    ctx.lineTo(s1.x, s1.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(110,86,50,0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    outer();
    ctx.stroke();

    if (this.falling) {
      const k = this.falling.t / 55;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.translate(0, k * k * 160);
      this.fillStrip(ctx, this.falling.pts, 0);
      ctx.restore();
    }

    if (this.phase === "lift" && this.lift > 0) {
      const b = polar(this.end + this.c * 0.3 * this.lift, R - 0.5);
      const tip = polar(this.end + this.c * 0.06 * this.lift, R + 16 * this.lift);
      const mid = polar(this.end + this.c * 0.2 * this.lift, R + 7 * this.lift);
      ctx.strokeStyle = "rgba(200,176,130,0.95)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    if (this.phase === "tab") {
      const e = polar(this.end, R);
      const tt = this.tabTip();
      this.fillStrip(ctx, [e, tt, { x: tt.x + DX, y: tt.y + DY }, { x: e.x + DX, y: e.y + DY }], 0);
      const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.09);
      ctx.strokeStyle = `rgba(28,28,26,${0.15 + pulse * 0.2})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tt.x + DX * 0.5, tt.y + DY * 0.5, 24 + pulse * 4, 0, TAU);
      ctx.stroke();
    }
    if (this.phase === "peel" || this.phase === "won") {
      this.fillStrip(ctx, this.stripPolygon(), this.stress);
      const label = `${Math.floor(this.cm)} cm`;
      ctx.font = '500 15px "Inter Tight", system-ui, sans-serif';
      ctx.fillStyle = "rgba(28,28,26,0.7)";
      ctx.fillText(label, this.P.x + 14, this.P.y + 24);
    }

    if (this.light) {
      ctx.fillStyle = "rgba(24,22,18,0.5)";
      ctx.fillRect(0, 0, W, H);
      const g = polar(this.end, R);
      const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, 30);
      glow.addColorStop(0, "rgba(255,248,225,0.95)");
      glow.addColorStop(1, "rgba(255,248,225,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 30, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,248,225,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      outer();
      ctx.stroke();
    }

    if (this.nailA !== null && (this.phase === "find" || this.phase === "lift")) {
      const wob = this.jiggle * Math.sin(this.frame * 1.7) * 3;
      const p = polar(this.nailA, R + 8 + wob);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(this.nailA + Math.PI / 2);
      ctx.fillStyle = this.touching ? "#F4E7DA" : "rgba(244,231,218,0.6)";
      ctx.strokeStyle = this.touching ? "rgba(28,28,26,0.6)" : "rgba(28,28,26,0.3)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-10, -5, 20, 10, 5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private fillStrip(ctx: CanvasRenderingContext2D, pts: Pt[], stress: number) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = "rgba(214,192,148,0.78)";
    ctx.fill();
    if (stress > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.45 * stress})`;
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(130,104,64,0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export type TapeResult = { time: number; tears: number; slips: number; bumps: number; light: boolean; scissors: boolean };

export function tapeTier(r: TapeResult) {
  if (r.scissors) return { tier: "Scissors", line: "Technically a solution. The roll will remember this." };
  if (r.tears === 0 && r.time < 30000 && !r.light) return { tier: "Warehouse veteran", line: "Thumbnail of steel. Movers fear you." };
  if (r.tears === 0) return { tier: "Clean pull", line: "One piece, full width. Rarer than it should be." };
  if (r.tears <= 2) return { tier: "Got there eventually", line: "A thin sliver of tape now lives somewhere on that roll forever." };
  return { tier: "Tape archaeologist", line: "You have uncovered several layers of history." };
}
