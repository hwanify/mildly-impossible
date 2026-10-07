import { useEffect, useRef } from "react";
import { Building, W } from "./engine";
import { floorY } from "./world";

// A still of the top of the building, with a few people in it, drawn by the game itself.
export function BuildingThumb() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const b = new Building(3);
    b.level = 1;
    b.x = 450;
    b.y = floorY(1);
    b.gesture = 3;
    b.cam = floorY(1) - 410;
    b.setPeople([
      ["a", 360, floorY(0), 1, 1, 0, 0, 0],
      ["b", 640, floorY(2), -1, 0, 1, 4, 2],
      ["c", 690, floorY(1), -1, 0, 0, 2, 1],
    ]);
    for (const o of b.others.values()) {
      o.x = o.tx;
      o.y = o.ty;
    }
    const sc = canvas.width / W;
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    b.draw(ctx);
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
