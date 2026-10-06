import type { ComponentType } from "react";

export type Chore = {
  /** URL path segment: the game lives at `/<slug>`. Must match the folder name. */
  slug: string;
  /** Card and page title, e.g. "Carry a Full Mug". */
  title: string;
  /** One or two deadpan sentences for the hub card. */
  blurb: string;
  /** Meta description for the game page and search results. */
  description: string;
  /** ISO date the chore went live (or was announced). Newest first on the hub; the newest live one gets "New". */
  added: string;
  /** "soon" shows a disabled card on the hub and has no page yet. */
  status: "live" | "soon";
  /** Hub card art: canvas still or inline SVG. Client-only drawing goes in useEffect. */
  Thumb: ComponentType;
  /** The thing itself lying on the hub's table, seen from above (a mug, a pizza, a book). Optional:
   *  without one the hub shows `Thumb` as a photo print. Size it yourself, roughly 160-320px. */
  TableItem?: ComponentType;
  /** The game itself. Required when status is "live". */
  Game?: ComponentType;
  /** Extra stylesheet for this chore, imported as `./style.css?url`. */
  stylesheet?: string;
};
