import type { GuestDef } from './guests'
import type { GuestId } from './types'

// 大人的心事（DESIGN §29）：帶失智爸爸出遊的兒子、剛被裁員的上班族。玩法在 night/family.ts。
// 志明和福伯所有人都會遇到；志偉（失業、還不敢跟家人說）只在成人內容開著時出現。
// 福伯半夜起來找太太是 family.ts 在管（所以沒有起夜）；志明擔心爸爸，一定睡不著。

export const FAMILY_GUESTS: Partial<Record<GuestId, GuestDef>> = {
  zhiming: {
    id: 'zhiming', name: '志明', type: 'caregiver', label: '帶爸爸出來散心的兒子', pay: 2200, comfortNeed: 55, fearMax: 15, bedtime: 23.5, lightSleeper: 0.8, trips: [],
    needs: [{ kind: 'insomnia', at: 23.6, chance: 1 }, { kind: 'cold', at: 26, chance: 0.5 }],
    clues: ['推著輪椅帶爸爸來，一路都在道歉', '一直在回訊息，眼睛很紅', '說：「爸爸以前很喜歡這種三合院。」'], shock: 20,
  },
  fubo: {
    id: 'fubo', name: '福伯', type: 'wanderer', label: '失智的爸爸（看得到阿嬤）', pay: 0, comfortNeed: 45, fearMax: 999, seesGhost: true, bedtime: 22.8, lightSleeper: 0.3, trips: [],
    needs: [{ kind: 'thirsty', at: 23.4, chance: 0.5 }, { kind: 'cold', at: 26.2, chance: 0.6 }],
    clues: ['拄著拐杖，一直叫一個女人的名字', '看到牆上的老照片就笑了', '口袋裡有一張泛黃的結婚照'], shock: 0,
  },
  zhiwei: {
    id: 'zhiwei', name: '志偉', type: 'lonely', label: '一個人來的上班族', pay: 1600, comfortNeed: 50, fearMax: 20, bedtime: 26.5, lightSleeper: 0.5, trips: [],
    needs: [{ kind: 'insomnia', at: 24.5, chance: 0.9 }, { kind: 'hungry', at: 24, chance: 0.5 }],
    clues: ['平日晚上穿著西裝來住民宿', '公事包裡只有一條領帶和一個飯糰', '一直看著手機，但沒有打給任何人'], shock: 18,
  },
}
