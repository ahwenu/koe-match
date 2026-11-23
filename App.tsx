/** Koe Matchのナビゲーションと、各機能間で共有する状態。 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import DateScreen from './src/features/date';
import DiscoveryScreen from './src/features/discovery';
import ProfileScreen from './src/features/profile';
import { colors } from './src/theme';
import { useDemoApi } from './src/demo-api';
import type { Candidate, VoiceProfile } from './src/types';

type Tab = 'discovery' | 'profile' | 'date';

const profileStorageKey = 'koe-match/voice-profile/v1';
const emptyProfile: VoiceProfile = { name: '', entries: [], introduction: '', approved: false };
const tabs: { id: Tab; label: string }[] = [
  { id: 'discovery', label: '見つける' },
  { id: 'profile', label: 'プロフィール' },
  { id: 'date', label: '仮想デート' },
];

/** 日本語の合成音声でアプリ内の返答を再生する。 */
function speak(text: string) {
  void Speech.stop().then(() => {
    Speech.speak(text, { language: 'ja-JP', rate: 0.91, useApplicationAudioSession: false });
  }).catch(() => {});
}

/** 波形アイコンと３画面の切り替えを含むアプリ本体。 */
export default function App() {
  const [tab, setTab] = useState<Tab>('discovery');
  const [profile, setProfile] = useState(emptyProfile);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [match, setMatch] = useState<{ candidate: Candidate; sequence: number } | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const { generateProfile, generateReply, voiceApi } = useDemoApi(tab === 'profile');

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

  /** タブが変わるときだけ、入力と読み上げを停止する。 */
  function openTab(next: Tab) {
    if (next === tab) return;
    Keyboard.dismiss();
    void Speech.stop();
    setTab(next);
  }

  /** 選んだ候補で新しい仮想デートを開く。 */
  function openDate(candidate: Candidate) {
    setMatch(previous => ({ candidate, sequence: (previous?.sequence ?? 0) + 1 }));
    openTab('date');
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.frame} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <View style={styles.brand}>
              <View accessible={false} style={styles.logo}>
                {[8, 15, 22, 13, 6].map((height, index) => (
                  <View key={index} style={[styles.logoBar, { height }]} />
                ))}
              </View>
              <Text accessibilityRole="header" style={styles.wordmark}>Koe Match</Text>
            </View>
            <Text style={styles.demo}>デモ</Text>
          </View>

          <View style={styles.main}>
            <View style={[styles.screen, tab !== 'discovery' && styles.hidden]}>
              <DiscoveryScreen active={tab === 'discovery'} onMatch={openDate} />
            </View>
            <View style={[styles.screen, tab !== 'profile' && styles.hidden]}>
              {ready ? (
                <>
                  {storageError ? <Text accessibilityRole="alert" style={styles.storageError}>{storageError}</Text> : null}
                  <ProfileScreen profile={profile} onChange={changeProfile} speak={speak} active={tab === 'profile'} generateProfile={generateProfile} voiceApi={voiceApi} />
                </>
              ) : <ActivityIndicator color={colors.accent} style={styles.loading} />}
            </View>
            <View style={[styles.screen, tab !== 'date' && styles.hidden]}>
              <DateScreen key={match?.sequence ?? 0} candidate={match?.candidate ?? null} onDiscover={() => openTab('discovery')} speak={speak} active={tab === 'date'} generateReply={generateReply} />
            </View>
          </View>

          <View style={styles.tabBar}>
            {tabs.map(({ id, label }) => (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === id }}
                onPress={() => openTab(id)}
                style={({ pressed }) => [styles.tab, tab === id && styles.activeTab, pressed && styles.pressed]}
              >
                <Text style={[styles.tabLabel, tab === id && styles.activeLabel]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  frame: { flex: 1, alignSelf: 'center', maxWidth: 600, width: '100%' },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 59,
    paddingHorizontal: 22,
  },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  logo: { alignItems: 'center', flexDirection: 'row', gap: 2.5, height: 24 },
  logoBar: { backgroundColor: colors.accent, borderRadius: 2, width: 3 },
  wordmark: {
    color: colors.ink,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  demo: {
    backgroundColor: colors.lilac,
    borderRadius: 12,
    color: colors.accentDark,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  main: { flex: 1 },
  screen: { flex: 1 },
  hidden: { display: 'none' },
  loading: { marginTop: 36 },
  storageError: { color: colors.accentDark, paddingHorizontal: 22, paddingTop: 9 },
  tabBar: { borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingVertical: 7 },
  tab: { alignItems: 'center', borderRadius: 13, flex: 1, justifyContent: 'center', minHeight: 45 },
  activeTab: { backgroundColor: colors.lilac },
  tabLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  activeLabel: { color: colors.accentDark, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
