'use client';

// 文字素材库：新增文案（带标记语法 + 实时预览）、列表管理、删除
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormattedQuote } from './FormattedQuote';
import { plainLength } from '@/lib/text-parser';

interface QuoteItem {
  id: string;
  content: string;
  footnote: string | null;
  createdAt: string;
}

export function QuotesTab() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [footnote, setFootnote] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const res = await fetch('/api/quotes', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载失败');
      return res.json() as Promise<{ items: QuoteItem[] }>;
    },
  });
  const items = data?.items ?? null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
    queryClient.invalidateQueries({ queryKey: ['daily'] });
  };

  const createQuote = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, footnote }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || '保存失败');
      return resData;
    },
    onSuccess: () => {
      toast.success('文字已收入库中');
      setContent('');
      setFootnote('');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : '保存失败'),
  });

  const removeQuote = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
    },
    onSuccess: () => {
      toast.success('文字已删除');
      refresh();
    },
    onError: () => toast.error('删除失败'),
  });

  const plen = plainLength(content);

  return (
    <div>
      <p className="eyebrow">Words · 文字库</p>
      <h2 className="font-serif-sc mt-2 text-2xl font-semibold tracking-wide text-[var(--ink)]">
        一字一心
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-faint)]">
        写下的每一段话，都会在某天与一张图相遇。
      </p>

      <div className="mt-6 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        {/* 新增表单 */}
        <div>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="quote-content" className="text-xs tracking-[0.2em] text-[var(--ink-soft)]">
                正文
              </Label>
              <Textarea
                id="quote-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={7}
                placeholder={'把想说的话写在这里，空行分段。\n用【文字】做高亮块，用~~文字~~做下划线。'}
                className="rounded-[2px] border-[var(--hairline)] bg-white/50 font-serif-sc text-[16px] leading-relaxed text-[#33302a] focus-visible:ring-[var(--ink-faint)]/40 sm:text-[15px]"
              />
              <p className="text-right text-xs text-[var(--ink-faint)]">{plen} / 500 字</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-footnote" className="text-xs tracking-[0.2em] text-[var(--ink-soft)]">
                英文注脚 · 卡片底部手写体（可选）
              </Label>
              <Input
                id="quote-footnote"
                value={footnote}
                onChange={(e) => setFootnote(e.target.value)}
                placeholder="Do not go gentle into that good night."
                className="rounded-[2px] border-[var(--hairline)] bg-white/50 text-[16px] focus-visible:ring-[var(--ink-faint)]/40 sm:text-sm"
              />
            </div>
            <button
              onClick={() => createQuote.mutate()}
              disabled={createQuote.isPending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[2px] bg-[var(--ink)] text-sm tracking-[0.18em] text-[var(--paper)] transition-colors duration-300 hover:bg-[#3a362f] disabled:opacity-40"
            >
              {createQuote.isPending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.6} /> : null}
              存入文字库
            </button>
            <p className="border-l-2 border-[var(--hairline)] pl-3.5 text-xs leading-[1.9] text-[var(--ink-faint)]">
              【文字】呈色块高亮，~~文字~~呈下划线；空行分段，卡片自动排版，
              字多时自动缩小字号以合于版心。
            </p>
          </div>
        </div>

        {/* 列表：发丝线分隔的编辑部条目 */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between border-b border-[var(--hairline)] pb-3">
            <span className="font-serif-sc text-sm tracking-[0.3em] text-[var(--ink-soft)]">已收文字</span>
            <span className="text-xs text-[var(--ink-faint)]">
              {items ? `${items.length} 条` : ''}
            </span>
          </div>
          {isLoading || items === null ? (
            <div className="mt-5 space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-none" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="mt-12 text-center font-serif-sc text-sm tracking-[0.2em] text-[var(--ink-faint)]">
              文字库还空着，等第一句话。
            </p>
          ) : (
            <div className="pretty-scroll max-h-[620px] overflow-y-auto pr-1.5">
              {items.map((it, idx) => (
                <div
                  key={it.id}
                  className={`group py-5 ${idx > 0 ? 'border-t border-[var(--hairline-soft)]' : ''}`}
                >
                  <FormattedQuote
                    content={it.content}
                    className="font-serif-sc text-[14.5px] leading-relaxed text-[#33302a]"
                  />
                  {it.footnote && (
                    <p className="mt-2.5 text-xs italic leading-relaxed text-[var(--ink-faint)]">
                      &ldquo;{it.footnote}&rdquo;
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] tracking-[0.12em] text-[var(--ink-faint)]/80">
                      {new Date(it.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="删除文案"
                      className="h-8 w-8 text-[var(--ink-faint)]/70 opacity-70 transition-opacity hover:bg-[#f3e9e4] hover:text-[#a8503a] focus-visible:opacity-100 sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => setDeleteId(it.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="border-[var(--hairline)] bg-[var(--paper)] rounded-[2px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif-sc tracking-wide">删去这段文字？</AlertDialogTitle>
            <AlertDialogDescription>
              删后不可恢复。若今日日签正在用它，会自动另择一文。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[2px]">留下</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[2px] bg-[#a8503a] text-white hover:bg-[#8f4330]"
              onClick={() => {
                if (deleteId) removeQuote.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              删去
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
