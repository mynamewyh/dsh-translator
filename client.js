window.__ModuleLoader__.load({
  id: '@local/dsh-translator',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const PANEL_KEY = 'dsh-translator'
    const TOKEN_GLOBAL = '__DSH_TRANSLATOR__'
    const FALLBACK_PREFIX = '/dsh-translator'
    const HISTORY_KEY = 'dsh-translator:history:v1'
    const AUTO_DELAY_MS = 700
    const HISTORY_LIMIT = 24

    const MODES = [
      { id: 'auto', label: '自动' },
      { id: 'zh-en', label: '中 → 英' },
      { id: 'en-zh', label: '英 → 中' },
    ]

    const CSS = [
      '.dt-root{position:relative;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;height:100%;min-height:440px;padding:20px 22px 16px;color:var(--dsw-alias-label-primary);font-family:inherit;overflow:hidden}',
      '.dt-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}',
      '.dt-head-left{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.dt-title{font-size:17px;font-weight:600;line-height:1.35;letter-spacing:.2px}',
      '.dt-sub{font-size:12px;line-height:1.4;color:var(--dsw-alias-label-secondary)}',
      '.dt-head-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.dt-seg{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}',
      '.dt-seg button{appearance:none;border:0;border-radius:8px;padding:5px 11px;font:inherit;font-size:12px;line-height:1.4;color:var(--dsw-alias-label-secondary);background:transparent;cursor:pointer;transition:background .15s ease,color .15s ease}',
      '.dt-seg button:hover{color:var(--dsw-alias-label-primary)}',
      '.dt-seg button[data-on="true"]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.12)}',
      '.dt-auto{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none}',
      '.dt-auto input{appearance:none;width:32px;height:18px;border-radius:9px;background:var(--dsw-alias-border-l2);position:relative;cursor:pointer;transition:background .18s ease;margin:0;flex:none}',
      '.dt-auto input::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-bg-base);transition:transform .18s ease}',
      '.dt-auto input:checked{background:var(--dsw-alias-brand-primary)}',
      '.dt-auto input:checked::after{transform:translateX(14px)}',
      '.dt-error{display:flex;align-items:flex-start;gap:8px;padding:8px 12px;border-radius:10px;border:1px solid var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);font-size:12px;line-height:1.55;color:var(--dsw-alias-state-error-primary);word-break:break-word}',
      '.dt-notice{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;border:1px solid var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);font-size:12px;line-height:1.55;color:var(--dsw-alias-state-warn-primary)}',
      '.dt-notice kbd{font:inherit;font-size:11px;padding:1px 6px;border-radius:5px;border:1px solid currentColor;opacity:.85}',
      '.dt-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}',
      '@media (max-width:920px){.dt-body{grid-template-columns:minmax(0,1fr);grid-auto-rows:minmax(150px,1fr)}}',
      '.dt-card{display:flex;flex-direction:column;min-height:0;min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}',
      '.dt-card-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:12px;color:var(--dsw-alias-label-secondary);flex:none}',
      '.dt-card-head .dt-grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dt-tag{font-size:11px;padding:1px 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);flex:none}',
      '.dt-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1.4;padding:4px 10px;border-radius:8px;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease;flex:none}',
      '.dt-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}',
      '.dt-btn:disabled{opacity:.45;cursor:default}',
      '.dt-btn[data-primary="true"]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff;font-weight:500}',
      '.dt-btn[data-primary="true"]:hover:not(:disabled){color:#fff;filter:brightness(1.06)}',
      '.dt-input{flex:1;min-height:0;width:100%;box-sizing:border-box;resize:none;border:0;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:1.72;padding:12px 14px}',
      '.dt-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.75}',
      '.dt-output{flex:1;min-height:0;overflow:auto;padding:12px 14px;font-size:14px;line-height:1.72;white-space:pre-wrap;word-break:break-word}',
      '.dt-output[data-dim="true"]{color:var(--dsw-alias-label-secondary)}',
      '.dt-loading{display:flex;align-items:center;gap:6px;padding:14px;color:var(--dsw-alias-label-secondary);font-size:13px}',
      '.dt-dot{width:6px;height:6px;border-radius:50%;background:currentColor;animation:dt-pulse 1.1s ease-in-out infinite}',
      '.dt-dot:nth-child(2){animation-delay:.16s}',
      '.dt-dot:nth-child(3){animation-delay:.32s}',
      '@keyframes dt-pulse{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}',
      '.dt-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;flex:none}',
      '.dt-hint{font-size:11.5px;color:var(--dsw-alias-label-secondary);opacity:.9}',
      '.dt-history{display:flex;gap:6px;flex-wrap:wrap;max-height:58px;overflow:auto;flex:none;padding-bottom:2px}',
      '.dt-chip{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:inherit;font-size:12px;line-height:1.5;padding:4px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:border-color .15s ease,color .15s ease}',
      '.dt-chip:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}',
      '.dt-empty{font-size:11.5px;color:var(--dsw-alias-label-secondary);opacity:.7}',
    ].join('\n')

    function readMeta() {
      const value = typeof window === 'undefined' ? undefined : window[TOKEN_GLOBAL]
      if (value !== null && typeof value === 'object') return value
      return {}
    }

    function readHistory() {
      try {
        const raw = window.localStorage.getItem(HISTORY_KEY)
        if (typeof raw !== 'string') return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
          .filter((item) => item !== null && typeof item === 'object' && typeof item.source === 'string' && typeof item.result === 'string')
          .map((item) => ({ source: item.source, result: item.result, mode: typeof item.mode === 'string' ? item.mode : 'auto', at: typeof item.at === 'number' ? item.at : Date.now() }))
          .slice(0, HISTORY_LIMIT)
      } catch {
        return []
      }
    }

    function writeHistory(items) {
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
      } catch {
        /* storage may be unavailable; history degrades to in-memory */
      }
    }

    async function callApi(path, options, attempt) {
      const meta = readMeta()
      const prefix = typeof meta.prefix === 'string' ? meta.prefix : FALLBACK_PREFIX
      const token = typeof meta.token === 'string' ? meta.token : ''
      const response = await fetch(`${prefix}${path}`, {
        method: options && options.method ? options.method : 'GET',
        headers: Object.assign({ 'content-type': 'application/json', 'x-dsh-translator-token': token }, options && options.headers ? options.headers : {}),
        body: options ? options.body : undefined,
      })
      if (response.status === 403) {
        if (token.length > 0 && (attempt === undefined || attempt < 1)) {
          await new Promise((resolve) => setTimeout(resolve, 400))
          return callApi(path, options, (attempt === undefined ? 0 : attempt) + 1)
        }
        return { ok: false, error: token.length === 0 ? '插件已安装但页面尚未刷新，按 Ctrl+R 刷新后即可翻译' : '翻译服务拒绝了本次请求（面板令牌失效），刷新页面后重试' }
      }
      const data = await response.json().catch(() => null)
      if (data === null || typeof data !== 'object') return { ok: false, error: `网关返回异常（HTTP ${response.status}）` }
      return data
    }

    function detectLocalDirection(text) {
      const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length
      const latin = (text.match(/[A-Za-z]/g) || []).length
      return cjk >= latin ? '中 → 英' : '英 → 中'
    }

    function PanelIcon(props) {
      const size = typeof props.size === 'number' && props.size > 0 ? props.size : 20
      const stroke = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, style: { display: 'block' } },
        h('path', Object.assign({ d: 'M3.5 8h11.5', key: 'a1' }, stroke)),
        h('path', Object.assign({ d: 'M11.8 4.6 15.4 8l-3.6 3.4', key: 'a2' }, stroke)),
        h('path', Object.assign({ d: 'M20.5 16H9', key: 'b1' }, stroke)),
        h('path', Object.assign({ d: 'M12.2 12.6 8.6 16l3.6 3.4', key: 'b2' }, stroke)),
      )
    }

    function TranslatorPanel() {
      const [source, setSource] = useState('')
      const [result, setResult] = useState('')
      const [mode, setMode] = useState('auto')
      const [autoMode, setAutoMode] = useState(true)
      const [status, setStatus] = useState('idle')
      const [error, setError] = useState('')
      const [meta, setMeta] = useState(null)
      const [copied, setCopied] = useState(false)
      const [history, setHistory] = useState(readHistory)
      const [tokenReady, setTokenReady] = useState(() => typeof readMeta().token === 'string')

      const seq = useRef(0)
      const sourceRef = useRef('')
      const modeRef = useRef('auto')
      sourceRef.current = source
      modeRef.current = mode

      const remember = useCallback((text, translated, modeValue) => {
        const trimmed = text.trim()
        if (trimmed.length === 0 || translated.trim().length === 0) return
        setHistory((previous) => {
          const next = [{ source: trimmed, result: translated, mode: modeValue, at: Date.now() }]
            .concat(previous.filter((item) => item.source !== trimmed))
            .slice(0, HISTORY_LIMIT)
          writeHistory(next)
          return next
        })
      }, [])

      const run = useCallback(async (text, modeValue, options) => {
        const trimmed = text.trim()
        if (trimmed.length === 0) {
          setResult('')
          setStatus('idle')
          setError('')
          return
        }
        const id = seq.current + 1
        seq.current = id
        setStatus('loading')
        setError('')
        try {
          const data = await callApi('/translate', { method: 'POST', body: JSON.stringify({ text, mode: modeValue }) })
          if (seq.current !== id) return
          if (data.ok !== true) {
            setStatus('error')
            setError(typeof data.error === 'string' ? data.error : '翻译失败')
            return
          }
          setResult(data.text)
          setStatus('done')
          setMeta({ provider: data.provider, cached: data.cached, elapsedMs: data.elapsedMs, target: data.target, detected: data.detected })
          if (!options || options.remember !== false) remember(text, data.text, modeValue)
        } catch (failure) {
          if (seq.current !== id) return
          setStatus('error')
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      }, [remember])

      useEffect(() => {
        if (tokenReady) return undefined
        const handle = setInterval(() => {
          if (typeof readMeta().token === 'string') {
            setTokenReady(true)
            clearInterval(handle)
          }
        }, 1000)
        return () => clearInterval(handle)
      }, [tokenReady])

      useEffect(() => {
        if (!autoMode || !tokenReady) return undefined
        const text = source
        if (text.trim().length === 0) {
          seq.current += 1
          setResult('')
          setStatus('idle')
          setError('')
          return undefined
        }
        const handle = setTimeout(() => {
          void run(text, modeRef.current)
        }, AUTO_DELAY_MS)
        return () => clearTimeout(handle)
      }, [source, mode, autoMode, tokenReady, run])

      const manualTranslate = useCallback(() => {
        void run(sourceRef.current, modeRef.current)
      }, [run])

      const clearAll = useCallback(() => {
        seq.current += 1
        setSource('')
        setResult('')
        setStatus('idle')
        setError('')
        setMeta(null)
      }, [])

      const copyResult = useCallback(async () => {
        if (result.length === 0) return
        try {
          await navigator.clipboard.writeText(result)
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        } catch {
          setError('复制失败：浏览器拒绝了剪贴板权限，请手动选中译文复制')
        }
      }, [result])

      const onKeyDown = useCallback((event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          void run(sourceRef.current, modeRef.current)
        }
      }, [run])

      const pickHistory = useCallback((item) => {
        seq.current += 1
        setSource(item.source)
        setResult(item.result)
        setStatus('done')
        setError('')
        setMeta(null)
        if (!autoMode) void run(item.source, modeRef.current)
      }, [autoMode, run])

      const counter = useMemo(() => {
        const chars = source.length
        const pairs = detectLocalDirection(source)
        return { chars, direction: pairs }
      }, [source])

      const providerTag = meta && typeof meta.provider === 'string' ? meta.provider : ''
      const showLoading = status === 'loading'
      const outputDim = result.length === 0

      const children = [
        h('style', { key: 'css', dangerouslySetInnerHTML: { __html: CSS } }),
        h('header', { className: 'dt-head', key: 'head' }, [
          h('div', { className: 'dt-head-left', key: 'l' }, [
            h('div', { className: 'dt-title', key: 't' }, '翻译'),
            h('div', { className: 'dt-sub', key: 's' }, '中英互译 · 自动识别方向 · 停顿即译'),
          ]),
          h('div', { className: 'dt-head-right', key: 'r' }, [
            h('div', { className: 'dt-seg', key: 'seg', role: 'group', 'aria-label': '翻译方向' },
              MODES.map((item) => h('button', {
                key: item.id,
                type: 'button',
                'data-on': String(mode === item.id),
                'aria-pressed': mode === item.id,
                onClick: () => setMode(item.id),
              }, item.label))),
            h('label', { className: 'dt-auto', key: 'auto', title: '开启后停止输入约 0.7 秒自动翻译' }, [
              h('input', {
                key: 'cb',
                type: 'checkbox',
                checked: autoMode,
                onChange: (event) => setAutoMode(event.target.checked),
              }),
              h('span', { key: 'txt' }, '自动翻译'),
            ]),
          ]),
        ]),
      ]

      if (!tokenReady) {
        children.push(h('div', { className: 'dt-notice', key: 'notice' }, [
          h('span', { key: 'txt' }, '插件装好了，刷新页面 ',),
          h('kbd', { key: 'kbd' }, 'Ctrl + R'),
          h('span', { key: 'tail' }, ' 之后就能开始翻译。'),
        ]))
      }

      if (error.length > 0) {
        children.push(h('div', { className: 'dt-error', key: 'err', role: 'alert' }, error))
      }

      children.push(h('div', { className: 'dt-body', key: 'body' }, [
        h('section', { className: 'dt-card', key: 'src' }, [
          h('div', { className: 'dt-card-head', key: 'h' }, [
            h('span', { key: 'a' }, '原文'),
            h('span', { className: 'dt-grow', key: 'g' }),
            h('span', { className: 'dt-tag', key: 'c' }, `${counter.chars} 字`),
            h('button', {
              key: 'clr',
              type: 'button',
              className: 'dt-btn',
              disabled: source.length === 0,
              onClick: clearAll,
            }, '清空'),
          ]),
          h('textarea', {
            key: 'ta',
            className: 'dt-input',
            value: source,
            spellCheck: false,
            placeholder: '把要翻译的中文或英文贴进来…',
            onChange: (event) => setSource(event.target.value),
            onKeyDown,
          }),
        ]),
        h('section', { className: 'dt-card', key: 'dst' }, [
          h('div', { className: 'dt-card-head', key: 'h' }, [
            h('span', { key: 'a' }, '译文'),
            h('span', { className: 'dt-tag', key: 'dir' }, counter.direction),
            h('span', { className: 'dt-grow', key: 'g' }),
            providerTag.length > 0 && status === 'done'
              ? h('span', { className: 'dt-tag', key: 'pv', title: meta && meta.cached ? '命中本地缓存' : '本次实际调用的翻译通道' }, providerTag)
              : null,
            h('button', {
              key: 'cp',
              type: 'button',
              className: 'dt-btn',
              'data-primary': 'true',
              disabled: result.length === 0,
              onClick: copyResult,
            }, copied ? '已复制' : '复制'),
          ]),
          showLoading
            ? h('div', { className: 'dt-loading', key: 'loading' }, [
              h('span', { className: 'dt-dot', key: 'd1' }),
              h('span', { className: 'dt-dot', key: 'd2' }),
              h('span', { className: 'dt-dot', key: 'd3' }),
              h('span', { key: 'txt', style: { marginLeft: 6 } }, '翻译中…'),
            ])
            : h('div', { className: 'dt-output', key: 'out', 'data-dim': String(outputDim) }, result.length > 0 ? result : '译文会出现在这里。'),
        ]),
      ]))

      children.push(h('footer', { className: 'dt-foot', key: 'foot' }, [
        h('span', { className: 'dt-hint', key: 'hint' }, 'Ctrl / ⌘ + Enter 立即翻译 · 输入停顿约 0.7 秒自动翻译'),
        h('button', {
          key: 'manual',
          type: 'button',
          className: 'dt-btn',
          disabled: source.trim().length === 0 || showLoading,
          onClick: manualTranslate,
        }, '立即翻译'),
      ]))

      if (history.length > 0) {
        children.push(h('div', { className: 'dt-history', key: 'hist' },
          history.slice(0, 10).map((item, index) => h('button', {
            key: `h${index}`,
            type: 'button',
            className: 'dt-chip',
            title: item.result.slice(0, 160),
            onClick: () => pickHistory(item),
          }, item.source.replace(/\s+/g, ' ').slice(0, 42)))))
      } else {
        children.push(h('div', { className: 'dt-empty', key: 'empty' }, '最近翻译会出现在这里，点一下即可回填。'))
      }

      return h('div', { className: 'dt-root' }, children)
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_KEY,
          order: 30,
          label: () => '翻译',
        }, PanelIcon))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_KEY,
        }, TranslatorPanel))
      },
    }
  },
})
