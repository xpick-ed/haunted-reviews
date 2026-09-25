import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { brickTexture, plankTexture, roofTexture } from '../textures'
import { lanternAt } from './daylight'

// 三合院：正身在後（z 負），左右護龍朝前（z 正）伸出來，中間是埕。
// 客房在右護龍的前半段，床位見 store.BED。

const WALL_H = 3.2
const WING_H = 3.0

function triangleGeometry(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray()], 3))
  g.computeVertexNormals()
  return g
}

export function House() {
  const brick = useMemo(() => brickTexture(6, 2), [])
  const brickWing = useMemo(() => brickTexture(4, 2), [])
  const roof = useMemo(() => roofTexture(8, 2), [])
  const roofWing = useMemo(() => roofTexture(2, 6), [])
  const plank = useMemo(() => plankTexture(2, 6), [])

  const mats = useMemo(() => {
    const brickMat = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.95 })
    const brickWingMat = new THREE.MeshStandardMaterial({ map: brickWing, roughness: 0.95 })
    const brickFade = new THREE.MeshStandardMaterial({ map: brickWing, roughness: 0.95, transparent: true })
    const roofMat = new THREE.MeshStandardMaterial({ map: roof, roughness: 0.9 })
    const roofWingMat = new THREE.MeshStandardMaterial({ map: roofWing, roughness: 0.9 })
    const roofFade = new THREE.MeshStandardMaterial({ map: roofWing, roughness: 0.9, transparent: true })
    const plankMat = new THREE.MeshStandardMaterial({ map: plank, roughness: 0.8 })
    const ridge = new THREE.MeshStandardMaterial({ color: '#2b2e35', roughness: 0.8 })
    const door = new THREE.MeshStandardMaterial({ color: '#5a1f1a', roughness: 0.7 })
    const couplet = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.8 })
    const gold = new THREE.MeshStandardMaterial({ color: '#e0b04a', roughness: 0.4, metalness: 0.4 })
    const lantern = new THREE.MeshStandardMaterial({ color: '#ff5a48', emissive: '#ff2a1a', emissiveIntensity: 2.2, roughness: 0.6 })
    const glow = new THREE.MeshBasicMaterial({ color: '#ffd08a', transparent: true, opacity: 0.6, toneMapped: false })
    const bush = new THREE.MeshStandardMaterial({ color: '#2f5a35', roughness: 1, flatShading: true })
    const stone = new THREE.MeshStandardMaterial({ color: '#6f6a60', roughness: 1 })
    return { brickMat, brickWingMat, brickFade, roofMat, roofWingMat, roofFade, plankMat, ridge, door, couplet, gold, lantern, glow, bush, stone }
  }, [brick, brickWing, roof, roofWing, plank])

  const windowGlow = useRef<THREE.Mesh>(null)
  const roomWindow = useRef<THREE.Mesh>(null)
  const lanternLights = useRef<THREE.PointLight[]>([])
  const setFocus = useStore((s) => s.setFocus)

  useFrame(() => {
    const s = useStore.getState()
    const l = lanternAt(s.time)
    // 右護龍的屋頂與外牆在聚焦時淡出（DESIGN §15.1）
    const target = s.focusRoom ? 0.12 : 1
    for (const m of [mats.brickFade, mats.roofFade]) {
      m.opacity += (target - m.opacity) * 0.12
      m.depthWrite = m.opacity > 0.5
    }
    for (const pl of lanternLights.current) if (pl) pl.intensity = 5 * l
    mats.lantern.emissiveIntensity = 0.4 + 2.2 * l
    if (windowGlow.current) (windowGlow.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.45 * l
    if (roomWindow.current) {
      const awake = s.guest.state !== 'asleep'
      const m = roomWindow.current.material as THREE.MeshBasicMaterial
      m.opacity = ((awake ? 0.85 : 0.22) * l + s.warm * 0.3) * mats.brickFade.opacity
      roomWindow.current.visible = mats.brickFade.opacity > 0.3
    }
  })

  // 正身屋頂的三角山牆
  const gableMain = useMemo(
    () => [
      triangleGeometry(new THREE.Vector3(0, WALL_H, -8.5), new THREE.Vector3(0, WALL_H, -3.5), new THREE.Vector3(0, WALL_H + 1.4, -6)),
    ],
    [],
  )
  const gableWing = useMemo(
    () => triangleGeometry(new THREE.Vector3(-1.5, WING_H, 0), new THREE.Vector3(1.5, WING_H, 0), new THREE.Vector3(0, WING_H + 0.9, 0)),
    [],
  )

  const mainSlope = Math.atan(1.4 / 3)
  const wingSlope = Math.atan(0.9 / 1.9)

  const Wing = ({ side, fade }: { side: 1 | -1; fade: boolean }) => {
    const cx = side * 8.5
    const wall = fade ? mats.brickFade : mats.brickWingMat
    const roofM = fade ? mats.roofFade : mats.roofWingMat
    return (
      <group
        onClick={(e) => {
          if (!fade) return
          e.stopPropagation()
          setFocus(!useStore.getState().focusRoom)
        }}
      >
        {/* 地板 */}
        <mesh position={[cx, 0.1, 1.25]} receiveShadow material={mats.plankMat}>
          <boxGeometry args={[3, 0.1, 9.5]} />
        </mesh>
        {/* 內牆（朝埕） */}
        <mesh position={[side * 7, WING_H / 2, 1.25]} castShadow receiveShadow material={mats.brickWingMat}>
          <boxGeometry args={[0.3, WING_H, 9.5]} />
        </mesh>
        {/* 外牆 */}
        <mesh position={[side * 10, WING_H / 2, 1.25]} castShadow receiveShadow material={wall}>
          <boxGeometry args={[0.3, WING_H, 9.5]} />
        </mesh>
        {/* 前牆 */}
        <mesh position={[cx, WING_H / 2, 6]} castShadow receiveShadow material={wall}>
          <boxGeometry args={[3.3, WING_H, 0.3]} />
        </mesh>
        {/* 後牆 */}
        <mesh position={[cx, WING_H / 2, -3.5]} castShadow receiveShadow material={mats.brickWingMat}>
          <boxGeometry args={[3.3, WING_H, 0.3]} />
        </mesh>
        {/* 屋頂兩片 */}
        {([-1, 1] as const).map((d) => (
          <mesh
            key={d}
            position={[cx + d * 0.95, WING_H + 0.45, 1.25]}
            rotation={[0, 0, -d * wingSlope]}
            castShadow
            receiveShadow
            material={roofM}
          >
            <boxGeometry args={[2.15, 0.14, 10.3]} />
          </mesh>
        ))}
        <mesh position={[cx, WING_H + 0.95, 1.25]} castShadow material={mats.ridge}>
          <boxGeometry args={[0.36, 0.22, 10.5]} />
        </mesh>
        {/* 山牆 */}
        <mesh position={[cx, 0, 6.16]} geometry={gableWing} material={wall} />
        <mesh position={[cx, 0, -3.66]} geometry={gableWing} material={mats.brickWingMat} />
        {/* 兩扇門，朝埕 */}
        {[3.6, -0.8].map((z) => (
          <mesh key={z} position={[side * 6.84, 1.05, z]} rotation={[0, -side * Math.PI / 2, 0]} material={mats.door}>
            <planeGeometry args={[1.1, 2.1]} />
          </mesh>
        ))}
        {/* 燈籠 */}
        <group position={[side * 6.55, 2.55, 3.6]}>
          <mesh material={mats.lantern} castShadow>
            <sphereGeometry args={[0.24, 12, 10]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} material={mats.ridge}>
            <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
          </mesh>
          <pointLight
            ref={(el) => {
              if (el) lanternLights.current[side === 1 ? 0 : 1] = el
            }}
            color="#ffb45c"
            intensity={5}
            distance={9}
            decay={2}
          />
        </group>
      </group>
    )
  }

  return (
    <group>
      {/* ---------- 正身 ---------- */}
      <group position={[0, 0, -6]}>
        <mesh position={[0, WALL_H / 2, 2.5]} castShadow receiveShadow material={mats.brickMat}>
          <boxGeometry args={[14, WALL_H, 0.3]} />
        </mesh>
        <mesh position={[0, WALL_H / 2, -2.5]} castShadow receiveShadow material={mats.brickMat}>
          <boxGeometry args={[14, WALL_H, 0.3]} />
        </mesh>
        {([-1, 1] as const).map((d) => (
          <mesh key={d} position={[d * 7, WALL_H / 2, 0]} castShadow receiveShadow material={mats.brickMat}>
            <boxGeometry args={[0.3, WALL_H, 5]} />
          </mesh>
        ))}
        <mesh position={[0, 0.1, 0]} receiveShadow material={mats.plankMat}>
          <boxGeometry args={[14, 0.1, 5]} />
        </mesh>
        {([-1, 1] as const).map((d) => (
          <mesh
            key={d}
            position={[0, WALL_H + 0.7, d * 1.5]}
            rotation={[d * mainSlope, 0, 0]}
            castShadow
            receiveShadow
            material={mats.roofMat}
          >
            <boxGeometry args={[15, 0.16, 3.35]} />
          </mesh>
        ))}
        <mesh position={[0, WALL_H + 1.42, 0]} castShadow material={mats.ridge}>
          <boxGeometry args={[15.3, 0.26, 0.4]} />
        </mesh>
        {/* 燕尾脊：兩端翹起 */}
        {([-1, 1] as const).map((d) => (
          <mesh key={d} position={[d * 7.6, WALL_H + 1.7, 0]} rotation={[0, 0, d * 0.6]} material={mats.ridge}>
            <boxGeometry args={[0.9, 0.2, 0.34]} />
          </mesh>
        ))}
        {([-1, 1] as const).map((d) => (
          <mesh key={d} position={[d * 7.16, 0, 6]} geometry={gableMain[0]} material={mats.brickMat} />
        ))}
        {/* 大門、春聯、橫批 */}
        <mesh position={[0, 1.15, 2.66]} material={mats.door}>
          <planeGeometry args={[1.5, 2.3]} />
        </mesh>
        {([-1, 1] as const).map((d) => (
          <mesh key={d} position={[d * 1.1, 1.5, 2.67]} material={mats.couplet}>
            <planeGeometry args={[0.32, 2.0]} />
          </mesh>
        ))}
        <mesh position={[0, 2.55, 2.67]} material={mats.couplet}>
          <planeGeometry args={[2.6, 0.32]} />
        </mesh>
        {/* 神明廳的窗，暖光 */}
        {([-1, 1] as const).map((d) => (
          <mesh key={d} ref={d === 1 ? windowGlow : undefined} position={[d * 3.8, 1.8, 2.66]} material={mats.glow}>
            <planeGeometry args={[1.3, 1.0]} />
          </mesh>
        ))}
        <pointLight position={[0, 2.2, 0.5]} color="#ff4a3a" intensity={1.8} distance={6} decay={2} />
        {/* 門口的一對燈籠 */}
        {([-1, 1] as const).map((d) => (
          <group key={d} position={[d * 2.2, 2.75, 2.9]}>
            <mesh material={mats.lantern} castShadow>
              <sphereGeometry args={[0.24, 12, 10]} />
            </mesh>
            <mesh position={[0, 0.3, 0]} material={mats.ridge}>
              <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
            </mesh>
          </group>
        ))}
        <pointLight
          ref={(el) => {
            if (el) lanternLights.current[2] = el
          }}
          position={[0, 2.6, 3.2]}
          color="#ffb45c"
          intensity={5}
          distance={10}
          decay={2}
        />
      </group>

      {/* ---------- 護龍 ---------- */}
      <Wing side={-1} fade={false} />
      <Wing side={1} fade />

      {/* 客房外牆上的窗（從外面看得到燈亮） */}
      <mesh ref={roomWindow} position={[10.17, 1.7, 3.8]} rotation={[0, Math.PI / 2, 0]} material={mats.glow.clone()}>
        <planeGeometry args={[1.1, 0.9]} />
      </mesh>

      {/* ---------- 圍牆與門柱 ---------- */}
      {([-1, 1] as const).map((d) => (
        <mesh key={d} position={[d * 7.2, 0.55, 7.6]} castShadow receiveShadow material={mats.brickMat}>
          <boxGeometry args={[9.6, 1.1, 0.3]} />
        </mesh>
      ))}
      {([-1, 1] as const).map((d) => (
        <group key={d} position={[d * 2.4, 0, 7.6]}>
          <mesh position={[0, 0.9, 0]} castShadow material={mats.stone}>
            <boxGeometry args={[0.5, 1.8, 0.5]} />
          </mesh>
          <mesh position={[0, 1.85, 0]} material={mats.gold}>
            <sphereGeometry args={[0.18, 10, 8]} />
          </mesh>
        </group>
      ))}

      {/* ---------- 灌木 ---------- */}
      {[
        [-11.5, 0.5, 8.5, 0.9],
        [-12.2, 0.4, 3, 0.7],
        [11.6, 0.5, 8.6, 0.8],
        [4.5, 0.4, 9.2, 0.6],
        [-4.8, 0.45, 9.3, 0.7],
        [-12.5, 0.45, -1.5, 0.8],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow material={mats.bush}>
          <sphereGeometry args={[r, 7, 6]} />
        </mesh>
      ))}
    </group>
  )
}
