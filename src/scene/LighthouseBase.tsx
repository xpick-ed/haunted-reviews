import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useStore } from '../store'
import { LIGHTHOUSE, polar, stairY } from '../world/sceneLighthouse'
import { player, VIEW } from '../world/player'
import { lanternAt } from './daylight'
import { BRUSH_FONT, WBox, canvasTexture, useMats } from './kit'
import { MergeStatic } from './MergeStatic'

// 燈塔下層（DESIGN §32.5）：守燈人的小屋＋塔底＋沿牆一圈的螺旋梯。
// 鏡頭在右下（東南）固定不動：靠鏡頭那一半的塔牆、小屋的東牆和南牆只做矮牆（剖面），爬到多高都看得到阿嬤。

const L = LIGHTHOUSE
const T = L.tower
const S = L.stair
const C = L.cottage
/** 塔牆的高度（頂上平台再上去一點） */
const WALL_H = S.h + 2.9
/** 鏡頭在哪個方位（度）：這一側 ±85° 的牆只做矮牆 */
const CAM_A = (Math.atan2(VIEW.x, VIEW.z) * 180) / Math.PI
const angDiff = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180)
const nearSide = (a: number) => angDiff(a, CAM_A) < 85

/** 一塊環形的扇形板（樓梯踏板、頂上平台）：a0→a1（度）、r0→r1、頂面在 y、厚 th */
function sector(a0: number, a1: number, r0: number, r1: number, y: number, th: number) {
  const shape = new THREE.Shape()
  const n = Math.max(2, Math.ceil((a1 - a0) / 3))
  // 形狀在 xy 平面：(x, -z)。擠出方向 +z 之後轉成 +y
  const pt = (a: number, r: number) => {
    const t = (a * Math.PI) / 180
    return new THREE.Vector2(Math.sin(t) * r, -Math.cos(t) * r)
  }
  shape.moveTo(pt(a0, r0).x, pt(a0, r0).y)
  for (let i = 0; i <= n; i++) {
    const p = pt(a0 + ((a1 - a0) * i) / n, r1)
    shape.lineTo(p.x, p.y)
  }
  for (let i = n; i >= 0; i--) {
    const p = pt(a0 + ((a1 - a0) * i) / n, r0)
    shape.lineTo(p.x, p.y)
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  g.translate(T.x, y - th, T.z)
  return g.toNonIndexed()
}

export function LighthouseBase({ outline }: { outline: boolean }) {
  void outline
  return (
    <group>
      <MergeStatic>
        <Floors />
        <TowerWall />
        <Cottage />
      </MergeStatic>
      <Stairs />
      <Ladder />
      <BaseLights />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 地板：塔底（石板）、走道、小屋（木板）
// ---------------------------------------------------------------------------

function Floors() {
  const mats = useMats()
  return (
    <group>
      <mesh position={[T.x, -0.1, T.z]} material={mats.stone} receiveShadow>
        <cylinderGeometry args={[T.rOut + 0.35, T.rOut + 0.35, 0.2, 40]} />
      </mesh>
      {/* 樓梯井底：一圈矮石緣（井中間不能走） */}
      <mesh position={[T.x, 0.15, T.z]} material={mats.stone} castShadow receiveShadow>
        <cylinderGeometry args={[T.rIn - 0.05, T.rIn, 0.3, 32]} />
      </mesh>
      <WBox mat="wood" size={[C.x1 - C.x0, 0.12, C.z1 - C.z0 + 0.8]} position={[0, -0.06, (C.z0 + C.z1) / 2 - 0.4]} />
      {/* 燈塔腳下：堤防的水泥頭（小屋蓋在上面），往南接回碼頭；四周是海 */}
      <WBox mat="yard" size={[C.x1 - C.x0 + 3, 1.2, C.z1 + T.rOut + 9]} position={[0, -0.72, (C.z1 - T.rOut) / 2 + 3]} tile={4} />
      <mesh position={[T.x, -1.25, T.z + 20]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#0d2130" roughness={0.3} metalness={0.15} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 塔牆：一圈 36 片；靠鏡頭那一半做成矮牆，門那邊留缺口；遠側有三扇小窗
// ---------------------------------------------------------------------------

function TowerWall() {
  const mats = useMats()
  const panels = useMemo(() => {
    const out: { a: number; h: number }[] = []
    for (let i = 0; i < 36; i++) {
      const a = i * 10 + 5
      const aa = a > 180 ? a - 360 : a
      if (Math.abs(aa) < L.towerDoor) continue
      out.push({ a, h: nearSide(a) ? 0.9 : WALL_H })
    }
    return out
  }, [])
  const w = ((T.rOut + 0.15) * 2 * Math.PI) / 36 + 0.03
  const windows = [
    { a: L.window, y: stairY(L.window) + 1.3 },
    { a: 238, y: stairY(238) + 1.4 },
    { a: 120, y: stairY(120) + 1.4 },
  ]
  return (
    <group>
      {panels.map((p) => {
        const q = polar(T.x, T.z, p.a, T.rOut + 0.15)
        return (
          <group key={p.a} position={[q.x, 0, q.z]} rotation-y={(p.a * Math.PI) / 180}>
            <mesh position={[0, p.h / 2, 0]} material={mats.plaster} castShadow receiveShadow>
              <boxGeometry args={[w, p.h, 0.3]} />
            </mesh>
            {/* 牆腳的石頭 */}
            <mesh position={[0, 0.25, -0.02]} material={mats.stone}>
              <boxGeometry args={[w, 0.5, 0.32]} />
            </mesh>
          </group>
        )
      })}
      {windows
        .filter((wd) => !nearSide(wd.a))
        .map((wd) => {
          const q = polar(T.x, T.z, wd.a, T.rOut - 0.005)
          return (
            <group key={wd.a} position={[q.x, wd.y, q.z]} rotation-y={(wd.a * Math.PI) / 180 + Math.PI}>
              <mesh>
                <planeGeometry args={[0.55, 0.9]} />
                <meshStandardMaterial color="#1c2d44" emissive="#6f8fb8" emissiveIntensity={0.35} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0, 0.01]} material={mats.darkWood}>
                <boxGeometry args={[0.62, 0.06, 0.04]} />
              </mesh>
              <mesh position={[0, 0, 0.01]} material={mats.darkWood}>
                <boxGeometry args={[0.05, 0.96, 0.04]} />
              </mesh>
            </group>
          )
        })}
      {/* 樓梯井底：以前轉透鏡的鐘錘掉下來的鐵箱（只有一點點高，不會擋到樓梯上的阿嬤） */}
      <mesh position={[T.x, 0.55, T.z]} material={mats.metal}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 螺旋梯：40 片踏板合成一個網格；內側鐵欄杆（柱子＋一條扶手）；頂上平台與平台邊的欄杆；下面堆燈油桶
// ---------------------------------------------------------------------------

function Stairs() {
  const mats = useMats()
  const { treads, landing } = useMemo(() => {
    const n = S.treads
    const da = (S.a2 - S.a1) / n
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < n; i++) {
      const a0 = S.a1 + i * da
      const y = 0.02 + (S.h * (i + 0.5)) / n
      parts.push(sector(a0 - 0.4, a0 + da + 0.4, T.rIn + 0.02, T.rOut + 0.02, y, 0.24))
    }
    const treads = mergeGeometries(parts)!
    treads.computeVertexNormals()
    const landing = sector(S.a2, S.a3, T.rIn + 0.02, T.rOut + 0.02, 0.02 + S.h, 0.32)
    landing.computeVertexNormals()
    return { treads, landing }
  }, [])
  const rail = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let a = S.a1 - 4; a <= S.a3; a += 6) {
      const p = polar(T.x, T.z, a, T.rIn + 0.12)
      pts.push(new THREE.Vector3(p.x, stairY(Math.max(a, S.a1)) + 0.95, p.z))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.035, 6, false)
  }, [])
  const posts = useMemo(() => {
    const out: { x: number; z: number; y: number }[] = []
    for (let a = S.a1 + 4; a <= S.a3; a += 14) {
      const p = polar(T.x, T.z, a, T.rIn + 0.12)
      out.push({ x: p.x, z: p.z, y: stairY(a) })
    }
    return out
  }, [])
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.5, metalness: 0.55 }), [])
  // 頂上平台盡頭的欄杆（徑向一排）
  const endRail = useMemo(() => {
    const a = S.a3 - 1
    const p0 = polar(T.x, T.z, a, T.rIn + 0.1)
    const p1 = polar(T.x, T.z, a, T.rOut - 0.05)
    const len = Math.hypot(p1.x - p0.x, p1.z - p0.z)
    return { x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2, len, rot: Math.atan2(p1.x - p0.x, p1.z - p0.z) }
  }, [])
  const drums = useMemo(() => {
    const out: { x: number; z: number; y: number; c: string }[] = []
    const cols = ['#8a3a2a', '#2f5a7a', '#6b6b3a', '#8a3a2a']
    let k = 0
    for (let a = S.a3 + 6; a <= 360 + S.a0 - 6; a += 9)
      for (const r of [1.85, 2.45, 3.0]) {
        const p = polar(T.x, T.z, a, r)
        out.push({ x: p.x, z: p.z, y: 0, c: cols[k++ % cols.length] })
        if (k % 3 === 0) out.push({ x: p.x, z: p.z, y: 0.9, c: cols[(k + 1) % cols.length] })
      }
    return out
  }, [])
  return (
    <group>
      <mesh geometry={treads} material={mats.stone} castShadow receiveShadow />
      <mesh geometry={landing} material={mats.stone} castShadow receiveShadow />
      <mesh geometry={rail} material={iron} />
      {posts.map((p, i) => (
        <mesh key={i} position={[p.x, p.y + 0.48, p.z]} material={iron}>
          <cylinderGeometry args={[0.025, 0.025, 0.96, 6]} />
        </mesh>
      ))}
      <group position={[endRail.x, S.h + 0.02, endRail.z]} rotation-y={endRail.rot}>
        <mesh position={[0, 0.95, 0]} material={iron}>
          <boxGeometry args={[0.05, 0.05, endRail.len]} />
        </mesh>
        {[-0.45, 0, 0.45].map((t) => (
          <mesh key={t} position={[0, 0.48, t * endRail.len]} material={iron}>
            <cylinderGeometry args={[0.025, 0.025, 0.96, 6]} />
          </mesh>
        ))}
      </group>
      {drums.map((d, i) => (
        <mesh key={i} position={[d.x, d.y + 0.45, d.z]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.88, 14]} />
          <meshStandardMaterial color={d.c} roughness={0.75} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/** 頂上平台的鐵梯：往上通到燈籠室的活門（點亮以後活門縫有光） */
function Ladder() {
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  const p = polar(T.x, T.z, 306, 2.85)
  const y0 = S.h + 0.02
  const H = 2.7
  useFrame(() => {
    const s = useStore.getState()
    const on = !!s.flags.lighthouse_lit && s.phase === 'night'
    if (glow.current) glow.current.opacity = on ? 0.85 : 0.15
  })
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.5, metalness: 0.55 }), [])
  return (
    <group position={[p.x, y0, p.z]} rotation-y={(306 * Math.PI) / 180}>
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, H / 2, 0]} material={iron}>
          <boxGeometry args={[0.05, H, 0.05]} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0, 0.3 + i * 0.3, 0]} material={iron}>
          <boxGeometry args={[0.56, 0.035, 0.035]} />
        </mesh>
      ))}
      {/* 活門：一塊暗板，縫隙透光 */}
      <mesh position={[0, H + 0.02, -0.1]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial ref={glow} color="#ffe2a0" transparent opacity={0.15} toneMapped={false} />
      </mesh>
      <mesh position={[0, H + 0.06, -0.1]} material={iron}>
        <boxGeometry args={[0.8, 0.04, 0.8]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 守燈人的小屋：床、書桌（值班日誌、煤油燈）、收音機、燈油桶、煤油爐、牆上的相片與日曆、雨衣與雨鞋
// 西牆、北牆（遠側）是整面牆；東牆、南牆（靠鏡頭）只做矮牆
// ---------------------------------------------------------------------------

const logTex = canvasTexture(256, 160, (ctx, w, h) => {
  ctx.fillStyle = '#efe6cf'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#c9bb98'
  ctx.fillRect(w / 2 - 2, 0, 4, h)
  ctx.strokeStyle = 'rgba(60,70,110,0.55)'
  ctx.lineWidth = 2
  for (let side = 0; side < 2; side++)
    for (let i = 0; i < 9; i++) {
      const x0 = side * (w / 2) + 12
      const y = 18 + i * 15
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(x0 + (w / 2 - 28) * (0.55 + ((i * 37 + side * 11) % 40) / 100), y)
      ctx.stroke()
    }
})

const photoTex = canvasTexture(
  160,
  200,
  (ctx, w, h) => {
    ctx.fillStyle = '#3a2a1c'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#d8c7a0'
    ctx.fillRect(12, 12, w - 24, h - 44)
    const g = ctx.createLinearGradient(0, 12, 0, h - 32)
    g.addColorStop(0, '#b9a57c')
    g.addColorStop(1, '#8a7650')
    ctx.fillStyle = g
    ctx.fillRect(16, 16, w - 32, h - 52)
    // 兩個人站在堤防上（剪影）
    ctx.fillStyle = '#4a3b28'
    ctx.fillRect(16, h - 70, w - 32, 14)
    for (const [x, hh] of [
      [58, 76],
      [100, 68],
    ] as const) {
      ctx.beginPath()
      ctx.arc(x, h - 70 - hh + 10, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(x - 11, h - 70 - hh + 20, 22, hh - 20)
    }
    ctx.fillStyle = '#b8342c'
    ctx.fillRect(108, h - 118, 16, 8)
    ctx.fillStyle = '#e9dcbc'
    ctx.font = `600 16px ${BRUSH_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('民國五十年', w / 2, h - 12)
  },
  [{ spec: `600 16px ${BRUSH_FONT}`, text: '民國五十年' }],
)

const calTex = canvasTexture(
  96,
  128,
  (ctx, w, h) => {
    ctx.fillStyle = '#f2ece0'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#b8342c'
    ctx.fillRect(0, 0, w, 30)
    ctx.fillStyle = '#fff'
    ctx.font = `700 20px ${BRUSH_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('九月', w / 2, 22)
    ctx.fillStyle = '#222'
    ctx.font = '700 54px serif'
    ctx.fillText('17', w / 2, 92)
  },
  [{ spec: `700 20px ${BRUSH_FONT}`, text: '九月' }],
)

function Cottage() {
  const mats = useMats()
  const midZ = (C.z0 + C.z1) / 2
  const depth = C.z1 - C.z0
  const FULL = 2.8
  const LOW = 0.9
  const blanket = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b7078', roughness: 0.95 }), [])
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.5, metalness: 0.55 }), [])
  const log = useMemo(() => new THREE.MeshStandardMaterial({ map: logTex, roughness: 0.9 }), [])
  const photo = useMemo(() => new THREE.MeshStandardMaterial({ map: photoTex, roughness: 0.7 }), [])
  const cal = useMemo(() => new THREE.MeshStandardMaterial({ map: calTex, roughness: 0.9 }), [])
  const coat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8a530', roughness: 0.6 }), [])
  const passW = C.x1 - C.passage
  return (
    <group>
      {/* 西牆（遠側，整面），牆上一扇窗 */}
      <WBox mat="plaster" size={[0.22, FULL, depth]} position={[C.x0 - 0.11, FULL / 2, midZ]} />
      <mesh position={[C.x0 + 0.01, 1.55, 7.3]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[0.9, 0.8]} />
        <meshStandardMaterial color="#1c2d44" emissive="#6f8fb8" emissiveIntensity={0.3} roughness={0.2} />
      </mesh>
      {/* 北牆（遠側，整面；中間是往塔裡的走道） */}
      <WBox mat="plaster" size={[C.x1 - C.passage, FULL, 0.22]} position={[-(C.passage + passW / 2), FULL / 2, C.z0 - 0.08]} />
      <WBox mat="plaster" size={[C.x1 - C.passage, FULL, 0.22]} position={[C.passage + passW / 2, FULL / 2, C.z0 - 0.08]} />
      <WBox mat="darkWood" size={[C.passage * 2 + 0.2, 0.2, 0.3]} position={[0, 2.2, C.z0 - 0.08]} />
      {/* 走道兩邊的牆 */}
      {[-1, 1].map((sd) => (
        <WBox key={sd} mat="plaster" size={[0.35, sd < 0 ? FULL : LOW, 0.8]} position={[sd * (C.passage + 0.2), (sd < 0 ? FULL : LOW) / 2, C.z0 - 0.45]} />
      ))}
      {/* 東牆、南牆（靠鏡頭，矮牆；南牆中間是門） */}
      <WBox mat="plaster" size={[0.22, LOW, depth]} position={[C.x1 + 0.11, LOW / 2, midZ]} />
      <WBox mat="plaster" size={[C.x1 - C.door, LOW, 0.22]} position={[-(C.door + (C.x1 - C.door) / 2), LOW / 2, C.z1]} />
      <WBox mat="plaster" size={[C.x1 - C.door, LOW, 0.22]} position={[C.door + (C.x1 - C.door) / 2, LOW / 2, C.z1]} />
      {/* 門框 */}
      {[-1, 1].map((sd) => (
        <WBox key={sd} mat="darkWood" size={[0.1, 2.1, 0.26]} position={[sd * C.door, 1.05, C.z1]} />
      ))}

      {/* 鐵床：床架、床墊、摺成豆腐乾的被子、枕頭、手電筒 */}
      <group position={[L.bed.x, 0, L.bed.z]}>
        {[
          [-0.5, -1.0],
          [0.5, -1.0],
          [-0.5, 1.0],
          [0.5, 1.0],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.3, z]} material={iron}>
            <boxGeometry args={[0.05, 0.6, 0.05]} />
          </mesh>
        ))}
        <mesh position={[0, 0.72, -1.0]} material={iron}>
          <boxGeometry args={[1.0, 0.5, 0.04]} />
        </mesh>
        <WBox mat="cloth" size={[1.0, 0.18, 2.0]} position={[0, 0.5, 0]} />
        <mesh position={[0, 0.66, 0.35]} material={blanket} castShadow>
          <boxGeometry args={[0.5, 0.16, 0.4]} />
        </mesh>
        <WBox mat="cloth" size={[0.6, 0.12, 0.34]} position={[0, 0.65, -0.72]} />
        <mesh position={[0.3, 0.64, -0.5]} rotation-z={Math.PI / 2} material={mats.metal}>
          <cylinderGeometry args={[0.04, 0.05, 0.22, 8]} />
        </mesh>
      </group>

      {/* 書桌：值班日誌攤開、煤油燈、椅子 */}
      <group position={[L.desk.x, 0, L.desk.z]}>
        <WBox mat="darkWood" size={[1.8, 0.06, 0.7]} position={[0, 0.76, 0]} />
        {[
          [-0.82, -0.28],
          [0.82, -0.28],
          [-0.82, 0.28],
          [0.82, 0.28],
        ].map(([x, z]) => (
          <WBox key={`${x}${z}`} mat="darkWood" size={[0.06, 0.74, 0.06]} position={[x, 0.37, z]} />
        ))}
        <mesh position={[-0.4, 0.8, 0.05]} rotation-x={-Math.PI / 2} material={log}>
          <planeGeometry args={[0.62, 0.4]} />
        </mesh>
        <WBox mat="darkWood" size={[0.45, 0.4, 0.4]} position={[-0.35, 0.22, 0.75]} />
      </group>
      {/* 收音機（木頭盒子，刻度盤晚上會亮） */}
      <group position={[L.radio.x, 0.79, L.radio.z]}>
        <WBox mat="darkWood" size={[0.5, 0.32, 0.26]} position={[0, 0.16, 0]} />
        <mesh position={[0, 0.2, 0.135]}>
          <planeGeometry args={[0.36, 0.1]} />
          <meshStandardMaterial color="#e8c070" emissive="#ffb050" emissiveIntensity={0.6} />
        </mesh>
      </group>
      {/* 燈油桶（東南角） */}
      {[
        [L.drums.x - 0.25, L.drums.z - 0.4, '#8a3a2a'],
        [L.drums.x + 0.35, L.drums.z - 0.35, '#2f5a7a'],
        [L.drums.x + 0.05, L.drums.z + 0.35, '#8a3a2a'],
      ].map(([x, z, c]) => (
        <mesh key={`${x}`} position={[x as number, 0.45, z as number]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.9, 14]} />
          <meshStandardMaterial color={c as string} roughness={0.75} metalness={0.3} />
        </mesh>
      ))}
      {/* 煤油爐與茶壺 */}
      <group position={[L.stove.x, 0, L.stove.z]}>
        <WBox mat="darkWood" size={[0.8, 0.7, 0.6]} position={[0, 0.35, 0]} />
        <mesh position={[0, 0.8, 0]} material={mats.metal}>
          <cylinderGeometry args={[0.16, 0.18, 0.2, 12]} />
        </mesh>
        <mesh position={[0, 1.0, 0]} material={mats.metal}>
          <sphereGeometry args={[0.15, 12, 8]} />
        </mesh>
      </group>
      {/* 牆上的相片、日曆 */}
      <mesh position={[C.x0 + 0.01, 1.65, L.photo.z]} rotation-y={Math.PI / 2} material={photo}>
        <planeGeometry args={[0.42, 0.52]} />
      </mesh>
      <mesh position={[C.x0 + 0.01, 1.7, L.photo.z + 0.8]} rotation-y={Math.PI / 2} material={cal}>
        <planeGeometry args={[0.3, 0.4]} />
      </mesh>
      {/* 門邊掛的雨衣、一雙雨鞋 */}
      <mesh position={[-C.door - 0.45, 1.25, C.z1 - 0.18]} material={coat}>
        <boxGeometry args={[0.45, 0.9, 0.12]} />
      </mesh>
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[-C.door - 0.45 + x, 0.14, C.z1 - 0.3]} material={mats.black}>
          <boxGeometry args={[0.14, 0.28, 0.3]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 光：小屋的煤油燈（暖）、塔裡的月光（冷，跟著阿嬤的高度）
// ---------------------------------------------------------------------------

function BaseLights() {
  const lamp = useRef<THREE.PointLight>(null)
  const moon = useRef<THREE.PointLight>(null)
  const flame = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const f = 1 + Math.sin(clock.elapsedTime * 9) * 0.05 + Math.sin(clock.elapsedTime * 23) * 0.03
    if (lamp.current) lamp.current.intensity = (1.2 + 3.2 * l) * f
    if (flame.current) flame.current.emissiveIntensity = (0.6 + 2.2 * l) * f
    if (moon.current) {
      moon.current.intensity = 0.6 + 3.2 * l
      moon.current.position.set(T.x, THREE.MathUtils.clamp(floorOf() + 2.2, 1.8, S.h + 1.5), T.z)
    }
  })
  return (
    <group>
      <pointLight ref={lamp} position={[L.desk.x + 0.55, 1.35, L.desk.z + 0.1]} color="#ffc27a" distance={9} decay={1.6} intensity={2} />
      <mesh position={[L.desk.x + 0.55, 1.05, L.desk.z]}>
        <cylinderGeometry args={[0.07, 0.09, 0.26, 10]} />
        <meshStandardMaterial ref={flame} color="#fff0c0" emissive="#ffb24a" emissiveIntensity={1} transparent opacity={0.85} />
      </mesh>
      <pointLight ref={moon} position={[T.x, 2.5, T.z]} color="#9fb8e8" distance={7.5} decay={1.4} intensity={2} />
    </group>
  )
}

/** 阿嬤現在站的地板高度（塔裡的月光跟著往上） */
function floorOf() {
  const a = (Math.atan2(player.x - T.x, player.z - T.z) * 180) / Math.PI
  const aa = a < -46 ? a + 360 : a
  return Math.hypot(player.x - T.x, player.z - T.z) < T.rOut + 0.4 ? stairY(aa) : 0.02
}
