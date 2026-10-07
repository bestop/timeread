'use client';

// 往期回顾：按日期浏览历史日签，点击放大 + 下载
import { useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
      {isLoading || items === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-md" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#d8d2c4] bg-white/40 p-16 text-center">
          <p className="font-serif-sc text-lg text-[#4a463c]">还没有往期日签</p>
          <p className="mt-2 text-sm text-[#9a9384]">
            从明天起，每天都会自动留存一张；今天生成的卡片可在「今日日签」中查看。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((it) => (
            <button
              key={it.date}
              onClick={() => setActive(it)}
              className="group rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c2a26]"
              aria-label={`查看 ${friendlyDate(it.date)} 的日签`}
            >
              <div className="card-shadow relative aspect-[3/4] w-full overflow-hidden rounded-md border border-[#e3ded2] bg-[#eceae4]">
                <Image
                  src={it.imageUrl}
                  alt={`日签 ${friendlyDate(it.date)}`}
                  fill
                  sizes="(max-width: 640px) 45vw, 18vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  unoptimized
                />
              </div>
              <p className="font-serif-sc mt-2 text-sm text-[#3a372f]">{chineseDate(it.date)}</p>
              <p className="truncate text-xs text-[#9a9384]" title={it.quoteExcerpt}>
                {it.quoteExcerpt}
              </p>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md border-[#e3ded2] bg-[#f9f7f1] p-4">
          <DialogHeader>
            <DialogTitle className="font-serif-sc text-base text-[#2c2a26]">
              {active ? friendlyDate(active.date) : ''}
            </DialogTitle>
          </DialogHeader>
          {active && (
            <div>
              <div className="card-shadow relative mx-auto aspect-[3/4] w-full max-w-[380px] overflow-hidden rounded-sm">
                <Image
                  src={active.imageUrl}
                  alt={`日签 ${friendlyDate(active.date)}`}
                  fill
                  sizes="380px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="mt-4 flex justify-center">
                <Button asChild className="bg-[#2c2a26] text-[#f6f4ee] hover:bg-[#443f37]">
                  <a href={active.imageUrl} download={`日签-${active.date}.jpg`}>
                    <Download className="h-4 w-4" />
                    保存图片
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
