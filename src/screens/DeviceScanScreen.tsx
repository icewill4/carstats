import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import {useBluetooth} from '../hooks/useBluetooth';
import {usePermissions} from '../hooks/usePermissions';
import {useBluetoothStore} from '../store/bluetoothStore';
import {useSettingsStore} from '../store/settingsStore';
import {useTheme} from '../theme';
import type {BluetoothDevice} from '../types/obd.types';

type Props = NativeStackScreenProps<RootStackParamList, 'DeviceScan'>;

export function DeviceScanScreen({navigation}: Props) {
  const {colors} = useTheme();
  const {status, requestPermissions} = usePermissions();
  const {loadBondedDevices, startBLEScan, stopBLEScan, connect} = useBluetooth();
  const {devices, connectionState} = useBluetoothStore();
  const connectionMode = useSettingsStore(s => s.connectionMode);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const isConnecting =
    connectionState === 'connecting' || connectionState === 'initializing';

  // Load devices once permissions are granted
  useEffect(() => {
    if (status !== 'granted') return;

    if (connectionMode === 'ble') {
      setScanning(true);
      startBLEScan();
      // Auto-stop scan indicator after 15s (matches BLEService timeout)
      const t = setTimeout(() => setScanning(false), 15000);
      return () => {
        clearTimeout(t);
        stopBLEScan();
      };
    } else {
      loadBondedDevices();
    }
  }, [status, connectionMode, loadBondedDevices, startBLEScan, stopBLEScan]);

  // Navigate to dashboard once connected
  useEffect(() => {
    if (connectionState === 'connected') {
      navigation.replace('Main');
    }
  }, [connectionState, navigation]);

  const handleConnect = useCallback(
    async (device: BluetoothDevice) => {
      setConnectingId(device.id);
      if (connectionMode === 'ble') stopBLEScan();
      try {
        await connect(device.id, device.name);
      } catch {
        setConnectingId(null);
      }
    },
    [connect, connectionMode, stopBLEScan],
  );

  const handleRescan = useCallback(() => {
    setScanning(true);
    startBLEScan();
    setTimeout(() => setScanning(false), 15000);
  }, [startBLEScan]);

  if (status === 'unknown') {
    return (
      <View style={[styles.centered, {backgroundColor: colors.background}]}>
        <ActivityIndicator color={colors.speed} />
      </View>
    );
  }

  if (status === 'denied' || status === 'blocked') {
    return (
      <View style={[styles.centered, {backgroundColor: colors.background}]}>
        <Text style={[styles.title, {color: colors.text}]}>
          Bluetooth permission required
        </Text>
        <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
          {status === 'blocked'
            ? 'Permission was permanently denied. Please enable it in your phone Settings.'
            : 'CarStats needs Bluetooth to connect to your ELM327 adapter.'}
        </Text>
        {status === 'denied' && (
          <TouchableOpacity
            style={[styles.primaryButton, {backgroundColor: colors.speed}]}
            onPress={requestPermissions}>
            <Text style={styles.primaryButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const isBLE = connectionMode === 'ble';

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Text style={[styles.header, {color: colors.text}]}>
        Select your ELM327 adapter
      </Text>
      <Text style={[styles.hint, {color: colors.textSecondary}]}>
        {isBLE
          ? 'Scanning for nearby BLE adapters…'
          : 'Pair your device in Android Settings first, then it will appear here.'}
      </Text>

      {isBLE && (
        <View style={styles.scanRow}>
          {scanning ? (
            <ActivityIndicator size="small" color={colors.speed} />
          ) : (
            <TouchableOpacity
              style={[styles.scanButton, {borderColor: colors.speed}]}
              onPress={handleRescan}
              disabled={isConnecting}>
              <Text style={[styles.scanButtonText, {color: colors.speed}]}>
                Scan again
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {devices.length === 0 ? (
        <View style={styles.emptyState}>
          {!isBLE && <ActivityIndicator color={colors.speed} />}
          <Text style={[styles.hint, {color: colors.textSecondary, marginTop: 12}]}>
            {isBLE ? 'No adapters found yet.' : 'Loading paired devices…'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={d => d.id}
          contentContainerStyle={styles.list}
          renderItem={({item}) => (
            <TouchableOpacity
              style={[
                styles.deviceRow,
                {backgroundColor: colors.surface, borderColor: colors.border},
              ]}
              onPress={() => handleConnect(item)}
              disabled={isConnecting}>
              <View style={styles.deviceInfo}>
                <Text style={[styles.deviceName, {color: colors.text}]}>
                  {item.name || item.id}
                </Text>
                <Text style={[styles.deviceId, {color: colors.textSecondary}]}>
                  {item.id}
                </Text>
              </View>
              {connectingId === item.id ? (
                <View style={styles.connectingRow}>
                  <ActivityIndicator size="small" color={colors.speed} />
                  <Text style={[styles.connectingText, {color: colors.speed}]}>
                    {connectionState === 'initializing' ? 'Initializing…' : 'Connecting…'}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.connectText, {color: colors.speed}]}>
                  Connect
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {connectionState === 'error' && (
        <View
          style={[
            styles.errorBanner,
            {backgroundColor: colors.warning + '22', borderColor: colors.warning},
          ]}>
          <Text style={[styles.errorText, {color: colors.warning}]}>
            Connection failed. Make sure your adapter is powered on and plugged into the OBD port.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingTop: 24},
  centered: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  emptyState: {alignItems: 'center', padding: 32},
  header: {fontSize: 22, fontWeight: '700', paddingHorizontal: 20, marginBottom: 6},
  hint: {fontSize: 13, paddingHorizontal: 20, marginBottom: 8, lineHeight: 18},
  scanRow: {paddingHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center'},
  scanButton: {borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6},
  scanButtonText: {fontSize: 13, fontWeight: '600'},
  list: {paddingHorizontal: 16, gap: 10},
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  deviceInfo: {flex: 1},
  deviceName: {fontSize: 16, fontWeight: '600'},
  deviceId: {fontSize: 12, marginTop: 2},
  connectText: {fontSize: 14, fontWeight: '600'},
  connectingRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  connectingText: {fontSize: 13},
  title: {fontSize: 20, fontWeight: '700', marginBottom: 12, textAlign: 'center'},
  subtitle: {fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 16},
  primaryButton: {paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8},
  primaryButtonText: {color: '#FFF', fontWeight: '700', fontSize: 15},
  errorBanner: {margin: 16, padding: 14, borderRadius: 10, borderWidth: 1},
  errorText: {fontSize: 13, lineHeight: 18},
});
