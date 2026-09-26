import { useMemo } from 'react'
import * as THREE from 'three'
import { ROAD } from './layout'
import { BRUSH_FONT, canvasTexture } from './kit'
import { CaneClumps, mergeGeos } from './StationProps'

// 家門前的路往西通到小火車站（DESIGN §27.1）：路的西頭（出口在 x ≈ -23）。
// 路北邊擺一支「停看聽」平交道號誌、一顆寫著站名的里程石、一捆收成的甘蔗，再過去開始是甘蔗田。
// 都放在路的北邊（鏡頭對面），不會擋住走在路上的阿嬤。

const Z = ROAD.z - ROAD.width / 2 - 0.55

function crossTexture() {
  return canvasTexture(
    256,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#f6f2e8'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#c62c24'
      ctx.lineWidth = 10
      ctx.strokeRect(6, 6, w - 12, h - 12)
      ctx.fillStyle = '#1c1c1c'
      ctx.font = `700 50px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('停 看 聽', w / 2, h / 2 + 2)
    },
    [{ spec: `700 50px ${BRUSH_FONT}`, text: '停看聽' }],
  )
}

function stoneTexture() {
  return canvasTexture(
    128,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#d9d4c6'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#b3261e'
      ctx.font = `700 40px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ;[...'後壁厝站'].forEach((ch, i) => ctx.fillText(ch, w / 2, 40 + i * 44))
      ctx.fillStyle = '#3a3a3a'
      ctx.font = `600 26px "Noto Sans TC", sans-serif`
      ctx.fillText('0.3 K', w / 2, h - 28)
    },
    [{ spec: `700 40px ${BRUSH_FONT}`, text: '後壁厝站' }],
  )
}

export function HomeStationPath() {
  const cross = useMemo(crossTexture, [])
  const stone = useMemo(stoneTexture, [])
  const mats = useMemo(
    () => ({
      pole: new THREE.MeshStandardMaterial({ color: '#f2eee4', roughness: 0.6 }),
      stripe: new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.6 }),
      board: new THREE.MeshStandardMaterial({ color: '#f6f2e8', roughness: 0.6 }),
      red: new THREE.MeshStandardMaterial({ color: '#c62c24', roughness: 0.6 }),
      concrete: new THREE.MeshStandardMaterial({ color: '#c9c3b4', roughness: 0.9 }),
      cane: new THREE.MeshStandardMaterial({ color: '#8a7a4a', roughness: 0.9 }),
      rope: new THREE.MeshStandardMaterial({ color: '#c8a868', roughness: 0.9 }),
    }),
    [],
  )
  const bundle = useMemo(() => {
    const g: THREE.BufferGeometry[] = []
    for (let i = 0; i < 26; i++) {
      const c = new THREE.CylinderGeometry(0.035, 0.035, 2.0, 5)
      c.rotateZ(Math.PI / 2 + (i % 5) * 0.012)
      c.translate(((i * 7) % 5) * 0.03, 0.05 + Math.floor(i / 7) * 0.07, (i % 7) * 0.07 - 0.21)
      g.push(c)
    }
    return mergeGeos(g)
  }, [])
  const clumps = useMemo<[number, number, number][]>(() => {
    const out: [number, number, number][] = []
    for (let x = -34; x < -22.6; x += 1.15) for (let z = 3.5; z < Z - 0.6; z += 1.2) out.push([x + ((x * 7.1 + z * 3.3) % 0.5), z + ((x * 2.3) % 0.4), 0.85 + ((x * z) % 0.3)])
    return out
  }, [])
  return (
    <group userData={{ noMerge: true }}>
      {/* 平交道號誌：黑白條紋的柱子、交叉的白板、「停看聽」 */}
      <group position={[-22.4, 0, Z - 0.3]} rotation={[0, 0.25, 0]}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} material={i % 2 ? mats.stripe : mats.pole} position={[0, 0.2 + i * 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.055, 0.4, 10]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <group key={s} position={[0, 2.55, 0.08]} rotation={[0, 0, s * 0.62]}>
            <mesh material={mats.red}>
              <boxGeometry args={[1.3, 0.2, 0.03]} />
            </mesh>
            <mesh material={mats.board} position={[0, 0, 0.018]}>
              <boxGeometry args={[1.2, 0.12, 0.01]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.75, 0.07]}>
          <planeGeometry args={[0.7, 0.35]} />
          <meshStandardMaterial map={cross} roughness={0.7} />
        </mesh>
      </group>
      {/* 里程石 */}
      <group position={[-20.2, 0, Z - 0.1]} rotation={[0, 0.35, 0]}>
        <mesh material={mats.concrete} position={[0, 0.34, 0]} castShadow>
          <boxGeometry args={[0.26, 0.68, 0.18]} />
        </mesh>
        <mesh position={[0, 0.36, 0.092]}>
          <planeGeometry args={[0.22, 0.6]} />
          <meshStandardMaterial map={stone} roughness={0.9} />
        </mesh>
      </group>
      {/* 一捆收成的甘蔗 */}
      <group position={[-18.6, 0, Z - 0.5]} rotation={[0, 0.2, 0]}>
        <mesh geometry={bundle} material={mats.cane} castShadow />
        {[-0.6, 0.6].map((x) => (
          <mesh key={x} material={mats.rope} position={[x, 0.19, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.28, 0.02, 6, 16]} />
          </mesh>
        ))}
      </group>
      <CaneClumps spots={clumps} />
    </group>
  )
}
