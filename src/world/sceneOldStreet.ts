import { box, rect, type Circle, type Rect } from './collision'
import type { SceneDef } from './scenes'
import type { Hotspot } from './hotspots'
import type { CinemaResult, PhotoResult, ShaveIceResult } from '../ui/minigames/types'

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

export const OLDSTREET = {
  /** 石板街面 */
  street: { z0: -2.4, z1: 4.2 },
  /** 亭仔腳：柱子那一排、店面的牆、房子後面 */
  arcade: { colZ: -2.4, frontZ: -4.4, backZ: -11.2, ceilY: 3.2 },
  /** 北邊一排店（x 範圍、二樓牆頂、名字） */
  lots: [
    { id: 'barber', x0: -21.5, x1: -15.2, top: 7.2, name: '新美理髮廳' },
    { id: 'herb', x0: -15.2, x1: -9.2, top: 7.4, name: '和春中藥行' },
    { id: 'cinema', x0: -9.2, x1: -0.8, top: 10.4, name: '光華戲院' },
    { id: 'ice', x0: -0.8, x1: 5.4, top: 7.3, name: '阿桃冰果室' },
    { id: 'photo', x0: 5.4, x1: 11.2, top: 7.5, name: '光明照相館' },
    { id: 'cloth', x0: 11.2, x1: 17.0, top: 7.2, name: '錦繡布莊' },
    { id: 'end', x0: 17.0, x1: 22.5, top: 6.6, name: '' },
  ] as { id: string; x0: number; x1: number; top: number; name: string }[],
  /** 戲院：大廳可以走進去（門在店面牆中間） */
  cinema: { x0: -8.9, x1: -1.1, z0: -10.2, doorX0: -5.8, doorX1: -4.2, ticketX: -7.3 },
  /** 放映師（大廳最裡面，戲院布簾旁邊） */
  projectionist: { x: -3.2, z: -9.0 },
  /** 冰果室：櫃台在店面線上，阿桃站在後面；亭仔腳擺兩張小圓桌 */
  ice: { counterX: 2.3, counterZ: -4.55, counterW: 2.8, bingmom: { x: 2.3, z: -5.2 }, tables: [0.6, 4.0], tableZ: -3.35 },
  /** 照相館老闆站在門口 */
  photo: { doorX: 8.6, photographer: { x: 7.4, z: -3.7 } },
  /** 理髮廳的旋轉燈柱（掛在柱子西側） */
  barberPole: { x: -15.55, z: -2.55 },
  /** 照相館門口展示的老相機（三腳架）、紅綠郵筒 */
  tripod: { x: 10.3, z: -3.85 },
  mailbox: { x: 12.1, z: -1.95 },
  /** 路燈（街的南邊） */
  lampZ: 3.55,
  lampXs: [-17, -7.5, 2.5, 12.5],
  /** 攤車 */
  carts: [
    { id: 'douhua', x: 8.2, z: 3.2, name: '豆花' },
    { id: 'yam', x: -12.4, z: 3.2, name: '烤番薯' },
  ],
  benches: [
    { x: -2.6, z: 3.55 },
    { x: 17.2, z: 3.55 },
  ],
  scooter: { x: -3.6, z: -1.4 },
  /** 圳溝（南邊的盡頭） */
  canal: { z0: 4.35, z1: 5.7 },
}

const O = OLDSTREET
const NOWHERE = rect(900, 900, 900.1, 900.1)

/** 亭仔腳的柱子：每一間店兩端各一根（戲院多兩根） */
export const ARCADE_COLUMNS: number[] = (() => {
  const xs = new Set<number>()
  for (const l of O.lots) {
    xs.add(+l.x0.toFixed(2))
    if (l.x1 - l.x0 > 7) xs.add(+((l.x0 * 2 + l.x1) / 3).toFixed(2)).add(+((l.x0 + l.x1 * 2) / 3).toFixed(2))
    else xs.add(+((l.x0 + l.x1) / 2).toFixed(2))
  }
  xs.add(+O.lots[O.lots.length - 1].x1.toFixed(2))
  return [...xs].filter((x) => x > -21.9 && x < 21.9).sort((a, b) => a - b)
})()

function oldStreetColliders() {
  const A = O.arcade
  const C = O.cinema
  const rects: Rect[] = [
    // 北邊的房子（店面線以後都擋住），戲院大廳挖空
    rect(-22.5, A.backZ, C.x0, A.frontZ),
    rect(C.x1, A.backZ, 22.5, A.frontZ),
    rect(C.x0, A.backZ, C.x1, C.z0),
    // 戲院正面的牆，中間是門
    rect(C.x0, A.frontZ - 0.2, C.doorX0, A.frontZ),
    rect(C.doorX1, A.frontZ - 0.2, C.x1, A.frontZ),
    // 戲院大廳裡：賣零食的櫃台、長椅
    box(-7.9, -7.2, 0.7, 2.4),
    box(-2.2, -6.2, 0.5, 1.6),
    // 冰果室的櫃台（凸出店面一點點）
    box(O.ice.counterX, O.ice.counterZ + 0.12, O.ice.counterW, 0.5),
    // 攤車、長椅、機車
    ...O.carts.map((c) => box(c.x, c.z, 1.7, 0.9)),
    ...O.benches.map((b) => box(b.x, b.z, 1.5, 0.45)),
    box(O.scooter.x, O.scooter.z, 1.5, 0.55),
    // 圳溝（南邊的盡頭）
    rect(-22.5, O.canal.z0, 22.5, O.canal.z1 + 2),
  ]
  const circles: Circle[] = [
    ...ARCADE_COLUMNS.map((x) => ({ x, z: A.colZ, r: 0.22 })),
    ...O.lampXs.map((x) => ({ x, z: O.lampZ, r: 0.16 })),
    ...O.ice.tables.map((x) => ({ x, z: O.ice.tableZ, r: 0.42 })),
    { x: O.tripod.x, z: O.tripod.z, r: 0.34 },
    { x: O.mailbox.x, z: O.mailbox.z, r: 0.42 },
  ]
  return { rects, circles, bounds: rect(-22, C.z0, 22, O.canal.z0) }
}

export const OLDSTREET_SCENE: SceneDef = {
  id: 'oldstreet',
  name: '老街',
  colliders: oldStreetColliders(),
  spawns: { station: [18, 0.8], harbor: [-18, 0.8] },
  exits: [
    { area: rect(20.5, -3, 22, 3.6), to: 'station', spawn: 'oldstreet', label: '小火車站 →', sign: [19.2, 3.0] },
    { area: rect(-22, -3, -20.5, 3.6), to: 'harbor', spawn: 'oldstreet', label: '← 海邊', sign: [-19.4, 3.0] },
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
    ...O.carts.map((c) => ({ id: `os_cart_${c.id}`, inside: NOWHERE, min: [c.x - 1.0, 1.2, c.z - 0.7] as [number, number, number], max: [c.x + 1.0, 2.6, c.z + 0.7] as [number, number, number] })),
  ],
  rooms: [
    { id: 'os_barber', name: '新美理髮廳', area: rect(-21.5, -4.4, -15.2, -2.4) },
    { id: 'os_herb', name: '和春中藥行', area: rect(-15.2, -4.4, -9.2, -2.4) },
    { id: 'os_cinema', name: '光華戲院', area: rect(O.cinema.x0, O.cinema.z0, O.cinema.x1, -2.4) },
    { id: 'os_ice', name: '阿桃冰果室', area: rect(-0.8, -4.4, 5.4, -2.4) },
    { id: 'os_photo', name: '光明照相館', area: rect(5.4, -4.4, 11.2, -2.4) },
    { id: 'os_cloth', name: '錦繡布莊', area: rect(11.2, -4.4, 17, -2.4) },
  ],
  // 亭仔腳和戲院大廳高一階
  floorAt: (x, z) => (z < O.arcade.colZ && z > O.cinema.z0 - 0.5 && x > -22 && x < 22 ? 0.14 : 0.02),
  npcs: (phase: string): Circle[] => [
    { x: O.ice.bingmom.x, z: O.ice.bingmom.z, r: 0.3 },
    { x: O.projectionist.x, z: O.projectionist.z, r: 0.3 },
    ...(phase === 'dusk' ? [{ x: O.photo.photographer.x, z: O.photo.photographer.z, r: 0.3 }] : []),
  ],
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const isNight = (s: { phase: string }) => s.phase === 'night'

/** 規則檔不能直接 import store（Node 測試會載入），要改狀態時才動態載入 */
function withStore(fn: (st: typeof import('../store').useStore) => void) {
  void import('../store').then(({ useStore }) => fn(useStore))
}

export const OLDSTREET_HOTSPOTS: Hotspot[] = [
  {
    // 冰果室阿桃：第一次先聊天，之後一天幫她剉一次冰（晚上的客人都是好兄弟）
    id: 'os_bingmom',
    scene: 'oldstreet',
    x: O.ice.counterX,
    z: O.arcade.frontZ + 1.05,
    r: 1.5,
    icon: { x: O.ice.bingmom.x, z: O.ice.bingmom.z },
    iconY: 2.25,
    label: (s) => {
      if (!s.flags.bingmom_met) return '跟冰果室阿桃打招呼'
      return s.flags.os_ice_today ? '冰果室（今天幫過忙了）' : '幫阿桃剉冰'
    },
    run: (s) => {
      const play = () =>
        s.startMinigame('shaveice', {}, (r) => {
          const res = (r as ShaveIceResult | null) ?? { served: 0, merit: 0 }
          withStore((st) => {
            const x = st.getState()
            st.setState({ flags: { ...x.flags, os_ice_today: true }, meta: { ...x.meta, merit: x.meta.merit + res.merit } })
            x.bark(res.merit >= 2 ? 'bingmom.win' : res.served > 0 ? 'bingmom.ok' : 'bingmom.lose')
          })
        })
      if (!s.flags.bingmom_met) {
        s.startDialogue('bingmom_first', play)
        return
      }
      if (s.flags.os_ice_today) {
        s.bark(pick(['bingmom.done.1', 'bingmom.done.2']))
        return
      }
      s.bark(isNight(s) ? pick(['bingmom.night.1', 'bingmom.night.2']) : pick(['bingmom.hi.1', 'bingmom.hi.2']))
      window.setTimeout(play, 900)
    },
  },
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
              st2.setState({ flags: { ...y.flags, [`cinema_watched_${res.watched}`]: true } })
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
    // 照相館：老闆看不到阿嬤，但是老相機拍得到鬼。傍晚才開，一天拍一次
    id: 'os_photo',
    scene: 'oldstreet',
    x: O.photo.photographer.x + 0.9,
    z: O.photo.photographer.z + 0.7,
    r: 1.5,
    icon: { x: O.photo.doorX, z: O.arcade.frontZ },
    iconY: 2.4,
    label: (s) => {
      if (isNight(s)) return '照相館（關門了）'
      return s.flags.os_photo_today ? '照相館（今天拍過了）' : '到照相館拍照'
    },
    run: (s) => {
      if (isNight(s)) {
        s.bark('photographer.closed')
        return
      }
      if (s.flags.os_photo_today) {
        s.bark('photographer.again')
        return
      }
      const play = () =>
        s.startMinigame('photo', {}, (r) => {
          const res = (r as PhotoResult | null) ?? { taken: false }
          if (!res.taken) return
          withStore((st) => {
            const x = st.getState()
            st.setState({ flags: { ...x.flags, os_photo_today: true }, meta: { ...x.meta, merit: x.meta.merit + 1 } })
            x.bark(pick(['photographer.after.1', 'photographer.after.2']))
          })
        })
      if (!s.flags.photographer_met) {
        s.startDialogue('photographer_first', play)
        return
      }
      s.bark('photographer.hi.1')
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
    id: 'os_barber',
    scene: 'oldstreet',
    x: O.barberPole.x + 0.4,
    z: O.barberPole.z + 0.9,
    r: 1.2,
    icon: { x: O.barberPole.x, z: O.barberPole.z },
    iconY: 2.5,
    label: () => '理髮廳的旋轉燈',
    run: (s) => s.bark(isNight(s) ? 'oldstreet.barber.night' : 'oldstreet.barber.1'),
  },
  {
    id: 'os_herb',
    scene: 'oldstreet',
    x: -12.2,
    z: -3.3,
    r: 1.4,
    icon: { x: -12.2, z: O.arcade.frontZ },
    iconY: 2.4,
    label: () => '中藥行',
    run: (s) => s.bark('oldstreet.herb'),
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
