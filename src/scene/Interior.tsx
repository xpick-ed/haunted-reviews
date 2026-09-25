import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { RADIO } from '../world/night/actions'
import { BRUSH_FONT, WBox, canvasTexture, seeded, svgTexture, useMats } from './kit'
import {
  BUCKET,
  CUPBOARD,
  DRESSER,
  FLOOR_Y,
  GM_BED,
  GUEST_ROOMS,
  GUEST_WINDOW_OUT_Z,
  HAN_BED,
  HAN_DESK,
  KITCHEN_JAR,
  KITCHEN_TABLE,
  MAIN,
  ROCKER,
  SEWING,
  SINK,
  STOVE,
  TOILET,
  WING_L,
  WING_R,
  type GuestRoomDef,
} from './layout'
import { Lantern } from './House'
import { PORTRAIT_SIZE, portraitSvg } from '../art/portraits'
import type { ObjectState } from '../world/night/types'

// 室內：兩間客房（右護龍前間、左護龍後間）、浴廁、正身神明廳、阿嬤與小翰的房間、灶腳。
// 會變的東西（小夜燈、電扇、蚊香、水杯、窗、宵夜、搖椅、鏡子、灶）看 store.objects，每幀用 getState() 讀。

export function Interior() {
  return (
    <group>
      <GuestRoomFurniture room={GUEST_ROOMS.r1} />
      <GuestRoomFurniture room={GUEST_ROOMS.r2} />
      <Bathroom />
      <AltarHall />
      <Radio />
      <GrandmaRoom />
      <GrandsonRoom />
      <Kitchen />
    </group>
  )
}

/** 物件目前的狀態（沒有紀錄就是關著） */
function obj(id: string): ObjectState | undefined {
  return useStore.getState().objects[id]
}
/** 物件最近一次被觸發過了多久（毫秒）；沒觸發過是 Infinity */
function since(id: string) {
  const o = obj(id)
  return o && o.at > 0 ? performance.now() - o.at : Infinity
}

/** 煙、蒸氣用的柔和圓點 */
const puffTex = canvasTexture(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(235,235,240,0.6)')
  g.addColorStop(1, 'rgba(235,235,240,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

/** 一縷往上飄的煙／蒸氣。visible() 回傳 false 時整縷淡掉 */
function Wisp({ position, count = 4, height = 0.6, size = 0.12, speed = 0.35, opacity = 0.4, visible }: { position: [number, number, number]; count?: number; height?: number; size?: number; speed?: number; opacity?: number; visible: () => boolean }) {
  const refs = useRef<(THREE.Sprite | null)[]>([])
  const fade = useRef(0)
  useFrame(({ clock }, dt) => {
    fade.current += ((visible() ? 1 : 0) - fade.current) * Math.min(1, dt * 3)
    const t = clock.elapsedTime
    refs.current.forEach((s, i) => {
      if (!s) return
      const k = (t * speed + i / count) % 1
      s.position.set(Math.sin(k * 6 + i * 2) * 0.03, k * height, Math.cos(k * 5 + i) * 0.02)
      const sc = size * (0.5 + k)
      s.scale.set(sc, sc, 1)
      ;(s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * opacity * fade.current
      s.visible = fade.current > 0.01
    })
  })
  return (
    <group position={position}>
      {Array.from({ length: count }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          visible={false}
        >
          <spriteMaterial map={puffTex} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 客房（兩間共用同一套家具）
// ---------------------------------------------------------------------------

const clothWhite = new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.95 })
const pillowMat = new THREE.MeshStandardMaterial({ color: '#f6e7d2', roughness: 0.95 })
const pinkPlastic = new THREE.MeshStandardMaterial({ color: '#f29bb5', roughness: 0.35 })
const fanPlastic = new THREE.MeshStandardMaterial({ color: '#7cc1c7', roughness: 0.35, transparent: true, opacity: 0.85 })
const fanBody = new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.4 })
const enamelOut = new THREE.MeshStandardMaterial({ color: '#3f7a5a', roughness: 0.3, side: THREE.DoubleSide })
const tvScreen = new THREE.MeshStandardMaterial({ color: '#10161c', roughness: 0.1, metalness: 0.2, emissive: '#3a6a8a', emissiveIntensity: 0 })
const slipperMat = new THREE.MeshStandardMaterial({ color: '#4d7fbf', roughness: 0.6 })

function calendarTexture() {
  return canvasTexture(
    256,
    352,
    (ctx, w, h) => {
      ctx.fillStyle = '#fbf6ec'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#c7342b'
      ctx.fillRect(0, 0, w, 58)
      ctx.fillStyle = '#fff'
      ctx.font = `700 34px "Noto Sans TC", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('2026  三月', w / 2, 42)
      ctx.fillStyle = '#c7342b'
      ctx.font = `900 150px "Noto Serif TC", serif`
      ctx.fillText('25', w / 2, 212)
      ctx.fillStyle = '#333'
      ctx.font = `500 26px "Noto Sans TC", sans-serif`
      ctx.fillText('星期三', w / 2, 258)
      ctx.fillStyle = '#8a6a3a'
      ctx.font = `500 24px ${BRUSH_FONT}`
      ctx.fillText('農曆二月初七', w / 2, 298)
      ctx.fillStyle = '#b33'
      ctx.font = `500 20px "Noto Sans TC", sans-serif`
      ctx.fillText('宜：入宅 會友　忌：驚擾', w / 2, 332)
    },
    [
      { spec: `900 150px "Noto Serif TC"`, text: '25' },
      { spec: `700 34px "Noto Sans TC"`, text: '2026三月星期宜入宅會友忌驚擾' },
      { spec: `500 24px ${BRUSH_FONT}`, text: '農曆二月初七' },
    ],
  )
}

function rugTexture(seed: number, cols: string[]) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const rnd = seeded(seed)
    for (let r = w / 2; r > 0; r -= 9) {
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)]
      ctx.fill()
    }
  })
}

/** 掛在牆上的小風景畫（客房二） */
function paintingTexture() {
  return canvasTexture(192, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5a3a24'
    ctx.fillRect(0, 0, w, h)
    const g = ctx.createLinearGradient(0, 8, 0, h - 8)
    g.addColorStop(0, '#f2c28a')
    g.addColorStop(0.55, '#e8dcc0')
    g.addColorStop(0.56, '#6f9a5a')
    g.addColorStop(1, '#3f6a3a')
    ctx.fillStyle = g
    ctx.fillRect(8, 8, w - 16, h - 16)
    // 遠山與稻田
    ctx.fillStyle = '#7f8fa8'
    ctx.beginPath()
    ctx.moveTo(8, 70)
    ctx.lineTo(60, 40)
    ctx.lineTo(100, 62)
    ctx.lineTo(140, 36)
    ctx.lineTo(w - 8, 66)
    ctx.lineTo(w - 8, 72)
    ctx.lineTo(8, 72)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,240,200,0.45)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.moveTo(8, 80 + i * 7)
      ctx.lineTo(w - 8, 78 + i * 7.5)
      ctx.stroke()
    }
    ctx.fillStyle = '#e24a2a'
    ctx.beginPath()
    ctx.arc(150, 26, 7, 0, Math.PI * 2)
    ctx.fill()
  })
}

/** 一間客房的家具。客房一另外有衣櫃、電視、行李箱、拖鞋 */
function GuestRoomFurniture({ room }: { room: GuestRoomDef }) {
  const mats = useMats()
  const r1 = room.id === 'r1'
  const cal = useMemo(calendarTexture, [])
  const rug = useMemo(() => (r1 ? rugTexture(5, ['#b5523a', '#d9a55a', '#6b8f5a', '#e8dcc4', '#8a3a3a']) : rugTexture(8, ['#4a6f9a', '#e8dcc4', '#d9a55a', '#7a9a8a'])), [r1])
  const painting = useMemo(() => (r1 ? null : paintingTexture()), [r1])
  const bulbMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false }), [])
  const { bed } = room
  const head = bed.z - bed.l / 2
  const foot = bed.z + bed.l / 2
  const frameH = 0.38
  const [lampX, lampZ] = room.lamp
  const lampY = FLOOR_Y + 2.35

  useFrame(() => {
    const lit = useStore.getState().roomLit[room.id] ?? 0
    const k = 0.12 + lit * 2.1
    bulbMat.color.setRGB(1.0 * k, 0.85 * k, 0.62 * k)
    if (r1) tvScreen.emissiveIntensity = lit > 0.5 ? 0.35 : 0
  })

  return (
    <group>
      {/* 床架：床頭板、床尾板、側板、床腳 */}
      <WBox mat="wood" size={[bed.w + 0.14, 0.16, bed.l + 0.1]} position={[bed.x, FLOOR_Y + frameH - 0.08, bed.z]} />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <WBox key={i} mat="darkWood" size={[0.1, frameH, 0.1]} position={[bed.x + sx * (bed.w / 2 + 0.02), FLOOR_Y + frameH / 2, bed.z + sz * (bed.l / 2 + 0.02)]} />
      ))}
      <WBox mat="wood" size={[bed.w + 0.2, 1.05, 0.09]} position={[bed.x, FLOOR_Y + 0.52, head - 0.06]} />
      <WBox mat="darkWood" size={[bed.w + 0.28, 0.08, 0.14]} position={[bed.x, FLOOR_Y + 1.08, head - 0.06]} />
      {[-0.4, 0.4].map((x) => (
        <WBox key={x} mat="darkWood" size={[0.56, 0.42, 0.02]} position={[bed.x + x, FLOOR_Y + 0.72, head - 0.005]} castShadow={false} />
      ))}
      <WBox mat="wood" size={[bed.w + 0.2, 0.6, 0.09]} position={[bed.x, FLOOR_Y + 0.3, foot + 0.06]} />
      {/* 床墊、枕頭 */}
      <RoundedBox args={[bed.w, 0.2, bed.l]} radius={0.06} smoothness={3} position={[bed.x, bed.topY - 0.1, bed.z]} material={clothWhite} castShadow receiveShadow />
      <RoundedBox args={[0.9, 0.15, 0.45]} radius={0.07} smoothness={3} position={[bed.x, bed.topY + 0.07, room.pillowZ]} material={pillowMat} castShadow receiveShadow />

      <Nightstand room={room} />

      {/* 吊燈：電線、琺瑯燈罩、燈泡（亮度看 roomLit） */}
      <mesh position={[lampX, lampY + 0.45, lampZ]} material={mats.black}>
        <cylinderGeometry args={[0.008, 0.008, 0.8, 4]} />
      </mesh>
      <mesh position={[lampX, lampY + 0.08, lampZ]} material={enamelOut}>
        <coneGeometry args={[0.26, 0.16, 24, 1, true]} />
      </mesh>
      <mesh position={[lampX, lampY - 0.02, lampZ]} material={bulbMat}>
        <sphereGeometry args={[0.07, 16, 12]} />
      </mesh>

      {/* 電扇朝著床吹 */}
      <Fan position={[room.fan[0], FLOOR_Y, room.fan[1]]} id={`${room.id}.fan`} facing={Math.atan2(bed.x - room.fan[0], bed.z - room.fan[1])} />
      <Coil position={[room.coil[0], FLOOR_Y, room.coil[1]]} id={`${room.id}.coil`} />
      {r1 && <Shutters id="r1.window" />}

      {/* 地毯 */}
      <mesh position={r1 ? [bed.x + 0.1, FLOOR_Y + 0.005, foot + 0.42] : [WING_L.x1 - 0.7, FLOOR_Y + 0.005, 0.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.36, 40]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>

      {r1 ? (
        <>
          {/* 撕日曆（隔間牆朝房間那面） */}
          <mesh position={[bed.x - 0.5, FLOOR_Y + 1.75, WING_R.split + 0.085]}>
            <planeGeometry args={[0.3, 0.41]} />
            <meshStandardMaterial map={cal} roughness={0.9} />
          </mesh>
          {/* 衣櫃 */}
          <group position={[WING_R.x1 - 0.48, FLOOR_Y, WING_R.split + 0.62]}>
            <WBox mat="wood" size={[0.6, 1.95, 1.0]} position={[0, 0.975, 0]} />
            <WBox mat="darkWood" size={[0.66, 0.08, 1.06]} position={[0, 1.99, 0]} />
            <WBox mat="darkWood" size={[0.02, 1.7, 0.02]} position={[-0.31, 1.0, 0]} castShadow={false} />
            {[-0.08, 0.08].map((z) => (
              <mesh key={z} position={[-0.32, 1.0, z]} material={mats.gold}>
                <sphereGeometry args={[0.025, 10, 8]} />
              </mesh>
            ))}
          </group>
          {/* 矮櫃上的老電視 */}
          <group position={[WING_R.x1 - 0.42, FLOOR_Y, foot + 0.38]}>
            <WBox mat="wood" size={[0.5, 0.6, 0.85]} position={[0, 0.3, 0]} />
            <WBox mat="wood" size={[0.46, 0.44, 0.56]} position={[-0.01, 0.82, 0]} />
            <mesh position={[-0.245, 0.83, -0.03]} rotation={[0, -Math.PI / 2, 0]} material={tvScreen}>
              <planeGeometry args={[0.44, 0.32]} />
            </mesh>
            <mesh position={[0, 1.08, 0.05]} rotation={[0, 0, 0.5]} material={mats.metal}>
              <cylinderGeometry args={[0.006, 0.006, 0.4, 4]} />
            </mesh>
          </group>
          {/* 行李箱、拖鞋 */}
          <RoundedBox args={[0.24, 0.62, 0.44]} radius={0.05} smoothness={3} position={[WING_R.x0 + 0.38, FLOOR_Y + 0.31, head + 0.45]} rotation={[0, 0.25, 0]} material={pinkPlastic} castShadow />
          {[-0.07, 0.07].map((dz, i) => (
            <RoundedBox
              key={i}
              args={[0.1, 0.03, 0.24]}
              radius={0.012}
              smoothness={2}
              position={[bed.x - bed.w / 2 - 0.2, FLOOR_Y + 0.015, bed.z + 0.3 + dz * 1.8]}
              rotation={[0, 0.2 * (i ? 1 : -1), 0]}
              material={slipperMat}
            />
          ))}
        </>
      ) : (
        <>
          {/* 撕日曆（後山牆，朝鏡頭那面） */}
          <mesh position={[WING_L.x1 - 0.75, FLOOR_Y + 1.75, WING_L.z0 + 0.16]}>
            <planeGeometry args={[0.3, 0.41]} />
            <meshStandardMaterial map={cal} roughness={0.9} />
          </mesh>
          {/* 床頭上方的小風景畫（外牆） */}
          <mesh position={[WING_L.x0 + 0.16, FLOOR_Y + 1.75, bed.z]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.6, 0.4]} />
            <meshStandardMaterial map={painting} roughness={0.8} />
          </mesh>
        </>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 床頭櫃：熱水瓶、小夜燈（lamp）、水杯（cup）、宵夜（dish）
// ---------------------------------------------------------------------------

const lampShade = new THREE.MeshStandardMaterial({ color: '#f3e3c0', roughness: 0.8, side: THREE.DoubleSide, emissive: '#ffb86a', emissiveIntensity: 0 })
const glassMat = new THREE.MeshStandardMaterial({ color: '#dff0f5', roughness: 0.05, transparent: true, opacity: 0.32 })
const waterMat = new THREE.MeshStandardMaterial({ color: '#7fb6d0', roughness: 0.05, transparent: true, opacity: 0.6 })
const bowlMat = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.3 })
const riceMat = new THREE.MeshStandardMaterial({ color: '#fbfaf4', roughness: 0.9 })
const eggMat = new THREE.MeshStandardMaterial({ color: '#e3a83c', roughness: 0.7 })
const radishMat = new THREE.MeshStandardMaterial({ color: '#9a6a2a', roughness: 0.8 })
const lampBulbOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.9), toneMapped: false })

function Nightstand({ room }: { room: GuestRoomDef }) {
  const mats = useMats()
  const shade = useMemo(() => lampShade.clone(), [])
  const lampLight = useRef<THREE.PointLight>(null)
  const bulb = useRef<THREE.Mesh>(null)
  const water = useRef<THREE.Mesh>(null)
  const dish = useRef<THREE.Group>(null)
  const lampOn = useRef(0)
  const bowlGeo = useMemo(() => new THREE.SphereGeometry(0.055, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [])
  const id = room.id
  const TOP = 0.55

  useFrame((_, dt) => {
    const on = obj(`${id}.lamp`)?.on ? 1 : 0
    lampOn.current += (on - lampOn.current) * Math.min(1, dt * 8)
    shade.emissiveIntensity = lampOn.current * 1.3
    if (lampLight.current) lampLight.current.intensity = lampOn.current * 0.9
    if (bulb.current) bulb.current.visible = lampOn.current > 0.05
    if (water.current) water.current.visible = !!obj(`${id}.cup`)?.on
    if (dish.current) dish.current.visible = !!obj(`${id}.dish`)?.on
  })

  return (
    <group position={[room.nightstand[0], FLOOR_Y, room.nightstand[1]]}>
      <WBox mat="wood" size={[0.44, 0.55, 0.44]} position={[0, 0.275, 0]} />
      <WBox mat="darkWood" size={[0.36, 0.03, 0.02]} position={[0, 0.4, -0.225]} castShadow={false} />
      {/* 熱水瓶 */}
      <mesh position={[-0.12, TOP + 0.17, -0.1]} material={mats.redPaint} castShadow>
        <cylinderGeometry args={[0.065, 0.065, 0.34, 18]} />
      </mesh>
      <mesh position={[-0.12, TOP + 0.36, -0.1]} material={mats.gold}>
        <cylinderGeometry args={[0.042, 0.056, 0.06, 14]} />
      </mesh>
      {/* 水杯（空的時候只有玻璃） */}
      <mesh position={[-0.12, TOP + 0.045, 0.12]} material={glassMat}>
        <cylinderGeometry args={[0.032, 0.028, 0.09, 16, 1, true]} />
      </mesh>
      <group userData={{ noMerge: true }}>
        <mesh ref={water} position={[-0.12, TOP + 0.032, 0.12]} material={waterMat} visible={false}>
          <cylinderGeometry args={[0.029, 0.026, 0.06, 16]} />
        </mesh>
        {/* 小夜燈 */}
        <group position={[0.11, TOP, -0.1]}>
          <mesh position={[0, 0.01, 0]} material={mats.darkWood} castShadow>
            <cylinderGeometry args={[0.045, 0.05, 0.02, 16]} />
          </mesh>
          <mesh position={[0, 0.08, 0]} material={mats.gold}>
            <cylinderGeometry args={[0.007, 0.007, 0.13, 6]} />
          </mesh>
          <mesh position={[0, 0.17, 0]} material={shade} castShadow>
            <cylinderGeometry args={[0.045, 0.07, 0.085, 20, 1, true]} />
          </mesh>
          <mesh ref={bulb} position={[0, 0.15, 0]} material={lampBulbOn} visible={false}>
            <sphereGeometry args={[0.022, 10, 8]} />
          </mesh>
          <pointLight ref={lampLight} position={[0, 0.16, 0]} color="#ffb86a" intensity={0} distance={3} decay={2} />
        </group>
        {/* 宵夜：一碗白飯、一盤菜脯蛋 */}
        <group ref={dish} position={[0.08, TOP, 0.11]} visible={false}>
          <mesh position={[-0.06, 0.055, 0.0]} geometry={bowlGeo} material={bowlMat} rotation={[Math.PI, 0, 0]} castShadow />
          <mesh position={[-0.06, 0.05, 0.0]} material={riceMat} scale={[1, 0.45, 1]}>
            <sphereGeometry args={[0.048, 14, 10]} />
          </mesh>
          <mesh position={[0.07, 0.008, 0.03]} material={bowlMat}>
            <cylinderGeometry args={[0.085, 0.07, 0.016, 20]} />
          </mesh>
          <mesh position={[0.07, 0.022, 0.03]} material={eggMat} scale={[1, 0.3, 1]}>
            <sphereGeometry args={[0.065, 16, 8]} />
          </mesh>
          {[
            [0.05, 0.01],
            [0.09, 0.05],
            [0.07, 0.06],
            [0.1, 0.01],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.04, z]} material={radishMat}>
              <boxGeometry args={[0.012, 0.008, 0.012]} />
            </mesh>
          ))}
        </group>
        <Wisp position={[0.03, TOP + 0.08, 0.12]} count={3} height={0.35} size={0.08} speed={0.4} opacity={0.35} visible={() => !!obj(`${id}.dish`)?.on} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 電扇：開著轉、關了慢慢停；開著時頭會擺
// ---------------------------------------------------------------------------

function Fan({ position, id, facing }: { position: [number, number, number]; id: string; facing: number }) {
  const mats = useMats()
  const head = useRef<THREE.Group>(null)
  const blades = useRef<THREE.Group>(null)
  const spin = useRef(0)
  const sway = useRef(0)
  const cage = useMemo(() => {
    const g: THREE.BufferGeometry[] = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      g.push(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 3).rotateZ(Math.PI / 2).rotateX(a))
    }
    return g
  }, [])
  useFrame(({ clock }, dt) => {
    const on = obj(id)?.on ? 1 : 0
    // 開：很快轉起來；關：慢慢停
    spin.current += ((on ? 18 : 0) - spin.current) * Math.min(1, dt * (on ? 3 : 0.8))
    sway.current += (on - sway.current) * Math.min(1, dt * 0.8)
    if (blades.current) blades.current.rotation.z -= dt * spin.current
    if (head.current) head.current.rotation.y = facing + Math.sin(clock.elapsedTime * 0.4) * 0.7 * sway.current
  })
  return (
    <group position={position} userData={{ noMerge: true }}>
      <mesh position={[0, 0.03, 0]} material={fanBody} castShadow>
        <cylinderGeometry args={[0.17, 0.2, 0.06, 24]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} material={mats.metal} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.95, 8]} />
      </mesh>
      <group ref={head} position={[0, 1.0, 0]} rotation={[0, facing, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.1]} material={fanBody} castShadow>
          <capsuleGeometry args={[0.07, 0.12, 6, 14]} />
        </mesh>
        <group position={[0, 0, 0.08]}>
          <mesh material={mats.metal}>
            <torusGeometry args={[0.24, 0.006, 6, 40]} />
          </mesh>
          {cage.map((g, i) => (
            <mesh key={i} geometry={g} material={mats.metal} />
          ))}
          <group ref={blades}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} rotation={[0.25, 0, (i / 3) * Math.PI * 2]} material={fanPlastic}>
                <sphereGeometry args={[0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI]} />
              </mesh>
            ))}
            <mesh material={fanBody}>
              <sphereGeometry args={[0.035, 12, 10]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 蚊香：綠色螺旋放在鐵架上；點了之後尾端有火光、冒一縷煙
// ---------------------------------------------------------------------------

const COIL_TURNS = 3.2
const COIL_R = 0.075
const coilGeo = (() => {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 140; i++) {
    const t = i / 140
    const a = t * COIL_TURNS * Math.PI * 2
    const r = 0.012 + t * (COIL_R - 0.012)
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 180, 0.0055, 5, false)
})()
const coilMat = new THREE.MeshStandardMaterial({ color: '#3f6f3a', roughness: 0.9 })
const coilEmberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.9, 0.3), toneMapped: false })

function Coil({ position, id }: { position: [number, number, number]; id: string }) {
  const mats = useMats()
  const ember = useRef<THREE.Mesh>(null)
  const endA = COIL_TURNS * Math.PI * 2
  const tip: [number, number, number] = [Math.cos(endA) * COIL_R, 0.085, Math.sin(endA) * COIL_R]
  useFrame(({ clock }) => {
    const on = !!obj(id)?.on
    if (ember.current) {
      ember.current.visible = on
      ember.current.scale.setScalar(0.8 + Math.sin(clock.elapsedTime * 5) * 0.15)
    }
  })
  return (
    <group position={position}>
      {/* 鐵架：底盤 + 中間的針 */}
      <mesh position={[0, 0.01, 0]} material={mats.metal}>
        <cylinderGeometry args={[0.09, 0.09, 0.008, 20]} />
      </mesh>
      <mesh position={[0, 0.05, 0]} material={mats.metal}>
        <cylinderGeometry args={[0.003, 0.003, 0.08, 4]} />
      </mesh>
      <mesh geometry={coilGeo} material={coilMat} position={[0, 0.085, 0]} castShadow />
      <group userData={{ noMerge: true }}>
        <mesh ref={ember} position={tip} material={coilEmberMat} visible={false}>
          <sphereGeometry args={[0.008, 8, 6]} />
        </mesh>
        <Wisp position={tip} count={4} height={0.7} size={0.07} speed={0.22} opacity={0.3} visible={() => !!obj(id)?.on} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 客房一的木窗板：關上蓋住窗、打開時折到窗的兩側貼著牆
// ---------------------------------------------------------------------------

function Shutters({ id }: { id: string }) {
  const hinges = useRef<(THREE.Group | null)[]>([])
  const k = useRef(0)
  const x = WING_R.x1 - 0.21 // 貼著客房白灰泥內襯
  const y = FLOOR_Y + 1.5
  const z0 = GUEST_WINDOW_OUT_Z - 0.5
  const z1 = GUEST_WINDOW_OUT_Z + 0.5
  useFrame((_, dt) => {
    const closed = obj(id)?.on ? 1 : 0
    k.current += (closed - k.current) * Math.min(1, dt * 5)
    const open = (1 - k.current) * Math.PI * 0.93
    if (hinges.current[0]) hinges.current[0].rotation.y = -open
    if (hinges.current[1]) hinges.current[1].rotation.y = open
  })
  const Panel = ({ dir }: { dir: 1 | -1 }) => (
    <group position={[0, 0, (dir * 0.5) / 2]}>
      <WBox mat="darkWood" size={[0.03, 1.0, 0.48]} position={[0, 0, 0]} />
      {[-0.3, 0, 0.3].map((yy) => (
        <WBox key={yy} mat="wood" size={[0.04, 0.05, 0.44]} position={[-0.01, yy, 0]} castShadow={false} />
      ))}
    </group>
  )
  return (
    <group userData={{ noMerge: true }}>
      <group
        ref={(el) => {
          hinges.current[0] = el
        }}
        position={[x, y, z0]}
      >
        <Panel dir={1} />
      </group>
      <group
        ref={(el) => {
          hinges.current[1] = el
        }}
        position={[x, y, z1]}
      >
        <Panel dir={-1} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 神明廳（從敞開的大門看進去）
// ---------------------------------------------------------------------------

const lotusMat = new THREE.MeshStandardMaterial({ color: '#ff5a44', emissive: '#ff3a24', emissiveIntensity: 2.2, roughness: 0.5 })
const emberMat = new THREE.MeshBasicMaterial({ color: '#ffb070', toneMapped: false })
const brassMat = new THREE.MeshStandardMaterial({ color: '#b08a45', roughness: 0.3, metalness: 0.8 })
const orangeMat = new THREE.MeshStandardMaterial({ color: '#f08a24', roughness: 0.55 })

function scrollTexture() {
  return canvasTexture(
    384,
    384,
    (ctx, w, h) => {
      ctx.fillStyle = '#b22a22'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#e0b050'
      ctx.lineWidth = 10
      ctx.strokeRect(18, 18, w - 36, h - 36)
      ctx.fillStyle = '#f2c35c'
      ctx.font = `700 280px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('福', w / 2, h / 2 + 12)
    },
    [{ spec: `700 280px ${BRUSH_FONT}`, text: '福' }],
  )
}

function AltarHall() {
  const mats = useMats()
  const scroll = useMemo(scrollTexture, [])
  const lotus = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.05, 0.02],
          [0.08, 0.08],
          [0.09, 0.15],
          [0.06, 0.2],
          [0, 0.19],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        16,
      ),
    [],
  )
  const burner = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.12, 0],
          [0.14, 0.04],
          [0.16, 0.14],
          [0.15, 0.18],
          [0.17, 0.2],
          [0, 0.2],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        24,
      ),
    [],
  )
  const backZ = MAIN.z0 + 0.2
  const tableZ = backZ + 0.42
  const tableTop = FLOOR_Y + 1.05
  const rnd = seeded(12)
  const embers = useRef<THREE.Mesh[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    embers.current.forEach((m, i) => m && m.scale.setScalar(0.8 + Math.sin(t * 3 + i * 2) * 0.25))
    lotusMat.emissiveIntensity = 2.0 + Math.sin(t * 1.3) * 0.2
  })
  return (
    <group>
      {/* 中堂 */}
      <mesh position={[0, FLOOR_Y + 2.1, backZ + 0.01]}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshStandardMaterial map={scroll} roughness={0.7} />
      </mesh>
      {/* 供桌（長桌）與八仙桌 */}
      <WBox mat="redPaint" size={[3.0, 0.08, 0.66]} position={[0, tableTop - 0.04, tableZ]} />
      <WBox mat="redPaint" size={[2.9, 0.3, 0.06]} position={[0, tableTop - 0.22, tableZ + 0.3]} />
      <WBox mat="gold" size={[2.9, 0.03, 0.065]} position={[0, tableTop - 0.1, tableZ + 0.305]} castShadow={false} />
      {[-1.35, 1.35].map((x) => (
        <WBox key={x} mat="redPaint" size={[0.1, tableTop - FLOOR_Y, 0.6]} position={[x, (tableTop + FLOOR_Y) / 2, tableZ]} />
      ))}
      <WBox mat="wood" size={[1.1, 0.07, 1.1]} position={[0, FLOOR_Y + 0.8, tableZ + 1.25]} />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <WBox key={i} mat="darkWood" size={[0.07, 0.78, 0.07]} position={[sx * 0.48, FLOOR_Y + 0.39, tableZ + 1.25 + sz * 0.48]} />
      ))}
      {/* 蓮花燈、香爐、香、水果 */}
      {[-1.0, 1.0].map((x) => (
        <group key={x} position={[x, tableTop, tableZ]}>
          <mesh material={brassMat} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.02, 0.06, 0.24, 10]} />
          </mesh>
          <mesh geometry={lotus} material={lotusMat} position={[0, 0.24, 0]} scale={1.4} />
        </group>
      ))}
      <mesh geometry={burner} material={brassMat} position={[0, tableTop, tableZ]} castShadow />
      {[-0.05, 0, 0.05].map((x, i) => (
        <group key={i} position={[x, tableTop + 0.2, tableZ]} rotation={[0, 0, x * 1.2]}>
          <mesh position={[0, 0.2, 0]} material={mats.redPaper}>
            <cylinderGeometry args={[0.006, 0.006, 0.4, 4]} />
          </mesh>
          <mesh
            ref={(el) => {
              if (el) embers.current[i] = el
            }}
            position={[0, 0.405, 0]}
            material={emberMat}
          >
            <sphereGeometry args={[0.012, 6, 5]} />
          </mesh>
        </group>
      ))}
      {[-0.5, 0.5].map((x) => (
        <group key={x} position={[x, tableTop, tableZ + 0.05]}>
          <mesh material={mats.trim}>
            <cylinderGeometry args={[0.15, 0.1, 0.03, 20]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} material={orangeMat} position={[(rnd() - 0.5) * 0.14, 0.07 + (i === 2 ? 0.08 : 0), (rnd() - 0.5) * 0.14]} castShadow>
              <sphereGeometry args={[0.055, 14, 10]} />
            </mesh>
          ))}
        </group>
      ))}
      <Lantern position={[-0.9, FLOOR_Y + 2.6, tableZ + 0.9]} drop={0.3} scale={0.7} />
      <Lantern position={[0.9, FLOOR_Y + 2.6, tableZ + 0.9]} drop={0.3} scale={0.7} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 阿嬤的房間：床鋪得整整齊齊、裁縫車、梳妝台上的老照片、搖椅
// ---------------------------------------------------------------------------

const quiltPlain = new THREE.MeshStandardMaterial({ color: '#9c5f86', roughness: 0.95 })
const photoFrame = new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.5 })

function photoTexture(seed: number) {
  return canvasTexture(96, 128, (ctx, w, h) => {
    const r = seeded(seed)
    ctx.fillStyle = '#e8dcc0'
    ctx.fillRect(0, 0, w, h)
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#b8a888')
    g.addColorStop(1, '#6f5f48')
    ctx.fillStyle = g
    ctx.fillRect(8, 8, w - 16, h - 16)
    // 模糊的人影
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      const x = 24 + i * 24 + r() * 6
      ctx.fillStyle = 'rgba(40,30,20,0.55)'
      ctx.beginPath()
      ctx.arc(x, 50, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(x - 11, 60, 22, 50)
    }
  })
}

function GrandmaRoom() {
  const mats = useMats()
  const photos = useMemo(() => [photoTexture(3), photoTexture(9)], [])
  return (
    <group>
      {/* 老眠床：床架、摺好的被子 */}
      <group position={[GM_BED.x, FLOOR_Y, GM_BED.z]}>
        <WBox mat="darkWood" size={[GM_BED.w + 0.12, 0.42, GM_BED.l + 0.1]} position={[0, 0.21, 0]} />
        <WBox mat="darkWood" size={[GM_BED.w + 0.2, 1.4, 0.1]} position={[0, 0.7, -GM_BED.l / 2 - 0.05]} />
        {[-1, 1].map((sx) => (
          <WBox key={sx} mat="darkWood" size={[0.08, 1.9, 0.08]} position={[sx * (GM_BED.w / 2 + 0.05), 0.95, GM_BED.l / 2]} />
        ))}
        <WBox mat="darkWood" size={[GM_BED.w + 0.2, 0.1, 0.1]} position={[0, 1.9, GM_BED.l / 2]} />
        <RoundedBox args={[GM_BED.w - 0.05, 0.16, GM_BED.l - 0.05]} radius={0.05} smoothness={2} position={[0, 0.5, 0]} material={clothWhite} castShadow receiveShadow />
        <RoundedBox args={[0.9, 0.24, 0.55]} radius={0.08} smoothness={3} position={[0, 0.7, 0.35]} material={quiltPlain} castShadow />
        <RoundedBox args={[0.7, 0.12, 0.35]} radius={0.05} smoothness={2} position={[0, 0.64, -0.7]} material={pillowMat} castShadow />
      </group>
      {/* 裁縫車 */}
      <group position={[SEWING.x, FLOOR_Y, SEWING.z]}>
        <WBox mat="wood" size={[0.95, 0.05, 0.5]} position={[0, 0.75, 0]} />
        {[-0.4, 0.4].map((x) => (
          <WBox key={x} mat="metal" size={[0.05, 0.73, 0.4]} position={[x, 0.37, 0]} />
        ))}
        <RoundedBox args={[0.45, 0.2, 0.16]} radius={0.05} smoothness={2} position={[0.05, 0.9, 0]} material={mats.black} castShadow />
        <mesh position={[-0.2, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.gold}>
          <cylinderGeometry args={[0.06, 0.06, 0.03, 16]} />
        </mesh>
      </group>
      {/* 梳妝台與老照片（互動點：看老照片） */}
      <group position={[DRESSER.x, FLOOR_Y, DRESSER.z]}>
        <WBox mat="wood" size={[0.5, 0.8, 1.05]} position={[0, 0.4, 0]} />
        <WBox mat="darkWood" size={[0.06, 0.75, 0.6]} position={[-0.2, 1.2, 0]} />
        <mesh position={[-0.165, 1.2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.5, 0.62]} />
          <meshStandardMaterial color="#9fb3c2" roughness={0.05} metalness={0.9} />
        </mesh>
        {photos.map((t, i) => (
          <group key={i} position={[0.05, 0.8 + 0.13, (i - 0.5) * 0.4]} rotation={[0, Math.PI / 2 - 0.25, -0.12]}>
            <mesh material={photoFrame} castShadow>
              <boxGeometry args={[0.2, 0.26, 0.02]} />
            </mesh>
            <mesh position={[0, 0, 0.012]}>
              <planeGeometry args={[0.16, 0.21]} />
              <meshStandardMaterial map={t} roughness={0.7} />
            </mesh>
          </group>
        ))}
      </group>
      <Rocker position={[ROCKER.x, FLOOR_Y, ROCKER.z]} />
    </group>
  )
}

/** 搖椅：平常輕輕晃；被阿嬤附身（gm.rocker）後三秒內自己用力搖 */
function Rocker({ position }: { position: [number, number, number] }) {
  const mats = useMats()
  const g = useRef<THREE.Group>(null)
  const amp = useRef(0.03)
  const phase = useRef(0)
  useFrame((_, dt) => {
    const haunted = since('gm.rocker') < 3000
    amp.current += ((haunted ? 0.26 : 0.03) - amp.current) * Math.min(1, dt * (haunted ? 6 : 1.5))
    // 相位累加：頻率變了也不會跳
    phase.current += dt * (haunted ? 5.5 : 0.8)
    if (g.current) g.current.rotation.x = Math.sin(phase.current) * amp.current
  })
  return (
    <group ref={g} position={position} rotation={[0, 0.6, 0]} userData={{ noMerge: true }}>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.1, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.bamboo}>
          <torusGeometry args={[0.45, 0.02, 6, 24, Math.PI * 0.55]} />
        </mesh>
      ))}
      <WBox mat="wood" size={[0.5, 0.05, 0.45]} position={[0, 0.42, 0]} />
      <WBox mat="wood" size={[0.5, 0.65, 0.05]} position={[0, 0.78, -0.25]} rotation={[-0.2, 0, 0]} />
      {[-0.22, 0.22].map((x) => (
        <WBox key={x} mat="wood" size={[0.04, 0.4, 0.04]} position={[x, 0.24, 0.1]} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 小翰的房間：床、書桌上的筆電、海報
// ---------------------------------------------------------------------------

const laptopScreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.75, 1.1), toneMapped: false })
const bedBlue = new THREE.MeshStandardMaterial({ color: '#4d6f9c', roughness: 0.95 })

function posterTexture(title: string, bg: string, fg: string) {
  return canvasTexture(
    128,
    176,
    (ctx, w, h) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = fg
      ctx.beginPath()
      ctx.arc(w / 2, h * 0.42, 34, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = `900 26px "Noto Sans TC", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(title, w / 2, h - 22)
    },
    [{ spec: `900 26px "Noto Sans TC"`, text: title }],
  )
}

function GrandsonRoom() {
  const mats = useMats()
  const posters = useMemo(() => [posterTexture('台北', '#1f2a44', '#e8a33a'), posterTexture('露營', '#2f5a3a', '#f2e6c8')], [])
  return (
    <group>
      <group position={[HAN_BED.x, FLOOR_Y, HAN_BED.z]}>
        <WBox mat="wood" size={[HAN_BED.w + 0.08, 0.3, HAN_BED.l + 0.08]} position={[0, 0.15, 0]} />
        <RoundedBox args={[HAN_BED.w, 0.18, HAN_BED.l]} radius={0.05} smoothness={2} position={[0, 0.39, 0]} material={clothWhite} castShadow receiveShadow />
        <RoundedBox args={[HAN_BED.w + 0.04, 0.1, HAN_BED.l * 0.6]} radius={0.04} smoothness={2} position={[0, 0.51, HAN_BED.l * 0.18]} material={bedBlue} castShadow />
        <RoundedBox args={[0.6, 0.12, 0.35]} radius={0.05} smoothness={2} position={[0, 0.54, -HAN_BED.l / 2 + 0.3]} material={pillowMat} />
      </group>
      <group position={[HAN_DESK.x, FLOOR_Y, HAN_DESK.z]}>
        <WBox mat="wood" size={[0.6, 0.05, 1.2]} position={[0, 0.74, 0]} />
        {[-0.5, 0.5].map((z) => (
          <WBox key={z} mat="darkWood" size={[0.55, 0.72, 0.05]} position={[0, 0.36, z]} />
        ))}
        {/* 筆電：螢幕朝房間 */}
        <WBox mat="metal" size={[0.24, 0.015, 0.34]} position={[-0.05, 0.775, 0]} />
        <group position={[0.07, 0.775, 0]} rotation={[0, 0, 0.35]}>
          <WBox mat="metal" size={[0.015, 0.24, 0.34]} position={[0, 0.12, 0]} />
          <mesh position={[-0.009, 0.12, 0]} rotation={[0, -Math.PI / 2, 0]} material={laptopScreen}>
            <planeGeometry args={[0.3, 0.2]} />
          </mesh>
        </group>
        <mesh position={[-0.05, 0.8, 0.42]} material={mats.ceramic} castShadow>
          <cylinderGeometry args={[0.04, 0.035, 0.1, 12]} />
        </mesh>
      </group>
      {/* 椅子 */}
      <group position={[HAN_DESK.x - 0.65, FLOOR_Y, HAN_DESK.z]}>
        <WBox mat="wood" size={[0.42, 0.04, 0.42]} position={[0, 0.45, 0]} />
        <WBox mat="wood" size={[0.04, 0.5, 0.42]} position={[-0.2, 0.72, 0]} />
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([a, b], i) => (
          <WBox key={i} mat="darkWood" size={[0.035, 0.44, 0.035]} position={[a * 0.18, 0.22, b * 0.18]} />
        ))}
      </group>
      {posters.map((t, i) => (
        <mesh key={i} position={[4.2 + i * 1.0, FLOOR_Y + 1.8, MAIN.z0 + 0.17]}>
          <planeGeometry args={[0.5, 0.69]} />
          <meshStandardMaterial map={t} roughness={0.8} />
        </mesh>
      ))}
      {/* 背包 */}
      <RoundedBox args={[0.34, 0.45, 0.2]} radius={0.07} smoothness={2} position={[3.0, FLOOR_Y + 0.23, MAIN.z0 + 0.45]} material={bedBlue} castShadow />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 灶腳：磚灶與大鼎、碗櫥、飯桌、水缸、柴
// ---------------------------------------------------------------------------

const wokMat = new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.45, metalness: 0.6 })
const tileWhite = new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.35 })

const fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.9, 0.3), toneMapped: false, transparent: true, opacity: 0 })

/** 灶火：kitchen.stove 開著時灶口亮、會閃，鼎上冒蒸氣 */
function StoveFire() {
  const light = useRef<THREE.PointLight>(null)
  const heat = useRef(0)
  useFrame(({ clock }, dt) => {
    const on = obj('kitchen.stove')?.on ? 1 : 0
    heat.current += (on - heat.current) * Math.min(1, dt * 3)
    const t = clock.elapsedTime
    const flick = 0.8 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.08
    fireMat.opacity = heat.current * flick
    if (light.current) light.current.intensity = heat.current * 1.6 * flick
  })
  return (
    <group userData={{ noMerge: true }}>
      <mesh position={[0.565, 0.3, 0]} rotation={[0, Math.PI / 2, 0]} material={fireMat}>
        <planeGeometry args={[0.32, 0.25]} />
      </mesh>
      <pointLight ref={light} position={[0.85, 0.4, 0]} color="#ff7a2a" intensity={0} distance={4} decay={2} />
      <Wisp position={[0.05, 0.9, -0.4]} count={5} height={0.9} size={0.2} speed={0.3} opacity={0.35} visible={() => !!obj('kitchen.stove')?.on} />
    </group>
  )
}

function Kitchen() {
  const mats = useMats()
  const wok = useMemo(() => new THREE.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [])
  const logs = useMemo(() => {
    const r = seeded(4)
    return Array.from({ length: 9 }, (_, i) => ({ x: (i % 3) * 0.15, y: Math.floor(i / 3) * 0.13 + 0.07, z: (r() - 0.5) * 0.08, rot: (r() - 0.5) * 0.2 }))
  }, [])
  return (
    <group>
      {/* 灶：磚砌，檯面貼白磁磚，兩口大鼎 */}
      <group position={[STOVE.x, FLOOR_Y, STOVE.z]}>
        <WBox mat="brick" size={[1.1, 0.8, 1.65]} position={[0, 0.4, 0]} />
        <mesh position={[0, 0.81, 0]} material={tileWhite} receiveShadow>
          <boxGeometry args={[1.14, 0.03, 1.69]} />
        </mesh>
        {[-0.4, 0.42].map((z) => (
          <group key={z} position={[0.05, 0.84, z]}>
            <mesh geometry={wok} material={wokMat} castShadow />
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.darkWood}>
              <circleGeometry args={[0.3, 20]} />
            </mesh>
          </group>
        ))}
        {/* 灶口 */}
        <mesh position={[0.56, 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.35, 0.28]} />
          <meshStandardMaterial color="#120c08" />
        </mesh>
        <StoveFire />
      </group>
      {/* 碗櫥：紗門 */}
      <group position={[CUPBOARD.x, FLOOR_Y, CUPBOARD.z]}>
        <WBox mat="wood" size={[1.0, 1.7, 0.45]} position={[0, 0.85, 0]} />
        {[-0.24, 0.24].map((x) => (
          <mesh key={x} position={[x, 1.2, -0.23]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.4, 0.7]} />
            <meshStandardMaterial color="#6f8a7a" roughness={0.9} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
      {/* 飯桌與碗 */}
      <group position={[KITCHEN_TABLE.x, FLOOR_Y, KITCHEN_TABLE.z]}>
        <mesh position={[0, 0.72, 0]} material={mats.darkWood} castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.04, 24]} />
        </mesh>
        <mesh position={[0, 0.36, 0]} material={mats.darkWood} castShadow>
          <cylinderGeometry args={[0.05, 0.16, 0.7, 10]} />
        </mesh>
        {[
          [0.12, 0.1],
          [-0.15, -0.05],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.77, z]} material={mats.trim} castShadow>
            <cylinderGeometry args={[0.07, 0.045, 0.06, 14]} />
          </mesh>
        ))}
      </group>
      {/* 水缸 */}
      <mesh position={[KITCHEN_JAR.x, FLOOR_Y + 0.35, KITCHEN_JAR.z]} material={mats.ceramic} castShadow>
        <cylinderGeometry args={[0.36, 0.28, 0.7, 20]} />
      </mesh>
      {/* 柴堆 */}
      <group position={[WING_L.x0 + 0.3, FLOOR_Y, STOVE.z + 1.3]} rotation={[0, Math.PI / 2, 0]}>
        {logs.map((l, i) => (
          <mesh key={i} position={[l.x - 0.15, l.y, l.z]} rotation={[0, l.rot, Math.PI / 2]} material={mats.wood} castShadow>
            <cylinderGeometry args={[0.065, 0.065, 0.55, 7]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 浴廁（右護龍後間）：蹲式馬桶、洗手台與鏡子（之後「鏡中人」的位置）、紅水桶
// ---------------------------------------------------------------------------

const mirrorMat = new THREE.MeshStandardMaterial({ color: '#b9c9d4', roughness: 0.04, metalness: 0.95 })
const bucketMat = new THREE.MeshStandardMaterial({ color: '#d4322a', roughness: 0.4 })

const ghostFace = new THREE.MeshBasicMaterial({
  color: new THREE.Color(0.7, 1.4, 1.5),
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
})

/** 鏡中人：bath.mirror 觸發後 2.5 秒內，鏡子裡浮出阿嬤的臉（淡青色，淡入淡出） */
function MirrorGhost() {
  const mesh = useRef<THREE.Mesh>(null)
  useMemo(() => {
    if (!ghostFace.map) {
      ghostFace.map = svgTexture(portraitSvg('grandma'), PORTRAIT_SIZE, PORTRAIT_SIZE, 1)
      ghostFace.needsUpdate = true
    }
  }, [])
  useFrame(({ clock }) => {
    const t = since('bath.mirror')
    let a = 0
    if (t < 2500) a = Math.min(1, t / 400) * Math.min(1, (2500 - t) / 600)
    ghostFace.opacity = a * (0.75 + Math.sin(clock.elapsedTime * 9) * 0.1)
    if (mesh.current) {
      mesh.current.visible = a > 0.01
      mesh.current.position.y = 1.55 + Math.sin(clock.elapsedTime * 2) * 0.01
    }
  })
  return (
    <group userData={{ noMerge: true }}>
      <mesh ref={mesh} position={[0.228, 1.55, 0]} rotation={[0, -Math.PI / 2, 0]} material={ghostFace} visible={false} renderOrder={3}>
        <planeGeometry args={[0.4, 0.4]} />
      </mesh>
    </group>
  )
}

function Bathroom() {
  const mats = useMats()
  const wallX = WING_R.x1 - 0.16
  return (
    <group>
      {/* 牆腳白磁磚 */}
      <mesh position={[wallX - 0.005, FLOOR_Y + 0.6, (WING_R.z0 + WING_R.split) / 2]} rotation={[0, -Math.PI / 2, 0]} material={tileWhite}>
        <planeGeometry args={[WING_R.split - WING_R.z0 - 0.3, 1.2]} />
      </mesh>
      {/* 蹲式馬桶 */}
      <group position={[TOILET.x, FLOOR_Y, TOILET.z]}>
        <mesh position={[0, 0.06, 0]} material={tileWhite} castShadow>
          <boxGeometry args={[0.44, 0.12, 0.56]} />
        </mesh>
        <mesh position={[0, 0.125, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.13, 20]} />
          <meshStandardMaterial color="#3a4a52" roughness={0.1} />
        </mesh>
      </group>
      {/* 洗手台與鏡子 */}
      <group position={[SINK.x, FLOOR_Y, SINK.z]}>
        <mesh position={[0, 0.8, 0]} material={tileWhite} castShadow>
          <boxGeometry args={[0.4, 0.14, 0.5]} />
        </mesh>
        <mesh position={[0, 0.4, 0]} material={tileWhite}>
          <cylinderGeometry args={[0.06, 0.08, 0.72, 10]} />
        </mesh>
        <mesh position={[0.1, 0.92, 0]} material={mats.metal}>
          <cylinderGeometry args={[0.012, 0.012, 0.14, 6]} />
        </mesh>
        <mesh position={[0.235, 1.55, 0]} rotation={[0, -Math.PI / 2, 0]} material={mirrorMat}>
          <planeGeometry args={[0.45, 0.6]} />
        </mesh>
        <MirrorGhost />
      </group>
      {/* 紅水桶與水瓢 */}
      <group position={[BUCKET.x, FLOOR_Y, BUCKET.z]}>
        <mesh position={[0, 0.2, 0]} material={bucketMat} castShadow>
          <cylinderGeometry args={[0.22, 0.18, 0.4, 20, 1, true]} />
        </mesh>
        <mesh position={[0, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.21, 20]} />
          <meshStandardMaterial color="#5a7a88" roughness={0.05} />
        </mesh>
        <mesh position={[0.08, 0.4, 0.05]} rotation={[0.3, 0, 0.2]} material={bucketMat}>
          <cylinderGeometry args={[0.07, 0.06, 0.07, 12]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 八仙桌上的老收音機（附身收音機：刻度盤亮起來、飄出音符）
// ---------------------------------------------------------------------------

const noteTex = canvasTexture(64, 64, (ctx, w, h) => {
  ctx.fillStyle = 'rgba(255,226,150,0.95)'
  ctx.font = '48px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('♪', w / 2, h / 2)
})

function Radio() {
  const mats = useMats()
  const dial = useRef<THREE.MeshStandardMaterial>(null)
  const notes = useRef<(THREE.Sprite | null)[]>([])
  const y = FLOOR_Y + 0.835
  useFrame(({ clock }) => {
    const on = !!obj('hall.radio')?.on
    const t = clock.elapsedTime
    if (dial.current) dial.current.emissiveIntensity = on ? 1.6 + Math.sin(t * 8) * 0.2 : 0.05
    notes.current.forEach((sp, i) => {
      if (!sp) return
      sp.visible = on
      if (!on) return
      const k = (t * 0.35 + i / 3) % 1
      sp.position.set(Math.sin(k * 6 + i) * 0.18, 0.25 + k * 0.9, Math.cos(k * 5 + i) * 0.08)
      ;(sp.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI)
    })
  })
  return (
    <group position={[RADIO.x, y, RADIO.z]} rotation={[0, 0.25, 0]} userData={{ noMerge: true }}>
      <mesh position={[0, 0.11, 0]} material={mats.darkWood} castShadow>
        <boxGeometry args={[0.36, 0.22, 0.15]} />
      </mesh>
      {/* 喇叭布 */}
      <mesh position={[-0.07, 0.12, 0.076]}>
        <planeGeometry args={[0.17, 0.15]} />
        <meshStandardMaterial color="#b89a6a" roughness={1} />
      </mesh>
      {/* 刻度盤 */}
      <mesh position={[0.1, 0.14, 0.077]}>
        <planeGeometry args={[0.12, 0.06]} />
        <meshStandardMaterial ref={dial} color="#f0d9a0" emissive="#ffb84d" emissiveIntensity={0.05} roughness={0.6} />
      </mesh>
      {[0.06, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.06, 0.08]} rotation={[Math.PI / 2, 0, 0]} material={mats.black}>
          <cylinderGeometry args={[0.018, 0.018, 0.02, 10]} />
        </mesh>
      ))}
      {/* 天線 */}
      <mesh position={[0.14, 0.34, -0.04]} rotation={[0, 0, -0.35]} material={mats.black}>
        <cylinderGeometry args={[0.004, 0.004, 0.3, 4]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <sprite
          key={i}
          ref={(el) => {
            notes.current[i] = el
          }}
          scale={[0.13, 0.13, 1]}
          visible={false}
        >
          <spriteMaterial map={noteTex} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}
