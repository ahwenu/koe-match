/** 聴きくらべの途中経過と確定した相手を端末に保存する。 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';

import type { VoiceCandidate } from './discovery-data';

const storageKey = 'koe-match/voice-comparison/v1';
let pendingSave: Promise<void> = Promise.resolve();

/** 現在のラウンド分けに合う候補を先頭から復元する。 */
function restoreComparisonPicks(value: string, candidates: readonly VoiceCandidate[]) {
  const ids: unknown = JSON.parse(value);
  if (!Array.isArray(ids)) throw new Error('Invalid voice comparison progress');

  const picks: VoiceCandidate[] = [];
  for (const [round, id] of ids.slice(0, 3).entries()) {
    const pair = round === 2 ? picks : candidates.slice(round * 2, round * 2 + 2);
    const candidate = pair.find(option => option.id === id);
    if (!candidate) break;
    picks.push(candidate);
  }
  return picks;
}

/** 候補の ID のみを、選択やリセットの順番どおりに書き込む。 */
function saveComparisonPicks(picks: VoiceCandidate[]) {
  const save = pendingSave.then(() => picks.length
    ? AsyncStorage.setItem(storageKey, JSON.stringify(picks.map(candidate => candidate.id)))
    : AsyncStorage.removeItem(storageKey),
  );
  pendingSave = save.catch(() => {});
  return save;
}

/** 保存済みデータを読み終えてから、画面の選択操作を受け付ける。 */
export function useVoiceComparisonProgress(candidates: readonly VoiceCandidate[]) {
  const [picks, showPicks] = useState<VoiceCandidate[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const currentPicks = useRef(picks);
  const mounted = useRef(false);
  const storageAvailable = useRef(false);

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    storageAvailable.current = false;
    void pendingSave.then(() => AsyncStorage.getItem(storageKey)).then(value => {
      if (cancelled) return;
      storageAvailable.current = true;
      const restored = value === null ? [] : restoreComparisonPicks(value, candidates);
      currentPicks.current = restored;
      showPicks(restored);
    }).catch(() => {
      if (!cancelled) setError(storageAvailable.current
        ? '保存した聴きくらべを読み込めませんでした。新しい比較を始められます。'
        : '端末の保存領域を読み込めませんでした。今回の選択はこの起動中だけ使えます。',
      );
    }).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [candidates]);

  /** 連続入力は最新の選択に対し評価し、追加やリセットを即座に表示する。 */
  const setPicks = useCallback((update: SetStateAction<VoiceCandidate[]>) => {
    if (!ready) return;
    const previous = currentPicks.current;
    const next = typeof update === 'function' ? update(previous) : update;
    if (next === previous) return;

    currentPicks.current = next;
    showPicks(next);
    if (!storageAvailable.current) return;

    void saveComparisonPicks(next).then(() => {
      if (mounted.current) setError('');
    }).catch(() => {
      if (mounted.current) setError('聴きくらべの選択を保存できませんでした。');
    });
  }, [ready]);

  return { picks, setPicks, ready, error };
}
