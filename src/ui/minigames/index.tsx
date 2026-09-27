import { Suspense, lazy, type ComponentType } from 'react'
import { useStore } from '../../store'
import type { MinigameId, MinigameProps } from './types'

// 小遊戲登記表：id → 元件。新增小遊戲：在這裡加一行、在 types.ts 加 id。
// 用到才載入（DESIGN §33.1）：第一次打開遊戲不用下載全部小遊戲
const Cook = lazy(() => import('./cook'))
const Swat = lazy(() => import('./swat'))
const Jiaobei = lazy(() => import('./jiaobei'))
const Goldfish = lazy(() => import('./goldfish'))
const Balloon = lazy(() => import('./balloon'))
const Fishing = lazy(() => import('./fishing'))
const Lantern = lazy(() => import('./lantern'))
const Rhythm = lazy(() => import('./rhythm'))
const Claw = lazy(() => import('./claw'))
const Pachinko = lazy(() => import('./pachinko'))
const Zongzi = lazy(() => import('./zongzi'))
const Hopscotch = lazy(() => import('./hopscotch'))
const Ouija = lazy(() => import('./ouija'))
const Train = lazy(() => import('./train'))
const Shaveice = lazy(() => import('./shaveice'))
const Cinema = lazy(() => import('./cinema'))
const Photo = lazy(() => import('./photo'))
const Crab = lazy(() => import('./crab'))
const Fuse = lazy(() => import('./fuse'))
const Drinking = lazy(() => import('./drinking'))
const Mahjong = lazy(() => import('./mahjong'))
const Herbs = lazy(() => import('./herbs'))
const Sew = lazy(() => import('./sew'))
const Bargain = lazy(() => import('./bargain'))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MINIGAMES: Record<MinigameId, ComponentType<MinigameProps<any, any>>> = {
  cook: Cook,
  swat: Swat,
  jiaobei: Jiaobei,
  goldfish: Goldfish,
  balloon: Balloon,
  fishing: Fishing,
  lantern: Lantern,
  rhythm: Rhythm,
  claw: Claw,
  pachinko: Pachinko,
  zongzi: Zongzi,
  hopscotch: Hopscotch,
  ouija: Ouija,
  train: Train,
  shaveice: Shaveice,
  cinema: Cinema,
  photo: Photo,
  crab: Crab,
  fuse: Fuse,
  drinking: Drinking,
  mahjong: Mahjong,
  herbs: Herbs,
  sew: Sew,
  bargain: Bargain,
}

/** HUD 上的覆蓋層 */
export function MinigameHost() {
  const mg = useStore((s) => s.minigame)
  const finish = useStore((s) => s.finishMinigame)
  if (!mg) return null
  const Game = MINIGAMES[mg.id]
  return (
    <div className="mg-backdrop">
      <Suspense fallback={<div style={{ color: '#f4e6c8', fontSize: 16, padding: 24 }}>準備中……</div>}>
        <Game key={mg.key} params={mg.params} done={finish} />
      </Suspense>
    </div>
  )
}
