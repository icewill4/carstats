import RNBluetoothClassic from 'react-native-bluetooth-classic';
import {MOCK_MODE} from '../constants/obd.constants';
import {MockBluetoothService} from './MockBluetoothService';
import {bleService} from './BLEService';
import type {IBluetoothTransport} from './OBDProtocol';
import type {BluetoothDevice} from '../types/obd.types';
import {useSettingsStore} from '../store/settingsStore';

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
    const available = await RNBluetoothClassic.availableFromDevice(this.deviceId);
    if (!available) return '';
    const data = await RNBluetoothClassic.readFromDevice(this.deviceId);
    // The native layer uses '>' as its delimiter and consumes it, so re-append
    // it here so that OBDProtocol's buffer.includes('>') check still works.
    return (data ?? '') + '>';
  }
}

/**
 * Main Bluetooth service.
 * Delegates to BLEService or react-native-bluetooth-classic based on
 * the connectionMode set in settingsStore.
 * In MOCK_MODE, always uses MockBluetoothService regardless of mode.
 */
class BluetoothService {
  private mock = new MockBluetoothService();
  private connectedDeviceId: string | null = null;

  private get mode() {
    return useSettingsStore.getState().connectionMode;
  }

  /** Returns all bonded (paired) devices — Classic only. BLE uses scanning. */
  async getBondedDevices(): Promise<BluetoothDevice[]> {
    if (MOCK_MODE) return this.mock.getBondedDevices();
    if (this.mode === 'ble') return [];
    const devices = await RNBluetoothClassic.getBondedDevices();
    return devices.map(d => ({
      id: d.address,
      name: d.name ?? d.address,
      bonded: true,
    }));
  }

  /** Start BLE scan — only valid in BLE mode. */
  startBLEScan(onDeviceFound: (device: BluetoothDevice) => void): void {
    bleService.startScan(onDeviceFound);
  }

  /** Stop BLE scan. */
  stopBLEScan(): void {
    bleService.stopScan();
  }

  /** Start Bluetooth Classic discovery for nearby (unpaired) devices. */
  async startDiscovery(): Promise<BluetoothDevice[]> {
    if (MOCK_MODE || this.mode === 'ble') return [];
    const devices = await RNBluetoothClassic.startDiscovery();
    return devices.map(d => ({
      id: d.address,
      name: d.name ?? d.address,
      bonded: false,
    }));
  }

  /** Stop ongoing Classic discovery. */
  async cancelDiscovery(): Promise<void> {
    if (MOCK_MODE || this.mode === 'ble') return;
    await RNBluetoothClassic.cancelDiscovery();
  }

  /**
   * Connect to a device. Routes to BLE or Classic based on connectionMode.
   * Returns an IBluetoothTransport ready for use with OBDProtocol.
   */
  async connect(deviceId: string): Promise<IBluetoothTransport> {
    if (MOCK_MODE) {
      const transport = await this.mock.connect(deviceId);
      this.connectedDeviceId = deviceId;
      return transport;
    }

    if (this.mode === 'ble') {
      const transport = await bleService.connect(deviceId);
      this.connectedDeviceId = deviceId;
      return transport;
    }

    // delimiter:'>' tells the native Android layer to flush each response at the
    // ELM327 prompt character rather than the default '\n', which ELM327 never
    // appends after '>'.
    await RNBluetoothClassic.connectToDevice(deviceId, {delimiter: '>'});
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

    if (this.mode === 'ble') {
      await bleService.disconnect();
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
    if (this.mode === 'ble') return bleService.isConnected();
    return this.connectedDeviceId !== null;
  }

  getConnectedDeviceId(): string | null {
    return this.connectedDeviceId;
  }
}

// Singleton — one Bluetooth service instance for the whole app
export const bluetoothService = new BluetoothService();
