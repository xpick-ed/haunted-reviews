import { audio } from '../audio'

// 村子房子裡的小音效（DESIGN §30）：阿財伯家的鋼琴（一根手指頭）、鬼貓小花的呼嚕與喵、黑白電視拍一下的雜訊。全部合成，不用音檔。

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 1.2), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

/** 鋼琴的一個音：三角波＋泛音，快起慢收 */
function key(ctx: AudioContext, freq: number, at: number, vol: number) {
  for (const [mul, v] of [
    [1, 1],
    [2, 0.35],
    [3, 0.12],
  ]) {
    const o = ctx.createOscillator()
    o.type = mul === 1 ? 'triangle' : 'sine'
    o.frequency.value = freq * mul
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(vol * v, at + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4)
    o.connect(g).connect(audio.bus.sfx)
    o.start(at)
    o.stop(at + 1.5)
  }
}

/** 五聲音階隨便按幾下（一根手指頭，節奏不太穩） */
function piano(ctx: AudioContext) {
  const scale = [261.6, 293.7, 329.6, 392, 440, 523.3]
  let t = ctx.currentTime + 0.05
  let i = 2 + Math.floor(Math.random() * 2)
  for (let n = 0; n < 6; n++) {
    key(ctx, scale[i], t, 0.16)
    t += 0.3 + Math.random() * 0.18
    i = Math.max(0, Math.min(scale.length - 1, i + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))))
  }
}

/** 呼嚕：低頻的顫動雜訊，一口氣一口氣 */
function purr(ctx: AudioContext) {
  const t0 = ctx.currentTime + 0.05
  for (let k = 0; k < 3; k++) {
    const at = t0 + k * 0.9
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf(ctx)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 180
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.linearRampToValueAtTime(0.5, at + 0.25)
    g.gain.linearRampToValueAtTime(0.0001, at + 0.75)
    // 顫動：25 Hz 的 LFO 調音量
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 24
    const depth = ctx.createGain()
    depth.gain.value = 0.35
    const trem = ctx.createGain()
    trem.gain.value = 0.6
    lfo.connect(depth).connect(trem.gain)
    src.connect(lp).connect(trem).connect(g).connect(audio.bus.sfx)
    src.start(at)
    src.stop(at + 0.8)
    lfo.start(at)
    lfo.stop(at + 0.8)
  }
}

/** 喵：鋸齒波經過帶通，音高先升後降 */
function meow(ctx: AudioContext) {
  const at = ctx.currentTime + 0.05
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(520, at)
  o.frequency.linearRampToValueAtTime(780, at + 0.18)
  o.frequency.linearRampToValueAtTime(480, at + 0.55)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(900, at)
  bp.frequency.linearRampToValueAtTime(1600, at + 0.2)
  bp.frequency.linearRampToValueAtTime(800, at + 0.55)
  bp.Q.value = 4
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.14, at + 0.06)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6)
  o.connect(bp).connect(g).connect(audio.bus.sfx)
  o.start(at)
  o.stop(at + 0.65)
}

/** 電視的雜訊：一小段嘶嘶聲 */
function tv(ctx: AudioContext) {
  const at = ctx.currentTime + 0.02
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf(ctx)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2500
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.05, at + 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9)
  src.connect(hp).connect(g).connect(audio.bus.sfx)
  src.start(at)
  src.stop(at + 1.0)
}

export function villageSound(name: 'piano' | 'purr' | 'meow' | 'tv') {
  const ctx = audio.ctx
  if (!ctx) return
  if (name === 'piano') piano(ctx)
  else if (name === 'purr') purr(ctx)
  else if (name === 'meow') meow(ctx)
  else tv(ctx)
}
