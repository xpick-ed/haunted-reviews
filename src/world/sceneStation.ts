import { box, rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import type { GameState } from '../store'
import type { GuestId } from './night/types'
import { GUESTS, NEED_INFO } from './night/guests'

// 小火車站＋五分車（DESIGN §27.1）：從阿春民宿門前的路一直往西走到底。
// 無人小站「後壁厝站」：日治時代的木造站房、月台、一條主線、西邊側線停著糖廠的五分車。
// 傍晚今晚的客人在月台下車（先觀察他們）；半夜 12 點有一班載鬼的末班車進站；五分車可以搭（小遊戲）。
// 規則在這裡；畫面在 src/scene/Station.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。
//
//          z 負（北，鏡頭對面）
//   甘蔗田 ── 五分車（側線）── 站房「後壁厝」── 水塔 ── 甘蔗田
//   ═════════════ 站前的泥土路（東西向，出口在兩端）═════════════
//   ▭▭▭▭▭▭▭▭▭▭ 月台（高一階，中間有雨棚）▭▭▭▭▭▭▭▭▭▭
//   ━━━━━━━━━━━━━━━━━ 主線（鬼火車停這裡）━━━━━━━━━━━━━━━━━
//          z 正（南，鏡頭這一側：只有碎石與矮草）

export const STATION = {
  /** 站前的泥土路（東西向） */
  roadZ: -3.2,
  roadWidth: 2.6,
  /** 站房（北邊）：木造、斜屋頂，正面朝南（z1），中間是大門 */
  house: { x0: -5, x1: 5, z0: -8.2, z1: -4.4, wallTop: 3.1 },
  /** 月台：高一階 */
  platform: { x0: -13, x1: 13, z0: -1.9, z1: 1.55, y: 0.5 },
  /** 月台中段的雨棚（柱子在後緣） */
  canopy: { x0: -6.2, x1: 6.2, postZ: -1.55, postXs: [-5.2, -1.7, 1.7, 5.2], y: 3.0 },
  /** 主線的中心（鬼火車停這裡） */
  trackZ: 2.95,
  gauge: 1.067,
  /** 西邊的側線：糖廠的五分車（火車頭朝東） */
  siding: { z: -6.9, x0: -21, x1: -6.5 },
  cane: { locoX: -8.9, wagons: [-11.4, -13.9, -16.4, -18.9] },
  /** 水塔（東北） */
  tower: { x: 11.2, z: -7.4 },
  /** 月台上的燈、長椅、站名牌、時刻表 */
  lampXs: [-11, -7.4, 7.4, 11],
  lampZ: -1.55,
  benches: [-3.2, 3.2],
  benchZ: -1.05,
  nameBoard: { x: -9.2, z: -1.7 },
  timetable: { x: 9.3, z: -1.7 },
  /** 號誌燈（主線兩頭，鏡頭這一側） */
  signals: [
    [-17.5, 4.1],
    [17.5, 4.1],
  ] as [number, number][],
  /** 傍晚下車的客人站的位置（月台上，最多 4 位） */
  arrivals: [-4.6, -1.6, 1.6, 4.6],
  arrivalZ: 0.35,
  /** 鬼火車停靠時：車掌、鬼乘客站的位置 */
  conductor: { x: 0.9, z: 1.05 },
  ghosts: [
    { x: -8.2, z: 0.5 },
    { x: -3.4, z: 0.95 },
    { x: 4.6, z: 0.6 },
    { x: 9.4, z: 0.9 },
  ],
}

const S = STATION

// ---------------------------------------------------------------------------
// 末班鬼火車：半夜 00:00 進站、停一下、00:48 前開走
// ---------------------------------------------------------------------------

export const GHOST_TRAIN = { arrive: 24.0, stop: 24.12, leave: 24.68, gone: 24.8 }

/** 鬼火車現在在哪裡（x 是整列車中心）、是不是停著、有多顯形（0..1）；不在就回傳 null */
export function ghostTrain(time: number, phase: string): { x: number; stopped: boolean; fade: number } | null {
  const T = GHOST_TRAIN
  if (phase !== 'night' || time < T.arrive || time > T.gone) return null
  if (time < T.stop) {
    const k = (time - T.arrive) / (T.stop - T.arrive)
    return { x: -52 * (1 - k) * (1 - k), stopped: false, fade: Math.min(1, k * 2.5) }
  }
  if (time < T.leave) return { x: 0, stopped: true, fade: 1 }
  const k = (time - T.leave) / (T.gone - T.leave)
  return { x: 52 * k * k, stopped: false, fade: Math.min(1, (1 - k) * 2.5) }
}

// ---------------------------------------------------------------------------
// 碰撞、地板
// ---------------------------------------------------------------------------

function stationColliders() {
  const rects: Rect[] = [
    // 站房（大門那一段另外開，讓阿嬤可以進候車室）
    rect(S.house.x0, S.house.z0, S.house.x1, S.house.z0 + 0.3),
    rect(S.house.x0, S.house.z0, S.house.x0 + 0.3, S.house.z1),
    rect(S.house.x1 - 0.3, S.house.z0, S.house.x1, S.house.z1),
    rect(S.house.x0, S.house.z1 - 0.3, -0.95, S.house.z1),
    rect(0.95, S.house.z1 - 0.3, S.house.x1, S.house.z1),
    // 候車室裡的長椅、售票口的櫃台
    box(-2.6, -7.4, 2.4, 0.5),
    box(2.6, -7.4, 2.4, 0.5),
    box(-4.1, -5.6, 0.8, 1.6),
    // 五分車（火車頭＋四節甘蔗車）
    rect(S.cane.wagons[3] - 1.3, S.siding.z - 0.7, S.cane.locoX + 1.4, S.siding.z + 0.7),
    // 月台上的長椅
    ...S.benches.map((x) => box(x, S.benchZ, 1.6, 0.45)),
    // 站名牌、時刻表
    box(S.nameBoard.x, S.nameBoard.z, 1.8, 0.25),
    box(S.timetable.x, S.timetable.z, 1.4, 0.25),
  ]
  const circles: Circle[] = [
    ...S.canopy.postXs.map((x) => ({ x, z: S.canopy.postZ, r: 0.14 })),
    ...S.lampXs.map((x) => ({ x, z: S.lampZ, r: 0.12 })),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: S.tower.x + sx * 0.85, z: S.tower.z + sz * 0.85, r: 0.18 }))),
    ...S.signals.map(([x, z]) => ({ x, z, r: 0.15 })),
  ]
  // 北邊是甘蔗田（走不進去），南邊到主線外的碎石為止
  return { rects, circles, bounds: rect(-22, -9.6, 22, 4.7) }
}

const inPlatform = (x: number, z: number) => x >= S.platform.x0 && x <= S.platform.x1 && z >= S.platform.z0 && z <= S.platform.z1
const inHouse = (x: number, z: number) => x > S.house.x0 && x < S.house.x1 && z > S.house.z0 && z < S.house.z1

export const STATION_SCENE: SceneDef = {
  id: 'station',
  name: '後壁厝站',
  colliders: stationColliders(),
  spawns: { east: [19.2, S.roadZ], oldstreet: [-19.2, S.roadZ] },
  exits: [
    { area: rect(20.8, S.roadZ - 2.2, 22, S.roadZ + 2.2), to: 'home', spawn: 'road_west', label: '阿春民宿 →', sign: [19.4, S.roadZ - 1.9] },
    { area: rect(-22, S.roadZ - 2.2, -20.8, S.roadZ + 2.2), to: 'oldstreet', spawn: 'station', label: '← 老街', sign: [-19.4, S.roadZ - 1.9] },
  ],
  buildings: [
    {
      id: 'station_house',
      inside: rect(S.house.x0 + 0.3, S.house.z0 + 0.3, S.house.x1 - 0.3, S.house.z1 - 0.1),
      min: [S.house.x0 - 0.5, 0, S.house.z0 - 0.5],
      max: [S.house.x1 + 0.5, 5.2, S.house.z1 + 0.9],
    },
    // 雨棚：阿嬤站在月台上時擋住鏡頭就淡掉
    { id: 'station_canopy', inside: rect(1e3, 1e3, 1e3 + 0.1, 1e3 + 0.1), min: [S.canopy.x0, 2.6, S.canopy.postZ - 0.4], max: [S.canopy.x1, 3.4, S.platform.z1 + 0.4] },
  ],
  rooms: [{ id: 'station_hall', name: '候車室', area: rect(S.house.x0 + 0.3, S.house.z0 + 0.3, S.house.x1 - 0.3, S.house.z1 - 0.1) }],
  floorAt: (x, z) => (inPlatform(x, z) ? S.platform.y : inHouse(x, z) ? 0.18 : 0.02),
  npcs: (): Circle[] => [],
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

// 規則檔不能直接 import store（store → hotspots → scenes → 這裡，會循環），要改狀態時再動態載入
const withStore = (fn: (st: typeof import('../store').useStore) => void) => {
  void import('../store').then((m) => fn(m.useStore))
}
const setFlag = (flag: string) =>
  withStore((st) => {
    const s = st.getState()
    st.setState({ flags: { ...s.flags, [flag]: true } })
  })
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** 今晚的客人（依入住卡片的順序） */
export function arrivingGuests(s: Pick<GameState, 'plan'>): GuestId[] {
  return s.plan.parties.flatMap((p) => p.members).slice(0, S.arrivals.length)
}

/** 這位客人最可能會需要的兩件事（依機率） */
export function likelyNeeds(id: GuestId): string[] {
  return [...GUESTS[id].needs]
    .filter((n) => n.chance >= 0.35)
    .sort((a, b) => b.chance - a.chance)
    .slice(0, 2)
    .map((n) => NEED_INFO[n.kind].label)
}

/** 鬼乘客：各一句自己的故事（字幕，不配音） */
export const GHOST_PASSENGERS: { id: string; name: string; lines: string[] }[] = [
  {
    id: 'ghost_student',
    name: '穿制服的學生',
    lines: ['穿制服的學生：我每天都搭這班車去嘉義讀書……今天好像坐過站了，坐了五十年。', '穿制服的學生：阿嬤，妳也是要去考試的嗎？'],
  },
  {
    id: 'ghost_farmer',
    name: '戴斗笠的阿伯',
    lines: ['戴斗笠的阿伯：甘蔗收完了，我要去糖廠領錢，順便給阮某買一條金項鍊。', '戴斗笠的阿伯：糖廠關了？免黑白講，煙囪還在冒煙啊。'],
  },
  {
    id: 'ghost_bride',
    name: '提皮箱的小姐',
    lines: ['提皮箱的小姐：他說在台北車站等我。我坐的是末班車，他應該還在等吧。', '提皮箱的小姐：這件洋裝是我自己做的，好看嗎？'],
  },
  {
    id: 'ghost_soldier',
    name: '背包包的阿兵哥',
    lines: ['背包包的阿兵哥：放假了！回家吃阿母煮的菜。', '背包包的阿兵哥：退伍那天我就坐這班車回來……咦，怎麼每天都是那天？'],
  },
]

const ghostStopped = (s: GameState) => !!ghostTrain(s.time, s.phase)?.stopped

export const STATION_HOTSPOTS: Hotspot[] = [
  // ---------- 傍晚：今晚的客人剛下車 ----------
  ...S.arrivals.map(
    (x, i): Hotspot => ({
      id: `station_guest_${i}`,
      scene: 'station',
      x,
      z: S.arrivalZ - 1.0,
      r: 1.15,
      icon: { x, z: S.arrivalZ },
      iconY: 2.1,
      label: (s) => {
        if (s.phase !== 'dusk') return null
        const id = arrivingGuests(s)[i]
        if (!id) return null
        return s.flags[`observed_${id}_today`] ? `${GUESTS[id].name}（看過了）` : `觀察${GUESTS[id].name}`
      },
      run: (s) => {
        const id = arrivingGuests(s)[i]
        if (!id) return
        const g = GUESTS[id]
        const needs = likelyNeeds(id)
        s.say(`${g.name}（${g.label}）：${g.clues.join('、')}。${needs.length ? `看起來晚上可能會：${needs.join('、')}。` : ''}`)
        if (!s.flags[`observed_${id}_today`]) {
          setFlag(`observed_${id}_today`)
          window.setTimeout(() => s.bark(pick(['station.observe.1', 'station.observe.2', 'station.observe.3'])), 3800)
        }
      },
    }),
  ),

  // ---------- 半夜：末班鬼火車 ----------
  {
    id: 'station_conductor',
    scene: 'station',
    x: S.conductor.x - 0.2,
    z: S.conductor.z - 1.0,
    r: 1.3,
    icon: { x: S.conductor.x, z: S.conductor.z },
    iconY: 2.3,
    label: (s) => (ghostStopped(s) ? '跟鬼車掌說話' : null),
    run: (s) => {
      if (!s.flags.conductor_met) s.startDialogue('conductor_1')
      else s.bark(pick(['conductor.again.1', 'conductor.again.2', 'conductor.again.3', 'conductor.again.4']))
    },
  },
  ...S.ghosts.map(
    (gp, i): Hotspot => ({
      id: `station_ghost_${i}`,
      scene: 'station',
      x: gp.x,
      z: gp.z - 0.9,
      r: 1.1,
      icon: { x: gp.x, z: gp.z },
      iconY: 2.1,
      label: (s) => (ghostStopped(s) ? `跟${GHOST_PASSENGERS[i].name}說話` : null),
      run: (s) => {
        const p = GHOST_PASSENGERS[i]
        const k = `station_ghost_${i}_heard`
        s.say(s.flags[k] ? p.lines[1] : p.lines[0])
        if (!s.flags[k]) setFlag(k)
      },
    }),
  ),

  // ---------- 五分車 ----------
  {
    id: 'station_canetrain',
    scene: 'station',
    x: S.cane.locoX + 0.2,
    z: S.siding.z + 1.5,
    r: 1.5,
    icon: { x: S.cane.locoX, z: S.siding.z },
    iconY: 2.8,
    label: (s) => {
      if (s.phase === 'dawn') return null
      return s.flags.station_train_today ? '五分車（今天搭過了）' : '搭五分車（穿過甘蔗田）'
    },
    run: (s) => {
      if (s.flags.station_train_today) {
        s.bark(pick(['station.train.done.1', 'station.train.done.2']))
        return
      }
      setFlag('station_train_today')
      s.bark('station.train.go')
      s.startMinigame('train', {}, (r) => {
        const merit = (r as { merit?: number } | null)?.merit ?? 0
        withStore((st) => {
          const x = st.getState()
          if (merit > 0) st.setState({ meta: { ...x.meta, merit: x.meta.merit + merit } })
          x.bark(merit >= 2 ? 'station.train.win' : merit === 1 ? 'station.train.ok' : 'station.train.lose')
        })
      })
    },
  },

  // ---------- 看看 ----------
  {
    id: 'station_clock',
    scene: 'station',
    x: 0,
    z: S.house.z1 + 1.3,
    r: 1.2,
    icon: { x: 0, z: S.house.z1 + 0.1 },
    iconY: 3.4,
    label: () => '看站房的大鐘',
    run: (s) => s.bark(s.phase === 'night' && s.time >= 23.5 && s.time < 24.9 ? 'station.clock.night' : 'station.clock'),
  },
  {
    id: 'station_ticket',
    scene: 'station',
    x: -3.4,
    z: S.house.z1 + 1.1,
    r: 1.0,
    icon: { x: -3.4, z: S.house.z1 + 0.05 },
    iconY: 1.9,
    label: () => '售票口',
    run: (s) => s.bark(pick(['station.ticket.1', 'station.ticket.2'])),
  },
  {
    id: 'station_timetable',
    scene: 'station',
    x: S.timetable.x,
    z: S.timetable.z + 1.0,
    r: 1.1,
    icon: { x: S.timetable.x, z: S.timetable.z },
    iconY: 2.4,
    label: () => '看時刻表',
    run: (s) => s.bark(s.flags.conductor_met ? 'station.timetable.2' : 'station.timetable.1'),
  },
  {
    id: 'station_name',
    scene: 'station',
    x: S.nameBoard.x,
    z: S.nameBoard.z + 1.0,
    r: 1.1,
    icon: { x: S.nameBoard.x, z: S.nameBoard.z },
    iconY: 2.4,
    label: () => '站名牌',
    run: (s) => s.bark('station.name'),
  },
  {
    id: 'station_tower',
    scene: 'station',
    x: S.tower.x - 1.6,
    z: S.tower.z + 1.9,
    r: 1.3,
    icon: { x: S.tower.x, z: S.tower.z },
    iconY: 5.6,
    label: () => '老水塔',
    run: (s) => s.bark('station.tower'),
  },
]
