import { rect, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import type { GameState } from '../store'
import { DIALOGUES, type Dialogue } from './dialogues'
import { TRAIN_MEMORIES } from './story'

// 鬼火車的車廂（DESIGN §32.4）：半夜 00:00 末班車停在後壁厝站，跟車掌說過話以後可以上車「坐一站」。
// 三節相連的車廂，黃黃的燈，窗外的甘蔗田一直往後跑；車上的鬼乘客都在等自己的那一站。
// 車掌看票：「阿春姐，妳的票還沒到喔」——票上的字是撿回來的回憶（預告「末班車」結局）。
// 坐一段時間（RIDE_HOURS）車就「到站」：最後一節的車門打開，下車就是阿春民宿前。人不在家的時候，家裡照樣在過夜。
// 規則在這裡；畫面在 src/scene/GhostTrain.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。
//
//          z 負（北，鏡頭對面）：窗戶一整排，窗外是往後跑的甘蔗田
//   ┌── 第一節 ──┐┌── 第二節 ──┐┌── 第三節 ──┐
//   │ 長椅 乘客…  ││  長椅 乘客…  ││  長椅 乘客… │
//   │ 車掌  走道   ⇆   走道        ⇆   走道   門 │→ 下車（到站以後）
//   └ 門 長椅 ───┘└── 長椅 ────┘└── 長椅 ───┘
//          z 正（南，鏡頭這一側）：牆只到腰（剖開來看）

export const GT = {
  /** 三節車廂的內部（x） */
  cars: [
    { x0: -13.6, x1: -4.9 },
    { x0: -4.3, x1: 4.3 },
    { x0: 4.9, x1: 13.6 },
  ],
  z0: -1.65,
  z1: 1.65,
  wall: 0.2,
  /** 北牆高、南牆只到腰（鏡頭這一側剖開） */
  wallH: 2.5,
  lowWall: 0.85,
  /** 長椅的深度 */
  bench: 0.5,
  benchY: 0.46,
  /** 車廂之間通道的半寬（沿著長椅邊走也過得去：長椅邊 ± 阿嬤的半徑） */
  gang: 1.15,
  /** 上車的門（第一節南側）、下車的門（第三節南側） */
  boardDoor: { x0: -13.4, x1: -12.0 },
  exitDoor: { x0: 12.0, x1: 13.4 },
  /** 窗戶（北牆）：每節幾扇、高度 */
  winY0: 1.0,
  winY1: 1.85,
}

/** 坐一站要多久（遊戲時間，小時）；深夜 37.5 秒一小時，看對話時時間是停的 */
export const RIDE_HOURS = 0.55

/** 這一趟：什麼時候上車、到站了沒（畫面每幀更新；Exit.when 讀這裡） */
export const GHOST_RIDE = { boardedAt: Number.NaN, arrived: false, announced: false, nudged: false }

/** 乘客（x、z 是坐的位置；站著的車掌 stand） */
export const GT_PASSENGERS = {
  conductor: { x: -10.9, z: -0.25 },
  student: { x: -8.7, z: -1.4 },
  farmer: { x: -6.4, z: -1.4 },
  mother: { x: -2.1, z: -1.4 },
  lady: { x: 0.9, z: 1.4 },
  teacher: { x: 2.5, z: -1.4 },
  groom: { x: 6.85, z: -1.4 },
  bride: { x: 7.6, z: -1.4 },
  soldier: { x: 10.7, z: -1.4 },
}
const P = GT_PASSENGERS

// ---------------------------------------------------------------------------
// 碰撞
// ---------------------------------------------------------------------------

function trainColliders() {
  const W = GT.wall
  const [c1, c2, c3] = GT.cars
  const rects: Rect[] = [
    // 外牆：北、南、兩頭
    rect(c1.x0 - W, GT.z0 - W, c3.x1 + W, GT.z0),
    rect(c1.x0 - W, GT.z1, c3.x1 + W, GT.z1 + W),
    rect(c1.x0 - W, GT.z0 - W, c1.x0, GT.z1 + W),
    rect(c3.x1, GT.z0 - W, c3.x1 + W, GT.z1 + W),
    // 車廂之間：通道兩邊的牆
    ...[c1.x1, c2.x1].flatMap((x) => [rect(x, GT.z0, x + 0.6, -GT.gang), rect(x, GT.gang, x + 0.6, GT.z1)]),
    // 北邊的長椅（每節一整排）
    ...GT.cars.map((c) => rect(c.x0 + 0.25, GT.z0, c.x1 - 0.25, GT.z0 + GT.bench)),
    // 南邊的長椅（上下車的門口空出來）
    rect(GT.boardDoor.x1, GT.z1 - GT.bench, c1.x1 - 0.25, GT.z1),
    rect(c2.x0 + 0.25, GT.z1 - GT.bench, c2.x1 - 0.25, GT.z1),
    rect(c3.x0 + 0.25, GT.z1 - GT.bench, GT.exitDoor.x0, GT.z1),
  ]
  return { rects, circles: [{ x: P.conductor.x, z: P.conductor.z, r: 0.3 }], bounds: rect(c1.x0 + 0.05, GT.z0 + 0.05, c3.x1 - 0.05, GT.z1 - 0.05) }
}

export const GHOSTTRAIN_SCENE: SceneDef = {
  id: 'ghosttrain',
  name: '鬼火車',
  colliders: trainColliders(),
  spawns: { board: [-12.7, 0.75] },
  exits: [
    {
      area: rect(GT.exitDoor.x0 + 0.1, 0.95, GT.exitDoor.x1, GT.z1),
      to: 'home',
      spawn: 'road_west',
      label: '下車（阿春民宿前）',
      sign: [12.7, 2.5],
      when: () => GHOST_RIDE.arrived,
    },
  ],
  // 整列車當成一棟：人在裡面鏡頭拉近
  buildings: [{ id: 'gt_car', inside: rect(GT.cars[0].x0, GT.z0, GT.cars[2].x1, GT.z1), min: [GT.cars[0].x0, GT.lowWall, GT.z1 - 0.1], max: [GT.cars[2].x1, GT.wallH, GT.z1 + 0.3] }],
  rooms: GT.cars.map((c, i) => ({ id: `gt_car${i + 1}`, name: `第${'一二三'[i]}節車廂`, area: rect(c.x0, GT.z0, c.x1, GT.z1) })),
  floorAt: () => 0.02,
}

// ---------------------------------------------------------------------------
// 對話
// ---------------------------------------------------------------------------

/** 票上的字：撿回來的回憶越多，票越接近寫好（TRAIN_MEMORIES 片就是「末班車」結局） */
export function ticketTier(memories: number): 'e' | 'm' | 'n' {
  if (memories >= TRAIN_MEMORIES - 2) return 'n'
  return memories >= 4 ? 'm' : 'e'
}

const ticket = (tier: 'e' | 'm' | 'n'): Dialogue => ({
  steps: [
    { line: 'st2.ticket.1' },
    { line: 'st2.ticket.2' },
    { line: `st2.ticket.${tier}` },
    {
      line: 'st2.ticket.3',
      choices: [
        { line: 'st2.ticket.a', goto: 'a' },
        { line: 'st2.ticket.b', goto: 'b' },
      ],
    },
    { label: 'a', line: 'st2.ticket.a' },
    { line: 'st2.ticket.a2', goto: 'end' },
    { label: 'b', line: 'st2.ticket.b' },
    { line: 'st2.ticket.b2' },
    { line: 'st2.ticket.b3' },
    { label: 'end', line: 'st2.ticket.end', set: 'gt_ticket_seen' },
  ],
})

/** 一段有選項的小故事：開頭幾句、一個選項（a／b 各自接幾句）、結尾 */
function story(key: string, intro: number, a: string[], b: string[], flag: string): Dialogue {
  const p = `st2.${key}`
  const steps = Array.from({ length: intro }, (_, i) => ({ line: `${p}.${i + 1}` }))
  const last = steps.pop()!
  return {
    steps: [
      ...steps,
      {
        line: last.line,
        choices: [
          { line: `${p}.a`, goto: 'a' },
          { line: `${p}.b`, goto: 'b' },
        ],
      },
      { label: 'a', line: `${p}.a` },
      ...a.map((l, i) => (i === a.length - 1 ? { line: `${p}.${l}`, goto: 'end' } : { line: `${p}.${l}` })),
      { label: 'b', line: `${p}.b` },
      ...b.map((l) => ({ line: `${p}.${l}` })),
      { label: 'end', line: `${p}.end`, set: flag },
    ],
  }
}

const GT_DIALOGUES: Record<string, Dialogue> = {
  st2_ticket_e: ticket('e'),
  st2_ticket_m: ticket('m'),
  st2_ticket_n: ticket('n'),
  st2_ticket_status_e: { steps: [{ line: 'st2.ticket.ask' }, { line: 'st2.ticket.e' }] },
  st2_ticket_status_m: { steps: [{ line: 'st2.ticket.ask' }, { line: 'st2.ticket.m' }] },
  st2_ticket_status_n: { steps: [{ line: 'st2.ticket.ask' }, { line: 'st2.ticket.n' }] },
  st2_soldier: story('soldier', 4, ['a2'], ['b2'], 'gt_story_soldier'),
  st2_mother: story('mother', 4, ['a2'], ['b2'], 'gt_story_mother'),
  st2_teacher: story('teacher', 4, ['a2'], ['b2', 'b3'], 'gt_story_teacher'),
  st2_couple: story('couple', 4, ['a2'], ['b2', 'b3'], 'gt_story_couple'),
}
Object.assign(DIALOGUES, GT_DIALOGUES)

/** 四段故事都聽過了（車掌到站時會多說一句） */
export const GT_STORIES = ['gt_story_soldier', 'gt_story_mother', 'gt_story_teacher', 'gt_story_couple']

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

const withStore = (fn: (st: typeof import('../store').useStore) => void) => {
  void import('../store').then((m) => fn(m.useStore))
}

/** 聽完一段故事：第一次功德 +1 */
function storyHotspot(id: string, who: { x: number; z: number }, name: string, dialogue: string, flag: string, again: string): Hotspot {
  return {
    id: `gt_${id}`,
    scene: 'ghosttrain',
    x: who.x,
    z: -0.5,
    r: 0.85,
    icon: { x: who.x, z: who.z },
    iconY: 1.75,
    label: () => `跟${name}說話`,
    run: (s: GameState) => {
      if (s.flags[flag]) {
        s.bark(again)
        return
      }
      s.startDialogue(dialogue, () =>
        withStore((st) => {
          const x = st.getState()
          if (x.flags[flag]) st.setState({ meta: { ...x.meta, merit: x.meta.merit + 1 } })
        }),
      )
    },
  }
}

/** 月台上見過的鬼乘客，也在車上（字幕，不配音） */
const EXTRAS: { id: string; at: { x: number; z: number }; name: string; lines: string[] }[] = [
  { id: 'student', at: P.student, name: '打瞌睡的學生', lines: ['穿制服的學生：（打呼）……嘉義到了嗎……再五分鐘……', '穿制服的學生：（翻了個身，繼續睡）'] },
  { id: 'farmer', at: P.farmer, name: '戴斗笠的阿伯', lines: ['戴斗笠的阿伯：阿姐，要吃甘蔗否？剛削好的，很甜喔。', '戴斗笠的阿伯：金項鍊我買好了，放在口袋裡。阮某一定很歡喜。'] },
  { id: 'lady', at: P.lady, name: '提皮箱的小姐', lines: ['提皮箱的小姐：台北車站到了要叫我喔。他說會拿一束花等我。', '提皮箱的小姐：阿姐，妳看我的頭髮有沒有亂？'] },
]

export const GHOSTTRAIN_HOTSPOTS: Hotspot[] = [
  {
    id: 'gt_conductor',
    scene: 'ghosttrain',
    x: P.conductor.x + 0.9,
    z: P.conductor.z + 0.3,
    r: 1.0,
    icon: { x: P.conductor.x, z: P.conductor.z },
    iconY: 2.2,
    label: (s) => (s.flags.gt_ticket_seen ? '問車掌：我的票呢？' : '給車掌看票'),
    run: (s) => {
      const tier = ticketTier(s.meta.memories.length)
      s.startDialogue(s.flags.gt_ticket_seen ? `st2_ticket_status_${tier}` : `st2_ticket_${tier}`)
    },
  },
  storyHotspot('soldier', P.soldier, '回家的阿兵哥', 'st2_soldier', 'gt_story_soldier', 'st2.soldier.again'),
  storyHotspot('mother', P.mother, '抱著背巾的媽媽', 'st2_mother', 'gt_story_mother', 'st2.mother.again'),
  storyHotspot('teacher', P.teacher, '改考卷的老師', 'st2_teacher', 'gt_story_teacher', 'st2.teacher.again'),
  storyHotspot('couple', { x: (P.groom.x + P.bride.x) / 2, z: P.groom.z }, '度蜜月的夫妻', 'st2_couple', 'gt_story_couple', 'st2.couple.again'),
  ...EXTRAS.map(
    (e): Hotspot => ({
      id: `gt_extra_${e.id}`,
      scene: 'ghosttrain',
      x: e.at.x,
      z: e.at.z > 0 ? 0.5 : -0.5,
      r: 0.8,
      icon: { x: e.at.x, z: e.at.z },
      iconY: 1.7,
      label: () => `跟${e.name}說話`,
      run: (s) => {
        const k = `gt_extra_${e.id}_heard`
        s.say(s.flags[k] ? e.lines[1] : e.lines[0])
        if (!s.flags[k])
          withStore((st) => {
            const x = st.getState()
            st.setState({ flags: { ...x.flags, [k]: true } })
          })
      },
    }),
  ),
  {
    id: 'gt_window',
    scene: 'ghosttrain',
    x: 0.0,
    z: -0.55,
    r: 0.7,
    icon: { x: 0.0, z: GT.z0 },
    iconY: 1.7,
    label: () => '看窗外',
    run: (s) => {
      s.bark(s.flags.gt_window_seen ? 'st2.gt.window.moon' : 'st2.gt.window')
      if (!s.flags.gt_window_seen)
        withStore((st) => {
          const x = st.getState()
          st.setState({ flags: { ...x.flags, gt_window_seen: true } })
        })
    },
  },
]
