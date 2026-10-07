// The building on the hub's table: its keys, on a ring with a paper tag.
export function BuildingTableItem() {
  return (
    <svg width="290" height="235" viewBox="0 0 210 170" aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <g style={{ filter: "drop-shadow(2px 4px 4px rgba(28,28,26,0.22))" }}>
        {/* the paper tag on its string */}
        <path d="M70 58 C 90 40, 110 30, 132 26" fill="none" stroke="#8C7B60" strokeWidth="1.5" />
        <g transform="rotate(-14 166 30)">
          <path d="M132 14 h70 a4 4 0 0 1 4 4 v28 a4 4 0 0 1 -4 4 h-70 l-12 -18 z" fill="#F6EED8" stroke="#1C1C1A" strokeWidth="1.3" />
          <circle cx="134" cy="32" r="3" fill="#F4F1EA" stroke="#1C1C1A" strokeWidth="1" />
          <text x="170" y="40" textAnchor="middle" fontFamily="'Reenie Beanie', cursive" fontSize="22" fill="#2D4C9A">
            flat 5
          </text>
        </g>
        {/* the ring */}
        <circle cx="62" cy="70" r="24" fill="none" stroke="#9AA0A3" strokeWidth="4" />
        {/* a brass key */}
        <g transform="rotate(38 62 92)">
          <circle cx="62" cy="104" r="16" fill="#D3A84E" stroke="#1C1C1A" strokeWidth="1.3" />
          <circle cx="62" cy="98" r="4" fill="#F4F1EA" stroke="#1C1C1A" strokeWidth="1" />
          <path d="M57 118 h10 v40 l-4 6 h-2 v-6 h-4 v-6 h4 v-5 h-4 v-6 h4 z" fill="#D3A84E" stroke="#1C1C1A" strokeWidth="1.2" />
        </g>
        {/* a silver one, for a door nobody remembers */}
        <g transform="rotate(-8 62 92)">
          <rect x="48" y="90" width="28" height="22" rx="6" fill="#C9CDD0" stroke="#1C1C1A" strokeWidth="1.3" />
          <circle cx="62" cy="97" r="3.5" fill="#F4F1EA" stroke="#1C1C1A" strokeWidth="1" />
          <path d="M58 112 h8 v44 h-3 v-4 h-3 v-5 h3 v-4 h-3 v-5 h3 v-4 h-5 z" fill="#C9CDD0" stroke="#1C1C1A" strokeWidth="1.2" />
        </g>
      </g>
    </svg>
  );
}
