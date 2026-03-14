import {create} from 'zustand';

export type ConnectionMode = 'classic' | 'ble';

interface SettingsStore {
  connectionMode: ConnectionMode;
  setConnectionMode: (mode: ConnectionMode) => void;
}

export const useSettingsStore = create<SettingsStore>(set => ({
  connectionMode: 'ble',
  setConnectionMode: connectionMode => set({connectionMode}),
}));
