'use client';

// 今日日签：卡片展示 + 下载 + 换一换 + 当日信息
import { useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, RefreshCw, Feather, ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyDate, chineseDate } from '@/lib/date-utils';
import { FormattedQuote } from './FormattedQuote';
import { PALETTES } from '@/lib/palettes';

interface DailyInfo {
  date: string;
  variant: number;
  backgroundId: string | null;
  backgroundLabel: string;
  backgroundPalette: string;
  quoteId: string | null;
  quoteContent: string;
  quoteFootnote: string | null;
  imageUrl: string;
}

async function fetchDaily(): Promise<DailyInfo> {
  const res = await fetch('/api/daily', { cache: 'no-store' });
  if (!res.ok) throw new Error('加载失败');
  return res.json();
}

export function TodayTab({ bgCount, quoteCount }: { bgCount: number; quoteCount: number }) {
  const queryClient = useQueryClient();
  const [imgLoaded, setImgLoaded] = useState(false);

  const { data: info, isLoading } = useQuery({
    queryKey: ['daily'],
    queryFn: fetchDaily,
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/daily/regenerate', { method: 'POST' });
      if (!res.ok) throw new Error('换一换失败');
      return res.json() as Promise<DailyInfo>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['daily'], data);
      setImgLoaded(false);
      toast.success('已为你换了一组新组合');
    },
    onError: () => toast.error('换一换失败，请重试'),
  });

  const paletteLabel =
    info?.backgroundPalette && PALETTES[info.backgroundPalette]
      ? PALETTES[info.backgroundPalette].label
      : '自动取色';

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)] items-start">
      {/* 卡片区 */}
      <div>
        <div className="relative mx-auto aspect-[3/4] w-full max-w-[440px] overflow-hidden rounded-sm bg-[#EDEAE2] card-shadow">
          {isLoading || !info ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <>
              {!imgLoaded && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}
              <Image
                src={info.imageUrl}
                alt={`日签 ${friendlyDate(info.date)}`}
                fill
                sizes="(max-width: 1024px) 90vw, 440px"
                className="object-cover"
                priority
                unoptimized
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgLoaded(true)}
              />
            </>
          )}
        </div>
        <div className="mx-auto mt-5 flex w-full max-w-[440px] gap-3">
          <Button
            asChild
            className="flex-1 bg-[#2c2a26] text-[#f6f4ee] hover:bg-[#443f37]"
            disabled={!info}
          >
            <a href={info?.imageUrl ?? '#'} download={`日签-${info?.date ?? ''}.jpg`}>
              <Download className="h-4 w-4" />
              保存图片
            </a>
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-[#c9c3b4] bg-transparent text-[#2c2a26] hover:bg-[#ece9df] hover:text-[#2c2a26]"
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending || !info}
          >
            {regenerate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            换一换
          </Button>
        </div>
      </div>

      {/* 信息区 */}
      <div className="min-w-0">
        <p className="font-serif-sc text-sm tracking-[0.3em] text-[#8a8474]">
          {info ? chineseDate(info.date) : '……'}
        </p>
        <h2 className="font-serif-sc mt-2 text-3xl font-semibold leading-snug text-[#2c2a26] sm:text-4xl">
          {info ? friendlyDate(info.date) : '今日日签'}
        </h2>

        <div className="mt-8 rounded-md border border-[#e3ded2] bg-white/60 p-6">
          <div className="flex items-center gap-2 text-sm text-[#8a8474]">
            <Feather className="h-4 w-4" />
            <span>今日文案</span>
          </div>
          {info ? (
            <FormattedQuote
              content={info.quoteContent}
              className="font-serif-sc mt-3 text-lg leading-loose text-[#3a372f]"
            />
          ) : (
            <Skeleton className="mt-3 h-20 w-full" />
          )}
          {info?.quoteFootnote && (
            <p className="mt-4 text-sm italic text-[#9a9384]">&ldquo;{info.quoteFootnote}&rdquo;</p>
          )}
          <Separator className="my-5 bg-[#e3ded2]" />
          <div className="flex items-center gap-2 text-sm text-[#8a8474]">
            <ImageIcon className="h-4 w-4" />
            <span>今日背景</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {info ? (
              <>
                <Badge variant="secondary" className="bg-[#ece9df] text-[#4a463c]">
                  {info.backgroundLabel}
                </Badge>
                <Badge variant="secondary" className="bg-[#ece9df] text-[#4a463c]">
                  配色 · {paletteLabel}
                </Badge>
              </>
            ) : (
              <Skeleton className="h-5 w-40" />
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-md border border-[#e3ded2] bg-white/60 p-5">
            <p className="text-sm text-[#8a8474]">背景素材</p>
            <p className="font-serif-sc mt-1 text-2xl text-[#2c2a26]">{bgCount} 张</p>
          </div>
          <div className="rounded-md border border-[#e3ded2] bg-white/60 p-5">
            <p className="text-sm text-[#8a8474]">文字素材</p>
            <p className="font-serif-sc mt-1 text-2xl text-[#2c2a26]">{quoteCount} 条</p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-[#8a8474]">
          每天自动生成一张新日签：从背景库与文字库中各选一份组合排版，并带上当天日期。
          素材库越大，组合越丰富；添加素材后点「换一换」立刻看到新效果。
        </p>
      </div>
    </div>
  );
}
