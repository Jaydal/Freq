# Pickleball Court Prompter — Implementation Plan (MVP)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build MVP firmware displaying mock pickleball court scenarios on a MAX7219 8x32 LED matrix, controllable via Wokwi simulation.

**Architecture:** `main.cpp` instantiates `MockDataProvider`, `DisplayManager`, `LedController`, and `Buzzer`. The loop reads state from the data provider and pushes it to the display/LEDs/buzzer. All timing is `millis()`-based — no `delay()`.

**Tech Stack:** PlatformIO, ESP32 Arduino framework, MD_Parola, MD_MAX72XX, Wokwi simulation.

---

### Task 1: Project setup

**Files:**
- Create: `platformio.ini`
- Modify: `wokwi.toml`
- Modify: `diagram.json`
- Create: `src/` directory structure (other tasks create the .cpp/.h files)

- [ ] **Step 1: Write platformio.ini**

```ini
; PlatformIO Project Configuration File

[env:esp32-wokwi]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps =
    md_Parola
    md_MAX72XX
build_flags =
    -D WOKWI_SIMULATION
    -D MOCK_DATA
monitor_speed = 115200
```

- [ ] **Step 2: Write wokwi.toml**

```toml
[wokwi]
version = 1
firmware = ".pio/build/esp32-wokwi/firmware.hex"
elf = ".pio/build/esp32-wokwi/firmware.elf"
```

- [ ] **Step 3: Write diagram.json**

```json
{
  "version": 1,
  "author": "user",
  "editor": "wokwi",
  "parts": [
    { "type": "wokwi-esp32-devkit-v1", "id": "esp", "top": -100, "left": 0 },
    { "type": "wokwi-max7219-matrix", "id": "mx1", "top": 0, "left": 200 },
    { "type": "wokwi-max7219-matrix", "id": "mx2", "top": 0, "left": 300 },
    { "type": "wokwi-max7219-matrix", "id": "mx3", "top": 0, "left": 400 },
    { "type": "wokwi-max7219-matrix", "id": "mx4", "top": 0, "left": 500 },
    { "type": "wokwi-led", "id": "greenLed", "top": 100, "left": 200, "color": "green" },
    { "type": "wokwi-led", "id": "redLed", "top": 100, "left": 300, "color": "red" },
    { "type": "wokwi-piezo-buzzer", "id": "buzzer", "top": 100, "left": 400 }
  ],
  "connections": [
    ["esp:VCC", "mx1:VCC", "red"],
    ["esp:VCC", "mx2:VCC", "red"],
    ["esp:VCC", "mx3:VCC", "red"],
    ["esp:VCC", "mx4:VCC", "red"],
    ["esp:VCC", "greenLed:+", "red"],
    ["esp:VCC", "redLed:+", "red"],
    ["esp:VCC", "buzzer:VCC", "red"],
    ["esp:GND", "mx1:GND", "black"],
    ["esp:GND", "mx2:GND", "black"],
    ["esp:GND", "mx3:GND", "black"],
    ["esp:GND", "mx4:GND", "black"],
    ["esp:GND", "greenLed:-", "black"],
    ["esp:GND", "redLed:-", "black"],
    ["esp:GND", "buzzer:GND", "black"],
    ["esp:23", "mx1:DIN", "green"],
    ["mx1:DOUT", "mx2:DIN", "green"],
    ["mx2:DOUT", "mx3:DIN", "green"],
    ["mx3:DOUT", "mx4:DIN", "green"],
    ["esp:18", "mx1:CLK", "yellow"],
    ["esp:18", "mx2:CLK", "yellow"],
    ["esp:18", "mx3:CLK", "yellow"],
    ["esp:18", "mx4:CLK", "yellow"],
    ["esp:5", "mx1:CS", "orange"],
    ["esp:5", "mx2:CS", "orange"],
    ["esp:5", "mx3:CS", "orange"],
    ["esp:5", "mx4:CS", "orange"],
    ["esp:25", "greenLed:+", "green"],
    ["esp:26", "redLed:+", "red"],
    ["esp:27", "buzzer:SIG", "blue"]
  ],
  "dependencies": {}
}
```

- [ ] **Step 4: Clean up old files**

Remove the old Arduino Uno build artifacts so they don't interfere:

```bash
rm -rf .pio/build/uno
rm -f src/main.cpp
```

- [ ] **Step 5: Verify platform compiles with empty main**

Create a stub `src/main.cpp` that just has `setup() {}` and `loop() {}` and verify PlatformIO picks up the new env:

```bash
pio run -e esp32-wokwi 2>&1 | tail -10
```

Expected output ends with `===== [SUCCESS] =====`.

---

### Task 2: IDataProvider interface + DisplayState struct

**Files:**
- Create: `src/IDataProvider.h`

- [ ] **Step 1: Write IDataProvider.h**

```cpp
#pragma once

#include <Arduino.h>

struct DisplayState {
  String status;
  int courtNumber;
  String matchType;
  String team1[4];
  String team2[4];
  int team1Count;
  int team2Count;
  String remainingTime;
  String queuePlayers[8];
  int queuePlayerCount;
  String nextPlayers[8];
  int nextPlayerCount;
};

class IDataProvider {
public:
  virtual DisplayState getCurrentState() = 0;
};
```

- [ ] **Step 2: Verify compilation**

```bash
pio run -e esp32-wokwi 2>&1 | tail -5
```

Expected: SUCCESS

---

### Task 3: MockDataProvider

**Files:**
- Create: `src/MockDataProvider.h`
- Create: `src/MockDataProvider.cpp`

- [ ] **Step 1: Write MockDataProvider.h**

```cpp
#pragma once

#include "IDataProvider.h"

class MockDataProvider : public IDataProvider {
public:
  MockDataProvider();
  DisplayState getCurrentState() override;

private:
  unsigned long _lastSwitch;
  int _currentScenario;
  int _scenarioIndex;
  unsigned long _scenarioStart;
};
```

- [ ] **Step 2: Write MockDataProvider.cpp**

```cpp
#include "MockDataProvider.h"

MockDataProvider::MockDataProvider()
  : _lastSwitch(0)
  , _currentScenario(0)
  , _scenarioIndex(0)
  , _scenarioStart(0)
{
}

DisplayState MockDataProvider::getCurrentState()
{
  unsigned long now = millis();
  unsigned long elapsed = (now - _scenarioStart) / 1000;

  struct Scenario {
    unsigned long duration;
    DisplayState (*builder)(unsigned long elapsed, int index);
  };

  static DisplayState buildIdle(unsigned long e, int i) {
    DisplayState s;
    s.status = "IDLE";
    return s;
  }

  static DisplayState buildQueue(unsigned long e, int i) {
    DisplayState s;
    s.status = "QUEUE";
    s.courtNumber = 1;
    s.matchType = "2V2";
    s.team1[0] = "JUAN"; s.team1[1] = "PEDRO"; s.team1Count = 2;
    s.team2[0] = "MARK"; s.team2[1] = "JAMES"; s.team2Count = 2;
    return s;
  }

  static DisplayState buildPreparing(unsigned long e, int i) {
    DisplayState s;
    s.status = "PREPARING";
    s.courtNumber = 1;
    unsigned long remaining = (e > 120) ? 0 : (120 - e);
    char buf[6];
    sprintf(buf, "%02lu:%02lu", remaining / 60, remaining % 60);
    s.remainingTime = buf;
    return s;
  }

  static DisplayState buildRunning(unsigned long e, int i) {
    DisplayState s;
    s.status = "RUNNING";
    s.courtNumber = 1;
    s.matchType = "2V2";
    unsigned long remaining = (e > 1800) ? 0 : (1800 - e);
    char buf[6];
    sprintf(buf, "%02lu:%02lu", remaining / 60, remaining % 60);
    s.remainingTime = buf;
    return s;
  }

  static DisplayState buildCooldown(unsigned long e, int i) {
    DisplayState s;
    s.status = "COOLDOWN";
    s.courtNumber = 1;
    unsigned long remaining = (e > 300) ? 0 : (300 - e);
    char buf[6];
    sprintf(buf, "%02lu:%02lu", remaining / 60, remaining % 60);
    s.remainingTime = buf;
    return s;
  }

  static DisplayState buildMaintenance(unsigned long e, int i) {
    DisplayState s;
    s.status = "MAINTENANCE";
    return s;
  }

  static DisplayState buildOffline(unsigned long e, int i) {
    DisplayState s;
    s.status = "OFFLINE";
    return s;
  }

  static const Scenario scenarios[] = {
    { 5, buildIdle },
    { 8, buildQueue },
    { 10, buildPreparing },
    { 30, buildRunning },
    { 5, buildCooldown },
    { 5, buildMaintenance },
    { 5, buildOffline },
  };

  static const int scenarioCount = sizeof(scenarios) / sizeof(scenarios[0]);

  if (_currentScenario >= scenarioCount) {
    _currentScenario = 0;
    _scenarioStart = now;
  }

  const Scenario& sc = scenarios[_currentScenario];

  if (elapsed >= sc.duration) {
    _currentScenario++;
    _scenarioStart = now;
    return getCurrentState();
  }

  return sc.builder(elapsed, _currentScenario);
}
```

- [ ] **Step 3: Verify compilation**

```bash
pio run -e esp32-wokwi 2>&1 | tail -5
```

Expected: SUCCESS

---

### Task 4: LedController

**Files:**
- Create: `src/LedController.h`
- Create: `src/LedController.cpp`

- [ ] **Step 1: Write LedController.h**

```cpp
#pragma once

#include <Arduino.h>

class LedController {
public:
  LedController(uint8_t greenPin, uint8_t redPin);

  void begin();
  void greenOn();
  void greenOff();
  void greenBlink(unsigned long periodMs = 1000);
  void redOn();
  void redOff();
  void redBlink(unsigned long periodMs = 1000);
  void allOff();
  void update();

private:
  uint8_t _greenPin;
  uint8_t _redPin;
  bool _greenState;
  bool _redState;
  bool _greenBlinking;
  bool _redBlinking;
  unsigned long _greenPeriod;
  unsigned long _redPeriod;
  unsigned long _lastTick;
};
```

- [ ] **Step 2: Write LedController.cpp**

```cpp
#include "LedController.h"

LedController::LedController(uint8_t greenPin, uint8_t redPin)
  : _greenPin(greenPin)
  , _redPin(redPin)
  , _greenState(false)
  , _redState(false)
  , _greenBlinking(false)
  , _redBlinking(false)
  , _greenPeriod(1000)
  , _redPeriod(1000)
  , _lastTick(0)
{
}

void LedController::begin()
{
  pinMode(_greenPin, OUTPUT);
  pinMode(_redPin, OUTPUT);
  digitalWrite(_greenPin, LOW);
  digitalWrite(_redPin, LOW);
}

void LedController::greenOn()
{
  _greenBlinking = false;
  _greenState = true;
  digitalWrite(_greenPin, HIGH);
}

void LedController::greenOff()
{
  _greenBlinking = false;
  _greenState = false;
  digitalWrite(_greenPin, LOW);
}

void LedController::greenBlink(unsigned long periodMs)
{
  _greenBlinking = true;
  _greenPeriod = periodMs;
}

void LedController::redOn()
{
  _redBlinking = false;
  _redState = true;
  digitalWrite(_redPin, HIGH);
}

void LedController::redOff()
{
  _redBlinking = false;
  _redState = false;
  digitalWrite(_redPin, LOW);
}

void LedController::redBlink(unsigned long periodMs)
{
  _redBlinking = true;
  _redPeriod = periodMs;
}

void LedController::allOff()
{
  greenOff();
  redOff();
}

void LedController::update()
{
  unsigned long now = millis();
  if (now - _lastTick < 50) return;
  _lastTick = now;

  if (_greenBlinking) {
    bool on = (now / (_greenPeriod / 2)) % 2 == 0;
    digitalWrite(_greenPin, on ? HIGH : LOW);
  }

  if (_redBlinking) {
    bool on = (now / (_redPeriod / 2)) % 2 == 0;
    digitalWrite(_redPin, on ? HIGH : LOW);
  }
}
```

- [ ] **Step 3: Verify compilation**

```bash
pio run -e esp32-wokwi 2>&1 | tail -5
```

Expected: SUCCESS

---

### Task 5: Buzzer

**Files:**
- Create: `src/Buzzer.h`
- Create: `src/Buzzer.cpp`

- [ ] **Step 1: Write Buzzer.h**

```cpp
#pragma once

#include <Arduino.h>

class Buzzer {
public:
  Buzzer(uint8_t pin);

  void begin();
  void shortBeep();
  void longBeep();
  void update();

private:
  uint8_t _pin;
  unsigned long _beepEnd;
  int _frequency;

  void beep(int freq, unsigned long durationMs);
};
```

- [ ] **Step 2: Write Buzzer.cpp**

```cpp
#include "Buzzer.h"

Buzzer::Buzzer(uint8_t pin)
  : _pin(pin)
  , _beepEnd(0)
  , _frequency(0)
{
}

void Buzzer::begin()
{
  pinMode(_pin, OUTPUT);
  digitalWrite(_pin, LOW);
}

void Buzzer::beep(int freq, unsigned long durationMs)
{
  _frequency = freq;
  _beepEnd = millis() + durationMs;
  tone(_pin, freq);
}

void Buzzer::shortBeep()
{
  beep(2000, 200);
}

void Buzzer::longBeep()
{
  beep(1000, 800);
}

void Buzzer::update()
{
  if (_frequency > 0 && millis() >= _beepEnd) {
    noTone(_pin);
    _frequency = 0;
  }
}
```

- [ ] **Step 3: Verify compilation**

```bash
pio run -e esp32-wokwi 2>&1 | tail -5
```

Expected: SUCCESS

---

### Task 6: DisplayManager

**Files:**
- Create: `src/DisplayManager.h`
- Create: `src/DisplayManager.cpp`

- [ ] **Step 1: Write DisplayManager.h**

```cpp
#pragma once

#include <MD_Parola.h>
#include <MD_MAX72xx.h>
#include <SPI.h>
#include "IDataProvider.h"

class DisplayManager {
public:
  DisplayManager(uint8_t csPin, uint8_t numDevices, IDataProvider& provider);

  void begin();
  void update();

private:
  MD_Parola _display;
  IDataProvider& _provider;
  String _lastStatus;
  String _currentText;

  void renderIdle();
  void renderQueue();
  void renderPreparing();
  void renderRunning();
  void renderCooldown();
  void renderMaintenance();
  void renderOffline();
  void showText(const String& text);
};
```

- [ ] **Step 2: Write DisplayManager.cpp**

```cpp
#include "DisplayManager.h"

DisplayManager::DisplayManager(uint8_t csPin, uint8_t numDevices, IDataProvider& provider)
  : _display(MD_MAX72XX::FC16_HW, csPin, numDevices)
  , _provider(provider)
{
}

void DisplayManager::begin()
{
  _display.begin();
  _display.setIntensity(4);
  _display.displayClear();
  _display.setTextAlignment(PA_CENTER);
  _display.print("INIT");
}

void DisplayManager::update()
{
  static unsigned long lastRender = 0;
  unsigned long now = millis();

  if (_display.displayAnimate()) {
    DisplayState state = _provider.getCurrentState();

    if (state.status != _lastStatus || now - lastRender > 1000) {
      _lastStatus = state.status;
      lastRender = now;

      if (state.status == "IDLE") renderIdle();
      else if (state.status == "QUEUE") renderQueue();
      else if (state.status == "PREPARING") renderPreparing();
      else if (state.status == "RUNNING") renderRunning();
      else if (state.status == "COOLDOWN") renderCooldown();
      else if (state.status == "MAINTENANCE") renderMaintenance();
      else if (state.status == "OFFLINE") renderOffline();
    }
  }
}

void DisplayManager::showText(const String& text)
{
  if (text != _currentText) {
    _currentText = text;
    _display.displayClear();
    _display.print(text.c_str());
  }
}

void DisplayManager::renderIdle()
{
  _display.setTextAlignment(PA_CENTER);
  _display.print("WELCOME");
  // On next animate cycle, show second line
  // MD_Parola doesn't natively support multi-line on 8-pixel height,
  // so we scroll through lines
}

void DisplayManager::renderQueue()
{
  _display.setTextAlignment(PA_LEFT);
  _display.print("C1 2V2 J/P VS M/J");
}

void DisplayManager::renderPreparing()
{
  DisplayState state = _provider.getCurrentState();
  String text = "PREP " + state.remainingTime;
  _display.setTextAlignment(PA_CENTER);
  _display.print(text.c_str());
}

void DisplayManager::renderRunning()
{
  DisplayState state = _provider.getCurrentState();
  String text = state.remainingTime;
  _display.setTextAlignment(PA_CENTER);
  _display.print(text.c_str());
}

void DisplayManager::renderCooldown()
{
  DisplayState state = _provider.getCurrentState();
  String text = "DONE " + state.remainingTime;
  _display.setTextAlignment(PA_CENTER);
  _display.print(text.c_str());
}

void DisplayManager::renderMaintenance()
{
  _display.setTextAlignment(PA_CENTER);
  _display.print("CLOSED");
}

void DisplayManager::renderOffline()
{
  _display.setTextAlignment(PA_CENTER);
  _display.print("OFFLINE");
}
```

- [ ] **Step 3: Verify compilation**

```bash
pio run -e esp32-wokwi 2>&1 | tail -5
```

Expected: SUCCESS

---

### Task 7: main.cpp — wiring everything together

**Files:**
- Overwrite: `src/main.cpp`

- [ ] **Step 1: Write main.cpp**

```cpp
#include <Arduino.h>
#include "MockDataProvider.h"
#include "DisplayManager.h"
#include "LedController.h"
#include "Buzzer.h"

#define CS_PIN 5
#define MAX_DEVICES 4
#define GREEN_LED 25
#define RED_LED 26
#define BUZZER_PIN 27

MockDataProvider* dataProvider;
DisplayManager* displayManager;
LedController* ledController;
Buzzer* buzzer;

void setup()
{
  Serial.begin(115200);
  Serial.println("=== Pickleball Court Prompter (MVP) ===");

  dataProvider = new MockDataProvider();
  displayManager = new DisplayManager(CS_PIN, MAX_DEVICES, *dataProvider);
  ledController = new LedController(GREEN_LED, RED_LED);
  buzzer = new Buzzer(BUZZER_PIN);

  ledController->begin();
  buzzer->begin();
  displayManager->begin();

  buzzer->shortBeep();

  Serial.println("Setup complete. Starting demo...");
}

void loop()
{
  DisplayState state = dataProvider->getCurrentState();

  if (state.status == "PREPARING") {
    ledController->greenOn();
    ledController->redOff();
  } else if (state.status == "RUNNING") {
    ledController->greenOff();
    ledController->redOn();
  } else if (state.status == "MAINTENANCE") {
    ledController->greenBlink();
    ledController->redOff();
  } else if (state.status == "OFFLINE") {
    ledController->greenOff();
    ledController->redBlink();
  } else {
    ledController->allOff();
  }

  ledController->update();
  buzzer->update();
  displayManager->update();
}
```

- [ ] **Step 2: Verify compilation**

```bash
pio run -e esp32-wokwi 2>&1 | tail -10
```

Expected: SUCCESS

---

### Task 8: Run in Wokwi simulator and verify

**Files:** None (verification step)

- [ ] **Step 1: Run the simulation**

```bash
export WOKWI_CLI_TOKEN="wok_uyNrD46mL7nK6BDFhriyNvU4jDiOpWkYf50bda46"
wokwi-cli . --timeout 120000
```

- [ ] **Step 2: Observe serial output**

The serial monitor should show boot messages and scenario cycling. The matrix should display text for each scenario. LEDs should light/blink according to the mode. Buzzer should beep on start.
