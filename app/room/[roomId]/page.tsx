"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import usePartySocket from "partysocket/react"
import type { GameState, DrawEvent, ServerMessage } from "@/lib/types"
import Canvas from "@/components/Canvas"
import DrawTools from "@/components/DrawTools"
import Chat from "@/components/Chat"
import PlayerList from "@/components/PlayerList"

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999"

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const router = useRouter()

  // Player identity
  const [playerName, setPlayerName] = useState("")
  const [nameInput, setNameInput] = useState("")
  const [myId, setMyId] = useState("")
  const [joined, setJoined] = useState(false)

  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [myWord, setMyWord] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)

  // Drawing state
  const [color, setColor] = useState("#000000")
  const [size, setSize] = useState(3)
  const [drawEventQueue, setDrawEventQueue] = useState<DrawEvent[]>([])
  const [clearSignal, setClearSignal] = useState(0)

  // Load player name from session
  useEffect(() => {
    const saved = sessionStorage.getItem("playerName")
    if (saved) {
      setPlayerName(saved)
      setNameInput(saved)
    }
  }, [])

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: roomId,
    onOpen() {
      setMyId(socket.id)
    },
    onMessage(evt) {
      const msg: ServerMessage = JSON.parse(evt.data)
      handleServerMessage(msg)
    },
  })

  // We need socket.id — update myId whenever it's available
  useEffect(() => {
    if (socket.id) setMyId(socket.id)
  }, [socket.id])

  const handleServerMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case "game-state":
          setGameState(msg.state)
          setTimeLeft(msg.state.timeLeft)
          // Reset word hint if it's a new drawer turn
          if (msg.state.currentDrawerId !== socket.id) setMyWord(null)
          break
        case "draw":
          setDrawEventQueue((q) => [...q, msg.event])
          break
        case "clear-canvas":
          setDrawEventQueue([])
          setClearSignal((n) => n + 1)
          break
        case "your-word":
          setMyWord(msg.word)
          break
        case "timer":
          setTimeLeft(msg.timeLeft)
          break
        case "error":
          alert(msg.message)
          break
      }
    },
    [socket.id]
  )

  function send(data: object) {
    socket.send(JSON.stringify(data))
  }

  function joinRoom() {
    const n = nameInput.trim()
    if (!n) return
    sessionStorage.setItem("playerName", n)
    setPlayerName(n)
    send({ type: "join", name: n })
    setJoined(true)
  }

  const isDrawer = gameState?.currentDrawerId === myId

  function handleDraw(event: DrawEvent) {
    send({ type: "draw", event })
  }

  function handleClear() {
    send({ type: "clear-canvas" })
    setDrawEventQueue([])
    setClearSignal((n) => n + 1)
  }

  function handleGuess(text: string) {
    send({ type: "guess", text })
  }

  const myPlayer = gameState?.players.find((p) => p.id === myId)
  const isHost = myPlayer?.isHost ?? false
  const canStart =
    isHost &&
    gameState?.phase === "lobby" &&
    (gameState?.players.length ?? 0) >= 2

  // ─── Name entry screen ───────────────────────────────────────
  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 shadow-xl">
          <button onClick={() => router.push("/")} className="text-gray-500 hover:text-gray-300 text-sm mb-4 flex items-center gap-1">
            ← 返回
          </button>
          <h2 className="text-xl font-bold mb-1">加入房间</h2>
          <p className="text-gray-400 text-sm mb-5">
            房间码：<span className="text-white font-mono font-bold">{roomId}</span>
          </p>
          <input
            autoFocus
            className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            placeholder="输入你的名字..."
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            maxLength={16}
          />
          <button
            onClick={joinRoom}
            disabled={!nameInput.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            进入房间
          </button>
        </div>
      </div>
    )
  }

  // ─── Loading ─────────────────────────────────────────────────
  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">连接中...</div>
      </div>
    )
  }

  // ─── Lobby ───────────────────────────────────────────────────
  if (gameState.phase === "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-900 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">等候室</h2>
              <p className="text-gray-400 text-sm mt-0.5">
                房间码：<span className="text-white font-mono font-bold tracking-widest">{roomId}</span>
              </p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              📋 复制链接
            </button>
          </div>

          {/* Settings (host only) */}
          {isHost && (
            <div className="mb-5 p-4 bg-gray-800 rounded-xl space-y-3">
              <p className="text-sm font-semibold text-gray-300">游戏设置</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">回合数</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => send({ type: "update-settings", settings: { totalRounds: r } })}
                      className={`w-9 h-8 rounded-lg text-sm font-medium transition-colors ${
                        gameState.settings.totalRounds === r
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">作画时间</span>
                <div className="flex gap-1">
                  {[40, 60, 80, 120].map((t) => (
                    <button
                      key={t}
                      onClick={() => send({ type: "update-settings", settings: { drawTime: t } })}
                      className={`px-2.5 h-8 rounded-lg text-sm font-medium transition-colors ${
                        gameState.settings.drawTime === t
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Player list */}
          <div className="mb-5 space-y-1.5">
            {gameState.players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                <span className="text-lg">{p.id === myId ? "😊" : "👤"}</span>
                <span className="text-sm font-medium flex-1">
                  {p.name}
                  {p.id === myId && <span className="text-indigo-400 text-xs ml-1">(我)</span>}
                </span>
                {p.isHost && <span className="text-yellow-400 text-xs">👑 房主</span>}
              </div>
            ))}
          </div>

          {gameState.players.length < 2 && (
            <p className="text-yellow-500 text-sm text-center mb-4">
              等待更多玩家加入... (至少 2 人)
            </p>
          )}

          {isHost ? (
            <button
              onClick={() => send({ type: "start-game" })}
              disabled={!canStart}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              🎮 开始游戏
            </button>
          ) : (
            <p className="text-center text-gray-400 text-sm">等待房主开始游戏...</p>
          )}
        </div>
      </div>
    )
  }

  // ─── Game End ────────────────────────────────────────────────
  if (gameState.phase === "gameEnd") {
    const sorted = [...gameState.players].sort((a, b) => b.score - a.score)
    const medals = ["🥇", "🥈", "🥉"]
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-900 rounded-2xl p-6 shadow-xl">
          <h2 className="text-2xl font-bold text-center mb-6">🎉 游戏结束！</h2>
          <div className="space-y-2 mb-8">
            {sorted.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                  i === 0 ? "bg-yellow-900/40 border border-yellow-700" : "bg-gray-800"
                }`}
              >
                <span className="text-xl w-8 text-center">{medals[i] ?? `${i + 1}`}</span>
                <span className="flex-1 font-medium">
                  {p.name}
                  {p.id === myId && <span className="text-indigo-400 text-xs ml-1">(我)</span>}
                </span>
                <span className="font-bold text-yellow-400 text-lg">{p.score}</span>
              </div>
            ))}
          </div>
          {isHost && (
            <button
              onClick={() => send({ type: "start-game" })}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-colors mb-3"
            >
              🔄 再玩一局
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            回到主页
          </button>
        </div>
      </div>
    )
  }

  // ─── Main Game ───────────────────────────────────────────────
  const drawerName = gameState.players.find((p) => p.id === gameState.currentDrawerId)?.name ?? "?"
  const hasGuessed = myPlayer?.hasGuessed ?? false
  const chatDisabled = isDrawer || hasGuessed
  const timePct = gameState.settings.drawTime > 0 ? timeLeft / gameState.settings.drawTime : 0
  const timerColor = timePct > 0.5 ? "bg-green-500" : timePct > 0.25 ? "bg-yellow-500" : "bg-red-500"

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden max-w-7xl mx-auto w-full">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-2 pt-2 pb-1 shrink-0">
        {/* Round badge */}
        <div className="flex items-center gap-1 bg-gray-900 rounded-lg px-2.5 py-1.5 shrink-0">
          <span className="text-gray-400 text-xs">第</span>
          <span className="font-bold text-sm">{gameState.currentRound}</span>
          <span className="text-gray-400 text-xs">/{gameState.totalRounds}</span>
        </div>

        {/* Word hint / drawer word */}
        <div className="flex-1 flex items-center justify-center bg-gray-900 rounded-lg px-3 py-1.5 min-w-0">
          {isDrawer && myWord ? (
            <span className="font-bold text-sm text-green-400 truncate">
              ✏️ 你来画：<span className="text-white">{myWord}</span>
            </span>
          ) : gameState.phase === "roundEnd" ? (
            <span className="text-yellow-400 font-semibold text-sm truncate">
              {gameState.chat.slice().reverse().find(m => m.msgType === "system" && m.text.includes("答案"))?.text ?? ""}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-gray-400 text-xs shrink-0 hidden sm:inline">{drawerName} 正在画：</span>
              <span className="font-mono text-base tracking-[0.25em] font-bold truncate">
                {gameState.wordHint}
              </span>
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1.5 bg-gray-900 rounded-lg px-2.5 py-1.5 shrink-0">
          <div className="w-10 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${timerColor}`}
              style={{ width: `${timePct * 100}%` }}
            />
          </div>
          <span className={`font-mono font-bold text-sm w-6 text-right ${timePct < 0.25 ? "text-red-400" : "text-white"}`}>
            {timeLeft}
          </span>
        </div>
      </div>

      {/* ── Mobile layout (flex-col) / Desktop layout (flex-row) ── */}
      <div className="flex-1 flex flex-col md:flex-row gap-2 px-2 pb-2 min-h-0 overflow-hidden">

        {/* ── Desktop: Left players sidebar ── */}
        <div className="w-36 shrink-0 hidden md:block">
          <PlayerList
            players={gameState.players}
            currentDrawerId={gameState.currentDrawerId}
            myId={myId}
          />
        </div>

        {/* ── Mobile: Players horizontal strip ── */}
        <div className="flex md:hidden gap-1.5 overflow-x-auto shrink-0 pb-0.5">
          {gameState.players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg shrink-0 text-xs ${
                p.id === myId ? "bg-indigo-900/60 border border-indigo-700" : "bg-gray-800"
              }`}
            >
              {p.id === gameState.currentDrawerId ? "✏️" : p.hasGuessed ? "✅" : ""}
              <span className="font-medium max-w-[60px] truncate">{p.name}</span>
              <span className="text-yellow-400 font-bold ml-0.5">{p.score}</span>
            </div>
          ))}
        </div>

        {/* ── Center: Canvas + tools ── */}
        <div className="flex flex-col gap-1.5 min-w-0 md:flex-1">
          {/* Canvas — full width on mobile, aspect ratio preserved */}
          <div className="w-full">
            <Canvas
              isDrawer={isDrawer}
              onDraw={handleDraw}
              onClear={handleClear}
              color={color}
              size={size}
              drawEventQueue={drawEventQueue}
              clearSignal={clearSignal}
            />
          </div>

          {/* Draw tools — compact on mobile */}
          {isDrawer && (
            <DrawTools
              color={color}
              size={size}
              onColorChange={setColor}
              onSizeChange={setSize}
            />
          )}

          {!isDrawer && hasGuessed && (
            <div className="text-center text-green-400 text-sm font-semibold bg-green-900/20 rounded-xl py-1.5">
              ✅ 你猜对了！等待其他玩家...
            </div>
          )}
        </div>

        {/* ── Right: Chat ── */}
        {/* Mobile: fixed height below canvas. Desktop: sidebar */}
        <div className="h-44 md:h-auto md:w-56 shrink-0 flex flex-col">
          <Chat
            messages={gameState.chat}
            onSend={handleGuess}
            disabled={chatDisabled}
            placeholder={isDrawer ? "你是画手，不能猜" : hasGuessed ? "已猜对！" : "输入猜测..."}
          />
        </div>

      </div>
    </div>
  )
}
