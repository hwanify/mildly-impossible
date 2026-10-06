import type { Chore } from "../types";
import { FittedSheetGame } from "../../components/chores/FittedSheetGame";
import { SheetThumb } from "../../components/chores/ChoreArt";

export const chore: Chore = {
  slug: "fitted-sheet",
  title: "Fold a Fitted Sheet",
  blurb: "Four elastic corners, one rectangle. The corners have other plans.",
  description: "Fold an elastic fitted sheet into a neat rectangle, in your browser.",
  added: "2026-10-01",
  status: "live",
  Thumb: SheetThumb,
  Game: FittedSheetGame,
};
