import re

with open('web/src/lib/display/sports-caster.ts', 'r') as f:
    # Just kidding, this is the C++ file
    pass

with open('display-firmware/src/MqttDisplayClient.cpp', 'r') as f:
    content = f.read()

# Replace update loop logic
update_search = """  if (online) {
    unsigned long now = millis();
    if (now - _lastHeartbeat > 60000) {
      _lastHeartbeat = now;
      publishOnline();
    }
  }

  if (!_playlist.empty() && _wasOnline) {"""
update_replace = """  if (online) {
    unsigned long now = millis();
    if (now - _lastHeartbeat > 60000) {
      _lastHeartbeat = now;
      publishOnline();
    }
  }

  // --- TIME-BLOCKED PLAYLIST LOGIC ---
  if (!_blocks.empty() && _wasOnline) {
    long currentEpoch = _serverTime + ((millis() - _localTimeAtServerSync) / 1000);
    int newBlockIndex = -1;
    for (size_t i = 0; i < _blocks.size(); i++) {
      if (currentEpoch >= _blocks[i].startEpoch && currentEpoch < _blocks[i].endEpoch) {
        newBlockIndex = i;
        break;
      }
    }
    if (newBlockIndex == -1) {
      newBlockIndex = _blocks.size() - 1; // fallback to last block (idle)
    }

    if (newBlockIndex != _currentBlockIndex) {
      log_i("[mqtt] Transitioning to block index %d", newBlockIndex);
      _currentBlockIndex = newBlockIndex;
      _playlist = _blocks[newBlockIndex].pages;
      _currentPageIndex = 0;
      _lastPageChangeTime = millis();
      memset(_subpageIdx, 0, sizeof(_subpageIdx));
      memset(_lastSubChange, 0, sizeof(_lastSubChange));
      applyCurrentPage();

      // Reset Timer
      long remainingSec = _blocks[newBlockIndex].endEpoch - currentEpoch;
      if (remainingSec < 0) remainingSec = 0;
      long totalSec = _blocks[newBlockIndex].endEpoch - _blocks[newBlockIndex].startEpoch;
      
      // If it's the last block (Idle), don't show timer. (Or if total is extremely large)
      if (newBlockIndex < (int)_blocks.size() - 1 && totalSec < 86400) {
         _driver.setTimer(remainingSec * 1000, totalSec * 1000, millis());
      } else {
         _driver.setTimer(0, 1000, millis());
      }
    }
  }

  if (!_playlist.empty() && _wasOnline) {"""

content = content.replace(update_search, update_replace)

handle_search = """  JsonArray pages = doc["display"]["pages"];
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
      {
        SubPage sp;
        sp.text = msg;
        sp.color = doc["color"] | "#FFFFFF";
        sp.effect = doc["animation"] | "SCROLL";
        sp.align = "center";
        sp.scrollSpeed = 1.0f;
        sp.durationMs = 5000;
        p.zones[0].lines[0].subpages.push_back(sp);
      }
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
              ZoneLine& zl = z.lines[z.lineCount];
              
              JsonArray subpages = line["subpages"];
              if (!subpages.isNull()) {
                for (JsonVariant spv : subpages) {
                  SubPage sp;
                  sp.text = spv["text"].as<std::string>();
                  sp.color = spv["color"].as<std::string>();
                  sp.bgColor = spv["bgColor"].as<std::string>();
                  sp.effect = spv["effect"].as<std::string>();
                  sp.align = spv["align"].as<std::string>();
                  sp.scrollSpeed = spv["scrollSpeed"].as<float>();
                  sp.durationMs = spv["durationMs"].as<uint16_t>();
                  if (sp.durationMs == 0) sp.durationMs = 5000;
                  zl.subpages.push_back(sp);
                }
              } else {
                SubPage sp;
                sp.text = line["text"].as<std::string>();
                sp.color = line["color"].as<std::string>();
                sp.effect = line["effect"].as<std::string>();
                sp.align = line["align"].as<std::string>();
                sp.scrollSpeed = line["scrollSpeed"].as<float>();
                sp.durationMs = 5000;
                zl.subpages.push_back(sp);
              }
              zl.marginTop = line["marginTop"] | 0;
              zl.marginBottom = line["marginBottom"] | 2;
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
        {
          SubPage sp;
          sp.text = page["text"] | "";
          sp.color = page["color"] | "#FFFFFF";
          sp.effect = page["effect"] | "SCROLL";
          sp.align = "center";
          sp.scrollSpeed = 1.0f;
          sp.durationMs = 5000;
          z.lines[0].subpages.push_back(sp);
        }
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
  }"""

handle_replace = """  _blocks.clear();
  _currentBlockIndex = -1;
  _playlist.clear();
  _serverTime = doc["serverTime"] | 0;
  _localTimeAtServerSync = millis();

  JsonArray blocks = doc["blocks"];
  for (JsonObject blockObj : blocks) {
    DisplayBlock b;
    b.startEpoch = blockObj["startEpoch"] | 0;
    b.endEpoch = blockObj["endEpoch"] | 0;
    
    JsonArray pages = blockObj["pages"];
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
              ZoneLine& zl = z.lines[z.lineCount];
              
              JsonArray subpages = line["subpages"];
              if (!subpages.isNull()) {
                for (JsonVariant spv : subpages) {
                  SubPage sp;
                  sp.text = spv["text"].as<std::string>();
                  sp.color = spv["color"].as<std::string>();
                  sp.bgColor = spv["bgColor"].as<std::string>();
                  sp.effect = spv["effect"].as<std::string>();
                  sp.align = spv["align"].as<std::string>();
                  sp.scrollSpeed = spv["scrollSpeed"].as<float>();
                  sp.durationMs = spv["durationMs"].as<uint16_t>();
                  if (sp.durationMs == 0) sp.durationMs = 5000;
                  zl.subpages.push_back(sp);
                }
              } else {
                SubPage sp;
                sp.text = line["text"].as<std::string>();
                sp.color = line["color"].as<std::string>();
                sp.effect = line["effect"].as<std::string>();
                sp.align = line["align"].as<std::string>();
                sp.scrollSpeed = line["scrollSpeed"].as<float>();
                sp.durationMs = 5000;
                zl.subpages.push_back(sp);
              }
              zl.marginTop = line["marginTop"] | 0;
              zl.marginBottom = line["marginBottom"] | 2;
              z.lineCount++;
            }
          }
          p.zoneCount++;
        }
      }
      b.pages.push_back(p);
    }
    _blocks.push_back(b);
  }
"""
content = content.replace(handle_search, handle_replace)

with open('display-firmware/src/MqttDisplayClient.cpp', 'w') as f:
    f.write(content)
print("done")
