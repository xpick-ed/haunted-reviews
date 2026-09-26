import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'

// ---------------------------------------------------------------------------
// 淡出（跟三合院、夜市的一樣：子樹裡的網格換成自己的材質複本，才能單獨調透明度）
// ---------------------------------------------------------------------------

/**
 * id 可以給好幾個：任何一個被淡出就淡出（例如店的外殼：走進店裡、或在隔壁擋到鏡頭）。
 * hide：阿嬤在這些建築裡時整個藏起來（隔壁的店很小、鏡頭很低，半透明的招牌還是會擋住）。
 */
export function Fader({ id, hide, children }: { id: string | string[]; hide?: string[]; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const clones = useRef(new Map<THREE.Material, THREE.Material>())
  const seen = useRef(new WeakSet<THREE.Object3D>())
  const opacity = useRef(1)
  const frames = useRef(0)
  useFrame((_, dt) => {
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
    const st = useStore.getState()
    const faded = st.faded.split(',')
    const hidden = !!hide && !!st.building && hide.includes(st.building)
    const target = hidden ? 0 : (typeof id === 'string' ? faded.includes(id) : id.some((x) => faded.includes(x))) ? 0.12 : 1
    const prev = opacity.current
    // 跟幀率無關（60fps 大約 0.4 秒淡完）
    opacity.current += (target - opacity.current) * (1 - Math.exp(-Math.min(dt, 1) * 9))
    if (Math.abs(opacity.current - target) < 0.01) opacity.current = target
    g.visible = opacity.current > 0.005
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
