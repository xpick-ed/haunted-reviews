import { box, rect, type Rect } from './collision'
import { NOWHERE, OLDSTREET, isNight, pick, withStore, type ShopInterior } from './oldStreetLayout'
import { DIALOGUES, type Dialogue } from './dialogues'
import type { GameState } from '../store'
import type { PhotoResult, ShaveIceResult } from '../ui/minigames/types'
import { buyGood, giveGood } from './goodsGive'
import type { SewResult } from '../ui/minigames/sew'

// 老街東邊可以走進去的店（DESIGN §30）：阿桃冰果室、光明照相館、錦繡布莊。
// 規則在這裡；畫面在 src/scene/OldStreetEast.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或 withStore）。
//
//   z = -10.0 ┌ 後牆 ──────────────┬──────────────────────┬────────────────────────┐
//             │ 冰箱  桌   點唱機   │ 照片牆 布景 椅子 暗房 │ 布架（一匹一匹的布）    │
//             │ 桌        桌        │     大相機   燈      │ 布架 剪裁檯   裁縫車    │
//             │   工作檯（水果）    │ 櫥窗       櫃台      │ 鏡子 櫃台     衣架      │
//   z = -4.4  └ 櫃台（剉冰機）─────┴── 櫥窗 ─ 門 ────────┴── 鐵捲門拉起來 ────────┘
//                              亭仔腳（z = -2.4 是柱子）

const O = OLDSTREET
const A = O.arcade
const F = A.frontZ
/** 店裡的後牆（場景的北邊界是 -10.2） */
export const EAST_BACK = -10.0
/** 一樓店面牆的厚度（跟 StoreWall 一樣） */
const FW = 0.24
const lot = (id: string) => O.lots.find((l) => l.id === id)!
const ICE = lot('ice')
const PHOTO = lot('photo')
const CLOTH = lot('cloth')
const END = lot('end')

/** 冰果室裡面：店面的櫃台（剉冰機）還在原來的地方，阿桃站在櫃台後面；後面是工作檯和座位 */
export const ICE_IN = {
  /** 店面兩側的牆墩（中間整片打開） */
  pillars: [
    { x0: ICE.x0, x1: ICE.x0 + 0.5 },
    { x0: ICE.x1 - 0.5, x1: ICE.x1 },
  ],
  /** 阿桃後面的工作檯：水果玻璃櫃、果汁機 */
  prep: { x: 2.3, z: -6.05, w: 2.4, d: 0.5 },
  /** 大理石面的小圓桌 */
  tables: [
    { x: 0.75, z: -7.6 },
    { x: 3.95, z: -7.6 },
    { x: 2.35, z: -9.05 },
  ],
  /** 西牆的玻璃冰箱（彈珠汽水） */
  fridge: { x: -0.25, z: -9.15, w: 0.7, d: 0.9 },
  /** 東牆的點唱機 */
  jukebox: { x: 4.95, z: -9.3, w: 0.7, d: 0.8 },
  fan: { x: 2.35, z: -7.7 },
  /** 晚上的好兄弟：學生坐在一號桌、小姐坐在二號桌 */
  student: { x: 0.2, z: -7.95 },
  lady: { x: 4.5, z: -7.95 },
}

/** 照相館裡面：後牆是布景（日月潭），前面一張雕花椅，大相機對著它；西牆一整面的老照片 */
export const PHOTO_IN = {
  window: { c: 6.7, w: 2.2 },
  door: { c: O.photo.doorX, w: 1.1 },
  /** 櫥窗後面淺淺的展示櫃 */
  showcase: { x: 6.7, z: -4.95, w: 2.2, d: 0.45 },
  backdrop: { x0: 6.4, x1: 9.7 },
  chair: { x: 8.05, z: -9.05 },
  side: { x: 8.95, z: -9.35 },
  camera: { x: 8.05, z: -6.9 },
  photographer: { x: 8.1, z: -6.05 },
  lamps: [
    { x: 6.55, z: -7.9 },
    { x: 9.5, z: -7.35 },
  ],
  /** 暗房（東北角的小隔間，黑布簾、紅燈） */
  darkroom: { x0: 9.9, x1: PHOTO.x1 - 0.1, z0: EAST_BACK, z1: -8.25 },
  counter: { x: 10.35, z: -5.35, w: 1.3, d: 0.5 },
  /** 西牆（跟冰果室共用那一面）的照片：z 範圍、阿春和阿公的結婚照 */
  wall: { x: PHOTO.x0 + 0.1, z0: -9.5, z1: -5.3 },
  wedding: { z: -7.25, y: 1.75 },
}

/** 布莊裡面：後牆整排布架、中間剪裁檯、東牆裁縫車，錦繡姨晚上坐在那裡 */
export const CLOTH_IN = {
  opening: { c: 14.1, w: 4.4 },
  shelf: { x0: CLOTH.x0 + 0.1, x1: CLOTH.x1 - 0.1, z0: EAST_BACK, z1: -9.45 },
  /** 西牆的直立布架 */
  rack: { x0: CLOTH.x0 + 0.1, x1: CLOTH.x0 + 0.62, z0: -9.2, z1: -7.3 },
  table: { x: 14.0, z: -7.2, w: 3.0, d: 1.0 },
  machine: { x: 16.35, z: -8.4, w: 0.55, d: 1.0 },
  seat: { x: 15.8, z: -8.4 },
  form: { x: 16.2, z: -5.55 },
  mirror: { x: CLOTH.x0 + 0.25, z: -6.35 },
  counter: { x: 12.75, z: -5.3, w: 1.2, d: 0.5 },
}

/** 可以走進去的範圍（阿嬤在裡面：外殼淡出、鏡頭拉近） */
const room = (l: { x0: number; x1: number }) => rect(l.x0 + 0.2, EAST_BACK, l.x1 - 0.2, F - 0.1)
/** 淡出用的盒子：只算亭仔腳頂以上（走騎樓不會誤觸），一直到山頭；往外包到直式招牌 */
const shell = (id: string, l: { x0: number; x1: number; top: number }, inside: Rect) => ({
  id,
  inside,
  min: [l.x0, A.ceilY - 0.25, A.backZ] as [number, number, number],
  max: [l.x1, l.top + 1.6, A.colZ + 0.75] as [number, number, number],
})

// ---------------------------------------------------------------------------
// 對話
// ---------------------------------------------------------------------------

const EAST_DIALOGUES: Record<string, Dialogue> = {
  // 冰果室：晚上一號桌的學生（好兄弟），請他喝一瓶彈珠汽水
  os_ice_student: {
    steps: [
      { line: 'oseast.student.1' },
      { line: 'oseast.gm.student.1' },
      { line: 'oseast.student.2' },
      { line: 'oseast.student.3' },
      { line: 'oseast.gm.student.2' },
      { line: 'oseast.student.4', set: 'os_student_met' },
    ],
  },
  // 冰果室：晚上二號桌的小姐，等一個沒來的人
  os_ice_lady: {
    steps: [
      { line: 'oseast.lady.1' },
      { line: 'oseast.gm.lady.1' },
      { line: 'oseast.lady.2' },
      {
        line: 'oseast.lady.3',
        choices: [
          { line: 'oseast.gm.lady.stay', goto: 'stay' },
          { line: 'oseast.gm.lady.wait', goto: 'wait' },
        ],
      },
      { label: 'stay', line: 'oseast.gm.lady.stay' },
      { line: 'oseast.lady.stay', goto: 'end' },
      { label: 'wait', line: 'oseast.gm.lady.wait' },
      { line: 'oseast.lady.wait' },
      { label: 'end', line: 'oseast.lady.end', set: 'os_lady_met' },
    ],
  },
  // 照相館：西牆上找到一九五八年的結婚照（不是回憶碎片，只是阿嬤的話）
  os_photo_wedding: {
    steps: [{ line: 'oseast.wedding.1' }, { line: 'oseast.wedding.2' }, { line: 'oseast.wedding.3' }, { line: 'oseast.wedding.4', set: 'os_wedding_seen' }],
  },
  // 布莊：晚上坐在裁縫車前面的錦繡姨（去年冬天走的）
  os_cloth_jinxiu: {
    steps: [
      { line: 'oseast.jx.first.1' },
      { line: 'oseast.gm.jx.1' },
      { line: 'oseast.jx.first.2' },
      { line: 'oseast.jx.first.3' },
      { line: 'oseast.gm.jx.2' },
      { line: 'oseast.jx.first.4', set: 'jinxiu_met' },
    ],
  },
  os_cloth_done: {
    steps: [{ line: 'oseast.jx.done.1' }, { line: 'oseast.jx.done.2' }, { line: 'oseast.gm.jx.done' }, { line: 'oseast.jx.done.3' }],
  },
}
Object.assign(DIALOGUES, EAST_DIALOGUES)

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** 音效在畫面那邊（規則檔不能直接 import audio） */
function sound(fn: (m: typeof import('../scene/OldStreetEastSound')) => void) {
  void import('../scene/OldStreetEastSound').then(fn)
}

/** 設旗標、加功德 */
function reward(flags: Record<string, boolean>, merit = 0) {
  withStore((st) => {
    const x = st.getState()
    st.setState({ flags: { ...x.flags, ...flags }, meta: { ...x.meta, merit: x.meta.merit + merit } })
  })
}

/** 店裡的好東西的價錢（DESIGN §31.1） */
const RAMUNE_PRICE = 30
const QUILT_PRICE = 150

/** 點唱機這一趟放到第幾首（重新整理從第一首） */
let song = 0

/** 裁縫車小遊戲（src/ui/minigames/sew.tsx）：target 是要踩幾針 */
function sew(s: GameState, target: number, onEnd: (r: SewResult | null) => void) {
  s.startMinigame('sew', { target }, (r) => onEnd(r as SewResult | null))
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

export const OS_EAST: ShopInterior = {
  lots: ['ice', 'photo', 'cloth'],
  rects: [
    // 三間店的後牆（一整道）與隔間牆：冰果室／戲院、冰果室／照相館、照相館／布莊、布莊／最後一間
    rect(ICE.x0, A.backZ, CLOTH.x1, EAST_BACK),
    rect(ICE.x0, EAST_BACK, ICE.x0 + 0.2, F),
    rect(PHOTO.x0 - 0.1, EAST_BACK, PHOTO.x0 + 0.1, F),
    rect(CLOTH.x0 - 0.1, EAST_BACK, CLOTH.x0 + 0.1, F),
    rect(CLOTH.x1 - 0.2, EAST_BACK, CLOTH.x1, F),
    // ---- 冰果室 ----
    ...ICE_IN.pillars.map((p) => rect(p.x0, F - FW, p.x1, F)),
    // 店面的櫃台（凸出店面一點點）
    box(O.ice.counterX, O.ice.counterZ + 0.12, O.ice.counterW, 0.5),
    box(ICE_IN.prep.x, ICE_IN.prep.z, ICE_IN.prep.w, ICE_IN.prep.d),
    box(ICE_IN.fridge.x, ICE_IN.fridge.z, ICE_IN.fridge.w, ICE_IN.fridge.d),
    box(ICE_IN.jukebox.x, ICE_IN.jukebox.z, ICE_IN.jukebox.w, ICE_IN.jukebox.d),
    // ---- 照相館 ----
    rect(PHOTO.x0, F - FW, PHOTO_IN.door.c - PHOTO_IN.door.w / 2, F),
    rect(PHOTO_IN.door.c + PHOTO_IN.door.w / 2, F - FW, PHOTO.x1, F),
    box(PHOTO_IN.showcase.x, PHOTO_IN.showcase.z, PHOTO_IN.showcase.w, PHOTO_IN.showcase.d),
    box(PHOTO_IN.chair.x, PHOTO_IN.chair.z, 0.7, 0.6),
    rect(PHOTO_IN.darkroom.x0, PHOTO_IN.darkroom.z0, PHOTO_IN.darkroom.x1, PHOTO_IN.darkroom.z1),
    box(PHOTO_IN.counter.x, PHOTO_IN.counter.z, PHOTO_IN.counter.w, PHOTO_IN.counter.d),
    // ---- 布莊 ----
    rect(CLOTH.x0, F - FW, CLOTH_IN.opening.c - CLOTH_IN.opening.w / 2, F),
    rect(CLOTH_IN.opening.c + CLOTH_IN.opening.w / 2, F - FW, CLOTH.x1, F),
    rect(CLOTH_IN.shelf.x0, CLOTH_IN.shelf.z0, CLOTH_IN.shelf.x1, CLOTH_IN.shelf.z1),
    rect(CLOTH_IN.rack.x0, CLOTH_IN.rack.z0, CLOTH_IN.rack.x1, CLOTH_IN.rack.z1),
    box(CLOTH_IN.table.x, CLOTH_IN.table.z, CLOTH_IN.table.w, CLOTH_IN.table.d),
    box(CLOTH_IN.machine.x, CLOTH_IN.machine.z, CLOTH_IN.machine.w, CLOTH_IN.machine.d),
    box(CLOTH_IN.mirror.x, CLOTH_IN.mirror.z, 0.3, 0.9),
    box(CLOTH_IN.counter.x, CLOTH_IN.counter.z, CLOTH_IN.counter.w, CLOTH_IN.counter.d),
  ],
  circles: [
    // 亭仔腳的兩張小圓桌、照相館門口的老相機
    ...O.ice.tables.map((x) => ({ x, z: O.ice.tableZ, r: 0.42 })),
    { x: O.tripod.x, z: O.tripod.z, r: 0.34 },
    ...ICE_IN.tables.map((t) => ({ x: t.x, z: t.z, r: 0.42 })),
    { x: PHOTO_IN.camera.x, z: PHOTO_IN.camera.z, r: 0.36 },
    { x: PHOTO_IN.side.x, z: PHOTO_IN.side.z, r: 0.24 },
    ...PHOTO_IN.lamps.map((l) => ({ x: l.x, z: l.z, r: 0.28 })),
    { x: CLOTH_IN.seat.x, z: CLOTH_IN.seat.z, r: 0.22 },
    { x: CLOTH_IN.form.x, z: CLOTH_IN.form.z, r: 0.3 },
  ],
  buildings: [
    // 走進店裡：外殼（立面、二樓、屋頂、店面牆、東邊的隔間牆）淡出、鏡頭拉近；在隔壁店裡擋到鏡頭時也淡出
    shell('os_ice', ICE, room(ICE)),
    shell('os_photo', PHOTO, room(PHOTO)),
    shell('os_cloth', CLOTH, room(CLOTH)),
    // 最後一間（沒有室內）：在布莊裡面時，鏡頭會被它的二樓擋住
    shell('os_end_front', END, NOWHERE),
  ],
  rooms: [
    { id: 'os_ice', name: '阿桃冰果室', area: rect(ICE.x0, EAST_BACK, ICE.x1, A.colZ) },
    { id: 'os_photo', name: '光明照相館', area: rect(PHOTO.x0, EAST_BACK, PHOTO.x1, A.colZ) },
    { id: 'os_cloth', name: '錦繡布莊', area: rect(CLOTH.x0, EAST_BACK, CLOTH.x1, A.colZ) },
  ],
  npcs: (phase) => [
    { x: O.ice.bingmom.x, z: O.ice.bingmom.z, r: 0.3 },
    ...(phase === 'dusk'
      ? [{ x: PHOTO_IN.photographer.x, z: PHOTO_IN.photographer.z, r: 0.3 }]
      : [
          { x: ICE_IN.student.x, z: ICE_IN.student.z, r: 0.28 },
          { x: ICE_IN.lady.x, z: ICE_IN.lady.z, r: 0.28 },
        ]),
  ],
  hotspots: [
    // ======================= 阿桃冰果室 =======================
    {
      // 冰果室阿桃：第一次先聊天，之後一天幫她剉一次冰（晚上的客人都是好兄弟）
      id: 'os_bingmom',
      scene: 'oldstreet',
      x: O.ice.counterX,
      z: O.arcade.frontZ + 1.05,
      r: 1.5,
      icon: { x: O.ice.bingmom.x, z: O.ice.bingmom.z },
      iconY: 2.25,
      label: (s) => {
        if (!s.flags.bingmom_met) return '跟冰果室阿桃打招呼'
        return s.flags.os_ice_today ? '冰果室（今天幫過忙了）' : '幫阿桃剉冰'
      },
      run: (s) => {
        const play = () =>
          s.startMinigame('shaveice', {}, (r) => {
            const res = (r as ShaveIceResult | null) ?? { served: 0, merit: 0 }
            withStore((st) => {
              const x = st.getState()
              st.setState({ flags: { ...x.flags, os_ice_today: true }, meta: { ...x.meta, merit: x.meta.merit + res.merit } })
              x.bark(res.merit >= 2 ? 'bingmom.win' : res.served > 0 ? 'bingmom.ok' : 'bingmom.lose')
            })
          })
        if (!s.flags.bingmom_met) {
          s.startDialogue('bingmom_first', play)
          return
        }
        if (s.flags.os_ice_today) {
          s.bark(pick(['bingmom.done.1', 'bingmom.done.2']))
          return
        }
        s.bark(isNight(s) ? pick(['bingmom.night.1', 'bingmom.night.2']) : pick(['bingmom.hi.1', 'bingmom.hi.2']))
        window.setTimeout(play, 900)
      },
    },
    {
      // 點唱機：阿桃的尪留下來的，壞了三十年，按一下卻會唱（三首輪流）
      id: 'os_ice_jukebox',
      scene: 'oldstreet',
      x: ICE_IN.jukebox.x - 0.85,
      z: ICE_IN.jukebox.z + 0.1,
      r: 1.0,
      icon: { x: ICE_IN.jukebox.x, z: ICE_IN.jukebox.z },
      iconY: 2.0,
      label: () => '點唱機（投一個銅板）',
      run: (s) => {
        const n = (song % 3) + 1
        song++
        sound((m) => m.playJukebox(n - 1))
        if (!s.flags.os_jukebox_heard) {
          reward({ os_jukebox_heard: true })
          s.bark('oseast.jb.bingmom')
          window.setTimeout(() => s.bark(`oseast.jb.${n}`), 4200)
          return
        }
        s.bark(`oseast.jb.${n}`)
      },
    },
    {
      // 玻璃冰箱：開一瓶彈珠汽水（啵！）
      id: 'os_ice_fridge',
      scene: 'oldstreet',
      x: ICE_IN.fridge.x + 0.8,
      z: ICE_IN.fridge.z + 0.05,
      r: 0.95,
      icon: { x: ICE_IN.fridge.x, z: ICE_IN.fridge.z },
      iconY: 2.1,
      label: (s) => (s.flags.goods_ramune2_today ? '開一瓶彈珠汽水' : `帶一瓶彈珠汽水回家（$${RAMUNE_PRICE}${s.flags.goods_ramune_today ? '，還可以再拿一瓶' : ''}）`),
      run: (s) => {
        sound((m) => m.popSoda())
        // 店裡的好東西（DESIGN §31.1）：一天最多帶兩瓶回家
        if (!s.flags.goods_ramune2_today) {
          buyGood('ramune', RAMUNE_PRICE, s.flags.goods_ramune_today ? 'goods_ramune2_today' : 'goods_ramune_today', 'goods.ramune.get')
          return
        }
        s.bark(pick(['oseast.soda.1', 'oseast.soda.2', 'oseast.soda.3']))
      },
    },
    {
      // 晚上：一號桌的學生（好兄弟）。請他喝一瓶彈珠汽水，一晚一次功德 +1
      id: 'os_ice_student',
      scene: 'oldstreet',
      x: ICE_IN.tables[0].x + 0.15,
      z: ICE_IN.tables[0].z + 0.8,
      r: 0.9,
      icon: { x: ICE_IN.student.x, z: ICE_IN.student.z },
      iconY: 1.9,
      label: (s) => (!isNight(s) ? null : s.flags.os_soda_today ? '跟學生聊天' : '請學生喝彈珠汽水'),
      run: (s) => {
        if (s.flags.os_soda_today) {
          s.bark(pick(['oseast.student.again.1', 'oseast.student.again.2']))
          return
        }
        sound((m) => m.popSoda())
        if (!s.flags.os_student_met) {
          s.startDialogue('os_ice_student', () => reward({ os_soda_today: true }, 1))
          return
        }
        s.bark('oseast.student.hi')
        reward({ os_soda_today: true }, 1)
      },
    },
    {
      // 晚上：二號桌的小姐，一個人對著一碗紅豆牛奶冰。坐下來陪她，一晚一次功德 +1
      id: 'os_ice_lady',
      scene: 'oldstreet',
      x: ICE_IN.tables[1].x - 0.1,
      z: ICE_IN.tables[1].z + 0.8,
      r: 0.9,
      icon: { x: ICE_IN.lady.x, z: ICE_IN.lady.z },
      iconY: 1.9,
      label: (s) => (!isNight(s) ? null : s.flags.os_lady_today ? '陪她坐一下' : '坐下來陪她吃冰'),
      run: (s) => {
        if (s.flags.os_lady_today) {
          s.bark(pick(['oseast.lady.again.1', 'oseast.lady.again.2']))
          return
        }
        if (!s.flags.os_lady_met) {
          s.startDialogue('os_ice_lady', () => reward({ os_lady_today: true }, 1))
          return
        }
        s.bark(pick(['oseast.lady.hi.1', 'oseast.lady.hi.2']))
        reward({ os_lady_today: true }, 1)
      },
    },

    // ======================= 光明照相館 =======================
    {
      // 照相館：老闆看不到阿嬤，但是老相機拍得到鬼。傍晚才開，一天拍一次（在店裡的大相機旁邊）
      id: 'os_photo',
      scene: 'oldstreet',
      x: PHOTO_IN.camera.x - 0.8,
      z: PHOTO_IN.camera.z + 0.55,
      r: 1.3,
      icon: { x: PHOTO_IN.camera.x, z: PHOTO_IN.camera.z },
      iconY: 2.3,
      label: (s) => {
        if (isNight(s)) return '大相機（老闆回家了）'
        return s.flags.os_photo_today ? '照相館（今天拍過了）' : '到照相館拍照'
      },
      run: (s) => {
        if (isNight(s)) {
          s.bark('photographer.closed')
          return
        }
        if (s.flags.os_photo_today) {
          s.bark('photographer.again')
          return
        }
        const play = () =>
          s.startMinigame('photo', {}, (r) => {
            const res = (r as PhotoResult | null) ?? { taken: false }
            if (!res.taken) return
            withStore((st) => {
              const x = st.getState()
              st.setState({ flags: { ...x.flags, os_photo_today: true }, meta: { ...x.meta, merit: x.meta.merit + 1 } })
              x.bark(pick(['photographer.after.1', 'photographer.after.2']))
              // 老闆順手洗了一張村子的老照片（DESIGN §31.1）
              window.setTimeout(() => giveGood('photo', 1, 'goods.photo.get'), 2800)
            })
          })
        if (!s.flags.photographer_met) {
          s.startDialogue('photographer_first', play)
          return
        }
        s.bark('photographer.hi.1')
        window.setTimeout(play, 900)
      },
    },
    {
      // 西牆的老照片：第一次找到一九五八年的結婚照；陰陽眼開著，照片裡的人會點頭
      id: 'os_photo_wall',
      scene: 'oldstreet',
      x: PHOTO_IN.wall.x + 0.75,
      z: PHOTO_IN.wedding.z,
      r: 1.2,
      icon: { x: PHOTO_IN.wall.x + 0.1, z: PHOTO_IN.wedding.z },
      iconY: 2.5,
      label: (s) => (s.flags.os_wedding_seen ? '牆上的老照片' : '牆上的老照片（咦？）'),
      run: (s) => {
        if (!s.flags.os_wedding_seen) {
          s.startDialogue('os_photo_wedding')
          return
        }
        if (s.vision) s.bark(pick(['oseast.wall.vision.1', 'oseast.wall.vision.2']))
        else s.bark(pick(['oseast.wall.1', 'oseast.wall.2', 'oseast.wedding.again']))
      },
    },
    {
      // 暗房：紅燈、藥水盆。陰陽眼開著，盆子裡浮出一張開幕那天的照片
      id: 'os_photo_dark',
      scene: 'oldstreet',
      x: PHOTO_IN.darkroom.x0 - 0.1,
      z: PHOTO_IN.darkroom.z1 + 0.55,
      r: 0.95,
      icon: { x: (PHOTO_IN.darkroom.x0 + PHOTO_IN.darkroom.x1) / 2, z: (PHOTO_IN.darkroom.z0 + PHOTO_IN.darkroom.z1) / 2 },
      iconY: 2.4,
      label: () => '掀開暗房的布簾',
      run: (s) => s.bark(s.vision ? 'oseast.dark.vision' : pick(['oseast.dark.1', 'oseast.dark.2'])),
    },

    // ======================= 錦繡布莊 =======================
    {
      // 傍晚：錦繡姨的裁縫車（跟阿嬤那台一樣，一九六八年踩到半夜）
      id: 'os_cloth_machine',
      scene: 'oldstreet',
      x: CLOTH_IN.seat.x - 0.7,
      z: CLOTH_IN.seat.z + 0.3,
      r: 1.1,
      icon: { x: CLOTH_IN.machine.x, z: CLOTH_IN.machine.z },
      iconY: 1.8,
      label: (s) => {
        if (isNight(s)) return null
        if (!s.flags.os_sewing_seen) return '看看裁縫車'
        return s.flags.goods_quilt_today ? '看看裁縫車（今天縫過了）' : `借裁縫車縫一條厚棉被（布 $${QUILT_PRICE}）`
      },
      run: (s) => {
        if (!s.flags.os_sewing_seen) {
          s.bark('oseast.sew.dusk.1')
          reward({ os_sewing_seen: true })
          return
        }
        if (s.flags.goods_quilt_today) {
          s.bark(pick(['oseast.sew.dusk.2', 'oseast.sew.dusk.3']))
          return
        }
        // 店裡的好東西（DESIGN §31.1）：阿嬤一九六八年踩到半夜的手藝，自己縫一條厚棉被帶回家
        if (s.meta.money < QUILT_PRICE) {
          s.bark('goods.nomoney')
          return
        }
        s.bark('goods.quilt.start')
        window.setTimeout(
          () =>
            sew(s, 22, (res) => {
              if (!res || !res.done) {
                s.bark('goods.quilt.fail')
                return
              }
              withStore((st) => {
                const x = st.getState()
                if (x.flags.goods_quilt_today) return
                st.setState({ flags: { ...x.flags, goods_quilt_today: true }, meta: { ...x.meta, money: x.meta.money - QUILT_PRICE } })
                giveGood('quilt', 1, 'goods.quilt.get')
              })
            }),
          1200,
        )
      },
    },
    {
      // 晚上：錦繡姨（去年冬天走的）還坐在裁縫車前面。幫她踩車，把孫女的旗袍做完
      id: 'os_cloth_jinxiu',
      scene: 'oldstreet',
      x: CLOTH_IN.seat.x - 0.7,
      z: CLOTH_IN.seat.z + 0.3,
      r: 1.1,
      icon: { x: CLOTH_IN.seat.x, z: CLOTH_IN.seat.z },
      iconY: 2.0,
      label: (s) => {
        if (!isNight(s)) return null
        if (!s.flags.jinxiu_met) return '跟錦繡姨說話'
        if (s.flags.cloth_sew_today) return '陪錦繡姨聊天'
        return s.flags.jinxiu_dress ? '幫錦繡姨踩裁縫車' : '幫錦繡姨把旗袍做完'
      },
      run: (s) => {
        if (s.flags.cloth_sew_today) {
          s.bark(pick(['oseast.jx.chat.1', 'oseast.jx.chat.2', 'oseast.jx.chat.3']))
          return
        }
        const first = !s.flags.jinxiu_dress
        const play = () =>
          sew(s, first ? 36 : 30, (res) => {
            withStore((st) => {
              const x = st.getState()
              if (!res || !res.done) {
                x.bark(res ? 'oseast.jx.fail' : 'oseast.jx.later')
                return
              }
              st.setState({ flags: { ...x.flags, cloth_sew_today: true, jinxiu_dress: true }, meta: { ...x.meta, merit: x.meta.merit + (first ? 2 : 1) } })
              // 錦繡姨用剩下的布縫了一條被子給阿嬤（DESIGN §31.1）
              window.setTimeout(() => giveGood('quilt', 1, 'goods.jinxiu.quilt'), first ? 9000 : 2600)
              if (first) x.startDialogue('os_cloth_done')
              else x.bark(res.accuracy >= 0.8 ? 'oseast.jx.good' : 'oseast.jx.ok')
            })
          })
        if (!s.flags.jinxiu_met) {
          s.startDialogue('os_cloth_jinxiu', play)
          return
        }
        s.bark(first ? 'oseast.jx.retry' : 'oseast.jx.again')
        window.setTimeout(play, 1100)
      },
    },
    {
      // 立鏡：鬼照不出來；陰陽眼開著，鏡子裡是十八歲的阿春
      id: 'os_cloth_mirror',
      scene: 'oldstreet',
      x: CLOTH_IN.mirror.x + 0.75,
      z: CLOTH_IN.mirror.z,
      r: 0.9,
      icon: { x: CLOTH_IN.mirror.x, z: CLOTH_IN.mirror.z },
      iconY: 2.3,
      label: () => '照鏡子',
      run: (s) => s.bark(s.vision ? 'oseast.mirror.vision' : 'oseast.mirror.1'),
    },
    {
      // 後面的布架：一匹一匹的布
      id: 'os_cloth_bolts',
      scene: 'oldstreet',
      x: CLOTH_IN.table.x - 0.6,
      z: CLOTH_IN.shelf.z1 + 0.55,
      r: 1.1,
      icon: { x: CLOTH_IN.table.x - 0.6, z: CLOTH_IN.shelf.z0 + 0.25 },
      iconY: 2.2,
      label: () => '摸摸布料',
      run: (s) => s.bark(pick(['oseast.bolt.1', 'oseast.bolt.2', 'oseast.bolt.3'])),
    },
  ],
}
