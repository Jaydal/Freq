# Display Discovery & Override — Design Spec

## Problem

LED displays subscribe to `courts/{courtId}/display`. If the court ID in NVS is stale or orphaned, there is no way to reach the display. There is also no way to push temporary content to a specific display independently of the queue.

## MQTT Topics

| Topic | Direction | Purpose |
|---|---|---|
| `freq/display/discover` | Web → All LEDs | Broadcast: web publishes `{}` to trigger discovery |
| `freq/display/discover/response` | LEDs → Web | Each online display responds with its identity |
| `freq/display/cmd/{mac}` | Web → 1 LED | Per-device commands: `SET_COURT_ID`, `OVERRIDE`, `CLEAR_OVERRIDE` |

These topics are fixed and do not depend on the court ID, so any display can be reached regardless of its NVS state.

## Firmware Changes

### New subscriptions (in addition to `courts/{courtId}/display`)

- `freq/display/discover` — broadcast discovery
- `freq/display/cmd/{mac}` — per-device commands (MAC address from `WiFi.macAddress()`, colon-separated uppercase)

### Message handling

**DISCOVER** (on `freq/display/discover`):
Publish to `freq/display/discover/response`:
```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "ip": "192.168.1.100",
  "courtId": "aeae4019-...",
  "rssi": -45,
  "heap": 180000,
  "overrideActive": false
}
```

**SET_COURT_ID** (on `freq/display/cmd/{mac}`):
```json
{
  "action": "SET_COURT_ID",
  "courtId": "new-court-id"
}
```
Same behavior as existing courtId field in display payload: save to NVS, delay 500ms, restart.

**OVERRIDE** (on `freq/display/cmd/{mac}`):
```json
{
  "action": "OVERRIDE",
  "display": {
    "pages": [
      {
        "durationSeconds": 10,
        "zones": [
          {
            "panelStart": 0,
            "panelEnd": 2,
            "lines": [
              { "text": "COURT CLOSED", "color": "#FF0000", "effect": "SCROLL" }
            ]
          }
        ]
      }
    ]
  }
}
```
Firmware stores the override pages in memory. `applyCurrentPage()` checks for override first; if present, rotates through override pages instead of normal playlist. Normal playlist continues to update in the background.

**CLEAR_OVERRIDE** (on `freq/display/cmd/{mac}`):
```json
{ "action": "CLEAR_OVERRIDE" }
```
Clears the in-memory override. Display resumes showing the normal playlist.

### Override state

- In-memory only (lost on reboot)
- `_overridePages: std::vector<DisplayPage>` — override pages when not empty
- `_overrideActive: bool` — tracks whether override is active (distinct from having pages, in case we need to transition)
- `_overridePageIndex: size_t` and `_overridePageChangeTime: unsigned long` for rotation

In `applyCurrentPage()`:
```
if (!_overridePages.empty()) {
    show override pages instead of normal playlist
    return
}
show normal playlist pages
```

### MAC address per-device topic

Compute once in `begin()`:
```cpp
_mac = WiFi.macAddress();
_mac.replace(":", "");
```
Use lowercase for the topic to match MQTT conventions: `freq/display/cmd/aabbccddeeff`.

## Web MQTT Changes (mqtt.ts)

### New MQTT subscription

Add `freq/display/discover/response` to the existing subscribe list in `MqttClient.init()`.

### New functions

```typescript
// Collects discovery responses for `timeoutMs` ms.
// Returns aggregated map keyed by MAC.
async function collectDiscoveryResponses(timeoutMs = 3000): Promise<Map<string, DisplayInfo>>

// Publishes a command to a specific display
function publishCommand(mac: string, command: Record<string, unknown>): void
```

DisplayInfo type:
```typescript
interface DisplayInfo {
  mac: string;
  ip: string;
  courtId: string;
  rssi: number;
  heap: number;
  overrideActive: boolean;
  lastSeen: number;
}
```

### Response collector

When `publishDiscover()` is called:
1. Clear the internal `_discoveryResponses` map
2. Subscribe (if not already) to `freq/display/discover/response`
3. Publish `{}` to `freq/display/discover`
4. Each incoming response updates `_discoveryResponses[mac]`
5. After `timeoutMs`, resolve with the collected map
6. Collect only while discovery is active — avoid stale responses from previous discoveries bleeding in. Use a generation counter or clear the map at start.

## Web API Endpoints

### `POST /api/display/discover`

Publishes a discovery request, waits 3 seconds, returns all responses.

Response:
```json
{
  "displays": [
    {
      "mac": "aabbccddeeff",
      "ip": "192.168.1.100",
      "courtId": "aeae4019-...",
      "rssi": -45,
      "heap": 180000,
      "overrideActive": false,
      "lastSeen": 1700000000000
    }
  ]
}
```

### `POST /api/display/command`

Request:
```json
{
  "mac": "aabbccddeeff",
  "action": "OVERRIDE",
  "display": { "pages": [...] }
}
```

Publishes to `freq/display/cmd/{mac}`. Returns `{ "ok": true }`.

## Web UI: `/leds` Page

Route: `/leds` in the dashboard layout.

### Page state

- `displays: DisplayInfo[]` — populated on mount via discover endpoint
- `loading: boolean` — during discovery
- `selectedDisplay: DisplayInfo | null` — for override modal
- `courts: {id: string, name: string}[]` — for court ID reassign dropdown

### Table layout

| MAC | IP | Court ID | RSSI | Override | Actions |
|---|---|---|---|---|---|
| `aabbccddeeff` | `192.168.1.100` | Court 1 (dropdown) | -45 dBm | Active | [Override] [Clear] |
| `112233445566` | `192.168.1.101` | Court 2 (dropdown) | -60 dBm | — | [Override] |

### Court ID change

Dropdown per row populated with all courts from Supabase. On selection change:
1. Confirm dialog: "Reassign display to {courtName}? Display will reboot."
2. Calls `POST /api/display/command` with `SET_COURT_ID`
3. Display disappears from table after reboot

### Override modal

Opened via [Override] button. Contains:
- **Page editor**: simplified version of the zone-based editor:
  - Add/remove pages
  - Per page: duration, zones with text/color/effect per line
  - Same zone layout templates as DisplaySequenceEditorV2
- **Send button**: POSTs to `/api/display/command` with `OVERRIDE` action
- **Clear Override button**: POSTs to `/api/display/command` with `CLEAR_OVERRIDE`

### Refresh

Manual refresh button that re-runs discovery. Auto-refresh on page mount.

## Edge Cases

- **No displays respond**: Show empty table with "No displays found" message and retry button.
- **Display reboots after SET_COURT_ID**: It disappears from the current discovery table. On next refresh it appears with the new court ID (or not at all if offline).
- **Override while override is active**: Last override wins — the new pages replace the old ones.
- **Override on reboot**: Lost. Display resumes normal operation with the latest retained MQTT payload.
- **Concurrent discoveries**: Use a generation counter to prevent stale responses from a previous discovery polluting the current one.
