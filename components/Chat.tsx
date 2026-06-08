"use client"

import { useEffect, useRef, useState } from "react"
import type { ChatMessage } from "@/lib/types"

interface ChatProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  disabled: boolean
  placeholder?: string
}

export default function Chat({ messages, onSend, disabled, placeholder }: ChatProps) {
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const submit = () => {
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput("")
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm leading-snug ${
              msg.msgType === "system"
                ? "text-gray-400 italic"
                : msg.msgType === "correct"
                ? "text-green-400 font-semibold"
                : "text-gray-200"
            }`}
          >
            {msg.msgType === "chat" && (
              <span className="text-indigo-400 font-medium mr-1">{msg.playerName}:</span>
            )}
            {msg.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-gray-700 flex gap-2">
        <input
          className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          placeholder={disabled ? placeholder ?? "等待中..." : "输入猜测..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !disabled && submit()}
          disabled={disabled}
          maxLength={50}
        />
        <button
          onClick={submit}
          disabled={disabled || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          猜
        </button>
      </div>
    </div>
  )
}
