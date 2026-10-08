import { useEffect, useRef, useState } from "react";
import { MugGame as Engine, W, H, START_ML, mugTier, type MugEvent, type MugResult } from "../../game/mug";
import { ShareButton, SaveReceipt } from "../../components/share/ShareButton";

const STEPS = ["Pick up the mug (press and hold)", "Under the lamp, over the plant", "Let go just above the desk", "Before the call starts"];
const SPILLS = ["A drop. The rug saw that.", "There goes some.", "That one landed.", "The floor is having coffee too."];
const LINES: Partial<Record<MugEvent, string>> = {
  pickup: "Careful. It is very full.",
  lamp: "You hit the lamp.",
  plant: "Leaves in your coffee. Probably fine.",
  cat: "You spilled on the cat. The cat has left the room.",
  putback: "Back on the counter. Fair enough.",
  dropped: "You let go in mid-air.",
  late: "The call started. You are on mute, holding a mug.",
  draft: "There is a draft. The lamp has noticed.",
  leap: "The cat has decided to also go to the desk. Now.",
  catBump: "You bumped into the cat. In mid-air.",
  planeIn: "A paper airplane. Nobody admits to it.",
  planeHit: "Hit by a paper airplane. Mostly emotionally.",
  vacuum: "The robot vacuum has started its rounds.",
  vacCat: "The vacuum woke the cat. The cat has left the room.",
  cord: "You walked into the cord. The lamp is swinging now. So is the coffee.",
};
const TONES: Partial<Record<MugEvent, [number, number]>> = {
  spill: [520, 0.03],
  lamp: [1250, 0.05],
  plant: [300, 0.03],
  cat: [700, 0.04],
  dropped: [160, 0.08],
  tick: [980, 0.04],
  late: [330, 0.06],
  catBump: [620, 0.05],
  planeHit: [880, 0.04],
  cord: [1100, 0.04],
};

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function MugGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Engine | null>(null);
  const startRef = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const spills = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const [time, setTime] = useState(0);
  const [meter, setMeter] = useState({ ml: START_ML, temp: 72, call: 0, started: false });
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<MugResult | null>(null);
  const resultRef = useRef<MugResult | null>(null);
  resultRef.current = result;

  const say = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };
  const tone = (ev: MugEvent) => {
    const t = TONES[ev];
    if (!t) return;
    try {
      const AC = window.AudioContext;
      if (!AC) return;
      const ac = (audio.current ??= new AC());
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = ev === "dropped" ? "square" : "sine";
      o.frequency.value = t[0] * (0.9 + Math.random() * 0.2);
      g.gain.setValueAtTime(t[1], ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (ev === "lamp" ? 0.4 : 0.09));
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.45);
    } catch {
      /* sound is optional */
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const game = new Engine(Date.now());
    gameRef.current = game;
    startRef.current = null;
    spills.current = 0;
    let raf = 0;
    let finishAt = 0;

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
    const finish = () => {
      if (resultRef.current) return;
      const t = startRef.current === null ? 0 : performance.now() - startRef.current;
      setTime(t);
      setDone((d) => [d[0], d[1], !game.dropped, !game.dropped && game.callLeft > 0]);
      setResult({ ml: game.ml, temp: Math.round(game.temp), rug: game.rugStains, cat: game.cat, time: t, coaster: game.onCoaster, dropped: game.dropped, spare: game.callLeft });
    };
    const handle = (ev: MugEvent | null) => {
      if (!ev) return;
      tone(ev);
      if (ev === "delivered") return finish();
      if (ev === "dropped") finishAt = performance.now() + 1400;
      if (ev === "spill") {
        say(SPILLS[Math.min(spills.current, SPILLS.length - 1)]);
        spills.current++;
        return;
      }
      const line = LINES[ev];
      if (line) say(line);
    };
    const onDown = (e: PointerEvent) => {
      if (resultRef.current) return;
      const p = toWorld(e);
      const ev = game.down(p.x, p.y);
      if (!ev) return;
      if (startRef.current === null) startRef.current = performance.now();
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "none";
      handle(ev);
    };
    const onMove = (e: PointerEvent) => {
      const p = toWorld(e);
      if (game.state === "held") game.move(p.x, p.y);
      else canvas.style.cursor = game.state === "rest" && game.hitMug(p.x, p.y) ? "grab" : "default";
    };
    const onUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = "default";
      handle(game.up());
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const frame = () => {
      for (const ev of game.step()) handle(ev);
      if (finishAt && performance.now() > finishAt) {
        finishAt = 0;
        finish();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sc = canvas.width / W;
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      game.draw(ctx);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const ui = window.setInterval(() => {
      setMeter({ ml: game.ml, temp: Math.round(game.temp), call: game.callLeft, started: game.started });
      setDone((prev) => {
        const next = [prev[0] || game.started, prev[1] || game.x > 700, prev[2] || game.delivered, prev[3] || (game.delivered && game.callLeft > 0)];
        return next.some((v, i) => v !== prev[i]) ? next : prev;
      });
      if (startRef.current !== null && !resultRef.current) setTime(performance.now() - startRef.current);
    }, 150);
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

  const fresh = () => {
    setResult(null);
    setDone(STEPS.map(() => false));
    setTime(0);
    setMeter({ ml: START_ML, temp: 72, call: 0, started: false });
    setToast(null);
    setRound((r) => r + 1);
  };

  const tier = result ? mugTier(result) : null;
  const catLabel = result ? { asleep: "Still asleep", awake: "Woken up", gone: "Left the room", leap: "Mid-air", desk: "On the desk" }[result.cat] : "";
  const callLabel = result ? (result.dropped ? "Missed" : result.spare >= 0 ? `On time, ${Math.floor(result.spare)}s spare` : `Late by ${Math.ceil(-result.spare)}s`) : "";

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
      <h1 className="serif play-title">Carry a Full Mug</h1>
      <p className="play-lede">
        Freshly poured, right to the brim, and your call starts in a few seconds. Press and hold to pick it up, carry it
        across the room, and let go just above the desk. Try not to spill on the rug. Or the cat. Things happen.
      </p>
      <div className="stage stage-room">
        <canvas ref={canvasRef} onContextMenu={(e) => e.preventDefault()} aria-label="A room with a full mug on the kitchen counter and a desk on the far side." />
        {toast && <div className="toast">{toast}</div>}
        {!result && (
          <div className="meter" aria-live="off">
            {meter.ml} ml · {meter.temp}°C
            {meter.started && (meter.call > 0 ? ` · call in ${Math.ceil(meter.call)}s` : " · call started")}
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
          <button className="btn-shake" onClick={fresh}>
            Pour a new one
          </button>
          <ShareButton slug="mug" title="Carry a Full Mug" />
        </div>
      </div>
      {result && tier && (
        <div className="result-veil" role="dialog" aria-modal="true">
          <div className="result">
            <div className="result-label">Coffee delivered</div>
            <div className="serif result-score">{Math.round((result.ml / START_ML) * 100)}%</div>
            <div className="serif result-tier">{tier.tier}</div>
            <p className="result-line">{tier.line}</p>
            <div className="result-stats">
              <div>
                Time<strong>{fmt(result.time)}</strong>
              </div>
              <div>
                Temperature<strong>{result.dropped ? "Floor" : `${result.temp}°C`}</strong>
              </div>
              <div>
                Rug stains<strong>{result.rug}</strong>
              </div>
              <div>
                The cat<strong>{catLabel}</strong>
              </div>
              <div>
                The call<strong>{callLabel}</strong>
              </div>
              <div>
                Coaster<strong>{result.dropped ? "No mug" : result.coaster ? "On it" : "Missed"}</strong>
              </div>
            </div>
            <div className="result-row">
              <button className="btn-again" onClick={fresh}>
                Pour another
              </button>
              <ShareButton slug="mug" title="Carry a Full Mug" />
              <SaveReceipt slug="mug" />
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
