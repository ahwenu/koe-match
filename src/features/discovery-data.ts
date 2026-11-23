/** Voice-matching の架空の候補と、左右に振り分けた試聴用音声。 */
import type { Candidate } from '../types';

export type Side = 'left' | 'right';
export type VoiceCandidate = Candidate & {
  speechStyle: string;
  voiceCredit: string;
  voices: Record<Side, number>;
};

export const voiceCandidates: readonly VoiceCandidate[] = [
  {
    id: 'asmr-risa',
    name: 'リサ',
    tagline: '映画のあと、もう少しだけ歩く',
    introduction: 'リサです。映画のあと、もう少しだけ、一緒に歩かない？',
    interests: ['映画', '散歩'],
    color: '#DCE7D5',
    initials: 'リ',
    speechStyle: 'ささやき',
    voiceCredit: 'VOICEVOX:九州そら（ささやき）',
    voices: {
      left: require('../../assets/voices/risa-left.wav'),
      right: require('../../assets/voices/risa-right.wav'),
    },
  },
  {
    id: 'asmr-akari',
    name: 'あかり',
    tagline: '雨の日、傘を分け合う',
    introduction: 'あかりです。雨、やまないね。駅まで、この傘に入ってく？もうちょっと、こっちにおいで。',
    interests: ['雨の日', '街歩き'],
    color: '#F8DAE4',
    initials: 'あ',
    speechStyle: 'ささやき',
    voiceCredit: 'VOICEVOX:四国めたん（ささやき）',
    voices: {
      left: require('../../assets/voices/akari-left.wav'),
      right: require('../../assets/voices/akari-right.wav'),
    },
  },
  {
    id: 'asmr-shiori',
    name: 'しおり',
    tagline: 'イヤホンを片方ずつ、好きな曲を聴く',
    introduction: 'しおりです。あ、この曲。片方どうぞ。サビだけ、一緒に聴いて？',
    interests: ['音楽', '好きな曲'],
    color: '#D4E5EF',
    initials: 'し',
    speechStyle: 'ヒソヒソ',
    voiceCredit: 'VOICEVOX:中部つるぎ（ヒソヒソ）',
    voices: {
      left: require('../../assets/voices/shiori-left.wav'),
      right: require('../../assets/voices/shiori-right.wav'),
    },
  },
  {
    id: 'asmr-sana',
    name: 'さな',
    tagline: 'おやすみのあとも、少し電話する',
    introduction: 'さなです。おやすみって言ったのにね。もうちょっとだけ、電話してていい？',
    interests: ['電話', '夜の過ごし方'],
    color: '#FFF1B8',
    initials: 'さ',
    speechStyle: 'ささやき',
    voiceCredit: 'VOICEVOX:あんこもん（ささやき）',
    voices: {
      left: require('../../assets/voices/sana-left.wav'),
      right: require('../../assets/voices/sana-right.wav'),
    },
  },
];
