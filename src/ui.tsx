/** 画面見出しと操作ボタンの共通部品。 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamilies, useThemeColors } from './theme';

/** 各タブの導入を表示する。 */
export function ScreenIntro({ eyebrow, title, subtitle }: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.intro}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: colors.accentDark }]}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** 有効・無効と押下の状態を伝える共通の操作ボタン。 */
export function ActionButton({ label, onPress, variant = 'primary', disabled, accessibilityLabel }: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const secondary = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary
          ? { backgroundColor: colors.surface, borderColor: colors.line }
          : { backgroundColor: colors.primary, borderColor: colors.primary },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonLabel, { color: secondary ? colors.ink : colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 7, alignItems: 'flex-start' },
  eyebrow: { fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 1.2 },
  title: { fontFamily: fontFamilies.bodyBold, fontSize: 26, lineHeight: 38 },
  subtitle: { fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 21 },
  button: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  buttonLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 14, textAlign: 'center' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.42 },
});
