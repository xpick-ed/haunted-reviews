import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { PHOTO_IN } from '../world/osEast'
import { BRUSH_FONT, TILE, WBox, boxGeo, canvasTexture, useMats } from './kit'
import { StoreWall } from './OldStreetShops'
import { ChibiNpc } from '../chars/Chibi'
import { A, BACK, Box, FLOOR, O, Wall, flat, glassMat, useFloorMat, useNightGlow, usePlaster } from './OldStreetEastKit'
import { lanternAt } from './daylight'

// 光明照相館（DESIGN §30）：櫥窗、玻璃門；走進去是攝影棚——後牆一幅手繪的日月潭布景、雕花椅、
// 木頭大相機（黑布罩）、兩盞攝影燈、東北角的暗房（紅燈、藥水盆、曬著的相片），西牆一整面老照片
// （阿春和阿公一九五八年的結婚照也在上面；陰陽眼開著，有幾張照片裡多了人）。

const LOT = O.lots.find((l) => l.id === 'photo')!
const P = PHOTO_IN
const WALL = '#cfd8dc'
const CLOTH_SIDE = '#efe4cc'

// ---------------------------------------------------------------------------
// 貼圖
// ---------------------------------------------------------------------------

/** 一個穿舊衣服的人（頭＋肩膀），用在老照片上 */
function person(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#3a2618') {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x, y + r * 2.4, r * 1.6, r * 1.3, 0, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(x - r * 1.6, y + r * 2.4, r * 3.2, r * 1.6)
}

type PortraitKind = 'couple' | 'baby' | 'man' | 'family' | 'lady' | 'grad' | 'soldier' | 'kids'

/** 一張褐色的老照片（白邊） */
function portraitTexture(kind: PortraitKind, seed: number) {
  return canvasTexture(128, 160, (ctx, w, h) => {
    ctx.fillStyle = '#f4ecd8'
    ctx.fillRect(0, 0, w, h)
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, seed % 2 ? '#c9ae86' : '#bfa27a')
    g.addColorStop(1, '#7a5a3a')
    ctx.fillStyle = g
    ctx.fillRect(8, 8, w - 16, h - 16)
    const cx = w / 2
    const by = h * 0.36
    switch (kind) {
      case 'couple':
        person(ctx, cx - 20, by, 12)
        person(ctx, cx + 20, by + 3, 11)
        break
      case 'family':
        for (let i = 0; i < 4; i++) person(ctx, 26 + i * 26, 56 + (i % 2) * 8, 9)
        person(ctx, cx, 96, 7)
        break
      case 'kids':
        for (let i = 0; i < 3; i++) person(ctx, 34 + i * 30, 70, 10)
        break
      case 'baby':
        person(ctx, cx, by + 10, 16, '#4a3020')
        break
      case 'grad':
        person(ctx, cx, by, 14)
        ctx.fillStyle = '#1c1210'
        ctx.fillRect(cx - 18, by - 16, 36, 6)
        break
      case 'soldier':
        person(ctx, cx, by, 14, '#3a3420')
        ctx.fillStyle = '#2a2818'
        ctx.beginPath()
        ctx.ellipse(cx, by - 10, 17, 7, 0, Math.PI, Math.PI * 2)
        ctx.fill()
        break
      default:
        person(ctx, cx, by, 14)
    }
    // 舊照片的斑點
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(255,245,220,${0.04 + ((i * seed) % 7) / 100})`
      ctx.fillRect((i * 37 * seed) % w, (i * 53 + seed * 11) % h, 3, 3)
    }
  })
}

/** 一九五八年的結婚照：新娘頭紗、新郎西裝的袖子太長 */
function weddingTexture() {
  return canvasTexture(
    192,
    240,
    (ctx, w, h) => {
      ctx.fillStyle = '#efe4c8'
      ctx.fillRect(0, 0, w, h)
      const g = ctx.createRadialGradient(w / 2, h * 0.4, 20, w / 2, h / 2, w * 0.7)
      g.addColorStop(0, '#d6bb90')
      g.addColorStop(1, '#6a4a2e')
      ctx.fillStyle = g
      ctx.fillRect(12, 12, w - 24, h - 42)
      // 新郎（左）：西裝、袖子蓋到手
      person(ctx, 70, 78, 17, '#2a1c14')
      ctx.fillStyle = '#2a1c14'
      ctx.fillRect(36, 140, 16, 46)
      ctx.fillStyle = '#f4ecd8'
      ctx.fillRect(64, 112, 12, 26)
      // 新娘（右）：頭紗、捧花
      ctx.fillStyle = 'rgba(250,246,236,0.85)'
      ctx.beginPath()
      ctx.ellipse(124, 84, 34, 44, 0, 0, Math.PI * 2)
      ctx.fill()
      person(ctx, 124, 84, 15, '#3a2618')
      ctx.fillStyle = '#f4ecd8'
      ctx.beginPath()
      ctx.ellipse(124, 150, 26, 30, 0, Math.PI, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#a8584a'
      ctx.beginPath()
      ctx.arc(116, 150, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#5a3a24'
      ctx.font = `500 16px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('民國四十七年　結婚紀念', w / 2, h - 12)
    },
    [{ spec: `500 16px ${BRUSH_FONT}`, text: '民國四十七年結婚紀念' }],
  )
}

/** 陰陽眼才看得到：照片裡多出來的一個淡淡的人 */
function ghostOverlay(seed: number) {
  const t = canvasTexture(128, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const x = 30 + ((seed * 23) % 70)
    const g = ctx.createRadialGradient(x, 60, 4, x, 70, 44)
    g.addColorStop(0, 'rgba(210,245,255,0.95)')
    g.addColorStop(1, 'rgba(160,220,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(235,252,255,0.9)'
    ctx.beginPath()
    ctx.arc(x, 56, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(x, 88, 17, 20, 0, Math.PI, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(x - 17, 88, 34, 30)
    // 在揮手
    ctx.fillRect(x + 14, 60, 5, 26)
  })
  return t
}

/** 手繪的日月潭布景（照相館最常見的那一種） */
function backdropTexture() {
  return canvasTexture(640, 480, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5)
    sky.addColorStop(0, '#9cc8e0')
    sky.addColorStop(1, '#e8eef0')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    // 雲
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    for (const [x, y, r] of [
      [120, 70, 30],
      [160, 60, 38],
      [200, 74, 28],
      [470, 50, 26],
      [505, 44, 32],
    ]) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // 三層山
    const hill = (col: string, base: number, amp: number, k: number) => {
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base - Math.sin(x * k) * amp - Math.sin(x * k * 2.3 + 1) * amp * 0.4)
      ctx.lineTo(w, h)
      ctx.fill()
    }
    hill('#8fb0bc', h * 0.42, 40, 0.012)
    hill('#5f8a78', h * 0.5, 32, 0.017)
    // 塔
    ctx.fillStyle = '#e8dcc0'
    for (let i = 0; i < 6; i++) ctx.fillRect(492 - i * 1.5, 150 + i * 18, 18 + i * 3, 14)
    ctx.fillStyle = '#7a4a2a'
    for (let i = 0; i < 6; i++) ctx.fillRect(486 - i * 1.5, 148 + i * 18, 30 + i * 3, 4)
    hill('#3e6a52', h * 0.6, 22, 0.022)
    // 湖
    const lake = ctx.createLinearGradient(0, h * 0.6, 0, h * 0.85)
    lake.addColorStop(0, '#6aa0b8')
    lake.addColorStop(1, '#3e7090')
    ctx.fillStyle = lake
    ctx.fillRect(0, h * 0.64, w, h * 0.22)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 2
    for (let i = 0; i < 16; i++) {
      ctx.beginPath()
      const y = h * 0.67 + (i % 5) * 16
      ctx.moveTo(40 + i * 37, y)
      ctx.lineTo(70 + i * 37, y)
      ctx.stroke()
    }
    // 小船
    ctx.fillStyle = '#5a3a24'
    ctx.beginPath()
    ctx.moveTo(250, 360)
    ctx.lineTo(310, 360)
    ctx.lineTo(300, 372)
    ctx.lineTo(260, 372)
    ctx.fill()
    // 前面畫的欄杆
    ctx.fillStyle = '#e8e0d0'
    ctx.fillRect(0, h * 0.86, w, 16)
    for (let x = 12; x < w; x += 34) ctx.fillRect(x, h * 0.86, 12, h * 0.14)
    ctx.fillStyle = '#c8bca8'
    ctx.fillRect(0, h * 0.86 + 16, w, 4)
  })
}

function windowTexture() {
  return canvasTexture(512, 360, (ctx, w, h) => {
    ctx.fillStyle = '#3a2a1e'
    ctx.fillRect(0, 0, w, h)
    const frames = [
      [20, 20, 140, 150, 'couple'],
      [180, 20, 150, 190, 'wedding'],
      [350, 20, 140, 150, 'baby'],
      [20, 190, 140, 150, 'man'],
      [180, 225, 150, 115, 'family'],
      [350, 190, 140, 150, 'lady'],
    ] as const
    for (const [x, y, fw, fh, k] of frames) {
      ctx.fillStyle = '#f4ecd8'
      ctx.fillRect(x, y, fw, fh)
      const g = ctx.createLinearGradient(x, y, x, y + fh)
      g.addColorStop(0, '#c9ae86')
      g.addColorStop(1, '#8a6a48')
      ctx.fillStyle = g
      ctx.fillRect(x + 8, y + 8, fw - 16, fh - 16)
      const cx = x + fw / 2
      const by = y + fh * 0.36
      if (k === 'couple' || k === 'wedding') {
        person(ctx, cx - fw * 0.16, by, fw * 0.1)
        person(ctx, cx + fw * 0.16, by + 4, fw * 0.1)
        if (k === 'wedding') {
          ctx.fillStyle = 'rgba(250,245,235,0.8)'
          ctx.beginPath()
          ctx.ellipse(cx + fw * 0.16, by - 6, fw * 0.14, fw * 0.08, 0, Math.PI, Math.PI * 2)
          ctx.fill()
        }
      } else if (k === 'family') {
        for (let i = 0; i < 4; i++) person(ctx, x + 30 + i * 30, y + 45 + (i % 2) * 6, 11)
      } else person(ctx, cx, by, fw * (k === 'baby' ? 0.14 : 0.12))
    }
  })
}

// ---------------------------------------------------------------------------
// 外殼（走進店裡、或在隔壁擋到鏡頭時淡出）：店面的牆（櫥窗、玻璃門）、東邊的隔間牆
// ---------------------------------------------------------------------------

export function ShellPhoto() {
  const win = useMemo(windowTexture, [])
  const winMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: win, emissiveMap: win, emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.6 })
    m.userData.live = true
    return m
  }, [win])
  useFrame(() => {
    winMat.emissiveIntensity = 0.2 + 0.7 * lanternAt(useStore.getState().time)
  })
  const wall = usePlaster(WALL)
  const clothSide = usePlaster(CLOTH_SIDE)
  return (
    <group>
      <StoreWall
        x0={LOT.x0}
        x1={LOT.x1}
        color="#d5dde2"
        openings={[
          { c: P.window.c, w: P.window.w, y0: 0.6, y1: 2.5 },
          { c: P.door.c, w: P.door.w, y0: 0, y1: 2.35 },
        ]}
      />
      <mesh material={winMat} position={[P.window.c, FLOOR + 1.55, A.frontZ - 0.1]}>
        <planeGeometry args={[P.window.w, 1.9]} />
      </mesh>
      <mesh material={glassMat} position={[P.window.c, FLOOR + 1.55, A.frontZ + 0.02]}>
        <planeGeometry args={[P.window.w, 1.9]} />
      </mesh>
      {/* 門開著一半 */}
      <group position={[P.door.c + 0.55, FLOOR, A.frontZ - 0.1]} rotation={[0, -0.9, 0]}>
        <WBox mat="darkWood" size={[1.05, 2.3, 0.05]} position={[-0.53, 1.15, 0]} />
        <mesh material={glassMat} position={[-0.53, 1.45, 0.03]}>
          <planeGeometry args={[0.8, 1.3]} />
        </mesh>
      </group>
      {/* 東邊的隔間牆（照相館這面灰藍、布莊那面米色） */}
      <mesh geometry={boxGeo(0.1, A.ceilY, A.frontZ - BACK, TILE.plaster)} material={wall} position={[LOT.x1 - 0.05, A.ceilY / 2, (A.frontZ + BACK) / 2]} receiveShadow />
      <mesh geometry={boxGeo(0.1, A.ceilY, A.frontZ - BACK, TILE.plaster)} material={clothSide} position={[LOT.x1 + 0.05, A.ceilY / 2, (A.frontZ + BACK) / 2]} receiveShadow />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 西牆（跟冰果室共用那一面）上的老照片：放在冰果室外殼的 Fader 裡，跟牆一起淡出
// ---------------------------------------------------------------------------

const PORTRAITS: { kind: PortraitKind; z: number; y: number; w: number; h: number; ghost?: boolean }[] = [
  { kind: 'family', z: -9.1, y: 2.25, w: 0.46, h: 0.36, ghost: true },
  { kind: 'baby', z: -9.1, y: 1.6, w: 0.3, h: 0.38 },
  { kind: 'soldier', z: -8.5, y: 2.2, w: 0.3, h: 0.38, ghost: true },
  { kind: 'lady', z: -8.5, y: 1.55, w: 0.3, h: 0.38 },
  { kind: 'grad', z: -7.9, y: 1.95, w: 0.3, h: 0.38 },
  { kind: 'couple', z: -6.6, y: 2.2, w: 0.36, h: 0.44 },
  { kind: 'kids', z: -6.6, y: 1.5, w: 0.42, h: 0.34, ghost: true },
  { kind: 'man', z: -6.0, y: 1.95, w: 0.3, h: 0.38 },
  { kind: 'couple', z: -5.5, y: 2.25, w: 0.3, h: 0.38, ghost: true },
  { kind: 'lady', z: -5.5, y: 1.6, w: 0.3, h: 0.38 },
]

export function PhotoWall() {
  const texes = useMemo(() => PORTRAITS.map((p, i) => portraitTexture(p.kind, i + 3)), [])
  const ghosts = useMemo(() => PORTRAITS.map((p, i) => (p.ghost ? ghostOverlay(i + 5) : null)), [])
  const wedding = useMemo(weddingTexture, [])
  const frame = flat('#4a3020', 0.6)
  const gold = flat('#b89048', 0.4, 0.5)
  const vis = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = vis.current
    if (!g) return
    g.visible = useStore.getState().vision
    // 照片裡的人輕輕晃
    g.position.y = Math.sin(clock.elapsedTime * 1.3) * 0.004
  })
  const x = P.wall.x + 0.01
  return (
    <group>
      {PORTRAITS.map((p, i) => (
        <group key={i} position={[x, p.y, p.z]} rotation={[0, Math.PI / 2, 0]}>
          <mesh geometry={boxGeo(p.w + 0.06, p.h + 0.06, 0.03, 1)} material={frame} position={[0, 0, 0.015]} />
          <mesh position={[0, 0, 0.032]}>
            <planeGeometry args={[p.w, p.h]} />
            <meshStandardMaterial map={texes[i]} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* 阿春和阿公的結婚照（比較大、金框） */}
      <group position={[x, P.wedding.y, P.wedding.z]} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={boxGeo(0.54, 0.66, 0.04, 1)} material={gold} position={[0, 0, 0.02]} />
        <mesh position={[0, 0, 0.042]}>
          <planeGeometry args={[0.46, 0.58]} />
          <meshStandardMaterial map={wedding} roughness={0.75} />
        </mesh>
      </group>
      {/* 陰陽眼：照片裡多出來的人 */}
      <group ref={vis} visible={false}>
        {PORTRAITS.map((p, i) =>
          ghosts[i] ? (
            <mesh key={i} position={[x + 0.05, p.y, p.z]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[p.w, p.h]} />
              <meshBasicMaterial map={ghosts[i]!} transparent depthWrite={false} toneMapped={false} />
            </mesh>
          ) : null,
        )}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 店裡（一直看得到）
// ---------------------------------------------------------------------------

export function PhotoInterior() {
  const mats = useMats()
  const wall = usePlaster(WALL)
  const floor = useFloorMat('wood', '#9a7a58')
  const backdrop = useMemo(backdropTexture, [])
  const bulb = useNightGlow('#fff1d0', 0.6, 0.5)
  const x0 = LOT.x0 + 0.1
  const x1 = LOT.x1 - 0.1
  const B = P.backdrop
  return (
    <group>
      <mesh geometry={boxGeo(x1 - x0, 0.02, A.frontZ - BACK, TILE.wood)} material={floor} position={[(x0 + x1) / 2, FLOOR, (A.frontZ + BACK) / 2]} receiveShadow />
      <Wall x0={LOT.x0} x1={LOT.x1} z0={BACK - 0.2} z1={BACK} mat={wall} />
      <WBox mat="darkWood" size={[x1 - x0, 0.12, 0.03]} position={[(x0 + x1) / 2, FLOOR + 0.06, BACK + 0.02]} castShadow={false} />
      {/* 布景：上面的捲軸、手繪的日月潭、往前鋪到地上的紙 */}
      <mesh position={[(B.x0 + B.x1) / 2, FLOOR + 1.62, BACK + 0.06]}>
        <planeGeometry args={[B.x1 - B.x0, 2.4]} />
        <meshStandardMaterial map={backdrop} roughness={0.9} />
      </mesh>
      <mesh material={flat('#3a2a1e', 0.6)} position={[(B.x0 + B.x1) / 2, FLOOR + 2.88, BACK + 0.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, B.x1 - B.x0 + 0.2, 10]} />
      </mesh>
      <mesh material={flat('#d8d0c4', 0.95)} position={[(B.x0 + B.x1) / 2, FLOOR + 0.012, BACK + 0.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[B.x1 - B.x0, 1.3]} />
      </mesh>
      {/* 雕花椅（紅絨布坐墊）、小圓几上的花瓶 */}
      <group position={[P.chair.x, FLOOR, P.chair.z]}>
        {[
          [-0.26, -0.22],
          [0.26, -0.22],
          [-0.26, 0.22],
          [0.26, 0.22],
        ].map(([x, z], i) => (
          <WBox key={i} mat="darkWood" size={[0.06, 0.45, 0.06]} position={[x, 0.225, z]} />
        ))}
        <WBox mat="darkWood" size={[0.62, 0.08, 0.52]} position={[0, 0.47, 0]} />
        <Box s={[0.56, 0.06, 0.46]} p={[0, 0.54, 0.01]} m={flat('#8a1c1c', 0.9)} />
        <WBox mat="darkWood" size={[0.62, 0.62, 0.06]} position={[0, 0.82, -0.24]} />
        <mesh material={mats.darkWood} position={[0, 1.13, -0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.31, 0.31, 0.06, 16, 1, false, -Math.PI / 2, Math.PI]} />
        </mesh>
        {[-1, 1].map((s) => (
          <WBox key={s} mat="darkWood" size={[0.06, 0.06, 0.46]} position={[s * 0.3, 0.72, 0]} />
        ))}
      </group>
      <group position={[P.side.x, FLOOR, P.side.z]}>
        <mesh material={mats.darkWood} position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
        </mesh>
        <mesh material={mats.darkWood} position={[0, 0.31, 0]}>
          <cylinderGeometry args={[0.03, 0.08, 0.62, 8]} />
        </mesh>
        <mesh material={flat('#e8e8f0', 0.2)} position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.22, 10]} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} material={flat(['#e8423a', '#f4f1ea', '#f2c230', '#e46aa4', '#f4f1ea'][i], 0.7)} position={[Math.sin(i * 1.3) * 0.06, 0.92 + (i % 2) * 0.04, Math.cos(i * 1.3) * 0.06]}>
            <sphereGeometry args={[0.045, 8, 6]} />
          </mesh>
        ))}
      </group>
      <BigCamera />
      <StudioLamps />
      <Darkroom />
      {/* 櫃台：玻璃面、服務鈴、一本打開的相簿 */}
      <group position={[P.counter.x, FLOOR, P.counter.z]}>
        <WBox mat="darkWood" size={[P.counter.w, 0.9, P.counter.d]} position={[0, 0.45, 0]} />
        <WBox mat="wood" size={[P.counter.w + 0.06, 0.04, P.counter.d + 0.06]} position={[0, 0.92, 0]} />
        <mesh material={flat('#c8a040', 0.3, 0.7)} position={[-0.35, 0.97, 0.05]}>
          <sphereGeometry args={[0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <Box s={[0.36, 0.03, 0.26]} p={[0.2, 0.955, 0]} m={flat('#6a2a20', 0.7)} rot={[0, 0.2, 0]} />
        <Box s={[0.32, 0.01, 0.22]} p={[0.2, 0.975, 0]} m={flat('#f4ecd8', 0.8)} rot={[0, 0.2, 0]} cast={false} />
      </group>
      {/* 櫥窗後面的展示櫃：幾個立著的相框 */}
      <group position={[P.showcase.x, FLOOR, P.showcase.z]}>
        <WBox mat="darkWood" size={[P.showcase.w, 0.55, P.showcase.d]} position={[0, 0.275, 0]} />
        {[-0.7, -0.2, 0.35, 0.8].map((x, i) => (
          <Box key={x} s={[0.22, 0.28, 0.02]} p={[x, 0.7, 0.05]} m={flat(i % 2 ? '#b89048' : '#4a3020', 0.5)} rot={[-0.15, 0, 0]} />
        ))}
      </group>
      {/* 天花板吊一顆燈泡 */}
      <mesh material={bulb} position={[(x0 + x1) / 2, A.ceilY - 0.35, -6.2]}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
      <mesh material={mats.black} position={[(x0 + x1) / 2, A.ceilY - 0.15, -6.2]}>
        <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
      </mesh>
      {/* 門口展示的老相機（木頭機身、黑色皮腔、三腳架） */}
      <group position={[O.tripod.x, FLOOR, O.tripod.z]} rotation={[0, -0.5, 0]}>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} material={mats.wood} position={[Math.sin(a) * 0.18, 0.62, Math.cos(a) * 0.18]} rotation={[Math.cos(a) * 0.28, 0, -Math.sin(a) * 0.28]} castShadow>
            <cylinderGeometry args={[0.02, 0.025, 1.3, 6]} />
          </mesh>
        ))}
        <WBox mat="wood" size={[0.34, 0.3, 0.3]} position={[0, 1.36, -0.12]} />
        <mesh material={flat('#1c1c1e', 0.8)} position={[0, 1.36, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.15, 0.3, 4]} />
        </mesh>
        <mesh material={mats.metal} position={[0, 1.36, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 16]} />
        </mesh>
        <mesh material={mats.black} position={[0, 1.4, -0.34]}>
          <boxGeometry args={[0.4, 0.4, 0.14]} />
        </mesh>
      </group>
    </group>
  )
}

/** 木頭大相機：三腳架、木箱、黑色皮腔、黃銅鏡頭朝北（對著椅子），後面披著黑布 */
function BigCamera() {
  const mats = useMats()
  const C = P.camera
  const brass = flat('#c8a050', 0.3, 0.7)
  return (
    <group position={[C.x, FLOOR, C.z]}>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} material={mats.wood} position={[Math.sin(a) * 0.24, 0.66, Math.cos(a) * 0.24]} rotation={[Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]} castShadow>
          <cylinderGeometry args={[0.025, 0.03, 1.38, 6]} />
        </mesh>
      ))}
      <WBox mat="darkWood" size={[0.32, 0.06, 0.32]} position={[0, 1.34, 0]} />
      {/* 後面的木箱（對焦玻璃）＋黑布 */}
      <WBox mat="wood" size={[0.42, 0.42, 0.18]} position={[0, 1.6, 0.14]} />
      <mesh material={flat('#141416', 0.95)} position={[0, 1.62, 0.3]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.16]} />
      </mesh>
      <mesh material={flat('#141416', 0.95)} position={[0, 1.2, 0.36]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.46, 0.5, 0.03]} />
      </mesh>
      {/* 皮腔（前細後粗） */}
      <mesh material={flat('#1c1c1e', 0.8)} position={[0, 1.6, -0.12]} rotation={[-Math.PI / 2, Math.PI / 4, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.27, 0.36, 4]} />
      </mesh>
      <WBox mat="wood" size={[0.28, 0.28, 0.06]} position={[0, 1.6, -0.32]} />
      <mesh material={brass} position={[0, 1.6, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.16, 16]} />
      </mesh>
      <mesh material={flat('#20303a', 0.1, 0.3)} position={[0, 1.6, -0.505]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.01, 16]} />
      </mesh>
    </group>
  )
}

/** 兩盞攝影燈：一把反光傘、一盞鋁製的聚光燈（燈泡傍晚亮） */
function StudioLamps() {
  const mats = useMats()
  const glow = useNightGlow('#fff4dc', 0.3, 0.7)
  const [u, f] = P.lamps
  const aim = (l: { x: number; z: number }) => Math.atan2(P.chair.x - l.x, P.chair.z - l.z)
  return (
    <group>
      {[u, f].map((l, i) => (
        <group key={i} position={[l.x, FLOOR, l.z]}>
          {[0, 2.1, 4.2].map((a) => (
            <mesh key={a} material={mats.metal} position={[Math.sin(a) * 0.14, 0.12, Math.cos(a) * 0.14]} rotation={[Math.cos(a) * 0.8, 0, -Math.sin(a) * 0.8]}>
              <cylinderGeometry args={[0.012, 0.012, 0.34, 5]} />
            </mesh>
          ))}
          <mesh material={mats.metal} position={[0, 0.95, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 1.7, 6]} />
          </mesh>
        </group>
      ))}
      {/* 反光傘：開口朝著椅子 */}
      <group position={[u.x, FLOOR + 1.85, u.z]} rotation={[0, aim(u), 0]}>
        <mesh material={flat('#f4f1ea', 0.9)} position={[0, 0, -0.18]} rotation={[-Math.PI / 2 - 0.25, 0, 0]} castShadow>
          <coneGeometry args={[0.5, 0.3, 12, 1, true]} />
        </mesh>
        <mesh material={glow} position={[0, 0, 0.02]}>
          <sphereGeometry args={[0.06, 10, 8]} />
        </mesh>
      </group>
      {/* 聚光燈：鋁的燈罩 */}
      <group position={[f.x, FLOOR + 1.8, f.z]} rotation={[0, aim(f), 0]}>
        <mesh material={flat('#b8bcc0', 0.3, 0.8)} rotation={[Math.PI / 2 - 0.3, 0, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.08, 0.24, 14, 1, true]} />
        </mesh>
        <mesh material={glow} position={[0, 0.03, 0.08]}>
          <sphereGeometry args={[0.07, 10, 8]} />
        </mesh>
      </group>
    </group>
  )
}

/** 暗房：隔間牆、黑布簾（留一條縫透出紅光）、紅色安全燈、三個藥水盆、繩子上曬的相片 */
function Darkroom() {
  const D = P.darkroom
  const red = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff2a1a', toneMapped: false }), [])
  const wall = usePlaster('#3a3438')
  const H = 2.4
  const w = D.x1 - D.x0
  const d = D.z1 - D.z0
  return (
    <group>
      <mesh geometry={boxGeo(0.08, H, d, TILE.plaster)} material={wall} position={[D.x0 + 0.04, FLOOR + H / 2, (D.z0 + D.z1) / 2]} castShadow receiveShadow />
      {/* 黑布簾（一條一條的皺褶），西邊留一條縫 */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} material={flat('#141214', 0.95)} position={[D.x0 + 0.42 + i * 0.12, FLOOR + H / 2 + 0.05, D.z1 - 0.04 + Math.sin(i * 1.9) * 0.025]} castShadow>
          <boxGeometry args={[0.13, H - 0.1, 0.04]} />
        </mesh>
      ))}
      <mesh material={flat('#3a2a20', 0.7)} position={[(D.x0 + D.x1) / 2, FLOOR + H, D.z1 - 0.04]}>
        <boxGeometry args={[w, 0.06, 0.08]} />
      </mesh>
      {/* 裡面：紅燈、水槽上的三個盆子、曬相片的繩子 */}
      <mesh material={red} position={[(D.x0 + D.x1) / 2, FLOOR + 1.95, D.z0 + 0.06]}>
        <boxGeometry args={[0.18, 0.14, 0.06]} />
      </mesh>
      <WBox mat="darkWood" size={[w - 0.15, 0.08, 0.6]} position={[(D.x0 + D.x1) / 2 + 0.04, FLOOR + 0.85, D.z0 + 0.35]} />
      {[-0.35, 0, 0.35].map((dx, i) => (
        <group key={dx} position={[(D.x0 + D.x1) / 2 + dx, FLOOR + 0.9, D.z0 + 0.35]}>
          <Box s={[0.3, 0.05, 0.4]} p={[0, 0.025, 0]} m={flat('#e8e4dc', 0.3)} cast={false} />
          <Box s={[0.26, 0.01, 0.36]} p={[0, 0.045, 0]} m={flat(['#b8a060', '#a8b8a0', '#c8c0b0'][i], 0.1)} cast={false} />
        </group>
      ))}
      <mesh material={flat('#d8d0c0', 0.8)} position={[(D.x0 + D.x1) / 2, FLOOR + 2.05, D.z0 + 0.9]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.004, 0.004, w - 0.1, 4]} />
      </mesh>
      {[-0.4, -0.15, 0.1, 0.35].map((dx) => (
        <Box key={dx} s={[0.16, 0.2, 0.005]} p={[(D.x0 + D.x1) / 2 + dx, FLOOR + 1.93, D.z0 + 0.9]} m={flat('#f4ecd8', 0.8)} cast={false} />
      ))}
    </group>
  )
}

/** 會動的：傍晚老闆站在大相機旁邊 */
export function PhotoLive({ outline }: { outline: boolean }) {
  const phase = useStore((s) => s.phase)
  return phase === 'dusk' ? <ChibiNpc id="photographer" pose="idle" position={[P.photographer.x, FLOOR, P.photographer.z]} heading={0.35} outline={outline} /> : null
}
