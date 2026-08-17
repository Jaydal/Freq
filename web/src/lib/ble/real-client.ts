import { BLE_PROVISIONING_SERVICE_UUID, BLE_CHARACTERISTIC_UUIDS } from './types';
import type { BleAdapter } from './adapter';
import type { BleDeviceInfo, DeviceIdentity, ProvisionStatus, WifiNetwork } from './types';

function decodeJson<T>(value: DataView): T {
  const decoder = new TextDecoder('utf-8');
  return JSON.parse(decoder.decode(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))) as T;
}

function encodeJson(value: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(JSON.stringify(value));
}

export class RealBleClient implements BleAdapter {
  private device: any | null = null;
  private server: any | null = null;
  private service: any | null = null;
  private statusHandler: ((status: ProvisionStatus) => void) | null = null;
  private statusChar: any | null = null;
  private connectedDeviceId: string | null = null;
  private scannedDevice: any | null = null;

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  async scan(filters?: { namePrefix?: string }[]): Promise<BleDeviceInfo[]> {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser');
    }

    const device = await (navigator as any).bluetooth.requestDevice({
      filters: filters?.length ? filters : [{ namePrefix: 'Freq-' }],
      optionalServices: [BLE_PROVISIONING_SERVICE_UUID],
    });

    this.scannedDevice = device;
    const id = device.id || device.name || 'unknown';
    const name = device.name || 'Unknown Device';

    return [{ id, name }];
  }

  async connect(deviceId: string): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported');
    }

    if (!this.scannedDevice) {
      throw new Error('No device scanned. Call scan() first.');
    }

    if (this.device && this.connectedDeviceId === deviceId && this.server?.connected) {
      return;
    }

    this.device = this.scannedDevice;
    this.scannedDevice = null;

    this.device.addEventListener('gattserverdisconnected', () => {
      this.cleanup();
    });

    if (!this.device.gatt) {
      throw new Error('Device GATT not available');
    }

    this.server = await this.device.gatt.connect();
    this.service = await this.server.getPrimaryService(BLE_PROVISIONING_SERVICE_UUID);

    this.statusChar = await this.service.getCharacteristic(BLE_CHARACTERISTIC_UUIDS.PROVISION_STATUS);
    if (!this.statusChar) {
      throw new Error('Provision status characteristic not found');
    }
    await this.statusChar.startNotifications();
    this.statusChar.addEventListener('characteristicvaluechanged', (event: Event) => {
      const target = event.target as any;
      const status = decodeJson<ProvisionStatus>(target.value!);
      this.statusHandler?.(status);
    });

    this.connectedDeviceId = deviceId;
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.cleanup();
  }

  async readDeviceInfo(): Promise<DeviceIdentity> {
    if (!this.service) throw new Error('Not connected');
    const char = await this.service.getCharacteristic(BLE_CHARACTERISTIC_UUIDS.DEVICE_INFO);
    const value = await char.readValue();
    return decodeJson<DeviceIdentity>(value);
  }

  async readWifiNetworks(): Promise<WifiNetwork[]> {
    if (!this.service) throw new Error('Not connected');
    const char = await this.service.getCharacteristic(BLE_CHARACTERISTIC_UUIDS.WIFI_NETWORKS);
    const value = await char.readValue();
    const data = decodeJson<{ networks: WifiNetwork[] }>(value);
    return data.networks;
  }

  async writeWifiSsid(ssid: string): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    const char = await this.service.getCharacteristic(BLE_CHARACTERISTIC_UUIDS.WIFI_SSID);
    await char.writeValue(encodeJson(ssid));
  }

  async writeWifiPassword(password: string): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    const char = await this.service.getCharacteristic(BLE_CHARACTERISTIC_UUIDS.WIFI_PASSWORD);
    await char.writeValue(encodeJson(password));
  }

  async sendProvisionCommand(command: string): Promise<void> {
    if (!this.service) throw new Error('Not connected');
    const char = await this.service.getCharacteristic(BLE_CHARACTERISTIC_UUIDS.PROVISION_COMMAND);
    await char.writeValue(encodeJson({ command }));
  }

  onStatusChange(handler: (status: ProvisionStatus) => void): void {
    this.statusHandler = handler;
  }

  offStatusChange(handler: (status: ProvisionStatus) => void): void {
    if (this.statusHandler === handler) {
      this.statusHandler = null;
    }
  }

  getConnectedDeviceId(): string | null {
    return this.connectedDeviceId;
  }

  private cleanup() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.statusChar = null;
    this.connectedDeviceId = null;
  }
}
