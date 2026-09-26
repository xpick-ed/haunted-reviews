import { audio } from '../../audio'

// 抓螃蟹的小音效（Web Audio 現場合成）：掀石頭、螃蟹爬、抓到、被夾、浪聲。

let noiseBuf: AudioBuffer | null = null
function noise(ctx: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

/** 掀石頭：低低的一聲「叩」加一點沙沙聲 */
export function rockThud(vol = 0.3) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(160, t)
  o.frequency.exponentialRampToValueAtTime(70, t + 0.12)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + 0.2)
  const n = ctx.createBufferSource()
  n.buffer = noise(ctx)
  const lp = ctx.createBiquadFilter()
  lp.type = 'bandpass'
  lp.frequency.value = 1800
  lp.Q.value = 0.8
  const g2 = ctx.createGain()
  g2.gain.setValueAtTime(vol * 0.5, t)
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  n.connect(lp).connect(g2).connect(audio.bus.sfx)
  n.start(t)
  n.stop(t + 0.3)
}

/** 螃蟹的腳在石頭上喀喀喀 */
export function skitter(vol = 0.05) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  for (let i = 0; i < 4; i++) {
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = 2400 + Math.random() * 900
    const g = ctx.createGain()
    const t0 = t + i * 0.035
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.015)
    o.connect(g).connect(audio.bus.sfx)
    o.start(t0)
    o.stop(t0 + 0.02)
  }
}

/** 抓到了：兩個上揚的音 */
export function caughtChime() {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  ;[784, 1175].forEach((f, i) => {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const g = ctx.createGain()
    const t0 = t + i * 0.08
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3)
    o.connect(g).connect(audio.bus.sfx)
    o.start(t0)
    o.stop(t0 + 0.35)
  })
}

/** 被夾：尖尖的「嘰」 */
export function pinch() {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(900, t)
  o.frequency.exponentialRampToValueAtTime(420, t + 0.15)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.12, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + 0.2)
}

/** 空的：一聲輕輕的沙 */
export function emptyRock() {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const n = ctx.createBufferSource()
  n.buffer = noise(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 3200
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.06, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  n.connect(bp).connect(g).connect(audio.bus.sfx)
  n.start(t)
  n.stop(t + 0.15)
}

/** 浪聲：一直循環的低沉沙沙聲，強弱慢慢變；回傳停止的函式 */
export function waves(): () => void {
  const ctx = audio.ctx
  if (!ctx) return () => {}
  const n = ctx.createBufferSource()
  n.buffer = noise(ctx)
  n.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 520
  const g = ctx.createGain()
  g.gain.value = 0.05
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.18
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.035
  lfo.connect(lfoGain).connect(g.gain)
  n.connect(lp).connect(g).connect(audio.bus.sfx)
  n.start()
  lfo.start()
  return () => {
    const t = ctx.currentTime
    g.gain.cancelScheduledValues(t)
    g.gain.setValueAtTime(g.gain.value, t)
    g.gain.linearRampToValueAtTime(0.0001, t + 0.4)
    n.stop(t + 0.45)
    lfo.stop(t + 0.45)
  }
}
