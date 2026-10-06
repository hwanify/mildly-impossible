import type { CSSProperties } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { chores, newestSlug } from "../chores/registry";
import type { Chore } from "../chores/types";

export const Route = createFileRoute("/")({
  component: Index,
});

// Things are put down on the table by hand: each one a little turned and a little off its spot.
// Fixed per position so the server and the browser draw the same table.
const LIE = [
  { r: -4, dx: 6, dy: 10 },
  { r: 5, dx: -10, dy: -6 },
  { r: -2, dx: 12, dy: 18 },
  { r: 3, dx: -6, dy: 4 },
  { r: -6, dx: 4, dy: -12 },
  { r: 2, dx: -14, dy: 8 },
  { r: -3, dx: 10, dy: -4 },
  { r: 6, dx: -4, dy: 14 },
];

const lie = (i: number) => {
  const l = LIE[i % LIE.length];
  return { "--r": `${l.r}deg`, "--dx": `${l.dx}px`, "--dy": `${l.dy}px` } as CSSProperties;
};

function Index() {
  return (
    <main className="hub">
      <div className="desk">
        <header className="desk-card">
          <h1 className="serif hub-title">Mildly Impossible</h1>
          <p className="hub-sub">
            Small household tasks that are technically possible. There are a thousand tutorials for each of them. This
            is the practice room.
          </p>
          <span className="desk-scrawl">pick something up.</span>
        </header>
        {chores.map((c, i) => (c.status === "live" ? <Thing key={c.slug} chore={c} i={i} /> : <Spot key={c.slug} chore={c} i={i} />))}
      </div>
      <p className="hub-foot">more things get left here now and then. none of them get easier.</p>
    </main>
  );
}

function Thing({ chore, i }: { chore: Chore; i: number }) {
  const { Thumb, TableItem } = chore;
  return (
    <Link to="/$slug" params={{ slug: chore.slug }} className="desk-item" style={lie(i)} aria-label={chore.title} title={chore.blurb}>
      <span className="desk-thing">
        {TableItem ? (
          <TableItem />
        ) : (
          <span className="desk-photo">
            <Thumb />
          </span>
        )}
      </span>
      <span className="desk-tape">{chore.title}</span>
      {chore.slug === newestSlug ? <span className="desk-new">New</span> : null}
    </Link>
  );
}

// Not out yet: an empty spot on the table, marked for later.
function Spot({ chore, i }: { chore: Chore; i: number }) {
  return (
    <div className="desk-item" style={lie(i)} aria-disabled="true">
      <span className="desk-spot">{chore.title}: goes here. later.</span>
    </div>
  );
}
