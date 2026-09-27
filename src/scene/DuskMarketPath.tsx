import { useMemo } from 'react'
import * as THREE from 'three'
import { VILLAGE } from '../world/sceneVillage'
import { BRUSH_FONT, WBox, canvasTexture, seeded } from './kit'

// 村子南邊往黃昏市場的路（DESIGN §32.1）：水溝上第二座小水泥橋、穿過水田的田埂，
// 橋頭一支竹竿掛著手寫的木板「黃昏市場」。掛在 Village.tsx 裡；出口在 src/world/sceneVillage.ts（黃昏市場 ↓）。

export function VillageMarketPath() {
  const x = VILLAGE.marketBridge.x
  const d = VILLAGE.ditch
  const earth = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6e5a3e', roughness: 1 }), [])
  const grassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4e6a38', roughness: 1, flatShading: true }), [])
  const sign = useMemo(
    () =>
      canvasTexture(
        256,
        112,
        (ctx, w, h) => {
          ctx.fillStyle = '#c9a36a'
          ctx.fillRect(0, 0, w, h)
          // 木紋
          const r = seeded(4411)
          for (let i = 0; i < 14; i++) {
            ctx.fillStyle = `rgba(90,60,30,${0.08 + r() * 0.1})`
            ctx.fillRect(0, r() * h, w, 1 + r() * 2)
          }
          ctx.fillStyle = '#7a1e18'
          ctx.font = `700 50px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('黃昏市場', w / 2, h * 0.4)
          ctx.font = `500 26px ${BRUSH_FONT}`
          ctx.fillStyle = '#3a2412'
          ctx.fillText('↓ 過橋就到', w / 2, h * 0.8)
        },
        [{ spec: `700 50px ${BRUSH_FONT}`, text: '黃昏市場過橋就到' }],
      ),
    [],
  )
  // 田埂兩邊的草
  const tufts = useMemo(() => {
    const r = seeded(3131)
    return Array.from({ length: 20 }, (_, i) => ({ side: i % 2 ? 1 : -1, z: d.z1 + 0.6 + r() * 22, s: 0.12 + r() * 0.12 }))
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
      {/* 田埂 */}
      <mesh position={[x, 0.12, d.z1 + 12]} material={earth} receiveShadow>
        <boxGeometry args={[1.25, 0.2, 24]} />
      </mesh>
      {tufts.map((t, i) => (
        <mesh key={i} position={[x + t.side * 0.66, 0.2 + t.s * 0.4, t.z]} scale={[t.s * 1.3, t.s, t.s]} material={grassMat}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      {/* 橋頭的竹竿＋手寫木板（面向鏡頭） */}
      <group position={[x - 1.35, 0, d.z0 + 0.1]}>
        <WBox mat="bamboo" size={[0.07, 1.9, 0.07]} position={[0, 0.95, 0]} />
        <mesh position={[0.02, 1.55, 0.05]} rotation={[0, 0.7, 0]}>
          <planeGeometry args={[0.9, 0.4]} />
          <meshStandardMaterial map={sign} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}
