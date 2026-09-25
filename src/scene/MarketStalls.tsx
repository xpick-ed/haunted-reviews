import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { StallDef, StallKind } from '../world/sceneMarket'
import { BRUSH_FONT, WBox, canvasTexture, seeded, useMats } from './kit'

// 鬼夜市的攤子（DESIGN §25.1）：木頭攤架＋斜斜的條紋布棚＋招牌＋各攤的貨。
// 本地座標：攤子正面朝 +z，原點在地面中央；外面再依 StallDef.face 轉向。
// 不會動的東西都交給外面的 <MergeStatic> 合併；會動的（金魚、香腸的煙）另外畫。

const DEPTH = 1.5
const FRONT_H = 2.25
const BACK_H = 2.55
const COUNTER_H = 0.88

// ---------------------------------------------------------------------------
// 材質（整個夜市共用，只建一次）
// ---------------------------------------------------------------------------

const TINTS = [
  { main: '#b8322a', skirt: '#7e2320' }, // 紅白
  { main: '#2a8a86', skirt: '#1b5754' }, // 青白（鬼火的顏色）
  { main: '#6b3f8f', skirt: '#452a5e' }, // 紫白
]

function stripeTex(color: string) {
  return canvasTexture(128, 64, (ctx, w, h) => {
    const n = 8
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? '#efe6d2' : color
      ctx.fillRect((i * w) / n, 0, w / n + 1, h)
    }
    // 舊布：一點髒污
    const r = seeded(color.length * 97)
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(40,25,20,${0.05 + r() * 0.08})`
      ctx.fillRect(r() * w, r() * h, 2 + r() * 6, 1 + r() * 3)
    }
  })
}

function valanceTex(color: string) {
  // 棚子前緣的波浪邊（透明的地方用 alphaTest 挖掉）
  return canvasTexture(256, 64, (ctx, w, h) => {
    const n = 8
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? '#efe6d2' : color
      ctx.beginPath()
      const x0 = (i * w) / n
      const x1 = ((i + 1) * w) / n
      ctx.moveTo(x0, 0)
      ctx.lineTo(x1, 0)
      ctx.lineTo(x1, h * 0.45)
      ctx.arc((x0 + x1) / 2, h * 0.45, (x1 - x0) / 2, 0, Math.PI)
      ctx.closePath()
      ctx.fill()
    }
  })
}

export function signTexture(text: string, bg = '#2a1510', fg = '#f4d27a') {
  const spec = `700 88px ${BRUSH_FONT}`
  return canvasTexture(
    384,
    112,
    (ctx, w, h) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#8a5a2a'
      ctx.lineWidth = 6
      ctx.strokeRect(6, 6, w - 12, h - 12)
      ctx.fillStyle = fg
      ctx.font = spec
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const size = Math.min(88, (w - 40) / Math.max(1, text.length))
      ctx.font = `700 ${size}px ${BRUSH_FONT}`
      ctx.fillText(text, w / 2, h / 2 + 4)
    },
    [{ spec, text }],
  )
}

function maskTex() {
  // 面具攤：四張臉（關公紅臉、白臉、天狗、狐狸）
  return canvasTexture(256, 64, (ctx) => {
    const faces = [
      { bg: '#c0302a', eye: '#111', brow: '#111', stripe: '#f2d04a' },
      { bg: '#f0ece0', eye: '#222', brow: '#222', stripe: '#c0302a' },
      { bg: '#9a2a24', eye: '#f2d04a', brow: '#111', stripe: '#111' },
      { bg: '#f4f0e8', eye: '#c0302a', brow: '#c0302a', stripe: '#e07a2a' },
    ]
    faces.forEach((f, i) => {
      const cx = 32 + i * 64
      ctx.fillStyle = f.bg
      ctx.beginPath()
      ctx.ellipse(cx, 32, 26, 30, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = f.stripe
      ctx.fillRect(cx - 3, 6, 6, 20)
      ctx.strokeStyle = f.brow
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(cx - 18, 22)
      ctx.lineTo(cx - 6, 27)
      ctx.moveTo(cx + 18, 22)
      ctx.lineTo(cx + 6, 27)
      ctx.stroke()
      ctx.fillStyle = f.eye
      ctx.beginPath()
      ctx.ellipse(cx - 10, 32, 5, 3, 0, 0, Math.PI * 2)
      ctx.ellipse(cx + 10, 32, 5, 3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a1010'
      ctx.fillRect(cx - 8, 46, 16, 3)
    })
  })
}

function charmTex() {
  // 符紙：黃紙紅字
  return canvasTexture(64, 160, (ctx, w, h) => {
    ctx.fillStyle = '#e8c85a'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#b8221c'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(w / 2, 14)
    for (let y = 20; y < h - 20; y += 16) {
      ctx.lineTo(w / 2 + (y % 32 ? 14 : -14), y)
    }
    ctx.lineTo(w / 2, h - 12)
    ctx.stroke()
    ctx.strokeRect(6, 6, w - 12, h - 12)
  })
}

function pinballTex() {
  return canvasTexture(128, 192, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#2c3f7a')
    g.addColorStop(1, '#6a2a6a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const r = seeded(9)
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = ['#f2d04a', '#ff6a6a', '#8fe8ff', '#ffffff'][i % 4]
      ctx.beginPath()
      ctx.arc(12 + r() * (w - 24), 16 + r() * (h - 40), 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#f2d04a'
    ctx.font = '700 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('100', w / 2, h - 14)
  })
}

let MATS: ReturnType<typeof buildMats> | null = null
export function marketMats() {
  return (MATS ??= buildMats())
}

function buildMats() {
  const std = (color: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o })
  const glow = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false })
  const canopy = TINTS.map((t) => {
    const map = stripeTex(t.main)
    return std('#ffffff', { map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.22, side: THREE.DoubleSide, roughness: 0.95 })
  })
  const valance = TINTS.map((t) => {
    const map = valanceTex(t.main)
    return std('#ffffff', { map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0.3, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.95 })
  })
  const skirt = TINTS.map((t) => std(t.skirt, { emissive: t.skirt, emissiveIntensity: 0.25, roughness: 0.95 }))
  const mask = maskTex()
  const charm = charmTex()
  const pinball = pinballTex()
  return {
    canopy,
    valance,
    skirt,
    bulb: glow(2.4, 1.7, 0.9),
    ghostBulb: glow(0.7, 2.2, 1.9),
    coals: glow(2.2, 0.55, 0.12),
    candle: glow(2.4, 1.6, 0.6),
    water: std('#1d5a78', { emissive: '#0d3a52', emissiveIntensity: 0.7, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88 }),
    tub: std('#2f7fc4', { roughness: 0.35 }),
    paper: ['#e8c34a', '#e89ab0', '#6fb07a', '#6a8fd0', '#f2eee4'].map((c) => std(c, { emissive: c, emissiveIntensity: 0.12, roughness: 0.9 })),
    goldPaper: std('#d9b23a', { emissive: '#8a6a1a', emissiveIntensity: 0.3, roughness: 0.6, metalness: 0.3 }),
    sausage: std('#a8322a', { roughness: 0.35 }),
    snail: std('#4a2e1c', { roughness: 0.3 }),
    candy: [std('#ffb7d5', { emissive: '#ff8ab8', emissiveIntensity: 0.25, roughness: 1 }), std('#a8d8ff', { emissive: '#6ab8ff', emissiveIntensity: 0.25, roughness: 1 })],
    haw: std('#d8201a', { roughness: 0.12, emissive: '#5a0808', emissiveIntensity: 0.4 }),
    straw: std('#c9a45a', { roughness: 1 }),
    glass: std('#cfe8d8', { roughness: 0.05, transparent: true, opacity: 0.3 }),
    tea: std('#3c5a1e', { roughness: 0.1, transparent: true, opacity: 0.85, emissive: '#1a2a0a', emissiveIntensity: 0.4 }),
    mask: std('#ffffff', { map: mask, emissiveMap: mask, emissive: '#ffffff', emissiveIntensity: 0.3, transparent: true, alphaTest: 0.4 }),
    charm: std('#ffffff', { map: charm, emissiveMap: charm, emissive: '#ffffff', emissiveIntensity: 0.35, side: THREE.DoubleSide }),
    pinball: std('#ffffff', { map: pinball, emissiveMap: pinball, emissive: '#ffffff', emissiveIntensity: 0.5 }),
    balloon: ['#e8302a', '#f2c42a', '#2a7ae8', '#3ab85a', '#f27ab8', '#f2f0ea'].map((c) => std(c, { roughness: 0.18, emissive: c, emissiveIntensity: 0.2 })),
    jade: std('#3fae7a', { emissive: '#2a8a5a', emissiveIntensity: 0.6, roughness: 0.2 }),
    curtain: std('#5a0e12', { emissive: '#3a0508', emissiveIntensity: 0.4, roughness: 1, side: THREE.DoubleSide }),
  }
}

// ---------------------------------------------------------------------------
// 一個攤子
// ---------------------------------------------------------------------------

export function Stall({ def }: { def: StallDef }) {
  const mats = useMats()
  const m = marketMats()
  const sign = useMemo(() => signTexture(def.sign, def.kind === 'relic' ? '#3a0a0a' : '#2a1510'), [def.sign, def.kind])
  const w = def.w
  const tint = def.tint
  const slope = Math.atan2(BACK_H - FRONT_H, DEPTH + 0.15)
  const canopyLen = Math.hypot(DEPTH + 0.3, BACK_H - FRONT_H)
  const hasCounter = def.kind !== 'fish'
  return (
    <group position={[def.x, 0, def.z]} rotation-y={def.face}>
      {/* 柱子：前低後高 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <WBox mat="darkWood" size={[0.08, FRONT_H, 0.08]} position={[(s * w) / 2, FRONT_H / 2, DEPTH / 2]} />
          <WBox mat="darkWood" size={[0.08, BACK_H, 0.08]} position={[(s * w) / 2, BACK_H / 2, -DEPTH / 2]} />
        </group>
      ))}
      {/* 布棚＋前緣波浪邊 */}
      <group position={[0, (FRONT_H + BACK_H) / 2 + 0.02, 0.07]} rotation-x={slope}>
        <mesh material={m.canopy[tint]} rotation-x={-Math.PI / 2} castShadow receiveShadow>
          <planeGeometry args={[w + 0.4, canopyLen]} />
        </mesh>
      </group>
      <mesh material={m.valance[tint]} position={[0, FRONT_H - 0.12, DEPTH / 2 + 0.16]}>
        <planeGeometry args={[w + 0.4, 0.26]} />
      </mesh>
      {/* 後面的貨架 */}
      <WBox mat="wood" size={[w - 0.1, 1.25, 0.3]} position={[0, 0.625, -DEPTH / 2 + 0.17]} />
      {/* 櫃台＋前面的布 */}
      {hasCounter && (
        <group>
          <WBox mat="wood" size={[w, COUNTER_H, 0.5]} position={[0, COUNTER_H / 2, DEPTH / 2 - 0.25]} />
          <mesh material={m.skirt[tint]} position={[0, COUNTER_H / 2 - 0.05, DEPTH / 2 + 0.005]}>
            <planeGeometry args={[w - 0.04, COUNTER_H - 0.2]} />
          </mesh>
        </group>
      )}
      {/* 招牌：掛在棚子前緣下面 */}
      <group position={[0, FRONT_H - 0.42, DEPTH / 2 + 0.14]}>
        <WBox mat="darkWood" size={[Math.min(w * 0.66, 1.6), 0.36, 0.04]} castShadow={false} />
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[Math.min(w * 0.62, 1.52), 0.3]} />
          <meshStandardMaterial map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={0.45} roughness={0.8} />
        </mesh>
      </group>
      {/* 燈泡 */}
      <mesh material={mats.black} position={[0, FRONT_H - 0.05, 0.3]}>
        <cylinderGeometry args={[0.006, 0.006, 0.3, 4]} />
      </mesh>
      <mesh material={def.tint === 1 ? m.ghostBulb : m.bulb} position={[0, FRONT_H - 0.24, 0.3]}>
        <sphereGeometry args={[0.055, 10, 8]} />
      </mesh>
      <Goods kind={def.kind} w={w} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 各攤的貨（櫃台上 y = COUNTER_H、貨架上 y = 1.25）
// ---------------------------------------------------------------------------

function Goods({ kind, w }: { kind: StallKind; w: number }) {
  const mats = useMats()
  const m = marketMats()
  const top = COUNTER_H
  const shelf = 1.25
  const cz = DEPTH / 2 - 0.25
  const bz = -DEPTH / 2 + 0.17
  switch (kind) {
    case 'snail':
      return (
        <group>
          {[-0.6, 0, 0.6].map((x) => (
            <group key={x} position={[x, top, cz]}>
              <mesh material={mats.metal} position={[0, 0.06, 0]}>
                <cylinderGeometry args={[0.24, 0.18, 0.12, 18]} />
              </mesh>
              <mesh material={m.snail} position={[0, 0.1, 0]} scale={[1, 0.45, 1]}>
                <icosahedronGeometry args={[0.2, 1]} />
              </mesh>
            </group>
          ))}
          {/* 塑膠袋、竹籤 */}
          <WBox mat="cloth" size={[0.3, 0.2, 0.02]} position={[w / 2 - 0.3, shelf + 0.1, bz]} castShadow={false} />
        </group>
      )
    case 'paper':
      return (
        <group>
          {/* 紙紮透天厝、車子、紙人 */}
          {[-0.65, 0.05].map((x, i) => (
            <group key={x} position={[x, shelf, bz]}>
              <mesh material={m.paper[i]} position={[0, 0.22, 0]}>
                <boxGeometry args={[0.42, 0.44, 0.26]} />
              </mesh>
              <mesh material={m.paper[3 - i]} position={[0, 0.5, 0]} rotation-y={Math.PI / 4}>
                <coneGeometry args={[0.34, 0.2, 4]} />
              </mesh>
              {[-0.1, 0.1].map((wx) => (
                <mesh key={wx} material={mats.darkWood} position={[wx, 0.28, 0.131]}>
                  <planeGeometry args={[0.08, 0.1]} />
                </mesh>
              ))}
            </group>
          ))}
          <group position={[0.4, top, cz]}>
            <mesh material={m.paper[4]} position={[0, 0.08, 0]}>
              <boxGeometry args={[0.46, 0.12, 0.22]} />
            </mesh>
            <mesh material={m.paper[3]} position={[-0.02, 0.18, 0]}>
              <boxGeometry args={[0.26, 0.1, 0.2]} />
            </mesh>
            {[-0.15, 0.15].map((x) => (
              <mesh key={x} material={mats.black} position={[x, 0.03, 0.11]} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.04, 0.04, 0.02, 10]} />
              </mesh>
            ))}
          </group>
          {[-0.5, -0.3].map((x, i) => (
            <group key={x} position={[x, top, cz + 0.05]}>
              <mesh material={m.paper[i + 1]} position={[0, 0.14, 0]}>
                <cylinderGeometry args={[0.04, 0.08, 0.24, 8]} />
              </mesh>
              <mesh material={m.paper[4]} position={[0, 0.3, 0]}>
                <sphereGeometry args={[0.055, 10, 8]} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'sausage':
      return (
        <group>
          <WBox mat="black" size={[w * 0.7, 0.14, 0.34]} position={[0, top + 0.07, cz]} />
          <mesh material={m.coals} position={[0, top + 0.145, cz]}>
            <boxGeometry args={[w * 0.66, 0.01, 0.3]} />
          </mesh>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} material={m.sausage} position={[-0.6 + i * 0.2, top + 0.18, cz]} rotation-x={Math.PI / 2}>
              <capsuleGeometry args={[0.035, 0.22, 4, 8]} />
            </mesh>
          ))}
          {/* 大蒜、一箱香腸 */}
          <WBox mat="cloth" size={[0.4, 0.2, 0.25]} position={[0.5, shelf + 0.1, bz]} castShadow={false} />
        </group>
      )
    case 'money':
      return (
        <group>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} material={m.goldPaper} position={[-0.8 + i * 0.4, top + 0.06 + (i % 2) * 0.04, cz]}>
              <boxGeometry args={[0.3, 0.12 + (i % 2) * 0.08, 0.22]} />
            </mesh>
          ))}
          {/* 元寶 */}
          {[-0.5, 0, 0.5].map((x) => (
            <mesh key={x} material={mats.gold} position={[x, shelf + 0.08, bz]} scale={[1, 0.6, 0.7]}>
              <torusGeometry args={[0.1, 0.05, 8, 14]} />
            </mesh>
          ))}
        </group>
      )
    case 'candy':
      return (
        <group>
          <mesh material={mats.metal} position={[-0.4, top + 0.1, cz]}>
            <cylinderGeometry args={[0.28, 0.2, 0.2, 18, 1, true]} />
          </mesh>
          <mesh material={m.candy[0]} position={[-0.4, top + 0.16, cz]} scale={[1, 0.5, 1]}>
            <icosahedronGeometry args={[0.2, 1]} />
          </mesh>
          {[0.1, 0.35, 0.6].map((x, i) => (
            <group key={x} position={[x, top, cz]}>
              <mesh material={mats.bamboo} position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 0.4, 5]} />
              </mesh>
              <mesh material={m.candy[i % 2]} position={[0, 0.45, 0]}>
                <icosahedronGeometry args={[0.13, 1]} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'fish':
      // 撈金魚：大水盆（魚在 <FishTub> 裡動）
      return (
        <group>
          <group position={[0, 0, 0.45]}>
            {[-0.45, 0.45].map((x) => (
              <WBox key={x} mat="darkWood" size={[0.08, 0.36, 0.9]} position={[x, 0.18, 0]} />
            ))}
            <mesh material={m.tub} position={[0, 0.49, 0]}>
              <cylinderGeometry args={[0.62, 0.55, 0.26, 28, 1, true]} />
            </mesh>
            <mesh material={m.tub} position={[0, 0.37, 0]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.56, 28]} />
            </mesh>
            <mesh material={m.water} position={[0, 0.58, 0]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.6, 28]} />
            </mesh>
          </group>
          {/* 貨架上的獎品：一袋一袋的金魚 */}
          {[-0.6, -0.2, 0.2, 0.6].map((x) => (
            <mesh key={x} material={m.glass} position={[x, shelf + 0.12, bz]} scale={[1, 1.3, 1]}>
              <sphereGeometry args={[0.1, 10, 8]} />
            </mesh>
          ))}
        </group>
      )
    case 'balloon':
      return (
        <group>
          <WBox mat="darkWood" size={[w - 0.2, 1.3, 0.06]} position={[0, 1.55, bz - 0.1]} />
          {Array.from({ length: 18 }, (_, i) => {
            const cx = (i % 6) - 2.5
            const cy = Math.floor(i / 6)
            return (
              <mesh key={i} material={m.balloon[(i * 7) % 6]} position={[cx * 0.34, 1.12 + cy * 0.38, bz - 0.02]} scale={[1, 1.15, 1]}>
                <sphereGeometry args={[0.13, 12, 10]} />
              </mesh>
            )
          })}
          {/* 飛鏢 */}
          {[-0.3, -0.15, 0].map((x) => (
            <mesh key={x} material={mats.redPaint} position={[x, top + 0.02, cz]} rotation-z={Math.PI / 2}>
              <coneGeometry args={[0.02, 0.2, 6]} />
            </mesh>
          ))}
        </group>
      )
    case 'mask':
      return (
        <group>
          <WBox mat="darkWood" size={[w - 0.2, 0.9, 0.05]} position={[0, 1.7, bz - 0.12]} />
          {[-1, 1].map((row) => (
            <mesh key={row} material={m.mask} position={[0, 1.7 + row * 0.22, bz - 0.09]}>
              <planeGeometry args={[1.6, 0.4]} />
            </mesh>
          ))}
          {[-0.6, 0, 0.6].map((x, i) => (
            <mesh key={x} material={m.paper[i]} position={[x, top + 0.12, cz]}>
              <sphereGeometry args={[0.1, 10, 8]} />
            </mesh>
          ))}
        </group>
      )
    case 'fortune':
      return (
        <group>
          <mesh material={mats.redPaper} position={[0, top + 0.005, cz]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[w - 0.3, 0.46]} />
          </mesh>
          {/* 籤筒 */}
          <mesh material={mats.bamboo} position={[-0.4, top + 0.15, cz]}>
            <cylinderGeometry args={[0.08, 0.08, 0.3, 12]} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} material={mats.bamboo} position={[-0.4 + (i - 2.5) * 0.02, top + 0.36, cz + ((i % 2) - 0.5) * 0.03]}>
              <boxGeometry args={[0.012, 0.18, 0.006]} />
            </mesh>
          ))}
          <mesh material={mats.cloth} position={[0.2, top + 0.05, cz]}>
            <boxGeometry args={[0.3, 0.06, 0.22]} />
          </mesh>
          <mesh material={m.candle} position={[0.55, top + 0.12, cz]}>
            <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
          </mesh>
        </group>
      )
    case 'marble':
      return (
        <group>
          <group position={[0, top + 0.25, cz - 0.05]} rotation-x={-0.9}>
            <WBox mat="wood" size={[0.7, 0.9, 0.06]} />
            <mesh material={m.pinball} position={[0, 0, 0.032]}>
              <planeGeometry args={[0.64, 0.84]} />
            </mesh>
          </group>
          {[-0.7, 0.7].map((x) => (
            <mesh key={x} material={m.balloon[5]} position={[x, top + 0.05, cz]}>
              <sphereGeometry args={[0.04, 8, 6]} />
            </mesh>
          ))}
        </group>
      )
    case 'sugar':
      return (
        <group>
          <mesh material={m.straw} position={[0, top + 0.15, cz]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.13, 0.13, w * 0.6, 12]} />
          </mesh>
          {Array.from({ length: 7 }, (_, i) => (
            <group key={i} position={[-0.6 + i * 0.2, top + 0.24, cz]} rotation-z={(i - 3) * 0.08}>
              <mesh material={mats.bamboo} position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.008, 0.008, 0.4, 4]} />
              </mesh>
              {[0.12, 0.22, 0.32, 0.42].map((y) => (
                <mesh key={y} material={m.haw} position={[0, y, 0]}>
                  <sphereGeometry args={[0.045, 10, 8]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      )
    case 'drink':
      return (
        <group>
          {[-0.5, 0.2].map((x) => (
            <group key={x} position={[x, top, cz]}>
              <mesh material={m.tea} position={[0, 0.17, 0]}>
                <cylinderGeometry args={[0.15, 0.15, 0.3, 16]} />
              </mesh>
              <mesh material={m.glass} position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.17, 0.17, 0.4, 16, 1, true]} />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} material={mats.darkWood} position={[s * (w / 2 - 0.35), 0.35, bz + 0.1]}>
              <cylinderGeometry args={[0.24, 0.22, 0.7, 14]} />
            </mesh>
          ))}
        </group>
      )
    case 'relic':
      return <RelicGoods w={w} />
  }
}

/** 紅姨的法器攤：兩側紅簾、三層貨架、發光的法器 */
function RelicGoods({ w }: { w: number }) {
  const mats = useMats()
  const m = marketMats()
  const top = COUNTER_H
  const bz = -DEPTH / 2 + 0.17
  return (
    <group>
      {/* 後面再高一層架子 */}
      <WBox mat="darkWood" size={[w - 0.1, 0.06, 0.34]} position={[0, 1.75, bz]} />
      <WBox mat="darkWood" size={[w - 0.1, 0.06, 0.34]} position={[0, 2.15, bz]} />
      {[-1, 1].map((s) => (
        <WBox key={s} mat="darkWood" size={[0.06, 0.95, 0.34]} position={[(s * (w - 0.16)) / 2, 1.72, bz]} />
      ))}
      {/* 兩側布簾 */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={m.curtain} position={[(s * w) / 2, 1.3, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[DEPTH - 0.1, 2.3]} />
        </mesh>
      ))}
      {/* 鈴、葫蘆、玉、符、香 */}
      {[-1.1, -0.5, 0.1, 0.7, 1.2].map((x, i) => (
        <group key={x} position={[x, 1.25, bz]}>
          {i === 0 && (
            <mesh material={mats.gold} position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            </mesh>
          )}
          {i === 1 && (
            <group>
              <mesh material={mats.ceramic} position={[0, 0.1, 0]}>
                <sphereGeometry args={[0.1, 12, 10]} />
              </mesh>
              <mesh material={mats.ceramic} position={[0, 0.24, 0]}>
                <sphereGeometry args={[0.065, 12, 10]} />
              </mesh>
            </group>
          )}
          {i === 2 && (
            <mesh material={m.jade} position={[0, 0.1, 0]}>
              <torusGeometry args={[0.08, 0.03, 8, 16]} />
            </mesh>
          )}
          {i === 3 && (
            <mesh material={m.ghostBulb} position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.07, 10, 8]} />
            </mesh>
          )}
          {i === 4 && (
            <mesh material={mats.terracotta} position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.1, 0.08, 0.12, 12]} />
            </mesh>
          )}
        </group>
      ))}
      {/* 上層：符紙一排 */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} material={m.charm} position={[-1.2 + i * 0.4, 2.0, bz + 0.16]} rotation-z={(i % 2 ? 1 : -1) * 0.04}>
          <planeGeometry args={[0.14, 0.34]} />
        </mesh>
      ))}
      {/* 櫃台上：香爐、蠟燭、攤開的符 */}
      <mesh material={mats.gold} position={[-0.6, top + 0.08, DEPTH / 2 - 0.25]}>
        <cylinderGeometry args={[0.12, 0.1, 0.16, 14]} />
      </mesh>
      {[0.4, 0.8].map((x) => (
        <mesh key={x} material={m.candle} position={[x, top + 0.1, DEPTH / 2 - 0.3]}>
          <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
        </mesh>
      ))}
      <mesh material={m.charm} position={[0, top + 0.004, DEPTH / 2 - 0.25]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.16, 0.38]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 撈金魚的水盆：魚在繞圈游（一個 InstancedMesh）
// ---------------------------------------------------------------------------

const FISH_N = 9
const FISH_COLORS = ['#ff6a1a', '#ff4a1a', '#ffb02a', '#1a1a1a', '#f4f0e8', '#ff6a1a', '#e8301a', '#ff8a3a', '#ff6a1a']

export function FishTub({ def }: { def: StallDef }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => {
    const body = new THREE.SphereGeometry(0.05, 10, 8).scale(0.7, 0.55, 1.2)
    const tail = new THREE.ConeGeometry(0.04, 0.07, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.08)
    const g = mergeGeometries([body.toNonIndexed(), tail.toNonIndexed()])!
    return g
  }, [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.3, emissive: '#ff5a1a', emissiveIntensity: 0.25 }), [])
  const fish = useMemo(() => {
    const r = seeded(31)
    return Array.from({ length: FISH_N }, (_, i) => ({ r: 0.12 + r() * 0.36, w: (0.5 + r() * 0.9) * (r() < 0.5 ? -1 : 1), p: r() * 6.28, y: r() * 0.05, c: FISH_COLORS[i] }))
  }, [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const im = mesh.current
    if (!im) return
    const t = clock.elapsedTime
    fish.forEach((f, i) => {
      const a = f.p + t * f.w
      const wob = Math.sin(t * 3 + i) * 0.04
      tmp.position.set(Math.cos(a) * (f.r + wob), 0.54 - f.y, Math.sin(a) * (f.r + wob))
      // 游的方向＝圓的切線
      tmp.rotation.set(0, -a + (f.w > 0 ? 0 : Math.PI), Math.sin(t * 9 + i) * 0.15)
      tmp.updateMatrix()
      im.setMatrixAt(i, tmp.matrix)
    })
    im.instanceMatrix.needsUpdate = true
  })
  return (
    <group position={[def.x, 0, def.z]} rotation-y={def.face} userData={{ noMerge: true }}>
      <group position={[0, 0, 0.45]}>
        <instancedMesh
          ref={(im) => {
            mesh.current = im
            if (im && !im.instanceColor) FISH_COLORS.forEach((c, i) => im.setColorAt(i, new THREE.Color(c)))
          }}
          args={[geo, mat, FISH_N]}
        />
      </group>
    </group>
  )
}
