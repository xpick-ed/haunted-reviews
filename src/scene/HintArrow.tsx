import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { useSettings } from '../settings'
import { arrowPoint, hintNow } from '../world/hints'
import { player } from '../world/player'
import { SCENES } from '../world/scenes'
import { hintSpot } from '../ui/HintHud'

// 場景裡指向下一步的箭頭（DESIGN §33）：阿嬤腳邊一個貼地的小箭頭，指向提示的目標；
// 目標在別的場景就指向往那邊的出口。走到 2 公尺內就淡掉。一個箭頭＋目標上一個小圈，很省。

/** 箭頭離阿嬤多遠（公尺） */
const RADIUS = 1.05
/** 走到這麼近就淡掉 */
const NEAR = 2

export function HintArrow() {
  const arrow = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => {
    // 貼地的「>」：畫在 xy 平面，尖端朝 +x；轉成躺平以後朝 +x 世界方向
    const s = new THREE.Shape()
    s.moveTo(0.4, 0)
    s.lineTo(-0.12, 0.32)
    s.lineTo(-0.02, 0.12)
    s.lineTo(-0.28, 0.12)
    s.lineTo(-0.28, -0.12)
    s.lineTo(-0.02, -0.12)
    s.lineTo(-0.12, -0.32)
    s.closePath()
    const g = new THREE.ShapeGeometry(s)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.42, 0.52, 40).rotateX(-Math.PI / 2), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd58a', transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }), [])
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd58a', transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }), [])
  const alpha = useRef(0)
  const cache = useRef<{ key: string; p: { x: number; z: number } | null; t: number }>({ key: '', p: null, t: 0 })

  useFrame(({ clock }, dt) => {
    const a = arrow.current
    const r = ring.current
    if (!a || !r) return
    const s = useStore.getState()
    const h = hintNow.current
    const busy = !!s.dialogue || !!s.minigame || !!s.panel || !!s.summary || !!s.month || s.intro || s.transitioning || !!s.ending || s.hidden || !!s.possess
    // 箭頭的目標點：換提示、換場景、或每半秒重算一次（出口的開放時間會變）
    const now = clock.elapsedTime
    const key = `${h?.id}|${h?.target?.scene}|${h?.target?.x}|${h?.target?.z}|${s.scene}`
    if (key !== cache.current.key || now - cache.current.t > 0.25) cache.current = { key, p: arrowPoint(h, s, hintSpot, player), t: now }
    const p = cache.current.p
    // 圈圈畫在真正的目標上；箭頭指的可能是房門、出口
    const same = !!h?.target && h.target.scene === s.scene
    const d = p ? Math.hypot(p.x - player.x, p.z - player.z) : 0
    const final = same && p && Math.abs(p.x - h!.target!.x) < 0.01 && Math.abs(p.z - h!.target!.z) < 0.01
    // 走到最後的目標旁邊才淡掉；中途的房門、出口不用（不然走到門口箭頭就不見了）
    const want = p && !busy && useSettings.getState().hints && (!final || d > NEAR) ? (final ? Math.min(1, (d - NEAR) / 1.5) : 1) : 0
    alpha.current += (want - alpha.current) * (1 - Math.exp(-dt * 6))
    const o = alpha.current
    a.visible = o > 0.01
    r.visible = a.visible && same
    if (!a.visible || !p) return
    const tgt = same ? h!.target! : p
    const floor = SCENES[s.scene].floorAt(player.x, player.z)
    const ang = Math.atan2(p.z - player.z, p.x - player.x)
    // 輕輕往前推、呼吸
    const bob = 0.08 * Math.sin(now * 3.2)
    a.position.set(player.x + Math.cos(ang) * (RADIUS + bob), floor + 0.05, player.z + Math.sin(ang) * (RADIUS + bob))
    a.rotation.set(0, -ang, 0)
    mat.opacity = 0.9 * o
    if (r.visible) {
      r.position.set(tgt.x, SCENES[s.scene].floorAt(tgt.x, tgt.z) + 0.04, tgt.z)
      const k = 1 + 0.12 * Math.sin(now * 2.4)
      r.scale.set(k, 1, k)
      ringMat.opacity = 0.5 * o
    }
  })

  return (
    <group>
      <mesh ref={arrow} geometry={geo} material={mat} renderOrder={20} visible={false} />
      <mesh ref={ring} geometry={ringGeo} material={ringMat} renderOrder={20} visible={false} />
    </group>
  )
}
