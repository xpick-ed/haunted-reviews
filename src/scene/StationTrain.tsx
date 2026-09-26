import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio'
import { STATION, ghostTrain } from '../world/sceneStation'
import { canvasTexture, seeded } from './kit'
import { ChibiNpc, type PoseName } from '../chars/Chibi'

// 末班鬼火車（DESIGN §27.1）：半夜 00:00 從西邊滑進站，半透明、窗戶透著暖黃的光，
// 停靠時鬼車掌和鬼乘客在月台上，00:40 過後鳴笛開走。位置與時間由 sceneStation.ts 的 ghostTrain() 決定。
// 車身是半透明的：它停在月台和鏡頭中間，不能把月台上的阿嬤擋住。

const S = STATION
const CAR_LEN = 8.9
const CARS = [-9.3, 0, 9.3]
const CAR_H = 2.55
const CAR_W = 2.45
const FLOOR = 0.62

/** 車窗：暖黃的光，裡面坐著一排排黑黑的人影 */
function windowTexture(seed: number) {
  return canvasTexture(512, 96, (ctx, w, h) => {
    const r = seeded(seed)
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#ffe9b0')
    g.addColorStop(1, '#f2c070')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // 人影：圓頭＋肩膀，有的戴帽子
    for (let i = 0; i < 9; i++) {
      if (r() < 0.25) continue
      const x = 20 + i * 56 + r() * 16
      const y = 42 + r() * 10
      ctx.fillStyle = `rgba(30,40,50,${0.55 + r() * 0.3})`
      ctx.beginPath()
      ctx.arc(x, y, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(x, y + 34, 22, 20, 0, Math.PI, 0)
      ctx.fill()
      if (r() < 0.3) ctx.fillRect(x - 15, y - 14, 30, 5)
    }
    // 窗框
    ctx.fillStyle = '#26324a'
    for (let i = 0; i <= 8; i++) ctx.fillRect(i * 64 - 3, 0, 6, h)
  })
}

const glowTex = canvasTexture(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(255,250,220,1)')
  g.addColorStop(0.3, 'rgba(200,255,240,0.5)')
  g.addColorStop(1, 'rgba(160,255,230,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

// ---------------------------------------------------------------------------
// 聲音：鳴笛（兩個音一起）、煞車的嘶聲
// ---------------------------------------------------------------------------

function horn(len = 1.1) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.08)
  g.gain.setValueAtTime(0.12, t + len - 0.2)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  for (const f of [311, 392]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f * 0.98, t)
    o.frequency.linearRampToValueAtTime(f, t + 0.15)
    o.connect(lp)
    o.start(t)
    o.stop(t + len + 0.05)
  }
  // 鬼火車：加一點回音
  const delay = ctx.createDelay()
  delay.delayTime.value = 0.28
  const fb = ctx.createGain()
  fb.gain.value = 0.35
  lp.connect(g)
  g.connect(audio.bus.sfx)
  g.connect(delay)
  delay.connect(fb).connect(delay)
  delay.connect(audio.bus.sfx)
}

function hiss() {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const n = ctx.createBuffer(1, ctx.sampleRate * 0.9, ctx.sampleRate)
  const d = n.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = n
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2500
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.09, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85)
  src.connect(hp).connect(g).connect(audio.bus.sfx)
  src.start(t)
}

// ---------------------------------------------------------------------------

const PASSENGER_IDS = ['ghost_student', 'ghost_farmer', 'ghost_bride', 'ghost_soldier']
const PASSENGER_POSE: PoseName[] = ['idle', 'fan', 'clasp', 'wave']

export function GhostTrain({ outline }: { outline: boolean }) {
  const group = useRef<THREE.Group>(null)
  const crew = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const head = useRef<THREE.Sprite>(null)
  const doors = useRef<(THREE.Mesh | null)[]>([])
  const state = useRef<'gone' | 'arrive' | 'stop' | 'leave'>('gone')
  const mats = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({ color: '#2d5c80', emissive: '#3fa0a0', emissiveIntensity: 0.25, roughness: 0.5, transparent: true, opacity: 0.45, depthWrite: false })
    const band = new THREE.MeshStandardMaterial({ color: '#d9e6dc', emissive: '#9fe8d8', emissiveIntensity: 0.3, roughness: 0.5, transparent: true, opacity: 0.45, depthWrite: false })
    const roof = new THREE.MeshStandardMaterial({ color: '#34414a', emissive: '#2a6a6a', emissiveIntensity: 0.2, roughness: 0.6, transparent: true, opacity: 0.4, depthWrite: false })
    const under = new THREE.MeshStandardMaterial({ color: '#1a1c20', roughness: 0.8, transparent: true, opacity: 0.5, depthWrite: false })
    const wins = [11, 22, 33].map((sd) => new THREE.MeshBasicMaterial({ map: windowTexture(sd), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }))
    const door = new THREE.MeshStandardMaterial({ color: '#244a68', emissive: '#ffd890', emissiveIntensity: 0, transparent: true, opacity: 0.55, depthWrite: false })
    return { body, band, roof, under, wins, door }
  }, [])

  useFrame(({ clock }) => {
    const s = useStore.getState()
    const g = group.current
    if (!g) return
    const tr = s.scene === 'station' ? ghostTrain(s.time, s.phase) : null
    g.visible = !!tr
    if (crew.current) crew.current.visible = !!tr?.stopped
    // 狀態切換時的聲音
    const next = !tr ? 'gone' : tr.stopped ? 'stop' : tr.x < 0 ? 'arrive' : 'leave'
    if (next !== state.current) {
      if (next === 'arrive' || next === 'leave') horn(next === 'arrive' ? 1.3 : 0.9)
      if (next === 'stop') hiss()
      state.current = next
    }
    if (!tr) return
    const t = clock.elapsedTime
    // 鬼火車：飄著、有一點點上下浮動
    g.position.set(tr.x, Math.sin(t * 1.3) * 0.03, S.trackZ)
    const f = tr.fade
    mats.body.opacity = 0.38 * f
    mats.band.opacity = 0.42 * f
    mats.roof.opacity = 0.4 * f
    mats.under.opacity = 0.5 * f
    mats.wins.forEach((w, i) => (w.opacity = (0.55 + Math.sin(t * 7 + i * 2.1) * 0.04) * f))
    mats.door.opacity = 0.55 * f
    mats.door.emissiveIntensity = tr.stopped ? 1.2 : 0
    // 停靠時門打開（往旁邊滑）
    doors.current.forEach((d, i) => {
      if (!d) return
      const open = tr.stopped ? 1 : 0
      d.position.x = (i % 2 ? 1 : -1) * (0.45 + open * 0.55)
    })
    if (light.current) light.current.intensity = 4 * f
    if (head.current) {
      head.current.visible = !tr.stopped
      head.current.scale.setScalar(1.4 + Math.sin(t * 9) * 0.08)
    }
  })

  return (
    <group userData={{ noMerge: true }}>
      <group ref={group} visible={false}>
        {CARS.map((cx, ci) => (
          <group key={cx} position={[cx, 0, 0]}>
            {/* 車身：下半藍、中間一條淡色帶、上半藍 */}
            <mesh material={mats.body} position={[0, FLOOR + CAR_H * 0.3, 0]}>
              <boxGeometry args={[CAR_LEN, CAR_H * 0.6, CAR_W]} />
            </mesh>
            <mesh material={mats.band} position={[0, FLOOR + CAR_H * 0.63, 0]}>
              <boxGeometry args={[CAR_LEN, 0.08, CAR_W + 0.01]} />
            </mesh>
            <mesh material={mats.body} position={[0, FLOOR + CAR_H * 0.82, 0]}>
              <boxGeometry args={[CAR_LEN, CAR_H * 0.36, CAR_W]} />
            </mesh>
            {/* 圓弧的車頂 */}
            <mesh material={mats.roof} position={[0, FLOOR + CAR_H, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.26, 1, 1]}>
              <cylinderGeometry args={[CAR_W / 2, CAR_W / 2, CAR_LEN, 16, 1, false, 0, Math.PI]} />
            </mesh>
            {/* 車窗（兩側） */}
            {[-1, 1].map((sd) => (
              <mesh key={sd} material={mats.wins[ci]} position={[0, FLOOR + CAR_H * 0.52, sd * (CAR_W / 2 + 0.012)]} rotation={[0, sd < 0 ? Math.PI : 0, 0]}>
                <planeGeometry args={[CAR_LEN - 1.6, 0.62]} />
              </mesh>
            ))}
            {/* 月台那一側的門（兩扇，停靠時滑開） */}
            <group position={[0, FLOOR + CAR_H * 0.42, -(CAR_W / 2 + 0.02)]}>
              {[0, 1].map((k) => (
                <mesh
                  key={k}
                  ref={(el) => {
                    doors.current[ci * 2 + k] = el
                  }}
                  material={mats.door}
                  position={[(k ? 1 : -1) * 0.45, 0, 0]}
                >
                  <boxGeometry args={[0.88, 1.65, 0.04]} />
                </mesh>
              ))}
            </group>
            {/* 底盤、轉向架 */}
            <mesh material={mats.under} position={[0, 0.42, 0]}>
              <boxGeometry args={[CAR_LEN - 0.6, 0.35, CAR_W - 0.3]} />
            </mesh>
            {[-3, 3].map((bx) => (
              <mesh key={bx} material={mats.under} position={[bx, 0.3, 0]}>
                <boxGeometry args={[1.8, 0.3, CAR_W - 0.4]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* 車頭燈（東邊，朝行進方向） */}
        <sprite ref={head} position={[CARS[2] + CAR_LEN / 2 + 0.1, FLOOR + 0.9, 0]} renderOrder={3}>
          <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        <pointLight ref={light} position={[0, 2.4, -1.8]} color="#bff6e8" intensity={0} distance={16} decay={1.6} />
      </group>
      {/* 停靠時：鬼車掌、鬼乘客站在月台上 */}
      <group ref={crew} visible={false}>
        <ChibiNpc id="conductor" pose="clasp" position={[S.conductor.x, S.platform.y, S.conductor.z]} heading={0.2} seesGhosts outline={outline} />
        {S.ghosts.map((p, i) => (
          <ChibiNpc key={i} id={PASSENGER_IDS[i]} pose={PASSENGER_POSE[i]} position={[p.x, S.platform.y, p.z]} heading={0.4 - i * 0.3} seesGhosts outline={outline} />
        ))}
      </group>
    </group>
  )
}
