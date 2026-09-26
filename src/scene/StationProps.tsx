import { useMemo } from 'react'
import * as THREE from 'three'
import { STATION } from '../world/sceneStation'
import { BRUSH_FONT, TILE, WBox, canvasTexture, planeGeo, seeded, useMats } from './kit'
import { Wall, type Opening } from './House'
import { windSway } from './Plants'
import type { Quality } from '../store'

// 小火車站的靜態部分（MergeStatic 會合併）：站房、月台、雨棚、鐵軌、水塔、五分車、號誌、甘蔗田。
// 會亮、會動、會淡出的東西在 Station.tsx。

const S = STATION
const H = S.house
const P = S.platform

// ---------------------------------------------------------------------------
// 共用材質
// ---------------------------------------------------------------------------

/** 日式車站的深灰瓦（用紅瓦貼圖染灰） */
export function useStationMats() {
  const mats = useMats()
  return useMemo(() => {
    // 深灰瓦：拿掉紅瓦的顏色貼圖，只留法線（瓦片的起伏）
    const roof = mats.roof.clone()
    roof.map = null
    roof.color.set('#565c66')
    const concrete = mats.yard.clone()
    concrete.color.set('#b8b3a8')
    const ballast = mats.stone.clone()
    ballast.color.set('#8a857c')
    const paint = new THREE.MeshStandardMaterial({ color: '#e9e2cc', roughness: 0.75 })
    const green = new THREE.MeshStandardMaterial({ color: '#56745f', roughness: 0.7 })
    const rail = new THREE.MeshStandardMaterial({ color: '#5a524c', roughness: 0.45, metalness: 0.6 })
    const sleeper = new THREE.MeshStandardMaterial({ color: '#4a3b30', roughness: 0.95 })
    const yellow = new THREE.MeshStandardMaterial({ color: '#e6c23a', roughness: 0.7 })
    const loco = new THREE.MeshStandardMaterial({ color: '#e38a2a', roughness: 0.55, metalness: 0.2 })
    const locoDark = new THREE.MeshStandardMaterial({ color: '#2d2a28', roughness: 0.6, metalness: 0.3 })
    const iron = new THREE.MeshStandardMaterial({ color: '#4a4640', roughness: 0.6, metalness: 0.5 })
    const cane = new THREE.MeshStandardMaterial({ color: '#8a7a4a', roughness: 0.9 })
    return { roof, concrete, ballast, paint, green, rail, sleeper, yellow, loco, locoDark, iron, cane }
  }, [mats])
}

// ---------------------------------------------------------------------------
// 地面：草地、站前泥土路、站前廣場、碎石道床
// ---------------------------------------------------------------------------

export function StationGrounds() {
  const mats = useMats()
  const sm = useStationMats()
  const mud = useMemo(() => {
    const m = mats.mud.clone()
    m.color.set('#9d8a6c')
    return m
  }, [mats])
  return (
    <group>
      <mesh geometry={planeGeo(200, 200, TILE.grass)} material={mats.grass} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow />
      {/* 站前的泥土路（東西向，兩頭接出口） */}
      <mesh geometry={planeGeo(120, S.roadWidth, TILE.mud)} material={mud} rotation-x={-Math.PI / 2} position={[0, 0.015, S.roadZ]} receiveShadow />
      {/* 站前廣場：洗石子地 */}
      <mesh geometry={planeGeo(H.x1 - H.x0 + 2, 2.2, TILE.yard)} material={sm.concrete} rotation-x={-Math.PI / 2} position={[0, 0.02, H.z1 + 1.1]} receiveShadow />
      {/* 主線與側線的碎石道床 */}
      <mesh geometry={planeGeo(120, 2.6, TILE.stone)} material={sm.ballast} rotation-x={-Math.PI / 2} position={[0, 0.03, S.trackZ]} receiveShadow />
      <mesh geometry={planeGeo(S.siding.x1 - S.siding.x0 + 6, 2.0, TILE.stone)} material={sm.ballast} rotation-x={-Math.PI / 2} position={[(S.siding.x0 + S.siding.x1) / 2 - 3, 0.025, S.siding.z]} receiveShadow />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 鐵軌：枕木用 InstancedMesh，鋼軌是長條
// ---------------------------------------------------------------------------

function Track({ z, x0, x1 }: { z: number; x0: number; x1: number }) {
  const sm = useStationMats()
  const geo = useMemo(() => new THREE.BoxGeometry(0.22, 0.12, 2.0), [])
  const sleepers = useMemo(() => {
    const n = Math.floor((x1 - x0) / 0.62)
    const im = new THREE.InstancedMesh(geo, sm.sleeper, n)
    const m = new THREE.Matrix4()
    const r = seeded(Math.round(z * 100) + 7)
    for (let i = 0; i < n; i++) {
      m.makeRotationY((r() - 0.5) * 0.05)
      m.setPosition(x0 + 0.31 + i * 0.62, 0.1, z)
      im.setMatrixAt(i, m)
    }
    im.receiveShadow = true
    return im
  }, [geo, sm.sleeper, x0, x1, z])
  return (
    <group>
      <primitive object={sleepers} />
      {[-1, 1].map((s) => (
        <mesh key={s} material={sm.rail} position={[(x0 + x1) / 2, 0.22, z + (s * S.gauge) / 2]} castShadow receiveShadow>
          <boxGeometry args={[x1 - x0, 0.1, 0.07]} />
        </mesh>
      ))}
    </group>
  )
}

export function Tracks() {
  return (
    <group>
      <Track z={S.trackZ} x0={-60} x1={60} />
      <Track z={S.siding.z} x0={S.siding.x0} x1={S.siding.x1} />
      {/* 側線盡頭的車擋 */}
      <WBox mat="redPaint" size={[0.3, 0.7, 1.6]} position={[S.siding.x1 + 0.25, 0.35, S.siding.z]} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 站房：木板牆、石砌牆裙、深灰瓦、正面的站名牌與大鐘、售票口；裡面是候車室
// ---------------------------------------------------------------------------

const FRONT_OPENINGS: Opening[] = [
  { c: 0, w: 1.9, y0: 0, y1: 2.35 },
  { c: -3.4, w: 1.0, y0: 0.9, y1: 1.65 },
  { c: 3.2, w: 1.5, y0: 1.0, y1: 2.1 },
]
const SIDE_OPENINGS: Opening[] = [{ c: (H.z0 + H.z1) / 2, w: 1.3, y0: 1.0, y1: 2.1 }]

export function nameTexture(text: string, sub: string, bg = '#1c1a18', fg = '#f4efe2') {
  return canvasTexture(
    1024,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = fg
      ctx.lineWidth = 8
      ctx.strokeRect(14, 14, w - 28, h - 28)
      ctx.fillStyle = fg
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `700 132px ${BRUSH_FONT}`
      ctx.fillText(text, w / 2, h / 2 - 20)
      ctx.font = `500 42px ${BRUSH_FONT}`
      ctx.fillText(sub, w / 2, h - 50)
    },
    [{ spec: `700 132px ${BRUSH_FONT}`, text: text + sub }],
  )
}

/** 月台上的站名牌：白底黑字、下面是前後站 */
function stationSignTexture() {
  return canvasTexture(
    1024,
    420,
    (ctx, w, h) => {
      ctx.fillStyle = '#f7f4ea'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#1b2f5a'
      ctx.fillRect(0, h - 120, w, 8)
      ctx.fillStyle = '#1c1c1c'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `700 170px ${BRUSH_FONT}`
      ctx.fillText('後 壁 厝', w / 2, 140)
      ctx.font = `500 44px "Noto Sans TC", sans-serif`
      ctx.fillText('HOUBICUO', w / 2, 262)
      ctx.font = `500 50px ${BRUSH_FONT}`
      ctx.textAlign = 'left'
      ctx.fillText('← 老街口', 40, h - 55)
      ctx.textAlign = 'right'
      ctx.fillText('阿春厝 →', w - 40, h - 55)
    },
    [{ spec: `700 170px ${BRUSH_FONT}`, text: '後壁厝老街口阿春厝' }],
  )
}

/** 時刻表：一格一格的班次，最後一行是紅字手寫的末班車 */
function timetableTexture() {
  return canvasTexture(
    512,
    640,
    (ctx, w, h) => {
      ctx.fillStyle = '#20372c'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#d8d0b0'
      ctx.lineWidth = 6
      ctx.strokeRect(10, 10, w - 20, h - 20)
      ctx.fillStyle = '#f0e8c8'
      ctx.textAlign = 'center'
      ctx.font = `700 54px ${BRUSH_FONT}`
      ctx.fillText('列車時刻表', w / 2, 76)
      ctx.font = `500 36px ${BRUSH_FONT}`
      const rows = [
        ['06:12', '往 老街口'],
        ['07:40', '往 阿春厝'],
        ['11:05', '往 老街口'],
        ['15:30', '往 阿春厝'],
        ['18:20', '往 老街口'],
      ]
      rows.forEach(([t, d], i) => {
        const y = 150 + i * 72
        ctx.textAlign = 'left'
        ctx.fillText(t, 50, y)
        ctx.textAlign = 'right'
        ctx.fillText(d, w - 50, y)
        ctx.fillStyle = 'rgba(240,232,200,0.25)'
        ctx.fillRect(40, y + 18, w - 80, 2)
        ctx.fillStyle = '#f0e8c8'
      })
      // 末班車：紅色毛筆字，像是後來才寫上去的
      ctx.fillStyle = '#e04a3a'
      ctx.font = `700 44px ${BRUSH_FONT}`
      ctx.save()
      ctx.translate(w / 2, 540)
      ctx.rotate(-0.04)
      ctx.textAlign = 'center'
      ctx.fillText('24:00　末班（不收票）', 0, 0)
      ctx.restore()
    },
    [{ spec: `700 54px ${BRUSH_FONT}`, text: '列車時刻表往老街口阿春厝末班不收票' }],
  )
}

export function StationHouse() {
  const mats = useMats()
  const sm = useStationMats()
  const plaque = useMemo(() => nameTexture('後壁厝驛', '後 壁 厝 車 站'), [])
  const ridgeY = H.wallTop + ((H.z1 - H.z0) / 2) * 0.5
  const midZ = (H.z0 + H.z1) / 2
  const halfD = (H.z1 - H.z0) / 2 + 0.6
  const slopeLen = Math.hypot(halfD, ridgeY - H.wallTop + 0.3)
  const tilt = Math.atan2(ridgeY - H.wallTop + 0.3, halfD)
  return (
    <group>
      <Wall axis="x" from={H.x0} to={H.x1} at={H.z1} base={0.16} top={H.wallTop} mat="wood" openings={FRONT_OPENINGS} skirtH={0.55} />
      <Wall axis="x" from={H.x0} to={H.x1} at={H.z0} base={0.16} top={H.wallTop} mat="wood" skirtH={0.55} />
      {[H.x0, H.x1].map((x) => (
        <Wall key={x} axis="z" from={H.z0} to={H.z1} at={x} base={0.16} top={H.wallTop} mat="wood" openings={SIDE_OPENINGS} skirtH={0.55} />
      ))}
      {/* 白色的屋簷橫板、窗框 */}
      <WBox mat="trim" size={[H.x1 - H.x0 + 0.4, 0.22, 0.12]} position={[0, H.wallTop - 0.11, H.z1 + 0.18]} castShadow={false} />
      {[
        [-3.4, 1.28, 1.1, 0.85],
        [3.2, 1.55, 1.6, 1.2],
      ].map(([x, y, w, h], i) => (
        <group key={i} position={[x, y, H.z1 + 0.16]}>
          <WBox mat="trim" size={[w + 0.1, 0.07, 0.06]} position={[0, h / 2, 0]} castShadow={false} />
          <WBox mat="trim" size={[w + 0.1, 0.07, 0.06]} position={[0, -h / 2, 0]} castShadow={false} />
          <WBox mat="trim" size={[0.07, h, 0.06]} position={[-w / 2, 0, 0]} castShadow={false} />
          <WBox mat="trim" size={[0.07, h, 0.06]} position={[w / 2, 0, 0]} castShadow={false} />
          <WBox mat="trim" size={[0.04, h, 0.05]} position={[0, 0, 0]} castShadow={false} />
        </group>
      ))}
      {/* 售票口的小檯子 */}
      <WBox mat="darkWood" size={[1.2, 0.08, 0.36]} position={[-3.4, 0.9, H.z1 + 0.28]} />
      {/* 大門上方的站名牌 */}
      <mesh position={[0, 2.7, H.z1 + 0.17]}>
        <planeGeometry args={[2.4, 0.6]} />
        <meshStandardMaterial map={plaque} roughness={0.6} />
      </mesh>
      {/* 屋頂：深灰瓦、兩面坡，前後出簷 */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          material={sm.roof}
          position={[0, (H.wallTop + ridgeY) / 2 + 0.1, midZ + (s * halfD) / 2]}
          rotation={[s * tilt, 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[H.x1 - H.x0 + 1.2, 0.14, slopeLen]} />
        </mesh>
      ))}
      <WBox mat="ridge" size={[H.x1 - H.x0 + 1.25, 0.22, 0.26]} position={[0, ridgeY + 0.35, midZ]} />
      {/* 兩側的山牆（木板） */}
      {[H.x0, H.x1].map((x) => (
        <mesh key={x} material={mats.wood} position={[x, 0, midZ]} rotation={[0, x < 0 ? -Math.PI / 2 : Math.PI / 2, 0]} castShadow>
          <shapeGeometry args={[gableShape(H.z1 - H.z0, H.wallTop - 0.02, ridgeY + 0.2)]} />
        </mesh>
      ))}
    </group>
  )
}

/** 候車室：地板、長椅、售票櫃台、舊地圖（站房的牆和屋頂淡出時，這些還在） */
export function StationHall() {
  const sm = useStationMats()
  const midZ = (H.z0 + H.z1) / 2
  return (
    <group>
      <mesh geometry={planeGeo(H.x1 - H.x0, H.z1 - H.z0, TILE.tile)} material={sm.concrete} rotation-x={-Math.PI / 2} position={[0, 0.18, midZ]} receiveShadow />
      <WBox mat="stone" size={[H.x1 - H.x0 + 0.3, 0.16, H.z1 - H.z0 + 0.3]} position={[0, 0.08, midZ]} castShadow={false} />
      <WaitingRoom />
    </group>
  )
}

function gableShape(depth: number, y0: number, y1: number) {
  const s = new THREE.Shape()
  s.moveTo(-depth / 2, y0)
  s.lineTo(depth / 2, y0)
  s.lineTo(0, y1)
  s.closePath()
  return s
}

/** 候車室：兩排木長椅、售票櫃台、牆上的舊地圖 */
function WaitingRoom() {
  const mats = useMats()
  const map = useMemo(
    () =>
      canvasTexture(512, 360, (ctx, w, h) => {
        ctx.fillStyle = '#e8dcb8'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#7a5a3a'
        ctx.lineWidth = 6
        ctx.strokeRect(8, 8, w - 16, h - 16)
        // 鐵路線：一條彎彎的黑白線，幾個站點
        ctx.strokeStyle = '#2a2a2a'
        ctx.lineWidth = 10
        ctx.beginPath()
        ctx.moveTo(40, 280)
        ctx.bezierCurveTo(160, 200, 300, 300, 470, 90)
        ctx.stroke()
        ctx.strokeStyle = '#f4efe2'
        ctx.setLineDash([16, 16])
        ctx.lineWidth = 5
        ctx.stroke()
        ctx.setLineDash([])
        const stops: [number, number, string][] = [
          [60, 266, '老街口'],
          [230, 262, '後壁厝'],
          [410, 150, '阿春厝'],
        ]
        ctx.font = `700 30px ${BRUSH_FONT}`
        for (const [x, y, n] of stops) {
          ctx.fillStyle = '#c0332a'
          ctx.beginPath()
          ctx.arc(x, y, 12, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#2a2a2a'
          ctx.fillText(n, x - 40, y - 28)
        }
        ctx.font = `700 40px ${BRUSH_FONT}`
        ctx.fillText('臺糖 鐵道路線圖', 110, 60)
      }, [{ spec: `700 40px ${BRUSH_FONT}`, text: '臺糖鐵道路線圖老街口後壁厝阿春厝' }]),
    [],
  )
  return (
    <group>
      {[-2.6, 2.6].map((x) => (
        <group key={x} position={[x, 0.18, -7.4]}>
          <WBox mat="wood" size={[2.3, 0.07, 0.42]} position={[0, 0.44, 0]} />
          <WBox mat="wood" size={[2.3, 0.5, 0.06]} position={[0, 0.72, -0.2]} />
          {[-1, 1].map((s) => (
            <WBox key={s} mat="darkWood" size={[0.07, 0.44, 0.4]} position={[s * 1.05, 0.22, 0]} />
          ))}
        </group>
      ))}
      {/* 售票櫃台（在售票口後面） */}
      <WBox mat="darkWood" size={[0.7, 1.0, 1.5]} position={[-4.15, 0.68, -5.5]} />
      <WBox mat="wood" size={[0.8, 0.06, 1.6]} position={[-4.15, 1.2, -5.5]} />
      <mesh position={[0, 1.9, H.z0 + 0.17]}>
        <planeGeometry args={[1.8, 1.26]} />
        <meshStandardMaterial map={map} roughness={0.8} />
      </mesh>
      <WBox mat="darkWood" size={[1.9, 1.36, 0.04]} position={[0, 1.9, H.z0 + 0.155]} castShadow={false} />
      {/* 天花板吊的日光燈座 */}
      <WBox mat="trim" size={[1.4, 0.06, 0.16]} position={[0, H.wallTop - 0.25, -6.3]} castShadow={false} />
      <mesh material={mats.metal} position={[0, H.wallTop - 0.12, -6.3]}>
        <cylinderGeometry args={[0.01, 0.01, 0.22, 4]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 月台：水泥月台、黃色警戒線、斜坡、長椅、燈柱、站名牌、時刻表
// ---------------------------------------------------------------------------

export function Platform() {
  const sm = useStationMats()
  const sign = useMemo(stationSignTexture, [])
  const table = useMemo(timetableTexture, [])
  const w = P.x1 - P.x0
  const d = P.z1 - P.z0
  const cz = (P.z0 + P.z1) / 2
  return (
    <group>
      <mesh material={sm.concrete} position={[0, P.y / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[w, P.y, d]} />
      </mesh>
      {/* 月台邊的石條、黃色警戒線 */}
      <mesh material={sm.paint} position={[0, P.y + 0.005, P.z1 - 0.12]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w, 0.24]} />
      </mesh>
      <mesh material={sm.yellow} position={[0, P.y + 0.006, P.z1 - 0.62]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w, 0.1]} />
      </mesh>
      {/* 兩頭的斜坡 */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={sm.concrete} position={[s * (w / 2 + 0.7), P.y / 2 - 0.12, cz]} rotation={[0, 0, s * -0.36]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.2, d]} />
        </mesh>
      ))}
      {/* 長椅 */}
      {S.benches.map((x) => (
        <group key={x} position={[x, P.y, S.benchZ]}>
          <WBox mat="wood" size={[1.5, 0.06, 0.38]} position={[0, 0.42, 0]} />
          <WBox mat="wood" size={[1.5, 0.3, 0.05]} position={[0, 0.68, -0.18]} />
          {[-0.65, 0.65].map((bx) => (
            <mesh key={bx} material={sm.iron} position={[bx, 0.21, 0]} castShadow>
              <boxGeometry args={[0.05, 0.42, 0.34]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 站名牌（兩根柱子撐著） */}
      <group position={[S.nameBoard.x, P.y, S.nameBoard.z]}>
        {[-0.78, 0.78].map((x) => (
          <mesh key={x} material={sm.iron} position={[x, 0.95, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 1.9, 8]} />
          </mesh>
        ))}
        <mesh position={[0, 1.62, 0.03]}>
          <planeGeometry args={[1.72, 0.7]} />
          <meshStandardMaterial map={sign} roughness={0.7} />
        </mesh>
        <mesh material={sm.iron} position={[0, 1.62, 0.0]}>
          <boxGeometry args={[1.8, 0.78, 0.04]} />
        </mesh>
      </group>
      {/* 時刻表 */}
      <group position={[S.timetable.x, P.y, S.timetable.z]}>
        {[-0.55, 0.55].map((x) => (
          <mesh key={x} material={sm.iron} position={[x, 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 1.6, 8]} />
          </mesh>
        ))}
        <mesh position={[0, 1.45, 0.03]}>
          <planeGeometry args={[0.9, 1.12]} />
          <meshStandardMaterial map={table} roughness={0.8} />
        </mesh>
        <WBox mat="darkWood" size={[1.0, 1.22, 0.05]} position={[0, 1.45, 0]} castShadow={false} />
      </group>
    </group>
  )
}

/** 雨棚：木柱、斜撐，屋面往鐵軌那邊斜（包在 Fader 裡） */
export function Canopy() {
  const sm = useStationMats()
  const C = S.canopy
  const len = P.z1 + 0.3 - (C.postZ - 0.35)
  const cz = (P.z1 + 0.3 + C.postZ - 0.35) / 2
  return (
    <group>
      {C.postXs.map((x) => (
        <group key={x} position={[x, P.y, C.postZ]}>
          <mesh material={sm.green} position={[0, (C.y - P.y) / 2, 0]} castShadow>
            <boxGeometry args={[0.16, C.y - P.y, 0.16]} />
          </mesh>
          {/* 往前伸的懸臂 */}
          <mesh material={sm.green} position={[0, C.y - P.y - 0.12, 1.2]} rotation={[0.08, 0, 0]} castShadow>
            <boxGeometry args={[0.1, 0.12, 2.6]} />
          </mesh>
          <mesh material={sm.green} position={[0, C.y - P.y - 0.55, 0.45]} rotation={[-0.75, 0, 0]}>
            <boxGeometry args={[0.07, 0.07, 1.1]} />
          </mesh>
        </group>
      ))}
      <mesh material={sm.roof} position={[0, C.y + 0.02, cz]} rotation={[0.1, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[C.x1 - C.x0, 0.08, len]} />
      </mesh>
      <mesh material={sm.paint} position={[0, C.y - 0.1, P.z1 + 0.28]} castShadow={false}>
        <boxGeometry args={[C.x1 - C.x0, 0.2, 0.04]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 水塔：四根鐵腳、交叉斜撐、木桶、圓錐頂、爬梯
// ---------------------------------------------------------------------------

export function WaterTower() {
  const sm = useStationMats()
  const mats = useMats()
  const T = S.tower
  return (
    <group position={[T.x, 0, T.z]}>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} material={sm.iron} position={[sx * 0.85, 2.0, sz * 0.85]} castShadow>
            <cylinderGeometry args={[0.07, 0.09, 4.0, 8]} />
          </mesh>
        )),
      )}
      {[0.9, 2.4].map((y) =>
        [0, Math.PI / 2].map((ry) => (
          <mesh key={`${y}${ry}`} material={sm.iron} position={[0, y + 0.6, 0]} rotation={[0, ry, 0]}>
            <boxGeometry args={[0.04, 1.4, 1.7]} />
          </mesh>
        )),
      )}
      <mesh material={mats.darkWood} position={[0, 4.75, 0]} castShadow>
        <cylinderGeometry args={[1.3, 1.25, 1.5, 20]} />
      </mesh>
      {[4.2, 4.75, 5.3].map((y) => (
        <mesh key={y} material={sm.iron} position={[0, y, 0]}>
          <cylinderGeometry args={[1.32, 1.32, 0.06, 20]} />
        </mesh>
      ))}
      <mesh material={sm.roof} position={[0, 5.85, 0]} castShadow>
        <coneGeometry args={[1.45, 0.7, 20]} />
      </mesh>
      {/* 爬梯 */}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} material={sm.iron} position={[x, 2.6, 1.0]}>
          <boxGeometry args={[0.03, 5.2, 0.03]} />
        </mesh>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} material={sm.iron} position={[0, 0.4 + i * 0.35, 1.0]}>
          <boxGeometry args={[0.36, 0.025, 0.025]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 五分車：小小的橘色柴油火車頭＋四節甘蔗車（鐵架子上堆滿甘蔗）
// ---------------------------------------------------------------------------

export function CaneTrain() {
  const sm = useStationMats()
  const Z = S.siding.z
  const loco = S.cane.locoX
  const caneGeo = useMemo(() => {
    // 一堆甘蔗：很多根細長的圓柱，隨機一點
    const r = seeded(4411)
    const g: THREE.BufferGeometry[] = []
    for (let i = 0; i < 46; i++) {
      const c = new THREE.CylinderGeometry(0.035, 0.035, 2.2, 5)
      c.rotateZ(Math.PI / 2 + (r() - 0.5) * 0.12)
      c.rotateY((r() - 0.5) * 0.1)
      c.translate((r() - 0.5) * 0.15, 0.1 + Math.floor(i / 12) * 0.075 + r() * 0.03, -0.42 + (i % 12) * 0.075)
      g.push(c)
    }
    return mergeGeos(g)
  }, [])
  return (
    <group>
      {/* 火車頭：車身、駕駛室、引擎蓋、排氣管、車燈、車輪 */}
      <group position={[loco, 0.24, Z]}>
        <mesh material={sm.locoDark} position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[2.5, 0.25, 1.1]} />
        </mesh>
        <mesh material={sm.loco} position={[0.45, 0.72, 0]} castShadow>
          <boxGeometry args={[1.5, 0.8, 0.95]} />
        </mesh>
        <mesh material={sm.loco} position={[-0.72, 0.95, 0]} castShadow>
          <boxGeometry args={[0.95, 1.25, 1.05]} />
        </mesh>
        <mesh material={sm.locoDark} position={[-0.72, 1.62, 0]} castShadow>
          <boxGeometry args={[1.1, 0.08, 1.2]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={sm.locoDark} position={[-0.72, 1.1, s * 0.53]}>
            <boxGeometry args={[0.55, 0.42, 0.02]} />
          </mesh>
        ))}
        <mesh material={sm.locoDark} position={[0.8, 1.3, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.4, 10]} />
        </mesh>
        <mesh material={sm.yellow} position={[1.21, 0.62, 0]}>
          <boxGeometry args={[0.04, 0.12, 0.9]} />
        </mesh>
        {[-0.65, 0.65].map((x) =>
          [-1, 1].map((s) => (
            <mesh key={`${x}${s}`} material={sm.iron} position={[x, 0.05, s * 0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.22, 0.22, 0.08, 14]} />
            </mesh>
          )),
        )}
      </group>
      {/* 甘蔗車 */}
      {S.cane.wagons.map((x, i) => (
        <group key={x} position={[x, 0.24, Z]}>
          <mesh material={sm.iron} position={[0, 0.22, 0]} castShadow>
            <boxGeometry args={[2.3, 0.1, 1.0]} />
          </mesh>
          {[-1.05, -0.35, 0.35, 1.05].map((px) =>
            [-1, 1].map((s) => (
              <mesh key={`${px}${s}`} material={sm.iron} position={[px, 0.62, s * 0.48]}>
                <boxGeometry args={[0.05, 0.8, 0.05]} />
              </mesh>
            )),
          )}
          <mesh geometry={caneGeo} material={sm.cane} position={[0, 0.28, 0]} rotation={[0, i % 2 ? 0.03 : -0.02, 0]} castShadow />
          {[-0.75, 0.75].map((px) =>
            [-1, 1].map((s) => (
              <mesh key={`w${px}${s}`} material={sm.iron} position={[px, 0.04, s * 0.48]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.18, 0.18, 0.06, 12]} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  )
}

/** 把幾個幾何合成一個（只有 position／normal／uv） */
export function mergeGeos(list: THREE.BufferGeometry[]) {
  let n = 0
  let idx = 0
  for (const g of list) {
    n += g.attributes.position.count
    idx += g.index ? g.index.count : g.attributes.position.count
  }
  const pos = new Float32Array(n * 3)
  const nor = new Float32Array(n * 3)
  const uv = new Float32Array(n * 2)
  const index: number[] = []
  let off = 0
  for (const g of list) {
    const p = g.attributes.position as THREE.BufferAttribute
    const nn = g.attributes.normal as THREE.BufferAttribute
    const u = g.attributes.uv as THREE.BufferAttribute
    pos.set(p.array as Float32Array, off * 3)
    nor.set(nn.array as Float32Array, off * 3)
    if (u) uv.set(u.array as Float32Array, off * 2)
    if (g.index) for (let i = 0; i < g.index.count; i++) index.push(g.index.getX(i) + off)
    else for (let i = 0; i < p.count; i++) index.push(i + off)
    off += p.count
    g.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  out.setIndex(index)
  return out
}

// ---------------------------------------------------------------------------
// 號誌：鐵柱、上面兩盞燈（亮不亮在 Station.tsx）
// ---------------------------------------------------------------------------

export function SignalPosts() {
  const sm = useStationMats()
  return (
    <group>
      {S.signals.map(([x, z]) => (
        <group key={x} position={[x, 0, z]}>
          <mesh material={sm.iron} position={[0, 1.6, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 3.2, 8]} />
          </mesh>
          <mesh material={sm.locoDark} position={[0, 3.05, 0.08]} castShadow>
            <boxGeometry args={[0.36, 0.8, 0.2]} />
          </mesh>
          {/* 紅白條紋的底座 */}
          {[0.25, 0.75].map((y, i) => (
            <mesh key={y} material={i ? sm.paint : sm.yellow} position={[0, y, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.5, 8]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 甘蔗田：一叢一叢的甘蔗（InstancedMesh、會隨風擺），站房北邊一大片
// ---------------------------------------------------------------------------

function caneClumpGeometry() {
  const r = seeded(9091)
  const g: THREE.BufferGeometry[] = []
  // 幾根甘蔗桿
  for (let i = 0; i < 5; i++) {
    const h = 2.2 + r() * 0.8
    const c = new THREE.CylinderGeometry(0.035, 0.045, h, 5)
    c.translate((r() - 0.5) * 0.5, h / 2, (r() - 0.5) * 0.5)
    g.push(c)
  }
  // 上半部的長葉子（交叉的彎曲片）
  for (let i = 0; i < 10; i++) {
    const p = new THREE.PlaneGeometry(0.16, 1.4, 1, 4)
    const pos = p.attributes.position as THREE.BufferAttribute
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k) + 0.7
      pos.setZ(k, pos.getZ(k) + y * y * 0.35)
    }
    p.rotateX(-0.5)
    p.rotateY((i / 10) * Math.PI * 2 + r() * 0.4)
    p.translate((r() - 0.5) * 0.4, 1.8 + r() * 0.7, (r() - 0.5) * 0.4)
    g.push(p)
  }
  const out = mergeGeos(g)
  // 隨風擺（windSway 讀 aSway：x 是擺幅（越高越大）、y 是相位）
  const pos = out.attributes.position as THREE.BufferAttribute
  const sway = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 3
    sway[i * 2] = y * y
    sway[i * 2 + 1] = pos.getX(i) * 1.7 + pos.getZ(i)
  }
  out.setAttribute('aSway', new THREE.BufferAttribute(sway, 2))
  return out
}

export function CaneFields({ quality }: { quality: Quality }) {
  const geo = useMemo(caneClumpGeometry, [])
  const mat = useMemo(() => windSway(new THREE.MeshStandardMaterial({ color: '#6f8a3e', roughness: 0.9, side: THREE.DoubleSide }), 0.12), [])
  const mesh = useMemo(() => {
    const r = seeded(3131)
    const spots: [number, number, number][] = []
    const add = (x0: number, x1: number, z0: number, z1: number, step: number) => {
      for (let x = x0; x < x1; x += step)
        for (let z = z0; z < z1; z += step) {
          if (r() < 0.12) continue
          spots.push([x + (r() - 0.5) * step * 0.8, z + (r() - 0.5) * step * 0.8, 0.8 + r() * 0.45])
        }
    }
    const step = quality === 'high' ? 1.05 : 1.45
    // 站房與水塔後面（北邊），留出五分車的側線
    add(-44, 44, -24, -10.2, step)
    // 月台東西兩頭再過去一點（北半邊）
    add(-44, -22.5, -9.8, -5.8, step)
    add(22.5, 44, -9.8, -5.8, step)
    const im = new THREE.InstancedMesh(geo, mat, spots.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    spots.forEach(([x, z, s], i) => {
      e.set(0, r() * Math.PI * 2, 0)
      q.setFromEuler(e)
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * (0.9 + r() * 0.25), s))
      im.setMatrixAt(i, m)
    })
    im.castShadow = true
    im.receiveShadow = true
    return im
  }, [geo, mat, quality])
  return <primitive object={mesh} />
}

/** 幾叢甘蔗（給家門前的路邊用；位置由呼叫的人給） */
export function CaneClumps({ spots }: { spots: [number, number, number][] }) {
  const geo = useMemo(caneClumpGeometry, [])
  const mat = useMemo(() => windSway(new THREE.MeshStandardMaterial({ color: '#6f8a3e', roughness: 0.9, side: THREE.DoubleSide }), 0.12), [])
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(geo, mat, spots.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    spots.forEach(([x, z, sc], i) => {
      e.set(0, i * 2.3, 0)
      q.setFromEuler(e)
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(sc, sc, sc))
      im.setMatrixAt(i, m)
    })
    im.castShadow = true
    return im
  }, [geo, mat, spots])
  return <primitive object={mesh} />
}
