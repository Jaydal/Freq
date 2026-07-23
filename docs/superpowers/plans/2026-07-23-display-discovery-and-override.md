# Display Discovery & Override — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the web app to discover all physical LED displays and send per-device commands (change court ID, push override content).

**Architecture:** Firmware subscribes to two new MQTT topics independent of court ID (`freq/display/discover` and `freq/display/cmd/{mac}`). Web collects discovery responses and sends commands. UI at `/leds` shows a table of discovered displays with actions.

**Tech Stack:** ESP32-S3 (C++17, Arduino framework), Next.js App Router, MQTT.js, PubSubClient

---

## File Map

| File | Change | Responsibility |
|---|---|---|
| `display-firmware/src/MqttDisplayClient.h` | Modify | MAC field, override state, cmd topic buffer, new methods |
| `display-firmware/src/MqttDisplayClient.cpp` | Modify | DISCOVER/SET_COURT_ID/OVERRIDE/CLEAR_OVERRIDE handlers, override in applyCurrentPage |
| `web/src/lib/mqtt.ts` | Modify | `collectDiscoveryResponses()`, `publishCommand()`, `DisplayInfo` type, response subscription |
| `web/src/app/api/display/discover/route.ts` | Create | POST handler — discovers displays, collects responses |
| `web/src/app/api/display/command/route.ts` | Create | POST handler — sends command to a specific display |
| `web/src/app/(dashboard)/leds/page.tsx` | Create | Dashboard page with table + override modal |

---

### Task 1: Firmware MqttDisplayClient.h — Add MAC, override state, cmd topic

**Files:**
- Modify: `display-firmware/src/MqttDisplayClient.h`

- [ ] Add MAC string, cmd topic buffer, override state fields after `_wasOnline`:

```cpp
  String   _mac;
  char          _cmdTopic[50];
  bool          _overrideActive = false;
  std::vector<DisplayPage> _overridePages;
  size_t _overridePageIndex = 0;
  unsigned long _overridePageChangeTime = 0;
```

- [ ] Add the `_discoveryResponded` guard:

```cpp
  bool          _discoveryResponded = false;
```

- [ ] Add private method declarations inside the class:

```cpp
  void handleDiscover();
  void handleCmdMessage(uint8_t* payload, unsigned int len);
  String buildStatusPayload();
```

- [ ] **Commit**

```bash
git add display-firmware/src/MqttDisplayClient.h
git commit -m "feat(display): add MAC, override state, cmd topic fields to MqttDisplayClient.h"
```

---

### Task 2: Firmware MqttDisplayClient.cpp — DISCOVER + command topic handlers

**Files:**
- Modify: `display-firmware/src/MqttDisplayClient.cpp`

- [ ] In `begin()`, after `WiFi.macAddress()`, compute `_mac` and format the cmd topic:

```cpp
  _mac = WiFi.macAddress();
  _mac.toLowerCase();
  _mac.replace(":", "");
  snprintf(_cmdTopic, sizeof(_cmdTopic), "freq/display/cmd/%s", _mac.c_str());
```

- [ ] In `begin()`, add subscriptions after the existing `_mqtt.subscribe(_displayTopic)`:

```cpp
  _mqtt.subscribe("freq/display/discover");
  _mqtt.subscribe(_cmdTopic);
```

- [ ] Add `buildStatusPayload()` implementation:

```cpp
String MqttDisplayClient::buildStatusPayload() {
  JsonDocument doc;
  doc["mac"] = _mac;
  doc["ip"] = WiFi.localIP().toString();
  doc["courtId"] = _courtId;
  doc["rssi"] = WiFi.RSSI();
  doc["heap"] = ESP.getFreeHeap();
  doc["overrideActive"] = _overrideActive;
  String out;
  serializeJson(doc, out);
  return out;
}
```

- [ ] Add `handleDiscover()` implementation:

```cpp
void MqttDisplayClient::handleDiscover() {
  String payload = buildStatusPayload();
  _mqtt.publish("freq/display/discover/response", payload.c_str());
  log_i("[mqtt] Discover response sent: %s", payload.c_str());
}
```

- [ ] In `handleMessage()`, add routing after the existing brightness/scroll_speed/courtId parsing. Insert right after the courtId check block (before `JsonArray pages = doc["display"]["pages"]`):

```cpp
  const char* topic = _mqtt.messageTopic();
  if (topic && strcmp(topic, "freq/display/discover") == 0) {
    handleDiscover();
    return;
  }
  if (topic && strcmp(topic, _cmdTopic) == 0) {
    handleCmdMessage(payload, len);
    return;
  }
```

- [ ] Add `handleCmdMessage()` implementation:

```cpp
void MqttDisplayClient::handleCmdMessage(uint8_t* payload, unsigned int len) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, payload, len);
  if (error) {
    log_i("[mqtt-cmd] JSON parse failed: %s", error.c_str());
    return;
  }

  const char* action = doc["action"] | "";

  if (strcmp(action, "SET_COURT_ID") == 0) {
    const char* newId = doc["courtId"] | "";
    if (strlen(newId) > 0 && strcmp(newId, _courtId.c_str()) != 0) {
      log_i("[mqtt-cmd] SET_COURT_ID: '%s' -> '%s'", _courtId.c_str(), newId);
      if (_courtChangeCb) {
        _courtChangeCb(newId);
      }
    }
    return;
  }

  if (strcmp(action, "OVERRIDE") == 0) {
    _overridePages.clear();
    _overrideActive = false;
    JsonObject display = doc["display"];
    if (display.is<JsonObject>() && display["pages"].is<JsonArray>()) {
      for (JsonObject page : display["pages"].as<JsonArray>()) {
        DisplayPage p;
        p.durationSeconds = page["durationSeconds"] | 10;
        JsonArray zones = page["zones"];
        if (zones.is<JsonArray>()) {
          uint8_t zi = 0;
          for (JsonObject z : zones) {
            if (zi >= 3) break;
            DisplayZone& dz = p.zones[zi];
            dz.panelStart = z["panelStart"] | zi;
            dz.panelEnd = z["panelEnd"] | zi;
            dz.scale = z["scale"] | 0;
            dz.valign = z["valign"] | "middle";
            JsonArray lines = z["lines"];
            uint8_t li = 0;
            for (JsonObject l : lines) {
              if (li >= 2) break;
              dz.lines[li].text = l["text"] | "";
              dz.lines[li].color = l["color"] | "#FFFFFF";
              dz.lines[li].effect = l["effect"] | "SCROLL";
              dz.lines[li].align = l["align"] | "center";
              dz.lines[li].scrollSpeed = l["scrollSpeed"] | 1.0f;
              dz.lines[li].marginTop = l["marginTop"] | 0;
              dz.lines[li].marginBottom = l["marginBottom"] | 2;
              li++;
            }
            dz.lineCount = li;
            dz.borderCount = 0;
            zi++;
          }
          p.zoneCount = zi;
        } else {
          p.zoneCount = 1;
          p.zones[0].panelStart = 0;
          p.zones[0].panelEnd = 2;
          p.zones[0].lineCount = 1;
          p.zones[0].borderCount = 0;
          p.zones[0].scale = 0;
          p.zones[0].valign = "middle";
          p.zones[0].lines[0].text = doc["display"]["message"] | "OVERRIDE";
          p.zones[0].lines[0].color = "#FF0000";
          p.zones[0].lines[0].effect = "SCROLL";
          p.zones[0].lines[0].align = "center";
          p.zones[0].lines[0].scrollSpeed = 1.0f;
          p.zones[0].lines[0].marginTop = 0;
          p.zones[0].lines[0].marginBottom = 2;
        }
        _overridePages.push_back(p);
      }
      _overrideActive = true;
      _overridePageIndex = 0;
      _overridePageChangeTime = millis();
      log_i("[mqtt-cmd] OVERRIDE: %d pages", _overridePages.size());
    }
    return;
  }

  if (strcmp(action, "CLEAR_OVERRIDE") == 0) {
    _overridePages.clear();
    _overrideActive = false;
    _overridePageIndex = 0;
    _currentPageIndex = 0;
    _lastPageChangeTime = millis();
    log_i("[mqtt-cmd] CLEAR_OVERRIDE");
    if (!_playlist.empty()) {
      applyCurrentPage();
    }
    return;
  }
}
```

- [ ] Add `#include <ArduinoJson.h>` at the top if not already present (it should be via existing headers).

- [ ] **Commit**

```bash
git add display-firmware/src/MqttDisplayClient.cpp
git commit -m "feat(display): DISCOVER and command topic handlers in MqttDisplayClient"
```

---

### Task 3: Firmware MqttDisplayClient.cpp — Override logic in applyCurrentPage

**Files:**
- Modify: `display-firmware/src/MqttDisplayClient.cpp`

- [ ] Modify `applyCurrentPage()` to check override first. Replace the function body with:

```cpp
void MqttDisplayClient::applyCurrentPage() {
  if (_overrideActive && !_overridePages.empty()) {
    size_t idx = _overridePageIndex % _overridePages.size();
    const DisplayPage& page = _overridePages[idx];
    if (page.zoneCount == 0) {
      _driver.clearAll();
      return;
    }
    for (uint8_t i = 0; i < page.zoneCount; i++) {
      const DisplayZone& zone = page.zones[i];
      _driver.setZone(zone.panelStart, zone.panelEnd,
                      zone.lines[0].text, zone.lines[1].text,
                      zone.lines[0].color, zone.lines[1].color,
                      zone.lines[0].effect, zone.lines[1].effect,
                      zone.lines[0].align, zone.lines[1].align,
                      zone.lines[0].scrollSpeed, zone.lines[1].scrollSpeed,
                      zone.lines[0].marginTop, zone.lines[1].marginTop,
                      zone.lines[0].marginBottom, zone.lines[1].marginBottom,
                      zone.scale, zone.valign,
                      zone.borderRanges, zone.borderCount);
    }
    for (uint8_t i = page.zoneCount; i < 3; i++) {
      _driver.clearZone(i);
    }
    return;
  }

  // original playlist logic follows unchanged...
```

- [ ] In `update()`, add override page rotation alongside the existing playlist rotation. After the existing page-change block (where `_currentPageIndex` is incremented), add:

```cpp
  // Override page rotation
  if (_overrideActive && !_overridePages.empty() && !_playlist.empty()) {
    unsigned long now = millis();
    size_t oIdx = _overridePageIndex % _overridePages.size();
    unsigned long pageDuration = (unsigned long)(_overridePages[oIdx].durationSeconds * 1000);
    if (now - _overridePageChangeTime >= pageDuration) {
      _overridePageIndex++;
      _overridePageChangeTime = now;
      if (_overridePageIndex >= _overridePages.size()) {
        _overridePageIndex = 0;
      }
      applyCurrentPage();
    }
  }
```

- [ ] Add the function signature forward-declaration or ensure the definition exists. The method is already declared in the header from the existing codebase.

- [ ] **Commit**

```bash
git add display-firmware/src/MqttDisplayClient.cpp
git commit -m "feat(display): override page rotation and display in applyCurrentPage"
```

---

### Task 4: Firmware — Build and verify

**Files:**
- None (just run build)

- [ ] Build both environments:

```bash
pio run -e esp32-hub75-wf2 -e esp32-hub75-wf2-ota 2>&1 | tail -15
```

Expected: `SUCCESS` for both envs, no errors.

- [ ] **Commit**

```bash
git commit --allow-empty -m "chore: verify firmware builds with discovery and override"
```

---

### Task 5: Web mqtt.ts — DisplayInfo type, discovery collector, publishCommand

**Files:**
- Modify: `web/src/lib/mqtt.ts`

- [ ] Read the existing file first to understand structure, imports, and subscription patterns.

- [ ] Add `DisplayInfo` interface near the top alongside existing types:

```typescript
export interface DisplayInfo {
  mac: string;
  ip: string;
  courtId: string;
  rssi: number;
  heap: number;
  overrideActive: boolean;
  lastSeen: number;
}
```

- [ ] Add a `_discoveryResponses` map and generation counter inside the `MqttClient` class:

```typescript
private _discoveryResponses: Map<string, DisplayInfo> = new Map();
private _discoveryGeneration = 0;
```

- [ ] In the subscription setup (where the client subscribes to topics like `courts/+/display`), also subscribe to `freq/display/discover/response`:

```typescript
this.client.subscribe('freq/display/discover/response', { qos: 1 });
```

- [ ] In the message handler (where incoming MQTT messages are routed), add a handler for `freq/display/discover/response` topic. Parse the JSON and update `_discoveryResponses`:

```typescript
if (topic === 'freq/display/discover/response') {
  const data = JSON.parse(message.toString());
  const info: DisplayInfo = {
    mac: data.mac,
    ip: data.ip,
    courtId: data.courtId,
    rssi: data.rssi,
    heap: data.heap,
    overrideActive: data.overrideActive ?? false,
    lastSeen: Date.now(),
  };
  this._discoveryResponses.set(info.mac, info);
  return;
}
```

- [ ] Add `publishDiscover()` method:

```typescript
publishDiscover(): void {
  if (!this.client || !this.connected) return;
  this._discoveryGeneration++;
  this._discoveryResponses.clear();
  this.client.publish('freq/display/discover', '{}', { qos: 1 });
}
```

- [ ] Add `collectDiscoveryResponses()` method:

```typescript
async collectDiscoveryResponses(timeoutMs = 3000): Promise<DisplayInfo[]> {
  const gen = this._discoveryGeneration;
  this.publishDiscover();
  await new Promise(resolve => setTimeout(resolve, timeoutMs));
  // Only return responses from the current generation
  if (gen !== this._discoveryGeneration) return [];
  return Array.from(this._discoveryResponses.values());
}
```

- [ ] Add `publishCommand()` method:

```typescript
publishCommand(mac: string, command: Record<string, unknown>): void {
  if (!this.client || !this.connected) return;
  const topic = `freq/display/cmd/${mac}`;
  this.client.publish(topic, JSON.stringify(command), { qos: 1 });
}
```

- [ ] **Commit**

```bash
git add web/src/lib/mqtt.ts
git commit -m "feat(web): add DisplayInfo type, discovery collector, publishCommand to mqtt.ts"
```

---

### Task 6: Web API POST /api/display/discover

**Files:**
- Create: `web/src/app/api/display/discover/route.ts`

- [ ] Create the discover endpoint:

```typescript
import { NextResponse } from 'next/server';
import { getMqttClient } from '@/lib/mqtt';

export async function POST() {
  const client = getMqttClient();
  if (!client || !client.connected) {
    return NextResponse.json({ error: 'MQTT not connected' }, { status: 503 });
  }

  const displays = await client.collectDiscoveryResponses(3000);

  return NextResponse.json({ displays });
}
```

Note: `getMqttClient()` needs to exist. Check if there's already a way to access the MqttClient instance. If the current module exports a singleton or has a `getClient()` function, use that. If not, expose one:

```typescript
// At the bottom of mqtt.ts, add or verify:
let _instance: MqttClient | null = null;
export function getMqttClient(): MqttClient | null {
  return _instance;
}
// And set it in the constructor/init:
// _instance = this;
```

- [ ] **Commit**

```bash
git add web/src/app/api/display/discover/route.ts
git commit -m "feat(web): POST /api/display/discover endpoint"
```

---

### Task 7: Web API POST /api/display/command

**Files:**
- Create: `web/src/app/api/display/command/route.ts`

- [ ] Create the command endpoint:

```typescript
import { NextResponse } from 'next/server';
import { getMqttClient } from '@/lib/mqtt';

export async function POST(request: Request) {
  const client = getMqttClient();
  if (!client || !client.connected) {
    return NextResponse.json({ error: 'MQTT not connected' }, { status: 503 });
  }

  const { mac, action, courtId, display } = await request.json();
  if (!mac || !action) {
    return NextResponse.json({ error: 'mac and action are required' }, { status: 400 });
  }

  const command: Record<string, unknown> = { action };
  if (action === 'SET_COURT_ID') {
    if (!courtId) return NextResponse.json({ error: 'courtId required' }, { status: 400 });
    command.courtId = courtId;
  }
  if (action === 'OVERRIDE') {
    if (!display) return NextResponse.json({ error: 'display payload required' }, { status: 400 });
    command.display = display;
  }

  client.publishCommand(mac, command);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Commit**

```bash
git add web/src/app/api/display/command/route.ts
git commit -m "feat(web): POST /api/display/command endpoint"
```

---

### Task 8: Web UI — /leds dashboard page

**Files:**
- Create: `web/src/app/(dashboard)/leds/page.tsx`

- [ ] Check if there's a sidebar navigation config file (check `app/(dashboard)/layout.tsx` or similar) to add the `/leds` nav link.

- [ ] Create the page component. It should:

1. On mount, fetch courts list from Supabase and call `POST /api/display/discover`
2. Render a table with columns: MAC, IP, Court ID (dropdown), RSSI, Override status, Actions
3. Court ID dropdown triggers a confirmation dialog, then calls `POST /api/display/command`
4. Override button opens a modal with a page editor
5. Clear Override button calls `POST /api/display/command`
6. Refresh button re-runs discovery

Full implementation:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface DisplayInfo {
  mac: string;
  ip: string;
  courtId: string;
  rssi: number;
  heap: number;
  overrideActive: boolean;
  lastSeen: number;
}

interface CourtOption {
  id: string;
  name: string;
}

export default function LedsPage() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMac, setSelectedMac] = useState<string | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideText, setOverrideText] = useState('');
  const [overrideColor, setOverrideColor] = useState('#FF0000');

  const supabase = createClient();

  const discover = useCallback(async () => {
    setLoading(true);
    try {
      const [discoverRes, courtsRes] = await Promise.all([
        fetch('/api/display/discover', { method: 'POST' }),
        supabase.from('courts').select('id, name').order('name'),
      ]);
      if (courtsRes.data) setCourts(courtsRes.data);
      if (discoverRes.ok) {
        const data = await discoverRes.json();
        setDisplays(data.displays ?? []);
      }
    } catch (e) {
      console.error('Discover failed', e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { discover(); }, [discover]);

  async function handleCourtChange(mac: string, courtId: string) {
    const court = courts.find(c => c.id === courtId);
    if (!confirm(`Reassign display ${mac} to "${court?.name ?? courtId}"? Display will reboot.`)) return;
    await fetch('/api/display/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, action: 'SET_COURT_ID', courtId }),
    });
  }

  async function handleSendOverride() {
    if (!selectedMac) return;
    await fetch('/api/display/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mac: selectedMac,
        action: 'OVERRIDE',
        display: {
          pages: [{
            durationSeconds: 10,
            zones: [{
              panelStart: 0,
              panelEnd: 2,
              lines: [{ text: overrideText, color: overrideColor, effect: 'SCROLL' }],
            }],
          }],
        },
      }),
    });
    setShowOverrideModal(false);
    setTimeout(discover, 1000);
  }

  async function handleClearOverride(mac: string) {
    await fetch('/api/display/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac, action: 'CLEAR_OVERRIDE' }),
    });
    setTimeout(discover, 1000);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">LED Displays</h1>
        <button onClick={discover} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={loading}>
          {loading ? 'Discovering...' : 'Refresh'}
        </button>
      </div>

      {displays.length === 0 && !loading && (
        <p className="text-muted-foreground">No displays found. Make sure displays are online and try again.</p>
      )}

      {displays.length > 0 && (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              <th className="p-2">MAC</th>
              <th className="p-2">IP</th>
              <th className="p-2">Court ID</th>
              <th className="p-2">RSSI</th>
              <th className="p-2">Override</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displays.map(d => (
              <tr key={d.mac} className="border-b">
                <td className="p-2 font-mono text-sm">{d.mac}</td>
                <td className="p-2 font-mono text-sm">{d.ip}</td>
                <td className="p-2">
                  <select
                    value={d.courtId}
                    onChange={e => handleCourtChange(d.mac, e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">— Select —</option>
                    {courts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2 text-sm">{d.rssi} dBm</td>
                <td className="p-2 text-sm">{d.overrideActive ? 'Active' : '—'}</td>
                <td className="p-2 flex gap-2">
                  <button
                    onClick={() => { setSelectedMac(d.mac); setOverrideText(''); setOverrideColor('#FF0000'); setShowOverrideModal(true); }}
                    className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                  >
                    Override
                  </button>
                  {d.overrideActive && (
                    <button
                      onClick={() => handleClearOverride(d.mac)}
                      className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      Clear
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-xl w-[500px] space-y-4">
            <h2 className="text-xl font-bold">Override Display: {selectedMac}</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <input
                value={overrideText}
                onChange={e => setOverrideText(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Enter override text..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Color</label>
              <input
                type="color"
                value={overrideColor}
                onChange={e => setOverrideColor(e.target.value)}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowOverrideModal(false)} className="px-4 py-2 border rounded">
                Cancel
              </button>
              <button onClick={handleSendOverride} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
                Send Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] Update the dashboard sidebar/navigation to include a link to `/leds`. Check `app/(dashboard)/layout.tsx` or similar for the nav structure.

- [ ] **Commit**

```bash
git add web/src/app/\(dashboard\)/leds/page.tsx
git commit -m "feat(web): /leds dashboard page with display table and override modal"
```

---

### Task 9: Web — Build and verify tests

**Files:**
- None (just run build + tests)

- [ ] Build and test:

```bash
npm run build 2>&1 | tail -15
npx vitest run 2>&1 | tail -15
```

Expected: Build succeeds, all tests pass.

- [ ] **Commit**

```bash
git commit --allow-empty -m "chore: verify web build and tests for display discovery feature"
```
