import type * as Party from "partykit/server"
import type { ChatMessage, DrawEvent, GameState, Player, RoomSettings } from "../lib/types"
import { getRandomWord, getWordHint } from "../lib/words"

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export default class GameServer implements Party.Server {
  private state: GameState
  private currentWord = ""
  private timer: ReturnType<typeof setInterval> | null = null
  private hintTimer: ReturnType<typeof setTimeout> | null = null

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

    // Re-assign host if needed
    if (this.state.players.length > 0 && !this.state.players.some((p) => p.isHost)) {
      this.state.players[0].isHost = true
    }

    this.addSystem(`${leavingPlayer.name} 离开了游戏`)

    // If current drawer left during a game, end the round
    if (this.state.phase === "drawing" && this.state.currentDrawerId === conn.id) {
      this.endRound()
    } else {
      this.broadcastState()
    }

    // If no one left, reset
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

    // Reject if game in progress (allow during lobby/gameEnd)
    if (this.state.phase === "drawing" || this.state.phase === "roundEnd") {
      conn.send(JSON.stringify({ type: "error", message: "游戏进行中，无法加入" }))
      return
    }

    const name = rawName.trim().slice(0, 16) || `玩家${this.state.players.length + 1}`
    const isHost = this.state.players.length === 0

    const player: Player = { id: conn.id, name, score: 0, isHost, hasGuessed: false }
    this.state.players.push(player)

    this.addSystem(`${name} 加入了游戏 👋`)

    // Send full state + confirm join to new player
    conn.send(JSON.stringify({ type: "game-state", state: this.state }))
    // Broadcast updated state to others
    this.broadcastState([conn.id])
  }

  onStartGame(conn: Party.Connection) {
    const player = this.state.players.find((p) => p.id === conn.id)
    if (!player?.isHost) return
    if (this.state.players.length < 2) return
    if (this.state.phase !== "lobby" && this.state.phase !== "gameEnd") return

    this.state.totalRounds = this.state.settings.totalRounds
    this.state.drawerOrder = this.state.players.map((p) => p.id)
    this.state.drawerIndex = 0
    this.state.currentRound = 1
    this.state.chat = []
    this.state.players.forEach((p) => { p.score = 0; p.hasGuessed = false })

    this.startTurn()
  }

  onDraw(conn: Party.Connection, event: DrawEvent) {
    if (conn.id !== this.state.currentDrawerId) return
    if (this.state.phase !== "drawing") return

    // Forward to everyone except the sender
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

      // Score: time bonus + order bonus
      const alreadyGuessed = this.state.players.filter((p) => p.hasGuessed && p.id !== this.state.currentDrawerId).length
      const timePct = this.state.timeLeft / this.state.settings.drawTime
      const timeBonus = Math.round(timePct * 200)
      const orderBonus = Math.max(0, 100 - (alreadyGuessed - 1) * 25)
      const earned = Math.max(30, timeBonus + orderBonus)

      player.score += earned

      const drawer = this.state.players.find((p) => p.id === this.state.currentDrawerId)
      if (drawer) drawer.score += 20

      this.addCorrect(player.name, earned)

      // All non-drawers guessed?
      const nonDrawers = this.state.players.filter((p) => p.id !== this.state.currentDrawerId)
      if (nonDrawers.length > 0 && nonDrawers.every((p) => p.hasGuessed)) {
        this.endRound()
        return
      }
    } else {
      // Check if close (optional: partial hint)
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

  startTurn() {
    // Skip drawer slots for disconnected players
    while (
      this.state.drawerIndex < this.state.drawerOrder.length &&
      !this.state.players.find((p) => p.id === this.state.drawerOrder[this.state.drawerIndex])
    ) {
      this.state.drawerIndex++
    }

    // End of drawer list = end of a round
    if (this.state.drawerIndex >= this.state.drawerOrder.length) {
      if (this.state.currentRound >= this.state.totalRounds) {
        this.endGame()
        return
      }
      this.state.currentRound++
      this.state.drawerIndex = 0
      // Rebuild drawer order from current players
      this.state.drawerOrder = this.state.players.map((p) => p.id)
      this.startTurn()
      return
    }

    const drawerId = this.state.drawerOrder[this.state.drawerIndex]
    this.currentWord = getRandomWord()

    this.state.phase = "drawing"
    this.state.currentDrawerId = drawerId
    this.state.wordHint = getWordHint(this.currentWord)
    this.state.timeLeft = this.state.settings.drawTime
    this.state.players.forEach((p) => { p.hasGuessed = false })

    const drawerName = this.state.players.find((p) => p.id === drawerId)?.name ?? "?"
    this.addSystem(`✏️ ${drawerName} 来画了！猜猜看～`)

    // Clear canvas for everyone
    this.room.broadcast(JSON.stringify({ type: "clear-canvas" }))

    // Send word ONLY to drawer
    const drawerConn = this.room.getConnection(drawerId)
    drawerConn?.send(JSON.stringify({ type: "your-word", word: this.currentWord }))

    this.broadcastState()
    this.startTimer()
  }

  endRound() {
    this.stopTimer()
    this.state.phase = "roundEnd"
    this.addSystem(`⏰ 答案是：【${this.currentWord}】`)
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
        this.endRound()
        return
      }

      // Lightweight timer broadcast
      this.room.broadcast(JSON.stringify({ type: "timer", timeLeft: this.state.timeLeft }))
    }, 1000)
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

  addCorrect(name: string, score: number) {
    this.state.chat.push({
      id: genId(),
      playerId: "system",
      playerName: "",
      text: `✅ ${name} 猜对了！+${score} 分`,
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
