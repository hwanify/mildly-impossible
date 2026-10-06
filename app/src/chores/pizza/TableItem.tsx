import { PizzaThumb } from "./Thumb";

// The pizza on the hub's table: the game's own still, cut out round, board and all.
// The board is 566 world units across, centred at (500, 322) in the 1000x640 world.
const D = 250;
const W = D * (1000 / 566);
const H = W * 0.64;

export function PizzaTableItem() {
  return (
    <span style={{ position: "relative", display: "block", width: D, height: D, borderRadius: "50%", overflow: "hidden" }}>
      <span className="desk-crop" style={{ width: W, height: H, left: D / 2 - W / 2, top: D / 2 - (322 / 640) * H }}>
        <PizzaThumb />
      </span>
    </span>
  );
}
