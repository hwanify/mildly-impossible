import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// On a phone the game is small. This blows the stage up to fill the screen: real full screen
// (turned sideways) where the browser allows it, and on the rest (iPhones) just the stage,
// as big as it goes, with everything else out of the way.
export function FullscreenToggle() {
  const [full, setFull] = useState(false);
  // the button sits in a corner of the game itself
  const [stage, setStage] = useState<Element | null>(null);
  useEffect(() => setStage(document.querySelector(".play > .stage")), []);

  useEffect(() => {
    document.querySelector(".play")?.classList.toggle("full", full);
    document.documentElement.classList.toggle("play-full", full);
    // the canvases size themselves from their boxes
    window.dispatchEvent(new Event("resize"));
  }, [full]);

  useEffect(() => {
    // leaving full screen with the back gesture or the browser's own button
    const onChange = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.documentElement.classList.remove("play-full");
    };
  }, []);

  const enter = async () => {
    setFull(true);
    try {
      await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
    } catch {
      /* not allowed here: the stage still fills the window */
    }
    try {
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
    } catch {
      /* not allowed here either */
    }
  };

  const exit = async () => {
    setFull(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* already out */
    }
    try {
      screen.orientation?.unlock?.();
    } catch {
      /* nothing to unlock */
    }
  };

  if (full)
    return (
      <button className="full-exit" onClick={exit} aria-label="Leave full screen">
        ✕
      </button>
    );
  return stage
    ? createPortal(
        <button className="full-enter" onClick={enter} onPointerDown={(e) => e.stopPropagation()}>
          ⤢ full screen
        </button>,
        stage,
      )
    : null;
}
