# dsh-translator · 翻译

DeepSeek Harness 左侧栏的中英互译插件。点左侧栏图标即可打开翻译面板，不占用对话区。

![panel](icon.svg)

## 功能

- 左侧栏图标常驻，与宿主主题（明/暗、`--dsw-alias-*` 令牌）保持一致
- 中英互译，默认自动判方向（中文多→翻英文，英文多→翻中文），也可锁定「中 → 英」「英 → 中」
- 输入停顿约 0.7 秒自动翻译；`Ctrl / ⌘ + Enter` 立即翻译
- 译文一键复制，显示本次实际使用的翻译通道与耗时
- 最近 24 条历史记录（浏览器 `localStorage`），点一下回填
- 长文本按自然断句自动分块翻译
- Host 侧 300 条内存缓存，重复内容不再发起请求

## 翻译通道

Host 侧按顺序降级，任一成功即返回。下表的实测数据来自一台 Windows 机器（开着 `127.0.0.1:7890` 系统代理）：

| 顺序 | 通道 | 实测 | 说明 |
| --- | --- | --- | --- |
| 1 | 有道公开接口 `aidemo.youdao.com` | 77–200 ms | 主通道，中英双向与长文本均正常 |
| 2 | DSH 自带 `ctx.translator` 服务 | 取决于 profile 配置 | google / bing / deepseek 路由，profile 提供时启用 |
| 3 | MyMemory 公开接口 | ~1.8 s | 兜底，质量一般 |
| 4 | Google 公开接口 | 常被限流 | 共享出口 IP 会返回 429，仅作最后兜底 |

> 为什么不用 Google 当主通道：Node 的 `fetch` 不读系统代理，直连会超时；即便手工建立 CONNECT 隧道，免费端点在共享出口 IP 上也返回 `429 Too Many Requests`。有道接口国内直连可达，且速度与质量都更好。

## 工作原理

```
Client half (browser)                Host half (Node)
─────────────────────                ─────────────────
sidebar.panellist  →  图标            POST /dsh-translator/translate
main (key)         →  面板      →     通道降级 → 文本
                       fetch ──────►  内存缓存
                          ◄──────────  { ok, text, provider, elapsedMs }
```

- `sidebar.panellist` 注册左侧图标，`main` 注册与之同 id 的主面板（侧栏图标由宿主负责点击与面板切换）
- 所有远端请求都在 Host 进程发出，浏览器不接触任何第三方源，因此没有 CORS/跨域问题
- 面板请求需带 Host 每次启动随机生成的令牌；令牌通过 `webserver/index-inject` 注入页面全局 `__DSH_TRANSLATOR__`，只对同源页面可见，缺失时路由返回 403

> 注意：令牌是页面加载时注入的，**装完插件后要刷新一次页面**才能拿到，否则面板会提示刷新。

## 文件

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半：注册 `/dsh-translator/config`、`/dsh-translator/translate`，执行翻译与缓存 |
| `client.js` | Client 半：`sidebar.panellist` 图标 + `main` 翻译面板 |
| `cordis.patch.yml` | Bundle 补丁，插入 `dsh-translator` 行 |
| `locale/en.json`、`locale/zh.json` | 插件管理页显示用的标题与描述 |
| `icon.svg` | 插件图标 |

## 安装

### 方式一：plugin_manager（推荐）

把本目录装进当前 profile：

```js
plugin_manager({ action: 'install_bundle', target: '<本目录的绝对路径>' })
```

装完刷新页面。卸载用 `plugin_manager({ action: 'remove_bundle', target: '@local/dsh-translator' })`。

### 方式二：开发期 link

如果 `install_bundle` 因为 profile 里已有包被运行中的进程占用而失败（Windows 上 `ERR_PNPM_EPERM`），可以用等价的手动方式，不触碰任何已装包：

1. 把本目录 link 到 `<profile>/node_modules/@local/dsh-translator`（Windows 用 junction）
2. 在 profile 的 `package.json` 里登记：
   - `dependencies` 加 `"@local/dsh-translator": "link:<本目录绝对路径>"`
   - `dsh.profile.bundles` 末尾加 `"@local/dsh-translator"`
3. 保存后 Loader 会自动重扫，无需重启

## 开发

```bash
node --check index.js     # Host 半语法
node --check client.js    # Client 半语法
```

`client.js` 是 `window.__ModuleLoader__.load({ id, factory })` 形式的懒加载模块，`factory(require)` 里只能 `require('react')`，不要引入其他 Harness Client 包。

改完源码后刷新页面即可加载新代码（link 安装时无需重新安装）。

## 许可

MIT
