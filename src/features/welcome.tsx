/** 声のプロフィールカードと、最初の回答への入口を表示する。 */
import { Heart, Headphones, Mic, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { fontFamilies, type ThemeColors, useThemeColors } from '../theme';

const portraits = {
  kei: require('../../design/images/avatars/v33-kei.png'),
  sora: require('../../design/images/avatars/v33-sora.png'),
  haru: require('../../design/images/avatars/v33-haru.png'),
};

/** 既存のカードを左右に広げ、視差を抑えた一度きりの登場にする。 */
function VoiceCardFan({ width, height, colors }: { width: number; height: number; colors: ThemeColors }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let disposed = false;
    let settled = false;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 660,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });

    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (!enabled) return;
      settled = true;
      animation.stop();
      progress.setValue(1);
    });

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (disposed || settled) return;
      if (enabled) progress.setValue(1);
      else animation.start();
    }).catch(() => {
      if (!disposed) progress.setValue(1);
    });

    return () => {
      disposed = true;
      motion.remove();
      animation.stop();
    };
  }, [progress]);

  const { leftShift, rightShift, frontShift } = useMemo(() => ({
    leftShift: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
    rightShift: progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }),
    frontShift: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
  }), [progress]);
  const cardWidth = width * 0.72;
  const cardHeight = Math.min(180, height * 0.57);
  const top = height * 0.14;

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.fan, { height, width }]}
    >
      <View style={[styles.yellowOrb, { backgroundColor: colors.yellowSoft }]} />
      <View style={[styles.blueOrb, { backgroundColor: colors.blueSoft }]} />

      <Animated.View style={[
        styles.card, {
          width: cardWidth, height: cardHeight - 10, top: top + 31, left: 7,
          borderColor: colors.line, backgroundColor: colors.surface,
          transform: [{ translateX: leftShift }, { rotate: '-7deg' }],
        },
      ]}>
        <Image source={portraits.kei} style={styles.photo} />
      </Animated.View>
      <Animated.View style={[
        styles.card, {
          width: cardWidth, height: cardHeight - 10, top: top + 23, right: 6,
          borderColor: colors.line, backgroundColor: colors.surface,
          transform: [{ translateX: rightShift }, { rotate: '6deg' }],
        },
      ]}>
        <Image source={portraits.sora} style={styles.photo} />
      </Animated.View>
      <Animated.View style={[
        styles.card, {
          width: cardWidth + 12, height: cardHeight, top, left: (width - cardWidth - 12) / 2,
          borderColor: colors.line, backgroundColor: colors.surface,
          transform: [{ translateY: frontShift }],
        },
      ]}>
        <Image source={portraits.haru} style={styles.photo} />
        <View style={[styles.chip, styles.introChip, { backgroundColor: colors.mintSoft }]}>
          <Sparkles color={colors.mintText} size={12} />
          <Text style={[styles.chipLabel, { color: colors.mintText }]}>分身が紹介中</Text>
        </View>
      </Animated.View>
      <View style={[styles.chip, styles.aiChip, { backgroundColor: colors.mintSoft, top: top + 22 }]}>
        <Sparkles color={colors.mintText} size={13} />
        <Text style={[styles.chipLabel, { color: colors.mintText }]}>AI分身が紹介</Text>
      </View>
      <View style={[
        styles.chip, styles.likeChip,
        { backgroundColor: colors.primary, top: top + cardHeight - 24 },
      ]}>
        <Heart color={colors.onPrimary} size={16} />
        <Text style={[styles.chipLabel, { color: colors.onPrimary }]}>いいね</Text>
      </View>
      <View style={[styles.chip, styles.listenChip, { backgroundColor: colors.blueSoft }]}>
        <Headphones color={colors.blueText} size={14} />
        <Text style={[styles.chipLabel, { color: colors.blueText }]}>左右で聴く</Text>
      </View>
    </View>
  );
}

/** 音声プロフィールの作成を開始する。 */
export default function WelcomeScreen({ onStart, onSkip }: { onStart: () => void; onSkip?: () => void }) {
  const colors = useThemeColors();
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.min(460, width) - 40;
  const heroHeight = Math.min(420, Math.max(255, height * 0.47));

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.layout}
      showsVerticalScrollIndicator={false}
    >
      <VoiceCardFan width={contentWidth} height={heroHeight} colors={colors} />
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>声で、好きになる。</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          写真じゃなく、声と話し方で出会うマッチングアプリ。
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onStart}
          style={({ pressed }) => [styles.start, { backgroundColor: colors.primary }, pressed && styles.pressed]}
        >
          <Mic color={colors.onPrimary} size={18} />
          <Text style={[styles.startLabel, { color: colors.onPrimary }]}>声で登録する</Text>
        </Pressable>
        {onSkip ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSkip}
            style={({ pressed }) => [
              styles.start, styles.skip,
              { backgroundColor: colors.surface, borderColor: colors.line },
              pressed && styles.pressed,
            ]}
          >
            <Headphones color={colors.ink} size={17} />
            <Text style={[styles.startLabel, { color: colors.ink }]}>先に声を聴いてみる</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.copyright, { color: colors.muted }]}>2026 AHWENU&apos;S COFFEE</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  layout: {
    flexGrow: 1, width: '100%', maxWidth: 460, alignSelf: 'center', justifyContent: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 24,
  },
  fan: { alignSelf: 'center' },
  yellowOrb: { position: 'absolute', width: 190, height: 190, borderRadius: 95, top: 0, left: -60 },
  blueOrb: { position: 'absolute', width: 170, height: 170, borderRadius: 85, bottom: 25, right: -34 },
  card: {
    position: 'absolute', overflow: 'hidden', borderRadius: 24, borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth, boxShadow: '0px 8px 24px #1f1a1d20',
  },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  chip: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
  },
  aiChip: { right: 12, transform: [{ rotate: '-5deg' }] },
  introChip: { left: 11, bottom: 11 },
  likeChip: { right: 12, transform: [{ rotate: '7deg' }], paddingHorizontal: 14, paddingVertical: 9 },
  listenChip: { left: 4, bottom: 12, transform: [{ rotate: '-4deg' }] },
  chipLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 12 },
  intro: { alignItems: 'center', gap: 10 },
  title: { fontFamily: fontFamilies.bodyBold, fontSize: 28, lineHeight: 41, textAlign: 'center' },
  subtitle: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  actions: { gap: 12 },
  start: {
    minHeight: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 13,
  },
  startLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 16, textAlign: 'center' },
  skip: { borderWidth: 1, minHeight: 52 },
  pressed: { opacity: 0.78 },
  copyright: { fontFamily: fontFamilies.numbers, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
