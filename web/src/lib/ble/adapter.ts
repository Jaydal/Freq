import type {
  BleDeviceInfo,
  DeviceIdentity,
  ProvisionStatus,
  WifiNetwork,
  BleCharacteristicUUID,
} from './types';

export interface BleAdapter {
  isSupported(): boolean;
  scan(filters?: { namePrefix?: string }[]): Promise<BleDeviceInfo[]>;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  readDeviceInfo(): Promise<DeviceIdentity>;
  readWifiNetworks(): Promise<WifiNetwork[]>;
  writeWifiSsid(ssid: string): Promise<void>;
  writeWifiPassword(password: string): Promise<void>;
  sendProvisionCommand(command: string): Promise<void>;
  onStatusChange(handler: (status: ProvisionStatus) => void): void;
  offStatusChange(handler: (status: ProvisionStatus) => void): void;
  getConnectedDeviceId(): string | null;
}
