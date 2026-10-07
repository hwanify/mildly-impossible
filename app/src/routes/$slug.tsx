import { createFileRoute, notFound } from "@tanstack/react-router";
import { findChore } from "../chores/registry";
import { FullscreenToggle } from "../components/FullscreenToggle";

// One route for every game: `/<slug>` renders the chore registered in `src/chores/<slug>/`.
export const Route = createFileRoute("/$slug")({
  loader: ({ params }) => {
    if (!findChore(params.slug)) throw notFound();
  },
  head: ({ params }) => {
    const chore = findChore(params.slug);
    if (!chore) return {};
    return {
      meta: [{ title: `${chore.title} · Mildly Impossible` }, { name: "description", content: chore.description }],
      links: chore.stylesheet ? [{ rel: "stylesheet", href: chore.stylesheet }] : [],
    };
  },
  component: ChorePage,
});

function ChorePage() {
  const { slug } = Route.useParams();
  const Game = findChore(slug)?.Game;
  return (
    <main className="play">
      {Game ? <Game /> : null}
      <FullscreenToggle />
    </main>
  );
}
