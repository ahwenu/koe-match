/** 聴きくらべの選択音と、マッチ成立音を再生する。 */
import { useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

// OtoLogic「ボタン ポチッ01-1」「キラキラ02-1」（CC BY 4.0）。長さと音量を調整。
const selectionSource = require('../../assets/sounds/selection_Onoma-Button-Click01-1.wav');
const matchSource = require('../../assets/sounds/match_Onoma-Sparkle02-1.wav');

/** 画面を表示している間だけ、同梱の効果音を重ねずに鳴らす。 */
export function useDiscoverySounds(active: boolean) {
  const selection = useAudioPlayer(selectionSource);
  const match = useAudioPlayer(matchSource);
  const canPlay = useRef(active);

  useEffect(() => {
    canPlay.current = active;
    if (!active) {
      if (selection.playing) selection.pause();
      if (match.playing) match.pause();
    }
    return () => { canPlay.current = false; };
  }, [active, match, selection]);

  return useCallback(async (cue: 'selection' | 'match') => {
    if (!canPlay.current) return;
    const player = cue === 'selection' ? selection : match;
    const other = cue === 'selection' ? match : selection;
    try {
      if (other.playing) other.pause();
      if (player.currentTime > 0) await player.seekTo(0);
      if (canPlay.current) player.play();
    } catch {
      // 比較やマッチの進行は再生の成否に関わらず続ける。
    }
  }, [match, selection]);
}
