import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PLACES, copyLink, hasSheet, postOn, receiptFile, saveFile, scoreLink, shareSheet } from "./share";

type Payload = { game: string; from: string; title: string; text: string; url: string; file?: File | null };

/**
 * Hand something on: the phone's share sheet on a phone; elsewhere a small handwritten slip with
 * copy link, the usual places, and (for a receipt) save the picture.
 */
function useHandOn() {
  const [slip, setSlip] = useState<{ at: DOMRect; p: Payload; receipt: HTMLElement | null } | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const flash = (s: string) => {
    setSaid(s);
    window.setTimeout(() => setSaid(null), 2400);
  };
  const handOn = async (el: HTMLElement, p: Payload, receipt: HTMLElement | null) => {
    if (hasSheet()) {
      const file = receipt ? await receiptFile(receipt, p.game) : null;
      if ((await shareSheet({ ...p, file })) === "copied") flash("Copied. Now they'll know.");
      return;
    }
    setSlip({ at: el.getBoundingClientRect(), p, receipt });
  };
  const ui = slip ? (
    <ShareSlip
      at={slip.at}
      receipt={!!slip.receipt}
      onClose={() => setSlip(null)}
      onCopy={async () => {
        const p = slip.p;
        setSlip(null);
        if ((await copyLink(p)) === "copied") flash("Copied. Now they'll know.");
      }}
      onPlace={(place) => {
        postOn(place, slip.p);
        setSlip(null);
      }}
      onSave={async () => {
        const r = slip.receipt;
        setSlip(null);
        if (!r) return;
        const file = await receiptFile(r, slip.p.game);
        if (file) saveFile(file, slip.p.game);
      }}
    />
  ) : null;
  return { handOn, ui, said };
}

/** The slip that unfolds next to the link on a computer. Escape or a click elsewhere puts it away. */
function ShareSlip(o: { at: DOMRect; receipt: boolean; onClose: () => void; onCopy: () => void; onPlace: (p: (typeof PLACES)[number]["id"]) => void; onSave: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) o.onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && o.onClose();
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", key);
    };
  }, [o]);
  // under the link, kept on screen
  const left = Math.min(Math.max(8, o.at.left), window.innerWidth - 200);
  const below = o.at.bottom + 8;
  const top = below + 230 > window.innerHeight ? Math.max(8, o.at.top - 238) : below;
  // on the page itself, not inside the (tilted, scrolling) receipt that would clip it
  return createPortal(
    <div ref={ref} className="share-slip" role="menu" style={{ left, top }}>
      <span className="share-slip-head">send it to</span>
      <button type="button" role="menuitem" onClick={o.onCopy}>
        Copy link
      </button>
      {PLACES.map((p) => (
        <button key={p.id} type="button" role="menuitem" onClick={() => o.onPlace(p.id)}>
          {p.name}
        </button>
      ))}
      {o.receipt && (
        <button type="button" role="menuitem" onClick={o.onSave}>
          Save the receipt
        </button>
      )}
    </div>,
    document.body,
  );
}

type Props = {
  /** The game's slug, for the link and for analytics. */
  slug: string;
  /** The game's title, for the share sheet. */
  title: string;
  /** What to say with the link. */
  text?: () => string;
  /** The dare, in the game's words: "Dare someone who folds sheets". */
  children?: string;
};

/** Under the to-do slip: a handwritten dare with an arrow, that hands the game's link on. */
export function ShareButton({ slug, title, text, children = "Send this to someone" }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const { handOn, ui, said } = useHandOn();
  const go = () => {
    if (!ref.current) return;
    const say = text?.() ?? `${title}. Everyone else seems to manage.`;
    void handOn(ref.current, { game: slug, from: "page", title, text: say, url: scoreLink(slug) }, null);
  };
  return (
    <>
      <button ref={ref} type="button" className="btn-share" onClick={go} aria-live="polite">
        {said ?? children}
      </button>
      {ui}
    </>
  );
}

/**
 * The stub at the bottom of a receipt, for a friend: what you got and a dare, on a dashed line with
 * scissors. Tearing it off shares the receipt (picture and all) with a link that carries the score.
 * Put it inside the `.result`, outside `.result-row`.
 */
export function ShareCoupon({ slug, title, text }: { slug: string; title: string; text?: () => string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [torn, setTorn] = useState(false);
  const [lines, setLines] = useState<{ got: string; tier: string }>({ got: "", tier: "" });
  const { handOn, ui, said } = useHandOn();
  // the receipt's own score and tier, read once it is on screen
  useEffect(() => {
    const r = ref.current?.closest<HTMLElement>(".result");
    const get = (sel: string) => r?.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    setLines({ got: get(".result-score"), tier: get(".result-tier") });
  }, []);
  const go = () => {
    const el = ref.current;
    const receipt = el?.closest<HTMLElement>(".result") ?? null;
    if (!el || !receipt) return;
    setTorn(true);
    window.setTimeout(() => setTorn(false), 900);
    const say = text?.() ?? `I got ${lines.got}${lines.tier ? `, "${lines.tier}"` : ""} on ${title}. Bet you can't beat it.`;
    void handOn(el, { game: slug, from: "receipt", title, text: say, url: scoreLink(slug, lines.got, lines.tier) }, receipt);
  };
  return (
    <>
      <button ref={ref} type="button" className={`coupon${torn ? " torn" : ""}`} onClick={go} aria-label="Tear off and send to a friend">
        <span className="coupon-line coupon-head">For a friend</span>
        <span className="coupon-line">
          I got {lines.got}
          {lines.tier ? `. ${lines.tier}` : ""}.
        </span>
        <span className="coupon-line">Bet you can't beat it.</span>
        <span className="coupon-cta">{said ?? "Tear off and send"}</span>
      </button>
      {ui}
    </>
  );
}

/** "Save receipt": the receipt as a picture, straight to the device. Put it inside the `.result`. */
export function SaveReceipt({ slug, className = "btn-share" }: { slug: string; className?: string }) {
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
