import { GUEST_ROOMS, GUEST_WINDOW_IN_Z, MAIN, SINK, WING_R } from '../../scene/layout'
import { BARKS } from '../../data/barks'
import { seeded } from '../rng'
import { specialOf, type NightPlan, type SpecialNight } from './plan'
import type { Meta } from './director'
import { NODES } from './nav'
import { canSee, type GrandmaState, type GuestRT, type NightSim, type SimPlugin } from './sim'
import { GHOST_GUEST_IDS, isGhostGuest } from './guests.ghost'
import type { BarkKind, GuestId, RoomId } from './types'

// 特別的夜晚（DESIGN §31.3）：一個月大概一次，打破重複感。純邏輯（Node 測試可以跑），不能 import store／audio。
// 哪幾晚在 plan.ts 的 specialOf()；互動點在 src/world/specialStory.ts；畫面在 src/scene/SpecialLayer.tsx；HUD 在 src/ui/SpecialHud.tsx。
//
//   颱風夜（第 5、11、23、35……晚）
//     傍晚  小翰釘窗戶、HUD 提醒去柑仔店買蠟燭（停電要用）
//     23:00 客房一朝埕的窗板被風吹得一直拍（很吵）→ 到埕裡把它扣好
//     23:25 起  屋頂漏水：客房一、客房二、再一次客房一，02:10 神明廳 → 放水桶接（在醒著的客人面前放＝水桶自己飄過去）
//     00:00–02:00  停電（沿用 plan.event 'blackout'：小夜燈要點蠟燭、怕黑的人會怕）
//     整晚  打雷（大概 30 秒一次）：醒著的人會怕（不會把人吵醒）
//     02:00 一陣大風掀掉瓦片：大家（醒著的、睡著的都被吵起來）擠到神明廳躲一個多小時。
//           神明桌上的兩根蠟燭會被風吹熄 → 趁大家不注意重新點（有人面向神明在拜拜，很難）；躲在阿嬤房間門後哼歌可以安撫大家。
//     05:25 風停了：漏水接得好、蠟燭顧得好 → 每個人舒適 +12、評論寫「颱風夜大家擠在神明廳……」、溫馨名聲 +6
//
//   中元鬼客人夜（中元普渡：第 8、20、32……晚）
//     客房二住兩位好兄弟（看得到阿嬤、不怕她；付冥紙，天亮換成功德），客房一是一位一個人來、容易被嚇到的活人。
//     好兄弟半夜會出門走走（去神明廳拜拜、洗臉、看月亮、唱戲、站衛兵）；出門前會先講一聲 → 到客房二門口請他們小心：
//     答應的好兄弟會等活人睡了才出門，出門以後有活人走過來也會把自己藏起來。
//     活人看到在屋裡走動的好兄弟會被嚇到（跟看到阿嬤一樣要一點時間）；貓叫、壁虎叫可以把人引開。
//     秋月在埕裡唱戲很大聲：去當她的觀眾，她就唱小聲一點（她也開心）。神明廳可以幫好兄弟點一炷香。

type XZ = [number, number]
const HOURS_PER_SEC = 1 / 37.5
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// ---------------------------------------------------------------------------
// 位置與時間
// ---------------------------------------------------------------------------

/** 客房一朝埕那面牆上的窗（颱風夜被吹得一直拍的窗板）；阿嬤站在埕裡扣 */
export const SHUTTER = { x: WING_R.x0, z: GUEST_WINDOW_IN_Z, stand: [WING_R.x0 - 0.7, GUEST_WINDOW_IN_Z] as XZ }
/** 神明廳八仙桌上的兩根紅蠟燭（颱風夜大家躲進來時小翰點的） */
// stand：貼著八仙桌前緣站的地方（比神明廳「上香」的點更靠桌子，走到桌前時選項第一個就是點蠟燭，不用在慌亂中按 Q 換）
export const CANDLES = { x: 0, z: MAIN.z0 + 1.87, y: 1.28, stand: [0, MAIN.z0 + 2.7] as XZ }
/** 躲在阿嬤房間的側門後面哼歌（隔著門，大家聽得到、看不太到） */
export const HUM_SPOT: XZ = [NODES.gm_door[0] - 0.15, NODES.gm_door[1]]
/** 大家擠在神明廳站的位置：偶數號面向門外看風雨，奇數號面向神明拜拜 */
const HALL_SPOTS: XZ[] = [
  [-0.9, -4.35],
  [0.9, -4.45],
  [-0.45, -5.15],
  [0.55, -5.2],
  [-1.35, -4.95],
  [1.35, -4.9],
]
const LOOK_OUT: XZ = [0, MAIN.z1 + 2.5]
const LOOK_ALTAR: XZ = [0, MAIN.z0 + 0.6]
const SINK_LOOK: XZ = [SINK.x + 1, SINK.z]

export const TYPHOON = {
  /** 風開始變大（HUD、畫面） */
  windAt: 22.0,
  shutterAt: 23.0,
  /** 漏水：哪一間、幾點 */
  leaks: [
    { room: 'r1', at: 23.42 },
    { room: 'r2', at: 24.25 },
    { room: 'r1', at: 25.15 },
    { room: 'hall', at: 26.18 },
  ] as { room: RoomId | 'hall'; at: number }[],
  /** 大風掀瓦：大家到神明廳躲 */
  gustAt: 26.0,
  /** 在神明廳待多久（秒） */
  gatherWait: 44,
  /** 風停了 */
  dawnAt: 29.42,
  /** 打雷的間隔（秒） */
  thunder: [26, 44] as [number, number],
}

/** 每間房漏水的地方（避開床、床頭櫃、門口、電扇） */
const LEAK_SPOTS: Record<RoomId | 'hall', XZ[]> = {
  r1: [
    [9.55, 5.6],
    [8.3, 5.72],
    [9.6, 2.0],
  ],
  r2: [
    [-9.55, 1.1],
    [-7.95, 1.2],
    [-9.6, -1.75],
  ],
  hall: [[1.6, -5.45]],
}

export const GHOST = {
  /** 好兄弟出門前多久先講一聲（小時） */
  warnBefore: 0.35,
  /** 請他們等活人睡了再出門：最晚等到幾點（再晚就不去了） */
  holdUntil: 28.4,
  dawnAt: 29.42,
}

interface TripDef {
  who: GuestId[]
  node: string
  wait: number
  at: number
  look: XZ
  kind: 'pray' | 'wash' | 'moon' | 'sing' | 'guard'
}

/**
 * 好兄弟半夜出門走走（依今晚住的是哪一對）。第二趟故意排在活人起夜（上廁所）的時間附近：
 * 小美 02:12 起來上廁所、罔市姆 02:15 去浴室洗臉；張經理 03:00 上廁所、陳班長 02:54 站到右邊廊下「站衛兵」。
 */
function ghostTrips(ids: GuestId[]): TripDef[] {
  if (ids.includes('gg_shuimu'))
    return [
      { who: ['gg_shuimu', 'gg_bangsi'], node: 'altar', wait: 28, at: 24.45, look: LOOK_ALTAR, kind: 'pray' },
      { who: ['gg_bangsi'], node: 'bath_sink', wait: 26, at: 26.25, look: [SINK_LOOK[0], SINK_LOOK[1]], kind: 'wash' },
    ]
  return [
    { who: ['gg_soldier'], node: 'tea', wait: 26, at: 24.45, look: [-3.6, 7.5], kind: 'moon' },
    { who: ['gg_opera'], node: 'yardC', wait: 34, at: 25.35, look: [0, -3.2], kind: 'sing' },
    { who: ['gg_soldier'], node: 'porchR', wait: 30, at: 26.9, look: [6.6, 8], kind: 'guard' },
  ]
}

// ---------------------------------------------------------------------------
// 台詞：好兄弟的碎念（BARKS 在 data/barks.ts 是空的，這裡補；台詞在 special.lines.json）
// ---------------------------------------------------------------------------

const ids = (who: string, spec: Partial<Record<BarkKind, number>>) =>
  Object.fromEntries(Object.entries(spec).map(([k, n]) => [k, Array.from({ length: n }, (_, i) => `${who}.${k}.${i + 1}`)])) as Partial<Record<BarkKind, string[]>>

/** 好兄弟會講的（看得到阿嬤，所以沒有「門自己開」；起夜由 special.ts 安排，所以沒有「上廁所」） */
const COMMON: Partial<Record<BarkKind, number>> = {
  arrive: 2,
  idle: 3,
  sleepy: 1,
  need_cold: 1,
  need_thirsty: 1,
  need_dark: 1,
  need_hungry: 1,
  need_insomnia: 1,
  need_chat: 1,
  thanks: 2,
  hear: 1,
  suspect: 1,
  seen: 2,
  woken: 1,
  morning: 1,
}
export const GHOST_BARKS: Partial<Record<GuestId, Partial<Record<BarkKind, string[]>>>> = Object.fromEntries(GHOST_GUEST_IDS.map((id) => [id, ids(id, COMMON)]))
for (const [id, b] of Object.entries(GHOST_BARKS)) Object.assign(BARKS[id as GuestId], b)

/** 聊天的對話（director 的 chat 動作用；對話內容在 specialStory.ts） */
export function chatDialogueFor(sim: NightSim, room: RoomId): string | null {
  const gs = sim.guests.filter((g) => g.room === room && isGhostGuest(g.id))
  if (!gs.length) return null
  if (gs.some((g) => g.id === 'gg_shuimu')) return 'sp_chat_old'
  const soldier = gs.find((g) => g.id === 'gg_soldier')
  if (soldier && !soldier.chatted) return 'sp_chat_soldier'
  return 'sp_chat_opera'
}

// ---------------------------------------------------------------------------
// 共用
// ---------------------------------------------------------------------------

abstract class SpecialRT implements SimPlugin {
  abstract kind: SpecialNight
  /** 真實經過的秒數（畫面用） */
  t = 0
  protected rnd: () => number
  protected dawnDone = false
  constructor(
    protected sim: NightSim,
    seed: number,
  ) {
    this.rnd = seeded(seed)
  }
  abstract update(dt: number, hour: number, gm: GrandmaState, sim: NightSim): void
  /** HUD：現在該做什麼（沒事就是空字串） */
  abstract hint(hour: number): string
  protected say(id: string) {
    this.sim.emitCustom('line', { id })
  }
  protected note(id: GuestId, text: string) {
    const prev = this.sim.reviewNotes[id]
    this.sim.reviewNotes[id] = prev ? `${prev}${text}` : text
  }
  protected pickLine(id: GuestId, kind: BarkKind) {
    const xs = BARKS[id]?.[kind]
    return xs?.length ? xs[Math.floor(this.rnd() * xs.length)] : null
  }
}

// ---------------------------------------------------------------------------
// 颱風夜
// ---------------------------------------------------------------------------

export interface LeakRT {
  room: RoomId | 'hall'
  x: number
  z: number
  at: number
  active: boolean
  bucket: boolean
  /** 地上積水 0..1（畫面） */
  spill: number
  dripT: number
}

export class Typhoon extends SpecialRT {
  kind = 'typhoon' as const
  leaks: LeakRT[]
  shutter = { banging: false, closed: false, closedAt: 0, bangT: 2, bangs: 0, lastBang: -99 }
  candles: [boolean, boolean] = [true, true]
  /** 大風之後大家擠在神明廳 */
  gather: 'wait' | 'call' | 'on' | 'done' = 'wait'
  private gathered = new Map<GuestId, number>()
  private placed = new Set<GuestId>()
  private blowT = 12
  /** 風把大門吹得嘎嘎響：面向神明的人也會轉頭看門外（秒）——那幾秒點蠟燭才不會被看到 */
  private rattleT = 5
  rattling = 0
  private humCD = 0
  /** 打雷：第幾聲、下一聲還有幾秒（畫面讀 thunderN 的變化來閃電、打雷） */
  thunderN = 0
  private thunderT = 7
  /** 分數 */
  gatherTime = 0
  litTime = 0
  hums = 0
  relights = 0
  bucketsSeen = 0
  outcome: { good: boolean; caught: number; total: number } | null = null

  constructor(sim: NightSim, seed: number) {
    super(sim, seed)
    this.leaks = TYPHOON.leaks.map((l) => {
      const spots = LEAK_SPOTS[l.room]
      const [x, z] = spots[Math.floor(this.rnd() * spots.length)]
      return { room: l.room, x, z, at: l.at, active: false, bucket: false, spill: 0, dripT: 1 }
    })
    // 同一間房的兩次漏水不要在同一個地方
    const r1 = this.leaks.filter((l) => l.room === 'r1')
    if (r1.length === 2 && r1[0].x === r1[1].x && r1[0].z === r1[1].z) {
      const other = LEAK_SPOTS.r1.find(([x, z]) => x !== r1[0].x || z !== r1[0].z)!
      r1[1].x = other[0]
      r1[1].z = other[1]
    }
  }

  /** 神明廳有人在躲（畫面：小翰拿手電筒站在門口） */
  get sheltering() {
    return this.gather === 'call' || this.gather === 'on'
  }

  get litCount() {
    return (this.candles[0] ? 1 : 0) + (this.candles[1] ? 1 : 0)
  }

  update(dt: number, hour: number, gm: GrandmaState) {
    this.t += dt
    const sim = this.sim
    void gm
    // ---- 打雷 ----
    if (hour >= 22.3 && hour < 28.9) {
      this.thunderT -= dt
      if (this.thunderT <= 0) {
        this.thunderT = TYPHOON.thunder[0] + this.rnd() * (TYPHOON.thunder[1] - TYPHOON.thunder[0])
        this.thunderN++
        // 雷聲不會把人吵醒（那太不公平），但是醒著的人會怕
        for (const g of sim.guests) if (g.awake && !g.def.seesGhost && g.def.type !== 'thrill') g.fear += ['timid', 'parent', 'child'].includes(g.def.type) ? 5 : 2
      }
    }
    // ---- 窗板 ----
    const sh = this.shutter
    if (!sh.closed && hour >= TYPHOON.shutterAt) {
      if (!sh.banging) {
        sh.banging = true
        this.say('sp.gm.shutter')
      }
      sh.bangT -= dt
      if (sh.bangT <= 0) {
        sh.bangT = 3.5 + this.rnd() * 2.5
        sh.bangs++
        sh.lastBang = this.t
        sim.noise(SHUTTER.x + 0.4, SHUTTER.z, 0.45)
      }
    }
    // ---- 漏水 ----
    for (const l of this.leaks) {
      if (!l.active) {
        if (hour >= l.at) {
          l.active = true
          this.say(`sp.gm.leak.${l.room}`)
        }
        continue
      }
      if (l.bucket) continue
      l.spill = Math.min(1, l.spill + dt / 50)
      l.dripT -= dt
      if (l.dripT <= 0) {
        l.dripT = 2.2
        sim.noise(l.x, l.z, 0.1)
      }
      for (const g of sim.guests) {
        const inRoom = l.room === 'hall' ? this.gathered.has(g.id) && g.mode === 'stand' : g.room === l.room && g.mode === 'bed'
        if (inRoom) g.comfort -= dt * HOURS_PER_SEC * 10
      }
    }
    // ---- 大風：大家到神明廳 ----
    if (this.gather === 'wait' && hour >= TYPHOON.gustAt) {
      this.gather = 'call'
      this.candles = [true, true]
      sim.emitCustom('special.typhoon.gust')
    }
    if (this.gather === 'call' || this.gather === 'on') this.updateGather(dt, hour)
    // ---- 天亮：風停了 ----
    if (!this.dawnDone && hour >= TYPHOON.dawnAt) {
      this.dawnDone = true
      this.dawn()
    }
  }

  private updateGather(dt: number, hour: number) {
    const sim = this.sim
    // 叫大家出來：還在床上的人一個一個送過去（正在上廁所的等他回床上）
    if (hour < TYPHOON.gustAt + 0.5) {
      for (const g of sim.guests) {
        if (this.gathered.has(g.id) || g.mode !== 'bed' || g.steps.length) continue
        const i = this.gathered.size
        const look = i % 2 === 0 ? LOOK_OUT : LOOK_ALTAR
        if (sim.sendGuest(g.id, 'hall', TYPHOON.gatherWait, look)) {
          this.gathered.set(g.id, i)
          g.fear += isGhostGuest(g.id) ? 0 : 6
        }
      }
    }
    // 走到了：站到自己的位置（不要全部疊在一起）
    let standing = 0
    for (const g of sim.guests) {
      const i = this.gathered.get(g.id)
      if (i === undefined) continue
      if (g.mode === 'stand' && g.steps.length >= 2) {
        if (!this.placed.has(g.id)) {
          const [x, z] = HALL_SPOTS[i % HALL_SPOTS.length]
          g.x = x
          g.z = z
          g.heading = Math.atan2((i % 2 === 0 ? LOOK_OUT : LOOK_ALTAR)[0] - x, (i % 2 === 0 ? LOOK_OUT : LOOK_ALTAR)[1] - z)
          this.placed.add(g.id)
        }
        standing++
      }
    }
    if (standing > 0) this.gather = 'on'
    if (this.gather === 'on') {
      this.gatherTime += dt
      if (this.litCount > 0) this.litTime += dt
      // 風從門縫灌進來：蠟燭一根一根被吹熄
      this.blowT -= dt
      if (this.blowT <= 0 && this.litCount > 0) {
        this.blowT = 9 + this.rnd() * 7
        const lit = this.candles[0] && this.candles[1] ? (this.rnd() < 0.5 ? 0 : 1) : this.candles[0] ? 0 : 1
        this.candles[lit] = false
        sim.emitCustom('special.typhoon.candle', { lit: this.litCount })
        if (this.litCount === 0) this.say('sp.gm.candles.out')
      }
      // 大門被風吹得嘎嘎響（7–11 秒一次）：大家轉頭看門外 3.5 秒。
      // 面向神明拜拜的人一直看著神明桌，沒有這個空檔的話，點蠟燭一定會被看到（實測：五次點了四次被看到）
      this.rattleT -= dt
      if (this.rattleT <= 0) {
        this.rattleT = 7 + this.rnd() * 4
        this.rattling = 3.5
        sim.emitCustom('special.typhoon.rattle')
      }
      const glance = this.rattling > 0
      this.rattling = Math.max(0, this.rattling - dt)
      for (const g of sim.guests) {
        const i = this.gathered.get(g.id)
        if (i === undefined || g.mode !== 'stand' || !this.placed.has(g.id) || g.scaredT > 0) continue
        const look = glance || i % 2 === 0 ? LOOK_OUT : LOOK_ALTAR
        const step = g.steps[0]
        if (step) step.look = look
        g.heading = Math.atan2(look[0] - g.x, look[1] - g.z)
      }
      for (const g of sim.guests) {
        if (!this.gathered.has(g.id) || g.mode !== 'stand' || isGhostGuest(g.id)) continue
        if (this.litCount === 0) {
          if (!g.def.seesGhost && g.def.type !== 'thrill') g.fear += dt * HOURS_PER_SEC * 14
          g.comfort -= dt * HOURS_PER_SEC * 6
        } else g.comfort += dt * HOURS_PER_SEC * 5
      }
    }
    this.humCD = Math.max(0, this.humCD - dt)
    // 大家都回床上了
    if (this.gather === 'on' && hour > TYPHOON.gustAt + 0.3 && sim.guests.every((g) => !this.gathered.has(g.id) || g.mode === 'bed')) {
      this.gather = 'done'
      this.say('sp.gm.gather.done')
    }
  }

  // ---- 阿嬤做的事（specialStory.ts 的熱點呼叫） ----

  /** 這個漏水可以放水桶嗎 */
  canBucket(i: number) {
    const l = this.leaks[i]
    return !!l && l.active && !l.bucket
  }

  /** 放水桶：在醒著的客人面前放＝水桶自己飄過去（被看到） */
  placeBucket(i: number) {
    const l = this.leaks[i]
    if (!l || !l.active || l.bucket) return 0
    l.bucket = true
    const seen = this.sim.actionSeen(l.x, l.z, l.room === 'hall' ? null : l.room, true)
    this.bucketsSeen += seen
    return seen
  }

  closeShutter() {
    const sh = this.shutter
    if (sh.closed || !sh.banging) return 0
    sh.closed = true
    sh.banging = false
    sh.closedAt = this.sim.hour
    return this.sim.actionSeen(SHUTTER.stand[0], SHUTTER.stand[1], null, true)
  }

  get canRelight() {
    return this.gather === 'on' && this.litCount < 2
  }

  /** 重新點蠟燭：面向神明的人會看到火柴自己點起來 */
  relight() {
    if (!this.canRelight) return 0
    this.candles = [true, true]
    this.relights++
    return this.sim.actionSeen(CANDLES.x, CANDLES.z, null, true)
  }

  get canHum() {
    return this.gather === 'on' && this.humCD <= 0
  }

  /** 躲在門後哼歌：大家比較不怕（不用被看到，但是有一點聲音） */
  hum() {
    if (!this.canHum) return false
    this.humCD = 18
    this.hums++
    for (const g of this.sim.guests) {
      if (!this.gathered.has(g.id) || g.mode !== 'stand') continue
      g.fear = Math.max(0, g.fear - 10)
      g.comfort += 6
    }
    this.sim.noise(HUM_SPOT[0], HUM_SPOT[1], 0.05)
    return true
  }

  private dawn() {
    const started = this.leaks.filter((l) => l.active)
    const caught = started.filter((l) => l.bucket).length
    const total = started.length
    const candleRatio = this.gatherTime > 0 ? this.litTime / this.gatherTime : 1
    const shutterOk = this.shutter.closed && this.shutter.closedAt - TYPHOON.shutterAt < 1.2
    const good = (total === 0 || caught / total >= 0.6) && candleRatio >= 0.6
    this.outcome = { good, caught, total }
    const sheltered = this.gathered.size > 0
    for (const g of this.sim.guests) {
      if (good && this.gathered.has(g.id)) g.comfort += 12
      const k = good ? (sheltered ? 'good' : 'goodquiet') : shutterOk ? 'bad' : 'badshutter'
      this.note(g.id, TYPHOON_NOTES[k][Math.floor(this.rnd() * TYPHOON_NOTES[k].length)])
    }
    this.sim.emitCustom('special.typhoon.dawn', { good, caught, total, warm: good ? 6 : 2 })
  }

  hint(hour: number) {
    if (this.gather === 'on') {
      if (this.litCount === 0) return this.rattling > 0 ? '大門被風吹得嘎嘎響，大家都轉頭看門外——現在點蠟燭！' : '神明桌的蠟燭全被風吹熄了，大家很怕：等大門嘎嘎響、大家轉頭看門外的時候重新點亮'
      if (this.litCount === 1) return this.rattling > 0 ? '大門嘎嘎響，大家轉頭看門外——現在點蠟燭！' : '一根蠟燭被吹熄了：等大門嘎嘎響、大家轉頭看門外的時候重新點亮（面向神明拜拜的人會看到）'
      const hall = this.leaks.find((l) => l.room === 'hall' && l.active && !l.bucket)
      if (hall) return '神明廳也漏水了：放個水桶接著'
      return '大家擠在神明廳躲颱風：躲在阿嬤房間的門後哼歌，可以安撫大家'
    }
    if (this.gather === 'call') return '大風把瓦片掀掉了！小翰叫大家到神明廳躲'
    const leak = this.leaks.find((l) => l.active && !l.bucket)
    if (leak) return `${leak.room === 'hall' ? '神明廳' : GUEST_ROOMS[leak.room].name}漏水了：放個水桶接著（醒著的客人面前放會被看到）`
    if (this.shutter.banging) return '客房一的窗板被風吹得一直拍，吵得客人睡不著：到埕裡把它扣好'
    if (hour >= 24 && hour < 26) return '停電了：怕黑的客人要點蠟燭（小夜燈）；兩點左右風會最大'
    if (hour < TYPHOON.gustAt) return '颱風夜：注意漏水和窗板，兩點左右風最大'
    return ''
  }
}

const TYPHOON_NOTES: Record<'good' | 'goodquiet' | 'bad' | 'badshutter', string[]> = {
  good: [
    '颱風那晚停電，大家擠在神明廳，蠟燭一直沒熄。好像有人一直在照顧我們。',
    '半夜風好大，全部的人躲在神明廳。說也奇怪，漏水的地方都剛好有水桶。',
  ],
  goodquiet: ['外面颱風，房間裡卻很安穩。屋頂漏水的地方早就放好水桶了。'],
  bad: ['颱風夜屋頂漏水，滴答滴答一整晚，沒睡好。', '颱風夜停電，神明廳黑漆漆的，大家都嚇壞了。'],
  badshutter: ['颱風夜窗板拍了一整晚，砰、砰、砰，根本睡不著。'],
}

// ---------------------------------------------------------------------------
// 中元鬼客人夜
// ---------------------------------------------------------------------------

interface TripRT extends TripDef {
  /** wait → soon（講一聲）→ out（出門）→ done；held：答應阿嬤等活人睡了再出門 */
  state: 'wait' | 'soon' | 'held' | 'out' | 'done'
  /** 阿嬤請他們等活人睡了再出門 */
  polite: boolean
  sent: Set<GuestId>
}

export class GhostNight extends SpecialRT {
  kind = 'ghost' as const
  trips: TripRT[]
  /** 活人看到好兄弟的「懷疑」0..1 */
  private sus = new Map<GuestId, number>()
  private susCD = new Map<GuestId, number>()
  sightings = 0
  /** 秋月唱戲：有沒有人當觀眾、上一次唱的時間（畫面） */
  audience = false
  singT = 0
  lastSing = -99
  incense = false
  outcome: { merit: number; sightings: number } | null = null

  constructor(sim: NightSim, seed: number) {
    super(sim, seed)
    this.trips = ghostTrips(sim.guests.map((g) => g.id))
      .filter((t) => t.who.every((id) => sim.guests.some((g) => g.id === id)))
      .map((t) => ({ ...t, state: 'wait', polite: false, sent: new Set<GuestId>() }))
  }

  get ghosts() {
    return this.sim.guests.filter((g) => isGhostGuest(g.id))
  }
  get living() {
    return this.sim.guests.filter((g) => !isGhostGuest(g.id))
  }

  /** 正在唱戲的秋月（畫面、熱點） */
  get singer(): GuestRT | null {
    const trip = this.trips.find((t) => t.kind === 'sing' && t.state === 'out')
    if (!trip) return null
    const g = this.sim.guests.find((x) => x.id === 'gg_opera')
    return g && g.mode === 'stand' ? g : null
  }

  update(dt: number, hour: number, gm: GrandmaState) {
    this.t += dt
    const sim = this.sim
    // ---- 出門走走 ----
    const livingUp = this.living.some((l) => l.awake || l.mode !== 'bed')
    for (const tr of this.trips) {
      if (tr.state === 'wait' && hour >= tr.at - GHOST.warnBefore) {
        tr.state = 'soon'
        this.say(`sp.${tr.who[0]}.trip.${tr.kind}`)
      }
      if ((tr.state === 'soon' || tr.state === 'held') && hour >= tr.at) {
        if (tr.polite && livingUp) {
          // 答應阿嬤等活人睡了再出門；等太晚就不去了（有一點失望）
          tr.state = 'held'
          if (hour >= GHOST.holdUntil) {
            tr.state = 'done'
            for (const id of tr.who) {
              const g = sim.guests.find((x) => x.id === id)
              if (g) g.comfort -= 5
            }
          }
          continue
        }
        for (const id of tr.who) if (!tr.sent.has(id) && sim.sendGuest(id, tr.node, tr.wait + tr.sent.size * 1.5, tr.look)) tr.sent.add(id)
        if (tr.sent.size === tr.who.length || hour > tr.at + 0.3) tr.state = tr.sent.size ? 'out' : 'done'
      }
      if (tr.state === 'out' && tr.who.every((id) => sim.guests.find((g) => g.id === id)?.mode === 'bed')) tr.state = 'done'
    }
    // ---- 活人撞見好兄弟（答應過阿嬤的好兄弟有人走過來會把自己藏起來） ----
    const hiding = new Set(this.trips.filter((t) => t.polite).flatMap((t) => t.who))
    const out = this.ghosts.filter((g) => g.mode !== 'bed' && !hiding.has(g.id))
    for (const l of this.living) {
      const cd = Math.max(0, (this.susCD.get(l.id) ?? 0) - dt)
      this.susCD.set(l.id, cd)
      let s = this.sus.get(l.id) ?? 0
      const spot = l.awake && l.scaredT <= 0 && cd <= 0 ? out.find((g) => canSee(l.x, l.z, l.heading, g.x, g.z)) : undefined
      if (spot) {
        const d = Math.hypot(spot.x - l.x, spot.z - l.z)
        s += 1.3 * clamp(1.25 - d / 6, 0.3, 1.15) * dt
      } else s = Math.max(0, s - dt * 0.4)
      if (s >= 1 && spot) {
        s = 0.2
        this.susCD.set(l.id, 6)
        this.sightings++
        l.fear += 24
        l.comfort -= 6
        l.scaredT = 1.6
        sim.noise(l.x, l.z, 0.7, l)
        const line = this.pickLine(l.id, 'seen')
        if (line) this.say(line)
        sim.emitCustom('special.ghost.sighting', { who: l.id, ghost: spot.id })
      }
      this.sus.set(l.id, s)
    }
    // ---- 秋月唱戲 ----
    const singer = this.singer
    if (singer) {
      if (!this.audience && Math.hypot(gm.x - singer.x, gm.z - singer.z) < 2.2 && gm.speed < 0.3 && gm.home && !gm.body) this.listen()
      this.singT -= dt
      if (this.singT <= 0) {
        this.singT = 4.5
        this.lastSing = this.t
        sim.noise(singer.x, singer.z, this.audience ? 0.06 : 0.38)
      }
    }
    // ---- 天亮：好兄弟退房 ----
    if (!this.dawnDone && hour >= GHOST.dawnAt) {
      this.dawnDone = true
      this.dawn()
    }
  }

  /** 下一趟快要出門、還沒答應要等的（熱點：請他們等活人睡了再出門） */
  get pending(): TripRT | null {
    return this.trips.find((t) => t.state === 'soon' && !t.polite) ?? null
  }

  /** 請好兄弟等活人睡了再出門（出門以後有活人走過來，也會把自己藏起來） */
  delay() {
    const tr = this.pending
    if (!tr) return false
    tr.polite = true
    return true
  }

  /** 當秋月的觀眾：她開心、唱小聲一點 */
  listen() {
    if (this.audience) return false
    const g = this.sim.guests.find((x) => x.id === 'gg_opera')
    if (!g) return false
    this.audience = true
    g.comfort += 15
    g.chatted = true
    this.say('sp.gg_opera.audience')
    return true
  }

  /** 幫好兄弟在神明廳點一炷香 */
  burnIncense() {
    if (this.incense) return false
    this.incense = true
    for (const g of this.ghosts) g.comfort += 8
    this.say('sp.gm.incense')
    return true
  }

  private dawn() {
    let merit = 0
    for (const g of this.ghosts) {
      const ok = g.comfort >= g.def.comfortNeed && g.needs.length === 0
      merit += ok ? 2 : 1
      const xs = GHOST_NOTES[g.id]
      if (xs) this.note(g.id, ok ? xs.good : xs.bad)
    }
    if (this.incense) merit++
    if (this.audience) merit++
    if (this.sightings === 0) merit++
    for (const l of this.living) this.note(l.id, this.sightings > 0 ? LIVING_NOTES.scared : LIVING_NOTES.calm)
    this.outcome = { merit, sightings: this.sightings }
    this.sim.emitCustom('special.ghost.dawn', { merit, sightings: this.sightings })
  }

  hint(hour: number) {
    const awakeLiving = this.living.find((l) => l.awake)
    const pend = this.pending
    if (pend && awakeLiving) {
      const who = pend.who.map((id) => this.sim.guests.find((g) => g.id === id)?.def.name ?? '').join('和')
      return `${who}等一下要出門（${TRIP_WHAT[pend.kind]}），可是${awakeLiving.def.name}還醒著：到客房二門口請他們小心，別嚇到人`
    }
    if (this.singer && !this.audience) return '秋月在埕裡唱戲，唱得很大聲：過去當她的觀眾，她就會唱小聲一點'
    if (this.ghosts.some((g) => g.mode !== 'bed') && awakeLiving) return `好兄弟在屋裡走動：別讓${awakeLiving.def.name}看到（貓叫、壁虎叫可以把人引開）`
    if (!this.incense && hour < GHOST.dawnAt) return '中元鬼客人夜：好兄弟看得到阿嬤。照顧他們（聊天、供品、點燈），也可以到神明廳幫他們點一炷香'
    return ''
  }
}

const TRIP_WHAT: Record<TripDef['kind'], string> = { pray: '去神明廳拜拜', wash: '去浴室洗臉', moon: '到埕裡看月亮', sing: '到埕裡唱戲', guard: '到右邊廊下站衛兵' }

const GHOST_NOTES: Partial<Record<GuestId, { good: string; bad: string }>> = {
  gg_shuimu: {
    good: '（用毛筆寫在冥紙背面）陽間的民宿，比陰間的還溫暖。阿春，妳這間厝顧得真好。——水木',
    bad: '（冥紙背面）房間有一點冷清……不過能回來看一眼村子，就夠了。——水木',
  },
  gg_bangsi: {
    good: '（冥紙背面）燈一直亮著，我一整晚都沒有迷路。明年普渡還要來。——罔市',
    bad: '（冥紙背面）陰間暗，陽間也暗……唉，人老了，鬼也老了。——罔市',
  },
  gg_soldier: {
    good: '（冥紙背面，字很工整）吃到熱的東西了。跟老家的味道不一樣，但是是熱的。謝謝。——陳班長',
    bad: '（冥紙背面）一個人坐了一整晚。習慣了。——陳班長',
  },
  gg_opera: {
    good: '（冥紙背面，還畫了一朵花）有人聽我唱戲，這一晚就不算白過。五顆星，給觀眾。——秋月',
    bad: '（冥紙背面）唱給月亮聽，月亮也不拍手。——秋月',
  },
}

const LIVING_NOTES = {
  scared: '半夜在走廊看到一個穿舊衣服的人走過去……老闆說今天是中元普渡。我開著燈睡到天亮。',
  calm: '今天剛好中元普渡，本來有點毛毛的，結果睡得很好。隔壁好像住了一對老人家，聊天的聲音很溫暖。',
}

// ---------------------------------------------------------------------------
// 登記
// ---------------------------------------------------------------------------

/** 畫面、HUD、熱點讀這個（每晚開始時換掉） */
export const specialState: { current: Typhoon | GhostNight | null } = { current: null }

export const typhoonNow = () => (specialState.current instanceof Typhoon ? specialState.current : null)
export const ghostNightNow = () => (specialState.current instanceof GhostNight ? specialState.current : null)

/** 今晚是哪一種（測試直接給 plan） */
export function makeSpecial(sim: NightSim, plan: NightPlan, night: number): Typhoon | GhostNight | null {
  const kind = plan.special ?? null
  if (kind === 'typhoon') return new Typhoon(sim, night * 211 + 5)
  if (kind === 'ghost' && sim.guests.some((g) => isGhostGuest(g.id))) return new GhostNight(sim, night * 223 + 9)
  return null
}

/** 今晚是不是特別的夜晚（null＝平常） */
export function createSpecialNight(sim: NightSim, plan: NightPlan, meta: Meta): SimPlugin | null {
  const rt = makeSpecial(sim, plan, meta.night)
  specialState.current = rt
  return rt
}

/** 傍晚用：今晚／明晚是不是特別的夜晚 */
export { specialOf }

// ---------------------------------------------------------------------------
// 事件的處理（director 併進 CUSTOM_EVENTS；只在瀏覽器跑，所以用動態 import）
// ---------------------------------------------------------------------------

const later = (ms: number, fn: () => void) => void globalThis.setTimeout(fn, ms)
const store = () => import('../../store').then((m) => m.useStore)
const sfx = () => import('../../audio').then((m) => m.audio)

/** sim.emitCustom 的事件（director 轉過來） */
export const SPECIAL_EVENTS: Record<string, (data: unknown) => void> = {
  /** 02:00 大風掀瓦：一聲巨響、小翰叫大家到神明廳 */
  'special.typhoon.gust': () => {
    void sfx().then((a) => {
      a.thunder()
      a.whoosh()
      later(300, () => a.bassDrop())
    })
    void store().then((useStore) => {
      useStore.getState().bark('sp.han.gust')
      later(4200, () => useStore.getState().bark('sp.gm.gust'))
    })
  },
  'special.typhoon.candle': () => void sfx().then((a) => a.whoosh()),
  // 大門被風吹得嘎嘎響（大家轉頭看門外的提示音）
  'special.typhoon.rattle': () => void sfx().then((a) => a.whoosh()),
  /** 風停了：溫馨名聲、字幕 */
  'special.typhoon.dawn': (data) => {
    const { good, caught, total, warm } = data as { good: boolean; caught: number; total: number; warm: number }
    void store().then((useStore) => {
      const s = useStore.getState()
      useStore.setState({ meta: { ...s.meta, warm: Math.min(100, s.meta.warm + warm) } })
      s.bark(good ? 'sp.han.dawn.good' : 'sp.han.dawn.bad')
      later(5200, () =>
        useStore
          .getState()
          .say(good ? `颱風走了。漏水接住 ${caught}／${total} 處，神明廳的蠟燭一直亮著。客人說這一晚會記很久。（溫馨 +${warm}）` : `颱風走了。漏水接住 ${caught}／${total} 處……房間裡都是水。小翰一大早就在拖地。（溫馨 +${warm}）`),
      )
    })
  },
  /** 活人撞見好兄弟 */
  'special.ghost.sighting': () => void sfx().then((a) => a.scream()),
  /** 好兄弟退房：冥紙換成功德 */
  'special.ghost.dawn': (data) => {
    const { merit } = data as { merit: number; sightings: number }
    void store().then((useStore) => {
      const s = useStore.getState()
      useStore.setState({ meta: { ...s.meta, merit: s.meta.merit + merit } })
      s.bark('sp.han.ghost.dawn')
      later(5200, () => useStore.getState().say(`好兄弟天還沒亮就退房了。櫃台上留著一疊冥紙，折得整整齊齊。（功德 +${merit}）`))
    })
    void sfx().then((a) => a.chime())
  },
}

