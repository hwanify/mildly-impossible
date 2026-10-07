// The building on the hub's table: a little cut-away model of it, a few people (and the cat)
// inside, everything in it slightly wrong.
const INK = "#1C1C1A";

function Person({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g>
      <rect x={x - 3} y={y - 9} width="6" height="9" rx="2" fill={c} stroke={INK} strokeWidth="0.6" />
      <circle cx={x} cy={y - 12} r="3.3" fill="#EAD3B8" stroke={INK} strokeWidth="0.6" />
    </g>
  );
}

export function BuildingTableItem() {
  // four storeys, floor lines at these y
  const floors = [78, 136, 194, 252];
  const walls = ["#E9DFCC", "#E3E1D6", "#DDE4DA", "#E4E0D4"];
  return (
    <svg width="240" height="300" viewBox="0 0 230 288" aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <g style={{ filter: "drop-shadow(3px 6px 6px rgba(28,28,26,0.22))" }}>
        {/* the shell, the roof, the slabs */}
        <rect x="16" y="22" width="198" height="238" fill="#B9B1A3" stroke={INK} strokeWidth="1.5" />
        <polygon points="8,24 115,4 222,24" fill="#8D857A" stroke={INK} strokeWidth="1.5" />
        {floors.map((fy, i) => (
          <g key={fy}>
            {/* stairwell, flat, lift shaft */}
            <rect x="22" y={fy - 52} width="30" height="52" fill="#D6D0C4" />
            <path d={i % 2 ? `M24 ${fy - 2} L50 ${fy - 50}` : `M50 ${fy - 2} L24 ${fy - 50}`} stroke="#8D857A" strokeWidth="5" strokeDasharray="3 2" />
            <rect x="56" y={fy - 52} width="132" height="52" fill={walls[i]} />
            <rect x="192" y={fy - 52} width="16" height="52" fill="#77716A" />
            <rect x="16" y={fy} width="198" height="6" fill="#A9A195" stroke={INK} strokeWidth="1" />
          </g>
        ))}
        {/* the lift, stuck somewhere in the middle */}
        <rect x="193" y="118" width="14" height="18" fill="#D9CFB8" stroke={INK} strokeWidth="0.8" />
        <line x1="200" y1="28" x2="200" y2="118" stroke="#2E2C28" strokeWidth="0.8" />
        {/* top floor: the picture (crooked), the sofa, the cat on it */}
        <g transform="rotate(5 100 46)">
          <rect x="86" y="36" width="28" height="20" fill="#6B4E33" />
          <rect x="89" y="39" width="22" height="14" fill="#F4EFE2" />
          <path d="M89 53 Q 98 42 104 50 Q 108 45 111 53 Z" fill="#A9BFA4" />
        </g>
        <rect x="120" y="62" width="56" height="16" rx="4" fill="#7D8C9E" stroke={INK} strokeWidth="0.7" />
        <ellipse cx="156" cy="60" rx="8" ry="4.5" fill="#3A3631" />
        <circle cx="163" cy="57" r="3.5" fill="#3A3631" />
        <Person x={80} y={78} c="#C0533F" />
        {/* next: boxes, a mattress, the fridge left open */}
        <g fill="#C9A57A" stroke={INK} strokeWidth="0.7">
          <rect x="60" y="120" width="18" height="16" />
          <rect x="79" y="120" width="18" height="16" />
          <rect x="68" y="105" width="18" height="15" />
        </g>
        <rect x="104" y="130" width="40" height="6" fill="#EDE6D6" stroke={INK} strokeWidth="0.6" />
        <rect x="160" y="100" width="22" height="36" fill="#FFF6D2" stroke={INK} strokeWidth="0.8" />
        <polygon points="160,100 150,103 150,134 160,136" fill="#EEEDE7" stroke={INK} strokeWidth="0.7" />
        <text x="171" y="96" textAnchor="middle" fontFamily="'Reenie Beanie', cursive" fontSize="11" fill="#B4513A">
          beep
        </text>
        {/* the kitchen: counter, the tap, a pile of plates */}
        <rect x="96" y="176" width="88" height="18" fill="#C9B79A" stroke={INK} strokeWidth="0.7" />
        <path d="M150 176 L150 166 Q150 162 144 162" fill="none" stroke="#9AA3A8" strokeWidth="2.5" />
        <circle cx="143" cy="170" r="1.4" fill="#78AAC8" />
        {[0, 1, 2, 3].map((k) => (
          <ellipse key={k} cx="112" cy={174 - k * 3} rx="9" ry="1.8" fill="#F4F1EA" stroke={INK} strokeWidth="0.5" />
        ))}
        <Person x={170} y={194} c="#2D4C9A" />
        {/* the lobby: the way out, the mat (rucked), the post, the courier */}
        <rect x="60" y="214" width="20" height="38" fill="#EEF0EA" stroke={INK} strokeWidth="0.9" />
        <path d="M58 252 L84 252 L84 250 Q 80 243 76 249 L58 249 Z" fill="#9C6B3E" stroke={INK} strokeWidth="0.6" />
        <rect x="120" y="212" width="40" height="24" fill="#A9A69E" stroke={INK} strokeWidth="0.7" />
        <rect x="140" y="206" width="8" height="10" fill="#E3B556" stroke={INK} strokeWidth="0.5" transform="rotate(-12 144 211)" />
        <Person x={102} y={252} c="#4F7A5A" />
        {/* footprints up the stairs */}
        {[[30, 232], [38, 220], [44, 207]].map(([x, y]) => (
          <ellipse key={x} cx={x} cy={y} rx="3" ry="1.2" fill="rgba(92,66,40,0.6)" />
        ))}
      </g>
    </svg>
  );
}
