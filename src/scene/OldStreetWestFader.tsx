import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'

// 西邊兩間店外殼的淡出：跟 OldStreetFader 一樣換成材質複本，但淡到底就整個藏起來——
// 店面小、鏡頭低，半透明的二樓、招牌、屋頂疊在一起還是會擋住店裡。
// 阿嬤在店裡、或在西邊隔壁的店裡（這棟擋到鏡頭）才會淡；走在街上、騎樓都不會（遮擋盒子只算亭仔腳頂以上）。

/** id 可以給好幾個：例如中藥行的外殼，阿嬤在中藥行裡、或在西邊隔壁的理髮廳裡（中藥行的招牌、二樓擋住鏡頭）都藏起來 */
export function ShopFader({ id, children }: { id: string | string[]; children: ReactNode }) {
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
    const s = useStore.getState()
    const ids = typeof id === 'string' ? [id] : id
    const faded = s.faded.split(',')
    const target = ids.some((x) => s.building === x || faded.includes(x)) ? 0 : 1
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
