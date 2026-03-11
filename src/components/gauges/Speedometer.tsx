import React from 'react';
import {useTheme} from '../../theme';
import {ArcGauge} from './ArcGauge';
import {MAX_SPEED_KMH} from '../../constants/obd.constants';

interface SpeedometerProps {
  value: number | null;
  size?: number;
}

export function Speedometer({value, size = 220}: SpeedometerProps) {
  const {colors} = useTheme();
  return (
    <ArcGauge
      value={value}
      min={0}
      max={MAX_SPEED_KMH}
      size={size}
      color={colors.speed}
      label="Speed"
      unit="km/h"
    />
  );
}
