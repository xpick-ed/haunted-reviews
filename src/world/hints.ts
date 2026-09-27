import type { GameState } from '../store'
import type { SceneId } from './scenes'
import { SCENES } from './scenes'
import { COMPOUND, FENCE, GUEST_ROOMS, ROOMS, STOVE } from '../scene/layout'
import { GUESTS, NEED_INFO } from './night/guests'
import { GOODS, INGREDIENTS, RECIPES, goodsFor, goodsLovedBy, type GoodId } from './night/items'
import { festivalOf, specialOf } from './night/plan'
import type { NeedKind, RoomId } from './night/types'
import { requestById } from './requests'
import { bowlBeat, chendongBeat, hanAtHome, kneelBeat } from './storyBeats'
import { inheritanceBeat } from './adultStory'

// 現在該做什麼（DESIGN §33）：依狀態挑一個最重要的下一步，給 HUD 的提示條與場景裡的箭頭。
// 不是鎖：新地方只是「建議去看看」，每個地方介紹一次（旗標 hint_seen_<id>），一天最多介紹一個。
// 純函式（Node 測試可以跑），不能 import store／audio；熱點的位置由呼叫的人查（ctx.spot）。

export interface HintTarget {
  scene: SceneId
  x: number
  z: number
}

export interface Hint {
  /** 哪一條規則（HUD 用來判斷換了沒） */
  id: string
  /** 提示條上的字（短） */
  text: string
  /** 點開以後多講一點：為什麼、在哪裡 */
  why?: string
  /** 目標在哪裡（箭頭指過去；在別的場景時指向往那邊的出口） */
  target?: HintTarget
  /** 介紹新地方：看過（走到那個場景、或顯示夠久、或按「知道了」）就記 hint_seen_<place> */
  place?: string
}

/** 規則要看的狀態（GameState 的一部分；測試可以只給這些） */
export type HintState = Pick<
  GameState,
  'started' | 'phase' | 'time' | 'scene' | 'flags' | 'meta' | 'plan' | 'view' | 'carrying' | 'good' | 'dialogue' | 'minigame' | 'panel' | 'summary' | 'month' | 'intro' | 'transitioning' | 'ending'
>

export interface HintCtx {
  /** 熱點的位置（HUD 從 HOTSPOTS 查；Node 測試給假的） */
  spot: (id: string) => HintTarget | null
  /** 別的橫幅（突發事件、大人的恐怖、心事、特別的夜晚、客人之間的故事）正在講：不重複 */
  banner?: boolean
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

const DUSK_END = 22
const ROOM_NAME: Record<RoomId, string> = { r1: '客房一', r2: '客房二' }

/** 離天黑還有多久（「還有 1 小時 15 分」） */
export function untilDark(time: number): string {
  const m = Math.max(0, Math.round(((DUSK_END - time) * 60) / 15) * 15)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `還有 ${h} 小時 ${r} 分天黑`
  if (h) return `還有 ${h} 小時天黑`
  return r ? `還有 ${r} 分天黑` : '要天黑了'
}

const pt = (scene: SceneId, x: number, z: number): HintTarget => ({ scene, x, z })

/** 家裡有哪一道菜煮得出來（白粥不算） */
function canCook(pantry: Partial<Record<string, number>>) {
  return RECIPES.some((r) => r.id !== 'porridge' && Object.entries(r.needs).every(([k, n]) => (pantry[k] ?? 0) >= (n ?? 0)))
}

const observedToday = (s: HintState) => Object.keys(s.flags).some((k) => s.flags[k] && k.startsWith('observed_') && k.endsWith('_today'))

// ---------------------------------------------------------------------------
// 今天的事 → 去哪裡做（熱點 id；有東西要送的，東西拿到了就指向收禮的人）
// ---------------------------------------------------------------------------

const has = (s: HintState, item: string, n = 1) => ((s.meta.pantry as Record<string, number | undefined>)[item] ?? 0) >= n

const REQ_SPOT: Record<string, (s: HintState) => string> = {
  han_egg: () => 'garden_egg',
  han_leaf: () => 'garden_leaf',
  han_temple: () => 'temple_burner',
  han_coil: () => 'ajiao',
  han_toy: () => 'village_claw',
  han_typhoon: () => 'ajiao',
  han_fortune: () => 'temple_jiaobei',
  han_observe: () => 'station_guest_0',
  han_market: () => 'dm_board',
  ajiao_crab: (s) => (has(s, 'crab') ? 'bond_ajiao_village' : 'harbor_crab'),
  ajiao_egg: (s) => (has(s, 'egg') ? 'bond_ajiao_village' : 'garden_egg'),
  ajiao_pork: (s) => (has(s, 'pork') ? 'bond_ajiao_village' : 'dm_board'),
  ayi_fish: (s) => (has(s, 'fish') ? 'bond_ayi_temple' : 'river_fish'),
  kids_tag: () => 'school_tag',
  kids_hide: () => 'school_hide',
  bingmom_ice: () => 'os_bingmom',
  photo: () => 'os_photo',
  huobo_fish: (s) => (has(s, 'fish') ? 'bond_huobo_hill' : 'river_fish'),
  keeper_candle: (s) => (has(s, 'candle') ? 'bond_keeper_harbor' : 'ajiao'),
  jinyubo_zongzi: () => 'bond_jinyubo_market',
  banzhu_drum: () => 'stage_banzhu',
  river_fish: () => 'river_fish',
  dijizhu_redguo: (s) => (has(s, 'redguo') ? 'bond_dijizhu_home' : 'dm_board'),
}

/** 店裡的好東西去哪裡拿（熱點 id） */
const GOOD_SPOT: Record<GoodId, string> = {
  herbtea: 'goods_herbtea',
  floral: 'goods_floral',
  ramune: 'os_ice_fridge',
  quilt: 'os_cloth_machine',
  photo: 'os_photo',
  banquet: 'village_acai',
  icepop: 'sugar_icepop',
}

// ---------------------------------------------------------------------------
// 新地方的介紹（建議，不是鎖）：第幾晚起、還沒去過、一天最多一個
// ---------------------------------------------------------------------------

interface PlaceIntro {
  id: string
  from: number
  when?: (s: HintState) => boolean
  text: string
  why: string
  spot: string
}

export const PLACE_INTROS: PlaceIntro[] = [
  { id: 'village', from: 2, when: (s) => !s.flags.ajiao_met, text: '去村子的柑仔店看看', why: '出大門往東。柑仔店的阿嬌看得到阿嬤，蚊香、蠟燭、薑都在她那裡買。', spot: 'ajiao' },
  { id: 'temple', from: 2, when: (s) => !s.flags.ayi_met, text: '土地公廟：拜一拜、擲個筊', why: '村子再往東。上香陰氣多一點，擲筊問今晚順不順；榕樹下坐著老鄰居阿義。', spot: 'temple_burner' },
  { id: 'river', from: 3, text: '村子北邊的溪，可以釣溪哥', why: '溪哥可以煮溪哥湯，阿義、火伯也愛。晚上還有螢火蟲。', spot: 'river_fish' },
  { id: 'school', from: 3, text: '村子南邊的國小，有小孩鬼', why: '阿嬤小時候讀的學校。小孩鬼想找人玩鬼抓人、躲貓貓。', spot: 'school_tag' },
  { id: 'oldstreet', from: 4, text: '坐車站過去，老街的店都能逛', why: '車站再往西就是老街：冰果室、中藥行、照相館、布莊，拿得到晚上用得到的好東西。', spot: 'os_bingmom' },
  { id: 'dmarket', from: 4, text: '黃昏市場買得到新的菜', why: '村子南邊過橋。豬肉、虱目魚、蛤仔、高麗菜，宵夜可以煮滷肉飯、蛤仔湯。會殺價的話更便宜。', spot: 'dm_board' },
  { id: 'sugar', from: 5, text: '五分車通到糖廠了', why: '車站西邊的五分車，現在可以一路坐到糖廠。福利社的枝仔冰，怕熱的客人最愛。', spot: 'station_canetrain' },
  { id: 'hill', from: 6, when: (s) => festivalOf(s.meta.night) !== 'qingming', text: '廟後的山路，通到阿公的墳', why: '土地公廟後面往上走。開陰陽眼，山上住了很多老鄰居。', spot: 'hill' },
  { id: 'lighthouse', from: 5, when: (s) => !!s.flags.keeper_met, text: '燈塔可以走進去，爬到頂', why: '從頂端看得到整個村子，家裡有事也看得到。晚上可以在上面點燈。', spot: 'harbor_door' },
]

// ---------------------------------------------------------------------------
// 深夜：需求 → 要做什麼、去哪裡
// ---------------------------------------------------------------------------

const NEED_DO: Record<NeedKind, string> = {
  cold: '蓋被子、關窗',
  hot: '開電扇',
  thirsty: '床頭倒一杯水',
  mosquito: '點蚊香，或打蚊子',
  dark: '開床頭的小夜燈',
  hungry: '去灶腳煮宵夜，端到床頭',
  insomnia: '輕拍、或在門外哼搖籃曲',
  scare: '在他附近做嚇人的事',
  play: '陪他玩（別讓大人看到）',
  chat: '走過去跟他聊聊',
  lost: '把東西撿回床頭',
}

function needSpot(room: RoomId, need: NeedKind): HintTarget {
  const R = GUEST_ROOMS[room]
  const at = (p: readonly [number, number] | [number, number]) => pt('home', p[0], p[1])
  switch (need) {
    case 'hot':
      return at(R.fan)
    case 'thirsty':
    case 'dark':
      return at(R.nightstand)
    case 'mosquito':
      return at(R.coil)
    case 'hungry':
      return pt('home', STOVE.x + 1.05, STOVE.z)
    case 'scare':
      return at(R.doorOut)
    default:
      return at(R.bedside)
  }
}

/** 需求的急迫程度：醒著、會吵醒人的排前面 */
const URGENT: Record<NeedKind, number> = { scare: 2, play: 3, chat: 3, lost: 4, hungry: 5, thirsty: 6, dark: 7, mosquito: 7, hot: 8, cold: 9, insomnia: 9 }

// ---------------------------------------------------------------------------
// 規則（由上往下，第一條成立的就是）
// ---------------------------------------------------------------------------

export function currentHint(s: HintState, ctx: HintCtx): Hint | null {
  if (!s.started || s.dialogue || s.minigame || s.panel || s.summary || s.month || s.intro || s.transitioning || s.ending) return null
  if (s.scene === 'dream' || s.scene === 'past' || s.scene === 'chenghuang') return null
  if (s.meta.story.some((x) => x.startsWith('ended_')) && s.phase !== 'dusk' && s.phase !== 'night') return null
  if (s.phase === 'dusk') return duskHint(s, ctx)
  if (s.phase === 'night') return nightHint(s, ctx)
  return null
}

function withSpot(h: Omit<Hint, 'target'> & { spot?: string; target?: HintTarget }, ctx: HintCtx): Hint {
  const { spot, ...rest } = h
  const target = rest.target ?? (spot ? (ctx.spot(spot) ?? undefined) : undefined)
  return { ...rest, target }
}

function duskHint(s: HintState, ctx: HintCtx): Hint | null {
  const n = s.meta.night
  const left = untilDark(s.time)
  const incense = !!s.flags.incense_today
  const late = s.time >= 21

  // 1. 主線的劇情（只在這個傍晚）
  if (chendongBeat(s)) return withSpot({ id: 'beat.chendong', text: '有人來找小翰：躲在大門邊聽', why: '一台黑頭車停在門口。躲在大門內的門柱邊，聽聽他們在說什麼。', spot: 'story_chendong' }, ctx)
  if (inheritanceBeat(s)) return withSpot({ id: 'beat.inherit', text: '神明廳有人在吵：去門口聽聽', why: '小翰的叔叔、姑姑回來了。站在神明廳門口偷聽。', spot: 'family.inherit.listen' }, ctx)
  if (kneelBeat(s)) return withSpot({ id: 'beat.kneel', text: '小翰跪在神明廳擲筊', why: '他有事想問神明。走到他旁邊，筊要怎麼落，阿嬤可以幫一把。', spot: 'han_kneel' }, ctx)
  if (bowlBeat(s)) return withSpot({ id: 'beat.bowl', text: '小翰在茶桌多擺了一碗飯', why: '他好像感覺得到妳了。去坐在他對面。', spot: 'han_bowl' }, ctx)

  // 2. 快天黑還沒上香
  if (!incense && late) return withSpot({ id: 'incense.late', text: '快天黑了！回神明廳上香', why: `${left}。上香陰氣才會滿，晚上才有力氣照顧客人。`, spot: 'altar' }, ctx)

  // 3. 第一晚：一步一步來
  if (n === 1) {
    if (!incense) return withSpot({ id: 'n1.incense', text: '先到神明廳上香', why: '神明廳在正身中間。上完香，天黑就會有客人來住。', spot: 'altar' }, ctx)
    if (!s.flags.han_talk && hanAtHome(s)) return withSpot({ id: 'n1.han', text: '去埕裡看看小翰', why: '孫子小翰在埕裡掃地。他看不到阿嬤，但妳可以靠近他。', spot: 'xiaohan' }, ctx)
    return withSpot({ id: 'n1.wait', text: '坐在埕裡的竹椅上等天黑', why: `${left}。也可以到處走走，時間到了客人就會來。`, spot: 'chair' }, ctx)
  }

  // 4. 在家還沒上香：先上香（出門前順手，跟左上角的目標講的一樣）
  if (!incense && s.scene === 'home') return withSpot({ id: 'incense', text: '先到神明廳上香', why: `${left}。上香陰氣 +10，晚上照顧客人要用。`, spot: 'altar' }, ctx)

  // 5. 颱風要來：蠟燭
  if (specialOf(n) === 'typhoon' && !has(s, 'candle', 2)) return withSpot({ id: 'typhoon.candle', text: '颱風要來：去柑仔店買蠟燭', why: '晚上會停電，家裡至少要兩根蠟燭。', spot: 'ajiao' }, ctx)

  // 6. 去車站看今晚的客人（知道他們需要什麼）
  const guests = s.plan.parties.flatMap((p) => p.members)
  if (guests.length && !observedToday(s) && s.time < 20.5) return withSpot({ id: 'observe', text: '去車站看看今晚的客人', why: '出大門往西。看過的客人，晚上一靠近就知道他需要什麼。', spot: 'station_guest_0' }, ctx)

  // 7. 今天的事
  for (const r of s.meta.requests) {
    if (r.done) continue
    const def = requestById(r.id)
    if (!def) continue
    const spot = REQ_SPOT[r.id]?.(s)
    const gift = /送給/.test(def.where) ? '\n東西拿到了就走到他旁邊，選「送禮給……」。' : ''
    return withSpot({ id: `req.${r.id}`, text: `今天的事：${def.where}`, why: `${def.who}：「${def.text}」${gift}\n${left}。`, spot }, ctx)
  }

  // 8. 今晚客人會喜歡的好東西（還沒有、來得及去拿）
  if (!late && s.time < 20.75) {
    const want: { good: GoodId; who: string }[] = []
    if (s.plan.event === 'coldsnap') want.push({ good: 'quilt', who: '寒流' })
    if (s.plan.event === 'mosquitoes') want.push({ good: 'floral', who: '蚊子大軍' })
    for (const id of guests) {
      const d = GUESTS[id]
      if (d) for (const g of goodsLovedBy(d.type)) want.push({ good: g, who: d.name })
    }
    const ok = (g: GoodId) => {
      if (has(s, g)) return false
      if (g === 'icepop') return n >= 5
      if (g === 'banquet') return s.time >= 19.5
      return n >= 4 || !!s.flags.hint_seen_oldstreet
    }
    const pick = want.find((w) => ok(w.good))
    if (pick) {
      const G = INGREDIENTS[pick.good]
      return withSpot({ id: `good.${pick.good}`, text: `${pick.who}會喜歡${G.name}`, why: `去${GOODS[pick.good].where}拿。晚上從灶腳的菜櫥拿出來，放到床頭。\n${left}。`, spot: GOOD_SPOT[pick.good] }, ctx)
    }
  }

  // 9. 家裡沒菜了
  if (!canCook(s.meta.pantry as Record<string, number>) && !late)
    return withSpot({ id: 'pantry', text: '家裡沒菜了：去後院採菜', why: '半夜有人會餓。後院有蛋、地瓜葉；黃昏市場（村子南邊過橋）買得到肉和魚。', spot: 'garden_egg' }, ctx)

  // 10. 還沒上香（人在外面）
  if (!incense) return withSpot({ id: 'incense.away', text: '回家到神明廳上香', why: `${left}。上香陰氣 +10。`, spot: 'altar' }, ctx)

  // 11. 新地方（一天最多介紹一個）
  const intro = placeIntro(s)
  if (intro) return withSpot({ id: `place.${intro.id}`, text: intro.text, why: intro.why, spot: intro.id === 'hill' ? undefined : intro.spot, target: intro.id === 'hill' ? pt('hill', 0, 8) : undefined, place: intro.id }, ctx)

  // 12. 都做好了
  if (s.scene === 'home') return withSpot({ id: 'wait', text: '坐竹椅等天黑，或到處逛逛', why: `${left}。坐下就直接天黑、客人入住。`, spot: 'chair' }, ctx)
  return { id: 'free', text: left, why: '今天的事都做完了。到處逛逛，天黑前回家就好（22:00 會自動天黑）。' }
}

/** 今天可以介紹的新地方（已經介紹過今天的就只留那一個） */
export function placeIntro(s: HintState): PlaceIntro | null {
  const today = s.flags[`hint_day_${s.meta.night}`]
  for (const p of PLACE_INTROS) {
    if (s.flags[`hint_seen_${p.id}`]) continue
    if (s.meta.night < p.from || (p.when && !p.when(s))) continue
    // 今天已經介紹過別的地方：明天再說
    if (today && !s.flags[`hint_now_${p.id}`]) return null
    return p
  }
  return null
}

function nightHint(s: HintState, ctx: HintCtx): Hint | null {
  if (ctx.banner) return null
  const view = s.view ?? []
  const away = s.scene !== 'home'

  // 1. 手上端著東西：拿去床頭
  if (s.carrying || s.good) {
    const fix = s.good ? GOODS[s.good].fixes : (['hungry'] as NeedKind[])
    const g = view.find((v) => v.needs.some((x) => fix.includes(x.kind))) ?? view[0]
    const what = s.good ? INGREDIENTS[s.good].name : '宵夜'
    if (g) return { id: 'carry', text: `把${what}端到${ROOM_NAME[g.room]}床頭`, why: '走到床頭櫃旁邊，按住動作鍵放下。客人看著的時候別動。', target: pt('home', GUEST_ROOMS[g.room].nightstand[0], GUEST_ROOMS[g.room].nightstand[1]) }
  }

  // 2. 知道的需求：最急的那個
  let best: { g: (typeof view)[number]; kind: NeedKind } | null = null
  for (const g of view) for (const nd of g.needs) if (nd.known && (!best || URGENT[nd.kind] < URGENT[best.kind] || (g.awake && !best.g.awake && URGENT[nd.kind] === URGENT[best.kind]))) best = { g, kind: nd.kind }
  if (best) {
    const { g, kind } = best
    const owned = goodsFor(kind).filter((k) => has(s, k))
    const extra = owned.length ? `；菜櫥有${owned.map((k) => INGREDIENTS[k].name).join('、')}` : ''
    const text = `${ROOM_NAME[g.room]}的${g.name}${NEED_INFO[kind].label}`
    if (away) return { id: `home.need`, text: '家裡的客人需要妳：回家', why: `${text}。${NEED_DO[kind]}${extra}。`, target: pt('home', 0, 2.5) }
    return { id: `need.${g.id}.${kind}`, text, why: `${NEED_DO[kind]}${extra}。`, target: needSpot(g.room, kind) }
  }

  // 3. 醒著但還不知道要什麼
  const unknown = view.find((g) => g.awake && g.needs.some((x) => !x.known))
  if (unknown) {
    if (away) return { id: 'home.unknown', text: '家裡有客人醒著：回家看看', why: '靠近客人就看得到他需要什麼（別被看到）。', target: pt('home', 0, 2.5) }
    return { id: `unknown.${unknown.room}`, text: `${ROOM_NAME[unknown.room]}有人醒著：靠近看看`, why: '靠近客人就看得到他需要什麼。他看著妳的時候站著別動。', target: pt('home', GUEST_ROOMS[unknown.room].bedside[0], GUEST_ROOMS[unknown.room].bedside[1]) }
  }

  // 4. 大家都睡了：可以做的事
  if (away) return null
  const t = s.time
  if (t >= 23.9 && t < 24.6 && !s.flags.hint_seen_ghosttrain && s.flags.conductor_met)
    return withSpot({ id: 'place.ghosttrain', text: '半夜的鬼火車，可以坐一站', why: '12 點過後在車站上車，坐一站就回到家門口。家裡的客人要先顧好。', spot: 'station_board', place: 'ghosttrain' }, ctx)
  if (t >= 24 && t < 28.3 && !s.flags.hint_seen_market && s.meta.night >= 2)
    return { id: 'place.market', text: '午夜的鬼夜市開了', why: '土地公廟後面的小路（00:00–04:30）。用功德買法器、撈金魚。客人沒人顧，別待太久。', target: pt('market', 0, 7.6), place: 'market' }
  // 沒有箭頭：不用去哪裡
  return { id: 'calm', text: '大家都睡了', why: '可以坐竹椅打個盹（快轉一小時），或去鬼夜市、托夢給小翰。有人醒來會出現需求泡泡。' }
}

// ---------------------------------------------------------------------------
// 路線：目標在別的場景時，先走到哪個出口（出口、或會帶人過去的熱點）
// ---------------------------------------------------------------------------

/** 不是「出口」、是按了熱點才過去的地方 */
const LINKS: { from: SceneId; to: SceneId; spot: string; when?: (s: { meta: { night: number } }) => boolean }[] = [
  { from: 'station', to: 'sugar', spot: 'station_canetrain', when: (s) => s.meta.night >= 5 },
  { from: 'sugar', to: 'station', spot: 'sugar_back' },
  { from: 'harbor', to: 'lighthouse', spot: 'harbor_door' },
]

/**
 * 從 from 走到 to 的第一步：這個場景裡要走去的點（出口的中間，或熱點）。
 * 同一個場景、或走不到（例如鬼夜市還沒開），回傳 null。
 */
export function firstStep(from: SceneId, to: SceneId, s: { phase: string; time: number; meta: { night: number } }, spot: (id: string) => HintTarget | null): { x: number; z: number } | null {
  if (from === to) return null
  type Edge = { to: SceneId; x: number; z: number }
  const edges = (id: SceneId): Edge[] => {
    const out: Edge[] = []
    for (const e of SCENES[id].exits) {
      if (e.when && !e.when(s)) continue
      out.push({ to: e.to, x: (e.area.x0 + e.area.x1) / 2, z: (e.area.z0 + e.area.z1) / 2 })
    }
    for (const l of LINKS) {
      if (l.from !== id || (l.when && !l.when(s))) continue
      const p = spot(l.spot)
      if (p) out.push({ to: l.to, x: p.x, z: p.z })
    }
    return out
  }
  // BFS：記住每個場景是從起點的哪一個出口走來的
  const first = new Map<SceneId, { x: number; z: number }>()
  const queue: SceneId[] = []
  for (const e of edges(from)) {
    if (first.has(e.to)) continue
    first.set(e.to, { x: e.x, z: e.z })
    queue.push(e.to)
  }
  while (queue.length) {
    const cur = queue.shift()!
    if (cur === to) return first.get(cur)!
    for (const e of edges(cur)) {
      if (e.to === from || first.has(e.to)) continue
      first.set(e.to, first.get(cur)!)
      queue.push(e.to)
    }
  }
  return null
}

const inArea = (a: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1

/**
 * 箭頭現在要指的點（同場景：目標本身；別的場景：往那邊的出口）。
 * 目標在客房裡、阿嬤在外面：先指房門（走到門口再指門裡），不然箭頭會叫人穿牆。
 */
export function arrowPoint(
  h: Hint | null,
  s: { scene: SceneId; phase: string; time: number; meta: { night: number } },
  spot: (id: string) => HintTarget | null,
  at?: { x: number; z: number },
): { x: number; z: number } | null {
  if (!h?.target) return null
  const t = h.target.scene === s.scene ? { x: h.target.x, z: h.target.z } : firstStep(s.scene, h.target.scene, s, spot)
  if (t && s.scene === 'home' && at) return homeWaypoint(t, at)
  return t
}

/**
 * 三合院裡的房子、圍牆擋路：箭頭一段一段指。
 * 埕裡 ↔ 外面走大門；外面 ↔ 屋後（往後院的小路）繞房子西邊；進客房先走房門。
 */
function homeWaypoint(t: { x: number; z: number }, at: { x: number; z: number }): { x: number; z: number } {
  const inside = (p: { x: number; z: number }) => p.x > COMPOUND.x0 && p.x < COMPOUND.x1 && p.z > COMPOUND.z0 && p.z < FENCE.z
  const back = (p: { x: number; z: number }) => p.z < COMPOUND.z0
  const west = COMPOUND.x0 - 1.4
  const onWest = (p: { x: number; z: number }) => p.x <= west + 0.7
  const near = (p: { x: number; z: number }) => Math.hypot(p.x - at.x, p.z - at.z) < 0.8
  const gateIn = { x: 0, z: FENCE.z - 0.6 }
  const gateOut = { x: 0, z: FENCE.z + 1.2 }
  const frontWest = { x: west, z: FENCE.z + 1.4 }
  const backWest = { x: west, z: COMPOUND.z0 - 1.5 }

  if (inside(at)) {
    if (!inside(t)) {
      // 埕裡 → 外面：先到大門（在房子裡的話，箭頭先指大門，出了房門自然就對了）
      return near(gateIn) ? gateOut : gateIn
    }
    // 目標在客房、阿嬤在外面：先到房門外，再進門
    for (const R of Object.values(GUEST_ROOMS)) {
      const area = ROOMS[R.room].area
      if (!inArea(area, t.x, t.z) || inArea(area, at.x, at.z)) continue
      const out = { x: R.doorOut[0], z: R.doorOut[1] }
      return near(out) ? { x: R.doorIn[0], z: R.doorIn[1] } : out
    }
    return t
  }
  // 屋後 → 前面、埕裡：先到西北角，沿西邊走到西南角
  if (back(at) && !back(t)) return onWest(at) ? frontWest : backWest
  // 前面 → 屋後：先到西南角，沿西邊往北
  if (!back(at) && back(t)) return onWest(at) ? backWest : frontWest
  // 外面 → 埕裡：從大門進來
  if (inside(t)) {
    if (onWest(at) && at.z < FENCE.z) return frontWest
    return near(gateOut) ? gateIn : gateOut
  }
  return t
}

/** HUD 與箭頭共用：現在顯示的提示（HintHud 每 0.25 秒更新） */
export const hintNow: { current: Hint | null } = { current: null }
