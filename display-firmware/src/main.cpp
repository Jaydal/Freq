#include <Arduino.h>
#include "IDisplayDriver.h"
#include "Hub75Driver.h"
#include "MqttDisplayClient.h"
#include "ConfigPortal.h"

// WF2 onboard peripherals
#define STATUS_LED    40   // RUN_LED — solid=online, blink 500ms=lost, rapid 200ms=portal
#define RESET_BUTTON  17   // long-press 5s → factory reset → portal

// ── Normal-mode state ────────────────────────────────────────────────────────
static MqttDisplayClient* g_mqtt       = nullptr;
static IDisplayDriver*    g_display    = nullptr;
static unsigned long       g_ledToggleAt = 0;
static bool               g_ledState    = false;

// ── Portal-mode state ────────────────────────────────────────────────────────
static ConfigPortal g_portal;
static bool g_portalMode = false;

// ── Button (factory reset) ───────────────────────────────────────────────────
static unsigned long g_btnPressStart = 0;
static bool g_btnHandled = false;

static void checkResetButton() {
  bool pressed = (digitalRead(RESET_BUTTON) == LOW);  // active-low
  if (pressed) {
    if (g_btnPressStart == 0) g_btnPressStart = millis();
    if (millis() - g_btnPressStart > 5000 && !g_btnHandled) {
      log_i("[main] Button held 5s → factory reset");
      g_portal.factoryReset();
      g_btnHandled = true;
    }
  } else {
    g_btnPressStart = 0;
    g_btnHandled = false;
  }
}

static void statusLedPortal() {
  unsigned long now = millis();
  if (now - g_ledToggleAt >= 200) {  // rapid blink = portal mode
    g_ledToggleAt = now;
    g_ledState = !g_ledState;
    digitalWrite(STATUS_LED, g_ledState ? HIGH : LOW);
  }
}

static void statusLedNormal(MqttDisplayClient* mqtt) {
  if (mqtt->isOnline()) {
    digitalWrite(STATUS_LED, HIGH);
  } else {
    unsigned long now = millis();
    if (now - g_ledToggleAt >= 500) {  // slow blink = lost connection
      g_ledToggleAt = now;
      g_ledState = !g_ledState;
      digitalWrite(STATUS_LED, g_ledState ? HIGH : LOW);
    }
  }
}

#include <WiFi.h>

#ifdef ENABLE_OTA
#include <ArduinoOTA.h>
#endif

#ifdef ENABLE_TELNET
#include "TelnetLogger.h"
static TelnetLogger g_log;
#define LOG(fmt, ...) g_log.printf(fmt, ##__VA_ARGS__)
#else
#define LOG(fmt, ...) Serial.printf(fmt, ##__VA_ARGS__)
#endif

void setup() {
  Serial.begin(115200);
  delay(2000); // Wait for the PC to reconnect the USB CDC serial port after a reboot

  // CRITICAL: The ESP32 automatically tries to connect to the last saved WiFi 
  // network in the background on boot. This background task heavily interferes 
  // with the DMA hardware initialization and causes a hard freeze.
  // We MUST kill the WiFi task before doing anything!
  WiFi.mode(WIFI_OFF);
  delay(100); // Give the background WiFi task a moment to cleanly exit

  LOG("BOOTING UP! If you see this, the chip is NOT frozen!\n");
  LOG("\n=== Freq Court Display — HD-WF2 ===\n");

  pinMode(STATUS_LED, OUTPUT);
  pinMode(RESET_BUTTON, INPUT_PULLUP);
  digitalWrite(STATUS_LED, LOW);

  g_display = new Hub75Driver();
  
  // MUST initialize display first to allocate contiguous DMA memory
  // before WiFi starts and fragments the heap!
  g_display->begin();

  // ── Boot branching: portal vs normal ──────────────────────────────────────
  if (!g_portal.isConfigured()) {
    log_i("[main] No saved settings -> starting config portal");
    g_portalMode = true;
    String setupMsg = "SETUP: CONNECT TO " + g_portal.getPortalSSID();
    g_display->showRow(0, setupMsg.c_str());
    g_display->update();
    g_portal.setDisplayDriver(g_display);
    g_portal.startPortal();
    return;
  }

  // ── Try saved WiFi; fall back to portal on failure ─────────────────────────
  if (!g_portal.connectSavedWiFi(3)) {
    log_i("[main] WiFi failed -> starting config portal");
    g_portalMode = true;
    String setupMsg = "WIFI FAILED - CONNECT TO " + g_portal.getPortalSSID();
    g_display->showRow(0, setupMsg.c_str());
    g_display->update();
    g_portal.setDisplayDriver(g_display);
    g_portal.startPortal();
    return;
  }

  // ── Normal boot: MQTT client with saved settings ───────────────────────────
  g_mqtt = new MqttDisplayClient(*g_display);
  String ssid   = g_portal.getWifiSsid();
  String pass   = g_portal.getWifiPass();
  String broker = g_portal.getMqttBroker();
  String user   = g_portal.getMqttUser();
  String mpwd   = g_portal.getMqttPass();
  String court  = g_portal.getCourtId();
  uint16_t port = g_portal.getMqttPort();
  uint8_t brightness = g_portal.getBrightness();
  String colorHex = g_portal.getColorHex();

  g_display->setBrightness(brightness);
  if (colorHex.length() == 7 && colorHex.startsWith("#")) {
    long rgb = strtol(colorHex.substring(1).c_str(), NULL, 16);
    g_display->setColorRGB((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
  }

  // ── Telnet console ─────────────────────────────────────────────────────────
#ifdef ENABLE_TELNET
  g_log.begin(23);
  g_log.setCommandCallback([](const String& cmd, const String& args) {
    if (cmd == "set.court" && args.length() > 0) {
      g_portal.saveField("court_id", args);
      LOG("[telnet] Court set to '%s' — rebooting...\n", args.c_str());
      delay(500);
      ESP.restart();
    } else if (cmd == "set.brightness") {
      uint8_t val = (uint8_t)constrain(args.toInt(), 0, 255);
      g_portal.saveField("brightness", val);
      if (g_display) g_display->setBrightness(val);
      LOG("[telnet] Brightness set to %d\n", val);
    } else if (cmd == "set.color" && args.startsWith("#")) {
      g_portal.saveField("color_hex", args);
      long rgb = strtol(args.substring(1).c_str(), NULL, 16);
      if (g_display) g_display->setColorRGB((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
      LOG("[telnet] Color set to %s\n", args.c_str());
    } else if (cmd == "reboot") {
      LOG("[telnet] Rebooting...\n");
      delay(500);
      ESP.restart();
    } else if (cmd == "status") {
      LOG("[telnet] Court: %s | Brightness: %d | Color: %s\n",
        g_portal.getCourtId().c_str(), g_portal.getBrightness(), g_portal.getColorHex().c_str());
    } else {
      LOG("[telnet] Unknown command: %s\n", cmd.c_str());
    }
  });
#endif

  // ── OTA: wireless firmware updates ─────────────────────────────────────────
#ifdef ENABLE_OTA
  ArduinoOTA.setHostname(("freq-display-" + court).c_str());
  #ifndef OTA_PASSWORD
  #define OTA_PASSWORD "freqota"
  #endif
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.onStart([&]() {
    if (g_display) g_display->setOtaActive(true);
    LOG("[ota] Start — display paused\n");
  });
  ArduinoOTA.onEnd([]() {}); // device reboots after OTA; _otaActive resets on boot
  ArduinoOTA.onProgress([](unsigned int p, unsigned int t) {
    LOG("[ota] Progress: %u%%\n", t > 0 ? (p * 100) / t : 0);
  });
  ArduinoOTA.onError([](ota_error_t err) {
    LOG("[ota] Error %d\n", err);
  });
  ArduinoOTA.begin();
  LOG("[ota] Ready — upload via: pio run -e esp32-hub75-wf2-ota -t upload --upload-port %s\n",
        WiFi.localIP().toString().c_str());
#endif

  LOG("[main] Loaded settings: SSID='%s', Broker='%s:%d', CourtID='%s', User='%s', Brightness=%d, Color=%s\n",
                ssid.c_str(), broker.c_str(), port, court.c_str(), user.c_str(), brightness, colorHex.c_str());

  g_mqtt->begin(ssid.c_str(), pass.c_str(), broker.c_str(), port,
                court.c_str(), user.c_str(), mpwd.c_str());
  digitalWrite(STATUS_LED, g_mqtt->isOnline() ? HIGH : LOW);

  LOG("[main] === BOOT COMPLETE ===\n");
  LOG("[main] WiFi:  %s (%d dBm)\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  LOG("[main] MQTT:  %s\n", g_mqtt->isOnline() ? "connected" : "disconnected");
  LOG("[main] Court: %s\n", court.c_str());
  LOG("[main] Subscribed to: courts/%s/display\n", court.c_str());
}

void loop() {
  checkResetButton();

  if (g_portalMode) {
    g_portal.update();
    statusLedPortal();
    if (g_display) g_display->update();
    yield();
    return;
  }

  if (!g_mqtt) return;
#ifdef ENABLE_TELNET
  g_log.update();
#endif
#ifdef ENABLE_OTA
  ArduinoOTA.handle();
#endif
  g_mqtt->update();
  statusLedNormal(g_mqtt);
  yield();
}