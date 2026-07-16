#pragma once
// W3: TODO — Refactor to use either String or std::string consistently to reduce heap fragmentation
#ifdef USE_HUB75  // compiled for both Wokwi simulation and production

#include "IDisplayDriver.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <vector>
#include <string>

struct DisplayPage {
  std::string text;
  std::string color;
  std::string effect;
  uint16_t durationSeconds;
};

class MqttDisplayClient {
public:
  explicit MqttDisplayClient(IDisplayDriver& driver);

  void begin(const char* ssid, const char* password,
             const char* broker,   uint16_t port,
             const char* courtId,  const char* mqttUser = nullptr, const char* mqttPass = nullptr);
  void update();

  bool wifiOk()   { return WiFi.status() == WL_CONNECTED; }
  bool mqttOk()   { return _mqtt.connected(); }
  bool isOnline() { return wifiOk() && mqttOk(); }

private:
  IDisplayDriver& _driver;
  WiFiClientSecure _wifi;
  PubSubClient    _mqtt;

  String   _ssid;
  String   _password;
  String   _broker;
  uint16_t      _port;
  String   _courtId;
  String   _mqttUser;
  String   _mqttPass;
  char          _displayTopic[80];
  char          _statusTopic[80];
  unsigned long _lastWifiReconnect;
  unsigned long _lastMqttReconnect;
  bool          _wasOnline;

  void connectWiFi();
  bool connectMqtt();
  void publishOnline();

  std::vector<DisplayPage> _playlist;
  size_t _currentPageIndex = 0;
  unsigned long _lastPageChangeTime = 0;

  static MqttDisplayClient* _instance;
  static void onMessage(char* topic, uint8_t* payload, unsigned int len);
  void        handleMessage(uint8_t* payload, unsigned int len);
};

#endif // USE_HUB75
