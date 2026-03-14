import {useCallback, useRef} from 'react';
import {bluetoothService} from '../bluetooth/BluetoothService';
import {OBDProtocol} from '../bluetooth/OBDProtocol';
import {CANProtocol} from '../bluetooth/CANProtocol';
import {useBluetoothStore} from '../store/bluetoothStore';
import {useSettingsStore} from '../store/settingsStore';
import type {IBluetoothTransport} from '../bluetooth/OBDProtocol';

// Shared protocol instances — only one is active at a time
let obdProtocolInstance: OBDProtocol | null = null;
let canProtocolInstance: CANProtocol | null = null;
let activeTransport: IBluetoothTransport | null = null;

export function getProtocol(): OBDProtocol | null {
  return obdProtocolInstance;
}

export function getCANProtocol(): CANProtocol | null {
  return canProtocolInstance;
}

export function getTransport(): IBluetoothTransport | null {
  return activeTransport;
}

/** Set protocol instances directly (used by demo mode). */
export function setProtocolInstances(
  obd: OBDProtocol | null,
  can: CANProtocol | null,
  transport?: IBluetoothTransport | null,
) {
  obdProtocolInstance = obd;
  canProtocolInstance = can;
  if (transport !== undefined) activeTransport = transport;
}

export function useBluetooth() {
  const {setDevices, setConnectionState, setConnectedDevice, addDevice} =
    useBluetoothStore();
  const discoveryRef = useRef(false);

  const loadBondedDevices = useCallback(async () => {
    const devices = await bluetoothService.getBondedDevices();
    setDevices(devices);
  }, [setDevices]);

  const startBLEScan = useCallback(() => {
    setDevices([]);
    bluetoothService.startBLEScan(device => addDevice(device));
  }, [setDevices, addDevice]);

  const stopBLEScan = useCallback(() => {
    bluetoothService.stopBLEScan();
  }, []);

  const startDiscovery = useCallback(async () => {
    if (discoveryRef.current) return;
    discoveryRef.current = true;
    try {
      const discovered = await bluetoothService.startDiscovery();
      setDevices(discovered);
    } finally {
      discoveryRef.current = false;
    }
  }, [setDevices]);

  const cancelDiscovery = useCallback(async () => {
    discoveryRef.current = false;
    await bluetoothService.cancelDiscovery();
  }, []);

  const connect = useCallback(
    async (deviceId: string, deviceName: string) => {
      setConnectionState('connecting');
      setConnectedDevice(null, null);

      let transport: IBluetoothTransport;
      try {
        transport = await bluetoothService.connect(deviceId);
        activeTransport = transport;
      } catch (err) {
        setConnectionState('error');
        throw err;
      }

      setConnectionState('initializing');
      const protocolMode = useSettingsStore.getState().protocolMode;
      try {
        if (protocolMode === 'can') {
          canProtocolInstance = new CANProtocol(transport);
          await canProtocolInstance.initialize();
        } else {
          obdProtocolInstance = new OBDProtocol(transport);
          await obdProtocolInstance.initialize();
        }
      } catch (err) {
        obdProtocolInstance = null;
        canProtocolInstance = null;
        await bluetoothService.disconnect();
        setConnectionState('error');
        throw err;
      }

      setConnectionState('connected');
      setConnectedDevice(deviceId, deviceName);
    },
    [setConnectionState, setConnectedDevice],
  );

  const disconnect = useCallback(async () => {
    if (canProtocolInstance) {
      await canProtocolInstance.stopMonitoring().catch(() => {});
    }
    obdProtocolInstance = null;
    canProtocolInstance = null;
    activeTransport = null;
    await bluetoothService.disconnect();
    setConnectionState('disconnected');
    setConnectedDevice(null, null);
  }, [setConnectionState, setConnectedDevice]);

  return {
    loadBondedDevices,
    startBLEScan,
    stopBLEScan,
    startDiscovery,
    cancelDiscovery,
    connect,
    disconnect,
  };
}
