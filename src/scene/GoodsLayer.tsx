import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { FLOOR_Y, GUEST_ROOMS } from './layout'
import type { GoodId } from '../world/night/items'

// 放在客房裡的店裡好東西（DESIGN §31.1）：床頭的安神茶、彈珠汽水、老照片、花露水，床上的厚棉被。
// 看 objects 的 `<房間>.good.<id>`（director 放下去的時候打開）。辦桌菜尾用原本的宵夜碗（`<房間>.dish`）。
// 掛在家的場景裡（Scene.tsx）。

const TOP = 0.55
const quiltMat = new THREE.MeshStandardMaterial({ color: '#c8454a', roughness: 0.95 })
const quiltEdge = new THREE.MeshStandardMaterial({ color: '#f2c8a0', roughness: 0.9 })

export function GoodsLayer() {
  return (
    <group>
      {(['r1', 'r2'] as const).map((r) => (
        <RoomGoods key={r} room={r} />
      ))}
    </group>
  )
}

function RoomGoods({ room }: { room: 'r1' | 'r2' }) {
  const R = GUEST_ROOMS[room]
  const refs = useRef<Partial<Record<GoodId, THREE.Group | null>>>({})
  useFrame(() => {
    const objs = useStore.getState().objects
    for (const [k, g] of Object.entries(refs.current)) if (g) g.visible = !!objs[`${room}.good.${k}`]?.on
  })
  const set = (g: GoodId) => (o: THREE.Group | null) => {
    refs.current[g] = o
  }
  const bedTop = R.bed.topY
  return (
    <group userData={{ noMerge: true }}>
      {/* 床頭櫃上 */}
      <group position={[R.nightstand[0], FLOOR_Y + TOP, R.nightstand[1]]}>
        <group ref={set('herbtea')} position={[0.02, 0, 0.0]} visible={false}>
          <mesh position={[0, 0.035, 0]}>
            <cylinderGeometry args={[0.035, 0.03, 0.07, 14]} />
            <meshStandardMaterial color="#f1ead8" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.066, 0]}>
            <cylinderGeometry args={[0.031, 0.031, 0.004, 14]} />
            <meshStandardMaterial color="#9a6a2c" roughness={0.4} />
          </mesh>
        </group>
        <group ref={set('ramune')} position={[0.13, 0, 0.1]} visible={false}>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.028, 0.03, 0.14, 12]} />
            <meshStandardMaterial color="#9fd8e8" roughness={0.1} transparent opacity={0.75} />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <sphereGeometry args={[0.015, 8, 6]} />
            <meshStandardMaterial color="#e8f6ff" roughness={0.05} />
          </mesh>
        </group>
        <group ref={set('photo')} position={[0.0, 0, -0.16]} rotation={[-0.2, 0, 0]} visible={false}>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.16, 0.2, 0.02]} />
            <meshStandardMaterial color="#6b4527" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.1, 0.011]}>
            <planeGeometry args={[0.12, 0.155]} />
            <meshStandardMaterial color="#d9cdb2" roughness={0.9} />
          </mesh>
        </group>
        <group ref={set('floral')} position={[0.15, 0, -0.02]} visible={false}>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.022, 0.025, 0.12, 10]} />
            <meshStandardMaterial color="#5fae7a" roughness={0.15} transparent opacity={0.85} />
          </mesh>
        </group>
      </group>
      {/* 床上鋪的厚棉被 */}
      <group ref={set('quilt')} position={[R.bed.x, bedTop + 0.06, R.bed.z + 0.25]} visible={false}>
        <mesh material={quiltMat} castShadow>
          <boxGeometry args={[R.bed.w * 0.96, 0.09, R.bed.l * 0.62]} />
        </mesh>
        <mesh material={quiltEdge} position={[0, 0.047, -R.bed.l * 0.31 + 0.05]}>
          <boxGeometry args={[R.bed.w * 0.96, 0.01, 0.1]} />
        </mesh>
      </group>
    </group>
  )
}
