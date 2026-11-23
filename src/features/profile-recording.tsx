/** 質問を見ながら、Aqua Voiceの文字起こしや短い練習録音を行う。 */
import { ArrowLeft, ArrowRight, Captions, MessageCircle, Mic, Pause, Play, RotateCcw, Square } from 'lucide-react-native';
import { type ComponentRef, useRef } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { fontFamilies, type ThemeColors, useThemeColors } from '../theme';
import type { VoiceEntry } from '../types';
import { practiceSeconds, usePracticeRecording } from './profile-voice';

const questions = [
  '休みの日は、どんなふうに過ごしてる？',
  '最近、夢中になっていることは？',
  '好きな場所は、どんなところ？',
  '大切にしている時間はある？',
  'どんな話を一緒にしてみたい？',
] as const;
export const profileQuestionCount = questions.length;
const restingBars = [
  14, 22, 34, 26, 48, 38, 20, 30, 56, 44, 28, 18, 36, 52, 40, 24, 16, 30, 46, 34,
  26, 40, 22, 14, 30, 20, 26, 16, 22, 12, 18, 24, 14, 20, 12, 16, 10, 14, 10, 8,
];

type Props = {
  step: number;
  kind: VoiceEntry['kind'];
  text: string;
  focusTranscript: boolean;
  onChangeKind: (kind: VoiceEntry['kind']) => void;
  onChangeText: (text: string) => void;
  onBack: () => void;
  onNext: () => void;
};

/** 録音中は、文字入力と独立した時間と音量を表示する。 */
export function ProfileRecordingScreen({
  step, kind, text, focusTranscript, onChangeKind, onChangeText, onBack, onNext,
}: Props) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const recording = usePracticeRecording();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const questionIndex = step % questions.length;
  const isRecording = recording.phase === 'recording';
  const isBusy = recording.phase !== 'idle';
  const changeInProgress = isBusy && !isRecording;
  const activeBars = Math.ceil(restingBars.length * recording.seconds / practiceSeconds);
  const meter = recording.metering;
  const meterScale = isRecording && typeof meter === 'number'
    ? 0.55 + Math.min(1, Math.max(0, (meter + 56) / 56)) * 0.5
    : 1;
  const label = isRecording ? '録音中'
    : recording.phase === 'starting' ? '録音を準備中…'
      : recording.phase === 'stopping' ? '録音を確認中…'
        : recording.sample ? '練習録音あり' : '練習録音';
  const recordLabel = recording.supported ? isRecording ? '録音を終了' : '録音を開始' : '文字起こしの入力欄を開く';
  const hint = Platform.OS === 'ios'
    ? '文字起こし欄の地球儀キーからAqua Voiceに切り替えます。'
    : 'キーボードの音声入力、または手入力で回答できます。';

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="前の画面に戻る" style={styles.back}>
          <ArrowLeft size={20} color={colors.ink} />
        </Pressable>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="プロフィールの質問番号"
          accessibilityValue={{ min: 0, max: questions.length, now: questionIndex + 1 }}
          style={styles.steps}
        >
          {questions.map((question, index) => (
            <View key={question} style={[styles.step, index <= questionIndex && styles.stepActive]} />
          ))}
        </View>
        <Text importantForAccessibility="no" style={styles.count}>{questionIndex + 1}/{questions.length}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <View style={styles.questionBadge}>
            <MessageCircle size={12} color={colors.yellowText} />
            <Text style={styles.questionBadgeLabel}>質問</Text>
          </View>
          <View style={styles.kinds} accessibilityRole="tablist">
            <Pressable
              onPress={() => onChangeKind('intro')}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === 'intro' }}
              style={styles.kind}
            >
              <Text style={[styles.kindLabel, kind === 'intro' && styles.kindActive]}>自己紹介</Text>
            </Pressable>
            <Pressable
              onPress={() => onChangeKind('diary')}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === 'diary' }}
              style={styles.kind}
            >
              <Text style={[styles.kindLabel, kind === 'diary' && styles.kindActive]}>今日の出来事</Text>
            </Pressable>
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.question}>
          {kind === 'intro' ? questions[questionIndex] : '今日はどんなことがありましたか？'}
        </Text>
      </View>

      {recording.supported ? (
        <View style={styles.recording}>
          <View style={styles.recStatus}>
            <View style={[styles.dot, (isRecording || recording.sample) && styles.dotActive]} />
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.recordingLabel, isRecording && styles.recordingActive]}
            >
              {label}
            </Text>
          </View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.bars}>
            {restingBars.map((bar, index) => (
              <View
                key={index}
                style={[
                  styles.bar,
                  {
                    height: Math.round(bar * (index <= activeBars ? meterScale : 1)),
                    backgroundColor: index < activeBars ? colors.primary : colors.line,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.timer}>
            <Text style={styles.elapsed}>0:{String(recording.seconds).padStart(2, '0')}</Text>
            <Text style={styles.total}>/ 0:30</Text>
          </View>
          {recording.sample ? (
            <Pressable onPress={recording.togglePlayback} accessibilityRole="button" style={styles.playback}>
              {recording.playing ? <Pause color={colors.blueText} size={15} /> : <Play color={colors.blueText} size={15} />}
              <Text style={styles.playbackLabel}>{recording.playing ? '試聴を停止' : '録音を試聴'}</Text>
            </Pressable>
          ) : null}
          {recording.message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{recording.message}</Text> : null}
        </View>
      ) : null}

      <View style={[styles.card, styles.transcriptCard]}>
        <Pressable
          accessibilityLabel="文字起こしを入力"
          accessibilityRole="button"
          disabled={isBusy}
          onPress={() => input.current?.focus()}
          hitSlop={8}
          style={({ pressed }) => [styles.transcriptBadge, (isBusy || pressed) && styles.faded]}
        >
          <Captions size={14} color={colors.blueText} />
          <Text style={styles.transcriptBadgeLabel}>文字起こし</Text>
        </Pressable>
        <TextInput
          ref={input}
          accessibilityLabel={kind === 'intro' ? '自己紹介の記録' : '今日の出来事の記録'}
          value={text}
          onChangeText={onChangeText}
          autoFocus={focusTranscript}
          style={styles.input}
          placeholder={kind === 'intro' ? '休日は本を読んだり、喫茶店に行ったりします。' : '帰り道に新しいパン屋を見つけました。'}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          editable={!isBusy}
          multiline
          maxLength={1200}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isBusy }}
          disabled={isBusy}
          onPress={() => {
            recording.clear();
            onChangeText('');
            if (!recording.supported) input.current?.focus();
          }}
          style={({ pressed }) => [styles.sideControl, (isBusy || pressed) && styles.faded]}
        >
          <View style={styles.controlCircle}><RotateCcw size={21} color={colors.ink} /></View>
          <Text style={styles.controlLabel}>言い直す</Text>
        </Pressable>
        <View style={styles.halo}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recordLabel}
            accessibilityState={{ disabled: changeInProgress }}
            disabled={changeInProgress}
            onPress={() => {
              if (!recording.supported) {
                input.current?.focus();
              } else if (isRecording) {
                void recording.stop();
              } else {
                Keyboard.dismiss();
                void recording.start();
              }
            }}
            style={({ pressed }) => [styles.record, (changeInProgress || pressed) && styles.faded]}
          >
            {isRecording
              ? <Square size={24} fill={colors.onPrimary} color={colors.onPrimary} />
              : <Mic size={28} color={colors.onPrimary} />}
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isBusy }}
          disabled={isBusy}
          onPress={onNext}
          style={({ pressed }) => [styles.sideControl, (isBusy || pressed) && styles.faded]}
        >
          <View style={styles.controlCircle}><ArrowRight size={21} color={colors.ink} /></View>
          <Text style={styles.controlLabel}>次へ</Text>
        </Pressable>
      </View>
      <View style={styles.hintArea}>
        <Mic size={14} color={colors.accentDark} />
        <Text style={styles.hint}>{hint}</Text>
      </View>
      {recording.sample ? <Text style={styles.temporary}>練習録音はこの画面を離れると消えます。</Text> : null}
    </ScrollView>
  );
}

/** 見出し、入力欄、録音状態を現在のテーマに合わせる。 */
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { gap: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
    topBar: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 44 },
    back: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface,
      borderColor: colors.line, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center',
    },
    steps: { flex: 1, flexDirection: 'row', gap: 6 },
    step: { backgroundColor: colors.line, height: 6, borderRadius: 3, flex: 1 },
    stepActive: { backgroundColor: colors.yellow },
    count: { color: colors.muted, fontFamily: fontFamilies.numbers, fontSize: 14 },
    card: {
      gap: 11, padding: 20, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, boxShadow: '0px 8px 24px #1f1a1d10',
    },
    cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
    questionBadge: {
      backgroundColor: colors.yellowSoft, borderRadius: 999, flexDirection: 'row', gap: 6,
      paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', alignSelf: 'flex-start',
    },
    questionBadgeLabel: { color: colors.yellowText, fontFamily: fontFamilies.bodyBold, fontSize: 12 },
    kinds: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
    kind: { minHeight: 44, justifyContent: 'center' },
    kindLabel: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 11 },
    kindActive: { color: colors.accentDark, fontFamily: fontFamilies.bodyBold },
    question: { color: colors.ink, fontFamily: fontFamilies.bodyBold, fontSize: 22, lineHeight: 32 },
    recording: { alignItems: 'center', gap: 13, paddingVertical: 6 },
    recStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
    dotActive: { backgroundColor: colors.primary },
    recordingLabel: { color: colors.muted, fontFamily: fontFamilies.bodyBold, fontSize: 13 },
    recordingActive: { color: colors.accentDark },
    bars: { width: '100%', paddingHorizontal: 10, height: 70, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center' },
    bar: { flex: 1, maxWidth: 5, borderRadius: 3 },
    timer: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    elapsed: { color: colors.ink, fontFamily: fontFamilies.numbers, fontSize: 20, fontVariant: ['tabular-nums'] },
    total: { color: colors.muted, fontFamily: fontFamilies.numbers, fontSize: 14 },
    playback: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 22, backgroundColor: colors.blueSoft },
    playbackLabel: { color: colors.blueText, fontFamily: fontFamilies.bodyBold, fontSize: 12 },
    message: { color: colors.accentDark, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 20, textAlign: 'center' },
    transcriptCard: { padding: 18, gap: 9 },
    transcriptBadge: {
      backgroundColor: colors.blueSoft, borderRadius: 999, alignSelf: 'flex-start',
      paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    transcriptBadgeLabel: { color: colors.blueText, fontFamily: fontFamilies.bodyBold, fontSize: 12 },
    input: { minHeight: 61, color: colors.ink, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 25, padding: 0 },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
    sideControl: { alignItems: 'center', gap: 6, minWidth: 72, minHeight: 56 },
    controlCircle: {
      width: 48, height: 48, borderRadius: 24, borderColor: colors.line, borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    },
    controlLabel: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, textAlign: 'center' },
    halo: { width: 100, height: 100, backgroundColor: colors.primarySoft, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
    record: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    faded: { opacity: 0.5 },
    hintArea: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
    hint: { color: colors.muted, fontFamily: fontFamilies.body, flexShrink: 1, fontSize: 12, lineHeight: 19, textAlign: 'center' },
    temporary: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: -12 },
  });
}
