/**
 * Les lignes du terrain, tracées à la craie derrière le contenu d'une carte
 * « à la une » : un court de tennis vu de dessus, ou une raquette de basket.
 * Purement décoratif.
 */
export function TracesCourt() {
  return (
    <svg
      viewBox="0 0 260 120"
      aria-hidden="true"
      className="pointer-events-none absolute left-[22%] top-1/2 w-[120%] -translate-y-1/2 opacity-[0.15]"
      fill="none"
      stroke="white"
      strokeWidth="1.6"
    >
      <rect x="10" y="10" width="240" height="100" />
      <path d="M10 22.5h240M10 97.5h240M65 22.5v75M195 22.5v75M65 60h130M10 60h5M245 60h5" />
      <path d="M130 4v112" strokeWidth="3" strokeDasharray="1 3" />
    </svg>
  )
}

export function TracesRaquette() {
  return (
    <svg
      viewBox="0 0 200 150"
      aria-hidden="true"
      className="pointer-events-none absolute -right-6 top-1/2 h-[125%] -translate-y-1/2 opacity-[0.24]"
      fill="none"
      stroke="white"
      strokeWidth="1.6"
    >
      <rect x="128" y="47" width="72" height="56" fill="rgba(0,0,0,0.18)" />
      <circle cx="128" cy="75" r="28" />
      <path d="M200 8h-30a67 67 0 0 0 0 134h30" />
      <circle cx="186" cy="75" r="5" />
      <path d="M194 66v18" strokeWidth="2.4" />
    </svg>
  )
}
