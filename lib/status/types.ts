export type GameStatus =
  | { state: 'loading' }
  | { state: 'ok'; label: string }
  | { state: 'warn'; label: string }
  | { state: 'error' }
