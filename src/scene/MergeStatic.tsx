import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// 把不會動的網格依材質合併成少數幾個大網格，手機上 draw call 從幾百降到幾十。
// 子樹裡 userData.noMerge 的物件（會動的、會淡出的）保持原樣。
// 材質是共用同一個物件，所以燈籠發光、窗光這類改材質參數的動畫照樣有效。

const KEEP = new Set(['position', 'normal', 'uv'])

export function MergeStatic({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const group = useRef<THREE.Group>(null)
  useEffect(() => {
    if (!enabled) return
    const g = group.current
    if (!g) return
    const hidden: THREE.Mesh[] = []
    const added: THREE.Mesh[] = []
    // 等一幀，讓所有子元件（含 ref 設定的 instanced 矩陣）都掛好
    const id = requestAnimationFrame(() => {
      g.updateMatrixWorld(true)
      const inv = new THREE.Matrix4().copy(g.matrixWorld).invert()
      const rel = new THREE.Matrix4()
      const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean }>()
      const visit = (o: THREE.Object3D) => {
        if (o.userData.noMerge || !o.visible) return
        const m = o as THREE.Mesh
        if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(m.material)) {
          const src = m.geometry
          if (src.attributes.normal && src.attributes.uv) {
            const geo = src.index ? src.toNonIndexed() : src.clone()
            for (const k of Object.keys(geo.attributes)) if (!KEEP.has(k)) geo.deleteAttribute(k)
            geo.morphAttributes = {}
            geo.applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld))
            let b = buckets.get(m.material)
            if (!b) buckets.set(m.material, (b = { geos: [], cast: false }))
            b.geos.push(geo)
            b.cast ||= m.castShadow
            m.visible = false
            hidden.push(m)
          }
        }
        for (const c of o.children) visit(c)
      }
      visit(g)
      for (const [mat, b] of buckets) {
        const merged = mergeGeometries(b.geos)
        b.geos.forEach((x) => x.dispose())
        if (!merged) continue
        const mesh = new THREE.Mesh(merged, mat)
        mesh.castShadow = b.cast
        mesh.receiveShadow = true
        mesh.userData.noMerge = true
        g.add(mesh)
        added.push(mesh)
      }
    })
    return () => {
      cancelAnimationFrame(id)
      for (const m of added) {
        g.remove(m)
        m.geometry.dispose()
      }
      for (const m of hidden) m.visible = true
    }
  }, [enabled])
  return <group ref={group}>{children}</group>
}
