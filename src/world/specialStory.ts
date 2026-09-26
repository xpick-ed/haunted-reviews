import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import { DIALOGUES, type Dialogue } from './dialogues'
import { GUEST_ROOMS } from '../scene/layout'
import { CANDLES, HUM_SPOT, SHUTTER, TYPHOON, ghostNightNow, typhoonNow } from './night/special'

// 特別的夜晚的互動點與對話（DESIGN §31.3）：颱風夜放水桶、扣窗板、點蠟燭、哼歌；鬼客人夜請好兄弟等客人睡了再出門、當秋月的觀眾、點香。
// 這個檔案不能在最上面 import store（用 s.*）。邏輯在 night/special.ts。

// ---------------------------------------------------------------------------
// 對話：跟好兄弟聊天（director 的 chat 動作用 chatDialogueFor() 挑）
// ---------------------------------------------------------------------------

const seq = (prefix: string, n: number, last?: string): Dialogue => ({
  steps: Array.from({ length: n }, (_, i) => ({ line: `${prefix}.${i + 1}`, ...(i === n - 1 && last ? { set: last } : {}) })),
})

export const SPECIAL_DIALOGUES: Record<string, Dialogue> = {
  sp_chat_old: seq('sp.chat.old', 8, 'sp_met_shuimu'),
  sp_chat_soldier: seq('sp.chat.soldier', 8, 'sp_met_soldier'),
  sp_chat_opera: seq('sp.chat.opera', 7, 'sp_met_opera'),
}
Object.assign(DIALOGUES, SPECIAL_DIALOGUES)

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

const night = (s: GameState) => s.phase === 'night'
/** 陰氣夠不夠；夠就扣掉 */
function pay(s: GameState, cost: number) {
  if (s.yin < cost) {
    s.say('陰氣不夠了……')
    return false
  }
  if (cost > 0) s.spendYin(cost)
  return true
}

const BUCKET_COST = 3
const HUM_COST = 6
const INCENSE_COST = 5

/** 第 i 個漏水的地方（位置跟著今晚抽到的點） */
function leakSpot(i: number): Hotspot {
  return {
    id: `special.leak.${i}`,
    scene: 'home',
    get x() {
      return typhoonNow()?.leaks[i]?.x ?? 1e4
    },
    get z() {
      return typhoonNow()?.leaks[i]?.z ?? 1e4
    },
    r: 1.25,
    iconY: 1.2,
    label: (s) => (night(s) && typhoonNow()?.canBucket(i) ? '放水桶接漏水' : null),
    cost: () => BUCKET_COST,
    run: (s) => {
      const t = typhoonNow()
      if (!t?.canBucket(i) || !pay(s, BUCKET_COST)) return
      const seen = t.placeBucket(i)
      s.bark(seen ? 'sp.gm.bucket.seen' : 'sp.gm.bucket')
    },
  }
}

export const SPECIAL_HOTSPOTS: Hotspot[] = [
  // ---------- 颱風夜 ----------
  ...TYPHOON.leaks.map((_, i) => leakSpot(i)),
  {
    id: 'special.shutter',
    scene: 'home',
    x: SHUTTER.stand[0],
    z: SHUTTER.stand[1],
    r: 1.3,
    icon: { x: SHUTTER.x - 0.1, z: SHUTTER.z },
    iconY: 2.2,
    label: (s) => (night(s) && typhoonNow()?.shutter.banging ? '把拍打的窗板扣好' : null),
    run: (s) => {
      const t = typhoonNow()
      if (!t?.shutter.banging) return
      const seen = t.closeShutter()
      s.bark(seen ? 'sp.gm.shutter.seen' : 'sp.gm.shutter.done')
    },
  },
  {
    id: 'special.candles',
    scene: 'home',
    x: CANDLES.stand[0],
    z: CANDLES.stand[1],
    r: 1.2,
    icon: { x: CANDLES.x, z: CANDLES.z },
    iconY: 1.9,
    label: (s) => (night(s) && typhoonNow()?.canRelight ? '重新點亮神明桌的蠟燭' : null),
    run: (s) => {
      const t = typhoonNow()
      if (!t?.canRelight) return
      const seen = t.relight()
      s.bark(seen ? 'sp.gm.candles.seen' : 'sp.gm.candles.lit')
    },
  },
  {
    id: 'special.hum',
    scene: 'home',
    x: HUM_SPOT[0],
    z: HUM_SPOT[1],
    r: 1.1,
    iconY: 2.1,
    label: (s) => (night(s) && typhoonNow()?.canHum ? '躲在門後哼歌，安撫大家' : null),
    cost: () => HUM_COST,
    run: (s) => {
      const t = typhoonNow()
      if (!t?.canHum || !pay(s, HUM_COST)) return
      if (t.hum()) s.bark('sp.gm.hum')
    },
  },
  // ---------- 中元鬼客人夜 ----------
  {
    id: 'special.ghost.wait',
    scene: 'home',
    x: GUEST_ROOMS.r2.doorOut[0],
    z: GUEST_ROOMS.r2.doorOut[1],
    r: 1.3,
    icon: { x: GUEST_ROOMS.r2.doorOut[0], z: GUEST_ROOMS.r2.doorOut[1] },
    iconY: 2.4,
    label: (s) => {
      const g = ghostNightNow()
      if (!night(s) || !g?.pending) return null
      return g.living.some((l) => l.awake) ? '請好兄弟小心，別嚇到客人（客人還醒著）' : '請好兄弟小心，別嚇到客人'
    },
    run: (s) => {
      const g = ghostNightNow()
      const tr = g?.pending
      if (!g || !tr) return
      if (g.delay()) s.bark(`sp.${tr.who[0]}.wait`)
    },
  },
  {
    id: 'special.ghost.audience',
    scene: 'home',
    get x() {
      return ghostNightNow()?.singer?.x ?? 1e4
    },
    get z() {
      return (ghostNightNow()?.singer?.z ?? 1e4) + 0.9
    },
    r: 1.6,
    iconY: 2.3,
    label: (s) => {
      const g = ghostNightNow()
      return night(s) && g?.singer && !g.audience ? '坐下來當秋月的觀眾' : null
    },
    run: () => {
      ghostNightNow()?.listen()
    },
  },
  {
    id: 'special.ghost.incense',
    scene: 'home',
    x: CANDLES.stand[0],
    z: CANDLES.stand[1],
    r: 1.2,
    icon: { x: CANDLES.x, z: CANDLES.z - 0.9 },
    iconY: 2.0,
    label: (s) => (night(s) && ghostNightNow() && !ghostNightNow()!.incense ? '幫好兄弟點一炷香' : null),
    cost: () => INCENSE_COST,
    run: (s) => {
      const g = ghostNightNow()
      if (!g || g.incense || !pay(s, INCENSE_COST)) return
      g.burnIncense()
    },
  },
]
