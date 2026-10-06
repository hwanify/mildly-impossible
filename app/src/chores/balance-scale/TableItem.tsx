// The scale on the hub's table, from above: a dial that never quite settles on zero.
export function ScaleTableItem() {
  return (
    <svg width="280" height="170" viewBox="0 0 300 190" fill="none" aria-hidden="true">
      <rect x="20" y="40" width="260" height="120" rx="14" fill="#D9D4CA" stroke="#B8B1A4" strokeWidth="2" />
      <circle cx="150" cy="100" r="42" fill="#FBFAF7" stroke="#8C877C" strokeWidth="3" />
      <path d="M150 100l22-18" stroke="#B4513A" strokeWidth="3" strokeLinecap="round" />
      <path d="M120 100h6M174 100h6M150 70v6" stroke="#8C877C" strokeWidth="2" />
      <circle cx="58" cy="76" r="6" fill="#8C877C" />
    </svg>
  );
}
