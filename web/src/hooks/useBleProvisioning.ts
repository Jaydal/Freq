'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MockBleClient } from '@/lib/ble/mock-client';
import { ProvisioningService } from '@/lib/ble/provisioning-service';
import { RealBleClient } from '@/lib/ble/real-client';
import type { BleAdapter } from '@/lib/ble/adapter';
import type { BleDeviceInfo, DeviceIdentity, ProvisionStatus, WebBleState, WifiNetwork } from '@/lib/ble/types';

const MOCK = process.env.NEXT_PUBLIC_BLE_MOCK === '1';

export function useBleProvisioning() {
  const [adapter] = useState<BleAdapter>(() => {
    if (MOCK) {
      return new MockBleClient([
        { id: 'LED-MOCK-001', name: 'Freq-LED-A1B2', device: { deviceType: 'LED_DISPLAY', provisioningState: 'BLE_READY', deviceId: 'LED-A1B2', serialNumber: 'ESP32-S3-A1B2', firmwareVersion: '1.0.0', hardwareVersion: '1.0' } },
        { id: 'KIOSK-MOCK-001', name: 'Freq-Kiosk-C3D4', device: { deviceType: 'KIOSK', provisioningState: 'BLE_READY', deviceId: 'KIOSK-C3D4', serialNumber: 'ESP32-S3-C3D4', firmwareVersion: '1.0.0', hardwareVersion: '1.0' } },
      ]);
    }
    return new RealBleClient();
  });

  const service = useMemo(() => new ProvisioningService(adapter), [adapter]);
  const [state, setState] = useState<WebBleState>('IDLE');
  const [devices, setDevices] = useState<BleDeviceInfo[]>([]);
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [lastStatus, setLastStatus] = useState<ProvisionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      service.disconnect();
    };
  }, [service]);

  useEffect(() => {
    const unsubState = service.onStateChange((s) => {
      if (mountedRef.current) setState(s);
    });
    const unsubStatus = service.onStatusChange((s) => {
      if (mountedRef.current) setLastStatus(s);
    });
    return () => {
      unsubState();
      unsubStatus();
    };
  }, [service]);

  const scan = useCallback(async () => {
    setError(null);
    setDevices([]);
    setIdentity(null);
    setNetworks([]);
    const results = await service.scan();
    if (mountedRef.current) setDevices(results);
  }, [service]);

  const connect = useCallback(
    async (deviceId: string) => {
      setError(null);
      try {
        const info = await service.connect(deviceId);
        if (mountedRef.current) setIdentity(info);
      } catch (e: any) {
        if (mountedRef.current) setError(e?.message ?? 'Connection failed');
        throw e;
      }
    },
    [service]
  );

  const loadNetworks = useCallback(async () => {
    try {
      const nets = await adapter.readWifiNetworks();
      if (mountedRef.current) setNetworks(nets);
    } catch (e: any) {
      if (mountedRef.current) setError(e?.message ?? 'Failed to scan Wi-Fi');
    }
  }, [adapter]);

  const provision = useCallback(
    async (ssid: string, password: string) => {
      setError(null);
      try {
        await service.provision(ssid, password);
      } catch (e: any) {
        if (mountedRef.current) setError(e?.message ?? 'Provisioning failed');
        throw e;
      }
    },
    [service]
  );

  const cancel = useCallback(async () => {
    await service.disconnect();
    if (mountedRef.current) {
      setState('IDLE');
      setIdentity(null);
      setNetworks([]);
      setLastStatus(null);
    }
  }, [service]);

  return {
    supported: adapter.isSupported(),
    state,
    devices,
    identity,
    networks,
    lastStatus,
    error,
    scan,
    connect,
    loadNetworks,
    provision,
    cancel,
  };
}
