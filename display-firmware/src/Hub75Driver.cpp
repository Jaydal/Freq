#if defined(USE_HUB75) && defined(HD_WF2)
#include "Hub75Driver.h"

static constexpr HUB75_I2S_CFG::i2s_pins WF2_PINS = {
  .r1 =  2, .g1 =  6, .b1 = 10,
  .r2 =  3, .g2 =  7, .b2 = 11,
  .a  = 39, .b  = 38, .c  = 37, .d  = 36, .e  = 21,
  .lat = 33, .oe  = 35, .clk = 34
};

#define WF2_PANEL_W  32
#define WF2_PANEL_H  16
#define WF2_CHAIN    3
#define WF2_RES_X    (WF2_PANEL_W * WF2_CHAIN)
#define WF2_RES_Y    WF2_PANEL_H

#define SCROLL_WRAP_PAD 4

static const uint8_t FONT5x7[][7] = {
  {0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001},
  {0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110},
  {0b01110,0b10001,0b10000,0b10000,0b10000,0b10001,0b01110},
  {0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110},
  {0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111},
  {0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000},
  {0b01110,0b10001,0b10000,0b10111,0b10001,0b10001,0b01110},
  {0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001},
  {0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110},
  {0b00111,0b00010,0b00010,0b00010,0b00010,0b10010,0b01100},
  {0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001},
  {0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111},
  {0b10001,0b11011,0b10101,0b10101,0b10001,0b10001,0b10001},
  {0b10001,0b10001,0b11001,0b10101,0b10011,0b10001,0b10001},
  {0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110},
  {0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000},
  {0b01110,0b10001,0b10000,0b10000,0b10000,0b10001,0b01110},
  {0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001},
  {0b01110,0b10001,0b10000,0b01110,0b00001,0b10001,0b01110},
  {0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100},
  {0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110},
  {0b10001,0b10001,0b10001,0b10001,0b10001,0b01010,0b00100},
  {0b10001,0b10001,0b10001,0b10101,0b10101,0b11011,0b10001},
  {0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001},
  {0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100},
  {0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111},
  {0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110},
  {0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110},
  {0b01110,0b10001,0b00001,0b00010,0b00100,0b01000,0b11111},
  {0b01110,0b10001,0b00001,0b00110,0b00001,0b10001,0b01110},
  {0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010},
  {0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110},
  {0b01110,0b10000,0b10000,0b11110,0b10001,0b10001,0b01110},
  {0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000},
  {0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110},
  {0b01110,0b10001,0b10001,0b01111,0b00001,0b00001,0b01110},
  {0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00000},
  {0b00000,0b00000,0b00000,0b11111,0b00000,0b00000,0b00000},
  {0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00100},
  {0b00000,0b00100,0b00000,0b00000,0b00000,0b00100,0b00000},
  {0b00001,0b00010,0b00010,0b00100,0b01000,0b01000,0b10000},
  {0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00000},
};

#define CHAR_W    5
#define CHAR_H    7
#define SPACING   1
#define CELL_W    (CHAR_W + SPACING)
#define FONT_SIZE (sizeof(FONT5x7) / sizeof(FONT5x7[0]))

static int glyphIndex(char c) {
  if (c >= 'A' && c <= 'Z') return c - 'A';
  if (c >= 'a' && c <= 'z') return c - 'a';
  if (c >= '0' && c <= '9') return 26 + (c - '0');
  if (c == ' ')  return 36;
  if (c == '-')  return 37;
  if (c == '.')  return 38;
  if (c == ':')  return 39;
  if (c == '/')  return 40;
  if (c == (char)0xA0) return 41;
  return -1;
}

Hub75Driver::Hub75Driver()
  : _matrix(nullptr), _defaultColor(0xF800), _scrollTickMs(45), _animMode("scroll"),
    _zoneCount(0), _fallbackScrollX(0), _fallbackScrollTick(0)
{
  for (int i = 0; i < MAX_ZONES; i++) _zones[i].hasData = false;
}

void Hub75Driver::begin() {
  HUB75_I2S_CFG cfg(WF2_PANEL_W, WF2_PANEL_H, WF2_CHAIN, WF2_PINS);
  cfg.i2sspeed       = HUB75_I2S_CFG::HZ_10M;
  cfg.latch_blanking = 4;
  cfg.double_buff    = true;
  _matrix = new MatrixPanel_I2S_DMA(cfg);
  bool ok = _matrix->begin();
  Serial.printf("[HUB75/WF2] begin: %s  geometry=%dx%d chain=%d\n",
                ok ? "OK" : "FAILED", WF2_PANEL_W, WF2_PANEL_H, WF2_CHAIN);
  if (!ok) { delete _matrix; _matrix = nullptr; return; }
  _matrix->setBrightness8(153);
  uint16_t red = _matrix->color565(255, 0, 0);
  _matrix->fillScreen(red);
  delay(2000);
  _matrix->clearScreen();
}

void Hub75Driver::clear() {
  _zoneCount = 0;
  _fallbackText = "";
  _fallbackScrollX = 0;
  if (_matrix) _matrix->clearScreen();
}

void Hub75Driver::showRow(uint8_t row, const char* text) {
  if (row != 0 || !_matrix) return;

  // Build a temporary single zone from the text
  _fallbackText = text;
  int w = textWidth5x7Scaled(text, 2);
  _fallbackScrollX = (w > WF2_RES_X) ? WF2_RES_X : 0;
  _fallbackScrollTick = millis();

  // Show as single zone covering all panels
  ZoneState& z = _zones[0];
  z.panelStart = 0;
  z.panelEnd = 2;
  z.lineCount = 1;
  z.hasData = true;
  z.lines[0].text = text;
  z.lines[0].color = _defaultColor;
  z.lines[0].effect = _animMode;
  z.lines[0].scrollX = (w > WF2_RES_X) ? WF2_RES_X : 0;
  z.lines[0].scrollLastTick = millis();
  _zoneCount = 1;

  redraw();
}

void Hub75Driver::setBrightness(uint8_t b) {
  if (_matrix) _matrix->setBrightness8(b);
}

void Hub75Driver::setColorRGB(uint8_t r, uint8_t g, uint8_t b) {
  if (_matrix) {
    _defaultColor = _matrix->color565(r, g, b);
  }
}

void Hub75Driver::setScrollSpeed(uint16_t msPerPixel) {
  _scrollTickMs = msPerPixel;
}

void Hub75Driver::setAnimationMode(const char* mode) {
  _animMode = String(mode);
}

void Hub75Driver::setZones(const ZoneRenderInfo* zones, uint8_t count) {
  if (count > MAX_ZONES) count = MAX_ZONES;
  _zoneCount = count;

  for (int zi = 0; zi < count; zi++) {
    ZoneState& dst = _zones[zi];
    const ZoneRenderInfo& src = zones[zi];
    dst.panelStart = src.panelStart;
    dst.panelEnd = src.panelEnd;
    dst.lineCount = src.lineCount;
    dst.hasData = true;

    for (int li = 0; li < src.lineCount && li < MAX_LINES_PER_ZONE; li++) {
      dst.lines[li].text = src.lines[li].text;
      dst.lines[li].color = _matrix ? _matrix->color565(src.lines[li].r, src.lines[li].g, src.lines[li].b) : 0xF800;
      dst.lines[li].effect = src.lines[li].effect;

      int zoneW = (src.panelEnd - src.panelStart + 1) * WF2_PANEL_W;
      int scale = (src.lineCount == 2) ? 1 : 2;
      int tw = textWidth5x7Scaled(src.lines[li].text.c_str(), scale);
      if (tw > zoneW || src.lines[li].effect == "SCROLL") {
        dst.lines[li].scrollX = zoneW;
      } else {
        dst.lines[li].scrollX = 0;
      }
      dst.lines[li].scrollLastTick = millis();
    }
  }

  redraw();
}

void Hub75Driver::runDiagnosticSequence() {
  if (!_matrix) return;
  uint16_t red = _matrix->color565(255, 0, 0);
  uint16_t green = _matrix->color565(0, 255, 0);
  uint16_t blue = _matrix->color565(0, 0, 255);
  uint16_t white = _matrix->color565(255, 255, 255);
  _matrix->fillScreen(red);   delay(800);
  _matrix->fillScreen(green); delay(800);
  _matrix->fillScreen(blue);  delay(800);
  _matrix->fillScreen(white); delay(800);
  _matrix->clearScreen();
  for (int x = 0; x < WF2_RES_X; x++) {
    drawPixelMapped(x, 0, white);
    drawPixelMapped(x, WF2_RES_Y - 1, white);
  }
  for (int y = 0; y < WF2_RES_Y; y++) {
    drawPixelMapped(0, y, white);
    drawPixelMapped(WF2_RES_X - 1, y, white);
  }
  for (int i = 0; i < WF2_RES_Y; i++) {
    drawPixelMapped(i, i, red);
    drawPixelMapped(WF2_RES_X - 1 - i, i, blue);
  }
  delay(1500);
  redraw();
}

void Hub75Driver::update() {
  if (!_matrix) return;
  bool needsRedraw = false;
  unsigned long now = millis();

  // Per-zone per-line scroll update
  for (int zi = 0; zi < _zoneCount; zi++) {
    ZoneState& z = _zones[zi];
    if (!z.hasData) continue;
    int zoneW = (z.panelEnd - z.panelStart + 1) * WF2_PANEL_W;

    for (int li = 0; li < z.lineCount; li++) {
      auto& line = z.lines[li];
      if (line.effect != "SCROLL") continue;
      if (line.text.length() == 0) continue;

      int scale = (z.lineCount == 2) ? 1 : 2;
      int tw = textWidth5x7Scaled(line.text.c_str(), scale);
      if (tw <= zoneW) continue;

      if (now - line.scrollLastTick >= _scrollTickMs) {
        line.scrollLastTick = now;
        line.scrollX -= 1;
        if (line.scrollX + tw <= 0) line.scrollX = zoneW + SCROLL_WRAP_PAD;
        needsRedraw = true;
      }
    }
  }

  // Timer update
  if (_timerRemainingAtBaseMs > 0 && now - _lastTimerRedraw >= 500) {
    _lastTimerRedraw = now;
    needsRedraw = true;
  }

  if (needsRedraw) redraw();
}

String Hub75Driver::substituteTimer(const String& text) const {
  if (_timerRemainingAtBaseMs == 0) return text;
  unsigned long now = millis();
  long remainingMs = (long)_timerRemainingAtBaseMs - (long)(now - _timerBaseMs);
  if (remainingMs < 0) remainingMs = 0;
  String result = text;
  if (result.indexOf("{timer}") >= 0) {
    int totalSec = (int)(remainingMs / 1000);
    int min = totalSec / 60;
    int sec = totalSec % 60;
    char buf[8];
    snprintf(buf, sizeof(buf), "%d:%02d", min, sec);
    result.replace("{timer}", buf);
  }
  if (result.indexOf("{elapsed}") >= 0) {
    long elapsedMs = (long)_timerTotalMs - remainingMs;
    if (elapsedMs < 0) elapsedMs = 0;
    int totalSec = (int)(elapsedMs / 1000);
    int min = totalSec / 60;
    int sec = totalSec % 60;
    char buf[8];
    snprintf(buf, sizeof(buf), "%d:%02d", min, sec);
    result.replace("{elapsed}", buf);
  }
  return result;
}

void Hub75Driver::redraw() {
  if (!_matrix) return;
  _matrix->clearScreen();

  for (int zi = 0; zi < _zoneCount; zi++) {
    ZoneState& z = _zones[zi];
    if (!z.hasData) continue;

    int zoneX = z.panelStart * WF2_PANEL_W;
    int zoneW = (z.panelEnd - z.panelStart + 1) * WF2_PANEL_W;
    int zoneXEnd = zoneX + zoneW;
    bool isTwoLine = (z.lineCount == 2);
    int scale = isTwoLine ? 1 : 2;
    int charH = CHAR_H * scale;

    for (int li = 0; li < z.lineCount; li++) {
      auto& line = z.lines[li];
      String display = substituteTimer(line.text);

      int y;
      if (isTwoLine) {
        y = (li == 0) ? 0 : 8;
      } else {
        y = 1;
      }

      bool overflows = textWidth5x7Scaled(display.c_str(), scale) > zoneW || line.effect == "SCROLL";
      int x;
      if (!overflows || line.effect == "STATIC") {
        int tw = textWidth5x7Scaled(display.c_str(), scale);
        x = zoneX + (zoneW - tw) / 2;
      } else {
        x = zoneX + line.scrollX;
      }

      drawText5x7Scaled(display.c_str(), x, y, line.color, scale, zoneX, zoneXEnd);
    }
  }

  _matrix->flipDMABuffer();
}

int Hub75Driver::textWidth5x7Scaled(const char* s, int scale) {
  int n = 0;
  for (const char* p = s; *p; p++) n++;
  return n > 0 ? (n * CHAR_W * scale) + ((n - 1) * SPACING * scale) : 0;
}

void Hub75Driver::drawText5x7Scaled(const char* s, int x, int y, uint16_t color, int scale, int clipXStart, int clipXEnd) {
  int cursor = x;
  for (const char* p = s; *p; p++) {
    int idx = glyphIndex(*p);
    if (idx >= 0 && idx < (int)FONT_SIZE) {
      const uint8_t* glyph = FONT5x7[idx];
      for (int row = 0; row < CHAR_H; row++) {
        uint8_t bits = glyph[row];
        for (int col = 0; col < CHAR_W; col++) {
          if (bits & (1 << (CHAR_W - 1 - col))) {
            for (int dy = 0; dy < scale; dy++) {
              for (int dx = 0; dx < scale; dx++) {
                int px = cursor + col * scale + dx;
                int py = y + row * scale + dy;
                if (px >= clipXStart && px < clipXEnd && py >= 0 && py < WF2_RES_Y) {
                  drawPixelMapped(px, py, color);
                }
              }
            }
          }
        }
      }
    }
    cursor += CELL_W * scale;
  }
}

void Hub75Driver::drawPixelMapped(int x, int y, uint16_t color) {
  if (x < 0 || x >= WF2_RES_X || y < 0 || y >= WF2_RES_Y) return;
  _matrix->drawPixel(x, y, color);
}

void Hub75Driver::paginateText(const String& text) {
  (void)text;
}

#endif
