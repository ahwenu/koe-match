# Voice-matching から Koe Match への反映

2026年11月23日に、以前取り込んだ企画仕様書の版から上流の `main` を確認した。Next.js のモバイル向け Web デモとして、左右再生、5組の比較、4種の回答、好みの集計、録音と再生、端末内の関心・相互成立が実装されていた。 [取込時点からの差分](https://github.com/Jun0908/Voice-matching/compare/8669b305ba1bfab82d1dfe064dfd7a325f0e0b89...2c2eb6826dbf2fe6d9c1ce1382102a56949341bf)

| 項目 | Koe Match への反映 |
| --- | --- |
| 比較の再開 | Expo 版の3ラウンドに合わせ、選択済みの候補 ID を端末に保存する。起動時に現在の候補データと照合し、途中のペアか確定した相手を復元する。「声を選び直す」で保存分も消去する。 |
| 左右の試聴 | 4人分の同梱音声を、選んだ側のステレオチャンネルだけに出力する素材に差し替えた。Koe Match の比較は片側再生で、中央再生への切り替えは上流 Web 版の設定にある。 |
| 好みの分析 | 上流は提示・選択数を話し方の特徴ごとに集計する。Koe Match では候補 ID の保存までを反映した。 |
| 録音 | 上流の録音はブラウザの IndexedDB に保管する。Koe Match の入力・録音には Expo 版の画面と API を使う。 |
| マッチ | 上流では明示的な関心と固定のデモデータを照合する。Koe Match では3回の比較結果から、架空の相手とのデート練習に進む。 |
| 画面と素材 | Koe Match の Pen v3 と Expo SDK 58 を画面の基準にする。音声は Koe Match に同梱済みの左右素材を使う。 |

保存処理は Expo 版として実装した。配布物には Koe Match のコードと素材を使用する。確認時の上流にあったライセンス文書はフォント向け。 [確認した上流ツリー](https://github.com/Jun0908/Voice-matching/tree/99f2b722a960617c2798acb9e061c50e99d9dea7)

保存処理の確認では、有効な途中経過、確定した相手、不正な候補 ID、壊れた JSON を検証した。模擬ストレージで保存の順序、途中の書き込み失敗、リセットを検証した。上流の確認位置は [upstream.json](upstream.json) に記録する。`lastReviewedCommit` は評価したコミットを示す。

2026年11月23日の追跡では、上流の片耳再生への変更を反映した。Koe Match の原音から作り直した左右8本を FFmpeg でデコードし、選択と反対側の PCM サンプルがすべてゼロであること、長さと再生側の音量が書き出し前後でそろっていることを確認した。旧ファイルは Git 履歴にある。 [片耳再生の差分](https://github.com/Jun0908/Voice-matching/commit/2c2eb6826dbf2fe6d9c1ce1382102a56949341bf)

## 2026年11月23日｜Voice-matchingの試聴音声を採用

上流の採用済み合成音声10本から、異なる音源キャラクターの４本を選んだ。Expo版の３ラウンドを維持し、ニックネーム、台詞、話し方は上流とそろえた。比較画面の「音声サンプルのクレジット」から各音源を確認できる。[上流の音声資料](https://github.com/Jun0908/Voice-matching/blob/a3a0c46ed48fbb3087741ec421eeee39e491c8a1/docs/AUDIO.md)

| 候補 | 上流のファイル | 音声クレジット |
| --- | --- | --- |
| リサ | `public/audio/asmr/risa.wav` | VOICEVOX:九州そら（ささやき） |
| あかり | `public/audio/asmr/akari.wav` | VOICEVOX:四国めたん（ささやき） |
| しおり | `public/audio/asmr/shiori.wav` | VOICEVOX:中部つるぎ（ヒソヒソ） |
| さな | `public/audio/asmr/sana.wav` | VOICEVOX:あんこもん（ささやき） |

元のモノラルPCMを片方のチャンネルにそのまま配置し、反対側を無音にしたステレオWAVを各候補２本作成した。８本すべてで、再生側は元のPCMとバイト単位で一致し、反対側は全サンプルがゼロだった。音声には下記の利用条件が適用される。[VOICEVOXソフトウェア利用規約](https://voicevox.hiroshiba.jp/term/)・[音源利用ガイドライン](https://zunko.jp/con_ongen_kiyaku.html)

候補IDには上流の値を使う。旧カタログで選んだ候補IDは新カタログに存在しないため、次回起動時の比較は１回目から始まる。プロフィールの保存は従来のまま。
