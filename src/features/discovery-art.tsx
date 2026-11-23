/** 聴きくらべとデートで使うマネキンのアバター。 */
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { fontFamilies, useThemeColors } from '../theme';
import type { Candidate } from '../types';

const avatars: Record<string, ImageSourcePropType> = {
  'asmr-risa': require('../../design/images/avatars/v33-haru.png'),
  'asmr-akari': require('../../design/images/avatars/v33-sora.png'),
  'asmr-shiori': require('../../design/images/avatars/v33-kei.png'),
  'asmr-sana': require('../../design/images/avatars/v33-nao.png'),
  you: require('../../design/images/avatars/v33-you.png'),
};

/** 架空の相手または利用者を円形のアバターで示す。 */
export function DiscoveryAvatar({ candidate, size, borderColor, borderWidth = 0 }: {
  candidate?: Candidate;
  size: number;
  borderColor?: string;
  borderWidth?: number;
}) {
  const colors = useThemeColors();
  const source = avatars[candidate?.id ?? 'you'];

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surface2,
        borderColor,
        borderWidth,
      }]}
    >
      {source ? <Image source={source} style={styles.image} /> : (
        <Text style={{ color: colors.ink, fontFamily: fontFamilies.bodyBold }}>{candidate?.initials}</Text>
      )}
    </View>
  );
}

/** 左右の再生状態や、会話の音声ボタンを波形で示す。 */
export function VoiceWave({ color, compact = false }: { color: string; compact?: boolean }) {
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.wave}>
      {(compact ? [5, 10, 7, 13, 8, 5] : [7, 13, 9, 17, 12, 21, 15, 9, 13, 7, 10, 5]).map((height, index) => (
        <View key={index} style={[styles.bar, { height, backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { width: 2, borderRadius: 1 },
});
