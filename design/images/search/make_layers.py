#!/usr/bin/env python3
"""生成ツールの耳付き・耳なし原画から登録済みの透過スプライトを分離する。

絵の描画は行わない。Pillowは原画のリサイズ、輪郭位置合わせ、アルファの
分離・清掃、レイヤー合成、検証プレビューにのみ用いる。耳なし表面そのものは
画像生成ツールの局所編集による。source-generated.pngは未分離原画の1000角版。
全座標は画面基準。画像は全て1000×1000 RGBAで保存する。
"""

from collections import deque
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent
GENERATED = Path('/Users/anubis/.codex/generated_images/01a1b180-6254-7ad0-ad81-4384eaea4346')
FULL_SOURCE = GENERATED / 'exec-41d1a360-b46a-430b-a2d9-fbdc866807a5.png'
EARLESS_SOURCE = GENERATED / 'exec-d8e3072a-2318-43b4-bf7c-ec58d9d26208.png'
SIZE = (1000, 1000)
# 左耳の内側の取付け根を追跡する分割線。右耳は同じ中心線を基準に配置する。
LEFT_ROOT = ((355, 266), (363, 275), (377, 282), (400, 287),
             (430, 291), (460, 295), (490, 300), (515, 306),
             (533, 311), (540, 311))
SHIFT_X = 6
CENTER_SUM = 986 + 2 * SHIFT_X
ATTACH_Y = 448


def normalized(path: Path) -> Image.Image:
    """原画を中央で1000角へ正規化し、RGBAを維持する。"""
    with Image.open(path) as image:
        if 'A' not in image.getbands():
            raise ValueError(f'原画に透過アルファがありません: {path}')
        result = ImageOps.fit(image.convert('RGBA'), SIZE,
                              method=Image.Resampling.LANCZOS,
                              centering=(0.5, 0.5))
        centered = Image.new('RGBA', SIZE, (0, 0, 0, 0))
        centered.alpha_composite(result, (SHIFT_X, 0))
        return centered


def clean_alpha(image: Image.Image) -> Image.Image:
    """最大の連結シルエットとその1ピクセルの滑らかな縁だけを保持する。"""
    alpha = image.getchannel('A')
    values = alpha.tobytes()
    width, height = image.size
    visited = bytearray(width * height)
    largest = []
    for seed, value in enumerate(values):
        if value < 64 or visited[seed]:
            continue
        queue = deque([seed])
        visited[seed] = 1
        component = []
        while queue:
            point = queue.popleft()
            component.append(point)
            x, y = point % width, point // width
            neighbors = []
            if x: neighbors.append(point - 1)
            if x + 1 < width: neighbors.append(point + 1)
            if y: neighbors.append(point - width)
            if y + 1 < height: neighbors.append(point + width)
            for neighbor in neighbors:
                if not visited[neighbor] and values[neighbor] >= 64:
                    visited[neighbor] = 1
                    queue.append(neighbor)
        if len(component) > len(largest):
            largest = component
    support = bytearray(width * height)
    for point in largest:
        support[point] = 255
    mask = Image.frombytes('L', image.size, bytes(support)).filter(ImageFilter.MaxFilter(3))
    result = image.copy()
    result.putalpha(ImageChops.multiply(alpha, mask))
    return result


def row_bounds(image: Image.Image, y: int):
    """アルファが半分以上ある主輪郭の左右座標を取得する。"""
    row = image.getchannel('A').crop((0, y, 1000, y + 1)).tobytes()
    xs = [x for x, alpha in enumerate(row) if alpha >= 128]
    return (xs[0], xs[-1]) if xs else None


def hermite(y, y0, y1, x0, x1, slope0, slope1):
    """耳で隠れた頭の輪郭を接線連続の補間で位置合わせする。"""
    t = (y - y0) / (y1 - y0)
    return ((2*t**3 - 3*t**2 + 1)*x0 + (t**3 - 2*t**2 + t)*(y1-y0)*slope0
            + (-2*t**3 + 3*t**2)*x1 + (t**3 - t**2)*(y1-y0)*slope1)


def align_base(source: Image.Image, earless: Image.Image) -> Image.Image:
    """耳なし生成原画を元の頭・首・肩の輪郭へ行ごとに位置合わせする。"""
    base = Image.new('RGBA', SIZE, (0, 0, 0, 0))
    top = row_bounds(source, 350)
    bottom = row_bounds(source, 540)
    for y in range(1000):
        bounds = row_bounds(earless, y)
        target = row_bounds(source, y)
        if bounds is None or target is None:
            continue
        if 350 < y < 540:
            target = (round(hermite(y, 350, 540, top[0], bottom[0], 0.06, 0.32)),
                      round(hermite(y, 350, 540, top[1], bottom[1], -0.06, -0.32)))
        left, right = bounds
        target_left, target_right = target
        strip = earless.crop((max(0, left-1), y, min(1000, right+2), y+1))
        strip = strip.resize((target_right-target_left+3, 1), Image.Resampling.LANCZOS)
        base.paste(strip, (target_left-1, y))
    return clean_alpha(base)


def root_x(y):
    """左耳の内側分割線を線形補間する。"""
    for (y0, x0), (y1, x1) in zip(LEFT_ROOT, LEFT_ROOT[1:]):
        if y0 <= y <= y1:
            return SHIFT_X + x0 + (x1-x0)*(y-y0)/(y1-y0)
    return None


def split_ear(source: Image.Image, side: str) -> Image.Image:
    """元原画から耳と小さな根元の重なりだけを切り出す。"""
    mask = bytearray(1000000)
    for y in range(355, 540):
        boundary = root_x(y)
        if boundary is None: continue
        for x in range(215 + SHIFT_X, 320 + SHIFT_X):
            # 内側8ピクセルを滑らかに減衰し、頭との接合線を覆う。
            alpha = max(0, min(1, (boundary-x)/8))
            alpha = alpha * alpha * (3 - 2*alpha)
            alpha *= max(0, min(1, (540-y)/5))
            pixel_x = x if side == 'left' else CENTER_SUM-x
            mask[y*1000+pixel_x] = round(alpha*255)
    result = source.copy()
    result.putalpha(ImageChops.multiply(source.getchannel('A'), Image.frombytes('L', SIZE, bytes(mask))))
    return clean_alpha(result)


def geometry(image: Image.Image, side: str) -> dict:
    """実際の非透明範囲と画面基準の取付けピボットを記録する。"""
    box = image.getchannel('A').getbbox()
    x0, y0, x1, y1 = box
    inner = round(root_x(ATTACH_Y)-4)
    pivot_x = inner if side == 'left' else CENTER_SUM-inner
    return {'bbox': {'x': x0, 'y': y0, 'w': x1-x0, 'h': y1-y0},
            'pivot': {'x': pivot_x, 'y': ATTACH_Y}}


def composite_background(image: Image.Image, color: str) -> Image.Image:
    """指定背景上へ原画をアルファ合成する。"""
    return Image.alpha_composite(Image.new('RGBA', image.size, color), image)


def preview(full, base, left, right):
    """上段に明暗合成、下段にベースと拡大した左右耳を配置する。"""
    result = Image.new('RGBA', SIZE, '#4A4A4A')
    for index, color in enumerate(('#1a1a1a', '#808080')):
        panel = composite_background(full, color).resize((500, 500), Image.Resampling.LANCZOS)
        result.alpha_composite(panel, (index*500, 0))
    result.alpha_composite(composite_background(base, '#1a1a1a').resize((334,334), Image.Resampling.LANCZOS), (0,583))
    for image, offset in ((left,334),(right,667)):
        box = image.getchannel('A').getbbox()
        box = (max(0,box[0]-18),max(0,box[1]-18),min(1000,box[2]+18),min(1000,box[3]+18))
        isolated = image.crop(box)
        isolated.thumbnail((280,400), Image.Resampling.LANCZOS)
        result.alpha_composite(isolated, (offset+(333-isolated.width)//2, 550+(400-isolated.height)//2))
    framed = Image.new('RGBA', SIZE, (0, 0, 0, 0))
    framed.alpha_composite(result.resize((984, 984), Image.Resampling.LANCZOS), (8, 8))
    return framed


def main():
    """原画・分割スプライト・配置JSON・検証用画像を指定先だけへ保存する。"""
    ROOT.mkdir(parents=True, exist_ok=True)
    raw = normalized(FULL_SOURCE)
    raw.save(ROOT/'source-generated.png', optimize=True)
    source = clean_alpha(raw)
    earless = clean_alpha(normalized(EARLESS_SOURCE))
    base = align_base(source, earless)
    left, right = split_ear(source,'left'), split_ear(source,'right')
    full = Image.alpha_composite(Image.alpha_composite(base,left),right)
    outputs = {'head-base.png':base,'ear-left.png':left,'ear-right.png':right,
               'head-full.png':full,'preview.png':preview(full,base,left,right)}
    for name,image in outputs.items():
        assert image.size == SIZE and image.mode == 'RGBA'
        assert all(image.getpixel(xy)[3] == 0 for xy in ((0,0),(999,0),(0,999),(999,999)))
        image.save(ROOT/name, optimize=True)
    layout = {'canvas': {'w':1000,'h':1000},'earLeft':geometry(left,'left'),'earRight':geometry(right,'right')}
    (ROOT/'layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2)+'\n')
    assert full.tobytes() == Image.alpha_composite(Image.alpha_composite(base,left),right).tobytes()
    print(json.dumps(layout,ensure_ascii=False,indent=2))
    print('All PNG files: 1000x1000 RGBA; head-full equals the exact ordered alpha stack.')


if __name__ == '__main__':
    main()
