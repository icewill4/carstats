import React, {useCallback} from 'react';
import {Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View} from 'react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {CompositeScreenProps} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {MainTabParamList, RootStackParamList} from '../navigation/AppNavigator';
import {useBluetooth} from '../hooks/useBluetooth';
import {useBluetoothStore} from '../store/bluetoothStore';
import {useSettingsStore} from '../store/settingsStore';
import {useTheme} from '../theme';
import {MOCK_MODE} from '../constants/obd.constants';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function SettingsScreen({navigation}: Props) {
  const {colors, isDark, toggleTheme} = useTheme();
  const {connectedDeviceName, connectedDeviceId} = useBluetoothStore();
  const {disconnect} = useBluetooth();
  const {connectionMode, setConnectionMode, protocolMode, setProtocolMode} =
    useSettingsStore();

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      'Disconnect',
      `Disconnect from ${connectedDeviceName ?? 'device'}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnect(),
        },
      ],
    );
  }, [connectedDeviceName, disconnect]);

  const bg = colors.background;
  const surface = colors.surface;
  const border = colors.border;

  return (
    <ScrollView style={[styles.container, {backgroundColor: bg}]} contentContainerStyle={styles.content}>
      {/* Adapter section */}
      <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>ADAPTER</Text>
      <View style={[styles.card, {backgroundColor: surface, borderColor: border}]}>
        <View style={styles.row}>
          <View>
            <Text style={[styles.rowLabel, {color: colors.text}]}>Adapter type</Text>
            <Text style={[styles.rowSubLabel, {color: colors.textSecondary}]}>
              {connectionMode === 'ble' ? 'Bluetooth 5.0 / BLE' : 'Bluetooth Classic (SPP)'}
            </Text>
          </View>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segment,
                styles.segmentLeft,
                connectionMode === 'ble' && {backgroundColor: colors.speed},
              ]}
              onPress={() => setConnectionMode('ble')}>
              <Text
                style={[
                  styles.segmentText,
                  {color: connectionMode === 'ble' ? '#FFF' : colors.textSecondary},
                ]}>
                BLE
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segment,
                styles.segmentRight,
                connectionMode === 'classic' && {backgroundColor: colors.speed},
              ]}
              onPress={() => setConnectionMode('classic')}>
              <Text
                style={[
                  styles.segmentText,
                  {color: connectionMode === 'classic' ? '#FFF' : colors.textSecondary},
                ]}>
                Classic
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Protocol section */}
      <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>PROTOCOL</Text>
      <View style={[styles.card, {backgroundColor: surface, borderColor: border}]}>
        <View style={styles.row}>
          <View>
            <Text style={[styles.rowLabel, {color: colors.text}]}>Data mode</Text>
            <Text style={[styles.rowSubLabel, {color: colors.textSecondary}]}>
              {protocolMode === 'can'
                ? 'CAN bus direct (fast, car-specific)'
                : 'OBD2 standard (universal, slower)'}
            </Text>
          </View>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segment,
                styles.segmentLeft,
                protocolMode === 'obd2' && {backgroundColor: colors.speed},
              ]}
              onPress={() => setProtocolMode('obd2')}>
              <Text
                style={[
                  styles.segmentText,
                  {color: protocolMode === 'obd2' ? '#FFF' : colors.textSecondary},
                ]}>
                OBD2
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segment,
                styles.segmentRight,
                protocolMode === 'can' && {backgroundColor: colors.speed},
              ]}
              onPress={() => setProtocolMode('can')}>
              <Text
                style={[
                  styles.segmentText,
                  {color: protocolMode === 'can' ? '#FFF' : colors.textSecondary},
                ]}>
                CAN
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {protocolMode === 'can' && (
          <TouchableOpacity
            style={[styles.row, {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border}]}
            onPress={() => navigation.navigate('CANSniffer')}>
            <Text style={[styles.rowLabel, {color: colors.speed}]}>Open CAN Sniffer</Text>
            <Text style={{color: colors.textSecondary, fontSize: 18}}>{'>'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Connection section */}
      <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>CONNECTION</Text>
      <View style={[styles.card, {backgroundColor: surface, borderColor: border}]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, {color: colors.text}]}>Device</Text>
          <Text style={[styles.rowValue, {color: colors.textSecondary}]}>
            {connectedDeviceName ?? '—'}
          </Text>
        </View>
        {connectedDeviceId && (
          <View style={[styles.row, {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border}]}>
            <Text style={[styles.rowLabel, {color: colors.text}]}>Address</Text>
            <Text style={[styles.rowValue, {color: colors.textSecondary}]}>{connectedDeviceId}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.disconnectButton, {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border}]}
          onPress={handleDisconnect}>
          <Text style={[styles.disconnectText, {color: colors.warning}]}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      {/* Appearance section */}
      <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>APPEARANCE</Text>
      <View style={[styles.card, {backgroundColor: surface, borderColor: border}]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, {color: colors.text}]}>Dark mode</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{true: colors.speed, false: colors.border}}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Dev section */}
      {MOCK_MODE && (
        <>
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>DEVELOPER</Text>
          <View style={[styles.card, {backgroundColor: surface, borderColor: border}]}>
            <View style={styles.row}>
              <View>
                <Text style={[styles.rowLabel, {color: colors.text}]}>Mock mode</Text>
                <Text style={[styles.rowSubLabel, {color: colors.textSecondary}]}>
                  Using simulated ELM327 data
                </Text>
              </View>
              <View style={[styles.badge, {backgroundColor: colors.speed + '22'}]}>
                <Text style={[styles.badgeText, {color: colors.speed}]}>ON</Text>
              </View>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {padding: 16, gap: 8},
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: {fontSize: 16},
  rowSubLabel: {fontSize: 12, marginTop: 2},
  rowValue: {fontSize: 14},
  segmentedControl: {flexDirection: 'row'},
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#888',
  },
  segmentLeft: {borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderRightWidth: 0},
  segmentRight: {borderTopRightRadius: 8, borderBottomRightRadius: 8},
  segmentText: {fontSize: 13, fontWeight: '600'},
  disconnectButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disconnectText: {fontSize: 16, fontWeight: '600'},
  badge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6},
  badgeText: {fontSize: 12, fontWeight: '700'},
});
