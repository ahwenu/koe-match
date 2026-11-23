/** 声の聞き比べに使う、架空の成人プロフィールと試聴用音声。 */
import type { Candidate } from '../types';

export type Side = 'left' | 'right';
export type VoiceCandidate = Candidate & { voices: Record<Side, number> };

export const voiceCandidates: readonly VoiceCandidate[] = [
  {
    id: 'mio',
    name: '澪',
    age: 27,
    tagline: '古本屋で、知らない物語を探す',
    introduction: '澪です。休日は古本屋で、読んだことのない本を探すのが好きです。最近、心に残った物語は何ですか？',
    interests: ['読書', '喫茶店'],
    color: '#DCE7D5',
    initials: '澪',
    voices: {
      left: require('../../assets/voices/mio-left.mp3'),
      right: require('../../assets/voices/mio-right.mp3'),
    },
  },
  {
    id: 'rin',
    name: '凛',
    age: 26,
    tagline: '寄り道を、写真に残す',
    introduction: '凛です。知らない道に入って、気になる景色を写真に撮るのが好き。次の休みに、どんな場所へ行きたい？',
    interests: ['写真', '街歩き'],
    color: '#F8DAE4',
    initials: '凛',
    voices: {
      left: require('../../assets/voices/rin-left.mp3'),
      right: require('../../assets/voices/rin-right.mp3'),
    },
  },
  {
    id: 'nagi',
    name: '凪',
    age: 28,
    tagline: '海沿いを、日が落ちるまで歩く',
    introduction: '凪です。夕方の海沿いを散歩するのが好きです。もし半日だけ自由に使えたら、何をして過ごしますか？',
    interests: ['海', '散歩'],
    color: '#D4E5EF',
    initials: '凪',
    voices: {
      left: require('../../assets/voices/nagi-left.mp3'),
      right: require('../../assets/voices/nagi-right.mp3'),
    },
  },
  {
    id: 'sara',
    name: '紗良',
    age: 25,
    tagline: '季節のおやつを一緒に味わう',
    introduction: '紗良です。週末は季節のお菓子を焼いて、友達に味見してもらいます。子どもの頃から好きなおやつってありますか？',
    interests: ['お菓子作り', '紅茶'],
    color: '#FFF1B8',
    initials: '紗',
    voices: {
      left: require('../../assets/voices/sara-left.mp3'),
      right: require('../../assets/voices/sara-right.mp3'),
    },
  },
];
