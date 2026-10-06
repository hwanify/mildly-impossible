import { useEffect, useRef } from "react";
import { Sheet, W, H } from "../../game/fittedSheet";
import { MugGame, W as MW } from "../../game/mug";

// A real, still frame of the fitted-sheet simulation (drawn client side only).
export function SheetThumb() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const sheet = new Sheet(20261006);
    const sc = canvas.width / W;
    ctx.setTransform(sc * 1.15, 0, 0, sc * 1.15, -W * sc * 0.075, -H * sc * 0.075);
    sheet.draw(ctx, -1);
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}

// A still of the mug room, drawn by the game itself, mid-carry.
export function MugThumb() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const g = new MugGame(7);
    g.state = "held";
    g.x = 470;
    g.y = 452;
    g.th = -0.12;
    g.tilt = -0.05;
    const sc = canvas.width / MW;
    const z = 1.9;
    const [cx, cy] = [470, 405];
    ctx.setTransform(sc * z, 0, 0, sc * z, sc * (MW / 2 - cx * z), sc * (320 - cy * z));
    g.draw(ctx);
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
