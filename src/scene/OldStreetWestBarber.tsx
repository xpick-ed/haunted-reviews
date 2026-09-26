import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { OLDSTREET } from '../world/sceneOldStreet'
import { OSW, RADIO_CHANNELS, mirrorState, radioState } from '../world/osWest'
import { lanternAt } from './daylight'
import { BRUSH_FONT, TILE, WBox, boxGeo, canvasTexture, useMats } from './kit'
import { Chibi, ChibiNpc, SEAT_Y, newDrive, type Drive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import '../chars/specs.oswest'
import '../chars/specs.past'

// 新美理髮廳的店裡（DESIGN §30）：外殼淡出以後看得到。規則與座標在 src/world/osWest.ts。
// 綠白格子地磚、半面薄荷綠磁磚牆、整面大鏡子＋鏡台、兩張紅皮理髮椅、洗頭台、毛巾蒸籠、真空管收音機、
// 月曆美女、吊扇。傍晚阿坤師（活人）在磨剃刀；晚上他爸爸阿水師（鬼）幫好兄弟修面。

const O = OLDSTREET
const A = O.arcade
const FLOOR = 0.14
const B = OSW.barber
const BZ = OSW.backZ
const FZ0 = OSW.frontZ0
const IN_W = B.in.x1 - B.in.x0
const IN_D = FZ0 - BZ
const CX = (B.in.x0 + B.in.x1) / 2
const CZ = (BZ + FZ0) / 2

// ---------------------------------------------------------------------------
// 貼圖
// ---------------------------------------------------------------------------

/** 綠白相間的格子地磚 */
function checkerTexture() {
  const t = canvasTexture(128, 128, (ctx, w, h) => {
    const n = 4
    const s = w / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#2f6a55' : '#ece6d4'
        ctx.fillRect(i * s, j * s, s, s)
      }
    // 磨石子的小斑點
    for (let k = 0; k < 400; k++) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.12})`
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(IN_W / 1.2, IN_D / 1.2)
  return t
}

/** 牆下半部的薄荷綠小磁磚 */
function tileTexture() {
  const t = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8efe6'
    ctx.fillRect(0, 0, w, h)
    const n = 8
    const s = w / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = `hsl(150, 30%, ${70 + ((i * 7 + j * 3) % 5) * 2}%)`
        ctx.fillRect(i * s + 1, j * s + 1, s - 2, s - 2)
      }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** 鏡子：灰藍色、斜斜的反光 */
function mirrorTexture() {
  return canvasTexture(512, 160, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#a9bcc4')
    g.addColorStop(0.5, '#7f959e')
    g.addColorStop(1, '#9fb3bb')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // 鏡子裡模模糊糊的店（對面的櫥窗、燈）
    ctx.fillStyle = 'rgba(255, 240, 210, 0.25)'
    ctx.fillRect(w * 0.12, h * 0.25, w * 0.2, h * 0.45)
    ctx.fillStyle = 'rgba(40, 90, 70, 0.25)'
    ctx.fillRect(0, h * 0.78, w, h * 0.22)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 10
    for (const x of [0.22, 0.27, 0.66]) {
      ctx.beginPath()
      ctx.moveTo(w * x, h)
      ctx.lineTo(w * (x + 0.12), 0)
      ctx.stroke()
    }
  })
}

/** 月曆美女（民國五十八年）：燙捲髮、旗袍領，旁邊是月曆 */
function calendarTexture() {
  return canvasTexture(
    192,
    288,
    (ctx, w, h) => {
      ctx.fillStyle = '#f4ecd8'
      ctx.fillRect(0, 0, w, h)
      // 畫：淡粉紅的底、花
      ctx.fillStyle = '#f2c8c0'
      ctx.fillRect(12, 12, w - 24, h * 0.62)
      ctx.fillStyle = '#e8829a'
      for (const [x, y] of [
        [34, 44],
        [150, 70],
        [40, 150],
      ]) {
        ctx.beginPath()
        ctx.arc(x, y, 12, 0, Math.PI * 2)
        ctx.fill()
      }
      // 頭髮（燙捲）、臉、旗袍
      ctx.fillStyle = '#1e1818'
      ctx.beginPath()
      ctx.ellipse(w / 2, 78, 44, 46, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f6d6c0'
      ctx.beginPath()
      ctx.ellipse(w / 2, 88, 30, 36, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1e1818'
      ctx.fillRect(w / 2 - 16, 82, 10, 3)
      ctx.fillRect(w / 2 + 6, 82, 10, 3)
      ctx.fillStyle = '#c8384a'
      ctx.fillRect(w / 2 - 7, 104, 14, 5)
      ctx.fillStyle = '#2a6a8a'
      ctx.beginPath()
      ctx.moveTo(w / 2 - 60, h * 0.62 + 12)
      ctx.quadraticCurveTo(w / 2, 110, w / 2 + 60, h * 0.62 + 12)
      ctx.fill()
      ctx.fillStyle = '#f4d27a'
      ctx.fillRect(w / 2 - 12, 124, 24, 8)
      // 月曆
      ctx.fillStyle = '#8f2a20'
      ctx.font = `700 22px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('民國五十八年　七月', w / 2, h * 0.62 + 44)
      ctx.fillStyle = '#3a2a20'
      ctx.font = `500 13px ${BRUSH_FONT}`
      for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) ctx.fillText(String(r * 7 + c + 1), 22 + c * 25, h * 0.62 + 70 + r * 18)
    },
    [{ spec: `700 22px ${BRUSH_FONT}`, text: '民國五十八年七月' }],
  )
}

/** 價目表（木牌） */
function priceTexture() {
  return canvasTexture(
    256,
    160,
    (ctx, w, h) => {
      ctx.fillStyle = '#3d271a'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#e9c46a'
      ctx.lineWidth = 5
      ctx.strokeRect(6, 6, w - 12, h - 12)
      ctx.fillStyle = '#f4efe2'
      ctx.font = `700 26px ${BRUSH_FONT}`
      ctx.textAlign = 'left'
      const rows = [
        ['理髮', '十元'],
        ['修面', '五元'],
        ['洗頭', '五元'],
      ]
      rows.forEach(([a, b], i) => {
        ctx.fillText(a, 28, 50 + i * 40)
        ctx.fillText(b, 150, 50 + i * 40)
      })
    },
    [{ spec: `700 26px ${BRUSH_FONT}`, text: '理髮修面洗頭十五元' }],
  )
}

/** 音符（收音機在唱歌時飄出來） */
function noteTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#fff2c8'
    ctx.font = `700 48px serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♪', w / 2, h / 2)
  })
}

// ---------------------------------------------------------------------------
// 理髮椅（紅皮、鍍鉻的座、白琺瑯的腳踏）：面向北邊的鏡子
// ---------------------------------------------------------------------------

function BarberChair({ x, z, mats }: { x: number; z: number; mats: { leather: THREE.Material; chrome: THREE.Material; enamel: THREE.Material } }) {
  return (
    // 本地 -z 是椅子的正面（坐的人面向鏡子）
    <group position={[x, FLOOR, z]}>
      <mesh material={mats.chrome} position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.32, 0.34, 0.06, 20]} />
      </mesh>
      <mesh material={mats.chrome} position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 0.34, 14]} />
      </mesh>
      {/* 油壓的踏板 */}
      <mesh material={mats.chrome} position={[0.26, 0.1, 0.12]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.24, 0.03, 0.06]} />
      </mesh>
      {/* 座墊下的白琺瑯殼 */}
      <mesh material={mats.enamel} position={[0, 0.44, 0]} castShadow>
        <boxGeometry args={[0.6, 0.12, 0.56]} />
      </mesh>
      <mesh material={mats.leather} position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.6, 0.12, 0.56]} />
      </mesh>
      {/* 椅背（往後仰一點）、頭靠 */}
      <group position={[0, 0.6, 0.27]} rotation={[0.14, 0, 0]}>
        <mesh material={mats.leather} position={[0, 0.38, 0]} castShadow>
          <boxGeometry args={[0.58, 0.72, 0.13]} />
        </mesh>
        <mesh material={mats.chrome} position={[0, 0.82, 0.02]}>
          <cylinderGeometry args={[0.018, 0.018, 0.3, 6]} />
        </mesh>
        <mesh material={mats.leather} position={[0, 0.98, 0]} castShadow>
          <boxGeometry args={[0.3, 0.16, 0.14]} />
        </mesh>
      </group>
      {/* 扶手 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.34, 0, 0]}>
          <mesh material={mats.enamel} position={[0, 0.66, -0.02]}>
            <boxGeometry args={[0.08, 0.18, 0.5]} />
          </mesh>
          <mesh material={mats.leather} position={[0, 0.78, -0.02]}>
            <boxGeometry args={[0.11, 0.06, 0.54]} />
          </mesh>
        </group>
      ))}
      {/* 腳踏板 */}
      <mesh material={mats.chrome} position={[0, 0.34, -0.36]} rotation={[0.6, 0, 0]}>
        <boxGeometry args={[0.04, 0.3, 0.04]} />
      </mesh>
      <mesh material={mats.chrome} position={[0, 0.22, -0.46]}>
        <boxGeometry args={[0.46, 0.035, 0.22]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 店裡（靜態的放進 MergeStatic）
// ---------------------------------------------------------------------------

export function BarberInterior() {
  const mats = useMats()
  const floor = useMemo(() => new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.35 }), [])
  const tiles = useMemo(() => {
    const t = tileTexture()
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 })
  }, [])
  const upper = useMemo(() => {
    const m = mats.plaster.clone()
    m.color.set('#f1efe4')
    return m
  }, [mats])
  const mirror = useMemo(() => new THREE.MeshStandardMaterial({ map: mirrorTexture(), roughness: 0.08, metalness: 0.55 }), [])
  const chairMats = useMemo(
    () => ({
      leather: new THREE.MeshStandardMaterial({ color: '#9a1f1f', roughness: 0.38 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#d4d6da', roughness: 0.2, metalness: 0.85 }),
      enamel: new THREE.MeshStandardMaterial({ color: '#efece4', roughness: 0.3 }),
    }),
    [],
  )
  const calendar = useMemo(calendarTexture, [])
  const price = useMemo(priceTexture, [])
  const bottle = useMemo(() => ['#3a7ac0', '#e0a040', '#58a86a', '#c8485a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, transparent: true, opacity: 0.85 })), [])
  const barbicide = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f7ad8', roughness: 0.05, transparent: true, opacity: 0.7 }), [])
  const tileH = 1.2
  // 磁磚貼圖依牆的大小重複
  const tilesBack = useMemo(() => {
    const m = tiles.clone()
    m.map = tiles.map!.clone()
    m.map.repeat.set(IN_W / 0.8, tileH / 0.8)
    m.map.needsUpdate = true
    return m
  }, [tiles])
  const tilesSide = useMemo(() => {
    const m = tiles.clone()
    m.map = tiles.map!.clone()
    m.map.repeat.set(IN_D / 0.8, tileH / 0.8)
    m.map.needsUpdate = true
    return m
  }, [tiles])
  const wallH = A.ceilY - FLOOR
  const V = B.vanity
  return (
    <group>
      {/* 地板 */}
      <mesh geometry={boxGeo(IN_W, 0.02, IN_D, 1)} material={floor} position={[CX, FLOOR, CZ]} receiveShadow />
      {/* 後牆（北）：下半磁磚、上半灰泥 */}
      <mesh geometry={boxGeo(IN_W, wallH, 0.24, TILE.plaster)} material={upper} position={[CX, FLOOR + wallH / 2, BZ - 0.12]} receiveShadow />
      <mesh geometry={boxGeo(IN_W, tileH, 0.02, 1)} material={tilesBack} position={[CX, FLOOR + tileH / 2, BZ + 0.01]} />
      {/* 西牆 */}
      <mesh geometry={boxGeo(0.24, wallH, IN_D, TILE.plaster)} material={upper} position={[B.in.x0 - 0.12, FLOOR + wallH / 2, CZ]} receiveShadow />
      <mesh geometry={boxGeo(0.02, tileH, IN_D, 1)} material={tilesSide} position={[B.in.x0 + 0.01, FLOOR + tileH / 2, CZ]} />
      {/* 腰線 */}
      <WBox mat="darkWood" size={[IN_W, 0.05, 0.05]} position={[CX, FLOOR + tileH, BZ + 0.03]} castShadow={false} />
      <WBox mat="darkWood" size={[0.05, 0.05, IN_D]} position={[B.in.x0 + 0.03, FLOOR + tileH, CZ]} castShadow={false} />

      {/* 大鏡子（整面）＋木框 */}
      <mesh material={mirror} position={[(B.mirror.x0 + B.mirror.x1) / 2, FLOOR + (B.mirror.y0 + B.mirror.y1) / 2, BZ + 0.03]}>
        <planeGeometry args={[B.mirror.x1 - B.mirror.x0, B.mirror.y1 - B.mirror.y0]} />
      </mesh>
      <WBox mat="darkWood" size={[B.mirror.x1 - B.mirror.x0 + 0.14, 0.07, 0.06]} position={[(B.mirror.x0 + B.mirror.x1) / 2, FLOOR + B.mirror.y1 + 0.03, BZ + 0.04]} castShadow={false} />
      <WBox mat="darkWood" size={[0.07, B.mirror.y1 - B.mirror.y0, 0.06]} position={[B.mirror.x0 - 0.035, FLOOR + (B.mirror.y0 + B.mirror.y1) / 2, BZ + 0.04]} castShadow={false} />
      <WBox mat="darkWood" size={[0.07, B.mirror.y1 - B.mirror.y0, 0.06]} position={[B.mirror.x1 + 0.035, FLOOR + (B.mirror.y0 + B.mirror.y1) / 2, BZ + 0.04]} castShadow={false} />
      {/* 鏡台：白色檯面、抽屜、上面的瓶瓶罐罐 */}
      <WBox mat="darkWood" size={[V.x1 - V.x0, V.h - 0.05, V.z1 - V.z0]} position={[(V.x0 + V.x1) / 2, FLOOR + (V.h - 0.05) / 2, (V.z0 + V.z1) / 2]} />
      <mesh material={chairMats.enamel} position={[(V.x0 + V.x1) / 2, FLOOR + V.h - 0.02, (V.z0 + V.z1) / 2]}>
        <boxGeometry args={[V.x1 - V.x0 + 0.04, 0.05, V.z1 - V.z0 + 0.04]} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <WBox key={i} mat="gold" size={[0.12, 0.025, 0.02]} position={[V.x0 + 0.4 + i * 0.73, FLOOR + V.h - 0.25, V.z1 + 0.01]} castShadow={false} />
      ))}
      {[
        [-20.7, 0],
        [-20.55, 1],
        [-19.2, 2],
        [-17.0, 3],
        [-16.85, 1],
      ].map(([x, c], i) => (
        <mesh key={i} material={bottle[c]} position={[x, FLOOR + V.h + 0.12, BZ + 0.22]}>
          <cylinderGeometry args={[0.04, 0.05, 0.2, 10]} />
        </mesh>
      ))}
      {/* 泡梳子的藍色消毒水罐 */}
      <mesh material={barbicide} position={[-18.85, FLOOR + V.h + 0.13, BZ + 0.24]}>
        <cylinderGeometry args={[0.08, 0.08, 0.22, 16]} />
      </mesh>
      {[-0.03, 0.02].map((dx, i) => (
        <WBox key={i} mat="black" size={[0.02, 0.2, 0.05]} position={[-18.85 + dx, FLOOR + V.h + 0.28, BZ + 0.24]} rotation={[0, 0, dx * 4]} castShadow={false} />
      ))}
      {/* 爽身粉、刷子、一疊白毛巾 */}
      <mesh position={[-18.2, FLOOR + V.h + 0.1, BZ + 0.2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 12]} />
        <meshStandardMaterial color="#f2e2ea" roughness={0.5} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={chairMats.enamel} position={[-16.95, FLOOR + V.h + 0.04 + i * 0.05, BZ + 0.26]}>
          <boxGeometry args={[0.32, 0.045, 0.22]} />
        </mesh>
      ))}
      {/* 價目表（鏡子上方） */}
      <mesh position={[-18.8, FLOOR + 2.72, BZ + 0.03]}>
        <planeGeometry args={[0.8, 0.5]} />
        <meshStandardMaterial map={price} roughness={0.7} />
      </mesh>

      {/* 兩張理髮椅 */}
      {B.chairs.map((c, i) => (
        <BarberChair key={i} x={c.x} z={c.z} mats={chairMats} />
      ))}

      {/* 洗頭台（東北角）：白瓷的槽、水龍頭 */}
      <group position={[B.sink.x, FLOOR, B.sink.z]}>
        <WBox mat="darkWood" size={[0.7, 0.72, 0.58]} position={[0, 0.36, 0]} />
        <mesh material={chairMats.enamel} position={[0, 0.8, 0]}>
          <boxGeometry args={[0.66, 0.16, 0.54]} />
        </mesh>
        <mesh position={[0, 0.86, 0.02]}>
          <boxGeometry args={[0.48, 0.06, 0.36]} />
          <meshStandardMaterial color="#b8c8cc" roughness={0.2} />
        </mesh>
        <mesh material={chairMats.chrome} position={[0, 1.02, -0.22]}>
          <cylinderGeometry args={[0.02, 0.02, 0.26, 8]} />
        </mesh>
        <mesh material={chairMats.chrome} position={[0, 1.13, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.16, 8]} />
        </mesh>
      </group>

      {/* 西牆的矮櫃：毛巾蒸籠、收音機 */}
      <WBox mat="darkWood" size={[B.cabinet.w, B.cabinet.h, B.cabinet.d]} position={[B.cabinet.x, FLOOR + B.cabinet.h / 2, B.cabinet.z]} />
      <mesh material={chairMats.chrome} position={[B.steamer.x, FLOOR + B.cabinet.h + 0.22, B.steamer.z]} castShadow>
        <boxGeometry args={[0.42, 0.44, 0.42]} />
      </mesh>
      <WBox mat="black" size={[0.03, 0.3, 0.3]} position={[B.steamer.x + 0.215, FLOOR + B.cabinet.h + 0.24, B.steamer.z]} castShadow={false} />
      <mesh position={[B.radio.x, FLOOR + B.cabinet.h + 0.16, B.radio.z]} castShadow>
        <boxGeometry args={[0.3, 0.32, 0.5]} />
        <meshStandardMaterial color="#6a3e22" roughness={0.45} />
      </mesh>
      {/* 收音機的喇叭布 */}
      <mesh position={[B.radio.x + 0.152, FLOOR + B.cabinet.h + 0.2, B.radio.z + 0.07]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.26, 0.18]} />
        <meshStandardMaterial color="#d8c8a0" roughness={0.9} />
      </mesh>

      {/* 月曆美女（西牆）、牆上的剪刀掛勾 */}
      <mesh position={[B.in.x0 + 0.02, FLOOR + 1.95, -8.25]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.52, 0.78]} />
        <meshStandardMaterial map={calendar} roughness={0.8} />
      </mesh>
      {/* 磨刀皮帶掛在牆上 */}
      <WBox mat="darkWood" size={[0.04, 0.6, 0.07]} position={[B.in.x0 + 0.03, FLOOR + 1.45, -7.1]} castShadow={false} />

      {/* 櫥窗下的長椅（等剪頭髮的人坐） */}
      <group position={[B.bench.x, FLOOR, B.bench.z]}>
        <WBox mat="darkWood" size={[B.bench.w, 0.06, B.bench.d]} position={[0, 0.44, 0]} />
        <WBox mat="darkWood" size={[B.bench.w, 0.44, 0.05]} position={[0, 0.7, B.bench.d / 2 - 0.03]} />
        {[-1, 1].map((s) => (
          <WBox key={s} mat="darkWood" size={[0.06, 0.44, B.bench.d - 0.05]} position={[s * (B.bench.w / 2 - 0.1), 0.22, 0]} />
        ))}
        {/* 長椅上的舊報紙 */}
        <mesh position={[0.45, 0.48, -0.02]} rotation={[-Math.PI / 2, 0, 0.3]}>
          <planeGeometry args={[0.42, 0.3]} />
          <meshStandardMaterial color="#e6dfcc" roughness={0.9} />
        </mesh>
      </group>

      {/* 衣帽架 */}
      <group position={[B.coatRack.x, FLOOR, B.coatRack.z]}>
        <WBox mat="darkWood" size={[0.05, 1.75, 0.05]} position={[0, 0.88, 0]} />
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.2, 0.22, 0.05, 12]} />
          <meshStandardMaterial color="#3d271a" roughness={0.7} />
        </mesh>
        {/* 掛著一頂紳士帽 */}
        <mesh position={[0.08, 1.72, 0]}>
          <cylinderGeometry args={[0.1, 0.11, 0.1, 14]} />
          <meshStandardMaterial color="#4a3e36" roughness={0.8} />
        </mesh>
        <mesh position={[0.08, 1.67, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.015, 16]} />
          <meshStandardMaterial color="#4a3e36" roughness={0.8} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 會動的：吊扇、燈、收音機的音符、毛巾蒸籠的熱氣、鏡子裡的年輕阿春、人
// ---------------------------------------------------------------------------

export function BarberLive({ outline }: { outline: boolean }) {
  const phase = useStore((s) => s.phase)
  const night = phase === 'night'
  const fan = useRef<THREE.Group>(null)
  const bulb = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff0c8', toneMapped: false }), [])
  const noteTex = useMemo(noteTexture, [])
  const notes = useRef<(THREE.Sprite | null)[]>([])
  const steam = useRef<(THREE.Mesh | null)[]>([])
  const steamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false }), [])
  const young = useRef<THREE.Group>(null)
  const youngDrive = useRef<Drive>(newDrive({ pose: 'idle', heading: 0, expr: 'happy' }))
  const dial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#5a4020', toneMapped: false }), [])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const l = lanternAt(useStore.getState().time)
    if (fan.current) fan.current.rotation.y += Math.min(dt, 0.1) * 3.2
    bulb.color.setRGB(0.6 + 0.5 * l, 0.55 + 0.45 * l, 0.4 + 0.35 * l)
    // 收音機：剛轉過台的十二秒，刻度盤亮、唱歌台飄音符
    const since = (performance.now() - radioState.at) / 1000
    const on = radioState.ch >= 0 && since < 12
    dial.color.set(on ? '#ffcf7a' : '#5a4020')
    const singing = on && RADIO_CHANNELS[radioState.ch] === 'song'
    notes.current.forEach((sp, i) => {
      if (!sp) return
      sp.visible = singing
      if (!singing) return
      const p = (t * 0.45 + i / 3) % 1
      sp.position.set(B.radio.x + 0.25 + Math.sin(t * 2 + i) * 0.12, FLOOR + B.cabinet.h + 0.35 + p * 0.9, B.radio.z + (i - 1) * 0.12)
      ;(sp.material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI)
    })
    // 毛巾蒸籠：一直冒熱氣
    steam.current.forEach((m, i) => {
      if (!m) return
      const p = (t * 0.35 + i / 3) % 1
      m.position.set(B.steamer.x + Math.sin(t + i * 2) * 0.05, FLOOR + B.cabinet.h + 0.5 + p * 0.6, B.steamer.z + (i - 1) * 0.06)
      m.scale.setScalar(0.06 + p * 0.1)
    })
    steamMat.opacity = 0.22
    // 鏡子裡十八歲的阿春（陰陽眼開著、剛照過鏡子）
    const g = young.current
    if (g) {
      const st = useStore.getState()
      const show = st.vision && (performance.now() < mirrorState.until || st.dialogue?.id === 'mirror_young')
      g.visible = show
      if (show) g.position.y = FLOOR + 0.95 + Math.sin(t * 1.6) * 0.02
    }
  })
  return (
    <group userData={{ noMerge: true }}>
      {/* 吊扇、吊燈 */}
      <group position={[-18.9, A.ceilY - 0.02, -7.0]}>
        <mesh>
          <cylinderGeometry args={[0.02, 0.02, 0.35, 6]} />
          <meshStandardMaterial color="#e8e2d4" roughness={0.5} />
        </mesh>
        <group ref={fan} position={[0, -0.22, 0]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.12, 0.1, 12]} />
            <meshStandardMaterial color="#e8e2d4" roughness={0.5} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos((i * Math.PI * 2) / 3) * 0.42, 0, Math.sin((i * Math.PI * 2) / 3) * 0.42]} rotation={[0, -(i * Math.PI * 2) / 3, 0.08]}>
              <boxGeometry args={[0.66, 0.015, 0.14]} />
              <meshStandardMaterial color="#6a4a2e" roughness={0.6} />
            </mesh>
          ))}
        </group>
      </group>
      <mesh material={bulb} position={[-17.0, A.ceilY - 0.35, -6.4]}>
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      <mesh position={[-17.0, A.ceilY - 0.22, -6.4]}>
        <coneGeometry args={[0.2, 0.14, 14, 1, true]} />
        <meshStandardMaterial color="#f0ead8" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* 店裡的燈光：老街五間店共用一盞（OldStreetEast.tsx 的 ShopLight） */}
      {/* 收音機的刻度盤 */}
      <mesh material={dial} position={[B.radio.x + 0.152, FLOOR + B.cabinet.h + 0.07, B.radio.z - 0.1]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.2, 0.05]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <sprite key={i} ref={(el) => (notes.current[i] = el)} scale={[0.16, 0.16, 0.16]} visible={false}>
          <spriteMaterial map={noteTex} transparent depthWrite={false} />
        </sprite>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (steam.current[i] = el)} material={steamMat}>
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
      ))}
      {/* 鏡子裡的年輕阿春：壓扁的人，夾在鏡面和一層霧玻璃中間 */}
      <group ref={young} position={[B.chairs[1].x + 0.15, FLOOR + 0.95, BZ + 0.08]} scale={[0.92, 0.92, 0.05]} visible={false}>
        <Chibi spec={SPECS.youngchun} drive={youngDrive} outline={false} shadow={false} />
      </group>
      <mesh position={[(B.mirror.x0 + B.mirror.x1) / 2, FLOOR + (B.mirror.y0 + B.mirror.y1) / 2, BZ + 0.12]}>
        <planeGeometry args={[B.mirror.x1 - B.mirror.x0, B.mirror.y1 - B.mirror.y0]} />
        <meshStandardMaterial color="#cfe4ea" roughness={0.05} metalness={0.2} transparent opacity={0.28} depthWrite={false} />
      </mesh>

      {/* 人：傍晚阿坤師（活人）磨剃刀；晚上阿水師（鬼）幫阿兵哥好兄弟修面 */}
      {night ? (
        <>
          <ChibiNpc id="ashui" pose="clasp" position={[B.ashui.x, FLOOR, B.ashui.z]} heading={-1.9} seesGhosts outline={outline} />
          <SeatedGhost x={B.chairs[0].x} z={B.chairs[0].z} outline={outline} />
        </>
      ) : (
        <ChibiNpc id="akun" pose="clasp" position={[B.akun.x, FLOOR, B.akun.z]} heading={1.1} outline={outline} />
      )}
    </group>
  )
}

/** 理髮椅上的好兄弟：面向鏡子、圍著白色的理髮圍巾 */
function SeatedGhost({ x, z, outline }: { x: number; z: number; outline: boolean }) {
  const spec = SPECS.osw_customer
  const drive = useRef<Drive>(newDrive({ pose: 'sit', heading: Math.PI }))
  const seat = FLOOR + 0.61
  const y = seat - SEAT_Y * spec.scale + 0.03
  const cape = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.8, transparent: true, opacity: 0.92 }), [])
  return (
    <group>
      <group position={[x, y, z + 0.05]}>
        <Chibi spec={spec} drive={drive} outline={outline} legs={false} />
      </group>
      <mesh material={cape} position={[x, seat + 0.2, z + 0.02]}>
        <coneGeometry args={[0.4, 0.62, 18, 1, true]} />
      </mesh>
      <mesh material={cape} position={[x, seat + 0.49, z + 0.02]}>
        <cylinderGeometry args={[0.13, 0.15, 0.05, 14]} />
      </mesh>
    </group>
  )
}
