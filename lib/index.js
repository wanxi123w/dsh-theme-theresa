/**
 * 特蕾西娅主题 —— Host 半
 *
 * 只做两件事，别的都交给客户端半：
 *   1. 把 `Background/` 里的图以字节发出去（页面是 http 来源，读不了 file://）；
 *   2. 读写主题设定（开关、背景选择、色纱浓度、装饰开关）。
 *
 * 图片不做 base64 内联：路由出图能直出原图，客户端半也不用背几百 KB 的字符串。
 */
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 本包目录（lib/ 的上一层）。 */
const PKG_DIR = dirname(dirname(fileURLToPath(import.meta.url)))
/** 随包发布的背景图目录。 */
const BACKGROUND_DIR = join(PKG_DIR, 'Background')
/** 用户自传的背景图目录：与随包发布的分开，才分得清"哪些能删"。 */
const CUSTOM_BACKGROUND_DIR = join(PKG_DIR, 'Background-custom')
/** 用户上传的侧栏立绘库（可以有多张，选一张生效）。 */
const FIGURES_DIR = join(CUSTOM_BACKGROUND_DIR, 'figures')
/** 本包独占的路由前缀。 */
const ROUTE_PREFIX = '/theresa'
/** 设定文件名（放在 $DSH_HOME 下）。 */
const STATE_FILE = 'theresa-theme.json'
/** 设定请求体上限。 */
const MAX_STATE_BYTES = 256 * 1024
/** 单张上传图的解码后上限。 */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
/** 上传请求体上限（base64 会膨胀约 1/3，再留余量）。 */
const MAX_UPLOAD_BODY = 20 * 1024 * 1024
/** 允许上传的图片类型 → 落盘扩展名。 */
const UPLOAD_TYPES = {
  'image/webp': '.webp',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/avif': '.avif',
  'image/gif': '.gif',
}
/** 认识的图片类型。 */
const IMAGE_TYPES = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
}

/** 开屏动画与它的首帧。以 `opening` 开头的文件不算"可选背景"。 */
const OPENING_VIDEO = { name: 'opening.mp4', type: 'video/mp4' }
const OPENING_POSTER = { name: 'opening-poster.webp', type: 'image/webp' }

/** 落款素材：墨/金两层，中英各一组（由 tools/prepare_signature.py 产出）。 */
const SIGNATURE_FILES = [
  'signature-cn-ink.png',
  'signature-cn-gold.png',
  'signature-en-ink.png',
  'signature-en-gold.png',
]

/** 这些前缀的文件是本插件的固定部件，不该出现在"可选背景"里。 */
const RESERVED_PREFIXES = ['opening', 'signature-', 'sidebar-']

/** 欢迎页文案的书法字体子集（霞鹜文楷 LXGW WenKai TC，OFL；只含那句话的字形，2.6 KB）。 */
const HEADLINE_FONT = { name: 'headline.woff2', type: 'font/woff2' }

/** 侧栏空白处的立绘（透明底，480×953）。 */
const SIDEBAR_FIGURE = { name: 'sidebar-figure.webp', type: 'image/webp' }

/** 用户自传的侧栏立绘在 Background-custom/ 用这个基名（扩展名随上传格式）。 */
const SIDEBAR_FIGURE_BASE = 'sidebar-figure'

/** 默认设定：新装即有画面。 */
function defaultState() {
  return {
    rev: 1,
    enabled: true,
    // dim 分白昼/长夜两档：同一个浓度在两张画上的观感并不对称
    background: {
      current: '',
      dim: { light: 0.12, dark: 0.18 },
      // 构图：默认整张铺满、正中，用户可把人物挪到一侧
      fit: 'cover',
      focus: { x: 50, y: 50 },
      zoom: 1,
      // 阅读衬底强度：正文那一侧垫多厚，0 = 完全不要
      substrate: 0.25,
    },
    decoration: {
      petals: true,
      // 默认少而慢：14 片更像噪点，8 片才看得见"景深"
      petalCount: 8,
      crownMark: true,
      heroCrown: true,
      seal: true,
      sealLatin: true,
      frame: true,
      figure: true,
      figureScale: 1,
      // 0 = 清淡 / 1 = 标准 / 2 = 厚重
      glass: 1,
      // 大面铺底的通透度：100 几乎不蒙，0 偏实
      clarity: 55,
      figureOpacity: 0.62,
      figureInset: 0,
    },
    opening: { enabled: true, oncePerSession: true, sound: false },
    // 侧栏立绘：空字符串 = 用随包那张
    figure: { current: '' },
    // 欢迎页那句 headline 由宿主渲染（locale key `hero.headline`，26px/500）。
    // 不替换宿主组件、也不碰 React：用一条作用域 CSS 把它换掉，文案与开关都放这里。
    hero: { replace: true, headline: '去找到你自己吧……' },
  }
}

/** 设定文件路径：优先 $DSH_HOME，否则 ~/.dsh。 */
function statePath() {
  const home =
    typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() !== ''
      ? process.env.DSH_HOME.trim()
      : join(homedir(), '.dsh')
  return join(home, STATE_FILE)
}

/** 数值收敛。 */
function clamp(value, min, max, fallback) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** 布尔收敛。 */
function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * 色纱浓度：新版是 `{ light, dark }`，旧版是单个数字。
 * 旧数据按同值迁移，两边都收敛到 0–0.9。
 */
function sanitizeDim(value, fallback) {
  const pair = typeof value === 'number' ? { light: value, dark: value } : value
  const source = pair !== null && typeof pair === 'object' ? pair : {}
  return {
    light: clamp(source.light, 0, 0.9, fallback.light),
    dark: clamp(source.dark, 0, 0.9, fallback.dark),
  }
}

/**
 * 乱码兜底：UTF-8 的中文曾被按 GBK 读一次，会变成 `鍘绘壘鍒颁綘…` 这种字。
 * 这些字在正常中文里几乎不会连续出现，命中两个以上就判定为坏数据，回落到默认句。
 */
const MOJIBAKE_MARKERS = ['鍘', '鍒', '鑷', '鍚', '繪', '壘', '鏄', '犲', '綘', '頒']

function looksLikeMojibake(text) {
  let hits = 0
  for (const marker of MOJIBAKE_MARKERS) {
    if (text.includes(marker)) {
      hits += 1
      if (hits >= 2) return true
    }
  }
  return false
}

/** 欢迎页文案：会被写进 CSS 字符串，所以去掉引号/反斜杠/控制字符，并封顶 40 字。 */
function sanitizeHeadline(value, fallback) {
  if (typeof value !== 'string') return fallback
  if (looksLikeMojibake(value)) return fallback
  const cleaned = value
    .replace(/[\\"'\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  return cleaned === '' ? fallback : cleaned
}

/** 构图适配：只认 cover / contain。 */
function sanitizeFit(value, fallback) {
  return value === 'contain' || value === 'cover' ? value : fallback
}

/** 焦点百分比：0–100 的整数，缺项落回当前值。 */
function sanitizeFocus(value, fallback) {
  const source = value !== null && typeof value === 'object' ? value : {}
  return {
    x: Math.round(clamp(source.x, 0, 100, fallback.x)),
    y: Math.round(clamp(source.y, 0, 100, fallback.y)),
  }
}

/** 把外部写入收敛成合法设定；缺项落回 `previous`（再退到默认）。 */
function sanitize(raw, previous) {
  const base = defaultState()
  const prior = previous ?? base
  if (raw === null || typeof raw !== 'object') return base
  const bg = raw.background !== null && typeof raw.background === 'object' ? raw.background : {}
  const deco = raw.decoration !== null && typeof raw.decoration === 'object' ? raw.decoration : {}
  const opening = raw.opening !== null && typeof raw.opening === 'object' ? raw.opening : {}
  return {
    rev: Number.isInteger(raw.rev) ? raw.rev : base.rev,
    enabled: bool(raw.enabled, base.enabled),
    background: {
      // 只留纯文件名：目录穿越在这一层就掐掉
      current: typeof bg.current === 'string' ? basename(bg.current) : base.background.current,
      // 部分写入也要保住另一个键：缺的那半落回"当前值"，不是默认值
      dim: sanitizeDim(bg.dim, prior.background.dim),
      fit: sanitizeFit(bg.fit, prior.background.fit ?? base.background.fit),
      focus: sanitizeFocus(bg.focus, prior.background.focus ?? base.background.focus),
      zoom: clamp(bg.zoom, 1, 1.8, prior.background.zoom ?? base.background.zoom),
      substrate: clamp(bg.substrate, 0, 1, prior.background.substrate ?? base.background.substrate),
    },
    decoration: {
      petals: bool(deco.petals, base.decoration.petals),
      petalCount: Math.round(clamp(deco.petalCount, 0, 14, base.decoration.petalCount)),
      crownMark: bool(deco.crownMark, base.decoration.crownMark),
      heroCrown: bool(deco.heroCrown, base.decoration.heroCrown),
      seal: bool(deco.seal, base.decoration.seal),
      sealLatin: bool(deco.sealLatin, base.decoration.sealLatin),
      frame: bool(deco.frame, base.decoration.frame),
      figure: bool(deco.figure, base.decoration.figure),
      figureScale: clamp(deco.figureScale, 0.6, 1.3, base.decoration.figureScale),
      glass: Math.round(clamp(deco.glass, 0, 2, base.decoration.glass)),
      clarity: Math.round(clamp(deco.clarity, 0, 100, base.decoration.clarity)),
      figureOpacity: clamp(deco.figureOpacity, 0.3, 1, base.decoration.figureOpacity),
      figureInset: Math.round(clamp(deco.figureInset, 0, 120, base.decoration.figureInset)),
    },
    opening: {
      enabled: bool(opening.enabled, base.opening.enabled),
      oncePerSession: bool(opening.oncePerSession, base.opening.oncePerSession),
      sound: bool(opening.sound, base.opening.sound),
    },
    figure: {
      // 只是个文件名；真的存不存在由 refreshFigures 在读取时校验
      current: typeof raw.figure?.current === 'string' ? raw.figure.current.slice(0, 120) : (prior.figure?.current ?? ''),
    },
    hero: {
      replace: bool(raw.hero?.replace, base.hero.replace),
      // 这段文案要进 CSS 字符串：去掉引号、反斜杠与控制字符，长度也封顶
      headline: sanitizeHeadline(raw.hero?.headline, prior.hero.headline),
    },
  }
}

let state = defaultState()
let loading = null
let backgrounds = []
let figures = []

/** 读一次设定文件；并发调用共享同一个 promise，避免"半加载"被当成已加载。 */
function ensureLoaded() {
  if (loading === null) {
    loading = (async () => {
      try {
        const raw = await readFile(statePath(), 'utf8')
        state = sanitize(JSON.parse(raw))
      } catch {
        // 没文件或文件坏了：用默认值，不打扰用户
      }
      await refreshBackgrounds()
      await refreshFigures()
    })()
  }
  return loading
}

/** 重新扫描背景图目录。 */
async function refreshBackgrounds() {
  let names = []
  try {
    names = await readdir(BACKGROUND_DIR)
  } catch {
    names = []
  }
  let customNames = []
  try {
    customNames = await readdir(CUSTOM_BACKGROUND_DIR)
  } catch {
    customNames = []
  }
  const items = []
  const seen = new Set()
  // 先包内、后自传；同名只留先出现的那条
  for (const [dir, origin, list] of [
    [BACKGROUND_DIR, 'package', names],
    [CUSTOM_BACKGROUND_DIR, 'custom', customNames],
  ]) {
    for (const name of [...list].sort()) {
      // 开屏与落款素材是固定部件，不进可选背景
      if (RESERVED_PREFIXES.some((prefix) => name.startsWith(prefix))) continue
      if (seen.has(name)) continue
      const type = IMAGE_TYPES[extname(name).toLowerCase()]
      if (type === undefined) continue
      const abs = join(dir, name)
      try {
        const info = await stat(abs)
        if (!info.isFile()) continue
        seen.add(name)
        items.push({ name, bytes: info.size, mtimeMs: info.mtimeMs, type, abs, origin })
      } catch {
        // 读不到的条目直接跳过
      }
    }
  }
  backgrounds = items
  if (state.background.current === '' || !items.some((i) => i.name === state.background.current)) {
    state.background.current = items.length > 0 ? items[0].name : ''
  }
  return items
}

/** 扫一遍用户上传的立绘库：新的排在前面，读不到的跳过。 */
async function refreshFigures() {
  let names = []
  try {
    names = await readdir(FIGURES_DIR)
  } catch {
    names = []
  }
  const items = []
  for (const name of names) {
    const type = IMAGE_TYPES[extname(name).toLowerCase()]
    if (type === undefined) continue
    const abs = join(FIGURES_DIR, name)
    try {
      const info = await stat(abs)
      if (!info.isFile()) continue
      items.push({ name, type, bytes: info.size, mtimeMs: info.mtimeMs, abs, origin: 'custom' })
    } catch {
      // 读不到就跳过
    }
  }
  items.sort((a, b) => b.mtimeMs - a.mtimeMs)
  figures = items
  // 选中的那张被删了就回落到随包那张
  if (state.figure.current !== '' && !items.some((item) => item.name === state.figure.current)) {
    state.figure.current = ''
  }
  return items
}

/** 当前生效的立绘文件：选中的自定义 > 随包默认。 */
async function effectiveFigure() {
  const picked = figures.find((item) => item.name === state.figure.current)
  if (picked !== undefined) return picked
  return describeInBackground(SIDEBAR_FIGURE.name, SIDEBAR_FIGURE.type)
}

/**
 * 原子落盘（先写临时文件再改名，避免半截 JSON）。
 *
 * 两件事必须做对：
 *   1. 串行化 —— 多个请求共用同一个 .tmp 文件名，并发写会互相踩；
 *   2. 不吞错 —— 写失败时内存态仍生效，但调用方必须知道"这次没存住"。
 */
let persistChain = Promise.resolve()
function persist() {
  const run = async () => {
    const target = statePath()
    const tmp = `${target}.tmp`
    await writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
    await rename(tmp, target)
  }
  // 前一次失败不能掐断后面的写入，所以链上先兜住错误
  const task = persistChain.catch(() => undefined).then(run)
  persistChain = task.catch(() => undefined)
  return task
}

/** 把一个包内文件描述成可发送的条目；读不到就返回 undefined。 */
async function describeIn(dir, name, type) {
  const abs = join(dir, name)
  try {
    const info = await stat(abs)
    if (!info.isFile()) return undefined
    return { name, type, bytes: info.size, mtimeMs: info.mtimeMs, abs }
  } catch {
    return undefined
  }
}

/** 包内文件（Background/）。 */
function describeInBackground(name, type) {
  return describeIn(BACKGROUND_DIR, name, type)
}

/** 开屏动画当前是否可用（文件在不在）。 */
async function openingInfo() {
  const video = await describeInBackground(OPENING_VIDEO.name, OPENING_VIDEO.type)
  const poster = await describeInBackground(OPENING_POSTER.name, OPENING_POSTER.type)
  return { video, poster }
}

/** 落款素材是否齐（四个文件都要在）。 */
async function signatureAvailable() {
  const found = await Promise.all(SIGNATURE_FILES.map((name) => describeInBackground(name, 'image/png')))
  return found.every((item) => item !== undefined)
}

/** 给客户端半的状态快照（把磁盘上的实时信息一并算好）。 */
async function publicState() {
  const opening = await openingInfo()
  const signature = await signatureAvailable()
  const active = await effectiveFigure()
  const packaged = await describeInBackground(SIDEBAR_FIGURE.name, SIDEBAR_FIGURE.type)
  return {
    rev: state.rev,
    enabled: state.enabled,
    // 背景：整份发出去（含构图字段），客户端只负责投影
    background: { ...state.background },
    decoration: { ...state.decoration },
    // 侧栏立绘的"已选文件"必须原样回传：客户端保存时以此为准，
    // 之前漏了这一项，导致选完立绘再改别的设置就被打回随包那张。
    figure: { current: state.figure.current },
    opening: {
      ...state.opening,
      hasOpening: opening.video !== undefined,
      posterUrl: opening.poster === undefined ? null : `${ROUTE_PREFIX}/opening/poster`,
    },
    signature: { available: signature },
    sidebarFigure: {
      // '' 表示用随包那张
      current: state.figure.current,
      custom: state.figure.current !== '',
      // version 用生效文件的修改时间，客户端拼在 URL 后面破缓存
      version: active === undefined ? 0 : Math.round(active.mtimeMs),
      options: [
        // 分发的精简包里没有随包立绘，这时就不要列出"随包立绘"这一项（否则是裂图）
        ...(packaged === undefined
          ? []
          : [
              {
                name: SIDEBAR_FIGURE.name,
                origin: 'package',
                url: `${ROUTE_PREFIX}/figure/${encodeURIComponent(SIDEBAR_FIGURE.name)}`,
              },
            ]),
        ...figures.map((item) => ({
          name: item.name,
          origin: 'custom',
          url: `${ROUTE_PREFIX}/figure/${encodeURIComponent(item.name)}`,
        })),
      ],
    },
    hero: { ...state.hero },
    backgrounds: backgrounds.map((item) => ({
      name: item.name,
      url: `${ROUTE_PREFIX}/background/${encodeURIComponent(item.name)}`,
      bytes: item.bytes,
      // 只有自传的能删；随包发布的删了会被下次更新装回来
      origin: item.origin,
    })),
  }
}

/** 发 JSON。 */
function sendJson(res, code, value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8')
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(body)
}

/** 读请求体（带上限）。 */
async function readJsonBody(req, limit = MAX_STATE_BYTES) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > limit) throw new Error('body-too-large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** 拆 data URL：`data:image/png;base64,AAAA` → `{ mime, bytes }`。 */
function parseDataUrl(value) {
  if (typeof value !== 'string') return undefined
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(value.trim())
  if (match === null) return undefined
  return { mime: match[1].toLowerCase(), bytes: Buffer.from(match[2], 'base64') }
}

/** 用户给的名字收敛成安全文件名：去目录成分、去非法字符、按 mime 定扩展名。 */
function safeUploadName(raw, ext) {
  const base = typeof raw === 'string' ? basename(raw).replace(/\.[a-z0-9]+$/i, '') : ''
  const cleaned = base
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48)
  return `${cleaned === '' ? `upload-${Date.now().toString(36)}` : cleaned}${ext}`
}

/**
 * 落盘前避开同名文件：`day.webp` 已存在就改 `day-2.webp`、`day-3.webp`…
 * 绝不覆盖用户已经上传过的图 —— 旧版会静默覆盖，用户以为"只是换了一张"。
 */
async function uniqueIn(dir, name) {
  const ext = extname(name)
  const stem = name.slice(0, name.length - ext.length)
  for (let index = 1; index < 1000; index += 1) {
    const candidate = index === 1 ? name : `${stem}-${index}${ext}`
    const taken = await stat(join(dir, candidate)).then(
      () => true,
      () => false,
    )
    if (!taken) return candidate
  }
  return `${stem}-${Date.now().toString(36)}${ext}`
}

/**
 * 发一张图或视频：ETag 用「字节数-修改时间」，命中就回 304。
 *
 * 必须支持 **Range**：`<video>` 会先发 `Range: bytes=0-` 再看 `Content-Range`，
 * 只回 200 全量时 Chromium 拿不到可靠时长，播放器可能只播开头就"结束"，
 * 我们的"时长 + 兜底"也因此误判。
 */
async function sendAsset(req, res, item) {
  const etag = `"${item.bytes.toString(16)}-${Math.round(item.mtimeMs).toString(16)}"`
  if (req.headers?.['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag })
    res.end()
    return
  }
  const bytes = await readFile(item.abs)
  const total = bytes.length
  const common = {
    'Content-Type': item.type,
    'Cache-Control': 'private, max-age=300',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
  }

  const range = typeof req.headers?.range === 'string' ? req.headers.range.trim() : ''
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (match !== null && (match[1] !== '' || match[2] !== '')) {
    let start = match[1] === '' ? null : Number(match[1])
    let end = match[2] === '' ? null : Number(match[2])
    // `bytes=-500`：取末尾 500 字节
    if (start === null) {
      const tail = end ?? 0
      start = Math.max(0, total - tail)
      end = total - 1
    }
    if (end === null || end >= total) end = total - 1
    if (start >= total || start > end) {
      res.writeHead(416, { ...common, 'Content-Range': `bytes */${total}` })
      res.end()
      return
    }
    const slice = bytes.subarray(start, end + 1)
    res.writeHead(206, {
      ...common,
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': slice.length,
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.end(slice)
    return
  }

  res.writeHead(200, { ...common, 'Content-Length': total })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  res.end(bytes)
}

export const inject = ['webServer']

/**
 * 注册 `/theresa/*` 路由。
 * @param ctx - Host 插件上下文（需要 webServer）。
 */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: async (req, res) => {
          const url = new URL(req.url ?? '/', 'http://theresa.invalid')
          const route = url.pathname.slice(ROUTE_PREFIX.length) || '/'
          try {
            await ensureLoaded()
            const opening = await openingInfo()
            const signature = await signatureAvailable()

            if (route === '/state' && req.method === 'GET') {
              sendJson(res, 200, { ok: true, value: await publicState() })
              return
            }

            if (route === '/state' && req.method === 'POST') {
              const body = await readJsonBody(req)
              if (body?.rev !== state.rev) {
                // 版本对不上：把最新快照交回去，让客户端自己重来一次
                sendJson(res, 409, { ok: false, error: { code: 'stale' }, value: await publicState() })
                return
              }
              const next = sanitize({ ...state, ...body, rev: state.rev + 1 }, state)
              state = next
              try {
                await persist()
              } catch (error) {
                const reason = error instanceof Error ? error.message : String(error)
                // 内存里已经生效，但必须让客户端知道"这次没存住"
                sendJson(res, 500, {
                  ok: false,
                  error: { code: 'persist-failed', message: reason },
                  value: await publicState(),
                })
                return
              }
              sendJson(res, 200, { ok: true, value: await publicState() })
              return
            }

            // 开屏动画与它的首帧：和背景图同一套 ETag/304
            if ((route === '/opening' || route === '/opening/poster') && (req.method === 'GET' || req.method === 'HEAD')) {
              const item = route === '/opening' ? opening.video : opening.poster
              if (item === undefined) {
                sendJson(res, 404, { ok: false, error: { code: 'not-found' } })
                return
              }
              await sendAsset(req, res, item)
              return
            }

            if (route === '/backgrounds' && req.method === 'GET') {
              await refreshBackgrounds()
              sendJson(res, 200, {
                ok: true,
                value: {
                  items: backgrounds.map((item) => ({
                    name: item.name,
                    url: `${ROUTE_PREFIX}/background/${encodeURIComponent(item.name)}`,
                    bytes: item.bytes,
                    origin: item.origin,
                  })),
                },
              })
              return
            }

            // 书法字体子集（woff2）：给欢迎页那句话用
            if (route === '/headline-font' && (req.method === 'GET' || req.method === 'HEAD')) {
              const item = await describeInBackground(HEADLINE_FONT.name, HEADLINE_FONT.type)
              if (item === undefined) {
                sendJson(res, 404, { ok: false, error: { code: 'not-found' } })
                return
              }
              await sendAsset(req, res, item)
              return
            }

            // 侧栏立绘：当前生效的那张（选中的自定义 > 随包默认）
            if (route === '/sidebar-figure' && (req.method === 'GET' || req.method === 'HEAD')) {
              const item = await effectiveFigure()
              if (item === undefined) {
                sendJson(res, 404, { ok: false, error: { code: 'not-found' } })
                return
              }
              await sendAsset(req, res, item)
              return
            }

            // 自传一张立绘：存进 Background-custom/figures/，可以留很多张，选中的那张生效
            if (route === '/sidebar-figure/upload' && req.method === 'POST') {
              const body = await readJsonBody(req, MAX_UPLOAD_BODY)
              const parsed = parseDataUrl(body?.dataUrl)
              if (parsed === undefined) {
                sendJson(res, 400, { ok: false, error: { code: 'bad-image' } })
                return
              }
              const ext = UPLOAD_TYPES[parsed.mime]
              if (ext === undefined) {
                sendJson(res, 400, { ok: false, error: { code: 'unsupported-type', mime: parsed.mime } })
                return
              }
              if (parsed.bytes.length > MAX_UPLOAD_BYTES) {
                sendJson(res, 413, { ok: false, error: { code: 'too-large', bytes: parsed.bytes.length } })
                return
              }
              await mkdir(FIGURES_DIR, { recursive: true })
              const requested = safeUploadName(body?.name, ext)
              const name = await uniqueIn(FIGURES_DIR, requested)
              await writeFile(join(FIGURES_DIR, name), parsed.bytes)
              await refreshFigures()
              state.figure.current = name
              // 换图也推进 rev：否则并发中的旧保存会把刚选的立绘盖回去
              state.rev += 1
              await persist()
              sendJson(res, 200, { ok: true, name, renamed: name !== requested, value: await publicState() })
              return
            }

            // 删掉库里的一张立绘；删的正好是选中的那张就回落到随包
            if (route === '/sidebar-figure/remove' && req.method === 'POST') {
              const body = await readJsonBody(req, MAX_STATE_BYTES)
              const name = typeof body?.name === 'string' ? basename(body.name) : ''
              const target = figures.find((item) => item.name === name)
              if (target === undefined) {
                sendJson(res, 400, { ok: false, error: { code: 'not-custom' } })
                return
              }
              await unlink(target.abs).catch(() => {})
              if (state.figure.current === name) state.figure.current = ''
              await refreshFigures()
              state.rev += 1
              await persist()
              sendJson(res, 200, { ok: true, value: await publicState() })
              return
            }

            // 立绘库里任意一张（缩略图用）：白名单 = 已扫描到的文件名，外加随包那张
            if (route.startsWith('/figure/') && (req.method === 'GET' || req.method === 'HEAD')) {
              const name = basename(decodeURIComponent(route.slice('/figure/'.length)))
              const item =
                name === SIDEBAR_FIGURE.name
                  ? await describeInBackground(SIDEBAR_FIGURE.name, SIDEBAR_FIGURE.type)
                  : figures.find((entry) => entry.name === name)
              if (item === undefined) {
                sendJson(res, 404, { ok: false, error: { code: 'not-found' } })
                return
              }
              await sendAsset(req, res, item)
              return
            }

            // 落款素材：白名单内的四个文件，目录穿越在这一步被挡住
            if (route.startsWith('/signature/') && (req.method === 'GET' || req.method === 'HEAD')) {
              const name = basename(decodeURIComponent(route.slice('/signature/'.length)))
              const item = SIGNATURE_FILES.includes(name)
                ? await describeInBackground(name, 'image/png')
                : undefined
              if (item === undefined) {
                sendJson(res, 404, { ok: false, error: { code: 'not-found' } })
                return
              }
              await sendAsset(req, res, item)
              return
            }

            // 自传一张背景图：body 是 data URL，落在 Background-custom/
            if (route === '/backgrounds/upload' && req.method === 'POST') {
              const body = await readJsonBody(req, MAX_UPLOAD_BODY)
              const parsed = parseDataUrl(body?.dataUrl)
              if (parsed === undefined) {
                sendJson(res, 400, { ok: false, error: { code: 'bad-image' } })
                return
              }
              const ext = UPLOAD_TYPES[parsed.mime]
              if (ext === undefined) {
                sendJson(res, 400, { ok: false, error: { code: 'unsupported-type', mime: parsed.mime } })
                return
              }
              if (parsed.bytes.length > MAX_UPLOAD_BYTES) {
                sendJson(res, 413, { ok: false, error: { code: 'too-large', bytes: parsed.bytes.length } })
                return
              }
              const requested = safeUploadName(body?.name, ext)
              await mkdir(CUSTOM_BACKGROUND_DIR, { recursive: true })
              const safe = await uniqueIn(CUSTOM_BACKGROUND_DIR, requested)
              await writeFile(join(CUSTOM_BACKGROUND_DIR, safe), parsed.bytes)
              await refreshBackgrounds()
              state.background.current = safe
              state.rev += 1
              await persist()
              sendJson(res, 200, { ok: true, name: safe, renamed: safe !== requested, value: await publicState() })
              return
            }

            // 只允许删自传的那几张
            if (route === '/backgrounds/remove' && req.method === 'POST') {
              const body = await readJsonBody(req)
              const item = backgrounds.find((entry) => entry.name === body?.name)
              if (item === undefined || item.origin !== 'custom') {
                sendJson(res, 400, { ok: false, error: { code: 'not-custom' } })
                return
              }
              await unlink(item.abs)
              await refreshBackgrounds()
              state.rev += 1
              await persist()
              sendJson(res, 200, { ok: true, value: await publicState() })
              return
            }

            if (route.startsWith('/background/') && (req.method === 'GET' || req.method === 'HEAD')) {
              const name = decodeURIComponent(route.slice('/background/'.length))
              // 只服务清单里出现过的那几张，目录穿越在这一步被挡住
              const item = backgrounds.find((entry) => entry.name === name)
              if (item === undefined) {
                sendJson(res, 404, { ok: false, error: { code: 'not-found' } })
                return
              }
              await sendAsset(req, res, item)
              return
            }

            sendJson(res, 404, { ok: false, error: { code: 'not-found' } })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (message === 'body-too-large') {
              sendJson(res, 413, { ok: false, error: { code: 'too-large' } })
              return
            }
            sendJson(res, 500, { ok: false, error: { code: 'internal', message } })
          }
        },
      }),
    'theresa: routes',
  )

  void ensureLoaded().then(() => {
    ctx.logger?.info?.(
      `theresa: ${backgrounds.length} background(s), current=${state.background.current || 'none'}, enabled=${state.enabled}`,
    )
  })
}
