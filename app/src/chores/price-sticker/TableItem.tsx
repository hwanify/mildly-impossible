import { Thumb } from "./Thumb";

// The book on the hub's table, sticker and all: the game's own still, cropped to the cover.
export function PriceStickerTableItem() {
  return (
    <span style={{ position: "relative", display: "block", width: 196, height: 252, overflow: "hidden", borderRadius: "2px 5px 5px 2px" }}>
      <span className="desk-crop" style={{ width: 394, height: 252, left: 98 - 0.58 * 394, top: 0 }}>
        <Thumb />
      </span>
    </span>
  );
}
