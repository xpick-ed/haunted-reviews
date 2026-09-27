import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { cancelLighting, completeLighting, inTop, lampHold } from '../world/sceneLighthouse'
import { input } from '../world/input'
import { player } from '../world/player'
import { lanternAt } from './daylight'
import { LighthouseBase } from './LighthouseBase'
import { LighthouseTop } from './LighthouseTop'

// 燈塔裡面的畫面（DESIGN §32.5）：規則在 src/world/sceneLighthouse.ts。
// 下層（小屋＋螺旋梯）和上層（燈籠室＋陽台＋看得到對岸村子）放在兩塊地方，阿嬤在哪一層就只畫那一層。
// 點燈的長按也在這裡推（hotspot 只負責開始）。

export function LighthouseScene() {
  const quality = useStore((s) => s.quality)
  const outline = quality === 'high'
  const base = useRef<THREE.Group>(null)
  const top = useRef<THREE.Group>(null)
  useFirstVisit()
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const up = inTop(player.x, player.z)
    if (base.current) base.current.visible = !up
    if (top.current) top.current.visible = up
    stepHold(dt)
  })
  return (
    <group>
      <group ref={base}>
        <LighthouseBase outline={outline} />
      </group>
      <group ref={top}>
        <LighthouseTop outline={outline} />
      </group>
      <NightFill />
    </group>
  )
}

/** 點燈：按住動作鍵推進度；放開超過一下、走開、或開了對話就取消 */
function stepHold(dt: number) {
  if (!lampHold.active) return
  const s = useStore.getState()
  if (s.scene !== 'lighthouse' || s.dialogue || s.minigame || s.transitioning) {
    lampHold.active = false
    return
  }
  if (Math.hypot(player.x - lampHold.x, player.z - lampHold.z) > 0.7) {
    lampHold.active = false
    cancelLighting()
    return
  }
  if (input.actionHeld) {
    lampHold.released = 0
    lampHold.t += dt
    if (lampHold.t >= lampHold.need) {
      lampHold.active = false
      completeLighting()
    }
    return
  }
  lampHold.released += dt
  if (lampHold.released > 0.35) {
    lampHold.active = false
    cancelLighting()
  }
}

/** 第一次走進燈塔，阿嬤講一句 */
function useFirstVisit() {
  useEffect(() => {
    lampHold.active = false
    const s = useStore.getState()
    if (s.flags.lh_seen) return
    useStore.setState({ flags: { ...s.flags, lh_seen: true } })
    const t = window.setTimeout(() => {
      const st = useStore.getState()
      st.bark(st.isNight ? 'lh.enter.night' : 'lh.enter')
    }, 1200)
    return () => window.clearTimeout(t)
  }, [])
}

/** 晚上的補光：月光從海上來（冷） */
function NightFill() {
  const hemi = useRef<THREE.HemisphereLight>(null)
  useFrame(() => {
    const l = lanternAt(useStore.getState().time)
    if (hemi.current) hemi.current.intensity = 0.3 * l
  })
  return <hemisphereLight ref={hemi} color="#8aa6d8" groundColor="#1a2230" intensity={0} />
}

