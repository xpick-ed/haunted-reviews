// 佔位音效：全部用 Web Audio 現場合成，之後換成真正的音檔（DESIGN §16.2）。
// 語音用瀏覽器內建 Web Speech API（DESIGN §15.5，M3 換 edge-tts 音檔）。

type Who = '阿嬤' | '小美' | '小翰' | ''

class GameAudio {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private verb!: ConvolverNode
  private cricketGain!: GainNode
  private windGain!: GainNode
  private noiseBuf!: AudioBuffer
  private voices: SpeechSynthesisVoice[] = []

  init() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(ctx.destination)

    // 簡單的殘響：一段衰減的雜訊當脈衝響應
    this.verb = ctx.createConvolver()
    this.verb.buffer = this.impulse(1.8, 2.5)
    const wet = ctx.createGain()
    wet.gain.value = 0.22
    this.verb.connect(wet).connect(this.master)

    this.noiseBuf = this.noise(2)
    this.startAmbience()

    if ('speechSynthesis' in window) {
      const load = () => {
        this.voices = speechSynthesis.getVoices()
      }
      load()
      speechSynthesis.addEventListener('voiceschanged', load)
    }
  }

  // ---------- 環境 ----------
  private startAmbience() {
    const ctx = this.ctx!
    // 蟲鳴
    const cr = ctx.createBufferSource()
    cr.buffer = this.crickets(4)
    cr.loop = true
    this.cricketGain = ctx.createGain()
    this.cricketGain.gain.value = 0
    cr.connect(this.cricketGain).connect(this.master)
    cr.start()
    // 風
    const wind = ctx.createBufferSource()
    wind.buffer = this.noiseBuf
    wind.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 380
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0
    wind.connect(lp).connect(this.windGain).connect(this.master)
    wind.start()
  }

  setNight(night: boolean) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.cricketGain.gain.cancelScheduledValues(t)
    this.cricketGain.gain.linearRampToValueAtTime(night ? 0.16 : 0.05, t + 3)
    this.windGain.gain.cancelScheduledValues(t)
    this.windGain.gain.linearRampToValueAtTime(night ? 0.07 : 0.035, t + 3)
  }

  // ---------- 音效 ----------
  chime() {
    const ctx = this.ctx
    if (!ctx) return
    const notes = [1046.5, 1318.5, 1568.0, 2093.0]
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.09
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.16, t + 0.008)
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.9)
      g.connect(this.master)
      g.connect(this.verb)
      for (const [mult, amp] of [
        [1, 1],
        [2.01, 0.25],
      ]) {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = f * mult
        const og = ctx.createGain()
        og.gain.value = amp
        o.connect(og).connect(g)
        o.start(t)
        o.stop(t + 2)
      }
    })
  }

  whoosh() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(300, t)
    bp.frequency.exponentialRampToValueAtTime(1800, t + 0.25)
    bp.frequency.exponentialRampToValueAtTime(400, t + 0.55)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.12, t + 0.2)
    g.gain.linearRampToValueAtTime(0, t + 0.6)
    src.connect(bp).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + 0.7)
  }

  scream() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(900, t)
    o.frequency.exponentialRampToValueAtTime(1350, t + 0.08)
    o.frequency.exponentialRampToValueAtTime(380, t + 0.75)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 28
    const lfoG = ctx.createGain()
    lfoG.gain.value = 60
    lfo.connect(lfoG).connect(o.frequency)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1500
    bp.Q.value = 1.4
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.85)
    o.connect(bp).connect(g)
    g.connect(this.master)
    g.connect(this.verb)
    o.start(t)
    lfo.start(t)
    o.stop(t + 0.9)
    lfo.stop(t + 0.9)
    // 一小段氣音
    const n = ctx.createBufferSource()
    n.buffer = this.noiseBuf
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.09, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    n.connect(ng).connect(this.master)
    n.start(t)
    n.stop(t + 0.25)
  }

  heartbeat(beats = 4) {
    const ctx = this.ctx
    if (!ctx) return
    for (let i = 0; i < beats; i++) {
      for (const off of [0, 0.19]) {
        const t = ctx.currentTime + 0.15 + i * 0.78 + off
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.setValueAtTime(64, t)
        o.frequency.exponentialRampToValueAtTime(40, t + 0.14)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(off === 0 ? 0.5 : 0.35, t + 0.012)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
        o.connect(g).connect(this.master)
        o.start(t)
        o.stop(t + 0.2)
      }
    }
  }

  bassDrop() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(32, t + 1.0)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + 1.4)
  }

  doorCreak() {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(150, t)
    o.frequency.linearRampToValueAtTime(240, t + 1.1)
    const trem = ctx.createOscillator()
    trem.frequency.value = 17
    const tg = ctx.createGain()
    tg.gain.value = 0.5
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.07, t + 0.15)
    g.gain.linearRampToValueAtTime(0, t + 1.2)
    trem.connect(tg).connect(g.gain)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    o.connect(lp).connect(g)
    g.connect(this.master)
    g.connect(this.verb)
    o.start(t)
    trem.start(t)
    o.stop(t + 1.3)
    trem.stop(t + 1.3)
    // 木門碰到門框
    const n = ctx.createBufferSource()
    n.buffer = this.noiseBuf
    const nl = ctx.createBiquadFilter()
    nl.type = 'lowpass'
    nl.frequency.value = 220
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.5, t + 1.15)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
    n.connect(nl).connect(ng).connect(this.master)
    n.start(t + 1.15)
    n.stop(t + 1.45)
  }

  dawn() {
    const ctx = this.ctx
    if (!ctx) return
    // 鳥叫
    for (let i = 0; i < 7; i++) {
      const t = ctx.currentTime + 0.2 + i * 0.22 + Math.random() * 0.1
      const o = ctx.createOscillator()
      o.type = 'sine'
      const f = 2600 + Math.random() * 900
      o.frequency.setValueAtTime(f, t)
      o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.05)
      o.frequency.exponentialRampToValueAtTime(f * 0.9, t + 0.1)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
      o.connect(g).connect(this.master)
      o.start(t)
      o.stop(t + 0.15)
    }
    this.chime()
  }

  // ---------- 語音 ----------
  speak(text: string, who: Who) {
    if (!('speechSynthesis' in window) || !who) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-TW'
    const v =
      this.voices.find((x) => x.lang === 'zh-TW') ||
      this.voices.find((x) => x.lang.replace('_', '-').toLowerCase().startsWith('zh')) ||
      null
    if (v) u.voice = v
    const scream = text.startsWith('啊')
    if (who === '阿嬤') {
      u.rate = 0.85
      u.pitch = 0.75
    } else if (who === '小美') {
      u.rate = scream ? 1.3 : 1.05
      u.pitch = scream ? 1.6 : 1.25
    } else {
      u.rate = 1.0
      u.pitch = 0.95
    }
    speechSynthesis.speak(u)
  }

  stopSpeech() {
    if ('speechSynthesis' in window) speechSynthesis.cancel()
  }

  // ---------- 合成用的 buffer ----------
  private noise(seconds: number) {
    const ctx = this.ctx!
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!
    const len = ctx.sampleRate * seconds
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  private crickets(seconds: number) {
    const ctx = this.ctx!
    const sr = ctx.sampleRate
    const buf = ctx.createBuffer(1, sr * seconds, sr)
    const d = buf.getChannelData(0)
    const bugs = [
      { f: 4300, am: 38 },
      { f: 3900, am: 31 },
    ]
    for (const bug of bugs) {
      let t = Math.random() * 0.5
      while (t < seconds - 0.5) {
        const chirps = 3 + Math.floor(Math.random() * 3)
        for (let c = 0; c < chirps; c++) {
          const start = Math.floor((t + c * 0.095) * sr)
          const len = Math.floor(0.055 * sr)
          for (let i = 0; i < len; i++) {
            const x = i / len
            const env = Math.sin(Math.PI * x)
            const am = 0.5 + 0.5 * Math.sin((2 * Math.PI * bug.am * i) / sr)
            d[start + i] += Math.sin((2 * Math.PI * bug.f * i) / sr) * env * am * 0.5
          }
        }
        t += 0.45 + Math.random() * 0.6
      }
    }
    return buf
  }
}

export const audio = new GameAudio()
