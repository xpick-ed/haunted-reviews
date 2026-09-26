// 深夜玩法的共用型別（DESIGN §2、§5、§6）。
// 客人、需求、動作、台詞種類、房間與物件的 id 都在這裡定義，畫面、聲音、規則三邊共用。

/** 會入住的客人（每個 id 對應 src/chars/specs.ts 的長相與 src/data/cast.json 的聲線） */
export type GuestId = 'xiaomei' | 'akai' | 'zhang' | 'ahao' | 'xiaoyu' | 'linmom' | 'agui' | 'atu'

/** 客人類型：決定作息、怕不怕鬼、在意什麼 */
export type GuestType =
  | 'timid' // 一般旅客：怕鬼、要舒服
  | 'thrill' // 靈異 YouTuber：想被嚇、要拍到東西
  | 'business' // 商務客：淺眠、怕吵
  | 'backpacker' // 背包客：晚睡、半夜會找東西吃、不太怕
  | 'child' // 小孩：看得到阿嬤、想跟她玩
  | 'parent' // 帶小孩的家長：怕鬼，看到小孩對空氣講話會怕
  | 'elder' // 老夫妻：阿嬤生前的朋友，不怕她，想跟她聊天

/** 客人的需求（頭上的想法泡泡） */
export type NeedKind =
  | 'cold' // 好冷 → 蓋被子／關窗
  | 'hot' // 好熱 → 電扇調溫
  | 'thirsty' // 口渴 → 倒水
  | 'mosquito' // 蚊子 → 點蚊香
  | 'dark' // 怕黑 → 開小夜燈
  | 'hungry' // 肚子餓 → 煮宵夜端過去
  | 'insomnia' // 睡不著 → 輕拍／搖籃曲
  | 'scare' // 想被嚇（YouTuber）→ 任何嚇人的動作
  | 'play' // 想玩（小孩）→ 陪他玩
  | 'chat' // 想聊天（老夫妻）→ 跟他們說話
  | 'lost' // 東西掉到床底下（眼鏡、手機）→ 撿回床頭（念力可以遠遠撿）

/** 阿嬤可以做的動作 */
export type ActionId =
  // 慈祥
  | 'tuck' // 蓋被子
  | 'temp' // 電扇調溫
  | 'water' // 倒水
  | 'coil' // 點蚊香
  | 'nightlight' // 開小夜燈
  | 'cook' // 在灶腳煮宵夜（之後端著走）
  | 'deliver' // 把宵夜放到床頭
  | 'pat' // 輕拍哄睡
  | 'lullaby' // 哼搖籃曲
  | 'window' // 關窗
  // 嚇人
  | 'flicker' // 燈閃
  | 'rocker' // 搖椅自己搖
  | 'knock' // 敲門
  | 'mirror' // 鏡中人
  // 看得到阿嬤的人
  | 'play' // 陪小孩玩
  | 'chat' // 跟老朋友聊天
  // 其他
  | 'calm' // 安撫狗
  // 更多玩法（DESIGN §25）
  | 'swat' // 打蚊子（小遊戲，不花陰氣）
  | 'dream' // 托夢：進入睡著客人的夢
  | 'radio' // 附身收音機放老歌
  | 'possess' // 附身貓
  | 'hide' // 躲起來
  | 'retrieve' // 把掉的東西撿回床頭
  | 'ouija' // 碟仙：推碟子回答阿凱的問題

/** 客人會講的話的種類（src/data/barks.ts 依這些 key 列出台詞 id） */
export type BarkKind =
  | 'arrive' // 入住時
  | 'idle' // 醒著的碎念
  | 'sleepy' // 要睡了
  | 'need_cold'
  | 'need_hot'
  | 'need_thirsty'
  | 'need_mosquito'
  | 'need_dark'
  | 'need_hungry'
  | 'need_insomnia'
  | 'need_scare'
  | 'need_play'
  | 'need_chat'
  | 'need_lost'
  | 'thanks' // 需求被滿足時的喃喃自語（「好暖……」）
  | 'hear' // 聽到聲音（「什麼聲音？」）
  | 'suspect' // 好像看到什麼（「嗯？」）
  | 'seen' // 看到阿嬤的反應（尖叫、或小孩／老朋友的開心）
  | 'door' // 看到門自己開
  | 'capture' // YouTuber 拍到了
  | 'bathroom' // 起來上廁所
  | 'woken' // 被吵醒
  | 'morning' // 早上退房

export type RoomId = 'r1' | 'r2'

/**
 * 可以互動、而且有狀態的物件（畫面依 store.objects 顯示）。
 * 客房物件：`${RoomId}.lamp`（小夜燈）、`.fan`（電扇）、`.coil`（蚊香）、`.cup`（床頭的水杯）、`.window`（窗）、`.dish`（床頭的宵夜）
 * 其他：'gm.rocker'（阿嬤房間的搖椅）、'bath.mirror'（浴室鏡子）、'kitchen.stove'（灶）
 */
export type ObjectId = `${RoomId}.${'lamp' | 'fan' | 'coil' | 'cup' | 'window' | 'dish'}` | 'gm.rocker' | 'bath.mirror' | 'kitchen.stove'

export interface ObjectState {
  /** 開著／點著／裝滿／關上 */
  on: boolean
  /** 最近一次被動到的時間（performance.now() 毫秒），用來播動畫：燈閃、搖椅、鏡中人 */
  at: number
}

/** 每晚的突發事件 */
export type NightEvent = 'none' | 'dog' | 'blackout' | 'mosquitoes' | 'coldsnap' | 'miaogong'
