import { audio } from '../../audio'

// 大人的夜生活的小遊戲音效（DESIGN §29）：划酒拳的拍子、乾杯、喝一口；麻將牌敲在桌上。全部合成，不用音檔。

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.3), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

function tone(freq: number, type: OscillatorType, at: number, len: number, vol: number, bend = 1) {
  const ctx = audio.ctx
  if (!ctx) return
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (bend !== 1) o.frequency.exponentialRampToValueAtTime(freq * bend, at + len)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  o.connect(g).connect(audio.bus.sfx)
  o.start(at)
  o.stop(at + len + 0.02)
}

function burst(at: number, freq: number, q: number, len: number, vol: number) {
  const ctx = audio.ctx
  if (!ctx) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  src.connect(bp).connect(g).connect(audio.bus.sfx)
  src.start(at)
  src.stop(at + len + 0.02)
}

export const nightSfx = {
  /** 划拳的拍子（木魚一樣的「叩」）；strong：「出！」那一拍 */
  beat(strong = false) {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    tone(strong ? 880 : 660, 'sine', t, 0.09, strong ? 0.32 : 0.22, 0.8)
    burst(t, 2400, 4, 0.03, strong ? 0.25 : 0.15)
  },
  /** 兩隻手同時出拳：拍桌子 */
  slap() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    burst(t, 900, 0.9, 0.12, 0.45)
    tone(120, 'sine', t, 0.12, 0.3, 0.6)
  },
  /** 乾杯：兩個小酒杯碰一下 */
  clink() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    tone(2650, 'sine', t, 0.5, 0.12)
    tone(3970, 'sine', t + 0.002, 0.35, 0.06)
    tone(2710, 'sine', t + 0.06, 0.4, 0.08)
  },
  /** 喝一口（咕嚕） */
  gulp() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    for (let k = 0; k < 2; k++) tone(260 - k * 40, 'sine', t + k * 0.16, 0.12, 0.28, 1.8)
  },
  /** 麻將牌放到桌上：喀 */
  clack(vol = 1) {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    burst(t, 2100, 2.5, 0.06, 0.45 * vol)
    tone(1150, 'triangle', t, 0.07, 0.16 * vol)
  },
  /** 洗牌：一串亂七八糟的喀喀聲 */
  shuffle() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    for (let k = 0; k < 14; k++) burst(t + k * 0.05 + Math.random() * 0.03, 1600 + Math.random() * 1400, 2, 0.05, 0.12 + Math.random() * 0.12)
  },
  /** 胡了 */
  win() {
    audio.chime()
  },
  /** 輸了：往下滑的兩個音 */
  lose() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    tone(392, 'triangle', t, 0.25, 0.2)
    tone(311, 'triangle', t + 0.22, 0.4, 0.2)
  },
}
