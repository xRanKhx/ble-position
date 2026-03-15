"""Extended sensor platform for BLE Indoor Positioning.

New entities in v2.10.99:
  Per mmWave sensor × target (up to 3):
    sensor.<id>_target_N_class      – KI-Klasse (adult/child/pet/baby/unknown)
    sensor.<id>_target_N_posture    – Haltung (standing/sitting/lying/unknown)
    sensor.<id>_target_N_speed      – Geschwindigkeit m/s
    sensor.<id>_target_N_room       – Aktueller Raum
    sensor.<id>_presence_count      – Anzahl aktiver Targets

  Analytics (global per entry):
    sensor.<entry>_room_<name>_occupancy_today   – Minuten heute
    sensor.<entry>_sleep_<person>_duration       – Schlafdauer heute (min)
"""
from __future__ import annotations
import logging
from datetime import datetime

from homeassistant.components.sensor import SensorEntity, SensorStateClass, SensorDeviceClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from datetime import timedelta

from .const import (
    DOMAIN, NAME,
    CONF_DEVICES, CONF_DEVICE_ID, CONF_DEVICE_NAME,
    SIGNAL_FP_UPDATED, SIGNAL_CFG_UPDATED,
    SUFFIX_ROOM, SUFFIX_POS_X, SUFFIX_POS_Y,
    SUFFIX_CONFIDENCE, SUFFIX_FP_COUNT, SUFFIX_AC_TODAY, SUFFIX_STILL,
)
from .coordinator import BLEFloorCoordinator, DeviceTracker

_LOGGER = logging.getLogger(__name__)

SCAN_INTERVAL = timedelta(seconds=5)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: BLEFloorCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities: list[SensorEntity] = []

    # ── BLE Device Sensors (existing) ────────────────────────────────────────
    for device in entry.data.get(CONF_DEVICES, []):
        dev_id   = device[CONF_DEVICE_ID]
        tracker  = coordinator.trackers.get(dev_id)
        if tracker is None:
            continue
        dev_info = _ble_device_info(entry, device)
        entities += [
            BLERoomSensor      (coordinator, tracker, entry, dev_info),
            BLEPositionXSensor (coordinator, tracker, entry, dev_info),
            BLEPositionYSensor (coordinator, tracker, entry, dev_info),
            BLEConfidenceSensor(coordinator, tracker, entry, dev_info),
            BLEFPCountSensor   (coordinator, tracker, entry, dev_info),
            BLEAutoCalSensor   (coordinator, tracker, entry, dev_info),
            BLEStillSensor     (coordinator, tracker, entry, dev_info),
        ]

    # ── mmWave Sensors ────────────────────────────────────────────────────────
    floor_dev_info = _floor_device_info(entry)
    for sensor_cfg in coordinator.mmwave_sensors:
        s_id   = sensor_cfg.get("id", "")
        s_name = sensor_cfg.get("name", s_id)
        s_info = _mmwave_device_info(entry, sensor_cfg)

        # Presence count
        entities.append(MmwavePresenceCountSensor(coordinator, entry, sensor_cfg, s_info))

        # Per-target sensors (up to 3)
        for ti in range(1, 4):
            t_name = (sensor_cfg.get("target_names") or [f"Target {ti}"])[ti-1] if ti <= len(sensor_cfg.get("target_names") or []) else f"Target {ti}"
            entities += [
                MmwaveTargetClassSensor  (coordinator, entry, sensor_cfg, ti, t_name, s_info),
                MmwaveTargetPostureSensor(coordinator, entry, sensor_cfg, ti, t_name, s_info),
                MmwaveTargetSpeedSensor  (coordinator, entry, sensor_cfg, ti, t_name, s_info),
                MmwaveTargetRoomSensor   (coordinator, entry, sensor_cfg, ti, t_name, s_info),
            ]

    # ── Analytics Sensors (global) ────────────────────────────────────────────
    entities.append(BLEAnalyticsSensor(coordinator, entry, floor_dev_info))

    # ── mmWave Persons Device (global) ──────────────────────────────────────
    # Nur wenn mmWave-Sensoren konfiguriert sind
    if coordinator.mmwave_sensors:
        persons_dev_info = _mmwave_persons_device_info(entry)
        entities.append(MmwavePersonsCountSensor(coordinator, entry, persons_dev_info))
        # Bis zu 6 Personen-Slots
        for pidx in range(1, 7):
            entities.append(MmwavePersonNSensor(coordinator, entry, pidx, persons_dev_info))
        # Pro konfiguriertem Raum einen Belegungs-Sensor
        for room in coordinator.rooms:
            rname = room.get("name", "")
            if rname:
                entities.append(MmwaveRoomOccupancySensor(coordinator, entry, rname, persons_dev_info))

    async_add_entities(entities)


# ─── Device Info helpers ──────────────────────────────────────────────────────
def _ble_device_info(entry: ConfigEntry, device: dict) -> DeviceInfo:
    return DeviceInfo(
        identifiers={(DOMAIN, f"{entry.entry_id}_{device[CONF_DEVICE_ID]}")},
        name=device[CONF_DEVICE_NAME],
        manufacturer="BLE Positioning",
        model=entry.data.get("floor_name", "Floor"),
        via_device=(DOMAIN, entry.entry_id),
    )

def _mmwave_device_info(entry: ConfigEntry, sensor_cfg: dict) -> DeviceInfo:
    return DeviceInfo(
        identifiers={(DOMAIN, f"{entry.entry_id}_mmwave_{sensor_cfg.get('id','')}")},
        name=f"mmWave – {sensor_cfg.get('name', sensor_cfg.get('id',''))}",
        manufacturer="BLE Positioning",
        model="mmWave Sensor",
        via_device=(DOMAIN, entry.entry_id),
    )

def _floor_device_info(entry: ConfigEntry) -> DeviceInfo:
    return DeviceInfo(
        identifiers={(DOMAIN, entry.entry_id)},
        name=entry.data.get("floor_name", "BLE Positioning"),
        manufacturer="BLE Positioning",
        model="Floor",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# EXISTING BLE DEVICE SENSORS (unchanged)
# ═══════════════════════════════════════════════════════════════════════════════
class _BLEBase(SensorEntity):
    _attr_should_poll = False
    _suffix: str = ""

    def __init__(self, coordinator, tracker, entry, dev_info):
        self._coordinator      = coordinator
        self._tracker          = tracker
        self._entry            = entry
        self._attr_device_info = dev_info
        self._attr_unique_id   = f"{entry.entry_id}_{tracker.device_id}_{self._suffix}"

    @property
    def _state_dict(self): return self._tracker.state

    async def async_added_to_hass(self):
        signal = SIGNAL_FP_UPDATED.format(entry_id=self._entry.entry_id, device_id=self._tracker.device_id)
        self.async_on_remove(async_dispatcher_connect(self.hass, signal, self._handle_update))

    @callback
    def _handle_update(self): self.async_write_ha_state()


class BLERoomSensor(_BLEBase):
    _suffix = SUFFIX_ROOM; _attr_icon = "mdi:map-marker"; _attr_name = "Raum"
    @property
    def native_value(self): return self._state_dict.get("room", "unknown")
    @property
    def extra_state_attributes(self):
        s = self._state_dict
        return {"x_m": s.get("x"), "y_m": s.get("y"), "confidence": s.get("confidence"), "rssi": s.get("rssi")}

class BLEPositionXSensor(_BLEBase):
    _suffix = SUFFIX_POS_X; _attr_name = "Position X"
    _attr_native_unit_of_measurement = "m"; _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:arrow-left-right"
    @property
    def native_value(self): return self._state_dict.get("x", 0.0)

class BLEPositionYSensor(_BLEBase):
    _suffix = SUFFIX_POS_Y; _attr_name = "Position Y"
    _attr_native_unit_of_measurement = "m"; _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:arrow-up-down"
    @property
    def native_value(self): return self._state_dict.get("y", 0.0)

class BLEConfidenceSensor(_BLEBase):
    _suffix = SUFFIX_CONFIDENCE; _attr_name = "Konfidenz"
    _attr_native_unit_of_measurement = "m"; _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:crosshairs"
    @property
    def native_value(self): return self._state_dict.get("confidence", 0.0)
    @property
    def extra_state_attributes(self):
        v = self._state_dict.get("confidence", 99.0)
        return {"quality": "Sehr gut" if v < 1.0 else "Gut" if v < 2.0 else "Mittel" if v < 3.5 else "Schlecht"}

class BLEFPCountSensor(_BLEBase):
    _suffix = SUFFIX_FP_COUNT; _attr_name = "Fingerprint Anzahl"
    _attr_state_class = SensorStateClass.MEASUREMENT; _attr_icon = "mdi:database"
    @property
    def native_value(self): return self._state_dict.get("fp_count", 0)

class BLEAutoCalSensor(_BLEBase):
    _suffix = SUFFIX_AC_TODAY; _attr_name = "Auto-Kalibrierungen heute"
    _attr_state_class = SensorStateClass.MEASUREMENT; _attr_icon = "mdi:autorenew"
    @property
    def native_value(self): return self._state_dict.get("ac_today", 0)
    @property
    def extra_state_attributes(self): return {"last_calibration": self._state_dict.get("ac_last")}

class BLEStillSensor(_BLEBase):
    _suffix = SUFFIX_STILL; _attr_name = "Stillstand Sekunden"
    _attr_native_unit_of_measurement = "s"; _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:timer-pause"
    @property
    def native_value(self): return self._state_dict.get("still_seconds", 0.0)


# ═══════════════════════════════════════════════════════════════════════════════
# MMWAVE SENSORS
# ═══════════════════════════════════════════════════════════════════════════════
class _MmwaveBase(SensorEntity):
    """Base for mmWave entities – polls coordinator data every 5s."""
    _attr_should_poll = True

    def __init__(self, coordinator: BLEFloorCoordinator, entry: ConfigEntry,
                 sensor_cfg: dict, dev_info: DeviceInfo):
        self._coordinator      = coordinator
        self._entry            = entry
        self._sensor_cfg       = sensor_cfg
        self._attr_device_info = dev_info
        self._s_id             = sensor_cfg.get("id", "")
        self._s_name           = sensor_cfg.get("name", self._s_id)

    async def async_added_to_hass(self):
        # Also react to cfg updates (e.g. new sensor saved)
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                SIGNAL_CFG_UPDATED.format(entry_id=self._entry.entry_id),
                self._handle_cfg_update,
            )
        )

    @callback
    def _handle_cfg_update(self):
        # Refresh sensor_cfg from coordinator
        for s in self._coordinator.mmwave_sensors:
            if s.get("id") == self._s_id:
                self._sensor_cfg = s
                break
        self.async_write_ha_state()

    def _get_ha_state(self, entity_id: str):
        """Get a HA state value safely."""
        state = self.hass.states.get(entity_id)
        if state is None:
            return None
        try:
            return float(state.state)
        except (ValueError, TypeError):
            return state.state

    def _get_target_xy(self, target_num: int):
        """Return (x_mm, y_mm) for a target, or None."""
        px = self._sensor_cfg.get("entity_prefix", "")
        if not px:
            return None
        x = self._get_ha_state(f"{px}_target_{target_num}_x")
        y = self._get_ha_state(f"{px}_target_{target_num}_y")
        if x is None or y is None:
            return None
        try:
            return float(x), float(y)
        except (TypeError, ValueError):
            return None

    def _target_present(self, target_num: int) -> bool:
        xy = self._get_target_xy(target_num)
        if xy is None:
            return False
        x, y = xy
        return abs(x) > 1 or y > 10

    def _target_room(self, target_num: int) -> str | None:
        """Find which configured room a target is in."""
        xy = self._get_target_xy(target_num)
        if xy is None:
            return None
        import math
        x_mm, y_mm = xy
        rot = (self._sensor_cfg.get("rotation", 0)) * math.pi / 180
        mx  = self._sensor_cfg.get("mx", 0) or 0
        my  = self._sensor_cfg.get("my", 0) or 0
        fx  = mx + (x_mm / 1000) * math.cos(rot) - (y_mm / 1000) * math.sin(rot)
        fy  = my + (x_mm / 1000) * math.sin(rot) + (y_mm / 1000) * math.cos(rot)
        for room in (self._coordinator.rooms or []):
            rx, ry = room.get("x", 0), room.get("y", 0)
            rw, rh = room.get("w", 4), room.get("h", 3)
            if rx <= fx <= rx + rw and ry <= fy <= ry + rh:
                return room.get("name", "Unbekannt")
        return "Unbekannt"

    def _target_posture(self, target_num: int) -> str:
        """Estimate posture from y_mm and mount type."""
        xy = self._get_target_xy(target_num)
        if xy is None:
            return "unknown"
        _, y_mm = xy
        mount  = self._sensor_cfg.get("mount_type", "wall")
        mountH = (self._sensor_cfg.get("mount_height_m") or (2.4 if mount == "ceiling" else 1.5)) * 1000
        th     = self._sensor_cfg.get("posture_thresholds") or {}
        if mount == "ceiling":
            h = max(0, mountH - y_mm)
        elif mount == "wall":
            h = max(0, mountH - y_mm * 0.35)
        else:
            return "unknown"
        if h >= (th.get("stand_min") or 1300):  return "standing"
        if h >= (th.get("sit_min")   or 650):   return "sitting"
        return "lying"


# ── Presence Count ────────────────────────────────────────────────────────────
class MmwavePresenceCountSensor(_MmwaveBase):
    _attr_icon        = "mdi:account-group"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator, entry, sensor_cfg, dev_info):
        super().__init__(coordinator, entry, sensor_cfg, dev_info)
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_presence_count"
        self._attr_name      = f"{self._s_name} Präsenz"

    @property
    def native_value(self) -> int:
        return sum(1 for ti in range(1, 4) if self._target_present(ti))

    @property
    def extra_state_attributes(self):
        px = self._sensor_cfg.get("entity_prefix", "")
        attrs = {"sensor_name": self._s_name, "entity_prefix": px}
        for ti in range(1, 4):
            attrs[f"target_{ti}_present"] = self._target_present(ti)
            attrs[f"target_{ti}_room"]    = self._target_room(ti) if self._target_present(ti) else None
        return attrs


# ── Target Classification ─────────────────────────────────────────────────────
CLASS_LABELS = {"adult": "Erwachsener", "child": "Kind", "pet": "Haustier", "baby": "Baby", "unknown": "Unbekannt"}
CLASS_ICONS  = {"adult": "mdi:account", "child": "mdi:account-child", "pet": "mdi:paw", "baby": "mdi:baby-carriage", "unknown": "mdi:help-circle"}
POSTURE_LABELS = {"standing": "Stehend", "sitting": "Sitzend", "lying": "Liegend", "unknown": "Unbekannt"}

class MmwaveTargetClassSensor(_MmwaveBase):
    _attr_state_class = None

    def __init__(self, coordinator, entry, sensor_cfg, target_num, t_name, dev_info):
        super().__init__(coordinator, entry, sensor_cfg, dev_info)
        self._ti = target_num
        self._t_name = t_name
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_t{target_num}_class"
        self._attr_name      = f"{self._s_name} {t_name} Klasse"

    @property
    def icon(self):
        return CLASS_ICONS.get(self._cls_key(), "mdi:help-circle")

    def _cls_key(self) -> str:
        # Read from coordinator's cached classification if available
        # Fallback: check entity_prefix speed/height for simple heuristic
        if not self._target_present(self._ti):
            return "unknown"
        # Try to get from coordinator state cache
        cached = (self._coordinator.mmwave_classify_cache or {}).get(
            f"{self._s_id}_{self._ti}"
        )
        if cached:
            return cached.get("cls", "unknown")
        return "unknown"

    @property
    def native_value(self) -> str:
        return CLASS_LABELS.get(self._cls_key(), "Unbekannt")

    @property
    def extra_state_attributes(self):
        cached = (self._coordinator.mmwave_classify_cache or {}).get(f"{self._s_id}_{self._ti}", {})
        return {
            "class_key":   self._cls_key(),
            "confidence":  round(cached.get("confidence", 0) * 100),
            "source":      cached.get("source", "none"),
            "present":     self._target_present(self._ti),
            "target_name": self._t_name,
        }


class MmwaveTargetPostureSensor(_MmwaveBase):
    _attr_icon = "mdi:human"

    def __init__(self, coordinator, entry, sensor_cfg, target_num, t_name, dev_info):
        super().__init__(coordinator, entry, sensor_cfg, dev_info)
        self._ti = target_num
        self._t_name = t_name
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_t{target_num}_posture"
        self._attr_name      = f"{self._s_name} {t_name} Haltung"

    @property
    def native_value(self) -> str:
        if not self._target_present(self._ti):
            return "absent"
        posture = self._target_posture(self._ti)
        return POSTURE_LABELS.get(posture, posture)

    @property
    def extra_state_attributes(self):
        posture = self._target_posture(self._ti) if self._target_present(self._ti) else "unknown"
        fall_key = f"{self._s_id}_{self._ti}"
        fall_cache = self._coordinator.mmwave_fall_cache or {}
        fall_state = fall_cache.get(fall_key, {})
        return {
            "posture_key":    posture,
            "present":        self._target_present(self._ti),
            "fall_phase":     fall_state.get("phase", "normal"),
            "fall_alarm":     fall_state.get("phase") == "alarm",
            "still_since_s":  round((fall_state.get("still_since_ts", 0) and
                               (__import__("time").time()*1000 - fall_state.get("still_since_ts",0))/1000) or 0),
        }


class MmwaveTargetSpeedSensor(_MmwaveBase):
    _attr_icon                       = "mdi:speedometer"
    _attr_native_unit_of_measurement = "m/s"
    _attr_state_class                = SensorStateClass.MEASUREMENT
    _attr_device_class               = SensorDeviceClass.SPEED

    def __init__(self, coordinator, entry, sensor_cfg, target_num, t_name, dev_info):
        super().__init__(coordinator, entry, sensor_cfg, dev_info)
        self._ti = target_num
        self._t_name = t_name
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_t{target_num}_speed"
        self._attr_name      = f"{self._s_name} {t_name} Geschwindigkeit"

    @property
    def native_value(self) -> float | None:
        if not self._target_present(self._ti):
            return 0.0
        px = self._sensor_cfg.get("entity_prefix", "")
        if not px:
            return None
        val = self._get_ha_state(f"{px}_target_{self._ti}_speed")
        try:
            return round(abs(float(val)), 2)
        except (TypeError, ValueError):
            return None

    @property
    def extra_state_attributes(self):
        px = self._sensor_cfg.get("entity_prefix", "")
        attrs = {"present": self._target_present(self._ti), "target_name": self._t_name}
        if px:
            for key in ["angle", "direction", "distance", "resolution"]:
                v = self._get_ha_state(f"{px}_target_{self._ti}_{key}")
                if v is not None:
                    attrs[key] = v
        return attrs


class MmwaveTargetRoomSensor(_MmwaveBase):
    _attr_icon = "mdi:door"

    def __init__(self, coordinator, entry, sensor_cfg, target_num, t_name, dev_info):
        super().__init__(coordinator, entry, sensor_cfg, dev_info)
        self._ti = target_num
        self._t_name = t_name
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_t{target_num}_room"
        self._attr_name      = f"{self._s_name} {t_name} Raum"

    @property
    def native_value(self) -> str:
        if not self._target_present(self._ti):
            return "absent"
        return self._target_room(self._ti) or "Unbekannt"

    @property
    def extra_state_attributes(self):
        xy = self._get_target_xy(self._ti)
        import math
        if xy:
            x_mm, y_mm = xy
            rot = (self._sensor_cfg.get("rotation", 0)) * math.pi / 180
            mx  = self._sensor_cfg.get("mx", 0) or 0
            my  = self._sensor_cfg.get("my", 0) or 0
            fx  = mx + (x_mm/1000)*math.cos(rot) - (y_mm/1000)*math.sin(rot)
            fy  = my + (x_mm/1000)*math.sin(rot) + (y_mm/1000)*math.cos(rot)
        else:
            fx = fy = None
        return {
            "floor_x_m":   round(fx, 2) if fx is not None else None,
            "floor_y_m":   round(fy, 2) if fy is not None else None,
            "present":     self._target_present(self._ti),
            "target_name": self._t_name,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# ANALYTICS SENSOR (global per floor entry)
# ═══════════════════════════════════════════════════════════════════════════════
class BLEAnalyticsSensor(SensorEntity):
    """Single analytics sensor exposing room occupancy + sleep as attributes."""
    _attr_should_poll    = True
    _attr_icon           = "mdi:chart-bar"
    _attr_state_class    = SensorStateClass.MEASUREMENT
    _attr_name           = "Analytics Aktive Personen"

    def __init__(self, coordinator: BLEFloorCoordinator, entry: ConfigEntry, dev_info: DeviceInfo):
        self._coordinator      = coordinator
        self._entry            = entry
        self._attr_device_info = dev_info
        self._attr_unique_id   = f"{entry.entry_id}_analytics_active"

    @property
    def native_value(self) -> int:
        """Total active mmWave targets right now."""
        count = 0
        for s in self._coordinator.mmwave_sensors:
            px = s.get("entity_prefix", "")
            if not px:
                continue
            for ti in range(1, 4):
                xs = self.hass.states.get(f"{px}_target_{ti}_x")
                ys = self.hass.states.get(f"{px}_target_{ti}_y")
                if xs and ys:
                    try:
                        if abs(float(xs.state)) > 1 or float(ys.state) > 10:
                            count += 1
                    except (ValueError, TypeError):
                        pass
        return count

    @property
    def extra_state_attributes(self) -> dict:
        attrs = {}
        # Room occupancy from coordinator cache
        activity = getattr(self._coordinator, "activity_day_cache", {})
        today_key = datetime.now().strftime("%Y-%m-%d")
        today = activity.get(today_key, {})
        room_data = today.get("rooms", {})
        for room, persons in room_data.items():
            total_min = round(sum(persons.values()) / 60, 1)
            attrs[f"room_{room.lower().replace(' ','_')}_min_today"] = total_min

        # Sleep
        sleep_data = today.get("sleep", {})
        for person, sl in sleep_data.items():
            attrs[f"sleep_{person.lower().replace(' ','_')}_min"] = round(sl.get("totalSec", 0) / 60, 1)

        # PTZ active tracking
        attrs["ptz_cameras"] = len(self._coordinator.ptz_cameras)

        # mmWave sensor count
        attrs["mmwave_sensors"] = len(self._coordinator.mmwave_sensors)
        return attrs


# ══════════════════════════════════════════════════════════════════════════════
# ── mmWave Persons Device  (v2.11.17)
#    Ein einzelnes HA-Device "Personen (mmWave)" das global alle erkannten
#    Personen über alle Sensoren aggregiert.
# ══════════════════════════════════════════════════════════════════════════════

def _mmwave_persons_device_info(entry: ConfigEntry) -> DeviceInfo:
    return DeviceInfo(
        identifiers={(DOMAIN, f"{entry.entry_id}_mmwave_persons")},
        name="Personen (mmWave)",
        manufacturer="BLE Positioning",
        model="mmWave Presence Tracker",
        entry_type=None,
    )


class _MmwavePersonsBase(SensorEntity):
    """Base für das globale Personen-Device."""
    _attr_should_poll = True

    def __init__(self, coordinator: BLEFloorCoordinator, entry: ConfigEntry, dev_info: DeviceInfo):
        self._coordinator      = coordinator
        self._entry            = entry
        self._attr_device_info = dev_info

    def _get_ha_state(self, entity_id: str):
        state = self.hass.states.get(entity_id)
        if state is None:
            return None
        try:
            return float(state.state)
        except (ValueError, TypeError):
            return state.state

    def _floor_coords(self, sensor_cfg: dict, target_num: int):
        """Berechnet Grundriss-Koordinaten (floor_mx, floor_my) für ein Target."""
        import math
        px  = sensor_cfg.get("entity_prefix", "")
        ov  = sensor_cfg.get("entity_overrides", {}) or {}
        def ent(key, suf):
            return ov.get(key) or (f"{px}{suf}" if px else None)
        xs = self.hass.states.get(ent(f"target_{target_num}_x", f"_target_{target_num}_x"))
        ys = self.hass.states.get(ent(f"target_{target_num}_y", f"_target_{target_num}_y"))
        if not xs or not ys:
            return None
        try:
            x_mm, y_mm = float(xs.state), float(ys.state)
        except (ValueError, TypeError):
            return None
        if math.isnan(x_mm) or math.isnan(y_mm):
            return None
        if not (abs(x_mm) > 1 or y_mm > 10):
            return None   # at 0,0 = not present
        # Kalibrierung / Invertierung (falls im sensor_cfg gespeichert)
        ix  = -x_mm if sensor_cfg.get("invert_x") else x_mm
        iy  = -y_mm if sensor_cfg.get("invert_y") else y_mm
        cal = sensor_cfg.get("calibration") or {}
        cx  = (ix / 1000) * cal.get("scale_x", 1) + cal.get("offset_x", 0)
        cy  = (iy / 1000) * cal.get("scale_y", 1) + cal.get("offset_y", 0)
        rot = (sensor_cfg.get("rotation", 0)) * math.pi / 180
        fx  = (sensor_cfg.get("mx", 0) or 0) + cx * math.cos(rot) - cy * math.sin(rot)
        fy  = (sensor_cfg.get("my", 0) or 0) + cx * math.sin(rot) + cy * math.cos(rot)
        return {"x": round(fx, 3), "y": round(fy, 3), "x_mm": x_mm, "y_mm": y_mm}

    def _room_for_point(self, fx: float, fy: float) -> str:
        """Raum aus Grundriss-Koordinaten."""
        for room in (self._coordinator.rooms or []):
            rx1 = room.get("x1", room.get("x", 0))
            ry1 = room.get("y1", room.get("y", 0))
            rx2 = room.get("x2", rx1 + room.get("w", 4))
            ry2 = room.get("y2", ry1 + room.get("h", 3))
            if rx1 <= fx <= rx2 and ry1 <= fy <= ry2:
                return room.get("name", "Unbekannt")
        return "Unbekannt"

    def _zone_for_point(self, sensor_cfg: dict, fx: float, fy: float) -> str:
        """Zonen-Name aus room.zones (relative rx1/ry1/rx2/ry2 Koordinaten)."""
        rooms = self._coordinator.rooms or []
        for room in rooms:
            rx1 = room.get("x1", 0)
            ry1 = room.get("y1", 0)
            rx2 = room.get("x2", rx1 + room.get("w", 4))
            ry2 = room.get("y2", ry1 + room.get("h", 3))
            rW = rx2 - rx1
            rH = ry2 - ry1
            if rW <= 0 or rH <= 0:
                continue
            for z in (room.get("zones") or []):
                zx1 = rx1 + (z.get("rx1") or 0) * rW
                zy1 = ry1 + (z.get("ry1") or 0) * rH
                zx2 = rx1 + (z.get("rx2") or 1) * rW
                zy2 = ry1 + (z.get("ry2") or 1) * rH
                if min(zx1,zx2) <= fx <= max(zx1,zx2) and min(zy1,zy2) <= fy <= max(zy1,zy2):
                    return z.get("name") or "Zone"
        return ""

    def _dist_to_sensor(self, sensor_cfg: dict, fx: float, fy: float) -> float:
        """Distanz in Metern zwischen Grundriss-Punkt und Sensor."""
        import math
        sx = sensor_cfg.get("mx", 0) or 0
        sy = sensor_cfg.get("my", 0) or 0
        return round(math.sqrt((fx-sx)**2 + (fy-sy)**2), 2)

    def _all_persons(self):
        """Iteriert über alle Sensoren und aktiven Targets.
        Gibt Liste von dicts {name, sensor_name, floor_x, floor_y, room, zone, dist_m, speed_m_s, posture}."""
        result = []
        for sensor_cfg in self._coordinator.mmwave_sensors:
            n_targets = sensor_cfg.get("targets", 3)
            for ti in range(1, n_targets + 1):
                pos = self._floor_coords(sensor_cfg, ti)
                if pos is None:
                    continue
                fx, fy = pos["x"], pos["y"]
                room   = self._room_for_point(fx, fy)
                zone   = self._zone_for_point(sensor_cfg, fx, fy)
                dist   = self._dist_to_sensor(sensor_cfg, fx, fy)
                # Speed
                px    = sensor_cfg.get("entity_prefix", "")
                sps   = self.hass.states.get(f"{px}_target_{ti}_speed") if px else None
                speed = 0.0
                try:
                    speed = round(float(sps.state), 2) if sps else 0.0
                except (ValueError, TypeError):
                    speed = 0.0
                t_name = (sensor_cfg.get("target_names") or [])[ti-1] if ti <= len(sensor_cfg.get("target_names") or []) else f"Person {ti}"
                result.append({
                    "name":        t_name,
                    "sensor_name": sensor_cfg.get("name", sensor_cfg.get("id", "")),
                    "sensor_id":   sensor_cfg.get("id", ""),
                    "target_num":  ti,
                    "floor_x":     fx,
                    "floor_y":     fy,
                    "room":        room,
                    "zone":        zone,
                    "dist_m":      dist,
                    "speed_m_s":   speed,
                })
        return result


class MmwavePersonsCountSensor(_MmwavePersonsBase):
    """Gesamtanzahl erkannter Personen über alle mmWave-Sensoren."""
    _attr_icon        = "mdi:account-multiple"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = None

    def __init__(self, coordinator, entry, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._attr_unique_id = f"{entry.entry_id}_mmwave_persons_total"
        self._attr_name      = "Personen gesamt"

    @property
    def native_value(self) -> int:
        return len(self._all_persons())

    @property
    def extra_state_attributes(self):
        persons = self._all_persons()
        attrs = {"person_count": len(persons), "persons": []}
        for i, p in enumerate(persons):
            attrs["persons"].append({
                "name":        p["name"],
                "room":        p["room"],
                "zone":        p["zone"],
                "dist_to_sensor_m": p["dist_m"],
                "speed_m_s":   p["speed_m_s"],
                "sensor":      p["sensor_name"],
                "floor_x":     p["floor_x"],
                "floor_y":     p["floor_y"],
            })
        # Raum-Zusammenfassung
        rooms = {}
        for p in persons:
            rooms[p["room"]] = rooms.get(p["room"], 0) + 1
        attrs["by_room"] = rooms
        return attrs


class MmwavePersonNSensor(_MmwavePersonsBase):
    """Sensor für Person N (1-basiert) – Raum, Position, Distanz."""

    def __init__(self, coordinator, entry, person_idx: int, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._pidx = person_idx
        self._attr_unique_id = f"{entry.entry_id}_mmwave_person_{person_idx}"
        self._attr_name      = f"Person {person_idx}"
        self._attr_icon      = "mdi:account-circle"

    @property
    def native_value(self) -> str | None:
        persons = self._all_persons()
        if self._pidx > len(persons):
            return "nicht erkannt"
        p = persons[self._pidx - 1]
        return p["room"]

    @property
    def extra_state_attributes(self):
        persons = self._all_persons()
        if self._pidx > len(persons):
            return {"present": False}
        p = persons[self._pidx - 1]
        return {
            "present":          True,
            "name":             p["name"],
            "room":             p["room"],
            "zone":             p["zone"] or "–",
            "floor_x":          p["floor_x"],
            "floor_y":          p["floor_y"],
            "dist_to_sensor_m": p["dist_m"],
            "speed_m_s":        p["speed_m_s"],
            "sensor":           p["sensor_name"],
        }


class MmwaveRoomOccupancySensor(_MmwavePersonsBase):
    """Personen-Anzahl pro Raum."""

    def __init__(self, coordinator, entry, room_name: str, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._room_name = room_name
        safe = room_name.lower().replace(" ", "_").replace("-", "_")
        self._attr_unique_id = f"{entry.entry_id}_mmwave_room_{safe}_occupancy"
        self._attr_name      = f"Belegung – {room_name}"
        self._attr_icon      = "mdi:home-account"
        self._attr_state_class = SensorStateClass.MEASUREMENT

    @property
    def native_value(self) -> int:
        return sum(1 for p in self._all_persons() if p["room"] == self._room_name)

    @property
    def extra_state_attributes(self):
        persons = [p for p in self._all_persons() if p["room"] == self._room_name]
        return {
            "room": self._room_name,
            "persons": [{"name": p["name"], "dist_m": p["dist_m"], "speed_m_s": p["speed_m_s"]} for p in persons],
        }
