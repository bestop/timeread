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
import { Feather, Trash2, Loader2, Lightbulb } from 'lucide-react';
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
      toast.success('文案已加入素材库');
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
      toast.success('文案已删除');
      refresh();
    },
    onError: () => toast.error('删除失败'),
  });

  const plen = plainLength(content);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      {/* 新增表单 */}
      <div className="rounded-md border border-[#e3ded2] bg-white/60 p-6">
        <div className="flex items-center gap-2">
          <Feather className="h-4 w-4 text-[#6f6a60]" />
          <h3 className="font-serif-sc text-lg text-[#2c2a26]">写一段今日的文字</h3>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quote-content" className="text-sm text-[#4a463c]">
              正文
            </Label>
            <Textarea
              id="quote-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder={'把想说的话写在这里，空行分段。\n用【文字】做高亮块，用~~文字~~做下划线。'}
              className="font-serif-sc min-h-[140px] resize-y border-[#ddd7c8] bg-white/80 text-[15px] leading-relaxed focus-visible:ring-[#b8b2a0]"
            />
            <p className="text-right text-xs text-[#9a9384]">{plen} / 500 字</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-footnote" className="text-sm text-[#4a463c]">
              英文注脚（可选，卡片底部手写体）
            </Label>
            <Input
              id="quote-footnote"
              value={footnote}
              onChange={(e) => setFootnote(e.target.value)}
              placeholder="Do not go gentle into that good night."
              className="border-[#ddd7c8] bg-white/80 focus-visible:ring-[#b8b2a0]"
            />
          </div>
          <Button
            onClick={() => createQuote.mutate()}
            disabled={createQuote.isPending}
            className="w-full bg-[#2c2a26] text-[#f6f4ee] hover:bg-[#443f37]"
          >
            {createQuote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            存入文字库
          </Button>
          <div className="flex items-start gap-2 rounded-sm bg-[#f1eee5] p-3 text-xs leading-relaxed text-[#8a8474]">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              标记语法：【文字】→ 色块高亮；~~文字~~ → 下划线。空行分段，卡片会自动排版换行；
              文字较多时会自动缩小字号以适配卡片。
            </span>
          </div>
        </div>
      </div>

      {/* 列表 */}
      <div className="min-w-0">
        <h3 className="font-serif-sc text-lg text-[#2c2a26]">
          文字库 <span className="ml-1 text-sm text-[#9a9384]">{items ? `${items.length} 条` : ''}</span>
        </h3>
        {isLoading || items === null ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-md" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="mt-10 text-center text-sm text-[#9a9384]">
            文字库还是空的，先写下第一段吧。
          </p>
        ) : (
          <div className="pretty-scroll mt-4 max-h-[640px] space-y-3 overflow-y-auto pr-1">
            {items.map((it) => (
              <div key={it.id} className="rounded-md border border-[#e3ded2] bg-white/60 p-4">
                <FormattedQuote
                  content={it.content}
                  className="font-serif-sc text-[15px] leading-relaxed text-[#3a372f]"
                />
                {it.footnote && (
                  <p className="mt-2 text-xs italic text-[#9a9384]">&ldquo;{it.footnote}&rdquo;</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-[#b0a996]">
                    {new Date(it.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="删除文案"
                    className="h-8 w-8 text-[#b0a996] hover:bg-[#f3e9e4] hover:text-[#b4543a]"
                    onClick={() => setDeleteId(it.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条文案？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后不可恢复。若今日日签正在使用它，系统会自动重新选文。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#b4543a] text-white hover:bg-[#9c452e]"
              onClick={() => {
                if (deleteId) removeQuote.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
