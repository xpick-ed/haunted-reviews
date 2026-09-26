import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { ghostNightNow } from '../world/night/special'
import { FENCE } from './layout'
import { canvasTexture } from './kit'
import { lanternAt } from './daylight'

// 中元鬼客人夜的畫面（DESIGN §31.3）：大門口掛「慶讚中元」的燈籠、普渡的小供桌（還有給好兄弟洗臉的臉盆和毛巾）、
// 晚上埕裡飄著幾團藍色的鬼火、秋月唱戲時頭上的音符（有觀眾就唱小聲、音符變小變粉紅）。
// 好兄弟本身是模擬裡的客人，由 Guests.tsx 畫（specs.special.ts 的長相）。

const FONT = '"Noto Serif TC", "Noto Sans TC", serif'

export function GhostLayer({ night }: { night: boolean }) {
  return (
    <group userData={{ noMerge: true }}>
      <GateLanterns />
      <OfferingTable />
      {night && (
        <>
          <Wisps />
          <OperaNotes />
        </>
      )}
    </group>
  )
}

function lanternTexture() {
  return canvasTexture(
    128,
    256,
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0)
      g.addColorStop(0, '#d8d2c0')
      g.addColorStop(0.5, '#fbf6e8')
      g.addColorStop(1, '#d8d2c0')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#b8322a'
      ctx.fillRect(0, 0, w, 16)
      ctx.fillRect(0, h - 16, w, 16)
      ctx.fillStyle = '#2a1a14'
      ctx.font = `700 46px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ;['慶', '讚', '中', '元'].forEach((ch, i) => ctx.fillText(ch, w / 2, 48 + i * 52))
    },
    [{ spec: `700 46px ${FONT}`, text: '慶讚中元' }],
  )
}

/** 大門兩邊的竹竿上掛白燈籠，晚上亮 */
function GateLanterns() {
  const tex = useMemo(() => lanternTexture(), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffe2a8', emissiveMap: tex, emissiveIntensity: 0.2, roughness: 0.7 }), [tex])
  const pole = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a7a4a', roughness: 0.8 }), [])
  const lanterns = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    mat.emissiveIntensity = 0.15 + l * 1.3
    const g = lanterns.current
    if (g) g.children.forEach((c, i) => (c.rotation.z = Math.sin(clock.elapsedTime * 1.3 + i * 2) * 0.05))
  })
  const xs = [-FENCE.gateHalf - 0.35, FENCE.gateHalf + 0.35]
  return (
    <group>
      {xs.map((x) => (
        <mesh key={x} material={pole} position={[x, 1.35, FENCE.z + 0.25]}>
          <cylinderGeometry args={[0.035, 0.04, 2.7, 6]} />
        </mesh>
      ))}
      <group ref={lanterns}>
        {xs.map((x) => (
          <group key={x} position={[x, 2.55, FENCE.z + 0.25]}>
            <mesh material={mat} position={[0, -0.42, 0]} scale={[1, 1.35, 1]}>
              <sphereGeometry args={[0.24, 16, 12]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/** 大門內的普渡小供桌：水果、三炷香、給好兄弟洗臉的臉盆和毛巾（傳統的習俗） */
function OfferingTable() {
  const mats = useMemo(
    () => ({
      table: new THREE.MeshStandardMaterial({ color: '#8a3a2a', roughness: 0.7 }),
      cloth: new THREE.MeshStandardMaterial({ color: '#c8322a', roughness: 0.8 }),
      fruit: ['#e8a22a', '#d8452a', '#d8c84a', '#8ac04a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })),
      basin: new THREE.MeshStandardMaterial({ color: '#d8dce0', roughness: 0.3, metalness: 0.4, side: THREE.DoubleSide }),
      water: new THREE.MeshStandardMaterial({ color: '#8fa8bc', transparent: true, opacity: 0.7, roughness: 0.1 }),
      towel: new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.9 }),
      stick: new THREE.MeshStandardMaterial({ color: '#c8402a', roughness: 0.8 }),
      ember: new THREE.MeshBasicMaterial({ color: '#ff8a3a', toneMapped: false }),
    }),
    [],
  )
  const X = 2.3
  const Z = FENCE.z - 1.3
  const top = 0.78
  return (
    <group position={[X, 0.1, Z]}>
      <mesh material={mats.table} position={[0, top - 0.03, 0]} castShadow>
        <boxGeometry args={[1.2, 0.06, 0.6]} />
      </mesh>
      {[
        [-0.55, -0.25],
        [0.55, -0.25],
        [-0.55, 0.25],
        [0.55, 0.25],
      ].map(([x, z], i) => (
        <mesh key={i} material={mats.table} position={[x, (top - 0.06) / 2, z]}>
          <boxGeometry args={[0.05, top - 0.06, 0.05]} />
        </mesh>
      ))}
      <mesh material={mats.cloth} position={[0, top - 0.2, 0.301]}>
        <planeGeometry args={[1.2, 0.34]} />
      </mesh>
      {/* 水果 */}
      {[-0.35, -0.2, -0.28].map((x, i) => (
        <mesh key={i} material={mats.fruit[i]} position={[x, top + 0.07 + (i === 2 ? 0.1 : 0), -0.05 + i * 0.04]}>
          <sphereGeometry args={[0.07, 10, 8]} />
        </mesh>
      ))}
      {/* 香爐＋三炷香 */}
      <mesh material={mats.basin} position={[0.05, top + 0.05, -0.05]}>
        <cylinderGeometry args={[0.07, 0.06, 0.1, 10]} />
      </mesh>
      {[-0.03, 0, 0.03].map((x) => (
        <group key={x} position={[0.05 + x, top + 0.24, -0.05]} rotation={[0, 0, x * 2]}>
          <mesh material={mats.stick}>
            <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
          </mesh>
          <mesh material={mats.ember} position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.009, 5, 4]} />
          </mesh>
        </group>
      ))}
      {/* 臉盆＋毛巾 */}
      <group position={[0.38, top, 0.02]}>
        <mesh material={mats.basin} position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.17, 0.12, 0.1, 16, 1, true]} />
        </mesh>
        <mesh material={mats.water} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.16, 16]} />
        </mesh>
        <mesh material={mats.towel} position={[0.17, 0.02, 0]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.04, 0.22, 0.14]} />
        </mesh>
      </group>
    </group>
  )
}

/** 埕裡飄的鬼火（藍色、慢慢晃） */
function Wisps() {
  const group = useRef<THREE.Group>(null)
  const tex = useMemo(
    () =>
      canvasTexture(64, 64, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
        g.addColorStop(0, 'rgba(220,240,255,1)')
        g.addColorStop(0.35, 'rgba(120,180,255,0.7)')
        g.addColorStop(1, 'rgba(60,120,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }),
    [],
  )
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), [tex])
  const wisps = useMemo(
    () =>
      [
        [-4.5, 3.5],
        [4.8, 5.8],
        [-2.2, 6.4],
        [3.2, 2.6],
        [-5.8, 0.9],
        [0.8, 4.4],
      ].map(([x, z], i) => ({ x, z, i })),
    [],
  )
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime
    g.children.forEach((c, i) => {
      const w = wisps[i]
      c.position.set(w.x + Math.sin(t * 0.4 + i) * 0.6, 1.1 + Math.sin(t * 0.9 + i * 1.7) * 0.25, w.z + Math.cos(t * 0.33 + i * 2) * 0.5)
      const s = 0.32 + Math.sin(t * 3 + i) * 0.05
      c.scale.set(s, s * 1.3, 1)
    })
  })
  return (
    <group ref={group}>
      {wisps.map((w) => (
        <sprite key={w.i} material={mat} />
      ))}
    </group>
  )
}

/** 秋月唱戲時頭上的音符：沒人聽很大聲（大音符），有觀眾就小小聲（粉紅小音符） */
function OperaNotes() {
  const group = useRef<THREE.Group>(null)
  const tex = useMemo(
    () =>
      canvasTexture(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#fff'
        ctx.font = `700 52px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('♪', w / 2, h / 2 + 4)
      }),
    [],
  )
  const mats = useMemo(() => [0, 1, 2].map(() => new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, color: '#fff2c8' })), [tex])
  useFrame(() => {
    const g = group.current
    const gn = ghostNightNow()
    const singer = gn?.singer
    if (!g) return
    g.visible = !!singer
    if (!gn || !singer) return
    const since = gn.t - gn.lastSing
    g.children.forEach((c, i) => {
      mats[i].color.set(gn.audience ? '#ffb8d0' : '#fff2c8')
      const ph = (since / 4.5 + i / 3) % 1
      c.position.set(singer.x + Math.sin(ph * 6 + i) * 0.3, 1.9 + ph * 1.1, singer.z)
      const s = (gn.audience ? 0.18 : 0.34) * (1 - ph * 0.4)
      c.scale.set(s, s, 1)
      mats[i].opacity = 1 - ph
    })
  })
  return (
    <group ref={group} visible={false}>
      {mats.map((m, i) => (
        <sprite key={i} material={m} />
      ))}
    </group>
  )
}
