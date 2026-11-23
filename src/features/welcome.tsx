/** 二つの声が重なるアニメーションでアプリを紹介する起動画面。 */
import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors } from '../theme';

const titleFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });
const strokeCount = 92;
const timing = Easing.bezier(0.77, 0, 0.175, 1);
const useNativeDriver = Platform.OS !== 'web';

/** 円の内側を揃え、波形の長さだけを変えて声の異なる輪郭を描く。 */
function VoiceRing({ diameter, color, phase }: { diameter: number; color: string; phase: number }) {
  const radius = diameter / 2;

  return (
    <View style={{ width: diameter, height: diameter }}>
      {Array.from({ length: strokeCount }, (_, index) => {
        const angle = index * Math.PI * 2 / strokeCount;
        const wave = (1 + Math.sin(5 * angle + phase)) / 2;
        const detail = (1 + Math.sin(13 * angle - phase)) / 2;
        const length = diameter * (0.065 + 0.18 * wave ** 2 + 0.028 * detail);
        const distance = radius + length / 2;

        return (
          <View
            key={index}
            style={[
              styles.stroke,
              {
                backgroundColor: color,
                height: length,
                left: radius + Math.cos(angle) * distance - 1.25,
                top: radius + Math.sin(angle) * distance - length / 2,
                transform: [{ rotate: String(angle * 180 / Math.PI + 90) + 'deg' }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/** 二つの声が近づいて重なり、短く脈打った後に静止する。 */
function VoiceArtwork({ diameter }: { diameter: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let settledByMotionPreference = false;
    const animation = Animated.sequence([
      Animated.timing(progress, { toValue: 0.6, duration: 1600, easing: timing, useNativeDriver, isInteraction: false }),
      Animated.timing(progress, { toValue: 1, duration: 1150, easing: Easing.linear, useNativeDriver, isInteraction: false }),
    ]);

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduceMotion) => {
      if (!reduceMotion) return;
      settledByMotionPreference = true;
      animation.stop();
      progress.setValue(1);
      setMotionReady(true);
    });

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (disposed || settledByMotionPreference) return;
      if (reduceMotion) progress.setValue(1);
      else animation.start();
      setMotionReady(true);
    }).catch(() => {
      if (disposed || settledByMotionPreference) return;
      progress.setValue(1);
      setMotionReady(true);
    });

    return () => {
      disposed = true;
      subscription.remove();
      animation.stop();
    };
  }, [progress]);

  const { leftX, rightX, leftY, rightY, scale } = useMemo(() => {
    const approach = { inputRange: [0, 0.6, 1], extrapolate: 'clamp' as const };
    return {
      leftX: progress.interpolate({ ...approach, outputRange: [-diameter * 0.68, -diameter * 0.28, -diameter * 0.28] }),
      rightX: progress.interpolate({ ...approach, outputRange: [diameter * 0.68, diameter * 0.28, diameter * 0.28] }),
      leftY: progress.interpolate({ ...approach, outputRange: [-diameter * 0.39, -diameter * 0.24, -diameter * 0.24] }),
      rightY: progress.interpolate({ ...approach, outputRange: [diameter * 0.39, diameter * 0.24, diameter * 0.24] }),
      scale: progress.interpolate({
        inputRange: [0, 0.6, 0.7, 0.81, 0.9, 1],
        outputRange: [1, 1, 1.055, 1, 1.035, 1],
        extrapolate: 'clamp',
      }),
    };
  }, [diameter, progress]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.artwork, { height: diameter * 2.4, opacity: motionReady ? 1 : 0 }]}
    >
      <Animated.View style={[
        styles.ring,
        { transform: [{ translateX: leftX }, { translateY: leftY }, { scale }] },
      ]}>
        <VoiceRing diameter={diameter} color="#7553AC" phase={0.65} />
      </Animated.View>
      <Animated.View style={[
        styles.ring,
        { transform: [{ translateX: rightX }, { translateY: rightY }, { scale }] },
      ]}>
        <VoiceRing diameter={diameter} color="#B65A25" phase={3.2} />
      </Animated.View>
    </View>
  );
}

/** アニメーションの進行にかかわらず、ボタンでアプリを始められる。 */
export default function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const { width, height } = useWindowDimensions();
  const diameter = Math.min(148, (width - 12) / 2.92, height * 0.23);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.layout}>
      <Text style={styles.wordmark}>Koe Match</Text>
      <View style={styles.illustration}>
        <VoiceArtwork diameter={diameter} />
      </View>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>声と言葉で、{'\n'}出会う。</Text>
        <Text style={styles.subtitle}>声を聞き比べ、気になる相手と会話を試してみましょう。</Text>
      </View>
      <Pressable
        accessibilityLabel="はじめる"
        accessibilityRole="button"
        onPress={onStart}
        style={({ pressed }) => [styles.start, pressed && styles.startPressed]}
      >
        <Text style={styles.startLabel}>はじめる</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  layout: { flexGrow: 1, width: '100%', maxWidth: 460, alignSelf: 'center', paddingHorizontal: 26, paddingTop: 20, paddingBottom: 24 },
  wordmark: { color: colors.ink, fontFamily: titleFont, fontSize: 26, fontWeight: '700', letterSpacing: -0.7 },
  illustration: { justifyContent: 'center', flexGrow: 1, paddingVertical: 12, marginHorizontal: -20 },
  artwork: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  stroke: { position: 'absolute', width: 2.5, borderRadius: 1.25 },
  intro: { gap: 12 },
  title: { color: colors.ink, fontFamily: titleFont, fontSize: 38, lineHeight: 49, fontWeight: '700', letterSpacing: 0.2 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 23 },
  start: { minHeight: 56, marginTop: 25, borderRadius: 30, backgroundColor: colors.ink, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  startPressed: { opacity: 0.78 },
  startLabel: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
