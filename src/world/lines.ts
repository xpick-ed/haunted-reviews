// 所有台詞與角色名稱。台詞在 src/data/*.lines.json（scripts/gen_voices.py 讀同一批檔案生成語音），
// 角色在 src/data/cast.json。用 glob 載入，檔案不存在也不會編譯失敗。

export interface Line {
  who: string
  text: string
}

const lineFiles = import.meta.glob<Record<string, Line>>('../data/*.lines.json', { eager: true, import: 'default' })
export const LINES: Record<string, Line> = Object.assign({}, ...Object.values(lineFiles))

interface CastEntry {
  id: string
  name: string
  ghost?: boolean
}
const castFiles = import.meta.glob<CastEntry[]>('../data/cast.json', { eager: true, import: 'default' })
const CAST: CastEntry[] = Object.values(castFiles)[0] ?? []

const FALLBACK_NAMES: Record<string, string> = {
  grandma: '阿春嬤',
  xiaohan: '小翰',
  xiaomei: '小美',
  agui: '阿桂',
  atu: '阿土伯',
  miaogong: '王伯',
  ayi: '阿義',
  acai: '阿財',
  xiaoyu: '小宇',
  medium: '林老師',
  akai: '阿凱',
  chendong: '陳董',
}

export function nameOf(who: string): string {
  return CAST.find((c) => c.id === who)?.name ?? FALLBACK_NAMES[who] ?? who
}

export function line(id: string): Line {
  return LINES[id] ?? { who: '', text: `（缺台詞 ${id}）` }
}

/** 看得到阿嬤的角色（DESIGN 賣點：你只能跟看得到你的人說話） */
export const SEES_GHOSTS = new Set(['ayi', 'acai', 'xiaoyu', 'medium', 'agui', 'atu'])
