import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { BED, GRANDMA_HOME, useStore } from '../store'
import { GRANDMA_PAL, GRANDMA_ROWS, GUEST_PAL, GUEST_ROWS, GUEST_SCARED_PAL, GUEST_SCARED_ROWS, pixelTexture } from '../pixel'
import { haloTexture, textTexture } from '../textures'

const ease = (k: number) => 1 - Math.pow(1 - k, 3)

// 阿嬤：半透明、發青白光、腳不著地、直接穿牆（她是鬼，不用找路）。
export function Grandma() {
  const tex = useMemo(() => pixelTexture(GRANDMA_ROWS, GRANDMA_PAL, { fadeFrom: 17 }), [])
  const halo = useMemo(() => haloTexture('#8ff4ff'), [])
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const pos = useRef(new THREE.Vector3(...GRANDMA_HOME))
  const target = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, dt) => {
    const s = useStore.getState()
    const t = s.grandmaTarget ?? GRANDMA_HOME
    target.set(t[0], t[1], t[2])
    pos.current.lerp(target, 1 - Math.pow(0.03, dt))
    const time = clock.elapsedTime
    const bob = Math.sin(time * 2.2) * 0.06
    if (group.current) {
      group.current.position.set(pos.current.x, pos.current.y + 0.3 + bob, pos.current.z)
    }
    if (light.current) light.current.intensity = 2.6 + Math.sin(time * 3.1) * 0.5 + s.warm * 3
  })

  return (
    <group ref={group}>
      <sprite scale={[1.1, 1.65, 1]} position={[0, 0.82, 0]}>
        <spriteMaterial map={tex} transparent opacity={0.92} depthWrite={false} />
      </sprite>
      <sprite scale={[2.8, 2.8, 1]} position={[0, 0.8, -0.02]}>
        <spriteMaterial map={halo} transparent opacity={0.32} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <pointLight ref={light} color="#8ff4ff" intensity={2.6} distance={4.5} decay={2} position={[0, 1, 0]} />
    </group>
  )
}

// 客人小美，跟她的床、房間的燈。
export function Guest() {
  const state = useStore((s) => s.guest.state)
  const texAwake = useMemo(() => pixelTexture(GUEST_ROWS, GUEST_PAL), [])
  const texScared = useMemo(() => pixelTexture(GUEST_SCARED_ROWS, GUEST_SCARED_PAL), [])
  const zzz = useMemo(() => textTexture('z z z', '#dff6ff', 52), [])
  const bang = useMemo(() => textTexture('！', '#ff5a5a', 96), [])

  const body = useRef<THREE.Group>(null)
  const lump = useRef<THREE.Mesh>(null)
  const zzzRef = useRef<THREE.Sprite>(null)
  const blanket = useRef<THREE.Mesh>(null)
  const roomLight = useRef<THREE.PointLight>(null)
  const phoneLight = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    const s = useStore.getState()
    const now = performance.now()
    const t = clock.elapsedTime
    const since = (now - s.tuckAt) / 1000

    if (body.current) {
      let y = 0
      if (s.guest.state === 'scared' && since < 0.6) y = Math.sin((since / 0.6) * Math.PI) * 0.55
      body.current.position.y = y
    }
    if (lump.current) {
      const b = 1 + Math.sin(t * 1.4) * 0.03
      lump.current.scale.set(0.7 * b, 0.32 * b, 1.15)
    }
    if (zzzRef.current) {
      zzzRef.current.position.y = 1.35 + Math.sin(t * 1.6) * 0.1
      const k = 1 + Math.min(s.guest.sleepDepth, 3) * 0.18
      zzzRef.current.scale.set(0.9 * k, 0.45 * k, 1)
    }
    if (blanket.current) {
      const tucked = s.guest.sleepDepth > 0
      const k = tucked ? ease(THREE.MathUtils.clamp(since / 0.8, 0, 1)) : 0
      const base = 0.62 + (s.guest.sleepDepth > 1 ? 0.38 : 0)
      const z = tucked && s.guest.sleepDepth === 1 ? 0.62 + 0.38 * k : base
      blanket.current.scale.z = z
      blanket.current.position.z = 0.45 - (z - 0.62) * 0.7
    }
    if (roomLight.current) {
      const awake = s.guest.state !== 'asleep'
      let i = awake ? 6 : 1.2
      i += s.warm * 5
      if (s.flicker > 0 && Math.random() < s.flicker * 0.8) i *= 0.15 + Math.random() * 0.6
      roomLight.current.intensity = i
    }
    if (phoneLight.current) phoneLight.current.intensity = s.guest.state === 'awake' ? 1.4 : 0
  })

  return (
    <group position={[BED.x, 0.15, BED.z]}>
      {/* 床 */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.36, 2.3]} />
        <meshStandardMaterial color="#4a2e1c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.46, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.55, 0.22, 2.15]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.63, -0.8]} castShadow>
        <boxGeometry args={[0.9, 0.16, 0.45]} />
        <meshStandardMaterial color="#fff8ee" roughness={0.9} />
      </mesh>
      {/* 被子：蓋好會往上拉 */}
      <mesh ref={blanket} position={[0, 0.66, 0.45]} scale={[1, 1, 0.62]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.14, 1.9]} />
        <meshStandardMaterial color="#b08bc9" roughness={0.95} />
      </mesh>
      {/* 床頭的床頭櫃與檯燈 */}
      <mesh position={[1.15, 0.3, -0.9]} castShadow>
        <boxGeometry args={[0.5, 0.6, 0.5]} />
        <meshStandardMaterial color="#5a3a24" roughness={0.8} />
      </mesh>

      {/* 醒著 / 嚇到：坐在床頭 */}
      {state !== 'asleep' && (
        <group ref={body}>
          <Billboard position={[0, 1.0, -0.35]}>
            <mesh castShadow>
              <planeGeometry args={[0.95, 1.42]} />
              <meshStandardMaterial map={state === 'scared' ? texScared : texAwake} transparent alphaTest={0.5} roughness={0.9} />
            </mesh>
          </Billboard>
          {state === 'scared' && (
            <sprite position={[0.35, 2.15, -0.3]} scale={[0.7, 0.7, 1]}>
              <spriteMaterial map={bang} transparent depthWrite={false} />
            </sprite>
          )}
        </group>
      )}

      {/* 睡著：被子底下一坨 + zzz */}
      {state === 'asleep' && (
        <>
          <mesh ref={lump} position={[0, 0.62, -0.1]} castShadow>
            <sphereGeometry args={[0.7, 16, 12]} />
            <meshStandardMaterial color="#b08bc9" roughness={0.95} />
          </mesh>
          <sprite ref={zzzRef} position={[0.55, 1.35, -0.5]} scale={[0.9, 0.45, 1]}>
            <spriteMaterial map={zzz} transparent depthWrite={false} />
          </sprite>
        </>
      )}

      {/* 房間的燈籠光、手機的藍光 */}
      <pointLight ref={roomLight} position={[0, 2.3, -0.4]} color="#ffbe6e" intensity={6} distance={7.5} decay={2} />
      <pointLight ref={phoneLight} position={[0.1, 1.0, 0.2]} color="#7fa8ff" intensity={1.4} distance={2.6} decay={2} />
    </group>
  )
}
