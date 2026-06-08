export type Player = {
  id: string
  name: string
  score: number
  isHost: boolean
  hasGuessed: boolean
}

export type DrawEvent = {
  type: 'draw' | 'clear'
  x: number
  y: number
  prevX: number
  prevY: number
  color: string
  size: number
  isNewStroke: boolean
}

export type ChatMessage = {
  id: string
  playerId: string
  playerName: string
  text: string
  msgType: 'chat' | 'correct' | 'system'
}

export type GamePhase = 'lobby' | 'drawing' | 'roundEnd' | 'gameEnd'

export type RoomSettings = {
  totalRounds: number
  drawTime: number
}

export type GameState = {
  phase: GamePhase
  players: Player[]
  currentDrawerId: string | null
  wordHint: string
  currentRound: number
  totalRounds: number
  timeLeft: number
  chat: ChatMessage[]
  settings: RoomSettings
  drawerOrder: string[]
  drawerIndex: number
}

// Client → Server
export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'start-game' }
  | { type: 'draw'; event: DrawEvent }
  | { type: 'clear-canvas' }
  | { type: 'guess'; text: string }
  | { type: 'update-settings'; settings: Partial<RoomSettings> }

// Server → Client
export type ServerMessage =
  | { type: 'game-state'; state: GameState }
  | { type: 'draw'; event: DrawEvent }
  | { type: 'clear-canvas' }
  | { type: 'your-word'; word: string }
  | { type: 'timer'; timeLeft: number }
  | { type: 'error'; message: string }
