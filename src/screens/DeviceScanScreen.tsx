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
import {useTheme} from '../theme';
import type {BluetoothDevice} from '../types/obd.types';

type Props = NativeStackScreenProps<RootStackParamList, 'DeviceScan'>;

export function DeviceScanScreen({navigation}: Props) {
  const {colors} = useTheme();
  const {status, requestPermissions} = usePermissions();
  const {loadBondedDevices, connect} = useBluetooth();
  const {devices, connectionState} = useBluetoothStore();
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const isConnecting =
    connectionState === 'connecting' || connectionState === 'initializing';

  useEffect(() => {
    if (status === 'granted') {
      loadBondedDevices();
    }
  }, [status, loadBondedDevices]);

  // Navigate to dashboard once connected
  useEffect(() => {
    if (connectionState === 'connected') {
      navigation.replace('Main');
    }
  }, [connectionState, navigation]);

  const handleConnect = useCallback(
    async (device: BluetoothDevice) => {
      setConnectingId(device.id);
      try {
        await connect(device.id, device.name);
      } catch {
        setConnectingId(null);
      }
    },
    [connect],
  );

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

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Text style={[styles.header, {color: colors.text}]}>
        Select your ELM327 adapter
      </Text>
      <Text style={[styles.hint, {color: colors.textSecondary}]}>
        Pair your device in Android Settings first, then it will appear here.
      </Text>

      {devices.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.speed} />
          <Text style={[styles.hint, {color: colors.textSecondary, marginTop: 12}]}>
            Loading paired devices…
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
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
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
        <View style={[styles.errorBanner, {backgroundColor: colors.warning + '22', borderColor: colors.warning}]}>
          <Text style={[styles.errorText, {color: colors.warning}]}>
            Connection failed. Make sure your adapter is powered on and in range.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingTop: 24},
  centered: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  header: {fontSize: 22, fontWeight: '700', paddingHorizontal: 20, marginBottom: 6},
  hint: {fontSize: 13, paddingHorizontal: 20, marginBottom: 20, lineHeight: 18},
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
  errorBanner: {
    margin: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {fontSize: 13, lineHeight: 18},
});
