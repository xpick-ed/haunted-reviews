import * as THREE from 'three'

// 佔位用的像素小人（DESIGN §16.2）。之後換成 AI 生成的立繪，尺寸規格不變。

export function pixelTexture(
  rows: string[],
  palette: Record<string, string>,
  opts: { fadeFrom?: number } = {},
): THREE.CanvasTexture {
  const h = rows.length
  const w = rows[0].length
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  rows.forEach((row, y) => {
    ;[...row].forEach((ch, x) => {
      const col = palette[ch]
      if (!col) return
      let a = 1
      if (opts.fadeFrom !== undefined && y >= opts.fadeFrom) {
        a = Math.max(0, 1 - (y - opts.fadeFrom + 1) / (h - opts.fadeFrom + 1))
      }
      ctx.globalAlpha = a
      ctx.fillStyle = col
      ctx.fillRect(x, y, 1, 1)
    })
  })
  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export const GRANDMA_ROWS = [
  '......HHHH......',
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '....HHSSSSHH....',
  '....HSSSSSSH....',
  '....SSESSESS....',
  '....SSSSSSSS....',
  '....SSSMMSSS....',
  '.....SSSSSS.....',
  '....PPPPPPPP....',
  '...PPDPPPPDPP...',
  '..PPPPPPDPPPPP..',
  '..SPPDPPPPPDPS..',
  '..SPPPPPPPPPPS..',
  '...PPPPDPPPPP...',
  '...PPPPPPPPPP...',
  '....KKKKKKKK....',
  '....KKKKKKKK....',
  '....KKK..KKK....',
  '....KKK..KKK....',
  '....KKK..KKK....',
  '....WWW..WWW....',
  '................',
  '................',
]

export const GRANDMA_PAL: Record<string, string> = {
  H: '#e4e6ea',
  S: '#f3cfae',
  E: '#3a2a2a',
  M: '#c96a6a',
  P: '#9a5fb5',
  D: '#f6c6ea',
  K: '#3b3550',
  W: '#a35c3a',
}

export const GUEST_ROWS = [
  '................',
  '.....hhhhhh.....',
  '....hhhhhhhh....',
  '....hhssssshh...',
  '....hsssssssh...',
  '....hsesssesh...',
  '....hsssssssh...',
  '....hssmmsssh...',
  '.....hsssssh....',
  '....pppppppp....',
  '...pppppppppp...',
  '..spppppppppps..',
  '..spppppppppps..',
  '...ppppFFpppp...',
  '...pppppppppp...',
  '...pppppppppp...',
  '....qqqqqqqq....',
  '....qqqqqqqq....',
  '....qqq..qqq....',
  '....qqq..qqq....',
  '....qqq..qqq....',
  '....ss...ss.....',
  '................',
  '................',
]

export const GUEST_PAL: Record<string, string> = {
  h: '#2b1d1a',
  s: '#f3cfae',
  e: '#2a2a3a',
  m: '#d98080',
  p: '#f2a6b8',
  F: '#cfeeff',
  q: '#f7c9d4',
}

// 嚇到的表情：眼睛變大、嘴巴張開
export const GUEST_SCARED_ROWS = GUEST_ROWS.map((row, y) => {
  if (y === 5 || y === 6) return '....heesseesh...'
  if (y === 7) return '....hssOOsssh...'
  return row
})

export const GUEST_SCARED_PAL: Record<string, string> = { ...GUEST_PAL, O: '#7a2a3a' }
