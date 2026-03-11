import {useCallback, useRef} from 'react';
import {bluetoothService} from '../bluetooth/BluetoothService';
import {OBDProtocol} from '../bluetooth/OBDProtocol';
import {useBluetoothStore} from '../store/bluetoothStore';
import type {IBluetoothTransport} from '../bluetooth/OBDProtocol';

// Shared OBDProtocol instance — set after connection is established
let protocolInstance: OBDProtocol | null = null;

export function getProtocol(): OBDProtocol | null {
  return protocolInstance;
}

export function useBluetooth() {
  const {setDevices, setConnectionState, setConnectedDevice} = useBluetoothStore();
  const discoveryRef = useRef(false);

  const loadBondedDevices = useCallback(async () => {
    const devices = await bluetoothService.getBondedDevices();
    setDevices(devices);
  }, [setDevices]);

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
      } catch (err) {
        setConnectionState('error');
        throw err;
      }

      setConnectionState('initializing');
      try {
        protocolInstance = new OBDProtocol(transport);
        await protocolInstance.initialize();
      } catch (err) {
        protocolInstance = null;
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
    protocolInstance = null;
    await bluetoothService.disconnect();
    setConnectionState('disconnected');
    setConnectedDevice(null, null);
  }, [setConnectionState, setConnectedDevice]);

  return {loadBondedDevices, startDiscovery, cancelDiscovery, connect, disconnect};
}
