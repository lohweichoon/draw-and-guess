"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [room, setRoom] = useState("")
  const [error, setError] = useState("")

  function handleEnter() {
    const n = name.trim()
    const r = room.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
    if (!n) { setError("请输入你的名字"); return }
    if (!r) { setError("请输入房间名"); return }
    sessionStorage.setItem("playerName", n)
    router.push(`/room/${r}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="mb-10 text-center">
        <div className="text-6xl mb-3">🎨</div>
        <h1 className="text-4xl font-bold tracking-tight">你画我猜</h1>
        <p className="text-gray-400 mt-2">多人实时猜画游戏</p>
      </div>

      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 shadow-xl">
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1.5">你的名字</label>
          <input
            autoFocus
            className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="输入名字..."
            value={name}
            onChange={(e) => { setName(e.target.value); setError("") }}
            maxLength={16}
            onKeyDown={(e) => e.key === "Enter" && handleEnter()}
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-1.5">房间名</label>
          <input
            className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            placeholder="nice"
            value={room}
            onChange={(e) => { setRoom(e.target.value); setError("") }}
            maxLength={20}
            onKeyDown={(e) => e.key === "Enter" && handleEnter()}
          />
          {room.trim() && (
            <p className="text-gray-500 text-xs mt-1.5 font-mono truncate">
              /room/{room.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")}
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button
          onClick={handleEnter}
          className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          进入房间
        </button>

        <p className="text-gray-600 text-xs text-center mt-4">
          同一个房间名 = 同一个房间
        </p>
      </div>

      <p className="text-gray-600 text-xs mt-8">2–8 人游戏 · 多设备实时对战</p>
    </div>
  )
}
