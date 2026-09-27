import { box, rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import { DIALOGUES, type Dialogue } from './dialogues'
import { buyGood } from './goodsGive'

// 糖廠（DESIGN §32.3）：從小火車站坐五分車到終點。一九六〇年代的後壁厝糖廠，早就關了：
// 生鏽的壓榨機、磚砌大煙囪、甘蔗堆、窄軌；福利社的冰櫃還在賣枝仔冰（店裡的好東西：半夜解熱）。
// 陰陽眼打開：第二十三期製糖的鬼工人還在上工，工頭請阿嬤幫忙把甘蔗推進壓榨機（長按）。
// 回去：坐五分車回車站。第二個月（第 5 晚）才通車，之前五分車只在甘蔗田繞一圈（sceneStation.ts）。
// 規則在這裡；畫面在 src/scene/Sugar.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。
//
//          z 負（北，鏡頭對面）
//   ┌──────── 壓榨工場（鐵皮屋頂，南面整排開口）────────┐   大煙囪
//   │ 壓榨機 ×3（滾筒）  輸送帶 ↑  鍋爐                  │
//   └──────────────────────────────────────────────┘   公佈欄   福利社（冰櫃）
//   甘蔗堆        地磅       生鏽的台車（窄軌）
//   ▭▭▭▭▭▭▭▭▭▭ 糖廠站的月台 ▭▭▭▭▭▭▭▭▭▭  五分車（停在終點，車擋）
//          z 正（南，鏡頭這一側）

/** 五分車第幾晚開始通到糖廠（第二個月） */
export const SUGAR_OPEN_NIGHT = 5

export const SUGAR = {
  /** 終點站的窄軌（東西向）與車擋 */
  track: { z: 4.7, x0: -26, x1: 8.4 },
  /** 糖廠站的月台（高一階） */
  platform: { x0: -12, x1: 5.2, z0: 2.9, z1: 3.9, y: 0.32 },
  /** 停在終點的五分車：火車頭、三節甘蔗車 */
  train: { locoX: 4.1, wagons: [0.4, -3.1, -6.6] },
  /** 壓榨工場：南面整排開口 */
  mill: { x0: -12.6, x1: 5.6, z0: -10.9, z1: -4.6, wallH: 4.6, ridgeY: 7.0 },
  /** 南面開口之間的磚柱 */
  millPosts: [-8.4, -4.2, 2.2],
  /** 輸送帶：從地上（z0）斜斜往北升到壓榨機（z1） */
  carrier: { x: -0.8, z0: -5.2, z1: -8.7, top: 2.5, w: 1.1 },
  /** 阿嬤推甘蔗的地方（輸送帶腳下、工場開口外） */
  feed: { x: -0.8, z: -4.0 },
  /** 三座壓榨機（x），都在 z = millZ */
  mills: [-3.9, -6.9, -9.9],
  millZ: -8.5,
  /** 鍋爐（兩個橫躺的圓筒） */
  boiler: { x0: 1.4, x1: 4.6, z0: -10.3, z1: -7.3 },
  /** 磚砌大煙囪 */
  chimney: { x: 8.6, z: -9.2, r: 1.0, h: 17 },
  /** 福利社：南面有一個賣東西的窗口，門口一台冰櫃 */
  shop: { x0: 9.6, x1: 14.8, z0: -3.9, z1: -0.7, window: 12.2 },
  freezer: { x: 12.2, z: 0.05 },
  /** 公佈欄（一九六一年的全體員工合照） */
  board: { x: 6.6, z: -3.2 },
  /** 甘蔗堆（西邊） */
  piles: [
    { x: -14.2, z: -1.6, r: 1.6 },
    { x: -10.9, z: 0.1, r: 1.3 },
    { x: -13.4, z: 1.6, r: 1.1 },
  ],
  /** 地磅（平的，可以走上去）＋過磅的小亭子 */
  scale: { x0: -6.4, x1: -3.2, z0: -1.6, z1: 0.6 },
  booth: { x: -7.6, z: -2.4 },
  /** 窄軌支線上生鏽的空台車 */
  spurWagon: { x: -0.8, z: -1.6 },
  /** 路燈 */
  lamps: [
    { x: -8.2, z: 2.1 },
    { x: 7.6, z: 1.4 },
  ],
  /** 鬼（陰陽眼）：工頭、工人、福利社阿姨 */
  foreman: { x: 0.9, z: -4.1 },
  workers: [
    { x: -1.9, z: -5.4, pose: 'reach' as const, heading: Math.PI * 0.95 },
    { x: -10.4, z: -1.4, pose: 'clasp' as const, heading: 0.6 },
    { x: -5.0, z: -7.6, pose: 'idle' as const, heading: -0.4 },
  ],
  resting: { x: -12.3, z: 1.2 },
  auntie: { x: 12.2, z: -1.35 },
}

const S = SUGAR
const NOWHERE = rect(900, 900, 900.1, 900.1)

// ---------------------------------------------------------------------------
// 推甘蔗（長按）：狀態放在這裡，畫面（Sugar.tsx）每幀推進、完成時發獎勵
// ---------------------------------------------------------------------------

/** 一次要推幾捆、每捆按多久（秒）、放開多久就算不推了、要站多近 */
export const FEED = { bundles: 3, need: 1.1, idleCancel: 2.5, reach: 1.35 }

export const sugarState: { feed: { bundle: number; progress: number; idle: number } | null; pushedAt: number } = { feed: null, pushedAt: -10 }

// ---------------------------------------------------------------------------
// 碰撞、地板
// ---------------------------------------------------------------------------

function sugarColliders() {
  const M = S.mill
  const T = 0.3
  const rects: Rect[] = [
    // 工場：北牆、東西牆、南面兩端的短牆（中間整排開口，只有磚柱）
    rect(M.x0, M.z0, M.x1, M.z0 + T),
    rect(M.x0, M.z0, M.x0 + T, M.z1),
    rect(M.x1 - T, M.z0, M.x1, M.z1),
    rect(M.x0, M.z1 - T, M.x0 + 0.9, M.z1),
    rect(M.x1 - 0.9, M.z1 - T, M.x1, M.z1),
    // 工場裡：三座壓榨機、輸送帶、鍋爐
    ...S.mills.map((x) => box(x, S.millZ, 2.2, 2.4)),
    rect(S.carrier.x - S.carrier.w / 2, S.carrier.z1, S.carrier.x + S.carrier.w / 2, S.carrier.z0),
    rect(S.boiler.x0, S.boiler.z0, S.boiler.x1, S.boiler.z1),
    // 福利社、冰櫃、公佈欄、過磅亭、台車
    rect(S.shop.x0, S.shop.z0, S.shop.x1, S.shop.z1),
    box(S.freezer.x, S.freezer.z, 1.3, 0.7),
    box(S.board.x, S.board.z, 2.0, 0.3),
    box(S.booth.x, S.booth.z, 1.3, 1.3),
    box(S.spurWagon.x, S.spurWagon.z, 1.2, 2.3),
  ]
  const circles: Circle[] = [
    ...S.millPosts.map((x) => ({ x, z: M.z1 - 0.1, r: 0.32 })),
    { x: S.chimney.x, z: S.chimney.z, r: S.chimney.r + 0.2 },
    ...S.piles.map((p) => ({ x: p.x, z: p.z, r: p.r })),
    ...S.lamps.map((l) => ({ x: l.x, z: l.z, r: 0.14 })),
  ]
  // 南邊到月台邊緣為止（再過去是鐵軌）；北邊到工場後牆
  return { rects, circles, bounds: rect(-16.6, M.z0 + 0.2, 16.6, S.platform.z1 - 0.05) }
}

const inRect = (r: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1
const MILL_IN = rect(S.mill.x0 + 0.3, S.mill.z0 + 0.3, S.mill.x1 - 0.3, S.mill.z1 - 0.15)

export const SUGAR_SCENE: SceneDef = {
  id: 'sugar',
  name: '糖廠',
  colliders: sugarColliders(),
  spawns: { train: [-2.4, 3.35] },
  exits: [],
  buildings: [
    // 走進壓榨工場：鐵皮屋頂和牆淡出、鏡頭拉近
    { id: 'sugar_mill', inside: MILL_IN, min: [S.mill.x0 - 0.3, 0, S.mill.z0 - 0.3], max: [S.mill.x1 + 0.3, S.mill.ridgeY + 0.4, S.mill.z1 + 0.6] },
    // 福利社擋到公佈欄前的阿嬤時淡一點
    { id: 'sugar_shop', inside: NOWHERE, min: [S.shop.x0, 0, S.shop.z0], max: [S.shop.x1, 3.6, S.shop.z1 + 0.3] },
  ],
  rooms: [
    { id: 'sugar_mill', name: '壓榨工場', area: MILL_IN },
    { id: 'sugar_shop', name: '福利社', area: rect(S.shop.x0 - 1, S.shop.z1, S.shop.x1 + 1, S.freezer.z + 1.4) },
  ],
  floorAt: (x, z) => (inRect(S.platform, x, z) ? S.platform.y : inRect(S.mill, x, z) ? 0.1 : inRect(S.scale, x, z) ? 0.06 : 0.02),
  npcs: (): Circle[] => [],
}

// ---------------------------------------------------------------------------
// 對話
// ---------------------------------------------------------------------------

const SUGAR_DIALOGUES: Record<string, Dialogue> = {
  st2_foreman: {
    steps: [
      { line: 'st2.foreman.1' },
      { line: 'st2.foreman.2' },
      { line: 'st2.foreman.3' },
      {
        line: 'st2.foreman.4',
        choices: [
          { line: 'st2.foreman.a', goto: 'a' },
          { line: 'st2.foreman.b', goto: 'b' },
        ],
      },
      { label: 'a', line: 'st2.foreman.a' },
      { line: 'st2.foreman.a2', goto: 'end' },
      { label: 'b', line: 'st2.foreman.b' },
      { line: 'st2.foreman.b2' },
      { label: 'end', line: 'st2.foreman.5', set: 'sugar_foreman_met' },
    ],
  },
  st2_photo: {
    steps: [{ line: 'st2.photo.1' }, { line: 'st2.photo.2' }, { line: 'st2.photo.3' }, { line: 'st2.photo.4' }, { line: 'st2.photo.5', set: 'sugar_photo_seen' }],
  },
}
Object.assign(DIALOGUES, SUGAR_DIALOGUES)

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

/** 福利社的枝仔冰（民宿的錢，一天兩支） */
export const ICEPOP_PRICE = 20

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const withStore = (fn: (st: typeof import('../store').useStore) => void) => {
  void import('../store').then((m) => fn(m.useStore))
}

export const SUGAR_HOTSPOTS: Hotspot[] = [
  {
    id: 'sugar_back',
    scene: 'sugar',
    x: S.train.locoX - 1.0,
    z: S.platform.z0 + 0.45,
    r: 1.4,
    icon: { x: S.train.locoX, z: S.track.z },
    iconY: 2.7,
    label: () => '坐五分車回車站',
    run: (s) => {
      s.bark('st2.sugar.back')
      window.setTimeout(() => s.goto('station', 'sugar'), 700)
    },
  },
  {
    // 陰陽眼：幫鬼工人把甘蔗推進壓榨機（長按三捆）；沒開只是一台生鏽的機器
    id: 'sugar_mill',
    scene: 'sugar',
    x: S.feed.x,
    z: S.feed.z,
    r: 1.15,
    icon: { x: S.carrier.x, z: S.carrier.z0 - 0.4 },
    iconY: 1.9,
    label: (s) => {
      if (!s.vision) return '生鏽的壓榨機'
      if (s.flags.sugar_mill_today) return '壓榨機（今天幫過忙了）'
      const f = sugarState.feed
      return f ? `推甘蔗（按住）${f.bundle + 1}／${FEED.bundles} 捆` : '幫鬼工人把甘蔗推進壓榨機（長按）'
    },
    run: (s) => {
      if (!s.vision) {
        s.bark('st2.mill.look')
        return
      }
      if (s.flags.sugar_mill_today) {
        s.bark('st2.mill.today')
        return
      }
      if (sugarState.feed) return
      sugarState.feed = { bundle: 0, progress: 0, idle: 0 }
      s.bark('st2.mill.start')
    },
  },
  {
    id: 'sugar_foreman',
    scene: 'sugar',
    x: S.foreman.x + 0.7,
    z: S.foreman.z + 0.7,
    r: 1.0,
    icon: { x: S.foreman.x, z: S.foreman.z },
    iconY: 2.3,
    label: (s) => (s.vision ? (s.flags.sugar_foreman_met ? '跟工頭說話' : '跟鬼工頭打招呼') : null),
    run: (s) => {
      if (!s.flags.sugar_foreman_met) s.startDialogue('st2_foreman')
      else s.bark(pick(['st2.foreman.again.1', 'st2.foreman.again.2', 'st2.foreman.again.3']))
    },
  },
  {
    // 福利社的冰櫃：誠實箱放錢拿一支（陰陽眼看得到福利社阿姨）
    id: 'sugar_icepop',
    scene: 'sugar',
    x: S.freezer.x,
    z: S.freezer.z + 0.95,
    r: 1.1,
    icon: { x: S.freezer.x, z: S.freezer.z },
    iconY: 1.6,
    label: (s) => (s.flags.goods_icepop2_today ? '枝仔冰（今天拿夠了）' : `拿一支枝仔冰（誠實箱放 $${ICEPOP_PRICE}${s.flags.goods_icepop_today ? '，還可以再拿一支' : ''}）`),
    run: (s) => {
      if (s.flags.goods_icepop2_today) {
        s.bark('st2.icepop.done')
        return
      }
      buyGood('icepop', ICEPOP_PRICE, s.flags.goods_icepop_today ? 'goods_icepop2_today' : 'goods_icepop_today', s.vision ? 'st2.icepop.auntie' : 'st2.icepop.buy')
    },
  },
  {
    // 公佈欄：一九六一年的全體員工合照，阿公在裡面（不是新的回憶碎片，只是一段話）
    id: 'sugar_board',
    scene: 'sugar',
    x: S.board.x,
    z: S.board.z + 1.05,
    r: 1.2,
    icon: { x: S.board.x, z: S.board.z },
    iconY: 2.3,
    label: (s) => (s.flags.sugar_photo_seen ? '公佈欄的老照片' : '看公佈欄'),
    run: (s) => {
      if (!s.flags.sugar_photo_seen) s.startDialogue('st2_photo')
      else s.bark('st2.photo.again')
    },
  },
  {
    // 甘蔗堆：偷抽一支（陰陽眼開著會被鬼工頭抓到）
    id: 'sugar_cane',
    scene: 'sugar',
    x: -11.0,
    z: 1.9,
    r: 1.3,
    icon: { x: S.piles[1].x, z: S.piles[1].z },
    iconY: 1.7,
    label: (s) => (s.flags.sugar_cane_today ? '甘蔗堆' : '偷抽一支甘蔗'),
    run: (s) => {
      if (s.flags.sugar_cane_today) {
        s.bark('st2.cane.today')
        return
      }
      withStore((st) => {
        const x = st.getState()
        st.setState({ flags: { ...x.flags, sugar_cane_today: true } })
      })
      if (!s.vision) {
        s.bark('st2.cane.steal')
        return
      }
      s.bark('st2.cane.caught')
      window.setTimeout(() => s.bark('st2.cane.caught.gm'), 3200)
    },
  },
  {
    id: 'sugar_chimney',
    scene: 'sugar',
    x: S.chimney.x - 1.3,
    z: S.chimney.z + 1.9,
    r: 1.3,
    icon: { x: S.chimney.x, z: S.chimney.z },
    iconY: 4.2,
    label: () => '大煙囪',
    run: (s) => s.bark(s.vision ? 'st2.chimney.smoke' : 'st2.chimney'),
  },
]
