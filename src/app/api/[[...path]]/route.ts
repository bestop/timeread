// 统一 API 入口（catch-all）：所有接口收敛到同一个 Serverless 函数，
// 保证 Vercel 等无服务器平台上 /tmp 数据库与图片文件在同一实例内一致。
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { db } from '@/lib/db';
import { BG_DIR, ensureDirs, ensureSeeded } from '@/lib/seed';
import { ensureDaily, regenerateDaily, listHistory, invalidateCardFor } from '@/lib/daily';
import { todayStr } from '@/lib/date-utils';
import { plainLength } from '@/lib/text-parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path?: string[] }> };

const MAX_SIZE = 20 * 1024 * 1024;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function sanitizeLabel(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, ' ').trim();
  return base.slice(0, 24) || '自定义背景';
}

async function dailyPayload(date?: string) {
  const info = await ensureDaily(date);
  return {
    date: info.date,
    variant: info.variant,
    backgroundId: info.backgroundId,
    backgroundLabel: info.backgroundLabel,
    backgroundPalette: info.backgroundPalette,
    quoteId: info.quoteId,
    quoteContent: info.quoteContent,
    quoteFootnote: info.quoteFootnote,
    imageUrl: `/api/card-image?date=${info.date}&v=${info.variant}`,
  };
}

// ---------- GET ----------
export async function GET(req: NextRequest, ctx: Ctx) {
  const { path: segs = [] } = await ctx.params;

  // 健康检查
  if (segs.length === 0) {
    return json({ message: 'Hello, world!' });
  }

  // 文字素材列表
  if (segs[0] === 'quotes' && segs.length === 1) {
    await ensureSeeded();
    const items = await db.quote.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true, footnote: true, createdAt: true },
    });
    return json({ items });
  }

  // 背景素材列表
  if (segs[0] === 'backgrounds' && segs.length === 1) {
    await ensureSeeded();
    const items = await db.background.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true, origin: true, palette: true, createdAt: true },
    });
    return json({ items });
  }

  // 背景图片流
  if (segs[0] === 'backgrounds' && segs.length === 3 && segs[2] === 'image') {
    await ensureSeeded();
    const id = segs[1];
    const row = await db.background.findUnique({ where: { id } });
    if (!row) return new NextResponse('Not Found', { status: 404 });
    const fp = path.join(BG_DIR, row.filename);
    if (!fs.existsSync(fp)) return new NextResponse('Not Found', { status: 404 });
    const buf = await fs.promises.readFile(fp);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  // 当日（或指定日期）日签信息
  if (segs[0] === 'daily' && segs.length === 1) {
    const date = req.nextUrl.searchParams.get('date') ?? undefined;
    return json(await dailyPayload(date ?? undefined));
  }

  // 往期列表
  if (segs[0] === 'daily' && segs[1] === 'history') {
    const items = await listHistory(60);
    return json({
      items: items.map((it) => ({
        ...it,
        imageUrl: `/api/card-image?date=${it.date}&v=${it.variant}`,
      })),
    });
  }

  // 日签图片（首次访问自动生成并落盘）
  if (segs[0] === 'card-image' && segs.length === 1) {
    const date = req.nextUrl.searchParams.get('date') ?? undefined;
    const info = await ensureDaily(date ?? undefined);
    if (!fs.existsSync(info.imagePath)) {
      return new NextResponse('Not Found', { status: 404 });
    }
    const buf = await fs.promises.readFile(info.imagePath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  return json({ error: 'Not Found' }, 404);
}

// ---------- POST ----------
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path: segs = [] } = await ctx.params;

  // 新增文字素材
  if (segs[0] === 'quotes' && segs.length === 1) {
    await ensureSeeded();
    const body = (await req.json().catch(() => ({}))) as { content?: string; footnote?: string };
    const content = (body.content ?? '').trim();
    const footnote = (body.footnote ?? '').trim() || null;
    if (!content) return json({ error: '正文不能为空' }, 400);
    if (plainLength(content) > 500) return json({ error: '正文过长（纯文字请控制在 500 字内）' }, 400);
    if (footnote && footnote.length > 160) return json({ error: '英文注脚过长' }, 400);
    const row = await db.quote.create({ data: { content, footnote } });
    // 新文案进入素材池后，当日首卡重新随机
    const rec = await db.dailyCard.findUnique({ where: { date: todayStr() } });
    if (rec && rec.variant === 0) {
      await db.dailyCard.delete({ where: { date: todayStr() } }).catch(() => {});
      await invalidateCardFor(todayStr());
    }
    return json({ item: row });
  }

  // 上传背景（支持多文件）
  if (segs[0] === 'backgrounds' && segs.length === 1) {
    await ensureSeeded();
    ensureDirs();
    const form = await req.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) return json({ error: '未收到图片文件' }, 400);
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
    if (created.length > 0) {
      const rec = await db.dailyCard.findUnique({ where: { date: todayStr() } });
      if (rec && rec.variant === 0) {
        await db.dailyCard.delete({ where: { date: todayStr() } }).catch(() => {});
        await invalidateCardFor(todayStr());
      }
    }
    return json({ created, rejected });
  }

  // 换一换：当日重新随机
  if (segs[0] === 'daily' && segs[1] === 'regenerate') {
    const body = (await req.json().catch(() => ({}))) as { date?: string };
    const info = await regenerateDaily(body.date);
    return json({
      date: info.date,
      variant: info.variant,
      backgroundId: info.backgroundId,
      backgroundLabel: info.backgroundLabel,
      backgroundPalette: info.backgroundPalette,
      quoteId: info.quoteId,
      quoteContent: info.quoteContent,
      quoteFootnote: info.quoteFootnote,
      imageUrl: `/api/card-image?date=${info.date}&v=${info.variant}`,
    });
  }

  return json({ error: 'Not Found' }, 404);
}

// ---------- PATCH ----------
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path: segs = [] } = await ctx.params;

  // 修改背景配色方案
  if (segs[0] === 'backgrounds' && segs.length === 2) {
    await ensureSeeded();
    const id = segs[1];
    const body = (await req.json().catch(() => ({}))) as { palette?: string };
    const palette = body.palette ?? 'auto';
    const row = await db.background.update({
      where: { id },
      data: { palette },
      select: { id: true, palette: true },
    }).catch(() => null);
    if (!row) return json({ error: '背景不存在' }, 404);
    await invalidateCardFor(todayStr());
    return json({ ok: true, palette: row.palette });
  }

  return json({ error: 'Not Found' }, 404);
}

// ---------- DELETE ----------
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path: segs = [] } = await ctx.params;

  // 删除文字素材
  if (segs[0] === 'quotes' && segs.length === 2) {
    await ensureSeeded();
    const id = segs[1];
    const row = await db.quote.findUnique({ where: { id } });
    if (!row) return json({ error: '文案不存在' }, 404);
    await db.quote.delete({ where: { id } });
    await invalidateCardFor(todayStr());
    return json({ ok: true });
  }

  // 删除背景
  if (segs[0] === 'backgrounds' && segs.length === 2) {
    await ensureSeeded();
    const id = segs[1];
    const row = await db.background.findUnique({ where: { id } });
    if (!row) return json({ error: '背景不存在' }, 404);
    await db.background.delete({ where: { id } });
    const fp = path.join(BG_DIR, row.filename);
    if (fs.existsSync(fp)) {
      try {
        fs.unlinkSync(fp);
      } catch {
        /* ignore */
      }
    }
    await invalidateCardFor(todayStr());
    return json({ ok: true });
  }

  return json({ error: 'Not Found' }, 404);
}
