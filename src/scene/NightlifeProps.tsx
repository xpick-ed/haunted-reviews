import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { adultOn } from '../settings'
import { NIGHTLIFE } from '../world/nightlife'
import { hillGate } from '../world/sceneHill'
import { player } from '../world/player'
import { Chibi, SEAT_Y, newDrive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { BRUSH_FONT, boxGeo, canvasTexture, seeded } from './kit'
import '../chars/specs.nightlife'

// 山上的鬼麻將桌（DESIGN §29，成人內容）：中層空地上一張摺疊方桌、四張板凳，桂嬸坐在北邊等人，
// 桌上貼一張「三缺一」。晚上、陰陽眼開著、打開成人內容才看得到。熱點在 src/world/nightlife.ts。

const T = NIGHTLIFE.table
const TOP = 0.66
const STOOL = 0.42
const SIDE = 0.62

let MATS: Record<'wood' | 'legs' | 'felt' | 'ivory' | 'green' | 'stool' | 'lampGlass' | 'lampBase', THREE.Material> | null = null
function mats() {
  return (MATS ??= {
    wood: new THREE.MeshStandardMaterial({ color: '#8a5a34', roughness: 0.6 }),
    legs: new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.7 }),
    felt: new THREE.MeshStandardMaterial({ color: '#2f7a5a', roughness: 1 }),
    ivory: new THREE.MeshStandardMaterial({ color: '#f4ecd6', roughness: 0.4 }),
    green: new THREE.MeshStandardMaterial({ color: '#2a6a4c', roughness: 0.5 }),
    stool: new THREE.MeshStandardMaterial({
      color: '#c0392b',
      roughness: 0.45,
    }),
    lampGlass: new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.2, 1.6, 0.8),
      toneMapped: false,
    }),
    lampBase: new THREE.MeshStandardMaterial({
      color: '#6a6a6a',
      roughness: 0.4,
      metalness: 0.7,
    }),
  })
}

/** 桌上的「三缺一」紙牌 */
let SIGN: THREE.MeshStandardMaterial | null = null
function signMat() {
  return (SIGN ??= new THREE.MeshStandardMaterial({
    map: canvasTexture(
      192,
      96,
      (ctx, w, h) => {
        ctx.fillStyle = '#fbf3e0'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#c0392b'
        ctx.lineWidth = 5
        ctx.strokeRect(5, 5, w - 10, h - 10)
        ctx.fillStyle = '#1c1a18'
        ctx.font = `700 ${h * 0.56}px ${BRUSH_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('三缺一', w / 2, h / 2 + 3)
      },
      [{ spec: `700 54px ${BRUSH_FONT}`, text: '三缺一' }],
    ),
    roughness: 0.9,
  }))
}

export function NightlifeProps({ outline = true }: { outline?: boolean }) {
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const drive = useRef(newDrive({ pose: 'shopkeeper', heading: 0 }))
  const m = mats()
  // 散在桌上的牌（固定亂數）
  const scattered = useMemo(() => {
    const r = seeded(2929)
    return Array.from({ length: 14 }, () => ({
      x: (r() - 0.5) * 0.36,
      z: (r() - 0.5) * 0.3,
      rot: r() * Math.PI,
      up: r() < 0.6,
    }))
  }, [])
  const spec = SPECS.guishen
  const seatY = STOOL - SEAT_Y * spec.scale + 0.03

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const s = useStore.getState()
    g.visible = adultOn() && s.phase === 'night' && hillGate.ghostsVisible(s)
    const t = clock.elapsedTime
    if (light.current) light.current.intensity = g.visible ? 1.1 * (0.92 + Math.sin(t * 9) * 0.04 + Math.sin(t * 23) * 0.03) : 0
    if (!g.visible) return
    // 阿嬤走近：桂嬸抬頭看她（三缺一，終於有人來了）
    const dx = player.x - T.x
    const dz = player.z - (T.z - SIDE)
    drive.current.heading = Math.hypot(dx, dz) < 3.5 ? Math.atan2(dx, dz) * 0.5 : 0
  })

  // 燈光放在切換顯示的 group 外面：燈的數量不變，打開陰陽眼時才不會整個場景重新編譯 shader
  return (
    <group position={[T.x, T.y, T.z]} userData={{ noMerge: true }}>
      <pointLight ref={light} color="#ffcf80" intensity={0} distance={4} decay={2} position={[-0.36, TOP + 0.2, -0.36]} />
      <group ref={group} visible={false}>
        {/* 摺疊方桌：木框、綠色桌布、四支腳 */}
        <mesh geometry={boxGeo(0.92, 0.05, 0.92)} material={m.wood} position={[0, TOP - 0.025, 0]} castShadow receiveShadow />
        <mesh geometry={boxGeo(0.8, 0.012, 0.8)} material={m.felt} position={[0, TOP + 0.004, 0]} receiveShadow />
        {[
          [-0.4, -0.4],
          [0.4, -0.4],
          [-0.4, 0.4],
          [0.4, 0.4],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={boxGeo(0.05, TOP - 0.05, 0.05)} material={m.legs} position={[x, (TOP - 0.05) / 2, z]} castShadow />
        ))}
        {/* 四面牌牆（象牙色的牌、綠色的背） */}
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
            <mesh geometry={boxGeo(0.5, 0.028, 0.04)} material={m.ivory} position={[0, TOP + 0.024, 0.27]} castShadow />
            <mesh geometry={boxGeo(0.5, 0.012, 0.04)} material={m.green} position={[0, TOP + 0.044, 0.27]} />
          </group>
        ))}
        {/* 中間打出來的牌 */}
        {scattered.map((p, i) => (
          <mesh key={i} geometry={boxGeo(0.04, 0.022, 0.052)} material={p.up ? m.ivory : m.green} position={[p.x, TOP + 0.021, p.z]} rotation={[0, p.rot, 0]} />
        ))}
        {/* 三缺一 */}
        <mesh geometry={boxGeo(0.22, 0.11, 0.004)} material={signMat()} position={[0.16, TOP + 0.075, 0.2]} rotation={[-0.35, -0.2, 0]} />
        {/* 四張紅色塑膠板凳：北邊坐著桂嬸，南邊是阿嬤的位子 */}
        {[
          [0, -SIDE],
          [SIDE, 0],
          [0, SIDE],
          [-SIDE, 0],
        ].map(([x, z]) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh material={m.stool} position={[0, STOOL - 0.02, 0]} castShadow>
              <cylinderGeometry args={[0.16, 0.16, 0.04, 16]} />
            </mesh>
            <mesh material={m.stool} position={[0, (STOOL - 0.04) / 2, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.15, STOOL - 0.04, 12, 1, true]} />
            </mesh>
          </group>
        ))}
        {/* 桂嬸 */}
        <group position={[0, seatY, -SIDE]}>
          <Chibi spec={spec} drive={drive} outline={outline} legs={false} />
        </group>
        {/* 煤油燈（掛在桌角） */}
        <group position={[-0.36, TOP, -0.36]}>
          <mesh material={m.lampBase} position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.08, 10]} />
          </mesh>
          <mesh material={m.lampGlass} position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.045, 10, 8]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
