import { audio } from '../audio'

// 老街東邊的店的合成音效（DESIGN §30）：冰果室點唱機的三首老歌（自己編的旋律）、彈珠汽水「啵」一聲＋氣泡。
// 規則檔（src/world/osEast.ts）用動態 import 呼叫，才不會在 Node 測試裡載入 audio。

/** 三首歌：[半音（C4 = 0，null 是休止）, 拍數]；都是自己編的，像 1960 年代的台語老歌 */
const SONGS: { bpm: number; wave: OscillatorType; notes: [number | null, number][] }[] = [
  // 〈雨夜的冰果室〉：小調、慢慢的
  {
    bpm: 84,
    wave: 'triangle',
    notes: [
      [9, 1],
      [12, 1],
      [14, 1.5],
      [12, 0.5],
      [9, 1],
      [7, 1],
      [4, 2],
      [7, 1],
      [9, 1],
      [12, 1],
      [9, 0.5],
      [7, 0.5],
      [4, 1],
      [2, 1],
      [4, 2],
    ],
  },
  // 〈港口的紅手帕〉：演歌風，拉長音
  {
    bpm: 96,
    wave: 'square',
    notes: [
      [4, 1],
      [7, 1],
      [9, 2],
      [7, 0.5],
      [9, 0.5],
      [12, 1],
      [9, 2],
      [null, 0.5],
      [7, 0.5],
      [4, 1],
      [2, 1],
      [0, 1],
      [2, 0.5],
      [4, 0.5],
      [4, 2],
    ],
  },
  // 〈等妳一碗冰〉：大調、搖擺
  {
    bpm: 108,
    wave: 'triangle',
    notes: [
      [0, 0.75],
      [4, 0.25],
      [7, 1],
      [9, 1],
      [7, 1],
      [4, 0.75],
      [2, 0.25],
      [0, 2],
      [2, 0.75],
      [4, 0.25],
      [7, 1],
      [12, 1],
      [11, 0.5],
      [9, 0.5],
      [7, 2],
    ],
  },
]

let playing: { stop: () => void } | null = null

/** 點唱機放第 n 首（上一首還在放就先停）；音量小小的，走在店裡剛好聽得到 */
export function playJukebox(n: number) {
  const ctx = audio.ctx
  if (!ctx) return
  playing?.stop()
  const song = SONGS[n % SONGS.length]
  const beat = 60 / song.bpm
  const t0 = ctx.currentTime + 0.35
  const out = ctx.createGain()
  out.gain.value = 0.16
  // 老唱片的感覺：高頻切掉一點
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2400
  out.connect(lp).connect(audio.bus.music ?? audio.bus.sfx)
  const nodes: AudioScheduledSourceNode[] = []
  // 唱針放下去的沙沙聲
  crackle(ctx, out, t0 - 0.3, 0.5)
  let t = t0
  for (const [semi, beats] of song.notes) {
    const d = beats * beat
    if (semi !== null) {
      const f = 261.63 * Math.pow(2, semi / 12)
      const o = ctx.createOscillator()
      o.type = song.wave
      o.frequency.setValueAtTime(f, t)
      // 輕輕的顫音
      const vib = ctx.createOscillator()
      vib.frequency.value = 5.2
      const vg = ctx.createGain()
      vg.gain.value = f * 0.006
      vib.connect(vg).connect(o.frequency)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(song.wave === 'square' ? 0.35 : 0.8, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.95)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + d)
      vib.start(t)
      vib.stop(t + d)
      nodes.push(o, vib)
      // 低音：每一拍的根音
      const b = ctx.createOscillator()
      b.type = 'sine'
      b.frequency.value = f / 4
      const bg = ctx.createGain()
      bg.gain.setValueAtTime(0.0001, t)
      bg.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
      bg.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(d, beat) * 0.9)
      b.connect(bg).connect(out)
      b.start(t)
      b.stop(t + d)
      nodes.push(b)
    }
    t += d
  }
  const end = t
  const me = {
    stop: () => {
      const now = ctx.currentTime
      out.gain.setTargetAtTime(0.0001, now, 0.08)
      for (const n of nodes) {
        try {
          n.stop(now + 0.3)
        } catch {
          // 已經停了
        }
      }
      if (playing === me) playing = null
    },
  }
  playing = me
  window.setTimeout(
    () => {
      if (playing === me) playing = null
    },
    (end - ctx.currentTime) * 1000 + 200,
  )
}

function crackle(ctx: AudioContext, out: AudioNode, t: number, dur: number) {
  const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() < 0.002 ? (Math.random() * 2 - 1) * 0.8 : (Math.random() * 2 - 1) * 0.02
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(out)
  src.start(Math.max(ctx.currentTime, t))
}

/** 彈珠汽水：彈珠壓下去「啵」＋一陣氣泡 */
export function popSoda() {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(900, t)
  o.frequency.exponentialRampToValueAtTime(240, t + 0.07)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + 0.12)
  // 氣泡：很多小小的高音
  for (let i = 0; i < 16; i++) {
    const at = t + 0.08 + Math.random() * 0.9
    const b = ctx.createOscillator()
    b.type = 'sine'
    const f = 1800 + Math.random() * 2200
    b.frequency.setValueAtTime(f, at)
    b.frequency.exponentialRampToValueAtTime(f * 1.4, at + 0.025)
    const bg = ctx.createGain()
    bg.gain.setValueAtTime(0.0001, at)
    bg.gain.exponentialRampToValueAtTime(0.05, at + 0.003)
    bg.gain.exponentialRampToValueAtTime(0.0001, at + 0.03)
    b.connect(bg).connect(audio.bus.sfx)
    b.start(at)
    b.stop(at + 0.04)
  }
}
