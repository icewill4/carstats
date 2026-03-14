import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import {CANProtocol} from '../bluetooth/CANProtocol';
import {useBluetoothStore} from '../store/bluetoothStore';
import {useTheme} from '../theme';
import {getCANProtocol, getTransport} from '../hooks/useBluetooth';

type Props = NativeStackScreenProps<RootStackParamList, 'CANSniffer'>;

interface CANIdInfo {
  canId: string;
  lastData: number[];
  prevData: number[]; // previous frame data — for highlighting changes
  frameCount: number;
  firstSeen: number;
  lastSeen: number;
}

export function CANSnifferScreen({navigation}: Props) {
  const {colors} = useTheme();
  const connectionState = useBluetoothStore(s => s.connectionState);
  const [sniffing, setSniffing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canIds, setCanIds] = useState<Map<string, CANIdInfo>>(new Map());
  const protocolRef = useRef<CANProtocol | null>(null);
  const ownProtocolRef = useRef(false); // true if we created the protocol ourselves
  const canIdsRef = useRef<Map<string, CANIdInfo>>(new Map());
  const updateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Periodic UI refresh (updating state from ref every 500ms to avoid flooding)
  useEffect(() => {
    if (sniffing) {
      updateTimerRef.current = setInterval(() => {
        setCanIds(new Map(canIdsRef.current));
      }, 500);
    }
    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [sniffing]);

  const startSniffing = useCallback(async () => {
    setError(null);

    // Use existing CANProtocol if connected in CAN mode
    let proto = getCANProtocol();
    if (proto) {
      ownProtocolRef.current = false;
    } else {
      // Create a CAN protocol on-the-fly from the active transport
      const transport = getTransport();
      if (!transport) {
        setError('Not connected. Connect to your ELM327 adapter first.');
        return;
      }
      try {
        proto = new CANProtocol(transport);
        await proto.initialize();
        ownProtocolRef.current = true;
      } catch (err: any) {
        setError(`CAN init failed: ${err?.message ?? err}`);
        return;
      }
    }

    protocolRef.current = proto;
    canIdsRef.current.clear();
    setCanIds(new Map());
    setSniffing(true);

    await proto.startSniffing((canId, data) => {
      const existing = canIdsRef.current.get(canId);
      const now = Date.now();
      if (existing) {
        existing.prevData = existing.lastData;
        existing.lastData = data;
        existing.frameCount++;
        existing.lastSeen = now;
      } else {
        canIdsRef.current.set(canId, {
          canId,
          lastData: data,
          prevData: data,
          frameCount: 1,
          firstSeen: now,
          lastSeen: now,
        });
      }
    });
  }, []);

  const stopSniffing = useCallback(async () => {
    setSniffing(false);
    if (protocolRef.current) {
      await protocolRef.current.stopSniffing();
      protocolRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (protocolRef.current) {
        protocolRef.current.stopSniffing();
      }
    };
  }, []);

  // Sort by frame count (most active first)
  const sortedIds = Array.from(canIds.values()).sort(
    (a, b) => b.frameCount - a.frameCount,
  );

  const totalFrames = sortedIds.reduce((sum, id) => sum + id.frameCount, 0);

  const getHz = (info: CANIdInfo): string => {
    const elapsed = (info.lastSeen - info.firstSeen) / 1000;
    if (elapsed < 0.5) return '--';
    return (info.frameCount / elapsed).toFixed(1);
  };

  const bg = colors.background;
  const surface = colors.surface;
  const border = colors.border;

  const renderItem = ({item}: {item: CANIdInfo}) => (
    <View
      style={[
        styles.row,
        {backgroundColor: surface, borderBottomColor: border},
      ]}>
      <Text style={[styles.canId, {color: colors.speed}]}>{item.canId}</Text>
      <View style={styles.dataRow}>
        {item.lastData.map((b, i) => {
          const changed = item.prevData[i] !== undefined && item.prevData[i] !== b;
          return (
            <Text
              key={i}
              style={[
                styles.dataByte,
                {color: changed ? colors.warning : colors.text},
                changed && styles.dataByteChanged,
              ]}>
              {b.toString(16).toUpperCase().padStart(2, '0')}
            </Text>
          );
        })}
      </View>
      <Text style={[styles.count, {color: colors.textSecondary}]}>
        {item.frameCount}
      </Text>
      <Text style={[styles.hz, {color: colors.textSecondary}]}>
        {getHz(item)} Hz
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, {backgroundColor: bg}]}>
      <View style={[styles.header, {borderBottomColor: border}]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, {color: colors.speed}]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, {color: colors.text}]}>CAN Sniffer</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.controls}>
        {connectionState !== 'connected' ? (
          <Text style={[styles.status, {color: colors.warning}]}>
            Connect to your ELM327 adapter first
          </Text>
        ) : (
          <TouchableOpacity
            style={[
              styles.button,
              {backgroundColor: sniffing ? colors.warning : colors.speed},
            ]}
            onPress={sniffing ? stopSniffing : startSniffing}>
            <Text style={styles.buttonText}>
              {sniffing ? 'Stop Sniffing' : 'Start Sniffing'}
            </Text>
          </TouchableOpacity>
        )}
        {error && (
          <Text style={[styles.status, {color: colors.warning}]}>{error}</Text>
        )}
        <Text style={[styles.idCount, {color: colors.textSecondary}]}>
          {sortedIds.length} CAN IDs — {totalFrames} frames captured
        </Text>
      </View>

      {/* Column headers */}
      <View style={[styles.headerRow, {borderBottomColor: border}]}>
        <Text style={[styles.canIdHeader, {color: colors.textSecondary}]}>
          ID
        </Text>
        <Text style={[styles.dataHeader, {color: colors.textSecondary}]}>
          Data (hex)
        </Text>
        <Text style={[styles.countHeader, {color: colors.textSecondary}]}>
          Count
        </Text>
        <Text style={[styles.hzHeader, {color: colors.textSecondary}]}>
          Rate
        </Text>
      </View>

      <FlatList
        data={sortedIds}
        keyExtractor={item => item.canId}
        renderItem={renderItem}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {fontSize: 16, fontWeight: '600'},
  title: {fontSize: 18, fontWeight: '700'},
  headerSpacer: {width: 40},
  controls: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  status: {fontSize: 14, textAlign: 'center'},
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {color: '#FFF', fontSize: 16, fontWeight: '700'},
  idCount: {fontSize: 12},
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  canIdHeader: {width: 50, fontSize: 11, fontWeight: '600'},
  dataHeader: {flex: 1, fontSize: 11, fontWeight: '600'},
  countHeader: {width: 50, fontSize: 11, fontWeight: '600', textAlign: 'right'},
  hzHeader: {width: 60, fontSize: 11, fontWeight: '600', textAlign: 'right'},
  list: {flex: 1},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  canId: {width: 50, fontSize: 14, fontWeight: '700', fontFamily: 'monospace'},
  dataRow: {flex: 1, flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 4},
  dataByte: {fontSize: 12, fontFamily: 'monospace'},
  dataByteChanged: {fontWeight: '900' as const},
  count: {width: 50, fontSize: 12, textAlign: 'right'},
  hz: {width: 60, fontSize: 12, textAlign: 'right'},
});
