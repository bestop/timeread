// 首次启动种子：程序化生成水彩质感初始背景 + 导入参考图文案
// 使用 storage/.seeded 标记文件防止重复注入
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { db } from './db';

// 存储目录：Vercel 等只读文件系统环境下使用 /tmp（冷启动自动重建种子数据）
export const STORAGE_DIR =
  process.env.STORAGE_DIR ||
  (process.env.VERCEL ? '/tmp/timeread-storage' : path.join(process.cwd(), 'storage'));
export const BG_DIR = path.join(STORAGE_DIR, 'bg');
export const CARD_DIR = path.join(STORAGE_DIR, 'cards');
const SEEDED_FLAG = path.join(STORAGE_DIR, '.seeded');

export function ensureDirs() {
  fs.mkdirSync(BG_DIR, { recursive: true });
  fs.mkdirSync(CARD_DIR, { recursive: true });
}

// ---------- 确定性随机 ----------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- 水彩背景生成 ----------
interface BgSpec {
  name: string;
  base: string;
  blobs: string[];
  kind: 'blobs' | 'streaks' | 'marble';
  palette: string; // 指定配色（非 auto）
}

export const BG_SPECS: BgSpec[] = [
  { name: '云雾青绿', base: '#DDE7DA', blobs: ['#8FB49B', '#C3D8C2', '#FFFFFF', '#A9C6AE', '#EDF3EA'], kind: 'blobs', palette: 'pine' },
  { name: '粉黛石纹', base: '#EDE9E1', blobs: ['#D8A8A2', '#9CC2B6', '#E5D3C4', '#C4B9D4', '#F2EBE2'], kind: 'marble', palette: 'walnut' },
  { name: '油画米白', base: '#EFEDE7', blobs: ['#C9CFD6', '#DDD5C6', '#B9C5CE', '#E8E3D8'], kind: 'blobs', palette: 'ink' },
  { name: '晴空蔚蓝', base: '#A3C4E6', blobs: ['#C7DDF1', '#7FA8D6', '#E2EEF8', '#8FB8E0', '#B5D0EC'], kind: 'blobs', palette: 'azure' },
  { name: '薄荷横纹', base: '#D2E5DB', blobs: ['#BCD9CB', '#E3F0E8', '#A9CDBB', '#DCEDE3'], kind: 'streaks', palette: 'moss' },
  { name: '素笺淡绿', base: '#F1F4EB', blobs: ['#8FBF9C', '#C2DCC9', '#FFFFFF', '#A8CDB4'], kind: 'blobs', palette: 'pine' },
  { name: '云影灰白', base: '#E9EBEE', blobs: ['#CBD1D8', '#B4BCC6', '#F2F4F6', '#D8DDE3'], kind: 'blobs', palette: 'ink' },
  { name: '暖沙杏色', base: '#F0E5D8', blobs: ['#E2C9B2', '#D9BBA9', '#F6EFE5', '#D2A98E'], kind: 'marble', palette: 'walnut' },
];

async function grainBuffer(w: number, h: number, alpha: number): Promise<Buffer> {
  const buf = Buffer.alloc(w * h * 4);
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < w * h; i++) {
    const g = 96 + Math.floor(rnd() * 64); // 96-160 中灰波动
    buf[i * 4] = g;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = g;
    buf[i * 4 + 3] = alpha;
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

export async function generateWatercolorBg(spec: BgSpec, idx: number): Promise<Buffer> {
  const W = 1080;
  const H = 1440;
  const rnd = mulberry32(1000 + idx * 7919);
  let shapes = '';
  const count = spec.kind === 'streaks' ? 14 : 7 + Math.floor(rnd() * 4);
  for (let i = 0; i < count; i++) {
    const c = spec.blobs[Math.floor(rnd() * spec.blobs.length)];
    const cx = Math.round(rnd() * W);
    const cy = Math.round(rnd() * H);
    const op = (0.16 + rnd() * 0.3).toFixed(2);
    const rot = Math.round(rnd() * 180);
    if (spec.kind === 'streaks') {
      const rx = 340 + Math.round(rnd() * 420);
      const ry = 26 + Math.round(rnd() * 60);
      shapes += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${op}" transform="rotate(${rot % 14 - 7} ${cx} ${cy})"/>`;
    } else {
      const rx = 200 + Math.round(rnd() * 400);
      const ry = 140 + Math.round(rnd() * 320);
      shapes += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${spec.base}"/>${shapes}</svg>`;
  const blurSigma = spec.kind === 'marble' ? 34 : spec.kind === 'streaks' ? 22 : 64;
  const base = await sharp(Buffer.from(svg)).blur(blurSigma).toBuffer();

  // 纸纹颗粒
  const grain = await grainBuffer(W, H, 14);
  return sharp(base)
    .composite([{ input: grain, blend: 'overlay' }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// ---------- 初始文案（源自参考日签卡） ----------
const INITIAL_QUOTES: { content: string; footnote?: string }[] = [
  {
    content:
      '你一定要~~少吃多睡~~【多存钱】，多健身。\n别总觉得没找对人，压根没有对的人，只有越来越好的自己。\n向外求，求而不得；向内求，生生不息。\n很多人都没有你早上喝的那杯水重要。',
  },
  {
    content:
      '人在休息的时候，要出来去山上走一走。因为人和木在一起就是休，人和山在一起便是仙，人和土在一起便是佳。\n\n所以如果你的【状态不佳】，那就出来【山间和土地】玩一玩。风会抚平心中杂念，山会接纳所有疲惫。',
  },
  {
    content:
      '【顶级的清醒】，是低配物质，朴素生活，好好取悦自己。\n\n人到一定阶段，便懂得"~~独与天地精神往来~~"。热闹是旁人的狂欢，孤独才是自己的自由。\n\n独处时自在舒服，便是内心强大。能量高的人，才懂得享受孤独。孤独的最高境界，是无需他人理解，不必事事解释。',
  },
  {
    content:
      '【让自己开心】的秘诀就是不搭理一切影响自己情绪的人和事。\n\n不和差点意思的人周旋，我本阳光明媚，不是任何人无聊时的消遣。\n\n所以远离让自己不舒服的关系，~~人生何其短~~，怎么灿烂怎么闪。',
  },
  {
    content:
      '一个人的优点和缺点本就~~无法割裂~~。有【上进心】的人往往强势，情绪稳定的人容易情感漠视，稳重的人略显无趣，随和的人容易软弱，包容的人缺少主见。\n\n当初吸引你的特质，日后也可能成为你厌恶的地方。想要热烈真诚，就要接纳冲动鲁莽；偏爱独立自主，便难走进他的内心。',
  },
  {
    content:
      '人不该困在忙碌里，忽略自己的灵魂。\n\n当懂得人生是用来【体验】而非将就时，属于你的生活才算真正开始。\n\n放下不属于自己的【人和事】，感受风和星月，好好体会生活。',
    footnote: 'Do not go gentle into that good night, and rage at close of day.',
  },
  {
    content:
      '人一定要~~多出去走走~~，去哪儿不重要，重要的是人不能长时间待在同一个地方。\n\n趁阳光温柔，风也自由，跳出眼前的方寸天地，去见不一样的风景，舒展被困住的情绪，在路上慢慢治愈自己。',
  },
  {
    content:
      '慢慢来，谁不是一边受伤一边学会坚强。你走的每一步都算数，时间会给你答案。\n\n生活或许平淡，但热爱从不缺席。愿你眼里有光，心中有暖，~~无惧岁月漫长~~。',
    footnote: 'Whatever is worth doing is worth doing well.',
  },
];

let seeding: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (seeding) return seeding;
  seeding = (async () => {
    ensureDirs();
    if (fs.existsSync(SEEDED_FLAG)) return;
    try {
      const bgCount = await db.background.count();
      const quoteCount = await db.quote.count();
      if (bgCount === 0) {
        for (let i = 0; i < BG_SPECS.length; i++) {
          const spec = BG_SPECS[i];
          const buf = await generateWatercolorBg(spec, i);
          const filename = `preset_${i}_${Date.now()}.jpg`;
          fs.writeFileSync(path.join(BG_DIR, filename), buf);
          await db.background.create({
            data: { filename, label: spec.name, origin: 'preset', palette: spec.palette },
          });
        }
      }
      if (quoteCount === 0) {
        for (const q of INITIAL_QUOTES) {
          await db.quote.create({ data: { content: q.content, footnote: q.footnote ?? null } });
        }
      }
      fs.writeFileSync(SEEDED_FLAG, new Date().toISOString());
    } catch (e) {
      console.error('[seed] failed:', e);
      seeding = null; // 允许下次重试
    }
  })();
  return seeding;
}
