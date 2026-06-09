import type * as Party from "partykit/server"
import type { ChatMessage, DrawEvent, GameState, Player, RoomSettings } from "../lib/types"
import { WORDS_ZH, getWordHint } from "../lib/words"

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export default class GameServer implements Party.Server {
  private state: GameState
  private currentWord = ""
  private timer: ReturnType<typeof setInterval> | null = null
  private hintTimer: ReturnType<typeof setTimeout> | null = null

  // Track which char indices have been revealed as hints
  private revealedIndices: Set<number> = new Set()
  // Track whether any correct guess happened this turn (for penalty logic)
  private anyCorrectThisTurn = false
  // Track used words within a game — reset each new game
  private usedWords: Set<string> = new Set()

  constructor(readonly room: Party.Room) {
    this.state = this.initState()
  }

  initState(): GameState {
    return {
      phase: "lobby",
      players: [],
      currentDrawerId: null,
      wordHint: "",
      currentRound: 1,
      totalRounds: 3,
      timeLeft: 80,
      chat: [],
      settings: { totalRounds: 3, drawTime: 80 },
      drawerOrder: [],
      drawerIndex: 0,
    }
  }

  async onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "game-state", state: this.state }))
  }

  async onClose(conn: Party.Connection) {
    const leavingPlayer = this.state.players.find((p) => p.id === conn.id)
    if (!leavingPlayer) return

    this.state.players = this.state.players.filter((p) => p.id !== conn.id)

    if (this.state.players.length > 0 && !this.state.players.some((p) => p.isHost)) {
      this.state.players[0].isHost = true
    }

    this.addSystem(`${leavingPlayer.name} 离开了游戏`)

    if (this.state.phase === "drawing" && this.state.currentDrawerId === conn.id) {
      this.endRound(true)
    } else {
      this.broadcastState()
    }

    if (this.state.players.length === 0) {
      this.stopTimer()
      this.state = this.initState()
    }
  }

  async onMessage(raw: string, sender: Party.Connection) {
    let msg: { type: string; [key: string]: unknown }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    switch (msg.type) {
      case "join":
        this.onJoin(sender, String(msg.name ?? ""))
        break
      case "start-game":
        this.onStartGame(sender)
        break
      case "draw":
        this.onDraw(sender, msg.event as DrawEvent)
        break
      case "clear-canvas":
        this.onClearCanvas(sender)
        break
      case "guess":
        this.onGuess(sender, String(msg.text ?? ""))
        break
      case "update-settings":
        this.onUpdateSettings(sender, msg.settings as Partial<RoomSettings>)
        break
    }
  }

  // ─── Handlers ────────────────────────────────────────────────

  onJoin(conn: Party.Connection, rawName: string) {
    if (this.state.players.find((p) => p.id === conn.id)) return

    if (this.state.phase === "drawing" || this.state.phase === "roundEnd") {
      conn.send(JSON.stringify({ type: "error", message: "游戏进行中，无法加入" }))
      return
    }

    const name = rawName.trim().slice(0, 16) || `玩家${this.state.players.length + 1}`
    const isHost = this.state.players.length === 0

    const player: Player = { id: conn.id, name, score: 0, isHost, hasGuessed: false }
    this.state.players.push(player)

    this.addSystem(`${name} 加入了游戏 👋`)

    conn.send(JSON.stringify({ type: "game-state", state: this.state }))
    this.broadcastState([conn.id])
  }

  onStartGame(conn: Party.Connection) {
    const player = this.state.players.find((p) => p.id === conn.id)
    if (!player?.isHost) return
    if (this.state.players.length < 2) return
    if (this.state.phase !== "lobby" && this.state.phase !== "gameEnd") return

    this.state.totalRounds = this.state.settings.totalRounds
    // Shuffle drawer order so first drawer is random each game
    this.state.drawerOrder = [...this.state.players.map((p) => p.id)].sort(() => Math.random() - 0.5)
    this.state.drawerIndex = 0
    this.state.currentRound = 1
    this.state.chat = []
    this.state.players.forEach((p) => { p.score = 0; p.hasGuessed = false })
    // Reset used words for a fresh game
    this.usedWords = new Set()

    this.startTurn()
  }

  onDraw(conn: Party.Connection, event: DrawEvent) {
    if (conn.id !== this.state.currentDrawerId) return
    if (this.state.phase !== "drawing") return
    this.room.broadcast(JSON.stringify({ type: "draw", event }), [conn.id])
  }

  onClearCanvas(conn: Party.Connection) {
    if (conn.id !== this.state.currentDrawerId) return
    this.room.broadcast(JSON.stringify({ type: "clear-canvas" }))
  }

  onGuess(conn: Party.Connection, text: string) {
    const player = this.state.players.find((p) => p.id === conn.id)
    if (!player) return
    if (conn.id === this.state.currentDrawerId) return
    if (player.hasGuessed) return
    if (this.state.phase !== "drawing") return

    const clean = text.trim().slice(0, 50)
    if (!clean) return

    const isCorrect = clean === this.currentWord

    if (isCorrect) {
      player.hasGuessed = true
      this.anyCorrectThisTurn = true

      // ── Guesser score ──────────────────────────────────────────
      // Time bonus: up to 300 pts depending on how fast they guessed
      const timePct = this.state.timeLeft / this.state.settings.drawTime
      const timeBonus = Math.round(timePct * 300)
      // Order bonus: first to guess gets most
      const alreadyGuessed = this.state.players.filter(
        (p) => p.hasGuessed && p.id !== this.state.currentDrawerId
      ).length
      const orderBonus = Math.max(0, 100 - (alreadyGuessed - 1) * 30)
      const guesserEarned = Math.max(50, timeBonus + orderBonus)
      player.score += guesserEarned

      // ── Drawer score: scales with how FAST the guess came ──────
      // Raised ceiling so drawing skill is more meaningful vs guessing speed
      // 80%+ time left → 150 pts | 50-80% → 100 pts | 20-50% → 60 pts | <20% → 25 pts
      const drawerEarned =
        timePct >= 0.8 ? 150 :
        timePct >= 0.5 ? 100 :
        timePct >= 0.2 ? 60 : 25

      const drawer = this.state.players.find((p) => p.id === this.state.currentDrawerId)
      if (drawer) drawer.score += drawerEarned

      this.addCorrect(player.name, guesserEarned, drawerEarned)

      // All non-drawers guessed?
      const nonDrawers = this.state.players.filter((p) => p.id !== this.state.currentDrawerId)
      if (nonDrawers.length > 0 && nonDrawers.every((p) => p.hasGuessed)) {
        this.endRound(false)
        return
      }
    } else {
      const msg: ChatMessage = {
        id: genId(),
        playerId: conn.id,
        playerName: player.name,
        text: clean,
        msgType: "chat",
      }
      this.state.chat.push(msg)
      this.trimChat()
    }

    this.broadcastState()
  }

  onUpdateSettings(conn: Party.Connection, settings: Partial<RoomSettings>) {
    const player = this.state.players.find((p) => p.id === conn.id)
    if (!player?.isHost) return
    if (this.state.phase !== "lobby" && this.state.phase !== "gameEnd") return

    if (settings.totalRounds !== undefined) {
      this.state.settings.totalRounds = Math.min(10, Math.max(1, settings.totalRounds))
    }
    if (settings.drawTime !== undefined) {
      this.state.settings.drawTime = Math.min(180, Math.max(20, settings.drawTime))
    }
    this.broadcastState()
  }

  // ─── Game Logic ───────────────────────────────────────────────

  pickUnusedWord(): string {
    const available = WORDS_ZH.filter((w) => !this.usedWords.has(w))
    if (available.length === 0) {
      // All 120 words exhausted (very long game) — reset and reuse
      this.usedWords.clear()
      return WORDS_ZH[Math.floor(Math.random() * WORDS_ZH.length)]
    }
    return available[Math.floor(Math.random() * available.length)]
  }

  startTurn() {
    // Guard: if all players left (stale setTimeout from endRound), do nothing
    if (this.state.players.length === 0) return

    while (
      this.state.drawerIndex < this.state.drawerOrder.length &&
      !this.state.players.find((p) => p.id === this.state.drawerOrder[this.state.drawerIndex])
    ) {
      this.state.drawerIndex++
    }

    if (this.state.drawerIndex >= this.state.drawerOrder.length) {
      if (this.state.currentRound >= this.state.totalRounds) {
        this.endGame()
        return
      }
      this.state.currentRound++
      this.state.drawerIndex = 0
      this.state.drawerOrder = this.state.players.map((p) => p.id)
      this.startTurn()
      return
    }

    const drawerId = this.state.drawerOrder[this.state.drawerIndex]
    this.currentWord = this.pickUnusedWord()
    this.usedWords.add(this.currentWord)
    this.revealedIndices = new Set()
    this.anyCorrectThisTurn = false

    this.state.phase = "drawing"
    this.state.currentDrawerId = drawerId
    this.state.wordHint = getWordHint(this.currentWord)
    this.state.timeLeft = this.state.settings.drawTime
    this.state.players.forEach((p) => { p.hasGuessed = false })

    const drawerName = this.state.players.find((p) => p.id === drawerId)?.name ?? "?"
    this.addSystem(`✏️ ${drawerName} 来画了！猜猜看～`)

    this.room.broadcast(JSON.stringify({ type: "clear-canvas" }))

    const drawerConn = this.room.getConnection(drawerId)
    drawerConn?.send(JSON.stringify({ type: "your-word", word: this.currentWord }))

    this.broadcastState()
    this.startTimer()
  }

  endRound(drawerLeft = false) {
    this.stopTimer()

    // ── Penalty: nobody guessed at all = likely sabotage ──────────
    // Only penalise when zero guesses happened (not just "some didn't guess")
    // Reduced to 20 pts to avoid punishing genuinely hard words too harshly
    if (!drawerLeft && !this.anyCorrectThisTurn) {
      const drawer = this.state.players.find((p) => p.id === this.state.currentDrawerId)
      if (drawer) {
        const penalty = 20
        drawer.score = Math.max(0, drawer.score - penalty)
        this.addSystem(`😤 没人猜中，${drawer.name} 扣 ${penalty} 分`)
      }
    }

    this.state.phase = "roundEnd"
    this.addSystem(`答案是：【${this.currentWord}】`)
    this.broadcastState()

    setTimeout(() => {
      this.state.drawerIndex++
      this.startTurn()
    }, 3500)
  }

  endGame() {
    this.stopTimer()
    this.state.phase = "gameEnd"
    this.state.currentDrawerId = null
    this.state.players.sort((a, b) => b.score - a.score)
    this.addSystem("🎉 游戏结束！")
    this.broadcastState()
  }

  startTimer() {
    this.stopTimer()
    this.timer = setInterval(() => {
      this.state.timeLeft--

      if (this.state.timeLeft <= 0) {
        this.stopTimer()
        this.endRound(false)
        return
      }

      // ── Progressive hints ─────────────────────────────────────
      // Reveal 1 random character at 50% time, another at 25% time
      const drawTime = this.state.settings.drawTime
      const at50 = Math.floor(drawTime * 0.5)
      const at25 = Math.floor(drawTime * 0.25)

      if (this.state.timeLeft === at50 || this.state.timeLeft === at25) {
        this.revealOneChar()
      }

      this.room.broadcast(JSON.stringify({ type: "timer", timeLeft: this.state.timeLeft }))
    }, 1000)
  }

  // Reveal one random hidden character in the word hint
  revealOneChar() {
    const chars = Array.from(this.currentWord)
    const hiddenIndices = chars.map((_, i) => i).filter((i) => !this.revealedIndices.has(i))
    // Keep at least 1 character hidden — never fully reveal the answer
    if (hiddenIndices.length <= 1) return

    // Pick a truly random hidden character to reveal
    const idx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)]
    this.revealedIndices.add(idx)

    // Rebuild hint with revealed chars
    this.state.wordHint = chars
      .map((c, i) => (this.revealedIndices.has(i) ? c : "_"))
      .join("  ")

    this.addSystem(`💡 提示：${this.state.wordHint}`)
    this.broadcastState()
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.hintTimer) {
      clearTimeout(this.hintTimer)
      this.hintTimer = null
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  addSystem(text: string) {
    this.state.chat.push({ id: genId(), playerId: "system", playerName: "", text, msgType: "system" })
    this.trimChat()
  }

  addCorrect(guesserName: string, guesserScore: number, drawerScore: number) {
    this.state.chat.push({
      id: genId(),
      playerId: "system",
      playerName: "",
      text: `✅ ${guesserName} 猜对了！+${guesserScore} 分　画手 +${drawerScore} 分`,
      msgType: "correct",
    })
    this.trimChat()
  }

  trimChat() {
    if (this.state.chat.length > 80) this.state.chat = this.state.chat.slice(-80)
  }

  broadcastState(exclude?: string[]) {
    const msg = JSON.stringify({ type: "game-state", state: this.state })
    for (const conn of this.room.getConnections()) {
      if (!exclude?.includes(conn.id)) conn.send(msg)
    }
  }
}

GameServer satisfies Party.Worker
