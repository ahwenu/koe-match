#!/usr/bin/env python3
"""画像生成ツールで作ったKoe Matchの背景6枚を1200×800 PNGに仕上げる。

Pillowは中央クロップとLANCZOSリサイズ、PNG保存だけに使う。
共通生成指示: 無人・文字とロゴなし・中立な白色光・紫とオレンジを除外。
自然な緑・青・白と白木調の中立グレー木材、下部約25%はUI用の静かな床や地面。
リアルで柔らかな写真調の挿絵を6場面で統一した。
"""

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
GENERATED = Path('/Users/anubis/.codex/generated_images/01a1b180-6254-7ad0-ad81-4384eaea4346')
SIZE = (1200, 800)
SCENES = (
    ('exec-503352ac-81cf-481d-bbe7-2ade24b18fa9.png', 'cafe.png', '東京の窓辺の二人席、白いカップ2個、日中、緑の植物'),
    ('exec-748a08a5-62b4-4011-9bca-248174978998.png', 'park.png', '初夏の都市公園、新緑、池のそばの空いた木製ベンチ'),
    ('exec-3911fa08-6569-4571-b79f-c47aba4bf543.png', 'izakaya.png', '夕方の清潔な居酒屋、白色灯、明るい木のカウンターとスツール2脚'),
    ('exec-9dd9ef27-9fde-419a-9490-724de53c7298.png', 'riverside.png', '青い薄暮の川沿い遊歩道、手すり、白い街灯'),
    ('exec-2dc9051f-4cdf-4f61-969e-0e76073fee2b.png', 'station.png', '昼の駅前広場、文字のない抽象彫刻、青空と木々'),
    ('exec-c56e7ca3-259e-4331-aa6a-5b2731a0280a.png', 'museum.png', '白い美術館、天窓、空いたベンチ、青緑の非具象絵画'),
)


def main() -> None:
    """6枚の生成原画を中央クロップし、指定先へRGB PNGとして保存する。"""
    for source, filename, _prompt_summary in SCENES:
        destination = ROOT / filename
        with Image.open(GENERATED / source) as original:
            output = ImageOps.fit(original.convert('RGB'), SIZE,
                                  method=Image.Resampling.LANCZOS,
                                  centering=(0.5, 0.5))
        output.save(destination, format='PNG', optimize=True)
        with Image.open(destination) as saved:
            assert saved.size == SIZE and saved.mode == 'RGB' and saved.format == 'PNG'
            print(f'{destination}: {saved.width}x{saved.height}, {saved.mode}, PNG')


if __name__ == '__main__':
    main()
