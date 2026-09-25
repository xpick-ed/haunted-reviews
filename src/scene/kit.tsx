import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useTexture } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'

// 場景共用工具：PBR 材質、世界座標 UV 的方塊、風吹、SVG／文字貼圖。

// ---------------------------------------------------------------------------
// 材質
// ---------------------------------------------------------------------------

/** 有 Poly Haven 貼圖的材質（public/tex，見 scripts/fetch_textures.py） */
export type TexMat = 'brick' | 'roof' | 'yard' | 'tile' | 'wood' | 'plaster' | 'stone' | 'grass' | 'mud'

/** 一張貼圖在世界裡蓋多大（公尺）。boxGeo／planeGeo 用它算 UV，材質才能共用。 */
export const TILE: Record<TexMat, number> = {
  brick: 1.1,
  roof: 1.7,
  yard: 3.2,
  tile: 1.3,
  wood: 1.4,
  plaster: 2.2,
  stone: 1.6,
  grass: 5,
  mud: 4,
}

const HAS_ROUGH: Record<TexMat, boolean> = {
  brick: true,
  roof: true,
  yard: true,
  tile: true,
  wood: true,
  plaster: false,
  stone: true,
  grass: false,
  mud: false,
}

const BASE = import.meta.env.BASE_URL
/** 重新下載貼圖（scripts/fetch_textures.py）後要加一：網址變了，玩家手機裡的離線快取才會換新 */
const TEX_VERSION = 2
const PATHS: Record<string, string> = {}
for (const n of Object.keys(TILE) as TexMat[]) {
  PATHS[`${n}_diff`] = `${BASE}tex/${n}_diff.webp?v=${TEX_VERSION}`
  PATHS[`${n}_nor`] = `${BASE}tex/${n}_nor.webp?v=${TEX_VERSION}`
  if (HAS_ROUGH[n]) PATHS[`${n}_rough`] = `${BASE}tex/${n}_rough.webp?v=${TEX_VERSION}`
}

/** 純色材質（不需要貼圖的小東西） */
export type FlatMat =
  | 'redPaint' // 紅色油漆（柱子、門）
  | 'darkWood' // 深色木頭（家具、窗框）
  | 'gold' // 金色（門環、裝飾）
  | 'glaze' // 綠釉（竹節窗）
  | 'redPaper' // 春聯紅紙
  | 'black'
  | 'trim' // 白灰泥收邊
  | 'ridge' // 屋脊
  | 'bamboo' // 竹子（椅子、竹竿）
  | 'terracotta' // 陶盆
  | 'ceramic' // 深褐釉（水缸、茶壺）
  | 'metal' // 鐵件（電線桿、腳踏車）
  | 'cloth' // 素色布
  | 'leaf' // 植物綠

export type MatName = TexMat | FlatMat

const FLAT: Record<FlatMat, THREE.MeshStandardMaterialParameters> = {
  redPaint: { color: '#8f2a20', roughness: 0.55 },
  darkWood: { color: '#3d271a', roughness: 0.7 },
  gold: { color: '#d8a444', roughness: 0.32, metalness: 0.75 },
  glaze: { color: '#3f7d5c', roughness: 0.28 },
  redPaper: { color: '#c3302a', roughness: 0.85 },
  black: { color: '#1a1a1e', roughness: 0.6 },
  trim: { color: '#e6dfd0', roughness: 0.9 },
  ridge: { color: '#8a3a25', roughness: 0.7 },
  bamboo: { color: '#b9a063', roughness: 0.6 },
  terracotta: { color: '#a9553a', roughness: 0.85 },
  ceramic: { color: '#4a2e22', roughness: 0.22 },
  metal: { color: '#5b5f66', roughness: 0.45, metalness: 0.6 },
  cloth: { color: '#e8e2d4', roughness: 0.95 },
  leaf: { color: '#3e6b35', roughness: 0.8 },
}

export type Mats = Record<MatName, THREE.MeshStandardMaterial>

function buildMats(maps: Record<string, THREE.Texture>, anisotropy: number): Mats {
  const out = {} as Mats
  for (const n of Object.keys(TILE) as TexMat[]) {
    const diff = maps[`${n}_diff`]
    const nor = maps[`${n}_nor`]
    const rough = maps[`${n}_rough`]
    for (const t of [diff, nor, rough]) {
      if (!t) continue
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = anisotropy
    }
    diff.colorSpace = THREE.SRGBColorSpace
    out[n] = new THREE.MeshStandardMaterial({
      map: diff,
      normalMap: nor,
      roughnessMap: rough ?? null,
      roughness: rough ? 1 : 0.9,
      normalScale: new THREE.Vector2(1, 1),
    })
  }
  out.grass.normalScale.set(0.6, 0.6)
  out.grass.color.set('#7d9868') // 原圖太淡，壓暗偏綠
  out.yard.normalScale.set(0.6, 0.6)
  out.yard.color.set('#a9a398') // 水泥埕別太亮太髒
  for (const [k, p] of Object.entries(FLAT)) out[k as FlatMat] = new THREE.MeshStandardMaterial(p)
  return out
}

const MatsContext = createContext<Mats | null>(null)

/** 放在 <Suspense> 裡面，會等貼圖載完 */
export function MatsProvider({ children, anisotropy = 8 }: { children: ReactNode; anisotropy?: number }) {
  const maps = useTexture(PATHS) as unknown as Record<string, THREE.Texture>
  const mats = useMemo(() => buildMats(maps, anisotropy), [maps, anisotropy])
  return <MatsContext.Provider value={mats}>{children}</MatsContext.Provider>
}

export function useMats(): Mats {
  const m = useContext(MatsContext)
  if (!m) throw new Error('useMats() 必須在 <MatsProvider> 裡面')
  return m
}

const isTex = (m: MatName): m is TexMat => m in TILE

// ---------------------------------------------------------------------------
// 世界座標 UV 的幾何（同一個材質在不同大小的方塊上，磚塊大小一致）
// ---------------------------------------------------------------------------

const geoCache = new Map<string, THREE.BufferGeometry>()

/** BoxGeometry，UV 依各面的實際尺寸除以 tile 縮放 */
export function boxGeo(w: number, h: number, d: number, tile = 1): THREE.BufferGeometry {
  const key = `b${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${tile}`
  let g = geoCache.get(key)
  if (g) return g
  g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // BoxGeometry 的面順序：+x, -x, +y, -y, +z, -z，每面 4 個頂點
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile)
    }
  }
  geoCache.set(key, g)
  return g
}

/** PlaneGeometry（XY 平面），UV 依尺寸縮放 */
export function planeGeo(w: number, h: number, tile = 1, segX = 1, segY = 1): THREE.BufferGeometry {
  const key = `p${w.toFixed(3)},${h.toFixed(3)},${tile},${segX},${segY}`
  let g = geoCache.get(key)
  if (g) return g
  g = new THREE.PlaneGeometry(w, h, segX, segY)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * w) / tile, (uv.getY(k) * h) / tile)
  geoCache.set(key, g)
  return g
}

type MeshProps = ThreeElements['mesh']

/** 用共用材質的方塊。mat 是材質名稱；有貼圖的材質會自動用對應的 TILE 算 UV。 */
export function WBox({
  size,
  mat,
  tile,
  castShadow = true,
  receiveShadow = true,
  ...rest
}: { size: [number, number, number]; mat: MatName; tile?: number } & Omit<MeshProps, 'geometry' | 'material'>) {
  const mats = useMats()
  const t = tile ?? (isTex(mat) ? TILE[mat] : 1)
  return <mesh geometry={boxGeo(size[0], size[1], size[2], t)} material={mats[mat]} castShadow={castShadow} receiveShadow={receiveShadow} {...rest} />
}

// ---------------------------------------------------------------------------
// 風：植物、衣服用。Scene 每幀更新 wind.value（秒）。
// ---------------------------------------------------------------------------

export const wind = { value: 0 }

/**
 * 讓材質隨風搖。越高（local y 越大）搖越多；instanced mesh 會依每個實例的位置錯開相位。
 * strength 大約 0.05（草）～ 0.3（香蕉葉）。
 */
export function windify<T extends THREE.Material>(mat: T, strength: number, heightScale = 1): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        vec4 wOrigin = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          wOrigin = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #endif
        float wh = max(position.y * ${heightScale.toFixed(3)}, 0.0);
        float ws = sin(uTime * 1.6 + wOrigin.x * 0.55 + wOrigin.z * 0.35) * 0.6
                 + sin(uTime * 2.7 + wOrigin.x * 1.3 - wOrigin.z * 0.8) * 0.25;
        transformed.x += ws * wh * wh * ${strength.toFixed(3)};
        transformed.z += ws * 0.5 * wh * wh * ${strength.toFixed(3)};`,
      )
  }
  mat.customProgramCacheKey = () => `wind-${strength}-${heightScale}`
  return mat
}

// ---------------------------------------------------------------------------
// 畫在 canvas 上的貼圖
// ---------------------------------------------------------------------------

/** SVG 字串 → 貼圖。回傳時是空的，圖片載入後自動更新。 */
export function svgTexture(svg: string, w: number, h: number, scale = 2): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale)
  c.height = Math.round(h * scale)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const img = new Image()
  img.onload = () => {
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    tex.needsUpdate = true
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  return tex
}

/**
 * 用 2D canvas 畫的貼圖。會先畫一次，等 fonts 裡列的字型載完再重畫一次
 * （Google Fonts 的中文字型是按字分片下載的，要先 load 才畫得出來）。
 */
export function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  fonts: { spec: string; text: string }[] = [],
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const paint = () => {
    ctx.clearRect(0, 0, w, h)
    draw(ctx, w, h)
    tex.needsUpdate = true
  }
  paint()
  if (fonts.length && document.fonts) {
    Promise.all(fonts.map((f) => document.fonts.load(f.spec, f.text)))
      .then(paint)
      .catch(() => {})
  }
  return tex
}

/** 毛筆感的字型堆疊：霞鶩文楷 → 思源宋體 → 系統 */
export const BRUSH_FONT = `"LXGW WenKai TC", "Noto Serif TC", "PingFang TC", serif`

/** 固定亂數（場景擺設每次重新整理都一樣） */
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
