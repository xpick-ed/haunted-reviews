import { box, rect } from './collision'
import { DIALOGUES, type Dialogue } from './dialogues'
import { OLDSTREET, isNight, pick, withStore, type ShopInterior } from './oldStreetLayout'
import type { HerbsParams, HerbsResult } from '../ui/minigames/herbs.logic'
import { giveGood } from './goodsGive'

// 老街西邊可以走進去的店（DESIGN §30）：新美理髮廳、和春中藥行。
// 規則在這裡；畫面在 src/scene/OldStreetWest.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或 withStore）。
//
//   新美理髮廳（x -21.5..-15.2）                    和春中藥行（x -15.2..-9.2）
//   ┌ 大鏡子＋鏡台 ─────── 洗頭台 ┐                ┌ 百子櫃（整面藥櫃） ──────────┐
//   │ 毛巾蒸籠   理髮椅一  理髮椅二 │                │  和春伯   長櫃台（戥子、算盤）│
//   │ 收音機                     │                │ 神農      藥甕                藥碾 │
//   │ 長椅（櫥窗下）   衣帽架  門 │                │ 藥甕          門（拆掉四片門板）│
//   └══════ 店面（大櫥窗、玻璃門）═┘                └══════ 店面（木門板） ══════════┘
//   亭仔腳（z -4.4..-2.4）

const O = OLDSTREET
const A = O.arcade

/** 店面牆（z：前後兩面） */
const FRONT_Z0 = A.frontZ - 0.24
/** 後牆的內面（再往後是房子後半，擋住；場景邊界在 -10.2） */
const BACK_Z = -9.9

/** 西邊兩間店的格局（畫面也用這些座標） */
export const OSW = {
  frontZ0: FRONT_Z0,
  backZ: BACK_Z,
  barber: {
    x0: -21.5,
    x1: -15.2,
    /** 室內的牆內面 */
    in: { x0: -21.26, x1: -15.32 },
    door: { c: -17.3, w: 1.2 },
    window: { c: -19.9, w: 2.2, y0: 0.7, y1: 2.5 },
    /** 後牆的大鏡子（x 範圍、高度） */
    mirror: { x0: -21.0, x1: -16.55, y0: 1.05, y1: 2.35 },
    /** 鏡台（鏡子下面的長檯子） */
    vanity: { x0: -21.05, x1: -16.5, z0: BACK_Z, z1: BACK_Z + 0.42, h: 0.86 },
    /** 兩張理髮椅（面向北邊的鏡子） */
    chairs: [
      { x: -20.0, z: -8.55 },
      { x: -17.7, z: -8.55 },
    ],
    /** 洗頭台（東北角） */
    sink: { x: -15.95, z: -9.45 },
    /** 西牆的矮櫃：毛巾蒸籠、收音機 */
    cabinet: { x: -20.97, z: -6.75, w: 0.52, d: 1.5, h: 0.9 },
    steamer: { x: -20.97, z: -7.2 },
    radio: { x: -20.97, z: -6.3 },
    /** 櫥窗下的長椅（坐的人面向店裡） */
    bench: { x: -19.9, z: -5.05, w: 1.8, d: 0.45 },
    /** 門邊的衣帽架 */
    coatRack: { x: -15.75, z: -5.1 },
    /** 傍晚：還活著的阿坤師站在西牆矮櫃旁磨剃刀；晚上：他爸爸阿水師（鬼）站在一號椅旁邊 */
    akun: { x: -20.3, z: -7.65 },
    ashui: { x: -19.15, z: -8.3 },
  },
  herb: {
    x0: -15.2,
    x1: -9.2,
    in: { x0: -15.08, x1: -9.44 },
    /** 門：中間拆掉四片門板 */
    door: { x0: -12.575, x1: -11.065 },
    /** 百子櫃（貼著後牆） */
    cabinet: { x0: -14.7, x1: -9.95, z0: BACK_Z, z1: BACK_Z + 0.5, h: 2.55 },
    /** 長櫃台 */
    counter: { x0: -14.25, x1: -10.55, z0: -8.5, z1: -7.9, h: 1.0 },
    /** 和春伯：傍晚站在櫃台後面，晚上坐在藤椅上打瞌睡 */
    herbalist: { x: -12.35, z: -8.95 },
    nap: { x: -10.25, z: -8.95 },
    /** 神農大帝的神龕（西牆高處）、西牆的藥甕架 */
    shennong: { x: -14.9, z: -6.1 },
    jars: { x: -14.8, z0: -7.6, z1: -4.95 },
    /** 藥碾（東牆邊的矮凳上） */
    grinder: { x: -9.95, z: -6.4 },
    /** 晚上來抓藥的好兄弟站在櫃台前面 */
    ghost: { x: -11.6, z: -7.35 },
  },
}

const B = OSW.barber
const H = OSW.herb

// ---------------------------------------------------------------------------
// 收音機：三個台輪流轉（畫面讀 radioState 畫音符）
// ---------------------------------------------------------------------------

export const RADIO_CHANNELS = ['song', 'news', 'drama'] as const
export type RadioChannel = (typeof RADIO_CHANNELS)[number]
export const radioState = { ch: -1, at: 0 }

/** 照鏡子：陰陽眼開著時，鏡子裡是十八歲的阿春（畫面讀 until 決定要不要畫） */
export const mirrorState = { until: 0 }

// ---------------------------------------------------------------------------
// 對話（台詞在 src/data/oswest.lines.json）
// ---------------------------------------------------------------------------

const OSW_DIALOGUES: Record<string, Dialogue> = {
  // 阿水師（鬼）第一次見面：老理髮師還在幫好兄弟刮鬍子；認得阿公
  ashui_first: {
    steps: [
      { line: 'osw.ashui.first.1' },
      { line: 'osw.ashui.first.2' },
      { line: 'osw.ashui.first.3' },
      { line: 'osw.ashui.first.4' },
      { line: 'osw.ashui.first.5' },
      { line: 'osw.ashui.first.6', set: 'ashui_met' },
    ],
  },
  // 遞熱毛巾：燙的、剛好的、涼的
  ashui_towel: {
    steps: [
      {
        line: 'osw.towel.ask',
        choices: [
          { line: 'osw.towel.q.hot', goto: 'hot' },
          { line: 'osw.towel.q.warm', goto: 'warm' },
          { line: 'osw.towel.q.cold', goto: 'cold' },
        ],
      },
      { label: 'hot', line: 'osw.towel.q.hot' },
      { line: 'osw.towel.hot', goto: 'end' },
      { label: 'cold', line: 'osw.towel.q.cold' },
      { line: 'osw.towel.cold', goto: 'end' },
      { label: 'warm', line: 'osw.towel.q.warm' },
      { line: 'osw.towel.warm.1' },
      { line: 'osw.towel.warm.2', set: 'os_barber_towel_ok' },
      { label: 'end', line: 'osw.towel.end' },
    ],
  },
  // 阿水師的心事：兒子磨剃刀只磨十下
  ashui_razor: {
    steps: [{ line: 'osw.ashui.razor.1' }, { line: 'osw.ashui.razor.2' }, { line: 'osw.ashui.razor.3' }, { line: 'osw.ashui.razor.4', set: 'ashui_asked' }],
  },
  // 傍晚：把磨刀皮帶遞到阿坤師手上（他看不到阿嬤）
  akun_razor: {
    unseen: true,
    steps: [
      { line: 'osw.akun.razor.1' },
      { line: 'osw.akun.razor.2' },
      { line: 'osw.akun.razor.3' },
      { line: 'osw.akun.razor.4' },
      { line: 'osw.akun.razor.5' },
      { line: 'osw.akun.razor.6', set: 'akun_razor' },
    ],
  },
  // 照鏡子（第一次在鏡子裡看到年輕的自己）
  mirror_young: {
    steps: [{ line: 'osw.mirror.young.1' }, { line: 'osw.mirror.young.2' }, { line: 'osw.mirror.young.3', set: 'os_mirror_young' }],
  },
  // 和春伯（活人，看不到阿嬤）：阿嬤偷偷幫他抓藥
  herb_first: {
    unseen: true,
    steps: [{ line: 'osw.herb.first.1' }, { line: 'osw.herb.first.2' }, { line: 'osw.herb.first.3' }, { line: 'osw.herb.first.4', set: 'herbalist_met' }],
  },
}
Object.assign(DIALOGUES, OSW_DIALOGUES)

// ---------------------------------------------------------------------------
// 抓藥：傍晚是和春伯手上的藥單（看不清楚），晚上是睡不著的好兄弟
// ---------------------------------------------------------------------------

/** 今天是哪一張藥單（依第幾晚輪） */
export function herbOrder(night: number, phase: string): HerbsParams {
  if (phase === 'night') return { rx: 'sleep' }
  return { rx: night % 2 ? 'cough' : 'siwu' }
}

// ---------------------------------------------------------------------------
// 碰撞
// ---------------------------------------------------------------------------

function westColliders() {
  const rects = [
    // 西邊的盡頭（理髮廳西牆以外）、兩間店的後牆以後
    rect(-22.5, A.backZ, B.in.x0, A.frontZ),
    rect(B.x0, A.backZ, H.x1, BACK_Z),
    // 理髮廳的店面：大櫥窗（實心）＋玻璃門
    rect(-22.5, FRONT_Z0, B.door.c - B.door.w / 2, A.frontZ),
    rect(B.door.c + B.door.w / 2, FRONT_Z0, B.x1, A.frontZ),
    // 理髮廳和中藥行中間的隔間牆
    rect(B.in.x1, BACK_Z, H.in.x0, A.frontZ),
    // 中藥行的店面：門板，中間拆掉四片
    rect(H.x0, FRONT_Z0, H.door.x0, A.frontZ),
    rect(H.door.x1, FRONT_Z0, H.x1, A.frontZ),
    // 中藥行東牆（隔壁是戲院）
    rect(H.in.x1, BACK_Z, H.x1, A.frontZ),

    // 理髮廳裡：鏡台、洗頭台、矮櫃、長椅
    rect(B.vanity.x0, B.vanity.z0, B.vanity.x1, B.vanity.z1),
    box(B.sink.x, B.sink.z, 0.72, 0.6),
    box(B.cabinet.x, B.cabinet.z, B.cabinet.w, B.cabinet.d),
    box(B.bench.x, B.bench.z, B.bench.w, B.bench.d),

    // 中藥行裡：百子櫃、櫃台、藥甕架、藥碾
    rect(H.cabinet.x0, H.cabinet.z0, H.cabinet.x1, H.cabinet.z1),
    rect(H.counter.x0, H.counter.z0, H.counter.x1, H.counter.z1),
    rect(H.in.x0, H.jars.z0, H.jars.x + 0.3, H.jars.z1),
    box(H.grinder.x, H.grinder.z, 0.5, 1.0),
  ]
  const circles = [
    ...B.chairs.map((c) => ({ x: c.x, z: c.z, r: 0.42 })),
    { x: B.coatRack.x, z: B.coatRack.z, r: 0.22 },
    // 和春伯晚上坐的藤椅
    { x: H.nap.x, z: H.nap.z, r: 0.38 },
  ]
  return { rects, circles }
}

const WC = westColliders()

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

const TOWEL_FLAG = 'os_barber_towel_today'
const HERB_FLAG = 'os_herb_today'

export const OS_WEST: ShopInterior = {
  lots: ['barber', 'herb'],
  rects: WC.rects,
  circles: WC.circles,
  buildings: [
    // 走進理髮廳：外殼（二樓、屋頂、店面、東邊隔間牆）淡出、鏡頭拉近。
    // 遮擋盒子只算亭仔腳頂以上：走騎樓不會誤觸，在隔壁店裡往東看時才淡掉
    {
      id: 'os_barber_in',
      inside: rect(B.in.x0, BACK_Z, B.in.x1, FRONT_Z0),
      min: [B.x0 - 0.4, A.ceilY - 0.25, A.backZ],
      max: [B.x1, 10, A.colZ + 0.1],
    },
    {
      id: 'os_herb_in',
      inside: rect(H.in.x0, BACK_Z, H.in.x1, FRONT_Z0),
      min: [H.x0, A.ceilY - 0.25, A.backZ],
      max: [H.x1, 10.5, A.colZ + 0.1],
    },
  ],
  rooms: [
    { id: 'os_barber', name: '新美理髮廳', area: rect(B.x0, BACK_Z, B.x1, A.colZ) },
    { id: 'os_herb', name: '和春中藥行', area: rect(H.x0, BACK_Z, H.x1, A.colZ) },
  ],
  npcs: (phase) => [
    phase === 'night' ? { x: B.ashui.x, z: B.ashui.z, r: 0.3 } : { x: B.akun.x, z: B.akun.z, r: 0.3 },
    phase === 'night' ? { x: H.ghost.x, z: H.ghost.z, r: 0.3 } : { x: H.herbalist.x, z: H.herbalist.z, r: 0.3 },
  ],
  hotspots: [
    {
      id: 'os_barber',
      scene: 'oldstreet',
      x: O.barberPole.x + 0.4,
      z: O.barberPole.z + 0.9,
      r: 1.2,
      icon: { x: O.barberPole.x, z: O.barberPole.z },
      iconY: 2.5,
      label: () => '理髮廳的旋轉燈',
      run: (s) => s.bark(isNight(s) ? 'osw.pole.night' : 'oldstreet.barber.1'),
    },
    {
      id: 'os_herb',
      scene: 'oldstreet',
      x: -13.6,
      z: -3.3,
      r: 1.1,
      icon: { x: -13.6, z: A.frontZ },
      iconY: 2.4,
      label: () => '中藥行',
      run: (s) => s.bark('oldstreet.herb'),
    },

    // ---------- 新美理髮廳 ----------
    {
      // 坐在二號椅照鏡子：陰陽眼開著，鏡子裡是十八歲的阿春
      id: 'osw_mirror',
      scene: 'oldstreet',
      x: B.chairs[1].x,
      z: B.chairs[1].z + 0.85,
      r: 0.9,
      icon: { x: B.chairs[1].x, z: BACK_Z + 0.1 },
      iconY: 2.6,
      label: (s) => (s.vision ? '坐下來照鏡子（陰陽眼）' : '坐下來照鏡子'),
      run: (s) => {
        if (!s.vision) {
          s.bark(pick(['osw.mirror.none.1', 'osw.mirror.none.2']))
          return
        }
        mirrorState.until = performance.now() + 12000
        if (!s.flags.os_mirror_young) s.startDialogue('mirror_young')
        else s.bark(pick(['osw.mirror.again.1', 'osw.mirror.again.2', 'osw.mirror.again.3']))
      },
    },
    {
      // 西牆矮櫃上的真空管收音機：轉一下換一個台
      id: 'osw_radio',
      scene: 'oldstreet',
      x: B.radio.x + 0.8,
      z: B.radio.z,
      r: 0.85,
      icon: { x: B.radio.x, z: B.radio.z },
      iconY: 1.6,
      label: () => '轉收音機',
      run: (s) => {
        radioState.ch = (radioState.ch + 1) % RADIO_CHANNELS.length
        radioState.at = performance.now()
        const ch = RADIO_CHANNELS[radioState.ch]
        s.bark(`osw.radio.${ch}`)
        // 傍晚阿坤師在：收音機自己換台，他會嘀咕
        if (!isNight(s) && ch === 'song') window.setTimeout(() => withStore((st) => st.getState().bark('osw.akun.radio')), 3600)
      },
    },
    {
      // 傍晚：阿坤師（活人）在磨剃刀。阿水師拜託過以後，可以把磨刀皮帶遞給他
      id: 'osw_akun',
      scene: 'oldstreet',
      x: B.akun.x + 0.75,
      z: B.akun.z + 0.35,
      r: 0.85,
      icon: { x: B.akun.x, z: B.akun.z },
      iconY: 2.3,
      label: (s) => {
        if (isNight(s)) return null
        if (s.flags.ashui_asked && !s.flags.akun_razor) return '把磨刀皮帶遞給阿坤師'
        return '看阿坤師磨剃刀'
      },
      run: (s) => {
        if (s.flags.ashui_asked && !s.flags.akun_razor) {
          s.startDialogue('akun_razor', () =>
            withStore((st) => {
              const x = st.getState()
              if (!x.flags.akun_razor) return
              st.setState({ meta: { ...x.meta, merit: x.meta.merit + 2 } })
            }),
          )
          return
        }
        s.bark(pick(['osw.akun.1', 'osw.akun.2', 'osw.akun.3']))
      },
    },
    {
      // 晚上：阿水師（鬼）幫好兄弟刮鬍子；遞一條熱毛巾（一晚一次）
      id: 'osw_ashui',
      scene: 'oldstreet',
      x: B.ashui.x + 0.35,
      z: B.ashui.z + 0.8,
      r: 0.9,
      icon: { x: B.ashui.x, z: B.ashui.z },
      iconY: 2.3,
      label: (s) => {
        if (!isNight(s)) return null
        if (!s.flags.ashui_met) return '跟理髮師打招呼'
        if (s.flags[TOWEL_FLAG]) return s.flags.ashui_asked ? '跟阿水師聊天' : '聽阿水師講心事'
        return '幫阿水師遞熱毛巾'
      },
      run: (s) => {
        if (!s.flags.ashui_met) {
          s.startDialogue('ashui_first')
          return
        }
        if (!s.flags[TOWEL_FLAG]) {
          s.startDialogue('ashui_towel', () =>
            withStore((st) => {
              const x = st.getState()
              const ok = !!x.flags.os_barber_towel_ok
              st.setState({ flags: { ...x.flags, [TOWEL_FLAG]: true, os_barber_towel_ok: false }, meta: { ...x.meta, merit: x.meta.merit + (ok ? 1 : 0) } })
              // 毛巾溫度剛好：阿水師塞一瓶花露水給阿嬤（DESIGN §31.1）
              if (ok) window.setTimeout(() => giveGood('floral', 1, 'goods.ashui.floral'), 2200)
            }),
          )
          return
        }
        if (!s.flags.ashui_asked) {
          s.startDialogue('ashui_razor')
          return
        }
        s.bark(s.flags.akun_razor ? pick(['osw.ashui.after.1', 'osw.ashui.after.2']) : pick(['osw.ashui.wait.1', 'osw.ashui.wait.2']))
      },
    },

    // ---------- 和春中藥行 ----------
    {
      // 抓藥：傍晚偷偷幫眼睛不好的和春伯；晚上幫睡不著的好兄弟。一天一次
      id: 'osw_herb_counter',
      scene: 'oldstreet',
      x: (H.counter.x0 + H.counter.x1) / 2 + 0.2,
      z: H.counter.z1 + 0.55,
      r: 1.0,
      icon: { x: (H.counter.x0 + H.counter.x1) / 2 + 0.2, z: (H.counter.z0 + H.counter.z1) / 2 },
      iconY: 1.9,
      label: (s) => {
        if (s.flags[HERB_FLAG]) return '抓藥（今天抓過了）'
        return isNight(s) ? '幫睡不著的好兄弟抓藥' : '偷偷幫和春伯抓藥'
      },
      run: (s) => {
        if (s.flags[HERB_FLAG]) {
          s.bark(isNight(s) ? 'osw.herb.done.night' : 'osw.herb.done')
          return
        }
        const night = isNight(s)
        const order = herbOrder(s.meta.night, s.phase)
        const play = () =>
          s.startMinigame('herbs', order, (r) => {
            const res = r as HerbsResult | null
            if (!res) return
            withStore((st) => {
              const x = st.getState()
              st.setState({ flags: { ...x.flags, [HERB_FLAG]: true }, meta: { ...x.meta, merit: x.meta.merit + res.merit } })
              const good = res.herbs >= 4 && res.accuracy >= 0.6
              x.bark(night ? (good ? 'osw.herb.night.win' : 'osw.herb.night.meh') : good ? 'osw.herb.win' : 'osw.herb.meh')
              // 抓得好：多包一份安神茶帶回家（DESIGN §31.1）；抓得很準包兩包
              if (good) window.setTimeout(() => giveGood('herbtea', res.accuracy >= 0.85 ? 2 : 1, 'goods.herb.get'), 2600)
            })
          })
        if (!night && !s.flags.herbalist_met) {
          s.startDialogue('herb_first', play)
          return
        }
        s.bark(night ? 'osw.herb.night.ask' : pick(['osw.herb.ask.1', 'osw.herb.ask.2']))
        window.setTimeout(play, 1400)
      },
    },
    {
      id: 'osw_shennong',
      scene: 'oldstreet',
      x: H.shennong.x + 0.8,
      z: H.shennong.z + 0.2,
      r: 0.8,
      icon: { x: H.shennong.x, z: H.shennong.z },
      iconY: 2.55,
      label: () => '拜神農大帝',
      run: (s) => s.bark(pick(['osw.shennong.1', 'osw.shennong.2', 'osw.shennong.3'])),
    },
    {
      // 拉開一格藥櫃：聞到什麼就想起什麼（從櫃台西邊繞到後面）
      id: 'osw_drawers',
      scene: 'oldstreet',
      x: H.cabinet.x0 + 0.35,
      z: H.cabinet.z1 + 0.45,
      r: 0.8,
      icon: { x: H.cabinet.x0 + 0.5, z: H.cabinet.z0 + 0.2 },
      iconY: 2.1,
      label: () => '拉開一格藥櫃',
      run: (s) => s.bark(pick(['osw.drawer.1', 'osw.drawer.2', 'osw.drawer.3', 'osw.drawer.4', 'osw.drawer.5'])),
    },
    {
      id: 'osw_herbalist',
      scene: 'oldstreet',
      x: H.nap.x - 0.2,
      z: H.counter.z1 + 0.5,
      r: 0.75,
      icon: { x: H.nap.x, z: H.nap.z },
      iconY: 1.9,
      label: (s) => (isNight(s) ? '和春伯在打瞌睡' : null),
      run: (s) => s.bark(pick(['osw.herbalist.snore.1', 'osw.herbalist.snore.2'])),
    },
  ],
}
