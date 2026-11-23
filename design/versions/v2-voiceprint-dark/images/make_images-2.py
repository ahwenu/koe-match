#!/usr/bin/env python3
"""生成原画を中央クロップし、Koe Matchの明暗テーマ用画像を出力する。

絵の描画は行わず、リサイズと背景への透過合成だけを行う。
原画指定: 顔と髪のない美容室練習用マネキン、マットな挿絵。
ライト版は#F7F6F4と#EFEDEA、深い紫#6E5BB5と琥珀#B8662A。
"""

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
GENERATED = Path('/Users/anubis/.codex/generated_images/01a1b180-6254-7ad0-ad81-4384eaea4346')
ASSETS = (
    ('exec-b2dc3f29-cad6-46c5-8a2b-071ae516a728.png', 'date-scene.png', (1200, 560), 'RGB'),
    ('exec-a658cd6a-f34c-4957-a75b-2d0a49a599a4.png', 'date-scene-light.png', (1200, 560), 'RGB'),
    ('exec-b6c2b337-19ef-4bd1-801b-b497ae6c0b2d.png', 'onboarding-figures.png', (1000, 1000), 'RGBA'),
)


def make_preview(image: Image.Image) -> Image.Image:
    """左#F7F6F4・右#131114の背景に透過原画を等倍で合成する。"""
    preview = Image.new('RGB', (image.width * 2, image.height))
    for index, background in enumerate(('#F7F6F4', '#131114')):
        panel = Image.new('RGBA', image.size, background)
        panel = Image.alpha_composite(panel, image).convert('RGB')
        preview.paste(panel, (image.width * index, 0))
    return preview


def main() -> None:
    """ダーク版を保持し、ライト版・透過版・比較プレビューを生成する。"""
    for source, filename, size, mode in ASSETS:
        destination = ROOT / filename
        if filename == 'date-scene.png' and destination.exists():
            print(f'既存ダーク版を保持: {destination}')
            continue
        with Image.open(GENERATED / source) as original:
            if mode == 'RGBA' and ('A' not in original.getbands() or original.getchannel('A').getextrema()[0] != 0):
                raise ValueError('透過原画には完全透明な背景が必要です')
            result = ImageOps.fit(original.convert(mode), size,
                                  method=Image.Resampling.LANCZOS,
                                  centering=(0.5, 0.5))
        result.save(destination, format='PNG', optimize=True)
        with Image.open(destination) as saved:
            assert saved.size == size and saved.mode == mode and saved.format == 'PNG'
            print(f'{destination}: {saved.width}x{saved.height}, {saved.mode}, PNG')
        if filename == 'onboarding-figures.png':
            preview = make_preview(result)
            preview_path = ROOT / 'onboarding-preview.png'
            preview.save(preview_path, format='PNG', optimize=True)
            print(f'{preview_path}: {preview.width}x{preview.height}, RGB, PNG')


if __name__ == '__main__':
    main()
