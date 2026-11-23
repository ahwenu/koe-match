/** アプリの各画面で共有する候補者と音声プロフィールの型。 */
import type { ImageSourcePropType } from 'react-native';

export type Candidate = {
  id: string;
  name: string;
  age: number;
  tagline: string;
  introduction: string;
  interests: string[];
  color: string;
  initials: string;
  avatar?: ImageSourcePropType;
};

export type VoiceEntry = {
  id: string;
  text: string;
  kind: 'intro' | 'diary';
  createdAt: number;
};

export type VoiceProfile = {
  name: string;
  entries: VoiceEntry[];
  introduction: string;
  approved: boolean;
  introductionReview?: { source: 'generated' | 'edited'; stale: boolean };
};
