import { createFileRoute } from "@tanstack/react-router";
import { FittedSheetGame } from "../components/chores/FittedSheetGame";

export const Route = createFileRoute("/fitted-sheet")({
  head: () => ({
    meta: [
      { title: "피티드 시트 개기 · 일상 보스전" },
      { name: "description", content: "고무줄 든 침대 시트를 네모 반듯하게 개는 브라우저 게임." },
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
