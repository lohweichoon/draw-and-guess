"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

function genRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function Home() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [error, setError] = useState("")

  function handleCreate() {
    const n = name.trim()
    if (!n) { setError("请输入你的名字"); return }
    sessionStorage.setItem("playerName", n)
    router.push(`/room/${genRoomId()}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="mb-10 text-center">
        <div className="text-6xl mb-3">🎨</div>
        <h1 className="text-4xl font-bold tracking-tight">你画我猜</h1>
        <p className="text-gray-400 mt-2">多人实时猜画游戏</p>
      </div>

      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 shadow-xl">
        <label className="block text-sm text-gray-400 mb-1.5">你的名字</label>
        <input
          autoFocus
          className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 mb-5"
          placeholder="输入名字..."
          value={name}
          onChange={(e) => { setName(e.target.value); setError("") }}
          maxLength={16}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button
          onClick={handleCreate}
          className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          🎲 创建新房间
        </button>

        <p className="text-gray-600 text-xs text-center mt-4">
          加入朋友的房间？点击他们分享的链接即可
        </p>
      </div>

      <p className="text-gray-600 text-xs mt-8">2–8 人游戏 · 多设备实时对战</p>
    </div>
  )
}
