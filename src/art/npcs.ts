// 配角立繪（SVG 字串，全身站姿 240×360）。純函式、不依賴 three，方便在 node 裡輸出預覽圖。
// 風格跟 characters.ts 一樣：Q 版、賽璐璐上色加柔和漸層、暖深色描邊、光從左上來。

const OUT = '#3b2a2a'
const SW = 3

export const NPC_SIZE = { w: 240, h: 360 }

export type NpcId = 'xiaohan' | 'ayi' | 'miaogong' | 'agui'
export type NpcPose = 'idle' | 'sweep' | 'phone' | 'drink' | 'bow'
export type NpcMood = 'normal' | 'happy' | 'surprised'

export const NPC_IDS: readonly NpcId[] = ['xiaohan', 'ayi', 'miaogong', 'agui']

/** 每個角色有哪些姿勢（第一個是預設） */
export const NPC_POSES: Record<NpcId, readonly NpcPose[]> = {
  xiaohan: ['idle', 'sweep', 'phone'],
  ayi: ['idle', 'drink'],
  miaogong: ['idle', 'bow'],
  agui: ['idle'],
}

/** 鬼（不受光、半透明、飄著、沒有影子） */
export const NPC_GHOST: Record<NpcId, boolean> = { xiaohan: false, ayi: true, miaogong: false, agui: false }

/** 預設的世界高度（公尺） */
export const NPC_HEIGHT: Record<NpcId, number> = { xiaohan: 1.7, ayi: 1.7, miaogong: 1.7, agui: 1.55 }

export const NPC_NAMES: Record<NpcId, string> = { xiaohan: '小翰', ayi: '阿義', miaogong: '王伯', agui: '阿桂' }

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`

/** 左右鏡射一段路徑的 x 座標（只處理絕對座標指令，這裡的路徑都這樣寫） */
function mirrorPath(d: string, cx: number): string {
  let i = 0
  return d.replace(/-?\d+(\.\d+)?/g, (n) => {
    const out = i % 2 === 0 ? String(2 * cx - parseFloat(n)) : n
    i++
    return out
  })
}

const lin = (id: string, a: string, b: string, x2 = 1, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`

/** 右側暗面（漸層透明度），疊在衣服上 */
const shadeGrad = (id: string, color: string, amt = 0.34) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0.35"><stop offset="0.5" stop-color="${color}" stop-opacity="0"/><stop offset="1" stop-color="${color}" stop-opacity="${amt}"/></linearGradient>`

/** 布料：底色 + 可選的花紋 + 暗面 + 描邊 */
function cloth(d: string, fill: string, shade?: string, pattern?: string, sw = SW): string {
  return `<path d="${d}" fill="${fill}"/>${pattern ? `<path d="${d}" fill="${pattern}"/>` : ''}${shade ? `<path d="${d}" fill="${shade}"/>` : ''}<path d="${d}" fill="none" stroke="${OUT}" stroke-width="${sw}" stroke-linejoin="round"/>`
}

function skin(d: string, p: string, stroke = OUT): string {
  return `<path d="${d}" fill="url(#${p}Skin)" stroke="${stroke}" stroke-width="${SW}" stroke-linejoin="round"/>`
}

/** 頭：暗色底 + 往左上偏移的亮色圓（裁在頭裡） + 高光 + 描邊 */
function headBase(p: string, x: number, y: number, r: number, base: string): string {
  return `
    <circle cx="${x}" cy="${y}" r="${r}" fill="${base}"/>
    <g clip-path="url(#${p}HeadClip)">
      <circle cx="${x - 8}" cy="${y - 8}" r="${r - 1}" fill="url(#${p}Skin)"/>
      <ellipse cx="${x - 24}" cy="${y - 22}" rx="15" ry="9" fill="#fff" opacity="0.26"/>
    </g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${OUT}" stroke-width="${SW}"/>`
}

function ears(p: string, lx: number, rx: number, y: number, inner: string): string {
  return `
    <ellipse cx="${lx}" cy="${y}" rx="8.5" ry="12.5" fill="url(#${p}Skin)" stroke="${OUT}" stroke-width="${SW}"/>
    <path d="M ${lx + 2} ${y - 6} Q ${lx - 3} ${y} ${lx + 2} ${y + 7}" fill="none" stroke="${inner}" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="${rx}" cy="${y}" rx="8.5" ry="12.5" fill="url(#${p}SkinDark)" stroke="${OUT}" stroke-width="${SW}"/>
    <path d="M ${rx - 2} ${y - 6} Q ${rx + 3} ${y} ${rx - 2} ${y + 7}" fill="none" stroke="${inner}" stroke-width="2" stroke-linecap="round"/>`
}

/** 圓圓的拳頭／手 */
function fist(p: string, x: number, y: number, rx = 11, ry = 12, dark = false): string {
  return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${p}${dark ? 'SkinDark' : 'Skin'})" stroke="${OUT}" stroke-width="${SW}"/>`
}

const blush = (x: number, y: number, rx = 12, ry = 7, c = '#f58f98', o = 0.5) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" opacity="${o}"/>`

const sweat = (x: number, y: number, s = 1) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M 0 -10 C 5 -3, 8 2, 8 5 C 8 10, -8 10, -8 5 C -8 2, -5 -3, 0 -10 Z" fill="#a9ddff" stroke="${OUT}" stroke-width="2"/><circle transform="translate(${x} ${y}) scale(${s})" cx="-2.5" cy="3" r="1.8" fill="#fff"/>`

/** 四角星閃光 */
const sparkle = (x: number, y: number, s = 1, c = '#ffe27a') =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M 0 -10 Q 1.5 -1.5 10 0 Q 1.5 1.5 0 10 Q -1.5 1.5 -10 0 Q -1.5 -1.5 0 -10 Z" fill="${c}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>`

/** 圓點花紋 */
function flowerPattern(id: string, size: number, petal: string, center: string, r: number, extra = ''): string {
  const f = (cx: number, cy: number, rr: number, col: string, rot: number) =>
    `<g transform="translate(${cx} ${cy})">${[0, 72, 144, 216, 288]
      .map((a) => {
        const t = ((a + rot) * Math.PI) / 180
        return `<circle cx="${(Math.cos(t) * rr).toFixed(2)}" cy="${(Math.sin(t) * rr).toFixed(2)}" r="${(rr * 0.9).toFixed(2)}" fill="${col}"/>`
      })
      .join('')}<circle r="${(rr * 0.55).toFixed(2)}" fill="${center}"/></g>`
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${size}" height="${size}">
    ${f(size * 0.28, size * 0.3, r, petal, 0)}
    ${f(size * 0.78, size * 0.8, r * 0.75, petal, 36)}
    ${extra}
  </pattern>`
}

// ===========================================================================
// 小翰（孫子，26 歲）
// ===========================================================================

const XH_HEAD = { x: 120, y: 102, r: 56 }
const XH_BODY = 'M 94 160 Q 120 170 146 160 L 168 170 Q 180 176 182 194 L 184 256 Q 120 266 56 256 L 58 194 Q 60 176 72 170 Z'
const XH_SLEEVE = 'M 72 170 C 58 176, 50 192, 50 210 L 73 214 L 77 190 Z'

function xiaohanDefs(pose: NpcPose): string {
  return `<defs>
    ${lin('xhSkin', '#ffe4cc', '#eeb994')}
    ${lin('xhSkinDark', '#f6caa6', '#e0a47e')}
    ${lin('xhHair', '#3d3531', '#141111')}
    ${lin('xhShirt', '#9cc2e2', '#6892bd')}
    ${shadeGrad('xhShirtShade', '#1d3d63', 0.32)}
    ${lin('xhShorts', '#d8bb84', '#aa874d')}
    ${shadeGrad('xhShortsShade', '#5c3f16', 0.3)}
    ${lin('xhTowel', '#ffffff', '#d9e1ea')}
    ${lin('xhBroom', '#e1c77f', '#b89548')}
    <radialGradient id="xhGlow" gradientUnits="userSpaceOnUse" cx="100" cy="190" r="110">
      <stop offset="0" stop-color="#9fd6ff" stop-opacity="${pose === 'phone' ? 0.6 : 0}"/><stop offset="0.6" stop-color="#9fd6ff" stop-opacity="${pose === 'phone' ? 0.14 : 0}"/><stop offset="1" stop-color="#9fd6ff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="xhHeadClip"><circle cx="${XH_HEAD.x}" cy="${XH_HEAD.y}" r="${XH_HEAD.r}"/></clipPath>
  </defs>`
}

function xiaohanFace(mood: NpcMood, lookDown: boolean): string {
  const brows =
    mood === 'surprised'
      ? `<path d="M 85 94 Q 96 87 107 92 M 133 92 Q 144 87 155 94" fill="none" stroke="#2a2220" stroke-width="3.6" stroke-linecap="round"/>`
      : `<path d="M 85 101 Q 96 97 107 100 M 133 100 Q 144 97 155 101" fill="none" stroke="#2a2220" stroke-width="3.6" stroke-linecap="round"/>`
  let eyes: string
  let mouth: string
  if (mood === 'happy') {
    eyes = `<path d="M 88 121 Q 97 110 106 121 M 134 121 Q 143 110 152 121" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`
    mouth = `<path d="M 105 139 Q 120 156 135 139 Q 120 144 105 139 Z" fill="#94393f" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M 112 147 Q 120 144 128 147 Q 120 152 112 147 Z" fill="#ee8a8c"/>`
  } else if (mood === 'surprised') {
    eyes = `<ellipse cx="97" cy="117" rx="9.5" ry="11" fill="#fff" stroke="${OUT}" stroke-width="2.8"/><ellipse cx="143" cy="117" rx="9.5" ry="11" fill="#fff" stroke="${OUT}" stroke-width="2.8"/>
      <circle cx="97" cy="118" r="4" fill="#2a1d1a"/><circle cx="143" cy="118" r="4" fill="#2a1d1a"/>
      <circle cx="95.5" cy="116" r="1.4" fill="#fff"/><circle cx="141.5" cy="116" r="1.4" fill="#fff"/>`
    mouth = `<ellipse cx="120" cy="145" rx="6" ry="7.5" fill="#8a3a45" stroke="${OUT}" stroke-width="2.4"/>`
  } else if (lookDown) {
    // 低頭看手機：眼皮垂下
    eyes = `<path d="M 89 118 Q 97 124 105 118 M 135 118 Q 143 124 151 118" fill="none" stroke="${OUT}" stroke-width="3.8" stroke-linecap="round"/>
      <path d="M 90 119 L 86 122 M 150 119 L 154 122" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/>`
    mouth = `<path d="M 113 142 Q 120 145 127 142" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`
  } else {
    // 溫和但有點累：上眼皮壓平的半月眼 + 淡淡的眼袋
    const eye = (x: number) => `
      <path d="M ${x - 7} 116 Q ${x} 114 ${x + 7} 116 Q ${x + 7} 126 ${x} 126.5 Q ${x - 7} 126 ${x - 7} 116 Z" fill="#2c211e"/>
      <ellipse cx="${x + 0.5}" cy="121.5" rx="4" ry="3.4" fill="#5a4a6a" opacity="0.55"/>
      <circle cx="${x - 2.4}" cy="119" r="2" fill="#fff"/>
      <path d="M ${x - 10} 115.5 Q ${x} 110.5 ${x + 10} 115.5" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>
      <path d="M ${x - 5} 130.5 Q ${x} 132.5 ${x + 5} 130.5" fill="none" stroke="#d99a86" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`
    eyes = eye(97) + eye(143)
    mouth = `<path d="M 110 141 Q 120 148 130 141" fill="none" stroke="${OUT}" stroke-width="2.7" stroke-linecap="round"/>`
  }
  return `${brows}${eyes}
    <path d="M 117 131 Q 120 134.5 123 131" fill="none" stroke="#cf8f70" stroke-width="2.2" stroke-linecap="round"/>
    ${blush(84, 134, 11, 6, '#f5968f', mood === 'happy' ? 0.55 : 0.32)}${blush(156, 134, 11, 6, '#f5968f', mood === 'happy' ? 0.55 : 0.32)}
    ${mouth}
    ${mood === 'surprised' ? sweat(172, 80, 1) : ''}`
}

function xiaohanHead(mood: NpcMood, lookDown: boolean): string {
  const { x, y, r } = XH_HEAD
  const hair = `
    <path d="M 64 116 C 58 94, 60 76, 70 64 L 60 54 L 80 55 C 88 43, 102 37, 115 38 L 121 25 L 131 39 C 147 39, 161 47, 169 59 L 184 56 L 176 71 C 182 84, 182 99, 176 116 C 172 104, 168 96, 162 90 L 158 102 L 148 88 L 138 100 L 130 86 L 118 98 L 110 84 L 98 96 L 94 84 L 82 94 L 80 86 C 72 92, 67 102, 64 116 Z"
      fill="url(#xhHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 82 58 Q 100 47 118 47 M 140 50 Q 154 54 162 62" fill="none" stroke="#6f6567" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
    <path d="M 64 116 L 66 124 M 176 116 L 174 124" stroke="${OUT}" stroke-width="${SW}" stroke-linecap="round"/>`
  return `
    ${ears('xh', 64, 176, 116, '#d99a7a')}
    ${headBase('xh', x, y, r, '#e5a784')}
    <g clip-path="url(#xhHeadClip)"><rect x="60" y="40" width="120" height="130" fill="url(#xhGlow)"/></g>
    ${xiaohanFace(mood, lookDown)}
    ${hair}`
}

function xiaohanBody(pose: NpcPose): string {
  const neck = `<path d="M 108 150 L 132 150 L 133 168 Q 120 174 107 168 Z" fill="url(#xhSkinDark)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
  const shirt = cloth(XH_BODY, 'url(#xhShirt)', 'url(#xhShirtShade)')
  const collar = `<path d="M 99 163 Q 120 178 141 163" fill="none" stroke="#4f78a3" stroke-width="5" stroke-linecap="round"/>
    <path d="M 99 163 Q 120 178 141 163" fill="none" stroke="${OUT}" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>`
  const pocket = `<path d="M 134 188 L 154 188 L 154 204 Q 144 208 134 204 Z" fill="none" stroke="#4f78a3" stroke-width="2" stroke-linejoin="round"/>`
  // 掛在左肩（畫面右邊）的毛巾
  const towel = `
    <path d="M 136 158 Q 156 152 170 163 L 176 176 L 168 230 L 146 228 L 151 178 Q 145 169 136 166 Z" fill="url(#xhTowel)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 149 210 L 169 212 M 148 217 L 168 219" stroke="#5b8fd6" stroke-width="3" stroke-linecap="round"/>
    <path d="M 150 229 L 149 235 M 156 229.5 L 155 236 M 162 230 L 162 236" stroke="${OUT}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M 156 168 Q 164 180 160 196" fill="none" stroke="#c6d0dc" stroke-width="2.4" stroke-linecap="round"/>`
  const shorts = `
    ${cloth('M 60 250 L 180 250 L 187 304 L 128 306 L 122 280 L 118 280 L 112 306 L 53 304 Z', 'url(#xhShorts)', 'url(#xhShortsShade)')}
    <path d="M 120 254 L 120 280" stroke="#8a6a36" stroke-width="2" stroke-linecap="round"/>
    <path d="M 66 262 Q 72 272 78 262 M 162 262 Q 168 272 174 262" fill="none" stroke="#8a6a36" stroke-width="2" stroke-linecap="round"/>
    <path d="M 58 280 L 84 280 L 84 296 L 58 296 Z M 156 280 L 182 280 L 182 296 L 156 296 Z" fill="none" stroke="#8a6a36" stroke-width="1.8" stroke-linejoin="round"/>`
  const legs = `
    ${skin('M 70 302 L 106 302 L 104 339 Q 90 343 76 339 Z', 'xh')}
    ${skin('M 134 302 L 170 302 L 164 339 Q 150 343 136 339 Z', 'xh')}
    <path d="M 132 304 L 170 304 L 168 320 Q 150 316 134 318 Z" fill="#c98a66" opacity="0.25"/>`
  // 藍白拖
  const slipper = (x: number) => `
    <ellipse cx="${x}" cy="349" rx="22" ry="7" fill="#3d6fb8" stroke="${OUT}" stroke-width="2.4"/>
    <ellipse cx="${x}" cy="345.5" rx="21" ry="6" fill="#f5f7fa" stroke="${OUT}" stroke-width="2"/>
    <ellipse cx="${x}" cy="341" rx="13" ry="5.5" fill="url(#xhSkinDark)" stroke="${OUT}" stroke-width="2"/>
    <path d="M ${x - 13} 345 Q ${x} 333 ${x + 13} 345" fill="none" stroke="${OUT}" stroke-width="7" stroke-linecap="round"/>
    <path d="M ${x - 13} 345 Q ${x} 333 ${x + 13} 345" fill="none" stroke="#4a82d0" stroke-width="4.4" stroke-linecap="round"/>`
  const feet = slipper(90) + slipper(150)

  const sleeveL = cloth(XH_SLEEVE, 'url(#xhShirt)')
  const sleeveR = cloth(mirrorPath(XH_SLEEVE, 120), 'url(#xhShirt)', 'url(#xhShirtShade)')

  let arms = ''
  let front = ''
  if (pose === 'sweep') {
    // 竹掃把斜斜的橫過身體
    const broom = `
      <path d="M 198 132 L 70 300" stroke="${OUT}" stroke-width="10" stroke-linecap="round"/>
      <path d="M 198 132 L 70 300" stroke="url(#xhBroom)" stroke-width="6" stroke-linecap="round"/>
      <path d="M 196 138 L 74 297" stroke="#f3e2a8" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>
      <path d="M 70 296 L 22 354 L 100 356 L 82 300 Z" fill="#cdb46c" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M 70 302 L 34 352 M 74 304 L 52 354 M 78 304 L 70 355 M 81 304 L 88 355 M 72 299 L 26 350" stroke="#9c8440" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M 66 304 L 84 308" stroke="#7a5a26" stroke-width="5" stroke-linecap="round"/>`
    arms = `
      ${sleeveL}
      ${skin('M 52 207 C 50 230, 66 250, 94 256 L 100 243 C 82 238, 73 227, 73 211 Z', 'xh')}
      ${sleeveR}
      ${skin('M 190 207 C 194 196, 188 186, 178 182 L 168 192 C 174 196, 176 202, 170 210 Z', 'xh')}`
    front = broom + fist('xh', 102, 250, 12, 12) + fist('xh', 170, 184, 11, 11, true)
    return neck + shirt + collar + pocket + towel + shorts + legs + feet + arms + front
  }
  if (pose === 'phone') {
    const phone = `
      <g transform="rotate(-8 104 204)">
        <rect x="92" y="184" width="26" height="40" rx="6" fill="#2c2f3d" stroke="${OUT}" stroke-width="${SW}"/>
        <rect x="94.5" y="186.5" width="21" height="35" rx="4" fill="#bfe6ff" opacity="0.85"/>
        <path d="M 98 194 L 110 194 M 98 200 L 108 200 M 98 206 L 111 206" stroke="#6aa6d8" stroke-width="2" stroke-linecap="round"/>
      </g>
      <ellipse cx="104" cy="204" rx="34" ry="26" fill="#bfe6ff" opacity="0.22"/>`
    arms = `
      ${sleeveL}
      ${skin('M 52 207 C 50 228, 64 236, 92 228 L 92 212 C 80 216, 73 214, 73 211 Z', 'xh')}
      ${sleeveR}
      ${skin(mirrorPath('M 52 207 C 48 226, 48 244, 52 258 L 70 258 C 70 244, 72 226, 73 211 Z', 120), 'xh')}`
    front = phone + fist('xh', 100, 220, 11, 10) + fist('xh', 179, 264, 11, 12, true)
    return neck + shirt + collar + pocket + towel + shorts + legs + feet + arms + front
  }
  arms = `
    ${sleeveL}
    ${skin('M 52 207 C 48 226, 48 244, 52 258 L 70 258 C 70 244, 72 226, 73 211 Z', 'xh')}
    ${sleeveR}
    ${skin(mirrorPath('M 52 207 C 48 226, 48 244, 52 258 L 70 258 C 70 244, 72 226, 73 211 Z', 120), 'xh')}`
  front = fist('xh', 61, 264, 11, 12) + fist('xh', 179, 264, 11, 12, true)
  return neck + shirt + collar + pocket + towel + shorts + legs + feet + arms + front
}

function xiaohanSvg(pose: NpcPose, mood: NpcMood): string {
  const { w, h } = NPC_SIZE
  return svg(w, h, `${xiaohanDefs(pose)}${xiaohanBody(pose)}${xiaohanHead(mood, pose === 'phone' && mood === 'normal')}`)
}

// ===========================================================================
// 阿義（醉鬼阿飄，50 多歲）
// ===========================================================================

const AY_HEAD = { x: 120, y: 100, r: 58 }

function ayiDefs(): string {
  return `<defs>
    ${lin('aySkin', '#ffdcc6', '#eda78b')}
    ${lin('aySkinDark', '#f4c2a6', '#dd9579')}
    ${lin('ayShirt', '#fbfaf4', '#dcd8c6')}
    ${shadeGrad('ayShirtShade', '#6b6440', 0.28)}
    ${lin('ayGlass', '#f1e9cf', '#c9b88a')}
    <!-- 鬼的腳：往下漸漸透明 -->
    <linearGradient id="ayShortsFade" gradientUnits="userSpaceOnUse" x1="0" y1="266" x2="0" y2="352">
      <stop offset="0" stop-color="#4a5068" stop-opacity="1"/><stop offset="0.4" stop-color="#3e435a" stop-opacity="0.7"/><stop offset="1" stop-color="#30344a" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="aySkinFade" gradientUnits="userSpaceOnUse" x1="0" y1="290" x2="0" y2="350">
      <stop offset="0" stop-color="#eda78b" stop-opacity="0.75"/><stop offset="1" stop-color="#eda78b" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="ayOutFade" gradientUnits="userSpaceOnUse" x1="0" y1="266" x2="0" y2="344">
      <stop offset="0" stop-color="${OUT}" stop-opacity="1"/><stop offset="1" stop-color="${OUT}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="ayHeadClip"><circle cx="${AY_HEAD.x}" cy="${AY_HEAD.y}" r="${AY_HEAD.r}"/></clipPath>
    <clipPath id="ayJawClip"><path d="M 62 118 Q 70 160 120 160 Q 170 160 178 118 L 178 170 L 62 170 Z"/></clipPath>
  </defs>`
}

function ayiHead(pose: NpcPose): string {
  const { x, y, r } = AY_HEAD
  const drinking = pose === 'drink'
  // 頭頂稀疏、兩側有頭髮
  const hair = `
    <path d="M 63 110 C 62 98, 65 88, 71 80 C 72 88, 71 96, 69 106 Z" fill="#6f6866" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M 177 110 C 178 98, 175 88, 169 80 C 168 88, 169 96, 171 106 Z" fill="#5d5654" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M 84 62 Q 116 42 154 58 M 90 58 Q 118 46 146 52 M 96 55 Q 114 50 132 50" fill="none" stroke="#4d4745" stroke-width="3" stroke-linecap="round"/>
    <path d="M 78 72 Q 96 56 118 52" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity="0.45"/>`
  // 鬍渣
  const rnd = (i: number) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1
  const stubble = Array.from({ length: 46 }, (_, i) => {
    const a = Math.PI * (0.12 + 0.76 * rnd(i))
    const d = 36 + rnd(i + 99) * 18
    const cx = x - Math.cos(a) * d
    const cy = y + 18 + Math.sin(a) * d * 0.72
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(0.9 + rnd(i + 7) * 0.7).toFixed(2)}" fill="#6a5652" opacity="0.55"/>`
  }).join('')
  const eyes = drinking
    ? `<path d="M 86 116 Q 96 124 106 116 M 134 116 Q 144 124 154 116" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`
    : `
    <path d="M 88 117 Q 96 125 104 117 Z" fill="#2c211e" stroke="${OUT}" stroke-width="2"/>
    <path d="M 136 117 Q 144 125 152 117 Z" fill="#2c211e" stroke="${OUT}" stroke-width="2"/>
    <path d="M 84 116 Q 96 110 108 116 M 132 116 Q 144 110 156 116" fill="none" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M 86 112 Q 96 106 106 111 M 134 111 Q 144 106 154 112" fill="none" stroke="#d9927a" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`
  const brows = `<path d="M 82 100 Q 94 94 106 99 M 134 99 Q 146 94 158 100" fill="none" stroke="#3e3836" stroke-width="4" stroke-linecap="round"/>`
  const mouth = drinking
    ? `<ellipse cx="128" cy="146" rx="6" ry="5" fill="#8a3a45" stroke="${OUT}" stroke-width="2.4"/>`
    : `<path d="M 100 142 Q 118 160 140 138 Q 120 148 100 142 Z" fill="#94393f" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
       <path d="M 106 144 L 132 142 L 130 146 L 108 147 Z" fill="#fffaf0"/>`
  return `
    ${ears('ay', 62, 178, 116, '#d78a70')}
    ${headBase('ay', x, y, r, '#e39a7d')}
    <g clip-path="url(#ayHeadClip)"><g clip-path="url(#ayJawClip)">${stubble}</g></g>
    ${hair}
    ${brows}${eyes}
    <!-- 喝到紅通通的臉頰與鼻子 -->
    ${blush(80, 132, 16, 10, '#ff6f73', 0.55)}${blush(160, 132, 16, 10, '#ff6f73', 0.55)}
    <path d="M 74 129 l 4 -6 M 81 131 l 4 -6 M 88 130 l 4 -6 M 152 130 l 4 -6 M 159 131 l 4 -6 M 166 129 l 4 -6" stroke="#e8505a" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
    <ellipse cx="120" cy="129" rx="10" ry="8" fill="#ff7f78" stroke="${OUT}" stroke-width="2.4"/>
    <ellipse cx="117" cy="126.5" rx="3.2" ry="2.2" fill="#fff" opacity="0.8"/>
    ${mouth}
    ${
      drinking
        ? ''
        : `<circle cx="186" cy="64" r="6" fill="#dff4ff" stroke="#7fb8e6" stroke-width="1.6" opacity="0.9"/><circle cx="198" cy="48" r="4" fill="#dff4ff" stroke="#7fb8e6" stroke-width="1.4" opacity="0.8"/><circle cx="205" cy="34" r="2.6" fill="#dff4ff" stroke="#7fb8e6" stroke-width="1.2" opacity="0.7"/>`
    }`
}

/** 紅標米酒：以瓶身中心為原點，往上是瓶口 */
function riceWine(): string {
  return `
    <path d="M -15 26 L -15 -10 Q -15 -20 -7 -24 L -6 -44 L 6 -44 L 7 -24 Q 15 -20 15 -10 L 15 26 Q 0 30 -15 26 Z" fill="url(#ayGlass)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round" opacity="0.95"/>
    <path d="M -12 24 L -12 2 L 12 2 L 12 24 Q 0 27 -12 24 Z" fill="#e8d59a" opacity="0.7"/>
    <rect x="-7" y="-50" width="14" height="8" rx="2" fill="#d33a2c" stroke="${OUT}" stroke-width="2"/>
    <path d="M -15 -6 L 15 -6 L 15 14 L -15 14 Z" fill="#d8322a" stroke="${OUT}" stroke-width="2"/>
    <ellipse cx="0" cy="4" rx="8" ry="6" fill="#fff4dc"/>
    <path d="M -3 1 L 3 1 M -4 4 L 4 4 M -3 7 L 3 7" stroke="#d8322a" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M -10 -14 L -10 20" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>`
}

function ayiBody(pose: NpcPose): string {
  const shoulders = `<path d="M 60 170 Q 120 150 180 170 L 184 204 L 56 204 Z" fill="url(#aySkin)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 108 150 L 132 150 L 134 166 Q 120 172 106 166 Z" fill="url(#aySkinDark)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
  // 汗衫：深挖的袖口，肚子圓滾滾
  const shirtD = 'M 82 160 Q 120 184 158 160 L 162 164 Q 164 188 178 202 Q 200 238 186 266 Q 120 286 54 266 Q 40 238 62 202 Q 76 188 78 164 Z'
  const shirt = cloth(shirtD, 'url(#ayShirt)', 'url(#ayShirtShade)')
  const belly = `<path d="M 88 250 Q 120 262 152 250" fill="none" stroke="#c8c2a8" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="96" cy="222" rx="7" ry="5" fill="#e8d59a" opacity="0.55"/>
    <path d="M 84 206 Q 90 196 100 194" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`
  const shorts = `
    <path d="M 62 262 L 178 262 L 186 312 L 128 314 L 120 290 L 112 314 L 54 312 Z" fill="url(#ayShortsFade)" stroke="url(#ayOutFade)" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 72 314 L 106 314 L 104 348 L 76 348 Z M 134 314 L 168 314 L 164 348 L 136 348 Z" fill="url(#aySkinFade)"/>`

  if (pose === 'drink') {
    const armL = skin('M 62 176 C 44 196, 46 230, 70 242 C 84 248, 96 244, 104 236 L 96 222 C 86 228, 76 224, 74 212 C 72 200, 76 190, 82 184 Z', 'ay')
    return shoulders + shirt + belly + shorts + armL + fist('ay', 100, 234, 12, 11)
  }
  // 待機：一手抓肚子、一手拎著酒瓶
  const armL = skin('M 62 176 C 44 196, 46 230, 70 242 C 84 248, 96 244, 104 236 L 96 222 C 86 228, 76 224, 74 212 C 72 200, 76 190, 82 184 Z', 'ay')
  const scratch = `<path d="M 96 226 l 6 -3 M 98 232 l 6 -3" stroke="#d9927a" stroke-width="1.6" stroke-linecap="round"/>`
  const armR = skin('M 170 176 C 188 188, 196 212, 192 244 L 174 244 C 176 222, 172 204, 162 192 Z', 'ay')
  const bottle = `<g transform="translate(186 288) rotate(8)">${riceWine()}</g>`
  return shoulders + shirt + belly + shorts + armL + fist('ay', 100, 232, 12, 11) + scratch + armR + bottle + fist('ay', 184, 248, 12, 12, true)
}

/** 舉瓶喝酒的手臂與酒瓶：要畫在頭的前面 */
function ayiDrinkArm(): string {
  const arm = skin('M 172 174 C 196 162, 204 136, 192 112 L 174 114 C 180 134, 172 150, 158 162 Z', 'ay')
  const bottle = `<g transform="translate(165 110) rotate(-128)">${riceWine()}</g>`
  return arm + bottle + fist('ay', 182, 106, 12, 13, true)
}

function ayiSvg(pose: NpcPose): string {
  const { w, h } = NPC_SIZE
  return svg(w, h, `${ayiDefs()}${ayiBody(pose)}${ayiHead(pose)}${pose === 'drink' ? ayiDrinkArm() : ''}`)
}

// ===========================================================================
// 王伯（廟公，60 多歲）
// ===========================================================================

const MG_HEAD = { x: 120, y: 100, r: 56 }
const MG_BODY = 'M 96 158 Q 120 168 144 158 L 168 168 Q 182 176 184 196 L 186 268 Q 120 278 54 268 L 56 196 Q 58 176 72 168 Z'

function miaogongDefs(): string {
  return `<defs>
    ${lin('mgSkin', '#ffe2c8', '#e9ae88')}
    ${lin('mgSkinDark', '#f3c6a2', '#dc9d78')}
    ${lin('mgHair', '#d7d7da', '#8e8e96')}
    ${lin('mgJacket', '#4a557c', '#2a3150')}
    ${shadeGrad('mgJacketShade', '#0c1024', 0.4)}
    ${lin('mgPants', '#6a6c74', '#46474e')}
    <radialGradient id="mgEmber" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff2b0"/><stop offset="0.5" stop-color="#ff9a3a" stop-opacity="0.9"/><stop offset="1" stop-color="#ff6a1a" stop-opacity="0"/></radialGradient>
    <clipPath id="mgHeadClip"><circle cx="${MG_HEAD.x}" cy="${MG_HEAD.y}" r="${MG_HEAD.r}"/></clipPath>
  </defs>`
}

function mgKnot(x: number, y: number): string {
  return `<g transform="translate(${x} ${y})">
    <path d="M -9 0 L 9 0" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/>
    <path d="M -9 0 L 9 0" stroke="#d9b86a" stroke-width="2.8" stroke-linecap="round"/>
    <circle cx="-9" cy="0" r="3" fill="#d9b86a" stroke="${OUT}" stroke-width="1.3"/>
    <circle cx="9" cy="0" r="2.3" fill="none" stroke="#d9b86a" stroke-width="1.7"/>
  </g>`
}

function miaogongHead(pose: NpcPose): string {
  const { x, y, r } = MG_HEAD
  const praying = pose === 'bow'
  const hair = `
    <path d="M 64 112 C 60 84, 64 60, 82 48 Q 120 38 158 48 C 176 60, 180 84, 176 112 C 172 98, 166 88, 158 82 Q 120 76 82 82 C 74 88, 68 98, 64 112 Z"
      fill="url(#mgHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 84 56 L 84 64 M 94 52 L 94 61 M 104 50 L 104 59 M 114 49 L 114 58 M 126 49 L 126 58 M 136 50 L 136 59 M 146 52 L 146 61 M 156 56 L 156 64" stroke="#7d7d86" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
    <path d="M 76 60 Q 96 46 118 45" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`
  const brows = praying
    ? `<path d="M 80 102 Q 94 98 108 102 M 132 102 Q 146 98 160 102" fill="none" stroke="#6d6a6a" stroke-width="5" stroke-linecap="round"/>`
    : `<path d="M 80 99 L 108 106 M 160 99 L 132 106" fill="none" stroke="#6d6a6a" stroke-width="6" stroke-linecap="round"/>`
  const eyes = praying
    ? `<path d="M 88 118 Q 96 122 104 118 M 136 118 Q 144 122 152 118" fill="none" stroke="${OUT}" stroke-width="3.2" stroke-linecap="round"/>`
    : `<ellipse cx="96" cy="118" rx="4.8" ry="4" fill="#2a1d1a"/><ellipse cx="144" cy="118" rx="4.8" ry="4" fill="#2a1d1a"/>
       <circle cx="94.6" cy="116.8" r="1.3" fill="#fff"/><circle cx="142.6" cy="116.8" r="1.3" fill="#fff"/>`
  // 粗黑框眼鏡
  const glasses = `
    <rect x="78" y="105" width="36" height="26" rx="8" fill="#ffffff" fill-opacity="0.14" stroke="#1c1c20" stroke-width="5"/>
    <rect x="126" y="105" width="36" height="26" rx="8" fill="#ffffff" fill-opacity="0.14" stroke="#1c1c20" stroke-width="5"/>
    <path d="M 114 114 Q 120 110 126 114" fill="none" stroke="#1c1c20" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M 78 112 L 66 108 M 162 112 L 174 108" stroke="#1c1c20" stroke-width="4" stroke-linecap="round"/>
    <path d="M 84 110 L 92 110 M 132 110 L 140 110" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`
  const wrinkles = `
    <path d="M 102 86 Q 120 82 138 86 M 106 92 Q 120 89 134 92" fill="none" stroke="#cf8e70" stroke-width="1.7" stroke-linecap="round" opacity="0.7"/>
    <path d="M 100 136 Q 95 144 100 152 M 140 136 Q 145 144 140 152" fill="none" stroke="#cf8e70" stroke-width="1.8" stroke-linecap="round" opacity="0.75"/>`
  const mouth = praying
    ? `<path d="M 110 148 Q 120 150 130 148" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`
    : `<path d="M 108 150 Q 120 145 132 150" fill="none" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round"/>`
  return `
    ${ears('mg', 64, 176, 114, '#d6957a')}
    ${headBase('mg', x, y, r, '#e3a47f')}
    ${hair}
    ${wrinkles}${brows}${eyes}${glasses}
    <path d="M 116 134 Q 120 138 124 134" fill="none" stroke="#c98a6c" stroke-width="2.4" stroke-linecap="round"/>
    ${mouth}`
}

/** 一束香：原點在手握的位置，往 -y 延伸 */
function incense(len: number, spread: number): string {
  const sticks = [-1, 0, 1]
    .map((k) => {
      const tx = k * spread
      return `<path d="M ${k * 2} 0 L ${tx} ${-len}" stroke="${OUT}" stroke-width="4.4" stroke-linecap="round"/>
        <path d="M ${k * 2} 0 L ${tx} ${-len}" stroke="#b3452f" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M ${k * 2} 6 L ${k * 2} 16" stroke="#d9b86a" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${tx}" cy="${-len}" r="6" fill="url(#mgEmber)"/>
        <circle cx="${tx}" cy="${-len}" r="2.2" fill="#fff2b0"/>`
    })
    .join('')
  const smoke = `<path d="M ${-spread} ${-len - 6} C ${-spread - 10} ${-len - 20}, ${-spread + 8} ${-len - 32}, ${-spread - 4} ${-len - 48} M ${spread} ${-len - 6} C ${spread + 10} ${-len - 22}, ${spread - 6} ${-len - 36}, ${spread + 6} ${-len - 54}"
    fill="none" stroke="#e6e6ee" stroke-width="2.6" stroke-linecap="round" opacity="0.55"/>`
  return smoke + sticks
}

function miaogongBody(pose: NpcPose): string {
  const neck = `<path d="M 108 150 L 132 150 L 133 166 Q 120 172 107 166 Z" fill="url(#mgSkinDark)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
  const pants = `
    ${cloth('M 66 262 L 174 262 L 172 338 L 126 338 L 120 292 L 114 338 L 68 338 Z', 'url(#mgPants)')}
    <path d="M 92 272 L 91 336 M 148 272 L 149 336" stroke="#3a3b42" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>`
  const shoe = (x: number) => `<path d="M ${x - 22} 348 Q ${x - 22} 334 ${x} 334 Q ${x + 22} 334 ${x + 22} 348 Z" fill="#1d1d22" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M ${x - 22} 348 L ${x + 22} 348" stroke="#e8e4da" stroke-width="3" stroke-linecap="round"/>
    <path d="M ${x - 10} 338 Q ${x} 335 ${x + 10} 338" fill="none" stroke="#4a4a52" stroke-width="1.6" stroke-linecap="round"/>`
  const jacket = `
    ${cloth(MG_BODY, 'url(#mgJacket)', 'url(#mgJacketShade)')}
    <path d="M 120 172 L 120 268" stroke="#1c2138" stroke-width="2.4"/>
    ${mgKnot(120, 186)}${mgKnot(120, 206)}${mgKnot(120, 226)}${mgKnot(120, 246)}
    <path d="M 70 262 Q 120 272 170 262" fill="none" stroke="#6a77a4" stroke-width="2" opacity="0.6"/>
    <path d="M 96 160 Q 120 172 144 160 L 146 170 Q 120 184 94 170 Z" fill="#3a446a" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M 78 180 Q 84 176 92 176" fill="none" stroke="#7d8ab8" stroke-width="2.6" stroke-linecap="round" opacity="0.7"/>`
  if (pose === 'bow') {
    const armL = 'M 72 170 C 54 184, 54 216, 70 230 C 86 240, 102 232, 112 222 L 104 206 C 94 212, 84 210, 82 200 C 80 190, 82 182, 86 178 Z'
    const arms = cloth(armL, 'url(#mgJacket)') + cloth(mirrorPath(armL, 120), 'url(#mgJacket)', 'url(#mgJacketShade)')
    const hands = `${fist('mg', 112, 214, 11, 12)}${fist('mg', 128, 214, 11, 12, true)}
      <path d="M 120 206 L 120 222" stroke="#c98a6c" stroke-width="1.6" stroke-linecap="round"/>`
    return neck + pants + shoe(92) + shoe(148) + jacket + arms + `<g transform="translate(120 206)">${incense(58, 8)}</g>` + hands
  }
  // 待機：右手拿香（畫面左邊）、左手背在後面
  const armL = 'M 72 170 C 56 180, 50 204, 50 232 L 52 250 L 74 250 L 76 204 Z'
  const armR = 'M 168 170 C 182 180, 188 200, 186 222 L 170 226 L 164 200 Z'
  return (
    neck +
    pants +
    shoe(92) +
    shoe(148) +
    cloth(armR, 'url(#mgJacket)', 'url(#mgJacketShade)') +
    jacket +
    cloth(armL, 'url(#mgJacket)') +
    `<g transform="translate(60 250) rotate(-10)">${incense(78, 9)}</g>` +
    fist('mg', 62, 256, 12, 12)
  )
}

function miaogongSvg(pose: NpcPose): string {
  const { w, h } = NPC_SIZE
  return svg(w, h, `${miaogongDefs()}${miaogongBody(pose)}${miaogongHead(pose)}`)
}

// ===========================================================================
// 阿桂（隔壁的老朋友，75 歲）
// ===========================================================================

const AG_HEAD = { x: 120, y: 110, r: 60 }
const AG_BODY = 'M 94 170 Q 120 178 146 170 L 172 180 Q 188 188 190 206 L 194 272 Q 120 288 46 272 L 50 206 Q 52 188 68 180 Z'

function aguiDefs(): string {
  const hibiscus = (cx: number, cy: number, s: number) =>
    `<g transform="translate(${cx} ${cy}) scale(${s})">${[0, 72, 144, 216, 288]
      .map((a) => `<ellipse cx="0" cy="-5" rx="4" ry="5.5" fill="#ff9a3c" transform="rotate(${a})"/>`)
      .join('')}<circle r="2.4" fill="#ffe066"/><circle r="1" fill="#c9301f"/></g>`
  return `<defs>
    ${lin('agSkin', '#ffe5cf', '#f0b894')}
    ${lin('agSkinDark', '#f6c8a6', '#e2a37e')}
    ${lin('agHair', '#5a4a58', '#2e2530')}
    ${lin('agBlouse', '#48b3ac', '#227f7a')}
    ${shadeGrad('agBlouseShade', '#0b3a38', 0.36)}
    ${lin('agPants', '#5a4488', '#3a2a62')}
    ${shadeGrad('agPantsShade', '#1a0e36', 0.32)}
    ${lin('agVisor', '#7fe0c8', '#2fa888')}
    <pattern id="agFloral" patternUnits="userSpaceOnUse" width="34" height="34">
      ${hibiscus(9, 10, 1)}${hibiscus(26, 27, 0.8)}
      <circle cx="27" cy="8" r="1.6" fill="#fff6d8" opacity="0.9"/><circle cx="7" cy="28" r="1.6" fill="#fff6d8" opacity="0.9"/>
    </pattern>
    ${flowerPattern('agPantsFloral', 18, '#f7c6e0', '#fff3a8', 2.1, '<circle cx="15" cy="4" r="1" fill="#ffffff" opacity="0.8"/>')}
    <clipPath id="agHeadClip"><circle cx="${AG_HEAD.x}" cy="${AG_HEAD.y}" r="${AG_HEAD.r}"/></clipPath>
  </defs>`
}

function aguiHead(): string {
  const { x, y, r } = AG_HEAD
  // 燙捲的頭髮：一圈小捲
  const curl = (cx: number, cy: number, cr: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${cr}" fill="url(#agHair)" stroke="${OUT}" stroke-width="2.6"/>
     <path d="M ${cx - cr * 0.45} ${cy - cr * 0.1} Q ${cx} ${cy - cr * 0.6} ${cx + cr * 0.4} ${cy - cr * 0.05}" fill="none" stroke="#8a7488" stroke-width="1.8" stroke-linecap="round"/>`
  const back = `<path d="M 56 132 C 46 88, 76 48, 120 48 C 164 48, 194 88, 184 132 Z" fill="url(#agHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
  const ring: [number, number, number][] = [
    [58, 128, 11],
    [54, 110, 12],
    [60, 90, 12],
    [72, 72, 13],
    [90, 58, 13],
    [110, 51, 13],
    [130, 51, 13],
    [150, 58, 13],
    [168, 72, 13],
    [180, 90, 12],
    [186, 110, 12],
    [182, 128, 11],
  ]
  const top: [number, number, number][] = [
    [96, 76, 11],
    [118, 70, 12],
    [140, 76, 11],
    [80, 88, 10],
    [160, 88, 10],
  ]
  const curls = ring.map(([a, b, c]) => curl(a, b, c)).join('') + top.map(([a, b, c]) => curl(a, b, c)).join('')
  // 遮陽帽：髮帶 + 透明綠帽簷
  const visor = `
    <path d="M 62 98 Q 120 72 178 98" fill="none" stroke="${OUT}" stroke-width="11" stroke-linecap="round"/>
    <path d="M 62 98 Q 120 72 178 98" fill="none" stroke="#ff7eb0" stroke-width="7" stroke-linecap="round"/>
    <path d="M 70 96 Q 120 80 170 96 Q 176 116 120 112 Q 64 116 70 96 Z" fill="url(#agVisor)" fill-opacity="0.72" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M 84 98 Q 110 90 134 92" fill="none" stroke="#e8fff6" stroke-width="2.6" stroke-linecap="round" opacity="0.8"/>`
  const face = `
    <path d="M 86 128 Q 97 118 108 128 M 132 128 Q 143 118 154 128" fill="none" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M 82 126 L 77 123 M 158 126 L 163 123" stroke="${OUT}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M 80 133 L 74 131 M 160 133 L 166 131" stroke="#c98b6d" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M 115 139 Q 120 144 125 139" fill="none" stroke="#cf8f70" stroke-width="2.4" stroke-linecap="round"/>
    ${blush(84, 146, 14, 9, '#f58f98', 0.58)}${blush(156, 146, 14, 9, '#f58f98', 0.58)}
    <path d="M 100 146 Q 95 154 100 162 M 140 146 Q 145 154 140 162" fill="none" stroke="#d59478" stroke-width="1.7" stroke-linecap="round" opacity="0.7"/>
    <!-- 大笑的嘴，一顆金牙 -->
    <path d="M 100 152 Q 120 180 140 152 Q 120 158 100 152 Z" fill="#94393f" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M 104 154 Q 120 158 136 154 L 134 160 Q 120 163 106 160 Z" fill="#fffaf0"/>
    <rect x="124" y="155" width="6" height="6" rx="1.2" fill="#f2c14e" stroke="${OUT}" stroke-width="1"/>
    <path d="M 110 168 Q 120 164 130 168 Q 120 173 110 168 Z" fill="#ee8a8c"/>`
  return `
    ${back}
    ${ears('ag', 60, 180, 132, '#d99a7a')}
    ${headBase('ag', x, y, r, '#e8ad8a')}
    ${face}
    ${curls}
    ${visor}`
}

/** 紙扇：原點在握柄 */
function paperFan(): string {
  const ribs = [-62, -48, -34, -20, -6, 8, 22]
  const R = 50
  const pt = (a: number, r: number) => `${(Math.cos((a * Math.PI) / 180 - Math.PI / 2) * r).toFixed(1)} ${(Math.sin((a * Math.PI) / 180 - Math.PI / 2) * r).toFixed(1)}`
  const arc = `M ${pt(-66, 16)} L ${pt(-66, R)} A ${R} ${R} 0 0 1 ${pt(26, R)} L ${pt(26, 16)} A 16 16 0 0 0 ${pt(-66, 16)} Z`
  const plum = [
    [-40, 34],
    [-18, 40],
    [4, 30],
    [-28, 24],
  ]
    .map(([a, r]) => `<g transform="translate(${pt(a, r).replace(' ', ' ')})">${[0, 72, 144, 216, 288].map((k) => `<circle cx="${(Math.cos((k * Math.PI) / 180) * 3).toFixed(1)}" cy="${(Math.sin((k * Math.PI) / 180) * 3).toFixed(1)}" r="2.8" fill="#f06a7a"/>`).join('')}<circle r="1.5" fill="#ffe066"/></g>`)
    .join('')
  return `
    <path d="${arc}" fill="#fff4e2" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M ${pt(-66, R - 7)} A ${R - 7} ${R - 7} 0 0 1 ${pt(26, R - 7)}" fill="none" stroke="#e05a4a" stroke-width="3"/>
    ${ribs.map((a) => `<path d="M ${pt(a, 4)} L ${pt(a, R - 2)}" stroke="#c9a46a" stroke-width="1.3" opacity="0.8"/>`).join('')}
    ${plum}
    ${ribs.map((a) => `<path d="M 0 0 L ${pt(a, 16)}" stroke="#8a5a2a" stroke-width="2.6" stroke-linecap="round"/>`).join('')}
    <circle r="3.4" fill="#d9b86a" stroke="${OUT}" stroke-width="1.4"/>`
}

function aguiBody(): string {
  const neck = `<path d="M 108 164 L 132 164 L 133 178 Q 120 184 107 178 Z" fill="url(#agSkinDark)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
  const pants = `
    ${cloth('M 62 266 L 178 266 L 188 330 L 128 332 L 120 296 L 112 332 L 52 330 Z', 'url(#agPants)', 'url(#agPantsShade)', 'url(#agPantsFloral)')}`
  const ankle = `${skin('M 70 328 L 106 328 L 104 340 L 72 340 Z', 'ag')}${skin('M 134 328 L 170 328 L 168 340 L 136 340 Z', 'ag')}`
  const shoe = (x: number) => `<path d="M ${x - 21} 350 Q ${x - 22} 336 ${x} 336 Q ${x + 22} 336 ${x + 21} 350 Z" fill="#b8664a" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M ${x - 12} 340 Q ${x} 337 ${x + 12} 340" fill="none" stroke="#e6a07e" stroke-width="2" stroke-linecap="round"/>`
  const blouse = cloth(AG_BODY, 'url(#agBlouse)', 'url(#agBlouseShade)', 'url(#agFloral)')
  // 襯衫領 + 鈕扣
  const collar = `
    <path d="M 96 170 L 118 196 L 104 200 L 88 178 Z" fill="url(#agBlouse)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M 144 170 L 122 196 L 136 200 L 152 178 Z" fill="#2d8e89" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M 120 196 L 120 276" stroke="#1d6a66" stroke-width="2"/>
    ${[210, 230, 250].map((y) => `<circle cx="120" cy="${y}" r="3.4" fill="#fff6e6" stroke="${OUT}" stroke-width="1.4"/>`).join('')}`
  const sleeveL = 'M 68 182 C 52 190, 46 214, 48 238 L 70 242 L 76 206 Z'
  const armL = `${cloth(sleeveL, 'url(#agBlouse)', undefined, 'url(#agFloral)')}${skin('M 50 236 C 48 252, 50 264, 54 274 L 70 274 C 70 262, 70 250, 70 240 Z', 'ag')}${fist('ag', 62, 278, 11, 12)}`
  const sleeveR = 'M 172 182 C 188 190, 196 208, 194 226 L 172 230 L 168 206 Z'
  const armR = `${cloth(sleeveR, 'url(#agBlouse)', 'url(#agBlouseShade)', 'url(#agFloral)')}${skin('M 192 222 C 196 232, 190 244, 180 248 L 170 238 C 176 236, 176 230, 174 226 Z', 'ag')}`
  const fan = `<g transform="translate(176 240) rotate(18)">${paperFan()}</g>`
  return neck + pants + ankle + shoe(90) + shoe(150) + blouse + collar + armL + armR + fan + fist('ag', 176, 240, 11, 11, true)
}

function aguiSvg(): string {
  const { w, h } = NPC_SIZE
  return svg(w, h, `${aguiDefs()}${aguiBody()}${aguiHead()}`)
}

// ===========================================================================

/**
 * 配角立繪。pose 不在該角色的姿勢清單裡時用預設姿勢。
 * mood 只有小翰有完整的表情（normal／happy／surprised），其他人都用 normal。
 */
export function npcSvg(id: NpcId, pose: NpcPose = 'idle', mood: NpcMood = 'normal'): string {
  const p = NPC_POSES[id].includes(pose) ? pose : NPC_POSES[id][0]
  switch (id) {
    case 'xiaohan':
      return xiaohanSvg(p, mood)
    case 'ayi':
      return ayiSvg(p)
    case 'miaogong':
      return miaogongSvg(p)
    case 'agui':
      return aguiSvg()
  }
}

export { sparkle }
