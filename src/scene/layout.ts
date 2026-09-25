// 三合院的平面配置。所有場景檔案共用這些數字，改這裡就好。
//
//          z 負（後）
//   ┌──────────── 正身 MAIN ────────────┐
//   │                                    │
//   │ 過水      步口廊（柱子）      過水 │
//   ├─ 左護龍 ─┐                ┌─ 右護龍 ─┤
//   │  WING_L  │     埕 YARD     │  WING_R  │  ← 客房在右護龍前半（z > WING_R.split）
//   │          │                │  BED     │
//   └──────────┘── 圍牆 ─ 門 ─ 圍牆 ──└──────────┘
//          z 正（前，鏡頭這一側）
//   ═══════════════ 鄉間小路 ROAD ═══════════════

/** 台基高度：室內地板與走廊的表面高度 */
export const FLOOR_Y = 0.42

export const MAIN = { x0: -7, x1: 7, z0: -8.5, z1: -3.5, ridgeY: 4.9 }
/** 正身前的步口廊：屋簷伸到這裡，柱子立在 porchZ */
export const MAIN_PORCH = { z1: -2.2, columnZ: -2.55, columnsX: [-5.4, -2.1, 2.1, 5.4] }

export const WING_R = { x0: 7, x1: 10, z0: -2.0, z1: 6, ridgeY: 4.05, split: 1.4 }
export const WING_L = { x0: -10, x1: -7, z0: -2.0, z1: 6, ridgeY: 4.05, split: 1.4 }
/** 護龍朝埕的走廊（屋簷往內伸） */
export const WING_PORCH = 0.9

export const YARD = { x0: -6.1, x1: 6.1, z0: -2.2, z1: 7.5 }
export const FENCE = { z: 7.7, gateHalf: 1.5, height: 1.25 }

/** 景觀（樹、田、草）不能放東西的範圍：房子、台基、圍牆都在裡面 */
export const COMPOUND = { x0: -11.3, x1: 11.3, z0: -9.8, z1: 8.3 }

/** 圍牆外、平行於 x 軸的鄉間小路 */
export const ROAD = { z: 11.2, width: 3.4 }

/** 客房的床。topY 是床墊表面高度；床頭在 z 小的那端 */
export const BED = { x: 8.5, z: 4.0, w: 1.5, l: 2.2, topY: FLOOR_Y + 0.55 }
export const PILLOW_Z = BED.z - BED.l / 2 + 0.3

/** 客房的門與窗（開在右護龍內牆 x = WING_R.x0 上，以及外牆 x = WING_R.x1 上） */
export const GUEST_DOOR_Z = 2.15
export const GUEST_WINDOW_IN_Z = 4.7
export const GUEST_WINDOW_OUT_Z = 4.0
