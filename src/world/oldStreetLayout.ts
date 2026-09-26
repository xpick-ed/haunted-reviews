import { rect, type Circle, type Rect } from './collision'
import type { Building } from './scenes'
import type { Hotspot } from './hotspots'

// 老街的座標（DESIGN §27.1）：從 sceneOldStreet.ts 拆出來，讓每間店的室內（osWest.ts、osEast.ts）也能用，不會互相 import。
// 這個檔案會被 Node 測試載入，不能 import store／audio。

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
  cinema: {
    x0: -8.9,
    x1: -1.1,
    z0: -10.2,
    doorX0: -5.8,
    doorX1: -4.2,
    ticketX: -7.3,
  },
  /** 放映師（大廳最裡面，戲院布簾旁邊） */
  projectionist: { x: -3.2, z: -9.0 },
  /** 冰果室：櫃台在店面線上，阿桃站在後面；亭仔腳擺兩張小圓桌 */
  ice: {
    counterX: 2.3,
    counterZ: -4.55,
    counterW: 2.8,
    bingmom: { x: 2.3, z: -5.2 },
    tables: [0.6, 4.0],
    tableZ: -3.35,
  },
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

/** 放在很遠的地方：只拿來當「遮擋盒子」、不會被走進去的 inside */
export const NOWHERE = rect(900, 900, 900.1, 900.1)

/**
 * 一組可以走進去的店（DESIGN §30）：
 * lots 列出來的店，北邊那一整塊（店面線以後）不再整塊擋住，改由這裡的 rects 給牆、家具。
 * 還沒做室內的店不要列在 lots 裡（照舊整塊擋住）。
 */
export interface ShopInterior {
  lots: string[]
  rects: Rect[]
  circles: Circle[]
  /** 走進去就淡出＋鏡頭拉近（跟戲院大廳一樣） */
  buildings: Building[]
  rooms: { id: string; name: string; area: Rect }[]
  hotspots: Hotspot[]
  /** 站在店裡的 NPC 的碰撞圓（依時段） */
  npcs?: (phase: string) => Circle[]
}

export const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
export const isNight = (s: { phase: string }) => s.phase === 'night'

/** 規則檔不能直接 import store（Node 測試會載入），要改狀態時才動態載入 */
export function withStore(fn: (st: typeof import('../store').useStore) => void) {
  void import('../store').then(({ useStore }) => fn(useStore))
}
