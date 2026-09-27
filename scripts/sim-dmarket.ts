// 黃昏市場的測試（不用瀏覽器）：npx tsx scripts/sim-dmarket.ts
//
//   價錢     原價、今日特價（七折）、收攤價（21:00 以後八折），取便宜的；特價每天固定、會輪到不同的東西
//   殺價     機器人：只用最吃的招＋抓得準 → 大概七折；亂出 → 八、九折；一直用討厭的招 → 翻臉沒買成；不會低於六折
//   熱點     傍晚、晚上、開不開陰陽眼，每個熱點的字都算得出來（晚上沒有「買」）
//   資料     新食材、新食譜都有名字；用到的台詞都在 dmarket.lines.json；委託都登記了；出生點不在牆裡

import fs from 'node:fs'
import path from 'node:path'
import { CLOSING, DMARKET, DMARKET_HOTSPOTS, DMARKET_SCENE, DM_GOODS, BARGAINERS, priceOf, todaySpecial, type Stock } from '../src/world/sceneDuskMarket'
import { INGREDIENTS, RECIPES } from '../src/world/night/items'
import { BARGAIN, dealHand, playTactic, settle, startBargain, TACTIC_IDS, type BargainParams, type Tactic, type Timing } from '../src/ui/minigames/bargain.logic'
import { DIALOGUES } from '../src/world/dialogues'
import { requestById } from '../src/world/requests'
import { VILLAGE_SCENE } from '../src/world/sceneVillage'
import { seeded } from '../src/world/rng'
import type { GameState } from '../src/store'

let fails = 0
function check(ok: boolean, msg: string) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`)
  if (!ok) fails++
}

// ---------------------------------------------------------------------------
console.log('價錢')
{
  const night = 5
  const sp = todaySpecial(night)
  const other = (Object.keys(DM_GOODS) as Stock[]).find((k) => k !== sp && k !== 'ginger')!
  check(priceOf(other, night, 18).price === DM_GOODS[other].price && priceOf(other, night, 18).tag === null, `平常原價（${other} $${DM_GOODS[other].price}）`)
  check(priceOf(sp, night, 18).price === Math.round(DM_GOODS[sp].price * 0.7) && priceOf(sp, night, 18).tag === 'special', `今日特價七折（${sp}）`)
  check(priceOf(other, night, CLOSING + 0.2).price === Math.round(DM_GOODS[other].price * 0.8) && priceOf(other, night, CLOSING + 0.2).tag === 'closing', '21:00 以後收攤價八折')
  check(priceOf(sp, night, CLOSING + 0.2).tag === 'special', '特價品收攤時還是七折（取便宜的）')
  check(todaySpecial(night) === todaySpecial(night), '同一天的特價固定')
  const seen = new Set(Array.from({ length: 40 }, (_, i) => todaySpecial(i + 1)))
  check(seen.size >= 5, `40 天內特價會輪到 ${seen.size} 種東西`)
}

// ---------------------------------------------------------------------------
console.log('殺價')
{
  const b = BARGAINERS[0]
  const p: BargainParams = { vendor: b.vendor, name: b.name, item: b.item, itemName: '豬肉', base: 90, likes: b.likes, hates: b.hates }
  /** 一局：pickFn 挑牌，timingFn 抓語氣；最多四回合 */
  const play = (pickFn: (hand: Tactic[], last: Tactic | null, rnd: () => number) => Tactic, timingFn: (rnd: () => number) => Timing, seed: number) => {
    const rnd = seeded(seed)
    let s = startBargain(p)
    while (!s.angry && s.round < BARGAIN.rounds) {
      const hand = dealHand(p, rnd)
      s = playTactic(p, s, pickFn(hand, s.last, rnd), timingFn(rnd), rnd).next
    }
    return settle(p, s)
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  // 懂門道：有最吃的招就出，沒有就出不討厭、沒連用的；語氣八成抓得到
  const smart = Array.from({ length: 200 }, (_, i) =>
    play(
      (hand, last) => (hand.includes(p.likes) && last !== p.likes ? p.likes : (hand.find((t) => t !== p.hates && t !== last) ?? hand[0])),
      (r) => (r() < 0.35 ? 2 : r() < 0.85 ? 1 : 0),
      100 + i,
    ),
  )
  // 亂出：隨便挑牌、語氣五成
  const random = Array.from({ length: 200 }, (_, i) =>
    play(
      (hand, _l, r) => hand[Math.floor(r() * hand.length)],
      (r) => (r() < 0.1 ? 2 : r() < 0.5 ? 1 : 0),
      900 + i,
    ),
  )
  const smartRatio = avg(smart.filter((r) => r.deal).map((r) => r.price / r.base))
  const randomRatio = avg(random.filter((r) => r.deal).map((r) => r.price / r.base))
  const randomAngry = random.filter((r) => r.angry).length / random.length
  console.log(`    懂門道平均 ${(smartRatio * 100).toFixed(0)}%（翻臉 ${smart.filter((r) => r.angry).length}/200）、亂出平均 ${(randomRatio * 100).toFixed(0)}%（翻臉 ${(randomAngry * 100).toFixed(0)}%）`)
  check(smartRatio <= 0.75 && smartRatio >= 0.6, '懂門道的大概殺到七折')
  check(randomRatio > smartRatio + 0.05, '亂出的比較貴')
  check(randomAngry < 0.35, '亂出不會常常翻臉')
  check(smart.every((r) => !r.deal || r.price >= Math.ceil(p.base * BARGAIN.floor)), '不會低於六折')
  // 一直用她討厭的招 → 三次就翻臉
  let s = startBargain(p)
  for (let i = 0; i < 3; i++) s = playTactic(p, s, p.hates, 2, () => 0.5).next
  check(s.angry && !settle(p, s).deal, '一直用討厭的招 → 翻臉沒買成')
  // 同一招連用效果減半
  const a = playTactic(p, startBargain(p), p.likes, 1, () => 0.9)
  const b2 = playTactic(p, a.next, p.likes, 1, () => 0.9)
  check(b2.cut < a.cut && b2.reaction === 'repeat', `同一招連用效果減半（${a.cut} → ${b2.cut}）`)
  check(TACTIC_IDS.length === 6 && dealHand(p, seeded(3)).length === 3, '每回合三張不同的牌')
  check(BARGAINERS.every((x) => x.likes !== x.hates), '每個攤販最吃和最討厭的招不一樣')
}

// ---------------------------------------------------------------------------
console.log('熱點')
{
  const base = { phase: 'dusk', time: 18, vision: false, flags: {} as Record<string, boolean>, meta: { night: 5, money: 5000, merit: 10, pantry: {} } }
  const states = [
    { ...base },
    { ...base, vision: true },
    { ...base, phase: 'night', time: 24 },
    { ...base, phase: 'night', time: 24, vision: true, flags: { dm_aye_met: true } },
  ] as unknown as GameState[]
  let ok = true
  for (const st of states)
    for (const h of DMARKET_HOTSPOTS) {
      try {
        h.label(st)
      } catch (e) {
        ok = false
        console.log(`    ${h.id}: ${String(e)}`)
      }
    }
  check(ok, `${DMARKET_HOTSPOTS.length} 個熱點的字都算得出來`)
  const labels = (st: GameState) => DMARKET_HOTSPOTS.map((h) => h.label(st)).filter(Boolean) as string[]
  check(labels(states[0]).some((l) => l.startsWith('買豬肉')) && labels(states[0]).some((l) => l.startsWith('跟阿蘭姐殺價')), '傍晚可以買、可以殺價')
  check(!labels(states[2]).some((l) => l.startsWith('買')) && labels(states[2]).some((l) => l.includes('收攤了')), '晚上收攤了')
  check(!labels(states[0]).some((l) => l.includes('阿葉')) && labels(states[1]).some((l) => l.includes('阿桑')), '阿葉嬸要開陰陽眼才看得到')
  check(labels({ ...states[0], flags: { dm_bargain_today: true } } as unknown as GameState).every((l) => !l.includes('殺價')), '殺價一天一次')
}

// ---------------------------------------------------------------------------
console.log('資料')
{
  const lines = JSON.parse(fs.readFileSync(path.join('src/data/dmarket.lines.json'), 'utf8')) as Record<string, { who: string; text: string }>
  const src = fs.readFileSync('src/world/sceneDuskMarket.ts', 'utf8') + fs.readFileSync('src/scene/DuskMarket.tsx', 'utf8')
  const ids = new Set([...src.matchAll(/'(dm\.[a-z0-9.]+)'/g)].map((m) => m[1]))
  for (const v of ['wanbo', 'alan', 'azhong', 'guoshen', 'caipo', 'douhuabo']) ids.add(`dm.${v}.buy.1`).add(`dm.${v}.buy.2`)
  for (const b of BARGAINERS) ids.add(`dm.${b.vendor}.hi`).add(`dm.${b.vendor}.angry`)
  for (const k of ['pork', 'milkfish', 'clam', 'cabbage', 'douhua', 'redguo']) ids.add(`dm.board.${k}`)
  for (const d of ['dm_aye_first', 'dm_aye_tips']) for (const st of DIALOGUES[d].steps) ids.add(st.line)
  const missing = [...ids].filter((id) => !lines[id])
  check(missing.length === 0, `用到的 ${ids.size} 句台詞都在（缺：${missing.join(', ') || '無'}）`)
  const cast = (JSON.parse(fs.readFileSync('src/data/cast.json', 'utf8')) as { id: string }[]).map((c) => c.id)
  const needCast = [...new Set(Object.values(lines).map((l) => l.who))].filter((w) => !cast.includes(w))
  console.log(`    還沒有聲音的角色（要加到 cast.json）：${needCast.join(', ') || '無'}`)
  const market = ['pork', 'milkfish', 'clam', 'cabbage', 'douhua', 'redguo'] as const
  check(market.every((k) => INGREDIENTS[k]?.name), '新食材都有名字')
  const newRecipes = RECIPES.filter((r) => ['luroufan', 'clamsoup', 'milkfishcongee', 'cabbagerice', 'douhua'].includes(r.id))
  check(newRecipes.length === 5 && newRecipes.every((r) => Object.keys(r.needs).every((k) => k in INGREDIENTS)), '五道新宵夜的食材都存在')
  check(['han_market', 'ajiao_pork', 'dijizhu_redguo'].every((id) => !!requestById(id)), '委託都登記了')
  // 出生點不在牆裡、出口在範圍內
  const inRect = (r: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1
  const [sx, sz] = DMARKET_SCENE.spawns.village
  check(!DMARKET_SCENE.colliders.rects.some((r) => inRect(r, sx, sz)) && inRect(DMARKET_SCENE.colliders.bounds, sx, sz), '市場的出生點不在牆裡')
  check(!DMARKET_SCENE.exits.some((e) => inRect(e.area, sx, sz)), '出生點不在出口上（不會一進來就被送回去）')
  const [vx, vz] = VILLAGE_SCENE.spawns.market
  check(!VILLAGE_SCENE.colliders.rects.some((r) => inRect(r, vx, vz)) && !VILLAGE_SCENE.exits.some((e) => inRect(e.area, vx, vz)), '村子那頭的出生點也沒問題')
  check(VILLAGE_SCENE.exits.some((e) => e.to === 'dmarket') && DMARKET_SCENE.exits.some((e) => e.to === 'village' && e.spawn === 'market'), '村子 ↔ 市場的出口接得起來')
  check(DMARKET.shoppers.every((p) => p.z > DMARKET.aisle.z0 && p.z < DMARKET.aisle.z1), '站著的客人在走道上')
}

console.log(fails ? `\n✗ ${fails} 項沒過` : '\n✓ 全部通過')
process.exit(fails ? 1 : 0)
