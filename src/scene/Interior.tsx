import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { BRUSH_FONT, WBox, canvasTexture, seeded, useMats } from './kit'
import {
  BED,
  BUCKET,
  CUPBOARD,
  DRESSER,
  FLOOR_Y,
  GM_BED,
  HAN_BED,
  HAN_DESK,
  KITCHEN_JAR,
  KITCHEN_TABLE,
  MAIN,
  PILLOW_Z,
  ROCKER,
  SEWING,
  SINK,
  STOVE,
  TOILET,
  WING_L,
  WING_R,
} from './layout'
import { Lantern } from './House'

// 室內：客房的家具、右護龍後間的雜物、正身神明廳。

export function Interior() {
  return (
    <group>
      <GuestRoom />
      <Bathroom />
      <AltarHall />
      <GrandmaRoom />
      <GrandsonRoom />
      <Kitchen />
      <Storeroom />
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
  const x = WING_L.x0 + 1.4
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

// ---------------------------------------------------------------------------
// 阿嬤的房間：床鋪得整整齊齊、裁縫車、梳妝台上的老照片、搖椅
// ---------------------------------------------------------------------------

const quiltPlain = new THREE.MeshStandardMaterial({ color: '#9c5f86', roughness: 0.95 })
const photoFrame = new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.5 })

function photoTexture(seed: number) {
  return canvasTexture(96, 128, (ctx, w, h) => {
    const r = seeded(seed)
    ctx.fillStyle = '#e8dcc0'
    ctx.fillRect(0, 0, w, h)
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#b8a888')
    g.addColorStop(1, '#6f5f48')
    ctx.fillStyle = g
    ctx.fillRect(8, 8, w - 16, h - 16)
    // 模糊的人影
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      const x = 24 + i * 24 + r() * 6
      ctx.fillStyle = 'rgba(40,30,20,0.55)'
      ctx.beginPath()
      ctx.arc(x, 50, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(x - 11, 60, 22, 50)
    }
  })
}

function GrandmaRoom() {
  const mats = useMats()
  const photos = useMemo(() => [photoTexture(3), photoTexture(9)], [])
  return (
    <group>
      {/* 老眠床：床架、摺好的被子 */}
      <group position={[GM_BED.x, FLOOR_Y, GM_BED.z]}>
        <WBox mat="darkWood" size={[GM_BED.w + 0.12, 0.42, GM_BED.l + 0.1]} position={[0, 0.21, 0]} />
        <WBox mat="darkWood" size={[GM_BED.w + 0.2, 1.4, 0.1]} position={[0, 0.7, -GM_BED.l / 2 - 0.05]} />
        {[-1, 1].map((sx) => (
          <WBox key={sx} mat="darkWood" size={[0.08, 1.9, 0.08]} position={[sx * (GM_BED.w / 2 + 0.05), 0.95, GM_BED.l / 2]} />
        ))}
        <WBox mat="darkWood" size={[GM_BED.w + 0.2, 0.1, 0.1]} position={[0, 1.9, GM_BED.l / 2]} />
        <RoundedBox args={[GM_BED.w - 0.05, 0.16, GM_BED.l - 0.05]} radius={0.05} smoothness={2} position={[0, 0.5, 0]} material={clothWhite} castShadow receiveShadow />
        <RoundedBox args={[0.9, 0.24, 0.55]} radius={0.08} smoothness={3} position={[0, 0.7, 0.35]} material={quiltPlain} castShadow />
        <RoundedBox args={[0.7, 0.12, 0.35]} radius={0.05} smoothness={2} position={[0, 0.64, -0.7]} material={pillowMat} castShadow />
      </group>
      {/* 裁縫車 */}
      <group position={[SEWING.x, FLOOR_Y, SEWING.z]}>
        <WBox mat="wood" size={[0.95, 0.05, 0.5]} position={[0, 0.75, 0]} />
        {[-0.4, 0.4].map((x) => (
          <WBox key={x} mat="metal" size={[0.05, 0.73, 0.4]} position={[x, 0.37, 0]} />
        ))}
        <RoundedBox args={[0.45, 0.2, 0.16]} radius={0.05} smoothness={2} position={[0.05, 0.9, 0]} material={mats.black} castShadow />
        <mesh position={[-0.2, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.gold}>
          <cylinderGeometry args={[0.06, 0.06, 0.03, 16]} />
        </mesh>
      </group>
      {/* 梳妝台與老照片（互動點：看老照片） */}
      <group position={[DRESSER.x, FLOOR_Y, DRESSER.z]}>
        <WBox mat="wood" size={[0.5, 0.8, 1.05]} position={[0, 0.4, 0]} />
        <WBox mat="darkWood" size={[0.06, 0.75, 0.6]} position={[-0.2, 1.2, 0]} />
        <mesh position={[-0.165, 1.2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.5, 0.62]} />
          <meshStandardMaterial color="#9fb3c2" roughness={0.05} metalness={0.9} />
        </mesh>
        {photos.map((t, i) => (
          <group key={i} position={[0.05, 0.8 + 0.13, (i - 0.5) * 0.4]} rotation={[0, Math.PI / 2 - 0.25, -0.12]}>
            <mesh material={photoFrame} castShadow>
              <boxGeometry args={[0.2, 0.26, 0.02]} />
            </mesh>
            <mesh position={[0, 0, 0.012]}>
              <planeGeometry args={[0.16, 0.21]} />
              <meshStandardMaterial map={t} roughness={0.7} />
            </mesh>
          </group>
        ))}
      </group>
      <Rocker position={[ROCKER.x, FLOOR_Y, ROCKER.z]} />
    </group>
  )
}

/** 搖椅（之後的「附身物件」：自己搖） */
function Rocker({ position }: { position: [number, number, number] }) {
  const mats = useMats()
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.x = Math.sin(clock.elapsedTime * 0.8) * 0.03
  })
  return (
    <group ref={g} position={position} rotation={[0, 0.6, 0]} userData={{ noMerge: true }}>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.1, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.bamboo}>
          <torusGeometry args={[0.45, 0.02, 6, 24, Math.PI * 0.55]} />
        </mesh>
      ))}
      <WBox mat="wood" size={[0.5, 0.05, 0.45]} position={[0, 0.42, 0]} />
      <WBox mat="wood" size={[0.5, 0.65, 0.05]} position={[0, 0.78, -0.25]} rotation={[-0.2, 0, 0]} />
      {[-0.22, 0.22].map((x) => (
        <WBox key={x} mat="wood" size={[0.04, 0.4, 0.04]} position={[x, 0.24, 0.1]} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 小翰的房間：床、書桌上的筆電、海報
// ---------------------------------------------------------------------------

const laptopScreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.75, 1.1), toneMapped: false })
const bedBlue = new THREE.MeshStandardMaterial({ color: '#4d6f9c', roughness: 0.95 })

function posterTexture(title: string, bg: string, fg: string) {
  return canvasTexture(
    128,
    176,
    (ctx, w, h) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = fg
      ctx.beginPath()
      ctx.arc(w / 2, h * 0.42, 34, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = `900 26px "Noto Sans TC", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(title, w / 2, h - 22)
    },
    [{ spec: `900 26px "Noto Sans TC"`, text: title }],
  )
}

function GrandsonRoom() {
  const mats = useMats()
  const posters = useMemo(() => [posterTexture('台北', '#1f2a44', '#e8a33a'), posterTexture('露營', '#2f5a3a', '#f2e6c8')], [])
  return (
    <group>
      <group position={[HAN_BED.x, FLOOR_Y, HAN_BED.z]}>
        <WBox mat="wood" size={[HAN_BED.w + 0.08, 0.3, HAN_BED.l + 0.08]} position={[0, 0.15, 0]} />
        <RoundedBox args={[HAN_BED.w, 0.18, HAN_BED.l]} radius={0.05} smoothness={2} position={[0, 0.39, 0]} material={clothWhite} castShadow receiveShadow />
        <RoundedBox args={[HAN_BED.w + 0.04, 0.1, HAN_BED.l * 0.6]} radius={0.04} smoothness={2} position={[0, 0.51, HAN_BED.l * 0.18]} material={bedBlue} castShadow />
        <RoundedBox args={[0.6, 0.12, 0.35]} radius={0.05} smoothness={2} position={[0, 0.54, -HAN_BED.l / 2 + 0.3]} material={pillowMat} />
      </group>
      <group position={[HAN_DESK.x, FLOOR_Y, HAN_DESK.z]}>
        <WBox mat="wood" size={[0.6, 0.05, 1.2]} position={[0, 0.74, 0]} />
        {[-0.5, 0.5].map((z) => (
          <WBox key={z} mat="darkWood" size={[0.55, 0.72, 0.05]} position={[0, 0.36, z]} />
        ))}
        {/* 筆電：螢幕朝房間 */}
        <WBox mat="metal" size={[0.24, 0.015, 0.34]} position={[-0.05, 0.775, 0]} />
        <group position={[0.07, 0.775, 0]} rotation={[0, 0, 0.35]}>
          <WBox mat="metal" size={[0.015, 0.24, 0.34]} position={[0, 0.12, 0]} />
          <mesh position={[-0.009, 0.12, 0]} rotation={[0, -Math.PI / 2, 0]} material={laptopScreen}>
            <planeGeometry args={[0.3, 0.2]} />
          </mesh>
        </group>
        <mesh position={[-0.05, 0.8, 0.42]} material={mats.ceramic} castShadow>
          <cylinderGeometry args={[0.04, 0.035, 0.1, 12]} />
        </mesh>
      </group>
      {/* 椅子 */}
      <group position={[HAN_DESK.x - 0.65, FLOOR_Y, HAN_DESK.z]}>
        <WBox mat="wood" size={[0.42, 0.04, 0.42]} position={[0, 0.45, 0]} />
        <WBox mat="wood" size={[0.04, 0.5, 0.42]} position={[-0.2, 0.72, 0]} />
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([a, b], i) => (
          <WBox key={i} mat="darkWood" size={[0.035, 0.44, 0.035]} position={[a * 0.18, 0.22, b * 0.18]} />
        ))}
      </group>
      {posters.map((t, i) => (
        <mesh key={i} position={[4.2 + i * 1.0, FLOOR_Y + 1.8, MAIN.z0 + 0.17]}>
          <planeGeometry args={[0.5, 0.69]} />
          <meshStandardMaterial map={t} roughness={0.8} />
        </mesh>
      ))}
      {/* 背包 */}
      <RoundedBox args={[0.34, 0.45, 0.2]} radius={0.07} smoothness={2} position={[3.0, FLOOR_Y + 0.23, MAIN.z0 + 0.45]} material={bedBlue} castShadow />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 灶腳：磚灶與大鼎、碗櫥、飯桌、水缸、柴
// ---------------------------------------------------------------------------

const wokMat = new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.45, metalness: 0.6 })
const tileWhite = new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.35 })

function Kitchen() {
  const mats = useMats()
  const wok = useMemo(() => new THREE.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [])
  const logs = useMemo(() => {
    const r = seeded(4)
    return Array.from({ length: 9 }, (_, i) => ({ x: (i % 3) * 0.15, y: Math.floor(i / 3) * 0.13 + 0.07, z: (r() - 0.5) * 0.08, rot: (r() - 0.5) * 0.2 }))
  }, [])
  return (
    <group>
      {/* 灶：磚砌，檯面貼白磁磚，兩口大鼎 */}
      <group position={[STOVE.x, FLOOR_Y, STOVE.z]}>
        <WBox mat="brick" size={[1.1, 0.8, 1.65]} position={[0, 0.4, 0]} />
        <mesh position={[0, 0.81, 0]} material={tileWhite} receiveShadow>
          <boxGeometry args={[1.14, 0.03, 1.69]} />
        </mesh>
        {[-0.4, 0.42].map((z) => (
          <group key={z} position={[0.05, 0.84, z]}>
            <mesh geometry={wok} material={wokMat} castShadow />
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.darkWood}>
              <circleGeometry args={[0.3, 20]} />
            </mesh>
          </group>
        ))}
        {/* 灶口 */}
        <mesh position={[0.56, 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.35, 0.28]} />
          <meshStandardMaterial color="#120c08" />
        </mesh>
      </group>
      {/* 碗櫥：紗門 */}
      <group position={[CUPBOARD.x, FLOOR_Y, CUPBOARD.z]}>
        <WBox mat="wood" size={[1.0, 1.7, 0.45]} position={[0, 0.85, 0]} />
        {[-0.24, 0.24].map((x) => (
          <mesh key={x} position={[x, 1.2, -0.23]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.4, 0.7]} />
            <meshStandardMaterial color="#6f8a7a" roughness={0.9} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
      {/* 飯桌與碗 */}
      <group position={[KITCHEN_TABLE.x, FLOOR_Y, KITCHEN_TABLE.z]}>
        <mesh position={[0, 0.72, 0]} material={mats.darkWood} castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.04, 24]} />
        </mesh>
        <mesh position={[0, 0.36, 0]} material={mats.darkWood} castShadow>
          <cylinderGeometry args={[0.05, 0.16, 0.7, 10]} />
        </mesh>
        {[
          [0.12, 0.1],
          [-0.15, -0.05],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.77, z]} material={mats.trim} castShadow>
            <cylinderGeometry args={[0.07, 0.045, 0.06, 14]} />
          </mesh>
        ))}
      </group>
      {/* 水缸 */}
      <mesh position={[KITCHEN_JAR.x, FLOOR_Y + 0.35, KITCHEN_JAR.z]} material={mats.ceramic} castShadow>
        <cylinderGeometry args={[0.36, 0.28, 0.7, 20]} />
      </mesh>
      {/* 柴堆 */}
      <group position={[WING_L.x0 + 0.3, FLOOR_Y, STOVE.z + 1.3]} rotation={[0, Math.PI / 2, 0]}>
        {logs.map((l, i) => (
          <mesh key={i} position={[l.x - 0.15, l.y, l.z]} rotation={[0, l.rot, Math.PI / 2]} material={mats.wood} castShadow>
            <cylinderGeometry args={[0.065, 0.065, 0.55, 7]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 浴廁（右護龍後間）：蹲式馬桶、洗手台與鏡子（之後「鏡中人」的位置）、紅水桶
// ---------------------------------------------------------------------------

const mirrorMat = new THREE.MeshStandardMaterial({ color: '#b9c9d4', roughness: 0.04, metalness: 0.95 })
const bucketMat = new THREE.MeshStandardMaterial({ color: '#d4322a', roughness: 0.4 })

function Bathroom() {
  const mats = useMats()
  const wallX = WING_R.x1 - 0.16
  return (
    <group>
      {/* 牆腳白磁磚 */}
      <mesh position={[wallX - 0.005, FLOOR_Y + 0.6, (WING_R.z0 + WING_R.split) / 2]} rotation={[0, -Math.PI / 2, 0]} material={tileWhite}>
        <planeGeometry args={[WING_R.split - WING_R.z0 - 0.3, 1.2]} />
      </mesh>
      {/* 蹲式馬桶 */}
      <group position={[TOILET.x, FLOOR_Y, TOILET.z]}>
        <mesh position={[0, 0.06, 0]} material={tileWhite} castShadow>
          <boxGeometry args={[0.44, 0.12, 0.56]} />
        </mesh>
        <mesh position={[0, 0.125, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.13, 20]} />
          <meshStandardMaterial color="#3a4a52" roughness={0.1} />
        </mesh>
      </group>
      {/* 洗手台與鏡子 */}
      <group position={[SINK.x, FLOOR_Y, SINK.z]}>
        <mesh position={[0, 0.8, 0]} material={tileWhite} castShadow>
          <boxGeometry args={[0.4, 0.14, 0.5]} />
        </mesh>
        <mesh position={[0, 0.4, 0]} material={tileWhite}>
          <cylinderGeometry args={[0.06, 0.08, 0.72, 10]} />
        </mesh>
        <mesh position={[0.1, 0.92, 0]} material={mats.metal}>
          <cylinderGeometry args={[0.012, 0.012, 0.14, 6]} />
        </mesh>
        <mesh position={[0.235, 1.55, 0]} rotation={[0, -Math.PI / 2, 0]} material={mirrorMat}>
          <planeGeometry args={[0.45, 0.6]} />
        </mesh>
      </group>
      {/* 紅水桶與水瓢 */}
      <group position={[BUCKET.x, FLOOR_Y, BUCKET.z]}>
        <mesh position={[0, 0.2, 0]} material={bucketMat} castShadow>
          <cylinderGeometry args={[0.22, 0.18, 0.4, 20, 1, true]} />
        </mesh>
        <mesh position={[0, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.21, 20]} />
          <meshStandardMaterial color="#5a7a88" roughness={0.05} />
        </mesh>
        <mesh position={[0.08, 0.4, 0.05]} rotation={[0.3, 0, 0.2]} material={bucketMat}>
          <cylinderGeometry args={[0.07, 0.06, 0.07, 12]} />
        </mesh>
      </group>
    </group>
  )
}
