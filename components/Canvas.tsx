"use client"

import { useEffect, useRef, useCallback } from "react"
import type { DrawEvent } from "@/lib/types"

interface CanvasProps {
  isDrawer: boolean
  onDraw: (event: DrawEvent) => void
  onClear: () => void
  color: string
  size: number
  drawEventQueue: DrawEvent[]
  clearSignal: number
}

export default function Canvas({
  isDrawer,
  onDraw,
  onClear,
  color,
  size,
  drawEventQueue,
  clearSignal,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const processedEvents = useRef(0)

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Respond to clear signal from server
  useEffect(() => {
    clearCanvas()
    processedEvents.current = 0
  }, [clearSignal, clearCanvas])

  // Process incoming draw events from other players
  useEffect(() => {
    const ctx = getCtx()
    if (!ctx) return

    const newEvents = drawEventQueue.slice(processedEvents.current)
    if (newEvents.length === 0) return

    newEvents.forEach((ev) => {
      if (ev.type === "clear") {
        clearCanvas()
        return
      }
      ctx.strokeStyle = ev.color
      ctx.lineWidth = ev.size
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      if (ev.isNewStroke) {
        ctx.beginPath()
        ctx.moveTo(ev.prevX, ev.prevY)
      }
      ctx.lineTo(ev.x, ev.y)
      ctx.stroke()
    })

    processedEvents.current = drawEventQueue.length
  }, [drawEventQueue, clearCanvas])

  // Get canvas-relative coords
  const getPos = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const startDraw = (clientX: number, clientY: number) => {
    if (!isDrawer) return
    isDrawing.current = true
    const pos = getPos(clientX, clientY)
    lastPos.current = pos

    const ctx = getCtx()
    if (ctx) {
      ctx.strokeStyle = color
      ctx.lineWidth = size
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }

    const ev: DrawEvent = {
      type: "draw",
      x: pos.x,
      y: pos.y,
      prevX: pos.x,
      prevY: pos.y,
      color,
      size,
      isNewStroke: true,
    }
    onDraw(ev)
  }

  const draw = (clientX: number, clientY: number) => {
    if (!isDrawer || !isDrawing.current || !lastPos.current) return
    const pos = getPos(clientX, clientY)

    const ctx = getCtx()
    if (ctx) {
      ctx.strokeStyle = color
      ctx.lineWidth = size
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }

    const ev: DrawEvent = {
      type: "draw",
      x: pos.x,
      y: pos.y,
      prevX: lastPos.current.x,
      prevY: lastPos.current.y,
      color,
      size,
      isNewStroke: false,
    }
    onDraw(ev)
    lastPos.current = pos
  }

  const stopDraw = () => {
    isDrawing.current = false
    lastPos.current = null
  }

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => startDraw(e.clientX, e.clientY)
  const onMouseMove = (e: React.MouseEvent) => draw(e.clientX, e.clientY)
  const onMouseUp = () => stopDraw()

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const t = e.touches[0]
    startDraw(t.clientX, t.clientY)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    const t = e.touches[0]
    draw(t.clientX, t.clientY)
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    stopDraw()
  }

  return (
    <div className="relative w-full bg-white rounded-xl overflow-hidden shadow-lg">
      <canvas
        ref={canvasRef}
        width={800}
        height={540}
        className={`w-full h-full block ${isDrawer ? "cursor-crosshair" : "cursor-default"}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={stopDraw}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: "none" }}
      />
      {isDrawer && (
        <button
          onClick={onClear}
          className="absolute top-2 right-2 bg-red-500 hover:bg-red-400 text-white text-xs px-3 py-1.5 rounded-lg font-medium shadow transition-colors"
        >
          清除画布
        </button>
      )}
    </div>
  )
}
