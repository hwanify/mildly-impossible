import { createFileRoute, Link } from "@tanstack/react-router";
import { chores, newestSlug } from "../chores/registry";
import type { Chore } from "../chores/types";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="hub">
      <header className="hub-head">
        <h1 className="serif hub-title">
          Mildly <em>Impossible</em>
        </h1>
        <p className="hub-sub">
          Small household tasks that are technically possible. There are a thousand tutorials for each of them. This is
          the practice room.
        </p>
      </header>
      <div className="shelf">
        {chores.map((c) => (c.status === "live" ? <LiveCard key={c.slug} chore={c} /> : <SoonCard key={c.slug} chore={c} />))}
      </div>
      <p className="hub-foot">New tasks are added occasionally. None of them get easier.</p>
    </main>
  );
}

function LiveCard({ chore }: { chore: Chore }) {
  const { Thumb } = chore;
  return (
    <Link to="/$slug" params={{ slug: chore.slug }} className="task">
      <div className="task-thumb">
        <Thumb />
      </div>
      <div className="task-body">
        <div className="serif task-name">
          {chore.title}
          {chore.slug === newestSlug ? <span className="task-new">New</span> : null}
        </div>
        <p className="task-desc">{chore.blurb}</p>
        <div className="task-meta">
          <span>Try it</span> →
        </div>
      </div>
    </Link>
  );
}

function SoonCard({ chore }: { chore: Chore }) {
  const { Thumb } = chore;
  return (
    <div className="task soon" aria-disabled="true">
      <div className="task-thumb">
        <Thumb />
      </div>
      <div className="task-body">
        <div className="serif task-name">{chore.title}</div>
        <p className="task-desc">{chore.blurb}</p>
        <div className="task-meta">Coming soon</div>
      </div>
    </div>
  );
}
