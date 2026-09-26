// 主線結局判定的測試（DESIGN §28.4）：npm run test:story
import type { Meta } from '../src/world/night/director'
import { endingAtDawn, endingAtMonthEnd, hanEpilogue, DECISION_NIGHT, GOAL, HAN_KNOWS, TRAIN_MEMORIES } from '../src/world/story'
import { MEMORIES } from '../src/world/memories'

// 不 import director（它會帶進瀏覽器才有的語音模組）：只放結局判定會看的欄位
const base = (p: Partial<Meta>): Meta =>
  ({ night: 1, money: 20000, heart: 60, memories: [], pastDone: [], story: [], debtMonths: 0, hanSense: 0, hanSigns: [], ...p }) as unknown as Meta
const mems = (n: number) => MEMORIES.slice(0, n).map((m) => m.id)
const cases: [string, string | null, string | null][] = [
  ['第 4 晚月底、還沒到期限', endingAtMonthEnd(base({ night: 4, money: 5000 })), null],
  ['連兩個月負債', endingAtMonthEnd(base({ night: 8, debtMonths: 2 })), 'sold'],
  ['第 12 晚：錢不夠', endingAtMonthEnd(base({ night: DECISION_NIGHT, money: GOAL.money - 1, heart: 90 })), 'sold'],
  ['第 12 晚：心不夠', endingAtMonthEnd(base({ night: DECISION_NIGHT, money: 90000, heart: GOAL.heart - 1 })), 'sold'],
  ['第 12 晚：不賣、回憶少', endingAtMonthEnd(base({ night: DECISION_NIGHT, money: GOAL.money, heart: GOAL.heart, memories: mems(3) })), 'stay'],
  ['第 12 晚：不賣、回憶夠', endingAtMonthEnd(base({ night: DECISION_NIGHT, money: GOAL.money, heart: GOAL.heart, memories: mems(TRAIN_MEMORIES) })), 'train'],
  ['第 12 晚：全部回憶＋1958', endingAtMonthEnd(base({ night: DECISION_NIGHT, money: GOAL.money, heart: GOAL.heart, memories: mems(MEMORIES.length), pastDone: ['wedding', 'kitchen', 'stones'] })), 'together'],
  ['看過結局以後不再判定', endingAtMonthEnd(base({ night: 16, debtMonths: 3, story: ['ended_stay'] })), null],
  ['天亮：心歸零', endingAtDawn(base({ heart: 0 })), 'sold'],
  ['天亮：心還有', endingAtDawn(base({ heart: 1 })), null],
  // 小翰感覺得到阿嬤（DESIGN §31.2）：不改變是哪個結局，只多一張卡片
  ['小翰感覺到阿嬤也不會改變結局', endingAtMonthEnd(base({ night: DECISION_NIGHT, money: GOAL.money - 1, heart: 90, hanSense: 100 })), 'sold'],
  ['結局多一張：感覺到阿嬤（賣掉了）', hanEpilogue('sold', HAN_KNOWS)?.before ?? null, 'nighttrain'],
  ['結局多一張：感覺還不夠', hanEpilogue('stay', HAN_KNOWS - 1)?.before ?? null, null],
]
let bad = 0
for (const [name, got, want] of cases) {
  const ok = got === want
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} ${name}：${got ?? '（沒有）'}${ok ? '' : `，應該是 ${want ?? '（沒有）'}`}`)
}
console.log(bad ? `\n${bad} problem(s)` : '\nall story checks OK')
process.exit(bad ? 1 : 0)
