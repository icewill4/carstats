import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {POLL_INTERVAL_MS} from '../constants/obd.constants';
import {getProtocol, getCANProtocol} from './useBluetooth';
import {useBluetoothStore} from '../store/bluetoothStore';
import {useOBDStore} from '../store/obdStore';
import {useSettingsStore} from '../store/settingsStore';

export function useOBDPolling() {
  const connectionState = useBluetoothStore(s => s.connectionState);
  const protocolMode = useSettingsStore(s => s.protocolMode);
  const canProfile = useSettingsStore(s => s.canProfile);
  const {updateReading, resetReading, startTrip, updateTrip, stopTrip} =
    useOBDStore();
  const [isPolling, setIsPolling] = useState(false);
  const pausedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (protocolMode === 'can') {
      getCANProtocol()?.stopMonitoring().catch(() => {});
      stopTrip();
    }

    setIsPolling(false);
  }, [protocolMode, stopTrip]);

  const startPolling = useCallback(() => {
    stopPolling();
    setIsPolling(true);

    if (protocolMode === 'can') {
      // CAN mode: stream-based — CANProtocol pushes readings via callback
      const canProto = getCANProtocol();
      if (!canProto) return;

      startTrip();
      canProto
        .startMonitoring(canProfile, reading => {
          if (pausedRef.current) return;
          updateReading(reading);
          updateTrip(reading);
        })
        .catch(err => {
          console.warn('[OBDPolling] CAN monitoring failed:', err);
        });
    } else {
      // OBD2 mode: interval-based polling (unchanged)
      intervalRef.current = setInterval(async () => {
        if (pausedRef.current) return;

        const protocol = getProtocol();
        if (!protocol) return;

        try {
          const reading = await protocol.pollReading();
          updateReading(reading);
        } catch (err) {
          console.warn('[OBDPolling] pollReading failed:', err);
        }
      }, POLL_INTERVAL_MS);
    }
  }, [
    stopPolling,
    updateReading,
    protocolMode,
    canProfile,
    startTrip,
    updateTrip,
  ]);

  // Start/stop polling based on connection state
  useEffect(() => {
    if (connectionState === 'connected') {
      startPolling();
    } else {
      stopPolling();
      if (connectionState === 'disconnected') {
        resetReading();
      }
    }
    return stopPolling;
  }, [connectionState, startPolling, stopPolling, resetReading]);

  // Pause polling when app goes to background
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      pausedRef.current = nextState !== 'active';
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  return {isPolling};
}
