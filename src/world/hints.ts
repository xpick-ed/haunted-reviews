import type { GameState } from '../store'
import type { SceneId } from './scenes'

// 現在該做什麼（DESIGN §33）：依狀態挑一個最重要的下一步，給 HUD 的提示條與場景裡的箭頭。
// 純函式（Node 測試可以跑），不能 import store／audio。

export interface Hint {
  /** 提示條上的字 */
  text: string
  /** 目標在哪裡（箭頭指過去；在別的場景時指向往那邊的出口） */
  target?: { scene: SceneId; x: number; z: number }
}

export function currentHint(s: GameState): Hint | null {
  void s
  return null
}
