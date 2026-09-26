import { audio } from '../../audio'

// 歌仔戲的後場（WebAudio 現場合成，沒有外部音檔）：
// 鑼（小鑼：敲下去音高往上飄）、鼓（堂鼓：低沉）、鈸（沙沙的金屬聲）、板（木頭喀一聲）、
// 殼仔弦（主旋律：鋸齒波＋帶通＋抖音）、大廣弦（低一個八度墊底）。
// 節奏小遊戲和廟埕的戲（Stage.tsx）共用。時間參數 t 是 AudioContext 的時間（秒）。

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

function env(ctx: AudioContext, t: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  return g
}

/** 輸出到哪條匯流排（戲台的背景音樂走 music，小遊戲自己打的走 sfx） */
export type Out = AudioNode

export const opera = {
  get ctx() {
    return audio.ctx
  },
  get sfx(): Out | null {
    return audio.ctx ? audio.bus.sfx : null
  },
  get music(): Out | null {
    return audio.ctx ? audio.bus.music : null
  },

  /** 小鑼：「匡」一聲，音高往上飄 */
  gong(t: number, vol = 0.5, out?: Out | null) {
    const ctx = audio.ctx
    const dest = out ?? opera.sfx
    if (!ctx || !dest) return
    const base = 420
    for (const [k, a] of [
      [1, 1],
      [1.47, 0.6],
      [2.09, 0.45],
      [2.76, 0.3],
      [3.51, 0.2],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(base * k * 0.94, t)
      o.frequency.exponentialRampToValueAtTime(base * k * 1.06, t + 0.35)
      const g = env(ctx, t, vol * a * 0.35, 0.004, 0.9 + (1 - a) * 0.3)
      o.connect(g).connect(dest)
      o.start(t)
      o.stop(t + 1.4)
    }
    // 敲擊的瞬間
    const n = ctx.createBufferSource()
    n.buffer = noiseBuf(ctx)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2400
    bp.Q.value = 1.2
    const ng = env(ctx, t, vol * 0.35, 0.002, 0.08)
    n.connect(bp).connect(ng).connect(dest)
    n.start(t)
    n.stop(t + 0.12)
  },

  /** 堂鼓：低沉的「咚」 */
  drum(t: number, vol = 0.6, out?: Out | null) {
    const ctx = audio.ctx
    const dest = out ?? opera.sfx
    if (!ctx || !dest) return
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(52, t + 0.22)
    const g = env(ctx, t, vol, 0.003, 0.36)
    o.connect(g).connect(dest)
    o.start(t)
    o.stop(t + 0.45)
    const n = ctx.createBufferSource()
    n.buffer = noiseBuf(ctx)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    const ng = env(ctx, t, vol * 0.4, 0.002, 0.05)
    n.connect(lp).connect(ng).connect(dest)
    n.start(t)
    n.stop(t + 0.08)
  },

  /** 鈸：沙沙的金屬聲 */
  cymbal(t: number, vol = 0.4, out?: Out | null) {
    const ctx = audio.ctx
    const dest = out ?? opera.sfx
    if (!ctx || !dest) return
    const n = ctx.createBufferSource()
    n.buffer = noiseBuf(ctx)
    n.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 4200
    const bp = ctx.createBiquadFilter()
    bp.type = 'peaking'
    bp.frequency.value = 7400
    bp.gain.value = 8
    const g = env(ctx, t, vol * 0.5, 0.003, 0.42)
    n.connect(hp).connect(bp).connect(g).connect(dest)
    n.start(t)
    n.stop(t + 0.5)
  },

  /** 板：木頭喀一聲（打拍子） */
  clap(t: number, vol = 0.3, out?: Out | null) {
    const ctx = audio.ctx
    const dest = out ?? opera.sfx
    if (!ctx || !dest) return
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(1350, t)
    o.frequency.exponentialRampToValueAtTime(900, t + 0.04)
    const g = env(ctx, t, vol, 0.001, 0.05)
    o.connect(g).connect(dest)
    o.start(t)
    o.stop(t + 0.08)
  },

  /** 殼仔弦（主旋律）或大廣弦（low）：鋸齒波＋帶通，慢慢起來的抖音 */
  string(t: number, freq: number, dur: number, vol = 0.12, out?: Out | null, low = false) {
    const ctx = audio.ctx
    const dest = out ?? opera.music
    if (!ctx || !dest) return
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(freq * 0.985, t)
    o.frequency.linearRampToValueAtTime(freq, t + 0.06)
    // 抖音：音頭之後才加上
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 5.4
    const depth = ctx.createGain()
    depth.gain.setValueAtTime(0, t)
    depth.gain.linearRampToValueAtTime(freq * 0.012, t + Math.min(0.25, dur * 0.5))
    lfo.connect(depth).connect(o.frequency)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = low ? 520 : 1350
    bp.Q.value = low ? 1.1 : 1.8
    const g = ctx.createGain()
    const end = t + dur
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04)
    g.gain.setValueAtTime(vol * 0.85, Math.max(t + 0.05, end - 0.08))
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.06)
    o.connect(bp).connect(g).connect(dest)
    o.start(t)
    lfo.start(t)
    o.stop(end + 0.1)
    lfo.stop(end + 0.1)
  },
}

// ---------------------------------------------------------------------------
// 旋律：五聲音階（宮商角徵羽），七字調的味道。
// 每一拍一個格子：數字是音階的級數（0 = 宮），null 是延長上一個音，-1 是休止
// ---------------------------------------------------------------------------

/** 宮調：D 宮（D E F# A B），殼仔弦的音域 */
const SCALE = [293.66, 329.63, 369.99, 440.0, 493.88]
export function degreeFreq(d: number) {
  const oct = Math.floor(d / 5)
  const i = ((d % 5) + 5) % 5
  return SCALE[i] * Math.pow(2, oct)
}

/** 一句 8 拍（兩個小節），唱四句一段 */
export const MELODY: (number | null | -1)[][] = [
  [3, null, 4, 3, 2, null, 1, 2],
  [3, 5, 4, 3, 2, null, null, -1],
  [2, null, 3, 2, 1, 0, 1, null],
  [2, 3, 1, null, 0, null, null, -1],
  [5, null, 6, 5, 4, 3, 4, null],
  [3, 2, 3, 4, 3, null, null, -1],
  [2, 3, 2, 1, 0, null, 1, 2],
  [1, null, 0, null, 0, null, null, -1],
]

/** 從 t0 開始排一句旋律（beat 秒一拍），回傳結束的時間 */
export function schedulePhrase(t0: number, phrase: (number | null | -1)[], beat: number, vol = 0.1, out?: Out | null) {
  let i = 0
  while (i < phrase.length) {
    const d = phrase[i]
    let len = 1
    while (i + len < phrase.length && phrase[i + len] === null) len++
    if (d !== null && d !== -1) {
      opera.string(t0 + i * beat, degreeFreq(d), len * beat * 0.95, vol, out)
      // 大廣弦低八度墊底（只在強拍）
      if (i % 4 === 0) opera.string(t0 + i * beat, degreeFreq(d) / 2, len * beat * 0.9, vol * 0.55, out, true)
    }
    i += len
  }
  return t0 + phrase.length * beat
}
