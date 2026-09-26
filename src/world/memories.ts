import { DRESSER, MAIN, SEWING, STOVE } from '../scene/layout'
import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import type { SceneId } from './scenes'

// 回憶碎片（DESIGN §26.2）：各場景的老東西上有阿嬤的回憶，陰陽眼才看得到。
// 收集後在「回憶相簿」看，照年代排起來就是她的一生。每撿一片功德 +1，撿滿一半多一點技能點。

export interface Memory {
  id: string
  /** 相簿上的標題 */
  title: string
  /** 哪一年（相簿依這個排序） */
  year: number
  /** 相簿卡片上的圖示 */
  icon: string
  scene: SceneId
  x: number
  z: number
  /** 光點高度 */
  y: number
  /** 相簿裡的文字（阿嬤的口吻） */
  text: string
  /** 撿起來時阿嬤說的話（src/data/memories.lines.json） */
  line: string
}

export const MEMORIES: Memory[] = [
  {
    id: 'shop',
    title: '偷吃糖的兩個囡仔',
    year: 1946,
    icon: '🍬',
    scene: 'village',
    x: -2.1,
    z: -3.3,
    y: 0.9,
    text: '阿嬌她阿爸開的柑仔店。我們兩個蹲在板凳後面，一人一顆糖，含到下課鐘響都捨不得咬。那時候她就愛講話，我就愛笑。',
    line: 'mem.shop',
  },
  {
    id: 'desk',
    title: '桌上的「春」字',
    year: 1943,
    icon: '✏️',
    scene: 'school',
    x: 0,
    z: -8,
    y: 1.0,
    text: '一年級，用鉛筆刀在桌上刻了一個「春」字，被老師罰站一整節。後來那張桌子換了好多個囡仔坐，字都還在。',
    line: 'mem.desk',
  },
  {
    id: 'podium',
    title: '司令台上的作文獎',
    year: 1947,
    icon: '🏅',
    scene: 'school',
    x: 0,
    z: -4,
    y: 1.4,
    text: '作文題目是〈我的家〉。我寫阿母煮的地瓜粥，校長念出來的時候，台下有人在笑，我臉紅到耳朵。那張獎狀，阿母貼在灶腳貼到發黃。',
    line: 'mem.podium',
  },
  {
    id: 'garden',
    title: '只吃得起地瓜的那幾年',
    year: 1952,
    icon: '🍠',
    scene: 'garden',
    x: -3,
    z: 1,
    y: 0.6,
    text: '米要留給弟弟們，我們女孩子吃地瓜簽。阿母說：地瓜不嫌土，種在哪裡都會活。後來我自己種了一輩子的地瓜。',
    line: 'mem.garden',
  },
  {
    id: 'stones',
    title: '溪邊的踏石',
    year: 1957,
    icon: '🪨',
    scene: 'river',
    x: 0,
    z: 2,
    y: 0.5,
    text: '去溪邊洗衫，一個踏石踩空，整籃衫都漂走了。一個憨憨的少年跳下水幫我撈，撈到自己的鞋子也流走。那就是恁阿公。',
    line: 'mem.stones',
  },
  {
    id: 'wedding',
    title: '嫁過來那天',
    year: 1958,
    icon: '🧧',
    scene: 'home',
    x: DRESSER.x,
    z: DRESSER.z,
    y: 1.3,
    text: '坐牛車嫁過來，穿著借來的鞋，腳痛到走不動。婆婆遞一碗甜湯圓給我，說：「以後這就是妳的家。」那面梳妝鏡，是我唯一的嫁妝。',
    line: 'mem.wedding',
  },
  {
    id: 'kitchen',
    title: '第一盤菜脯蛋',
    year: 1959,
    icon: '🍳',
    scene: 'home',
    x: STOVE.x + 0.6,
    z: STOVE.z,
    y: 1.2,
    text: '第一次在這個灶腳煮菜給阿公吃，菜脯蛋煎得黑黑的。他一句話都沒講，全部吃光光，還說明天還要。後來我才知道，他那天肚子痛了一整晚。',
    line: 'mem.kitchen',
  },
  {
    id: 'stool',
    title: '看戲哭得比我兇',
    year: 1962,
    icon: '🎭',
    scene: 'temple',
    x: -6.55,
    z: 3.3,
    y: 0.7,
    text: '土地公生，廟埕演〈山伯英台〉。演到十八相送，我還沒哭，旁邊的阿公已經在擦眼淚，還假裝是香煙燻到眼睛。',
    line: 'mem.stool',
  },
  {
    id: 'sewing',
    title: '一台裁縫車',
    year: 1968,
    icon: '🧵',
    scene: 'home',
    x: SEWING.x,
    z: SEWING.z,
    y: 1.1,
    text: '那年稻子收成不好，我去學做衫。一台裁縫車，晚上踩到半夜，三個孩子的學費都是從這台車踩出來的。',
    line: 'mem.sewing',
  },
  {
    id: 'altar',
    title: '跪在神明前',
    year: 1994,
    icon: '🙏',
    scene: 'home',
    x: 0,
    z: MAIN.z0 + 1.2,
    y: 1.3,
    text: '媳婦難產，我在神明廳跪了一整夜。天亮的時候，醫院打電話來：是一個男孩，很健康。我給他取名叫「翰」，希望他以後讀很多書。',
    line: 'mem.altar',
  },
  {
    id: 'grave',
    title: '阿公走的那年',
    year: 2009,
    icon: '🕯️',
    scene: 'hill',
    x: -2.8,
    z: -6.58,
    y: 0.9,
    text: '他走得很安靜，睡午覺就沒再醒來。我在他墳前說：「你先去，我慢慢來。」沒想到這一慢，就是十二年。',
    line: 'mem.grave',
  },
  {
    id: 'tree',
    title: '相思樹下',
    year: 2009,
    icon: '🌳',
    scene: 'hill',
    x: 7.1,
    z: -6.9,
    y: 0.7,
    text: '辦完喪事，我一個人坐在相思樹下，從中午坐到天黑。小翰來找我，才十五歲，牽著我的手說：「阿嬤，我們回家。」',
    line: 'mem.tree',
  },
  {
    id: 'temple',
    title: '榕樹下的約定',
    year: 2020,
    icon: '🌿',
    scene: 'temple',
    x: -5.6,
    z: -2.2,
    y: 1.2,
    text: '最後那年，我常常坐在廟前榕樹下。我跟土地公說：我走了以後，這間厝就拜託祢了。土地公沒回答，但是風吹得好涼。',
    line: 'mem.temple',
  },
]

/** 撿到幾片可以多一個技能點 */
export const MEMORY_BONUS_AT = 7

/** 還沒撿、而且陰陽眼開著才會出現（撿起來的熱點） */
export const MEMORY_HOTSPOTS: Hotspot[] = MEMORIES.map((m) => ({
  id: `memory.${m.id}`,
  scene: m.scene,
  x: m.x,
  z: m.z,
  r: 1.3,
  iconY: m.y + 0.5,
  label: (s: GameState) => (s.vision && !s.meta.memories.includes(m.id) ? '拾起回憶' : null),
  run: (s: GameState) => s.collectMemory(m.id),
}))
