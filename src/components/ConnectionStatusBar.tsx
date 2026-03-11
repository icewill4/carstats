import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useBluetoothStore} from '../store/bluetoothStore';
import {useTheme} from '../theme';

interface ConnectionStatusBarProps {
  onReconnectPress?: () => void;
}

export function ConnectionStatusBar({onReconnectPress}: ConnectionStatusBarProps) {
  const {colors} = useTheme();
  const {connectionState, connectedDeviceName} = useBluetoothStore();

  const isConnected = connectionState === 'connected';
  const isError = connectionState === 'error';

  const dotColor = isConnected
    ? colors.fuel
    : isError
    ? colors.warning
    : colors.disconnected;

  const label = isConnected
    ? `Connected · ${connectedDeviceName ?? 'ELM327'}`
    : connectionState === 'connecting' || connectionState === 'initializing'
    ? 'Connecting…'
    : isError
    ? 'Connection error'
    : 'Disconnected';

  return (
    <View style={[styles.bar, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
      <View style={[styles.dot, {backgroundColor: dotColor}]} />
      <Text style={[styles.label, {color: colors.textSecondary}]}>{label}</Text>
      {!isConnected && (
        <TouchableOpacity onPress={onReconnectPress} style={styles.button}>
          <Text style={[styles.buttonText, {color: colors.speed}]}>
            {isError ? 'Retry' : 'Connect'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    flex: 1,
    fontSize: 13,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
