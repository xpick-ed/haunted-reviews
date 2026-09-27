import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { GRADE_NAME, MERIT_GOOD, MERIT_OK, useCh, type MonthReview } from '../world/sceneChenghuang'
import { chAbacus, chStamp } from '../scene/ChenghuangSound'
import './ChenghuangHud.css'

// 城隍廟的 HUD（DESIGN §32.2）：號碼牌小卡（您的號碼／現在叫號／現在該做什麼）；
// 判官考核時攤開「居留考核表」，講到總評時寫上甲乙丙丁，講到「准」時蓋一個紅色的大印。

const pad = (n: number) => String(n).padStart(4, '0')
const MARK = ['△', '○', '◎']

export function ChenghuangHud() {
  const here = useStore((s) => s.scene === 'chenghuang')
  const step = useStore((s) => (s.dialogue?.id === 'ch_review' ? s.dialogue.i : -1))
  const c = useCh()
  if (!here || !c.report) return null
  if (step >= 0 && c.review) return <Sheet r={c.review} step={step} />
  return <TicketCard ticket={c.ticket} now={c.now} called={c.called} stamped={c.stamped} />
}

function TicketCard({ ticket, now, called, stamped }: { ticket: number; now: number; called: boolean; stamped: boolean }) {
  const hint = stamped ? '章蓋好了，從廟門回家' : !ticket ? '先到門口的機器抽號碼牌' : !called ? '坐著等叫號（跟排隊的鬼聊聊，時間過得比較快）' : '叫到妳了！到判官桌前報到'
  return (
    <div className={`ch-card ${called && !stamped ? 'go' : ''}`}>
      <div className="ch-nums">
        <div>
          <span className="ch-k">您的號碼</span>
          <b className="ch-mine">{ticket ? pad(ticket) : '----'}</b>
        </div>
        <div>
          <span className="ch-k">現在叫號</span>
          <b className="ch-now">{pad(now)}</b>
        </div>
      </div>
      <div className="ch-hint">{hint}</div>
    </div>
  )
}

function Sheet({ r, step }: { r: MonthReview; step: number }) {
  const gradeAt = r.lines.findIndex((l) => l.startsWith('ch.pg.grade.'))
  const stampAt = r.lines.indexOf('ch.pg.stamp')
  const showGrade = step >= gradeAt
  const stamped = stampAt >= 0 && step >= stampAt
  // 攤開的時候打一串算盤；蓋章那一下「碰」
  const played = useRef({ abacus: false, stamp: false })
  useEffect(() => {
    if (!played.current.abacus) {
      played.current.abacus = true
      chAbacus()
    }
  }, [])
  useEffect(() => {
    if (stamped && !played.current.stamp) {
      played.current.stamp = true
      chStamp()
    }
  }, [stamped])
  const rows: { label: string; value: string; score: number; at: string }[] = [
    { label: '照顧客人的功德', value: `${r.sheet.merit} 點`, score: r.scores.merit, at: 'ch.pg.merit.' },
    { label: '陽間的評價', value: `溫馨 ${r.sheet.warm}`, score: r.scores.warm, at: 'ch.pg.warm.' },
    { label: '孫仔的心', value: `${r.sheet.heart}`, score: r.scores.heart, at: 'ch.pg.heart.' },
    { label: '厝的帳', value: `$${r.sheet.money.toLocaleString()}`, score: r.scores.money, at: 'ch.pg.money.' },
  ]
  const reward = [r.reward.skillPts ? `技能點 +${r.reward.skillPts}` : '', r.reward.merit ? `功德 +${r.reward.merit}` : ''].filter(Boolean).join('、') || '沒有（下個月加油）'
  return (
    <div className="ch-sheet">
      <div className="ch-sheet-head">
        <span>陰陽戶政事務所</span>
        <b>居留考核表</b>
      </div>
      <div className="ch-sheet-who">
        姓名：陳春　　第 {r.month + 1} 個月
      </div>
      <table>
        <tbody>
          {rows.map((row) => {
            const at = r.lines.findIndex((l) => l.startsWith(row.at))
            const shown = step >= at
            return (
              <tr key={row.label} className={shown ? 'on' : ''}>
                <td>{row.label}</td>
                <td className="v">{shown ? row.value : ''}</td>
                <td className={`m s${row.score}`}>{shown ? MARK[row.score] : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="ch-grade">
        <span>總評</span>
        <b className={showGrade ? 'on' : ''}>{showGrade ? GRADE_NAME[r.grade] : '　'}</b>
        {showGrade && <span className="ch-reward">獎勵：{reward}</span>}
      </div>
      <div className="ch-foot">
        功德：◎ {MERIT_GOOD} 點以上、○ {MERIT_OK} 點以上
      </div>
      {stamped && <div className="ch-stamp">准</div>}
    </div>
  )
}
