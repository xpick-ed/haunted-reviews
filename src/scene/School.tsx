import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, type Quality } from '../store'
import { CLASSROOM, LIBRARY, SCHOOL, schoolStore } from '../world/sceneSchool'
import { lanternAt } from './daylight'
import { BRUSH_FONT, TILE, WBox, canvasTexture, planeGeo, seeded, useMats } from './kit'
import { GableRoof, Wall, type Opening } from './House'
import { MergeStatic } from './MergeStatic'
import { Tree } from './Tree'
import { buildGrass } from './Landscape'
import { Ground } from './VillageKit'
import { Bell, FlagPole, HopscotchChalk, Playground, SchoolStage, SchoolWalls, StatueBase, Trough } from './SchoolProps'
import { SchoolKids } from './SchoolKids'
import { RoomsInside, RoomsLive } from './SchoolRooms'
import '../chars/specs.school'

// 廢棄國小（DESIGN §26.1）：阿嬤小時候讀的「後壁厝國民學校」，廢校很多年了。
// 西北是一排四間（圖書室、保健室、教師辦公室、六年甲班，都可以進去；進去時那一間的屋頂和南牆淡出），東北是司令台與升旗台，
// 中間是沙地操場，南邊（鏡頭這一側）只放矮的遊樂器材。規則與座標在 src/world/sceneSchool.ts。

const S = SCHOOL
const B = S.block
const SLOPE = 0.52
const RIDGE_Z = (B.z0 + B.z1) / 2
const RIDGE_Y = B.wallTop + ((B.z1 - B.z0) / 2) * SLOPE
const CANOPY_Y = 2.98

export function SchoolScene() {
  const quality = useStore((s) => s.quality)
  const isNight = useStore((s) => s.isNight)
  useSchoolBridge()
  return (
    <group>
      <Grounds />
      <Greenery quality={quality} />
      <MergeStatic>
        <SchoolWalls />
        <Platform />
        <BlockStatic />
        <Corridor />
        <ClassroomInside />
        <RoomsInside />
        <SchoolStage />
        <FlagPole />
        <StatueBase />
        <Playground />
        <Trough />
      </MergeStatic>
      {/* 鏡頭在東南邊：走進哪一間，東邊隔壁那一間也一起淡出（不然它的屋頂會擋住一半） */}
      <Fader id={['school_room', 'school_office']}>
        <ClassroomShell />
      </Fader>
      {ROOMS.map((r, i) => (
        <Fader key={r.id} id={i > 0 ? [r.id, ROOMS[i - 1].id] : [r.id]}>
          <RoomShell i={i} />
        </Fader>
      ))}
      <RoomsLive outline={quality === 'high'} />
      <HopscotchChalk />
      <Bell />
      <FlameTree />
      <SchoolKids />
      <SchoolLights />
      <Sparkles count={24} scale={[3.4, 2.2, 3.6]} position={[(CLASSROOM.x0 + CLASSROOM.x1) / 2, 1.6, (CLASSROOM.z0 + CLASSROOM.z1) / 2]} size={2} speed={0.15} color="#fff4d8" opacity={0.45} />
      {/* 圖書室的灰塵 */}
      <Sparkles count={18} scale={[3.2, 2.0, 3.4]} position={[(LIBRARY.x0 + LIBRARY.x1) / 2, 1.5, (LIBRARY.z0 + LIBRARY.z1) / 2]} size={1.6} speed={0.1} color="#e8eeff" opacity={0.4} />
      <group visible={isNight}>
        <Sparkles count={40} scale={[34, 1.6, 18]} position={[0, 0.9, 1]} size={3.5} speed={0.3} color="#e8ff8a" opacity={0.9} noise={1.4} />
      </group>
    </group>
  )
}

/** 把 store 的寫入掛給 sceneSchool.ts 的熱點用；第一次來的時候阿嬤講一句 */
function useSchoolBridge() {
  useEffect(() => {
    schoolStore.set = (fn) => useStore.setState(fn)
    const s = useStore.getState()
    let t = 0
    if (!s.flags.school_seen) {
      useStore.setState({ flags: { ...s.flags, school_seen: true } })
      t = window.setTimeout(() => useStore.getState().bark('school.enter'), 1200)
    }
    return () => {
      window.clearTimeout(t)
      schoolStore.set = undefined
    }
  }, [])
}

// ---------------------------------------------------------------------------
// 地面：草地、沙地操場（跑道）、走廊前的水泥地、校門進來的小路
// ---------------------------------------------------------------------------

function Grounds() {
  const mats = useMats()
  const f = S.field
  const tk = S.track
  const lineMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e9e4d6', roughness: 1, transparent: true, opacity: 0.45 }), [])
  return (
    <group>
      <mesh geometry={planeGeo(200, 200, TILE.grass)} material={mats.grass} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow />
      <Ground mat="mud" w={f.x1 - f.x0} d={f.z1 - f.z0} position={[(f.x0 + f.x1) / 2, 0.01, (f.z0 + f.z1) / 2]} tint="#f4dfb2" />
      {/* 跑道：兩圈褪色的白線 */}
      {[1, 0.86].map((k) => (
        <mesh key={k} rotation-x={-Math.PI / 2} position={[tk.cx, 0.02, tk.cz]} scale={[tk.rx * k, tk.rz * k, 1]} material={lineMat}>
          <ringGeometry args={[0.985, 1, 64]} />
        </mesh>
      ))}
      {/* 走廊前的水泥地、校門進來的小路、司令台前 */}
      <Ground mat="yard" w={B.x1 - B.x0 + 3} d={S.corridor.z1 - -2.8} position={[(B.x0 + B.x1) / 2 + 1, 0.015, (S.corridor.z1 + -2.8) / 2]} tint="#9d978b" />
      <Ground mat="yard" w={2.2} d={7.5} position={[S.gate.x, 0.014, S.wall.z0 + 3.75]} tint="#9d978b" />
      <Ground mat="yard" w={S.stage.x1 - S.stage.x0 + 4} d={3.5} position={[(S.stage.x0 + S.stage.x1) / 2 + 1.5, 0.013, S.stage.z1 + 0.6]} tint="#948e82" />
      {/* 牆外：往村子的田 */}
      <Ground mat="mud" w={60} d={8} position={[0, 0.005, S.wall.z0 - 4.6]} tint="#6f6a52" />
    </group>
  )
}

function schoolGround(x: number, z: number): 'grass' | null {
  const f = S.field
  if (x < S.wall.x0 - 0.3 || x > S.wall.x1 + 0.3 || z < S.wall.z0 + 0.3 || z > S.wall.z1 + 1.5) return z > S.wall.z1 ? 'grass' : null
  if (x > B.x0 - 0.6 && x < B.x1 + 3 && z < -2.6) return null // 教室、走廊、水泥地
  if (Math.abs(x - S.gate.x) < 1.3 && z < -5.5) return null
  if (x > S.stage.x0 - 1 && x < S.flag.x + 1.2 && z < -8) return null
  // 操場中間被踩禿了，邊邊長草
  if (x > f.x0 + 1.2 && x < f.x1 - 1.2 && z > f.z0 + 1 && z < f.z1 - 1) return null
  if (Math.hypot(x - S.tree.x, z - S.tree.z) < 1.2) return null
  return 'grass'
}

function Greenery({ quality }: { quality: Quality }) {
  const grass = useMemo(() => buildGrass(quality, { ground: schoolGround, rMin: 1, rSpan: 22, seed: 7373, scale: 0.9 }), [quality])
  const weeds = useMemo(() => {
    const r = seeded(4242)
    const out: { x: number; z: number; s: number; c: number }[] = []
    while (out.length < 34) {
      const x = S.wall.x0 + 0.8 + r() * (S.wall.x1 - S.wall.x0 - 1.6)
      const z = S.wall.z0 + 0.8 + r() * (S.wall.z1 - S.wall.z0 - 1.6)
      if (schoolGround(x, z) !== 'grass') continue
      out.push({ x, z, s: 0.35 + r() * 0.35, c: out.length % 3 })
    }
    return out
  }, [])
  const mats = useMemo(() => ['#3c5a30', '#4a6634', '#33502c'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })), [])
  return (
    <group>
      <primitive object={grass.grass} />
      <primitive object={grass.flowers} />
      {weeds.map((w, i) => (
        <mesh key={i} position={[w.x, w.s * 0.45, w.z]} scale={[w.s * 1.2, w.s, w.s * 1.1]} material={mats[w.c]} castShadow receiveShadow>
          <icosahedronGeometry args={[0.7, 1]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 教室那一排：台基、四間的牆與屋頂、走廊（平頂＋柱子）；另外三間的室內在 SchoolRooms.tsx
// ---------------------------------------------------------------------------

function Platform() {
  const x0 = B.x0 - 0.25
  const x1 = B.x1 + 0.25
  const z0 = B.z0 - 0.25
  const z1 = S.corridor.z1
  return (
    <group>
      <WBox mat="yard" size={[x1 - x0, B.floorY, z1 - z0]} position={[(x0 + x1) / 2, B.floorY / 2, (z0 + z1) / 2]} />
      <WBox mat="trim" size={[x1 - x0, 0.05, 0.12]} position={[(x0 + x1) / 2, B.floorY - 0.02, z1 - 0.05]} />
    </group>
  )
}

/** 一面牆上的窗（每間教室兩扇） */
const WIN_Y0 = 0.95
const WIN_Y1 = 2.35
function roomWindows(x0: number, x1: number, skip?: { c: number; w: number }): Opening[] {
  const w = x1 - x0
  const out: Opening[] = [
    { c: x0 + w * 0.3, w: 1.45, y0: WIN_Y0, y1: WIN_Y1 },
    { c: x0 + w * 0.72, w: 1.45, y0: WIN_Y0, y1: WIN_Y1 },
  ]
  return skip ? out.filter((o) => Math.abs(o.c - skip.c) > (o.w + skip.w) / 2 + 0.1) : out
}

/** 三間（圖書室、保健室、辦公室）的名字、門、淡出用的建築 id */
const ROOMS = [
  { id: 'school_lib', name: '圖書室', door: S.library.door, slogan: '說國語 講禮貌' },
  { id: 'school_nurse', name: '保健室', door: S.nurse.door, slogan: '好學生 守秩序' },
  { id: 'school_office', name: '教師辦公室', door: S.office.door, slogan: '' },
]

/** 不會淡出的部分：北牆（鏡頭對面）、最西邊的山牆下的西牆 */
function BlockStatic() {
  const xs = [B.x0, ...S.splits]
  const x3 = S.splits[2]
  const northOpen = useMemo(() => [0, 1, 2].flatMap((i) => roomWindows(xs[i], xs[i + 1])), [])
  return (
    <group>
      <Wall axis="x" from={B.x0} to={x3} at={B.z0} top={B.wallTop} base={B.floorY} thick={0.24} mat="plaster" openings={northOpen} />
      <Wall axis="z" from={B.z0} to={B.z1} at={B.x0} top={B.wallTop} base={B.floorY} thick={0.24} mat="plaster" />
      {northOpen.map((o, i) => (
        <Window key={`n${i}`} x={o.c} z={B.z0} w={o.w} seed={i + 20} />
      ))}
    </group>
  )
}

/**
 * 一間的南牆（門開著一半＋一扇窗）、東邊的隔間牆、班級牌、屋頂、門口那段走廊的平頂（最西邊那間多一面山牆）：走進去就淡出。
 * 鏡頭從東南方低低地看過來，所以東邊的隔間牆也要淡掉，貼著東牆的東西才看得到。
 */
function RoomShell({ i }: { i: number }) {
  const xs = [B.x0, ...S.splits]
  const a = xs[i]
  const b = xs[i + 1]
  const room = ROOMS[i]
  const south = useMemo<Opening[]>(
    () => [
      { c: room.door, w: S.door.w, y0: 0, y1: 2.2 },
      { c: a + 1.2, w: 1.45, y0: WIN_Y0, y1: WIN_Y1 },
    ],
    [a, room.door],
  )
  return (
    <group>
      <Wall axis="x" from={a} to={b} at={B.z1} top={B.wallTop} base={B.floorY} thick={0.24} mat="plaster" openings={south} />
      <Window x={a + 1.2} z={B.z1} w={1.45} seed={i * 3 + 1} />
      {/* 拉門開著一半 */}
      <mesh position={[room.door - S.door.w * 0.85, B.floorY + 1.1, B.z1 + 0.16]} castShadow>
        <boxGeometry args={[S.door.w, 2.2, 0.05]} />
        <meshStandardMaterial color="#6b4a30" roughness={0.85} />
      </mesh>
      {i === 0 && <GableEnd x={B.x0} />}
      <GableRoof axis="x" ridge={RIDGE_Z} ridgeY={RIDGE_Y} from={i === 0 ? B.x0 - 0.35 : a} to={b} edges={[B.z0 - 0.45, B.z1 + 0.4]} style="horseback" />
      <ClassSign x={room.door} text={room.name} />
      <Canopy x0={i === 0 ? B.x0 - 0.3 : a} x1={b} />
      {/* 走廊平頂前緣的標語（褪色） */}
      {room.slogan && <Slogan x={(S.corridor.colXs[i] + S.corridor.colXs[i + 1]) / 2} text={room.slogan} />}
      <Wall axis="z" from={B.z0} to={B.z1} at={b} top={B.wallTop} base={B.floorY} thick={0.2} mat="plaster" skirt={false} />
    </group>
  )
}

/** 可以進去的那間：外牆（東、南）與屋頂會淡出 */
function ClassroomShell() {
  const x3 = S.splits[2]
  const south = useMemo<Opening[]>(() => [{ c: S.door.c, w: S.door.w, y0: 0, y1: 2.2 }, ...roomWindows(x3, B.x1, { c: S.door.c, w: S.door.w })], [x3])
  const north = useMemo(() => roomWindows(x3, B.x1), [x3])
  return (
    <group>
      <Wall axis="x" from={x3} to={B.x1} at={B.z1} top={B.wallTop} base={B.floorY} thick={0.24} mat="plaster" openings={south} />
      <Wall axis="x" from={x3} to={B.x1} at={B.z0} top={B.wallTop} base={B.floorY} thick={0.24} mat="plaster" openings={north} />
      <Wall axis="z" from={B.z0} to={B.z1} at={B.x1} top={B.wallTop} base={B.floorY} thick={0.24} mat="plaster" />
      {south
        .filter((o) => o.y0 > 0)
        .map((o, i) => (
          <Window key={i} x={o.c} z={B.z1} w={o.w} seed={40 + i} glass={false} />
        ))}
      {north.map((o, i) => (
        <Window key={`n${i}`} x={o.c} z={B.z0} w={o.w} seed={50 + i} glass={false} />
      ))}
      {/* 拉門開著一半 */}
      <mesh position={[S.door.c - S.door.w * 0.85, B.floorY + 1.1, B.z1 + 0.16]} castShadow>
        <boxGeometry args={[S.door.w, 2.2, 0.05]} />
        <meshStandardMaterial color="#6b4a30" roughness={0.85} />
      </mesh>
      <GableEnd x={B.x1} />
      <GableRoof axis="x" ridge={RIDGE_Z} ridgeY={RIDGE_Y} from={x3} to={B.x1 + 0.35} edges={[B.z0 - 0.45, B.z1 + 0.4]} style="horseback" />
      <ClassSign x={S.door.c} text="六年甲班" />
      <Canopy x0={x3} x1={B.x1 + 0.3} />
    </group>
  )
}

/** 山牆（屋頂兩端的三角形） */
function GableEnd({ x }: { x: number }) {
  const mats = useMats()
  const geo = useMemo(() => {
    const shape = new THREE.Shape([new THREE.Vector2(-B.z0, B.wallTop - 0.01), new THREE.Vector2(-B.z1, B.wallTop - 0.01), new THREE.Vector2(-RIDGE_Z, RIDGE_Y)])
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.24, bevelEnabled: false })
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TILE.plaster, uv.getY(i) / TILE.plaster)
    return g
  }, [])
  return <mesh geometry={geo} material={mats.plaster} position={[x - 0.12, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
}

/** 教室門上面的班級牌（白底黑字） */
function ClassSign({ x, text }: { x: number; text: string }) {
  const wide = text.length > 4
  const tex = useMemo(
    () =>
      canvasTexture(
        wide ? 320 : 256,
        96,
        (ctx, w, h) => {
          ctx.fillStyle = '#ece6d6'
          ctx.fillRect(0, 0, w, h)
          ctx.strokeStyle = '#3d271a'
          ctx.lineWidth = 8
          ctx.strokeRect(4, 4, w - 8, h - 8)
          ctx.fillStyle = '#2a2420'
          ctx.font = `700 54px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(text, w / 2, h / 2 + 3)
        },
        [{ spec: `700 54px ${BRUSH_FONT}`, text }],
      ),
    [text],
  )
  return (
    <mesh position={[x, B.floorY + 2.55, B.z1 + 0.14]}>
      <planeGeometry args={[wide ? 1.0 : 0.8, 0.3]} />
      <meshStandardMaterial map={tex} roughness={0.9} />
    </mesh>
  )
}

/** 木框窗：上下兩排格子，有幾格玻璃破了 */
const glassMat = new THREE.MeshStandardMaterial({ color: '#8fa9b4', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
function Window({ x, z, w, seed, glass = true }: { x: number; z: number; w: number; seed: number; glass?: boolean }) {
  const r = seeded(seed * 97 + 13)
  const h = WIN_Y1 - WIN_Y0
  const y = B.floorY + (WIN_Y0 + WIN_Y1) / 2
  const cols = 3
  const rows = 2
  const panes: { px: number; py: number }[] = []
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (r() > 0.28) panes.push({ px: x - w / 2 + (w / cols) * (i + 0.5), py: y - h / 2 + (h / rows) * (j + 0.5) })
  return (
    <group>
      <WBox mat="darkWood" size={[w, 0.07, 0.1]} position={[x, y + h / 2, z]} />
      <WBox mat="darkWood" size={[w, 0.07, 0.1]} position={[x, y - h / 2, z]} />
      <WBox mat="darkWood" size={[w, 0.05, 0.08]} position={[x, y, z]} />
      {Array.from({ length: cols + 1 }, (_, i) => (
        <WBox key={i} mat="darkWood" size={[0.05, h, 0.08]} position={[x - w / 2 + (w / cols) * i, y, z]} />
      ))}
      {glass && panes.map((p, i) => (
        <mesh key={i} position={[p.px, p.py, z]} material={glassMat}>
          <planeGeometry args={[w / cols - 0.05, h / rows - 0.05]} />
        </mesh>
      ))}
    </group>
  )
}

function Corridor() {
  return (
    <group>
      {/* 平頂走廊（混凝土）在 Canopy：每一間門口那一段，走進那一間就跟著淡出（不然會擋住鏡頭） */}
      {S.corridor.colXs.map((x) => (
        <WBox key={x} mat="plaster" size={[0.24, CANOPY_Y - B.floorY, 0.24]} position={[x, (CANOPY_Y + B.floorY) / 2, S.corridor.colZ]} />
      ))}
    </group>
  )
}

/** 走廊的平頂（混凝土＋前緣的收邊）：x0～x1 那一段 */
function Canopy({ x0, x1 }: { x0: number; x1: number }) {
  const z0 = B.z1
  const z1 = S.corridor.z1 + 0.2
  return (
    <group>
      <WBox mat="yard" size={[x1 - x0, 0.16, z1 - z0]} position={[(x0 + x1) / 2, CANOPY_Y + 0.08, (z0 + z1) / 2]} />
      <WBox mat="trim" size={[x1 - x0, 0.22, 0.08]} position={[(x0 + x1) / 2, CANOPY_Y + 0.06, z1]} />
    </group>
  )
}

function Slogan({ x, text }: { x: number; text: string }) {
  const tex = useMemo(
    () =>
      canvasTexture(
        512,
        80,
        (ctx, w, h) => {
          ctx.fillStyle = 'rgba(0,0,0,0)'
          ctx.clearRect(0, 0, w, h)
          ctx.fillStyle = 'rgba(170,52,40,0.7)'
          ctx.font = `700 56px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(text, w / 2, h / 2 + 4)
        },
        [{ spec: `700 56px ${BRUSH_FONT}`, text }],
      ),
    [text],
  )
  return (
    <mesh position={[x, CANOPY_Y - 0.14, S.corridor.z1 + 0.31]}>
      <planeGeometry args={[2.2, 0.34]} />
      <meshStandardMaterial map={tex} transparent roughness={1} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 教室裡面：木地板、黑板、講桌、風琴、三排雙人課桌椅、阿嬤刻了「春」的那張桌子
// ---------------------------------------------------------------------------

function blackboardTex() {
  return canvasTexture(
    1024,
    460,
    (ctx, w, h) => {
      ctx.fillStyle = '#26382e'
      ctx.fillRect(0, 0, w, h)
      // 擦不乾淨的粉筆灰
      const r = seeded(99)
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = `rgba(230,230,220,${r() * 0.06})`
        ctx.fillRect(r() * w, r() * h, 60 + r() * 200, 10 + r() * 40)
      }
      ctx.strokeStyle = 'rgba(240,238,228,0.85)'
      ctx.fillStyle = 'rgba(240,238,228,0.85)'
      ctx.lineWidth = 5
      ctx.lineCap = 'round'
      ctx.font = `700 46px ${BRUSH_FONT}`
      ctx.textBaseline = 'top'
      ctx.fillText('值日生：春', 40, 30)
      ctx.fillText('今天不上課！', 40, 90)
      // 小孩鬼畫的：房子、太陽、四個小人手牽手
      ctx.beginPath()
      ctx.moveTo(560, 260)
      ctx.lineTo(640, 190)
      ctx.lineTo(720, 260)
      ctx.lineTo(720, 360)
      ctx.lineTo(560, 360)
      ctx.closePath()
      ctx.stroke()
      ctx.strokeRect(620, 300, 36, 60)
      ctx.beginPath()
      ctx.arc(880, 110, 44, 0, Math.PI * 2)
      ctx.stroke()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(880 + Math.cos(a) * 58, 110 + Math.sin(a) * 58)
        ctx.lineTo(880 + Math.cos(a) * 80, 110 + Math.sin(a) * 80)
        ctx.stroke()
      }
      for (let i = 0; i < 4; i++) {
        const x = 110 + i * 90
        ctx.beginPath()
        ctx.arc(x, 250, 18, 0, Math.PI * 2)
        ctx.moveTo(x, 268)
        ctx.lineTo(x, 330)
        ctx.moveTo(x - 45, 290)
        ctx.lineTo(x + 45, 290)
        ctx.moveTo(x, 330)
        ctx.lineTo(x - 20, 380)
        ctx.moveTo(x, 330)
        ctx.lineTo(x + 20, 380)
        ctx.stroke()
      }
      ctx.font = `700 34px ${BRUSH_FONT}`
      ctx.fillText('阿弟 阿妹 阿龍 阿珠', 60, 395)
    },
    [{ spec: `700 46px ${BRUSH_FONT}`, text: '值日生：春今天不上課！阿弟妹龍珠' }],
  )
}

function carvedTex() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(40,22,10,0.85)'
    ctx.fillStyle = 'rgba(40,22,10,0.85)'
    ctx.font = `700 84px ${BRUSH_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('春', w / 2, h / 2 + 4)
  }, [{ spec: `700 84px ${BRUSH_FONT}`, text: '春' }])
}

function ClassroomInside() {
  const mats = useMats()
  const board = useMemo(blackboardTex, [])
  const carved = useMemo(carvedTex, [])
  const x3 = S.splits[2]
  const y0 = B.floorY
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.85 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5b5f66', roughness: 0.5, metalness: 0.6 }), [])
  return (
    <group>
      {/* 木地板 */}
      <mesh rotation-x={-Math.PI / 2} position={[(x3 + B.x1) / 2, y0 + 0.005, (B.z0 + B.z1) / 2]} material={mats.wood} receiveShadow>
        <planeGeometry args={[B.x1 - x3 - 0.2, B.z1 - B.z0 - 0.2]} />
      </mesh>
      {/* 黑板＋粉筆槽 */}
      <WBox mat="darkWood" size={[2.6, 1.3, 0.06]} position={[S.blackboard.x, y0 + 1.7, B.z0 + 0.15]} />
      <mesh position={[S.blackboard.x, y0 + 1.7, B.z0 + 0.185]}>
        <planeGeometry args={[2.45, 1.15]} />
        <meshStandardMaterial map={board} roughness={0.95} />
      </mesh>
      <WBox mat="darkWood" size={[2.5, 0.05, 0.1]} position={[S.blackboard.x, y0 + 1.03, B.z0 + 0.22]} />
      {/* 講台＋講桌 */}
      <WBox mat="wood" size={[2.4, 0.15, 1.0]} position={[S.teacherDesk.x, y0 + 0.075, S.teacherDesk.z - 0.25]} />
      <WBox mat="darkWood" size={[1.1, 0.8, 0.5]} position={[S.teacherDesk.x, y0 + 0.55, S.teacherDesk.z]} />
      {/* 風琴 */}
      <group position={[S.organ.x, y0, S.organ.z]}>
        <WBox mat="darkWood" size={[0.5, 1.05, 0.9]} position={[0, 0.525, 0]} />
        <WBox mat="darkWood" size={[0.26, 0.06, 0.9]} position={[0.36, 0.8, 0]} />
        <mesh position={[0.37, 0.835, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[0.78, 0.18]} />
          <meshStandardMaterial color="#efe8d6" roughness={0.6} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[0.33, 0.85, -0.34 + i * 0.085]}>
            <boxGeometry args={[0.1, 0.025, 0.035]} />
            <meshStandardMaterial color="#1a1a1e" roughness={0.5} />
          </mesh>
        ))}
        {[-0.3, 0.3].map((z) => (
          <mesh key={z} position={[0.3, 0.1, z]}>
            <boxGeometry args={[0.16, 0.04, 0.1]} />
            <meshStandardMaterial color="#3a2a1e" roughness={0.8} />
          </mesh>
        ))}
      </group>
      {/* 課桌椅：雙人桌＋長板凳（有幾張歪了） */}
      {S.deskXs.flatMap((x, i) =>
        S.deskZs.map((z, j) => {
          const tilt = (i * 3 + j) % 4 === 2 ? 0.12 : 0
          return (
            <group key={`${i}${j}`} position={[x, y0, z]} rotation={[0, tilt, 0]}>
              <mesh material={wood} position={[0, 0.72, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.9, 0.04, 0.42]} />
              </mesh>
              <mesh material={wood} position={[0, 0.55, -0.19]}>
                <boxGeometry args={[0.88, 0.3, 0.02]} />
              </mesh>
              {[-0.4, 0.4].map((dx) => (
                <mesh key={dx} material={steel} position={[dx, 0.36, 0]}>
                  <boxGeometry args={[0.03, 0.72, 0.36]} />
                </mesh>
              ))}
              <mesh material={wood} position={[0, 0.4, 0.42]} castShadow>
                <boxGeometry args={[0.86, 0.04, 0.2]} />
              </mesh>
              {[-0.36, 0.36].map((dx) => (
                <mesh key={`b${dx}`} material={steel} position={[dx, 0.2, 0.42]}>
                  <boxGeometry args={[0.03, 0.4, 0.16]} />
                </mesh>
              ))}
            </group>
          )
        }),
      )}
      {/* 阿嬤小時候的座位：桌面刻了一個「春」 */}
      <mesh position={[S.myDesk.x + 0.2, y0 + 0.745, S.myDesk.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[0.22, 0.22]} />
        <meshBasicMaterial map={carved} transparent depthWrite={false} />
      </mesh>
      {/* 壞掉的吊扇 */}
      <group position={[(x3 + B.x1) / 2, B.wallTop + 0.3, (B.z0 + B.z1) / 2]}>
        <mesh material={steel} position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.7, 6]} />
        </mesh>
        <mesh material={steel}>
          <cylinderGeometry args={[0.1, 0.12, 0.1, 12]} />
        </mesh>
        {[0, 2.1, 4.2].map((a, i) => (
          <mesh key={a} material={wood} position={[Math.sin(a) * 0.45, -0.03 - (i === 1 ? 0.12 : 0), Math.cos(a) * 0.45]} rotation={[i === 1 ? 0.35 : 0, a, 0]}>
            <boxGeometry args={[0.13, 0.015, 0.8]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 鳳凰木：老榕樹的身形＋一團團紅花
// ---------------------------------------------------------------------------

function FlameTree() {
  const p = S.tree
  const scale = 0.82
  const seed = (Math.round(p.x * 131 + p.z * 71) & 0xffff) + 1
  const flowers = useRef<THREE.InstancedMesh>(null)
  const COUNT = 420
  useEffect(() => {
    const m = flowers.current
    if (!m) return
    const r = seeded(seed)
    const blobs: [number, number, number, number, number, number][] = [
      [0, 5.3, 0, 3.4, 1.8, 3.2],
      [2.7, 4.6, 1.3, 2.3, 1.4, 2.1],
      [-2.6, 4.7, -0.9, 2.4, 1.5, 2.2],
      [0.9, 6.0, -1.7, 2.1, 1.2, 1.9],
      [-1.1, 5.5, 2.3, 2.1, 1.3, 1.9],
    ]
    const mat4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const col = new THREE.Color()
    for (let i = 0; i < COUNT; i++) {
      const b = blobs[i % blobs.length]
      // 在葉叢外殼附近（上半部）
      const th = r() * Math.PI * 2
      const ph = r() * Math.PI * 0.55
      const k = 0.9 + r() * 0.15
      const x = b[0] + Math.cos(th) * Math.sin(ph) * b[3] * k
      const y = b[1] + Math.cos(ph) * b[4] * k
      const z = b[2] + Math.sin(th) * Math.sin(ph) * b[5] * k
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3))
      const s = 0.1 + r() * 0.14
      mat4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * 0.7, s))
      m.setMatrixAt(i, mat4)
      col.set(['#d8452c', '#e8612f', '#c73324', '#f07a3a'][i % 4])
      m.setColorAt(i, col)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [seed])
  return (
    <group>
      <Tree position={[p.x, 0, p.z]} scale={scale} />
      <group position={[p.x, 0, p.z]} scale={scale} rotation-y={(seed % 628) / 100}>
        <instancedMesh ref={flowers} args={[undefined, undefined, COUNT]} castShadow>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial roughness={0.8} flatShading />
        </instancedMesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 燈：走廊一支快壞掉的日光燈（晚上一閃一閃）、校門口的路燈
// ---------------------------------------------------------------------------

function SchoolLights() {
  const tube = useRef<THREE.PointLight>(null)
  const tubeMat = useRef<THREE.MeshStandardMaterial>(null)
  const gate = useRef<THREE.PointLight>(null)
  const room = useRef<THREE.PointLight>(null)
  const tubeMesh = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const st = useStore.getState()
    const l = lanternAt(st.time)
    const t = clock.elapsedTime
    // 日光燈掛在保健室門口那段走廊的平頂下：平頂淡掉時燈也收起來
    const f = st.faded
    if (tubeMesh.current) tubeMesh.current.visible = !f.includes('school_nurse') && !f.includes('school_lib')
    // 日光燈：大多時候亮，偶爾閃兩下
    const blink = Math.sin(t * 0.7) > 0.93 ? (Math.sin(t * 60) > 0 ? 1 : 0.1) : 1
    const k = l * blink
    if (tube.current) tube.current.intensity = 3.2 * k
    if (tubeMat.current) tubeMat.current.emissiveIntensity = 0.2 + 2.4 * k
    if (gate.current) gate.current.intensity = 4 * l
    if (room.current) room.current.intensity = 2.6 * l
  })
  const tx = (S.corridor.colXs[1] + S.corridor.colXs[2]) / 2
  return (
    <group userData={{ noMerge: true }}>
      <mesh ref={tubeMesh} position={[tx, CANOPY_Y - 0.06, (B.z1 + S.corridor.z1) / 2]}>
        <boxGeometry args={[1.1, 0.05, 0.08]} />
        <meshStandardMaterial ref={tubeMat} color="#e8f4ff" emissive="#d8ecff" emissiveIntensity={0.2} toneMapped={false} />
      </mesh>
      <pointLight ref={tube} position={[tx, CANOPY_Y - 0.3, (B.z1 + S.corridor.z1) / 2 + 0.2]} color="#dcecff" intensity={0} distance={9} decay={1.8} />
      <pointLight ref={gate} position={[S.gate.x + 2.2, 3.2, S.wall.z0 + 0.6]} color="#ffc98a" intensity={0} distance={10} decay={1.8} />
      {/* 教室裡：月光從窗戶照進來的一點點冷光 */}
      <pointLight ref={room} position={[(CLASSROOM.x0 + CLASSROOM.x1) / 2, 2.6, (CLASSROOM.z0 + CLASSROOM.z1) / 2]} color="#9fb8e8" intensity={0} distance={6} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 淡出：跟三合院的 Fader 一樣（子樹換成自己的材質複本，才能單獨調透明度）
// ---------------------------------------------------------------------------

function Fader({ id, children }: { id: string[]; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const clones = useRef(new Map<THREE.Material, THREE.Material>())
  const seen = useRef(new WeakSet<THREE.Object3D>())
  const opacity = useRef(1)
  const scanFrames = useRef(0)
  useFrame(() => {
    const g = group.current
    if (!g) return
    if (scanFrames.current++ < 240)
      g.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || seen.current.has(m)) return
        seen.current.add(m)
        const swap = (mat: THREE.Material) => {
          let c = clones.current.get(mat)
          if (!c) {
            c = mat.clone()
            clones.current.set(mat, c)
          }
          return c
        }
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material)
      })
    const faded = useStore.getState().faded.split(',')
    const target = id.some((x) => faded.includes(x)) ? 0 : 1
    const prev = opacity.current
    opacity.current += (target - opacity.current) * 0.15
    if (Math.abs(opacity.current - target) < 0.01) opacity.current = target
    if (Math.abs(opacity.current - prev) < 1e-4 && opacity.current === target && g.visible === (target > 0)) return
    const o = opacity.current
    g.visible = o > 0.01
    for (const c of clones.current.values()) {
      const wasT = c.transparent
      c.opacity = o
      c.transparent = o < 0.995
      c.depthWrite = o > 0.5
      if (wasT !== c.transparent) c.needsUpdate = true
    }
    g.traverse((obj) => {
      obj.castShadow = o > 0.5 && (obj as THREE.Mesh).isMesh
    })
  })
  return (
    <group ref={group} userData={{ noMerge: true }}>
      {children}
    </group>
  )
}
