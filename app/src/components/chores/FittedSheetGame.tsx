import { useEffect, useRef, useState } from "react";
import { Sheet, W, H, tierFor, type Judge } from "../../game/fittedSheet";

const STEPS = [
  "Tuck one corner into its neighbor",
  "Tuck the other two together",
  "Bring all four corners together",
  "Square it up and submit",
];

const WELD_LINES: Record<number, string> = {
  2: "Tucked. That is one pocket.",
  3: "Three corners. You are out of hands.",
  4: "All four corners. This is where most people give up.",
};

type Result = Judge & { time: number; shakes: number };

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function FittedSheetGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sheetRef = useRef<Sheet | null>(null);
  const startRef = useRef<number | null>(null);
  const shakesRef = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const [time, setTime] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const resultRef = useRef<Result | null>(null);
  resultRef.current = result;

  const say = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sheet = new Sheet(Date.now());
    sheetRef.current = sheet;
    startRef.current = null;
    shakesRef.current = 0;
    let hover = -1;
    let raf = 0;
    let dpr = 1;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      const p = toWorld(e);
      if (!sheet.grab(p.x, p.y)) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
      if (startRef.current === null) startRef.current = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      const p = toWorld(e);
      if (sheet.held >= 0) {
        sheet.move(p.x, p.y);
        return;
      }
      hover = sheet.nearCorner(p.x, p.y);
      canvas.style.cursor = sheet.pick(p.x, p.y) >= 0 ? "grab" : "default";
    };
    const onUp = (e: PointerEvent) => {
      if (sheet.held < 0) return;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      const size = sheet.release();
      if (size >= 2) say(WELD_LINES[size] ?? WELD_LINES[4]);
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const frame = () => {
      sheet.step();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sc = canvas.width / W;
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      sheet.draw(ctx, hover);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const ui = window.setInterval(() => {
      const st = sheet.stats();
      setDone((prev) => {
        const next = [prev[0] || st.maxGroup >= 2, prev[1] || st.welded >= 4, prev[2] || st.maxGroup >= 4, prev[3]];
        return next.some((v, i) => v !== prev[i]) ? next : prev;
      });
      if (startRef.current !== null && !resultRef.current) setTime(performance.now() - startRef.current);
    }, 250);

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

  const finish = () => {
    const s = sheetRef.current;
    if (!s || s.anim) return;
    setResult({ ...s.judge(), time, shakes: shakesRef.current });
    setDone((d) => d.map((v, i) => (i === 3 ? true : v)));
  };
  const shake = () => {
    const s = sheetRef.current;
    if (!s || s.frozen) return;
    s.shake();
    shakesRef.current += 1;
    if (startRef.current === null) startRef.current = performance.now();
    say("Shaken out. Every corner came loose.");
  };
  const ball = () => {
    const s = sheetRef.current;
    if (!s || s.frozen) return;
    s.ball(Date.now());
    window.setTimeout(() => setResult({ ...s.judge(), time, shakes: shakesRef.current }), 850);
  };
  const fresh = () => {
    setResult(null);
    setDone(STEPS.map(() => false));
    setTime(0);
    setToast(null);
    setRound((r) => r + 1);
  };

  const tier = result ? tierFor(result) : null;

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
      <h1 className="serif play-title">Fold a Fitted Sheet</h1>
      <p className="play-lede">
        Spread out flat, elastic corners and all. Drag a corner onto another corner to tuck it in. Submit when it
        looks like a rectangle.
      </p>
      <div className="stage">
        <canvas ref={canvasRef} onContextMenu={(e) => e.preventDefault()} aria-label="A fitted sheet. Drag with your mouse or finger to fold it." />
        {toast && <div className="toast">{toast}</div>}
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
            New sheet
          </button>
          <button className="btn-ball" onClick={ball}>
            Give up and ball it
          </button>
          <button className="btn-shake" onClick={shake}>
            Shake it out
          </button>
          <button className="btn-done" onClick={finish} disabled={!!result}>
            Done folding
          </button>
        </div>
      </div>
      {result && tier && (
        <div className="result-veil" role="dialog" aria-modal="true">
          <div className="result">
            <div className="result-label">Neatness score</div>
            <div className="serif result-score">{result.score}</div>
            <div className="serif result-tier">{tier.tier}</div>
            <p className="result-line">{tier.line}</p>
            <div className="result-stats">
              <div>
                Time<strong>{fmt(result.time)}</strong>
              </div>
              <div>
                Shakes<strong>{result.shakes}</strong>
              </div>
              <div>
                Squareness<strong>{Math.round(result.rect * 100)}%</strong>
              </div>
              <div>
                Compactness<strong>{Math.round(result.compact * 100)}%</strong>
              </div>
            </div>
            <div className="result-row">
              <button className="btn-again" onClick={fresh}>
                Another sheet
              </button>
              {!result.ball && (
                <button className="btn-keep" onClick={() => setResult(null)}>
                  Keep tidying
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
