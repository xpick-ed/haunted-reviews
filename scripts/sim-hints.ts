// 「現在該做什麼」的提示（DESIGN §33）：假的狀態 → 規則挑出來的提示、箭頭的路線。
// npm run test:hints

import type { Meta } from '../src/world/night/director'
import { arrowPoint, currentHint, firstStep, placeIntro, untilDark, type HintCtx, type HintState, type HintTarget } from '../src/world/hints'
import type { NightPlan } from '../src/world/night/plan'

let fails = 0
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`)
  if (!cond) fails++
}

// 熱點的位置：測試只要有個點就好（場景要對）
const SPOT_SCENE: Record<string, HintTarget['scene']> = {
  altar: 'home',
  chair: 'home',
  xiaohan: 'home',
  story_chendong: 'home',
  han_kneel: 'home',
  han_bowl: 'home',
  'family.inherit.listen': 'home',
  garden_egg: 'garden',
  ajiao: 'village',
  station_guest_0: 'station',
  station_canetrain: 'station',
  station_board: 'station',
  sugar_back: 'sugar',
  harbor_door: 'harbor',
  goods_herbtea: 'oldstreet',
  os_bingmom: 'oldstreet',
  temple_burner: 'temple',
  river_fish: 'river',
  dm_board: 'dmarket',
}
const ctx: HintCtx = { spot: (id) => (SPOT_SCENE[id] ? { scene: SPOT_SCENE[id], x: 1, z: 2 } : null) }

const plan = (members: string[] = ['xiaomei'], extra: Partial<NightPlan> = {}): NightPlan => ({ parties: [{ room: 'r1', members: members as never }], event: 'none', ...extra })

function state(p: Partial<HintState> & { meta?: Partial<Meta> } = {}): HintState {
  const { meta, ...rest } = p
  // 第 3 晚傍晚小翰會跪在神明廳擲筊（劇情最優先）；一般的測試先當作看過了
  if (rest.flags) rest.flags = { hs_jb_3: true, ...rest.flags }
  return {
    started: true,
    phase: 'dusk',
    time: 17.6,
    scene: 'home',
    flags: { hs_jb_3: true },
    meta: { ...BASE_META, ...(meta ?? {}) } as Meta,
    plan: plan(),
    view: [],
    carrying: false,
    good: null,
    dialogue: null,
    minigame: null,
    panel: null,
    summary: null,
    month: null,
    intro: false,
    transitioning: false,
    ending: null,
    ...rest,
  } as HintState
}

const BASE_META = { night: 1, money: 20000, warm: 20, spooky: 0, heart: 60, pressure: 0, skillPts: 0, skills: [], upgrades: [], monthIncome: 0, sealed: false, merit: 0, items: [], pantry: { egg: 2, radish: 2, coil: 3, candle: 1 }, fortune: null, jiaobei: 0, memories: [], decor: [], bonds: {}, pastDone: [], requests: [], story: [], debtMonths: 0, hanSense: 0, hanSigns: [], specials: [] }

const id = (s: HintState, c: HintCtx = ctx) => currentHint(s, c)?.id ?? null

console.log('— 什麼時候不顯示')
ok(id(state({ dialogue: { id: 'x', i: 0 } })) === null, '對話中不顯示')
ok(id(state({ intro: true })) === null, '入住卡片開著不顯示')
ok(id(state({ scene: 'dream' })) === null, '夢裡不顯示')
ok(id(state({ scene: 'chenghuang' })) === null, '城隍廟不顯示')
ok(id(state({ phase: 'dawn' })) === null, '天亮不顯示')

console.log('— 第一晚：一步一步')
ok(id(state()) === 'n1.incense', '還沒上香 → 上香')
ok(id(state({ flags: { incense_today: true } })) === 'n1.han', '上完香 → 看看小翰')
ok(id(state({ flags: { incense_today: true, han_talk: true } })) === 'n1.wait', '都做了 → 坐竹椅等')
ok(currentHint(state(), ctx)?.target?.scene === 'home', '上香的目標在家裡')

console.log('— 傍晚的優先順序')
const n3 = { night: 3, requests: [{ id: 'han_egg', done: false }] }
ok(id(state({ meta: { night: 7 }, flags: { incense_today: true } })) === 'beat.chendong', '第 7 晚：陳董的劇情最優先')
ok(id(state({ meta: { night: 3 }, flags: { hs_jb_3: false } })) === 'beat.kneel', '第 3 晚：小翰跪著擲筊，比上香還優先')
ok(id(state({ meta: n3, time: 21.2 })) === 'incense.late', '21:00 以後還沒上香 → 快天黑了')
ok(id(state({ meta: n3 })) === 'incense', '在家、還沒上香 → 先上香')
ok(id(state({ meta: n3, flags: { incense_today: true } })) === 'observe', '上完香 → 去車站看客人')
ok(id(state({ meta: n3, flags: { incense_today: true }, time: 20.6 })) === 'req.han_egg', '太晚了就不叫人去車站，改今天的事')
ok(id(state({ meta: n3, flags: { incense_today: true, observed_xiaomei_today: true } })) === 'req.han_egg', '看過客人 → 今天的事')
ok(currentHint(state({ meta: n3, flags: { incense_today: true, observed_xiaomei_today: true } }), ctx)?.target?.scene === 'garden', '撿蛋 → 指向後院')
ok(id(state({ meta: { night: 5, pantry: { candle: 0 } } })) === 'incense', '颱風夜在家：還是先上香（跟目標一樣）')
ok(id(state({ meta: { night: 5, pantry: { candle: 0 } }, flags: { incense_today: true } })) === 'typhoon.candle', '上完香、蠟燭不夠 → 柑仔店')
ok(id(state({ meta: { night: 5, pantry: { candle: 2 } }, flags: { incense_today: true } })) !== 'typhoon.candle', '蠟燭夠了就不提')
ok(id(state({ scene: 'village', meta: n3 })) === 'observe', '在外面還沒上香：先做順路的事')

console.log('— 好東西、菜、新地方')
const done = { incense_today: true, observed_zhiming_today: true }
ok(id(state({ meta: { night: 4, requests: [] }, flags: done, plan: plan(['zhiming']) })) === 'good.herbtea', '志明（照顧家人的人）→ 安神茶')
ok(currentHint(state({ meta: { night: 4, requests: [] }, flags: done, plan: plan(['zhiming']) }), ctx)?.target?.scene === 'oldstreet', '安神茶 → 老街')
ok(id(state({ meta: { night: 4, requests: [], pantry: { herbtea: 1, egg: 1, radish: 1 } }, flags: done, plan: plan(['zhiming']) })) !== 'good.herbtea', '已經有了就不提')
const idle = { incense_today: true, observed_xiaomei_today: true }
ok(id(state({ meta: { night: 3, requests: [], pantry: {} }, flags: idle })) === 'pantry', '家裡沒菜 → 後院')
ok(id(state({ meta: { night: 3, requests: [], pantry: { egg: 1, radish: 1 } }, flags: idle })) === 'place.village', '第 3 晚、還沒見過阿嬌 → 介紹柑仔店')
ok(id(state({ meta: { night: 3, requests: [], pantry: { egg: 1, radish: 1 } }, flags: { ...idle, ajiao_met: true, ayi_met: true } })) === 'place.river', '見過阿嬌、阿義 → 介紹溪邊')
ok(id(state({ meta: { night: 3, requests: [], pantry: { egg: 1, radish: 1 } }, flags: { ...idle, ajiao_met: true, ayi_met: true, hint_day_3: true } })) === 'wait', '今天已經介紹過一個 → 不再介紹')
ok(placeIntro(state({ meta: { night: 3 }, flags: { ajiao_met: true, ayi_met: true, hint_day_3: true, hint_now_river: true } }))?.id === 'river', '今天介紹的那一個會一直留著')
ok(placeIntro(state({ meta: { night: 2 }, flags: { ajiao_met: true, ayi_met: true } })) === null, '第 2 晚還不介紹溪邊')
ok(placeIntro(state({ meta: { night: 5 }, flags: { ajiao_met: true, ayi_met: true, hint_seen_river: true, hint_seen_school: true, hint_seen_oldstreet: true, hint_seen_dmarket: true } }))?.id === 'sugar', '第 5 晚介紹糖廠')
ok(id(state({ meta: { night: 3, requests: [], pantry: { egg: 1, radish: 1 } }, flags: { ...idle, ajiao_met: true, ayi_met: true, hint_day_3: true }, scene: 'river' })) === 'free', '在外面、都做完了 → 只講還有多久天黑')

console.log('— 深夜')
const guest = (p: Partial<HintState['view'][number]>) => ({ id: 'zhiming', name: '志明', label: '', room: 'r1', awake: true, mode: 'bed', needs: [], comfort: 50, fear: 0, suspicion: 0, observed: false, seesGhost: false, ...p }) as HintState['view'][number]
const night = (p: Partial<HintState> = {}) => state({ phase: 'night', time: 23, meta: { night: 3 }, ...p })
ok(id(night({ view: [guest({ needs: [{ kind: 'insomnia', known: true }] })] })) === 'need.zhiming.insomnia', '知道的需求 → 講是誰、什麼事')
ok(currentHint(night({ view: [guest({ needs: [{ kind: 'insomnia', known: true }] })] }), ctx)?.text === '客房一的志明睡不著', '「客房一的志明睡不著」')
ok(/安神茶/.test(currentHint(night({ meta: { night: 3, pantry: { herbtea: 1 } }, view: [guest({ needs: [{ kind: 'insomnia', known: true }] })] }), ctx)?.why ?? ''), '菜櫥有安神茶會提醒')
ok(id(night({ view: [guest({ needs: [{ kind: 'insomnia', known: true }, { kind: 'hungry', known: true }] })] })) === 'need.zhiming.hungry', '比較急的需求先講')
ok(id(night({ view: [guest({ needs: [{ kind: 'cold', known: false }] })] })) === 'unknown.r1', '不知道要什麼 → 靠近看看')
ok(id(night({ view: [guest({ awake: false })] })) === 'calm', '大家都睡了')
ok(id(night({ view: [guest({ needs: [{ kind: 'cold', known: true }] })] }), { ...ctx, banner: true }) === null, '別的橫幅在講話 → 不重複')
ok(id(night({ scene: 'market', time: 25, view: [guest({ needs: [{ kind: 'thirsty', known: true }] })] })) === 'home.need', '在鬼夜市、家裡有需求 → 回家')
ok(id(night({ carrying: true, view: [guest({ needs: [{ kind: 'hungry', known: true }] })] })) === 'carry', '端著宵夜 → 拿去床頭')
ok(id(night({ time: 24.1, view: [guest({ awake: false })], flags: { conductor_met: true } })) === 'place.ghosttrain', '午夜、見過車掌 → 介紹鬼火車')
ok(id(night({ time: 24.8, view: [guest({ awake: false })] })) === 'place.market', '午夜以後 → 介紹鬼夜市')
ok(id(night({ time: 24.8, view: [guest({ awake: false })], flags: { hint_seen_market: true } })) === 'calm', '介紹過就不再講')

console.log('— 路線（箭頭指向往目標的出口）')
const at = (night: number, time = 18) => ({ phase: 'dusk', time, meta: { night } })
const exitTo = (from: HintState['scene'], to: HintState['scene'], s = at(3)) => firstStep(from, to, s, ctx.spot)
ok(exitTo('home', 'home') === null, '同一個場景不用走出口')
ok((exitTo('home', 'sugar', at(5))?.x ?? 0) < -20, '家 → 糖廠：先往西（車站）')
ok(exitTo('home', 'sugar', at(3)) === null, '第 5 晚以前糖廠走不到')
ok((exitTo('home', 'dmarket')?.x ?? 0) > 20, '家 → 黃昏市場：先往東（村子）')
ok((exitTo('village', 'dmarket')?.x ?? 0) > 10, '村子 → 黃昏市場：南邊的橋')
ok((exitTo('home', 'harbor')?.x ?? 0) < -20, '家 → 海邊：往西（車站、老街）')
ok(exitTo('station', 'lighthouse') !== null, '車站 → 燈塔：經過老街、海邊的門')
ok(exitTo('home', 'market', { phase: 'night', time: 23, meta: { night: 3 } }) === null, '鬼夜市 00:00 以前走不到')
ok(exitTo('home', 'market', { phase: 'night', time: 24.5, meta: { night: 3 } }) !== null, '00:00 以後走得到')
ok(exitTo('garden', 'river') !== null, '後院 → 溪邊：回家、村子、北邊')
const h = currentHint(state({ meta: n3, flags: { incense_today: true, observed_xiaomei_today: true } }), ctx)
ok((arrowPoint(h, { scene: 'home', ...at(3) }, ctx.spot)?.x ?? 0) < -5, '箭頭：家裡 → 往後院的出口')
ok(arrowPoint(h, { scene: 'garden', ...at(3) }, ctx.spot)?.x === 1, '箭頭：到了後院 → 指向雞舍')

const nh = currentHint(night({ view: [guest({ needs: [{ kind: 'thirsty', known: true }] })] }), ctx)
const yard = { x: 3, z: 3 }
const door = arrowPoint(nh, { scene: 'home', phase: 'night', time: 23, meta: { night: 3 } }, ctx.spot, yard)
ok(!!door && Math.abs(door.x - nh!.target!.x) > 0.5, '目標在客房、阿嬤在埕裡 → 先指房門')
const inside = arrowPoint(nh, { scene: 'home', phase: 'night', time: 23, meta: { night: 3 } }, ctx.spot, { x: nh!.target!.x - 0.5, z: nh!.target!.z })
ok(inside?.x === nh!.target!.x, '進了房間 → 指床頭')

const obs = currentHint(state({ meta: n3, flags: { incense_today: true } }), ctx)
const home3 = { scene: 'home' as const, phase: 'dusk', time: 18, meta: { night: 3 } }
const g1 = arrowPoint(obs, home3, ctx.spot, { x: 3, z: 2 })
ok(g1?.x === 0 && g1.z < 7.7, '埕裡 → 車站：先指大門（裡面）')
const g2 = arrowPoint(obs, home3, ctx.spot, { x: 0.2, z: 7.2 })
ok(g2?.x === 0 && g2.z > 7.7, '到了大門 → 指門外')
const g3 = arrowPoint(obs, home3, ctx.spot, { x: 0, z: 9.5 })
ok((g3?.x ?? 0) < -20, '出了大門 → 指往車站的出口')
const egg = currentHint(state({ meta: n3, flags: { incense_today: true, observed_xiaomei_today: true } }), ctx)
const b1 = arrowPoint(egg, home3, ctx.spot, { x: 0, z: 9.5 })
ok((b1?.x ?? 0) < -11 && (b1?.z ?? 0) > 7.7, '大門外 → 後院：先到西南角')
const b2 = arrowPoint(egg, home3, ctx.spot, { x: -12.6, z: 9 })
ok((b2?.z ?? 0) < -9.8, '到了西邊 → 沿西邊往北')
const b3 = arrowPoint(egg, home3, ctx.spot, { x: -12.6, z: -11.5 })
ok((b3?.z ?? 0) < -15, '到了屋後 → 指後院的出口')

console.log('— 其他')
ok(untilDark(21) === '還有 1 小時天黑', '還有 1 小時天黑')
ok(untilDark(20.5) === '還有 1 小時 30 分天黑', '還有 1 小時 30 分')
ok(untilDark(21.75) === '還有 15 分天黑', '還有 15 分')
ok(Object.values(ctx).length > 0, 'ok')

console.log(fails ? `\n✗ ${fails} 項沒過` : '\n✓ 全部通過')
if (fails) process.exit(1)
