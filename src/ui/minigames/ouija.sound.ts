import { audio } from '../../audio'

// 碟仙：碟子在紙上刮過的沙沙聲（跟速度走）、鎖定答案的「叮」、聊天室跳訊息的小「啵」、秘密揭曉的低音。

let noise: AudioBuffer | null = null
function noiseBuf(ctx: AudioContext) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 1.0), ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noise
}

/** 持續的刮紙聲：set(0..1) 控制音量 */
export function makeScrape() {
  const ctx = audio.ctx
  if (!ctx) return { set: () => {}, stop: () => {} }
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf(ctx)
  src.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2400
  bp.Q.value = 0.7
  const g = ctx.createGain()
  g.gain.value = 0
  src.connect(bp).connect(g).connect(audio.bus.sfx)
  src.start()
  return {
    set(k: number) {
      const t = ctx.currentTime
      g.gain.setTargetAtTime(Math.min(1, k) * 0.12, t, 0.05)
      bp.frequency.setTargetAtTime(1800 + k * 1600, t, 0.08)
    },
    stop() {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
      window.setTimeout(() => src.stop(), 300)
    },
  }
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', at = 0) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + dur + 0.05)
}

export const ouijaSfx = {
  /** 碰到一個字（拼字的一格） */
  tick() {
    tone(1320, 0.12, 0.08, 'triangle')
  },
  /** 答案鎖定 */
  lock(kind: 'comfort' | 'scare' | 'secret') {
    if (kind === 'comfort') {
      tone(660, 0.5, 0.1)
      tone(990, 0.6, 0.07, 'sine', 0.08)
    } else if (kind === 'scare') {
      tone(98, 0.9, 0.2, 'sawtooth')
      tone(103, 0.9, 0.12, 'sawtooth')
    } else {
      tone(55, 1.4, 0.25, 'sine')
      tone(740, 0.9, 0.06, 'triangle', 0.15)
      tone(1110, 0.9, 0.05, 'triangle', 0.3)
    }
  },
  /** 聊天室跳一則訊息 */
  pop() {
    tone(1800 + Math.random() * 500, 0.05, 0.025, 'square')
  },
}
