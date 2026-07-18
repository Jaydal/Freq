#ifdef USE_HUB75  // compiled for both Wokwi simulation and production
#include "MqttDisplayClient.h"
#include <ArduinoJson.h>

// W9: This singleton pattern is safe in the single-threaded Arduino model where callbacks
// fire from _mqtt.loop() in the main task. If migrated to FreeRTOS tasks, a mutex is required.
MqttDisplayClient* MqttDisplayClient::_instance = nullptr;

static bool parseHexColor(const std::string& hex, uint8_t& r, uint8_t& g, uint8_t& b) {
  if (hex.length() == 7 && hex[0] == '#') {
    long rgb = strtol(hex.c_str() + 1, NULL, 16);
    r = (rgb >> 16) & 0xFF;
    g = (rgb >> 8) & 0xFF;
    b = rgb & 0xFF;
    return true;
  }
  return false;
}

MqttDisplayClient::MqttDisplayClient(IDisplayDriver& driver)
  : _driver(driver), _mqtt(_wifi),
    _lastWifiReconnect(0), _lastMqttReconnect(0), _wasOnline(false)
{}

// ── Public ────────────────────────────────────────────────────────────────────

void MqttDisplayClient::begin(const char* ssid, const char* password,
                               const char* broker, uint16_t port,
                               const char* courtId, const char* mqttUser, const char* mqttPass) {
  _ssid = ssid; _password = password;
  _broker = broker; _port = port; _courtId = courtId;
  _mqttUser = mqttUser ? mqttUser : "";
  _mqttPass = mqttPass ? mqttPass : "";
  _instance = this;
  
  const char* ca_cert = 
"-----BEGIN CERTIFICATE-----\n"
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n"
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n"
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n"
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n"
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n"
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\n"
"h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n"
"0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\n"
"A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW\n"
"T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH\n"
"B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC\n"
"B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv\n"
"KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn\n"
"OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn\n"
"jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw\n"
"qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI\n"
"rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV\n"
"HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq\n"
"hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL\n"
"ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ\n"
"3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK\n"
"NFtY2PwByVS5uCbMiogZiUvsY0lfKafkbNYISfI3YFkYctRG6sMnLnBI86FYWi7l\n"
"cAcid2aBGi0zPsETAt4M+FkGHOlluMBMxfGIhjDFSeVIOXGY4EC+jGnbFO4xsrBE\n"
"lNxCMcPJ0UVBMmJG0BACBfNv/eHH/K6P0xoAbd7chgiHMwEQi6Y1k5sCP8yB2BOf\n"
"xQ3yYFfAdBV/cRKc0eajEGJ9eJNA3c0Sr/7kTl5GmqYQ55yzrp80oqGBmzQkQPB6\n"
"LcSG7T0v6fQ7m4Y2spE/ctkO07cSGMqqe8qfPPlF7Jvjaw3kEP0I1YXKuJPmCyq5\n"
"K/VJJwUHG47SkBkvIeWUqXTIy1Yxt/GhL+JDVTjDGp7UxHKWaRqnu/+F4vLjEFa0\n"
"cXnGpkXd9qD1Ovy3QCNWNsQiRYB9laW0n8Z8u5tH0gto7KW3cXr78GXBDSJ8JLTn\n"
"PsJNvPkVZFGq1bU/K+2hXIi/SheXvwsSTn8YGCGhO0Lr1NMstej3E0mcIGQ=\n"
"-----END CERTIFICATE-----\n";
  _wifi.setCACert(ca_cert);

  snprintf(_displayTopic, sizeof(_displayTopic), "courts/%s/display", courtId);
  snprintf(_statusTopic,  sizeof(_statusTopic),  "freq.led/courts/%s/status",  courtId);
  log_i("[health] Will publish status to: %s", _statusTopic);

  _mqtt.setServer(broker, port);
  _mqtt.setCallback(onMessage);
  _mqtt.setBufferSize(4096);
  _playlist.reserve(8);

  connectWiFi();
  connectMqtt();
}

void MqttDisplayClient::update() {
  bool online = isOnline();

  if (!online && _wasOnline) {
    log_i("[health] Connection lost");
    String msg = wifiOk() ? "MQTT LOST - RETRYING..." : "WIFI LOST - RETRYING...";
    _driver.showRow(0, msg.c_str());
    _driver.update();
  }
  _wasOnline = online;

  if (!wifiOk()) {
    unsigned long now = millis();
    if (now - _lastWifiReconnect > 30000) {
      _lastWifiReconnect = now;
      log_i("[health] WiFi reconnect attempt");
      WiFi.reconnect();
    }
    _driver.update();
    return;
  }

  if (!mqttOk()) {
    unsigned long now = millis();
    if (now - _lastMqttReconnect > 5000) {
      _lastMqttReconnect = now;
      log_i("[health] MQTT reconnect attempt");
      if (connectMqtt()) publishOnline();
    }
  }

  _mqtt.loop();

  if (!_playlist.empty() && _wasOnline) {
    unsigned long now = millis();
    unsigned long durationMs = (unsigned long)_playlist[_currentPageIndex].durationSeconds * 1000;
    if (durationMs == 0) durationMs = 10000;

    if (now - _lastPageChangeTime >= durationMs) {
      _lastPageChangeTime = now;
      _currentPageIndex = (_currentPageIndex + 1) % _playlist.size();
      
      const auto& page = _playlist[_currentPageIndex];
      _driver.showRow(0, page.text.c_str());
      
      uint8_t r, g, b;
      if (parseHexColor(page.color, r, g, b)) {
        _driver.setColorRGB(r, g, b);
      }
      _driver.setAnimationMode(page.effect.c_str());
    }
  }

  _driver.update();
}

// ── Private ───────────────────────────────────────────────────────────────────
void MqttDisplayClient::connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    log_i("[health] WiFi already connected. IP=%s  RSSI=%d dBm",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return;
  }

  log_i("[health] Connecting WiFi: %s", _ssid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(_ssid.c_str(), _password.c_str());
  unsigned long start = millis();
  unsigned long lastUpdate = 0;
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    if (millis() - lastUpdate >= 500) {
      _driver.update();
      lastUpdate = millis();
    }
    // W4: ESP32 core feeds the Task WDT during yield()
    yield();
  }

  if (WiFi.status() == WL_CONNECTED) {
    log_i("[health] WiFi OK");
  } else {
    log_i("[health] WiFi FAILED");
    String msg = "WIFI FAILED - ";
#ifdef WOKWI_SIMULATION
    msg += "CHECK BROKER IP";
#else
    msg += "CHECK SSID & PASS";
#endif
    _driver.showRow(0, msg.c_str());
    _driver.update();
  }
}

bool MqttDisplayClient::connectMqtt() {
  if (_mqtt.connected()) return true;

  log_i("[health] Connecting MQTT...");
  String clientId = "freq-led-" + String(ESP.getEfuseMac(), HEX);

  if (_mqtt.connect(clientId.c_str(), _mqttUser.c_str(), _mqttPass.c_str(),
                    _statusTopic, 1, /*retain=*/true, "{\"status\":\"offline\"}")) {
    log_i("[health] MQTT OK");
    _mqtt.subscribe(_displayTopic, 1);
    publishOnline();
    _driver.showRow(0, "READY - WAITING FOR QUEUE...");
    _driver.update();
    return true;
  }

  log_i("[health] MQTT FAILED");
  _driver.showRow(0, "MQTT FAILED - RETRYING...");
  _driver.update();
  return false;
}

void MqttDisplayClient::publishOnline() {
  char payload[192];
  snprintf(payload, sizeof(payload), 
           "{\"status\":\"online\",\"ip\":\"%s\",\"rssi\":%d,\"court\":\"%s\",\"sim\":false}",
           WiFi.localIP().toString().c_str(), WiFi.RSSI(), _courtId.c_str());
           
  log_i("[mqtt] Publishing online status");
  _mqtt.publish(_statusTopic, (uint8_t*)payload, strlen(payload), /*retain=*/true);
}

// ── Static MQTT callback ──────────────────────────────────────────────────────

void MqttDisplayClient::onMessage(char* topic, byte* payload, unsigned int length) {
  log_i("[mqtt] Received topic: %s", topic);
  if (_instance) _instance->handleMessage(payload, length);
}

void MqttDisplayClient::handleMessage(uint8_t* payload, unsigned int len) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, payload, len);
  if (error) {
    log_i("[mqtt] JSON parse failed: %s", error.c_str());
    return;
  }

  _playlist.clear();

  if (doc["brightness"].is<uint8_t>()) {
    _driver.setBrightness(doc["brightness"].as<uint8_t>());
  }
  if (doc["scroll_speed"].is<uint16_t>()) {
    _driver.setScrollSpeed(doc["scroll_speed"].as<uint16_t>());
  }

  JsonArray pages = doc["display"]["pages"];
  if (pages.isNull()) {
    const char* msg = doc["message"] | "";
    if (strlen(msg) == 0 && doc["line1"].is<const char*>()) {
      msg = doc["line1"] | "";
    }
    if (strlen(msg) > 0) {
      DisplayPage p;
      p.text = msg;
      p.color = doc["color"] | "#FFFFFF";
      p.effect = doc["animation"] | "SCROLL";
      p.durationSeconds = 10;
      _playlist.push_back(p);
    }
  } else {
    for (JsonObject page : pages) {
      DisplayPage p;
      p.text = page["text"] | "";
      p.color = page["color"] | "#FFFFFF";
      p.effect = page["effect"] | "SCROLL";
      p.durationSeconds = page["durationSeconds"] | 10;
      _playlist.push_back(p);
    }
  }

  // Parse schedule data for live {timer} countdown substitution
  JsonObject currentSchedule = doc["schedule"]["current"];
  if (!currentSchedule.isNull()) {
    long startTimeEpoch = currentSchedule["startTimeEpoch"] | 0;
    long durationMinutes = currentSchedule["durationMinutes"] | 0;
    long prepTimeSec = currentSchedule["prepTimeSec"] | 0;
    long serverTime = doc["serverTime"] | 0;
    if (startTimeEpoch > 0 && serverTime > 0) {
      long endTimeEpoch = startTimeEpoch + prepTimeSec + durationMinutes * 60;
      long remainingSec = endTimeEpoch - serverTime;
      if (remainingSec < 0) remainingSec = 0;
      unsigned long remainingMs = (unsigned long)remainingSec * 1000;
      unsigned long totalMs = ((unsigned long)durationMinutes * 60 + (unsigned long)prepTimeSec) * 1000;
      _driver.setTimer(remainingMs, totalMs, millis());
    }
  }

  _currentPageIndex = 0;
  _lastPageChangeTime = millis();

  if (!_playlist.empty()) {
    const auto& page = _playlist[0];
    log_i("[display] MSG: %s", page.text.c_str());
    _driver.showRow(0, page.text.c_str());
    uint8_t r, g, b;
    if (parseHexColor(page.color, r, g, b)) {
      _driver.setColorRGB(r, g, b);
    }
    _driver.setAnimationMode(page.effect.c_str());
  } else {
    _driver.showRow(0, "");
  }

  _driver.update();
}

#endif // USE_HUB75