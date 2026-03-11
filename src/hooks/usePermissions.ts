import {useCallback, useEffect, useState} from 'react';
import {PermissionsAndroid, Platform} from 'react-native';
import {MOCK_MODE} from '../constants/obd.constants';

type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'blocked';

export function usePermissions() {
  const [status, setStatus] = useState<PermissionStatus>('unknown');

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (MOCK_MODE || Platform.OS !== 'android') {
      setStatus('granted');
      return true;
    }

    const apiLevel = Platform.Version as number;

    try {
      if (apiLevel >= 31) {
        // Android 12+ — use string literals, constants may be missing in some RN versions
        const results = await PermissionsAndroid.requestMultiple([
          'android.permission.BLUETOOTH_CONNECT' as any,
          'android.permission.BLUETOOTH_SCAN' as any,
        ]);

        const allGranted = Object.values(results).every(
          r => r === PermissionsAndroid.RESULTS.GRANTED,
        );

        setStatus(allGranted ? 'granted' : 'denied');
        return allGranted;
      } else {
        // Android 6–11 — location required for Bluetooth Classic
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location permission',
            message: 'Required to scan for Bluetooth devices on Android 11 and below.',
            buttonPositive: 'Allow',
          },
        );

        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          setStatus('blocked');
          return false;
        }
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setStatus(granted ? 'granted' : 'denied');
        return granted;
      }
    } catch (e) {
      console.warn('[usePermissions] error:', e);
      setStatus('denied');
      return false;
    }
  }, []);

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  return {status, requestPermissions};
}
