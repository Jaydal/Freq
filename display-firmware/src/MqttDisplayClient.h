#pragma once
#ifdef USE_HUB75

#include "IDisplayDriver.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <vector>
#include <string>

struct SubPage {
  std::string text;
  std::string color;
  std::string bgColor;
  std::string effect;
  std::string align;
  float scrollSpeed;
  uint16_t durationMs;
};

struct ZoneLine {
  std::vector<SubPage> subpages;
  uint8_t marginTop;
  uint8_t marginBottom;
};

struct DisplayZone {
  uint8_t panelStart;
  uint8_t panelEnd;
  ZoneLine lines[2];
  uint8_t lineCount;
  uint8_t borderCount;
  uint8_t scale;
  std::string valign;
  BorderRange borderRanges[4];
};

struct DisplayPage {
  DisplayZone zones[3];
  uint8_t zoneCount;
  uint16_t durationSeconds;
};

typedef void (*CourtChangeCallback)(const char* newCourtId);

class MqttDisplayClient {
public:
  explicit MqttDisplayClient(IDisplayDriver& driver);

  void begin(const char* ssid, const char* password,
             const char* broker,   uint16_t port,
             const char* courtId,  const char* mqttUser = nullptr, const char* mqttPass = nullptr);
  void update();
  void setCourtChangeCallback(CourtChangeCallback cb) { _courtChangeCb = cb; }

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
  unsigned long _lastWifiReconnect = 0;
  unsigned long _lastMqttReconnect = 0;
  unsigned long _lastHeartbeat = 0;
  bool          _wasOnline = false;
  CourtChangeCallback _courtChangeCb = nullptr;
  String   _mac;
  char          _cmdTopic[50];
  bool          _overrideActive = false;
  std::vector<DisplayPage> _overridePages;
  size_t _overridePageIndex = 0;
  unsigned long _overridePageChangeTime = 0;
  String   _lastTopic;

  void connectWiFi();
  bool connectMqtt();
  void publishOnline();

  std::vector<DisplayPage> _playlist;
  size_t _currentPageIndex = 0;
  unsigned long _lastPageChangeTime = 0;
  uint8_t _subpageIdx[3][2];
  unsigned long _lastSubChange[3][2];

  void applyCurrentPage();
  void handleDiscover();
  void handleCmdMessage(uint8_t* payload, unsigned int len);
  String buildStatusPayload();

  static MqttDisplayClient* _instance;
  static void onMessage(char* topic, uint8_t* payload, unsigned int len);
  void        handleMessage(uint8_t* payload, unsigned int len);
};

#endif // USE_HUB75
