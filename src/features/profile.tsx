/** Lets the user collect dictated notes and review a spoken profile before approval. */

import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '../theme';
import type { VoiceEntry, VoiceProfile } from '../types';
import { ActionButton, ScreenIntro } from '../ui';
import { buildLocalIntroduction, removeProfileEntry, updateProfileSources } from './profile-model';
import { ProfileVoice, type ProfileVoiceApi } from './profile-voice';

type ProfileScreenProps = {
  profile: VoiceProfile;
  onChange: (profile: VoiceProfile) => void;
  speak: (text: string) => void;
  generateProfile?: (profile: VoiceProfile) => Promise<string>;
  voiceApi?: ProfileVoiceApi;
  active?: boolean;
};

const entryKinds: readonly { id: VoiceEntry['kind']; label: string }[] = [
  { id: 'intro', label: '自己紹介' },
  { id: 'diary', label: '今日の出来事' },
];

const waveform = [6, 14, 23, 14, 28, 20, 10, 22, 12, 6];
const dateLabel = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric' });

/** Renders a native text entry for Aqua Voice and a locally approved profile preview. */
export default function ProfileScreen({
  profile,
  onChange,
  speak,
  generateProfile,
  voiceApi,
  active = true,
}: ProfileScreenProps) {
  const [selectedKind, setSelectedKind] = useState<VoiceEntry['kind']>('intro');
  const [entryText, setEntryText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationNote, setGenerationNote] = useState('');
  const needsRefresh = profile.introductionReview?.stale === true;
  const generationId = useRef(0);

  useEffect(() => () => {
    generationId.current += 1;
  }, []);

  /** Commits a confirmed transcription or typed note for later profile generation. */
  function addEntry() {
    const text = entryText.trim();
    if (!text) return;

    const createdAt = Date.now();
    const id = `${createdAt}-${Math.random().toString(36).slice(2)}`;
    const entry = { id, text, kind: selectedKind, createdAt };
    onChange(updateProfileSources(profile, { entries: [entry, ...profile.entries] }));
    setEntryText('');
    setGenerationNote('');
    Keyboard.dismiss();
  }

  /** Drops a source entry and requires review before the existing draft can be approved again. */
  function removeEntry(id: string) {
    const next = removeProfileEntry(profile, id);
    onChange(next);
    setGenerationNote(profile.introduction && !next.introduction
      ? '記録を削除したため、自動生成した下書きも消去しました。'
      : '');
  }

  /** Generates a draft from confirmed records, with an offline result when generation is unavailable. */
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

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.screen}
    >
      <ScreenIntro
        title="声でプロフィール"
        subtitle="話した言葉を記録して、自分らしい紹介をつくりましょう。"
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">話して記録する</Text>
        <Text style={styles.hint}>
          iPhoneの地球儀キーからAqua Voiceキーボードに切り替え、マイクを押して話します。
        </Text>
        <Text style={styles.label}>呼び名</Text>
        <TextInput
          accessibilityLabel="呼び名"
          style={styles.nameInput}
          editable={!generating}
          value={profile.name}
          onChangeText={(name) => onChange(updateProfileSources(profile, { name }))}
          maxLength={40}
          placeholder="例：はる"
          placeholderTextColor={colors.muted}
          autoComplete="off"
        />
        <View style={styles.kindPicker} accessibilityRole="tablist">
          {entryKinds.map(({ id, label }) => (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedKind === id }}
              onPress={() => setSelectedKind(id)}
              style={[styles.kindButton, selectedKind === id && styles.kindSelected]}
            >
              <Text style={[styles.kindText, selectedKind === id && styles.kindTextSelected]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          accessibilityLabel={selectedKind === 'intro' ? '自己紹介の記録' : '今日の出来事の記録'}
          style={styles.entryInput}
          editable={!generating}
          value={entryText}
          onChangeText={setEntryText}
          multiline
          maxLength={1200}
          placeholder={selectedKind === 'intro'
            ? '休日は本を読んだり、気になったカフェに行ったりします。'
            : '帰り道に新しいパン屋を見つけました。クロワッサンがおいしかったです。'}
          placeholderTextColor={colors.muted}
          textAlignVertical="top"
        />
        <ActionButton label="発話を記録に追加" onPress={addEntry} disabled={!entryText.trim() || generating} />
      </View>

      <View style={[styles.card, styles.previewCard]}>
        <View style={styles.previewHeader}>
          <View style={styles.previewHeaderText}>
            <Text accessibilityRole="header" style={styles.cardTitle}>プロフィールを試聴</Text>
            <Text style={styles.hint}>自分で確認してから承認できます。</Text>
          </View>
          <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.waves}>
            {waveform.map((height, index) => (
              <View key={index} style={[styles.bar, { height }]} />
            ))}
          </View>
        </View>
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
        {generationNote ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{generationNote}</Text> : null}
        {needsRefresh ? (
          <Text accessibilityLiveRegion="polite" style={styles.hint}>
            記録や呼び名が変わりました。作り直すか、下書きに変更を反映してください。
          </Text>
        ) : null}
        {profile.introduction || profile.approved || needsRefresh ? (
          <>
            <TextInput
              accessibilityLabel="プロフィールの下書き"
              style={styles.entryInput}
              multiline
              maxLength={1200}
              editable={!generating}
              value={profile.introduction}
              onChangeText={(introduction) => {
                onChange({
                  ...profile,
                  introduction,
                  approved: false,
                  introductionReview: { source: 'edited', stale: false },
                });
              }}
              textAlignVertical="top"
            />
            <ActionButton
              label="合成音声で試聴"
              variant="secondary"
              onPress={() => {
                Keyboard.dismiss();
                speak(profile.introduction.trim());
              }}
              disabled={!profile.introduction.trim() || generating}
            />
            <Text style={styles.hint}>端末の合成音声で再生します。</Text>
            <ActionButton
              label={profile.approved ? '承認を取り消す' : '紹介文を承認する'}
              variant={profile.approved ? 'secondary' : 'primary'}
              onPress={() => {
                Keyboard.dismiss();
                onChange({ ...profile, approved: !profile.approved });
              }}
              disabled={!profile.introduction.trim() || generating || needsRefresh}
            />
            {profile.approved ? (
              <Text accessibilityLiveRegion="polite" style={styles.hint}>承認済み・この端末に保存</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.hint}>記録を１件追加すると、紹介の下書きを作れます。</Text>
        )}
      </View>

      {voiceApi && active && Platform.OS === 'ios' ? (
        <ProfileVoice api={voiceApi} introduction={needsRefresh ? '' : profile.introduction} />
      ) : null}

      {profile.entries.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">保存した記録</Text>
          {profile.entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.entryHeader}>
                <Text style={styles.label}>
                  {entry.kind === 'intro' ? '自己紹介' : '今日の出来事'}・{dateLabel.format(entry.createdAt)}
                </Text>
                <Pressable
                  accessibilityLabel={`記録を削除: ${entry.text.slice(0, 24)}`}
                  accessibilityRole="button"
                  disabled={generating}
                  onPress={() => removeEntry(entry.id)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteText}>削除</Text>
                </Pressable>
              </View>
              <Text selectable style={styles.savedText}>{entry.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 18,
    gap: 12,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '700',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  nameInput: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.ink,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  kindPicker: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    backgroundColor: colors.background,
    borderRadius: 14,
  },
  kindButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 11,
  },
  kindSelected: { backgroundColor: colors.lilac },
  kindText: { color: colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  kindTextSelected: { color: colors.accentDark },
  entryInput: {
    minHeight: 106,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
  },
  previewCard: { backgroundColor: colors.peach },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  previewHeaderText: { flexShrink: 1, gap: 4 },
  waves: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  bar: { width: 3, borderRadius: 2, backgroundColor: colors.accent },
  entryRow: {
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 4,
    gap: 2,
  },
  entryHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between' },
  deleteButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.accentDark, fontSize: 13, fontWeight: '600' },
  savedText: { color: colors.ink, fontSize: 15, lineHeight: 23 },
});
