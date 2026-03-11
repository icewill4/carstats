/**
 * OBD2 Service 01 PID definitions with parse formulas.
 * Reference: https://en.wikipedia.org/wiki/OBD-II_PIDs#Service_01
 */

export const PIDS = {
  SPEED: '010D', // Vehicle speed — 1 byte, direct km/h
  RPM: '010C', // Engine RPM — 2 bytes, value = (A*256 + B) / 4
  FUEL_LEVEL: '012F', // Fuel tank level — 1 byte, value = A / 2.55 (%)
} as const;

/**
 * Parse a raw OBD2 hex response string into a numeric value.
 * Input bytes should already be split (e.g. ["41", "0D", "3C"]).
 */
export function parseSpeed(bytes: string[]): number | null {
  if (bytes.length < 3) return null;
  const value = parseInt(bytes[2], 16);
  return isNaN(value) ? null : value;
}

export function parseRPM(bytes: string[]): number | null {
  if (bytes.length < 4) return null;
  const a = parseInt(bytes[2], 16);
  const b = parseInt(bytes[3], 16);
  if (isNaN(a) || isNaN(b)) return null;
  return (a * 256 + b) / 4;
}

export function parseFuelLevel(bytes: string[]): number | null {
  if (bytes.length < 3) return null;
  const value = parseInt(bytes[2], 16);
  if (isNaN(value)) return null;
  return Math.round((value / 2.55) * 10) / 10; // one decimal place
}

/**
 * Strip whitespace and control characters from a raw ELM327 response,
 * then split into individual hex byte strings.
 * E.g. "41 0D 3C\r>" → ["41", "0D", "3C"]
 */
export function parseResponseBytes(raw: string): string[] {
  return raw
    .replace(/[^0-9A-Fa-f\s]/g, '') // remove non-hex, non-space chars
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export const ERROR_RESPONSES = ['NO DATA', 'UNABLE TO CONNECT', 'BUS INIT', '?', 'ERROR'] as const;

export function isErrorResponse(raw: string): boolean {
  const upper = raw.toUpperCase();
  return ERROR_RESPONSES.some(err => upper.includes(err));
}
