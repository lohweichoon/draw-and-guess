"use client"

const COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
  "#92400e", "#1e3a8a",
]

const SIZES = [
  { label: "细", value: 3 },
  { label: "中", value: 8 },
  { label: "粗", value: 16 },
  { label: "超粗", value: 28 },
]

interface DrawToolsProps {
  color: string
  size: number
  onColorChange: (c: string) => void
  onSizeChange: (s: number) => void
}

export default function DrawTools({ color, size, onColorChange, onSizeChange }: DrawToolsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-800 rounded-xl">
      {/* Colors */}
      <div className="flex flex-wrap gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onColorChange(c)}
            className={`w-7 h-7 rounded-full transition-transform ${
              color === c ? "scale-125 ring-2 ring-white ring-offset-1 ring-offset-gray-800" : "hover:scale-110"
            }`}
            style={{ backgroundColor: c, border: c === "#ffffff" ? "1px solid #4b5563" : "none" }}
            title={c}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-600 hidden sm:block" />

      {/* Brush sizes */}
      <div className="flex gap-1.5 items-center">
        {SIZES.map((s) => (
          <button
            key={s.value}
            onClick={() => onSizeChange(s.value)}
            className={`flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              size === s.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
