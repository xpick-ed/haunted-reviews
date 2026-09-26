import type { Hotspot } from './hotspots'

// 店裡的東西晚上用得到（DESIGN §31.1）：安神茶、彈珠汽水、厚被、老照片……
// 這個檔案不能在最上面 import store（用 s.* 或 import('../store')）。

export const SHOP_GOODS_HOTSPOTS: Hotspot[] = []
