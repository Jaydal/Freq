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

static bool isBorderRow(int y, uint8_t borderCount, const BorderRange* borderRanges) {
  if (borderCount > 4) borderCount = 4;
  for (uint8_t i = 0; i < borderCount; i++) {
    if (y >= borderRanges[i].start && y <= borderRanges[i].end) return true;
  }
  return false;
}

Hub75Driver::Hub75Driver()
  : _matrix(nullptr), _defaultColor(0xF800), _scrollTickMs(45), _animMode("scroll"),
    _zoneCount(0), _fallbackScrollX(0), _fallbackScrollTick(0)
{
  for (int i = 0; i < MAX_ZONES; i++) {
    _zones[i].hasData = false;
    _zones[i].scale = 0;
    _zones[i].valign = "";
    _zones[i].borderCount = 0;
  }
}

void Hub75Driver::begin() {
  HUB75_I2S_CFG cfg(WF2_PANEL_W, WF2_PANEL_H, WF2_CHAIN, WF2_PINS);
  cfg.i2sspeed       = HUB75_I2S_CFG::HZ_10M;
  cfg.latch_blanking = 4;
  cfg.double_buff    = true;
  _matrix = new MatrixPanel_I2S_DMA(cfg);
  bool ok = _matrix->begin();
  log_i("[HUB75/WF2] begin: %s  geometry=%dx%d chain=%d",
                ok ? "OK" : "FAILED", WF2_PANEL_W, WF2_PANEL_H, WF2_CHAIN);
  if (!ok) { delete _matrix; _matrix = nullptr; return; }
  _matrix->setBrightness8(153);
  uint16_t green = _matrix->color565(0, 255, 0);
  _matrix->fillScreen(green);
  _matrix->flipDMABuffer();
  delay(500);
  _ballX = WF2_RES_X / 2 - 1;
  _ballY = WF2_RES_Y / 2 - 1;
  _ballDx = 1;
  _ballDy = 1;
  _splashStartTime = millis();
  _ballLastMove = _splashStartTime;
  _splashActive = true;
  _splashStaticDrawn = false;
  _matrix->clearScreen();
  _matrix->flipDMABuffer();
}

void Hub75Driver::clear() {
  _splashActive = false;
  _zoneCount = 0;
  for (int i = 0; i < MAX_ZONES; i++) _zones[i].hasData = false;
  _fallbackText = "";
  _fallbackScrollX = 0;
  if (_matrix) _matrix->clearScreen();
}

void Hub75Driver::showRow(uint8_t row, const char* text) {
  _splashActive = false;
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
  z.borderCount = 0;
  z.scale = 0;
  z.valign = "middle";
  z.lines[0].text = text;
  z.lines[0].color = _defaultColor;
  z.lines[0].effect = (_animMode == "scroll") ? "SCROLL" : _animMode;
  z.lines[0].align = "center";
  z.lines[0].scrollX = (w > WF2_RES_X) ? WF2_RES_X : 0;
  z.lines[0].scrollLastTick = millis();
  z.lines[0].scrollSpeed = 1;
  z.lines[0].marginTop = 0;
  z.lines[0].marginBottom = 2;
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
  _splashActive = false;
  if (count > MAX_ZONES) count = MAX_ZONES;
  _zoneCount = count;

  for (int zi = 0; zi < count; zi++) {
    ZoneState& dst = _zones[zi];
    const ZoneRenderInfo& src = zones[zi];
    dst.panelStart = src.panelStart;
    dst.panelEnd = src.panelEnd;
    dst.lineCount = src.lineCount;
    dst.hasData = true;
    dst.borderCount = src.borderCount;
    for (uint8_t bi = 0; bi < src.borderCount && bi < MAX_BORDER_RANGES; bi++) {
      dst.borderRanges[bi] = src.borderRanges[bi];
    }
    dst.scale = src.scale;
    dst.valign = src.valign;

    for (int li = 0; li < src.lineCount && li < MAX_LINES_PER_ZONE; li++) {
      dst.lines[li].text = src.lines[li].text;
      dst.lines[li].color = _matrix ? _matrix->color565(src.lines[li].r, src.lines[li].g, src.lines[li].b) : 0xF800;
      dst.lines[li].effect = src.lines[li].effect;
      dst.lines[li].align = src.lines[li].align;
      dst.lines[li].scrollSpeed = src.lines[li].scrollSpeed;
      dst.lines[li].marginTop = src.lines[li].marginTop;
      dst.lines[li].marginBottom = src.lines[li].marginBottom;
      dst.lines[li].hasBgColor = src.lines[li].hasBgColor;
      dst.lines[li].bgR = src.lines[li].bgR;
      dst.lines[li].bgG = src.lines[li].bgG;
      dst.lines[li].bgB = src.lines[li].bgB;

      int zoneW = (src.panelEnd - src.panelStart + 1) * WF2_PANEL_W;
      int s;
      if (dst.scale > 0) {
        s = dst.scale;
      } else if (src.lineCount == 2) {
        int tw2x = textWidth5x7Scaled(src.lines[li].text.c_str(), 2);
        s = (tw2x <= zoneW) ? 2 : 1;
      } else {
        s = 2;
      }
      int tw = textWidth5x7Scaled(src.lines[li].text.c_str(), s);
      dst.lines[li].scrollX = (tw > zoneW && src.lines[li].effect == "SCROLL") ? zoneW : 0;
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
  if (!_matrix || _otaActive) return;

  if (_splashActive) {
    unsigned long now = millis();
    if (now - _splashStartTime >= SPLASH_DURATION_MS) {
      if (!_splashStaticDrawn) { redraw(); _splashStaticDrawn = true; }
      return;
    }
    if (now - _ballLastMove >= 60) {
      _ballLastMove = now;
      _ballX += _ballDx;
      _ballY += _ballDy;
      if (_ballX <= 0 || _ballX >= WF2_RES_X - BALL_SIZE) {
        _ballDx = -_ballDx;
        _ballX += _ballDx;
      }
      if (_ballY <= 0 || _ballY >= WF2_RES_Y - BALL_SIZE) {
        _ballDy = -_ballDy;
        _ballY += _ballDy;
      }
      redraw();
    }
    return;
  }

  bool needsRedraw = false;
  unsigned long now = millis();

  // Per-zone per-line scroll update
  for (int zi = 0; zi < _zoneCount; zi++) {
    ZoneState& z = _zones[zi];
    if (!z.hasData) continue;
    int zoneW = (z.panelEnd - z.panelStart + 1) * WF2_PANEL_W;

    for (int li = 0; li < z.lineCount; li++) {
      auto& line = z.lines[li];
      if (line.text.length() == 0) continue;

      int scale = z.scale > 0 ? z.scale : ((z.lineCount == 2) ? 1 : 2);

      if (line.effect == "SCROLL") {
        int tw = textWidth5x7Scaled(line.text.c_str(), scale);
        if (tw <= zoneW) continue;
        float speed = line.scrollSpeed > 0.0f ? line.scrollSpeed : 1.0f;
        if (now - line.scrollLastTick >= (unsigned long)(_scrollTickMs / speed)) {
          line.scrollLastTick = now;
          line.scrollX -= 1;
          if (line.scrollX + tw <= 0) line.scrollX = zoneW + SCROLL_WRAP_PAD;
          needsRedraw = true;
        }
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
  if (!_matrix || _otaActive) return;

  if (_splashActive) {
    _matrix->clearScreen();
    uint16_t green = _matrix->color565(0, 255, 0);
    if (millis() - _splashStartTime < SPLASH_DURATION_MS) {
      for (int dy = 0; dy < BALL_SIZE; dy++)
        for (int dx = 0; dx < BALL_SIZE; dx++)
          drawPixelMapped(_ballX + dx, _ballY + dy, green);
    } else {
      int tw = textWidth5x7Scaled("FREQ", 2);
      int x = (WF2_RES_X - tw) / 2;
      int y = (WF2_RES_Y - CHAR_H * 2) / 2;
      drawText5x7Scaled("FREQ", x, y, green, 2, 0, WF2_RES_X);
    }
    _matrix->flipDMABuffer();
    return;
  }

  _matrix->clearScreen();

  for (int zi = 0; zi < _zoneCount; zi++) {
    ZoneState& z = _zones[zi];
    if (!z.hasData) continue;

    int zoneX = z.panelStart * WF2_PANEL_W;
    int zoneW = (z.panelEnd - z.panelStart + 1) * WF2_PANEL_W;
    int zoneXEnd = zoneX + zoneW;

    // Compute available vertical range (excluding border rows)
    int availTop = 0;
    int availBottom = WF2_RES_Y - 1;
    if (z.borderCount > 0) {
      for (int y = 0; y < WF2_RES_Y; y++) {
        if (!isBorderRow(y, z.borderCount, z.borderRanges)) { availTop = y; break; }
      }
      for (int y = WF2_RES_Y - 1; y >= 0; y--) {
        if (!isBorderRow(y, z.borderCount, z.borderRanges)) { availBottom = y; break; }
      }
    }
    int availH = availBottom - availTop + 1;

    // Compute scale per line
    int scales[MAX_LINES_PER_ZONE];
    int totalTextH = 0;
    for (int li = 0; li < z.lineCount; li++) {
      auto& ln = z.lines[li];
      if (z.scale > 0) {
        scales[li] = z.scale;
      } else if (z.lineCount == 2) {
        scales[li] = 1;
      } else if (ln.effect == "SCROLL") {
        scales[li] = 2;
      } else {
        int tw2x = textWidth5x7Scaled(ln.text.c_str(), 2);
        scales[li] = (tw2x <= zoneW) ? 2 : 1;
      }
      int mt = (ln.marginTop > 0 || li > 0) ? (int)ln.marginTop : 0;
      int mb = (li < z.lineCount - 1) ? (int)ln.marginBottom : 0;
      totalTextH += mt + CHAR_H * scales[li] + mb;
    }

    // Compute Y offset for each line based on valign
    int lineY[MAX_LINES_PER_ZONE];
    int yo;
    if (availH <= totalTextH) {
      yo = availTop;
    } else if (z.valign == "top") {
      yo = availTop;
    } else if (z.valign == "bottom") {
      yo = availBottom - totalTextH + 1;
    } else {
      yo = availTop + (availH - totalTextH) / 2;
    }
    for (int li = 0; li < z.lineCount; li++) {
      auto& ln = z.lines[li];
      int mt = (ln.marginTop > 0 || li > 0) ? (int)ln.marginTop : 0;
      yo += mt;
      lineY[li] = yo;
      yo += CHAR_H * scales[li] + ((li < z.lineCount - 1) ? (int)ln.marginBottom : 0);
    }

    for (int li = 0; li < z.lineCount; li++) {
      auto& line = z.lines[li];
      String display = substituteTimer(line.text);
      int scale = scales[li];

      int x;
      String align = line.align;
      if (align.length() == 0) align = "center";

      bool overflows = (line.effect == "SCROLL" && textWidth5x7Scaled(display.c_str(), scale) > zoneW);
      if (overflows) {
        x = zoneX + line.scrollX;
      } else if (align == "left") {
        x = zoneX;
      } else if (align == "right") {
        int tw = textWidth5x7Scaled(display.c_str(), scale);
        x = zoneX + zoneW - tw;
      } else {
        int tw = textWidth5x7Scaled(display.c_str(), scale);
        x = zoneX + (zoneW - tw) / 2;
      }

      if (line.hasBgColor) {
        uint16_t bgCol = _matrix->color565(line.bgR, line.bgG, line.bgB);
        int textW = textWidth5x7Scaled(display.c_str(), scale);
        int bgY = lineY[li];
        int bgH = CHAR_H * scale;
        int bgX;
        if (overflows) {
          bgX = x;
        } else if (align == "left") {
          bgX = zoneX;
        } else if (align == "right") {
          bgX = zoneX + zoneW - textW;
        } else {
          bgX = zoneX + (zoneW - textW) / 2;
        }
        for (int dy = 0; dy < bgH; dy++) {
          for (int dx = 0; dx < textW; dx++) {
            int px = bgX + dx;
            int py = bgY + dy;
            bool isBorder = false;
            for (uint8_t i = 0; i < z.borderCount; i++) {
              if (py >= z.borderRanges[i].start && py <= z.borderRanges[i].end) {
                isBorder = true;
                break;
              }
            }
            if (isBorder) continue;
            if (px >= zoneX && px < zoneXEnd && py >= 0 && py < WF2_RES_Y) {
              drawPixelMapped(px, py, bgCol);
            }
          }
        }
      }

      drawText5x7Scaled(display.c_str(), x, lineY[li], line.color, scale, zoneX, zoneXEnd, z.borderCount, z.borderRanges);
    }
  }

  _matrix->flipDMABuffer();
}

int Hub75Driver::textWidth5x7Scaled(const char* s, int scale) {
  int w = 0;
  bool first = true;
  for (const char* p = s; *p; p++) {
    if (!first) w += SPACING * scale;
    w += (*p == ' ') ? 0 : CHAR_W * scale;
    first = false;
  }
  return w;
}

void Hub75Driver::drawText5x7Scaled(const char* s, int x, int y, uint16_t color, int scale, int clipXStart, int clipXEnd, uint8_t borderCount, const BorderRange* borderRanges) {
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
                
                bool isBorder = false;
                for (uint8_t i = 0; i < borderCount; i++) {
                  if (py >= borderRanges[i].start && py <= borderRanges[i].end) {
                    isBorder = true;
                    break;
                  }
                }
                
                if (isBorder) continue;
                if (px >= clipXStart && px < clipXEnd && py >= 0 && py < WF2_RES_Y) {
                  drawPixelMapped(px, py, color);
                }
              }
            }
          }
        }
      }
    }
    cursor += (*p == ' ') ? 0 : CELL_W * scale;
  }
}

void Hub75Driver::drawPixelMapped(int x, int y, uint16_t color) {
  if (x < 0 || x >= WF2_RES_X || y < 0 || y >= WF2_RES_Y) return;
  _matrix->drawPixel(x, y, color);
}

#endif
