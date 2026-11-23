#!/usr/bin/env python3
"""画像生成ツールの原画をKoe Match指定サイズへ中央クロップする。

人物・背景などの描画は行わず、原画のリサイズと背景キー処理だけを行う。
原画はCodex画像生成ツールが保存したファイルを参照する。
画風指定: 美容室の練習用マネキンに寄せたマットな頭部と首、顔と髪なし。
左ライラック、右アンバー。暗いエディトリアル挿絵、文字とロゴなし。
"""

from pathlib import Path
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent
GENERATED = Path('/Users/anubis/.codex/generated_images/01a1b180-6254-7ad0-ad81-4384eaea4346')
BACKGROUND = (19, 17, 20)
ASSETS = (
    ('exec-b2dc3f29-cad6-46c5-8a2b-071ae516a728.png', 'date-scene.png', (1200, 560), False),
    ('exec-572a50ae-7441-4256-a630-0d7730ffc38e.png', 'onboarding-figures.png', (1000, 1000), True),
)


def key_dark_background(image: Image.Image) -> Image.Image:
    """暗い無彩色の背景を#131114へ置換し、境界は滑らかに合成する。"""
    pixels = []
    for pixel in image.getdata():
        lightness = max(pixel)
        if lightness <= 40:
            pixels.append(BACKGROUND)
        elif lightness < 64:
            alpha = (lightness - 40) / 24
            alpha = alpha * alpha * (3 - 2 * alpha)
            pixels.append(tuple(round(base * (1 - alpha) + value * alpha)
                                for base, value in zip(BACKGROUND, pixel)))
        else:
            pixels.append(pixel)
    keyed = image.copy()
    keyed.putdata(pixels)
    return keyed


def main() -> None:
    """原画から指定された2枚のRGB PNGを作成して寸法を確認する。"""
    for source, filename, size, key_background in ASSETS:
        destination = ROOT / filename
        if destination.exists():
            raise FileExistsError(f'既存ファイルを保護しました: {destination}')
        with Image.open(GENERATED / source) as original:
            result = ImageOps.fit(original.convert('RGB'), size,
                                  method=Image.Resampling.LANCZOS,
                                  centering=(0.5, 0.5))
        if key_background:
            result = key_dark_background(result)
        result.save(destination, format='PNG', optimize=True)
        with Image.open(destination) as saved:
            assert saved.size == size and saved.mode == 'RGB' and saved.format == 'PNG'
            print(f'{destination}: {saved.width}x{saved.height}, {saved.mode}, PNG')


if __name__ == '__main__':
    main()
