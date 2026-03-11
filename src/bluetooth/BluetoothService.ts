import RNBluetoothClassic from 'react-native-bluetooth-classic';
import {MOCK_MODE} from '../constants/obd.constants';
import {MockBluetoothService} from './MockBluetoothService';
import type {IBluetoothTransport} from './OBDProtocol';
import type {BluetoothDevice} from '../types/obd.types';

/**
 * Adapter that wraps a react-native-bluetooth-classic device connection
 * to satisfy the IBluetoothTransport interface expected by OBDProtocol.
 */
class RNBTTransport implements IBluetoothTransport {
  constructor(private deviceId: string) {}

  async write(data: string): Promise<void> {
    await RNBluetoothClassic.writeToDevice(this.deviceId, data);
  }

  async read(): Promise<string> {
    const available = await RNBluetoothClassic.available(this.deviceId);
    if (!available) return '';
    const data = await RNBluetoothClassic.readFromDevice(this.deviceId);
    return data ?? '';
  }
}

/**
 * Main Bluetooth service.
 * Switches between real ELM327 hardware and MockBluetoothService based on MOCK_MODE.
 */
class BluetoothService {
  private mock = new MockBluetoothService();
  private connectedDeviceId: string | null = null;

  /** Returns all bonded (paired) Bluetooth devices. */
  async getBondedDevices(): Promise<BluetoothDevice[]> {
    if (MOCK_MODE) {
      return this.mock.getBondedDevices();
    }
    const devices = await RNBluetoothClassic.getBondedDevices();
    return devices.map(d => ({
      id: d.address,
      name: d.name ?? d.address,
      bonded: true,
    }));
  }

  /** Start Bluetooth Classic discovery for nearby (unpaired) devices. */
  async startDiscovery(): Promise<BluetoothDevice[]> {
    if (MOCK_MODE) return [];
    const devices = await RNBluetoothClassic.startDiscovery();
    return devices.map(d => ({
      id: d.address,
      name: d.name ?? d.address,
      bonded: false,
    }));
  }

  /** Stop ongoing discovery. */
  async cancelDiscovery(): Promise<void> {
    if (MOCK_MODE) return;
    await RNBluetoothClassic.cancelDiscovery();
  }

  /**
   * Connect to a device by its MAC address (or mock ID).
   * Returns an IBluetoothTransport ready for use with OBDProtocol.
   */
  async connect(deviceId: string): Promise<IBluetoothTransport> {
    if (MOCK_MODE) {
      const transport = await this.mock.connect(deviceId);
      this.connectedDeviceId = deviceId;
      return transport;
    }

    await RNBluetoothClassic.connectToDevice(deviceId);
    this.connectedDeviceId = deviceId;
    return new RNBTTransport(deviceId);
  }

  /** Disconnect from the currently connected device. */
  async disconnect(): Promise<void> {
    if (MOCK_MODE) {
      await this.mock.disconnect();
      this.connectedDeviceId = null;
      return;
    }

    if (this.connectedDeviceId) {
      await RNBluetoothClassic.disconnectFromDevice(this.connectedDeviceId);
      this.connectedDeviceId = null;
    }
  }

  isConnected(): boolean {
    if (MOCK_MODE) return this.mock.isConnected();
    return this.connectedDeviceId !== null;
  }

  getConnectedDeviceId(): string | null {
    return this.connectedDeviceId;
  }
}

// Singleton — one Bluetooth service instance for the whole app
export const bluetoothService = new BluetoothService();
