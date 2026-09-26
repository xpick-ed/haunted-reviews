// 廢棄國小小孩鬼的機器人測試（不用瀏覽器）：npx tsx scripts/sim-tag.ts
//
// 鬼抓人：阿嬤只用走的（2.5 m/s）、會快飄（4.3 m/s）兩種機器人，各玩 20 局；
//         用走的應該「有時候抓得完」、會快飄應該「幾乎都抓得完」，站著不動一定輸。
// 躲貓貓：機器人照順序走到每個躲藏點，應該 60 秒內找完。
// 也檢查：小孩不會卡在碰撞裡、不會跑出場地。

import { SCHOOL_SCENE, HIDE_SPOTS, SCHOOL, CLASSROOM } from '../src/world/sceneSchool'
import { newPlay, configurePlay, startTag, startHide, stepPlay, type PlayRT } from '../src/world/tag'
import { resolve } from '../src/world/collision'
import { seeded } from '../src/world/rng'

// 機器人自己的亂數也用固定種子：測試每次結果一樣（之前用 Math.random，偶爾會失敗）
const botRnd = seeded(20260926)

const DT = 1 / 30
const C = SCHOOL_SCENE.colliders

function inside(x: number, z: number) {
  for (const b of C.rects) if (x > b.x0 + 0.05 && x < b.x1 - 0.05 && z > b.z0 + 0.05 && z < b.z1 - 0.05) return true
  return false
}

function play(kind: 'tag' | 'hide', speed: number, seed: number) {
  const rt: PlayRT = newPlay(seed)
  configurePlay(rt, C, HIDE_SPOTS, [
    [-10.3, 6.8],
    [-13, -3.4],
    [-14.9, 7.8],
    [-13.9, 4],
    [2.5, 3.2],
    [8.5, -2.2],
  ])
  const gm = { x: 0, z: -11.6 }
  // 開局前小孩先閒晃一下（位置亂一點）
  for (let i = 0; i < 90; i++) stepPlay(rt, DT, { x: 0, z: -11.6 })
  if (kind === 'tag') startTag(rt)
  else startHide(rt)
  let stuck = 0
  let stall = 0
  let detour = 0
  let side: [number, number] = [0, 0]
  let door = false
  for (let t = 0; t < 70; t += DT) {
    if (speed > 0) {
      let tx = gm.x
      let tz = gm.z
      if (kind === 'tag') {
        let best = Infinity
        for (const k of rt.kids) {
          if (k.mode !== 'flee') continue
          const d = Math.hypot(k.x - gm.x, k.z - gm.z)
          if (d < best) {
            best = d
            // 往小孩要跑去的方向多追一點（預判）
            tx = k.x + Math.sin(k.heading) * Math.min(1.5, d * 0.3)
            tz = k.z + Math.cos(k.heading) * Math.min(1.5, d * 0.3)
          }
        }
      } else {
        // 作弊機器人：知道每個小孩躲在哪，走去最近的那個；要進出教室就先走到門口
        let best = Infinity
        for (const k of rt.kids) {
          if (k.mode !== 'hidden') continue
          const d = Math.hypot(k.x - gm.x, k.z - gm.z)
          if (d < best) {
            best = d
            tx = k.x
            tz = k.z
          }
        }
        const inRoom = (x: number, z: number) => x > CLASSROOM.x0 && x < CLASSROOM.x1 && z > CLASSROOM.z0 && z < CLASSROOM.z1
        const dc = SCHOOL.door.c
        const outZ = SCHOOL.block.z1 + 0.8
        const inZ = SCHOOL.block.z1 - 0.9
        const here = inRoom(gm.x, gm.z)
        if (inRoom(tx, tz) !== here) {
          door = true
          // 先對準門口，再穿過去
          if (Math.abs(gm.x - dc) > 0.12) {
            tx = dc
            tz = here ? inZ : outZ
          } else {
            tx = dc
            tz = here ? outZ : inZ
          }
        } else door = false
      }
      // 卡住（被擋在東西前面）就往旁邊繞一下，像真人一樣
      if (detour > 0 && !door) {
        detour -= DT
        tx = gm.x + side[0]
        tz = gm.z + side[1]
      }
      const dx = tx - gm.x
      const dz = tz - gm.z
      const l = Math.hypot(dx, dz)
      if (l > 0.05) {
        const ox = gm.x
        const oz = gm.z
        gm.x += (dx / l) * Math.min(l, speed * DT)
        gm.z += (dz / l) * Math.min(l, speed * DT)
        resolve(gm, 0.3, C)
        stall = Math.hypot(gm.x - ox, gm.z - oz) < speed * DT * 0.3 ? stall + DT : 0
        if (stall > 0.4 && detour <= 0) {
          const sgn = botRnd() < 0.5 ? 1 : -1
          side = [(-dz / l) * 2 * sgn, (dx / l) * 2 * sgn]
          detour = 0.8
          stall = 0
        }
      }
    }
    const ev = stepPlay(rt, DT, gm)
    for (const k of rt.kids) {
      if ((k.mode === 'flee' || k.mode === 'idle') && inside(k.x, k.z)) stuck++
      const b = C.bounds
      if (k.x < b.x0 - 0.01 || k.x > b.x1 + 0.01 || k.z < b.z0 - 0.01 || k.z > b.z1 + 0.01) stuck++
    }
    const end = ev.find((e) => e.t === 'end')
    if (end && end.t === 'end') {
      if (process.env.DEBUG && !end.won) console.log('   left:', rt.kids.filter((k) => k.mode === 'hidden' || k.mode === 'flee').map((k) => `${k.id}@${k.x.toFixed(1)},${k.z.toFixed(1)}`).join(' '), 'gm', gm.x.toFixed(1), gm.z.toFixed(1))
      return { won: end.won, count: end.count, time: rt.time, stuck }
    }
  }
  if (process.env.DEBUG) console.log('   left:', rt.kids.filter((k) => k.mode === 'hidden' || k.mode === 'flee').map((k) => `${k.id}@${k.x.toFixed(1)},${k.z.toFixed(1)}`).join(' '), 'gm', gm.x.toFixed(1), gm.z.toFixed(1))
  return { won: false, count: rt.count, time: rt.time, stuck }
}

let problems = 0
const runs = (kind: 'tag' | 'hide', speed: number, n: number) => Array.from({ length: n }, (_, i) => play(kind, speed, 11 + i * 17))
const summary = (label: string, rs: ReturnType<typeof play>[]) => {
  const won = rs.filter((r) => r.won).length
  const avg = rs.reduce((a, r) => a + r.count, 0) / rs.length
  const stuck = rs.reduce((a, r) => a + r.stuck, 0)
  console.log(`${label.padEnd(18)} 贏 ${won}/${rs.length}  平均抓到 ${avg.toFixed(1)}  卡在碰撞裡 ${stuck} 幀`)
  if (stuck > 0) problems++
  return won / rs.length
}

const idle = summary('鬼抓人：站著不動', runs('tag', 0, 5))
const walk = summary('鬼抓人：用走的', runs('tag', 2.5, 20))
const dash = summary('鬼抓人：快飄', runs('tag', 4.3, 20))
const hide = summary('躲貓貓：走一圈', runs('hide', 2.5, 20))
if (idle > 0) {
  console.log('!! 站著不動也能贏')
  problems++
}
if (dash < 0.8) {
  console.log('!! 快飄還抓不完：小孩太快了')
  problems++
}
if (walk > 0.9) {
  console.log('!! 用走的就全部抓得到：太簡單')
  problems++
}
if (hide < 0.9) {
  console.log('!! 躲貓貓 60 秒找不完')
  problems++
}
console.log(problems ? `\n${problems} problem(s)` : '\nall school games OK')
process.exit(problems ? 1 : 0)
