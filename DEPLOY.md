# 特蕾西娅主题 · 部署说明

> 适用版本：0.2.x　　宿主：DeepSeek Harness Desktop（`dsh` 桌面端）
> 这是一个**插件**，不是独立程序：它挂在 DSH 的桌面 Profile 下运行。

---

## 一、这个包里有什么

| 类别 | 内容 | 是否随包 |
|---|---|---|
| 代码 | `lib/`（Host + 客户端构建产物）、`src/client.js`（可读源码）、`tools/`（重建脚本） | ✅ 有 |
| 字体 | `Background/headline.woff2`（霞鹜文楷 10 字形子集，**OFL 授权**） | ✅ 有 |
| 落款 | `Background/signature-cn-ink.png`、`signature-cn-gold.png`、`signature-en-ink.png`、`signature-en-gold.png`（作者自制） | ✅ 有 |
| 徽记 | `assets/crown.svg`、`assets/icon.svg`（作者描摹） | ✅ 有 |
| 背景图 | 白天/长夜两张 | ❌ **需自备**（官方立绘、第三方同人图，不能随包分发） |
| 侧栏立绘 | `sidebar-figure.webp` | ❌ **需自备** |
| 开屏动画 | `opening.mp4`、`opening-poster.webp` | ❌ **需自备**（片源版权归原作者） |

**缺素材不影响使用**：插件会自动降级（见第四节）。

---

## 二、安装

### 1. 放到一个固定的目录

把解压出来的 `theme-theresa` 整个文件夹放到不会被清理的位置，例如：

```
C:\Users\<你的用户名>\Documents\dsh-theme-theresa
```

> 不要放在「下载」或临时目录，DSH 每次启动都会去这个路径找文件。

### 2. 登记到 Profile

打开这个文件（用记事本 / VSCode 都行）：

```
C:\Users\<你的用户名>\.dsh\profiles\desktop\package.json
```

在 `dsh.profile.bundles` 数组里加一行，在 `dependencies` 里加一条（**路径换成你自己的**，用正斜杠）：

```json
{
  "name": "dsh-profile-desktop",
  "private": true,
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@local/dsh-theme-theresa"
      ],
      "patchReload": "live"
    }
  },
  "dependencies": {
    "@local/dsh-theme-theresa": "file:C:/Users/你的用户名/Documents/dsh-theme-theresa"
  }
}
```

> ⚠️ 只改这两处，别动其它条目。`"@local/dsh-theme-theresa"` 这个包名不要改。

### 3. 完全退出 DSH，再打开

**必须完全退出**（右键托盘图标 → 退出；任务管理器里确认没有残留进程），只关窗口不算。

### 4. 打开设置

`设置 → 特蕾西娅 · 主题`，把顶部的总开关打开。

---

## 三、素材怎么放

所有素材都放在 **插件目录下的 `Background/`** 里（没有就新建）。

### 3.1 命名规则（很重要）

| 素材 | 文件名 | 说明 |
|---|---|---|
| 背景图 | **任意名** + 图片扩展名 | 例：`day.webp`、`我的壁纸.png`。扩展名支持 `.webp` `.png` `.jpg` `.jpeg` `.avif` `.gif` |
| 侧栏立绘 | **必须**叫 `sidebar-figure.webp`（或 `.png` / `.jpg` …） | 名字不对不会显示 |
| 开屏动画 | **必须**叫 `opening.mp4` | 名字不对不会播 |
| 开屏首帧 | `opening-poster.webp`（可选） | 用来避免视频就绪前黑屏 |
| 落款签名 | `signature-cn-ink.png`、`signature-cn-gold.png`、`signature-en-ink.png`、`signature-en-gold.png` | 已随包，想换再替换 |

**保留前缀**：以 `opening`、`signature-`、`sidebar-` 开头的文件**不会**出现在「背景图」列表里——它们是固定部件，不是可选壁纸。

### 3.2 背景图

- 规格建议：**2560×1440**，不透明（JPG / WebP 均可）。
- 放进去后，`设置 → 背景图` 里会按文件名排序列出，第一张是默认选中的。
- 想让它显示得清楚，把「色纱浓度」调低（0% = 完全不做色纱）。

### 3.3 侧栏立绘

- **必须是透明背景的竖构图**（PNG 或 WebP，带 alpha）。
- 建议尺寸：宽 ≥ 480 px，高 ≈ 宽的 2 倍（例：480×953）；太扁会被缩得很小。
- 放在 `Background/sidebar-figure.webp`；或直接用界面上的 `装饰 → 侧栏立绘 → 上传立绘`（可以存好几张，随时切换）。

### 3.4 开屏动画

- 建议：2560×1440、30 fps、H.264、`+faststart`。
- 放 `Background/opening.mp4` 即自动启用；没有这个文件时开屏直接跳过，不报错。
- **声音默认关闭**：浏览器不允许无交互自动播放声音。要听声音，点开屏左下角的黑冠；或在 `开屏动画 → 开屏音乐` 里打开开关（仍可能被拦，那就点黑冠）。

### 3.5 更省事的做法：界面上传

| 想换什么 | 操作路径 | 存到哪 |
|---|---|---|
| 背景图 | 设置 → 背景图 → **上传背景图** | `Background-custom/` |
| 侧栏立绘 | 设置 → 装饰 → 侧栏立绘 → **上传立绘** | `Background-custom/figures/` |

上传会自动把图缩到 2560 宽并转成 WebP，单个文件上限 **12 MB**。上传的素材不会被插件更新覆盖。

---

## 四、缺素材时会发生什么（自动降级）

| 缺什么 | 表现 |
|---|---|
| 背景图 | 背景层透明，界面回到纯色玻璃；设置页提示"没有可用背景" |
| 侧栏立绘 | 侧栏那片空白就是空的；「随包立绘」选项不会出现 |
| 开屏动画 | 启动时不出开屏，其余照常 |
| 落款签名 | 落款自动退回竖排文字「特蕾西娅」 |
| 书法字体 | 欢迎页那句退回系统楷体（`STKaiti` → `KaiTi`） |

---

## 五、常见问题

**Q：设置页一片空白 / 上传没反应？**
A：Host 半改过之后必须**完全退出**再启动。只刷新页面（`Ctrl+R`）只能更新客户端半。

**Q：改了素材不生效？**
A：先 `Ctrl+R`；还不行就完全重启（背景与素材清单是启动时扫描的）。

**Q：开屏没声音？**
A：浏览器策略，见 3.4。点左下角黑冠。

**Q：侧栏立绘有时候不见了？**
A：侧栏折叠成窄条时会自动隐藏，展开就回来。

**Q：立绘下半身被切掉？**
A：立绘是「底部对齐 + contain」，超出窗口高度的部分会被裁。用竖构图、或调「装饰 → 立绘大小」。

**Q：窄窗口下右下角落款消失？**
A：窗口宽度 < 900 px 时会自动隐藏落款（避免挡字）。

**Q：怎么彻底卸载？**
A：把 `bundles` 与 `dependencies` 里那两行删掉，完全重启 DSH，插件目录可以留着或删掉。用户数据在 `C:\Users\<你>\.dsh\theresa-theme.json`，删掉即恢复默认。

---

## 六、授权

| 部分 | 授权 |
|---|---|
| 插件代码（`lib/` `src/` `tools/`） | MIT，见 `LICENSE` |
| 落款签名、黑冠徽记、图标 | 作者自制，随本次分发授权，转载/二次分发请注明出处 |
| 书法字体子集 | 霞鹜文楷 LXGW WenKai，SIL Open Font License 1.1 |
| 背景 / 立绘 / 开屏 | **不随包**，请自行准备并自负版权责任 |

明日方舟及其角色「特蕾西娅」版权归上海鹰角网络科技有限公司所有。本项目为非商业同人作品，与官方无关联。
