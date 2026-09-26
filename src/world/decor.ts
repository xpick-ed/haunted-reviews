import { create } from 'zustand'
import type { Circle } from './collision'
import type { Hotspot } from './hotspots'
import { decorHooks, type DecorPlacement } from './night/director'
import { UNPLACED, decorBonus, decorCirclesOf, isPlaced, itemById, snapPlacement, type Snapped } from './decorCatalog'
import { useStore, type GameState } from '../store'
import { player } from './player'

// 裝修民宿（DESIGN §27.2）：傍晚在埕角的雜物堆「整理民宿」→ 買家具擺飾、自己擺在屋裡或埕上。
// 目錄、效果、擺放規則在 decorCatalog.ts（純資料，Node 也能跑）；畫面在 scene/Decor.tsx、HUD 在 ui/DecorHud.tsx。
//
// 存檔（meta.decor）：擺好的東西是一般的 DecorPlacement；買了還沒擺的也放在裡面，x = z = UNPLACED、room: null。

export { DECOR_ITEMS, decorSummary, itemById, placedOnly } from './decorCatalog'

/** 雜物堆（整理民宿的熱點）：埕的東南角 */
export const DECOR_PILE = { x: 4.9, z: 5.3 }

// 模擬用的加成：NightSim 開夜時會拿 meta.decor 來算
decorHooks.bonus = (decor) => decorBonus(decor)

/** 擺好的東西的碰撞圓（World.tsx 把它們加進家裡的碰撞） */
export function decorCircles(decor: DecorPlacement[]): Circle[] {
  return decorCirclesOf(decor)
}

// ---------------------------------------------------------------------------
// 擺放模式的狀態（只在畫面上用，不存檔）
// ---------------------------------------------------------------------------

export interface DecorUI {
  /** 目錄開著 */
  open: boolean
  tab: 'buy' | 'place'
  /** 擺放模式：正在擺的東西（null＝「整理」：點擺好的東西把它拿起來） */
  placing: boolean
  held: string | null
  /** 拿起來的東西原本的樣子（取消時放回去） */
  heldFrom: DecorPlacement | null
  /** 預覽的位置（已經吸附、檢查過） */
  preview: Snapped | null
  /** 玩家轉的方向（地上的東西） */
  rot: number
  /** 最後一次用滑鼠／手指指地板的時間；太久沒指就改成放在阿嬤前面 */
  pointedAt: number
  pointX: number
  pointZ: number
}

export const useDecor = create<DecorUI>(() => ({
  open: false,
  tab: 'buy',
  placing: false,
  held: null,
  heldFrom: null,
  preview: null,
  rot: 0,
  pointedAt: 0,
  pointX: 0,
  pointZ: 0,
}))

const setMetaDecor = (decor: DecorPlacement[]) => useStore.setState((s) => ({ meta: { ...s.meta, decor } }))
const bark = (id: string) => useStore.getState().bark(id)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

export const decorActions = {
  openCatalog(tab: 'buy' | 'place' = 'buy') {
    useDecor.setState({ open: true, tab, placing: false })
  },
  close() {
    decorActions.cancelHeld()
    useDecor.setState({ open: false, placing: false, held: null, preview: null })
  },

  /** 買一樣：扣錢，放進「還沒擺」 */
  buy(itemId: string) {
    const it = itemById(itemId)
    const s = useStore.getState()
    if (!it || s.meta.money < it.price) return false
    useStore.setState({ meta: { ...s.meta, money: s.meta.money - it.price, decor: [...s.meta.decor, { item: itemId, x: UNPLACED, z: UNPLACED, rot: 0, room: null }] } })
    bark(pick(['decor.buy.1', 'decor.buy.2']))
    return true
  },

  /** 還沒擺的數量 */
  unplacedCount(itemId: string, decor = useStore.getState().meta.decor) {
    return decor.filter((d) => d.item === itemId && !isPlaced(d)).length
  },

  /** 拿一個還沒擺的出來擺（held＝null 是「整理模式」：點擺好的東西拿起來） */
  startPlacing(itemId: string | null) {
    useDecor.setState({ open: false, placing: true, held: itemId, heldFrom: null, preview: null, pointedAt: 0 })
    if (itemId) bark('decor.hold')
  },

  rotate() {
    useDecor.setState((u) => ({ rot: (u.rot + Math.PI / 4) % (Math.PI * 2) }))
  },

  /** 把拿著的東西擺在預覽的位置 */
  place() {
    const u = useDecor.getState()
    const p = u.preview
    if (!u.held || !p) return false
    if (!p.ok) {
      bark('decor.bad')
      return false
    }
    const decor = [...useStore.getState().meta.decor]
    // 換掉一個「還沒擺」的（從架上拿起來的東西，取消時已經先變回還沒擺）
    const i = decor.findIndex((d) => d.item === u.held && !isPlaced(d))
    if (i < 0) return false
    decor[i] = { item: u.held, x: p.x, z: p.z, rot: p.rot, room: p.room }
    setMetaDecor(decor)
    const lineByItem: Record<string, string> = { doll: 'decor.doll', net: 'decor.net', lanterns: 'decor.lanterns', windchime: 'decor.windchime', photowall: 'decor.photowall' }
    bark(lineByItem[u.held] ?? pick(['decor.place.1', 'decor.place.2', 'decor.place.3']))
    // 還有同樣的就繼續拿著，沒有就回到整理模式
    const more = decor.some((d) => d.item === u.held && !isPlaced(d))
    useDecor.setState({ held: more ? u.held : null, heldFrom: null })
    return true
  },

  /** 整理模式：把最靠近 (x, z) 的擺設拿起來 */
  pickUpNear(x: number, z: number) {
    const u = useDecor.getState()
    if (u.held) return false
    const decor = [...useStore.getState().meta.decor]
    let best = -1
    let bestD = 0.75
    decor.forEach((d, i) => {
      if (!isPlaced(d)) return
      const dd = Math.hypot(d.x - x, d.z - z)
      if (dd < bestD) {
        bestD = dd
        best = i
      }
    })
    if (best < 0) return false
    const from = decor[best]
    decor[best] = { ...from, x: UNPLACED, z: UNPLACED, room: null }
    setMetaDecor(decor)
    useDecor.setState({ held: from.item, heldFrom: from, rot: itemById(from.item)?.kind === 'floor' ? from.rot : 0 })
    bark('decor.pickup')
    return true
  },

  /** 拿著的東西收回去（從地上拿起來的就放回原位） */
  cancelHeld() {
    const u = useDecor.getState()
    if (u.held && u.heldFrom) {
      const decor = [...useStore.getState().meta.decor]
      const i = decor.findIndex((d) => d.item === u.held && !isPlaced(d))
      if (i >= 0) decor[i] = u.heldFrom
      setMetaDecor(decor)
    }
    useDecor.setState({ held: null, heldFrom: null, preview: null })
  },

  /** 拿著的東西收進倉庫（不放回原位） */
  store() {
    useDecor.setState({ held: null, heldFrom: null, preview: null })
    bark('decor.store')
  },

  /** 結束擺放，回到目錄 */
  finish() {
    decorActions.cancelHeld()
    useDecor.setState({ placing: false, open: true, tab: 'place' })
  },
}

/** 阿嬤最後面向的方向（預覽放在她前面） */
let lastHeading = 0.7

/**
 * 每幀更新預覽的位置：滑鼠／手指最近指過地板就用那裡，不然放在阿嬤前面一公尺。
 * （Decor.tsx 呼叫；拿著東西時才有預覽）
 */
export function updatePreview() {
  const u = useDecor.getState()
  if (!u.placing || !u.held) {
    if (u.preview) useDecor.setState({ preview: null })
    return
  }
  let x = u.pointX
  let z = u.pointZ
  if (player.wantX || player.wantZ) lastHeading = Math.atan2(player.wantX, player.wantZ)
  if (performance.now() - u.pointedAt > 2500) {
    x = player.x + Math.sin(lastHeading) * 1.1
    z = player.z + Math.cos(lastHeading) * 1.1
  }
  const p = snapPlacement(u.held, x, z, u.rot, useStore.getState().meta.decor)
  const q = u.preview
  if (!q || Math.abs(q.x - p.x) > 1e-3 || Math.abs(q.z - p.z) > 1e-3 || q.rot !== p.rot || q.ok !== p.ok) useDecor.setState({ preview: p })
}

// ---------------------------------------------------------------------------
// 熱點：埕角的雜物堆（傍晚才能整理，晚上擺東西會吵醒客人）
// ---------------------------------------------------------------------------

export const DECOR_HOTSPOTS: Hotspot[] = [
  {
    id: 'decor_pile',
    scene: 'home',
    x: DECOR_PILE.x - 0.9,
    z: DECOR_PILE.z - 0.4,
    r: 1.5,
    icon: { x: DECOR_PILE.x, z: DECOR_PILE.z },
    iconY: 1.4,
    label: (s: GameState) => (s.phase === 'dusk' ? '整理民宿（擺設）' : null),
    run: (s: GameState) => {
      s.bark(s.meta.decor.length ? 'decor.open.again' : 'decor.open')
      decorActions.openCatalog(s.meta.decor.some((d) => !isPlaced(d)) ? 'place' : 'buy')
    },
  },
]

// 開發時掛到 window，自動化測試可以直接操作（window.__decor）
if (import.meta.env.DEV) {
  void import('./decorCatalog').then((cat) => {
    ;(window as unknown as { __decor: unknown }).__decor = { useDecor, decorActions, updatePreview, ...cat }
  })
}
