'use client';

// 每日日签 · 主页面（单页四区：今日日签 / 背景库 / 文字库 / 往期回顾）
// 风格：高级 · 优雅 · 克制 · 诗意 —— 纸墨色系、衬线排版、发丝线分隔、竖排标注
// 服务端状态统一用 TanStack Query 管理
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { TodayTab } from '@/components/daily/TodayTab';
import { BackgroundsTab } from '@/components/daily/BackgroundsTab';
import { QuotesTab } from '@/components/daily/QuotesTab';
import { HistoryTab } from '@/components/daily/HistoryTab';
import { friendlyDate } from '@/lib/date-utils';
import { sealCharForDate } from '@/lib/seal';

type TabKey = 'today' | 'backgrounds' | 'quotes' | 'history';

const TABS: { key: TabKey; label: string; en: string; num: string }[] = [
  { key: 'today', label: '今日日签', en: 'Today', num: '壹' },
  { key: 'backgrounds', label: '背景库', en: 'Backgrounds', num: '贰' },
  { key: 'quotes', label: '文字库', en: 'Words', num: '叁' },
  { key: 'history', label: '往期回顾', en: 'Archive', num: '肆' },
];

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`请求失败 ${res.status}`);
  return res.json() as Promise<T>;
}

function todayCN() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function Shell() {
  const [tab, setTab] = useState<TabKey>('today');
  const queryClient = useQueryClient();
  const { data: bgData } = useQuery({
    queryKey: ['backgrounds'],
    queryFn: () => fetchJson<{ items: unknown[] }>('/api/backgrounds'),
  });
  const { data: quoteData } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => fetchJson<{ items: unknown[] }>('/api/quotes'),
  });
  const [today, setToday] = useState(todayCN);

  // 跨零点自愈：页面长驻时每分钟核对一次日期，翻日后刷新头部日期并失效日签/往期缓存
  useEffect(() => {
    const timer = setInterval(() => {
      const d = todayCN();
      if (d !== today) {
        setToday(d);
        queryClient.invalidateQueries({ queryKey: ['daily'] });
        queryClient.invalidateQueries({ queryKey: ['history'] });
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [today, queryClient]);

  return (
    <div id="root-shell" className="flex min-h-screen flex-col">
      {/* 头部：细线之下是导航，之上是品牌与日期 */}
      <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-[var(--paper)]/88 backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-700">
        <div className="mx-auto flex max-w-5xl items-end justify-between gap-4 px-5 pb-3 pt-4 sm:px-8 sm:pt-6">
          <div className="flex items-baseline gap-2.5 sm:gap-3">
            <span className="font-serif-sc text-[21px] font-semibold tracking-[0.08em] text-[var(--ink)] sm:text-[22px]">
              时光贴
            </span>
            {/* 印章：朱色钤印，篆书字随日期轮换（崇羲篆體），落款般收住品牌名 */}
            <span
              aria-hidden
              title={`今日印章 · ${sealCharForDate(today)}`}
              className="font-zhuan flex h-[20px] w-[20px] shrink-0 -translate-y-[3px] items-center justify-center rounded-[2px] bg-[#a8503a] text-[13px] leading-none text-[#f8f1e8] shadow-[0_1px_2px_rgba(30,28,25,0.16)] sm:h-[22px] sm:w-[22px] sm:text-[14px]"
            >
              {sealCharForDate(today)}
            </span>
            <span className="eyebrow !text-[9px] sm:!text-[10px]">TimeTap</span>
            <span className="hidden h-3.5 w-px bg-[var(--hairline)] sm:block" aria-hidden />
            <span className="hidden text-xs tracking-[0.42em] text-[var(--ink-soft)] sm:block">
              每日日签
            </span>
          </div>
          <p className="text-right font-serif-sc text-[11px] leading-relaxed text-[var(--ink-soft)] sm:text-[13px]">
            {friendlyDate(today)}
          </p>
        </div>
        {/* 标签导航 */}
        <nav aria-label="主导航" className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="no-scrollbar flex gap-5 overflow-x-auto sm:gap-9">
            {TABS.map((t) => {
              const activeTab = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  aria-current={activeTab ? 'page' : undefined}
                  className={`relative shrink-0 rounded-[2px] pb-3 pt-1.5 text-[13px] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ink)]/60 sm:text-sm ${
                    activeTab ? 'text-[var(--ink)]' : 'text-[var(--ink-faint)] hover:text-[var(--ink-soft)]'
                  }`}
                >
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={`text-[9px] transition-colors duration-300 sm:text-[10px] ${
                        activeTab ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)]/60'
                      }`}
                      aria-hidden
                    >
                      {t.num}
                    </span>
                    <span className="font-serif-sc tracking-[0.1em] sm:tracking-[0.18em]">{t.label}</span>
                  </span>
                  <span
                    className={`nav-underline absolute inset-x-0 bottom-0 h-px bg-[var(--ink)] ${
                      activeTab ? 'active' : ''
                    }`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* 主体 */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-14">
        <div key={tab} className="animate-in fade-in slide-in-from-bottom-3 duration-500">
          {tab === 'today' && (
            <TodayTab bgCount={bgData?.items?.length ?? 0} quoteCount={quoteData?.items?.length ?? 0} />
          )}
          {tab === 'backgrounds' && <BackgroundsTab />}
          {tab === 'quotes' && <QuotesTab />}
          {tab === 'history' && <HistoryTab />}
        </div>
      </main>

      {/* 页脚：留白居中，一句收束 */}
      <footer className="mt-auto border-t border-[var(--hairline)] bg-[var(--paper-deep)]/50 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-7">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1.5 px-5 text-center sm:px-8">
          {/* 饰点：一枚小小的菱形墨点，如卷尾钤印 */}
          <span aria-hidden className="mb-1.5 block h-[4px] w-[4px] rotate-45 bg-[var(--accent)]/70" />
          <p className="font-serif-sc text-[13px] tracking-[0.32em] text-[var(--ink-soft)]">
            日日是好日
          </p>
          <p className="eyebrow">TimeTap · A Daily Card of Words &amp; Scenes</p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Shell />
    </QueryClientProvider>
  );
}
