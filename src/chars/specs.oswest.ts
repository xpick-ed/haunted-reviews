import { SPECS } from './specs'

// 老街西邊兩間店的人（DESIGN §30）：新美理髮廳的阿坤師（活人）與他爸爸阿水師（鬼）、
// 和春中藥行的和春伯（活人），還有晚上來的好兄弟。只用 ChibiSpec 現有的功能；由 src/scene/OldStreetWest.tsx 載入時登記。

/** 阿坤師：七十幾歲，還在顧爸爸留下來的理髮廳。花白平頭、白色理髮師衣、老花眼鏡 */
SPECS.akun ??= {
  id: 'akun',
  scale: 1.0,
  skin: '#e8b996',
  hair: { style: 'crew', color: '#bdb8b0' },
  top: { kind: 'shirt', color: '#f4f1ea', sleeve: 'short' },
  bottom: { kind: 'pants', color: '#4a4e58' },
  feet: { kind: 'slipper', color: '#3a3a40' },
  extras: { shirtCollar: true, readingGlasses: true, glassesColor: '#6a4a2a' },
  faces: {
    normal: { eyes: 'down', mouth: 'flat', brows: 'soft', wrinkles: true },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true },
    surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true },
  },
}

/** 阿水師（鬼）：新美理髮廳開店的師傅。油頭側分、白色理髮師衣、黑領結（用領帶） */
SPECS.ashui ??= {
  id: 'ashui',
  scale: 0.98,
  skin: '#e6b894',
  hair: { style: 'sidepart', color: '#2a2422' },
  top: { kind: 'shirt', color: '#f7f4ec', sleeve: 'long' },
  bottom: { kind: 'pants', color: '#2a2c34' },
  feet: { kind: 'shoe', color: '#1c1c1e' },
  ghost: true,
  extras: { shirtCollar: true, tie: '#1a1a1e' },
  faces: {
    normal: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true },
    happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true, blush: true },
  },
}

/** 和春伯：快九十歲的中藥行老闆，看不到鬼。光頭、老花眼鏡推在額頭上、褐色開襟衫 */
SPECS.herbalist ??= {
  id: 'herbalist',
  scale: 0.94,
  skin: '#e2b08c',
  hair: { style: 'bald', color: '#d8d4ce' },
  top: { kind: 'cardigan', color: '#7a5a3a', sleeve: 'long' },
  bottom: { kind: 'wide', color: '#3a3430' },
  feet: { kind: 'slipper', color: '#2a2a2a' },
  extras: { innerTop: '#e8e0cc', readingGlasses: true, glassesColor: '#8a6a3a' },
  faces: {
    normal: { eyes: 'down', mouth: 'small', brows: 'soft', wrinkles: true },
    asleep: { eyes: 'closed', mouth: 'o', brows: 'soft', wrinkles: true },
  },
}

/** 晚上來理髮的好兄弟：1960 年代的阿兵哥，平頭（身上圍著理髮的白圍巾，畫面另外畫） */
SPECS.osw_customer ??= {
  id: 'osw_customer',
  scale: 0.96,
  skin: '#e4b48e',
  hair: { style: 'crew', color: '#1c1a1a' },
  top: { kind: 'shirt', color: '#6f7a4a', sleeve: 'short' },
  bottom: { kind: 'pants', color: '#5a6040' },
  feet: { kind: 'shoe', color: '#1c1c1e' },
  ghost: true,
  extras: { shirtCollar: true },
  faces: { normal: { eyes: 'closed', mouth: 'smile', brows: 'soft' } },
}

/** 晚上來抓藥的好兄弟：睡不著的三輪車伕，汗衫、斗笠揹在背後（用毛巾代替） */
SPECS.osw_sleepless ??= {
  id: 'osw_sleepless',
  scale: 0.98,
  skin: '#d9a47e',
  hair: { style: 'messy', color: '#2a2422' },
  top: { kind: 'singlet', color: '#ece6d6', sleeve: 'none' },
  bottom: { kind: 'shorts', color: '#3a4250' },
  feet: { kind: 'slipper', color: '#5a4a3a' },
  ghost: true,
  extras: { neckTowel: '#f4f1ea' },
  faces: { normal: { eyes: 'sleepy', mouth: 'flat', brows: 'worried', stubble: true } },
}
