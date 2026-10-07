import type { Chore } from "../types";
import { BuildingGame } from "./Game";
import { BuildingThumb } from "./Thumb";
import { BuildingTableItem } from "./TableItem";
import stylesheet from "./style.css?url";

export const chore: Chore = {
  slug: "building",
  title: "Look After the Building",
  blurb: "Five floors, one lift, a tap that drips. Everyone online is in there with you, and nothing stays fixed.",
  description:
    "Walk around a block of flats with everyone else who is online. Straighten the picture, turn off the tap, hold the lift. None of it stays fixed.",
  added: "2026-10-07",
  status: "live",
  Thumb: BuildingThumb,
  TableItem: BuildingTableItem,
  Game: BuildingGame,
  stylesheet,
};
