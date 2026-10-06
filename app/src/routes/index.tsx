import { createFileRoute, Link } from "@tanstack/react-router";
import { SheetThumb, MugThumb, DuvetArt } from "../components/chores/ChoreArt";

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
        <Link to="/mug" className="task">
          <div className="task-thumb">
            <MugThumb />
          </div>
          <div className="task-body">
            <div className="serif task-name">
              Carry a Full Mug<span className="task-new">New</span>
            </div>
            <p className="task-desc">Filled to the brim. The desk is across the room. The cat is asleep, for now.</p>
            <div className="task-meta">
              <span>Try it</span> →
            </div>
          </div>
        </Link>
        <Link to="/fitted-sheet" className="task">
          <div className="task-thumb">
            <SheetThumb />
          </div>
          <div className="task-body">
            <div className="serif task-name">Fold a Fitted Sheet</div>
            <p className="task-desc">Four elastic corners, one rectangle. The corners have other plans.</p>
            <div className="task-meta">
              <span>Try it</span> →
            </div>
          </div>
        </Link>
        <div className="task soon" aria-disabled="true">
          <div className="task-thumb">
            <DuvetArt />
          </div>
          <div className="task-body">
            <div className="serif task-name">Put On a Duvet Cover</div>
            <p className="task-desc">Somehow the duvet stays outside and you end up inside.</p>
            <div className="task-meta">Coming soon</div>
          </div>
        </div>
      </div>
      <p className="hub-foot">New tasks are added occasionally. None of them get easier.</p>
    </main>
  );
}
