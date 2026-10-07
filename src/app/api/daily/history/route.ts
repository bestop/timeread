import { NextResponse } from 'next/server';
import { listHistory } from '@/lib/daily';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await listHistory(60);
  return NextResponse.json({
    items: items.map((it) => ({
      ...it,
      imageUrl: `/api/card-image?date=${it.date}&v=${it.variant}`,
    })),
  });
}
