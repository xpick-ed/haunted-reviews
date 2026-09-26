import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'

// ---------------------------------------------------------------------------
// 淡出（跟三合院、夜市的一樣：子樹裡的網格換成自己的材質複本，才能單獨調透明度）
// ---------------------------------------------------------------------------

export function Fader({ id, children }: { id: string; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const clones = useRef(new Map<THREE.Material, THREE.Material>())
  const seen = useRef(new WeakSet<THREE.Object3D>())
  const opacity = useRef(1)
  const frames = useRef(0)
  useFrame(() => {
    const g = group.current
    if (!g) return
    if (frames.current++ < 120)
      g.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || seen.current.has(m)) return
        seen.current.add(m)
        const swap = (mat: THREE.Material) => {
          let c = clones.current.get(mat)
          if (!c) {
            c = mat.clone()
            c.userData.baseOpacity = mat.opacity
            c.userData.baseTransparent = mat.transparent
            clones.current.set(mat, c)
          }
          return c
        }
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material)
      })
    const target = useStore.getState().faded.split(',').includes(id) ? 0.12 : 1
    const prev = opacity.current
    opacity.current += (target - opacity.current) * 0.15
    if (Math.abs(opacity.current - target) < 0.01) opacity.current = target
    if (Math.abs(opacity.current - prev) < 1e-4) return
    const o = opacity.current
    for (const c of clones.current.values()) {
      const wasT = c.transparent
      c.opacity = c.userData.baseOpacity * o
      c.transparent = c.userData.baseTransparent || o < 0.995
      c.depthWrite = !c.userData.baseTransparent && o > 0.5
      if (wasT !== c.transparent) c.needsUpdate = true
    }
  })
  return (
    <group ref={group} userData={{ noMerge: true }}>
      {children}
    </group>
  )
}
