import type { Fortune, RecipeId } from '../../world/night/items'

// 小遊戲（DESIGN §25.2）：畫面上的覆蓋層。store.startMinigame(id, params, onDone) 開始，
// 元件玩完呼叫 done(result)（取消也要呼叫，result 用 null）。

export type MinigameId = 'cook' | 'swat' | 'jiaobei' | 'goldfish' | 'balloon'

export interface MinigameProps<P = unknown, R = unknown> {
  params: P
  done: (result: R) => void
}

/** 煮宵夜：可以煮的食譜（食材夠的）；玩家選一個再玩時機小遊戲 */
export interface CookParams {
  recipes: RecipeId[]
}
/** quality 0..1（燒焦 0、完美 1）；null＝不煮了 */
export type CookResult = { recipe: RecipeId; quality: number } | null

/** 打蚊子：畫面上有幾隻、幾秒 */
export interface SwatParams {
  count: number
  seconds: number
}
export interface SwatResult {
  hits: number
  misses: number
}

/** 擲筊：今天還能擲幾次 */
export interface JiaobeiParams {
  throwsLeft: number
}
/** 擲到聖筊的話 fortune 是今晚的運勢；throws 是這次用掉幾次 */
export interface JiaobeiResult {
  fortune: Fortune | null
  throws: number
}

/** 夜市小遊戲：贏到的功德（0 也要回傳） */
export interface PrizeResult {
  merit: number
}
