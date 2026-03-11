# CarStats — Claude Instructions

## What this project is
React Native Android app (RN 0.84) that connects to an ELM327 OBD2 adapter via **Bluetooth Classic (SPP)** and displays live car stats. Phase 2 adds GPS.

## Stack
- **Framework**: React Native CLI (no Expo — blocked for Bluetooth Classic)
- **Bluetooth**: `react-native-bluetooth-classic` (SPP/RFCOMM)
- **State**: Zustand
- **Navigation**: React Navigation (native-stack + bottom-tabs)
- **UI / Gauges**: `react-native-svg` + `react-native-reanimated`
- **Theme**: React Context + `useColorScheme()`
- **Tests**: Jest

## Key rules
- Speed unit is **km/h** — never mph unless user explicitly asks
- Always keep `MOCK_MODE` flag in `src/constants/obd.constants.ts` — never hardcode mock logic elsewhere
- ELM327 is **serial** — never send multiple OBD PIDs in parallel, always await each response
- Polling floor is **300ms** — never go below, ELM327 clones overflow
- Buffer until `>` prompt — never split on newline for ELM327 responses
- Keep `IBluetoothTransport` interface clean — `OBDProtocol` must never import from concrete BT implementations

## Project structure
```
src/
  bluetooth/     BluetoothService.ts, OBDProtocol.ts, OBDPids.ts, MockBluetoothService.ts
  store/         bluetoothStore.ts, obdStore.ts
  hooks/         usePermissions.ts, useBluetooth.ts, useOBDPolling.ts
  screens/       DeviceScanScreen.tsx, HomeScreen.tsx, SettingsScreen.tsx
  components/    gauges/ (ArcGauge, Speedometer, RPMGauge, FuelGauge), ConnectionStatusBar.tsx
  navigation/    AppNavigator.tsx
  theme/         colors.ts, index.ts
  types/         obd.types.ts
  constants/     obd.constants.ts
```

## OBD PID reference
| PID | Bytes | Formula |
|-----|-------|---------|
| `010D` | 1 | `parseInt(bytes[2], 16)` → km/h |
| `010C` | 2 | `(A * 256 + B) / 4` → RPM |
| `012F` | 1 | `A / 2.55` → fuel % |

Error responses: `NO DATA`, `UNABLE TO CONNECT`, `BUS INIT: ERROR`, `?`

## Run commands
```bash
adb devices                      # verify phone is connected
npx react-native run-android     # build and launch on device
npx jest                         # run unit tests
```

## Git & GitHub
- Repo: https://github.com/icewill4/carstats
- `gh` is installed at `C:\Program Files\GitHub CLI\gh.exe`
- Use full path when running gh from bash: `"/c/Program Files/GitHub CLI/gh"`

## Current state
- Phase A complete: OBD core, Bluetooth, mock service, 21 unit tests passing
- Phase B complete: Animated gauges, DeviceScan/Home/Settings screens, dark+light theme

## Next — Phase 2 (GPS)
- Install `@react-native-community/geolocation`
- Extend `OBDReading` with `location: { lat, lon, gpsSpeed }`
- Add geolocation call inside `useOBDPolling` alongside PID polling
- `ACCESS_FINE_LOCATION` already declared in `AndroidManifest.xml`
- New tile on HomeScreen: GPS speed vs OBD speed
