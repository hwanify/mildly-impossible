import { useEffect, useRef, useState } from "react";
import { Sheet, W, H, tierFor, type Judge } from "../../game/fittedSheet";

const STEPS = [
  "구겨진 시트 펼치기",
  "모서리 하나를 옆 모서리에 쏙 넣기",
  "반대쪽 모서리 두 개도 겹치기",
  "네 모서리를 한 곳에 모으기",
  "각 잡고 '다 갰다!' 누르기",
];

const WELD_LINES: Record<number, string> = {
  2: "쏙! 모서리가 주머니에 들어갔다",
  3: "세 개째. 이제 손이 모자랍니다",
  4: "네 모서리 합체! 사람들이 여기서 제일 많이 포기합니다",
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
        const next = [
          prev[0] || st.flipped < 0.06,
          prev[1] || st.maxGroup >= 2,
          prev[2] || st.welded >= 4,
          prev[3] || st.maxGroup >= 4,
          prev[4],
        ];
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
    if (!s) return;
    setResult({ ...s.judge(), time, shakes: shakesRef.current });
    setDone((d) => d.map((v, i) => (i === 4 ? true : v)));
  };
  const shake = () => {
    const s = sheetRef.current;
    if (!s || s.frozen) return;
    s.shake();
    shakesRef.current += 1;
    if (startRef.current === null) startRef.current = performance.now();
    say("탈탈탈… 모서리가 전부 빠졌습니다");
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
          ← 보스 목록
        </a>
        <span className="clock" aria-label="경과 시간">
          {fmt(time)}
        </span>
      </div>
      <h1 className="jua play-title">피티드 시트 개기</h1>
      <p className="play-lede">
        방금 건조기에서 꺼낸 고무줄 시트입니다. 끌어서 펼치고, 모서리를 다른 모서리 위에 놓으면 주머니처럼 쏙
        들어갑니다. 네모 반듯해지면 제출하세요.
      </p>
      <div className="stage">
        <canvas ref={canvasRef} aria-label="피티드 시트. 마우스나 손가락으로 끌어서 개세요." />
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
            새 시트 꺼내기
          </button>
          <button className="btn-ball" onClick={ball}>
            그냥 뭉치기
          </button>
          <button className="btn-shake" onClick={shake}>
            탈탈 털기
          </button>
          <button className="btn-done" onClick={finish}>
            다 갰다!
          </button>
        </div>
      </div>
      {result && tier && (
        <div className="result-veil" role="dialog" aria-modal="true">
          <div className="result">
            <div className="result-label">각 잡힘 지수</div>
            <div className="jua result-score">{result.score}</div>
            <div className="jua result-tier">{tier.tier}</div>
            <p className="result-line">{tier.line}</p>
            <div className="result-stats">
              <div>
                걸린 시간<strong>{fmt(result.time)}</strong>
              </div>
              <div>
                탈탈 턴 횟수<strong>{result.shakes}번</strong>
              </div>
              <div>
                네모 반듯함<strong>{Math.round(result.rect * 100)}%</strong>
              </div>
              <div>
                접힌 정도<strong>{Math.round(result.compact * 100)}%</strong>
              </div>
            </div>
            <div className="result-row">
              <button className="btn-again" onClick={fresh}>
                한 장 더
              </button>
              {!result.ball && (
                <button className="btn-keep" onClick={() => setResult(null)}>
                  계속 다듬기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
