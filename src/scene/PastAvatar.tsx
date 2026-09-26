import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { player } from '../world/player'
import { SCENES } from '../world/scenes'
import { pastRT, usePast } from '../world/past'
import { Chibi, newDrive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import '../chars/specs.past'
import { Basket, BlackOmelette } from './PastProps'

// 回到 1958 時，玩家是十八歲的阿春：不是鬼，不發光、不飄，好好地用腳走路。
// 手上可能端著一籃衫（溪邊）或一盤黑黑的菜脯蛋（灶腳）。

export function PastAvatar() {
  const outline = useStore((s) => s.quality === 'high')
  const group = useRef<THREE.Group>(null)
  const floorY = useRef(0)
  const drive = useRef(newDrive({ pose: 'idle', expr: 'normal', heading: Math.PI }))
  const basket = useRef<THREE.Group>(null)
  const dish = useRef<THREE.Group>(null)
  const hold = useRef<THREE.Group>(null)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const f = SCENES[s.scene].floorAt(player.x, player.z)
    floorY.current += (f - floorY.current) * (1 - Math.exp(-10 * dt))
    group.current?.position.set(player.x, floorY.current, player.z)
    const st = usePast.getState()
    const d = drive.current
    d.speed = player.speed
    if (player.wantX || player.wantZ) d.heading = Math.atan2(player.wantX, player.wantZ)
    d.pose = st.carrying ? 'reach' : 'idle'
    // 踩空的那一下嚇一跳
    const slipped = pastRT.slipAt && performance.now() - pastRT.slipAt < 1600
    d.expr = slipped ? 'surprised' : st.ending ? 'happy' : 'normal'
    d.hop = slipped ? Math.max(0, 0.25 - (performance.now() - pastRT.slipAt) / 3000) : 0
    if (basket.current) basket.current.visible = st.carrying === 'basket'
    if (dish.current) dish.current.visible = st.carrying === 'dish'
    if (hold.current) hold.current.rotation.y = d.heading
  }, -2)

  return (
    <group ref={group}>
      <Chibi spec={SPECS.youngchun} drive={drive} outline={outline} />
      <group ref={hold}>
        <group ref={basket} position={[0, 0.72, 0.42]} visible={false}>
          <Basket />
        </group>
        <group ref={dish} position={[0, 0.82, 0.42]} visible={false}>
          <BlackOmelette />
        </group>
      </group>
    </group>
  )
}
