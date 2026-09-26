import type { StoreApi } from 'zustand'
import { audio } from '../../audio'
import { sfx } from '../../audio/sfx'
import { BARKS, DIALOGUE_LINES, EVENT_BARKS, EXTRA_BARKS, GM_BARKS, HAN_BARKS, MIAOGONG_BARKS } from '../../data/barks'
import { voice } from '../../audio/voice'
import { LINES } from '../lines'
import { GUEST_ROOMS } from '../../scene/layout'
import { player } from '../player'
import { ACTION_DEFS, nightSpots, type NightCtx, type Option } from './actions'
import { GUESTS } from './guests'
import { MONTHLY_COST, NIGHTS_PER_MONTH, SKILLS, UPGRADES, planNight, type NightPlan, type UpgradeDef } from './plan'
import { NightSim, type DecorBonus, type SimEvent, type SimPlugin } from './sim'
import { rateGuest } from './rating'
import { STORY, endingAtDawn, endingAtMonthEnd, hanHeartBonus, type EndingId } from '../story'
import { createIncidents, incidentState, INCIDENT_EVENTS } from './incidents'
import { createEncounters, ENCOUNTER_EVENTS } from './encounters'
import { createCouples, COUPLE_EVENTS } from './couples'
import { createFamily, FAMILY_EVENTS } from './family'
import { createHorror, HORROR_EVENTS } from './horror'
import { chatDialogueFor, createSpecialNight, SPECIAL_EVENTS } from './special'
import { isGhostGuest } from './guests.ghost'
import { adultOn } from '../../settings'
import { GOOD_PERISHABLE, RECIPES, START_PANTRY, canCook, type Fortune, type GoodId, type Ingredient, type RecipeId, type RelicId } from './items'
import { HIDE_SPOTS } from './actions'
import { input } from '../input'
import { placePlayer } from '../player'
import type { MinigameId, CookResult, OuijaResult, SwatResult } from '../../ui/minigames/types'
import type { ActionId, GuestId, NeedKind, ObjectState, RoomId } from './types'

// 深夜導演：把 NightSim 接到遊戲狀態上（DESIGN §2–§13）。
// 負責：開夜、每幀推進模擬、把模擬事件變成語音字幕特效、執行阿嬤的動作、天亮結算、月結。

export interface Meta {
  /** 第幾晚（從 1 開始） */
  night: number
  money: number
  /** 溫馨名聲、靈異名聲 0..100 */
  warm: number
  spooky: number
  /** 孫子的心 0..100 */
  heart: number
  /** 廟公壓力：差評累積，3 以上他會來巡夜 */
  pressure: number
  skillPts: number
  skills: string[]
  upgrades: string[]
  /** 這個月到目前的收入 */
  monthIncome: number
  /** 被收驚過：下一晚陰氣上限 -30 */
  sealed: boolean
  /** 功德（鬼夜市的錢）：滿足需求、五星評論、夜市小遊戲 */
  merit: number
  /** 買到的法器（永久） */
  items: RelicId[]
  /** 食材與雜貨的數量 */
  pantry: Partial<Record<Ingredient, number>>
  /** 今天擲筊得到的運勢（天亮清掉） */
  fortune: Fortune | null
  /** 今天擲了幾次筊（一天三次） */
  jiaobei: number
  /** 收集到的回憶碎片（src/world/memories.ts 的 id） */
  memories: string[]
  /** 裝修民宿：擺好的家具擺飾（src/world/decor.ts） */
  decor: DecorPlacement[]
  /** 好感度 0–100（每 20 一顆心；src/world/bonds.ts） */
  bonds: Record<string, number>
  /** 玩過的 1958 關卡（src/world/past.ts） */
  pastDone: string[]
  /** 今天的事（src/world/requests.ts）：每天傍晚重新產生 */
  requests: { id: string; done: boolean }[]
  /** 主線：已經發生過的劇情（src/world/story.ts） */
  story: string[]
  /** 連續幾個月底存款是負的 */
  debtMonths: number
  /** 小翰感覺得到阿嬤還在的程度 0..100（src/world/han.ts，DESIGN §31.2） */
  hanSense: number
  /** 阿嬤給過小翰的「訊號」（已經做過的，id） */
  hanSigns: string[]
  /** 今天用在客人身上的店裡東西（DESIGN §31.1；天亮清掉） */
  specials: string[]
}

/** 一件擺好的家具擺飾 */
export interface DecorPlacement {
  /** 目錄裡的 id */
  item: string
  x: number
  z: number
  /** 轉幾度（弧度） */
  rot: number
  /** 擺在哪間客房（擺在埕、神明廳等公共空間是 null） */
  room: RoomId | null
}

export interface GuestView {
  id: GuestId
  name: string
  label: string
  room: RoomId
  awake: boolean
  mode: 'bed' | 'walk' | 'stand'
  needs: { kind: NeedKind; known: boolean }[]
  comfort: number
  fear: number
  suspicion: number
  observed: boolean
  seesGhost: boolean
}

export interface Challenge {
  id: string
  label: string
  done: boolean
  /** 已經確定失敗 */
  failed: boolean
}

export interface GuestReview {
  id: GuestId
  name: string
  stars: number
  text: string
  pay: number
}

export interface NightSummary {
  reviews: GuestReview[]
  income: number
  points: number
  challenges: Challenge[]
  warmDelta: number
  spookyDelta: number
  heartDelta: number
  pressureDelta: number
  stats: NightStats
  monthEnd: boolean
  /** 今晚得到的功德 */
  merit: number
}

export interface MonthReport {
  month: number
  income: number
  cost: number
  money: number
  warm: number
  spooky: number
  heart: number
  pressure: number
  offers: UpgradeDef[]
  line: string
  /** 這個月底小翰說出了期限（主線） */
  deadline?: boolean
  /** 連續幾個月負債 */
  debtMonths?: number
}

export interface NightStats {
  seen: number
  captures: number
  nearmiss: number
  woken: number
  mgCatches: number
  dashed: boolean
  dogCalmed: boolean
}

export interface PromptOpt {
  key: string
  label: string
  cost: number
  needed: boolean
  spot: string
  /** 深夜動作 */
  option?: Option
  /** 靜態互動點（傍晚的上香、竹椅等） */
  hotspot?: string
  /** 附身／躲藏時的特殊選項 */
  special?: 'meow' | 'woof' | 'chirp' | 'unpossess' | 'unhide'
}

/** 長按動作進行中（DESIGN §25.2）：按住才會前進，放開暫停，3 秒內回來可以接著做 */
export interface HoldState {
  opt: Option
  progress: number
  need: number
  /** 開始時站的位置：走開就取消 */
  at: [number, number]
  /** 最後一次按著的時間（performance.now） */
  heldAt: number
}

export interface NightSlice {
  meta: Meta
  plan: NightPlan
  view: GuestView[]
  carrying: boolean
  stats: NightStats
  challenges: Challenge[]
  summary: NightSummary | null
  month: MonthReport | null
  /** 傍晚顯示「今晚入住」卡片 */
  intro: boolean
  /** 開著的面板：技能樹、柑仔店、鬼夜市法器攤、回憶相簿 */
  panel: 'skills' | 'shop' | 'relics' | 'album' | 'settings' | null
  /** 慢動作（被看到的瞬間） */
  timeScale: number
  flickerUntil: Record<RoomId, number>
  /** 被看著（懷疑值最高的那個人）0..1，HUD 顯示 */
  watched: number
  hold: HoldState | null
  /** 附身在誰身上：阿咪（貓）、小黑（狗）、壁虎 */
  possess: 'cat' | 'dog' | 'gecko' | null
  /** 陰陽眼（鬼的視角）開著 */
  vision: boolean
  /** 念力模式：用手指拖房間裡的東西 */
  tk: boolean
  /** 正在看的結局（src/ui/EndingScreen.tsx） */
  ending: EndingId | null
  /** 躲在哪個躲藏點 */
  hidden: string | null
  /** 端著的宵夜（煮好的食譜與品質） */
  dish: { recipe: RecipeId; quality: number } | null
  /** 端著的店裡好東西（DESIGN §31.1） */
  good: GoodId | null

  nightBegin: () => void
  nightStep: (dt: number) => void
  runOption: (o: Option) => void
  finishNight: () => void
  closeSummary: () => void
  closeMonth: (upgrade: string | null) => void
  learnSkill: (id: string) => void
  setObject: (id: string, on: boolean) => void
  /** 結局看完：繼續經營（無盡模式）或重新開始 */
  finishEnding: (choice: 'continue' | 'restart') => void
  exitPossess: () => void
  exitHide: () => void
  meow: () => void
  /** 附身小黑：吠一聲 */
  woof: () => void
  /** 附身壁虎：嘖嘖叫 */
  chirp: () => void
  toggleVision: () => void
  toggleTK: () => void
  /**
   * 念力拖完一個東西（src/scene/Telekinesis.tsx 呼叫）：
   * kind 是拖的東西，room 是哪間客房（沒有就 null），speed 是拖的最快速度（公尺／秒，太快會有聲音）
   */
  tkApply: (kind: TKKind, room: RoomId | null, speed: number, at: [number, number]) => void
}

/** 念力可以拖的東西 */
export type TKKind = 'blanket' | 'ball' | 'window' | 'door' | 'item'

export const START_META = (): Meta => ({
  night: 1,
  money: 20000,
  warm: 20,
  spooky: 0,
  heart: 60,
  pressure: 0,
  skillPts: 1,
  skills: ['pat', 'flicker', 'freeze'],
  upgrades: [],
  monthIncome: 0,
  sealed: false,
  merit: 0,
  items: [],
  pantry: { ...START_PANTRY },
  fortune: null,
  jiaobei: 0,
  memories: [],
  decor: [],
  bonds: {},
  pastDone: [],
  requests: [],
  story: [],
  debtMonths: 0,
  hanSense: 0,
  hanSigns: [],
  specials: [],
})

/** 傍晚先在背景把今晚會用到的語音載好（不然每句第一次講都要等下載，字幕先出來聲音晚一拍） */
export function preloadNightVoices(plan: NightPlan, meta?: Meta) {
  const ids: string[] = []
  const add = (xs?: string[]) => xs && ids.push(...xs)
  const members = plan.parties.flatMap((p) => p.members)
  for (const id of members) for (const xs of Object.values(BARKS[id] ?? {})) add(xs)
  for (const xs of Object.values(GM_BARKS)) add(xs)
  if (plan.event === 'miaogong') for (const xs of Object.values(MIAOGONG_BARKS)) add(xs)
  else if (plan.event !== 'none') add(EVENT_BARKS[plan.event])
  if (members.includes('linmom')) add(EXTRA_BARKS['linmom.worry'])
  if (members.includes('xiaoyu')) add(DIALOGUE_LINES.xiaoyu_play)
  if (members.includes('agui')) add(DIALOGUE_LINES.agui_chat)
  if (plan.story === 'room2') add(HAN_BARKS.room2)
  // 特別的夜晚（颱風、中元鬼客人）的台詞
  if (plan.special) for (const id of Object.keys(LINES)) if (id.startsWith('sp.')) ids.push(id)
  // 學了托夢：今晚客人的夢裡會講的話
  if (meta?.skills.includes('dream')) {
    const who = [...members, 'gm', ...(members.includes('zhang') ? ['boss'] : [])]
    for (const id of Object.keys(LINES)) if (who.some((m) => id.startsWith(`dream.${m}.`))) ids.push(id)
  }
  void voice.preload(ids)
}

/** 某晚的住客組合（傍晚的入住卡片就要知道） */
export const planFor = (m: Meta) => planNight(m.night, m.warm, m.spooky, m.pressure, { adult: adultOn() })

export const EMPTY_STATS = (): NightStats => ({ seen: 0, captures: 0, nearmiss: 0, woken: 0, mgCatches: 0, dashed: false, dogCalmed: false })

/** 要長按的動作（慈祥、會發出一點聲音的小事） */
const HOLD_ACTIONS = new Set<ActionId>(['tuck', 'temp', 'water', 'coil', 'nightlight', 'window', 'pat', 'lullaby', 'deliver', 'retrieve', 'place'])

/**
 * NightSim 的外掛登記表（DESIGN §27.2）：每晚開始時呼叫，回傳 null 表示今晚沒有。
 * 突發事件（night/incidents.ts）、客人之間的故事（night/encounters.ts）在自己的模組裡 push 進來。
 */
export const SIM_PLUGINS: ((sim: NightSim, plan: NightPlan, meta: Meta) => SimPlugin | null)[] = [createIncidents, createEncounters, createCouples, createFamily, createHorror, createSpecialNight]

/** 外掛發出的自訂事件（SimEvent 的 t: 'custom'）的處理函式：kind → handler */
export const CUSTOM_EVENTS: Record<string, (data: unknown) => void> = { ...INCIDENT_EVENTS, ...ENCOUNTER_EVENTS, ...COUPLE_EVENTS, ...FAMILY_EVENTS, ...HORROR_EVENTS, ...SPECIAL_EVENTS }

/** 擺設換算成模擬用的加成（src/world/decor.ts 登記進來；還沒登記就沒有加成） */
export const decorHooks: { bonus: (decor: DecorPlacement[]) => DecorBonus | undefined } = { bonus: () => undefined }
const decorBonusFor = (decor: DecorPlacement[] | undefined) => decorHooks.bonus(decor ?? [])

/** 模擬本體放在模組變數（每幀會改的東西不放進 zustand） */
export const night: { sim: NightSim | null } = { sim: null }

const pick = <T,>(arr: T[] | undefined): T | undefined => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 依住客組出今晚的挑戰 */
function makeChallenges(plan: NightPlan, meta?: Meta): Challenge[] {
  const ids = plan.parties.flatMap((p) => p.members)
  const c: Challenge[] = []
  const add = (id: string, label: string) => c.push({ id, label, done: false, failed: false })
  if (ids.includes('akai')) add('capture2', '讓阿凱拍到 2 次靈異畫面')
  if (ids.includes('xiaoyu')) add('play', '陪小宇玩')
  if (ids.includes('agui')) add('chat', '跟阿桂、阿土伯聊聊')
  if (plan.event === 'dog' && !meta?.items.includes('bell')) add('dog', '安撫半夜亂叫的小黑')
  if (plan.event === 'miaogong') add('mg', '廟公巡夜時一次都沒被抓到')
  add('stealth', '整晚沒被（看不到鬼的）客人看到')
  if (c.length < 3) add('allneeds', '滿足每一個出現的需求')
  if (c.length < 3) add('nowake', '沒有人被吵醒')
  return c.slice(0, 3)
}

// ---------------------------------------------------------------------------
// 評論文字
// ---------------------------------------------------------------------------

function reviewText(id: GuestId, stars: number, seen: number, captures: number): string {
  const g = GUESTS[id]
  if (g.type === 'thrill') {
    if (captures >= 2) return '太神了！！拍到兩次，觀眾都瘋了。這間民宿是真的，大推！'
    if (captures === 1) return '有拍到一點點東西！雖然只有一次，但夠我剪一集了。'
    return '整晚什麼都沒有，房東說有東西根本騙人。一星。'
  }
  if (g.type === 'child') return stars >= 4 ? '（媽媽代寫）小宇說有一個阿嬤陪他玩，他從來沒睡得這麼好。' : '（媽媽代寫）小宇一直說要找阿嬤，我們有點擔心。'
  if (g.type === 'wanderer') return stars >= 4 ? '（志明代寫）爸說這裡跟他以前的家好像。' : '（志明代寫）爸半夜睡不太安穩。'
  if (g.type === 'elder') return stars >= 4 ? '阿春的家還是一樣舒服。半夜好像聞到菜脯蛋的味道。' : '人老了，睡不太好。不過這裡還是有家的感覺。'
  if (seen > 0) {
    if (stars <= 2) return '房間很乾淨，但半夜我看到一個阿嬤在房間裡……而且老闆說這裡只有他一個人。'
    return '半夜好像看到有人影，應該是我太累了。其他都很好。'
  }
  if (g.type === 'business') return stars >= 4 ? '安靜、好睡，明天開會精神很好。會再來。' : '晚上一直有怪聲，淺眠的人要注意。'
  if (g.type === 'backpacker') return stars >= 4 ? '半夜肚子餓，床頭竟然有熱騰騰的宵夜！？這什麼神仙民宿。' : '還行啦，便宜。半夜有點餓就是了。'
  if (stars >= 5) return '睡到一半覺得被子被拉好了，超暖。老闆人很好，雖然一直沒看到人。'
  if (stars >= 4) return '很舒服的老房子，睡得很好。'
  if (stars === 3) return '還可以，房間有點舊，但睡得意外地好。'
  return '有點冷、有蚊子，睡不太好。'
}

// ---------------------------------------------------------------------------
// 切片
// ---------------------------------------------------------------------------

type Api = StoreApi<NightSlice & HostState>

/** 導演需要的主 store 欄位 */
interface HostState {
  phase: 'dusk' | 'night' | 'dawn'
  time: number
  running: boolean
  yin: number
  scene: string
  busy: boolean
  horror: number
  warm: number
  objects: Record<string, ObjectState>
  roomLit: Record<RoomId, number>
  voice: boolean
  flags: Record<string, boolean>
  transitioning: boolean
  bark: (id: string, quiet?: boolean) => void
  say: (text: string) => void
  startDialogue: (id: string, onEnd?: () => void) => void
  dialogue: unknown
  minigame: unknown
  startMinigame: (id: MinigameId, params: unknown, onDone: (result: unknown) => void) => void
  enterDream: (guest: GuestId) => void
  save: () => void
  resetNight: () => void
  newGame: () => void
}

let lastBark = 0

export function yinMax(meta: Meta) {
  return 100 + (meta.skills.includes('yinmax') ? 30 : 0) + (meta.items?.includes('gourd') ? 20 : 0) - (meta.sealed ? 30 : 0)
}

export function createNightSlice(set: Api['setState'], get: Api['getState']): NightSlice {
  const guestBark = (who: GuestId, kind: string, quiet = false) => {
    const id = pick(BARKS[who]?.[kind as keyof (typeof BARKS)[GuestId]])
    if (!id) return
    const now = performance.now()
    // 太密的碎念會蓋掉重要的話：非重要台詞 1.4 秒內不重疊
    const important = kind === 'seen' || kind === 'capture' || kind.startsWith('need_')
    if (!important && now - lastBark < 1400) return
    lastBark = now
    get().bark(id, quiet)
  }
  const gmBark = (kind: keyof typeof GM_BARKS) => {
    const id = pick(GM_BARKS[kind])
    if (id) get().bark(id)
  }

  const handle = (e: SimEvent) => {
    const s = get()
    const stats = { ...s.stats }
    switch (e.t) {
      case 'bark':
        guestBark(e.who, e.kind, e.quiet)
        break
      case 'seen':
        stats.seen++
        set({ horror: 1, timeScale: 0.3 })
        audio.heartbeat()
        audio.bassDrop()
        window.setTimeout(() => gmBark('seen'), 1300)
        break
      case 'scream':
        audio.scream()
        break
      case 'happySeen':
        audio.chime()
        break
      case 'capture':
        stats.captures++
        sfx.play('pickup', { volume: 0.8 })
        set({ timeScale: 0.5 })
        window.setTimeout(() => gmBark('captured'), 1500)
        break
      case 'woken':
        stats.woken++
        break
      case 'nearmiss':
        stats.nearmiss++
        gmBark('nearmiss')
        sfx.play('whoosh', { volume: 0.3 })
        break
      case 'worry': {
        const id = pick(EXTRA_BARKS['linmom.worry'])
        if (id) get().bark(id)
        break
      }
      case 'mg': {
        const id = pick(MIAOGONG_BARKS[e.kind])
        if (id) get().bark(id)
        break
      }
      case 'mgCatch': {
        stats.mgCatches = e.count
        sfx.play('temple_bell')
        set({ horror: 0.7, yin: Math.max(0, s.yin - 25) })
        if (e.count >= 3) {
          set((x) => ({ meta: { ...x.meta, sealed: true } }))
          get().say('廟公收驚成功……阿嬤今晚動不了了。')
          set({ yin: 0 })
        }
        break
      }
      case 'dog':
        if (e.kind === 'start') {
          const id = pick(EVENT_BARKS.dog)
          if (id) get().bark(id)
        }
        if (e.kind === 'bark') audio.dogBark()
        if (e.kind === 'calm') stats.dogCalmed = true
        break
      case 'need':
      case 'asleep':
        break
      case 'custom':
        // 外掛的事件：'line' 是講一句台詞；其他交給登記的處理函式
        if (e.kind === 'line') get().bark((e.data as { id: string }).id)
        else CUSTOM_EVENTS[e.kind]?.(e.data)
        break
    }
    set({ stats })
  }

  const refreshView = () => {
    const sim = night.sim
    if (!sim) return
    const view: GuestView[] = sim.guests.map((g) => ({
      id: g.id,
      name: g.def.name,
      label: g.def.label,
      room: g.room,
      awake: g.awake,
      mode: g.mode,
      needs: g.needs.map((n) => ({ kind: n.kind, known: n.known })),
      comfort: Math.round(g.comfort),
      fear: Math.round(g.fear),
      suspicion: g.suspicion,
      observed: g.needs.some((n) => n.known) || Math.hypot(player.x - g.x, player.z - g.z) < 4.5,
      seesGhost: !!g.def.seesGhost,
    }))
    const watched = Math.max(0, ...sim.guests.map((g) => (g.def.seesGhost ? 0 : g.suspicion)), sim.miaogong?.suspicion ?? 0)
    set({ view, watched })
  }

  let viewT = 0

  const updateChallenges = () => {
    const s = get()
    const sim = night.sim
    if (!sim) return
    const ch = s.challenges.map((c) => {
      const d = { ...c }
      switch (c.id) {
        case 'capture2':
          d.done = sim.guests.some((g) => g.captures >= 2)
          break
        case 'play':
          d.done = sim.guests.some((g) => g.played)
          break
        case 'chat':
          d.done = sim.guests.some((g) => g.chatted)
          break
        case 'dog':
          d.done = s.stats.dogCalmed
          break
        case 'mg':
          d.failed = s.stats.mgCatches > 0
          d.done = !d.failed && !!sim.miaogong?.left
          break
        case 'stealth':
          d.failed = s.stats.seen > 0
          break
        case 'nowake':
          d.failed = s.stats.woken > 0
          break
        case 'allneeds':
          d.failed = s.time >= 29.8 && sim.guests.some((g) => g.needs.length > 0)
          break
      }
      return d
    })
    set({ challenges: ch })
  }

  /** 動作真正發生（長按完成、或一般動作的 0.38 秒後） */
  const performAction = (o: Option) => {
    const sim = night.sim
    if (!sim) return
    const def = ACTION_DEFS[o.action]
    const st = get()
    const room = o.room ?? null
    const soft = st.meta.skills.includes('softhands') && def.type === 'kind'
    // 做動作時被醒著的人看到（慈祥的動作被看到＝嚇到三倍）
    if (def.type === 'kind' && o.action !== 'cook') {
      if (!soft || Math.random() < 0.6) sim.actionSeen(o.x, o.z, room, true)
    }
    const pantry = { ...st.meta.pantry }
    const use = (k: Ingredient) => {
      if ((pantry[k] ?? 0) <= 0) return false
      pantry[k] = (pantry[k] ?? 0) - 1
      set((x) => ({ meta: { ...x.meta, pantry } }))
      return true
    }
    switch (o.action) {
      case 'tuck':
        sim.tuck(room!)
        sim.satisfy(room!, 'cold', def.comfort!)
        sfx.play('cloth', { volume: 0.8 })
        set({ warm: 1 })
        break
      case 'temp': {
        const onNow = !st.objects[`${room}.fan`]?.on
        get().setObject(`${room}.fan`, onNow)
        if (onNow) sim.satisfy(room!, 'hot', def.comfort!)
        break
      }
      case 'water':
        get().setObject(`${room}.cup`, true)
        sim.satisfy(room!, 'thirsty', def.comfort!)
        break
      case 'coil':
        if (!use('coil')) {
          get().bark('gm.nocoil')
          return
        }
        get().setObject(`${room}.coil`, true)
        sim.satisfy(room!, 'mosquito', def.comfort!)
        break
      case 'nightlight':
        get().setObject(`${room}.lamp`, true)
        if (!sim.blackout(st.time)) sim.satisfy(room!, 'dark', def.comfort!)
        // 停電：有蠟燭就點蠟燭，沒有的話只好點個小火光
        else sim.satisfy(room!, 'dark', def.comfort! * (use('candle') ? 1 : 0.6))
        break
      case 'window':
        get().setObject(`${room}.window`, true)
        sim.satisfy(room!, 'cold', def.comfort!)
        break
      case 'pat':
      case 'lullaby':
        sim.satisfy(room!, 'insomnia', def.comfort!)
        break
      case 'deliver': {
        const dish = st.dish ?? { recipe: 'porridge' as RecipeId, quality: 0.5 }
        const recipe = RECIPES.find((r) => r.id === dish.recipe)!
        const comfort = recipe.comfort * (0.6 + 0.6 * dish.quality)
        set({ carrying: false, dish: null })
        get().setObject(`${room}.dish`, true)
        const fed = sim.satisfy(room!, 'hungry', comfort)
        for (const g of sim.guests) {
          if (g.room !== room) continue
          if (recipe.likes.includes(g.def.type)) g.comfort += 15
          // 沒人餓也會醒來吃一點
          if (!fed && g.awake) g.comfort += comfort * 0.4
        }
        if (recipe.alsoCold) sim.satisfy(room!, 'cold', 8)
        break
      }
      case 'flicker':
        set((x) => ({ flickerUntil: { ...x.flickerUntil, [room!]: performance.now() + 1300 } }))
        sim.scare(room!, GUEST_ROOMS[room!].lamp[0], GUEST_ROOMS[room!].lamp[1], def.fear!, def.noise, st.meta.upgrades.includes('cctv'))
        sfx.play('switch', { volume: 0.6 })
        break
      case 'knock':
        sim.scare(room!, o.x, o.z, def.fear!, def.noise, st.meta.upgrades.includes('cctv'))
        sfx.play('knock', { volume: 0.9 })
        break
      case 'rocker':
        get().setObject('gm.rocker', true)
        sim.scare('gm', o.x, o.z, def.fear!, def.noise, st.meta.upgrades.includes('cctv'))
        sfx.play('creak', { volume: 0.9 })
        break
      case 'mirror':
        get().setObject('bath.mirror', true)
        sim.scare('bath', o.x, o.z, def.fear!, def.noise, st.meta.upgrades.includes('cctv'))
        break
      case 'radio':
        // 神明廳的收音機放老歌：兩間房的「睡不著」都解決；醒著的膽小客人聽到半夜的老歌會怕
        get().setObject('hall.radio', true)
        window.setTimeout(() => get().setObject('hall.radio', false), 20000)
        for (const r of ['r1', 'r2'] as RoomId[]) sim.satisfy(r, 'insomnia', def.comfort!)
        for (const g of sim.guests) if (g.awake && !g.def.seesGhost && g.def.type !== 'thrill') g.fear += g.def.type === 'timid' ? 8 : 3
        break
      case 'play':
        get().startDialogue('xiaoyu_play', () => sim.satisfy(room!, 'play', def.comfort!))
        break
      case 'chat': {
        // 中元鬼客人夜：跟鬼客人聊他們自己的事（night/special.ts）
        const ghost = chatDialogueFor(sim, room!)
        get().startDialogue(ghost ?? 'agui_chat', () => {
          sim.satisfy(room!, 'chat', def.comfort!)
          if (!ghost) set((x) => ({ flags: { ...x.flags, chat_agui: true } }))
        })
        break
      }
      case 'calm':
        sim.calmDog()
        audio.chime()
        break
      case 'retrieve':
        sim.satisfy(room!, 'lost', def.comfort!)
        get().bark('gm.retrieve', true)
        break
      case 'place': {
        // 店裡的好東西（DESIGN §31.1）：放下去才扣（半路天亮了東西還在菜櫥）
        const good = st.good
        set({ carrying: false, good: null })
        if (!good || !room) return
        if (!use(good)) return
        get().setObject(`${room}.good.${good}`, true)
        if (good === 'banquet') get().setObject(`${room}.dish`, true)
        const r = sim.useGood(room, good)
        set((x) => ({ meta: { ...x.meta, specials: [...x.meta.specials, `${good}@${room}`] } }))
        get().bark(r.loved.length ? `goods.loved.${good}` : r.fixed ? 'goods.placed' : 'goods.placed.quiet', true)
        break
      }
      case 'gift':
        if (!use('toy')) return
        sim.satisfy(room!, 'play', def.comfort!)
        for (const g of sim.guests) if (g.room === room && g.def.type === 'child') g.played = true
        get().bark('gm.gift')
        break
    }
    if (def.noise > 0 && def.type !== 'scare') sim.noise(o.x, o.z, def.noise * (soft ? 0.5 : 1))
    if (o.action !== 'play' && o.action !== 'chat' && o.action !== 'cook' && o.action !== 'place' && o.action !== 'fetch') gmBark(o.action as keyof typeof GM_BARKS)
    refreshView()
  }

  /** 每幀：長按動作的進度 */
  const stepHold = (dt: number) => {
    const s = get()
    const h = s.hold
    if (!h) return
    const now = performance.now()
    // 走開了就取消
    if (Math.hypot(player.x - h.at[0], player.z - h.at[1]) > 0.6) {
      set({ hold: null, busy: false })
      return
    }
    if (input.actionHeld && !s.dialogue && !s.minigame) {
      const progress = h.progress + dt
      if (progress >= h.need) {
        const cost = h.opt.cost
        if (s.yin < cost) {
          set({ hold: null, busy: false })
          gmBark('noyin')
          return
        }
        set({ hold: null, busy: false, yin: s.yin - cost })
        performAction(h.opt)
        return
      }
      set({ hold: { ...h, progress, heldAt: now }, busy: true })
    } else {
      if (s.busy) set({ busy: false })
      if (now - h.heldAt > 3000) set({ hold: null })
    }
  }

  return {
    meta: START_META(),
    plan: planNight(1, 20, 0, 0),
    view: [],
    carrying: false,
    stats: EMPTY_STATS(),
    challenges: [],
    summary: null,
    month: null,
    intro: false,
    panel: null,
    timeScale: 1,
    flickerUntil: { r1: 0, r2: 0 },
    watched: 0,
    hold: null,
    possess: null,
    hidden: null,
    dish: null,
    good: null,
    vision: false,
    tk: false,
    ending: null,

    setObject: (id, on) => set((s) => ({ objects: { ...s.objects, [id]: { on, at: performance.now() } } })),

    nightBegin: () => {
      const s = get()
      // 傍晚就排好的客人（成人內容開關傍晚才切，不會換掉已經在車站看過的客人）
      const plan = s.plan
      // 傍晚在小火車站觀察過的客人（旗標 observed_<id>_today）：需求一出現就看得到
      const observed = Object.keys(s.flags).filter((k) => s.flags[k] && k.startsWith('observed_') && k.endsWith('_today')).map((k) => k.slice(9, -6))
      night.sim = new NightSim(plan, { seed: s.meta.night * 131 + 7, upgrades: s.meta.upgrades, items: s.meta.items, fortune: s.meta.fortune, decor: decorBonusFor(s.meta.decor), observed })
      // 外掛：半夜突發事件、客人之間的故事（各自的模組決定今晚有沒有）
      for (const make of SIM_PLUGINS) {
        const p = make(night.sim, plan, s.meta)
        if (p) night.sim.plugins.push(p)
      }
      set({ plan, objects: {}, carrying: false, dish: null, good: null, hold: null, possess: null, hidden: null, stats: EMPTY_STATS(), challenges: makeChallenges(plan, s.meta), summary: null, flickerUntil: { r1: 0, r2: 0 } })
      // 擲筊擲到「陰氣充足」
      if (s.meta.fortune === 'yin') set({ yin: Math.min(yinMax(s.meta), s.yin + 30) })
      // 入住的第一句話
      night.sim.guests.forEach((g, i) => window.setTimeout(() => guestBark(g.id, 'arrive'), 2600 + i * 1900))
      if (plan.event !== 'none' && plan.event !== 'miaogong') {
        const lines = EVENT_BARKS[plan.event as keyof typeof EVENT_BARKS]
        const id = pick(lines)
        if (id) window.setTimeout(() => get().bark(id), 9000)
      }
      refreshView()
    },

    nightStep: (dt) => {
      const s = get()
      const sim = night.sim
      if (!sim || s.phase !== 'night') return
      // 慢動作回到正常
      if (s.timeScale < 1) set({ timeScale: Math.min(1, s.timeScale + dt * 1.1) })
      if (player.dashing && !s.stats.dashed) set({ stats: { ...s.stats, dashed: true } })
      stepHold(dt)
      if (s.vision) sim.revealNeeds()
      // 附身：每秒扣陰氣，扣完就被彈出來
      if (s.possess) {
        const yin = Math.max(0, get().yin - dt * 1.2)
        set({ yin })
        if (yin <= 0) get().exitPossess()
      }
      const events = sim.update(dt, s.time, {
        x: player.x,
        z: player.z,
        speed: player.speed,
        busy: get().busy,
        carrying: s.carrying,
        home: s.scene === 'home',
        walkFactor: (s.meta.skills.includes('ghoststep') ? 0.65 : 1) * (s.meta.items.includes('hat') ? 0.8 : 1),
        hidden: !!s.hidden,
        body: s.possess ?? undefined,
      }, s.objects)
      for (const e of events) handle(e)
      // 客房燈：模擬給的亮度 + 燈閃
      const base = sim.roomLit(s.time)
      const now = performance.now()
      const lit = { ...base }
      for (const r of ['r1', 'r2'] as RoomId[]) if (now < s.flickerUntil[r]) lit[r] = Math.random() < 0.5 ? 0.05 : 1
      // 突發事件：保險絲燒掉，兩間客房都暗了
      if (incidentState.blackout) lit.r1 = lit.r2 = 0.05
      set({ roomLit: lit })
      viewT -= dt
      if (viewT <= 0) {
        viewT = 0.2
        refreshView()
        updateChallenges()
      }
    },

    runOption: (o) => {
      const s = get()
      const sim = night.sim
      if (!sim || s.busy || s.hold) return
      const def = ACTION_DEFS[o.action]
      if (s.yin < o.cost) {
        gmBark('noyin')
        return
      }
      if (s.meta.sealed && get().stats.mgCatches >= 3) {
        get().say('被廟公收驚了，今晚動不了。')
        return
      }
      // 長按動作：按住才會前進（客人一轉頭就要放開）
      if (HOLD_ACTIONS.has(o.action)) {
        const soft = s.meta.skills.includes('softhands')
        set({ hold: { opt: o, progress: 0, need: def.busy * 1.3 * (soft ? 0.75 : 1), at: [player.x, player.z], heldAt: performance.now() }, busy: true })
        sfx.play('cloth', { volume: 0.35 })
        return
      }
      switch (o.action) {
        case 'fetch': {
          // 從菜櫥拿一樣好東西（端著走，飄在空中的東西會被看到）
          if (!o.good || s.carrying || (s.meta.pantry[o.good] ?? 0) <= 0) return
          set({ carrying: true, good: o.good })
          sfx.play('pickup', { volume: 0.4 })
          get().bark(`goods.fetch.${o.good}`, true)
          refreshView()
          return
        }
        case 'cook': {
          const recipes = RECIPES.filter((r) => canCook(r, s.meta.pantry)).map((r) => r.id)
          get().startMinigame('cook', { recipes }, (r) => {
            const res = r as CookResult
            if (!res) return
            const recipe = RECIPES.find((x) => x.id === res.recipe)!
            const pantry = { ...get().meta.pantry }
            for (const [k, n] of Object.entries(recipe.needs)) pantry[k as Ingredient] = Math.max(0, (pantry[k as Ingredient] ?? 0) - (n ?? 0))
            set((x) => ({ yin: Math.max(0, x.yin - o.cost), carrying: true, dish: { recipe: recipe.id, quality: res.quality }, meta: { ...x.meta, pantry } }))
            get().setObject('kitchen.stove', true)
            window.setTimeout(() => get().setObject('kitchen.stove', false), 6000)
            sim.noise(o.x, o.z, def.noise)
            get().bark(res.quality >= 0.5 ? 'gm.cooked.good' : 'gm.cooked.bad')
          })
          return
        }
        case 'swat': {
          // 看得到的人會看到蚊子被「空氣」拍死
          sim.actionSeen(o.x, o.z, o.room ?? null, true)
          get().startMinigame('swat', { count: 6, seconds: 8 }, (r) => {
            const res = (r as SwatResult | null) ?? { hits: 0, misses: 0 }
            if (res.hits >= 4) {
              sim.satisfy(o.room!, 'mosquito', def.comfort!)
              gmBark('swat')
            }
            if (res.misses > 0) sim.noise(o.x, o.z, Math.min(0.5, res.misses * 0.08))
            refreshView()
          })
          return
        }
        case 'ouija': {
          if (!o.guest) return
          const who = o.guest
          get().bark('gm.ouija', true)
          get().startMinigame('ouija', { guest: who }, (r) => {
            const res = r as OuijaResult
            if (!res) return
            set((x) => ({ yin: Math.max(0, x.yin - o.cost) }))
            sim.ouija(who, res)
            refreshView()
          })
          return
        }
        case 'dream':
          if (!o.guest) return
          set({ yin: s.yin - o.cost })
          gmBark('dream')
          get().enterDream(o.guest)
          return
        case 'possess': {
          // 附身誰：互動點的 id 就是動物（cat／dog／gecko）
          const body = o.spot === 'dog' ? 'dog' : o.spot === 'gecko' ? 'gecko' : 'cat'
          const at = body === 'dog' && sim.dog ? sim.dog : body === 'gecko' ? sim.gecko : sim.cat
          set({ yin: s.yin - o.cost, possess: body, prompt: null } as Partial<NightSlice>)
          placePlayer(at.x, at.z)
          audio.whoosh()
          if (body === 'cat') gmBark('possess')
          else get().bark(body === 'dog' ? 'gm.possess.dog' : 'gm.possess.gecko')
          return
        }
        case 'hide': {
          const spot = HIDE_SPOTS.find((h) => h.id === o.spot)
          if (!spot) return
          placePlayer(spot.x, spot.z)
          set({ hidden: spot.id } as Partial<NightSlice>)
          sfx.play('door_close', { volume: 0.4 })
          gmBark('hide')
          return
        }
      }
      set({ busy: true, yin: s.yin - o.cost })
      if (o.action !== 'play' && o.action !== 'chat') audio.whoosh()
      window.setTimeout(() => performAction(o), 380)
      window.setTimeout(() => set({ busy: false }), def.busy * 1000)
    },

    exitPossess: () => {
      const s = get()
      if (!s.possess) return
      // 壁虎可能停在牆裡：出來時站到最近的空地（碰撞會把人推出牆外）
      set({ possess: null } as Partial<NightSlice>)
      audio.whoosh()
    },

    woof: () => {
      night.sim?.woof()
      audio.dogBark()
    },

    chirp: () => {
      night.sim?.chirp()
      get().bark('gm.chirp', true)
      sfx.play('pickup', { volume: 0.2 })
    },

    exitHide: () => {
      const h = HIDE_SPOTS.find((x) => x.id === get().hidden)
      if (!h) return
      placePlayer(h.outX, h.outZ)
      set({ hidden: null } as Partial<NightSlice>)
      sfx.play('door_open', { volume: 0.4 })
    },

    meow: () => {
      night.sim?.meow()
      sfx.play('pickup', { volume: 0.25 })
    },

    toggleVision: () => {
      const on = !get().vision
      set({ vision: on } as Partial<NightSlice>)
      sfx.play(on ? 'whoosh' : 'ui_select', { volume: 0.3 })
    },

    toggleTK: () => {
      const s = get()
      if (!s.tk && !s.meta.skills.includes('telekinesis')) return
      set({ tk: !s.tk } as Partial<NightSlice>)
      sfx.play('ui_select', { volume: 0.4 })
    },

    tkApply: (kind, room, speed, at) => {
      const sim = night.sim
      if (!sim) return
      // 拖太快：東西刮地板、撞到東西的聲音
      if (speed > 1.2) sim.noise(at[0], at[1], Math.min(0.6, (speed - 1.2) * 0.25))
      switch (kind) {
        case 'blanket':
          if (room) {
            sim.tuck(room)
            sim.satisfy(room, 'cold', ACTION_DEFS.tuck.comfort!)
          }
          break
        case 'ball':
          if (room) sim.satisfy(room, 'play', ACTION_DEFS.play.comfort! * 0.8)
          break
        case 'window':
          if (room) {
            get().setObject(`${room}.window`, true)
            sim.satisfy(room, 'cold', ACTION_DEFS.window.comfort!)
          }
          break
        case 'item':
          if (room) sim.satisfy(room, 'lost', ACTION_DEFS.retrieve.comfort!)
          break
        case 'door':
          break
      }
      // 醒著的人看到東西自己在動：膽小的人會怕（看得到鬼的人覺得好玩）
      for (const g of sim.guests) {
        if (!g.awake || g.room !== room || g.def.seesGhost || g.def.type === 'thrill') continue
        if (sim.sees(g, at[0], at[1], room)) g.fear += g.def.type === 'timid' ? 10 : 5
      }
      refreshView()
    },

    finishNight: () => {
      const s = get()
      const sim = night.sim
      if (!sim) return
      const reviews: GuestReview[] = []
      let income = 0
      let warmD = 0
      let spookyD = 0
      let pressureD = 0
      let fives = 0
      for (const g of sim.guests) {
        const d = g.def
        const stars = rateGuest(g)
        const pay = d.pay * (stars >= 2 ? 1 : 0.5)
        income += pay
        if (stars === 5) fives++
        if (d.type === 'thrill') spookyD += (stars - 3) * 3 + g.captures * 2
        else warmD += (stars - 3) * 3
        if (stars <= 2 && d.type !== 'thrill' && !d.seesGhost) pressureD++
        if (stars === 5 && d.type !== 'thrill') pressureD--
        const base = g.dreamt && stars >= 4 && !d.seesGhost ? '昨晚做了一個好溫暖的夢，夢裡有個阿嬤陪著我。起來精神超好，好久沒睡這麼熟了。' : reviewText(g.id, stars, g.seen, g.captures)
        // 外掛（突發事件、客人之間的故事）寫的附註接在後面
        const note = sim.reviewNotes[g.id]
        // 福伯的評論是志明代寫的：外掛寫了就只用外掛的
        const text = note ? (d.type === 'wanderer' || isGhostGuest(g.id) ? note : `${base}${note}`) : base
        reviews.push({ id: g.id, name: d.name, stars, text, pay })
      }
      const challenges = s.challenges.map((c) => {
        if (c.failed) return c
        if (['stealth', 'nowake', 'allneeds'].includes(c.id)) {
          const done = c.id === 'allneeds' ? sim.guests.every((g) => g.needs.length === 0) : true
          return { ...c, done }
        }
        return c
      })
      const doneCount = challenges.filter((c) => c.done).length
      const points = 1 + fives + (doneCount >= 2 ? 1 : 0)
      const avg = reviews.reduce((a, r) => a + r.stars, 0) / Math.max(1, reviews.length)
      const heartBase = avg >= 4 ? 3 : avg <= 2 ? -5 : 0
      // 小翰感覺得到阿嬤以後，好的晚上心多暖一點（DESIGN §31.2）
      const heartD = heartBase + hanHeartBonus(s.meta.hanSense, heartBase)
      // 擲筊擲到「財神到」：小費加倍
      const tip = doneCount * 300 * (s.meta.fortune === 'luck' ? 2 : 1)
      // 功德：每滿足一個需求 +1、每則五星 +2
      const merit = sim.guests.reduce((a, g) => a + g.met.length, 0) + fives * 2
      const monthEnd = s.meta.night % NIGHTS_PER_MONTH === 0
      // 廟公來過（不管有沒有被收驚），壓力歸零
      const pressure = s.plan.event === 'miaogong' ? 0 : Math.max(0, s.meta.pressure + pressureD)
      set({
        summary: {
          reviews,
          income: income + tip,
          points,
          challenges,
          warmDelta: warmD,
          spookyDelta: spookyD,
          heartDelta: heartD,
          pressureDelta: pressure - s.meta.pressure,
          stats: s.stats,
          monthEnd,
          merit,
        },
        challenges,
        meta: {
          ...s.meta,
          money: s.meta.money + income + tip,
          monthIncome: s.meta.monthIncome + income + tip,
          warm: clamp(s.meta.warm + warmD, 0, 100),
          spooky: clamp(s.meta.spooky + spookyD, 0, 100),
          heart: clamp(s.meta.heart + heartD - (s.stats.mgCatches >= 3 ? 10 : 0), 0, 100),
          pressure,
          skillPts: s.meta.skillPts + points,
          sealed: s.stats.mgCatches >= 3,
          merit: s.meta.merit + merit,
          fortune: null,
          specials: [],
          // 辦桌菜尾放不過夜
          pantry: { ...s.meta.pantry, ...Object.fromEntries(GOOD_PERISHABLE.map((k) => [k, 0])) },
        },
      })
    },

    closeSummary: () => {
      const s = get()
      if (s.summary?.monthEnd) {
        const month = Math.floor((s.meta.night - 1) / NIGHTS_PER_MONTH)
        const money = s.meta.money - MONTHLY_COST
        const offers = UPGRADES.filter((u) => !s.meta.upgrades.includes(u.id))
        // 主線（DESIGN §28.3）：第 8 晚月底小翰說出期限；連續負債記下來
        const deadline = s.meta.night === STORY.deadline.night && !s.meta.story.includes('deadline')
        const lineId = deadline ? 'story.deadline' : (pick(money < 5000 ? HAN_BARKS.broke : s.meta.heart >= 60 ? HAN_BARKS.good : HAN_BARKS.monthEnd) ?? '')
        const debtMonths = money < 0 ? s.meta.debtMonths + 1 : 0
        const story = deadline ? [...s.meta.story, 'deadline'] : s.meta.story
        set({
          summary: null,
          month: { month, income: s.meta.monthIncome, cost: MONTHLY_COST, money, warm: s.meta.warm, spooky: s.meta.spooky, heart: s.meta.heart, pressure: s.meta.pressure, offers, line: lineId, deadline, debtMonths },
          meta: { ...s.meta, money, monthIncome: 0, debtMonths, story },
        })
        if (lineId) window.setTimeout(() => get().bark(lineId), 600)
        return
      }
      // 小翰的心歸零：他撐不下去了
      const end = endingAtDawn(s.meta)
      if (end) {
        set({ summary: null, ending: end } as Partial<NightSlice>)
        return
      }
      set({ summary: null, meta: { ...s.meta, night: s.meta.night + 1 } })
      get().resetNight()
    },

    closeMonth: (upgrade) => {
      const s = get()
      const u = UPGRADES.find((x) => x.id === upgrade)
      const meta = { ...s.meta, night: s.meta.night + 1 }
      if (u && meta.money >= u.cost) {
        meta.money -= u.cost
        meta.upgrades = [...meta.upgrades, u.id]
      }
      // 連兩個月負債、或第 12 晚小翰做決定 → 結局
      const end = endingAtMonthEnd({ ...meta, night: s.meta.night })
      if (end) {
        set({ month: null, meta, ending: end } as Partial<NightSlice>)
        return
      }
      set({ month: null, meta })
      get().resetNight()
    },

    finishEnding: (choice) => {
      const s = get()
      const end = s.ending
      if (!end) return
      const meta = { ...s.meta, story: [...s.meta.story, `ended_${end}`] }
      set({ ending: null, meta } as Partial<NightSlice>)
      if (choice === 'restart') get().newGame()
      else get().resetNight()
    },

    learnSkill: (id) => {
      const s = get()
      const k = SKILLS.find((x) => x.id === id)
      if (!k || s.meta.skills.includes(id) || s.meta.skillPts < k.cost) return
      if (k.requires && !s.meta.skills.includes(k.requires)) return
      sfx.play('ui_confirm')
      set({ meta: { ...s.meta, skillPts: s.meta.skillPts - k.cost, skills: [...s.meta.skills, id] } })
    },
  }
}

/** 目前阿嬤身邊能做的深夜動作（World 每幀呼叫） */
export function nightOptions(ctx: Omit<NightCtx, 'yinCost'>, px: number, pz: number): Option[] {
  const out: (Option & { d: number })[] = []
  const full: NightCtx = { ...ctx, yinCost: (a: ActionId) => (a === 'calm' ? 0 : ACTION_DEFS[a].yin) }
  for (const spot of nightSpots(full)) {
    const d = Math.hypot(spot.x - px, spot.z - pz)
    if (d > spot.r) continue
    for (const o of spot.options()) out.push({ ...o, d })
  }
  out.sort((a, b) => Number(b.needed) - Number(a.needed) || a.d - b.d)
  return out
}
