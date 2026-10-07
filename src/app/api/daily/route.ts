import { NextRequest, NextResponse } from 'next/server';
import { ensureDaily } from '@/lib/daily';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 当日（或指定日期）日签信息
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? undefined;
  const info = await ensureDaily(date);
  return NextResponse.json({
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
