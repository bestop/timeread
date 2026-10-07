import { PrismaClient } from '@prisma/client'

// ---------------------------------------------------------------------------
// 数据库接入：Vercel Postgres（Neon）持久化；本地开发回退 SQLite
// - 生产：Vercel 市场集成把 DATABASE_URL / POSTGRES_PRISMA_URL 注入运行时环境
//   （真实环境变量优先级高于 .env 文件，本地 .env 不会覆盖云端注入值）
// - Prisma + PgBouncer（Neon 池化端点）需要 pgbouncer=true 关闭预编译语句，
//   优先使用集成注入的 POSTGRES_PRISMA_URL（已带 Prisma 调优参数）
// ---------------------------------------------------------------------------
const rawUrl = (process.env.DATABASE_URL || '').trim();

const isPostgresUrl = /^postgres(ql)?:\/\//i.test(rawUrl);

if (isPostgresUrl) {
  // Prisma 专用连接串（含 pgbouncer/connection_limit 调优）优先
  if (process.env.POSTGRES_PRISMA_URL && /^postgres(ql)?:\/\//i.test(process.env.POSTGRES_PRISMA_URL)) {
    process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
  } else if (/pooler\./i.test(rawUrl) && !/pgbouncer=/i.test(rawUrl)) {
    // 兜底：池化端点但缺 pgbouncer 标记 → 手动补上
    process.env.DATABASE_URL = rawUrl + (rawUrl.includes('?') ? '&' : '?') + 'pgbouncer=true&connection_limit=1';
  }
} else if (!rawUrl) {
  // 本地开发默认 SQLite
  process.env.DATABASE_URL = `file:${process.cwd()}/db/custom.db`;
}

export const IS_POSTGRES = /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || '');

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? [] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// ---------------------------------------------------------------------------
// 运行时自举建表（幂等）：Neon 空库冷启动时自动创建，与 Prisma schema 对齐
// 双方言：Postgres（生产）/ SQLite（本地）
// ---------------------------------------------------------------------------
const PG_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Background" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL DEFAULT '',
    "origin" TEXT NOT NULL DEFAULT 'upload',
    "palette" TEXT NOT NULL DEFAULT 'auto',
    "data" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "footnote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "DailyCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "backgroundId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "variant" INTEGER NOT NULL DEFAULT 0,
    "image" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DailyCard_date_key" ON "DailyCard"("date")`,
];

const SQLITE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Background" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL DEFAULT '',
    "origin" TEXT NOT NULL DEFAULT 'upload',
    "palette" TEXT NOT NULL DEFAULT 'auto',
    "data" BLOB,
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
    "image" BLOB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DailyCard_date_key" ON "DailyCard"("date")`,
];

let schemaReady: Promise<void> | null = null

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const statements = IS_POSTGRES ? PG_STATEMENTS : SQLITE_STATEMENTS;
      for (const sql of statements) {
        await db.$executeRawUnsafe(sql);
      }
    })().catch((e) => {
      schemaReady = null // 失败允许重试
      throw e
    })
  }
  return schemaReady
}
