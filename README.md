# 时光贴 TimeTap · 每日日签

一个极简的「每日一签」生成网站：内置两个**可扩充素材库**（图片背景库、文字素材库），每天自动将一张背景图与一段文字合成为一张带当天日期的日签卡片，风格参考经典纸感日签——竖版 3:4、宋体大字、关键词色块高亮与下划线强调、左上英文星期、右上中文日期、底部英文手写注脚。

## 功能

### 每日日签
- 按 `(日期, 换一换次数)` 确定性随机选取背景与文案，当天内容全天稳定，跨设备访问同一张
- 首次访问自动生成并落盘缓存，往期卡片按需懒生成
- 一键下载 1080×1440 JPG；「换一换」在同日内重选素材组合
- 往期回顾：网格浏览历史日签，点击放大、下载

### 背景素材库（可扩充）
- 拖拽/选择多图上传（JPG/PNG/WebP，≤20MB，自动压缩转 JPEG）
- 内置 8 张程序生成的水彩质感初始背景，可随时删除、可自选文字配色方案（自动取色 / 手动指定）

### 文字素材库（可扩充）
- 自由新增/删除文案，支持轻量标记语法：`【关键词】` 色块高亮、`~~下划线~~` 强调、空行分段
- 实时预览格式化效果与字数统计；可配英文手写注脚

## 技术实现

- **框架**：Next.js 16（App Router）+ TypeScript + Tailwind CSS 4 + shadcn/ui
- **合成引擎**：fontkit 精确字形测量排版（避头尾、标点悬挂、字号自适应收缩）→ 逐字形 SVG 路径（**不依赖系统字体，云端渲染结果与本地完全一致**）→ sharp 合成输出
- **数据**：Prisma + **Vercel Postgres（Neon）**；背景图片与已生成日签图均以二进制（BYTEA）直接入库，跨实例、跨冷启动持久有效；本地开发可用 SQLite（`prisma/schema.prisma`），生产使用 PostgreSQL（`prisma/schema.postgres.prisma`，postinstall 按环境自动选择）
- **字体**：宋体（Noto Serif SC）与文楷（LXGW WenKai）已随仓库打包于 `assets/fonts/`

## 本地开发

```bash
bun install            # 安装依赖（自动执行 prisma generate）
cp .env.example .env   # 配置 DATABASE_URL（指向 db/custom.db）
bun run db:push        # 初始化数据库表结构
bun run dev            # 开发模式 http://localhost:3000
```

首次访问时自动注入初始素材（8 张水彩背景 + 8 条精选文案），图片与文案直接写入数据库。

## 部署说明（Vercel + Vercel Postgres）

仓库可直接导入 Vercel 部署：

1. **数据库**：在 Vercel 项目中创建/关联 Storage → Neon（Postgres）。集成会把 `DATABASE_URL`、`POSTGRES_PRISMA_URL` 等环境变量自动注入运行时，无需手动配置；应用冷启动时通过 `ensureSchema()` 幂等自举建表，并自动播种初始素材（种子使用固定主键，并发冷启动不会重复）。
2. **构建**：postinstall 检测 Vercel 环境后以 `prisma/schema.postgres.prisma` 生成 Prisma Client；字体文件经 `outputFileTracingIncludes` 追踪进 API 函数。
3. **上传**：前端先行压缩（长边 ≤1920、JPEG 0.85）并逐张提交，符合 Serverless 请求体限制。
4. **持久化**：所有素材、每日记录与合成图片均在 Postgres 中持久保存；删除实例/冷启动不会丢失任何数据。
