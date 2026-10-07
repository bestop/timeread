# Worklog

---
Task ID: 1
Agent: Super Z (main)
Task: 设计并开发"每日日签"网站 —— 两个可扩充素材库（图片背景/文字），每日自动生成一张结合背景与文字、带当天日期的日签图片（参考用户上传的 7 张日签卡风格）

Work Log:
- 查看用户上传的 7 张参考日签图：竖版 3:4、水彩/油画质感底、宋体大字、【】高亮块、~~下划线~~强调、左上英文星期 + 右上中文日期、底部英文手写注脚 + & 装饰
- 初始化 fullstack 环境（Next.js 16 + TS + Tailwind 4 + shadcn/ui + Prisma/SQLite）
- Prisma 建模：Background（背景库）、Quote（文字库）、DailyCard（每日记录，date 唯一 + variant 换一换计数）
- 核心合成引擎 src/lib/card-composer.ts：fontkit 2.x 精确测量字形宽度 → 逐字符 SVG 定位（支持闭合标点悬挂避头尾、行尾开引号后移、字号自动收缩 58→38 适配、高亮块/下划线精确渲染）→ sharp 合成 1080×1440 JPEG
- 配色系统 src/lib/palettes.ts：7 种手调配色 + auto 模式（按 sharp stats 通道均值判断绿/蓝/暖/墨/深底月白）
- 种子模块 src/lib/seed.ts：sharp 程序化生成 8 张水彩质感初始背景（blobs/streaks/marble 三种纹理 + JS 生成纸纹颗粒）+ 从参考图整理 8 条初始文案；storage/.seeded 标记防重复
- 每日服务 src/lib/daily.ts：(date,variant) 确定性 mulberry32 随机选材、首次访问懒生成落盘、素材被删自动重挑、并发 in-flight 去重、换一换 variant+1
- API：backgrounds CRUD+图片流、quotes CRUD、daily 元信息、regenerate、history、card-image（按日期懒生成）
- 前端单页（/ 路由四标签）：今日日签（卡片+下载+换一换+信息区）、背景库（拖拽多传+配色下拉+删除确认）、文字库（标记语法+实时字数+格式化列表）、往期回顾（网格+放大对话框+下载）；TanStack Query 管理服务端状态
- 视觉校准迭代 3 轮：修复段落间距错算导致溢出、行首标点、自动取色阈值
- ESLint 通过（改用 TanStack Query 消除 effect setState 告警）
- agent-browser 端到端验证：今日渲染/换一换/上传/配色 PATCH/删除确认/新增文案/往期懒生成/对话框/移动端 390×844，无 console 错误

Stage Summary:
- 网站已完成并自验通过：素材库可扩充、每日确定性生成带日期日签、下载/换一换/往期回顾齐全
- 关键产物：src/lib/{card-composer,palettes,text-parser,seed,daily,date-utils}.ts、api 路由 9 个、组件 5 个、storage/{bg,cards}
- 今日卡片 2026-10-07 已生成；测试插入 2026-10-06 历史卡用于验证往期功能（保留作演示）
- 字体：服务端渲染用系统 Noto Serif SC SemiBold + LXGW WenKai；前端 UI 用 next/font/local 打包同款宋体
