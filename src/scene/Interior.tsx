import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { BRUSH_FONT, WBox, canvasTexture, seeded, useMats } from './kit'
import { BED, FLOOR_Y, MAIN, PILLOW_Z, WING_R } from './layout'
import { Lantern } from './House'

// 室內：客房的家具、右護龍後間的雜物、正身神明廳。

export function Interior() {
  return (
    <group>
      <GuestRoom />
      <Storeroom />
      <AltarHall />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 客房
// ---------------------------------------------------------------------------

const clothWhite = new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.95 })
const pillowMat = new THREE.MeshStandardMaterial({ color: '#f6e7d2', roughness: 0.95 })
const pinkPlastic = new THREE.MeshStandardMaterial({ color: '#f29bb5', roughness: 0.35 })
const fanPlastic = new THREE.MeshStandardMaterial({ color: '#7cc1c7', roughness: 0.35, transparent: true, opacity: 0.85 })
const fanBody = new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.4 })
const enamelOut = new THREE.MeshStandardMaterial({ color: '#3f7a5a', roughness: 0.3, side: THREE.DoubleSide })
const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false })
const tvScreen = new THREE.MeshStandardMaterial({ color: '#10161c', roughness: 0.1, metalness: 0.2, emissive: '#3a6a8a', emissiveIntensity: 0 })
const slipperMat = new THREE.MeshStandardMaterial({ color: '#4d7fbf', roughness: 0.6 })

function calendarTexture() {
  return canvasTexture(
    256,
    352,
    (ctx, w, h) => {
      ctx.fillStyle = '#fbf6ec'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#c7342b'
      ctx.fillRect(0, 0, w, 58)
      ctx.fillStyle = '#fff'
      ctx.font = `700 34px "Noto Sans TC", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('2026  三月', w / 2, 42)
      ctx.fillStyle = '#c7342b'
      ctx.font = `900 150px "Noto Serif TC", serif`
      ctx.fillText('25', w / 2, 212)
      ctx.fillStyle = '#333'
      ctx.font = `500 26px "Noto Sans TC", sans-serif`
      ctx.fillText('星期三', w / 2, 258)
      ctx.fillStyle = '#8a6a3a'
      ctx.font = `500 24px ${BRUSH_FONT}`
      ctx.fillText('農曆二月初七', w / 2, 298)
      ctx.fillStyle = '#b33'
      ctx.font = `500 20px "Noto Sans TC", sans-serif`
      ctx.fillText('宜：入宅 會友　忌：驚擾', w / 2, 332)
    },
    [
      { spec: `900 150px "Noto Serif TC"`, text: '25' },
      { spec: `700 34px "Noto Sans TC"`, text: '2026三月星期宜入宅會友忌驚擾' },
      { spec: `500 24px ${BRUSH_FONT}`, text: '農曆二月初七' },
    ],
  )
}

function rugTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const rnd = seeded(5)
    const cols = ['#b5523a', '#d9a55a', '#6b8f5a', '#e8dcc4', '#8a3a3a']
    for (let r = w / 2; r > 0; r -= 9) {
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)]
      ctx.fill()
    }
  })
}

function GuestRoom() {
  const mats = useMats()
  const cal = useMemo(calendarTexture, [])
  const rug = useMemo(rugTexture, [])
  const bulb = useRef<THREE.Mesh>(null)
  const head = BED.z - BED.l / 2
  const foot = BED.z + BED.l / 2
  const frameH = 0.38
  const lampX = BED.x - 0.3
  const lampZ = BED.z - 0.2
  const lampY = FLOOR_Y + 2.35

  useFrame(() => {
    const s = useStore.getState()
    const awake = s.guest.state !== 'asleep'
    let k = awake ? 1 : 0.18
    k += s.warm * 0.8
    if (s.flicker > 0 && Math.random() < s.flicker * 0.8) k *= 0.1
    bulbMat.color.setRGB(1.0 * k * 2.2, 0.85 * k * 2.2, 0.62 * k * 2.2)
    tvScreen.emissiveIntensity = awake ? 0.35 : 0
  })

  return (
    <group>
      {/* 床架：床頭板、床尾板、側板、床腳 */}
      <WBox mat="wood" size={[BED.w + 0.14, 0.16, BED.l + 0.1]} position={[BED.x, FLOOR_Y + frameH - 0.08, BED.z]} />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <WBox key={i} mat="darkWood" size={[0.1, frameH, 0.1]} position={[BED.x + sx * (BED.w / 2 + 0.02), FLOOR_Y + frameH / 2, BED.z + sz * (BED.l / 2 + 0.02)]} />
      ))}
      <WBox mat="wood" size={[BED.w + 0.2, 1.05, 0.09]} position={[BED.x, FLOOR_Y + 0.52, head - 0.06]} />
      <WBox mat="darkWood" size={[BED.w + 0.28, 0.08, 0.14]} position={[BED.x, FLOOR_Y + 1.08, head - 0.06]} />
      {[-0.4, 0.4].map((x) => (
        <WBox key={x} mat="darkWood" size={[0.56, 0.42, 0.02]} position={[BED.x + x, FLOOR_Y + 0.72, head - 0.005]} castShadow={false} />
      ))}
      <WBox mat="wood" size={[BED.w + 0.2, 0.6, 0.09]} position={[BED.x, FLOOR_Y + 0.3, foot + 0.06]} />
      {/* 床墊、枕頭 */}
      <RoundedBox args={[BED.w, 0.2, BED.l]} radius={0.06} smoothness={3} position={[BED.x, BED.topY - 0.1, BED.z]} material={clothWhite} castShadow receiveShadow />
      <RoundedBox args={[0.9, 0.15, 0.45]} radius={0.07} smoothness={3} position={[BED.x, BED.topY + 0.07, PILLOW_Z]} material={pillowMat} castShadow receiveShadow />

      {/* 床頭櫃、熱水瓶、鬧鐘 */}
      <group position={[WING_R.x1 - 0.42, FLOOR_Y, head + 0.28]}>
        <WBox mat="wood" size={[0.44, 0.55, 0.44]} position={[0, 0.275, 0]} />
        <WBox mat="darkWood" size={[0.36, 0.03, 0.02]} position={[0, 0.4, -0.225]} castShadow={false} />
        <mesh position={[-0.06, 0.55 + 0.17, 0.05]} material={mats.redPaint} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.34, 18]} />
        </mesh>
        <mesh position={[-0.06, 0.55 + 0.36, 0.05]} material={mats.gold}>
          <cylinderGeometry args={[0.045, 0.06, 0.06, 14]} />
        </mesh>
        <mesh position={[0.1, 0.55 + 0.06, -0.05]} rotation={[0, 0.5, 0]} material={mats.trim} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.05, 18]} />
        </mesh>
      </group>

      {/* 吊燈：電線、琺瑯燈罩、燈泡 */}
      <mesh position={[lampX, lampY + 0.45, lampZ]} material={mats.black}>
        <cylinderGeometry args={[0.008, 0.008, 0.8, 4]} />
      </mesh>
      <mesh position={[lampX, lampY + 0.08, lampZ]} material={enamelOut}>
        <coneGeometry args={[0.26, 0.16, 24, 1, true]} />
      </mesh>
      <mesh ref={bulb} position={[lampX, lampY - 0.02, lampZ]} material={bulbMat}>
        <sphereGeometry args={[0.07, 16, 12]} />
      </mesh>

      <Fan position={[WING_R.x0 + 0.5, FLOOR_Y, foot + 0.3]} />

      {/* 衣櫃 */}
      <group position={[WING_R.x1 - 0.48, FLOOR_Y, WING_R.split + 0.62]}>
        <WBox mat="wood" size={[0.6, 1.95, 1.0]} position={[0, 0.975, 0]} />
        <WBox mat="darkWood" size={[0.66, 0.08, 1.06]} position={[0, 1.99, 0]} />
        <WBox mat="darkWood" size={[0.02, 1.7, 0.02]} position={[-0.31, 1.0, 0]} castShadow={false} />
        {[-0.08, 0.08].map((z) => (
          <mesh key={z} position={[-0.32, 1.0, z]} material={mats.gold}>
            <sphereGeometry args={[0.025, 10, 8]} />
          </mesh>
        ))}
      </group>

      {/* 矮櫃上的老電視 */}
      <group position={[WING_R.x1 - 0.42, FLOOR_Y, foot + 0.38]}>
        <WBox mat="wood" size={[0.5, 0.6, 0.85]} position={[0, 0.3, 0]} />
        <WBox mat="wood" size={[0.46, 0.44, 0.56]} position={[-0.01, 0.82, 0]} />
        <mesh position={[-0.245, 0.83, -0.03]} rotation={[0, -Math.PI / 2, 0]} material={tvScreen}>
          <planeGeometry args={[0.44, 0.32]} />
        </mesh>
        <mesh position={[0, 1.08, 0.05]} rotation={[0, 0, 0.5]} material={mats.metal}>
          <cylinderGeometry args={[0.006, 0.006, 0.4, 4]} />
        </mesh>
      </group>

      {/* 行李箱、拖鞋、地毯、月曆 */}
      <RoundedBox args={[0.24, 0.62, 0.44]} radius={0.05} smoothness={3} position={[WING_R.x0 + 0.38, FLOOR_Y + 0.31, head + 0.45]} rotation={[0, 0.25, 0]} material={pinkPlastic} castShadow />
      {[-0.07, 0.07].map((dz, i) => (
        <RoundedBox
          key={i}
          args={[0.1, 0.03, 0.24]}
          radius={0.012}
          smoothness={2}
          position={[BED.x - BED.w / 2 - 0.2, FLOOR_Y + 0.015, BED.z + 0.3 + dz * 1.8]}
          rotation={[0, 0.2 * (i ? 1 : -1), 0]}
          material={slipperMat}
        />
      ))}
      <mesh position={[BED.x + 0.1, FLOOR_Y + 0.005, foot + 0.42]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.36, 40]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <mesh position={[BED.x - 0.5, FLOOR_Y + 1.75, WING_R.split + 0.085]}>
        <planeGeometry args={[0.3, 0.41]} />
        <meshStandardMaterial map={cal} roughness={0.9} />
      </mesh>
    </group>
  )
}

/** 大同電扇：扇葉會轉、頭會擺 */
function Fan({ position }: { position: [number, number, number] }) {
  const mats = useMats()
  const head = useRef<THREE.Group>(null)
  const blades = useRef<THREE.Group>(null)
  const cage = useMemo(() => {
    const g: THREE.BufferGeometry[] = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      g.push(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 3).rotateZ(Math.PI / 2).rotateX(a).translate(0, 0, 0))
    }
    return g
  }, [])
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z -= dt * 18
    if (head.current) head.current.rotation.y = -Math.PI / 2 + 0.8 + Math.sin(performance.now() / 2600) * 0.7
  })
  return (
    <group position={position} userData={{ noMerge: true }}>
      <mesh position={[0, 0.03, 0]} material={fanBody} castShadow>
        <cylinderGeometry args={[0.17, 0.2, 0.06, 24]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} material={mats.metal} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.95, 8]} />
      </mesh>
      <group ref={head} position={[0, 1.0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.1]} material={fanBody} castShadow>
          <capsuleGeometry args={[0.07, 0.12, 6, 14]} />
        </mesh>
        <group position={[0, 0, 0.08]}>
          <mesh material={mats.metal}>
            <torusGeometry args={[0.24, 0.006, 6, 40]} />
          </mesh>
          {cage.map((g, i) => (
            <mesh key={i} geometry={g} material={mats.metal} />
          ))}
          <group ref={blades}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} rotation={[0.25, 0, (i / 3) * Math.PI * 2]} position={[0, 0, 0]} material={fanPlastic}>
                <sphereGeometry args={[0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI]} />
                <group />
              </mesh>
            ))}
            <mesh material={fanBody}>
              <sphereGeometry args={[0.035, 12, 10]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 右護龍後間：雜物
// ---------------------------------------------------------------------------

function Storeroom() {
  const sack = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cdb98f', roughness: 1 }), [])
  const x = WING_R.x1 - 0.6
  return (
    <group>
      <WBox mat="wood" size={[0.7, 0.5, 0.7]} position={[x, FLOOR_Y + 0.25, -1.3]} />
      <WBox mat="wood" size={[0.55, 0.4, 0.55]} position={[x - 0.05, FLOOR_Y + 0.7, -1.25]} rotation={[0, 0.3, 0]} />
      <WBox mat="wood" size={[0.6, 0.45, 0.6]} position={[x - 0.8, FLOOR_Y + 0.225, -1.4]} rotation={[0, -0.2, 0]} />
      {[0, 1].map((i) => (
        <mesh key={i} position={[x - 0.1 - i * 0.55, FLOOR_Y + 0.28, 0.6]} rotation={[0, i * 0.5, 0]} scale={[1, 1.25, 0.8]} material={sack} castShadow>
          <sphereGeometry args={[0.25, 14, 10]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 神明廳（從敞開的大門看進去）
// ---------------------------------------------------------------------------

const lotusMat = new THREE.MeshStandardMaterial({ color: '#ff5a44', emissive: '#ff3a24', emissiveIntensity: 2.2, roughness: 0.5 })
const emberMat = new THREE.MeshBasicMaterial({ color: '#ffb070', toneMapped: false })
const brassMat = new THREE.MeshStandardMaterial({ color: '#b08a45', roughness: 0.3, metalness: 0.8 })
const orangeMat = new THREE.MeshStandardMaterial({ color: '#f08a24', roughness: 0.55 })

function scrollTexture() {
  return canvasTexture(
    384,
    384,
    (ctx, w, h) => {
      ctx.fillStyle = '#b22a22'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#e0b050'
      ctx.lineWidth = 10
      ctx.strokeRect(18, 18, w - 36, h - 36)
      ctx.fillStyle = '#f2c35c'
      ctx.font = `700 280px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('福', w / 2, h / 2 + 12)
    },
    [{ spec: `700 280px ${BRUSH_FONT}`, text: '福' }],
  )
}

function AltarHall() {
  const mats = useMats()
  const scroll = useMemo(scrollTexture, [])
  const lotus = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.05, 0.02],
          [0.08, 0.08],
          [0.09, 0.15],
          [0.06, 0.2],
          [0, 0.19],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        16,
      ),
    [],
  )
  const burner = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.12, 0],
          [0.14, 0.04],
          [0.16, 0.14],
          [0.15, 0.18],
          [0.17, 0.2],
          [0, 0.2],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        24,
      ),
    [],
  )
  const backZ = MAIN.z0 + 0.2
  const tableZ = backZ + 0.42
  const tableTop = FLOOR_Y + 1.05
  const rnd = seeded(12)
  const embers = useRef<THREE.Mesh[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    embers.current.forEach((m, i) => m && m.scale.setScalar(0.8 + Math.sin(t * 3 + i * 2) * 0.25))
    lotusMat.emissiveIntensity = 2.0 + Math.sin(t * 1.3) * 0.2
  })
  return (
    <group>
      {/* 中堂 */}
      <mesh position={[0, FLOOR_Y + 2.1, backZ + 0.01]}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshStandardMaterial map={scroll} roughness={0.7} />
      </mesh>
      {/* 供桌（長桌）與八仙桌 */}
      <WBox mat="redPaint" size={[3.0, 0.08, 0.66]} position={[0, tableTop - 0.04, tableZ]} />
      <WBox mat="redPaint" size={[2.9, 0.3, 0.06]} position={[0, tableTop - 0.22, tableZ + 0.3]} />
      <WBox mat="gold" size={[2.9, 0.03, 0.065]} position={[0, tableTop - 0.1, tableZ + 0.305]} castShadow={false} />
      {[-1.35, 1.35].map((x) => (
        <WBox key={x} mat="redPaint" size={[0.1, tableTop - FLOOR_Y, 0.6]} position={[x, (tableTop + FLOOR_Y) / 2, tableZ]} />
      ))}
      <WBox mat="wood" size={[1.1, 0.07, 1.1]} position={[0, FLOOR_Y + 0.8, tableZ + 1.25]} />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <WBox key={i} mat="darkWood" size={[0.07, 0.78, 0.07]} position={[sx * 0.48, FLOOR_Y + 0.39, tableZ + 1.25 + sz * 0.48]} />
      ))}
      {/* 蓮花燈、香爐、香、水果 */}
      {[-1.0, 1.0].map((x) => (
        <group key={x} position={[x, tableTop, tableZ]}>
          <mesh material={brassMat} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.02, 0.06, 0.24, 10]} />
          </mesh>
          <mesh geometry={lotus} material={lotusMat} position={[0, 0.24, 0]} scale={1.4} />
        </group>
      ))}
      <mesh geometry={burner} material={brassMat} position={[0, tableTop, tableZ]} castShadow />
      {[-0.05, 0, 0.05].map((x, i) => (
        <group key={i} position={[x, tableTop + 0.2, tableZ]} rotation={[0, 0, x * 1.2]}>
          <mesh position={[0, 0.2, 0]} material={mats.redPaper}>
            <cylinderGeometry args={[0.006, 0.006, 0.4, 4]} />
          </mesh>
          <mesh
            ref={(el) => {
              if (el) embers.current[i] = el
            }}
            position={[0, 0.405, 0]}
            material={emberMat}
          >
            <sphereGeometry args={[0.012, 6, 5]} />
          </mesh>
        </group>
      ))}
      {[-0.5, 0.5].map((x) => (
        <group key={x} position={[x, tableTop, tableZ + 0.05]}>
          <mesh material={mats.trim}>
            <cylinderGeometry args={[0.15, 0.1, 0.03, 20]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} material={orangeMat} position={[(rnd() - 0.5) * 0.14, 0.07 + (i === 2 ? 0.08 : 0), (rnd() - 0.5) * 0.14]} castShadow>
              <sphereGeometry args={[0.055, 14, 10]} />
            </mesh>
          ))}
        </group>
      ))}
      <Lantern position={[-0.9, FLOOR_Y + 2.6, tableZ + 0.9]} drop={0.3} scale={0.7} />
      <Lantern position={[0.9, FLOOR_Y + 2.6, tableZ + 0.9]} drop={0.3} scale={0.7} />
    </group>
  )
}
