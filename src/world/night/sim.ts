import { GUEST_ROOMS, FENCE, MAIN, SINK, ROCKER } from '../../scene/layout'
import { HOME } from '../scenes'
import type { Rect } from '../collision'
import { seeded } from '../rng'
import { BLOCKS_SLEEP, GUESTS, type GuestDef } from './guests'
import { BED_NODE, MIAOGONG_LOOP, NODES, PATROL, route } from './nav'
import type { NightPlan } from './plan'
import type { BarkKind, GuestId, NeedKind, NightEvent, ObjectState, RoomId } from './types'

// 深夜模擬（DESIGN §2.2、§5、§6、§11）。純 TypeScript，不碰畫面：
// store 每幀呼叫 update()，把回傳的事件轉成語音、字幕、特效；畫面讀 guests 的位置與狀態來畫。
// scripts/sim-night.ts 用機器人阿嬤在 Node 裡跑完整一晚，檢查規則合不合理。

type XZ = [number, number]
const HOURS_PER_SEC = 1 / 37.5

/** 壁虎平常趴的地方（神明廳門口的牆上）；牆邊的地上是附身的互動點 */
export const GECKO_HOME: [number, number] = [-1.6, MAIN.z1 + 0.35]

export const SIGHT_RANGE = 6
/** 視野半角（弧度）：±70° */
export const SIGHT_HALF = (70 * Math.PI) / 180
/** 同一間房、躺在床上時的餘光 */
const PERIPHERAL = (100 * Math.PI) / 180
const WALK_SPEED = 1.25

export interface NeedRT {
  kind: NeedKind
  since: number
  /** 阿嬤觀察過（靠近、看得到）才會顯示泡泡 */
  known: boolean
}

export interface GuestRT {
  id: GuestId
  def: GuestDef
  room: RoomId
  /** 雙人房的左右位置 */
  slot: number
  mode: 'bed' | 'walk' | 'stand'
  awake: boolean
  x: number
  z: number
  heading: number
  /** 走路速度（畫面用） */
  speed: number
  comfort: number
  fear: number
  /** 睡多沉 0..1 */
  sleep: number
  tucked: boolean
  needs: NeedRT[]
  met: NeedKind[]
  /** 對阿嬤的懷疑 0..1，滿了就是「看到了」 */
  suspicion: number
  peak: number
  seen: number
  captures: number
  played: boolean
  chatted: boolean
  /** 要做的事：一步一步走 */
  steps: Step[]
  stepT: number
  /** 現在是否在拍攝（YouTuber） */
  filming: string | null
  /** 嚇到的動畫剩幾秒 */
  scaredT: number
  /** 轉頭前的預告（「嗯？」）剩幾秒；結束後轉向 lookTarget */
  tellT: number
  lookTarget: number | null
  lookT: number
  /** 醒著在床上時多久後會想睡（被吵醒之後） */
  resleepT: number
  barkT: number
  /** 起夜是否做過 */
  tripsDone: number
  snackDone: boolean
  spot: 'sink' | 'toilet' | 'stove' | null
  wokenCount: number
  /** 托夢成功：到這個時間之前睡得很沉，吵不醒 */
  deepUntil: number
  /** 夢到阿嬤（評論會提到） */
  dreamt: boolean
  /** 最近走過的腳印（陰陽眼看得到）：[x, z, 小時, 左右腳] */
  trail: [number, number, number, number][]
  /** 已經講過入睡台詞 */
  sleptOnce: boolean
}

interface Step {
  path?: XZ[]
  wait?: number
  look?: XZ
  film?: string
  spot?: 'sink' | 'toilet' | 'stove'
  /** 走完這一步回到床上 */
  toBed?: boolean
}

export interface PatrolRT {
  x: number
  z: number
  heading: number
  speed: number
  i: number
  path: XZ[]
  suspicion: number
  catches: number
  active: boolean
  left: boolean
  barkT: number
}

export interface DogRT {
  x: number
  z: number
  heading: number
  speed: number
  /** 被附身 */
  possessed: boolean
  /** 附身時吠了一聲（畫面播動畫） */
  woofT: number
  /** 今晚是「狗叫」的晚上 */
  event: boolean
  barking: boolean
  calm: boolean
  barkT: number
  startAt: number
  stopT: number
}

export interface GrandmaState {
  x: number
  z: number
  /** 移動速度（m/s） */
  speed: number
  busy: boolean
  carrying: boolean
  /** 在家這個場景（在土地公廟就不會被看到） */
  home: boolean
  /** 走路時懷疑速度的倍率（技能「鬼步」0.65） */
  walkFactor: number
  /** 躲在衣櫃、神桌下……：誰都看不到（廟公經過會開來檢查） */
  hidden?: boolean
  /** 附身在動物身上：(x, z) 是牠的位置；客人看到的是動物，不是鬼 */
  body?: 'cat' | 'dog' | 'gecko'
}

/** 壁虎：平常趴在神明廳門邊的牆上；附身時沿著牆和天花板走 */
export interface GeckoRT {
  x: number
  z: number
  heading: number
  speed: number
  possessed: boolean
  chirpT: number
}

/** 阿咪：晚上在屋裡亂晃的橘貓。經過醒著的客人床邊會被摸（舒適 +）；阿嬤可以附身 */
export interface CatRT {
  x: number
  z: number
  heading: number
  speed: number
  pose: 'walk' | 'sit' | 'sleep' | 'meow' | 'rub'
  path: XZ[]
  wait: number
  node: string
  possessed: boolean
  meowT: number
}

export type SimEvent =
  | { t: 'bark'; who: GuestId; kind: BarkKind; quiet?: boolean }
  | { t: 'seen'; who: GuestId; shock: number }
  | { t: 'happySeen'; who: GuestId }
  | { t: 'capture'; who: GuestId }
  | { t: 'scream'; who: GuestId }
  | { t: 'woken'; who: GuestId }
  | { t: 'asleep'; who: GuestId }
  | { t: 'need'; who: GuestId; kind: NeedKind }
  | { t: 'nearmiss' }
  | { t: 'worry'; who: GuestId }
  | { t: 'mg'; kind: 'arrive' | 'patrol' | 'spot' | 'catch' | 'leave' }
  | { t: 'mgCatch'; count: number }
  | { t: 'dog'; kind: 'start' | 'bark' | 'calm' }

/** 牆（厚度 ≤ 0.32 的長條）：擋視線、擋聲音。家具不擋視線。 */
const WALLS: Rect[] = HOME.colliders.rects.filter((r) => Math.min(r.x1 - r.x0, r.z1 - r.z0) <= 0.32 && Math.max(r.x1 - r.x0, r.z1 - r.z0) > 0.4)

function segHitsRect(ax: number, az: number, bx: number, bz: number, r: Rect) {
  let t0 = 0
  let t1 = 1
  const dx = bx - ax
  const dz = bz - az
  for (const [p, q] of [
    [-dx, ax - r.x0],
    [dx, r.x1 - ax],
    [-dz, az - r.z0],
    [dz, r.z1 - az],
  ]) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return false
  }
  return true
}

/** 兩點之間有沒有牆 */
export function clearLine(ax: number, az: number, bx: number, bz: number) {
  for (const w of WALLS) if (segHitsRect(ax, az, bx, bz, w)) return false
  return true
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 某人（位置、面向）看不看得到某點 */
export function canSee(x: number, z: number, heading: number, tx: number, tz: number, range = SIGHT_RANGE, half = SIGHT_HALF) {
  const dx = tx - x
  const dz = tz - z
  const d = Math.hypot(dx, dz)
  if (d > range) return false
  if (d > 0.5 && Math.abs(wrap(Math.atan2(dx, dz) - heading)) > half) return false
  return clearLine(x, z, tx, tz)
}

/** 床上的位置（雙人床左右各一） */
function bedSpot(room: RoomId, slot: number, count: number): XZ {
  const r = GUEST_ROOMS[room]
  const off = count > 1 ? (slot === 0 ? -0.33 : 0.33) : 0
  return [r.bed.x + off, r.pillowZ + 0.3]
}

export class NightSim {
  guests: GuestRT[] = []
  event: NightEvent
  miaogong: PatrolRT | null = null
  dog: DogRT | null = null
  /** 廟公被狗叫聲引開：走去看，看完再回來巡 */
  private mgDetour: { x: number; z: number; wait: number } | null = null
  cat: CatRT
  gecko: GeckoRT
  hour = 22
  private rnd: () => number
  private needPlan: { g: GuestRT; kind: NeedKind; at: number }[] = []
  private out: SimEvent[] = []
  private upgrades: Set<string>
  /** 法器（鬼夜市買的）＋今晚擲筊的運勢 */
  private items: Set<string>
  private fortune: string | null
  private grandmaPrevNear = new Set<string>()
  private inspectT = 0

  constructor(plan: NightPlan, opts: { seed: number; upgrades: string[]; items?: string[]; fortune?: string | null }) {
    this.rnd = seeded(opts.seed)
    this.upgrades = new Set(opts.upgrades)
    this.items = new Set(opts.items ?? [])
    this.fortune = opts.fortune ?? null
    const [cx, cz] = NODES.tea
    this.cat = { x: cx, z: cz, heading: 0, speed: 0, pose: 'sit', path: [], wait: 6, node: 'tea', possessed: false, meowT: 0 }
    this.gecko = { x: GECKO_HOME[0], z: GECKO_HOME[1], heading: 0, speed: 0, possessed: false, chirpT: 0 }
    this.event = plan.event
    for (const p of plan.parties) {
      p.members.forEach((id, slot) => {
        const def = GUESTS[id]
        const [x, z] = bedSpot(p.room, slot, p.members.length)
        const g: GuestRT = {
          id,
          def,
          room: p.room,
          slot,
          mode: 'bed',
          awake: true,
          x,
          z,
          heading: 0.5,
          speed: 0,
          comfort: 50,
          fear: 0,
          sleep: 0,
          tucked: false,
          needs: [],
          met: [],
          suspicion: 0,
          peak: 0,
          seen: 0,
          captures: 0,
          played: false,
          chatted: false,
          steps: [],
          stepT: 0,
          filming: null,
          scaredT: 0,
          tellT: 0,
          lookTarget: null,
          lookT: 2 + this.rnd() * 3,
          resleepT: 0,
          barkT: 0,
          tripsDone: 0,
          snackDone: false,
          spot: null,
          wokenCount: 0,
          sleptOnce: false,
          deepUntil: 0,
          dreamt: false,
          trail: [],
        }
        this.guests.push(g)
        for (const n of def.needs) {
          let chance = n.chance
          if (n.kind === 'cold' && this.upgrades.has('heater')) chance *= 0.5
          if (n.kind === 'mosquito' && this.upgrades.has('net')) chance = 0
          if (n.kind === 'mosquito' && this.items.has('charm')) chance *= 0.5
          if (this.rnd() < chance) this.needPlan.push({ g, kind: n.kind, at: n.at + (this.rnd() - 0.5) * 0.6 })
        }
      })
    }
    // 突發事件
    if (plan.event === 'mosquitoes' && !this.upgrades.has('net'))
      for (const g of this.guests) if (!this.items.has('charm') || this.rnd() < 0.5) this.needPlan.push({ g, kind: 'mosquito', at: 23.4 + this.rnd() * 0.4 })
    if (plan.event === 'coldsnap') for (const g of this.guests) this.needPlan.push({ g, kind: 'cold', at: 25 + this.rnd() * 0.5 })
    // 小黑每晚都睡在大門外；「狗叫」的晚上半夜會叫（有鎮狗鈴就不叫）
    const barks = plan.event === 'dog' && !this.items.has('bell')
    this.dog = { x: 1.2, z: FENCE.z + 1.3, heading: Math.PI, speed: 0, possessed: false, woofT: 0, event: barks, barking: false, calm: !barks, barkT: 0, startAt: 25.3, stopT: 0 }
    if (plan.event === 'miaogong') {
      const path = MIAOGONG_LOOP.map((n) => NODES[n])
      this.miaogong = { x: path[0][0], z: path[0][1], heading: Math.PI, speed: 0, i: 1, path, suspicion: 0, catches: 0, active: false, left: false, barkT: 0 }
    }
  }

  // -------------------------------------------------------------------------
  // 每幀
  // -------------------------------------------------------------------------

  update(dt: number, hour: number, gm: GrandmaState, objects: Record<string, ObjectState>): SimEvent[] {
    this.out = []
    this.hour = hour
    for (const g of this.guests) this.updateGuest(g, dt, hour, gm, objects)
    this.updateMiaogong(dt, hour, gm)
    this.updateDog(dt, hour, gm)
    this.updateCat(dt, gm)
    this.updateGecko(dt, gm)
    this.doorEvents(gm)
    return this.out
  }

  private emit(e: SimEvent) {
    this.out.push(e)
  }

  private bark(g: GuestRT, kind: BarkKind, cooldown = 6, quiet = false) {
    if (g.barkT > 0) return
    g.barkT = cooldown
    this.emit({ t: 'bark', who: g.id, kind, quiet })
  }

  private roomMates(g: GuestRT) {
    return this.guests.filter((o) => o.room === g.room)
  }

  /** 引魂燈、或擲到「明察秋毫」：需求一出現就看得到 */
  private get farSight() {
    return this.items.has('lantern') || this.fortune === 'insight'
  }

  /** 安眠香、或擲到「一夜好眠」：早睡、睡得沉 */
  private get calm() {
    return this.items.has('incense') || this.fortune === 'calm'
  }

  // -------------------------------------------------------------------------
  // 阿咪（貓）：沒被附身時在屋裡隨便晃；附身時跟著玩家走
  // -------------------------------------------------------------------------

  private updateCat(dt: number, gm: GrandmaState) {
    const c = this.cat
    c.meowT = Math.max(0, c.meowT - dt)
    if (gm.body === 'cat') {
      const dx = gm.x - c.x
      const dz = gm.z - c.z
      if (dx || dz) c.heading = Math.atan2(dx, dz)
      c.x = gm.x
      c.z = gm.z
      c.speed = gm.speed
      c.possessed = true
      c.pose = c.meowT > 0 ? 'meow' : gm.speed > 0.2 ? 'walk' : 'sit'
    } else {
      c.possessed = false
      if (c.path.length) {
        const [tx, tz] = c.path[0]
        const dx = tx - c.x
        const dz = tz - c.z
        const d = Math.hypot(dx, dz)
        const step = 0.8 * dt
        if (d <= step) {
          c.x = tx
          c.z = tz
          c.path.shift()
          if (!c.path.length) c.wait = 6 + this.rnd() * 14
        } else {
          c.x += (dx / d) * step
          c.z += (dz / d) * step
          c.heading = Math.atan2(dx, dz)
        }
        c.speed = 0.8
        c.pose = 'walk'
      } else {
        c.speed = 0
        c.wait -= dt
        c.pose = c.wait > 10 ? 'sleep' : 'sit'
        if (c.wait <= 0) {
          const nodes = Object.keys(NODES)
          const next = nodes[Math.floor(this.rnd() * nodes.length)]
          c.path = route(c.node, next).slice()
          c.node = next
        }
      }
    }
    // 經過醒著的客人床邊：被摸摸（附身時更會撒嬌）
    for (const g of this.guests) {
      if (!g.awake || g.mode !== 'bed' || g.scaredT > 0) continue
      if (Math.hypot(g.x - c.x, g.z - c.z) > 1.2) continue
      g.comfort += dt * HOURS_PER_SEC * (c.possessed ? 12 : 4)
      if (c.possessed && c.speed < 0.2) c.pose = 'rub'
    }
  }

  /** 接下來會出現的需求（地基主的提示）：最近的幾個 */
  upcoming(n = 3) {
    return this.needPlan
      .filter((p) => p.at > this.hour)
      .sort((a, b) => a.at - b.at)
      .slice(0, n)
      .map((p) => ({ who: p.g.def.name, room: p.g.room, kind: p.kind, at: p.at }))
  }

  /** 陰陽眼：看得到每個人心裡想要什麼 */
  revealNeeds() {
    for (const g of this.guests) for (const n of g.needs) n.known = true
  }

  /** 附身的貓喵一聲：附近醒著的人會轉頭看貓（把注意力引開） */
  meow() {
    const c = this.cat
    c.meowT = 1.2
    for (const g of this.guests) {
      if (!g.awake || g.scaredT > 0) continue
      if (Math.hypot(g.x - c.x, g.z - c.z) > 7) continue
      g.lookTarget = Math.atan2(c.x - g.x, c.z - g.z)
      g.tellT = 0.3
      g.lookT = 4 + this.rnd() * 2
    }
  }

  private isBlackout(hour: number) {
    return this.event === 'blackout' && hour >= 24 && hour < 26
  }

  private updateGuest(g: GuestRT, dt: number, hour: number, gm: GrandmaState, objects: Record<string, ObjectState>) {
    g.barkT = Math.max(0, g.barkT - dt)
    g.scaredT = Math.max(0, g.scaredT - dt)
    const on = (k: string) => !!objects[`${g.room}.${k}`]?.on

    // ---- 需求出現 ----
    for (let i = this.needPlan.length - 1; i >= 0; i--) {
      const p = this.needPlan[i]
      if (p.g !== g || hour < p.at) continue
      this.needPlan.splice(i, 1)
      if (g.met.includes(p.kind) || g.needs.some((n) => n.kind === p.kind)) continue
      if (p.kind === 'mosquito' && on('coil')) continue
      if (p.kind === 'dark' && (on('lamp') || this.upgrades.has('nightlamp')) && !this.isBlackout(hour)) continue
      if (p.kind === 'thirsty' && on('cup')) continue
      if (p.kind === 'cold' && g.tucked) continue
      if (p.kind === 'hungry' && on('dish')) continue
      g.needs.push({ kind: p.kind, since: hour, known: this.farSight })
      this.emit({ t: 'need', who: g.id, kind: p.kind })
      if (g.awake) this.bark(g, `need_${p.kind}` as BarkKind, 4)
    }
    // 停電時小夜燈沒電：怕黑的人又怕了
    if (this.isBlackout(hour) && g.def.type === 'timid' && !g.needs.some((n) => n.kind === 'dark') && !g.met.includes('dark') && g.awake) {
      g.needs.push({ kind: 'dark', since: hour, known: false })
    }
    // 需求沒解決：舒適度慢慢掉；蚊子太久會被咬醒
    for (const n of g.needs) {
      g.comfort -= 5 * dt * HOURS_PER_SEC
      if (n.kind === 'mosquito' && !g.awake && hour - n.since > 0.35) this.wake(g, 'need_mosquito')
      if (n.kind === 'cold' && !g.awake && hour - n.since > 0.8) this.wake(g, 'need_cold')
    }

    // ---- 行程：起夜、找宵夜、巡夜拍攝 ----
    if (g.steps.length === 0 && g.mode === 'bed') {
      const trip = g.def.trips[g.tripsDone]
      if (trip !== undefined && hour >= trip) {
        g.tripsDone++
        this.startTrip(g)
      } else if (g.def.snackRun && !g.snackDone && hour >= g.def.snackRun && g.needs.some((n) => n.kind === 'hungry')) {
        g.snackDone = true
        if (!g.awake) this.wake(g, 'need_hungry')
        g.steps = [{ path: route(BED_NODE[g.room], 'kitchen_stove') }, { wait: 10, spot: 'stove', look: [-9.3, 4.4] }, { path: route('kitchen_stove', BED_NODE[g.room]), toBed: true }]
        this.leaveBed(g)
      } else if (g.def.patrol && g.awake && hour >= 22.4 && hour < g.def.bedtime - 0.3) {
        this.startPatrol(g)
      }
    }
    this.followSteps(g, dt)

    // ---- 睡覺 ----
    if (g.mode === 'bed') {
      const blocked = g.needs.some((n) => BLOCKS_SLEEP.includes(n.kind))
      if (g.awake) {
        g.resleepT = Math.max(0, g.resleepT - dt)
        const sleepy = hour >= g.def.bedtime - (this.calm ? 0.33 : 0) && g.resleepT <= 0 && g.scaredT <= 0 && g.fear < 70
        if (sleepy && !blocked) {
          g.awake = false
          g.sleep = g.tucked ? 0.4 : 0.1
          if (!g.sleptOnce) this.bark(g, 'sleepy', 0, true)
          g.sleptOnce = true
          this.emit({ t: 'asleep', who: g.id })
        } else if (sleepy && blocked && hour >= g.def.bedtime + 0.2 && !g.needs.some((n) => n.kind === 'insomnia') && g.def.type !== 'child') {
          // 撐太久：焦躁得睡不著
          if (g.def.type === 'timid' || g.def.type === 'business' || g.def.type === 'parent') {
            g.needs.push({ kind: 'insomnia', since: hour, known: false })
            this.bark(g, 'need_insomnia', 4)
          }
        }
      } else {
        g.sleep = Math.min(1, g.sleep + dt * HOURS_PER_SEC * 1.2)
        // 睡一覺，驚嚇慢慢淡掉；蓋好被子睡得更舒服
        g.fear = Math.max(0, g.fear - dt * HOURS_PER_SEC * 3)
        if (g.tucked) g.comfort += dt * HOURS_PER_SEC * 2
      }
    }

    // ---- 視線：看到阿嬤了嗎 ----
    this.sight(g, dt, gm)
    this.lookAround(g, dt)
  }

  private leaveBed(g: GuestRT) {
    const [x, z] = GUEST_ROOMS[g.room].bedside
    g.mode = 'walk'
    g.x = x
    g.z = z
    g.awake = true
  }

  private backToBed(g: GuestRT) {
    const mates = this.roomMates(g)
    const [x, z] = bedSpot(g.room, g.slot, mates.length)
    g.mode = 'bed'
    g.x = x
    g.z = z
    g.speed = 0
    g.filming = null
    g.spot = null
    g.resleepT = 8 + this.rnd() * 6
    g.heading = 0.5
  }

  private startTrip(g: GuestRT) {
    if (!g.awake) g.awake = true
    this.bark(g, 'bathroom', 2, true)
    g.steps = [
      { path: route(BED_NODE[g.room], 'bath_toilet') },
      { wait: 8, spot: 'toilet', look: [NODES.bath_toilet[0] + 1, NODES.bath_toilet[1]] },
      { path: route('bath_toilet', 'bath_sink') },
      { wait: 5, spot: 'sink', look: [SINK.x + 1, SINK.z] },
      { path: route('bath_sink', BED_NODE[g.room]), toBed: true },
    ]
    this.leaveBed(g)
  }

  private startPatrol(g: GuestRT) {
    const steps: Step[] = []
    let from = BED_NODE[g.room]
    for (const p of PATROL) {
      steps.push({ path: route(from, p.node) })
      steps.push({ wait: p.film, film: p.area, look: p.look })
      from = p.node
    }
    steps.push({ path: route(from, BED_NODE[g.room]), toBed: true })
    g.steps = steps
    this.leaveBed(g)
  }

  private followSteps(g: GuestRT, dt: number) {
    const s = g.steps[0]
    if (!s) return
    if (s.path) {
      g.mode = 'walk'
      g.filming = null
      g.spot = null
      let left = WALK_SPEED * dt * (g.def.patrol ? 1.1 : 1)
      while (left > 0 && s.path.length) {
        const [tx, tz] = s.path[0]
        const dx = tx - g.x
        const dz = tz - g.z
        const d = Math.hypot(dx, dz)
        if (d < 1e-3) {
          s.path.shift()
          continue
        }
        const step = Math.min(d, left)
        g.x += (dx / d) * step
        g.z += (dz / d) * step
        // 每走 0.45 公尺留一個腳印（最多 40 個）
        const last = g.trail[g.trail.length - 1]
        if (!last || Math.hypot(last[0] - g.x, last[1] - g.z) > 0.45) {
          g.trail.push([g.x, g.z, this.hour, last ? 1 - last[3] : 0])
          if (g.trail.length > 40) g.trail.shift()
        }
        if (g.scaredT <= 0 && g.tellT <= 0) g.heading = Math.atan2(dx, dz)
        left -= step
        if (step >= d) s.path.shift()
      }
      g.speed = WALK_SPEED
      if (!s.path.length) {
        g.steps.shift()
        g.stepT = 0
        if (s.toBed) this.backToBed(g)
      }
      return
    }
    // 站著：等、拍、看
    g.mode = 'stand'
    g.speed = 0
    g.spot = s.spot ?? null
    g.filming = s.film ?? null
    if (s.look && g.tellT <= 0 && g.scaredT <= 0 && g.lookTarget === null) g.heading = Math.atan2(s.look[0] - g.x, s.look[1] - g.z)
    g.stepT += dt
    if (g.filming && g.stepT < dt * 1.5) this.bark(g, 'need_scare', 8)
    if (g.stepT >= (s.wait ?? 0)) {
      g.steps.shift()
      g.stepT = 0
      if (s.toBed) this.backToBed(g)
    }
  }

  /** 醒著的人偶爾轉頭看看四周；轉頭前先「嗯？」一下（給玩家反應時間） */
  private lookAround(g: GuestRT, dt: number) {
    if (!g.awake || g.scaredT > 0) return
    if (g.tellT > 0) {
      g.tellT -= dt
      if (g.tellT <= 0 && g.lookTarget !== null) {
        g.heading = g.lookTarget
        g.lookTarget = null
        g.lookT = 2.5 + this.rnd() * 2
      }
      return
    }
    if (g.mode === 'walk') return
    g.lookT -= dt
    if (g.lookT <= 0) {
      const base = g.mode === 'bed' ? 0.5 : g.heading
      if (g.mode === 'bed' && this.rnd() < 0.3) {
        // 翻身面向牆：背對房間 5–8 秒（阿嬤做事的好時機）
        g.heading = wrap(base + Math.PI + (this.rnd() - 0.5) * 0.8)
        g.lookT = 5 + this.rnd() * 3
        return
      }
      g.lookTarget = wrap(base + (this.rnd() - 0.5) * 2.6)
      g.tellT = 0.7
    }
  }

  private sight(g: GuestRT, dt: number, gm: GrandmaState) {
    if (!gm.home || !g.awake || g.scaredT > 0 || gm.hidden || gm.body) {
      g.suspicion = Math.max(0, g.suspicion - dt * 0.5)
      return
    }
    const visible = canSee(g.x, g.z, g.heading, gm.x, gm.z)
    // 需求要靠近才看得出來（觀察）
    if (Math.hypot(gm.x - g.x, gm.z - g.z) < 4.5 && clearLine(gm.x, gm.z, g.x, g.z)) for (const n of g.needs) n.known = true
    if (!visible) {
      if (g.peak > 0.72 && g.suspicion < 0.25) {
        this.emit({ t: 'nearmiss' })
        g.peak = 0
      }
      g.suspicion = Math.max(0, g.suspicion - dt * 0.35)
      return
    }
    const d = Math.hypot(gm.x - g.x, gm.z - g.z)
    const distF = clamp(1.25 - d / SIGHT_RANGE, 0.3, 1.15)
    // 一二三木頭人：不動的時候幾乎看不到；端著宵夜的話，飄在空中的碗還是很顯眼
    let move = gm.speed > 0.3 ? gm.walkFactor * (gm.speed > 3 ? 1.6 : 1) : gm.carrying ? 0.45 : 0.06
    if (gm.busy) move = 3
    g.suspicion += 1.5 * distF * move * dt
    if (g.suspicion > 0.4) this.bark(g, 'suspect', 5)
    g.peak = Math.max(g.peak, g.suspicion)
    if (g.suspicion >= 1) this.spotted(g)
  }

  /** 客人看到阿嬤了 */
  spotted(g: GuestRT, extraShock = 0) {
    g.suspicion = 0.35
    g.peak = 0
    g.seen++
    if (g.def.seesGhost) {
      g.comfort += 8
      this.emit({ t: 'happySeen', who: g.id })
      this.bark(g, 'seen', 3)
      // 媽媽看到小孩對空氣講話
      if (g.def.type === 'child') {
        for (const o of this.roomMates(g)) {
          if (o.def.type === 'parent' && o.awake && canSee(o.x, o.z, o.heading, g.x, g.z, 4, Math.PI)) {
            o.fear += 8
            this.emit({ t: 'worry', who: o.id })
          }
        }
      }
      return
    }
    if (g.def.type === 'thrill') {
      g.fear += g.def.shock
      if (g.filming || g.mode === 'bed') {
        g.captures++
        g.comfort += 15
        this.emit({ t: 'capture', who: g.id })
        this.bark(g, 'capture', 2)
        this.noise(g.x, g.z, 0.55, g)
      } else {
        g.comfort += 6
        this.bark(g, 'seen', 2)
      }
      return
    }
    g.fear += g.def.shock + extraShock
    g.comfort -= 8
    g.scaredT = 1.6
    this.emit({ t: 'seen', who: g.id, shock: g.def.shock + extraShock })
    this.emit({ t: 'scream', who: g.id })
    this.bark(g, 'seen', 2)
    // 尖叫會吵醒別人
    this.noise(g.x, g.z, 0.75, g)
  }

  private wake(g: GuestRT, why: BarkKind) {
    if (g.awake) return
    g.awake = true
    g.sleep = 0
    g.wokenCount++
    g.resleepT = 25 + this.rnd() * 15
    this.emit({ t: 'woken', who: g.id })
    this.bark(g, why, 2)
  }

  // -------------------------------------------------------------------------
  // 聲音：牆會擋一半；醒著的人會轉頭、會怕；睡著的人可能被吵醒
  // -------------------------------------------------------------------------

  noise(x: number, z: number, loud: number, source?: GuestRT) {
    for (const g of this.guests) {
      if (g === source) continue
      const d = Math.hypot(g.x - x, g.z - z)
      let p = loud * clamp(1 - d / 12, 0, 1)
      if (!clearLine(x, z, g.x, g.z)) p *= 0.5
      if (p < 0.05) continue
      if (g.awake) {
        if (g.scaredT <= 0 && g.tellT <= 0) {
          g.lookTarget = Math.atan2(x - g.x, z - g.z)
          g.tellT = 0.5
        }
        if (!g.def.seesGhost && g.def.type !== 'thrill') g.fear += p * 8
        if (g.def.type === 'business') g.comfort -= p * 14
        if (p > 0.12) this.bark(g, 'hear', 6)
      } else {
        const threshold = (1 - g.def.lightSleeper) * (0.25 + g.sleep * 0.6) * (this.calm ? 1.4 : 1)
        if (p > threshold && this.hour >= g.deepUntil) {
          if (g.def.type === 'business') g.comfort -= 10
          this.wake(g, 'woken')
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 動作的效果（store 扣陰氣、改物件狀態之後呼叫）
  // -------------------------------------------------------------------------

  /** 滿足房間裡所有人的某個需求 */
  satisfy(room: RoomId, kind: NeedKind, comfort: number) {
    let any = false
    for (const g of this.guests) {
      if (g.room !== room) continue
      const i = g.needs.findIndex((n) => n.kind === kind)
      if (i < 0) continue
      g.needs.splice(i, 1)
      g.met.push(kind)
      g.comfort += comfort
      any = true
      this.bark(g, 'thanks', 3, !g.awake)
      if (kind === 'play') g.played = true
      if (kind === 'chat') g.chatted = true
      if (kind === 'insomnia' || kind === 'dark') g.resleepT = 0
    }
    // 老夫妻一起聊：兩個人都算聊過
    if (any && kind === 'chat') for (const g of this.guests) if (g.room === room && g.def.type === 'elder' && !g.chatted) {
      g.chatted = true
      g.comfort += comfort * 0.6
    }
    return any
  }

  /** 托夢的結果（DESIGN §25.1）：成功 → 睡得很沉 1.5 小時、舒適 +20、心事（睡不著）解決 */
  dreamResult(id: GuestId, ok: boolean) {
    const g = this.guests.find((x) => x.id === id)
    if (!g) return
    if (!ok) {
      g.comfort -= 4
      return
    }
    g.awake = false
    g.sleep = 1
    g.deepUntil = this.hour + 1.5
    g.comfort += 20
    g.dreamt = true
    g.needs = g.needs.filter((n) => n.kind !== 'insomnia')
    if (!g.met.includes('insomnia')) g.met.push('insomnia')
  }

  tuck(room: RoomId) {
    for (const g of this.guests) {
      if (g.room !== room || g.mode !== 'bed') continue
      g.tucked = true
      g.sleep = Math.min(1, g.sleep + 0.3)
      g.comfort += 6
    }
  }

  /**
   * 阿嬤在 (x, z) 做了一個動作：看得到的醒著的人會「看到」（慈祥的動作被看到＝嚇到三倍，DESIGN §6）。
   * 回傳被看到幾次。
   */
  actionSeen(x: number, z: number, room: RoomId | null, kindAction: boolean) {
    let n = 0
    for (const g of this.guests) {
      if (!this.sees(g, x, z, room)) continue
      n++
      this.spotted(g, kindAction && !g.def.seesGhost ? g.def.shock * 0.8 : 0)
    }
    return n
  }

  /** 醒著的 g 看得到 (x, z) 嗎？同房間躺在床上的人餘光比較廣（±100°），但轉頭看別處時背後還是看不到 */
  sees(g: GuestRT, x: number, z: number, room: RoomId | null) {
    if (!g.awake || g.scaredT > 0) return false
    if (canSee(g.x, g.z, g.heading, x, z)) return true
    const inRoom = room !== null && g.room === room && g.mode === 'bed'
    return inRoom && Math.abs(wrap(Math.atan2(x - g.x, z - g.z) - g.heading)) < PERIPHERAL
  }

  /** 在 (x, z) 做事會不會被看不到鬼的客人看到（UI 提示、機器人測試用） */
  wouldBeSeen(x: number, z: number, room: RoomId | null) {
    return this.guests.some((g) => !g.def.seesGhost && this.sees(g, x, z, room))
  }

  /**
   * 嚇人的動作：area 是發生的地方（'r1' | 'r2' | 'gm' | 'bath' | 'yard'），(x, z) 是聲音來源。
   * YouTuber 正在拍那一區、或裝了監視器 → 拍到；其他醒著的人會怕。
   */
  scare(area: string, x: number, z: number, fear: number, loud: number, cctv: boolean) {
    let captured = false
    for (const g of this.guests) {
      const here = g.filming === area || (g.mode === 'bed' && g.room === area) || (g.spot === 'sink' && area === 'bath')
      if (g.def.type === 'thrill' && g.awake && (here || cctv)) {
        g.captures++
        g.fear += fear
        g.comfort += 12
        captured = true
        this.satisfy(g.room, 'scare', 0)
        this.emit({ t: 'capture', who: g.id })
        this.bark(g, 'capture', 1)
        continue
      }
      if (!here || !g.awake || g.def.seesGhost) continue
      g.fear += fear
      g.scaredT = 1.2
      if (fear >= 15) {
        this.emit({ t: 'scream', who: g.id })
        this.bark(g, 'seen', 2)
      } else this.bark(g, 'hear', 3)
    }
    this.noise(x, z, loud)
    return captured
  }

  // -------------------------------------------------------------------------
  // 門自己打開（鬼開門）：看到的人會怕一下
  // -------------------------------------------------------------------------

  private doorEvents(gm: GrandmaState) {
    if (!gm.home) return
    const doors: [string, XZ][] = [
      ['r1', [GUEST_ROOMS.r1.doorIn[0] - 0.5, GUEST_ROOMS.r1.doorIn[1]]],
      ['r2', [GUEST_ROOMS.r2.doorIn[0] + 0.5, GUEST_ROOMS.r2.doorIn[1]]],
      ['bath', [7, -0.3]],
      ['kitchen', [-7, 2.15]],
    ]
    for (const [id, [x, z]] of doors) {
      const near = Math.hypot(gm.x - x, gm.z - z) < 1.45
      const was = this.grandmaPrevNear.has(id)
      if (near && !was) {
        this.grandmaPrevNear.add(id)
        // 如果有客人也在門邊，就當成是客人開的
        if (this.guests.some((g) => Math.hypot(g.x - x, g.z - z) < 1.6)) continue
        for (const g of this.guests) {
          if (!g.awake || g.def.seesGhost || g.def.type === 'thrill') continue
          if (canSee(g.x, g.z, g.heading, x, z)) {
            g.fear += 5
            this.bark(g, 'door', 5)
          }
        }
      } else if (!near && was) this.grandmaPrevNear.delete(id)
    }
  }

  // -------------------------------------------------------------------------
  // 廟公巡夜（壓力 3 以上的晚上）
  // -------------------------------------------------------------------------

  private updateMiaogong(dt: number, hour: number, gm: GrandmaState) {
    const m = this.miaogong
    if (!m || m.left) return
    if (!m.active) {
      if (hour >= 22.5) {
        m.active = true
        this.emit({ t: 'mg', kind: 'arrive' })
      }
      return
    }
    if (hour >= 26.5) {
      m.left = true
      m.active = false
      this.emit({ t: 'mg', kind: 'leave' })
      return
    }
    m.barkT = Math.max(0, m.barkT - dt)
    // 被狗叫聲引開：先走過去看一看
    if (this.mgDetour) {
      const dv = this.mgDetour
      const ddx = dv.x - m.x
      const ddz = dv.z - m.z
      const dd = Math.hypot(ddx, ddz)
      if (dd > 1.2) {
        m.x += (ddx / dd) * 1.3 * dt
        m.z += (ddz / dd) * 1.3 * dt
        m.heading = Math.atan2(ddx, ddz)
        m.speed = 1.3
      } else {
        m.speed = 0
        m.heading += dt * 0.8
        dv.wait -= dt
        if (dv.wait <= 0) this.mgDetour = null
      }
      return
    }
    // 沿著路線繞
    const [tx, tz] = m.path[m.i]
    const dx = tx - m.x
    const dz = tz - m.z
    const d = Math.hypot(dx, dz)
    const step = 1.05 * dt
    if (d <= step) {
      m.x = tx
      m.z = tz
      m.i = (m.i + 1) % m.path.length
    } else {
      m.x += (dx / d) * step
      m.z += (dz / d) * step
      m.heading = Math.atan2(dx, dz)
    }
    m.speed = 1.05
    if (m.barkT <= 0 && Math.random() < dt * 0.05) {
      m.barkT = 12
      this.emit({ t: 'mg', kind: 'patrol' })
    }
    // 手電筒：看得遠、比較窄；木頭人對他比較沒用
    if (!gm.home || gm.body) return
    if (gm.hidden) {
      // 躲著：廟公經過會隨手打開檢查（衣櫃、神桌下……）
      this.inspectT = Math.max(0, this.inspectT - dt)
      if (Math.hypot(m.x - gm.x, m.z - gm.z) < 1.8 && this.inspectT <= 0) {
        this.inspectT = 4
        if (this.rnd() < 0.35) {
          m.catches++
          this.emit({ t: 'mg', kind: 'catch' })
          this.emit({ t: 'mgCatch', count: m.catches })
        } else this.emit({ t: 'mg', kind: 'spot' })
      }
      return
    }
    const sees = canSee(m.x, m.z, m.heading, gm.x, gm.z, 7.5, (42 * Math.PI) / 180)
    if (sees) {
      const move = gm.speed > 0.3 ? gm.walkFactor : gm.carrying ? 0.6 : 0.2
      const before = m.suspicion
      m.suspicion += 1.4 * move * dt
      if (before < 0.4 && m.suspicion >= 0.4 && m.barkT <= 0) {
        m.barkT = 5
        this.emit({ t: 'mg', kind: 'spot' })
      }
      if (m.suspicion >= 1) {
        m.suspicion = 0
        m.catches++
        this.emit({ t: 'mg', kind: 'catch' })
        this.emit({ t: 'mgCatch', count: m.catches })
      }
    } else m.suspicion = Math.max(0, m.suspicion - dt * 0.3)
  }

  // -------------------------------------------------------------------------
  // 狗（「狗叫」的晚上）：半夜對著圍牆外叫，會吵醒淺眠的客人；阿嬤去摸摸牠就好
  // -------------------------------------------------------------------------

  private updateDog(dt: number, hour: number, gm: GrandmaState) {
    const d = this.dog
    if (!d) return
    d.woofT = Math.max(0, d.woofT - dt)
    if (gm.body === 'dog') {
      const dx = gm.x - d.x
      const dz = gm.z - d.z
      if (dx || dz) d.heading = Math.atan2(dx, dz)
      d.x = gm.x
      d.z = gm.z
      d.speed = gm.speed
      d.possessed = true
      // 附身就不亂叫了
      if (d.barking) this.calmDog()
      return
    }
    d.possessed = false
    d.speed = 0
    if (d.calm) return
    if (!d.barking && hour >= d.startAt) {
      d.barking = true
      this.emit({ t: 'dog', kind: 'start' })
    }
    if (!d.barking) return
    d.barkT -= dt
    if (d.barkT <= 0) {
      d.barkT = 2.2
      this.emit({ t: 'dog', kind: 'bark' })
      this.noise(d.x, d.z, 0.55)
    }
    void gm
  }

  private updateGecko(dt: number, gm: GrandmaState) {
    const g = this.gecko
    g.chirpT = Math.max(0, g.chirpT - dt)
    if (gm.body === 'gecko') {
      const dx = gm.x - g.x
      const dz = gm.z - g.z
      if (dx || dz) g.heading = Math.atan2(dx, dz)
      g.x = gm.x
      g.z = gm.z
      g.speed = gm.speed
      g.possessed = true
    } else {
      g.possessed = false
      g.speed = 0
    }
  }

  /** 今晚的碟仙玩過了 */
  ouijaDone = false

  /** 碟仙的結果（DESIGN §26.2）：安慰 → 舒適；嚇他 → 驚嚇；說出只有鬼知道的事 → 觀眾暴增（算拍到） */
  ouija(id: GuestId, r: { comfort: number; scare: number; secret: number }) {
    this.ouijaDone = true
    const g = this.guests.find((x) => x.id === id)
    if (!g) return
    g.comfort += r.comfort * 7 + r.secret * 4
    g.fear += r.scare * 9 + r.secret * 4
    for (let i = 0; i < r.secret; i++) {
      g.captures++
      this.emit({ t: 'capture', who: g.id })
    }
    if (r.scare + r.secret > 0) this.satisfy(g.room, 'scare', 0)
  }

  /** 附身的小黑吠一聲：附近醒著的人會嚇一跳、轉頭看；廟公會走過去看看 */
  woof() {
    const d = this.dog
    if (!d) return
    d.woofT = 0.8
    this.noise(d.x, d.z, 0.5)
    for (const g of this.guests) {
      if (!g.awake || g.def.seesGhost) continue
      if (Math.hypot(g.x - d.x, g.z - d.z) > 8) continue
      g.fear += g.def.type === 'timid' ? 5 : 2
    }
    const m = this.miaogong
    if (m?.active && Math.hypot(m.x - d.x, m.z - d.z) < 16) {
      this.mgDetour = { x: d.x, z: d.z, wait: 10 }
      this.emit({ t: 'mg', kind: 'spot' })
    }
  }

  /** 附身的壁虎叫一聲（嘖嘖嘖）：附近醒著的人抬頭看天花板 */
  chirp() {
    const k = this.gecko
    k.chirpT = 1.0
    for (const g of this.guests) {
      if (!g.awake || g.scaredT > 0) continue
      if (Math.hypot(g.x - k.x, g.z - k.z) > 6) continue
      g.lookTarget = Math.atan2(k.x - g.x, k.z - g.z)
      g.tellT = 0.3
      g.lookT = 4 + this.rnd() * 2
    }
  }

  calmDog() {
    if (!this.dog) return false
    this.dog.calm = true
    this.dog.barking = false
    this.emit({ t: 'dog', kind: 'calm' })
    return true
  }

  // -------------------------------------------------------------------------
  // 畫面用
  // -------------------------------------------------------------------------

  /** 每間客房天花板燈的亮度：有人醒著在房裡 → 亮；都睡了 → 很暗；停電 → 全黑 */
  roomLit(hour: number): Record<RoomId, number> {
    const out: Record<RoomId, number> = { r1: 0, r2: 0 }
    if (this.isBlackout(hour)) return out
    for (const r of ['r1', 'r2'] as RoomId[]) {
      const mates = this.guests.filter((g) => g.room === r)
      if (!mates.length) continue
      out[r] = mates.some((g) => g.awake && g.mode === 'bed') ? 1 : 0.1
    }
    return out
  }

  blackout(hour: number) {
    return this.isBlackout(hour)
  }
}

export const MIRROR_SPOT: XZ = [SINK.x, SINK.z]
export const ROCKER_SPOT: XZ = [ROCKER.x, ROCKER.z]
