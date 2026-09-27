import { create } from 'zustand'
import { box, rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import { DIALOGUES, type Dialogue } from './dialogues'
import type { EndingId } from './story'

// 城隍廟（DESIGN §32.2）：陰間的戶政事務所。阿嬤每個月底來「報到、延長居留」：
// 抽號碼牌 → 坐著等（可以跟排隊的鬼聊天）→ 叫到號去判官桌前 → 判官翻功德簿打分數 → 蓋「准」→ 走出廟門回家。
// 第三個月底（小翰做決定那晚）判官會提到末班車的車票；結局照舊由 story.ts 判定，只是等報到完才出現。
// 半夜也可以從鬼夜市走過來看看：已經下班了，只剩值夜班的八爺。
// 規則在這裡；畫面在 src/scene/Chenghuang.tsx、HUD 在 src/ui/ChenghuangHud.tsx。
// 這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。
//
//          z 負（北，鏡頭對面）
//   八爺的叫號窗口     城隍爺（神桌）「爾來了」     判官的桌子  七爺
//   號碼顯示板（西牆）      香爐
//        長椅（排隊的鬼）
//   號碼牌機                    ← 門（南，鏡頭這一側）

export const CH = {
  /** 廟裡（地板）範圍 */
  room: { x0: -8, x1: 8, z0: -6.4, z1: 5.2 },
  /** 城隍爺的神桌與神像（北牆正中） */
  altar: { x: 0, z: -5.55, w: 3.4, d: 1.1 },
  /** 香爐（神桌前） */
  burner: { x: 0, z: -3.7 },
  /** 「爾來了」匾額（北牆高處） */
  plaque: { x: 0, z: -6.3, y: 4.3 },
  /** 判官的桌子（面向南）、判官坐在後面 */
  desk: { x: 3.6, z: -2.9, w: 2.8, d: 1.1 },
  panguan: { x: 3.6, z: -3.85 },
  /** 七爺站在判官旁邊（拿著大印） */
  qiye: { x: 5.55, z: -3.4 },
  /** 八爺的叫號窗口（北牆西邊） */
  window: { x: -4.8, z: -5.3, w: 2.6, d: 0.8 },
  baye: { x: -4.8, z: -5.95 },
  /** 號碼顯示板（西牆，面向東） */
  board: { x: -7.85, z: -1.6, y: 2.7 },
  /** 號碼牌機（入口西邊） */
  ticket: { x: -5.4, z: 3.3 },
  /** 等候的長椅（面向北）：兩排 */
  benches: [
    { x: -2.6, z: 0.1, w: 3.8 },
    { x: -2.6, z: 1.7, w: 3.8 },
  ],
  /** 排隊的鬼（坐在長椅上） */
  queue: [
    { id: 'ch_lu', x: -4.0, z: 0.1 },
    { id: 'ch_suit', x: -1.3, z: 0.1 },
    { id: 'ch_auntie', x: -2.9, z: 1.7 },
  ],
  /** 門（南邊，鏡頭這一側） */
  door: { x: -1.2, z: 4.6 },
  /** 大紅柱子 */
  pillars: [
    { x: -6.2, z: -2.2 },
    { x: -6.2, z: 2.4 },
    { x: -2.35, z: -5.95 },
    { x: 2.35, z: -5.95 },
  ],
  /** 叫號前等幾秒跳一號 */
  tickEvery: 3.4,
}

/** 阿嬤抽到的號碼（每個月都是這個，好記） */
export const MY_TICKET = 444

// ---------------------------------------------------------------------------
// 月底的考核（純函式，scripts/sim-chenghuang.ts 測）
// ---------------------------------------------------------------------------

export interface MonthInput {
  /** 第幾個月（0 開始） */
  month: number
  /** 這個月照顧客人得到的功德 */
  merit: number
  warm: number
  spooky: number
  heart: number
  /** 扣完房貸以後的存款 */
  money: number
  pressure: number
  hanSense: number
  memories: number
  debtMonths: number
  /** 報到完要出現的結局（story.ts 的判定，這裡只拿來讓判官提一下） */
  ending: EndingId | null
  /** 回憶夠開末班車的票了（story.ts 的 TRAIN_MEMORIES） */
  trainReady: boolean
}

export type Grade = 'ap' | 'a' | 'b' | 'c' | 'd'
export const GRADE_NAME: Record<Grade, string> = { ap: '甲上', a: '甲', b: '乙', c: '丙', d: '丁' }

export interface MonthReview {
  month: number
  /** 四欄：功德、陽間評價、孫仔、帳（0 差、1 普通、2 好） */
  scores: { merit: number; warm: number; heart: number; money: number }
  total: number
  grade: Grade
  reward: { skillPts: number; merit: number }
  /** 功德簿上寫的數字（HUD 用） */
  sheet: { merit: number; warm: number; heart: number; money: number }
  /** 判官要講的話（台詞 id，依序） */
  lines: string[]
}

/** 一個月大概四晚，一晚照顧得好大約 8–12 點功德 */
export const MERIT_GOOD = 36
export const MERIT_OK = 16

const tier = (v: number, good: number, ok: number) => (v >= good ? 2 : v >= ok ? 1 : 0)

export function reviewMonth(m: MonthInput): MonthReview {
  const scores = {
    merit: tier(m.merit, MERIT_GOOD, MERIT_OK),
    warm: tier(m.warm, 50, 28),
    heart: tier(m.heart, 60, 35),
    money: m.money >= 10000 ? 2 : m.money >= 0 ? 1 : 0,
  }
  const total = scores.merit + scores.warm + scores.heart + scores.money
  const grade: Grade = total >= 7 ? 'ap' : total >= 5 ? 'a' : total >= 3 ? 'b' : total >= 1 ? 'c' : 'd'
  const reward = { ap: { skillPts: 1, merit: 3 }, a: { skillPts: 1, merit: 0 }, b: { skillPts: 0, merit: 2 }, c: { skillPts: 0, merit: 1 }, d: { skillPts: 0, merit: 0 } }[grade]

  const lines: string[] = [m.month === 0 ? 'ch.pg.open.first' : 'ch.pg.open.n']
  lines.push(`ch.pg.merit.${scores.merit}`)
  lines.push(`ch.pg.warm.${scores.warm}`)
  if (m.spooky >= 50) lines.push('ch.pg.spooky')
  lines.push(`ch.pg.heart.${scores.heart}`)
  if (m.hanSense >= 40) lines.push('ch.pg.han')
  lines.push(`ch.pg.money.${scores.money}`)
  if (m.debtMonths >= 1) lines.push('ch.pg.debt')
  if (m.memories >= 8) lines.push('ch.pg.mem')
  if (m.pressure >= 3) lines.push('ch.pg.pressure')
  lines.push(`ch.pg.grade.${grade}`)
  // 結局前的最後一次報到：判官提到末班車（結局本身還是 story.ts 決定）
  if (m.ending === 'train') lines.push('ch.pg.end.train.1', 'ch.pg.end.train.2')
  else if (m.ending === 'together') lines.push('ch.pg.end.together.1', 'ch.pg.end.together.2')
  else if (m.ending === 'stay') lines.push('ch.pg.end.stay')
  else if (m.ending === 'sold') lines.push('ch.pg.end.sold')
  else if (m.trainReady && m.month === 1) lines.push('ch.pg.tease')
  lines.push('ch.pg.stamp')
  return { month: m.month, scores, total, grade, reward, sheet: { merit: m.merit, warm: m.warm, heart: m.heart, money: m.money }, lines }
}

// ---------------------------------------------------------------------------
// 這一趟的狀態（畫面、HUD 讀；每次進廟重設）
// ---------------------------------------------------------------------------

export interface ChState {
  /** 月底報到（false：半夜從夜市走來看看，已經下班了） */
  report: boolean
  review: MonthReview | null
  /** 報到完要出現的結局 */
  ending: EndingId | null
  /** 抽到的號碼（0：還沒抽） */
  ticket: number
  /** 顯示板上現在叫到幾號 */
  now: number
  called: boolean
  /** 判官正在看功德簿（HUD 攤開功德簿） */
  reviewing: boolean
  stamped: boolean
  /** 這一趟聊過的排隊的鬼 */
  talked: string[]
  /** 距離下一次跳號的秒數 */
  wait: number
}

const fresh = (): ChState => ({ report: false, review: null, ending: null, ticket: 0, now: MY_TICKET - 6, called: false, reviewing: false, stamped: false, talked: [], wait: CH.tickEvery })

export const useCh = create<ChState>()(() => fresh())

/** 進廟（store.enterChenghuang 呼叫）：月底報到帶著考核；半夜散步沒有 */
export function resetCh(report: MonthReview | null = null, ending: EndingId | null = null) {
  useCh.setState({ ...fresh(), report: !!report, review: report, ending })
}

/** 每幀（畫面呼叫）：抽了號碼以後顯示板慢慢跳號；跳到阿嬤的號碼就叫號。回傳這一幀發生的事 */
export function stepCh(dt: number, paused: boolean): ('tick' | 'call')[] {
  const s = useCh.getState()
  if (!s.report || !s.ticket || s.called || paused) return []
  let wait = s.wait - dt
  if (wait > 0) {
    useCh.setState({ wait })
    return []
  }
  wait += CH.tickEvery
  const now = Math.min(s.ticket, s.now + 1)
  const called = now >= s.ticket
  useCh.setState({ wait, now, called })
  return called ? ['tick', 'call'] : ['tick']
}

/** 跟排隊的鬼聊天：時間過得比較快（顯示板多跳兩號） */
function passTime(n: number) {
  const s = useCh.getState()
  if (!s.ticket || s.called) return
  const now = Math.min(s.ticket - 1, s.now + n)
  useCh.setState({ now, wait: Math.min(s.wait, 1.2) })
}

// ---------------------------------------------------------------------------
// 對話
// ---------------------------------------------------------------------------

const seq = (...ids: string[]): Dialogue => ({ steps: ids.map((line) => ({ line })) })

Object.assign(DIALOGUES, {
  ch_qiye_first: seq('ch.qiye.first.1', 'ch.qiye.first.2', 'ch.qiye.first.3', 'ch.qiye.first.4'),
  ch_lu: seq('ch.lu.1', 'ch.lu.2', 'ch.lu.3', 'ch.lu.4', 'ch.lu.5', 'ch.lu.6'),
  ch_suit: seq('ch.suit.1', 'ch.suit.2', 'ch.suit.3', 'ch.suit.4', 'ch.suit.5'),
  ch_auntie: seq('ch.auntie.1', 'ch.auntie.2', 'ch.auntie.3', 'ch.auntie.4', 'ch.auntie.5'),
  ch_night_baye: seq('ch.night.baye.1', 'ch.night.baye.2', 'ch.night.baye.3', 'ch.night.baye.4'),
} satisfies Record<string, Dialogue>)

/** 判官的考核：依這個月的表現組起來（每次報到重新組） */
function reviewDialogue(r: MonthReview): Dialogue {
  return { steps: [...r.lines.map((line) => ({ line })), { line: `ch.gm.after.${r.grade}` }] }
}

// ---------------------------------------------------------------------------
// 場景
// ---------------------------------------------------------------------------

function chColliders() {
  const R = CH.room
  const rects: Rect[] = [
    // 北牆、西牆、東牆（南邊是門，只留門口兩旁的矮牆）
    rect(R.x0 - 1, R.z0 - 1, R.x1 + 1, R.z0),
    rect(R.x0 - 1, R.z0, R.x0, R.z1 + 1),
    rect(R.x1, R.z0, R.x1 + 1, R.z1 + 1),
    rect(R.x0, R.z1, CH.door.x - 1.1, R.z1 + 1),
    rect(CH.door.x + 1.1, R.z1, R.x1, R.z1 + 1),
    // 神桌、判官的桌子、叫號窗口
    box(CH.altar.x, CH.altar.z, CH.altar.w, CH.altar.d),
    box(CH.desk.x, CH.desk.z, CH.desk.w, CH.desk.d),
    box(CH.window.x, CH.window.z, CH.window.w, CH.window.d),
    // 長椅
    ...CH.benches.map((b) => box(b.x, b.z, b.w, 0.5)),
    // 號碼牌機
    box(CH.ticket.x, CH.ticket.z, 0.6, 0.5),
  ]
  const circles: Circle[] = [
    { x: CH.burner.x, z: CH.burner.z, r: 0.55 },
    { x: CH.qiye.x, z: CH.qiye.z, r: 0.35 },
    { x: CH.panguan.x, z: CH.panguan.z, r: 0.35 },
    // 大柱子：西邊兩根、神龕兩旁兩根（東邊、南邊的柱子會擋住鏡頭，不放）
    ...CH.pillars.map((p) => ({ x: p.x, z: p.z, r: 0.3 })),
  ]
  return { rects, circles, bounds: rect(R.x0 + 0.2, R.z0 + 0.2, R.x1 - 0.2, R.z1 + 0.6) }
}

export const CHENGHUANG_SCENE: SceneDef = {
  id: 'chenghuang',
  name: '城隍廟',
  colliders: chColliders(),
  spawns: { report: [CH.door.x, 3.9], market: [CH.door.x, 3.9] },
  // 半夜從夜市走來的：從門口回夜市（月底報到的要蓋完章、從門口的互動點回家）
  exits: [{ area: rect(CH.door.x - 1.0, 5.0, CH.door.x + 1.0, 5.8), to: 'market', spawn: 'chenghuang', label: '↓ 鬼夜市', sign: [CH.door.x + 1.6, 4.9], when: () => !useCh.getState().report }],
  buildings: [],
  rooms: [{ id: 'ch_hall', name: '城隍廟', area: rect(CH.room.x0, CH.room.z0, CH.room.x1, CH.room.z1) }],
  floorAt: () => 0.02,
  npcs: () => CH.queue.map((q) => ({ x: q.x, z: q.z, r: 0.25 })),
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

const report = () => useCh.getState().report
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
function withStore(fn: (st: typeof import('../store').useStore) => void) {
  void import('../store').then(({ useStore }) => fn(useStore))
}

/** 排隊的鬼：一趟聊一次（聊完時間過得比較快） */
function queueHotspot(id: string, label: string, again: string): Hotspot {
  const q = CH.queue.find((x) => x.id === id)!
  return {
    id: `ch_q_${id}`,
    scene: 'chenghuang',
    x: q.x,
    z: q.z + 0.95,
    r: 1.05,
    icon: { x: q.x, z: q.z },
    iconY: 1.9,
    label: () => (report() ? label : null),
    run: (s) => {
      const c = useCh.getState()
      if (c.talked.includes(id)) {
        s.bark(again)
        return
      }
      s.startDialogue(id, () => {
        useCh.setState({ talked: [...useCh.getState().talked, id] })
        passTime(2)
        // 幫阿姨填託夢許可的申請書：一點點功德（一趟一次）
        if (id === 'ch_auntie')
          withStore((st) => {
            const x = st.getState()
            st.setState({ meta: { ...x.meta, merit: x.meta.merit + 1 } })
          })
      })
    },
  }
}

export const CHENGHUANG_HOTSPOTS: Hotspot[] = [
  {
    id: 'ch_ticket',
    scene: 'chenghuang',
    x: CH.ticket.x + 0.2,
    z: CH.ticket.z + 0.85,
    r: 1.1,
    icon: { x: CH.ticket.x, z: CH.ticket.z },
    iconY: 1.8,
    label: () => {
      const c = useCh.getState()
      if (!c.report) return null
      return c.ticket ? `號碼牌 0${c.ticket}（等叫號）` : '抽號碼牌'
    },
    run: (s) => {
      const c = useCh.getState()
      if (c.ticket) {
        s.bark(c.called ? 'ch.baye.call' : 'ch.qiye.take.1')
        return
      }
      useCh.setState({ ticket: MY_TICKET, now: MY_TICKET - 6, wait: CH.tickEvery })
      if (!s.flags.chenghuang_met) {
        s.startDialogue('ch_qiye_first', () => {
          withStore((st) => st.setState({ flags: { ...st.getState().flags, chenghuang_met: true } }))
          window.setTimeout(() => withStore((st) => st.getState().bark('ch.ticket.gm')), 500)
        })
        return
      }
      s.bark(pick(['ch.qiye.take.1', 'ch.qiye.take.2']))
    },
  },
  queueHotspot('ch_lu', '跟排隊的阿伯聊天', 'ch.lu.again'),
  queueHotspot('ch_suit', '跟穿西裝的阿伯聊天', 'ch.suit.again'),
  queueHotspot('ch_auntie', '幫阿姨填申請書', 'ch.auntie.again'),
  {
    id: 'ch_desk',
    scene: 'chenghuang',
    x: CH.desk.x - 0.2,
    z: CH.desk.z + 1.25,
    r: 1.3,
    icon: { x: CH.panguan.x, z: CH.panguan.z },
    iconY: 2.5,
    label: () => {
      const c = useCh.getState()
      if (!c.report) return null
      if (c.stamped) return '判官（章蓋好了）'
      if (!c.ticket) return '判官（先抽號碼牌）'
      if (!c.called) return `判官（還沒叫到 0${c.ticket} 號）`
      return '到判官桌前報到'
    },
    run: (s) => {
      const c = useCh.getState()
      if (c.stamped) {
        s.bark('ch.pg.done')
        return
      }
      if (!c.ticket) {
        s.bark('ch.pg.noticket')
        return
      }
      if (!c.called || !c.review) {
        s.bark('ch.pg.wait')
        return
      }
      const r = c.review
      DIALOGUES.ch_review = reviewDialogue(r)
      useCh.setState({ reviewing: true })
      s.startDialogue('ch_review', () => {
        useCh.setState({ reviewing: false, stamped: true })
        withStore((st) => {
          const x = st.getState()
          st.setState({ meta: { ...x.meta, skillPts: x.meta.skillPts + r.reward.skillPts, merit: x.meta.merit + r.reward.merit } })
        })
      })
    },
  },
  {
    id: 'ch_altar',
    scene: 'chenghuang',
    x: CH.altar.x,
    z: CH.burner.z + 1.0,
    r: 1.2,
    icon: { x: CH.altar.x, z: CH.altar.z },
    iconY: 3.0,
    label: () => '拜城隍爺',
    run: (s) => s.bark(pick(['ch.altar.1', 'ch.altar.2'])),
  },
  {
    id: 'ch_plaque',
    scene: 'chenghuang',
    x: CH.plaque.x - 1.6,
    z: CH.burner.z + 0.4,
    r: 1.0,
    icon: { x: CH.plaque.x, z: CH.plaque.z + 0.3 },
    iconY: CH.plaque.y + 0.8,
    label: () => '「爾來了」匾額',
    run: (s) => s.bark(pick(['ch.plaque.1', 'ch.plaque.2'])),
  },
  {
    // 半夜：值夜班的八爺
    id: 'ch_night_baye',
    scene: 'chenghuang',
    x: CH.window.x,
    z: CH.window.z + 1.1,
    r: 1.2,
    icon: { x: CH.baye.x, z: CH.baye.z },
    iconY: 2.3,
    label: () => (report() ? null : '叫醒值夜班的八爺'),
    run: (s) => {
      if (s.flags.ch_night_today) {
        s.bark('ch.night.baye.again')
        return
      }
      s.startDialogue('ch_night_baye', () => withStore((st) => st.setState({ flags: { ...st.getState().flags, ch_night_today: true } })))
    },
  },
  {
    id: 'ch_door',
    scene: 'chenghuang',
    x: CH.door.x,
    z: CH.door.z,
    r: 1.2,
    iconY: 2.2,
    label: () => {
      const c = useCh.getState()
      if (!c.report) return null
      return c.stamped ? '走出廟門（回家）' : null
    },
    run: (s) => {
      s.bark('ch.exit')
      window.setTimeout(() => withStore((st) => st.getState().exitChenghuang()), 900)
    },
  },
]
