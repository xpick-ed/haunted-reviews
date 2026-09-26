import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { ICE_IN } from '../world/osEast'
import { BRUSH_FONT, TILE, WBox, boxGeo, canvasTexture, useMats } from './kit'
import { FZ } from './OldStreetFacades'
import { Fader } from './OldStreetFader'
import { ChibiNpc } from '../chars/Chibi'
import { A, BACK, Box, FLOOR, O, Wall, flat, glassMat, useFloorMat, useNightGlow, usePlaster } from './OldStreetEastKit'
import { lanternAt } from './daylight'

// 阿桃冰果室（DESIGN §30）：店面整片打開，剉冰機的櫃台在店面線上、阿桃站在後面；
// 走進去是粉紅色的牆、薄荷綠的馬賽克牆裙、三張大理石小圓桌、吊扇、玻璃冰箱（彈珠汽水）、點唱機、水果櫃和果汁機。
// 外殼（ShellIce，走進店裡時淡出）放在 OldStreetEast.tsx 的 Fader 裡。

const LOT = O.lots.find((l) => l.id === 'ice')!
const I = O.ice
const PINK = '#f2dcd4'
const MINT = '#9fd4c4'

// ---------------------------------------------------------------------------
// 貼圖
// ---------------------------------------------------------------------------

function menuTexture() {
  const items = [
    ['木瓜牛奶', '十元'],
    ['紅豆牛奶冰', '八元'],
    ['彈珠汽水', '五元'],
    ['芒果冰', '八元'],
    ['綜合冰', '十元'],
    ['粉圓冰', '五元'],
    ['檸檬愛玉', '四元'],
  ]
  return canvasTexture(
    480,
    420,
    (ctx, w, h) => {
      ctx.fillStyle = '#23402f'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#b08a5a'
      ctx.lineWidth = 16
      ctx.strokeRect(8, 8, w - 16, h - 16)
      ctx.fillStyle = '#f4efe0'
      ctx.textBaseline = 'middle'
      ctx.font = `700 46px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('冰 品 ・ 果 汁', w / 2, 52)
      ctx.font = `500 32px ${BRUSH_FONT}`
      items.forEach(([n, p], i) => {
        const y = 108 + i * 44
        ctx.fillStyle = i === 0 ? '#ffd27a' : '#f4efe0'
        ctx.textAlign = 'left'
        ctx.fillText(n, 38, y)
        ctx.textAlign = 'right'
        ctx.fillText(p, w - 38, y)
      })
    },
    [{ spec: `700 46px ${BRUSH_FONT}`, text: '冰品果汁木瓜牛奶紅豆彈珠汽水芒果綜合粉圓檸檬愛玉十八五四元・' }],
  )
}

/** 民國六十年的月曆（上面一張荷花） */
function calendarTexture() {
  return canvasTexture(
    200,
    300,
    (ctx, w, h) => {
      ctx.fillStyle = '#f7f2e6'
      ctx.fillRect(0, 0, w, h)
      const g = ctx.createLinearGradient(0, 20, 0, 180)
      g.addColorStop(0, '#9ad0e0')
      g.addColorStop(1, '#3e8a6a')
      ctx.fillStyle = g
      ctx.fillRect(16, 16, w - 32, 170)
      // 荷花
      ctx.fillStyle = '#f29ab8'
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.ellipse(w / 2 + Math.cos(i) * 18, 110 - Math.abs(Math.sin(i)) * 12, 11, 26, i * 0.5 - 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#2e6a3e'
      ctx.beginPath()
      ctx.ellipse(w / 2 - 40, 165, 34, 10, 0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#c62828'
      ctx.font = `700 26px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('民國六十年　七月', w / 2, 210)
      ctx.fillStyle = '#3a2a18'
      ctx.font = `500 15px ${BRUSH_FONT}`
      for (let r = 0; r < 4; r++)
        ctx.fillText(
          '1 2 3 4 5 6 7'.replace(/\d/g, (d) => String(+d + r * 7)),
          w / 2,
          240 + r * 16,
        )
    },
    [{ spec: `700 26px ${BRUSH_FONT}`, text: '民國六十年七月' }],
  )
}

/** 點唱機的正面：弧形的頂、唱片窗、選歌鍵 */
function jukeboxTexture() {
  return canvasTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = '#5a2a1a'
    ctx.fillRect(0, 0, w, h)
    // 弧形的木框
    ctx.fillStyle = '#8a4a26'
    ctx.beginPath()
    ctx.moveTo(18, h)
    ctx.lineTo(18, 120)
    ctx.arc(w / 2, 120, w / 2 - 18, Math.PI, 0)
    ctx.lineTo(w - 18, h)
    ctx.fill()
    // 唱片窗
    ctx.fillStyle = '#1c1414'
    ctx.beginPath()
    ctx.arc(w / 2, 128, 70, Math.PI, 0)
    ctx.lineTo(w / 2 + 70, 190)
    ctx.lineTo(w / 2 - 70, 190)
    ctx.fill()
    ctx.fillStyle = '#2a2222'
    ctx.beginPath()
    ctx.arc(w / 2, 172, 48, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#d8342b'
    ctx.beginPath()
    ctx.arc(w / 2, 172, 14, 0, Math.PI * 2)
    ctx.fill()
    // 選歌的卡片、按鍵
    ctx.fillStyle = '#f4efe0'
    ctx.fillRect(48, 214, w - 96, 60)
    ctx.fillStyle = '#8a6a48'
    for (let i = 0; i < 4; i++) ctx.fillRect(56, 222 + i * 13, w - 112, 2)
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#e9c46a' : '#f4efe0'
      ctx.fillRect(40 + i * 22, 290, 16, 22)
    }
    // 喇叭網
    ctx.fillStyle = '#3a2418'
    ctx.fillRect(48, 326, w - 96, 44)
    ctx.strokeStyle = '#c8a070'
    ctx.lineWidth = 2
    for (let x = 52; x < w - 50; x += 8) {
      ctx.beginPath()
      ctx.moveTo(x, 330)
      ctx.lineTo(x, 366)
      ctx.stroke()
    }
  })
}

/** 冰箱上面的招牌、店面牆墩上的小牌子 */
function smallSign(text: string, bg: string, fg: string, w = 256, h = 96) {
  return canvasTexture(
    w,
    h,
    (ctx) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = fg
      ctx.lineWidth = 6
      ctx.strokeRect(6, 6, w - 12, h - 12)
      ctx.fillStyle = fg
      ctx.font = `800 ${Math.round(h * 0.52)}px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, w / 2, h / 2 + 3)
    },
    [{ spec: `800 ${Math.round(h * 0.52)}px ${BRUSH_FONT}`, text }],
  )
}

// ---------------------------------------------------------------------------
// 外殼（走進店裡、或在隔壁店裡擋到鏡頭時淡出）：店面的牆墩、門楣、東邊的隔間牆、冰旗、「冷氣開放」
// ---------------------------------------------------------------------------

export function ShellIce() {
  const mats = useMats()
  const pink = usePlaster(PINK)
  const photoSide = usePlaster('#cfd8dc')
  const mint = useFloorMat('tile', MINT)
  const cool = useMemo(() => smallSign('冷氣開放', '#1d4f8a', '#f4f1ea', 256, 80), [])
  const flag = useMemo(
    () =>
      canvasTexture(
        128,
        176,
        (ctx, w, h) => {
          ctx.fillStyle = '#f7f4ec'
          ctx.fillRect(0, 0, w, h)
          ctx.strokeStyle = '#2e6fb5'
          ctx.lineWidth = 4
          for (let i = 0; i < 3; i++) {
            ctx.beginPath()
            for (let x = 0; x <= w; x += 4) ctx.lineTo(x, h - 30 - i * 10 + Math.sin(x * 0.15 + i) * 4)
            ctx.stroke()
          }
          ctx.fillStyle = '#d8262a'
          ctx.font = `900 96px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('冰', w / 2, 70)
        },
        [{ spec: `900 96px ${BRUSH_FONT}`, text: '冰' }],
      ),
    [],
  )
  const H = A.ceilY - FLOOR
  const z = A.frontZ - 0.12
  return (
    <group>
      {/* 店面兩側的牆墩（中間整片打開）＋門楣 */}
      {ICE_IN.pillars.map((p) => (
        <mesh key={p.x0} geometry={boxGeo(p.x1 - p.x0, H, 0.26, TILE.plaster)} material={pink} position={[(p.x0 + p.x1) / 2, FLOOR + H / 2, z]} castShadow />
      ))}
      <mesh geometry={boxGeo(LOT.x1 - LOT.x0 - 1.0, 0.42, 0.26, TILE.plaster)} material={pink} position={[(LOT.x0 + LOT.x1) / 2, A.ceilY - 0.21, z]} />
      <mesh position={[LOT.x0 + 0.25, 2.05, A.frontZ + 0.02]}>
        <planeGeometry args={[0.46, 0.15]} />
        <meshStandardMaterial map={cool} roughness={0.6} />
      </mesh>
      {/* 東邊的隔間牆（冰果室這面粉紅、照相館那面灰藍）：在店裡時淡掉，才看得到裡面 */}
      <mesh geometry={boxGeo(0.1, A.ceilY, A.frontZ - BACK, TILE.plaster)} material={pink} position={[LOT.x1 - 0.05 - 0.05, A.ceilY / 2, (A.frontZ + BACK) / 2]} receiveShadow />
      <mesh geometry={boxGeo(0.1, A.ceilY, A.frontZ - BACK, TILE.plaster)} material={photoSide} position={[LOT.x1 + 0.05, A.ceilY / 2, (A.frontZ + BACK) / 2]} receiveShadow />
      <mesh geometry={boxGeo(0.03, 1.1, A.frontZ - BACK - 0.3, TILE.tile)} material={mint} position={[LOT.x1 - 0.115, FLOOR + 0.55, (A.frontZ + BACK) / 2 - 0.1]} />
      {/* 冰旗（掛在亭仔腳的樑下） */}
      <group position={[LOT.x1 - 0.75, A.ceilY - 0.45, A.colZ - 0.35]}>
        <mesh material={mats.black} position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.2, 4]} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.45, 0.62]} />
          <meshStandardMaterial map={flag} roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

/** 冰果室門口的霓虹招牌（直立、從立面伸出來，晚上亮粉紅色） */
export function IceNeon() {
  const tex = useMemo(
    () =>
      canvasTexture(
        96,
        300,
        (ctx, w, h) => {
          ctx.fillStyle = '#1a0e14'
          ctx.fillRect(0, 0, w, h)
          ctx.strokeStyle = '#ff7ab8'
          ctx.lineWidth = 4
          ctx.strokeRect(8, 8, w - 16, h - 16)
          ctx.fillStyle = '#ffd0e8'
          ctx.shadowColor = '#ff4fa0'
          ctx.shadowBlur = 12
          ctx.font = `900 64px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ;['冰', '果', '室'].forEach((ch, i) => ctx.fillText(ch, w / 2, 58 + i * 92))
        },
        [{ spec: `900 64px ${BRUSH_FONT}`, text: '冰果室' }],
      ),
    [],
  )
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: '#555555' }), [tex])
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const t = clock.elapsedTime
    // 老霓虹管：偶爾閃爍
    const f = Math.sin(t * 1.7) > 0.96 && Math.sin(t * 41) > 0 ? 0.35 : 1
    const k = (0.35 + 1.1 * l) * f
    mat.color.setRGB(k, k, k)
  })
  return (
    <group position={[LOT.x1 - 0.55, 5.0, FZ + 0.45]} userData={{ noMerge: true }}>
      <mesh geometry={boxGeo(0.05, 0.05, 0.6, 1)} position={[0, 1.0, -0.2]}>
        <meshStandardMaterial color="#5b5f66" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh geometry={boxGeo(0.08, 1.9, 0.62, 1)}>
        <meshStandardMaterial color="#1a1418" roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat} position={[s * 0.045, 0, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <planeGeometry args={[0.58, 1.82]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 店裡（一直看得到；外殼淡出後就露出來）
// ---------------------------------------------------------------------------

/** 不會動的東西（包在 MergeStatic 裡） */
export function IceInterior() {
  const mats = useMats()
  const pink = usePlaster(PINK)
  const floor = useFloorMat('tile', '#f1e6e2')
  const mint = useFloorMat('tile', MINT)
  const menu = useMemo(menuTexture, [])
  const cal = useMemo(calendarTexture, [])
  const tube = useNightGlow('#f4fbff', 0.7, 0.6)
  const cx = (LOT.x0 + LOT.x1) / 2
  const x0 = LOT.x0 + 0.2
  const x1 = LOT.x1 - 0.1
  const depth = A.frontZ - BACK
  return (
    <group>
      {/* 地磚、後牆、牆裙 */}
      <mesh geometry={boxGeo(x1 - x0, 0.02, depth, TILE.tile)} material={floor} position={[(x0 + x1) / 2, FLOOR, (A.frontZ + BACK) / 2]} receiveShadow />
      <Wall x0={LOT.x0} x1={LOT.x1} z0={BACK - 0.2} z1={BACK} mat={pink} />
      {/* 西牆跟戲院大廳只隔一面：阿嬤在大廳裡時一起淡掉 */}
      <Fader id="os_lobby_side">
        <Wall x0={LOT.x0} x1={LOT.x0 + 0.2} z0={BACK} z1={A.frontZ - 0.24} mat={pink} />
        <mesh geometry={boxGeo(0.03, 1.1, A.frontZ - BACK - 0.3, TILE.tile)} material={mint} position={[LOT.x0 + 0.215, FLOOR + 0.55, (A.frontZ + BACK) / 2 - 0.1]} />
      </Fader>
      <mesh geometry={boxGeo(x1 - x0, 1.1, 0.03, TILE.tile)} material={mint} position={[(x0 + x1) / 2, FLOOR + 0.55, BACK + 0.02]} />
      {/* 天花板的日光燈兩支 */}
      {[-6.4, -8.6].map((z) => (
        <group key={z} position={[cx, A.ceilY - 0.1, z]}>
          <Box s={[1.5, 0.05, 0.12]} p={[0, 0.03, 0]} m={flat('#e8e4dc', 0.6)} cast={false} />
          <mesh material={tube} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.028, 0.028, 1.4, 8]} />
          </mesh>
        </group>
      ))}
      {/* 後牆：價目表、月曆、時鐘 */}
      <group position={[3.4, 0, BACK + 0.04]}>
        <Box s={[1.36, 1.2, 0.04]} p={[0, 2.05, 0]} m={flat('#6a4a2a', 0.7)} cast={false} />
        <mesh position={[0, 2.05, 0.025]}>
          <planeGeometry args={[1.28, 1.12]} />
          <meshStandardMaterial map={menu} roughness={0.7} />
        </mesh>
      </group>
      <mesh position={[0.9, 1.95, BACK + 0.03]}>
        <planeGeometry args={[0.42, 0.63]} />
        <meshStandardMaterial map={cal} roughness={0.8} />
      </mesh>
      <group position={[1.9, 2.55, BACK + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh material={flat('#6a4a2a', 0.6)}>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 20]} />
        </mesh>
        <mesh material={flat('#f4f1ea', 0.5)} position={[0, 0.032, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.01, 20]} />
        </mesh>
      </group>
      <FrontCounter />
      <PrepCounter />
      <Fridge />
      {/* 店裡三張、亭仔腳兩張大理石小圓桌 */}
      {ICE_IN.tables.map((t, i) => (
        <Table key={i} x={t.x} z={t.z} bowls={i === 2 ? 0 : 1} />
      ))}
      {ICE_IN.arcadeTables.map((x) => (
        <Table key={x} x={x} z={I.tableZ} bowls={1} />
      ))}
      {/* 西北角：一疊紅色塑膠椅、掃把 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={flat('#d8342b', 0.5)} position={[-0.3, FLOOR + 0.42 + i * 0.05, BACK + 0.35]} castShadow>
          <cylinderGeometry args={[0.16, 0.13, 0.05, 14]} />
        </mesh>
      ))}
      <mesh material={mats.wood} position={[1.55, FLOOR + 0.62, BACK + 0.15]} rotation={[0.12, 0, 0.05]}>
        <cylinderGeometry args={[0.018, 0.018, 1.2, 6]} />
      </mesh>
    </group>
  )
}

/** 店面的櫃台：木頭底座、玻璃櫃（配料罐）、剉冰機 */
function FrontCounter() {
  const toppings = ['#6a1f1a', '#f0a030', '#1c1a1a', '#e8e2d0', '#c88ad0', '#f4d04a']
  return (
    <group position={[I.counterX, FLOOR, I.counterZ + 0.12]}>
      <WBox mat="darkWood" size={[I.counterW, 0.5, 0.5]} position={[0, 0.25, 0]} />
      <mesh material={glassMat} position={[0, 0.7, 0]}>
        <boxGeometry args={[I.counterW - 0.06, 0.4, 0.46]} />
      </mesh>
      <WBox mat="wood" size={[I.counterW + 0.08, 0.05, 0.56]} position={[0, 0.93, 0]} />
      {toppings.map((c, i) => (
        <group key={i} position={[0.05 + i * 0.22, 0.95, 0.05]}>
          <mesh position={[0, 0.07, 0]} material={flat(c, 0.5)}>
            <cylinderGeometry args={[0.07, 0.07, 0.12, 12]} />
          </mesh>
          <mesh material={glassMat} position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.18, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 阿桃後面的工作檯：玻璃水果櫃（西瓜、木瓜、鳳梨、香蕉、芒果）、果汁機、一疊碗 */
function PrepCounter() {
  const P = ICE_IN.prep
  const fruits: { c: string; p: [number, number, number]; s: [number, number, number]; k: 'ball' | 'wedge' | 'bar' }[] = [
    { c: '#e8423a', p: [-0.8, 0, 0], s: [0.13, 0.13, 0.13], k: 'wedge' },
    { c: '#e8423a', p: [-0.6, 0, 0.04], s: [0.13, 0.13, 0.13], k: 'wedge' },
    { c: '#f08a30', p: [-0.3, 0, 0], s: [0.1, 0.07, 0.07], k: 'ball' },
    { c: '#f08a30', p: [-0.15, 0, 0.05], s: [0.1, 0.07, 0.07], k: 'ball' },
    { c: '#e8b830', p: [0.1, 0, 0], s: [0.07, 0.12, 0.07], k: 'bar' },
    { c: '#f4d24a', p: [0.35, 0, 0.02], s: [0.15, 0.03, 0.03], k: 'ball' },
    { c: '#f4d24a', p: [0.38, 0.03, 0.05], s: [0.15, 0.03, 0.03], k: 'ball' },
    { c: '#f4b030', p: [0.6, 0, 0], s: [0.08, 0.06, 0.06], k: 'ball' },
    { c: '#f4b030', p: [0.72, 0, 0.06], s: [0.08, 0.06, 0.06], k: 'ball' },
  ]
  return (
    <group position={[P.x, FLOOR, P.z]}>
      <WBox mat="darkWood" size={[P.w, 0.86, P.d]} position={[0, 0.43, 0]} />
      <WBox mat="wood" size={[P.w + 0.06, 0.05, P.d + 0.06]} position={[0, 0.88, 0]} />
      {/* 玻璃水果櫃（在工作檯西半邊） */}
      <group position={[-0.35, 0.9, 0]}>
        <Box s={[1.6, 0.03, 0.42]} p={[0, 0.015, 0]} m={flat('#e8e8e2', 0.4)} cast={false} />
        {fruits.map((f, i) =>
          f.k === 'wedge' ? (
            <mesh key={i} material={flat(f.c, 0.6)} position={[f.p[0], 0.1 + f.p[1], f.p[2]]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[f.s[0], f.s[0], 0.06, 10, 1, false, 0, Math.PI]} />
            </mesh>
          ) : f.k === 'bar' ? (
            <group key={i} position={[f.p[0], 0.1, f.p[2]]}>
              <mesh material={flat(f.c, 0.8)}>
                <cylinderGeometry args={[0.065, 0.07, 0.17, 10]} />
              </mesh>
              <mesh material={flat('#3e7a3a', 0.8)} position={[0, 0.13, 0]}>
                <coneGeometry args={[0.06, 0.12, 6]} />
              </mesh>
            </group>
          ) : (
            <mesh key={i} material={flat(f.c, 0.6)} position={[f.p[0], 0.08 + f.p[1], f.p[2]]} scale={f.s}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
          ),
        )}
        <mesh material={glassMat} position={[0, 0.2, 0]}>
          <boxGeometry args={[1.6, 0.38, 0.42]} />
        </mesh>
      </group>
      {/* 果汁機：底座、玻璃杯（裡面是木瓜牛奶） */}
      <group position={[0.75, 0.9, 0]}>
        <Box s={[0.18, 0.14, 0.18]} p={[0, 0.07, 0]} m={flat('#e8e2d0', 0.4)} />
        <mesh material={flat('#f4b06a', 0.5)} position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.18, 12]} />
        </mesh>
        <mesh material={glassMat} position={[0, 0.27, 0]}>
          <cylinderGeometry args={[0.085, 0.07, 0.26, 12]} />
        </mesh>
        <Box s={[0.1, 0.03, 0.1]} p={[0, 0.41, 0]} m={flat('#3a3a40', 0.5)} />
      </group>
      {/* 一疊碗 */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={flat('#f4f1ea', 0.35)} position={[1.02, 0.94 + i * 0.035, 0.05]}>
          <cylinderGeometry args={[0.09, 0.06, 0.04, 12]} />
        </mesh>
      ))}
    </group>
  )
}

/** 西牆的玻璃冰箱（紅白色、上面「汽水」的招牌，一格一格的彈珠汽水） */
function Fridge() {
  const F = ICE_IN.fridge
  const sign = useMemo(() => smallSign('彈珠汽水', '#c62828', '#fff6e2'), [])
  const light = useNightGlow('#e8fbff', 0.4, 0.55)
  const H = 1.75
  const face = F.x + F.w / 2
  return (
    <group>
      <RoundedBox args={[F.w, H, F.d]} radius={0.05} smoothness={2} position={[F.x, FLOOR + H / 2, F.z]} castShadow receiveShadow>
        <meshStandardMaterial color="#e8e6e0" roughness={0.35} />
      </RoundedBox>
      <Box s={[0.02, 0.25, F.d - 0.08]} p={[face + 0.005, FLOOR + H - 0.2, F.z]} m={flat('#c62828', 0.5)} cast={false} />
      <mesh position={[face + 0.02, FLOOR + H - 0.2, F.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[F.d - 0.12, 0.22]} />
        <meshStandardMaterial map={sign} roughness={0.6} />
      </mesh>
      {/* 裡面的燈（晚上亮）、三層瓶子 */}
      <mesh material={light} position={[face - 0.03, FLOOR + 0.85, F.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[F.d - 0.16, 1.2]} />
      </mesh>
      {[0.4, 0.8, 1.2].map((y) =>
        [-0.28, -0.14, 0, 0.14, 0.28].map((dz, j) => (
          <group key={`${y}${j}`} position={[face - 0.12, FLOOR + y, F.z + dz]}>
            <mesh material={flat(j % 2 ? '#7ac0a8' : '#9ad8e8', 0.15)}>
              <cylinderGeometry args={[0.04, 0.045, 0.2, 8]} />
            </mesh>
            <mesh material={flat('#9ad8e8', 0.15)} position={[0, 0.13, 0]}>
              <cylinderGeometry args={[0.018, 0.035, 0.07, 8]} />
            </mesh>
          </group>
        )),
      )}
      <Box s={[0.02, 1.3, 0.04]} p={[face + 0.01, FLOOR + 0.85, F.z - F.d / 2 + 0.06]} m={flat('#b0b4b8', 0.3, 0.6)} cast={false} />
      <mesh material={glassMat} position={[face + 0.012, FLOOR + 0.85, F.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[F.d - 0.1, 1.3]} />
      </mesh>
    </group>
  )
}

/** 大理石面的小圓桌＋三張紅色圓凳；bowls：桌上幾碗吃到一半的冰 */
function Table({ x, z, bowls }: { x: number; z: number; bowls: number }) {
  const mats = useMats()
  return (
    <group position={[x, FLOOR, z]}>
      <mesh material={flat('#efece4', 0.3)} position={[0, 0.72, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.04, 20]} />
      </mesh>
      <mesh material={mats.metal} position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.04, 0.12, 0.72, 10]} />
      </mesh>
      {[0, 2.1, 4.2].map((a) => (
        <group key={a} position={[Math.sin(a) * 0.62, 0, Math.cos(a) * 0.5]}>
          <mesh material={flat('#d8342b', 0.5)} position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.13, 0.05, 14]} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.12, 0.15, 0.38, 10, 1, true]} />
            <meshStandardMaterial color="#c42a22" roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {bowls > 0 && (
        <group position={[0.1, 0, 0.05]}>
          <mesh material={flat('#f4f1ea', 0.4)} position={[0, 0.78, 0]}>
            <cylinderGeometry args={[0.09, 0.06, 0.07, 12]} />
          </mesh>
          <mesh material={flat('#f4ecf4', 0.6)} position={[0, 0.84, 0]}>
            <sphereGeometry args={[0.07, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh material={flat('#7a2a22', 0.6)} position={[0.02, 0.9, 0.01]}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
        </group>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 會動的：剉冰機的轉輪、吊扇、點唱機的燈管、人
// ---------------------------------------------------------------------------

export function IceLive({ outline }: { outline: boolean }) {
  const isNight = useStore((s) => s.isNight)
  const S = ICE_IN.student
  const L = ICE_IN.lady
  const t1 = ICE_IN.tables[0]
  const t2 = ICE_IN.tables[1]
  return (
    <group>
      <IceMachine position={[I.counterX - 0.85, FLOOR + 0.95, I.counterZ + 0.1]} />
      <CeilingFan />
      <Jukebox />
      <ChibiNpc id="bingmom" pose="shopkeeper" position={[I.bingmom.x, FLOOR, I.bingmom.z]} heading={0} seesGhosts outline={outline} />
      {/* 晚上來吃冰的好兄弟：學生坐一號桌、小姐坐二號桌 */}
      {isNight && (
        <>
          <ChibiNpc id="os_ghost_student" pose="eat" position={[S.x, FLOOR, S.z]} heading={Math.atan2(t1.x - S.x, t1.z - S.z)} seesGhosts outline={outline} />
          <ChibiNpc id="os_ghost_lady" pose="eat" position={[L.x, FLOOR, L.z]} heading={Math.atan2(t2.x - L.x, t2.z - L.z)} outline={outline} />
        </>
      )}
    </group>
  )
}

/** 手搖剉冰機：鑄鐵機身、上面的大轉輪、底下的碗 */
function IceMachine({ position }: { position: [number, number, number] }) {
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f5a8a', roughness: 0.45, metalness: 0.4 }), [])
  const wheel = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    // 晚上阿桃在做冰：轉輪慢慢轉
    if (wheel.current && useStore.getState().isNight) wheel.current.rotation.z += Math.min(dt, 0.1) * 1.4
  })
  return (
    <group position={position} userData={{ noMerge: true }}>
      <mesh material={iron} position={[0, 0.04, 0]}>
        <boxGeometry args={[0.36, 0.08, 0.3]} />
      </mesh>
      <mesh material={iron} position={[-0.12, 0.3, 0]}>
        <boxGeometry args={[0.08, 0.5, 0.12]} />
      </mesh>
      <mesh material={iron} position={[0.02, 0.5, 0]}>
        <boxGeometry args={[0.34, 0.1, 0.16]} />
      </mesh>
      <mesh position={[0.06, 0.4, 0]}>
        <boxGeometry args={[0.16, 0.14, 0.14]} />
        <meshStandardMaterial color="#dff4ff" roughness={0.1} transparent opacity={0.7} />
      </mesh>
      <mesh material={flat('#f4f1ea', 0.4)} position={[0.06, 0.12, 0]}>
        <cylinderGeometry args={[0.09, 0.06, 0.06, 12]} />
      </mesh>
      <group ref={wheel} position={[0.02, 0.72, 0]}>
        <mesh material={iron}>
          <torusGeometry args={[0.16, 0.018, 6, 20]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={iron} rotation={[0, 0, (i * Math.PI) / 3]}>
            <boxGeometry args={[0.3, 0.02, 0.02]} />
          </mesh>
        ))}
        <mesh material={flat('#8a5a2a', 0.6)} position={[0.16, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.12, 6]} />
        </mesh>
      </group>
    </group>
  )
}

/** 吊扇：三片木頭扇葉，慢慢轉 */
function CeilingFan() {
  const blades = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.y += Math.min(dt, 0.1) * 2.6
  })
  const F = ICE_IN.fan
  return (
    <group position={[F.x, A.ceilY, F.z]} userData={{ noMerge: true }}>
      <mesh material={flat('#d8d4cc', 0.4, 0.3)} position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.4, 6]} />
      </mesh>
      <mesh material={flat('#e8e4dc', 0.35, 0.3)} position={[0, -0.44, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.12, 14]} />
      </mesh>
      <group ref={blades} position={[0, -0.46, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={flat('#8a5a32', 0.6)} rotation={[0, (i * Math.PI * 2) / 3, 0]} position={[Math.sin((i * Math.PI * 2) / 3) * 0.38, 0, Math.cos((i * Math.PI * 2) / 3) * 0.38]}>
            <boxGeometry args={[0.13, 0.012, 0.62]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** 點唱機：弧形頂、正面的唱片窗，兩側的燈管顏色慢慢變 */
function Jukebox() {
  const J = ICE_IN.jukebox
  const face = useMemo(jukeboxTexture, [])
  const tubes = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff6aa0', toneMapped: false }), [])
  const col = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    col.setHSL((clock.elapsedTime * 0.06) % 1, 0.8, 0.5)
    tubes.color.copy(col).multiplyScalar(0.6 + l * 0.8)
  })
  const H = 1.25
  const fx = J.x - J.w / 2
  return (
    <group userData={{ noMerge: true }}>
      <Box s={[J.w, H, J.d]} p={[J.x, FLOOR + H / 2, J.z]} m={flat('#6a3418', 0.5)} />
      <mesh material={flat('#6a3418', 0.5)} position={[J.x, FLOOR + H, J.z]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[J.d / 2, J.d / 2, J.w, 16, 1, false, 0, Math.PI]} />
      </mesh>
      <mesh position={[fx - 0.005, FLOOR + 0.78, J.z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[J.d - 0.12, 1.2]} />
        <meshStandardMaterial map={face} roughness={0.5} />
      </mesh>
      {/* 兩側的彩色燈管 */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={tubes} position={[fx - 0.02, FLOOR + 0.8, J.z + s * (J.d / 2 - 0.04)]}>
          <cylinderGeometry args={[0.025, 0.025, 1.1, 8]} />
        </mesh>
      ))}
      <mesh material={tubes} position={[fx - 0.02, FLOOR + H + 0.02, J.z]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[J.d / 2 - 0.04, 0.022, 6, 16, Math.PI]} />
      </mesh>
    </group>
  )
}
