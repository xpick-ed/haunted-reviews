import type { GameState } from '../store'
import type { Ingredient } from './night/items'
import type { NightPlan } from './night/plan'
import { festivalOf, specialOf } from './night/plan'
import { seeded } from './rng'

// 今天的事（DESIGN §28.2）：每天一張小翰的紙條＋兩件村民／鬼鄰居的委託。
// 完成的判斷都是看旗標或家裡的東西（送禮會設 gave_<npc>_<item>_today，見 bonds.ts）。
// 到天亮前都可以完成；存在 meta.requests。

export interface RequestDef {
  id: string
  /** 誰拜託的（名字） */
  who: string
  /** 小翰的紙條，還是鄰居的委託 */
  note?: boolean
  text: string
  /** 去哪裡做（HUD 的提示） */
  where: string
  /** 做完了沒 */
  done: (s: GameState) => boolean
  reward: { heart?: number; merit?: number; money?: number; bond?: [string, number] }
  /** 今天會不會出現 */
  when?: (c: Ctx) => boolean
}

interface Ctx {
  night: number
  members: string[]
  pantry: Partial<Record<Ingredient, number>>
  fortune: string | null
}

const flag = (f: string) => (s: GameState) => !!s.flags[f]
const gave = (npc: string, item: Ingredient) => flag(`gave_${npc}_${item}_today`)
const has = (item: Ingredient, n: number) => (s: GameState) => (s.meta.pantry[item] ?? 0) >= n

/**
 * 小翰的紙條末尾的附註（DESIGN §31.2）：他越感覺得到阿嬤，紙條越像寫給她的信。
 * 這個檔案不能 import store：畫面那邊（HanLayer）把讀 meta 的函式掛上來。
 */
export const hanNoteSource: { meta: () => Pick<GameState['meta'], 'hanSense' | 'hanSigns'> | null } = { meta: () => null }

export function hanPostscript(m: Pick<GameState['meta'], 'hanSense' | 'hanSigns'> | null): string {
  if (!m || m.hanSense < 30) return ''
  if (m.hanSigns.includes('bowl')) return '　P.S. 晚餐多煮了一碗，放在茶桌上。'
  if (m.hanSense >= 60) return '　P.S. 我知道寫給妳很怪。可是寫完，就比較不累。'
  return '　P.S. 最近好像一直有人在幫我……謝謝。'
}

/** 紙條的字：讀的時候才接上附註 */
function hanNote(d: RequestDef): RequestDef {
  const base = d.text
  return Object.defineProperty({ ...d }, 'text', { get: () => base + hanPostscript(hanNoteSource.meta()), enumerable: true })
}

export const REQUESTS: RequestDef[] = [
  // ---------- 小翰的紙條 ----------
  hanNote({ id: 'han_egg', who: '小翰', note: true, text: '阿嬤，今天記得去雞舍撿蛋，晚上客人可能會餓。', where: '後院菜園', done: flag('garden_egg_today'), reward: { heart: 3 } }),
  hanNote({ id: 'han_leaf', who: '小翰', note: true, text: '後院的地瓜葉長好了，幫我採一點。', where: '後院菜園', done: flag('garden_leaf_today'), reward: { heart: 2 } }),
  hanNote({ id: 'han_temple', who: '小翰', note: true, text: '幫我去土地公廟拜一下，最近生意都靠祂了。', where: '土地公廟', done: flag('temple_today'), reward: { heart: 3 }, when: (c) => c.night >= 2 }),
  hanNote({ id: 'han_coil', who: '小翰', note: true, text: '蚊香好像快沒了，家裡要有三盒才放心。', where: '村子的柑仔店', done: has('coil', 3), reward: { heart: 2 }, when: (c) => (c.pantry.coil ?? 0) < 3 }),
  hanNote({ id: 'han_toy', who: '小翰', note: true, text: '今天有小朋友要來住，房間準備一個小玩具吧。', where: '柑仔店門口的夾娃娃機', done: has('toy', 1), reward: { heart: 3 }, when: (c) => c.members.includes('xiaoyu') && (c.pantry.toy ?? 0) < 1 }),
  hanNote({ id: 'han_typhoon', who: '小翰', note: true, text: '颱風要來了！家裡至少要有兩根蠟燭，晚上會停電。', where: '村子的柑仔店', done: has('candle', 2), reward: { heart: 3 }, when: (c) => specialOf(c.night) === 'typhoon' }),
  hanNote({ id: 'han_fortune', who: '小翰', note: true, text: '去問問土地公，今晚順不順？', where: '土地公廟（擲筊）', done: (s) => !!s.meta.fortune, reward: { heart: 2 }, when: (c) => !c.fortune && c.night >= 2 }),
  hanNote({
    id: 'han_observe',
    who: '小翰',
    note: true,
    text: '今天的客人好像不太好應付，先去車站看看他們？',
    where: '小火車站',
    done: (s) => Object.keys(s.flags).some((k) => s.flags[k] && k.startsWith('observed_') && k.endsWith('_today')),
    reward: { heart: 2 },
    when: (c) => c.night >= 3,
  }),

  // ---------- 鄰居的委託 ----------
  { id: 'ajiao_crab', who: '阿嬌', text: '想吃螃蟹！退潮的時候幫我抓一隻好否？', where: '海邊抓螃蟹 → 送給阿嬌', done: gave('ajiao', 'crab'), reward: { money: 300, bond: ['ajiao', 10] }, when: (c) => c.night >= 3 },
  { id: 'ajiao_egg', who: '阿嬌', text: '店裡的雞蛋賣完了，幫我拿一顆來救急。', where: '後院撿蛋 → 送給阿嬌', done: gave('ajiao', 'egg'), reward: { money: 200, bond: ['ajiao', 8] } },
  { id: 'ayi_fish', who: '阿義', text: '有溪哥否？我想配一杯。', where: '溪邊釣魚 → 送給阿義', done: gave('ayi', 'fish'), reward: { merit: 2, bond: ['ayi', 8] }, when: (c) => c.night >= 2 },
  { id: 'kids_tag', who: '小孩鬼', text: '阿嬤陪我們玩鬼抓人！', where: '廢棄國小', done: flag('school_tag_today'), reward: { merit: 1, bond: ['guikids', 10] }, when: (c) => c.night >= 2 },
  { id: 'kids_hide', who: '小孩鬼', text: '今天玩躲貓貓，阿嬤當鬼！', where: '廢棄國小', done: flag('school_hide_today'), reward: { merit: 1, bond: ['guikids', 10] }, when: (c) => c.night >= 3 },
  { id: 'bingmom_ice', who: '阿桃', text: '今天鬼客人特別多，來幫我剉冰啦。', where: '老街冰果室', done: flag('os_ice_today'), reward: { money: 400, bond: ['bingmom', 8] }, when: (c) => c.night >= 3 },
  { id: 'photo', who: '照相館老闆', text: '好久沒人來拍照了，來拍一張吧。', where: '老街照相館', done: flag('os_photo_today'), reward: { money: 200 }, when: (c) => c.night >= 4 },
  { id: 'huobo_fish', who: '火伯', text: '想喝溪哥湯……先給我一條溪哥聞聞也好。', where: '溪邊釣魚 → 山上送給火伯（陰陽眼）', done: gave('huobo', 'fish'), reward: { merit: 2, bond: ['huobo', 10] }, when: (c) => c.night >= 4 },
  { id: 'keeper_candle', who: '守燈人', text: '燈塔的蠟燭又不夠了。', where: '柑仔店買蠟燭 → 海邊送給守燈人', done: gave('keeper', 'candle'), reward: { merit: 2, bond: ['keeper', 10] }, when: (c) => c.night >= 4 },
  { id: 'jinyubo_zongzi', who: '金魚伯', text: '我想吃粽子……夜市的鬼都在排隊。', where: '送給鬼夜市的金魚伯', done: gave('jinyubo', 'zongzi'), reward: { merit: 2, bond: ['jinyubo', 10] }, when: (c) => (c.pantry.zongzi ?? 0) > 0 },
  { id: 'banzhu_drum', who: '班主', text: '（對著空氣）今晚的鑼鼓……拜託了。', where: '廟埕野台戲', done: flag('stage_rhythm_today'), reward: { money: 500, bond: ['banzhu', 8] }, when: (c) => festivalOf(c.night) === 'tudigong' || festivalOf(c.night) === 'zhongyuan' },
  { id: 'river_fish', who: '阿嬌', text: '柑仔店想進一點溪哥來賣，幫我釣一條。', where: '溪邊釣魚', done: flag('river_fish_today'), reward: { money: 250 }, when: (c) => c.night >= 2 },
]

/** 今天的三件事：一張小翰的紙條＋兩件委託（依第幾晚固定，重玩同一天一樣） */
export function todayRequests(night: number, plan: NightPlan, meta: { pantry: Partial<Record<Ingredient, number>>; fortune: string | null }): { id: string; done: boolean }[] {
  const c: Ctx = { night, members: plan.parties.flatMap((p) => p.members), pantry: meta.pantry, fortune: meta.fortune }
  const rnd = seeded(night * 977 + 13)
  const pick = (list: RequestDef[], n: number) => {
    const pool = list.filter((r) => !r.when || r.when(c))
    const out: RequestDef[] = []
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0])
    return out
  }
  // 颱風夜：小翰的紙條一定是準備蠟燭
  const typhoon = specialOf(night) === 'typhoon' ? REQUESTS.filter((r) => r.id === 'han_typhoon') : []
  const notes = typhoon.length
    ? typhoon
    : pick(
        REQUESTS.filter((r) => r.note && r.id !== 'han_typhoon'),
        1,
      )
  const asks = pick(
    REQUESTS.filter((r) => !r.note),
    2,
  )
  return [...notes, ...asks].map((r) => ({ id: r.id, done: false }))
}

export const requestById = (id: string) => REQUESTS.find((r) => r.id === id)
