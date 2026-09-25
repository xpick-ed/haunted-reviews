// 深夜玩法的台詞對照表（由台詞檔 src/data/guests.lines.json 產生，id 一定存在）。
// 每個 key 是一串台詞 id，程式隨機挑一句播；語音在 public/voice/<id>.mp3。
// 改台詞：改 guests.lines.json 的文字，再跑 scripts/gen_voices.py 重新生成語音。

import type { ActionId, BarkKind, GuestId } from '../world/night/types'

/** 客人在各種情況下會講的話 */
export const BARKS: Record<GuestId, Partial<Record<BarkKind, string[]>>> = {
  "xiaomei": {
    "arrive": [
      "xiaomei.arrive.1"
    ],
    "idle": [
      "xiaomei.idle.1",
      "xiaomei.idle.2",
      "xiaomei.idle.3"
    ],
    "sleepy": [
      "xiaomei.sleepy.1"
    ],
    "bathroom": [
      "xiaomei.bathroom.1"
    ],
    "woken": [
      "xiaomei.woken.1"
    ],
    "hear": [
      "xiaomei.hear.1",
      "xiaomei.hear.2"
    ],
    "suspect": [
      "xiaomei.suspect.1"
    ],
    "seen": [
      "xiaomei.seen.1",
      "xiaomei.seen.2"
    ],
    "door": [
      "xiaomei.door.1"
    ],
    "thanks": [
      "xiaomei.thanks.1",
      "xiaomei.thanks.2"
    ],
    "morning": [
      "xiaomei.morning.1"
    ],
    "need_cold": [
      "xiaomei.need_cold.1"
    ],
    "need_thirsty": [
      "xiaomei.need_thirsty.1"
    ],
    "need_mosquito": [
      "xiaomei.need_mosquito.1"
    ],
    "need_dark": [
      "xiaomei.need_dark.1"
    ],
    "need_insomnia": [
      "xiaomei.need_insomnia.1"
    ]
  },
  "akai": {
    "arrive": [
      "akai.arrive.1"
    ],
    "idle": [
      "akai.idle.1",
      "akai.idle.2",
      "akai.idle.3"
    ],
    "sleepy": [
      "akai.sleepy.1"
    ],
    "bathroom": [
      "akai.bathroom.1"
    ],
    "woken": [
      "akai.woken.1"
    ],
    "hear": [
      "akai.hear.1",
      "akai.hear.2"
    ],
    "suspect": [
      "akai.suspect.1"
    ],
    "seen": [
      "akai.seen.1",
      "akai.seen.2"
    ],
    "door": [
      "akai.door.1"
    ],
    "thanks": [
      "akai.thanks.1",
      "akai.thanks.2"
    ],
    "morning": [
      "akai.morning.1"
    ],
    "need_cold": [
      "akai.need_cold.1"
    ],
    "need_thirsty": [
      "akai.need_thirsty.1"
    ],
    "need_mosquito": [
      "akai.need_mosquito.1"
    ],
    "need_scare": [
      "akai.need_scare.1",
      "akai.need_scare.2"
    ],
    "capture": [
      "akai.capture.1",
      "akai.capture.2",
      "akai.capture.3"
    ]
  },
  "zhang": {
    "arrive": [
      "zhang.arrive.1"
    ],
    "idle": [
      "zhang.idle.1",
      "zhang.idle.2",
      "zhang.idle.3"
    ],
    "sleepy": [
      "zhang.sleepy.1"
    ],
    "bathroom": [
      "zhang.bathroom.1"
    ],
    "woken": [
      "zhang.woken.1"
    ],
    "hear": [
      "zhang.hear.1",
      "zhang.hear.2"
    ],
    "suspect": [
      "zhang.suspect.1"
    ],
    "seen": [
      "zhang.seen.1",
      "zhang.seen.2"
    ],
    "door": [
      "zhang.door.1"
    ],
    "thanks": [
      "zhang.thanks.1",
      "zhang.thanks.2"
    ],
    "morning": [
      "zhang.morning.1"
    ],
    "need_cold": [
      "zhang.need_cold.1"
    ],
    "need_hot": [
      "zhang.need_hot.1"
    ],
    "need_thirsty": [
      "zhang.need_thirsty.1"
    ],
    "need_mosquito": [
      "zhang.need_mosquito.1"
    ],
    "need_insomnia": [
      "zhang.need_insomnia.1"
    ]
  },
  "ahao": {
    "arrive": [
      "ahao.arrive.1"
    ],
    "idle": [
      "ahao.idle.1",
      "ahao.idle.2",
      "ahao.idle.3"
    ],
    "sleepy": [
      "ahao.sleepy.1"
    ],
    "bathroom": [
      "ahao.bathroom.1"
    ],
    "woken": [
      "ahao.woken.1"
    ],
    "hear": [
      "ahao.hear.1",
      "ahao.hear.2"
    ],
    "suspect": [
      "ahao.suspect.1"
    ],
    "seen": [
      "ahao.seen.1",
      "ahao.seen.2"
    ],
    "door": [
      "ahao.door.1"
    ],
    "thanks": [
      "ahao.thanks.1",
      "ahao.thanks.2"
    ],
    "morning": [
      "ahao.morning.1"
    ],
    "need_cold": [
      "ahao.need_cold.1"
    ],
    "need_thirsty": [
      "ahao.need_thirsty.1"
    ],
    "need_mosquito": [
      "ahao.need_mosquito.1"
    ],
    "need_hungry": [
      "ahao.need_hungry.1"
    ]
  },
  "xiaoyu": {
    "arrive": [
      "xiaoyu.arrive.1"
    ],
    "idle": [
      "xiaoyu.idle.1",
      "xiaoyu.idle.2",
      "xiaoyu.idle.3"
    ],
    "sleepy": [
      "xiaoyu.sleepy.1"
    ],
    "bathroom": [
      "xiaoyu.bathroom.1"
    ],
    "woken": [
      "xiaoyu.woken.1"
    ],
    "hear": [
      "xiaoyu.hear.1",
      "xiaoyu.hear.2"
    ],
    "suspect": [
      "xiaoyu.suspect.1"
    ],
    "seen": [
      "xiaoyu.seen.1",
      "xiaoyu.seen.2"
    ],
    "door": [
      "xiaoyu.door.1"
    ],
    "thanks": [
      "xiaoyu.thanks.1",
      "xiaoyu.thanks.2"
    ],
    "morning": [
      "xiaoyu.morning.1"
    ],
    "need_cold": [
      "xiaoyu.need_cold.1"
    ],
    "need_thirsty": [
      "xiaoyu.need_thirsty.1"
    ],
    "need_mosquito": [
      "xiaoyu.need_mosquito.1"
    ],
    "need_play": [
      "xiaoyu.need_play.1"
    ]
  },
  "linmom": {
    "arrive": [
      "linmom.arrive.1"
    ],
    "idle": [
      "linmom.idle.1",
      "linmom.idle.2",
      "linmom.idle.3"
    ],
    "sleepy": [
      "linmom.sleepy.1"
    ],
    "bathroom": [
      "linmom.bathroom.1"
    ],
    "woken": [
      "linmom.woken.1"
    ],
    "hear": [
      "linmom.hear.1",
      "linmom.hear.2"
    ],
    "suspect": [
      "linmom.suspect.1"
    ],
    "seen": [
      "linmom.seen.1",
      "linmom.seen.2"
    ],
    "door": [
      "linmom.door.1"
    ],
    "thanks": [
      "linmom.thanks.1",
      "linmom.thanks.2"
    ],
    "morning": [
      "linmom.morning.1"
    ],
    "need_cold": [
      "linmom.need_cold.1"
    ],
    "need_thirsty": [
      "linmom.need_thirsty.1"
    ],
    "need_mosquito": [
      "linmom.need_mosquito.1"
    ],
    "need_dark": [
      "linmom.need_dark.1"
    ]
  },
  "agui": {
    "arrive": [
      "agui.arrive.1"
    ],
    "idle": [
      "agui.idle.1",
      "agui.idle.2",
      "agui.idle.3"
    ],
    "sleepy": [
      "agui.sleepy.1"
    ],
    "bathroom": [
      "agui.bathroom.1"
    ],
    "woken": [
      "agui.woken.1"
    ],
    "hear": [
      "agui.hear.1",
      "agui.hear.2"
    ],
    "suspect": [
      "agui.suspect.1"
    ],
    "seen": [
      "agui.seen.1",
      "agui.seen.2"
    ],
    "door": [
      "agui.door.1"
    ],
    "thanks": [
      "agui.thanks.1",
      "agui.thanks.2"
    ],
    "morning": [
      "agui.morning.1"
    ],
    "need_cold": [
      "agui.need_cold.1"
    ],
    "need_thirsty": [
      "agui.need_thirsty.1"
    ],
    "need_mosquito": [
      "agui.need_mosquito.1"
    ],
    "need_chat": [
      "agui.need_chat.1"
    ]
  },
  "atu": {
    "arrive": [
      "atu.arrive.1"
    ],
    "idle": [
      "atu.idle.1",
      "atu.idle.2",
      "atu.idle.3"
    ],
    "sleepy": [
      "atu.sleepy.1"
    ],
    "bathroom": [
      "atu.bathroom.1"
    ],
    "woken": [
      "atu.woken.1"
    ],
    "hear": [
      "atu.hear.1",
      "atu.hear.2"
    ],
    "suspect": [
      "atu.suspect.1"
    ],
    "seen": [
      "atu.seen.1",
      "atu.seen.2"
    ],
    "door": [
      "atu.door.1"
    ],
    "thanks": [
      "atu.thanks.1",
      "atu.thanks.2"
    ],
    "morning": [
      "atu.morning.1"
    ],
    "need_cold": [
      "atu.need_cold.1"
    ],
    "need_thirsty": [
      "atu.need_thirsty.1"
    ],
    "need_mosquito": [
      "atu.need_mosquito.1"
    ],
    "need_chat": [
      "atu.need_chat.1"
    ]
  }
}

/** 不在 BarkKind 裡的特殊台詞（例：林太太看到小宇對空氣講話） */
export const EXTRA_BARKS: Record<string, string[]> = {
  "linmom.worry": [
    "linmom.worry.1",
    "linmom.worry.2"
  ]
}

/** 阿嬤的短句：每個動作一兩句，加上被看到、差點被看到、端宵夜、陰氣不夠、木頭人、被拍到 */
export const GM_BARKS: Partial<Record<ActionId | 'seen' | 'nearmiss' | 'carry' | 'noyin' | 'freeze' | 'captured', string[]>> = {
  // 更多玩法（src/data/night2.lines.json）
  "swat": ["gm.swat.1", "gm.swat.2"],
  "radio": ["gm.radio.1", "gm.radio.2"],
  "possess": ["gm.possess.1", "gm.possess.2"],
  "hide": ["gm.hide.1", "gm.hide.2"],
  "dream": ["gm.dream.1", "gm.dream.2"],
  "tuck": [
    "gm.tuck.1",
    "gm.tuck.2"
  ],
  "temp": [
    "gm.temp.1",
    "gm.temp.2"
  ],
  "water": [
    "gm.water.1",
    "gm.water.2"
  ],
  "coil": [
    "gm.coil.1",
    "gm.coil.2"
  ],
  "nightlight": [
    "gm.nightlight.1",
    "gm.nightlight.2"
  ],
  "cook": [
    "gm.cook.1",
    "gm.cook.2"
  ],
  "deliver": [
    "gm.deliver.1",
    "gm.deliver.2"
  ],
  "pat": [
    "gm.pat.1",
    "gm.pat.2"
  ],
  "lullaby": [
    "gm.lullaby.1",
    "gm.lullaby.2"
  ],
  "window": [
    "gm.window.1",
    "gm.window.2"
  ],
  "flicker": [
    "gm.flicker.1",
    "gm.flicker.2"
  ],
  "rocker": [
    "gm.rocker.1",
    "gm.rocker.2"
  ],
  "knock": [
    "gm.knock.1",
    "gm.knock.2"
  ],
  "mirror": [
    "gm.mirror.1",
    "gm.mirror.2"
  ],
  "play": [
    "gm.play.1",
    "gm.play.2"
  ],
  "chat": [
    "gm.chat.1",
    "gm.chat.2"
  ],
  "seen": [
    "gm.seen.1",
    "gm.seen.2"
  ],
  "nearmiss": [
    "gm.nearmiss.1",
    "gm.nearmiss.2"
  ],
  "carry": [
    "gm.carry.1",
    "gm.carry.2"
  ],
  "noyin": [
    "gm.noyin.1",
    "gm.noyin.2"
  ],
  "freeze": [
    "gm.freeze.1",
    "gm.freeze.2"
  ],
  "captured": [
    "gm.captured.1",
    "gm.captured.2"
  ]
}

/** 廟公王伯巡夜 */
export const MIAOGONG_BARKS: { arrive: string[]; patrol: string[]; spot: string[]; catch: string[]; leave: string[] } = {
  "arrive": [
    "miaogong.arrive.1",
    "miaogong.arrive.2"
  ],
  "patrol": [
    "miaogong.patrol.1",
    "miaogong.patrol.2",
    "miaogong.patrol.3"
  ],
  "spot": [
    "miaogong.spot.1",
    "miaogong.spot.2"
  ],
  "catch": [
    "miaogong.catch.1",
    "miaogong.catch.2"
  ],
  "leave": [
    "miaogong.leave.1",
    "miaogong.leave.2"
  ]
}

/** 每晚突發事件開始時的旁白（阿嬤或小翰） */
export const EVENT_BARKS: { dog: string[]; blackout: string[]; mosquitoes: string[]; coldsnap: string[] } = {
  "dog": [
    "event.dog.1",
    "event.dog.2"
  ],
  "blackout": [
    "event.blackout.1",
    "event.blackout.2"
  ],
  "mosquitoes": [
    "event.mosquitoes.1",
    "event.mosquitoes.2"
  ],
  "coldsnap": [
    "event.coldsnap.1",
    "event.coldsnap.2"
  ]
}

/** 小翰：開第二間客房、月底結算、錢不夠、好月份 */
export const HAN_BARKS: { room2: string[]; monthEnd: string[]; broke: string[]; good: string[] } = {
  "room2": [
    "han.room2.1",
    "han.room2.2"
  ],
  "monthEnd": [
    "han.monthEnd.1",
    "han.monthEnd.2"
  ],
  "broke": [
    "han.broke.1",
    "han.broke.2"
  ],
  "good": [
    "han.good.1",
    "han.good.2"
  ]
}

/** 兩段對話的台詞順序（說話的人看台詞的 who） */
export const DIALOGUE_LINES: { xiaoyu_play: string[]; agui_chat: string[] } = {
  "xiaoyu_play": [
    "dlg.xiaoyu.1",
    "dlg.xiaoyu.2",
    "dlg.xiaoyu.3",
    "dlg.xiaoyu.4",
    "dlg.xiaoyu.5",
    "dlg.xiaoyu.6",
    "dlg.xiaoyu.7"
  ],
  "agui_chat": [
    "dlg.agui.1",
    "dlg.agui.2",
    "dlg.agui.3",
    "dlg.agui.4",
    "dlg.agui.5",
    "dlg.agui.6",
    "dlg.agui.7",
    "dlg.agui.8"
  ]
}
