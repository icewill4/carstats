/** Set to true to use the mock ELM327 service during development */
export const MOCK_MODE = false;

/** OBD PID polling interval in milliseconds (min 300ms to avoid ELM327 buffer overflow) */
export const POLL_INTERVAL_MS = 500;

/** Max time to wait for a single ELM327 command response */
export const COMMAND_TIMEOUT_MS = 3000;

/** Max speed displayed on speedometer gauge (km/h) */
export const MAX_SPEED_KMH = 220;

/** Max RPM displayed on RPM gauge */
export const MAX_RPM = 8000;

/** Max fuel consumption displayed on gauge (L/100km) */
export const MAX_CONSUMPTION = 20;

/** Min time between store updates in CAN monitor mode (ms) */
export const CAN_UPDATE_THROTTLE_MS = 100;

/** Read loop sleep when BLE buffer is empty in CAN mode (ms) */
export const CAN_READ_INTERVAL_MS = 10;

/** Max CAN IDs to track in sniffer screen */
export const CAN_SNIFFER_MAX_IDS = 200;

/** 1KR-FE engine displacement in liters (Citroen C1 II / Toyota Aygo) */
export const ENGINE_DISPLACEMENT_L = 1.0;

/** Average brake-specific fuel consumption for 1KR-FE (g/kWh) */
export const BSFC_AVG = 250;
