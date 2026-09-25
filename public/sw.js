// 離線快取：玩過一次之後，程式、貼圖、語音、音效、字型都從手機裡拿，第二次打開幾乎秒開，也能離線玩。
// GitHub Pages 只給 10 分鐘快取，每次打開都要一個一個檔案回去問（每個約 0.5 秒），這裡把它接手過來。
//
//   index.html                 先問網路（才拿得到新版）；3 秒沒回應或斷線就用快取
//   assets/*                   檔名有雜湊、內容不會變 → 快取優先；新版上線後，沒被新 index.html 用到的舊檔會刪掉
//   tex/ voice/ sfx/           快取優先（貼圖網址帶 ?v=、語音帶 ?h=內容雜湊，內容一變網址就變）
//   */manifest.json            先問網路
//   Google 字型                快取優先（字型檔網址不會變）
//
// 只在正式版註冊（src/main.tsx），dev server 不受影響。改了快取規則就把 V 加一。

const V = 'v1'
const PAGES = `pages-${V}`
const ASSETS = `assets-${V}`
const MEDIA = `media-${V}`
const FONTS = `fonts-${V}`

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keep = [PAGES, ASSETS, MEDIA, FONTS]
      for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin === self.location.origin) {
    const scope = new URL(self.registration.scope).pathname
    if (!url.pathname.startsWith(scope)) return
    const path = url.pathname.slice(scope.length)
    if (req.mode === 'navigate' || path === '' || path === 'index.html') {
      e.respondWith(networkFirst(req, PAGES, 3000, trimAssets))
    } else if (path.startsWith('assets/')) {
      e.respondWith(cacheFirst(req, ASSETS))
    } else if (path.endsWith('manifest.json')) {
      e.respondWith(networkFirst(req, MEDIA, 4000))
    } else if (/^(tex|voice|sfx)\//.test(path)) {
      e.respondWith(cacheFirst(req, MEDIA))
    }
    return
  }
  if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') e.respondWith(cacheFirst(req, FONTS))
})

const usable = (res) => res && (res.ok || res.type === 'opaque')

async function cacheFirst(req, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (usable(res)) cache.put(req, res.clone()).catch(() => {})
  return res
}

async function networkFirst(req, name, timeoutMs, after) {
  const cache = await caches.open(name)
  const hit = await cache.match(req, { ignoreSearch: true })
  const net = fetch(req).then(async (res) => {
    if (res.ok) {
      await cache.put(req, res.clone()).catch(() => {})
      if (after) after(res.clone()).catch(() => {})
    }
    return res
  })
  if (!hit) return net
  // 有舊版可以用：網路太慢就先給舊版（新版照樣在背景存起來，下次打開就是新的）
  const timeout = new Promise((resolve) => setTimeout(() => resolve(hit), timeoutMs))
  return Promise.race([net.catch(() => hit), timeout])
}

/** 新的 index.html 用到哪些 assets/，其他舊版的檔案就刪掉（不然每次更新都多存一份） */
async function trimAssets(res) {
  const html = await res.text()
  const used = new Set((html.match(/assets\/[^"'?#\s)]+/g) || []).map((p) => p.split('/').pop()))
  if (!used.size) return
  const cache = await caches.open(ASSETS)
  for (const req of await cache.keys()) {
    const file = new URL(req.url).pathname.split('/').pop()
    // CSS 裡引用的字型、圖片也在 assets/，只刪 js／css
    if (/\.(js|css)$/.test(file) && !used.has(file)) await cache.delete(req)
  }
}
