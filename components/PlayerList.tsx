"use client"

import type { Player } from "@/lib/types"

interface PlayerListProps {
  players: Player[]
  currentDrawerId: string | null
  myId: string
}

export default function PlayerList({ players, currentDrawerId, myId }: PlayerListProps) {
  return (
    <div className="bg-gray-900 rounded-xl p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">玩家</h3>
      <div className="space-y-1.5">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${
              p.id === myId ? "bg-indigo-900/50 border border-indigo-700" : "bg-gray-800"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {/* Drawing indicator */}
              {p.id === currentDrawerId ? (
                <span title="正在画">✏️</span>
              ) : p.hasGuessed ? (
                <span title="已猜对">✅</span>
              ) : (
                <span className="text-gray-600">●</span>
              )}
              <span className="text-sm font-medium truncate">
                {p.name}
                {p.id === myId && <span className="text-indigo-400 ml-1 text-xs">(我)</span>}
                {p.isHost && <span className="text-yellow-500 ml-1 text-xs">👑</span>}
              </span>
            </div>
            <span className="text-sm font-semibold text-yellow-400 ml-2 shrink-0">
              {p.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
