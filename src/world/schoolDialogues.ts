import { DIALOGUES, type Dialogue } from './dialogues'

// 廢棄國小另外三間（圖書室、保健室、教師辦公室，DESIGN §30）的對話。台詞在 src/data/school2.lines.json。
// 跟 bonds.ts 一樣，在這裡登記進 DIALOGUES（sceneSchool.ts 匯入這個檔案）。

const seq = (ids: string[], set?: string): Dialogue => ({ steps: ids.map((line, i) => ({ line, ...(set && i === ids.length - 1 ? { set } : {}) })) })

export const SCHOOL_DIALOGUES: Record<string, Dialogue> = {
  // 借書卡片櫃：陳春借了《小婦人》沒還
  school_card: seq(['school2.card.1', 'school2.card.2', 'school2.card.3', 'school2.card.4', 'school2.card.6', 'school2.card.5'], 'school_card_seen'),
  // 閱覽桌：唸故事給小孩鬼聽（三選一）
  school_story: {
    steps: [
      {
        line: 'school2.story.ask',
        choices: [
          { line: 'school2.story.pick.hu', goto: 'hu' },
          { line: 'school2.story.pick.peach', goto: 'peach' },
          { line: 'school2.story.pick.monkey', goto: 'monkey' },
        ],
      },
      { label: 'hu', line: 'school2.story.pick.hu' },
      { line: 'school2.story.hu.1' },
      { line: 'school2.story.hu.2' },
      { line: 'school2.story.hu.3' },
      { line: 'school2.story.hu.4', goto: 'end' },
      { label: 'peach', line: 'school2.story.pick.peach' },
      { line: 'school2.story.peach.1' },
      { line: 'school2.story.peach.2' },
      { line: 'school2.story.peach.3' },
      { line: 'school2.story.peach.4', goto: 'end' },
      { label: 'monkey', line: 'school2.story.pick.monkey' },
      { line: 'school2.story.monkey.1' },
      { line: 'school2.story.monkey.2' },
      { line: 'school2.story.monkey.3' },
      { line: 'school2.story.monkey.4' },
      { label: 'end', line: 'school2.story.end' },
    ],
  },
  // 保健室的護士阿姨（陰陽眼）
  school_nurse_first: seq(['school2.nurse.first.1', 'school2.nurse.first.2', 'school2.nurse.first.3', 'school2.nurse.first.4', 'school2.nurse.first.5', 'school2.nurse.first.6'], 'school_nurse_met'),
  // 幫跌倒的阿弟仔擦紅藥水
  school_redmed: seq(['school2.redmed.1', 'school2.redmed.2', 'school2.redmed.3', 'school2.redmed.4', 'school2.redmed.5']),
  // 點名簿：第一次翻、之後幫小孩鬼點名
  school_roll: seq(['school2.roll.1', 'school2.roll.2', 'school2.roll.3', 'school2.roll.4', 'school2.roll.5', 'school2.roll.6'], 'school_roll_seen'),
  school_call: seq(['school2.call.1', 'school2.call.2', 'school2.call.3', 'school2.call.4', 'school2.call.5', 'school2.call.6', 'school2.call.7']),
}
Object.assign(DIALOGUES, SCHOOL_DIALOGUES)
