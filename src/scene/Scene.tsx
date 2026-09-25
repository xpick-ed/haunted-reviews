import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { makeDaylight, sampleDaylight } from './daylight'
import { MatsProvider, wind } from './kit'
import { House } from './House'
import { Interior } from './Interior'
import { Yard } from './Yard'
import { Landscape } from './Landscape'
import { MergeStatic } from './MergeStatic'
import { Grandma, Guest } from './Characters'
import { Effects } from './Effects'
import { CameraRig } from './CameraRig'
import { WorldController } from './World'
import { TempleScene } from './Temple'
import { ExitSigns, HotspotMarkers } from './Markers'
import { Npc } from './Npc'
import { HAN_SWEEP } from './layout'
import { player } from '../world/player'

const params = new URLSearchParams(location.search)
const NO_FX = params.get('fx') === '0'
const NO_SHADOW = params.get('shadow') === '0'

export function Scene() {
  const quality = useStore((s) => s.quality)
  const setQuality = useStore((s) => s.setQuality)
  return (
    <Canvas
      shadows={NO_SHADOW ? false : "percentage"}
      dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
      camera={{ fov: 36, near: 0.5, far: 400, position: [19, 14, 22] }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <PerformanceMonitor onDecline={() => setQuality('low')} flipflops={2} />
      <Suspense fallback={null}>
        <MatsProvider anisotropy={quality === 'high' ? 8 : 4}>
          <Daylight quality={quality} />
          <SkyDome />
          <EnvLight />
          <SceneContent quality={quality} />
          <Grandma />
          <HotspotMarkers />
          <ExitSigns />
        </MatsProvider>
        <WorldController />
        <CameraRig />
        <Ticker />
        {import.meta.env.DEV && <DevHooks />}
        {!NO_FX && <Effects quality={quality} />}
      </Suspense>
    </Canvas>
  )
}

/** 依目前場景換掉整組內容（換場景時由黑幕遮住） */
function SceneContent({ quality }: { quality: 'high' | 'low' }) {
  const scene = useStore((s) => s.scene)
  const phase = useStore((s) => s.phase)
  if (scene === 'temple') return <TempleScene />
  return (
    <group>
      <Landscape quality={quality} />
      <MergeStatic>
        <House />
        <Interior />
        <Yard />
      </MergeStatic>
      <Guest />
      {phase === 'dusk' && <Npc id="xiaohan" pose="sweep" position={[HAN_SWEEP.x, 0.1, HAN_SWEEP.z]} facing={-1} />}
    </group>
  )
}

function Ticker() {
  const tick = useStore((s) => s.tick)
  useFrame(({ clock }, dt) => {
    wind.value = clock.elapsedTime
    tick(Math.min(dt, 0.1))
  })
  return null
}

/** 環境光（反射用）：只算一次，亮度跟著天色調 */
function EnvLight() {
  return (
    <Environment frames={1} resolution={64}>
      <Lightformer form="rect" intensity={1.2} color="#b9c8ea" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#ffcf9a" position={[-14, 4, 10]} scale={[12, 6, 1]} />
      <Lightformer form="rect" intensity={0.4} color="#6f86b8" position={[14, 3, -12]} scale={[16, 6, 1]} />
      <Lightformer form="rect" intensity={0.25} color="#3a4a3a" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[30, 30, 1]} />
    </Environment>
  )
}

function Daylight({ quality }: { quality: 'high' | 'low' }) {
  const { scene } = useThree()
  const amb = useRef<THREE.AmbientLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const dl = useMemo(makeDaylight, [])

  useEffect(() => {
    const s = sun.current!
    const size = quality === 'high' ? 4096 : 2048
    s.shadow.mapSize.set(size, size)
    s.shadow.map?.dispose()
    s.shadow.map = null as unknown as THREE.WebGLRenderTarget
    const cam = s.shadow.camera
    cam.left = -19
    cam.right = 19
    cam.top = 19
    cam.bottom = -19
    cam.near = 1
    cam.far = 110
    cam.updateProjectionMatrix()
    s.shadow.bias = -0.0004
    s.shadow.normalBias = 0.025
    s.shadow.radius = 3
  }, [quality])

  useFrame(() => {
    const t = useStore.getState().time
    sampleDaylight(t, dl)
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(dl.fog)
    scene.environmentIntensity = THREE.MathUtils.lerp(0.85, 0.16, dl.moon)
    if (amb.current) {
      amb.current.color.copy(dl.amb)
      amb.current.intensity = dl.ambI * 0.7
    }
    if (hemi.current) {
      hemi.current.color.copy(dl.hemiSky)
      hemi.current.groundColor.copy(dl.hemiGround)
      hemi.current.intensity = THREE.MathUtils.lerp(0.35, 0.12, dl.moon)
    }
    if (sun.current) {
      sun.current.color.copy(dl.sun)
      sun.current.intensity = dl.sunI
      const texel = 38 / (quality === 'high' ? 4096 : 2048)
      const cx = Math.round(player.x / texel) * texel
      const cz = Math.round(player.z / texel) * texel
      sun.current.target.position.set(cx, 0, cz)
      sun.current.target.updateMatrixWorld()
      sun.current.position.copy(dl.sunPos).multiplyScalar(1.6).add(sun.current.target.position)
    }
  })

  return (
    <>
      <fog attach="fog" args={['#f7c69a', 45, 160]} />
      <ambientLight ref={amb} intensity={0.4} />
      <hemisphereLight ref={hemi} intensity={0.3} />
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
    <mesh scale={[300, 300, 300]} renderOrder={-1}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial uniforms={uniforms} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  )
}

/** 開發用：把 renderer 掛到 window，方便量 draw call、截圖時暫停 */
function DevHooks() {
  const { gl, scene, camera, invalidate, setFrameloop } = useThree()
  useEffect(() => {
    ;(window as unknown as { __three: unknown }).__three = { gl, scene, camera, invalidate, setFrameloop }
  }, [gl, scene, camera, invalidate, setFrameloop])
  return null
}
