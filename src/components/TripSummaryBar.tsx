import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useOBDStore} from '../store/obdStore';
import {useTheme} from '../theme';

export function TripSummaryBar() {
  const {colors} = useTheme();
  const tripData = useOBDStore(s => s.tripData);

  if (!tripData || !tripData.isActive) return null;

  const fuelUsed = tripData.totalFuelUsed.toFixed(2);
  const distance = tripData.totalDistance.toFixed(1);
  const avg =
    tripData.averageConsumption > 0
      ? tripData.averageConsumption.toFixed(1)
      : '--';

  return (
    <View style={[styles.container, {backgroundColor: colors.surface, borderColor: colors.border}]}>
      <View style={styles.stat}>
        <Text style={[styles.value, {color: colors.fuel}]}>{fuelUsed}</Text>
        <Text style={[styles.label, {color: colors.textSecondary}]}>L used</Text>
      </View>
      <View style={[styles.divider, {backgroundColor: colors.border}]} />
      <View style={styles.stat}>
        <Text style={[styles.value, {color: colors.speed}]}>{distance}</Text>
        <Text style={[styles.label, {color: colors.textSecondary}]}>km</Text>
      </View>
      <View style={[styles.divider, {backgroundColor: colors.border}]} />
      <View style={styles.stat}>
        <Text style={[styles.value, {color: colors.warning}]}>{avg}</Text>
        <Text style={[styles.label, {color: colors.textSecondary}]}>L/100km avg</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 10,
    marginTop: 2,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
});
