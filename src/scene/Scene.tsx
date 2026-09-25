import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor, Sparkles, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { makeDaylight, sampleDaylight } from './daylight'
import { House } from './House'
import { Tree } from './Tree'
import { Grandma, Guest } from './Characters'
import { Effects } from './Effects'
import { CameraRig } from './CameraRig'
import { concreteTexture, groundTexture } from '../textures'

export function Scene() {
  const quality = useStore((s) => s.quality)
  const setQuality = useStore((s) => s.setQuality)
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 34, near: 0.5, far: 260, position: [15, 11.5, 18] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.0
      }}
    >
      <PerformanceMonitor onDecline={() => setQuality('low')} flipflops={2} />
      <Suspense fallback={null}>
        <Daylight />
        <SkyDome />
        <Ground />
        <House />
        <Tree position={[-14.5, 0, 1.5]} />
        <Tree position={[13, 0, -12]} scale={0.7} />
        <NightSky />
        <Grandma />
        <Guest />
        <CameraRig />
        <Ticker />
        <Effects quality={quality} />
      </Suspense>
    </Canvas>
  )
}

function Ticker() {
  const tick = useStore((s) => s.tick)
  useFrame((_, dt) => tick(Math.min(dt, 0.1)))
  return null
}

function Daylight() {
  const { scene } = useThree()
  const amb = useRef<THREE.AmbientLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const dl = useMemo(makeDaylight, [])

  useEffect(() => {
    scene.background = new THREE.Color('#f2a25a')
    scene.fog = new THREE.Fog('#f7c69a', 30, 95)
    const s = sun.current!
    s.shadow.mapSize.set(2048, 2048)
    s.shadow.camera.left = -24
    s.shadow.camera.right = 24
    s.shadow.camera.top = 24
    s.shadow.camera.bottom = -24
    s.shadow.camera.near = 1
    s.shadow.camera.far = 90
    s.shadow.bias = -0.0006
    s.shadow.normalBias = 0.02
    s.shadow.camera.updateProjectionMatrix()
  }, [scene])

  useFrame(() => {
    const t = useStore.getState().time
    sampleDaylight(t, dl)
    ;(scene.background as THREE.Color).copy(dl.sky)
    ;(scene.fog as THREE.Fog).color.copy(dl.fog)
    if (amb.current) {
      amb.current.color.copy(dl.amb)
      amb.current.intensity = dl.ambI
    }
    if (hemi.current) {
      hemi.current.color.copy(dl.hemiSky)
      hemi.current.groundColor.copy(dl.hemiGround)
      hemi.current.intensity = 0.35
    }
    if (sun.current) {
      sun.current.color.copy(dl.sun)
      sun.current.intensity = dl.sunI
      sun.current.position.copy(dl.sunPos)
    }
  })

  return (
    <>
      <ambientLight ref={amb} intensity={0.5} />
      <hemisphereLight ref={hemi} intensity={0.35} />
      <directionalLight ref={sun} castShadow position={[-28, 7, 14]} intensity={2} />
    </>
  )
}

// 天空：一顆反面的大球，上下漸層 + 太陽那側的夕陽紅暈。
const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = (modelMatrix * vec4(position, 1.0)).xyz - cameraPosition;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 top;
  uniform vec3 horizon;
  uniform vec3 sunDir;
  uniform float glow;
  void main() {
    vec3 d = normalize(vDir);
    float t = pow(clamp(d.y, 0.0, 1.0), 0.5);
    vec3 col = mix(horizon, top, t);
    float s = max(dot(d, sunDir), 0.0);
    col += vec3(1.0, 0.5, 0.22) * pow(s, 10.0) * glow * (1.0 - t) * 0.9;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function SkyDome() {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const dl = useMemo(makeDaylight, [])
  const uniforms = useMemo(
    () => ({
      top: { value: new THREE.Color('#f2a25a') },
      horizon: { value: new THREE.Color('#f7c69a') },
      sunDir: { value: new THREE.Vector3(-1, 0.2, 0.5).normalize() },
      glow: { value: 1 },
    }),
    [],
  )
  useFrame(() => {
    sampleDaylight(useStore.getState().time, dl)
    uniforms.top.value.copy(dl.sky)
    uniforms.horizon.value.copy(dl.fog)
    uniforms.sunDir.value.copy(dl.sunPos).normalize()
    uniforms.glow.value = 1 - dl.moon
  })
  return (
    <mesh scale={[220, 220, 220]}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  )
}

function Ground() {
  const grass = useMemo(() => groundTexture(28), [])
  const slab = useMemo(() => concreteTexture(7, 5), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      {/* 埕（前院水泥地） */}
      <mesh position={[0, 0.05, 1.6]} receiveShadow castShadow>
        <boxGeometry args={[14.2, 0.12, 10.2]} />
        <meshStandardMaterial map={slab} roughness={0.95} />
      </mesh>
      {/* 門前小路 */}
      <mesh position={[0, 0.02, 12]} receiveShadow>
        <boxGeometry args={[3.2, 0.06, 10]} />
        <meshStandardMaterial color="#7d7669" roughness={1} />
      </mesh>
    </group>
  )
}

function NightSky() {
  const isNight = useStore((s) => s.isNight)
  return (
    <group visible={isNight}>
      <Stars radius={130} depth={40} count={2200} factor={4.5} saturation={0} fade speed={0.4} />
      {/* 月亮：不受霧影響、不做色調映射，讓泛光把它點亮 */}
      <mesh position={[-48, 40, -70]}>
        <sphereGeometry args={[3.2, 24, 24]} />
        <meshBasicMaterial color="#fff2c8" toneMapped={false} fog={false} />
      </mesh>
      {/* 螢火蟲 */}
      <Sparkles count={70} scale={[16, 2.5, 12]} position={[0, 1.6, 1.5]} size={3.5} speed={0.25} color="#e8ff8a" opacity={0.9} noise={1.2} />
    </group>
  )
}
