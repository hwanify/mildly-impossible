import { useEffect, useRef, useState } from "react";
import { Building, FIX_NAMES, LEVELS, LEVEL_LINES, W, H, fixStatus, type BuildingEvent, type Fix } from "./engine";
import { LAST } from "./world";
import { cleanliness } from "./room";

const STEPS = ["Have a look round every floor", "Straighten the picture on 5", "Turn off the tap on 3", "Fix five things around the building"];

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// Where the room lives. The site's own higgsfield.app address carries WebSockets; a custom
// domain in front of it may not, so from anywhere else the room is reached there directly.
const ROOM_HOST = "impossible-chores.higgsfield.app";

/** The room's address: /ws/building on this site's higgsfield.app host (or, on localhost, a
 *  stand-in given as ?room=). */
function roomUrl() {
  const { hostname, host, protocol, search } = window.location;
  const q = new URLSearchParams(search).get("room");
  const local = /^(localhost|127\.0\.0\.1)$/.test(hostname);
  if (q && local) return q;
  if (local || hostname.endsWith(".higgsfield.app")) return `${protocol === "https:" ? "wss" : "ws"}://${host}/ws/building`;
  return `wss://${ROOM_HOST}/ws/building`;
}

type Result = {
  fixed: number;
  list: { name: string; now: string }[];
  frame: number;
  drips: number;
  met: number;
  floors: number;
  time: number;
  cleaned: number;
  back: number;
  tracked: number;
  clean: number;
};

function tierFor(r: Result) {
  if (r.fixed === 0) return { tier: "Just looking", line: "You touched nothing. The building appreciates it." };
  if (r.fixed <= 2) return { tier: "Helpful, briefly", line: "Everything you fixed is already slightly unfixed." };
  if (r.fixed <= 6) return { tier: "Good neighbour", line: "Most of it is still almost fixed. For now." };
  return { tier: "Unpaid caretaker", line: `The picture is ${r.frame.toFixed(2)}° off again. It always will be.` };
}

export function BuildingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Building | null>(null);
  const startRef = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const [time, setTime] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState([false, false, false, false]);
  const [meter, setMeter] = useState("The lobby");
  const [result, setResult] = useState<Result | null>(null);
  const [shared, setShared] = useState(false);
  const resultRef = useRef<Result | null>(null);
  resultRef.current = result;

  const say = (msg: string, ms = 2600) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };

  const finish = () => {
    const g = gameRef.current;
    if (!g) return;
    const t = performance.now() - startRef.current;
    const now = g.now();
    const list = [...g.fixes.keys()].map((id: Fix) => ({ name: FIX_NAMES[id], now: fixStatus(id, g.state, now) }));
    setResult({
      fixed: g.fixes.size,
      list,
      frame: Math.abs(g.state.frame.a),
      drips: g.dripCount(),
      cleaned: g.stats.cleaned,
      back: g.stats.back,
      tracked: g.stats.tracked,
      clean: cleanliness(g.state, now),
      met: g.met.size,
      floors: g.visited.size,
      time: t,
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const seed = Math.floor(Math.random() * 1e6);
    const game = new Building(seed);
    gameRef.current = game;
    startRef.current = performance.now();
    // for poking at it from the console during development
    if (import.meta.env.DEV) (window as unknown as { building?: Building }).building = game;
    let raf = 0;
    let alive = true;

    // ── the room ──
    let ws: WebSocket | null = null;
    let online = false;
    let tries = 0;
    let retry: number | undefined;
    let lastSent = "";
    let lastSentAt = 0;
    let greeted = false;
    const connect = () => {
      if (!alive) return;
      let sock: WebSocket;
      try {
        sock = new WebSocket(roomUrl());
      } catch {
        return;
      }
      ws = sock;
      sock.onopen = () => {
        online = true;
        tries = 0;
        if (!greeted) {
          greeted = true;
          sock.send(JSON.stringify({ t: "do", what: "hello" }));
        }
      };
      sock.onmessage = (e) => {
        let m: { t?: string; [k: string]: unknown };
        try {
          m = JSON.parse(String(e.data));
        } catch {
          return;
        }
        if (m.t === "hi") {
          game.myId = String(m.id);
          game.setState(m.s as Building["state"], Number(m.now));
        } else if (m.t === "s") {
          game.setState(m.s as Building["state"], Number(m.now));
        } else if (m.t === "ps") {
          game.sync(Number(m.now));
          game.setPeople(m.ps as (string | number)[][]);
        }
      };
      sock.onclose = () => {
        online = false;
        game.others.clear();
        if (!alive) return;
        tries++;
        retry = window.setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(tries, 4)));
      };
    };
    game.send = (msg) => {
      if (online && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };
    connect();

    game.onEvent = (e: BuildingEvent) => {
      if (resultRef.current) return;
      switch (e.k) {
        case "level":
          if (e.first) say(LEVEL_LINES[e.level]);
          break;
        case "say":
          say(e.text, e.ms);
          break;
        case "leave":
          finish();
          break;
      }
    };

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
      if (resultRef.current) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const p = toWorld(e);
      game.down(p.x, p.y);
    };
    const onMove = (e: PointerEvent) => {
      const p = toWorld(e);
      game.pointer(p.x, p.y);
      canvas.style.cursor = game.hover() || "default";
    };
    const onUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      game.up();
      // a finger lifted is a pointer gone: stay put
      if (e.pointerType === "touch") game.pointer(game.px, game.py, false);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && !game.hold) game.pointer(game.px, game.py, false);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    // the wheel looks up and down the building
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      game.scroll(e.deltaY * (e.deltaMode === 1 ? 30 : 1) * 0.8);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    say("Click a floor to go there. Point at things to see what they need.", 4200);

    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      game.step(dt);
      // my whereabouts, when they change (and once a second regardless)
      if (online && ws?.readyState === WebSocket.OPEN) {
        const p = JSON.stringify(game.presence());
        if ((p !== lastSent && t - lastSentAt > 90) || t - lastSentAt > 1000) {
          lastSent = p;
          lastSentAt = t;
          ws.send(`{"t":"p","p":${p}}`);
        }
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
      if (resultRef.current) return;
      setTime(performance.now() - startRef.current);
      const next = [game.visited.size > LAST, game.fixes.has("frame"), game.fixes.has("tap"), game.fixes.size >= 5];
      setDone((prev) => (next.some((v, i) => v !== prev[i]) ? next : prev));
      const n = game.others.size;
      const who = n ? `${n} other${n === 1 ? "" : "s"} in the building` : online ? "nobody else in" : "just you";
      setMeter(`${LEVELS[game.level].name} · ${cleanliness(game.state, game.now())}% clean · ${who}`);
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(retry);
      ws?.close();
      cancelAnimationFrame(raf);
      window.clearInterval(ui);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  const stay = () => {
    setResult(null);
    setShared(false);
  };

  const share = async () => {
    if (!result) return;
    const text = `I spent ${fmt(result.time)} looking after a building. I wiped ${result.cleaned} marks and left ${result.tracked} footprints. It's ${result.clean}% clean. The picture is ${result.frame.toFixed(2)}° off.`;
    const url = `${window.location.origin}/building`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Look After the Building", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShared(true);
    } catch {
      /* cancelled or blocked */
    }
  };

  const tier = result ? tierFor(result) : null;

  return (
    <>
      <div className="topbar">
        <a href="/" className="back">
          ← Mildly Impossible
        </a>
        <span className="clock" aria-label="Time in the building">
          {fmt(time)}
        </span>
      </div>
      <h1 className="serif play-title">Look After the Building</h1>
      <p className="play-lede">
        Everybody who is here right now is in this building with you. Click a floor to go there, scroll to look around,
        and point at things to see what they need. Everything is shared by everyone. None of it stays fixed.
      </p>
      <div className="stage building-stage">
        <canvas ref={canvasRef} onContextMenu={(e) => e.preventDefault()} aria-label="A block of flats seen in cross-section, with little people walking around in it." />
        {toast && <div className="toast">{toast}</div>}
        {!result && (
          <div className="meter" aria-live="off">
            {meter}
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
          <button className="btn-shake" onClick={finish}>
            Leave the building
          </button>
        </div>
      </div>
      {result && tier && (
        <div className="result-veil" role="dialog" aria-modal="true">
          <div className="result building-result">
            <div className="result-label">Things you fixed</div>
            <div className="serif result-score">{result.fixed}</div>
            <div className="serif result-tier">{tier.tier}</div>
            <p className="result-line">{tier.line}</p>
            {result.list.length > 0 && (
              <ul className="building-fixes" aria-label="What you fixed, and how it is doing now">
                {result.list.map((f) => (
                  <li key={f.name}>
                    <span>{f.name}</span>
                    <i aria-hidden="true" />
                    <span>{f.now}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="result-stats">
              <div>
                Marks wiped<strong>{result.cleaned}</strong>
              </div>
              <div>
                Put away<strong>{result.back}</strong>
              </div>
              <div>
                Footprints you left<strong>{result.tracked}</strong>
              </div>
              <div>
                Building<strong>{result.clean}% clean</strong>
              </div>
              <div>
                Drips so far<strong>{result.drips.toLocaleString("en")}</strong>
              </div>
              <div>
                Neighbours<strong>{result.met}</strong>
              </div>
              <div>
                Floors<strong>
                  {result.floors}/{LAST + 1}
                </strong>
              </div>
              <div>
                Time<strong>{fmt(result.time)}</strong>
              </div>
            </div>
            <div className="result-row">
              <button className="btn-again" onClick={share}>
                {shared ? "Copied" : "Share"}
              </button>
              <button className="btn-shake" onClick={stay}>
                Go back in
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
