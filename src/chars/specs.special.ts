import { SPECS } from './specs'

// 中元鬼客人夜的好兄弟（DESIGN §31.3）：用 SPECS.id ??= {...} 登記（只用 ChibiSpec 現有的功能）。
// 都是鬼（ghost: true，半透明、會發光）；客人的表情要有 awake／scared／asleep／happy（看到阿嬤很開心）。

/** 水木伯：七十幾歲的老農夫，汗衫、寬褲、脖子上掛一條毛巾 */
SPECS.gg_shuimu ??= {
  id: 'gg_shuimu',
  scale: 1.0,
  skin: '#e2c6ac',
  hair: { style: 'crew', color: '#dcdad4' },
  top: { kind: 'singlet', color: '#efebe0', sleeve: 'none' },
  bottom: { kind: 'wide', color: '#3f4a5c' },
  feet: { kind: 'slipper', color: '#5a4636' },
  ghost: true,
  extras: { neckTowel: '#f1ede2' },
  faces: {
    awake: { eyes: 'open', mouth: 'small', brows: 'soft', wrinkles: true, browColor: '#eeece6' },
    scared: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true, browColor: '#eeece6' },
    asleep: { eyes: 'closed', mouth: 'o', brows: 'soft', wrinkles: true, browColor: '#eeece6' },
    happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true, browColor: '#eeece6' },
    normal: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true, browColor: '#eeece6' },
  },
}

/** 罔市姆：水木伯的牽手。梳髻、深藍碎花衫、翠玉手鐲 */
SPECS.gg_bangsi ??= {
  id: 'gg_bangsi',
  scale: 0.95,
  skin: '#e8cdb6',
  hair: { style: 'bun', color: '#cfd0d6' },
  top: {
    kind: 'blouse',
    color: '#ffffff',
    sleeve: 'long',
    accent: '#2c3a5c',
    print: { base: '#34466e', petals: ['#e8e2d0', '#b8c4e0'], center: '#d8b85a', seed: 71, repeat: 2.4 },
  },
  bottom: { kind: 'wide', color: '#2a3044' },
  feet: { kind: 'slipper', color: '#2a2a30' },
  ghost: true,
  extras: { earrings: true, collar: true, knots: '#e6dcc4', bracelet: '#4fae86' },
  faces: {
    awake: { eyes: 'down', mouth: 'small', brows: 'soft', wrinkles: true },
    scared: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true },
    asleep: { eyes: 'closed', mouth: 'small', brows: 'soft', wrinkles: true },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, wrinkles: true },
    normal: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true },
  },
}

/** 陳班長：民國三十八年來台的老兵。洗到發白的草綠軍服、平頭、站得很挺 */
SPECS.gg_soldier ??= {
  id: 'gg_soldier',
  scale: 1.04,
  skin: '#e0c0a0',
  hair: { style: 'crew', color: '#a8a69e' },
  top: { kind: 'jacket', color: '#7a7f5c', sleeve: 'long', accent: '#5f6446' },
  bottom: { kind: 'pants', color: '#686c4c' },
  feet: { kind: 'shoe', color: '#2a2620' },
  ghost: true,
  extras: { shirtCollar: true },
  faces: {
    awake: { eyes: 'open', mouth: 'flat', brows: 'soft', wrinkles: true, stubble: true },
    scared: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true, stubble: true },
    asleep: { eyes: 'closed', mouth: 'flat', brows: 'soft', wrinkles: true, stubble: true },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true, stubble: true },
    normal: { eyes: 'open', mouth: 'smile', brows: 'soft', wrinkles: true, stubble: true },
  },
}

/** 秋月：歌仔戲班的苦旦。粉紅繡花戲服、長髮插簪、臉上還有一點戲妝 */
SPECS.gg_opera ??= {
  id: 'gg_opera',
  scale: 0.98,
  skin: '#f4dcd2',
  hair: { style: 'long', color: '#161218' },
  top: {
    kind: 'blouse',
    color: '#ffffff',
    sleeve: 'long',
    accent: '#e8c872',
    print: { base: '#ec9cb8', petals: ['#fff0f4', '#e8c872'], center: '#d0405a', seed: 83, repeat: 2.2 },
  },
  bottom: { kind: 'skirt', color: '#d8708e' },
  feet: { kind: 'none', color: '#000' },
  ghost: true,
  extras: { earrings: true, hairpin: true, collar: true, knots: '#e8c872' },
  faces: {
    awake: { eyes: 'open', mouth: 'small', brows: 'soft', lashes: true, blush: true, lipstick: '#d0304a' },
    scared: { eyes: 'wide', mouth: 'o', brows: 'worried', lashes: true, lipstick: '#d0304a' },
    asleep: { eyes: 'closed', mouth: 'small', brows: 'soft', lashes: true, blush: true, lipstick: '#d0304a' },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', lashes: true, blush: true, lipstick: '#d0304a' },
    normal: { eyes: 'happy', mouth: 'smile', brows: 'soft', lashes: true, blush: true, lipstick: '#d0304a' },
  },
}
