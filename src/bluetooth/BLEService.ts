import {BleManager} from 'react-native-ble-plx';
import type {Characteristic, Device} from 'react-native-ble-plx';
import type {IBluetoothTransport} from './OBDProtocol';
import type {BluetoothDevice} from '../types/obd.types';

/**
 * BLE transport — buffers incoming GATT notifications so OBDProtocol's
 * pull-based read() interface works unchanged.
 */
class BLETransport implements IBluetoothTransport {
  private rxBuffer = '';
  private subscription: {remove: () => void} | null = null;

  constructor(
    private manager: BleManager,
    private deviceId: string,
    private serviceUUID: string,
    private writeCharUUID: string,
    private notifyCharUUID: string,
    private writeWithResponse: boolean,
  ) {}

  /** Subscribe to GATT notifications — must be called once after connect. */
  startNotifications(): void {
    this.subscription = this.manager.monitorCharacteristicForDevice(
      this.deviceId,
      this.serviceUUID,
      this.notifyCharUUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        // characteristic.value is base64-encoded
        const chunk = atob(characteristic.value);
        this.rxBuffer += chunk;
      },
    );
  }

  stopNotifications(): void {
    this.subscription?.remove();
    this.subscription = null;
  }

  async write(data: string): Promise<void> {
    const encoded = btoa(data);
    if (this.writeWithResponse) {
      await this.manager.writeCharacteristicWithResponseForDevice(
        this.deviceId,
        this.serviceUUID,
        this.writeCharUUID,
        encoded,
      );
    } else {
      await this.manager.writeCharacteristicWithoutResponseForDevice(
        this.deviceId,
        this.serviceUUID,
        this.writeCharUUID,
        encoded,
      );
    }
  }

  async read(): Promise<string> {
    const chunk = this.rxBuffer;
    this.rxBuffer = '';
    return chunk;
  }
}

/**
 * Scans for BLE devices and connects to ELM327 BLE adapters.
 * Auto-discovers the GATT service/characteristics by looking for a
 * characteristic that supports write + notify (common in ELM327 BLE clones).
 */
export class BLEService {
  private manager = new BleManager();
  private connectedDeviceId: string | null = null;
  private activeTransport: BLETransport | null = null;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Starts a BLE scan. Calls onDeviceFound for each named device discovered.
   * Automatically stops after timeoutMs (default 15s).
   */
  startScan(
    onDeviceFound: (device: BluetoothDevice) => void,
    timeoutMs = 15000,
  ): void {
    const seen = new Set<string>();

    this.manager.startDeviceScan(null, {allowDuplicates: false}, (error, device) => {
      if (error || !device || !device.name) return;
      if (seen.has(device.id)) return;
      seen.add(device.id);
      onDeviceFound({id: device.id, name: device.name, bonded: false});
    });

    this.scanTimeout = setTimeout(() => this.stopScan(), timeoutMs);
  }

  stopScan(): void {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
    this.manager.stopDeviceScan();
  }

  async connect(deviceId: string): Promise<IBluetoothTransport> {
    this.stopScan();

    const device = await this.manager.connectToDevice(deviceId, {
      requestMTU: 512,
    });
    await device.discoverAllServicesAndCharacteristics();

    const {serviceUUID, writeCharUUID, notifyCharUUID, writeWithResponse} =
      await this.discoverOBDCharacteristics(device);

    this.connectedDeviceId = deviceId;
    this.activeTransport = new BLETransport(
      this.manager,
      deviceId,
      serviceUUID,
      writeCharUUID,
      notifyCharUUID,
      writeWithResponse,
    );
    this.activeTransport.startNotifications();
    return this.activeTransport;
  }

  async disconnect(): Promise<void> {
    this.activeTransport?.stopNotifications();
    this.activeTransport = null;
    if (this.connectedDeviceId) {
      await this.manager.cancelDeviceConnection(this.connectedDeviceId);
      this.connectedDeviceId = null;
    }
  }

  isConnected(): boolean {
    return this.connectedDeviceId !== null;
  }

  /**
   * Walks the device's GATT services to find OBD-compatible characteristics.
   *
   * Strategy:
   * 1. A single characteristic with write + notify (e.g. FFE1) — use for both.
   * 2. Separate write char + notify char in the same service (e.g. FFF0/FFF1/FFF2).
   *
   * Skips standard BT services (0x1800, 0x1801, 0x180A) that are never OBD.
   */
  private async discoverOBDCharacteristics(device: Device): Promise<{
    serviceUUID: string;
    writeCharUUID: string;
    notifyCharUUID: string;
    writeWithResponse: boolean;
  }> {
    const SKIP_SERVICES = new Set(['1800', '1801', '180a']);

    const services = await device.services();
    for (const service of services) {
      const shortUUID = service.uuid.replace(/-.*/, '').toLowerCase();
      if (SKIP_SERVICES.has(shortUUID)) continue;

      const chars: Characteristic[] = await service.characteristics();
      let writeChar: Characteristic | null = null;
      let notifyChar: Characteristic | null = null;

      for (const c of chars) {
        const canWrite = c.isWritableWithoutResponse || c.isWritableWithResponse;
        const canNotify = c.isNotifiable || c.isIndicatable;

        if (canWrite && canNotify) {
          // Single char handles both — most common layout (FFE1)
          return {
            serviceUUID: service.uuid,
            writeCharUUID: c.uuid,
            notifyCharUUID: c.uuid,
            writeWithResponse: !c.isWritableWithoutResponse,
          };
        }
        if (canWrite) writeChar = c;
        if (canNotify) notifyChar = c;
      }

      if (writeChar && notifyChar) {
        return {
          serviceUUID: service.uuid,
          writeCharUUID: writeChar.uuid,
          notifyCharUUID: notifyChar.uuid,
          writeWithResponse: !writeChar.isWritableWithoutResponse,
        };
      }
    }

    throw new Error(
      'Could not find OBD GATT characteristics on this device. ' +
        'Make sure the adapter is an ELM327 BLE model.',
    );
  }
}

export const bleService = new BLEService();
