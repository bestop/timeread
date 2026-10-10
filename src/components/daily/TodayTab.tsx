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
  // 卡片版本：classic = 日签版 3:4；square = 分享版 1:1（微信/朋友圈比例，带篆书印章落款）
  const [fmt, setFmt] = useState<'classic' | 'square'>('classic');

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

  const shareUrl = info ? `${info.imageUrl}&f=square` : null;
  const previewUrl = info ? (fmt === 'square' ? shareUrl : info.imageUrl) : null;
  const downloadName =
    fmt === 'square' ? `时光贴-分享-${info?.date ?? ''}.jpg` : `时光贴-${info?.date ?? ''}.jpg`;
  const switchFmt = (next: 'classic' | 'square') => {
    if (next === fmt) return;
    setFmt(next);
    setImgLoaded(false);
  };

  return (
    <div className="grid items-start gap-10 sm:gap-12 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)] xl:gap-16">
      {/* 卡片区：留白装裱 + 竖排标注 */}
      <div>
        <div className="mat-frame relative mx-auto w-full max-w-[420px]">
          <div
            className={`relative w-full overflow-hidden rounded-[2px] bg-[var(--paper-deep)] card-shadow transition-[aspect-ratio] duration-500 ${
              fmt === 'square' ? 'aspect-square' : 'aspect-[3/4]'
            }`}
          >
            {isLoading || !info ? (
              <Skeleton className="h-full w-full rounded-none" />
            ) : (
              <>
                {!imgLoaded && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}
                <Image
                  key={fmt}
                  src={previewUrl ?? ''}
                  alt={`日签 ${friendlyDate(info.date)}`}
                  fill
                  sizes="(max-width: 1024px) 92vw, 430px"
                  className={`object-cover transition-opacity duration-700 ease-out ${
                    imgLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
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
        {/* 版式切换：日签版 3:4 / 分享版 1:1（朋友圈） */}
        <div className="mx-auto mt-6 flex w-max items-center rounded-[2px] border border-[var(--hairline)] bg-white/40 p-0.5">
          {(
            [
              { key: 'classic' as const, label: '日签版', ratio: '3:4' },
              { key: 'square' as const, label: '分享版', ratio: '1:1' },
            ]
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => switchFmt(opt.key)}
              aria-pressed={fmt === opt.key}
              title={opt.key === 'square' ? '适配微信朋友圈的比例，右下角附篆书印章' : '竖版日签卡 3:4'}
              className={`flex h-8 items-center gap-1.5 rounded-[1px] px-3.5 text-xs tracking-[0.14em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ink)]/60 ${
                fmt === opt.key
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'text-[var(--ink-faint)] hover:text-[var(--ink)]'
              }`}
            >
              {opt.label}
              <span className={`text-[9px] tracking-[0.08em] ${fmt === opt.key ? 'text-[var(--paper)]/70' : 'text-[var(--ink-faint)]/70'}`}>
                {opt.ratio}
              </span>
            </button>
          ))}
        </div>
        <div className="mx-auto mt-3 flex w-full max-w-[420px] gap-3">
          <a
            href={(fmt === 'square' ? shareUrl : info?.imageUrl) ?? '#'}
            download={downloadName}
            aria-disabled={!info}
            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[2px] bg-[var(--ink)] text-sm tracking-[0.14em] text-[var(--paper)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] active:scale-[0.98] ${
              info ? 'hover:bg-[#3a362f]' : 'pointer-events-none opacity-40'
            }`}
          >
            <Download className="h-4 w-4" strokeWidth={1.6} />
            {fmt === 'square' ? '收藏分享卡' : '收藏此签'}
          </a>
          <button
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending || !info}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[2px] border border-[var(--hairline)] bg-transparent text-sm tracking-[0.14em] text-[var(--ink)] transition-all duration-300 hover:border-[var(--ink-faint)] hover:bg-white/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] active:scale-[0.98] disabled:opacity-40"
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
            className="group flex items-center gap-2.5 rounded-[2px] px-1 py-1.5 transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ink)]/60 disabled:opacity-40"
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
          <div className="mt-4 border-l border-[var(--hairline)] pl-5">
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
            <p className="font-serif-sc mt-2 text-3xl tabular-nums text-[var(--ink)]">
              {bgCount}
              <span className="ml-1.5 text-sm font-normal text-[var(--ink-soft)]">张</span>
            </p>
          </div>
          <div className="pl-4 sm:pl-6">
            <p className="text-xs tracking-[0.2em] text-[var(--ink-faint)]">文字素材</p>
            <p className="font-serif-sc mt-2 text-3xl tabular-nums text-[var(--ink)]">
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
