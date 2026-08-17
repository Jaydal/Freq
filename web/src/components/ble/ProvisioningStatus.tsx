'use client';

import { Card } from '@/components/ui/card';

interface ProvisioningStatusProps {
  status: import('@/lib/ble/types').ProvisionStatus | null;
  state: import('@/lib/ble/types').WebBleState;
}

export function ProvisioningStatus({ status, state }: ProvisioningStatusProps) {
  if (state === 'IDLE' || state === 'READY' || state === 'SUCCESS') {
    return null;
  }

  const isError = state === 'ERROR' || state === 'WIFI_FAILED';
  const isConnecting = state === 'WIFI_CONNECTING' || state === 'CONFIGURING';

  return (
    <Card className={`p-4 ${isError ? 'border-red-500/50 bg-red-500/10' : isConnecting ? 'border-blue-500/50 bg-blue-500/10' : ''}`}>
      <div className="flex items-center gap-3">
        {isConnecting && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        )}
        {isError && (
          <div className="h-4 w-4 rounded-full bg-red-500" />
        )}
        <div>
          <p className="text-sm font-medium">
            {isError ? 'Provisioning failed' : isConnecting ? 'Provisioning...' : state}
          </p>
          {status?.message && <p className="text-xs text-muted-foreground">{status.message}</p>}
          {status?.failureReason && <p className="text-xs text-red-400">{status.failureReason}</p>}
        </div>
      </div>
    </Card>
  );
}
