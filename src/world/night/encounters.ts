import LINES from '../../data/encounters.lines.json'
import { seeded } from '../rng'
import { BED_NODE, NODES, route } from './nav'
import type { NightPlan } from './plan'
import type { Meta } from './director'
import type { GrandmaState, GuestRT, NightSim, SimPlugin } from './sim'
import type { GuestId } from './types'

// 客人之間的故事（DESIGN §27.2）：純邏輯（Node 可測）。director.ts 每晚呼叫 createEncounters()，
// 回傳 null 表示今晚沒有。耳語選項的 UI 在 src/ui/EncounterPanel.tsx、畫面在 src/scene/Encounters.tsx。
//
// 流程：時間到、兩個人都醒著有空 → 一起走到約好的地方（面對面站著）→ 一句一句講（sim.emitCustom('line')）
// → 講到分岔點時，阿嬤在 5 公尺內就跳出耳語選項（等 8 秒，時間照走）；不在旁邊或沒選就照預設的走
// → 結局：舒適／驚嚇、評論附註（sim.reviewNotes）、旗標（enc_<id>_done），兩個人走回床上。

type XZ = [number, number]
type Line = { who: string; text: string }
const L = LINES as Record<string, Line>

/** 阿嬤要在這個距離內才能耳語（公尺） */
export const WHISPER_RANGE = 5
/** 耳語選項等多久（真實秒數） */
export const CHOICE_SECONDS = 8

// ---------------------------------------------------------------------------
// 劇本
// ---------------------------------------------------------------------------

/** 對話節點：講一句、分岔（阿嬤耳語）、結局 */
type EncNode = { line: string; next: string } | { choice: { line: string; next: string }[]; def: string } | { end: string }

export interface Outcome {
  comfort?: Partial<Record<GuestId, number>>
  fear?: Partial<Record<GuestId, number>>
  /** 天亮評論後面接的一句 */
  notes?: Partial<Record<GuestId, string>>
  /** 回到床上就想睡 */
  sleepy?: GuestId[]
  /** 吃到東西（泡麵）：房間的「肚子餓」解決 */
  fed?: GuestId[]
  /** 跟阿春聊到了（老朋友的「想聊天」解決） */
  chat?: GuestId[]
}

export interface Script {
  id: string
  /** 面板上的標題 */
  title: string
  a: GuestId
  b: GuestId
  /** 約在哪個路點（night/nav.ts 的 NODES） */
  node: string
  /** 兩個人各站在路點旁邊哪裡（面對面） */
  offA: XZ
  offB: XZ
  /** 兩個人一起看的地方（沒有就看對方） */
  look?: XZ
  /** 幾點到幾點之間開始（遊戲小時） */
  window: [number, number]
  start: string
  graph: Record<string, EncNode>
  outcomes: Record<string, Outcome>
}

/** 一串台詞：p = 'enc.<id>.'，keys 依序接起來，最後接到 then */
function chain(p: string, keys: string[], then: string): Record<string, EncNode> {
  const out: Record<string, EncNode> = {}
  keys.forEach((k, i) => {
    out[k] = { line: p + k, next: i + 1 < keys.length ? keys[i + 1] : then }
  })
  return out
}
const q = (p: string, opts: [string, string][], def: string): EncNode => ({ choice: opts.map(([w, next]) => ({ line: p + w, next })), def })

const P = {
  akai_zhang: 'enc.akai_zhang.',
  linmom_ahao: 'enc.linmom_ahao.',
  xiaomei_agui: 'enc.xiaomei_agui.',
  agui_atu: 'enc.agui_atu.',
  xiaoyu_ahao: 'enc.xiaoyu_ahao.',
}

/** 優先順序就是陣列順序（同一個人一晚只會有一段） */
export const SCRIPTS: Script[] = [
  {
    // 阿凱半夜在埕上直播，把出來講電話的張經理拍進去
    id: 'akai_zhang',
    title: '拍到老闆',
    a: 'akai',
    b: 'zhang',
    node: 'yardC',
    offA: [-0.6, 0.1],
    offB: [0.6, -0.1],
    window: [22.5, 23.3],
    start: '1',
    graph: {
      ...chain(P.akai_zhang, ['1', '2', '3', '4'], 'q1'),
      q1: q(P.akai_zhang, [['w1a', 'a1'], ['w1b', 'b1']], 'c1'),
      ...chain(P.akai_zhang, ['a1', 'a2', 'a3', 'a4'], 'q2'),
      q2: q(P.akai_zhang, [['w2a', 'a5'], ['w2b', 'a7']], 'a7'),
      ...chain(P.akai_zhang, ['a5', 'a6'], 'tea'),
      ...chain(P.akai_zhang, ['a7', 'a8'], 'calm'),
      ...chain(P.akai_zhang, ['b1', 'b2', 'b3', 'b4'], 'q3'),
      q3: q(P.akai_zhang, [['w3a', 'b5'], ['w3b', 'b7']], 'b7'),
      ...chain(P.akai_zhang, ['b5', 'b6'], 'viral'),
      ...chain(P.akai_zhang, ['b7', 'b8'], 'bed'),
      ...chain(P.akai_zhang, ['c1', 'c2', 'c3'], 'argue'),
      tea: { end: 'tea' },
      calm: { end: 'calm' },
      viral: { end: 'viral' },
      bed: { end: 'bed' },
      argue: { end: 'argue' },
    },
    outcomes: {
      tea: {
        comfort: { zhang: 14, akai: 10 },
        notes: { zhang: '半夜在埕上跟隔壁的 YouTuber 喝烏龍茶，聊到一點，意外地好睡。', akai: '今晚沒拍到鬼，但認識一個很會失眠的大哥，這集也值得了。' },
      },
      calm: {
        comfort: { zhang: 12, akai: 6 },
        sleepy: ['zhang'],
        notes: { zhang: '半夜在埕上想通了一件事：明天的事，明天再煩。好久沒睡這麼好。', akai: '隔壁大哥講了一句金句，我直接拿來當這集的標題。' },
      },
      viral: {
        comfort: { akai: 16, zhang: 4 },
        notes: { zhang: '被隔壁的年輕人拉去入鏡，聽說點閱破萬。明天開會一定會被同事笑。', akai: '今晚的神來一筆是隔壁大哥，他的假笑比鬼還可怕，這集一定爆。' },
      },
      bed: {
        comfort: { zhang: 8, akai: 6 },
        sleepy: ['zhang'],
        notes: { zhang: '隔壁的年輕人其實很有禮貌，拍完就讓我回去睡。', akai: '隔壁大哥友情客串，人超好。' },
      },
      argue: {
        comfort: { zhang: -6, akai: -3 },
        notes: { zhang: '隔壁房的年輕人半夜在外面直播，有點吵。', akai: '隔壁大哥好兇，差點搶我手機。' },
      },
    },
  },
  {
    // 灶腳：來泡牛奶的林太太，遇到找東西吃的背包客
    id: 'linmom_ahao',
    title: '灶腳的泡麵',
    a: 'linmom',
    b: 'ahao',
    node: 'kitchen_stove',
    offA: [0.5, -0.45],
    offB: [0.35, 0.6],
    window: [23.0, 23.55],
    start: '1',
    graph: {
      ...chain(P.linmom_ahao, ['1', '2', '3', '4'], 'q1'),
      q1: q(P.linmom_ahao, [['w1a', 'a1'], ['w1b', 'b1']], 'c1'),
      ...chain(P.linmom_ahao, ['a1', 'a2', 'a3', 'a4'], 'q2'),
      q2: q(P.linmom_ahao, [['w2a', 'a5'], ['w2b', 'a7']], 'a5'),
      ...chain(P.linmom_ahao, ['a5', 'a6'], 'laugh'),
      ...chain(P.linmom_ahao, ['a7', 'a8'], 'fireflies'),
      ...chain(P.linmom_ahao, ['b1', 'b2', 'b3', 'b4'], 'noodle'),
      ...chain(P.linmom_ahao, ['c1', 'c2'], 'polite'),
      laugh: { end: 'laugh' },
      fireflies: { end: 'fireflies' },
      noodle: { end: 'noodle' },
      polite: { end: 'polite' },
    },
    outcomes: {
      laugh: {
        comfort: { linmom: 16, ahao: 8 },
        fear: { linmom: -8 },
        notes: { linmom: '半夜在灶腳遇到一個背包客，陪我聊了好久。這趟旅行第一次笑出來。', ahao: '半夜在灶腳交到一個朋友，她說我講話像她阿嬤，這是稱讚吧？' },
      },
      fireflies: {
        comfort: { linmom: 12, ahao: 8 },
        notes: { linmom: '民宿的背包客推薦我們去溪邊看火金姑，小宇說那會是他最棒的一天。', ahao: '推坑一對母子去看火金姑，功德一件。' },
      },
      noodle: {
        comfort: { linmom: 10, ahao: 8 },
        fed: ['ahao', 'linmom'],
        notes: { linmom: '半夜跟隔壁房的年輕人分一包泡麵，意外地好吃，好像回到大學。', ahao: '泡麵分一半，快樂加倍。' },
      },
      polite: {},
    },
  },
  {
    // 茶桌：怕鬼的小美，遇到出來看月亮的阿桂
    id: 'xiaomei_agui',
    title: '阿春是誰',
    a: 'xiaomei',
    b: 'agui',
    node: 'tea',
    offA: [-0.55, 0.15],
    offB: [0.55, 0.15],
    window: [22.25, 22.95],
    start: '1',
    graph: {
      ...chain(P.xiaomei_agui, ['1', '2', '3', '4', '5'], 'q1'),
      q1: q(P.xiaomei_agui, [['w1a', 'a1'], ['w1b', 'b1']], 'b1'),
      ...chain(P.xiaomei_agui, ['a1', 'a2', 'a3'], 'q2'),
      q2: q(P.xiaomei_agui, [['w2a', 'a4'], ['w2b', 'a6']], 'a6'),
      ...chain(P.xiaomei_agui, ['a4', 'a5'], 'safe'),
      ...chain(P.xiaomei_agui, ['a6'], 'sleep'),
      ...chain(P.xiaomei_agui, ['b1', 'b2', 'b3', 'b4'], 'story'),
      safe: { end: 'safe' },
      sleep: { end: 'sleep' },
      story: { end: 'story' },
    },
    outcomes: {
      safe: {
        comfort: { xiaomei: 12, agui: 8 },
        fear: { xiaomei: -20 },
        notes: { xiaomei: '隔壁的阿姨說，這間民宿的阿嬤會半夜幫人蓋被子。本來很怕，後來覺得好溫暖。', agui: '跟一個年輕女孩講阿春的事，好像阿春也在旁邊聽。' },
      },
      sleep: {
        comfort: { xiaomei: 6, agui: 5 },
        fear: { xiaomei: -10 },
        sleepy: ['xiaomei'],
        notes: { xiaomei: '半夜被一個阿姨嚇到，結果聊一聊就不怕了。' },
      },
      story: {
        comfort: { xiaomei: 12, agui: 8 },
        fear: { xiaomei: -15 },
        notes: { xiaomei: '半夜跟一個阿姨聊天，聽到好多這間房子的故事，一點都不可怕了。', agui: '又講了一次阿春的菜脯蛋，年輕人笑得好開心。' },
      },
    },
  },
  {
    // 神明廳：阿桂和阿土伯在阿春的神明廳前，為了她嫁過來那天穿什麼鞋吵起來
    id: 'agui_atu',
    title: '紅皮鞋',
    a: 'agui',
    b: 'atu',
    node: 'altar',
    offA: [-0.45, 0.2],
    offB: [0.45, 0.2],
    look: [0, NODES.altar[1] - 2.2],
    window: [22.1, 22.7],
    start: '1',
    graph: {
      ...chain(P.agui_atu, ['1', '2', '3', '4', '5'], 'q1'),
      q1: q(P.agui_atu, [['w1a', 'a1'], ['w1b', 'b1']], 'c1'),
      ...chain(P.agui_atu, ['a1', 'a2', 'a3'], 'q2'),
      q2: q(P.agui_atu, [['w2a', 'a4'], ['w2b', 'a6']], 'a6'),
      ...chain(P.agui_atu, ['a4', 'a5'], 'thanks'),
      ...chain(P.agui_atu, ['a6'], 'sunrise'),
      ...chain(P.agui_atu, ['b1', 'b2', 'b3'], 'tangyuan'),
      ...chain(P.agui_atu, ['c1', 'c2'], 'bicker'),
      thanks: { end: 'thanks' },
      sunrise: { end: 'sunrise' },
      tangyuan: { end: 'tangyuan' },
      bicker: { end: 'bicker' },
    },
    outcomes: {
      thanks: {
        comfort: { agui: 16, atu: 16 },
        chat: ['agui'],
        notes: { agui: '在阿春的神明廳前跟老伴吵了一架，吵到最後兩個人都哭了。她的厝還是這麼溫暖。', atu: '……阿春，鞋子是紅的。' },
      },
      sunrise: {
        comfort: { agui: 10, atu: 10 },
        sleepy: ['agui', 'atu'],
        notes: { agui: '老伴難得講了好多話。今天要早起看日出。' },
      },
      tangyuan: {
        comfort: { agui: 10, atu: 10 },
        notes: { agui: '半夜突然好想吃湯圓，是阿春的婆婆以前煮的那個味道。' },
      },
      bicker: {
        comfort: { agui: 3, atu: 3 },
        notes: { agui: '老伴還是那麼固執。不過在阿春的厝裡吵架，好像回到年輕的時候。' },
      },
    },
  },
  {
    // 茶桌：小宇拉著背包客大哥哥玩翻花繩
    id: 'xiaoyu_ahao',
    title: '翻花繩',
    a: 'xiaoyu',
    b: 'ahao',
    node: 'tea',
    offA: [-0.5, 0.2],
    offB: [0.55, 0.1],
    window: [22.2, 22.9],
    start: '1',
    graph: {
      ...chain(P.xiaoyu_ahao, ['1', '2', '3', '4', '5'], 'q1'),
      q1: q(P.xiaoyu_ahao, [['w1a', 'a1'], ['w1b', 'b1']], 'b1'),
      ...chain(P.xiaoyu_ahao, ['a1', 'a2', 'a3'], 'secret'),
      ...chain(P.xiaoyu_ahao, ['b1', 'b2', 'b3'], 'q2'),
      q2: q(P.xiaoyu_ahao, [['w2a', 'b4'], ['w2b', 'b6']], 'b6'),
      ...chain(P.xiaoyu_ahao, ['b4', 'b5'], 'win'),
      ...chain(P.xiaoyu_ahao, ['b6', 'b7'], 'sleepy'),
      secret: { end: 'secret' },
      win: { end: 'win' },
      sleepy: { end: 'sleepy' },
    },
    outcomes: {
      secret: {
        comfort: { xiaoyu: 10, ahao: 6 },
        notes: { ahao: '半夜跟一個小朋友玩翻花繩，他一直說有個會飄的阿嬤。小孩的想像力真好。', xiaoyu: '小宇說隔壁的大哥哥翻花繩翻出「麵線」，笑到睡著。' },
      },
      win: {
        comfort: { xiaoyu: 10, ahao: 12 },
        notes: { ahao: '人生第一次翻出「星星」，老師是一個五歲小孩。', xiaoyu: '小宇學會教別人翻花繩了，很得意。' },
      },
      sleepy: {
        comfort: { xiaoyu: 8, ahao: 6 },
        sleepy: ['xiaoyu'],
        notes: { ahao: '被一個小朋友電爆翻花繩，他玩到自己睡著。' },
      },
    },
  },
]

/** 約的地方叫什麼（面板上用） */
export const PLACE_NAME: Record<string, string> = { yardC: '埕上', kitchen_stove: '灶腳', tea: '茶桌', altar: '神明廳' }

// ---------------------------------------------------------------------------
// 給畫面讀的狀態（每幀改；有畫面要的變化才 bump version）
// ---------------------------------------------------------------------------

export interface EncounterView {
  id: string
  title: string
  a: GuestId
  b: GuestId
  place: string
  phase: 'walk' | 'talk' | 'choice' | 'done'
  /** 現在誰在講（guest id 或 'grandma'） */
  speaker: string | null
  /** 兩個人中間（耳語範圍的圓心） */
  mid: XZ
  /** 阿嬤在耳語範圍內 */
  inRange: boolean
  /** 剛剛講的那句 */
  last: Line | null
  /** 耳語選項（正在等阿嬤選） */
  choice: { options: string[]; remaining: number; total: number } | null
  /** 結局 id（done 之後） */
  outcome: string | null
}

export const encounterState: { view: EncounterView | null; version: number } = { view: null, version: 0 }
const listeners = new Set<() => void>()

export function subscribeEncounter(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function bump() {
  encounterState.version++
  for (const fn of listeners) fn()
}

/** 阿嬤選了第 i 個耳語（UI 呼叫） */
let picked: number | null = null
export function pickWhisper(i: number) {
  if (encounterState.view?.phase === 'choice') picked = i
}

/** 台詞要講多久（秒）：畫面那邊可以換成語音檔的長度 */
export const encounterTiming: { voiceDur: (id: string) => number } = { voiceDur: () => 0 }
export function lineSeconds(id: string) {
  const text = L[id]?.text ?? ''
  return Math.max(0.9 + text.length * 0.14, encounterTiming.voiceDur(id) + 0.35)
}

/** 已經演過的劇本（旗標 enc_<id>_done；UI 從存檔同步進來） */
export const doneEncounters = new Set<string>()

// ---------------------------------------------------------------------------
// 外掛
// ---------------------------------------------------------------------------

interface Running {
  script: Script
  /** 什麼時候開始找人 */
  at: number
  state: 'waiting' | 'walk' | 'talk' | 'done'
  /** 兩個人各自的「站著聊天」那一步（放掉就會走回床上） */
  waitA: GuestRT['steps'][number] | null
  waitB: GuestRT['steps'][number] | null
  node: string
  /** 這一句還剩幾秒 */
  t: number
  /** 分岔點等了多久 */
  choiceT: number
  /** 正在分岔點上 */
  inChoice: boolean
  /** 回到床上就想睡的人 */
  sleepy: GuestId[]
  /** 阿嬤有在旁邊聽到（沒聽到的故事之後還會再演） */
  heard: boolean
}

const dist = (a: XZ, b: XZ) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** 找離 (x, z) 最近的路點 */
function nearestNode(x: number, z: number) {
  let best = 'yardC'
  let bd = Infinity
  for (const [k, p] of Object.entries(NODES)) {
    const d = Math.hypot(p[0] - x, p[1] - z)
    if (d < bd) {
      bd = d
      best = k
    }
  }
  return best
}

/**
 * 叫客人去約好的地方站著。在床上的用 sim.sendGuest；YouTuber 巡夜巡到一半的，直接改他的行程。
 * 回傳「站著」那一步（之後把 wait 設成 0 就會走回床上）。
 */
function summon(sim: NightSim, g: GuestRT, node: string, off: XZ, look: XZ): GuestRT['steps'][number] | null {
  const [nx, nz] = NODES[node]
  const spot: XZ = [nx + off[0], nz + off[1]]
  if (g.mode === 'bed') {
    if (!sim.sendGuest(g.id, node, 9999, look)) return null
  } else {
    // 巡夜中：從手上這一段的目標路點（或最近的路點）接過去
    const cur = g.steps[0]
    const head = cur?.path?.length ? cur.path[0] : null
    const from = head ? (Object.keys(NODES).find((k) => NODES[k] === head) ?? nearestNode(head[0], head[1])) : nearestNode(g.x, g.z)
    g.filming = null
    g.spot = null
    g.stepT = 0
    g.steps = [
      { path: [...(head ? [head] : []), ...route(from, node)] },
      { wait: 9999, look },
      { path: route(node, BED_NODE[g.room]), toBed: true },
    ]
  }
  // 最後一步走到路點旁邊，兩個人才不會疊在一起
  g.steps[0].path?.push(spot)
  return g.steps[1]
}

/** 客人還在我們安排的行程上嗎（沒被嚇跑、沒被別的事叫走） */
const onTrack = (g: GuestRT, wait: GuestRT['steps'][number] | null) => !!wait && g.steps.includes(wait) && g.scaredT <= 0

class Encounters implements SimPlugin {
  private list: Running[]
  private cur: Running | null = null

  constructor(scripts: Script[], rnd: () => number) {
    this.list = scripts.map((script) => ({
      script,
      at: script.window[0] + rnd() * 0.12,
      state: 'waiting',
      waitA: null,
      waitB: null,
      node: script.start,
      t: 0,
      choiceT: 0,
      inChoice: false,
      sleepy: [],
      heard: false,
    }))
    encounterState.view = null
    picked = null
    bump()
  }

  update(dt: number, hour: number, gm: GrandmaState, sim: NightSim) {
    // 回到床上就想睡
    for (const r of this.list)
      for (const id of r.sleepy) {
        const g = sim.guests.find((x) => x.id === id)
        if (g && g.mode === 'bed' && g.resleepT > 0) g.resleepT = 0
      }
    if (!this.cur) {
      const next = this.list.find((r) => r.state === 'waiting' && hour >= r.at)
      if (!next) return
      if (hour > next.script.window[1]) {
        next.state = 'done'
        return
      }
      if (!this.tryStart(next, sim)) return
      this.cur = next
    }
    this.step(this.cur, dt, hour, gm, sim)
  }

  private guests(r: Running, sim: NightSim) {
    const a = sim.guests.find((g) => g.id === r.script.a)!
    const b = sim.guests.find((g) => g.id === r.script.b)!
    return [a, b] as const
  }

  /** 兩個人都醒著、有空（YouTuber 巡夜中也算有空）才開始 */
  private tryStart(r: Running, sim: NightSim) {
    const [a, b] = this.guests(r, sim)
    const ready = (g: GuestRT) => g.awake && g.scaredT <= 0 && (sim.isFree(g.id) || (g.def.patrol === true && g.mode !== 'bed'))
    if (!ready(a) || !ready(b)) return false
    const s = r.script
    const [nx, nz] = NODES[s.node]
    const pa: XZ = [nx + s.offA[0], nz + s.offA[1]]
    const pb: XZ = [nx + s.offB[0], nz + s.offB[1]]
    r.waitA = summon(sim, a, s.node, s.offA, s.look ?? pb)
    r.waitB = summon(sim, b, s.node, s.offB, s.look ?? pa)
    if (!r.waitA || !r.waitB) {
      // 只叫到一個人：放他回去
      if (r.waitA) r.waitA.wait = 0
      if (r.waitB) r.waitB.wait = 0
      r.state = 'done'
      return false
    }
    r.state = 'walk'
    encounterState.view = {
      id: s.id,
      title: s.title,
      a: s.a,
      b: s.b,
      place: PLACE_NAME[s.node] ?? '',
      phase: 'walk',
      speaker: null,
      mid: [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2],
      inRange: false,
      last: null,
      choice: null,
      outcome: null,
    }
    bump()
    return true
  }

  private step(r: Running, dt: number, _hour: number, gm: GrandmaState, sim: NightSim) {
    const v = encounterState.view!
    const [a, b] = this.guests(r, sim)
    // 阿嬤在不在旁邊（附身、躲著也聽得到）
    const inRange = gm.home && dist([gm.x, gm.z], v.mid) <= WHISPER_RANGE
    if (inRange && r.state === 'talk') r.heard = true
    if (inRange !== v.inRange) {
      v.inRange = inRange
      bump()
    }
    // 被嚇跑、被叫走：聊不下去了
    if (!onTrack(a, r.waitA) || !onTrack(b, r.waitB)) {
      this.finish(r, sim, null)
      return
    }
    if (r.state === 'walk') {
      const arrived = a.steps[0] === r.waitA && b.steps[0] === r.waitB
      if (!arrived) return
      r.state = 'talk'
      r.t = 0.6
      v.phase = 'talk'
      bump()
      return
    }
    const node = r.script.graph[r.node]
    if ('choice' in node) {
      // 分岔：上一句講完才開始。阿嬤在旁邊就等她選（最多 8 秒）；不在就停一拍（這一拍裡她走近也算）
      if (!r.inChoice) {
        r.t -= dt
        if (r.t > 0) return
        r.inChoice = true
        r.choiceT = 0
        picked = null
      }
      r.choiceT += dt
      if (v.phase !== 'choice' && inRange) {
        v.phase = 'choice'
        v.speaker = null
        v.choice = { options: node.choice.map((o) => L[o.line]?.text ?? ''), remaining: CHOICE_SECONDS, total: CHOICE_SECONDS }
        r.choiceT = 0
        bump()
      }
      if (v.phase === 'choice') {
        const rem = Math.max(0, CHOICE_SECONDS - r.choiceT)
        if (Math.floor(rem * 4) !== Math.floor(v.choice!.remaining * 4)) {
          v.choice!.remaining = rem
          bump()
        }
        if (picked !== null && node.choice[picked]) {
          const o = node.choice[picked]
          picked = null
          r.inChoice = false
          v.phase = 'talk'
          v.choice = null
          this.say(o.line, sim, gm)
          r.t = lineSeconds(o.line)
          r.node = o.next
          return
        }
        if (rem > 0) return
      } else if (r.choiceT < 1.5) return
      // 沒選（或阿嬤不在）：照預設的走
      r.inChoice = false
      r.node = node.def
      r.t = 0
      v.phase = 'talk'
      v.choice = null
      bump()
      return
    }
    // 講話：這句講完再講下一句
    r.t -= dt
    if (r.t > 0) return
    if ('end' in node) {
      this.finish(r, sim, node.end)
      return
    }
    this.say(node.line, sim, gm)
    r.t = lineSeconds(node.line)
    r.node = node.next
  }

  private say(id: string, sim: NightSim, gm: GrandmaState) {
    const v = encounterState.view!
    const line = L[id]
    v.speaker = line?.who ?? null
    v.last = line ?? null
    bump()
    // 阿嬤不在家就聽不到（字幕不出來），但故事照樣進行
    if (gm.home) sim.emitCustom('line', { id })
  }

  private finish(r: Running, sim: NightSim, outcomeId: string | null) {
    const [a, b] = this.guests(r, sim)
    const o = outcomeId ? r.script.outcomes[outcomeId] : undefined
    if (o) {
      for (const g of [a, b]) {
        g.comfort += o.comfort?.[g.id] ?? 0
        g.fear = Math.max(0, g.fear + (o.fear?.[g.id] ?? 0))
        const note = o.notes?.[g.id]
        if (note) sim.reviewNotes[g.id] = (sim.reviewNotes[g.id] ?? '') + note
      }
      for (const id of o.fed ?? []) {
        const g = sim.guests.find((x) => x.id === id)
        if (g) sim.satisfy(g.room, 'hungry', 10)
      }
      for (const id of o.chat ?? []) {
        const g = sim.guests.find((x) => x.id === id)
        if (g) sim.satisfy(g.room, 'chat', 15)
      }
      r.sleepy = o.sleepy ?? []
      if (r.heard) doneEncounters.add(r.script.id)
    }
    // 放兩個人回床上
    if (r.waitA) r.waitA.wait = 0
    if (r.waitB) r.waitB.wait = 0
    r.state = 'done'
    this.cur = null
    const v = encounterState.view
    if (v) {
      v.phase = 'done'
      v.choice = null
      v.speaker = null
      v.outcome = outcomeId
    }
    bump()
    sim.emitCustom('enc_done', { id: r.script.id, outcome: outcomeId, heard: r.heard })
  }
}

/** 今晚要演哪幾段：兩個人都住在這裡、還沒演過；同一個人一晚只一段 */
export function pickScripts(members: GuestId[], done: Set<string> = doneEncounters): Script[] {
  const used = new Set<GuestId>()
  const out: Script[] = []
  for (const s of SCRIPTS) {
    if (done.has(s.id) || !members.includes(s.a) || !members.includes(s.b)) continue
    if (used.has(s.a) || used.has(s.b)) continue
    used.add(s.a)
    used.add(s.b)
    out.push(s)
  }
  return out.sort((x, y) => x.window[0] - y.window[0])
}

export function createEncounters(_sim: NightSim, plan: NightPlan, meta: Meta): SimPlugin | null {
  encounterState.view = null
  bump()
  const members = plan.parties.flatMap((p) => p.members)
  const scripts = pickScripts(members)
  if (!scripts.length) return null
  return new Encounters(scripts, seeded(meta.night * 977 + 13))
}

/** 自訂事件（sim.emitCustom(kind, data)）的處理函式；director 會併進 CUSTOM_EVENTS */
export const ENCOUNTER_EVENTS: Record<string, (data: unknown) => void> = {
  // 演完一段：記旗標（下次不會再演同一段）
  enc_done: (data) => {
    const { id, outcome, heard } = data as { id: string; outcome: string | null; heard: boolean }
    if (!outcome || !heard) return
    doneEncounters.add(id)
    void import('../../store').then(({ useStore }) =>
      useStore.setState((s) => ({ flags: { ...s.flags, [`enc_${id}_done`]: true, [`enc_${id}_${outcome}`]: true } })),
    )
  },
}
