import type { Hotspot } from './hotspots'

// 跟小翰的陰陽溝通（DESIGN §31.2）：阿嬤用鬼的方式偷偷幫他，他慢慢感覺到「阿嬤還在」（meta.hanSense）。
// 這個檔案不能在最上面 import store（用 s.* 或 import('../store')）。

export const HAN_HOTSPOTS: Hotspot[] = []
