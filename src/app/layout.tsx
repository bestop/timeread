import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const serifSC = localFont({
  src: "./fonts/NotoSerifSC-SemiBold.ttf",
  weight: "600",
  variable: "--font-serif-sc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "时光贴 TimeTap · 每日日签",
  description:
    "时光贴 TimeTap：背景与文字，两个可扩充的素材库。每天自动合成一张带当天日期的日签图片，克制排版，诗意呈现，随时收藏分享。",
  keywords: ["时光贴", "TimeTap", "日签", "每日一图", "图片生成", "素材库", "文案"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbfaf7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${serifSC.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast:
                '!rounded-[2px] !border-[var(--hairline)] !bg-[var(--paper)] !text-[var(--ink)] !shadow-[0_1px_2px_rgba(30,28,25,0.06),0_12px_36px_-12px_rgba(30,28,25,0.2)]',
              title: '!font-serif-sc !text-[13px] !tracking-[0.08em] !text-[var(--ink)]',
              description: '!text-[13px] !text-[var(--ink-soft)]',
              icon: '!text-[var(--accent)]',
            },
          }}
        />
      </body>
    </html>
  );
}
