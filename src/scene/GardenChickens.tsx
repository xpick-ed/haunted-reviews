import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { GARDEN } from '../world/sceneGarden'
import { player } from '../world/player'
import { audio } from '../audio'
import { toon, outlineMat } from '../chars/toon'

// 雞圈裡的三隻母雞：到處走、低頭啄地。阿嬤撿了雞蛋，牠們會拍翅膀咕咕叫，
// 其中一隻（黑母雞）追著阿嬤啄幾秒，再走回雞圈。

const R = GARDEN.run
const WALK = 0.55
const CHASE = 2.3

interface Hen {
  x: number
  z: number
  heading: number
  tx: number
  tz: number
  wait: number
  peck: number
  flap: number
  speed: number
}

const HENS = [
  { color: '#f4efe4', tail: '#e6dccb', scale: 1.0 },
  { color: '#a0602c', tail: '#6a3a1a', scale: 0.95 },
  { color: '#3a3530', tail: '#1f2a2a', scale: 1.05 },
]

/** 咕咕咕：短短幾聲往下滑的方波，過帶通 */
function cluck(n = 3, pitch = 1) {
  const ctx = audio.ctx
  if (!ctx) return
  const t0 = ctx.currentTime
  for (let i = 0; i < n; i++) {
    const t = t0 + i * 0.14 + Math.random() * 0.05
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.setValueAtTime((820 + Math.random() * 220) * pitch, t)
    o.frequency.exponentialRampToValueAtTime(460 * pitch, t + 0.09)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1300
    bp.Q.value = 2.5
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    o.connect(bp).connect(g).connect(audio.bus.sfx)
    o.start(t)
    o.stop(t + 0.12)
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const inRun = () => [rand(R.x0 + 0.5, R.x1 - 0.5), rand(R.z0 + 0.4, R.z1 - 0.5)] as const

export function GardenChickens() {
  const hens = useRef<Hen[]>(
    HENS.map(() => {
      const [x, z] = inRun()
      const [tx, tz] = inRun()
      return { x, z, heading: rand(0, 6.28), tx, tz, wait: rand(0, 2), peck: 0, flap: 0, speed: 0 }
    }),
  )
  const chase = useRef({ until: 0, started: 0 })
  const groups = useRef<(THREE.Group | null)[]>([])
  const heads = useRef<(THREE.Group | null)[]>([])
  const wings = useRef<(THREE.Mesh | null)[][]>([[], [], []])
  const clockT = useRef(0)

  // 撿了雞蛋：全部拍翅膀、咕咕叫，黑母雞追阿嬤
  const egg = useStore((s) => !!s.flags.garden_egg_today)
  const prevEgg = useRef(egg)
  useEffect(() => {
    if (egg && !prevEgg.current) {
      const t = clockT.current
      for (const h of hens.current) h.flap = 1.4
      chase.current = { until: t + 4.2, started: t }
      cluck(5, 1.1)
      window.setTimeout(() => cluck(4, 0.95), 700)
      window.setTimeout(() => useStore.getState().bark('garden.egg.chase'), 2000)
    }
    prevEgg.current = egg
  }, [egg])

  // 平常偶爾咕一聲
  useEffect(() => {
    const id = window.setInterval(() => {
      if (Math.random() < 0.5 && useStore.getState().scene === 'garden') cluck(2 + Math.floor(Math.random() * 2), 0.9 + Math.random() * 0.2)
    }, 5200)
    return () => window.clearInterval(id)
  }, [])

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime
    clockT.current = t
    hens.current.forEach((h, i) => {
      const chasing = i === 2 && t < chase.current.until
      let tx = h.tx
      let tz = h.tz
      if (chasing) {
        tx = player.x
        tz = player.z
      } else if (i === 2 && chase.current.until > 0 && t - chase.current.until < 6 && (h.x < R.x0 || h.z > R.z1)) {
        // 追完了：從門走回雞圈
        tx = R.x0 + 0.6
        tz = R.gateZ
      }
      const dx = tx - h.x
      const dz = tz - h.z
      const d = Math.hypot(dx, dz)
      let speed = 0
      if (chasing) {
        if (d > 0.5) speed = CHASE
      } else if (h.wait > 0) {
        h.wait -= dt
        if (h.wait <= 0) {
          const [nx, nz] = inRun()
          h.tx = nx
          h.tz = nz
        }
      } else if (d > 0.15) {
        speed = WALK
      } else {
        h.wait = rand(1, 3.5)
      }
      h.speed += (speed - h.speed) * (1 - Math.exp(-8 * dt))
      if (h.speed > 0.02 && d > 0.01) {
        const step = Math.min(d, h.speed * dt)
        h.x += (dx / d) * step
        h.z += (dz / d) * step
        const want = Math.atan2(dx, dz)
        let diff = want - h.heading
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        h.heading += diff * (1 - Math.exp(-10 * dt))
      }
      h.flap = Math.max(0, h.flap - dt)
      // 站著的時候啄地
      if (h.speed < 0.1) h.peck += dt
      const g = groups.current[i]
      if (g) {
        const hop = h.speed > 0.3 ? Math.abs(Math.sin(t * 14 + i)) * 0.04 * (h.speed / CHASE + 0.4) : 0
        g.position.set(h.x, hop + (h.flap > 0 ? Math.abs(Math.sin(t * 9)) * 0.12 : 0), h.z)
        g.rotation.y = h.heading
        g.rotation.z = h.speed > 0.2 ? Math.sin(t * 12 + i) * 0.06 : 0
      }
      const head = heads.current[i]
      if (head) {
        const pecking = h.speed < 0.1 && Math.sin(h.peck * 2.3 + i) > 0.55
        head.rotation.x += ((pecking ? 1.1 : chasing ? 0.35 : Math.sin(t * 1.7 + i) * 0.12) - head.rotation.x) * (1 - Math.exp(-14 * dt))
        head.position.z = 0.17 + (h.speed > 0.2 ? Math.sin(t * 14 + i) * 0.03 : 0)
      }
      for (const [k, w] of wings.current[i].entries()) {
        if (!w) continue
        const s = k === 0 ? 1 : -1
        w.rotation.z = h.flap > 0 ? s * (0.3 + Math.abs(Math.sin(t * 22)) * 1.1) : s * 0.05
      }
    })
  })

  return (
    <group userData={{ noMerge: true }}>
      {HENS.map((c, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el
          }}
          scale={c.scale}
        >
          <HenBody
            color={c.color}
            tail={c.tail}
            headRef={(el) => {
              heads.current[i] = el
            }}
            wingRef={(k, el) => {
              wings.current[i][k] = el
            }}
          />
        </group>
      ))}
    </group>
  )
}

function HenBody({
  color,
  tail,
  headRef,
  wingRef,
}: {
  color: string
  tail: string
  headRef: (el: THREE.Group | null) => void
  wingRef: (k: number, el: THREE.Mesh | null) => void
}) {
  const m = useMemo(
    () => ({
      body: toon(color),
      tail: toon(tail),
      comb: toon('#d8342b'),
      beak: toon('#f0a830'),
      leg: toon('#e8a23a'),
      eye: new THREE.MeshBasicMaterial({ color: '#141414' }),
      // 描邊厚度要除以球的縮放，身體和頭看起來才一樣粗
      line: outlineMat(0.012 / 0.18),
      lineHead: outlineMat(0.012 / 0.085),
    }),
    [color, tail],
  )
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 16, 12), [])
  return (
    <group>
      {/* 身體＋描邊 */}
      <mesh geometry={sphere} material={m.body} position={[0, 0.27, -0.02]} scale={[0.17, 0.16, 0.22]} castShadow />
      <mesh geometry={sphere} material={m.line} position={[0, 0.27, -0.02]} scale={[0.17, 0.16, 0.22]} />
      {/* 尾巴 */}
      <mesh material={m.tail} position={[0, 0.38, -0.2]} rotation={[-0.7, 0, 0]} castShadow>
        <coneGeometry args={[0.09, 0.22, 8]} />
      </mesh>
      {/* 翅膀 */}
      {[1, -1].map((s, k) => (
        <mesh
          key={s}
          ref={(el) => wingRef(k, el)}
          geometry={sphere}
          material={m.body}
          position={[s * 0.15, 0.3, -0.03]}
          scale={[0.04, 0.1, 0.15]}
          castShadow
        />
      ))}
      {/* 腳 */}
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} material={m.leg} position={[x, 0.06, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.13, 5]} />
        </mesh>
      ))}
      {/* 頭：雞冠、肉垂、嘴、眼 */}
      <group ref={headRef} position={[0, 0.42, 0.17]}>
        <mesh geometry={sphere} material={m.body} scale={0.085} castShadow />
        <mesh geometry={sphere} material={m.lineHead} scale={0.085} />
        {[-0.03, 0, 0.03].map((z, i) => (
          <mesh key={z} geometry={sphere} material={m.comb} position={[0, 0.085 + (i === 1 ? 0.01 : 0), z]} scale={0.028} />
        ))}
        <mesh geometry={sphere} material={m.comb} position={[0, -0.06, 0.06]} scale={[0.018, 0.028, 0.018]} />
        <mesh material={m.beak} position={[0, -0.005, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.022, 0.06, 6]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={sphere} material={m.eye} position={[s * 0.06, 0.02, 0.05]} scale={0.013} />
        ))}
      </group>
    </group>
  )
}
