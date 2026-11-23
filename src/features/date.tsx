/** 場所を選び、架空の相手と会話を練習してからふりかえる。 */
import * as Speech from 'expo-speech';
import { Bookmark, Camera, Check, ChevronLeft, CircleHelp, Heart, Keyboard as KeyboardIcon, MapPin, Mic, Play, Send, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { fontFamilies, useThemeColors, type ThemeColors } from '../theme';
import type { Candidate } from '../types';
import { ActionButton } from '../ui';
import { DiscoveryAvatar, VoiceWave } from './discovery-art';
import { datePlaces, findDatePlace, type DatePlace } from './date-places';
import { findDateChoice, getDateScene, sceneCount, type DateAnswer } from './date-story';

type DateScreenProps = {
  candidate: Candidate | null;
  onDiscover: () => void;
  speak: (text: string) => void;
  active?: boolean;
  voiceRequest?: number;
  onPracticeChange?: (practicing: boolean) => void;
  generateReply?: (input: { candidate: Candidate; context: string; message: string }) => Promise<string>;
};

type DateScreenStage = 'picker' | 'practice' | 'review';

const memoryIcons = [MapPin, Camera, CircleHelp];
const memoryIndexes = Array.from({ length: sceneCount }, (_, index) => index);
const placeRows = Array.from({ length: Math.ceil(datePlaces.length / 2) }, (_, index) => datePlaces.slice(index * 2, index * 2 + 2));

/** 場所の雰囲気を示すラベルに、デザインのアクセント色を対応させる。 */
function placeAccent(place: DatePlace, colors: ThemeColors) {
  switch (place.tint) {
    case 'blue': return { color: colors.blueText, backgroundColor: colors.blueSoft };
    case 'mint': return { color: colors.mintText, backgroundColor: colors.mintSoft };
    case 'yellow': return { color: colors.yellowText, backgroundColor: colors.yellowSoft };
    case 'rose': return { color: colors.accentDark, backgroundColor: colors.primarySoft };
  }
}

/** 相手が未選択の場合に、声の聴きくらべへ案内する。 */
export default function DateScreen({ candidate, onDiscover, ...sessionProps }: DateScreenProps) {
  const colors = useThemeColors();
  if (candidate) return <DateSession key={candidate.id} candidate={candidate} onDiscover={onDiscover} {...sessionProps} />;

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>デート練習</Text>
      <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Heart size={24} color={colors.accentDark} />
        <Text style={[styles.body, { color: colors.ink }]}>声を聴きくらべて、話してみたい相手を選びましょう。</Text>
        <ActionButton label="声で相手をさがす" onPress={onDiscover} />
      </View>
    </ScrollView>
  );
}

/** 返答の重複を避けながら、選択・会話・ふりかえりを遷移する。 */
function DateSession({ candidate, onDiscover, speak, active = true, voiceRequest, onPracticeChange, generateReply }: Omit<DateScreenProps, 'candidate'> & { candidate: Candidate }) {
  const colors = useThemeColors();
  const { height, width } = useWindowDimensions();
  const tileImageHeight = height < 780 ? 82 : width >= 600 ? 116 : 94;
  const sceneImageHeight = height < 780 ? 126 : width >= 600 ? 184 : 148;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const currentAnswers = useRef<DateAnswer[] | null>(null);
  const pendingReply = useRef<symbol | null>(null);
  const isActive = useRef(active);
  const lastVoiceRequest = useRef(voiceRequest);
  const handledFocus = useRef(0);
  const [stage, setStage] = useState<DateScreenStage>('picker');
  const [place, setPlace] = useState(datePlaces[0]);
  const [answers, setAnswers] = useState<DateAnswer[]>([]);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [lastExchange, setLastExchange] = useState<{ message: string; reply: string } | null>(null);
  const [waitingForReply, setWaitingForReply] = useState(false);
  const [invited, setInvited] = useState(false);
  const interest = candidate.interests[0] ?? '休日の過ごし方';
  const lastAnswer = answers[answers.length - 1];
  const scene = stage === 'practice' ? getDateScene(answers, interest, place) : undefined;
  const practicing = !!scene;

  useEffect(() => {
    isActive.current = active;
    onPracticeChange?.(active && practicing);
    return () => onPracticeChange?.(false);
  }, [active, onPracticeChange, practicing]);

  useEffect(() => () => {
    pendingReply.current = null;
  }, []);

  /** 読み上げを止めたあと、表示される入力欄にフォーカスを要求する。 */
  const openVoiceEditor = useCallback(() => {
    void Speech.stop().catch(() => {});
    setVoiceOpen(true);
    setFocusRequest((request) => request + 1);
  }, []);

  useEffect(() => {
    if (voiceRequest === lastVoiceRequest.current) return;
    lastVoiceRequest.current = voiceRequest;
    if (!active || voiceRequest === undefined) return;
    const frame = requestAnimationFrame(openVoiceEditor);
    return () => cancelAnimationFrame(frame);
  }, [active, openVoiceEditor, voiceRequest]);

  useEffect(() => {
    if (!active || !voiceOpen || waitingForReply || focusRequest === handledFocus.current) return;
    const frame = requestAnimationFrame(() => {
      const field = input.current;
      if (!field) return;
      field.focus();
      handledFocus.current = focusRequest;
    });
    return () => cancelAnimationFrame(frame);
  }, [active, focusRequest, voiceOpen, waitingForReply]);

  /** キーボードを閉じても、入力済みの返事は残す。 */
  function toggleVoiceEditor() {
    if (voiceOpen) {
      Keyboard.dismiss();
      setVoiceOpen(false);
    } else {
      openVoiceEditor();
    }
  }

  /** 会話画面を移動するとき、前の画面の入力や返信を片付ける。 */
  function moveTo(next: DateScreenStage) {
    pendingReply.current = null;
    setWaitingForReply(false);
    setDraft('');
    setFeedback('');
    setVoiceOpen(false);
    setLastExchange(null);
    Keyboard.dismiss();
    scroll.current?.scrollTo({ y: 0, animated: false });
    setStage(next);
  }

  /** 練習を途中で離れるときは、会話の読み上げも終了する。 */
  function leavePractice(next: 'picker' | 'review') {
    void Speech.stop().catch(() => {});
    moveTo(next);
  }

  /** 選んだ場所で新しい練習を始める。 */
  function startPractice() {
    const noAnswers: DateAnswer[] = [];
    currentAnswers.current = noAnswers;
    setAnswers(noAnswers);
    setInvited(false);
    moveTo('practice');
    const initial = getDateScene(noAnswers, interest, place);
    if (initial && active) speak(initial.opening);
  }

  /** 話された番号やタップを同じ選択として受け付け、次の場面を読み上げる。 */
  function choose(index: number) {
    const choice = scene?.choices[index];
    if (!choice || (currentAnswers.current && currentAnswers.current !== answers)) return;
    const updated = [...answers, {
      choice: index,
      response: choice.label,
      reply: choice.reply,
      takeaway: choice.takeaway,
      memory: choice.memory,
    }];
    currentAnswers.current = updated;
    setAnswers(updated);
    const next = getDateScene(updated, interest, place);
    moveTo(next ? 'practice' : 'review');
    if (active) speak(next ? `${choice.reply} ${next.opening}` : choice.reply);
  }

  /** 明確な選択で場面を進め、自由な発話には同じ場面内で返答する。 */
  async function submitReply(transcript: string) {
    if (!scene || pendingReply.current) return;
    const choiceIndex = findDateChoice(scene, transcript);
    if (choiceIndex >= 0) {
      choose(choiceIndex);
      return;
    }
    if (!generateReply) {
      const message = '１番か２番、または画面にある返事を話してください。';
      setFeedback(message);
      if (active) speak(message);
      return;
    }

    const request = Symbol();
    pendingReply.current = request;
    setWaitingForReply(true);
    setFeedback('');
    Keyboard.dismiss();
    try {
      const context = [place.label, scene.title, scene.setting, scene.opening].join('\n');
      const reply = (await generateReply({ candidate, context, message: transcript })).trim();
      if (!reply) throw new Error('No date reply generated');
      if (pendingReply.current !== request) return;
      setDraft('');
      setLastExchange({ message: transcript, reply });
      setVoiceOpen(false);
      if (isActive.current) speak(reply);
    } catch {
      if (pendingReply.current !== request) return;
      setFeedback('返答を生成できませんでした。もう一度送るか、選択肢で続けてください。');
    } finally {
      if (pendingReply.current === request) {
        pendingReply.current = null;
        setWaitingForReply(false);
      }
    }
  }

  /** 架空の候補への招待を、今回の練習内で記録する。 */
  function sendDemoInvitation() {
    setInvited(true);
    setVoiceOpen(false);
    setDraft('');
    Keyboard.dismiss();
  }

  /** 場所の選択、返答、ふりかえりをテキスト化した音声で操作する。 */
  function submitVoice(value: string) {
    const transcript = value.trim();
    if (!transcript) return;
    if (scene) {
      void submitReply(transcript);
      return;
    }

    const phrase = transcript.normalize('NFKC').replace(/[\s。.!！、]/g, '');
    if (stage === 'picker') {
      if (/^(デートを)?始め(る|て)$/.test(phrase)) {
        startPractice();
        return;
      }
      const selected = findDatePlace(transcript);
      if (selected) {
        setPlace(selected);
        setDraft('');
        setFeedback('');
        setVoiceOpen(false);
        Keyboard.dismiss();
      } else {
        setFeedback('「公園にしたい」のように、画面にある場所を話してください。');
      }
    } else if (/^(送(って|る)|会いたい)$/.test(phrase)) {
      sendDemoInvitation();
    } else if (/^(もう一度|次へ?)$/.test(phrase)) {
      startPractice();
    } else {
      setFeedback('「送って」か「もう一度」と話してください。');
    }
  }

  const voiceEditor = voiceOpen ? (
    <View style={styles.voiceEditor}>
      <Text style={[styles.caption, { color: colors.muted }]}>
        {Platform.OS === 'ios'
          ? '地球儀キーでAqua Voiceに切り替えるか、書き起こしを貼り付けられます。'
          : 'Aqua Voiceでこの欄に入力するか、書き起こしを貼り付けられます。'}
      </Text>
      {scene && generateReply ? (
        <Text style={[styles.caption, { color: colors.muted }]}>自由な返事は候補情報と場面とともにAIサービスへ送信されます。</Text>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          ref={input}
          accessibilityLabel={scene ? 'デート練習の返事' : '声で操作'}
          placeholder={scene ? '例：１番' : stage === 'picker' ? '例：公園にしたい' : '例：もう一度'}
          placeholderTextColor={colors.muted}
          value={draft}
          editable={!waitingForReply}
          keyboardType="default"
          showSoftInputOnFocus
          autoCapitalize="none"
          onChangeText={(text) => {
            setDraft(text);
            setFeedback('');
          }}
          maxLength={160}
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={({ nativeEvent }) => submitVoice(nativeEvent.text)}
          style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.background }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={scene ? '返事を送る' : '実行する'}
          disabled={!draft.trim() || waitingForReply}
          onPress={() => submitVoice(draft)}
          style={({ pressed }) => [styles.sendButton, { backgroundColor: colors.primary }, (!draft.trim() || waitingForReply || pressed) && styles.pressed]}
        >
          <Send size={18} color={colors.onPrimary} />
        </Pressable>
      </View>
      {feedback ? <Text accessibilityLiveRegion="polite" style={[styles.caption, { color: colors.accentDark }]}>{feedback}</Text> : null}
    </View>
  ) : null;

  if (stage === 'picker') {
    return (
      <View style={styles.practice}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.pickerContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Pressable onPress={onDiscover} accessibilityRole="button" accessibilityLabel="聴きくらべへ戻る" style={styles.back}>
            <ChevronLeft size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.titleGroup}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>どこでデートする？</Text>
            <Text style={[styles.caption, { color: colors.muted }]}>{candidate.name}さん（AI分身）との練習デート</Text>
          </View>
          <View style={styles.grid}>
            {placeRows.map((row) => (
              <View key={row[0].id} style={styles.gridRow}>
                {row.map((option) => {
                  const selected = place.id === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityLabel={`${option.label}、${option.mood}`}
                      accessibilityState={{ checked: selected }}
                      onPress={() => setPlace(option)}
                      style={({ pressed }) => [styles.place, {
                        borderColor: selected ? colors.primary : colors.line,
                        backgroundColor: colors.surface,
                      }, pressed && styles.pressed]}
                    >
                      <View style={[styles.placeImage, { height: tileImageHeight, backgroundColor: colors.surface2 }]}>
                        <Image source={option.image} accessible={false} resizeMode="cover" style={styles.posterImage} />
                      </View>
                      {selected ? (
                        <View style={[styles.placeCheck, { backgroundColor: colors.mint }]}>
                          <Check size={13} color={colors.onPrimary} />
                        </View>
                      ) : null}
                      <View style={styles.placeCopy}>
                        <Text style={[styles.placeName, { color: colors.ink }]}>{option.label}</Text>
                        <Text style={[styles.placeMood, placeAccent(option, colors)]}>{option.mood}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={[styles.pickerFooter, { backgroundColor: colors.background }]}>
          <ActionButton label={`${place.label}で始める`} onPress={startPractice} />
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: voiceOpen }} onPress={toggleVoiceEditor} style={styles.voiceHint}>
            <Mic size={14} color={colors.accentDark} />
            <Text style={[styles.hint, { color: colors.muted }]}>「公園にしたい」のように話して選べます</Text>
          </Pressable>
          {voiceEditor}
        </View>
      </View>
    );
  }

  if (!scene) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <DateRecap
          candidate={candidate}
          place={place}
          answers={answers}
          interest={interest}
          invited={invited}
          onInvite={sendDemoInvitation}
          onRestart={startPractice}
          onVoice={toggleVoiceEditor}
          voiceOpen={voiceOpen}
        />
        {voiceEditor}
      </ScrollView>
    );
  }

  return (
    <View style={styles.practice}>
      <View style={[styles.practiceHeader, { backgroundColor: colors.surface, borderBottomColor: colors.line }]}>
        <Pressable onPress={() => leavePractice('picker')} accessibilityRole="button" accessibilityLabel="場所の選択へ戻る" style={styles.back}>
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <DiscoveryAvatar size={36} candidate={candidate} borderColor={colors.line} borderWidth={1} />
        <View style={styles.partner}>
          <Text style={[styles.partnerName, { color: colors.ink }]}>{candidate.name}（AI分身）</Text>
          <Text style={[styles.hint, { color: colors.muted }]}>デート練習中 · 本人には届きません</Text>
        </View>
        <View style={[styles.counter, { backgroundColor: colors.mintSoft }]}>
          <Sparkles size={13} color={colors.mintText} />
          <Text style={[styles.hintBold, { color: colors.mintText }]}>思い出 {answers.length}/{sceneCount}</Text>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.chat}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onContentSizeChange={() => {
          if (lastExchange) scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        <View style={[styles.sceneCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={[styles.sceneImage, { height: sceneImageHeight, backgroundColor: colors.surface2 }]}>
            <Image source={place.image} accessible={false} resizeMode="cover" style={styles.posterImage} />
          </View>
          <View style={styles.sceneCaption}>
            <Text style={[styles.sceneTitle, { color: colors.ink }]}>シーン{answers.length + 1} · {scene.title}</Text>
            <Segments step={answers.length + 1} color={colors.yellow} remainder={colors.line} />
          </View>
          <Text style={[styles.caption, styles.sceneSetting, { color: colors.muted }]}>{scene.setting}</Text>
        </View>

        {lastAnswer ? <Text selectable style={[styles.myBubble, { color: colors.onPrimary, backgroundColor: colors.primary }]}>{lastAnswer.response}</Text> : null}

        <View style={styles.speechRow}>
          <DiscoveryAvatar size={28} candidate={candidate} />
          <View style={[styles.speechBubble, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${candidate.name}の台詞を読み上げる`}
              onPress={() => speak(scene.opening)}
              style={({ pressed }) => [styles.listen, pressed && styles.pressed]}
            >
              <View style={[styles.play, { backgroundColor: colors.blue }]}>
                <Play size={13} color={colors.onPrimary} />
              </View>
              <VoiceWave color={colors.blueText} />
              <Text style={[styles.hint, { color: colors.blueText }]}>台詞を聴く</Text>
            </Pressable>
            {lastAnswer ? <Text selectable style={[styles.body, { color: colors.muted }]}>{lastAnswer.reply}</Text> : null}
            <Text selectable style={[styles.body, { color: colors.ink }]}>{scene.opening}</Text>
          </View>
        </View>

        {lastAnswer ? (
          <View style={[styles.memoryPill, { backgroundColor: colors.mintSoft }]}>
            <Sparkles size={13} color={colors.mintText} />
            <Text style={[styles.hint, { color: colors.mintText }]}>思い出が増えました · {lastAnswer.memory}</Text>
          </View>
        ) : null}

        {lastExchange ? (
          <>
            <Text selectable style={[styles.myBubble, { color: colors.onPrimary, backgroundColor: colors.primary }]}>{lastExchange.message}</Text>
            <View style={styles.speechRow}>
              <DiscoveryAvatar size={28} candidate={candidate} />
              <View style={[styles.speechBubble, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <Text selectable style={[styles.body, { color: colors.ink }]}>{lastExchange.reply}</Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.line }]}>
        {waitingForReply ? <Text accessibilityLiveRegion="polite" style={[styles.caption, { color: colors.blueText }]}>AI分身が返答を考えています…</Text> : null}
        {!voiceOpen ? (
          <View style={styles.choiceRow}>
            {scene.choices.map((choice, index) => (
              <Pressable
                key={choice.label}
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}番、${choice.label}`}
                onPress={() => choose(index)}
                style={({ pressed }) => [styles.choice, { backgroundColor: colors.yellowSoft }, pressed && styles.pressed]}
              >
                <Text style={[styles.hintBold, { color: colors.yellowText }]}>{index + 1} · {choice.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : voiceEditor}
        <View style={styles.composerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={voiceOpen ? '入力欄を閉じる' : '文字で返事する'}
            accessibilityState={{ expanded: voiceOpen }}
            onPress={toggleVoiceEditor}
            style={[styles.keyboard, { backgroundColor: colors.surface2 }]}
          >
            <KeyboardIcon size={19} color={colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="声で返事する"
            onPress={openVoiceEditor}
            style={styles.micTap}
          >
            <View style={[styles.mic, { backgroundColor: colors.primary }]}>
              <Mic size={27} color={colors.onPrimary} />
            </View>
            <Text style={[styles.hintBold, { color: colors.ink }]}>話して返事</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => leavePractice('review')} style={styles.end}>
            <Text style={[styles.hint, { color: colors.muted }]}>シーン終了</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** 完了した場面を、選んだ返事の数に合わせた区切りで示す。 */
function Segments({ step, color, remainder, wide = false }: { step: number; color: string; remainder: string; wide?: boolean }) {
  return (
    <View style={[styles.segments, wide && styles.wideSegments]} accessibilityLabel={`全${sceneCount}場面のうち${step}場面`}>
      {memoryIndexes.map((index) => <View key={index} style={[styles.segment, { backgroundColor: index < step ? color : remainder }]} />)}
    </View>
  );
}

/** 練習でできた思い出、次に聞きたい質問、架空の招待を表示する。 */
function DateRecap({ candidate, place, answers, interest, invited, onInvite, onRestart, onVoice, voiceOpen }: {
  candidate: Candidate;
  place: DatePlace;
  answers: DateAnswer[];
  interest: string;
  invited: boolean;
  onInvite: () => void;
  onRestart: () => void;
  onVoice: () => void;
  voiceOpen: boolean;
}) {
  const colors = useThemeColors();
  const lastAnswer = answers[answers.length - 1];
  const themes = [
    { color: colors.blueText, backgroundColor: colors.blueSoft },
    { color: colors.mintText, backgroundColor: colors.mintSoft },
    { color: colors.yellowText, backgroundColor: colors.yellowSoft },
  ];
  const [savedQuestions, setSavedQuestions] = useState<string[]>([]);
  const questions = [
    `${interest}を好きになったきっかけは？`,
    place.question,
    candidate.interests[1] ? `${candidate.interests[1]}で最近印象に残ったことは？` : '次の休日はどう過ごす？',
  ];

  return (
    <>
      <View style={styles.titleGroup}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>デート練習おつかれさま</Text>
        <Text style={[styles.caption, { color: colors.muted }]}>{candidate.name}さんとの{place.label}での練習をふりかえります</Text>
      </View>

      <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={styles.summaryRow}>
          <View style={styles.avatarPair}>
            <DiscoveryAvatar size={52} borderColor={colors.surface} borderWidth={2} />
            <View style={styles.overlap}><DiscoveryAvatar size={52} candidate={candidate} borderColor={colors.surface} borderWidth={2} /></View>
            <View style={[styles.recapHeart, { backgroundColor: colors.primarySoft }]}>
              <Heart size={14} color={colors.accentDark} />
            </View>
          </View>
          <View style={styles.summaryCopy}>
            <Text style={[styles.hintBold, { color: colors.mintText }]}>会話のヒント</Text>
            <Text style={[styles.body, { color: colors.ink }]}>{lastAnswer ? lastAnswer.takeaway : `次は${interest}を話題にしてみましょう`}</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.hint, { color: colors.muted }]}>ふたりの思い出</Text>
          <Text style={[styles.hintBold, { color: colors.mintText }]}>思い出 {answers.length}/{sceneCount}</Text>
        </View>
        <Segments step={answers.length} color={colors.mint} remainder={colors.mintSoft} wide />
      </View>

      {answers.length > 0 ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.ink }]}>できた思い出</Text>
          <View style={styles.memoryCards}>
            {answers.map((answer, index) => {
              const Icon = memoryIcons[index];
              const tint = themes[index];
              return (
                <View key={index} style={[styles.memory, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <View style={[styles.memoryIcon, { backgroundColor: tint.backgroundColor }]}><Icon size={18} color={tint.color} /></View>
                  <Text style={[styles.memoryLabel, { color: colors.ink }]}>{answer.memory}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.ink }]}>会ったら聞いてみたいこと</Text>
        <View style={[styles.questions, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {questions.map((question, index) => (
            <View key={question} style={[styles.question, index > 0 && { borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[styles.questionNumber, { color: themes[index].color }]}>{index + 1}</Text>
              <Text selectable style={[styles.questionText, { color: colors.ink }]}>{question}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={savedQuestions.includes(question) ? '目印を外す' : '質問に目印を付ける'}
                accessibilityState={{ selected: savedQuestions.includes(question) }}
                onPress={() => setSavedQuestions((saved) => saved.includes(question)
                  ? saved.filter((item) => item !== question)
                  : [...saved, question])}
                style={styles.bookmark}
              >
                <Bookmark size={16} color={savedQuestions.includes(question) ? colors.accentDark : colors.muted} fill={savedQuestions.includes(question) ? colors.primarySoft : 'none'} />
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ActionButton
          label={invited ? '練習の招待を記録しました' : `${candidate.name}さんに「会いたい」を送る（練習）`}
          disabled={invited}
          onPress={onInvite}
        />
        {invited ? <Text accessibilityLiveRegion="polite" style={[styles.hint, styles.centerText, { color: colors.mintText }]}>今回のデモ内に記録しました。</Text> : null}
        <ActionButton label="もう一度練習する" variant="secondary" onPress={onRestart} />
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: voiceOpen }} onPress={onVoice} style={styles.voiceHint}>
          <Mic size={14} color={colors.accentDark} />
          <Text style={[styles.hint, { color: colors.muted }]}>「送って」と話しかけてもOK</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18, gap: 16 },
  titleGroup: { gap: 5 },
  title: { fontFamily: fontFamilies.bodyBold, fontSize: 24, lineHeight: 35 },
  caption: { fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 20 },
  body: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 22 },
  hint: { fontFamily: fontFamilies.body, fontSize: 11, lineHeight: 17 },
  hintBold: { fontFamily: fontFamilies.bodyBold, fontSize: 11, lineHeight: 17 },
  centerText: { textAlign: 'center' },
  empty: { padding: 20, gap: 14, borderRadius: 22, borderWidth: 1 },
  pickerContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8, gap: 9 },
  pickerFooter: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 5 },
  grid: { gap: 8 },
  gridRow: { flexDirection: 'row', gap: 8 },
  place: { flex: 1, minWidth: 0, gap: 4, padding: 5, borderRadius: 18, borderWidth: 1.5 },
  placeImage: { alignSelf: 'stretch', borderRadius: 12, overflow: 'hidden' },
  posterImage: { width: '100%', height: '100%' },
  placeCheck: { position: 'absolute', top: 11, right: 11, width: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  placeCopy: { gap: 4, paddingHorizontal: 4, paddingBottom: 4, alignItems: 'flex-start' },
  placeName: { fontFamily: fontFamilies.bodyBold, fontSize: 15, lineHeight: 21 },
  placeMood: { fontFamily: fontFamilies.body, fontSize: 10, lineHeight: 16, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  voiceHint: { flexDirection: 'row', minHeight: 36, gap: 6, alignItems: 'center', justifyContent: 'center' },
  voiceEditor: { gap: 8 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 8, fontFamily: fontFamilies.body, fontSize: 16 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  practice: { flex: 1 },
  practiceHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 62, gap: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, minHeight: 44, justifyContent: 'center' },
  partner: { flex: 1, gap: 2 },
  partnerName: { fontFamily: fontFamilies.bodyBold, fontSize: 15, lineHeight: 22 },
  counter: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 13 },
  chat: { padding: 16, gap: 12 },
  sceneCard: { padding: 8, gap: 6, borderWidth: 1, borderRadius: 21, borderCurve: 'continuous' },
  sceneImage: { alignSelf: 'stretch', borderRadius: 15, overflow: 'hidden' },
  sceneCaption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, gap: 9 },
  sceneTitle: { fontFamily: fontFamilies.bodyBold, fontSize: 13, lineHeight: 19, flex: 1 },
  sceneSetting: { paddingHorizontal: 5, paddingBottom: 1, fontSize: 11, lineHeight: 17 },
  segments: { flexDirection: 'row', gap: 3, alignItems: 'center', flex: 0.23 },
  wideSegments: { flex: 0, alignSelf: 'stretch' },
  segment: { flex: 1, minWidth: 8, height: 4, borderRadius: 3 },
  speechRow: { flexDirection: 'row', gap: 7, alignItems: 'flex-end' },
  speechBubble: { maxWidth: '85%', borderRadius: 19, borderBottomLeftRadius: 7, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  myBubble: { alignSelf: 'flex-end', maxWidth: '85%', borderRadius: 19, borderBottomRightRadius: 7, paddingVertical: 10, paddingHorizontal: 13, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 22, overflow: 'hidden' },
  listen: { minHeight: 33, flexDirection: 'row', gap: 6, alignItems: 'center' },
  play: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  memoryPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 5, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  composer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 9, borderTopWidth: 1 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { justifyContent: 'center', minHeight: 42, borderRadius: 18, paddingVertical: 5, paddingHorizontal: 10 },
  composerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  keyboard: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  micTap: { alignItems: 'center', gap: 4, flex: 1 },
  mic: { width: 55, height: 55, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  end: { minWidth: 64, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  summary: { padding: 16, gap: 10, borderRadius: 22, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 13 },
  summaryCopy: { flex: 1, gap: 3 },
  avatarPair: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginLeft: -7 },
  recapHeart: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, left: 36, borderRadius: 12 },
  section: { gap: 9 },
  sectionTitle: { fontFamily: fontFamilies.bodyBold, fontSize: 16, lineHeight: 23 },
  memoryCards: { flexDirection: 'row', gap: 7 },
  memory: { flex: 1, alignItems: 'center', padding: 9, gap: 5, minWidth: 0, borderRadius: 17, borderWidth: 1 },
  memoryIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  memoryLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  questions: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  question: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, minHeight: 44 },
  bookmark: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  questionNumber: { minWidth: 14, fontFamily: fontFamilies.numbers, fontSize: 15 },
  questionText: { flex: 1, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.62 },
});
