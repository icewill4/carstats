import {
  COMMAND_TIMEOUT_MS,
  CAN_READ_INTERVAL_MS,
  CAN_UPDATE_THROTTLE_MS,
  ENGINE_DISPLACEMENT_L,
  BSFC_AVG,
} from '../constants/obd.constants';
import {sendATCommand} from './elm327';
import {parseCANFrame, CAN_PROFILES} from './CANPids';
import type {CANProfile} from './CANPids';
import type {IBluetoothTransport} from './OBDProtocol';
import type {OBDReading} from '../types/obd.types';

/** Callback for each raw CAN frame (sniffer mode). */
export type CANFrameCallback = (canId: string, data: number[]) => void;

/** Callback for parsed OBD readings (monitor mode). */
type ReadingCallback = (reading: OBDReading) => void;

const CAN_INIT_SEQUENCE = [
  'AT Z', // Reset
  'AT E0', // Echo off
  'AT L0', // Linefeeds off
  'AT S1', // Spaces on
  'AT H1', // Headers ON — need CAN IDs in output
  'AT CAF0', // CAN auto-formatting off (raw frames)
  'AT SP 6', // ISO 15765-4 CAN 11-bit 500kbps
  'AT AT 1', // Adaptive timing
];

export class CANProtocol {
  private transport: IBluetoothTransport;
  private running = false;
  private profile: CANProfile | null = null;
  private onReading: ReadingCallback | null = null;
  private onFrame: CANFrameCallback | null = null;
  private lastEmitTime = 0;
  private graceUntil = 0;
  private latestValues: Map<string, number[]> = new Map();

  constructor(transport: IBluetoothTransport) {
    this.transport = transport;
  }

  /**
   * Run the ELM327 AT initialization sequence for CAN monitor mode.
   * Must be called once after Bluetooth connection is established.
   */
  async initialize(): Promise<void> {
    for (const cmd of CAN_INIT_SEQUENCE) {
      try {
        await sendATCommand(this.transport, cmd, COMMAND_TIMEOUT_MS);
      } catch (err) {
        // AT SP 6 may fail on some adapters — fall back to auto-detect
        if (cmd === 'AT SP 6') {
          console.warn('[CAN] AT SP 6 failed, trying AT SP 0 (auto-detect)');
          await sendATCommand(this.transport, 'AT SP 0', COMMAND_TIMEOUT_MS);
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Start filtered CAN monitoring. Streams parsed OBDReadings via callback.
   * Uses AT CRA to filter by CAN IDs in the profile, then AT MA to start.
   */
  async startMonitoring(
    profileName: string,
    onReading: ReadingCallback,
  ): Promise<void> {
    const profile = CAN_PROFILES[profileName];
    if (!profile) {
      throw new Error(`Unknown CAN profile: ${profileName}`);
    }

    this.profile = profile;
    this.onReading = onReading;
    this.running = true;
    this.latestValues.clear();
    this.lastEmitTime = 0;

    // Set CAN receive filters for the IDs we care about
    const canIds = new Set<string>();
    const signals = profile.signals;
    if (signals.speed) canIds.add(signals.speed.canId);
    if (signals.rpm) canIds.add(signals.rpm.canId);
    if (signals.fuelLevel) canIds.add(signals.fuelLevel.canId);
    if (signals.engineLoad) canIds.add(signals.engineLoad.canId);

    // If we have exactly one CAN ID, use AT CRA for precise filtering
    // Otherwise use AT MA (monitor all) — ELM327 only supports one CRA filter
    if (canIds.size === 1) {
      const [id] = canIds;
      await sendATCommand(
        this.transport,
        `AT CRA ${id}`,
        COMMAND_TIMEOUT_MS,
      );
    }

    // Drain leftover data before starting monitor mode
    for (let i = 0; i < 10; i++) {
      const leftover = await this.transport.read();
      if (!leftover) break;
    }

    // Start monitor mode — do NOT wait for `>` (it streams continuously)
    await this.transport.write('AT MA\r');

    // Grace period: ignore `>` prompts for the first second (leftover from init)
    this.graceUntil = Date.now() + 1000;

    // Start the read loop
    this.readLoop();
  }

  /**
   * Start unfiltered CAN sniffing. Calls back with every raw frame.
   */
  async startSniffing(onFrame: CANFrameCallback): Promise<void> {
    this.onFrame = onFrame;
    this.running = true;

    // Drain any leftover data in the transport buffer before starting AT MA
    for (let i = 0; i < 10; i++) {
      const leftover = await this.transport.read();
      if (!leftover) break;
    }

    await this.transport.write('AT MA\r');

    // Grace period: ignore `>` prompts for the first second (leftover from init)
    this.graceUntil = Date.now() + 1000;
    this.readLoop();
  }

  /**
   * Stop monitoring or sniffing. Sends a character to exit AT MA.
   */
  async stopMonitoring(): Promise<void> {
    this.running = false;
    this.onReading = null;
    this.onFrame = null;

    try {
      // Send any character to exit AT MA, then wait for `>` prompt
      await sendATCommand(this.transport, '', COMMAND_TIMEOUT_MS);
    } catch {
      // Best-effort — adapter may already be out of monitor mode
    }
  }

  // Stop sniffing (alias)
  async stopSniffing(): Promise<void> {
    return this.stopMonitoring();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async readLoop(): Promise<void> {
    let buffer = '';

    while (this.running) {
      try {
        const chunk = await this.transport.read();
        if (!chunk) {
          await this.sleep(CAN_READ_INTERVAL_MS);
          continue;
        }

        buffer += chunk;

        // Normalize line endings, then split on \n
        buffer = buffer.replace(/\r\n?/g, '\n');
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete last line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // ELM327 exited monitor mode
          if (trimmed === '>') {
            if (Date.now() < this.graceUntil) {
              continue; // leftover prompt from init, skip it
            }
            // Auto-restart AT MA — cheap clones exit after a few frames
            console.warn('[CAN] AT MA exited, restarting...');
            await this.sleep(50);
            buffer = '';
            await this.transport.write('AT MA\r');
            this.graceUntil = Date.now() + 300;
            break; // restart the line-parse loop with fresh buffer
          }

          // Skip ELM327 status messages
          if (
            /^(SEARCHING|BUS INIT|UNABLE|NO DATA|CAN ERROR|\?)/i.test(trimmed)
          ) {
            continue;
          }

          const frame = parseCANFrame(trimmed);
          if (!frame) continue;

          // Sniffer callback
          if (this.onFrame) {
            this.onFrame(frame.canId, frame.data);
          }

          // Store latest values for this CAN ID
          this.latestValues.set(frame.canId, frame.data);

          // Throttled reading emission
          if (this.onReading && this.profile) {
            this.tryEmitReading();
          }
        }
      } catch (err) {
        console.warn('[CAN] read error:', err);
        await this.sleep(50);
      }
    }
  }

  private tryEmitReading(): void {
    const now = Date.now();
    if (now - this.lastEmitTime < CAN_UPDATE_THROTTLE_MS) return;
    this.lastEmitTime = now;

    const profile = this.profile!;
    const signals = profile.signals;

    const speed = this.extractSignal(signals.speed);
    const rpm = this.extractSignal(signals.rpm);
    const fuelLevel = this.extractSignal(signals.fuelLevel);
    const engineLoad = this.extractSignal(signals.engineLoad);

    // Calculate instantaneous fuel consumption (L/100km)
    let fuelConsumption: number | null = null;
    if (rpm !== null && engineLoad !== null && speed !== null && speed > 1) {
      // Estimated fuel rate in L/h:
      // rate = (rpm * load/100 * displacement) / (2 * BSFC_factor)
      // Simplified: rate = (rpm * load * displacement) / (2 * BSFC * 6000)
      // where BSFC is in g/kWh and we approximate kW from load%
      const fuelRateLph =
        (rpm * (engineLoad / 100) * ENGINE_DISPLACEMENT_L) /
        (2 * (BSFC_AVG / 1000) * 60);
      fuelConsumption = (fuelRateLph / speed) * 100;
      // Clamp to reasonable range
      if (fuelConsumption > 99) fuelConsumption = 99;
      if (fuelConsumption < 0) fuelConsumption = 0;
    }

    this.onReading!({
      speed,
      rpm,
      fuelLevel,
      engineLoad,
      fuelConsumption,
      timestamp: Date.now(),
    });
  }

  private extractSignal(
    signal: {canId: string; formula: (bytes: number[]) => number} | undefined,
  ): number | null {
    if (!signal) return null;
    const data = this.latestValues.get(signal.canId);
    if (!data) return null;
    try {
      return signal.formula(data);
    } catch {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
