import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { OLDSTREET } from '../world/sceneOldStreet'
import { EAST_BACK } from '../world/osEast'
import { lanternAt } from './daylight'
import { TILE, boxGeo, useMats } from './kit'

// 老街東邊三間店（OldStreetEast*.tsx）共用的小東西：地板高度、玻璃、夜裡亮的材質、店裡的牆。

export const O = OLDSTREET
export const A = OLDSTREET.arcade
/** 亭仔腳和店裡的地板高度 */
export const FLOOR = 0.14
export const BACK = EAST_BACK
/** 店裡的深度（店面牆後面到後牆） */
export const DEPTH = A.frontZ - 0.24 - BACK
export const MID_Z = (A.frontZ - 0.24 + BACK) / 2

export const glassMat = new THREE.MeshStandardMaterial({ color: '#dfeff2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false })

/** 夜裡亮的材質（店裡的燈、招牌）；strength 越大越亮，base 是白天的亮度 */
export function useNightGlow(color: string, strength = 1, base = 0.08) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false }), [color])
  const on = useMemo(() => new THREE.Color(color), [color])
  const off = useMemo(() => new THREE.Color(color).multiplyScalar(base), [color, base])
  useFrame(() => {
    const l = lanternAt(useStore.getState().time)
    mat.color.copy(off).lerp(on, THREE.MathUtils.clamp(0.25 + l * strength, 0, 1.4))
  })
  mat.userData.live = true
  return mat
}

/** 上了色的灰泥（每間店的牆色） */
export function usePlaster(color: string) {
  const mats = useMats()
  return useMemo(() => {
    const m = mats.plaster.clone()
    m.color.set(color)
    return m
  }, [mats, color])
}

/** 上了色的地板（磁磚或木頭） */
export function useFloorMat(kind: 'tile' | 'wood', color: string) {
  const mats = useMats()
  return useMemo(() => {
    const m = mats[kind].clone()
    m.color.set(color)
    return m
  }, [mats, kind, color])
}

/** 店裡的一面牆（x 方向或 z 方向），高到一樓天花板 */
export function Wall({ x0, x1, z0, z1, mat }: { x0: number; x1: number; z0: number; z1: number; mat: THREE.Material }) {
  const w = x1 - x0
  const d = z1 - z0
  return <mesh geometry={boxGeo(w, A.ceilY, d, TILE.plaster)} material={mat} position={[(x0 + x1) / 2, A.ceilY / 2, (z0 + z1) / 2]} receiveShadow />
}

/** 簡單的盒子（自己的材質） */
export function Box({ s, p, m, cast = true, rot }: { s: [number, number, number]; p: [number, number, number]; m: THREE.Material; cast?: boolean; rot?: [number, number, number] }) {
  return <mesh geometry={boxGeo(s[0], s[1], s[2], 1)} material={m} position={p} rotation={rot} castShadow={cast} receiveShadow />
}

/** 一種顏色的標準材質（快取，同色共用一個，合併時比較省） */
const flatCache = new Map<string, THREE.MeshStandardMaterial>()
export function flat(color: string, roughness = 0.7, metalness = 0) {
  const key = `${color}|${roughness}|${metalness}`
  let m = flatCache.get(key)
  if (!m) flatCache.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness, metalness })))
  return m
}

/**
 * 店的外殼淡出（跟 OldStreetFader 的 Fader 一樣：子樹的網格換成自己的材質複本才能單獨調透明度），
 * 多做一件事：原本的材質標了 userData.live（晚上會亮的窗、櫥窗）就每幀把顏色抄過去，複本才會跟著亮。
 * id 給好幾個時，任何一個被淡出就淡出。
 */
export function ShopFader({ id, children }: { id: string | string[]; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const clones = useRef(new Map<THREE.Material, THREE.Material>())
  const seen = useRef(new WeakSet<THREE.Object3D>())
  const opacity = useRef(1)
  const frames = useRef(0)
  /** 外殼的網格和原本會不會投影子：淡出以後不投影子，店裡才不會整片暗暗的 */
  const meshes = useRef<{ m: THREE.Mesh; cast: boolean }[]>([])
  const casting = useRef(true)
  const ids = typeof id === 'string' ? [id] : id
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    if (frames.current++ < 120)
      g.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || seen.current.has(m)) return
        seen.current.add(m)
        meshes.current.push({ m, cast: m.castShadow })
        if (!casting.current) m.castShadow = false
        const swap = (mat: THREE.Material) => {
          let c = clones.current.get(mat)
          if (!c) {
            c = mat.clone()
            c.userData.baseOpacity = mat.opacity
            c.userData.baseTransparent = mat.transparent
            c.userData.baseEmissive = (mat as THREE.MeshStandardMaterial).emissiveIntensity
            clones.current.set(mat, c)
          }
          return c
        }
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material)
      })
    // 會亮的材質：顏色跟著原本的走（自發光也要乘上透明度，不然淡出了櫥窗還是亮亮的一片）
    for (const [orig, c] of clones.current) {
      if (!orig.userData.live) continue
      const a = orig as THREE.MeshStandardMaterial
      const b = c as THREE.MeshStandardMaterial
      b.color?.copy(a.color)
      if (a.emissive && b.emissive) {
        b.emissive.copy(a.emissive)
        b.emissiveIntensity = a.emissiveIntensity * opacity.current
      }
    }
    const faded = useStore.getState().faded.split(',')
    // 店的外殼層數多（屋頂、二樓、立面、招牌），淡到比戲院更透，才看得清楚店裡
    const target = ids.some((x) => faded.includes(x)) ? 0.05 : 1
    const prev = opacity.current
    // 跟幀率無關（60fps 大約 0.4 秒淡完）
    opacity.current += (target - opacity.current) * (1 - Math.exp(-Math.min(dt, 1) * 9))
    if (Math.abs(opacity.current - target) < 0.01) opacity.current = target
    if (Math.abs(opacity.current - prev) < 1e-4) return
    const o = opacity.current
    if (casting.current !== o > 0.5) {
      casting.current = o > 0.5
      for (const x of meshes.current) x.m.castShadow = casting.current && x.cast
    }
    for (const c of clones.current.values()) {
      const wasT = c.transparent
      c.opacity = c.userData.baseOpacity * o
      c.transparent = c.userData.baseTransparent || o < 0.995
      c.depthWrite = !c.userData.baseTransparent && o > 0.5
      const e = c as THREE.MeshStandardMaterial
      if (e.emissive && !c.userData.live) e.emissiveIntensity = (c.userData.baseEmissive ?? 1) * o
      if (wasT !== c.transparent) c.needsUpdate = true
    }
  })
  return (
    <group ref={group} userData={{ noMerge: true }}>
      {children}
    </group>
  )
}
