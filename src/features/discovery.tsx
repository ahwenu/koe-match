/** 左右の声を聴きくらべて選び、架空の相手とのマッチを確認する。 */
import { useEventListener } from 'expo';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { ArrowLeft, ArrowRight, Check, Headphones, Heart, MessageCircle, Mic, Pause, Play, Sparkles, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fontFamilies, useThemeColors } from '../theme';
import type { Candidate } from '../types';
import { ActionButton } from '../ui';
import { DiscoveryAvatar } from './discovery-art';
import { voiceCandidates, type Side, type VoiceCandidate } from './discovery-data';
import { DiscoveryStage, useReduceDiscoveryMotion, type EarSelection } from './discovery-stage';
import { useVoiceComparisonProgress } from './voice-comparison-progress';

type DiscoveryProps = {
  active?: boolean;
  voiceRequest?: number;
  onMatch: (candidate: Candidate) => void;
  onMatchAvailable?: (candidate: Candidate | null) => void;
  onDismissMatch?: () => void;
};

type VoiceClip = { candidate: VoiceCandidate; side: Side };

const playbackError = '声を再生できませんでした。もう一度試すか、文字で読めます。';
const accents = ['mint', 'blue', 'yellow'] as const;

/** 聞き取った側や名前を、今の候補と一致する方向に変換する。 */
function findSide(phrase: string, left?: VoiceCandidate, right?: VoiceCandidate): Side | undefined {
  const name = phrase.replace(/(?:を|の声を)?(?:選ぶ|選んで|お願いします|にする)$/, '').replace(/(?:さん|側)$/, '');
  if (name === '左' || name === 'ひだり' || name === 'A' || name === left?.name) return 'left';
  if (name === '右' || name === 'みぎ' || name === 'B' || name === right?.name) return 'right';
  return undefined;
}

/** 登録した選択と架空の相互マッチを表示し、会話練習へ進む。 */
function MatchResult({ winner, reducedMotion, onPractice, onDismiss, onReset }: {
  winner: VoiceCandidate;
  reducedMotion: boolean;
  onPractice: () => void;
  onDismiss?: () => void;
  onReset: () => void;
}) {
  const colors = useThemeColors();
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [reveal] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(reveal, { toValue: 1, duration: reducedMotion ? 180 : 450, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, reveal]);

  const placements = [
    ['10%', '34%', colors.blue, 6],
    ['20%', '12%', colors.mint, 5],
    ['26%', '89%', colors.primary, 6],
    ['54%', '8%', colors.primary, 4],
    ['67%', '84%', colors.blue, 6],
    ['79%', '15%', colors.primary, 6],
    ['50%', '92%', colors.mint, 6],
    ['84%', '82%', colors.yellow, 7],
    ['13%', '71%', colors.yellow, 4],
  ] as const;
  const traits = winner.interests;
  const pillStyles = {
    mint: [colors.mintSoft, colors.mintText],
    blue: [colors.blueSoft, colors.blueText],
    yellow: [colors.yellowSoft, colors.yellowText],
  };

  return (
    <>
      <View style={styles.matchToolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={onDismiss ? 'マッチ画面を閉じる' : '声を選び直す'}
          onPress={onDismiss ?? onReset}
          style={({ pressed }) => [styles.close, { backgroundColor: colors.surface2 }, pressed && styles.pressed]}
        >
          <X size={18} color={colors.muted} />
        </Pressable>
      </View>
      <Animated.View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.hero, {
          opacity: reveal,
          transform: [{ scale: reducedMotion ? 1 : reveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
        }]}
      >
        <View style={[styles.heroHalo, { backgroundColor: colors.primarySoft }]} />
        {placements.map(([top, left, backgroundColor, size]) => (
          <View key={`${top}-${left}`} style={[styles.confetti, { top, left, backgroundColor, width: size, height: size * 0.72 }]} />
        ))}
        <View style={styles.matchAvatars}>
          <DiscoveryAvatar size={108} borderWidth={3} borderColor={colors.surface} />
          <View style={styles.overlapAvatar}><DiscoveryAvatar candidate={winner} size={108} borderWidth={3} borderColor={colors.surface} /></View>
        </View>
        <View style={[styles.matchHeart, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
          <Heart size={19} color={colors.onPrimary} />
        </View>
      </Animated.View>
      <View style={styles.matchCopy}>
        <Text accessibilityRole="header" style={[styles.matchTitle, { color: colors.accentDark }]}>マッチング成立！</Text>
        <Text style={[styles.matchSubtitle, { color: colors.muted }]}>デモで{winner.name}さんとマッチしました</Text>
      </View>
      <View style={styles.matchFacts}>
        <View style={styles.centerRow}>
          <Sparkles size={14} color={colors.mintText} />
          <Text style={[styles.smallBold, { color: colors.muted }]}>会話のきっかけ</Text>
        </View>
        <View style={styles.factsRow}>
          {traits.map((trait, index) => {
            const [backgroundColor, color] = pillStyles[accents[index % accents.length]];
            return <Text key={trait} style={[styles.pill, { backgroundColor, color }]}>{trait}</Text>;
          })}
        </View>
      </View>
      <View style={styles.matchActions}>
        <ActionButton label="AIの分身とデート練習" onPress={onPractice} />
        <Pressable
          accessibilityRole="button"
          onPress={() => setMessageOpen((open) => !open)}
          style={({ pressed }) => [styles.messageAction, { borderColor: colors.primary }, pressed && styles.pressed]}
        >
          <MessageCircle size={18} color={colors.accentDark} />
          <Text style={[styles.actionLabel, { color: colors.accentDark }]}>{messageOpen ? 'メッセージを閉じる' : 'メッセージを作る'}</Text>
        </Pressable>
        {messageOpen ? (
          <View style={styles.messageBox}>
            <Text style={[styles.hint, { color: colors.muted }]}>架空の相手宛てのメッセージを練習できます。</Text>
            {sent ? (
              <View style={styles.messageBox}>
                <Text accessibilityLiveRegion="polite" style={[styles.voiceFeedback, { color: colors.mintText }]}>練習メッセージを記録しました。</Text>
                <Text selectable style={[styles.transcriptText, { color: colors.ink }]}>{message}</Text>
              </View>
            ) : (
              <>
                <TextInput
                  accessibilityLabel="練習メッセージ"
                  value={message}
                  onChangeText={setMessage}
                  placeholder="こんにちは"
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={160}
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.line }]}
                />
                <ActionButton variant="secondary" label="練習メッセージを記録する" disabled={!message.trim()} onPress={() => {
                  Keyboard.dismiss();
                  setSent(true);
                }} />
              </>
            )}
          </View>
        ) : null}
        {onDismiss ? <ActionButton variant="secondary" label="あとで" onPress={onDismiss} /> : null}
        <Pressable onPress={onReset} accessibilityRole="button" style={styles.textButton}>
          <Text style={[styles.hint, { color: colors.muted }]}>声を選び直す</Text>
        </Pressable>
      </View>
    </>
  );
}

/** ステレオ試聴と３回の選択を進め、決まった相手をデート画面に渡す。 */
export default function DiscoveryScreen({ active = true, voiceRequest, onMatch, onMatchAvailable, onDismissMatch }: DiscoveryProps) {
  const colors = useThemeColors();
  const reducedMotion = useReduceDiscoveryMotion();
  const { picks, setPicks, ready, error: storageError } = useVoiceComparisonProgress(voiceCandidates);
  const [current, setCurrent] = useState<Side | null>(null);
  const [selection, setSelection] = useState<EarSelection | null>(null);
  const [landed, setLanded] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState('');
  const [error, setError] = useState('');
  const player = useAudioPlayer(null, { updateInterval: 120 });
  const playback = useAudioPlayerStatus(player);
  const nextClip = useRef<VoiceClip | null>(null);
  const lastPlayedSide = useRef<Side | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const voiceInput = useRef<ComponentRef<typeof TextInput>>(null);
  const lastVoiceRequest = useRef(voiceRequest);
  const isActive = useRef(active);
  const selectionLock = useRef(false);
  const round = picks.length;
  const left = round === 2 ? picks[0] : voiceCandidates[round * 2];
  const right = round === 2 ? picks[1] : voiceCandidates[round * 2 + 1];
  const winner = picks[2];

  /** 予約済みの次の音声も含めて再生を止める。 */
  const stop = useCallback(() => {
    nextClip.current = null;
    player.pause();
    setCurrent(null);
  }, [player]);

  /** 左右に定位済みの音声をプレイヤーに渡す。 */
  const play = useCallback(({ candidate, side }: VoiceClip) => {
    try {
      player.replace(candidate.voices[side]);
      player.play();
      lastPlayedSide.current = side;
      setCurrent(side);
      setError('');
    } catch {
      lastPlayedSide.current = null;
      stop();
      setError(playbackError);
    }
  }, [player, stop]);

  useEffect(() => {
    isActive.current = active;
    if (active) {
      void setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      }).catch(() => {});
    } else {
      nextClip.current = null;
      player.pause();
    }
  }, [active, player]);

  useEffect(() => {
    if (ready) onMatchAvailable?.(winner ?? null);
  }, [onMatchAvailable, ready, winner]);

  useEffect(() => {
    if (voiceRequest === lastVoiceRequest.current) return;
    lastVoiceRequest.current = voiceRequest;
    if (!active || voiceRequest === undefined) return;
    const frame = requestAnimationFrame(() => {
      if (voiceOpen) voiceInput.current?.focus();
      else setVoiceOpen(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [active, voiceOpen, voiceRequest]);

  useEventListener(player, 'playbackStatusUpdate', (status) => {
    if (!active) {
      setCurrent(null);
      return;
    }
    if (status.error) {
      lastPlayedSide.current = null;
      stop();
      setError(playbackError);
      return;
    }
    if (!status.didJustFinish) return;
    const queued = nextClip.current;
    nextClip.current = null;
    if (queued) play(queued);
    else setCurrent(null);
  });

  /** 聴いている声を止めるか、選んだ側の声に切り替える。 */
  function listen(candidate: VoiceCandidate, side: Side) {
    const wasPlaying = current === side;
    stop();
    if (!wasPlaying) play({ candidate, side });
  }

  /** 左、右の順で途切れなく再生する。 */
  function listenInOrder() {
    if (current) {
      stop();
    } else if (left && right) {
      nextClip.current = { candidate: right, side: 'right' };
      play({ candidate: left, side: 'left' });
    }
  }

  /** どの入力経路でも同じ耳の確定アニメーションに進む。 */
  const choose = useCallback((side: Side, source: EarSelection['source']) => {
    if (selectionLock.current || !left || !right || winner) return;
    selectionLock.current = true;
    stop();
    Keyboard.dismiss();
    setError('');
    setVoiceOpen(false);
    setVoiceText('');
    setVoiceFeedback('');
    setSelection({ side, source });
  }, [left, right, stop, winner]);

  /** 耳がアバターに到着したときに選択を表示する。 */
  const onLand = useCallback(() => {
    const candidate = selection?.side === 'left' ? left : right;
    if (!selection || !candidate) return;
    setLanded(true);
    if (isActive.current) AccessibilityInfo.announceForAccessibility(`${candidate.name}さんを選びました`);
  }, [left, right, selection]);

  /** 同じラウンドを二重に選ばずに、次の候補へ進む。 */
  const advance = useCallback(() => {
    if (!landed || !selection || !selectionLock.current) return;
    const candidate = selection.side === 'left' ? left : right;
    if (!candidate) return;
    selectionLock.current = false;
    lastPlayedSide.current = null;
    setLanded(false);
    setSelection(null);
    setShowTranscript(false);
    setPicks((previous) => previous.length === round ? [...previous, candidate] : previous);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [landed, left, right, round, selection, setPicks]);

  useEffect(() => {
    if (!landed) return;
    const timeout = setTimeout(advance, 1400);
    return () => clearTimeout(timeout);
  }, [advance, landed]);

  /** 左右、名前、次へ進む指示を Aqua Voice キーボードで受け付ける。 */
  function submitVoice() {
    const phrase = voiceText.normalize('NFKC').replace(/[\s。.!！、]/g, '').toUpperCase();
    if (winner) {
      if (/^(練習する|デート練習|次へ?)$/.test(phrase)) {
        setVoiceOpen(false);
        setVoiceText('');
        Keyboard.dismiss();
        onMatch(winner);
      } else {
        setVoiceFeedback('「練習する」と入力してください。');
      }
      return;
    }
    if (/^次へ?$/.test(phrase)) {
      setVoiceOpen(false);
      setVoiceText('');
      Keyboard.dismiss();
      if (landed) {
        advance();
      } else if (!selection && left && right) {
        stop();
        play(lastPlayedSide.current === 'left' ? { candidate: right, side: 'right' } : { candidate: left, side: 'left' });
      }
      return;
    }
    const side = findSide(phrase, left, right);
    if (side) choose(side, 'voice');
    else setVoiceFeedback('「左」「右」か、画面に表示されている名前を入力してください。');
  }

  /** 最初の組み合わせから選び直す。 */
  function reset() {
    lastPlayedSide.current = null;
    setPicks([]);
    setVoiceOpen(false);
    setVoiceFeedback('');
    setVoiceText('');
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  const progress = playback.duration > 0 ? Math.min(1, playback.currentTime / playback.duration) : 0;
  const selectedName = selection?.side === 'left' ? left?.name : right?.name;
  const hint = winner ? '「練習する」と話しかけてもOK' : '「左」「右」か、相手の名前を話して選べます';

  if (!ready) return <ActivityIndicator accessibilityLabel="聴きくらべを読み込み中" color={colors.primary} style={styles.loading} />;

  return (
    <ScrollView
      ref={scroll}
      style={winner && { backgroundColor: colors.surface }}
      contentContainerStyle={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      directionalLockEnabled
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {storageError ? <Text accessibilityRole="alert" style={[styles.hint, styles.storageError, { color: colors.accentDark }]}>{storageError}</Text> : null}
      {winner ? (
        <MatchResult
          winner={winner}
          reducedMotion={reducedMotion}
          onPractice={() => onMatch(winner)}
          onDismiss={onDismissMatch}
          onReset={reset}
        />
      ) : left && right ? (
        <>
          <View style={styles.content}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>さがす</Text>
            <View style={styles.roundRow}>
              <View style={styles.round}>
                <Text accessibilityLabel={`全３回のうち${round + 1}回目`} style={[styles.roundLabel, { color: colors.muted }]}>ROUND {round + 1}/3</Text>
                <View style={styles.meter}>
                  {[0, 1, 2].map((index) => (
                    <View key={index} style={[styles.meterBar, { backgroundColor: index <= round ? colors.yellow : colors.line }]} />
                  ))}
                </View>
              </View>
              <View style={[styles.earphoneChip, { backgroundColor: colors.blueSoft }]}>
                <Headphones size={15} color={colors.blueText} />
                <Text style={[styles.smallBold, { color: colors.blueText }]}>イヤホンで左右から</Text>
              </View>
            </View>
            <View style={[styles.question, { backgroundColor: colors.surface2 }]}>
              <Text style={[styles.hint, { color: colors.muted }]}>ASMRサンプル</Text>
              <Text style={[styles.questionText, { color: colors.ink }]}>2人の話し方を聴きくらべ</Text>
            </View>
          </View>

          <DiscoveryStage
            key={round}
            left={left}
            right={right}
            playing={current}
            leftLevel={current === 'left' ? 0.48 + progress / 2 : 0}
            rightLevel={current === 'right' ? 0.48 + progress / 2 : 0}
            selection={selection}
            landed={landed}
            reducedMotion={reducedMotion}
            onChoose={choose}
            onLand={onLand}
            onListen={listen}
          />

          <View style={styles.content}>
            {landed ? (
              <Pressable
                accessibilityRole="button"
                onPress={advance}
                style={({ pressed }) => [styles.toast, { backgroundColor: colors.surface }, pressed && styles.pressed]}
              >
                <View style={[styles.toastCheck, { backgroundColor: colors.mintSoft }]}>
                  <Check size={17} color={colors.mintText} />
                </View>
                <Text style={[styles.toastLabel, { color: colors.ink }]}>
                  {selectedName}さんを選びました{round === 2 ? ' · 結果へ' : ' · 次のラウンドへ'}
                </Text>
                <ArrowRight size={16} color={colors.muted} />
              </Pressable>
            ) : (
              <View style={styles.chooseRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={!!selection}
                  onPress={() => choose('left', 'button')}
                  style={({ pressed }) => [styles.chooseButton, styles.chooseLeft, pressed && styles.pressed]}
                >
                  <ArrowLeft size={15} color={colors.accentDark} />
                  <Text style={[styles.chooseText, { color: colors.accentDark }]}>{left.name}さんを選ぶ</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={current ? '再生を停止' : '左から順に聴く'}
                  disabled={!!selection}
                  onPress={listenInOrder}
                  style={({ pressed }) => [styles.compare, { backgroundColor: colors.surface }, pressed && styles.pressed]}
                >
                  {current ? <Pause size={18} color={colors.blueText} /> : <Play size={18} color={colors.blueText} />}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!!selection}
                  onPress={() => choose('right', 'button')}
                  style={({ pressed }) => [styles.chooseButton, styles.chooseRight, pressed && styles.pressed]}
                >
                  <Text style={[styles.chooseText, { color: colors.ink }]}>{right.name}さんを選ぶ</Text>
                  <ArrowRight size={15} color={colors.ink} />
                </Pressable>
              </View>
            )}
            <Text style={[styles.hint, styles.centerText, { color: colors.muted }]}>選びたい側にスワイプすると、耳が相手のもとへ</Text>
            {error ? <Text accessibilityRole="alert" style={[styles.voiceFeedback, { color: colors.accentDark }]}>{error}</Text> : null}
          </View>
        </>
      ) : null}

      <View style={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: voiceOpen }}
          onPress={() => setVoiceOpen((open) => !open)}
          style={styles.voiceHint}
        >
          <Mic size={15} color={colors.accentDark} />
          <Text style={[styles.hint, styles.centerText, { color: colors.muted }]}>{hint}</Text>
        </Pressable>
        {voiceOpen ? (
          <View style={styles.messageBox}>
            <Text style={[styles.hint, { color: colors.muted }]}>Aqua Voiceキーボードで話すか、直接入力できます。</Text>
            <TextInput
              ref={voiceInput}
              autoFocus={active}
              accessibilityLabel="声で操作"
              value={voiceText}
              onChangeText={(value) => {
                setVoiceText(value);
                setVoiceFeedback('');
              }}
              maxLength={40}
              returnKeyType="go"
              onSubmitEditing={submitVoice}
              placeholder={winner ? '例：練習する' : '例：左'}
              placeholderTextColor={colors.muted}
              style={[styles.input, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.line }]}
            />
            {voiceFeedback ? <Text accessibilityLiveRegion="polite" style={[styles.voiceFeedback, { color: colors.accentDark }]}>{voiceFeedback}</Text> : null}
            <ActionButton label="実行する" variant="secondary" disabled={!voiceText.trim()} onPress={submitVoice} />
          </View>
        ) : null}
        {!winner && left && right ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showTranscript }}
              onPress={() => setShowTranscript((shown) => !shown)}
              style={styles.textButton}
            >
              <Text style={[styles.transcriptLink, { color: colors.blueText }]}>{showTranscript ? '文字を閉じる' : '台詞を文字で読む'}</Text>
            </Pressable>
            {showTranscript ? (
              <View style={[styles.transcript, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <Text selectable style={[styles.transcriptText, { color: colors.ink }]}>{left.introduction}</Text>
                <Text selectable style={[styles.transcriptText, { color: colors.ink }]}>{right.introduction}</Text>
              </View>
            ) : null}
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showCredits }}
          onPress={() => setShowCredits((shown) => !shown)}
          style={styles.textButton}
        >
          <Text style={[styles.transcriptLink, { color: colors.blueText }]}>音声サンプルのクレジット</Text>
        </Pressable>
        {showCredits ? (
          <View style={[styles.transcript, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.transcriptText, { color: colors.ink }]}>Voice-matchingの合成ASMR音声</Text>
            {voiceCandidates.map((candidate) => (
              <Text key={candidate.id} selectable style={[styles.transcriptText, { color: colors.ink }]}>
                {candidate.name}　{candidate.voiceCredit}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 8, paddingBottom: 12, gap: 9, flexGrow: 1 },
  loading: { flex: 1 },
  storageError: { paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, gap: 9 },
  title: { fontFamily: fontFamilies.bodyBold, fontSize: 24, lineHeight: 35 },
  roundRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  round: { gap: 5 },
  roundLabel: { fontFamily: fontFamilies.numbers, fontSize: 11 },
  meter: { flexDirection: 'row', gap: 4 },
  meterBar: { width: 31, height: 3, borderRadius: 2 },
  earphoneChip: { alignItems: 'center', flexDirection: 'row', gap: 5, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
  smallBold: { fontFamily: fontFamilies.bodyBold, fontSize: 11, lineHeight: 17 },
  question: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  questionText: { fontFamily: fontFamilies.bodyBold, fontSize: 17, lineHeight: 25 },
  hint: { fontFamily: fontFamilies.body, fontSize: 11, lineHeight: 17 },
  centerText: { textAlign: 'center', flexShrink: 1 },
  chooseRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 46 },
  chooseButton: { flex: 1, minHeight: 44, alignItems: 'center', flexDirection: 'row', gap: 4 },
  chooseLeft: { justifyContent: 'flex-start' },
  chooseRight: { justifyContent: 'flex-end' },
  chooseText: { fontFamily: fontFamilies.bodyBold, fontSize: 13, flexShrink: 1 },
  compare: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 22 },
  voiceHint: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, minHeight: 33 },
  toast: { minHeight: 46, borderRadius: 25, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  toastCheck: { width: 29, height: 29, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  toastLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 13, flex: 1 },
  textButton: { alignSelf: 'center', minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 },
  transcriptLink: { fontFamily: fontFamilies.bodyBold, fontSize: 11 },
  transcript: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  transcriptText: { fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 20 },
  matchToolbar: { paddingHorizontal: 20, alignItems: 'flex-end' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  hero: { alignSelf: 'center', width: '100%', maxWidth: 390, height: 250, alignItems: 'center', justifyContent: 'center' },
  heroHalo: { position: 'absolute', width: 231, height: 231, borderRadius: 116 },
  confetti: { position: 'absolute', borderRadius: 4, transform: [{ rotate: '28deg' }] },
  matchAvatars: { flexDirection: 'row' },
  overlapAvatar: { marginLeft: -15 },
  matchHeart: { position: 'absolute', width: 42, height: 42, bottom: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 21, borderWidth: 3 },
  matchCopy: { alignItems: 'center', paddingHorizontal: 20, gap: 7 },
  matchTitle: { fontFamily: fontFamilies.bodyBold, fontSize: 28, lineHeight: 41, textAlign: 'center' },
  matchSubtitle: { fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  matchFacts: { alignItems: 'center', paddingHorizontal: 20, gap: 9, marginVertical: 9 },
  centerRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  factsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pill: { fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 18, paddingHorizontal: 11, paddingVertical: 4, overflow: 'hidden', borderRadius: 15 },
  matchActions: { paddingHorizontal: 20, gap: 9 },
  messageAction: { flexDirection: 'row', gap: 8, minHeight: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 14 },
  messageBox: { gap: 8 },
  input: { fontFamily: fontFamilies.body, fontSize: 16, minHeight: 46, borderRadius: 15, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  voiceFeedback: { fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 20 },
  pressed: { opacity: 0.72 },
});
