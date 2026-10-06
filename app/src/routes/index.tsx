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
        <span className="hub-aside">(it's fine. it's FINE.)</span>
        <svg className="hub-mark" viewBox="0 0 560 16" preserveAspectRatio="none" aria-hidden="true">
          <path d="M6 9c120-8 260 6 548-2" fill="none" stroke="var(--yellow)" strokeWidth="11" strokeLinecap="round" />
        </svg>
        <p className="hub-sub">
          Small household tasks that are technically possible. Everyone else seems to manage. Here you can fail in
          private.
        </p>
      </header>
      <div className="shelf">
        {chores.map((c) => (c.status === "live" ? <LiveCard key={c.slug} chore={c} /> : <SoonCard key={c.slug} chore={c} />))}
      </div>
      <p className="hub-foot">New tasks show up now and then. None of them get easier.</p>
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
          {chore.slug === newestSlug ? <span className="task-new">New!!</span> : null}
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
        <div className="task-meta">Still in the dryer. Coming soon-ish.</div>
      </div>
    </div>
  );
}
