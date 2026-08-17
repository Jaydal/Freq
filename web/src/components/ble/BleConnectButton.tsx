'use client';

import { Button } from '@/components/ui/button';

interface BleConnectButtonProps {
  supported: boolean;
  scanning: boolean;
  onScan: () => void;
}

export function BleConnectButton({ supported, scanning, onScan }: BleConnectButtonProps) {
  if (!supported) {
    return (
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
        Bluetooth provisioning is not available in this browser. Use AP mode or touchscreen setup instead.
      </div>
    );
  }

  return (
    <Button onClick={onScan} disabled={scanning} className="w-full">
      {scanning ? 'Scanning...' : 'Connect via Bluetooth'}
    </Button>
  );
}
