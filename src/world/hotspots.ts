import type { GameState } from '../store'
import { BED, DRESSER, HAN_SWEEP, SEWING, SINK, STOVE, TEA_SEAT } from '../scene/layout'
import { SPOTS, TEMPLE, type SceneId } from './scenes'

// 可以互動的地點（DESIGN §6：動作是空間的，走到床邊才能蓋被子）。
// 靠近時動作鍵顯示 label；label 回傳 null 表示現在不能用。

export interface Hotspot {
  id: string
  scene: SceneId
  x: number
  z: number
  r: number
  /** 提示光點的位置（預設在熱點上；放在物件本身上面比較清楚） */
  icon?: { x: number; z: number }
  /** 提示光點的高度 */
  iconY: number
  label: (s: GameState) => string | null
  cost?: (s: GameState) => number
  run: (s: GameState) => void
}

export const HOTSPOTS: Hotspot[] = [
  // ---------- 阿春民宿 ----------
  {
    id: 'altar',
    scene: 'home',
    ...SPOTS.altar,
    r: 1.35,
    icon: { x: 0, z: SPOTS.altar.z - 2.2 }, iconY: 2.0,
    label: (s) => (s.flags.incense_today ? '上香（今天拜過了）' : '上香（陰氣 +10）'),
    run: (s) => s.incense('home'),
  },
  {
    id: 'xiaohan',
    scene: 'home',
    ...HAN_SWEEP,
    r: 1.6,
    iconY: 2.0,
    label: (s) => (s.phase === 'dusk' ? (s.flags.han_talk ? '看看小翰' : '靠近小翰') : null),
    run: (s) => s.startDialogue(s.flags.han_talk ? 'han_again' : 'han_dusk'),
  },
  {
    id: 'chair',
    scene: 'home',
    ...TEA_SEAT,
    r: 1.0,
    iconY: 1.3,
    label: (s) => (s.phase === 'dusk' ? '坐下等天黑' : s.phase === 'night' && s.time < 29 ? '打個盹（快轉一小時）' : null),
    run: (s) => s.sit(),
  },
  {
    id: 'bed',
    scene: 'home',
    ...SPOTS.bedside,
    r: 1.05,
    icon: { x: BED.x, z: BED.z }, iconY: 1.5,
    label: (s) => (s.phase === 'night' ? '蓋被子' : null),
    cost: () => 10,
    run: (s) => s.act('tuck'),
  },
  {
    id: 'fan',
    scene: 'home',
    ...SPOTS.fan,
    r: 0.85,
    icon: SPOTS.fanBody, iconY: 1.6,
    label: (s) => (s.phase === 'night' ? '調溫' : null),
    cost: () => 5,
    run: (s) => s.act('temp'),
  },
  {
    id: 'photo',
    scene: 'home',
    x: DRESSER.x + 0.75,
    z: DRESSER.z,
    r: 1.0,
    icon: { x: DRESSER.x, z: DRESSER.z }, iconY: 1.5,
    label: () => '看老照片',
    run: (s) => s.startDialogue('gm_photo'),
  },
  {
    id: 'stove',
    scene: 'home',
    x: STOVE.x + 1.05,
    z: STOVE.z,
    r: 1.1,
    icon: { x: STOVE.x, z: STOVE.z }, iconY: 1.5,
    label: () => '看看灶',
    run: (s) => s.bark('gm.stove'),
  },
  {
    id: 'mirror',
    scene: 'home',
    x: SINK.x - 0.7,
    z: SINK.z,
    r: 0.9,
    icon: { x: SINK.x, z: SINK.z }, iconY: 2.2,
    label: () => '照鏡子',
    run: (s) => s.bark('gm.mirror'),
  },
  {
    id: 'sewing',
    scene: 'home',
    x: SEWING.x,
    z: SEWING.z + 0.75,
    r: 0.9,
    icon: { x: SEWING.x, z: SEWING.z }, iconY: 1.4,
    label: () => '縫紉車',
    run: (s) => s.bark('gm.sewing'),
  },

  // ---------- 土地公廟 ----------
  {
    id: 'temple_burner',
    scene: 'temple',
    x: TEMPLE.burner.x,
    z: TEMPLE.burner.z + 0.2,
    r: 1.5,
    icon: { x: TEMPLE.burner.x, z: TEMPLE.burner.z }, iconY: 1.9,
    label: (s) => (s.flags.temple_today ? '上香（今天拜過了）' : '上香（陰氣 +25）'),
    run: (s) => s.incense('temple'),
  },
  {
    id: 'ayi',
    scene: 'temple',
    x: TEMPLE.bench.x,
    z: TEMPLE.bench.z + 0.8,
    r: 1.7,
    icon: { x: TEMPLE.bench.x + 0.2, z: TEMPLE.bench.z + 0.55 }, iconY: 2.1,
    label: () => '跟阿義說話',
    run: (s) => s.startDialogue(s.flags.ayi_met ? 'ayi_again' : 'ayi_1'),
  },
]

/** 目前最近、可以用的熱點 */
export function nearestHotspot(s: GameState, x: number, z: number): { h: Hotspot; label: string; cost: number } | null {
  let best: { h: Hotspot; label: string; cost: number } | null = null
  let bestD = Infinity
  for (const h of HOTSPOTS) {
    if (h.scene !== s.scene) continue
    const d = Math.hypot(h.x - x, h.z - z)
    if (d > h.r || d >= bestD) continue
    const label = h.label(s)
    if (!label) continue
    best = { h, label, cost: h.cost?.(s) ?? 0 }
    bestD = d
  }
  return best
}

/** 目標（HUD 左上角）。第二行是可選的提示。 */
export function objectives(s: GameState): { main: string | null; extra: string | null } {
  if (s.phase === 'dusk') {
    const extra = !s.flags.ayi_met ? '可選：出大門沿著路往東，去土地公廟看看' : null
    if (!s.flags.incense_today) return { main: '到神明廳上香（正身中間）', extra }
    if (!s.flags.han_talk && s.nightCount === 1) return { main: '去埕裡看看小翰', extra }
    return { main: '坐在埕裡的竹椅上，等客人入住', extra }
  }
  if (s.phase === 'night') {
    if (s.guest.state === 'asleep' && s.guest.sleepDepth === 0) return { main: '小美睡著了。去客房幫她蓋被子', extra: null }
    if (s.guest.state !== 'asleep') return { main: '小美住右邊的客房。等她睡著（24:00）再幫她蓋被子', extra: '竹椅可以打盹，快轉時間' }
    return { main: '讓小美一覺到天亮', extra: '竹椅可以打盹，快轉時間' }
  }
  return { main: null, extra: null }
}
