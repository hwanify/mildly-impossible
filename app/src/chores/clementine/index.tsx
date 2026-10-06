import type { Chore } from "../types";
import { ClementineGame } from "./Game";
import { ClementineThumb } from "./Thumb";
import { ClementineTableItem } from "./TableItem";

export const chore: Chore = {
  slug: "clementine",
  title: "Peel a Clementine in One Piece",
  blurb: "One continuous strip of peel. The clementine disagrees, and leaves white threads everywhere.",
  description: "Peel a clementine in a single piece without tearing the strip or leaving white pith threads all over the fruit.",
  added: "2026-10-06",
  status: "live",
  Thumb: ClementineThumb,
  TableItem: ClementineTableItem,
  Game: ClementineGame,
};
