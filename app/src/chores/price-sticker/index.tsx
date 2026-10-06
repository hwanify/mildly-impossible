import type { Chore } from "../types";
import { Game } from "./Game";
import { Thumb } from "./Thumb";
import { PriceStickerTableItem } from "./TableItem";

export const chore: Chore = {
  slug: "price-sticker",
  title: "Peel the Price Sticker",
  blurb: "It's a present. The price comes off in one piece, or in forty.",
  description: "Peel the price sticker off a new book in one piece, without tearing it or leaving glue on the cover.",
  added: "2026-10-06",
  status: "live",
  Thumb,
  TableItem: PriceStickerTableItem,
  Game,
};
