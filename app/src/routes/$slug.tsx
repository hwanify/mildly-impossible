import { useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { findChore } from "../chores/registry";
import { FullscreenToggle } from "../components/FullscreenToggle";

type Search = { s?: string; t?: string };
const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, n) : undefined);

// One route for every game: `/<slug>` renders the chore registered in `src/chores/<slug>/`.
// A shared result comes back as `/<slug>?s=<score>&t=<tier>`: the link preview and the page say so.
export const Route = createFileRoute("/$slug")({
  validateSearch: (search: Record<string, unknown>): Search => ({ s: clip(search.s, 24), t: clip(search.t, 40) }),
  loader: ({ params }) => {
    if (!findChore(params.slug)) throw notFound();
  },
  head: ({ params, match }) => {
    const chore = findChore(params.slug);
    if (!chore) return {};
    const { s, t } = (match.search ?? {}) as Search;
    const title = s ? `${chore.title}: ${s}${t ? ` (${t})` : ""}` : chore.title;
    const description = s ? `Someone got ${s}${t ? `, "${t}"` : ""}. Your turn. ${chore.description}` : chore.description;
    return {
      meta: [
        { title: `${title} · Mildly Impossible` },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
      links: chore.stylesheet ? [{ rel: "stylesheet", href: chore.stylesheet }] : [],
    };
  },
  component: ChorePage,
});

function ChorePage() {
  const { slug } = Route.useParams();
  const { s, t } = Route.useSearch();
  const Game = findChore(slug)?.Game;
  return (
    <main className="play">
      {s && <Challenge score={s} tier={t} />}
      {Game ? <Game /> : null}
      <FullscreenToggle />
    </main>
  );
}

/** Someone shared their result: a note left on the table. */
function Challenge({ score, tier }: { score: string; tier?: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <button type="button" className="challenge" onClick={() => setOpen(false)} aria-label="Dismiss note">
      Someone got <b>{score}</b>
      {tier ? <> · {tier}</> : null}. Your turn.
    </button>
  );
}
