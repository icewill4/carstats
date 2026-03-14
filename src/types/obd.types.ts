export interface OBDReading {
  speed: number | null; // km/h
  rpm: number | null; // revolutions per minute
  fuelLevel: number | null; // percentage 0–100
  engineLoad: number | null; // percentage 0–100
  fuelConsumption: number | null; // instantaneous L/100km
  timestamp: number; // Date.now()
}

export interface TripData {
  startTime: number; // Date.now() when trip started
  totalFuelUsed: number; // liters
  totalDistance: number; // km
  averageConsumption: number; // L/100km
  isActive: boolean;
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
