'use client';

import { useEffect, useState } from 'react';
import { useBleProvisioning } from '@/hooks/useBleProvisioning';
import { BleConnectButton } from '@/components/ble/BleConnectButton';
import { DeviceInfoCard } from '@/components/ble/DeviceInfoCard';
import { WifiConfigForm } from '@/components/ble/WifiConfigForm';
import { ProvisioningStatus } from '@/components/ble/ProvisioningStatus';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export default function KiosksPage() {
  const ble = useBleProvisioning();
  const [selectedBleDevice, setSelectedBleDevice] = useState<string | null>(null);

  useEffect(() => {
    if (ble.state === 'SUCCESS') {
      toast.success('Kiosk provisioned successfully');
      setSelectedBleDevice(null);
    } else if (ble.state === 'WIFI_FAILED' || ble.state === 'ERROR') {
      toast.error(ble.lastStatus?.failureReason ?? 'Provisioning failed');
    }
  }, [ble.state, ble.lastStatus]);

  useEffect(() => {
    return () => {
      ble.cancel();
    };
  }, [ble]);

  const selectedDevice = ble.devices.find((d) => d.id === selectedBleDevice) ?? null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kiosk Terminals</h1>
      </div>

      <Card className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Provision Kiosk</h2>
          <p className="text-sm text-muted-foreground">
            Use Bluetooth to send Wi-Fi credentials to a new kiosk terminal.
          </p>
        </div>

        <ProvisioningStatus status={ble.lastStatus} state={ble.state} />

        {ble.error && <p className="text-sm text-red-400">{ble.error}</p>}

        {ble.state === 'IDLE' && (
          <BleConnectButton supported={ble.supported} scanning={false} onScan={ble.scan} />
        )}

        {ble.state === 'SCANNING' && (
          <p className="text-sm text-muted-foreground">Scanning for devices...</p>
        )}

        {ble.state === 'IDLE' && ble.devices.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {ble.devices.map((device) => (
              <DeviceInfoCard
                key={device.id}
                device={device}
                identity={device.id === selectedBleDevice ? ble.identity : null}
                onConnect={(id) => { setSelectedBleDevice(id); ble.connect(id); }}
                connecting={ble.state === 'CONNECTING'}
                onScanNetworks={ble.loadNetworks}
                networks={ble.networks}
                loadingNetworks={false}
              />
            ))}
          </div>
        )}

        {(ble.state === 'READY' || ble.state === 'CONFIGURING' || ble.state === 'WIFI_CONNECTING') && selectedDevice && (
          <WifiConfigForm
            networks={ble.networks}
            onSubmit={ble.provision}
            onCancel={ble.cancel}
            submitting={ble.state === 'CONFIGURING' || ble.state === 'WIFI_CONNECTING'}
          />
        )}

        {(ble.state === 'SUCCESS' || ble.state === 'WIFI_FAILED' || ble.state === 'ERROR') && (
          <Button onClick={() => setSelectedBleDevice(null)} variant="secondary">
            Close
          </Button>
        )}
      </Card>
    </div>
  );
}
