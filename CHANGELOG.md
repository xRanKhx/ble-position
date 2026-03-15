# Changelog

## [2.11.30] – 2026-03-15

### Fixed
- **Posture detection: always "sitting"** – `stand_min` threshold raised from 1300mm to
  1500mm and `sit_min` from 650mm to 900mm (matching real body heights). Wall-mounted
  sensors without tilt angle now use speed-only heuristic and never report "lying"
  (no height information available at tilt ≈ 0°).
- **False fall alarm when lying in bed** – completely rewrote fall detection state machine:
  - Fall signature now requires prior movement (`prevSpeed > 0.3 m/s`) to distinguish
    a real fall from slowly lying down in bed
  - Removed independent "motionless" alarm that fired after `delay × 1.5 s` – this caused
    sleep to be reported as a fall emergency
  - `canDetectLying` guard: fall detection only activates when sensor can actually detect
    the lying posture (ceiling mount or wall mount with tilt ≥ 15°)
  - `stillSince` tracking removed from the normal phase

All notable changes to BLE Indoor Positioning are documented here.

## [2.11.29] – 2026-03-15

### 🔴 Critical Fix
- **Lovelace Resources: NEVER delete/create on startup** – previous versions called
  `async_delete_item` / `async_create_item` during `async_setup_entry`, which destroyed
  other custom dashboard cards (advanced-camera-card, bubble-card, etc.) due to a
  HACS race condition on startup and HA's live-iterator behaviour in `async_items()`.
  Resource management is now **read-only**: the integration only checks if its own
  URLs are present and logs a warning if not – it never touches any other resources.

### Fixed
- Version badge in card always showed `2.11.21` (sed used wrong quote style)
- SVG export button invisible when a floor plan background image was loaded
  (button was inside the `else` block, now always visible when rooms exist)

---

## [2.11.28] – 2026-03-15

### Added
- **Journey / Time-lapse** now captures full home state every 10 s:
  BLE devices, mmWave persons (with posture), lights (brightness + colour),
  doors/windows (open/closed state via HA entity), triggered alarms
- Journey sidebar shows snapshot summary and colour legend
- Timestamp overlay on every journey frame

### Fixed
- Multiple old JS versions loaded simultaneously (v2.11.18/20/23 all active at once)
  causing newest version to be ignored by `customElements.define()`

---

## [2.11.27] – 2026-03-14

### Added
- Journey snapshots extended to capture: mmWave persons, lights, doors, windows, alarms
- Ghost trails for mmWave persons in journey playback

---

## [2.11.26] – 2026-03-13

### Added
- **SVG Export** – export floor plan (rooms, zones, doors, windows) as Inkscape-compatible SVG

### Fixed
- Dashboard cards deleted on integration start (partial fix – completed in 2.11.29)
- SVG import: SweetHome3D files (embedded PNG) and pure vector SVGs now handled

---

## [2.11.25] – 2026-03-12

### Fixed
- `_options_listener` no longer calls `async_reload` (caused full HA Lovelace reload)
- Lovelace resource registration improved (only removes outdated versioned URLs)

---

## [2.11.24] – 2026-03-11

### Improved
- Posture detection completely rewritten for wall-mounted sensors
- Confidence weighting based on tilt angle
- Fallback posture is now "sitting" instead of "lying"

---

## [2.11.23] – 2026-03-10

### Added
- Mobile / iPhone 3D view optimised (portrait aspect ratio, reset button)
- Mobile HUD hint for touch gestures

---

## [2.11.22] – 2026-03-09

### Added
- Mount settings (wall/ceiling, height, tilt angle) directly in sensor editor

---

## [2.11.21] – 2026-03-08

### Fixed
- Zone display: zones now correctly looked up from `room.zones` with absolute coordinates
  (both frontend `_getMmwaveZoneForTarget` and backend `sensor.py _zone_for_point`)
