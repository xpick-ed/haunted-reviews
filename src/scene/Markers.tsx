import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { HOTSPOTS } from '../world/hotspots'
import { player } from '../world/player'
import { SCENES } from '../world/scenes'
import { BRUSH_FONT, WBox, canvasTexture } from './kit'

// 場景裡的提示：熱點上方的光點（靠近才出現，選中時變大變亮），出口的木頭路牌。

const markerGeo = new THREE.OctahedronGeometry(0.11, 0)
const idleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.0, 0.6), toneMapped: false, transparent: true })
const activeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 0.9), toneMapped: false, transparent: true })

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
      const usable = !s.dialogue && !s.result && h.label(s) !== null
      const active = s.prompt?.id === h.id
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

export function ExitSigns() {
  const scene = useStore((s) => s.scene)
  return (
    <group>
      {SCENES[scene].exits.map((e) => (
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
