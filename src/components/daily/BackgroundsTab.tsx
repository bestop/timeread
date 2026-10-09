'use client';

// 背景素材库：拖拽/点击上传（前端压缩、逐张提交）、网格管理、配色方案、删除
import { useRef, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Trash2, Loader2, CalendarCheck, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PALETTE_OPTIONS } from '@/lib/palettes';

interface BgItem {
  id: string;
  label: string;
  origin: string;
  palette: string;
  createdAt: string;
}

interface DailyInfoLite {
  date: string;
  backgroundId: string | null;
  quoteId: string | null;
  [key: string]: unknown;
}

/** 前端压缩：长边 ≤1920、JPEG 0.85（白底拍平透明通道），规避请求体限制并加快上传 */
async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const MAX = 1920;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b && b.size < file.size ? b : file),
        'image/jpeg',
        0.85,
      );
    });
  } catch {
    return file;
  }
}

export function BackgroundsTab() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['backgrounds'],
    queryFn: async () => {
      const res = await fetch('/api/backgrounds', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载失败');
      return res.json() as Promise<{ items: BgItem[] }>;
    },
  });
  const items = data?.items ?? null;

  // 当日日签信息：用于「今日在用」标记
  const { data: daily } = useQuery({
    queryKey: ['daily'],
    queryFn: async () => {
      const res = await fetch('/api/daily', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载失败');
      return res.json() as Promise<DailyInfoLite>;
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['backgrounds'] });
    queryClient.invalidateQueries({ queryKey: ['daily'] });
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.size > 0);
    if (list.length === 0) return;
    setUploading(true);
    setUploadTotal(list.length);
    setUploadDone(0);
    const created: string[] = [];
    const rejected: string[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        try {
          const blob = await compressImage(f);
          const form = new FormData();
          form.append('files', blob, f.name);
          const res = await fetch('/api/backgrounds', { method: 'POST', body: form });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || '上传失败');
          if (resData.created?.length) created.push(resData.created[0].label);
          if (resData.rejected?.length) rejected.push(...resData.rejected);
        } catch {
          rejected.push(f.name);
        }
        setUploadDone(i + 1);
      }
      if (created.length) toast.success(`已添 ${created.length} 张背景入册`);
      if (rejected.length) toast.warning(`部分未收下：${rejected.join('、')}`);
      refresh();
    } finally {
      setUploading(false);
      setUploadTotal(0);
      setUploadDone(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const changePalette = useMutation({
    mutationFn: async ({ id, palette }: { id: string; palette: string }) => {
      const res = await fetch(`/api/backgrounds/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palette }),
      });
      if (!res.ok) throw new Error('配色更新失败');
    },
    onSuccess: () => {
      toast.success('配色已更，今日之签将随新色');
      refresh();
    },
    onError: () => toast.error('配色更新失败'),
  });

  const removeBg = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/backgrounds/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
    },
    onSuccess: () => {
      toast.success('已移出背景库');
      refresh();
    },
    onError: () => toast.error('删除失败'),
  });

  // 选为今日：指定该背景作为今日日签底图（当日有效，换一换恢复随机）
  const pinBg = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/daily/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'background', id }),
      });
      if (!res.ok) throw new Error('设置失败');
      return res.json() as Promise<DailyInfoLite>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['daily'], data);
      toast.success('已选为今日之底');
    },
    onError: () => toast.error('设置失败，请重试'),
  });

  return (
    <div>
      <p className="eyebrow">Backgrounds · 背景库</p>
      <h2 className="font-serif-sc mt-2 text-2xl font-semibold tracking-wide text-[var(--ink)]">
        一图一境
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-faint)]">
        收进来的每一张图，都会成为未来某一天日签的底色。
      </p>

      {/* 上传区 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="上传背景图片"
        onClick={() => {
          if (!uploading) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (uploading) return; // 上传进行中忽略新的投放，避免并发批次互相踩状态
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        aria-disabled={uploading}
        className={`relative mt-6 flex min-h-[148px] cursor-pointer flex-col items-center justify-center gap-2.5 border border-dashed p-6 text-center transition-all duration-300 after:pointer-events-none after:absolute after:inset-2 after:border after:border-[var(--ink-soft)]/25 after:opacity-0 after:transition-opacity after:duration-300 sm:p-8 ${
          dragOver
            ? 'border-[var(--ink-soft)] bg-white/70 after:opacity-100'
            : 'border-[var(--hairline)] bg-white/35 hover:border-[var(--ink-faint)] hover:bg-white/55'
        }`}
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-[var(--ink-soft)]" strokeWidth={1.5} />
            <p className="font-serif-sc text-sm tracking-[0.18em] text-[var(--ink-soft)]">
              正在收入 {uploadDone} / {uploadTotal}
            </p>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-300 ${
                dragOver
                  ? 'border-[var(--ink-soft)] text-[var(--ink-soft)]'
                  : 'border-[var(--hairline)] text-[var(--ink-faint)]'
              }`}
            >
              <Plus className="h-4 w-4" strokeWidth={1.2} />
            </span>
            <p className="font-serif-sc text-[15px] tracking-[0.22em] text-[var(--ink-soft)]">
              将图片轻轻放入此处
            </p>
            <p className="eyebrow">Drop Images · JPG / PNG / WebP</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files);
          }}
        />
      </div>

      {/* 网格 */}
      {isLoading || items === null ? (
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-[2px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-12 text-center font-serif-sc text-sm tracking-[0.2em] text-[var(--ink-faint)]">
          背景库还空着，等第一张图。
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <div
              key={it.id}
              className="lift group overflow-hidden rounded-[2px] border border-[var(--hairline)] bg-white/45"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--paper-deep)]">
                <Image
                  src={`/api/backgrounds/${it.id}/image`}
                  alt={it.label || '背景'}
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
              <div className="space-y-2.5 border-t border-[var(--hairline-soft)] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate font-serif-sc text-[13px] tracking-wide text-[#33302a]" title={it.label}>
                    {it.label || '未命名'}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`删除 ${it.label}`}
                    className="h-7 w-7 shrink-0 text-[var(--ink-faint)] hover:bg-[#f3e9e4] hover:text-[#a8503a]"
                    onClick={() => setDeleteId(it.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </Button>
                </div>
                <Select
                  value={it.palette || 'auto'}
                  onValueChange={(v) => changePalette.mutate({ id: it.id, palette: v })}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={`文字配色方案（${it.label || '未命名'}）`}
                    className="h-8 w-full border-[var(--hairline)] bg-white/60 text-xs text-[var(--ink-soft)]"
                  >
                    <SelectValue placeholder="配色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动取色</SelectItem>
                    {PALETTE_OPTIONS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full border border-black/10"
                            style={{ background: p.text }}
                          />
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {daily?.backgroundId === it.id ? (
                  <p className="flex h-8 items-center justify-center gap-1.5 border border-[var(--accent)]/30 bg-[var(--accent)]/[0.07] text-[11px] tracking-[0.18em] text-[var(--accent)]">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                    今日在用
                  </p>
                ) : (
                  <button
                    onClick={() => pinBg.mutate(it.id)}
                    disabled={pinBg.isPending}
                    aria-label={`将 ${it.label || '此背景'} 选为今日日签`}
                    className="flex h-8 w-full items-center justify-center gap-1.5 border border-[var(--hairline)] bg-transparent text-[11px] tracking-[0.18em] text-[var(--ink-soft)] transition-all duration-300 hover:border-[var(--ink-faint)] hover:bg-white/60 hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ink)]/60 active:scale-[0.98] disabled:opacity-40"
                  >
                    <CalendarCheck className="h-3.5 w-3.5" strokeWidth={1.6} />
                    选为今日
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="border-[var(--hairline)] bg-[var(--paper)] rounded-[2px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif-sc tracking-wide">收走这张背景？</AlertDialogTitle>
            <AlertDialogDescription>
              移出后不可恢复。若今日日签正在用它，会自动另择一底。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[2px]">留下</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[2px] bg-[#a8503a] text-white hover:bg-[#8f4330]"
              onClick={() => {
                if (deleteId) removeBg.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              收走
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
