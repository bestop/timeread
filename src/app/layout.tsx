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
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
