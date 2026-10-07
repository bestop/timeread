'use client';

// 每日日签 · 主页面（单页四区：今日日签 / 背景库 / 文字库 / 往期回顾）
// 服务端状态统一用 TanStack Query 管理
import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { TodayTab } from '@/components/daily/TodayTab';
import { BackgroundsTab } from '@/components/daily/BackgroundsTab';
import { QuotesTab } from '@/components/daily/QuotesTab';
import { HistoryTab } from '@/components/daily/HistoryTab';
import { Sun } from 'lucide-react';
import { friendlyDate } from '@/lib/date-utils';

type TabKey = 'today' | 'backgrounds' | 'quotes' | 'history';

const TABS: { key: TabKey; label: string; en: string }[] = [
  { key: 'today', label: '今日日签', en: 'Today' },
  { key: 'backgrounds', label: '背景库', en: 'Backgrounds' },
  { key: 'quotes', label: '文字库', en: 'Words' },
  { key: 'history', label: '往期回顾', en: 'Archive' },
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
  const { data: bgData } = useQuery({
    queryKey: ['backgrounds'],
    queryFn: () => fetchJson<{ items: unknown[] }>('/api/backgrounds'),
  });
  const { data: quoteData } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => fetchJson<{ items: unknown[] }>('/api/quotes'),
  });
  const [today] = useState(todayCN);

  return (
    <div className="flex min-h-screen flex-col">
      {/* 头部 */}
      <header className="sticky top-0 z-40 border-b border-[#e3ded2] bg-[#f6f4ee]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2c2a26] text-[#f6f4ee]">
              <Sun className="h-4 w-4" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="font-serif-sc text-lg font-semibold tracking-wide text-[#2c2a26]">
                每日日签
              </p>
              <p className="text-[11px] tracking-[0.22em] text-[#9a9384]">DAILY QUOTE CARD</p>
            </div>
          </div>
          <p className="hidden font-serif-sc text-sm text-[#6f6a60] sm:block">
            {friendlyDate(today)}
          </p>
        </div>
        {/* 标签导航 */}
        <nav aria-label="主导航" className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto sm:gap-2">
            {TABS.map((t) => {
              const activeTab = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  aria-current={activeTab ? 'page' : undefined}
                  className={`relative shrink-0 px-3 py-2.5 text-sm transition-colors sm:px-4 ${
                    activeTab ? 'text-[#2c2a26]' : 'text-[#8a8474] hover:text-[#4a463c]'
                  }`}
                >
                  <span className="font-serif-sc tracking-wider">{t.label}</span>
                  <span
                    className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-all sm:inset-x-4 ${
                      activeTab ? 'bg-[#2c2a26]' : 'bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* 主体 */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {tab === 'today' && (
          <TodayTab bgCount={bgData?.items?.length ?? 0} quoteCount={quoteData?.items?.length ?? 0} />
        )}
        {tab === 'backgrounds' && <BackgroundsTab />}
        {tab === 'quotes' && <QuotesTab />}
        {tab === 'history' && <HistoryTab />}
      </main>

      {/* 页脚 */}
      <footer className="mt-auto border-t border-[#e3ded2] bg-[#f1efe8]/60 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1.5 px-4 py-4 text-xs text-[#9a9384] sm:flex-row sm:px-6">
          <p>每日日签 · 背景与文字，每天合成一张</p>
          <p className="font-serif-sc tracking-widest">慢一点，比较快</p>
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
