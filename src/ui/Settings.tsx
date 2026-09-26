import { useState } from 'react'
import { useStore } from '../store'
import { useSettings } from '../settings'
import './Settings.css'

// 設定（DESIGN §29）：語音、畫質、成人內容（第一次打開要確認 18 歲）、恐怖程度。

export function SettingsPanel() {
  const openPanel = useStore((s) => s.openPanel)
  const voice = useStore((s) => s.voice)
  const toggleVoice = useStore((s) => s.toggleVoice)
  const quality = useStore((s) => s.quality)
  const setQuality = useStore((s) => s.setQuality)
  const set = useSettings()
  const [asking, setAsking] = useState(false)

  const toggleAdult = () => {
    if (set.adult) return set.update({ adult: false })
    if (!set.adultConfirmed) return setAsking(true)
    set.update({ adult: true })
  }

  return (
    <div className="screen-backdrop" onClick={() => openPanel(null)}>
      <div className="sheet settings" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">設定</h2>
        <Row label="語音" desc="角色說話的聲音" on={voice} onClick={toggleVoice} />
        <Row label="高畫質" desc="手機太卡可以關掉" on={quality === 'high'} onClick={() => setQuality(quality === 'high' ? 'low' : 'high')} />
        <Row
          label="成人內容（18+）"
          desc="冥婚、凶宅、情侶客人、酒拳與麻將、大人的笑話和心事。性只用暗示，不會有露骨內容。改了之後，下一晚開始的客人與劇情才會換。"
          on={set.adult}
          onClick={toggleAdult}
        />
        <Row
          label="恐怖加強"
          desc="更寫實的鬼臉、更重的音效、被看到時的驚嚇畫面（會有突然的閃光）"
          on={set.horror === 'strong'}
          onClick={() => set.update({ horror: set.horror === 'strong' ? 'normal' : 'strong' })}
        />
        {asking && (
          <div className="age-check">
            <b>你已經滿 18 歲了嗎？</b>
            <span>成人內容包含恐怖、酒、外遇、失業與喪親等題材。</span>
            <div className="sheet-buttons">
              <button className="btn" onClick={() => setAsking(false)}>
                還沒
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  set.update({ adult: true, adultConfirmed: true })
                  setAsking(false)
                }}
              >
                我滿 18 歲了
              </button>
            </div>
          </div>
        )}
        <button className="btn primary" onClick={() => openPanel(null)}>
          好
        </button>
      </div>
    </div>
  )
}

function Row({ label, desc, on, onClick }: { label: string; desc: string; on: boolean; onClick: () => void }) {
  return (
    <button className={`setting-row ${on ? 'on' : ''}`} onClick={onClick}>
      <span className="setting-text">
        <b>{label}</b>
        <small>{desc}</small>
      </span>
      <span className="switch" aria-checked={on} role="switch">
        <i />
      </span>
    </button>
  )
}
