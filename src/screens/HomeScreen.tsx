import React from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {MainTabParamList} from '../navigation/AppNavigator';
import {ConnectionStatusBar} from '../components/ConnectionStatusBar';
import {ConsumptionGauge} from '../components/gauges/ConsumptionGauge';
import {FuelGauge} from '../components/gauges/FuelGauge';
import {RPMGauge} from '../components/gauges/RPMGauge';
import {Speedometer} from '../components/gauges/Speedometer';
import {TripSummaryBar} from '../components/TripSummaryBar';
import {useOBDPolling} from '../hooks/useOBDPolling';
import {useOBDStore} from '../store/obdStore';
import {useSettingsStore} from '../store/settingsStore';
import {useTheme} from '../theme';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export function HomeScreen(_props: Props) {
  const {colors} = useTheme();
  const {reading} = useOBDStore();
  const protocolMode = useSettingsStore(s => s.protocolMode);
  const {width} = useWindowDimensions();

  // Start the OBD/CAN polling loop
  useOBDPolling();

  const speedSize = Math.min(width * 0.65, 260);
  const smallSize = Math.min(width * 0.42, 165);
  const tinySize = Math.min(width * 0.32, 130);

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <ConnectionStatusBar />

      <View style={styles.content}>
        {/* Main speedometer */}
        <View style={styles.speedRow}>
          <Speedometer value={reading.speed} size={speedSize} />
        </View>

        {/* RPM + Fuel row */}
        <View style={styles.secondRow}>
          <RPMGauge value={reading.rpm} size={smallSize} />
          <FuelGauge value={reading.fuelLevel} size={smallSize} />
        </View>

        {/* Consumption gauge — only shown in CAN mode */}
        {protocolMode === 'can' && (
          <>
            <View style={styles.thirdRow}>
              <ConsumptionGauge value={reading.fuelConsumption} size={tinySize} />
            </View>
            <TripSummaryBar />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 16,
  },
  speedRow: {
    alignItems: 'center',
  },
  secondRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 16,
  },
  thirdRow: {
    alignItems: 'center',
  },
});
