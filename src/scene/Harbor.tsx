import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { HARBOR, applyTide } from '../world/sceneHarbor'
import { tideBand, tideLevel, tideState } from '../world/tide'
import { lanternAt } from './daylight'
import { MergeStatic } from './MergeStatic'
import { Ground } from './VillageKit'
import { ChibiNpc } from '../chars/Chibi'
import { Flats, Horizon, Sea } from './HarborSea'
import { Boats, Breakwater, FishMarket, Fishers, Lighthouse, Quay, QuayLamps, QuayProps, Tetrapods } from './HarborProps'
import '../chars/specs.harbor'

// 海邊漁港＋燈塔（DESIGN §27.1）：老街盡頭的小漁港。碼頭、停著的漁船、魚市棚子、往北伸的堤防與消波塊、
// 盡頭的燈塔（守燈人鬼在門口）；碼頭東邊是潮間帶，半夜退潮以後可以下去抓螃蟹。
// 鏡頭在南邊（+z），海在北邊。規則、碰撞、熱點在 src/world/sceneHarbor.ts；潮汐在 src/world/tide.ts。

const H = HARBOR

export function HarborScene() {
  const quality = useStore((s) => s.quality)
  const outline = quality === 'high'
  useTideDriver()
  useFirstVisit()
  return (
    <group>
      {/* 陸地：碼頭水泥面、柏油路、後面的草地 */}
      <Ground mat="yard" w={90} d={5.6} position={[0, 0.02, H.quayZ + 2.8]} tint="#b4b0a6" />
      <Ground mat="tile" w={90} d={3.2} position={[0, 0.021, H.quayZ + 7.2]} tint="#3a3a3c" />
      <Ground mat="grass" w={90} d={14} position={[0, 0.019, H.quayZ + 15.8]} tint="#7a8a60" />
      <Sea />
      <Flats />
      <MergeStatic>
        <Quay />
        <Breakwater />
        <QuayProps />
      </MergeStatic>
      <Tetrapods />
      <Lighthouse />
      <Boats />
      <Fader id="harbor_shed">
        <FishMarket />
      </Fader>
      <QuayLamps />
      <Horizon />
      <ChibiNpc id="keeper" pose="idle" position={[H.keeper.x, H.breakwater.y, H.keeper.z]} heading={0.2} seesGhosts outline={outline} />
      <Fishers outline={outline} />
      <NightFill />
    </group>
  )
}

/**
 * 潮汐：每幀算潮位（地面高度、海面用 tideState），潮位分段變了才換碰撞
 * （World.tsx 不快取海邊的碰撞，直接讀 HARBOR_SCENE.colliders）。
 */
function useTideDriver() {
  const band = useRef<string>('')
  const drive = () => {
    const s = useStore.getState()
    const level = tideLevel(s.time, s.phase)
    tideState.level = level
    const b = tideBand(level)
    tideState.band = b
    if (b !== band.current) {
      band.current = b
      applyTide(b)
    }
  }
  // 一進場景就先算一次（第一幀的碰撞才對）
  useEffect(drive, [])
  useFrame(drive)
}

/** 第一次來海邊，阿嬤講一句 */
function useFirstVisit() {
  useEffect(() => {
    const s = useStore.getState()
    if (s.flags.harbor_seen) return
    useStore.setState({ flags: { ...s.flags, harbor_seen: true } })
    const t = window.setTimeout(() => {
      const st = useStore.getState()
      st.bark(st.isNight ? 'harbor.enter.night' : 'harbor.enter')
    }, 1200)
    return () => window.clearTimeout(t)
  }, [])
}

// ---------------------------------------------------------------------------
// 晚上的補光：月光從海上來（冷），港邊的鈉燈另外有點光源
// ---------------------------------------------------------------------------

function NightFill() {
  const hemi = useRef<THREE.HemisphereLight>(null)
  useFrame(() => {
    const l = lanternAt(useStore.getState().time)
    if (hemi.current) hemi.current.intensity = 0.32 * l
  })
  return <hemisphereLight ref={hemi} color="#8aa6d8" groundColor="#1a2230" intensity={0} />
}

// ---------------------------------------------------------------------------
// 淡出：魚市棚子擋在鏡頭和阿嬤中間（或阿嬤走進去）時變半透明（HARBOR_SCENE.buildings）。
// 跟三合院、鬼夜市一樣：子樹的網格換成自己的材質複本，才能單獨調透明度。
// ---------------------------------------------------------------------------

function Fader({ id, children }: { id: string; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const clones = useRef(new Map<THREE.Material, THREE.Material>())
  const seen = useRef(new WeakSet<THREE.Object3D>())
  const opacity = useRef(1)
  const frames = useRef(0)
  useFrame(() => {
    const g = group.current
    if (!g) return
    if (frames.current++ < 120)
      g.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || seen.current.has(m)) return
        seen.current.add(m)
        const swap = (mat: THREE.Material) => {
          let c = clones.current.get(mat)
          if (!c) {
            c = mat.clone()
            c.userData.baseOpacity = mat.opacity
            c.userData.baseTransparent = mat.transparent
            clones.current.set(mat, c)
          }
          return c
        }
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material)
      })
    const target = useStore.getState().faded.split(',').includes(id) ? 0.18 : 1
    const prev = opacity.current
    opacity.current += (target - opacity.current) * 0.15
    if (Math.abs(opacity.current - target) < 0.01) opacity.current = target
    if (Math.abs(opacity.current - prev) < 1e-4) return
    const o = opacity.current
    for (const c of clones.current.values()) {
      const wasT = c.transparent
      c.opacity = c.userData.baseOpacity * o
      c.transparent = c.userData.baseTransparent || o < 0.995
      c.depthWrite = !c.userData.baseTransparent && o > 0.5
      if (wasT !== c.transparent) c.needsUpdate = true
    }
  })
  return (
    <group ref={group} userData={{ noMerge: true }}>
      {children}
    </group>
  )
}
