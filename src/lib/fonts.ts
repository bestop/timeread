// 字体解析：优先使用打包进项目的字体（Vercel 无系统中文字体），本地回退系统字体
import fs from 'fs';
import path from 'path';

const BUNDLED_DIR = path.join(process.cwd(), 'assets', 'fonts');

function resolveFirst(...candidates: string[]): string {
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return candidates[0];
}

/** 宋体（正文/日期） */
export const FONT_SERIF_PATH = resolveFirst(
  path.join(BUNDLED_DIR, 'NotoSerifSC-SemiBold.ttf'),
  path.join(process.cwd(), 'src', 'app', 'fonts', 'NotoSerifSC-SemiBold.ttf'),
  '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-SemiBold.ttf',
);

/** 文楷（英文手写注脚） */
export const FONT_KAI_PATH = resolveFirst(
  path.join(BUNDLED_DIR, 'LXGWWenKai-Regular.ttf'),
  '/usr/share/fonts/truetype/lxgw-wenkai/LXGWWenKai-Regular.ttf',
);
