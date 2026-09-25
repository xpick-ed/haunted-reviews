// 取樣音效：public/sfx/（Kenney CC0 + 腳本合成，見 scripts/fetch_sfx.py）。
// 每種音效有幾個變體，播的時候隨機挑一個（不會連續同一個），並且微調音高，聽起來不機械。

import { audio } from '../audio'

export type SfxName =
  | 'door_open'
  | 'door_close'
  | 'ui_select'
  | 'ui_confirm'
  | 'ui_cancel'
  | 'dialogue_next'
  | 'incense'
  | 'temple_bell'
  | 'cloth'
  | 'whoosh'
  | 'footstep_wood'
  | 'footstep_stone'
  | 'footstep_grass'
  | 'pickup'
  | 'creak'
  | 'knock'
  | 'pot'
  | 'switch'

export interface SfxOptions {
  /** 乘在預設音量上（0–1+） */
  volume?: number
  /** 播放速度（同時改音高），預設 1 */
  rate?: number
  /** 隨機音高變化幅度，預設 0.05（±5%） */
  jitter?: number
  /** 延遲幾秒再播 */
  delay?: number
}

interface Entry {
  files: string[]
  volume: number
}

const BASE = `${import.meta.env.BASE_URL}sfx/`

class Sfx {
  private manifest: Record<string, Entry> | null = null
  private loading: Promise<void> | null = null
  private buffers = new Map<string, Promise<AudioBuffer | null>>()
  private last = new Map<string, number>()

  load(): Promise<void> {
    if (this.loading) return this.loading
    this.loading = fetch(`${BASE}manifest.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Record<string, Entry>) => {
        this.manifest = m
      })
      .catch(() => {
        this.manifest = {}
      })
    return this.loading
  }

  has(name: SfxName) {
    return !!this.manifest?.[name]
  }

  /** 預先解碼（例如進場景時先載腳步聲） */
  async preload(names?: SfxName[]) {
    await this.load()
    const list = names ?? (Object.keys(this.manifest ?? {}) as SfxName[])
    await Promise.all(list.flatMap((n) => (this.manifest?.[n]?.files ?? []).map((f) => this.buffer(f))))
  }

  play(name: SfxName, opts: SfxOptions = {}) {
    if (!this.manifest) {
      void this.load().then(() => this.play(name, opts))
      return
    }
    const entry = this.manifest[name]
    if (!entry) return
    if (!audio.ctx) audio.init()
    const n = entry.files.length
    let i = Math.floor(Math.random() * n)
    if (n > 1 && i === this.last.get(name)) i = (i + 1) % n
    this.last.set(name, i)
    const jitter = opts.jitter ?? 0.05
    const rate = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * jitter)
    const gain = entry.volume * (opts.volume ?? 1)
    void this.buffer(entry.files[i]).then((buf) => {
      const ctx = audio.ctx
      if (!buf || !ctx) return
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.playbackRate.value = rate
      const g = ctx.createGain()
      g.gain.value = gain
      src.connect(g).connect(audio.bus.sfx)
      src.start(ctx.currentTime + (opts.delay ?? 0))
    })
  }

  private buffer(file: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(file)
    if (!p) {
      const ctx = audio.ctx
      if (!ctx) return Promise.resolve(null)
      p = fetch(BASE + file)
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .catch(() => null)
      this.buffers.set(file, p)
    }
    return p
  }
}

export const sfx = new Sfx()
