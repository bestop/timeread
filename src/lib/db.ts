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