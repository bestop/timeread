// 文字标记解析（客户端 / 服务端共用，纯函数无依赖）
// 语法：【文字】 → 高亮块；~~文字~~ → 下划线

export type SegStyle = 'normal' | 'highlight' | 'underline';

export interface Segment {
  text: string;
  style: SegStyle;
}

/** 解析一段正文为 segment 流（保留 \n 作为段落分隔的原始信息由调用方处理） */
export function parseLine(line: string): Segment[] {
  const segs: Segment[] = [];
  // 先切高亮，再在普通段内切下划线
  const hlRe = /【([^】]*)】/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushUnderline = (raw: string) => {
    const ulRe = /~~([^~]+)~~/g;
    let l = 0;
    let u: RegExpExecArray | null;
    while ((u = ulRe.exec(raw))) {
      if (u.index > l) segs.push({ text: raw.slice(l, u.index), style: 'normal' });
      segs.push({ text: u[1], style: 'underline' });
      l = u.index + u[0].length;
    }
    if (l < raw.length) segs.push({ text: raw.slice(l), style: 'normal' });
  };
  while ((m = hlRe.exec(line))) {
    if (m.index > last) pushUnderline(line.slice(last, m.index));
    if (m[1]) segs.push({ text: m[1], style: 'highlight' });
    last = m.index + m[0].length;
  }
  if (last < line.length) pushUnderline(line.slice(last));
  return segs.filter((s) => s.text.length > 0);
}

/** 整篇内容 → 段落（每段为 segment 数组），按 \n 或连续换行分段 */
export function parseContent(content: string): Segment[][] {
  const rawParas = content.replace(/\r/g, '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return rawParas.map(parseLine);
}

/** 统计正文纯文字长度（去除标记符） */
export function plainLength(content: string): number {
  return parseContent(content)
    .flat()
    .reduce((acc, s) => acc + s.text.length, 0);
}
