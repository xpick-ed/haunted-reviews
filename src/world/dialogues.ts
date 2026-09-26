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
  // 溪邊玩水的小鬼（src/data/river.lines.json）
  guikids_river: {
    steps: [
      { line: 'guikid1.hi.1' },
      { line: 'river.kids.gm.1' },
      { line: 'guikid2.hi.1' },
      { line: 'guikid1.hi.2' },
      { line: 'river.kids.gm.2' },
      { line: 'guikid2.hi.2' },
      { line: 'river.kids.gm.3', set: 'guikids_met' },
    ],
  },
  // 廟埕野台戲（src/data/stage.lines.json）
  banzhu_1: {
    unseen: true,
    steps: [{ line: 'banzhu.1' }, { line: 'stage.gm.1' }, { line: 'banzhu.2' }, { line: 'banzhu.3' }, { line: 'stage.gm.2' }, { line: 'banzhu.4', set: 'banzhu_met' }],
  },

  // 山上墓仔埔（src/data/hill.lines.json，DESIGN §26）
  hill_agong_first: {
    steps: [{ line: 'hill.agong.first.1' }, { line: 'hill.agong.first.2' }, { line: 'hill.agong.first.3' }, { line: 'hill.agong.first.4', set: 'hill_agong_first' }],
  },
  hill_qingming: {
    unseen: true,
    steps: [
      { line: 'hill.qm.1' },
      { line: 'hill.qm.2' },
      { line: 'hill.qm.3' },
      { line: 'hill.qm.4' },
      { line: 'hill.qm.5' },
      { line: 'hill.qm.6' },
      { line: 'hill.qm.7' },
      { line: 'hill.qm.8' },
      { line: 'hill.qm.9', set: 'qingming_seen' },
    ],
  },
  huobo_1: {
    steps: [{ line: 'huobo.1.1' }, { line: 'hill.gm.intro' }, { line: 'huobo.1.2' }, { line: 'huobo.1.3' }, { line: 'huobo.1.4', set: 'huobo_met' }],
  },
  huobo_2: {
    steps: [{ line: 'huobo.2.1' }, { line: 'huobo.2.2' }, { line: 'huobo.2.3' }, { line: 'huobo.2.4', set: 'huobo_ask_opera' }],
  },
  huobo_3: {
    steps: [
      { line: 'hill.gm.opera' },
      {
        line: 'huobo.3.1',
        choices: [
          { line: 'hill.gm.opera.tell', goto: 'tell' },
          { line: 'hill.gm.opera.sing', goto: 'sing' },
        ],
      },
      { label: 'tell', line: 'hill.gm.opera.tell' },
      { line: 'huobo.3.tell', goto: 'end' },
      { label: 'sing', line: 'hill.gm.opera.sing' },
      { line: 'huobo.3.sing' },
      { label: 'end', line: 'huobo.3.2' },
      { line: 'huobo.3.3', set: 'huobo_done' },
    ],
  },
  yuyi_1: {
    steps: [{ line: 'yuyi.1.1' }, { line: 'hill.gm.yuyi' }, { line: 'yuyi.1.2' }, { line: 'yuyi.1.3' }, { line: 'yuyi.1.4', set: 'yuyi_met' }],
  },
  yuyi_2: {
    steps: [
      { line: 'hill.gm.gossip' },
      { line: 'yuyi.2.1' },
      {
        line: 'yuyi.2.ask',
        choices: [
          { line: 'hill.gm.gossip.fridge', goto: 'fridge' },
          { line: 'hill.gm.gossip.miss', goto: 'miss' },
        ],
      },
      { label: 'fridge', line: 'hill.gm.gossip.fridge' },
      { line: 'yuyi.2.fridge', goto: 'secret' },
      { label: 'miss', line: 'hill.gm.gossip.miss' },
      { line: 'yuyi.2.miss1' },
      { line: 'yuyi.2.miss2' },
      { label: 'secret', line: 'yuyi.2.2' },
      { line: 'yuyi.2.3' },
      { line: 'hill.gm.really' },
      { line: 'yuyi.2.4', set: 'yuyi_done' },
    ],
  },
  // 廢棄國小：第一次遇到小孩鬼（src/data/school.lines.json）
  school_kids_1: {
    steps: [
      { line: 'school.meet.1' },
      { line: 'school.meet.2' },
      { line: 'school.meet.3' },
      { line: 'school.meet.4' },
      { line: 'school.meet.5' },
      { line: 'school.meet.6' },
      { line: 'school.meet.7', set: 'school_kids_met' },
    ],
  },
}

export function indexOfLabel(d: Dialogue, label: string) {
  const i = d.steps.findIndex((s) => s.label === label)
  return i < 0 ? d.steps.length : i
}
