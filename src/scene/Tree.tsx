import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// 庭院外的老榕樹，有氣根。樹冠會微微搖。
export function Tree({ position = [-14.5, 0, 1.5] as [number, number, number], scale = 1 }) {
  const canopy = useRef<THREE.Group>(null)
  const roots = useMemo(() => {
    const out: { x: number; z: number; h: number; r: number }[] = []
    let seed = 7
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2
      const d = 0.9 + rnd() * 1.9
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, h: 3.2 + rnd() * 1.6, r: 0.03 + rnd() * 0.04 })
    }
    return out
  }, [])

  useFrame(({ clock }) => {
    if (!canopy.current) return
    const t = clock.elapsedTime
    canopy.current.rotation.z = Math.sin(t * 0.6) * 0.015
    canopy.current.rotation.x = Math.cos(t * 0.45) * 0.012
  })

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.85, 3.6, 9]} />
        <meshStandardMaterial color="#5a4331" roughness={1} />
      </mesh>
      {roots.map((r, i) => (
        <mesh key={i} position={[r.x, r.h / 2, r.z]} castShadow>
          <cylinderGeometry args={[r.r, r.r * 1.6, r.h, 5]} />
          <meshStandardMaterial color="#6b5240" roughness={1} />
        </mesh>
      ))}
      <group ref={canopy} position={[0, 4.6, 0]}>
        {[
          [0, 0, 0, 3.4],
          [2.0, -0.5, 0.8, 2.5],
          [-1.9, -0.3, -0.9, 2.3],
          [0.6, 1.4, -0.6, 2.2],
          [-0.8, 0.9, 1.6, 2.0],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
            <icosahedronGeometry args={[r, 1]} />
            <meshStandardMaterial color={i % 2 ? '#1f4a2e' : '#265a36'} roughness={1} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  )
}
