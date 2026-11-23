# Codex への引き継ぎメモ（2026-11-23）

Koe Match（声で出会うマッチングアプリ）の UI/UX デザインを Pen.dev で進めている。Claude の作業をここで区切り、Codex に引き継ぐ。

## 1. 守るルール（ユーザー指定）
- 人の顔写真は使わない。人物は**マネキン風**にする（髪・目・鼻なし）。
- プロフィールのアバターは**ヘッドホンをつけたマネキンの胸像**にする。変えるのは**口元だけ**（笑顔・話し中・にっこり・鼻歌など）。背景は黄・ピンク・水色・ミントなど複数のパステル色。空の画像枠は置かない。
- 声で操作するアプリ（「左」「右」「次」）。タップは補助。
- 清純で、27〜40歳の男女向け。マッチングアプリらしく見せる。子どもっぽくしない。AIっぽい配色や抽象的すぎるデザインも避ける。
- **オレンジと紫は使わない。**
- 基本はライトモード。ダークモードも用意する。
- アニメーションは体験が良くなるところに積極的に入れる。
- **古いデザインは消さない。** 変更前に `design/versions/vN-名前/` へ `.pen`（参照している画像も）をコピーし、`design/versions/README.md` に追記する。
- 著作権表記は `2026 AHWENU'S COFFEE`。
- 作業は複数エージェントで並行する（AGENTS.md）。開発判断は `docs/qiita-draft.md` に追記する。

## 2. ファイル
- デザイン本体: `design/koe-match.pen`（保存済み）。直前の版は `design/versions/v3.2-handoff/` に保存してある。
- 版の記録: `design/versions/README.md`（v1、v2、v3、v3.1、v3.2）
- 動きの仕様: `docs/motion-spec.md`
- 試作 HTML:
  - `design/prototypes/onboarding-match.html`: 2つの波形リングが重なってマッチするアニメーション
  - `design/prototypes/search-ear-swipe.html`: 耳スワイプの操作試作。PNG がないと SVG の頭で代用し、`?embed=1` で自動デモが流れる

## 3. デザイントークン（.pen の変数、light / dark）
| 用途 | light | dark |
| --- | --- | --- |
| bg | #F8F6F7 | #121012 |
| surface | #FFFFFF | #1E1A1C |
| surface-2 | #F1EDEF | #2A2528 |
| line | #ECE6E9 | #342E31 |
| text | #1F1A1D | #F6F1F3 |
| text-2 | #756E72 | #A9A1A5 |
| primary（ローズ） | #E8557A | #FF6B8B |
| primary-soft | #FDE9EE | #3B2129 |
| on-primary | #FFFFFF | #FFFFFF |
| accent-blue（聴く・再生） | #3C9BE6 | #5AB0F5 |
| accent-mint（AIの分身・相性・成功） | #1FAF97 | #3CCBB0 |
| accent-yellow（進み具合・ヒント） | #E9B824 | #F7CF4D |

- アクセント3色には `-soft` と `-text` もある。文字色には `-text` を使い、16進の色を直接書かない。
- フォントは Noto Sans JP（数字は Inter）。

## 4. .pen の構成（主なノード ID）
- **コンポーネント**
  - Status Bar `zmH1D`
  - Voice Dock `k6Dgb`: タブは さがす / マッチ / トーク / マイページ。中央のマイクはローズ
  - Primary Button `AGfSu`
  - Voice Card `u5MWQ`: アバター `ch8ma`、再生ボタンは青、AIバッジはミント
- **画面（ライト、y=140）**
  - 01 はじめに `A6TSj`
  - 02 声で自己紹介 `cLSf6`
  - 03 プロフィール確認 `q0IWe`
  - 04 左右で聴きくらべ `wQEsP`
    - 頭のレイヤーは `RgpSw`（頭）、`ofQZ1`（左耳）、`zglXB`（右耳）
    - 参照する画像は `./images/search/*.png`
  - 05 マッチング成立 `mmnXc`
  - 06 デート練習 `Mgh6k`: シーン画像 `HpiaJ` → `./images/scenes/cafe.png`
  - 07 デートのふりかえり `oiwdp`
- **2段目（y=2100）**
  - 04b 右にスワイプ中 `YwNqQ`
  - 04c 左にスワイプ中 `U4KdgH`
  - 04d Bさんを選択 `AgJXe`
  - 06a シチュエーションを選ぶ `sEWVr`。シーンカードは次の6枚
    - `hkaZs` カフェ
    - `SemzU` 公園
    - `x7rAuY` 居酒屋（画像ノード `N1Vff` → `./images/counter-scene-v3.png`）
    - `olJkY`
    - `iKztP`
    - `imZ5Y`
- **その他**
  - ストーリーボード `Z3Shz`（x=3200）
  - 概要ボード `VpyYn`（y=-760）: 文章の一部が v2 のまま
  - Browser ノード: `j3SQ4` / `b9CBP`（オンボーディング試作、light / dark）、`ZaVtx`（耳スワイプ試作）
  - 「DARK MODE」ラベル `vHfcZ`（y=1040）: v3 のダーク版はまだない

## 5. 画像生成の状況（Codex の待ち行列、このスレッド宛て）
| ジョブ | 内容 | 状態 | 出力先 |
| --- | --- | --- | --- |
| a320a540 | アバター（旧仕様） | 完了 | `design/images/avatars/{haru,sora,kei,nao,ren,you}.png` |
| f4631a06 | 頭と左右の耳のパーツ | 実行中 | `design/images/search/head-base.png`、`ear-left.png`、`ear-right.png`、`layout.json`（今は `preview.png` だけ届いている） |
| 696fdcfa | デートのシーン6枚 | 待ち | `design/images/scenes/{cafe,park,izakaya,riverside,station,museum}.png` |
| d8428ad4 | **ヘッドホン付き・口元違い**のアバター（新仕様） | 待ち | `design/images/avatars/`（a320a540 の分を置き換える） |

- a320a540 のアバターは**仕様を満たしていない**（ヘッドホンも口もない卵型の頭）。d8428ad4 の分が届いたら差し替え、旧仕様の画像は `design/versions/` に移して残す（消さない）。
- 生成された元画像は `~/.codex/generated_images/01a1b180-6254-7ad0-ad81-4384eaea4346/` にある。
- **Pen の注意点**: Pen は「画像が見つからなかったパス」をキャッシュする。あとから同じパスにファイルを置いても市松模様のまま表示されることがある。その場合は別名にコピーしてから参照先を差し替えるか、ドキュメントを開き直す（例: `date-scene-light.png` → `counter-scene-v3.png`）。

## 6. 残りの作業（順番の目安）
1. 届いた画像がルールに合っているか確かめる。
   - 目・鼻・髪がないこと。アバターはヘッドホンと口元があること。オレンジと紫がないこと。
   - 合わない画像は `versions/` に移して残す。
2. 画像をデザインに入れる。
   - 頭と耳のパーツ → 04、04b〜04d のレイヤーと `search-ear-swipe.html`
   - シーン6枚 → 06a のカードと 06 の `HpiaJ`
   - アバター → Voice Card の `ch8ma` と、各画面のアバター枠
3. 変更の前に版を保存する（v3.3 など）。
4. v3 の各画面のダーク版を作る（複製して `theme:{mode:"dark"}`）。y=1040 の段に並べる。
5. 概要ボード `VpyYn` の文章を v3 の内容に直す。
6. PNG を書き出して保存し、`docs/qiita-draft.md` に日付付きで追記する。
