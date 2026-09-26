import * as THREE from 'three'
import { BRUSH_FONT, canvasTexture } from './kit'

// 野台戲的彩繪貼圖（全部 canvas 畫，只畫一次）：布景、兩側對聯、團名招牌、台前的紅布幔、
// 棚頂的紅白條紋、平常蓋著的帆布、普渡拜桌的紅桌裙。

export const TROUPE = '新鳳春歌劇團'

const cache = new Map<string, THREE.CanvasTexture>()
function once(key: string, make: () => THREE.CanvasTexture) {
  let t = cache.get(key)
  if (!t) cache.set(key, (t = make()))
  return t
}

/** 如意雲：一朵捲捲的雲 */
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(-30, 0, 22, Math.PI * 0.5, Math.PI * 1.9)
  ctx.arc(0, -12, 26, Math.PI * 1.1, Math.PI * 1.95)
  ctx.arc(32, 0, 20, Math.PI * 1.2, Math.PI * 0.5)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // 捲起來的漩渦
  ctx.beginPath()
  ctx.arc(-30, 2, 9, 0, Math.PI * 1.5)
  ctx.arc(32, 2, 8, Math.PI, Math.PI * 2.4)
  ctx.stroke()
  ctx.restore()
}

/** 布景：月夜、遠山、紅亭子、柳樹、如意雲，外面一圈金框 */
export function backdropTex() {
  return once('backdrop', () =>
    canvasTexture(1024, 768, (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h)
      sky.addColorStop(0, '#1f3f6a')
      sky.addColorStop(0.55, '#4f86a8')
      sky.addColorStop(1, '#f2c89a')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, h)
      // 月亮
      ctx.fillStyle = '#fff4cc'
      ctx.shadowColor = '#fff4cc'
      ctx.shadowBlur = 40
      ctx.beginPath()
      ctx.arc(w * 0.72, h * 0.2, 60, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      // 遠山三層
      const mountains = [
        { y: 0.58, c: '#5a7f96', a: 70 },
        { y: 0.66, c: '#3f6a6e', a: 90 },
        { y: 0.76, c: '#2c5244', a: 60 },
      ]
      mountains.forEach((m, k) => {
        ctx.fillStyle = m.c
        ctx.beginPath()
        ctx.moveTo(0, h)
        for (let x = 0; x <= w; x += 16) {
          const y = h * m.y - Math.abs(Math.sin(x * 0.006 + k * 1.7)) * m.a - Math.sin(x * 0.019 + k) * 18
          ctx.lineTo(x, y)
        }
        ctx.lineTo(w, h)
        ctx.closePath()
        ctx.fill()
      })
      // 水面
      ctx.fillStyle = 'rgba(160,210,220,0.35)'
      ctx.fillRect(0, h * 0.82, w, h * 0.18)
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 3
      for (let i = 0; i < 9; i++) {
        const y = h * 0.85 + i * 11
        ctx.beginPath()
        ctx.moveTo(w * 0.1 + ((i * 97) % 300), y)
        ctx.lineTo(w * 0.1 + ((i * 97) % 300) + 120, y)
        ctx.stroke()
      }
      // 紅亭子（左）
      const px = w * 0.2
      const py = h * 0.62
      ctx.fillStyle = '#8a2a20'
      ctx.fillRect(px - 70, py - 90, 12, 110)
      ctx.fillRect(px + 58, py - 90, 12, 110)
      ctx.fillStyle = '#6a4a3a'
      ctx.fillRect(px - 90, py + 18, 180, 16)
      ctx.fillStyle = '#2a4a3a'
      ctx.beginPath()
      ctx.moveTo(px - 120, py - 80)
      ctx.quadraticCurveTo(px, py - 190, px + 120, py - 80)
      ctx.quadraticCurveTo(px, py - 110, px - 120, py - 80)
      ctx.fill()
      ctx.fillStyle = '#d8a444'
      ctx.beginPath()
      ctx.arc(px, py - 158, 9, 0, Math.PI * 2)
      ctx.fill()
      // 柳樹（右）
      const tx = w * 0.86
      ctx.strokeStyle = '#3a2a1a'
      ctx.lineWidth = 16
      ctx.beginPath()
      ctx.moveTo(tx, h)
      ctx.quadraticCurveTo(tx - 20, h * 0.6, tx - 60, h * 0.32)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(90,150,70,0.85)'
      ctx.lineWidth = 3
      for (let i = 0; i < 26; i++) {
        const sx = tx - 150 + i * 9
        const sy = h * 0.3 + Math.sin(i) * 20
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.quadraticCurveTo(sx + 8, sy + 90, sx - 4, sy + 170 + (i % 5) * 18)
        ctx.stroke()
      }
      // 如意雲
      cloud(ctx, w * 0.42, h * 0.16, 1.4, 'rgba(255,255,255,0.28)')
      cloud(ctx, w * 0.12, h * 0.28, 1.0, 'rgba(255,255,255,0.22)')
      cloud(ctx, w * 0.9, h * 0.1, 0.9, 'rgba(255,255,255,0.22)')
      // 金框
      ctx.strokeStyle = '#d8a444'
      ctx.lineWidth = 22
      ctx.strokeRect(11, 11, w - 22, h - 22)
      ctx.strokeStyle = '#8a2a20'
      ctx.lineWidth = 6
      ctx.strokeRect(28, 28, w - 56, h - 56)
    }),
  )
}

/** 兩側的對聯板（紅漆金字，直寫） */
export function wingTex(text: string) {
  return once(`wing:${text}`, () =>
    canvasTexture(
      256,
      1024,
      (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, 0)
        g.addColorStop(0, '#6a1410')
        g.addColorStop(0.5, '#a3201b')
        g.addColorStop(1, '#6a1410')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#d8a444'
        ctx.lineWidth = 14
        ctx.strokeRect(10, 10, w - 20, h - 20)
        // 上下的龍紋（簡化成捲草）
        ctx.strokeStyle = '#e8c066'
        ctx.lineWidth = 6
        for (const y of [70, h - 70]) {
          ctx.beginPath()
          ctx.arc(w / 2 - 30, y, 22, 0, Math.PI * 1.6)
          ctx.arc(w / 2 + 30, y, 22, Math.PI, Math.PI * 2.6)
          ctx.stroke()
        }
        ctx.fillStyle = '#f2d27a'
        ctx.font = `700 150px ${BRUSH_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const chars = [...text]
        chars.forEach((c, i) => ctx.fillText(c, w / 2, 190 + i * ((h - 380) / Math.max(1, chars.length - 1))))
      },
      [{ spec: `700 150px ${BRUSH_FONT}`, text }],
    ),
  )
}

/** 團名招牌 */
export function headerTex() {
  return once('header', () =>
    canvasTexture(
      1024,
      144,
      (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h)
        g.addColorStop(0, '#b3261e')
        g.addColorStop(1, '#6e1410')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#e8c066'
        ctx.lineWidth = 8
        ctx.strokeRect(8, 8, w - 16, h - 16)
        ctx.lineWidth = 3
        ctx.strokeRect(20, 20, w - 40, h - 40)
        ctx.fillStyle = '#ffe08a'
        ctx.shadowColor = '#ffb030'
        ctx.shadowBlur = 16
        ctx.font = `900 92px ${BRUSH_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(TROUPE, w / 2, h / 2 + 4)
      },
      [{ spec: `900 92px ${BRUSH_FONT}`, text: TROUPE }],
    ),
  )
}

/** 台前的紅布幔：金色海水紋、流蘇 */
export function skirtTex() {
  return once('skirt', () =>
    canvasTexture(1024, 256, (ctx, w, h) => {
      ctx.fillStyle = '#a3201b'
      ctx.fillRect(0, 0, w, h)
      // 海水紋
      ctx.strokeStyle = 'rgba(242,210,122,0.85)'
      ctx.lineWidth = 5
      for (let row = 0; row < 3; row++) {
        const y = h * 0.42 + row * 42
        for (let x = -40; x < w + 40; x += 80) {
          ctx.beginPath()
          ctx.arc(x + (row % 2) * 40, y, 34, Math.PI, Math.PI * 2)
          ctx.stroke()
        }
      }
      // 上緣金邊、流蘇
      ctx.fillStyle = '#d8a444'
      ctx.fillRect(0, 0, w, 18)
      for (let x = 6; x < w; x += 16) ctx.fillRect(x, 18, 5, 22)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(0, h - 14, w, 14)
    }),
  )
}

/** 棚頂的紅白條紋帆布 */
export function canopyTex() {
  return once('canopy', () =>
    canvasTexture(256, 256, (ctx, w, h) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#f2ede2' : '#c8302a'
        ctx.fillRect((i * w) / 8, 0, w / 8, h)
      }
    }),
  )
}

/** 平常摺起來的藍白紅帆布 */
export function tarpTex() {
  return once('tarp', () =>
    canvasTexture(256, 128, (ctx, w, h) => {
      const cols = ['#2d5a9a', '#f2efe6', '#c8302a', '#f2efe6']
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = cols[i % 4]
        ctx.fillRect(0, (i * h) / 16, w, h / 16)
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      for (let x = 0; x < w; x += 24) ctx.fillRect(x, 0, 2, h)
    }),
  )
}

/** 普渡拜桌的紅桌裙 */
export function drapeTex(text: string) {
  return once(`drape:${text}`, () =>
    canvasTexture(
      768,
      192,
      (ctx, w, h) => {
        ctx.fillStyle = '#b3261e'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#d8a444'
        ctx.fillRect(0, 0, w, 14)
        ctx.fillRect(0, h - 14, w, 14)
        ctx.fillStyle = '#ffe08a'
        ctx.font = `700 110px ${BRUSH_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, w / 2, h / 2 + 4)
      },
      [{ spec: `700 110px ${BRUSH_FONT}`, text }],
    ),
  )
}
