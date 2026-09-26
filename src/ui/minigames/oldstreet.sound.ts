import { audio } from '../../audio'

// 老街三個小遊戲（剉冰、老戲院、照相館）的合成音效：剉冰機的磨冰聲、配料落碗、叮、
// 放映機的喀喀聲、音樂盒、快門與鎂光燈。全部用 Web Audio 現場合成。

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

function burst(freq: number, q: number, vol: number, dur: number, type: BiquadFilterType = 'bandpass', delay = 0) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime + delay
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf(ctx)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(audio.bus.sfx)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.05)
}

function tone(freq: number, vol: number, dur: number, type: OscillatorType = 'sine', delay = 0, slide = 1) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime + delay
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + dur + 0.05)
}

type Loop = { src: AudioBufferSourceNode; gain: GainNode; extra?: AudioScheduledSourceNode }
let grind: Loop | null = null
let clatter: Loop | null = null

function stopLoop(l: Loop | null) {
  const ctx = audio.ctx
  if (!l || !ctx) return
  l.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05)
  l.src.stop(ctx.currentTime + 0.3)
  l.extra?.stop(ctx.currentTime + 0.3)
}

export const osSfx = {
  /** 剉冰機：按住時沙沙的磨冰聲 */
  grindStart() {
    const ctx = audio.ctx
    if (!ctx || grind) return
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf(ctx)
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 3200
    bp.Q.value = 0.8
    // 轉輪一圈一圈：音量有節奏地起伏
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 6
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.05
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    gain.gain.setTargetAtTime(0.12, ctx.currentTime, 0.05)
    lfo.connect(lfoGain).connect(gain.gain)
    src.connect(bp).connect(gain).connect(audio.bus.sfx)
    src.start()
    lfo.start()
    grind = { src, gain, extra: lfo }
  },
  grindStop() {
    stopLoop(grind)
    grind = null
  },
  /** 配料落到冰上 */
  plop(pitch = 1) {
    tone(420 * pitch, 0.18, 0.12, 'sine', 0, 0.55)
    burst(1400, 1.2, 0.05, 0.08)
  },
  /** 淋煉乳 */
  drizzle() {
    burst(900, 0.7, 0.08, 0.35, 'lowpass')
  },
  /** 上桌成功 */
  ding() {
    tone(1318, 0.16, 0.5, 'triangle')
    tone(1976, 0.08, 0.6, 'sine', 0.06)
  },
  /** 做錯了 */
  buzz() {
    tone(160, 0.12, 0.28, 'square', 0, 0.8)
  },
  /** 客人走掉（鬼飄走） */
  whoosh() {
    burst(700, 0.5, 0.1, 0.5, 'bandpass')
    tone(520, 0.05, 0.5, 'sine', 0, 0.5)
  },
  /** 放映機的喀喀聲（持續） */
  clatterStart(vol = 0.1) {
    const ctx = audio.ctx
    if (!ctx || clatter) return
    // 用很快的方波當「門閘」，切出一格一格的喀喀聲
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf(ctx)
    src.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'bandpass'
    hp.frequency.value = 2400
    hp.Q.value = 1.5
    const gate = ctx.createGain()
    gate.gain.value = 0
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 24
    const oscGain = ctx.createGain()
    oscGain.gain.value = 0.5
    osc.connect(oscGain).connect(gate.gain)
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.2)
    src.connect(hp).connect(gate).connect(gain).connect(audio.bus.sfx)
    src.start()
    osc.start()
    clatter = { src, gain, extra: osc }
  },
  clatterStop() {
    stopLoop(clatter)
    clatter = null
  },
  /** 音樂盒的一個音 */
  note(freq: number, delay = 0) {
    tone(freq, 0.07, 1.2, 'sine', delay)
    tone(freq * 2, 0.02, 0.6, 'sine', delay)
  },
  /** 放映機開機的「喀」＋馬達聲 */
  projectorOn() {
    burst(300, 2, 0.2, 0.15, 'lowpass')
    tone(80, 0.06, 0.8, 'sawtooth', 0.05, 1.5)
  },
  /** 老相機的快門 */
  shutter() {
    burst(2600, 2, 0.25, 0.05)
    burst(1200, 1.5, 0.18, 0.08, 'bandpass', 0.06)
  },
  /** 鎂光燈：一聲悶響加嘶 */
  flash() {
    burst(180, 0.8, 0.35, 0.4, 'lowpass')
    burst(5000, 0.6, 0.08, 0.6, 'highpass', 0.05)
  },
  /** 對焦旋鈕的小喀聲 */
  tick() {
    burst(3600, 3, 0.04, 0.03)
  },
}
