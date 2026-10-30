// `packages/theme-theresa/lib/client.js` 的源文件。
// `tools/build_client.py` 把王冠路径内联进来，产出真正被加载的那一份。
//
// 架构（与 v1 的差别，逐条都是踩过坑换来的）：
//   1. 不走 `ctx.theme.overrideTokens`：改用一张作用域样式表，压在
//      `body[data-dsh-theresa]` 下，这样 `transparent` / `rgba()` / 渐变都能写，
//      而且不会和宿主的偏好写入抢状态。
//   2. 背景图是 body 的真实子元素 `.tre-bg`（fixed + z-index:-1），
//      主列 `--dsw-alias-bg-base: transparent`，于是图在**内容之下**，
//      永远不会把文字冲淡。
//   3. 文字可读性靠 `text-shadow` 光晕 + 气泡加厚，不靠"把图调淡"。
//   4. 图片走 Host 路由 `/theresa/background/<file>`，不做 base64 内联。

window.__ModuleLoader__.load({
  id: '@local/dsh-theme-theresa',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const ROUTE = '/theresa';
    const BODY_ATTR = 'data-dsh-theresa';
    const SKIN_ATTR = 'data-theresa-skin';
    const BG_ATTR = 'data-tre-bg';
    /** 默认那句欢迎语：设置页的「重置文案」与默认设定共用一份。 */
    const DEFAULT_HEADLINE = '去找到你自己吧……';

    // ---------------------------------------------------------------- palette
    // 取自本地画作：象牙白 / 墨 / 淡玫瑰 / 古金；深色侧是冷墨 + 淡紫 + 金。
    // 明暗不设开关——只跟随宿主的 body[data-ds-dark-theme]。
    const RAMP = {
      '00': ['#FFFFFF', '#FFFFFF'],
      '50': ['#FBF7F3', '#FAF7FC'],
      '60': ['#F9F5F0', '#F6F2F9'],
      '75': ['#F6F1EB', '#F1ECF6'],
      '100': ['#F1EAE3', '#E8E1F0'],
      '150': ['#EAE2DA', '#DED5E7'],
      '200': ['#E0D7CD', '#D2C7DD'],
      '300': ['#CBC0B5', '#BCAFC8'],
      '400': ['#A8998F', '#9E90AC'],
      '500': ['#8D7E76', '#877A95'],
      '600': ['#71635C', '#6D627C'],
      '700': ['#594C46', '#554B62'],
      '750': ['#423833', '#443A50'],
      '800': ['#322A26', '#342C3E'],
      '850': ['#28221F', '#2A2333'],
      '875': ['#221D1A', '#241E2C'],
      '900': ['#1B1715', '#1C1725'],
      '950': ['#131110', '#14111B'],
      '1000': ['#0C0A09', '#0B0910'],
    };

    /**
     * 大面铺底（整列 / 整页）的透明度乘子。
     *
     * DSH NEXT 会把 `bg-layer-1` 铺到比旧版更大的面上，于是同一份 token
     * 在新版看起来"白了一层"。把这几项改成 color-mix + 乘子，
     * 就得到一个全局"通透度"旋钮：100 = 几乎不蒙，0 = 偏实。
     * 菜单 / 弹窗 / 输入框**不参与**缩放，避免一调就看不见。
     */
    const alphaMix = (color, percent) =>
      `color-mix(in srgb, ${color} calc(var(--tre-alpha-scale, 1) * ${percent}%), transparent)`;

    const ALIAS_LIGHT = [
      ['--dsw-alias-bg-base', 'transparent'],
      ['--dsw-alias-bg-layer-1', alphaMix('#FFFDFB', 72)],
      ['--dsw-alias-bg-layer-2', alphaMix('#F5EFE8', 68)],
      ['--dsw-alias-bg-layer-3', alphaMix('#FFFDFB', 64)],
      ['--dsw-alias-bg-overlay', 'rgba(254,251,247,.94)'],
      ['--dsw-alias-border-l1', 'rgba(43,30,36,.10)'],
      ['--dsw-alias-border-l2', 'rgba(43,30,36,.16)'],
      ['--dsw-alias-border-l3', 'rgba(43,30,36,.22)'],
      ['--dsw-alias-border-l4', 'rgba(43,30,36,.30)'],
      ['--dsw-alias-brand-primary', '#7A4E5C'],
      ['--dsw-alias-brand-text', '#FFF9F7'],
      // 发送键这类"信息蓝"按钮走 button-info-*，不跟 brand 走
      ['--dsw-alias-button-info-fill', '#7A4E5C'],
      ['--dsw-alias-button-info-hover', '#633C4A'],
      ['--dsw-alias-button-primary-hover', '#633C4A'],
      ['--dsw-alias-link', '#8A5A66'],
      ['--dsw-alias-label-primary', '#181319'],
      ['--dsw-alias-label-secondary', '#3F363F'],
      ['--dsw-alias-label-tertiary', '#6B6169'],
      ['--dsw-alias-state-error-primary', '#A8434F'],
      ['--dsw-alias-state-idle-primary', '#BDB3AE'],
      ['--dsw-alias-state-success-primary', '#4E7A5F'],
      ['--dsw-alias-state-warn-primary', '#B08234'],
      ['--dsw-specific-sidebar-fill', alphaMix('#F7F2ED', 66)],
      ['--dsw-specific-menu', 'rgba(254,251,247,.96)'],
      ['--dsw-specific-selector', 'rgba(254,251,247,.94)'],
      ['--dsw-specific-input-major', 'rgba(255,253,251,.86)'],
      ['--dsw-specific-tip', 'rgba(254,251,247,.94)'],
      ['--dsw-alias-markdown-code-block', alphaMix('#F5F0EA', 88)],
      ['--dsw-alias-markdown-inline-code', alphaMix('#F2ECE5', 92)],
      ['--dsw-alias-interactive-bg-hover', 'rgba(122,78,92,.09)'],
      ['--dsw-alias-scrollbar-bg-l1', '#E2D9D2'],
      ['--dsw-alias-tooltip-bg', '#241F26'],
      ['--dsw-alias-toast-bg', 'rgba(43,37,43,.96)'],
      ['--dsw-alias-settings-card-fill', alphaMix('#FFFDFB', 72)],
    ];

    const ALIAS_DARK = [
      ['--dsw-alias-bg-base', 'transparent'],
      ['--dsw-alias-bg-layer-1', alphaMix('#1B1822', 70)],
      ['--dsw-alias-bg-layer-2', alphaMix('#221E2A', 68)],
      ['--dsw-alias-bg-layer-3', alphaMix('#282332', 64)],
      ['--dsw-alias-bg-overlay', 'rgba(38,33,48,.94)'],
      ['--dsw-alias-border-l1', 'rgba(242,230,234,.14)'],
      ['--dsw-alias-border-l2', 'rgba(242,230,234,.20)'],
      ['--dsw-alias-border-l3', 'rgba(242,230,234,.26)'],
      ['--dsw-alias-border-l4', 'rgba(242,230,234,.34)'],
      ['--dsw-alias-brand-primary', '#E0B9C4'],
      ['--dsw-alias-brand-text', '#1A1620'],
      ['--dsw-alias-button-info-fill', '#E0B9C4'],
      ['--dsw-alias-button-info-hover', '#EFCBD5'],
      ['--dsw-alias-button-primary-hover', '#EFCBD5'],
      ['--dsw-alias-link', '#E0B9C4'],
      ['--dsw-alias-label-primary', '#FFFFFF'],
      ['--dsw-alias-label-secondary', '#E6E0EA'],
      ['--dsw-alias-label-tertiary', '#B4AABE'],
      ['--dsw-alias-state-error-primary', '#E08E97'],
      ['--dsw-alias-state-idle-primary', '#54495E'],
      ['--dsw-alias-state-success-primary', '#7FB694'],
      ['--dsw-alias-state-warn-primary', '#D9B26A'],
      ['--dsw-specific-sidebar-fill', alphaMix('#17141E', 62)],
      ['--dsw-specific-menu', 'rgba(38,33,48,.96)'],
      ['--dsw-specific-selector', 'rgba(38,33,48,.94)'],
      ['--dsw-specific-input-major', 'rgba(27,24,34,.86)'],
      ['--dsw-specific-tip', 'rgba(38,33,48,.94)'],
      ['--dsw-alias-markdown-code-block', alphaMix('#1D1926', 88)],
      ['--dsw-alias-markdown-inline-code', alphaMix('#241F2E', 92)],
      ['--dsw-alias-interactive-bg-hover', 'rgba(224,185,196,.10)'],
      ['--dsw-alias-scrollbar-bg-l1', '#352E3E'],
      ['--dsw-alias-tooltip-bg', '#342C40'],
      ['--dsw-alias-toast-bg', 'rgba(51,43,58,.96)'],
      ['--dsw-alias-settings-card-fill', alphaMix('#1B1822', 70)],
    ];

    const aliasLight = ALIAS_LIGHT.map(([name, value]) => `  ${name}:${value};`).join('\n');
    const aliasDark = ALIAS_DARK.map(([name, value]) => `  ${name}:${value};`).join('\n');
    const rampLight = Object.entries(RAMP)
      .map(([step, [light]]) => `  --dsw-static-neutral-bluish-${step}:${light};`)
      .join('\n');
    const rampDark = Object.entries(RAMP)
      .map(([step, [, dark]]) => `  --dsw-static-neutral-bluish-${step}:${dark};`)
      .join('\n');

    // ------------------------------------------------------------------- mark
    const CROWN = {
      d: '__CROWN_PATH__',
      viewBox: '__CROWN_VIEWBOX__',
    };

    const PETAL =
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E" +
      "%3Cpath d='M12 1.2c4.6 4.7 6.9 8.9 6.9 12.8 0 4.6-3.1 8.6-6.9 8.6s-6.9-4-6.9-8.6c0-3.9 2.3-8.1 6.9-12.8z' " +
      "fill='%23000'/%3E%3C/svg%3E\")";

    /**
     * 花束：照 `素材/egg01.png` 里她胸前那束白花的构成画的剪影
     * （八朵五瓣花聚成一团 + 两片叶 + 一截短茎），由 tools/bouquet.py 生成。
     * base64 里没有引号/反引号，进 JS 字符串最安全。
     */
    const BOUQUET = 'url("data:image/svg+xml;base64,__BOUQUET_B64__")';

    // -------------------------------------------------------------------- css
    const CSS = `
/* 总开关关掉时 body 作用域整个撤掉，但节点还挂在 DOM 上：
   先给一层"默认隐藏"，作用域内的规则优先级更高，打开时照常显示。 */
.tre-bg,.tre-ornament,.tre-mark,.tre-hero{display:none}
/* 所有选择器都在 body[data-dsh-theresa] 之内：停用插件即整层消失。 */
body[data-dsh-theresa]{
  --tre-dim-light:.42; --tre-dim-dark:.5;
  --tre-bouquet:${BOUQUET};
  /* 装饰的比例尺：间距、不透明度、描边。所有装饰只从这里取值，不再各调各的。 */
  --tre-gap-1:8px;
  --tre-gap-2:16px;
  --tre-gap-3:22px;
  --tre-gap-4:34px;
  --tre-o-ghost:.22;
  --tre-o-quiet:.32;
  --tre-o-soft:.58;
  --tre-o-firm:.86;
  --tre-hair:1px;
  --tre-line:0.5px;
  --tre-radius-control:10px;
  --tre-radius-surface:18px;
  --tre-motion-fast:140ms;
  --tre-motion-normal:240ms;
  --tre-motion-slow:1100ms;
  /* 玻璃强度：由 data-tre-glass 覆盖，0 清淡 / 1 标准 / 2 厚重 */
  --tre-glass-blur:16px;
  --tre-glass-sat:160%;
  /* 通透度乘子：大面铺底的 alpha 都乘它，JS 按设置写入 */
  --tre-alpha-scale:1;
  --tre-opacity-disabled:.48;
  --tre-focus-ring:0 0 0 2px rgba(122,78,92,.45);
  --tre-text-primary:#181319;
  --tre-text-secondary:#3F363F;
  --tre-text-tertiary:#6B6169;
  --tre-surface:rgba(255,253,251,.72);
  --tre-surface-hover:rgba(122,78,92,.09);
  --tre-border:rgba(43,30,36,.12);
  --tre-border-strong:rgba(43,30,36,.26);
  --tre-accent:#7A4E5C;
}
body[data-dsh-theresa][data-tre-glass="0"]{ --tre-glass-blur:9px; --tre-glass-sat:140% }
body[data-dsh-theresa][data-tre-glass="2"]{ --tre-glass-blur:24px; --tre-glass-sat:175% }
body[data-dsh-theresa][data-ds-dark-theme]{
  --tre-focus-ring:0 0 0 2px rgba(224,185,196,.5);
  --tre-text-primary:#FFFFFF;
  --tre-text-secondary:#E6E0EA;
  --tre-text-tertiary:#B4AABE;
  --tre-surface:rgba(27,24,34,.72);
  --tre-surface-hover:rgba(224,185,196,.10);
  --tre-border:rgba(242,230,234,.16);
  --tre-border-strong:rgba(242,230,234,.30);
  --tre-accent:#E0B9C4;
}

/* ---- token 层：底色透明，面板半透明玻璃 ---- */
body[data-dsh-theresa][data-theresa-skin="on"]{
${aliasLight}
${rampLight}
}
body[data-dsh-theresa][data-theresa-skin="on"][data-ds-dark-theme]{
${aliasDark}
${rampDark}
}

/* ---- 窗口画布兜底：桌面版窗口带原生材质，html 不给底色会整屏发糊 ---- */
html:has(body[data-dsh-theresa][data-theresa-skin="on"]){background:#FBF8F4}
html:has(body[data-dsh-theresa][data-theresa-skin="on"][data-ds-dark-theme]){background:#14111B}

/* ---- 画布级容器显式透明 ----
   DSH NEXT 把 bg-layer-1 铺到了比以前更大的面上（整页/整列），
   同一份半透明白在新版就会"白一层"。这里把画布级容器清空，
   玻璃只留给我们自己点名的面板；:where() 把特异性压到 0，不抢组件自己的底色。 */
body[data-dsh-theresa][data-theresa-skin="on"] :where(#root, #app, main, [data-ds-app], [data-ds-shell], [data-slot="conversation"], [data-slot="main"], [data-slot="workspace"]) {
  background-color: transparent;
}

/* ---- 背景层：body 的真实子元素，fixed + z-index:-1 ---- */
body[data-dsh-theresa] .tre-bg{
  display:block;
  position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;
  background:radial-gradient(1100px 760px at 12% -6%,rgba(255,196,226,.55),rgba(255,196,226,0) 62%),
             radial-gradient(900px 700px at 88% 4%,rgba(214,190,255,.45),rgba(214,190,255,0) 60%),
             linear-gradient(158deg,#fff8fc 0%,#fdf3ec 40%,#f7f0f6 100%);
}
body[data-dsh-theresa][data-ds-dark-theme] .tre-bg{
  background:radial-gradient(1000px 720px at 14% -8%,rgba(150,72,124,.5),rgba(150,72,124,0) 62%),
             radial-gradient(880px 680px at 86% 2%,rgba(104,86,168,.45),rgba(104,86,168,0) 60%),
             linear-gradient(158deg,#1b1520 0%,#181420 46%,#12101a 100%);
}
body[data-dsh-theresa][data-tre-bg="off"] .tre-bg{display:none}
body[data-dsh-theresa] .tre-bg-img{
  position:absolute;inset:0;background-position:var(--tre-focus-x,50%) var(--tre-focus-y,50%);
  background-size:cover;background-repeat:no-repeat;
  transform:scale(var(--tre-bg-zoom,1));
  transform-origin:var(--tre-focus-x,50%) var(--tre-focus-y,50%);
  opacity:0;transition:opacity var(--tre-motion-slow,1100ms) ease;
}
/* 「完整」适配：整张图都露出来，多出来的地方由渐变底填 */
body[data-dsh-theresa][data-tre-fit="contain"] .tre-bg-img{background-size:contain}
body[data-dsh-theresa] .tre-bg-img[data-active="1"]{opacity:1}
/* 阅读衬底：从侧栏右边缘起，把正文那一侧压暗/压亮，人物一侧保持通透。
   强度 = 色纱档位 × 阅读衬底滑杆，两层互相独立。 */
body[data-dsh-theresa] .tre-bg-read{
  position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(90deg,
    rgba(255,250,246,calc(var(--tre-dim-light,.42) * var(--tre-read-strength,.5) * 1.15)) 0%,
    rgba(255,250,246,calc(var(--tre-dim-light,.42) * var(--tre-read-strength,.5) * .78)) 34%,
    rgba(255,250,246,calc(var(--tre-dim-light,.42) * var(--tre-read-strength,.5) * .34)) 62%,
    rgba(255,250,246,0) 84%);
}
body[data-dsh-theresa][data-ds-dark-theme] .tre-bg-read{
  background:linear-gradient(90deg,
    rgba(16,13,21,calc(var(--tre-dim-dark,.5) * var(--tre-read-strength,.5) * 1.25)) 0%,
    rgba(16,13,21,calc(var(--tre-dim-dark,.5) * var(--tre-read-strength,.5) * .82)) 34%,
    rgba(16,13,21,calc(var(--tre-dim-dark,.5) * var(--tre-read-strength,.5) * .38)) 62%,
    rgba(16,13,21,0) 84%);
}
@media (prefers-reduced-motion:reduce){body[data-dsh-theresa] .tre-bg-img{transition:none}}
/* 色纱：浓度分白昼/长夜两档。CSS 按 color-scheme 各取一个，JS 不必订阅主题变化。 */
body[data-dsh-theresa] .tre-bg-veil{
  position:absolute;inset:0;
  background:radial-gradient(1200px 800px at 12% -6%,rgba(255,196,226,calc(var(--tre-dim-light,.45) * .5)),rgba(255,196,226,0) 62%),
             radial-gradient(900px 700px at 88% 4%,rgba(206,190,255,calc(var(--tre-dim-light,.45) * .4)),rgba(206,190,255,0) 60%),
             rgba(255,250,246,var(--tre-dim-light,.45));
}
body[data-dsh-theresa][data-ds-dark-theme] .tre-bg-veil{
  background:radial-gradient(1000px 720px at 14% -8%,rgba(150,72,124,calc(var(--tre-dim-dark,.45) * .5)),rgba(150,72,124,0) 62%),
             radial-gradient(880px 680px at 86% 2%,rgba(104,86,168,calc(var(--tre-dim-dark,.45) * .45)),rgba(104,86,168,0) 60%),
             rgba(20,17,27,var(--tre-dim-dark,.45));
}

/* ---- 侧栏立绘：底部对齐塞进侧栏那片空白。
       宽度由 JS 实测 [data-slot="sidebar"] 后写进 --tre-side-w；
       侧栏收成窄条时置 data-tre-side="narrow" 自动隐藏。 ---- */
body[data-dsh-theresa] .tre-side-figure{
  position:fixed;left:0;bottom:var(--tre-figure-inset,0px);z-index:0;pointer-events:none;
  width:var(--tre-side-w,260px);
  height:min(62vh,460px);
  background:var(--tre-figure-url) bottom center/contain no-repeat;
  transform:scale(var(--tre-figure-scale,1));transform-origin:bottom center;
  transition:opacity 300ms ease,transform 180ms ease,bottom 180ms ease;
  opacity:var(--tre-figure-o,.62);
  -webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 18%,#000 100%);
  mask-image:linear-gradient(180deg,transparent 0%,#000 18%,#000 100%);
  filter:drop-shadow(0 6px 18px rgba(60,40,50,.10));
}
body[data-dsh-theresa][data-ds-dark-theme] .tre-side-figure{
  filter:drop-shadow(0 6px 22px rgba(0,0,0,.45)) brightness(1.06);
}
body[data-dsh-theresa][data-tre-figure="off"] .tre-side-figure,
body[data-dsh-theresa][data-tre-side="narrow"] .tre-side-figure,
body[data-dsh-theresa][data-tre-figure="off"] .tre-side-shade,
body[data-dsh-theresa][data-tre-side="narrow"] .tre-side-shade{display:none}
/* 落点：脚下一团极淡的椭圆阴影，让立绘"站"在侧栏底边上，而不是被窗口裁掉 */
body[data-dsh-theresa] .tre-side-figure::after{
  content:"";position:absolute;left:6%;right:6%;bottom:-4px;height:28px;
  background:radial-gradient(50% 50% at 50% 50%,rgba(58,38,48,.26),rgba(58,38,48,0) 72%);
  filter:blur(3px);
}
body[data-dsh-theresa][data-ds-dark-theme] .tre-side-figure::after{
  background:radial-gradient(50% 50% at 50% 50%,rgba(0,0,0,.5),rgba(0,0,0,0) 72%);
}
/* 侧栏底部的渐隐：把立绘的下沿化进背景，避免硬切的横线 */
body[data-dsh-theresa] .tre-side-shade{
  position:fixed;left:0;bottom:0;z-index:0;pointer-events:none;
  width:var(--tre-side-w,260px);height:64px;
  background:linear-gradient(180deg,rgba(247,242,237,0),rgba(247,242,237,.55));
}
body[data-dsh-theresa][data-ds-dark-theme] .tre-side-shade{
  background:linear-gradient(180deg,rgba(23,20,30,0),rgba(23,20,30,.6));
}

/* ---- 「预览版」徽章：把文字换成五瓣花，并把蓝底改成金色描边 ---- */
body[data-dsh-theresa] [class*="previewBadge"]{
  display:inline-flex;align-items:center;justify-content:center;
  font-size:0;padding:3px 5px;line-height:0;
  border-color:color-mix(in srgb, var(--dsw-alias-state-warn-primary,#B08234) 42%, transparent);
  background:color-mix(in srgb, var(--dsw-alias-state-warn-primary,#B08234) 14%, transparent);
  color:var(--dsw-alias-state-warn-primary,#B08234);
}
body[data-dsh-theresa] [class*="previewBadge"]::after{
  content:"";display:block;width:16px;height:16px;
  background-color:currentColor;
  -webkit-mask:var(--tre-bouquet) center/contain no-repeat;
  mask:var(--tre-bouquet) center/contain no-repeat;
}

/* ---- 欢迎页那句话：宿主把它渲染成 titleGroup 里一个没有 class 的 span（26px/500）。
       注意：本段整体在 JS 模板字符串内，注释里不能出现反引号，否则会提前闭合字符串。 ---- */
/* 书法字体：霞鹜文楷（OFL）的 10 字形子集，2.6 KB，由 Host 路由出图。
   缺字（用户改了文案）会按 CSS 字体栈逐字回落，不会变豆腐块。 */
@font-face{
  font-family:"Theresa Script";
  src:url(/theresa/headline-font) format("woff2");
  font-weight:400;font-style:normal;font-display:swap;
}
body[data-dsh-theresa][data-tre-headline="on"] [class*="titleGroup"] > span:first-child{font-size:0}
body[data-dsh-theresa][data-tre-headline="on"] [class*="titleGroup"] > span:first-child::after{
  content:var(--tre-headline, "去找到你自己吧……");
  font-family:"Theresa Script","STKaiti","KaiTi","Songti SC",serif;
  font-size:29px;font-weight:400;line-height:38px;letter-spacing:.06em;
  max-width:18em;
  color:var(--dsw-alias-label-primary,#181319);
  text-shadow:0 1px 2px rgba(255,255,255,.55);
}
body[data-dsh-theresa][data-tre-headline="on"][data-ds-dark-theme] [class*="titleGroup"] > span:first-child::after{
  text-shadow:0 1px 3px rgba(10,8,14,.6);
}
@media (max-width:1100px){
  body[data-dsh-theresa][data-tre-headline="on"] [class*="titleGroup"] > span:first-child::after{
    font-size:26px;line-height:34px;letter-spacing:.05em;
  }
}

/* ---- 落款印章 + 四角金线：都在 shell.overlay 里，纯装饰、不吃指针 ---- */
body[data-dsh-theresa] .tre-ornament{display:block;position:fixed;inset:0;pointer-events:none;z-index:0}
body[data-dsh-theresa][data-tre-seal="off"] .tre-seal,
body[data-dsh-theresa][data-tre-frame="off"] .tre-frame{display:none}
/* 落款：左下角（避开右下角的小鲸鱼挂件），中文在上、英文在下，中间一条细金线。
   左边距跟着实测的侧栏宽度走，所以它落在正文列的左边缘，不压侧栏底部的按钮。
   两个签名都是「白 RGB + alpha」的蒙版：形状由文件给、颜色由主题给，
   于是浅色/深色共用同一份素材，金色装饰也不会被吃掉。 */
body[data-dsh-theresa] .tre-seal{
  position:absolute;left:calc(var(--tre-side-w,260px) + var(--tre-gap-4,34px));bottom:var(--tre-gap-4,34px);
  display:flex;flex-direction:column;align-items:center;
  gap:var(--tre-gap-1);opacity:var(--tre-o-firm);
}
body[data-dsh-theresa] .tre-sig{position:relative;display:block}
body[data-dsh-theresa] .tre-sig-size{display:block;width:100%;height:auto;visibility:hidden}
body[data-dsh-theresa] .tre-sig-layer{
  position:absolute;inset:0;
  -webkit-mask-position:center;mask-position:center;
  -webkit-mask-size:100% 100%;mask-size:100% 100%;
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  background-color:var(--dsw-alias-label-secondary,#3F363F);
}
body[data-dsh-theresa][data-ds-dark-theme] .tre-sig-layer{background-color:#EDE6EE}
body[data-dsh-theresa] .tre-sig-layer--gold{background-color:var(--dsw-alias-state-warn-primary,#B08234)}
/* 分隔线只到中文宽度的 64%，居中——比通栏更像落款的分行，而不是表格的边框 */
body[data-dsh-theresa] .tre-seal-rule{
  width:56%;height:1px;
  background:color-mix(in srgb, var(--dsw-alias-state-warn-primary,#B08234) 55%, transparent);
}
/* 黑冠压在「特蕾西娅」中线上 */
body[data-dsh-theresa] .tre-seal-mark{
  width:auto;display:flex;align-items:center;justify-content:center;
  color:var(--dsw-alias-label-secondary,#3F363F);opacity:var(--tre-o-firm);
}
body[data-dsh-theresa][data-ds-dark-theme] .tre-seal-mark{color:#EDE6EE}
body[data-dsh-theresa] .tre-seal-text{
  writing-mode:vertical-rl;text-orientation:upright;
  font-family:"Noto Serif SC","Songti SC","Source Han Serif SC",serif;
  font-size:13px;letter-spacing:.34em;line-height:1;
  color:var(--dsw-alias-label-secondary,#3F363F);
  padding:11px 7px;border:1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary,#B08234) 45%, transparent);
}
/* 四角金线：双线 + 角钉。单线太像边界框，双线才有装裱的意味。 */
body[data-dsh-theresa] .tre-frame{
  position:absolute;inset:var(--tre-gap-2);
  opacity:var(--tre-o-ghost);color:var(--dsw-alias-state-warn-primary,#B08234);
}
body[data-dsh-theresa] .tre-frame svg{position:absolute;width:40px;height:40px}
body[data-dsh-theresa] .tre-frame svg:nth-child(1){top:0;left:0}
body[data-dsh-theresa] .tre-frame svg:nth-child(2){top:0;right:0;transform:scaleX(-1)}
body[data-dsh-theresa] .tre-frame svg:nth-child(3){bottom:0;right:0;transform:scale(-1)}
body[data-dsh-theresa] .tre-frame svg:nth-child(4){bottom:0;left:0;transform:scaleY(-1)}
@media (max-width:900px){
  body[data-dsh-theresa] .tre-seal{display:none}
  body[data-dsh-theresa] .tre-frame{display:none}
}

/* ---- 花瓣：跟着背景层走，在内容之下，不再盖字 ---- */
body[data-dsh-theresa] .tre-petals{position:absolute;inset:0;display:block}
body[data-dsh-theresa] .tre-petal{
  position:absolute;top:-12vh;width:30px;height:30px;background-color:#DEB6C2;opacity:0;
  animation:tre-fall linear infinite;will-change:transform,opacity;
  filter:blur(var(--tre-petal-blur,0));
  -webkit-mask:${PETAL} center/contain no-repeat;mask:${PETAL} center/contain no-repeat;
}
body[data-dsh-theresa][data-ds-dark-theme] .tre-petal{background-color:#F1E1E6}
@keyframes tre-fall{
  0%{transform:translate3d(0,-12vh,0) rotate(0deg);opacity:0}
  9%{opacity:var(--tre-petal-o,.4)}
  90%{opacity:var(--tre-petal-o,.4)}
  100%{transform:translate3d(var(--tre-petal-drift,60px),112vh,0) rotate(var(--tre-petal-spin,340deg));opacity:0}
}
/* 三档景深：近（大、清晰、快）、中（略虚）、远（小、虚、慢）。
   之前 14 片每片都不同，看着是噪声；分档之后才有纵深。 */
body[data-dsh-theresa] .tre-petal:nth-child(1){left:6%;--tre-petal-drift:70px;--tre-petal-spin:280deg;--tre-petal-o:.40;animation-duration:21s;animation-delay:-2s;width:40px;height:40px}
body[data-dsh-theresa] .tre-petal:nth-child(2){left:31%;--tre-petal-drift:-60px;--tre-petal-spin:-320deg;--tre-petal-o:.40;animation-duration:23s;animation-delay:-13s;width:44px;height:44px}
body[data-dsh-theresa] .tre-petal:nth-child(3){left:62%;--tre-petal-drift:90px;--tre-petal-spin:360deg;--tre-petal-o:.40;animation-duration:20s;animation-delay:-7s;width:38px;height:38px}
body[data-dsh-theresa] .tre-petal:nth-child(4){left:12%;--tre-petal-drift:-80px;--tre-petal-spin:-260deg;--tre-petal-o:.28;--tre-petal-blur:.3px;animation-duration:27s;animation-delay:-4s;width:28px;height:28px}
body[data-dsh-theresa] .tre-petal:nth-child(5){left:24%;--tre-petal-drift:55px;--tre-petal-spin:300deg;--tre-petal-o:.28;--tre-petal-blur:.3px;animation-duration:29s;animation-delay:-19s;width:26px;height:26px}
body[data-dsh-theresa] .tre-petal:nth-child(6){left:43%;--tre-petal-drift:-110px;--tre-petal-spin:-380deg;--tre-petal-o:.28;--tre-petal-blur:.3px;animation-duration:26s;animation-delay:-12s;width:30px;height:30px}
body[data-dsh-theresa] .tre-petal:nth-child(7){left:71%;--tre-petal-drift:60px;--tre-petal-spin:340deg;--tre-petal-o:.28;--tre-petal-blur:.3px;animation-duration:31s;animation-delay:-6s;width:24px;height:24px}
body[data-dsh-theresa] .tre-petal:nth-child(8){left:86%;--tre-petal-drift:-45px;--tre-petal-spin:-300deg;--tre-petal-o:.28;--tre-petal-blur:.3px;animation-duration:28s;animation-delay:-21s;width:27px;height:27px}
body[data-dsh-theresa] .tre-petal:nth-child(9){left:3%;--tre-petal-drift:100px;--tre-petal-spin:400deg;--tre-petal-o:.18;--tre-petal-blur:.8px;animation-duration:36s;animation-delay:-3s;width:16px;height:16px}
body[data-dsh-theresa] .tre-petal:nth-child(10){left:18%;--tre-petal-drift:-40px;--tre-petal-spin:-280deg;--tre-petal-o:.18;--tre-petal-blur:.8px;animation-duration:38s;animation-delay:-17s;width:18px;height:18px}
body[data-dsh-theresa] .tre-petal:nth-child(11){left:37%;--tre-petal-drift:80px;--tre-petal-spin:320deg;--tre-petal-o:.18;--tre-petal-blur:.8px;animation-duration:34s;animation-delay:-8s;width:14px;height:14px}
body[data-dsh-theresa] .tre-petal:nth-child(12){left:55%;--tre-petal-drift:-70px;--tre-petal-spin:-360deg;--tre-petal-o:.18;--tre-petal-blur:.8px;animation-duration:40s;animation-delay:-14s;width:17px;height:17px}
body[data-dsh-theresa] .tre-petal:nth-child(13){left:78%;--tre-petal-drift:50px;--tre-petal-spin:300deg;--tre-petal-o:.18;--tre-petal-blur:.8px;animation-duration:37s;animation-delay:-24s;width:15px;height:15px}
body[data-dsh-theresa] .tre-petal:nth-child(14){left:93%;--tre-petal-drift:-90px;--tre-petal-spin:-420deg;--tre-petal-o:.18;--tre-petal-blur:.8px;animation-duration:42s;animation-delay:-27s;width:16px;height:16px}
@media (prefers-reduced-motion:reduce){body[data-dsh-theresa] .tre-petal{display:none}}

/* ---- 毛玻璃：只给大面板。
       对话列与 shell.overlay 宿主一律不加 —— 它们成为 fixed 后代的包含块时，
       输入框、发送键的 Tooltip 会闪。 ---- */
body[data-dsh-theresa][data-theresa-skin="on"] [data-slot="sidebar"],
body[data-dsh-theresa][data-theresa-skin="on"] [data-slot="sidebar.settings"],
body[data-dsh-theresa][data-theresa-skin="on"] [data-dockkit-pane],
body[data-dsh-theresa][data-theresa-skin="on"] [data-dockkit-float],
body[data-dsh-theresa][data-theresa-skin="on"] [role="dialog"],
body[data-dsh-theresa][data-theresa-skin="on"] [data-shell-overlay] > *{
  -webkit-backdrop-filter:blur(var(--tre-glass-blur,16px)) saturate(var(--tre-glass-sat,160%));
  backdrop-filter:blur(var(--tre-glass-blur,16px)) saturate(var(--tre-glass-sat,160%));
}

/* ---- 正文可读性：给字加一圈光晕，而不是把图调淡 ----
       只落在真正的文字块上；代码块自带底色，不受影响。 */
body[data-dsh-theresa][data-tre-bg="on"][data-theresa-skin="on"]{--dsw-specific-bubble:rgba(255,255,255,.78)}
body[data-dsh-theresa][data-tre-bg="on"][data-theresa-skin="on"][data-ds-dark-theme]{--dsw-specific-bubble:rgba(66,44,62,.74)}
body[data-dsh-theresa][data-tre-bg="on"] [data-conversation-scroll] :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th){
  text-shadow:0 1px 2px rgba(255,255,255,calc(var(--tre-halo,.8) * .92)),0 0 10px rgba(255,250,246,calc(var(--tre-halo,.8) * .75));
}
body[data-dsh-theresa][data-tre-bg="on"][data-ds-dark-theme] [data-conversation-scroll] :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th){
  text-shadow:0 1px 2px rgba(12,8,16,calc(var(--tre-halo,.8) * .9)),0 0 10px rgba(20,17,27,calc(var(--tre-halo,.8) * .7));
}

/* ---- 徽记 ---- */
body[data-dsh-theresa] .tre-mark{display:flex;align-items:center;justify-content:center;color:currentColor}
body[data-dsh-theresa][data-ds-dark-theme] .tre-mark{color:#EDE6EE}
body[data-dsh-theresa][data-tre-crown="off"] .tre-mark,
body[data-dsh-theresa][data-tre-hero="off"] .tre-hero{display:none}
body[data-dsh-theresa] .tre-hero{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  color:var(--dsw-alias-state-warn-primary);
}
/* 欢迎页的黑冠：亮色下取墨色（"黑冠"就该是黑的），暗色下反白，
   否则在深底上会看不见。 */
body[data-dsh-theresa] .tre-hero-crown{
  display:flex;align-items:center;justify-content:center;
  color:var(--dsw-alias-label-secondary,#3F363F);
}
body[data-dsh-theresa][data-ds-dark-theme] .tre-hero-crown{color:#EDE6EE}
body[data-dsh-theresa] .tre-hero svg{filter:drop-shadow(0 0 20px rgba(176,130,52,.40))}

/* ---- 设置页：自带一套 --tre-* 语义层，所有 var 都带兜底 ---- */
body[data-dsh-theresa] .tre-page{display:flex;flex-direction:column;gap:16px;padding:2px 0 28px}
body[data-dsh-theresa] .tre-card{
  background:var(--tre-surface,rgba(255,253,251,.72));
  border:1px solid var(--tre-border,rgba(43,30,36,.12));
  border-radius:var(--tre-radius-surface,16px);
  padding:14px 16px;display:flex;flex-direction:column;gap:10px;
}
body[data-dsh-theresa] .tre-card-title{font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--tre-text-tertiary,#6B6169)}
body[data-dsh-theresa] .tre-row{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:34px}
body[data-dsh-theresa] .tre-col{display:flex;flex-direction:column;gap:4px;min-width:0}
body[data-dsh-theresa] .tre-label{font-size:13px;color:var(--tre-text-primary,#181319)}
body[data-dsh-theresa] .tre-hint{font-size:11.5px;line-height:1.5;color:var(--tre-text-tertiary,#6B6169)}
/* ---- 开屏动画：一次性全屏层，点击/按键即跳过 ---- */
body[data-dsh-theresa] .tre-opening{
  position:fixed;inset:0;z-index:2147483000;cursor:pointer;
  background:#14111B center/cover no-repeat;
  opacity:1;
  /* 退场时长由 JS 按"自然播完 / 手动跳过"分别写入 */
  transition:opacity var(--tre-opening-fade,1800ms) ease;
}
body[data-dsh-theresa] .tre-opening[data-out="1"]{opacity:0}
body[data-dsh-theresa] .tre-opening-video{
  width:100%;height:100%;object-fit:cover;display:block;
  opacity:0;transition:opacity 500ms ease;
}
body[data-dsh-theresa] .tre-opening[data-ready="1"] .tre-opening-video{opacity:1}
/* 开屏的声音开关：黑冠做按钮，放在左下角（右下是小鲸鱼挂件的地盘）。
   开屏层点哪儿都"跳过"，所以它必须自己吃掉点击。 */
body[data-dsh-theresa] .tre-opening-sound{
  position:absolute;left:26px;bottom:26px;pointer-events:auto;cursor:pointer;
  width:46px;height:46px;padding:0;border-radius:999px;
  display:flex;align-items:center;justify-content:center;
  border:1px solid rgba(255,255,255,.42);background:rgba(20,16,24,.52);color:#fff;
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  transition:background 160ms ease,border-color 160ms ease,color 160ms ease;
}
body[data-dsh-theresa] .tre-opening-sound svg{display:block}
body[data-dsh-theresa] .tre-opening-sound:hover{
  background:rgba(142,59,74,.82);border-color:rgba(255,255,255,.7);color:#FFE9C9;
}
body[data-dsh-theresa] .tre-opening-sound:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(255,255,255,.65)}
@media (prefers-reduced-motion:reduce){body[data-dsh-theresa] .tre-opening{display:none}}

body[data-dsh-theresa] .tre-switch{
  flex:none;width:42px;height:23px;border-radius:999px;border:1px solid var(--tre-border-strong,rgba(43,30,36,.26));
  background:var(--tre-surface-hover,rgba(122,78,92,.09));position:relative;cursor:pointer;
  transition:background var(--tre-motion-fast,120ms) ease,border-color var(--tre-motion-fast,120ms) ease;
}
body[data-dsh-theresa] .tre-switch::after{
  content:"";position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:999px;
  background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform var(--tre-motion-fast,120ms) ease;
}
body[data-dsh-theresa] .tre-switch[aria-checked="true"]{background:var(--tre-accent,#7A4E5C);border-color:var(--tre-accent,#7A4E5C)}
body[data-dsh-theresa] .tre-switch[aria-checked="true"]::after{transform:translateX(19px)}
body[data-dsh-theresa] .tre-switch:focus-visible{outline:none;box-shadow:var(--tre-focus-ring,0 0 0 2px rgba(122,78,92,.45))}
body[data-dsh-theresa] .tre-slider{width:100%;accent-color:var(--tre-accent,#7A4E5C)}
body[data-dsh-theresa] .tre-value{font-size:12px;font-variant-numeric:tabular-nums;color:var(--tre-text-secondary,#3F363F)}
body[data-dsh-theresa] .tre-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}
body[data-dsh-theresa] .tre-thumb{
  position:relative;aspect-ratio:16/10;border-radius:12px;overflow:hidden;padding:0;cursor:pointer;
  border:2px solid transparent;background:var(--tre-surface-hover,rgba(122,78,92,.09));
  transition:border-color var(--tre-motion-fast,120ms) ease,transform var(--tre-motion-fast,120ms) ease;
}
body[data-dsh-theresa] .tre-thumb-pick{
  display:block;width:100%;height:100%;padding:0;border:0;background:none;cursor:pointer;
}
body[data-dsh-theresa] .tre-thumb-pick:focus-visible{outline:none;box-shadow:var(--tre-focus-ring,0 0 0 2px rgba(122,78,92,.45))}
body[data-dsh-theresa] .tre-thumb-del{
  position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:999px;cursor:pointer;
  border:1px solid rgba(255,255,255,.5);background:rgba(20,16,24,.55);color:#fff;
  font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;
}
body[data-dsh-theresa] .tre-thumb-del:hover{background:rgba(142,59,74,.85)}
body[data-dsh-theresa] .tre-thumb img{width:100%;height:100%;object-fit:cover;display:block}
body[data-dsh-theresa] .tre-thumb:hover{transform:translateY(-1px)}
body[data-dsh-theresa] .tre-thumb[data-selected="1"]{border-color:var(--tre-accent,#7A4E5C)}
/* 立绘是透明底的，缩略图里用浅底 + contain，别被 cover 裁掉手脚 */
body[data-dsh-theresa] .tre-grid--figure{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}
body[data-dsh-theresa] .tre-grid--figure .tre-thumb{aspect-ratio:3/4}
body[data-dsh-theresa] .tre-grid--figure .tre-thumb-pick{
  background:
    linear-gradient(0deg,var(--tre-surface-hover,rgba(122,78,92,.09)),var(--tre-surface-hover,rgba(122,78,92,.09)));
}
body[data-dsh-theresa] .tre-grid--figure .tre-thumb img{object-fit:contain}
body[data-dsh-theresa] .tre-thumb:focus-visible{outline:none;box-shadow:var(--tre-focus-ring,0 0 0 2px rgba(122,78,92,.45))}
body[data-dsh-theresa] .tre-thumb-name{
  position:absolute;left:0;right:0;bottom:0;padding:4px 8px;font-size:11px;text-align:left;
  color:#fff;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.55));
}
body[data-dsh-theresa] .tre-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
body[data-dsh-theresa] .tre-figure-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:2px}
body[data-dsh-theresa] .tre-file-hidden{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
body[data-dsh-theresa] .tre-input{
  width:100%;box-sizing:border-box;padding:8px 11px;font:inherit;font-size:13px;
  border-radius:var(--tre-radius-control,10px);
  border:1px solid var(--tre-border-strong,rgba(43,30,36,.26));
  background:var(--tre-surface,rgba(255,253,251,.72));color:var(--tre-text-primary,#181319);
}
body[data-dsh-theresa] .tre-input:focus-visible{outline:none;box-shadow:var(--tre-focus-ring,0 0 0 2px rgba(122,78,92,.45))}
body[data-dsh-theresa] .tre-status{font-size:11.5px;line-height:1.5}
/* 「检查遮挡层」的结果：等宽、可滚动、不占满整页 */
body[data-dsh-theresa] .tre-probe{
  margin-top:8px;padding:8px 10px;border-radius:var(--tre-radius-control,10px);
  border:1px solid var(--tre-border,rgba(43,30,36,.12));
  background:var(--tre-surface,rgba(255,253,251,.72));
  max-height:180px;overflow:auto;display:flex;flex-direction:column;gap:4px;
}
body[data-dsh-theresa] .tre-probe-line{
  font-family:ui-monospace,Consolas,monospace;font-size:11px;line-height:1.45;
  color:var(--tre-text-secondary,#3F363F);white-space:pre-wrap;word-break:break-all;
}
body[data-dsh-theresa] .tre-status[data-state="ok"]{color:var(--dsw-alias-state-success-primary,#4E7A5F)}
body[data-dsh-theresa] .tre-status[data-state="busy"]{color:var(--tre-text-tertiary,#6B6169)}
body[data-dsh-theresa] .tre-status[data-state="error"]{color:var(--dsw-alias-state-error-primary,#A8434F)}
body[data-dsh-theresa] .tre-btn{
  padding:7px 13px;border-radius:var(--tre-radius-control,10px);font-size:12.5px;cursor:pointer;
  border:1px solid var(--tre-border-strong,rgba(43,30,36,.26));
  background:var(--tre-surface,rgba(255,253,251,.72));color:var(--tre-text-primary,#181319);
  transition:background var(--tre-motion-fast,120ms) ease;
}
body[data-dsh-theresa] .tre-btn:hover{background:var(--tre-surface-hover,rgba(122,78,92,.09))}
body[data-dsh-theresa] .tre-btn[data-on="1"]{
  border-color:var(--tre-accent,#7A4E5C);
  background:color-mix(in srgb, var(--tre-accent,#7A4E5C) 14%, transparent);
  color:var(--tre-accent,#7A4E5C);
}
body[data-dsh-theresa] .tre-btn:focus-visible{outline:none;box-shadow:var(--tre-focus-ring,0 0 0 2px rgba(122,78,92,.45))}
@media (hover:none){body[data-dsh-theresa] .tre-btn{padding:10px 14px}}
`;

    // ------------------------------------------------------------------ state
    const store = {
      value: {
        rev: 0,
        ready: false,
        enabled: true,
        background: {
          current: '',
          dim: { light: 0.12, dark: 0.18 },
          fit: 'cover',
          focus: { x: 50, y: 50 },
          zoom: 1,
          substrate: 0.25,
        },
        decoration: {
          petals: true,
          petalCount: 8,
          crownMark: true,
          heroCrown: true,
          seal: true,
          sealLatin: true,
          frame: true,
          figure: true,
          figureScale: 1,
          glass: 1,
          clarity: 55,
          figureOpacity: 0.62,
          figureInset: 0,
        },
        opening: { enabled: true, oncePerSession: true, sound: false, hasOpening: false, posterUrl: null },
        backgrounds: [],
        signature: { available: false },
        sidebarFigure: { current: '', custom: false, version: 0, options: [] },
        hero: { replace: true, headline: DEFAULT_HEADLINE },
        upload: { state: 'idle', text: '' },
        // 保存状态：idle / busy / saved / error
        save: { state: 'idle', text: '' },
        // 「检查遮挡层」的输出
        probe: [],
      },
      listeners: new Set(),
      set(patch) {
        this.value = { ...this.value, ...patch };
        for (const listener of this.listeners) {
          try {
            listener();
          } catch (error) {
            console.warn('[theresa] listener failed', error);
          }
        }
      },
      subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },
    };

    async function api(path, init) {
      try {
        const response = await fetch(path, init);
        return await response.json();
      } catch (error) {
        console.warn('[theresa] request failed', path, error);
        return null;
      }
    }

    /** 背景层与花瓣的 DOM 句柄（effect 内建、effect 内拆）。 */
    let layer = null;

    function ensureLayer() {
      if (layer !== null) return layer;
      const el = document.createElement('div');
      el.className = 'tre-bg';
      const first = document.createElement('div');
      first.className = 'tre-bg-img';
      first.dataset.active = '1';
      const second = document.createElement('div');
      second.className = 'tre-bg-img';
      const veil = document.createElement('div');
      veil.className = 'tre-bg-veil';
      // 阅读衬底压在色纱之上：正文那一侧再厚一点，画的那一侧保持通透
      const read = document.createElement('div');
      read.className = 'tre-bg-read';
      const petals = document.createElement('div');
      petals.className = 'tre-petals';
      el.append(first, second, veil, read, petals);
      document.body.appendChild(el);
      layer = { el, front: first, back: second, petals };
      return layer;
    }

    /** 交叉淡入换图。 */
    function setImage(url) {
      if (layer === null || !url) return;
      const target = `url("${url}")`;
      if (layer.front.style.backgroundImage === target) return;
      layer.back.style.backgroundImage = target;
      layer.back.dataset.active = '1';
      layer.front.dataset.active = '0';
      const swap = layer.front;
      layer.front = layer.back;
      layer.back = swap;
    }

    // ---------------------------------------------------------- 遮挡层治理
    /**
     * DSH NEXT 会把浅色底铺在比以前更多的容器上，而且类名不在我们的已知清单里。
     * 与其继续猜选择器，不如在运行时顺着「主列 → body」的祖先链走一遍：
     *   · 任何不透明的底色都清成 transparent（记住原值，卸载时还原）；
     *   · 任何 backdrop-filter 也一起关掉（它就是"糊"的另一半来源）；
     *   · 把看到的东西列出来，设置页里可见，方便核对到底是谁画的。
     */
    const ALPHA_RE = /rgba?\(([^)]+)\)/

    function alphaOf(color) {
      if (typeof color !== 'string' || color === '' || color === 'transparent') return 0
      const match = ALPHA_RE.exec(color)
      if (match === null) return 1
      const parts = match[1].split(/[ ,/]+/).filter(Boolean)
      return parts.length >= 4 ? Number(parts[3]) : 1
    }

    function columnRoot() {
      return (
        document.querySelector('[data-slot="conversation"]') ??
        document.querySelector('[data-conversation-scroll]') ??
        document.querySelector('main') ??
        null
      )
    }

    /** 列出祖先链上所有"会画一层"的节点。 */
    function probeOverlays() {
      const rows = []
      if (typeof window.getComputedStyle !== 'function') return rows
      const start = columnRoot()
      // 从主列自身开始：它的底色往往就是"白一层"的来源
      let node = start === null ? document.body : start
      const push = (el) => {
        if (el === null || el === undefined) return
        const cs = window.getComputedStyle(el)
        const bg = cs.backgroundColor
        const backdrop = cs.backdropFilter
        const filter = cs.filter
        const opacity = Number(cs.opacity)
        const paints =
          alphaOf(bg) > 0.02 ||
          (backdrop !== '' && backdrop !== 'none') ||
          (filter !== '' && filter !== 'none') ||
          (Number.isFinite(opacity) && opacity < 0.99)
        if (!paints) return
        rows.push({
          el,
          label: `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : ''}`,
          bg,
          alpha: alphaOf(bg),
          backdrop: backdrop === 'none' ? '' : backdrop,
          filter: filter === 'none' ? '' : filter,
          opacity,
        })
      }
      while (node !== null && node !== document.documentElement) {
        push(node)
        node = node.parentElement
      }
      push(document.body)
      return rows
    }

    /** 已清掉的节点：{el, bg, backdrop} —— 卸载时按原值还原。 */
    let clearedNodes = []
    let lastProbe = []

    function restoreCleared() {
      for (const item of clearedNodes) {
        item.el.style.removeProperty('background-color')
        if (item.backdrop) item.el.style.removeProperty('backdrop-filter')
        if (item.webkitBackdrop) item.el.style.removeProperty('-webkit-backdrop-filter')
      }
      clearedNodes = []
    }

    /** 清一次祖先链；可重复调用（幂等）。 */
    function syncOverlayClear() {
      if (document.body === null) return []
      const rows = probeOverlays()
      lastProbe = rows
      // 没有图 / 关掉主题时不要把宿主底色清掉：那会变成"透明到没有底"
      if (store.value.enabled === false || (store.value.background?.current ?? '') === '') {
        restoreCleared()
        return rows
      }
      for (const row of rows) {
        const already = clearedNodes.some((item) => item.el === row.el)
        if (already) continue
        const item = {
          el: row.el,
          backdrop: row.backdrop !== '',
          webkitBackdrop: false,
        }
        if (row.alpha > 0.02) row.el.style.setProperty('background-color', 'transparent', 'important')
        if (row.backdrop !== '') {
          row.el.style.setProperty('backdrop-filter', 'none', 'important')
          const cs = window.getComputedStyle(row.el)
          if (cs.webkitBackdropFilter !== undefined) {
            row.el.style.setProperty('-webkit-backdrop-filter', 'none', 'important')
            item.webkitBackdrop = true
          }
        }
        clearedNodes.push(item)
      }
      return rows
    }

    /** 把检测结果整理成设置页能显示的文字。 */
    function describeProbe(rows) {
      return rows.map((row) => {
        const bits = [`bg:${row.bg}`]
        if (row.backdrop !== '') bits.push(`backdrop:${row.backdrop}`)
        if (row.filter !== '') bits.push(`filter:${row.filter}`)
        if (row.opacity < 0.99) bits.push(`opacity:${row.opacity}`)
        return `${row.label}  ${bits.join('  ')}`
      })
    }

    /** 合并短时间内的多次请求，避免拖动滑杆时反复读计算样式。 */
    let overlayTick = null
    function queueOverlayClear() {
      if (overlayTick !== null) return
      overlayTick = setTimeout(() => {
        overlayTick = null
        try {
          syncOverlayClear()
        } catch (error) {
          console.warn('[theresa] overlay clear failed', error)
        }
      }, 120)
    }

    /** 花瓣数量按设定增删。 */
    function setPetals(on, count) {
      if (layer === null) return;
      const want = on ? Math.max(0, Math.min(14, count)) : 0;
      const host = layer.petals;
      while (host.childElementCount > want) host.lastElementChild.remove();
      while (host.childElementCount < want) {
        const span = document.createElement('span');
        span.className = 'tre-petal';
        host.appendChild(span);
      }
    }

    /** 只把快照投影到文档（不碰 store）：本地预览与服务器回读共用这一段。 */
    function applyToDom(value) {
      const body = document.body;
      if (!body) return;
      // 总开关关掉时整层撤掉：只翻 skin 会让背景、花瓣、落款继续留着
      if (value.enabled === false) {
        body.removeAttribute(BODY_ATTR);
      } else {
        body.setAttribute(BODY_ATTR, '');
        body.setAttribute(SKIN_ATTR, 'on');
      }
      body.setAttribute(BG_ATTR, value.background.current ? 'on' : 'off');
      body.setAttribute('data-tre-crown', value.decoration.crownMark ? 'on' : 'off');
      body.setAttribute('data-tre-hero', value.decoration.heroCrown ? 'on' : 'off');
      body.setAttribute('data-tre-seal', value.decoration.seal ? 'on' : 'off');
      body.setAttribute('data-tre-frame', value.decoration.frame ? 'on' : 'off');
      body.setAttribute('data-tre-figure', value.decoration.figure ? 'on' : 'off');
      body.setAttribute('data-tre-headline', value.hero?.replace === false ? 'off' : 'on');
      // 构图：适配方式、焦点、缩放、阅读衬底
      body.setAttribute('data-tre-fit', value.background.fit === 'contain' ? 'contain' : 'cover');
      body.setAttribute('data-tre-glass', String(value.decoration.glass ?? 1));
      // 通透度：0 最实、100 最透。
      // 只把"铺底"的 alpha 往下压，且留一个可读下限（0.78）：
      // 再透下去次要文字压在最花的画面上会掉到 3:1 左右，那就不是"清楚"而是"看不清"了。
      const clarity = Math.max(0, Math.min(100, Number(value.decoration.clarity ?? 55)));
      const alphaScale = 1.12 - (clarity / 100) * 0.34;
      body.style.setProperty('--tre-alpha-scale', String(Math.round(alphaScale * 1000) / 1000));
      // 越通透，字底下的光晕越实：面板让位给画，可读性由光晕接住
      body.style.setProperty('--tre-halo', String(Math.round((0.55 + (clarity / 100) * 0.45) * 1000) / 1000));
      const focus = value.background.focus ?? { x: 50, y: 50 };
      body.style.setProperty('--tre-focus-x', `${Math.round(focus.x)}%`);
      body.style.setProperty('--tre-focus-y', `${Math.round(focus.y)}%`);
      body.style.setProperty('--tre-bg-zoom', String(value.background.zoom ?? 1));
      body.style.setProperty('--tre-read-strength', String(value.background.substrate ?? 0.5));
      body.style.setProperty('--tre-figure-o', String(value.decoration.figureOpacity ?? 0.62));
      body.style.setProperty('--tre-figure-inset', `${Math.round(value.decoration.figureInset ?? 0)}px`);
      // 文案进 CSS 字符串：JSON.stringify 会给它加引号并转义
      body.style.setProperty('--tre-headline', JSON.stringify(value.hero?.headline ?? ''));
      const figureVersion = value.sidebarFigure?.version ?? 0;
      body.style.setProperty('--tre-figure-scale', String(value.decoration.figureScale ?? 1));
      body.style.setProperty(
        '--tre-figure-url',
        figureVersion > 0 ? "url(/theresa/sidebar-figure?v=" + figureVersion + ")" : "url(/theresa/sidebar-figure)",
      );
      // 两档浓度各写一个变量，由 CSS 按明暗自己挑
      body.style.setProperty('--tre-dim-light', String(value.background.dim.light));
      body.style.setProperty('--tre-dim-dark', String(value.background.dim.dark));
      const item = (value.backgrounds ?? []).find((entry) => entry.name === value.background.current);
      if (item !== undefined) setImage(item.url);
      setPetals(value.decoration.petals, value.decoration.petalCount);
      // 有图就要保证图上面没有宿主铺的浅色底
      if (value.enabled !== false && value.background.current) queueOverlayClear();
    }

    /** 把一份快照投影到文档上，并同步 store。 */
    function project(value) {
      applyToDom(value);
      store.set({ ...value, ready: true });
    }

    // -------------------------------------------------------------- 开屏动画
    const OPENING_FLAG = 'theresa:opening-played';
    let openingPlayed = false;

    function openingSeen() {
      try {
        return sessionStorage.getItem(OPENING_FLAG) === '1';
      } catch {
        return false;
      }
    }

    function markOpeningSeen() {
      try {
        sessionStorage.setItem(OPENING_FLAG, '1');
      } catch {
        // 存不了就每次都播，不影响功能
      }
    }

    /**
     * 播一次开屏动画。`force` 供设置页的「再看一次」用，绕过"每会话一次"。
     * 自动播放被拒、视频出错、按 Esc/空格/回车、点击、或播完 —— 任一情况都立即收尾。
     */
    function playOpening(opening, force = false) {
      if (openingPlayed && !force) return;
      if (!opening?.enabled || !opening.hasOpening) return;
      if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!force && opening.oncePerSession && openingSeen()) return;
      if (document.querySelector('.tre-opening') !== null) return;
      openingPlayed = true;

      const wrap = document.createElement('div');
      wrap.className = 'tre-opening';
      if (opening.posterUrl) wrap.style.backgroundImage = `url("${opening.posterUrl}")`;

      const video = document.createElement('video');
      video.className = 'tre-opening-video';
      video.src = `${ROUTE}/opening`;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = 'auto';
      if (opening.posterUrl) video.poster = opening.posterUrl;
      wrap.appendChild(video);
      document.body.appendChild(wrap);

      let done = false;
      let capTimer = null;
      /**
       * 退场：两种节奏。
       *   · 自然播完 → 先在最后那帧（白场）停一拍，再慢慢淡出，接进界面才不生硬；
       *   · 自己点掉 / 按 Esc → 不等，直接快速淡出，不然会觉得"点了没反应"。
       */
      const holdMs = 700;
      const fadeAutoMs = 1800;
      const fadeUserMs = 700;
      const finish = (reason) => {
        if (done) return;
        done = true;
        if (capTimer !== null) clearTimeout(capTimer);
        window.removeEventListener('keydown', onKey);
        wrap.removeEventListener('click', onClick);
        markOpeningSeen();
        const userSkip = reason === 'user';
        const hold = userSkip ? 0 : holdMs;
        const fade = userSkip ? fadeUserMs : fadeAutoMs;
        // 停一拍时把最后一帧钉住，避免某些实现把画面收成黑
        const freeze = () => {
          try {
            video.pause();
          } catch (error) {
            void error;
          }
        };
        const startFade = () => {
          freeze();
          wrap.style.setProperty('--tre-opening-fade', `${fade}ms`);
          wrap.dataset.out = '1';
          setTimeout(() => wrap.remove(), fade + 200);
        };
        if (hold > 0) setTimeout(startFade, hold);
        else startFade();
      };
      const onClick = (event) => {
        // 声音按钮自己 stopPropagation，不会走到这里
        void event;
        finish('user');
      };
      const onKey = (event) => {
        if (event.key === 'Escape' || event.key === ' ' || event.key === 'Enter') finish('user');
      };

      video.addEventListener('canplay', () => {
        wrap.dataset.ready = '1';
      }, { once: true });
      /**
       * 兜底计时器：只在"视频卡住"时才该收尾。
       * 之前直接用 duration * 1000 + 2500，遇到 duration 还没解析出来（NaN）
       * 就会退化成 6 秒 —— 片长 18 秒时表现为"没播完就结束了"。
       * 现在：拿不到可信时长就按 90 秒兜底，并在 durationchange 时重新计算。
       */
      const armCap = () => {
        if (done) return;
        if (capTimer !== null) clearTimeout(capTimer);
        const seconds = Number(video.duration);
        const ms = Number.isFinite(seconds) && seconds > 1 ? seconds * 1000 + 5000 : 90000;
        capTimer = setTimeout(() => finish('auto'), Math.min(Math.max(ms, 10000), 90000));
      };
      video.addEventListener('loadedmetadata', armCap);
      video.addEventListener('durationchange', armCap);
      armCap();
      video.addEventListener('ended', () => finish('auto'));
      video.addEventListener('error', () => finish('user'));
      wrap.addEventListener('click', onClick);
      window.addEventListener('keydown', onKey);
      const started = video.play?.();
      if (started !== undefined && typeof started.catch === 'function') started.catch(finish);

      // ---- 声音 ----
      // DSH 桌面端是 Electron，默认 autoplay-policy 为 no-user-gesture-required，
      // 带声自动播放通常是允许的；普通浏览器里则会被拦。
      // 所以顺序反过来：先试带声，被拒再退回「静音播放 + 黑冠按钮」——
      // 失败时的表现和旧版完全一致，属于只赚不亏的改法。
      if (opening.sound === true) {
        const showSoundButton = () => {
          if (done || wrap.querySelector('.tre-opening-sound') !== null) return;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'tre-opening-sound';
          button.title = '开启声音';
          button.setAttribute('aria-label', '开启声音');
          // 用我们的黑冠当图标：形状就是 CROWN.d，颜色由 CSS 给
          button.innerHTML =
            `<svg viewBox="${CROWN.viewBox}" width="20" height="17" fill="currentColor" ` +
            `fill-rule="evenodd" aria-hidden="true"><path d="${CROWN.d}"/></svg>`;
          button.addEventListener('click', (event) => {
            // 别让点击冒泡成"跳过开屏"
            event.stopPropagation();
            video.muted = false;
            const resumed = video.play?.();
            if (resumed !== undefined && typeof resumed.catch === 'function') resumed.catch(() => {});
            button.remove();
          });
          wrap.appendChild(button);
        };

        const fallbackToMuted = () => {
          video.muted = true;
          void video.play?.()?.catch?.(() => {});
          showSoundButton();
        };

        // 先带声试一次
        video.muted = false;
        const audible = video.play?.();
        if (audible !== undefined && typeof audible.catch === 'function') {
          audible.catch(fallbackToMuted);
        }
        // 有的实现会先 resolve 再暂停 / 静音：600ms 后复查一次
        setTimeout(() => {
          if (done) return;
          if (video.muted === false && video.paused) {
            fallbackToMuted();
            return;
          }
          // 在播但没声（被静音了）：给按钮，让人能点开
          if (video.muted === true && !video.paused && !video.ended) showSoundButton();
        }, 600);
      }
    }

    async function load(options) {
      const result = await api(`${ROUTE}/state`);
      if (result?.ok) {
        project(result.value);
        // 开屏只在这里触发：保存设定与 409 重取都不该重播
        if (options?.silent !== true) playOpening(result.value.opening);
      }
      return result;
    }

    /** 写回：必须带 rev；版本对不上时宿主会把最新快照交回来。 */
    /**
     * 组装一次完整快照。
     *
     * 立绘的"已选文件"只有一个来源：`sidebarFigure.current`。
     * 旧版另外维护了一个 `figure.current`，回读时永远拿到空值，
     * 于是"选完自定义立绘、再改花瓣"会把它写回随包那张。
     */
    function snapshotPayload(current, patch) {
      return {
        rev: current.rev,
        enabled: patch.enabled ?? current.enabled,
        background: {
          ...current.background,
          ...(patch.background ?? {}),
          // dim / focus 必须深合并，否则缺的那半会落回默认
          dim: { ...current.background.dim, ...(patch.background?.dim ?? {}) },
          focus: { ...current.background.focus, ...(patch.background?.focus ?? {}) },
        },
        decoration: { ...current.decoration, ...(patch.decoration ?? {}) },
        opening: { ...current.opening, ...(patch.opening ?? {}) },
        hero: { ...current.hero, ...(patch.hero ?? {}) },
        figure: { current: current.sidebarFigure?.current ?? '' },
      }
    }

    function setSave(state, text) {
      store.set({ ...store.value, save: { state, text } })
    }

    /**
     * 保存队列：同一时刻只有一个请求在飞。
     *
     * 并发写同一个 .tmp 会互相踩，而且后返回的旧快照会把新状态盖回去；
     * 409 表示 rev 过期 —— 先重取快照，再用新 rev 重放这一次的 patch。
     */
    let saveChain = Promise.resolve()

    function save(patch) {
      const task = saveChain.catch(() => undefined).then(async () => {
        setSave('busy', '保存中…')
        let attempt = 0
        let pending = patch
        while (attempt < 2) {
          attempt += 1
          const current = store.value
          const result = await api(`${ROUTE}/state`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(snapshotPayload(current, pending)),
          })
          if (result?.value) project(result.value)
          if (result?.ok) {
            setSave('saved', '已保存')
            return result
          }
          const code = result?.error?.code
          if (code === 'stale' && attempt === 1) {
            // rev 过期：拿最新快照，再重放一次同样的修改（只重放一次）
            await load({ silent: true })
            continue
          }
          if (code === 'persist-failed') {
            setSave('error', '未保存：写不进设定文件，重启后会丢失')
            return result
          }
          setSave('error', `未保存：${code ?? '网络异常'}`)
          return result
        }
        return undefined
      })
      saveChain = task.catch(() => undefined)
      return task
    }

    // 滑杆用「合并 + 抖动抑制」：拖动过程只在停手后落一次盘。
    let pendingPatch = null;
    let pendingTimer = null;

    function mergePending(patch) {
      if (pendingPatch === null) {
        pendingPatch = { ...patch };
        return;
      }
      pendingPatch = {
        ...pendingPatch,
        ...patch,
        background: { ...(pendingPatch.background ?? {}), ...(patch.background ?? {}) },
        decoration: { ...(pendingPatch.decoration ?? {}), ...(patch.decoration ?? {}) },
      };
    }

    function saveSoon(patch) {
      mergePending(patch);
      if (pendingTimer !== null) clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        const merged = pendingPatch;
        pendingPatch = null;
        if (merged !== null) void save(merged);
      }, 220);
    }

    /** 读成 data URL：上传走这条路，Host 只认 data URL。 */
    function toDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('read-failed'));
        reader.readAsDataURL(file);
      });
    }

    /**
     * 上传前先规整：大图缩到 2560 宽并转 WebP。
     * 用户随手拍/截的图动辄十几 MB，直接传会撞上 Host 的体积上限。
     */
    async function normalizeImage(file) {
      try {
        if (typeof createImageBitmap !== 'function') return file;
        const bitmap = await createImageBitmap(file);
        const max = 2560;
        const scale = Math.min(1, max / bitmap.width);
        const small = scale === 1 && file.size <= 3 * 1024 * 1024;
        if (small && (file.type === 'image/webp' || file.type === 'image/avif')) {
          bitmap.close?.();
          return file;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        if (context === null) return file;
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
        if (blob === null) return file;
        const name = `${file.name.replace(/\.[^.]+$/, '') || 'upload'}.webp`;
        return new File([blob], name, { type: 'image/webp' });
      } catch {
        // 规整失败就原样上传，交给 Host 的白名单与体积上限把关
        return file;
      }
    }

    /** 把 Host 的错误码翻成人话。 */
    function uploadErrorText(result) {
      const code = result?.error?.code;
      if (code === 'unsupported-type') return '不支持的图片格式（只收 webp / png / jpeg / avif / gif）';
      if (code === 'too-large') return '图片太大，上限 12 MB';
      if (code === 'bad-image') return '图片数据无法解析';
      if (code === 'not-custom') return '只能删除自己上传的图';
      if (code === undefined) return '服务器没有响应这条路由——插件可能还没重启（Host 半需要完全退出 DSH 再打开）';
      return code;
    }

    function setUpload(state, text) {
      store.set({ ...store.value, upload: { state, text } });
    }

    /** 传一张图上去：先规整，再上传，最后把结果说清楚。 */
    async function uploadBackground(file) {
      setUpload('busy', `正在处理 ${file.name}…`);
      try {
        const prepared = await normalizeImage(file);
        const dataUrl = await toDataUrl(prepared);
        const result = await api(`${ROUTE}/backgrounds/upload`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: prepared.name, dataUrl }),
        });
        if (result?.ok) {
          project(result.value);
          setUpload('ok', `已上传并启用：${result.value.background.current}`);
          return result;
        }
        setUpload('error', `上传失败：${uploadErrorText(result)}`);
        return result;
      } catch (error) {
        setUpload('error', `上传失败：${error instanceof Error ? error.message : error}`);
        return null;
      }
    }

    /** 删一张自传的图。 */
    async function removeBackground(name) {
      const result = await api(`${ROUTE}/backgrounds/remove`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (result?.value) project(result.value);
      return result;
    }

    // ------------------------------------------------------- 侧栏立绘（自传）
    let figureStatus = { state: 'idle', text: '' };

    function setFigureStatus(state, text) {
      figureStatus = { state, text };
      store.set({ ...store.value });
    }

    /** 传一张侧栏立绘：和背景图同一套规整流程，落到 Background-custom/sidebar-figure.*。 */
    async function uploadFigure(file) {
      setFigureStatus('busy', '正在处理…');
      try {
        const prepared = await normalizeImage(file);
        const dataUrl = await toDataUrl(prepared);
        const result = await api(`${ROUTE}/sidebar-figure/upload`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: prepared.name, dataUrl }),
        });
        if (result?.ok) {
          project(result.value);
          setFigureStatus('ok', '已换成你上传的立绘');
          return result;
        }
        setFigureStatus('error', `上传失败：${uploadErrorText(result)}`);
        return result;
      } catch (error) {
        setFigureStatus('error', `上传失败：${error instanceof Error ? error.message : error}`);
        return null;
      }
    }

    /** 删掉库里的一张立绘；删的是当前那张就回落到随包。 */
    async function removeFigure(name) {
      setFigureStatus('busy', '正在删除…');
      const result = await api(`${ROUTE}/sidebar-figure/remove`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (result?.ok) {
        project(result.value);
        setFigureStatus('ok', `已删除 ${name}`);
      } else {
        setFigureStatus('error', `删除失败：${uploadErrorText(result)}`);
      }
      return result;
    }

    // ------------------------------------------------------------- components
    function crown(width) {
      const parts = String(CROWN.viewBox).trim().split(/\s+/).map(Number);
      const ratio = parts[3] > 0 && parts[2] > 0 ? parts[3] / parts[2] : 0.74;
      return h(
        'svg',
        {
          viewBox: CROWN.viewBox,
          width,
          height: Math.round(width * ratio * 100) / 100,
          fill: 'currentColor',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('path', { d: CROWN.d, 'fill-rule': 'evenodd' }),
      );
    }

    function BrandMark(props) {
      const size = typeof props.size === 'number' && props.size > 0 ? props.size : 26;
      return h('span', { className: 'tre-mark' }, crown(size));
    }

    /** 一朵五瓣花：五个旋转的椭圆 + 金色花心。全部走 currentColor，明暗都不失衡。 */
    function blossom(x, y, r, key) {
      return h(
        'g',
        { key, transform: `translate(${x} ${y})`, fill: 'currentColor' },
        [
          ...[0, 72, 144, 216, 288].map((angle) =>
            h('ellipse', {
              key: angle,
              cx: 0,
              cy: -r * 0.62,
              rx: r * 0.34,
              ry: r * 0.6,
              transform: `rotate(${angle})`,
              opacity: '0.92',
            }),
          ),
          h('circle', { key: 'core', cx: 0, cy: 0, r: r * 0.2, opacity: '0.75' }),
        ],
      );
    }

    /** 欢迎页徽记：单只黑冠。 */
    function HeroCrown() {
      return h('span', { className: 'tre-hero' }, h('span', { key: 'crown', className: 'tre-hero-crown' }, crown(54)));
    }

    /** 一行落款：用一张隐形 img 撑出尺寸，两层蒙版叠在上面（墨 + 金）。 */
    function Signature({ ink, gold, width, label }) {
      return h('span', { className: 'tre-sig', style: { width: `${width}px` }, role: 'img', 'aria-label': label }, [
        h('img', { key: 'size', className: 'tre-sig-size', src: ink, alt: '' }),
        h('span', {
          key: 'ink',
          className: 'tre-sig-layer',
          style: { WebkitMaskImage: `url("${ink}")`, maskImage: `url("${ink}")` },
        }),
        h('span', {
          key: 'gold',
          className: 'tre-sig-layer tre-sig-layer--gold',
          style: { WebkitMaskImage: `url("${gold}")`, maskImage: `url("${gold}")` },
        }),
      ]);
    }

    /** 订阅模块级 store。设置页与装饰层共用。 */
    function useStoreValue() {
      const [value, setValue] = React.useState(store.value);
      React.useEffect(() => store.subscribe(() => setValue({ ...store.value })), []);
      return value;
    }

    /** 四角金线的一段：外圈 1px + 内圈 0.5px + 角上菱形。 */
    function frameCorner() {
      return h('svg', { viewBox: '0 0 40 40', fill: 'none', 'aria-hidden': 'true' }, [
        h('path', {
          key: 'outer',
          d: 'M0.5 40V9a8.5 8.5 0 0 1 8.5-8.5H40',
          stroke: 'currentColor',
          'stroke-width': '1',
        }),
        h('path', {
          key: 'inner',
          d: 'M6 40V12a6 6 0 0 1 6-6H40',
          stroke: 'currentColor',
          'stroke-width': '0.5',
          opacity: '0.6',
        }),
        h('path', { key: 'pin', d: 'M9 5.6l3.4 3.4L9 12.4 5.6 9z', fill: 'currentColor', opacity: '0.9' }),
      ]);
    }

    /** 落款印章 + 四角金线 + 侧栏立绘。纯装饰：`pointer-events:none`，窄窗自动收起。 */
    function Ornament() {
      const value = useStoreValue();
      const available = value.signature?.available === true;
      const sealUrl = (name) => `${ROUTE}/signature/${name}`;

      return h('div', { className: 'tre-ornament', 'aria-hidden': 'true' }, [
        h('div', { key: 'side', className: 'tre-side-figure' }),
        h('div', { key: 'shade', className: 'tre-side-shade' }),
        h('div', { key: 'frame', className: 'tre-frame' }, [0, 1, 2, 3].map((i) => frameCorner())),
        h('div', { key: 'seal', className: 'tre-seal' }, [
          // 黑冠压在「特蕾西娅」上面，像给签名戴了顶冠
          h('span', { key: 'mark', className: 'tre-seal-mark' }, crown(34)),
          available
            ? h(Signature, {
                key: 'cn',
                ink: sealUrl('signature-cn-ink.png'),
                gold: sealUrl('signature-cn-gold.png'),
                width: 126,
                label: '特蕾西娅',
              })
            : h('span', { key: 'cn-text', className: 'tre-seal-text' }, '特蕾西娅'),
          value.decoration.sealLatin && available
            ? h('span', { key: 'rule', className: 'tre-seal-rule' })
            : null,
          value.decoration.sealLatin && available
            ? h(Signature, {
                key: 'en',
                ink: sealUrl('signature-en-ink.png'),
                gold: sealUrl('signature-en-gold.png'),
                width: 96,
                label: 'Theresa',
              })
            : null,
        ]),
      ]);
    }

    function Toggle({ checked, label, onChange }) {
      return h('button', {
        type: 'button',
        className: 'tre-switch',
        role: 'switch',
        'aria-checked': checked ? 'true' : 'false',
        'aria-label': label,
        onClick: () => onChange(!checked),
      });
    }

    function Row({ title, hint, control }) {
      return h('div', { className: 'tre-row' }, [
        h('div', { key: 'text', className: 'tre-col' }, [
          h('span', { key: 't', className: 'tre-label' }, title),
          hint ? h('span', { key: 'h', className: 'tre-hint' }, hint) : null,
        ]),
        control,
      ]);
    }

    function Slider({ value, min, max, step, label, onInput, onCommit }) {
      return h('input', {
        className: 'tre-slider',
        type: 'range',
        min,
        max,
        step,
        value,
        'aria-label': label,
        onChange: (event) => onInput(Number(event.target.value)),
        onMouseUp: (event) => onCommit(Number(event.target.value)),
        onKeyUp: (event) => onCommit(Number(event.target.value)),
        onTouchEnd: (event) => onCommit(Number(event.target.value)),
      });
    }

    function SettingsSection() {
      const [value, setValue] = React.useState(store.value);
      React.useEffect(() => store.subscribe(() => setValue({ ...store.value })), []);

      const commit = (patch) => void save(patch);
      const local = (patch) => {
        store.set({ ...store.value, ...patch });
        applyToDom(store.value);
        setValue({ ...store.value });
      };

      const backgrounds = (value.backgrounds ?? []).filter(
        // 固定部件（开屏、落款、侧栏立绘）不列为可选背景。Host 侧也过滤了一次，
        // 这里再挡一次：改完 Host 不重启也能立刻从列表里消失。
        (item) => !/^(opening|signature-|sidebar-)/.test(item.name),
      );
      const decoration = value.decoration;
      // 旧 Host（重启前）不会回传构图字段：全部给兜底，否则设置页会整页崩
      const compose = {
        fit: value.background?.fit === 'contain' ? 'contain' : 'cover',
        focus: value.background?.focus ?? { x: 50, y: 50 },
        zoom: value.background?.zoom ?? 1,
        substrate: value.background?.substrate ?? 0.5,
      };

      return h('div', { className: 'tre-page' }, [
        h('div', { key: 'enabled', className: 'tre-card' }, [
          h(Row, {
            key: 'row',
            title: '启用特蕾西娅主题',
            hint: '关掉即恢复宿主原样：色板、背景、花瓣、徽记一起撤掉。',
            control: h(Toggle, {
              checked: value.enabled,
              label: '启用特蕾西娅主题',
              onChange: (next) => commit({ enabled: next }),
            }),
          }),
        ]),
        h('div', { key: 'bg', className: 'tre-card' }, [
          h('span', { key: 'title', className: 'tre-card-title' }, '背景图'),
          backgrounds.length === 0
            ? h('span', { key: 'empty', className: 'tre-hint' }, '没有可用背景：上传一张，或把图片放进插件目录的 Background/ 后重载。')
            : h(
                'div',
                { key: 'grid', className: 'tre-grid' },
                backgrounds.map((item) =>
                  h(
                    'div',
                    { key: item.name, className: 'tre-thumb', 'data-selected': item.name === value.background.current ? '1' : '0' },
                    [
                      h(
                        'button',
                        {
                          key: 'pick',
                          type: 'button',
                          className: 'tre-thumb-pick',
                          'aria-label': `使用背景 ${item.name}`,
                          onClick: () => commit({ background: { current: item.name } }),
                        },
                        h('img', { src: item.url, alt: item.name, loading: 'lazy' }),
                      ),
                      h('span', { key: 'name', className: 'tre-thumb-name' }, item.name),
                      item.origin === 'custom'
                        ? h(
                            'button',
                            {
                              key: 'del',
                              type: 'button',
                              className: 'tre-thumb-del',
                              'aria-label': `删除 ${item.name}`,
                              onClick: () => void removeBackground(item.name),
                            },
                            '×',
                          )
                        : null,
                    ],
                  ),
                ),
              ),
          h('div', { key: 'upload', className: 'tre-actions' }, [
            h('label', { key: 'label', className: 'tre-btn' }, [
              '上传背景图',
              h('input', {
                key: 'input',
                type: 'file',
                accept: 'image/webp,image/png,image/jpeg,image/avif,image/gif',
                style: { display: 'none' },
                onChange: (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void uploadBackground(file);
                },
              }),
            ]),
            h('span', { key: 'hint', className: 'tre-hint' }, '单张 ≤ 12 MB；大图会自动缩到 2560 宽并转 WebP。上传的图存在 Background-custom/，只有这些能在这里删掉。'),
            value.upload.text === ''
              ? null
              : h(
                  'span',
                  { key: 'status', className: 'tre-status', 'data-state': value.upload.state },
                  value.upload.text,
                ),
          ]),
          h(Row, {
            key: 'dim',
            title: '色纱浓度',
            hint: '越大越淡。文字画在色纱之上，不受浓度影响；白昼与长夜各一档。',
            control: h(
              'span',
              { className: 'tre-value' },
              `白昼 ${Math.round(value.background.dim.light * 100)}% · 长夜 ${Math.round(value.background.dim.dark * 100)}%`,
            ),
          }),
          h(Slider, {
            key: 'dim-light',
            value: value.background.dim.light,
            min: 0,
            max: 0.85,
            step: 0.05,
            label: '白昼色纱浓度',
            onInput: (next) =>
              local({ background: { ...store.value.background, dim: { ...store.value.background.dim, light: next } } }),
            onCommit: (next) => saveSoon({ background: { dim: { light: next } } }),
          }),
          h(Slider, {
            key: 'dim-dark',
            value: value.background.dim.dark,
            min: 0,
            max: 0.85,
            step: 0.05,
            label: '长夜色纱浓度',
            onInput: (next) =>
              local({ background: { ...store.value.background, dim: { ...store.value.background.dim, dark: next } } }),
            onCommit: (next) => saveSoon({ background: { dim: { dark: next } } }),
          }),
          h('div', { key: 'compose-title', className: 'tre-card-title' }, '构图'),
          h(Row, {
            key: 'fit',
            title: '铺满 / 完整',
            hint: '铺满不留边但会裁切；完整能看全人物，空出来的地方用底色填。',
            control: h(
              'span',
              { className: 'tre-actions' },
              h(
                'button',
                {
                  key: 'fit',
                  type: 'button',
                  className: 'tre-btn',
                  onClick: () =>
                    commit({ background: { fit: compose.fit === 'contain' ? 'cover' : 'contain' } }),
                  'aria-label': '切换背景适配方式',
                },
                compose.fit === 'contain' ? '完整' : '铺满',
              ),
            ),
          }),
          h(Slider, {
            key: 'zoom',
            value: Math.round(compose.zoom * 100),
            min: 100,
            max: 180,
            step: 5,
            label: '背景缩放',
            onInput: (percent) =>
              local({ background: { ...store.value.background, zoom: percent / 100 } }),
            onCommit: (percent) => saveSoon({ background: { zoom: percent / 100 } }),
          }),
          h(Slider, {
            key: 'focus-x',
            value: compose.focus.x,
            min: 0,
            max: 100,
            step: 1,
            label: '水平焦点',
            onInput: (next) =>
              local({ background: { ...store.value.background, focus: { ...compose.focus, x: next } } }),
            onCommit: (next) => saveSoon({ background: { focus: { x: next } } }),
          }),
          h(Slider, {
            key: 'focus-y',
            value: compose.focus.y,
            min: 0,
            max: 100,
            step: 1,
            label: '垂直焦点',
            onInput: (next) =>
              local({ background: { ...store.value.background, focus: { ...compose.focus, y: next } } }),
            onCommit: (next) => saveSoon({ background: { focus: { y: next } } }),
          }),
          h(Row, {
            key: 'substrate',
            title: '阅读衬底',
            hint: '正文那一侧压多少：越大字越稳，画也退得越远。',
            control: h(
              'span',
              { className: 'tre-value' },
              `${Math.round(compose.substrate * 100)}%`,
            ),
          }),
          h(Slider, {
            key: 'substrate',
            value: Math.round(compose.substrate * 100),
            min: 0,
            max: 100,
            step: 5,
            label: '阅读衬底强度',
            onInput: (percent) =>
              local({ background: { ...store.value.background, substrate: percent / 100 } }),
            onCommit: (percent) => saveSoon({ background: { substrate: percent / 100 } }),
          }),
        ]),
        h('div', { key: 'deco', className: 'tre-card' }, [
          h('span', { key: 'title', className: 'tre-card-title' }, '装饰'),
          h(Row, {
            key: 'petals',
            title: '飘落花瓣',
            hint: '在背景层里飘，不会盖住正文。',
            control: h(Toggle, {
              checked: decoration.petals,
              label: '飘落花瓣',
              onChange: (next) => commit({ decoration: { petals: next } }),
            }),
          }),
          h(Slider, {
            key: 'count',
            value: decoration.petalCount,
            min: 0,
            max: 14,
            step: 1,
            label: '花瓣数量',
            onInput: (petalCount) => local({ decoration: { ...store.value.decoration, petalCount } }),
            onCommit: (petalCount) => saveSoon({ decoration: { petalCount } }),
          }),
          h(Row, {
            key: 'crown',
            title: '侧栏黑冠',
            hint: '遮蔽宿主原本的品牌标记（priority -1）。',
            control: h(Toggle, {
              checked: decoration.crownMark,
              label: '侧栏黑冠',
              onChange: (next) => commit({ decoration: { crownMark: next } }),
            }),
          }),
          h(Row, {
            key: 'hero',
            title: '欢迎页黑冠',
            hint: '空白会话标题上方的徽记。',
            control: h(Toggle, {
              checked: decoration.heroCrown,
              label: '欢迎页黑冠',
              onChange: (next) => commit({ decoration: { heroCrown: next } }),
            }),
          }),
          h(Row, {
            key: 'seal',
            title: '右下角落款',
            hint: '竖排「特蕾西娅」+ 细金线边框，窄于 900px 自动收起。',
            control: h(Toggle, {
              checked: decoration.seal,
              label: '右下角落款',
              onChange: (next) => commit({ decoration: { seal: next } }),
            }),
          }),
          h(Row, {
            key: 'sealLatin',
            title: '英文签名',
            hint: '中文签名下面再加一行 Theresa；关掉则只留中文。',
            control: h(Toggle, {
              checked: decoration.sealLatin,
              label: '英文签名',
              onChange: (next) => commit({ decoration: { sealLatin: next } }),
            }),
          }),
          h(Row, {
            key: 'figure',
            title: '侧栏立绘',
            hint: '在侧栏那片空白里立一张图（底部对齐）；收成窄条时自动隐藏。下面可以挑图或上传自己的。',
            control: h(Toggle, {
              checked: decoration.figure,
              label: '侧栏立绘',
              onChange: (next) => commit({ decoration: { figure: next } }),
            }),
          }),
          h(Slider, {
            key: 'figure-scale',
            value: Math.round((decoration.figureScale ?? 1) * 100),
            min: 60,
            max: 130,
            step: 5,
            label: '立绘大小',
            onInput: (percent) => local({ decoration: { ...store.value.decoration, figureScale: percent / 100 } }),
            onCommit: (percent) => saveSoon({ decoration: { figureScale: percent / 100 } }),
          }),
          h(Slider, {
            key: 'figure-opacity',
            value: Math.round((decoration.figureOpacity ?? 0.62) * 100),
            min: 30,
            max: 100,
            step: 2,
            label: '立绘不透明度',
            onInput: (percent) => local({ decoration: { ...store.value.decoration, figureOpacity: percent / 100 } }),
            onCommit: (percent) => saveSoon({ decoration: { figureOpacity: percent / 100 } }),
          }),
          h(Slider, {
            key: 'figure-inset',
            value: decoration.figureInset ?? 0,
            min: 0,
            max: 120,
            step: 4,
            label: '立绘下移',
            onInput: (pixels) => local({ decoration: { ...store.value.decoration, figureInset: pixels } }),
            onCommit: (pixels) => saveSoon({ decoration: { figureInset: pixels } }),
          }),
          h('div', { key: 'figure-grid', className: 'tre-grid tre-grid--figure' },
            (value.sidebarFigure?.options ?? []).map((item) =>
              h(
                'div',
                {
                  key: item.name,
                  className: 'tre-thumb',
                  'data-selected': (item.origin === 'package' ? '' : item.name) === (value.sidebarFigure?.current ?? '') ? '1' : '0',
                },
                [
                  h(
                    'button',
                    {
                      key: 'pick',
                      type: 'button',
                      className: 'tre-thumb-pick',
                      'aria-label': `使用立绘 ${item.name}`,
                      // 随包那张用空字符串表示
                      onClick: () => commit({ figure: { current: item.origin === 'package' ? '' : item.name } }),
                    },
                    h('img', { src: item.url, alt: item.name, loading: 'lazy' }),
                  ),
                  h('span', { key: 'name', className: 'tre-thumb-name' }, item.origin === 'package' ? '随包立绘' : item.name),
                  item.origin === 'custom'
                    ? h(
                        'button',
                        {
                          key: 'del',
                          type: 'button',
                          className: 'tre-thumb-del',
                          'aria-label': `删除立绘 ${item.name}`,
                          onClick: () => void removeFigure(item.name),
                        },
                        '×',
                      )
                    : null,
                ],
              ),
            ),
          ),
          h('div', { key: 'figure-actions', className: 'tre-actions' }, [
            h('label', { key: 'pick', className: 'tre-btn' }, [
              '上传立绘',
              h('input', {
                key: 'input',
                type: 'file',
                accept: 'image/png,image/jpeg,image/webp,image/avif,image/gif',
                className: 'tre-file-hidden',
                onChange: (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file !== undefined) void uploadFigure(file);
                },
              }),
            ]),
            figureStatus.state === 'idle'
              ? null
              : h('span', {
                  key: 'note',
                  className: 'tre-status',
                  'data-state': figureStatus.state,
                  role: 'status',
                }, figureStatus.text),
          ]),
          h(Row, {
            key: 'frame',
            title: '四角金线',
            hint: '像装裱的画框，让界面读起来是一幅画。',
            control: h(Toggle, {
              checked: decoration.frame,
              label: '四角金线',
              onChange: (next) => commit({ decoration: { frame: next } }),
            }),
          }),
        ]),
        h('div', { key: 'look', className: 'tre-card' }, [
          h('span', { key: 'title', className: 'tre-card-title' }, '外观'),
          h(Row, {
            key: 'glass',
            title: '玻璃强度',
            hint: '清淡更透、厚重更稳。只影响面板背景，不影响正文清晰度。',
            control: h(
              'span',
              { className: 'tre-actions' },
              ['清淡', '标准', '厚重'].map((text, index) =>
                h(
                  'button',
                  {
                    key: text,
                    type: 'button',
                    className: 'tre-btn',
                    'data-on': (decoration.glass ?? 1) === index ? '1' : '0',
                    'aria-pressed': (decoration.glass ?? 1) === index,
                    onClick: () => commit({ decoration: { glass: index } }),
                  },
                  text,
                ),
              ),
            ),
          }),
          h(Row, {
            key: 'clarity',
            title: '画面通透度',
            hint: '大面铺底的白纱浓度：100 几乎不蒙纱（最接近原画），0 偏实。与「色纱浓度」互不叠加。',
            control: h(
              'span',
              { className: 'tre-value' },
              `${Math.round(value.decoration.clarity ?? 55)}%`,
            ),
          }),
          h(Slider, {
            key: 'clarity',
            value: Math.round(value.decoration.clarity ?? 55),
            min: 0,
            max: 100,
            step: 5,
            label: '画面通透度',
            onInput: (next) => local({ decoration: { ...store.value.decoration, clarity: next } }),
            onCommit: (next) => saveSoon({ decoration: { clarity: next } }),
          }),
          h('div', { key: 'presets', className: 'tre-actions' }, [
            h(
              'button',
              {
                key: 'raw',
                type: 'button',
                className: 'tre-btn',
                onClick: () =>
                  commit({
                    background: { dim: { light: 0, dark: 0 }, substrate: 0 },
                    decoration: { glass: 0, clarity: 100 },
                  }),
              },
              '原画',
            ),
            h(
              'button',
              {
                key: 'balance',
                type: 'button',
                className: 'tre-btn',
                onClick: () =>
                  commit({
                    background: { dim: { light: 0.12, dark: 0.18 }, substrate: 0.25 },
                    decoration: { glass: 1, clarity: 55 },
                  }),
              },
              '平衡',
            ),
            h(
              'button',
              {
                key: 'deep',
                type: 'button',
                className: 'tre-btn',
                onClick: () =>
                  commit({
                    background: { dim: { light: 0.3, dark: 0.34 }, substrate: 0.55 },
                    decoration: { glass: 2, clarity: 25 },
                  }),
              },
              '沉浸',
            ),
            h('span', { key: 'hint', className: 'tre-hint' }, '三个预设会同时调色纱、衬底、玻璃与通透度。'),
          ]),
          h('div', { key: 'probe', className: 'tre-actions' }, [
            h(
              'button',
              {
                key: 'btn',
                type: 'button',
                className: 'tre-btn',
                onClick: () => {
                  const rows = syncOverlayClear();
                  store.set({
                    ...store.value,
                    probe: describeProbe(rows).length === 0
                      ? ['没有找到会话主列（可能还在加载），先刷新一次再点。']
                      : describeProbe(rows),
                  });
                  setValue({ ...store.value });
                },
              },
              '检查遮挡层',
            ),
            h('span', { key: 'hint', className: 'tre-hint' },
              '插件会自动把主列祖先链上的不透明底色与 backdrop-filter 清掉；点这里可以看到清掉了什么。'),
          ]),
          (value.probe ?? []).length === 0
            ? null
            : h(
                'div',
                { key: 'probe-list', className: 'tre-probe' },
                (value.probe ?? []).map((line, index) =>
                  h('code', { key: String(index), className: 'tre-probe-line' }, line),
                ),
              ),
        ]),
        h('div', { key: 'hero', className: 'tre-card' }, [
          h('span', { key: 'title', className: 'tre-card-title' }, '欢迎页'),
          h(Row, {
            key: 'replace',
            title: '替换那句话',
            hint: '宿主原句是「探索未至之境」。这里只换文字，字号字重仍用宿主的（26px / 500）。',
            control: h(Toggle, {
              checked: value.hero.replace,
              label: '替换欢迎页文案',
              onChange: (next) => commit({ hero: { replace: next } }),
            }),
          }),
          h('input', {
            key: 'headline',
            className: 'tre-input',
            type: 'text',
            maxLength: 40,
            value: value.hero.headline,
            'aria-label': '欢迎页文案',
            placeholder: '去找到你自己吧……',
            onChange: (event) => {
              const headline = event.target.value;
              store.set({ ...store.value, hero: { ...store.value.hero, headline } });
              applyToDom(store.value);
              setValue({ ...store.value });
            },
            onBlur: (event) => commit({ hero: { headline: event.target.value } }),
            onKeyDown: (event) => {
              if (event.key === 'Enter') event.target.blur();
            },
          }),
          h('div', { key: 'reset-headline', className: 'tre-actions' }, [
            h(
              'button',
              {
                key: 'btn',
                type: 'button',
                className: 'tre-btn',
                onClick: () => {
                  // 文案曾经被按 GBK 读过一次，存进了乱码：给一个一键还原
                  store.set({ ...store.value, hero: { ...store.value.hero, headline: DEFAULT_HEADLINE } });
                  applyToDom(store.value);
                  setValue({ ...store.value });
                  commit({ hero: { headline: DEFAULT_HEADLINE } });
                },
              },
              '重置文案',
            ),
            h('span', { key: 'hint', className: 'tre-hint' }, `默认：${DEFAULT_HEADLINE}`),
          ]),
        ]),
        h('div', { key: 'opening', className: 'tre-card' }, [
          h('span', { key: 'title', className: 'tre-card-title' }, '开屏动画'),
          value.opening.hasOpening
            ? h(Row, {
                key: 'enabled',
                title: '启动时播放',
                hint: '点击画面或按 Esc / 空格 / 回车都能立刻跳过；系统开了「减少动态效果」时整段不播。',
                control: h(Toggle, {
                  checked: value.opening.enabled,
                  label: '启动时播放开屏动画',
                  onChange: (next) => commit({ opening: { enabled: next } }),
                }),
              })
            : h(
                'span',
                { key: 'missing', className: 'tre-hint' },
                '没有找到开屏视频：把 opening.mp4 放进插件目录的 Background/（可选配 opening-poster.webp 作首帧）。',
              ),
          h(Row, {
            key: 'sound',
            title: '开屏音乐',
            hint: '默认静音。打开后每次启动会尝试带声播放；浏览器若拦截，画面右下角会出现「开启声音」，点一下即可。',
            control: h(Toggle, {
              checked: value.opening.sound,
              label: '开屏音乐',
              onChange: (next) => commit({ opening: { sound: next } }),
            }),
          }),
          h(Row, {
            key: 'once',
            title: '每个会话只播一次',
            hint: '关掉则每次刷新页面都播。',
            control: h(Toggle, {
              checked: value.opening.oncePerSession,
              label: '每个会话只播一次',
              onChange: (next) => commit({ opening: { oncePerSession: next } }),
            }),
          }),
          h('div', { key: 'actions', className: 'tre-actions' }, [
            h(
              'button',
              {
                key: 'replay',
                type: 'button',
                className: 'tre-btn',
                disabled: !value.opening.hasOpening,
                onClick: () => playOpening(store.value.opening, true),
              },
              '再看一次',
            ),
          ]),
        ]),
        h('div', { key: 'foot', className: 'tre-card' }, [
          h('div', { key: 'actions', className: 'tre-actions' }, [
            h(
              'button',
              {
                key: 'reset',
                type: 'button',
                className: 'tre-btn',
                onClick: () =>
                  commit({
                    background: {
                      dim: { light: 0.12, dark: 0.18 },
                      fit: 'cover',
                      focus: { x: 50, y: 50 },
                      zoom: 1,
                      substrate: 0.25,
                    },
                    decoration: {
                      petals: true,
                      petalCount: 8,
                      crownMark: true,
                      heroCrown: true,
                      seal: true,
                      sealLatin: true,
                      frame: true,
                      figure: true,
                      figureScale: 1,
                      glass: 1,
                      clarity: 55,
                      figureOpacity: 0.62,
                      figureInset: 0,
                    },
                    opening: { enabled: true, oncePerSession: true, sound: false },
                    hero: { replace: true, headline: DEFAULT_HEADLINE },
                  }),
              },
              '恢复默认',
            ),
            value.save?.state === 'idle' || value.save?.text === ''
              ? null
              : h(
                  'span',
                  { key: 'save', className: 'tre-status', 'data-state': value.save?.state, role: 'status' },
                  value.save.text,
                ),
          ]),
          h(
            'span',
            { key: 'notice', className: 'tre-hint' },
            '素材提示：背景图派生自官方美术 / 同人图，仅限本地个人使用，不可再分发。详见插件目录下的 ASSETS.md。',
          ),
        ]),
      ]);
    }

    // ------------------------------------------------------------------- body
    // `single` 槽位在同优先级已有占用者时会抛错；抛出去会被算到声明该槽的宿主入口头上，
    // 在 Desktop 上等于整个客户端入口激活失败（cyrene 的 issue #1）。所以每处都自己兜住。
    function safe(slot, register) {
      try {
        return register();
      } catch (error) {
        console.warn(`[theresa] ${slot} not registered: ${error instanceof Error ? error.message : error}`);
        return undefined;
      }
    }

    function apply(ctx) {
      // 1) 作用域样式表：插件停用即整层移除
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.dataset.theresa = '';
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, 'theresa: stylesheet');

      // 2) body 作用域 + 背景层，卸载时全部还原
      ctx.effect(() => {
        const body = document.body;
        if (!body) return () => {};
        ensureLayer();
        // 是否挂上 body 作用域由 applyToDom 按 enabled 决定
        applyToDom(store.value);
        return () => {
          for (const name of [BODY_ATTR, SKIN_ATTR, BG_ATTR, 'data-tre-crown', 'data-tre-hero', 'data-tre-seal', 'data-tre-frame', 'data-tre-headline', 'data-tre-figure', 'data-tre-side', 'data-tre-fit', 'data-tre-glass', 'data-tre-figure-edge']) {
            body.removeAttribute(name);
          }
          for (const name of ['--tre-dim-light', '--tre-dim-dark', '--tre-headline', '--tre-figure-url', '--tre-figure-scale', '--tre-focus-x', '--tre-focus-y', '--tre-bg-zoom', '--tre-read-strength', '--tre-figure-o', '--tre-figure-inset', '--tre-alpha-scale', '--tre-halo']) {
            body.style.removeProperty(name);
          }
          if (layer !== null) {
            layer.el.remove();
            layer = null;
          }
        };
      }, 'theresa: scope + background layer');

      // 3) 设定：一次拉取
      void load();

      // 4) 侧栏宽度实测：立绘宽度跟着侧栏走。
      //    已知局限：折叠时侧栏宽度会变成 0，这里选择「不更新」而不是隐藏——
      //    宁可折叠时保留上一次的宽度（立绘可能露一点），也不要展开后不回来。
      ctx.effect(() => {
        if (typeof ResizeObserver !== 'function') return () => {};
        let observer = null;
        let timer = null;
        let tries = 0;
        const attach = () => {
          const sidebar = document.querySelector('[data-slot="sidebar"]');
          if (sidebar === null) {
            if (tries++ < 20) timer = setTimeout(attach, 250);
            return;
          }
          const measure = () => {
            const width = Math.round(sidebar.getBoundingClientRect().width);
            if (width <= 0) return;
            document.body.style.setProperty('--tre-side-w', `${width}px`);
            document.body.setAttribute('data-tre-side', width < 150 ? 'narrow' : 'wide');
          };
          measure();
          observer = new ResizeObserver(measure);
          observer.observe(sidebar);
        };
        attach();
        return () => {
          if (timer !== null) clearTimeout(timer);
          observer?.disconnect();
          document.body.removeAttribute('data-tre-side');
          document.body.style.removeProperty('--tre-side-w');
        };
      }, 'theresa: sidebar figure measure');

      // 4.5) 遮挡层清理：主列祖先链上的浅色底 / backdrop-filter 一律清掉，卸载时还原。
      //      客户端挂载早于主列渲染，所以除了立刻跑一次，还要看 DOM 变化再补。
      ctx.effect(() => {
        let timer = null;
        const run = () => {
          timer = null;
          try {
            syncOverlayClear();
          } catch (error) {
            console.warn('[theresa] overlay clear failed', error);
          }
        };
        const schedule = () => {
          if (timer !== null) return;
          timer = setTimeout(run, 350);
        };
        run();
        let observer = null;
        if (typeof MutationObserver === 'function') {
          observer = new MutationObserver(schedule);
          observer.observe(document.body, { childList: true, subtree: true });
        }
        return () => {
          if (timer !== null) clearTimeout(timer);
          observer?.disconnect();
          if (overlayTick !== null) {
            clearTimeout(overlayTick);
            overlayTick = null;
          }
          restoreCleared();
        };
      }, 'theresa: overlay clear');

      // 5) 槽位
      ctx.slots.inject('settings.section', () =>
        safe('settings.section', () =>
          ctx.slots.register(
            { name: 'settings.section', id: 'theresa', order: 40, label: () => '特蕾西娅 · 主题' },
            SettingsSection,
          ),
        ),
      );

      ctx.slots.inject('shell.overlay', () =>
        safe('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: 'theresa-ornament', order: -90 }, Ornament),
        ),
      );

      // 两个徽记槽位是 priority -1 的"顶替"，注册着就看不见宿主的品牌标记。
      // 所以它们必须跟着总开关动态注销：关掉主题 = 把槽位让回宿主，
      // 否则会留下"品牌位置空一块"的观感。
      ctx.effect(() => {
        let disposers = [];
        let lastEnabled = null;
        const release = () => {
          for (const dispose of disposers) {
            try {
              dispose();
            } catch (error) {
              console.warn('[theresa] mark dispose failed', error);
            }
          }
          disposers = [];
        };
        const sync = () => {
          const enabled = store.value.enabled !== false;
          if (enabled === lastEnabled) return;
          lastEnabled = enabled;
          release();
          if (!enabled) return;
          disposers.push(
            ctx.slots.inject('sidebar.brand.mark', () =>
              safe('sidebar.brand.mark', () =>
                ctx.slots.register({ name: 'sidebar.brand.mark', priority: -1 }, BrandMark),
              ),
            ),
          );
          disposers.push(
            ctx.slots.inject('conversation.hero.brand.mark', () =>
              safe('conversation.hero.brand.mark', () =>
                ctx.slots.register({ name: 'conversation.hero.brand.mark', priority: -1 }, HeroCrown),
              ),
            ),
          );
        };
        const unsubscribe = store.subscribe(sync);
        sync();
        return () => {
          unsubscribe();
          release();
        };
      }, 'theresa: marks follow enabled');
    }

    return { inject: ['slots'], apply };
  },
});
