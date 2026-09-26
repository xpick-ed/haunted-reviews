import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { FLOOR_Y, GUEST_ROOMS, WING_L, WING_R } from './layout'
import { BRUSH_FONT, canvasTexture } from './kit'
import { coupleIn, couplesState } from '../world/night/couples'
import type { RoomId } from '../world/night/types'

// 情侶客人的畫面（DESIGN §29，成人內容，只有暗示）：房門旁邊的「請勿打擾」牌、
// 兩人世界時床上方淡淡的粉紅燈和往上飄的愛心、外遇那晚床頭櫃上一直震的手機（上面冒出「老婆 ❤」）。
// 資料從 couplesState 每幀讀（跟 night.sim 一樣放在模組變數）。

const ROOMS: RoomId[] = ['r1', 'r2']
/** 房門那道牆的 x */
const DOOR_WALL_X: Record<RoomId, number> = { r1: WING_R.x0, r2: WING_L.x1 }
/** 房門中心的 z */
const DOOR_Z: Record<RoomId, number> = { r1: GUEST_ROOMS.r1.doorOut[1], r2: GUEST_ROOMS.r2.doorOut[1] }
/** 床頭櫃的高度（Interior.tsx 的櫃子 0.55） */
const STAND_TOP = 0.55

let TEX: { sign: THREE.Texture; heart: THREE.Texture; bubble: THREE.Texture; note: THREE.Texture } | null = null
function tex() {
  if (TEX) return TEX
  const sign = canvasTexture(256, 160, (ctx, w, h) => {
    // 掛繩
    ctx.strokeStyle = '#5a3a22'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(w * 0.28, 44)
    ctx.lineTo(w / 2, 6)
    ctx.lineTo(w * 0.72, 44)
    ctx.stroke()
    // 木牌
    ctx.fillStyle = '#e9d2a6'
    ctx.strokeStyle = '#8a5a34'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.roundRect(10, 40, w - 20, h - 50, 18)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#b3263a'
    ctx.font = `700 54px ${BRUSH_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('請勿打擾', w / 2, h / 2 + 18)
    ctx.font = '26px sans-serif'
    ctx.fillText('♥', w - 34, 62)
  }, [{ spec: `700 54px ${BRUSH_FONT}`, text: '請勿打擾' }])
  const heart = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ff7aa8'
    ctx.font = '52px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♥', w / 2, h / 2 + 3)
  })
  const bubble = canvasTexture(256, 112, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.strokeStyle = '#3b2a2a'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.roundRect(8, 8, w - 16, h - 34, 22)
    ctx.moveTo(w / 2 - 14, h - 27)
    ctx.lineTo(w / 2, h - 6)
    ctx.lineTo(w / 2 + 14, h - 27)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#b3263a'
    ctx.font = `700 44px ${BRUSH_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('📱 老婆 ♥', w / 2, (h - 26) / 2 + 5)
  }, [{ spec: `700 44px ${BRUSH_FONT}`, text: '老婆' }])
  const note = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffe28a'
    ctx.font = '48px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♪', w / 2, h / 2)
  })
  TEX = { sign, heart, bubble, note }
  return TEX
}

export function CouplesLayer() {
  const plan = useStore((s) => s.plan)
  const phase = useStore((s) => s.phase)
  const rooms = useMemo(() => ROOMS.filter((r) => coupleIn(plan, r)), [plan])
  if (!rooms.length || (phase !== 'dusk' && phase !== 'night')) return null
  return (
    <group userData={{ noMerge: true }}>
      {rooms.map((r) => (
        <group key={r}>
          <DoorSign room={r} />
          {phase === 'night' && <Romance room={r} />}
          {phase === 'night' && coupleIn(plan, r) === 'affair' && <Phone room={r} />}
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 請勿打擾：像招牌一樣從房門旁邊的牆伸出來，掛在鏡頭那一側（鏡頭在 +x：左護龍在門外、右護龍在房間裡），
// 牌面朝 +z（朝鏡頭），兩面都有字
// ---------------------------------------------------------------------------

function DoorSign({ room }: { room: RoomId }) {
  const t = tex()
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: t.sign, transparent: true, alphaTest: 0.4, roughness: 0.9, emissive: '#ffffff', emissiveMap: t.sign, emissiveIntensity: 0.28 }), [t])
  useFrame(({ clock }) => {
    const el = g.current
    if (!el) return
    el.visible = couplesState.signs[room] === useStore.getState().meta.night
    // 輕輕晃
    el.rotation.z = Math.sin(clock.elapsedTime * 1.3) * 0.035
  })
  return (
    <group ref={g} position={[DOOR_WALL_X[room] + 0.52, FLOOR_Y + 1.72, DOOR_Z[room] + 0.76]} visible={false}>
      {/* 撐桿 */}
      <mesh position={[-0.3, 0.3, 0]}>
        <boxGeometry args={[0.7, 0.025, 0.025]} />
        <meshStandardMaterial color="#4a2f1c" roughness={0.8} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} material={mat} position={[0, 0, side * 0.006]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[0.84, 0.525]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 兩人世界：粉紅色的燈、往上飄的愛心
// ---------------------------------------------------------------------------

const HEARTS = 7

function Romance({ room }: { room: RoomId }) {
  const t = tex()
  const bed = GUEST_ROOMS[room].bed
  const light = useRef<THREE.PointLight>(null)
  const hearts = useRef<(THREE.Sprite | null)[]>([])
  const seeds = useMemo(() => Array.from({ length: HEARTS }, (_, i) => ({ ox: Math.sin(i * 2.4) * 0.45, oz: Math.cos(i * 1.7) * 0.6, speed: 0.22 + (i % 3) * 0.05, phase: i / HEARTS })), [])
  useFrame(({ clock }) => {
    const c = couplesState.current?.couple(room)
    const glow = c?.glow ?? 0
    if (light.current) light.current.intensity = glow * (2.4 + Math.sin(clock.elapsedTime * 1.7) * 0.3)
    hearts.current.forEach((sp, i) => {
      if (!sp) return
      const s = seeds[i]
      const u = (clock.elapsedTime * s.speed + s.phase) % 1
      sp.visible = glow > 0.05
      if (!sp.visible) return
      sp.position.set(bed.x + s.ox + Math.sin(u * 6 + i) * 0.08, bed.topY + 0.35 + u * 1.3, bed.z + s.oz)
      const m = sp.material as THREE.SpriteMaterial
      m.opacity = glow * Math.min(1, Math.sin(u * Math.PI) * 1.4)
      sp.scale.setScalar(0.2 + u * 0.14)
    })
  })
  return (
    <group>
      <pointLight ref={light} position={[bed.x, bed.topY + 1.1, bed.z]} color="#ff6fa8" intensity={0} distance={5} decay={1.6} />
      {seeds.map((_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            hearts.current[i] = el
          }}
          visible={false}
          renderOrder={3}
        >
          <spriteMaterial map={t.heart} transparent depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 手機：放在床頭櫃上；震動時抖、響的時候抖更大還冒音符；上面的泡泡寫「老婆 ♥」
// ---------------------------------------------------------------------------

function Phone({ room }: { room: RoomId }) {
  const t = tex()
  const [nx, nz] = GUEST_ROOMS[room].nightstand
  const body = useRef<THREE.Group>(null)
  const screen = useRef<THREE.MeshBasicMaterial>(null)
  const bubble = useRef<THREE.Sprite>(null)
  const notes = useRef<(THREE.Sprite | null)[]>([])
  const glowLight = useRef<THREE.PointLight>(null)
  const base: [number, number, number] = [nx + 0.1, FLOOR_Y + STAND_TOP + 0.008, nz + 0.12]
  useFrame(({ clock }) => {
    const st = couplesState.current?.couple(room)?.phone?.state ?? 'idle'
    const on = st === 'buzz' || st === 'ring'
    const time = clock.elapsedTime
    if (body.current) {
      const amp = st === 'ring' ? 0.012 : st === 'buzz' && Math.sin(time * 5) > 0 ? 0.005 : 0
      body.current.position.set(base[0] + (Math.random() - 0.5) * amp, base[1], base[2] + (Math.random() - 0.5) * amp)
      body.current.rotation.y = 0.3 + (Math.random() - 0.5) * amp * 8
    }
    if (screen.current) screen.current.color.set(on ? (Math.sin(time * 6) > 0 ? '#bfe4ff' : '#8fc8ff') : '#15171c')
    if (glowLight.current) glowLight.current.intensity = on ? 0.5 : 0
    if (bubble.current) {
      bubble.current.visible = on
      bubble.current.position.y = base[1] + 0.85 + Math.sin(time * 3) * 0.03
    }
    notes.current.forEach((sp, i) => {
      if (!sp) return
      sp.visible = st === 'ring'
      if (!sp.visible) return
      const u = (time * 0.9 + i / 3) % 1
      sp.position.set(base[0] + (i - 1) * 0.12 + Math.sin(u * 5) * 0.04, base[1] + 0.1 + u * 0.45, base[2])
      ;(sp.material as THREE.SpriteMaterial).opacity = Math.sin(u * Math.PI)
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      <group ref={body} position={base}>
        <mesh castShadow>
          <boxGeometry args={[0.07, 0.012, 0.14]} />
          <meshStandardMaterial color="#1c1c22" roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.0065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 0.125]} />
          <meshBasicMaterial ref={screen} color="#15171c" toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={glowLight} position={[base[0], base[1] + 0.12, base[2]]} color="#9fd0ff" intensity={0} distance={1.4} decay={2} />
      <sprite ref={bubble} scale={[0.95, 0.42, 1]} position={[base[0], base[1] + 0.85, base[2]]} visible={false} renderOrder={4}>
        <spriteMaterial map={t.bubble} transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </sprite>
      {[0, 1, 2].map((i) => (
        <sprite
          key={i}
          ref={(el) => {
            notes.current[i] = el
          }}
          scale={[0.13, 0.13, 1]}
          visible={false}
          renderOrder={4}
        >
          <spriteMaterial map={t.note} transparent depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  )
}
