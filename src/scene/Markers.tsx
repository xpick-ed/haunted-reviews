import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { HOTSPOTS } from '../world/hotspots'
import { player } from '../world/player'
import { SCENES } from '../world/scenes'
import { nightSpots, ACTION_DEFS } from '../world/night/actions'
import { night } from '../world/night/director'
import { BRUSH_FONT, WBox, canvasTexture } from './kit'

// 場景裡的提示：熱點上方的光點（靠近才出現，選中時變大變亮），出口的木頭路牌。

const markerGeo = new THREE.OctahedronGeometry(0.11, 0)
const idleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.0, 0.6), toneMapped: false, transparent: true })
const activeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 0.9), toneMapped: false, transparent: true })
/** 有客人正需要的：暖橘色、跳得比較大 */
const neededMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.0, 0.45), toneMapped: false, transparent: true })

/** 目前選中的互動點 id */
function activeSpot() {
  const p = useStore.getState().prompt
  return p ? p.opts[p.i]?.spot : undefined
}

export function HotspotMarkers() {
  const scene = useStore((s) => s.scene)
  const list = useMemo(() => HOTSPOTS.filter((h) => h.scene === scene), [scene])
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    const s = useStore.getState()
    const t = clock.elapsedTime
    const def = SCENES[s.scene]
    list.forEach((h, i) => {
      const m = refs.current[i]
      if (!m) return
      const d = Math.hypot(h.x - player.x, h.z - player.z)
      const usable = !s.dialogue && !s.summary && h.label(s) !== null
      const active = activeSpot() === h.id
      const show = usable && d < 5
      m.visible = show
      if (!show) return
      m.material = active ? activeMat : idleMat
      const k = active ? 1.5 : 1
      m.scale.setScalar(k * (1 + Math.sin(t * 3 + i) * 0.08))
      const ix = h.icon?.x ?? h.x
      const iz = h.icon?.z ?? h.z
      m.position.set(ix, def.floorAt(ix, iz) + h.iconY + Math.sin(t * 2 + i) * 0.06, iz)
      m.rotation.y = t * 1.5
      ;(m.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp((5 - d) / 2, 0, 1)
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {list.map((h, i) => (
        <mesh
          key={h.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          geometry={markerGeo}
          material={idleMat}
          visible={false}
        />
      ))}
    </group>
  )
}

/** 深夜動作的光點（客房的床、床頭櫃、電扇、門外……）：靠近才出現 */
const MAX_NIGHT = 14
export function NightMarkers() {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    const s = useStore.getState()
    const t = clock.elapsedTime
    const sim = night.sim
    let n = 0
    if (sim && s.phase === 'night' && s.scene === 'home' && !s.dialogue && !s.summary) {
      const floorAt = SCENES.home.floorAt
      const active = activeSpot()
      const spots = nightSpots({ sim, objects: s.objects, skills: s.meta.skills, carrying: s.carrying, hour: s.time, yinCost: (a) => ACTION_DEFS[a].yin })
      for (const sp of spots) {
        if (n >= MAX_NIGHT) break
        const d = Math.hypot(sp.icon[0] - player.x, sp.icon[2] - player.z)
        if (d > 5.5) continue
        const opts = sp.options()
        if (!opts.length) continue
        const m = refs.current[n++]
        if (!m) continue
        const needed = opts.some((o) => o.needed)
        const on = active === sp.id
        m.visible = true
        m.material = on ? activeMat : needed ? neededMat : idleMat
        const k = on ? 1.5 : needed ? 1.25 : 1
        m.scale.setScalar(k * (1 + Math.sin(t * (needed ? 6 : 3) + n) * (needed ? 0.15 : 0.08)))
        m.position.set(sp.icon[0], floorAt(sp.icon[0], sp.icon[2]) + sp.icon[1] + Math.sin(t * 2 + n) * 0.06, sp.icon[2])
        m.rotation.y = t * 1.5
        ;(m.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp((5.5 - d) / 2, 0, 1)
      }
    }
    for (let i = n; i < MAX_NIGHT; i++) if (refs.current[i]) refs.current[i]!.visible = false
  })
  return (
    <group userData={{ noMerge: true }}>
      {Array.from({ length: MAX_NIGHT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          geometry={markerGeo}
          material={idleMat}
          visible={false}
        />
      ))}
    </group>
  )
}

export function ExitSigns() {
  const scene = useStore((s) => s.scene)
  // 有時段限制的出口（鬼夜市）每 15 分鐘檢查一次
  const quarter = useStore((s) => Math.floor(s.time * 4))
  const phase = useStore((s) => s.phase)
  return (
    <group>
      {SCENES[scene].exits.filter((e) => !e.when || e.when({ phase, time: quarter / 4 })).map((e) => (
        <Signpost key={e.label} x={e.sign[0]} z={e.sign[1]} text={e.label} />
      ))}
    </group>
  )
}

function Signpost({ x, z, text }: { x: number; z: number; text: string }) {
  const tex = useMemo(
    () =>
      canvasTexture(
        512,
        128,
        (ctx, w, h) => {
          ctx.fillStyle = '#7a5434'
          ctx.fillRect(0, 0, w, h)
          ctx.strokeStyle = '#4a3020'
          ctx.lineWidth = 8
          ctx.strokeRect(4, 4, w - 8, h - 8)
          for (let i = 0; i < 6; i++) {
            ctx.strokeStyle = 'rgba(60,35,18,0.3)'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(0, 20 + i * 18)
            ctx.lineTo(w, 22 + i * 18)
            ctx.stroke()
          }
          ctx.fillStyle = '#fff3d8'
          ctx.font = `700 72px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(text, w / 2, h / 2 + 4)
        },
        [{ spec: `700 72px ${BRUSH_FONT}`, text }],
      ),
    [text],
  )
  return (
    <group position={[x, 0, z]}>
      <WBox mat="wood" size={[0.1, 1.9, 0.1]} position={[0, 0.95, 0]} />
      {/* 路牌斜著朝向鏡頭 */}
      <group position={[0, 1.6, 0]} rotation={[0, 0.7, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.5, 0.38, 0.05]} />
          <meshStandardMaterial color="#6a4a2e" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[1.46, 0.36]} />
          <meshStandardMaterial map={tex} roughness={0.8} />
        </mesh>
      </group>
    </group>
  )
}
