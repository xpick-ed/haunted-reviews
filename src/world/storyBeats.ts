import type { Hotspot } from './hotspots'

// 主線劇情的互動點（DESIGN §28.3）：第 6 晚傍晚在大門口偷聽陳董跟小翰說話……
// 這個檔案不能在最上面 import store（用 s.* 或 import('../store')）。

export const STORY_HOTSPOTS: Hotspot[] = []
