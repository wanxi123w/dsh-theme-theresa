"""花束剪影：给「预览版」徽章用的图形。

参考 `素材/egg01.png` 里她胸前那束白花——几朵五瓣花聚成一团、两片叶、一截短茎。
真花直接抠图在小尺寸下会糊成噪点，所以按同一构成画成 24×24 的剪影：
几何数据在这里定义，预览（PIL）与产出（SVG data URI）共用同一份坐标。
"""
import base64
import os
from math import cos, sin, radians

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "packages", "theme-theresa", "assets")

# (cx, cy, 花瓣半径)：聚成一团，越靠外越小，边缘才有"花团"的起伏
BLOSSOMS = [
    (9.0, 7.4, 2.5),
    (14.4, 6.2, 2.2),
    (18.4, 9.2, 1.95),
    (6.2, 11.6, 2.05),
    (11.8, 11.4, 2.8),
    (16.6, 12.4, 2.3),
    (9.4, 15.2, 2.1),
    (14.2, 16.4, 1.9),
]
# 叶片：贴近花团，别飘在外面
LEAVES = [
    (3.9, 15.4, 1.55, 3.3, -34),
    (19.9, 15.0, 1.45, 3.1, 28),
]
# 花茎：从花团底部下垂
STEM = [(12.2, 17.2), (11.8, 20.4), (10.6, 23.4)]

PETAL_STEP = 72
PETAL_RATIO_Y = 1.52   # 椭圆花瓣的纵向拉伸
CORE_RATIO = 0.34


def ellipse_points(cx, cy, rx, ry, angle_deg, steps=28):
    """旋转椭圆的多边形近似（PIL 没有旋转椭圆）。"""
    a = radians(angle_deg)
    ca, sa = cos(a), sin(a)
    pts = []
    for i in range(steps):
        t = 2 * 3.141592653589793 * i / steps
        x, y = rx * cos(t), ry * sin(t)
        pts.append((cx + x * ca - y * sa, cy + x * sa + y * ca))
    return pts


def petals(cx, cy, r):
    """一朵五瓣花：五个绕心旋转的椭圆 + 花心。"""
    rx, ry = r * 0.52, r * 0.52 * PETAL_RATIO_Y
    out = []
    for k in range(5):
        angle = k * PETAL_STEP
        a = radians(angle)
        # 花瓣中心沿法线外移，再由椭圆自身旋转
        px = cx + (r * 0.62) * sin(a)
        py = cy - (r * 0.62) * cos(a)
        out.append(ellipse_points(px, py, rx, ry, angle))
    out.append(ellipse_points(cx, cy, r * CORE_RATIO * 1.6, r * CORE_RATIO * 1.6, 0, 20))
    return out


def preview(path, bg, ink, sizes=(16, 22, 28, 64)):
    pad = 14
    cell = max(sizes) + pad * 2
    img = Image.new("RGB", (cell * len(sizes), cell), bg)
    for index, size in enumerate(sizes):
        layer = Image.new("L", (size * 4, size * 4), 0)
        draw = ImageDraw.Draw(layer)
        k = size * 4 / 24.0
        for cx, cy, r in BLOSSOMS:
            for poly in petals(cx, cy, r):
                draw.polygon([(x * k, y * k) for x, y in poly], fill=255)
        for cx, cy, rx, ry, angle in LEAVES:
            draw.polygon([(x * k, y * k) for x, y in ellipse_points(cx, cy, rx, ry, angle)], fill=255)
        draw.line([(x * k, y * k) for x, y in STEM], fill=255, width=max(1, int(0.9 * k)))
        mark = layer.resize((size, size), Image.LANCZOS)
        x0 = index * cell + (cell - size) // 2
        img.paste(ink, (x0, (cell - size) // 2), mark)
    img.save(path)


def svg():
    parts = ["<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><g fill='%23fff'>"]
    for cx, cy, r in BLOSSOMS:
        rx, ry = r * 0.52, r * 0.52 * PETAL_RATIO_Y
        for k in range(5):
            angle = k * PETAL_STEP
            a = radians(angle)
            px = cx + (r * 0.62) * sin(a)
            py = cy - (r * 0.62) * cos(a)
            parts.append(
                f"<ellipse cx='{px:.2f}' cy='{py:.2f}' rx='{rx:.2f}' ry='{ry:.2f}' "
                f"transform='rotate({angle} {px:.2f} {py:.2f})'/>"
            )
        cr = r * CORE_RATIO
        parts.append(f"<circle cx='{cx:.2f}' cy='{cy:.2f}' r='{cr:.2f}'/>")
    for cx, cy, rx, ry, angle in LEAVES:
        parts.append(
            f"<ellipse cx='{cx:.2f}' cy='{cy:.2f}' rx='{rx:.2f}' ry='{ry:.2f}' "
            f"transform='rotate({angle} {cx:.2f} {cy:.2f})'/>"
        )
    pts = " ".join(f"{x:.2f} {y:.2f}" for x, y in STEM)
    parts.append(f"</g><polyline points='{pts}' fill='none' stroke='%23fff' stroke-width='0.95' stroke-linecap='round'/></svg>")
    return "".join(parts)


def main():
    markup = svg()
    with open(os.path.join(ART, "bouquet.svg"), "w", encoding="utf-8") as fh:
        fh.write(markup + "\n")
    preview(os.path.join(ROOT, "tools", "preview-bouquet.png"), "#FBF8F4", (24, 19, 25))
    preview(os.path.join(ROOT, "tools", "preview-bouquet-dark.png"), "#14111B", (240, 232, 242))
    # CSS 里用的 data URI（单引号已安全，只需转义 #）
    b64 = base64.b64encode(markup.encode("utf-8")).decode("ascii")
    with open(os.path.join(ROOT, "tools", "bouquet-b64.txt"), "w", encoding="utf-8") as fh:
        fh.write(b64 + "\n")
    print(f"bouquet.svg {len(markup)} chars -> base64 {len(b64)} chars（base64 里没有引号/反引号，进 JS 字符串最安全）")
    print(f"花瓣 {len(BLOSSOMS)} 朵，叶 {len(LEAVES)} 片")


if __name__ == "__main__":
    main()
