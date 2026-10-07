import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本地沙箱使用 standalone 便于直接运行产物；Vercel 走官方构建流程
  output: process.env.VERCEL ? undefined : "standalone",
  // 服务端合成引擎运行时读取的字体文件（非 import 引用，需显式追踪进函数包）
  outputFileTracingIncludes: {
    "/api/**/*": ["./assets/fonts/**/*"],
  },
  // 构建输出目录可用 NEXT_DIST_DIR 覆盖（用于与 dev server 并行的验证构建）
  distDir: process.env.NEXT_DIST_DIR || ".next",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
