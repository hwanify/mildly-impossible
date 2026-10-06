import type { Chore } from "../types";
import { DuvetArt } from "../../components/chores/ChoreArt";

export const chore: Chore = {
  slug: "duvet-cover",
  title: "Put On a Duvet Cover",
  blurb: "Somehow the duvet stays outside and you end up inside.",
  description: "Put a duvet into its cover without ending up inside it yourself.",
  added: "2026-10-01",
  status: "soon",
  Thumb: DuvetArt,
};
