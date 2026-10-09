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
  showDate: boolean; // 图片上是否绘制日期角标（可选显示项，默认显示）
  updatedAt: number; // 记录最后变更时间（毫秒），供图片 URL 缓存失效
  image: Buffer; // 已合成日签 JPEG
}

const nowMs = () => Date.now();

/** 按 (date, variant) 确定性挑选素材并合成 */
async function pickAndCompose(date: string, variant: number, showDate: boolean): Promise<DailyInfo> {
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
    showDate,
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
    showDate,
    updatedAt: nowMs(),
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
      // 日期显隐为可选偏好：新开一天时沿用最近一天的设置（默认显示）
      const last = await db.dailyCard.findFirst({ orderBy: { date: 'desc' }, select: { showDate: true } });
      const showDate = last?.showDate ?? true;
      const picked = await pickAndCompose(d, 0, showDate);
      try {
        await db.dailyCard.create({
          data: {
            date: d,
            backgroundId: picked.backgroundId ?? 'none',
            quoteId: picked.quoteId ?? 'none',
            variant: 0,
            showDate,
            image: picked.image,
          },
        });
        return picked;
      } catch (e) {
        // 跨实例并发冷启动：另一实例已建当日记录（date 唯一约束冲突）
        // → 回读记录并落入下方「记录已存在」路径，而非向用户报错
        record = await db.dailyCard.findUnique({ where: { date: d } });
        if (!record) throw e;
      }
    }

    // 记录存在：校验素材仍可用（并行查两条记录，免去逐条 count）
    const [bg, quote] = await Promise.all([
      record.backgroundId !== 'none'
        ? db.background.findUnique({ where: { id: record.backgroundId }, select: { id: true, label: true, palette: true } })
        : Promise.resolve(null),
      record.quoteId !== 'none'
        ? db.quote.findUnique({ where: { id: record.quoteId }, select: { id: true, content: true, footnote: true } })
        : Promise.resolve(null),
    ]);

    if ((record.backgroundId !== 'none' && !bg) || (record.quoteId !== 'none' && !quote)) {
      // 素材被删除 → 重新挑选并覆盖入库
      const picked = await pickAndCompose(d, record.variant, record.showDate);
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
      // 图片缺失（素材改动置空 / 显隐切换 / 旧数据迁移）→ 重生成
      const bgData = bg
        ? await db.background.findUnique({ where: { id: bg.id }, select: { data: true } }).then((r) => (r?.data ? Buffer.from(r.data) : null))
        : null;
      const { buffer } = await composeCard({
        backgroundBuffer: bgData,
        dateStr: d,
        content: quote?.content ?? FALLBACK_CONTENT,
        footnote: quote?.footnote ?? null,
        paletteKey: bg?.palette ?? 'auto',
        showDate: record.showDate,
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
        showDate: record.showDate,
        updatedAt: nowMs(),
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
      showDate: record.showDate,
      updatedAt: record.updatedAt ? new Date(record.updatedAt).getTime() : nowMs(),
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

/** 换一换：variant+1 重新随机（同日内重选，不影响往期；沿用当日显隐偏好） */
export async function regenerateDaily(date?: string): Promise<DailyInfo> {
  const d = date && isValidDateStr(date) ? date : todayStr();
  // 先确保当日记录存在（若首次生成正在途中共用同一任务，避免并发竞态）
  await ensureDaily(d);
  const existing = await db.dailyCard.findUnique({ where: { date: d } });
  const variant = (existing?.variant ?? 0) + 1;
  const showDate = existing?.showDate ?? true;
  const picked = await pickAndCompose(d, variant, showDate);
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
        showDate,
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
  { date: string; variant: number; showDate: boolean; updatedAt: number; backgroundLabel: string; quoteExcerpt: string }[]
> {
  await ensureSeeded();
  const today = todayStr();
  const records = await db.dailyCard.findMany({
    where: { date: { lt: today } },
    orderBy: { date: 'desc' },
    take: limit,
  });
  // 批量取被引用素材（各 1 次查询），避免逐条 N+1 往返
  const bgIds = [...new Set(records.filter((r) => r.backgroundId !== 'none').map((r) => r.backgroundId))];
  const quoteIds = [...new Set(records.filter((r) => r.quoteId !== 'none').map((r) => r.quoteId))];
  const [bgs, quotes] = await Promise.all([
    bgIds.length
      ? db.background.findMany({ where: { id: { in: bgIds } }, select: { id: true, label: true } })
      : Promise.resolve([] as { id: string; label: string }[]),
    quoteIds.length
      ? db.quote.findMany({ where: { id: { in: quoteIds } }, select: { id: true, content: true } })
      : Promise.resolve([] as { id: string; content: string }[]),
  ]);
  const bgLabels = new Map(bgs.map((b) => [b.id, b.label]));
  const quoteContents = new Map(quotes.map((q) => [q.id, q.content]));
  return records.map((r) => ({
    date: r.date,
    variant: r.variant,
    showDate: r.showDate,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).getTime() : 0,
    backgroundLabel: bgLabels.get(r.backgroundId) || '自定义背景',
    quoteExcerpt: (quoteContents.get(r.quoteId) ?? FALLBACK_CONTENT)
      .replace(/[【】]|~~/g, '')
      .replace(/\n/g, ' ')
      .slice(0, 48),
  }));
}
