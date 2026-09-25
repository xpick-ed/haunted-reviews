import * as THREE from 'three'

// 客家花布：大紅底、層層牡丹、綠葉、小碎花。畫成 SVG（可以在 node 裡預覽），再畫進 canvas 當貼圖。
// 整個花樣畫在 512×512 的一格裡，四周用 <use> 複製八份，所以貼圖可以無縫重複。

const T = 512

interface Palette {
  deep: string
  mid: string
  light: string
  edge: string
}

const PAL: Record<'pink' | 'white' | 'magenta' | 'yellow', Palette> = {
  pink: { deep: '#a3083f', mid: '#ec4f86', light: '#ffb3cd', edge: '#6e0630' },
  white: { deep: '#e07f90', mid: '#fde0e4', light: '#ffffff', edge: '#a8606c' },
  magenta: { deep: '#5c0529', mid: '#c2185b', light: '#ff5c9a', edge: '#420320' },
  yellow: { deep: '#c96a00', mid: '#ffb81f', light: '#fff0b0', edge: '#8f5200' },
}

type FlowerKind = keyof typeof PAL

// 大朵牡丹：x, y, 半徑, 顏色, 旋轉
const PEONIES: [number, number, number, FlowerKind, number][] = [
  [100, 108, 80, 'pink', 5],
  [340, 70, 66, 'white', 20],
  [236, 300, 88, 'magenta', -10],
  [456, 340, 72, 'pink', 32],
  [80, 430, 64, 'white', 14],
  [412, 196, 48, 'yellow', 0],
  [30, 262, 44, 'magenta', 18],
  [300, 478, 46, 'yellow', 40],
  [186, 160, 40, 'white', -20],
]

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const f = (n: number) => n.toFixed(1)

function petalPath(L: number): string {
  // 朝上（-y）的花瓣，尖端有波浪
  return `M 0 0 C ${f(-0.56 * L)} ${f(-0.16 * L)}, ${f(-0.64 * L)} ${f(-0.84 * L)}, ${f(-0.3 * L)} ${f(-L)} Q ${f(-0.15 * L)} ${f(-0.9 * L)} 0 ${f(-0.99 * L)} Q ${f(0.15 * L)} ${f(-0.9 * L)} ${f(0.3 * L)} ${f(-L)} C ${f(0.64 * L)} ${f(-0.84 * L)}, ${f(0.56 * L)} ${f(-0.16 * L)}, 0 0 Z`
}

function leaf(x: number, y: number, len: number, angle: number): string {
  const L = len
  const body = `M 0 0 C ${f(L * 0.3)} ${f(-L * 0.3)}, ${f(L * 0.76)} ${f(-L * 0.26)}, ${f(L)} 0 C ${f(L * 0.76)} ${f(L * 0.26)}, ${f(L * 0.3)} ${f(L * 0.3)}, 0 0 Z`
  const veins = [0.3, 0.5, 0.7]
    .map((t) => `M ${f(L * t)} 0 L ${f(L * (t + 0.14))} ${f(-L * 0.12)} M ${f(L * t)} 0 L ${f(L * (t + 0.14))} ${f(L * 0.12)}`)
    .join(' ')
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})">
    <path d="${body}" fill="url(#leafG)" stroke="#0d3f1e" stroke-width="1.4"/>
    <path d="M 2 0 L ${f(L * 0.92)} 0" stroke="#a8ea8e" stroke-width="1.8" stroke-linecap="round"/>
    <path d="${veins}" stroke="#86d472" stroke-width="1.1" stroke-linecap="round" opacity="0.85"/>
  </g>`
}

function peony(i: number, cx: number, cy: number, R: number, kind: FlowerKind, rot: number): { defs: string; body: string } {
  const p = PAL[kind]
  const g = `pg${i}`
  const defs = `<radialGradient id="${g}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${R}">
    <stop offset="0" stop-color="${p.deep}"/><stop offset="0.5" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.light}"/>
  </radialGradient>`
  const ring = (n: number, L: number, off: number, extra = '') =>
    Array.from({ length: n }, (_, k) => {
      const a = rot + off + (k * 360) / n
      return `<path transform="translate(${cx} ${cy}) rotate(${f(a)})" d="${petalPath(L)}" fill="url(#${g})" stroke="${p.edge}" stroke-width="1.3" stroke-linejoin="round" ${extra}/>`
    }).join('')
  const highlights = Array.from({ length: 8 }, (_, k) => {
    const a = rot + (k * 360) / 8
    const L = R
    return `<path transform="translate(${cx} ${cy}) rotate(${f(a)})" d="M ${f(-0.12 * L)} ${f(-0.62 * L)} Q 0 ${f(-0.8 * L)} ${f(0.14 * L)} ${f(-0.66 * L)}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>`
  }).join('')
  const stamens = Array.from({ length: 9 }, (_, k) => {
    const a = (k * 2 * Math.PI) / 9 + rot
    const r = R * 0.12
    return `<circle cx="${f(cx + Math.cos(a) * r)}" cy="${f(cy + Math.sin(a) * r)}" r="${f(R * 0.045)}" fill="#ffe066" stroke="${p.edge}" stroke-width="0.8"/>`
  }).join('')
  const body = `<g>
    ${ring(8, R, 0)}
    ${highlights}
    ${ring(7, R * 0.72, 22)}
    ${ring(6, R * 0.46, 8)}
    <circle cx="${cx}" cy="${cy}" r="${f(R * 0.2)}" fill="${p.deep}" stroke="${p.edge}" stroke-width="1.2"/>
    ${stamens}
  </g>`
  return { defs, body }
}

function blossom(x: number, y: number, r: number, color: string, center: string): string {
  const petals = Array.from({ length: 5 }, (_, k) => {
    const a = (k * 2 * Math.PI) / 5 - Math.PI / 2
    return `<circle cx="${f(x + Math.cos(a) * r * 0.62)}" cy="${f(y + Math.sin(a) * r * 0.62)}" r="${f(r * 0.5)}" fill="${color}" stroke="#7a1026" stroke-width="0.8"/>`
  }).join('')
  return `${petals}<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.3)}" fill="${center}"/>`
}

/** 位置跟所有大花（含上下左右重複的那幾份）都不重疊 */
function clearOfFlowers(x: number, y: number, pad: number): boolean {
  for (const [cx, cy, R] of PEONIES) {
    for (const dx of [-T, 0, T]) {
      for (const dy of [-T, 0, T]) {
        if (Math.hypot(x - cx - dx, y - cy - dy) < R + pad) return false
      }
    }
  }
  return true
}

export function floralFabricSvg(): string {
  const rnd = seeded(20260925)
  const defs: string[] = [
    `<linearGradient id="leafG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1c6b32"/><stop offset="1" stop-color="#43b359"/></linearGradient>`,
    `<pattern id="weave" patternUnits="userSpaceOnUse" width="6" height="6"><path d="M 0 6 L 6 0" stroke="#000" stroke-width="1"/></pattern>`,
  ]
  const leaves: string[] = []
  const flowers: string[] = []
  PEONIES.forEach(([x, y, R, kind, rot], i) => {
    const n = R > 40 ? 3 : 2
    for (let k = 0; k < n; k++) {
      const a = rot + 30 + (k * 360) / n + rnd() * 30
      const rad = (a * Math.PI) / 180
      leaves.push(leaf(x + Math.cos(rad) * R * 0.5, y + Math.sin(rad) * R * 0.5, R * (1.0 + rnd() * 0.25), a))
    }
    const p = peony(i, x, y, R, kind, rot)
    defs.push(p.defs)
    flowers.push(p.body)
  })
  const small: string[] = []
  let tries = 0
  while (small.length < 16 && tries++ < 600) {
    const x = rnd() * T
    const y = rnd() * T
    if (!clearOfFlowers(x, y, 14)) continue
    const blue = rnd() < 0.55
    small.push(blossom(x, y, 9 + rnd() * 4, blue ? '#5eb2ec' : '#fff4d8', blue ? '#fff' : '#ffb300'))
  }
  const dots: string[] = []
  tries = 0
  while (dots.length < 70 && tries++ < 2000) {
    const x = rnd() * T
    const y = rnd() * T
    if (!clearOfFlowers(x, y, 6)) continue
    dots.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.6 + rnd() * 1.6)}" fill="#ffe9ef" opacity="0.85"/>`)
  }
  const uses = [-T, 0, T].flatMap((dx) => [-T, 0, T].map((dy) => `<use xlink:href="#motif" href="#motif" x="${dx}" y="${dy}"/>`)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}">
    <defs>${defs.join('')}<g id="motif">${dots.join('')}${leaves.join('')}${flowers.join('')}${small.join('')}</g></defs>
    <rect width="${T}" height="${T}" fill="#c8102e"/>
    ${uses}
    <rect width="${T}" height="${T}" fill="url(#weave)" opacity="0.06"/>
  </svg>`
}

let cached: THREE.CanvasTexture | null = null

/** 可重複的花布貼圖（全遊戲共用一張）。回傳時先是大紅底，SVG 畫好後自動更新。 */
export function floralFabricTexture(size = 1024): THREE.CanvasTexture {
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#c8102e'
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img, 0, 0, size, size)
    tex.needsUpdate = true
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(floralFabricSvg())
  cached = tex
  return tex
}
