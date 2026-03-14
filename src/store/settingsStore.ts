import {create} from 'zustand';

export type ConnectionMode = 'classic' | 'ble';
export type ProtocolMode = 'obd2' | 'can';

interface SettingsStore {
  connectionMode: ConnectionMode;
  protocolMode: ProtocolMode;
  canProfile: string;
  setConnectionMode: (mode: ConnectionMode) => void;
  setProtocolMode: (mode: ProtocolMode) => void;
  setCanProfile: (profile: string) => void;
}

export const useSettingsStore = create<SettingsStore>(set => ({
  connectionMode: 'ble',
  protocolMode: 'obd2',
  canProfile: 'citroen-c1-ii',
  setConnectionMode: connectionMode => set({connectionMode}),
  setProtocolMode: protocolMode => set({protocolMode}),
  setCanProfile: canProfile => set({canProfile}),
}));
