import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { HATCH, KEEPER_TOP, LIGHTHOUSE, PLACES, SCOPE, lampHold, placeStatus, polar, scope, type HomeInfo } from '../world/sceneLighthouse'
import { night } from '../world/night/director'
import { incidentState } from '../world/night/incidents'
import { player, VIEW } from '../world/player'
import { lanternAt } from './daylight'
import { BRUSH_FONT, canvasTexture, seeded, useMats } from './kit'
import { MergeStatic } from './MergeStatic'
import { ChibiNpc } from '../chars/Chibi'
import '../chars/specs.harbor'

// 燈塔上層（DESIGN §32.5）：燈籠室（大透鏡，點亮以後慢慢轉、光束掃過海面）＋一圈陽台；
// 往下是塔身和海，對岸是村子的燈，每個地方上面一塊字牌寫著「現在怎樣」（家裡出事了會變紅）。
// 鏡頭往西北看（大約 220°），對岸的村子就放在那個方向。

const L = LIGHTHOUSE
const TOP = L.top
const SEA_Y = -1.2
const CAM = (() => {
  const l = Math.hypot(VIEW.x, VIEW.z)
  return { x: VIEW.x / l, z: VIEW.z / l }
})()
const rad = (a: number) => (a * Math.PI) / 180

const glowTex = canvasTexture(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

const beamTex = canvasTexture(32, 128, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, 'rgba(255,248,220,0.9)')
  g.addColorStop(0.35, 'rgba(255,240,200,0.35)')
  g.addColorStop(1, 'rgba(255,240,200,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

/** 燈亮了沒（慢慢亮起來；點燈按住時燈芯跟著進度變亮） */
function useLampOn() {
  const k = useRef(0)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const want = s.flags.lighthouse_lit && s.phase === 'night' ? 1 : 0
    k.current += (want - k.current) * Math.min(1, dt * 1.2)
  })
  return k
}

export function LighthouseTop({ outline }: { outline: boolean }) {
  const on = useLampOn()
  return (
    <group>
      <MergeStatic>
        <Deck />
        <TowerBody />
      </MergeStatic>
      <LampRoom />
      <Lens on={on} />
      <Beams on={on} />
      <HoldRing />
      <Telescope />
      <ChibiNpc id="keeper" pose="clasp" position={[KEEPER_TOP.x, TOP.y, KEEPER_TOP.z]} heading={rad(L.keeperA)} seesGhosts outline={outline} />
      <Sea />
      <FarShore />
      <Labels />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 陽台：鐵板地、燈籠室的銅地板、欄杆；梯子口的活門
// ---------------------------------------------------------------------------

function Deck() {
  const mats = useMats()
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.6, metalness: 0.5 }), [])
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a6a3a', roughness: 0.45, metalness: 0.5 }), [])
  const posts = useMemo(() => Array.from({ length: 30 }, (_, i) => polar(TOP.x, TOP.z, i * 12, TOP.rRail)), [])
  return (
    <group>
      <mesh position={[TOP.x, TOP.y - 0.12, TOP.z]} material={iron} receiveShadow>
        <cylinderGeometry args={[TOP.rRail + 0.2, TOP.rRail + 0.05, 0.24, 48]} />
      </mesh>
      <mesh position={[TOP.x, TOP.y + 0.005, TOP.z]} material={brass} receiveShadow>
        <cylinderGeometry args={[TOP.rGlass, TOP.rGlass, 0.01, 40]} />
      </mesh>
      {posts.map((p, i) => (
        <mesh key={i} position={[p.x, TOP.y + 0.55, p.z]} material={iron}>
          <cylinderGeometry args={[0.03, 0.03, 1.1, 6]} />
        </mesh>
      ))}
      {[0.55, 1.08].map((y) => (
        <mesh key={y} position={[TOP.x, TOP.y + y, TOP.z]} rotation-x={Math.PI / 2} material={iron}>
          <torusGeometry args={[TOP.rRail, 0.03, 6, 72]} />
        </mesh>
      ))}
      {/* 梯子口：地板上一個方洞 */}
      <mesh position={[HATCH.x, TOP.y + 0.012, HATCH.z]} rotation-x={-Math.PI / 2} rotation-z={-rad(TOP.hatch)} material={mats.black}>
        <planeGeometry args={[0.8, 0.8]} />
      </mesh>
      <mesh position={[HATCH.x, TOP.y + 0.03, HATCH.z]} rotation-y={rad(TOP.hatch)} material={iron}>
        <boxGeometry args={[0.9, 0.04, 0.06]} />
      </mesh>
    </group>
  )
}

/** 塔身：從陽台往下一直到海面，白底兩道紅環；海面上一圈水泥基座 */
function TowerBody() {
  const h = TOP.y - 0.25 - SEA_Y
  const bands = [
    { y0: 0, y1: 0.25, red: false },
    { y0: 0.25, y1: 0.38, red: true },
    { y0: 0.38, y1: 0.62, red: false },
    { y0: 0.62, y1: 0.75, red: true },
    { y0: 0.75, y1: 1, red: false },
  ]
  const rAt = (f: number) => 3.6 - f * 1.1
  return (
    <group position={[TOP.x, SEA_Y, TOP.z]}>
      {bands.map((b, i) => (
        <mesh key={i} position={[0, (h * (b.y0 + b.y1)) / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[rAt(b.y1), rAt(b.y0), h * (b.y1 - b.y0), 32]} />
          <meshStandardMaterial color={b.red ? '#b8342c' : '#eeeae0'} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[5.2, 5.6, 1.2, 36]} />
        <meshStandardMaterial color="#8f8c84" roughness={0.9} />
      </mesh>
      {/* 往南（碼頭那邊）的堤防 */}
      <mesh position={[0, -0.1, 16]} receiveShadow>
        <boxGeometry args={[3.2, 1.0, 22]} />
        <meshStandardMaterial color="#8f8c84" roughness={0.9} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 燈籠室：矮鐵牆（南邊一道門）、一圈玻璃、窗框、紅色圓頂；阿嬤走到後面時框和屋頂變淡，才看得到她
// ---------------------------------------------------------------------------

function LampRoom() {
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b8342c', roughness: 0.55, metalness: 0.3, transparent: true }), [])
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.5, metalness: 0.55, transparent: true }), [])
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a8c4d0', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }), [])
  const knee = useMemo(() => {
    const out: number[] = []
    for (let a = 0; a < 360; a += 15) {
      const aa = a > 180 ? a - 360 : a
      if (Math.abs(aa) >= TOP.door) out.push(a)
    }
    return out
  }, [])
  const mullions = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 30 + 15), [])
  const roof = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b8342c', roughness: 0.55, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false }), [])
  const fade = useRef(1)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    // 阿嬤在燈籠室後面（離鏡頭遠的那一半）：框也淡掉；屋頂一直是淡的（不然擋住對岸的村子）
    const d = (player.x - TOP.x) * CAM.x + (player.z - TOP.z) * CAM.z
    const behind = Math.hypot(player.x - TOP.x, player.z - TOP.z) < TOP.rRail + 1 && d < -0.5
    fade.current += ((behind ? 0.22 : 1) - fade.current) * Math.min(1, dt * 8)
    for (const m of [frame, dark]) {
      m.opacity = fade.current
      m.depthWrite = fade.current > 0.9
    }
    roof.opacity = Math.min(0.3, fade.current)
  })
  const w = (2 * Math.PI * TOP.rGlass) / 24 + 0.02
  return (
    <group>
      {knee.map((a) => {
        const p = polar(TOP.x, TOP.z, a + 7.5, TOP.rGlass)
        return (
          <mesh key={a} position={[p.x, TOP.y + 0.35, p.z]} rotation-y={rad(a + 7.5)} material={frame}>
            <boxGeometry args={[w, 0.7, 0.08]} />
          </mesh>
        )
      })}
      <mesh position={[TOP.x, TOP.y + 1.7, TOP.z]} material={glass}>
        <cylinderGeometry args={[TOP.rGlass, TOP.rGlass, 2.0, 32, 1, true]} />
      </mesh>
      {mullions.map((a) => {
        const p = polar(TOP.x, TOP.z, a, TOP.rGlass)
        return (
          <mesh key={a} position={[p.x, TOP.y + 1.7, p.z]} rotation-y={rad(a)} material={dark}>
            <boxGeometry args={[0.05, 2.0, 0.05]} />
          </mesh>
        )
      })}
      <mesh position={[TOP.x, TOP.y + 2.72, TOP.z]} rotation-x={Math.PI / 2} material={dark}>
        <torusGeometry args={[TOP.rGlass, 0.06, 6, 48]} />
      </mesh>
      <mesh position={[TOP.x, TOP.y + 3.2, TOP.z]} material={roof}>
        <coneGeometry args={[TOP.rGlass + 0.35, 1.0, 32]} />
      </mesh>
      <mesh position={[TOP.x, TOP.y + 3.8, TOP.z]} material={roof}>
        <sphereGeometry args={[0.22, 12, 10]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 透鏡：鑄鐵台座上一座「蜂巢」玻璃透鏡，裡面一盞燈；點亮以後整座慢慢轉
// ---------------------------------------------------------------------------

function Lens({ on }: { on: { current: number } }) {
  const spin = useRef<THREE.Group>(null)
  const lamp = useRef<THREE.MeshStandardMaterial>(null)
  const prism = useRef<THREE.MeshStandardMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const glow = useRef<THREE.Sprite>(null)
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    // 按住點燈時，燈芯跟著進度慢慢亮
    const hold = lampHold.active ? lampHold.t / lampHold.need : 0
    const k = Math.max(on.current, hold * 0.6)
    if (spin.current) spin.current.rotation.y += dt * 0.55 * on.current
    if (lamp.current) lamp.current.emissiveIntensity = 0.05 + k * 3.2 + Math.sin(clock.elapsedTime * 7) * 0.05 * k
    if (prism.current) prism.current.emissiveIntensity = k * 0.9
    if (light.current) light.current.intensity = k * 9
    if (glow.current) {
      glow.current.visible = k > 0.02
      glow.current.scale.setScalar(1.6 + k * 1.8)
      ;(glow.current.material as THREE.SpriteMaterial).opacity = k * 0.9
    }
  })
  const lensY = TOP.y + 1.0
  return (
    <group position={[TOP.x, 0, TOP.z]}>
      {/* 台座 */}
      <mesh position={[0, TOP.y + 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.45, TOP.rLens - 0.05, 0.9, 16]} />
        <meshStandardMaterial color="#223029" roughness={0.6} metalness={0.4} />
      </mesh>
      <group ref={spin} position={[0, lensY, 0]}>
        {/* 一圈一圈的稜鏡（上下兩段），中間一條環狀的「牛眼」 */}
        {[0.12, 0.28, 0.44, 1.12, 1.28, 1.44].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.6 - Math.abs(y - 0.78) * 0.22, 0.07, 8, 24]} />
            <meshStandardMaterial ref={y === 0.12 ? prism : undefined} color="#d6eef4" emissive="#fff0c0" emissiveIntensity={0} transparent opacity={0.55} roughness={0.05} metalness={0.1} />
          </mesh>
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[Math.sin((i * Math.PI) / 4) * 0.62, 0.78, Math.cos((i * Math.PI) / 4) * 0.62]} rotation-y={(i * Math.PI) / 4}>
            <circleGeometry args={[0.24, 20]} />
            <meshStandardMaterial color="#cfe8f0" emissive="#ffe7b0" emissiveIntensity={0.2} transparent opacity={0.45} roughness={0.05} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={`f${i}`} position={[Math.sin((i * Math.PI) / 4 + 0.39) * 0.62, 0.78, Math.cos((i * Math.PI) / 4 + 0.39) * 0.62]}>
            <boxGeometry args={[0.03, 1.5, 0.03]} />
            <meshStandardMaterial color="#6a5a3a" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, lensY + 0.78, 0]}>
        <sphereGeometry args={[0.2, 14, 10]} />
        <meshStandardMaterial ref={lamp} color="#fff6d8" emissive="#ffe0a0" emissiveIntensity={0.05} toneMapped={false} />
      </mesh>
      <sprite ref={glow} position={[0, lensY + 0.78, 0]} visible={false}>
        <spriteMaterial map={glowTex} color="#ffe6b0" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <pointLight ref={light} position={[0, lensY + 0.78, 0]} color="#ffd9a0" distance={12} decay={1.4} intensity={0} />
    </group>
  )
}

/** 光束：兩道背對背，跟著透鏡轉；轉到對著鏡頭的時候變淡（不要一整片白閃過去） */
function Beams({ on }: { on: { current: number } }) {
  const spin = useRef<THREE.Group>(null)
  const mats = useRef<THREE.MeshBasicMaterial[]>([])
  const ang = useRef(0)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    ang.current += dt * 0.55 * on.current
    if (spin.current) {
      spin.current.rotation.y = ang.current
      spin.current.visible = on.current > 0.02
    }
    ;[0, Math.PI].forEach((off, i) => {
      const m = mats.current[i]
      if (!m) return
      const phi = ang.current + off
      const toward = Math.cos(phi) * CAM.x - Math.sin(phi) * CAM.z
      const k = 1 - THREE.MathUtils.smoothstep(toward, 0.15, 0.7)
      m.opacity = 0.22 * on.current * k
    })
  })
  return (
    <group ref={spin} position={[TOP.x, TOP.y + 1.78, TOP.z]} visible={false}>
      {[0, Math.PI].map((a, i) => (
        <group key={a} rotation-y={a}>
          <group rotation-z={-0.12}>
            <mesh position={[18, 0, 0]} rotation-z={Math.PI / 2}>
              <coneGeometry args={[4.2, 36, 18, 1, true]} />
              <meshBasicMaterial ref={(m) => void (m && (mats.current[i] = m))} map={beamTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

/** 點燈的長按：阿嬤頭上一圈點點，按越久亮越多 */
function HoldRing() {
  const group = useRef<THREE.Group>(null)
  const dots = useRef<THREE.Mesh[]>([])
  const N = 20
  useFrame(({ camera }) => {
    const g = group.current
    if (!g) return
    g.visible = lampHold.active
    if (!lampHold.active) return
    g.position.set(player.x, TOP.y + 2.35, player.z)
    g.quaternion.copy(camera.quaternion)
    const k = Math.floor((lampHold.t / lampHold.need) * N)
    dots.current.forEach((d, i) => ((d.material as THREE.MeshBasicMaterial).opacity = i < k ? 1 : 0.2))
  })
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={(m) => void (m && (dots.current[i] = m))} position={[Math.sin((i / N) * Math.PI * 2) * 0.38, Math.cos((i / N) * Math.PI * 2) * 0.38, 0]}>
          <sphereGeometry args={[0.045, 6, 4]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0.2} toneMapped={false} depthTest={false} />
        </mesh>
      ))}
    </group>
  )
}

/** 陽台上的望遠鏡（朝對岸的村子） */
function Telescope() {
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b8923a', roughness: 0.35, metalness: 0.7 }), [])
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.5, metalness: 0.55 }), [])
  return (
    <group position={[SCOPE.x, TOP.y, SCOPE.z]} rotation-y={rad(L.scopeA)}>
      <mesh position={[0, 0.55, 0]} material={iron}>
        <cylinderGeometry args={[0.04, 0.06, 1.1, 8]} />
      </mesh>
      <mesh position={[0, 1.15, 0.1]} rotation-x={Math.PI / 2 - 0.15} material={brass}>
        <cylinderGeometry args={[0.06, 0.1, 0.8, 12]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 海：暗暗的水面、往對岸的月光（傍晚是夕陽）一條
// ---------------------------------------------------------------------------

function Sea() {
  const glint = useRef<THREE.MeshBasicMaterial>(null)
  const sea = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0d2130', roughness: 0.3, metalness: 0.15 }), [])
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    sea.color.setRGB(0.05 + 0.1 * (1 - l), 0.13 + 0.06 * (1 - l), 0.19 + 0.06 * (1 - l))
    if (glint.current) glint.current.opacity = 0.18 + Math.sin(clock.elapsedTime * 0.8) * 0.04
  })
  const f = polar(TOP.x, TOP.z, 220, 30)
  return (
    <group>
      <mesh position={[TOP.x, SEA_Y, TOP.z]} rotation-x={-Math.PI / 2} material={sea} receiveShadow>
        <planeGeometry args={[600, 600]} />
      </mesh>
      <mesh position={[f.x, SEA_Y + 0.02, f.z]} rotation-x={-Math.PI / 2} rotation-z={rad(220)}>
        <planeGeometry args={[7, 50]} />
        <meshBasicMaterial ref={glint} map={glowTex} color="#c8d8f0" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 對岸：一大片暗暗的陸地、後面的山，每個地方一叢房子（窗戶亮著）＋自己的燈
// ---------------------------------------------------------------------------

/** 平平的環形扇形（對岸的陸地） */
function flatSector(a0: number, a1: number, r0: number, r1: number) {
  const s = new THREE.Shape()
  const pt = (a: number, r: number) => new THREE.Vector2(Math.sin(rad(a)) * r, -Math.cos(rad(a)) * r)
  const n = 40
  s.moveTo(pt(a0, r0).x, pt(a0, r0).y)
  for (let i = 0; i <= n; i++) s.lineTo(pt(a0 + ((a1 - a0) * i) / n, r1).x, pt(a0 + ((a1 - a0) * i) / n, r1).y)
  for (let i = n; i >= 0; i--) {
    // 海岸線彎彎曲曲
    const a = a0 + ((a1 - a0) * i) / n
    const r = r0 + Math.sin(a * 0.31) * 2.2 + Math.sin(a * 0.11) * 3
    s.lineTo(pt(a, r).x, pt(a, r).y)
  }
  const g = new THREE.ShapeGeometry(s)
  g.rotateX(-Math.PI / 2)
  return g
}

const HILLS = [
  { a: 191, d: 52, h: 9, r: 10 },
  { a: 160, d: 80, h: 16, r: 22 },
  { a: 200, d: 90, h: 20, r: 26 },
  { a: 232, d: 80, h: 14, r: 20 },
  { a: 255, d: 64, h: 10, r: 16 },
]

/** 每個地方的顏色（窗戶、自己的燈） */
const PLACE_LOOK: Record<string, { win: string; glow: string; houses: number; spread: number }> = {
  oldstreet: { win: '#ffd9a0', glow: '#ff7ab8', houses: 9, spread: 7 },
  station: { win: '#ffe8b0', glow: '#fff2c0', houses: 3, spread: 4 },
  home: { win: '#ffc070', glow: '#ff5a3a', houses: 3, spread: 3.5 },
  school: { win: '#b8c8e0', glow: '#8ab8ff', houses: 4, spread: 5 },
  temple: { win: '#ffb070', glow: '#ff4a2a', houses: 2, spread: 2.5 },
  market: { win: '#ff8a5a', glow: '#ff3a2a', houses: 0, spread: 5 },
  hill: { win: '#8ab8ff', glow: '#6aa8ff', houses: 0, spread: 3 },
}

function FarShore() {
  const land = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111a14', roughness: 1 }), [])
  const hill = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0c140f', roughness: 1, flatShading: true }), [])
  const landGeo = useMemo(() => flatSector(140, 290, 22, 220), [])
  const { houses, wins } = useMemo(() => {
    const r = seeded(4040)
    const h: THREE.Matrix4[] = []
    const w: { m: THREE.Matrix4; c: THREE.Color }[] = []
    for (const p of PLACES) {
      const look = PLACE_LOOK[p.id]
      const c = polar(TOP.x, TOP.z, p.a, p.d)
      for (let i = 0; i < look.houses; i++) {
        const x = c.x + (r() - 0.5) * look.spread * 2
        const z = c.z + (r() - 0.5) * look.spread
        const sx = 1.6 + r() * 1.6
        const sy = 1.2 + r() * (p.id === 'oldstreet' ? 2.4 : 1.2)
        const sz = 1.4 + r()
        h.push(new THREE.Matrix4().compose(new THREE.Vector3(x, p.y + sy / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 0.6 - 0.3, 0)), new THREE.Vector3(sx, sy, sz)))
        // 朝鏡頭那面的窗戶
        const n = 1 + Math.floor(r() * 2)
        for (let k = 0; k < n; k++)
          w.push({
            m: new THREE.Matrix4().compose(new THREE.Vector3(x + (k - (n - 1) / 2) * 0.55, p.y + sy * (0.45 + r() * 0.25), z + sz / 2 + 0.02), new THREE.Quaternion(), new THREE.Vector3(0.32, 0.32, 1)),
            c: new THREE.Color(look.win),
          })
      }
    }
    return { houses: h, wins: w }
  }, [])
  const houseMesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#1a2026', roughness: 0.9 }), houses.length)
    houses.forEach((x, i) => m.setMatrixAt(i, x))
    return m
  }, [houses])
  const winMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), [])
  const winMesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), winMat, wins.length)
    wins.forEach((x, i) => {
      m.setMatrixAt(i, x.m)
      m.setColorAt(i, x.c)
    })
    return m
  }, [wins, winMat])
  useFrame(() => {
    const l = lanternAt(useStore.getState().time)
    winMat.color.setScalar(0.25 + 0.95 * l)
  })
  return (
    <group>
      <mesh geometry={landGeo} position={[TOP.x, SEA_Y + 0.35, TOP.z]} material={land} receiveShadow />
      {HILLS.map((hh, i) => {
        const c = polar(TOP.x, TOP.z, hh.a, hh.d)
        return (
          <mesh key={i} position={[c.x, SEA_Y + hh.h / 2, c.z]} material={hill}>
            <coneGeometry args={[hh.r, hh.h, 9]} />
          </mesh>
        )
      })}
      <primitive object={houseMesh} />
      <primitive object={winMesh} />
      <PlaceLights />
    </group>
  )
}

/** 每個地方自己的燈：家的紅燈籠、廟的紅光、老街的霓虹、車站的月台燈（半夜有鬼火車）、國小和山上的鬼火、鬼夜市的燈籠串 */
function PlaceLights() {
  const refs = useRef<{ id: string; s: THREE.Sprite; base: THREE.Vector3; kind: string; i: number }[]>([])
  const items = useMemo(() => {
    const out: { id: string; kind: string; x: number; y: number; z: number; size: number; color: string; i: number }[] = []
    for (const p of PLACES) {
      const c = polar(TOP.x, TOP.z, p.a, p.d)
      const look = PLACE_LOOK[p.id]
      if (p.id === 'market') for (let i = 0; i < 12; i++) out.push({ id: p.id, kind: 'market', x: c.x - 5 + i * 0.9, y: p.y + 2 + Math.sin(i * 0.9) * 0.3, z: c.z, size: 1.1, color: '#ff4a2a', i })
      else if (p.id === 'hill' || p.id === 'school') for (let i = 0; i < 4; i++) out.push({ id: p.id, kind: 'wisp', x: c.x - 3 + i * 2, y: p.y + 1.5, z: c.z + (i % 2) * 1.5, size: 1.2, color: look.glow, i })
      else if (p.id === 'station') {
        out.push({ id: p.id, kind: 'lamp', x: c.x, y: p.y + 3, z: c.z, size: 2.4, color: look.glow, i: 0 })
        for (let i = 0; i < 6; i++) out.push({ id: p.id, kind: 'train', x: c.x - 14 + i * 1.3, y: p.y + 1.2, z: c.z + 2.5, size: 1.0, color: '#7affd8', i })
      } else out.push({ id: p.id, kind: 'glow', x: c.x, y: p.y + 2.2, z: c.z, size: p.id === 'home' ? 2.4 : 2.8, color: look.glow, i: 0 })
    }
    return out
  }, [])
  useFrame(({ clock }) => {
    const s = useStore.getState()
    const t = s.time
    const n = s.phase === 'night'
    const l = lanternAt(t)
    const time = clock.elapsedTime
    for (const r of refs.current) {
      const m = r.s.material as THREE.SpriteMaterial
      let vis = true
      let op = 0.12 + 0.88 * l
      if (r.kind === 'market') vis = n && t >= 24 && t < 28.5
      if (r.kind === 'wisp') {
        vis = n
        r.s.position.set(r.base.x + Math.sin(time * 0.7 + r.i) * 0.8, r.base.y + Math.sin(time * 1.3 + r.i * 2) * 0.5, r.base.z)
        op = 0.55 + Math.sin(time * 2 + r.i) * 0.25
      }
      if (r.kind === 'train') {
        // 末班車：23:45 到 00:30 之間從西邊開進站
        vis = n && t >= 23.75 && t < 24.5
        const k = THREE.MathUtils.clamp((t - 23.75) / 0.25, 0, 1)
        r.s.position.set(r.base.x + k * 12, r.base.y, r.base.z)
      }
      if (r.kind === 'glow' && r.id === 'home') {
        // 家裡出事了：燈慢慢一明一暗（一秒一次，不會閃）
        const inc = incidentState.current
        if (n && inc && inc.status === 'active') {
          m.color.set('#ff3030')
          op = 0.6 + Math.sin(time * Math.PI) * 0.35
        } else m.color.set(PLACE_LOOK.home.glow)
      }
      r.s.visible = vis
      m.opacity = op
    }
  })
  return (
    <group>
      {items.map((it, k) => (
        <sprite
          key={k}
          ref={(sp) => void (sp && (refs.current[k] = { id: it.id, s: sp, base: new THREE.Vector3(it.x, it.y, it.z), kind: it.kind, i: it.i }))}
          position={[it.x, it.y, it.z]}
          scale={[it.size, it.size, it.size]}
        >
          <spriteMaterial map={glowTex} color={it.color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 字牌：每個地方上面一塊，寫名字和「現在怎樣」；家裡出事了變紅；望遠鏡看的那一塊亮一下、放大
// ---------------------------------------------------------------------------

function labelTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 150
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return { canvas, tex }
}

/** 字牌：家裡那塊一直寫「現在怎樣」；其他地方平常只寫名字（望遠鏡看的時候才寫），才不會擠成一團 */
function drawLabel(canvas: HTMLCanvasElement, name: string, status: string | null, bad: boolean, hot: boolean) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.font = `700 50px ${BRUSH_FONT}`
  const nameW = ctx.measureText(name).width
  ctx.font = `500 30px "Noto Sans TC", sans-serif`
  const statW = status ? Math.min(w - 30, ctx.measureText(status).width) : 0
  const bw = Math.min(w - 8, Math.max(nameW, statW) + 56)
  const bh = status ? h - 8 : 76
  const x0 = (w - bw) / 2
  const y0 = status ? 4 : h - bh - 4
  ctx.fillStyle = hot ? 'rgba(90,64,18,0.9)' : bad ? 'rgba(90,18,18,0.86)' : 'rgba(14,20,30,0.74)'
  const r = 24
  ctx.beginPath()
  ctx.moveTo(x0 + r, y0)
  ctx.arcTo(x0 + bw, y0, x0 + bw, y0 + bh, r)
  ctx.arcTo(x0 + bw, y0 + bh, x0, y0 + bh, r)
  ctx.arcTo(x0, y0 + bh, x0, y0, r)
  ctx.arcTo(x0, y0, x0 + bw, y0, r)
  ctx.fill()
  ctx.strokeStyle = hot ? '#ffd27a' : bad ? '#ff8a7a' : 'rgba(255,230,180,0.5)'
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = bad ? '#ffd0c8' : '#ffe9b8'
  ctx.font = `700 50px ${BRUSH_FONT}`
  ctx.fillText(name, w / 2, status ? 60 : y0 + 56)
  if (!status) return
  ctx.fillStyle = bad ? '#ffb0a0' : '#dfe8f2'
  ctx.font = `500 30px "Noto Sans TC", sans-serif`
  ctx.fillText(status, w / 2, 112, w - 30)
}

function Labels() {
  const labels = useMemo(
    () =>
      PLACES.map((p) => {
        const c = polar(TOP.x, TOP.z, p.a, p.d)
        return { p, ...labelTexture(), pos: new THREE.Vector3(c.x, p.y + 3.0, c.z), d: p.d, last: '' }
      }),
    [],
  )
  const sprites = useRef<THREE.Sprite[]>([])
  const acc = useRef(1)
  const home = useRef<HomeInfo | null>(null)
  useFrame((_, rawDt) => {
    acc.current += rawDt
    const now = performance.now()
    const refresh = acc.current > 0.5
    if (refresh) acc.current = 0
    const s = useStore.getState()
    if (refresh) {
      const inc = incidentState.current
      home.current = night.sim ? { incident: !!inc && inc.status === 'active', special: s.plan.special ?? null, guests: night.sim.guests.map((g) => ({ awake: g.awake, needs: g.needs.length })) } : null
    }
    labels.forEach((lb, i) => {
      const hot = scope.lookAt === i && now - scope.at < 5000
      const sp = sprites.current[i]
      if (sp) {
        const k = hot ? 1.25 : 1
        const base = 6.2 * ((lb.d + 11) / 42)
        sp.scale.set(base * k, base * k * (150 / 512), 1)
      }
      if (!refresh && !hot) return
      const st = placeStatus(lb.p.id, s, home.current)
      const show = lb.p.id === 'home' || hot || !!st.bad
      const key = `${show ? st.text : ''}|${st.bad ? 1 : 0}|${hot ? 1 : 0}`
      if (key === lb.last) return
      lb.last = key
      drawLabel(lb.canvas, lb.p.name, show ? st.text : null, !!st.bad, hot)
      lb.tex.needsUpdate = true
    })
  })
  return (
    <group>
      {labels.map((lb, i) => (
        <sprite key={lb.p.id} ref={(sp) => void (sp && (sprites.current[i] = sp))} position={lb.pos} renderOrder={20}>
          <spriteMaterial map={lb.tex} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
        </sprite>
      ))}
    </group>
  )
}
