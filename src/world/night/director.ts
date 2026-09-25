import type { StoreApi } from 'zustand'
import { audio } from '../../audio'
import { sfx } from '../../audio/sfx'
import { BARKS, EVENT_BARKS, EXTRA_BARKS, GM_BARKS, HAN_BARKS, MIAOGONG_BARKS } from '../../data/barks'
import { GUEST_ROOMS } from '../../scene/layout'
import { player } from '../player'
import { ACTION_DEFS, nightSpots, type NightCtx, type Option } from './actions'
import { GUESTS } from './guests'
import { MONTHLY_COST, NIGHTS_PER_MONTH, SKILLS, UPGRADES, planNight, type NightPlan, type UpgradeDef } from './plan'
import { NightSim, type SimEvent } from './sim'
import { rateGuest } from './rating'
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
  panel: 'skills' | null
  /** 慢動作（被看到的瞬間） */
  timeScale: number
  flickerUntil: Record<RoomId, number>
  /** 被看著（懷疑值最高的那個人）0..1，HUD 顯示 */
  watched: number

  nightBegin: () => void
  nightStep: (dt: number) => void
  runOption: (o: Option) => void
  finishNight: () => void
  closeSummary: () => void
  closeMonth: (upgrade: string | null) => void
  learnSkill: (id: string) => void
  setObject: (id: string, on: boolean) => void
}

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
})

/** 某晚的住客組合（傍晚的入住卡片就要知道） */
export const planFor = (m: Meta) => planNight(m.night, m.warm, m.spooky, m.pressure)

export const EMPTY_STATS = (): NightStats => ({ seen: 0, captures: 0, nearmiss: 0, woken: 0, mgCatches: 0, dashed: false, dogCalmed: false })

/** 模擬本體放在模組變數（每幀會改的東西不放進 zustand） */
export const night: { sim: NightSim | null } = { sim: null }

const pick = <T,>(arr: T[] | undefined): T | undefined => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 依住客組出今晚的挑戰 */
function makeChallenges(plan: NightPlan): Challenge[] {
  const ids = plan.parties.flatMap((p) => p.members)
  const c: Challenge[] = []
  const add = (id: string, label: string) => c.push({ id, label, done: false, failed: false })
  if (ids.includes('akai')) add('capture2', '讓阿凱拍到 2 次靈異畫面')
  if (ids.includes('xiaoyu')) add('play', '陪小宇玩')
  if (ids.includes('agui')) add('chat', '跟阿桂、阿土伯聊聊')
  if (plan.event === 'dog') add('dog', '安撫半夜亂叫的小黑')
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
  save: () => void
  resetNight: () => void
}

let lastBark = 0

export function yinMax(meta: Meta) {
  return 100 + (meta.skills.includes('yinmax') ? 30 : 0) - (meta.sealed ? 30 : 0)
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

    setObject: (id, on) => set((s) => ({ objects: { ...s.objects, [id]: { on, at: performance.now() } } })),

    nightBegin: () => {
      const s = get()
      const plan = planFor(s.meta)
      night.sim = new NightSim(plan, { seed: s.meta.night * 131 + 7, upgrades: s.meta.upgrades })
      set({ plan, objects: {}, carrying: false, stats: EMPTY_STATS(), challenges: makeChallenges(plan), summary: null, flickerUntil: { r1: 0, r2: 0 } })
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
      const events = sim.update(dt, s.time, {
        x: player.x,
        z: player.z,
        speed: player.speed,
        busy: s.busy,
        carrying: s.carrying,
        home: s.scene === 'home',
        walkFactor: s.meta.skills.includes('ghoststep') ? 0.65 : 1,
      }, s.objects)
      for (const e of events) handle(e)
      // 客房燈：模擬給的亮度 + 燈閃
      const base = sim.roomLit(s.time)
      const now = performance.now()
      const lit = { ...base }
      for (const r of ['r1', 'r2'] as RoomId[]) if (now < s.flickerUntil[r]) lit[r] = Math.random() < 0.5 ? 0.05 : 1
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
      if (!sim || s.busy) return
      const def = ACTION_DEFS[o.action]
      if (s.yin < o.cost) {
        gmBark('noyin')
        return
      }
      if (s.meta.sealed && (get().stats.mgCatches >= 3)) {
        get().say('被廟公收驚了，今晚動不了。')
        return
      }
      set({ busy: true, yin: s.yin - o.cost })
      if (o.action !== 'play' && o.action !== 'chat') audio.whoosh()
      const soft = s.meta.skills.includes('softhands') && def.type === 'kind'
      const act = () => {
        const st = get()
        const room = o.room ?? null
        // 做動作時被醒著的人看到（慈祥的動作被看到＝嚇到三倍）
        if (def.type === 'kind' && o.action !== 'cook') {
          if (!soft || Math.random() < 0.6) sim.actionSeen(o.x, o.z, room, true)
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
            get().setObject(`${room}.coil`, true)
            sim.satisfy(room!, 'mosquito', def.comfort!)
            break
          case 'nightlight':
            get().setObject(`${room}.lamp`, true)
            if (!sim.blackout(st.time)) sim.satisfy(room!, 'dark', def.comfort!)
            else sim.satisfy(room!, 'dark', def.comfort! * 0.6) // 停電：點蠟燭
            break
          case 'window':
            get().setObject(`${room}.window`, true)
            sim.satisfy(room!, 'cold', def.comfort!)
            break
          case 'pat':
          case 'lullaby':
            sim.satisfy(room!, 'insomnia', def.comfort!)
            break
          case 'cook':
            get().setObject('kitchen.stove', true)
            window.setTimeout(() => get().setObject('kitchen.stove', false), 6000)
            set({ carrying: true })
            gmBark('carry')
            break
          case 'deliver':
            set({ carrying: false })
            get().setObject(`${room}.dish`, true)
            sim.satisfy(room!, 'hungry', def.comfort!)
            break
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
          case 'play':
            get().startDialogue('xiaoyu_play', () => sim.satisfy(room!, 'play', def.comfort!))
            break
          case 'chat':
            get().startDialogue('agui_chat', () => {
              sim.satisfy(room!, 'chat', def.comfort!)
              set((x) => ({ flags: { ...x.flags, chat_agui: true } }))
            })
            break
          case 'calm':
            sim.calmDog()
            audio.chime()
            break
        }
        if (def.noise > 0 && def.type !== 'scare') sim.noise(o.x, o.z, def.noise * (soft ? 0.5 : 1))
        if (o.action !== 'play' && o.action !== 'chat' && o.action !== 'cook') gmBark(o.action as keyof typeof GM_BARKS)
        refreshView()
      }
      window.setTimeout(act, 380)
      window.setTimeout(() => set({ busy: false }), def.busy * 1000)
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
        reviews.push({ id: g.id, name: d.name, stars, text: reviewText(g.id, stars, g.seen, g.captures), pay })
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
      const heartD = avg >= 4 ? 3 : avg <= 2 ? -5 : 0
      const tip = doneCount * 300
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
        },
      })
    },

    closeSummary: () => {
      const s = get()
      if (s.summary?.monthEnd) {
        const month = Math.floor((s.meta.night - 1) / NIGHTS_PER_MONTH)
        const money = s.meta.money - MONTHLY_COST
        const offers = UPGRADES.filter((u) => !s.meta.upgrades.includes(u.id))
        const lineId = pick(money < 5000 ? HAN_BARKS.broke : s.meta.heart >= 60 ? HAN_BARKS.good : HAN_BARKS.monthEnd) ?? ''
        set({
          summary: null,
          month: { month, income: s.meta.monthIncome, cost: MONTHLY_COST, money, warm: s.meta.warm, spooky: s.meta.spooky, heart: s.meta.heart, pressure: s.meta.pressure, offers, line: lineId },
          meta: { ...s.meta, money, monthIncome: 0 },
        })
        if (lineId) window.setTimeout(() => get().bark(lineId), 600)
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
      set({ month: null, meta })
      get().resetNight()
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
