import { createFileRoute } from "@tanstack/react-router";
import { MugGame } from "../components/chores/MugGame";

export const Route = createFileRoute("/mug")({
  head: () => ({
    meta: [
      { title: "Carry a Full Mug · Mildly Impossible" },
      { name: "description", content: "Carry a mug filled to the brim across the room without spilling on the rug. Or the cat." },
    ],
  }),
  component: MugPage,
});

function MugPage() {
  return (
    <main className="play">
      <MugGame />
    </main>
  );
}
