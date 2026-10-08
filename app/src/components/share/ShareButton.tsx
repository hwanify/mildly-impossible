import { useRef, useState } from "react";
import { receiptFile, saveFile, scoreLink, shareOut } from "./share";

type Props = {
  /** The game's slug, for the link and for analytics. */
  slug: string;
  /** The game's title, for the share sheet. */
  title: string;
  /** What to say with the link. On a receipt it defaults to the receipt's label, score and tier. */
  text?: () => string;
  className?: string;
  children?: string;
};

/**
 * One "Share" for every game. Inside a till receipt (`.result`) it shares the receipt as a picture
 * along with a link that carries the score; anywhere else it shares the game's link and `text`.
 */
export function ShareButton({ slug, title, text, className = "btn-shake", children = "Share" }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const flash = (s: string) => {
    setSaid(s);
    window.setTimeout(() => setSaid(null), 2200);
  };

  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const receipt = ref.current?.closest<HTMLElement>(".result");
      if (receipt) {
        const get = (sel: string) => receipt.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const score = get(".result-score");
        const tier = get(".result-tier");
        const say = text?.() ?? `${title}: ${score}.${tier ? ` "${tier}."` : ""}`;
        const file = await receiptFile(receipt, slug);
        const out = await shareOut({ game: slug, from: "receipt", title, text: say, url: scoreLink(slug, score, tier), file });
        if (out === "copied") flash("Link copied");
      } else {
        const say = text?.() ?? `${title}. Everyone else seems to manage.`;
        const out = await shareOut({ game: slug, from: "page", title, text: say, url: scoreLink(slug) });
        if (out === "copied") flash("Link copied");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button ref={ref} type="button" className={className} onClick={go} aria-live="polite">
      {said ?? children}
    </button>
  );
}

/** "Save receipt": the receipt as a picture, straight to the device. Put it inside the `.result`. */
export function SaveReceipt({ slug, className = "btn-keep" }: { slug: string; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const go = async () => {
    const receipt = ref.current?.closest<HTMLElement>(".result");
    if (!receipt) return;
    const file = await receiptFile(receipt, slug);
    if (file) saveFile(file, slug);
  };
  return (
    <button ref={ref} type="button" className={className} onClick={go}>
      Save receipt
    </button>
  );
}
