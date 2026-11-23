/** Pen のライト・ダーク変数に対応する、Koe Match 共通のテーマ。 */
import { useColorScheme } from 'react-native';

const lightColors = {
  background: '#F8F6F7',
  surface: '#FFFFFF',
  surface2: '#F1EDEF',
  ink: '#1F1A1D',
  muted: '#6C6569',
  accentDark: '#C33458',
  primary: '#E8557A',
  primarySoft: '#FDE9EE',
  onPrimary: '#1F1A1D',
  line: '#ECE6E9',
  blue: '#3C9BE6',
  blueSoft: '#E4F1FC',
  blueText: '#1F6FB2',
  mint: '#1FAF97',
  mintSoft: '#DDF4EE',
  mintText: '#0F7362',
  yellow: '#E9B824',
  yellowSoft: '#FFF4C9',
  yellowText: '#886400',
};

export type ThemeColors = typeof lightColors;

const darkColors: ThemeColors = {
  background: '#121012',
  surface: '#1E1A1C',
  surface2: '#2A2528',
  ink: '#F6F1F3',
  muted: '#A9A1A5',
  accentDark: '#FF6B8B',
  primary: '#FF6B8B',
  primarySoft: '#3B2129',
  onPrimary: '#1F1A1D',
  line: '#342E31',
  blue: '#5AB0F5',
  blueSoft: '#1C2A38',
  blueText: '#8CC8F8',
  mint: '#3CCBB0',
  mintSoft: '#17302A',
  mintText: '#6FDCC6',
  yellow: '#F7CF4D',
  yellowSoft: '#3A3218',
  yellowText: '#F7CF4D',
};

export const fontFamilies = {
  body: 'NotoSansJP_400Regular',
  bodyBold: 'NotoSansJP_700Bold',
  numbers: 'Inter_600SemiBold',
};

/** 初期値はライト。端末の表示モードに合わせて配色を切り替える。 */
export function useThemeColors() {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}
