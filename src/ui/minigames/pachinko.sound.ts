import { audio } from '../../audio'

// 彈珠台：彈珠撞釘子的「叮」（音高亂一點）、拉桿彈簧、進洞的一串鈴聲、掉出去的悶聲。

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', at = 0) {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + dur + 0.05)
}

let lastPin = 0

export const pachinkoSfx = {
  pin(speed: number) {
    const now = performance.now()
    if (now - lastPin < 28) return
    lastPin = now
    tone(2600 + Math.random() * 1400, 0.05, Math.min(0.08, 0.02 + speed * 0.05), 'triangle')
  },
  wall() {
    tone(900, 0.06, 0.03, 'square')
  },
  launch(power: number) {
    const ctx = audio.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(90 + power * 60, t)
    o.frequency.exponentialRampToValueAtTime(420 + power * 300, t + 0.12)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(lp).connect(g).connect(audio.bus.sfx)
    o.start(t)
    o.stop(t + 0.2)
  },
  pocket(points: number) {
    const notes = points >= 50 ? [784, 988, 1175, 1568, 1976] : points >= 20 ? [784, 988, 1175] : [880, 1175]
    notes.forEach((f, i) => tone(f, 0.22, 0.09, 'square', i * 0.07))
  },
  out() {
    tone(140, 0.25, 0.1, 'sine')
  },
}
