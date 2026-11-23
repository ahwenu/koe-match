#!/usr/bin/env python3
"""画像生成原画からローズ配色のKoe Match用PNGを仕上げる。

絵の描画や色の再着色は行わず、中央クロップ・リサイズと透過合成のみ行う。
最新の生成指示: 顔と髪のない美容室練習用マネキン、マットな挿絵。
白#F8F6F7、ローズ#E8557A、墨#1F1A1D、暗背景#121012。
紫・オレンジ・肌色・色付きの暖色照明・文字・ロゴは禁止。
"""

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
GENERATED = Path('/Users/anubis/.codex/generated_images/01a1b180-6254-7ad0-ad81-4384eaea4346')
ASSETS = (
    ('exec-e38b8f29-4313-499c-8f10-988b9688ba0d.png', 'date-scene-light.png', (1200, 560), 'RGB'),
    ('exec-fefadc9b-a5e4-4f6a-a960-c07e2cbc4405.png', 'date-scene.png', (1200, 560), 'RGB'),
    ('exec-8a8c2032-8872-49b2-9f3e-d7e8aa60d807.png', 'onboarding-figures.png', (1000, 1000), 'RGBA'),
)


def make_preview(image: Image.Image) -> Image.Image:
    """左#F8F6F7・右#121012の背景へ透過原画を等倍で合成する。"""
    preview = Image.new('RGB', (image.width * 2, image.height))
    for index, background in enumerate(('#F8F6F7', '#121012')):
        panel = Image.new('RGBA', image.size, background)
        panel = Image.alpha_composite(panel, image).convert('RGB')
        preview.paste(panel, (image.width * index, 0))
    return preview


def main() -> None:
    """指定の3原画を整え、明暗比較プレビューとともに保存する。"""
    for source, filename, size, mode in ASSETS:
        destination = ROOT / filename
        with Image.open(GENERATED / source) as original:
            if mode == 'RGBA' and ('A' not in original.getbands() or original.getchannel('A').getextrema()[0] != 0):
                raise ValueError('透過原画に完全透明な背景がありません')
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
