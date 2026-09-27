import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { create } from 'zustand'
import { SCENES, type SceneId } from '../world/scenes'

// 場景的畫面用到才載入（DESIGN §33.1）：第一次打開只下載家裡；其他場景在換場景的黑幕期間才抓，
// 抓完之前黑幕不掀開（Blackout 看 useSceneLoading）。走到一個場景後，閒下來就先抓隔壁的場景。

type Loader = () => Promise<{ default: ComponentType }>

const LOADERS: Partial<Record<SceneId, Loader>> = {
  temple: () => import('./Temple').then((m) => ({ default: m.TempleScene })),
  village: () => import('./Village').then((m) => ({ default: m.VillageScene })),
  garden: () => import('./Garden').then((m) => ({ default: m.GardenScene })),
  market: () => import('./Market').then((m) => ({ default: m.MarketScene })),
  dream: () => import('./Dream').then((m) => ({ default: m.DreamScene })),
  river: () => import('./River').then((m) => ({ default: m.RiverScene })),
  school: () => import('./School').then((m) => ({ default: m.SchoolScene })),
  hill: () => import('./Hill').then((m) => ({ default: m.HillScene })),
  station: () => import('./Station').then((m) => ({ default: m.StationScene })),
  oldstreet: () => import('./OldStreet').then((m) => ({ default: m.OldStreetScene })),
  harbor: () => import('./Harbor').then((m) => ({ default: m.HarborScene })),
  dmarket: () => import('./DuskMarket').then((m) => ({ default: m.DuskMarketScene })),
  chenghuang: () => import('./Chenghuang').then((m) => ({ default: m.ChenghuangScene })),
  sugar: () => import('./Sugar').then((m) => ({ default: m.SugarScene })),
  ghosttrain: () => import('./GhostTrain').then((m) => ({ default: m.GhostTrainScene })),
  lighthouse: () => import('./Lighthouse').then((m) => ({ default: m.LighthouseScene })),
  past: () => import('./Past').then((m) => ({ default: m.PastScene })),
}

const started = new Map<SceneId, Promise<{ default: ComponentType }>>()

/** 先把某個場景的程式抓下來（換場景前、閒的時候呼叫；重複呼叫沒關係） */
export function preloadScene(id: SceneId) {
  const load = LOADERS[id]
  if (!load) return null
  let p = started.get(id)
  if (!p) {
    p = load()
    // 網路斷了：下次再試
    p.catch(() => started.delete(id))
    started.set(id, p)
  }
  return p
}

export const LAZY_SCENES = Object.fromEntries(
  (Object.keys(LOADERS) as SceneId[]).map((id) => [id, lazy(() => preloadScene(id)!)]),
) as Partial<Record<SceneId, LazyExoticComponent<ComponentType>>>

/** 載入失敗（斷線）：丟掉失敗的結果，下次再去那個場景時重新抓 */
export function resetScene(id: SceneId) {
  started.delete(id)
  if (LOADERS[id]) LAZY_SCENES[id] = lazy(() => preloadScene(id)!)
}

/** 閒下來時先抓這個場景出口通往的場景 */
export function prefetchNeighbours(id: SceneId) {
  const next = new Set(SCENES[id].exits.map((e) => e.to))
  // 車站：五分車去糖廠、半夜的鬼火車；海邊：燈塔（都是熱點，不是出口）
  if (id === 'station') next.add('sugar').add('ghosttrain')
  if (id === 'harbor') next.add('lighthouse')
  const idle = (cb: () => void) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 1500))
  for (const n of next) idle(() => void preloadScene(n))
}

/** 場景的程式還在下載（黑幕不要掀開） */
export const useSceneLoading = create<{ loading: boolean }>(() => ({ loading: false }))
