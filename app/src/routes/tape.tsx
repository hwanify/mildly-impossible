import { createFileRoute } from "@tanstack/react-router";
import { TapeGame } from "../components/chores/TapeGame";

export const Route = createFileRoute("/tape")({
  head: () => ({
    meta: [
      { title: "Find the End of the Tape · Mildly Impossible" },
      { name: "description", content: "Find the invisible end of a roll of clear packing tape, then pull it off without tearing it." },
    ],
  }),
  component: TapePage,
});

function TapePage() {
  return (
    <main className="play">
      <TapeGame />
    </main>
  );
}
