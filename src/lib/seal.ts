// 印章字符：随日期轮换的篆书集
// 字体：崇羲篆體（Academia Sinica 免费发布）子集，仅含下列 14 字
// 取字规则：当年第 N 天 → (N + 年份) 对 14 取模，跨年错开、同日恒定
export const SEAL_CHARS = ['時', '光', '貼', '日', '籤', '墨', '紙', '山', '水', '雲', '平', '安', '喜', '樂'] as const;

export function sealCharForDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '貼';
  const dayOfYear = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000);
  return SEAL_CHARS[(dayOfYear + y) % SEAL_CHARS.length];
}
