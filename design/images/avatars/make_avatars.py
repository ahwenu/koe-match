#!/usr/bin/env python3
"""画像生成ツールのヘッドホン・口元付きアバター6枚を800角PNGに整える。

Pillowは中央クロップ、LANCZOSリサイズ、分離可能な単色背景の指定色置換、
PNG保存だけに使用する。人物・口・ヘッドホンの描画は行わない。
全て同一のHARU生成原画を基準とし、石膏素材・構図・白色光を揃えて生成した。
目・鼻・眉・髪・ロゴはなく、口元だけで表情を変える最新版の仕様。
"""

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
GENERATED = Path('/Users/anubis/.codex/generated_images/01a1b180-6254-7ad0-ad81-4384eaea4346')
SIZE = (800, 800)
# 原画・保存名・指定背景・ヘッドホンと口元の生成指示。
AVATARS = (
    ('exec-e6f1a215-4925-4003-b929-a1ec94d2d45d.png', 'haru.png', '#FDE2EA', 'white headphones; gentle closed-mouth smile'),
    ('exec-424df751-1589-433d-98c0-90079ae4ccd8.png', 'sora.png', '#DDEFFC', 'ink-black headphones; open a-vowel mouth'),
    ('exec-e462d025-5e70-4a18-8c9d-45fad95c320b.png', 'kei.png', '#FFF1B8', 'light-gray headphones; happy grin with a hint of teeth'),
    ('exec-cf63bc7d-53dc-4fd5-9de6-2d62c02beb4c.png', 'nao.png', '#DDF3E6', 'cream headphones; small humming o-mouth'),
    ('exec-bb8e8997-e038-41ac-9dbd-7879483e1894.png', 'ren.png', '#D9F2F5', 'ink-black headphones; laughing open smile'),
    ('exec-42c2453a-5d9e-4183-a707-3c6da2ba1bf1.png', 'you.png', '#F8E9E4', 'white headphones; calm relaxed slight smile'),
)


def background_strength(pixel, name: str) -> float:
    """背景の色差成分から、石膏やヘッドホンを除いた背景重みを返す。"""
    r, g, b = pixel
    if name == 'haru':
        strength = min(r-g-18, b-g-1) / 4
    elif name == 'sora':
        strength = min(b-r-18, b-g-6) / 4
    elif name == 'kei':
        strength = min(r-b-35, g-b-25) / 8
    elif name == 'nao':
        strength = min(g-r-10, g-b-6) / 4
    elif name == 'ren':
        strength = min(g-r-14, b-r-18) / 4
    else:
        strength = min(r-g-10, r-b-14) / 4
    strength = max(0.0, min(1.0, strength))
    return strength * strength * (3 - 2*strength)


def flatten_background(image: Image.Image, name: str, color: str) -> Image.Image:
    """口元を保護し、単色背景とその縁を指定のHEX色へ滑らかに揃える。"""
    # YOUの淡いピンクベージュは石膏の陰影と近いため、原画の近似背景を維持する。
    if name == 'you':
        return image.copy()
    target = tuple(bytes.fromhex(color.removeprefix('#')))
    pixels = []
    for index, pixel in enumerate(image.getdata()):
        x, y = index % image.width, index // image.width
        # 背景と似た色の唇を、背景マスクの候補から明示的に除外する。
        protected_mouth = (((x/image.width-0.44)/0.11)**2
                           + ((y/image.height-0.565)/0.07)**2 <= 1)
        weight = 0.0 if protected_mouth else background_strength(pixel, name)
        pixels.append(tuple(round(value*(1-weight)+background*weight)
                            for value, background in zip(pixel, target)))
    result = image.copy()
    result.putdata(pixels)
    return result


def main() -> None:
    """最新原画を800角に整え、指定背景のRGB PNGとして6枚を上書きする。"""
    for source, filename, background, _prompt_summary in AVATARS:
        with Image.open(GENERATED / source) as original:
            image = ImageOps.fit(original.convert('RGB'), SIZE,
                                 method=Image.Resampling.LANCZOS,
                                 centering=(0.5, 0.5))
        image = flatten_background(image, Path(filename).stem, background)
        destination = ROOT / filename
        image.save(destination, format='PNG', optimize=True)
        with Image.open(destination) as saved:
            assert saved.size == SIZE and saved.mode == 'RGB' and saved.format == 'PNG'
            target = tuple(bytes.fromhex(background[1:]))
            corners = [saved.getpixel(pos) for pos in ((0,0),(799,0),(0,799),(799,799))]
            if filename != 'you.png':
                assert all(pixel == target for pixel in corners)
            else:
                assert max(abs(value-base) for pixel in corners for value,base in zip(pixel,target)) <= 16
            note = ' (native near-match background retained)' if filename == 'you.png' else ''
            print(f'{destination}: 800x800, RGB PNG, background {background}{note}')


if __name__ == '__main__':
    main()
