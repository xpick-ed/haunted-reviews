import { useStore } from '../store'
import { GUESTS } from '../world/night/guests'
import { FESTIVAL_NAME, NIGHTS_PER_MONTH, SKILLS, festivalOf, type SkillDef } from '../world/night/plan'
import { line } from '../world/lines'
import { portraitDataUrl, type PortraitId } from '../art/portraits'
import type { NightEvent } from '../world/night/types'

// 深夜前後的畫面：入住卡片（傍晚）、技能樹、天亮結算、月底報告（DESIGN §9–§13）。

const EVENT_INFO: Record<NightEvent, { name: string; desc: string } | null> = {
  none: null,
  dog: { name: '小黑亂叫', desc: '圍牆外的狗半夜會叫，吵醒淺眠的人。過去摸摸牠。' },
  blackout: { name: '颱風停電', desc: '半夜會停電、打雷。怕黑的人需要燈。' },
  mosquitoes: { name: '蚊子大軍', desc: '今晚蚊子特別多，記得點蚊香。' },
  coldsnap: { name: '寒流', desc: '半夜會變冷，被子、關窗很重要。' },
  miaogong: { name: '廟公巡夜', desc: '差評太多，廟公拿著手電筒來抓鬼。被照到三次就會被收驚。' },
}

export function monthNight(n: number) {
  return { month: Math.floor((n - 1) / NIGHTS_PER_MONTH) + 1, night: ((n - 1) % NIGHTS_PER_MONTH) + 1 }
}

const ROOM_NAME = { r1: '客房一', r2: '客房二' } as const

function Stars({ n, delay = 0 }: { n: number; delay?: number }) {
  return (
    <span className="review-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`star ${i <= n ? 'on' : ''}`} style={{ animationDelay: `${delay + i * 0.12}s` }}>
          ★
        </span>
      ))}
    </span>
  )
}

function Face({ id, mood = 'normal' }: { id: string; mood?: 'normal' | 'happy' | 'surprised' }) {
  return <img className="face" src={portraitDataUrl(id as PortraitId, mood)} alt="" draggable={false} />
}

// ---------------------------------------------------------------------------
// 今晚入住
// ---------------------------------------------------------------------------

export function NightIntro() {
  const plan = useStore((s) => s.plan)
  const meta = useStore((s) => s.meta)
  const close = useStore((s) => s.closeIntro)
  const openPanel = useStore((s) => s.openPanel)
  const mn = monthNight(meta.night)
  const ev = EVENT_INFO[plan.event]
  const fest = festivalOf(meta.night)
  const FEST_DESC = {
    tudigong: '土地公廟前搭了歌仔戲台，今晚人鬼一起看戲。',
    qingming: '家人上山掃墓的日子。小翰傍晚去了墓仔埔。',
    zhongyuan: '好兄弟們放假的日子：廟埕有戲、溪邊放水燈。',
  }
  return (
    <div className="screen-backdrop">
      <div className="sheet intro-card">
        <div className="sheet-kicker">
          第 {mn.month} 個月 · 第 {mn.night} 晚
        </div>
        <h2 className="sheet-title">今晚入住</h2>
        {plan.parties.map((p) => (
          <div key={p.room} className="party">
            <div className="party-room">{ROOM_NAME[p.room]}</div>
            {p.members.map((id) => {
              const g = GUESTS[id]
              return (
                <div key={id} className="party-guest">
                  <Face id={id} />
                  <div className="party-info">
                    <div className="row between">
                      <b>{g.name}</b>
                      <span className="muted">
                        {g.label} · ${g.pay.toLocaleString()}
                      </span>
                    </div>
                    {g.seesGhost && <span className="badge ghost">看得到阿嬤</span>}
                    {g.type === 'thrill' && <span className="badge scare">想被嚇</span>}
                    <ul className="clues">
                      {g.clues.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {fest && (
          <div className="event-box festival">
            <b>🏮 {FESTIVAL_NAME[fest]}</b>
            <span>{FEST_DESC[fest]}</span>
          </div>
        )}
        {ev && (
          <div className="event-box">
            <b>⚠ {ev.name}</b>
            <span>{ev.desc}</span>
          </div>
        )}
        <div className="meta-strip">
          <span>💰 {meta.money.toLocaleString()}</span>
          <span className="warm-c">溫馨 {meta.warm}</span>
          <span className="spooky-c">靈異 {meta.spooky}</span>
          <span>❤️ {meta.heart}</span>
        </div>
        <div className="sheet-buttons">
          <button className={`btn ${meta.skillPts > 0 ? 'glow' : ''}`} onClick={() => openPanel('skills')}>
            技能{meta.skillPts > 0 ? `（${meta.skillPts} 點）` : ''}
          </button>
          <button className="btn primary" onClick={close}>
            好，準備
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 技能樹
// ---------------------------------------------------------------------------

const LINES: { id: SkillDef['line']; name: string; cls: string }[] = [
  { id: 'kind', name: '慈祥', cls: 'kind' },
  { id: 'scare', name: '嚇人', cls: 'scare' },
  { id: 'ghost', name: '鬼術', cls: 'ghost' },
  { id: 'spirit', name: '靈術', cls: 'spirit' },
]

export function SkillTree() {
  const meta = useStore((s) => s.meta)
  const learn = useStore((s) => s.learnSkill)
  const openPanel = useStore((s) => s.openPanel)
  return (
    <div className="screen-backdrop" onClick={() => openPanel(null)}>
      <div className="sheet skills" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2 className="sheet-title">阿嬤的本事</h2>
          <span className="pts">技能點 {meta.skillPts}</span>
        </div>
        <div className="skill-lines">
          {LINES.map((l) => (
            <div key={l.id} className={`skill-line ${l.cls}`}>
              <div className="skill-line-name">{l.name}</div>
              {SKILLS.filter((k) => k.line === l.id).map((k) => {
                const has = meta.skills.includes(k.id)
                const unlocked = !k.requires || meta.skills.includes(k.requires)
                const can = !has && unlocked && meta.skillPts >= k.cost
                return (
                  <button key={k.id} className={`skill ${has ? 'has' : can ? 'can' : unlocked ? '' : 'locked'}`} disabled={!can} onClick={() => learn(k.id)}>
                    <span className="skill-name">
                      {has ? '✓ ' : unlocked ? '' : '🔒 '}
                      {k.name}
                    </span>
                    <span className="skill-desc">{k.desc}</span>
                    {!has && <span className="skill-cost">{k.cost} 點</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <p className="muted">每晚至少得 1 點；五星評論、完成挑戰會多給。</p>
        <button className="btn primary" onClick={() => openPanel(null)}>
          好
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 天亮結算
// ---------------------------------------------------------------------------

const delta = (v: number) => (v > 0 ? `+${v}` : `${v}`)

export function NightSummaryCard() {
  const sum = useStore((s) => s.summary)
  const close = useStore((s) => s.closeSummary)
  if (!sum) return null
  return (
    <div className="screen-backdrop">
      <div className="sheet summary">
        <div className="sheet-kicker">天亮了</div>
        <h2 className="sheet-title">客人的評論</h2>
        <div className="reviews">
          {sum.reviews.map((r, i) => (
            <div key={r.id} className="mini-review" style={{ animationDelay: `${i * 0.25}s` }}>
              <Face id={r.id} mood={r.stars >= 4 ? 'happy' : r.stars <= 2 ? 'surprised' : 'normal'} />
              <div className="mini-review-body">
                <div className="row between">
                  <b>{r.name}</b>
                  <Stars n={r.stars} delay={i * 0.25} />
                </div>
                <p>{r.text}</p>
                <span className="muted">付了 ${r.pay.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="summary-grid">
          <div>
            <h3>今晚挑戰</h3>
            <ul className="challenges big">
              {sum.challenges.map((c) => (
                <li key={c.id} className={c.done ? 'done' : 'failed'}>
                  <span className="tick">{c.done ? '✓' : '✗'}</span>
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>紀錄</h3>
            <ul className="stat-list">
              <li>被看到 {sum.stats.seen} 次</li>
              <li>好險 {sum.stats.nearmiss} 次</li>
              <li>吵醒人 {sum.stats.woken} 次</li>
              {sum.stats.captures > 0 && <li>被拍到 {sum.stats.captures} 次</li>}
              {sum.stats.mgCatches > 0 && <li>被廟公照到 {sum.stats.mgCatches} 次</li>}
            </ul>
          </div>
        </div>
        <div className="meta-strip">
          <span>💰 +{sum.income.toLocaleString()}</span>
          <span className="warm-c">溫馨 {delta(sum.warmDelta)}</span>
          <span className="spooky-c">靈異 {delta(sum.spookyDelta)}</span>
          <span>❤️ {delta(sum.heartDelta)}</span>
          <span>技能點 +{sum.points}</span>
          {sum.merit > 0 && <span className="merit-c">功德 +{sum.merit}</span>}
        </div>
        {sum.pressureDelta > 0 && <p className="warn">差評傳到廟公那裡了……（壓力 {delta(sum.pressureDelta)}）</p>}
        <button className="btn primary big" onClick={close}>
          {sum.monthEnd ? '看這個月的帳' : '下一晚'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 月底
// ---------------------------------------------------------------------------

export function MonthSummary() {
  const m = useStore((s) => s.month)
  const close = useStore((s) => s.closeMonth)
  if (!m) return null
  const net = m.income - m.cost
  const han = m.line ? line(m.line).text : ''
  return (
    <div className="screen-backdrop">
      <div className="sheet month">
        <div className="sheet-kicker">第 {m.month + 1} 個月結束</div>
        <h2 className="sheet-title">小翰的帳本</h2>
        <table className="ledger">
          <tbody>
            <tr>
              <td>這個月收入</td>
              <td className="plus">+{m.income.toLocaleString()}</td>
            </tr>
            <tr>
              <td>房貸、水電</td>
              <td className="minus">−{m.cost.toLocaleString()}</td>
            </tr>
            <tr className="total">
              <td>結餘</td>
              <td className={net >= 0 ? 'plus' : 'minus'}>{net.toLocaleString()}</td>
            </tr>
            <tr>
              <td>存款</td>
              <td>{m.money.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        <div className="rep">
          <div className="meter-row">
            <span className="label">溫馨</span>
            <div className="meter warm">
              <i style={{ width: `${m.warm}%` }} />
            </div>
            <span className="num">{m.warm}</span>
          </div>
          <div className="meter-row">
            <span className="label">靈異</span>
            <div className="meter fear">
              <i style={{ width: `${m.spooky}%` }} />
            </div>
            <span className="num">{m.spooky}</span>
          </div>
          <div className="meter-row">
            <span className="label">小翰</span>
            <div className="meter">
              <i style={{ width: `${m.heart}%` }} />
            </div>
            <span className="num">{m.heart}</span>
          </div>
          <p className="muted">溫馨名聲高，會來更多家庭和老人；靈異名聲高，會來更多 YouTuber。</p>
        </div>
        {m.deadline && (
          <div className="event-box festival">
            <b>🏠 小翰的決定</b>
            <span>第 12 晚的月底前：存款 30,000、小翰的心 60 以上，他就不賣三合院。</span>
          </div>
        )}
        {(m.debtMonths ?? 0) >= 1 && (
          <div className="event-box">
            <b>⚠ 存款是負的</b>
            <span>{m.debtMonths === 1 ? '下個月底再負債，小翰就撐不下去了。' : '連兩個月負債了……'}</span>
          </div>
        )}
        {han && (
          <div className="han-line">
            <Face id="xiaohan" />
            <span>「{han}」</span>
          </div>
        )}
        <h3>老宅升級（阿嬤托夢給小翰）</h3>
        <div className="offers">
          {m.offers.map((u) => (
            <button key={u.id} className="offer" disabled={m.money < u.cost} onClick={() => close(u.id)}>
              <b>{u.name}</b>
              <span>{u.desc}</span>
              <span className="price">${u.cost.toLocaleString()}</span>
            </button>
          ))}
          {!m.offers.length && <span className="muted">都買齊了！</span>}
        </div>
        <button className="btn big" onClick={() => close(null)}>
          先不買，存起來
        </button>
      </div>
    </div>
  )
}
