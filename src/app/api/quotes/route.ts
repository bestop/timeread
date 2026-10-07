import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureSeeded } from '@/lib/seed';
import { invalidateCardFor } from '@/lib/daily';
import { todayStr } from '@/lib/date-utils';
import { plainLength } from '@/lib/text-parser';

export const runtime = 'nodejs';

// 文字素材列表
export async function GET() {
  await ensureSeeded();
  const items = await db.quote.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, content: true, footnote: true, createdAt: true },
  });
  return NextResponse.json({ items });
}

// 新增文字素材
export async function POST(req: NextRequest) {
  await ensureSeeded();
  const body = (await req.json().catch(() => ({}))) as { content?: string; footnote?: string };
  const content = (body.content ?? '').trim();
  const footnote = (body.footnote ?? '').trim() || null;
  if (!content) {
    return NextResponse.json({ error: '正文不能为空' }, { status: 400 });
  }
  if (plainLength(content) > 500) {
    return NextResponse.json({ error: '正文过长（纯文字请控制在 500 字内）' }, { status: 400 });
  }
  if (footnote && footnote.length > 160) {
    return NextResponse.json({ error: '英文注脚过长' }, { status: 400 });
  }
  const row = await db.quote.create({ data: { content, footnote } });
  // 新文案进入素材池后，当日首卡重新随机
  const rec = await db.dailyCard.findUnique({ where: { date: todayStr() } });
  if (rec && rec.variant === 0) {
    await db.dailyCard.delete({ where: { date: todayStr() } }).catch(() => {});
    await invalidateCardFor(todayStr());
  }
  return NextResponse.json({ item: row });
}
