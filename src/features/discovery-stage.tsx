/** マネキンの耳を動かし、選んだ側のアバターへ運ぶ聴きくらべのステージ。 */
import { CircleCheck, Pause, Play } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamilies, useThemeColors } from '../theme';
import { DiscoveryAvatar, VoiceWave } from './discovery-art';
import type { Side, VoiceCandidate } from './discovery-data';
import headLayout from '../../design/images/search/layout.json';

export type EarSelection = { side: Side; source: 'swipe' | 'button' | 'voice' };
const head = require('../../design/images/search/head-base.png');
const ears = {
  left: { image: require('../../design/images/search/ear-left.png'), ...headLayout.earLeft, direction: -1 },
  right: { image: require('../../design/images/search/ear-right.png'), ...headLayout.earRight, direction: 1 },
} as const;
const headSize = 180;
const headTop = 72;
const cardTop = 60;
const avatarSize = 56;
const dragLimit = 120;
const nativeAnimation = Platform.OS !== 'web';
const samples = [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1];

/** OS の「視差効果を減らす」に合わせて耳とカードの移動を省く。 */
export function useReduceDiscoveryMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduced(enabled);
    }).catch(() => {});
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/** 耳の中心を曲線から求め、頭と同じ画像座標の回転原点に合わせる。 */
function flightPoints(side: Side, width: number) {
  const { direction, bbox, pivot } = ears[side];
  const factor = headSize / headLayout.canvas.w;
  const offsetX = (width - headSize) / 2;
  const centerX = (bbox.x + bbox.w / 2) * factor;
  const centerY = (bbox.y + bbox.h / 2) * factor;
  const anchorX = pivot.x * factor;
  const anchorY = pivot.y * factor;
  const startX = centerX + direction * 24;
  const startY = centerY - 4;
  const endX = (side === 'left' ? 20 + avatarSize - 8 : width - 20 - avatarSize + 8) - offsetX;
  const endY = cardTop + 21 - headTop;
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2 - 110;
  const finishScale = 36 / (bbox.h * factor);

  return samples.map((t) => {
    const scale = 1.12 + (finishScale - 1.12) * t;
    const rotate = direction * (-12 - t * 2);
    const angle = rotate * Math.PI / 180;
    const x = (1 - t) ** 2 * startX + 2 * (1 - t) * t * midX + t ** 2 * endX;
    const y = (1 - t) ** 2 * startY + 2 * (1 - t) * t * midY + t ** 2 * endY;
    const localX = centerX - anchorX;
    const localY = centerY - anchorY;
    return {
      x: x - anchorX - scale * (localX * Math.cos(angle) - localY * Math.sin(angle)),
      y: y - anchorY - scale * (localX * Math.sin(angle) + localY * Math.cos(angle)),
      scale,
      rotate: `${rotate}deg`,
    };
  });
}

/** 左右の候補と再生状態を表示し、候補の音声を試聴できるようにする。 */
function StagePerson({ candidate, side, playing, landed, disabled, lift, onListen }: {
  candidate: VoiceCandidate;
  side: Side;
  playing: boolean;
  landed: boolean;
  disabled: boolean;
  lift: Animated.AnimatedInterpolation<number>;
  onListen: () => void;
}) {
  const colors = useThemeColors();
  const left = side === 'left';
  const tint = left ? colors.blue : colors.mint;
  const tintText = left ? colors.blueText : colors.mintText;
  const tintSoft = left ? colors.blueSoft : colors.mintSoft;
  const alignment = left ? styles.leftCard : styles.rightCard;
  const textAlignment = left ? 'left' : 'right';

  return (
    <Animated.View style={[
      styles.person,
      alignment,
      {
        opacity: lift.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.42, 1, 1], extrapolate: 'clamp' }),
        transform: [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03], extrapolate: 'clamp' }) }],
      },
    ]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.selection, {
          backgroundColor: colors.surface,
          borderColor: colors.primary,
          opacity: landed ? 1 : lift.interpolate({ inputRange: [0, 1], outputRange: [0, 0.82], extrapolate: 'clamp' }),
        }]}
      />
      <View>
        <DiscoveryAvatar candidate={candidate} size={avatarSize} borderColor={playing ? tint : colors.line} borderWidth={2} />
        {landed ? (
          <View style={[styles.check, left ? styles.checkLeft : styles.checkRight, { backgroundColor: colors.surface }]}>
            <CircleCheck size={18} color={colors.mintText} />
          </View>
        ) : null}
      </View>
      <View style={styles.stateRow}>
        <View style={[styles.dot, { backgroundColor: landed ? colors.primary : playing ? tint : colors.muted }]} />
        <Text style={[styles.personStatus, { color: landed ? colors.accentDark : playing ? tintText : colors.muted }]}>
          {landed ? '選びました' : playing ? '再生中' : '待機中'}
        </Text>
      </View>
      <Text style={[styles.personName, { color: colors.ink, textAlign: textAlignment }]}>{candidate.name}さん</Text>
      <Text style={[styles.personMeta, { color: colors.muted, textAlign: textAlignment }]}>{candidate.speechStyle} · {candidate.interests[0]}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? `${candidate.name}の声を止める` : `${left ? '左' : '右'}から${candidate.name}の声を聴く`}
        disabled={disabled}
        onPress={onListen}
        style={({ pressed }) => [styles.listen, pressed && styles.pressed]}
      >
        <View style={[styles.play, { backgroundColor: playing ? tint : tintSoft }]}>
          {playing ? <Pause size={13} color={colors.onPrimary} /> : <Play size={13} color={tintText} />}
        </View>
        <VoiceWave color={playing ? tint : tintText} compact />
      </Pressable>
      <Text style={[styles.quote, { color: colors.ink, textAlign: textAlignment }]}>{candidate.tagline}</Text>
    </Animated.View>
  );
}

/** 横ドラッグを追従させ、タップ・音声にも同じ耳の着地アニメーションを使う。 */
export function DiscoveryStage({ left, right, playing, leftLevel, rightLevel, selection, landed, reducedMotion, onChoose, onLand, onListen }: {
  left: VoiceCandidate;
  right: VoiceCandidate;
  playing: Side | null;
  leftLevel: number;
  rightLevel: number;
  selection: EarSelection | null;
  landed: boolean;
  reducedMotion: boolean;
  onChoose: (side: Side, source: EarSelection['source']) => void;
  onLand: () => void;
  onListen: (candidate: VoiceCandidate, side: Side) => void;
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(390);
  const [drag] = useState(() => new Animated.Value(0));
  const [flight] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const [arrival] = useState(() => new Animated.Value(0));
  const [softLanding, setSoftLanding] = useState(false);
  const direction = selection?.side === 'left' ? -1 : 1;
  const offsetX = (width - headSize) / 2;
  const leftLift = drag.interpolate({ inputRange: [-dragLimit, 0, dragLimit], outputRange: [1, 0, -1], extrapolate: 'clamp' });
  const rightLift = drag.interpolate({ inputRange: [-dragLimit, 0, dragLimit], outputRange: [-1, 0, 1], extrapolate: 'clamp' });

  useEffect(() => {
    const reveal = Animated.timing(arrival, { toValue: 1, duration: reducedMotion ? 160 : 240, useNativeDriver: nativeAnimation });
    reveal.start();
    return () => reveal.stop();
  }, [arrival, reducedMotion]);

  useEffect(() => {
    if (!selection) {
      drag.setValue(0);
      flight.setValue(0);
      pop.setValue(0);
      fade.setValue(1);
      return;
    }

    if (reducedMotion) {
      const fadeOut = Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: nativeAnimation });
      const fadeIn = Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: nativeAnimation });
      fadeOut.start(({ finished }) => {
        if (!finished) return;
        setSoftLanding(true);
        onLand();
        fadeIn.start();
      });
      return () => {
        fadeOut.stop();
        fadeIn.stop();
        setSoftLanding(false);
      };
    }

    const lift = Animated.timing(drag, {
      toValue: direction * dragLimit,
      duration: selection.source === 'swipe' ? 90 : selection.source === 'voice' ? 240 : 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeAnimation,
    });
    const detach = Animated.timing(pop, { toValue: 1, duration: 120, useNativeDriver: nativeAnimation });
    const travel = Animated.timing(flight, { toValue: 1, duration: 380, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: nativeAnimation });
    const animation = Animated.sequence([lift, detach, travel]);
    animation.start(({ finished }) => {
      if (finished) onLand();
    });

    return () => animation.stop();
  }, [direction, drag, fade, flight, onLand, pop, reducedMotion, selection]);

  const responder = useMemo(() => {
    const moveBack = () => Animated.timing(drag, { toValue: 0, duration: reducedMotion ? 0 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: nativeAnimation }).start();
    const isHorizontal = (dx: number, dy: number) => Math.abs(dx) > Math.abs(dy) * 1.5;

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => !selection && Math.abs(dx) > 8 && isHorizontal(dx, dy),
      onPanResponderGrant: () => drag.stopAnimation(),
      onPanResponderMove: (_, { dx }) => {
        if (!reducedMotion) drag.setValue(Math.max(-dragLimit, Math.min(dragLimit, dx)));
      },
      onPanResponderRelease: (_, { dx, dy, vx }) => {
        if (isHorizontal(dx, dy) && (Math.abs(dx) >= 90 || (Math.abs(dx) > 8 && Math.abs(vx) > 0.5 && dx * vx > 0))) {
          onChoose(dx < 0 ? 'left' : 'right', 'swipe');
        } else {
          moveBack();
        }
      },
      onPanResponderTerminate: moveBack,
    });
  }, [drag, onChoose, reducedMotion, selection]);

  return (
    <Animated.View style={[styles.stage, { opacity: arrival }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} {...responder.panHandlers}>
      <View pointerEvents="none" style={[styles.halo, { left: (width - 230) / 2, backgroundColor: colors.surface }]} />
      {(['left', 'right'] as const).map((side) => {
        const { direction: sign, image, pivot } = ears[side];
        const isSelected = selection?.side === side;
        const ongoing = playing === side;
        const played = side === 'left' ? leftLevel : rightLevel;
        const tint = side === 'left' ? colors.blue : colors.mint;
        const lift = side === 'left' ? leftLift : rightLift;
        const points = isSelected ? flightPoints(side, width) : null;
        const movement = lift.interpolate({ inputRange: [0, 1], outputRange: [0, sign * 24], extrapolate: 'clamp' });
        const drop = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -4], extrapolate: 'clamp' });
        const rotation = lift.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${-sign * 12}deg`], extrapolate: 'clamp' });
        const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
        const flightX = points && flight.interpolate({ inputRange: samples, outputRange: points.map((point) => point.x - points[0].x) });
        const flightY = points && flight.interpolate({ inputRange: samples, outputRange: points.map((point) => point.y - points[0].y) });
        const flightScale = points && flight.interpolate({ inputRange: samples, outputRange: points.map((point) => point.scale / points[0].scale) });
        const flightRotation = points && flight.interpolate({ inputRange: samples, outputRange: points.map((point) => `${parseFloat(point.rotate) + sign * 12}deg`) });
        const landedPoint = points?.[points.length - 1];
        const transform = reducedMotion ? (isSelected && softLanding && landedPoint ? [
          { translateX: landedPoint.x }, { translateY: landedPoint.y }, { rotate: landedPoint.rotate }, { scale: landedPoint.scale },
        ] : []) : [
          { translateX: flightX ? Animated.add(movement, flightX) : movement },
          { translateY: flightY ? Animated.add(drop, flightY) : drop },
          { rotate: rotation },
          { rotate: flightRotation ?? '0deg' },
          { scale: isSelected ? flightScale ? Animated.multiply(popScale, flightScale) : popScale : 1 },
        ];

        return (
          <View key={side} pointerEvents="none" style={[StyleSheet.absoluteFill, isSelected && { zIndex: 5 }]}>
            {[32, 56, 80].map((size, index) => (
              <View key={size} style={[styles.arc, {
                width: size,
                height: size,
                borderRadius: size / 2,
                left: width / 2 + sign * 49 - size / 2,
                top: headTop + 81 - size / 2,
                borderColor: tint,
                opacity: ongoing ? (0.20 + (index + 1) * played * 0.2) : 0.13,
              }]} />
            ))}
            <Animated.Image
              accessible={false}
              source={image}
              style={[styles.headArt, {
                left: offsetX,
                opacity: isSelected && reducedMotion ? fade : 1,
                transformOrigin: [pivot.x * headSize / headLayout.canvas.w, pivot.y * headSize / headLayout.canvas.h, 0],
                transform,
                zIndex: 2,
              }]}
            />
          </View>
        );
      })}
      <Image pointerEvents="none" accessible={false} source={head} style={[styles.headArt, { left: offsetX, zIndex: 1 }]} />
      <StagePerson candidate={left} side="left" playing={playing === 'left'} landed={landed && selection?.side === 'left'} disabled={!!selection} lift={leftLift} onListen={() => onListen(left, 'left')} />
      <StagePerson candidate={right} side="right" playing={playing === 'right'} landed={landed && selection?.side === 'right'} disabled={!!selection} lift={rightLift} onListen={() => onListen(right, 'right')} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { height: 335, width: '100%', alignSelf: 'center', maxWidth: 480 },
  halo: { position: 'absolute', top: 47, width: 230, height: 230, borderRadius: 115 },
  arc: { position: 'absolute', borderWidth: 1.4 },
  headArt: { position: 'absolute', top: headTop, width: headSize, height: headSize },
  person: { position: 'absolute', zIndex: 4, top: cardTop, width: '27%', maxWidth: 118, gap: 4, padding: 10, minHeight: 205, justifyContent: 'flex-start' },
  leftCard: { left: 10, alignItems: 'flex-start' },
  rightCard: { right: 10, alignItems: 'flex-end' },
  selection: { ...StyleSheet.absoluteFill, borderRadius: 16, borderWidth: 2 },
  check: { position: 'absolute', top: -3, padding: 1, borderRadius: 11 },
  checkLeft: { right: -4 },
  checkRight: { left: -4 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { height: 5, width: 5, borderRadius: 3 },
  personStatus: { fontFamily: fontFamilies.bodyBold, fontSize: 10 },
  personName: { fontFamily: fontFamilies.bodyBold, fontSize: 16, lineHeight: 23 },
  personMeta: { fontFamily: fontFamilies.body, fontSize: 10, lineHeight: 15 },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  play: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  quote: { fontFamily: fontFamilies.body, fontSize: 10, lineHeight: 15 },
  pressed: { opacity: 0.72 },
});
