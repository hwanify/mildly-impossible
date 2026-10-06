import { createFileRoute } from "@tanstack/react-router";
import { FittedSheetGame } from "../components/chores/FittedSheetGame";

export const Route = createFileRoute("/fitted-sheet")({
  head: () => ({
    meta: [
      { title: "Fold a Fitted Sheet · Mildly Impossible" },
      { name: "description", content: "Fold an elastic fitted sheet into a neat rectangle, in your browser." },
    ],
  }),
  component: FittedSheetPage,
});

function FittedSheetPage() {
  return (
    <main className="play">
      <FittedSheetGame />
    </main>
  );
}
