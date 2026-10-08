import { useEffect, useRef, useState } from "react";
import { Balance, W, H, KINDS, fmtMass, type BalanceEvent, type Kind } from "./engine";
import { ShareButton, ShareCoupon, SaveReceipt } from "../../components/share/ShareButton";

const STEPS = ["Put something on both sides", "Get within a kilogram", "Get within a gram", "Make it perfectly level"];
const FIRST: Partial<Record<Kind, string>> = {
  ant: "One ant. It counts.",
  rice: "A grain of rice. Uncooked, for accuracy.",
  paperclip: "A paperclip. Office supplies are a valid unit.",
  egg: "Gently.",
  apple: "One apple. Roughly.",
  mug: "An empty mug. You checked.",
  cat: "The cat did not agree to this.",
  person: "They agreed to this. Mostly.",
  piano: "It plays a low note on the way down.",
  car: "Handbrake on.",
  elephant: "It stands very still.",
  whale: "The scale creaks, politely.",
  house: "Somebody's whole house.",
};

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Balance | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const [readout, setReadout] = useState({ left: "", right: "", text: "Both pans are empty. Technically level.", count: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [level, setLevel] = useState<{ total: number } | null>(null);
  const levelRef = useRef(level);
  levelRef.current = level;

  const say = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };
  // A soft thud, lower for heavier things.
  const thud = (g: number, gain = 0.06) => {
    try {
      const AC = window.AudioContext;
      if (!AC) return;
      const ac = (audio.current ??= new AC());
      const o = ac.createOscillator();
      const v = ac.createGain();
      const f = Math.max(45, 900 - Math.log10(Math.max(g, 0.001) / 0.001) * 75);
      o.type = "sine";
      o.frequency.setValueAtTime(f * 1.4, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(f, ac.currentTime + 0.08);
      v.gain.setValueAtTime(gain, ac.currentTime);
      v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25);
      o.connect(v).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.3);
    } catch {
      /* sound is optional */
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const game = new Balance(Date.now());
    gameRef.current = game;
    // the physics engine is only needed here, so it loads with the game rather than with the hub
    let alive = true;
    void import("planck").then((pl) => {
      if (alive) game.attach(pl);
    });
    let raf = 0;
    let last = performance.now();
    let lastPour = 0;
    const wandered = new Set<Kind>();

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const toWorld = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    const handle = (ev: BalanceEvent | null) => {
      if (!ev) return;
      if (ev.type === "drop") {
        thud(KINDS[ev.kind].g);
        if (ev.first && FIRST[ev.kind]) say(FIRST[ev.kind]!);
      } else if (ev.type === "pour") {
        const now = performance.now();
        if (now - lastPour > 45) {
          lastPour = now;
          thud(KINDS[ev.kind].g, 0.02);
        }
      } else if (ev.type === "lift") thud(KINDS[ev.kind].g, 0.03);
      else if (ev.type === "left") {
        if (!wandered.has(ev.kind)) {
          wandered.add(ev.kind);
          say(ev.kind === "ant" ? "An ant has wandered off. They do that." : "The cat has left the scale. It had other plans.");
        }
      } else if (ev.type === "fell") {
        say("It fell off. It's gone now.");
      } else if (ev.type === "level") {
        say("Perfectly level.");
        setLevel({ total: game.sums[0] + game.sums[1] });
      }
    };
    const onDown = (e: PointerEvent) => {
      if (levelRef.current) return;
      const p = toWorld(e);
      game.move(p.x, p.y);
      handle(game.down(p.x, p.y));
      if (game.drag) {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = toWorld(e);
      game.move(p.x, p.y);
      if (!game.drag) canvas.style.cursor = game.cursorAt(p.x, p.y);
    };
    const onUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      handle(game.up());
      const p = toWorld(e);
      canvas.style.cursor = game.cursorAt(p.x, p.y);
      if (e.pointerType !== "mouse") game.leave();
    };
    const onLeave = () => {
      if (!game.drag) game.leave();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      for (const ev of game.step(dt)) handle(ev);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sc = canvas.width / W;
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      game.draw(ctx);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const ui = window.setInterval(() => {
      setReadout({ left: game.counts[0] ? fmtMass(game.sums[0]) : "empty", right: game.counts[1] ? fmtMass(game.sums[1]) : "empty", text: game.describe(), count: game.count });
      const d = Math.abs(game.diff);
      setDone((prev) => {
        const next = [prev[0] || game.both, prev[1] || (game.both && d < 1000), prev[2] || (game.both && d < 1), prev[3] || game.level];
        return next.some((v, i) => v !== prev[i]) ? next : prev;
      });
    }, 120);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearInterval(ui);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const empty = () => {
    gameRef.current?.reset();
    setLevel(null);
    say("Empty again. Level, in a way.");
  };

  return (
    <>
      <div className="topbar">
        <a href="/" className="back">
          ← Mildly Impossible
        </a>
        <span className="clock" aria-label="Things on the scale">
          {readout.count} {readout.count === 1 ? "thing" : "things"} on the scale
        </span>
      </div>
      <h1 className="serif play-title">Balance the Scale</h1>
      <p className="play-lede">
        Drag things from the tray onto either pan until the two sides weigh exactly the same. No two ants weigh the same.
        Hold small things over a pan to pour them. Anything that falls off is gone.
      </p>
      <div className="stage stage-room balance-scale-stage">
        <canvas ref={canvasRef} onContextMenu={(e) => e.preventDefault()} aria-label="A large beam balance with two pans, and a tray of things to weigh: from an ant to a house." />
        {toast && <div className="toast">{toast}</div>}
        <div className="meter balance-scale-meter" aria-live="polite">
          <span>
            Left <b>{readout.left}</b> · Right <b>{readout.right}</b>
          </span>
          <span className="balance-scale-off">{readout.text}</span>
        </div>
      </div>
      <div className="below">
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s} className={done[i] ? "ok" : ""}>
              <b>{done[i] ? "✓" : i + 1}</b>
              {s}
            </li>
          ))}
        </ol>
        <div className="actions">
          <button className="btn-shake" onClick={empty}>
            Empty the scale
          </button>
          <ShareButton slug="balance-scale" title="Balance the Scale" text={() => readout.count ? `${readout.count} ${readout.count === 1 ? "thing" : "things"} on the scale. Left ${readout.left}, right ${readout.right}. ${readout.text}` : "An empty scale. Technically level."}>Show someone the scale</ShareButton>
        </div>
      </div>
      {level && (
        <div className="result-veil" role="dialog" aria-modal="true">
          <div className="result">
            <div className="result-label">Perfectly level</div>
            <div className="serif result-score">{fmtMass(level.total)}</div>
            <div className="serif result-tier">Within half an ant</div>
            <p className="result-line">Nobody will believe you. You don't fully believe it yourself.</p>
            <ShareCoupon slug="balance-scale" title="Balance the Scale" />
            <div className="result-row">
              <button className="btn-again" onClick={() => setLevel(null)}>
                Keep going
              </button>
              <SaveReceipt slug="balance-scale" />
              <button className="btn-keep" onClick={empty}>
                Empty the scale
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
