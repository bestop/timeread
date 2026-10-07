'use client';

// 往期回顾：按日期浏览历史日签，点击放大 + 下载
import { useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Download } from 'lucide-react';
import { friendlyDate, chineseDate } from '@/lib/date-utils';

interface HistoryItem {
  date: string;
  variant: number;
  backgroundLabel: string;
  quoteExcerpt: string;
  imageUrl: string;
}

export function HistoryTab() {
  const [active, setActive] = useState<HistoryItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const res = await fetch('/api/daily/history', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载失败');
      return res.json() as Promise<{ items: HistoryItem[] }>;
    },
  });
  const items = data?.items ?? null;

  return (
    <div>
      <p className="eyebrow">Archive · 往期回顾</p>
      <h2 className="font-serif-sc mt-2 text-2xl font-semibold tracking-wide text-[var(--ink)]">
        日子留痕
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-faint)]">
        每一张日签都会在这里留存，翻回去，那天的话还在。
      </p>

      <div className="mt-8">
        {isLoading || items === null ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-[2px]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-[var(--hairline)] bg-white/30 px-8 py-16 text-center">
            <p className="font-serif-sc text-[15px] tracking-[0.2em] text-[var(--ink-soft)]">
              还没有往期的痕迹
            </p>
            <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--ink-faint)]">
              自明天起，每日自动留存一张；今日之签可在「今日日签」中查看。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((it) => (
              <button
                key={it.date}
                onClick={() => setActive(it)}
                className="lift group rounded-[2px] text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ink)]"
                aria-label={`查看 ${friendlyDate(it.date)} 的日签`}
              >
                <div className="card-shadow-soft relative aspect-[3/4] w-full overflow-hidden rounded-[2px] bg-[var(--paper-deep)]">
                  <Image
                    src={it.imageUrl}
                    alt={`日签 ${friendlyDate(it.date)}`}
                    fill
                    sizes="(max-width: 640px) 45vw, 18vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    unoptimized
                  />
                </div>
                <p className="font-serif-sc mt-2.5 text-[13px] tracking-wide text-[#33302a]">
                  {chineseDate(it.date)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--ink-faint)]" title={it.quoteExcerpt}>
                  {it.quoteExcerpt}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md rounded-[2px] border-[var(--hairline)] bg-[var(--paper)] p-6">
          <DialogHeader>
            <DialogTitle className="font-serif-sc text-base tracking-[0.14em] text-[var(--ink)]">
              {active ? friendlyDate(active.date) : ''}
            </DialogTitle>
          </DialogHeader>
          {active && (
            <div>
              <div className="card-shadow relative mx-auto aspect-[3/4] w-full max-w-[380px] overflow-hidden rounded-[2px]">
                <Image
                  src={active.imageUrl}
                  alt={`日签 ${friendlyDate(active.date)}`}
                  fill
                  sizes="380px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="mt-6 flex justify-center">
                <a
                  href={active.imageUrl}
                  download={`日签-${active.date}.jpg`}
                  className="flex h-10 items-center justify-center gap-2 rounded-[2px] bg-[var(--ink)] px-6 text-sm tracking-[0.14em] text-[var(--paper)] transition-colors duration-300 hover:bg-[#3a362f]"
                >
                  <Download className="h-4 w-4" strokeWidth={1.6} />
                  收藏此签
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
