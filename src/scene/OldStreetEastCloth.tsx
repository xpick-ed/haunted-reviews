import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { CLOTH_IN } from '../world/osEast'
import { player } from '../world/player'
import { BRUSH_FONT, TILE, WBox, boxGeo, canvasTexture, useMats } from './kit'
import { StoreWall } from './OldStreetShops'
import { shutterTexture } from './OldStreetFacades'
import { ChibiNpc, SEAT_Y } from '../chars/Chibi'
import { A, BACK, Box, FLOOR, O, Wall, flat, useFloorMat, useNightGlow, usePlaster } from './OldStreetEastKit'

// 錦繡布莊（DESIGN §30）：鐵捲門拉起來，裡面是一整排布架、剪裁檯（台尺、剪刀、粉土、紙型）、
// 東牆的腳踏裁縫車、穿著半件旗袍的衣架、西牆的立鏡。錦繡姨去年冬天走了，晚上還坐在裁縫車前面。

const LOT = O.lots.find((l) => l.id === 'cloth')!
const C = CLOTH_IN
const WALL = '#efe4cc'
const BOLTS = ['#c8342b', '#2e6fb5', '#f2c230', '#3e9a52', '#e46aa4', '#8a4fb5', '#f4efe2', '#e87a2a', '#1d3a6a', '#9a2a4a', '#6ab0a0', '#d8b890']

// ---------------------------------------------------------------------------
// 貼圖
// ---------------------------------------------------------------------------

/** 攤在剪裁檯上的花布 */
function floralTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2e4a7a'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 60; i++) {
      const x = (i * 47) % w
      const y = (i * 29 + (i % 3) * 13) % h
      ctx.fillStyle = ['#f4d0dc', '#f4efe2', '#f2c230'][i % 3]
      for (let k = 0; k < 5; k++) {
        ctx.beginPath()
        ctx.ellipse(x + Math.cos((k * Math.PI * 2) / 5) * 4, y + Math.sin((k * Math.PI * 2) / 5) * 4, 3.4, 2.2, (k * Math.PI * 2) / 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // 粉土畫的線
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(30, 20)
    ctx.bezierCurveTo(90, 10, 110, 70, 170, 60)
    ctx.lineTo(220, 110)
    ctx.stroke()
  })
}

/** 紙型（牛皮紙上畫的衣服版型） */
function patternTexture(kind: number) {
  return canvasTexture(96, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d8b888'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#6a3a1a'
    ctx.lineWidth = 2
    ctx.beginPath()
    if (kind === 0) {
      // 上衣前片
      ctx.moveTo(20, 16)
      ctx.lineTo(40, 10)
      ctx.quadraticCurveTo(48, 24, 56, 10)
      ctx.lineTo(76, 16)
      ctx.lineTo(82, 110)
      ctx.lineTo(14, 110)
      ctx.closePath()
    } else if (kind === 1) {
      // 袖子
      ctx.moveTo(10, 40)
      ctx.quadraticCurveTo(48, 0, 86, 40)
      ctx.lineTo(74, 118)
      ctx.lineTo(22, 118)
      ctx.closePath()
    } else {
      // 裙片
      ctx.moveTo(30, 10)
      ctx.lineTo(66, 10)
      ctx.lineTo(88, 118)
      ctx.lineTo(8, 118)
      ctx.closePath()
    }
    ctx.stroke()
    ctx.fillStyle = '#6a3a1a'
    ctx.font = `500 13px ${BRUSH_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(['前片', '袖', '裙'][kind], w / 2, h / 2 + 10)
  })
}

/** 鏡子裡十八歲的阿春（陰陽眼才看得到）：紅衫、馬尾、淡淡的 */
function youngChunTexture() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.5, w * 0.7)
    g.addColorStop(0, 'rgba(255,240,230,0.35)')
    g.addColorStop(1, 'rgba(255,240,230,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const cx = w / 2
    // 馬尾、頭
    ctx.fillStyle = 'rgba(40,28,26,0.85)'
    ctx.beginPath()
    ctx.ellipse(cx + 16, 70, 8, 22, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, 58, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(246,212,186,0.9)'
    ctx.beginPath()
    ctx.arc(cx, 62, 17, 0, Math.PI * 2)
    ctx.fill()
    // 紅衫（錦繡姨做的）
    ctx.fillStyle = 'rgba(206,64,58,0.9)'
    ctx.beginPath()
    ctx.moveTo(cx - 28, 92)
    ctx.quadraticCurveTo(cx, 80, cx + 28, 92)
    ctx.lineTo(cx + 34, 170)
    ctx.lineTo(cx - 34, 170)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(40,52,90,0.85)'
    ctx.fillRect(cx - 30, 170, 60, 70)
    // 臉：微笑
    ctx.strokeStyle = 'rgba(90,50,40,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, 66, 6, 0.2, Math.PI - 0.2)
    ctx.stroke()
  })
}

// ---------------------------------------------------------------------------
// 外殼（走進店裡、或在隔壁擋到鏡頭時淡出）：店面的牆（鐵捲門捲在上面）、東邊的牆
// ---------------------------------------------------------------------------

export function ShellCloth() {
  const shutter = useMemo(() => {
    const t = shutterTexture(1)
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.5 })
  }, [])
  const wall = usePlaster(WALL)
  const O2 = C.opening
  return (
    <group>
      <StoreWall x0={LOT.x0} x1={LOT.x1} color="#e6d6b4" openings={[{ c: O2.c, w: O2.w, y0: 0, y1: 2.7 }]} />
      {/* 鐵捲門整個捲上去（上面一截＋捲軸） */}
      <mesh material={shutter} position={[O2.c, FLOOR + 2.55, A.frontZ - 0.06]}>
        <planeGeometry args={[O2.w, 0.3]} />
      </mesh>
      <mesh material={flat('#7a8086', 0.5, 0.5)} position={[O2.c, FLOOR + 2.72, A.frontZ - 0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, O2.w, 12]} />
      </mesh>
      <mesh geometry={boxGeo(0.2, A.ceilY, A.frontZ - BACK, TILE.plaster)} material={wall} position={[LOT.x1 - 0.1, A.ceilY / 2, (A.frontZ + BACK) / 2]} receiveShadow />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 店裡（一直看得到）
// ---------------------------------------------------------------------------

export function ClothInterior() {
  const mats = useMats()
  const wall = usePlaster(WALL)
  const floor = useFloorMat('wood', '#8a6446')
  const floral = useMemo(floralTexture, [])
  const patterns = useMemo(() => [0, 1, 2].map(patternTexture), [])
  const bulb = useNightGlow('#ffe8c0', 0.6, 0.5)
  const x0 = LOT.x0 + 0.1
  const x1 = LOT.x1 - 0.2
  const S = C.shelf
  const T = C.table
  return (
    <group>
      <mesh geometry={boxGeo(x1 - x0, 0.02, A.frontZ - BACK, TILE.wood)} material={floor} position={[(x0 + x1) / 2, FLOOR, (A.frontZ + BACK) / 2]} receiveShadow />
      <Wall x0={LOT.x0} x1={LOT.x1} z0={BACK - 0.2} z1={BACK} mat={wall} />
      {/* 後牆一整排布架：四層，一匹一匹摺好的布 */}
      <group position={[(S.x0 + S.x1) / 2, FLOOR, (S.z0 + S.z1) / 2]}>
        {[0.05, 0.7, 1.35, 2.0, 2.62].map((y) => (
          <WBox key={y} mat="darkWood" size={[S.x1 - S.x0, 0.04, S.z1 - S.z0]} position={[0, y, 0]} castShadow={false} />
        ))}
        {[-1, -0.5, 0, 0.5, 1].map((k) => (
          <WBox key={k} mat="darkWood" size={[0.05, 2.64, S.z1 - S.z0]} position={[k * ((S.x1 - S.x0) / 2 - 0.03), 1.32, 0]} castShadow={false} />
        ))}
        {[0.07, 0.72, 1.37, 2.02].flatMap((y, row) =>
          Array.from({ length: 10 }, (_, i) => {
            const n = 1 + ((i + row) % 3)
            return Array.from({ length: n }, (_, j) => (
              <Box
                key={`${row}-${i}-${j}`}
                s={[0.44, 0.13, 0.42]}
                p={[-(S.x1 - S.x0) / 2 + 0.3 + i * 0.5, y + 0.085 + j * 0.135, 0.02]}
                m={flat(BOLTS[(i * 3 + row * 5 + j) % BOLTS.length], 0.9)}
                cast={false}
              />
            ))
          }),
        )}
      </group>
      {/* 西牆的直立布架：一捲一捲斜靠著 */}
      <group position={[(C.rack.x0 + C.rack.x1) / 2, FLOOR, (C.rack.z0 + C.rack.z1) / 2]}>
        <WBox mat="darkWood" size={[C.rack.x1 - C.rack.x0, 0.1, C.rack.z1 - C.rack.z0]} position={[0, 0.05, 0]} castShadow={false} />
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} material={flat(BOLTS[(i * 5 + 2) % BOLTS.length], 0.9)} position={[0.05, 0.7, -0.8 + i * 0.23]} rotation={[0, 0, -0.18]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 1.3, 10]} />
          </mesh>
        ))}
      </group>
      {/* 剪裁檯：攤開的花布、布捲、台尺、剪刀、粉土、針插、紙型 */}
      <group position={[T.x, FLOOR, T.z]}>
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <WBox key={i} mat="darkWood" size={[0.08, 0.84, 0.08]} position={[sx * (T.w / 2 - 0.08), 0.42, sz * (T.d / 2 - 0.08)]} />
        ))}
        <WBox mat="wood" size={[T.w, 0.06, T.d]} position={[0, 0.87, 0]} />
        <mesh position={[-0.2, 0.905, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.9, 0.82]} />
          <meshStandardMaterial map={floral} roughness={0.95} />
        </mesh>
        <mesh material={flat('#2e4a7a', 0.9)} position={[1.05, 0.98, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.82, 12]} />
        </mesh>
        <Box s={[1.0, 0.012, 0.05]} p={[-0.3, 0.915, 0.3]} m={flat('#e8c060', 0.6)} cast={false} rot={[0, 0.05, 0]} />
        {/* 剪刀 */}
        <group position={[0.45, 0.915, -0.25]} rotation={[0, 0.6, 0]}>
          <Box s={[0.28, 0.01, 0.025]} p={[0.06, 0, 0.012]} m={flat('#c8ccd0', 0.25, 0.8)} cast={false} rot={[0, 0.12, 0]} />
          <Box s={[0.28, 0.01, 0.025]} p={[0.06, 0.004, -0.012]} m={flat('#c8ccd0', 0.25, 0.8)} cast={false} rot={[0, -0.12, 0]} />
          {[-1, 1].map((s) => (
            <mesh key={s} material={flat('#1c1c1e', 0.5)} position={[-0.12, 0.004, s * 0.04]} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.035, 0.009, 6, 12]} />
            </mesh>
          ))}
        </group>
        <Box s={[0.06, 0.02, 0.04]} p={[-0.9, 0.92, -0.28]} m={flat('#f4f1ea', 0.9)} cast={false} />
        <mesh material={flat('#d8342b', 0.8)} position={[-1.25, 0.95, 0.3]}>
          <sphereGeometry args={[0.06, 10, 8]} />
        </mesh>
        <mesh position={[0.5, 0.908, 0.12]} rotation={[-Math.PI / 2, 0, 0.3]}>
          <planeGeometry args={[0.36, 0.48]} />
          <meshStandardMaterial map={patterns[0]} roughness={0.9} />
        </mesh>
      </group>
      {/* 天花板下一條繩子，掛著紙型 */}
      <mesh material={flat('#8a7a60', 0.8)} position={[(x0 + x1) / 2, A.ceilY - 0.45, -6.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, x1 - x0 - 0.4, 4]} />
      </mesh>
      {[-1.8, -0.9, 0.3, 1.4].map((dx, i) => (
        <mesh key={dx} position={[(x0 + x1) / 2 + dx, A.ceilY - 0.78, -6.1 + (i % 2) * 0.02]} rotation={[0, 0.1 * (i - 1.5), 0]}>
          <planeGeometry args={[0.46, 0.62]} />
          <meshStandardMaterial map={patterns[i % 3]} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* 櫃台：算盤、帳簿、一排線軸 */}
      <group position={[C.counter.x, FLOOR, C.counter.z]}>
        <WBox mat="darkWood" size={[C.counter.w, 0.88, C.counter.d]} position={[0, 0.44, 0]} />
        <WBox mat="wood" size={[C.counter.w + 0.06, 0.04, C.counter.d + 0.06]} position={[0, 0.9, 0]} />
        <group position={[-0.25, 0.94, 0.02]} rotation={[0, 0.15, 0]}>
          <Box s={[0.42, 0.03, 0.16]} p={[0, 0, 0]} m={flat('#4a2a18', 0.6)} cast={false} />
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} material={flat('#2a1a10', 0.5)} position={[-0.18 + i * 0.045, 0.025, 0.02]}>
              <sphereGeometry args={[0.016, 6, 5]} />
            </mesh>
          ))}
        </group>
        <Box s={[0.3, 0.04, 0.22]} p={[0.25, 0.94, 0]} m={flat('#2a4a3a', 0.8)} rot={[0, -0.2, 0]} />
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} material={flat(BOLTS[(i * 2 + 1) % BOLTS.length], 0.7)} position={[-0.45 + i * 0.1, 0.96, -0.17]}>
            <cylinderGeometry args={[0.03, 0.03, 0.08, 8]} />
          </mesh>
        ))}
      </group>
      {/* 立鏡（木框）：鏡面朝東 */}
      <group position={[C.mirror.x, FLOOR, C.mirror.z]}>
        <WBox mat="darkWood" size={[0.08, 1.9, 0.82]} position={[0, 0.95, 0]} />
        <mesh position={[0.045, 1.0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.7, 1.7]} />
          <meshStandardMaterial color="#c8d4dc" roughness={0.06} metalness={0.9} />
        </mesh>
        <WBox mat="darkWood" size={[0.4, 0.06, 0.9]} position={[0.1, 0.03, 0]} />
      </group>
      {/* 裁縫車（不會動的部分）：鑄鐵腳架、木頭桌面、踏板 */}
      <SewingMachineBase />
      {/* 凳子 */}
      <group position={[C.seat.x, FLOOR, C.seat.z]}>
        <mesh material={mats.wood} position={[0, 0.43, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.05, 14]} />
        </mesh>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} material={mats.darkWood} position={[Math.sin(a) * 0.12, 0.2, Math.cos(a) * 0.12]}>
            <cylinderGeometry args={[0.02, 0.025, 0.42, 5]} />
          </mesh>
        ))}
      </group>
      {/* 天花板一顆燈泡 */}
      <mesh material={bulb} position={[(x0 + x1) / 2, A.ceilY - 0.35, -7.6]}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
      <mesh material={mats.black} position={[(x0 + x1) / 2, A.ceilY - 0.15, -7.6]}>
        <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
      </mesh>
    </group>
  )
}

/** 裁縫車的桌子和腳架（錦繡姨坐在西邊，面向東） */
function SewingMachineBase() {
  const M = C.machine
  const iron = flat('#1c1c1e', 0.5, 0.4)
  return (
    <group position={[M.x, FLOOR, M.z]}>
      <WBox mat="darkWood" size={[M.w, 0.05, M.d]} position={[0, 0.76, 0]} />
      <WBox mat="darkWood" size={[M.w - 0.04, 0.16, M.d - 0.1]} position={[0, 0.66, 0]} />
      {/* 兩側鑄鐵腳架 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * (M.d / 2 - 0.06)]}>
          <Box s={[0.42, 0.04, 0.04]} p={[0, 0.03, 0]} m={iron} />
          <Box s={[0.04, 0.6, 0.04]} p={[-0.14, 0.33, 0]} m={iron} rot={[0, 0, 0.12]} />
          <Box s={[0.04, 0.6, 0.04]} p={[0.14, 0.33, 0]} m={iron} rot={[0, 0, -0.12]} />
        </group>
      ))}
      {/* 踏板 */}
      <Box s={[0.36, 0.03, 0.6]} p={[-0.05, 0.1, 0]} m={iron} rot={[0, 0, -0.08]} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 會動的：裁縫車（晚上錦繡姨在踩，輪子會轉）、衣架上的旗袍、錦繡姨、鏡子裡的人
// ---------------------------------------------------------------------------

export function ClothLive({ outline }: { outline: boolean }) {
  const isNight = useStore((s) => s.isNight)
  const done = useStore((s) => !!s.flags.jinxiu_dress)
  const young = useMemo(youngChunTexture, [])
  const mirrorGhost = useRef<THREE.Mesh>(null)
  const ghostMat = useMemo(() => new THREE.MeshBasicMaterial({ map: young, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), [young])
  useFrame((_, dt) => {
    const s = useStore.getState()
    const near = Math.hypot(player.x - C.mirror.x, player.z - C.mirror.z) < 2.2
    const want = s.vision && near ? 0.9 : 0
    ghostMat.opacity += (want - ghostMat.opacity) * Math.min(1, dt * 3)
    if (mirrorGhost.current) mirrorGhost.current.visible = ghostMat.opacity > 0.01
  })
  // 錦繡姨坐在凳子上（凳面高 0.45）
  const sitY = FLOOR + 0.45 - SEAT_Y * 0.92 + 0.03
  return (
    <group>
      <MachineHead sewing={isNight} />
      <DressForm done={done} />
      {isNight && <ChibiNpc id="jinxiu" pose="sit" position={[C.seat.x, sitY, C.seat.z]} heading={Math.PI / 2} seesGhosts outline={outline} />}
      <mesh ref={mirrorGhost} material={ghostMat} position={[C.mirror.x + 0.05, FLOOR + 1.0, C.mirror.z]} rotation={[0, Math.PI / 2, 0]} visible={false} userData={{ noMerge: true }}>
        <planeGeometry args={[0.62, 1.5]} />
      </mesh>
    </group>
  )
}

/** 裁縫車的機頭（黑色、金色花紋）＋桌下的大飛輪；sewing：輪子轉、針上下 */
function MachineHead({ sewing }: { sewing: boolean }) {
  const M = C.machine
  const wheel = useRef<THREE.Group>(null)
  const needle = useRef<THREE.Mesh>(null)
  const fly = useRef<THREE.Group>(null)
  useFrame(({ clock }, dt) => {
    if (!sewing) return
    const t = clock.elapsedTime
    // 踩一陣、停一下（在對線）
    const on = Math.sin(t * 0.7) > -0.3
    const sp = on ? 9 : 0
    if (wheel.current) wheel.current.rotation.x += Math.min(dt, 0.1) * sp
    if (fly.current) fly.current.rotation.x += Math.min(dt, 0.1) * sp * 0.4
    if (needle.current) needle.current.position.y = 0.06 + (on ? Math.sin(t * 30) * 0.02 : 0)
  })
  const black = flat('#16161a', 0.35, 0.3)
  const gold = flat('#c8a050', 0.35, 0.6)
  return (
    <group position={[M.x, FLOOR + 0.785, M.z]} userData={{ noMerge: true }}>
      {/* 底板、柱子、手臂、機頭 */}
      <Box s={[0.2, 0.05, 0.42]} p={[0, 0.025, 0]} m={black} />
      <Box s={[0.12, 0.26, 0.1]} p={[0, 0.18, 0.15]} m={black} />
      <Box s={[0.12, 0.09, 0.4]} p={[0, 0.3, 0.0]} m={black} />
      <Box s={[0.13, 0.2, 0.08]} p={[0, 0.2, -0.17]} m={black} />
      <Box s={[0.005, 0.03, 0.25]} p={[-0.062, 0.3, 0.0]} m={gold} cast={false} />
      <mesh ref={needle} material={flat('#c8ccd0', 0.2, 0.8)} position={[0, 0.06, -0.17]}>
        <cylinderGeometry args={[0.004, 0.004, 0.08, 4]} />
      </mesh>
      {/* 線軸 */}
      <mesh material={flat('#d8342b', 0.7)} position={[0, 0.38, 0.05]}>
        <cylinderGeometry args={[0.02, 0.02, 0.05, 8]} />
      </mesh>
      {/* 手輪（右邊，+z） */}
      <group ref={wheel} position={[0, 0.28, 0.22]}>
        <mesh material={flat('#b8bcc0', 0.3, 0.8)} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.03, 16]} />
        </mesh>
        <Box s={[0.035, 0.1, 0.02]} p={[0, 0.03, 0.02]} m={black} cast={false} />
      </group>
      {/* 桌下的大飛輪 */}
      <group ref={fly} position={[0, -0.4, M.d / 2 - 0.14]}>
        <mesh material={flat('#1c1c1e', 0.5, 0.4)} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.22, 0.02, 6, 20]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={flat('#1c1c1e', 0.5, 0.4)} rotation={[(i * Math.PI) / 3, 0, 0]}>
            <boxGeometry args={[0.015, 0.44, 0.015]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** 衣架（人台）上的旗袍：還沒做完是上半截紅、下面白胚布插著針；做完了整件紅、金色滾邊 */
function DressForm({ done }: { done: boolean }) {
  const F = C.form
  const red = flat('#b8202a', 0.55)
  const muslin = flat('#ece4d0', 0.95)
  const gold = flat('#d8a444', 0.35, 0.6)
  const wood = flat('#5a3a24', 0.6)
  return (
    <group position={[F.x, FLOOR, F.z]} rotation={[0, -0.6, 0]} userData={{ noMerge: true }}>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} material={wood} position={[Math.sin(a) * 0.14, 0.08, Math.cos(a) * 0.14]} rotation={[Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1]}>
          <cylinderGeometry args={[0.012, 0.012, 0.32, 5]} />
        </mesh>
      ))}
      <mesh material={wood} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.8, 6]} />
      </mesh>
      {/* 上半身 */}
      <mesh material={red} position={[0, 1.2, 0]} scale={[1, 1.35, 0.72]} castShadow>
        <sphereGeometry args={[0.2, 16, 12]} />
      </mesh>
      <mesh material={red} position={[0, 1.47, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.12, 12]} />
      </mesh>
      <mesh material={gold} position={[0, 1.53, 0]}>
        <torusGeometry args={[0.052, 0.008, 6, 14]} />
      </mesh>
      {/* 下擺：做完是紅的，還沒做完是白胚布 */}
      <mesh material={done ? red : muslin} position={[0, 0.82, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.22, 0.56, 16]} />
      </mesh>
      {done ? (
        <mesh material={gold} position={[0, 0.545, 0]}>
          <torusGeometry args={[0.22, 0.01, 6, 20]} />
        </mesh>
      ) : (
        [0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} material={flat('#c8ccd0', 0.2, 0.8)} position={[Math.sin(i * 1.26) * 0.2, 0.95 - (i % 2) * 0.08, Math.cos(i * 1.26) * 0.2]}>
            <sphereGeometry args={[0.012, 5, 4]} />
          </mesh>
        ))
      )}
    </group>
  )
}
