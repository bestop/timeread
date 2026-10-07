'use client';

// 今日日签：展墙式卡片呈现 + 下载 + 换一换 + 编辑部信息栏
import { useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, RefreshCw, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyDate, chineseDate, numericDate } from '@/lib/date-utils';
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
  showDate: boolean;
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

  // 日期显隐：可选显示项（默认显示，去掉勾选后日签图不绘制日期角标）
  const setVisibility = useMutation({
    mutationFn: async (showDate: boolean) => {
      const res = await fetch('/api/daily/date-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showDate }),
      });
      if (!res.ok) throw new Error('设置失败');
      return res.json() as Promise<DailyInfo>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['daily'], data);
      setImgLoaded(false);
      toast.success(data.showDate ? '已恢复图上日期' : '已隐藏图上日期');
    },
    onError: () => toast.error('设置失败，请重试'),
  });

  const paletteLabel =
    info?.backgroundPalette && PALETTES[info.backgroundPalette]
      ? PALETTES[info.backgroundPalette].label
      : '自动取色';

  return (
    <div className="grid items-start gap-10 sm:gap-12 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)] xl:gap-16">
      {/* 卡片区：留白装裱 + 竖排标注 */}
      <div>
        <div className="mat-frame relative mx-auto w-full max-w-[420px]">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[2px] bg-[var(--paper-deep)] card-shadow">
            {isLoading || !info ? (
              <Skeleton className="h-full w-full rounded-none" />
            ) : (
              <>
                {!imgLoaded && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}
                <Image
                  src={info.imageUrl}
                  alt={`日签 ${friendlyDate(info.date)}`}
                  fill
                  sizes="(max-width: 1024px) 92vw, 430px"
                  className="object-cover"
                  priority
                  unoptimized
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgLoaded(true)}
                />
              </>
            )}
          </div>
          {/* 竖排标注（桌面端，锚定卡片外右上） */}
          <div
            className="absolute -right-8 top-1 hidden select-none flex-col items-center gap-4 lg:flex"
            aria-hidden
          >
            <span className="v-text font-serif-sc text-[13px] text-[var(--ink-soft)]">今日日签</span>
            <span className="h-10 w-px bg-[var(--hairline)]" />
            <span className="v-text text-[10px] tracking-[0.3em] text-[var(--ink-faint)]">
              {info ? chineseDate(info.date) : ''}
            </span>
          </div>
        </div>
        <div className="mx-auto mt-8 flex w-full max-w-[420px] gap-3">
          <a
            href={info?.imageUrl ?? '#'}
            download={`时光贴-${info?.date ?? ''}.jpg`}
            aria-disabled={!info}
            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[2px] bg-[var(--ink)] text-sm tracking-[0.14em] text-[var(--paper)] transition-colors duration-300 ${
              info ? 'hover:bg-[#3a362f]' : 'pointer-events-none opacity-40'
            }`}
          >
            <Download className="h-4 w-4" strokeWidth={1.6} />
            收藏此签
          </a>
          <button
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending || !info}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[2px] border border-[var(--hairline)] bg-transparent text-sm tracking-[0.14em] text-[var(--ink)] transition-colors duration-300 hover:border-[var(--ink-faint)] hover:bg-white/40 disabled:opacity-40"
          >
            {regenerate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} />
            ) : (
              <RefreshCw className="h-4 w-4" strokeWidth={1.6} />
            )}
            再取一签
          </button>
        </div>
        {/* 日期显隐：可选显示项（默认勾选显示） */}
        <div className="mx-auto mt-5 flex w-full max-w-[420px] items-center justify-center">
          <button
            type="button"
            role="checkbox"
            aria-checked={info?.showDate ?? true}
            disabled={setVisibility.isPending || !info}
            onClick={() => setVisibility.mutate(!(info?.showDate ?? true))}
            className="group flex items-center gap-2.5 rounded-[2px] px-1 py-1.5 transition-opacity duration-300 disabled:opacity-40"
          >
            <span
              aria-hidden
              className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center border transition-colors duration-300 ${
                info?.showDate ?? true
                  ? 'border-[var(--ink)] bg-[var(--ink)]'
                  : 'border-[var(--ink-faint)] bg-transparent group-hover:border-[var(--ink-soft)]'
              }`}
            >
              {(info?.showDate ?? true) && (
                <Check className="h-3 w-3 text-[var(--paper)]" strokeWidth={2.6} />
              )}
            </span>
            <span className="font-serif-sc text-[13px] tracking-[0.22em] text-[var(--ink-soft)] transition-colors duration-300 group-hover:text-[var(--ink)]">
              图片显示日期
            </span>
          </button>
        </div>
      </div>

      {/* 信息区：编辑部式排版，发丝线分隔 */}
      <div className="min-w-0">
        <p className="eyebrow">Today · 一天一签</p>
        <h2 className="font-serif-sc mt-3 text-[27px] font-semibold leading-tight tracking-wide text-[var(--ink)] sm:text-[38px]">
          {info ? friendlyDate(info.date) : '今日日签'}
        </h2>
        <p className="mt-2 text-xs tracking-[0.24em] text-[var(--ink-faint)]">
          {info ? numericDate(info.date) : ''}
        </p>

        <div className="mt-9 border-t border-[var(--hairline)] pt-7">
          <div className="flex items-center gap-2.5">
            <span className="font-serif-sc text-sm tracking-[0.3em] text-[var(--ink-soft)]">今日之文</span>
            <span className="h-px flex-1 bg-[var(--hairline-soft)]" aria-hidden />
          </div>
          <div className="mt-4">
            {info ? (
              <FormattedQuote
                content={info.quoteContent}
                className="font-serif-sc text-[17px] leading-loose text-[#33302a]"
              />
            ) : (
              <Skeleton className="h-20 w-full" />
            )}
            {info?.quoteFootnote && (
              <p className="mt-4 text-sm italic leading-relaxed text-[var(--ink-faint)]">
                &ldquo;{info.quoteFootnote}&rdquo;
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--hairline)] pt-7">
          <div className="flex items-center gap-2.5">
            <span className="font-serif-sc text-sm tracking-[0.3em] text-[var(--ink-soft)]">今日之底</span>
            <span className="h-px flex-1 bg-[var(--hairline-soft)]" aria-hidden />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--ink-soft)]">
            {info ? (
              <>
                <span>
                  <span className="text-xs text-[var(--ink-faint)]">背景 </span>
                  {info.backgroundLabel}
                </span>
                <span>
                  <span className="text-xs text-[var(--ink-faint)]">配色 </span>
                  {paletteLabel}
                </span>
              </>
            ) : (
              <Skeleton className="h-5 w-52" />
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 border-t border-[var(--hairline)] pt-7">
          <div className="border-r border-[var(--hairline-soft)] pr-4 sm:pr-6">
            <p className="text-xs tracking-[0.2em] text-[var(--ink-faint)]">背景素材</p>
            <p className="font-serif-sc mt-2 text-3xl text-[var(--ink)]">
              {bgCount}
              <span className="ml-1.5 text-sm font-normal text-[var(--ink-soft)]">张</span>
            </p>
          </div>
          <div className="pl-4 sm:pl-6">
            <p className="text-xs tracking-[0.2em] text-[var(--ink-faint)]">文字素材</p>
            <p className="font-serif-sc mt-2 text-3xl text-[var(--ink)]">
              {quoteCount}
              <span className="ml-1.5 text-sm font-normal text-[var(--ink-soft)]">条</span>
            </p>
          </div>
        </div>

        <p className="mt-9 text-[13px] leading-[1.9] text-[var(--ink-faint)]">
          每天一张：从背景库与文字库中各选一份，按当日日期合成。
          素材库愈丰，相遇愈妙；添了新素材，点「再取一签」即可见新境。
        </p>
      </div>
    </div>
  );
}
