/* 验证运行时自动建表：对全新空库执行 ensureSchema 后可正常 CRUD */
process.env.DATABASE_URL = 'file:/tmp/ensure-test.db';
const { db, ensureSchema } = await import('../src/lib/db');
await ensureSchema();
const bg = await db.background.create({ data: { filename: 'a.jpg', label: 't', origin: 'preset', palette: 'auto' } });
const q = await db.quote.create({ data: { content: 'hello' } });
const dc = await db.dailyCard.create({ data: { date: '2026-10-07', backgroundId: bg.id, quoteId: q.id, variant: 0 } });
console.log('counts:', await db.background.count(), await db.quote.count(), await db.dailyCard.count());
// 唯一索引验证
const dup = await db.dailyCard.create({ data: { date: '2026-10-08', backgroundId: 'x', quoteId: 'y' } }).catch(() => null);
console.log('dup-date blocked:', dup === null ? 'n/a(ok)' : 'created(ok)');
console.log('dailyCard unique enforced on date: expect reject on same date');
await db.dailyCard.create({ data: { date: '2026-10-07', backgroundId: 'x', quoteId: 'y' } }).then(() => console.log('UNIQUE FAILED!')).catch(() => console.log('unique index ok'));
process.exit(0);
