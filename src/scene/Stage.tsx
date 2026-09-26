import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'
import { STAGE, stageMode, type StageMode } from '../world/sceneStage'
import { WBox, useMats } from './kit'
import { Lantern } from './House'
import { MergeStatic } from './MergeStatic'
import { StageShow } from './StageShow'
import { backdropTex, canopyTex, drapeTex, headerTex, skirtTex, tarpTex, wingTex } from './StageTex'
import '../chars/specs.stage'

// 廟埕野台戲（DESIGN §26.1）：土地公廟埕西側的戲台車，面向東（廟埕、鏡頭這邊）。
// 平常：竹架子、摺起來的帆布、疊起來的塑膠椅。節日（土地公生、中元普渡）：彩繪布景、對聯、
// 團名招牌、紅布幔、條紋棚頂、後場的鑼鼓；中元再加上石拜桌上的普渡供品和燈篙。
// 會動的（演員、觀眾、燈、字幕機、音樂）在 StageShow.tsx。規則與位置在 src/world/sceneStage.ts。

const D = STAGE.deck
const CX = (D.x0 + D.x1) / 2
const CZ = (D.z0 + D.z1) / 2
const W = D.x1 - D.x0
const L = D.z1 - D.z0
/** 對聯板中心離台面邊緣多遠（在台外） */
const WING_OUT = 0.44

export function FestivalStage() {
  const night = useStore((s) => s.meta.night)
  const phase = useStore((s) => s.phase)
  const quality = useStore((s) => s.quality)
  const mode = stageMode(night, phase)
  return (
    <group>
      {/* 換模式（節日開演／散場）時重新合併靜態網格 */}
      <MergeStatic key={mode}>
        <Deck mode={mode} />
        <Stairs />
        <Backstage />
        <Benches />
        <StoneAltar />
        <OldStool />
        <GroundSpeaker covered={mode === 'bare'} />
        {mode === 'bare' ? <BareFrame /> : <Dressed />}
        {mode === 'zhongyuan' && <Offerings />}
        {mode === 'zhongyuan' && <LanternPole />}
      </MergeStatic>
      {mode !== 'bare' && <StageShow mode={mode} outline={quality === 'high'} />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 戲台車：鐵架台身、木板台面、輪子
// ---------------------------------------------------------------------------

function Deck({ mode }: { mode: StageMode }) {
  const skirt = useMemo(() => new THREE.MeshStandardMaterial({ map: skirtTex(), roughness: 0.85 }), [])
  return (
    <group>
      <WBox mat="metal" size={[W - 0.3, 0.62, L - 0.3]} position={[CX, 0.55, CZ]} />
      <WBox mat="wood" size={[W + 0.1, 0.12, L + 0.1]} position={[CX, D.y - 0.06, CZ]} />
      <WBox mat="darkWood" size={[0.08, 0.14, L + 0.14]} position={[D.x1 + 0.06, D.y - 0.07, CZ]} />
      {/* 輪子（從台前看被布幔擋住；平常看得到） */}
      {[D.z0 + 0.75, D.z1 - 0.75].flatMap((z) =>
        [D.x0 + 0.2, D.x1 - 0.2].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 0.36, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.36, 0.36, 0.28, 18]} />
            <meshStandardMaterial color="#1c1c1e" roughness={0.8} />
          </mesh>
        )),
      )}
      {mode !== 'bare' && (
        <mesh material={skirt} position={[D.x1 + 0.13, 0.52, CZ]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[L + 0.1, 1.0]} />
        </mesh>
      )}
    </group>
  )
}

/** 台南邊：上台的木樓梯、戲箱（班主站在戲箱旁邊） */
function Stairs() {
  const trunk = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6a2a1c', roughness: 0.6 }), [])
  const steps = [0.33, 0.66, 0.99]
  return (
    <group>
      {steps.map((top, i) => (
        <WBox key={top} mat="wood" size={[1.0, top, 0.22]} position={[-12.3, top / 2, D.z1 + 0.54 - i * 0.2]} />
      ))}
      {[
        [-11.1, 0.25, 0.8, 0.5],
        [-10.3, 0.25, 0.7, 0.5],
        [-10.75, 0.72, 0.6, 0.44],
      ].map(([x, y, w, h], i) => (
        <group key={i} position={[x, y, D.z1 + 0.33]}>
          <mesh material={trunk} castShadow receiveShadow>
            <boxGeometry args={[w, h, 0.5]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <WBox key={sx} mat="gold" size={[0.05, h + 0.01, 0.06]} position={[(sx * w) / 2, 0, 0.23]} castShadow={false} />
          ))}
          <WBox mat="gold" size={[0.14, 0.08, 0.02]} position={[0, h / 2 - 0.1, 0.26]} castShadow={false} />
        </group>
      ))}
    </group>
  )
}

/** 戲台後面：戲班的貨車、晾戲服的帆布棚 */
function Backstage() {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8e4da', roughness: 0.7 }), [])
  const cab = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2e5f9e', roughness: 0.45 }), [])
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a2430', roughness: 0.15, metalness: 0.4 }), [])
  const tarp = useMemo(() => new THREE.MeshStandardMaterial({ map: tarpTex(), roughness: 0.9, side: THREE.DoubleSide }), [])
  const costumes = ['#c8302a', '#e8c066', '#6fa8dc', '#e8709a', '#f2efe6']
  return (
    <group>
      {/* 貨車：車斗（白）＋車頭（藍） */}
      <mesh material={body} position={[-15.3, 1.35, -0.55]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 1.9, 1.9]} />
      </mesh>
      <mesh material={cab} position={[-15.3, 0.95, 1.0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.3, 1.1]} />
      </mesh>
      <mesh material={glass} position={[-15.3, 1.25, 1.56]}>
        <planeGeometry args={[1.9, 0.5]} />
      </mesh>
      {[-1.2, 1.1].flatMap((z) =>
        [-16.4, -14.2].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 0.32, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.32, 0.32, 0.26, 14]} />
            <meshStandardMaterial color="#1c1c1e" roughness={0.8} />
          </mesh>
        )),
      )}
      {/* 帆布棚與掛著的戲服 */}
      <mesh material={tarp} position={[-15.2, 2.25, 2.3]} rotation={[-Math.PI / 2 + 0.12, 0, 0]}>
        <planeGeometry args={[3.2, 1.5]} />
      </mesh>
      {[-16.7, -13.7].map((x) => (
        <WBox key={x} mat="metal" size={[0.05, 2.2, 0.05]} position={[x, 1.1, 2.95]} />
      ))}
      <WBox mat="metal" size={[2.4, 0.03, 0.03]} position={[-15.2, 1.75, 2.6]} castShadow={false} />
      {costumes.map((c, i) => (
        <mesh key={i} position={[-16.1 + i * 0.45, 1.25, 2.6]} castShadow>
          <boxGeometry args={[0.36, 0.95, 0.06]} />
          <meshStandardMaterial color={c} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/** 觀眾的長板凳（平常空著） */
function Benches() {
  const y = STAGE.bench.seatY
  const len = STAGE.bench.z1 - STAGE.bench.z0
  const cz = (STAGE.bench.z0 + STAGE.bench.z1) / 2
  return (
    <group>
      {STAGE.benchXs.map((x) => (
        <group key={x}>
          <WBox mat="wood" size={[STAGE.bench.w, 0.06, len]} position={[x, y - 0.03, cz]} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <WBox mat="darkWood" size={[0.06, y - 0.06, 0.06]} position={[x - 0.12, (y - 0.06) / 2, cz + s * (len / 2 - 0.2)]} />
              <WBox mat="darkWood" size={[0.06, y - 0.06, 0.06]} position={[x + 0.12, (y - 0.06) / 2, cz + s * (len / 2 - 0.2)]} />
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

/** 廟埕的石拜桌（天公爐南邊，平常是空的） */
function StoneAltar() {
  const a = STAGE.altar
  return (
    <group position={[a.x, 0, a.z]}>
      <WBox mat="stone" size={[a.w, 0.1, a.d]} position={[0, a.h - 0.05, 0]} />
      {[-1, 1].map((s) => (
        <WBox key={s} mat="stone" size={[0.34, a.h - 0.1, a.d - 0.1]} position={[s * (a.w / 2 - 0.3), (a.h - 0.1) / 2, 0]} />
      ))}
    </group>
  )
}

/** 老竹凳：阿嬤年輕時跟阿公坐在這裡看戲（回憶碎片的位置） */
function OldStool() {
  const p = STAGE.oldStool
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, 0.4, 0]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.05, 14]} />
        <meshStandardMaterial color="#9a7e46" roughness={0.7} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <mesh key={i} position={[Math.cos(a) * 0.13, 0.19, Math.sin(a) * 0.13]} rotation={[Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]}>
            <cylinderGeometry args={[0.022, 0.026, 0.4, 6]} />
            <meshStandardMaterial color="#8a6e3a" roughness={0.7} />
          </mesh>
        )
      })}
      <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.012, 5, 16]} />
        <meshStandardMaterial color="#8a6e3a" roughness={0.7} />
      </mesh>
    </group>
  )
}

/** 地上的大喇叭（平常蓋著帆布） */
function GroundSpeaker({ covered }: { covered: boolean }) {
  const p = STAGE.speaker
  const tarp = useMemo(() => new THREE.MeshStandardMaterial({ map: tarpTex(), roughness: 0.9 }), [])
  return (
    <group position={[p.x, 0, p.z]}>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <WBox key={`${sx}${sz}`} mat="metal" size={[0.04, 0.3, 0.04]} position={[sx * 0.22, 0.15, sz * 0.2]} castShadow={false} />),
      )}
      {covered ? (
        <mesh material={tarp} position={[0, 0.82, 0]} castShadow>
          <boxGeometry args={[0.66, 1.05, 0.6]} />
        </mesh>
      ) : (
        <group position={[0, 0.82, 0]}>
          <WBox mat="black" size={[0.58, 1.0, 0.52]} />
          {[0.2, -0.2].map((y) => (
            <mesh key={y} position={[0.265, y, 0]} rotation={[0, Math.PI / 2, 0]}>
              <circleGeometry args={[0.19, 20]} />
              <meshStandardMaterial color="#2a2a30" roughness={0.95} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 平常：只有竹架子、摺好的帆布、疊起來的塑膠椅
// ---------------------------------------------------------------------------

function BareFrame() {
  const mats = useMats()
  const tarp = useMemo(() => new THREE.MeshStandardMaterial({ map: tarpTex(), roughness: 0.9 }), [])
  const stool = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8302a', roughness: 0.5 }), [])
  const top = 4.3
  const posts: [number, number][] = [
    [D.x0 + 0.1, D.z0 + 0.1],
    [D.x0 + 0.1, D.z1 - 0.1],
    [D.x1 - 0.1, D.z0 + 0.1],
    [D.x1 - 0.1, D.z1 - 0.1],
  ]
  return (
    <group>
      {posts.map(([x, z]) => (
        <mesh key={`${x}${z}`} material={mats.bamboo} position={[x, (D.y + top) / 2, z]} castShadow>
          <cylinderGeometry args={[0.05, 0.055, top - D.y, 8]} />
        </mesh>
      ))}
      {[D.x0 + 0.1, D.x1 - 0.1].map((x) => (
        <mesh key={x} material={mats.bamboo} position={[x, top, CZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, L, 8]} />
        </mesh>
      ))}
      {[D.z0 + 0.1, D.z1 - 0.1].map((z) => (
        <mesh key={z} material={mats.bamboo} position={[CX, top, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, W, 8]} />
        </mesh>
      ))}
      {/* 後面的斜撐 */}
      <mesh material={mats.bamboo} position={[D.x0 + 0.1, (D.y + top) / 2, CZ]} rotation={[Math.atan2(L - 0.2, top - D.y), 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, Math.hypot(L - 0.2, top - D.y), 6]} />
      </mesh>
      {/* 摺好的帆布 */}
      <mesh material={tarp} position={[-12.3, D.y + 0.2, 1.4]} rotation={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[1.5, 0.38, 1.1]} />
      </mesh>
      <mesh material={tarp} position={[-12.2, D.y + 0.48, 1.35]} rotation={[0, -0.15, 0]} castShadow>
        <boxGeometry args={[1.1, 0.18, 0.8]} />
      </mesh>
      {/* 疊起來的紅色塑膠椅 */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} material={stool} position={[-10.4, D.y + 0.21 + i * 0.09, -0.6]} castShadow>
          <cylinderGeometry args={[0.17, 0.21, 0.42, 12, 1, true]} />
        </mesh>
      ))}
      <mesh material={stool} position={[-10.4, D.y + 0.43 + 4 * 0.09, -0.6]}>
        <cylinderGeometry args={[0.17, 0.17, 0.02, 12]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 節日：彩繪的戲台
// ---------------------------------------------------------------------------

function Dressed() {
  const mats = useMats()
  const back = useMemo(() => new THREE.MeshStandardMaterial({ map: backdropTex(), roughness: 0.85 }), [])
  const header = useMemo(() => new THREE.MeshStandardMaterial({ map: headerTex(), roughness: 0.6, emissive: '#3a0a06', emissiveIntensity: 0.4 }), [])
  const wingN = useMemo(() => new THREE.MeshStandardMaterial({ map: wingTex('鳳鳴春曉'), roughness: 0.6 }), [])
  const wingS = useMemo(() => new THREE.MeshStandardMaterial({ map: wingTex('歌舞昇平'), roughness: 0.6 }), [])
  const canopy = useMemo(() => {
    const t = canopyTex()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide })
  }, [])
  const top = 4.5
  const posts: [number, number][] = [
    [D.x0 + 0.07, D.z0 + 0.07],
    [D.x0 + 0.07, D.z1 - 0.07],
    [D.x1 - 0.07, D.z0 + 0.07],
    [D.x1 - 0.07, D.z1 - 0.07],
  ]
  const wingH = 3.74 - D.y
  return (
    <group>
      {posts.map(([x, z]) => (
        <WBox key={`${x}${z}`} mat="redPaint" size={[0.14, top - D.y, 0.14]} position={[x, (D.y + top) / 2, z]} />
      ))}
      {/* 條紋棚頂（前低後高）與前緣的垂邊 */}
      <mesh material={canopy} position={[CX + 0.15, top + 0.12, CZ]} rotation={[0, 0, -0.08]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.6, 0.04, L + 0.5]} />
      </mesh>
      <mesh material={canopy} position={[D.x1 + 0.44, top - 0.02, CZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[L + 0.5, 0.26]} />
      </mesh>
      {/* 團名招牌 */}
      <mesh material={header} position={[D.x1 + 0.09, 4.06, CZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[L + 0.1, 0.62]} />
      </mesh>
      <WBox mat="darkWood" size={[0.08, 0.66, L + 0.16]} position={[D.x1 + 0.04, 4.06, CZ]} />
      {/* 布景 */}
      <mesh material={back} position={[D.x0 + 0.13, D.y + 1.55, CZ]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[L - 0.1, 3.1]} />
      </mesh>
      <WBox mat="darkWood" size={[0.08, 3.2, L]} position={[D.x0 + 0.08, D.y + 1.55, CZ]} />
      {/* 兩側對聯板：立在台面兩邊外側（鏡頭從東南看過來，放在台上會擋住演員） */}
      <mesh material={wingN} position={[D.x1 - 0.1, D.y + wingH / 2, D.z0 - WING_OUT]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.8, wingH]} />
      </mesh>
      <mesh material={wingS} position={[D.x1 - 0.1, D.y + wingH / 2, D.z1 + WING_OUT]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.8, wingH]} />
      </mesh>
      {[D.z0 - WING_OUT, D.z1 + WING_OUT].map((z) => (
        <group key={z}>
          <WBox mat="darkWood" size={[0.06, wingH, 0.84]} position={[D.x1 - 0.14, D.y + wingH / 2, z]} />
          {/* 固定在台角柱子上的橫撐 */}
          {[D.y + 0.25, D.y + wingH - 0.25].map((y) => (
            <WBox key={y} mat="darkWood" size={[0.06, 0.07, WING_OUT]} position={[D.x1 - 0.1, y, (z + (z < CZ ? D.z0 : D.z1)) / 2]} castShadow={false} />
          ))}
        </group>
      ))}
      <BandCorner />
      {/* 台上後面南角的小喇叭（放前面會擋到演員） */}
      <group position={[D.x0 + 0.5, D.y + 0.42, D.z1 - 0.35]}>
        <WBox mat="black" size={[0.42, 0.8, 0.4]} />
        <mesh position={[0.215, 0.12, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.14, 18]} />
          <meshStandardMaterial color="#2a2a30" roughness={0.95} />
        </mesh>
      </group>
      <mesh material={mats.black} position={[CX, top - 0.1, CZ]}>
        <boxGeometry args={[0.04, 0.04, L]} />
      </mesh>
    </group>
  )
}

/** 後場：大鼓、鑼架、鈸、嗩吶、空著的椅子（打鼓的阿明喝醉了） */
function BandCorner() {
  const mats = useMats()
  const drumBody = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a2a1c', roughness: 0.5 }), [])
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: '#efe2c4', roughness: 0.8 }), [])
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.3, metalness: 0.85 }), [])
  const stool = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8302a', roughness: 0.5 }), [])
  const y = D.y
  const b = STAGE.band
  return (
    <group>
      {/* 大鼓在三腳架上 */}
      <group position={[b.x + 0.2, y, b.z - 0.15]}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2
          return <WBox key={i} mat="darkWood" size={[0.04, 0.62, 0.04]} position={[Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17]} rotation={[Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2]} />
        })}
        <mesh material={drumBody} position={[0, 0.72, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.25, 0.26, 20]} />
        </mesh>
        <mesh material={skin} position={[0, 0.855, 0]}>
          <cylinderGeometry args={[0.285, 0.285, 0.015, 20]} />
        </mesh>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <mesh key={i} material={mats.gold} position={[Math.cos(a) * 0.282, 0.8, Math.sin(a) * 0.282]}>
              <sphereGeometry args={[0.018, 6, 4]} />
            </mesh>
          )
        })}
      </group>
      {/* 鑼架：兩根柱子、橫桿、鑼面向台前 */}
      <group position={[D.x0 + 0.45, y, b.z]}>
        {[-0.38, 0.38].map((z) => (
          <WBox key={z} mat="darkWood" size={[0.05, 1.25, 0.05]} position={[0, 0.62, z]} />
        ))}
        <WBox mat="darkWood" size={[0.05, 0.05, 0.84]} position={[0, 1.24, 0]} />
        <mesh material={brass} position={[0.02, 0.86, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.27, 0.27, 0.03, 26]} />
        </mesh>
        <mesh material={brass} position={[0.04, 0.86, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.1, 0.012, 6, 18]} />
        </mesh>
      </group>
      {/* 板凳：鈸放在一張上，一張空著 */}
      {[
        [b.x - 0.2, b.z + 0.45],
        [b.x + 0.7, b.z + 0.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh material={stool} position={[0, 0.21, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.2, 0.42, 12, 1, true]} />
          </mesh>
          <mesh material={stool} position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.02, 12]} />
          </mesh>
        </group>
      ))}
      {[-0.07, 0.07].map((dx) => (
        <mesh key={dx} material={brass} position={[b.x - 0.2 + dx, y + 0.45, b.z + 0.45]} rotation={[0.1, 0, dx * 3]}>
          <cylinderGeometry args={[0.13, 0.13, 0.012, 20]} />
        </mesh>
      ))}
      {/* 嗩吶靠在鑼架邊 */}
      <mesh material={mats.darkWood} position={[D.x0 + 0.62, y + 0.35, b.z + 0.5]} rotation={[0.25, 0, 0.35]}>
        <cylinderGeometry args={[0.018, 0.03, 0.55, 8]} />
      </mesh>
      <mesh material={brass} position={[D.x0 + 0.52, y + 0.1, b.z + 0.43]} rotation={[0.25, 0, 0.35]}>
        <cylinderGeometry args={[0.09, 0.03, 0.12, 12, 1, true]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 中元普渡：石拜桌上的供品、燈篙
// ---------------------------------------------------------------------------

function Offerings() {
  const a = STAGE.altar
  const top = a.h
  const cloth = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.85 }), [])
  const drape = useMemo(() => new THREE.MeshStandardMaterial({ map: drapeTex('慶讚中元'), roughness: 0.85 }), [])
  const cans = useMemo(() => ['#c8302a', '#e8c066', '#3a8a5a', '#2d5a9a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3 })), [])
  const orange = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2922a', roughness: 0.55 }), [])
  const plate = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.3 }), [])
  const flame = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.5), toneMapped: false }), [])
  const leaf = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f8a3e', roughness: 0.7 }), [])
  const pine = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8b53a', roughness: 0.6 }), [])
  // 罐頭塔：3 層（3×3、2×2、1）
  const tower = (x: number, m: number) => {
    const out: [number, number, number, number][] = []
    for (let lv = 0; lv < 3; lv++) {
      const n = 3 - lv
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push([x + (i - (n - 1) / 2) * 0.1, top + 0.06 + lv * 0.11, (j - (n - 1) / 2) * 0.1, (m + lv) % 4])
    }
    return out
  }
  const canPos = [...tower(-0.55, 0), ...tower(0.55, 2)]
  return (
    <group position={[a.x, 0, a.z]}>
      <mesh material={cloth} position={[0, top + 0.01, 0]} receiveShadow>
        <boxGeometry args={[a.w + 0.1, 0.02, a.d + 0.08]} />
      </mesh>
      <mesh material={drape} position={[0, top - 0.3, a.d / 2 + 0.045]}>
        <planeGeometry args={[a.w + 0.08, 0.6]} />
      </mesh>
      {canPos.map(([x, y, z, m], i) => (
        <mesh key={i} material={cans[m]} position={[x, y, z]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.1, 10]} />
        </mesh>
      ))}
      {/* 水果盤 */}
      {[-0.05, 0.1].map((z, k) => (
        <group key={k} position={[k ? 1.05 : -1.05, top + 0.02, z]}>
          <mesh material={plate}>
            <cylinderGeometry args={[0.16, 0.12, 0.03, 16]} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const t = (i / 5) * Math.PI * 2
            return (
              <mesh key={i} material={orange} position={[i === 4 ? 0 : Math.cos(t) * 0.08, i === 4 ? 0.13 : 0.06, i === 4 ? 0 : Math.sin(t) * 0.08]} castShadow>
                <sphereGeometry args={[0.055, 10, 8]} />
              </mesh>
            )
          })}
        </group>
      ))}
      {/* 鳳梨（旺來） */}
      <mesh material={pine} position={[0, top + 0.12, 0.12]} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 0.2, 10]} />
      </mesh>
      <mesh material={leaf} position={[0, top + 0.28, 0.12]}>
        <coneGeometry args={[0.07, 0.14, 7]} />
      </mesh>
      {/* 蠟燭 */}
      {[-1.45, 1.45].map((x) => (
        <group key={x} position={[x, top, -0.12]}>
          <mesh material={cloth} position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.028, 0.03, 0.26, 8]} />
          </mesh>
          <mesh material={flame} position={[0, 0.29, 0]} scale={[1, 1.8, 1]}>
            <sphereGeometry args={[0.022, 8, 6]} />
          </mesh>
        </group>
      ))}
      {/* 西端：包粽子的竹籃與粽葉 */}
      <group position={[-a.w / 2 + 0.35, top, 0.02]}>
        <mesh position={[0, 0.09, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.15, 0.18, 14, 1, true]} />
          <meshStandardMaterial color="#b9a063" roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} material={leaf} position={[Math.cos(i * 1.6) * 0.07, 0.17 + (i % 2) * 0.04, Math.sin(i * 1.6) * 0.07]} rotation={[0.3, i, 0]}>
            <coneGeometry args={[0.07, 0.13, 3]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** 燈篙：豎起來的長竹竿，頂上留竹葉，掛一串燈籠（招引好兄弟來吃普渡） */
function LanternPole() {
  const mats = useMats()
  const p = STAGE.pole
  const banner = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2e6b8', roughness: 0.9, side: THREE.DoubleSide }), [])
  const h = 7.2
  return (
    <group position={[p.x, 0, p.z]}>
      <WBox mat="stone" size={[0.34, 0.2, 0.34]} position={[0, 0.1, 0]} />
      <mesh material={mats.bamboo} position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.07, h, 8]} />
      </mesh>
      <mesh material={mats.leaf} position={[0, h + 0.35, 0]} castShadow>
        <coneGeometry args={[0.35, 0.9, 7]} />
      </mesh>
      <mesh material={mats.bamboo} position={[0, h - 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
      </mesh>
      <Lantern position={[0, h - 1.05, 0.5]} drop={0.2} scale={0.7} />
      <Lantern position={[0, h - 1.05, -0.5]} drop={0.2} scale={0.7} />
      <Lantern position={[0, h - 2.0, 0]} drop={0.35} scale={0.8} />
      {/* 長長的布幡 */}
      <mesh material={banner} position={[0.06, h - 3.3, 0]} rotation={[0, Math.PI / 2, 0.03]}>
        <planeGeometry args={[0.32, 2.2]} />
      </mesh>
    </group>
  )
}
