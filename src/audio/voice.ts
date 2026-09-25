// 角色語音：播放 scripts/gen_voices.py 預生成的 mp3（public/voice/），每個角色一個固定的聲音。
// 沒有音檔的句子（動態文字）可以用 blip() 打字音，或讓 audio.speak() 退回 Web Speech。

import castData from '../data/cast.json'
import { audio } from '../audio'

export interface CastMember {
  id: string
  name: string
  desc: string
  ghost: boolean
  color: string
  voice: { engine: 'edge'; voice: string; rate: string; pitch: string; fx: string[] }
  blip: { freq: number; wave: OscillatorType; jitter: number }
}

export interface VoiceLine {
  file: string
  who: string
  text: string
  dur: number
  hash: string
}

export const cast = castData as CastMember[]
const castById = new Map(cast.map((c) => [c.id, c]))
/** 劇本裡常用的簡稱也對得到角色 */
const ALIAS: Record<string, string> = { 阿嬤: 'grandma', 阿春: 'grandma', 小翰: 'xiaohan', 小美: 'xiaomei', 廟公: 'miaogong' }
for (const c of cast) ALIAS[c.name] = c.id

/** 用 id 或名字找角色 */
export function character(idOrName: string): CastMember | undefined {
  return castById.get(idOrName) ?? castById.get(ALIAS[idOrName])
}

const BASE = `${import.meta.env.BASE_URL}voice/`

class VoicePlayer {
  private manifest: Record<string, VoiceLine> | null = null
  private byText = new Map<string, string>()
  private loading: Promise<void> | null = null
  private buffers = new Map<string, Promise<AudioBuffer | null>>()
  private current: { src: AudioBufferSourceNode | null; token: number } = { src: null, token: 0 }
  private endTimer = 0
  private lastBlip = 0

  /** 載入 manifest（重複呼叫只會載一次） */
  load(): Promise<void> {
    if (this.loading) return this.loading
    this.loading = fetch(`${BASE}manifest.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Record<string, VoiceLine>) => {
        this.manifest = m
        for (const [id, line] of Object.entries(m)) this.byText.set(line.text, id)
      })
      .catch(() => {
        this.manifest = {}
      })
    return this.loading
  }

  get ready() {
    return this.manifest !== null
  }

  has(lineId: string) {
    return !!this.manifest?.[lineId]
  }

  line(lineId: string): VoiceLine | undefined {
    return this.manifest?.[lineId]
  }

  /** 秒數；沒有這句（或 manifest 還沒載好）回傳 0 */
  duration(lineId: string) {
    return this.manifest?.[lineId]?.dur ?? 0
  }

  /** 先下載、解碼起來，播的時候就不會延遲。一次最多抓 4 個，不要跟貼圖搶頻寬 */
  async preload(lineIds: string[]) {
    await this.load()
    const queue = [...new Set(lineIds)].filter((id) => this.has(id) && !this.buffers.has(id))
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) await this.buffer(id)
    }
    await Promise.all([worker(), worker(), worker(), worker()])
  }

  /**
   * 播一句台詞（同時只會有一句，新的會蓋掉舊的）。回傳這句的秒數，沒有音檔回傳 0。
   * manifest 還沒載好時會回傳 0，但載好之後仍然會播。
   */
  play(lineId: string, onEnd?: () => void): number {
    this.stop()
    const token = ++this.current.token
    if (!this.manifest) {
      void this.load().then(() => {
        if (this.current.token === token && this.has(lineId)) this.start(lineId, token, onEnd)
      })
      return 0
    }
    if (!this.has(lineId)) return 0
    this.start(lineId, token, onEnd)
    return this.duration(lineId)
  }

  /** 用字幕文字找台詞來播（給舊的 say(speaker, text) 用）。找不到回傳 0。 */
  playText(text: string, onEnd?: () => void): number {
    const id = this.byText.get(text)
    return id ? this.play(id, onEnd) : 0
  }

  stop() {
    this.current.token++
    window.clearTimeout(this.endTimer)
    const src = this.current.src
    this.current.src = null
    if (src) {
      try {
        src.stop()
      } catch {
        /* 已經停了 */
      }
    }
    audio.duck(false)
  }

  get playing() {
    return this.current.src !== null
  }

  setVolume(v: number) {
    audio.setVolume('voice', v)
  }

  /** 打字機音：每個角色不同的音高與波形。連續呼叫會自動節流（約 45ms 一聲）。 */
  blip(who: string) {
    const ctx = audio.ctx
    const c = character(who)
    if (!ctx || !c) return
    const now = ctx.currentTime
    if (now - this.lastBlip < 0.045) return
    this.lastBlip = now
    const o = ctx.createOscillator()
    o.type = c.blip.wave
    o.frequency.value = c.blip.freq * (1 + (Math.random() * 2 - 1) * c.blip.jitter)
    const g = ctx.createGain()
    const peak = c.blip.wave === 'sine' || c.blip.wave === 'triangle' ? 0.12 : 0.05
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(peak, now + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2400
    o.connect(lp).connect(g).connect(audio.bus.voice)
    o.start(now)
    o.stop(now + 0.07)
  }

  // ---------------------------------------------------------------------------

  private buffer(lineId: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(lineId)
    if (!p) {
      const ctx = audio.ctx
      const line = this.manifest?.[lineId]
      if (!ctx || !line) return Promise.resolve(null)
      // ?h=內容雜湊：台詞重新生成後網址就變了，離線快取不會一直給舊的聲音
      p = fetch(`${BASE}${line.file}?h=${line.hash}`)
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .catch(() => null)
      this.buffers.set(lineId, p)
    }
    return p
  }

  private start(lineId: string, token: number, onEnd?: () => void) {
    if (!audio.ctx) audio.init()
    void this.buffer(lineId).then((buf) => {
      const ctx = audio.ctx
      if (!buf || !ctx || this.current.token !== token) return
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(audio.bus.voice)
      src.onended = () => {
        if (this.current.src !== src) return
        this.current.src = null
        audio.duck(false)
        onEnd?.()
      }
      this.current.src = src
      audio.duck(true)
      src.start()
    })
  }
}

export const voice = new VoicePlayer()
