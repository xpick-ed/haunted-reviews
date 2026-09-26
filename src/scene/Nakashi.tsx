import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio'
import { adultOn } from '../settings'
import { NIGHTLIFE } from '../world/nightlife'
import { player } from '../world/player'
import { Chibi, newDrive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { boxGeo, canvasTexture } from './kit'
import '../chars/specs.nightlife'

// 老街的鬼那卡西（DESIGN §29，成人內容）：冰果室亭仔腳前面，主唱彈電子琴、旁邊一個吉他手。
// 只有晚上、打開成人內容才出來；阿嬤走近才聽得到他們在唱（自己合成的演歌風小曲，音樂音量、很小聲）。
// 點歌的熱點在 src/world/nightlife.ts。

const B = NIGHTLIFE.band
const FLOOR = 0.02
const HOVER = 0.1

// ---------------------------------------------------------------------------
// 音樂：A 小調四七拔き（ヨナ抜き）音階的慢板，貝斯「蹦—」在一、三拍，吉他「恰」在二、四拍，電子琴唱主旋律
// ---------------------------------------------------------------------------

const BPM = 74
const EIGHTH = 60 / BPM / 2
/** 主旋律：[距離 A3 幾個半音（null 是休息）, 幾個八分音符] */
const MELODY: [number | null, number][] = [
  [19, 3],
  [15, 1],
  [14, 2],
  [12, 2],
  [8, 3],
  [7, 1],
  [7, 4],
  [12, 2],
  [15, 2],
  [14, 1],
  [12, 1],
  [8, 2],
  [7, 6],
  [null, 2],
  [3, 2],
  [7, 2],
  [8, 2],
  [12, 2],
  [14, 3],
  [15, 1],
  [14, 2],
  [12, 2],
  [8, 2],
  [7, 2],
  [3, 2],
  [2, 2],
  [0, 6],
  [null, 2],
]
type Chord = 'Am' | 'Dm' | 'F' | 'E'
/** 每半小節一個和弦（8 小節 16 格） */
const CHORDS: Chord[] = ['Am', 'Am', 'Dm', 'Dm', 'Am', 'F', 'E', 'E', 'Am', 'Am', 'E', 'E', 'Dm', 'E', 'Am', 'Am']
/** 和弦音（距離 A3）、貝斯根音（距離 A2） */
const TRIAD: Record<Chord, number[]> = {
  Am: [0, 3, 7],
  Dm: [5, 8, 12],
  F: [8, 12, 15],
  E: [7, 11, 14],
}
const ROOT: Record<Chord, number> = { Am: 0, Dm: 5, F: 8, E: -5 }
const LOOP = 64

/** 旋律排成「第幾個八分音符開始 → 音」 */
const NOTES: { at: number; semi: number; len: number }[] = (() => {
  const out: { at: number; semi: number; len: number }[] = []
  let at = 0
  for (const [semi, len] of MELODY) {
    if (semi !== null) out.push({ at, semi, len })
    at += len
  }
  return out
})()

const hz = (base: number, semi: number) => base * Math.pow(2, semi / 12)

class Band {
  private out: GainNode | null = null
  private bus: GainNode | null = null
  private timer: number | null = null
  private next = 0
  private step = 0
  private zeroSince = -1
  private noise: AudioBuffer | null = null
  playing = false

  /** 每幀呼叫：level 是想要的音量（0 = 聽不到） */
  update(level: number) {
    const ctx = audio.ctx
    if (!ctx || ctx.state !== 'running') return
    if (level > 0.001 && !this.playing) this.start(ctx)
    if (!this.playing || !this.out) return
    this.out.gain.setTargetAtTime(level, ctx.currentTime, 0.45)
    if (level <= 0.001) {
      if (this.zeroSince < 0) this.zeroSince = ctx.currentTime
      else if (ctx.currentTime - this.zeroSince > 3) this.stop()
    } else this.zeroSince = -1
  }

  private start(ctx: AudioContext) {
    this.playing = true
    this.zeroSince = -1
    this.out = ctx.createGain()
    this.out.gain.value = 0
    // 老收音機的聲音：高頻切掉一點，再加一點點回音
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3200
    this.bus = ctx.createGain()
    const delay = ctx.createDelay(1)
    delay.delayTime.value = EIGHTH * 1.5
    const fb = ctx.createGain()
    fb.gain.value = 0.22
    const wet = ctx.createGain()
    wet.gain.value = 0.2
    this.bus.connect(lp)
    lp.connect(this.out)
    lp.connect(delay)
    delay.connect(fb).connect(delay)
    delay.connect(wet).connect(this.out)
    this.out.connect(audio.bus.music)
    this.next = ctx.currentTime + 0.1
    this.step = 0
    this.timer = window.setInterval(() => this.pump(), 50)
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.playing = false
    const out = this.out
    const ctx = audio.ctx
    this.out = null
    this.bus = null
    if (out && ctx) {
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.15)
      window.setTimeout(() => out.disconnect(), 1500)
    }
  }

  private pump() {
    const ctx = audio.ctx
    if (!ctx || !this.bus) return
    // 分頁在背景太久：不要一次補一大堆音
    if (this.next < ctx.currentTime - 0.5) this.next = ctx.currentTime + 0.05
    while (this.next < ctx.currentTime + 0.3) {
      this.play(ctx, this.step % LOOP, this.next)
      this.next += EIGHTH
      this.step++
    }
  }

  private play(ctx: AudioContext, i: number, t: number) {
    const chord = CHORDS[Math.floor(i / 4)]
    const beat = i % 8
    // 貝斯：一拍根音、三拍五度
    if (beat === 0) this.bass(ctx, t, hz(110, ROOT[chord]))
    if (beat === 4) this.bass(ctx, t, hz(110, ROOT[chord] + 7))
    // 吉他：二、四拍刷和弦
    if (beat === 2 || beat === 6) this.strum(ctx, t, TRIAD[chord])
    // 反拍輕輕的沙鈴
    if (beat % 2 === 1) this.shaker(ctx, t)
    for (const n of NOTES) if (n.at === i) this.organ(ctx, t, hz(220, n.semi), n.len * EIGHTH)
  }

  private env(ctx: AudioContext, t: number, peak: number, attack: number, hold: number, release: number) {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.setValueAtTime(peak, t + attack + hold)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release)
    g.connect(this.bus!)
    return g
  }

  private organ(ctx: AudioContext, t: number, f: number, len: number) {
    const g = this.env(ctx, t, 0.16, 0.03, Math.max(0.05, len - 0.12), 0.14)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1700
    lp.connect(g)
    // 演歌的顫音：音拉長一點才開始抖
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 5.6
    const depth = ctx.createGain()
    depth.gain.setValueAtTime(0, t)
    depth.gain.linearRampToValueAtTime(len > EIGHTH * 1.5 ? 14 : 4, t + Math.min(0.4, len))
    lfo.connect(depth)
    const end = t + len + 0.2
    for (const [type, det, vol] of [
      ['square', -4, 0.5],
      ['sawtooth', 5, 0.35],
      ['sine', 1200, 0.25],
    ] as [OscillatorType, number, number][]) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = f
      o.detune.value = det
      depth.connect(o.detune)
      const v = ctx.createGain()
      v.gain.value = vol
      o.connect(v).connect(lp)
      o.start(t)
      o.stop(end)
    }
    lfo.start(t)
    lfo.stop(end)
  }

  private strum(ctx: AudioContext, t: number, triad: number[]) {
    triad.forEach((semi, k) => {
      const at = t + k * 0.012
      const g = this.env(ctx, at, 0.07, 0.004, 0.02, 0.22)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 2200
      lp.connect(g)
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = hz(220, semi)
      o.connect(lp)
      o.start(at)
      o.stop(at + 0.3)
    })
  }

  private bass(ctx: AudioContext, t: number, f: number) {
    const g = this.env(ctx, t, 0.22, 0.01, 0.12, 0.35)
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    o.connect(g)
    o.start(t)
    o.stop(t + 0.55)
  }

  private shaker(ctx: AudioContext, t: number) {
    if (!this.noise || this.noise.sampleRate !== ctx.sampleRate) {
      this.noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.1), ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 6000
    const g = this.env(ctx, t, 0.025, 0.004, 0.01, 0.05)
    src.connect(hp).connect(g)
    src.start(t)
    src.stop(t + 0.1)
  }
}

const band = new Band()
/** 最大音量（音樂 bus 上）：背景小小聲 */
const MAX_LEVEL = 0.2

// ---------------------------------------------------------------------------
// 畫面
// ---------------------------------------------------------------------------

let MATS: Record<'dark' | 'keys' | 'black' | 'chrome' | 'grille' | 'wood' | 'woodDark' | 'note', THREE.Material> | null = null
function mats() {
  return (MATS ??= {
    dark: new THREE.MeshStandardMaterial({ color: '#2a2630', roughness: 0.5 }),
    keys: new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.4 }),
    black: new THREE.MeshStandardMaterial({ color: '#141216', roughness: 0.4 }),
    chrome: new THREE.MeshStandardMaterial({
      color: '#c8ccd4',
      roughness: 0.25,
      metalness: 0.8,
    }),
    grille: new THREE.MeshStandardMaterial({
      color: '#4a4050',
      roughness: 0.9,
    }),
    wood: new THREE.MeshStandardMaterial({ color: '#c8742e', roughness: 0.45 }),
    woodDark: new THREE.MeshStandardMaterial({
      color: '#4a2a18',
      roughness: 0.6,
    }),
    note: new THREE.SpriteMaterial({
      map: canvasTexture(64, 64, (ctx, w, h) => {
        ctx.font = `bold ${h * 0.8}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(143,244,255,0.9)'
        ctx.shadowBlur = 8
        ctx.fillStyle = '#e8fbff'
        ctx.fillText('♪', w / 2, h / 2)
      }),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }),
  })
}

export function Nakashi({ outline = true }: { outline?: boolean }) {
  const group = useRef<THREE.Group>(null)
  const singerG = useRef<THREE.Group>(null)
  const guitarG = useRef<THREE.Group>(null)
  const singer = useRef(newDrive({ pose: 'shopkeeper', heading: B.organ.heading }))
  const guitarist = useRef(newDrive({ pose: 'clasp', heading: B.guitar.heading }))
  const notes = useRef<THREE.Sprite[]>([])
  const m = mats()
  const noteMats = useMemo(() => [0, 1, 2].map(() => (m.note as THREE.SpriteMaterial).clone()), [m])

  useEffect(() => () => band.stop(), [])

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const s = useStore.getState()
    const on = adultOn() && s.phase === 'night' && s.scene === 'oldstreet'
    g.visible = on
    const d = Math.hypot(player.x - B.x, player.z - B.z)
    const near = Math.max(0, Math.min(1, 1 - (d - 2) / (NIGHTLIFE.bandHear - 2)))
    band.update(on ? MAX_LEVEL * Math.pow(near, 1.5) : 0)
    if (!on) return
    const t = clock.elapsedTime
    // 跟著拍子搖（一拍一下）
    const beat = (t * BPM) / 60
    const sway = Math.sin(beat * Math.PI) * 0.06
    if (singerG.current) {
      singerG.current.rotation.z = sway
      singerG.current.position.y = FLOOR + HOVER + Math.abs(Math.sin(beat * Math.PI)) * 0.03
    }
    if (guitarG.current) {
      guitarG.current.rotation.z = -sway * 0.8
      guitarG.current.position.y = FLOOR + HOVER + Math.abs(Math.cos(beat * Math.PI)) * 0.025
    }
    // 靠近時兩個人都看阿嬤一下
    const look = d < 3.2
    singer.current.heading = look ? Math.atan2(player.x - B.organ.x, player.z - B.organ.z) * 0.4 + B.organ.heading * 0.6 : B.organ.heading
    guitarist.current.heading = look ? Math.atan2(player.x - B.guitar.x, player.z - B.guitar.z) * 0.5 + B.guitar.heading * 0.5 : B.guitar.heading
    // 飄起來的音符
    notes.current.forEach((sp, k) => {
      if (!sp) return
      const p = (t * 0.35 + k / 3) % 1
      sp.position.set(B.organ.x + 0.2 + Math.sin(p * 6 + k) * 0.25, 1.55 + p * 1.1, B.organ.z + 0.1)
      ;(sp.material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI) * 0.85 * near
    })
  })

  const ox = Math.sin(B.organ.heading)
  const oz = Math.cos(B.organ.heading)
  return (
    <group ref={group} userData={{ noMerge: true }} visible={false}>
      {/* 主唱＋電子琴 */}
      <group ref={singerG} position={[B.organ.x, FLOOR + HOVER, B.organ.z]}>
        <Chibi spec={SPECS.nakashi} drive={singer} outline={outline} />
      </group>
      <group position={[B.organ.x + ox * 0.36, FLOOR, B.organ.z + oz * 0.36]} rotation={[0, B.organ.heading, 0]}>
        {/* X 形的琴架 */}
        {[-0.25, 0.25].flatMap((x) =>
          [0.5, -0.5].map((a) => (
            <mesh key={`${x}${a}`} geometry={boxGeo(0.04, 0.8, 0.04)} material={m.chrome} position={[x, 0.36, 0]} rotation={[a, 0, 0]} castShadow />
          )),
        )}
        {/* 琴身、白鍵、幾個黑鍵 */}
        <mesh geometry={boxGeo(0.86, 0.08, 0.3)} material={m.dark} position={[0, 0.71, 0]} castShadow />
        <mesh geometry={boxGeo(0.76, 0.025, 0.13)} material={m.keys} position={[0, 0.76, -0.07]} />
        {[-0.3, -0.22, -0.1, -0.02, 0.06, 0.18, 0.26].map((x) => (
          <mesh key={x} geometry={boxGeo(0.03, 0.02, 0.07)} material={m.black} position={[x, 0.775, -0.1]} />
        ))}
      </group>
      {/* 麥克風架：伸到主唱嘴巴前面 */}
      <group position={[B.organ.x + ox * 0.62 - oz * 0.34, FLOOR, B.organ.z + oz * 0.62 + ox * 0.34]}>
        <mesh geometry={boxGeo(0.03, 1.12, 0.03)} material={m.chrome} position={[0, 0.56, 0]} castShadow />
        <mesh geometry={boxGeo(0.22, 0.02, 0.22)} material={m.black} position={[0, 0.01, 0]} />
        <mesh geometry={boxGeo(0.34, 0.025, 0.025)} material={m.chrome} position={[0.13, 1.12, -0.1]} rotation={[0, 0.7, 0.35]} />
        <mesh material={m.black} position={[0.26, 1.2, -0.2]}>
          <sphereGeometry args={[0.045, 10, 8]} />
        </mesh>
      </group>
      {/* 音箱 */}
      <group position={[(B.organ.x + B.guitar.x) / 2, FLOOR, (B.organ.z + B.guitar.z) / 2 - 0.35]} rotation={[0, 0.05, 0]}>
        <mesh geometry={boxGeo(0.44, 0.46, 0.28)} material={m.dark} position={[0, 0.23, 0]} castShadow />
        <mesh geometry={boxGeo(0.36, 0.34, 0.01)} material={m.grille} position={[0, 0.22, 0.145]} />
      </group>
      {/* 吉他手 */}
      <group ref={guitarG} position={[B.guitar.x, FLOOR + HOVER, B.guitar.z]}>
        <Chibi spec={SPECS.nakashi_guitar} drive={guitarist} outline={outline} />
        <group rotation={[0, B.guitar.heading, 0]}>
          <group position={[0.02, 0.6, 0.3]} rotation={[0, 0, 0.9]} scale={1.25}>
            <mesh material={m.wood} position={[0, -0.12, 0]} scale={[1, 1, 0.35]} castShadow>
              <sphereGeometry args={[0.15, 14, 10]} />
            </mesh>
            <mesh material={m.wood} position={[0, 0.06, 0]} scale={[1, 1, 0.35]}>
              <sphereGeometry args={[0.11, 14, 10]} />
            </mesh>
            <mesh material={m.woodDark} position={[0, -0.06, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.01, 12]} />
            </mesh>
            <mesh geometry={boxGeo(0.05, 0.4, 0.03)} material={m.woodDark} position={[0, 0.33, 0]} />
            <mesh geometry={boxGeo(0.07, 0.09, 0.035)} material={m.woodDark} position={[0, 0.56, 0]} />
          </group>
        </group>
      </group>
      {/* 飄起來的音符 */}
      {noteMats.map((mat, k) => (
        <sprite
          key={k}
          ref={(el) => {
            if (el) notes.current[k] = el
          }}
          material={mat}
          scale={[0.28, 0.28, 0.28]}
        />
      ))}
    </group>
  )
}
