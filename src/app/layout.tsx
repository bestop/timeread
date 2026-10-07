import type { Metadata } from "next";
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
  title: "每日日签 · 每天一张图文卡片",
  description:
    "两个可扩充素材库：图片背景与文字。每天自动生成一张结合背景与文字的日签图片，带上当天日期，随时下载分享。",
  keywords: ["日签", "每日一图", "图片生成", "素材库", "文案"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
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
