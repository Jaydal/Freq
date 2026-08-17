'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WifiNetwork } from '@/lib/ble/types';

interface WifiConfigFormProps {
  networks: WifiNetwork[];
  onSubmit: (ssid: string, password: string) => void;
  onCancel: () => void;
  submitting: boolean;
}

export function WifiConfigForm({ networks, onSubmit, onCancel, submitting }: WifiConfigFormProps) {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssid.trim()) return;
    onSubmit(ssid.trim(), password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ssid">Wi-Fi Network</Label>
        {networks.length > 0 ? (
          <Select value={ssid} onValueChange={(val) => setSsid(val || '')}>
            <SelectTrigger>
              <SelectValue placeholder="Select a network" />
            </SelectTrigger>
            <SelectContent>
              {networks.map((net) => (
                <SelectItem key={net.ssid} value={net.ssid}>
                  {net.ssid} ({net.rssi} dBm)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="ssid"
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            placeholder="Enter Wi-Fi SSID"
            required
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter Wi-Fi password"
          required
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || !ssid.trim()} className="flex-1">
          {submitting ? 'Provisioning...' : 'Configure Wi-Fi'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
