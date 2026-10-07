import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { BG_DIR, ensureSeeded } from '@/lib/seed';
import { invalidateCardFor } from '@/lib/daily';
import { todayStr } from '@/lib/date-utils';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

// 修改配色方案
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  await ensureSeeded();
  const body = (await req.json().catch(() => ({}))) as { palette?: string };
  const palette = body.palette ?? 'auto';
  const row = await db.background.update({
    where: { id },
    data: { palette },
    select: { id: true, palette: true },
  }).catch(() => null);
  if (!row) return NextResponse.json({ error: '背景不存在' }, { status: 404 });
  await invalidateCardFor(todayStr());
  return NextResponse.json({ ok: true, palette: row.palette });
}

// 删除背景
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  await ensureSeeded();
  const row = await db.background.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: '背景不存在' }, { status: 404 });
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
  return NextResponse.json({ ok: true });
}
