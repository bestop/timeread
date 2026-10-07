// 每日日签服务：确定性选取 + 生成 + 缓存
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { CARD_DIR, BG_DIR, ensureDirs, ensureSeeded, mulberry32, hashStr } from './seed';
import { composeCard } from './card-composer';
import { todayStr, isValidDateStr } from './date-utils';

const FALLBACK_CONTENT = '愿你眼里有光，心中有暖，~~无惧岁月漫长~~。';

export interface DailyInfo {
  date: string;
  variant: number;
  backgroundId: string | null;
  backgroundLabel: string;
  backgroundPalette: string;
  quoteId: string | null;
  quoteContent: string;
  quoteFootnote: string | null;
  imagePath: string;
}

function cardFilePath(date: string, variant: number): string {
  return path.join(CARD_DIR, `${date}_v${variant}.jpg`);
}

function removeCardFiles(date: string, keep?: string) {
  ensureDirs();
  if (!fs.existsSync(CARD_DIR)) return;
  for (const f of fs.readdirSync(CARD_DIR)) {
    if (f.startsWith(`${date}_v`) && f !== keep) {
      try {
        fs.unlinkSync(path.join(CARD_DIR, f));
      } catch {
        /* ignore */
      }
    }
  }
}

/** 按 (date, variant) 确定性挑选素材并合成 */
async function pickAndCompose(date: string, variant: number): Promise<{
  buffer: Buffer;
  backgroundId: string | null;
  backgroundLabel: string;
  backgroundPalette: string;
  quoteId: string | null;
  quoteContent: string;
  quoteFootnote: string | null;
}> {
  const [bgs, quotes] = await Promise.all([
    db.background.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, filename: true, label: true, palette: true },
    }),
    db.quote.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, content: true, footnote: true },
    }),
  ]);

  const rnd = mulberry32(hashStr(`${date}#${variant}`));
  const bg = bgs.length ? bgs[Math.floor(rnd() * bgs.length) % bgs.length] : null;
  const quote = quotes.length ? quotes[Math.floor(rnd() * 10007) % quotes.length] : null;

  const bgPath = bg ? path.join(BG_DIR, bg.filename) : null;
  const { buffer } = await composeCard({
    backgroundPath: bgPath && fs.existsSync(bgPath) ? bgPath : null,
    dateStr: date,
    content: quote?.content ?? FALLBACK_CONTENT,
    footnote: quote?.footnote ?? null,
    paletteKey: bg?.palette ?? 'auto',
  });

  return {
    buffer,
    backgroundId: bg?.id ?? null,
    backgroundLabel: bg?.label || (bg ? '自定义背景' : '素色底纹'),
    backgroundPalette: bg?.palette ?? 'auto',
    quoteId: quote?.id ?? null,
    quoteContent: quote?.content ?? FALLBACK_CONTENT,
    quoteFootnote: quote?.footnote ?? null,
  };
}

const inflight = new Map<string, Promise<DailyInfo>>();

/** 确保某天的日签存在（首次访问自动生成），返回其信息 */
export async function ensureDaily(date?: string): Promise<DailyInfo> {
  const d = date && isValidDateStr(date) ? date : todayStr();
  const running = inflight.get(d);
  if (running) return running;

  const task = (async (): Promise<DailyInfo> => {
    await ensureSeeded();
    ensureDirs();

    let record = await db.dailyCard.findUnique({ where: { date: d } });

    if (!record) {
      const picked = await pickAndCompose(d, 0);
      const fp = cardFilePath(d, 0);
      fs.writeFileSync(fp, picked.buffer);
      record = await db.dailyCard.create({
        data: {
          date: d,
          backgroundId: picked.backgroundId ?? 'none',
          quoteId: picked.quoteId ?? 'none',
          variant: 0,
        },
      });
      return {
        date: d,
        variant: 0,
        backgroundId: picked.backgroundId,
        backgroundLabel: picked.backgroundLabel,
        backgroundPalette: picked.backgroundPalette,
        quoteId: picked.quoteId,
        quoteContent: picked.quoteContent,
        quoteFootnote: picked.quoteFootnote,
        imagePath: fp,
      };
    }

    // 记录存在：校验素材仍可用
    let needRecompose = false;
    let variant = record.variant;
    const bgExists = record.backgroundId === 'none' ? true : await db.background.count({ where: { id: record.backgroundId } }) > 0;
    const quoteExists = record.quoteId === 'none' ? true : await db.quote.count({ where: { id: record.quoteId } }) > 0;

    let bg: { id: string; filename: string; label: string; palette: string } | null = null;
    let quote: { id: string; content: string; footnote: string | null } | null = null;
    if (record.backgroundId !== 'none') {
      const found = await db.background.findUnique({ where: { id: record.backgroundId } });
      bg = found ? { id: found.id, filename: found.filename, label: found.label, palette: found.palette } : null;
    }
    if (record.quoteId !== 'none') {
      const found = await db.quote.findUnique({ where: { id: record.quoteId } });
      quote = found ? { id: found.id, content: found.content, footnote: found.footnote } : null;
    }
    if ((record.backgroundId !== 'none' && !bgExists) || (record.quoteId !== 'none' && !quoteExists)) {
      // 素材被删除 → 重新挑选
      removeCardFiles(d);
      const picked = await pickAndCompose(d, variant);
      const fp = cardFilePath(d, variant);
      fs.writeFileSync(fp, picked.buffer);
      await db.dailyCard.update({
        where: { date: d },
        data: { backgroundId: picked.backgroundId ?? 'none', quoteId: picked.quoteId ?? 'none' },
      });
      return {
        date: d,
        variant,
        backgroundId: picked.backgroundId,
        backgroundLabel: picked.backgroundLabel,
        backgroundPalette: picked.backgroundPalette,
        quoteId: picked.quoteId,
        quoteContent: picked.quoteContent,
        quoteFootnote: picked.quoteFootnote,
        imagePath: fp,
      };
    }

    const fp = cardFilePath(d, variant);
    if (!fs.existsSync(fp)) needRecompose = true;
    if (needRecompose) {
      const bgPath = bg ? path.join(BG_DIR, bg.filename) : null;
      const { buffer } = await composeCard({
        backgroundPath: bgPath && fs.existsSync(bgPath) ? bgPath : null,
        dateStr: d,
        content: quote?.content ?? FALLBACK_CONTENT,
        footnote: quote?.footnote ?? null,
        paletteKey: bg?.palette ?? 'auto',
      });
      fs.writeFileSync(fp, buffer);
    }

    return {
      date: d,
      variant,
      backgroundId: bg?.id ?? null,
      backgroundLabel: bg?.label || (bg ? '自定义背景' : '素色底纹'),
      backgroundPalette: bg?.palette ?? 'auto',
      quoteId: quote?.id ?? null,
      quoteContent: quote?.content ?? FALLBACK_CONTENT,
      quoteFootnote: quote?.footnote ?? null,
      imagePath: fp,
    };
  })();

  inflight.set(d, task);
  try {
    return await task;
  } finally {
    inflight.delete(d);
  }
}

/** 换一换：variant+1 重新随机（同日内重选，不影响往期） */
export async function regenerateDaily(date?: string): Promise<DailyInfo> {
  const d = date && isValidDateStr(date) ? date : todayStr();
  await ensureSeeded();
  ensureDirs();
  const existing = await db.dailyCard.findUnique({ where: { date: d } });
  const variant = (existing?.variant ?? 0) + 1;
  const picked = await pickAndCompose(d, variant);
  removeCardFiles(d, `${d}_v${variant}.jpg`);
  const fp = cardFilePath(d, variant);
  fs.writeFileSync(fp, picked.buffer);
  if (existing) {
    await db.dailyCard.update({
      where: { date: d },
      data: { variant, backgroundId: picked.backgroundId ?? 'none', quoteId: picked.quoteId ?? 'none' },
    });
  } else {
    await db.dailyCard.create({
      data: { date: d, variant, backgroundId: picked.backgroundId ?? 'none', quoteId: picked.quoteId ?? 'none' },
    });
  }
  return {
    date: d,
    variant,
    backgroundId: picked.backgroundId,
    backgroundLabel: picked.backgroundLabel,
    backgroundPalette: picked.backgroundPalette,
    quoteId: picked.quoteId,
    quoteContent: picked.quoteContent,
    quoteFootnote: picked.quoteFootnote,
    imagePath: fp,
  };
}

/** 素材库变动后：若当日卡片引用了被改动的素材则使其重生成 */
export async function invalidateCardFor(date: string) {
  removeCardFiles(date);
}

/** 往期列表 */
export async function listHistory(limit = 60): Promise<
  { date: string; variant: number; backgroundLabel: string; quoteExcerpt: string }[]
> {
  await ensureSeeded();
  const today = todayStr();
  const records = await db.dailyCard.findMany({
    where: { date: { lt: today } },
    orderBy: { date: 'desc' },
    take: limit,
  });
  const result = [];
  for (const r of records) {
    const [bg, quote] = await Promise.all([
      r.backgroundId !== 'none'
        ? db.background.findUnique({ where: { id: r.backgroundId }, select: { label: true } })
        : null,
      r.quoteId !== 'none' ? db.quote.findUnique({ where: { id: r.quoteId }, select: { content: true } }) : null,
    ]);
    result.push({
      date: r.date,
      variant: r.variant,
      backgroundLabel: bg?.label || '自定义背景',
      quoteExcerpt: (quote?.content ?? FALLBACK_CONTENT).replace(/[【】]|~~/g, '').replace(/\n/g, ' ').slice(0, 48),
    });
  }
  return result;
}
