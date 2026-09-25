import { useStore, type GameState } from '../store'
import { FORTUNES } from './night/items'
import type { JiaobeiResult } from '../ui/minigames/types'
import { DRESSER, HAN_SWEEP, SEWING, SINK, STOVE, TEA_SEAT } from '../scene/layout'
import { SPOTS, TEMPLE, type SceneId } from './scenes'
import { VILLAGE_HOTSPOTS } from './sceneVillage'
import { GARDEN_HOTSPOTS } from './sceneGarden'
import { MARKET_HOTSPOTS } from './sceneMarket'

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

const BASE_HOTSPOTS: Hotspot[] = [
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
    // 深夜換成「煮宵夜」（world/night/actions.ts）
    label: (s) => (s.phase === 'night' ? null : '看看灶'),
    run: (s) => s.bark('gm.stove'),
  },
  {
    id: 'mirror',
    scene: 'home',
    x: SINK.x - 0.7,
    z: SINK.z,
    r: 0.9,
    icon: { x: SINK.x, z: SINK.z }, iconY: 2.2,
    label: (s) => (s.phase === 'night' ? null : '照鏡子'),
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
    // 擲筊（DESIGN §25.2）：傍晚才能擲，一天三次，聖筊得到今晚的運勢
    id: 'temple_jiaobei',
    scene: 'temple',
    x: 0.9,
    z: TEMPLE.hall.z0 + 1.6,
    r: 1.2,
    icon: { x: 0, z: TEMPLE.hall.z0 + 0.6 },
    iconY: 1.7,
    label: (s) => {
      if (s.phase !== 'dusk') return null
      if (s.meta.fortune) return `擲筊（今晚：${FORTUNES[s.meta.fortune].name}）`
      if (s.meta.jiaobei >= 3) return '擲筊（今天擲完了）'
      return `擲筊（問今晚運勢，剩 ${3 - s.meta.jiaobei} 次）`
    },
    run: (s) => {
      if (s.meta.fortune || s.meta.jiaobei >= 3) {
        s.bark(s.meta.fortune ? 'gm.jiaobei.yes' : 'gm.jiaobei.no')
        return
      }
      s.bark('gm.jiaobei.ask')
      s.startMinigame('jiaobei', { throwsLeft: 3 - s.meta.jiaobei }, (r) => {
        const res = (r as JiaobeiResult | null) ?? { fortune: null, throws: 0 }
        useStore.setState((x) => ({ meta: { ...x.meta, jiaobei: x.meta.jiaobei + res.throws, fortune: res.fortune ?? x.meta.fortune } }))
        if (res.throws > 0) useStore.getState().bark(res.fortune ? 'gm.jiaobei.yes' : 'gm.jiaobei.no')
      })
    },
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

/** 所有場景的熱點：新場景的熱點寫在各自的 scene<Name>.ts */
export const HOTSPOTS: Hotspot[] = [...BASE_HOTSPOTS, ...VILLAGE_HOTSPOTS, ...GARDEN_HOTSPOTS, ...MARKET_HOTSPOTS]

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

/** 目標（HUD 左上角）。第二行是提示。深夜的挑戰另外顯示。 */
export function objectives(s: GameState): { main: string | null; extra: string | null } {
  const n = s.meta.night
  if (s.phase === 'dusk') {
    const extra = !s.flags.ayi_met ? '可選：出大門沿著路往東，去土地公廟看看' : null
    if (!s.flags.incense_today) return { main: '到神明廳上香（正身中間）', extra }
    if (!s.flags.han_talk && n === 1) return { main: '去埕裡看看小翰', extra }
    return { main: '坐在埕裡的竹椅上，等客人入住', extra }
  }
  if (s.phase === 'night') {
    // 教學月：每晚提示一個新玩法
    const tips: Record<number, string> = {
      1: '被客人看著時「站著不動」就不會被發現（一二三木頭人）。靠近客人可以看到她需要什麼',
      2: '阿凱想被嚇、張經理怕吵：在阿凱附近做嚇人的事，但別吵醒隔壁',
      3: '小宇看得到阿嬤，想找妳玩——但別讓媽媽看到他對空氣講話',
      4: '颱風夜會停電。阿桂和阿土伯是老朋友，不怕妳',
    }
    return { main: '照顧好今晚的客人，一直到天亮', extra: tips[n] ?? '竹椅可以打盹，快轉時間' }
  }
  return { main: null, extra: null }
}
