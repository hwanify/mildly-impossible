import { useEffect, useRef } from "react";
import { piecePath, cellX, cellY } from "./engine";
import { highStreet } from "./pictures/highStreet";
import { BW, BH, P, COLS, makeCut } from "./puzzle";

// The jigsaw on the hub's table: a bit of it done (the bakery), and a few pieces nobody's placed yet.
const CW = 300;
const CH = 240;

export function JigsawTableItem() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let alive = true;
    document.fonts.ready.then(() => {
      if (!alive) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = CW * dpr;
      canvas.height = CH * dpr;
      ctx.scale(dpr, dpr);
      const ps = 0.8 * dpr;
      const pic = document.createElement("canvas");
      pic.width = Math.round(BW * ps);
      pic.height = Math.round(BH * ps);
      const pc = pic.getContext("2d")!;
      pc.scale(ps, ps);
      highStreet.draw(pc);
      const cut = makeCut(1001);
      const m = 0.4 * P;
      const piece = (i: number, x: number, y: number, a: number, s: number, shadow: boolean) => {
        const path = piecePath(cut, i);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.scale(s, s);
        if (shadow) {
          ctx.save();
          ctx.shadowColor = "rgba(28,28,26,.3)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = "#BDB4A4";
          ctx.fill(path);
          ctx.restore();
        }
        ctx.save();
        ctx.clip(path);
        ctx.drawImage(pic, (cellX(i) - P / 2 - m) * ps, (cellY(i) - P / 2 - m) * ps, (P + 2 * m) * ps, (P + 2 * m) * ps, -P / 2 - m, -P / 2 - m, P + 2 * m, P + 2 * m);
        ctx.restore();
        ctx.strokeStyle = "rgba(28,28,26,.3)";
        ctx.lineWidth = 0.8;
        ctx.stroke(path);
        ctx.restore();
      };
      // a done bit, slightly turned, lying as one
      const s = 0.62;
      const cells: number[] = [];
      for (let r = 10; r <= 14; r++) for (let c = 0; c <= 5; c++) if (!(r === 10 && c > 3) && !(r === 14 && c < 2)) cells.push(r * COLS + c);
      ctx.save();
      ctx.translate(22, 30);
      ctx.rotate(-0.06);
      ctx.shadowColor = "rgba(28,28,26,.25)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      for (const i of cells) {
        const x = cellX(i) * s;
        const y = (cellY(i) - 10 * P + P / 2) * s;
        piece(i, x, y, 0, s, false);
      }
      ctx.restore();
      for (const [i, x, y, a] of [
        [9 * COLS + 7, 238, 60, 0.5],
        [3 * COLS + 12, 262, 150, 2.2],
        [15 * COLS + 9, 196, 206, -0.9],
        [1 * COLS + 20, 120, 214, 1.4],
      ] as const)
        piece(i, x, y, a, 0.68, true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return <canvas ref={ref} width={CW} height={CH} style={{ display: "block", width: CW, height: CH }} aria-hidden="true" />;
}
