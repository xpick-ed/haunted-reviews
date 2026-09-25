import { audio } from '../../audio'

// 擲筊：筊杯落在磚地上的「喀」（短噪音經帶通＋木頭的共鳴）。

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.2), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

export const jiaobeiSfx = {
  clack(vol = 1) {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    for (let k = 0; k < 2; k++) {
      const at = t + k * 0.035
      const src = ctx.createBufferSource()
      src.buffer = noiseBuf(ctx)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1900 + k * 500
      bp.Q.value = 3
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.5 * vol, at + 0.003)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07)
      src.connect(bp).connect(g).connect(audio.bus.sfx)
      src.start(at)
      src.stop(at + 0.1)
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = 720 + k * 180
      const og = ctx.createGain()
      og.gain.setValueAtTime(0.18 * vol, at)
      og.gain.exponentialRampToValueAtTime(0.0001, at + 0.09)
      o.connect(og).connect(audio.bus.sfx)
      o.start(at)
      o.stop(at + 0.1)
    }
  },
}
