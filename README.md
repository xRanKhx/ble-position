# BLE Indoor Positioning

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![HA Version](https://img.shields.io/badge/Home%20Assistant-2024.1%2B-blue.svg)](https://www.home-assistant.io)
[![Version](https://img.shields.io/github/v/release/yourusername/ha-ble-positioning)](https://github.com/yourusername/ha-ble-positioning/releases)

Indoor positioning for Home Assistant using BLE RSSI fingerprinting and mmWave radar sensors.  
Includes a full-featured Lovelace card with 2D/3D floor plan, person detection, zones, lights, alarms and a journey time-lapse.

---

## Features

- **BLE Fingerprinting** – position persons/devices by Bluetooth signal strength (KNN algorithm)
- **mmWave Radar** – real-time person detection with posture recognition (standing / sitting / lying)
- **Interactive Floor Plan** – draw rooms, zones, doors, windows; import/export SVG
- **3D View** – three-dimensional rendering of your floor plan with person figures
- **Journey / Time-lapse** – full-state snapshots every 10 s: BLE devices, persons, lights, doors, alarms
- **Lights, Alarms, Energy** – overlay HA entities directly on the floor plan
- **Auto-Calibration** – automatic fingerprint collection during standstill periods

---

## Installation via HACS

### Method 1 – HACS Custom Repository (recommended)

1. Open **HACS → Integrations → ⋮ → Custom repositories**
2. Add `https://github.com/yourusername/ha-ble-positioning` as **Integration**
3. Search for **BLE Indoor Positioning** and install
4. Restart Home Assistant

### Method 2 – Manual

1. Download the latest `ble_positioning.zip` from [Releases](https://github.com/yourusername/ha-ble-positioning/releases)
2. Unpack into `/config/custom_components/ble_positioning/`
3. Restart Home Assistant

---

## Setup

1. Go to **Settings → Devices & Services → Add Integration**
2. Search for **BLE Indoor Positioning**
3. Enter floor name and dimensions (meters)
4. Add the **BLE Positioning** card to any dashboard

### Lovelace Card (Manual Dashboard)

```yaml
type: custom:ble-positioning-card
entry_id: YOUR_ENTRY_ID
```

> The entry ID is shown in the card itself after setup.

### Lovelace Resources

The integration copies JS files to `/config/www/ble_positioning/` on startup.  
If cards show "Custom element doesn't exist", add these resources manually in  
**Settings → Dashboards → Resources**:

| URL | Type |
|-----|------|
| `/local/ble_positioning/ble-positioning-card.js?v=VERSION` | JavaScript Module |
| `/local/ble_positioning/ble-positioning-tracker.js?v=VERSION` | JavaScript Module |
| `/local/ble_positioning/ble-positioning-view-card.js?v=VERSION` | JavaScript Module |

---

## Requirements

- Home Assistant 2024.1 or newer
- BLE scanners (ESPresense, Bermuda, etc.) **or** mmWave radar sensors (LD2410, LD2450, etc.)

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md)

---

## License

MIT License – see [LICENSE](LICENSE)
