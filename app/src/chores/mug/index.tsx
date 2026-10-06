import type { Chore } from "../types";
import { MugGame } from "../../components/chores/MugGame";
import { MugThumb } from "../../components/chores/ChoreArt";
import { MugTableItem } from "./TableItem";

export const chore: Chore = {
  slug: "mug",
  title: "Carry a Full Mug",
  blurb: "Filled to the brim. The desk is across the room. The cat is asleep, for now.",
  description: "Carry a mug filled to the brim across the room without spilling on the rug. Or the cat.",
  added: "2026-10-05",
  status: "live",
  Thumb: MugThumb,
  TableItem: MugTableItem,
  Game: MugGame,
};
