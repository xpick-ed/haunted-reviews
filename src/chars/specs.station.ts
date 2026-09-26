import { SPECS, type ChibiSpec } from './specs'

// 小火車站的鬼（DESIGN §27.1）：末班車的鬼車掌、四位鬼乘客。只用現有的 ChibiSpec 功能；
// 由 src/scene/Station.tsx 載入時登記（已經有同 id 的就不蓋掉）。

const STATION_SPECS: Record<string, ChibiSpec> = {
  /** 鬼車掌：深藍制服、帽簷、細框眼鏡，一板一眼 */
  conductor: {
    id: 'conductor',
    scale: 1.04,
    skin: '#e3bf9e',
    hair: { style: 'short', color: '#9a9690' },
    top: { kind: 'jacket', color: '#26314d', sleeve: 'long', accent: '#c9a54a' },
    bottom: { kind: 'pants', color: '#1f2740' },
    feet: { kind: 'shoe', color: '#16161a' },
    ghost: true,
    extras: { visor: '#1b2440', collar: true, glasses: 'thin', glassesColor: '#b8a060' },
    faces: {
      normal: { eyes: 'calm', mouth: 'flat', brows: 'stern', wrinkles: true },
      happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true },
    },
  },
  /** 穿制服的學生：白襯衫、黑短褲，去嘉義讀書坐過站 */
  ghost_student: {
    id: 'ghost_student',
    scale: 0.86,
    skin: '#ecc6a4',
    hair: { style: 'crew', color: '#1f1a18' },
    top: { kind: 'shirt', color: '#f1eee6', sleeve: 'short' },
    bottom: { kind: 'shorts', color: '#1f2638' },
    feet: { kind: 'shoe', color: '#2a2220' },
    ghost: true,
    extras: { shirtCollar: true },
    faces: { normal: { eyes: 'open', mouth: 'small', brows: 'soft' } },
  },
  /** 戴斗笠的阿伯：收完甘蔗要去糖廠領錢 */
  ghost_farmer: {
    id: 'ghost_farmer',
    scale: 1.0,
    skin: '#c99670',
    hair: { style: 'bald', color: '#d8d4cc' },
    top: { kind: 'singlet', color: '#e8e2d2', sleeve: 'none' },
    bottom: { kind: 'wide', color: '#4c4a42' },
    feet: { kind: 'slipper', color: '#3a342c' },
    ghost: true,
    extras: { strawHat: '#d8c27a', neckTowel: '#e8e4d8' },
    faces: { normal: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true, stubble: true } },
  },
  /** 提皮箱的小姐：自己做的洋裝，要去台北車站 */
  ghost_bride: {
    id: 'ghost_bride',
    scale: 0.96,
    skin: '#f2cdb0',
    hair: { style: 'long', color: '#231a18' },
    top: { kind: 'blouse', color: '#e8a8b4', sleeve: 'short', accent: '#fbe7ea' },
    bottom: { kind: 'skirt', color: '#e39aaa' },
    feet: { kind: 'shoe', color: '#f4efe6' },
    ghost: true,
    extras: { hairpin: true, earrings: true },
    faces: { normal: { eyes: 'calm', mouth: 'smile', brows: 'soft', lashes: true, blush: true } },
  },
  /** 背包包的阿兵哥：放假回家 */
  ghost_soldier: {
    id: 'ghost_soldier',
    scale: 1.06,
    skin: '#d6a882',
    hair: { style: 'crew', color: '#15120f' },
    top: { kind: 'shirt', color: '#5d6b42', sleeve: 'short' },
    bottom: { kind: 'pants', color: '#4f5b37' },
    feet: { kind: 'shoe', color: '#1e1c18' },
    ghost: true,
    extras: { shirtCollar: true },
    faces: { normal: { eyes: 'open', mouth: 'grin', brows: 'soft' } },
  },
}

for (const [id, spec] of Object.entries(STATION_SPECS)) SPECS[id] ??= spec
