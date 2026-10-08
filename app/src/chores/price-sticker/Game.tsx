import { useEffect, useRef, useState } from "react";
import { Sticker, W, H, SPEED_MAX, KINDS, stickerTier, type Kind, type StickerEvent, type StickerResult } from "./engine";
import { ShareButton, SaveReceipt } from "../../components/share/ShareButton";


const STEPS = ["Lift an edge", "Work in from a few sides", "Get all of it off", "Rub off what's left"];
const TEARS = ["It tore. Of course it tore.", "Another piece. It's a collection now.", "You now own several stickers.", "This is just confetti with a barcode."];
const LINES: Partial<Record<StickerEvent, string>> = {
  grab: "Slowly. Slower than that.",
  release: "You let go. It waits.",
  slip: "It slipped. Fold it back over itself, don't pull it away.",
  glue: "That left some glue behind.",
  free: "That bit came off on its own.",
  middle: "Not the middle. Find an edge.",
  wide: "That's a lot of sticker at once. Try another edge.",
  strain: "It's going white. Slower.",
  rub: "Rub it off with your thumb.",
  pill: "It's balling up. That's lint now.",
  scratch: "You pick at it with a fingernail.",
  lift: "There. A new corner.",
  stubborn: "It's holding on here. Slower.",
};

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const noise = useRef<AudioBuffer | null>(null);
  const tears = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const [time, setTime] = useState(0);
  const [rubbing, setRubbing] = useState(false);
  const finishRef = useRef<() => void>(() => {});
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<StickerResult | null>(null);
  const resultRef = useRef<StickerResult | null>(null);
  resultRef.current = result;

  const say = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };

  // A short burst of filtered noise: crackle when peeling, a rip when tearing.
  const rasp = (freq: number, gain: number, dur: number, q = 1.2) => {
    try {
      const AC = window.AudioContext;
      if (!AC) return;
      const ac = (audio.current ??= new AC());
      if (!noise.current) {
        const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const ch = b.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        noise.current = b;
      }
      const src = ac.createBufferSource();
      src.buffer = noise.current;
      const f = ac.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ac.createGain();
      const t = ac.currentTime;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(ac.destination);
      src.start(t, Math.random() * 0.8);
      src.stop(t + dur + 0.02);
    } catch {
      /* sound is optional */
    }
  };
  const pop = () => {
    try {
      const ac = audio.current;
      if (!ac) return;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.setValueAtTime(520, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.12);
      g.gain.setValueAtTime(0.05, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25);
      o.connect(g).connect(ac.destination);
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
    // ?seed=123 replays a particular first sticker; every new copy after that is random
    const asked = round === 0 ? Number(new URLSearchParams(window.location.search).get("seed")) : 0;
    const game = new Sticker(asked || Date.now());
    startRef.current = null;
    const introAt = window.setTimeout(() => say(game.lifted ? game.props.intro : `${game.props.intro} Nothing is lifted. Pick at an edge.`), 300);
    tears.current = 0;
    let raf = 0;
    let last = performance.now();
    let lastTick = 0;
    document.fonts?.ready.then(() => game.invalidate());

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    // On narrow screens the camera moves in on the sticker and the room it needs to be pulled across.
    const view = () => (canvas.getBoundingClientRect().width < 640 ? { z: 1.55, cx: game.view.x, cy: game.view.y } : { z: 1, cx: W / 2, cy: H / 2 });
    const toWorld = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const v = view();
      const sx = ((e.clientX - r.left) / r.width) * W;
      const sy = ((e.clientY - r.top) / r.height) * H;
      return { x: v.cx + (sx - W / 2) / v.z, y: v.cy + (sy - H / 2) / v.z };
    };
    const finish = () => {
      if (resultRef.current) return;
      const t = startRef.current === null ? 0 : performance.now() - startRef.current;
      game.wrap();
      setTime(t);
      setDone((d) => [d[0], d[1], true, true]);
      setResult({
        clean: game.clean,
        pieces: game.pieces,
        layers: game.layers.length,
        glue: game.glueCells,
        lint: game.lint,
        edges: game.edges,
        readable: game.readable,
        time: t,
        kind: game.layers[0].kind,
      });
    };
    finishRef.current = finish;
    const handle = (ev: StickerEvent | null) => {
      if (!ev) return;
      if (ev === "done") {
        pop();
        setRubbing(true);
        say(game.glueCells ? "All off. Now the glue." : "All off.");
        return;
      }
      if (ev === "rub" && game.rubbed > 0) return;
      if (ev === "tear") {
        rasp(900, 0.22, 0.28, 0.7);
        rasp(2400, 0.08, 0.18);
        say(TEARS[Math.min(tears.current, TEARS.length - 1)]);
        tears.current++;
        return;
      }
      if (ev === "lift") rasp(3200, 0.05, 0.05);
      if (ev === "under") {
        pop();
        say("There's another one underneath. It was cheaper.");
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
      if (ev === "grab" || ev === "scratch" || ev === "rub") {
        window.clearTimeout(introAt);
        if (startRef.current === null) startRef.current = performance.now();
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
        if (ev === "grab" && game.peeled > 0.04) return;
      }
      handle(ev);
    };
    const onMove = (e: PointerEvent) => {
      const p = toWorld(e);
      if (game.state === "held" || game.state === "scratch" || game.state === "rubbing") {
        const before = game.travel;
        handle(game.move(p.x, p.y));
        if (game.state === "scratch" && Math.floor(game.travel / 9) > Math.floor(before / 9)) rasp(4200, 0.025, 0.03, 3);
      } else canvas.style.cursor = game.cursorAt(p.x, p.y);
    };
    const onUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      handle(game.up());
      const p = toWorld(e);
      canvas.style.cursor = game.cursorAt(p.x, p.y);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      for (const ev of game.step(dt)) handle(ev);
      if (game.claimed > 0 && now - lastTick > 22) {
        // the good crackle: crisp when slow, raspy when hurried
        lastTick = now;
        const v = Math.min(1, game.speed / SPEED_MAX);
        rasp(3400 - v * 2200 + Math.random() * 600, Math.min(0.09, 0.018 + 0.012 * Math.sqrt(game.claimed)), 0.02 + v * 0.03, 1.6);
      }
      if (game.state === "scratch" || game.state === "held" || game.state === "rubbing") canvas.style.cursor = "grabbing";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sc = canvas.width / W;
      const v = view();
      ctx.setTransform(sc * v.z, 0, 0, sc * v.z, sc * (W / 2 - v.cx * v.z), sc * (H / 2 - v.cy * v.z));
      game.draw(ctx);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const ui = window.setInterval(() => {
      setDone((prev) => {
        const next = [prev[0] || game.started, prev[1] || game.edges >= 3, prev[2] || game.rubbing, prev[3] || game.state === "done"];
        return next.some((v, i) => v !== prev[i]) ? next : prev;
      });
      if (startRef.current !== null && !resultRef.current) setTime(performance.now() - startRef.current);
    }, 100);
    return () => {
      window.clearTimeout(introAt);
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
    setRubbing(false);
    setToast(null);
    setRound((r) => r + 1);
  };

  const shareText = () => {
    if (!result) return "";
    const bits = [`${result.pieces} ${result.pieces === 1 ? "piece" : "pieces"}`, `${Math.floor(result.clean * 100)}% clean`];
    const text = `I peeled a price sticker off a present. ${bits.join(", ")}.${result.readable ? ` They can still read '${result.readable}'.` : ""}`;
    return text;
  };

  const tier = result ? stickerTier(result) : null;

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
      <h1 className="serif play-title">Peel the Price Sticker</h1>
      <p className="play-lede">
        It's a present. The price has to go before you wrap it. Lift any edge with a fingernail and fold it back over
        itself. Big strips tear, so work in from the sides. Then rub off what's left.
      </p>
      <div className="stage stage-room">
        <canvas ref={canvasRef} onContextMenu={(e) => e.preventDefault()} aria-label="A new hardcover book with a price sticker on its cover." />
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
          <button className="btn-shake" onClick={fresh}>
            Buy another copy
          </button>
          {rubbing && !result && (
            <button className="btn-done" onClick={() => finishRef.current()}>
              Wrap it
            </button>
          )}
          <ShareButton slug="price-sticker" title="Peel the Price Sticker" text={() => "It's a present. The price comes off in one piece, or in forty."} />
        </div>
      </div>
      {result && tier && (
        <div className="result-veil" role="dialog" aria-modal="true">
          <div className="result">
            <div className="result-label">{result.layers > 1 ? "Two labels" : KINDS[result.kind as Kind].name} · Cover clean</div>
            <div className="serif result-score">{Math.floor(result.clean * 100)}%</div>
            <div className="serif result-tier">{tier.tier}</div>
            <p className="result-line">{tier.line}</p>
            <div className="result-stats">
              <div>
                Time<strong>{fmt(result.time)}</strong>
              </div>
              <div>
                Pieces<strong>{result.pieces}</strong>
              </div>
              <div>
                Glue left<strong>{result.glue === 0 ? "None" : result.glue < 10 ? "A trace" : `${(result.glue * 0.01).toFixed(1)} cm²`}</strong>
              </div>
              <div>
                Edges lifted<strong>{result.edges}</strong>
              </div>
            </div>
            <div className="result-row">
              <ShareButton className="btn-again" slug="price-sticker" title="Peel the Price Sticker" text={shareText}>
                Share result
              </ShareButton>
              <SaveReceipt slug="price-sticker" />
              <button className="btn-shake" onClick={fresh}>
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
