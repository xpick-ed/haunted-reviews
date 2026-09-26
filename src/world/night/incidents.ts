import { FENCE, GUEST_ROOMS, TEA, WING_BACK_DOOR_Z, WING_L, WING_R } from '../../scene/layout'
import { seeded } from '../rng'
import type { Hotspot } from '../hotspots'
import type { Meta } from './director'
import type { NightPlan } from './plan'
import { BED_NODE, NODES, route } from './nav'
import { canSee, type GrandmaState, type GuestRT, type NightSim, type SimPlugin } from './sim'
import type { GuestId, RoomId } from './types'

// 半夜突發事件（DESIGN §27.2）：純邏輯（Node 可測）。director.ts 每晚呼叫 createIncidents()，
// 回傳 null 表示今晚沒有事件。畫面在 src/scene/Incidents.tsx、HUD 在 src/ui/IncidentHud.tsx。
//
// 第 3 晚起、廟公沒來的晚上，一晚最多一件、大約一半的機率（用第幾晚當種子，同一晚重玩一樣）：
//   小偷      01:30 翻牆進來試門；讓他看到阿嬤、在他附近弄出聲音、或附身小黑吠他 → 嚇跑
//   夢遊      02:30 有客人夢遊往水缸、大門走；站在他前面擋住，再走在前面把他帶回床上
//   小孩走失  00:30 小宇跑出去找阿咪、躲起來；找到他（聽笑聲），帶他回去
//   醉漢      23:30 在門口唱歌（很吵）；站在他旁邊聽他說心事，或附身小黑把他嚇走
//   保險絲    00:00 兩間客房停電；去左護龍前面牆上的電箱修（小遊戲）
//
// 畫面、HUD 讀 incidentState.current（跟 night.sim 一樣放在模組變數）。

type XZ = [number, number]

export type IncidentKind = 'thief' | 'sleepwalk' | 'lost' | 'drunk' | 'fuse'
export type IncidentStatus = 'waiting' | 'active' | 'resolved' | 'failed' | 'cancelled'

export const INCIDENT_INFO: Record<IncidentKind, { title: string; icon: string }> = {
  thief: { title: '小偷', icon: '🥷' },
  sleepwalk: { title: '有客人在夢遊', icon: '🌙' },
  lost: { title: '小宇不見了', icon: '🧒' },
  drunk: { title: '門口的醉漢', icon: '🍶' },
  fuse: { title: '保險絲燒掉了', icon: '⚡' },
}

/**
 * 電箱：左護龍前面那道山牆（朝南、靠圍牆那邊），牆角旁邊（中間有圓窗）。
 * 朝著鏡頭，玩家看得到；站在它前面修
 */
export const FUSE_BOX = { x: WING_L.x0 + 0.5, z: WING_L.z1 + 0.14, standX: WING_L.x0 + 0.5, standZ: WING_L.z1 + 0.95 }

/** 埕上的大水缸（夢遊的人會走過去撞到） */
const YARD_JAR: XZ = [-5.35, 6.55]
/** 大門（圍牆中間的開口） */
const GATE: XZ = [0, FENCE.z - 0.25]
/** 大門外的路邊 */
const OUTSIDE: XZ = [0.3, FENCE.z + 1.6]

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz)

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

/** 離 (x, z) 最近的路點名稱 */
function nearestNode(x: number, z: number) {
  let best = 'yardC'
  let bd = Infinity
  for (const [k, [nx, nz]] of Object.entries(NODES)) {
    const d = dist(x, z, nx, nz)
    if (d < bd) {
      bd = d
      best = k
    }
  }
  return best
}

/**
 * 跟著阿嬤走的「腳印」：記下阿嬤走過的點，跟的人照著點走（不會直接穿牆抄近路），
 * 保持 gap 公尺的距離。
 */
class Trail {
  pts: XZ[] = []
  push(x: number, z: number) {
    const last = this.pts[this.pts.length - 1]
    if (!last || dist(last[0], last[1], x, z) > 0.3) {
      this.pts.push([x, z])
      if (this.pts.length > 200) this.pts.shift()
    }
  }
  /** 從 (x, z) 沿著腳印到最後一個點的長度 */
  lengthFrom(x: number, z: number) {
    let len = 0
    let px = x
    let pz = z
    for (const [qx, qz] of this.pts) {
      len += dist(px, pz, qx, qz)
      px = qx
      pz = qz
    }
    return len
  }
  /** 跟的人往前走一步（離阿嬤還遠於 gap 才走）；回傳朝向 */
  follow(p: { x: number; z: number }, speed: number, gap: number, dt: number) {
    // 太靠近的點先丟掉
    while (this.pts.length && dist(p.x, p.z, this.pts[0][0], this.pts[0][1]) < 0.2) this.pts.shift()
    if (this.lengthFrom(p.x, p.z) <= gap || !this.pts.length) return null
    const want = Math.min(speed * dt, this.lengthFrom(p.x, p.z) - gap)
    return walk(p, this.pts, want / Math.max(dt, 1e-4), dt)
  }
}

// ---------------------------------------------------------------------------
// 共用的外殼
// ---------------------------------------------------------------------------

export abstract class Incident implements SimPlugin {
  abstract readonly kind: IncidentKind
  abstract readonly startAt: number
  status: IncidentStatus = 'waiting'
  /** 結果（HUD 顯示幾秒） */
  outcome = ''
  outcomeT = 0
  /** 最近一幀阿嬤的狀態（HUD 算提示用） */
  gm: GrandmaState | null = null
  hour = 22
  protected sim: NightSim
  protected rnd: () => number

  constructor(sim: NightSim, rnd: () => number) {
    this.sim = sim
    this.rnd = rnd
  }

  get title() {
    return INCIDENT_INFO[this.kind].title
  }

  /** 在 update 外面（熱點、小遊戲的回呼）發的事件先排著，下一幀 update 再送（sim 每幀開頭會清掉事件） */
  private pending: { kind: string; data: unknown }[] = []
  private inUpdate = false

  update(dt: number, hour: number, gm: GrandmaState) {
    this.inUpdate = true
    for (const e of this.pending) this.sim.emitCustom(e.kind, e.data)
    this.pending = []
    this.gm = gm
    this.hour = hour
    if (this.outcomeT > 0) this.outcomeT = Math.max(0, this.outcomeT - dt)
    if (this.status === 'waiting' && hour >= this.startAt) this.begin(hour)
    this.tick(dt, hour, gm)
    this.inUpdate = false
  }

  protected post(kind: string, data: unknown) {
    if (this.inUpdate) this.sim.emitCustom(kind, data)
    else this.pending.push({ kind, data })
  }

  /** HUD 上的提示（現在該做什麼） */
  abstract hint(): string
  protected abstract begin(hour: number): void
  protected abstract tick(dt: number, hour: number, gm: GrandmaState): void

  protected line(id: string) {
    this.post('line', { id })
  }
  protected reward(merit: number, say?: string) {
    this.post('incident.reward', { merit, say })
  }
  protected sfx(name: string) {
    this.post('incident.sfx', { name })
  }
  protected finish(ok: boolean, text: string) {
    if (this.status === 'resolved' || this.status === 'failed') return
    this.status = ok ? 'resolved' : 'failed'
    this.outcome = text
    this.outcomeT = 6
    this.post('incident.end', { kind: this.kind, ok })
  }
  protected guest(id: GuestId) {
    return this.sim.guests.find((g) => g.id === id)
  }
  protected note(g: GuestRT, text: string) {
    this.sim.reviewNotes[g.id] = text
  }
}

/** 讓阿嬤「被看到」要的條件：在家、沒躲著、沒附身 */
const ghostVisible = (gm: GrandmaState) => gm.home && !gm.hidden && !gm.body

// ---------------------------------------------------------------------------
// 小偷
// ---------------------------------------------------------------------------

type ThiefPhase = 'climbIn' | 'sneak' | 'try' | 'inside' | 'steal' | 'leave' | 'flee' | 'climbOut' | 'gone'

export class Thief extends Incident {
  readonly kind = 'thief'
  readonly startAt = 25.5
  x = -3.2
  z = FENCE.z + 0.6
  heading = Math.PI
  speed = 0
  /** 爬牆的高度 0..1（畫面用） */
  climb = 0
  phase: ThiefPhase = 'climbIn'
  /** 身上有偷來的東西 */
  loot = false
  /** 偷了哪間房 */
  room: RoomId
  /** 嚇跑時掉在地上的袋子 */
  bag: { x: number; z: number; room: RoomId; returned: boolean } | null = null
  /** 有東西被偷了（還沒還） */
  stolen = false
  private path: XZ[] = []
  private waitT = 0
  private climbT = 0
  private exitX = -3.2
  private clock = 0
  private noises: { x: number; z: number; loud: number; t: number }[] = []

  constructor(sim: NightSim, rnd: () => number) {
    super(sim, rnd)
    this.room = sim.guests.some((g) => g.room === 'r1') ? 'r1' : 'r2'
    // 聽聲音：敲門、燈閃、嚇人的動作、小黑吠……都會經過 sim.noise
    const orig = sim.noise.bind(sim)
    sim.noise = (x, z, loud, source) => {
      this.noises.push({ x, z, loud, t: this.clock })
      orig(x, z, loud, source)
    }
  }

  hint() {
    if (this.status === 'waiting') return ''
    if (this.bag && !this.bag.returned) return '小偷掉的袋子在埕上：撿起來，把東西還給客人'
    if (this.status !== 'active') return ''
    if (this.phase === 'inside' || this.phase === 'steal') return '小偷進房間了！快去嚇他'
    if (this.phase === 'leave' || this.phase === 'climbOut') return '小偷要帶著東西走了！讓他看到妳，或弄出聲音'
    return '有人翻牆進來了！讓他看到妳、在他旁邊敲門，或附身小黑吠他'
  }

  protected begin() {
    this.status = 'active'
    this.phase = 'climbIn'
    this.climbT = 0
    this.line('inc.thief.enter')
  }

  protected tick(dt: number, _hour: number, gm: GrandmaState) {
    this.clock += dt
    this.noises = this.noises.filter((n) => this.clock - n.t < 1.2)
    if (this.status === 'waiting' || this.phase === 'gone') return
    this.speed = 0
    switch (this.phase) {
      case 'climbIn': {
        this.climbT += dt
        const k = Math.min(1, this.climbT / 2.6)
        this.z = FENCE.z + 0.6 - 1.2 * k
        this.climb = Math.sin(k * Math.PI)
        if (k >= 1) {
          this.climb = 0
          this.phase = 'sneak'
          this.path = [NODES.yardFront, ...route('yardFront', `${this.room}_door_out`).slice(1)]
        }
        break
      }
      case 'sneak':
      case 'inside':
      case 'leave':
      case 'flee': {
        const sp = this.phase === 'flee' ? 3.0 : this.phase === 'leave' ? 1.15 : 0.9
        const h = walk(this, this.path, sp, dt)
        if (h !== null) this.heading = h
        this.speed = sp
        if (this.path.length) break
        if (this.phase === 'sneak') {
          this.phase = 'try'
          this.waitT = 5
          this.heading = Math.atan2(NODES[`${this.room}_door_in`][0] - this.x, NODES[`${this.room}_door_in`][1] - this.z)
          this.sfx('knock')
          this.line('inc.thief.door')
        } else if (this.phase === 'inside') {
          this.phase = 'steal'
          this.waitT = 4
        } else {
          this.phase = 'climbOut'
          this.climbT = 0
          this.heading = 0
        }
        break
      }
      case 'try':
        this.waitT -= dt
        if (this.waitT <= 0) this.enterRoom()
        break
      case 'steal':
        this.waitT -= dt
        if (this.waitT <= 0) this.stealNow()
        break
      case 'climbOut': {
        this.climbT += dt
        const k = Math.min(1, this.climbT / 1.8)
        this.z = FENCE.z - 0.5 + 1.2 * k
        this.climb = Math.sin(k * Math.PI)
        if (k >= 1) {
          this.climb = 0
          this.phase = 'gone'
          if (this.stolen && !this.bag) this.leftWithLoot()
        }
        break
      }
    }
    if (this.phase !== 'flee' && this.phase !== 'climbOut' && this.phase !== 'gone' && !(this.phase === 'climbIn' && this.climbT < 1.3)) this.checkScare(gm)
  }

  /** 開門進房間：房裡有人醒著就被撞見，嚇得跑掉 */
  private enterRoom() {
    const awake = this.sim.guests.filter((g) => g.room === this.room && g.awake && g.mode === 'bed')
    if (awake.length) {
      for (const g of awake) {
        g.fear += 20
        g.comfort -= 8
        this.note(g, '半夜有小偷開門進來，剛好我醒著，他嚇得跑掉……我也嚇得睡不著。')
      }
      this.line('inc.thief.caught')
      this.sfx('scream')
      this.startFlee()
      this.finish(false, '小偷被醒著的客人撞見，雙方都嚇壞了')
      return
    }
    this.phase = 'inside'
    this.path = [NODES[`${this.room}_door_in`], NODES[BED_NODE[this.room]]]
    this.sfx('door_open')
  }

  private stealNow() {
    this.loot = true
    this.stolen = true
    for (const g of this.sim.guests) {
      if (g.room !== this.room) continue
      g.comfort -= 30
      this.note(g, '半夜手機跟錢包被偷了……這一帶治安這麼差嗎？')
    }
    this.line('inc.thief.steal')
    this.phase = 'leave'
    const bed = BED_NODE[this.room]
    this.path = [...route(bed, 'yardFront').slice(1), [this.exitX, FENCE.z - 0.5]]
  }

  private leftWithLoot() {
    this.finish(false, '小偷帶著客人的東西跑了')
  }

  private checkScare(gm: GrandmaState) {
    let by: string | null = null
    const d = dist(this.x, this.z, gm.x, gm.z)
    if (ghostVisible(gm) && d < 3.2 && canSee(this.x, this.z, this.heading, gm.x, gm.z, 3.4, 1.4)) by = 'ghost'
    else if (this.noises.some((n) => n.loud >= 0.25 && dist(n.x, n.z, this.x, this.z) < 4.5)) by = 'noise'
    else {
      const dog = this.sim.dog
      if (dog && dog.woofT > 0 && dist(dog.x, dog.z, this.x, this.z) < 5.5) by = 'dog'
    }
    if (!by) return
    this.line(by === 'dog' ? 'inc.thief.dog' : 'inc.thief.scream')
    this.sfx('scream')
    const hadLoot = this.loot
    if (hadLoot) {
      this.bag = { x: this.x, z: this.z, room: this.room, returned: false }
      this.loot = false
    }
    this.startFlee()
    if (!this.stolen) {
      for (const g of this.sim.guests) this.note(g, '半夜聽到有人大叫「有鬼啊」，原來是小偷被嚇跑了。這間民宿的阿飄會保護客人。')
      this.reward(2)
      this.finish(true, '小偷被嚇跑了！')
    } else {
      this.reward(1)
      this.finish(true, '小偷被嚇跑了，偷的東西掉在埕上')
    }
  }

  private startFlee() {
    // 在房間裡就先從門出來
    const inRoom = this.phase === 'inside' || this.phase === 'steal'
    this.phase = 'flee'
    this.exitX = Math.max(-9, Math.min(9, this.x))
    if (Math.abs(this.exitX) < FENCE.gateHalf + 0.4) this.exitX = this.x < 0 ? -(FENCE.gateHalf + 0.6) : FENCE.gateHalf + 0.6
    this.path = inRoom
      ? [NODES[`${this.room}_door_in`], NODES[`${this.room}_door_out`], [this.exitX, FENCE.z - 0.5]]
      : [[this.exitX, FENCE.z - 0.5]]
    this.sim.noise(this.x, this.z, 0.45)
  }

  /** 撿起小偷掉的袋子：東西放回客人的床頭 */
  returnBag() {
    const b = this.bag
    if (!b || b.returned) return false
    b.returned = true
    this.stolen = false
    for (const g of this.sim.guests) {
      if (g.room !== b.room) continue
      g.comfort += 30
      this.note(g, '半夜好像有小偷，可是早上手機跟錢包都好好地放在床頭……這間民宿真的很神奇。')
    }
    this.line('inc.gm.bag')
    this.reward(1)
    this.outcome = '東西還回去了'
    this.outcomeT = 5
    return true
  }
}

// ---------------------------------------------------------------------------
// 夢遊
// ---------------------------------------------------------------------------

/** 有夢話台詞的客人（src/data/incidents.lines.json 的 inc.sleep.<id>） */
const SLEEPTALKERS: GuestId[] = ['zhang', 'ahao', 'akai', 'xiaomei', 'linmom']

type WalkMode = 'wait' | 'wander' | 'pause' | 'follow' | 'home' | 'gone'

export class Sleepwalk extends Incident {
  readonly kind = 'sleepwalk'
  readonly startAt = 26.5
  readonly guestId: GuestId
  mode: WalkMode = 'wait'
  private path: XZ[] = []
  private pauseT = 0
  private lostT = 0
  private talkT = 4
  private trail = new Trail()
  private jarDone = false
  /** 夢遊的人感覺不到蚊子、冷：需求先收起來，回到床上（或天亮）再還給他 */
  private stash: GuestRT['needs'] = []

  constructor(sim: NightSim, rnd: () => number, guestId: GuestId) {
    super(sim, rnd)
    this.guestId = guestId
  }

  get name() {
    return this.guest(this.guestId)?.def.name ?? '客人'
  }

  hint() {
    if (this.status !== 'active') return ''
    if (this.mode === 'follow') return `${this.name}跟著妳走：慢慢走在前面，帶回床上`
    return `${this.name}在夢遊，往大門走！擋在前面攔住`
  }

  protected begin(hour: number) {
    const g = this.guest(this.guestId)
    if (!g) {
      this.status = 'cancelled'
      return
    }
    // 要等他睡著、躺在床上才會開始；一小時都沒睡著就算了
    if (g.mode !== 'bed' || g.awake || g.steps.length) {
      if (hour > this.startAt + 1) this.status = 'cancelled'
      return
    }
    this.status = 'active'
    const [bx, bz] = GUEST_ROOMS[g.room].bedside
    g.x = bx
    g.z = bz
    g.mode = 'walk'
    g.steps = []
    this.stash = g.needs
    g.needs = []
    this.mode = 'wander'
    this.path = [...route(BED_NODE[g.room], 'yardFront').slice(1), [YARD_JAR[0] + 0.6, YARD_JAR[1] - 0.5], GATE, OUTSIDE]
    this.line(`inc.sleep.${g.id}`)
  }

  /** 收起來的需求還給他（新的需求如果重複就不加） */
  private unstash(g: GuestRT) {
    for (const n of this.stash) if (!g.needs.some((m) => m.kind === n.kind)) g.needs.push(n)
    this.stash = []
  }

  protected tick(dt: number, hour: number, gm: GrandmaState) {
    const g = this.guest(this.guestId)
    if (!g) return
    // 走丟的人天亮前被發現、扶回床上
    if (this.mode === 'gone' && hour >= 29.6) {
      const [bx, bz] = GUEST_ROOMS[g.room].bedside
      g.x = bx
      g.z = bz
      g.steps = [{ path: [[bx, bz]], toBed: true }]
      this.mode = 'home'
      this.unstash(g)
    }
    if (this.status !== 'active') return
    if (gm.home) this.trail.push(gm.x, gm.z)
    // 走的時候新冒出來的需求也先收著（不然蚊子、冷會把他叫醒）
    if (g.needs.length && this.mode !== 'home') {
      this.stash.push(...g.needs)
      g.needs = []
    }
    // 被吵醒：迷迷糊糊自己走回去
    if (g.awake) {
      g.fear += 8
      g.steps = [{ path: route(nearestNode(g.x, g.z), BED_NODE[g.room]), toBed: true }]
      this.mode = 'home'
      this.unstash(g)
      this.line('inc.gm.sleepwalk.woke')
      this.finish(true, `${g.def.name}被吵醒，自己走回房間了`)
      return
    }
    this.talkT -= dt
    if (this.talkT <= 0) {
      this.talkT = 12
      this.line(`inc.sleep.${g.id}`)
    }
    g.speed = 0
    switch (this.mode) {
      case 'wander': {
        g.mode = 'walk'
        const h = walk(g, this.path, 0.45, dt)
        if (h !== null) g.heading = h
        g.speed = 0.45
        // 走到水缸前面，撞到停一下
        if (!this.jarDone && dist(g.x, g.z, YARD_JAR[0] + 0.6, YARD_JAR[1] - 0.5) < 0.1) {
          this.jarDone = true
          this.mode = 'pause'
          this.pauseT = 8
          g.mode = 'stand'
          this.sfx('knock')
        }
        if (!this.path.length) {
          this.wanderOff(g)
          return
        }
        this.checkBlock(g, gm)
        break
      }
      case 'pause':
        this.pauseT -= dt
        if (this.pauseT <= 0) this.mode = 'wander'
        this.checkBlock(g, gm)
        break
      case 'follow': {
        g.mode = 'walk'
        const h = this.trail.follow(g, 0.55, 1.5, dt)
        if (h !== null) {
          g.heading = h
          g.speed = 0.55
        } else g.mode = 'stand'
        // 阿嬤走太遠：又自己亂走
        if (!gm.home || dist(g.x, g.z, gm.x, gm.z) > 5) this.lostT += dt
        else this.lostT = 0
        if (this.lostT > 3) {
          this.mode = 'wander'
          this.lostT = 0
          this.path = [...route(nearestNode(g.x, g.z), 'yardFront'), GATE, OUTSIDE]
        }
        const [bx, bz] = GUEST_ROOMS[g.room].bedside
        // 跟的人停在阿嬤後面 1.2–1.5 公尺：阿嬤站到床邊時，他已經進到房門裡面了
        if (dist(g.x, g.z, bx, bz) < 1.8) {
          g.steps = [{ path: [[bx, bz]], toBed: true }]
          g.comfort += 8
          this.mode = 'home'
          this.unstash(g)
          this.note(g, '聽說我半夜夢遊，可是醒來好好地躺在床上，被子還蓋好了。')
          this.line('inc.gm.sleepwalk.back')
          this.reward(2)
          this.finish(true, `把夢遊的${g.def.name}帶回床上了`)
        }
        break
      }
    }
  }

  /** 阿嬤站在他正前方（0.9 公尺內）：他轉身，之後跟著阿嬤走 */
  private checkBlock(g: GuestRT, gm: GrandmaState) {
    if (!gm.home) return
    const dx = gm.x - g.x
    const dz = gm.z - g.z
    const d = Math.hypot(dx, dz)
    if (d > 1.0) return
    const ahead = (Math.sin(g.heading) * dx + Math.cos(g.heading) * dz) / Math.max(d, 1e-3)
    if (ahead < 0.2 && this.mode === 'wander') return
    this.mode = 'follow'
    this.trail = new Trail()
    this.trail.push(gm.x, gm.z)
    this.line('inc.gm.sleepwalk')
  }

  private wanderOff(g: GuestRT) {
    this.mode = 'gone'
    g.x = 6.5
    g.z = FENCE.z + 4.5
    g.mode = 'stand'
    g.comfort -= 25
    g.fear += 5
    this.note(g, '早上醒來發現自己睡在路邊，全身冷冰冰……我有夢遊的毛病嗎？')
    this.finish(false, `${g.def.name}夢遊走出大門了`)
  }
}

// ---------------------------------------------------------------------------
// 小孩走失（小宇）
// ---------------------------------------------------------------------------

/** 小宇會躲的地方：旁邊的路點、躲的位置、名字 */
export const LOST_SPOTS: { name: string; node: string; at: XZ }[] = [
  { name: '茶桌後面', node: 'tea', at: [TEA.x - 0.8, TEA.z - 0.5] },
  { name: '水缸旁邊', node: 'yardFront', at: [YARD_JAR[0] + 0.3, YARD_JAR[1] + 0.75] },
  { name: '灶腳', node: 'kitchen_stove', at: [NODES.kitchen_stove[0] + 0.2, NODES.kitchen_stove[1] + 0.9] },
  { name: '浴室門口', node: 'bath_door_out', at: [WING_R.x0 - 1.0, WING_BACK_DOOR_Z + 0.7] },
]

type LostMode = 'wait' | 'walkTo' | 'hide' | 'follow' | 'home'

export class LostChild extends Incident {
  readonly kind = 'lost'
  readonly startAt = 24.5
  mode: LostMode = 'wait'
  spot: (typeof LOST_SPOTS)[number]
  motherWoke = false
  private path: XZ[] = []
  private giggleT = 3
  private trail = new Trail()

  constructor(sim: NightSim, rnd: () => number) {
    super(sim, rnd)
    this.spot = LOST_SPOTS[Math.floor(rnd() * LOST_SPOTS.length)]
  }

  /** 阿嬤離小宇多遠（HUD 的冷熱提示） */
  distance() {
    const g = this.guest('xiaoyu')
    if (!g || !this.gm) return Infinity
    return dist(g.x, g.z, this.gm.x, this.gm.z)
  }

  hint() {
    if (this.status !== 'active') return ''
    if (this.mode === 'follow') return '小宇跟著妳：帶他回床上'
    if (this.mode === 'walkTo') return '小宇下床跑出去了，看他往哪裡走'
    const d = this.distance()
    const warm = d < 3 ? '就在很近的地方！（嘻嘻）' : d < 7 ? '附近有笑聲' : '聽不到……在埕、灶腳、浴室那邊找找'
    return `小宇躲起來了：${warm}`
  }

  protected begin(hour: number) {
    const g = this.guest('xiaoyu')
    if (!g) {
      this.status = 'cancelled'
      return
    }
    if (g.mode !== 'bed' || g.steps.length) {
      if (hour > this.startAt + 1) this.status = 'cancelled'
      return
    }
    this.status = 'active'
    const [bx, bz] = GUEST_ROOMS[g.room].bedside
    g.x = bx
    g.z = bz
    g.awake = true
    g.mode = 'walk'
    g.steps = []
    this.mode = 'walkTo'
    this.path = [...route(BED_NODE[g.room], this.spot.node).slice(1), this.spot.at]
    this.line('inc.xiaoyu.go')
  }

  protected tick(dt: number, hour: number, gm: GrandmaState) {
    const g = this.guest('xiaoyu')
    if (!g || this.status !== 'active') return
    if (gm.home) this.trail.push(gm.x, gm.z)
    g.speed = 0
    // 媽媽醒來發現兒子不見了
    if (!this.motherWoke && hour > this.startAt + 0.75 && this.mode !== 'follow') {
      this.motherWoke = true
      const mom = this.sim.guests.find((x) => x.def.type === 'parent')
      if (mom) {
        mom.awake = true
        mom.fear += 20
        mom.resleepT = 30
        this.note(mom, '半夜兒子突然不見了，嚇死我了……')
        this.line('inc.linmom.wake')
      }
    }
    switch (this.mode) {
      case 'walkTo': {
        g.mode = 'walk'
        const h = walk(g, this.path, 1.0, dt)
        if (h !== null) g.heading = h
        g.speed = 1.0
        if (!this.path.length) {
          this.mode = 'hide'
          g.mode = 'stand'
          g.heading = this.rnd() * Math.PI * 2
        }
        break
      }
      case 'hide': {
        g.mode = 'stand'
        const d = gm.home ? dist(g.x, g.z, gm.x, gm.z) : Infinity
        this.giggleT -= dt
        if (this.giggleT <= 0 && d < 7) {
          this.giggleT = 7
          this.line(this.rnd() < 0.5 ? 'inc.xiaoyu.giggle.1' : 'inc.xiaoyu.giggle.2')
        }
        if (d < 1.4) {
          this.mode = 'follow'
          this.trail = new Trail()
          this.trail.push(gm.x, gm.z)
          g.heading = Math.atan2(gm.x - g.x, gm.z - g.z)
          this.line('inc.xiaoyu.found')
        } else if (hour > this.startAt + 1.6) {
          // 躲累了，自己走回去
          g.steps = [{ path: route(nearestNode(g.x, g.z), BED_NODE[g.room]), toBed: true }]
          this.mode = 'home'
          this.finish(false, '沒找到小宇，他自己跑回去了')
        }
        break
      }
      case 'follow': {
        g.mode = 'walk'
        // 跟著阿嬤走的時候一直看著她：不要每幾秒就算一次「看到阿嬤」（看得到鬼的人每次 +8 舒適）
        g.suspicion = 0
        const h = this.trail.follow(g, 1.0, 1.2, dt)
        if (h !== null) {
          g.heading = h
          g.speed = 1.0
        } else g.mode = 'stand'
        const [bx, bz] = GUEST_ROOMS[g.room].bedside
        // 跟的人停在阿嬤後面 1.2–1.5 公尺：阿嬤站到床邊時，他已經進到房門裡面了
        if (dist(g.x, g.z, bx, bz) < 1.8) {
          g.steps = [{ path: [[bx, bz]], toBed: true }]
          g.comfort += 10
          g.played = true
          this.mode = 'home'
          const mom = this.sim.guests.find((x) => x.def.type === 'parent')
          if (mom) this.note(mom, this.motherWoke ? '半夜兒子不見了，後來自己回來了，說是一個阿嬤帶他回來的……' : '兒子說他半夜跟一個阿嬤玩捉迷藏，還被牽回來睡覺，好可愛的夢。')
          this.line('inc.xiaoyu.bed')
          this.reward(2)
          this.finish(true, '把小宇帶回床上了')
        }
        break
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 醉漢
// ---------------------------------------------------------------------------

type DrunkMode = 'wait' | 'sing' | 'talk' | 'leave' | 'flee' | 'gone'

const SING = ['inc.drunk.sing.1', 'inc.drunk.sing.2', 'inc.drunk.sing.3']
const TALK = ['inc.drunk.talk.1', 'inc.drunk.talk.2', 'inc.drunk.talk.3', 'inc.drunk.talk.4']

export class Drunk extends Incident {
  readonly kind = 'drunk'
  readonly startAt = 23.5
  x = 1.3
  z = FENCE.z + 1.5
  heading = Math.PI
  speed = 0
  mode: DrunkMode = 'wait'
  /** 剛唱了一句（畫面冒音符） */
  singFlash = 0
  /** 聽他講話聽了幾秒（到 3 秒他就開始說心事） */
  listen = 0
  talkIdx = 0
  private singT = 1
  private singIdx = 0
  private talkT = 0
  private awayT = 0

  hint() {
    if (this.status !== 'active') return ''
    if (this.mode === 'talk') return '醉漢在跟妳說心事：待在他旁邊聽完'
    return '門口的醉漢一直唱歌（很吵）：站到他旁邊陪他，或附身小黑把他嚇走'
  }

  protected begin() {
    this.status = 'active'
    this.mode = 'sing'
    this.line('inc.drunk.arrive')
  }

  protected tick(dt: number, hour: number, gm: GrandmaState) {
    this.singFlash = Math.max(0, this.singFlash - dt)
    if (this.mode === 'gone' || this.mode === 'wait') return
    this.speed = 0
    const d = dist(this.x, this.z, gm.x, gm.z)
    if (this.mode === 'leave' || this.mode === 'flee') {
      const sp = this.mode === 'flee' ? 2.8 : 0.7
      this.x += sp * dt
      this.heading = Math.PI / 2
      this.speed = sp
      if (this.x > 16) this.mode = 'gone'
      return
    }
    if (this.status !== 'active') return
    // 小黑吠他：嚇跑
    const dog = this.sim.dog
    if (dog && dog.woofT > 0 && dist(dog.x, dog.z, this.x, this.z) < 5.5) {
      this.line('inc.drunk.scared')
      this.mode = 'flee'
      this.reward(1)
      this.finish(true, '醉漢被小黑嚇跑了')
      return
    }
    // 阿嬤（或附身的阿咪）在旁邊陪他
    const near = gm.home && !gm.hidden && gm.body !== 'dog' && gm.body !== 'gecko' && d < 2.6
    if (this.mode === 'sing') {
      this.singT -= dt
      if (this.singT <= 0) {
        this.singT = 5.5
        this.singFlash = 1.4
        this.line(SING[this.singIdx++ % SING.length])
        this.sim.noise(this.x, this.z, 0.4)
      }
      if (near) {
        this.listen += dt
        this.heading = Math.atan2(gm.x - this.x, gm.z - this.z)
        if (this.listen > 3) {
          this.mode = 'talk'
          this.talkIdx = 0
          this.talkT = 0.6
          this.line('inc.gm.drunk')
        }
      }
      if (hour > this.startAt + 2) {
        for (const g of this.sim.guests) if (g.def.lightSleeper >= 0.5) {
          g.comfort -= 8
          this.note(g, '門口有醉漢唱歌唱到半夜，吵得我睡不著。')
        }
        this.mode = 'leave'
        this.finish(false, '醉漢唱到累了才走')
      }
    } else if (this.mode === 'talk') {
      if (!near) {
        this.awayT += dt
        if (this.awayT > 6) {
          this.mode = 'sing'
          this.listen = 0
          this.awayT = 0
        }
        return
      }
      this.awayT = 0
      this.heading = Math.atan2(gm.x - this.x, gm.z - this.z)
      this.talkT -= dt
      if (this.talkT <= 0) {
        if (this.talkIdx >= TALK.length) {
          this.line('inc.gm.drunk.done')
          this.mode = 'leave'
          this.reward(2)
          this.finish(true, '醉漢說完心事，回家去了')
          return
        }
        this.line(TALK[this.talkIdx++])
        this.talkT = 4.4
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 保險絲燒掉
// ---------------------------------------------------------------------------

export class Fuse extends Incident {
  readonly kind = 'fuse'
  readonly startAt = 24.0
  blown = false
  private blownAt = 0

  hint() {
    if (this.status !== 'active') return ''
    return '客房停電了：電箱在左護龍前面的牆上（靠圍牆那邊），去修保險絲'
  }

  protected begin(hour: number) {
    this.status = 'active'
    this.blown = true
    this.blownAt = hour
    incidentState.blackout = true
    this.sfx('switch')
    this.line('inc.gm.fuse')
    // 膽小的、帶小孩的、小孩：一片黑會怕（怕黑沒解決睡不著）
    for (const g of this.sim.guests) {
      if (!g.awake || !['timid', 'parent', 'child'].includes(g.def.type)) continue
      if (!g.needs.some((n) => n.kind === 'dark')) g.needs.push({ kind: 'dark', since: hour, known: true })
    }
  }

  protected tick(_dt: number, hour: number) {
    if (this.status !== 'active') return
    if (hour >= 29.8) {
      for (const g of this.sim.guests) if (['timid', 'parent', 'child'].includes(g.def.type)) this.note(g, '半夜突然停電，整晚黑漆漆的好可怕。')
      this.finish(false, '整晚都沒有電')
    }
  }

  /** 電箱修好了（小遊戲回傳 fixed）；seconds 是花了幾秒 */
  fix(seconds: number) {
    if (!this.blown) return false
    this.blown = false
    incidentState.blackout = false
    for (const r of ['r1', 'r2'] as RoomId[]) this.sim.satisfy(r, 'dark', 6)
    this.sfx('switch')
    this.line('inc.gm.fuse.done')
    const fast = this.hour - this.blownAt < 0.5 && seconds < 25
    this.reward(fast ? 2 : 1)
    this.finish(true, '電修好了，燈亮了')
    return true
  }
}

// ---------------------------------------------------------------------------
// 登記
// ---------------------------------------------------------------------------

export type IncidentRT = Thief | Sleepwalk | LostChild | Drunk | Fuse

/** 畫面、HUD 讀這個（每晚開始時換掉） */
export const incidentState: { current: IncidentRT | null; blackout: boolean } = { current: null, blackout: false }

/** 今晚適合夢遊的客人（有夢話的優先；不選小孩、老朋友） */
function sleepwalker(sim: NightSim): GuestId | null {
  // 福伯、志明、志偉今晚各有自己的故事（night/family.ts），不夢遊
  const ok = sim.guests.filter((g) => !['child', 'elder', 'wanderer', 'caregiver', 'lonely'].includes(g.def.type))
  const talk = ok.find((g) => SLEEPTALKERS.includes(g.id))
  return (talk ?? ok[0])?.id ?? null
}

/** 做出某一種事件（測試也用這個） */
export function makeIncident(sim: NightSim, kind: IncidentKind, seed = 1): IncidentRT | null {
  const rnd = seeded(seed)
  switch (kind) {
    case 'thief':
      return new Thief(sim, rnd)
    case 'sleepwalk': {
      const id = sleepwalker(sim)
      return id ? new Sleepwalk(sim, rnd, id) : null
    }
    case 'lost':
      return sim.guests.some((g) => g.id === 'xiaoyu') ? new LostChild(sim, rnd) : null
    case 'drunk':
      return new Drunk(sim, rnd)
    case 'fuse':
      return new Fuse(sim, rnd)
  }
}

/** 今晚會不會有事、是哪一件（第幾晚當種子：同一晚重玩一樣） */
export function pickIncident(sim: NightSim, plan: NightPlan, night: number): IncidentKind | null {
  // 特別的夜晚（颱風、中元鬼客人）已經夠忙了
  if (night < 3 || plan.event === 'miaogong' || plan.special) return null
  // 相鄰的種子在這個簡單的亂數裡很像：先打散再用，丟掉前幾個
  const rnd = seeded(Math.imul(night + 1, 2654435761) ^ 0x5bd1e995)
  rnd()
  rnd()
  if (rnd() >= 0.5) return null
  const kinds: IncidentKind[] = ['thief', 'drunk']
  if (plan.event !== 'blackout') kinds.push('fuse')
  if (sleepwalker(sim)) kinds.push('sleepwalk')
  if (sim.guests.some((g) => g.id === 'xiaoyu')) kinds.push('lost', 'lost')
  return kinds[Math.floor(rnd() * kinds.length)]
}

export function createIncidents(sim: NightSim, plan: NightPlan, meta: Meta): SimPlugin | null {
  incidentState.blackout = false
  const kind = pickIncident(sim, plan, meta.night)
  const inc = kind ? makeIncident(sim, kind, meta.night * 31 + 7) : null
  incidentState.current = inc
  return inc
}

// ---------------------------------------------------------------------------
// 事件的處理（director 併進 CUSTOM_EVENTS；只在瀏覽器跑，所以用動態 import）
// ---------------------------------------------------------------------------

export const INCIDENT_EVENTS: Record<string, (data: unknown) => void> = {
  'incident.reward': (data) => {
    const { merit, say } = data as { merit: number; say?: string }
    void import('../../store').then(({ useStore }) => {
      const s = useStore.getState()
      if (merit > 0) useStore.setState({ meta: { ...s.meta, merit: s.meta.merit + merit } })
      if (say) s.say(say)
    })
  },
  'incident.sfx': (data) => {
    const { name } = data as { name: string }
    if (name === 'scream') void import('../../audio').then(({ audio }) => audio.scream())
    else void import('../../audio/sfx').then(({ sfx }) => sfx.play(name as Parameters<typeof sfx.play>[0], { volume: 0.7 }))
  },
  'incident.end': (data) => {
    const { ok } = data as { ok: boolean }
    void import('../../audio').then(({ audio }) => (ok ? audio.chime() : undefined))
  },
}

// ---------------------------------------------------------------------------
// 互動點：電箱、小偷掉的袋子（整合的人登記進 HOTSPOTS）
// ---------------------------------------------------------------------------

const curFuse = () => (incidentState.current instanceof Fuse ? incidentState.current : null)
const curThief = () => (incidentState.current instanceof Thief ? incidentState.current : null)

export const INCIDENT_HOTSPOTS: Hotspot[] = [
  {
    id: 'incident.fuse',
    scene: 'home',
    x: FUSE_BOX.standX,
    z: FUSE_BOX.standZ,
    r: 1.3,
    icon: { x: FUSE_BOX.x, z: FUSE_BOX.z },
    iconY: 1.7,
    label: (s) => (s.phase === 'night' && curFuse()?.blown ? '打開電箱修保險絲' : null),
    run: (s) => {
      const f = curFuse()
      if (!f?.blown) return
      s.startMinigame('fuse', {}, (r) => {
        const res = r as { fixed: boolean; seconds: number } | null
        if (res?.fixed) f.fix(res.seconds)
      })
    },
  },
  {
    id: 'incident.bag',
    scene: 'home',
    get x() {
      return curThief()?.bag?.x ?? 1e4
    },
    get z() {
      return curThief()?.bag?.z ?? 1e4
    },
    r: 1.2,
    iconY: 0.8,
    label: (s) => {
      const b = curThief()?.bag
      return s.phase === 'night' && b && !b.returned ? '撿起小偷掉的袋子，還給客人' : null
    },
    run: () => {
      curThief()?.returnBag()
    },
  },
]
