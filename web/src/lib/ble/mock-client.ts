import { BLE_CHARACTERISTIC_UUIDS } from './types';
import type { BleAdapter } from './adapter';
import type { BleDeviceInfo, DeviceIdentity, ProvisionStatus, WifiNetwork } from './types';

type Listener = (status: ProvisionStatus) => void;

export class MockBleClient implements BleAdapter {
  private readonly devices: BleDeviceInfo[];
  private connectedDeviceId: string | null = null;
  private statusHandler: Listener | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(devices: BleDeviceInfo[] = []) {
    this.devices = devices;
  }

  isSupported(): boolean {
    return true;
  }

  async scan(_filters?: { namePrefix?: string }[]): Promise<BleDeviceInfo[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return this.devices;
  }

  async connect(deviceId: string): Promise<void> {
    if (!this.devices.some((d) => d.id === deviceId)) {
      throw new Error(`Device not found: ${deviceId}`);
    }
    this.connectedDeviceId = deviceId;
  }

  async disconnect(): Promise<void> {
    this.cleanup();
  }

  async readDeviceInfo(): Promise<DeviceIdentity> {
    this.ensureConnected();
    const device = this.devices.find((d) => d.id === this.connectedDeviceId);
    if (!device || !device.device) {
      throw new Error('Device identity not available');
    }
    return {
      deviceType: device.device.deviceType,
      deviceId: device.device.deviceId,
      serialNumber: device.device.serialNumber,
      firmwareVersion: device.device.firmwareVersion,
      hardwareVersion: device.device.hardwareVersion,
      provisioningState: 'BLE_READY',
    };
  }

  async readWifiNetworks(): Promise<WifiNetwork[]> {
    this.ensureConnected();
    return [
      { ssid: 'Office-WiFi', rssi: -45, security: 'WPA2' },
      { ssid: 'Guest', rssi: -62, security: 'WPA2' },
      { ssid: 'Freq-Setup-A1B2', rssi: -30, security: 'WPA2' },
    ];
  }

  async writeWifiSsid(_ssid: string): Promise<void> {
    this.ensureConnected();
  }

  async writeWifiPassword(_password: string): Promise<void> {
    this.ensureConnected();
  }

  async sendProvisionCommand(_command: string): Promise<void> {
    this.ensureConnected();
    if (!this.statusHandler) return;

    this.statusHandler({ state: 'WIFI_CONNECTING', message: 'Connecting to Wi-Fi...', failureReason: null });

    this.timer = setInterval(() => {
      this.statusHandler?.({ state: 'WIFI_CONNECTED', message: 'Wi-Fi connected', failureReason: null });
      this.cleanup();
    }, 1500);
  }

  onStatusChange(handler: Listener): void {
    this.statusHandler = handler;
  }

  offStatusChange(handler: Listener): void {
    if (this.statusHandler === handler) {
      this.statusHandler = null;
    }
  }

  getConnectedDeviceId(): string | null {
    return this.connectedDeviceId;
  }

  private ensureConnected() {
    if (!this.connectedDeviceId) {
      throw new Error('No device connected');
    }
  }

  private cleanup() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.connectedDeviceId = null;
  }
}
