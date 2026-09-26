import type { GuestDef } from './guests'
import type { GuestId } from './types'

// 情侶客人（DESIGN §29，成人內容）：新婚夫妻、用假名登記的外遇情侶。玩法在 night/couples.ts。

export const COUPLE_GUESTS: Partial<Record<GuestId, GuestDef>> = {
  ajie: {
    id: 'ajie', name: '阿傑', type: 'couple', label: '新婚夫妻', pay: 2600, comfortNeed: 58, fearMax: 12, bedtime: 25.5, lightSleeper: 0.3, trips: [],
    needs: [{ kind: 'thirsty', at: 24.8, chance: 0.6 }, { kind: 'hungry', at: 25.2, chance: 0.4 }],
    clues: ['兩個人一直牽著手', '行李箱綁著「新婚」的紅緞帶', '問老闆：「這裡隔音好不好？」'], shock: 22,
  },
  xiaohui: {
    id: 'xiaohui', name: '小惠', type: 'couple', label: '新婚夫妻', pay: 0, comfortNeed: 58, fearMax: 10, bedtime: 25.5, lightSleeper: 0.4, trips: [26.8],
    needs: [{ kind: 'cold', at: 26.5, chance: 0.5 }],
    clues: ['一直在看婚戒', '拍了很多張三合院的照片', '說想要「安安靜靜的蜜月」'], shock: 24,
  },
  mrwang: {
    id: 'mrwang', name: '王先生', type: 'couple', label: '情侶（登記的名字好像是假的）', pay: 3200, comfortNeed: 62, fearMax: 10, bedtime: 25, lightSleeper: 0.6, trips: [],
    needs: [{ kind: 'thirsty', at: 24.5, chance: 0.7 }],
    clues: ['登記簿上的名字寫得很潦草', '手機一直響，每次都按掉', '天都黑了還戴著墨鏡'], shock: 26,
  },
  mrswang: {
    id: 'mrswang', name: '王太太', type: 'couple', label: '情侶（登記的名字好像是假的）', pay: 0, comfortNeed: 60, fearMax: 10, bedtime: 25, lightSleeper: 0.5, trips: [26.2],
    needs: [{ kind: 'dark', at: 25.3, chance: 0.4 }],
    clues: ['一直問「這裡會不會遇到認識的人」', '王先生叫她名字的時候她愣了一下', '香水味很重'], shock: 26,
  },
}
