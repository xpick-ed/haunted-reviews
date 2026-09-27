import { audio } from '../audio'

// 城隍廟的小音效（DESIGN §32.2）：叫號的「叮咚」、蓋章的「碰」、打算盤。全部合成，不用音檔。

function tone(ctx: AudioContext, freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(audio.bus.sfx)
  o.start(at)
  o.stop(at + dur + 0.05)
}

/** 叫號機的叮咚（叫到阿嬤的號碼時多響一聲） */
export function chDing(big = false) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime + 0.02
  const v = big ? 0.22 : 0.1
  tone(ctx, 988, t, 0.9, v)
  tone(ctx, 784, t + 0.32, 1.2, v)
  if (big) tone(ctx, 988, t + 0.7, 1.2, v * 0.8)
}

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.4), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

/** 蓋章：一聲悶悶的「碰」（低頻＋一點木頭的雜訊） */
export function chStamp() {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime + 0.02
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(140, t)
  o.frequency.exponentialRampToValueAtTime(48, t + 0.18)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.55, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + 0.35)
  const n = ctx.createBufferSource()
  n.buffer = noiseBuf(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 900
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.25, t)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  n.connect(bp).connect(ng).connect(audio.bus.sfx)
  n.start(t)
  n.stop(t + 0.15)
}

/** 打算盤：一串快快的木頭聲 */
export function chAbacus() {
  const ctx = audio.ctx
  if (!ctx) return
  let t = ctx.currentTime + 0.03
  for (let i = 0; i < 9; i++) {
    tone(ctx, 1800 + Math.random() * 900, t, 0.05, 0.08, 'triangle')
    t += 0.07 + Math.random() * 0.09
  }
}
