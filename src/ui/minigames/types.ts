import type { Fortune, RecipeId } from '../../world/night/items'

// 小遊戲（DESIGN §25.2）：畫面上的覆蓋層。store.startMinigame(id, params, onDone) 開始，
// 元件玩完呼叫 done(result)（取消也要呼叫，result 用 null）。

export type MinigameId =
  | 'cook'
  | 'swat'
  | 'jiaobei'
  | 'goldfish'
  | 'balloon'
  // 第二批（DESIGN §26）
  | 'fishing'
  | 'lantern'
  | 'rhythm'
  | 'claw'
  | 'pachinko'
  | 'zongzi'
  | 'hopscotch'
  | 'ouija'

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

// ---------------------------------------------------------------------------
// 第二批（DESIGN §26）
// ---------------------------------------------------------------------------

/** 釣溪哥：釣到幾條（每條是一份「溪哥」食材）；0 也要回傳 */
export interface FishingResult {
  fish: number
}

/** 放水燈：燈漂得多遠多穩（0..1）；越好功德越多 */
export interface LanternResult {
  score: number
}

/** 歌仔戲鑼鼓：打中的比例 0..1 */
export interface RhythmResult {
  accuracy: number
}

/** 夾娃娃機：夾到的玩具（null＝沒夾到）；可以送給小宇 */
export interface ClawResult {
  prize: string | null
  coins: number
}

/** 彈珠台：贏到的功德 */
export type PachinkoResult = PrizeResult

/** 包粽子：包了幾顆、包得好不好 0..1 */
export interface ZongziResult {
  count: number
  quality: number
}

/** 跳房子：跳完幾格、有沒有踩線；小孩鬼的好感 */
export interface HopscotchResult {
  score: number
}

/** 碟仙：阿凱的問題怎麼回答（comfort 安慰、scare 嚇他、secret 說出只有鬼才知道的事）；null＝沒推 */
export interface OuijaParams {
  guest: string
}
export type OuijaResult = { comfort: number; scare: number; secret: number } | null
