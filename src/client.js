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

    const ALIAS_LIGHT = [
      ['--dsw-alias-bg-base', 'transparent'],
      ['--dsw-alias-bg-layer-1', 'rgba(255,253,251,.72)'],
      ['--dsw-alias-bg-layer-2', 'rgba(245,239,232,.68)'],
      ['--dsw-alias-bg-layer-3', 'rgba(255,253,251,.64)'],
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
      ['--dsw-specific-sidebar-fill', 'rgba(247,242,237,.66)'],
      ['--dsw-specific-menu', 'rgba(254,251,247,.96)'],
      ['--dsw-specific-selector', 'rgba(254,251,247,.94)'],
      ['--dsw-specific-input-major', 'rgba(255,253,251,.86)'],
      ['--dsw-specific-tip', 'rgba(254,251,247,.94)'],
      ['--dsw-alias-markdown-code-block', 'rgba(245,240,234,.88)'],
      ['--dsw-alias-markdown-inline-code', 'rgba(242,236,229,.92)'],
      ['--dsw-alias-interactive-bg-hover', 'rgba(122,78,92,.09)'],
      ['--dsw-alias-scrollbar-bg-l1', '#E2D9D2'],
      ['--dsw-alias-tooltip-bg', '#241F26'],
      ['--dsw-alias-toast-bg', 'rgba(43,37,43,.96)'],
      ['--dsw-alias-settings-card-fill', 'rgba(255,253,251,.72)'],
    ];

    const ALIAS_DARK = [
      ['--dsw-alias-bg-base', 'transparent'],
      ['--dsw-alias-bg-layer-1', 'rgba(27,24,34,.70)'],
      ['--dsw-alias-bg-layer-2', 'rgba(34,30,42,.68)'],
      ['--dsw-alias-bg-layer-3', 'rgba(40,35,50,.64)'],
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
      ['--dsw-specific-sidebar-fill', 'rgba(23,20,30,.62)'],
      ['--dsw-specific-menu', 'rgba(38,33,48,.96)'],
      ['--dsw-specific-selector', 'rgba(38,33,48,.94)'],
      ['--dsw-specific-input-major', 'rgba(27,24,34,.86)'],
      ['--dsw-specific-tip', 'rgba(38,33,48,.94)'],
      ['--dsw-alias-markdown-code-block', 'rgba(29,25,38,.88)'],
      ['--dsw-alias-markdown-inline-code', 'rgba(36,31,46,.92)'],
      ['--dsw-alias-interactive-bg-hover', 'rgba(224,185,196,.10)'],
      ['--dsw-alias-scrollbar-bg-l1', '#352E3E'],
      ['--dsw-alias-tooltip-bg', '#342C40'],
      ['--dsw-alias-toast-bg', 'rgba(51,43,58,.96)'],
      ['--dsw-alias-settings-card-fill', 'rgba(27,24,34,.70)'],
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
/* 所有选择器都在 body[data-dsh-theresa] 之内：停用插件即整层消失。 */
body[data-dsh-theresa]{
  --tre-dim-light:.45; --tre-dim-dark:.45;
  --tre-bouquet:${BOUQUET};
  /* 装饰的比例尺：间距、不透明度、描边。所有装饰只从这里取值，不再各调各的。 */
  --tre-gap-1:8px;
  --tre-gap-2:14px;
  --tre-gap-3:22px;
  --tre-o-ghost:.28;
  --tre-o-quiet:.35;
  --tre-o-soft:.6;
  --tre-o-firm:.85;
  --tre-hair:1px;
  --tre-line:0.5px;
  --tre-radius-control:10px;
  --tre-radius-surface:16px;
  --tre-motion-fast:120ms;
  --tre-motion-normal:200ms;
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

/* ---- 背景层：body 的真实子元素，fixed + z-index:-1 ---- */
body[data-dsh-theresa] .tre-bg{
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
  position:absolute;inset:0;background-position:center center;background-size:cover;
  background-repeat:no-repeat;opacity:0;transition:opacity 900ms ease;
}
body[data-dsh-theresa] .tre-bg-img[data-active="1"]{opacity:1}
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
  position:fixed;left:0;bottom:0;z-index:0;pointer-events:none;
  width:var(--tre-side-w,260px);
  height:min(62vh,460px);
  background:var(--tre-figure-url) bottom center/contain no-repeat;
  transform:scale(var(--tre-figure-scale,1));transform-origin:bottom center;
  transition:opacity 300ms ease,transform 180ms ease;
  opacity:.6;
  -webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 16%,#000 100%);
  mask-image:linear-gradient(180deg,transparent 0%,#000 16%,#000 100%);
  filter:drop-shadow(0 6px 18px rgba(60,40,50,.10));
  transition:opacity 300ms ease;
}
body[data-dsh-theresa][data-ds-dark-theme] .tre-side-figure{
  opacity:.48;
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
  font-size:29px;font-weight:400;line-height:34px;letter-spacing:.02em;
  color:var(--dsw-alias-label-primary,#181319);
}

/* ---- 落款印章 + 四角金线：都在 shell.overlay 里，纯装饰、不吃指针 ---- */
body[data-dsh-theresa] .tre-ornament{position:fixed;inset:0;pointer-events:none;z-index:0}
body[data-dsh-theresa][data-tre-seal="off"] .tre-seal,
body[data-dsh-theresa][data-tre-frame="off"] .tre-frame{display:none}
/* 落款：左下角（避开右下角的小鲸鱼挂件），中文在上、英文在下，中间一条细金线。
   左边距跟着实测的侧栏宽度走，所以它落在正文列的左边缘，不压侧栏底部的按钮。
   两个签名都是「白 RGB + alpha」的蒙版：形状由文件给、颜色由主题给，
   于是浅色/深色共用同一份素材，金色装饰也不会被吃掉。 */
body[data-dsh-theresa] .tre-seal{
  position:absolute;left:calc(var(--tre-side-w,260px) + var(--tre-gap-3));bottom:var(--tre-gap-3);
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
  width:64%;height:1px;
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
  -webkit-backdrop-filter:blur(16px) saturate(160%);
  backdrop-filter:blur(16px) saturate(160%);
}

/* ---- 正文可读性：给字加一圈光晕，而不是把图调淡 ----
       只落在真正的文字块上；代码块自带底色，不受影响。 */
body[data-dsh-theresa][data-tre-bg="on"][data-theresa-skin="on"]{--dsw-specific-bubble:rgba(255,255,255,.78)}
body[data-dsh-theresa][data-tre-bg="on"][data-theresa-skin="on"][data-ds-dark-theme]{--dsw-specific-bubble:rgba(66,44,62,.74)}
body[data-dsh-theresa][data-tre-bg="on"] [data-conversation-scroll] :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th){
  text-shadow:0 1px 2px rgba(255,255,255,.92),0 0 10px rgba(255,250,246,.75);
}
body[data-dsh-theresa][data-tre-bg="on"][data-ds-dark-theme] [data-conversation-scroll] :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th){
  text-shadow:0 1px 2px rgba(12,8,16,.9),0 0 10px rgba(20,17,27,.7);
}

/* ---- 徽记 ---- */
body[data-dsh-theresa] .tre-mark{display:flex;align-items:center;justify-content:center;color:currentColor}
body[data-dsh-theresa][data-ds-dark-theme] .tre-mark{color:#EDE6EE}
body[data-dsh-theresa][data-tre-crown="off"] .tre-mark,
body[data-dsh-theresa][data-tre-hero="off"] .tre-hero{display:none}
body[data-dsh-theresa] .tre-hero{display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-warn-primary)}
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
  opacity:1;transition:opacity 700ms ease;
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
body[data-dsh-theresa] .tre-btn:focus-visible{outline:none;box-shadow:var(--tre-focus-ring,0 0 0 2px rgba(122,78,92,.45))}
@media (hover:none){body[data-dsh-theresa] .tre-btn{padding:10px 14px}}
`;

    // ------------------------------------------------------------------ state
    const store = {
      value: {
        rev: 0,
        ready: false,
        enabled: true,
        background: { current: '', dim: { light: 0.45, dark: 0.45 } },
        decoration: {
          petals: true,
          petalCount: 14,
          crownMark: true,
          heroCrown: true,
          seal: true,
          sealLatin: true,
          frame: true,
          figure: true,
          figureScale: 1,
        },
        opening: { enabled: true, oncePerSession: true, sound: false, hasOpening: false, posterUrl: null },
        backgrounds: [],
        signature: { available: false },
        sidebarFigure: { current: '', custom: false, version: 0, options: [] },
        figure: { current: '' },
        hero: { replace: true, headline: '去找到你自己吧……' },
        upload: { state: 'idle', text: '' },
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
      const petals = document.createElement('div');
      petals.className = 'tre-petals';
      el.append(first, second, veil, petals);
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
      body.setAttribute(SKIN_ATTR, value.enabled ? 'on' : 'off');
      body.setAttribute(BG_ATTR, value.background.current ? 'on' : 'off');
      body.setAttribute('data-tre-crown', value.decoration.crownMark ? 'on' : 'off');
      body.setAttribute('data-tre-hero', value.decoration.heroCrown ? 'on' : 'off');
      body.setAttribute('data-tre-seal', value.decoration.seal ? 'on' : 'off');
      body.setAttribute('data-tre-frame', value.decoration.frame ? 'on' : 'off');
      body.setAttribute('data-tre-figure', value.decoration.figure ? 'on' : 'off');
      body.setAttribute('data-tre-headline', value.hero?.replace === false ? 'off' : 'on');
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
      const finish = () => {
        if (done) return;
        done = true;
        if (capTimer !== null) clearTimeout(capTimer);
        window.removeEventListener('keydown', onKey);
        wrap.removeEventListener('click', finish);
        markOpeningSeen();
        wrap.dataset.out = '1';
        setTimeout(() => wrap.remove(), 750);
      };
      const onKey = (event) => {
        if (event.key === 'Escape' || event.key === ' ' || event.key === 'Enter') finish();
      };

      video.addEventListener('canplay', () => {
        wrap.dataset.ready = '1';
      }, { once: true });
      video.addEventListener('loadedmetadata', () => {
        // 时长 + 2.5s 的兜底：视频卡住也不会把界面挡死
        const ms = Number.isFinite(video.duration) ? video.duration * 1000 + 2500 : 25000;
        capTimer = setTimeout(finish, Math.min(Math.max(ms, 6000), 60000));
      }, { once: true });
      video.addEventListener('ended', finish);
      video.addEventListener('error', finish);
      wrap.addEventListener('click', finish);
      window.addEventListener('keydown', onKey);
      capTimer = setTimeout(finish, 30000);
      const started = video.play?.();
      if (started !== undefined && typeof started.catch === 'function') started.catch(finish);

      // ---- 声音：开关只表示"想不想要"，能不能真的响由浏览器的手势策略决定 ----
      // 先静音起步保证一定能播；想要声音时再尝试解除静音，被拒就露一个喇叭按钮。
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
        const hasGesture = navigator.userActivation?.hasBeenActive === true;
        if (!hasGesture) {
          // 本次页面还没有任何交互，带声播放必被拦：直接给按钮，别浪费时间
          showSoundButton();
        } else {
          video.muted = false;
          const resumed = video.play?.();
          if (resumed !== undefined && typeof resumed.catch === 'function') {
            resumed.catch(() => {
              video.muted = true;
              void video.play?.()?.catch?.(() => {});
              showSoundButton();
            });
          }
          // 有的实现会先 resolve 再暂停：400ms 后复查一次
          setTimeout(() => {
            if (!done && video.muted === false && video.paused) {
              video.muted = true;
              void video.play?.()?.catch?.(() => {});
              showSoundButton();
            }
          }, 400);
        }
      }
    }

    async function load() {
      const result = await api(`${ROUTE}/state`);
      if (result?.ok) {
        project(result.value);
        // 开屏只在这里触发：保存设定时不该重播
        playOpening(result.value.opening);
      }
      return result;
    }

    /** 写回：必须带 rev；版本对不上时宿主会把最新快照交回来。 */
    async function save(patch) {
      const current = store.value;
      const payload = {
        rev: current.rev,
        enabled: patch.enabled ?? current.enabled,
        background: {
          ...current.background,
          ...(patch.background ?? {}),
          // dim 必须深合并：只提交 light 时把 dark 一起带上，
          // 否则缺失的那半会在宿主那边落回默认值（表现为"拖一个另一个自己跳"）
          dim: { ...current.background.dim, ...(patch.background?.dim ?? {}) },
        },
        decoration: { ...current.decoration, ...(patch.decoration ?? {}) },
        opening: { ...current.opening, ...(patch.opening ?? {}) },
        hero: { ...current.hero, ...(patch.hero ?? {}) },
        figure: { ...current.figure, ...(patch.figure ?? {}) },
      };
      const result = await api(`${ROUTE}/state`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (result?.value) project(result.value);
      return result;
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
      return h('span', { className: 'tre-hero' }, crown(58));
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
                    background: { dim: { light: 0.45, dark: 0.45 } },
                    decoration: {
                      petals: true,
                      petalCount: 14,
                      crownMark: true,
                      heroCrown: true,
                      seal: true,
                      sealLatin: true,
                      frame: true,
                      figure: true,
          figureScale: 1,
                    },
                    opening: { enabled: true, oncePerSession: true, sound: false },
                    hero: { replace: true, headline: '去找到你自己吧……' },
                  }),
              },
              '恢复默认',
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
        body.setAttribute(BODY_ATTR, '');
        body.setAttribute(SKIN_ATTR, 'on');
        ensureLayer();
        return () => {
          for (const name of [BODY_ATTR, SKIN_ATTR, BG_ATTR, 'data-tre-crown', 'data-tre-hero', 'data-tre-seal', 'data-tre-frame', 'data-tre-headline', 'data-tre-figure', 'data-tre-side']) {
            body.removeAttribute(name);
          }
          body.style.removeProperty('--tre-dim-light');
          body.style.removeProperty('--tre-dim-dark');
          body.style.removeProperty('--tre-headline');
          body.style.removeProperty('--tre-figure-url');
          body.style.removeProperty('--tre-figure-scale');
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

      ctx.slots.inject('sidebar.brand.mark', () =>
        safe('sidebar.brand.mark', () =>
          ctx.slots.register({ name: 'sidebar.brand.mark', priority: -1 }, BrandMark),
        ),
      );

      ctx.slots.inject('conversation.hero.brand.mark', () =>
        safe('conversation.hero.brand.mark', () =>
          ctx.slots.register({ name: 'conversation.hero.brand.mark', priority: -1 }, HeroCrown),
        ),
      );
    }

    return { inject: ['slots'], apply };
  },
});
