import type { SVGProps } from 'react'

/** Icônes à trait, 24 px, couleur du texte. Aucune dépendance. */
function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

type P = SVGProps<SVGSVGElement>

export const IconeReglages = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h9M19 7h1M4 17h1M11 17h9" />
    <circle cx="16" cy="7" r="2.2" />
    <circle cx="8" cy="17" r="2.2" />
  </Svg>
)

export const IconeRetour = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 6l-6 6 6 6" />
  </Svg>
)

export const IconePlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconeCrayon = (p: P) => (
  <Svg {...p}>
    <path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1z" />
  </Svg>
)

export const IconeHaut = (p: P) => (
  <Svg {...p}>
    <path d="M6 14l6-6 6 6" />
  </Svg>
)

export const IconeBas = (p: P) => (
  <Svg {...p}>
    <path d="M6 10l6 6 6-6" />
  </Svg>
)

export const IconeCoche = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
)

export const IconeSortie = (p: P) => (
  <Svg {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 8l-4 4 4 4M5 12h10" />
  </Svg>
)
