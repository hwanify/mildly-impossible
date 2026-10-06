// Google Analytics 4. Client-only: everything here runs from an effect, never at import (SSR).
//
// Page views come from GA4 itself (its enhanced measurement counts history changes, so moving
// between games counts too). On top of that, two events per game, worked out from the shared
// markup every game uses, so no game has to know about analytics:
//   game_start   the first press on the game's canvas (.stage canvas)
//   game_finish  the result card (.result) appearing; carries the big number and the tier
export const GA_ID = "G-R3CET66REX";

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  // gtag.js expects the arguments object itself, as in Google's snippet
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
  void args;
}

export function track(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}

const gameOf = () => {
  const slug = window.location.pathname.replace(/^\/+|\/+$/g, "");
  return slug || null;
};

/** Load gtag.js and start watching for game events. Returns a cleanup. */
export function installAnalytics() {
  if (typeof window === "undefined" || window.gtag) return () => {};
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  // one start and one finish per game page visit (reset when the page changes)
  let page = window.location.pathname;
  let started = false;
  let finished = false;
  const sync = () => {
    if (window.location.pathname !== page) {
      page = window.location.pathname;
      started = false;
      finished = false;
    }
  };
  const onDown = (e: PointerEvent) => {
    sync();
    const game = gameOf();
    if (!game || started) return;
    if (!(e.target instanceof Element) || !e.target.closest(".stage canvas")) return;
    started = true;
    track("game_start", { game });
  };
  const watch = new MutationObserver(() => {
    sync();
    const game = gameOf();
    if (!game) return;
    const card = document.querySelector(".result");
    if (!card) {
      // a new round after the receipt counts as another finish
      if (finished) finished = false;
      return;
    }
    if (finished) return;
    finished = true;
    const text = (sel: string) => card.querySelector(sel)?.textContent?.trim() ?? "";
    track("game_finish", { game, score: text(".result-score"), tier: text(".result-tier") });
  });
  document.addEventListener("pointerdown", onDown, true);
  watch.observe(document.body, { childList: true, subtree: true });
  return () => {
    document.removeEventListener("pointerdown", onDown, true);
    watch.disconnect();
  };
}
