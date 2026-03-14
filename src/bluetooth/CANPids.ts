/**
 * CAN signal definitions and car profiles.
 * CAN IDs are manufacturer-specific — use the CAN sniffer to discover them.
 */

export interface CANSignalDef {
  canId: string; // 3-char hex CAN ID, e.g. '0B4'
  startByte: number; // byte offset in data payload (0-based)
  length: number; // 1 or 2 bytes
  formula: (bytes: number[]) => number; // raw data bytes → engineering value
  unit: string;
}

export interface CANProfile {
  name: string;
  description: string;
  signals: {
    speed?: CANSignalDef;
    rpm?: CANSignalDef;
    fuelLevel?: CANSignalDef;
    engineLoad?: CANSignalDef;
  };
}

/**
 * Built-in car profiles. CAN IDs are populated after sniffer discovery.
 * Placeholder formulas — update once real CAN IDs are identified.
 */
export const CAN_PROFILES: Record<string, CANProfile> = {
  'citroen-c1-ii': {
    name: 'Citroën C1 II',
    description: 'Citroën C1 II / Toyota Aygo / Peugeot 108 (1KR-FE)',
    signals: {
      speed: {
        canId: '0B4',
        startByte: 5,
        length: 2,
        formula: (b) => ((b[5] << 8) | b[6]) * 0.01,
        unit: 'km/h',
      },
      rpm: {
        canId: '1C4',
        startByte: 0,
        length: 2,
        formula: (b) => (b[0] << 8) | b[1],
        unit: 'rpm',
      },
    },
  },
};

/** Parse a single CAN frame line from the ELM327 AT MA output.
 * Format with AT H1 + AT S1: "0B4 00 00 1F 40 00 00 3C 00"
 * Returns null if the line is not a valid CAN frame.
 */
export function parseCANFrame(
  line: string,
): {canId: string; data: number[]} | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 2) return null;

  const canId = tokens[0].toUpperCase();
  // CAN ID should be 1-3 hex chars (11-bit) or up to 8 hex chars (29-bit)
  if (!/^[0-9A-F]{1,8}$/.test(canId)) return null;

  const data = tokens.slice(1).map(b => parseInt(b, 16));
  if (data.some(isNaN)) return null;

  return {canId, data};
}
