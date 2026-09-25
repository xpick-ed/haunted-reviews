import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, HueSaturation, N8AO, Noise, SMAA, TiltShift2, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ShaderPass } from 'postprocessing'
import * as THREE from 'three'
import { useStore, type Quality } from '../store'

// 後製（DESIGN §15.2）：
// - N8AO：環境光遮蔽，東西接觸的地方有柔和的陰影，模型屋才「站得住」
// - Bloom：燈籠、窗光、路燈的光暈
// - TiltShift：上下模糊，微縮模型感
// - 恐怖瞬間：去飽和、色差、雜訊、暗角，平常全部是 0
// 高畫質用 MSAA 4x 抗鋸齒，低畫質用 SMAA。
// 注意：N8AO 不要開 halfRes，直式畫面下會算出壞值，被 Bloom 擴散成整片白。
// 就算開了全解析度，偶爾還是會有單一像素是 NaN／無限大，被 Bloom 一擴散就整個畫面閃白。
// 所以在 AO 後面、Bloom 前面放一個「清洗」pass，把壞值歸零、太亮的夾住。

function makeSanitizePass() {
  return new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: { inputBuffer: { value: null } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = vec4(position.xy, 1.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D inputBuffer;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(inputBuffer, vUv);
          bool bad = any(isnan(c)) || any(isinf(c));
          gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : min(c, vec4(24.0));
        }`,
      depthTest: false,
      depthWrite: false,
    }),
    'inputBuffer',
  )
}

export function Effects({ quality }: { quality: Quality }) {
  const sanitize = useMemo(makeSanitizePass, [quality])
  const ca = useRef<any>(null)
  const noise = useRef<any>(null)
  const vig = useRef<any>(null)
  const hs = useRef<any>(null)
  const offset = useMemo(() => new THREE.Vector2(0, 0), [])
  const high = quality === 'high'

  useFrame(() => {
    const h = useStore.getState().horror
    const hh = h * h
    if (ca.current) ca.current.offset.set(0.007 * hh, 0.004 * hh)
    if (noise.current) noise.current.blendMode.opacity.value = 0.4 * hh
    if (vig.current) {
      vig.current.uniforms.get('darkness').value = 0.5 + 0.75 * h
      vig.current.uniforms.get('offset').value = 0.28 - 0.12 * h
    }
    if (hs.current) hs.current.uniforms.get('saturation').value = -0.92 * h
  })

  const passes = [
    <N8AO key="ao" aoRadius={1.2} distanceFalloff={0.8} intensity={high ? 2.6 : 2.0} quality={high ? 'medium' : 'performance'} />,
    <primitive key="sanitize" object={sanitize} />,
    <Bloom key="bloom" luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={high ? 1.1 : 0.8} mipmapBlur />,
    <TiltShift2 key="tilt" blur={high ? 0.075 : 0.06} taper={0.7} start={[0.5, 0.0]} end={[0.5, 1.0]} samples={high ? 10 : 6} />,
    <HueSaturation key="hs" ref={hs} saturation={0} />,
    <ChromaticAberration key="ca" ref={ca} offset={offset} radialModulation={false} modulationOffset={0} />,
    <Noise key="noise" ref={noise} opacity={0} blendFunction={BlendFunction.OVERLAY} />,
    <Vignette key="vig" ref={vig} eskil={false} offset={0.28} darkness={0.5} />,
  ]
  if (!high) passes.push(<SMAA key="smaa" />)
  // 開發用：?nofx=ao,bloom,tilt 關掉指定的效果
  const off = new URLSearchParams(location.search).get('nofx')?.split(',') ?? []
  const shown = import.meta.env.DEV && off.length ? passes.filter((p) => !off.includes(String(p.key))) : passes

  return (
    <EffectComposer key={quality} multisampling={high ? 4 : 0}>
      {shown}
    </EffectComposer>
  )
}
