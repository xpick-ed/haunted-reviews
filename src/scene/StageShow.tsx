import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio'
import { STAGE, stageFx, type StageMode } from '../world/sceneStage'
import { player } from '../world/player'
import { lanternAt } from './daylight'
import { seeded, useMats } from './kit'
import { Chibi, SEAT_Y, newDrive, type Drive, type PoseName } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { MELODY, opera, schedulePhrase } from '../ui/minigames/rhythm.sound'
import { TROUPE } from './StageTex'

// 野台戲開演中會動的東西：台上的小生與苦旦（一段 20 秒的戲一直重演）、班主、
// 台下的村民（坐板凳）與好兄弟（半透明的人影，晚上才來）、彩燈跑馬、LED 字幕機、
// 阿嬤打完鑼鼓後的掌聲、謝幕、彩帶，還有後場的鼓棒，以及靠近時聽得到的七字調（合成）。

const D = STAGE.deck
const FRONT = D.x1
const CX = (D.x0 + D.x1) / 2
const CZ = (D.z0 + D.z1) / 2
const BEAT = 60 / 96
const FACE = Math.PI / 2 // 面向台下（+x）

/** 阿嬤打完鑼鼓之後幾秒內（掌聲、謝幕）；沒有就是 -1 */
function cheerAge() {
  const t = (performance.now() - stageFx.cheerAt) / 1000
  return t >= 0 && t < 6 ? t : -1
}

export function StageShow({ mode, outline }: { mode: StageMode; outline: boolean }) {
  return (
    <group userData={{ noMerge: true }}>
      <StageLights />
      <Bulbs />
      <Ticker mode={mode} />
      <Performer id="xiaosheng" keys={XS} cheerZ={0.55} outline={outline} />
      <Performer id="kudan" keys={KD} cheerZ={1.95} outline={outline} />
      <Banzhu outline={outline} />
      {SEATS.map((s) => (
        <Villager key={s.id} {...s} outline={outline} />
      ))}
      <GhostAudience mode={mode} />
      <BandSticks />
      <Confetti />
      <StageMusic />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 台上：小生與苦旦（一段 20 秒的戲：唱、相會、苦旦轉身哭、小生追、再相聚）
// ---------------------------------------------------------------------------

interface Key {
  t: number
  x: number
  z: number
  h: number
  pose: PoseName
  expr: string
}

const LOOP = 20
const XS: Key[] = [
  { t: 0, x: -10.4, z: 0.5, h: FACE, pose: 'fan', expr: 'normal' },
  { t: 4, x: -10.4, z: 0.5, h: FACE, pose: 'fan', expr: 'normal' },
  { t: 5.5, x: -10.6, z: 0.9, h: 0.2, pose: 'fan', expr: 'happy' },
  { t: 8, x: -10.6, z: 0.9, h: 0.3, pose: 'reach', expr: 'sad' },
  { t: 11, x: -11.2, z: 1.35, h: 0.1, pose: 'reach', expr: 'sad' },
  { t: 13, x: -10.2, z: 0.45, h: FACE, pose: 'fan', expr: 'happy' },
  { t: 16, x: -10.2, z: 0.45, h: FACE, pose: 'clasp', expr: 'happy' },
  { t: 20, x: -10.4, z: 0.5, h: FACE, pose: 'fan', expr: 'normal' },
]
const KD: Key[] = [
  { t: 0, x: -10.4, z: 2.0, h: FACE, pose: 'clasp', expr: 'normal' },
  { t: 4, x: -10.4, z: 2.0, h: FACE, pose: 'wave', expr: 'normal' },
  { t: 5.5, x: -10.6, z: 1.6, h: Math.PI - 0.2, pose: 'wave', expr: 'happy' },
  { t: 8, x: -11.7, z: 2.3, h: -1.8, pose: 'clasp', expr: 'sad' },
  { t: 11, x: -11.7, z: 2.3, h: -2.4, pose: 'clasp', expr: 'sad' },
  { t: 13, x: -10.6, z: 1.7, h: Math.PI - 0.3, pose: 'wave', expr: 'happy' },
  { t: 16, x: -10.4, z: 2.0, h: FACE, pose: 'wave', expr: 'happy' },
  { t: 20, x: -10.4, z: 2.0, h: FACE, pose: 'clasp', expr: 'normal' },
]

function sample(keys: Key[], t: number) {
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a.t && t < b.t) {
      const k = THREE.MathUtils.smoothstep((t - a.t) / (b.t - a.t), 0, 1)
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, h: a.h, pose: a.pose, expr: a.expr }
    }
  }
  const e = keys[keys.length - 1]
  return { x: e.x, z: e.z, h: e.h, pose: e.pose, expr: e.expr }
}

function Performer({ id, keys, cheerZ, outline }: { id: string; keys: Key[]; cheerZ: number; outline: boolean }) {
  const group = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const drive = useRef<Drive>(newDrive({ pose: 'idle', heading: FACE }))
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const g = group.current
    if (!g) return
    const c = cheerAge()
    let k = sample(keys, clock.elapsedTime % LOOP)
    let bow = 0
    if (c >= 0) {
      // 謝幕：走到台前，鞠躬
      k = { x: FRONT - 0.75, z: cheerZ, h: FACE, pose: 'clasp', expr: 'happy' }
      bow = c > 1 && c < 4.6 ? Math.sin(((c - 1) / 3.6) * Math.PI) : 0
    }
    const dx = k.x - g.position.x
    const dz = k.z - g.position.z
    const dist = Math.hypot(dx, dz)
    const step = Math.min(dist, 1.3 * dt)
    if (dist > 1e-4) {
      g.position.x += (dx / dist) * step
      g.position.z += (dz / dist) * step
    }
    const d = drive.current
    d.speed = step / Math.max(dt, 1e-4)
    d.heading = d.speed > 0.3 ? Math.atan2(dx, dz) : k.h
    d.pose = k.pose
    d.expr = k.expr
    if (tilt.current) tilt.current.rotation.z = -0.42 * bow
  })
  return (
    <group ref={group} position={[keys[0].x, D.y, keys[0].z]}>
      <group ref={tilt}>
        <Chibi spec={SPECS[id]} drive={drive} outline={outline} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 班主：阿嬤還沒來幫忙前一臉煩惱；感覺得到鬼，阿嬤靠近時會轉頭
// ---------------------------------------------------------------------------

function Banzhu({ outline }: { outline: boolean }) {
  const drive = useRef<Drive>(newDrive({ pose: 'clasp', expr: 'worried', heading: 1.9 }))
  const B = STAGE.banzhu
  useFrame(() => {
    const s = useStore.getState()
    const helped = !!s.flags.stage_rhythm_today
    const c = cheerAge()
    const d = drive.current
    d.expr = c >= 0 || helped ? 'happy' : 'worried'
    d.pose = c >= 0 && c < 5 ? 'wave' : helped ? 'idle' : 'clasp'
    const dx = player.x - B.x
    const dz = player.z - B.z
    d.heading = s.scene === 'temple' && Math.hypot(dx, dz) < 3.5 ? Math.atan2(dx, dz) : 1.9
  })
  return (
    <group position={[B.x, 0, B.z]}>
      <Chibi spec={SPECS.banzhu} drive={drive} outline={outline} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 台下：坐板凳的村民（面向戲台，看到精彩的會舉手叫好）
// ---------------------------------------------------------------------------

const SEATS = [
  { id: 'stage_v1', x: STAGE.benchXs[0], z: 0.8, i: 0 },
  { id: 'stage_v2', x: STAGE.benchXs[0], z: 2.2, i: 1 },
  { id: 'stage_v3', x: STAGE.benchXs[1], z: 1.25, i: 2 },
  { id: 'stage_v4', x: STAGE.benchXs[1], z: 2.45, i: 3 },
]

function Villager({ id, x, z, i, outline }: { id: string; x: number; z: number; i: number; outline: boolean }) {
  const spec = SPECS[id]
  const drive = useRef<Drive>(newDrive({ pose: 'sit', heading: -Math.PI / 2, expr: 'happy' }))
  const y = STAGE.bench.seatY - SEAT_Y * spec.scale + 0.03
  useFrame(({ clock }) => {
    const d = drive.current
    const c = cheerAge()
    const t = clock.elapsedTime
    d.pose = c >= 0 && c < 4 + i * 0.3 ? 'wave' : 'sit'
    // 看戲看得入迷：頭微微跟著台上的人轉
    d.heading = -Math.PI / 2 + Math.sin(t * 0.3 + i) * 0.25
  })
  return (
    <group position={[x, y, z]}>
      <Chibi spec={spec} drive={drive} legs={false} outline={outline} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 好兄弟：很淡的青色人影（一個 InstancedMesh），晚上才來看戲；中元普渡特別多
// ---------------------------------------------------------------------------

const GHOST_SPOTS = (() => {
  const r = seeded(2626)
  const out: { x: number; z: number; sit: boolean; p: number; zy: boolean }[] = []
  // 第三排板凳上坐著的
  for (let i = 0; i < 4; i++) out.push({ x: STAGE.benchXs[2], z: 0.55 + i * 0.62, sit: true, p: r() * 6, zy: false })
  // 板凳後面站著的
  for (let i = 0; i < 6; i++) out.push({ x: -5.3 + (i % 2) * 0.55 + (r() - 0.5) * 0.3, z: 1.2 + i * 0.4 + (r() - 0.5) * 0.2, sit: false, p: r() * 6, zy: false })
  // 北邊站一排、路邊（中元才有）
  for (let i = 0; i < 4; i++) out.push({ x: -8.3 + i * 0.7, z: -0.55 + (r() - 0.5) * 0.25, sit: false, p: r() * 6, zy: true })
  for (let i = 0; i < 6; i++) out.push({ x: -8.6 + i * 0.85 + (r() - 0.5) * 0.3, z: 3.35 + (r() - 0.5) * 0.3, sit: false, p: r() * 6, zy: true })
  return out
})()

function GhostAudience({ mode }: { mode: StageMode }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const isNight = useStore((s) => s.isNight)
  const geo = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0.0, 0.0],
          [0.3, 0.02],
          [0.25, 0.25],
          [0.2, 0.6],
          [0.16, 0.9],
          [0.19, 1.02],
          [0.18, 1.16],
          [0.11, 1.28],
          [0.0, 1.32],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        14,
      ),
    [],
  )
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.85, 0.78), transparent: true, opacity: 0.13, depthWrite: false }), [])
  // 土地公生：坐著的＋板凳後面的；中元普渡：全部
  const spots = useMemo(() => GHOST_SPOTS.filter((s) => mode === 'zhongyuan' || !s.zy), [mode])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const im = mesh.current
    if (!im) return
    const t = clock.elapsedTime
    const c = cheerAge()
    spots.forEach((s, i) => {
      const jump = c >= 0 && c < 3 ? Math.max(0, Math.sin((c * 3 + i * 0.4) * Math.PI)) * 0.25 : 0
      const bob = Math.sin(t * 1.8 + s.p) * 0.04
      if (s.sit) {
        tmp.position.set(s.x, 0.3 + bob + jump, s.z)
        tmp.scale.set(0.95, 0.72, 0.95)
      } else {
        tmp.position.set(s.x, 0.1 + bob + jump, s.z)
        tmp.scale.setScalar(0.92 + Math.sin(s.p) * 0.08)
      }
      tmp.rotation.set(Math.sin(t * 1.1 + s.p) * 0.05, -Math.PI / 2, Math.sin(t * 0.8 + s.p) * 0.06)
      tmp.updateMatrix()
      im.setMatrixAt(i, tmp.matrix)
    })
    im.instanceMatrix.needsUpdate = true
  })
  if (!isNight) return null
  return <instancedMesh key={mode} ref={mesh} args={[geo, mat, spots.length]} frustumCulled={false} renderOrder={3} />
}

// ---------------------------------------------------------------------------
// 燈：台前的暖光、兩側的彩色光、台下的光；彩燈跑馬
// ---------------------------------------------------------------------------

function StageLights() {
  const key = useRef<THREE.PointLight>(null)
  const magenta = useRef<THREE.PointLight>(null)
  const cyan = useRef<THREE.PointLight>(null)
  const crowd = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const t = clock.elapsedTime
    const c = cheerAge()
    const boost = c >= 0 && c < 3 ? 1 + Math.sin(c * 12) * 0.3 : 1
    if (key.current) key.current.intensity = (2.5 + 6 * l) * boost
    if (magenta.current) magenta.current.intensity = (0.6 + 2.2 * l) * (0.75 + Math.sin(t * 1.7) * 0.25)
    if (cyan.current) cyan.current.intensity = (0.6 + 2.2 * l) * (0.75 + Math.sin(t * 1.3 + 2) * 0.25)
    if (crowd.current) crowd.current.intensity = 0.4 + 2.2 * l
  })
  return (
    <group>
      <pointLight ref={key} position={[FRONT + 1.4, 3.9, CZ]} color="#ffd9a0" intensity={6} distance={9} decay={2} />
      <pointLight ref={magenta} position={[FRONT - 0.4, 3.3, D.z0 + 0.4]} color="#ff4aa8" intensity={2} distance={5} decay={2} />
      <pointLight ref={cyan} position={[FRONT - 0.4, 3.3, D.z1 - 0.4]} color="#4ae0ff" intensity={2} distance={5} decay={2} />
      <pointLight ref={crowd} position={[-7.0, 2.8, 1.6]} color="#ffb870" intensity={2} distance={6} decay={2} />
    </group>
  )
}

/** 彩燈：招牌下緣、前面兩根柱子、棚頂前緣，一顆一顆跑馬 */
const BULBS = (() => {
  const out: [number, number, number][] = []
  for (let z = D.z0 + 0.1; z <= D.z1 - 0.1; z += 0.22) out.push([FRONT + 0.12, 3.72, z])
  for (const z of [D.z0 + 0.07, D.z1 - 0.07]) for (let y = 1.25; y < 3.7; y += 0.24) out.push([FRONT + 0.02, y, z])
  for (let z = D.z0 - 0.2; z <= D.z1 + 0.2; z += 0.3) out.push([FRONT + 0.46, 4.36, z])
  return out
})()
const BULB_COLORS = ['#ff4a6a', '#ffd84a', '#4ae0ff', '#ff5ae0', '#6aff8a'].map((c) => new THREE.Color(c).multiplyScalar(2.2))

function Bulbs() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.SphereGeometry(0.038, 8, 6), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const dim = useMemo(() => new THREE.Color(), [])
  const placed = useRef(false)
  useFrame(({ clock }) => {
    const im = mesh.current
    if (!im) return
    if (!placed.current) {
      BULBS.forEach((p, i) => {
        tmp.position.set(...p)
        tmp.updateMatrix()
        im.setMatrixAt(i, tmp.matrix)
      })
      im.instanceMatrix.needsUpdate = true
      placed.current = true
    }
    const step = Math.floor(clock.elapsedTime * 5)
    const c = cheerAge()
    BULBS.forEach((_, i) => {
      const on = c >= 0 && c < 3 ? (step + i) % 2 === 0 : (step + i) % 5 !== 0
      dim.copy(BULB_COLORS[(i + step) % BULB_COLORS.length]).multiplyScalar(on ? 1 : 0.15)
      im.setColorAt(i, dim)
    })
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, BULBS.length]} frustumCulled={false} />
}

// ---------------------------------------------------------------------------
// LED 字幕機：紅色點陣，一直往左捲（招牌下面）
// ---------------------------------------------------------------------------

const COLS = 168
const ROWS = 14

function Ticker({ mode }: { mode: StageMode }) {
  const mats = useMats()
  const msg = `${TROUPE}　${mode === 'tudigong' ? '恭祝 福德正神 聖誕千秋' : '中元普渡　慶讚中元'}　今晚戲碼：陳三五娘　歡迎鄉親闔府光臨　　`
  const { tex, draw } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = COLS * 4
    c.height = ROWS * 4
    const ctx = c.getContext('2d')!
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    // 把字畫在小畫布上，取每個像素當 LED
    const src = document.createElement('canvas')
    const sctx = src.getContext('2d')!
    sctx.font = `700 ${ROWS - 1}px "Noto Sans TC", sans-serif`
    const width = Math.ceil(sctx.measureText(msg).width) + COLS
    src.width = width
    src.height = ROWS
    sctx.font = `700 ${ROWS - 1}px "Noto Sans TC", sans-serif`
    sctx.fillStyle = '#fff'
    sctx.textBaseline = 'middle'
    sctx.fillText(msg, 0, ROWS / 2 + 1)
    const px = sctx.getImageData(0, 0, width, ROWS).data
    const draw = (offset: number) => {
      ctx.fillStyle = '#0a0506'
      ctx.fillRect(0, 0, c.width, c.height)
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const sx = (x + offset) % width
          const lit = px[(y * width + sx) * 4 + 3] > 110
          ctx.fillStyle = lit ? '#ff3a2a' : '#2a0a08'
          ctx.fillRect(x * 4 + 0.5, y * 4 + 0.5, 3, 3)
        }
      }
      t.needsUpdate = true
    }
    draw(0)
    return { tex: t, draw }
  }, [msg])
  const last = useRef(-1)
  useFrame(({ clock }) => {
    const off = Math.floor(clock.elapsedTime * 26)
    if (off !== last.current) {
      last.current = off
      draw(off)
    }
  })
  return (
    <group position={[FRONT + 0.1, 3.5, CZ]}>
      <mesh material={mats.black}>
        <boxGeometry args={[0.05, 0.3, 3.3]} />
      </mesh>
      <mesh position={[0.03, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[3.2, 0.26]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 後場的鼓棒：阿嬤幫過忙之後，鼓自己打起來（台下的人以為是阿明酒醒了）
// ---------------------------------------------------------------------------

function BandSticks() {
  const mats = useMats()
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  const mallet = useRef<THREE.Group>(null)
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 1.5), toneMapped: false, transparent: true, opacity: 0.6 }), [])
  const aura = useRef<THREE.Mesh>(null)
  const b = STAGE.band
  useFrame(({ clock }) => {
    const helped = !!useStore.getState().flags.stage_rhythm_today
    const t = clock.elapsedTime
    // 八分音符交替；沒人打的時候鼓棒擱在鼓上
    const ph = (t / (BEAT / 2)) % 2
    const hitL = helped ? Math.max(0, Math.sin(Math.min(1, ph) * Math.PI)) : 0
    const hitR = helped ? Math.max(0, Math.sin(Math.max(0, ph - 1) * Math.PI)) : 0
    if (left.current) left.current.rotation.z = helped ? -0.2 - hitL * 0.7 : 0.05
    if (right.current) right.current.rotation.z = helped ? -0.2 - hitR * 0.7 : 0.08
    if (mallet.current) {
      const g = helped ? (t / (BEAT * 4)) % 1 : 0
      mallet.current.rotation.x = helped ? Math.sin(g * Math.PI * 2) * 0.5 : 0
    }
    if (aura.current) aura.current.visible = helped
  })
  const y = D.y + 0.88
  return (
    <group>
      <group position={[b.x + 0.2, y, b.z - 0.15]}>
        <group ref={left} position={[0.12, 0.02, -0.12]}>
          <mesh material={mats.bamboo} position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.014, 0.34, 6]} />
          </mesh>
        </group>
        <group ref={right} position={[0.12, 0.02, 0.12]}>
          <mesh material={mats.bamboo} position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.014, 0.34, 6]} />
          </mesh>
        </group>
        {/* 看不見的鼓手（阿嬤）：淡淡的青光 */}
        <mesh ref={aura} material={glow} position={[0.4, 0.1, 0]} visible={false}>
          <sphereGeometry args={[0.16, 10, 8]} />
        </mesh>
      </group>
      <group ref={mallet} position={[D.x0 + 0.62, D.y + 1.1, b.z + 0.25]}>
        <mesh material={mats.darkWood} position={[0, -0.18, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.36, 6]} />
        </mesh>
        <mesh material={mats.cloth} position={[0, -0.38, 0]}>
          <sphereGeometry args={[0.04, 8, 6]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 彩帶：謝幕時從棚頂灑下來
// ---------------------------------------------------------------------------

const CONFETTI = 64

function Confetti() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.PlaneGeometry(0.09, 0.15), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), [])
  const bits = useMemo(() => {
    const r = seeded(808)
    return Array.from({ length: CONFETTI }, () => ({ z: D.z0 + r() * (D.z1 - D.z0), vx: 0.4 + r() * 1.2, vz: (r() - 0.5) * 0.6, spin: r() * 8, delay: r() * 0.6, c: Math.floor(r() * 5) }))
  }, [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const colored = useRef(false)
  useFrame(() => {
    const im = mesh.current
    if (!im) return
    if (!colored.current) {
      bits.forEach((b, i) => im.setColorAt(i, BULB_COLORS[b.c]))
      if (im.instanceColor) im.instanceColor.needsUpdate = true
      colored.current = true
    }
    const c = cheerAge()
    im.visible = c >= 0 && c < 5
    if (!im.visible) return
    bits.forEach((b, i) => {
      const t = Math.max(0, c - b.delay)
      const y = 4.3 - t * 0.7 - Math.max(0, t - 0.4) * t * 0.12
      tmp.position.set(FRONT + b.vx * t * 0.8, Math.max(0.05, y), b.z + b.vz * t + Math.sin(t * 3 + i) * 0.1)
      tmp.rotation.set(t * b.spin, t * b.spin * 0.7, t * 2)
      tmp.updateMatrix()
      im.setMatrixAt(i, tmp.matrix)
    })
    im.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, CONFETTI]} frustumCulled={false} visible={false} />
}

// ---------------------------------------------------------------------------
// 七字調：靠近戲台聽得到（合成，走 music 匯流排）；阿嬤幫忙後加上鑼鼓
// ---------------------------------------------------------------------------

function StageMusic() {
  useEffect(() => {
    let gain: GainNode | null = null
    let next = 0
    let phrase = 0
    const id = window.setInterval(() => {
      const ctx = audio.ctx
      if (!ctx) return
      if (!gain) {
        gain = ctx.createGain()
        gain.gain.value = 0
        gain.connect(audio.bus.music)
      }
      const s = useStore.getState()
      const active = s.started && s.scene === 'temple' && !s.minigame && !s.transitioning && !s.dialogue
      const d = Math.hypot(player.x - CX, player.z - CZ)
      const target = active ? THREE.MathUtils.clamp(1 - (d - 5) / 15, 0, 1) * 0.85 : 0
      gain.gain.setTargetAtTime(target, ctx.currentTime, 0.4)
      if (target <= 0.01) {
        next = 0
        return
      }
      const now = ctx.currentTime
      if (next < now) next = now + 0.15
      const helped = !!s.flags.stage_rhythm_today
      while (next < now + 0.8) {
        schedulePhrase(next, MELODY[phrase % MELODY.length], BEAT, 0.08, gain)
        for (let b = 0; b < 8; b++) {
          opera.clap(next + b * BEAT, b % 4 === 0 ? 0.2 : 0.1, gain)
          if (helped) {
            if (b % 2 === 0) opera.drum(next + b * BEAT, 0.35, gain)
            else opera.cymbal(next + b * BEAT, 0.16, gain)
          }
        }
        if (helped || phrase % 2 === 1) opera.gong(next + 7 * BEAT, 0.3, gain)
        next += 8 * BEAT
        phrase++
      }
    }, 200)
    return () => {
      window.clearInterval(id)
      const g = gain
      const ctx = audio.ctx
      if (g && ctx) {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.2)
        window.setTimeout(() => g.disconnect(), 1500)
      }
    }
  }, [])
  return null
}
