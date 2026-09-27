import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio'
import { player } from '../world/player'
import { GHOST_RIDE, GT, GT_PASSENGERS, GT_STORIES, RIDE_HOURS, ticketTier } from '../world/sceneGhostTrain'
import { BRUSH_FONT, canvasTexture, planeGeo, seeded, useMats } from './kit'
import { MergeStatic } from './MergeStatic'
import { Chibi, ChibiNpc, SEAT_Y, newDrive, type Drive, type PoseName } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import '../chars/specs.station2'

// 鬼火車的車廂（DESIGN §32.4）：三節相連，黃黃的壁燈；北邊一整排窗，窗外的甘蔗田、電線桿一直往後跑。
// 南邊的牆只到腰（剖開來看）。坐一段時間車就慢慢停下來，最後一節的車門打開：下車就是阿春民宿前。
// 規則、碰撞、熱點、這一趟的狀態（GHOST_RIDE）在 src/world/sceneGhostTrain.ts。

const P = GT_PASSENGERS
/** 車速（公尺／秒）與停車花的時間（秒） */
const SPEED = 9
const STOP_SEC = 4
/** 停下來的時候，臨時月台的站牌停在下車的門口 */
const STOP_X = (GT.exitDoor.x0 + GT.exitDoor.x1) / 2

/** 這一趟跑了多快（0..1）；停車時從 1 慢慢降到 0（畫面共用） */
const ride = { speed: 1, stopT: -1, dist: 0 }

export function GhostTrainScene() {
  const quality = useStore((s) => s.quality)
  const outline = quality === 'high'
  useRide()
  return (
    <group>
      <Outside quality={quality} />
      <MergeStatic>
        <Carriages />
      </MergeStatic>
      <ExitDoor />
      <Sconces />
      <Passengers outline={outline} />
      <ArrivalPlatform />
      <TrainSound />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 這一趟：上車的時間、到站（停車、開門）、車掌的話
// ---------------------------------------------------------------------------

function useRide() {
  useEffect(() => {
    const s = useStore.getState()
    if (Number.isNaN(GHOST_RIDE.boardedAt)) GHOST_RIDE.boardedAt = s.time
    GHOST_RIDE.arrived = false
    GHOST_RIDE.announced = false
    GHOST_RIDE.nudged = false
    ride.speed = 1
    ride.stopT = -1
    const timers: number[] = []
    if (!s.flags.gt_ticket_seen) {
      // 第一次坐：先看看車廂，車掌就過來看票
      timers.push(window.setTimeout(() => useStore.getState().bark('st2.gt.arrive'), 1200))
      timers.push(
        window.setTimeout(() => {
          const st = useStore.getState()
          if (st.scene === 'ghosttrain' && !st.dialogue && !st.flags.gt_ticket_seen) st.startDialogue(`st2_ticket_${ticketTier(st.meta.memories.length)}`)
        }, 5200),
      )
    } else timers.push(window.setTimeout(() => useStore.getState().bark('st2.ticket.again'), 1200))
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      GHOST_RIDE.boardedAt = Number.NaN
      GHOST_RIDE.arrived = false
      GHOST_RIDE.announced = false
      GHOST_RIDE.nudged = false
    }
  }, [])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    if (s.scene !== 'ghosttrain') return
    const onBoard = s.time - GHOST_RIDE.boardedAt
    // 坐夠了：車掌廣播，車慢慢停下來
    if (!GHOST_RIDE.announced && onBoard >= RIDE_HOURS && !s.dialogue) {
      GHOST_RIDE.announced = true
      ride.stopT = 0
      s.bark('st2.gt.next')
      if (GT_STORIES.every((f) => s.flags[f]) && !s.flags.gt_all)
        window.setTimeout(() => {
          const st = useStore.getState()
          useStore.setState({ flags: { ...st.flags, gt_all: true }, meta: { ...st.meta, merit: st.meta.merit + 1 } })
          st.bark('st2.gt.all')
        }, 5200)
    }
    if (ride.stopT >= 0 && ride.stopT < STOP_SEC) {
      ride.stopT = Math.min(STOP_SEC, ride.stopT + dt)
      const k = ride.stopT / STOP_SEC
      ride.speed = 1 - k
      if (k >= 1) {
        GHOST_RIDE.arrived = true
        horn()
      }
    }
    ride.dist += SPEED * ride.speed * dt
    if (GHOST_RIDE.arrived && !GHOST_RIDE.nudged && onBoard >= RIDE_HOURS + 0.45) {
      GHOST_RIDE.nudged = true
      s.bark('st2.gt.nudge')
    }
  }, -2)
}

// ---------------------------------------------------------------------------
// 車廂：地板、北牆（一排窗）、南邊到腰的矮牆、兩頭與車廂之間的牆、長椅、行李架
// ---------------------------------------------------------------------------

function useCarMats() {
  const mats = useMats()
  return useMemo(() => {
    const floor = mats.wood.clone()
    floor.color.set('#7a5a3e')
    return {
      floor,
      lower: new THREE.MeshStandardMaterial({ color: '#5f7f6a', roughness: 0.7 }),
      upper: new THREE.MeshStandardMaterial({ color: '#e6ddc4', roughness: 0.8 }),
      trim: new THREE.MeshStandardMaterial({ color: '#5a3e28', roughness: 0.6 }),
      seat: new THREE.MeshStandardMaterial({ color: '#3d6b5a', roughness: 0.55 }),
      rack: new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.4, metalness: 0.6 }),
      bellows: new THREE.MeshStandardMaterial({ color: '#1e1c1a', roughness: 0.9 }),
      glass: new THREE.MeshStandardMaterial({ color: '#b8d8e0', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.1, depthWrite: false }),
    }
  }, [mats])
}

/** 一節車廂的窗戶中心（x） */
const windowsOf = (c: { x0: number; x1: number }) => Array.from({ length: 4 }, (_, i) => c.x0 + ((i + 0.5) * (c.x1 - c.x0)) / 4)
const WIN_W = 1.3

function Carriages() {
  const m = useCarMats()
  const W = GT.wall
  const zN = GT.z0 - W / 2
  const x0 = GT.cars[0].x0
  const x1 = GT.cars[2].x1
  return (
    <group>
      {/* 地板（整列，車廂之間的通道也是） */}
      <mesh geometry={planeGeo(x1 - x0 + 0.4, GT.z1 - GT.z0 + 0.4, 1.4)} material={m.floor} rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, 0.0, 0]} receiveShadow />
      {GT.cars.map((c, ci) => {
        const len = c.x1 - c.x0
        const cx = (c.x0 + c.x1) / 2
        const wins = windowsOf(c)
        const pieces: [number, number][] = []
        let cur = c.x0
        for (const w of wins) {
          pieces.push([cur, w - WIN_W / 2])
          cur = w + WIN_W / 2
        }
        pieces.push([cur, c.x1])
        return (
          <group key={ci}>
            {/* 北牆：窗下綠、窗上米色、窗與窗之間的柱 */}
            <mesh material={m.lower} position={[cx, GT.winY0 / 2, zN]} castShadow receiveShadow>
              <boxGeometry args={[len, GT.winY0, W]} />
            </mesh>
            <mesh material={m.upper} position={[cx, (GT.winY1 + GT.wallH) / 2, zN]} castShadow>
              <boxGeometry args={[len, GT.wallH - GT.winY1, W]} />
            </mesh>
            {pieces.map(([a, b]) => (
              <mesh key={a} material={m.upper} position={[(a + b) / 2, (GT.winY0 + GT.winY1) / 2, zN]}>
                <boxGeometry args={[b - a, GT.winY1 - GT.winY0, W]} />
              </mesh>
            ))}
            {/* 窗框、淡淡的玻璃（下半扇拉起來了） */}
            {wins.map((x) => (
              <group key={x}>
                <mesh material={m.trim} position={[x, GT.winY0 - 0.03, zN + W / 2 + 0.02]}>
                  <boxGeometry args={[WIN_W + 0.08, 0.06, 0.12]} />
                </mesh>
                <mesh material={m.trim} position={[x, (GT.winY0 + GT.winY1) / 2, zN + W / 2]}>
                  <boxGeometry args={[WIN_W, 0.04, 0.04]} />
                </mesh>
                <mesh material={m.glass} position={[x, GT.winY1 - (GT.winY1 - GT.winY0) / 4, zN]}>
                  <planeGeometry args={[WIN_W, (GT.winY1 - GT.winY0) / 2]} />
                </mesh>
              </group>
            ))}
            {/* 北牆頂的木頭收邊 */}
            <mesh material={m.trim} position={[cx, GT.wallH, zN + 0.05]}>
              <boxGeometry args={[len, 0.1, W + 0.12]} />
            </mesh>
            {/* 北邊的長椅：坐墊＋靠背 */}
            <mesh material={m.seat} position={[cx, GT.benchY - 0.08, GT.z0 + GT.bench / 2 + 0.02]} castShadow receiveShadow>
              <boxGeometry args={[len - 0.5, 0.16, GT.bench - 0.04]} />
            </mesh>
            <mesh material={m.trim} position={[cx, (GT.benchY - 0.16) / 2, GT.z0 + GT.bench / 2]}>
              <boxGeometry args={[len - 0.6, GT.benchY - 0.16, GT.bench - 0.12]} />
            </mesh>
            <mesh material={m.seat} position={[cx, GT.benchY + 0.3, GT.z0 + 0.08]} castShadow>
              <boxGeometry args={[len - 0.5, 0.5, 0.1]} />
            </mesh>
            {/* 行李架 */}
            <mesh material={m.rack} position={[cx, 2.08, GT.z0 + 0.25]}>
              <boxGeometry args={[len - 0.7, 0.03, 0.42]} />
            </mesh>
            <mesh material={m.rack} position={[cx, 2.12, GT.z0 + 0.46]}>
              <boxGeometry args={[len - 0.7, 0.03, 0.03]} />
            </mesh>
          </group>
        )
      })}
      {/* 南邊的長椅（背對鏡頭）＋到腰的矮牆（上下車的門口空出來） */}
      <SouthSide />
      {/* 兩頭的牆、車廂之間的牆（中間是通道）與蛇腹 */}
      {[x0 - W / 2, x1 + W / 2].map((x) => (
        <mesh key={x} material={m.upper} position={[x, GT.wallH / 2, 0]} castShadow>
          <boxGeometry args={[W, GT.wallH, GT.z1 - GT.z0 + 2 * W]} />
        </mesh>
      ))}
      {[GT.cars[0].x1, GT.cars[1].x1].map((gx) => (
        <group key={gx}>
          {[-1, 1].map((s) => (
            <mesh key={s} material={m.upper} position={[gx + 0.3, GT.wallH / 2, s * ((GT.z1 + GT.gang) / 2)]} castShadow>
              <boxGeometry args={[0.6, GT.wallH, GT.z1 - GT.gang]} />
            </mesh>
          ))}
          <mesh material={m.upper} position={[gx + 0.3, (2.1 + GT.wallH) / 2, 0]}>
            <boxGeometry args={[0.6, GT.wallH - 2.1, GT.gang * 2]} />
          </mesh>
          <mesh material={m.bellows} position={[gx + 0.3, 1.05, -GT.gang - 0.02]}>
            <boxGeometry args={[0.62, 2.1, 0.04]} />
          </mesh>
        </group>
      ))}
      <Luggage />
    </group>
  )
}

function SouthSide() {
  const m = useCarMats()
  const zS = GT.z1 + GT.wall / 2
  // 矮牆與南長椅：避開上車門（第一節西邊）、下車門（第三節東邊）
  const spans: [number, number][] = [
    [GT.boardDoor.x1, GT.cars[0].x1],
    [GT.cars[1].x0, GT.cars[1].x1],
    [GT.cars[2].x0, GT.exitDoor.x0],
  ]
  const walls: [number, number][] = [
    [GT.cars[0].x0 - 0.1, GT.boardDoor.x0],
    [GT.boardDoor.x1, GT.exitDoor.x0],
    [GT.exitDoor.x1, GT.cars[2].x1 + 0.1],
  ]
  return (
    <group>
      {walls.map(([a, b]) => (
        <group key={a}>
          <mesh material={m.lower} position={[(a + b) / 2, GT.lowWall / 2, zS]} castShadow receiveShadow>
            <boxGeometry args={[b - a, GT.lowWall, GT.wall]} />
          </mesh>
          <mesh material={m.trim} position={[(a + b) / 2, GT.lowWall + 0.03, zS]}>
            <boxGeometry args={[b - a, 0.06, GT.wall + 0.1]} />
          </mesh>
        </group>
      ))}
      {spans.map(([a, b]) => (
        <group key={a}>
          <mesh material={m.seat} position={[(a + b) / 2 + 0.0, GT.benchY - 0.08, GT.z1 - GT.bench / 2 - 0.02]} castShadow receiveShadow>
            <boxGeometry args={[b - a - 0.5, 0.16, GT.bench - 0.04]} />
          </mesh>
          <mesh material={m.trim} position={[(a + b) / 2, (GT.benchY - 0.16) / 2, GT.z1 - GT.bench / 2]}>
            <boxGeometry args={[b - a - 0.6, GT.benchY - 0.16, GT.bench - 0.12]} />
          </mesh>
          <mesh material={m.seat} position={[(a + b) / 2, GT.benchY + 0.22, GT.z1 - 0.08]} castShadow>
            <boxGeometry args={[b - a - 0.5, 0.36, 0.1]} />
          </mesh>
        </group>
      ))}
      {/* 上車的門：滑開著 */}
      <mesh material={m.lower} position={[GT.boardDoor.x0 - 0.35, 1.05, zS + 0.12]}>
        <boxGeometry args={[0.7, 2.1, 0.06]} />
      </mesh>
    </group>
  )
}

/** 行李架上的東西：皮箱、包袱、斗笠、竹籃 */
function Luggage() {
  const items = useMemo(() => {
    const r = seeded(4242)
    const out: { x: number; kind: number; c: string }[] = []
    for (const c of GT.cars)
      for (let x = c.x0 + 0.7; x < c.x1 - 0.6; x += 1.1 + r() * 0.9) out.push({ x, kind: Math.floor(r() * 4), c: ['#7a3a2a', '#2e4a6a', '#c9b48a', '#8a6a3a'][Math.floor(r() * 4)] })
    return out
  }, [])
  return (
    <group>
      {items.map((it, i) => {
        const y = 2.1
        const z = GT.z0 + 0.26
        if (it.kind === 0)
          return (
            <mesh key={i} position={[it.x, y + 0.14, z]} castShadow>
              <boxGeometry args={[0.55, 0.26, 0.34]} />
              <meshStandardMaterial color={it.c} roughness={0.6} />
            </mesh>
          )
        if (it.kind === 1)
          return (
            <mesh key={i} position={[it.x, y + 0.14, z]} scale={[1, 0.7, 0.8]} castShadow>
              <sphereGeometry args={[0.24, 10, 8]} />
              <meshStandardMaterial color="#b84a4a" roughness={0.9} />
            </mesh>
          )
        if (it.kind === 2)
          return (
            <mesh key={i} position={[it.x, y + 0.08, z]} castShadow>
              <coneGeometry args={[0.3, 0.14, 14]} />
              <meshStandardMaterial color="#d8c27a" roughness={0.9} />
            </mesh>
          )
        return (
          <mesh key={i} position={[it.x, y + 0.12, z]} castShadow>
            <cylinderGeometry args={[0.2, 0.16, 0.22, 10]} />
            <meshStandardMaterial color="#a88a52" roughness={0.9} />
          </mesh>
        )
      })}
    </group>
  )
}

/** 下車的門：到站以後滑開 */
function ExitDoor() {
  const m = useCarMats()
  const ref = useRef<THREE.Mesh>(null)
  const zS = GT.z1 + GT.wall / 2 + 0.12
  const w = GT.exitDoor.x1 - GT.exitDoor.x0
  useFrame((_, dt) => {
    const d = ref.current
    if (!d) return
    const want = GHOST_RIDE.arrived ? GT.exitDoor.x1 + w / 2 : (GT.exitDoor.x0 + GT.exitDoor.x1) / 2
    d.position.x += (want - d.position.x) * Math.min(1, dt * 3)
  })
  return (
    <mesh ref={ref} material={m.lower} position={[(GT.exitDoor.x0 + GT.exitDoor.x1) / 2, 1.05, zS]}>
      <boxGeometry args={[w, 2.1, 0.06]} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 燈：北牆頂的壁燈（黃黃的，偶爾閃一下）＋跟著阿嬤的暖光
// ---------------------------------------------------------------------------

function Sconces() {
  const bulb = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffc870', emissiveIntensity: 1.8, roughness: 0.4 }), [])
  const shade = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8b48a', roughness: 0.6, side: THREE.DoubleSide }), [])
  const light = useRef<THREE.PointLight>(null)
  const spots = useMemo(() => GT.cars.flatMap((c) => [0.2, 0.5, 0.8].map((k) => c.x0 + k * (c.x1 - c.x0))), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flick = Math.sin(t * 17) > 0.97 ? 0.55 : 1
    bulb.emissiveIntensity = 1.8 * flick
    if (light.current) {
      light.current.position.set(THREE.MathUtils.clamp(player.x, GT.cars[0].x0 + 1, GT.cars[2].x1 - 1), 2.3, 0.2)
      light.current.intensity = 5.5 * flick
    }
  })
  return (
    <group userData={{ noMerge: true }}>
      {spots.map((x) => (
        <group key={x} position={[x, 2.28, GT.z0 + 0.16]}>
          <mesh material={shade}>
            <coneGeometry args={[0.16, 0.14, 14, 1, true]} />
          </mesh>
          <mesh material={bulb} position={[0, -0.05, 0]}>
            <sphereGeometry args={[0.06, 10, 8]} />
          </mesh>
        </group>
      ))}
      <pointLight ref={light} color="#ffcf8a" intensity={5} distance={9} decay={1.6} />
      <hemisphereLight args={['#ffe2b0', '#20242c', 0.35]} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 乘客：坐在長椅上（車掌站在第一節的走道）
// ---------------------------------------------------------------------------

function Passengers({ outline }: { outline: boolean }) {
  return (
    <group>
      <ChibiNpc id="conductor" pose="clasp" position={[P.conductor.x, 0.02, P.conductor.z]} heading={-1.3} seesGhosts outline={outline} />
      <Seated id="ghost_student" at={P.student} pose="sit" asleep outline={outline} />
      <Seated id="ghost_farmer" at={P.farmer} pose="fan" outline={outline} />
      <Seated id="gt_mother" at={P.mother} pose="clasp" outline={outline} prop="sling" />
      <Seated id="ghost_bride" at={P.lady} pose="sit" outline={outline} prop="suitcase" />
      <Seated id="gt_teacher" at={P.teacher} pose="sit" outline={outline} prop="papers" />
      <Seated id="gt_groom" at={P.groom} pose="sit" outline={outline} lean={-0.12} />
      <Seated id="gt_bride" at={P.bride} pose="sit" outline={outline} lean={0.18} />
      <Seated id="ghost_soldier" at={P.soldier} pose="sit" outline={outline} prop="pack" />
    </group>
  )
}

/** 坐著的乘客：看得到阿嬤，靠近時轉頭看她；南邊的長椅面向北 */
function Seated({ id, at, pose, outline, asleep, lean = 0, prop }: { id: string; at: { x: number; z: number }; pose: PoseName; outline: boolean; asleep?: boolean; lean?: number; prop?: 'sling' | 'papers' | 'pack' | 'suitcase' }) {
  const spec = SPECS[id]
  const south = at.z > 0
  const base = south ? Math.PI : 0
  const drive = useRef<Drive>(newDrive({ pose, heading: base + lean, expr: asleep ? 'sleep' : 'normal' }))
  useFrame(({ clock }) => {
    const d = drive.current
    if (asleep) {
      d.heading = base + Math.sin(clock.elapsedTime * 0.8) * 0.05
      return
    }
    const dx = player.x - at.x
    const dz = player.z - at.z
    const want = Math.hypot(dx, dz) < 2.6 ? Math.atan2(dx, dz) : base + lean
    d.heading += (want - d.heading) * 0.08
  })
  if (!spec) return null
  const y = GT.benchY - SEAT_Y * spec.scale + 0.03
  return (
    <group>
      <group position={[at.x, y, at.z + (south ? -0.05 : 0.05)]}>
        <Chibi spec={spec} drive={drive} outline={outline} legs={false} />
      </group>
      {prop && <SeatProp kind={prop} x={at.x} z={at.z} />}
    </group>
  )
}

function SeatProp({ kind, x, z }: { kind: 'sling' | 'papers' | 'pack' | 'suitcase'; x: number; z: number }) {
  const sling = useMemo(
    () =>
      canvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#c85a4a'
        ctx.fillRect(0, 0, w, h)
        const r = seeded(33)
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = ['#f4d27a', '#f4efe2', '#6a9a6a'][i % 3]
          ctx.beginPath()
          ctx.arc(r() * w, r() * h, 3 + r() * 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }),
    [],
  )
  const y = GT.benchY
  if (kind === 'sling')
    // 空的背巾：摺成一包抱在懷裡
    return (
      <mesh position={[x, y + 0.34, z + 0.26]} rotation={[0.3, 0, 0]} scale={[1, 0.75, 0.7]} castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial map={sling} roughness={0.9} />
      </mesh>
    )
  if (kind === 'papers')
    return (
      <group position={[x + 0.02, y + 0.2, z + 0.28]} rotation={[-0.9, 0, 0.1]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[i * 0.01, i * 0.012, 0]}>
            <boxGeometry args={[0.3, 0.008, 0.4]} />
            <meshStandardMaterial color="#f4efe2" roughness={0.95} />
          </mesh>
        ))}
        <mesh position={[0.1, 0.06, 0.05]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.16, 6]} />
          <meshStandardMaterial color="#c8322a" />
        </mesh>
      </group>
    )
  if (kind === 'pack')
    // 阿兵哥的綠色背包，放在旁邊的位子
    return (
      <mesh position={[x + 0.62, y + 0.2, z + 0.02]} castShadow>
        <boxGeometry args={[0.42, 0.4, 0.3]} />
        <meshStandardMaterial color="#56643e" roughness={0.9} />
      </mesh>
    )
  return (
    <mesh position={[x + 0.5, 0.2, z - 0.55]} castShadow>
      <boxGeometry args={[0.5, 0.38, 0.2]} />
      <meshStandardMaterial color="#9a4a3a" roughness={0.6} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 窗外：往後跑的甘蔗田（貼圖捲動）、電線桿、遠處的燈、螢火蟲；停車時一起慢下來
// ---------------------------------------------------------------------------

function fieldTexture() {
  const t = canvasTexture(512, 512, (ctx, w, h) => {
    const r = seeded(99)
    ctx.fillStyle = '#1c2a1c'
    ctx.fillRect(0, 0, w, h)
    // 一壟一壟的甘蔗田（沿 x）
    for (let y = 0; y < h; y += 16) {
      ctx.fillStyle = `rgba(${60 + r() * 30},${90 + r() * 30},${50 + r() * 20},0.38)`
      ctx.fillRect(0, y, w, 9)
    }
    // 田埂、小路
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(120,100,70,0.45)'
      ctx.fillRect(r() * w, 0, 10 + r() * 8, h)
    }
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(20,30,20,${0.3 + r() * 0.4})`
      ctx.fillRect(r() * w, r() * h, 6 + r() * 20, 3 + r() * 6)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function ballastTexture() {
  const t = canvasTexture(256, 128, (ctx, w, h) => {
    const r = seeded(7)
    ctx.fillStyle = '#3a3834'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 900; i++) {
      const c = 40 + r() * 50
      ctx.fillStyle = `rgb(${c},${c - 2},${c - 6})`
      ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3)
    }
    // 枕木
    for (let x = 0; x < w; x += 42) {
      ctx.fillStyle = '#2a2018'
      ctx.fillRect(x, 10, 16, h - 20)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

const FIELD_TILE = 18

function Outside({ quality }: { quality: 'high' | 'low' }) {
  const fieldMat = useMemo(() => new THREE.MeshStandardMaterial({ map: fieldTexture(), roughness: 1 }), [])
  const ballMat = useMemo(() => new THREE.MeshStandardMaterial({ map: ballastTexture(), roughness: 1 }), [])
  const north = useMemo(() => {
    const g = new THREE.PlaneGeometry(140, 40)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * 140) / FIELD_TILE, (uv.getY(k) * 40) / FIELD_TILE)
    return g
  }, [])
  const ballast = useMemo(() => {
    const g = new THREE.PlaneGeometry(140, 2.4)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * 140) / 6, uv.getY(k))
    return g
  }, [])
  const poles = useRef<THREE.InstancedMesh>(null)
  const lights = useRef<(THREE.Sprite | null)[]>([])
  const glow = useMemo(
    () =>
      canvasTexture(64, 64, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
        g.addColorStop(0, 'rgba(255,230,170,1)')
        g.addColorStop(1, 'rgba(255,200,120,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }),
    [],
  )
  const poleSpots = useMemo(() => [...Array.from({ length: 8 }, (_, i) => ({ x: -42 + i * 11, z: -4.2 })), ...Array.from({ length: 6 }, (_, i) => ({ x: -40 + i * 14, z: 4.6 }))], [])
  const farLights = useMemo(() => {
    const r = seeded(512)
    return Array.from({ length: 10 }, () => ({ x: -60 + r() * 120, z: -16 - r() * 16, s: 0.5 + r() * 0.6 }))
  }, [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  useFrame(() => {
    const d = ride.dist
    fieldMat.map!.offset.x = d / FIELD_TILE
    ballMat.map!.offset.x = d / 6
    const P = poles.current
    if (P) {
      poleSpots.forEach((p, i) => {
        let x = p.x - (d % 88)
        if (x < -46) x += 88
        m4.makeTranslation(x, 1.6, p.z)
        P.setMatrixAt(i, m4)
      })
      P.instanceMatrix.needsUpdate = true
    }
    lights.current.forEach((sp, i) => {
      if (!sp) return
      const f = farLights[i]
      let x = f.x - ((d * 0.25) % 120)
      if (x < -60) x += 120
      sp.position.set(x, -0.2, f.z)
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {/* 北邊（窗外）與南邊（鏡頭這邊）的田，比車廂地板低一點 */}
      <mesh geometry={north} material={fieldMat} rotation-x={-Math.PI / 2} position={[0, -0.9, -21.9]} />
      <mesh geometry={north} material={fieldMat} rotation-x={-Math.PI / 2} position={[0, -0.9, 23.3]} />
      <mesh geometry={ballast} material={ballMat} rotation-x={-Math.PI / 2} position={[0, -0.55, 2.9]} />
      <mesh geometry={ballast} material={ballMat} rotation-x={-Math.PI / 2} position={[0, -0.55, -2.9]} />
      {/* 車身的外側：車廂底下的暗色裙板 */}
      <mesh position={[0, -0.3, GT.z1 + GT.wall + 0.02]}>
        <boxGeometry args={[GT.cars[2].x1 - GT.cars[0].x0 + 0.6, 0.6, 0.04]} />
        <meshStandardMaterial color="#1d2a3a" roughness={0.7} />
      </mesh>
      <instancedMesh ref={poles} args={[undefined, undefined, poleSpots.length]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 5, 6]} />
        <meshStandardMaterial color="#3a2e24" roughness={0.9} />
      </instancedMesh>
      {farLights.map((f, i) => (
        <sprite
          key={i}
          ref={(el) => {
            lights.current[i] = el
          }}
          scale={[f.s, f.s, 1]}
        >
          <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
      <Sparkles count={quality === 'high' ? 40 : 20} scale={[40, 2, 5]} position={[0, 0.6, -5]} size={3} speed={0.6} color="#e8ff8a" opacity={0.8} noise={1.2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 到站：南邊滑進來一段臨時月台＋站牌「阿春民宿前」，停在下車的門口
// ---------------------------------------------------------------------------

function stopSignTexture() {
  return canvasTexture(
    512,
    200,
    (ctx, w, h) => {
      ctx.fillStyle = '#f7f4ea'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#6a2a2a'
      ctx.lineWidth = 10
      ctx.strokeRect(8, 8, w - 16, h - 16)
      ctx.fillStyle = '#6a2a2a'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `700 72px ${BRUSH_FONT}`
      ctx.fillText('阿春民宿前', w / 2, h / 2 - 12)
      ctx.font = `500 28px ${BRUSH_FONT}`
      ctx.fillText('（臨時停靠）', w / 2, h - 34)
    },
    [{ spec: `700 72px ${BRUSH_FONT}`, text: '阿春民宿前臨時停靠' }],
  )
}

function ArrivalPlatform() {
  const g = useRef<THREE.Group>(null)
  const tex = useMemo(stopSignTexture, [])
  const D = (SPEED * STOP_SEC) / 2
  useFrame(() => {
    const grp = g.current
    if (!grp) return
    if (ride.stopT < 0) {
      grp.visible = false
      return
    }
    grp.visible = true
    const k = ride.stopT / STOP_SEC
    grp.position.x = STOP_X + D * (1 - k) * (1 - k)
  })
  return (
    <group ref={g} visible={false} position={[STOP_X + D, 0, 0]}>
      <mesh position={[0, -0.28, 3.1]} receiveShadow>
        <boxGeometry args={[7, 0.5, 2.4]} />
        <meshStandardMaterial color="#8a8680" roughness={0.9} />
      </mesh>
      <group position={[-1.6, 0, 3.4]}>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 0.75, 0]}>
            <boxGeometry args={[0.07, 1.5, 0.07]} />
            <meshStandardMaterial color="#3f3b36" />
          </mesh>
        ))}
        <mesh position={[0, 1.35, 0.04]}>
          <planeGeometry args={[1.6, 0.62]} />
          <meshStandardMaterial map={tex} roughness={0.7} emissive="#fff1d0" emissiveIntensity={0.25} emissiveMap={tex} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 聲音：鐵軌接縫的「喀噹、喀噹」（跑越慢間隔越長）、低低的轟隆聲、到站的汽笛
// ---------------------------------------------------------------------------

function clack(vol: number) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  for (const dt of [0, 0.13]) {
    const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate)
    const d = n.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3)
    const src = ctx.createBufferSource()
    src.buffer = n
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 900
    bp.Q.value = 1.2
    const g = ctx.createGain()
    g.gain.value = vol
    src.connect(bp).connect(g).connect(audio.bus.sfx)
    src.start(t + dt)
  }
}

function horn() {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.1, t + 0.08)
  g.gain.setValueAtTime(0.1, t + 0.7)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  for (const f of [311, 392]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    o.connect(lp)
    o.start(t)
    o.stop(t + 1)
  }
  lp.connect(g).connect(audio.bus.sfx)
}

function TrainSound() {
  const lastJoint = useRef(0)
  const rumble = useRef<{ src: AudioBufferSourceNode; gain: GainNode } | null>(null)
  useEffect(() => {
    const ctx = audio.ctx
    if (!ctx) return
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03
      d[i] = last * 6
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 160
    const gain = ctx.createGain()
    gain.gain.value = 0.0
    src.connect(lp).connect(gain).connect(audio.bus.sfx)
    src.start()
    rumble.current = { src, gain }
    return () => {
      try {
        src.stop()
      } catch {
        /* 已經停了 */
      }
      rumble.current = null
    }
  }, [])
  useFrame(() => {
    const r = rumble.current
    if (r && audio.ctx) r.gain.gain.setTargetAtTime(0.12 * ride.speed, audio.ctx.currentTime, 0.2)
    // 每 12 公尺一個鐵軌接縫
    if (ride.dist - lastJoint.current >= 12) {
      lastJoint.current = ride.dist
      if (ride.speed > 0.08) clack(0.07 + 0.05 * ride.speed)
    }
  })
  return null
}
