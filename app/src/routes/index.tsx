import { useEffect, useState, type CSSProperties } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { chores, newestSlug } from "../chores/registry";
import type { Chore } from "../chores/types";
import { readRecords, type Rec } from "../lib/records";

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
  // what you've done here lives in this browser, so it shows up after the page has loaded
  const [recs, setRecs] = useState<Record<string, Rec> | null>(null);
  useEffect(() => setRecs(readRecords()), []);
  const live = chores.filter((c) => c.status === "live");
  const done = recs ? live.filter((c) => recs[c.slug]).length : 0;
  return (
    <main className="hub">
      <div className="desk">
        <header className="desk-card">
          <h1 className="serif hub-title">Mildly Impossible</h1>
          <p className="hub-sub">
            Small, everyday things that are technically possible. Everyone else seems to manage. This is the practice
            room.
          </p>
          <span className="desk-scrawl">pick something up.</span>
          {recs && done > 0 && (
            <span className="desk-progress">
              {done === live.length ? `all ${live.length} done. still not easy.` : `${done} of ${live.length} done. everyone else seems to manage.`}
            </span>
          )}
        </header>
        {chores.map((c, i) => (c.status === "live" ? <Thing key={c.slug} chore={c} i={i} rec={recs ? (recs[c.slug] ?? null) : undefined} /> : <Spot key={c.slug} chore={c} i={i} />))}
      </div>
      <p className="hub-foot">more things get left here now and then. none of them get easier.</p>
    </main>
  );
}

/** rec: your record here, null if you haven't tried it, undefined until the browser has said. */
function Thing({ chore, i, rec }: { chore: Chore; i: number; rec?: Rec | null }) {
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
      {rec === null && <span className="desk-best untouched">untouched</span>}
      {rec && (
        <span className="desk-best">
          {chore.slug === "jigsaw" ? rec.text : `best: ${rec.text}`}
          {rec.top ? ` · top ${rec.top}%` : ""}
        </span>
      )}
      {chore.slug === newestSlug ? <span className="desk-new">New</span> : null}
      {chore.online ? (
        <span className="desk-online" title="Played with whoever else is here">
          <i aria-hidden="true" />
          Online
        </span>
      ) : null}
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
