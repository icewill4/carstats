import {create} from 'zustand';
import type {BluetoothDevice, ConnectionState} from '../types/obd.types';

interface BluetoothStore {
  devices: BluetoothDevice[];
  connectionState: ConnectionState;
  connectedDeviceId: string | null;
  connectedDeviceName: string | null;

  setDevices: (devices: BluetoothDevice[]) => void;
  setConnectionState: (state: ConnectionState) => void;
  setConnectedDevice: (id: string | null, name: string | null) => void;
}

export const useBluetoothStore = create<BluetoothStore>(set => ({
  devices: [],
  connectionState: 'disconnected',
  connectedDeviceId: null,
  connectedDeviceName: null,

  setDevices: devices => set({devices}),
  setConnectionState: connectionState => set({connectionState}),
  setConnectedDevice: (connectedDeviceId, connectedDeviceName) =>
    set({connectedDeviceId, connectedDeviceName}),
}));
