import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, type Quality } from '../store'
import { STATION, arrivingGuests } from '../world/sceneStation'
import { lanternAt } from './daylight'
import { BRUSH_FONT, canvasTexture, seeded } from './kit'
import { MergeStatic } from './MergeStatic'
import { buildGrass } from './Landscape'
import { ChibiNpc, type PoseName } from '../chars/Chibi'
import { Canopy, CaneFields, CaneTrain, Platform, SignalPosts, StationGrounds, StationHall, StationHouse, Tracks, WaterTower } from './StationProps'
import { GhostTrain } from './StationTrain'
import type { GuestId } from '../world/night/types'
import '../chars/specs.station'

// 小火車站＋五分車（DESIGN §27.1）：無人小站「後壁厝站」。北邊是站房與甘蔗田，南邊（鏡頭這一側）只有月台、鐵軌、碎石。
// 傍晚：今晚的客人在月台上（剛下車）；半夜 00:00：末班鬼火車進站（StationTrain.tsx）。規則與座標在 src/world/sceneStation.ts。

const S = STATION

export function StationScene() {
  const quality = useStore((s) => s.quality)
  const isNight = useStore((s) => s.isNight)
  return (
    <group>
      <StationGrounds />
      <Greenery quality={quality} />
      <CaneFields quality={quality} />
      <Tracks />
      <MergeStatic>
        <StationHall />
        <Platform />
        <WaterTower />
        <CaneTrain />
        <SignalPosts />
      </MergeStatic>
      <Fader id="station_house">
        <StationHouse />
        <StationClock />
      </Fader>
      <Fader id="station_canopy">
        <Canopy />
      </Fader>
      <StationLights />
      <Arrivals outline={quality === 'high'} />
      <GhostTrain outline={quality === 'high'} />
      <group visible={isNight}>
        <Sparkles count={40} scale={[60, 2, 8]} position={[0, 1.2, -9]} size={3.5} speed={0.3} color="#e8ff8a" opacity={0.9} noise={1.4} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 草地：路邊與月台南邊的矮草（北邊是甘蔗田，不長草）
// ---------------------------------------------------------------------------

function stationGround(x: number, z: number): 'grass' | null {
  if (z < -9.8) return null // 甘蔗田
  if (Math.abs(z - S.roadZ) < S.roadWidth / 2 + 0.2) return null // 路
  if (x > S.house.x0 - 1.2 && x < S.house.x1 + 1.2 && z > S.house.z0 - 0.5 && z < S.platform.z1 + 0.2) return null
  if (z > S.platform.z0 - 0.1 && z < S.trackZ + 1.4) return null // 月台、道床
  if (x < S.siding.x1 + 1 && x > S.siding.x0 - 4 && Math.abs(z - S.siding.z) < 1.2) return null
  return 'grass'
}

function Greenery({ quality }: { quality: Quality }) {
  const grass = useMemo(() => buildGrass(quality, { ground: stationGround, rMin: 1, rSpan: 26, seed: 7373, scale: 0.8 }), [quality])
  return (
    <group>
      <primitive object={grass.grass} />
      <primitive object={grass.flowers} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 站房的大鐘：傍晚走得好好的；半夜一過 23:30 就停在十二點（末班車要來了）
// ---------------------------------------------------------------------------

function clockFace() {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#f7f1dd'
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, 120, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#2a2420'
      ctx.lineWidth = 10
      ctx.stroke()
      ctx.fillStyle = '#2a2420'
      ctx.font = `700 34px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let i = 1; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2
        ctx.fillText(String(i), w / 2 + Math.sin(a) * 92, h / 2 - Math.cos(a) * 92)
      }
    },
    [{ spec: `700 34px ${BRUSH_FONT}`, text: '123456789' }],
  )
}

function StationClock() {
  const face = useMemo(clockFace, [])
  const hour = useRef<THREE.Group>(null)
  const minute = useRef<THREE.Group>(null)
  useFrame(() => {
    const s = useStore.getState()
    // 23:30 到 00:48：鐘停在十二點整
    const stuck = s.phase === 'night' && s.time >= 23.5 && s.time < 24.8
    const t = stuck ? 24 : s.time
    const h = t % 12
    const m = t % 1
    if (hour.current) hour.current.rotation.z = -(h / 12) * Math.PI * 2
    if (minute.current) minute.current.rotation.z = -m * Math.PI * 2
  })
  return (
    <group position={[0, 3.35, S.house.z1 + 0.22]}>
      <mesh>
        <circleGeometry args={[0.36, 32]} />
        <meshStandardMaterial map={face} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, -0.03]}>
        <cylinderGeometry args={[0.4, 0.4, 0.06, 32]} />
        <meshStandardMaterial color="#3a2a20" roughness={0.6} />
      </mesh>
      <group ref={hour} position={[0, 0, 0.012]}>
        <mesh position={[0, 0.09, 0]}>
          <planeGeometry args={[0.035, 0.2]} />
          <meshBasicMaterial color="#1a1614" />
        </mesh>
      </group>
      <group ref={minute} position={[0, 0, 0.018]}>
        <mesh position={[0, 0.13, 0]}>
          <planeGeometry args={[0.022, 0.28]} />
          <meshBasicMaterial color="#1a1614" />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 燈：月台燈柱、站房門燈、候車室日光燈、號誌燈（天黑才亮）
// ---------------------------------------------------------------------------

const lampGlow = new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffd98a', emissiveIntensity: 0, roughness: 0.4 })
const tubeGlow = new THREE.MeshStandardMaterial({ color: '#f4fbff', emissive: '#dff4ff', emissiveIntensity: 0, roughness: 0.3 })
const redLamp = new THREE.MeshStandardMaterial({ color: '#5a1410', emissive: '#ff3a2a', emissiveIntensity: 0 })
const greenLamp = new THREE.MeshStandardMaterial({ color: '#10401c', emissive: '#44ff88', emissiveIntensity: 0 })

function StationLights() {
  const platformLight = useRef<THREE.PointLight>(null)
  const platformLight2 = useRef<THREE.PointLight>(null)
  const hallLight = useRef<THREE.PointLight>(null)
  const doorLight = useRef<THREE.PointLight>(null)
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3f3b36', roughness: 0.6, metalness: 0.4 }), [])
  useFrame(({ clock }) => {
    const s = useStore.getState()
    const k = lanternAt(s.time)
    const t = clock.elapsedTime
    // 日光燈偶爾閃一下（老車站）
    const flick = Math.sin(t * 23) > 0.985 ? 0.3 : 1
    lampGlow.emissiveIntensity = k * 2.2
    tubeGlow.emissiveIntensity = k * 1.6 * flick
    if (platformLight.current) platformLight.current.intensity = k * 5
    if (platformLight2.current) platformLight2.current.intensity = k * 5
    if (hallLight.current) hallLight.current.intensity = k * 3.2 * flick
    if (doorLight.current) doorLight.current.intensity = k * 2.6
    // 號誌：平常紅燈；鬼火車快來的時候（23:55 起）變綠燈
    const go = s.phase === 'night' && s.time >= 23.92 && s.time < 24.8
    redLamp.emissiveIntensity = go ? 0.1 : 0.5 + k * 1.8
    greenLamp.emissiveIntensity = go ? 2.4 : 0.05
  })
  return (
    <group userData={{ noMerge: true }}>
      {S.lampXs.map((x) => (
        <group key={x} position={[x, S.platform.y, S.lampZ]}>
          <mesh material={iron} position={[0, 1.45, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 2.9, 8]} />
          </mesh>
          <mesh material={iron} position={[0, 2.88, 0.22]}>
            <boxGeometry args={[0.05, 0.05, 0.5]} />
          </mesh>
          <mesh material={iron} position={[0, 2.82, 0.44]}>
            <coneGeometry args={[0.22, 0.16, 16, 1, true]} />
          </mesh>
          <mesh material={lampGlow} position={[0, 2.76, 0.44]}>
            <sphereGeometry args={[0.08, 12, 8]} />
          </mesh>
        </group>
      ))}
      <pointLight ref={platformLight} position={[-7.4, 3.1, 0.2]} color="#ffd9a0" intensity={0} distance={11} decay={2} />
      <pointLight ref={platformLight2} position={[7.4, 3.1, 0.2]} color="#ffd9a0" intensity={0} distance={11} decay={2} />
      {/* 雨棚下的日光燈管 */}
      {[-3.2, 3.2].map((x) => (
        <mesh key={x} material={tubeGlow} position={[x, S.canopy.y - 0.24, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 1.2, 8]} />
        </mesh>
      ))}
      {/* 候車室的日光燈 */}
      <mesh material={tubeGlow} position={[0, S.house.wallTop - 0.3, -6.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 8]} />
      </mesh>
      <pointLight ref={hallLight} position={[0, 2.5, -6.3]} color="#e4f4ff" intensity={0} distance={7} decay={2} />
      {/* 大門上方的門燈 */}
      <mesh material={lampGlow} position={[1.35, 2.55, S.house.z1 + 0.25]}>
        <sphereGeometry args={[0.1, 12, 8]} />
      </mesh>
      <pointLight ref={doorLight} position={[1.3, 2.4, S.house.z1 + 0.8]} color="#ffcf8a" intensity={0} distance={6} decay={2} />
      {/* 號誌燈 */}
      {S.signals.map(([x, z]) => (
        <group key={x} position={[x, 0, z + 0.19]}>
          <mesh material={redLamp} position={[0, 3.24, 0]}>
            <circleGeometry args={[0.1, 16]} />
          </mesh>
          <mesh material={greenLamp} position={[0, 2.88, 0]}>
            <circleGeometry args={[0.1, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 傍晚：今晚的客人剛下車，站在月台上（旁邊放著行李）
// ---------------------------------------------------------------------------

const ARRIVAL_POSE: Partial<Record<GuestId, PoseName>> = {
  akai: 'film',
  zhang: 'phone',
  xiaomei: 'phone',
  xiaoyu: 'wave',
  linmom: 'idle',
  ahao: 'idle',
  agui: 'clasp',
  atu: 'idle',
}
const LUGGAGE = ['#c0392b', '#2e6fb5', '#4f7a3a', '#7a5a3a']
/** 看得到阿嬤的客人（小孩、老朋友）會轉頭看她 */
const SEES: GuestId[] = ['xiaoyu', 'agui', 'atu']

function Arrivals({ outline }: { outline: boolean }) {
  const phase = useStore((s) => s.phase)
  const plan = useStore((s) => s.plan)
  const ids = useMemo(() => arrivingGuests({ plan }), [plan])
  const bags = useMemo(() => {
    const r = seeded(77)
    return ids.map((_, i) => ({ dx: 0.5 + r() * 0.2, rot: (r() - 0.5) * 0.6, c: LUGGAGE[i % LUGGAGE.length], tall: r() > 0.5 }))
  }, [ids])
  if (phase !== 'dusk') return null
  return (
    <group userData={{ noMerge: true }}>
      {ids.map((id, i) => {
        const x = S.arrivals[i]
        const b = bags[i]
        return (
          <group key={id}>
            <ChibiNpc id={id} pose={ARRIVAL_POSE[id] ?? 'idle'} position={[x, S.platform.y, S.arrivalZ]} heading={0.35 + i * 0.15} seesGhosts={SEES.includes(id)} outline={outline} />
            <RoundedBox
              args={b.tall ? [0.42, 0.62, 0.24] : [0.5, 0.42, 0.28]}
              radius={0.05}
              smoothness={2}
              position={[x + b.dx, S.platform.y + (b.tall ? 0.31 : 0.21), S.arrivalZ + 0.15]}
              rotation={[0, b.rot, 0]}
              castShadow
            >
              <meshStandardMaterial color={b.c} roughness={0.55} />
            </RoundedBox>
          </group>
        )
      })}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 淡出：跟三合院的 Fader 一樣（子樹換成自己的材質複本，才能單獨調透明度）
// ---------------------------------------------------------------------------

function Fader({ id, children }: { id: string; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const clones = useRef(new Map<THREE.Material, THREE.Material>())
  const seen = useRef(new WeakSet<THREE.Object3D>())
  const opacity = useRef(1)
  const scanFrames = useRef(0)
  useFrame(() => {
    const g = group.current
    if (!g) return
    if (scanFrames.current++ < 240)
      g.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || seen.current.has(m)) return
        seen.current.add(m)
        const swap = (mat: THREE.Material) => {
          let c = clones.current.get(mat)
          if (!c) {
            c = mat.clone()
            clones.current.set(mat, c)
          }
          return c
        }
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material)
      })
    const target = useStore.getState().faded.split(',').includes(id) ? 0 : 1
    const prev = opacity.current
    opacity.current += (target - opacity.current) * 0.15
    if (Math.abs(opacity.current - target) < 0.01) opacity.current = target
    if (Math.abs(opacity.current - prev) < 1e-4 && opacity.current === target && g.visible === (target > 0)) return
    const o = opacity.current
    g.visible = o > 0.01
    for (const c of clones.current.values()) {
      const wasT = c.transparent
      c.opacity = o
      c.transparent = o < 0.995
      c.depthWrite = o > 0.5
      if (wasT !== c.transparent) c.needsUpdate = true
    }
    g.traverse((obj) => {
      obj.castShadow = o > 0.5 && (obj as THREE.Mesh).isMesh
    })
  })
  return (
    <group ref={group} userData={{ noMerge: true }}>
      {children}
    </group>
  )
}
