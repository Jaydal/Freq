#if defined(USE_HUB75) && defined(HD_WF2)
#include "Hub75Driver.h"

// ── WF2 pin map (from mrcodetastic/HD-WF1-WF2-LED-MatrixPanel-DMA) ────────────
// 75EX1 connector only. WF2 is ESP32-S3 with HUB75 + battery-backed RTC.
static constexpr HUB75_I2S_CFG::i2s_pins WF2_PINS = {
  .r1 =  2, .g1 =  6, .b1 = 10,
  .r2 =  3, .g2 =  7, .b2 = 11,
  .a  = 39, .b  = 38, .c  = 37, .d  = 36, .e  = 21,
  .lat = 33, .oe  = 35, .clk = 34
};

#define WF2_PANEL_W  32
#define WF2_PANEL_H  16
#define WF2_CHAIN    2          // 2× P10 panels horizontal → 64×16
#define WF2_RES_X    (WF2_PANEL_W * WF2_CHAIN)   // 64
#define WF2_RES_Y    WF2_PANEL_H                  // 16

// ── Layout — matches web/src/components/display/P10Display.tsx (horizontal) ──
// 1 visible row of scaled 5x7 font (10x14), centered vertically at y=1
static const int16_t ROW_Y[1] = { 1 };

#define SCROLL_WRAP_PAD 4          // gap before text wraps back in from the right

// ── 5x7 bitmap font — bit-identical to P10Display.tsx FONT table ─────────────
// Each glyph = 7 rows, 5 bits each, MSB-first (matches `rows[row] & (1 << (5-1-col))`).
// Index order: A-Z, 0-9, space, '-', '.', ':', '/', nbsp
static const uint8_t FONT5x7[][7] = {
  // A-Z
  {0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001}, // A
  {0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110}, // B
  {0b01110,0b10001,0b10000,0b10000,0b10000,0b10001,0b01110}, // C
  {0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110}, // D
  {0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111}, // E
  {0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000}, // F
  {0b01110,0b10001,0b10000,0b10111,0b10001,0b10001,0b01110}, // G
  {0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001}, // H
  {0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110}, // I
  {0b00111,0b00010,0b00010,0b00010,0b00010,0b10010,0b01100}, // J
  {0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001}, // K
  {0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111}, // L
  {0b10001,0b11011,0b10101,0b10101,0b10001,0b10001,0b10001}, // M
  {0b10001,0b10001,0b11001,0b10101,0b10011,0b10001,0b10001}, // N
  {0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110}, // O
  {0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000}, // P
  {0b01110,0b10001,0b10001,0b10001,0b10101,0b10010,0b01101}, // Q
  {0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001}, // R
  {0b01110,0b10001,0b10000,0b01110,0b00001,0b10001,0b01110}, // S
  {0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100}, // T
  {0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110}, // U
  {0b10001,0b10001,0b10001,0b10001,0b10001,0b01010,0b00100}, // V
  {0b10001,0b10001,0b10001,0b10101,0b10101,0b11011,0b10001}, // W
  {0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001}, // X
  {0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100}, // Y
  {0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111}, // Z
  // 0-9
  {0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110}, // 0
  {0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110}, // 1
  {0b01110,0b10001,0b00001,0b00010,0b00100,0b01000,0b11111}, // 2
  {0b01110,0b10001,0b00001,0b00110,0b00001,0b10001,0b01110}, // 3
  {0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010}, // 4
  {0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110}, // 5
  {0b01110,0b10000,0b10000,0b11110,0b10001,0b10001,0b01110}, // 6
  {0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000}, // 7
  {0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110}, // 8
  {0b01110,0b10001,0b10001,0b01111,0b00001,0b00001,0b01110}, // 9
  // punctuation
  {0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00000}, // space
  {0b00000,0b00000,0b00000,0b11111,0b00000,0b00000,0b00000}, // '-'
  {0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00100}, // '.'
  {0b00000,0b00100,0b00000,0b00000,0b00000,0b00100,0b00000}, // ':'
  {0b00001,0b00010,0b00010,0b00100,0b01000,0b01000,0b10000}, // '/'
  {0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00000}, // nbsp (same as space)
};

#define CHAR_W    5
#define CHAR_H    7
#define SPACING   1
#define CELL_W    (CHAR_W + SPACING)   // 6
#define FONT_SIZE (sizeof(FONT5x7) / sizeof(FONT5x7[0]))

// Map an ASCII char to a glyph index into FONT5x7. Returns -1 if unsupported.
static int glyphIndex(char c) {
  if (c >= 'A' && c <= 'Z') return c - 'A';
  if (c >= 'a' && c <= 'z') return c - 'a';   // lowercase → uppercase glyph
  if (c >= '0' && c <= '9') return 26 + (c - '0');
  if (c == ' ')  return 36;
  if (c == '-')  return 37;
  if (c == '.')  return 38;
  if (c == ':')  return 39;
  if (c == '/')  return 40;
  if (c == (char)0xA0) return 41;  // nbsp
  return -1;
}

// ── Hub75Driver ──────────────────────────────────────────────────────────────

Hub75Driver::Hub75Driver() : _matrix(nullptr), _color(0xF800), _scrollTickMs(45), _animMode("scroll"), _currentPage(0), _pageLastTick(0) {
  _lines[0] = "";
  _scrollX[0] = 0;
  _scrollLastTick[0] = 0;
}

void Hub75Driver::begin() {
  HUB75_I2S_CFG cfg(WF2_PANEL_W, WF2_PANEL_H, WF2_CHAIN, WF2_PINS);
  cfg.i2sspeed       = HUB75_I2S_CFG::HZ_10M;   // P10 RGB needs slower scan (10MHz is safest)
  cfg.latch_blanking = 4;                       // anti-ghosting on small panels
  cfg.double_buff    = true;                    // ENABLE DOUBLE BUFFERING to fix flicker
  // cfg.driver         = HUB75_I2S_CFG::FM6126A;  // (Commented out for this test)
  _matrix = new MatrixPanel_I2S_DMA(cfg);
  bool ok = _matrix->begin();
  Serial.printf("[HUB75/WF2] begin: %s  geometry=%dx%d chain=%d\n",
                ok ? "OK" : "FAILED", WF2_PANEL_W, WF2_PANEL_H, WF2_CHAIN);
  if (!ok) { delete _matrix; _matrix = nullptr; return; }
  _matrix->setBrightness8(153);   // 60% default brightness
  
  // Flash full solid red on boot for 2 seconds to prove panel is working
  uint16_t red = _matrix->color565(255, 0, 0);
  _matrix->fillScreen(red);
  delay(2000);
  _matrix->clearScreen();
}

void Hub75Driver::clear() {
  _lines[0] = "";
  _scrollX[0] = 0;
  if (_matrix) _matrix->clearScreen();
}

void Hub75Driver::showRow(uint8_t row, const char* text) {
  if (row >= 1 || !_matrix) return; // Only 1 row allowed now
  if (_lines[row] == text) return;
  _lines[row] = text;
  
  if (_animMode == "paginate") {
    paginateText(text);
    _currentPage = 0;
    _pageLastTick = millis();
  } else {
    int w = textWidth5x7Scaled(text, 2);
    _scrollX[row] = (w > WF2_RES_X) ? WF2_RES_X : 0;
    _scrollLastTick[row] = millis();
  }
  redraw();
}

void Hub75Driver::setBrightness(uint8_t b) {
  if (_matrix) _matrix->setBrightness8(b);
}

void Hub75Driver::setColorRGB(uint8_t r, uint8_t g, uint8_t b) {
  if (_matrix) {
    _color = _matrix->color565(r, g, b);
    redraw();
  }
}

void Hub75Driver::setScrollSpeed(uint16_t msPerPixel) {
  _scrollTickMs = msPerPixel;
}

void Hub75Driver::setAnimationMode(const char* mode) {
  String m = String(mode);
  if (_animMode == m) return;
  _animMode = m;
  
  if (_animMode == "paginate") {
    paginateText(_lines[0]);
    _currentPage = 0;
    _pageLastTick = millis();
  } else {
    int w = textWidth5x7Scaled(_lines[0].c_str(), 2);
    _scrollX[0] = (w > WF2_RES_X) ? WF2_RES_X : 0;
    _scrollLastTick[0] = millis();
  }
  redraw();
}

void Hub75Driver::runDiagnosticSequence() {
  if (!_matrix) return;
  
  uint16_t red = _matrix->color565(255, 0, 0);
  uint16_t green = _matrix->color565(0, 255, 0);
  uint16_t blue = _matrix->color565(0, 0, 255);
  uint16_t white = _matrix->color565(255, 255, 255);

  // 1. Solid colors to check for dead/stuck pixels
  _matrix->fillScreen(red);   delay(800);
  _matrix->fillScreen(green); delay(800);
  _matrix->fillScreen(blue);  delay(800);
  _matrix->fillScreen(white); delay(800);

  // 2. Alignment & Boundary check (box with an X)
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

  // 3. Restore to previous state
  redraw();
}

void Hub75Driver::update() {
  if (!_matrix) return;
  bool needsRedraw = false;
  unsigned long now = millis();

  if (_animMode == "paginate") {
    if (_pages.size() > 1) {
       if (now - _pageLastTick >= 1500) {
           _pageLastTick = now;
           _currentPage++;
           if (_currentPage >= _pages.size()) _currentPage = 0;
           needsRedraw = true;
       }
    }
  } else {
    if (_lines[0].length() && textWidth5x7Scaled(_lines[0].c_str(), 2) > WF2_RES_X) {
      if (now - _scrollLastTick[0] >= _scrollTickMs) {
        _scrollLastTick[0] = now;
        _scrollX[0] -= 1;
        int w = textWidth5x7Scaled(_lines[0].c_str(), 2);
        if (_scrollX[0] + w <= 0) _scrollX[0] = WF2_RES_X + SCROLL_WRAP_PAD;
        needsRedraw = true;
      }
    }
  }

  // Update live {timer} countdown at ~1 Hz even when text is static
  if (_timerRemainingAtBaseMs > 0 && now - _lastTimerRedraw >= 500) {
    _lastTimerRedraw = now;
    needsRedraw = true;
  }

  if (needsRedraw) redraw();
}

// ── Timer substitution ────────────────────────────────────────────────────────

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

// ── Canvas rendering ─────────────────────────────────────────────────────────

void Hub75Driver::redraw() {
  if (!_matrix) return;
  _matrix->clearScreen();

  if (_animMode == "paginate" && _pages.size() > 0) {
    if (_currentPage >= _pages.size()) _currentPage = 0;
    Page& p = _pages[_currentPage];
    
    String display1 = substituteTimer(p.text1);
    String display2 = substituteTimer(p.text2);

    if (p.scale == 2) {
       int w = textWidth5x7Scaled(display1.c_str(), 2);
       int x = (WF2_RES_X - w) / 2;
       drawText5x7Scaled(display1.c_str(), x, 1, _color, 2);
    } else {
       int w1 = textWidth5x7Scaled(display1.c_str(), 1);
       int x1 = (WF2_RES_X - w1) / 2;
       drawText5x7Scaled(display1.c_str(), x1, 0, _color, 1);
       if (display2.length() > 0) {
           int w2 = textWidth5x7Scaled(display2.c_str(), 1);
           int x2 = (WF2_RES_X - w2) / 2;
           drawText5x7Scaled(display2.c_str(), x2, 8, _color, 1);
       }
    }
  } else {
    if (!_lines[0].isEmpty()) {
      String display = substituteTimer(_lines[0]);
      int w = textWidth5x7Scaled(display.c_str(), 2);
      int x;
      if (w <= WF2_RES_X) {
        x = (WF2_RES_X - w) / 2;
      } else {
        x = _scrollX[0];
      }
      drawText5x7Scaled(display.c_str(), x, ROW_Y[0], _color, 2);
    }
  }
  
  // Swap the back buffer to the active DMA output to instantly show the new frame
  _matrix->flipDMABuffer();
}

int Hub75Driver::textWidth5x7Scaled(const char* s, int scale) {
  int n = 0;
  for (const char* p = s; *p; p++) n++;
  return n > 0 ? (n * CHAR_W * scale) + ((n - 1) * SPACING * scale) : 0;
}

void Hub75Driver::drawText5x7Scaled(const char* s, int x, int y, uint16_t color, int scale) {
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
                if (px >= 0 && px < WF2_RES_X && py >= 0 && py < WF2_RES_Y) {
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

void Hub75Driver::paginateText(const String& text) {
  _pages.clear();
  
  if (textWidth5x7Scaled(text.c_str(), 2) <= WF2_RES_X) {
     _pages.push_back({text, "", 2});
     return;
  }
  
  int idx = 0;
  while (idx < text.length()) {
    while(idx < text.length() && text[idx] == ' ') idx++;
    if (idx >= text.length()) break;
    
    int spaceIdx = text.indexOf(' ', idx);
    if (spaceIdx == -1) spaceIdx = text.length();
    String currentChunk = text.substring(idx, spaceIdx);
    idx = spaceIdx;
    
    while(idx < text.length()) {
        int nextSpaceIdx = text.indexOf(' ', idx + 1);
        if (nextSpaceIdx == -1) nextSpaceIdx = text.length();
        String nextWord = text.substring(idx + 1, nextSpaceIdx);
        if (nextWord.length() == 0) {
            idx++;
            continue;
        }
        String combined = currentChunk + " " + nextWord;
        if (textWidth5x7Scaled(combined.c_str(), 2) <= WF2_RES_X) {
           currentChunk = combined;
           idx = nextSpaceIdx;
        } else {
           break;
        }
    }
    
    if (textWidth5x7Scaled(currentChunk.c_str(), 2) <= WF2_RES_X) {
        _pages.push_back({currentChunk, "", 2});
    } else if (textWidth5x7Scaled(currentChunk.c_str(), 1) <= WF2_RES_X) {
        _pages.push_back({currentChunk, "", 1});
    } else {
        String l1 = currentChunk;
        String l2 = "";
        int c = 0;
        String temp = "";
        while(c < currentChunk.length()) {
            temp += currentChunk[c];
            if (textWidth5x7Scaled(temp.c_str(), 1) > WF2_RES_X) {
                temp = temp.substring(0, temp.length() - 1);
                break;
            }
            c++;
        }
        l1 = temp;
        l2 = currentChunk.substring(c);
        if (textWidth5x7Scaled(l2.c_str(), 1) > WF2_RES_X) {
            int c2 = 0;
            String t2 = "";
            while(c2 < l2.length()) {
               t2 += l2[c2];
               if (textWidth5x7Scaled(t2.c_str(), 1) > WF2_RES_X) {
                   t2 = t2.substring(0, t2.length() - 1);
                   break;
               }
               c2++;
            }
            l2 = t2;
        }
        _pages.push_back({l1, l2, 1});
    }
  }
}

void Hub75Driver::drawPixelMapped(int x, int y, uint16_t color) {
  if (x < 0 || x >= WF2_RES_X || y < 0 || y >= WF2_RES_Y) return;

  // Standard 1/8 scan straight-through mapping
  _matrix->drawPixel(x, y, color);
}

#endif // USE_HUB75 && HD_WF2