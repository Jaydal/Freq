#ifdef USE_HUB75
#include "MqttDisplayClient.h"
#include <ArduinoJson.h>

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
    _lastWifiReconnect(0), _lastMqttReconnect(0), _lastHeartbeat(0), _wasOnline(false)
{}

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
"NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5\n"
"ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur\n"
"TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC\n"
"jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc\n"
"oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq\n"
"4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA\n"
"mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d\n"
"emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=\n"
"-----END CERTIFICATE-----\n";
  _wifi.setCACert(ca_cert);

  snprintf(_displayTopic, sizeof(_displayTopic), "courts/%s/display", courtId);
  snprintf(_statusTopic,  sizeof(_statusTopic),  "freq.led/courts/%s/status",  courtId);
  log_i("[health] Will publish status to: %s", _statusTopic);

  _mqtt.setServer(broker, port);
  _mqtt.setCallback(onMessage);
  _mqtt.setBufferSize(4096);
  _mac = WiFi.macAddress();
  _mac.toLowerCase();
  _mac.replace(":", "");
  snprintf(_cmdTopic, sizeof(_cmdTopic), "freq/display/cmd/%s", _mac.c_str());
  log_i("[mqtt] MAC: %s, CMD topic: %s", _mac.c_str(), _cmdTopic);
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

  if (online) {
    unsigned long now = millis();
    if (now - _lastHeartbeat > 60000) {
      _lastHeartbeat = now;
      publishOnline();
    }
  }

  if (!_playlist.empty() && _wasOnline) {
    unsigned long now = millis();
    unsigned long durationMs = (unsigned long)_playlist[_currentPageIndex].durationSeconds * 1000;
    if (durationMs == 0) durationMs = 10000;

    if (now - _lastPageChangeTime >= durationMs) {
      _lastPageChangeTime = now;
      _currentPageIndex = (_currentPageIndex + 1) % _playlist.size();

      applyCurrentPage();
    }
  }

  _driver.update();
}

// ── Private ───────────────────────────────────────────────────────────────────

void MqttDisplayClient::applyCurrentPage() {
  if (_currentPageIndex >= _playlist.size()) return;

  const auto& page = _playlist[_currentPageIndex];

  if (page.zoneCount == 0) return;

  ZoneRenderInfo rz[3];
  for (int zi = 0; zi < page.zoneCount && zi < 3; zi++) {
    rz[zi].panelStart = page.zones[zi].panelStart;
    rz[zi].panelEnd = page.zones[zi].panelEnd;
    rz[zi].lineCount = page.zones[zi].lineCount;
    rz[zi].scale = page.zones[zi].scale;
    rz[zi].valign = page.zones[zi].valign.c_str();
    rz[zi].borderCount = page.zones[zi].borderCount;
    for (int bri = 0; bri < page.zones[zi].borderCount && bri < 4; bri++) {
      rz[zi].borderRanges[bri] = page.zones[zi].borderRanges[bri];
    }

    for (int li = 0; li < page.zones[zi].lineCount && li < 2; li++) {
      const auto& srcLine = page.zones[zi].lines[li];
      rz[zi].lines[li].text = srcLine.text.c_str();
      uint8_t r = 0, g = 255, b = 0;
      parseHexColor(srcLine.color, r, g, b);
      rz[zi].lines[li].r = r;
      rz[zi].lines[li].g = g;
      rz[zi].lines[li].b = b;
      rz[zi].lines[li].effect = srcLine.effect.c_str();
      rz[zi].lines[li].align = srcLine.align.c_str();
      rz[zi].lines[li].scrollSpeed = srcLine.scrollSpeed;
      rz[zi].lines[li].marginTop = srcLine.marginTop;
      rz[zi].lines[li].marginBottom = srcLine.marginBottom;
    }
  }

  _driver.setZones(rz, page.zoneCount);
}

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
                    _statusTopic, 1, true, "{\"status\":\"offline\"}")) {
    log_i("[health] MQTT OK");
    _mqtt.subscribe(_displayTopic, 1);
    _mqtt.subscribe("freq/display/discover", 1);
    _mqtt.subscribe(_cmdTopic, 1);
    log_i("[health] Subscribed to freq/display/discover and %s", _cmdTopic);
    log_i("[health] Subscribed to %s (retained msg will follow)", _displayTopic);
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
  _mqtt.publish(_statusTopic, (uint8_t*)payload, strlen(payload), true);
}

// ── DISCOVER & Command Handlers ──────────────────────────────────────────────

String MqttDisplayClient::buildStatusPayload() {
  JsonDocument doc;
  doc["mac"] = _mac;
  doc["ip"] = WiFi.localIP().toString();
  doc["courtId"] = _courtId;
  doc["rssi"] = WiFi.RSSI();
  doc["heap"] = ESP.getFreeHeap();
  doc["overrideActive"] = _overrideActive;
  String out;
  serializeJson(doc, out);
  return out;
}

void MqttDisplayClient::handleDiscover() {
  String payload = buildStatusPayload();
  _mqtt.publish("freq/display/discover/response", payload.c_str());
  log_i("[mqtt] Discover response sent: %s", payload.c_str());
}

void MqttDisplayClient::handleCmdMessage(uint8_t* payload, unsigned int len) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, payload, len);
  if (error) {
    log_i("[mqtt-cmd] JSON parse failed: %s", error.c_str());
    return;
  }

  const char* action = doc["action"] | "";

  if (strcmp(action, "SET_COURT_ID") == 0) {
    const char* newId = doc["courtId"] | "";
    if (strlen(newId) > 0 && strcmp(newId, _courtId.c_str()) != 0) {
      log_i("[mqtt-cmd] SET_COURT_ID: '%s' -> '%s'", _courtId.c_str(), newId);
      if (_courtChangeCb) {
        _courtChangeCb(newId);
      }
    }
    return;
  }

  if (strcmp(action, "OVERRIDE") == 0) {
    _overridePages.clear();
    _overrideActive = false;
    JsonObject display = doc["display"];
    if (!display.isNull() && !display["pages"].isNull()) {
      for (JsonObject page : display["pages"].as<JsonArray>()) {
        DisplayPage p;
        p.durationSeconds = page["durationSeconds"] | 10;
        JsonArray zones = page["zones"];
        if (!zones.isNull()) {
          uint8_t zi = 0;
          for (JsonObject z : zones) {
            if (zi >= 3) break;
            DisplayZone& dz = p.zones[zi];
            dz.panelStart = z["panelStart"] | zi;
            dz.panelEnd = z["panelEnd"] | zi;
            dz.scale = z["scale"] | 0;
            dz.valign = z["valign"] | "middle";
            JsonArray lines = z["lines"];
            uint8_t li = 0;
            for (JsonObject l : lines) {
              if (li >= 2) break;
              dz.lines[li].text = l["text"] | "";
              dz.lines[li].color = l["color"] | "#FFFFFF";
              dz.lines[li].effect = l["effect"] | "SCROLL";
              dz.lines[li].align = l["align"] | "center";
              dz.lines[li].scrollSpeed = l["scrollSpeed"] | 1.0f;
              dz.lines[li].marginTop = l["marginTop"] | 0;
              dz.lines[li].marginBottom = l["marginBottom"] | 2;
              li++;
            }
            dz.lineCount = li;
            dz.borderCount = 0;
            zi++;
          }
          p.zoneCount = zi;
        } else {
          p.zoneCount = 1;
          p.zones[0].panelStart = 0;
          p.zones[0].panelEnd = 2;
          p.zones[0].lineCount = 1;
          p.zones[0].borderCount = 0;
          p.zones[0].scale = 0;
          p.zones[0].valign = "middle";
          p.zones[0].lines[0].text = doc["display"]["message"] | "OVERRIDE";
          p.zones[0].lines[0].color = "#FF0000";
          p.zones[0].lines[0].effect = "SCROLL";
          p.zones[0].lines[0].align = "center";
          p.zones[0].lines[0].scrollSpeed = 1.0f;
          p.zones[0].lines[0].marginTop = 0;
          p.zones[0].lines[0].marginBottom = 2;
        }
        _overridePages.push_back(p);
      }
      _overrideActive = true;
      _overridePageIndex = 0;
      _overridePageChangeTime = millis();
      log_i("[mqtt-cmd] OVERRIDE: %d pages", _overridePages.size());
    }
    return;
  }

  if (strcmp(action, "CLEAR_OVERRIDE") == 0) {
    _overridePages.clear();
    _overrideActive = false;
    _overridePageIndex = 0;
    _currentPageIndex = 0;
    _lastPageChangeTime = millis();
    log_i("[mqtt-cmd] CLEAR_OVERRIDE");
    if (!_playlist.empty()) {
      applyCurrentPage();
    }
    return;
  }
}

// ── Static MQTT callback ──────────────────────────────────────────────────────

void MqttDisplayClient::onMessage(char* topic, byte* payload, unsigned int length) {
  log_i("[mqtt] Received topic: %s", topic);
  if (_instance) {
    _instance->_lastTopic = String(topic);
    _instance->handleMessage(payload, length);
  }
}

void MqttDisplayClient::handleMessage(uint8_t* payload, unsigned int len) {
  // Route by topic
  if (_lastTopic == "freq/display/discover") {
    handleDiscover();
    return;
  }
  if (_lastTopic == _cmdTopic) {
    handleCmdMessage(payload, len);
    return;
  }

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

  if (doc["courtId"].is<const char*>()) {
    const char* newId = doc["courtId"];
    if (strcmp(newId, _courtId.c_str()) != 0 && _courtChangeCb) {
      log_i("[mqtt] Court ID change requested: '%s' -> '%s'", _courtId.c_str(), newId);
      _courtChangeCb(newId);
      return;
    }
  }

  JsonArray pages = doc["display"]["pages"];
  if (pages.isNull()) {
    const char* msg = doc["message"] | "";
    if (strlen(msg) == 0 && doc["line1"].is<const char*>()) {
      msg = doc["line1"] | "";
    }
    if (strlen(msg) > 0) {
      DisplayPage p;
      p.durationSeconds = 10;
      p.zoneCount = 1;
      p.zones[0].panelStart = 0;
      p.zones[0].panelEnd = 2;
      p.zones[0].lineCount = 1;
      p.zones[0].borderCount = 0;
      p.zones[0].scale = 0;
      p.zones[0].valign = "middle";
      p.zones[0].lines[0].text = msg;
      p.zones[0].lines[0].color = doc["color"] | "#FFFFFF";
      p.zones[0].lines[0].effect = doc["animation"] | "SCROLL";
      p.zones[0].lines[0].align = "center";
      p.zones[0].lines[0].scrollSpeed = 1.0f;
      p.zones[0].lines[0].marginTop = 0;
      p.zones[0].lines[0].marginBottom = 2;
      _playlist.push_back(p);
    }
  } else {
    for (JsonObject page : pages) {
      DisplayPage p;
      p.durationSeconds = page["durationSeconds"] | 10;

      JsonArray zones = page["zones"];
      if (!zones.isNull()) {
        p.zoneCount = 0;
        for (JsonObject zone : zones) {
          if (p.zoneCount >= 3) break;
          DisplayZone& z = p.zones[p.zoneCount];
          z.panelStart = zone["panelStart"] | 0;
          z.panelEnd = zone["panelEnd"] | 2;
          z.lineCount = 0;
          z.borderCount = 0;
          z.scale = zone["scale"] | 0;
          z.valign = zone["valign"] | "";

          JsonArray borderArr = zone["borderRows"];
          if (!borderArr.isNull()) {
            for (JsonObject br : borderArr) {
              if (z.borderCount >= 4) break;
              z.borderRanges[z.borderCount].start = br["start"] | 0;
              z.borderRanges[z.borderCount].end = br["end"] | 0;
              z.borderCount++;
            }
          }

          JsonArray lines = zone["lines"];
          if (!lines.isNull()) {
            for (JsonObject line : lines) {
              if (z.lineCount >= 2) break;
              z.lines[z.lineCount].text = line["text"] | "";
              z.lines[z.lineCount].color = line["color"] | "#FFFFFF";
              z.lines[z.lineCount].effect = line["effect"] | "SCROLL";
              z.lines[z.lineCount].align = line["align"] | "center";
              z.lines[z.lineCount].scrollSpeed = line["scrollSpeed"].is<float>() ? line["scrollSpeed"].as<float>() : 1.0f;
              z.lines[z.lineCount].marginTop = line["marginTop"] | 0;
              z.lines[z.lineCount].marginBottom = line["marginBottom"] | 2;
              z.lineCount++;
            }
          }
          p.zoneCount++;
        }
      } else {
        // Legacy flat page -> single zone
        DisplayZone& z = p.zones[0];
        z.panelStart = 0;
        z.panelEnd = 2;
        z.lineCount = 1;
        z.borderCount = 0;
        z.scale = 0;
        z.valign = "middle";
        z.lines[0].text = page["text"] | "";
        z.lines[0].color = page["color"] | "#FFFFFF";
        z.lines[0].effect = page["effect"] | "SCROLL";
        z.lines[0].align = "center";
        z.lines[0].scrollSpeed = 1.0f;
        z.lines[0].marginTop = 0;
        z.lines[0].marginBottom = 2;
        p.zoneCount = 1;
      }

      _playlist.push_back(p);
    }
  }

  // Parse schedule data for live {timer} countdown
  JsonObject currentSchedule = doc["schedule"]["current"];
  if (!currentSchedule.isNull()) {
    long startTimeEpoch = currentSchedule["startTimeEpoch"] | 0;
    long durationMinutes = currentSchedule["durationMinutes"] | 0;
    long prepTimeSec = currentSchedule["prepTimeSec"] | 0;
    long serverTime = doc["serverTime"] | 0;
    log_i("[mqtt] schedule: startEpoch=%ld duration=%ldmin prep=%lds serverTime=%ld", startTimeEpoch, durationMinutes, prepTimeSec, serverTime);
    if (startTimeEpoch > 0 && serverTime > 0) {
      long endTimeEpoch = startTimeEpoch + prepTimeSec + durationMinutes * 60;
      long remainingSec = endTimeEpoch - serverTime;
      if (remainingSec < 0) remainingSec = 0;
      unsigned long remainingMs = (unsigned long)remainingSec * 1000;
      unsigned long totalMs = ((unsigned long)durationMinutes * 60 + (unsigned long)prepTimeSec) * 1000;
      log_i("[mqtt] timer set: remaining=%lds total=%lds", remainingSec, totalMs / 1000);
      _driver.setTimer(remainingMs, totalMs, millis());
    }
  }

  _currentPageIndex = 0;
  _lastPageChangeTime = millis();

  applyCurrentPage();
  _driver.update();
}

#endif // USE_HUB75
