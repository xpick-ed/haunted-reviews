import { audio } from '../../audio'

// 夾娃娃機：投幣、馬達嗡嗡聲（移動時）、爪子下降、夾住、掉下去、中獎的電子音樂。

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'square', at = 0) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** 馬達：set(0..1) 控制音量（移動速度） */
export function makeMotor() {
  const ctx = audio.ctx
  if (!ctx) return { set: () => {}, stop: () => {} }
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = 110
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 600
  const g = ctx.createGain()
  g.gain.value = 0
  o.connect(lp).connect(g).connect(audio.bus.sfx)
  o.start()
  return {
    set(k: number) {
      const t = ctx.currentTime
      g.gain.setTargetAtTime(Math.min(1, k) * 0.045, t, 0.04)
      o.frequency.setTargetAtTime(95 + k * 40, t, 0.05)
    },
    stop() {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.04)
      window.setTimeout(() => o.stop(), 300)
    },
  }
}

export const clawSfx = {
  coin() {
    tone(1568, 0.08, 0.07)
    tone(2093, 0.18, 0.06, 'square', 0.07)
  },
  drop() {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(520, t)
    o.frequency.exponentialRampToValueAtTime(180, t + 0.9)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.06, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95)
    o.connect(g).connect(audio.bus.sfx)
    o.start(t)
    o.stop(t + 1)
  },
  grab() {
    tone(320, 0.08, 0.08, 'square')
    tone(260, 0.1, 0.06, 'square', 0.06)
  },
  thud() {
    tone(90, 0.18, 0.12, 'sine')
  },
  win() {
    ;[784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => tone(f, 0.16, 0.07, 'square', i * 0.09))
  },
  lose() {
    ;[392, 330, 262].forEach((f, i) => tone(f, 0.2, 0.06, 'triangle', i * 0.12))
  },
}
