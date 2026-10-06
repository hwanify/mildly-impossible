import type { Chore } from "../types";
import { Game } from "./Game";
import { Thumb } from "./Thumb";
import stylesheet from "./style.css?url";

export const chore: Chore = {
  slug: "balance-scale",
  title: "Balance the Scale",
  blurb: "A whale on one side. A house on the other. Then the ants.",
  description: "Balance a giant scale with whales, houses, people and ants until both sides weigh exactly the same. They never do.",
  added: "2026-10-06",
  status: "live",
  Thumb,
  Game,
  stylesheet,
};
