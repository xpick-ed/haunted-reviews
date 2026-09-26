import LINES from '../../data/horror.lines.json'
import { DRESSER, FENCE, GUEST_ROOMS, KITCHEN_JAR, MAIN, WING_L } from '../../scene/layout'
import { adultOn } from '../../settings'
import { seeded } from '../rng'
import type { Meta } from './director'
import { GUESTS } from './guests'
import { route } from './nav'
import { planNight, type NightPlan } from './plan'
import type { GrandmaState, GuestRT, NightSim, SimPlugin } from './sim'
import type { GuestId, RoomId } from './types'

// 大人的恐怖（DESIGN §29，成人內容）：純邏輯（Node 可測）。director.ts 每晚呼叫 createHorror()，
// 回傳 null 表示今晚沒有。成人內容關著（adultOn()，Node 裡預設關）就永遠是 null。
// 畫面在 src/scene/HorrorLayer.tsx、HUD 在 src/ui/HorrorHud.tsx、互動點在 src/world/horrorStory.ts。
//
// 一晚最多一件（用第幾晚當種子，同一晚重玩一樣；化解過的就不會再來）：
//   冥婚    第 5 晚起、有大人男客（房裡沒有小孩）的晚上，大約四分之一。
//           傍晚大門外的路上有一個紅包（阿嬤撿不起來）；客人進門時撿走了。
//           00:15 他提起撿到紅包；00:30 鬼新娘從路上走進來，走到他的房門口敲門——只有他看得到她，越近越怕，
//           走到門口他會尖叫。阿嬤開陰陽眼跟她說話 → 她的心願是找回定情的玉簪 → 陰陽眼找到發光的玉簪
//           （灶腳的水缸或神明廳的供桌下）→ 還給她，她道謝、淡掉。03:00 還沒化解：客人嚇壞（驚嚇 +40）。
//   凶宅夜  第 6 晚起、客房二有客人（沒有小孩）的晚上，大約三成。客房二以前出過事（只用暗示）。
//           00:30 起床頭那面外牆裡一陣一陣地敲（會吵到、嚇到客房二的人）。陰陽眼看得到牆角的地縛靈；
//           三個只有陰陽眼看得到的線索（地磚下的日記、梳妝台抽屜的錄音帶、日曆後面的學生證）
//           找齊了再跟她說話：她在等媽媽說「不氣了」→ 阿嬤轉告 → 她走了，敲牆聲永遠停了。
//           04:30 還沒化解：敲牆聲自己停了，她還在（之後的晚上還會再來）。
//
// 畫面、HUD、互動點讀 horrorState.current（跟 night.sim 一樣放在模組變數）。

type XZ = [number, number]
type Line = { who: string; text: string }
const L = LINES as Record<string, Line>

export type HorrorKind = 'wedding' | 'haunt'
export type HorrorStatus = 'waiting' | 'active' | 'resolved' | 'failed'

export const HORROR_INFO: Record<HorrorKind, { title: string; icon: string }> = {
  wedding: { title: '鬼新娘找上門了', icon: '🧧' },
  haunt: { title: '客房二的敲牆聲', icon: '🚪' },
}

/** 化解過就記在 meta.story，之後不會再來（凶宅的敲牆聲永遠停了） */
export const HORROR_DONE: Record<HorrorKind, string> = { wedding: 'horror_bride_done', haunt: 'horror_haunt_done' }

/** 第幾晚起才有 */
export const HORROR_FROM: Record<HorrorKind, number> = { wedding: 5, haunt: 6 }

// ---------------------------------------------------------------------------
// 冥婚的位置與時間
// ---------------------------------------------------------------------------

/** 傍晚大門外路上的紅包 */
export const ENVELOPE = { x: -1.1, z: 9.8 }
/** 鬼新娘從路上來 */
const BRIDE_FROM: XZ = [1.6, 11.8]
const GATE_OUT: XZ = [0.2, FENCE.z + 1.0]
const GATE_IN: XZ = [0, FENCE.z - 0.35]

export const BRIDE_TIME = { pickup: 24.25, start: 24.5, deadline: 27 }
/** 走得很慢（公尺／秒） */
export const BRIDE_SPEED = 0.45

/** 可以當「新郎」的客人（傳統上冥婚的紅包是男人撿的；背包客優先，DESIGN §29） */
const BRIDE_TARGETS: GuestId[] = ['ahao', 'zhiwei', 'zhang', 'ajie', 'mrwang', 'zhiming']

export type PinSpot = 'jar' | 'altar'
/** 玉簪掉在哪裡：站的位置（熱點）、發光的位置（離地高度）、HUD 的名字 */
export const PIN_SPOTS: Record<PinSpot, { x: number; z: number; glow: { x: number; z: number; y: number }; name: string }> = {
  jar: { x: KITCHEN_JAR.x + 0.8, z: KITCHEN_JAR.z + 0.5, glow: { x: KITCHEN_JAR.x, z: KITCHEN_JAR.z, y: 0.62 }, name: '「有水的地方」——灶腳的水缸' },
  altar: { x: 0.7, z: MAIN.z0 + 2.0, glow: { x: 0.35, z: MAIN.z0 + 1.05, y: 0.1 }, name: '「拜拜的桌子下面」——神明廳的供桌' },
}

// ---------------------------------------------------------------------------
// 凶宅夜的位置與時間
// ---------------------------------------------------------------------------

export const HAUNT = {
  /** 地縛靈站的牆角（客房二靠灶腳那面牆的左邊） */
  spirit: { x: WING_L.x0 + 0.42, z: WING_L.split - 0.4 },
  /** 敲牆的地方：床頭那面外牆 */
  knock: { x: WING_L.x0 + 0.08, z: GUEST_ROOMS.r2.pillowZ },
  start: 24.5,
  /** 到這個時間還沒化解，敲牆聲自己停了 */
  end: 28.5,
}

export type ClueId = 'diary' | 'tape' | 'id'
export const CLUE_IDS: ClueId[] = ['diary', 'tape', 'id']
/** 三個線索：站的位置（熱點）、發光的位置（離地高度）、熱點文字、打開的對話 */
export const CLUES: Record<ClueId, { x: number; z: number; glow: { x: number; z: number; y: number }; label: string; dialogue: string }> = {
  diary: { x: WING_L.x1 - 0.55, z: 0.75, glow: { x: WING_L.x1 - 0.9, z: 1.0, y: 0.03 }, label: '掀開發光的地磚', dialogue: 'hor_clue_diary' },
  tape: { x: DRESSER.x + 0.8, z: DRESSER.z, glow: { x: DRESSER.x, z: DRESSER.z, y: 0.3 }, label: '打開梳妝台發光的抽屜', dialogue: 'hor_clue_tape' },
  id: { x: WING_L.x1 - 0.6, z: -1.05, glow: { x: WING_L.x1 - 0.75, z: WING_L.z0 + 0.2, y: 1.75 }, label: '看看日曆後面發光的東西', dialogue: 'hor_clue_id' },
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** 沿著點列走：回傳這一步之後的朝向；到點就從 path 拿掉 */
function walk(p: { x: number; z: number }, path: XZ[], speed: number, dt: number): number | null {
  let left = speed * dt
  let heading: number | null = null
  while (left > 0 && path.length) {
    const [tx, tz] = path[0]
    const dx = tx - p.x
    const dz = tz - p.z
    const d = Math.hypot(dx, dz)
    if (d < 1e-3) {
      path.shift()
      continue
    }
    const step = Math.min(d, left)
    p.x += (dx / d) * step
    p.z += (dz / d) * step
    heading = Math.atan2(dx, dz)
    left -= step
    if (step >= d) path.shift()
  }
  return heading
}

/** 把睡著的客人叫醒（跟 sim 的 wake 一樣，但不講「被吵醒」的話） */
function rouse(g: GuestRT) {
  if (g.awake) return
  g.awake = true
  g.sleep = 0
  g.resleepT = 30
}

const isChild = (id: GuestId) => GUESTS[id]?.type === 'child'

// ---------------------------------------------------------------------------
// 共用的外殼（跟 incidents.ts 的 Incident 一樣）
// ---------------------------------------------------------------------------

export abstract class HorrorEvent implements SimPlugin {
  abstract readonly kind: HorrorKind
  abstract readonly startAt: number
  status: HorrorStatus = 'waiting'
  /** 結果（HUD 顯示幾秒） */
  outcome = ''
  outcomeT = 0
  /** 顯形的程度 0..1（出現、離開時淡入淡出；畫面用） */
  alpha = 0
  gm: GrandmaState | null = null
  hour = 22
  protected sim: NightSim
  protected rnd: () => number

  constructor(sim: NightSim, rnd: () => number) {
    this.sim = sim
    this.rnd = rnd
  }

  /** 在 update 外面（熱點、對話的回呼）發的事件先排著，下一幀 update 再送（sim 每幀開頭會清掉事件） */
  private pending: { kind: string; data: unknown }[] = []
  private inUpdate = false

  update(dt: number, hour: number, gm: GrandmaState) {
    this.inUpdate = true
    for (const e of this.pending) this.sim.emitCustom(e.kind, e.data)
    this.pending = []
    this.gm = gm
    this.hour = hour
    if (this.outcomeT > 0) this.outcomeT = Math.max(0, this.outcomeT - dt)
    if (this.status === 'waiting' && hour >= this.startAt) this.begin()
    this.tick(dt, hour)
    this.inUpdate = false
  }

  get active() {
    return this.status === 'active'
  }

  /** HUD 上的提示（現在該做什麼）；vision：陰陽眼開著沒 */
  abstract hint(vision: boolean): string
  protected abstract begin(): void
  protected abstract tick(dt: number, hour: number): void

  protected post(kind: string, data: unknown) {
    if (this.inUpdate) this.sim.emitCustom(kind, data)
    else this.pending.push({ kind, data })
  }
  protected line(id: string) {
    this.post('line', { id })
  }
  protected sfx(name: HorrorSfx) {
    this.post('horror.sfx', { name })
  }
  protected finish(ok: boolean, text: string, merit = 0) {
    if (this.status === 'resolved' || this.status === 'failed') return
    this.status = ok ? 'resolved' : 'failed'
    this.outcome = text
    this.outcomeT = 7
    if (ok) this.post('horror.reward', { merit, story: HORROR_DONE[this.kind] })
    this.post('horror.end', { kind: this.kind, ok })
  }
  protected guest(id: GuestId) {
    return this.sim.guests.find((g) => g.id === id)
  }
  /** 評論附註：接在別的外掛寫的後面 */
  protected note(g: GuestRT, text: string) {
    const prev = this.sim.reviewNotes[g.id]
    this.sim.reviewNotes[g.id] = prev ? `${prev} ${text}` : text
  }
}

export type HorrorSfx = 'appear' | 'knock' | 'wallknock' | 'scream' | 'wail' | 'pickup'

// ---------------------------------------------------------------------------
// 冥婚
// ---------------------------------------------------------------------------

/** walk：從路上走向房門；door：在門口敲門；still：聽了心願，安安靜靜地等；leave：淡掉；gone：走了 */
export type BridePhase = 'wait' | 'walk' | 'door' | 'still' | 'leave' | 'gone'

export class GhostWedding extends HorrorEvent {
  readonly kind = 'wedding' as const
  readonly startAt = BRIDE_TIME.start
  readonly guestId: GuestId
  readonly room: RoomId
  readonly pinSpot: PinSpot
  x = BRIDE_FROM[0]
  z = BRIDE_FROM[1]
  heading = Math.PI
  speed = 0
  phase: BridePhase = 'wait'
  /** 聽過她的心願了（要找玉簪） */
  wish = false
  pinFound = false
  /** 被阿嬤兇過幾次 */
  scolded = 0
  /** 最後戴上玉簪了（畫面換長相） */
  pinned = false
  private path: XZ[] = []
  private said = false
  private screamed = false
  private begged = false
  private knockT = 0

  constructor(sim: NightSim, rnd: () => number, guestId: GuestId) {
    super(sim, rnd)
    this.guestId = guestId
    this.room = sim.guests.find((g) => g.id === guestId)?.room ?? 'r1'
    // 固定亂數的第一個值跟種子幾乎成正比，先丟掉一個
    rnd()
    this.pinSpot = rnd() < 0.5 ? 'jar' : 'altar'
  }

  get guestName() {
    return GUESTS[this.guestId]?.name ?? '客人'
  }

  /** 她要去的房門（門外） */
  get door(): XZ {
    return GUEST_ROOMS[this.room].doorOut
  }

  hint(vision: boolean) {
    if (!this.active) return ''
    if (this.pinFound) return '把玉簪拿去還給鬼新娘（陰陽眼）'
    if (this.wish) return `找她的玉簪：${PIN_SPOTS[this.pinSpot].name}（陰陽眼才看得到發光）`
    return vision ? '走到鬼新娘旁邊跟她說話（03:00 前）' : `${this.guestName}撿了路邊的冥婚紅包……開陰陽眼（V）看看是誰來了`
  }

  protected begin() {
    this.status = 'active'
    this.phase = 'walk'
    this.x = BRIDE_FROM[0]
    this.z = BRIDE_FROM[1]
    this.path = [GATE_OUT, GATE_IN, ...route('yardFront', `${this.room}_door_out`)]
    this.line('hor.bride.appear')
    this.sfx('appear')
  }

  protected tick(dt: number, hour: number) {
    // 撿到紅包的那句話（醒著才講；睡著的話，評論裡會提到）
    if (!this.said && hour >= BRIDE_TIME.pickup) {
      this.said = true
      if (this.guest(this.guestId)?.awake) this.line(`hor.pickup.${this.guestId}`)
    }
    if (this.phase === 'leave') {
      this.speed = 0
      this.alpha = Math.max(0, this.alpha - dt / 2.5)
      if (this.alpha <= 0) this.phase = 'gone'
      return
    }
    if (!this.active) return
    this.alpha = Math.min(1, this.alpha + dt / 2)
    const g = this.guest(this.guestId)

    if (this.phase === 'walk') {
      const h = walk(this, this.path, BRIDE_SPEED, dt)
      this.speed = h === null ? 0 : BRIDE_SPEED
      if (h !== null) this.heading = h
      if (!this.path.length) this.arrive(g)
    } else if (this.phase === 'door') {
      // 面對門，一陣一陣地敲
      const [ix, iz] = GUEST_ROOMS[this.room].doorIn
      this.heading = Math.atan2(ix - this.x, iz - this.z)
      this.knockT -= dt
      if (this.knockT <= 0) {
        this.knockT = 6 + this.rnd() * 3
        this.sfx('knock')
        this.sim.noise(this.door[0], this.door[1], 0.16)
      }
    }

    // 看得到她的只有撿了紅包的人：越近越怕。聽過心願以後她就安安靜靜地等，不再嚇人
    if (g && g.awake && !this.wish) {
      const d = dist(g.x, g.z, this.x, this.z)
      g.fear += dt * 0.5 * clamp01(1 - d / 7)
    }

    // 快到 03:00：她最後一次在門外求他開門
    if (!this.begged && hour >= BRIDE_TIME.deadline - 0.15) {
      this.begged = true
      this.line('hor.bride.fail')
    }
    if (hour >= BRIDE_TIME.deadline) this.fail(g)
  }

  /** 走到房門口：第一次到的時候，客人被敲門聲叫醒，看到門外的她尖叫 */
  private arrive(g: GuestRT | undefined) {
    this.speed = 0
    this.phase = this.wish ? 'still' : 'door'
    this.knockT = 2.5
    if (this.wish || this.screamed || !g) return
    this.screamed = true
    this.sfx('knock')
    rouse(g)
    g.fear += 12
    g.scaredT = Math.max(g.scaredT, 1.2)
    this.line(`hor.scream.${this.guestId}`)
    this.sfx('scream')
  }

  /** 對話：問了她想要什麼 → 她說出心願，停下來等 */
  learnWish() {
    if (!this.active || this.wish) return
    this.wish = true
    if (this.phase === 'walk' || this.phase === 'door') this.phase = 'still'
    this.path = []
    this.speed = 0
  }

  /** 對話：阿嬤兇她 → 她哭，哭聲飄進房間（客人更怕），繼續往前 */
  scold() {
    if (!this.active) return
    this.scolded++
    const g = this.guest(this.guestId)
    if (g) {
      rouse(g)
      g.fear += 8
    }
    this.sfx('wail')
    this.sim.noise(this.x, this.z, 0.22)
  }

  /** 陰陽眼找到玉簪 */
  takePin() {
    if (!this.active || !this.wish || this.pinFound) return false
    this.pinFound = true
    this.sfx('pickup')
    return true
  }

  /** 把玉簪還給她 → 化解 */
  givePin() {
    if (!this.active || !this.pinFound) return
    this.pinned = true
    this.phase = 'leave'
    this.finish(true, '鬼新娘戴上玉簪，慢慢地淡掉了', 3)
    const g = this.guest(this.guestId)
    if (!g) return
    g.fear = Math.max(0, g.fear - 15)
    g.comfort += 8
    this.note(g, '半夜好像有個穿紅衣服的女人，在門外輕輕說了聲謝謝……不知道為什麼，一點都不可怕，反而有點想哭。路邊撿的紅包，早上起來就不見了。')
  }

  private fail(g: GuestRT | undefined) {
    this.phase = 'leave'
    this.finish(false, '03:00 了，鬼新娘在門口站了一整晚')
    if (!g) return
    rouse(g)
    g.fear += 40
    g.scaredT = Math.max(g.scaredT, 1.6)
    this.line(`hor.scream.${this.guestId}`)
    this.sfx('scream')
    this.note(g, '半夜門口站著一個穿紅嫁衣的女人，一直敲門、一直敲門……我到現在還在發抖。那個紅包我不要了！')
  }
}

// ---------------------------------------------------------------------------
// 凶宅夜
// ---------------------------------------------------------------------------

export class HauntedRoom extends HorrorEvent {
  readonly kind = 'haunt' as const
  readonly startAt = HAUNT.start
  found = new Set<ClueId>()
  /** 跟她說過話了 */
  met = false
  /** 被阿嬤講重話的次數（她轉回去繼續敲） */
  rebuffed = 0
  /** 敲了幾次、上一次敲到現在幾秒（畫面顯示「咚」用） */
  knocks = 0
  knockAge = 99
  private knockT = 2

  hint(vision: boolean) {
    if (!this.active) return ''
    const n = this.found.size
    if (n >= CLUE_IDS.length) return '你想起她是誰了。回客房二跟她說話（陰陽眼）'
    if (!vision) return '客房二的牆裡有人在敲……開陰陽眼（V）看看'
    if (!this.met) return '客房二的牆角站著一個人。走過去跟她說話'
    return `找她留下的東西：陰陽眼裡發光的地方（${n}/${CLUE_IDS.length}）`
  }

  get ready() {
    return this.found.size >= CLUE_IDS.length
  }

  protected begin() {
    this.status = 'active'
    this.knockT = 2
  }

  protected tick(dt: number, hour: number) {
    this.knockAge += dt
    if (!this.active) {
      this.alpha = Math.max(0, this.alpha - dt / 3)
      return
    }
    this.alpha = Math.min(1, this.alpha + dt / 2)
    this.knockT -= dt
    if (this.knockT <= 0) {
      this.knockT = 7 + this.rnd() * 4
      this.knock()
    }
    if (hour >= HAUNT.end) this.fail()
  }

  /** 牆裡慢慢地敲三下：客房二的人聽得到（會怕、可能被吵醒） */
  private knock() {
    this.knocks++
    this.knockAge = 0
    this.sfx('wallknock')
    this.sim.noise(HAUNT.knock.x, HAUNT.knock.z, 0.32)
  }

  meet() {
    if (this.active) this.met = true
  }

  /** 找到一個線索；回傳 true 表示是新的 */
  find(c: ClueId) {
    if (!this.active || this.found.has(c)) return false
    this.found.add(c)
    return true
  }

  /** 講了重話：她轉回去，馬上又敲 */
  rebuff() {
    if (!this.active) return
    this.rebuffed++
    this.knockT = 0.6
  }

  /** 轉告媽媽的話 → 她走了，敲牆聲永遠停了 */
  free() {
    if (!this.active || !this.ready) return
    this.finish(true, '淑芬回家了。客房二的敲牆聲，再也沒有響過', 4)
    for (const g of this.sim.guests) {
      if (g.room !== 'r2') continue
      g.fear = Math.max(0, g.fear - 10)
      g.comfort += 10
      this.note(g, '半夜牆壁裡一直有人輕輕在敲，後來好像聽到一聲「謝謝」，房間就變得好暖，一覺到天亮。')
    }
  }

  private fail() {
    this.finish(false, '天快亮了，敲牆聲才停……她還在等')
    for (const g of this.sim.guests) {
      if (g.room !== 'r2' || this.knocks < 3) continue
      this.note(g, '半夜床頭的牆壁裡一直有人在敲，慢慢的，一下、一下……牆的另一邊明明是外面。')
    }
  }
}

export type HorrorRT = GhostWedding | HauntedRoom

// ---------------------------------------------------------------------------
// 今晚有沒有、是哪一件
// ---------------------------------------------------------------------------

export interface HorrorPick {
  kind: HorrorKind
  /** 冥婚：撿紅包的客人 */
  guest?: GuestId
}

/** 冥婚可以找上的客人（依優先順序）：房裡有小孩的不算 */
export function brideTargets(plan: NightPlan): GuestId[] {
  const out: GuestId[] = []
  for (const p of plan.parties) {
    if (p.members.some(isChild)) continue
    for (const id of p.members) if (BRIDE_TARGETS.includes(id) && L[`hor.pickup.${id}`] && L[`hor.scream.${id}`]) out.push(id)
  }
  return out.sort((a, b) => BRIDE_TARGETS.indexOf(a) - BRIDE_TARGETS.indexOf(b))
}

/**
 * 今晚是哪一件（不看成人內容開關；那個由 createHorror／horrorTonight 判斷）。
 * story：meta.story（化解過的不會再來）
 */
export function pickHorror(night: number, plan: NightPlan, story: string[]): HorrorPick | null {
  if (plan.event === 'miaogong') return null
  const r = seeded(night * 613 + 29)
  const a = r()
  const b = r()
  if (night >= HORROR_FROM.haunt && !story.includes(HORROR_DONE.haunt)) {
    const r2 = plan.parties.find((p) => p.room === 'r2')
    if (r2 && r2.members.length && !r2.members.some(isChild) && a < 0.3) return { kind: 'haunt' }
  }
  if (night >= HORROR_FROM.wedding && !story.includes(HORROR_DONE.wedding)) {
    const t = brideTargets(plan)
    if (t.length && b < 0.3) return { kind: 'wedding', guest: t[0] }
  }
  return null
}

export function makeHorror(sim: NightSim, pick: HorrorPick, seed: number): HorrorRT | null {
  const rnd = seeded(seed)
  if (pick.kind === 'haunt') return sim.guests.some((g) => g.room === 'r2') ? new HauntedRoom(sim, rnd) : null
  if (!pick.guest || !sim.guests.some((g) => g.id === pick.guest)) return null
  return new GhostWedding(sim, rnd, pick.guest)
}

let memo: { key: string; pick: HorrorPick | null } = { key: '', pick: null }

/**
 * 傍晚就要知道今晚有沒有（大門外的紅包）：跟 director 的 planFor 用一樣的方式算今晚的住客。
 * 成人內容關著就是 null。
 */
export function horrorTonight(meta: Pick<Meta, 'night' | 'warm' | 'spooky' | 'pressure' | 'story'>): HorrorPick | null {
  if (!adultOn()) return null
  const key = `${meta.night}|${meta.warm}|${meta.spooky}|${meta.pressure}|${meta.story.join(',')}`
  if (key !== memo.key) memo = { key, pick: pickHorror(meta.night, planNight(meta.night, meta.warm, meta.spooky, meta.pressure, { adult: true }), meta.story) }
  return memo.pick
}

/** 畫面、HUD、互動點讀這裡 */
export const horrorState: { current: HorrorRT | null } = { current: null }

export function createHorror(sim: NightSim, plan: NightPlan, meta: Meta): SimPlugin | null {
  horrorState.current = null
  if (!adultOn()) return null
  const pick = pickHorror(meta.night, plan, meta.story)
  const ev = pick ? makeHorror(sim, pick, meta.night * 53 + 11) : null
  horrorState.current = ev
  return ev
}

// ---------------------------------------------------------------------------
// 事件的處理（director 併進 CUSTOM_EVENTS；只在瀏覽器跑，所以用動態 import）
// ---------------------------------------------------------------------------

export const HORROR_EVENTS: Record<string, (data: unknown) => void> = {
  'horror.reward': (data) => {
    const { merit, story } = data as { merit: number; story?: string }
    void import('../../store').then(({ useStore }) => {
      const s = useStore.getState()
      const m = s.meta
      useStore.setState({
        meta: {
          ...m,
          merit: m.merit + (merit > 0 ? merit : 0),
          story: story && !m.story.includes(story) ? [...m.story, story] : m.story,
        },
      })
    })
  },
  'horror.sfx': (data) => {
    const { name } = data as { name: HorrorSfx }
    if (name === 'scream') void import('../../audio').then(({ audio }) => audio.scream())
    else if (name === 'appear') void import('../../audio').then(({ audio }) => audio.bassDrop())
    else if (name === 'wail') void import('../../audio').then(({ audio }) => audio.whoosh())
    else
      void import('../../audio/sfx').then(({ sfx }) => {
        if (name === 'pickup') sfx.play('pickup', { volume: 0.6 })
        else if (name === 'knock') sfx.play('knock', { volume: 0.45, rate: 0.85 })
        else {
          // 牆裡悶悶的三下，一下比一下慢
          for (const [i, delay] of [0, 0.55, 1.25].entries()) sfx.play('knock', { volume: 0.75 - i * 0.1, rate: 0.62, jitter: 0.02, delay })
        }
      })
  },
  'horror.end': (data) => {
    const { ok } = data as { ok: boolean }
    if (ok) void import('../../audio').then(({ audio }) => audio.chime())
  },
}
