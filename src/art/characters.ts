// 人物立繪（SVG 字串）。純函式、不依賴 three，方便在 node 裡輸出預覽圖。
// 風格：Q 版、賽璐璐上色加柔和漸層、暖深色描邊、光從左上來。

const OUT = '#3b2a2a'
const SW = 3

export const GRANDMA_SIZE = { w: 240, h: 360 }
export const GUEST_SIZE = { w: 220, h: 260 }
export const SLEEP_SIZE = { w: 200, h: 170 }
export const BURST_SIZE = { w: 120, h: 120 }
export const Z_SIZE = { w: 64, h: 64 }

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`

/** 左右鏡射一段路徑的 x 座標（只處理絕對座標指令 M L C Q Z，這裡的路徑都這樣寫） */
function mirrorPath(d: string, cx: number): string {
  let i = 0
  return d.replace(/-?\d+(\.\d+)?/g, (n) => {
    const out = i % 2 === 0 ? String(2 * cx - parseFloat(n)) : n
    i++
    return out
  })
}

// ---------------------------------------------------------------------------
// 阿春嬤
// ---------------------------------------------------------------------------

const GM_HEAD = { x: 120, y: 118, r: 64 }

function grandmaDefs(): string {
  return `
  <defs>
    <linearGradient id="gmSkin" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe7cf"/><stop offset="1" stop-color="#f4c6a3"/>
    </linearGradient>
    <linearGradient id="gmHair" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#e9eaf2"/><stop offset="1" stop-color="#c3c5d6"/>
    </linearGradient>
    <linearGradient id="gmBlouse" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a577d1"/><stop offset="1" stop-color="#7a4ca6"/>
    </linearGradient>
    <linearGradient id="gmBlouseShade" x1="0" y1="0" x2="1" y2="0.4">
      <stop offset="0.5" stop-color="#3a1260" stop-opacity="0"/><stop offset="1" stop-color="#3a1260" stop-opacity="0.38"/>
    </linearGradient>
    <linearGradient id="gmJade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8fe0b0"/><stop offset="1" stop-color="#2f9763"/>
    </linearGradient>
    <radialGradient id="gmGold" cx="0.35" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#fff2b0"/><stop offset="1" stop-color="#d49a1f"/>
    </radialGradient>
    <pattern id="gmFloral" patternUnits="userSpaceOnUse" width="26" height="26">
      <g transform="translate(7 8)">
        ${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(Math.cos((a * Math.PI) / 180) * 3).toFixed(2)}" cy="${(Math.sin((a * Math.PI) / 180) * 3).toFixed(2)}" r="2.6" fill="#f7ecff"/>`).join('')}
        <circle r="1.5" fill="#ffd45e"/>
      </g>
      <g transform="translate(20 20)">
        ${[36, 108, 180, 252, 324].map((a) => `<circle cx="${(Math.cos((a * Math.PI) / 180) * 2.3).toFixed(2)}" cy="${(Math.sin((a * Math.PI) / 180) * 2.3).toFixed(2)}" r="2" fill="#ffb6d6"/>`).join('')}
        <circle r="1.1" fill="#fff6c8"/>
      </g>
      <circle cx="20" cy="6" r="1.1" fill="#c9f0c0" opacity="0.8"/>
      <circle cx="5" cy="21" r="1.1" fill="#c9f0c0" opacity="0.8"/>
    </pattern>
    <!-- 鬼的腳：褲子往下漸漸透明（用漸層的透明度，不用 mask，各家 SVG 渲染器都支援） -->
    <linearGradient id="gmPantsFade" gradientUnits="userSpaceOnUse" x1="0" y1="262" x2="0" y2="350">
      <stop offset="0" stop-color="#3a4068" stop-opacity="1"/>
      <stop offset="0.45" stop-color="#30365a" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#262a46" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="gmPantsShadeFade" gradientUnits="userSpaceOnUse" x1="0" y1="262" x2="0" y2="350">
      <stop offset="0" stop-color="#10122a" stop-opacity="0.35"/><stop offset="1" stop-color="#10122a" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="gmOutFade" gradientUnits="userSpaceOnUse" x1="0" y1="262" x2="0" y2="340">
      <stop offset="0" stop-color="${OUT}" stop-opacity="1"/><stop offset="1" stop-color="${OUT}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="gmHeadClip"><circle cx="${GM_HEAD.x}" cy="${GM_HEAD.y}" r="${GM_HEAD.r}"/></clipPath>
  </defs>`
}

/** 大襟衫布料：底色 + 小花 + 右側陰影，用在身體與袖子 */
function blouse(d: string): string {
  return `
    <path d="${d}" fill="url(#gmBlouse)"/>
    <path d="${d}" fill="url(#gmFloral)" opacity="0.9"/>
    <path d="${d}" fill="url(#gmBlouseShade)"/>
    <path d="${d}" fill="none" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
}

function knot(x: number, y: number, rot: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <path d="M -8 0 L 8 0" stroke="${OUT}" stroke-width="5.4" stroke-linecap="round"/>
    <path d="M -8 0 L 8 0" stroke="#f5e7cc" stroke-width="3" stroke-linecap="round"/>
    <circle cx="-8" cy="0" r="3.2" fill="#f5e7cc" stroke="${OUT}" stroke-width="1.4"/>
    <circle cx="8" cy="0" r="2.4" fill="none" stroke="#f5e7cc" stroke-width="1.8"/>
  </g>`
}

function grandmaHead(): string {
  const { x, y, r } = GM_HEAD
  const earL = `<ellipse cx="58" cy="132" rx="9" ry="13" fill="url(#gmSkin)" stroke="${OUT}" stroke-width="${SW}"/>
    <path d="M 60 126 Q 55 132 60 139" fill="none" stroke="#d99a7a" stroke-width="2" stroke-linecap="round"/>
    <circle cx="57" cy="147" r="4.2" fill="url(#gmGold)" stroke="${OUT}" stroke-width="1.5"/>`
  const earR = `<ellipse cx="182" cy="132" rx="9" ry="13" fill="#f1bf9c" stroke="${OUT}" stroke-width="${SW}"/>
    <path d="M 180 126 Q 185 132 180 139" fill="none" stroke="#d3906f" stroke-width="2" stroke-linecap="round"/>
    <circle cx="183" cy="147" r="4.2" fill="url(#gmGold)" stroke="${OUT}" stroke-width="1.5"/>`

  const bun = `
    <circle cx="120" cy="44" r="25" fill="url(#gmHair)" stroke="${OUT}" stroke-width="${SW}"/>
    <path d="M 104 46 C 104 30, 132 26, 136 40 C 138 50, 124 56, 116 48" fill="none" stroke="#b5b7c9" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M 98 40 L 150 22" stroke="${OUT}" stroke-width="9" stroke-linecap="round"/>
    <path d="M 98 40 L 150 22" stroke="url(#gmJade)" stroke-width="5.6" stroke-linecap="round"/>
    <path d="M 102 37 L 140 24" stroke="#d6ffe6" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>
    <circle cx="153" cy="21" r="6" fill="url(#gmJade)" stroke="${OUT}" stroke-width="2"/>
    <circle cx="151" cy="19" r="1.8" fill="#eafff2"/>`

  const face = `
    <circle cx="${x}" cy="${y}" r="${r}" fill="#eab08e"/>
    <g clip-path="url(#gmHeadClip)">
      <circle cx="${x - 9}" cy="${y - 9}" r="${r - 1}" fill="url(#gmSkin)"/>
      <ellipse cx="${x - 26}" cy="${y - 24}" rx="16" ry="10" fill="#fff" opacity="0.28"/>
    </g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${OUT}" stroke-width="${SW}"/>
    <!-- 額頭皺紋 -->
    <path d="M 107 94 Q 120 89 133 94" fill="none" stroke="#d29579" stroke-width="1.8" stroke-linecap="round" opacity="0.75"/>
    <path d="M 110 99.5 Q 120 96 130 99.5" fill="none" stroke="#d29579" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>
    <!-- 眉毛 -->
    <path d="M 85 110 Q 97 103 109 109" fill="none" stroke="#a9a19b" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M 131 109 Q 143 103 155 110" fill="none" stroke="#a9a19b" stroke-width="3.6" stroke-linecap="round"/>
    <!-- 瞇瞇眼 ^ ^ -->
    <path d="M 85 129 Q 97 116 109 129" fill="none" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M 131 129 Q 143 116 155 129" fill="none" stroke="${OUT}" stroke-width="4.2" stroke-linecap="round"/>
    <!-- 魚尾紋 -->
    <path d="M 80 125 L 74 121 M 80 130 L 73 131" stroke="#c98b6d" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M 160 125 L 166 121 M 160 130 L 167 131" stroke="#c98b6d" stroke-width="1.7" stroke-linecap="round"/>
    <!-- 鼻子 -->
    <path d="M 115 139 Q 120 144 125 139" fill="none" stroke="#cf8f70" stroke-width="2.4" stroke-linecap="round"/>
    <!-- 腮紅 -->
    <ellipse cx="85" cy="145" rx="13" ry="8" fill="#f58f98" opacity="0.55"/>
    <ellipse cx="155" cy="145" rx="13" ry="8" fill="#f58f98" opacity="0.55"/>
    <path d="M 79 146 l 3 -5 M 85 147 l 3 -5 M 91 146 l 3 -5" stroke="#ea7a86" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>
    <path d="M 149 146 l 3 -5 M 155 147 l 3 -5 M 161 146 l 3 -5" stroke="#ea7a86" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>
    <!-- 法令紋 -->
    <path d="M 102 144 Q 97 151 102 159" fill="none" stroke="#d59478" stroke-width="1.7" stroke-linecap="round" opacity="0.7"/>
    <path d="M 138 144 Q 143 151 138 159" fill="none" stroke="#d59478" stroke-width="1.7" stroke-linecap="round" opacity="0.7"/>
    <!-- 笑嘴 -->
    <path d="M 106 152 Q 120 171 134 152 Q 120 157 106 152 Z" fill="#94393f" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M 112 162 Q 120 158 128 162 Q 120 167 112 162 Z" fill="#ee8a8c"/>`

  const hair = `
    <path d="M 55 128 C 48 84, 76 50, 120 50 C 164 50, 192 84, 185 128 C 180 113, 173 103, 164 96 C 152 86, 136 81, 120 81 C 104 81, 88 86, 76 96 C 67 103, 60 113, 55 128 Z"
      fill="url(#gmHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 91 88 C 97 71, 108 61, 120 56 M 149 88 C 143 71, 132 61, 120 56 M 76 104 C 78 81, 92 65, 107 58 M 164 104 C 162 81, 148 65, 133 58"
      fill="none" stroke="#b7b9cb" stroke-width="2" stroke-linecap="round" opacity="0.85"/>
    <path d="M 70 78 C 80 62, 96 55, 108 54" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity="0.9"/>`

  return earL + earR + bun + face + hair
}

const GM_BODY = 'M 98 168 Q 120 176 142 168 L 168 180 Q 180 186 182 202 L 186 268 Q 120 284 54 268 L 58 202 Q 60 186 72 180 Z'

function grandmaPants(): string {
  return `
    <path d="M 74 258 L 166 258 Q 171 300 176 354 L 128 354 Q 124 318 120 296 Q 116 318 112 354 L 64 354 Q 69 300 74 258 Z"
      fill="url(#gmPantsFade)" stroke="url(#gmOutFade)" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 124 262 L 166 258 Q 171 300 176 354 L 128 354 Q 124 318 120 296 Z" fill="url(#gmPantsShadeFade)"/>
    <path d="M 94 282 L 91 330 M 146 282 L 149 330" stroke="url(#gmOutFade)" stroke-width="1.6" opacity="0.5"/>`
}

function grandmaTorso(): string {
  return `
    ${blouse(GM_BODY)}
    <!-- 大襟滾邊與盤扣 -->
    <path d="M 122 178 Q 150 184 166 199 L 173 268" fill="none" stroke="${OUT}" stroke-width="5.6" stroke-linecap="round"/>
    <path d="M 122 178 Q 150 184 166 199 L 173 268" fill="none" stroke="#f5e7cc" stroke-width="3" stroke-linecap="round"/>
    ${knot(142, 184, 30)}${knot(163, 197, 55)}${knot(170, 226, 90)}${knot(172, 250, 90)}
    <!-- 立領 -->
    <path d="M 95 165 Q 120 177 145 165 L 147 175 Q 120 188 93 175 Z" fill="#7d4fa9" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>`
}

function mittenHand(x: number, y: number, rot: number, flip = false): string {
  // 朝右張開的手：四指併攏 + 大拇指
  const s = flip ? -1 : 1
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(1 ${s})">
    <path d="M -10 -7 C 0 -12, 14 -11, 19 -5 C 23 0, 20 6, 13 8 C 4 10, -6 9, -11 5 Z" fill="url(#gmSkin)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M -2 -8 C 2 -16, 9 -17, 10 -12 C 11 -8, 6 -6, 3 -6" fill="url(#gmSkin)" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M 8 -3 L 17 -2 M 8 2 L 16 3" stroke="#d99a7a" stroke-width="1.5" stroke-linecap="round"/>
  </g>`
}

function grandmaArmsIdle(): string {
  const left = 'M 72 181 C 55 190, 49 214, 55 236 C 60 251, 80 257, 106 251 L 105 234 C 88 238, 77 233, 77 221 C 77 209, 81 197, 86 189 Z'
  const right = mirrorPath(left, 120)
  const cuffL = `<path d="M 97 236 Q 101 244 99 252" fill="none" stroke="#f5e7cc" stroke-width="3" stroke-linecap="round"/>`
  const cuffR = `<path d="M 143 236 Q 139 244 141 252" fill="none" stroke="#f5e7cc" stroke-width="3" stroke-linecap="round"/>`
  const hands = `
    <ellipse cx="111" cy="246" rx="13" ry="10.5" fill="#f1bf9c" stroke="${OUT}" stroke-width="${SW}"/>
    <ellipse cx="129" cy="244" rx="13" ry="10.5" fill="url(#gmSkin)" stroke="${OUT}" stroke-width="${SW}"/>
    <path d="M 121 240 Q 128 237 136 239 M 121 245 Q 128 243 137 245 M 122 250 Q 128 249 135 250" fill="none" stroke="#d99a7a" stroke-width="1.5" stroke-linecap="round"/>`
  return blouse(left) + blouse(right) + cuffL + cuffR + hands
}

function grandmaArmsReach(): string {
  // 兩手一起往右下伸，像在拉被子
  const back = 'M 166 181 C 184 186, 204 198, 214 212 L 204 226 C 194 214, 182 207, 164 206 Z'
  const front = 'M 74 184 C 84 202, 124 222, 186 226 L 192 244 C 130 248, 86 232, 62 208 Z'
  return (
    blouse(back) +
    mittenHand(216, 222, 38) +
    blouse(front) +
    `<path d="M 184 227 Q 191 235 190 244" fill="none" stroke="#f5e7cc" stroke-width="3" stroke-linecap="round"/>` +
    mittenHand(200, 240, 22)
  )
}

export type GrandmaPose = 'idle' | 'reach'

export function grandmaSvg(pose: GrandmaPose): string {
  const { w, h } = GRANDMA_SIZE
  const arms = pose === 'idle' ? grandmaArmsIdle() : grandmaArmsReach()
  return svg(
    w,
    h,
    `${grandmaDefs()}
    ${grandmaPants()}
    ${grandmaTorso()}
    ${arms}
    ${grandmaHead()}`,
  )
}

// ---------------------------------------------------------------------------
// 小美（坐在床上，腰部以上）
// ---------------------------------------------------------------------------

const GU_HEAD = { x: 110, y: 98, r: 58 }
const GU_BODY = 'M 64 152 Q 110 141 156 152 C 180 161, 190 190, 192 262 L 28 262 C 30 190, 40 161, 64 152 Z'

function guestDefs(scared: boolean): string {
  return `
  <defs>
    <linearGradient id="guSkin" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe9d6"/><stop offset="1" stop-color="#f6c9a8"/>
    </linearGradient>
    <linearGradient id="guHair" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6b4436"/><stop offset="1" stop-color="#3e261f"/>
    </linearGradient>
    <linearGradient id="guHoodie" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffc3d4"/><stop offset="1" stop-color="#ec8fae"/>
    </linearGradient>
    <linearGradient id="guHoodieShade" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0.5" stop-color="#8c1f4c" stop-opacity="0"/><stop offset="1" stop-color="#8c1f4c" stop-opacity="0.3"/>
    </linearGradient>
    <radialGradient id="guPhoneGlow" gradientUnits="userSpaceOnUse" cx="110" cy="200" r="120">
      <stop offset="0" stop-color="#9fd6ff" stop-opacity="0.75"/><stop offset="0.55" stop-color="#9fd6ff" stop-opacity="0.18"/><stop offset="1" stop-color="#9fd6ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="guPale" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8fb0ff" stop-opacity="${scared ? 0.55 : 0}"/><stop offset="0.6" stop-color="#8fb0ff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="guHeadClip"><circle cx="${GU_HEAD.x}" cy="${GU_HEAD.y}" r="${GU_HEAD.r}"/></clipPath>
  </defs>`
}

function hoodie(d: string): string {
  return `<path d="${d}" fill="url(#guHoodie)"/><path d="${d}" fill="url(#guHoodieShade)"/>
    <path d="${d}" fill="none" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
}

function guestBackHair(scared: boolean): string {
  if (!scared) {
    return `<path d="M 46 100 C 40 52, 72 32, 110 32 C 148 32, 180 52, 174 100 L 180 158 Q 170 172 148 166 L 150 124 L 70 124 L 72 166 Q 50 172 40 158 Z"
      fill="url(#guHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
  }
  // 嚇到：頭髮炸開
  return `<path d="M 40 104 L 16 92 L 38 80 L 22 56 L 50 58 L 48 30 L 74 42 L 86 14 L 104 34 L 122 10 L 134 34 L 158 16 L 164 44 L 192 38 L 182 64 L 206 70 L 184 88 L 204 104 L 180 112 L 188 140 L 196 162 Q 176 176 150 166 L 150 124 L 70 124 L 70 166 Q 44 176 24 162 L 34 138 L 18 120 Z"
      fill="url(#guHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>`
}

function guestHeadBase(scared: boolean): string {
  const { x, y, r } = GU_HEAD
  return `
    <circle cx="${x}" cy="${y}" r="${r}" fill="#efb996"/>
    <g clip-path="url(#guHeadClip)">
      <circle cx="${x - 8}" cy="${y - 8}" r="${r - 1}" fill="url(#guSkin)"/>
      <rect x="40" y="30" width="140" height="140" fill="url(#guPale)"/>
      ${scared ? '' : `<rect x="40" y="30" width="140" height="140" fill="url(#guPhoneGlow)"/>`}
    </g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${OUT}" stroke-width="${SW}"/>`
}

function guestBangs(): string {
  return `
    <path d="M 52 104 C 46 62, 76 38, 110 38 C 144 38, 174 62, 168 104 C 164 92, 158 84, 150 78 L 146 92 L 134 76 L 122 94 L 110 74 L 98 94 L 86 76 L 74 92 L 70 80 C 62 86, 56 94, 52 104 Z"
      fill="url(#guHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 70 58 Q 110 40 150 58" fill="none" stroke="#a0715f" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
    <path d="M 84 52 Q 94 47 104 46" fill="none" stroke="#e8c2b0" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>`
}

function guestFaceAwake(): string {
  return `
    <!-- 專心看手機：圓圓的黑眼睛 -->
    <ellipse cx="89" cy="116" rx="7" ry="8.8" fill="#3a2622"/>
    <ellipse cx="131" cy="116" rx="7" ry="8.8" fill="#3a2622"/>
    <ellipse cx="89" cy="119" rx="4.6" ry="4.4" fill="#6a4a8a" opacity="0.55"/>
    <ellipse cx="131" cy="119" rx="4.6" ry="4.4" fill="#6a4a8a" opacity="0.55"/>
    <circle cx="86.3" cy="112.6" r="2.7" fill="#fff"/><circle cx="128.3" cy="112.6" r="2.7" fill="#fff"/>
    <circle cx="91.5" cy="120" r="1.2" fill="#fff" opacity="0.9"/><circle cx="133.5" cy="120" r="1.2" fill="#fff" opacity="0.9"/>
    <path d="M 82 110 L 77 109.5 M 138 110 L 143 109.5" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M 80 97 Q 89 91 98 95 M 122 95 Q 131 91 140 97" fill="none" stroke="#5a382d" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="75" cy="130" rx="11" ry="6.5" fill="#f7929e" opacity="0.5"/>
    <ellipse cx="145" cy="130" rx="11" ry="6.5" fill="#f7929e" opacity="0.5"/>
    <path d="M 109 124 Q 110 127 111 124" fill="none" stroke="#d9957a" stroke-width="2" stroke-linecap="round"/>
    <path d="M 101 134 Q 110 140 119 134" fill="none" stroke="${OUT}" stroke-width="2.8" stroke-linecap="round"/>`
}

function guestFaceScared(): string {
  const lines = Array.from({ length: 9 }, (_, i) => {
    const x = 74 + i * 9
    return `<path d="M ${x} 44 L ${x} ${70 + (i % 2) * 8}" stroke="#4a6fd8" stroke-width="2.2" stroke-linecap="round" opacity="0.75"/>`
  }).join('')
  return `
    <g clip-path="url(#guHeadClip)">${lines}</g>
    <!-- 眉毛八字 -->
    <path d="M 74 92 Q 86 82 99 90" fill="none" stroke="#5a382d" stroke-width="3" stroke-linecap="round"/>
    <path d="M 121 90 Q 134 82 146 92" fill="none" stroke="#5a382d" stroke-width="3" stroke-linecap="round"/>
    <!-- 瞪大的眼睛 -->
    <ellipse cx="88" cy="110" rx="12" ry="14" fill="#fff" stroke="${OUT}" stroke-width="${SW}"/>
    <ellipse cx="132" cy="110" rx="12" ry="14" fill="#fff" stroke="${OUT}" stroke-width="${SW}"/>
    <circle cx="88" cy="111" r="2.8" fill="${OUT}"/><circle cx="132" cy="111" r="2.8" fill="${OUT}"/>
    <!-- 尖叫的嘴 -->
    <ellipse cx="110" cy="140" rx="13" ry="17" fill="#6e1f2c" stroke="${OUT}" stroke-width="${SW}"/>
    <path d="M 99 131 Q 110 126 121 131 L 120 134 Q 110 130 100 134 Z" fill="#fff"/>
    <ellipse cx="110" cy="150" rx="8" ry="4.5" fill="#e0717d"/>
    <path d="M 100 123 Q 110 120 120 123" fill="none" stroke="#d9957a" stroke-width="0" />
    <!-- 冷汗 -->
    ${[
      [44, 70, 1],
      [176, 76, 1.1],
      [168, 48, 0.8],
    ]
      .map(
        ([x, y, s]) =>
          `<path transform="translate(${x} ${y}) scale(${s})" d="M 0 -10 C 5 -3, 8 2, 8 5 C 8 10, -8 10, -8 5 C -8 2, -5 -3, 0 -10 Z" fill="#a9ddff" stroke="${OUT}" stroke-width="2"/><circle transform="translate(${x} ${y}) scale(${s})" cx="-2.5" cy="3" r="1.8" fill="#fff"/>`,
      )
      .join('')}`
}

function guestBodyAwake(): string {
  const body = GU_BODY
  const hood = `<path d="M 66 146 Q 110 180 154 146 Q 152 164 110 172 Q 68 164 66 146 Z" fill="#e28aa9" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>`
  const strings = `
    <path d="M 100 166 Q 98 180 97 192 M 120 166 Q 122 180 123 192" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
    <rect x="94.5" y="190" width="5" height="8" rx="1.5" fill="#d6d6de" stroke="${OUT}" stroke-width="1.2"/>
    <rect x="120.5" y="190" width="5" height="8" rx="1.5" fill="#d6d6de" stroke="${OUT}" stroke-width="1.2"/>`
  const pocket = `<path d="M 62 241 Q 110 231 158 241" fill="none" stroke="#c96488" stroke-width="3" stroke-linecap="round"/>`
  const armL = 'M 50 162 C 33 188, 37 228, 72 230 L 96 224 L 92 206 L 71 207 C 64 197, 65 182, 70 171 Z'
  const armR = mirrorPath(armL, 110)
  const phone = `
    <ellipse cx="110" cy="206" rx="40" ry="28" fill="#bfe6ff" opacity="0.35"/>
    <rect x="94" y="184" width="32" height="46" rx="7" fill="#2c2f3d" stroke="${OUT}" stroke-width="${SW}"/>
    <rect x="96" y="186" width="28" height="42" rx="5" fill="none" stroke="#9fd6ff" stroke-width="1.6" opacity="0.8"/>
    <circle cx="102" cy="193" r="3" fill="#15161d" stroke="#5b6072" stroke-width="1.2"/>
    <circle cx="102" cy="200" r="1.4" fill="#e7e7ee"/>`
  const hands = `
    <ellipse cx="92" cy="214" rx="10" ry="12" fill="url(#guSkin)" stroke="${OUT}" stroke-width="${SW}"/>
    <ellipse cx="128" cy="214" rx="10" ry="12" fill="#f2c3a2" stroke="${OUT}" stroke-width="${SW}"/>
    <ellipse cx="92" cy="210" rx="7" ry="6" fill="#bfe6ff" opacity="0.45"/>
    <ellipse cx="128" cy="210" rx="7" ry="6" fill="#bfe6ff" opacity="0.45"/>`
  const bodyShade = `<path d="${body}" fill="#8c1f4c" opacity="0.12"/>`
  return hoodie(body) + bodyShade + hood + strings + pocket + hoodie(armL) + hoodie(armR) + phone + hands
}

function guestBodyScared(): string {
  const body = GU_BODY
  const hood = `<path d="M 66 146 Q 110 180 154 146 Q 152 164 110 172 Q 68 164 66 146 Z" fill="#e28aa9" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/>`
  const strings = `
    <path d="M 100 166 Q 96 190 92 212 M 120 166 Q 124 190 128 212" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
    <rect x="89.5" y="210" width="5" height="8" rx="1.5" fill="#d6d6de" stroke="${OUT}" stroke-width="1.2"/>
    <rect x="125.5" y="210" width="5" height="8" rx="1.5" fill="#d6d6de" stroke="${OUT}" stroke-width="1.2"/>`
  const pocket = `<path d="M 62 241 Q 110 231 158 241" fill="none" stroke="#c96488" stroke-width="3" stroke-linecap="round"/>`
  // 手舉到臉頰兩邊
  const armL = 'M 38 178 C 24 158, 26 134, 38 118 L 58 128 C 50 140, 52 154, 62 163 Z'
  const armR = mirrorPath(armL, 110)
  const palm = (x: number, flip: number) => `<g transform="translate(${x} 112) scale(${flip} 1)">
      <path d="M -12 14 C -16 2, -14 -14, -8 -22 C -6 -26, -2 -25, -2 -20 L -1 -26 C 0 -31, 5 -31, 6 -26 L 7 -22 C 8 -26, 13 -26, 13 -21 L 13 -14 C 15 -17, 19 -16, 19 -11 C 19 0, 14 12, 6 16 Z"
        fill="url(#guSkin)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    </g>`
  const bodyShade = `<path d="${body}" fill="#8c1f4c" opacity="0.12"/>`
  return hoodie(body) + bodyShade + hood + strings + pocket + hoodie(armL) + hoodie(armR) + palm(50, 1) + palm(170, -1)
}

export type GuestPose = 'awake' | 'scared'

export function guestSvg(pose: GuestPose): string {
  const { w, h } = GUEST_SIZE
  const scared = pose === 'scared'
  return svg(
    w,
    h,
    `${guestDefs(scared)}
    ${guestBackHair(scared)}
    ${scared ? guestBodyScared().replace(/<g transform="translate\((50|170) 112\)[\s\S]*?<\/g>/g, '') : guestBodyAwake()}
    ${guestHeadBase(scared)}
    ${guestBangs()}
    ${scared ? guestFaceScared() : guestFaceAwake()}
    ${scared ? guestPalms() : ''}`,
  )
}

/** 嚇到時的兩隻手掌要畫在臉的上面 */
function guestPalms(): string {
  const m = guestBodyScared().match(/<g transform="translate\((50|170) 112\)[\s\S]*?<\/g>/g)
  return m ? m.join('') : ''
}

/** 睡在枕頭上的頭（從上方看） */
export function guestSleepSvg(): string {
  const { w, h } = SLEEP_SIZE
  return svg(
    w,
    h,
    `<defs>
      <linearGradient id="slSkin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9d6"/><stop offset="1" stop-color="#f3c3a1"/></linearGradient>
      <linearGradient id="slHair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b4436"/><stop offset="1" stop-color="#3e261f"/></linearGradient>
      <radialGradient id="slBubble" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="1" stop-color="#bfe6ff" stop-opacity="0.55"/></radialGradient>
      <clipPath id="slClip"><circle cx="100" cy="84" r="50"/></clipPath>
    </defs>
    <!-- 散在枕頭上的頭髮 -->
    <path d="M 30 100 C 12 72, 28 26, 70 14 C 90 7, 116 7, 134 13 C 176 26, 192 72, 172 102 C 190 116, 186 140, 164 142 C 156 152, 140 148, 138 134 L 62 134 C 60 148, 44 152, 36 142 C 14 140, 12 116, 30 100 Z"
      fill="url(#slHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 40 60 C 50 40, 70 28, 90 24 M 160 60 C 150 40, 130 28, 110 24" fill="none" stroke="#9c6b58" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <!-- 帽 T 領口 -->
    <path d="M 58 141 Q 100 125 142 141 L 138 158 Q 100 150 62 158 Z" fill="#f5a9c2" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <path d="M 30 112 C 24 122, 26 132, 34 136 M 170 112 C 176 122, 174 132, 166 136" fill="none" stroke="#9c6b58" stroke-width="2.6" stroke-linecap="round" opacity="0.7"/>
    <circle cx="100" cy="84" r="50" fill="#efb996"/>
    <g clip-path="url(#slClip)"><circle cx="93" cy="77" r="49" fill="url(#slSkin)"/></g>
    <circle cx="100" cy="84" r="50" fill="none" stroke="${OUT}" stroke-width="${SW}"/>
    <!-- 瀏海 -->
    <path d="M 52 84 C 48 50, 72 32, 100 32 C 128 32, 152 50, 148 84 C 144 74, 138 68, 132 64 L 128 76 L 118 62 L 108 78 L 98 62 L 88 78 L 78 64 C 66 70, 56 76, 52 84 Z"
      fill="url(#slHair)" stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round"/>
    <!-- 閉眼 -->
    <path d="M 72 96 Q 82 104 92 96 M 108 96 Q 118 104 128 96" fill="none" stroke="${OUT}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M 73 97 L 69 100 M 127 97 L 131 100" stroke="${OUT}" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="70" cy="110" rx="10" ry="6" fill="#f7929e" opacity="0.5"/>
    <ellipse cx="130" cy="110" rx="10" ry="6" fill="#f7929e" opacity="0.5"/>
    <!-- 微張的嘴 -->
    <ellipse cx="100" cy="118" rx="4.5" ry="5.5" fill="#8a3a45" stroke="${OUT}" stroke-width="2"/>
    <!-- 鼻涕泡泡 -->
    <path d="M 97 106 Q 100 109 103 106" fill="none" stroke="#d9957a" stroke-width="2" stroke-linecap="round"/>
    <circle cx="108" cy="107" r="7.5" fill="url(#slBubble)" stroke="#7fb8e6" stroke-width="1.6"/>
    <circle cx="105.5" cy="104.5" r="2" fill="#fff"/>`,
  )
}

/** 嚇到時頭上的「！」爆炸框 */
export function burstSvg(): string {
  const { w, h } = BURST_SIZE
  const star = (ro: number, ri: number, n: number, rot: number) => {
    const pts: string[] = []
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 === 0 ? ro : ri
      const a = ((i * 180) / n + rot) * (Math.PI / 180)
      pts.push(`${(60 + Math.cos(a) * r).toFixed(1)},${(60 + Math.sin(a) * r).toFixed(1)}`)
    }
    return pts.join(' ')
  }
  return svg(
    w,
    h,
    `<polygon points="${star(58, 40, 12, -90)}" fill="#e8323c" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="${star(45, 32, 12, -75)}" fill="#fff4d6"/>
    <path d="M 52 26 L 68 26 L 64 72 L 56 72 Z" fill="#d61f2c" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="60" cy="86" r="8" fill="#d61f2c" stroke="${OUT}" stroke-width="3"/>
    <path d="M 55 30 L 58 60" stroke="#ff8a8f" stroke-width="2.4" stroke-linecap="round"/>`,
  )
}

/** 一個圓潤的 Z（睡覺用） */
export function zSvg(): string {
  const { w, h } = Z_SIZE
  const d = 'M 16 18 L 48 18 L 16 46 L 48 46'
  return svg(
    w,
    h,
    `<path d="${d}" fill="none" stroke="#9fd0ff" stroke-opacity="0.25" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#9fd0ff" stroke-opacity="0.45" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#2f4a7a" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#f2f9ff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  )
}
