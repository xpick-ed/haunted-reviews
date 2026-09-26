import { box, rect, wallRects, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import type { HopscotchResult } from '../ui/minigames/types'
import { configurePlay, kidsGate, schoolPlay, startHide, startTag, type HideSpot } from './tag'

// 廢棄國小（DESIGN §26.1）：從村子南邊的小橋、田埂過來。阿嬤小時候讀的「後壁厝國民學校」。
// 一群小孩鬼：鬼抓人（3D 追逐）、跳房子（節奏小遊戲）、躲貓貓（找人）；教室裡有阿嬤的童年回憶。
// 規則在這裡；畫面在 src/scene/School.tsx；小孩鬼的邏輯在 src/world/tag.ts（純邏輯，Node 可以跑）。
// 注意：這個檔案會被 Node 測試載入，不能 import store／audio（寫入 store 走 schoolStore，由畫面那邊掛上來）。
//
//          z 負（北，校門這一側；村子在更北邊）
//   ┌──────── 圍牆 ─────── 校門 ─────── 圍牆 ────────┐
//   │ 教室 教室 教室 [教室]    銅像台座     司令台  升旗台 │
//   │ ════ 走廊（柱子）═══ 鐘  飲水台                    │
//   │  跳房子（水泥地）                                  │
//   │ 鳳凰木          操  場（跑道）                     │
//   │  單槓  溜滑梯  蹺蹺板                              │
//   └──────────────────────────────────────────┘
//          z 正（南，鏡頭這一側）

export const SCHOOL = {
  /** 校門（北邊圍牆的開口） */
  gate: { x: 0, z: -13.3, w: 3.4 },
  /** 圍牆的線（四邊） */
  wall: { x0: -19.6, x1: 19.6, z0: -13.3, z1: 11.6 },
  /** 一排四間教室（西北），最東邊那間可以進去 */
  block: { x0: -18.5, x1: -3.5, z0: -12.3, z1: -8.2, floorY: 0.3, wallTop: 3.2 },
  /** 教室之間的隔間牆（x） */
  splits: [-14.75, -11, -7.25],
  /** 可以進去的教室的門（南牆，走廊這一側） */
  door: { c: -4.02, w: 1.0 },
  /** 走廊：台基到 z1，柱子在 colZ */
  corridor: { z1: -6.6, colZ: -6.78, colXs: [-18.3, -14.75, -11, -7.25, -3.7] },
  /** 司令台（東北）：台面高 h，階梯在南邊中間 */
  stage: { x0: 6.4, x1: 11.6, z0: -12.2, z1: -9.5, h: 0.9 },
  /** 升旗台＋旗桿 */
  flag: { x: 14.2, z: -10.6 },
  /** 蔣公銅像的台座（只剩台座） */
  statue: { x: 2.4, z: -9.4 },
  /** 鳳凰木 */
  tree: { x: -15.4, z: 3.4 },
  /** 操場（沙地）與跑道（橢圓） */
  field: { x0: -9.5, x1: 17.5, z0: -5.8, z1: 9.4 },
  track: { cx: 4, cz: 1.8, rx: 10.2, rz: 5.6 },
  /** 遊樂器材（南邊，鏡頭這一側都是矮的） */
  bars: { x: -15.2, z: 8.6 },
  slide: { x: -11.2, z: 8.4 },
  seesaw: { x: -6.6, z: 9.3 },
  /** 走廊東邊：掛著的鐘、飲水台 */
  bell: { x: -2.9, z: -7.2 },
  trough: { x: -1.2, z: -6.4 },
  /** 走廊前的水泥地上畫的跳房子 */
  hopscotch: { x: -13.4, z: -4.6 },
  /** 教室裡：黑板（北牆）、風琴（西北角）、講桌、阿嬤以前的座位 */
  blackboard: { x: -5.5, z: -12.1 },
  organ: { x: -6.75, z: -11.55 },
  teacherDesk: { x: -5.6, z: -11.25 },
  /** 桌子三排兩列（x、z） */
  deskXs: [-6.4, -5.15],
  deskZs: [-10.25, -9.45, -8.7],
  /** 阿嬤以前的座位（桌面刻了一個「春」） */
  myDesk: { x: -6.4, z: -9.45 },
}

const S = SCHOOL
const B = S.block

/** 教室的台基＋走廊（地板高度 floorY） */
const PLATFORM = rect(B.x0 - 0.25, B.z0 - 0.25, B.x1 + 0.25, S.corridor.z1)
/** 可以進去的那間教室 */
export const CLASSROOM = rect(S.splits[2], B.z0, B.x1, B.z1)

function schoolColliders() {
  const rects: Rect[] = [
    // 前三間教室是鎖著的：整塊擋住
    rect(B.x0, B.z0, S.splits[2], B.z1),
    // 可以進去的教室：北牆、東牆、西牆（跟隔壁共用）、南牆留門
    ...wallRects('x', S.splits[2], B.x1, B.z0, 0.25),
    ...wallRects('z', B.z0, B.z1, B.x1, 0.25),
    ...wallRects('x', S.splits[2], B.x1, B.z1, 0.25, [{ c: S.door.c, w: S.door.w }]),
    // 教室裡：講桌、風琴、六張桌子
    box(S.teacherDesk.x, S.teacherDesk.z, 1.1, 0.5),
    box(S.organ.x, S.organ.z, 0.5, 0.9),
    ...S.deskXs.flatMap((x) => S.deskZs.map((z) => box(x, z, 0.9, 0.42))),
    // 司令台（整塊，階梯另外畫）、升旗台、銅像台座
    rect(S.stage.x0, S.stage.z0, S.stage.x1, S.stage.z1),
    box(S.flag.x, S.flag.z, 1.4, 1.4),
    box(S.statue.x, S.statue.z, 1.3, 1.3),
    // 遊樂器材
    box(S.bars.x, S.bars.z, 2.4, 0.3),
    box(S.slide.x, S.slide.z, 0.9, 2.6),
    box(S.seesaw.x, S.seesaw.z, 2.8, 0.36),
    box(S.trough.x, S.trough.z, 1.7, 0.5),
    // 北邊圍牆（校門兩側）
    rect(S.wall.x0, S.wall.z0 - 0.4, S.gate.x - S.gate.w / 2, S.wall.z0 + 0.12),
    rect(S.gate.x + S.gate.w / 2, S.wall.z0 - 0.4, S.wall.x1, S.wall.z0 + 0.12),
  ]
  const circles: Circle[] = [
    ...S.corridor.colXs.map((x) => ({ x, z: S.corridor.colZ, r: 0.14 })),
    { x: S.tree.x, z: S.tree.z, r: 0.9 },
    { x: S.bell.x, z: S.bell.z, r: 0.12 },
    // 校門的兩根門柱
    { x: S.gate.x - S.gate.w / 2 - 0.25, z: S.wall.z0, r: 0.35 },
    { x: S.gate.x + S.gate.w / 2 + 0.25, z: S.wall.z0, r: 0.35 },
  ]
  return { rects, circles, bounds: rect(S.wall.x0 + 0.2, -14, S.wall.x1 - 0.2, S.wall.z1 - 0.2) }
}

const inside = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

export const SCHOOL_SCENE: SceneDef = {
  id: 'school',
  name: '廢棄國小',
  colliders: schoolColliders(),
  spawns: { gate: [0, -11.6] },
  exits: [{ area: rect(-S.gate.w / 2, -14, S.gate.w / 2, -13.45), to: 'village', spawn: 'south', label: '↑ 村子', sign: [2.4, -12.1] }],
  buildings: [
    {
      id: 'school_room',
      inside: CLASSROOM,
      min: [S.splits[2] - 0.2, 0, B.z0 - 0.3],
      max: [B.x1 + 0.3, B.wallTop + 1.6, B.z1 + 0.2],
    },
  ],
  rooms: [
    { id: 'classroom', name: '六年甲班', area: CLASSROOM },
    { id: 'field', name: '操場', area: rect(S.field.x0, S.field.z0, S.field.x1, S.field.z1) },
  ],
  floorAt: (x, z) => (inside(PLATFORM, x, z) ? B.floorY : 0.02),
  // 小孩鬼在跑的時候不擋阿嬤（她是要去抓他們的）；站著的時候也不擋，免得卡住
  npcs: (): Circle[] => [],
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

/** 畫面那邊（School.tsx）掛上來的 store 寫入：這個檔案不能直接 import store */
export const schoolStore: { set?: (fn: (s: GameState) => Partial<GameState>) => void } = {}

/** 只有聲音的事件（風琴、鐘）：畫面那邊看時間戳播放 */
export const schoolFx = { organAt: 0, bellAt: 0 }

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** 小孩鬼在不在（傍晚到深夜都在操場上玩；陰陽眼的開關之後由 kidsGate 決定） */
const kidsHere = (s: GameState) => s.phase !== 'dawn' && kidsGate.visible()

/** 第一次見到小孩鬼：先講一段 */
function meetFirst(s: GameState, then: () => void) {
  if (s.flags.school_kids_met) {
    then()
    return
  }
  schoolStore.set?.((x) => ({ flags: { ...x.flags, school_kids_met: true } }))
  s.startDialogue('school_kids_1', then)
}

export const SCHOOL_HOTSPOTS: Hotspot[] = [
  {
    id: 'school_tag',
    scene: 'school',
    x: 4,
    z: 1.8,
    r: 2.4,
    icon: { x: 4, z: 1.8 },
    iconY: 1.6,
    label: (s) => {
      if (!kidsHere(s) || schoolPlay.rt.kind) return null
      return s.flags.school_tag_today ? '鬼抓人（今天玩過了）' : '跟小孩鬼玩鬼抓人'
    },
    run: (s) => {
      if (s.flags.school_tag_today) {
        s.bark(pick(['school.kid1.again', 'school.kid2.again']))
        return
      }
      meetFirst(s, () => {
        schoolStore.set?.((x) => ({ flags: { ...x.flags, school_tag_today: true } }))
        startTag(schoolPlay.rt)
      })
    },
  },
  {
    id: 'school_hide',
    scene: 'school',
    x: S.tree.x + 1.6,
    z: S.tree.z + 0.8,
    r: 1.8,
    icon: { x: S.tree.x, z: S.tree.z },
    iconY: 2.4,
    label: (s) => {
      if (!kidsHere(s) || schoolPlay.rt.kind) return null
      return s.flags.school_hide_today ? '躲貓貓（今天玩過了）' : '跟小孩鬼玩躲貓貓'
    },
    run: (s) => {
      if (s.flags.school_hide_today) {
        s.bark('school.kid2.again')
        return
      }
      meetFirst(s, () => {
        schoolStore.set?.((x) => ({ flags: { ...x.flags, school_hide_today: true } }))
        startHide(schoolPlay.rt, Math.random)
      })
    },
  },
  {
    id: 'school_hopscotch',
    scene: 'school',
    x: S.hopscotch.x + 1.6,
    z: S.hopscotch.z + 0.2,
    r: 1.6,
    icon: { x: S.hopscotch.x, z: S.hopscotch.z },
    iconY: 1.0,
    label: (s) => {
      if (schoolPlay.rt.kind) return null
      if (s.flags.school_hop_today) return '跳房子（今天跳過了）'
      return kidsHere(s) ? '跟阿妹仔跳房子' : '地上畫的跳房子'
    },
    run: (s) => {
      if (s.flags.school_hop_today) {
        s.bark('school.hop.done')
        return
      }
      const play = () =>
        s.startMinigame('hopscotch', {}, (r) => {
          // 按 ESC 離開：不算玩過
          if (!r) return
          const res = r as HopscotchResult
          const merit = res.score >= 0.8 ? 2 : res.score >= 0.45 ? 1 : 0
          schoolStore.set?.((x) => ({
            flags: { ...x.flags, school_hop_today: true, ...(res.score >= 0.8 ? { school_hop_good: true } : {}) },
            meta: { ...x.meta, merit: x.meta.merit + merit },
          }))
          s.bark(res.score >= 0.8 ? 'school.hop.great' : res.score >= 0.45 ? 'school.hop.ok' : 'school.hop.bad')
        })
      if (kidsHere(s)) meetFirst(s, play)
      else play()
    },
  },
  {
    id: 'school_organ',
    scene: 'school',
    x: S.organ.x + 0.75,
    z: S.organ.z + 0.3,
    r: 1.0,
    icon: { x: S.organ.x, z: S.organ.z },
    iconY: 1.5,
    label: () => '老風琴',
    run: (s) => {
      schoolFx.organAt = performance.now()
      s.bark(pick(['school.organ.1', 'school.organ.2']))
    },
  },
  {
    id: 'school_blackboard',
    scene: 'school',
    x: S.blackboard.x,
    z: S.teacherDesk.z + 0.6,
    r: 1.1,
    icon: { x: S.blackboard.x, z: S.blackboard.z },
    iconY: 2.3,
    label: () => '黑板上的粉筆畫',
    run: (s) => s.bark(kidsHere(s) ? 'school.board.kids' : 'school.board'),
  },
  {
    id: 'school_bell',
    scene: 'school',
    x: S.bell.x + 0.3,
    z: S.bell.z + 0.7,
    r: 1.0,
    icon: { x: S.bell.x, z: S.bell.z },
    iconY: 2.5,
    label: () => '敲鐘',
    run: (s) => {
      schoolFx.bellAt = performance.now()
      s.bark(kidsHere(s) ? 'school.bell.kids' : 'school.bell')
    },
  },
  {
    id: 'school_stage',
    scene: 'school',
    x: (S.stage.x0 + S.stage.x1) / 2,
    z: S.stage.z1 + 0.9,
    r: 1.4,
    icon: { x: (S.stage.x0 + S.stage.x1) / 2, z: (S.stage.z0 + S.stage.z1) / 2 },
    iconY: 2.4,
    label: () => '司令台',
    run: (s) => s.bark('school.stage'),
  },
  {
    id: 'school_gate',
    scene: 'school',
    x: S.gate.x + 1.2,
    z: S.wall.z0 + 1.3,
    r: 1.0,
    icon: { x: S.gate.x, z: S.wall.z0 },
    iconY: 3.0,
    label: () => '校門的校名',
    run: (s) => s.bark('school.plaque'),
  },
  {
    id: 'school_statue',
    scene: 'school',
    x: S.statue.x,
    z: S.statue.z + 1.1,
    r: 1.0,
    icon: { x: S.statue.x, z: S.statue.z },
    iconY: 1.9,
    label: () => '空空的銅像台座',
    run: (s) => s.bark('school.statue'),
  },
  {
    id: 'school_trough',
    scene: 'school',
    x: S.trough.x,
    z: S.trough.z + 0.8,
    r: 1.0,
    icon: { x: S.trough.x, z: S.trough.z },
    iconY: 1.2,
    label: () => '飲水台',
    run: (s) => s.bark('school.trough'),
  },
]

/** 阿嬤的回憶碎片可以放的兩個地方（給 src/world/memories.ts） */
export const SCHOOL_MEMORY_SPOTS = {
  desk: { x: S.myDesk.x, z: S.myDesk.z, y: B.floorY + 0.85, what: '阿嬤以前的座位（桌面刻了一個「春」）' },
  stage: { x: (S.stage.x0 + S.stage.x1) / 2, z: S.stage.z1 + 0.4, y: 1.2, what: '司令台（小時候上台領獎）' },
}

// ---------------------------------------------------------------------------
// 小孩鬼：躲藏點、平常閒晃的點（src/world/tag.ts）
// ---------------------------------------------------------------------------

export const HIDE_SPOTS: HideSpot[] = [
  { x: S.deskXs[1] + 0.05, z: S.deskZs[0] + 0.02, name: '教室的桌子底下' },
  { x: S.tree.x - 1.05, z: S.tree.z - 0.55, name: '鳳凰木後面' },
  { x: S.slide.x, z: S.slide.z - 0.2, name: '溜滑梯下面' },
  { x: S.stage.x1 + 0.45, z: S.stage.z0 + 0.9, name: '司令台旁邊' },
  { x: S.trough.x + 1.15, z: S.trough.z - 0.1, name: '飲水台後面' },
  { x: S.flag.x + 1.0, z: S.flag.z - 0.6, name: '升旗台後面' },
  { x: S.statue.x + 0.95, z: S.statue.z - 0.6, name: '銅像台座後面' },
  { x: S.organ.x + 0.05, z: S.organ.z + 0.65, name: '風琴旁邊' },
]

/** 平常在操場上玩：溜滑梯、單槓、跳房子、鳳凰木下、跑道上 */
const PLAY_SPOTS: [number, number][] = [
  [S.slide.x + 0.9, S.slide.z - 1.6],
  [S.hopscotch.x + 0.4, S.hopscotch.z + 1.2],
  [S.bars.x + 0.3, S.bars.z - 0.8],
  [S.tree.x + 1.5, S.tree.z + 0.6],
  [2.5, 3.2],
  [8.5, -2.2],
  [-4.2, 5.6],
  [12.5, 5.5],
]

configurePlay(schoolPlay.rt, SCHOOL_SCENE.colliders, HIDE_SPOTS, PLAY_SPOTS)
