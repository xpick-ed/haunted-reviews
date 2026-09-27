// 殺價（DESIGN §32.1）的規則：純函式，Node 測試可以跑。畫面在 bargain.tsx。
// 每一回合：選一招（三張牌裡挑一張）→ 抓語氣（跑來跑去的指針停在綠色裡）。
// 每個攤販有一招最吃、一招最討厭（鬼菜販阿葉嬸會偷偷告訴阿嬤）；同一招連用效果減半；耐心用完就「不賣妳了啦！」。

export type Tactic = 'sweet' | 'compare' | 'praise' | 'leave' | 'story' | 'bulk'

export const TACTICS: Record<Tactic, { name: string; icon: string; say: string[] }> = {
  sweet: { name: '撒嬌', icon: '🥺', say: ['頭家娘～算便宜一點啦～', '阿姐，妳最好了，少一點啦～'] },
  compare: { name: '比價', icon: '⚖️', say: ['隔壁攤才賣這個價錢喔。', '昨天在別攤買比較便宜耶。'] },
  praise: { name: '誇她', icon: '👍', say: ['這個這麼新鮮，整個市場就妳家最好！', '看妳切的，就知道是老師傅。'] },
  leave: { name: '裝要走', icon: '🚶', say: ['那……我再去別攤看看好了。', '好啦，不然我明天再來。'] },
  story: { name: '講古', icon: '📖', say: ['我跟妳講，以前我阿母在這裡賣菜的時候……', '妳知道這個市場以前是一片田嗎？'] },
  bulk: { name: '買多一點', icon: '🛍️', say: ['我常常來買啦，算我熟客價。', '以後都跟妳買，好否？'] },
}
export const TACTIC_IDS = Object.keys(TACTICS) as Tactic[]

export interface BargainParams {
  /** 攤販（台詞、頭像用） */
  vendor: string
  name: string
  /** 殺的是哪一樣、原價 */
  item: string
  itemName: string
  base: number
  /** 最吃的一招、最討厭的一招 */
  likes: Tactic
  hates: Tactic
}

export interface BargainResult {
  /** 最後的價錢（沒成交就是原價） */
  price: number
  base: number
  /** 有沒有成交（殺到她生氣就沒有） */
  deal: boolean
  /** 殺到她翻臉 */
  angry: boolean
}

/** 語氣：0 抓歪、1 抓到、2 抓得剛剛好 */
export type Timing = 0 | 1 | 2

/** 最多幾回合、耐心、最低幾折 */
export const BARGAIN = { rounds: 4, patience: 3, floor: 0.6 }

/** 每一招砍幾成（抓到／剛剛好）；最吃的那招、普通的招 */
const CUT = { like: [0.12, 0.17], plain: [0.05, 0.08] }

export interface BargainState {
  price: number
  patience: number
  round: number
  last: Tactic | null
  angry: boolean
}

export const startBargain = (p: BargainParams): BargainState => ({ price: p.base, patience: BARGAIN.patience, round: 0, last: null, angry: false })

export type Reaction = 'love' | 'ok' | 'meh' | 'hate' | 'repeat' | 'angry'

/**
 * 出一招：回傳新的狀態、攤販的反應、砍掉多少錢。
 * rnd 只用在「抓歪的時候會不會惹毛她」。
 */
export function playTactic(p: BargainParams, s: BargainState, t: Tactic, timing: Timing, rnd: () => number): { next: BargainState; reaction: Reaction; cut: number } {
  const next: BargainState = { ...s, round: s.round + 1, last: t }
  if (t === p.hates) {
    next.patience -= 1
    // 討厭的招：還會漲一點
    next.price = Math.min(p.base, Math.round(s.price * 1.05))
    if (next.patience <= 0) return { next: { ...next, angry: true, price: p.base }, reaction: 'angry', cut: 0 }
    return { next, reaction: 'hate', cut: 0 }
  }
  const repeat = s.last === t
  const tier = t === p.likes ? CUT.like : CUT.plain
  let k = timing === 2 ? tier[1] : timing === 1 ? tier[0] : tier[0] / 3
  if (repeat) k /= 2
  // 抓歪了：有機會惹毛她
  if (timing === 0 && rnd() < 0.3) next.patience -= 1
  if (next.patience <= 0) return { next: { ...next, angry: true, price: p.base }, reaction: 'angry', cut: 0 }
  const floor = Math.ceil(p.base * BARGAIN.floor)
  const price = Math.max(floor, Math.round(s.price - p.base * k))
  next.price = price
  const cut = s.price - price
  const reaction: Reaction = repeat ? 'repeat' : t === p.likes && timing > 0 ? 'love' : timing === 0 ? 'meh' : 'ok'
  return { next, reaction, cut }
}

/** 結束（成交或回合用完） */
export function settle(p: BargainParams, s: BargainState): BargainResult {
  if (s.angry) return { price: p.base, base: p.base, deal: false, angry: true }
  return { price: s.price, base: p.base, deal: true, angry: false }
}

/** 每回合發三張牌：一定有兩招不一樣的，最吃的那招大概一半的回合會出現 */
export function dealHand(p: BargainParams, rnd: () => number): Tactic[] {
  const pool = [...TACTIC_IDS]
  const out: Tactic[] = []
  if (rnd() < 0.55) out.push(p.likes)
  while (out.length < 3) {
    const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0]
    if (!out.includes(t)) out.push(t)
  }
  // 洗一下順序（最吃的那招不要永遠在第一張）
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 攤販的個性（殺價時講的話）。沒列到的攤販用 default。 */
export const VENDOR_TALK: Record<string, { opener: string; love: string; ok: string; meh: string; hate: string; repeat: string; angry: string; deal: string }> = {
  alan: {
    opener: '我阿蘭的豬肉，今天凌晨剛殺的，整個市場最新鮮！',
    love: '哎喲，妳識貨喔！好啦好啦，算妳便宜。',
    ok: '嗯……好啦，少一點點。',
    meh: '妳在講什麼我聽不太懂啦。',
    hate: '隔壁？隔壁那是冷凍的啦！價錢不能再少了！',
    repeat: '又來這套喔？',
    angry: '不賣妳了啦！去隔壁買！',
    deal: '拿去！下次再來喔。',
  },
  azhong: {
    opener: '來來來，聽我講——這尾虱目魚，早上還在魚塭裡游泳咧！',
    love: '哈哈哈！妳這個阿嬤很有趣，算妳便宜！',
    ok: '好啦，看妳面子。',
    meh: '蛤？妳說什麼？這裡太吵了啦。',
    hate: '要走喔？好啊，走啊！……（看了一眼）……好啦好啦回來啦。',
    repeat: '這個剛剛講過了啦！',
    angry: '不要吵了，今天不賣了！',
    deal: '成交！送妳一把蔥！',
  },
  caipo: {
    opener: '菜自己種的啦，沒噴藥，有蟲咬的才是好菜。',
    love: '叫我阿姐喔？呵呵呵……好啦，算妳便宜。',
    ok: '好啦好啦，少一點。',
    meh: '阿婆耳朵不好啦，妳大聲一點。',
    hate: '要走就走啦，阿婆的菜不怕沒人買。',
    repeat: '妳剛剛講過了啦。',
    angry: '不賣了，阿婆要收攤了！',
    deal: '拿去，多放一根蔥給妳。',
  },
  default: {
    opener: '要買什麼？',
    love: '好啦，算妳便宜。',
    ok: '少一點點啦。',
    meh: '蛤？',
    hate: '這樣講就不好了喔。',
    repeat: '又來？',
    angry: '不賣了！',
    deal: '成交！',
  },
}
export const talkOf = (vendor: string) => VENDOR_TALK[vendor] ?? VENDOR_TALK.default
