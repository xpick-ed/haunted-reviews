// 配角立繪（SVG 字串，全身站姿 240×360）。純函式、不依賴 three，方便在 node 裡輸出預覽圖。
// 風格跟 characters.ts 一樣：Q 版、賽璐璐上色加柔和漸層、暖深色描邊、光從左上來。

const OUT = '#3b2a2a'
const SW = 3

export const NPC_SIZE = { w: 240, h: 360 }

export type NpcId = 'xiaohan' | 'ayi' | 'miaogong' | 'agui' | 'akai' | 'zhang' | 'ahao' | 'xiaoyu' | 'linmom' | 'atu' | 'ajiao' | 'jinyubo' | 'hongyi'
export type NpcPose = 'idle' | 'sweep' | 'phone' | 'drink' | 'bow'
export type NpcMood = 'normal' | 'happy' | 'surprised'

export const NPC_IDS: readonly NpcId[] = ['xiaohan', 'ayi', 'miaogong', 'agui', 'akai', 'zhang', 'ahao', 'xiaoyu', 'linmom', 'atu', 'ajiao', 'jinyubo', 'hongyi']

/** 每個角色有哪些姿勢（第一個是預設） */
export const NPC_POSES: Record<NpcId, readonly NpcPose[]> = {
  xiaohan: ['idle', 'sweep', 'phone'],
  ayi: ['idle', 'drink'],
  miaogong: ['idle', 'bow'],
  agui: ['idle'],
  akai: ['idle'],
  zhang: ['idle'],
  ahao: ['idle'],
  xiaoyu: ['idle'],
  linmom: ['idle'],
  atu: ['idle'],
  ajiao: ['idle'],
  jinyubo: ['idle'],
  hongyi: ['idle'],
}

/** 鬼（不受光、半透明、飄著、沒有影子） */
export const NPC_GHOST: Record<NpcId, boolean> = { xiaohan: false, ayi: true, miaogong: false, agui: false, akai: false, zhang: false, ahao: false, xiaoyu: false, linmom: false, atu: false, ajiao: false, jinyubo: true, hongyi: true }

/** 預設的世界高度（公尺） */
export const NPC_HEIGHT: Record<NpcId, number> = { xiaohan: 1.7, ayi: 1.7, miaogong: 1.7, agui: 1.55, akai: 1.72, zhang: 1.75, ahao: 1.72, xiaoyu: 1.2, linmom: 1.6, atu: 1.6, ajiao: 1.5, jinyubo: 1.7, hongyi: 1.62 }

export const NPC_NAMES: Record<NpcId, string> = { xiaohan: '小翰', ayi: '阿義', miaogong: '王伯', agui: '阿桂', akai: '阿凱', zhang: '張經理', ahao: '阿豪', xiaoyu: '小宇', linmom: '林太太', atu: '阿土伯', ajiao: '阿嬌', jinyubo: '金魚伯', hongyi: '紅姨' }

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
// 客人們：共用的臉部零件與身體
// ===========================================================================

/** 一雙睜開的眼睛：黑眼珠＋兩個高光。k：大小倍率 */
function eyesOpen(y: number, xl = 97, xr = 143, k = 1, col = '#2c211e'): string {
  const e = (x: number) => `
    <ellipse cx="${x}" cy="${y}" rx="${7 * k}" ry="${9.5 * k}" fill="${col}"/>
    <circle cx="${x - 2.6 * k}" cy="${y - 3.4 * k}" r="${2.7 * k}" fill="#fff"/>
    <circle cx="${x + 2.4 * k}" cy="${y + 3.6 * k}" r="${1.3 * k}" fill="#fff" opacity="0.85"/>`
  return e(xl) + e(xr)
}
/** 笑瞇瞇的 ^ ^ */
function eyesHappy(y: number, xl = 97, xr = 143, w = 10): string {
  return `<path d="M ${xl - w} ${y + 3} Q ${xl} ${y - 9} ${xl + w} ${y + 3} M ${xr - w} ${y + 3} Q ${xr} ${y - 9} ${xr + w} ${y + 3}" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`
}
/** 嚇到：白眼球、小瞳孔 */
function eyesWide(y: number, xl = 97, xr = 143): string {
  const e = (x: number) => `<ellipse cx="${x}" cy="${y}" rx="10" ry="11.5" fill="#fff" stroke="${OUT}" stroke-width="2.8"/><circle cx="${x}" cy="${y + 1}" r="3.6" fill="#2a1d1a"/><circle cx="${x - 1.4}" cy="${y - 0.6}" r="1.2" fill="#fff"/>`
  return e(xl) + e(xr)
}
const mouthO = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="8" fill="#8a3a45" stroke="${OUT}" stroke-width="2.5"/>`
const mouthSmile = (x: number, y: number, w = 10) => `<path d="M ${x - w} ${y} Q ${x} ${y + 8} ${x + w} ${y}" fill="none" stroke="${OUT}" stroke-width="2.7" stroke-linecap="round"/>`
/** 張嘴笑：暗紅嘴＋舌頭（teeth：上排牙齒） */
function mouthGrin(x: number, y: number, w = 15, teeth = false): string {
  return `<path d="M ${x - w} ${y} Q ${x} ${y + w * 1.2} ${x + w} ${y} Q ${x} ${y + 5} ${x - w} ${y} Z" fill="#94393f" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    ${teeth ? `<path d="M ${x - w + 4} ${y + 1.5} Q ${x} ${y + 6} ${x + w - 4} ${y + 1.5} L ${x + w - 6} ${y + 5.5} Q ${x} ${y + 9} ${x - w + 6} ${y + 5.5} Z" fill="#fffaf0"/>` : ''}
    <path d="M ${x - w * 0.5} ${y + w * 0.75} Q ${x} ${y + w * 0.5} ${x + w * 0.5} ${y + w * 0.75} Q ${x} ${y + w * 1.05} ${x - w * 0.5} ${y + w * 0.75} Z" fill="#ee8a8c"/>`
}
const nose = (x: number, y: number, c = '#cf8f70') => `<path d="M ${x - 3} ${y} Q ${x} ${y + 3.5} ${x + 3} ${y}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`
const browsSoft = (y: number, c = '#3a2e2a', xl = 97, xr = 143) =>
  `<path d="M ${xl - 11} ${y + 1} Q ${xl} ${y - 4} ${xl + 11} ${y} M ${xr - 11} ${y} Q ${xr} ${y - 4} ${xr + 11} ${y + 1}" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/>`
const browsUp = (y: number, c = '#3a2e2a', xl = 97, xr = 143) =>
  `<path d="M ${xl - 11} ${y - 2} Q ${xl} ${y - 10} ${xl + 11} ${y - 5} M ${xr - 11} ${y - 5} Q ${xr} ${y - 10} ${xr + 11} ${y - 2}" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/>`
/** 擔心的眉毛（內側往上） */
const browsWorried = (y: number, c = '#3a2e2a', xl = 97, xr = 143) =>
  `<path d="M ${xl - 11} ${y + 2} Q ${xl - 2} ${y + 1} ${xl + 10} ${y - 6} M ${xr - 10} ${y - 6} Q ${xr + 2} ${y + 1} ${xr + 11} ${y + 2}" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/>`

/** 短袖或長袖的手臂（待機下垂），左右對稱。回傳 [袖子＋手臂, 拳頭] */
function idleArms(p: string, sleeve: 'short' | 'long', fill: string, shade?: string, pattern?: string): [string, string] {
  if (sleeve === 'short') {
    const sl = 'M 72 170 C 58 176, 50 192, 50 210 L 73 214 L 77 190 Z'
    const arm = 'M 52 207 C 48 226, 48 244, 52 258 L 70 258 C 70 244, 72 226, 73 211 Z'
    return [
      cloth(sl, fill, undefined, pattern) + skin(arm, p) + cloth(mirrorPath(sl, 120), fill, shade, pattern) + skin(mirrorPath(arm, 120), p),
      fist(p, 61, 264, 11, 12) + fist(p, 179, 264, 11, 12, true),
    ]
  }
  const sl = 'M 72 170 C 58 176, 50 192, 48 214 L 46 252 L 70 254 L 73 214 L 77 190 Z'
  return [cloth(sl, fill, undefined, pattern) + cloth(mirrorPath(sl, 120), fill, shade, pattern), fist(p, 58, 262, 11, 12) + fist(p, 182, 262, 11, 12, true)]
}

/** 長褲（到腳踝） */
const longPants = (fill: string, shade?: string, pattern?: string) =>
  cloth('M 62 250 L 178 250 L 176 336 L 128 336 L 121 282 L 119 282 L 112 336 L 64 336 Z', fill, shade, pattern) +
  `<path d="M 88 262 L 87 334 M 152 262 L 153 334" stroke="${OUT}" stroke-width="1.4" stroke-linecap="round" opacity="0.25"/>`

/** 短褲＋小腿 */
function shortsLegs(p: string, fill: string, shade?: string, cargo = false): string {
  return `
    ${cloth('M 60 250 L 180 250 L 187 304 L 128 306 L 122 280 L 118 280 L 112 306 L 53 304 Z', fill, shade)}
    ${cargo ? `<path d="M 56 276 L 80 276 L 80 296 L 56 296 Z M 160 276 L 184 276 L 184 296 L 160 296 Z" fill="none" stroke="${OUT}" stroke-width="2" stroke-linejoin="round" opacity="0.55"/><path d="M 56 282 L 80 282 M 160 282 L 184 282" stroke="${OUT}" stroke-width="1.6" opacity="0.4"/>` : ''}
    ${skin('M 70 302 L 106 302 L 104 339 Q 90 343 76 339 Z', p)}
    ${skin('M 134 302 L 170 302 L 164 339 Q 150 343 136 339 Z', p)}
    <path d="M 132 304 L 170 304 L 168 320 Q 150 316 134 318 Z" fill="#9a5a3a" opacity="0.18"/>`
}

const sneaker = (x: number, col: string, stripe: string) => `
  <path d="M ${x - 23} 350 Q ${x - 24} 334 ${x - 4} 334 Q ${x + 16} 332 ${x + 23} 344 L ${x + 23} 350 Z" fill="${col}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M ${x - 23} 350 L ${x + 23} 350" stroke="#f4f2ec" stroke-width="4" stroke-linecap="round"/>
  <path d="M ${x - 23} 350 L ${x + 23} 350" stroke="${OUT}" stroke-width="1.2" opacity="0.5"/>
  <path d="M ${x - 12} 342 L ${x + 10} 338" stroke="${stripe}" stroke-width="3" stroke-linecap="round"/>`
const flat = (x: number, col: string) => `<path d="M ${x - 21} 350 Q ${x - 22} 338 ${x} 338 Q ${x + 22} 338 ${x + 21} 350 Z" fill="${col}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>`
const dressShoe = (x: number) => `<path d="M ${x - 22} 349 Q ${x - 22} 335 ${x} 335 Q ${x + 22} 335 ${x + 22} 349 Z" fill="#1d1d22" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M ${x - 12} 339 Q ${x - 4} 336 ${x + 6} 338" fill="none" stroke="#6a6a74" stroke-width="2" stroke-linecap="round"/>`
/** 藍白拖 */
function blueWhite(p: string, x: number): string {
  return `
    <ellipse cx="${x}" cy="349" rx="22" ry="7" fill="#3d6fb8" stroke="${OUT}" stroke-width="2.4"/>
    <ellipse cx="${x}" cy="345.5" rx="21" ry="6" fill="#f5f7fa" stroke="${OUT}" stroke-width="2"/>
    <ellipse cx="${x}" cy="341" rx="13" ry="5.5" fill="url(#${p}SkinDark)" stroke="${OUT}" stroke-width="2"/>
    <path d="M ${x - 13} 345 Q ${x} 333 ${x + 13} 345" fill="none" stroke="${OUT}" stroke-width="7" stroke-linecap="round"/>
    <path d="M ${x - 13} 345 Q ${x} 333 ${x + 13} 345" fill="none" stroke="#4a82d0" stroke-width="4.4" stroke-linecap="round"/>`
}
/** 登山涼鞋：鞋底＋交叉綁帶 */
function sandal(p: string, x: number): string {
  return `
    <ellipse cx="${x}" cy="348" rx="22" ry="6.5" fill="#4a3a2a" stroke="${OUT}" stroke-width="2.4"/>
    <ellipse cx="${x}" cy="341" rx="14" ry="6" fill="url(#${p}SkinDark)" stroke="${OUT}" stroke-width="2"/>
    <path d="M ${x - 14} 346 L ${x + 12} 336 M ${x + 14} 346 L ${x - 12} 336" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>
    <path d="M ${x - 14} 346 L ${x + 12} 336 M ${x + 14} 346 L ${x - 12} 336" stroke="#6b7a3a" stroke-width="3.6" stroke-linecap="round"/>`
}
const neckPart = (p: string, y0 = 150, y1 = 168) =>
  `<path d="M 108 ${y0} L 132 ${y0} L 133 ${y1} Q 120 ${y1 + 6} 107 ${y1} Z" fill="url(#${p}SkinDark)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
const skinDefs = (p: string, light: string, dark: string, dl: string, dd: string, headR: [number, number, number]) => `
    ${lin(`${p}Skin`, light, dark)}
    ${lin(`${p}SkinDark`, dl, dd)}
    <clipPath id="${p}HeadClip"><circle cx="${headR[0]}" cy="${headR[1]}" r="${headR[2]}"/></clipPath>`

const ADULT_BODY = 'M 94 160 Q 120 170 146 160 L 168 170 Q 180 176 182 194 L 184 256 Q 120 266 56 256 L 58 194 Q 60 176 72 170 Z'

// ===========================================================================
// 阿凱（靈異 YouTuber，20 多歲）：反戴紅帽、染咖啡色亂髮、黑帽 T
// ===========================================================================

const AK_HEAD = { x: 120, y: 104, r: 56 }

function akaiSvg(mood: NpcMood): string {
  const { x, y, r } = AK_HEAD
  const p = 'ak'
  const defs = `<defs>
    ${skinDefs(p, '#ffe2c8', '#edb690', '#f6c8a6', '#e0a27c', [x, y, r])}
    ${lin('akHair', '#a8703f', '#6e4424')}
    ${lin('akCap', '#ef5a4c', '#b8302a')}
    ${lin('akHood', '#45454f', '#1e1e24')}
    ${shadeGrad('akHoodShade', '#000', 0.4)}
    ${lin('akJeans', '#51618a', '#2c3756')}
    ${shadeGrad('akJeansShade', '#0c1226', 0.3)}
  </defs>`
  const hood = `<path d="M 80 162 C 78 146, 96 140, 120 140 C 144 140, 162 146, 160 162 C 150 176, 90 176, 80 162 Z" fill="#26262c" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
  const [arms, fists] = idleArms(p, 'long', 'url(#akHood)', 'url(#akHoodShade)')
  const body = `
    ${longPants('url(#akJeans)', 'url(#akJeansShade)')}
    ${sneaker(90, '#f2f1ec', '#e0453a')}${sneaker(150, '#e6e4de', '#e0453a')}
    ${cloth(ADULT_BODY, 'url(#akHood)', 'url(#akHoodShade)')}
    ${hood}
    <path d="M 86 226 L 154 226 L 160 254 L 80 254 Z" fill="none" stroke="#5a5a66" stroke-width="2" stroke-linejoin="round"/>
    <path d="M 110 168 L 108 200 M 130 168 L 132 200" stroke="#f2f0ea" stroke-width="3" stroke-linecap="round"/>
    <circle cx="108" cy="202" r="3" fill="#bdbdc4" stroke="${OUT}" stroke-width="1.2"/><circle cx="132" cy="202" r="3" fill="#bdbdc4" stroke="${OUT}" stroke-width="1.2"/>
    <circle cx="150" cy="198" r="11" fill="#e0453a" stroke="${OUT}" stroke-width="2"/>
    <path d="M 144 203 L 144 196 Q 150 186 156 196 L 156 203 L 153 200 L 150 203 L 147 200 Z" fill="#fff"/>
    <circle cx="148" cy="196" r="1.2" fill="${OUT}"/><circle cx="152" cy="196" r="1.2" fill="${OUT}"/>
    ${arms}
    <g transform="translate(46 272) rotate(-8)">
      <rect x="-12" y="-9" width="26" height="18" rx="3" fill="#2a2a30" stroke="${OUT}" stroke-width="2.4"/>
      <circle cx="16" cy="0" r="6" fill="#3a4a66" stroke="${OUT}" stroke-width="2"/>
      <circle cx="-7" cy="-5" r="1.8" fill="#ff4a3a"/>
    </g>
    ${fists}`
  const lock = 'M 62 92 L 56 104 L 66 102 L 62 116 L 72 108 L 72 122 L 80 108 L 84 94 Z'
  const tuft = `
    <path d="${lock}" fill="url(#akHair)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="${mirrorPath(lock, 120)}" fill="url(#akHair)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>`
  const cap = `
    <path d="M 62 96 C 60 58, 88 40, 120 40 C 152 40, 180 58, 178 96 C 160 86, 142 82, 136 82 L 104 82 C 98 82, 80 86, 62 96 Z" fill="url(#akCap)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 120 41 L 120 82 M 90 50 Q 100 64 102 82 M 150 50 Q 140 64 138 82" fill="none" stroke="#9a2620" stroke-width="1.8" opacity="0.7"/>
    <path d="M 78 60 Q 94 46 116 44" fill="none" stroke="#ff9a8a" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
    <!-- 反戴：前面露出調整帶的開口，頭髮從裡面翹出來 -->
    <path d="M 102 84 Q 120 62 138 84 Z" fill="url(#akHair)" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M 108 84 L 112 70 L 118 82 L 124 66 L 128 82 L 134 72" fill="none" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M 100 86 L 140 86" stroke="${OUT}" stroke-width="7" stroke-linecap="round"/>
    <path d="M 100 86 L 140 86" stroke="#c9362c" stroke-width="4.4" stroke-linecap="round"/>
    <circle cx="112" cy="86" r="1.3" fill="#fff"/><circle cx="120" cy="86" r="1.3" fill="#fff"/><circle cx="128" cy="86" r="1.3" fill="#fff"/>`
  let face: string
  if (mood === 'surprised') face = `${browsUp(106)}${eyesWide(124)}${nose(120, 136)}${mouthO(120, 150)}${sweat(178, 90, 1)}`
  else if (mood === 'happy') face = `${browsSoft(104)}${eyesHappy(124)}${nose(120, 136)}${blush(84, 138, 11, 6, '#f5968f', 0.5)}${blush(156, 138, 11, 6, '#f5968f', 0.5)}${mouthGrin(120, 144, 16, true)}`
  else face = `${browsUp(106)}${eyesOpen(124)}${nose(120, 136)}${mouthGrin(120, 144, 15, true)}`
  const head = `
    ${ears(p, 64, 176, 118, '#d99a7a')}
    ${headBase(p, x, y, r, '#e5a784')}
    ${tuft}
    ${face}
    ${cap}`
  return svg(NPC_SIZE.w, NPC_SIZE.h, `${defs}${body}${head}`)
}

// ===========================================================================
// 張經理（商務客，40 多歲）：旁分、細框眼鏡、白襯衫、鬆掉的領帶
// ===========================================================================

const ZH_HEAD = { x: 120, y: 102, r: 55 }

function zhangSvg(mood: NpcMood): string {
  const { x, y, r } = ZH_HEAD
  const p = 'zh'
  const defs = `<defs>
    ${skinDefs(p, '#ffe2c8', '#ecb892', '#f5c9a8', '#dea07c', [x, y, r])}
    ${lin('zhHair', '#3a3538', '#121012')}
    ${lin('zhShirt', '#ffffff', '#dde3ea')}
    ${shadeGrad('zhShirtShade', '#4a5a78', 0.22)}
    ${lin('zhTie', '#34507e', '#1a2a4c')}
    ${lin('zhPants', '#6e7482', '#484d58')}
  </defs>`
  const [arms, fists] = idleArms(p, 'long', 'url(#zhShirt)', 'url(#zhShirtShade)')
  const body = `
    ${longPants('url(#zhPants)')}
    ${dressShoe(90)}${dressShoe(150)}
    ${cloth(ADULT_BODY, 'url(#zhShirt)', 'url(#zhShirtShade)')}
    ${neckPart(p, 150, 166)}
    <path d="M 112 160 L 120 172 L 128 160 Z" fill="url(#zhSkinDark)"/>
    <!-- 襯衫領 -->
    <path d="M 98 160 L 116 176 L 106 184 L 90 168 Z M 142 160 L 124 176 L 134 184 L 150 168 Z" fill="#ffffff" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M 120 180 L 120 256" stroke="#b9c2ce" stroke-width="1.8"/>
    ${[196, 216, 236].map((yy) => `<circle cx="124" cy="${yy}" r="2.2" fill="#e8ecf0" stroke="${OUT}" stroke-width="1"/>`).join('')}
    <!-- 鬆掉的領帶：結往下、歪一邊 -->
    <g transform="rotate(6 122 180)">
      <path d="M 114 176 L 130 176 L 127 188 L 117 188 Z" fill="url(#zhTie)" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M 117 188 L 127 188 L 133 236 L 122 248 L 111 236 Z" fill="url(#zhTie)" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M 116 202 L 131 214 M 114 220 L 132 232" stroke="#6a86b8" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>
    </g>
    ${arms}${fists}`
  const hair = `
    <path d="M 66 112 C 58 78, 78 48, 114 45 C 152 42, 182 64, 176 108 C 172 94, 166 84, 158 78 C 140 70, 120 70, 104 74 C 88 80, 74 94, 66 112 Z" fill="url(#zhHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- 旁分：髮線在右邊，往左梳過去 -->
    <path d="M 148 48 C 124 46, 94 56, 74 86 C 96 70, 124 64, 152 64 Z" fill="#2a2628" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M 146 50 Q 150 58 150 65" fill="none" stroke="#050405" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
    <path d="M 88 66 Q 108 54 132 52" fill="none" stroke="#7a7478" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>`
  const glasses = `
    <rect x="80" y="108" width="34" height="22" rx="5" fill="#fff" fill-opacity="0.12" stroke="#2a2a30" stroke-width="2.6"/>
    <rect x="126" y="108" width="34" height="22" rx="5" fill="#fff" fill-opacity="0.12" stroke="#2a2a30" stroke-width="2.6"/>
    <path d="M 114 116 Q 120 113 126 116 M 80 114 L 66 110 M 160 114 L 174 110" fill="none" stroke="#2a2a30" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M 86 112 L 94 112 M 132 112 L 140 112" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>`
  const tiredEye = (ex: number) => `
    <path d="M ${ex - 7} 118 L ${ex + 7} 118 Q ${ex + 7} 126 ${ex} 126.5 Q ${ex - 7} 126 ${ex - 7} 118 Z" fill="#2c211e"/>
    <path d="M ${ex - 10} 117.5 L ${ex + 10} 117.5" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${ex - 2.2}" cy="121" r="1.6" fill="#fff"/>`
  const bags = `<path d="M 88 131 Q 97 135 106 131 M 134 131 Q 143 135 152 131" fill="none" stroke="#a87890" stroke-width="1.8" stroke-linecap="round" opacity="0.6"/>`
  let face: string
  if (mood === 'surprised') face = `${browsUp(102, '#1c1a1c')}${eyesWide(120)}${nose(120, 136)}${mouthO(120, 150)}${sweat(176, 86, 1)}`
  else if (mood === 'happy') face = `${browsSoft(102, '#1c1a1c')}${eyesHappy(121, 97, 143, 9)}${bags}${nose(120, 136)}${mouthSmile(120, 145, 11)}`
  else face = `<path d="M 86 103 Q 97 100 108 104 M 132 104 Q 143 100 154 103" fill="none" stroke="#1c1a1c" stroke-width="3.6" stroke-linecap="round"/>${tiredEye(97)}${tiredEye(143)}${bags}${nose(120, 136)}<path d="M 110 148 Q 120 145 130 148" fill="none" stroke="${OUT}" stroke-width="2.7" stroke-linecap="round"/>`
  const head = `
    ${ears(p, 65, 175, 116, '#d99a7a')}
    ${headBase(p, x, y, r, '#e3a582')}
    ${face}
    ${glasses}
    ${hair}`
  return svg(NPC_SIZE.w, NPC_SIZE.h, `${defs}${body}${head}`)
}

// ===========================================================================
// 阿豪（背包客，20 多歲）：頭巾、鬍渣、軍綠 T、工作短褲、登山涼鞋
// ===========================================================================

const AH_HEAD = { x: 120, y: 104, r: 56 }

function ahaoSvg(mood: NpcMood): string {
  const { x, y, r } = AH_HEAD
  const p = 'ah'
  const defs = `<defs>
    ${skinDefs(p, '#f2c6a0', '#d49a70', '#e3b08a', '#c68a62', [x, y, r])}
    ${lin('ahHair', '#3a302b', '#161211')}
    ${lin('ahTee', '#8e9862', '#646c3e')}
    ${shadeGrad('ahTeeShade', '#2a3010', 0.34)}
    ${lin('ahShorts', '#c8b080', '#9c8452')}
    ${shadeGrad('ahShortsShade', '#4a3a1a', 0.3)}
    ${lin('ahBand', '#3aa892', '#227a68')}
    <clipPath id="ahJaw"><path d="M 60 120 Q 70 164 120 164 Q 170 164 180 120 L 180 172 L 60 172 Z"/></clipPath>
  </defs>`
  const [arms, fists] = idleArms(p, 'short', 'url(#ahTee)', 'url(#ahTeeShade)')
  const body = `
    ${shortsLegs(p, 'url(#ahShorts)', 'url(#ahShortsShade)', true)}
    ${sandal(p, 90)}${sandal(p, 150)}
    ${cloth(ADULT_BODY, 'url(#ahTee)', 'url(#ahTeeShade)')}
    ${neckPart(p)}
    <path d="M 100 163 Q 120 176 140 163" fill="none" stroke="#56602e" stroke-width="4" stroke-linecap="round"/>
    ${arms}
    <!-- 手腕上的編織手環 -->
    <path d="M 52 250 L 70 250" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/><path d="M 52 250 L 70 250" stroke="#e0703a" stroke-width="3.4" stroke-linecap="round"/>
    ${fists}`
  const rnd = (i: number) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1
  const stubble = Array.from({ length: 50 }, (_, i) => {
    const a = Math.PI * (0.1 + 0.8 * rnd(i))
    const d = 34 + rnd(i + 99) * 20
    return `<circle cx="${(x - Math.cos(a) * d).toFixed(1)}" cy="${(y + 20 + Math.sin(a) * d * 0.7).toFixed(1)}" r="${(0.9 + rnd(i + 7) * 0.7).toFixed(2)}" fill="#5a4436" opacity="0.5"/>`
  }).join('')
  const hair = `
    <path d="M 66 100 C 62 70, 84 48, 120 46 C 156 48, 178 70, 174 100 L 164 96 L 76 96 Z" fill="url(#ahHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 84 58 L 88 44 L 98 54 L 104 38 L 114 52 L 122 36 L 130 52 L 140 40 L 146 56 L 156 46 L 158 62" fill="url(#ahHair)" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>`
  const band = `
    <path d="M 64 100 C 80 82, 160 82, 176 100 L 174 114 C 158 98, 82 98, 66 114 Z" fill="url(#ahBand)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    ${[[80, 100], [96, 94], [112, 92], [128, 92], [144, 94], [160, 100]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="2" fill="#e8fff6"/>`).join('')}
    <!-- 結打在一邊，兩條尾巴垂下來 -->
    <circle cx="178" cy="104" r="7" fill="url(#ahBand)" stroke="${OUT}" stroke-width="2.4"/>
    <path d="M 180 108 L 192 132 L 184 134 L 176 112 Z M 182 106 L 198 122 L 192 128 L 178 110 Z" fill="url(#ahBand)" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/>`
  const relaxedEye = (ex: number) => `<path d="M ${ex - 8} 122 Q ${ex} 116 ${ex + 8} 122 Q ${ex + 7} 129 ${ex} 129.5 Q ${ex - 7} 129 ${ex - 8} 122 Z" fill="#2c211e"/><path d="M ${ex - 10} 121 Q ${ex} 114 ${ex + 10} 121" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/><circle cx="${ex - 2}" cy="123.5" r="1.7" fill="#fff"/>`
  let face: string
  if (mood === 'surprised') face = `${browsUp(110, '#2a2320')}${eyesWide(124)}${nose(120, 138, '#b87858')}${mouthO(120, 152)}${sweat(62, 84, 0.9)}`
  else if (mood === 'happy') face = `${browsSoft(110, '#2a2320')}${eyesHappy(125)}${nose(120, 138, '#b87858')}${mouthGrin(120, 146, 15, true)}`
  else face = `${browsSoft(110, '#2a2320')}${relaxedEye(97)}${relaxedEye(143)}${nose(120, 138, '#b87858')}<path d="M 104 148 Q 120 156 136 143" fill="none" stroke="${OUT}" stroke-width="2.7" stroke-linecap="round"/>`
  const head = `
    ${ears(p, 64, 176, 118, '#b87858')}
    ${headBase(p, x, y, r, '#c98c66')}
    <g clip-path="url(#ahHeadClip)"><g clip-path="url(#ahJaw)">${stubble}</g></g>
    ${face}
    ${hair}
    ${band}`
  return svg(NPC_SIZE.w, NPC_SIZE.h, `${defs}${body}${head}`)
}

// ===========================================================================
// 小宇（7 歲，看得到阿嬤）：西瓜皮、大眼睛、黃色條紋 T、藍短褲、紅球鞋
// ===========================================================================

const XY_HEAD = { x: 120, y: 118, r: 64 }

function xiaoyuSvg(mood: NpcMood): string {
  const { x, y, r } = XY_HEAD
  const p = 'xy'
  const defs = `<defs>
    ${skinDefs(p, '#ffe8d4', '#f2c29e', '#f8d0b0', '#e6ae88', [x, y, r])}
    ${lin('xyHair', '#3a2c2a', '#140e0e')}
    ${lin('xyTee', '#ffe06a', '#f2c030')}
    ${shadeGrad('xyTeeShade', '#8a5a00', 0.26)}
    <pattern id="xyStripe" patternUnits="userSpaceOnUse" width="20" height="20"><rect y="10" width="20" height="7" fill="#f08a3a"/></pattern>
    ${lin('xyShorts', '#5c8ad8', '#3a64b0')}
    ${shadeGrad('xyShortsShade', '#10205a', 0.3)}
  </defs>`
  const torso = 'M 96 180 Q 120 188 144 180 L 164 188 Q 176 194 178 210 L 180 262 Q 120 272 60 262 L 62 210 Q 64 194 76 188 Z'
  const sl = 'M 76 188 C 64 194, 58 206, 58 220 L 76 224 L 80 204 Z'
  const arm = 'M 60 218 C 56 234, 56 248, 60 260 L 76 260 C 76 248, 76 234, 76 222 Z'
  const body = `
    ${cloth('M 64 256 L 176 256 L 182 300 L 126 302 L 121 282 L 119 282 L 114 302 L 58 300 Z', 'url(#xyShorts)', 'url(#xyShortsShade)')}
    ${skin('M 72 298 L 106 298 L 104 330 Q 90 334 76 330 Z', p)}${skin('M 134 298 L 168 298 L 164 330 Q 150 334 136 330 Z', p)}
    ${sneaker(90, '#e2463a', '#ffffff')}${sneaker(150, '#d23a30', '#ffffff')}
    ${cloth(torso, 'url(#xyTee)', 'url(#xyTeeShade)', 'url(#xyStripe)')}
    ${neckPart(p, 170, 184)}
    <path d="M 102 182 Q 120 194 138 182" fill="none" stroke="#e0a020" stroke-width="4" stroke-linecap="round"/>
    ${cloth(sl, 'url(#xyTee)', undefined, 'url(#xyStripe)')}${skin(arm, p)}
    ${cloth(mirrorPath(sl, 120), 'url(#xyTee)', 'url(#xyTeeShade)', 'url(#xyStripe)')}${skin(mirrorPath(arm, 120), p)}
    ${fist(p, 68, 266, 10, 11)}${fist(p, 172, 266, 10, 11, true)}`
  const hair = `
    <path d="M 55 128 C 50 76, 80 50, 120 50 C 160 50, 190 76, 185 128 L 176 124 C 176 112, 172 104, 168 98 L 72 98 C 68 104, 64 112, 64 124 Z" fill="url(#xyHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 72 98 L 168 98" stroke="${OUT}" stroke-width="${SW}" stroke-linecap="round"/>
    <path d="M 84 98 L 86 92 M 100 98 L 101 91 M 116 98 L 116 91 M 132 98 L 132 91 M 148 98 L 147 92" stroke="#4a3a38" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M 78 72 Q 100 56 128 56" fill="none" stroke="#8a7a78" stroke-width="3.4" stroke-linecap="round" opacity="0.8"/>`
  const bigEye = (ex: number, ey: number) => `
    <ellipse cx="${ex}" cy="${ey}" rx="10.5" ry="13.5" fill="#2c211e"/>
    <circle cx="${ex - 3.6}" cy="${ey - 5}" r="4" fill="#fff"/>
    <circle cx="${ex + 3.4}" cy="${ey + 4.6}" r="2" fill="#fff"/>
    <circle cx="${ex - 5}" cy="${ey + 5}" r="1.1" fill="#fff" opacity="0.8"/>`
  let face: string
  if (mood === 'surprised') face = `${browsUp(106, '#3a2c2a', 96, 144)}${eyesWide(130, 96, 144)}${nose(120, 144)}${mouthO(120, 158)}`
  else if (mood === 'happy') face = `${browsSoft(108, '#3a2c2a', 96, 144)}${eyesHappy(131, 96, 144, 12)}${nose(120, 144)}${mouthGrin(120, 152, 14)}`
  else face = `${browsSoft(108, '#3a2c2a', 96, 144)}${bigEye(96, 130)}${bigEye(144, 130)}${nose(120, 146)}<path d="M 110 156 Q 120 164 130 156 Q 120 159 110 156 Z" fill="#94393f" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/>`
  const head = `
    ${ears(p, 56, 184, 130, '#dfa07c')}
    ${headBase(p, x, y, r, '#eab08c')}
    ${blush(80, 150, 14, 8, '#f78a90', 0.55)}${blush(160, 150, 14, 8, '#f78a90', 0.55)}
    ${face}
    ${hair}`
  return svg(NPC_SIZE.w, NPC_SIZE.h, `${defs}${body}${head}`)
}

// ===========================================================================
// 林太太（小宇的媽媽，30 多歲）：低馬尾、側分瀏海、米色開襟外套、有點緊張
// ===========================================================================

const LM_HEAD = { x: 120, y: 104, r: 55 }

function linmomSvg(mood: NpcMood): string {
  const { x, y, r } = LM_HEAD
  const p = 'lm'
  const defs = `<defs>
    ${skinDefs(p, '#ffe6d2', '#f0bd9a', '#f7cfb0', '#e3aa86', [x, y, r])}
    ${lin('lmHair', '#5a4036', '#2e1f1a')}
    ${lin('lmCardi', '#efdfc2', '#cdb48e')}
    ${shadeGrad('lmCardiShade', '#6a5030', 0.3)}
    ${lin('lmTop', '#c2dcf2', '#94b8dc')}
    ${lin('lmPants', '#3e4c74', '#232d4a')}
  </defs>`
  const backHair = `<path d="M 64 118 C 56 74, 84 46, 120 46 C 156 46, 184 74, 176 118 L 176 150 C 160 156, 80 156, 64 150 Z" fill="url(#lmHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
  const cardiL = 'M 94 160 L 110 176 L 108 262 Q 82 262 56 256 L 58 194 Q 60 176 72 170 Z'
  const sl = 'M 72 170 C 58 176, 50 192, 48 214 L 46 252 L 70 254 L 73 214 L 77 190 Z'
  const body = `
    ${longPants('url(#lmPants)')}
    ${flat(90, '#8a5638')}${flat(150, '#7a4a30')}
    ${cloth(ADULT_BODY, 'url(#lmTop)')}
    ${neckPart(p)}
    <path d="M 102 164 Q 120 178 138 164" fill="none" stroke="#7a9cc2" stroke-width="3" stroke-linecap="round"/>
    ${cloth(cardiL, 'url(#lmCardi)')}${cloth(mirrorPath(cardiL, 120), 'url(#lmCardi)', 'url(#lmCardiShade)')}
    ${[186, 212, 238].map((yy) => `<circle cx="104" cy="${yy}" r="2.8" fill="#fff6e6" stroke="${OUT}" stroke-width="1.2"/>`).join('')}
    ${cloth(sl, 'url(#lmCardi)')}${cloth(mirrorPath(sl, 120), 'url(#lmCardi)', 'url(#lmCardiShade)')}
    <!-- 緊張：兩手在身體前面握在一起 -->
    ${skin('M 54 250 C 66 262, 88 266, 108 258 L 104 246 C 88 252, 70 248, 64 242 Z', p)}
    ${skin(mirrorPath('M 54 250 C 66 262, 88 266, 108 258 L 104 246 C 88 252, 70 248, 64 242 Z', 120), p)}
    ${fist(p, 112, 256, 11, 11)}${fist(p, 128, 256, 11, 11, true)}
    <!-- 低馬尾甩到肩膀前面 -->
    <path d="M 74 150 C 60 170, 60 200, 70 226 C 80 212, 84 186, 88 160 Z" fill="url(#lmHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 74 176 Q 72 196 74 212" fill="none" stroke="#8a6a5c" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <ellipse cx="80" cy="154" rx="8" ry="5" fill="#e07a8a" stroke="${OUT}" stroke-width="2"/>`
  const bangs = `
    <path d="M 64 118 C 58 80, 84 50, 122 48 C 158 48, 182 70, 178 114 C 172 98, 160 86, 146 80 C 122 86, 94 98, 72 120 Z" fill="url(#lmHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 146 52 L 150 80" stroke="#8a6a5c" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>
    <path d="M 84 70 Q 104 58 130 56" fill="none" stroke="#9a7a6c" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`
  const lashEye = (ex: number, sd: number) => `
    <ellipse cx="${ex}" cy="124" rx="6.5" ry="9" fill="#2c211e"/>
    <circle cx="${ex - 2.4}" cy="120.5" r="2.5" fill="#fff"/><circle cx="${ex + 2.2}" cy="127.5" r="1.2" fill="#fff" opacity="0.85"/>
    <path d="M ${ex - 9} 116 Q ${ex} 111 ${ex + 9} 116" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>
    <path d="M ${ex + sd * 8} 115 L ${ex + sd * 13} 111" stroke="${OUT}" stroke-width="2.2" stroke-linecap="round"/>`
  let face: string
  if (mood === 'surprised') face = `${browsWorried(104, '#3a2a24')}${eyesWide(124)}${nose(120, 137)}${mouthO(120, 150)}${sweat(64, 88, 0.9)}`
  else if (mood === 'happy') face = `${browsSoft(106, '#3a2a24')}${eyesHappy(125)}${nose(120, 137)}${mouthSmile(120, 145, 11)}`
  else face = `${browsWorried(106, '#3a2a24')}${lashEye(97, -1)}${lashEye(143, 1)}${nose(120, 137)}<path d="M 112 147 Q 120 151 128 147" fill="none" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`
  const head = `
    ${ears(p, 65, 175, 118, '#d99a7a')}
    <circle cx="65" cy="130" r="3" fill="#f2f0ea" stroke="${OUT}" stroke-width="1.2"/><circle cx="175" cy="130" r="3" fill="#f2f0ea" stroke="${OUT}" stroke-width="1.2"/>
    ${headBase(p, x, y, r, '#e8ad8a')}
    ${blush(84, 138, 11, 6, '#f5968f', 0.42)}${blush(156, 138, 11, 6, '#f5968f', 0.42)}
    ${face}
    ${bangs}`
  return svg(NPC_SIZE.w, NPC_SIZE.h, `${defs}${backHair}${body}${head}`)
}

// ===========================================================================
// 阿土伯（阿桂的老伴，80 多歲）：禿頭、兩側白髮、白眉毛、圓眼鏡、格子襯衫、拐杖
// ===========================================================================

const AT_HEAD = { x: 120, y: 104, r: 57 }

function atuSvg(mood: NpcMood): string {
  const { x, y, r } = AT_HEAD
  const p = 'at'
  const defs = `<defs>
    ${skinDefs(p, '#fcdcc0', '#e2a882', '#efc09c', '#d49672', [x, y, r])}
    ${lin('atShirt', '#c4d0dc', '#9aabbe')}
    ${shadeGrad('atShirtShade', '#2a3a52', 0.3)}
    <pattern id="atPlaid" patternUnits="userSpaceOnUse" width="26" height="26">
      <rect x="0" y="9" width="26" height="7" fill="#6f88a6" opacity="0.55"/><rect x="9" y="0" width="7" height="26" fill="#6f88a6" opacity="0.55"/>
      <rect x="0" y="21" width="26" height="2" fill="#f2ecdc" opacity="0.8"/><rect x="21" y="0" width="2" height="26" fill="#f2ecdc" opacity="0.8"/>
    </pattern>
    ${lin('atPants', '#8a8c92', '#65676e')}
    ${lin('atCane', '#a87a4a', '#6e4a28')}
  </defs>`
  const [arms, fists] = idleArms(p, 'short', 'url(#atShirt)', 'url(#atShirtShade)', 'url(#atPlaid)')
  const body = `
    ${longPants('url(#atPants)')}
    ${blueWhite(p, 90)}${blueWhite(p, 150)}
    ${cloth(ADULT_BODY, 'url(#atShirt)', 'url(#atShirtShade)', 'url(#atPlaid)')}
    ${neckPart(p)}
    <path d="M 98 160 L 116 176 L 106 184 L 90 168 Z M 142 160 L 124 176 L 134 184 L 150 168 Z" fill="url(#atShirt)" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M 120 180 L 120 256" stroke="#6f86a4" stroke-width="1.8"/>
    ${[198, 220, 242].map((yy) => `<circle cx="124" cy="${yy}" r="2.4" fill="#f2ecdc" stroke="${OUT}" stroke-width="1"/>`).join('')}
    ${arms}
    <!-- 拐杖 -->
    <path d="M 60 258 L 46 352" stroke="${OUT}" stroke-width="9" stroke-linecap="round"/>
    <path d="M 60 258 L 46 352" stroke="url(#atCane)" stroke-width="5.4" stroke-linecap="round"/>
    <path d="M 60 258 Q 62 244 74 246" fill="none" stroke="${OUT}" stroke-width="9" stroke-linecap="round"/>
    <path d="M 60 258 Q 62 244 74 246" fill="none" stroke="url(#atCane)" stroke-width="5.4" stroke-linecap="round"/>
    ${fists}`
  const tufts = `
    <path d="M 64 112 C 54 104, 56 88, 66 82 C 64 92, 70 98, 76 100 C 72 104, 70 108, 70 114 Z" fill="#f4f2ec" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M 176 112 C 186 104, 184 88, 174 82 C 176 92, 170 98, 164 100 C 168 104, 170 108, 170 114 Z" fill="#e8e6e0" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M 60 96 Q 64 90 68 92 M 180 96 Q 176 90 172 92" fill="none" stroke="#b8b6b0" stroke-width="1.6" stroke-linecap="round"/>`
  const shine = `<ellipse cx="100" cy="66" rx="18" ry="9" fill="#fff" opacity="0.5" transform="rotate(-20 100 66)"/>`
  const wrinkles = `
    <path d="M 98 80 Q 120 76 142 80 M 102 87 Q 120 84 138 87 M 106 94 Q 120 92 134 94" fill="none" stroke="#c98a6a" stroke-width="1.8" stroke-linecap="round" opacity="0.75"/>
    <path d="M 98 140 Q 93 148 98 158 M 142 140 Q 147 148 142 158" fill="none" stroke="#c98a6a" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>`
  // 白色濃眉（加深色描邊）
  const whiteBrows = (up: boolean) => {
    const d = up ? 'M 82 102 Q 96 92 110 99 M 130 99 Q 144 92 158 102' : 'M 82 106 Q 96 99 110 104 M 130 104 Q 144 99 158 106'
    return `<path d="${d}" fill="none" stroke="${OUT}" stroke-width="9" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#f6f4ee" stroke-width="6" stroke-linecap="round"/>`
  }
  const glasses = `
    <circle cx="97" cy="122" r="15" fill="#fff" fill-opacity="0.12" stroke="#7a5a34" stroke-width="2.6"/>
    <circle cx="143" cy="122" r="15" fill="#fff" fill-opacity="0.12" stroke="#7a5a34" stroke-width="2.6"/>
    <path d="M 112 120 Q 120 116 128 120 M 82 118 L 68 114 M 158 118 L 172 114" fill="none" stroke="#7a5a34" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M 89 114 Q 94 110 100 111 M 135 114 Q 140 110 146 111" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>`
  const kindEye = (ex: number) => `<ellipse cx="${ex}" cy="123" rx="5" ry="6" fill="#2c211e"/><circle cx="${ex - 1.8}" cy="120.8" r="1.8" fill="#fff"/><path d="M ${ex - 8} 118 Q ${ex} 114 ${ex + 8} 118" fill="none" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/><path d="M ${ex + 9} 125 L ${ex + 13} 128 M ${ex - 9} 125 L ${ex - 13} 128" stroke="#c98a6a" stroke-width="1.4" stroke-linecap="round"/>`
  let face: string
  if (mood === 'surprised') face = `${whiteBrows(true)}${eyesWide(122)}${nose(120, 138, '#c08060')}${mouthO(120, 152)}`
  else if (mood === 'happy')
    face = `${whiteBrows(false)}${eyesHappy(123, 97, 143, 9)}${nose(120, 138, '#c08060')}${blush(82, 140, 11, 6, '#f5968f', 0.45)}${blush(158, 140, 11, 6, '#f5968f', 0.45)}
      <path d="M 104 148 Q 120 166 136 148 Q 120 153 104 148 Z" fill="#94393f" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/><path d="M 108 150 L 116 151 L 115 155 L 109 154 Z M 124 151 L 132 150 L 131 154 L 125 155 Z" fill="#fffaf0"/>`
  else face = `${whiteBrows(false)}${kindEye(97)}${kindEye(143)}${nose(120, 138, '#c08060')}<path d="M 108 148 Q 120 156 132 148" fill="none" stroke="${OUT}" stroke-width="2.7" stroke-linecap="round"/>`
  const head = `
    ${ears(p, 62, 178, 118, '#c9876a')}
    ${headBase(p, x, y, r, '#dc9f7c')}
    ${shine}${wrinkles}
    ${face}
    ${glasses}
    ${tufts}`
  return svg(NPC_SIZE.w, NPC_SIZE.h, `${defs}${body}${head}`)
}

// ===========================================================================
// 阿嬌（柑仔店老闆娘，70 幾歲，看得到鬼）：灰色燙髮、碎花上衣、藍圍裙、袖套、老花眼鏡掛胸前、粉紅塑膠拖
// ===========================================================================

const AJ_HEAD = { x: 120, y: 108, r: 57 }

function ajiaoSvg(mood: NpcMood): string {
  const { x, y, r } = AJ_HEAD
  const p = 'aj'
  const defs = `<defs>
    ${skinDefs(p, '#ffe4cc', '#eeb690', '#f6c9a6', '#e0a27c', [x, y, r])}
    ${lin('ajHair', '#f3f2f6', '#b2aebb')}
    ${lin('ajBlouse', '#fdf1f5', '#ead2dc')}
    ${shadeGrad('ajBlouseShade', '#6a3a4a', 0.26)}
    ${flowerPattern('ajFloral', 20, '#e8528a', '#ffe08a', 2.3, '<circle cx="15" cy="5" r="1.8" fill="#6a9ad8"/><circle cx="4" cy="16" r="1.6" fill="#f2a24a"/>')}
    ${lin('ajApron', '#5b8ace', '#2f5a9a')}
    ${shadeGrad('ajApronShade', '#0e2448', 0.34)}
    ${lin('ajCover', '#b4d0f2', '#7ca2d6')}
    ${lin('ajPants', '#4a5070', '#2a2e44')}
  </defs>`
  const [arms, fists] = idleArms(p, 'long', 'url(#ajBlouse)', 'url(#ajBlouseShade)', 'url(#ajFloral)')
  // 袖套：套在前臂，兩端有鬆緊帶的皺褶
  const coverL = 'M 45 216 L 73 216 L 71 256 L 44 254 Z'
  const covers = `
    ${cloth(coverL, 'url(#ajCover)')}${cloth(mirrorPath(coverL, 120), 'url(#ajCover)', 'url(#ajBlouseShade)')}
    <path d="M 46 221 L 72 221 M 45 250 L 71 251 M 168 221 L 194 221 M 169 251 L 195 250" stroke="#5a80b8" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`
  const apron = `
    ${cloth('M 84 248 L 156 248 L 165 320 Q 120 330 75 320 Z', 'url(#ajApron)', 'url(#ajApronShade)')}
    ${cloth('M 98 182 L 142 182 L 146 252 L 94 252 Z', 'url(#ajApron)', 'url(#ajApronShade)')}
    <path d="M 98 183 L 106 162 M 142 183 L 134 162" stroke="${OUT}" stroke-width="7" stroke-linecap="round"/>
    <path d="M 98 183 L 106 162 M 142 183 L 134 162" stroke="#4a78bc" stroke-width="4" stroke-linecap="round"/>
    <path d="M 58 250 L 182 250" stroke="${OUT}" stroke-width="9" stroke-linecap="round"/>
    <path d="M 58 250 L 182 250" stroke="#4a78bc" stroke-width="6" stroke-linecap="round"/>
    <rect x="100" y="274" width="40" height="24" rx="3" fill="#fbfaf4" stroke="${OUT}" stroke-width="2.4"/>
    <path d="M 120 275 L 120 297" stroke="#4a78bc" stroke-width="2"/>`
  // 老花眼鏡：金色細鍊子從脖子兩邊垂下來，眼鏡掛在圍裙上
  const specs = `
    <path d="M 104 166 Q 100 186 108 204 M 136 166 Q 140 186 132 204" fill="none" stroke="#c9962e" stroke-width="1.8" stroke-dasharray="2 1.6"/>
    <circle cx="111" cy="206" r="8" fill="#e6f4fb" fill-opacity="0.75" stroke="#c9962e" stroke-width="2.4"/>
    <circle cx="129" cy="206" r="8" fill="#e6f4fb" fill-opacity="0.75" stroke="#c9962e" stroke-width="2.4"/>
    <path d="M 119 205 Q 120 203 121 205" fill="none" stroke="#c9962e" stroke-width="2"/>
    <path d="M 107 203 L 110 201" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`
  const body = `
    ${longPants('url(#ajPants)')}
    ${skin('M 74 330 L 106 330 L 104 342 L 76 342 Z', p)}${skin('M 134 330 L 166 330 L 164 342 L 136 342 Z', p)}
    ${flat(90, '#e05a8a')}${flat(150, '#cf4a7a')}
    ${cloth(ADULT_BODY, 'url(#ajBlouse)', 'url(#ajBlouseShade)', 'url(#ajFloral)')}
    ${neckPart(p, 156, 170)}
    <path d="M 100 168 Q 120 182 140 168" fill="none" stroke="#b8456a" stroke-width="3.4" stroke-linecap="round"/>
    ${apron}
    ${arms}${covers}
    ${specs}
    ${fists}`
  const curl = (cx: number, cy: number, cr: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${cr}" fill="url(#ajHair)" stroke="${OUT}" stroke-width="2.6"/>
     <path d="M ${cx - cr * 0.45} ${cy - cr * 0.1} Q ${cx} ${cy - cr * 0.6} ${cx + cr * 0.4} ${cy - cr * 0.05}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>`
  const back = `<path d="M 56 132 C 46 88, 76 50, 120 50 C 164 50, 194 88, 184 132 Z" fill="url(#ajHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
  const ring: [number, number, number][] = [
    [60, 128, 11], [55, 110, 12], [60, 90, 12], [72, 72, 13], [90, 58, 13], [110, 51, 13],
    [130, 51, 13], [150, 58, 13], [168, 72, 13], [180, 90, 12], [185, 110, 12], [180, 128, 11],
  ]
  const top: [number, number, number][] = [
    [96, 76, 11], [118, 70, 12], [140, 76, 11], [80, 88, 10], [160, 88, 10],
  ]
  const curls = [...ring, ...top].map(([a, b, c]) => curl(a, b - 1, c)).join('')
  const lines = `
    <path d="M 78 128 L 72 125 M 162 128 L 168 125" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/>
    <path d="M 100 146 Q 95 154 100 162 M 140 146 Q 145 154 140 162" fill="none" stroke="#d59478" stroke-width="1.7" stroke-linecap="round" opacity="0.7"/>`
  let face: string
  if (mood === 'surprised') face = `${browsUp(110, '#8a8490')}${eyesWide(128)}${nose(120, 140)}${mouthO(120, 155)}${sweat(180, 98, 1)}`
  else if (mood === 'happy')
    face = `${browsSoft(112, '#8a8490')}${eyesHappy(129)}${lines}${nose(120, 140)}${blush(84, 146, 13, 8, '#f58f98', 0.55)}${blush(156, 146, 13, 8, '#f58f98', 0.55)}${mouthGrin(120, 148, 15, true)}${sparkle(40, 84, 0.9)}${sparkle(200, 72, 0.7, '#fff4c2')}`
  else face = `${browsSoft(112, '#8a8490')}${eyesOpen(128)}${lines}${nose(120, 140)}${blush(84, 146, 13, 8, '#f58f98', 0.5)}${blush(156, 146, 13, 8, '#f58f98', 0.5)}${mouthGrin(120, 148, 14, true)}`
  const head = `
    ${back}
    ${ears(p, 62, 178, 132, '#d99a7a')}
    <circle cx="62" cy="146" r="4" fill="#f2c14e" stroke="${OUT}" stroke-width="1.6"/><circle cx="178" cy="146" r="4" fill="#f2c14e" stroke="${OUT}" stroke-width="1.6"/>
    ${headBase(p, x, y, r, '#e8ad8a')}
    ${face}
    ${curls}`
  return svg(NPC_SIZE.w, NPC_SIZE.h, `${defs}${body}${head}`)
}

// ===========================================================================
// 金魚伯（鬼夜市撈金魚的好兄弟）：曬黑、汗衫、大肚子、毛巾掛脖子、草帽往後戴，笑嘻嘻。鬼：腳往下漸漸透明
// ===========================================================================

const JY_HEAD = { x: 120, y: 106, r: 57 }

function jinyuboSvg(mood: NpcMood): string {
  const { x, y, r } = JY_HEAD
  const p = 'jy'
  const defs = `<defs>
    ${skinDefs(p, '#f6c8a0', '#d8966a', '#e6b088', '#c8845c', [x, y, r])}
    ${lin('jyShirt', '#fdf6e2', '#e2d2a8')}
    ${shadeGrad('jyShirtShade', '#6b6440', 0.28)}
    ${lin('jyHat', '#fae4a6', '#d8ae5a')}
    ${lin('jyHatIn', '#dcb866', '#a8843a')}
    ${lin('jyTowel', '#ffffff', '#e2e2dc')}
    <linearGradient id="jyShortsFade" gradientUnits="userSpaceOnUse" x1="0" y1="266" x2="0" y2="352">
      <stop offset="0" stop-color="#46649a" stop-opacity="1"/><stop offset="0.4" stop-color="#34507e" stop-opacity="0.7"/><stop offset="1" stop-color="#26385e" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="jySkinFade" gradientUnits="userSpaceOnUse" x1="0" y1="290" x2="0" y2="350">
      <stop offset="0" stop-color="#d8966a" stop-opacity="0.75"/><stop offset="1" stop-color="#d8966a" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="jyOutFade" gradientUnits="userSpaceOnUse" x1="0" y1="266" x2="0" y2="344">
      <stop offset="0" stop-color="${OUT}" stop-opacity="1"/><stop offset="1" stop-color="${OUT}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="jyJaw"><path d="M 62 124 Q 70 166 120 166 Q 170 166 178 124 L 178 176 L 62 176 Z"/></clipPath>
  </defs>`
  const shoulders = `<path d="M 60 172 Q 120 152 180 172 L 184 206 L 56 206 Z" fill="url(#jySkin)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    ${neckPart(p, 152, 168)}`
  const shirtD = 'M 82 162 Q 120 186 158 162 L 162 166 Q 164 190 178 204 Q 200 240 186 268 Q 120 288 54 268 Q 40 240 62 204 Q 76 190 78 166 Z'
  const shirt = cloth(shirtD, 'url(#jyShirt)', 'url(#jyShirtShade)')
  const belly = `<path d="M 88 252 Q 120 264 152 252" fill="none" stroke="#c8bc98" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M 84 208 Q 90 198 100 196" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`
  const shorts = `
    <path d="M 62 264 L 178 264 L 186 314 L 128 316 L 120 292 L 112 316 L 54 314 Z" fill="url(#jyShortsFade)" stroke="url(#jyOutFade)" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 72 316 L 106 316 L 104 350 L 76 350 Z M 134 316 L 168 316 L 164 350 L 136 350 Z" fill="url(#jySkinFade)"/>`
  const armR = 'M 170 178 C 188 190, 196 214, 192 246 L 174 246 C 176 224, 172 206, 162 194 Z'
  const arms = `${skin(mirrorPath(armR, 120), p)}${skin(armR, p)}${fist(p, 56, 250, 12, 12)}${fist(p, 184, 250, 12, 12, true)}`
  // 毛巾：繞過後頸、兩端垂在胸前，尾端一條藍色條紋
  const towel = `
    <path d="M 94 160 Q 120 176 146 160 L 150 172 Q 120 190 90 172 Z" fill="url(#jyTowel)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    ${cloth('M 90 170 L 108 176 L 106 238 L 86 234 Z', 'url(#jyTowel)')}
    ${cloth('M 150 170 L 132 176 L 134 238 L 154 234 Z', 'url(#jyTowel)', 'url(#jyShirtShade)')}
    <path d="M 87 222 L 106 225 M 153 222 L 134 225" stroke="#4a82d0" stroke-width="5"/>
    <path d="M 92 186 L 104 188 M 148 186 L 136 188" stroke="#d6d6ce" stroke-width="1.6" stroke-linecap="round"/>`
  const rnd = (i: number) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1
  const stubble = Array.from({ length: 44 }, (_, i) => {
    const a = Math.PI * (0.12 + 0.76 * rnd(i))
    const d = 36 + rnd(i + 99) * 18
    return `<circle cx="${(x - Math.cos(a) * d).toFixed(1)}" cy="${(y + 20 + Math.sin(a) * d * 0.72).toFixed(1)}" r="${(0.9 + rnd(i + 7) * 0.7).toFixed(2)}" fill="#7a5a48" opacity="0.5"/>`
  }).join('')
  // 草帽往後戴：帽簷像光圈一樣框在頭後面，帽頂蓋住頭頂
  const brim = `
    <ellipse cx="120" cy="62" rx="92" ry="26" fill="url(#jyHat)" stroke="${OUT}" stroke-width="${SW}"/>
    <ellipse cx="120" cy="64" rx="70" ry="17" fill="url(#jyHatIn)" opacity="0.9"/>
    <path d="M 40 66 Q 60 78 84 80 M 200 66 Q 180 78 156 80" fill="none" stroke="#c09848" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>`
  const crown = `
    <path d="M 80 66 C 78 26, 162 26, 160 66 Q 120 78 80 66 Z" fill="url(#jyHat)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 81 58 Q 120 70 159 58 L 160 66 Q 120 78 80 66 Z" fill="#c8503a" stroke="${OUT}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M 94 42 Q 110 32 128 34" fill="none" stroke="#fff6d6" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
    <path d="M 88 52 Q 120 44 152 52" fill="none" stroke="#c09848" stroke-width="1.4" opacity="0.7"/>`
  const sideHair = `
    <path d="M 64 112 C 62 100, 66 90, 72 84 C 72 94, 72 102, 70 112 Z M 176 112 C 178 100, 174 90, 168 84 C 168 94, 168 102, 170 112 Z" fill="#a6a29c" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`
  const wrinkles = `<path d="M 100 84 Q 120 80 140 84 M 104 91 Q 120 88 136 91" fill="none" stroke="#b8805a" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
    <path d="M 78 126 L 72 124 M 162 126 L 168 124" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/>`
  let face: string
  if (mood === 'surprised') face = `${browsUp(104, '#5a5250')}${eyesWide(122)}${nose(120, 137, '#b87858')}${mouthO(120, 154)}${sweat(62, 100, 0.9)}`
  else if (mood === 'happy')
    face = `${browsSoft(106, '#5a5250')}${eyesHappy(123)}${nose(120, 137, '#b87858')}${blush(82, 140, 13, 8, '#f07e76', 0.5)}${blush(158, 140, 13, 8, '#f07e76', 0.5)}${mouthGrin(120, 145, 17, true)}${sparkle(34, 110, 0.9)}${sparkle(206, 104, 0.7, '#fff4c2')}`
  else face = `${browsSoft(106, '#5a5250')}${eyesOpen(122)}${nose(120, 137, '#b87858')}${blush(82, 140, 13, 8, '#f07e76', 0.45)}${blush(158, 140, 13, 8, '#f07e76', 0.45)}${mouthGrin(120, 145, 16, true)}`
  const head = `
    ${brim}
    ${ears(p, 63, 177, 120, '#b87858')}
    ${headBase(p, x, y, r, '#c98c66')}
    <g clip-path="url(#jyHeadClip)"><g clip-path="url(#jyJaw)">${stubble}</g></g>
    ${sideHair}${wrinkles}
    ${face}
    ${crown}`
  return svg(NPC_SIZE.w, NPC_SIZE.h, `${defs}${shoulders}${shirt}${belly}${shorts}${arms}${towel}${head}`)
}

// ===========================================================================
// 紅姨（鬼夜市賣法器的女鬼）：紅色旗袍（立領、斜襟盤扣、金色小花）、中分低髮髻插金簪、翠玉手鐲、半閉的眼睛、口紅。
// 鬼：旗袍下襬往下漸漸透明
// ===========================================================================

const HY_HEAD = { x: 120, y: 104, r: 55 }

function hongyiSvg(mood: NpcMood): string {
  const { x, y, r } = HY_HEAD
  const p = 'hy'
  const defs = `<defs>
    ${skinDefs(p, '#fff4ee', '#ecd0c4', '#f6e0d6', '#dcbcae', [x, y, r])}
    ${lin('hyHair', '#3e3040', '#0c080c')}
    ${lin('hyDress', '#e2424c', '#9a1822')}
    ${shadeGrad('hyDressShade', '#3a0008', 0.38)}
    ${flowerPattern('hyGold', 22, '#e8c066', '#fff0b0', 2.1, '<circle cx="17" cy="6" r="1" fill="#ffe8a0" opacity="0.9"/>')}
    ${lin('hyJade', '#7ce0aa', '#2a9a64')}
    <linearGradient id="hyFadeGrad" gradientUnits="userSpaceOnUse" x1="0" y1="240" x2="0" y2="356">
      <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0.32"/>
    </linearGradient>
    <mask id="hyFade" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="360"><rect width="240" height="360" fill="url(#hyFadeGrad)"/></mask>
  </defs>`
  const dressD = 'M 98 158 Q 120 166 142 158 L 162 168 Q 174 176 174 194 L 168 244 Q 178 300 172 352 L 68 352 Q 62 300 72 244 L 66 194 Q 66 176 78 168 Z'
  const sleeve = 'M 78 168 C 66 172, 60 184, 60 198 L 80 200 Z'
  const armL = 'M 60 196 C 58 216, 64 234, 82 244 L 104 250 L 108 238 C 92 236, 80 226, 78 206 Z'
  const dress = `
    <g mask="url(#hyFade)">
      ${cloth(dressD, 'url(#hyDress)', 'url(#hyDressShade)', 'url(#hyGold)')}
      <path d="M 160 296 L 166 352" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>
      <path d="M 68 350 L 172 350" stroke="#e8c066" stroke-width="3"/>
    </g>
    <!-- 立領＋斜襟、盤扣 -->
    <path d="M 104 150 L 136 150 L 138 166 Q 120 173 102 166 Z" fill="url(#hyDress)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M 104 152 L 136 152" stroke="#e8c066" stroke-width="2"/>
    <path d="M 132 166 Q 146 178 166 186" fill="none" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/>
    <path d="M 132 166 Q 146 178 166 186" fill="none" stroke="#e8c066" stroke-width="2.6" stroke-linecap="round"/>
    ${[[140, 172], [152, 180], [164, 185], [168, 204], [167, 222]].map(([a, b]) => `<path d="M ${a - 5} ${b} L ${a + 5} ${b}" stroke="${OUT}" stroke-width="4.6" stroke-linecap="round"/><path d="M ${a - 5} ${b} L ${a + 5} ${b}" stroke="#f2cf72" stroke-width="2.6" stroke-linecap="round"/><circle cx="${a + 6}" cy="${b}" r="2.4" fill="#f2cf72" stroke="${OUT}" stroke-width="1.2"/>`).join('')}`
  // 兩手在腰前輕輕交握，左手腕一只翠玉手鐲
  const arms = `
    ${cloth(sleeve, 'url(#hyDress)', undefined, 'url(#hyGold)')}${cloth(mirrorPath(sleeve, 120), 'url(#hyDress)', 'url(#hyDressShade)', 'url(#hyGold)')}
    ${skin(armL, p)}${skin(mirrorPath(armL, 120), p)}
    <ellipse cx="97" cy="243" rx="5.5" ry="10" transform="rotate(-62 97 243)" fill="url(#hyJade)" stroke="${OUT}" stroke-width="2.2"/>
    <path d="M 93 240 Q 97 238 101 240" fill="none" stroke="#e8fff2" stroke-width="1.4" stroke-linecap="round"/>
    ${fist(p, 110, 246, 11, 10)}${fist(p, 130, 246, 11, 10, true)}`
  const backHair = `
    <path d="M 64 122 C 56 74, 86 46, 120 46 C 154 46, 184 74, 176 122 L 172 150 Q 120 160 68 150 Z" fill="url(#hyHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- 低髮髻從右後方露出來，插一支金簪、垂一串紅穗 -->
    <circle cx="170" cy="150" r="17" fill="url(#hyHair)" stroke="${OUT}" stroke-width="${SW}"/>
    <path d="M 146 140 L 200 126" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>
    <path d="M 146 140 L 200 126" stroke="#f2c14e" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="202" cy="125" r="4.6" fill="#f2c14e" stroke="${OUT}" stroke-width="1.8"/>
    <path d="M 202 130 L 198 156 L 206 156 Z" fill="#d8322a" stroke="${OUT}" stroke-width="1.8" stroke-linejoin="round"/>`
  const frontHair = `
    <path d="M 63 122 C 58 80, 84 50, 120 49 C 156 50, 182 80, 177 122 C 172 98, 152 76, 122 70 L 118 70 C 88 76, 68 98, 63 122 Z" fill="url(#hyHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 120 50 L 120 70" stroke="#5a4a58" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M 84 70 Q 100 58 116 56 M 150 62 Q 162 70 168 84" fill="none" stroke="#7a6a80" stroke-width="2.6" stroke-linecap="round" opacity="0.8"/>`
  // 半閉的眼睛：上眼皮蓋一半，眼線在外眼角往上挑（sd：外眼角在哪一邊）
  const calmEye = (ex: number, sd: number) => `
    <path d="M ${ex - 7.5} 123 Q ${ex} 134 ${ex + 7.5} 123 Z" fill="#2c211e"/>
    <circle cx="${ex - 2}" cy="127" r="1.7" fill="#fff"/>
    <path d="M ${ex - sd * 10} 124 Q ${ex} 117 ${ex + sd * 9} 122 L ${ex + sd * 14} 117.5" fill="none" stroke="${OUT}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`
  const thinBrows = `<path d="M 85 108 Q 97 101 109 106 M 131 106 Q 143 101 155 108" fill="none" stroke="#2a1e24" stroke-width="2.6" stroke-linecap="round"/>`
  const lips = `<path d="M 111 147 Q 115.5 143 120 145.5 Q 124.5 143 129 147 Q 120 155 111 147 Z" fill="#c8283c" stroke="${OUT}" stroke-width="1.8" stroke-linejoin="round"/><path d="M 113 147.5 Q 120 149 127 147.5" fill="none" stroke="#7a1420" stroke-width="1.2"/>`
  const mole = `<circle cx="134" cy="154" r="1.5" fill="#5a3a3a"/>`
  let face: string
  if (mood === 'surprised') face = `${browsUp(106, '#2a1e24')}${eyesWide(124)}${nose(120, 136, '#d8a898')}<ellipse cx="120" cy="150" rx="5" ry="6.5" fill="#c8283c" stroke="${OUT}" stroke-width="2"/>`
  else if (mood === 'happy')
    face = `${thinBrows}${eyesHappy(125, 97, 143, 9)}${nose(120, 136, '#d8a898')}${blush(84, 140, 11, 6, '#f5a0a8', 0.45)}${blush(156, 140, 11, 6, '#f5a0a8', 0.45)}${lips}${mole}`
  else face = `${thinBrows}${calmEye(97, -1)}${calmEye(143, 1)}${nose(120, 136, '#d8a898')}${lips}${mole}`
  const head = `
    ${ears(p, 65, 175, 120, '#d8a898')}
    <path d="M 65 134 Q 61 142 65 150 Q 69 142 65 134 Z M 175 134 Q 171 142 175 150 Q 179 142 175 134 Z" fill="url(#hyJade)" stroke="${OUT}" stroke-width="1.6"/>
    ${headBase(p, x, y, r, '#e6c6b8')}
    ${face}
    ${frontHair}`
  return svg(NPC_SIZE.w, NPC_SIZE.h, `${defs}${backHair}${dress}${arms}${head}`)
}

// ===========================================================================

/**
 * 配角立繪。pose 不在該角色的姿勢清單裡時用預設姿勢。
 * mood：小翰、客人們（akai、zhang、ahao、xiaoyu、linmom、atu）與阿嬌、金魚伯、紅姨有 normal／happy／surprised，其他人都用 normal。
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
    case 'akai':
      return akaiSvg(mood)
    case 'zhang':
      return zhangSvg(mood)
    case 'ahao':
      return ahaoSvg(mood)
    case 'xiaoyu':
      return xiaoyuSvg(mood)
    case 'linmom':
      return linmomSvg(mood)
    case 'atu':
      return atuSvg(mood)
    case 'ajiao':
      return ajiaoSvg(mood)
    case 'jinyubo':
      return jinyuboSvg(mood)
    case 'hongyi':
      return hongyiSvg(mood)
  }
}

export { sparkle }
