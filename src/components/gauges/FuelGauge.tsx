import React from 'react';
import {useTheme} from '../../theme';
import {ArcGauge} from './ArcGauge';

interface FuelGaugeProps {
  value: number | null;
  size?: number;
}

export function FuelGauge({value, size = 150}: FuelGaugeProps) {
  const {colors} = useTheme();
  // Use warning color when below 15%
  const color =
    value !== null && value < 15 ? colors.warning : colors.fuel;
  return (
    <ArcGauge
      value={value}
      min={0}
      max={100}
      size={size}
      color={color}
      label="Fuel"
      unit="%"
      decimals={1}
    />
  );
}
