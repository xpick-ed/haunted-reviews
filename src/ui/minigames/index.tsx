import type { ComponentType } from 'react'
import { useStore } from '../../store'
import type { MinigameId, MinigameProps } from './types'
import Cook from './cook'
import Swat from './swat'
import Jiaobei from './jiaobei'
import Goldfish from './goldfish'
import Balloon from './balloon'
import Fishing from './fishing'
import Lantern from './lantern'
import Rhythm from './rhythm'
import Claw from './claw'
import Pachinko from './pachinko'
import Zongzi from './zongzi'
import Hopscotch from './hopscotch'
import Ouija from './ouija'
import Train from './train'
import Shaveice from './shaveice'
import Cinema from './cinema'
import Photo from './photo'
import Crab from './crab'
import Fuse from './fuse'
import Drinking from './drinking'
import Mahjong from './mahjong'

// 小遊戲登記表：id → 元件。新增小遊戲：在這裡加一行、在 types.ts 加 id。

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
}

/** HUD 上的覆蓋層 */
export function MinigameHost() {
  const mg = useStore((s) => s.minigame)
  const finish = useStore((s) => s.finishMinigame)
  if (!mg) return null
  const Game = MINIGAMES[mg.id]
  return (
    <div className="mg-backdrop">
      <Game key={mg.key} params={mg.params} done={finish} />
    </div>
  )
}
