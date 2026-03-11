import {create} from 'zustand';
import type {OBDReading} from '../types/obd.types';

const HISTORY_SIZE = 60;

interface OBDStore {
  reading: OBDReading;
  history: OBDReading[];

  updateReading: (reading: OBDReading) => void;
  resetReading: () => void;
}

const emptyReading: OBDReading = {
  speed: null,
  rpm: null,
  fuelLevel: null,
  timestamp: 0,
};

export const useOBDStore = create<OBDStore>(set => ({
  reading: emptyReading,
  history: [],

  updateReading: (reading: OBDReading) =>
    set(state => ({
      reading,
      history: [...state.history.slice(-(HISTORY_SIZE - 1)), reading],
    })),

  resetReading: () => set({reading: emptyReading, history: []}),
}));
