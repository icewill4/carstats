import React from 'react';
import {useTheme} from '../../theme';
import {ArcGauge} from './ArcGauge';
import {MAX_RPM} from '../../constants/obd.constants';

interface RPMGaugeProps {
  value: number | null;
  size?: number;
}

export function RPMGauge({value, size = 150}: RPMGaugeProps) {
  const {colors} = useTheme();
  return (
    <ArcGauge
      value={value}
      min={0}
      max={MAX_RPM}
      size={size}
      color={colors.rpm}
      label="RPM"
      unit="rpm"
    />
  );
}
