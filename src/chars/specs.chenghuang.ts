import { SPECS } from './specs'

// 城隍廟的人（DESIGN §32.2）：判官、七爺、八爺、排隊的鬼。只用 ChibiSpec 現有的功能；
// 帽子（烏紗帽、七爺八爺的高帽）在 src/scene/Chenghuang.tsx 另外畫。由那個檔案載入時登記。

/** 判官：黑臉長鬍子的那種太嚇人，這裡是一個戴老花眼鏡、很會打算盤的老公務員 */
SPECS.panguan ??= {
  id: 'panguan',
  scale: 1.05,
  skin: '#d9a07a',
  hair: { style: 'sidepart', color: '#1c1a1a' },
  top: { kind: 'jacket', color: '#7a1c1c', sleeve: 'long' },
  bottom: { kind: 'wide', color: '#2a1414' },
  feet: { kind: 'shoe', color: '#141414' },
  ghost: true,
  extras: { readingGlasses: true, glassesColor: '#c9a25a', collar: true },
  faces: {
    normal: { eyes: 'down', mouth: 'flat', brows: 'stern', wrinkles: true, stubble: true },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true, stubble: true },
  },
}

/** 七爺（謝必安）：又高又白，一臉想下班 */
SPECS.qiye ??= {
  id: 'qiye',
  scale: 1.32,
  skin: '#eeeae4',
  hair: { style: 'long', color: '#1a1a1e' },
  top: { kind: 'jacket', color: '#f2f0ea', sleeve: 'long' },
  bottom: { kind: 'wide', color: '#e6e2d8' },
  feet: { kind: 'shoe', color: '#1a1a1e' },
  ghost: true,
  faces: {
    normal: { eyes: 'sleepy', mouth: 'flat', brows: 'none' },
    happy: { eyes: 'happy', mouth: 'small', brows: 'soft' },
  },
}

/** 八爺（范無救）：又矮又黑，嗓門大 */
SPECS.baye ??= {
  id: 'baye',
  scale: 0.84,
  skin: '#5a4a44',
  hair: { style: 'crew', color: '#141414' },
  top: { kind: 'jacket', color: '#26262c', sleeve: 'long' },
  bottom: { kind: 'wide', color: '#1c1c22' },
  feet: { kind: 'shoe', color: '#101010' },
  ghost: true,
  faces: {
    normal: { eyes: 'open', mouth: 'o', brows: 'stern' },
    asleep: { eyes: 'closed', mouth: 'o', brows: 'soft' },
  },
}

/** 呂伯：民國七十六年過號，等到現在。汗衫、手裡捏著號碼牌 */
SPECS.ch_lu ??= {
  id: 'ch_lu',
  scale: 0.96,
  skin: '#dcab88',
  hair: { style: 'bald', color: '#cfcac2' },
  top: { kind: 'singlet', color: '#ece6d6', sleeve: 'none' },
  bottom: { kind: 'pants', color: '#4a4a52' },
  feet: { kind: 'slipper', color: '#3a5a8a' },
  ghost: true,
  faces: { normal: { eyes: 'sleepy', mouth: 'small', brows: 'soft', wrinkles: true } },
}

/** 穿西裝的阿伯：孫子燒的紙紮手機沒有網路，來申訴 */
SPECS.ch_suit ??= {
  id: 'ch_suit',
  scale: 1.0,
  skin: '#e2b494',
  hair: { style: 'sidepart', color: '#8a8580' },
  top: { kind: 'jacket', color: '#3a3f52', sleeve: 'long' },
  bottom: { kind: 'pants', color: '#2e3240' },
  feet: { kind: 'shoe', color: '#1a1a1e' },
  ghost: true,
  extras: { tie: '#8f2a20', shirtCollar: true, glasses: 'thin', glassesColor: '#2a2a2a' },
  faces: { normal: { eyes: 'open', mouth: 'flat', brows: 'worried', wrinkles: true } },
}

/** 想託夢的阿姨：女兒下禮拜結婚，手上拿著看不懂的申請書 */
SPECS.ch_auntie ??= {
  id: 'ch_auntie',
  scale: 0.95,
  skin: '#eec3a2',
  hair: { style: 'perm', color: '#3a2a24' },
  top: { kind: 'blouse', color: '#7a9ec2', sleeve: 'short', print: { base: '#7a9ec2', petals: ['#f4efe2', '#f2c14e'], center: '#e07a3a', seed: 44 } },
  bottom: { kind: 'skirt', color: '#3a4a6a' },
  feet: { kind: 'shoe', color: '#6a3a2a' },
  ghost: true,
  extras: { earrings: true },
  faces: { normal: { eyes: 'calm', mouth: 'smile', brows: 'worried', lashes: true } },
}
