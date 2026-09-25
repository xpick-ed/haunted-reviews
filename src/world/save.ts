import type { SceneId } from './scenes'

// 存檔：localStorage。槽 0 是自動存檔，1–3 之後給手動存檔（DESIGN §23）。
// 只在傍晚存（深夜是一局，中途離開就從那晚的傍晚重來）。

export interface SaveData {
  v: 1
  savedAt: number
  scene: SceneId
  x: number
  z: number
  nightCount: number
  yin: number
  flags: Record<string, boolean>
}

const key = (slot: number) => `haunted-reviews.save.${slot}`

export function writeSave(data: Omit<SaveData, 'v' | 'savedAt'>, slot = 0) {
  try {
    localStorage.setItem(key(slot), JSON.stringify({ ...data, v: 1, savedAt: Date.now() }))
  } catch {
    // 無痕模式或空間滿了：存不了就算了，遊戲照玩
  }
}

export function readSave(slot = 0): SaveData | null {
  try {
    const raw = localStorage.getItem(key(slot))
    if (!raw) return null
    const d = JSON.parse(raw) as SaveData
    return d.v === 1 ? d : null
  } catch {
    return null
  }
}

export function clearSave(slot = 0) {
  try {
    localStorage.removeItem(key(slot))
  } catch {
    // 忽略
  }
}
