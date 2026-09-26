import type { Hotspot } from './hotspots'

// 好感度＋送禮（DESIGN §27.2）：村民與鬼鄰居的好感度、喜歡的東西、每顆心的故事與回禮。
// 好感度存在 meta.bonds（0–100，每 20 一顆心）。送禮的熱點放在各 NPC 旁邊。

export const BOND_HOTSPOTS: Hotspot[] = []
