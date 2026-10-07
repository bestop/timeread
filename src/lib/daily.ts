// 每日日签服务：确定性选取 + 生成 + 入库缓存（日签图本体存于数据库）
import { db } from './db';
import { ensureSeeded, mulberry32, hashStr } from './seed';
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
  image: Buffer; // 已合成日签 JPEG
}

/** 按 (date, variant) 确定性挑选素材并合成 */
async function pickAndCompose(date: string, variant: number): Promise<DailyInfo> {
  const [bgs, quotes] = await Promise.all([
    db.background.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, label: true, palette: true },
    }),
    db.quote.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, content: true, footnote: true },
    }),
  ]);

  const rnd = mulberry32(hashStr(`${date}#${variant}`));
  const bg = bgs.length ? bgs[Math.floor(rnd() * bgs.length) % bgs.length] : null;
  const quote = quotes.length ? quotes[Math.floor(rnd() * 10007) % quotes.length] : null;

  // 仅按需取选中背景的二进制
  let bgData: Buffer | null = null;
  if (bg) {
    const row = await db.background.findUnique({ where: { id: bg.id }, select: { data: true } });
    bgData = row?.data ? Buffer.from(row.data) : null;
  }

  const { buffer } = await composeCard({
    backgroundBuffer: bgData,
    dateStr: date,
    content: quote?.content ?? FALLBACK_CONTENT,
    footnote: quote?.footnote ?? null,
    paletteKey: bg?.palette ?? 'auto',
  });

  return {
    date,
    variant,
    backgroundId: bg?.id ?? null,
    backgroundLabel: bg?.label || (bg ? '自定义背景' : '素色底纹'),
    backgroundPalette: bg?.palette ?? 'auto',
    quoteId: quote?.id ?? null,
    quoteContent: quote?.content ?? FALLBACK_CONTENT,
    quoteFootnote: quote?.footnote ?? null,
    image: buffer,
  };
}

const inflight = new Map<string, Promise<DailyInfo>>();

/** 确保某天的日签存在（首次访问自动生成并入库），返回其信息 */
export async function ensureDaily(date?: string): Promise<DailyInfo> {
  const d = date && isValidDateStr(date) ? date : todayStr();
  const running = inflight.get(d);
  if (running) return running;

  const task = (async (): Promise<DailyInfo> => {
    await ensureSeeded();

    let record = await db.dailyCard.findUnique({ where: { date: d } });

    if (!record) {
      const picked = await pickAndCompose(d, 0);
      await db.dailyCard.create({
        data: {
          date: d,
          backgroundId: picked.backgroundId ?? 'none',
          quoteId: picked.quoteId ?? 'none',
          variant: 0,
          image: picked.image,
        },
      });
      return picked;
    }

    // 记录存在：校验素材仍可用
    const bgExists = record.backgroundId === 'none' ? true : await db.background.count({ where: { id: record.backgroundId } }) > 0;
    const quoteExists = record.quoteId === 'none' ? true : await db.quote.count({ where: { id: record.quoteId } }) > 0;

    let bg: { id: string; label: string; palette: string } | null = null;
    let quote: { id: string; content: string; footnote: string | null } | null = null;
    if (record.backgroundId !== 'none') {
      const found = await db.background.findUnique({ where: { id: record.backgroundId }, select: { id: true, label: true, palette: true } });
      bg = found;
    }
    if (record.quoteId !== 'none') {
      const found = await db.quote.findUnique({ where: { id: record.quoteId }, select: { id: true, content: true, footnote: true } });
      quote = found;
    }

    if ((record.backgroundId !== 'none' && !bgExists) || (record.quoteId !== 'none' && !quoteExists)) {
      // 素材被删除 → 重新挑选并覆盖入库
      const picked = await pickAndCompose(d, record.variant);
      await db.dailyCard.update({
        where: { date: d },
        data: {
          backgroundId: picked.backgroundId ?? 'none',
          quoteId: picked.quoteId ?? 'none',
          image: picked.image,
        },
      });
      return picked;
    }

    const hasImage = record.image && Buffer.from(record.image).length > 0;
    if (!hasImage) {
      // 图片缺失（素材改动置空 / 旧数据迁移）→ 重生成
      const bgData = bg
        ? await db.background.findUnique({ where: { id: bg.id }, select: { data: true } }).then((r) => (r?.data ? Buffer.from(r.data) : null))
        : null;
      const { buffer } = await composeCard({
        backgroundBuffer: bgData,
        dateStr: d,
        content: quote?.content ?? FALLBACK_CONTENT,
        footnote: quote?.footnote ?? null,
        paletteKey: bg?.palette ?? 'auto',
      });
      await db.dailyCard.update({ where: { date: d }, data: { image: buffer } });
      return {
        date: d,
        variant: record.variant,
        backgroundId: bg?.id ?? null,
        backgroundLabel: bg?.label || (bg ? '自定义背景' : '素色底纹'),
        backgroundPalette: bg?.palette ?? 'auto',
        quoteId: quote?.id ?? null,
        quoteContent: quote?.content ?? FALLBACK_CONTENT,
        quoteFootnote: quote?.footnote ?? null,
        image: buffer,
      };
    }

    return {
      date: d,
      variant: record.variant,
      backgroundId: bg?.id ?? null,
      backgroundLabel: bg?.label || (bg ? '自定义背景' : '素色底纹'),
      backgroundPalette: bg?.palette ?? 'auto',
      quoteId: quote?.id ?? null,
      quoteContent: quote?.content ?? FALLBACK_CONTENT,
      quoteFootnote: quote?.footnote ?? null,
      image: Buffer.from(record.image),
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
  const existing = await db.dailyCard.findUnique({ where: { date: d } });
  const variant = (existing?.variant ?? 0) + 1;
  const picked = await pickAndCompose(d, variant);
  if (existing) {
    await db.dailyCard.update({
      where: { date: d },
      data: {
        variant,
        backgroundId: picked.backgroundId ?? 'none',
        quoteId: picked.quoteId ?? 'none',
        image: picked.image,
      },
    });
  } else {
    await db.dailyCard.create({
      data: {
        date: d,
        variant,
        backgroundId: picked.backgroundId ?? 'none',
        quoteId: picked.quoteId ?? 'none',
        image: picked.image,
      },
    });
  }
  return picked;
}

/** 素材库变动后：若当日卡片引用了被改动的素材则使其重生成（置空图片） */
export async function invalidateCardFor(date: string) {
  await db.dailyCard.updateMany({ where: { date }, data: { image: null } }).catch(() => {});
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
