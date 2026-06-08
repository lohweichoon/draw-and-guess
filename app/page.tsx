"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

function genRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function Home() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [tab, setTab] = useState<"create" | "join">("create")
  const [error, setError] = useState("")

  function handleCreate() {
    const n = name.trim()
    if (!n) { setError("请输入你的名字"); return }
    const roomId = genRoomId()
    sessionStorage.setItem("playerName", n)
    router.push(`/room/${roomId}`)
  }

  function handleJoin() {
    const n = name.trim()
    const code = joinCode.trim().toUpperCase()
    if (!n) { setError("请输入你的名字"); return }
    if (!code) { setError("请输入房间码"); return }
    sessionStorage.setItem("playerName", n)
    router.push(`/room/${code}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Title */}
      <div className="mb-10 text-center">
        <div className="text-6xl mb-3">🎨</div>
        <h1 className="text-4xl font-bold tracking-tight">你画我猜</h1>
        <p className="text-gray-400 mt-2">多人实时猜画游戏</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 shadow-xl">
        {/* Name input */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-1.5">你的名字</label>
          <input
            className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="输入名字..."
            value={name}
            onChange={(e) => { setName(e.target.value); setError("") }}
            maxLength={16}
            onKeyDown={(e) => e.key === "Enter" && (tab === "create" ? handleCreate() : handleJoin())}
          />
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-800 rounded-lg p-1 mb-5">
          {(["create", "join"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {t === "create" ? "创建房间" : "加入房间"}
            </button>
          ))}
        </div>

        {/* Join code (only for join tab) */}
        {tab === "join" && (
          <div className="mb-5">
            <label className="block text-sm text-gray-400 mb-1.5">房间码</label>
            <input
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-widest text-center text-lg font-mono"
              placeholder="XXXXXX"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value); setError("") }}
              maxLength={6}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
          </div>
        )}

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button
          onClick={tab === "create" ? handleCreate : handleJoin}
          className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {tab === "create" ? "🎲 创建房间" : "🚀 加入游戏"}
        </button>
      </div>

      <p className="text-gray-600 text-xs mt-8">2–8 人游戏 · 多设备实时对战</p>
    </div>
  )
}
