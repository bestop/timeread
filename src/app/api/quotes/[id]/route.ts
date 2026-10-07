import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCardFor } from '@/lib/daily';
import { ensureSeeded } from '@/lib/seed';
import { todayStr } from '@/lib/date-utils';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  await ensureSeeded();
  const row = await db.quote.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: '文案不存在' }, { status: 404 });
  await db.quote.delete({ where: { id } });
  await invalidateCardFor(todayStr());
  return NextResponse.json({ ok: true });
}
