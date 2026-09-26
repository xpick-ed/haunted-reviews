import { FENCE, GUEST_ROOMS, TEA } from '../../scene/layout'
import { BARKS } from '../../data/barks'
import { adultOn } from '../../settings'
import { seeded } from '../rng'
import type { NightPlan } from './plan'
import type { Meta } from './director'
import { BED_NODE, NODES, route } from './nav'
import { canSee, clearLine, type GrandmaState, type GuestRT, type NeedRT, type NightSim, type SimPlugin } from './sim'
import type { BarkKind, GuestId } from './types'

// 大人的心事（DESIGN §29）：失智的福伯半夜到處走、累壞的志明、半夜坐在埕裡的志偉、第 10 晚的分遺產。
// 純邏輯（Node 可測），director.ts 每晚呼叫 createFamily()，回傳 null 表示今晚沒有。
// 互動點與對話在 src/world/adultStory.ts、畫面在 src/scene/FamilyLayer.tsx、台詞在 src/data/family.lines.json。
//
//   福伯＋志明（所有人）  00:00–00:30 福伯起床找過世的太太「阿玉」：看到阿嬤會把她認成阿玉、開心地跟著她走。
//                         帶他回床邊＝解決；也可以跟他說說話（陪他演阿玉／說實話／聊以前）。
//                         他走太久（一小時），志明驚醒、慌張地在埕裡找；志明先找到＝沒解決。
//                         阿嬤先把爸爸帶回去：志明回房看到爸爸被子蓋好，終於睡了一個好覺（睡不著解決）。
//   志偉（成人內容）      01:30 坐到埕裡的茶桌，盯著一則沒送出的訊息。他看不到阿嬤：倒茶、宵夜、哼歌陪他，
//                         心鬆一點以後把手機推到他手邊 → 他把訊息送出去，老婆回「回家就好」。沒陪他：天沒亮就先走了。
//                         故事結束時顯示安心專線 1925。
//   分遺產（所有人）      第 10 晚傍晚叔叔、姑姑回來吵著賣地（adultStory.ts 的偷聽）；晚上姑姑睡阿嬤的床，
//                         托夢給她 → 天亮她打給叔叔說不賣了（小翰的心 +5）；沒托夢 → 天亮又吵（小翰的心 −8）。
//
// 成人內容的判斷：用 settings.ts 的 adultOn()（Node 裡是預設值：關）。

type XZ = [number, number]

/** 分遺產是第幾晚 */
export const INHERITANCE_NIGHT = 10
/** 志偉的故事結束時顯示的求助資訊 */
export const HOTLINE = '如果你也覺得撐不下去，可以打 1925 安心專線（24 小時）。'

/** 福伯最早幾點起床；志明還醒著的話最多再等多久（之後志明撐不住睡著） */
const FUBO_START: [number, number] = [24.0, 24.5]
const FUBO_WAIT_SON = 0.4
/** 福伯在外面走多久（遊戲小時），志明會驚醒 */
export const ZHIMING_WAKE_AFTER = 1.0
/** 志偉幾點出去坐、坐到幾點放棄 */
export const ZHIWEI_START = 25.5
export const ZHIWEI_GIVEUP = 28.8
/** 天快亮：分遺產的電話、志偉先走了 */
export const DAWN_AT = 29.6

/** 大門（圍牆中間的開口）、福伯在門外等太太的地方 */
const GATE: XZ = [0, FENCE.z - 0.25]
export const FUBO_OUTSIDE: XZ = [-0.55, FENCE.z + 1.2]
/** 志偉站的地方：茶桌東邊那張竹椅前面，面向埕（西南） */
export const ZHIWEI_SPOT: XZ = [TEA.x + 0.62, TEA.z + 0.32]
export const ZHIWEI_HEADING = -0.8

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz)

// ---------------------------------------------------------------------------
// 台詞：三位客人的碎念（BARKS 在 data/barks.ts 是空的，這裡補進去；台詞在 family.lines.json）
// ---------------------------------------------------------------------------

const ids = (who: string, spec: Partial<Record<BarkKind, number>>) =>
  Object.fromEntries(Object.entries(spec).map(([k, n]) => [k, Array.from({ length: n }, (_, i) => `${who}.${k}.${i + 1}`)])) as Partial<Record<BarkKind, string[]>>

const COMMON: Partial<Record<BarkKind, number>> = {
  arrive: 2,
  idle: 3,
  sleepy: 1,
  need_cold: 1,
  need_hot: 1,
  need_thirsty: 1,
  need_mosquito: 1,
  need_dark: 1,
  need_hungry: 1,
  need_insomnia: 1,
  need_lost: 1,
  thanks: 2,
  hear: 1,
  suspect: 1,
  seen: 2,
  door: 1,
  bathroom: 1,
  woken: 1,
  morning: 1,
}
export const FAMILY_BARKS: Partial<Record<GuestId, Partial<Record<BarkKind, string[]>>>> = {
  zhiming: ids('zhiming', { ...COMMON, need_insomnia: 2, hear: 2 }),
  fubo: ids('fubo', COMMON),
  zhiwei: ids('zhiwei', { ...COMMON, need_insomnia: 2 }),
}
for (const [id, b] of Object.entries(FAMILY_BARKS)) Object.assign(BARKS[id as GuestId], b)

// ---------------------------------------------------------------------------
// 小工具（跟 incidents.ts 一樣的走路、跟著走）
// ---------------------------------------------------------------------------

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

/** 依序走過這些路點（相鄰兩個之間用 route 找路） */
function tour(from: string, nodes: (string | XZ)[]): XZ[] {
  const out: XZ[] = []
  let cur = from
  for (const n of nodes) {
    if (typeof n === 'string') {
      out.push(...route(cur, n).slice(1))
      cur = n
    } else out.push(n)
  }
  return out
}

/** 阿嬤走過的腳印：跟的人照著點走（不會穿牆抄近路），保持 gap 公尺 */
class Trail {
  pts: XZ[] = []
  push(x: number, z: number) {
    const last = this.pts[this.pts.length - 1]
    if (!last || dist(last[0], last[1], x, z) > 0.3) {
      this.pts.push([x, z])
      if (this.pts.length > 200) this.pts.shift()
    }
  }
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
  follow(p: { x: number; z: number }, speed: number, gap: number, dt: number) {
    while (this.pts.length && dist(p.x, p.z, this.pts[0][0], this.pts[0][1]) < 0.2) this.pts.shift()
    if (this.lengthFrom(p.x, p.z) <= gap || !this.pts.length) return null
    const want = Math.min(speed * dt, this.lengthFrom(p.x, p.z) - gap)
    return walk(p, this.pts, want / Math.max(dt, 1e-4), dt)
  }
}

// ---------------------------------------------------------------------------
// 評論附註
// ---------------------------------------------------------------------------

const NOTES = {
  fubo: {
    play: '（志明代寫）爸早上一直說：「阿玉昨天晚上回來了。」他很久沒有笑成這樣了。',
    truth: '（志明代寫）爸早上說，有個阿桑告訴他媽媽已經走了。他沒有哭，他說：「那我要好好吃飯，她才會放心。」',
    old: '（志明代寫）爸一整個早上都在講他跟媽媽在廟口看歌仔戲的事，講了七次，每一次都笑。',
    back: '（志明代寫）爸說昨天晚上阿玉牽他回房間。我不知道要怎麼回答，就說：「那很好啊。」',
    found: '（志明代寫）爸半夜又跑出去找媽媽了。在院子裡找到他的時候，他說：「阿玉叫我在這裡等她。」',
  },
  zhiming: {
    slept: '照顧爸爸三年，這是我第一次一覺睡到天亮。醒來的時候，爸爸在旁邊笑。',
    relief: '半夜醒來爸爸不見了，我找遍院子，回房間卻看到他好好地躺著，被子蓋到下巴。我坐在床邊哭了一下，然後睡了幾個月來最好的一覺。',
    found: '半夜爸爸又跑出去了，我在院子裡找到他。……我已經很久很久沒有好好睡一覺了。',
  },
  zhiwei: {
    sent: '半夜睡不著，在埕裡坐了很久。喝了一杯不知道誰泡的熱茶，終於把一直不敢說的話傳給老婆了。她說：回家就好。……謝謝這間民宿，我要回家了。',
    left: '半夜在埕裡坐了很久，想了很多事。天還沒亮就先走了，沒跟老闆打招呼，不好意思。',
  },
}

// ---------------------------------------------------------------------------
// 外掛本體
// ---------------------------------------------------------------------------

export type FuboMode = 'wait' | 'wander' | 'pause' | 'greet' | 'follow' | 'lost' | 'outside' | 'home' | 'found' | 'skip'
export type MingMode = 'idle' | 'search' | 'return' | 'done'
export type WeiMode = 'wait' | 'walk' | 'sit' | 'send' | 'home' | 'gone' | 'skip'
export type FuboTalk = 'play' | 'truth' | 'old'
export type ZhiweiAct = 'tea' | 'meal' | 'hum'
export type AuntChoice = 'sewing' | 'scold'

/** 福伯在外面（還沒回床上） */
const FUBO_OUT: FuboMode[] = ['wander', 'pause', 'greet', 'follow', 'lost', 'outside']

export class Family implements SimPlugin {
  readonly sim: NightSim
  hour = 22
  gm: GrandmaState | null = null

  // ---- 福伯＆志明 ----
  readonly hasFubo: boolean
  fubo: FuboMode = 'wait'
  ming: MingMode = 'idle'
  /** 跟福伯說了什麼（說過話才有） */
  talked: FuboTalk | null = null
  /** 福伯幾點開始起來走 */
  readonly fuboStart: number
  wanderStart = 0
  private greeted = false
  private leg: 'altar' | 'gate' = 'altar'
  private path: XZ[] = []
  private pauseT = 0
  private callT = 0
  private greetT = 0
  private lostT = 0
  private lostWait = 0
  private trail = new Trail()
  private stash: NeedRT[] = []
  private mingPath: XZ[] = []
  private searchT = 0
  private returnT = 0
  private callI = 0

  // ---- 志偉 ----
  readonly hasWei: boolean
  wei: WeiMode = 'wait'
  /** 心鬆了幾分（每陪一件事 +1；托夢成功一開始就 1） */
  warmth = 0
  acts: ZhiweiAct[] = []
  /** 訊息送出去了（畫面顯示老婆的回覆） */
  sent = false
  private sendT = 0
  private weiSlept = false
  private weiDawn = false

  // ---- 分遺產 ----
  readonly inheritance: boolean
  auntCalm = false
  auntChoice: AuntChoice | null = null
  private dawnDone = false

  /** 在 update 外面（熱點、對話結束）發的事件先排著，下一幀再送（sim 每幀開頭會清掉事件） */
  private pending: { kind: string; data: unknown }[] = []
  private inUpdate = false

  constructor(sim: NightSim, opts: { fubo: boolean; wei: boolean; inheritance: boolean; seed: number }) {
    this.sim = sim
    this.hasFubo = opts.fubo
    this.hasWei = opts.wei
    this.inheritance = opts.inheritance
    const rnd = seeded(opts.seed)
    rnd()
    this.fuboStart = FUBO_START[0] + rnd() * (FUBO_START[1] - FUBO_START[0])
    if (!this.hasFubo) this.fubo = 'skip'
    if (!this.hasWei) this.wei = 'skip'
  }

  update(dt: number, hour: number, gm: GrandmaState) {
    this.inUpdate = true
    for (const e of this.pending) this.sim.emitCustom(e.kind, e.data)
    this.pending = []
    const dh = Math.max(0, hour - this.hour)
    this.hour = hour
    this.gm = gm
    if (this.hasFubo) this.tickFubo(dt, dh, hour, gm)
    if (this.hasWei) this.tickWei(dt, hour)
    if (this.inheritance && !this.dawnDone && hour >= DAWN_AT) {
      this.dawnDone = true
      this.post('family.inheritance', { calm: this.auntCalm, choice: this.auntChoice })
    }
    this.inUpdate = false
  }

  guest(id: GuestId) {
    return this.sim.guests.find((g) => g.id === id)
  }

  private post(kind: string, data?: unknown) {
    if (this.inUpdate) this.sim.emitCustom(kind, data)
    else this.pending.push({ kind, data })
  }
  private line(id: string) {
    this.post('line', { id })
  }
  private reward(merit: number) {
    this.post('family.reward', { merit })
  }
  private note(g: GuestRT, text: string) {
    this.sim.reviewNotes[g.id] = text
  }

  /** HUD 的提示：現在該做什麼（沒事就是空字串） */
  hint(): string {
    if (this.ming === 'search') return '志明醒來發現爸爸不見了，正在埕裡找！快把福伯帶回床上'
    switch (this.fubo) {
      case 'wander':
      case 'pause':
        return '福伯半夜起來找「阿玉」：走到他看得到的地方，他會把妳當成阿玉、跟著妳走'
      case 'outside':
        return '福伯走到大門外面等「阿玉」了：去帶他回來'
      case 'greet':
      case 'follow':
        return '福伯跟著妳：慢慢走回客房的床邊（也可以停下來跟他說說話）'
      case 'lost':
        return '福伯跟丟了，站在原地找「阿玉」：回去讓他看到妳'
    }
    if (this.wei === 'sit') return this.warmth >= 2 ? '志偉的心鬆了一點：把手機輕輕推到他手邊' : '志偉一個人坐在茶桌前，盯著一則沒送出去的訊息：陪陪他（倒茶、宵夜、哼歌）'
    return ''
  }

  // -------------------------------------------------------------------------
  // 福伯
  // -------------------------------------------------------------------------

  /** 福伯在外面走（畫面：頭上的「阿玉？」） */
  get fuboOut() {
    return FUBO_OUT.includes(this.fubo)
  }

  private tickFubo(dt: number, dh: number, hour: number, gm: GrandmaState) {
    const g = this.guest('fubo')
    if (!g) return
    const son = this.guest('zhiming') ?? null
    if (this.fubo === 'wait') {
      if (hour < this.fuboStart) return
      // 托夢睡得很沉、或一直沒機會（在上廁所……）：今晚不會起來了
      if (hour > this.fuboStart + 1) {
        this.fubo = 'skip'
        return
      }
      if (g.mode !== 'bed' || g.steps.length || hour < g.deepUntil) return
      // 兒子還醒著：再等一下，他撐不住就會睡著
      if (son && son.awake && son.mode === 'bed' && hour < this.fuboStart + FUBO_WAIT_SON) return
      this.beginWander(g, son, hour)
      return
    }
    if (this.fuboOut) {
      if (gm.home) this.trail.push(gm.x, gm.z)
      // 走的時候冒出來的需求先收著（回床上再還給他）
      if (g.needs.length) {
        this.stash.push(...g.needs)
        g.needs = []
      }
      g.awake = true
      g.speed = 0
      this.callT -= dt
      if (this.callT <= 0 && (this.fubo === 'wander' || this.fubo === 'outside')) {
        this.callT = 14
        this.line(`fam.fubo.call.${(this.callI++ % 3) + 1}`)
      }
      this.stepFubo(g, son, dt, dh, gm)
    }
    if (son) this.tickMing(g, son, dt, hour)
  }

  private beginWander(g: GuestRT, son: GuestRT | null, hour: number) {
    const [bx, bz] = GUEST_ROOMS[g.room].bedside
    g.x = bx
    g.z = bz
    g.mode = 'walk'
    g.awake = true
    g.steps = []
    this.stash = g.needs
    g.needs = []
    this.fubo = 'wander'
    this.leg = 'altar'
    this.path = tour(BED_NODE[g.room], ['altar'])
    this.wanderStart = hour
    this.callT = 12
    this.line('fam.fubo.wake')
    // 志明撐了一整晚，坐著就睡著了（睡不著的心事還在）
    if (son && son.awake && son.mode === 'bed') {
      son.awake = false
      son.sleep = 0.25
      this.post('line', { id: 'fam.zhiming.doze', quiet: true })
    }
  }

  /** 福伯看不看得到阿嬤（很近的時候不用看也感覺得到） */
  private seesGrandma(g: GuestRT, gm: GrandmaState) {
    if (!gm.home || gm.hidden || gm.body) return false
    const d = dist(g.x, g.z, gm.x, gm.z)
    if (d < 1.3) return clearLine(g.x, g.z, gm.x, gm.z)
    return d < 4.5 && canSee(g.x, g.z, g.heading, gm.x, gm.z, 4.5)
  }

  private greet(g: GuestRT, gm: GrandmaState) {
    this.fubo = 'greet'
    this.greetT = this.greeted ? 1.2 : 2.5
    g.heading = Math.atan2(gm.x - g.x, gm.z - g.z)
    if (!this.greeted) {
      g.comfort += 6
      g.happyAt = this.hour
    }
    this.line(this.greeted ? 'fam.fubo.greet2' : 'fam.fubo.greet')
    this.greeted = true
  }

  private startFollow(gm: GrandmaState | null) {
    this.fubo = 'follow'
    this.lostT = 0
    this.trail = new Trail()
    if (gm?.home) this.trail.push(gm.x, gm.z)
  }

  private stepFubo(g: GuestRT, son: GuestRT | null, dt: number, dh: number, gm: GrandmaState) {
    const face = () => {
      if (gm.home) g.heading = Math.atan2(gm.x - g.x, gm.z - g.z)
    }
    switch (this.fubo) {
      case 'wander': {
        g.mode = 'walk'
        const h = walk(g, this.path, 0.42, dt)
        if (h !== null) g.heading = h
        g.speed = 0.42
        if (!this.path.length) {
          if (this.leg === 'altar') {
            // 走到神明廳：站在神桌前面看一看
            this.fubo = 'pause'
            this.pauseT = 10
            this.leg = 'gate'
            this.path = [...tour('altar', ['yardFront']), GATE, FUBO_OUTSIDE]
            this.line('fam.fubo.altar')
          } else {
            this.fubo = 'outside'
            this.line('fam.fubo.gate')
          }
        }
        break
      }
      case 'pause':
        g.mode = 'stand'
        g.heading = Math.PI
        this.pauseT -= dt
        if (this.pauseT <= 0) this.fubo = 'wander'
        break
      case 'outside':
        // 在大門外面等太太：面向馬路，外面很冷
        g.mode = 'stand'
        g.heading = 0
        g.comfort -= dh * 6
        break
      case 'greet':
        g.mode = 'stand'
        face()
        this.greetT -= dt
        if (this.greetT <= 0) this.startFollow(gm)
        return
      case 'follow': {
        g.mode = 'walk'
        const h = this.trail.follow(g, 0.6, 1.3, dt)
        if (h !== null) {
          g.heading = h
          g.speed = 0.6
        } else {
          g.mode = 'stand'
          face()
        }
        // 阿嬤走太遠（或走出家門）：跟丟了
        if (!gm.home || dist(g.x, g.z, gm.x, gm.z) > 5.5) this.lostT += dt
        else this.lostT = 0
        if (this.lostT > (this.talked ? 8 : 4)) {
          this.fubo = 'lost'
          this.lostWait = 10
          this.line('fam.fubo.lost')
          return
        }
        const [bx, bz] = GUEST_ROOMS[g.room].bedside
        // 跟的人停在阿嬤後面 1.3 公尺：阿嬤站到床邊時，他已經進到房門裡面了
        if (dist(g.x, g.z, bx, bz) < 1.8) this.fuboHome(g, son)
        return
      }
      case 'lost':
        g.mode = 'stand'
        this.lostWait -= dt
        if (this.lostWait <= 0) {
          // 等不到：自己又往大門走
          this.fubo = 'wander'
          this.leg = 'gate'
          this.path = [...tour(nearestNode(g.x, g.z), ['yardFront']), GATE, FUBO_OUTSIDE]
        }
        break
    }
    if (this.seesGrandma(g, gm)) this.greet(g, gm)
  }

  /** 阿嬤把福伯帶回床邊 */
  private fuboHome(g: GuestRT, son: GuestRT | null) {
    const [bx, bz] = GUEST_ROOMS[g.room].bedside
    g.steps = [{ path: [[bx, bz]], toBed: true }]
    g.mode = 'walk'
    g.tucked = true
    g.comfort += 10
    g.deepUntil = this.hour + 3
    this.unstash(g)
    this.fubo = 'home'
    this.line(this.talked === 'truth' ? 'fam.fubo.bed.truth' : 'fam.fubo.bed')
    this.note(g, NOTES.fubo[this.talked ?? 'back'])
    this.reward(2)
    if (!son) return
    if (this.ming === 'search') {
      // 志明還在埕裡找：再找一下子才走回房間
      this.ming = 'return'
      this.returnT = 4
    } else if (this.ming === 'idle') this.restSon(son, 'slept')
  }

  private unstash(g: GuestRT) {
    for (const n of this.stash) if (!g.needs.some((m) => m.kind === n.kind) && !g.met.includes(n.kind)) g.needs.push(n)
    this.stash = []
  }

  // -------------------------------------------------------------------------
  // 志明
  // -------------------------------------------------------------------------

  private tickMing(f: GuestRT, z: GuestRT, dt: number, hour: number) {
    switch (this.ming) {
      case 'idle':
        if (!this.fuboOut) return
        // 被吵醒（醒來發現爸爸不在）、或爸爸走太久了
        if ((z.awake && z.mode === 'bed') || hour - this.wanderStart > ZHIMING_WAKE_AFTER) this.startSearch(z)
        return
      case 'search':
        this.searchStep(z, dt)
        if (dist(z.x, z.z, f.x, f.z) < 2.2 && clearLine(z.x, z.z, f.x, f.z)) this.found(z, f)
        return
      case 'return':
        if (this.returnT > 0) {
          this.searchStep(z, dt)
          this.returnT -= dt
          if (this.returnT <= 0) {
            const [bx, bz] = GUEST_ROOMS[z.room].bedside
            z.steps = [{ path: route(nearestNode(z.x, z.z), BED_NODE[z.room]) }, { path: [[bx, bz]], toBed: true }]
          }
          return
        }
        // 回到房間：爸爸好好地躺在床上
        if (z.mode === 'bed' && !z.steps.length) {
          this.line('fam.zhiming.relief')
          this.restSon(z, 'relief')
        }
        return
    }
  }

  private startSearch(z: GuestRT) {
    if (z.mode === 'bed') {
      const [bx, bz] = GUEST_ROOMS[z.room].bedside
      z.x = bx
      z.z = bz
    }
    z.awake = true
    z.sleep = 0
    z.steps = []
    z.mode = 'walk'
    z.fear += 15
    z.comfort -= 10
    this.ming = 'search'
    this.searchT = 7
    this.mingPath = this.searchLoop(z)
    this.line('fam.zhiming.panic')
    // 他喊得很大聲：別的客人也會被吵醒
    this.sim.noise(z.x, z.z, 0.45, z)
  }

  /** 志明找爸爸的路線：先衝出大門沿著馬路找（最怕他走到馬路上），再找埕、茶桌、神明廳、浴廁那邊 */
  private searchLoop(z: GuestRT): XZ[] {
    const road = FENCE.z + 1.7
    return [
      ...tour(nearestNode(z.x, z.z), ['yardC', 'yardFront']),
      GATE,
      FUBO_OUTSIDE,
      [5.5, road],
      [-5.5, road],
      [0.3, road],
      GATE,
      ...tour('yardFront', ['yardC', 'yardL', 'tea', 'yardL', 'porchC', 'hall', 'altar', 'hall', 'porchC', 'yardC', 'yardR', 'porchR']),
    ]
  }

  private searchStep(z: GuestRT, dt: number) {
    z.awake = true
    z.mode = 'walk'
    z.steps = []
    if (!this.mingPath.length) this.mingPath = this.searchLoop(z)
    const h = walk(z, this.mingPath, 1.0, dt)
    if (h !== null) z.heading = h
    z.speed = 1.0
    this.searchT -= dt
    if (this.searchT <= 0) {
      this.searchT = 9
      this.line(`fam.zhiming.search.${(this.callI++ % 3) + 1}`)
    }
  }

  /** 志明自己找到爸爸：兩個人走回房間（沒解決；志明還是睡不著） */
  private found(z: GuestRT, f: GuestRT) {
    const outside = this.fubo === 'outside'
    this.fubo = 'found'
    this.ming = 'done'
    this.line('fam.zhiming.found')
    this.post('line', { id: 'fam.fubo.found', quiet: true })
    const [bx, bz] = GUEST_ROOMS[z.room].bedside
    z.steps = [{ path: route(nearestNode(z.x, z.z), BED_NODE[z.room]) }, { path: [[bx, bz]], toBed: true }]
    f.steps = [{ path: route(nearestNode(f.x, f.z), BED_NODE[f.room]) }, { path: [[bx, bz]], toBed: true }]
    f.mode = 'walk'
    f.deepUntil = this.hour + 3
    this.unstash(f)
    z.comfort -= 5
    if (outside) f.comfort -= 6
    this.note(f, this.talked ? NOTES.fubo[this.talked] : NOTES.fubo.found)
    this.note(z, NOTES.zhiming.found)
  }

  /** 爸爸平安回到床上：志明的心事（睡不著）放下了，睡得很沉 */
  private restSon(z: GuestRT, how: 'slept' | 'relief') {
    const i = z.needs.findIndex((n) => n.kind === 'insomnia')
    if (i >= 0) {
      z.needs.splice(i, 1)
      z.met.push('insomnia')
    }
    z.awake = false
    z.sleep = 1
    z.resleepT = 0
    z.deepUntil = this.hour + 2.5
    z.comfort += 20
    this.ming = 'done'
    this.note(z, NOTES.zhiming[how])
  }

  /** 熱點：現在可以跟福伯說話嗎（他在外面、還沒說過） */
  canTalkFubo() {
    return this.fuboOut && !this.talked
  }

  /** 跟福伯說完話（對話結束時呼叫）：他很安心，會一直跟著阿嬤走 */
  talkFubo(choice: FuboTalk) {
    const g = this.guest('fubo')
    if (!g || !this.canTalkFubo()) return
    this.talked = choice
    g.comfort += 10
    this.greeted = true
    this.reward(1)
    this.startFollow(this.gm)
  }

  // -------------------------------------------------------------------------
  // 志偉（成人內容）
  // -------------------------------------------------------------------------

  private tickWei(dt: number, hour: number) {
    const g = this.guest('zhiwei')
    if (!g) return
    switch (this.wei) {
      case 'wait': {
        if (hour < ZHIWEI_START) return
        if (hour > ZHIWEI_GIVEUP - 1) {
          this.wei = 'skip'
          return
        }
        if (g.mode !== 'bed' || g.steps.length || hour < g.deepUntil) return
        // 做過好夢：心已經鬆了一點
        if (g.dreamt) this.warmth = Math.max(this.warmth, 1)
        const [bx, bz] = GUEST_ROOMS[g.room].bedside
        g.x = bx
        g.z = bz
        g.mode = 'walk'
        g.awake = true
        const look: XZ = [ZHIWEI_SPOT[0] + Math.sin(ZHIWEI_HEADING), ZHIWEI_SPOT[1] + Math.cos(ZHIWEI_HEADING)]
        g.steps = [{ path: [...route(BED_NODE[g.room], 'tea'), [TEA.x + 0.75, TEA.z + 0.9], ZHIWEI_SPOT] }, { wait: 1e6, look }]
        this.wei = 'walk'
        this.line('fam.zhiwei.out')
        return
      }
      case 'walk':
        if (g.steps.length === 1 && g.mode === 'stand') this.wei = 'sit'
        return
      case 'sit':
        this.absorbed(g)
        if (hour >= ZHIWEI_GIVEUP) this.weiLeave(g)
        return
      case 'send':
        this.absorbed(g)
        this.sendT -= dt
        if (this.sendT <= 0) {
          const [bx, bz] = GUEST_ROOMS[g.room].bedside
          g.steps = [{ path: route('tea', BED_NODE[g.room]) }, { path: [[bx, bz]], toBed: true }]
          this.wei = 'home'
        }
        return
      case 'home':
        // 回到床上就睡了，睡得很沉
        if (g.mode === 'bed' && !g.steps.length && !this.weiSlept) {
          this.weiSlept = true
          g.awake = false
          g.sleep = 1
          g.deepUntil = hour + 2.5
        }
        return
      case 'gone':
        if (hour >= DAWN_AT && !this.weiDawn) {
          this.weiDawn = true
          this.post('family.zhiwei.left')
        }
        return
    }
  }

  /** 盯著手機想事情：看不到阿嬤、也不會東張西望 */
  private absorbed(g: GuestRT) {
    g.suspicion = 0
    g.lookTarget = null
    g.tellT = 0
    g.lookT = 1e3
    if (g.scaredT <= 0) g.heading = ZHIWEI_HEADING
  }

  private weiLeave(g: GuestRT) {
    const [bx, bz] = GUEST_ROOMS[g.room].bedside
    g.steps = [{ path: route('tea', BED_NODE[g.room]) }, { path: [[bx, bz]], toBed: true }]
    this.wei = 'gone'
    this.line('fam.zhiwei.leave')
    this.note(g, NOTES.zhiwei.left)
  }

  /** 熱點：這件事可以做嗎（他坐在茶桌前、還沒做過） */
  canAct(a: ZhiweiAct) {
    return this.wei === 'sit' && !this.acts.includes(a)
  }

  /** 陪他做一件事；回傳這是第幾件（對話的台詞跟著變），不能做回傳 0 */
  act(a: ZhiweiAct): number {
    const g = this.guest('zhiwei')
    if (!g || !this.canAct(a)) return 0
    this.acts.push(a)
    this.warmth++
    if (a === 'meal') this.sim.satisfy(g.room, 'hungry', 20)
    else g.comfort += 8
    return Math.min(3, this.warmth)
  }

  /** 把手機推過去時，他準備好了嗎 */
  get phoneReady() {
    return this.wei === 'sit' && this.warmth >= 2
  }

  /** 訊息送出去了（對話結束時呼叫）：老婆回「回家就好」，他回去睡 */
  sendMessage() {
    const g = this.guest('zhiwei')
    if (!g || !this.phoneReady) return
    this.sent = true
    this.wei = 'send'
    this.sendT = 4
    const i = g.needs.findIndex((n) => n.kind === 'insomnia')
    if (i >= 0) {
      g.needs.splice(i, 1)
      g.met.push('insomnia')
    }
    g.comfort += 25
    g.fear = 0
    this.note(g, NOTES.zhiwei.sent)
    this.reward(3)
    this.post('family.hotline', { delay: 6 })
  }

  // -------------------------------------------------------------------------
  // 分遺產
  // -------------------------------------------------------------------------

  /** 托夢給姑姑成功（對話結束時呼叫）：天亮她會打給叔叔 */
  calmAunt(choice: AuntChoice) {
    this.auntCalm = true
    this.auntChoice = choice
  }

  /** 畫面用：某位客人的位置 */
  pos(id: GuestId): XZ | null {
    const g = this.guest(id)
    return g ? [g.x, g.z] : null
  }
}

// ---------------------------------------------------------------------------
// 登記
// ---------------------------------------------------------------------------

/** 畫面、HUD、熱點讀這個（每晚開始時換掉） */
export const familyState: { current: Family | null } = { current: null }

/** 今晚有沒有大人的心事（測試直接給 adult） */
export function makeFamily(sim: NightSim, meta: Pick<Meta, 'night' | 'story'>, opts: { adult: boolean }): Family | null {
  const has = (id: GuestId) => sim.guests.some((g) => g.id === id)
  const fubo = has('fubo')
  const wei = opts.adult && has('zhiwei')
  const inheritance = meta.night === INHERITANCE_NIGHT && !meta.story.some((x) => x.startsWith('ended_'))
  if (!fubo && !wei && !inheritance) return null
  return new Family(sim, { fubo, wei, inheritance, seed: meta.night * 53 + 11 })
}

export function createFamily(sim: NightSim, _plan: NightPlan, meta: Meta): SimPlugin | null {
  const f = makeFamily(sim, meta, { adult: adultOn() })
  familyState.current = f
  return f
}

// ---------------------------------------------------------------------------
// 事件的處理（director 併進 CUSTOM_EVENTS；只在瀏覽器跑，所以用動態 import）
// ---------------------------------------------------------------------------

const later = (ms: number, fn: () => void) => void globalThis.setTimeout(fn, ms)
const store = () => import('../../store').then((m) => m.useStore)

export const FAMILY_EVENTS: Record<string, (data: unknown) => void> = {
  'family.reward': (data) => {
    const { merit } = data as { merit: number }
    void store().then((useStore) => {
      const s = useStore.getState()
      useStore.setState({ meta: { ...s.meta, merit: s.meta.merit + merit } })
    })
    void import('../../audio').then(({ audio }) => audio.chime())
  },
  /** 志偉的故事結束：過幾秒顯示安心專線 */
  'family.hotline': (data) => {
    const { delay } = (data ?? {}) as { delay?: number }
    later((delay ?? 4) * 1000, () => void store().then((useStore) => useStore.getState().say(HOTLINE)))
  },
  'family.zhiwei.left': () => {
    void store().then((useStore) => {
      useStore.getState().say('志偉天還沒亮就退房了。茶桌上壓著房錢，沒有留話。')
      later(5000, () => useStore.getState().say(HOTLINE))
    })
  },
  /** 天快亮：姑姑打給叔叔（不賣了，小翰的心 +5），或叔叔打來吵（小翰的心 −8） */
  'family.inheritance': (data) => {
    const { calm } = data as { calm: boolean }
    void store().then((useStore) => {
      const s = useStore.getState()
      const heart = Math.min(100, Math.max(0, s.meta.heart + (calm ? 5 : -8)))
      useStore.setState({ meta: { ...s.meta, heart } })
      s.bark(calm ? 'inh.call.calm' : 'inh.call.fight')
      later(5500, () =>
        useStore
          .getState()
          .say(calm ? '姑姑一早就打給叔叔：地不賣了。小翰在門邊聽到，偷偷笑了。（小翰的心 +5）' : '天還沒亮，叔叔就打電話來吵賣地的事。小翰掛掉電話，在埕裡坐了很久。（小翰的心 −8）'),
      )
    })
  },
}
