#pragma once
#include <Arduino.h>

class IDisplayDriver {
public:
  virtual void begin() = 0;
  virtual void clear() = 0;
  virtual void showRow(uint8_t row, const char* text) = 0;
  virtual void update() = 0;
  virtual void setBrightness(uint8_t /*b*/) {}
  virtual void setColorRGB(uint8_t /*r*/, uint8_t /*g*/, uint8_t /*b*/) {}
  virtual void setScrollSpeed(uint16_t /*msPerPixel*/) {}
  virtual void setAnimationMode(const char* /*mode*/) {}
  virtual void setTimer(unsigned long /*remainingMs*/, unsigned long /*totalMs*/, unsigned long /*baseMs*/) {}
  virtual void runDiagnosticSequence() {}
  virtual ~IDisplayDriver() = default;
};