# 特蕾西娅主题 · Theresa theme for DSH

给 DeepSeek Harness 的 Web GUI 换上一套特蕾西娅的配色与氛围：象牙白 / 墨 / 淡玫瑰 / 古金，
整页背景图 + 毛玻璃面板 + 飘落花瓣 + 黑冠徽记。

> **这是一个素材可自备的插件**：背景图、侧栏立绘、开屏动画都不随包（第三方素材）。
> 缺素材时会自动降级，装上即可用。素材怎么命名、放哪个文件夹，见 **[DEPLOY.md](DEPLOY.md)**。

## 架构（v2）

| 机制 | 位置 | 说明 |
|---|---|---|
| 色板 | `lib/client.js` 注入的作用域样式表 | 压在 `body[data-dsh-theresa]` 下，`--dsw-alias-bg-base` 设为 `transparent`；**不走** `ctx.theme.overrideTokens`，所以 `rgba()` / 渐变 / `backdrop-filter` 都能写，也不会和宿主的偏好写入抢状态 |
| 背景图 | `body` 子元素 `.tre-bg`（`fixed` + `z-index:-1`） | 图在**内容之下**，永远不会把文字冲淡 |
| 出图 | Host 路由 `/theresa/background/<file>` | 不做 base64 内联，直出 2560×1440 原图（带 ETag / 304） |
| 玻璃 | `backdrop-filter` | 只给侧栏、终端面板、弹窗、`[data-shell-overlay] > *`；**不加**在对话列与 `shell.overlay` 宿主上（会成为 fixed 后代的包含块，导致悬停闪烁） |
| 文字 | `text-shadow` 光晕 + 气泡加厚 | 正文容器 `[data-conversation-scroll]` 里的段落/列表/表格加一圈亮（或暗）光晕；靠局部衬底保可读，不靠把图调淡 |
| 设定 | `~/.dsh/theresa-theme.json` | `rev` 版本号防多窗口互相覆盖（旧 rev → 409 + 最新快照） |
| 开屏 | `Background/opening.mp4` → `GET /theresa/opening` | 启动时全屏播一次：点击 / Esc / 空格 / 回车即跳过；自动播放被拒、视频出错、播完都会立刻收尾；`prefers-reduced-motion` 时整段不播；有首帧图 `opening-poster.webp` 时先铺底再淡入视频 |
| 落款 | `Background/signature-*.png` → `GET /theresa/signature/<file>` | 右下角**中文签名在上、英文签名在下**，中间一条细金线，末尾一枚朱印。素材是「墨 / 金」两层 **alpha 蒙版**，颜色交给主题，所以明暗共用一份、金线也保得住；素材缺失时自动退回竖排文字「特蕾西娅」 |
| 欢迎页文案 | 作用域 CSS 覆盖 `[class*="titleGroup"] > span:first-child` | 宿主那句「探索未至之境」由 `dsh-client-ui-conversation` 渲染（locale key `hero.headline`）。不替换宿主组件、不碰 React：把那个 span 的字号归零、用 `::after` 写入自己的文案（29px / 400，行高 38），上方是黑冠 + 一道 64px 金线。文案与开关都在设置页，随时可改；文案进 CSS 字符串前会去掉引号、反斜杠与控制字符 |
| 构图 | `background.fit / focus / zoom / substrate` | 「铺满」按 `cover` 铺满并允许裁切，「完整」按 `contain` 保留整张；焦点写成 `background-position` + `transform-origin`，缩放用 `transform`，所以不破坏 cover 语义。阅读衬底是一层从左边缘起的方向性渐变，强度 = 色纱档位 × 衬底滑杆 |
| 玻璃 | `--tre-glass-blur` / `--tre-glass-sat` | 由 `data-tre-glass`（0/1/2）覆盖，同一套规则覆盖侧栏、浮窗、弹窗与 `shell.overlay` 子项；对话列仍不加 `backdrop-filter` |
| 总开关 | `enabled` | 关掉时移除 `body[data-dsh-theresa]` 整层，并**动态注销**两个 `priority -1` 的徽记槽位，把品牌位置交还宿主；重新打开时重新注册 |
| 设置页 | `settings.section`（id `theresa`，order 40） | 总开关 / 背景网格 + 上传 / 双档色纱浓度 / 花瓣与黑冠 / 落款与画框 / 欢迎页文案 / 开屏 |

明暗**不设独立开关**：主题只跟随宿主「设置 → 外观」，读 `body[data-ds-dark-theme]` 切换两套值。

## 安装与生效

```
plugin_manager install_bundle  target = <此目录的绝对路径>
```

- 改到 **Host 半**（`lib/index.js`、`package.json`）→ 必须**完全退出 DSH 再打开**。
- 只改 **Client 半**（`lib/client.js`）→ 按 `Ctrl+R` 刷新页面即可。

装好后在「设置」左侧会多出一页「特蕾西娅 · 主题」。

## 调整

| 想改 | 改哪里 |
|---|---|
| 背景浓淡 | 设置页的「色纱浓度」滑杆（0 最实 / 0.85 最淡），白昼/长夜各一档 |
| 背景构图 | 设置页「背景图 → 构图」：铺满/完整、缩放 100–180%、水平/垂直焦点、阅读衬底强度 |
| 正文可读性 | 「阅读衬底」滑杆：越大，正文那一侧压得越厚、画退得越远 |
| 面板材质 | 「外观 → 玻璃强度」三档（清淡 / 标准 / 厚重） |
| 画面通透度 | 「外观 → 画面通透度」0–100 + 「原画 / 平衡 / 沉浸」预设；只放大面铺底的 alpha |
| 升级兼容 | DSH NEXT 把 `bg-layer-1` 铺到整页/整列；0.3.1 起画布级容器显式透明，避免"白一层" |
| 换背景 | 把图片（webp/png/jpg/avif/gif）放进 `Background/`，重载后设置页会出现新缩略图 |
| 主色 | `src/client.js` 里的 `ALIAS_LIGHT` / `ALIAS_DARK` |
| 花瓣数量 | 设置页滑杆（0–14，默认 8） |
| 花瓣形状/颜色 | `src/client.js` 里 `.tre-petal` 的 `background-color` 与 `PETAL` 掩码 |
| 换开屏视频 | 用 ffmpeg 转成 `-an -vf fps=30`、`+faststart` 的 mp4 放进 `Background/opening.mp4`（命令见 ASSETS.md）；设置页有「再看一次」可即时预览 |

改完重建：

```
python tools/build_client.py          # 内联王冠路径 → lib/client.js
node --check packages/theme-theresa/lib/client.js
```

## 自检

```
node packages/theme-theresa/test/host.smoke.mjs   # 路由 / rev / 越界 / 目录穿越
node packages/theme-theresa/test/contrast.mjs     # 12 组 token 对的 WCAG 对比度
```

`contrast.mjs` 会把半透明面板按 alpha 合成到"最不利的背景像素"上再算对比度
（浅色侧取纯白与她的深色头发，深色侧取页面墨底与画面里的白鸽），
目前最差一项 6.74:1，全部达标。

## 素材与授权

**先看 [ASSETS.md](./ASSETS.md)。** 背景图派生自官方美术 / 同人图，仅限本地个人使用，
不可再分发；开源前必须按该文档替换。

## 已知限制

- 主题不改字体。想要宋体质感，在「设置 → 通用 → 外观 → 正文字体」填 `Noto Serif SC`。
- 背景**上传**已支持（落到 `Background-custom/`，同名文件会自动改名为 `name-2.ext`，不会覆盖旧图）。
- 侧栏折叠（宽度 0）时立绘保持上次宽度，宁可露一点边缘也不隐藏；这是刻意的取舍。
- 依赖宿主提供的 `[data-slot]` / `[data-conversation-scroll]` 等 DOM 钩子；它们缺失时
  只有毛玻璃与文字光晕失效，配色与背景仍成立。
