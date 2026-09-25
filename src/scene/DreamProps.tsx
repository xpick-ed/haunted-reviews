import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { toon } from '../chars/toon'
import { canvasTexture, BRUSH_FONT } from './kit'
import { Tree } from './Tree'
import type { Block, DreamDef, DreamPalette, Post } from '../world/dream'

// 夢境的布景：跟碰撞用同一份版面資料（src/world/dream.ts 的 layout），擋路的東西畫在哪、就擋在哪。
// 全部用簡單的幾何體＋卡通材質（跟人物同一套），不用貼圖檔：夢要「不像真的」。

type V3 = [number, number, number]

// ---------------------------------------------------------------------------
// 貼圖（每種只做一次）
// ---------------------------------------------------------------------------

const TEX = new Map<string, THREE.Texture>()
function tex(key: string, make: () => THREE.Texture) {
  let t = TEX.get(key)
  if (!t) TEX.set(key, (t = make()))
  return t
}

/** 地面花紋（會重複鋪） */
function groundTexture(theme: DreamDef['theme'], p: DreamPalette) {
  return tex(`ground|${theme}`, () => {
    const t = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = p.ground
      ctx.fillRect(0, 0, w, h)
      const line = (c: string, lw: number) => {
        ctx.strokeStyle = c
        ctx.lineWidth = lw
      }
      if (theme === 'market' || theme === 'studio') {
        // 石板／舞台木地板
        line(theme === 'market' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.45)', 3)
        for (let i = 0; i <= 4; i++) {
          ctx.beginPath()
          ctx.moveTo(0, i * 64)
          ctx.lineTo(w, i * 64)
          ctx.stroke()
          for (let j = 0; j < 4; j++) {
            const x = ((i % 2) * 64 + j * 128) % w
            ctx.beginPath()
            ctx.moveTo(x, i * 64)
            ctx.lineTo(x, i * 64 + 64)
            ctx.stroke()
          }
        }
      } else if (theme === 'office') {
        // 地毯方塊
        for (let i = 0; i < 4; i++)
          for (let j = 0; j < 4; j++) {
            ctx.fillStyle = (i + j) % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'
            ctx.fillRect(i * 64, j * 64, 64, 64)
          }
      } else if (theme === 'toys') {
        // 遊戲墊：彩色方塊
        const cs = ['#ff9ec4', '#9ee6ff', '#fff19a', '#b4f5a8']
        for (let i = 0; i < 2; i++)
          for (let j = 0; j < 2; j++) {
            ctx.fillStyle = cs[(i * 2 + j) % 4]
            ctx.fillRect(i * 128 + 4, j * 128 + 4, 120, 120)
          }
      } else {
        // 草、泥土、霧裡的地：小點點
        for (let i = 0; i < 260; i++) {
          ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.12)'
          const x = (i * 97) % w
          const y = (i * 57 + (i % 7) * 13) % h
          ctx.fillRect(x, y, 3 + (i % 4), 2 + (i % 3))
        }
      }
    })
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(7, 7)
    return t
  })
}

function stripeTexture(a: string, b: string) {
  return tex(`stripe|${a}|${b}`, () =>
    canvasTexture(128, 32, (ctx, w, h) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? a : b
        ctx.fillRect((i * w) / 8, 0, w / 8, h)
      }
    }),
  )
}

/** 發光的字（出口、ON AIR） */
function signTexture(text: string, bg: string, fg: string) {
  return tex(`sign|${text}`, () =>
    canvasTexture(
      256,
      96,
      (ctx, w, h) => {
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = fg
        ctx.font = `700 60px ${BRUSH_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, w / 2, h / 2 + 4)
      },
      [{ spec: `700 60px ${BRUSH_FONT}`, text }],
    ),
  )
}

function screenTexture(v: number) {
  return tex(`screen|${v % 3}`, () =>
    canvasTexture(128, 80, (ctx, w, h) => {
      ctx.fillStyle = '#0b2a3a'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#7fe3ff'
      if (v % 3 === 0) for (let i = 0; i < 6; i++) ctx.fillRect(12 + i * 18, h - 10 - ((i * 37) % 50), 12, 10 + ((i * 37) % 50))
      else if (v % 3 === 1) {
        ctx.strokeStyle = '#ff7a9a'
        ctx.lineWidth = 4
        ctx.beginPath()
        for (let i = 0; i <= 8; i++) ctx.lineTo(8 + i * 14, h - 12 - Math.abs(Math.sin(i * 1.3)) * 50 + i * 3)
        ctx.stroke()
      } else {
        ctx.font = '700 40px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('-37%', w / 2, h / 2 + 14)
      }
    }),
  )
}

const LETTERS = ['ㄅ', 'ㄆ', 'ㄇ', 'A', 'B', 'C', '1', '2', '3', 'ㄈ']
function blockFace(v: number, color: string) {
  const ch = LETTERS[v % LETTERS.length]
  return tex(`toy|${v}|${color}`, () =>
    canvasTexture(
      128,
      128,
      (ctx, w, h) => {
        ctx.fillStyle = color
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 10
        ctx.strokeRect(8, 8, w - 16, h - 16)
        ctx.fillStyle = '#ffffff'
        ctx.font = '900 84px "Noto Sans TC", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(ch, w / 2, h / 2 + 6)
      },
      [{ spec: '900 84px "Noto Sans TC"', text: ch }],
    ),
  )
}

// ---------------------------------------------------------------------------
// 共用的小零件
// ---------------------------------------------------------------------------

function Box({ p, s, c, glow, map, rot }: { p: V3; s: V3; c: string; glow?: number; map?: THREE.Texture; rot?: V3 }) {
  return (
    <mesh position={p} rotation={rot} material={toon(c, { glow, map })} castShadow receiveShadow>
      <boxGeometry args={s} />
    </mesh>
  )
}

function Cyl({ p, r, h, c, r2, seg = 12, glow }: { p: V3; r: number; h: number; c: string; r2?: number; seg?: number; glow?: number }) {
  return (
    <mesh position={p} material={toon(c, { glow })} castShadow receiveShadow>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
    </mesh>
  )
}

function Ball({ p, r, c, glow, s }: { p: V3; r: number; c: string; glow?: number; s?: V3 }) {
  return (
    <mesh position={p} scale={s} material={toon(c, { glow })} castShadow>
      <sphereGeometry args={[r, 16, 12]} />
    </mesh>
  )
}

/** 發光的球（燈籠、燈泡）：不受光影響，亮度 > 1 讓 Bloom 暈開 */
function Glow({ p, r, c, k = 1.6 }: { p: V3; r: number; c: string; k?: number }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false }), [c, k])
  return (
    <mesh position={p} material={mat}>
      <sphereGeometry args={[r, 12, 10]} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 地面：浮在空中的島（上面平、下面是倒過來的岩石）＋遠處的小浮島
// ---------------------------------------------------------------------------

export function DreamIsland({ def }: { def: DreamDef }) {
  const p = def.palette
  const b = def.layout.bounds
  const w = b.x1 - b.x0 + 3
  const d = b.z1 - b.z0 + 3
  const cx = (b.x0 + b.x1) / 2
  const cz = (b.z0 + b.z1) / 2
  const map = groundTexture(def.theme, p)
  return (
    <group>
      <mesh position={[cx, -0.6, cz]} material={toon(p.ground, { map, glow: 0.08 + p.bright * 0.08 })} receiveShadow>
        <boxGeometry args={[w, 1.2, d]} />
      </mesh>
      {/* 邊緣一圈比較亮的邊 */}
      <mesh position={[cx, -0.16, cz]} material={toon(p.groundEdge, { glow: 0.25 })}>
        <boxGeometry args={[w + 0.3, 0.24, d + 0.3]} />
      </mesh>
      {/* 島的下半部：倒過來的岩石 */}
      <mesh position={[cx, -6, cz]} rotation={[Math.PI, Math.PI / 8, 0]} scale={[(w / 2) * 1.08, 1, (d / 2) * 1.08]} material={toon(p.groundEdge, { glow: 0.1 })}>
        <coneGeometry args={[1, 9.6, 8, 1]} />
      </mesh>
    </group>
  )
}

/** 遠處慢慢上下飄的小浮島 */
export function FloatingIslets({ def }: { def: DreamDef }) {
  const p = def.palette
  const refs = useRef<(THREE.Group | null)[]>([])
  const islets = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        // 只放在鏡頭看過去的那一側（鏡頭在東南邊上方，放近處會擋住畫面）
        const a = 1.95 + (i / 7) * 4.1
        const r = 22 + ((i * 37) % 9)
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: -3 + ((i * 53) % 8), s: 1 + ((i * 29) % 10) / 6, ph: i * 1.7 }
      }),
    [],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((g, i) => {
      if (!g) return
      const it = islets[i]
      g.position.y = it.y + Math.sin(t * 0.4 + it.ph) * 0.6
      g.rotation.y = t * 0.03 + it.ph
    })
  })
  return (
    <group>
      {islets.map((it, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          position={[it.x, it.y, it.z]}
          scale={it.s}
        >
          <Cyl p={[0, 0, 0]} r={1.4} h={0.5} c={p.ground} seg={9} />
          <mesh position={[0, -1.6, 0]} rotation={[Math.PI, 0, 0]} material={toon(p.groundEdge, { glow: 0.1 })}>
            <coneGeometry args={[1.4, 2.8, 9]} />
          </mesh>
          {i % 3 === 0 && <Glow p={[0, 0.9, 0]} r={0.22} c={p.accent} />}
          {i % 3 === 1 && <Cyl p={[0.3, 0.8, 0.2]} r={0.25} h={1.2} c={p.groundEdge} r2={0.05} seg={6} />}
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 各主題的道具
// ---------------------------------------------------------------------------

function Stall({ b }: { b: Block }) {
  const cols = ['#c0392b', '#2e86c1', '#d68910', '#7d3c98']
  const awning = stripeTexture(cols[(b.v ?? 0) % 4], '#f2e6d0')
  const facing = b.z > 0 ? 1 : -1
  return (
    <group position={[b.x, 0, b.z]}>
      <Box p={[0, 0.5, 0]} s={[b.w - 0.1, 1, b.d - 0.2]} c="#5a3d2b" />
      <Box p={[0, 1.02, 0]} s={[b.w - 0.05, 0.06, b.d]} c="#8a6a4a" />
      {/* 空盤子、倒掉的椅子：人都不見了 */}
      <Cyl p={[-b.w / 4, 1.1, 0]} r={0.28} h={0.06} c="#e8e0d0" />
      <Cyl p={[b.w / 5, 1.12, 0.1]} r={0.2} h={0.1} c="#d8c8a8" />
      {[-1, 1].map((s) => (
        <Cyl key={s} p={[(s * (b.w - 0.25)) / 2, 1.3, (facing * b.d) / 2 - facing * 0.1]} r={0.04} h={2.6} c="#3a2a20" seg={6} />
      ))}
      <Box p={[0, b.h + 0.1, 0.15 * facing]} s={[b.w, 0.06, b.d + 0.5]} c="#ffffff" map={awning} glow={0.25} rot={[0.14 * facing, 0, 0]} />
      <Glow p={[0, b.h - 0.35, (facing * b.d) / 2]} r={0.16} c="#ffb347" k={1.4} />
      {(b.v ?? 0) % 2 === 0 && <Box p={[0.4, 0.22, facing * (b.d / 2 + 0.35)]} s={[0.4, 0.44, 0.4]} c="#6a4a3a" rot={[0, 0, 1.2]} />}
    </group>
  )
}

function LanternString({ b, color }: { b: Block; color: string }) {
  const g = useRef<THREE.Group>(null)
  const n = Math.floor(b.w / 1.6)
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.x = Math.sin(clock.elapsedTime * 0.8 + (b.v ?? 0)) * 0.05
  })
  const cols = ['#ff5a5a', color, '#ffd36e', '#ff8ad0']
  return (
    <group ref={g} position={[b.x, b.h, b.z]} userData={{ noMerge: true }}>
      <mesh rotation={[0, 0, Math.PI / 2]} material={toon('#2a2020', { glow: 0 })}>
        <cylinderGeometry args={[0.015, 0.015, b.w, 4]} />
      </mesh>
      {Array.from({ length: n }, (_, i) => (
        <Glow key={i} p={[-b.w / 2 + (i + 0.5) * 1.6, -0.22 - (i % 2) * 0.08, 0]} r={0.17} c={cols[(i + (b.v ?? 0)) % 4]} k={1.3} />
      ))}
    </group>
  )
}

function House({ b }: { b: Block }) {
  const walls = ['#b0643c', '#c9a27a', '#a9573a', '#d8c09a']
  const v = b.v ?? 0
  const front = b.x < 0 ? 1 : -1 // 門朝街
  return (
    <group position={[b.x, 0, b.z]}>
      <Box p={[0, b.h / 2, 0]} s={[b.w, b.h, b.d]} c={walls[v % 4]} glow={0.22} />
      {/* 屋瓦 */}
      <group position={[0, b.h + 0.45, 0]} scale={[b.w * 0.8, 1, b.d * 0.8]}>
        <mesh rotation={[0, Math.PI / 4, 0]} material={toon('#8a3a2a', { glow: 0.2 })} castShadow>
          <cylinderGeometry args={[0.001, 1, 0.9, 4, 1]} />
        </mesh>
      </group>
      {/* 門與窗（窗透出暖光） */}
      <Box p={[(front * b.w) / 2 + front * 0.01, 1, 0]} s={[0.04, 2, 1]} c="#5a2a1a" />
      <mesh position={[(front * b.w) / 2 + front * 0.02, 1.9, b.d / 4]} rotation={[0, (front * Math.PI) / 2, 0]}>
        <planeGeometry args={[0.8, 0.6]} />
        <meshBasicMaterial color={new THREE.Color('#ffcf7a').multiplyScalar(1.3)} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Desk({ b }: { b: Block }) {
  const v = b.v ?? 0
  return (
    <group position={[b.x, 0, b.z]}>
      <Box p={[0, 0.72, 0]} s={[b.w, 0.06, b.d]} c="#c8ccd4" />
      <Box p={[0, 0.36, 0]} s={[b.w - 0.1, 0.7, 0.06]} c="#9aa2ae" />
      {/* 隔板 */}
      <Box p={[0, 1.0, 0]} s={[b.w, 0.55, 0.05]} c="#5a6b86" />
      {[-1, 1].map((s) => (
        <group key={s} position={[(s * b.w) / 4, 0.75, s * 0.35]}>
          <Box p={[0, 0.3, 0]} s={[0.62, 0.42, 0.04]} c="#1c2230" />
          <mesh position={[0, 0.3, s * 0.025]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
            <planeGeometry args={[0.56, 0.36]} />
            <meshBasicMaterial map={screenTexture(v + s)} toneMapped={false} color={new THREE.Color(1.4, 1.4, 1.4)} />
          </mesh>
        </group>
      ))}
      {/* 堆積如山的文件 */}
      <Box p={[b.w / 2 - 0.35, 0.9, 0.2]} s={[0.35, 0.3, 0.45]} c="#f4f1ea" />
    </group>
  )
}

function Cabinet({ b }: { b: Block }) {
  return (
    <group position={[b.x, 0, b.z]}>
      <Box p={[0, b.h / 2, 0]} s={[b.w, b.h, b.d]} c="#7d8796" />
      {[0.4, 0.9, 1.4].map((y) => (
        <Box key={y} p={[b.w / 2 + 0.01, y, 0]} s={[0.02, 0.06, b.d * 0.4]} c="#dfe4ea" />
      ))}
    </group>
  )
}

function ToyBlock({ b }: { b: Block }) {
  const cols = ['#ff6b8a', '#4cc3ff', '#ffd23f', '#6ee07a', '#b47bff']
  const c = cols[(b.v ?? 0) % cols.length]
  const face = blockFace(b.v ?? 0, c)
  return <Box p={[b.x, b.h / 2, b.z]} s={[b.w, b.h, b.d]} c="#ffffff" map={face} glow={0.3} rot={[0, ((b.v ?? 0) % 3) * 0.12, 0]} />
}

function Coffin({ b }: { b: Block }) {
  return (
    <group position={[b.x, 0, b.z]} rotation={[0, (b.v ?? 0) * 0.5, 0]}>
      <Box p={[0, b.h / 2, 0]} s={[b.w, b.h, b.d]} c="#3a2418" />
      <Box p={[0.15, b.h + 0.05, 0.12]} s={[b.w * 0.95, 0.1, b.d]} c="#4a2e1e" rot={[0, 0.12, 0]} />
      <Box p={[-b.w / 4, b.h + 0.12, 0]} s={[0.08, 0.02, 0.4]} c="#c8a040" />
    </group>
  )
}

function StudioBits({ b }: { b: Block }) {
  if (b.kind === 'tomb')
    return (
      <group position={[b.x, 0, b.z]}>
        <Box p={[0, b.h / 2, 0]} s={[b.w, b.h, b.d]} c="#8a8e96" />
        <Ball p={[0, b.h, 0]} r={b.w / 2} c="#8a8e96" s={[1, 0.45, b.d / b.w]} />
        <Box p={[0, b.h * 0.6, b.d / 2 + 0.01]} s={[b.w * 0.5, 0.08, 0.01]} c="#3a3a3a" />
      </group>
    )
  if (b.kind === 'curtain')
    return (
      <group position={[b.x, 0, b.z]}>
        {Array.from({ length: Math.floor(b.d / 0.5) }, (_, i) => (
          <Cyl key={i} p={[0, b.h / 2, -b.d / 2 + 0.25 + i * 0.5]} r={0.22} h={b.h} c={i % 2 ? '#7a0f1c' : '#8e1826'} seg={8} />
        ))}
      </group>
    )
  if (b.kind === 'screen')
    return (
      <group position={[b.x, 0, b.z]}>
        <Box p={[0, b.h / 2, 0]} s={[b.w, b.h, b.d]} c="#2ec46a" glow={0.35} />
        <mesh position={[0, b.h + 0.8, b.d / 2 + 0.05]}>
          <planeGeometry args={[3, 1.1]} />
          <meshBasicMaterial map={signTexture('ON AIR', '#3a0000', '#ff4040')} toneMapped={false} color={new THREE.Color(1.6, 1.6, 1.6)} />
        </mesh>
      </group>
    )
  if (b.kind === 'console')
    return (
      <group position={[b.x, 0, b.z]}>
        <Box p={[0, b.h / 2, 0]} s={[b.w, b.h, b.d]} c="#26262e" />
        {Array.from({ length: 8 }, (_, i) => (
          <Glow key={i} p={[-b.w / 2 + 0.25 + i * 0.3, b.h + 0.03, 0.2 - (i % 2) * 0.3]} r={0.05} c={i % 3 ? '#3aff7a' : '#ff3a3a'} />
        ))}
      </group>
    )
  // crate
  return <Box p={[b.x, b.h / 2, b.z]} s={[b.w, b.h, b.d]} c="#6a5236" />
}

function PostProp({ p, palette }: { p: Post; palette: DreamPalette }) {
  const v = p.v ?? 0
  switch (p.kind) {
    case 'flower': {
      const petals = ['#ffd1e8', '#d6c8ff', '#fff2b0', '#c8f0ff'][v % 4]
      return (
        <group position={[p.x, 0, p.z]}>
          <Cyl p={[0, p.h / 2, 0]} r={p.r * 0.35} h={p.h} c="#6f9a7a" r2={p.r * 0.25} seg={8} />
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2
            return <Ball key={i} p={[Math.cos(a) * p.r * 1.3, p.h, Math.sin(a) * p.r * 1.3]} r={p.r * 1.1} c={petals} s={[1, 0.35, 1]} glow={0.35} />
          })}
          <Glow p={[0, p.h + 0.15, 0]} r={p.r * 0.7} c={palette.accent} k={1.2} />
        </group>
      )
    }
    case 'lamp':
      return (
        <group position={[p.x, 0, p.z]}>
          <Cyl p={[0, p.h / 2, 0]} r={0.09} h={p.h} c="#3a3e4a" seg={8} />
          <Glow p={[0, p.h + 0.2, 0]} r={0.28} c="#fff2c8" k={1.8} />
          <pointLight position={[0, p.h, 0]} color="#fff0c8" intensity={2.2} distance={6} decay={2} />
        </group>
      )
    case 'well':
      return (
        <group position={[p.x, 0, p.z]}>
          <Cyl p={[0, p.h / 2, 0]} r={p.r} h={p.h} c="#8f8a80" seg={14} />
          <Cyl p={[0, p.h + 0.01, 0]} r={p.r * 0.75} h={0.04} c="#1e3a4a" seg={14} />
          {[-1, 1].map((s) => (
            <Cyl key={s} p={[s * p.r * 0.9, p.h + 0.6, 0]} r={0.05} h={1.2} c="#5a3d2b" seg={6} />
          ))}
          <Box p={[0, p.h + 1.25, 0]} s={[p.r * 2.3, 0.08, 0.8]} c="#8a3a2a" rot={[0, 0, 0]} />
        </group>
      )
    case 'banyan':
      return <Tree position={[p.x, 0, p.z]} scale={0.55} />
    case 'plant':
      return (
        <group position={[p.x, 0, p.z]}>
          <Cyl p={[0, 0.3, 0]} r={0.3} h={0.6} c="#b0703a" r2={0.36} />
          <Ball p={[0, 1.05, 0]} r={0.5} c="#3f8a4a" s={[1, 1.3, 1]} />
        </group>
      )
    case 'pine':
      return (
        <group position={[p.x, 0, p.z]}>
          <Cyl p={[0, 0.4, 0]} r={0.14} h={0.8} c="#5a3d2b" seg={6} />
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.9 + i * (p.h / 4), 0]} material={toon(['#2f6a4a', '#3a7a52', '#2a5e42'][v % 3], { glow: 0.2 })} castShadow>
              <coneGeometry args={[p.r * (1.5 - i * 0.35), p.h / 2.6, 8]} />
            </mesh>
          ))}
        </group>
      )
    case 'rock':
      return (
        <mesh position={[p.x, p.r * 0.5, p.z]} scale={[p.r * 1.1, p.r * 0.8, p.r]} rotation={[0, v, 0]} material={toon('#8a8478', { glow: 0.15 })} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
        </mesh>
      )
    case 'ball':
      return (
        <mesh position={[p.x, p.r, p.z]} material={toon('#ffffff', { map: stripeTexture('#ff5a7a', '#fff19a'), glow: 0.3 })} castShadow>
          <sphereGeometry args={[p.r, 20, 14]} />
        </mesh>
      )
    case 'bear':
      return (
        <group position={[p.x, 0, p.z]} rotation={[0, 0.8, 0]}>
          <Ball p={[0, 0.6, 0]} r={0.6} c="#c8864a" />
          <Ball p={[0, 1.45, 0]} r={0.45} c="#c8864a" />
          {[-1, 1].map((s) => (
            <Ball key={s} p={[s * 0.35, 1.82, 0]} r={0.16} c="#a86a3a" />
          ))}
          <Ball p={[0, 1.38, 0.38]} r={0.15} c="#f0d8b0" />
        </group>
      )
    case 'rocket':
      return (
        <group position={[p.x, 0, p.z]}>
          <Cyl p={[0, 1.1, 0]} r={p.r} h={1.8} c="#f4f1ea" />
          <mesh position={[0, 2.4, 0]} material={toon('#ff5a5a')} castShadow>
            <coneGeometry args={[p.r, 0.8, 16]} />
          </mesh>
          <Glow p={[0, 1.4, p.r]} r={0.18} c="#7fe3ff" />
        </group>
      )
    case 'spot':
      return (
        <group position={[p.x, 0, p.z]}>
          <Cyl p={[0, p.h / 2, 0]} r={0.06} h={p.h} c="#2a2a2a" seg={6} />
          <mesh position={[0, p.h, 0]} rotation={[0.9, v * 2, 0]} material={toon('#1a1a1a')}>
            <cylinderGeometry args={[0.2, 0.32, 0.5, 10]} />
          </mesh>
          <pointLight position={[0, p.h - 0.3, 0]} color="#fff0d0" intensity={3} distance={7} decay={2} />
        </group>
      )
    case 'crane':
      return (
        <group position={[p.x, 0, p.z]}>
          <Cyl p={[0, 0.9, 0]} r={0.12} h={1.8} c="#3a3a40" seg={8} />
          <Box p={[-0.8, 1.9, 0]} s={[2.4, 0.12, 0.12]} c="#4a4a52" rot={[0, 0, 0.25]} />
          <Box p={[-1.9, 2.2, 0]} s={[0.4, 0.3, 0.3]} c="#1a1a1a" />
        </group>
      )
    case 'chair':
      return (
        <group position={[p.x, 0, p.z]} rotation={[0, 2.6, 0]}>
          <Box p={[0, 0.5, 0]} s={[0.6, 0.06, 0.5]} c="#2a2a2a" />
          <Box p={[0, 0.85, -0.25]} s={[0.6, 0.4, 0.04]} c="#2a2a2a" />
          {[-1, 1].map((s) => (
            <Box key={s} p={[s * 0.28, 0.25, 0]} s={[0.04, 0.5, 0.5]} c="#6a5236" rot={[0, 0, s * 0.3]} />
          ))}
        </group>
      )
    default:
      return <Cyl p={[p.x, p.h / 2, p.z]} r={p.r} h={p.h} c="#888888" />
  }
}

function BlockProp({ b, palette }: { b: Block; palette: DreamPalette }) {
  switch (b.kind) {
    case 'stall':
      return <Stall b={b} />
    case 'lanterns':
      return <LanternString b={b} color={palette.light} />
    case 'house':
      return <House b={b} />
    case 'desk':
      return <Desk b={b} />
    case 'cabinet':
      return <Cabinet b={b} />
    case 'toy':
      return <ToyBlock b={b} />
    case 'coffin':
      return <Coffin b={b} />
    case 'tomb':
    case 'curtain':
    case 'screen':
    case 'console':
    case 'crate':
      return <StudioBits b={b} />
    case 'street':
      return (
        <mesh position={[b.x, 0.01, b.z]} rotation-x={-Math.PI / 2} material={toon('#c8aa7a', { glow: 0.2 })} receiveShadow>
          <planeGeometry args={[b.w, b.d]} />
        </mesh>
      )
    case 'track':
      return (
        <mesh position={[b.x, 0.03, b.z]} rotation-x={-Math.PI / 2} material={toon('#8a5a3a', { glow: 0.2 })}>
          <ringGeometry args={[b.w / 2 - 0.25, b.w / 2 + 0.25, 64]} />
        </mesh>
      )
    default:
      return <Box p={[b.x, b.h / 2, b.z]} s={[b.w, b.h, b.d]} c="#888888" />
  }
}

/** 整個主題的布景（靜態的部分交給 MergeStatic 合併） */
export function DreamSet({ def }: { def: DreamDef }) {
  const L = def.layout
  return (
    <group>
      {L.blocks.map((b, i) => (
        <BlockProp key={`b${i}`} b={b} palette={def.palette} />
      ))}
      {L.deco.map((b, i) => (
        <BlockProp key={`d${i}`} b={b} palette={def.palette} />
      ))}
      {L.posts.map((p, i) => (
        <PostProp key={`p${i}`} p={p} palette={def.palette} />
      ))}
      <ThemeExtras def={def} />
    </group>
  )
}

/** 每個主題額外的東西（終點的門、天花板燈、營火……） */
function ThemeExtras({ def }: { def: DreamDef }) {
  const L = def.layout
  const g = L.goal
  switch (def.theme) {
    case 'market':
      return g ? (
        <group position={[g[0], 0, g[1] - 0.8]}>
          {/* 出口的牌樓 */}
          {[-1, 1].map((s) => (
            <Cyl key={s} p={[s * 1.8, 1.9, 0]} r={0.2} h={3.8} c="#b3261e" glow={0.35} />
          ))}
          <Box p={[0, 3.9, 0]} s={[4.8, 0.35, 0.5]} c="#b3261e" glow={0.35} />
          <Box p={[0, 4.3, 0]} s={[5.6, 0.2, 0.7]} c="#2a1a1a" />
          <mesh position={[0, 3.35, 0.27]}>
            <planeGeometry args={[1.7, 0.64]} />
            <meshBasicMaterial map={signTexture('出口', '#2a0a0a', '#ffd36e')} toneMapped={false} color={new THREE.Color(1.5, 1.5, 1.5)} />
          </mesh>
          <pointLight position={[0, 2.6, 1]} color="#ffd36e" intensity={6} distance={9} decay={2} />
        </group>
      ) : null
    case 'oldvillage':
      return g ? (
        <group position={[g[0], 0, g[1] - 1]}>
          {/* 阿春以前的家：紅門、門楣上的燈 */}
          <Box p={[-2.6, 1.6, 0]} s={[2.4, 3.2, 0.6]} c="#c9a27a" glow={0.25} />
          <Box p={[2.6, 1.6, 0]} s={[2.4, 3.2, 0.6]} c="#c9a27a" glow={0.25} />
          <Box p={[0, 1.2, 0.05]} s={[2.8, 2.4, 0.15]} c="#a8201a" glow={0.3} />
          <Box p={[0, 2.9, 0]} s={[3.4, 0.9, 0.7]} c="#8a3a2a" />
          <Glow p={[0, 2.6, 0.5]} r={0.24} c="#ffcf7a" k={1.6} />
          <pointLight position={[0, 2.4, 1.2]} color="#ffcf7a" intensity={5} distance={8} decay={2} />
        </group>
      ) : null
    case 'office':
      return (
        <group>
          {/* 飄在半空、沒有天花板的日光燈 */}
          {[-7, -1.5, 4.5].flatMap((x) =>
            [6, 0, -6].map((z) => (
              <mesh key={`${x},${z}`} position={[x, 4.2, z]}>
                <boxGeometry args={[2.4, 0.08, 0.5]} />
                <meshBasicMaterial color={new THREE.Color(1.5, 1.7, 1.9)} toneMapped={false} />
              </mesh>
            )),
          )}
        </group>
      )
    case 'mountain': {
      const d = L.dreamer!
      return (
        <group position={[d[0] + 1.2, 0, d[1] - 0.6]}>
          {/* 營火 */}
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} p={[0, 0.1, 0]} s={[0.9, 0.12, 0.14]} c="#5a3d2b" rot={[0, (i * Math.PI) / 4, 0]} />
          ))}
          <Glow p={[0, 0.35, 0]} r={0.25} c="#ff8a3a" k={1.8} />
          <pointLight position={[0, 0.8, 0]} color="#ff9a4a" intensity={4} distance={7} decay={2} />
          <Box p={[-1.2, 0.2, 0.3]} s={[1.2, 0.35, 0.4]} c="#6a4a2e" />
        </group>
      )
    }
    default:
      return null
  }
}
