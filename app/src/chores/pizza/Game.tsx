import { useEffect, useRef, useState } from "react";
import { Pizza, W, H, CX, CY, R, SLICES, pizzaTier, ratioText, type CutEvent, type PizzaResult } from "./engine";
import { ShareButton, SaveReceipt } from "../../components/share/ShareButton";

const STEPS = ["Cut it in half", "Get it to quarters", "Make eight slices"];
const CUTS = ["Cut.", "Another cut.", "The cutter is getting confident.", "Keep going."];
const LINES: Partial<Record<CutEvent, string>> = {
  miss: "That was the board.",
  center: "Right through the middle. So far.",
  halves: "Halves. Roughly.",
  quarters: "Quarters, more or less.",
  crumb: "That made a crumb.",
  eight: "Eight. Let's measure.",
};

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

type Result = PizzaResult & { time: number };

export function PizzaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plateRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Pizza | null>(null);
  const startRef = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [round, setRound] = useState(0);
  const [time, setTime] = useState(0);
  const [count, setCount] = useState({ cuts: 0, pieces: 1 });
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<Result | null>(null);
  resultRef.current = result;

  const say = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };
  // A short, dry crunch of filtered noise.
  const crunch = () => {
    try {
      const AC = window.AudioContext;
      if (!AC) return;
      const ac = (audio.current ??= new AC());
      const len = Math.floor(ac.sampleRate * 0.16);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1800;
      const g = ac.createGain();
      g.gain.value = 0.05;
      src.connect(f).connect(g).connect(ac.destination);
      src.start();
    } catch {
      /* sound is optional */
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const game = new Pizza(Date.now());
    gameRef.current = game;
    startRef.current = null;
    let raf = 0;
    let finishAt = 0;
    let cutLine = 0;

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

    const onDown = (e: PointerEvent) => {
      if (resultRef.current || game.served) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      if (startRef.current === null) startRef.current = performance.now();
      const p = toWorld(e);
      game.drag = { a: p, b: p };
    };
    const onMove = (e: PointerEvent) => {
      if (game.drag) game.drag.b = toWorld(e);
    };
    const onUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      const d = game.drag;
      game.drag = null;
      if (!d || e.type === "pointercancel") return;
      const ev = game.cut(d.a, d.b);
      if (!ev) return;
      if (ev !== "miss") crunch();
      setCount({ cuts: game.cuts, pieces: game.count });
      say(LINES[ev] ?? CUTS[cutLine++ % CUTS.length]);
      if (ev === "eight") finishAt = performance.now() + 1500;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const frame = () => {
      game.step();
      if (finishAt && performance.now() > finishAt) {
        finishAt = 0;
        const t = startRef.current === null ? 0 : performance.now() - startRef.current;
        setTime(t);
        setResult({ ...game.result(), time: t });
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sc = canvas.width / W;
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      game.draw(ctx, { labels: game.served });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const ui = window.setInterval(() => {
      if (startRef.current !== null && !resultRef.current && !game.served) setTime(performance.now() - startRef.current);
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

  // The cut pizza, labelled, inside the result card.
  useEffect(() => {
    const canvas = plateRef.current;
    const ctx = canvas?.getContext("2d");
    const game = gameRef.current;
    if (!result || !canvas || !ctx || !game) return;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const half = R * 1.2;
    const s = canvas.width / (half * 2);
    ctx.setTransform(s, 0, 0, s, -(CX - half) * s, -(CY - half) * s);
    game.draw(ctx, { labels: true, labelScale: 1.8 });
  }, [result]);

  const fresh = () => {
    setResult(null);
    setTime(0);
    setCount({ cuts: 0, pieces: 1 });
    setToast(null);
    setRound((r) => r + 1);
  };

  const shareText = () => {
    if (!result) return "";
    const text = `I cut a pizza into ${SLICES}. The biggest slice is ${ratioText(result.ratio)}× the smallest.`;
    return text;
  };

  const done = [count.pieces >= 2, count.pieces >= 4, count.pieces >= SLICES];
  const tier = result ? pizzaTier(result.ratio) : null;

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
      <h1 className="serif play-title">Cut the Pizza Equally</h1>
      <p className="play-lede">
        Eight people, one pizza. Drag across it to cut. The cutter only goes straight, and it does not stop at the
        edge of your drag. Make eight equal slices.
      </p>
      <div className="stage pizza-stage">
        <canvas ref={canvasRef} onContextMenu={(e) => e.preventDefault()} aria-label="A pizza on a round wooden board, waiting to be cut." />
        {toast && <div className="toast">{toast}</div>}
        {!result && (
          <div className="meter" aria-live="off">
            {count.cuts} {count.cuts === 1 ? "cut" : "cuts"} · {count.pieces} {count.pieces === 1 ? "piece" : "pieces"}
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
            New pizza
          </button>
          <ShareButton slug="pizza" title="Cut the Pizza Equally" text={() => "Eight people, one pizza, eight equal slices. Apparently."} />
        </div>
      </div>
      {result && tier && (
        <div className="result-veil" role="dialog" aria-modal="true">
          <div className="result pizza-result">
            <div className="result-label">Biggest slice vs smallest</div>
            <div className="serif result-score">{ratioText(result.ratio)}×</div>
            <div className="serif result-tier">{tier.tier}</div>
            <p className="result-line">
              The biggest slice is {ratioText(result.ratio)} times the smallest. {tier.line}
            </p>
            <canvas ref={plateRef} className="pizza-plate" aria-label={`The cut pizza. Slices: ${result.pcts.map((p) => `${p.toFixed(1)}%`).join(", ")}.`} />
            <div className="result-stats">
              <div>
                Biggest<strong>{result.biggest.toFixed(1)}%</strong>
              </div>
              <div>
                Smallest<strong>{result.smallest.toFixed(1)}%</strong>
              </div>
              <div>
                Average miss<strong>{Math.round(result.off)}%</strong>
              </div>
              <div>
                Crumbs<strong>{result.crumbs}</strong>
              </div>
              <div>
                Cuts<strong>{result.cuts}</strong>
              </div>
              <div>
                Time<strong>{fmt(result.time)}</strong>
              </div>
            </div>
            <div className="result-row">
              <ShareButton slug="pizza" title="Cut the Pizza Equally" text={shareText}>
                Share
              </ShareButton>
              <SaveReceipt slug="pizza" />
              <button className="btn-again" onClick={fresh}>
                Another pizza
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
