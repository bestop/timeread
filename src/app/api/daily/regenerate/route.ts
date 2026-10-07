import { NextRequest, NextResponse } from 'next/server';
import { regenerateDaily } from '@/lib/daily';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 换一换：当日重新随机
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { date?: string };
  const info = await regenerateDaily(body.date);
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
