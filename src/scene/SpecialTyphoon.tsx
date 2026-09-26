import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio'
import { ChibiNpc } from '../chars/Chibi'
import { HOME } from '../world/scenes'
import { CANDLES, SHUTTER, TYPHOON, typhoonNow } from '../world/night/special'
import { FLOOR_Y, GUEST_WINDOW_IN_Z, MAIN, WING_L, WING_R } from './layout'

// 颱風夜的畫面（DESIGN §31.3）：斜斜的雨、飛過去的葉子、閃電（最少隔 20 秒一次；prefers-reduced-motion 不閃）、
// 雨聲、釘起來的窗戶、客房一被吹得一直拍的窗板、漏水（水滴、積水、水桶）、神明廳的兩根蠟燭、拿手電筒的小翰。
// 邏輯在 src/world/night/special.ts（Typhoon）；傍晚只有雨和釘窗戶（模擬還沒開始）。

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** 房子的範圍（雨不下在屋頂下面，不然屋頂淡出時房間裡在下雨） */
const ROOFS = [
  { x0: MAIN.x0 - 0.3, x1: MAIN.x1 + 0.3, z0: MAIN.z0 - 0.3, z1: MAIN.z1 + 1.4 },
  { x0: WING_R.x0 - 1.0, x1: WING_R.x1 + 0.3, z0: WING_R.z0, z1: WING_R.z1 + 0.3 },
  { x0: WING_L.x0 - 0.3, x1: WING_L.x1 + 1.0, z0: WING_L.z0, z1: WING_L.z1 + 0.3 },
]
const underRoof = (x: number, z: number) => ROOFS.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)
/** 雨的範圍：整個三合院外加一點 */
const AREA = { x0: -15, x1: 15, z0: -12, z1: 13, top: 9 }
const WIND = 3.2

export function TyphoonLayer({ night }: { night: boolean }) {
  const quality = useStore((s) => s.quality)
  return (
    <group userData={{ noMerge: true }}>
      <Rain count={quality === 'high' ? 720 : 300} night={night} />
      <Leaves />
      <RainSound night={night} />
      <WindowBoards />
      {night && (
        <>
          <Lightning />
          <Shutter />
          <Leaks />
          <HallCandles />
          <HanShelter outline={quality === 'high'} />
        </>
      )}
    </group>
  )
}

/** 雨有多大：傍晚小、晚上大、兩點的大風最大、天亮前停 */
function rainAmount(night: boolean, time: number) {
  if (!night) return 0.35 + Math.max(0, (time - 19) / 3) * 0.3
  if (time >= TYPHOON.dawnAt) return Math.max(0, 1 - (time - TYPHOON.dawnAt) * 4)
  if (time >= TYPHOON.gustAt && time < TYPHOON.gustAt + 1.2) return 1
  return 0.8
}

// ---------------------------------------------------------------------------
// 雨、葉子、雨聲、閃電
// ---------------------------------------------------------------------------

function Rain({ count, night }: { count: number; night: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.BoxGeometry(0.014, 0.55, 0.014), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#c4d4e4', transparent: true, opacity: 0.32, depthWrite: false }), [])
  const drops = useMemo(() => {
    const out: { x: number; y: number; z: number; v: number }[] = []
    for (let i = 0; i < count; i++) out.push({ ...spawn(), y: Math.random() * AREA.top, v: 11 + Math.random() * 5 })
    return out
  }, [count])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.atan2(WIND, 13))), [])
  const s = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, raw) => {
    const im = mesh.current
    if (!im) return
    const dt = Math.min(raw, 0.1)
    const amount = rainAmount(night, useStore.getState().time)
    const n = Math.floor(drops.length * amount)
    im.count = n
    for (let i = 0; i < n; i++) {
      const d = drops[i]
      d.y -= d.v * dt
      d.x -= WIND * dt
      if (d.y < 0 || underRoof(d.x, d.z)) {
        Object.assign(d, spawn())
        d.y = AREA.top
      }
      m.compose(p.set(d.x, d.y, d.z), q, s)
      im.setMatrixAt(i, m)
    }
    im.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, count]} frustumCulled={false} renderOrder={5} />
}

function spawn() {
  for (let k = 0; k < 8; k++) {
    const x = AREA.x0 + Math.random() * (AREA.x1 - AREA.x0)
    const z = AREA.z0 + Math.random() * (AREA.z1 - AREA.z0)
    if (!underRoof(x, z)) return { x, y: AREA.top, z }
  }
  return { x: 0, y: AREA.top, z: 4 }
}

/** 被風吹過去的葉子 */
function Leaves() {
  const group = useRef<THREE.Group>(null)
  const leaves = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: -14 + Math.random() * 28, y: 0.6 + Math.random() * 4, z: -9 + Math.random() * 20, v: 3 + Math.random() * 3, spin: Math.random() * 6, i })), [])
  const mats = useMemo(() => ['#5f7a3a', '#7a8a3e', '#8a6a3a'].map((c) => new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.8 })), [])
  useFrame(({ clock }, raw) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(raw, 0.1)
    const t = clock.elapsedTime
    leaves.forEach((l, i) => {
      l.x -= l.v * dt
      l.y += Math.sin(t * 2 + i) * dt * 0.8
      if (l.x < -15) {
        l.x = 15
        l.y = 0.6 + Math.random() * 4
        l.z = -9 + Math.random() * 20
      }
      const o = g.children[i]
      o.position.set(l.x, l.y, l.z)
      o.rotation.set(t * l.spin, t * 1.3 + i, t * 0.7)
    })
  })
  return (
    <group ref={group}>
      {leaves.map((l) => (
        <mesh key={l.i} material={mats[l.i % mats.length]}>
          <planeGeometry args={[0.16, 0.09]} />
        </mesh>
      ))}
    </group>
  )
}

/** 雨聲：白噪音過濾，跟著雨的大小 */
function RainSound({ night }: { night: boolean }) {
  const gain = useRef<GainNode | null>(null)
  useEffect(() => {
    const ctx = audio.ctx
    if (!ctx) return
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 900
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 5200
    const g = ctx.createGain()
    g.gain.value = 0
    src.connect(hp).connect(lp).connect(g).connect(audio.bus.ambience)
    src.start()
    gain.current = g
    return () => {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
      window.setTimeout(() => {
        try {
          src.stop()
        } catch {
          /* 已經停了 */
        }
        src.disconnect()
      }, 1500)
      gain.current = null
    }
  }, [])
  useFrame(() => {
    const g = gain.current
    const ctx = audio.ctx
    if (!g || !ctx) return
    const target = rainAmount(night, useStore.getState().time) * 0.22
    g.gain.setTargetAtTime(target, ctx.currentTime, 0.5)
  })
  return null
}

/** 閃電：跟著模擬的雷聲（thunderN 變了）；最少隔 20 秒閃一次；減少動態效果時只有雷聲 */
function Lightning() {
  const light = useRef<THREE.DirectionalLight>(null)
  const seen = useRef(-1)
  const lastFlash = useRef(-99)
  const flash = useRef(0)
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.1)
    const t = typhoonNow()
    if (t && t.thunderN !== seen.current) {
      const first = seen.current < 0
      seen.current = t.thunderN
      if (!first) {
        const now = clock.elapsedTime
        const far = Math.random()
        window.setTimeout(() => audio.thunder(), 200 + far * 1500)
        if (!reducedMotion() && now - lastFlash.current >= 20) {
          lastFlash.current = now
          flash.current = 1
        }
      }
    }
    flash.current = Math.max(0, flash.current - dt * 2.2)
    // 一次亮、慢慢暗（不連閃）
    if (light.current) light.current.intensity = flash.current * flash.current * 4
  })
  return <directionalLight ref={light} position={[-12, 20, 8]} color="#d6e4ff" intensity={0} />
}

// ---------------------------------------------------------------------------
// 釘起來的窗戶、拍打的窗板
// ---------------------------------------------------------------------------

const wood = new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.9 })
const woodDark = new THREE.MeshStandardMaterial({ color: '#5e4630', roughness: 0.9 })

/** 小翰傍晚釘在窗戶外面的兩片木板（打叉） */
function WindowBoards() {
  const y = FLOOR_Y + 1.575
  const spots: { p: [number, number, number]; ry: number }[] = [
    { p: [-4.4, y, MAIN.z1 + 0.07], ry: 0 },
    { p: [4.4, y, MAIN.z1 + 0.07], ry: 0 },
    { p: [WING_L.x1 + 0.07, FLOOR_Y + 1.5, GUEST_WINDOW_IN_Z], ry: Math.PI / 2 },
  ]
  return (
    <group>
      {spots.map((s, i) => (
        <group key={i} position={s.p} rotation={[0, s.ry, 0]}>
          {[0.72, -0.72].map((a) => (
            <mesh key={a} material={wood} rotation={[0, 0, a]} castShadow>
              <boxGeometry args={[1.62, 0.16, 0.04]} />
            </mesh>
          ))}
          {[-1, 1].map((sx) =>
            [-1, 1].map((sy) => (
              <mesh key={`${sx}${sy}`} material={woodDark} position={[sx * 0.52, sy * 0.47, 0.03]}>
                <sphereGeometry args={[0.025, 6, 4]} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  )
}

/** 客房一朝埕的窗板：23:00 被風吹開，一直拍；阿嬤扣好就不動了 */
function Shutter() {
  const hinge = useRef<THREE.Group>(null)
  const W = 1.1
  useFrame(({ clock }) => {
    const h = hinge.current
    const t = typhoonNow()
    if (!h || !t) return
    const sh = t.shutter
    let a = 0
    if (sh.banging) {
      const since = t.t - sh.lastBang
      // 砰一下關上，再被風吹開、晃來晃去
      a = since < 0.12 ? 0 : Math.min(1.25, (since - 0.12) * 3) + Math.sin(clock.elapsedTime * 6.5) * 0.07
    }
    h.rotation.y = a
  })
  return (
    <group name="sp-shutter" position={[SHUTTER.x - 0.05, FLOOR_Y + 1.5, SHUTTER.z + W / 2]}>
      <group ref={hinge}>
        <mesh material={wood} position={[0, 0, -W / 2]} castShadow>
          <boxGeometry args={[0.05, 1.1, W]} />
        </mesh>
        {[-0.3, 0, 0.3].map((y) => (
          <mesh key={y} material={woodDark} position={[-0.03, y, -W / 2]}>
            <boxGeometry args={[0.02, 0.06, W - 0.08]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 漏水
// ---------------------------------------------------------------------------

const waterMat = new THREE.MeshStandardMaterial({ color: '#7f97ad', transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2, depthWrite: false })
const dropMat = new THREE.MeshBasicMaterial({ color: '#cfe2f2', transparent: true, opacity: 0.85 })
const bucketMat = new THREE.MeshStandardMaterial({ color: '#8fa0ae', roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide })

function Leaks() {
  const n = TYPHOON.leaks.length
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <Leak key={i} i={i} />
      ))}
    </group>
  )
}

function Leak({ i }: { i: number }) {
  const g = useRef<THREE.Group>(null)
  const puddle = useRef<THREE.Mesh>(null)
  const bucket = useRef<THREE.Group>(null)
  const drops = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    const t = typhoonNow()
    const l = t?.leaks[i]
    const grp = g.current
    if (!grp) return
    grp.visible = !!l?.active
    if (!l || !l.active) return
    const y0 = HOME.floorAt(l.x, l.z)
    grp.position.set(l.x, y0, l.z)
    if (puddle.current) puddle.current.scale.setScalar(0.15 + l.spill * 0.5)
    if (bucket.current) bucket.current.visible = l.bucket
    const top = 2.9 - y0
    const bottom = l.bucket ? 0.3 : 0.02
    drops.current.forEach((d, k) => {
      if (!d) return
      const ph = (clock.elapsedTime * 1.4 + k / 3) % 1
      d.position.y = top - (top - bottom) * ph * ph
    })
  })
  return (
    <group ref={g} visible={false}>
      <mesh ref={puddle} material={waterMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[1, 20]} />
      </mesh>
      {[0, 1, 2].map((k) => (
        <mesh
          key={k}
          ref={(m) => {
            drops.current[k] = m
          }}
          material={dropMat}
        >
          <sphereGeometry args={[0.028, 6, 5]} />
        </mesh>
      ))}
      <group ref={bucket} visible={false}>
        <mesh material={bucketMat} position={[0, 0.15, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.16, 0.3, 14, 1, true]} />
        </mesh>
        <mesh material={bucketMat} position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.16, 14]} />
        </mesh>
        <mesh material={waterMat} position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.185, 14]} />
        </mesh>
        <mesh material={bucketMat} position={[0, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.2, 0.008, 4, 16, Math.PI]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 神明廳：兩根紅蠟燭、拿手電筒的小翰
// ---------------------------------------------------------------------------

const candleMat = new THREE.MeshStandardMaterial({ color: '#c8322a', roughness: 0.6 })
const flameMat = new THREE.MeshBasicMaterial({ color: '#ffc964', toneMapped: false })
const smokeMat = new THREE.MeshBasicMaterial({ color: '#9a9a9a', transparent: true, opacity: 0.4, depthWrite: false })

/** 燭火外面一圈光暈（遠遠的也看得到蠟燭亮著） */
let GLOW: THREE.SpriteMaterial | null = null
function glowMat() {
  if (GLOW) return GLOW
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,230,160,1)')
  g.addColorStop(0.4, 'rgba(255,170,80,0.45)')
  g.addColorStop(1, 'rgba(255,140,60,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  GLOW = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  return GLOW
}

function HallCandles() {
  const group = useRef<THREE.Group>(null)
  const glows = useRef<(THREE.Sprite | null)[]>([])
  const flames = useRef<(THREE.Mesh | null)[]>([])
  const smokes = useRef<(THREE.Mesh | null)[]>([])
  const light = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const t = typhoonNow()
    const g = group.current
    if (!g) return
    const show = !!t && t.gather !== 'wait'
    g.visible = show
    if (!t || !show) return
    const tm = clock.elapsedTime
    for (let k = 0; k < 2; k++) {
      const f = flames.current[k]
      const lit = t.candles[k]
      const gl = glows.current[k]
      if (gl) gl.visible = lit
      if (f) {
        f.visible = lit
        const w = 1 + Math.sin(tm * 17 + k * 3) * 0.12 + Math.sin(tm * 7.3 + k) * 0.08
        f.scale.set(1, w, 1)
      }
      const s = smokes.current[k]
      if (s) {
        s.visible = !lit
        s.position.y = 0.34 + ((tm * 0.4 + k * 0.5) % 1) * 0.3
      }
    }
    if (light.current) light.current.intensity = t.litCount * (1.3 + Math.sin(tm * 11) * 0.12)
  })
  return (
    <group ref={group} position={[CANDLES.x, CANDLES.y, CANDLES.z]} visible={false}>
      {[-0.26, 0.26].map((x, k) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={candleMat} position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.045, 0.05, 0.26, 10]} />
          </mesh>
          <mesh
            ref={(m) => {
              flames.current[k] = m
            }}
            material={flameMat}
            position={[0, 0.31, 0]}
          >
            <coneGeometry args={[0.032, 0.1, 8]} />
          </mesh>
          <sprite
            ref={(m) => {
              glows.current[k] = m
            }}
            material={glowMat()}
            position={[0, 0.32, 0]}
            scale={[0.42, 0.42, 1]}
          />
          <mesh
            ref={(m) => {
              smokes.current[k] = m
            }}
            material={smokeMat}
            position={[0, 0.3, 0]}
          >
            <sphereGeometry args={[0.03, 6, 4]} />
          </mesh>
        </group>
      ))}
      <pointLight ref={light} position={[0, 0.5, 0.3]} color="#ffb060" intensity={0} distance={6} decay={2} />
    </group>
  )
}

/** 大風之後：小翰拿手電筒站在神明廳門口顧大家（他看不到阿嬤） */
function HanShelter({ outline }: { outline: boolean }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = typhoonNow()
    if (group.current) group.current.visible = !!t?.sheltering
  })
  return (
    <group ref={group} visible={false}>
      <ChibiNpc id="xiaohan" pose="flashlight" position={[1.75, FLOOR_Y, MAIN.z1 - 0.45]} heading={-2.3} outline={outline} />
    </group>
  )
}
