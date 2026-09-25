import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { DIALOGUES } from '../world/dialogues'
import { line, nameOf } from '../world/lines'
import { voice } from '../audio/voice'
import { PORTRAIT_IDS, portraitDataUrl, type PortraitId } from '../art/portraits'

// RPG 對話框（DESIGN §20）：頭像、名字、逐字顯示、語音、選項。
// 對方看不到阿嬤時，阿嬤的台詞標「聽不到」。

const CPS = 22 // 每秒幾個字

export function DialogueBox() {
  const dialogue = useStore((s) => s.dialogue)
  const skip = useStore((s) => s.skipTyping)
  const choiceIndex = useStore((s) => s.choiceIndex)
  const [shown, setShown] = useState(0)
  const startSkip = useRef(skip)

  const d = dialogue ? DIALOGUES[dialogue.id] : null
  const step = d && dialogue ? d.steps[dialogue.i] : null
  const l = step ? line(step.line) : null
  const text = l?.text ?? ''
  const done = shown >= text.length

  // 換句：從頭開始打字
  useEffect(() => {
    setShown(0)
    startSkip.current = useStore.getState().skipTyping
  }, [dialogue?.id, dialogue?.i])

  // 打字（沒有語音檔的句子用角色的「嗶嗶」聲）
  useEffect(() => {
    if (!l || done) return
    const hasVoice = voice.has(step!.line)
    const t = window.setTimeout(() => {
      setShown((n) => Math.min(text.length, n + 1))
      if (!hasVoice && useStore.getState().voice && /\S/.test(text[shown] ?? '')) voice.blip(l.who)
    }, 1000 / CPS)
    return () => window.clearTimeout(t)
  }, [shown, done, l, text, step])

  // 按鍵要求跳過打字
  useEffect(() => {
    if (skip !== startSkip.current) setShown(text.length)
  }, [skip, text.length])

  useEffect(() => {
    useStore.setState({ typing: !done })
  }, [done])

  // 選項：上下鍵選
  useEffect(() => {
    if (!step?.choices || !done) return
    const n = step.choices.length
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'arrowup' || k === 'w') useStore.setState({ choiceIndex: (useStore.getState().choiceIndex + n - 1) % n })
      if (k === 'arrowdown' || k === 's') useStore.setState({ choiceIndex: (useStore.getState().choiceIndex + 1) % n })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, done])

  if (!d || !step || !l) return null
  const who = l.who
  const hasPortrait = (PORTRAIT_IDS as readonly string[]).includes(who)
  const unheard = d.unseen && who === 'grandma'
  const onBoxTap = () => {
    if (step.choices && done) return
    useStore.getState().interact()
  }

  return (
    <div className="dialogue-wrap">
      {step.choices && done && (
        <div className="choices">
          {step.choices.map((c, i) => (
            <button
              key={c.goto}
              className={`choice ${i === choiceIndex ? 'on' : ''}`}
              onPointerEnter={() => useStore.setState({ choiceIndex: i })}
              onClick={() => useStore.getState().choose(i)}
            >
              {line(c.line).text}
            </button>
          ))}
        </div>
      )}
      <div className={`dialogue who-${who}`} onClick={onBoxTap}>
        <div className="portrait">
          {hasPortrait ? <img src={portraitDataUrl(who as PortraitId)} alt="" draggable={false} /> : <span>{nameOf(who).slice(0, 1)}</span>}
        </div>
        <div className="dialogue-body">
          <div className="dialogue-name">
            {nameOf(who)}
            {unheard && <span className="unheard">他聽不到</span>}
          </div>
          <div className="dialogue-text">
            {text.slice(0, shown)}
            <span className="ghost-text">{text.slice(shown)}</span>
          </div>
        </div>
        {done && !step.choices && <div className="dialogue-next">▼</div>}
      </div>
    </div>
  )
}
