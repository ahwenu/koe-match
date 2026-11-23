# Koe Match モーション仕様書（開発者向け）

- 対象: Expo SDK 58（`expo ~58.0.26` / `react-native 0.88.1`）
- 対象画面: 01 はじめに 〜 07 ふりかえり、Voice Dock
- テーマ: **ライトが標準**、ダークはバリエーション
- 作成日: 2026-11-23

> 本書の API 名・インストール手順は下記の公式ドキュメントで確認済み（2026-11-23 時点）。確認できなかった点は「要検証」と明記する。

| 参照 | URL |
| --- | --- |
| Expo docs 索引 | https://docs.expo.dev/llms.txt |
| Reanimated (SDK 58) | https://docs.expo.dev/versions/v58.0.0/sdk/reanimated/ |
| Gesture Handler (SDK 58) | https://docs.expo.dev/versions/v58.0.0/sdk/gesture-handler/ |
| Haptics (SDK 58) | https://docs.expo.dev/versions/v58.0.0/sdk/haptics/ |
| Audio (SDK 58) | https://docs.expo.dev/versions/v58.0.0/sdk/audio/ |
| `usePanGesture` (RNGH 3.x) | https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/use-pan-gesture |
| `useReducedMotion` | https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion |
| Reanimated アクセシビリティ | https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility |
| `withSpring` (4.x) | https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring |
| Expo Router Stack | https://docs.expo.dev/router/advanced/stack/ |

---

## 0. 前提と現状のギャップ

- 現在の実装は `App.tsx` 内のタブ切替（`discovery` / `profile` / `date`）で、**Expo Router は未導入**、`src/app/` も存在しない。AGENTS.md の方針どおり Expo Router へ移行する前提で §2.10 を書いている。
- **expo-audio にはステレオのパン/バランス API がない**（`AudioPlayerOptions` / `AudioStatus` に pan 系フィールドなし）。04 の「左耳→右耳」は、**左右に定位済みの音声アセット**（サーバー側で L only / R only に書き出したステレオファイル、または 1 本のファイルに L 区間→R 区間を並べたもの）で実現し、パン表示は再生位置から算出する（§2.5）。
- **録音メータリングの単位はドキュメントに明記なし**。`RecorderState.metering` は optional number。実機で値域を確認し、§2.1 の正規化レンジを調整すること（要検証）。

---

## 1. モーション原則とトークン

### 原則
1. **静かで上質**: 27〜40 歳向け。バウンス・オーバーシュート・回転演出は使わない。スプリングは `dampingRatio: 1`（臨界減衰）を基本とする。
2. **声が主役**: 動きは「音の状態」を可視化するためだけに使う。装飾目的のループは呼吸（idle）だけ。
3. **短く**: UI 応答は 120〜240ms、画面転換は 280〜360ms、演出（Reveal）でも合計 1.6 秒以内。
4. **UI スレッドで完結**: 音量・ジェスチャー由来の値は shared value で持ち、React の再レンダーを起こさない。
5. **Reduce Motion を常に尊重**: すべてのアニメーションに `reduceMotion: ReduceMotion.System` を付ける（Reanimated の既定値だが明示する）。代替表現は §3。

### トークン（`src/motion/tokens.ts`）

```ts
import { Easing, ReduceMotion } from 'react-native-reanimated';

export const duration = {
  instant: 90,    // 押下フィードバック
  fast: 160,      // トースト、ハイライト切替
  base: 240,      // カード/バブルの出現
  screen: 320,    // 画面遷移
  slow: 480,      // Reveal の主要フェーズ
  breath: 3600,   // voiceprint 呼吸 1 周期
  themeFade: 200, // テーマ切替クロスフェード
} as const;

export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),     // 移動・拡大の既定
  enter: Easing.bezier(0.05, 0.7, 0.1, 1),   // 出現（減速）
  exit: Easing.bezier(0.3, 0, 0.8, 0.15),    // 退場（加速）
  breath: Easing.inOut(Easing.sin),          // 呼吸ループ
  linear: Easing.linear,                     // 再生進捗スイープ
} as const;

// Reanimated 4 の duration ベース spring（duration/dampingRatio と stiffness/damping は混在させない）
// 注: 実際の所要時間は duration の約 1.5 倍（withSpring ドキュメント）
export const spring = {
  settle: { duration: 360, dampingRatio: 1, reduceMotion: ReduceMotion.System },   // カード戻り
  gentle: { duration: 480, dampingRatio: 0.92, reduceMotion: ReduceMotion.System }, // Reveal の着地のみ
  meter: { duration: 120, dampingRatio: 1, reduceMotion: ReduceMotion.System },     // バー長追従
} as const;

export const timing = (ms: number, e = easing.standard) => ({
  duration: ms, easing: e, reduceMotion: ReduceMotion.System,
});
```

### テーマ（ライト標準）

| token | Light（既定） | Dark |
| --- | --- | --- |
| `bg` | `#F8F6F7` | `#121012` |
| `surface` | `#FFFFFF` | `#1E1A1C` |
| `surface2` | `#F1EDEF` | `#2A2528` |
| `line` | `#ECE6E9` | `#342E31` |
| `text` | `#1F1A1D` | `#F6F1F3` |
| `text2` | `#756E72` | `#A9A1A5` |
| `primary`（rose） | `#E8557A` | `#FF6B8B` |
| `primarySoft` | `#FDE9EE` | `#3B2129` |
| `onPrimary` | `#FFFFFF` | `#FFFFFF` |
| `voiceLeft`（= `primary`、rose） | `#E8557A` | `#FF6B8B` |
| `voiceRight`（= `text`、ink） | `#1F1A1D` | `#F6F1F3` |

- フォント: 全文 `Noto Sans JP`（見出しは 700）、数字のみ `Inter`。オレンジ・紫系の色は使わない。

- 色をアニメーションさせる箇所（ハイライト枠、voiceprint のバー色、パン表示）は必ず `useColorScheme()`（`react-native`）からパレットを引き、`interpolateColor` の入力にする。ハードコードしない。
- **テーマ切替時**は `themeProgress`（0=light, 1=dark）を `withTiming(…, timing(duration.themeFade))` で動かし、`interpolateColor(themeProgress.value, [0, 1], [light.x, dark.x])` で背景・surface・テキスト色を 200ms クロスフェードする。Reduce Motion 時は即時切替。
- 注: 現在 `app.json` は `"userInterfaceStyle": "light"` のため OS のダークモードに追従しない。ダーク対応時に `"automatic"` へ変更する（本書の範囲外）。

```ts
export function useThemeProgress() {
  const scheme = useColorScheme();
  const p = useSharedValue(scheme === 'dark' ? 1 : 0);
  useEffect(() => { p.value = withTiming(scheme === 'dark' ? 1 : 0, timing(duration.themeFade)); }, [scheme]);
  return p;
}
```

---

## 2. コンポーネント別仕様

各項目: **トリガー / タイムライン / プロパティ / ライブラリ・API**。

### 2.0 01 はじめに: 2 つの声が重なって「マッチ」する

- **トリガー**: 01 画面のマウント時に 1 回だけ再生。完了後は idle ループに移る。
- **参照プロトタイプ**: 再生して確認できる参考実装を `design/prototypes/onboarding-match.html` に置く予定（数値は本節が正）。
- **構成**: 左の声（`voiceLeft`）と右の声（`voiceRight`）の voiceprint 2 つ。最終位置では中心をずらして重ね、重なり部分は**ライトでは `multiply`、ダークでは `screen`** で混色する。

| 時刻 (ms) | 要素 | 動き |
| --- | --- | --- |
| 0–500 | 両 voiceprint | `opacity` 0→1、`scale` 0.92→1（`easing.enter`）。初期オフセット: 左 `(-70, -30)`、右 `(+80, +90)`（最終位置からの pt） |
| 0–2300 | バー（話すリズム） | 左右が交互に話す。左が 0–450ms・900–1350ms…、右がその間に 450ms ずつ。交互の振幅は徐々に下がり、共通リズムへ寄っていく |
| 500–2300 | 位置・回転 | 最終位置へ移動（1800ms、`Easing.bezier(0.65, 0, 0.35, 1)`）。同時に逆回転: 左 +12°→0°、右 −12°→0° |
| 500–2300 | リズム | `sync` 0→1。左右の位相差を `(1 - sync) × π` に縮め、終点で同じリズムになる |
| 1800– | コピー | 見出し → サブコピー → 「声で登録する」ボタンの順。80ms 間隔、各 400ms、`translateY` 8→0 + `opacity` 0→1（`easing.enter`） |
| 2300–2900 | 共通パルス | 2 つ同時に `scale` 1→1.05→1（300ms + 300ms、`easing.standard`）。`impactAsync(ImpactFeedbackStyle.Soft)` を 2300ms で 1 回 |
| 2300–2700 | ハート | 2 つの voiceprint の交点に 36pt の `primary` 円 + 白いハートアイコンを表示。`scale` 0→1.1→1（400ms、`easing.enter`）、以後そのまま残す |
| 2900– | idle | 同期した呼吸: `scale` ±8%、2400ms 周期（`easing.breath`）。全体で 1 周 90 秒のごく遅い回転（linear）。※通常の voiceprint 呼吸（§2.1、±2.5%）とは別。01 だけの例外 |

**ブレンドの実装**
- RN の View スタイル `mixBlendMode`（New Architecture）を右の voiceprint のコンテナに指定: `mixBlendMode: scheme === 'dark' ? 'screen' : 'multiply'`。RN 0.88 / Android での描画結果は要検証。期待どおりに出ない端末では、重なり部分の不透明度を 0.85 にするフォールバックへ切り替える。
- テーマ切替時はブレンドモードを即時に切り替え、色は §1 の 200ms クロスフェードに任せる。

**Reanimated + react-native-svg スケッチ**

```tsx
import Svg, { G, Line } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming, withDelay,
  withSequence, withRepeat, Easing, useReducedMotion, ReduceMotion } from 'react-native-reanimated';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const match = Easing.bezier(0.65, 0, 0.35, 1);

function useOnboardingMatch() {
  const reduce = useReducedMotion();
  const intro = useSharedValue(0);   // 0..1  fade/scale in
  const travel = useSharedValue(0);  // 0..1  オフセット・回転 → 0
  const sync = useSharedValue(0);    // 0..1  リズム収束
  const pulse = useSharedValue(1);
  const clock = useSharedValue(0);   // リズム・呼吸用の経過時間 (ms)

  useEffect(() => {
    if (reduce) { // 最終状態をフェードのみで表示
      travel.value = 1; sync.value = 1;
      intro.value = withTiming(1, { duration: 240, reduceMotion: ReduceMotion.Never });
      return;
    }
    intro.value = withTiming(1, timing(500, easing.enter));
    travel.value = withDelay(500, withTiming(1, timing(1800, match)));
    sync.value = withDelay(500, withTiming(1, timing(1800, match)));
    pulse.value = withDelay(2300, withSequence(
      withTiming(1.05, timing(300)), withTiming(1, timing(300))));
    clock.value = withRepeat(withTiming(90_000, { duration: 90_000, easing: Easing.linear }), -1);
  }, [reduce]);
  return { intro, travel, sync, pulse, clock, reduce };
}

// 片側の voiceprint（side = -1: 左, +1: 右）
function useSideStyle(side: -1 | 1, m: ReturnType<typeof useOnboardingMatch>) {
  const from = side < 0 ? { x: -70, y: -30, r: 12 } : { x: 80, y: 90, r: -12 };
  return useAnimatedStyle(() => {
    const k = 1 - m.travel.value;
    const t = m.clock.value;
    const breath = t > 2900 ? 1 + 0.08 * Math.sin(((t - 2900) / 2400) * 2 * Math.PI) : 1;
    return {
      opacity: m.intro.value,
      transform: [
        { translateX: from.x * k }, { translateY: from.y * k },
        { rotate: `${from.r * k + (t / 90_000) * 360}deg` },  // 逆回転 + 共通の遅い回転
        { scale: (0.92 + 0.08 * m.intro.value) * m.pulse.value * breath },
      ],
    };
  });
}

// 各バーの長さ: 交互に話す → 同じリズムへ
function useBarProps(i: number, side: -1 | 1, m: ReturnType<typeof useOnboardingMatch>) {
  return useAnimatedProps(() => {
    const phase = (1 - m.sync.value) * Math.PI * (side < 0 ? 0 : 1);
    const talk = 0.5 + 0.5 * Math.sin((m.clock.value / 900) * 2 * Math.PI + phase + i * 0.35);
    const len = 10 + 18 * talk;        // pt
    return { y2: -(R + len) };         // 原点中心、G の rotate で各角度に配置
  });
}
```

- バー描画は `<Svg><G rotation={(360 / N) * i}><AnimatedLine x1={0} y1={-R} x2={0} … animatedProps={barProps} /></G></Svg>`。N=48 を左右 2 つで計 96 本。
- `clock` を共通の時計にして、リズム・呼吸・回転を 1 つの shared value から算出する（ずれ防止）。上記の `clock` は 90 秒でループし、つなぎ目で回転が 360° 戻るため見た目は連続する。呼吸の判定は初回ループのみ有効なので、実装時は `introDone` フラグで切り替えること。
- コピーは `entering={FadeInUp.delay(1800 + 80 * i).duration(400).easing(easing.enter)}`（8pt 上昇は `FadeInUp` の既定移動量と異なる場合、カスタム entering で `translateY: 8` を指定）。
- **Reduce Motion**: 最終状態（重なった位置、回転 0、同期済み）を 240ms のフェードのみで表示。リズム・パルス・呼吸・回転はすべて無効。コピーも同時にフェードのみ。
- **スクリーンリーダー**: 演出は装飾扱い。表示完了時に「Koe Match。声で登録するボタン」へフォーカスを移す。

### 2.1 Voiceprint（放射状バー + モノグラム）

人物は写真ではなく、円周上に並ぶ放射バー（既定 48 本）と中央のモノグラムで表す。左の声＝`voiceLeft`、右の声＝`voiceRight`、自分＝`text` 60%。

| 状態 | トリガー | タイムライン | プロパティ |
| --- | --- | --- | --- |
| idle 呼吸 | マウント時、再生/録音していない間 | 3600ms ループ（ease in-out sin） | 全体 `scale` 1.00↔1.025、バー `opacity` 0.72↔0.88 |
| live（録音中） | 02 の録音開始 | メーター更新ごと 120ms spring | 現在角度のバー `scaleY` を音量に追従。1 本ずつ時計回りに「確定」していく |
| playback sweep | 03/04/05 の再生中 | 再生位置に線形 | 再生済みバーは不透明度 1.0、未再生は 0.35。先端 1 本だけ `scaleY` +8% |

**02「バーが 1 本ずつ育つ」ロジック**
- `useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true })` + `useAudioRecorderState(recorder, 80)`（既定 500ms では粗いので 80ms を指定）。
- `state.durationMillis` から現在のバー index を算出（例: 1 本 = 400ms、48 本で約 19 秒で一周。超えたら 2 周目は既存バーへ max 合成）。
- `metering` を 0..1 に正規化 → 現在 index の shared value へ `withSpring(level, spring.meter)`。index が進んだら前のバーはその時点の最大値で固定。
- 正規化（暫定、要検証）: `level = clamp((metering + 60) / 60, 0, 1) ** 0.8`。無音閾値 0.06 未満は 0.06（最小長）に丸める。

```tsx
const bars = useSharedValue<number[]>(Array(48).fill(0.06));
useEffect(() => {
  if (!state.isRecording || state.metering == null) return;
  const i = Math.floor(state.durationMillis / 400) % 48;
  const level = normalize(state.metering);
  bars.modify((b) => { 'worklet'; b[i] = Math.max(b[i], level); return b; });
}, [state.durationMillis]);
// 各バー: useAnimatedStyle(() => ({ transform: [{ scaleY: withSpring(bars.value[i], spring.meter) }] }))
```

- 描画: §2.0 と同じく `react-native-svg` の `Line` を `Animated.createAnimatedComponent` で動かす。60fps を割る端末では Skia を検討（今回は追加しない）。
- **再生スイープ**: `useAudioPlayerStatus(player)` の `currentTime / duration` を `progress` shared value に `withTiming(…, { duration: 100, easing: easing.linear })` で補間（status 更新間隔の段差を埋める）。

### 2.2 マイクボタン（Voice Dock 中央）

| 状態 | 見た目 | 遷移タイムライン | Haptics |
| --- | --- | --- | --- |
| idle | 塗り `text`、アイコン `bg` | — | — |
| listening | 外周リング 2 本が音量で外側へ広がる（scale 1.0→1.0+level×0.35、opacity 0.4→0）。ボタン本体 scale 1.04 | 押下 90ms で scale 0.96 → 160ms で 1.04 | `impactAsync(ImpactFeedbackStyle.Soft)` 開始時 |
| processing | リングを止め、外周に細い弧（90°）が 1200ms/周で回る（linear） | listening→processing 160ms クロスフェード | なし |
| error | 枠を `voiceRight` に 160ms で変色、横揺れは**しない**。2 秒で idle に戻る | 160ms | `notificationAsync(NotificationFeedbackType.Warning)` |
| 成功（コマンド確定） | processing→idle 240ms | — | `notificationAsync(NotificationFeedbackType.Success)` |

- Android は Expo Haptics ドキュメントの推奨どおり `performAndroidHapticsAsync(AndroidHaptics.Confirm / Reject)` を使う（`VIBRATE` 権限不要）。
- iOS は低電力モードやカメラ使用中などで haptics が無効になる。触覚に意味を依存させず、必ず視覚+読み上げと併用。
- 色は `interpolateColor(stateProgress, …, palette)` で補間。パレットは `useColorScheme()` で切替。

### 2.3 音声コマンドトースト（「『左』を聞き取りました」）

- **トリガー**: 音声コマンド認識の確定時（全画面共通）。
- **タイムライン**: 0–160ms 出現（Voice Dock の上 12pt から `translateY` 8→0、`opacity` 0→1、`easing.enter`）/ 表示 1600ms / 退場 160ms（`opacity` →0、`easing.exit`）。連続認識時は表示中のトーストの文言を差し替え、タイマーをリセット（再出現アニメなし）。
- **API**: Reanimated Layout Animations `entering={FadeInDown.duration(160).reduceMotion(ReduceMotion.System)}` / `exiting={FadeOut.duration(160)}`。
- 同時に `AccessibilityInfo.announceForAccessibility('「左」を聞き取りました')`（§3）。

### 2.4 04 左右で聴きくらべ: L→R ハンドオフ

- **トリガー**: ラウンド開始時に自動再生。左カード音声 → 400ms の間 → 右カード音声。
- **カードハイライト**: 再生中カードの枠 1.5pt を `voiceLeft` / `voiceRight` で表示（`borderColor` を `interpolateColor`、160ms）。非再生カードは `opacity` 0.72、voiceprint は idle 呼吸のみ。
- **ハンドオフ**: 左終了 → 左枠 160ms でフェードアウト、同時にパン表示が中央を通って右へ 400ms 移動 → 右枠 160ms でフェードイン。
- **パン表示（Pan indicator）**: カード上部の細いバー（幅 64pt）上を 8pt のドットが移動。`pan` shared value（-1=左, 0=中央, +1=右）を `translateX = pan × 28` にマップし、ドット色は `interpolateColor(pan, [-1, 1], [voiceLeft, voiceRight])`。
- **音声との同期**: expo-audio にパン API がないため、アセット側で定位を作り、`pan` は再生セグメントから決める。1 ファイル方式なら `currentTime` とセグメント境界（`leftEnd`, `rightStart` 秒）から:

```ts
const pan = useDerivedValue(() => {
  const t = currentTime.value; // useAudioPlayerStatus から渡す
  if (t < leftEnd) return -1;
  if (t > rightStart) return 1;
  return interpolate(t, [leftEnd, rightStart], [-1, 1]); // 間の 400ms を補間
});
```

- イヤホン未接続時は「イヤホン推奨」ヒントを表示（パン表示自体は維持）。

### 2.5 スワイプカード（04 で選択）

- **API**: `usePanGesture` + `GestureDetector`（RNGH 3.x）。ルートを `GestureHandlerRootView` で包む（ドキュメントの例に従う）。
- **パラメータ**:

| 項目 | 値 |
| --- | --- |
| 確定しきい値（距離） | `|translationX| > 画面幅 × 0.28` |
| 確定しきい値（速度） | `|velocityX| > 800 px/s` かつ方向一致 |
| 回転 | `rotate = clamp(translationX / 画面幅 × 8°, -8°, 8°)`（上限 8°） |
| 追従中 | 選択側の voiceprint 色の枠を `opacity` 0→1（しきい値到達で 1）、到達瞬間に `selectionAsync()` を 1 回 |
| 解放（未確定） | `withSpring(0, spring.settle)` で原点へ。オーバーシュートなし |
| 解放（確定） | 速度を引き継ぎ `withTiming(±画面幅 × 1.2, timing(240, easing.exit))`、`opacity` →0、終了後に選択処理 |

```tsx
const pan = usePanGesture({
  onUpdate: (e) => { x.value = e.translationX; },
  onDeactivate: (e) => {
    const go = Math.abs(e.translationX) > W * 0.28 || Math.abs(e.velocityX) > 800;
    if (!go) { x.value = withSpring(0, spring.settle); return; }
    const dir = Math.sign(e.translationX || e.velocityX);
    x.value = withTiming(dir * W * 1.2, timing(240, easing.exit), (done) => {
      if (done) scheduleOnRN(onChoose, dir < 0 ? 'left' : 'right');
    });
  },
});
const style = useAnimatedStyle(() => ({
  transform: [{ translateX: x.value },
    { rotate: `${clamp((x.value / W) * 8, -8, 8)}deg` }],
}));
```

- `scheduleOnRN` は `react-native-worklets` 由来（Reanimated 4 で JS スレッド呼び出しに使う）。RNGH 3 のフックコールバックが UI スレッドで動くかは導入時に確認（要検証）。
- 音声で「左」「右」と言った場合も、同じ確定アニメ（fly-out）を左右方向に再生し、スワイプと結果を一致させる。

### 2.6 ラウンド遷移（04 の次ラウンド）

- **トリガー**: 選択確定後。
- **タイムライン**: 0–240ms 選ばれなかったカード `opacity` →0、`scale` →0.96 / 120–360ms 選ばれた声が中央へ移動（`spring.settle`）/ 360–600ms 次ラウンドの 2 枚が `translateY` 12→0・`opacity` 0→1（左→右に 60ms スタッガー）/ 600ms から L 再生開始。
- 上部の「Round 2/4」インジケーターはドットの塗りを 160ms で切替。

### 2.7 05 最後に残った声: Reveal シーケンス

| 時刻 (ms) | 要素 | 動き |
| --- | --- | --- |
| 0 | 背景 | `bg` → 選ばれた声の色 6% を混ぜた色へ 480ms |
| 0–480 | voiceprint | `scale` 0.86→1.0、`opacity` 0→1（`spring.gentle`） |
| 240–960 | バー | 時計回りに 1 本ずつ点灯（48 本 × 15ms スタッガー） |
| 960–1200 | モノグラム | `opacity` 0→1、`translateY` 4→0 |
| 1200–1440 | 名前・キャッチコピー | `FadeIn.duration(240)` |
| 1440 | 声の再生 | 開始 → 再生スイープ（§2.1）に移行。同時に `impactAsync(Light)` |
| 1600 | CTA | 「デートしてみる」ボタン `FadeInDown.duration(240)` |

- 全体を `withDelay(t, withTiming(…), ReduceMotion.System)` で組む。途中タップで即時に最終状態へスキップ可能にする。

### 2.8 06 仮想デート: バブル出現と文字起こしストリーミング

- **相手のバブル**: 音声再生開始と同時に出現。`entering={FadeInUp.duration(240).easing(easing.enter)}`（`translateY` 8→0）。再生中はバブル左端に小さな voiceprint（12 本）で再生スイープ。前のバブルは `LinearTransition.duration(240)` で押し上げる。
- **シーン背景**: 場面転換時のみ 480ms のクロスフェード。パララックスは使わない。
- **ユーザー返答の文字起こし（タイピング演出なし）**:
  - 認識結果が届いたら**単語/文節単位**で追加。1 文字ずつのタイプライター表示は禁止。
  - 新しく確定したチャンクは `opacity` 0.35→1 を 160ms。暫定（partial）テキストは `text` 50% の不透明度で表示し、確定時に 100% へ。
  - 行が増えたらコンテナ高さを `LinearTransition.duration(160)` で追従。スクロールは末尾に `scrollToEnd({ animated: !reduceMotion })`。
  - 02 のライブトランスクリプトも同じ規則。

### 2.9 07 ふりかえり: 思い出カードのスタック

- **初期表示**: 最大 3 枚を重ねる。奥のカードは `translateY` +8pt / +16pt、`scale` 0.97 / 0.94、`opacity` 0.9 / 0.8。0/60/120ms スタッガーで `FadeInDown.duration(240)`。
- **送る/次へ**: 先頭カードを上方向に `translateY -24`・`opacity 0`（200ms, `easing.exit`）、残りが 1 段ずつ前へ（`spring.settle`）。
- **「会ってみたい」送信**: ボタン押下 90ms scale 0.97 → 送信完了でラベルが「送りました」に 160ms クロスフェード、`notificationAsync(Success)`。紙吹雪などの祝祭演出は入れない。

### 2.10 画面遷移（Expo Router）

- `src/app/_layout.tsx` の `Stack` で設定。Expo Router Stack のドキュメントでは `animation` は **Android のみ**、`animationDuration` は **iOS のみ**（ms、既定 350）と記載されている。

| 遷移 | `animation`（Android） | iOS | 備考 |
| --- | --- | --- | --- |
| 01→02→03（オンボーディング） | `fade_from_bottom` | `animationDuration: 320` | 前進感を弱く |
| 03→04、04→05、05→06 | `fade` | `animationDuration: 320` | 声の体験を途切れさせない |
| 06→07 | `slide_from_right` | 既定 | 時間の経過 |
| Reduce Motion 時 | `none` / `fade` | — | §3 |

```tsx
<Stack screenOptions={{ headerShown: false, animation: reduce ? 'fade' : 'fade_from_bottom', animationDuration: 320 }} />
```

- Voice Dock は `_layout.tsx` 側に置き、遷移でアニメーションさせない（常駐）。

---

## 3. アクセシビリティ

### Reduce Motion
- 判定: Reanimated `useReducedMotion()`。**アプリ起動時の値で固定され、設定変更では再レンダーされない**ため、実行中の変更にも追従したい画面では `AccessibilityInfo.addEventListener('reduceMotionChanged', …)` を併用する。
- 既定動作（`ReduceMotion.System`）: `withTiming` / `withSpring` は即座に終値へ、entering/layout アニメは終点へジャンプ、exiting は省略される。これを前提に、**意味を持つ動きには代替を用意**する:

| 要素 | 代替 |
| --- | --- |
| voiceprint 呼吸 | 停止（静止） |
| live メーター | バーの長さ更新は維持（情報なので）。spring を外し即時反映、更新を 160ms 間隔に間引く |
| 再生スイープ | 維持（進捗情報）。補間なしで段階更新 |
| マイク listening リング | 広がりを止め、リングの太さ 1→3pt で音量を表す |
| L→R パン表示 | ドット移動なし。「左を再生中」「右を再生中」のラベル切替 |
| スワイプ fly-out | 120ms のフェードのみ |
| Reveal | 全要素を 240ms 一括フェードイン |
| 画面遷移 | `fade`（Android）または `none` |
| テーマ切替 | 即時 |

### スクリーンリーダー
- 音声状態の変化は `AccessibilityInfo.announceForAccessibility()` で通知:
  - listening 開始: 「聞き取っています」/ processing: 「考えています」/ error: 「聞き取れませんでした。もう一度話してください」
  - コマンド確定: 「『左』を聞き取りました」
  - 04: 「左の声を再生中」→「右の声を再生中」→「左か右を選んでください。スワイプ、または声で選べます」
  - 05: 「最後に残った声は {名前} さんです」
- マイクボタン: `accessibilityRole="button"`、`accessibilityState={{ busy: state === 'processing' }}`、`accessibilityLabel` は状態ごとに「話す」「聞き取り中、タップで停止」。
- スワイプの代替: 各カードに `accessibilityActions={[{ name: 'activate', label: 'この声を選ぶ' }]}`。ジェスチャー必須にしない。
- voiceprint は装飾扱い（`accessible={false}`）とし、モノグラム側に「{名前}、声のプロフィール」を付ける。
- ライブ文字起こし領域は `accessibilityLiveRegion="polite"`（Android）。iOS は確定文ごとに announce。

---

## 4. 追加する依存関係

Expo SDK 58 ドキュメント記載の推奨バージョン（`npx expo install` が自動解決する）:

```bash
npx expo install react-native-reanimated react-native-worklets   # Reanimated 4.7.1（worklets 必須、Babel 設定は babel-preset-expo が自動）
npx expo install react-native-gesture-handler                    # ~3.3.0
npx expo install expo-haptics                                    # ~58.0.8
npx expo install expo-router                                     # §2.10（未導入のため。導入手順は Router ドキュメント参照）
npx expo install react-native-svg                                # §2.0 / §2.1 の voiceprint バー描画
```
- `react-native-svg` は今回の Expo ドキュメント確認の対象外。バージョンは `npx expo install` の解決結果に従う。

- `expo-audio`（~58.0.12）は導入済み。録音メーターは `RecordingOptions.isMeteringEnabled: true` + `RecorderState.metering` を使用。
- `package-lock.json` があるため `npx` を使用（bun 不使用）。
- Reanimated / Gesture Handler は Expo Go 対応。expo-haptics のドキュメントは Expo Go を対応プラットフォームに挙げていないため、触覚の確認は development build（`npx expo run:ios`）で行う。
- 導入後は `npx expo lint` と `npx tsc --noEmit` を実行する。

## 5. 要検証リスト
1. `RecorderState.metering` の単位と値域（§2.1 の正規化を実機で調整）。
2. RNGH 3 の `usePanGesture` コールバックの実行スレッドと、`Gesture.Pan()` 旧 API の扱い。
3. L/R 定位済みアセットの用意方法（サーバー書き出し or 事前生成）とセグメント境界の受け渡し。
4. Android の `animationDuration` 非対応に伴う遷移時間の差異。
5. `mixBlendMode`（multiply / screen）の RN 0.88 での描画結果（§2.0）。

---

## §2.x さがす：耳スワイプ（§2 への追補）

- **プロトタイプ**: `design/prototypes/search-ear-swipe.html`（`?embed=1` で 390×844 の画面のみ + 自動デモ、`?theme=light|dark`、`?motion=reduce`、`?assets=fallback`）。タイミングはすべてファイル先頭の `MOTION` オブジェクトにまとめてあり、下表と同じ値。
- **概念**: 中央のマネキン頭部（顔・髪なし）の左耳に A さん、右耳に B さんの回答が流れる。選びたい側へスワイプすると、その側の耳が頭から外れて相手のアバターへ飛んでいく。右スワイプ = 右耳 = B さん、左スワイプ = 左耳 = A さん。
- **色**: A 側（音の弧・波形・再生中）= `blue`、B 側 = `mint`。ROUND セグメント = `yellow`、イヤホンチップ = `blue-soft` / `blue`、成功チェックとトーストのアイコン = `mint`。選択（カードの 2pt 枠）・主要アクション・マイク = rose（`primary`）。

### アセット

- `design/images/search/head-base.png` / `ear-left.png` / `ear-right.png`（1000×1000、透過、位置合わせ済み）と `layout.json`（各耳のバウンディングボックスとピボット）。
- 3 枚を同じサイズ（頭部 180pt 角）で重ね、耳だけを動かす。耳レイヤーの座標は 1000 単位 × (180 / 1000) で pt に変換する。
- ピボットが `layout.json` にない場合は、耳の内側の辺（頭の中心側）・上から 42% の位置を使う（プロトタイプの既定値）。
- 画像か `layout.json` が読めない場合、プロトタイプはインライン SVG のマネキン（同じ 1000 単位座標）に切り替わる。アプリでは画像を同梱するので、この代替は不要。

### タイミング

| フェーズ | 値 | イージング / 備考 |
| --- | --- | --- |
| 追従（リフト） | 指の動きに 1:1（`dragFullPx` 120pt で最大） | 外側へ最大 24pt 移動 + 4pt 上昇、ピボット中心に最大 12° 回転（外側の縁が上がる向き） |
| 追従中の反対側カード | `opacity` 1 → 0.45 | 選択側カードは `scale` 1 → 1.03、rose 枠 `opacity` 0 → 0.55 |
| ポップ（外れる） | 120ms、`scale` 1 → 1.12 | `easing.enter`、耳の中心を基準に拡大 |
| 飛行 | 380ms | `cubic-bezier(0.2, 0.8, 0.2, 1)`。2 次ベジェ曲線（制御点は始点と終点の中点から 70pt 上）。`scale` 1.12 → 長辺 36pt、回転 → ±14° |
| 着地 | — | アバターの内側上端の角（A は右上、B は左上、8pt 内側）。カード枠 rose 2pt、mint のチェックバッジがポップ（240ms、1 → 1.18 → 1） |
| トースト | 180ms で出現、1500ms 表示 | 「Bさんを選びました · 次のラウンドへ」（最終ラウンドは「· 結果へ」） |
| 次ラウンドまで | 1400ms | 着地完了から数える |
| 耳が外れたカードから消える | 140ms | 同時にカードの中身と質問をクロスフェード（out 140ms / in 180ms） |
| 耳が頭に戻る | 300ms、`scale` 0.85 → 1、`opacity` 0 → 1 | `easing.standard`、耳の中心を基準 |
| 未確定で離す（戻り） | 260ms | 臨界寄りスプリング（`dampingRatio` 0.82 相当、目立つオーバーシュートなし） |
| L/R 再生シミュレーション | 片側 3000ms で交互 | 再生中の側の弧・波形・カード枠を強調。確定中は一時停止し、次ラウンドで A から再開 |
| キーボード / 音声の事前リフト | 160ms / 240ms | 0 → 最大リフトまで動かしてから、スワイプと同じ確定シーケンス |
| 音声の聞き取り表示 | 700ms | 「『Bさん』を聞き取りました」トーストのあと確定へ |

### ジェスチャーしきい値

| 項目 | 値 |
| --- | --- |
| 確定（距離） | `|translationX| ≥ 90pt` |
| 確定（速度） | `|velocityX| > 0.5pt/ms`（= 500pt/s）かつ移動方向と一致、かつ `|translationX| > 8pt` |
| 方向 | `translationX > 0` → 右耳 / B さん、`< 0` → 左耳 / A さん |
| 追従の上限 | `p = clamp(translationX / 120, -1, 1)`。リフト量はこの `p` に比例 |
| 縦方向 | 縦スクロールはさせない（`activeOffsetX` で横方向のみ開始） |

§2.5 のカードスワイプ（画面幅 × 0.28 / 800px/s）より短い距離で確定する。動くのが耳という小さな対象で、カードを画面外まで投げる操作ではないため。

### 実装メモ（Reanimated 4 + Gesture Handler 3）

- 耳は頭部とは別の `Animated.Image`。3 枚の画像を同じ `width/height: 180` の絶対配置で重ね、耳レイヤーにだけ animated style を当てる。
- `transformOrigin` は `layout.json` のピボットを pt に変換した値で固定する（例: `transformOrigin: [pivot.x * k, pivot.y * k, 0]`、`k = 180 / 1000`）。ピボットは追従・ポップ・飛行で共通にし、途中で origin を切り替えない（切り替えると見た目が跳ぶ）。
- 飛行中に耳の中心を曲線上に乗せたいときは、プロトタイプと同じく中心位置 `Q`・`scale s`・回転 `θ` から平行移動を逆算する: `T = Q − P − s·R(θ)·(c − P)`（`P` = ピボット、`c` = バウンディングボックス中心）。
- 共有値: `x`（ドラッグ量）、`flight`（0 → 1）、`pop`（0 → 1）、`side`（-1 / 1）。追従中は `useAnimatedStyle` で `translateX = ±24·p`、`translateY = −4·|p|`、`rotate = ∓12°·p`。反対側カードの `opacity` は `interpolate(|p|, [0, 1], [1, 0.45])`。
- 確定: `pop.value = withTiming(1, timing(120, easing.enter), () => { flight.value = withTiming(1, { duration: 380, easing: Easing.bezier(0.2, 0.8, 0.2, 1), reduceMotion: ReduceMotion.System }, (done) => done && scheduleOnRN(onLand, side)) })`。着地先の座標はアバターの `measure()`（UI スレッド）か `onLayout` で事前に取得しておく。
- 戻り: `x.value = withSpring(0, { duration: 260, dampingRatio: 0.82, reduceMotion: ReduceMotion.System })`。§1 の原則（臨界減衰）より少しだけ柔らかいが、オーバーシュートは 1〜2% に収まる。duration ベースのスプリングは実時間が約 1.5 倍になる点に注意（§1 トークンの注記）。260ms に揃えたい場合は `withTiming(0, timing(260, easing.standard))` を使う。
- ジェスチャー: §2.5 と同じ `usePanGesture` + `GestureDetector`。`onUpdate` で `x.value = e.translationX`、`onDeactivate` で上のしきい値を判定。音声・キーボード経由の確定と同じ関数（`commit(side)`）を呼ぶ。
- 次ラウンド: `onLand` から 1400ms 後に `round` を進め、耳の共有値をリセット（`opacity` 0・`scale` 0.85 → 300ms で 1）。カードの入れ替えは §2.6 と同様に Layout Animations で行ってよい。

### 触覚（expo-haptics）

- 確定の瞬間（ポップ開始時）に `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` を 1 回。音声コマンドとキーボードでの確定でも同じタイミングで鳴らす。
- 追従中にしきい値（90pt）を越えた瞬間は `Haptics.selectionAsync()` を 1 回（§2.5 と同じ扱い。戻ってもう一度越えたらまた 1 回）。
- §4 の注記どおり、触覚の確認は development build で行う。プロトタイプは `navigator.vibrate(10)` で代用（ユーザー操作の前は呼ばない）。

### Reduce Motion

- 飛行・ポップ・事前リフトを行わない。確定したら耳を頭の位置で 120ms フェードアウトし、着地位置（36pt）に置いて 200ms でフェードイン。チェックバッジ・枠・トーストは通常どおり。
- 戻り（未確定）はスプリングではなく `withTiming(0, timing(260))`。次ラウンドで耳が戻るときは `scale` を使わず `opacity` だけ。
- 弧と波形のループアニメーションは止め、静止表示にする。
- Reanimated では各アニメーションに `reduceMotion: ReduceMotion.System` を付けたうえで、飛行の分岐は `useReducedMotion()` で JS 側でも切り替える（`ReduceMotion.System` だけだと値が即座に終点へ飛ぶだけで、フェードにはならないため）。

### 音声コマンド

1. 認識結果が現在の左右の名前（例:「Aさん」「Bさん」）に一致したら、§2.3 のトースト「『Bさん』を聞き取りました」を出し、`AccessibilityInfo.announceForAccessibility` でも読み上げる。
2. 700ms 後、該当する側に 240ms の事前リフト（0 → 最大）を再生し、スワイプと同じ `commit(side)` を呼ぶ。結果・触覚・トーストはスワイプと完全に一致させる。
3. 「左」「右」も同義として受け付けてよい（§2.5 と同じ扱い）。確定中・ラウンド切り替え中に届いたコマンドは捨てる。
4. ヒント文言「『Aさん』『Bさん』と話しかけてもOK」は、ラウンドごとに現在の 2 人の名前に差し替える。

### 要検証

- 生成された `layout.json` の実際のキー名と単位（プロトタイプはピクセル / 0〜1 正規化、`bbox` の `[x, y, w, h]` / `{x0, y0, x1, y1}` など複数の形を受け付ける）。アプリ側では読み込み時に 1 つの形へ正規化する。
- RN の `transformOrigin` を Reanimated の animated style と組み合わせたときの iOS / Android の挙動差。
- 36pt に縮んだ耳がアバター（56pt）に重なったときの見え方。実画像で確認する。
