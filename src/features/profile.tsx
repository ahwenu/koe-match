/** 回答の入力、試聴、編集と、端末内でのプロフィール承認をつなぐ。 */
import { Check, Play, Plus, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { fontFamilies, type ThemeColors, useThemeColors } from '../theme';
import type { VoiceEntry, VoiceProfile } from '../types';
import { ActionButton } from '../ui';
import { buildLocalIntroduction, removeProfileEntry, updateProfileSources } from './profile-model';
import { ProfileRecordingScreen, profileQuestionCount } from './profile-recording';
import { ProfileVoice, type ProfileVoiceApi } from './profile-voice';

export type ProfileMode = 'record' | 'review';
type ProfileScreenProps = {
  profile: VoiceProfile;
  onChange: (profile: VoiceProfile) => void;
  speak: (text: string) => void;
  generateProfile?: (profile: VoiceProfile) => Promise<string>;
  voiceApi?: ProfileVoiceApi;
  active?: boolean;
  initialMode?: ProfileMode;
  recordRequest?: number;
  onModeChange?: (mode: ProfileMode) => void;
  onApproved?: () => void;
  onBackToWelcome?: () => void;
};

const portrait = require('../../design/images/avatars/v33-you.png');
const dateLabel = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric' });
const waveform = [6, 14, 23, 14, 28, 20, 10, 22, 12, 6];

/** 保存した回答の冒頭を、内容を推測せずにチップに表示する。 */
function entryExcerpt(text: string) {
  const sentence = text.trim().split(/[。！？!?、\n]/u).find(Boolean) ?? text.trim();
  const characters = Array.from(sentence);
  return characters.length > 12 ? characters.slice(0, 12).join('') + '…' : sentence;
}

/** 入力画面は必要なときだけ開き、マイページではプロフィールを先に見せる。 */
export default function ProfileScreen({
  profile,
  onChange,
  speak,
  generateProfile,
  voiceApi,
  active = true,
  initialMode = 'review',
  recordRequest = 0,
  onModeChange,
  onApproved,
  onBackToWelcome,
}: ProfileScreenProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [mode, setMode] = useState<ProfileMode>(initialMode);
  const [firstQuestion, setFirstQuestion] = useState(initialMode === 'record');
  const [selectedKind, setSelectedKind] = useState<VoiceEntry['kind']>('intro');
  const [entryText, setEntryText] = useState('');
  const [focusTranscript, setFocusTranscript] = useState(false);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationNote, setGenerationNote] = useState('');
  const generationId = useRef(0);
  const processedRequest = useRef(0);
  const needsRefresh = profile.introductionReview?.stale === true;
  const playable = !!profile.introduction.trim() && !needsRefresh;
  const answers = Math.min(profile.entries.length, profileQuestionCount);
  const chipColors = [
    [colors.blueSoft, colors.blueText],
    [colors.mintSoft, colors.mintText],
    [colors.yellowSoft, colors.yellowText],
  ];

  useEffect(() => () => {
    generationId.current += 1;
  }, []);

  useEffect(() => {
    if (!active || processedRequest.current === recordRequest) return;
    const open = setTimeout(() => {
      processedRequest.current = recordRequest;
      generationId.current += 1;
      setGenerating(false);
      setFirstQuestion(false);
      setFocusTranscript(true);
      setMode('record');
    }, 0);
    return () => clearTimeout(open);
  }, [active, recordRequest]);

  useEffect(() => {
    if (active) onModeChange?.(mode);
  }, [active, mode, onModeChange]);

  /** 種類と本文を一緒に保存し、最初の回答から端末内の下書きを用意する。 */
  function saveAnswer() {
    const text = entryText.trim();
    Keyboard.dismiss();
    if (text) {
      const createdAt = Date.now();
      const entry = { id: `${createdAt}-${Math.random().toString(36).slice(2)}`, text, kind: selectedKind, createdAt };
      let next = updateProfileSources(profile, { entries: [entry, ...profile.entries] });
      if (!profile.introduction) {
        next = {
          ...next,
          introduction: buildLocalIntroduction(next),
          introductionReview: { source: 'generated', stale: false },
        };
      }
      onChange(next);
      setEntryText('');
      setGenerationNote('');
    }
    setFirstQuestion(false);
    setMode('review');
  }

  /** 追加画面に移る。保存前の回答は画面を移動しても残す。 */
  function openRecording() {
    if (generating) return;
    setFirstQuestion(false);
    setFocusTranscript(false);
    setMode('record');
  }

  /** 初回だけ歓迎画面に戻し、追加入力からは確認へ戻る。 */
  function exitRecording() {
    Keyboard.dismiss();
    if (firstQuestion && onBackToWelcome) {
      onBackToWelcome();
      return;
    }
    setMode('review');
  }

  /** 削除した回答が自動生成文に残らないよう、レビューを更新する。 */
  function removeEntry(id: string) {
    const next = removeProfileEntry(profile, id);
    onChange(next);
    setGenerationNote(profile.introduction && !next.introduction
      ? '記録を削除したため、自動生成した下書きも消去しました。'
      : '');
  }

  /** 端末内で草案を作り、明示的に選ばれた場合だけAIを呼び出す。 */
  async function prepareIntroduction(useAi: boolean) {
    if (!profile.entries.length || generating) return;
    const currentGeneration = ++generationId.current;
    let introduction = buildLocalIntroduction(profile);
    let note = '';
    Keyboard.dismiss();

    if (useAi && generateProfile) {
      setGenerating(true);
      setGenerationNote('');
      try {
        const generated = (await generateProfile(profile)).trim();
        if (!generated) throw new Error('No introduction generated');
        introduction = generated;
      } catch {
        note = 'AI生成に接続できなかったため、記録から端末内で下書きを作りました。';
      }
    }

    if (currentGeneration !== generationId.current) return;
    onChange({
      ...profile,
      introduction,
      approved: false,
      introductionReview: { source: 'generated', stale: false },
    });
    setGenerating(false);
    setGenerationNote(note);
  }

  /** 試聴と同じ本文を端末のプロフィールとして承認する。 */
  function approveProfile() {
    if (!playable || generating) return;
    Keyboard.dismiss();
    onChange({ ...profile, approved: !profile.approved });
    if (!profile.approved) onApproved?.();
  }

  if (mode === 'record') {
    return active ? (
      <ProfileRecordingScreen
        step={profile.entries.length}
        kind={selectedKind}
        text={entryText}
        focusTranscript={focusTranscript}
        onChangeKind={setSelectedKind}
        onChangeText={setEntryText}
        onBack={exitRecording}
        onNext={saveAnswer}
      />
    ) : null;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.screen}
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>あなたのプロフィール</Text>
        <View style={styles.subtitleRow}>
          <View style={styles.mintBadge}>
            <Sparkles color={colors.mintText} size={12} />
            <Text style={styles.mintBadgeLabel}>{voiceApi?.enrolled ? 'AI' : '音声'}</Text>
          </View>
          <Text style={styles.subtitle}>
            {voiceApi?.enrolled ? '分身が、あなたの声で自己紹介します' : 'あなたの紹介文を合成音声で試聴できます'}
          </Text>
        </View>
      </View>

      <View style={styles.voiceCard}>
        <View style={styles.portraitFrame}>
          <Image source={portrait} style={styles.portrait} />
          <View style={styles.portraitBadge}>
            <Sparkles color={colors.mintText} size={13} />
            <Text style={styles.mintBadgeLabel}>{profile.approved ? 'プロフィール承認済み' : 'プロフィール確認'}</Text>
          </View>
        </View>
        <View style={styles.voiceBody}>
          <View style={styles.voiceMetadata}>
            <Text style={styles.name} numberOfLines={2}>{profile.name.trim() || 'あなた'}</Text>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.waves}>
              {waveform.map((height, index) => <View key={index} style={[styles.wave, { height }]} />)}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="合成音声で試聴"
            accessibilityState={{ disabled: !playable || generating }}
            disabled={!playable || generating}
            onPress={() => {
              Keyboard.dismiss();
              speak(profile.introduction.trim());
            }}
            style={({ pressed }) => [
              styles.play,
              pressed && styles.pressed,
              (!playable || generating) && styles.disabled,
            ]}
          >
            <Play size={16} fill={colors.blueText} color={colors.blueText} />
            <Text style={styles.playLabel}>試聴</Text>
          </Pressable>
        </View>
        {profile.introduction.trim() && !editing ? (
          <Text selectable style={styles.introduction}>{profile.introduction.trim()}</Text>
        ) : null}
      </View>

      <View style={styles.learned}>
        <View style={styles.sectionHeading}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {voiceApi?.enrolled ? '分身が覚えたこと' : '記録したこと'}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setEditing(!editing)} style={styles.editButton}>
            <Text style={styles.editLabel}>{editing ? '編集を閉じる' : '編集'}</Text>
          </Pressable>
        </View>
        <View style={styles.chips}>
          {profile.entries.slice(0, 4).map((entry, index) => {
            const [backgroundColor, color] = chipColors[index % chipColors.length];
            return (
              <View key={entry.id} style={[styles.chip, { backgroundColor }]}>
                <Text style={[styles.chipLabel, { color }]}>{entryExcerpt(entry.text)}</Text>
              </View>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: generating }}
            disabled={generating}
            onPress={openRecording}
            style={[styles.chip, styles.addChip, generating && styles.disabled]}
          >
            <Plus size={14} color={colors.accentDark} />
            <Text style={styles.addChipLabel}>話して追加</Text>
          </Pressable>
        </View>
      </View>

      {editing ? (
        <View style={styles.editor}>
          <Text style={styles.sectionTitle}>呼び名</Text>
          <TextInput
            accessibilityLabel="呼び名"
            style={styles.nameInput}
            editable={!generating}
            value={profile.name}
            onChangeText={(name) => onChange(updateProfileSources(profile, { name }))}
            maxLength={40}
            placeholder="例：はる"
            placeholderTextColor={colors.muted}
            selectionColor={colors.primary}
            autoComplete="off"
          />
          <Text style={styles.sectionTitle}>紹介文</Text>
          <TextInput
            accessibilityLabel="プロフィールの下書き"
            style={styles.entryInput}
            multiline
            maxLength={1200}
            editable={!generating}
            value={profile.introduction}
            placeholder="話した内容をもとに、紹介文を作れます。"
            placeholderTextColor={colors.muted}
            selectionColor={colors.primary}
            onChangeText={(introduction) => onChange({
              ...profile,
              introduction,
              approved: false,
              introductionReview: { source: 'edited', stale: false },
            })}
            textAlignVertical="top"
          />
          <ActionButton
            label={profile.introduction ? '端末内で下書きを作り直す' : '端末内で下書きを作る'}
            onPress={() => void prepareIntroduction(false)}
            variant="secondary"
            disabled={!profile.entries.length || generating}
          />
          {generateProfile ? (
            <>
              <Text style={styles.hint}>AIで下書きを作ると、呼び名と記録を設定済みサーバー経由でOpenAIに送ります。</Text>
              <ActionButton
                label={generating ? 'AIで下書きを作成中…' : 'AIで下書きを作る'}
                onPress={() => void prepareIntroduction(true)}
                variant="secondary"
                disabled={!profile.entries.length || generating}
              />
            </>
          ) : null}
          {profile.entries.length > 0 ? (
            <>
              <Text accessibilityRole="header" style={styles.sectionTitle}>保存した記録</Text>
              {profile.entries.map((entry) => (
                <View key={entry.id} style={styles.savedEntry}>
                  <View style={styles.sectionHeading}>
                    <Text style={styles.hint}>
                      {entry.kind === 'intro' ? '自己紹介' : '今日の出来事'}・{dateLabel.format(entry.createdAt)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`記録を削除: ${entry.text.slice(0, 24)}`}
                      disabled={generating}
                      onPress={() => removeEntry(entry.id)}
                      style={styles.editButton}
                    >
                      <Text style={styles.editLabel}>削除</Text>
                    </Pressable>
                  </View>
                  <Text selectable style={styles.savedText}>{entry.text}</Text>
                </View>
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.progressCard}>
        <View style={styles.progressHeading}>
          <Text style={styles.progressLabel}>回答の記録</Text>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="回答の記録"
            accessibilityValue={{ min: 0, max: profileQuestionCount, now: answers }}
            style={styles.segments}
          >
            {Array.from({ length: profileQuestionCount }, (_, index) => (
              <View key={index} style={[styles.segment, index < answers && styles.segmentActive]} />
            ))}
          </View>
          <Text style={styles.score}>{answers}/{profileQuestionCount}</Text>
        </View>
        <Text style={styles.hint}>
          {answers === 0 ? '回答を追加すると、紹介文の下書きができます。'
            : answers < profileQuestionCount ? `あと${profileQuestionCount - answers}問で、質問ひとまわり。`
              : '回答はいつでも追加・編集できます。'}
        </Text>
      </View>

      {generationNote ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{generationNote}</Text> : null}
      {needsRefresh ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>回答や呼び名が変わりました。編集から紹介文を更新してください。</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !playable || generating }}
        disabled={!playable || generating}
        onPress={approveProfile}
        style={({ pressed }) => [
          styles.approve,
          profile.approved && styles.approved,
          pressed && styles.pressed,
          (!playable || generating) && styles.disabled,
        ]}
      >
        <Check size={18} color={profile.approved ? colors.ink : colors.onPrimary} />
        <Text style={profile.approved ? styles.approvedLabel : styles.approveLabel}>
          {profile.approved ? '承認を取り消す' : 'このプロフィールを承認'}
        </Text>
      </Pressable>
      {profile.approved ? (
        <Text accessibilityLiveRegion="polite" style={[styles.hint, styles.approvalStatus]}>承認済み・この端末に保存</Text>
      ) : null}

      {voiceApi && active && Platform.OS === 'ios' ? (
        <ProfileVoice api={voiceApi} introduction={needsRefresh ? '' : profile.introduction} />
      ) : null}
    </ScrollView>
  );
}

/** Pen のカード、セマンティックカラー、角丸を端末のテーマに合わせる。 */
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 20 },
    header: { gap: 6 },
    title: { color: colors.ink, fontFamily: fontFamilies.bodyBold, fontSize: 24, lineHeight: 35 },
    subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    subtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21, flexShrink: 1 },
    mintBadge: {
      flexDirection: 'row', gap: 4, alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999,
      backgroundColor: colors.mintSoft, paddingHorizontal: 7, paddingVertical: 3,
    },
    mintBadgeLabel: { color: colors.mintText, fontFamily: fontFamilies.bodyBold, fontSize: 11, lineHeight: 16 },
    voiceCard: {
      backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line,
      borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', boxShadow: '0px 8px 24px #1f1a1d14',
    },
    portraitFrame: { height: 200, backgroundColor: colors.primarySoft },
    portrait: { width: '100%', height: '100%', resizeMode: 'cover' },
    portraitBadge: {
      position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 5,
      alignItems: 'center', backgroundColor: colors.mintSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    },
    voiceBody: {
      paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between',
      flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    voiceMetadata: { flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
    name: { color: colors.ink, fontFamily: fontFamilies.bodyBold, fontSize: 18, lineHeight: 26, flexShrink: 1 },
    waves: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 30 },
    wave: { backgroundColor: colors.blue, width: 3, borderRadius: 2 },
    play: {
      minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.blueSoft,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    playLabel: { color: colors.blueText, fontFamily: fontFamilies.bodyBold, fontSize: 13 },
    introduction: { color: colors.ink, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 23, paddingHorizontal: 16, paddingBottom: 15 },
    learned: { gap: 3 },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    sectionTitle: { color: colors.ink, fontFamily: fontFamilies.bodyBold, fontSize: 16, lineHeight: 23 },
    editButton: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
    editLabel: { color: colors.accentDark, fontFamily: fontFamilies.bodyBold, fontSize: 13 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4 },
    chipLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 13, lineHeight: 19 },
    addChip: { borderColor: colors.accentDark, borderStyle: 'dashed', borderWidth: 1, minHeight: 44, paddingHorizontal: 12 },
    addChipLabel: { color: colors.accentDark, fontFamily: fontFamilies.bodyBold, fontSize: 13 },
    progressCard: {
      gap: 7, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 20, padding: 16, borderCurve: 'continuous',
    },
    progressHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    progressLabel: { color: colors.ink, fontFamily: fontFamilies.bodyBold, fontSize: 13 },
    segments: { flex: 1, flexDirection: 'row', gap: 4 },
    segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line },
    segmentActive: { backgroundColor: colors.mint },
    score: { color: colors.mintText, fontFamily: fontFamilies.numbers, fontSize: 12 },
    hint: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 20 },
    approvalStatus: { textAlign: 'center', marginTop: -10 },
    approve: {
      backgroundColor: colors.primary, minHeight: 56, borderRadius: 28, paddingHorizontal: 16, paddingVertical: 10,
      flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center',
    },
    approved: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
    approveLabel: { color: colors.onPrimary, fontFamily: fontFamilies.bodyBold, fontSize: 15, textAlign: 'center', flexShrink: 1 },
    approvedLabel: { color: colors.ink, fontFamily: fontFamilies.bodyBold, fontSize: 15, textAlign: 'center', flexShrink: 1 },
    pressed: { opacity: 0.75 },
    disabled: { opacity: 0.48 },
    editor: {
      backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 24,
      borderCurve: 'continuous', padding: 16, gap: 12,
    },
    nameInput: {
      backgroundColor: colors.background, borderColor: colors.line, borderWidth: 1, borderRadius: 12,
      color: colors.ink, fontFamily: fontFamilies.body, fontSize: 16, minHeight: 46, paddingHorizontal: 12,
    },
    entryInput: {
      minHeight: 106, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line,
      borderRadius: 12, padding: 12, color: colors.ink, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24,
    },
    savedEntry: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
    savedText: { color: colors.ink, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 23 },
  });
}
