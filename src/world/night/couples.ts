import { BARKS } from '../../data/barks'
import { GUEST_ROOMS, ROOMS } from '../../scene/layout'
import { placePlayer } from '../player'
import { seeded } from '../rng'
import { BED_NODE, NODES, route } from './nav'
import type { NightPlan } from './plan'
import type { Meta } from './director'
import type { GrandmaState, GuestRT, NightSim, SimPlugin } from './sim'
import type { GuestId, GuestType, RoomId } from './types'

// 情侶客人（DESIGN §29，成人內容）：純邏輯（Node 可測）。director.ts 每晚呼叫 createCouples()，
// 回傳 null 表示今晚沒有情侶。只有成人內容開著時 planNight() 才會排情侶入住。
// 畫面在 src/scene/CouplesLayer.tsx、熱點（勿擾牌、讓手機沒電）在 src/world/couplesStory.ts。
//
// 玩法是「別打擾」（性只用暗示和喜劇，畫面上只有門上的牌子、粉紅色的燈和愛心）：
//   兩人世界  新婚夫妻 23:00–00:12、01:18–01:48；外遇情侶 23:12–00:24。這段時間：
//             - 阿嬤走進房間 → 「哎喲喂，我什麼都沒看到」被彈出門外，兩個人覺得一陣涼（舒適 −）
//             - 別的客人會跑來敲門（小美以為有鬼、張經理嫌吵、阿豪借泡麵……），阿凱會來門口拍片
//               → 掛「請勿打擾」牌：大家看到就回去（阿凱不管牌子）
//               → 半路引開：附身的貓喵、狗吠、壁虎叫；嚇到他；阿桂阿土伯看得到阿嬤，阿嬤直接叫他們回去睏
//               → 讓阿凱拍到真的鬼：他就忘了那間房
//             - 沒人打擾撐完一段 → 兩個人都很滿意（舒適 +10）
//   手機      外遇的那晚 01:09 王先生的手機開始震（螢幕寫「老婆」）；18 秒後變成大聲響，吵醒王太太就穿幫
//             → 床頭櫃「讓手機沒電」（陰氣 8）、附身壁虎爬過去按靜音、附身阿咪一掌拍到床底下
//   評論      天亮前依整晚的結果補一句話（sim.reviewNotes）

type XZ = [number, number]
type Step = GuestRT['steps'][number]

export type CoupleKind = 'honeymoon' | 'affair'

interface CoupleDef {
  kind: CoupleKind
  ids: [GuestId, GuestId]
  /** 兩人世界的時段（小時） */
  windows: [number, number][]
}

export const COUPLE_DEFS: CoupleDef[] = [
  { kind: 'honeymoon', ids: ['ajie', 'xiaohui'], windows: [[23.0, 24.2], [25.3, 25.8]] },
  { kind: 'affair', ids: ['mrwang', 'mrswang'], windows: [[23.2, 24.4]] },
]

/** 外遇那晚的手機：幾點開始震、震幾秒變成響、幾秒響一次、響幾聲自己停、讓它沒電要多少陰氣 */
export const PHONE = { at: 25.15, buzz: 18, ringEvery: 3, rings: 5, cost: 8 }

/** 會跑來敲門的客人類型（小孩不會；照顧家人的、失智的、一個人來的有自己的事） */
const VISITOR_TYPES: GuestType[] = ['timid', 'thrill', 'business', 'backpacker', 'elder']
/** 有專屬台詞的訪客（其他人不講話） */
const VISITOR_LINES: GuestId[] = ['xiaomei', 'zhang', 'ahao', 'agui', 'atu', 'akai']
/** 走到門口以後，等幾秒才敲門／開拍（給阿嬤引開的時間） */
export const DOOR_GRACE = 5
/** 看到牌子要幾秒 */
const READ_SIGN = 1.2

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz)

function nearestNode(x: number, z: number) {
  let best = 'yardC'
  let bd = Infinity
  for (const [k, [nx, nz]] of Object.entries(NODES)) {
    const d = dist(nx, nz, x, z)
    if (d < bd) {
      bd = d
      best = k
    }
  }
  return best
}

/** 叫客人放下手邊的事、直接走回床上 */
function sendBack(g: GuestRT) {
  const from = nearestNode(g.x, g.z)
  g.steps = [{ path: [[g.x, g.z] as XZ, ...route(from, BED_NODE[g.room])], toBed: true }]
  g.filming = null
  g.stepT = 0
}

// ---------------------------------------------------------------------------
// 一對情侶
// ---------------------------------------------------------------------------

type VisitPhase = 'go' | 'door' | 'act' | 'back' | 'done'
type VisitEnd = 'sign' | 'pet' | 'scared' | 'elder' | 'knock' | 'film' | 'late'

export interface Visit {
  id: GuestId
  phase: VisitPhase
  t: number
  end: VisitEnd | null
  signChecked: boolean
  seen0: number
  captures0: number
}

interface WindowRT {
  from: number
  to: number
  state: 'wait' | 'on' | 'done'
  /** 這一段沒人打擾 */
  ok: boolean
  visitAt: number
  visitTry: boolean
  visit: Visit | null
}

export type PhoneState = 'idle' | 'buzz' | 'ring' | 'off'
export type PhoneEnd = 'drain' | 'gecko' | 'cat' | 'declined' | 'caught' | 'missed'

export interface PhoneRT {
  x: number
  z: number
  at: number
  state: PhoneState
  t: number
  rings: number
  end: PhoneEnd | null
}

export class Couple {
  readonly kind: CoupleKind
  readonly room: RoomId
  readonly ids: [GuestId, GuestId]
  readonly windows: WindowRT[]
  /** 現在是兩人世界 */
  privacy = false
  /** 畫面用：粉紅色的燈 0..1（慢慢亮、慢慢暗） */
  glow = 0
  interrupted = 0
  walkedIn = 0
  filmed = false
  signRead = 0
  distracted = 0
  okWindows = 0
  phone: PhoneRT | null = null
  /** 門外那一點（勿擾牌、訪客站的地方） */
  readonly door: XZ
  readonly doorNode: string
  /** 被彈出去的落點 */
  readonly bounce: XZ
  /** 今晚是哪一晚（勿擾牌記在 couplesState.signs） */
  private night: number
  private embarrassT = 0
  private hiddenSaid = false
  private noticed = false
  private hinted = false
  private notesDone = false
  private members: GuestRT[]
  private rnd: () => number

  constructor(
    private host: CouplesRT,
    def: CoupleDef,
    room: RoomId,
    sim: NightSim,
    night: number,
  ) {
    this.kind = def.kind
    this.room = room
    this.ids = def.ids
    this.night = night
    this.rnd = seeded(night * 613 + (room === 'r1' ? 1 : 2))
    this.members = def.ids.map((id) => sim.guests.find((g) => g.id === id)!).filter(Boolean)
    const R = GUEST_ROOMS[room]
    this.door = R.doorOut
    this.doorNode = `${room}_door_out`
    const out = Math.sign(R.doorOut[0] - R.doorIn[0])
    this.bounce = [R.doorOut[0] + out * 0.55, R.doorOut[1]]
    this.windows = def.windows.map(([from, to], i) => ({ from, to, state: 'wait', ok: true, visitAt: 99, visitTry: i > 0 && this.rnd() < 0.4, visit: null }))
    if (def.kind === 'affair') {
      const [x, z] = R.nightstand
      this.phone = { x, z, at: PHONE.at + this.rnd() * 0.15, state: 'idle', t: 0, rings: 0, end: null }
    }
  }

  get sign() {
    return couplesState.signs[this.room] === this.night
  }

  /** 現在在跑的那一段 */
  get current(): WindowRT | null {
    return this.windows.find((w) => w.state === 'on') ?? null
  }

  /** 正在路上／門口的訪客（畫面、測試用） */
  get visit(): Visit | null {
    for (const w of this.windows) if (w.visit && w.visit.phase !== 'done' && w.visit.phase !== 'back') return w.visit
    return null
  }

  private say(id: string | null, delay = 0) {
    if (id) this.host.say(id, delay)
  }

  private both(fn: (g: GuestRT) => void) {
    for (const g of this.members) fn(g)
  }

  private note(id: GuestId, text: string) {
    const sim = this.host.sim
    sim.reviewNotes[id] = (sim.reviewNotes[id] ?? '') + text
  }

  private other(id: GuestId): GuestRT | undefined {
    return this.host.sim.guests.find((g) => g.id === id)
  }

  update(dt: number, hour: number, gm: GrandmaState) {
    this.embarrassT = Math.max(0, this.embarrassT - dt)
    this.glow += ((this.privacy ? 1 : 0) - this.glow) * Math.min(1, dt * 1.5)
    // 入夜：還沒掛牌子的話提醒一下
    if (!this.hinted && hour >= 22.3) {
      this.hinted = true
      if (!this.sign) this.say(`couple.gm.sign.hint.${this.kind}`)
    }
    this.updateWindows(hour)
    if (this.privacy) {
      // 兩個人都醒著、忙著看彼此：不會睡、也不會東張西望發現阿嬤（阿嬤走進來另外算）
      this.both((g) => {
        if (g.mode !== 'bed') return
        g.awake = true
        g.resleepT = Math.max(g.resleepT, 1)
        g.suspicion = 0
        g.peak = 0
      })
      this.checkWalkIn(gm)
    }
    for (const w of this.windows) if (w.visit) this.updateVisit(w, dt, hour, gm)
    if (this.phone) this.updatePhone(dt, hour, gm)
    if (hour >= 29.2 && !this.notesDone) this.writeNotes()
  }

  // ---- 兩人世界的時段 ----
  private updateWindows(hour: number) {
    for (const [i, w] of this.windows.entries()) {
      if (w.state === 'wait' && hour >= w.to) w.state = 'done'
      if (w.state === 'wait' && hour >= w.from) {
        // 兩個人都在床上才開始（有人去廁所就等他回來）
        if (!this.members.every((g) => g.mode === 'bed' && g.steps.length === 0)) continue
        w.state = 'on'
        this.privacy = true
        w.visitAt = hour + (w.to - hour) * (0.22 + this.rnd() * 0.3)
        // 第一段一定有人來（有訪客的話）；第二段四成
        if (i === 0) w.visitTry = true
        this.both((g) => {
          if (!g.awake) {
            g.awake = true
            g.sleep = 0
          }
          if (this.sign) g.comfort += 4
        })
        this.say(`couple.start.${this.kind}${i > 0 ? '.2' : ''}`)
        if (i === 0) this.say(`couple.gm.hint.${this.kind}`, 3)
      }
      if (w.state === 'on' && hour >= w.to) {
        w.state = 'done'
        this.privacy = false
        if (w.ok) {
          this.okWindows++
          this.both((g) => (g.comfort += 10))
          this.say(`couple.ok.${this.kind}`)
        }
        // 過了睡覺時間就睡
        this.both((g) => (g.resleepT = 0))
        // 還在路上的訪客：沒聲音了，回去
        const v = w.visit
        if (v && (v.phase === 'go' || v.phase === 'door')) {
          const g = this.other(v.id)
          if (g) sendBack(g)
          v.phase = 'back'
          v.end = 'late'
        }
      }
    }
  }

  // ---- 阿嬤走進房間 ----
  private checkWalkIn(gm: GrandmaState) {
    if (!gm.home || this.embarrassT > 0) return
    const a = ROOMS[GUEST_ROOMS[this.room].room].area
    const inRoom = gm.x > a.x0 + 0.08 && gm.x < a.x1 - 0.08 && gm.z > a.z0 + 0.08 && gm.z < a.z1 - 0.08
    if (!inRoom) return
    if (gm.hidden) {
      // 躲在房間裡的衣櫃：只能摀住耳朵
      if (!this.hiddenSaid) this.say('couple.gm.hidden')
      this.hiddenSaid = true
      return
    }
    // 壁虎趴在牆上，沒人在意
    if (gm.body === 'gecko') return
    this.embarrassT = 3
    this.host.sim.emitCustom('couple.bounce', { x: this.bounce[0], z: this.bounce[1] })
    const w = this.current
    if (gm.body === 'cat' || gm.body === 'dog') {
      this.both((g) => (g.comfort -= 3))
      this.say(`couple.shoo.${this.ids[Math.floor(this.rnd() * 2)]}`)
      return
    }
    this.walkedIn++
    if (w) w.ok = false
    this.both((g) => {
      g.comfort -= 8
      g.fear += 3
    })
    this.say(`couple.gm.oops.${1 + Math.floor(this.rnd() * 3)}`)
    this.say(`couple.chill.${this.ids[Math.floor(this.rnd() * 2)]}`, 2.2)
  }

  // ---- 來敲門的人 ----
  private startVisit(w: WindowRT) {
    const sim = this.host.sim
    const others = sim.guests.filter((g) => !this.ids.includes(g.id) && g.def.type !== 'couple' && VISITOR_TYPES.includes(g.def.type) && g.awake)
    // 阿凱最愛這種「怪聲」
    others.sort((a, b) => (b.def.patrol ? 1 : 0) - (a.def.patrol ? 1 : 0))
    const look = GUEST_ROOMS[this.room].doorIn
    for (const g of others) {
      const film = g.def.patrol ? 'couple' : undefined
      let ok = false
      if (sim.isFree(g.id)) {
        ok = sim.sendGuest(g.id, this.doorNode, 16, look)
        if (ok && film) g.steps[1].film = film
      } else if (g.def.patrol && g.mode === 'stand' && g.steps.length > 1 && !g.steps[0].toBed && g.scaredT <= 0) {
        // 阿凱巡夜到一半：聽到怪聲就繞過來
        const from = nearestNode(g.x, g.z)
        const detour: Step[] = [{ path: route(from, this.doorNode) }, { wait: 16, film, look }, { path: route(this.doorNode, from) }]
        g.steps.splice(1, 0, ...detour)
        // 聽到怪聲，這一站不拍了
        g.stepT = Math.max(g.stepT, (g.steps[0].wait ?? 0) - 1.5)
        ok = true
      }
      if (!ok) continue
      w.visit = { id: g.id, phase: 'go', t: 0, end: null, signChecked: false, seen0: g.seen, captures0: g.captures }
      this.say(this.vline(g.id, 'go'))
      return true
    }
    return false
  }

  private vline(id: GuestId, what: string) {
    return VISITOR_LINES.includes(id) ? `couple.v.${id}.${what}` : null
  }

  private updateVisit(w: WindowRT, dt: number, hour: number, gm: GrandmaState) {
    const v = w.visit!
    const g = this.other(v.id)
    if (!g) return
    if (v.phase === 'back') {
      if (g.mode === 'bed') v.phase = 'done'
      return
    }
    if (v.phase === 'done') return
    const stop = (end: VisitEnd, line: string | null) => {
      sendBack(g)
      v.phase = 'back'
      v.end = end
      if (line) this.say(line)
    }
    if (v.phase === 'go' || v.phase === 'door') {
      // 被嚇到、看到鬼、被阿凱拍到了 → 忘了這回事
      if (g.scaredT > 0 || g.seen > v.seen0 || g.captures > v.captures0) {
        this.distracted++
        if (g.def.seesGhost) {
          this.say('couple.gm.shoo.elder')
          stop('elder', this.vline(g.id, 'shooed'))
        } else stop('scared', this.vline(g.id, g.captures > v.captures0 ? 'chase' : 'scared'))
        return
      }
      // 附身的動物在旁邊叫、或直接蹭過去
      if (this.host.petNear(g, gm)) {
        this.distracted++
        stop('pet', this.vline(g.id, 'pet'))
        return
      }
    }
    if (v.phase === 'go') {
      if (g.mode === 'stand' && dist(g.x, g.z, this.door[0], this.door[1]) < 0.7) {
        v.phase = 'door'
        v.t = 0
      } else if (g.mode === 'bed' && g.steps.length === 0) {
        // 不知道為什麼沒走成（被別的事打斷）
        v.phase = 'done'
      }
      return
    }
    v.t += dt
    if (v.phase === 'door') {
      if (!v.signChecked && v.t >= READ_SIGN) {
        v.signChecked = true
        if (this.sign) {
          if (g.def.patrol) this.say('couple.v.akai.sign')
          else {
            this.signRead++
            stop('sign', this.vline(g.id, 'sign'))
            return
          }
        }
      }
      if (v.t >= DOOR_GRACE) {
        v.phase = 'act'
        v.t = 0
        w.ok = false
        if (g.def.patrol) {
          v.end = 'film'
          this.filmed = true
          this.say('couple.v.akai.film')
          this.say(`couple.filmed.${this.kind}`, 3)
          const hit = this.kind === 'affair' ? 18 : 10
          this.both((m) => {
            m.comfort -= hit
            if (this.kind === 'affair') m.fear += 8
          })
          g.comfort -= 4
        } else {
          v.end = 'knock'
          this.interrupted++
          this.host.sim.emitCustom('couple.knock', { x: this.door[0], z: this.door[1] })
          this.say(this.vline(g.id, 'knock'))
          this.say(`couple.knocked.${this.kind}`, 2.4)
          this.both((m) => (m.comfort -= 12))
        }
      }
      return
    }
    // 敲完／拍完：站一下就回去
    if (v.phase === 'act' && v.t >= 3) {
      sendBack(g)
      v.phase = 'back'
    }
    void hour
  }

  // ---- 手機 ----
  private updatePhone(dt: number, hour: number, gm: GrandmaState) {
    const p = this.phone!
    if (p.state === 'idle') {
      if (hour >= p.at) {
        p.state = 'buzz'
        p.t = 0
        this.host.sim.emitCustom('couple.phone', { state: 'buzz' })
        this.say('couple.gm.phone')
      }
      return
    }
    if (p.state === 'off') return
    // 附身的壁虎爬過去按靜音、阿咪一掌拍到床底下
    if (gm.home && gm.body === 'gecko' && dist(gm.x, gm.z, p.x, p.z) < 1.2) return this.silence('gecko')
    if (gm.home && gm.body === 'cat' && dist(gm.x, gm.z, p.x, p.z) < 1.1) {
      this.host.sim.noise(p.x, p.z, 0.12)
      return this.silence('cat')
    }
    const [man, woman] = this.members
    p.t += dt
    if (p.state === 'buzz') {
      // 震動的時候王先生醒著：他自己按掉。只有王太太醒著：她會發現（先講一句，再過幾秒就穿幫）
      if (man?.awake && man.mode === 'bed' && p.t > 4) {
        p.state = 'off'
        p.end = 'declined'
        this.say('couple.phone.decline')
        return
      }
      if (woman?.awake && woman.mode === 'bed') {
        if (!this.noticed && p.t > 5) {
          this.noticed = true
          this.say('couple.phone.notice')
        }
        if (p.t > 12) return this.caught()
      }
      if (p.t >= PHONE.buzz) {
        p.state = 'ring'
        p.t = PHONE.ringEvery
      }
      return
    }
    // 響
    if (p.t >= PHONE.ringEvery) {
      p.t = 0
      p.rings++
      this.host.sim.emitCustom('couple.ring', { x: p.x, z: p.z })
      this.host.sim.noise(p.x, p.z, 0.42)
      if (this.members.some((g) => g.awake)) return this.caught()
      if (p.rings >= PHONE.rings) {
        p.state = 'off'
        p.end = 'missed'
      }
    }
  }

  private caught() {
    const p = this.phone!
    p.state = 'off'
    p.end = 'caught'
    this.both((g) => {
      g.awake = true
      g.comfort -= 18
      g.resleepT = 20
    })
    this.say('couple.phone.caught.1')
    this.say('couple.phone.caught.2', 2.6)
    this.say('couple.phone.caught.3', 5.2)
  }

  /** 讓手機安靜（熱點「讓手機沒電」、附身壁虎、附身阿咪） */
  silence(how: 'drain' | 'gecko' | 'cat') {
    const p = this.phone
    if (!p || (p.state !== 'buzz' && p.state !== 'ring')) return false
    p.state = 'off'
    p.end = how
    this.say(`couple.gm.phone.${how}`)
    return true
  }

  // ---- 天亮前的評論 ----
  private writeNotes() {
    this.notesDone = true
    const [a, b] = this.ids
    const clean = this.interrupted === 0 && this.walkedIn === 0 && !this.filmed
    if (this.kind === 'honeymoon') {
      if (clean) {
        this.note(a, this.sign ? '老闆超貼心，還幫我們在門口掛了「請勿打擾」，整晚都沒人吵。' : '整晚都好安靜，很適合度蜜月。')
        this.note(b, '明年結婚紀念日還要再來！')
      } else {
        if (this.interrupted > 0) this.note(a, '只是半夜一直有人來敲門……蜜月耶！')
        if (this.filmed) this.note(a, '還有人半夜在我們門口拍影片，搞什麼啊。')
        if (this.walkedIn > 0) this.note(b, '房間半夜會突然變冷，好像有人在看……是我想太多嗎？')
      }
    } else {
      if (this.filmed) {
        this.note(a, '希望老闆不要跟任何人說我們來過。')
        this.note(b, '半夜有人在門外拍影片，嚇死人了。')
      } else if (this.interrupted > 0) this.note(b, '半夜有人來敲門，差點嚇死。')
      else if (this.walkedIn > 0) this.note(b, '房間三不五時突然變冷，總覺得有人在看。')
      const end = this.phone?.end
      if (end === 'caught') {
        this.note(b, '半夜一通電話，讓我看清楚一個人。民宿本身沒什麼問題。')
        this.note(a, '……不予置評。')
      } else if (end === 'drain' || end === 'gecko' || end === 'cat') this.note(a, '手機半夜自己沒電了，真是謝天謝地。')
      else if (clean) this.note(a, '很隱密，不會遇到認識的人。推薦。')
    }
    // 拍到的不是鬼
    if (this.filmed) for (const g of this.host.sim.guests) if (g.def.patrol) this.note(g.id, '（附註：凌晨在某間房門口錄到的聲音不是鬼，已經刪掉了，大家不要問。）')
    // 去敲門的張經理
    for (const w of this.windows) if (w.visit?.end === 'knock' && w.visit.id === 'zhang') this.note('zhang', '隔壁房半夜不知道在幹嘛，我去敲門才安靜下來。')
  }

  /** 每一段開始時排好訪客；時間到了找人 */
  tickVisits(hour: number) {
    for (const w of this.windows) {
      if (w.state !== 'on' || w.visit || !w.visitTry || hour < w.visitAt) continue
      // 找不到人就晚一點再試，快結束了就算了
      if (!this.startVisit(w)) w.visitAt = hour + 0.08
      if (w.visitAt > w.to - 0.25) w.visitTry = false
    }
  }
}

// ---------------------------------------------------------------------------
// 外掛本體：今晚所有的情侶＋一條台詞佇列
// ---------------------------------------------------------------------------

export class CouplesRT implements SimPlugin {
  readonly couples: Couple[] = []
  private clock = 0
  private queue: { at: number; id: string }[] = []
  private prevMeow = 0
  private prevWoof = 0
  private prevChirp = 0
  /** 這一幀附身的動物剛叫了一聲 */
  private sounds = { meow: false, woof: false, chirp: false }

  constructor(
    readonly sim: NightSim,
    plan: NightPlan,
    night: number,
  ) {
    for (const p of plan.parties) {
      const def = COUPLE_DEFS.find((d) => d.ids.every((id) => p.members.includes(id)))
      if (def) this.couples.push(new Couple(this, def, p.room, sim, night))
    }
  }

  say(id: string, delay = 0) {
    this.queue.push({ at: this.clock + delay, id })
  }

  /** 附身的動物有沒有把這位客人的注意力引開 */
  petNear(g: GuestRT, gm: GrandmaState) {
    const s = this.sim
    if (this.sounds.meow && dist(s.cat.x, s.cat.z, g.x, g.z) < 4) return true
    if (this.sounds.woof && s.dog && dist(s.dog.x, s.dog.z, g.x, g.z) < 5) return true
    if (this.sounds.chirp && dist(s.gecko.x, s.gecko.z, g.x, g.z) < 4) return true
    return gm.home && (gm.body === 'cat' || gm.body === 'dog') && dist(gm.x, gm.z, g.x, g.z) < 1.4
  }

  couple(room: RoomId) {
    return this.couples.find((c) => c.room === room) ?? null
  }

  update(dt: number, hour: number, gm: GrandmaState, sim: NightSim) {
    this.clock += dt
    const meow = sim.cat.meowT
    const woof = sim.dog?.woofT ?? 0
    const chirp = sim.gecko.chirpT
    this.sounds = { meow: meow > this.prevMeow + 1e-3, woof: woof > this.prevWoof + 1e-3, chirp: chirp > this.prevChirp + 1e-3 }
    this.prevMeow = meow
    this.prevWoof = woof
    this.prevChirp = chirp
    for (const c of this.couples) {
      c.tickVisits(hour)
      c.update(dt, hour, gm)
    }
    for (let i = 0; i < this.queue.length; i++) {
      const q = this.queue[i]
      if (q.at > this.clock) continue
      this.queue.splice(i--, 1)
      sim.emitCustom('line', { id: q.id })
    }
  }
}

/** 畫面、熱點讀這裡（跟 night.sim 一樣放在模組變數）。signs：哪間房在第幾晚掛了勿擾牌 */
export const couplesState: { current: CouplesRT | null; signs: Partial<Record<RoomId, number>> } = { current: null, signs: {} }

/** 今晚這間房是情侶嗎（傍晚就知道：看 plan） */
export function coupleIn(plan: NightPlan | null | undefined, room: RoomId): CoupleKind | null {
  const p = plan?.parties.find((x) => x.room === room)
  if (!p) return null
  return COUPLE_DEFS.find((d) => d.ids.every((id) => p.members.includes(id)))?.kind ?? null
}

export function createCouples(sim: NightSim, plan: NightPlan, meta: Meta): SimPlugin | null {
  const rt = new CouplesRT(sim, plan, meta.night)
  couplesState.current = rt.couples.length ? rt : null
  return couplesState.current
}

/** 自訂事件（sim.emitCustom(kind, data)）的處理函式；director 會併進 CUSTOM_EVENTS */
export const COUPLE_EVENTS: Record<string, (data: unknown) => void> = {
  // 走進兩人世界的房間：彈回門外
  'couple.bounce': (data) => {
    const d = data as { x: number; z: number }
    placePlayer(d.x, d.z)
    void import('../../audio/sfx').then(({ sfx }) => sfx.play('whoosh', { volume: 0.5 }))
  },
  'couple.knock': () => {
    void import('../../audio/sfx').then(({ sfx }) => sfx.play('knock', { volume: 0.7 }))
  },
  'couple.phone': () => {
    void import('../../audio').then(({ audio }) => buzz(audio.ctx, audio.bus?.sfx))
  },
  'couple.ring': () => {
    void import('../../audio').then(({ audio }) => ring(audio.ctx, audio.bus?.sfx))
  },
}

// 手機的聲音（現場合成）：震動是低沉的嗡嗡、響是兩個音交替的鈴聲
function buzz(ctx: AudioContext | null, out: AudioNode | undefined) {
  if (!ctx || !out) return
  for (let i = 0; i < 3; i++) {
    const t = ctx.currentTime + i * 0.5
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = 95
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.05, t + 0.03)
    g.gain.setValueAtTime(0.05, t + 0.3)
    g.gain.linearRampToValueAtTime(0, t + 0.34)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.36)
  }
}

function ring(ctx: AudioContext | null, out: AudioNode | undefined) {
  if (!ctx || !out) return
  for (let i = 0; i < 12; i++) {
    const t = ctx.currentTime + i * 0.075
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = i % 2 ? 1320 : 1560
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.035, t)
    g.gain.setValueAtTime(0, t + 0.07)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.075)
  }
}

// ---------------------------------------------------------------------------
// 客人的台詞（src/data/couples.lines.json）：模組載入時補進 BARKS
// ---------------------------------------------------------------------------

const KINDS = ['arrive', 'idle', 'sleepy', 'need_cold', 'need_hot', 'need_thirsty', 'need_mosquito', 'need_dark', 'need_hungry', 'need_insomnia', 'need_lost', 'thanks', 'hear', 'suspect', 'seen', 'door', 'bathroom', 'woken', 'morning'] as const
const COUNT: Partial<Record<(typeof KINDS)[number], number>> = { arrive: 2, idle: 3, thanks: 2 }
for (const id of ['ajie', 'xiaohui', 'mrwang', 'mrswang'] as GuestId[]) {
  const out: Partial<Record<(typeof KINDS)[number], string[]>> = {}
  for (const k of KINDS) out[k] = Array.from({ length: COUNT[k] ?? 1 }, (_, i) => `couple.${id}.${k}.${i + 1}`)
  Object.assign(BARKS[id], out)
}
