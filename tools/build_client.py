"""Inline the traced crown path into the deliverable client module.

背景图不再内联：它们由 Host 半的 `/theresa/background/<file>` 路由出字节，
客户端半只拿到 URL。这里只处理王冠路径（1.6 KB，内联比多一次请求划算）。

    python tools/build_client.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, "packages", "theme-theresa")
ART = os.path.join(PKG, "assets")


def crown():
    with open(os.path.join(ART, "crown.svg"), encoding="utf-8") as fh:
        svg = fh.read()
    view = re.search(r'viewBox="([^"]+)"', svg)
    path = re.search(r'<path d="([^"]+)"', svg)
    if view is None or path is None:
        raise SystemExit("crown.svg has no viewBox/path")
    return view.group(1), path.group(1)


def assert_template_clean(source):
    """CSS 模板里不能再出现反引号。

    真实事故：注释里写了 `.titleGroup` 的反引号版本，把模板字符串提前闭合，
    于是 `` `<一串插值>` `` 被解析成标签模板调用 → "xxx.titleGroup is not a function"
    → 客户端模块 import 失败 → DSH Desktop 直接进恢复模式。
    `node --check` 查不出（语法合法），所以必须在构建这一步拦。
    """
    marker = "const CSS = " + chr(96)
    start = source.find(marker)
    if start < 0:
        raise SystemExit("src/client.js: 找不到 CSS 模板")
    end = source.find(chr(96) + ";", start + len(marker))
    if end < 0:
        raise SystemExit("src/client.js: CSS 模板没有闭合")
    body = source[start + len(marker) : end]
    if chr(96) in body:
        line = body[: body.index(chr(96))].count("\n") + 1
        raise SystemExit(
            f"src/client.js: CSS 模板第 {line} 行出现反引号——会提前闭合模板，"
            "导致客户端模块 import 失败（DSH 会进恢复模式）。请改用「」或去掉。"
        )


def main():
    with open(os.path.join(ROOT, "src", "client.js"), encoding="utf-8") as fh:
        source = fh.read()

    assert_template_clean(source)

    # 花束剪影：base64 内联（tools/bouquet.py 产出）
    with open(os.path.join(ROOT, 'tools', 'bouquet-b64.txt'), encoding='utf-8') as fh:
        bouquet = fh.read().strip()
    if '__BOUQUET_B64__' not in source:
        raise SystemExit('placeholder __BOUQUET_B64__ missing from src/client.js')
    source = source.replace('__BOUQUET_B64__', bouquet)

    view, path = crown()
    for key, value in (("__CROWN_VIEWBOX__", view), ("__CROWN_PATH__", path)):
        if key not in source:
            raise SystemExit(f"placeholder {key} missing from src/client.js")
        source = source.replace(key, value)

    out_dir = os.path.join(PKG, "lib")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "client.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(source)
    print(f"crown: viewBox {view}, path {len(path)} chars")
    print(f"lib/client.js: {round(os.path.getsize(out) / 1024, 1)} KiB")


if __name__ == "__main__":
    main()
