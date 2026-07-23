#pragma once
#include <Arduino.h>

struct ZoneLineRender {
  String text;
  uint8_t r;
  uint8_t g;
  uint8_t b;
  String effect;
  String align;
  float scrollSpeed;
  uint8_t marginTop;
  uint8_t marginBottom;
  bool hasBgColor = false;
  uint8_t bgR = 0;
  uint8_t bgG = 0;
  uint8_t bgB = 0;
};

struct BorderRange {
  uint8_t start;
  uint8_t end;
};

struct ZoneRenderInfo {
  uint8_t panelStart;
  uint8_t panelEnd;
  uint8_t lineCount;
  ZoneLineRender lines[2];
  uint8_t borderCount;
  BorderRange borderRanges[4];
  uint8_t scale;
  String valign;
};

class IDisplayDriver {
public:
  virtual void begin() = 0;
  virtual void clear() = 0;
  virtual void showRow(uint8_t row, const char* text) = 0;
  virtual void update() = 0;
  virtual void setBrightness(uint8_t b) {}
  virtual void setColorRGB(uint8_t r, uint8_t g, uint8_t b) {}
  virtual void setScrollSpeed(uint16_t msPerPixel) {}
  virtual void setAnimationMode(const char* mode) {}
  virtual void setTimer(unsigned long remainingMs, unsigned long totalMs, unsigned long baseMs) {}
  virtual void setZones(const ZoneRenderInfo* zones, uint8_t count) {}
  virtual void runDiagnosticSequence() {}
  virtual void setOtaActive(bool active) {}
  virtual ~IDisplayDriver() = default;
};
