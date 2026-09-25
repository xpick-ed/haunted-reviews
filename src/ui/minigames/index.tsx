import type { ComponentType } from 'react'
import { useStore } from '../../store'
import type { MinigameId, MinigameProps } from './types'
import Cook from './cook'
import Swat from './swat'
import Jiaobei from './jiaobei'
import Goldfish from './goldfish'
import Balloon from './balloon'

// 小遊戲登記表：id → 元件。新增小遊戲：在這裡加一行、在 types.ts 加 id。

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MINIGAMES: Record<MinigameId, ComponentType<MinigameProps<any, any>>> = {
  cook: Cook,
  swat: Swat,
  jiaobei: Jiaobei,
  goldfish: Goldfish,
  balloon: Balloon,
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
