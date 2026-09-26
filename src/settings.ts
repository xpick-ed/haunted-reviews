import { create } from 'zustand'

// 設定（DESIGN §29）：存在 localStorage（跟存檔分開，重新開始也不會重設）。
// 成人內容預設關閉；恐怖程度預設普通。Node 測試裡沒有 localStorage，就用預設值。

export interface Settings {
  /** 成人內容（大人的恐怖、心事、幽默與夜生活） */
  adult: boolean
  /** 確認過已滿 18 歲 */
  adultConfirmed: boolean
  /** 恐怖程度 */
  horror: 'normal' | 'strong'
}

const KEY = 'haunted-reviews.settings'
const DEFAULTS: Settings = { adult: false, adultConfirmed: false, horror: 'normal' }

function load(): Settings {
  try {
    if (typeof localStorage === 'undefined') return DEFAULTS
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export const useSettings = create<Settings & { update: (p: Partial<Settings>) => void }>((set, get) => ({
  ...load(),
  update: (p) => {
    set(p)
    try {
      const { adult, adultConfirmed, horror } = get()
      localStorage.setItem(KEY, JSON.stringify({ adult, adultConfirmed, horror }))
    } catch {
      // 無痕模式：存不了就算了
    }
  },
}))

/** 成人內容開著嗎（客人、劇情、台詞都用這個判斷） */
export const adultOn = () => useSettings.getState().adult
/** 恐怖加強 */
export const horrorStrong = () => useSettings.getState().horror === 'strong'
