import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { player } from '../world/player'

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

/**
 * 關起門來的室內（DESIGN §30）：畫質降成低的時候（手機跑不動會自動降），阿嬤不在裡面、也不在門口附近，家具就先不畫。
 * 高畫質一直畫。從外面只看得到一點點門窗裡面，暗暗的看不出來；每間店省下幾十個 draw call。
 * 裡面不要放光源：光源數量一變，所有材質都要重新編譯（會卡一下）。
 */
export function InteriorCull({ ids, doors, near = 4.5, children }: { ids: string[]; doors: { x: number; z: number }[]; near?: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = group.current
    if (!g) return
    const s = useStore.getState()
    g.visible = s.quality === 'high' || (!!s.building && ids.includes(s.building)) || doors.some((d) => Math.hypot(player.x - d.x, player.z - d.z) < near)
  })
  return (
    <group ref={group} userData={{ noMerge: true }}>
      {children}
    </group>
  )
}
