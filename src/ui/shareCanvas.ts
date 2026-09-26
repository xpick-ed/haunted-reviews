import { PORTRAIT_IDS, portraitDataUrl, type PortraitId, type PortraitMood } from '../art/portraits'
import { MONTH_NAMES, NIGHTS_PER_MONTH } from '../world/night/plan'
import { qrMatrix } from './qr'

// 「今日好評」分享卡（DESIGN §31.4）：1080×1350 的直式圖，存下來或傳 LINE。
// 版面由上而下：標題、遊戲截圖、阿嬤頭像＋對話框、今晚的數字、客人的星星、最好的評論、網址＋QR Code。

export const SHARE_URL = 'https://xpick-ed.github.io/haunted-reviews/'
export const CARD_W = 1080
export const CARD_H = 1350

export interface ShareReview {
  id: string
  name: string
  stars: number
  text: string
}

export interface ShareData {
  /** 第幾晚（meta.night，從 1 開始） */
  night: number
  reviews: ShareReview[]
  income: number
  warmDelta: number
  spookyDelta: number
  heartDelta: number
  merit: number
  /** 遊戲畫面（Snapshot.tsx）；截不到就畫一張夜裡的三合院 */
  snapshot: HTMLCanvasElement | null
}

const BRUSH = `"LXGW WenKai TC", "Noto Serif TC", serif`
const SERIF = `"Noto Serif TC", "LXGW WenKai TC", serif`
const SANS = `"Noto Sans TC", "PingFang TC", sans-serif`

const INK = '#3b2a2a'
const INK_2 = '#6b5446'
const PAPER = '#f6ecd6'
const RED = '#b8322a'
const GOLD = '#e8a33a'

// ---------------------------------------------------------------------------
// 阿嬤要說的話（依今晚的成績）
// ---------------------------------------------------------------------------

export function grandmaSays(d: Pick<ShareData, 'reviews' | 'spookyDelta'>): { text: string; mood: PortraitMood } {
  if (!d.reviews.length) return { text: '今晚沒有客人，阿嬤掃掃地、泡杯茶。', mood: 'normal' }
  const avg = d.reviews.reduce((a, r) => a + r.stars, 0) / d.reviews.length
  if (d.spookyDelta >= 5 && avg >= 3) return { text: '嘿嘿，今晚有人被嚇到喔～', mood: 'happy' }
  if (avg >= 4.5) return { text: '大家都睡得好甜，阿嬤好歡喜！', mood: 'happy' }
  if (avg >= 3.5) return { text: '今晚也辛苦了～明天再來煮宵夜。', mood: 'happy' }
  if (avg >= 2.5) return { text: '差一點點，明天再加油！', mood: 'normal' }
  return { text: '唉唷……好像又把人嚇到了。', mood: 'surprised' }
}

/** 最好的一兩則評論（星多的、寫得長的優先） */
export function bestQuotes(reviews: ShareReview[]): ShareReview[] {
  const xs = [...reviews].filter((r) => r.text.trim()).sort((a, b) => b.stars - a.stars || b.text.length - a.text.length)
  return xs.slice(0, 2)
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** 固定種子的亂數（紙紋每次都一樣） */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, on: boolean) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fillStyle = on ? GOLD : 'rgba(107, 84, 70, 0.18)'
  ctx.fill()
  if (on) {
    ctx.strokeStyle = '#b8761f'
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

/** 中文斷行：一個字一個字量；句讀不放在行首。超過 maxLines 用「……」收尾 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 99): string[] {
  const NO_START = '，。、！？；：」』）…～,.!?'
  const chars = [...text.replace(/\s+/g, ' ').trim()]
  const lines: string[] = []
  let cur = ''
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ctx.measureText(cur + ch).width > maxW && cur && !NO_START.includes(ch)) {
      lines.push(cur)
      cur = ''
    }
    cur += ch
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last && ctx.measureText(last + '……').width > maxW) last = [...last].slice(0, -1).join('')
    kept[maxLines - 1] = last + '……'
    return kept
  }
  return lines
}

/**
 * 載入圖片，先畫到自己的小畫布上再用。
 * 直接把 SVG 圖片畫到已經畫了遊戲截圖的大畫布上，Chrome 有時會把整張清空（實測），先點陣化就沒事。
 */
function loadImage(src: string, size = 256): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = size
        c.height = size
        c.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0, size, size)
        resolve(c)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

const hasPortrait = (id: string): id is PortraitId => (PORTRAIT_IDS as readonly string[]).includes(id)

/** 等字型載好（Google Fonts 是依字切的子集，要把會用到的字都要一次） */
async function loadFonts(text: string) {
  if (typeof document === 'undefined' || !document.fonts) return
  const specs = [`700 80px "LXGW WenKai TC"`, `400 40px "LXGW WenKai TC"`, `900 40px "Noto Serif TC"`, `600 40px "Noto Serif TC"`, `700 30px "Noto Sans TC"`, `500 30px "Noto Sans TC"`]
  const timeout = new Promise((r) => window.setTimeout(r, 2500))
  await Promise.race([Promise.all(specs.map((f) => document.fonts.load(f, text).catch(() => null))), timeout])
  await Promise.race([document.fonts.ready, timeout])
}

// ---------------------------------------------------------------------------
// 各區塊
// ---------------------------------------------------------------------------

function paper(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  // 紙的纖維與斑點
  const r = rng(20260926)
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '120, 90, 60' : '255, 250, 235'}, ${0.03 + r() * 0.05})`
    ctx.fillRect(r() * CARD_W, r() * CARD_H, 1 + r() * 3, 1 + r() * 3)
  }
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(140, 105, 70, ${0.03 + r() * 0.04})`
    ctx.lineWidth = 1
    const y = r() * CARD_H
    const x = r() * CARD_W
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + 40 + r() * 60, y + (r() - 0.5) * 8, x + 90 + r() * 140, y + (r() - 0.5) * 6)
    ctx.stroke()
  }
  // 四邊暗一點（舊紙）
  const g = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, CARD_H * 0.35, CARD_W / 2, CARD_H / 2, CARD_H * 0.78)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(110, 70, 30, 0.22)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  // 雙線外框
  ctx.strokeStyle = 'rgba(122, 52, 40, 0.55)'
  ctx.lineWidth = 3
  ctx.strokeRect(26, 26, CARD_W - 52, CARD_H - 52)
  ctx.lineWidth = 1.2
  ctx.strokeRect(36, 36, CARD_W - 72, CARD_H - 72)
}

function header(ctx: CanvasRenderingContext2D, night: number) {
  const month = Math.floor((night - 1) / NIGHTS_PER_MONTH)
  const nInMonth = ((night - 1) % NIGHTS_PER_MONTH) + 1
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `700 84px ${BRUSH}`
  ctx.fillText('《靈異好評》', CARD_W / 2, 132)
  ctx.font = `600 30px ${SERIF}`
  ctx.fillStyle = INK_2
  ctx.fillText(`阿春民宿．${MONTH_NAMES[month % MONTH_NAMES.length]}第 ${nInMonth} 晚（開張第 ${night} 晚）`, CARD_W / 2, 176)
  // 右上角的紅印章「今日好評」
  ctx.save()
  ctx.translate(930, 104)
  ctx.rotate(-0.16)
  ctx.globalAlpha = 0.88
  roundRect(ctx, -58, -58, 116, 116, 14)
  ctx.fillStyle = RED
  ctx.fill()
  ctx.strokeStyle = '#f6ecd6'
  ctx.lineWidth = 3
  roundRect(ctx, -50, -50, 100, 100, 10)
  ctx.stroke()
  ctx.fillStyle = '#fff4e0'
  ctx.font = `900 38px ${SERIF}`
  ctx.textBaseline = 'middle'
  ctx.fillText('今日', 0, -20)
  ctx.fillText('好評', 0, 24)
  ctx.restore()
  // 左上角一個小燈籠
  ctx.save()
  ctx.translate(150, 96)
  ctx.fillStyle = '#c8402f'
  ctx.beginPath()
  ctx.ellipse(0, 0, 30, 38, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2a1a14'
  ctx.fillRect(-16, -44, 32, 9)
  ctx.fillRect(-16, 35, 32, 9)
  ctx.strokeStyle = 'rgba(255, 220, 160, 0.5)'
  ctx.lineWidth = 2
  for (const k of [-0.5, 0, 0.5]) {
    ctx.beginPath()
    ctx.ellipse(0, 0, 30 * Math.abs(k) + 2, 38, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#f7d27a'
  ctx.font = `700 26px ${BRUSH}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('春', 0, 2)
  ctx.strokeStyle = '#c8402f'
  ctx.beginPath()
  ctx.moveTo(0, 44)
  ctx.lineTo(0, 64)
  ctx.stroke()
  ctx.restore()
}

/** 沒有截圖時的代替圖：夜裡的三合院剪影、月亮、燈籠 */
function fallbackScene(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, '#1b2346')
  g.addColorStop(0.7, '#3a3350')
  g.addColorStop(1, '#5a4050')
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  const r = rng(7)
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(255, 250, 220, ${0.3 + r() * 0.6})`
    ctx.fillRect(x + r() * w, y + r() * h * 0.55, 2, 2)
  }
  ctx.fillStyle = '#fff3c4'
  ctx.beginPath()
  ctx.arc(x + w * 0.78, y + h * 0.22, 42, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#141020'
  const base = y + h * 0.78
  ctx.fillRect(x, base, w, h * 0.22)
  // 正身＋兩邊護龍
  const roof = (cx: number, top: number, hw: number) => {
    ctx.beginPath()
    ctx.moveTo(cx - hw - 30, base - top + 40)
    ctx.quadraticCurveTo(cx, base - top - 10, cx + hw + 30, base - top + 40)
    ctx.lineTo(cx + hw, base - top + 40)
    ctx.lineTo(cx + hw, base)
    ctx.lineTo(cx - hw, base)
    ctx.lineTo(cx - hw, base - top + 40)
    ctx.closePath()
    ctx.fill()
  }
  roof(x + w / 2, 190, 190)
  roof(x + w * 0.16, 130, 110)
  roof(x + w * 0.84, 130, 110)
  // 屋簷下兩盞紅燈籠、門口透出來的燈
  for (const lx of [x + w / 2 - 150, x + w / 2 + 150]) {
    ctx.strokeStyle = '#141020'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(lx, base - 150)
    ctx.lineTo(lx, base - 128)
    ctx.stroke()
    const lg = ctx.createRadialGradient(lx, base - 112, 2, lx, base - 112, 44)
    lg.addColorStop(0, 'rgba(255, 150, 90, 0.55)')
    lg.addColorStop(1, 'rgba(255, 150, 90, 0)')
    ctx.fillStyle = lg
    ctx.fillRect(lx - 44, base - 156, 88, 88)
    ctx.fillStyle = '#e8553a'
    ctx.beginPath()
    ctx.ellipse(lx, base - 112, 12, 16, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  const dg = ctx.createLinearGradient(0, base - 84, 0, base)
  dg.addColorStop(0, 'rgba(255, 214, 150, 0.95)')
  dg.addColorStop(1, 'rgba(255, 180, 110, 0.7)')
  ctx.fillStyle = dg
  ctx.fillRect(x + w / 2 - 34, base - 84, 68, 84)
  ctx.fillStyle = 'rgba(255, 200, 130, 0.12)'
  ctx.beginPath()
  ctx.moveTo(x + w / 2 - 34, base)
  ctx.lineTo(x + w / 2 + 34, base)
  ctx.lineTo(x + w / 2 + 110, y + h)
  ctx.lineTo(x + w / 2 - 110, y + h)
  ctx.closePath()
  ctx.fill()
}

function photo(ctx: CanvasRenderingContext2D, snap: HTMLCanvasElement | null) {
  const x = 60
  const y = 206
  const w = CARD_W - 120
  const h = 500
  ctx.save()
  // 相片的白邊與陰影，稍微歪一點點
  ctx.translate(CARD_W / 2, y + h / 2)
  ctx.rotate(-0.012)
  ctx.translate(-CARD_W / 2, -(y + h / 2))
  ctx.shadowColor = 'rgba(60, 35, 15, 0.35)'
  ctx.shadowBlur = 22
  ctx.shadowOffsetY = 8
  ctx.fillStyle = '#fffaf0'
  roundRect(ctx, x - 12, y - 12, w + 24, h + 24, 10)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.save()
  roundRect(ctx, x, y, w, h, 6)
  ctx.clip()
  if (snap && snap.width > 10 && snap.height > 10) {
    // cover：取中間、稍微偏上（阿嬤和房子通常在畫面中間偏下，HUD 不在 WebGL 畫布裡）
    const k = Math.max(w / snap.width, h / snap.height)
    const sw = w / k
    const sh = h / k
    const sx = (snap.width - sw) / 2
    const sy = Math.max(0, Math.min(snap.height - sh, (snap.height - sh) * 0.55))
    ctx.drawImage(snap, sx, sy, sw, sh, x, y, w, h)
    // 一點點暖色、舊照片感
    ctx.fillStyle = 'rgba(255, 190, 120, 0.08)'
    ctx.fillRect(x, y, w, h)
  } else fallbackScene(ctx, x, y, w, h)
  const v = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.4, x + w / 2, y + h / 2, w * 0.62)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(20, 10, 5, 0.35)')
  ctx.fillStyle = v
  ctx.fillRect(x, y, w, h)
  ctx.restore()
  // 兩條紙膠帶
  for (const [tx, ty, a] of [
    [x + 70, y - 14, -0.35],
    [x + w - 70, y - 14, 0.3],
  ]) {
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(a)
    ctx.fillStyle = 'rgba(232, 205, 150, 0.8)'
    ctx.fillRect(-58, -16, 116, 32)
    ctx.restore()
  }
  ctx.restore()
}

function grandmaBubble(ctx: CanvasRenderingContext2D, d: ShareData, img: HTMLCanvasElement | null) {
  const { text } = grandmaSays(d)
  const cx = 168
  const cy = 752
  const r = 96
  ctx.save()
  ctx.shadowColor = 'rgba(60, 35, 15, 0.3)'
  ctx.shadowBlur = 14
  ctx.beginPath()
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2)
  ctx.fillStyle = '#fffaf0'
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#ffe6b0'
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
  ctx.restore()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2)
  ctx.stroke()

  // 對話框
  ctx.font = `700 40px ${BRUSH}`
  const lines = wrapText(ctx, text, 700, 2)
  const bx = 300
  const by = 736
  const bw = Math.min(740, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 64)
  const bh = 36 + lines.length * 50
  ctx.save()
  ctx.shadowColor = 'rgba(60, 35, 15, 0.22)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  ctx.fillStyle = '#fffdf6'
  roundRect(ctx, bx, by, bw, bh, 28)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(bx + 6, by + 30)
  ctx.lineTo(bx - 34, by + 44)
  ctx.lineTo(bx + 10, by + 56)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = INK
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  lines.forEach((l, i) => ctx.fillText(l, bx + 32, by + 43 + i * 50))
}

function stats(ctx: CanvasRenderingContext2D, d: ShareData) {
  const sgn = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0')
  const items: [string, string, string][] = [
    ['收入', `$${d.income.toLocaleString()}`, '#8a5a12'],
    ['溫馨', sgn(d.warmDelta), '#b0452f'],
    ['靈異', sgn(d.spookyDelta), '#3f5a8a'],
    ['小翰的心', sgn(d.heartDelta), '#b03a5a'],
  ]
  if (d.merit > 0) items.push(['功德', `+${d.merit}`, '#6a4a9a'])
  ctx.font = `700 30px ${SANS}`
  const pad = 22
  const gap = 14
  const widths = items.map(([k, v]) => ctx.measureText(`${k} ${v}`).width + pad * 2)
  const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1)
  let x = (CARD_W - total) / 2
  const y = 902
  items.forEach(([k, v, c], i) => {
    const w = widths[i]
    roundRect(ctx, x, y - 27, w, 54, 27)
    ctx.fillStyle = 'rgba(255, 250, 238, 0.85)'
    ctx.fill()
    ctx.strokeStyle = c
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `500 28px ${SANS}`
    ctx.fillStyle = INK_2
    ctx.fillText(k, x + pad, y + 1)
    const kw = ctx.measureText(k + ' ').width
    ctx.font = `700 30px ${SANS}`
    ctx.fillStyle = c
    ctx.fillText(v, x + pad + kw, y + 1)
    x += w + gap
  })
}

/** 客人頭像（前四位；沒有頭像的角色給 null） */
const guestFaces = (reviews: ShareReview[]) =>
  Promise.all(reviews.slice(0, 4).map((r) => (hasPortrait(r.id) ? loadImage(portraitDataUrl(r.id, r.stars >= 4 ? 'happy' : r.stars <= 2 ? 'surprised' : 'normal')) : Promise.resolve(null))))

function guests(ctx: CanvasRenderingContext2D, reviews: ShareReview[], imgs: (HTMLCanvasElement | null)[]) {
  const shown = reviews.slice(0, 4)
  if (!shown.length) return
  const colW = Math.min(240, (CARD_W - 120) / shown.length)
  const x0 = (CARD_W - colW * shown.length) / 2
  const y = 998
  shown.forEach((r, i) => {
    const cx = x0 + colW * i + 52
    // 頭像（沒有頭像的角色：名字第一個字）
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, y, 36, 0, Math.PI * 2)
    ctx.fillStyle = '#efd9b0'
    ctx.fill()
    ctx.clip()
    const img = imgs[i]
    if (img) ctx.drawImage(img, cx - 36, y - 36, 72, 72)
    else {
      ctx.fillStyle = INK
      ctx.font = `700 34px ${BRUSH}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText([...r.name][0] ?? '?', cx, y + 2)
    }
    ctx.restore()
    ctx.strokeStyle = 'rgba(122, 52, 40, 0.45)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, y, 37, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.font = `700 28px ${SANS}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    let name = r.name
    while (ctx.measureText(name).width > colW - 100 && name.length > 1) name = name.slice(0, -1)
    ctx.fillText(name, cx + 48, y - 6)
    for (let k = 0; k < 5; k++) star(ctx, cx + 60 + k * 26, y + 22, 12, k < r.stars)
  })
}

function quotes(ctx: CanvasRenderingContext2D, reviews: ShareReview[]) {
  const qs = bestQuotes(reviews)
  if (!qs.length) return
  const top = 1056
  const bottom = 1186
  const x = 96
  const maxW = CARD_W - 2 * x - 40
  ctx.font = `400 32px ${BRUSH}`
  const lh = 44
  // 兩則放得下就放兩則，不然只放最好的那一則
  let blocks = qs.map((q) => ({ q, lines: wrapText(ctx, `「${q.text}」`, maxW, 2) }))
  const need = blocks.reduce((a, b) => a + b.lines.length * lh + 30, 0)
  if (need > bottom - top) blocks = [{ q: qs[0], lines: wrapText(ctx, `「${qs[0].text}」`, maxW, 3) }]
  let y = top
  for (const b of blocks) {
    ctx.fillStyle = 'rgba(184, 50, 42, 0.8)'
    ctx.fillRect(x - 22, y + 4, 5, b.lines.length * lh - 8)
    ctx.fillStyle = INK
    ctx.font = `400 32px ${BRUSH}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    b.lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh))
    ctx.font = `500 24px ${SANS}`
    ctx.fillStyle = INK_2
    ctx.textAlign = 'right'
    ctx.fillText(`—— ${b.q.name}`, CARD_W - x, y + b.lines.length * lh - 4)
    y += b.lines.length * lh + 30
  }
}

function footer(ctx: CanvasRenderingContext2D) {
  const y = 1196
  ctx.strokeStyle = 'rgba(122, 52, 40, 0.35)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 8])
  ctx.beginPath()
  ctx.moveTo(70, y - 16)
  ctx.lineTo(CARD_W - 70, y - 16)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `700 38px ${BRUSH}`
  ctx.fillText('阿嬤還在，民宿照開。', 76, y + 36)
  ctx.font = `500 26px ${SANS}`
  ctx.fillStyle = INK_2
  ctx.fillText('手機、電腦打開就能玩：', 76, y + 74)
  ctx.font = `700 26px ${SANS}`
  ctx.fillStyle = RED
  ctx.fillText(SHARE_URL.replace(/^https:\/\//, ''), 76, y + 106)

  // QR Code（白底、四格白邊）
  const m = qrMatrix(SHARE_URL)
  if (!m) return
  const size = 108
  const n = m.length + 8
  const cell = size / n
  const qx = CARD_W - 78 - size
  const qy = y - 2
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, qx - 4, qy - 4, size + 8, size + 8, 8)
  ctx.fill()
  ctx.fillStyle = '#1e1414'
  for (let r = 0; r < m.length; r++)
    for (let c = 0; c < m.length; c++) if (m[r][c]) ctx.fillRect(Math.floor(qx + (c + 4) * cell), Math.floor(qy + (r + 4) * cell), Math.ceil(cell), Math.ceil(cell))
}

// ---------------------------------------------------------------------------

/**
 * 畫出分享卡（1080×1350）。
 * 字型、頭像先全部載好，再一口氣同步畫完：2D 畫布在等待的時候可能被瀏覽器回收（context lost）而清空。
 */
export async function drawShareCard(d: ShareData): Promise<HTMLCanvasElement> {
  const say = grandmaSays(d)
  const [grandmaImg, faces] = await Promise.all([loadImage(portraitDataUrl('grandma', say.mood)), guestFaces(d.reviews)])
  await loadFonts(`《靈異好評》阿春民宿．第晚（開張）今日好評${MONTH_NAMES.join('')}0123456789${say.text}收入溫馨靈異小翰的心功德+−±$,${d.reviews.map((r) => r.name + r.text).join('')}「」——阿嬤還在，民宿照開。手機、電腦打開就能玩：……`)
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  // 用 CPU 畫（willReadFrequently）：GPU 畫布在手機、或 WebGL 很忙的時候可能整張被清掉
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  paper(ctx)
  header(ctx, d.night)
  photo(ctx, d.snapshot)
  grandmaBubble(ctx, d, grandmaImg)
  stats(ctx, d)
  guests(ctx, d.reviews, faces)
  quotes(ctx, d.reviews)
  footer(ctx)
  return canvas
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'))
}
