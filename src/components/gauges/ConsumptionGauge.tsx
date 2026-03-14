import React from 'react';
import {useTheme} from '../../theme';
import {ArcGauge} from './ArcGauge';
import {MAX_CONSUMPTION} from '../../constants/obd.constants';

interface ConsumptionGaugeProps {
  value: number | null;
  size?: number;
}

export function ConsumptionGauge({value, size = 150}: ConsumptionGaugeProps) {
  const {colors} = useTheme();
  // High consumption gets warning color
  const color =
    value !== null && value > 12 ? colors.warning : colors.fuel;
  return (
    <ArcGauge
      value={value}
      min={0}
      max={MAX_CONSUMPTION}
      size={size}
      color={color}
      label="Consumption"
      unit="L/100km"
      decimals={1}
    />
  );
}
