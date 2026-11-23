/** Koe Matchのナビゲーションと、各機能間で共有する状態。 */
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { NotoSansJP_400Regular } from '@expo-google-fonts/noto-sans-jp/400Regular';
import { NotoSansJP_700Bold } from '@expo-google-fonts/noto-sans-jp/700Bold';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { Headphones, Heart, MessageCircle, Mic, UserRound } from 'lucide-react-native';
import { Fragment, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useDemoApi } from './src/demo-api';
import DateScreen from './src/features/date';
import DiscoveryScreen from './src/features/discovery';
import ProfileScreen from './src/features/profile';
import WelcomeScreen from './src/features/welcome';
import { fontFamilies, useThemeColors } from './src/theme';
import type { Candidate, VoiceProfile } from './src/types';
import { ActionButton, ScreenIntro } from './src/ui';

type Tab = 'discovery' | 'matches' | 'date' | 'profile';
type ProfileMode = 'record' | 'review';

const profileStorageKey = 'koe-match/voice-profile/v1';
const emptyProfile: VoiceProfile = { name: '', entries: [], introduction: '', approved: false };
const tabs = [
  { id: 'discovery', label: 'さがす', Icon: Headphones },
  { id: 'matches', label: 'マッチ', Icon: Heart },
  { id: 'date', label: 'トーク', Icon: MessageCircle },
  { id: 'profile', label: 'マイページ', Icon: UserRound },
] as const;

const fonts = {
  [fontFamilies.body]: NotoSansJP_400Regular,
  [fontFamilies.bodyBold]: NotoSansJP_700Bold,
  [fontFamilies.numbers]: Inter_600SemiBold,
};

/** 日本語の合成音声でアプリ内の返答を再生する。 */
function speak(text: string) {
  void Speech.stop().then(() => {
    Speech.speak(text, { language: 'ja-JP', rate: 0.91, useApplicationAudioSession: false });
  }).catch(() => {});
}

/** 画面遷移と、現在の画面で使う音声入力への入口を表示する。 */
function VoiceDock({ tab, onTab, onVoice }: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  onVoice: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View accessibilityRole="tablist" style={[styles.dock, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {tabs.map(({ id, label, Icon }, index) => {
        const selected = tab === id;
        const tint = selected ? colors.accentDark : colors.muted;
        return (
          <Fragment key={id}>
            {index === 2 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="音声入力"
                onPress={onVoice}
                style={({ pressed }) => [styles.mic, { backgroundColor: colors.primary }, pressed && styles.pressed]}
              >
                <Mic size={24} color={colors.onPrimary} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
              onPress={() => onTab(id)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Icon size={20} color={tint} />
              <Text numberOfLines={1} style={[styles.tabLabel, { color: tint }]}>{label}</Text>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

/** オンボーディング、タブ切替、プロフィールとマッチの共有状態を管理する。 */
export default function App() {
  const colors = useThemeColors();
  const [fontsLoaded, fontError] = useFonts(fonts);
  const [started, setStarted] = useState(false);
  const [tab, setTab] = useState<Tab>('discovery');
  const [profile, setProfile] = useState(emptyProfile);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [onboarding, setOnboarding] = useState(false);
  const [profileMode, setProfileMode] = useState<ProfileMode>('review');
  const [recordRequest, setRecordRequest] = useState(0);
  const [discoveryVoice, setDiscoveryVoice] = useState(0);
  const [dateVoice, setDateVoice] = useState(0);
  const [datePracticing, setDatePracticing] = useState(false);
  const [availableMatch, setAvailableMatch] = useState<Candidate | null>(null);
  const [match, setMatch] = useState<{ candidate: Candidate; sequence: number } | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const { generateProfile, generateReply, voiceApi } = useDemoApi(started && tab === 'profile' && profileMode === 'review');

  useEffect(() => {
    let disposed = false;
    void AsyncStorage.getItem(profileStorageKey).then(value => {
      if (!disposed && value) setProfile(JSON.parse(value) as VoiceProfile);
    }).catch(() => {
      if (!disposed) setStorageError('端末に保存したプロフィールを読み込めませんでした。');
    }).finally(() => {
      if (!disposed) setReady(true);
    });
    return () => { disposed = true; };
  }, []);

  /** 保存順を保って、画面の変更を端末へ反映する。 */
  function changeProfile(next: VoiceProfile) {
    setProfile(next);
    saveQueue.current = saveQueue.current.then(async () => {
      await AsyncStorage.setItem(profileStorageKey, JSON.stringify(next));
      setStorageError('');
    }).catch(() => setStorageError('端末に保存できませんでした。入力し直す前に、もう一度保存してください。'));
  }

  /** 最初の操作に合わせて、自己紹介または聴き比べを開く。 */
  function begin(setUpProfile: boolean) {
    setOnboarding(setUpProfile);
    setProfileMode(setUpProfile ? 'record' : 'review');
    setTab(setUpProfile ? 'profile' : 'discovery');
    setStarted(true);
  }

  /** タブが変わるときだけ、入力と読み上げを停止する。 */
  function openTab(next: Tab) {
    if (next === tab) return;
    Keyboard.dismiss();
    void Speech.stop();
    setOnboarding(false);
    setTab(next);
  }

  /** 選んだ候補で新しいデート練習を開く。 */
  function openDate(candidate: Candidate) {
    setDatePracticing(false);
    setMatch(previous => ({ candidate, sequence: (previous?.sequence ?? 0) + 1 }));
    openTab('date');
  }

  /** 中央のマイクを、開いている画面の音声入力につなぐ。 */
  function openVoiceInput() {
    if (tab === 'profile') {
      setRecordRequest(previous => previous + 1);
    } else if (tab === 'date' && match) {
      setDateVoice(previous => previous + 1);
    } else {
      openTab('discovery');
      setDiscoveryVoice(previous => previous + 1);
    }
  }

  const discoveryActive = tab === 'discovery' || (tab === 'matches' && availableMatch !== null);
  const hideDock = (tab === 'profile' && profileMode === 'record') || (tab === 'date' && datePracticing);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        {!ready ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : !started ? (
          <WelcomeScreen onStart={() => begin(!profile.approved)} onSkip={() => begin(false)} />
        ) : (
          <KeyboardAvoidingView style={styles.frame} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.main}>
              <View style={[styles.screen, !discoveryActive && styles.hidden]}>
                <DiscoveryScreen
                  active={discoveryActive}
                  onMatch={openDate}
                  onMatchAvailable={setAvailableMatch}
                  onDismissMatch={() => openTab('profile')}
                  voiceRequest={discoveryVoice}
                />
              </View>
              {tab === 'matches' && !availableMatch ? (
                <View style={styles.empty}>
                  <ScreenIntro title="マッチ" subtitle="気になる声を見つけると、ここに相手が表示されます。" />
                  <ActionButton label="声を探す" onPress={() => openTab('discovery')} />
                </View>
              ) : null}
              <View style={[styles.screen, tab !== 'profile' && styles.hidden]}>
                {storageError ? <Text accessibilityRole="alert" style={[styles.storageError, { color: colors.accentDark }]}>{storageError}</Text> : null}
                <ProfileScreen
                  profile={profile}
                  onChange={changeProfile}
                  speak={speak}
                  active={tab === 'profile'}
                  generateProfile={generateProfile}
                  voiceApi={voiceApi}
                  initialMode={profileMode}
                  onModeChange={setProfileMode}
                  recordRequest={recordRequest}
                  onApproved={onboarding ? () => openTab('discovery') : undefined}
                  onBackToWelcome={onboarding ? () => {
                    Keyboard.dismiss();
                    void Speech.stop();
                    setStarted(false);
                  } : undefined}
                />
              </View>
              <View style={[styles.screen, tab !== 'date' && styles.hidden]}>
                <DateScreen
                  key={match?.sequence ?? 0}
                  candidate={match?.candidate ?? null}
                  onDiscover={() => openTab('discovery')}
                  speak={speak}
                  active={tab === 'date'}
                  generateReply={generateReply}
                  voiceRequest={dateVoice}
                  onPracticeChange={setDatePracticing}
                />
              </View>
            </View>
            {hideDock ? null : <VoiceDock tab={tab} onTab={openTab} onVoice={openVoiceInput} />}
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  frame: { flex: 1, alignSelf: 'center', maxWidth: 600, width: '100%' },
  main: { flex: 1 },
  screen: { flex: 1 },
  hidden: { display: 'none' },
  empty: { gap: 20, padding: 20 },
  loader: { flex: 1 },
  storageError: { fontFamily: fontFamilies.body, fontSize: 12, paddingHorizontal: 20, paddingTop: 8 },
  dock: { alignItems: 'center', flexDirection: 'row', borderRadius: 24, borderWidth: 1, marginHorizontal: 16, minHeight: 72, paddingHorizontal: 8 },
  mic: { alignItems: 'center', justifyContent: 'center', borderRadius: 28, height: 56, width: 56 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 48 },
  tabLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 10 },
  pressed: { opacity: 0.72 },
});
