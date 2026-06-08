import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "你画我猜",
  description: "多人在线你画我猜游戏",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        {children}
      </body>
    </html>
  )
}
