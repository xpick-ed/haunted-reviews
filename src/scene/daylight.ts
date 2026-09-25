import * as THREE from 'three'

// 時間 18 → 30（18:00 到隔天 06:00）對應的天色、光色與燈籠亮度。

interface Key {
  t: number
  sky: string
  fog: string
  sun: string
  sunI: number
  amb: string
  ambI: number
  hemiSky: string
  hemiGround: string
  moon: number
  lantern: number
}

const KEYS: Key[] = [
  { t: 18.0, sky: '#f2a25a', fog: '#f7c69a', sun: '#ffc48a', sunI: 2.4, amb: '#7a6a70', ambI: 0.7, hemiSky: '#f4b183', hemiGround: '#3b3a2f', moon: 0, lantern: 0.25 },
  { t: 19.3, sky: '#6a4f8f', fog: '#8c6fa8', sun: '#ff9a70', sunI: 0.9, amb: '#4a4468', ambI: 0.45, hemiSky: '#6a4f8f', hemiGround: '#22202a', moon: 0.15, lantern: 1 },
  { t: 20.6, sky: '#151d3d', fog: '#1e2a4f', sun: '#c9d8ff', sunI: 1.3, amb: '#2a3352', ambI: 0.46, hemiSky: '#2c3a66', hemiGround: '#141618', moon: 1, lantern: 1 },
  { t: 24.0, sky: '#070b1c', fog: '#0c1329', sun: '#bcd0ff', sunI: 1.5, amb: '#1c2440', ambI: 0.42, hemiSky: '#1d2a4d', hemiGround: '#0c0d10', moon: 1, lantern: 1 },
  { t: 28.6, sky: '#0b1226', fog: '#131b33', sun: '#bcd0ff', sunI: 1.3, amb: '#1e2642', ambI: 0.42, hemiSky: '#22305a', hemiGround: '#0e0f12', moon: 1, lantern: 1 },
  { t: 30.0, sky: '#9fc3e6', fog: '#cfe0f0', sun: '#fff0d0', sunI: 2.2, amb: '#7f8ea0', ambI: 0.6, hemiSky: '#bcd7ee', hemiGround: '#3a4a3a', moon: 0, lantern: 0.25 },
]

const C = KEYS.map((k) => ({
  ...k,
  sky: new THREE.Color(k.sky),
  fog: new THREE.Color(k.fog),
  sun: new THREE.Color(k.sun),
  amb: new THREE.Color(k.amb),
  hemiSky: new THREE.Color(k.hemiSky),
  hemiGround: new THREE.Color(k.hemiGround),
}))

const SUN_POS = new THREE.Vector3(-28, 7, 14)
const MOON_POS = new THREE.Vector3(-16, 30, -12)

export interface Daylight {
  sky: THREE.Color
  fog: THREE.Color
  sun: THREE.Color
  sunI: number
  amb: THREE.Color
  ambI: number
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  moon: number
  lantern: number
  sunPos: THREE.Vector3
}

export function makeDaylight(): Daylight {
  return {
    sky: new THREE.Color(),
    fog: new THREE.Color(),
    sun: new THREE.Color(),
    sunI: 1,
    amb: new THREE.Color(),
    ambI: 0.5,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    moon: 0,
    lantern: 1,
    sunPos: new THREE.Vector3(),
  }
}

export function sampleDaylight(t: number, out: Daylight): Daylight {
  const tt = THREE.MathUtils.clamp(t, KEYS[0].t, KEYS[KEYS.length - 1].t)
  let i = 0
  while (i < C.length - 2 && tt > C[i + 1].t) i++
  const a = C[i]
  const b = C[i + 1]
  const k = THREE.MathUtils.clamp((tt - a.t) / (b.t - a.t), 0, 1)
  out.sky.copy(a.sky).lerp(b.sky, k)
  out.fog.copy(a.fog).lerp(b.fog, k)
  out.sun.copy(a.sun).lerp(b.sun, k)
  out.amb.copy(a.amb).lerp(b.amb, k)
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, k)
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, k)
  out.sunI = THREE.MathUtils.lerp(a.sunI, b.sunI, k)
  out.ambI = THREE.MathUtils.lerp(a.ambI, b.ambI, k)
  out.moon = THREE.MathUtils.lerp(a.moon, b.moon, k)
  out.lantern = THREE.MathUtils.lerp(a.lantern, b.lantern, k)
  out.sunPos.copy(SUN_POS).lerp(MOON_POS, out.moon)
  return out
}

export function lanternAt(t: number) {
  const tmp = makeDaylight()
  return sampleDaylight(t, tmp).lantern
}
