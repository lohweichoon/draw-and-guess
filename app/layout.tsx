import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "你画我猜",
  description: "多人在线你画我猜游戏",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,   // prevent accidental pinch-zoom during drawing
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" style={{ overscrollBehavior: "none" }}>
      <body className="min-h-screen bg-gray-950 text-white antialiased overflow-hidden">
        {children}
      </body>
    </html>
  )
}
