#pragma once
#if defined(USE_HUB75) && defined(HD_WF2)

#include "IDisplayDriver.h"
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>
#include <vector>

class Hub75Driver : public IDisplayDriver {
public:
  Hub75Driver();
  void begin() override;
  void clear() override;
  void showRow(uint8_t row, const char* text) override;
  void update() override;
  void setBrightness(uint8_t b) override;
  void setColorRGB(uint8_t r, uint8_t g, uint8_t b) override;
  void setScrollSpeed(uint16_t msPerPixel) override;
  void setAnimationMode(const char* mode) override;
  void setTimer(unsigned long remainingMs, unsigned long totalMs, unsigned long baseMs) { _timerRemainingAtBaseMs = remainingMs; _timerTotalMs = totalMs; _timerBaseMs = baseMs; }
  void runDiagnosticSequence() override;

private:
  MatrixPanel_I2S_DMA* _matrix;
  String _lines[1];          // Only 1 line rendered now (scaled to fit)
  int    _scrollX[1];         // current x offset for marquee
  unsigned long _scrollLastTick[1];
  uint16_t _color;
  uint16_t _scrollTickMs;
  String _animMode;

  struct Page {
    String text1;
    String text2;
    int scale;
  };
  std::vector<Page> _pages;
  int _currentPage;
  unsigned long _pageLastTick;

  // Timer countdown — set by MqttDisplayClient via setTimer().
  // On each redraw, {timer} in the line text is substituted with M:SS.
  unsigned long _timerRemainingAtBaseMs = 0;
  unsigned long _timerTotalMs = 0;
  unsigned long _timerBaseMs = 0;
  unsigned long _lastTimerRedraw = 0;

  String substituteTimer(const String& text) const;
  void redraw();
  void drawText5x7Scaled(const char* s, int x, int y, uint16_t color, int scale);
  int  textWidth5x7Scaled(const char* s, int scale);
  void drawPixelMapped(int x, int y, uint16_t color);
  void paginateText(const String& text);
};

#endif