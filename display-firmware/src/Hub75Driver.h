#pragma once
#if defined(USE_HUB75) && defined(HD_WF2)

#include "IDisplayDriver.h"
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>

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
  void setZones(const ZoneRenderInfo* zones, uint8_t count) override;
  void runDiagnosticSequence() override;
  void setOtaActive(bool active) override { _otaActive = active; if (active) _matrix->clearScreen(); }

private:
  MatrixPanel_I2S_DMA* _matrix;
  uint16_t _defaultColor;
  uint16_t _scrollTickMs;
  String _animMode;

  static const int MAX_ZONES = 3;
  static const int MAX_LINES_PER_ZONE = 2;
  static const int MAX_BORDER_RANGES = 4;

  struct ZoneState {
    uint8_t panelStart;
    uint8_t panelEnd;
    uint8_t lineCount;
    struct LineState {
      String text;
      uint16_t color;
      String effect;
      String align;
      int scrollX;
      unsigned long scrollLastTick;
      float scrollSpeed;
      uint8_t marginTop;
      uint8_t marginBottom;
      bool hasBgColor = false;
      uint8_t bgR = 0, bgG = 0, bgB = 0;
    } lines[MAX_LINES_PER_ZONE];
    bool hasData;
    uint8_t scale;
    String valign;
    uint8_t borderCount;
    BorderRange borderRanges[MAX_BORDER_RANGES];
  };

  ZoneState _zones[MAX_ZONES];
  int _zoneCount;

  // Fallback single-line state (when showRow is used directly)
  String _fallbackText;
  int _fallbackScrollX;
  unsigned long _fallbackScrollTick;

  // Boot splash
  bool _splashActive = false;
  int _ballX = 0, _ballY = 0;
  int _ballDx = 1, _ballDy = 1;
  unsigned long _ballLastMove = 0;
  unsigned long _splashStartTime = 0;
  bool _splashStaticDrawn = false;
  static constexpr unsigned long SPLASH_DURATION_MS = 10000;
  static constexpr int BALL_SIZE = 3;

  // OTA safety — suppress DMA during firmware updates
  volatile bool _otaActive = false;

  // Timer countdown
  unsigned long _timerRemainingAtBaseMs = 0;
  unsigned long _timerTotalMs = 0;
  unsigned long _timerBaseMs = 0;
  unsigned long _lastTimerRedraw = 0;

  String substituteTimer(const String& text) const;
  void redraw();
  void drawText5x7Scaled(const char* s, int x, int y, uint16_t color, int scale, int clipXStart, int clipXEnd, uint8_t borderCount = 0, const BorderRange* borderRanges = nullptr);
  int  textWidth5x7Scaled(const char* s, int scale);
  void drawPixelMapped(int x, int y, uint16_t color);
};

#endif
