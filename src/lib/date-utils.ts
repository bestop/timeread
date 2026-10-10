// 日期工具：统一使用 Asia/Shanghai 时区（用户所在时区）

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 阿拉伯数字转中文数字（1-31 范围内的日期转换） */
export function toChineseNumber(n: number): string {
  if (n <= 0 || n > 99) return String(n);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (tens === 0) return CN_DIGITS[ones];
  if (tens === 1) return ones === 0 ? '十' : `十${CN_DIGITS[ones]}`;
  return ones === 0 ? `${CN_DIGITS[tens]}十` : `${CN_DIGITS[tens]}十${CN_DIGITS[ones]}`;
}

/** 当天日期字符串 YYYY-MM-DD（Asia/Shanghai） */
export function todayStr(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now);
}

/** 校验 YYYY-MM-DD 格式 */
export function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  weekdayEn: string; // Mon.
  weekdayCn: string; // 星期三
}

export function dateParts(dateStr: string): DateParts {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d, 4, 0, 0)); // +4h 保证落在上海时区的同一天
  const weekdayEnShort = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
  }).format(utcDate);
  const weekdayCn = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'long',
  }).format(utcDate);
  return {
    year: y,
    month: m,
    day: d,
    weekdayEn: `${weekdayEnShort.slice(0, 3)}.`,
    weekdayCn,
  };
}

/** 中文日期：九月十二日 */
export function chineseDate(dateStr: string): string {
  const { month, day } = dateParts(dateStr);
  return `${toChineseNumber(month)}月${toChineseNumber(day)}日`;
}

/** 中文月份标签（用于往期分组）：“2026-10” → “二〇二六年十月” */
export function chineseMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  // 年份逐位转中文，0 用「〇」（年份惯用写法）
  const YEAR_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const year = String(y)
    .split('')
    .map((ch) => YEAR_DIGITS[Number(ch)] ?? ch)
    .join('');
  return `${year}年${toChineseNumber(m)}月`;
}

/** 阿拉伯日期：2026.10.07 */
export function numericDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}`;
}

/** 友好展示：2026年10月7日 · 星期三 */
export function friendlyDate(dateStr: string): string {
  const p = dateParts(dateStr);
  return `${p.year}年${p.month}月${p.day}日 · ${p.weekdayCn}`;
}

/** 日期加 N 天（用于"倒退一天"生成历史补卡等场景，目前仅测试用） */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
