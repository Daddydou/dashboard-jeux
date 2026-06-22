export type GameStatus =
  | { state: 'loading' }
  | { state: 'ok'; label: string; sublabel?: string }
  | { state: 'warn'; label: string; sublabel?: string }
  | { state: 'error' }
