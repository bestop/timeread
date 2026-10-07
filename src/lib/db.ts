import { PrismaClient } from '@prisma/client'

// 环境自适应：本地用 db/custom.db，Vercel 只读文件系统强制降级到 /tmp（冷启动重建）
// 注意：CLI 部署可能把本地 .env 一并上传，故 VERCEL 下对本地 file: 路径强制纠偏
if (process.env.VERCEL) {
  const url = process.env.DATABASE_URL;
  if (!url || (url.startsWith('file:') && !url.startsWith('file:/tmp/'))) {
    process.env.DATABASE_URL = 'file:/tmp/timeread.db';
  }
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${process.cwd()}/db/custom.db`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// 运行时自动建表（serverless 冷启动时 /tmp 中为全新空库，与 Prisma schema 对应）
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Background" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "origin" TEXT NOT NULL DEFAULT 'upload',
    "palette" TEXT NOT NULL DEFAULT 'auto',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "footnote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "DailyCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "backgroundId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "variant" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DailyCard_date_key" ON "DailyCard"("date")`,
]

let schemaReady: Promise<void> | null = null

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const sql of SCHEMA_STATEMENTS) {
        await db.$executeRawUnsafe(sql)
      }
    })().catch((e) => {
      schemaReady = null // 失败允许重试
      throw e
    })
  }
  return schemaReady
}