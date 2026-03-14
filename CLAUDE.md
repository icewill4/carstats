# CarStats — Claude Instructions

## What this project is
React Native Android app (RN 0.84) that connects to an ELM327 OBD2 adapter via Bluetooth (BLE or Classic SPP) and displays live car stats. Supports both standard OBD2 polling and direct CAN bus monitoring.

## Stack
- **Framework**: React Native CLI (no Expo — blocked for Bluetooth Classic)
- **Bluetooth Classic**: `react-native-bluetooth-classic` (SPP/RFCOMM)
- **Bluetooth BLE**: `react-native-ble-plx`
- **State**: Zustand
- **Navigation**: React Navigation (native-stack + bottom-tabs)
- **UI / Gauges**: `react-native-svg` + `react-native-reanimated`
- **Theme**: React Context + `useColorScheme()`
- **Tests**: Jest

## Key rules
- Speed unit is **km/h** — never mph unless user explicitly asks
- Always keep `MOCK_MODE` flag in `src/constants/obd.constants.ts` — never hardcode mock logic elsewhere
- ELM327 is **serial** — never send multiple OBD PIDs in parallel, always await each response
- Polling floor is **300ms** — never go below, ELM327 clones overflow (OBD2 mode only)
- Buffer until `>` prompt — never split on newline for ELM327 responses (OBD2 mode)
- CAN mode uses `AT MA` (monitor all) — cheap clones exit after a few frames, so auto-restart
- Keep `IBluetoothTransport` interface clean — protocol classes must never import from concrete BT implementations
- `connectionMode` lives in `settingsStore` — read via `useSettingsStore.getState().connectionMode` in non-React code
- `protocolMode` (`obd2` | `can`) lives in `settingsStore` — determines which protocol is initialized on connect

## Project structure
```
src/
  bluetooth/     BluetoothService.ts, BLEService.ts, OBDProtocol.ts, OBDPids.ts,
                 CANProtocol.ts, CANPids.ts, elm327.ts, MockBluetoothService.ts
  store/         bluetoothStore.ts, obdStore.ts, settingsStore.ts
  hooks/         usePermissions.ts, useBluetooth.ts, useOBDPolling.ts
  screens/       DeviceScanScreen.tsx, HomeScreen.tsx, SettingsScreen.tsx, CANSnifferScreen.tsx
  components/    gauges/ (ArcGauge, Speedometer, RPMGauge, FuelGauge, ConsumptionGauge),
                 ConnectionStatusBar.tsx, TripSummaryBar.tsx
  navigation/    AppNavigator.tsx
  theme/         colors.ts, index.tsx
  types/         obd.types.ts
  constants/     obd.constants.ts
```

## Bluetooth architecture
```
IBluetoothTransport
    ├── RNBTTransport       ← Bluetooth Classic (react-native-bluetooth-classic)
    ├── BLETransport        ← BLE (react-native-ble-plx, inside BLEService.ts)
    └── MockBluetoothTransport
```
- `BluetoothService` is the single entry point — delegates to BLE or Classic based on `settingsStore.connectionMode`
- `BLEService` auto-discovers GATT write+notify characteristics (no UUID hardcoding)
- BLE transport buffers incoming notifications; `read()` drains the buffer — keeps protocols unchanged
- Classic transport: `availableFromDevice()` + `readFromDevice()` with `delimiter:'>'` set on connect

## Protocol architecture
```
                  ┌── OBDProtocol  ← request-response PID polling (OBD2 mode)
IBluetoothTransport
                  └── CANProtocol  ← AT MA streaming with auto-restart (CAN mode)
```
- `elm327.ts` — shared `sendATCommand()` used by both protocols for AT init
- `OBDProtocol` — polls PIDs one at a time, returns `OBDReading`
- `CANProtocol` — streams CAN frames via `AT MA`, parses with car-specific profile, pushes readings via callback
- `CANPids.ts` — car profiles mapping CAN IDs → signals (speed, RPM, etc.)
- `useOBDPolling` handles both: interval-based for OBD2, callback-based for CAN

## CAN bus (Citroën C1 II confirmed)
| CAN ID | Signal | Bytes | Formula |
|--------|--------|-------|---------|
| `0B4` | Speed | 5-6 (BE16) | `(b[5] << 8 \| b[6]) * 0.01` → km/h |
| `1C4` | RPM | 0-1 (BE16) | `(b[0] << 8 \| b[1])` → rpm |
| `025` | Steering angle | — | confirmed changing, not yet decoded |

CAN IDs still to investigate: `2C1` (throttle), `398` (fuel consumption), `3B3` (coolant temp)

## OBD2 PID reference
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
- BLE + Classic dual-mode support — user has a BLE 5.0 ELM327 adapter (cheap clone)
- CAN bus direct mode added — sniffer with byte-change highlighting, Citroën C1 II profile
- Demo mode button on DeviceScanScreen (mock data without Bluetooth)
- StatusBar translucent with proper Android offset
- Trip tracking (distance, fuel used, avg consumption) for CAN mode
- OBD2/CAN toggle in Settings, CAN sniffer accessible from Settings

## Known build gotchas (already fixed)
- Gradle must stay at **8.14.x** — Gradle 9 removed `IBM_SEMERU` field used by react-native-bluetooth-classic
- `react-native-reanimated` v4 requires `react-native-worklets` as a separate package
- Theme file is `src/theme/index.tsx` (not `.ts`) — JSX requires `.tsx`
- SVG worklet functions need `'worklet'` directive: `polarToCartesian`, `arcPath` in `ArcGauge.tsx`
- `usePermissions` skips BT permission dialog when `MOCK_MODE=true`
- Classic transport: use `availableFromDevice()` not `available()` — the latter doesn't exist
- Classic transport: set `delimiter:'>'` on `connectToDevice` — ELM327 never appends `\n` after `>`; re-append `>` in JS after read since native layer consumes the delimiter
- CAN mode: drain transport buffer before `AT MA` and use grace period for stray `>` prompts
- CAN mode: auto-restart `AT MA` when cheap clones exit monitor mode after a few frames

## Next steps
- Verify CAN speed/RPM formulas against real dashboard readings
- Investigate more CAN IDs: `2C1` (throttle), `398` (fuel consumption), `3B3` (coolant)
- Phase 2 (GPS): `@react-native-community/geolocation`, GPS speed vs OBD speed tile
