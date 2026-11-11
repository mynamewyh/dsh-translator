/**
 * Host half of the Translator bundle.
 *
 * Serves a small JSON API on the local web carrier so the Client half (the
 * left-sidebar panel) can request translations without talking to any remote
 * origin directly. Every provider call happens here, in Node, where CORS and
 * provider credentials are not a factor.
 *
 * Route namespace: <PREFIX>/config, <PREFIX>/translate
 * The browser half reads its access token from the injected global
 * `__DSH_TRANSLATOR__` (see the `webserver/index-inject` listener below).
 */

import { randomUUID } from 'node:crypto'

const PREFIX = '/dsh-translator'
const TOKEN_GLOBAL = '__DSH_TRANSLATOR__'
const MAX_TEXT_CHARS = 6000

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
const LATIN_RE = /[A-Za-z]/g

export const inject = ['webServer']

const CACHE_LIMIT = 300
const cache = new Map()

function cacheGet(key) {
  const hit = cache.get(key)
  if (hit === undefined) return undefined
  cache.delete(key)
  cache.set(key, hit)
  return hit
}

function cacheSet(key, value) {
  cache.set(key, value)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next()
    if (oldest.done) break
    cache.delete(oldest.value)
  }
}

/** Resolve the language pair for one request. */
function resolveDirection(text, mode) {
  if (mode === 'zh-en') return { source: 'zh-CN', target: 'en' }
  if (mode === 'en-zh') return { source: 'en', target: 'zh-CN' }
  const cjk = (text.match(CJK_RE) ?? []).length
  const latin = (text.match(LATIN_RE) ?? []).length
  if (cjk === 0 && latin === 0) return { source: 'auto', target: 'zh-CN' }
  return cjk >= latin ? { source: 'zh-CN', target: 'en' } : { source: 'en', target: 'zh-CN' }
}

/** Split long text on natural boundaries so every provider request stays small. */
function chunkText(text, size = 900) {
  if (text.length <= size) return [text]
  const out = []
  let rest = text
  while (rest.length > size) {
    let cut = -1
    for (const boundary of ['\n', '。', '！', '？', '. ', '! ', '? ', '; ', ';']) {
      const index = rest.lastIndexOf(boundary, size)
      if (index > cut) cut = index
    }
    if (cut < size * 0.4) {
      const space = rest.lastIndexOf(' ', size)
      cut = space > size * 0.4 ? space : size - 1
    }
    out.push(rest.slice(0, cut + 1))
    rest = rest.slice(cut + 1)
  }
  if (rest.length > 0) out.push(rest)
  return out
}

function messageOf(error) {
  if (error instanceof Error) return error.message
  return String(error)
}

const ENTITIES = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&amp;': '&' }

function unescapeHtml(value) {
  return value.replace(/&(?:lt|gt|quot|#39|nbsp|amp);/g, (entity) => ENTITIES[entity] ?? entity)
}

/**
 * Primary route: Youdao's public demo endpoint. Measured ~60-200 ms from this
 * host, handles both directions, and returns a plain JSON body.
 */
async function youdaoTranslate(text, source, target) {
  // Youdao spells the Simplified-Chinese code `zh-CHS`; the rest matches BCP-47.
  const toYoudao = (code) => (code === 'zh-CN' ? 'zh-CHS' : code)
  const from = source === 'auto' ? 'Auto' : toYoudao(source)
  const to = toYoudao(target)
  const body = `q=${encodeURIComponent(text)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  const response = await fetch('https://aidemo.youdao.com/trans', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) dsh-translator',
    },
    body,
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`youdao http ${response.status}`)
  const data = await response.json()
  const code = String(data?.errorCode ?? '0')
  if (code !== '0') throw new Error(`youdao errorCode ${code}`)
  const segments = Array.isArray(data?.translation) ? data.translation : []
  const translated = unescapeHtml(segments.filter((part) => typeof part === 'string').join(''))
  if (translated.trim().length === 0) throw new Error('youdao returned no text')
  return translated
}

async function googleTranslate(text, source, target) {
  const sl = source === 'auto' ? 'auto' : source
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) dsh-translator' },
  })
  if (!response.ok) throw new Error(`google http ${response.status}`)
  const data = await response.json()
  const segments = Array.isArray(data?.[0]) ? data[0] : []
  const translated = segments
    .map((segment) => (Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : ''))
    .join('')
  if (translated.trim().length === 0) throw new Error('google returned no text')
  return translated
}

async function myMemoryTranslate(text, source, target) {
  const from = source === 'auto' ? detectLanguage(text) : source
  const pair = `${from}|${target}`
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`mymemory http ${response.status}`)
  const data = await response.json()
  const translated = data?.responseData?.translatedText
  if (typeof translated !== 'string' || translated.trim().length === 0) throw new Error('mymemory returned no text')
  return translated
}

function detectLanguage(text) {
  const cjk = (text.match(CJK_RE) ?? []).length
  return cjk > 0 ? 'zh-CN' : 'en'
}

/** Translate one chunk through the first route that answers. */
async function translateChunk(ctx, text, source, target) {
  const failures = []

  // 1. Youdao demo endpoint — fastest route measured from this host.
  try {
    return { text: await youdaoTranslate(text, source, target), provider: 'youdao' }
  } catch (error) {
    failures.push(`youdao: ${messageOf(error)}`)
  }

  // 2. The Host's own translation service, when this profile provides one.
  const translator = ctx.get('translator')
  if (translator !== undefined) {
    try {
      const spec = translator.resolve({ text, targetLanguage: target, sourceLanguage: source === 'auto' ? undefined : source })
      const translated = await translator.translate(spec)
      if (typeof translated === 'string' && translated.trim().length > 0) return { text: translated, provider: 'dsh-translator' }
      failures.push('translator: empty')
    } catch (error) {
      failures.push(`translator: ${messageOf(error)}`)
    }
  }

  // 3. MyMemory — reachable without a proxy, but slow and uneven quality.
  try {
    return { text: await myMemoryTranslate(text, source, target), provider: 'mymemory' }
  } catch (error) {
    failures.push(`mymemory: ${messageOf(error)}`)
  }

  // 4. Google last: the public endpoint rate-limits shared egress IPs (HTTP 429).
  try {
    return { text: await googleTranslate(text, source, target), provider: 'google' }
  } catch (error) {
    failures.push(`google: ${messageOf(error)}`)
  }

  throw new Error(`所有翻译通道均失败 — ${failures.join(' | ')}`)
}

async function translateText(ctx, text, source, target) {
  const key = `${source}\u0000${target}\u0000${text}`
  const cached = cacheGet(key)
  if (cached !== undefined) return { ...cached, cached: true }

  const pieces = chunkText(text)
  const parts = []
  let provider = 'unknown'
  for (const piece of pieces) {
    if (piece.trim().length === 0) {
      parts.push(piece)
      continue
    }
    const result = await translateChunk(ctx, piece, source, target)
    parts.push(result.text)
    provider = result.provider
  }
  const value = { text: parts.join(''), provider }
  cacheSet(key, value)
  return { ...value, cached: false }
}

function readJsonBody(req, limitBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limitBytes) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (raw.trim().length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(new Error('invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

export function apply(ctx) {
  const token = randomUUID()

  // Expose the access token to the page that this Host served.
  ctx.effect(() => ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: TOKEN_GLOBAL, value: { token, prefix: PREFIX } })
  }))

  const handler = async (req, res) => {
    try {
      const header = req.headers['x-dsh-translator-token']
      const supplied = Array.isArray(header) ? header[0] : header
      if (supplied !== token) {
        sendJson(res, 403, { ok: false, error: 'translator: missing or invalid panel token' })
        return
      }

      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const action = url.pathname.slice(PREFIX.length).replace(/^\/+/, '')
      const method = (req.method ?? 'GET').toUpperCase()

      if (action === '' || action === 'config') {
        const translator = ctx.get('translator')
        let providers = []
        if (translator !== undefined) {
          try {
            providers = await translator.availableProviders()
          } catch {
            providers = []
          }
        }
        sendJson(res, 200, {
          ok: true,
          prefix: PREFIX,
          maxTextChars: MAX_TEXT_CHARS,
          providers,
          cacheSize: cache.size,
        })
        return
      }

      if (action === 'translate' && method === 'POST') {
        const body = await readJsonBody(req)
        const text = typeof body.text === 'string' ? body.text : ''
        if (text.trim().length === 0) {
          sendJson(res, 400, { ok: false, error: '翻译内容为空' })
          return
        }
        if (text.length > MAX_TEXT_CHARS) {
          sendJson(res, 400, { ok: false, error: `文本过长（上限 ${MAX_TEXT_CHARS} 字符）` })
          return
        }
        const mode = typeof body.mode === 'string' ? body.mode : 'auto'
        const direction = resolveDirection(text, mode)
        const started = Date.now()
        const result = await translateText(ctx, text, direction.source, direction.target)
        sendJson(res, 200, {
          ok: true,
          text: result.text,
          provider: result.provider,
          cached: result.cached,
          detected: direction.source,
          target: direction.target,
          elapsedMs: Date.now() - started,
        })
        return
      }

      if (action === 'translate') {
        sendJson(res, 405, { ok: false, error: 'use POST' })
        return
      }

      sendJson(res, 404, { ok: false, error: `unknown translator action: ${action}` })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler }))
}
