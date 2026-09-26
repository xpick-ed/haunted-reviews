import type { Circle, Rect } from './collision'
import type { Hotspot } from './hotspots'

// 廟埕野台戲（DESIGN §26.1）：土地公廟前的歌仔戲台。平常只有竹架子，節日（festivalOf）晚上才開演。
// 這些碰撞會併進土地公廟的場景；畫面在 src/scene/Stage.tsx（掛在 Temple.tsx 裡）。
// 這個檔案會被 Node 測試載入，不能 import store／audio。

export const STAGE_RECTS: Rect[] = []
export const STAGE_CIRCLES: Circle[] = []
export const STAGE_HOTSPOTS: Hotspot[] = []
