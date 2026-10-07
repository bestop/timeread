import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { ensureDaily } from '@/lib/daily';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 日签图片（首次访问自动生成并落盘）
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? undefined;
  const info = await ensureDaily(date);
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
