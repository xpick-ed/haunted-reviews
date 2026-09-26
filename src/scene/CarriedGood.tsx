import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { player } from '../world/player'
import type { GoodId } from '../world/night/items'

// 阿嬤端著的店裡好東西（DESIGN §31.1）：跟宵夜一樣捧在胸前，客人看得到飄在空中的東西。
// 掛在阿嬤的 group 裡（Characters.tsx），自己跟著「想走的方向」轉。

const GOODS: GoodId[] = ['herbtea', 'ramune', 'quilt', 'photo', 'floral', 'banquet']

export function CarriedGood() {
  const root = useRef<THREE.Group>(null)
  const parts = useRef<Partial<Record<GoodId, THREE.Group | null>>>({})
  const heading = useRef(0.7)
  useFrame(() => {
    const good = useStore.getState().good
    if (!root.current) return
    root.current.visible = !!good
    if (!good) return
    if (player.wantX || player.wantZ) heading.current = Math.atan2(player.wantX, player.wantZ)
    root.current.rotation.y = heading.current
    for (const g of GOODS) {
      const p = parts.current[g]
      if (p) p.visible = g === good
    }
  })
  const set = (g: GoodId) => (o: THREE.Group | null) => {
    parts.current[g] = o
  }
  return (
    <group ref={root} visible={false}>
      <group position={[0, 0.78, 0.42]}>
        {/* 安神茶：一杯冒煙的茶 */}
        <group ref={set('herbtea')}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.065, 0.12, 16]} />
            <meshStandardMaterial color="#f1ead8" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.055, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.01, 16]} />
            <meshStandardMaterial color="#9a6a2c" roughness={0.4} />
          </mesh>
          {[0, 1].map((i) => (
            <mesh key={i} position={[i * 0.03 - 0.015, 0.14 + i * 0.07, 0]}>
              <sphereGeometry args={[0.03, 8, 6]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
            </mesh>
          ))}
        </group>
        {/* 彈珠汽水：淡藍的玻璃瓶，瓶頸卡一顆彈珠 */}
        <group ref={set('ramune')}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.045, 0.05, 0.2, 14]} />
            <meshStandardMaterial color="#9fd8e8" roughness={0.1} transparent opacity={0.75} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.025, 0.04, 0.07, 12]} />
            <meshStandardMaterial color="#9fd8e8" roughness={0.1} transparent opacity={0.75} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshStandardMaterial color="#e8f6ff" roughness={0.05} metalness={0.2} />
          </mesh>
        </group>
        {/* 厚棉被：摺好的一疊，紅底小花 */}
        <group ref={set('quilt')}>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.46, 0.16, 0.3]} />
            <meshStandardMaterial color="#c8454a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.115, 0]}>
            <boxGeometry args={[0.44, 0.01, 0.28]} />
            <meshStandardMaterial color="#f2c8a0" roughness={0.9} />
          </mesh>
        </group>
        {/* 老照片：木框 */}
        <group ref={set('photo')}>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.22, 0.28, 0.025]} />
            <meshStandardMaterial color="#6b4527" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.08, 0.014]}>
            <planeGeometry args={[0.17, 0.22]} />
            <meshStandardMaterial color="#d9cdb2" roughness={0.9} />
          </mesh>
        </group>
        {/* 花露水：綠色的細瓶子 */}
        <group ref={set('floral')}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.04, 0.045, 0.2, 12]} />
            <meshStandardMaterial color="#5fae7a" roughness={0.15} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.05, 10]} />
            <meshStandardMaterial color="#e9c46a" roughness={0.4} metalness={0.4} />
          </mesh>
        </group>
        {/* 辦桌菜尾：一大碗 */}
        <group ref={set('banquet')}>
          <mesh>
            <cylinderGeometry args={[0.19, 0.12, 0.11, 18]} />
            <meshStandardMaterial color="#f4efe4" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 0.02, 18]} />
            <meshStandardMaterial color="#c9692c" roughness={0.6} emissive="#5a2a10" emissiveIntensity={0.25} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
