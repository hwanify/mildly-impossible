import { useEffect, useRef, useState } from "react";
import { TapeRoll, W, H, GOAL_CM, tapeTier, type TapeEvent, type TapeResult } from "../../game/tapeRoll";

const STEPS = ["Find the edge with your thumbnail", "Lift it, gently", `Pull off ${GOAL_CM} cm in one piece`];

const LINES: Partial<Record<TapeEvent, string>> = {
  "bump-fast": "Too fast. Something was there.",
  catch: "Your nail caught the edge. Keep going, gently.",
  slip: "Slipped. It stuck back down.",
  lifted: "There is a tab. Grab it and pull.",
  tear: "Uh oh. It is tearing.",
  snap: "It tore off diagonally. The new end is somewhere on the roll.",
};

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function TapeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rollRef = useRef<TapeRoll | null>(null);
  const startRef = useRef<number | null>(null);
  const usedLight = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const [time, setTime] = useState(0);
  const [cm, setCm] = useState(0);
  const [light, setLight] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<TapeResult | null>(null);
  const resultRef = useRef<TapeResult | null>(null);
  resultRef.current = result;

  const say = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };

  const tick = (kind: TapeEvent) => {
    try {
      const AC = window.AudioContext;
      if (!AC) return;
      const ac = (audio.current ??= new AC());
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "triangle";
      o.frequency.value = kind === "catch" || kind === "lifted" ? 1500 : kind === "snap" || kind === "tear" ? 220 : 880;
      g.gain.setValueAtTime(0.05, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.06);
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.07);
    } catch {
      /* sound is optional */
    }
    navigator.vibrate?.(kind === "catch" || kind === "snap" ? 25 : 8);
  };

  const finish = (roll: TapeRoll, scissors: boolean) => {
    const t = startRef.current === null ? 0 : performance.now() - startRef.current;
    setTime(t);
    setDone([true, true, true]);
    setResult({ time: t, tears: roll.tears, slips: roll.slips, bumps: roll.bumps, light: usedLight.current, scissors });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const roll = new TapeRoll(Date.now());
    rollRef.current = roll;
    startRef.current = null;
    usedLight.current = false;
    let raf = 0;

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
    const handle = (ev: TapeEvent | null) => {
      if (!ev) return;
      tick(ev);
      if (ev === "won") {
        finish(roll, false);
        return;
      }
      if (ev === "bump") {
        const n = roll.wrongBumps;
        say(
          n <= 1
            ? "A tiny ridge. Your nail slid right over it."
            : n === 2
              ? "Same ridge again. Nothing to grip."
              : "Maybe your nail needs to come at it from the other side.",
        );
        return;
      }
      const line = LINES[ev];
      if (line) say(line);
    };
    const onDown = (e: PointerEvent) => {
      const p = toWorld(e);
      if (startRef.current === null) startRef.current = performance.now();
      handle(roll.down(p.x, p.y, e.timeStamp));
      if (roll.touching || roll.holding) {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
      }
    };
    const onMove = (e: PointerEvent) => {
      const events = e.getCoalescedEvents?.() ?? [e];
      for (const ce of events.length ? events : [e]) {
        const p = toWorld(ce);
        handle(roll.move(p.x, p.y, ce.timeStamp));
      }
      canvas.style.cursor = roll.holding ? "grabbing" : roll.phase === "tab" || roll.phase === "peel" ? "grab" : "default";
    };
    const onUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      handle(roll.up());
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const frame = () => {
      roll.step();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sc = canvas.width / W;
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      roll.draw(ctx);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const ui = window.setInterval(() => {
      const ph = roll.phase;
      setDone((prev) => {
        const next = [prev[0] || ph !== "find", prev[1] || ph === "tab" || ph === "peel" || ph === "won", prev[2] || ph === "won"];
        return next.some((v, i) => v !== prev[i]) ? next : prev;
      });
      setCm(ph === "peel" || ph === "won" ? Math.floor(roll.cm) : 0);
      if (startRef.current !== null && !resultRef.current) setTime(performance.now() - startRef.current);
    }, 200);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(ui);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [round]);

  const toggleLight = () => {
    const roll = rollRef.current;
    if (!roll) return;
    roll.light = !roll.light;
    if (roll.light) usedLight.current = true;
    setLight(roll.light);
  };
  const scissors = () => {
    const roll = rollRef.current;
    if (!roll || resultRef.current) return;
    finish(roll, true);
  };
  const fresh = () => {
    setResult(null);
    setDone(STEPS.map(() => false));
    setTime(0);
    setCm(0);
    setLight(false);
    setToast(null);
    setRound((r) => r + 1);
  };

  const tier = result ? tapeTier(result) : null;

  return (
    <>
      <div className="topbar">
        <a href="/" className="back">
          ← Mildly Impossible
        </a>
        <span className="clock" aria-label="Elapsed time">
          {fmt(time)}
        </span>
      </div>
      <h1 className="serif play-title">Find the End of the Tape</h1>
      <p className="play-lede">
        A roll of clear packing tape. The end is in there somewhere. Run your thumbnail around the rim to feel for it,
        lift it, then pull off {GOAL_CM} cm without tearing it.
      </p>
      <div className="stage">
        <canvas
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="A roll of tape. Drag along its rim to feel for the end, then pull the tab."
        />
        {toast && <div className="toast">{toast}</div>}
        {cm > 0 && !result && (
          <div className="meter" aria-live="polite">
            {cm} / {GOAL_CM} cm
          </div>
        )}
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
          <button className="btn-new" onClick={fresh}>
            New roll
          </button>
          <button className="btn-ball" onClick={scissors}>
            Give up and use scissors
          </button>
          <button className={light ? "btn-light on" : "btn-light"} onClick={toggleLight} aria-pressed={light}>
            {light ? "Put it down" : "Hold it up to the light"}
          </button>
        </div>
      </div>
      {result && tier && (
        <div className="result-veil" role="dialog" aria-modal="true">
          <div className="result">
            <div className="result-label">{result.scissors ? "You cut it" : "You have usable tape"}</div>
            <div className="serif result-score">{fmt(result.time)}</div>
            <div className="serif result-tier">{tier.tier}</div>
            <p className="result-line">{tier.line}</p>
            <div className="result-stats">
              <div>
                Tears<strong>{result.tears}</strong>
              </div>
              <div>
                Slips<strong>{result.slips}</strong>
              </div>
              <div>
                Ridges felt<strong>{result.bumps}</strong>
              </div>
              <div>
                Used the light<strong>{result.light ? "Yes" : "No"}</strong>
              </div>
            </div>
            <div className="result-row">
              <button className="btn-again" onClick={fresh}>
                Another roll
              </button>
              <a className="btn-keep" href="/">
                All tasks
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
