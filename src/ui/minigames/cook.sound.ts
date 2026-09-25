import { audio } from '../../audio'

// 煮宵夜的合成音效：油爆聲（濾過的白噪音）、點火、判定的叮。

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

let loop: { src: AudioBufferSourceNode; gain: GainNode } | null = null

export const cookSfx = {
  /** 一陣油爆 */
  sizzleBurst(dur = 0.5, vol = 0.25) {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf(ctx)
    src.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2600
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(hp).connect(g).connect(audio.bus.sfx)
    src.start(t)
    src.stop(t + dur + 0.05)
  },

  /** 持續的滋滋聲（下料到起鍋） */
  startSizzle(vol = 0.15) {
    const ctx = audio.ctx
    if (!ctx) return
    if (loop) {
      loop.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.2)
      return
    }
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf(ctx)
    src.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'bandpass'
    hp.frequency.value = 4200
    hp.Q.value = 0.6
    // 油爆的顆粒感：很快的音量抖動
    const trem = ctx.createOscillator()
    trem.frequency.value = 23
    const tremGain = ctx.createGain()
    tremGain.gain.value = vol * 0.5
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.15)
    trem.connect(tremGain).connect(gain.gain)
    src.connect(hp).connect(gain).connect(audio.bus.sfx)
    src.start()
    trem.start()
    src.onended = () => trem.stop()
    loop = { src, gain }
  },

  stopSizzle() {
    const ctx = audio.ctx
    if (!ctx || !loop) return
    const l = loop
    loop = null
    l.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15)
    l.src.stop(ctx.currentTime + 0.6)
  },

  /** 點火：低沉的呼 */
  ignite() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf(ctx)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(300, t)
    lp.frequency.exponentialRampToValueAtTime(1400, t + 0.35)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.1)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
    src.connect(lp).connect(g).connect(audio.bus.sfx)
    src.start(t)
    src.stop(t + 0.75)
  },

  /** 判定的「叮」 */
  tick(freq = 1100) {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    o.connect(g).connect(audio.bus.sfx)
    o.start(t)
    o.stop(t + 0.3)
  },

  chime() {
    audio.chime()
  },
}
