/* 离线测试日签合成引擎：渲染一张样卡到 scripts/test-card.jpg 供目测校准 */
import { composeCard } from '../src/lib/card-composer';
import { generateWatercolorBg, BG_SPECS } from '../src/lib/seed';
import fs from 'fs';

async function main() {
  // 生成一张水彩背景
  const bg = await generateWatercolorBg(BG_SPECS[0], 0);
  fs.writeFileSync(__dirname + '/test-bg.jpg', bg);
  console.log('bg generated:', bg.length, 'bytes');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  // 用生成的背景合成一张卡
  const r1 = await composeCard({
    backgroundPath: __dirname + '/test-bg.jpg',
    dateStr: today,
    content:
      '你一定要~~少吃多睡~~【多存钱】，多健身。\n别总觉得没找对人，压根没有对的人，只有越来越好的自己。\n向外求，求而不得；向内求，生生不息。\n很多人都没有你早上喝的那杯水重要。',
    footnote: null,
    paletteKey: 'auto',
  });
  fs.writeFileSync(__dirname + '/test-card-1.jpg', r1.buffer);
  console.log('card1 palette:', r1.palette.key);

  // 长文案测试自动缩字号 + 高亮 + 注脚
  const r2 = await composeCard({
    backgroundPath: __dirname + '/test-bg.jpg',
    dateStr: today,
    content:
      '【顶级的清醒】，是低配物质，朴素生活，好好取悦自己。\n\n人到一定阶段，便懂得"~~独与天地精神往来~~"。热闹是旁人的狂欢，孤独才是自己的自由。\n\n独处时自在舒服，便是内心强大。能量高的人，才懂得享受孤独。孤独的最高境界，是无需他人理解，不必事事解释。',
    footnote: 'Do not go gentle into that good night, and rage at close of day.',
    paletteKey: 'auto',
  });
  fs.writeFileSync(__dirname + '/test-card-2.jpg', r2.buffer);
  console.log('card2 palette:', r2.palette.key);

  // 纯英文数字混排
  const r3 = await composeCard({
    backgroundPath: null,
    dateStr: today,
    content: '2026年，愿你有~~前进一寸的勇气~~，亦有【后退一步的从容】。',
    footnote: 'Keep going. Everything will be okay.',
    paletteKey: 'auto',
  });
  fs.writeFileSync(__dirname + '/test-card-3.jpg', r3.buffer);
  console.log('card3 palette:', r3.palette.key);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
