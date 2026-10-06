const INK = "#1B1F2A";

export function SheetArt() {
  return (
    <svg viewBox="0 0 200 160" aria-hidden="true">
      <path d="M44 66C34 40 78 30 100 44c24-18 70-6 60 30 16 24-8 56-48 46-26 14-74 4-68-26z" fill="#7EB6F2" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M70 60c14 10 40 10 58 0M62 92c20 8 52 10 76-4" fill="none" stroke="#4E8FD8" strokeWidth="4" strokeLinecap="round" />
      <path d="M44 66c-14-4-20-18-8-26M160 74c14-6 16-22 4-30M112 120c4 14-6 24-18 22M50 96c-16 6-22 20-12 30" fill="none" stroke="#2459A0" strokeWidth="5" strokeLinecap="round" />
      <path d="M58 110l6-6 6 6 6-6 6 6 6-6" fill="none" stroke="#2459A0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="150" cy="30" r="5" fill="#FF5A4E" stroke={INK} strokeWidth="3" />
      <path d="M168 18l6-8M176 32l9-2" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function TapeArt() {
  return (
    <svg viewBox="0 0 200 160" aria-hidden="true">
      <ellipse cx="92" cy="86" rx="56" ry="54" fill="#E6EEF7" stroke={INK} strokeWidth="4" />
      <path d="M52 60a50 50 0 0 1 40-22" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity=".9" />
      <ellipse cx="92" cy="86" rx="28" ry="27" fill="#F2DDBB" stroke={INK} strokeWidth="4" />
      <ellipse cx="92" cy="86" rx="18" ry="17" fill="#CDEFD9" stroke={INK} strokeWidth="3" />
      <circle cx="152" cy="46" r="20" fill="#fff" fillOpacity=".7" stroke={INK} strokeWidth="5" />
      <path d="M166 60l18 18" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d="M30 30l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill="#FFD84D" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M160 116l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#FFD84D" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function DuvetArt() {
  return (
    <svg viewBox="0 0 200 160" aria-hidden="true">
      <circle cx="40" cy="86" r="18" fill="#fff" stroke={INK} strokeWidth="4" />
      <circle cx="30" cy="106" r="14" fill="#fff" stroke={INK} strokeWidth="4" />
      <circle cx="44" cy="66" r="13" fill="#fff" stroke={INK} strokeWidth="4" />
      <path d="M48 46h110a14 14 0 0 1 14 14v58a14 14 0 0 1-14 14H48z" fill="#FF8A7A" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M150 46l22 22V60a14 14 0 0 0-14-14z" fill="#FF5A4E" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M88 46l-8-26M126 46l10-28" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <circle cx="79" cy="17" r="7" fill="#FFD7B8" stroke={INK} strokeWidth="3.5" />
      <circle cx="137" cy="15" r="7" fill="#FFD7B8" stroke={INK} strokeWidth="3.5" />
      <path d="M74 92c16-10 36 10 54 0s28-6 34 2" fill="none" stroke="#E0503F" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
