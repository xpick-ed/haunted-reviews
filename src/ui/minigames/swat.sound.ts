import { audio } from '../../audio'

// 打蚊子的合成音效：嗡嗡聲（鋸齒波＋顫音）、拍下去（打到悶悶的，拍空很響）。

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.3), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

let buzz: { osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null

export const swatSfx = {
  startBuzz() {
    const ctx = audio.ctx
    if (!ctx || buzz) return
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 560
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 7
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 35
    lfo.connect(lfoGain).connect(osc.frequency)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400
    bp.Q.value = 1.2
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    osc.connect(bp).connect(gain).connect(audio.bus.sfx)
    osc.start()
    lfo.start()
    buzz = { osc, lfo, gain }
  },

  /** 還活著的比例 0..1 → 嗡嗡聲大小 */
  buzzLevel(k: number) {
    const ctx = audio.ctx
    if (!ctx || !buzz) return
    buzz.gain.gain.setTargetAtTime(0.028 * k, ctx.currentTime, 0.1)
  },

  stopBuzz() {
    const ctx = audio.ctx
    if (!ctx || !buzz) return
    const b = buzz
    buzz = null
    b.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05)
    b.osc.stop(ctx.currentTime + 0.3)
    b.lfo.stop(ctx.currentTime + 0.3)
  },

  slap(hit: boolean) {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf(ctx)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = hit ? 900 : 2600
    const g = ctx.createGain()
    const vol = hit ? 0.35 : 0.7
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + (hit ? 0.09 : 0.16))
    src.connect(f).connect(g).connect(audio.bus.sfx)
    src.start(t)
    src.stop(t + 0.2)
    // 低頻的「咚」
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(hit ? 140 : 190, t)
    o.frequency.exponentialRampToValueAtTime(60, t + 0.1)
    const og = ctx.createGain()
    og.gain.setValueAtTime(hit ? 0.25 : 0.4, t)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    o.connect(og).connect(audio.bus.sfx)
    o.start(t)
    o.stop(t + 0.14)
  },
}
