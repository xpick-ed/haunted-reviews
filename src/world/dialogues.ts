import { DIALOGUE_LINES } from '../data/barks'

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
  xiaoyu_play: { steps: DIALOGUE_LINES.xiaoyu_play.map((line) => ({ line })) },
  agui_chat: { steps: DIALOGUE_LINES.agui_chat.map((line) => ({ line })) },
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
  // 柑仔店的阿嬌（村路，DESIGN §25）：看得到阿嬤的老朋友
  ajiao_first: {
    steps: [
      { line: 'ajiao.first.1' },
      { line: 'ajiao.first.2' },
      {
        line: 'ajiao.first.3',
        choices: [
          { line: 'ajiao.q.see', goto: 'see' },
          { line: 'ajiao.q.buy', goto: 'buy' },
        ],
      },
      { label: 'see', line: 'ajiao.q.see' },
      { line: 'ajiao.see' },
      { line: 'ajiao.first.4', goto: 'shop' },
      { label: 'buy', line: 'ajiao.q.buy' },
      { line: 'ajiao.first.4' },
      { label: 'shop', line: 'ajiao.first.5' },
      { line: 'ajiao.first.6', set: 'ajiao_met' },
    ],
  },
  // 鬼夜市（src/data/market.lines.json）
  hongyi_1: {
    steps: [
      { line: 'hongyi.1' },
      { line: 'market.gm.1' },
      { line: 'hongyi.2' },
      { line: 'hongyi.3' },
      { line: 'market.gm.2' },
      { line: 'hongyi.4' },
      { line: 'hongyi.5', set: 'hongyi_met' },
    ],
  },
  jinyubo_1: { steps: [{ line: 'jinyubo.1' }, { line: 'market.gm.3' }, { line: 'jinyubo.2', set: 'jinyubo_met' }] },
}

export function indexOfLabel(d: Dialogue, label: string) {
  const i = d.steps.findIndex((s) => s.label === label)
  return i < 0 ? d.steps.length : i
}
