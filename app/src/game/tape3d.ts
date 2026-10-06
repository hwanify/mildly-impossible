// 3D packing-tape toy (three.js). Only ever imported on the client, from an effect.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const CM_PER_UNIT = 5; // the roll's radius is 5 cm
export const GOAL_CM = 25;
const R = 1;
const RI = 0.6;
const CORE_IN = 0.52;
const WD = 0.95;
const HALF = WD / 2;
const T = 0.006; // one layer of tape
const TAU = Math.PI * 2;
const CATCH_MAX = 0.06; // rad per pointer event
const LIFT_MAX = 0.045;
const TAB_MIN = 0.05;
const V_TEAR = 0.011; // world units per ms (about a quick flick)
const R0 = 0.3; // how fast an open tear line runs inward
const KB = 1.4; // how much pulling sideways steers it
const NS = 40;
const ROLL_X = -1.1;
const PULL_GAIN = 1.7; // your arm is longer than the screen

export type Phase = "find" | "lift" | "tab" | "peel" | "won";
export type TapeEvent =
  | "bump"
  | "bump-fast"
  | "bump-thin"
  | "catch"
  | "slip"
  | "tab"
  | "narrow"
  | "tear-start"
  | "edge-clean"
  | "full-width"
  | "snap"
  | "stuck-back"
  | "tangled"
  | "won";
export type Overlay = {
  thumb: { x: number; y: number; pressed: boolean } | null;
  pinch: { x: number; y: number } | null;
  tab: { x: number; y: number } | null;
  label: { x: number; y: number; text: string } | null;
};
type Hist = { m: number; l: number; r: number };

const wrap = (a: number) => {
  let v = (a + Math.PI) % TAU;
  if (v < 0) v += TAU;
  return v - Math.PI;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function rng(seed: number) {
  let s = seed >>> 0 || 13;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function ringTexture(r: () => number) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(256, 256, 256 * RI, 256, 256, 256);
  grad.addColorStop(0, "#d4b884");
  grad.addColorStop(1, "#c09c62");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  for (let rr = 256 * RI; rr < 256; rr += 1.6) {
    g.strokeStyle = `rgba(110,84,44,${0.04 + r() * 0.06})`;
    g.lineWidth = 0.7;
    g.beginPath();
    g.arc(256, 256, rr, 0, TAU);
    g.stroke();
  }
  g.fillStyle = "rgba(80,60,30,0.5)";
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU;
    const rr = 256 * (RI + 0.04 + r() * (0.92 - RI));
    g.beginPath();
    g.arc(256 + Math.cos(a) * rr, 256 + Math.sin(a) * rr, 0.8 + r() * 1.4, 0, TAU);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function coreTexture(r: () => number) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c2a378";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? "90,66,36" : "235,215,180"},${0.05 + r() * 0.08})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1);
  }
  g.strokeStyle = "rgba(70,50,26,0.55)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(128, 128 - 128 * (CORE_IN / RI));
  g.lineTo(128, 0);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 70, 128, 128, 128);
  grad.addColorStop(0, "rgba(40,36,28,0.34)");
  grad.addColorStop(1, "rgba(40,36,28,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export class TapeScene {
  phase: Phase = "find";
  light = false;
  tears = 0;
  slips = 0;
  bumps = 0;
  lost = 0;
  everCaught = false;
  everTab = false;
  muted = false;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1.5625, 0.1, 100);
  private key: THREE.DirectionalLight;
  private envTex: THREE.Texture;
  private rollG = new THREE.Group();
  private spinG = new THREE.Group();
  private outer: THREE.Mesh;
  private tapeMat: THREE.MeshPhysicalMaterial;
  private glint: THREE.Mesh;
  private hair: THREE.Mesh;
  private dust: THREE.Points;
  private strip: THREE.Mesh;
  private stripGeo: THREE.BufferGeometry;
  private falling: { mesh: THREE.Mesh; t: number; vy: number }[] = [];
  private disposables: { dispose: () => void }[] = [];
  private r: () => number;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private invRoll = new THREE.Matrix4();

  private w = 1000;
  private h = 640;
  private rho = 0;
  private omega = 0;
  private c: number;
  private end: number;
  private torn: number | null = null;
  private crinkle = false;
  private mode: "none" | "nail" | "spin" | "pull" = "none";
  private lastX = 0;
  private lastY = 0;
  private lastT = 0;
  private pressX = 0;
  private radPerPx = 0.005;
  private hover: { x: number; y: number } | null = null;
  private nailU = 0.5;
  private nailPhi = 0;
  private lastAlpha = 0;
  private liftA = 0;
  private liftB = 0;
  private liftL = 0;
  private P = new THREE.Vector3();
  private L = 0;
  private hist: Hist[] = [];
  private uL = 0;
  private uR = 1;
  private pinL = true;
  private pinR = true;
  private v = 0;
  private phiT = 0;
  private camDist = 6.2;
  private look = new THREE.Vector3(0.15, -0.1, 0);

  constructor(canvas: HTMLCanvasElement, seed: number) {
    this.r = rng(seed);
    this.c = this.r() < 0.5 ? 1 : -1;
    this.end = this.r() * TAU;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    this.key = new THREE.DirectionalLight(0xfff4e2, 2.0);
    this.key.position.set(2.2, 3.2, 3.0);
    this.scene.add(this.key);

    this.rollG.position.set(ROLL_X, 0, 0);
    this.rollG.rotation.z = Math.PI / 2; // stand the roll up: its axis is vertical
    this.scene.add(this.rollG);
    this.rollG.add(this.spinG);

    this.tapeMat = new THREE.MeshPhysicalMaterial({
      color: 0xc9a46a,
      roughness: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 0.8,
    });
    this.outer = new THREE.Mesh(this.buildOuter(), this.tapeMat);
    this.spinG.add(this.outer);

    const ringTex = ringTexture(this.r);
    const sideMat = new THREE.MeshPhysicalMaterial({ map: ringTex, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.1 });
    const coreTex = coreTexture(this.r);
    const coreMat = new THREE.MeshStandardMaterial({ map: coreTex, roughness: 0.92 });
    const ringGeo = new THREE.RingGeometry(RI, R, 160, 1);
    const coreGeo = new THREE.RingGeometry(CORE_IN, RI, 96, 1);
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(ringGeo, sideMat);
      ring.rotation.y = (s * Math.PI) / 2;
      ring.position.x = s * HALF;
      this.spinG.add(ring);
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.rotation.y = (s * Math.PI) / 2;
      core.position.x = s * (HALF + 0.004);
      this.spinG.add(core);
    }
    const innerGeo = new THREE.CylinderGeometry(CORE_IN, CORE_IN, WD + 0.008, 64, 1, true);
    const innerMat = new THREE.MeshStandardMaterial({ color: 0xa88c62, roughness: 1, side: THREE.BackSide });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.rotation.z = Math.PI / 2;
    this.spinG.add(inner);

    const glintGeo = new THREE.PlaneGeometry(WD, 0.018);
    this.glint = new THREE.Mesh(
      glintGeo,
      new THREE.MeshBasicMaterial({ color: 0xfff6e0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.hair = new THREE.Mesh(
      new THREE.PlaneGeometry(WD, 0.0045),
      new THREE.MeshBasicMaterial({ color: 0x5a4528, transparent: true, opacity: 0.15, depthWrite: false }),
    );
    this.spinG.add(this.glint, this.hair);
    this.dust = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ color: 0x3e3020, size: 0.014, transparent: true, opacity: 0.6, depthWrite: false }),
    );
    this.spinG.add(this.dust);
    this.placeEdge();

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, 2.9),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(ROLL_X + 0.12, -HALF - 0.002, 0.12);
    this.scene.add(shadow);

    this.stripGeo = new THREE.BufferGeometry();
    const n = (NS + 1) * 2;
    this.stripGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.stripGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < NS; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    this.stripGeo.setIndex(idx);
    this.strip = new THREE.Mesh(
      this.stripGeo,
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
        envMapIntensity: 0.8,
      }),
    );
    this.strip.visible = false;
    this.rollG.add(this.strip);

    this.disposables.push(ringTex, coreTex, sideMat, coreMat, ringGeo, coreGeo, innerGeo, innerMat, glintGeo);
    this.updateCamera(true);
  }

  // Outer surface as a spiral: the last turn ends one layer above where it began.
  private buildOuter() {
    const A = 360;
    const pos: number[] = [];
    const nor: number[] = [];
    const idx: number[] = [];
    for (let k = 0; k <= A; k++) {
      const f = k / A;
      const th = this.end + this.c * f * TAU;
      const rr = R - T * f;
      const s = Math.sin(th);
      const co = Math.cos(th);
      pos.push(-HALF, rr * s, rr * co, HALF, rr * s, rr * co);
      nor.push(0, s, co, 0, s, co);
    }
    // wind the triangles so their front faces point outward whichever way the tape is wound
    for (let k = 0; k < A; k++) {
      const a = k * 2;
      if (this.c > 0) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }

  private placeEdge() {
    const th = this.end;
    for (const m of [this.glint, this.hair]) {
      m.rotation.set(-th, 0, 0);
      m.position.set(0, (R + 0.003) * Math.sin(th), (R + 0.003) * Math.cos(th));
    }
    const pts: number[] = [];
    const count = this.crinkle ? 16 : 9;
    for (let i = 0; i < count; i++) {
      const a = th - this.c * (0.008 + this.r() * 0.01);
      pts.push(-HALF + this.r() * WD, (R + 0.004) * Math.sin(a), (R + 0.004) * Math.cos(a));
    }
    this.dust.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.dust.geometry = g;
  }

  private newEnd(th: number) {
    this.end = ((th % TAU) + TAU) % TAU;
    const old = this.outer.geometry;
    this.outer.geometry = this.buildOuter();
    old.dispose();
    this.placeEdge();
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  get cm() {
    return this.L * CM_PER_UNIT;
  }
  get width() {
    return this.phase === "peel" || this.phase === "won" ? this.uR - this.uL : this.liftB - this.liftA;
  }
  get peelSpeed() {
    return this.mode === "pull" && this.phase === "peel" ? this.v : 0;
  }
  setLight(on: boolean) {
    this.light = on;
    this.key.intensity = on ? 2.8 : 2.0;
  }

  private updateCamera(snap = false) {
    const peel = this.phase === "peel" || this.phase === "won";
    const extra = peel ? Math.max(0, this.L - 1.5) : 0;
    const targetDist = 6.2 + extra * 1.6;
    const pw = peel ? this.P : null;
    const base = new THREE.Vector3(0.1, -0.12, 0);
    if (pw) {
      const mid = new THREE.Vector3(ROLL_X, 0, 0).add(pw).multiplyScalar(0.5);
      base.lerp(mid, Math.min(0.7, extra * 0.35));
    }
    const k = snap ? 1 : 0.07;
    this.camDist += (targetDist - this.camDist) * k;
    this.look.lerp(base, k);
    this.camera.position.set(this.look.x, this.look.y + this.camDist * 0.34, this.look.z + this.camDist);
    this.camera.lookAt(this.look);
    this.camera.updateMatrixWorld();
  }

  private project(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.w, y: ((1 - p.y) / 2) * this.h };
  }

  private local(p: THREE.Vector3) {
    return this.rollG.worldToLocal(p.clone());
  }

  private hitRoll(px: number, py: number) {
    this.scene.updateMatrixWorld();
    this.ndc.set((px / this.w) * 2 - 1, -(py / this.h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.invRoll.copy(this.rollG.matrixWorld).invert();
    const o = this.raycaster.ray.origin.clone().applyMatrix4(this.invRoll);
    const d = this.raycaster.ray.direction.clone().transformDirection(this.invRoll);
    const a = d.y * d.y + d.z * d.z;
    const b = 2 * (o.y * d.y + o.z * d.z);
    const cc = o.y * o.y + o.z * o.z - R * R;
    const disc = b * b - 4 * a * cc;
    if (disc < 0 || a < 1e-9) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0) return null;
    return o.add(d.multiplyScalar(t));
  }

  private tabTipLocal() {
    const phiE = this.end - this.rho;
    const a = phiE - this.c * 0.05;
    const rr = R + 0.05 + 1.6 * this.liftL;
    return new THREE.Vector3(-HALF + ((this.liftA + this.liftB) / 2) * WD, rr * Math.sin(a), rr * Math.cos(a));
  }

  private grabTarget() {
    if (this.phase === "tab") return this.rollG.localToWorld(this.tabTipLocal());
    if (this.phase === "peel") return this.P.clone();
    return null;
  }

  down(px: number, py: number, t: number): TapeEvent | null {
    this.lastX = px;
    this.lastY = py;
    this.lastT = t;
    this.omega = 0;
    if (this.phase === "won") return null;
    const target = this.grabTarget();
    if (target) {
      const s = this.project(target);
      if (Math.hypot(s.x - px, s.y - py) < 48) {
        this.mode = "pull";
        this.v = 0;
        if (this.phase === "tab") return this.startPeel(target);
        return null;
      }
    }
    const lft = this.project(new THREE.Vector3(ROLL_X - R, 0, 0));
    const rgt = this.project(new THREE.Vector3(ROLL_X + R, 0, 0));
    this.radPerPx = 2 / Math.max(40, Math.abs(rgt.x - lft.x));
    const hit = this.phase === "find" || this.phase === "lift" ? this.hitRoll(px, py) : null;
    if (hit && Math.abs(hit.x) <= HALF) {
      this.mode = "nail";
      this.pressX = px;
      this.nailPhi = Math.atan2(hit.y, hit.z);
      this.nailU = clamp((hit.x + HALF) / WD, 0, 1);
      this.lastAlpha = this.nailPhi + this.rho;
    } else this.mode = "spin";
    return null;
  }

  move(px: number, py: number, t: number): TapeEvent | null {
    const dx = px - this.lastX;
    const dy = py - this.lastY;
    const dt = Math.max(4, t - this.lastT);
    this.lastX = px;
    this.lastY = py;
    this.lastT = t;
    if (this.mode === "none") {
      this.hover = { x: px, y: py };
      return null;
    }
    if (this.mode === "pull") return this.pull(dx, dy, dt);
    const dRho = dx * this.radPerPx;
    this.rho += dRho;
    if (this.mode === "spin") {
      this.omega = (dRho / dt) * 16;
      return null;
    }
    // nail: the thumb stays on the line where it was pressed; up and down moves it along the edge
    const hit = this.hitRoll(this.pressX, py);
    const prevU = this.nailU;
    if (hit) this.nailU = clamp((hit.x + HALF) / WD, 0, 1);
    else this.nailU = py < this.project(new THREE.Vector3(ROLL_X, 0, 0)).y ? 1 : 0;
    const alpha = this.nailPhi + this.rho;
    const prev = this.lastAlpha;
    const da = wrap(alpha - prev);
    this.lastAlpha = alpha;
    if (this.phase === "find") {
      if (da === 0 || Math.abs(da) > 0.6) return null;
      const toEnd = wrap(this.end - prev);
      const crossed = Math.sign(toEnd) === Math.sign(da) && Math.abs(toEnd) <= Math.abs(da);
      if (!crossed) return null;
      this.bumps++;
      if (Math.sign(da) !== this.c) return "bump";
      if (Math.abs(da) > CATCH_MAX * (this.crinkle ? 2 : 1)) return "bump-fast";
      if (this.torn !== null && Math.abs(this.nailU - this.torn) > 0.18) return "bump-thin";
      this.phase = "lift";
      this.everCaught = true;
      this.liftL = 0.004;
      const u = this.nailU;
      this.liftA = u < 0.07 ? 0 : clamp(u - 0.035, 0, 1);
      this.liftB = u > 0.93 ? 1 : clamp(u + 0.035, 0, 1);
      return "catch";
    }
    if (this.phase === "lift") {
      if (da !== 0 && Math.sign(da) === this.c) {
        if (Math.abs(da) > LIFT_MAX) return this.slip();
        this.liftL = Math.min(0.16, this.liftL + Math.abs(da));
      } else if (da !== 0) this.liftL = Math.max(0, this.liftL - Math.abs(da));
      const du = this.nailU - prevU;
      if (this.liftL > 0.012 && Math.abs(du) < 0.03 && this.nailU > this.liftA - 0.08 && this.nailU < this.liftB + 0.08) {
        this.liftA = Math.min(this.liftA, this.nailU - 0.025);
        this.liftB = Math.max(this.liftB, this.nailU + 0.025);
        if (this.liftA < 0.03) this.liftA = 0;
        if (this.liftB > 0.97) this.liftB = 1;
        this.liftA = clamp(this.liftA, 0, 1);
        this.liftB = clamp(this.liftB, 0, 1);
      }
    }
    return null;
  }

  private slip(): TapeEvent {
    this.phase = "find";
    this.liftL = 0;
    this.slips++;
    return "slip";
  }

  up(): TapeEvent | null {
    const mode = this.mode;
    this.mode = "none";
    if (mode === "nail" && this.phase === "lift") {
      if (this.liftL >= TAB_MIN) {
        this.phase = "tab";
        this.everTab = true;
        return "tab";
      }
      return this.slip();
    }
    if (mode === "pull" && this.phase === "peel") return this.letGo();
    return null;
  }

  wheel(dy: number) {
    if (this.mode === "pull") return;
    this.omega = 0;
    this.rho += dy * 0.0025;
  }

  private tangentPhi(qy: number, qz: number) {
    const d = Math.hypot(qy, qz);
    const phi = Math.atan2(qy, qz);
    if (d <= R) return phi;
    const al = Math.acos(R / d);
    for (const tau of [phi - al, phi + al]) {
      // the strip leaves opposite to the way the stuck layer continues around the roll
      const fy = -this.c * Math.cos(tau);
      const fz = this.c * Math.sin(tau);
      if ((qy - R * Math.sin(tau)) * fy + (qz - R * Math.cos(tau)) * fz > 0) return tau;
    }
    return phi;
  }

  private dist3(pl: THREE.Vector3) {
    const xc = -HALF + ((this.uL + this.uR) / 2) * WD;
    return Math.hypot(pl.x - xc, pl.y - R * Math.sin(this.phiT), pl.z - R * Math.cos(this.phiT));
  }

  private startPeel(target: THREE.Vector3): TapeEvent | null {
    this.phase = "peel";
    this.P.copy(target);
    this.uL = this.liftA;
    this.uR = this.liftB;
    this.pinL = this.uL <= 0.001;
    this.pinR = this.uR >= 0.999;
    this.hist = [{ m: 0, l: this.uL, r: this.uR }];
    const pl = this.local(this.P);
    this.phiT = this.tangentPhi(pl.y, pl.z);
    this.L = this.dist3(pl);
    return this.pinL && this.pinR ? null : "narrow";
  }

  private pull(dx: number, dy: number, dt: number): TapeEvent | null {
    const dist = this.camera.position.distanceTo(this.P);
    const wpp = (PULL_GAIN * 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / this.h;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const upv = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const step = right.multiplyScalar(dx * wpp).add(upv.multiplyScalar(-dy * wpp));
    this.P.add(step);
    if (this.P.y < -HALF + 0.02) this.P.y = -HALF + 0.02;
    this.v = this.v * 0.5 + (step.length() / dt) * 0.5;
    const pl = this.local(this.P);
    const q = Math.hypot(pl.y, pl.z);
    if (q < R + 0.06) {
      const k = (R + 0.06) / (q || 1);
      pl.y *= k;
      pl.z *= k;
      this.P.copy(this.rollG.localToWorld(pl.clone()));
    }
    if (this.phase !== "peel") return null;
    this.phiT = this.tangentPhi(pl.y, pl.z);
    const d = this.dist3(pl);
    if (d <= this.L) return null;
    const dL = d - this.L;
    this.L = d;
    this.rho += (this.c * dL) / R;
    const xc = -HALF + ((this.uL + this.uR) / 2) * WD;
    const beta = clamp((pl.x - xc) / Math.max(0.4, d * 0.6), -1, 1);
    const ev = this.tearStep(dL, beta);
    if (this.phase !== "peel") return ev;
    const last = this.hist[this.hist.length - 1];
    if (this.L - last.m > 0.01) this.hist.push({ m: this.L, l: this.uL, r: this.uR });
    if (this.cm >= GOAL_CM && this.pinL && this.pinR) {
      this.phase = "won";
      this.mode = "none";
      return "won";
    }
    return ev;
  }

  // Pulling crooked loads the far edge; a yank loads both. An open tear line runs
  // inward diagonally unless you steer it back out by pulling toward its side.
  private tearStep(dL: number, beta: number): TapeEvent | null {
    let ev: TapeEvent | null = null;
    const wasFull = this.pinL && this.pinR;
    const r0 = R0 + Math.max(0, this.v - 0.006) * 60;
    const s = this.v / V_TEAR;
    if (this.pinL && s * (1 + 1.6 * Math.max(0, beta)) > 1) {
      this.pinL = false;
      this.uL = 0.004;
      ev = "tear-start";
    }
    if (this.pinR && s * (1 + 1.6 * Math.max(0, -beta)) > 1) {
      this.pinR = false;
      this.uR = 0.996;
      ev = "tear-start";
    }
    if (!this.pinL) {
      this.uL += (dL * (r0 + KB * beta)) / WD;
      if (this.uL <= 0) {
        this.uL = 0;
        this.pinL = true;
        ev = "edge-clean";
      }
    }
    if (!this.pinR) {
      this.uR += (dL * (KB * beta - r0)) / WD;
      if (this.uR >= 1) {
        this.uR = 1;
        this.pinR = true;
        ev = "edge-clean";
      }
    }
    if (!wasFull && this.pinL && this.pinR) ev = "full-width";
    if (this.uR - this.uL < 0.02) return this.snap();
    return ev;
  }

  private detachStrip(fall: boolean) {
    const mat = (this.strip.material as THREE.MeshPhysicalMaterial).clone();
    const mesh = new THREE.Mesh(this.stripGeo.clone(), mat);
    this.rollG.add(mesh);
    this.falling.push({ mesh, t: 0, vy: fall ? 0.0022 : 0 });
  }

  private resetPeel() {
    this.phase = "find";
    this.mode = "none";
    this.L = 0;
    this.hist = [];
    this.uL = 0;
    this.uR = 1;
    this.pinL = this.pinR = true;
    this.liftL = this.liftA = this.liftB = 0;
    this.v = 0;
    this.strip.visible = false;
  }

  private snap(): TapeEvent {
    const thF = this.phiT + this.rho;
    this.detachStrip(true);
    this.tears++;
    this.lost++;
    this.torn = (this.uL + this.uR) / 2;
    this.crinkle = false;
    this.newEnd(thF);
    this.resetPeel();
    return "snap";
  }

  private letGo(): TapeEvent {
    const thF = this.phiT + this.rho;
    const tangled = this.cm > 6 && this.r() < 0.35;
    this.detachStrip(tangled);
    this.torn = null;
    if (tangled) {
      this.lost++;
      this.crinkle = false;
      this.newEnd(thF);
      this.resetPeel();
      return "tangled";
    }
    this.crinkle = true;
    this.newEnd(thF - (this.c * this.L) / R);
    this.resetPeel();
    return "stuck-back";
  }

  private histAt(m: number): [number, number] {
    const h = this.hist;
    let lo = 0;
    let hi = h.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (h[mid].m <= m) lo = mid;
      else hi = mid - 1;
    }
    return [h[lo].l, h[lo].r];
  }

  private buildRibbon(tip: THREE.Vector3, phiF: number, L: number, widthAt: (m: number) => [number, number], stress: number) {
    const RF = R + 0.004;
    const Fy = RF * Math.sin(phiF);
    const Fz = RF * Math.cos(phiF);
    const dirY = -this.c * Math.cos(phiF);
    const dirZ = this.c * Math.sin(phiF);
    const dyz = Math.hypot(tip.y - Fy, tip.z - Fz);
    const [l0, r0] = widthAt(0);
    const xc0 = -HALF + ((l0 + r0) / 2) * WD;
    const chord = Math.hypot(dyz, tip.x - xc0);
    const sag = Math.sqrt(Math.max(0, L * L - chord * chord)) * 0.55;
    const My = Fy + dirY * dyz * 0.45 - sag;
    const Mz = Fz + dirZ * dyz * 0.45;
    const pos = this.stripGeo.getAttribute("position") as THREE.BufferAttribute;
    const col = this.stripGeo.getAttribute("color") as THREE.BufferAttribute;
    for (let i = 0; i <= NS; i++) {
      const t = i / NS;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c2 = t * t;
      const y = a * tip.y + b * My + c2 * Fy;
      const z = a * tip.z + b * Mz + c2 * Fz;
      const [l, r] = widthAt(t * L);
      const shift = (tip.x - xc0) * (1 - t);
      pos.setXYZ(i * 2, -HALF + l * WD + shift, y, z);
      pos.setXYZ(i * 2 + 1, -HALF + r * WD + shift, y, z);
      const wh = stress * clamp((t - 0.78) / 0.22, 0, 1);
      const cr = 0.88 + 0.12 * wh;
      const cg = 0.76 + 0.24 * wh;
      const cb = 0.55 + 0.45 * wh;
      col.setXYZ(i * 2, cr, cg, cb);
      col.setXYZ(i * 2 + 1, cr, cg, cb);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.stripGeo.computeVertexNormals();
    this.stripGeo.computeBoundingSphere();
    this.strip.visible = true;
  }

  frame() {
    if (this.mode !== "nail" && this.mode !== "spin" && this.phase !== "peel" && Math.abs(this.omega) > 1e-5) {
      this.rho += this.omega;
      this.omega *= 0.93;
    }
    this.spinG.rotation.x = this.rho;
    this.scene.updateMatrixWorld();

    // The end shows itself only as a glint when its little step faces the light.
    const showEdge = this.phase === "find" || this.phase === "lift" || this.phase === "tab";
    const th = this.end;
    const m3 = new THREE.Matrix3().getNormalMatrix(this.spinG.matrixWorld);
    const nLoc = new THREE.Vector3(0, Math.sin(th), Math.cos(th));
    const tLoc = new THREE.Vector3(0, Math.cos(th), -Math.sin(th)).multiplyScalar(-this.c);
    const nStep = tLoc.multiplyScalar(0.75).add(nLoc.clone().multiplyScalar(0.65)).applyMatrix3(m3).normalize();
    nLoc.applyMatrix3(m3).normalize();
    const ep = this.glint.getWorldPosition(new THREE.Vector3());
    const V = this.camera.position.clone().sub(ep).normalize();
    const H = this.key.position.clone().normalize().add(V).normalize();
    const g = Math.pow(Math.max(0, nStep.dot(H)), this.light ? 10 : 28);
    const vis = showEdge && nLoc.dot(V) > 0.08;
    const gm = this.glint.material as THREE.MeshBasicMaterial;
    gm.opacity = vis ? Math.min(1, (this.light ? 0.12 : 0) + g * (this.light ? 1 : 0.8) + (this.crinkle ? 0.12 : 0)) : 0;
    (this.hair.material as THREE.MeshBasicMaterial).opacity = vis ? 0.14 + (this.crinkle ? 0.18 : 0) : 0;
    this.dust.visible = vis;

    if ((this.phase === "lift" && this.liftL > 0) || this.phase === "tab") {
      const tip = this.tabTipLocal();
      const phiF = this.end - this.rho + this.c * this.liftL;
      const RF = R + 0.004;
      const xc = -HALF + ((this.liftA + this.liftB) / 2) * WD;
      const L = Math.hypot(tip.x - xc, tip.y - RF * Math.sin(phiF), tip.z - RF * Math.cos(phiF));
      this.buildRibbon(tip, phiF, L, () => [this.liftA, this.liftB], 0);
    } else if (this.phase === "peel" || this.phase === "won") {
      const stress = clamp((this.v - 0.006) / (V_TEAR - 0.006), 0, 1);
      this.buildRibbon(this.local(this.P), this.phiT, this.L, (m) => this.histAt(m), this.phase === "won" ? 0 : stress);
    } else this.strip.visible = false;
    if (this.mode !== "pull") this.v *= 0.85;

    for (const f of this.falling) {
      f.t++;
      const life = f.vy ? 70 : 16;
      f.mesh.position.y -= f.vy * f.t;
      f.mesh.rotation.x += f.vy * 2;
      (f.mesh.material as THREE.MeshPhysicalMaterial).opacity = 0.62 * Math.max(0, 1 - f.t / life);
      if (f.t >= life) {
        this.rollG.remove(f.mesh);
        f.mesh.geometry.dispose();
        (f.mesh.material as THREE.Material).dispose();
      }
    }
    this.falling = this.falling.filter((f) => f.t < (f.vy ? 70 : 16));

    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }

  leave() {
    this.hover = null;
  }

  overlay(): Overlay {
    const o: Overlay = { thumb: null, pinch: null, tab: null, label: null };
    if (this.mode === "nail") o.thumb = { x: this.pressX, y: this.lastY, pressed: true };
    else if (this.mode === "none" && this.hover && (this.phase === "find" || this.phase === "lift")) {
      if (this.hitRoll(this.hover.x, this.hover.y)) o.thumb = { x: this.hover.x, y: this.hover.y, pressed: false };
    }
    if (this.phase === "tab") o.tab = this.project(this.rollG.localToWorld(this.tabTipLocal()));
    if (this.phase === "peel" || this.phase === "won") {
      const s = this.project(this.P);
      if (this.mode === "pull") o.pinch = s;
      else if (this.phase === "peel") o.tab = s;
      o.label = { x: s.x, y: s.y, text: `${Math.floor(this.cm)} cm` };
    }
    return o;
  }

  // Development helper: where the hidden end is, in screen pixels (front-facing only).
  debugEnd() {
    this.scene.updateMatrixWorld();
    const p = this.glint.getWorldPosition(new THREE.Vector3());
    return { ...this.project(p), c: this.c, end: this.end, rho: this.rho, phase: this.phase };
  }

  dispose() {
    for (const f of this.falling) {
      f.mesh.geometry.dispose();
      (f.mesh.material as THREE.Material).dispose();
    }
    this.outer.geometry.dispose();
    this.tapeMat.dispose();
    this.stripGeo.dispose();
    (this.strip.material as THREE.Material).dispose();
    (this.glint.material as THREE.Material).dispose();
    (this.hair.material as THREE.Material).dispose();
    this.hair.geometry.dispose();
    this.dust.geometry.dispose();
    (this.dust.material as THREE.Material).dispose();
    for (const d of this.disposables) d.dispose();
    this.envTex.dispose();
    this.renderer.dispose();
  }
}
