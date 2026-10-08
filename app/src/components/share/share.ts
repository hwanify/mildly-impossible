// Sharing a game: a link (with the score in it, so the preview and the page can show it), the text
// to go with it, and on a result, the till receipt itself as a picture. Client-only: everything here
// runs on a click, never at import (SSR).
import { track } from "../../lib/analytics";

export type ShareOutcome = "shared" | "copied" | "saved" | "cancelled";

const clip = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

/** `/<slug>`, with the score and tier when there is one: the page and its link preview read them back. */
export function scoreLink(slug: string, score?: string, tier?: string) {
  const u = new URL(`/${slug}`, window.location.origin);
  if (score) u.searchParams.set("s", clip(score, 24));
  if (tier) u.searchParams.set("t", clip(tier, 40));
  return u.toString();
}

/**
 * Hand it to the phone's share sheet (with the receipt picture when the phone can take files), or
 * copy the text and link where there is no share sheet.
 */
export async function shareOut(o: { game: string; from: string; title: string; text: string; url: string; file?: File | null }): Promise<ShareOutcome> {
  const report = (method: string) => track("share", { game: o.game, from: o.from, method });
  try {
    if (o.file && navigator.canShare?.({ files: [o.file] })) {
      // some apps drop the url when there is a file, so it goes in the text as well
      await navigator.share({ files: [o.file], title: o.title, text: `${o.text} ${o.url}` });
      report("image");
      return "shared";
    }
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: o.title, text: o.text, url: o.url });
      report("sheet");
      return "shared";
    }
    await navigator.clipboard.writeText(`${o.text} ${o.url}`);
    report("copy");
    return "copied";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    try {
      await navigator.clipboard.writeText(`${o.text} ${o.url}`);
      report("copy");
      return "copied";
    } catch {
      return "cancelled";
    }
  }
}

/** Save a picture to the device. */
export function saveFile(file: File, game: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  track("share", { game, from: "receipt", method: "save" });
}

const PAPER = "#FBFAF6";
const INK = "#2A2927";
const MONO = '"Courier Prime", "Courier New", monospace';

/**
 * The till receipt on screen, redrawn as a picture from what it says: the label, any drawing on it
 * (the cut pizza, the peel), the lines of figures, the big number, the tier and the line under it.
 * Works for every game's receipt because they all use the same `.result-*` parts.
 */
export async function receiptFile(el: HTMLElement, slug: string): Promise<File | null> {
  const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const label = text(".result-label");
  const score = text(".result-score");
  const tier = text(".result-tier");
  const line = text(".result-line");
  const stats = [...el.querySelectorAll(".result-stats > div")].map((row) => {
    const value = row.querySelector("strong")?.textContent?.trim() ?? "";
    const name = (row.textContent ?? "").replace(value, "").trim();
    return [name, value] as const;
  });
  const pictures = [...el.querySelectorAll("canvas")].filter((c) => c.width > 0 && c.height > 0);
  try {
    await Promise.all([document.fonts.load(`700 40px ${MONO}`), document.fonts.load(`400 20px ${MONO}`)]);
  } catch {
    /* falls back to Courier */
  }

  const S = 2; // drawn at twice the on-screen size, so it stays sharp when shared
  const Wd = 380;
  const pad = 26;
  const inner = Wd - pad * 2;
  const measure = document.createElement("canvas").getContext("2d")!;
  const wrap = (s: string, font: string) => {
    measure.font = font;
    const out: string[] = [];
    let cur = "";
    for (const word of s.split(" ")) {
      const next = cur ? `${cur} ${word}` : word;
      if (measure.measureText(next).width > inner && cur) {
        out.push(cur);
        cur = word;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };

  // lay it out once to know the height, then draw it
  type Op = { h: number; draw: (g: CanvasRenderingContext2D, y: number) => void };
  const ops: Op[] = [];
  const textLines = (s: string, font: string, lh: number, align: CanvasTextAlign = "center") => {
    for (const l of wrap(s, font))
      ops.push({
        h: lh,
        draw: (g, y) => {
          g.font = font;
          g.textAlign = align;
          g.fillText(l, align === "center" ? Wd / 2 : pad, y + lh * 0.78);
        },
      });
  };
  const gap = (h: number) => ops.push({ h, draw: () => {} });
  const dashed = () =>
    ops.push({
      h: 14,
      draw: (g, y) => {
        g.setLineDash([5, 4]);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(pad, y + 7);
        g.lineTo(Wd - pad, y + 7);
        g.stroke();
        g.setLineDash([]);
      },
    });

  gap(22);
  textLines("MILDLY IMPOSSIBLE", `700 16px ${MONO}`, 20);
  textLines("HOUSEHOLD PRACTICE ROOM", `700 16px ${MONO}`, 20);
  dashed();
  if (label) textLines(label.toUpperCase(), `700 14px ${MONO}`, 19, "left");
  for (const c of pictures) {
    const w = Math.min(inner, 240);
    const h = (c.height / c.width) * w;
    ops.push({ h: h + 10, draw: (g, y) => g.drawImage(c, (Wd - w) / 2, y + 5, w, h) });
  }
  if (stats.length) {
    gap(4);
    for (const [name, value] of stats)
      ops.push({
        h: 18,
        draw: (g, y) => {
          g.font = `400 13.5px ${MONO}`;
          g.textAlign = "left";
          g.fillText(name.toUpperCase(), pad, y + 14);
          g.textAlign = "right";
          g.fillText(value, Wd - pad, y + 14);
        },
      });
    dashed();
  }
  if (score) textLines(score, `700 64px ${MONO}`, 70);
  if (tier) textLines(tier.toUpperCase(), `700 16px ${MONO}`, 22);
  if (line) textLines(line.toUpperCase(), `400 13px ${MONO}`, 17);
  dashed();
  // a barcode, then where to find it
  ops.push({
    h: 46,
    draw: (g, y) => {
      const bw = inner * 0.72;
      let x = (Wd - bw) / 2;
      const pattern = [2, 2, 1, 3, 3, 1, 1, 3, 2, 1, 1, 2, 3, 1, 2, 2];
      for (let i = 0; x < (Wd + bw) / 2; i++) {
        const w = pattern[i % pattern.length];
        if (i % 2 === 0) g.fillRect(x, y + 8, w, 32);
        x += w + 1;
      }
    },
  });
  textLines("THANK YOU. PLEASE TRY AGAIN.", `400 11.5px ${MONO}`, 16);
  textLines(`mildlyimpossible.com/${slug}`, `700 13px ${MONO}`, 20);
  gap(22);

  const Ht = ops.reduce((a, o) => a + o.h, 0);
  const cv = document.createElement("canvas");
  cv.width = Wd * S;
  cv.height = Ht * S;
  const g = cv.getContext("2d")!;
  g.scale(S, S);
  // the paper, with torn zigzag ends
  g.fillStyle = PAPER;
  g.beginPath();
  g.moveTo(0, 6);
  for (let x = 0; x <= Wd; x += 8) g.lineTo(x, x % 16 ? 0 : 6);
  for (let x = Wd; x >= 0; x -= 8) g.lineTo(x, Ht - (x % 16 ? 0 : 6));
  g.closePath();
  g.fill();
  g.fillStyle = INK;
  g.strokeStyle = INK;
  let y = 0;
  for (const o of ops) {
    o.draw(g, y);
    y += o.h;
  }
  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/png"));
  return blob ? new File([blob], `mildly-impossible-${slug}.png`, { type: "image/png" }) : null;
}
