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

// ---------------------------------------------------------------------------
// 屋頂與牆高（House 用來蓋房子，world/ 用來算遮擋）
// ---------------------------------------------------------------------------

export const ROOF_SLOPE = 0.52
export const MAIN_RIDGE_Z = (MAIN.z0 + MAIN.z1) / 2
export const MAIN_WALL_TOP = MAIN.ridgeY - (MAIN.z1 - MAIN_RIDGE_Z) * ROOF_SLOPE
export const WING_WALL_TOP = WING_R.ridgeY - ((WING_R.x1 - WING_R.x0) / 2) * ROOF_SLOPE

// ---------------------------------------------------------------------------
// 房間（DESIGN §19：正身＝神明廳＋阿嬤的房間＋小翰的房間；右護龍＝客房＋浴廁；左護龍＝灶腳＋儲藏間）
// ---------------------------------------------------------------------------

/** 神明廳左右隔間的位置，與通往兩側房間的門 */
export const HALL_PART_X = 2.1
export const SIDE_DOOR_Z = -4.45
export const SIDE_DOOR_W = 1.0

export interface Area {
  x0: number
  z0: number
  x1: number
  z1: number
}

export const ROOMS: Record<string, { name: string; area: Area; building: 'main' | 'wingL' | 'wingR' }> = {
  altar: { name: '神明廳', area: { x0: -HALL_PART_X, z0: MAIN.z0, x1: HALL_PART_X, z1: MAIN.z1 }, building: 'main' },
  gm: { name: '阿嬤的房間', area: { x0: MAIN.x0, z0: MAIN.z0, x1: -HALL_PART_X, z1: MAIN.z1 }, building: 'main' },
  han: { name: '小翰的房間', area: { x0: HALL_PART_X, z0: MAIN.z0, x1: MAIN.x1, z1: MAIN.z1 }, building: 'main' },
  guest: { name: '客房', area: { x0: WING_R.x0, z0: WING_R.split, x1: WING_R.x1, z1: WING_R.z1 }, building: 'wingR' },
  bath: { name: '浴廁', area: { x0: WING_R.x0, z0: WING_R.z0, x1: WING_R.x1, z1: WING_R.split }, building: 'wingR' },
  kitchen: { name: '灶腳', area: { x0: WING_L.x0, z0: WING_L.split, x1: WING_L.x1, z1: WING_L.z1 }, building: 'wingL' },
  storage: { name: '客房二', area: { x0: WING_L.x0, z0: WING_L.z0, x1: WING_L.x1, z1: WING_L.split }, building: 'wingL' },
}

/** 護龍朝埕那面牆上的門（z）：後間與前間各一扇 */
export const WING_BACK_DOOR_Z = -0.3

// 家具位置（Interior 擺放、world/home 算碰撞，兩邊共用）
export const GM_BED = { x: -5.85, z: -7.3, w: 1.5, l: 2.0 }
export const SEWING = { x: -3.4, z: -8.0 }
export const DRESSER = { x: -6.5, z: -5.4 }
export const ROCKER = { x: -4.2, z: -6.0 }
export const HAN_BED = { x: 5.9, z: -7.35, w: 1.3, l: 1.95 }
export const HAN_DESK = { x: 6.5, z: -5.3 }
export const STOVE = { x: -9.3, z: 4.4 }
export const CUPBOARD = { x: -8.2, z: 5.55 }
export const KITCHEN_TABLE = { x: -8.25, z: 3.2 }
export const KITCHEN_JAR = { x: -9.35, z: 1.95 }
export const TOILET = { x: 9.45, z: 0.85 }
export const SINK = { x: 9.55, z: -1.25 }
export const BUCKET = { x: 8.35, z: 1.0 }
/** 埕裡的竹椅茶桌（阿嬤坐的那張椅子是 TEA_SEAT） */
export const TEA = { x: -3.6, z: -0.9 }
export const TEA_SEAT = { x: TEA.x - 0.75, z: TEA.z + 0.1 }
/** 傍晚小翰在埕裡掃地的位置 */
export const HAN_SWEEP = { x: 2.6, z: 1.8 }

// ---------------------------------------------------------------------------
// 客房（深夜玩法）：客房一在右護龍前間；客房二是左護龍後間（原本的儲藏間，第二晚起開放）
// ---------------------------------------------------------------------------

export interface BedDef {
  x: number
  z: number
  w: number
  l: number
  /** 床墊表面高度 */
  topY: number
}

type XZ = [number, number]

export interface GuestRoomDef {
  id: 'r1' | 'r2'
  name: string
  /** 對應 ROOMS 的 key */
  room: string
  bed: BedDef
  /** 枕頭中心的 z（床頭在 z 小的那端） */
  pillowZ: number
  /** 房門：門內一步、門外一步 */
  doorIn: XZ
  doorOut: XZ
  /** 阿嬤站著蓋被子／輕拍的位置 */
  bedside: XZ
  fan: XZ
  /** 天花板吊燈（小夜燈） */
  lamp: XZ
  /** 床頭櫃（水杯、宵夜放這裡） */
  nightstand: XZ
  /** 蚊香（地上） */
  coil: XZ
  /** 關窗的站位（沒有就是 null） */
  window: XZ | null
}

export const GUEST_ROOMS: Record<'r1' | 'r2', GuestRoomDef> = {
  r1: {
    id: 'r1',
    name: '客房一',
    room: 'guest',
    bed: BED,
    pillowZ: PILLOW_Z,
    doorIn: [WING_R.x0 + 0.5, GUEST_DOOR_Z],
    doorOut: [WING_R.x0 - 0.55, GUEST_DOOR_Z],
    bedside: [BED.x - BED.w / 2 - 0.45, BED.z + 0.1],
    fan: [WING_R.x0 + 0.5, BED.z + BED.l / 2 + 0.3],
    lamp: [BED.x - 0.3, BED.z - 0.2],
    nightstand: [WING_R.x1 - 0.42, BED.z - BED.l / 2 + 0.28],
    coil: [BED.x - 0.1, BED.z + BED.l / 2 + 0.45],
    window: [WING_R.x1 - 0.42, GUEST_WINDOW_OUT_Z],
  },
  r2: {
    id: 'r2',
    name: '客房二',
    room: 'storage',
    bed: { x: WING_L.x0 + 1.1, z: -0.35, w: 1.5, l: 2.2, topY: FLOOR_Y + 0.55 },
    pillowZ: -0.35 - 1.1 + 0.3,
    doorIn: [WING_L.x1 - 0.5, -0.3],
    doorOut: [WING_L.x1 + 0.55, -0.3],
    bedside: [WING_L.x1 - 0.55, -0.25],
    fan: [WING_L.x1 - 0.45, 1.0],
    lamp: [WING_L.x0 + 1.4, -0.5],
    nightstand: [WING_L.x1 - 0.45, -1.55],
    coil: [WING_L.x0 + 1.1, 1.05],
    window: null,
  },
}

/** 地基主（陰陽眼才看得到的守護靈）站的位置：灶腳前門邊 */
export const DIJIZHU = { x: -8.55, z: 5.45 }
