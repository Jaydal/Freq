'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useBleProvisioning } from '@/hooks/useBleProvisioning';
import { BleConnectButton } from '@/components/ble/BleConnectButton';
import { DeviceInfoCard } from '@/components/ble/DeviceInfoCard';
import { WifiConfigForm } from '@/components/ble/WifiConfigForm';
import { ProvisioningStatus } from '@/components/ble/ProvisioningStatus';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface DisplayInfo {
  mac: string;
  ip: string;
  courtId: string;
  rssi: number;
  heap: number;
  overrideActive: boolean;
  lastSeen: number;
}

interface CourtOption {
  id: string;
  name: string;
}

export default function LedsPage() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMac, setSelectedMac] = useState<string | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideText, setOverrideText] = useState('');
  const [overrideColor, setOverrideColor] = useState('#FF0000');
  const [showBleFlow, setShowBleFlow] = useState(false);
  const [selectedBleDevice, setSelectedBleDevice] = useState<string | null>(null);

  const supabase = createClient();
  const ble = useBleProvisioning();

  const discover = useCallback(async () => {
    setLoading(true);
    try {
      const [discoverRes, courtsRes] = await Promise.all([
        fetch('/api/display/discover', { method: 'POST' }),
        supabase.from('courts').select('id, name').order('name'),
      ]);
      if (courtsRes.data) setCourts(courtsRes.data);
      if (discoverRes.ok) {
        const data = await discoverRes.json();
        setDisplays(data.displays ?? []);
      }
    } catch (e) {
      console.error('Discover failed', e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { discover(); }, [discover]);

  useEffect(() => {
    return () => {
      ble.cancel();
    };
  }, [ble]);

  useEffect(() => {
    if (ble.state === 'SUCCESS') {
      toast.success('Display provisioned successfully');
      setShowBleFlow(false);
      setSelectedBleDevice(null);
      setTimeout(discover, 2000);
    } else if (ble.state === 'WIFI_FAILED' || ble.state === 'ERROR') {
      toast.error(ble.lastStatus?.failureReason ?? 'Provisioning failed');
    }
  }, [ble.state, ble.lastStatus, discover]);

  async function handleCourtChange(mac: string, courtId: string) {
    const court = courts.find(c => c.id === courtId);
    if (!confirm(`Reassign display ${mac} to "${court?.name ?? courtId}"? Display will reboot.`)) return;
    await fetch('/api/display/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, action: 'SET_COURT_ID', courtId }),
    });
    setTimeout(discover, 3000);
  }

  async function handleSendOverride() {
    if (!selectedMac) return;
    await fetch('/api/display/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mac: selectedMac,
        action: 'OVERRIDE',
        blocks: [{
          startEpoch: Math.floor(Date.now() / 1000),
          endEpoch: 2147483647,
          pages: [{
            durationSeconds: 10,
            zones: [{
              panelStart: 0,
              panelEnd: 2,
              lines: [{ text: overrideText, color: overrideColor, effect: 'SCROLL' }],
            }],
          }],
        }],
      }),
    });
    setShowOverrideModal(false);
    setTimeout(discover, 2000);
  }

  async function handleClearOverride(mac: string) {
    await fetch('/api/display/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, action: 'CLEAR_OVERRIDE' }),
    });
    setTimeout(discover, 2000);
  }

  const selectedDevice = ble.devices.find((d) => d.id === selectedBleDevice) ?? null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">LED Displays</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowBleFlow((v) => !v)} variant="secondary">
            {showBleFlow ? 'Hide Bluetooth' : 'Provision via Bluetooth'}
          </Button>
          <button
            onClick={discover}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            disabled={loading}
          >
            {loading ? 'Discovering...' : 'Refresh'}
          </button>
        </div>
      </div>

      {showBleFlow && (
        <Card className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Provision New Display</h2>
            <p className="text-sm text-muted-foreground">
              Use Bluetooth to send Wi-Fi credentials to a new or unconfigured display.
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
            <Button onClick={() => { setShowBleFlow(false); setSelectedBleDevice(null); }} variant="secondary">
              Close
            </Button>
          )}
        </Card>
      )}

      {displays.length === 0 && !loading && (
        <p className="text-muted-foreground">No displays found. Make sure displays are online and connected to MQTT, then click Refresh.</p>
      )}

      {displays.length > 0 && (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              <th className="p-2">MAC</th>
              <th className="p-2">IP</th>
              <th className="p-2">Court</th>
              <th className="p-2">RSSI</th>
              <th className="p-2">Override</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displays.map(d => (
              <tr key={d.mac} className="border-b">
                <td className="p-2 font-mono text-sm">{d.mac}</td>
                <td className="p-2 font-mono text-sm">{d.ip}</td>
                <td className="p-2">
                  <select
                    value={d.courtId}
                    onChange={e => handleCourtChange(d.mac, e.target.value)}
                    className="text-sm border rounded px-2 py-1 bg-background"
                  >
                    <option value="">— Select —</option>
                    {courts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2 text-sm">{d.rssi} dBm</td>
                <td className="p-2 text-sm">{d.overrideActive ? 'Active' : '—'}</td>
                <td className="p-2 flex gap-2">
                  <button
                    onClick={() => { setSelectedMac(d.mac); setOverrideText(''); setOverrideColor('#FF0000'); setShowOverrideModal(true); }}
                    className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 cursor-pointer"
                  >
                    Override
                  </button>
                  {d.overrideActive && (
                    <button
                      onClick={() => handleClearOverride(d.mac)}
                      className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-xl w-[500px] space-y-4">
            <h2 className="text-xl font-bold">Override Display</h2>
            <p className="text-sm text-muted-foreground font-mono">{selectedMac}</p>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <input
                value={overrideText}
                onChange={e => setOverrideText(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm bg-background"
                placeholder="Enter override text..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Color</label>
              <input
                type="color"
                value={overrideColor}
                onChange={e => setOverrideColor(e.target.value)}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 border rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendOverride}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 cursor-pointer"
              >
                Send Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
