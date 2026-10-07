'use client';

// 背景素材库：拖拽/点击上传、网格管理、配色方案、删除
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
import { CloudUpload, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PALETTE_OPTIONS, PALETTES } from '@/lib/palettes';

interface BgItem {
  id: string;
  label: string;
  origin: string;
  palette: string;
  createdAt: string;
}

export function BackgroundsTab() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['backgrounds'] });
    queryClient.invalidateQueries({ queryKey: ['daily'] });
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (const f of list) form.append('files', f);
      const res = await fetch('/api/backgrounds', { method: 'POST', body: form });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || '上传失败');
      if (resData.created?.length) {
        toast.success(`已添加 ${resData.created.length} 张背景`);
      }
      if (resData.rejected?.length) {
        toast.warning(`部分文件未通过：${resData.rejected.join('、')}`);
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
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
      toast.success('配色已更新，今日日签将应用新配色');
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
      toast.success('背景已删除');
      refresh();
    },
    onError: () => toast.error('删除失败'),
  });

  return (
    <div>
      {/* 上传区 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="上传背景图片"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
        className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? 'border-[#2c2a26] bg-[#ece9df]'
            : 'border-[#cfc9ba] bg-white/50 hover:border-[#a9a291] hover:bg-white/70'
        }`}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-[#6f6a60]" />
        ) : (
          <CloudUpload className="h-6 w-6 text-[#6f6a60]" />
        )}
        <p className="text-sm text-[#4a463c]">
          {uploading ? '正在处理…' : '拖拽图片到这里，或点击选择文件（支持多张，JPG / PNG / WebP）'}
        </p>
        <p className="text-xs text-[#9a9384]">上传后会自动作为日签背景参与每日组合</p>
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
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-md" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[#9a9384]">背景库还是空的，先上传几张吧。</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <div
              key={it.id}
              className="group overflow-hidden rounded-md border border-[#e3ded2] bg-white/60"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#eceae4]">
                <Image
                  src={`/api/backgrounds/${it.id}/image`}
                  alt={it.label || '背景'}
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  unoptimized
                />
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm text-[#3a372f]" title={it.label}>
                    {it.label || '未命名'}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`删除 ${it.label}`}
                    className="h-8 w-8 shrink-0 text-[#9a9384] hover:bg-[#f3e9e4] hover:text-[#b4543a]"
                    onClick={() => setDeleteId(it.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Select
                  value={it.palette || 'auto'}
                  onValueChange={(v) => changePalette.mutate({ id: it.id, palette: v })}
                >
                  <SelectTrigger
                    size="sm"
                    className="h-8 w-full border-[#ddd7c8] bg-white/70 text-xs text-[#4a463c]"
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
                <p className="text-[11px] text-[#9a9384]">
                  文字配色 · {PALETTES[it.palette]?.label ?? '自动取色'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这张背景？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后不可恢复。若今日日签正在使用它，系统会自动重新选图。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#b4543a] text-white hover:bg-[#9c452e]"
              onClick={() => {
                if (deleteId) removeBg.mutate(deleteId);
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
