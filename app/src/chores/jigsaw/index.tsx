import type { Chore } from "../types";
import { JigsawGame } from "./Game";
import { JigsawThumb } from "./Thumb";
import { JigsawTableItem } from "./TableItem";
import stylesheet from "./style.css?url";

export const chore: Chore = {
  slug: "jigsaw",
  title: "Finish the Jigsaw",
  blurb: "One jigsaw, 504 pieces, everybody's. You get one piece out of the box. It goes somewhere.",
  description: "A 504-piece jigsaw everyone does together, one piece each: take a random piece from the box and find where it goes.",
  added: "2026-10-07",
  status: "live",
  Thumb: JigsawThumb,
  TableItem: JigsawTableItem,
  Game: JigsawGame,
  stylesheet,
};
