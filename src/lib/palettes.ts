// 日签文字配色方案：参考日签卡的"深色字 + 同色高亮块"审美
export interface Palette {
  key: string;
  label: string;
  text: string;      // 正文/日期颜色
  hlBg: string;      // 高亮块背景
  hlText: string;    // 高亮块内文字颜色
  dark?: boolean;    // 浅色文字（深底用）
}

export const PALETTES: Record<string, Palette> = {
  auto:   { key: 'auto',   label: '自动取色', text: '#33322E', hlBg: '#33322E', hlText: '#F5F2EA' },
  pine:   { key: 'pine',   label: '松烟墨绿', text: '#2F5B3C', hlBg: '#2F5B3C', hlText: '#F5F2EA' },
  walnut: { key: 'walnut', label: '琥珀深棕', text: '#7A4A21', hlBg: '#7A4A21', hlText: '#F5F2EA' },
  azure:  { key: 'azure',  label: '黛蓝',     text: '#2C4E77', hlBg: '#2C4E77', hlText: '#F5F2EA' },
  ink:    { key: 'ink',    label: '玄墨',     text: '#33322E', hlBg: '#33322E', hlText: '#F5F2EA' },
  terra:  { key: 'terra',  label: '赭红',     text: '#99482C', hlBg: '#99482C', hlText: '#F5F2EA' },
  moss:   { key: 'moss',   label: '青苔',     text: '#3E6B52', hlBg: '#3E6B52', hlText: '#F5F2EA' },
  moon:   { key: 'moon',   label: '月白·深底', text: '#F2EFE6', hlBg: '#F2EFE6', hlText: '#33302A', dark: true },
};

export const PALETTE_OPTIONS = Object.values(PALETTES).filter((p) => p.key !== 'auto');

/** 依据图像统计信息（sharp stats 通道均值）自动挑选配色 */
export function autoPalette(stats: { r: number; g: number; b: number }): Palette {
  const { r, g, b } = stats;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // 深色底 → 月白浅色字
  if (lum < 112) return PALETTES.moon;
  // 通道倾向判断（捕捉低饱和但明确的色相，如淡绿、淡蓝纸纹）
  const greenish = g >= r && g > b && g - b >= 5;
  const bluish = b >= r && b > g && b - g >= 5;
  const warm = r > b && r - b >= 8 && r >= g;
  if (greenish) return PALETTES.pine;
  if (bluish) return PALETTES.azure;
  if (warm) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    return sat > 0.24 ? PALETTES.terra : PALETTES.walnut;
  }
  return PALETTES.ink;
}

export function resolvePalette(key: string, stats?: { r: number; g: number; b: number }): Palette {
  if (key && key !== 'auto' && PALETTES[key]) return PALETTES[key];
  if (stats) return autoPalette(stats);
  return PALETTES.ink;
}
