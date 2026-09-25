import { box, rect, type Circle } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import type { PrizeResult } from '../ui/minigames/types'

// 鬼夜市（DESIGN §25.1）：深夜 00:00–04:30 從土地公廟後面的小路進來。好兄弟擺攤：
// 紅姨賣法器（功德）、金魚伯撈金魚、射氣球。規則在這裡；畫面在 src/scene/Market.tsx。
//
//                      紅姨的法器攤
//          算命 ┐   │  主街  │   ┌ 彈珠台
//  布袋戲 ═══════ 橫街 ═══╪═══════ 橫街 ═══ 老樹
//        糖葫蘆 ┘   │        │   └ 青草茶
//              攤子（左右兩排）
//                    牌樓（入口，往南回土地公廟）

/** 夜市開的時間（遊戲小時，24 = 午夜） */
export const MARKET_OPEN = 24
export const MARKET_CLOSE = 28.5

export type StallKind =
  | 'snail' // 燒酒螺
  | 'paper' // 紙紮
  | 'sausage' // 香腸
  | 'money' // 冥紙
  | 'candy' // 棉花糖
  | 'fish' // 撈金魚（金魚伯）
  | 'balloon' // 射氣球
  | 'mask' // 面具、燈籠
  | 'fortune' // 算命
  | 'marble' // 彈珠台
  | 'sugar' // 糖葫蘆
  | 'drink' // 青草茶
  | 'relic' // 法器（紅姨）

export interface StallDef {
  kind: StallKind
  /** 招牌上的字 */
  sign: string
  x: number
  z: number
  /** 攤子正面朝向（弧度，0 = 朝 +z，跟角色 heading 一樣） */
  face: number
  /** 攤子寬度 */
  w: number
  /** 棚子的顏色組（0 紅白、1 青白、2 紫白） */
  tint: 0 | 1 | 2
}

const E = -Math.PI / 2 // 面向 -x（主街東側的攤子朝西）
const W = Math.PI / 2 // 面向 +x

export const MARKET = {
  /** 主街（南北向）半寬 */
  streetHalf: 2.2,
  /** 橫街（東西向）半寬 */
  crossHalf: 1.8,
  /** 入口牌樓 */
  gateZ: 8.6,
  stalls: [
    { kind: 'snail', sign: '燒酒螺', x: -3.5, z: 6.2, face: W, w: 2.3, tint: 0 },
    { kind: 'paper', sign: '紙紮', x: -3.5, z: 3.4, face: W, w: 2.3, tint: 2 },
    { kind: 'sausage', sign: '香腸', x: -3.5, z: -3.6, face: W, w: 2.3, tint: 0 },
    { kind: 'money', sign: '金紙', x: -3.5, z: -6.6, face: W, w: 2.3, tint: 1 },
    { kind: 'candy', sign: '棉花糖', x: 3.5, z: 6.2, face: E, w: 2.3, tint: 2 },
    { kind: 'fish', sign: '撈金魚', x: 3.5, z: 3.4, face: E, w: 2.5, tint: 1 },
    { kind: 'balloon', sign: '射氣球', x: 3.5, z: -3.6, face: E, w: 2.5, tint: 0 },
    { kind: 'mask', sign: '面具', x: 3.5, z: -6.6, face: E, w: 2.3, tint: 2 },
    { kind: 'fortune', sign: '算命', x: -7.4, z: -3.3, face: 0, w: 2.3, tint: 2 },
    { kind: 'marble', sign: '彈珠台', x: 7.4, z: -3.3, face: 0, w: 2.3, tint: 1 },
    { kind: 'sugar', sign: '糖葫蘆', x: -7.4, z: 3.3, face: Math.PI, w: 2.3, tint: 0 },
    { kind: 'drink', sign: '青草茶', x: 7.4, z: 3.3, face: Math.PI, w: 2.3, tint: 1 },
    { kind: 'relic', sign: '法器', x: 0, z: -9.0, face: 0, w: 3.4, tint: 0 },
  ] as StallDef[],
  /** 布袋戲台（橫街西端）、老樹（橫街東端） */
  stage: { x: -12.9, z: 0 },
  tree: { x: 13.6, z: -1.2 },
}

/** 攤位上站的老闆（金魚伯、紅姨有名字；其他是路過的好兄弟） */
export const MARKET_NPCS = {
  jinyubo: { x: 3.85, z: 3.4, heading: E },
  hongyi: { x: 0, z: -9.1, heading: 0 },
}

/** 鏡頭在東南方：主街東側的攤子會擋住走在街上的阿嬤，擋到時淡出（橫街南側的攤子只擋到街邊，不淡） */
export const FADE_STALLS: StallKind[] = ['candy', 'fish', 'balloon', 'mask']
const NOWHERE = rect(900, 900, 900.1, 900.1)

// 攤子都在街道外面：碰撞用四個角落的大方塊＋三個街尾，阿嬤只能走在街上
const S = MARKET.streetHalf + 0.4
const C = MARKET.crossHalf + 0.2

function marketColliders() {
  return {
    rects: [
      rect(-16, -10, -S, -C), // 西北
      rect(S, -10, 16, -C), // 東北
      rect(-16, C, -S, 10), // 西南
      rect(S, C, 16, 10), // 東南
      rect(-S, -10, S, -8.25), // 紅姨的攤子（主街北端）
      rect(-16, -C, -11.7, C), // 布袋戲台
      rect(12.2, -C, 16, C), // 老樹
      // 牌樓的兩根柱子
      box(-2.35, MARKET.gateZ, 0.4, 0.4),
      box(2.35, MARKET.gateZ, 0.4, 0.4),
    ],
    circles: [] as Circle[],
    bounds: rect(-16, -10, 16, 10),
  }
}

export const MARKET_SCENE: SceneDef = {
  id: 'market',
  name: '鬼夜市',
  colliders: marketColliders(),
  spawns: {
    gate: [0, 7.6],
  },
  exits: [{ area: rect(-2.5, 9.3, 2.5, 10), to: 'temple', spawn: 'market_gate', label: '↓ 土地公廟', sign: [2.9, 8.0] }],
  // 擋在鏡頭前會淡出的東西：牌樓的橫樑、鏡頭那一側（東邊、南邊）的攤子。
  // inside 放在場外：阿嬤永遠不會「在裡面」，鏡頭不會拉近
  buildings: [
    { id: 'gate', inside: NOWHERE, min: [-3.4, 3.4, MARKET.gateZ - 0.5], max: [3.4, 5.6, MARKET.gateZ + 0.5] },
    ...FADE_STALLS.map((k) => {
      const d = MARKET.stalls.find((x) => x.kind === k)!
      const alongX = Math.abs(Math.sin(d.face)) < 0.5 // 朝南北的攤子沿 x 排
      const hw = d.w / 2 + 0.25
      const hd = 0.95
      return {
        id: `stall_${k}`,
        inside: NOWHERE,
        min: [d.x - (alongX ? hw : hd), 0.3, d.z - (alongX ? hd : hw)] as [number, number, number],
        max: [d.x + (alongX ? hw : hd), 2.7, d.z + (alongX ? hd : hw)] as [number, number, number],
      }
    }),
  ],
  rooms: [
    { id: 'hongyi', name: '紅姨的法器攤', area: rect(-2.2, -8.3, 2.2, -6.2) },
    { id: 'fish', name: '金魚伯的撈金魚', area: rect(0.8, 2.2, 2.2, 4.6) },
  ],
  floorAt: () => 0.02,
  npcs: (): Circle[] => [],
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

// 規則檔不能直接 import store（store → hotspots → scenes → 這裡，會循環），要改狀態時再動態載入
const withStore = (fn: (st: typeof import('../store').useStore) => void) => {
  void import('../store').then((m) => fn(m.useStore))
}

const addMerit = (n: number) =>
  withStore((st) => {
    if (n <= 0) return
    const s = st.getState()
    st.setState({ meta: { ...s.meta, merit: s.meta.merit + n } })
  })

const setFlag = (flag: string) =>
  withStore((st) => {
    const s = st.getState()
    st.setState({ flags: { ...s.flags, [flag]: true } })
  })

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

const stall = (kind: StallKind) => MARKET.stalls.find((s) => s.kind === kind)!

export const MARKET_HOTSPOTS: Hotspot[] = [
  {
    id: 'market_hongyi',
    scene: 'market',
    x: 0,
    z: -7.4,
    r: 1.9,
    icon: { x: 0, z: -8.9 },
    iconY: 2.6,
    label: (s) => (s.flags.hongyi_met ? `紅姨的法器（功德 ${s.meta.merit}）` : '跟紅姨說話'),
    run: (s) => {
      if (!s.flags.hongyi_met) s.startDialogue('hongyi_1', () => s.openPanel('relics'))
      else {
        s.bark(pick(['hongyi.again.1', 'hongyi.again.2', 'hongyi.again.3']))
        s.openPanel('relics')
      }
    },
  },
  {
    id: 'market_fish',
    scene: 'market',
    x: 1.8,
    z: 3.4,
    r: 1.6,
    icon: { x: 3.3, z: 3.4 },
    iconY: 1.7,
    label: (s) => (s.flags.market_fish_today ? '撈金魚（今晚玩過了）' : '撈金魚（贏功德）'),
    run: (s) => {
      if (s.flags.market_fish_today) {
        s.bark(pick(['jinyubo.done.1', 'jinyubo.done.2']))
        return
      }
      const play = () => {
        setFlag('market_fish_today')
        s.startMinigame('goldfish', {}, (r) => {
          const merit = (r as PrizeResult | null)?.merit ?? 0
          addMerit(merit)
          s.bark(merit >= 3 ? 'jinyubo.win.big' : merit > 0 ? 'jinyubo.win.small' : 'jinyubo.lose')
        })
      }
      if (!s.flags.jinyubo_met) s.startDialogue('jinyubo_1', play)
      else {
        s.bark(pick(['jinyubo.hello.1', 'jinyubo.hello.2']))
        play()
      }
    },
  },
  {
    id: 'market_balloon',
    scene: 'market',
    x: 1.8,
    z: -3.6,
    r: 1.6,
    icon: { x: 3.5, z: -3.6 },
    iconY: 2.6,
    label: (s) => (s.flags.market_balloon_today ? '射氣球（今晚玩過了）' : '射氣球（贏功德）'),
    run: (s) => {
      if (s.flags.market_balloon_today) {
        s.bark('market.balloon.done')
        return
      }
      setFlag('market_balloon_today')
      s.bark('market.balloon.hello')
      s.startMinigame('balloon', {}, (r) => {
        const merit = (r as PrizeResult | null)?.merit ?? 0
        addMerit(merit)
        s.bark(merit >= 2 ? 'market.balloon.win' : merit > 0 ? 'market.balloon.ok' : 'market.balloon.lose')
      })
    },
  },
  // ---------- 逛逛 ----------
  {
    id: 'market_snail',
    scene: 'market',
    x: -1.8,
    z: stall('snail').z,
    r: 1.4,
    icon: { x: -3.2, z: stall('snail').z },
    iconY: 1.5,
    label: () => '聞聞燒酒螺',
    run: (s) => s.bark(pick(['market.snail.1', 'market.snail.2'])),
  },
  {
    id: 'market_paper',
    scene: 'market',
    x: -1.8,
    z: stall('paper').z,
    r: 1.4,
    icon: { x: -3.2, z: stall('paper').z },
    iconY: 1.6,
    label: () => '看紙紮',
    run: (s) => s.bark(pick(['market.paper.1', 'market.paper.2', 'market.paper.3'])),
  },
  {
    id: 'market_fortune',
    scene: 'market',
    x: stall('fortune').x,
    z: -1.4,
    r: 1.4,
    icon: { x: stall('fortune').x, z: stall('fortune').z },
    iconY: 1.6,
    label: () => '給算命仙看看',
    run: (s) => s.bark(pick(['market.fortune.1', 'market.fortune.2', 'market.fortune.3', 'market.fortune.4'])),
  },
  {
    id: 'market_stage',
    scene: 'market',
    x: -10.9,
    z: 0,
    r: 1.6,
    icon: { x: MARKET.stage.x, z: 0 },
    iconY: 2.8,
    label: () => '看布袋戲',
    run: (s) => s.bark(pick(['market.stage.1', 'market.stage.2', 'market.stage.3'])),
  },
]
