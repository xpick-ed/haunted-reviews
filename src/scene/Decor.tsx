import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { HOME } from '../world/scenes'
import { FLOOR_Y } from './layout'
import { audio } from '../audio'
import { DECOR_PILE, decorActions, updatePreview, useDecor } from '../world/decor'
import { WALL_Y, itemById, isPlaced } from '../world/decorCatalog'
import type { DecorPlacement } from '../world/night/director'
import { player } from '../world/player'
import { BambooChair, ClutterPile, FishTank, FloralCurtain, LanternString, MoneyTree, MosquitoNet, OldDoll, Orchid, PhotoWall, RockingHorse, WallClock, WindChime, type ModelProps } from './DecorModels'

// 裝修民宿（DESIGN §27.2）：擺好的家具擺飾、擺放模式的預覽，以及滑鼠／手指指地板。
// 規則在 src/world/decorCatalog.ts、狀態與動作在 src/world/decor.ts、HUD 在 src/ui/DecorHud.tsx。

const MODELS: Record<string, (p: ModelProps) => React.JSX.Element | null> = {
  orchid: Orchid,
  moneytree: MoneyTree,
  windchime: WindChime,
  clock: WallClock,
  net: MosquitoNet,
  rockinghorse: RockingHorse,
  doll: OldDoll,
  bamboochair: BambooChair,
  lanterns: LanternString,
  fishtank: FishTank,
  curtain: FloralCurtain,
  photowall: PhotoWall,
}

/** 擺設放在世界裡的位置與高度（牆上的東西掛在牆上的高度） */
function mount(d: { item: string; x: number; z: number }) {
  const floor = HOME.floorAt(d.x, d.z)
  return floor + (WALL_Y[d.item] ?? 0)
}

export function DecorLayer() {
  const decor = useStore((s) => s.meta.decor)
  const isNight = useStore((s) => s.isNight)
  const phase = useStore((s) => s.phase)
  const placing = useDecor((s) => s.placing)
  const placed = useMemo(() => decor.filter(isPlaced), [decor])
  return (
    <group userData={{ noMerge: true }}>
      <group position={[DECOR_PILE.x, HOME.floorAt(DECOR_PILE.x, DECOR_PILE.z), DECOR_PILE.z]} rotation-y={-0.4}>
        <ClutterPile />
      </group>
      {placed.map((d, i) => (
        <PlacedItem key={`${d.item}-${i}-${d.x.toFixed(2)}-${d.z.toFixed(2)}`} d={d} night={isNight} highlight={placing} />
      ))}
      {placing && phase === 'dusk' && <Preview night={isNight} />}
      {placing && <PlacementInput />}
      {isNight && <ChimeSound placed={placed} />}
    </group>
  )
}

function PlacedItem({ d, night, highlight }: { d: DecorPlacement; night: boolean; highlight: boolean }) {
  const Model = MODELS[d.item]
  const held = useDecor((s) => s.held)
  if (!Model) return null
  const it = itemById(d.item)
  return (
    <group position={[d.x, mount(d), d.z]} rotation-y={d.rot}>
      <Model night={night} room={d.room} at={[d.x, d.z]} rot={d.rot} />
      {/* 整理模式：擺好的東西腳下有一圈青色，點它可以拿起來 */}
      {highlight && !held && it?.kind !== 'wall' && <Ring color="#8ff4ff" r={Math.max(0.28, (it?.r ?? 0.2) + 0.1)} y={0.02 - (WALL_Y[d.item] ?? 0)} />}
      {highlight && !held && it?.kind === 'wall' && <WallMark />}
    </group>
  )
}

function Ring({ color, r, y = 0.02 }: { color: string; r: number; y?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(clock.elapsedTime * 5) * 0.2
  })
  return (
    <mesh ref={ref} position={[0, y, 0]} rotation-x={-Math.PI / 2} renderOrder={3}>
      <ringGeometry args={[r * 0.82, r, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function WallMark() {
  return (
    <mesh position={[0, 0, 0.12]} renderOrder={3}>
      <ringGeometry args={[0.2, 0.25, 24]} />
      <meshBasicMaterial color="#8ff4ff" transparent opacity={0.7} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** 拿在手上的東西：跟著指的位置，腳下綠圈（可以擺）或紅圈（不行） */
function Preview({ night }: { night: boolean }) {
  const held = useDecor((s) => s.held)
  const p = useDecor((s) => s.preview)
  useFrame(() => updatePreview())
  if (!held || !p) return null
  const Model = MODELS[held]
  const it = itemById(held)
  if (!Model || !it) return null
  const y = HOME.floorAt(p.x, p.z) + p.y
  const color = p.ok ? '#7dff9a' : '#ff6a5a'
  return (
    <group position={[p.x, y, p.z]} rotation-y={p.rot}>
      <group scale={p.ok ? 1 : 0.96}>
        <Model night={night} room={p.room} at={[p.x, p.z]} rot={p.rot} />
      </group>
      {it.kind === 'wall' ? (
        <mesh position={[0, 0, 0.14]} renderOrder={3}>
          <ringGeometry args={[0.3, 0.36, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : (
        <Ring color={color} r={it.kind === 'bed' ? 1.3 : Math.max(0.3, it.r + 0.12)} />
      )}
    </group>
  )
}

/**
 * 滑鼠／手指指地板：移動時預覽跟著走。
 * 滑鼠：點一下就擺（或在整理模式把東西拿起來）。
 * 手指：點一下把預覽移過去，再點一次同一個地方（或按「放下」）才擺。
 */
function PlacementInput() {
  const { camera, gl } = useThree()
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const floorPoint = (cx: number, cy: number): [number, number] | null => {
      const r = el.getBoundingClientRect()
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const o = ray.ray.origin
      const dir = ray.ray.direction
      // 先看台基（屋裡、走廊）那一層，再看埕
      for (const y of [FLOOR_Y, 0.1]) {
        if (Math.abs(dir.y) < 1e-4) continue
        const t = (y - o.y) / dir.y
        if (t <= 0) continue
        const x = o.x + dir.x * t
        const z = o.z + dir.z * t
        if (Math.abs(HOME.floorAt(x, z) - y) < 0.05) return [x, z]
      }
      return null
    }
    const point = (e: PointerEvent) => {
      const p = floorPoint(e.clientX, e.clientY)
      if (p) useDecor.setState({ pointX: p[0], pointZ: p[1], pointedAt: performance.now() })
      return p
    }
    let down: { x: number; y: number; t: number; id: number } | null = null
    const onMove = (e: PointerEvent) => {
      if (!useDecor.getState().placing) return
      if (e.pointerType === 'mouse' || (down && e.pointerId === down.id)) point(e)
    }
    const onDown = (e: PointerEvent) => {
      if (!useDecor.getState().placing || e.target !== el) return
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }
    }
    const onUp = (e: PointerEvent) => {
      const d = down
      down = null
      if (!d || e.pointerId !== d.id) return
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 14 || performance.now() - d.t > 450) return
      const u = useDecor.getState()
      if (!u.placing) return
      const before = u.preview
      const p = point(e)
      if (!p) return
      if (!u.held) {
        decorActions.pickUpNear(p[0], p[1])
        return
      }
      updatePreview()
      if (e.pointerType === 'mouse') decorActions.place()
      else if (before && before.ok && Math.hypot(before.x - p[0], before.z - p[1]) < 0.45) decorActions.place()
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl])
  return null
}

/** 晚上風鈴自己叮叮響（阿嬤在附近才聽得到） */
function ChimeSound({ placed }: { placed: DecorPlacement[] }) {
  const next = useRef(3)
  const chimes = useMemo(() => placed.filter((d) => d.item === 'windchime'), [placed])
  useFrame((_, dt) => {
    if (!chimes.length) return
    next.current -= Math.min(dt, 0.1)
    if (next.current > 0) return
    next.current = 4 + Math.random() * 7
    const near = chimes.reduce((m, d) => Math.min(m, Math.hypot(d.x - player.x, d.z - player.z)), Infinity)
    if (near < 9) chime(1 - near / 9)
  })
  return null
}

function chime(vol: number) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const notes = [1568, 2093, 2349, 2637]
  const n = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = notes[Math.floor(Math.random() * notes.length)]
    const at = t + i * (0.12 + Math.random() * 0.1)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.05 * vol + 0.005, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4)
    o.connect(g).connect(audio.bus.sfx)
    o.start(at)
    o.stop(at + 1.5)
  }
}
