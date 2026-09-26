import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { MEMORIES } from '../world/memories'
import { SCENES } from '../world/scenes'
import { night } from '../world/night/director'
import { ChibiNpc } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { canvasTexture } from './kit'
import { DIJIZHU } from './layout'

// 陰陽眼（DESIGN §26.2）：開著的時候才看得到的東西——回憶碎片的光、客人走過的腳印、灶腳的地基主。


SPECS.dijizhu ??= {
  ...SPECS.atu,
  id: 'dijizhu',
  scale: 0.78,
  ghost: true,
  top: { ...SPECS.atu.top, color: '#4f6f5c', print: undefined },
  bottom: { ...SPECS.atu.bottom, color: '#3a4a3f' },
}

const glowTex = canvasTexture(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(255,240,200,1)')
  g.addColorStop(0.3, 'rgba(255,214,140,0.55)')
  g.addColorStop(1, 'rgba(255,200,120,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

const footTex = canvasTexture(64, 96, (ctx, w, h) => {
  ctx.fillStyle = 'rgba(160,255,240,0.9)'
  ctx.beginPath()
  ctx.ellipse(w / 2, h * 0.62, w * 0.26, h * 0.3, 0, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.arc(w * (0.3 + i * 0.14), h * 0.22 - Math.abs(i - 1.5) * 4, w * 0.07, 0, Math.PI * 2)
    ctx.fill()
  }
})

export function VisionLayer() {
  const vision = useStore((s) => s.vision)
  const scene = useStore((s) => s.scene)
  if (!vision) return null
  return (
    <group userData={{ noMerge: true }}>
      <MemoryGlows scene={scene} />
      {scene === 'home' && <Dijizhu />}
      {scene === 'home' && <Footprints />}
    </group>
  )
}

/** 還沒撿的回憶碎片：一團暖黃色的光，慢慢上下飄 */
function MemoryGlows({ scene }: { scene: string }) {
  const got = useStore((s) => s.meta.memories)
  const list = useMemo(() => MEMORIES.filter((m) => m.scene === scene && !got.includes(m.id)), [scene, got])
  const refs = useRef<(THREE.Sprite | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    list.forEach((m, i) => {
      const sp = refs.current[i]
      if (!sp) return
      const floor = SCENES[scene as keyof typeof SCENES].floorAt(m.x, m.z)
      sp.position.set(m.x, floor + m.y + Math.sin(t * 1.6 + i) * 0.08, m.z)
      const k = 0.55 + Math.sin(t * 2.3 + i * 1.7) * 0.12
      sp.scale.setScalar(k)
    })
  })
  return (
    <>
      {list.map((m, i) => (
        <sprite
          key={m.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          renderOrder={4}
        >
          <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
    </>
  )
}

function Dijizhu() {
  return (
    <group>
      <ChibiNpc id="dijizhu" pose="clasp" position={[DIJIZHU.x, 0.42, DIJIZHU.z]} heading={Math.PI * 0.75} seesGhosts outline={false} />
      <pointLight position={[DIJIZHU.x, 1.4, DIJIZHU.z]} color="#9fffd8" intensity={1.2} distance={3} decay={2} />
    </group>
  )
}

/** 客人最近走過的腳印（青色、越舊越淡） */
const MAX_FEET = 160
function Footprints() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.PlaneGeometry(0.13, 0.2).rotateX(-Math.PI / 2), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: footTex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(0.6, 1.4, 1.3) }), [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const col = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const im = mesh.current
    const sim = night.sim
    if (!im) return
    let n = 0
    if (sim) {
      const hour = useStore.getState().time
      for (const g of sim.guests) {
        const tr = g.trail
        for (let i = 0; i < tr.length && n < MAX_FEET; i++) {
          const [x, z, at, side] = tr[i]
          const age = hour - at
          if (age > 1.5) continue
          const nx = tr[i + 1] ?? [g.x, g.z]
          const heading = Math.atan2(nx[0] - x, nx[1] - z)
          const off = side ? 0.07 : -0.07
          v.set(x + Math.cos(heading) * off, SCENES.home.floorAt(x, z) + 0.025, z - Math.sin(heading) * off)
          q.setFromAxisAngle(up, heading)
          m4.compose(v, q, sc)
          im.setMatrixAt(n, m4)
          im.setColorAt(n, col.setScalar(Math.max(0.15, 1 - age / 1.5)))
          n++
        }
      }
    }
    im.count = n
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, MAX_FEET]} frustumCulled={false} renderOrder={2} />
}
