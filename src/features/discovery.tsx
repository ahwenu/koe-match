/** 左右の声を聞き比べ、架空の候補から仮想デート相手を選ぶ画面。 */
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { useEventListener } from 'expo';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { colors } from '../theme';
import type { Candidate } from '../types';
import { ActionButton, ScreenIntro } from '../ui';
import { voiceCandidates, type Side, type VoiceCandidate } from './discovery-data';

type DiscoveryProps = {
  active?: boolean;
  onMatch: (candidate: Candidate) => void;
};

type VoiceClip = { candidate: VoiceCandidate; side: Side };
type SwipeOrigin = { id: number; x: number; y: number; timestamp: number };

const waveHeights = [6, 11, 17, 9, 21, 13, 7];
const sideLabel = { left: '左', right: '右' } as const;
const playbackError = '声を再生できませんでした。もう一度試すか、文字で読めます。';

/** 候補の写真と試聴ボタンを、左右が分かる状態で表示する。 */
function CandidateCard({
  candidate,
  side,
  playing,
  onListen,
}: {
  candidate: VoiceCandidate;
  side: Side;
  playing: boolean;
  onListen: () => void;
}) {
  return (
    <View style={[styles.card, playing && styles.activeCard]}>
      <View style={[styles.portrait, { backgroundColor: candidate.color }]}>
        {candidate.avatar ? (
          <Image source={candidate.avatar} style={styles.portraitImage} accessibilityIgnoresInvertColors />
        ) : (
          <Text style={styles.initials} accessibilityElementsHidden>{candidate.initials}</Text>
        )}
        <View style={styles.sideTag}>
          <Text style={styles.sideTagText}>{sideLabel[side]}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{candidate.name} <Text style={styles.age}>{candidate.age}歳</Text></Text>
        <Text style={styles.tagline}>{candidate.tagline}</Text>
        <Pressable
          accessibilityLabel={playing ? `${candidate.name}の声を止める` : `${sideLabel[side]}から${candidate.name}の声を聴く`}
          accessibilityRole="button"
          onPress={onListen}
          style={({ pressed }) => [
            styles.listen,
            playing && styles.listenActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.listenIcon, playing && styles.listenTextActive]}>{playing ? 'Ⅱ' : '▶'}</Text>
          <Text style={[styles.listenText, playing && styles.listenTextActive]}>{playing ? '再生中' : '声を聴く'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** 試聴、３回の比較、デモでの仮想デートへの移動を管理する。 */
export default function DiscoveryScreen({ active = true, onMatch }: DiscoveryProps) {
  const [picks, setPicks] = useState<VoiceCandidate[]>([]);
  const [current, setCurrent] = useState<Side | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState('');
  const player = useAudioPlayer();
  const nextClip = useRef<VoiceClip | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const swipeOrigin = useRef<SwipeOrigin | null>(null);
  const round = picks.length;
  const left = round === 2 ? picks[0] : voiceCandidates[round * 2];
  const right = round === 2 ? picks[1] : voiceCandidates[round * 2 + 1];
  const winner = picks[2];

  /** 予約していた次の音声も止める。 */
  const stop = useCallback(() => {
    nextClip.current = null;
    player.pause();
    setCurrent(null);
  }, [player]);

  /** 次の音声をプレイヤーに渡す。 */
  const play = useCallback(({ candidate, side }: VoiceClip) => {
    try {
      player.replace(candidate.voices[side]);
      player.play();
      setCurrent(side);
      setError('');
    } catch {
      stop();
      setError(playbackError);
    }
  }, [player, stop]);

  useEffect(() => {
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

  useEventListener(player, 'playbackStatusUpdate', (status) => {
    if (!active) {
      setCurrent(null);
      return;
    }
    if (status.error) {
      stop();
      setError(playbackError);
      return;
    }
    if (!status.didJustFinish) return;
    const queued = nextClip.current;
    nextClip.current = null;
    if (queued) {
      play(queued);
    } else {
      setCurrent(null);
    }
  });

  /** 聴いている声を止めるか、選んだ側の声に切り替える。 */
  function listen(candidate: VoiceCandidate, side: Side) {
    const wasPlaying = current === side;
    stop();
    if (!wasPlaying) play({ candidate, side });
  }

  /** 一度の比較から一人だけを次のラウンドに進める。 */
  const choose = useCallback((side: Side) => {
    const candidate = side === 'left' ? left : right;
    if (!candidate || round >= 3) return;
    stop();
    setError('');
    setShowTranscript(false);
    scroll.current?.scrollTo({ y: 0, animated: false });
    setPicks((previous) => previous.length === round ? [...previous, candidate] : previous);
  }, [left, right, round, stop]);

  /** スワイプ判定の起点として、カード内で始まった単一のタッチを記録する。 */
  function startSwipe({ nativeEvent }: GestureResponderEvent) {
    const touch = nativeEvent.touches.length === 1 && nativeEvent.changedTouches[0];
    swipeOrigin.current = touch
      ? { id: touch.identifier, x: touch.pageX, y: touch.pageY, timestamp: Date.now() }
      : null;
  }

  /** 左右の十分に大きい移動だけを選択とし、縦のスクロールは通常どおり扱う。 */
  function finishSwipe({ nativeEvent }: GestureResponderEvent) {
    const origin = swipeOrigin.current;
    swipeOrigin.current = null;
    if (!origin) return;

    const touch = nativeEvent.changedTouches.find(({ identifier }) => identifier === origin.id);
    if (!touch) return;

    const dx = touch.pageX - origin.x;
    const dy = touch.pageY - origin.y;
    const velocity = Math.abs(dx) / Math.max(1, Date.now() - origin.timestamp);
    if (Math.abs(dx) < Math.abs(dy) * 1.8) return;
    if (Math.abs(dx) >= 54 || (Math.abs(dx) >= 24 && velocity >= 0.55)) {
      choose(dx < 0 ? 'left' : 'right');
    }
  }

  if (winner) {
    return (
      <ScrollView ref={scroll} contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic" directionalLockEnabled>
        <ScreenIntro
          eyebrow="声で出会う"
          title={`${winner.name}と話してみる？`}
          subtitle="気になった相手のAI分身と、短い仮想デートを体験できます。"
        />
        <View style={styles.resultCard}>
          {winner.avatar ? (
            <Image source={winner.avatar} style={styles.resultAvatar} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.resultAvatar, styles.resultInitials, { backgroundColor: winner.color }]}>
              <Text style={styles.initials}>{winner.initials}</Text>
            </View>
          )}
          <View style={styles.resultText}>
            <Text style={styles.resultName}>{winner.name} <Text style={styles.age}>{winner.age}歳</Text></Text>
            <Text style={styles.tagline}>{winner.tagline}</Text>
            <Text style={styles.resultInterests}>{winner.interests.join('・')}</Text>
          </View>
        </View>
        <View style={styles.demoMatch}>
          <Text style={styles.demoMatchTitle}>デモ内でお互いに興味あり</Text>
          <Text style={styles.guide}>架空のプロフィールで、相手側の同意もシミュレーションしています。</Text>
        </View>
        <ActionButton label="仮想デートへ" onPress={() => onMatch(winner)} />
        <ActionButton label="声を選び直す" variant="secondary" onPress={() => {
          setPicks([]);
          scroll.current?.scrollTo({ y: 0, animated: false });
        }} />
      </ScrollView>
    );
  }

  if (!left || !right) return null;

  return (
    <ScrollView ref={scroll} contentContainerStyle={styles.screen} contentInsetAdjustmentBehavior="automatic" directionalLockEnabled>
      <ScreenIntro
        eyebrow="声で出会う"
        title="どちらの声が気になる？"
        subtitle="２人の声を聞き比べて、話してみたい人を選びましょう。"
      />
      <View style={styles.roundBar}>
        <Text style={styles.roundLabel}>{round === 2 ? '最後の比較' : `${round + 1}回目の比較`}</Text>
        <View style={styles.progress} accessibilityLabel={`全３回のうち${round + 1}回目`}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={[styles.progressItem, index <= round && styles.progressCurrent]} />
          ))}
        </View>
      </View>
      <View
        style={styles.row}
        onTouchStart={startSwipe}
        onTouchEnd={finishSwipe}
        onTouchCancel={() => { swipeOrigin.current = null; }}
      >
        <CandidateCard candidate={left} side="left" playing={current === 'left'} onListen={() => listen(left, 'left')} />
        <CandidateCard candidate={right} side="right" playing={current === 'right'} onListen={() => listen(right, 'right')} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (current) {
            stop();
            return;
          }
          nextClip.current = { candidate: right, side: 'right' };
          play({ candidate: left, side: 'left' });
        }}
        style={({ pressed }) => [styles.compareButton, pressed && styles.pressed]}
      >
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.wave}>
          {waveHeights.map((height, index) => (
            <View key={index} style={[styles.waveBar, { height }]} />
          ))}
        </View>
        <Text style={styles.compareText}>{current ? '再生を停止' : '左から順に聴く'}</Text>
      </Pressable>
      <View style={styles.chooseRow}>
        <View style={styles.chooseCell}>
          <ActionButton label={`← ${left.name}を選ぶ`} onPress={() => choose('left')} variant="secondary" />
        </View>
        <View style={styles.chooseCell}>
          <ActionButton label={`${right.name}を選ぶ →`} onPress={() => choose('right')} variant="secondary" />
        </View>
      </View>
      <Text style={styles.guide}>写真の上で、選びたい側にスワイプしても進めます。</Text>
      <Text style={styles.guide}>イヤホンを使うと左右の違いが分かりやすくなります。</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showTranscript }}
        onPress={() => setShowTranscript((shown) => !shown)}
        style={styles.transcriptButton}
      >
        <Text style={styles.transcriptLink}>{showTranscript ? '文字を閉じる' : '自己紹介を文字で読む'}</Text>
      </Pressable>
      {showTranscript && (
        <View style={styles.transcript}>
          <Text selectable style={styles.transcriptText}>{left.introduction}</Text>
          <Text selectable style={styles.transcriptText}>{right.introduction}</Text>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 10, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  roundBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  roundLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  progress: { flexDirection: 'row', gap: 5 },
  progressItem: { width: 17, height: 4, borderRadius: 3, backgroundColor: colors.line },
  progressCurrent: { backgroundColor: colors.accent },
  row: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.line, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface },
  activeCard: { borderColor: colors.accentDark },
  portrait: { aspectRatio: 1.28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  portraitImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  initials: { fontSize: 48, color: colors.ink, fontWeight: '600', opacity: 0.84 },
  sideTag: { position: 'absolute', left: 9, top: 9, borderRadius: 16, backgroundColor: colors.surface, minWidth: 29, height: 27, alignItems: 'center', justifyContent: 'center' },
  sideTagText: { fontWeight: '700', color: colors.ink, fontSize: 12 },
  cardBody: { paddingVertical: 10, paddingHorizontal: 10, gap: 6, flex: 1 },
  name: { fontWeight: '700', color: colors.ink, fontSize: 20 },
  age: { color: colors.muted, fontWeight: '500', fontSize: 12 },
  tagline: { color: colors.muted, fontSize: 12, lineHeight: 18, flexGrow: 1 },
  listen: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: 7, minHeight: 44, paddingHorizontal: 4, borderRadius: 12, backgroundColor: colors.lilac },
  listenActive: { backgroundColor: colors.accentDark },
  listenIcon: { fontSize: 11, color: colors.accentDark },
  listenText: { fontSize: 13, color: colors.accentDark, fontWeight: '700' },
  listenTextActive: { color: colors.white },
  pressed: { opacity: 0.72 },
  compareButton: { paddingHorizontal: 12, minHeight: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', gap: 9, flexDirection: 'row', backgroundColor: colors.peach },
  compareText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  wave: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  waveBar: { width: 2, borderRadius: 2, backgroundColor: colors.accentDark },
  guide: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center' },
  error: { color: colors.accentDark, fontSize: 13, lineHeight: 19 },
  transcriptButton: { minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: -6, marginBottom: -6 },
  transcriptLink: { color: colors.accentDark, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  transcript: { gap: 9, borderRadius: 14, backgroundColor: colors.surface, padding: 12, borderColor: colors.line, borderWidth: 1 },
  transcriptText: { color: colors.ink, fontSize: 13, lineHeight: 20 },
  chooseRow: { flexDirection: 'row', gap: 8 },
  chooseCell: { flex: 1, minWidth: 0 },
  resultCard: { padding: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 15 },
  resultAvatar: { width: 82, height: 102, borderRadius: 15, resizeMode: 'cover' },
  resultInitials: { alignItems: 'center', justifyContent: 'center' },
  resultText: { minWidth: 0, flex: 1, gap: 5 },
  resultName: { color: colors.ink, fontSize: 23, fontWeight: '700' },
  resultInterests: { color: colors.accentDark, fontSize: 12, fontWeight: '600' },
  demoMatch: { backgroundColor: colors.lilac, alignItems: 'center', padding: 13, borderRadius: 16, gap: 4 },
  demoMatchTitle: { color: colors.accentDark, fontSize: 14, fontWeight: '700' },
});
