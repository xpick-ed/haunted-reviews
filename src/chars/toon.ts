import * as THREE from 'three'
import { seeded } from '../scene/kit'

// 3D Q 版角色的材質：三階卡通光影、描邊、小碎花布、鬼的漸淡。
// 跟 2D 插畫同一個調性（深棕描邊、柔和色塊）。

let gradient: THREE.DataTexture | null = null
/** 三階光影：暗面、中間、亮面 */
export function toonGradient() {
  if (gradient) return gradient
  gradient = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat)
  gradient.minFilter = THREE.NearestFilter
  gradient.magFilter = THREE.NearestFilter
  gradient.generateMipmaps = false
  gradient.needsUpdate = true
  return gradient
}

const GHOST_TINT = new THREE.Color('#aef6ff')
const cache = new Map<string, THREE.Material>()

export interface ToonOpts {
  map?: THREE.Texture | null
  /** 自發光比例：夜裡也看得清楚角色（0.18 左右） */
  glow?: number
  ghost?: boolean
  /** 鬼的腳：往下漸漸透明 */
  fade?: boolean
  side?: THREE.Side
}

export function toon(color: string, o: ToonOpts = {}): THREE.MeshToonMaterial {
  const key = `t|${color}|${o.map?.uuid ?? ''}|${o.glow ?? ''}|${o.ghost ? 1 : 0}|${o.fade ? 1 : 0}|${o.side ?? 0}`
  const hit = cache.get(key)
  if (hit) return hit as THREE.MeshToonMaterial
  const c = new THREE.Color(color)
  const m = new THREE.MeshToonMaterial({ color: c, gradientMap: toonGradient(), map: o.map ?? null, side: o.side ?? THREE.FrontSide })
  const glow = o.glow ?? 0.2
  if (o.map) {
    m.emissiveMap = o.map
    m.emissive.setRGB(glow, glow, glow)
  } else {
    m.emissive.copy(c).multiplyScalar(glow)
  }
  if (o.ghost) {
    // 鬼：半透明、帶一點青白的光
    m.transparent = true
    m.opacity = 0.9
    m.emissive.lerp(GHOST_TINT, 0.3).multiplyScalar(0.85)
  }
  if (o.fade) {
    m.alphaMap = fadeTexture()
    m.transparent = true
    m.depthWrite = false
  }
  cache.set(key, m)
  return m
}

/** 描邊：背面朝外、沿法線推出去一點（inverted hull） */
export function outlineMat(thickness = 0.012, color = '#3b2a2a', opacity = 1): THREE.MeshBasicMaterial {
  const t = Math.round(thickness * 10000) / 10000
  const key = `o|${t}|${color}|${opacity}`
  const hit = cache.get(key)
  if (hit) return hit as THREE.MeshBasicMaterial
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: opacity < 1, opacity })
  // 厚度走 uniform：所有描邊共用同一個 shader program，只是數值不同
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uThick = { value: t }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uThick;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * uThick;')
  }
  m.customProgramCacheKey = () => 'toon-outline'
  cache.set(key, m)
  return m
}

let fadeTex: THREE.CanvasTexture | null = null
/** 上不透明、下透明的漸層（alphaMap 讀綠色通道） */
export function fadeTexture() {
  if (fadeTex) return fadeTex
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 64)
  g.addColorStop(0, '#fff')
  g.addColorStop(0.35, '#fff')
  g.addColorStop(1, '#000')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 64)
  fadeTex = new THREE.CanvasTexture(c)
  return fadeTex
}

const patternCache = new Map<string, THREE.CanvasTexture>()

/** 小碎花布（阿嬤衫、阿桂的花褲）。可以無縫拼接。 */
export function floralPrint(base: string, petals: string[], center: string, seed: number, repeat = 3): THREE.CanvasTexture {
  const key = `${base}|${petals.join()}|${center}|${seed}|${repeat}`
  const hit = patternCache.get(key)
  if (hit) return hit
  const S = 256
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, S, S)
  const r = seeded(seed)
  const flowers = Array.from({ length: 22 }, (_, i) => ({ x: r() * S, y: r() * S, s: 7 + r() * 5, col: petals[i % petals.length], rot: r() * Math.PI }))
  for (const f of flowers) {
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const x = f.x + ox
        const y = f.y + oy
        if (x < -20 || x > S + 20 || y < -20 || y > S + 20) continue
        ctx.fillStyle = f.col
        for (let k = 0; k < 5; k++) {
          const a = f.rot + (k / 5) * Math.PI * 2
          ctx.beginPath()
          ctx.ellipse(x + Math.cos(a) * f.s * 0.55, y + Math.sin(a) * f.s * 0.55, f.s * 0.5, f.s * 0.36, a, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = center
        ctx.beginPath()
        ctx.arc(x, y, f.s * 0.26, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  // 小點點填空
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  for (let i = 0; i < 60; i++) {
    ctx.beginPath()
    ctx.arc(r() * S, r() * S, 1.3, 0, Math.PI * 2)
    ctx.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  patternCache.set(key, t)
  return t
}
