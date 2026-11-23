# Koe Match

声で相手を知り、初対面の会話を練習するハッカソン向けのスマホアプリ。React Native、TypeScript、Expo SDK 58で実装しています。

[Pen の v3.3](design/koe-match.pen) に沿った画面です。配色は端末のライト・ダーク設定に合わせて切り替わります。起動画面から「声で登録する」か、先に聴き比べを試すかを選べます。

- **さがす・マッチ** — 架空の候補４人の声をイヤホンで聴き比べ、左右のスワイプ、選択ボタン、キーボードからの音声入力で相手を選びます。３回の比較の進捗と結果は端末に保存されます。
- **マイページ** — Aqua Voice で話した自己紹介や日記を入力欄で確認し、紹介文を作成・編集・承認できます。iOS では録音した声をその場で試聴できます。
- **トーク** — 選んだ相手のデモの分身と、カフェや公園など６つの場所から選んで会話を練習します。タップやキーボードからの音声入力で進み、最後に実際に会ったときに聞ける質問を見返せます。

## 起動

Node.js 22.22以降を使います。

```sh
npm ci
npm run ios
```

`npm run ios` はローカルのXcodeとCocoaPodsを使い、開発ビルドをシミュレーターにインストールします。ブラウザでデモする場合は `npm run web` を実行します。AIや音声クローンの外部サービスを設定せず、端末内の紹介文生成・合成音声・台本による分岐で３機能を試せます。

iPhoneではAqua Voiceキーボードを設定してください。デート練習の「話して返事」で入力欄を開き、地球儀キーでAqua Voiceに切り替えます。入った文章を確認してから送信します。[iPhone版の設定手順](https://aquavoice.com/guide/getting-started-iphone)

iOSシミュレーターでは入力欄にカーソルを置き、Mac版Aqua Voiceの起動キーで話します。自動挿入できない場合は、Aqua Voiceの履歴から文字起こしをコピーし、Simulatorのクリップボード同期を使って入力欄に貼り付けます。[Mac版の設定手順](https://aquavoice.com/guide/getting-started-mac)

## 任意のAI・音声クローン

ローカル開発用APIは初期設定では無効です。有効にする場合は、プロジェクト直下の `.env.local` に使うサービスだけ設定します。

```dotenv
EXPO_PUBLIC_KOE_API_URL=http://127.0.0.1:8765
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
```

1. 別のターミナルで `npm run api` を実行します。
2. iOSシミュレーターでアプリを再起動します。
3. OpenAIを設定すると、紹介文の草案や仮想デート中の自由な質問への返答をリクエストできます。
4. ElevenLabsを設定すると、iOSのプロフィールで自分の声を録音し、送信に同意して登録できます。登録後は紹介文の試聴や登録済み音声の削除ができます。ElevenLabs側で本人確認を求められたときはサービス側で完了してください。

APIはループバックにのみバインドする開発用サーバーです。APIキーはサーバー側に保持します。物理端末での外部サービス利用や本番のユーザー間マッチングには別途、認証付きバックエンドが必要です。候補の試聴にはVoice-matchingの合成音声４本を使用し、左右で聴けるよう８本のステレオファイルを同梱しています。[音源の取り込みとクレジット](docs/voice-matching/integration.md)

## 検証と開発記録

```sh
npm run typecheck
npm run lint
npx expo export --platform all
```

開発手法とAqua Voiceの利用は [Qiita向けの未公開下書き](docs/qiita-draft.md) に追記します。

## 関連企画の資料

初回の [開発タスク仕様書](docs/voice-matching/Task.md) と [README](docs/voice-matching/README.md) を保存しています。上流の Web 版から Expo 版に反映した内容と確認したコミットは [取り込み記録](docs/voice-matching/integration.md) を参照してください。
