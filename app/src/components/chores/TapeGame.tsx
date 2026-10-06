import { useEffect, useRef, useState } from "react";
import type { TapeEvent, TapeScene } from "../../game/tape3d";
import type { PeelSound } from "../../game/peelSound";
import { tapeTier, type TapeResult } from "../../game/tapeResult";

const GOAL_CM = 25;
const STEPS = [
  "Find the end. Turn the roll and watch for a glint",
  "Catch it with your nail, scratch sideways to widen",
  `Pull off ${GOAL_CM} cm at full width`,
];

const LINES: Partial<Record<TapeEvent, string>> = {
  "bump-fast": "Too fast. Something was there.",
  "bump-thin": "The edge is there, but too thin to grip here. Try further along.",
  catch: "Caught it. Keep turning slowly, then scratch sideways to widen.",
  slip: "Slipped. It stuck back down.",
  tab: "A tab. Grab it and pull.",
  narrow: "Narrow strip. It will tear unless you steer it out to an edge.",
  "tear-start": "It is starting to tear.",
  "edge-clean": "Clean edge.",
  "full-width": "Full width. Nice and steady now.",
  snap: "It tore off diagonally. The new end is somewhere on the roll.",
  "stuck-back": "You let go. It stuck itself back down.",
  tangled: "It folded over and stuck to itself. That piece is gone.",
};
const BUMPS = [
  "A tiny ridge. Your nail slid right over it.",
  "Same ridge. Nothing to grip from this side.",
  "Maybe come at it from the other direction.",
];
const CLICK: Partial<Record<TapeEvent, number>> = { bump: 820, "bump-fast": 820, "bump-thin": 700, catch: 1600, slip: 420, tab: 1300, "tear-start": 260, snap: 180, tangled: 200, "stuck-back": 300, won: 1800 };

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function TapeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TapeScene | null>(null);
  const soundRef = useRef<PeelSound | null>(null);
  const startRef = useRef<number | null>(null);
  const usedLight = useRef(false);
  const bumpCount = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const lastToast = useRef({ msg: "", at: 0 });
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const [time, setTime] = useState(0);
  const [meter, setMeter] = useState<{ cm: number; width: number } | null>(null);
  const [light, setLight] = useState(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<TapeResult | null>(null);
  const resultRef = useRef<TapeResult | null>(null);
  resultRef.current = result;

  const say = (msg: string) => {
    const now = performance.now();
    if (lastToast.current.msg === msg && now - lastToast.current.at < 1500) return;
    lastToast.current = { msg, at: now };
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  const finish = (scissors: boolean) => {
    const s = sceneRef.current;
    if (!s || resultRef.current) return;
    const t = startRef.current === null ? 0 : performance.now() - startRef.current;
    setTime(t);
    setDone([true, true, true]);
    setResult({ time: t, tears: s.tears, slips: s.slips, lost: s.lost, light: usedLight.current, scissors });
  };

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    const canvas = canvasRef.current;
    if (!canvas) return;
    startRef.current = null;
    usedLight.current = false;
    bumpCount.current = 0;
    void import("../../game/tape3d")
      .then(({ TapeScene }) => {
        if (disposed) return;
        let scene: TapeScene;
        try {
          scene = new TapeScene(canvas, Date.now());
        } catch {
          setFailed(true);
          return;
        }
        sceneRef.current = scene;
        if (window.location.search.includes("debug")) (window as unknown as { __tape: TapeScene }).__tape = scene;
        setReady(true);
        let raf = 0;
        const resize = () => {
          const r = canvas.getBoundingClientRect();
          scene.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);
        const pos = (e: PointerEvent) => {
          const r = canvas.getBoundingClientRect();
          return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        const handle = (ev: TapeEvent | null) => {
          if (!ev) return;
          const f = CLICK[ev];
          if (f) soundRef.current?.click(f);
          navigator.vibrate?.(ev === "catch" || ev === "snap" ? 25 : ev.startsWith("bump") ? 6 : 0);
          if (ev === "won") return finish(false);
          if (ev === "bump") {
            say(BUMPS[Math.min(bumpCount.current, BUMPS.length - 1)]);
            bumpCount.current++;
            return;
          }
          const line = LINES[ev];
          if (line) say(line);
        };
        const onDown = (e: PointerEvent) => {
          if (resultRef.current) return;
          if (!soundRef.current) {
            void import("../../game/peelSound").then(({ PeelSound }) => {
              try {
                soundRef.current = new PeelSound();
                soundRef.current.muted = mutedRef.current;
              } catch {
                /* no audio */
              }
            });
          } else soundRef.current.resume();
          if (startRef.current === null) startRef.current = performance.now();
          const p = pos(e);
          handle(scene.down(p.x, p.y, e.timeStamp));
          e.preventDefault();
          canvas.setPointerCapture(e.pointerId);
        };
        const onMove = (e: PointerEvent) => {
          const list = e.getCoalescedEvents?.() ?? [];
          for (const ce of list.length ? list : [e]) {
            const p = pos(ce);
            handle(scene.move(p.x, p.y, ce.timeStamp));
          }
        };
        const onUp = (e: PointerEvent) => {
          if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          handle(scene.up());
        };
        const onLeave = () => scene.leave();
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerup", onUp);
        canvas.addEventListener("pointercancel", onUp);
        canvas.addEventListener("pointerleave", onLeave);

        const place = (el: HTMLDivElement | null, p: { x: number; y: number } | null) => {
          if (!el) return;
          if (!p) {
            el.style.display = "none";
            return;
          }
          el.style.display = "block";
          el.style.transform = `translate(${p.x}px, ${p.y}px)`;
        };
        const frame = () => {
          scene.frame();
          soundRef.current?.update(scene.peelSpeed);
          const o = scene.overlay();
          place(thumbRef.current, o.thumb);
          thumbRef.current?.classList.toggle("pressed", !!o.thumb?.pressed);
          place(pinchRef.current, o.pinch);
          place(tabRef.current, o.tab);
          place(labelRef.current, o.label);
          if (labelRef.current && o.label) labelRef.current.textContent = o.label.text;
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        const ui = window.setInterval(() => {
          const ph = scene.phase;
          setDone((prev) => {
            const next = [prev[0] || scene.everCaught, prev[1] || scene.everTab, prev[2] || ph === "won"];
            return next.some((v, i) => v !== prev[i]) ? next : prev;
          });
          setMeter(ph === "peel" ? { cm: Math.floor(scene.cm), width: Math.round(scene.width * 100) } : null);
          if (startRef.current !== null && !resultRef.current) setTime(performance.now() - startRef.current);
        }, 150);
        cleanup = () => {
          cancelAnimationFrame(raf);
          window.clearInterval(ui);
          ro.disconnect();
          canvas.removeEventListener("pointerdown", onDown);
          canvas.removeEventListener("pointermove", onMove);
          canvas.removeEventListener("pointerup", onUp);
          canvas.removeEventListener("pointercancel", onUp);
          canvas.removeEventListener("pointerleave", onLeave);
          scene.dispose();
          sceneRef.current = null;
        };
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  useEffect(() => () => soundRef.current?.dispose(), []);

  const toggleLight = () => {
    const s = sceneRef.current;
    if (!s) return;
    s.setLight(!s.light);
    if (s.light) usedLight.current = true;
    setLight(s.light);
  };
  const toggleSound = () => {
    const m = !muted;
    setMuted(m);
    mutedRef.current = m;
    if (soundRef.current) soundRef.current.muted = m;
  };
  const fresh = () => {
    setResult(null);
    setDone(STEPS.map(() => false));
    setTime(0);
    setMeter(null);
    setLight(false);
    setToast(null);
    setReady(false);
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
        A roll of clear packing tape. Turn it under the light to spot the end, put your thumbnail on it and turn the
        roll until the edge catches. Then pull off {GOAL_CM} cm without tearing it.
      </p>
      <p className="play-hint">Drag left or right to turn the roll. Press on the tape to put your nail on it, slide up and down to work along the edge.</p>
      <div className={light ? "stage stage-tape dark" : "stage stage-tape"}>
        <canvas
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="A roll of clear tape. Drag to turn it, press on it to scratch with your thumbnail, then pull the tab."
        />
        <div className="ov ov-thumb" ref={thumbRef} aria-hidden="true">
          <svg viewBox="0 0 48 72" width="48" height="72">
            <path d="M7 72V27C7 11 15 2 24 2s17 9 17 25v45z" fill="#E6C0A0" stroke="rgba(28,28,26,.35)" strokeWidth="1.2" />
            <path d="M13 25c0-12 5-18 11-18s11 6 11 18v9c-5 3-17 3-22 0z" fill="#F3E1D5" stroke="rgba(28,28,26,.22)" />
            <path d="M15 12c3-4 15-4 18 0" stroke="#FFFAF4" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="ov ov-pinch" ref={pinchRef} aria-hidden="true">
          <svg viewBox="0 0 64 64" width="64" height="64">
            <ellipse cx="22" cy="40" rx="11" ry="17" transform="rotate(-35 22 40)" fill="#E6C0A0" stroke="rgba(28,28,26,.35)" />
            <ellipse cx="42" cy="24" rx="10" ry="16" transform="rotate(-35 42 24)" fill="#EBC8AA" stroke="rgba(28,28,26,.35)" />
          </svg>
        </div>
        <div className="ov ov-tab" ref={tabRef} aria-hidden="true" />
        <div className="ov ov-label" ref={labelRef} aria-hidden="true" />
        {!ready && !failed && <div className="stage-note">Unrolling…</div>}
        {failed && <div className="stage-note">This one needs WebGL, which your browser has turned off.</div>}
        {toast && <div className="toast">{toast}</div>}
        {meter && !result && (
          <div className="meter" aria-live="polite">
            {meter.cm} / {GOAL_CM} cm · width {meter.width}%
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
          <button className="btn-new" onClick={toggleSound}>
            {muted ? "Sound off" : "Sound on"}
          </button>
          <button className="btn-ball" onClick={() => finish(true)}>
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
                Pieces lost<strong>{result.lost}</strong>
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
