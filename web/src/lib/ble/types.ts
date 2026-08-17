export type DeviceType = 'LED_DISPLAY' | 'KIOSK';

export type ProvisioningState =
  | 'NOT_PROVISIONED'
  | 'BLE_READY'
  | 'BLE_CONNECTED'
  | 'RECEIVING_WIFI_CONFIG'
  | 'WIFI_CONNECTING'
  | 'WIFI_CONNECTED'
  | 'WIFI_FAILED'
  | 'PROVISIONED'
  | 'ERROR';

export type WebBleState =
  | 'IDLE'
  | 'SCANNING'
  | 'CONNECTING'
  | 'READING_DEVICE_INFO'
  | 'READY'
  | 'CONFIGURING'
  | 'WIFI_CONNECTING'
  | 'SUCCESS'
  | 'WIFI_FAILED'
  | 'DISCONNECTED'
  | 'ERROR';

export interface DeviceIdentity {
  deviceType: DeviceType;
  deviceId: string;
  serialNumber: string;
  firmwareVersion: string;
  hardwareVersion: string;
  provisioningState: ProvisioningState;
}

export interface WifiNetwork {
  ssid: string;
  rssi: number;
  security: 'WPA2' | 'WPA3' | 'WEP' | 'OPEN';
}

export interface ProvisionStatus {
  state: ProvisioningState;
  message: string;
  failureReason: string | null;
}

export interface BleDeviceInfo {
  id: string;
  name: string;
  device?: DeviceIdentity;
}

export const BLE_PROVISIONING_SERVICE_UUID = '0000fe00-0000-1000-8000-00805f9b34fb';

export const BLE_CHARACTERISTIC_UUIDS = {
  DEVICE_INFO: '0000fe01-0000-1000-8000-00805f9b34fb',
  WIFI_NETWORKS: '0000fe02-0000-1000-8000-00805f9b34fb',
  WIFI_SSID: '0000fe03-0000-1000-8000-00805f9b34fb',
  WIFI_PASSWORD: '0000fe04-0000-1000-8000-00805f9b34fb',
  PROVISION_COMMAND: '0000fe05-0000-1000-8000-00805f9b34fb',
  PROVISION_STATUS: '0000fe06-0000-1000-8000-00805f9b34fb',
} as const;

export type BleCharacteristicUUID = (typeof BLE_CHARACTERISTIC_UUIDS)[keyof typeof BLE_CHARACTERISTIC_UUIDS];
