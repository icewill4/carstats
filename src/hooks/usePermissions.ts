import {useCallback, useEffect, useState} from 'react';
import {PermissionsAndroid, Platform} from 'react-native';

type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'blocked';

export function usePermissions() {
  const [status, setStatus] = useState<PermissionStatus>('unknown');

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      setStatus('granted');
      return true;
    }

    const apiLevel = Platform.Version as number;

    try {
      if (apiLevel >= 31) {
        // Android 12+ — request new Bluetooth permissions
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]);

        const allGranted = Object.values(results).every(
          r => r === PermissionsAndroid.RESULTS.GRANTED,
        );

        setStatus(allGranted ? 'granted' : 'denied');
        return allGranted;
      } else {
        // Android 6–11 — location required for Bluetooth Classic discovery
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setStatus(granted ? 'granted' : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied');
        return granted;
      }
    } catch {
      setStatus('denied');
      return false;
    }
  }, []);

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  return {status, requestPermissions};
}
