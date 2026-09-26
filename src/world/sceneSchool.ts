import { box, rect, wallRects, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import type { HopscotchResult } from '../ui/minigames/types'
import { callKids, configurePlay, kidsGate, schoolPlay, startHide, startTag, type HideSpot } from './tag'
import './schoolDialogues'

// 廢棄國小（DESIGN §26.1）：從村子南邊的小橋、田埂過來。阿嬤小時候讀的「後壁厝國民學校」。
// 一群小孩鬼：鬼抓人（3D 追逐）、跳房子（節奏小遊戲）、躲貓貓（找人）；教室裡有阿嬤的童年回憶。
// 規則在這裡；畫面在 src/scene/School.tsx；小孩鬼的邏輯在 src/world/tag.ts（純邏輯，Node 可以跑）。
// 注意：這個檔案會被 Node 測試載入，不能 import store／audio（寫入 store 走 schoolStore，由畫面那邊掛上來）。
//
//          z 負（北，校門這一側；村子在更北邊）
//   ┌──────── 圍牆 ─────── 校門 ─────── 圍牆 ────────┐
//   │ 圖書 保健 辦公 [教室]    銅像台座     司令台  升旗台 │
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
  /** 一排四間（西北）：西邊起圖書室、保健室、教師辦公室、六年甲班，都可以進去（DESIGN §30） */
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
  /** 圖書室：西牆高書架、北牆窗下矮書架、中間閱覽桌＋兩條板凳、東牆的借書卡片櫃；門在南牆靠東 */
  library: { door: -15.5, tallShelf: { x: -18.2, z0: -11.9, z1: -9.0 }, lowShelf: { x0: -18.0, x1: -15.1, z: -12.0 }, table: { x: -16.9, z: -10.3 }, catalog: { x: -15.1, z: -11.3 } },
  /** 保健室：西牆鐵床（白布簾）、東牆藥櫃和視力表、東北角身高體重計、南邊護士阿姨的桌子 */
  nurse: { door: -11.75, bed: { x0: -14.62, x1: -13.72, z0: -12.1, z1: -10.2 }, cabinet: { x: -11.3, z: -11.0 }, scale: { x: -11.45, z: -11.9 }, chart: { z: -9.7 }, tray: { x: -14.2, z: -9.75 }, desk: { x: -13.2, z: -8.8 }, ghost: { x: -12.3, z: -10.8 } },
  /** 教師辦公室：中間兩張對拼的辦公桌、東牆廣播台（擴大機＋麥克風）、西牆行事曆黑板、西北角矮鐵櫃、西南角油印機 */
  office: { door: -8.0, desks: { x: -9.9, z: -10.575 }, broadcast: { x: -7.62, z: -11.4 }, cabinet: { x: -10.6, z: -11.9 }, mimeo: { x: -10.55, z: -8.9 } },
}

const S = SCHOOL
const B = S.block
const L = S.library
const N = S.nurse
const F = S.office

/** 教室的台基＋走廊（地板高度 floorY） */
const PLATFORM = rect(B.x0 - 0.25, B.z0 - 0.25, B.x1 + 0.25, S.corridor.z1)
/** 六年甲班（最東邊） */
export const CLASSROOM = rect(S.splits[2], B.z0, B.x1, B.z1)
/** 另外三間（DESIGN §30） */
export const LIBRARY = rect(B.x0, B.z0, S.splits[0], B.z1)
export const NURSE_ROOM = rect(S.splits[0], B.z0, S.splits[1], B.z1)
export const OFFICE = rect(S.splits[1], B.z0, S.splits[2], B.z1)
/** 四間的門（南牆，走廊這一側） */
export const ROOM_DOORS = [S.library.door, S.nurse.door, S.office.door, S.door.c]

function schoolColliders() {
  const rects: Rect[] = [
    // 一排四間：外牆、三道隔間牆、南牆每間一扇門
    ...wallRects('x', B.x0, B.x1, B.z0, 0.25),
    ...wallRects('z', B.z0, B.z1, B.x0, 0.25),
    ...wallRects('z', B.z0, B.z1, B.x1, 0.25),
    ...S.splits.flatMap((x) => wallRects('z', B.z0, B.z1, x, 0.2)),
    ...wallRects('x', B.x0, B.x1, B.z1, 0.25, ROOM_DOORS.map((c) => ({ c, w: S.door.w }))),
    // 教室裡：講桌、風琴、六張桌子
    box(S.teacherDesk.x, S.teacherDesk.z, 1.1, 0.5),
    box(S.organ.x, S.organ.z, 0.5, 0.9),
    ...S.deskXs.flatMap((x) => S.deskZs.map((z) => box(x, z, 0.9, 0.42))),
    // 圖書室：高書架、矮書架、閱覽桌＋板凳、卡片櫃
    rect(B.x0, L.tallShelf.z0 - 0.05, L.tallShelf.x + 0.18, L.tallShelf.z1 + 0.05),
    rect(L.lowShelf.x0 - 0.05, B.z0, L.lowShelf.x1 + 0.05, L.lowShelf.z + 0.17),
    box(L.table.x, L.table.z, 1.5, 1.6),
    box(L.catalog.x, L.catalog.z, 0.46, 0.82),
    // 保健室：鐵床、藥櫃、身高體重計、紅藥水的小桌、護士阿姨的桌子
    rect(N.bed.x0 - 0.05, N.bed.z0 - 0.05, N.bed.x1 + 0.04, N.bed.z1 + 0.02),
    box(N.cabinet.x, N.cabinet.z, 0.4, 1.04),
    box(N.scale.x, N.scale.z, 0.5, 0.5),
    box(N.tray.x, N.tray.z, 0.45, 0.4),
    box(N.desk.x, N.desk.z, 1.0, 0.56),
    // 教師辦公室：對拼的辦公桌、廣播台、鐵櫃、油印機
    box(F.desks.x, F.desks.z, 1.15, 1.35),
    rect(F.broadcast.x - 0.28, F.broadcast.z - 0.62, S.splits[2], F.broadcast.z + 0.62),
    box(F.cabinet.x, F.cabinet.z, 0.56, 0.46),
    box(F.mimeo.x, F.mimeo.z, 0.6, 0.5),
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
    // 走進哪一間，那一間的南牆和屋頂就淡出、鏡頭拉近
    ...(
      [
        ['school_room', CLASSROOM],
        ['school_lib', LIBRARY],
        ['school_nurse', NURSE_ROOM],
        ['school_office', OFFICE],
      ] as const
    ).map(([id, r]) => ({
      id,
      inside: r,
      min: [r.x0 - 0.2, 0, B.z0 - 0.3] as [number, number, number],
      max: [r.x1 + 0.2, B.wallTop + 1.6, B.z1 + 0.2] as [number, number, number],
    })),
  ],
  rooms: [
    { id: 'classroom', name: '六年甲班', area: CLASSROOM },
    { id: 'library', name: '圖書室', area: LIBRARY },
    { id: 'nurse', name: '保健室', area: NURSE_ROOM },
    { id: 'office', name: '教師辦公室', area: OFFICE },
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

/** 只有聲音的事件（風琴、鐘、辦公室廣播的下課鐘）：畫面那邊看時間戳播放 */
export const schoolFx = { organAt: 0, bellAt: 0, chimeAt: 0 }

/** 保健室的護士阿姨：陰陽眼才看得到（天亮就走了） */
export const nurseHere = (s: { vision?: boolean; phase: string }) => !!s.vision && s.phase !== 'dawn'

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
  // ---------- 圖書室（DESIGN §30） ----------
  {
    id: 'school_card',
    scene: 'school',
    x: S.library.catalog.x - 0.75,
    z: S.library.catalog.z + 0.2,
    r: 1.0,
    icon: { x: S.library.catalog.x, z: S.library.catalog.z },
    iconY: B.floorY + 1.6,
    label: (s) => (s.flags.school_card_seen ? '借書卡片櫃' : '翻翻借書卡片櫃'),
    run: (s) => {
      if (s.flags.school_card_seen) s.bark('school2.card.again')
      else s.startDialogue('school_card')
    },
  },
  {
    id: 'school_read',
    scene: 'school',
    x: S.library.table.x + 1.05,
    z: S.library.table.z + 0.5,
    r: 1.1,
    icon: { x: S.library.table.x, z: S.library.table.z },
    iconY: B.floorY + 1.3,
    label: (s) => {
      if (schoolPlay.rt.kind) return null
      if (!kidsHere(s)) return '翻翻桌上的書'
      return s.flags.school_story_today ? '講故事（今天講過了）' : '唸故事給小孩鬼聽'
    },
    run: (s) => {
      if (!kidsHere(s)) {
        s.bark(pick(['school2.read.alone.1', 'school2.read.alone.2', 'school2.read.alone.3']))
        return
      }
      if (s.flags.school_story_today) {
        s.bark('school2.story.done')
        return
      }
      // 小孩鬼跑到圖書室門口來聽
      callKids(schoolPlay.rt, S.library.door, B.z1 + 1.0, 14)
      meetFirst(s, () =>
        s.startDialogue('school_story', () =>
          schoolStore.set?.((x) => ({ flags: { ...x.flags, school_story_today: true }, meta: { ...x.meta, merit: x.meta.merit + 1 } })),
        ),
      )
    },
  },
  // ---------- 保健室 ----------
  {
    id: 'school_nurse',
    scene: 'school',
    x: S.nurse.ghost.x + 0.2,
    z: S.nurse.ghost.z + 0.9,
    r: 1.2,
    icon: { x: S.nurse.ghost.x, z: S.nurse.ghost.z },
    iconY: B.floorY + 2.1,
    label: (s) => (nurseHere(s) ? '跟護士阿姨說話' : null),
    run: (s) => {
      if (!s.flags.school_nurse_met) s.startDialogue('school_nurse_first')
      else s.bark(pick(['school2.nurse.hi.1', 'school2.nurse.hi.2', 'school2.nurse.hi.3']))
    },
  },
  {
    id: 'school_redmed',
    scene: 'school',
    x: S.nurse.tray.x + 0.55,
    z: S.nurse.tray.z + 0.35,
    r: 0.95,
    icon: { x: S.nurse.tray.x, z: S.nurse.tray.z },
    iconY: B.floorY + 1.2,
    label: (s) => {
      if (schoolPlay.rt.kind) return null
      if (!kidsHere(s)) return '紅藥水'
      return s.flags.school_nurse_today ? '紅藥水（今天擦過了）' : '幫跌倒的阿弟仔擦紅藥水'
    },
    run: (s) => {
      if (!kidsHere(s)) {
        s.bark(s.flags.school_redmed_heard ? 'school2.redmed.alone' : 'school2.redmed.alone.2')
        schoolStore.set?.((x) => ({ flags: { ...x.flags, school_redmed_heard: true } }))
        return
      }
      if (s.flags.school_nurse_today) {
        s.bark('school2.redmed.done')
        return
      }
      callKids(schoolPlay.rt, S.nurse.door, B.z1 + 1.0, 12)
      meetFirst(s, () =>
        s.startDialogue('school_redmed', () =>
          schoolStore.set?.((x) => ({ flags: { ...x.flags, school_nurse_today: true }, meta: { ...x.meta, merit: x.meta.merit + 1 } })),
        ),
      )
    },
  },
  {
    id: 'school_scale',
    scene: 'school',
    x: S.nurse.scale.x - 0.45,
    z: S.nurse.scale.z + 0.8,
    r: 0.95,
    icon: { x: S.nurse.scale.x, z: S.nurse.scale.z },
    iconY: B.floorY + 2.2,
    label: () => '量身高、看視力表',
    run: (s) => s.bark(kidsHere(s) && Math.random() < 0.4 ? 'school2.scale.kids' : pick(['school2.scale.1', 'school2.scale.2', 'school2.chart'])),
  },
  // ---------- 教師辦公室 ----------
  {
    id: 'school_roll',
    scene: 'school',
    x: S.office.desks.x + 0.95,
    z: S.office.desks.z + 0.3,
    r: 1.0,
    icon: { x: S.office.desks.x, z: S.office.desks.z },
    iconY: B.floorY + 1.3,
    label: (s) => {
      if (schoolPlay.rt.kind) return null
      if (!s.flags.school_roll_seen) return '翻開點名簿'
      if (!kidsHere(s)) return '點名簿'
      return s.flags.school_roll_today ? '點名簿（今天點過了）' : '幫小孩鬼點名'
    },
    run: (s) => {
      if (!s.flags.school_roll_seen) {
        s.startDialogue('school_roll')
        return
      }
      if (!kidsHere(s)) {
        s.bark('school2.roll.again')
        return
      }
      if (s.flags.school_roll_today) {
        s.bark('school2.call.done')
        return
      }
      callKids(schoolPlay.rt, S.office.door, B.z1 + 1.0, 14)
      meetFirst(s, () =>
        s.startDialogue('school_call', () =>
          schoolStore.set?.((x) => ({ flags: { ...x.flags, school_roll_today: true }, meta: { ...x.meta, merit: x.meta.merit + 1 } })),
        ),
      )
    },
  },
  {
    id: 'school_broadcast',
    scene: 'school',
    x: S.office.broadcast.x - 0.8,
    z: S.office.broadcast.z + 0.2,
    r: 0.95,
    icon: { x: S.office.broadcast.x, z: S.office.broadcast.z },
    iconY: B.floorY + 1.55,
    label: () => (schoolPlay.rt.kind ? null : '廣播：放下課鐘'),
    run: (s) => {
      schoolFx.chimeAt = performance.now()
      if (kidsHere(s)) {
        // 下課鐘一響，小孩鬼全部跑到走廊上
        callKids(schoolPlay.rt, (S.office.door + S.door.c) / 2, S.corridor.z1 + 0.9, 13)
        window.setTimeout(() => s.bark(pick(['school2.chime.kids.1', 'school2.chime.kids.2'])), 5200)
      } else s.bark(s.phase === 'night' ? 'school2.chime.night' : 'school2.chime.gm')
    },
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
