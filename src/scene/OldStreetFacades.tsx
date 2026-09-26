import { useMemo } from 'react'
import * as THREE from 'three'
import { ARCADE_COLUMNS, OLDSTREET } from '../world/sceneOldStreet'
import { BRUSH_FONT, TILE, WBox, boxGeo, canvasTexture, useMats } from './kit'
import { GableRoof } from './House'

// 老街的牌樓厝：巴洛克立面（山頭、圓形家徽、欄杆、拱窗）、亭仔腳的柱子與天花板、招牌、屋頂。
// 畫面組合在 src/scene/OldStreet.tsx；店面（冰果室、戲院……）在 OldStreetShops.tsx。

const O = OLDSTREET
const A = O.arcade
/** 立面（二樓以上的牆）正面在 z = A.colZ */
export const FZ = A.colZ

// ---------------------------------------------------------------------------
// 貼圖
// ---------------------------------------------------------------------------

/** 橫式招牌：底色、字色、框色 */
export function signTexture(text: string, bg: string, fg: string, frame = '#e9c46a', sub = '') {
  return canvasTexture(
    1024,
    180,
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, bg)
      g.addColorStop(1, shade(bg, -0.25))
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = frame
      ctx.lineWidth = 9
      ctx.strokeRect(9, 9, w - 18, h - 18)
      // 日曬雨淋的斑
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = `rgba(255,240,220,${Math.random() * 0.05})`
        ctx.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 90, 5 + Math.random() * 18)
      }
      ctx.fillStyle = fg
      ctx.font = `700 ${sub ? 104 : 116}px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText([...text].join(' '), w / 2, h / 2 + (sub ? -6 : 6))
      if (sub) {
        ctx.font = `500 30px ${BRUSH_FONT}`
        ctx.fillText(sub, w / 2, h - 28)
      }
    },
    [{ spec: `700 116px ${BRUSH_FONT}`, text: text + sub }],
  )
}

/** 直式招牌（兩面一樣） */
export function verticalSign(text: string, bg: string, fg: string) {
  return canvasTexture(
    96,
    96 * text.length + 36,
    (ctx, w, h) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = fg
      ctx.lineWidth = 5
      ctx.strokeRect(6, 6, w - 12, h - 12)
      ctx.fillStyle = fg
      ctx.font = `700 66px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ;[...text].forEach((ch, i) => ctx.fillText(ch, w / 2, 18 + 48 + i * 96))
    },
    [{ spec: `700 66px ${BRUSH_FONT}`, text }],
  )
}

/** 山頭的圓形家徽（一個字） */
function medallionTexture(ch: string, fg: string) {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#efe8d8'
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = fg
      ctx.lineWidth = 10
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, w / 2 - 16, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = fg
      ctx.font = `700 150px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ch, w / 2, h / 2 + 8)
    },
    [{ spec: `700 150px ${BRUSH_FONT}`, text: ch }],
  )
}

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + k * hsl.l, 0, 1))
  return `#${c.getHexString()}`
}

/** 鐵捲門的橫條紋 */
export function shutterTexture(rows = 3) {
  const t = canvasTexture(64, 256, (ctx, w, h) => {
    for (let y = 0; y < h; y += 8) {
      ctx.fillStyle = y % 16 ? '#8a9096' : '#a2a8ae'
      ctx.fillRect(0, y, w, 8)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(0, y + 7, w, 1)
    }
    // 鏽斑
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(120,70,40,${0.08 + Math.random() * 0.1})`
      ctx.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 14, 3 + Math.random() * 10)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, rows)
  return t
}

// ---------------------------------------------------------------------------
// 一間牌樓厝：立面（二樓的牆、拱窗、柱形）、山頭、亭仔腳天花板、招牌、屋頂
// ---------------------------------------------------------------------------

export interface LotStyle {
  /** 立面顏色（洗石子／粉色灰泥） */
  color: string
  /** 家徽上的字（沒有就不放） */
  crest?: string
  crestColor?: string
  /** 二樓窗戶的樣子：玻璃（晚上亮）或木頭百葉 */
  windows: 'glass' | 'shutter'
  /** 橫式招牌 */
  sign?: { text: string; bg: string; fg: string; frame?: string; sub?: string }
  /** 直式招牌（從立面伸出來） */
  vsign?: { text: string; bg: string; fg: string; x?: number }
  /** 二樓亮燈的材質（夜裡的窗） */
  glow?: THREE.Material
  /** 不畫窗（戲院立面有大看板） */
  noWindows?: boolean
}

const PARAPET = 1.1

export function Lot({ x0, x1, top, style, endWall = false }: { x0: number; x1: number; top: number; style: LotStyle; endWall?: boolean }) {
  const mats = useMats()
  const W = x1 - x0
  const cx = (x0 + x1) / 2
  const y0 = top - PARAPET
  const wall = useMemo(() => {
    const m = mats.plaster.clone()
    m.color.set(style.color)
    return m
  }, [mats, style.color])
  const trim = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: shade(style.color, 0.28), roughness: 0.85 })
    return m
  }, [style.color])
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1f2a33', roughness: 0.15, metalness: 0.3 }), [])
  const shutter = useMemo(() => new THREE.MeshStandardMaterial({ color: shade('#4f7a5a', 0), roughness: 0.7 }), [])
  const sign = useMemo(() => (style.sign ? signTexture(style.sign.text, style.sign.bg, style.sign.fg, style.sign.frame, style.sign.sub) : null), [style.sign])
  const vsign = useMemo(() => (style.vsign ? verticalSign(style.vsign.text, style.vsign.bg, style.vsign.fg) : null), [style.vsign])
  const crest = useMemo(() => (style.crest ? medallionTexture(style.crest, style.crestColor ?? '#8f2a20') : null), [style.crest, style.crestColor])

  // 二樓的窗：寬的店三扇、窄的兩扇
  const n = style.noWindows ? 0 : W > 6 ? 3 : 2
  const ww = 1.0
  const wy0 = 4.25
  const wy1 = Math.min(5.85, y0 - 0.35)
  const wins = Array.from({ length: n }, (_, i) => x0 + ((i + 0.5) * W) / n)

  // 立面的牆：窗與窗之間的柱、窗上窗下的帶子
  const pieces = useMemo(() => {
    const out: { c: [number, number, number]; s: [number, number, number] }[] = []
    const T = 0.24
    const z = FZ - T / 2
    const band = (ya: number, yb: number) => out.push({ c: [cx, (ya + yb) / 2, z], s: [W, yb - ya, T] })
    if (!n) {
      band(A.ceilY, y0)
      return out
    }
    band(A.ceilY, wy0)
    band(wy1, y0)
    let cur = x0
    for (const x of wins) {
      const a = x - ww / 2
      if (a > cur) out.push({ c: [(cur + a) / 2, (wy0 + wy1) / 2, z], s: [a - cur, wy1 - wy0, T] })
      cur = x + ww / 2
    }
    if (x1 > cur) out.push({ c: [(cur + x1) / 2, (wy0 + wy1) / 2, z], s: [x1 - cur, wy1 - wy0, T] })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x0, x1, top, n])

  // 山頭：中間一塊弧形的冠，兩邊是矮牆
  const crown = useMemo(() => {
    const w1 = Math.min(W * 0.27, 1.7)
    const yb = top - 0.25
    const s = new THREE.Shape()
    s.moveTo(-w1 - 0.35, yb)
    s.lineTo(-w1, yb)
    s.bezierCurveTo(-w1 * 0.75, yb + 0.35, -w1 * 0.35, yb + 0.3, -w1 * 0.3, yb + 0.75)
    s.quadraticCurveTo(0, yb + 1.25, w1 * 0.3, yb + 0.75)
    s.bezierCurveTo(w1 * 0.35, yb + 0.3, w1 * 0.75, yb + 0.35, w1, yb)
    s.lineTo(w1 + 0.35, yb)
    s.lineTo(w1 + 0.35, yb - 0.3)
    s.lineTo(-w1 - 0.35, yb - 0.3)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: false, curveSegments: 14 })
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TILE.plaster, uv.getY(i) / TILE.plaster)
    return { geo: g, w1, yb }
  }, [W, top])

  const balusters = useMemo(() => {
    const out: number[] = []
    const inner = crown.w1 + 0.55
    for (const side of [-1, 1]) {
      const from = inner
      const to = W / 2 - 0.45
      const k = Math.max(2, Math.floor((to - from) / 0.32))
      for (let i = 0; i <= k; i++) out.push(cx + side * (from + ((to - from) * i) / k))
    }
    return out
  }, [W, cx, crown.w1])

  // 屋頂：立面後面的雙坡瓦頂（前緣藏在山頭後面）
  const eaveY = y0 + 0.05
  const ridgeZ = (A.backZ + FZ - 0.35) / 2
  const ridgeY = eaveY + (FZ - 0.35 - ridgeZ) * 0.52

  return (
    <group>
      {/* 二樓的牆 */}
      {pieces.map((p, i) => (
        <mesh key={i} geometry={boxGeo(p.s[0], p.s[1], p.s[2], TILE.plaster)} material={wall} position={p.c} castShadow receiveShadow />
      ))}
      {/* 柱形（立面兩側的壁柱）、腰線、簷口 */}
      {[x0 + 0.16, x1 - 0.16].map((x) => (
        <mesh key={x} geometry={boxGeo(0.32, y0 - A.ceilY, 0.12, 1)} material={trim} position={[x, (A.ceilY + y0) / 2, FZ + 0.06]} castShadow />
      ))}
      <mesh geometry={boxGeo(W + 0.18, 0.16, 0.36, 1)} material={trim} position={[cx, y0, FZ + 0.06]} castShadow />
      <mesh geometry={boxGeo(W + 0.06, 0.1, 0.2, 1)} material={trim} position={[cx, wy0 - 0.12, FZ + 0.04]} />
      {/* 窗：窗框、窗台、拱形的線腳、玻璃或百葉 */}
      {wins.map((x) => (
        <group key={x}>
          <mesh geometry={boxGeo(ww, wy1 - wy0, 0.04, 1)} material={style.windows === 'glass' ? (style.glow ?? glass) : shutter} position={[x, (wy0 + wy1) / 2, FZ - 0.14]} />
          {style.windows === 'shutter' &&
            [-1, 1].map((s) => (
              <mesh key={s} geometry={boxGeo(0.02, wy1 - wy0 - 0.1, 0.02, 1)} material={trim} position={[x + s * 0.02, (wy0 + wy1) / 2, FZ - 0.11]} />
            ))}
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={boxGeo(0.1, wy1 - wy0 + 0.1, 0.1, 1)} material={trim} position={[x + s * (ww / 2 + 0.05), (wy0 + wy1) / 2, FZ + 0.02]} />
          ))}
          <mesh geometry={boxGeo(ww + 0.34, 0.1, 0.22, 1)} material={trim} position={[x, wy0 - 0.02, FZ + 0.06]} />
          <mesh material={trim} position={[x, wy1, FZ + 0.03]}>
            <torusGeometry args={[ww / 2 + 0.05, 0.06, 6, 16, Math.PI]} />
          </mesh>
          <mesh material={wall} position={[x, wy1, FZ - 0.02]}>
            <circleGeometry args={[ww / 2, 16, 0, Math.PI]} />
          </mesh>
        </group>
      ))}
      {/* 女兒牆＋欄杆＋山頭 */}
      <mesh geometry={boxGeo(W, PARAPET - 0.25, 0.24, TILE.plaster)} material={wall} position={[cx, y0 + (PARAPET - 0.25) / 2, FZ - 0.12]} castShadow receiveShadow />
      <mesh geometry={boxGeo(W + 0.1, 0.08, 0.3, 1)} material={trim} position={[cx, top - 0.25, FZ - 0.1]} />
      {balusters.map((x) => (
        <mesh key={x} geometry={boxGeo(0.12, PARAPET - 0.55, 0.08, 1)} material={trim} position={[x, y0 + 0.2 + (PARAPET - 0.55) / 2, FZ + 0.02]} />
      ))}
      <mesh geometry={crown.geo} material={wall} position={[cx, 0, FZ - 0.24]} castShadow receiveShadow />
      {/* 山頭兩肩的寶瓶、兩端的柱頭 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={trim} position={[cx + s * (crown.w1 + 0.18), top + 0.0, FZ - 0.12]} castShadow>
            <sphereGeometry args={[0.13, 10, 8]} />
          </mesh>
          <mesh geometry={boxGeo(0.34, 0.5, 0.34, 1)} material={trim} position={[s < 0 ? x0 + 0.17 : x1 - 0.17, top - 0.05, FZ - 0.12]} castShadow />
          <mesh material={trim} position={[s < 0 ? x0 + 0.17 : x1 - 0.17, top + 0.32, FZ - 0.12]} castShadow>
            <sphereGeometry args={[0.14, 10, 8]} />
          </mesh>
        </group>
      ))}
      {crest && (
        <group position={[cx, crown.yb + 0.52, FZ + 0.02]}>
          <mesh material={trim} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.06, 24]} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <circleGeometry args={[0.32, 24]} />
            <meshStandardMaterial map={crest} roughness={0.7} />
          </mesh>
        </group>
      )}
      {/* 亭仔腳的天花板（木板）與柱樑 */}
      <WBox mat="wood" size={[W, 0.08, A.colZ - A.frontZ]} position={[cx, A.ceilY - 0.04, (A.colZ + A.frontZ) / 2]} castShadow={false} />
      <mesh geometry={boxGeo(W, 0.34, 0.3, TILE.plaster)} material={wall} position={[cx, A.ceilY + 0.1, FZ - 0.1]} castShadow />
      {/* 招牌 */}
      {sign && (
        <group>
          <mesh geometry={boxGeo(W - 0.9, 0.66, 0.06, 1)} material={mats.darkWood} position={[cx, 3.72, FZ + 0.05]} />
          <mesh position={[cx, 3.72, FZ + 0.085]}>
            <planeGeometry args={[W - 1.0, 0.58]} />
            <meshStandardMaterial map={sign} roughness={0.6} />
          </mesh>
        </group>
      )}
      {vsign && (
        <group position={[style.vsign?.x ?? x0 + 0.55, 5.0, FZ + 0.42]}>
          <mesh geometry={boxGeo(0.05, 0.05, 0.6, 1)} material={mats.metal} position={[0, 0.9, -0.2]} />
          <mesh geometry={boxGeo(0.06, 1.7, 0.5, 1)} material={mats.darkWood} />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.035, 0, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
              <planeGeometry args={[0.44, 1.62]} />
              <meshStandardMaterial map={vsign} roughness={0.6} />
            </mesh>
          ))}
        </group>
      )}
      {/* 二樓的房子本體（一樓是各家店面自己畫）＋屋頂＋兩側的山牆三角 */}
      <mesh geometry={boxGeo(W, y0 - 0.1 - A.ceilY, FZ - 0.3 - A.backZ, TILE.plaster)} material={wall} position={[cx, (A.ceilY + y0 - 0.1) / 2, (A.backZ + FZ - 0.3) / 2]} receiveShadow />
      {endWall && <mesh geometry={boxGeo(0.24, A.ceilY, A.frontZ - A.backZ, TILE.plaster)} material={wall} position={[x1 - 0.12, A.ceilY / 2, (A.frontZ + A.backZ) / 2]} receiveShadow />}
      <GableRoof axis="x" ridge={ridgeZ} ridgeY={ridgeY} from={x0 + 0.05} to={x1 - 0.05} edges={[A.backZ - 0.3, FZ - 0.35]} style="horseback" />
      {[x0 + 0.08, x1 - 0.08].map((x) => (
        <GableTri key={x} x={x} z0={A.backZ - 0.3} z1={FZ - 0.35} y={eaveY} ridgeY={ridgeY} mat={wall} />
      ))}
    </group>
  )
}

/** 屋頂兩端的三角形山牆（旁邊的房子比較矮時看得到） */
function GableTri({ x, z0, z1, y, ridgeY, mat }: { x: number; z0: number; z1: number; y: number; ridgeY: number; mat: THREE.Material }) {
  const geo = useMemo(() => {
    const zm = (z0 + z1) / 2
    const shape = new THREE.Shape([new THREE.Vector2(-z0, y - 0.1), new THREE.Vector2(-z1, y - 0.1), new THREE.Vector2(-zm, ridgeY - 0.05)])
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false })
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TILE.plaster, uv.getY(i) / TILE.plaster)
    return g
  }, [z0, z1, y, ridgeY])
  return <mesh geometry={geo} material={mat} position={[x - 0.08, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
}

// ---------------------------------------------------------------------------
// 亭仔腳的柱子（紅磚柱＋洗石子的柱頭柱腳）、地坪、街邊的台階
// ---------------------------------------------------------------------------

/** 亭仔腳的一根磚柱 */
export function ArcadeColumn({ x }: { x: number }) {
  return (
    <group position={[x, 0, A.colZ - 0.15]}>
      <WBox mat="brick" size={[0.4, A.ceilY - 0.3, 0.4]} position={[0, 0.14 + (A.ceilY - 0.3) / 2, 0]} />
      <WBox mat="trim" size={[0.52, 0.18, 0.52]} position={[0, 0.23, 0]} />
      <WBox mat="trim" size={[0.54, 0.16, 0.54]} position={[0, A.ceilY - 0.12, 0]} />
    </group>
  )
}

/** skip：這幾根柱子另外畫（例如放進淡出群組） */
export function Arcade({ skip = [] }: { skip?: number[] }) {
  const mats = useMats()
  const terrazzo = useMemo(() => {
    const m = mats.tile.clone()
    m.color.set('#c9b9a4')
    return m
  }, [mats])
  return (
    <group>
      {/* 亭仔腳的地（高一階的磨石子） */}
      <WBox mat="stone" size={[45, 0.14, A.colZ - A.frontZ + 0.1]} position={[0, 0.07, (A.colZ + A.frontZ) / 2 - 0.05]} castShadow={false} />
      <mesh geometry={boxGeo(45, 0.01, A.colZ - A.frontZ, TILE.tile)} material={terrazzo} position={[0, 0.145, (A.colZ + A.frontZ) / 2]} receiveShadow />
      {ARCADE_COLUMNS.filter((x) => !skip.includes(x)).map((x) => (
        <ArcadeColumn key={x} x={x} />
      ))}
    </group>
  )
}
