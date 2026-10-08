import { useEffect, useRef, useState } from "react";
import { Jigsaw, W, H, PIECES, type JigsawEvent } from "./engine";
import { sceneFor } from "./pictures";
import { BW, BH, COUNT, unpack } from "./puzzle";
import type { Board, Deal, Placed } from "./api";
import { ShareButton } from "../../components/share/ShareButton";

// One jigsaw for everybody: the board lives on the server (api.ts). This page asks it for a piece,
// tells it when the piece goes in, and looks every few seconds for pieces other people put in.
const REST_MS = 5 * 60 * 1000;
const POLL_MS = 8000;
/** A custom domain may not reach the API itself; then it goes to the site's own host. */
const API_HOST = "https://impossible-chores.higgsfield.app";

const STEPS = ["Pick up your piece", "Put it where it goes"];
const NEARLY = ["It nearly fits. It doesn't.", "Not that hole.", "That hole is for a different piece.", "No."];
const FITS = ["It fits. The picture doesn't.", "It goes in. It's wrong."];

function who(): string {
  try {
    let w = window.localStorage.getItem("jigsaw-who");
    if (!w || !/^[a-z0-9]{8,40}$/.test(w)) {
      w = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join("");
      window.localStorage.setItem("jigsaw-who", w);
    }
    return w;
  } catch {
    return "anon" + Math.random().toString(36).slice(2, 12);
  }
}

/** Pieces you put in, for the pen rings. Kept in this browser only. */
function loadMine(no: number): number[] {
  try {
    const s = JSON.parse(window.localStorage.getItem("jigsaw-mine") ?? "null") as { no: number; cells: number[] } | null;
    return s && s.no === no ? s.cells : [];
  } catch {
    return [];
  }
}
function saveMine(no: number, cells: number[]) {
  try {
    window.localStorage.setItem("jigsaw-mine", JSON.stringify({ no, cells }));
  } catch {
    /* fine */
  }
}

export function JigsawGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Jigsaw | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [steps, setSteps] = useState([false, false]);
  const [toast, setToast] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  const say = (msg: string, ms = 2400) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };
  // a cardboard click: a very short, dull knock
  const knock = (hard: boolean) => {
    try {
      const AC = window.AudioContext;
      if (!AC) return;
      const ac = (audio.current ??= new AC());
      const len = Math.floor(ac.sampleRate * (hard ? 0.05 : 0.03));
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = hard ? 1400 : 900;
      const g = ac.createGain();
      g.gain.value = hard ? 0.5 : 0.18;
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
    let alive = true;
    let raf = 0;
    let lines = 0;
    let firstDeal = true;
    let dealing = false;
    const me = who();
    const timers: number[] = [];
    const cleanup: (() => void)[] = [];

    // where the API is: this host, a local test server (?api=, localhost only), or the site's own host
    const q = new URLSearchParams(window.location.search).get("api");
    let base = q && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ? q : "";
    const call = async <T,>(path: string, body?: unknown): Promise<T> => {
      const go = async (b: string) => {
        const res = await fetch(b + path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) throw new Error(String(res.status));
        return (await res.json()) as T;
      };
      try {
        return await go(base);
      } catch (e) {
        if (base || window.location.hostname.endsWith(".higgsfield.app") || window.location.hostname === "localhost") throw e;
        base = API_HOST;
        return await go(base);
      }
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      gameRef.current?.setScreen(canvas.width / W, r.width / W);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const mk = (w: number, h: number) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    };

    /** When the next puzzle starts, on this clock. */
    const nextAt = (b: Board) => (b.doneAt === null ? null : Date.now() + (b.doneAt + REST_MS - b.now));

    /** Lays out puzzle b.no: draws its picture and its board. */
    const start = (b: Board) => {
      const scene = sceneFor(b.no);
      const r = canvas.getBoundingClientRect();
      const scale = r.width * Math.min(window.devicePixelRatio || 1, 2) >= 1500 ? 3 : 2;
      const pic = mk(Math.round(BW * scale), Math.round(BH * scale));
      const pc = pic.getContext("2d")!;
      pc.scale(scale, scale);
      scene.draw(pc);
      const placed = unpack(b.board);
      const g = new Jigsaw(pic, scale, mk, scene, b.no, placed, loadMine(b.no).filter((i) => placed[i]));
      g.onEvent = onEvent;
      g.nextAt = nextAt(b);
      gameRef.current = g;
      if (import.meta.env.DEV) (window as unknown as { jigsaw: Jigsaw }).jigsaw = g;
      resize();
      setTitle(scene.title);
      if (g.left) deal();
    };

    /** Brings the board up to date with the server's: other people's pieces drop in. */
    const sync = (b: Board) => {
      const g = gameRef.current;
      if (!g || b.no !== g.no) {
        if (g && b.no > g.no) say(`Puzzle No. ${b.no}: ${sceneFor(b.no).title}.`, 3600);
        start(b);
        return;
      }
      const bits = unpack(b.board);
      const fresh: number[] = [];
      for (let i = 0; i < COUNT; i++) if (bits[i] && !g.placed[i]) fresh.push(i);
      let lost = false;
      let last: { label: string; met: boolean } | null = null;
      for (const i of fresh) {
        if (g.loose?.cell === i) {
          g.lose();
          lost = true;
        }
        last = g.othersPlace(i) ?? last;
      }
      g.nextAt = nextAt(b);
      if (fresh.length && !g.left) say("Someone put the last piece in. Next one in 5 minutes.", 4200);
      else if (lost) say("Someone else put yours in. Here's another.", 3200);
      else if (fresh.length > 1) say(`Someone put in ${fresh.length} pieces.`);
      else if (last) say(last.met ? "Someone just joined two bits of the picture." : `Someone put in a bit of ${last.label}.`, 2800);
      if (lost) deal();
    };

    const deal = async () => {
      if (dealing) return;
      dealing = true;
      try {
        const d = await call<Deal>("/api/jigsaw/deal", { who: me });
        if (!alive) return;
        const g = gameRef.current;
        if (!g || d.no !== g.no) return sync(d);
        sync(d);
        if (d.cell >= 0) g.deal(d.cell);
      } catch {
        say("Can't reach the box. Trying again.");
        timers.push(window.setTimeout(deal, 5000));
      } finally {
        dealing = false;
      }
    };

    const place = async (no: number, cell: number) => {
      try {
        const p = await call<Placed>("/api/jigsaw/place", { who: me, no, cell });
        if (!alive) return;
        sync(p);
        const g = gameRef.current;
        if (p.finished) say("That was the last piece. Next one in 5 minutes.", 4200);
        else if (g && g.no === p.no && g.left) timers.push(window.setTimeout(deal, 700));
      } catch {
        say("That didn't save. Trying again.");
        timers.push(window.setTimeout(() => place(no, cell), 4000));
      }
    };

    const onEvent = (e: JigsawEvent) => {
      const g = gameRef.current!;
      switch (e.t) {
        case "deal":
          if (firstDeal) say("That one's yours. Put it where it goes.", 3200);
          firstDeal = false;
          break;
        case "grab":
          setSteps((s) => [true, s[1]]);
          break;
        case "fitsWrong":
          knock(true);
          say(FITS[lines++ % FITS.length]);
          break;
        case "nearly":
          knock(false);
          say(NEARLY[lines++ % NEARLY.length]);
          break;
        case "placed":
          knock(true);
          setSteps([true, true]);
          saveMine(g.no, [...g.mine]);
          if (!e.finished) say(e.met ? "Click. Two bits of the picture just met." : "Click.", 1400);
          place(g.no, e.cell);
          break;
      }
    };

    const look = async () => {
      try {
        const b = await call<Board>("/api/jigsaw");
        if (alive) sync(b);
      } catch {
        /* try again next time */
      }
    };

    const fontsReady = async () => {
      try {
        await Promise.race([
          Promise.all(['700 20px "Libre Caslon Text"', '400 20px "Libre Caslon Text"', '600 20px "Work Sans"', '700 20px "Work Sans"', '700 10px "Courier Prime"', '400 25px "Reenie Beanie"'].map((f) => document.fonts.load(f))),
          new Promise((r) => setTimeout(r, 1500)),
        ]);
      } catch {
        /* draw with whatever there is */
      }
    };

    const boot = async () => {
      let b: Board;
      try {
        b = await call<Board>("/api/jigsaw");
      } catch {
        if (alive) {
          say("Can't reach the table. Trying again.", 4000);
          timers.push(window.setTimeout(boot, 5000));
        }
        return;
      }
      if (!alive) return;
      start(b);
      setReady(true);

      const poll = window.setInterval(() => {
        const g = gameRef.current;
        if (document.hidden || !g) return;
        // while a finished one rests there's nothing to fetch, until it's time for the next one
        if (g.nextAt !== null && g.nextAt - Date.now() > POLL_MS) return;
        look();
      }, POLL_MS);
      const onVis = () => {
        if (!document.hidden) look();
      };
      document.addEventListener("visibilitychange", onVis);
      cleanup.push(() => {
        window.clearInterval(poll);
        document.removeEventListener("visibilitychange", onVis);
      });

      const view = (e: PointerEvent | WheelEvent) => {
        const r = canvas.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
      };
      const cursor = () => {
        const g = gameRef.current!;
        const k = g.grab?.kind;
        canvas.style.cursor = k === "piece" || k === "pan" ? "grabbing" : g.hover === "piece" || g.hover === "table" ? "grab" : g.hover ? "pointer" : "default";
      };
      const onDown = (e: PointerEvent) => {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        const p = view(e);
        gameRef.current!.down(e.pointerId, p.x, p.y);
        cursor();
      };
      const onMove = (e: PointerEvent) => {
        const p = view(e);
        gameRef.current!.move(e.pointerId, p.x, p.y);
        cursor();
      };
      const onUp = (e: PointerEvent) => {
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        gameRef.current!.up(e.pointerId, e.type === "pointercancel");
        cursor();
      };
      const onLeave = () => gameRef.current!.leave();
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const p = view(e);
        gameRef.current!.wheel(p.x, p.y, e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY, e.ctrlKey);
      };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("pointerleave", onLeave);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      cleanup.push(() => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("pointerleave", onLeave);
        canvas.removeEventListener("wheel", onWheel);
      });

      const frame = (now: number) => {
        const g = gameRef.current!;
        g.step(now);
        const sc = canvas.width / W;
        ctx.setTransform(sc, 0, 0, sc, 0, 0);
        g.draw(ctx);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    fontsReady().then(() => {
      if (alive) boot();
    });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      ro.disconnect();
      cleanup.forEach((f) => f());
    };
  }, []);

  return (
    <>
      <div className="topbar">
        <a href="/" className="back">
          ← Mildly Impossible
        </a>
        <span className="clock">{title}</span>
      </div>
      <h1 className="serif play-title">Finish the Jigsaw</h1>
      <p className="play-lede">
        One jigsaw, {PIECES} pieces, everybody's. The piece by the board is yours: put it where it goes. It always goes
        next to a bit that's already done, and there's no picture on the box. Scroll or pinch to look closer, drag the
        table to look round. When it's finished, the next one starts five minutes later.
      </p>
      <div className="stage jigsaw-stage">
        <canvas ref={canvasRef} onContextMenu={(e) => e.preventDefault()} aria-label="A jigsaw half done on a table, and your piece next to it on a slip of paper." />
        {!ready && <div className="jigsaw-wait">Tipping the pieces out…</div>}
        {toast && <div className="toast">{toast}</div>}
      </div>
      <div className="below">
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s} className={steps[i] ? "ok" : ""}>
              <b>{steps[i] ? "✓" : i + 1}</b>
              {s}
            </li>
          ))}
        </ol>
        <div className="actions">
          <ShareButton
            slug="jigsaw"
            title="Finish the Jigsaw"
            text={() => {
              const g = gameRef.current;
              if (!g) return "One jigsaw, everybody's. Come and put a piece in.";
              const left = g.left;
              const mine = g.mine.size;
              return `${left ? `${left} pieces left on the jigsaw` : "The jigsaw is finished"}.${mine ? ` I put in ${mine}.` : ""} Come and put a piece in.`;
            }}
          >
            Bring someone in
          </ShareButton>
        </div>
      </div>
    </>
  );
}
