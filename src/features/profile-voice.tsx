/** Records a temporary, opt-in voice sample and controls the enrolled clone. */

import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamilies, type ThemeColors, useThemeColors } from '../theme';
import { ActionButton } from '../ui';

export type ProfileVoiceApi = {
  enrolled: boolean;
  enroll: (uri: string) => Promise<void>;
  play: (text: string) => Promise<void>;
  remove: () => Promise<void>;
};

type Work = 'starting' | 'recording' | 'finishing' | 'uploading' | 'playing' | 'removing';
type Sample = { uri: string; seconds: number };

const minSeconds = 30;
const maxSeconds = 120;
const recordingOptions = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1 };
const practiceOptions = { ...recordingOptions, isMeteringEnabled: true };
export const practiceSeconds = 30;

/** Deletes an app-created cache file without blocking the voice workflow. */
function deleteSample(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The OS can reclaim the recording directory when clearing the app cache.
  }
}

/** Accepts only recordings that the native recorder wrote to its cache. */
function hasSample(uri: string) {
  try {
    const file = new File(uri);
    return file.exists && file.size > 0;
  } catch {
    return false;
  }
}

/** Restores the audio session to speaker playback after recording. */
function restorePlayback() {
  return setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
}

/** プロフィール入力画面だけで、送信も保存もしない短い練習録音を扱う。 */
export function usePracticeRecording() {
  const supported = Platform.OS === 'ios';
  const [phase, setPhase] = useState<'idle' | 'starting' | 'recording' | 'stopping'>('idle');
  const [sample, setSample] = useState<Sample | null>(null);
  const [message, setMessage] = useState('');
  const mounted = useRef(false);
  const currentPhase = useRef(phase);
  const currentSample = useRef<Sample | null>(null);
  const captureUri = useRef<string | null>(null);
  const startedAt = useRef(0);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  /** 録音操作を直列化し、画面を離れた後の状態更新を避ける。 */
  function changePhase(next: typeof phase) {
    currentPhase.current = next;
    if (mounted.current) setPhase(next);
  }

  /** 使用できる練習音声だけを現在の画面に残す。 */
  async function finish(uri: string | null, seconds: number) {
    const pendingUri = captureUri.current;
    captureUri.current = null;
    changePhase('stopping');
    await restorePlayback();
    if (mounted.current && uri && hasSample(uri)) {
      currentSample.current = { uri, seconds };
      setSample(currentSample.current);
    } else {
      deleteSample(uri ?? pendingUri);
      if (mounted.current) setMessage('録音を読み込めませんでした。もう一度お試しください。');
    }
    changePhase('idle');
  }

  const recorder = useAudioRecorder(practiceOptions, (event) => {
    if (!event.isFinished || currentPhase.current !== 'recording') return;
    const seconds = Math.round((performance.now() - startedAt.current) / 1000);
    void finish(event.hasError ? null : event.url, Math.min(practiceSeconds, seconds));
  });
  const recorderState = useAudioRecorderState(recorder, 125);

  useEffect(() => {
    mounted.current = true;

    /** バックグラウンドでのキャプチャを止めて一時ファイルを削除する。 */
    function interrupt() {
      if (currentPhase.current !== 'recording') return;
      currentPhase.current = 'stopping';
      const uri = captureUri.current;
      captureUri.current = null;
      if (mounted.current) {
        setPhase('stopping');
        setMessage('画面を離れたため、録音を中断しました。');
      }
      void (async () => {
        try {
          await recorder.stop();
        } catch {
          // 画面を離れるとネイティブ録音機が先に解放されることがある。
        } finally {
          deleteSample(uri);
          await restorePlayback();
          currentPhase.current = 'idle';
          if (mounted.current) setPhase('idle');
        }
      })();
    }

    const background = AppState.addEventListener('change', (state) => {
      if (state === 'background') interrupt();
    });

    return () => {
      mounted.current = false;
      background.remove();
      interrupt();
      deleteSample(currentSample.current?.uri ?? null);
      currentSample.current = null;
    };
  }, [recorder]);

  /** 現在の一時録音と試聴中のプレーヤーを初期化する。 */
  function clear() {
    player.pause();
    player.replace(null);
    deleteSample(currentSample.current?.uri ?? null);
    currentSample.current = null;
    setSample(null);
    setMessage('');
  }

  /** マイクの許可を取ってから30秒を上限に録音する。 */
  async function start() {
    if (!supported || currentPhase.current !== 'idle') return;
    clear();
    changePhase('starting');
    let started = false;

    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!mounted.current || AppState.currentState === 'background') return;
      if (!granted) {
        setMessage('録音するには設定でマイクを許可してください。');
        return;
      }
      await Speech.stop().catch(() => {});
      if (!mounted.current || AppState.currentState === 'background') return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!mounted.current || AppState.currentState === 'background') return;
      await recorder.prepareToRecordAsync();
      captureUri.current = recorder.uri;
      if (!mounted.current || AppState.currentState === 'background') return;

      startedAt.current = performance.now();
      changePhase('recording');
      recorder.record({ forDuration: practiceSeconds });
      started = true;
    } catch {
      if (mounted.current) setMessage('録音を開始できませんでした。もう一度お試しください。');
    } finally {
      if (!started) {
        deleteSample(captureUri.current);
        captureUri.current = null;
        await restorePlayback();
        changePhase('idle');
      }
    }
  }

  /** 途中で停止した音声を、この画面で試聴できるようにする。 */
  async function stop() {
    if (currentPhase.current !== 'recording') return;
    changePhase('stopping');
    let uri: string | null = null;
    const seconds = Math.floor((performance.now() - startedAt.current) / 1000);
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch {
      // 読み込めない録音の削除と再試行は finish が扱う。
    }
    await finish(uri, seconds);
  }

  /** 一時録音の試聴を開始するか、進行中なら停止する。 */
  function togglePlayback() {
    if (!sample) return;
    try {
      if (playerStatus.playing) player.pause();
      else {
        player.replace(sample.uri);
        player.play();
      }
    } catch {
      setMessage('録音を試聴できませんでした。');
    }
  }

  return {
    supported, phase, sample, message, start, stop, clear, togglePlayback,
    playing: playerStatus.playing,
    seconds: Math.min(practiceSeconds, phase === 'recording'
      ? Math.floor(recorderState.durationMillis / 1000)
      : sample?.seconds ?? 0),
    metering: recorderState.metering,
  };
}

/** An accessible confirmation for voice ownership or sending a sample. */
function VoiceConfirmation({ checked, label, onPress, disabled }: {
  checked: boolean;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const styles = createStyles(useThemeColors());
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.confirmation}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={styles.confirmationText}>{label}</Text>
    </Pressable>
  );
}

/** The iOS controls are mounted only while the profile tab is active. */
export function ProfileVoice({ api, introduction }: { api: ProfileVoiceApi; introduction: string }) {
  const styles = createStyles(useThemeColors());
  const [ownsVoice, setOwnsVoice] = useState(false);
  const [allowsUpload, setAllowsUpload] = useState(false);
  const [sample, setSample] = useState<Sample | null>(null);
  const [work, setWork] = useState<Work | null>(null);
  const [message, setMessage] = useState('');

  const mounted = useRef(false);
  const currentWork = useRef<Work | null>(null);
  const currentSample = useRef<Sample | null>(null);
  const captureUri = useRef<string | null>(null);
  const startedAt = useRef(0);

  /** Clears the current sample so it cannot be submitted or played again. */
  function clearSample() {
    deleteSample(currentSample.current?.uri ?? null);
    currentSample.current = null;
    setSample(null);
    setAllowsUpload(false);
  }

  /** Updates busy state and guards against rapid duplicate taps. */
  function changeWork(next: Work | null) {
    currentWork.current = next;
    if (mounted.current) setWork(next);
  }

  /** Keeps only usable samples and resets the system audio session in every case. */
  async function finishSample(uri: string | null, seconds: number) {
    const fileToRemove = captureUri.current;
    captureUri.current = null;
    changeWork('finishing');
    await restorePlayback();

    const recordedUri = uri && hasSample(uri) ? uri : null;
    if (recordedUri && seconds >= minSeconds && seconds <= maxSeconds && mounted.current) {
      currentSample.current = { uri: recordedUri, seconds };
      setSample(currentSample.current);
    } else {
      deleteSample(uri ?? fileToRemove);
      if (mounted.current) {
        setMessage(recordedUri
          ? '録音は30〜120秒にしてください。もう一度録音できます。'
          : '録音を保存できませんでした。もう一度お試しください。');
      }
    }
    changeWork(null);
  }

  const recorder = useAudioRecorder(recordingOptions, (status) => {
    if (currentWork.current !== 'recording' || !status.isFinished) return;
    const elapsed = Math.round((performance.now() - startedAt.current) / 1000);
    void finishSample(status.hasError ? null : status.url, Math.min(elapsed, maxSeconds));
  });
  const recorderState = useAudioRecorderState(recorder, 250);

  useEffect(() => {
    mounted.current = true;

    /** Stops a capture leaving the app and discards anything not explicitly saved for upload. */
    function stopInterruptedCapture() {
      if (currentWork.current !== 'starting' && currentWork.current !== 'recording') return;

      if (currentWork.current === 'starting') {
        // The start operation sees a non-active app after its awaited step completes.
        return;
      }

      const uri = captureUri.current;
      captureUri.current = null;
      currentWork.current = 'finishing';
      if (mounted.current) {
        setWork('finishing');
        setMessage('画面を離れたため、録音を中断しました。');
      }

      void (async () => {
        try {
          await recorder.stop();
        } catch {
          // The native recorder may already have been released.
        } finally {
          deleteSample(uri);
          await restorePlayback();
          currentWork.current = null;
          if (mounted.current) setWork(null);
        }
      })();
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') stopInterruptedCapture();
    });

    return () => {
      mounted.current = false;
      subscription.remove();
      stopInterruptedCapture();
      if (currentWork.current !== 'uploading') deleteSample(currentSample.current?.uri ?? null);
    };
  }, [recorder]);

  /** Prepares and starts a consented recording, limited by the native recorder to 120 seconds. */
  async function startCapture() {
    if (!ownsVoice || currentWork.current) return;
    clearSample();
    setMessage('');
    changeWork('starting');

    let readyToRecord = false;
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!mounted.current) return;
      if (!granted) {
        setMessage('録音するには、iPhoneの設定でマイクを許可してください。');
        return;
      }
      if (AppState.currentState === 'background') return;

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!mounted.current || AppState.currentState === 'background') return;
      await recorder.prepareToRecordAsync();
      captureUri.current = recorder.uri;
      if (!mounted.current || AppState.currentState === 'background') return;

      startedAt.current = performance.now();
      changeWork('recording');
      recorder.record({ forDuration: maxSeconds });
      readyToRecord = true;
    } catch {
      if (mounted.current) setMessage('録音を開始できませんでした。もう一度お試しください。');
    } finally {
      if (!readyToRecord) {
        deleteSample(captureUri.current);
        captureUri.current = null;
        await restorePlayback();
        changeWork(null);
      }
    }
  }

  /** Ends recording, preserving the native duration before the recorder resets it. */
  async function stopCapture() {
    if (currentWork.current !== 'recording') return;
    changeWork('finishing');

    let uri: string | null = null;
    let seconds = 0;
    try {
      seconds = Math.floor(recorder.getStatus().durationMillis / 1000);
      await recorder.stop();
      uri = recorder.uri;
    } catch {
      // A missing recording is handled as a retryable failure in finishSample.
    }
    await finishSample(uri, seconds);
  }

  /** Uploads only after the separate transmission confirmation has been checked. */
  async function upload() {
    if (currentWork.current || !sample || !ownsVoice || !allowsUpload) return;
    changeWork('uploading');
    setMessage('');
    try {
      await api.enroll(sample.uri);
      if (mounted.current) {
        clearSample();
        setOwnsVoice(false);
        setMessage('自分の声を登録しました。');
      }
    } catch {
      if (mounted.current) setMessage('声を登録できませんでした。接続を確認して再試行してください。');
    } finally {
      if (!mounted.current) deleteSample(sample.uri);
      changeWork(null);
    }
  }

  /** Requests a preview in the registered voice when explicitly chosen. */
  async function play() {
    const text = introduction.trim();
    if (!text || currentWork.current) return;
    changeWork('playing');
    setMessage('');
    try {
      await api.play(text);
    } catch {
      if (mounted.current) setMessage('自分の声で再生できませんでした。端末の合成音声でも試聴できます。');
    } finally {
      changeWork(null);
    }
  }

  /** Revokes the enrolled voice after the user confirms deletion. */
  function requestRemoval() {
    Alert.alert(
      '登録した声を削除しますか？',
      '設定済みサーバーからElevenLabsへ、音声クローンの削除を依頼します。',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: () => void remove() },
      ],
    );
  }

  /** Runs remote removal and explains when it fails so the user can retry. */
  async function remove() {
    if (currentWork.current) return;
    changeWork('removing');
    setMessage('');
    try {
      await api.remove();
      if (mounted.current) setMessage('登録した声を削除しました。');
    } catch {
      if (mounted.current) setMessage('声を削除できませんでした。接続を確認して再試行してください。');
    } finally {
      changeWork(null);
    }
  }

  const isRecording = work === 'recording';
  const seconds = Math.min(maxSeconds, Math.floor(recorderState.durationMillis / 1000));

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>自分の声で紹介する</Text>
      {api.enrolled ? (
        <>
          <Text style={styles.hint}>試聴すると、紹介文を設定済みサーバー経由でElevenLabsに送って読み上げます。</Text>
          <ActionButton
            label={work === 'playing' ? '音声を準備中…' : '自分の声で試聴'}
            onPress={() => void play()}
            disabled={!introduction.trim() || work !== null}
          />
          <ActionButton
            label={work === 'removing' ? '削除中…' : '登録した声を削除'}
            onPress={requestRemoval}
            disabled={work !== null}
            variant="secondary"
          />
        </>
      ) : (
        <>
          <Text style={styles.hint}>本人の声を30〜120秒録音します。音声だけを登録し、紹介文はあとで試聴できます。</Text>
          <VoiceConfirmation
            label="自分自身の声を録音します"
            checked={ownsVoice}
            onPress={() => setOwnsVoice(!ownsVoice)}
            disabled={work !== null || sample !== null}
          />
          {isRecording ? (
            <>
              <Text style={styles.timer}>録音中　{seconds}秒 / {maxSeconds}秒</Text>
              <ActionButton label="録音を終了" onPress={() => void stopCapture()} />
            </>
          ) : (
            <ActionButton
              label={work === 'starting' ? '録音を準備中…' : work === 'finishing' ? '録音を保存中…' : sample ? '録り直す' : '録音を開始'}
              onPress={() => void startCapture()}
              disabled={!ownsVoice || work !== null}
              variant={sample ? 'secondary' : 'primary'}
            />
          )}
          {sample ? (
            <>
              <Text style={styles.timer}>{sample.seconds}秒の録音</Text>
              <VoiceConfirmation
                label="録音を設定済みサーバー経由でElevenLabsに送信し、音声クローンを作成することに同意します"
                checked={allowsUpload}
                onPress={() => setAllowsUpload(!allowsUpload)}
                disabled={work !== null}
              />
              <ActionButton
                label={work === 'uploading' ? '声を登録中…' : '録音を送信して登録'}
                onPress={() => void upload()}
                disabled={!allowsUpload || work !== null}
              />
              <ActionButton label="録音を破棄" variant="secondary" onPress={clearSample} disabled={work !== null} />
            </>
          ) : null}
        </>
      )}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{message}</Text> : null}
    </View>
  );
}

/** 登録済みの声の設定にも、表示中のテーマを適用する。 */
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      padding: 18,
      gap: 12,
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 24,
      borderCurve: 'continuous',
    },
    title: { color: colors.ink, fontFamily: fontFamilies.bodyBold, fontSize: 19 },
    hint: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 20 },
    timer: { color: colors.accentDark, fontFamily: fontFamilies.numbers, fontSize: 15, fontVariant: ['tabular-nums'] },
    confirmation: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
    confirmationText: { flex: 1, color: colors.ink, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
    checkbox: {
      width: 24,
      height: 24,
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: colors.primary },
    checkmark: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  });
}
