// 抓藥（DESIGN §30，和春中藥行）的規則：藥櫃、藥單、秤重的分數。純函式，Node 也能跑。
// 畫面在 herbs.tsx。老街的熱點在 src/world/osWest.ts。

/** 百子櫃上的二十格（4 排 × 5 格，照櫃子上的位置排） */
export const DRAWERS = ['當歸', '川芎', '熟地', '白芍', '黃耆', '甘草', '枸杞', '紅棗', '茯苓', '陳皮', '百合', '麥冬', '桂枝', '生薑', '黨參', '酸棗仁', '遠志', '菊花', '薄荷', '山藥'] as const
export type Herb = (typeof DRAWERS)[number]

export type Rx = 'cough' | 'siwu' | 'sleep'

export interface HerbsParams {
  rx: Rx
}
/** herbs：抓對幾味（0–4）；accuracy：秤得準不準（0..1，抓對的那幾味平均）；merit：功德 0–2 */
export interface HerbsResult {
  herbs: number
  accuracy: number
  merit: number
}

export interface Prescription {
  /** 藥單上寫的名字 */
  title: string
  /** 誰的藥單 */
  who: string
  /** 四味藥、各幾錢 */
  items: { herb: Herb; qian: number }[]
}

/** 三張藥單（不是醫療建議，是遊戲裡老藥單的樣子） */
export const RX: Record<Rx, Prescription> = {
  cough: {
    title: '潤肺湯',
    who: '阿土伯（咳嗽）',
    items: [
      { herb: '百合', qian: 3 },
      { herb: '麥冬', qian: 3 },
      { herb: '陳皮', qian: 2 },
      { herb: '甘草', qian: 1 },
    ],
  },
  siwu: {
    title: '四物湯',
    who: '阿嬌（顧身體）',
    items: [
      { herb: '當歸', qian: 3 },
      { herb: '川芎', qian: 2 },
      { herb: '熟地', qian: 4 },
      { herb: '白芍', qian: 3 },
    ],
  },
  sleep: {
    title: '安神湯',
    who: '睡不著的好兄弟',
    items: [
      { herb: '酸棗仁', qian: 4 },
      { herb: '茯苓', qian: 3 },
      { herb: '遠志', qian: 2 },
      { herb: '紅棗', qian: 5 },
    ],
  },
}

/** 戥子的桿子：0–6 錢 */
export const SCALE_MAX = 6

/** 秤一味藥的分數：差 0 錢 1 分、差 0.5 錢 0.5 分、差 1 錢以上 0 分 */
export function weighScore(target: number, got: number): number {
  return Math.max(0, 1 - Math.abs(target - got))
}

/** 整張藥單的結果（抓對的味數、平均準度 → 功德） */
export function herbsResult(scores: (number | null)[]): HerbsResult {
  const done = scores.filter((x): x is number => x !== null)
  const herbs = done.length
  const accuracy = herbs ? done.reduce((a, b) => a + b, 0) / herbs : 0
  const merit = herbs < 4 ? 0 : accuracy >= 0.75 ? 2 : accuracy >= 0.4 ? 1 : 0
  return { herbs, accuracy: Math.round(accuracy * 100) / 100, merit }
}

/** 秤錘來回擺的位置（0..SCALE_MAX），t 秒；越後面的藥擺越快 */
export function swing(t: number, round: number): number {
  const speed = 0.55 + round * 0.12
  const p = (t * speed) % 2
  const u = p < 1 ? p : 2 - p
  // 兩端慢、中間快一點（像手在推秤錘）
  const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)
  return e * SCALE_MAX
}
