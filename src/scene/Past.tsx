import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../store'
import { player, placePlayer } from '../world/player'
import { EPISODES, pastRT, preparePast, stepPast, usePast, type EpisodeId } from '../world/past'
import { House } from './House'
import { Interior } from './Interior'
import { Yard } from './Yard'
import { Landscape } from './Landscape'
import { MergeStatic } from './MergeStatic'
import { RiverScene } from './River'
import { PastProps } from './PastProps'

// 回到 1958（DESIGN §27.1）：年輕阿春的短關卡。三合院的關卡借用家裡的場景，溪邊的關卡借用溪邊；
// 老照片的顏色、標題卡、目標在 src/ui/PastHud.tsx。規則與進度在 src/world/past.ts。

// 開發時掛到 window，自動化測試可以看關卡進度
if (import.meta.env.DEV) (window as unknown as { __past: unknown }).__past = { usePast, pastRT }

/** 穿著借來的鞋：這一幀實際走的距離只算六成 */
const SLOW = 0.6

export function PastScene() {
  const quality = useStore((s) => s.quality)
  const episode = useStore((s) => s.past?.episode) as EpisodeId | undefined
  const prev = useRef<{ x: number; z: number } | null>(null)

  // 直接從相簿進來的通常已經設好；如果還沒（例如重新載入），在這裡設定並站到出生點
  useEffect(() => {
    if (!episode || !EPISODES[episode]) return
    if (usePast.getState().episode !== episode) {
      preparePast(episode)
      const [x, z] = EPISODES[episode].spawn
      placePlayer(x, z)
    }
    prev.current = { x: player.x, z: player.z }
    // 開場：老阿嬤的旁白（標題卡淡掉之後）
    const t = window.setTimeout(() => {
      const s = useStore.getState()
      if (s.scene === 'past' && !s.dialogue && !usePast.getState().ending) s.bark(EPISODES[episode].intro)
    }, 3200)
    return () => window.clearTimeout(t)
  }, [episode])

  // 在 World（-3）移動完、阿春（-2）畫出來之前：借來的鞋走得慢；推進關卡
  useFrame((_, rawDt) => {
    const s = useStore.getState()
    if (s.scene !== 'past' || !episode) return
    const dt = Math.min(rawDt, 0.1)
    const p = prev.current
    if (p && usePast.getState().slow && !s.dialogue && !s.minigame) {
      const dx = player.x - p.x
      const dz = player.z - p.z
      // 瞬間移動（進場景、傳送）不算
      if (Math.hypot(dx, dz) < 1) {
        player.x = p.x + dx * SLOW
        player.z = p.z + dz * SLOW
        player.speed *= SLOW
      }
    }
    prev.current = { x: player.x, z: player.z }
    if (s.dialogue || s.minigame || s.transitioning) return
    for (const id of stepPast(dt, player.x, player.z, performance.now())) s.bark(id)
  }, -2.5)

  if (!episode || !EPISODES[episode]) return null
  const place = EPISODES[episode].place
  return (
    <group>
      {place === 'home' ? (
        <>
          <Landscape quality={quality} />
          <MergeStatic>
            <House />
            <Interior />
            <Yard />
          </MergeStatic>
        </>
      ) : (
        <RiverScene />
      )}
      <PastProps ep={episode} />
    </group>
  )
}
