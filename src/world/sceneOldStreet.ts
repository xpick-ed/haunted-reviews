import { box, rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import type { CinemaResult } from '../ui/minigames/types'
import { ARCADE_COLUMNS, NOWHERE, OLDSTREET, isNight, pick, withStore, type ShopInterior } from './oldStreetLayout'
import { OS_WEST } from './osWest'
import { OS_EAST } from './osEast'

// 老街（DESIGN §27.1）：從小火車站出來。冰果室剉冰、關門的老戲院（放映機播阿嬤的回憶）、照相館、理髮廳；盡頭往海邊。
// 規則在這裡；畫面在 src/scene/OldStreet.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或動態 import('../store')）。
//
//          z 負（北，鏡頭對面）：一整排 1930 年代的牌樓厝，一樓是亭仔腳（騎樓）
//   新美理髮廳 │ 和春中藥行 │   光華戲院（大廳可以進去）   │ 阿桃冰果室 │ 光明照相館 │ 錦繡布莊 │ …
//   ══════ 亭仔腳（柱子在 z = -2.4，店面在 z = -4.4）══════
//   ═══════════════ 石板老街（東西向）═══════════════
//   豆花車、烤番薯攤、路燈、長椅（都是矮的，才不會擋住阿嬤）
//   ～～～～～～～～ 圳溝（石砌，有欄杆）～～～～～～～～
//          z 正（南，鏡頭這一側）

export { ARCADE_COLUMNS, OLDSTREET } from './oldStreetLayout'

const O = OLDSTREET
/** 可以走進去的店（DESIGN §30）：西邊理髮廳、中藥行；東邊冰果室、照相館、布莊 */
const SHOPS: ShopInterior[] = [OS_WEST, OS_EAST]
const OPEN_LOTS = new Set(SHOPS.flatMap((m) => m.lots))

function oldStreetColliders() {
  const A = O.arcade
  const C = O.cinema
  const CL = O.lots.find((l) => l.id === 'cinema')!
  const rects: Rect[] = [
    // 北邊的房子（店面線以後都擋住）：可以走進去的店由 osWest.ts／osEast.ts 自己給牆
    ...O.lots.filter((l) => l.id !== 'cinema' && !OPEN_LOTS.has(l.id)).map((l) => rect(l.x0 < -21 ? -22.5 : l.x0, A.backZ, l.x1, A.frontZ)),
    // 戲院的兩面側牆、大廳挖空
    rect(CL.x0, A.backZ, C.x0, A.frontZ),
    rect(C.x1, A.backZ, CL.x1, A.frontZ),
    rect(C.x0, A.backZ, C.x1, C.z0),
    // 戲院正面的牆，中間是門
    rect(C.x0, A.frontZ - 0.2, C.doorX0, A.frontZ),
    rect(C.doorX1, A.frontZ - 0.2, C.x1, A.frontZ),
    // 戲院大廳裡：賣零食的櫃台、長椅
    box(-7.9, -7.2, 0.7, 2.4),
    box(-2.2, -6.2, 0.5, 1.6),
    // 攤車、長椅、機車
    ...O.carts.map((c) => box(c.x, c.z, 1.7, 0.9)),
    ...O.benches.map((b) => box(b.x, b.z, 1.5, 0.45)),
    box(O.scooter.x, O.scooter.z, 1.5, 0.55),
    // 圳溝（南邊的盡頭）
    rect(-22.5, O.canal.z0, 22.5, O.canal.z1 + 2),
    ...SHOPS.flatMap((m) => m.rects),
  ]
  const circles: Circle[] = [
    ...ARCADE_COLUMNS.map((x) => ({ x, z: A.colZ, r: 0.22 })),
    ...O.lampXs.map((x) => ({ x, z: O.lampZ, r: 0.16 })),
    { x: O.mailbox.x, z: O.mailbox.z, r: 0.42 },
    ...SHOPS.flatMap((m) => m.circles),
  ]
  return { rects, circles, bounds: rect(-22, C.z0, 22, O.canal.z0) }
}

export const OLDSTREET_SCENE: SceneDef = {
  id: 'oldstreet',
  name: '老街',
  colliders: oldStreetColliders(),
  spawns: { station: [18, 0.8], harbor: [-18, 0.8] },
  exits: [
    {
      area: rect(20.5, -3, 22, 3.6),
      to: 'station',
      spawn: 'oldstreet',
      label: '小火車站 →',
      sign: [19.2, 3.0],
    },
    {
      area: rect(-22, -3, -20.5, 3.6),
      to: 'harbor',
      spawn: 'oldstreet',
      label: '← 海邊',
      sign: [-19.4, 3.0],
    },
  ],
  buildings: [
    // 走進戲院大廳：整棟淡出、鏡頭拉近
    {
      id: 'os_cinema',
      inside: rect(O.cinema.x0, O.cinema.z0, O.cinema.x1, O.arcade.frontZ),
      min: [O.cinema.x0 - 0.4, 0, O.arcade.backZ],
      max: [O.cinema.x1 + 0.4, 10.5, O.arcade.colZ + 0.3],
    },
    // 大廳東牆＋冰果室西牆：阿嬤一進大廳就淡掉（盒子就是大廳本身，人在裡面必中）
    {
      id: 'os_lobby_side',
      inside: NOWHERE,
      min: [O.cinema.x0, 0, O.cinema.z0],
      max: [O.cinema.x1, O.arcade.ceilY, O.arcade.frontZ],
    },
    // 站在戲院大廳東半邊時，鏡頭會被隔壁冰果室的二樓立面擋住：只算亭仔腳頂以上，走騎樓不會誤觸
    {
      id: 'os_ice_front',
      inside: NOWHERE,
      min: [O.cinema.x1 + 0.05, O.arcade.ceilY - 0.25, O.arcade.backZ],
      max: [O.lots.find((l) => l.id === 'ice')!.x1, 10, O.arcade.colZ + 0.1],
    },
    // 豆花車的布棚擋到阿嬤時淡一點
    ...O.carts.map((c) => ({
      id: `os_cart_${c.id}`,
      inside: NOWHERE,
      min: [c.x - 1.0, 1.2, c.z - 0.7] as [number, number, number],
      max: [c.x + 1.0, 2.6, c.z + 0.7] as [number, number, number],
    })),
    ...SHOPS.flatMap((m) => m.buildings),
  ],
  rooms: [
    {
      id: 'os_cinema',
      name: '光華戲院',
      area: rect(O.cinema.x0, O.cinema.z0, O.cinema.x1, -2.4),
    },
    ...SHOPS.flatMap((m) => m.rooms),
  ],
  // 亭仔腳和戲院大廳高一階
  floorAt: (x, z) => (z < O.arcade.colZ && z > O.cinema.z0 - 0.5 && x > -22 && x < 22 ? 0.14 : 0.02),
  npcs: (phase: string): Circle[] => [{ x: O.projectionist.x, z: O.projectionist.z, r: 0.3 }, ...SHOPS.flatMap((m) => m.npcs?.(phase) ?? [])],
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

export const OLDSTREET_HOTSPOTS: Hotspot[] = [
  ...SHOPS.flatMap((m) => m.hotspots),
  {
    // 老戲院的放映師（鬼）：把收集到的回憶做成膠捲放給阿嬤看
    id: 'os_projectionist',
    scene: 'oldstreet',
    x: O.projectionist.x - 0.6,
    z: O.projectionist.z + 1.2,
    r: 1.6,
    icon: { x: O.projectionist.x, z: O.projectionist.z },
    iconY: 2.3,
    label: (s) => (s.flags.projectionist_met ? '請放映師放一卷回憶' : '跟放映師說話'),
    run: (s) => {
      const play = () => {
        withStore((st) => {
          const x = st.getState()
          if (!x.meta.memories.length) {
            x.bark('projectionist.noreel')
            return
          }
          x.startMinigame('cinema', { reels: x.meta.memories }, (r) => {
            const res = (r as CinemaResult | null) ?? { watched: null }
            if (!res.watched) return
            withStore((st2) => {
              const y = st2.getState()
              st2.setState({
                flags: { ...y.flags, [`cinema_watched_${res.watched}`]: true },
              })
              y.bark(pick(['projectionist.after.1', 'projectionist.after.2']))
            })
          })
        })
      }
      if (!s.flags.projectionist_met) {
        s.startDialogue('projectionist_first', play)
        return
      }
      s.bark(pick(['projectionist.hi.1', 'projectionist.hi.2']))
      window.setTimeout(play, 900)
    },
  },
  {
    id: 'os_posters',
    scene: 'oldstreet',
    x: -5.0,
    z: -1.6,
    r: 1.4,
    icon: { x: -5.0, z: -2.6 },
    iconY: 5.4,
    label: () => '戲院的電影看板',
    run: (s) => s.bark(isNight(s) ? 'oldstreet.poster.night' : pick(['oldstreet.poster.1', 'oldstreet.poster.2'])),
  },
  {
    id: 'os_ticket',
    scene: 'oldstreet',
    x: O.cinema.ticketX + 0.3,
    z: O.arcade.frontZ + 0.9,
    r: 1.0,
    icon: { x: O.cinema.ticketX, z: O.arcade.frontZ },
    iconY: 1.9,
    label: () => '戲院售票口',
    run: (s) => s.bark('oldstreet.ticket'),
  },
  {
    id: 'os_douhua',
    scene: 'oldstreet',
    x: O.carts[0].x,
    z: O.carts[0].z - 1.0,
    r: 1.2,
    icon: { x: O.carts[0].x, z: O.carts[0].z },
    iconY: 2.2,
    label: () => '豆花車',
    run: (s) => s.bark(isNight(s) ? 'oldstreet.cart.night' : 'oldstreet.cart'),
  },
  {
    id: 'os_yam',
    scene: 'oldstreet',
    x: O.carts[1].x,
    z: O.carts[1].z - 1.0,
    r: 1.2,
    icon: { x: O.carts[1].x, z: O.carts[1].z },
    iconY: 2.0,
    label: () => '烤番薯攤',
    run: (s) => s.bark('oldstreet.yam'),
  },
  {
    id: 'os_scooter',
    scene: 'oldstreet',
    x: O.scooter.x,
    z: O.scooter.z + 0.9,
    r: 1.0,
    icon: { x: O.scooter.x, z: O.scooter.z },
    iconY: 1.4,
    label: () => '偉士牌',
    run: (s) => s.bark('oldstreet.scooter'),
  },
  {
    id: 'os_canal',
    scene: 'oldstreet',
    x: 6,
    z: 3.8,
    r: 1.3,
    icon: { x: 6, z: O.canal.z0 + 0.4 },
    iconY: 0.9,
    label: () => '圳溝',
    run: (s) => s.bark(isNight(s) ? 'oldstreet.canal.night' : 'oldstreet.canal'),
  },
]
