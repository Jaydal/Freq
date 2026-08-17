'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BleDeviceInfo, DeviceIdentity, WifiNetwork } from '@/lib/ble/types';

interface DeviceInfoCardProps {
  device: BleDeviceInfo;
  identity: DeviceIdentity | null;
  onConnect: (deviceId: string) => void;
  connecting: boolean;
  onScanNetworks: () => void;
  networks: WifiNetwork[];
  loadingNetworks: boolean;
}

export function DeviceInfoCard({
  device,
  identity,
  onConnect,
  connecting,
  onScanNetworks,
  networks,
  loadingNetworks,
}: DeviceInfoCardProps) {
  const connected = !!identity;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{device.name}</h3>
          <p className="text-xs text-muted-foreground font-mono">{device.id}</p>
        </div>
        <Badge variant={connected ? 'default' : 'secondary'}>
          {connected ? 'Connected' : 'Discovered'}
        </Badge>
      </div>

      {identity && (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span className="font-medium">{identity.deviceType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Device ID</span>
            <span className="font-mono text-xs">{identity.deviceId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Firmware</span>
            <span className="font-mono text-xs">{identity.firmwareVersion}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">State</span>
            <span className="font-mono text-xs">{identity.provisioningState}</span>
          </div>
        </div>
      )}

      {!connected && (
        <Button onClick={() => onConnect(device.id)} disabled={connecting} className="w-full">
          {connecting ? 'Connecting...' : 'Connect'}
        </Button>
      )}

      {connected && (
        <div className="space-y-2">
          <Button onClick={onScanNetworks} disabled={loadingNetworks} variant="secondary" className="w-full">
            {loadingNetworks ? 'Scanning...' : 'Scan Wi-Fi Networks'}
          </Button>

          {networks.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Available networks:</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {networks.map((net) => (
                  <div key={net.ssid} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                    <span className="font-medium">{net.ssid}</span>
                    <span className="text-muted-foreground">{net.rssi} dBm</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
