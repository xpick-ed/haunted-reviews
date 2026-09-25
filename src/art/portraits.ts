// 對話框頭像：把全身立繪的 SVG 換成方形 viewBox，只露出頭跟肩膀。純函式，不依賴 three。

import { grandmaSvg, guestSvg } from './characters'
import { npcSvg, sparkle } from './npcs'

export const PORTRAIT_IDS = ['grandma', 'xiaomei', 'xiaohan', 'ayi', 'miaogong', 'agui', 'akai', 'zhang', 'ahao', 'xiaoyu', 'linmom', 'atu', 'ajiao', 'jinyubo', 'hongyi'] as const
export type PortraitId = (typeof PORTRAIT_IDS)[number]
export type PortraitMood = 'normal' | 'happy' | 'surprised'

/** 輸出的 SVG 寬高（px）；viewBox 另外決定裁切範圍 */
export const PORTRAIT_SIZE = 256

/** 每個角色的裁切框 [x, y, 邊長]（原圖座標） */
const CROP: Record<PortraitId, [number, number, number]> = {
  grandma: [30, 8, 186],
  xiaomei: [14, 26, 192],
  xiaohan: [34, 20, 172],
  ayi: [28, 26, 184],
  miaogong: [34, 28, 172],
  agui: [28, 36, 184],
  akai: [30, 22, 180],
  zhang: [32, 22, 176],
  ahao: [30, 22, 180],
  xiaoyu: [26, 36, 188],
  linmom: [32, 24, 176],
  atu: [30, 24, 180],
  ajiao: [28, 34, 184],
  jinyubo: [22, 24, 196],
  hongyi: [30, 30, 180],
}

const OUT = '#3b2a2a'

function crop(svg: string, [x, y, s]: [number, number, number]): string {
  return svg.replace(/<svg ([^>]*?)width="[\d.]+" height="[\d.]+" viewBox="[^"]*"/, `<svg $1width="${PORTRAIT_SIZE}" height="${PORTRAIT_SIZE}" viewBox="${x} ${y} ${s} ${s}"`)
}

/** 在 </svg> 前面塞東西 */
const append = (svg: string, extra: string) => svg.replace(/<\/svg>\s*$/, `${extra}</svg>`)

/** 用正規表示式找一段 path（依 d 屬性開頭），找不到就原樣返回 */
function swap(svg: string, dStart: string, replacement: string): string {
  const re = new RegExp(`<path d="${dStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[^>]*/>`)
  return re.test(svg) ? svg.replace(re, replacement) : svg
}

/** 阿嬤的表情：預設是瞇眼大笑；surprised 換成圓眼、O 嘴、挑眉；happy 加閃光 */
function grandmaMood(svg: string, mood: PortraitMood): string {
  if (mood === 'happy') {
    return append(svg, `${sparkle(44, 70, 1)}${sparkle(198, 86, 0.8)}${sparkle(190, 46, 0.6, '#fff4c2')}`)
  }
  if (mood === 'surprised') {
    let s = svg
    s = swap(s, 'M 85 129 Q 97 116 109 129', `<ellipse cx="97" cy="124" rx="7.5" ry="9" fill="${OUT}"/><circle cx="94.8" cy="120.6" r="2.6" fill="#fff"/>`)
    s = swap(s, 'M 131 129 Q 143 116 155 129', `<ellipse cx="143" cy="124" rx="7.5" ry="9" fill="${OUT}"/><circle cx="140.8" cy="120.6" r="2.6" fill="#fff"/>`)
    s = swap(s, 'M 85 110 Q 97 103 109 109', `<path d="M 85 104 Q 97 95 109 102" fill="none" stroke="#a9a19b" stroke-width="3.6" stroke-linecap="round"/>`)
    s = swap(s, 'M 131 109 Q 143 103 155 110', `<path d="M 131 102 Q 143 95 155 104" fill="none" stroke="#a9a19b" stroke-width="3.6" stroke-linecap="round"/>`)
    s = swap(s, 'M 106 152 Q 120 171 134 152', `<ellipse cx="120" cy="158" rx="6.5" ry="8" fill="#94393f" stroke="${OUT}" stroke-width="2.6"/>`)
    s = swap(s, 'M 112 162 Q 120 158 128 162', '')
    return s
  }
  return svg
}

/** 頭像 SVG（方形、透明底）。沒有對應表情的角色用 normal。 */
export function portraitSvg(id: PortraitId, mood: PortraitMood = 'normal'): string {
  switch (id) {
    case 'grandma':
      return crop(grandmaMood(grandmaSvg('idle'), mood), CROP.grandma)
    case 'xiaomei':
      return crop(guestSvg(mood === 'surprised' ? 'scared' : 'awake'), CROP.xiaomei)
    case 'xiaohan':
    case 'akai':
    case 'zhang':
    case 'ahao':
    case 'xiaoyu':
    case 'linmom':
    case 'atu':
    case 'ajiao':
    case 'jinyubo':
    case 'hongyi':
      return crop(npcSvg(id, 'idle', mood), CROP[id])
    default:
      return crop(npcSvg(id, 'idle'), CROP[id])
  }
}

/** 給 <img src> 用的 data URL */
export function portraitDataUrl(id: PortraitId, mood: PortraitMood = 'normal'): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(portraitSvg(id, mood))
}
