import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { BG_DIR } from '@/lib/seed';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
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
