import {COMMAND_TIMEOUT_MS} from '../constants/obd.constants';
import {
  PIDS,
  isErrorResponse,
  parseFuelLevel,
  parseRPM,
  parseResponseBytes,
  parseSpeed,
} from './OBDPids';
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

  /**
   * Send a command string (with \r terminator) and wait for the ELM327 `>`
   * prompt character, buffering incoming bytes.
   */
  private async sendCommand(cmd: string): Promise<string> {
    await this.transport.write(cmd + '\r');

    return new Promise<string>((resolve, reject) => {
      let buffer = '';
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        reject(new Error(`OBD timeout waiting for response to: ${cmd}`));
      }, COMMAND_TIMEOUT_MS);

      const poll = async () => {
        if (timedOut) return;
        try {
          const chunk = await this.transport.read();
          buffer += chunk;
          if (buffer.includes('>')) {
            clearTimeout(timeout);
            // Strip the prompt, echo, and ELM327 status messages like
            // "SEARCHING..." that appear on the first PID query after AT SP 0
            const cleaned = buffer
              .replace('>', '')
              .replace(cmd, '')
              .replace(/SEARCHING\.\.\./gi, '')
              .replace(/BUS INIT: \.\.\.OK/gi, '')
              .trim();
            resolve(cleaned);
          } else {
            // Keep polling for more bytes
            setTimeout(poll, 20);
          }
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      };

      poll();
    });
  }
}
