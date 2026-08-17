import { BLE_CHARACTERISTIC_UUIDS } from './types';
import type { BleAdapter } from './adapter';
import type {
  BleDeviceInfo,
  DeviceIdentity,
  ProvisionStatus,
  WebBleState,
  WifiNetwork,
} from './types';

export class ProvisioningService {
  private adapter: BleAdapter;
  private statusHandler: ((status: ProvisionStatus) => void) | null = null;
  private stateHandler: ((state: WebBleState) => void) | null = null;
  private currentState: WebBleState = 'IDLE';
  private connectedDeviceId: string | null = null;
  private wifiPassword: string = '';

  constructor(adapter: BleAdapter) {
    this.adapter = adapter;
  }

  isSupported(): boolean {
    return this.adapter.isSupported();
  }

  getState(): WebBleState {
    return this.currentState;
  }

  onStatusChange(handler: (status: ProvisionStatus) => void): () => void {
    this.statusHandler = handler;
    return () => { if (this.statusHandler === handler) this.statusHandler = null; };
  }

  onStateChange(handler: (state: WebBleState) => void): () => void {
    this.stateHandler = handler;
    return () => { if (this.stateHandler === handler) this.stateHandler = null; };
  }

  async scan(filters?: { namePrefix?: string }[]): Promise<BleDeviceInfo[]> {
    this.setState('SCANNING');
    try {
      const devices = await this.adapter.scan(filters);
      this.setState('IDLE');
      return devices;
    } catch (error) {
      this.setState('ERROR');
      throw error;
    }
  }

  async connect(deviceId: string): Promise<DeviceIdentity> {
    this.setState('CONNECTING');
    try {
      await this.adapter.connect(deviceId);
      this.connectedDeviceId = deviceId;
      this.adapter.onStatusChange(this.handleStatusChange.bind(this));
      this.setState('READING_DEVICE_INFO');
      const identity = await this.adapter.readDeviceInfo();
      this.setState('READY');
      return identity;
    } catch (error) {
      this.cleanup();
      this.setState('ERROR');
      throw error;
    }
  }

  async provision(ssid: string, password: string): Promise<void> {
    if (!this.connectedDeviceId) {
      throw new Error('No device connected');
    }

    this.wifiPassword = password;
    this.setState('CONFIGURING');

    try {
      await this.adapter.writeWifiSsid(ssid);
      await this.adapter.writeWifiPassword(password);
      this.setState('WIFI_CONNECTING');
      await this.adapter.sendProvisionCommand('PROVISION');
    } catch (error) {
      this.cleanup();
      this.setState('ERROR');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
    this.cleanup();
  }

  private handleStatusChange(status: ProvisionStatus): void {
    this.statusHandler?.(status);

    if (status.state === 'WIFI_CONNECTED') {
      this.cleanup();
      this.setState('SUCCESS');
    } else if (status.state === 'WIFI_FAILED') {
      this.cleanup();
      this.setState('WIFI_FAILED');
    } else if (status.state === 'ERROR') {
      this.cleanup();
      this.setState('ERROR');
    }
  }

  private setState(state: WebBleState): void {
    this.currentState = state;
    this.stateHandler?.(state);
  }

  private cleanup() {
    this.adapter.offStatusChange(this.handleStatusChange);
    this.connectedDeviceId = null;
    this.wifiPassword = '';
  }
}
