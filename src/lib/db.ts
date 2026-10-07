import { PrismaClient } from '@prisma/client'

// 环境自适应：本地用 db/custom.db，Vercel 只读文件系统降级到 /tmp（冷启动重建）
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.VERCEL
    ? 'file:/tmp/timeread.db'
    : `file:${process.cwd()}/db/custom.db`;
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