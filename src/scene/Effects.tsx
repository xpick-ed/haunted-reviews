import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, HueSaturation, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { useStore, type Quality } from '../store'

// 後製：平常是泛光 + 景深的模型屋感；客人被嚇到的瞬間切成恐怖片（DESIGN §15.2）。
// 景深只在橫式、非觸控裝置開：手機上太吃效能，而且直式視角下會把整個畫面糊掉。
export function Effects({ quality }: { quality: Quality }) {
  const { size } = useThree()
  const ca = useRef<any>(null)
  const noise = useRef<any>(null)
  const vig = useRef<any>(null)
  const hs = useRef<any>(null)
  const offset = useMemo(() => new THREE.Vector2(0, 0), [])
  const touch = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches, [])
  const dof = quality === 'high' && !touch && size.width >= size.height

  useFrame(() => {
    const h = useStore.getState().horror
    const hh = h * h
    if (ca.current) ca.current.offset.set(0.007 * hh, 0.004 * hh)
    if (noise.current) noise.current.blendMode.opacity.value = 0.4 * hh
    if (vig.current) {
      vig.current.uniforms.get('darkness').value = 0.55 + 0.7 * h
      vig.current.uniforms.get('offset').value = 0.25 - 0.1 * h
    }
    if (hs.current) hs.current.uniforms.get('saturation').value = -0.92 * h
  })

  const passes = [
    <Bloom key="bloom" luminanceThreshold={0.6} luminanceSmoothing={0.25} intensity={quality === 'high' ? 1.05 : 0.7} mipmapBlur />,
    dof ? <DepthOfField key="dof" target={[4, 1.2, 2]} focalLength={0.03} bokehScale={2.2} height={480} /> : null,
    <HueSaturation key="hs" ref={hs} saturation={0} />,
    <ChromaticAberration key="ca" ref={ca} offset={offset} radialModulation={false} modulationOffset={0} />,
    <Noise key="noise" ref={noise} opacity={0} blendFunction={BlendFunction.OVERLAY} />,
    <Vignette key="vig" ref={vig} eskil={false} offset={0.25} darkness={0.55} />,
  ].filter((p) => p !== null)

  return (
    <EffectComposer key={dof ? 'dof' : 'nodof'} multisampling={0}>
      {passes}
    </EffectComposer>
  )
}
