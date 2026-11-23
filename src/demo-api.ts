/** オプションのローカルAPIを利用するネイティブ画面の処理。 */
import { fetch } from 'expo/fetch';
import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { useAudioPlayer } from 'expo-audio';
import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { Candidate, VoiceProfile } from './types';

const baseUrl = process.env.EXPO_PUBLIC_KOE_API_URL?.trim().replace(/\/+$/, '');
const enabled = Platform.OS !== 'web' && !!baseUrl;
const keyName = 'koe-match.enrollment-v1';
type Capabilities = { profile: boolean; voice: boolean };
type DateInput = { candidate: Candidate; context: string; message: string };

/** タイムアウトを設け、サーバーが返したエラーを入力画面へ戻す。 */
async function request(path: string, options: RequestInit = {}, enrollment?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(baseUrl + path, {
      ...options,
      headers: {
        'X-Koe-Client': 'native-demo',
        ...(enrollment ? { 'X-Koe-Enrollment': enrollment } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(error.error || 'サービスへ接続できませんでした。');
    }
    if (response.headers.get('content-type')?.includes('audio/mpeg')) {
      return { bytes: new Uint8Array(await response.arrayBuffer()) };
    }
    return await response.json() as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

/** ローカルAPIのJSON操作を呼び出す。 */
function post(path: string, data: unknown, enrollment?: string) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }, enrollment);
}

/** 設定がある場合のみ、プロフィール生成・仮想デート・音声登録を公開する。 */
export function useDemoApi(profileIsVisible: boolean) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [enrollment, setEnrollment] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const player = useAudioPlayer(null);
  const audioFile = useRef<File | null>(null);
  const visible = useRef(profileIsVisible);
  const playbackSequence = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void (async () => {
      const result = await request('/capabilities');
      if (!alive) return;
      const next = { profile: result.profile === true, voice: result.voice === true && Platform.OS === 'ios' };
      setCapabilities(next);
      if (!next.voice) return;

      let key = await SecureStore.getItemAsync(keyName);
      if (!key) {
        key = randomUUID();
        await SecureStore.setItemAsync(keyName, key);
      }
      const status = await request('/voice', {}, key);
      if (alive) {
        setEnrollment(key);
        setEnrolled(status.enrolled === true);
      }
    })().catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    visible.current = profileIsVisible;
    if (!profileIsVisible) {
      playbackSequence.current++;
      player.pause();
      const file = audioFile.current;
      audioFile.current = null;
      if (file) deleteAudio(file);
    }
  }, [player, profileIsVisible]);

  useEffect(() => () => { if (audioFile.current) deleteAudio(audioFile.current); }, []);

  return {
    generateProfile: capabilities?.profile ? async (profile: VoiceProfile) => {
      const result = await post('/profile', {
        name: profile.name,
        entries: profile.entries.slice(0, 12).map(({ kind, text }) => ({ kind, text })),
      });
      return responseText(result.text);
    } : undefined,
    generateReply: capabilities?.profile ? async ({ candidate, context, message }: DateInput) => {
      const result = await post('/date/reply', {
        name: candidate.name,
        introduction: candidate.introduction,
        context,
        message,
      });
      return responseText(result.text);
    } : undefined,
    voiceApi: enrollment ? {
      enrolled,
      enroll: async (uri: string) => {
        const result = await request('/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'audio/mp4' },
          body: new File(uri),
        }, enrollment);
        setEnrolled(result.enrolled === true);
        if (result.requiresVerification === true) {
          throw new Error('録音を登録しました。ElevenLabs側で本人確認を済ませると試聴できます。');
        }
      },
      play: async (text: string) => {
        const sequence = ++playbackSequence.current;
        const result = await post('/voice/preview', { text }, enrollment);
        if (!visible.current || sequence !== playbackSequence.current) return;
        if (!(result.bytes instanceof Uint8Array)) throw new Error('試聴用の音声を取得できませんでした。');
        await Speech.stop();
        if (!visible.current || sequence !== playbackSequence.current) return;
        const next = new File(Paths.cache, 'koe-match-' + randomUUID() + '.mp3');
        const previous = audioFile.current;
        next.write(result.bytes);
        audioFile.current = next;
        player.replace(next.uri);
        player.play();
        if (previous) deleteAudio(previous);
      },
      remove: async () => {
        playbackSequence.current++;
        player.pause();
        if (audioFile.current) {
          deleteAudio(audioFile.current);
          audioFile.current = null;
        }
        await request('/voice', { method: 'DELETE' }, enrollment);
        setEnrolled(false);
      },
    } : undefined,
  };
}

/** 生成結果を文字列として検証する。 */
function responseText(text: unknown) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('AIの返答を取得できませんでした。');
  return text;
}

/** 試聴用キャッシュを破棄する。 */
function deleteAudio(file: File) {
  try { if (file.exists) file.delete(); } catch {}
}
