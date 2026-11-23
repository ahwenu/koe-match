/** 画面見出しと操作ボタンの共通部品。 */
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

const titleFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

/** 各タブの導入を表示する。 */
export function ScreenIntro({ eyebrow, title, subtitle }: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.intro}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
        secondary ? styles.secondary : styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonLabel, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 7, alignItems: 'flex-start' },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.ink, fontFamily: titleFont, fontSize: 30, fontWeight: '700', lineHeight: 38 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  button: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderColor: colors.line },
  buttonLabel: { color: colors.white, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  secondaryLabel: { color: colors.accentDark },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.42 },
});
