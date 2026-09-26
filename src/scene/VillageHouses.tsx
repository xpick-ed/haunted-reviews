import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { VILLAGE, acaiState } from '../world/sceneVillage'
import { player } from '../world/player'
import { lanternAt } from './daylight'
import { BRUSH_FONT, TILE, WBox, canvasTexture, planeGeo, seeded, useMats } from './kit'
import { Chibi, SEAT_Y, newDrive, type Drive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { Cat, newCatDrive } from '../chars/Cat'
import '../chars/specs.village2'

// 村子的兩棟厝走進去（DESIGN §30）。規則與座標在 src/world/sceneVillage.ts（VILLAGE.houseAIn、houseBIn）。
//   紅磚厝：阿好嬸家。她冬至那天搬去台北跟兒子住了，厝裡的東西都還在：神明桌（電的神明燈一直亮著）、八仙桌、
//           紅眠床（鬼貓小花睡在上面，陰陽眼才看得到）、灶腳、水缸、菜櫥、停在冬至的日曆、全家福。
//   透天厝：阿財伯家的一樓客廳（1980 年代）。電視櫃、蕾絲沙發、玻璃茶几、藤椅、大魚缸（紅龍）、鋼琴、停在屋裡的機車。
//           傍晚阿財伯在餵魚；19:30 全家看八點檔；22:00 以後阿財伯一個人在藤椅上睡著（電視演重播）；01:00 以後都睡了。
// 不會動的擺設合併（HouseAInterior、HouseBInterior）；會動、會亮的另外畫（VillageHousesLive）。

const V = VILLAGE
const HA = V.houseA
const AI = V.houseAIn
const HB = V.houseB
const BI = V.houseBIn
/** 屋裡的地板 */
const FY = 0.03
/** 牆的內面（牆 0.3 厚） */
const IN = 0.16

// ---------------------------------------------------------------------------
// 貼圖
// ---------------------------------------------------------------------------

/** 神明彩：紅底金框，觀音佛祖坐在蓮花上 */
function deityTexture() {
  return canvasTexture(
    256,
    300,
    (ctx, w, h) => {
      ctx.fillStyle = '#7a1a16'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#d8a93a'
      ctx.lineWidth = 10
      ctx.strokeRect(8, 8, w - 16, h - 16)
      const g = ctx.createRadialGradient(w / 2, 110, 10, w / 2, 110, 70)
      g.addColorStop(0, 'rgba(255,230,150,0.9)')
      g.addColorStop(1, 'rgba(255,200,90,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 30, w, 170)
      // 白衣、頭、蓮花座
      ctx.fillStyle = '#f4efe2'
      ctx.beginPath()
      ctx.moveTo(w / 2, 100)
      ctx.lineTo(w / 2 + 52, 222)
      ctx.lineTo(w / 2 - 52, 222)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#f1c9a0'
      ctx.beginPath()
      ctx.arc(w / 2, 96, 20, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f4efe2'
      ctx.beginPath()
      ctx.arc(w / 2, 86, 22, Math.PI, 0)
      ctx.fill()
      ctx.fillStyle = '#e58aa0'
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath()
        ctx.ellipse(w / 2 + i * 17, 232, 11, 16, i * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#e9c46a'
      ctx.font = `700 30px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('觀 音 佛 祖', w / 2, 36)
      ctx.font = `700 22px ${BRUSH_FONT}`
      ctx.fillText('慈 航 普 度', w / 2, h - 30)
    },
    [{ spec: `700 30px ${BRUSH_FONT}`, text: '觀音佛祖慈航普度' }],
  )
}

/** 撕的日曆：停在十二月廿二，冬至 */
function dayCalendarTexture() {
  return canvasTexture(
    128,
    176,
    (ctx, w, h) => {
      ctx.fillStyle = '#f7f2e6'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#c0332a'
      ctx.fillRect(0, 0, w, 30)
      ctx.fillStyle = '#fff6e2'
      ctx.font = `700 20px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('十二月', w / 2, 16)
      ctx.fillStyle = '#c0332a'
      ctx.font = `700 78px ${BRUSH_FONT}`
      ctx.fillText('22', w / 2, 82)
      ctx.font = `700 28px ${BRUSH_FONT}`
      ctx.fillText('冬 至', w / 2, 140)
      ctx.fillStyle = '#6a6a6a'
      ctx.font = `500 13px ${BRUSH_FONT}`
      ctx.fillText('宜 祭祀 團圓', w / 2, 164)
    },
    [{ spec: `700 78px ${BRUSH_FONT}`, text: '十二月冬至宜祭祀團圓' }],
  )
}

/** 全家福：泛黃的相片，一排大人一排囡仔 */
function familyPhotoTexture(seed: number, people: number, bw = false) {
  return canvasTexture(192, 140, (ctx, w, h) => {
    ctx.fillStyle = '#5a4630'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = bw ? '#b8b4ac' : '#d8c49a'
    ctx.fillRect(10, 10, w - 20, h - 20)
    const r = seeded(seed)
    const tone = (k: number) => (bw ? `rgb(${60 + k},${58 + k},${55 + k})` : `rgb(${90 + k},${64 + k},${40 + k})`)
    for (let i = 0; i < people; i++) {
      const back = i < Math.ceil(people / 2)
      const n = back ? Math.ceil(people / 2) : people - Math.ceil(people / 2)
      const j = back ? i : i - Math.ceil(people / 2)
      const x = 22 + ((j + 0.5) * (w - 44)) / n
      const y = back ? 58 : 86
      const s = back ? 1 : 0.85
      ctx.fillStyle = tone(Math.floor(r() * 30))
      ctx.fillRect(x - 13 * s, y, 26 * s, 50 * s)
      ctx.fillStyle = bw ? '#d8d4cc' : '#e8d2b0'
      ctx.beginPath()
      ctx.arc(x, y - 8 * s, 9 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = tone(-20)
      ctx.beginPath()
      ctx.arc(x, y - 12 * s, 9 * s, Math.PI, 0)
      ctx.fill()
    }
  })
}

/** 草蓆 */
function matTexture() {
  const t = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d8c08a'
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = y % 8 ? 'rgba(120,90,40,0.18)' : 'rgba(255,240,200,0.2)'
      ctx.fillRect(0, y, w, 2)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** 碎花棉被 */
function quiltTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c8384a'
    ctx.fillRect(0, 0, w, h)
    const r = seeded(9)
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = ['#f4d27a', '#f4efe2', '#3e9a52'][i % 3]
      ctx.beginPath()
      ctx.arc(r() * w, r() * h, 3 + r() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

/** 磨石子地 */
function terrazzoTexture() {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#aaa59b'
    ctx.fillRect(0, 0, w, h)
    const r = seeded(31)
    for (let i = 0; i < 900; i++) {
      const c = ['#8a857c', '#e8e4dc', '#6f6a62', '#b8a890', '#f4f1ea'][Math.floor(r() * 5)]
      ctx.fillStyle = c
      ctx.fillRect(r() * w, r() * h, 1 + r() * 3.5, 1 + r() * 3.5)
    }
    // 銅條分格
    ctx.strokeStyle = 'rgba(150,110,60,0.6)'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, w, h)
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(4, 4)
  return t
}

/** 蕾絲（沙發罩、鋼琴上的布） */
function laceTexture() {
  const t = canvasTexture(128, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(250,248,240,0.95)'
    ctx.fillRect(0, 0, w, h - 16)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.globalCompositeOperation = 'destination-out'
    for (let x = 8; x < w; x += 16)
      for (let y = 8; y < h - 16; y += 16) {
        ctx.beginPath()
        ctx.arc(x, y, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(250,248,240,0.95)'
    for (let x = 0; x < w; x += 16) {
      ctx.beginPath()
      ctx.arc(x + 8, h - 16, 8, 0, Math.PI)
      ctx.fill()
    }
  })
  t.wrapS = THREE.RepeatWrapping
  return t
}

/** 家和萬事興 */
function mottoTexture() {
  return canvasTexture(
    320,
    100,
    (ctx, w, h) => {
      ctx.fillStyle = '#f4efe2'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#5a3a1a'
      ctx.lineWidth = 10
      ctx.strokeRect(5, 5, w - 10, h - 10)
      ctx.fillStyle = '#1c1a18'
      ctx.font = `700 50px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('家和萬事興', w / 2, h / 2 + 3)
    },
    [{ spec: `700 50px ${BRUSH_FONT}`, text: '家和萬事興' }],
  )
}

// ---------------------------------------------------------------------------
// 紅磚厝（阿好嬸家）：不會動的擺設
// ---------------------------------------------------------------------------

export function HouseAInterior() {
  const mats = useMats()
  const tex = useMemo(
    () => ({
      deity: new THREE.MeshStandardMaterial({ map: deityTexture(), roughness: 0.8 }),
      calendar: new THREE.MeshStandardMaterial({ map: dayCalendarTexture(), roughness: 0.9 }),
      family: new THREE.MeshStandardMaterial({ map: familyPhotoTexture(5, 7), roughness: 0.6 }),
      wedding: new THREE.MeshStandardMaterial({ map: familyPhotoTexture(12, 2, true), roughness: 0.6 }),
      mat: new THREE.MeshStandardMaterial({ map: matTexture(), roughness: 0.9 }),
      quilt: new THREE.MeshStandardMaterial({ map: quiltTexture(), roughness: 0.9 }),
    }),
    [],
  )
  const floor = useMemo(() => {
    const m = mats.brick.clone()
    m.color.set('#c98a70')
    return m
  }, [mats])
  const bronze = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a6a2a', roughness: 0.4, metalness: 0.7 }), [])
  const fruit = useMemo(() => ['#f08a2a', '#e8423a', '#f2c230'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })), [])
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.5, metalness: 0.6 }), [])
  const wx = HA.x1 - HA.x0
  const wz = HA.z1 - HA.z0
  const A = AI.altar
  const B = AI.bed
  return (
    <group>
      {/* 紅磚地 */}
      <mesh geometry={planeGeo(wx - 0.3, wz - 0.3, TILE.brick)} material={floor} rotation-x={-Math.PI / 2} position={[(HA.x0 + HA.x1) / 2, FY, (HA.z0 + HA.z1) / 2]} receiveShadow />
      {/* 神明彩、全家福、結婚照、日曆（北牆內面） */}
      <mesh material={tex.deity} position={[A.x, 1.95, HA.z0 + IN]}>
        <planeGeometry args={[1.1, 1.3]} />
      </mesh>
      <group position={[-12.45, 2.0, HA.z0 + IN]}>
        <WBox mat="darkWood" size={[0.78, 0.6, 0.03]} position={[0, 0, 0]} castShadow={false} />
        <mesh material={tex.family} position={[0, 0, 0.02]}>
          <planeGeometry args={[0.68, 0.5]} />
        </mesh>
      </group>
      <group position={[-12.45, 1.35, HA.z0 + IN]}>
        <WBox mat="darkWood" size={[0.36, 0.44, 0.03]} castShadow={false} />
        <mesh material={tex.wedding} position={[0, 0, 0.02]} rotation={[0, 0, Math.PI / 2]}>
          <planeGeometry args={[0.36, 0.28]} />
        </mesh>
      </group>
      <mesh material={tex.calendar} position={[AI.calendar.x, AI.calendar.y, HA.z0 + IN]}>
        <planeGeometry args={[0.32, 0.44]} />
      </mesh>
      {/* 神明桌：頂桌（高、窄）＋下桌（塞在下面），紅漆金邊 */}
      <group position={[A.x, FY, 0]}>
        <WBox mat="redPaint" size={[A.w, 0.08, 0.42]} position={[0, 1.02, -10.62]} />
        {[-1, 1].map((s) => (
          <WBox key={s} mat="redPaint" size={[0.08, 1.0, 0.4]} position={[s * (A.w / 2 - 0.06), 0.5, -10.62]} />
        ))}
        <WBox mat="gold" size={[A.w + 0.02, 0.05, 0.03]} position={[0, 0.94, -10.4]} castShadow={false} />
        <WBox mat="darkWood" size={[1.5, 0.06, 0.55]} position={[0, 0.78, -10.33]} />
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <WBox key={`${sx}${sz}`} mat="darkWood" size={[0.06, 0.76, 0.06]} position={[sx * 0.7, 0.38, -10.33 + sz * 0.23]} />))}
        {/* 神像（金身）、祖先牌位、香爐、水果 */}
        <group position={[0, 1.06, -10.66]}>
          <mesh material={mats.gold} position={[0, 0.16, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.1, 0.3, 10]} />
          </mesh>
          <mesh material={mats.gold} position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.06, 10, 8]} />
          </mesh>
          <WBox mat="darkWood" size={[0.26, 0.04, 0.2]} position={[0, 0.02, 0]} castShadow={false} />
        </group>
        <group position={[-0.55, 1.06, -10.66]}>
          <WBox mat="darkWood" size={[0.2, 0.4, 0.06]} position={[0, 0.2, 0]} />
          <WBox mat="gold" size={[0.05, 0.28, 0.01]} position={[0, 0.22, 0.035]} castShadow={false} />
        </group>
        <mesh material={bronze} position={[0, 0.9, -10.3]} castShadow>
          <cylinderGeometry args={[0.13, 0.1, 0.18, 14]} />
        </mesh>
        {[-0.05, 0, 0.05].map((x) => (
          <mesh key={x} material={mats.redPaint} position={[x, 1.1, -10.3]} rotation={[0, 0, x * 2]}>
            <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
          </mesh>
        ))}
        <group position={[0.45, 0.82, -10.28]}>
          <mesh material={mats.ceramic} position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.16, 0.1, 0.04, 14]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} material={fruit[i % fruit.length]} position={[Math.cos(i * 1.7) * 0.07, 0.08 + (i === 3 ? 0.07 : 0), Math.sin(i * 1.7) * 0.07]}>
              <sphereGeometry args={[0.055, 10, 8]} />
            </mesh>
          ))}
        </group>
      </group>
      {/* 八仙桌＋兩張竹椅 */}
      <group position={[AI.table.x, FY, AI.table.z]}>
        <WBox mat="darkWood" size={[0.9, 0.06, 0.9]} position={[0, 0.78, 0]} />
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <WBox key={`${sx}${sz}`} mat="darkWood" size={[0.06, 0.76, 0.06]} position={[sx * 0.4, 0.38, sz * 0.4]} />))}
        <mesh material={mats.ceramic} position={[0.15, 0.87, 0.1]} castShadow>
          <sphereGeometry args={[0.08, 12, 8]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.8, 0, 0]} rotation={[0, (s * -Math.PI) / 2, 0]}>
            <WBox mat="bamboo" size={[0.42, 0.05, 0.4]} position={[0, 0.44, 0]} />
            <WBox mat="bamboo" size={[0.42, 0.45, 0.04]} position={[0, 0.68, -0.19]} />
            {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <WBox key={`${sx}${sz}`} mat="bamboo" size={[0.035, 0.44, 0.035]} position={[sx * 0.18, 0.22, sz * 0.17]} />))}
          </group>
        ))}
      </group>
      {/* 紅眠床：床台、草蓆、棉被、枕頭；四根柱子、上面的楣板；靠牆那邊是整片板子，南邊（鏡頭這邊）矮 */}
      <group position={[B.x, FY, B.z]}>
        <WBox mat="redPaint" size={[B.w, 0.5, B.d]} position={[0, 0.25, 0]} />
        <mesh material={tex.mat} position={[0.02, B.top - FY - 0.08, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[B.w - 0.1, B.d - 0.1]} />
        </mesh>
        <mesh material={tex.quilt} position={[0.1, 0.62, -B.d / 2 + 0.55]} castShadow>
          <boxGeometry args={[B.w - 0.3, 0.14, 0.55]} />
        </mesh>
        <mesh material={mats.cloth} position={[0, 0.6, -B.d / 2 + 0.2]} castShadow>
          <boxGeometry args={[0.6, 0.1, 0.25]} />
        </mesh>
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <WBox key={`${sx}${sz}`} mat="redPaint" size={[0.08, 2.3, 0.08]} position={[sx * (B.w / 2 - 0.04), 1.15, sz * (B.d / 2 - 0.04)]} />))}
        <WBox mat="redPaint" size={[0.05, 1.7, B.d]} position={[-B.w / 2 + 0.03, 1.3, 0]} castShadow={false} />
        <WBox mat="redPaint" size={[B.w, 1.3, 0.05]} position={[0, 1.1, -B.d / 2 + 0.03]} castShadow={false} />
        <WBox mat="redPaint" size={[B.w, 0.35, 0.05]} position={[0, 0.62, B.d / 2 - 0.03]} castShadow={false} />
        {/* 楣板（東邊、鏡頭這邊的上緣），金色雕花用一條金邊代替 */}
        <WBox mat="redPaint" size={[0.06, 0.34, B.d]} position={[B.w / 2 - 0.04, 2.1, 0]} castShadow={false} />
        <WBox mat="gold" size={[0.02, 0.06, B.d - 0.2]} position={[B.w / 2 - 0.0, 2.1, 0]} castShadow={false} />
        <WBox mat="redPaint" size={[B.w, 0.34, 0.06]} position={[0, 2.1, B.d / 2 - 0.04]} castShadow={false} />
        <WBox mat="darkWood" size={[B.w, 0.04, B.d]} position={[0, 2.28, 0]} castShadow={false} />
      </group>
      {/* 衣櫥（鏡子門） */}
      <group position={[AI.dresser.x, FY, AI.dresser.z]}>
        <WBox mat="darkWood" size={[0.5, 1.7, 1.0]} position={[0, 0.85, 0]} />
        <mesh position={[0.26, 1.05, 0.22]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.4, 1.0]} />
          <meshStandardMaterial color="#a9b8bf" roughness={0.1} metalness={0.8} />
        </mesh>
      </group>
      {/* 灶：紅磚灶身、白磁磚檯面、兩口大鼎、灶孔；煙囪往上穿出屋頂 */}
      <group position={[AI.stove.x, FY, AI.stove.z]}>
        <WBox mat="brick" size={[1.1, 0.8, 1.2]} position={[0, 0.4, 0]} />
        <WBox mat="trim" size={[1.14, 0.05, 1.24]} position={[0, 0.82, 0]} />
        {[-0.28, 0.28].map((z) => (
          <group key={z} position={[0, 0.85, z]}>
            <mesh material={iron} rotation={[Math.PI, 0, 0]} castShadow>
              <sphereGeometry args={[0.26, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            <mesh material={mats.wood} position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.22, 0.25, 0.12, 16]} />
            </mesh>
          </group>
        ))}
        {[-0.28, 0.28].map((z) => (
          <mesh key={z} position={[-0.556, 0.3, z]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.24, 0.2]} />
            <meshStandardMaterial color="#1a1210" roughness={1} />
          </mesh>
        ))}
        <WBox mat="brick" size={[0.36, 3.6, 0.36]} position={[0.3, 2.6, -0.4]} />
      </group>
      {/* 柴 */}
      <group position={[AI.stove.x - 0.85, FY, AI.stove.z + 0.45]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} material={mats.wood} position={[(i % 3) * 0.08 - 0.08, 0.05 + Math.floor(i / 3) * 0.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
          </mesh>
        ))}
      </group>
      {/* 水缸（木蓋＋水瓢） */}
      <group position={[AI.jar.x, FY, AI.jar.z]}>
        <mesh material={mats.ceramic} position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.22, 0.6, 16]} />
        </mesh>
        <mesh material={mats.wood} position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.31, 0.31, 0.04, 16]} />
        </mesh>
        <mesh material={mats.wood} position={[0.1, 0.68, 0]} rotation={[0, 0, 0.1]}>
          <sphereGeometry args={[0.08, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>
      {/* 菜櫥（紗門）＋上面的電鍋 */}
      <group position={[AI.cupboard.x, FY, AI.cupboard.z]}>
        <WBox mat="wood" size={[0.9, 1.4, 0.45]} position={[0, 0.7, 0]} />
        {[-0.21, 0.21].map((x) => (
          <mesh key={x} position={[x, 0.95, 0.228]}>
            <planeGeometry args={[0.36, 0.6]} />
            <meshStandardMaterial color="#7a8288" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0.1, 1.53, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 0.24, 16]} />
          <meshStandardMaterial color="#6fa08a" roughness={0.4} />
        </mesh>
        <mesh material={mats.metal} position={[0.1, 1.67, 0]}>
          <cylinderGeometry args={[0.1, 0.14, 0.05, 16]} />
        </mesh>
      </group>
      {/* 靠窗的竹椅 */}
      <group position={[AI.chair.x, FY, AI.chair.z]} rotation={[0, 2.6, 0]}>
        <WBox mat="bamboo" size={[0.55, 0.06, 0.5]} position={[0, 0.4, 0]} />
        <WBox mat="bamboo" size={[0.55, 0.55, 0.05]} position={[0, 0.68, -0.23]} rotation={[-0.15, 0, 0]} />
        {[-1, 1].map((s) => (
          <WBox key={s} mat="bamboo" size={[0.05, 0.25, 0.5]} position={[s * 0.27, 0.55, 0]} />
        ))}
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <WBox key={`${sx}${sz}`} mat="bamboo" size={[0.04, 0.4, 0.04]} position={[sx * 0.24, 0.2, sz * 0.21]} />))}
      </group>
    </group>
  )
}

/** 紅磚厝的門：兩扇木門往裡面打開（沒人住了，阿嬤進得去） */
export function HouseADoors() {
  const d = AI.door
  return (
    <group>
      {[-1, 1].map((s) => (
        <WBox key={s} mat="darkWood" size={[0.06, 2.18, d.w / 2 - 0.02]} position={[d.x + s * (d.w / 2 - 0.04), 1.09, HA.z1 - IN - d.w / 4]} rotation={[0, s * 0.18, 0]} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 透天厝（阿財伯家的客廳）：不會動的擺設
// ---------------------------------------------------------------------------

export function HouseBInterior() {
  const mats = useMats()
  const tex = useMemo(
    () => ({
      floor: new THREE.MeshStandardMaterial({ map: terrazzoTexture(), roughness: 0.35 }),
      lace: new THREE.MeshStandardMaterial({ map: laceTexture(), transparent: true, alphaTest: 0.3, roughness: 0.9, side: THREE.DoubleSide }),
      motto: new THREE.MeshStandardMaterial({ map: mottoTexture(), roughness: 0.8 }),
      wedding: new THREE.MeshStandardMaterial({ map: familyPhotoTexture(21, 2), roughness: 0.5 }),
      family: new THREE.MeshStandardMaterial({ map: familyPhotoTexture(3, 6), roughness: 0.5 }),
    }),
    [],
  )
  const cream = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9ceb4', roughness: 0.9 }), [])
  const velvet = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a2a34', roughness: 0.95 }), [])
  const rattan = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9a36a', roughness: 0.8 }), [])
  const gloss = useMemo(() => new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.15, metalness: 0.2 }), [])
  const ivory = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.3 }), [])
  const glassTop = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cfe6e2', roughness: 0.05, transparent: true, opacity: 0.4, depthWrite: false }), [])
  const tvCase = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.5 }), [])
  const scooterPaint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.35, metalness: 0.2 }), [])
  const tire = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.8 }), [])
  const wx = HB.x1 - HB.x0
  const wz = HB.z1 - HB.z0
  const cx = (HB.x0 + HB.x1) / 2
  const T = BI.tv
  const Sf = BI.sofa
  const A = BI.armchair
  const K = BI.tank
  const P = BI.piano
  const St = BI.stairs
  return (
    <group>
      {/* 磨石子地、北牆和西牆的內面（米色＋木頭護牆板） */}
      <mesh geometry={planeGeo(wx - 0.3, wz - 0.3)} material={tex.floor} rotation-x={-Math.PI / 2} position={[cx, FY, (HB.z0 + HB.z1) / 2]} receiveShadow />
      <mesh material={cream} position={[cx, HB.floor2 / 2, HB.z0 + IN]}>
        <planeGeometry args={[wx - 0.3, HB.floor2]} />
      </mesh>
      <mesh material={cream} position={[HB.x0 + IN, HB.floor2 / 2, (HB.z0 + HB.z1) / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[wz - 0.3, HB.floor2]} />
      </mesh>
      <WBox mat="darkWood" size={[wx - 0.3, 0.9, 0.02]} position={[cx, 0.45, HB.z0 + IN + 0.01]} castShadow={false} />
      <WBox mat="darkWood" size={[0.02, 0.9, wz - 0.3]} position={[HB.x0 + IN + 0.01, 0.45, (HB.z0 + HB.z1) / 2]} castShadow={false} />
      {/* 牆上：家和萬事興、全家福、結婚照 */}
      <mesh material={tex.motto} position={[T.x, 2.55, HB.z0 + IN + 0.02]}>
        <planeGeometry args={[1.3, 0.4]} />
      </mesh>
      <group position={[HB.x0 + IN + 0.02, 2.0, K.z]} rotation={[0, Math.PI / 2, 0]}>
        <WBox mat="gold" size={[0.86, 0.66, 0.03]} castShadow={false} />
        <mesh material={tex.family} position={[0, 0, 0.02]}>
          <planeGeometry args={[0.78, 0.58]} />
        </mesh>
      </group>
      <group position={[HB.x0 + IN + 0.02, 2.05, P.z]} rotation={[0, Math.PI / 2, 0]}>
        <WBox mat="gold" size={[0.44, 0.56, 0.03]} castShadow={false} />
        <mesh material={tex.wedding} position={[0, 0, 0.02]}>
          <planeGeometry args={[0.38, 0.5]} />
        </mesh>
      </group>
      {/* 電視櫃：木頭櫃子（玻璃門）、上面的大電視（木紋外殼）、錄放影機、招財貓、塑膠花 */}
      <group position={[T.x, FY, T.z]}>
        <WBox mat="darkWood" size={[2.4, 0.7, 0.5]} position={[0, 0.35, 0]} />
        {[-0.8, 0, 0.8].map((x) => (
          <mesh key={x} material={glassTop} position={[x, 0.38, 0.252]}>
            <planeGeometry args={[0.7, 0.5]} />
          </mesh>
        ))}
        <mesh material={tvCase} position={[0, 1.02, -0.02]} castShadow>
          <boxGeometry args={[0.86, 0.64, 0.55]} />
        </mesh>
        <mesh material={gloss} position={[0, 0.74, 0.12]}>
          <boxGeometry args={[0.5, 0.08, 0.3]} />
        </mesh>
        <group position={[-0.85, 0.72, 0.05]}>
          <mesh material={ivory} position={[0, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.1, 12, 10]} />
          </mesh>
          <mesh material={ivory} position={[0, 0.25, 0]}>
            <sphereGeometry args={[0.08, 12, 10]} />
          </mesh>
          <mesh material={mats.redPaint} position={[0.09, 0.3, 0]} rotation={[0, 0, -0.4]}>
            <cylinderGeometry args={[0.02, 0.02, 0.1, 6]} />
          </mesh>
        </group>
        <group position={[0.9, 0.72, 0.05]}>
          <mesh material={mats.ceramic} position={[0, 0.14, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 0.28, 12]} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos(i * 1.3) * 0.08, 0.36 + (i % 2) * 0.06, Math.sin(i * 1.3) * 0.06]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <meshStandardMaterial color={['#e8423a', '#f2c230', '#e46aa4'][i % 3]} roughness={0.6} />
            </mesh>
          ))}
        </group>
      </group>
      {/* 掛鐘（鐘擺在 Live 那邊） */}
      <group position={[T.x + 1.55, 2.2, HB.z0 + IN + 0.08]}>
        <WBox mat="darkWood" size={[0.36, 0.7, 0.12]} castShadow={false} />
        <mesh position={[0, 0.16, 0.065]}>
          <circleGeometry args={[0.13, 20]} />
          <meshStandardMaterial color="#f7f2e6" roughness={0.4} />
        </mesh>
      </group>
      {/* 沙發（木頭扶手、酒紅色絨布），椅背罩白蕾絲 */}
      <group position={[Sf.x, FY, Sf.z]}>
        <mesh material={velvet} position={[0, 0.3, -0.05]} castShadow>
          <boxGeometry args={[1.8, 0.24, 0.62]} />
        </mesh>
        <mesh material={velvet} position={[0, 0.66, 0.3]} castShadow>
          <boxGeometry args={[1.8, 0.56, 0.16]} />
        </mesh>
        <WBox mat="darkWood" size={[1.9, 0.18, 0.8]} position={[0, 0.1, 0]} />
        {[-1, 1].map((s) => (
          <WBox key={s} mat="darkWood" size={[0.12, 0.62, 0.84]} position={[s * 0.99, 0.31, 0]} />
        ))}
        <mesh material={tex.lace} position={[0, 0.8, 0.39]}>
          <planeGeometry args={[1.5, 0.3]} />
        </mesh>
        <mesh material={tex.lace} position={[0, 0.95, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.5, 0.18]} />
        </mesh>
      </group>
      {/* 玻璃茶几：茶盤、茶壺、茶杯、瓜子 */}
      <group position={[BI.coffee.x, FY, BI.coffee.z]}>
        <WBox mat="darkWood" size={[1.2, 0.3, 0.6]} position={[0, 0.15, 0]} />
        <mesh material={glassTop} position={[0, 0.33, 0]}>
          <boxGeometry args={[1.22, 0.03, 0.62]} />
        </mesh>
        <WBox mat="wood" size={[0.4, 0.03, 0.28]} position={[-0.25, 0.36, 0]} />
        <mesh material={mats.ceramic} position={[-0.3, 0.43, 0]} castShadow>
          <sphereGeometry args={[0.07, 12, 8]} />
        </mesh>
        {[-0.18, -0.12].map((x) => (
          <mesh key={x} material={ivory} position={[x, 0.4, 0.07]}>
            <cylinderGeometry args={[0.025, 0.02, 0.04, 8]} />
          </mesh>
        ))}
        <mesh material={mats.redPaint} position={[0.28, 0.37, 0.02]}>
          <cylinderGeometry args={[0.13, 0.1, 0.03, 16]} />
        </mesh>
      </group>
      {/* 阿財伯的藤椅（面向電視） */}
      <group position={[A.x, FY, A.z]} rotation={[0, A.heading, 0]}>
        <mesh material={rattan} position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.66, 0.08, 0.6]} />
        </mesh>
        <mesh material={rattan} position={[0, 0.8, -0.28]} rotation={[-0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.66, 0.75, 0.06]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={rattan} position={[s * 0.33, 0.58, 0]}>
            <boxGeometry args={[0.06, 0.08, 0.6]} />
          </mesh>
        ))}
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <WBox key={`${sx}${sz}`} mat="bamboo" size={[0.04, 0.42, 0.04]} position={[sx * 0.29, 0.21, sz * 0.26]} />))}
      </group>
      {/* 樓梯（往北上二樓）＋鐵扶手 */}
      <group>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} material={tex.floor} position={[(St.x0 + St.x1) / 2, FY + 0.1 + i * 0.2, St.z1 - 0.1 - i * 0.19]} castShadow receiveShadow>
            <boxGeometry args={[St.x1 - St.x0, 0.2 + i * 0.4, 0.19]} />
          </mesh>
        ))}
        <mesh material={mats.metal} position={[St.x0 + 0.03, 1.55, (St.z0 + St.z1) / 2]} rotation={[-0.84, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 1.9, 6]} />
        </mesh>
      </group>
      {/* 魚缸的座（黑色木櫃） */}
      <WBox mat="darkWood" size={[0.45, 0.7, 1.5]} position={[K.x, FY + 0.35, K.z]} />
      {/* 鋼琴（直立式、黑色亮面、鍵盤朝東），上面鋪蕾絲、擺節拍器和相框 */}
      <group position={[P.x, FY, P.z]}>
        <mesh material={gloss} position={[-0.05, 0.65, 0]} castShadow>
          <boxGeometry args={[0.5, 1.3, 1.4]} />
        </mesh>
        <mesh material={gloss} position={[0.2, 0.72, 0]}>
          <boxGeometry args={[0.32, 0.06, 1.34]} />
        </mesh>
        <mesh material={ivory} position={[0.26, 0.755, 0]}>
          <boxGeometry args={[0.2, 0.02, 1.26]} />
        </mesh>
        {Array.from({ length: 18 }, (_, i) => (i % 7 === 2 || i % 7 === 6 ? null : <mesh key={i} material={gloss} position={[0.21, 0.772, -0.6 + i * 0.07]}><boxGeometry args={[0.1, 0.02, 0.035]} /></mesh>))}
        <mesh material={tex.lace} position={[-0.05, 1.31, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[1.2, 0.46]} />
        </mesh>
        <mesh material={mats.darkWood} position={[-0.05, 1.42, 0.35]} castShadow>
          <coneGeometry args={[0.07, 0.2, 4]} />
        </mesh>
        <WBox mat="gold" size={[0.03, 0.22, 0.17]} position={[-0.1, 1.42, -0.3]} rotation={[0, 0, 0.1]} castShadow={false} />
        <WBox mat="darkWood" size={[0.3, 0.46, 0.8]} position={[0.55, 0.23, 0]} />
      </group>
      {/* 停在屋裡的機車（米白色的老式速克達） */}
      <group position={[BI.scooter.x, FY, BI.scooter.z]} rotation={[0, Math.PI / 2 + 0.05, 0]}>
        {[-0.55, 0.55].map((z) => (
          <mesh key={z} material={tire} position={[0, 0.2, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <torusGeometry args={[0.15, 0.06, 8, 16]} />
          </mesh>
        ))}
        <mesh material={scooterPaint} position={[0, 0.34, 0.05]} castShadow>
          <boxGeometry args={[0.36, 0.1, 0.7]} />
        </mesh>
        <mesh material={scooterPaint} position={[0, 0.5, -0.32]} castShadow>
          <boxGeometry args={[0.44, 0.44, 0.5]} />
        </mesh>
        <mesh material={velvet} position={[0, 0.76, -0.3]}>
          <boxGeometry args={[0.3, 0.08, 0.48]} />
        </mesh>
        <mesh material={scooterPaint} position={[0, 0.66, 0.5]} rotation={[0.25, 0, 0]} castShadow>
          <boxGeometry args={[0.42, 0.72, 0.08]} />
        </mesh>
        <mesh material={mats.metal} position={[0, 1.05, 0.46]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
        </mesh>
        <mesh position={[0, 0.98, 0.56]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color="#f7f2e6" roughness={0.2} />
        </mesh>
      </group>
      {/* 門口的鞋子 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[8.3 + (i % 2) * 0.08, FY + 0.04, HB.z1 - IN - 0.2 - i * 0.14]} rotation={[0, 0.2 * i, 0]}>
          <boxGeometry args={[0.1, 0.07, 0.24]} />
          <meshStandardMaterial color={['#2f6fb8', '#d8607a', '#3a3a40'][i]} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

/** 透天厝的小門往裡面打開 */
export function HouseBDoor() {
  const d = BI.door
  return <WBox mat="metal" size={[0.05, 2.14, d.w - 0.04]} position={[d.x - d.w / 2 + 0.03, 1.08, HB.z1 - IN - d.w / 2]} rotation={[0, 0.25, 0]} />
}

// ---------------------------------------------------------------------------
// 會動、會亮的：神明燈、電視、魚缸、鐘擺、燈、阿財伯一家、鬼貓小花
// ---------------------------------------------------------------------------

export function VillageHousesLive({ outline }: { outline: boolean }) {
  return (
    <group userData={{ noMerge: true }}>
      <AltarLamps />
      <GhostCat outline={outline} />
      <LivingRoom outline={outline} />
    </group>
  )
}

/** 阿好家的神明燈（電的，紅紅的一直亮著）＋屋裡唯一的一盞點光 */
function AltarLamps() {
  const light = useRef<THREE.PointLight>(null)
  const lamp = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.35, 0.25), toneMapped: false }), [])
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const f = 0.9 + 0.1 * Math.sin(clock.elapsedTime * 3.1)
    if (light.current) light.current.intensity = (0.5 + 1.6 * l) * f
  })
  const A = AI.altar
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[A.x + s * 0.72, FY + 1.06, -10.64]}>
          <mesh material={lamp} position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 0.06, 10]} />
            <meshStandardMaterial color="#d8a93a" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <pointLight ref={light} position={[A.x, 1.7, A.z + 0.9]} color="#ff7a4a" intensity={0} distance={7} decay={2} />
    </group>
  )
}

/** 鬼貓小花：睡在紅眠床上，陰陽眼才看得到；半透明、泛青光，阿嬤靠近會抬頭看 */
function GhostCat({ outline }: { outline: boolean }) {
  const group = useRef<THREE.Group>(null)
  const drive = useRef(newCatDrive({ pose: 'sleep', heading: 2.2 }))
  const done = useRef(false)
  const B = AI.bed
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const s = useStore.getState()
    g.visible = s.scene === 'village' && s.vision
    if (!g.visible) return
    // 第一次看到時把材質換成半透明的複本（不動到阿咪的材質）
    if (!done.current) {
      done.current = true
      const tint = new THREE.Color('#bfeaff')
      g.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const swap = (mat: THREE.Material) => {
          const c = mat.clone() as THREE.MeshBasicMaterial
          c.transparent = true
          c.opacity = 0.55
          c.depthWrite = false
          if (c.color) c.color.lerp(tint, 0.55)
          return c
        }
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material)
      })
    }
    const d = Math.hypot(player.x - (B.x + 0.2), player.z - (B.z + 0.25))
    drive.current.pose = d < 1.6 ? 'sit' : 'sleep'
    if (d < 1.6) drive.current.heading = Math.atan2(player.x - (B.x + 0.2), player.z - (B.z + 0.25))
    g.position.y = B.top + 0.02 + Math.sin(clock.elapsedTime * 1.4) * 0.015
  })
  return (
    <group ref={group} position={[B.x + 0.2, B.top, B.z + 0.25]} visible={false}>
      <Cat drive={drive} outline={outline} />
    </group>
  )
}

/** 八點檔的畫面：彩色的連續劇（兩個人的臉、字幕條），每秒畫幾次 */
function useDramaScreen() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 96
    const ctx = c.getContext('2d')!
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const draw = (t: number, on: boolean) => {
      const w = c.width
      const h = c.height
      if (!on) {
        ctx.fillStyle = '#0c0f12'
        ctx.fillRect(0, 0, w, h)
        tex.needsUpdate = true
        return
      }
      // 每 4 秒換一個鏡頭：兩人對峙／特寫／哭
      const shot = Math.floor(t / 4) % 3
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, shot === 1 ? '#6a3a4a' : '#3a4a6a')
      g.addColorStop(1, '#1a1a24')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      const face = (x: number, y: number, r: number, hair: string) => {
        ctx.fillStyle = hair
        ctx.beginPath()
        ctx.arc(x, y - r * 0.2, r * 1.08, Math.PI, 0)
        ctx.fill()
        ctx.fillStyle = '#e8c4a0'
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#2a1a1a'
        ctx.fillRect(x - r * 0.45, y - r * 0.1, r * 0.2, r * 0.12)
        ctx.fillRect(x + r * 0.25, y - r * 0.1, r * 0.2, r * 0.12)
      }
      if (shot === 1) {
        const z = 1 + ((t % 4) / 4) * 0.25
        face(w / 2, h / 2, 22 * z, '#1a1210')
        ctx.fillStyle = 'rgba(160,200,255,0.8)'
        ctx.fillRect(w / 2 - 8 * z, h / 2 + 6, 2, 8 + (t % 4) * 3)
      } else {
        face(w * 0.3 + Math.sin(t) * 2, h * 0.5, 15, '#2a1a10')
        face(w * 0.72, h * 0.48, 16, shot === 2 ? '#8a8a8a' : '#1a1210')
      }
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, h - 16, w, 16)
      ctx.fillStyle = '#f4efe2'
      ctx.fillRect(20, h - 10, 40 + ((t * 7) % 40), 3)
      tex.needsUpdate = true
    }
    return { tex, draw }
  }, [])
}

/** 客廳：電視（八點檔）、魚缸（紅龍＋小魚＋氣泡）、鐘擺、燈、阿財伯和秀娟、鐵捲門上的光 */
function LivingRoom({ outline }: { outline: boolean }) {
  const { tex, draw } = useDramaScreen()
  const screen = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), [tex])
  const tube = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.6, 1.6), toneMapped: false }), [])
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4fa3b8', emissive: '#1d5a6a', emissiveIntensity: 0.6, roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }), [])
  const tankLight = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.4, 1.6), toneMapped: false }), [])
  const arowana = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8633a', metalness: 0.5, roughness: 0.3, emissive: '#5a1a0a', emissiveIntensity: 0.3 }), [])
  const small = useMemo(() => ['#f2c230', '#e8423a', '#8fd3ff'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })), [])
  const bubble = useMemo(() => new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.6 }), [])
  const light = useRef<THREE.PointLight>(null)
  const fish = useRef<THREE.Group>(null)
  const smalls = useRef<(THREE.Group | null)[]>([])
  const bubbles = useRef<(THREE.Mesh | null)[]>([])
  const pendulum = useRef<THREE.Group>(null)
  const tubeMesh = useRef<THREE.Mesh>(null)
  const acc = useRef(0)
  const K = BI.tank
  const T = BI.tv
  useFrame(({ clock }, dt) => {
    const s = useStore.getState()
    if (s.scene !== 'village') return
    const t = clock.elapsedTime
    const st = acaiState(s)
    const tvOn = st === 'tv' || st === 'doze'
    acc.current += dt
    if (acc.current > 0.15) {
      acc.current = 0
      draw(t, tvOn)
    }
    // 燈：傍晚開日光燈；半夜只剩電視的藍光；都睡了就剩魚缸
    const l = lanternAt(s.time)
    const L = light.current
    if (L) {
      if (st === 'feed' || st === 'tv') {
        L.position.set(T.x, 2.85, -8.3)
        L.color.set('#eef6ff')
        L.intensity = 0.8 + 1.6 * l
      } else if (st === 'doze') {
        L.position.set(T.x, 1.3, T.z + 1.2)
        L.color.set('#8fb8ff')
        L.intensity = (1.2 + 0.4 * Math.sin(t * 7.3) * Math.sin(t * 2.1)) * (0.4 + l)
      } else {
        L.position.set(K.x + 0.6, 1.3, K.z)
        L.color.set('#6fd0e8')
        L.intensity = 0.5 * l
      }
    }
    if (tubeMesh.current) tubeMesh.current.visible = st === 'feed' || st === 'tv'
    // 紅龍在缸裡來回游；小魚繞圈；氣泡往上冒
    if (fish.current) {
      const u = Math.sin(t * 0.35)
      fish.current.position.set(K.x + 0.02, FY + 1.0 + Math.sin(t * 0.7) * 0.05, K.z + u * 0.45)
      fish.current.rotation.y = Math.cos(t * 0.35) > 0 ? 0 : Math.PI
      fish.current.rotation.z = Math.sin(t * 3) * 0.08
    }
    smalls.current.forEach((f, i) => {
      if (!f) return
      const a = t * (0.8 + i * 0.3) + i * 2
      f.position.set(K.x + Math.sin(a * 1.3) * 0.08, FY + 0.85 + i * 0.1, K.z + Math.cos(a) * 0.55)
      f.rotation.y = -a + Math.PI / 2
    })
    bubbles.current.forEach((b, i) => {
      if (!b) return
      const y = ((t * 0.25 + i * 0.13) % 0.5) + FY + 0.78
      b.position.set(K.x - 0.12, y, K.z - 0.6 + Math.sin(t * 4 + i) * 0.01)
    })
    if (pendulum.current) pendulum.current.rotation.z = Math.sin(t * 2.2) * 0.25
  })
  return (
    <group>
      {/* 電視螢幕（朝南，對著沙發和鏡頭） */}
      <mesh material={screen} position={[T.x - 0.05, FY + 1.04, T.z + 0.26]}>
        <planeGeometry args={[0.62, 0.46]} />
      </mesh>
      {/* 天花板的日光燈 */}
      <mesh ref={tubeMesh} material={tube} position={[T.x, 3.0, -8.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 1.2, 8]} />
      </mesh>
      <pointLight ref={light} position={[T.x, 2.85, -8.3]} intensity={0} distance={8} decay={2} />
      {/* 魚缸：水、燈、紅龍、小魚、氣泡 */}
      <mesh material={water} position={[K.x, FY + 1.02, K.z]}>
        <boxGeometry args={[0.42, 0.6, 1.46]} />
      </mesh>
      <mesh material={tankLight} position={[K.x, FY + 1.34, K.z]}>
        <boxGeometry args={[0.44, 0.04, 1.48]} />
      </mesh>
      <group ref={fish}>
        <mesh material={arowana} scale={[0.35, 0.55, 1]} castShadow={false}>
          <capsuleGeometry args={[0.05, 0.3, 4, 10]} />
        </mesh>
        <mesh material={arowana} position={[0, 0, -0.23]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.05, 0.1, 4]} />
        </mesh>
      </group>
      {small.map((m, i) => (
        <group key={i} ref={(el) => (smalls.current[i] = el)}>
          <mesh material={m} scale={[0.6, 1, 1.4]}>
            <sphereGeometry args={[0.025, 8, 6]} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => (bubbles.current[i] = el)} material={bubble}>
          <sphereGeometry args={[0.012, 6, 4]} />
        </mesh>
      ))}
      {/* 掛鐘的鐘擺 */}
      <group ref={pendulum} position={[T.x + 1.55, 2.12, HB.z0 + IN + 0.15]}>
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[0.01, 0.26, 0.01]} />
          <meshStandardMaterial color="#d8a93a" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.01, 12]} />
          <meshStandardMaterial color="#d8a93a" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      <AcaiFamily outline={outline} />
    </group>
  )
}

/** 阿財伯（看得到阿嬤）與秀娟：依時段換位置、姿勢。阿財伯站著餵魚、坐藤椅是兩個分身（坐著的不畫腳，跟山上坐著的鬼一樣） */
function AcaiFamily({ outline }: { outline: boolean }) {
  const stand = useRef<THREE.Group>(null)
  const sit = useRef<THREE.Group>(null)
  const juan = useRef<THREE.Group>(null)
  const dStand = useRef<Drive>(newDrive({ pose: 'reach', heading: -Math.PI / 2 }))
  const dSit = useRef<Drive>(newDrive({ pose: 'sit', heading: BI.armchair.heading }))
  const dJ = useRef<Drive>(newDrive({ pose: 'sit', heading: Math.PI }))
  const sA = SPECS.acai
  const sJ = SPECS.xiujuan
  const A = BI.armchair
  // 坐著：椅面高減掉坐姿的臀部高
  const seatA = FY + 0.46 - SEAT_Y * sA.scale + 0.03
  const seatJ = FY + 0.42 - SEAT_Y * sJ.scale + 0.03
  useEffect(() => {
    dStand.current.expr = 'awake'
    dSit.current.expr = 'awake'
    dJ.current.expr = 'awake'
  }, [])
  useFrame(() => {
    const s = useStore.getState()
    if (s.scene !== 'village') return
    const st = acaiState(s)
    if (!stand.current || !sit.current || !juan.current) return
    stand.current.visible = st === 'feed'
    sit.current.visible = st === 'tv' || st === 'doze'
    juan.current.visible = st === 'tv'
    // 醒著的時候，阿嬤靠近就轉頭看她、笑；睡著了閉眼
    const g = st === 'feed' ? stand.current : sit.current
    const d = st === 'feed' ? dStand.current : dSit.current
    const near = Math.hypot(player.x - g.position.x, player.z - g.position.z) < 3
    if (st === 'doze') {
      d.expr = 'asleep'
      d.heading = A.heading
    } else {
      d.expr = near ? 'happy' : 'awake'
      d.heading = near ? Math.atan2(player.x - g.position.x, player.z - g.position.z) : st === 'feed' ? -Math.PI / 2 : A.heading
    }
  })
  return (
    <group>
      <group ref={stand} position={[BI.feed.x, FY, BI.feed.z]} visible={false}>
        <Chibi spec={sA} drive={dStand} outline={outline} />
      </group>
      <group ref={sit} position={[A.x, seatA, A.z]} visible={false}>
        <Chibi spec={sA} drive={dSit} outline={outline} legs={false} />
      </group>
      <group ref={juan} position={[BI.sofa.x - 0.45, seatJ, BI.sofa.z - 0.05]} visible={false}>
        <Chibi spec={sJ} drive={dJ} outline={outline} legs={false} />
      </group>
    </group>
  )
}
