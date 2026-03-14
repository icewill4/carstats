import type {IBluetoothTransport} from './OBDProtocol';

/**
 * Send an AT/OBD command to the ELM327 and wait for the `>` prompt.
 * Shared by OBDProtocol (request-response) and CANProtocol (init sequence).
 */
export async function sendATCommand(
  transport: IBluetoothTransport,
  cmd: string,
  timeoutMs: number,
): Promise<string> {
  await transport.write(cmd + '\r');

  return new Promise<string>((resolve, reject) => {
    let buffer = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      reject(new Error(`ELM327 timeout waiting for response to: ${cmd}`));
    }, timeoutMs);

    const poll = async () => {
      if (timedOut) return;
      try {
        const chunk = await transport.read();
        buffer += chunk;
        if (buffer.includes('>')) {
          clearTimeout(timeout);
          const cleaned = buffer
            .replace('>', '')
            .replace(cmd, '')
            .replace(/SEARCHING\.\.\./gi, '')
            .replace(/BUS INIT: \.\.\.OK/gi, '')
            .trim();
          resolve(cleaned);
        } else {
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
