import * as THREE from 'three'

// 臉：畫在 canvas 上，貼在頭（球）前面的一片球面上。
// 貼圖座標：水平方向對應經度（正前方在中間），垂直方向對應緯度（上面是額頭）。

export type Eyes = 'happy' | 'open' | 'down' | 'sleepy' | 'wide' | 'closed' | 'calm'
export type Mouth = 'grin' | 'smile' | 'small' | 'o' | 'scream' | 'flat' | 'goldgrin'
export type Brows = 'soft' | 'stern' | 'worried' | 'none'

export interface FaceSpec {
  eyes: Eyes
  mouth: Mouth
  brows?: Brows
  blush?: boolean
  wrinkles?: boolean
  stubble?: boolean
  /** 嚇到：額頭的藍色直線 */
  fear?: boolean
  sweat?: boolean
  lashes?: boolean
  eyeColor?: string
  /** 眼睛大小倍率（小孩的大眼睛 1.3） */
  eyeSize?: number
  /** 黑眼圈／眼袋（累的上班族） */
  bags?: boolean
  /** 眉毛顏色（阿土伯的白眉毛：會加一圈深色描邊） */
  browColor?: string
  /** 口紅（紅姨）：smile／small 的嘴畫成有顏色的嘴唇 */
  lipstick?: string
}

/** 臉這片球面的範圍（SphereGeometry 的 phi／theta 參數） */
export const FACE_PATCH = {
  phiStart: Math.PI / 2 - 1.25,
  phiLength: 2.5,
  thetaStart: 0.26 * Math.PI,
  thetaLength: 0.56 * Math.PI,
}

const W = 256
const H = 180
const K = 2 // 畫兩倍解析度
const LINE = '#3b2a2a'

/** 緯度（從頭頂量，0..π）→ 貼圖 y */
const Y = (theta: number) => ((theta - FACE_PATCH.thetaStart) / FACE_PATCH.thetaLength) * H
/** 離正前方的經度（弧度，右正）→ 貼圖 x */
const X = (phi: number) => W / 2 + (phi / FACE_PATCH.phiLength) * W

const EYE_Y = Y(0.56 * Math.PI)
const EYE_DX = 0.36
const BROW_Y = Y(0.465 * Math.PI)
const MOUTH_Y = Y(0.69 * Math.PI)
const CHEEK_Y = Y(0.63 * Math.PI)

const cache = new Map<string, THREE.CanvasTexture>()

export function faceTexture(f: FaceSpec): THREE.CanvasTexture {
  const key = JSON.stringify(f)
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = W * K
  c.height = H * K
  const ctx = c.getContext('2d')!
  ctx.scale(K, K)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  draw(ctx, f)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  cache.set(key, t)
  return t
}

function draw(ctx: CanvasRenderingContext2D, f: FaceSpec) {
  if (f.fear) {
    ctx.strokeStyle = 'rgba(70,110,220,0.8)'
    ctx.lineWidth = 2.2
    for (let i = -5; i <= 5; i++) {
      const x = W / 2 + i * 8
      ctx.beginPath()
      ctx.moveTo(x, 2)
      ctx.lineTo(x, 34 - Math.abs(i) * 3)
      ctx.stroke()
    }
  }
  if (f.wrinkles) {
    ctx.strokeStyle = 'rgba(150,95,70,0.55)'
    ctx.lineWidth = 1.6
    for (const [dy, w] of [
      [-30, 22],
      [-23, 16],
    ]) {
      ctx.beginPath()
      ctx.moveTo(W / 2 - w, BROW_Y + dy + 2)
      ctx.quadraticCurveTo(W / 2, BROW_Y + dy - 3, W / 2 + w, BROW_Y + dy + 2)
      ctx.stroke()
    }
  }
  if (f.blush) {
    for (const s of [-1, 1]) {
      const x = X(s * 0.6)
      const g = ctx.createRadialGradient(x, CHEEK_Y, 1, x, CHEEK_Y, 15)
      g.addColorStop(0, 'rgba(255,120,130,0.55)')
      g.addColorStop(1, 'rgba(255,120,130,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x, CHEEK_Y, 16, 10, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  for (const s of [-1, 1]) {
    const k = f.eyeSize ?? 1
    const x = X(s * EYE_DX)
    ctx.save()
    ctx.translate(x, EYE_Y)
    ctx.scale(k, k)
    ctx.translate(-x, -EYE_Y)
    drawEye(ctx, x, EYE_Y, s, f)
    ctx.restore()
  }
  if (f.bags) {
    ctx.strokeStyle = 'rgba(120,80,110,0.45)'
    ctx.lineWidth = 1.8
    for (const s of [-1, 1]) {
      const x = X(s * EYE_DX)
      ctx.beginPath()
      ctx.moveTo(x - 8, EYE_Y + 12)
      ctx.quadraticCurveTo(x, EYE_Y + 16, x + 8, EYE_Y + 12)
      ctx.stroke()
    }
  }
  drawBrows(ctx, f)
  if (f.wrinkles) {
    // 魚尾紋
    ctx.strokeStyle = 'rgba(150,95,70,0.5)'
    ctx.lineWidth = 1.4
    for (const s of [-1, 1]) {
      const x = X(s * (EYE_DX + 0.2))
      for (const a of [-0.35, 0, 0.35]) {
        ctx.beginPath()
        ctx.moveTo(x, EYE_Y + a * 8)
        ctx.lineTo(x + s * 7, EYE_Y + a * 14)
        ctx.stroke()
      }
    }
  }
  drawMouth(ctx, W / 2, MOUTH_Y, f.mouth, f.lipstick)
  if (f.stubble) {
    ctx.fillStyle = 'rgba(70,60,60,0.45)'
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI
      const rr = 30 + (i % 3) * 5
      ctx.beginPath()
      ctx.arc(W / 2 + Math.cos(a) * rr * 1.3, MOUTH_Y - 4 + Math.sin(a) * rr * 0.7, 0.9, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (f.sweat) {
    ctx.fillStyle = '#8fd0ff'
    ctx.strokeStyle = LINE
    ctx.lineWidth = 1.5
    for (const [x, y, s] of [
      [X(0.95), EYE_Y - 26, 1],
      [X(-1.0), EYE_Y - 10, 0.8],
    ]) {
      ctx.beginPath()
      ctx.moveTo(x, y - 9 * s)
      ctx.quadraticCurveTo(x + 7 * s, y + 3 * s, x, y + 6 * s)
      ctx.quadraticCurveTo(x - 7 * s, y + 3 * s, x, y - 9 * s)
      ctx.fill()
      ctx.stroke()
    }
  }
}

function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, f: FaceSpec) {
  ctx.strokeStyle = LINE
  ctx.fillStyle = f.eyeColor ?? '#2a1e1e'
  switch (f.eyes) {
    case 'happy': // ^ ^
      ctx.lineWidth = 3.6
      ctx.beginPath()
      ctx.arc(x, y + 5, 9, Math.PI * 1.12, Math.PI * 1.88)
      ctx.stroke()
      break
    case 'closed': // 睡著：往下彎
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y - 4, 8, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
      if (f.lashes) {
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.moveTo(x + s * 7, y + 1)
        ctx.lineTo(x + s * 11, y + 4)
        ctx.stroke()
      }
      break
    case 'sleepy': // 醉眼：上眼皮蓋一半
      ctx.beginPath()
      ctx.ellipse(x, y + 3, 7, 6, 0, 0, Math.PI)
      ctx.fill()
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x - 10, y + 2)
      ctx.lineTo(x + 10, y + 1)
      ctx.stroke()
      break
    case 'calm': // 半閉的眼睛（紅姨）：上眼皮蓋一半、眼線往外挑
      ctx.beginPath()
      ctx.ellipse(x, y + 1, 7, 8, 0, 0, Math.PI)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x - 2.2, y + 3.4, 1.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 3.4
      ctx.beginPath()
      ctx.moveTo(x - s * 10, y + 2)
      ctx.quadraticCurveTo(x, y - 3.5, x + s * 9, y)
      ctx.lineTo(x + s * 13.5, y - 3.5)
      ctx.stroke()
      if (f.lashes) {
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.moveTo(x + s * 5, y - 1.5)
        ctx.lineTo(x + s * 8, y - 6)
        ctx.stroke()
      }
      break
    case 'wide': // 嚇到：眼白很大、瞳孔很小
      ctx.fillStyle = '#ffffff'
      ctx.lineWidth = 2.6
      ctx.beginPath()
      ctx.ellipse(x, y, 11, 13, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#1a1414'
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'down': // 低頭看手機
    case 'open': {
      const lid = f.eyes === 'down' ? 4 : 0
      ctx.beginPath()
      ctx.ellipse(x, y + lid * 0.6, 7, 10 - lid * 0.4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x - 2.5, y - 4 + lid, 2.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + 2.5, y + 4, 1.4, 0, Math.PI * 2)
      ctx.fill()
      if (lid) {
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(x - 9, y - 4)
        ctx.quadraticCurveTo(x, y - 7, x + 9, y - 4)
        ctx.stroke()
      }
      if (f.lashes) {
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x + s * 6, y - 8 + lid)
        ctx.lineTo(x + s * 11, y - 11 + lid)
        ctx.stroke()
      }
      break
    }
  }
}

function drawBrows(ctx: CanvasRenderingContext2D, f: FaceSpec) {
  const b = f.brows ?? 'soft'
  if (b === 'none') return
  // 淺色眉毛（白眉）先畫一圈深色描邊，不然在皮膚上看不到
  const passes: [string, number][] = f.browColor
    ? [
        [LINE, (b === 'stern' ? 4 : 3.4) + 2.6],
        [f.browColor, b === 'stern' ? 4 : 3.4],
      ]
    : [[b === 'stern' ? '#3b2a2a' : 'rgba(80,55,45,0.85)', b === 'stern' ? 4 : 2.6]]
  for (const [color, width] of passes) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  for (const s of [-1, 1]) {
    const x = X(s * EYE_DX)
    ctx.beginPath()
    if (b === 'stern') {
      ctx.moveTo(x - s * 10, BROW_Y + 1)
      ctx.lineTo(x + s * 10, BROW_Y - 4)
    } else if (b === 'worried') {
      ctx.moveTo(x - s * 10, BROW_Y - 6)
      ctx.lineTo(x + s * 9, BROW_Y + 1)
    } else {
      ctx.moveTo(x - 9, BROW_Y)
      ctx.quadraticCurveTo(x, BROW_Y - 5, x + 9, BROW_Y)
    }
    ctx.stroke()
  }
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, x: number, y: number, m: Mouth, lipstick?: string) {
  ctx.strokeStyle = LINE
  ctx.lineWidth = 2.6
  if (lipstick && (m === 'smile' || m === 'small')) {
    // 擦了口紅的嘴唇：上唇兩個小山、下唇圓一點，嘴角微微上揚
    const w = m === 'smile' ? 9 : 6.5
    ctx.fillStyle = lipstick
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(x - w, y - 4)
    ctx.quadraticCurveTo(x - w * 0.45, y - 8, x, y - 5.5)
    ctx.quadraticCurveTo(x + w * 0.45, y - 8, x + w, y - 4)
    ctx.quadraticCurveTo(x, y + 4.5, x - w, y - 4)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = 'rgba(60,20,25,0.7)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(x - w + 1.5, y - 3.8)
    ctx.quadraticCurveTo(x, y - 2, x + w - 1.5, y - 3.8)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.ellipse(x - 2, y - 0.5, 2.2, 1, 0, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  switch (m) {
    case 'grin':
    case 'goldgrin':
      ctx.fillStyle = '#8a2e2e'
      ctx.beginPath()
      ctx.moveTo(x - 14, y - 3)
      ctx.quadraticCurveTo(x, y - 6, x + 14, y - 3)
      ctx.quadraticCurveTo(x + 11, y + 13, x, y + 14)
      ctx.quadraticCurveTo(x - 11, y + 13, x - 14, y - 3)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#e8828a'
      ctx.beginPath()
      ctx.ellipse(x, y + 9, 7, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      if (m === 'goldgrin') {
        ctx.fillStyle = '#f2c44a'
        ctx.fillRect(x + 3, y - 4, 5, 5)
      }
      break
    case 'smile':
      ctx.beginPath()
      ctx.arc(x, y - 6, 10, Math.PI * 0.2, Math.PI * 0.8)
      ctx.stroke()
      break
    case 'small':
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.arc(x, y - 4, 6, Math.PI * 0.2, Math.PI * 0.8)
      ctx.stroke()
      break
    case 'o':
      ctx.fillStyle = '#8a3e3e'
      ctx.beginPath()
      ctx.ellipse(x, y, 4, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'scream':
      ctx.fillStyle = '#6a1e22'
      ctx.beginPath()
      ctx.ellipse(x, y + 4, 13, 17, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x - 9, y - 11, 18, 4)
      ctx.fillStyle = '#e8828a'
      ctx.beginPath()
      ctx.ellipse(x, y + 14, 8, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'flat':
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x - 9, y)
      ctx.quadraticCurveTo(x, y + 1.5, x + 9, y)
      ctx.stroke()
      break
  }
}
