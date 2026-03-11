/** Set to true to use the mock ELM327 service during development */
export const MOCK_MODE = true;

/** OBD PID polling interval in milliseconds (min 300ms to avoid ELM327 buffer overflow) */
export const POLL_INTERVAL_MS = 500;

/** Max time to wait for a single ELM327 command response */
export const COMMAND_TIMEOUT_MS = 3000;

/** Max speed displayed on speedometer gauge (km/h) */
export const MAX_SPEED_KMH = 220;

/** Max RPM displayed on RPM gauge */
export const MAX_RPM = 8000;
