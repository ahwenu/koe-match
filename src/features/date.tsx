/** 架空の候補との会話を通して、会う前のやり取りを練習する画面。 */

import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../theme';
import type { Candidate } from '../types';
import { ActionButton, ScreenIntro } from '../ui';
import { findDateChoice, getDateScene, sceneCount, type DateAnswer } from './date-story';

type DateScreenProps = {
  candidate: Candidate | null;
  onDiscover: () => void;
  speak: (text: string) => void;
  active?: boolean;
  generateReply?: (input: { candidate: Candidate; context: string; message: string }) => Promise<string>;
};

/** 候補が変わると、別の練習セッションを表示する。 */
export default function DateScreen({ candidate, onDiscover, speak, active = true, generateReply }: DateScreenProps) {
  if (!candidate) {
    return (
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <ScreenIntro
          title="仮想デート"
          subtitle="選んだ相手のAI分身と、会う前に会話を練習できます。"
        />
        <View style={styles.emptyCard}>
          <Text style={styles.body}>声を聞き比べて、まずは話してみたい相手を選びましょう。</Text>
          <ActionButton label="声で相手を探す" onPress={onDiscover} />
        </View>
      </ScrollView>
    );
  }

  return <DatePractice key={candidate.id} candidate={candidate} speak={speak} active={active} generateReply={generateReply} />;
}

/** 練習の進行、聞き返し、振り返りを表示する。 */
function DatePractice({ candidate, speak, active, generateReply }: Pick<DateScreenProps, 'speak' | 'generateReply'> & { candidate: Candidate; active: boolean }) {
  const currentAnswers = useRef<DateAnswer[] | null>(null);
  const pendingReply = useRef<symbol | null>(null);
  const isActive = useRef(active);
  const [answers, setAnswers] = useState<DateAnswer[]>([]);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [waitingForReply, setWaitingForReply] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const interest = candidate.interests[0] ?? '休日の過ごし方';
  const scene = getDateScene(answers, interest);

  useEffect(() => {
    isActive.current = active;
  }, [active]);

  useEffect(() => () => {
    pendingReply.current = null;
  }, []);

  /** 同じ場面への連続入力を防ぎ、返答と次の場面を読み上げる。 */
  function choose(index: number) {
    const choice = scene?.choices[index];
    if (!choice || (currentAnswers.current && currentAnswers.current !== answers)) return;

    const newAnswers = [...answers, {
      choice: index,
      response: choice.label,
      reply: choice.reply,
      takeaway: choice.takeaway,
    }];
    currentAnswers.current = newAnswers;
    pendingReply.current = null;
    setAnswers(newAnswers);
    setDraft('');
    setFeedback('');
    setWaitingForReply(false);
    Keyboard.dismiss();
    scroll.current?.scrollTo({ y: 0, animated: false });
    const next = getDateScene(newAnswers, interest);
    speak(next ? `${choice.reply} ${next.opening}` : choice.reply);
  }

  /** 明確な選択で場面を進め、ほかの発話には場面内で返答する。 */
  async function submitReply() {
    const transcript = draft.trim();
    if (!scene || !transcript || pendingReply.current) return;
    const index = findDateChoice(scene, transcript);
    if (index >= 0) {
      choose(index);
      return;
    }

    if (!generateReply) {
      const message = 'どちらの意味かな？ １番か２番、または画面にある返事を言ってみて。';
      setFeedback(message);
      speak(message);
      return;
    }

    const request = Symbol();
    pendingReply.current = request;
    setWaitingForReply(true);
    setFeedback('');
    Keyboard.dismiss();
    try {
      const context = [scene.title, scene.setting, scene.opening].join('\n');
      const reply = (await generateReply({ candidate, context, message: transcript })).trim();
      if (!reply) throw new Error('No date reply generated');
      if (pendingReply.current !== request) return;
      setDraft('');
      setFeedback(reply);
      if (isActive.current) speak(reply);
    } catch {
      if (pendingReply.current !== request) return;
      setFeedback('返答を生成できませんでした。もう一度送信するか、選択肢で続けてください。');
    } finally {
      if (pendingReply.current === request) {
        pendingReply.current = null;
        setWaitingForReply(false);
      }
    }
  }

  /** 同じ候補と最初の場面から練習する。 */
  function restart() {
    const noAnswers: DateAnswer[] = [];
    currentAnswers.current = noAnswers;
    setAnswers(noAnswers);
    setDraft('');
    setFeedback('');
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  return (
    <ScrollView
      ref={scroll}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <ScreenIntro title="仮想デート" />
      <View style={styles.partner}>
        {candidate.avatar
          ? <Image source={candidate.avatar} style={styles.avatar} accessibilityIgnoresInvertColors />
          : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: candidate.color }]}>
              <Text style={styles.avatarInitials}>{candidate.initials}</Text>
            </View>
          )}
        <View style={styles.partnerDetails}>
          <Text style={styles.partnerName}>{candidate.name}</Text>
          <Text style={styles.caption}>架空の候補との会話練習</Text>
        </View>
      </View>

      {scene ? (
        <>
          <View style={styles.sceneCard}>
            <View style={styles.sceneHeader}>
              <Text accessibilityLabel={`全${sceneCount}場面のうち${answers.length + 1}場面目`} style={styles.progress}>
                {answers.length + 1} / {sceneCount}
              </Text>
              <Text style={styles.sceneTitle}>{scene.title}</Text>
            </View>
            <Text style={styles.caption}>{scene.setting}</Text>
            {answers.length > 0 && (
              <Text style={styles.lastReply}>{answers[answers.length - 1].reply}</Text>
            )}
            <Text selectable style={styles.opening}>{scene.opening}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${candidate.name}の台詞を読み上げる`}
              onPress={() => speak(scene.opening)}
              style={({ pressed }) => [styles.listenButton, pressed && styles.pressed]}
            >
              <Text style={styles.listenLabel}>▶  台詞を聞く</Text>
            </Pressable>
          </View>

          <View style={styles.replySection}>
            <Text style={styles.sectionTitle}>どう返す？</Text>
            {scene.choices.map((choice, index) => (
              <Pressable
                key={choice.label}
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}番、${choice.label}`}
                onPress={() => choose(index)}
                style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
              >
                <Text style={styles.number}>{index + 1}</Text>
                <Text style={styles.choiceText}>{choice.label}</Text>
                <Text style={styles.arrow} accessible={false}>›</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.voiceSection}>
            <Text style={styles.sectionTitle}>声で返す</Text>
            <Text style={styles.caption}>
              {generateReply
                ? 'Aqua Voiceキーボードで選択肢や、相手への質問を話せます。'
                : 'Aqua Voiceキーボードで選択肢か番号を話してください。'}
            </Text>
            {generateReply && (
              <Text style={styles.caption}>自由な返事は、候補情報と場面とともにAIサービスへ送信されます。</Text>
            )}
            <TextInput
              accessibilityLabel="仮想デートの返事を入力"
              placeholder="例：１番"
              placeholderTextColor={colors.muted}
              value={draft}
              editable={!waitingForReply}
              onChangeText={(text) => {
                setDraft(text);
                setFeedback('');
              }}
              maxLength={160}
              returnKeyType="send"
              onSubmitEditing={() => void submitReply()}
              style={styles.input}
            />
            {feedback !== '' && (
              <Text style={styles.feedback} accessibilityLiveRegion="polite">{feedback}</Text>
            )}
            <ActionButton
              label={waitingForReply ? '返答を待っています…' : '返事を送る'}
              onPress={() => void submitReply()}
              variant="secondary"
              disabled={!draft.trim() || waitingForReply}
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.sceneCard}>
            <Text style={styles.sceneTitle}>デートの振り返り</Text>
            <Text selectable style={styles.opening}>{answers[answers.length - 1].reply}</Text>
            <Text style={styles.caption}>練習で選んだ返事と、次の会話のきっかけを振り返れます。</Text>
          </View>
          <View style={styles.reviewCard}>
            {answers.map(({ response, takeaway }, index) => (
              <View key={index} style={styles.reviewItem}>
                <Text style={styles.progress}>{index + 1} / {sceneCount}</Text>
                <Text selectable style={styles.reviewResponse}>{response}</Text>
                <Text style={styles.caption}>{takeaway}</Text>
              </View>
            ))}
          </View>
          <View style={styles.questionCard}>
            <Text style={styles.sectionTitle}>初対面で使える質問の例</Text>
            <Text selectable style={styles.body}>「{interest}を好きになったきっかけは？」</Text>
          </View>
          <ActionButton label="もう一度練習する" onPress={restart} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 32, gap: 16 },
  emptyCard: { padding: 20, gap: 16, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.surface },
  partner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  partnerDetails: { flex: 1, gap: 2 },
  partnerName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  body: { color: colors.ink, fontSize: 16, lineHeight: 25 },
  sceneCard: { padding: 18, gap: 10, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.lilac },
  sceneHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4 },
  progress: { color: colors.accentDark, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sceneTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  lastReply: { borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: 10, color: colors.muted, fontSize: 13, lineHeight: 20 },
  opening: { color: colors.ink, fontSize: 17, lineHeight: 27, fontWeight: '600' },
  listenButton: { minHeight: 44, paddingHorizontal: 13, borderRadius: 16, alignSelf: 'flex-start', justifyContent: 'center', backgroundColor: colors.surface },
  listenLabel: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  replySection: { gap: 8 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  choice: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 17, borderCurve: 'continuous', backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 9 },
  number: { minWidth: 24, color: colors.accentDark, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  choiceText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  arrow: { color: colors.accentDark, fontSize: 23, fontWeight: '500' },
  voiceSection: { gap: 8 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.surface, color: colors.ink, fontSize: 16 },
  feedback: { color: colors.accentDark, fontSize: 14, lineHeight: 22 },
  reviewCard: { padding: 17, gap: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.surface },
  reviewItem: { gap: 3 },
  reviewResponse: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  questionCard: { padding: 16, gap: 7, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.peach },
});
