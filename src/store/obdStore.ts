import {create} from 'zustand';
import type {OBDReading, TripData} from '../types/obd.types';

const HISTORY_SIZE = 60;

interface OBDStore {
  reading: OBDReading;
  history: OBDReading[];
  tripData: TripData | null;

  updateReading: (reading: OBDReading) => void;
  resetReading: () => void;
  startTrip: () => void;
  updateTrip: (reading: OBDReading) => void;
  stopTrip: () => void;
}

const emptyReading: OBDReading = {
  speed: null,
  rpm: null,
  fuelLevel: null,
  engineLoad: null,
  fuelConsumption: null,
  timestamp: 0,
};

export const useOBDStore = create<OBDStore>((set, get) => ({
  reading: emptyReading,
  history: [],
  tripData: null,

  updateReading: (reading: OBDReading) =>
    set(state => ({
      reading,
      history: [...state.history.slice(-(HISTORY_SIZE - 1)), reading],
    })),

  resetReading: () => set({reading: emptyReading, history: []}),

  startTrip: () =>
    set({
      tripData: {
        startTime: Date.now(),
        totalFuelUsed: 0,
        totalDistance: 0,
        averageConsumption: 0,
        isActive: true,
      },
    }),

  updateTrip: (reading: OBDReading) => {
    const {tripData} = get();
    if (!tripData || !tripData.isActive) return;

    const {fuelConsumption, speed, timestamp} = reading;
    if (
      fuelConsumption === null ||
      speed === null ||
      speed < 1 ||
      tripData.startTime === 0
    )
      return;

    // dt in hours
    const lastTimestamp =
      get().history.length > 0
        ? get().history[get().history.length - 1].timestamp
        : tripData.startTime;
    const dtHours = (timestamp - lastTimestamp) / 3_600_000;
    if (dtHours <= 0 || dtHours > 0.01) return; // skip if gap > 36s (stale)

    // fuelConsumption is L/100km — convert to L/h: rate = consumption * speed / 100
    const fuelRateLph = (fuelConsumption * speed) / 100;
    const fuelUsed = fuelRateLph * dtHours;
    const distance = speed * dtHours;

    const newTotalFuel = tripData.totalFuelUsed + fuelUsed;
    const newTotalDist = tripData.totalDistance + distance;
    const avgConsumption =
      newTotalDist > 0.01 ? (newTotalFuel / newTotalDist) * 100 : 0;

    set({
      tripData: {
        ...tripData,
        totalFuelUsed: newTotalFuel,
        totalDistance: newTotalDist,
        averageConsumption: avgConsumption,
      },
    });
  },

  stopTrip: () =>
    set(state => ({
      tripData: state.tripData ? {...state.tripData, isActive: false} : null,
    })),
}));
