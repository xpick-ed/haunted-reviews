import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio'
import { LIBRARY, NURSE_ROOM, OFFICE, SCHOOL, nurseHere, schoolFx } from '../world/sceneSchool'
import { lanternAt } from './daylight'
import { BRUSH_FONT, WBox, canvasTexture, seeded, useMats } from './kit'
import { ChibiNpc } from '../chars/Chibi'
import '../chars/specs.school2'

// 廢棄國小另外三間的室內（DESIGN §30）：圖書室、保健室、教師辦公室。規則與座標在 src/world/sceneSchool.ts。
// RoomsInside 是不會動的家具（放進 School.tsx 的 MergeStatic）；RoomsLive 是會動的：燈、布簾、護士阿姨、廣播的下課鐘。

const S = SCHOOL
const B = S.block
const Y0 = B.floorY
const L = S.library
const N = S.nurse
const F = S.office
/** 牆的內側（隔間牆 0.2、外牆 0.24 厚） */
const IN_N = B.z0 + 0.13
const HALF_PI = Math.PI / 2

// 會被 RoomsLive 每幀調亮暗的材質（MergeStatic 合併後還是同一個材質物件）
const tubeMat = new THREE.MeshStandardMaterial({ color: '#ffb25a', emissive: '#ff8a2a', emissiveIntensity: 0.4, roughness: 0.3, toneMapped: false })
const lampMat = new THREE.MeshStandardMaterial({ color: '#f4e8c8', emissive: '#ffcf8a', emissiveIntensity: 0.2, roughness: 0.6, side: THREE.DoubleSide })

export function RoomsInside() {
  return (
    <group>
      <LibraryInside />
      <NurseInside />
      <OfficeInside />
      <Loudspeaker />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 貼圖
// ---------------------------------------------------------------------------

function paperTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, text: string, bg = '#efe6cf') {
  return canvasTexture(
    w,
    h,
    (ctx, cw, ch) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, cw, ch)
      // 泛黃的斑
      const r = seeded(w * 7 + h)
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(150,110,50,${r() * 0.08})`
        ctx.beginPath()
        ctx.arc(r() * cw, r() * ch, 8 + r() * 40, 0, Math.PI * 2)
        ctx.fill()
      }
      draw(ctx, cw, ch)
    },
    [{ spec: `700 40px ${BRUSH_FONT}`, text }],
  )
}

/** 圖書室規則（東牆，卡片櫃上面） */
function rulesTex() {
  const text = '圖書室規則一保持安靜二愛惜書籍三按時歸還'
  return paperTex(
    512,
    340,
    (ctx, w) => {
      ctx.fillStyle = '#2a2018'
      ctx.textAlign = 'center'
      ctx.font = `700 60px ${BRUSH_FONT}`
      ctx.fillText('圖書室規則', w / 2, 80)
      ctx.textAlign = 'left'
      ctx.font = `700 44px ${BRUSH_FONT}`
      ;['一、保持安靜', '二、愛惜書籍', '三、按時歸還'].forEach((t, i) => ctx.fillText(t, 90, 160 + i * 62))
      // 「按時歸還」被人用鉛筆圈起來
      ctx.strokeStyle = 'rgba(60,60,70,0.6)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(250, 270, 150, 36, -0.03, 0, Math.PI * 2)
      ctx.stroke()
    },
    text,
  )
}

/** 卡片櫃的正面：一格一格的小抽屜，白色標籤、銅把手 */
function catalogTex() {
  const labels = 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄚㄛㄜ'
  return canvasTexture(
    256,
    336,
    (ctx, w, h) => {
      ctx.fillStyle = '#5a3a22'
      ctx.fillRect(0, 0, w, h)
      const cols = 4
      const rows = 6
      const cw = w / cols
      const ch = h / rows
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          const x = i * cw
          const y = j * ch
          ctx.fillStyle = (i + j) % 2 ? '#6e4a2c' : '#684428'
          ctx.fillRect(x + 4, y + 4, cw - 8, ch - 8)
          ctx.fillStyle = '#efe6cf'
          ctx.fillRect(x + cw / 2 - 16, y + 12, 32, 18)
          ctx.fillStyle = '#2a2018'
          ctx.font = `700 15px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(labels[(i + j * cols) % labels.length], x + cw / 2, y + 22)
          ctx.fillStyle = '#c9a24a'
          ctx.beginPath()
          ctx.arc(x + cw / 2, y + ch - 16, 6, 0, Math.PI * 2)
          ctx.fill()
        }
    },
    [{ spec: `700 15px ${BRUSH_FONT}`, text: labels }],
  )
}

/** 陳春的借書卡 */
function borrowCardTex() {
  const text = '書名小婦人借書人六年甲班陳春日期三七十一二歸還'
  return paperTex(
    256,
    160,
    (ctx) => {
      ctx.strokeStyle = 'rgba(80,120,170,0.6)'
      ctx.lineWidth = 2
      for (let y = 46; y < 160; y += 26) {
        ctx.beginPath()
        ctx.moveTo(10, y)
        ctx.lineTo(246, y)
        ctx.stroke()
      }
      ctx.fillStyle = '#2a2a3a'
      ctx.font = `700 22px ${BRUSH_FONT}`
      ctx.fillText('書名：小婦人', 16, 36)
      ctx.fillText('借書人：六年甲班 陳春', 16, 66)
      ctx.fillText('借：37.10.12', 16, 92)
      ctx.fillText('還：', 16, 118)
    },
    text,
    '#f4ecd6',
  )
}

/** 視力表：一排一排的 E，越下面越小 */
function eyeChartTex() {
  return canvasTexture(
    256,
    460,
    (ctx, w, h) => {
      ctx.fillStyle = '#f6f3ea'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#8f2a20'
      ctx.lineWidth = 6
      ctx.strokeRect(6, 6, w - 12, h - 12)
      ctx.fillStyle = '#1a1a1e'
      ctx.font = `700 26px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('視力表', w / 2, 40)
      const r = seeded(1948)
      const sizes = [58, 44, 34, 26, 20, 15, 11, 8]
      let y = 70
      sizes.forEach((sz, row) => {
        const n = Math.min(6, 1 + row)
        for (let i = 0; i < n; i++) {
          const x = w / 2 + (i - (n - 1) / 2) * sz * 1.5
          ctx.save()
          ctx.translate(x, y + sz / 2)
          ctx.rotate(Math.floor(r() * 4) * HALF_PI)
          const u = sz / 5
          ctx.fillRect(-sz / 2, -sz / 2, u, sz)
          for (let k = 0; k < 3; k++) ctx.fillRect(-sz / 2, -sz / 2 + k * 2 * u, sz, u)
          ctx.restore()
        }
        ctx.font = `12px sans-serif`
        ctx.fillText((0.1 + row * 0.2).toFixed(1), 20, y + sz / 2 + 4)
        y += sz + 12
      })
    },
    [{ spec: `700 26px ${BRUSH_FONT}`, text: '視力表' }],
  )
}

/** 磨石子地（保健室） */
function terrazzoTex() {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b9b3a6'
    ctx.fillRect(0, 0, w, h)
    const r = seeded(77)
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = ['#8d867a', '#d8d2c4', '#6f6a60', '#a89c86', '#e8e2d4'][i % 5]
      const s = 1 + r() * 4
      ctx.fillRect(r() * w, r() * h, s, s * (0.6 + r() * 0.8))
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  return t
}

/** 辦公室西牆的行事曆黑板 */
function calendarTex() {
  const text = '十月行事曆國慶日光復節月考十八十九日運動會二十八日值日陳春'
  return canvasTexture(
    512,
    320,
    (ctx, w, h) => {
      ctx.fillStyle = '#26382e'
      ctx.fillRect(0, 0, w, h)
      const r = seeded(1010)
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(230,230,220,${r() * 0.06})`
        ctx.fillRect(r() * w, r() * h, 40 + r() * 140, 8 + r() * 26)
      }
      ctx.fillStyle = 'rgba(240,238,228,0.9)'
      ctx.font = `700 44px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('十月行事曆', w / 2, 58)
      ctx.textAlign = 'left'
      ctx.font = `700 30px ${BRUSH_FONT}`
      ;['十日　國慶日', '十八、十九日　月考', '廿五日　光復節', '廿八日　運動會'].forEach((t, i) => ctx.fillText(t, 40, 116 + i * 46))
      ctx.fillStyle = 'rgba(255,200,200,0.85)'
      ctx.fillText('值日：陳春', 330, 290)
    },
    [{ spec: `700 44px ${BRUSH_FONT}`, text }],
  )
}

/** 停在四點十分（放學）的掛鐘 */
function clockTex() {
  return canvasTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#f2ecdc'
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, 60, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#3d271a'
      ctx.lineWidth = 6
      ctx.stroke()
      ctx.fillStyle = '#1a1a1e'
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        ctx.fillRect(w / 2 + Math.sin(a) * 50 - 2, h / 2 - Math.cos(a) * 50 - 2, 4, 4)
      }
      ctx.lineCap = 'round'
      const hand = (a: number, len: number, wd: number) => {
        ctx.lineWidth = wd
        ctx.beginPath()
        ctx.moveTo(w / 2, h / 2)
        ctx.lineTo(w / 2 + Math.sin(a) * len, h / 2 - Math.cos(a) * len)
        ctx.stroke()
      }
      ctx.strokeStyle = '#1a1a1e'
      hand(((4 + 10 / 60) / 12) * Math.PI * 2, 30, 5)
      hand((10 / 60) * Math.PI * 2, 44, 3)
    },
    [],
  )
}

/** 攤開的點名簿：一格一格的圈，有一個紅叉 */
function rollBookTex() {
  return paperTex(
    256,
    180,
    (ctx, w, h) => {
      ctx.strokeStyle = 'rgba(80,80,90,0.5)'
      ctx.lineWidth = 1.5
      for (let y = 20; y < h - 10; y += 16) {
        ctx.beginPath()
        ctx.moveTo(10, y)
        ctx.lineTo(w - 10, y)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(w / 2, 6)
      ctx.lineTo(w / 2, h - 6)
      ctx.strokeStyle = 'rgba(60,40,20,0.6)'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = '#2a2a3a'
      for (let row = 0; row < 9; row++)
        for (let c = 0; c < 6; c++) {
          const x = 44 + c * 12 + (c > 2 ? 132 : 0)
          const y = 30 + row * 16
          ctx.beginPath()
          ctx.arc(x, y - 3, 3.5, 0, Math.PI * 2)
          ctx.fill()
          if (row === 3 && c === 4) {
            ctx.strokeStyle = '#c62828'
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.moveTo(x - 5, y - 8)
            ctx.lineTo(x + 5, y + 2)
            ctx.moveTo(x + 5, y - 8)
            ctx.lineTo(x - 5, y + 2)
            ctx.stroke()
          }
        }
      ctx.fillStyle = '#c62828'
      ctx.font = `700 22px ${BRUSH_FONT}`
      ctx.fillText('永遠出席', 150, 170)
    },
    '永遠出席',
  )
}

/** 考卷（紅筆改的一百分） */
function examTex() {
  return paperTex(
    128,
    160,
    (ctx, w) => {
      ctx.strokeStyle = 'rgba(80,80,90,0.45)'
      for (let y = 34; y < 150; y += 12) {
        ctx.beginPath()
        ctx.moveTo(10, y)
        ctx.lineTo(w - 10, y)
        ctx.stroke()
      }
      ctx.fillStyle = '#c62828'
      ctx.font = `700 34px ${BRUSH_FONT}`
      ctx.fillText('100', 60, 32)
    },
    '100',
    '#f2ead6',
  )
}

/** 紅十字（藥櫃上面） */
function crossTex() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#f6f3ea'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#c62828'
    ctx.fillRect(w / 2 - 8, 10, 16, h - 20)
    ctx.fillRect(10, h / 2 - 8, w - 20, 16)
  })
}

// ---------------------------------------------------------------------------
// 書架（本地座標：長度沿 x、開口朝 +z）
// ---------------------------------------------------------------------------

const BOOK_COLORS = ['#7a2e24', '#2e4a6b', '#3f5a36', '#8a6a2e', '#5a3a5e', '#c9b48a', '#6b4a30', '#2a2a30', '#a5452e']

function Bookcase({ len, h, d, rows, seed, position, rotation = 0 }: { len: number; h: number; d: number; rows: number; seed: number; position: [number, number, number]; rotation?: number }) {
  const books = useRef<THREE.InstancedMesh>(null)
  const list = useMemo(() => {
    const r = seeded(seed)
    const out: { x: number; y: number; w: number; bh: number; dd: number; tilt: number; c: number }[] = []
    const gap = (h - 0.08) / rows
    for (let j = 0; j < rows; j++) {
      const y = 0.04 + j * gap + 0.02
      let x = -len / 2 + 0.05
      while (x < len / 2 - 0.08) {
        // 有些地方空了（書被借走、沒還）
        if (r() < 0.08) {
          x += 0.12 + r() * 0.2
          continue
        }
        const w = 0.03 + r() * 0.045
        const bh = Math.min(gap - 0.05, 0.17 + r() * 0.13)
        const tilt = r() < 0.06 ? 0.3 + r() * 0.25 : 0
        out.push({ x: x + w / 2, y: y + bh / 2, w, bh, dd: d * (0.7 + r() * 0.2), tilt, c: Math.floor(r() * BOOK_COLORS.length) })
        x += w + 0.004 + (tilt ? 0.08 : 0)
      }
    }
    return out
  }, [len, h, d, rows, seed])
  useLayoutEffect(() => {
    const m = books.current
    if (!m) return
    const mat4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const col = new THREE.Color()
    list.forEach((b, i) => {
      q.setFromEuler(new THREE.Euler(0, 0, b.tilt))
      mat4.compose(new THREE.Vector3(b.x + b.tilt * 0.08, b.y - b.tilt * 0.02, 0.02), q, new THREE.Vector3(b.w, b.bh, b.dd))
      m.setMatrixAt(i, mat4)
      m.setColorAt(i, col.set(BOOK_COLORS[b.c]))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [list])
  const gap = (h - 0.08) / rows
  return (
    <group position={position} rotation-y={rotation}>
      <WBox mat="darkWood" size={[len, h, 0.03]} position={[0, h / 2, -d / 2 + 0.015]} />
      {[-1, 1].map((s) => (
        <WBox key={s} mat="darkWood" size={[0.04, h, d]} position={[(s * (len - 0.04)) / 2, h / 2, 0]} />
      ))}
      {Array.from({ length: rows + 1 }, (_, j) => (
        <WBox key={j} mat="darkWood" size={[len, 0.03, d]} position={[0, 0.04 + j * gap, 0]} />
      ))}
      <instancedMesh ref={books} args={[undefined, undefined, list.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 圖書室
// ---------------------------------------------------------------------------

function LibraryInside() {
  const mats = useMats()
  const rules = useMemo(rulesTex, [])
  const catalog = useMemo(catalogTex, [])
  const card = useMemo(borrowCardTex, [])
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.85 }), [])
  const page = useMemo(() => new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.95, side: THREE.DoubleSide }), [])
  const r = LIBRARY
  const T = L.table
  const C = L.catalog
  return (
    <group>
      <mesh rotation-x={-HALF_PI} position={[(r.x0 + r.x1) / 2, Y0 + 0.005, (r.z0 + r.z1) / 2]} material={mats.wood} receiveShadow>
        <planeGeometry args={[r.x1 - r.x0 - 0.2, r.z1 - r.z0 - 0.2]} />
      </mesh>
      {/* 西牆的高書架（開口朝東）、北牆窗下的矮書架 */}
      <Bookcase len={L.tallShelf.z1 - L.tallShelf.z0} h={2.2} d={0.32} rows={5} seed={31} position={[L.tallShelf.x, Y0, (L.tallShelf.z0 + L.tallShelf.z1) / 2]} rotation={HALF_PI} />
      <Bookcase len={L.lowShelf.x1 - L.lowShelf.x0} h={0.85} d={0.3} rows={2} seed={32} position={[(L.lowShelf.x0 + L.lowShelf.x1) / 2, Y0, L.lowShelf.z]} />
      {/* 矮書架上：地球儀 */}
      <group position={[L.lowShelf.x0 + 0.5, Y0 + 0.87, L.lowShelf.z]}>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.06, 12]} />
          <meshStandardMaterial color="#3d271a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation-z={0.4}>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshStandardMaterial color="#5f8aa0" roughness={0.5} />
        </mesh>
      </group>
      {/* 閱覽桌＋兩條板凳 */}
      <mesh material={wood} position={[T.x, Y0 + 0.72, T.z]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.05, 0.8]} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} material={wood} position={[T.x + sx * 0.68, Y0 + 0.35, T.z + sz * 0.33]}>
            <boxGeometry args={[0.05, 0.7, 0.05]} />
          </mesh>
        )),
      )}
      {[-1, 1].map((sz) => (
        <group key={sz} position={[T.x, Y0, T.z + sz * 0.65]}>
          <mesh material={wood} position={[0, 0.42, 0]} castShadow>
            <boxGeometry args={[1.4, 0.04, 0.26]} />
          </mesh>
          {[-0.6, 0.6].map((dx) => (
            <mesh key={dx} material={wood} position={[dx, 0.2, 0]}>
              <boxGeometry args={[0.04, 0.4, 0.22]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 桌上：攤開的書、一疊書 */}
      <group position={[T.x + 0.25, Y0 + 0.75, T.z + 0.05]} rotation-y={0.2}>
        {[-1, 1].map((s) => (
          <mesh key={s} material={page} position={[s * 0.1, 0.012, 0]} rotation={[-HALF_PI, s * 0.12, 0]}>
            <planeGeometry args={[0.2, 0.28]} />
          </mesh>
        ))}
      </group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[T.x - 0.45, Y0 + 0.77 + i * 0.045, T.z - 0.1]} rotation-y={i * 0.25 - 0.2}>
          <boxGeometry args={[0.24, 0.04, 0.32]} />
          <meshStandardMaterial color={BOOK_COLORS[i * 3]} roughness={0.8} />
        </mesh>
      ))}
      {/* 卡片櫃（正面朝西）：最上面一格抽屜拉出來，陳春的借書卡放在上面 */}
      <group position={[C.x, Y0, C.z]}>
        <mesh material={wood} position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.46, 1.1, 0.82]} />
        </mesh>
        <mesh position={[-0.232, 0.62, 0]} rotation-y={-HALF_PI}>
          <planeGeometry args={[0.78, 0.9]} />
          <meshStandardMaterial map={catalog} roughness={0.8} />
        </mesh>
        <mesh position={[-0.34, 1.0, 0.1]}>
          <boxGeometry args={[0.24, 0.12, 0.18]} />
          <meshStandardMaterial color="#6e4a2c" roughness={0.8} />
        </mesh>
        <mesh position={[-0.14, 1.112, -0.12]} rotation={[-HALF_PI, 0, 0.3]}>
          <planeGeometry args={[0.2, 0.125]} />
          <meshStandardMaterial map={card} roughness={0.9} />
        </mesh>
      </group>
      {/* 東牆：圖書室規則 */}
      <mesh position={[S.splits[0] - 0.11, Y0 + 1.85, C.z]} rotation-y={-HALF_PI}>
        <planeGeometry args={[0.9, 0.6]} />
        <meshStandardMaterial map={rules} roughness={0.95} />
      </mesh>
      {/* 地上掉了幾本書 */}
      {[
        [L.tallShelf.x + 0.45, L.tallShelf.z0 + 0.6, 0.4],
        [L.tallShelf.x + 0.6, L.tallShelf.z0 + 0.75, 1.3],
        [T.x + 0.9, T.z + 1.05, 2.2],
      ].map(([x, z, a], i) => (
        <mesh key={i} position={[x, Y0 + 0.025, z]} rotation-y={a}>
          <boxGeometry args={[0.2, 0.035, 0.28]} />
          <meshStandardMaterial color={BOOK_COLORS[i + 4]} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 保健室
// ---------------------------------------------------------------------------

function NurseInside() {
  const chart = useMemo(eyeChartTex, [])
  const terrazzo = useMemo(terrazzoTex, [])
  const cross = useMemo(crossTex, [])
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dcd8cc', roughness: 0.5, metalness: 0.35 }), [])
  const cream = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8e2cf', roughness: 0.7 }), [])
  const sheet = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.95 }), [])
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b8ccd4', roughness: 0.1, transparent: true, opacity: 0.25, depthWrite: false }), [])
  const r = NURSE_ROOM
  const bed = N.bed
  const bx = (bed.x0 + bed.x1) / 2
  const bz = (bed.z0 + bed.z1) / 2
  const bl = bed.z1 - bed.z0
  const bw = bed.x1 - bed.x0
  const IN_E = S.splits[1] - 0.11
  return (
    <group>
      <mesh rotation-x={-HALF_PI} position={[(r.x0 + r.x1) / 2, Y0 + 0.005, (r.z0 + r.z1) / 2]} receiveShadow>
        <planeGeometry args={[r.x1 - r.x0 - 0.2, r.z1 - r.z0 - 0.2]} />
        <meshStandardMaterial map={terrazzo} roughness={0.55} />
      </mesh>
      {/* 鐵床：白漆的床架、床頭床尾的欄杆、床墊、枕頭、摺好的軍毯 */}
      <group position={[bx, Y0, bz]}>
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} material={paint} position={[(sx * (bw - 0.04)) / 2, sz < 0 ? 0.45 : 0.36, (sz * (bl - 0.04)) / 2]}>
              <cylinderGeometry args={[0.02, 0.02, sz < 0 ? 0.9 : 0.72, 6]} />
            </mesh>
          )),
        )}
        {[-1, 1].map((sz) => (
          <group key={sz} position={[0, 0, (sz * (bl - 0.04)) / 2]}>
            {[sz < 0 ? 0.88 : 0.7, 0.5].map((y) => (
              <mesh key={y} material={paint} position={[0, y, 0]} rotation-z={HALF_PI}>
                <cylinderGeometry args={[0.018, 0.018, bw, 6]} />
              </mesh>
            ))}
            {[-0.2, 0, 0.2].map((x) => (
              <mesh key={x} material={paint} position={[x, sz < 0 ? 0.69 : 0.6, 0]}>
                <cylinderGeometry args={[0.01, 0.01, sz < 0 ? 0.38 : 0.2, 5]} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh material={sheet} position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[bw - 0.06, 0.13, bl - 0.08]} />
        </mesh>
        <mesh material={sheet} position={[0, 0.6, -bl / 2 + 0.22]} scale={[1, 0.45, 0.6]}>
          <sphereGeometry args={[0.28, 12, 8]} />
        </mesh>
        <mesh position={[0, 0.6, bl / 2 - 0.3]}>
          <boxGeometry args={[bw - 0.1, 0.1, 0.36]} />
          <meshStandardMaterial color="#6b6a4a" roughness={0.95} />
        </mesh>
      </group>
      {/* 布簾的軌道（布簾在 RoomsLive，會飄） */}
      <mesh material={paint} position={[bed.x1 + 0.17, Y0 + 2.1, (bed.z0 + bed.z1 + 0.2) / 2 - 0.05]} rotation-x={HALF_PI}>
        <cylinderGeometry args={[0.012, 0.012, bl + 0.25, 5]} />
      </mesh>
      <mesh material={paint} position={[(r.x0 + bed.x1 + 0.17) / 2, Y0 + 2.1, bed.z1 + 0.2]} rotation-z={HALF_PI}>
        <cylinderGeometry args={[0.012, 0.012, bed.x1 + 0.17 - r.x0, 5]} />
      </mesh>
      {/* 東牆的藥櫃（正面朝西）：玻璃門、藥瓶，上面一個紅十字 */}
      <group position={[N.cabinet.x, Y0, N.cabinet.z]}>
        <mesh material={cream} position={[0, 0.875, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.35, 1.75, 1.0]} />
        </mesh>
        {[0.55, 0.95, 1.35].map((y) => (
          <mesh key={y} material={cream} position={[-0.16, y, 0]}>
            <boxGeometry args={[0.04, 0.02, 0.94]} />
          </mesh>
        ))}
        {[0.58, 0.98, 1.38].flatMap((y, j) =>
          [-0.36, -0.22, -0.08, 0.06, 0.2, 0.34].map((z, i) => {
            const k = (i + j * 2) % 4
            return (
              <mesh key={`${y}${z}`} position={[-0.12, y + 0.08, z]}>
                <cylinderGeometry args={[0.035, 0.04, k === 3 ? 0.12 : 0.16, 8]} />
                <meshStandardMaterial color={['#5a3218', '#dfe8e8', '#2e4a6b', '#8a2a20'][k]} roughness={0.2} transparent={k === 1} opacity={k === 1 ? 0.6 : 1} />
              </mesh>
            )
          }),
        )}
        <mesh material={glass} position={[-0.178, 1.05, 0]} rotation-y={-HALF_PI}>
          <planeGeometry args={[0.94, 1.2]} />
        </mesh>
        <mesh position={[-0.05, 1.86, 0]} rotation-y={-HALF_PI}>
          <boxGeometry args={[0.24, 0.24, 0.04]} />
          <meshStandardMaterial map={cross} roughness={0.8} />
        </mesh>
      </group>
      {/* 東北角：身高體重計 */}
      <group position={[N.scale.x, Y0, N.scale.z]}>
        <mesh material={paint} position={[0, 0.05, 0]} castShadow>
          <boxGeometry args={[0.44, 0.1, 0.44]} />
        </mesh>
        <mesh material={paint} position={[0, 0.95, -0.17]}>
          <boxGeometry args={[0.05, 1.8, 0.05]} />
        </mesh>
        <mesh position={[0.12, 1.05, -0.17]}>
          <boxGeometry args={[0.3, 0.03, 0.04]} />
          <meshStandardMaterial color="#3a3a40" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0.18, 1.05, -0.17]}>
          <boxGeometry args={[0.04, 0.06, 0.06]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh material={paint} position={[0, 1.55, -0.02]}>
          <boxGeometry args={[0.03, 0.02, 0.3]} />
        </mesh>
      </group>
      {/* 東牆：視力表 */}
      <mesh position={[IN_E, Y0 + 1.5, N.chart.z]} rotation-y={-HALF_PI}>
        <planeGeometry args={[0.44, 0.8]} />
        <meshStandardMaterial map={chart} roughness={0.9} />
      </mesh>
      {/* 床尾的小桌：紅藥水、棉花罐、腰子盤 */}
      <group position={[N.tray.x, Y0, N.tray.z]}>
        <mesh material={paint} position={[0, 0.68, 0]} castShadow>
          <boxGeometry args={[0.44, 0.03, 0.38]} />
        </mesh>
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} material={paint} position={[sx * 0.19, 0.34, sz * 0.16]}>
              <cylinderGeometry args={[0.012, 0.012, 0.68, 5]} />
            </mesh>
          )),
        )}
        <mesh position={[-0.1, 0.76, 0.05]}>
          <cylinderGeometry args={[0.03, 0.035, 0.12, 10]} />
          <meshStandardMaterial color="#b3121a" roughness={0.15} />
        </mesh>
        <mesh position={[-0.1, 0.835, 0.05]}>
          <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
          <meshStandardMaterial color="#f2f0ea" roughness={0.6} />
        </mesh>
        <mesh position={[0.08, 0.76, -0.06]}>
          <cylinderGeometry args={[0.05, 0.05, 0.13, 12]} />
          <meshStandardMaterial color="#e8f0f0" roughness={0.1} transparent opacity={0.55} />
        </mesh>
        <mesh position={[0.08, 0.73, -0.06]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
        <mesh position={[0.06, 0.705, 0.1]} scale={[1.6, 0.3, 1]}>
          <sphereGeometry args={[0.06, 12, 6, 0, Math.PI * 2, 0, HALF_PI]} />
          <meshStandardMaterial color="#b8bcc2" metalness={0.8} roughness={0.25} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 護士阿姨的桌子（靠南牆）：登記簿、熱水瓶、糖果罐（勇敢的囡仔一人一顆）、檯燈 */}
      <group position={[N.desk.x, Y0, N.desk.z]}>
        <mesh material={cream} position={[0, 0.74, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.04, 0.56]} />
        </mesh>
        <mesh material={cream} position={[0.3, 0.37, 0]}>
          <boxGeometry args={[0.38, 0.7, 0.52]} />
        </mesh>
        {[-0.24, 0.24].map((z) => (
          <mesh key={z} material={cream} position={[-0.46, 0.37, z]}>
            <boxGeometry args={[0.04, 0.74, 0.04]} />
          </mesh>
        ))}
        <mesh position={[-0.05, 0.78, -0.05]} rotation-y={0.1}>
          <boxGeometry args={[0.3, 0.03, 0.22]} />
          <meshStandardMaterial color="#2e4a6b" roughness={0.8} />
        </mesh>
        <mesh position={[0.32, 0.9, 0.05]}>
          <cylinderGeometry args={[0.06, 0.06, 0.28, 12]} />
          <meshStandardMaterial color="#c8423a" roughness={0.4} />
        </mesh>
        <mesh position={[0.12, 0.83, 0.12]}>
          <cylinderGeometry args={[0.06, 0.06, 0.14, 12]} />
          <meshStandardMaterial color="#f0f4f4" roughness={0.1} transparent opacity={0.5} />
        </mesh>
        {/* 檯燈：燈罩會亮（RoomsLive 調亮度） */}
        <group position={[-0.32, 0.76, 0.1]}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.03, 12]} />
            <meshStandardMaterial color="#3a4a3e" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.36, 5]} />
            <meshStandardMaterial color="#3a4a3e" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh material={lampMat} position={[0, 0.38, 0]}>
            <coneGeometry args={[0.11, 0.12, 14, 1, true]} />
          </mesh>
        </group>
        {/* 椅子（桌子北邊，面向牆） */}
        <group position={[0, 0, -0.55]}>
          <mesh material={cream} position={[0, 0.44, 0]}>
            <boxGeometry args={[0.38, 0.04, 0.36]} />
          </mesh>
          <mesh material={cream} position={[0, 0.7, -0.17]}>
            <boxGeometry args={[0.36, 0.34, 0.03]} />
          </mesh>
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} material={paint} position={[sx * 0.16, 0.22, sz * 0.15]}>
                <cylinderGeometry args={[0.012, 0.012, 0.44, 5]} />
              </mesh>
            )),
          )}
        </group>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 教師辦公室
// ---------------------------------------------------------------------------

function OfficeInside() {
  const mats = useMats()
  const cal = useMemo(calendarTex, [])
  const clock = useMemo(clockTex, [])
  const roll = useMemo(rollBookTex, [])
  const exam = useMemo(examTex, [])
  const desk = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b4a30', roughness: 0.75 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5f7466', roughness: 0.5, metalness: 0.45 }), [])
  const black = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1a1e', roughness: 0.5, metalness: 0.3 }), [])
  const r = OFFICE
  const D = F.desks
  const BC = F.broadcast
  const IN_W = S.splits[1] + 0.11
  const IN_E = S.splits[2] - 0.11
  return (
    <group>
      <mesh rotation-x={-HALF_PI} position={[(r.x0 + r.x1) / 2, Y0 + 0.005, (r.z0 + r.z1) / 2]} material={mats.wood} receiveShadow>
        <planeGeometry args={[r.x1 - r.x0 - 0.2, r.z1 - r.z0 - 0.2]} />
      </mesh>
      {/* 兩張對拼的辦公桌（中間一條縫），前後各一張椅子 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[D.x, Y0, D.z + s * 0.33]}>
          <mesh material={desk} position={[0, 0.74, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 0.04, 0.64]} />
          </mesh>
          <mesh material={desk} position={[0.33, 0.37, 0]}>
            <boxGeometry args={[0.42, 0.7, 0.6]} />
          </mesh>
          {[0.2, 0.4, 0.6].map((y) => (
            <mesh key={y} position={[0.33, y, s * 0.302]}>
              <boxGeometry args={[0.06, 0.02, 0.01]} />
              <meshStandardMaterial color="#c9a24a" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
          <mesh material={desk} position={[-0.52, 0.37, 0]}>
            <boxGeometry args={[0.04, 0.72, 0.6]} />
          </mesh>
          {/* 椅子 */}
          <group position={[-0.15, 0, s * 0.62]}>
            <mesh material={desk} position={[0, 0.44, 0]}>
              <boxGeometry args={[0.4, 0.04, 0.38]} />
            </mesh>
            <mesh material={desk} position={[0, 0.72, s * 0.18]}>
              <boxGeometry args={[0.38, 0.36, 0.03]} />
            </mesh>
            {[-1, 1].flatMap((sx) =>
              [-1, 1].map((sz) => (
                <mesh key={`${sx}${sz}`} material={desk} position={[sx * 0.17, 0.22, sz * 0.16]}>
                  <boxGeometry args={[0.03, 0.44, 0.03]} />
                </mesh>
              )),
            )}
          </group>
        </group>
      ))}
      {/* 南邊那張桌上：攤開的點名簿、藤條；北邊那張：考卷、算盤、有蓋的茶杯 */}
      <mesh position={[D.x - 0.1, Y0 + 0.765, D.z + 0.33]} rotation={[-HALF_PI, 0, Math.PI - 0.15]}>
        <planeGeometry args={[0.42, 0.3]} />
        <meshStandardMaterial map={roll} roughness={0.9} />
      </mesh>
      <mesh position={[D.x + 0.05, Y0 + 0.772, D.z + 0.55]} rotation={[0, 0.25, HALF_PI]}>
        <cylinderGeometry args={[0.006, 0.006, 0.7, 5]} />
        <meshStandardMaterial color="#b9a063" roughness={0.6} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[D.x - 0.2 + i * 0.03, Y0 + 0.763 + i * 0.002, D.z - 0.35 + i * 0.02]} rotation={[-HALF_PI, 0, 0.1 - i * 0.12]}>
          <planeGeometry args={[0.2, 0.26]} />
          <meshStandardMaterial map={exam} roughness={0.9} />
        </mesh>
      ))}
      <group position={[D.x + 0.25, Y0 + 0.77, D.z - 0.42]} rotation-y={0.1}>
        <mesh material={desk}>
          <boxGeometry args={[0.34, 0.03, 0.12]} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} material={black} position={[-0.14 + i * 0.035, 0.02, 0.02]}>
            <sphereGeometry args={[0.012, 6, 4]} />
          </mesh>
        ))}
      </group>
      <mesh position={[D.x + 0.42, Y0 + 0.81, D.z - 0.2]}>
        <cylinderGeometry args={[0.04, 0.035, 0.09, 12]} />
        <meshStandardMaterial color="#f2f0ea" roughness={0.3} />
      </mesh>
      {/* 東牆：廣播台（擴大機＋真空管、桌上型麥克風、唱盤），上面是停在四點十分的鐘 */}
      <group position={[BC.x, Y0, BC.z]}>
        <mesh material={desk} position={[0, 0.74, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.04, 1.2]} />
        </mesh>
        <mesh material={desk} position={[0, 0.37, 0]}>
          <boxGeometry args={[0.46, 0.7, 1.12]} />
        </mesh>
        <mesh material={steel} position={[0.05, 0.9, -0.3]} castShadow>
          <boxGeometry args={[0.32, 0.28, 0.46]} />
        </mesh>
        {[-0.14, 0, 0.14].map((z) => (
          <mesh key={z} material={tubeMat} position={[0.1, 1.1, -0.3 + z]}>
            <cylinderGeometry args={[0.025, 0.025, 0.1, 8]} />
          </mesh>
        ))}
        {[-0.15, -0.05, 0.05, 0.15].map((z) => (
          <mesh key={z} material={black} position={[-0.115, 0.86, -0.3 + z]} rotation-z={HALF_PI}>
            <cylinderGeometry args={[0.022, 0.022, 0.02, 10]} />
          </mesh>
        ))}
        <mesh material={black} position={[-0.1, 0.77, 0.15]}>
          <cylinderGeometry args={[0.06, 0.07, 0.03, 12]} />
        </mesh>
        <mesh material={steel} position={[-0.1, 0.9, 0.15]}>
          <cylinderGeometry args={[0.008, 0.008, 0.24, 6]} />
        </mesh>
        <mesh material={black} position={[-0.12, 1.04, 0.15]} rotation-z={0.4}>
          <capsuleGeometry args={[0.035, 0.06, 4, 10]} />
        </mesh>
        <mesh material={desk} position={[0.05, 0.79, 0.38]}>
          <boxGeometry args={[0.36, 0.06, 0.36]} />
        </mesh>
        <mesh material={black} position={[0.05, 0.83, 0.38]}>
          <cylinderGeometry args={[0.14, 0.14, 0.01, 20]} />
        </mesh>
      </group>
      <mesh position={[IN_E, Y0 + 2.35, BC.z]} rotation-y={-HALF_PI}>
        <circleGeometry args={[0.18, 24]} />
        <meshStandardMaterial map={clock} roughness={0.7} />
      </mesh>
      {/* 西牆：行事曆黑板 */}
      <WBox mat="darkWood" size={[0.05, 1.08, 1.68]} position={[IN_W - 0.01, Y0 + 1.6, D.z - 0.1]} />
      <mesh position={[IN_W + 0.02, Y0 + 1.6, D.z - 0.1]} rotation-y={HALF_PI}>
        <planeGeometry args={[1.6, 1.0]} />
        <meshStandardMaterial map={cal} roughness={0.95} />
      </mesh>
      {/* 西北角的矮鐵櫃、西南角的油印機 */}
      <group position={[F.cabinet.x, Y0, F.cabinet.z]}>
        <mesh material={steel} position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.56, 0.84, 0.46]} />
        </mesh>
        {[0.25, 0.6].map((y) => (
          <mesh key={y} material={black} position={[0, y, 0.232]}>
            <boxGeometry args={[0.12, 0.025, 0.01]} />
          </mesh>
        ))}
      </group>
      <group position={[F.mimeo.x, Y0, F.mimeo.z]}>
        <mesh material={desk} position={[0, 0.34, 0]}>
          <boxGeometry args={[0.6, 0.68, 0.5]} />
        </mesh>
        <mesh material={black} position={[0, 0.8, 0]} rotation-x={HALF_PI}>
          <cylinderGeometry args={[0.1, 0.1, 0.4, 16]} />
        </mesh>
        <mesh material={steel} position={[0.26, 0.86, 0]} rotation-z={-0.6}>
          <cylinderGeometry args={[0.01, 0.01, 0.2, 5]} />
        </mesh>
        <mesh position={[-0.12, 0.7, 0.05]}>
          <boxGeometry args={[0.24, 0.04, 0.32]} />
          <meshStandardMaterial color="#efe6cf" roughness={0.95} />
        </mesh>
      </group>
      {/* 北牆內側：窗下一排掛勾，掛著一件老師的外套 */}
      <mesh position={[D.x + 0.9, Y0 + 1.65, IN_N + 0.06]}>
        <boxGeometry args={[0.36, 0.55, 0.06]} />
        <meshStandardMaterial color="#4a4f5a" roughness={0.95} />
      </mesh>
    </group>
  )
}

/** 走廊柱子上的喇叭（辦公室廣播從這裡出來） */
function Loudspeaker() {
  const x = S.corridor.colXs[3]
  return (
    <group position={[x, 2.55, S.corridor.colZ + 0.18]} rotation-x={0.35}>
      <mesh position={[0, 0, 0.1]} rotation-x={HALF_PI}>
        <coneGeometry args={[0.16, 0.34, 14, 1, true]} />
        <meshStandardMaterial color="#8c9088" roughness={0.5} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="#5b5f66" roughness={0.5} metalness={0.5} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 會動的：燈、布簾、護士阿姨、廣播的下課鐘、第一次走進去的感想
// ---------------------------------------------------------------------------

export function RoomsLive({ outline }: { outline: boolean }) {
  const libLight = useRef<THREE.PointLight>(null)
  const nurseLight = useRef<THREE.PointLight>(null)
  const ampLight = useRef<THREE.PointLight>(null)
  const curtain = useRef<THREE.Group>(null)
  const nurse = useRef<THREE.Group>(null)
  const seen = useRef({ chime: schoolFx.chimeAt })
  const chimeT = useRef(-99)
  useFrame(({ clock }) => {
    const s = useStore.getState()
    const l = lanternAt(s.time)
    const t = clock.elapsedTime
    if (schoolFx.chimeAt !== seen.current.chime) {
      seen.current.chime = schoolFx.chimeAt
      chimeT.current = t
      playChime()
    }
    // 廣播時真空管亮起來
    const on = t - chimeT.current < 7 ? 1 : 0
    tubeMat.emissiveIntensity = 0.35 + l * 0.6 + on * (1.4 + Math.sin(t * 9) * 0.2)
    lampMat.emissiveIntensity = 0.1 + l * 1.4
    if (libLight.current) libLight.current.intensity = 2.2 * l
    if (nurseLight.current) nurseLight.current.intensity = 2.4 * l * (0.92 + Math.sin(t * 2.3) * 0.04)
    if (ampLight.current) ampLight.current.intensity = 0.6 * l + on * 1.6
    // 布簾：晚上輕輕飄（像有人剛走過）
    const c = curtain.current
    if (c) {
      const k = 0.02 + 0.05 * l
      c.children.forEach((p, i) => {
        p.rotation.z = Math.sin(t * 0.9 + i * 1.7) * k
        p.scale.x = 1 + Math.sin(t * 0.6 + i) * 0.03
      })
    }
    if (nurse.current) nurse.current.visible = nurseHere(s)
    // 第一次走進圖書室／辦公室：阿嬤的感想
    if (s.room === 'library' && !s.flags.school_lib_seen) {
      useStore.setState({ flags: { ...s.flags, school_lib_seen: true } })
      s.bark('school2.lib.enter')
    } else if (s.room === 'office' && !s.flags.school_office_seen) {
      useStore.setState({ flags: { ...s.flags, school_office_seen: true } })
      s.bark('school2.office.enter')
    }
  })
  const bed = N.bed
  return (
    <group userData={{ noMerge: true }}>
      <pointLight ref={libLight} position={[(LIBRARY.x0 + LIBRARY.x1) / 2, 2.6, (LIBRARY.z0 + LIBRARY.z1) / 2]} color="#9fb8e8" intensity={0} distance={6} decay={2} />
      <pointLight ref={nurseLight} position={[N.desk.x - 0.32, Y0 + 1.25, N.desk.z - 0.1]} color="#ffcf8a" intensity={0} distance={5} decay={2} />
      <pointLight ref={ampLight} position={[F.broadcast.x - 0.3, Y0 + 1.3, F.broadcast.z - 0.3]} color="#ffb060" intensity={0} distance={4.5} decay={2} />
      {/* 病床的白布簾：東邊拉了一半、南邊一小片 */}
      <group ref={curtain}>
        <CurtainPanel position={[bed.x1 + 0.17, Y0 + 2.08, bed.z0 + 0.5]} width={0.95} rotation={HALF_PI} />
        <CurtainPanel position={[bed.x0 + 0.28, Y0 + 2.08, bed.z1 + 0.2]} width={0.6} rotation={0} />
      </group>
      {/* 護士阿姨：陰陽眼才看得到，站在藥櫃前 */}
      <group ref={nurse} visible={false}>
        <ChibiNpc id="nurse" pose="clasp" position={[N.ghost.x, Y0, N.ghost.z]} heading={0.35} seesGhosts outline={outline} />
      </group>
    </group>
  )
}

/** 一片布簾：上面固定在軌道上，下面有波浪的皺褶 */
function CurtainPanel({ position, width, rotation }: { position: [number, number, number]; width: number; rotation: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, 1.75, 16, 4)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      p.setZ(i, Math.sin((x / width) * Math.PI * 7) * 0.04)
      p.setY(i, p.getY(i) - 0.875)
    }
    g.computeVertexNormals()
    return g
  }, [width])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.88 }), [])
  return (
    <group position={position} rotation-y={rotation}>
      <mesh geometry={geo} material={mat} castShadow />
    </group>
  )
}

/** 下課鐘（西敏寺鐘聲）：從走廊的喇叭放出來，有點沙沙的、有回音 */
function playChime() {
  const ctx = audio.ctx
  if (!ctx) return
  const out = ctx.createGain()
  out.gain.value = 0.9
  // 老喇叭：只剩中頻
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1400
  bp.Q.value = 0.7
  const delay = ctx.createDelay(1)
  delay.delayTime.value = 0.23
  const fb = ctx.createGain()
  fb.gain.value = 0.28
  bp.connect(out)
  bp.connect(delay)
  delay.connect(fb).connect(delay)
  delay.connect(out)
  out.connect(audio.bus.sfx)
  // E C D G ／ G D E C
  const notes = [64, 60, 62, 55, 55, 62, 64, 60]
  const t0 = ctx.currentTime + 0.05
  notes.forEach((n, i) => {
    const t = t0 + i * 0.62 + (i >= 4 ? 0.5 : 0)
    const f = 440 * Math.pow(2, (n - 69) / 12)
    const len = i === 3 || i === 7 ? 2.2 : 1.3
    for (const [mul, a] of [
      [1, 0.2],
      [2, 0.08],
      [2.76, 0.04],
      [5.4, 0.015],
    ]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * mul
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(a, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + len)
      o.connect(g).connect(bp)
      o.start(t)
      o.stop(t + len + 0.05)
    }
  })
  window.setTimeout(() => out.disconnect(), 9000)
}

