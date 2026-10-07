// 日签合成引擎：fontkit 精确排版 → SVG 文字层 → sharp 合成
// 设计参考用户提供的日签卡：竖版 3:4、宋体大字、关键词下划线/色块高亮、
// 左上英文星期、右上中文日期、底部英文手写注脚 + 装饰符号
import * as fontkit from 'fontkit';
import sharp from 'sharp';
import { parseContent, type SegStyle, type Segment } from './text-parser';
import { resolvePalette, type Palette } from './palettes';

export const CARD_W = 1080;
export const CARD_H = 1440;

const FONT_SERIF = '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-SemiBold.ttf';
const FONT_KAI = '/usr/share/fonts/truetype/lxgw-wenkai/LXGWWenKai-Regular.ttf';

const MARGIN_X = 88;
const DATE_BASELINE = 136;
const BODY_TOP = 268;
const BODY_BOTTOM = 1318;
const FOOTER_BASELINE = 1382;

const CLOSING_PUNCT = new Set(['，', '。', '、', '；', '：', '？', '！', '）', '》', '」', '』', '”', '’', '…', '—', '～', '~', '!', '?', ',', '.', ';', ':']);
const OPENING_PUNCT = new Set(['（', '《', '「', '『', '“', '‘', '(', '[']);
const ASCII_WORD = /[0-9A-Za-z@#&'"’‘._\-]+/;

// ---------- 字体测量 ----------
interface FontBox { font: fontkit.Font; upm: number }

function loadFont(path: string): FontBox {
  const font = (fontkit as unknown as { openSync: (p: string) => fontkit.Font }).openSync(path);
  return { font, upm: (font as unknown as { unitsPerEm: number }).unitsPerEm };
}

const serifBox = loadFont(FONT_SERIF);
const kaiBox = loadFont(FONT_KAI);

 
function advancePx(box: FontBox, text: string, fs: number, extra = 0): number {
  if (!text) return 0;
   
  const run = (box.font as any).layout(text) as { advanceWidth: number };
  const total = (run.advanceWidth / box.upm) * fs;
  return total + extra * text.length;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- 排版 ----------
interface LineItem { text: string; x: number; w: number; style: SegStyle }
interface RenderLine { items: LineItem[]; top: number }

/** 段落 → 字符/单词 token 流（ASCII 单词不拆行） */
function paraTokens(paras: Segment[]): { text: string; style: SegStyle }[] {
  const tokens: { text: string; style: SegStyle }[] = [];
  for (const seg of paras) {
    let buf = '';
    const flush = () => {
      if (buf) {
        tokens.push({ text: buf, style: seg.style });
        buf = '';
      }
    };
    for (const ch of seg.text) {
      if (ASCII_WORD.test(ch) || (ch >= '0' && ch <= '9')) {
        buf += ch; // ASCII 连续成词
      } else {
        flush();
        tokens.push({ text: ch, style: seg.style });
      }
    }
    flush();
  }
  return tokens;
}

interface LayoutResult {
  lines: RenderLine[];
  fontSize: number;
  lineHeight: number;
  blockTop: number;
  blockHeight: number;
}

function layoutParagraphs(
  paras: Segment[][],
  fs: number,
  maxW: number,
  gapRatio = 0.55,
): { lines: Omit<RenderLine, 'top'>[][]; totalH: number; lh: number } {
  const lh = Math.round(fs * 1.78);
  const spacing = Math.round(fs * 0.1);
  // 闭合标点（，。、！？等）始终允许悬挂到行尾之外，确保绝不出现行首标点
  const groups: Omit<RenderLine, 'top'>[][] = [];
  let cur: LineItem[] = [];
  let curW = 0;

  const measure = (t: string) => advancePx(serifBox, t, fs, spacing);

  for (const para of paras) {
    const tokens = paraTokens(para);
    for (const tk of tokens) {
      const w = measure(tk.text);
      const isClosing = tk.text.length === 1 && CLOSING_PUNCT.has(tk.text);
      const isOpening = tk.text.length === 1 && OPENING_PUNCT.has(tk.text);
      const fits = curW + w <= maxW || isClosing;
      if (!fits && cur.length > 0) {
        // 行尾开引号后移
        while (cur.length && cur[cur.length - 1].text.length === 1 && OPENING_PUNCT.has(cur[cur.length - 1].text)) {
          curW -= cur.pop()!.w;
        }
        groups.push(cur);
        cur = [];
        curW = 0;
      }
      cur.push({ text: tk.text, x: 0, w, style: tk.style });
      curW += w;
    }
    // 段落结束
    if (cur.length) {
      groups.push(cur);
      cur = [];
      curW = 0;
    }
    groups.push([]); // 段间空行（用 gap 表示，渲染时跳过）
  }
  if (cur.length) groups.push(cur);
  // 去掉末尾多余空行
  while (groups.length && groups[groups.length - 1].length === 0) groups.pop();

  const paraGap = Math.round(fs * gapRatio);
  let totalH = 0;
  let first = true;
  for (const g of groups) {
    if (g.length === 0) continue;
    if (!first) totalH += paraGap;
    totalH += lh;
    first = false;
  }
  return { lines: groups, totalH, lh };
}

export function layoutCard(paras: Segment[][], opts?: { baseFs?: number }): LayoutResult {
  const maxW = CARD_W - MARGIN_X * 2;
  const availH = BODY_BOTTOM - BODY_TOP;
  const sizes = opts?.baseFs ? [opts.baseFs, ...[58, 54, 50, 46, 42, 38].filter((s) => s < opts.baseFs!)] : [58, 54, 50, 46, 42, 38];

  let chosen = sizes[sizes.length - 1];
  let layout = layoutParagraphs(paras, chosen, maxW);
  for (const fs of sizes) {
    const l = layoutParagraphs(paras, fs, maxW);
    if (l.totalH <= availH) {
      chosen = fs;
      layout = l;
      break;
    }
    chosen = fs;
    layout = l;
  }
  // 垂直居中（略微偏上，贴近参考图）；钳制底部不越界
  const availTop = BODY_TOP + Math.max(0, Math.round((availH - layout.totalH) / 2.4));
  const blockTop = Math.max(BODY_TOP, Math.min(availTop, BODY_BOTTOM - layout.totalH));

  // 分配 x / top（仅在跨越段落边界时空加段距）
  const lines: RenderLine[] = [];
  let y = blockTop;
  let prevWasParaBreak = false;
  for (const g of layout.lines) {
    if (g.length === 0) {
      prevWasParaBreak = true;
      continue;
    }
    if (lines.length > 0 && prevWasParaBreak) {
      y += Math.round(layout.lh * 0.55); // 段间距
    }
    prevWasParaBreak = false;
    let x = MARGIN_X;
    for (const it of g) {
      it.x = Math.round(x);
      x += it.w;
    }
    lines.push({ items: g, top: y });
    y += layout.lh;
  }
  return { lines, fontSize: chosen, lineHeight: layout.lh, blockTop, blockHeight: layout.totalH };
}

// ---------- SVG 生成 ----------
export interface CardTextOptions {
  dateStr: string;      // YYYY-MM-DD
  content: string;      // 含标记正文
  footnote?: string | null;
  palette: Palette;
}

function underlineRuns(line: RenderLine): { x: number; w: number }[] {
  const runs: { x: number; w: number }[] = [];
  let cur: { x: number; end: number } | null = null;
  for (const it of line.items) {
    if (it.style === 'underline') {
      if (cur) cur.end = it.x + it.w;
      else cur = { x: it.x, end: it.x + it.w };
    } else if (cur) {
      runs.push({ x: cur.x, w: cur.end - cur.x });
      cur = null;
    }
  }
  if (cur) runs.push({ x: cur.x, w: cur.end - cur.x });
  return runs;
}

export function buildOverlaySvg(opts: CardTextOptions): Buffer {
  const { dateStr, content, footnote, palette } = opts;
  const paras = parseContent(content);
  const layout = layoutCard(paras);
  const { text: tc, hlBg, hlText } = palette;
  const fs = layout.fontSize;
  const spacing = Math.round(fs * 0.1);
  const els: string[] = [];

  // 轻纱
  const washColor = palette.dark ? '#1A1815' : '#FFFFFF';
  const washOp = palette.dark ? 0.1 : 0.06;
  els.push(`<rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" fill="${washColor}" opacity="${washOp}"/>`);

  // 日期角标
  const dp = datePartsLocal(dateStr);
  const dateFs = 40;
  els.push(
    `<text x="${MARGIN_X}" y="${DATE_BASELINE}" font-family="Noto Serif SC" font-weight="600" font-size="${dateFs}" fill="${tc}" xml:space="preserve">(${escapeXml(dp)})</text>`,
  );
  const cnDate = chineseDateLocal(dateStr);
  const cnW = advancePx(serifBox, cnDate, dateFs, 6);
  els.push(
    `<text x="${CARD_W - MARGIN_X - Math.round(cnW - 6)}" y="${DATE_BASELINE}" font-family="Noto Serif SC" font-weight="600" font-size="${dateFs}" fill="${tc}" xml:space="preserve">${escapeXml(cnDate)}</text>`,
  );

  // 正文：先画高亮块（垫底），再画下划线，最后画文字（逐字符精确定位）
  const rects: string[] = [];
  const texts: string[] = [];
  const uls: string[] = [];
  for (const line of layout.lines) {
    const baseline = Math.round(line.top + layout.lineHeight / 2 + fs * 0.37);
    for (const it of line.items) {
      if (it.style === 'highlight') {
        rects.push(
          `<rect x="${it.x - Math.round(fs * 0.12)}" y="${Math.round(baseline - fs * 0.76)}" width="${Math.round(it.w + fs * 0.1)}" height="${Math.round(fs * 0.92)}" rx="7" fill="${hlBg}"/>`,
        );
      }
      texts.push(
        `<text x="${it.x}" y="${baseline}" font-family="Noto Serif SC" font-weight="600" font-size="${fs}" fill="${it.style === 'highlight' ? hlText : tc}" xml:space="preserve">${escapeXml(it.text)}</text>`,
      );
    }
    for (const r of underlineRuns(line)) {
      uls.push(
        `<rect x="${r.x}" y="${Math.round(baseline + fs * 0.17)}" width="${Math.max(6, Math.round(r.w - spacing))}" height="${Math.max(3, Math.round(fs * 0.045))}" rx="2" fill="${tc}" opacity="0.88"/>`,
      );
    }
  }

  // 底部：英文注脚（文楷）+ 装饰 &
  if (footnote && footnote.trim()) {
    let fnFs = 31;
    let fn = footnote.trim();
    const maxFnW = CARD_W - MARGIN_X * 2 - 140;
    let w = advancePx(kaiBox, fn, fnFs, 1);
    while (w > maxFnW && fnFs > 20) {
      fnFs -= 2;
      w = advancePx(kaiBox, fn, fnFs, 1);
    }
    if (w > maxFnW) {
      while (advancePx(kaiBox, fn + '…', fnFs, 1) > maxFnW && fn.length > 4) fn = fn.slice(0, -1);
      fn = fn + '…';
    }
    const fnColor = hexWithAlpha(tc, 0.72);
    els.push(
      `<text x="${MARGIN_X}" y="${FOOTER_BASELINE}" font-family="LXGW WenKai" font-size="${fnFs}" fill="${fnColor}" letter-spacing="1" xml:space="preserve">${escapeXml(fn)}</text>`,
    );
  }
  els.push(
    `<text x="${CARD_W - MARGIN_X - 8}" y="${FOOTER_BASELINE + 6}" font-family="Noto Serif SC" font-weight="600" font-size="62" fill="${tc}" opacity="0.9" xml:space="preserve">&amp;</text>`,
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
${els.join('\n')}
${rects.join('\n')}
${uls.join('\n')}
${texts.join('\n')}
</svg>`;
  return Buffer.from(svg);
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 避免循环依赖 date-utils（无状态小函数直接内联）
function datePartsLocal(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 4));
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', weekday: 'short' }).format(dt).slice(0, 3) + '.';
}

function chineseDateLocal(dateStr: string): string {
  // 复用 date-utils 的逻辑（此处独立实现避免依赖问题）
  const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const num = (n: number): string => {
    if (n <= 10) return n === 10 ? '十' : CN[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    if (t === 1) return `十${CN[o]}`;
    return o === 0 ? `${CN[t]}十` : `${CN[t]}十${CN[o]}`;
  };
  const [, m, d] = dateStr.split('-').map(Number);
  return `${num(m)}月${num(d)}日`;
}

// ---------- 合成 ----------
export interface ComposeInput {
  backgroundPath?: string | null;
  dateStr: string;
  content: string;
  footnote?: string | null;
  paletteKey: string; // 'auto' 或具体 key
}

export interface ComposeResult {
  buffer: Buffer;
  palette: Palette;
}

export async function composeCard(input: ComposeInput): Promise<ComposeResult> {
  let imgBuf: Buffer;
  let stats: { r: number; g: number; b: number } | undefined;

  if (input.backgroundPath) {
    imgBuf = await sharp(input.backgroundPath)
      .rotate()
      .resize(CARD_W, CARD_H, { fit: 'cover', position: 'centre' })
      .toBuffer();
    const st = await sharp(imgBuf).stats();
    stats = { r: st.channels[0].mean, g: st.channels[1].mean, b: st.channels[2].mean };
  } else {
    // 无背景时的素色兜底
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}"><rect width="${CARD_W}" height="${CARD_H}" fill="#EDEAE2"/><ellipse cx="300" cy="400" rx="420" ry="300" fill="#D9CFC0" opacity="0.5"/><ellipse cx="820" cy="1000" rx="460" ry="360" fill="#C9C2B2" opacity="0.4"/></svg>`;
    imgBuf = await sharp(Buffer.from(svg)).blur(60).toBuffer();
    stats = { r: 226, g: 220, b: 208 };
  }

  const palette = resolvePalette(input.paletteKey, stats);
  const overlay = buildOverlaySvg({
    dateStr: input.dateStr,
    content: input.content,
    footnote: input.footnote,
    palette,
  });

  const buffer = await sharp(imgBuf)
    .composite([{ input: overlay, blend: 'over' }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return { buffer, palette };
}
