import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { BG_DIR, ensureDirs, ensureSeeded } from '@/lib/seed';
import { invalidateCardFor } from '@/lib/daily';
import { todayStr } from '@/lib/date-utils';

export const runtime = 'nodejs';

// 素材库列表
export async function GET() {
  await ensureSeeded();
  const items = await db.background.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, origin: true, palette: true, createdAt: true },
  });
  return NextResponse.json({ items });
}

const MAX_SIZE = 20 * 1024 * 1024;

function sanitizeLabel(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, ' ').trim();
  return base.slice(0, 24) || '自定义背景';
}

// 上传背景（支持多文件）
export async function POST(req: NextRequest) {
  await ensureSeeded();
  ensureDirs();
  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: '未收到图片文件' }, { status: 400 });
  }
  const created: { id: string; label: string }[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    try {
      if (file.size > MAX_SIZE) {
        rejected.push(`${file.name}（超过 20MB）`);
        continue;
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const meta = await sharp(buf).metadata();
      const fmt = meta.format;
      if (!fmt || !['jpeg', 'jpg', 'png', 'webp'].includes(fmt)) {
        rejected.push(`${file.name}（仅支持 JPG/PNG/WebP）`);
        continue;
      }
      // 统一转 JPEG，限制最大边长 2160
      let img = sharp(buf).rotate();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (Math.max(w, h) > 2160) {
        img = img.resize(2160, 2160, { fit: 'inside' });
      }
      const out = await img.flatten({ background: '#ffffff' }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const filename = `up_${id}.jpg`;
      fs.writeFileSync(path.join(BG_DIR, filename), out);
      const row = await db.background.create({
        data: { filename, label: sanitizeLabel(file.name), origin: 'upload', palette: 'auto' },
      });
      created.push({ id: row.id, label: row.label });
    } catch (e) {
      console.error('[background upload]', e);
      rejected.push(`${file.name}（处理失败）`);
    }
  }
  // 新素材进入后，让当日卡片重新随机（换一换亦可手动触发）
  if (created.length > 0) {
    const rec = await db.dailyCard.findUnique({ where: { date: todayStr() } });
    if (rec && rec.variant === 0) {
      await db.dailyCard.delete({ where: { date: todayStr() } }).catch(() => {});
      await invalidateCardFor(todayStr());
    }
  }
  return NextResponse.json({ created, rejected });
}
