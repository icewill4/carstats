import {COMMAND_TIMEOUT_MS} from '../constants/obd.constants';
import {
  PIDS,
  isErrorResponse,
  parseFuelLevel,
  parseRPM,
  parseResponseBytes,
  parseSpeed,
} from './OBDPids';
import {sendATCommand} from './elm327';
import type {OBDReading} from '../types/obd.types';

/**
 * Interface that both RealBluetoothService and MockBluetoothService must implement.
 * OBDProtocol only depends on this interface, never on the concrete implementations.
 */
export interface IBluetoothTransport {
  /** Send raw bytes to the connected device */
  write(data: string): Promise<void>;
  /** Read pending bytes from the device's receive buffer */
  read(): Promise<string>;
}

const AT_INIT_SEQUENCE = [
  'AT Z', // Reset
  'AT E0', // Echo off
  'AT L0', // Linefeeds off
  'AT S1', // Spaces on — parser expects space-separated hex bytes
  'AT H0', // Headers off
  'AT SP 0', // Auto-detect OBD protocol
  'AT AT 1', // Adaptive timing mode 1
];

export class OBDProtocol {
  private transport: IBluetoothTransport;
  private commandLock: Promise<unknown> = Promise.resolve();

  constructor(transport: IBluetoothTransport) {
    this.transport = transport;
  }

  /**
   * Run the ELM327 AT initialization sequence.
   * Must be called once after Bluetooth connection is established.
   */
  async initialize(): Promise<void> {
    for (const cmd of AT_INIT_SEQUENCE) {
      await this.sendCommand(cmd);
    }
  }

  /**
   * Query a single OBD PID and return its raw response string.
   * Commands are serialized via a mutex — concurrent callers queue up.
   */
  async query(pid: string): Promise<string> {
    const result = await this.enqueue(() => this.sendCommand(pid));
    return result;
  }

  /**
   * Query all three primary PIDs and return a complete OBDReading.
   */
  async pollReading(): Promise<OBDReading> {
    const [speedRaw, rpmRaw, fuelRaw] = await Promise.all([
      // Not truly parallel — each is enqueued and executed in order
      this.query(PIDS.SPEED),
      this.query(PIDS.RPM),
      this.query(PIDS.FUEL_LEVEL),
    ]);

    console.log('[OBD] raw responses:', JSON.stringify({speedRaw, rpmRaw, fuelRaw}));

    return {
      speed: isErrorResponse(speedRaw)
        ? null
        : parseSpeed(parseResponseBytes(speedRaw)),
      rpm: isErrorResponse(rpmRaw)
        ? null
        : parseRPM(parseResponseBytes(rpmRaw)),
      fuelLevel: isErrorResponse(fuelRaw)
        ? null
        : parseFuelLevel(parseResponseBytes(fuelRaw)),
      engineLoad: null,
      fuelConsumption: null,
      timestamp: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /** Queue a command so they are never interleaved */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.commandLock.then(() => fn());
    // Always resolve the lock regardless of error
    this.commandLock = next.catch(() => {});
    return next;
  }

  /** Send a command and wait for the ELM327 `>` prompt. */
  private sendCommand(cmd: string): Promise<string> {
    return sendATCommand(this.transport, cmd, COMMAND_TIMEOUT_MS);
  }
}
