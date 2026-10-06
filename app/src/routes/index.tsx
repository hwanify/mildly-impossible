import { createFileRoute, Link } from "@tanstack/react-router";
import { SheetArt, TapeArt, DuvetArt } from "../components/chores/ChoreArt";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="hub">
      <h1 className="jua hub-title">
        일상<span>보스전</span>
      </h1>
      <p className="hub-sub">
        매일 지는데 아무도 연습시켜 주지 않는 싸움들.
        <br />
        강좌 앱 말고, 직접 져 보세요.
      </p>
      <div className="boss-grid">
        <Link to="/fitted-sheet" className="boss">
          <div className="boss-art" style={{ background: "var(--butter)" }}>
            <SheetArt />
          </div>
          <div className="boss-body">
            <div className="jua boss-name">피티드 시트 개기</div>
            <p className="boss-desc">고무줄이 든 침대 시트를 네모 반듯하게. 네 모서리가 동시에 당신을 거부합니다.</p>
            <div className="boss-hp">
              <i />
              도전 가능
            </div>
          </div>
        </Link>
        <div className="boss soon" aria-disabled="true">
          <div className="boss-art" style={{ background: "var(--mint)" }}>
            <TapeArt />
          </div>
          <div className="boss-body">
            <div className="jua boss-name">테이프 끝 찾기</div>
            <p className="boss-desc">분명 어딘가에 있습니다. 손톱으로 한 바퀴를 다 돌아도요.</p>
            <div className="boss-hp">
              <i />
              준비 중
            </div>
          </div>
        </div>
        <div className="boss soon" aria-disabled="true">
          <div className="boss-art" style={{ background: "var(--lilac)" }}>
            <DuvetArt />
          </div>
          <div className="boss-body">
            <div className="jua boss-name">이불 커버 씌우기</div>
            <p className="boss-desc">들어가는 건 이불인데 왜 내가 안에 갇혀 있을까요.</p>
            <div className="boss-hp">
              <i />
              준비 중
            </div>
          </div>
        </div>
      </div>
      <p className="hub-foot">보스는 하나씩 늘어납니다.</p>
    </main>
  );
}
