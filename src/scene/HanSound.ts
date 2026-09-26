import { audio } from '../audio'

// 小翰房門口的老收音機（DESIGN §31.2）：轉開時先沙沙的雜訊，然後是一首慢慢的老歌（自己編的五聲音階旋律，不是真的歌）。
// 全部用 WebAudio 合成，走音樂音量。

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 1.2), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** 旋律：[音高（MIDI）, 拍數]；0 是休止 */
const MELODY: [number, number][] = [
  [64, 1], [67, 1], [69, 1.5], [67, 0.5], [64, 1], [62, 1], [60, 2],
  [62, 1], [64, 1], [67, 1], [69, 1], [67, 3], [0, 1],
  [69, 1], [72, 1], [74, 1.5], [72, 0.5], [69, 1], [67, 1], [64, 2],
  [62, 1], [64, 1], [62, 1], [60, 1], [60, 3], [0, 1],
]
/** 伴奏的低音（每小節一個） */
const BASS = [48, 45, 43, 48, 45, 43, 48, 48]
const BEAT = 0.72

/** 放一次（大約 25 秒）；回傳停止的函式 */
export function playRadioSong(): () => void {
  const ctx = audio.ctx
  if (!ctx) return () => {}
  const out = ctx.createGain()
  out.gain.value = 0.0001
  // 老收音機：只有中頻
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1100
  band.Q.value = 0.7
  out.connect(band).connect(audio.bus.music)
  const t0 = ctx.currentTime + 0.05
  out.gain.exponentialRampToValueAtTime(0.5, t0 + 0.4)

  // 轉台的沙沙聲
  const n = ctx.createBufferSource()
  n.buffer = noiseBuf(ctx)
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.18, t0)
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1)
  n.connect(ng).connect(out)
  n.start(t0)

  const start = t0 + 1.0
  let t = start
  for (const [m, beats] of MELODY) {
    const len = beats * BEAT
    if (m) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(hz(m), t)
      // 慢慢的顫音
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 5
      const lg = ctx.createGain()
      lg.gain.value = hz(m) * 0.006
      lfo.connect(lg).connect(o.frequency)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.06)
      g.gain.exponentialRampToValueAtTime(0.06, t + len * 0.7)
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.1)
      o.connect(g).connect(out)
      o.start(t)
      lfo.start(t)
      o.stop(t + len + 0.15)
      lfo.stop(t + len + 0.15)
    }
    t += len
  }
  const end = t
  BASS.forEach((m, i) => {
    const at = start + i * 4 * BEAT
    if (at > end) return
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = hz(m)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.1, at + 0.08)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 4 * BEAT)
    o.connect(g).connect(out)
    o.start(at)
    o.stop(at + 4 * BEAT + 0.1)
  })
  out.gain.setValueAtTime(0.5, end)
  out.gain.exponentialRampToValueAtTime(0.0001, end + 1.2)
  const stopAt = window.setTimeout(() => out.disconnect(), (end - ctx.currentTime + 1.5) * 1000)
  return () => {
    window.clearTimeout(stopAt)
    const now = ctx.currentTime
    out.gain.cancelScheduledValues(now)
    out.gain.setValueAtTime(out.gain.value, now)
    out.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
    window.setTimeout(() => out.disconnect(), 400)
  }
}

/** 歌的長度（秒）：音符飄多久 */
export const RADIO_SONG_SEC = 1 + MELODY.reduce((a, [, b]) => a + b, 0) * BEAT
