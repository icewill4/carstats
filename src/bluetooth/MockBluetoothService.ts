import type {IBluetoothTransport} from './OBDProtocol';
import type {BluetoothDevice} from '../types/obd.types';

export const MOCK_DEVICE: BluetoothDevice = {
  id: '00:11:22:33:44:55',
  name: 'ELM327 MOCK',
  bonded: true,
};

/**
 * Simulated ELM327 transport for development.
 * Responds to AT commands and OBD PIDs with realistic fake values.
 */
export class MockBluetoothTransport implements IBluetoothTransport {
  private responseQueue: string[] = [];
  private startTime = Date.now();
  private canStreamMode = false;
  private canStreamTimer: ReturnType<typeof setInterval> | null = null;

  // Simulate a latency of 50–150ms per response
  private latency(): number {
    return 50 + Math.random() * 100;
  }

  private elapsedSeconds(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  /** Simulated speed: sine wave 0–120 km/h */
  private mockSpeed(): number {
    const t = this.elapsedSeconds();
    return Math.max(0, Math.round(60 + 60 * Math.sin(t / 10) + (Math.random() - 0.5) * 5));
  }

  /** Simulated RPM: proportional to speed, with idle floor */
  private mockRPM(): number {
    const speed = this.mockSpeed();
    return Math.round(speed * 30 + 800 + (Math.random() - 0.5) * 100);
  }

  /** Simulated fuel: starts at 75%, drains very slowly */
  private mockFuel(): number {
    const drain = (this.elapsedSeconds() / 3600) * 5; // 5% per hour
    return Math.max(0, Math.round((75 - drain) * 10) / 10);
  }

  private speedToHex(kmh: number): string {
    return kmh.toString(16).toUpperCase().padStart(2, '0');
  }

  private rpmToHex(rpm: number): string {
    const raw = Math.round(rpm * 4);
    const a = Math.floor(raw / 256).toString(16).toUpperCase().padStart(2, '0');
    const b = (raw % 256).toString(16).toUpperCase().padStart(2, '0');
    return `${a} ${b}`;
  }

  private fuelToHex(percent: number): string {
    return Math.round(percent * 2.55).toString(16).toUpperCase().padStart(2, '0');
  }

  /** Simulated engine load: 20–80% */
  private mockLoad(): number {
    const speed = this.mockSpeed();
    return Math.min(80, Math.max(20, Math.round(speed * 0.5 + 10 + (Math.random() - 0.5) * 10)));
  }

  private byteToHex(n: number): string {
    return Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .toUpperCase()
      .padStart(2, '0');
  }

  /** Generate mock CAN frames matching a fake Citroen C1 II profile */
  private generateCANFrames(): string {
    const speed = this.mockSpeed();
    const rpm = this.mockRPM();
    const fuel = this.mockFuel();
    const load = this.mockLoad();

    // Mock CAN IDs (will match the profile once discovered)
    const speedHi = this.byteToHex(Math.floor(speed / 1));
    const rpmRaw = Math.round(rpm * 4);
    const rpmHi = this.byteToHex(Math.floor(rpmRaw / 256));
    const rpmLo = this.byteToHex(rpmRaw % 256);
    const fuelHex = this.byteToHex(Math.round(fuel * 2.55));
    const loadHex = this.byteToHex(Math.round(load * 2.55));

    // Simulated CAN frames (IDs match common Toyota/PSA patterns)
    const frames = [
      `0B4 00 00 00 ${rpmHi} ${rpmLo} ${speedHi} 00 00`,
      `3B7 00 00 ${fuelHex} 00 00 00 00 00`,
      `120 00 00 00 00 ${loadHex} 00 00 00`,
      // Some noise frames to make sniffer realistic
      `420 FF 00 ${this.byteToHex(Math.random() * 255)} 00 00 00 00 00`,
      `130 00 ${this.byteToHex(Math.random() * 255)} 00 00 00 00 00 00`,
    ];

    return frames.map(f => f + '\r').join('');
  }

  private startCANStream(): void {
    this.canStreamMode = true;
    // Generate frames every 50ms (simulating ~20Hz CAN bus)
    this.canStreamTimer = setInterval(() => {
      if (this.canStreamMode) {
        this.responseQueue.push(this.generateCANFrames());
      }
    }, 50);
  }

  private stopCANStream(): void {
    this.canStreamMode = false;
    if (this.canStreamTimer) {
      clearInterval(this.canStreamTimer);
      this.canStreamTimer = null;
    }
  }

  async write(data: string): Promise<void> {
    const cmd = data.replace('\r', '').trim().toUpperCase();

    await new Promise(resolve => setTimeout(resolve, this.latency()));

    // If in CAN stream mode, any write stops it (exit AT MA)
    if (this.canStreamMode && cmd !== 'AT MA') {
      this.stopCANStream();
      this.responseQueue.push('OK\r\n>');
      return;
    }

    if (cmd === 'AT MA') {
      this.startCANStream();
      return;
    }

    if (cmd.startsWith('AT')) {
      if (cmd === 'AT Z') {
        this.stopCANStream();
        this.responseQueue.push('ELM327 v1.5\r\n>');
      } else {
        this.responseQueue.push('OK\r\n>');
      }
      return;
    }

    // OBD PID responses
    switch (cmd) {
      case '010D':
        this.responseQueue.push(`41 0D ${this.speedToHex(this.mockSpeed())}\r\n>`);
        break;
      case '010C':
        this.responseQueue.push(`41 0C ${this.rpmToHex(this.mockRPM())}\r\n>`);
        break;
      case '012F':
        this.responseQueue.push(`41 2F ${this.fuelToHex(this.mockFuel())}\r\n>`);
        break;
      default:
        this.responseQueue.push('NO DATA\r\n>');
    }
  }

  async read(): Promise<string> {
    const response = this.responseQueue.shift();
    return response ?? '';
  }
}

export class MockBluetoothService {
  private transport = new MockBluetoothTransport();
  private connected = false;

  getBondedDevices(): BluetoothDevice[] {
    return [MOCK_DEVICE];
  }

  async connect(_deviceId: string): Promise<MockBluetoothTransport> {
    await new Promise(resolve => setTimeout(resolve, 300));
    this.connected = true;
    return this.transport;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
