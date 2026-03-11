import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {POLL_INTERVAL_MS} from '../constants/obd.constants';
import {getProtocol} from './useBluetooth';
import {useBluetoothStore} from '../store/bluetoothStore';
import {useOBDStore} from '../store/obdStore';

export function useOBDPolling() {
  const connectionState = useBluetoothStore(s => s.connectionState);
  const {updateReading, resetReading} = useOBDStore();
  const [isPolling, setIsPolling] = useState(false);
  const pausedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    setIsPolling(true);

    intervalRef.current = setInterval(async () => {
      if (pausedRef.current) return;

      const protocol = getProtocol();
      if (!protocol) return;

      try {
        const reading = await protocol.pollReading();
        updateReading(reading);
      } catch {
        // Silently ignore polling errors — connection issue will surface via BT events
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, updateReading]);

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
