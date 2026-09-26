import { useEffect, useState, useSyncExternalStore } from 'react'
import { useStore } from '../store'
import { sfx } from '../audio/sfx'
import { INGREDIENTS, type Ingredient } from '../world/night/items'
import { PORTRAIT_IDS, portraitDataUrl, type PortraitId } from '../art/portraits'
import { BONDS, GIFT_POINTS, deliverPending, giftKind, giftUI, giftedFlag, giveGift, heartsOf, knowFlag, type BondId, type GiftId, type GiftKind } from '../world/bonds'
import './GiftPanel.css'

// 送禮面板（DESIGN §27.2）：選要送的東西、看好感度和已經知道的喜好。
// 開關在 world/bonds.ts 的 giftUI（不佔用主 store 的 panel）。托夢給小翰時也在這裡畫夢的邊框。

const ORDER = Object.keys(INGREDIENTS) as Ingredient[]

const REACT: Record<GiftKind, { text: string; cls: string }> = {
  like: { text: '好喜歡！', cls: 'like' },
  neutral: { text: '收下了', cls: 'neutral' },
  dislike: { text: '不太喜歡……', cls: 'dislike' },
}

export function GiftPanel() {
  const npc = useSyncExternalStore(giftUI.subscribe, giftUI.get)
  return (
    <>
      <HanDreamFrame />
      {npc && <Panel key={npc} npc={npc} />}
    </>
  )
}

function Face({ npc }: { npc: BondId }) {
  const d = BONDS[npc]
  if ((PORTRAIT_IDS as readonly string[]).includes(npc)) return <img className="gift-face" src={portraitDataUrl(npc as PortraitId, 'happy')} alt="" draggable={false} />
  return <span className={`gift-face gift-face-char ${d.ghost ? 'ghost' : ''}`}>{d.icon}</span>
}

function Panel({ npc }: { npc: BondId }) {
  const d = BONDS[npc]
  const meta = useStore((s) => s.meta)
  const flags = useStore((s) => s.flags)
  const [result, setResult] = useState<{ kind: GiftKind; before: number; after: number } | null>(null)
  const points = meta.bonds[npc] ?? 0
  const shown = result ? result.after : points
  const hearts = heartsOf(shown)
  const toNext = hearts >= 5 ? 1 : (shown % 20) / 20
  const gifted = !!flags[giftedFlag(npc)]

  const items: { id: GiftId; icon: string; name: string; count: number }[] = ORDER.filter((k) => (meta.pantry[k] ?? 0) > 0).map((k) => ({
    id: k,
    icon: INGREDIENTS[k].icon,
    name: INGREDIENTS[k].name,
    count: meta.pantry[k] ?? 0,
  }))
  if (d.ghost) items.push({ id: 'joss', icon: '🔥', name: '燒金紙', count: meta.merit })

  const close = () => {
    sfx.play('ui_cancel', { volume: 0.4 })
    giftUI.close()
  }

  // 送完：心跳一下，1.6 秒後關掉，再把到了的心（故事、回禮）給完
  useEffect(() => {
    if (!result) return
    const t = window.setTimeout(() => {
      giftUI.close()
      deliverPending(useStore, npc)
    }, 1600)
    return () => window.clearTimeout(t)
  }, [result, npc])

  // ESC 關掉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') giftUI.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 什麼都沒得送：阿嬤講一句
  useEffect(() => {
    if (!items.length && !gifted) useStore.getState().bark('bond.gm.nothing')
    // 只在打開時講一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const give = (g: GiftId) => {
    if (result || gifted) return
    const r = giveGift(useStore, npc, g)
    if (!r) return
    sfx.play(r.kind === 'dislike' ? 'ui_cancel' : 'pickup', { volume: 0.6 })
    setResult(r)
  }

  const knownLikes = d.likes.filter((g) => flags[knowFlag(npc, g)])
  const unknownLikes = d.likes.length - knownLikes.length
  const dislikeKnown = !!flags[knowFlag(npc, d.dislike)]
  const nameOf = (g: GiftId) => (g === 'joss' ? '金紙' : INGREDIENTS[g].name)
  const iconOf = (g: GiftId) => (g === 'joss' ? '🔥' : INGREDIENTS[g].icon)

  return (
    <div className="screen-backdrop" onClick={close}>
      <div className="sheet gift" onClick={(e) => e.stopPropagation()}>
        <div className="gift-head">
          <Face npc={npc} />
          <div className="gift-who">
            <div className="row between">
              <h2 className="sheet-title">{d.name}</h2>
              <button className="chip" onClick={close}>
                ✕
              </button>
            </div>
            <div className={`gift-hearts ${result ? `pop-${result.kind}` : ''}`}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < hearts ? 'on' : ''}>
                  {i < hearts ? '♥' : '♡'}
                </span>
              ))}
              <span className="gift-pts">{hearts >= 5 ? '滿了' : `${Math.round(toNext * 100)}%`}</span>
            </div>
            <div className="gift-bar">
              <i style={{ width: `${toNext * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="gift-likes">
          <span className="muted">喜歡：</span>
          {knownLikes.map((g) => (
            <span key={g} className="gift-tag like">
              {iconOf(g)} {nameOf(g)}
            </span>
          ))}
          {Array.from({ length: unknownLikes }, (_, i) => (
            <span key={`u${i}`} className="gift-tag unknown">
              ？
            </span>
          ))}
          {dislikeKnown && (
            <>
              <span className="muted">　不喜歡：</span>
              <span className="gift-tag dislike">
                {iconOf(d.dislike)} {nameOf(d.dislike)}
              </span>
            </>
          )}
        </div>
        <div className="muted gift-reward">
          2♥、4♥ 會聽到他的故事；3♥ 回禮：{d.reward}；5♥ 技能點 +1
        </div>

        {result ? (
          <div className={`gift-result ${REACT[result.kind].cls}`}>
            <span className="gift-result-text">{REACT[result.kind].text}</span>
            <span className="gift-result-pts">
              {GIFT_POINTS[result.kind] > 0 ? '+' : ''}
              {GIFT_POINTS[result.kind]}
            </span>
            {result.kind !== 'dislike' && (
              <span className="gift-float" aria-hidden>
                {'♥♥♥'.split('').map((h, i) => (
                  <i key={i} style={{ animationDelay: `${i * 0.18}s`, left: `${30 + i * 20}%` }}>
                    {h}
                  </i>
                ))}
              </span>
            )}
          </div>
        ) : gifted ? (
          <p className="gift-empty">今天已經送過了。明天再來。</p>
        ) : items.length ? (
          <div className="gift-items">
            {items.map((it) => {
              const known = flags[knowFlag(npc, it.id)]
              const kind = known ? giftKind(npc, it.id) : null
              const off = it.id === 'joss' && it.count < 1
              return (
                <button key={it.id} className={`gift-item ${kind ?? ''}`} disabled={off} onClick={() => give(it.id)}>
                  <span className="gift-item-icon">{it.icon}</span>
                  <span className="gift-item-name">{it.name}</span>
                  <span className="gift-item-count">{it.id === 'joss' ? `功德 1（剩 ${it.count}）` : `×${it.count}`}</span>
                  {kind === 'like' && <span className="gift-mark like">♥</span>}
                  {kind === 'dislike' && <span className="gift-mark dislike">✕</span>}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="gift-empty">身上沒有可以送的東西。去菜園、柑仔店、溪邊看看吧。</p>
        )}
      </div>
    </div>
  )
}

/** 托夢給小翰：對話的時候，畫面四周變成夢的顏色 */
function HanDreamFrame() {
  const on = useStore((s) => !!s.dialogue && s.dialogue.id.startsWith('bond_handream'))
  if (!on) return null
  return (
    <div className="han-dream-frame" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.6}s`, animationDuration: `${5 + (i % 4)}s` }} />
      ))}
    </div>
  )
}
