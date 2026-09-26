import type { GuestDef } from './guests'
import type { GuestId } from './types'

// 中元鬼客人夜的好兄弟（DESIGN §31.3）：玩法在 night/special.ts。
// 他們都看得到阿嬤、不怕她（seesGhost）；類型用「老朋友」（elder）：想聊天，聊過評價比較好。
// 付的是冥紙（pay 0），天亮時 special.ts 換成功德。起夜、半夜出門走走由 special.ts 安排（所以 trips 是空的）。
// 需求用現有的：聊天（chat）、供品（hungry：煮宵夜端過去）、好冷（陰間很冷：蓋被子）、怕黑（點燈／停電時點蠟燭）、潤喉（倒水）。

export const GHOST_GUEST_IDS: GuestId[] = ['gg_shuimu', 'gg_bangsi', 'gg_soldier', 'gg_opera']
export const isGhostGuest = (id: GuestId) => GHOST_GUEST_IDS.includes(id)

export const GHOST_GUESTS: Partial<Record<GuestId, GuestDef>> = {
  gg_shuimu: {
    id: 'gg_shuimu', name: '水木伯', type: 'elder', label: '好兄弟（中元回來看村子的阿伯）', pay: 0, comfortNeed: 50, fearMax: 999, seesGhost: true, bedtime: 25.4, lightSleeper: 0.2, trips: [],
    needs: [
      { kind: 'chat', at: 22.5, chance: 1 },
      { kind: 'hungry', at: 23.6, chance: 0.9 },
      { kind: 'cold', at: 25.0, chance: 0.8 },
    ],
    clues: ['穿著三十年前的汗衫，身上有一點香灰的味道', '跟老闆說：「這間厝，我們以前來喝過喜酒。」', '登記簿上寫的地址，是一間早就拆掉的房子'],
    shock: 0,
  },
  gg_bangsi: {
    id: 'gg_bangsi', name: '罔市姆', type: 'elder', label: '好兄弟（水木伯的牽手）', pay: 0, comfortNeed: 50, fearMax: 999, seesGhost: true, bedtime: 25.2, lightSleeper: 0.3, trips: [],
    needs: [
      { kind: 'chat', at: 22.5, chance: 1 },
      { kind: 'dark', at: 24.2, chance: 0.8 },
      { kind: 'thirsty', at: 23.2, chance: 0.6 },
    ],
    clues: ['手上拿著一串褪色的佛珠', '一直問：「村口那棵榕樹還在嗎？」', '付錢的時候拿出一疊冥紙，還算得很認真'],
    shock: 0,
  },
  gg_soldier: {
    id: 'gg_soldier', name: '陳班長', type: 'elder', label: '好兄弟（民國三十八年來台的老兵）', pay: 0, comfortNeed: 55, fearMax: 999, seesGhost: true, bedtime: 25.8, lightSleeper: 0.25, trips: [],
    needs: [
      { kind: 'chat', at: 22.7, chance: 1 },
      { kind: 'hungry', at: 23.8, chance: 1 },
      { kind: 'cold', at: 25.3, chance: 0.7 },
    ],
    clues: ['一身洗到發白的舊軍服，站得很挺', '講話有很重的山東口音', '問老闆有沒有饅頭，「有就好，沒有也不要緊。」'],
    shock: 0,
  },
  gg_opera: {
    id: 'gg_opera', name: '秋月', type: 'elder', label: '好兄弟（歌仔戲班的花旦）', pay: 0, comfortNeed: 55, fearMax: 999, seesGhost: true, bedtime: 26.0, lightSleeper: 0.3, trips: [],
    needs: [
      { kind: 'chat', at: 22.5, chance: 1 },
      { kind: 'thirsty', at: 23.4, chance: 0.9 },
      { kind: 'insomnia', at: 25.0, chance: 0.6 },
    ],
    clues: ['臉上還留著一點點戲妝', '走路的樣子像在台上，一步一步很有韻', '說：「今晚沒戲，借個地方睡一下。」'],
    shock: 0,
  },
}
