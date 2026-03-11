export interface OBDReading {
  speed: number | null; // km/h
  rpm: number | null; // revolutions per minute
  fuelLevel: number | null; // percentage 0–100
  timestamp: number; // Date.now()
}

export interface BluetoothDevice {
  id: string; // MAC address
  name: string;
  bonded: boolean; // paired in Android terminology
}

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'initializing'
  | 'connected'
  | 'error';
