import { useEffect, useRef, useState } from "react";
import { Peel, W, H, peelTier, type PeelEvent, type PeelResult } from "./engine";

const STEPS = ["Dig a thumbnail into the peel", "Pull slowly. Fast pulls tear", "Get all of the peel off", "Pick off the white bits (optional)"];
const SNAPS = {
  fast: "Too fast. It tore.",
  turn: "Too sharp a turn. It tore.",
  neck: "It got thin, then it got two.",
};
const LINES: Partial<Record<PeelEvent, string>> = {
  dig: "Thumbnail in. A fine citrus mist, mostly in your eye.",
  "dig-again": "Thumbnail in, somewhere new. That is a new piece.",
  start: "A new piece, from the edge.",
  abandon: "You left the other strip hanging. It is its own piece now.",
  free: "That piece came off on its own.",
  long: "Half the peel in one strip. Do not breathe.",
  clean: "Fully peeled. The white bits remain.",
};
const TONES: Partial<Record<PeelEvent, [number, number]>> = { snap: [190, 0.07], pick: [1400, 0.025], dig: [420, 0.03], clean: [660, 0.04] };

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ClementineGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Peel | null>(null);
  const startRef = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const releases = useRef(0);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const [time, setTime] = useState(0);
  const [meter, setMeter] = useState({ pieces: 0, threads: 0, peeled: 0, clean: false });
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<PeelResult | null>(null);
  const resultRef = useRef<PeelResult | null>(null);
  resultRef.current = result;

  const say = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };
  const tone = (ev: PeelEvent) => {
    const t = TONES[ev];
    if (!t) return;
    try {
      const AC = window.AudioContext;
      if (!AC) return;
      const ac = (audio.current ??= new AC());
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = ev === "snap" ? "triangle" : "sine";
      o.frequency.value = t[0] * (0.9 + Math.random() * 0.2);
      g.gain.setValueAtTime(t[1], ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (ev === "clean" ? 0.5 : 0.08));
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.55);
    } catch {
      /* sound is optional */
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const game = new Peel(Date.now());
    gameRef.current = game;
    startRef.current = null;
    releases.current = 0;
    let raf = 0;
    let last = performance.now();

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
    const handle = (ev: PeelEvent | null) => {
      if (!ev) return;
      tone(ev);
      if (ev === "snap") return say(`${SNAPS[game.snapReason]} ${plural(game.pieceCount, "piece", "pieces")}.`);
      if (ev === "release") {
        if (releases.current++ === 0) say("You let go. It waits, hanging.");
        return;
      }
      if (ev === "pick") {
        if (game.clean && game.threads.length === 0) say("Not one white thread left. Suspicious.");
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
      if (game.holding) {
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
      }
      handle(ev);
    };
    const onMove = (e: PointerEvent) => {
      const p = toWorld(e);
      if (game.holding) return game.move(p.x, p.y);
      const h = game.hover(p.x, p.y);
      canvas.style.cursor = h === "hand" ? "grab" : h ? "pointer" : "default";
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

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const wasHolding = game.holding;
      for (const ev of game.step(dt)) handle(ev);
      if (wasHolding && !game.holding) canvas.style.cursor = "default";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sc = canvas.width / W;
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      game.draw(ctx);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const ui = window.setInterval(() => {
      setMeter((m) => {
        const next = { pieces: game.pieceCount, threads: game.threads.length, peeled: Math.floor(game.peeled * 100), clean: game.clean };
        return next.pieces === m.pieces && next.threads === m.threads && next.peeled === m.peeled && next.clean === m.clean ? m : next;
      });
      setDone((prev) => {
        const next = [prev[0] || game.started, prev[1] || game.peeled > 0.25, prev[2] || game.clean, game.clean && game.threads.length === 0];
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

  const eat = () => {
    const game = gameRef.current;
    if (!game || !game.clean || resultRef.current) return;
    const t = startRef.current === null ? 0 : performance.now() - startRef.current;
    setTime(t);
    setResult(game.result(t));
  };

  const fresh = () => {
    setResult(null);
    setDone(STEPS.map(() => false));
    setTime(0);
    setMeter({ pieces: 0, threads: 0, peeled: 0, clean: false });
    setToast(null);
    setRound((r) => r + 1);
  };

  const tier = result ? peelTier(result) : null;

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
      <h1 className="serif play-title">Peel a Clementine in One Piece</h1>
      <p className="play-lede">
        Press into the peel to dig a thumbnail in, then hold and pull the strip around the fruit. The peel only tears so
        fast. Pull faster, or turn too sharply, and it becomes two pieces.
      </p>
      <div className="stage">
        <canvas ref={canvasRef} onContextMenu={(e) => e.preventDefault()} aria-label="A clementine on a plate, seen from above, with an empty patch of table for the peel." />
        {toast && <div className="toast">{toast}</div>}
        {!result && meter.pieces > 0 && (
          <div className="meter" aria-live="off">
            {plural(meter.pieces, "piece", "pieces")} · {plural(meter.threads, "white thread", "white threads")} · {meter.peeled}% peeled
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
            New clementine
          </button>
          <button className="btn-done" onClick={eat} disabled={!meter.clean || !!result}>
            Eat it
          </button>
        </div>
      </div>
      {result && tier && (
        <div className="result-veil" role="dialog" aria-modal="true">
          <div className="result">
            <div className="result-label">Pieces of peel</div>
            <div className="serif result-score">{result.pieces}</div>
            <div className="serif result-tier">{tier.tier}</div>
            <p className="result-line">
              {plural(result.pieces, "piece", "pieces")} of peel, {plural(result.threads, "white thread", "white threads")}. {tier.line}
            </p>
            <div className="result-stats">
              <div>
                Time<strong>{fmt(result.time)}</strong>
              </div>
              <div>
                White threads<strong>{result.threads}</strong>
              </div>
              <div>
                Longest strip<strong>{result.longestCm} cm</strong>
              </div>
              <div>
                Picked off<strong>{result.picked}</strong>
              </div>
            </div>
            <div className="result-row">
              <button className="btn-again" onClick={fresh}>
                Peel another
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
