import { useMemo } from 'react'
import * as THREE from 'three'
import { seeded, useMats, windify } from './kit'
import { MergeStatic } from './MergeStatic'

// 土地公廟後面往山上的山路（DESIGN §26.1）：從廟埕西北角出發，沿著廟的西側、繞過老榕樹後面，
// 一路石板、最後幾階石階往西北，盡頭就是往墓仔埔的出口（scenes.ts 的 temple 出口 rect(-17,-9)–(-12.5,-6.5)）。
// 廟埕西邊是野台戲的戲台和板凳（src/world/sceneStage.ts），山路從戲台後面（北邊）繞過去。
// 路邊芒草。廟的場景是平的，石階只是視覺（很薄）。

/**
 * 山路的中心線（從廟埕西北角到出口）。
 * 繞過老榕樹樹幹的北邊之後，貼著戲台後面走（離樹冠遠一點，鏡頭才看得到阿嬤），最後往北上山。
 */
const PTS: [number, number][] = [
  [-4.3, 0.3],
  [-5.3, -1.3],
  [-5.5, -4.2],
  [-7.3, -4.9],
  [-9.3, -2.6],
  [-11.8, -2.35],
  [-13.8, -3.4],
  [-14.6, -5.6],
  [-15.2, -7.9],
]

export function TempleHillPath() {
  const mats = useMats()
  const slabs = useMemo(() => {
    const r = seeded(7117)
    const out: { x: number; z: number; w: number; d: number; ry: number; y: number }[] = []
    for (let i = 0; i < PTS.length - 1; i++) {
      const [ax, az] = PTS[i]
      const [bx, bz] = PTS[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      const n = Math.round(len / 0.75)
      const ang = Math.atan2(bx - ax, bz - az)
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n
        // 最後一段是石階：一階一階微微往上（視覺）
        const step = i >= PTS.length - 3 ? (i - (PTS.length - 3)) * n + k : -1
        out.push({
          x: ax + (bx - ax) * t + (r() - 0.5) * 0.18,
          z: az + (bz - az) * t + (r() - 0.5) * 0.18,
          w: 0.9 + r() * 0.35,
          d: 0.55 + r() * 0.15,
          ry: ang + (r() - 0.5) * 0.25,
          y: step >= 0 ? 0.04 + step * 0.012 : 0.03,
        })
      }
    }
    return out
  }, [])
  const flag = useMemo(() => {
    const m = mats.stone.clone()
    m.color.setRGB(0.78, 0.76, 0.72)
    return m
  }, [mats])
  const grass = useMemo(() => {
    const r = seeded(7331)
    const out: { x: number; z: number; s: number; ry: number }[] = []
    for (let i = 1; i < PTS.length; i++) {
      const [x, z] = PTS[i]
      for (const side of [-1, 1]) {
        if (r() < 0.25) continue
        out.push({ x: x + side * (1.0 + r() * 0.6), z: z + (r() - 0.5) * 1.2, s: 0.7 + r() * 0.5, ry: r() * 6 })
      }
    }
    return out
  }, [])
  const bladeMat = useMemo(() => windify(new THREE.MeshStandardMaterial({ color: '#7c8a4e', roughness: 0.9 }), 0.09), [])
  const plumeMat = useMemo(() => windify(new THREE.MeshStandardMaterial({ color: '#e6ddc6', roughness: 1 }), 0.09), [])
  return (
    <group>
      <MergeStatic>
        {slabs.map((s, i) => (
          <mesh key={i} material={flag} position={[s.x, s.y / 2, s.z]} rotation-y={s.ry} receiveShadow castShadow>
            <boxGeometry args={[s.w, s.y, s.d]} />
          </mesh>
        ))}
        {/* 出口旁的小石碑：「往公墓」 */}
        <mesh material={flag} position={[-12.9, 0.35, -8.5]} rotation-y={0.7} castShadow>
          <boxGeometry args={[0.3, 0.7, 0.12]} />
        </mesh>
      </MergeStatic>
      {/* 路邊的芒草（一叢一叢） */}
      {grass.map((g, i) => (
        <group key={i} position={[g.x, 0, g.z]} rotation-y={g.ry} scale={g.s}>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} material={bladeMat} position={[Math.sin(k * 1.3) * 0.1, 0.55, Math.cos(k * 1.3) * 0.1]} rotation={[Math.sin(k) * 0.2, k * 1.2, Math.cos(k) * 0.2]} castShadow>
              <boxGeometry args={[0.03, 1.1, 0.03]} />
            </mesh>
          ))}
          <mesh material={plumeMat} position={[0.05, 1.2, 0]} rotation-z={0.3}>
            <coneGeometry args={[0.06, 0.4, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
