import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { night } from '../world/night/director'
import { encounterState, WHISPER_RANGE } from '../world/night/encounters'
import { HOME } from '../world/scenes'
import { player } from '../world/player'
import { canvasTexture } from './kit'

// 客人之間的故事的畫面：正在講話的人頭上冒對話泡泡；兩個人中間地上一圈淡淡的金色圈，
// 是阿嬤能耳語的範圍（走進去圈會變亮）。資料每幀從 encounterState 讀。

const bubbleTex = canvasTexture(128, 112, (ctx, w) => {
  ctx.fillStyle = '#fffaf0'
  ctx.strokeStyle = '#3b2a2a'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.ellipse(w / 2, 48, 54, 40, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // 尾巴
  ctx.beginPath()
  ctx.moveTo(44, 82)
  ctx.lineTo(36, 106)
  ctx.lineTo(62, 86)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#3b2a2a'
  for (const x of [42, 64, 86]) {
    ctx.beginPath()
    ctx.arc(x, 48, 7, 0, Math.PI * 2)
    ctx.fill()
  }
})

/** 對話泡泡的高度（客人頭頂上方） */
const BUBBLE_Y = 1.95

export function EncounterLayer() {
  const phase = useStore((s) => s.phase)
  const bubble = useRef<THREE.Sprite>(null)
  const ring = useRef<THREE.Mesh>(null)
  const ringGeo = useMemo(() => new THREE.RingGeometry(WHISPER_RANGE - 0.08, WHISPER_RANGE, 72).rotateX(-Math.PI / 2), [])
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd58a', transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false }), [])
  const k = useRef(0)

  useFrame(({ clock }, dt) => {
    const v = encounterState.view
    const sim = night.sim
    const t = clock.elapsedTime
    const active = !!v && !!sim && v.phase !== 'done' && useStore.getState().scene === 'home'
    // 淡入淡出
    k.current += ((active ? 1 : 0) - k.current) * Math.min(1, dt * 4)
    if (ring.current) {
      ring.current.visible = k.current > 0.02
      if (v && ring.current.visible) {
        ring.current.position.set(v.mid[0], HOME.floorAt(v.mid[0], v.mid[1]) + 0.04, v.mid[1])
        const near = Math.hypot(player.x - v.mid[0], player.z - v.mid[1]) <= WHISPER_RANGE
        const choosing = v.phase === 'choice'
        ringMat.opacity = k.current * (choosing ? 0.5 + Math.sin(t * 5) * 0.15 : near ? 0.32 : 0.14)
      }
    }
    if (bubble.current) {
      const who = v && active && (v.phase === 'talk' || v.phase === 'choice') ? (v.phase === 'choice' ? null : v.speaker) : null
      const g = who ? sim!.guests.find((x) => x.id === who) : undefined
      bubble.current.visible = !!g
      if (g) {
        const pop = 1 + Math.sin(t * 6) * 0.05
        bubble.current.position.set(g.x + 0.25, HOME.floorAt(g.x, g.z) + BUBBLE_Y + Math.sin(t * 2.5) * 0.04, g.z)
        bubble.current.scale.set(0.42 * pop, 0.37 * pop, 1)
      }
    }
  })

  if (phase !== 'night') return null
  return (
    <group userData={{ noMerge: true }}>
      <mesh ref={ring} geometry={ringGeo} material={ringMat} visible={false} renderOrder={1} />
      <sprite ref={bubble} visible={false} renderOrder={4}>
        <spriteMaterial map={bubbleTex} transparent depthWrite={false} depthTest={false} />
      </sprite>
    </group>
  )
}
