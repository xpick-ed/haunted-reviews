import { useMemo } from 'react'
import * as THREE from 'three'
import { VILLAGE } from '../world/sceneVillage'
import { WBox, seeded } from './kit'

// 村子南邊往廢棄國小的路：水溝上一座小水泥橋，接一條穿過水田的田埂小路（DESIGN §26.1）。
// 掛在 Village.tsx 裡；出口在 src/world/sceneVillage.ts（國小 ↓）。

export function VillageSchoolPath() {
  const x = VILLAGE.schoolBridge.x
  const d = VILLAGE.ditch
  const earth = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6e5a3e', roughness: 1 }), [])
  const grassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4e6a38', roughness: 1, flatShading: true }), [])
  // 田埂兩邊的一叢叢草
  const tufts = useMemo(() => {
    const r = seeded(2626)
    return Array.from({ length: 22 }, (_, i) => ({ side: i % 2 ? 1 : -1, z: d.z1 + 0.6 + r() * 22, s: 0.12 + r() * 0.12 }))
  }, [d.z1])
  const z0 = d.z0 - 0.12
  const z1 = d.z1 + 0.12
  return (
    <group>
      {/* 小水泥橋：橋面、兩邊的矮護欄 */}
      <WBox mat="yard" size={[1.9, 0.14, z1 - z0]} position={[x, 0.3, (z0 + z1) / 2]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <WBox mat="stone" size={[0.14, 0.32, z1 - z0]} position={[x + s * 0.95, 0.52, (z0 + z1) / 2]} />
          <WBox mat="trim" size={[0.18, 0.05, z1 - z0 + 0.04]} position={[x + s * 0.95, 0.7, (z0 + z1) / 2]} />
        </group>
      ))}
      {/* 田埂：從橋一直到遠方 */}
      <mesh position={[x, 0.12, d.z1 + 12]} material={earth} receiveShadow>
        <boxGeometry args={[1.25, 0.2, 24]} />
      </mesh>
      {tufts.map((t, i) => (
        <mesh key={i} position={[x + t.side * 0.66, 0.2 + t.s * 0.4, t.z]} scale={[t.s * 1.3, t.s, t.s]} material={grassMat}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  )
}
