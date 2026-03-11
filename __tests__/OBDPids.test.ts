import {
  parseFuelLevel,
  parseRPM,
  parseResponseBytes,
  parseSpeed,
  isErrorResponse,
} from '../src/bluetooth/OBDPids';

describe('parseResponseBytes', () => {
  it('splits a well-formed response with spaces', () => {
    expect(parseResponseBytes('41 0D 3C')).toEqual(['41', '0D', '3C']);
  });

  it('strips prompt and carriage return characters', () => {
    expect(parseResponseBytes('41 0D 3C\r\n>')).toEqual(['41', '0D', '3C']);
  });

  it('strips echo of the command', () => {
    expect(parseResponseBytes('41 0C 0B B8')).toEqual(['41', '0C', '0B', 'B8']);
  });

  it('returns empty array for empty input', () => {
    expect(parseResponseBytes('')).toEqual([]);
  });
});

describe('parseSpeed', () => {
  it('parses 0x3C (60 decimal) as 60 km/h', () => {
    expect(parseSpeed(['41', '0D', '3C'])).toBe(60);
  });

  it('parses 0x00 as 0 km/h (stopped)', () => {
    expect(parseSpeed(['41', '0D', '00'])).toBe(0);
  });

  it('parses 0xFF as 255 km/h', () => {
    expect(parseSpeed(['41', '0D', 'FF'])).toBe(255);
  });

  it('returns null when bytes are too short', () => {
    expect(parseSpeed(['41', '0D'])).toBeNull();
  });
});

describe('parseRPM', () => {
  it('parses 0x0B 0xB8 as 750 RPM', () => {
    // (0x0B * 256 + 0xB8) / 4 = (11 * 256 + 184) / 4 = 3000 / 4 = 750
    expect(parseRPM(['41', '0C', '0B', 'B8'])).toBe(750);
  });

  it('parses 0x1A 0xF0 as 1724 RPM', () => {
    // (26 * 256 + 240) / 4 = 6896 / 4 = 1724
    expect(parseRPM(['41', '0C', '1A', 'F0'])).toBe(1724);
  });

  it('parses 0x00 0x00 as 0 RPM (engine off)', () => {
    expect(parseRPM(['41', '0C', '00', '00'])).toBe(0);
  });

  it('returns null when bytes are too short', () => {
    expect(parseRPM(['41', '0C', '0B'])).toBeNull();
  });
});

describe('parseFuelLevel', () => {
  it('parses 0x80 (128 decimal) as ~50%', () => {
    const result = parseFuelLevel(['41', '2F', '80']);
    expect(result).toBeCloseTo(50.2, 0);
  });

  it('parses 0xFF (255 decimal) as 100%', () => {
    const result = parseFuelLevel(['41', '2F', 'FF']);
    expect(result).toBeCloseTo(100, 0);
  });

  it('parses 0x00 as 0% (empty tank)', () => {
    expect(parseFuelLevel(['41', '2F', '00'])).toBe(0);
  });

  it('returns null when bytes are too short', () => {
    expect(parseFuelLevel(['41', '2F'])).toBeNull();
  });
});

describe('isErrorResponse', () => {
  it('detects NO DATA', () => {
    expect(isErrorResponse('NO DATA')).toBe(true);
    expect(isErrorResponse('no data')).toBe(true);
  });

  it('detects UNABLE TO CONNECT', () => {
    expect(isErrorResponse('UNABLE TO CONNECT')).toBe(true);
  });

  it('detects BUS INIT error', () => {
    expect(isErrorResponse('BUS INIT: ERROR')).toBe(true);
  });

  it('detects ? (unknown command)', () => {
    expect(isErrorResponse('?')).toBe(true);
  });

  it('does not flag a valid response as error', () => {
    expect(isErrorResponse('41 0D 3C')).toBe(false);
  });
});
