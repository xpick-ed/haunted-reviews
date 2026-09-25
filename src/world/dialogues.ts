// 對話腳本。每一步是一句台詞（id 對到 *.lines.json）；可以有選項跳到標籤，或在結束時設旗標。
// unseen：對方看不到阿嬤，阿嬤的台詞會標「聽不到」（DESIGN §20）。

export interface Choice {
  /** 選項顯示的文字取自這句台詞（選了之後會接著說出來） */
  line: string
  goto: string
}

export interface Step {
  line: string
  label?: string
  goto?: string
  choices?: Choice[]
  /** 走到這一步時設的旗標 */
  set?: string
}

export interface Dialogue {
  steps: Step[]
  unseen?: boolean
}

export const DIALOGUES: Record<string, Dialogue> = {
  han_dusk: {
    unseen: true,
    steps: [{ line: 'han.dusk.1' }, { line: 'han.dusk.2' }, { line: 'han.dusk.3' }, { line: 'han.dusk.4' }, { line: 'han.dusk.5', set: 'han_talk' }],
  },
  han_again: { unseen: true, steps: [{ line: 'han.again' }] },
  gm_photo: { steps: [{ line: 'gm.photo.1' }, { line: 'gm.photo.2' }, { line: 'gm.photo.3', set: 'photo_seen' }] },
  ayi_1: {
    steps: [
      { line: 'ayi.1' },
      { line: 'ayi.2' },
      { line: 'ayi.3' },
      {
        line: 'ayi.4',
        choices: [
          { line: 'ayi.no', goto: 'no' },
          { line: 'ayi.how', goto: 'how' },
        ],
      },
      { label: 'no', line: 'ayi.no' },
      { line: 'ayi.5a', goto: 'end' },
      { label: 'how', line: 'ayi.how' },
      { line: 'ayi.5b' },
      { line: 'ayi.6b' },
      { label: 'end', line: 'ayi.7', set: 'ayi_met' },
    ],
  },
  ayi_again: { steps: [{ line: 'ayi.again' }] },
}

export function indexOfLabel(d: Dialogue, label: string) {
  const i = d.steps.findIndex((s) => s.label === label)
  return i < 0 ? d.steps.length : i
}
