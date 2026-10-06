import type { Chore } from "../types";
import { PizzaGame } from "./Game";
import { PizzaThumb } from "./Thumb";
import { PizzaTableItem } from "./TableItem";
import stylesheet from "./style.css?url";

export const chore: Chore = {
  slug: "pizza",
  title: "Cut the Pizza Equally",
  blurb: "Eight people, eight slices, straight cuts only. Someone always gets the big one.",
  description: "Cut a pizza into eight equal slices with straight cuts, then find out how unequal they really are.",
  added: "2026-10-06",
  status: "live",
  Thumb: PizzaThumb,
  TableItem: PizzaTableItem,
  Game: PizzaGame,
  stylesheet,
};
