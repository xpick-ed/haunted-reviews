import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useStore } from '../store'
import { HARBOR, lighthouseLit } from '../world/sceneHarbor'
import { FLATS, tideState, waterY } from '../world/tide'
import { lanternAt } from './daylight'
import { BRUSH_FONT, WBox, canvasTexture, seeded, useMats } from './kit'
import { Corrugated, corrugatedTexture } from './VillageKit'
import { Chibi, SEAT_Y, newDrive, type Drive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { player } from '../world/player'

// 海邊漁港的東西：碼頭、堤防與消波塊、燈塔（點亮後光束會轉）、漁船（跟著潮水浮沉）、
// 魚市棚子、繫船柱、路燈、保麗龍箱、漁網、浮球、掛在碼頭邊的舊輪胎，還有晚上坐在碼頭邊的鬼漁夫。

const H = HARBOR
const WALL_BOTTOM = -2.8

// ---------------------------------------------------------------------------
// 碼頭：水泥面、碼頭邊的牆（黃黑警示邊）、下到潮間帶的石階、掛在牆上的舊輪胎
// ---------------------------------------------------------------------------

export function Quay() {
  const mats = useMats()
  const stripe = useMemo(() => {
    const t = canvasTexture(128, 16, (ctx, _w, h) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#1c1c1c' : '#e0b830'
        ctx.beginPath()
        ctx.moveTo(i * 16, 0)
        ctx.lineTo(i * 16 + 16, 0)
        ctx.lineTo(i * 16 + 8, h)
        ctx.lineTo(i * 16 - 8, h)
        ctx.fill()
      }
    })
    t.wrapS = THREE.RepeatWrapping
    t.repeat.set(20, 1)
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })
  }, [])
  const tire = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.9 }), [])
  const westLen = FLATS.x0 + 22
  const eastLen = 22 - FLATS.x0
  const steps = 6
  return (
    <group>
      {/* 碼頭邊的牆（面向海） */}
      <WBox mat="yard" size={[westLen, -WALL_BOTTOM, 0.5]} position={[(-22 + FLATS.x0) / 2, WALL_BOTTOM / 2, H.quayZ - 0.25]} />
      <WBox mat="stone" size={[eastLen, 1.6, 0.5]} position={[(FLATS.x0 + 22) / 2, -0.8, H.quayZ - 0.25]} />
      {/* 黃黑相間的警示邊 */}
      <mesh material={stripe} position={[(-22 + FLATS.x0) / 2, 0.05, H.quayZ - 0.02]}>
        <boxGeometry args={[westLen, 0.1, 0.06]} />
      </mesh>
      {/* 石階：從碼頭下到潮間帶 */}
      {Array.from({ length: steps }, (_, i) => (
        <WBox key={i} mat="stone" size={[H.steps.w, 0.2, 0.34]} position={[H.steps.x, -0.1 - i * 0.2, H.quayZ - 0.2 - i * 0.32]} />
      ))}
      {/* 掛在碼頭邊的舊輪胎（船靠岸的護墊） */}
      {[-10, -7.2, -4.4, -1.6, 1.2, 4.0].map((x) => (
        <mesh key={x} material={tire} position={[x, -0.55, H.quayZ - 0.58]} rotation={[0, 0, 0]} castShadow>
          <torusGeometry args={[0.34, 0.12, 8, 16]} />
        </mesh>
      ))}
      <mesh material={mats.black} position={[0, -0.18, H.quayZ - 0.52]}>
        <boxGeometry args={[14, 0.03, 0.03]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 堤防：往北伸進海裡的水泥堤，外側（西邊）堆滿消波塊；盡頭是燈塔
// ---------------------------------------------------------------------------

export function Breakwater() {
  const bw = H.breakwater
  const w = bw.x1 - bw.x0
  const d = bw.z1 - bw.z0
  return (
    <group>
      <WBox mat="yard" size={[w, bw.y - WALL_BOTTOM, d]} position={[(bw.x0 + bw.x1) / 2, (bw.y + WALL_BOTTOM) / 2, (bw.z0 + bw.z1) / 2]} />
      {/* 外側的擋浪牆 */}
      <WBox mat="yard" size={[0.35, 0.7, d]} position={[bw.x0 + 0.18, bw.y + 0.35, (bw.z0 + bw.z1) / 2]} />
      {/* 燈塔的圓形基座 */}
      <mesh position={[H.lighthouse.x, (bw.y + WALL_BOTTOM) / 2, H.lighthouse.z]} castShadow receiveShadow>
        <cylinderGeometry args={[2.1, 2.3, bw.y - WALL_BOTTOM, 20]} />
        <meshStandardMaterial color="#9a978e" roughness={0.9} />
      </mesh>
    </group>
  )
}

/** 消波塊：四隻腳的水泥塊，一個一個亂疊 */
export function Tetrapods() {
  const mesh = useMemo(() => {
    const legs: THREE.BufferGeometry[] = []
    const dirs = [
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0.943, -0.333, 0),
      new THREE.Vector3(-0.471, -0.333, 0.816),
      new THREE.Vector3(-0.471, -0.333, -0.816),
    ]
    for (const d of dirs) {
      const g = new THREE.CylinderGeometry(0.16, 0.3, 0.7, 7)
      g.translate(0, 0.35, 0)
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d))
      legs.push(g.toNonIndexed())
    }
    const geo = mergeGeometries(legs)!
    geo.computeVertexNormals()
    const r = seeded(606)
    const spots: THREE.Matrix4[] = []
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    // 堤防外側一整排，燈塔四周一圈
    for (let z = H.breakwater.z1; z > H.breakwater.z0 - 1; z -= 0.75) {
      for (let k = 0; k < 2; k++) {
        const x = H.breakwater.x0 - 0.6 - k * 1.0 - r() * 0.4
        spots.push(new THREE.Matrix4().compose(new THREE.Vector3(x, -0.55 - k * 0.5 + r() * 0.3, z + (r() - 0.5) * 0.4), q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6)).clone(), new THREE.Vector3(1, 1, 1).multiplyScalar(1.1 + r() * 0.3)))
      }
    }
    for (let a = 0; a < 16; a++) {
      const ang = Math.PI * 0.15 + (a / 16) * Math.PI * 1.25
      const x = H.lighthouse.x + Math.cos(ang) * 2.7
      const z = H.lighthouse.z - Math.abs(Math.sin(ang)) * 2.7
      spots.push(new THREE.Matrix4().compose(new THREE.Vector3(x, -0.7 + r() * 0.3, z), q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6)).clone(), new THREE.Vector3(1.15, 1.15, 1.15)))
    }
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#9c998f', roughness: 0.95 }), spots.length)
    spots.forEach((s, i) => m.setMatrixAt(i, s))
    m.castShadow = true
    m.receiveShadow = true
    return m
  }, [])
  return <primitive object={mesh} />
}

// ---------------------------------------------------------------------------
// 燈塔：白色塔身兩道紅環、陽台、燈籠室；點亮以後燈會轉，光束掃過海面
// ---------------------------------------------------------------------------

const beamTex = canvasTexture(32, 128, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, 'rgba(255,248,220,0.9)')
  g.addColorStop(0.35, 'rgba(255,240,200,0.35)')
  g.addColorStop(1, 'rgba(255,240,200,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

const glowTex = canvasTexture(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(255,250,225,1)')
  g.addColorStop(0.3, 'rgba(255,235,180,0.55)')
  g.addColorStop(1, 'rgba(255,235,180,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

export function Lighthouse() {
  const L = H.lighthouse
  const base = H.breakwater.y
  const towerH = 6
  const top = base + towerH
  const spin = useRef<THREE.Group>(null)
  const beams = useRef<THREE.Group>(null)
  const glow = useRef<THREE.Sprite>(null)
  const lampMat = useRef<THREE.MeshStandardMaterial>(null)
  const spot = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  const doorLamp = useRef<THREE.MeshStandardMaterial>(null)
  const seaSpin = useRef<THREE.Group>(null)
  const seaPools = useRef<THREE.MeshBasicMaterial[]>([])
  const k = useRef(0)
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const lit = lighthouseLit(s) && s.phase === 'night'
    // 點亮時慢慢亮起來
    k.current += ((lit ? 1 : 0) - k.current) * Math.min(1, dt * 1.2)
    const on = k.current
    const ang = clock.elapsedTime * 0.55
    if (spin.current) spin.current.rotation.y = ang
    if (beams.current) {
      beams.current.visible = on > 0.02
      beams.current.traverse((c) => {
        const m = c as THREE.Mesh
        if (m.isMesh) (m.material as THREE.MeshBasicMaterial).opacity = 0.2 * on
      })
    }
    if (seaSpin.current) {
      seaSpin.current.rotation.y = ang
      seaSpin.current.position.y = waterY(tideState.level) + 0.03
      seaSpin.current.visible = on > 0.02
    }
    for (const m of seaPools.current) m.opacity = 0.45 * on
    if (glow.current) {
      glow.current.visible = on > 0.02
      glow.current.scale.setScalar(2.2 + on * 1.4 + Math.sin(clock.elapsedTime * 3) * 0.1)
      ;(glow.current.material as THREE.SpriteMaterial).opacity = on
    }
    if (lampMat.current) lampMat.current.emissiveIntensity = 0.05 + on * 3
    if (spot.current) {
      spot.current.intensity = on * 40
      // 跟第一道光束同一個方向（旋轉 y 以後，本地 +x 朝向 (cos, 0, -sin)）
      target.position.set(L.x + Math.cos(ang) * 18, 0, L.z - Math.sin(ang) * 18)
      target.updateMatrixWorld()
    }
    if (doorLamp.current) doorLamp.current.emissiveIntensity = lanternAt(s.time) * 1.5
  })
  const bands = [
    { y0: 0, y1: 1.4, red: false },
    { y0: 1.4, y1: 2.3, red: true },
    { y0: 2.3, y1: 3.8, red: false },
    { y0: 3.8, y1: 4.7, red: true },
    { y0: 4.7, y1: towerH, red: false },
  ]
  const rAt = (y: number) => 1.15 - (y / towerH) * 0.32
  return (
    <group position={[L.x, 0, L.z]} userData={{ noMerge: true }}>
      {bands.map((b, i) => (
        <mesh key={i} position={[0, base + (b.y0 + b.y1) / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[rAt(b.y1), rAt(b.y0), b.y1 - b.y0, 22]} />
          <meshStandardMaterial color={b.red ? '#b8342c' : '#eeeae0'} roughness={0.7} />
        </mesh>
      ))}
      {/* 門（面向碼頭）與門上的小燈 */}
      <mesh position={[0, base + 0.75, rAt(0.75) - 0.02]}>
        <boxGeometry args={[0.7, 1.4, 0.08]} />
        <meshStandardMaterial color="#2c3a48" roughness={0.6} />
      </mesh>
      <mesh position={[0, base + 1.65, rAt(1.6) + 0.02]}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshStandardMaterial ref={doorLamp} color="#ffe7b0" emissive="#ffc870" emissiveIntensity={0} />
      </mesh>
      {/* 陽台與欄杆 */}
      <mesh position={[0, top + 0.05, 0]} castShadow>
        <cylinderGeometry args={[1.25, 1.25, 0.12, 24]} />
        <meshStandardMaterial color="#3a3a3c" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, top + 0.45, 0]}>
        <torusGeometry args={[1.2, 0.025, 6, 32]} />
        <meshStandardMaterial color="#2a2a2c" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* 燈籠室（玻璃）與裡面的燈 */}
      <mesh position={[0, top + 0.6, 0]}>
        <cylinderGeometry args={[0.72, 0.72, 1.0, 16, 1, true]} />
        <meshStandardMaterial color="#a8c4d0" transparent opacity={0.35} roughness={0.05} metalness={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, top + 0.6, 0]}>
        <sphereGeometry args={[0.32, 16, 12]} />
        <meshStandardMaterial ref={lampMat} color="#fff6d8" emissive="#ffe0a0" emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
      <mesh position={[0, top + 1.35, 0]} castShadow>
        <coneGeometry args={[0.85, 0.7, 20]} />
        <meshStandardMaterial color="#9a2a24" roughness={0.6} />
      </mesh>
      <sprite ref={glow} position={[0, top + 0.6, 0]} visible={false}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* 光束：兩道，背對背，往下斜一點（從鏡頭看得到掃過港口），跟著燈轉 */}
      <group ref={spin} position={[0, top + 0.6, 0]}>
        <group ref={beams} visible={false}>
          {[0, Math.PI].map((a) => (
            <group key={a} rotation-y={a}>
              <group rotation-z={-0.16}>
                <mesh position={[11, 0, 0]} rotation-z={Math.PI / 2}>
                  <coneGeometry args={[2.6, 22, 16, 1, true]} />
                  <meshBasicMaterial map={beamTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      </group>
      {/* 光照在海面上的一團亮光，跟著光束轉 */}
      <group ref={seaSpin}>
        {[0, Math.PI].map((a) => (
          <group key={a} rotation-y={a}>
            <mesh position={[15, 0, 0]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[9, 3.6]} />
              <meshBasicMaterial ref={(m) => void (m && (seaPools.current[a === 0 ? 0 : 1] = m))} map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} color="#fff0c8" />
            </mesh>
          </group>
        ))}
      </group>
      <spotLight ref={spot} position={[0, top + 0.6, 0]} target={target} angle={0.22} penumbra={0.7} distance={40} decay={1.2} color="#fff0c8" intensity={0} />
      <primitive object={target} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 漁船：船身（下半截有顏色、上半截白）、駕駛艙、桅杆上的集魚燈、船名；跟著潮水浮沉
// ---------------------------------------------------------------------------

function hullShape(len: number, wid: number) {
  const s = new THREE.Shape()
  s.moveTo(-len / 2, -wid / 2)
  s.lineTo(len * 0.18, -wid / 2)
  s.quadraticCurveTo(len * 0.42, -wid * 0.42, len / 2, 0)
  s.quadraticCurveTo(len * 0.42, wid * 0.42, len * 0.18, wid / 2)
  s.lineTo(-len / 2, wid / 2)
  s.closePath()
  return s
}

function nameTexture(name: string, no: string, color: string) {
  return canvasTexture(
    512,
    128,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = color
      ctx.font = `700 76px ${BRUSH_FONT}`
      ctx.textBaseline = 'middle'
      ctx.fillText(name, 20, h * 0.46)
      ctx.fillStyle = '#1c1c1c'
      ctx.font = '700 34px sans-serif'
      ctx.fillText(no, w - 190, h * 0.5)
    },
    [{ spec: `700 76px ${BRUSH_FONT}`, text: name }],
  )
}

function Boat({ b, i }: { b: (typeof H.boats)[number]; i: number }) {
  const group = useRef<THREE.Group>(null)
  const cabinGlow = useRef<THREE.MeshStandardMaterial>(null)
  // 集魚燈：一隻船的燈泡共用一個材質，一起亮
  const bulbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#f4ffe0', emissiveIntensity: 0, toneMapped: false }), [])
  const wid = b.len * 0.34
  const { lower, upper } = useMemo(() => {
    const shape = hullShape(b.len, wid)
    const lower = new THREE.ExtrudeGeometry(shape, { depth: 0.75, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 10 })
    lower.rotateX(-Math.PI / 2)
    const upper = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: false, curveSegments: 10 })
    upper.rotateX(-Math.PI / 2)
    upper.translate(0, 0.75, 0)
    return { lower, upper }
  }, [b.len, wid])
  const hullMat = useMemo(() => new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.6 }), [b.color])
  const no = `CT${3 + i}-${1024 + i * 331}`
  const label = useMemo(() => nameTexture(b.name, no, b.color), [b.name, no, b.color])
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime
    const y = waterY(tideState.level) - 0.35 + Math.sin(t * 0.9 + i * 1.7) * 0.06
    g.position.set(b.x, y, b.z)
    g.rotation.set(Math.sin(t * 0.7 + i) * 0.015, b.rot, Math.sin(t * 0.8 + i * 2.1) * 0.035)
    const l = lanternAt(useStore.getState().time)
    bulbMat.emissiveIntensity = l * 2.4
    if (cabinGlow.current) cabinGlow.current.emissiveIntensity = l * 1.2
  })
  const cabinX = -b.len * 0.18
  return (
    <group ref={group} userData={{ noMerge: true }}>
      <mesh geometry={lower} material={hullMat} castShadow receiveShadow />
      <mesh geometry={upper} castShadow receiveShadow>
        <meshStandardMaterial color="#efece4" roughness={0.6} />
      </mesh>
      {/* 甲板 */}
      <mesh position={[0, 1.12, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <shapeGeometry args={[hullShape(b.len * 0.94, wid * 0.9)]} />
        <meshStandardMaterial color="#8a7458" roughness={0.9} />
      </mesh>
      {/* 船名（左右兩邊） */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[-b.len * 0.05, 0.98, (s * wid) / 2 + s * 0.012]} rotation-y={s > 0 ? 0 : Math.PI}>
          <planeGeometry args={[b.len * 0.55, b.len * 0.14]} />
          <meshBasicMaterial map={label} transparent depthWrite={false} />
        </mesh>
      ))}
      {/* 駕駛艙 */}
      <mesh position={[cabinX, 1.62, 0]} castShadow>
        <boxGeometry args={[b.len * 0.26, 1.0, wid * 0.66]} />
        <meshStandardMaterial color="#f2efe8" roughness={0.6} />
      </mesh>
      <mesh position={[cabinX + b.len * 0.131, 1.78, 0]}>
        <boxGeometry args={[0.02, 0.36, wid * 0.56]} />
        <meshStandardMaterial ref={cabinGlow} color="#26343c" emissive="#ffcf80" emissiveIntensity={0} />
      </mesh>
      <mesh position={[cabinX, 2.16, 0]}>
        <boxGeometry args={[b.len * 0.3, 0.08, wid * 0.74]} />
        <meshStandardMaterial color={b.color} roughness={0.6} />
      </mesh>
      {/* 桅杆與集魚燈（一排燈泡） */}
      <mesh position={[b.len * 0.12, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 3.0, 8]} />
        <meshStandardMaterial color="#d8d4c8" roughness={0.5} />
      </mesh>
      <mesh position={[b.len * 0.12, 3.1, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.03, 0.03, wid * 1.2, 6]} />
        <meshStandardMaterial color="#8a8680" />
      </mesh>
      {Array.from({ length: 6 }, (_, k) => (
        <mesh key={k} material={bulbMat} position={[b.len * 0.12, 3.02, -wid * 0.55 + (k * wid * 1.1) / 5]}>
          <sphereGeometry args={[0.07, 8, 6]} />
        </mesh>
      ))}
      {/* 旗子 */}
      <mesh position={[b.len * 0.12 + 0.28, 3.95, 0]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshStandardMaterial color="#d8342c" side={THREE.DoubleSide} />
      </mesh>
      {/* 船尾的東西：漁網、塑膠籃；「新漁興」多一罐紅色燈油 */}
      <mesh position={[-b.len * 0.4, 1.28, wid * 0.18]} castShadow>
        <sphereGeometry args={[0.36, 10, 8]} />
        <meshStandardMaterial color={i % 2 ? '#d8662a' : '#3f8a5a'} roughness={1} />
      </mesh>
      {i === 1 && (
        <mesh position={[-b.len * 0.42, 1.35, wid * 0.36]} castShadow>
          <boxGeometry args={[0.28, 0.4, 0.18]} />
          <meshStandardMaterial color="#c83a2a" roughness={0.5} metalness={0.3} />
        </mesh>
      )}
    </group>
  )
}

export function Boats() {
  return (
    <group>
      {H.boats.map((b, i) => (
        <Boat key={b.name} b={b} i={i} />
      ))}
      <MooringRopes />
    </group>
  )
}

/** 纜繩：從繫船柱拉到船頭；船跟著潮水浮沉，纜繩每幀重新對準 */
function MooringRopes() {
  const ropes = useRef<(THREE.Mesh | null)[]>([])
  const pairs = useMemo(
    () =>
      H.boats.map((b) => {
        const bx = H.bollards.reduce((a, x) => (Math.abs(x - b.x) < Math.abs(a - b.x) ? x : a), H.bollards[0])
        return { bx, bz: H.quayZ + 0.35, tx: b.x + b.len * 0.35, tz: b.z + b.len * 0.12 }
      }),
    [],
  )
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const a = useMemo(() => new THREE.Vector3(), [])
  const c = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const y = waterY(tideState.level) - 0.35 + 1.15
    pairs.forEach((p, i) => {
      const m = ropes.current[i]
      if (!m) return
      a.set(p.bx, 0.42, p.bz)
      c.set(p.tx, y, p.tz)
      const len = a.distanceTo(c)
      m.position.copy(a).add(c).multiplyScalar(0.5)
      m.scale.set(1, len, 1)
      m.quaternion.setFromUnitVectors(up, c.clone().sub(a).normalize())
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {pairs.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            ropes.current[i] = el
          }}
        >
          <cylinderGeometry args={[0.025, 0.025, 1, 5]} />
          <meshStandardMaterial color="#c8b890" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 魚市棚子：鐵柱、浪板屋頂與後牆、兩排魚台、招牌、吊燈、疊高的保麗龍箱
// ---------------------------------------------------------------------------

export function FishMarket() {
  const s = H.shed
  const cx = (s.x0 + s.x1) / 2
  const cz = (s.z0 + s.z1) / 2
  const w = s.x1 - s.x0
  const d = s.z1 - s.z0
  const lamp = useRef<THREE.PointLight>(null)
  const sign = useMemo(
    () =>
      canvasTexture(
        512,
        112,
        (ctx, W, Hh) => {
          ctx.fillStyle = '#1f4f7a'
          ctx.fillRect(0, 0, W, Hh)
          ctx.strokeStyle = '#f2efe6'
          ctx.lineWidth = 6
          ctx.strokeRect(6, 6, W - 12, Hh - 12)
          ctx.fillStyle = '#f7f3ea'
          ctx.font = `700 64px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('區漁會 魚市場', W / 2, Hh / 2 + 4)
        },
        [{ spec: `700 64px ${BRUSH_FONT}`, text: '區漁會 魚市場' }],
      ),
    [],
  )
  useFrame(() => {
    if (lamp.current) lamp.current.intensity = lanternAt(useStore.getState().time) * 1.6
  })
  const cols: [number, number][] = []
  for (const x of [s.x0 + 0.2, cx, s.x1 - 0.2]) for (const z of [s.z0 + 0.2, s.z1 - 0.2]) cols.push([x, z])
  return (
    <group>
      <WBox mat="yard" size={[w, 0.1, d]} position={[cx, 0.05, cz]} />
      {cols.map(([x, z], i) => (
        <mesh key={i} position={[x, s.h / 2, z]} castShadow>
          <boxGeometry args={[0.16, s.h, 0.16]} />
          <meshStandardMaterial color="#5a7a88" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {/* 屋頂（往南邊斜）與後牆、西牆 */}
      <Corrugated position={[cx, s.h + 0.1, cz]} size={[w + 0.8, d + 0.9]} tilt={-0.08} color="#7d9aa0" />
      <CorrugatedWall position={[cx, s.h / 2, s.z1 - 0.08]} w={w} h={s.h} />
      <CorrugatedWall position={[s.x0 + 0.08, s.h / 2, cz]} w={d} h={s.h} rotY={Math.PI / 2} />
      {/* 招牌：掛在屋簷，面向鏡頭 */}
      <mesh position={[cx, s.h + 0.75, s.z1 + 0.15]}>
        <planeGeometry args={[5.4, 1.2]} />
        <meshStandardMaterial map={sign} roughness={0.7} />
      </mesh>
      {/* 魚台：水泥台面貼白磁磚 */}
      {[-1.6, 1.6].map((o) => (
        <group key={o} position={[cx + o, 0, s.z0 + 2.2]}>
          <WBox mat="yard" size={[2.8, 0.8, 0.9]} position={[0, 0.4, 0]} />
          <WBox mat="tile" size={[2.9, 0.06, 1.0]} position={[0, 0.83, 0]} />
        </group>
      ))}
      {/* 吊燈 */}
      {[-2.5, 2.5].map((o) => (
        <group key={o} position={[cx + o, s.h - 0.4, cz]}>
          <mesh>
            <coneGeometry args={[0.3, 0.2, 12, 1, true]} />
            <meshStandardMaterial color="#2f4a3a" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.08, 0]}>
            <sphereGeometry args={[0.08, 8, 6]} />
            <meshStandardMaterial color="#fff2c0" emissive="#ffd88a" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}
      <pointLight ref={lamp} position={[cx, s.h - 0.6, cz]} color="#ffd8a0" intensity={0} distance={9} decay={2} />
      {/* 棚子裡的保麗龍箱 */}
      <FoamStack x={s.x0 + 1.2} z={s.z1 - 1.0} n={4} />
      <FoamStack x={s.x0 + 2.1} z={s.z1 - 0.9} n={3} />
      <FoamStack x={s.x1 - 1.4} z={s.z1 - 1.1} n={2} />
    </group>
  )
}

/** 一面直立的浪板牆（寬 w、高 h；波紋是直的） */
function CorrugatedWall({ position, w, h, rotY = 0 }: { position: [number, number, number]; w: number; h: number; rotY?: number }) {
  const mat = useMemo(() => {
    const t = corrugatedTexture('#8aa0a4', 0.35).clone()
    t.needsUpdate = true
    t.repeat.set(w / 1.2, 1)
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide })
  }, [w])
  return (
    <mesh position={position} rotation-y={rotY} material={mat} castShadow receiveShadow>
      <boxGeometry args={[w, h, 0.04]} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 雜物：保麗龍箱、漁網堆、浮球、繫船柱、路燈
// ---------------------------------------------------------------------------

const foamMat = new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.95 })

function FoamStack({ x, z, n }: { x: number; z: number; n: number }) {
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} material={foamMat} position={[(i % 2) * 0.04, 0.17 + i * 0.34, 0]} rotation-y={(i % 3) * 0.05} castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.32, 0.55]} />
        </mesh>
      ))}
    </group>
  )
}

const netTex = canvasTexture(64, 64, (ctx, w, h) => {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.lineWidth = 2
  for (let i = -w; i < w * 2; i += 8) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + h, h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(i, h)
    ctx.lineTo(i + h, 0)
    ctx.stroke()
  }
})
netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping
netTex.repeat.set(3, 3)

export function QuayProps() {
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2e3236', roughness: 0.6, metalness: 0.5 }), [])
  const buoy = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8742a', roughness: 0.5 }), [])
  const crate = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f6fb8', roughness: 0.6 }), [])
  const r = useMemo(() => seeded(313), [])
  return (
    <group>
      {H.bollards.map((x) => (
        <group key={x} position={[x, 0, H.quayZ + 0.35]}>
          <mesh material={iron} position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.17, 0.44, 10]} />
          </mesh>
          <mesh material={iron} position={[0, 0.46, 0]}>
            <sphereGeometry args={[0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}
      {H.boxes.map((b, i) => (
        <FoamStack key={i} x={b.x} z={b.z} n={b.n} />
      ))}
      {H.nets.map((n, i) => (
        <mesh key={i} position={[n.x, 0.22, n.z]} scale={[0.75, 0.3, 0.6]} castShadow receiveShadow>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color={n.color} map={netTex} roughness={1} />
        </mesh>
      ))}
      {/* 浮球、塑膠籃 */}
      {[
        [-5.0, 2.2],
        [-4.7, 2.5],
        [9.3, 2.1],
        [14.1, 1.4],
      ].map(([x, z], i) => (
        <mesh key={i} material={buoy} position={[x, 0.18, z]} castShadow>
          <sphereGeometry args={[0.18 + r() * 0.05, 12, 10]} />
        </mesh>
      ))}
      {[
        [-7.5, 2.6],
        [12.6, 2.4],
      ].map(([x, z], i) => (
        <mesh key={i} material={crate} position={[x, 0.2, z]} rotation-y={0.3 * i} castShadow receiveShadow>
          <boxGeometry args={[0.6, 0.4, 0.45]} />
        </mesh>
      ))}
    </group>
  )
}

/** 路燈：鈉燈（橘黃色）；晚上前三盞會照亮碼頭 */
export function QuayLamps() {
  const head = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffa040', emissiveIntensity: 0, toneMapped: false }), [])
  const lights = useRef<(THREE.PointLight | null)[]>([])
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    head.emissiveIntensity = l * 2.2
    lights.current.forEach((p, i) => {
      // 最東邊那盞燈管快壞了，一閃一閃
      const flick = i === 2 ? (Math.sin(clock.elapsedTime * 13) > 0.85 ? 0.25 : 1) : 1
      if (p) p.intensity = l * 7 * flick
    })
  })
  const pole = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6a7074', roughness: 0.6, metalness: 0.5 }), [])
  return (
    <group userData={{ noMerge: true }}>
      {H.lamps.map((x, i) => (
        <group key={x} position={[x, 0, H.lampZ]}>
          <mesh material={pole} position={[0, 2.6, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.09, 5.2, 8]} />
          </mesh>
          <mesh material={pole} position={[0, 5.15, -0.45]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
          </mesh>
          <mesh material={head} position={[0, 5.05, -0.85]}>
            <boxGeometry args={[0.28, 0.12, 0.5]} />
          </mesh>
          {i < 3 && (
            <pointLight
              ref={(el) => {
                lights.current[i] = el
              }}
              position={[0, 4.8, -0.9]}
              color="#ffb060"
              intensity={0}
              distance={11}
              decay={2}
            />
          )}
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 鬼漁夫：晚上坐在碼頭邊，一個釣魚、一個補網（半透明，陰陽眼不用開也看得到）
// ---------------------------------------------------------------------------

export function Fishers({ outline }: { outline: boolean }) {
  const phase = useStore((s) => s.phase)
  if (phase !== 'night') return null
  return (
    <group userData={{ noMerge: true }}>
      <Fisher id="harborfisher1" f={H.fishers[0]} rod outline={outline} />
      <Fisher id="harborfisher2" f={H.fishers[1]} rod={false} outline={outline} />
    </group>
  )
}

/** 釣竿的尖端（線從這裡垂下去） */
const ROD_TIP = { y: 1.7, dz: -2.25 }

function Fisher({ id, f, rod, outline }: { id: string; f: (typeof H.fishers)[number]; rod: boolean; outline: boolean }) {
  const spec = SPECS[id]
  const drive = useRef<Drive>(newDrive({ pose: 'sit', heading: f.heading, expr: 'normal' }))
  const bob = useRef<THREE.Mesh>(null)
  const line = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const d = drive.current
    // 阿嬤靠近時轉頭看她一下
    const near = Math.hypot(player.x - f.x, player.z - f.z) < 2.6
    d.heading = near ? Math.atan2(player.x - f.x, player.z - f.z) : f.heading
    d.expr = near ? 'happy' : 'normal'
    const by = waterY(tideState.level) + 0.03 + Math.sin(clock.elapsedTime * 2.1) * 0.03
    if (bob.current) bob.current.position.y = by
    // 釣線：從竿尖垂到浮標（潮水退了線就長一點）
    if (line.current) {
      const len = ROD_TIP.y - by
      line.current.scale.y = len
      line.current.position.y = by + len / 2
    }
  })
  // 補網的阿伯坐在塑膠籃上；釣魚的阿伯坐在碼頭邊
  const seat = 0.03 - SEAT_Y * spec.scale + 0.02 + (rod ? 0 : 0.4)
  return (
    <group>
      <group position={[f.x, seat, f.z]}>
        <Chibi spec={spec} drive={drive} legs={false} outline={outline} />
      </group>
      {rod ? (
        <group>
          {/* 釣竿從手上斜斜伸到海面上，一條線垂到浮標 */}
          <mesh position={[f.x, 0.95, f.z - 1.2]} rotation={[-0.95, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.025, 2.6, 5]} />
            <meshStandardMaterial color="#c8b078" transparent opacity={0.7} />
          </mesh>
          <mesh ref={line} position={[f.x, 0, f.z + ROD_TIP.dz]}>
            <cylinderGeometry args={[0.004, 0.004, 1, 3]} />
            <meshBasicMaterial color="#e8e4d8" transparent opacity={0.6} />
          </mesh>
          <mesh ref={bob} position={[f.x, -1, f.z + ROD_TIP.dz]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshStandardMaterial color="#ff5a3a" emissive="#ff5a3a" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ) : (
        <group>
          <mesh position={[f.x, 0.2, f.z]} castShadow>
            <boxGeometry args={[0.5, 0.4, 0.4]} />
            <meshStandardMaterial color="#2f6fb8" roughness={0.6} />
          </mesh>
          <mesh position={[f.x - 0.7, 0.14, f.z + 0.2]} scale={[0.6, 0.2, 0.5]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#3f8a5a" map={netTex} transparent opacity={0.75} roughness={1} />
          </mesh>
        </group>
      )}
    </group>
  )
}
