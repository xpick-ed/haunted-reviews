import { VillageRiverPath } from './RiverPath'
import { VillageSchoolPath } from './SchoolPath'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, type Quality } from '../store'
import { VILLAGE } from '../world/sceneVillage'
import { lanternAt } from './daylight'
import { BRUSH_FONT, TILE, WBox, canvasTexture, planeGeo, seeded, useMats } from './kit'
import { GableRoof, Lantern, Wall, coupletTexture } from './House'
import { MergeStatic } from './MergeStatic'
import { Tree } from './Tree'
import { buildGrass } from './Landscape'
import { ChibiNpc } from '../chars/Chibi'
import { Corrugated, Crates, Ground, IronGrille, Paddies, Pole, PoleLine, corrugatedTexture, useWindowGlow } from './VillageKit'
import { Fader, InteriorCull } from './OldStreetFader'
import { ShopInterior, ShopTV } from './VillageShopInterior'
import { HouseADoors, HouseAInterior, HouseBDoor, HouseBInterior, VillageHousesLive } from './VillageHouses'

// 村路＋柑仔店（DESIGN §25.1）：一條東西向的鄉間小路。北邊（鏡頭對面）是紅磚厝、柑仔店、透天厝、老榕樹，
// 南邊（鏡頭這一側）只放矮的東西：水溝、水田，才不會擋住阿嬤。規則與座標在 src/world/sceneVillage.ts。

const V = VILLAGE
const SLOPE = 0.52

export function VillageScene() {
  const quality = useStore((s) => s.quality)
  const isNight = useStore((s) => s.isNight)
  return (
    <group>
      <VillageRiverPath />
      <VillageSchoolPath />
      <Grounds />
      <Greenery quality={quality} />
      <MergeStatic>
        <ShopBase />
        <HouseABase />
        <HouseBBase />
        <LowWalls />
        <Betel />
        <Wolf position={[V.bike.x, 0.02, V.bike.z]} />
        <BanyanCorner />
        {/* 走得進去的房子裡面（DESIGN §30） */}
        <ShopInterior />
        <HouseADoors />
        <HouseBInterior />
        <HouseBDoor />
      </MergeStatic>
      {/* 紅磚厝只有一扇門：低畫質時阿嬤不在裡面、門口附近就不畫裡面（柑仔店、透天厝的正面打開，一直畫） */}
      <InteriorCull ids={['village_house_a']} doors={[{ x: V.houseAIn.door.x, z: V.houseA.z1 }]}>
        <MergeStatic>
          <HouseAInterior />
        </MergeStatic>
      </InteriorCull>
      {/* 房子的外殼（正面、東牆、屋頂……）：阿嬤走進去、或房子擋住鏡頭時淡出 */}
      <Fader id="village_shop">
        <MergeStatic>
          <ShopShell />
        </MergeStatic>
        <ShopAwning />
      </Fader>
      <Fader id="village_house_a">
        <MergeStatic>
          <HouseAShell />
        </MergeStatic>
      </Fader>
      <Fader id="village_house_b">
        <MergeStatic>
          <HouseBShell />
        </MergeStatic>
      </Fader>
      <ShopFront />
      <ShopTV />
      <VillageHousesLive outline={quality === 'high'} />
      {/* 夾娃娃機就在店門口東邊：走進店裡時跟外殼一起淡出 */}
      <Fader id="village_shop">
        <ClawMachine />
      </Fader>
      <PoleLine xs={V.poleXs} z={V.poleZ} lamps={V.lampXs} lampZ={-1.25} skip={V.fadePoles} />
      {V.fadePoles.map((x) => (
        <Fader key={x} id={`village_pole_${x}`}>
          <Pole x={x} z={V.poleZ} />
        </Fader>
      ))}
      <Tree position={[V.banyan.x, 0, V.banyan.z]} scale={1.05} fadeId="village_banyan" />
      <Tree position={[-27, 0, -12]} scale={0.7} />
      <ChibiNpc id="ajiao" pose="fan" position={[V.ajiao.x, 0.14, V.ajiao.z]} heading={0} seesGhosts outline={quality === 'high'} />
      <VillageLights />
      <group visible={isNight}>
        <Sparkles count={36} scale={[40, 1.4, 12]} position={[0, 0.8, 9]} size={3.5} speed={0.3} color="#e8ff8a" opacity={0.9} noise={1.4} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 地面：草地、柏油小路、水溝、水田
// ---------------------------------------------------------------------------

function Grounds() {
  const mats = useMats()
  const roadMat = useMemo(() => {
    const m = mats.yard.clone()
    m.color.setRGB(0.6, 0.6, 0.62)
    return m
  }, [mats])
  const ditchWater = useMemo(() => new THREE.MeshStandardMaterial({ color: '#141c20', roughness: 0.1, metalness: 0.3 }), [])
  const d = V.ditch
  return (
    <group>
      <mesh geometry={planeGeo(200, 200, TILE.grass)} material={mats.grass} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow />
      <mesh geometry={planeGeo(120, V.roadWidth, TILE.yard)} material={roadMat} rotation-x={-Math.PI / 2} position={[0, 0.02, V.roadZ]} receiveShadow />
      {/* 路面的白色邊線（褪色、斷斷續續） */}
      {[-1, 1].map((s) => (
        <mesh key={s} rotation-x={-Math.PI / 2} position={[0, 0.025, s * (V.roadWidth / 2 - 0.15)]}>
          <planeGeometry args={[120, 0.08]} />
          <meshStandardMaterial color="#d9d6cc" roughness={0.9} transparent opacity={0.55} />
        </mesh>
      ))}
      {/* 房子前面的泥土地 */}
      <Ground mat="mud" w={60} d={2.6} position={[0, 0.012, -3.2]} tint="#8d7b62" />
      {/* 水溝：兩道水泥矮牆，中間是水 */}
      {[d.z0, d.z1].map((z) => (
        <WBox key={z} mat="stone" size={[120, 0.3, 0.12]} position={[0, 0.15, z]} />
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, (d.z0 + d.z1) / 2]} material={ditchWater}>
        <planeGeometry args={[120, d.z1 - d.z0]} />
      </mesh>
      {/* 路南邊的水田（鏡頭這一側，只放矮的）、房子後面也是田 */}
      <Paddies xs={[-36, -24, -12, 0, 12, 24, 36]} zs={[2.95, 12, 21, 30]} />
      <Paddies xs={[-36, -24, -12, 0, 12, 24, 36]} zs={[-40, -28, -16]} />
    </group>
  )
}

function villageGround(x: number, z: number): 'grass' | null {
  if (z > -1.95 && z < 30) return null // 路、水溝、水田
  if (z < -16) return null // 後面的田
  if (z < -2.3) {
    if (x > V.houseA.x0 - 0.4 && x < V.houseA.x1 + 0.3 && z > V.houseA.z0 - 0.4) return null
    if (x > V.shop.x0 - 0.3 && x < V.shop.x1 + 0.3 && z > V.shop.z0 - 0.4) return null
    if (x > V.houseB.x0 - 0.3 && x < V.houseB.x1 + 0.4 && z > V.houseB.z0 - 0.4) return null
  }
  if (z > -4.6) return null // 房子前面的泥土地
  if (Math.hypot(x - V.banyan.x, z - V.banyan.z) < 1.5) return null
  return 'grass'
}

function Greenery({ quality }: { quality: Quality }) {
  const grass = useMemo(() => buildGrass(quality, { ground: villageGround, rMin: 1, rSpan: 26, seed: 5151, scale: 0.8 }), [quality])
  const bushes = useMemo(() => {
    const r = seeded(808)
    const spots: [number, number][] = [
      [-6.4, -5.4],
      [-5.2, -5.5],
      [4.4, -5.4],
      [5.6, -5.5],
      [-15.6, -5.5],
      [-16.8, -5.3],
      [13.2, -6.2],
      [21.5, -5.8],
      [22.6, -4.8],
    ]
    return spots.map(([x, z], i) => ({ x, z, s: 0.5 + r() * 0.35, c: i % 3 }))
  }, [])
  const bushMats = useMemo(() => ['#2f5a35', '#3a6a3a', '#284d30'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })), [])
  return (
    <group>
      <primitive object={grass.grass} />
      <primitive object={grass.flowers} />
      {bushes.map((b, i) => (
        <mesh key={i} position={[b.x, b.s * 0.6, b.z]} scale={[b.s * 1.3, b.s, b.s]} material={bushMats[b.c]} castShadow receiveShadow>
          <icosahedronGeometry args={[0.7, 1]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 柑仔店：店身（牆、屋頂、招牌、貨架）
// ---------------------------------------------------------------------------

const S = V.shop
const RIDGE_Z = (S.z0 + S.z1) / 2
const RIDGE_Y = S.wallTop + ((S.z1 - S.z0) / 2) * SLOPE
const SHOP_DOOR = [{ c: 0, w: V.shopIn.openHalf * 2, y0: 0, y1: 2.6 }]
/** 後牆右邊的後門（掛門簾，通阿嬌家） */
const SHOP_BACKDOOR = [{ c: V.shopIn.backDoor.x, w: V.shopIn.backDoor.w, y0: 0, y1: 2.3 }]

/** 兩側的三角山牆（擠出的多邊形） */
function GableEnd({ x, z0, z1, wallTop, ridgeY, mat }: { x: number; z0: number; z1: number; wallTop: number; ridgeY: number; mat: 'plaster' | 'brick' }) {
  const mats = useMats()
  const geo = useMemo(() => {
    const zm = (z0 + z1) / 2
    const pts: [number, number][] = [
      [z0, wallTop - 0.01],
      [z1, wallTop - 0.01],
      [zm, ridgeY],
    ]
    const shape = new THREE.Shape(pts.map(([u, y]) => new THREE.Vector2(-u, y)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false })
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TILE[mat], uv.getY(i) / TILE[mat])
    return g
  }, [z0, z1, wallTop, ridgeY, mat])
  return <mesh geometry={geo} material={mats[mat]} position={[x - 0.15, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
}

function shopSignTexture() {
  return canvasTexture(
    1024,
    200,
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#c0332a')
      g.addColorStop(1, '#8f1e18')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#e9c46a'
      ctx.lineWidth = 10
      ctx.strokeRect(10, 10, w - 20, h - 20)
      // 日曬褪色的斑
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = `rgba(255,220,200,${Math.random() * 0.06})`
        ctx.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 80, 6 + Math.random() * 20)
      }
      ctx.fillStyle = '#fff6e2'
      ctx.font = `700 132px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('嬌 美 商 店', w / 2 - 70, h / 2 + 8)
      // 右邊的「菸酒」圓牌
      ctx.fillStyle = '#fbf6ea'
      ctx.beginPath()
      ctx.arc(w - 120, h / 2, 64, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#b3261e'
      ctx.font = `700 50px ${BRUSH_FONT}`
      ctx.fillText('菸酒', w - 120, h / 2 + 4)
    },
    [{ spec: `700 132px ${BRUSH_FONT}`, text: '嬌美商店菸酒' }],
  )
}

function verticalSignTexture(text: string, bg: string, fg: string) {
  return canvasTexture(
    96,
    96 * text.length + 40,
    (ctx, w, h) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = fg
      ctx.lineWidth = 5
      ctx.strokeRect(6, 6, w - 12, h - 12)
      ctx.fillStyle = fg
      ctx.font = `700 68px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ;[...text].forEach((ch, i) => ctx.fillText(ch, w / 2, 20 + 48 + i * 96))
    },
    [{ spec: `700 68px ${BRUSH_FONT}`, text }],
  )
}

/** 柑仔店不會淡出的部分：亭仔腳的地、店裡的磁磚地、後牆（右邊開後門）、西牆和西邊山牆、亭仔腳的木柱與橫樑、柱子上的直式小招牌 */
function ShopBase() {
  const mats = useMats()
  const side = useMemo(() => verticalSignTexture('冷飲雜貨', '#f4efe2', '#1d4f8a'), [])
  const slab = useMemo(() => {
    const m = mats.yard.clone()
    m.color.set('#b9b3a6')
    return m
  }, [mats])
  return (
    <group>
      {/* 亭仔腳的水泥地（高一階）與店裡的磁磚地 */}
      <mesh geometry={planeGeo(S.x1 - S.x0 + 0.2, S.z1 - V.awning.z1 + 0.1, TILE.yard)} material={slab} rotation-x={-Math.PI / 2} position={[0, 0.14, (S.z1 + V.awning.z1) / 2]} receiveShadow />
      <WBox mat="stone" size={[S.x1 - S.x0 + 0.2, 0.14, S.z1 - V.awning.z1 + 0.1]} position={[0, 0.07, (S.z1 + V.awning.z1) / 2]} castShadow={false} />
      <mesh geometry={planeGeo(S.x1 - S.x0, S.z1 - S.z0, TILE.tile)} material={mats.tile} rotation-x={-Math.PI / 2} position={[0, 0.141, RIDGE_Z]} receiveShadow />
      <WBox mat="stone" size={[S.x1 - S.x0, 0.14, S.z1 - S.z0]} position={[0, 0.07, RIDGE_Z]} castShadow={false} />
      <Wall axis="x" from={S.x0} to={S.x1} at={S.z0} base={0} top={S.wallTop} mat="plaster" skirtH={0.5} openings={SHOP_BACKDOOR} />
      <Wall axis="z" from={S.z0} to={S.z1} at={S.x0} base={0} top={S.wallTop} mat="plaster" skirtH={0.5} />
      <GableEnd x={S.x0} z0={S.z0} z1={S.z1} wallTop={S.wallTop} ridgeY={RIDGE_Y} mat="plaster" />
      {/* 右邊柱子上的直式小招牌 */}
      <mesh position={[V.awning.postX - 0.02, 1.7, V.awning.postZ + 0.09]}>
        <planeGeometry args={[0.24, 1.1]} />
        <meshStandardMaterial map={side} roughness={0.6} />
      </mesh>
      {/* 亭仔腳：木柱、橫樑 */}
      {[-1, 1].map((s) => (
        <WBox key={s} mat="darkWood" size={[0.14, 2.45, 0.14]} position={[s * V.awning.postX, 0.14 + 1.225, V.awning.postZ]} />
      ))}
      <WBox mat="darkWood" size={[S.x1 - S.x0 + 0.1, 0.12, 0.12]} position={[0, 2.52, V.awning.postZ]} />
    </group>
  )
}

/** 柑仔店會淡出的外殼：正面（整片打開）、東牆和東邊山牆、屋頂、招牌 */
function ShopShell() {
  const sign = useMemo(shopSignTexture, [])
  return (
    <group>
      <Wall axis="x" from={S.x0} to={S.x1} at={S.z1} base={0} top={S.wallTop} mat="plaster" openings={SHOP_DOOR} skirtH={0.5} />
      <Wall axis="z" from={S.z0} to={S.z1} at={S.x1} base={0} top={S.wallTop} mat="plaster" skirtH={0.5} />
      <GableEnd x={S.x1} z0={S.z0} z1={S.z1} wallTop={S.wallTop} ridgeY={RIDGE_Y} mat="plaster" />
      <GableRoof axis="x" ridge={RIDGE_Z} ridgeY={RIDGE_Y} from={S.x0 - 0.45} to={S.x1 + 0.45} edges={[S.z0 - 0.45, S.z1 + 0.35]} style="horseback" />
      {/* 招牌（在亭仔腳上面、屋簷下面） */}
      <mesh position={[0, 3.26, S.z1 + 0.185]}>
        <planeGeometry args={[5.2, 1.0]} />
        <meshStandardMaterial map={sign} roughness={0.55} />
      </mesh>
      <WBox mat="darkWood" size={[5.4, 1.12, 0.05]} position={[0, 3.26, S.z1 + 0.15]} castShadow={false} />
    </group>
  )
}

/** 亭仔腳的鐵皮浪板（走進店裡時擋住鏡頭，跟外殼一起淡出）。尺寸是常數：Corrugated 依 size 建材質，每次重畫都換新的會跳過淡出 */
const AW_LEN = Math.hypot(S.z1 - V.awning.z1, V.awning.y0 - V.awning.y1)
const AW_SIZE: [number, number] = [S.x1 - S.x0 + 0.5, AW_LEN + 0.1]
const AW_POS: [number, number, number] = [0, (V.awning.y0 + V.awning.y1) / 2 + 0.02, (S.z1 + V.awning.z1) / 2]
const AW_TILT = Math.atan2(V.awning.y0 - V.awning.y1, S.z1 - V.awning.z1)
function ShopAwning() {
  return <Corrugated position={AW_POS} size={AW_SIZE} tilt={AW_TILT} color="#6d9a96" />
}

// ---------------------------------------------------------------------------
// 柑仔店門口：亭仔腳的浪板、櫃台、糖果罐、汽水冰箱、公共電話、板凳、木板門、零食串
// （有會動、會發光的東西，不合併）
// ---------------------------------------------------------------------------

const glassMat = new THREE.MeshStandardMaterial({ color: '#dfeff2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false })

function ShopFront() {
  const mats = useMats()
  const C = V.counter
  const top = 0.14 + C.h
  const candy = useMemo(() => ['#e8423a', '#f2c230', '#58b36a', '#f08a2a', '#e46aa4'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 })), [])
  const snackMats = useMemo(() => ['#e8423a', '#f2c230', '#2e6fb5', '#f4efe2', '#58b36a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, side: THREE.DoubleSide })), [])
  return (
    <group userData={{ noMerge: true }}>
      {/* 櫃台：木頭底座＋玻璃櫃（裡面擺小東西）＋桌面 */}
      <WBox mat="darkWood" size={[C.w, 0.42, C.d]} position={[C.x, 0.14 + 0.21, C.z]} />
      <mesh material={glassMat} position={[C.x, 0.14 + 0.42 + 0.17, C.z]}>
        <boxGeometry args={[C.w - 0.06, 0.34, C.d - 0.06]} />
      </mesh>
      {[-0.7, -0.35, 0, 0.35, 0.7].map((x, i) => (
        <mesh key={x} material={candy[i]} position={[C.x + x, 0.14 + 0.5, C.z]}>
          <boxGeometry args={[0.22, 0.12, 0.3]} />
        </mesh>
      ))}
      <WBox mat="wood" size={[C.w + 0.08, 0.05, C.d + 0.08]} position={[C.x, top - 0.02, C.z]} />
      {/* 糖果罐 */}
      {[-0.75, -0.45, -0.15].map((x, i) => (
        <group key={x} position={[C.x + x, top, C.z + 0.05]}>
          <mesh material={candy[(i + 2) % candy.length]} position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.15, 12]} />
          </mesh>
          <mesh material={glassMat} position={[0, 0.11, 0]}>
            <cylinderGeometry args={[0.095, 0.095, 0.22, 14]} />
          </mesh>
          <mesh material={mats.redPaint} position={[0, 0.235, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.04, 12]} />
          </mesh>
        </group>
      ))}
      {/* 紅色鐵製錢箱、舊式電子秤 */}
      <mesh material={mats.redPaint} position={[C.x + 0.35, top + 0.06, C.z - 0.08]} castShadow>
        <boxGeometry args={[0.26, 0.12, 0.2]} />
      </mesh>
      <group position={[C.x + 0.75, top, C.z + 0.02]}>
        <mesh material={mats.metal} position={[0, 0.05, 0]} castShadow>
          <boxGeometry args={[0.26, 0.1, 0.26]} />
        </mesh>
        <mesh material={mats.metal} position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.015, 16]} />
        </mesh>
      </group>
      {/* 櫃台兩端的汽水箱 */}
      <Crates position={[-1.33, 0.14, -3.82]} color="#c8342b" stack={2} />
      <Crates position={[1.33, 0.14, -3.82]} color="#e2b72c" stack={2} />
      <Fridge />
      <Phone />
      {/* 板凳 */}
      <group position={[V.bench.x, 0.14, V.bench.z]}>
        <WBox mat="wood" size={[1.4, 0.05, 0.3]} position={[0, 0.42, 0]} />
        {[-0.6, 0.6].map((x) => (
          <WBox key={x} mat="wood" size={[0.05, 0.4, 0.26]} position={[x, 0.2, 0]} />
        ))}
      </group>
      {/* 收起來的木板門：一片一片靠在西邊的牆 */}
      {Array.from({ length: 6 }, (_, i) => (
        <WBox key={i} mat="wood" size={[0.3, 2.4, 0.04]} position={[-3.22, 1.36, S.z1 + 0.2 + i * 0.045]} rotation={[0.05, 0, 0]} />
      ))}
      {/* 櫃台上的算盤 */}
      <group position={[C.x - 0.05, top + 0.02, C.z + 0.12]} rotation={[0, 0.1, 0]}>
        <WBox mat="darkWood" size={[0.42, 0.03, 0.16]} castShadow={false} />
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} material={mats.black} position={[-0.18 + i * 0.045, 0.02, 0]}>
            <boxGeometry args={[0.03, 0.025, 0.12]} />
          </mesh>
        ))}
      </group>
      {/* 掛在門口的零食串 */}
      {[-2.2, -1.7, 1.6, 2.4].map((x, i) => (
        <group key={x} position={[x, 2.5, S.z1 + 0.05]}>
          <mesh material={mats.black} position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.6, 3]} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} material={snackMats[(i + k) % snackMats.length]} position={[0, -0.1 - k * 0.16, 0.01]} rotation={[0, 0.3 * (k % 2 ? 1 : -1), 0]}>
              <planeGeometry args={[0.14, 0.14]} />
            </mesh>
          ))}
        </group>
      ))}
      <Lantern position={[-1.8, 2.25, V.awning.postZ + 0.1]} drop={0.2} scale={0.6} />
    </group>
  )
}

/** 汽水冰箱：紅色櫃子、玻璃門裡一排一排的瓶子，晚上亮著 */
function Fridge() {
  const F = V.fridge
  const bottles = useMemo(
    () =>
      canvasTexture(128, 256, (ctx, w, h) => {
        ctx.fillStyle = '#dff4ff'
        ctx.fillRect(0, 0, w, h)
        const COL = ['#2e7d32', '#c62828', '#f9a825', '#1565c0', '#6d4c41']
        for (let row = 0; row < 4; row++) {
          const y = 12 + row * 62
          ctx.fillStyle = '#b0c4cc'
          ctx.fillRect(0, y + 50, w, 4)
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = COL[(row + i) % COL.length]
            const x = 6 + i * 20
            ctx.fillRect(x, y + 10, 14, 40)
            ctx.fillRect(x + 4, y, 6, 12)
          }
        }
      }),
    [],
  )
  const inside = useMemo(() => new THREE.MeshStandardMaterial({ map: bottles, emissiveMap: bottles, emissive: '#ffffff', emissiveIntensity: 0.3, roughness: 0.3 }), [bottles])
  const header = useMemo(() => verticalHeader(), [])
  useFrame(() => {
    inside.emissiveIntensity = 0.25 + 0.9 * lanternAt(useStore.getState().time)
  })
  return (
    <group position={[F.x, 0.14, F.z]}>
      <RoundedBox args={[0.72, 1.6, 0.62]} radius={0.04} smoothness={3} position={[0, 0.8, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#c62828" roughness={0.35} />
      </RoundedBox>
      <mesh material={inside} position={[0, 0.78, 0.312]}>
        <planeGeometry args={[0.56, 1.2]} />
      </mesh>
      <mesh material={glassMat} position={[0, 0.78, 0.318]}>
        <planeGeometry args={[0.58, 1.24]} />
      </mesh>
      <mesh position={[0, 1.5, 0.315]}>
        <planeGeometry args={[0.66, 0.16]} />
        <meshStandardMaterial map={header} roughness={0.5} />
      </mesh>
      <mesh position={[0.24, 0.78, 0.34]}>
        <boxGeometry args={[0.03, 0.4, 0.03]} />
        <meshStandardMaterial color="#d8d8d8" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  )
}

function verticalHeader() {
  return canvasTexture(
    256,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = '#f4efe2'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#c62828'
      ctx.font = `700 44px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('冰 涼 汽 水', w / 2, h / 2 + 3)
    },
    [{ spec: `700 44px ${BRUSH_FONT}`, text: '冰涼汽水' }],
  )
}

/** 公共電話：橘色話機、小雨遮、話筒掛在側邊 */
function Phone() {
  const mats = useMats()
  const P = V.phone
  const label = useMemo(
    () =>
      canvasTexture(
        192,
        48,
        (ctx, w, h) => {
          ctx.fillStyle = '#1d5a8a'
          ctx.fillRect(0, 0, w, h)
          ctx.fillStyle = '#ffffff'
          ctx.font = `700 30px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('公用電話', w / 2, h / 2 + 2)
        },
        [{ spec: `700 30px ${BRUSH_FONT}`, text: '公用電話' }],
      ),
    [],
  )
  return (
    <group position={[P.x, 0.14, P.z]}>
      <mesh material={mats.metal} position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 1.24, 8]} />
      </mesh>
      <RoundedBox args={[0.34, 0.46, 0.2]} radius={0.04} smoothness={2} position={[0, 1.42, 0]} castShadow>
        <meshStandardMaterial color="#e0782c" roughness={0.45} />
      </RoundedBox>
      {/* 按鍵、投幣孔 */}
      <mesh position={[0, 1.36, 0.105]}>
        <planeGeometry args={[0.16, 0.16]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.6} />
      </mesh>
      <mesh position={[0.1, 1.55, 0.105]}>
        <planeGeometry args={[0.06, 0.02]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 話筒 */}
      <mesh position={[-0.2, 1.45, 0.02]} rotation={[0, 0, 0.05]} castShadow>
        <capsuleGeometry args={[0.03, 0.26, 4, 8]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.5} />
      </mesh>
      {/* 雨遮 */}
      <mesh position={[0, 1.75, 0.02]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.46, 16, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color="#e8e2d4" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.04, 0.02]}>
        <planeGeometry args={[0.4, 0.1]} />
        <meshStandardMaterial map={label} roughness={0.6} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 紅磚厝（西）、透天厝（東）
// ---------------------------------------------------------------------------

const HA = V.houseA
const HA_RIDGE_Z = (HA.z0 + HA.z1) / 2
const HA_RIDGE_Y = HA.wallTop + ((HA.z1 - HA.z0) / 2) * SLOPE
const HA_DOOR_X = V.houseAIn.door.x
const HA_OPENINGS = [
  { c: HA_DOOR_X, w: V.houseAIn.door.w, y0: 0, y1: 2.2 },
  { c: -13.2, w: 1.2, y0: 0.95, y1: 2.05 },
  { c: -8.4, w: 1.2, y0: 0.95, y1: 2.05 },
]

/** 紅磚厝不會淡出的部分：後牆、西牆和西邊山牆、門口的瓦斯桶和盆栽 */
function HouseABase() {
  const mats = useMats()
  return (
    <group>
      <Wall axis="x" from={HA.x0} to={HA.x1} at={HA.z0} base={0} top={HA.wallTop} skirtH={0.55} />
      <Wall axis="z" from={HA.z0} to={HA.z1} at={HA.x0} base={0} top={HA.wallTop} skirtH={0.55} />
      <GableEnd x={HA.x0} z0={HA.z0} z1={HA.z1} wallTop={HA.wallTop} ridgeY={HA_RIDGE_Y} mat="brick" />
      {/* 瓦斯桶、盆栽 */}
      <mesh position={[-12.1, 0.36, HA.z1 + 0.4]} castShadow>
        <capsuleGeometry args={[0.16, 0.36, 4, 12]} />
        <meshStandardMaterial color="#8aa0b0" roughness={0.4} metalness={0.3} />
      </mesh>
      {[-7.55, -7.2].map((x, i) => (
        <group key={x} position={[x, 0, HA.z1 + 0.45 + i * 0.1]}>
          <mesh material={mats.terracotta} position={[0, 0.16, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.12, 0.32, 12]} />
          </mesh>
          <mesh material={mats.leaf} position={[0, 0.48, 0]} castShadow>
            <icosahedronGeometry args={[0.24, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 紅磚厝會淡出的外殼：正面（門開著、春聯、窗）、東牆和東邊山牆、屋頂 */
function HouseAShell() {
  // 沒人住了：窗裡只有神明燈紅紅的光
  const glow = useWindowGlow('#ff8a5c', 0.45)
  const left = useMemo(() => coupletTexture('歲歲平安'), [])
  const right = useMemo(() => coupletTexture('年年有餘'), [])
  return (
    <group>
      <Wall axis="x" from={HA.x0} to={HA.x1} at={HA.z1} base={0} top={HA.wallTop} openings={HA_OPENINGS} skirtH={0.55} />
      <Wall axis="z" from={HA.z0} to={HA.z1} at={HA.x1} base={0} top={HA.wallTop} skirtH={0.55} />
      <GableEnd x={HA.x1} z0={HA.z0} z1={HA.z1} wallTop={HA.wallTop} ridgeY={HA_RIDGE_Y} mat="brick" />
      <GableRoof axis="x" ridge={HA_RIDGE_Z} ridgeY={HA_RIDGE_Y} from={HA.x0 - 0.45} to={HA.x1 + 0.45} edges={[HA.z0 - 0.45, HA.z1 + 0.45]} style="horseback" />
      {/* 春聯 */}
      {[
        [-1, left],
        [1, right],
      ].map(([s, t]) => (
        <mesh key={s as number} position={[HA_DOOR_X + (s as number) * 0.72, 1.35, HA.z1 + 0.16]}>
          <planeGeometry args={[0.2, 1.1]} />
          <meshStandardMaterial map={t as THREE.Texture} roughness={0.85} />
        </mesh>
      ))}
      {/* 窗：玻璃（晚上泛紅光）＋鐵窗 */}
      {[-13.2, -8.4].map((x) => (
        <group key={x}>
          <mesh material={glow} position={[x, 1.5, HA.z1 - 0.05]}>
            <planeGeometry args={[1.2, 1.1]} />
          </mesh>
          <WBox mat="darkWood" size={[1.3, 0.08, 0.36]} position={[x, 0.93, HA.z1]} />
          <IronGrille position={[x, 1.5, HA.z1 + 0.22]} w={1.24} h={1.12} />
        </group>
      ))}
    </group>
  )
}

const HB = V.houseB
const HB_SHUTTER = { c: V.houseBIn.shutter.x, w: V.houseBIn.shutter.w }
const HB_OPENINGS_1F = [
  { c: HB_SHUTTER.c, w: HB_SHUTTER.w, y0: 0, y1: 2.6 },
  { c: V.houseBIn.door.x, w: V.houseBIn.door.w, y0: 0, y1: 2.2 },
]
const HB_OPENINGS_2F = [{ c: 9.6, w: 2.2, y0: 0.9, y1: 2.2 }]

function shutterTexture() {
  const t = canvasTexture(64, 256, (ctx, w, h) => {
    for (let y = 0; y < h; y += 8) {
      ctx.fillStyle = y % 16 ? '#8e949a' : '#a5abb1'
      ctx.fillRect(0, y, w, 8)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(0, y + 7, w, 1)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** 透天厝米色灰泥的材質（二樓） */
function useCream() {
  const mats = useMats()
  return useMemo(() => {
    const m = mats.plaster.clone()
    m.color.set('#eadfcc')
    return m
  }, [mats])
}

/** 透天厝不會淡出的部分：一樓、二樓的後牆和西牆 */
function HouseBBase() {
  const cream = useCream()
  const H1 = HB.floor2
  const H2 = HB.top
  return (
    <group>
      <Wall axis="x" from={HB.x0} to={HB.x1} at={HB.z0} base={0} top={H1} skirt={false} />
      <Wall axis="z" from={HB.z0} to={HB.z1} at={HB.x0} base={0} top={H1} skirt={false} />
      <WallCream axisX from={HB.x0} to={HB.x1} at={HB.z0} base={H1} top={H2 + 0.8} mat={cream} />
      <WallCream axisX={false} from={HB.z0} to={HB.z1} at={HB.x0} base={H1} top={H2 + 0.8} mat={cream} />
    </group>
  )
}

/** 透天厝會淡出的外殼：正面（小門、拉起來的鐵捲門）、東牆、一樓天花板、二樓、頂樓 */
function HouseBShell() {
  const mats = useMats()
  // 二樓：臥室的檯燈（電視搬到一樓客廳了）
  const lamp = useWindowGlow('#ffc47a', 0.7)
  const cream = useCream()
  const shutter = useMemo(() => {
    const t = shutterTexture()
    t.repeat.set(1, 0.3)
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.5 })
  }, [])
  const tankMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1e1f22', roughness: 0.45 }), [])
  const H1 = HB.floor2
  const H2 = HB.top
  return (
    <group>
      {/* 一樓：二丁掛（磚紋），二樓：米色灰泥 */}
      <Wall axis="x" from={HB.x0} to={HB.x1} at={HB.z1} base={0} top={H1} openings={HB_OPENINGS_1F} skirt={false} />
      <Wall axis="z" from={HB.z0} to={HB.z1} at={HB.x1} base={0} top={H1} skirt={false} />
      <WallCream axisX from={HB.x0} to={HB.x1} at={HB.z1} base={H1} top={H2 + 0.8} openings={HB_OPENINGS_2F} mat={cream} />
      <WallCream axisX={false} from={HB.z0} to={HB.z1} at={HB.x1} base={H1} top={H2 + 0.8} mat={cream} />
      {/* 一樓的天花板（二樓的地板）、樓板線、屋頂平台 */}
      <WBox mat="trim" size={[HB.x1 - HB.x0 - 0.3, 0.12, HB.z1 - HB.z0 - 0.3]} position={[(HB.x0 + HB.x1) / 2, H1 - 0.06, (HB.z0 + HB.z1) / 2]} castShadow={false} />
      <WBox mat="trim" size={[HB.x1 - HB.x0 + 0.4, 0.18, 0.5]} position={[(HB.x0 + HB.x1) / 2, H1, HB.z1 + 0.05]} />
      <WBox mat="yard" size={[HB.x1 - HB.x0, 0.14, HB.z1 - HB.z0]} position={[(HB.x0 + HB.x1) / 2, H2, (HB.z0 + HB.z1) / 2]} />
      <WBox mat="trim" size={[HB.x1 - HB.x0 + 0.34, 0.08, 0.34]} position={[(HB.x0 + HB.x1) / 2, H2 + 0.84, HB.z1]} />
      {/* 鐵捲門拉起來了：只看得到捲軸箱和最下面一截 */}
      <mesh material={shutter} position={[HB_SHUTTER.c, 2.5, HB.z1 - 0.04]}>
        <planeGeometry args={[HB_SHUTTER.w, 0.2]} />
      </mesh>
      <WBox mat="metal" size={[HB_SHUTTER.w + 0.1, 0.32, 0.3]} position={[HB_SHUTTER.c, 2.74, HB.z1 + 0.05]} />
      {/* 二樓窗（檯燈的光）＋鐵窗＋冷氣室外機 */}
      <mesh material={lamp} position={[9.6, H1 + 1.55, HB.z1 - 0.05]}>
        <planeGeometry args={[2.2, 1.3]} />
      </mesh>
      <IronGrille position={[9.6, H1 + 1.55, HB.z1 + 0.25]} w={2.3} h={1.36} />
      <WBox mat="trim" size={[2.5, 0.06, 0.34]} position={[9.6, H1 + 0.87, HB.z1 + 0.08]} />
      <group position={[7.55, H1 + 1.05, HB.z1 + 0.3]}>
        <mesh castShadow>
          <boxGeometry args={[0.78, 0.52, 0.3]} />
          <meshStandardMaterial color="#d9d8d2" roughness={0.5} />
        </mesh>
        <mesh position={[-0.1, 0, 0.152]}>
          <circleGeometry args={[0.2, 20]} />
          <meshStandardMaterial color="#3a3b3e" roughness={0.6} />
        </mesh>
        <WBox mat="metal" size={[0.7, 0.04, 0.4]} position={[0, -0.28, -0.02]} />
      </group>
      {/* 門牌、信箱 */}
      <mesh position={[8.25, 2.35, HB.z1 + 0.16]}>
        <planeGeometry args={[0.3, 0.14]} />
        <meshStandardMaterial color="#2a5a9a" roughness={0.5} />
      </mesh>
      <mesh position={[8.3, 1.2, HB.z1 + 0.2]} castShadow>
        <boxGeometry args={[0.28, 0.36, 0.14]} />
        <meshStandardMaterial color="#c62828" roughness={0.4} />
      </mesh>
      {/* 頂樓：黑色水塔（鐵架上）＋後半的鐵皮加蓋 */}
      <group position={[11.3, H2, -6.2]}>
        {[-0.45, 0.45].flatMap((x) =>
          [-0.45, 0.45].map((z) => (
            <mesh key={`${x},${z}`} material={mats.metal} position={[x, 0.3, z]}>
              <boxGeometry args={[0.06, 0.6, 0.06]} />
            </mesh>
          )),
        )}
        <WBox mat="metal" size={[1.1, 0.06, 1.1]} position={[0, 0.62, 0]} />
        <mesh material={tankMat} position={[0, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.52, 0.52, 1.1, 20]} />
        </mesh>
        <mesh material={tankMat} position={[0, 1.8, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.52, 0.14, 20]} />
        </mesh>
      </group>
      {[HB.x0 + 0.1, HB.x1 - 0.1].flatMap((x) =>
        [-8.2, HB.z0 + 0.15].map((z) => <WBox key={`${x},${z}`} mat="metal" size={[0.08, 1.9, 0.08]} position={[x, H2 + 0.95, z]} />),
      )}
      <RoofSheet x0={HB.x0 - 0.2} x1={HB.x1 + 0.2} z0={HB.z0 - 0.2} z1={-8.0} y0={H2 + 2.05} y1={H2 + 1.75} />
    </group>
  )
}

/** 頂樓加蓋的浪板（往前斜） */
function RoofSheet({ x0, x1, z0, z1, y0, y1 }: { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }) {
  const mat = useMemo(() => {
    const t = corrugatedTexture('#4f7fa8').clone()
    t.needsUpdate = true
    t.repeat.set((x1 - x0) / 1.2, 1)
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide })
  }, [x0, x1])
  const len = Math.hypot(z1 - z0, y0 - y1)
  const tilt = Math.atan2(y0 - y1, z1 - z0)
  return (
    <mesh material={mat} position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} rotation={[-Math.PI / 2 + tilt, 0, 0]} castShadow receiveShadow>
      <boxGeometry args={[x1 - x0, len, 0.03]} />
    </mesh>
  )
}

/** 用指定材質（米色灰泥）的直牆，開口寫法跟 House 的 Wall 一樣 */
function WallCream({
  axisX,
  from,
  to,
  at,
  base,
  top,
  openings = [],
  mat,
}: {
  axisX: boolean
  from: number
  to: number
  at: number
  base: number
  top: number
  openings?: { c: number; w: number; y0: number; y1: number }[]
  mat: THREE.Material
}) {
  const pieces = useMemo(() => {
    const H = top - base
    const out: { c: number; w: number; y: number; h: number }[] = []
    let cur = from
    for (const o of [...openings].sort((a, b) => a.c - b.c)) {
      const a = o.c - o.w / 2
      const b = o.c + o.w / 2
      if (a > cur) out.push({ c: (cur + a) / 2, w: a - cur, y: H / 2, h: H })
      out.push({ c: o.c, w: o.w, y: o.y0 / 2, h: o.y0 })
      out.push({ c: o.c, w: o.w, y: (o.y1 + H) / 2, h: H - o.y1 })
      cur = b
    }
    if (to > cur) out.push({ c: (cur + to) / 2, w: to - cur, y: H / 2, h: H })
    return out
  }, [from, to, base, top, openings])
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} material={mat} position={axisX ? [p.c, base + p.y, at] : [at, base + p.y, p.c]} castShadow receiveShadow>
          <boxGeometry args={axisX ? [p.w, p.h, 0.3] : [0.3, p.h, p.w]} />
        </mesh>
      ))}
    </group>
  )
}

/** 房子之間的紅磚矮牆（石頭壓頂） */
function LowWalls() {
  const segs: [number, number][] = [
    [HA.x1, S.x0],
    [S.x1, HB.x0],
    [HA.x0 - 3.2, HA.x0],
  ]
  return (
    <group>
      {segs.map(([a, b]) => (
        <group key={a}>
          <WBox mat="brick" size={[b - a, 1.1, 0.25]} position={[(a + b) / 2, 0.55, -4.9]} />
          <WBox mat="stone" size={[b - a + 0.05, 0.08, 0.32]} position={[(a + b) / 2, 1.14, -4.9]} />
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 檳榔攤：玻璃小亭、霓虹燈管
// ---------------------------------------------------------------------------

const neonPink = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.35, 1.0), toneMapped: false })
const neonGreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 0.8), toneMapped: false })

function betelSignTexture() {
  return canvasTexture(
    512,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#18141c'
      ctx.fillRect(0, 0, w, h)
      ctx.shadowColor = '#ff4fb0'
      ctx.shadowBlur = 16
      ctx.fillStyle = '#ffd0ec'
      ctx.font = `700 78px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('檳 榔', w * 0.34, h / 2 + 4)
      ctx.shadowColor = '#4dffb0'
      ctx.fillStyle = '#d0ffe8'
      ctx.font = `700 34px ${BRUSH_FONT}`
      ctx.fillText('香菸', w * 0.78, h * 0.32)
      ctx.fillText('飲料', w * 0.78, h * 0.72)
    },
    [{ spec: `700 78px ${BRUSH_FONT}`, text: '檳榔香菸飲料' }],
  )
}

function Betel() {
  const mats = useMats()
  const sign = useMemo(betelSignTexture, [])
  const B = V.betel
  return (
    <group position={[B.x, 0, B.z]}>
      <WBox mat="trim" size={[1.6, 0.95, 1.2]} position={[0, 0.475, 0]} />
      <mesh material={glassMat} position={[0, 1.6, 0]}>
        <boxGeometry args={[1.6, 1.3, 1.2]} />
      </mesh>
      {[-0.78, 0.78].flatMap((x) => [-0.58, 0.58].map((z) => <WBox key={`${x},${z}`} mat="metal" size={[0.05, 1.3, 0.05]} position={[x, 1.6, z]} />))}
      <WBox mat="trim" size={[1.9, 0.12, 1.5]} position={[0, 2.31, 0.05]} />
      <mesh position={[0, 2.62, 0.3]}>
        <planeGeometry args={[1.8, 0.45]} />
        <meshStandardMaterial map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={0.8} roughness={0.5} />
      </mesh>
      {/* 霓虹燈管：沿著屋簷一圈 */}
      <mesh material={neonPink} position={[0, 2.23, 0.8]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 1.85, 6]} />
      </mesh>
      {[-0.93, 0.93].map((x) => (
        <mesh key={x} material={neonGreen} position={[x, 2.23, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 1.45, 6]} />
        </mesh>
      ))}
      {/* 裡面：高腳椅、一疊檳榔盒 */}
      <mesh material={mats.metal} position={[0.3, 1.3, -0.2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.05, 12]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.4 + i * 0.14, 1.02, 0.35]}>
          <boxGeometry args={[0.12, 0.05, 0.08]} />
          <meshStandardMaterial color={i % 2 ? '#3e9a52' : '#f4efe2'} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 野狼 125（老機車）
// ---------------------------------------------------------------------------

const wolfRed = new THREE.MeshStandardMaterial({ color: '#a8231c', roughness: 0.3, metalness: 0.3 })
const chrome = new THREE.MeshStandardMaterial({ color: '#c9ccd2', roughness: 0.2, metalness: 0.9 })
const tire = new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.8 })
const black = new THREE.MeshStandardMaterial({ color: '#232326', roughness: 0.5 })
const headlampMat = new THREE.MeshBasicMaterial({ color: '#fff6e0', toneMapped: false })

function Wolf({ position }: { position: [number, number, number] }) {
  const mats = useMats()
  return (
    <group position={position} rotation={[0, Math.PI - 0.18, 0.04]}>
      {[-0.62, 0.62].map((x) => (
        <group key={x} position={[x, 0.31, 0]}>
          <mesh material={tire} castShadow>
            <torusGeometry args={[0.28, 0.05, 8, 28]} />
          </mesh>
          <mesh material={chrome} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.02, 20]} />
          </mesh>
        </group>
      ))}
      {/* 車架、引擎 */}
      <mesh material={black} position={[-0.05, 0.42, 0]} rotation={[0, 0, 0.1]} castShadow>
        <boxGeometry args={[0.9, 0.08, 0.1]} />
      </mesh>
      <mesh material={chrome} position={[0.02, 0.42, 0]} castShadow>
        <boxGeometry args={[0.34, 0.3, 0.26]} />
      </mesh>
      {/* 油箱（紅）、坐墊（黑）、後架上綁著菜籃 */}
      <RoundedBox args={[0.5, 0.2, 0.3]} radius={0.08} smoothness={3} position={[0.2, 0.78, 0]} material={wolfRed} castShadow />
      <RoundedBox args={[0.6, 0.1, 0.26]} radius={0.04} smoothness={2} position={[-0.3, 0.76, 0]} material={black} castShadow />
      <mesh material={chrome} position={[-0.72, 0.8, 0]}>
        <boxGeometry args={[0.36, 0.03, 0.3]} />
      </mesh>
      <mesh material={mats.bamboo} position={[-0.72, 0.93, 0]} castShadow>
        <boxGeometry args={[0.32, 0.22, 0.3]} />
      </mesh>
      {/* 前叉、龍頭、大燈 */}
      <mesh material={chrome} position={[0.55, 0.62, 0]} rotation={[0, 0, -0.35]}>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
      </mesh>
      <mesh material={chrome} position={[0.45, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.66, 6]} />
      </mesh>
      <mesh material={chrome} position={[0.58, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.08, 0.1, 14]} />
      </mesh>
      <mesh material={headlampMat} position={[0.635, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}>
        <circleGeometry args={[0.07, 14]} />
      </mesh>
      {/* 排氣管 */}
      <mesh material={chrome} position={[-0.3, 0.3, 0.16]} rotation={[0, 0, Math.PI / 2 - 0.08]}>
        <cylinderGeometry args={[0.035, 0.045, 0.8, 8]} />
      </mesh>
      {/* 側柱 */}
      <mesh material={black} position={[-0.02, 0.15, -0.16]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.3, 5]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 老榕樹下：石桌石椅、茶壺、路邊的石頭公
// ---------------------------------------------------------------------------

function BanyanCorner() {
  const mats = useMats()
  const T = V.stoneTable
  const G = V.tablet
  return (
    <group>
      <group position={[T.x, 0, T.z]}>
        <mesh material={mats.stone} position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.24, 0.7, 12]} />
        </mesh>
        <mesh material={mats.stone} position={[0, 0.74, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.46, 0.44, 0.08, 20]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={mats.stone} position={[s * 1.0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.2, 0.44, 12]} />
          </mesh>
        ))}
        {/* 茶壺、兩個小杯 */}
        <mesh material={mats.ceramic} position={[0.1, 0.86, 0.05]} castShadow>
          <sphereGeometry args={[0.09, 14, 10]} />
        </mesh>
        {[-0.15, -0.28].map((x) => (
          <mesh key={x} material={mats.ceramic} position={[x, 0.81, 0.15]}>
            <cylinderGeometry args={[0.03, 0.025, 0.05, 10]} />
          </mesh>
        ))}
        {/* 一副象棋 */}
        <mesh position={[0.18, 0.785, -0.2]} rotation={[-Math.PI / 2, 0, 0.2]}>
          <planeGeometry args={[0.4, 0.34]} />
          <meshStandardMaterial color="#d8b27a" roughness={0.8} />
        </mesh>
      </group>
      <group position={[G.x, 0, G.z]}>
        <WBox mat="stone" size={[0.62, 0.16, 0.44]} position={[0, 0.08, 0]} />
        <mesh material={mats.stone} position={[0, 0.5, -0.05]} castShadow>
          <boxGeometry args={[0.36, 0.7, 0.14]} />
        </mesh>
        <mesh material={mats.redPaper} position={[0, 0.72, 0.03]}>
          <boxGeometry args={[0.38, 0.22, 0.02]} />
        </mesh>
        <mesh material={mats.ceramic} position={[0, 0.24, 0.12]}>
          <cylinderGeometry args={[0.07, 0.06, 0.1, 10]} />
        </mesh>
        {[-0.02, 0, 0.02].map((x, i) => (
          <mesh key={x} material={mats.redPaper} position={[x, 0.36, 0.12]} rotation={[0, 0, (i - 1) * 0.1]}>
            <cylinderGeometry args={[0.004, 0.004, 0.22, 3]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 燈：店裡的日光燈、檳榔攤的霓虹、紅磚厝門口的燈泡
// ---------------------------------------------------------------------------

function VillageLights() {
  const tube = useRef<THREE.PointLight>(null)
  const neon = useRef<THREE.PointLight>(null)
  const tubeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.6, 1.5), toneMapped: false }), [])
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const t = clock.elapsedTime
    // 日光燈偶爾閃一下（老燈管）
    const blink = Math.sin(t * 0.7) > 0.985 && Math.sin(t * 43) > 0 ? 0.3 : 1
    if (tube.current) tube.current.intensity = (1.2 + 2.6 * l) * blink
    tubeMat.color.setRGB(1.4 * blink, 1.6 * blink, 1.5 * blink)
    const n = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 3.1)
    if (neon.current) neon.current.intensity = 2.6 * l * n
    neonPink.color.setRGB(0.5 + 1.1 * l * n, 0.15 + 0.2 * l, 0.35 + 0.65 * l * n)
    neonGreen.color.setRGB(0.1 + 0.2 * l, 0.5 + 1.1 * l * n, 0.3 + 0.5 * l)
  })
  return (
    <group>
      {/* 店裡天花板的日光燈管 */}
      <mesh material={tubeMat} position={[0, S.wallTop - 0.25, -6.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 1.3, 8]} />
      </mesh>
      <pointLight ref={tube} position={[0, 2.9, -5.2]} color="#e6fff2" intensity={2} distance={9} decay={2} />
      <pointLight ref={neon} position={[V.betel.x, 2.0, V.betel.z + 1.0]} color="#ff5fb8" intensity={0} distance={6} decay={2} />
      {/* 紅磚厝門口的燈：阿好搬走以後就沒開了（屋裡的神明燈在 VillageHouses.tsx） */}
      <mesh position={[HA_DOOR_X, 2.45, HA.z1 + 0.25]}>
        <sphereGeometry args={[0.06, 10, 8]} />
        <meshStandardMaterial color="#d8d2c0" roughness={0.3} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 夾娃娃機（柑仔店門口）：粉紅色機台、裡面一坑娃娃，晚上招牌會亮。頂上照慣例放一包綠色零食（「乖乖」保佑機器乖乖的）
// ---------------------------------------------------------------------------

const PLUSH_COLORS = ['#4caf50', '#d8312a', '#ffb3cf', '#3aa655', '#ffd23f', '#8fd3ff', '#4caf50', '#ffb3cf']

function ClawMachine() {
  const C = V.claw
  const sign = useMemo(
    () =>
      canvasTexture(
        256,
        72,
        (ctx, w, h) => {
          ctx.fillStyle = '#3a0a22'
          ctx.fillRect(0, 0, w, h)
          ctx.fillStyle = '#ffec78'
          ctx.font = `700 46px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('夾娃娃', w / 2, h / 2 + 2)
        },
        [{ spec: `700 46px ${BRUSH_FONT}`, text: '夾娃娃' }],
      ),
    [],
  )
  const signMat = useMemo(() => new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: '#ffffff', emissiveIntensity: 0.2, roughness: 0.5 }), [sign])
  const pink = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff8ab8', roughness: 0.45 }), [])
  const deep = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8386e', roughness: 0.5 }), [])
  const inside = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd6e8', emissive: '#ff9ac4', emissiveIntensity: 0.1, roughness: 0.8 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c0c4c8', metalness: 0.8, roughness: 0.3 }), [])
  const plush = useMemo(() => PLUSH_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })), [])
  const light = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const flick = Math.sin(clock.elapsedTime * 17) > 0.97 ? 0.4 : 1
    signMat.emissiveIntensity = 0.2 + 1.3 * l * flick
    inside.emissiveIntensity = 0.1 + 0.7 * l
    if (light.current) light.current.intensity = 1.6 * l
  })
  return (
    <group position={[C.x, 0.02, C.z]}>
      {/* 下半部機身 */}
      <RoundedBox args={[0.82, 0.76, 0.78]} radius={0.05} smoothness={3} position={[0, 0.38, 0]} material={pink} castShadow receiveShadow />
      {/* 前面的操作台：搖桿、按鈕、投幣孔 */}
      <mesh material={deep} position={[0, 0.78, 0.36]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[0.8, 0.05, 0.16]} />
      </mesh>
      <mesh material={clawBlack} position={[-0.2, 0.85, 0.38]}>
        <cylinderGeometry args={[0.012, 0.012, 0.12, 6]} />
      </mesh>
      <mesh position={[-0.2, 0.92, 0.38]}>
        <sphereGeometry args={[0.035, 12, 8]} />
        <meshStandardMaterial color="#ff3b30" roughness={0.3} />
      </mesh>
      <mesh position={[0.15, 0.82, 0.4]}>
        <cylinderGeometry args={[0.045, 0.045, 0.03, 16]} />
        <meshStandardMaterial color="#2e7dff" roughness={0.3} emissive="#2e7dff" emissiveIntensity={0.3} />
      </mesh>
      <mesh material={clawBlack} position={[0.3, 0.55, 0.395]}>
        <boxGeometry args={[0.1, 0.14, 0.01]} />
      </mesh>
      {/* 玻璃箱：四根柱子、裡面的娃娃坑、爪子 */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} material={pink} position={[sx * 0.39, 1.2, sz * 0.37]}>
          <boxGeometry args={[0.04, 0.88, 0.04]} />
        </mesh>
      ))}
      <mesh material={inside} position={[0, 1.2, -0.36]}>
        <planeGeometry args={[0.76, 0.86]} />
      </mesh>
      <mesh material={inside} position={[0, 0.8, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.76, 0.72]} />
      </mesh>
      {PLUSH_COLORS.map((_, i) => (
        <mesh key={i} material={plush[i]} position={[-0.26 + (i % 4) * 0.17, 0.86 + Math.floor(i / 4) * 0.07, -0.18 + Math.floor(i / 4) * 0.2 + (i % 2) * 0.05]} scale={[1, 0.85, 1]}>
          <sphereGeometry args={[0.07, 10, 8]} />
        </mesh>
      ))}
      <mesh material={steel} position={[0.1, 1.5, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.2, 4]} />
      </mesh>
      {[-1, 0, 1].map((k) => (
        <mesh key={k} material={steel} position={[0.1 + k * 0.025, 1.36, 0]} rotation={[0, 0, k * 0.4]}>
          <boxGeometry args={[0.012, 0.08, 0.012]} />
        </mesh>
      ))}
      {[
        [0, 1.2, 0.39, 0],
        [-0.41, 1.2, 0, Math.PI / 2],
        [0.41, 1.2, 0, Math.PI / 2],
      ].map(([x, y, z, ry], i) => (
        <mesh key={i} material={glassMat} position={[x, y, z]} rotation-y={ry}>
          <planeGeometry args={[0.76, 0.86]} />
        </mesh>
      ))}
      {/* 招牌與頂蓋 */}
      <RoundedBox args={[0.86, 0.26, 0.8]} radius={0.04} smoothness={3} position={[0, 1.77, 0]} material={pink} castShadow />
      <mesh material={signMat} position={[0, 1.77, 0.405]}>
        <planeGeometry args={[0.74, 0.2]} />
      </mesh>
      <mesh position={[0.22, 1.95, 0.1]} rotation={[0, 0.3, 0.05]}>
        <boxGeometry args={[0.12, 0.1, 0.04]} />
        <meshStandardMaterial color="#3aa655" roughness={0.5} />
      </mesh>
      <pointLight ref={light} position={[0, 1.35, 0.1]} color="#ff9ac4" intensity={0} distance={3.5} decay={2} />
    </group>
  )
}

const clawBlack = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.4 })
