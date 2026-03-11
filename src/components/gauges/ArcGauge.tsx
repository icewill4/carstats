import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Path, Text as SvgText} from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {useTheme} from '../../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Gauge arc spans 240° total, starting at 150° (bottom-left) going clockwise
const START_ANGLE_DEG = 150;
const SWEEP_DEG = 240;

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

interface ArcGaugeProps {
  value: number | null;
  min: number;
  max: number;
  size?: number;
  color: string;
  label: string;
  unit: string;
  decimals?: number;
}

export function ArcGauge({
  value,
  min,
  max,
  size = 180,
  color,
  label,
  unit,
  decimals = 0,
}: ArcGaugeProps) {
  const {colors} = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = size * 0.07;
  const r = (size - strokeWidth * 2) / 2;

  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    const clamped = value === null ? 0 : Math.max(min, Math.min(max, value));
    const pct = (clamped - min) / (max - min);
    animatedProgress.value = withTiming(pct, {duration: 300});
  }, [value, min, max, animatedProgress]);

  const animatedProps = useAnimatedProps(() => {
    const endDeg =
      START_ANGLE_DEG + animatedProgress.value * SWEEP_DEG;
    return {
      d: arcPath(cx, cy, r, START_ANGLE_DEG, endDeg),
    };
  });

  const trackPath = arcPath(
    cx,
    cy,
    r,
    START_ANGLE_DEG,
    START_ANGLE_DEG + SWEEP_DEG,
  );

  const displayValue =
    value === null ? '--' : value.toFixed(decimals);

  return (
    <View style={[styles.container, {width: size, height: size}]}>
      <Svg width={size} height={size}>
        {/* Track (background arc) */}
        <Path
          d={trackPath}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        {/* Value arc */}
        <AnimatedPath
          animatedProps={animatedProps}
          stroke={value === null ? colors.disconnected : color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        {/* Center dot */}
        <Circle cx={cx} cy={cy} r={strokeWidth * 0.4} fill={colors.border} />
      </Svg>

      {/* Numeric value overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.centerContent}>
          <Text style={[styles.value, {color: value === null ? colors.textSecondary : colors.text}]}>
            {displayValue}
          </Text>
          <Text style={[styles.unit, {color: colors.textSecondary}]}>{unit}</Text>
        </View>
        <Text style={[styles.label, {color: colors.textSecondary}]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  value: {
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 13,
    marginTop: 2,
  },
  label: {
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
});
