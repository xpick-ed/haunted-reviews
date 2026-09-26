import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'
import { ChibiNpc } from '../chars/Chibi'
import { HOME } from '../world/scenes'
import { CHENDONG_SPOT, chendongBeat } from '../world/storyBeats'
import '../chars/specs.story'

// 主線的畫面（DESIGN §28.3）：第 6 晚傍晚，建商陳董在大門外找小翰，黑頭車停在路邊。掛在家裡的場景。

export function StoryScene() {
  const on = useStore((s) => chendongBeat(s))
  const quality = useStore((s) => s.quality)
  if (!on) return null
  const C = CHENDONG_SPOT
  const heading = Math.atan2(C.han.x - C.chendong.x, C.han.z - C.chendong.z)
  return (
    <group userData={{ noMerge: true }}>
      <ChibiNpc id="chendong" position={[C.chendong.x, HOME.floorAt(C.chendong.x, C.chendong.z), C.chendong.z]} heading={heading} outline={quality === 'high'} />
      <ChibiNpc id="xiaohan" pose="clasp" position={[C.han.x, HOME.floorAt(C.han.x, C.han.z), C.han.z]} heading={heading + Math.PI} outline={quality === 'high'} />
      <BlackCar x={C.car.x} z={C.car.z} />
    </group>
  )
}

/** 陳董的黑頭車：亮晶晶的黑色轎車，車頭燈開著 */
function BlackCar({ x, z }: { x: number; z: number }) {
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0d0e12', roughness: 0.22, metalness: 0.6 }), [])
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c2a36', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 }), [])
  const tyre = useMemo(() => new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 }), [])
  const chrome = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8d8d8', roughness: 0.2, metalness: 0.9 }), [])
  const lamp = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.6), toneMapped: false }), [])
  const y = HOME.floorAt(x, z)
  return (
    <group position={[x, y, z]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh material={paint} position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.7, 0.5, 4.2]} />
      </mesh>
      <mesh material={paint} position={[0, 0.9, -0.2]} castShadow>
        <boxGeometry args={[1.5, 0.45, 2.1]} />
      </mesh>
      <mesh material={glass} position={[0, 0.92, -0.2]}>
        <boxGeometry args={[1.52, 0.36, 1.9]} />
      </mesh>
      <mesh material={chrome} position={[0, 0.34, 2.11]}>
        <boxGeometry args={[1.3, 0.14, 0.04]} />
      </mesh>
      {[-0.6, 0.6].map((dx) => (
        <mesh key={dx} material={lamp} position={[dx, 0.5, 2.11]}>
          <boxGeometry args={[0.3, 0.1, 0.02]} />
        </mesh>
      ))}
      {[
        [-0.82, 1.35],
        [0.82, 1.35],
        [-0.82, -1.35],
        [0.82, -1.35],
      ].map(([dx, dz], i) => (
        <mesh key={i} material={tyre} position={[dx, 0.3, dz]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.22, 16]} />
        </mesh>
      ))}
      <pointLight position={[0, 0.6, 2.6]} color="#fff1c8" intensity={2.2} distance={7} decay={2} />
    </group>
  )
}
