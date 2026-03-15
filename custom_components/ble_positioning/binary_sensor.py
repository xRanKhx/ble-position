"""Binary sensor platform for BLE Indoor Positioning.

Entities:
  Existing:
    binary_sensor.<dev>_zone         – BLE device in zone

  New (mmWave):
    binary_sensor.<sensor>_presence  – Jemand erkannt
    binary_sensor.<sensor>_t{N}_fall – Sturz-Alarm Target N
    binary_sensor.<sensor>_t{N}_moving – Target N in Bewegung
"""
from __future__ import annotations
import logging

from homeassistant.components.binary_sensor import BinarySensorEntity, BinarySensorDeviceClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    DOMAIN, CONF_DEVICES, CONF_DEVICE_ID, CONF_DEVICE_NAME,
    SIGNAL_FP_UPDATED, SIGNAL_CFG_UPDATED, SUFFIX_ZONE,
)
from .coordinator import BLEFloorCoordinator, DeviceTracker

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: BLEFloorCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[BinarySensorEntity] = []

    # ── BLE Zone Sensors (existing) ──────────────────────────────────────────
    for device in entry.data.get(CONF_DEVICES, []):
        dev_id  = device[CONF_DEVICE_ID]
        tracker = coordinator.trackers.get(dev_id)
        if tracker is None:
            continue
        dev_info = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_{dev_id}")},
            name=device[CONF_DEVICE_NAME],
            manufacturer="BLE Positioning",
            model=entry.data.get("floor_name", "Floor"),
            via_device=(DOMAIN, entry.entry_id),
        )
        entities.append(BLEZoneSensor(coordinator, tracker, entry, dev_info))

    # ── mmWave Binary Sensors ────────────────────────────────────────────────
    for sensor_cfg in coordinator.mmwave_sensors:
        s_info = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_mmwave_{sensor_cfg.get('id','')}")},
            name=f"mmWave – {sensor_cfg.get('name', sensor_cfg.get('id',''))}",
            manufacturer="BLE Positioning",
            model="mmWave Sensor",
            via_device=(DOMAIN, entry.entry_id),
        )
        # Sensor-level presence
        entities.append(MmwavePresenceSensor(coordinator, entry, sensor_cfg, s_info))

        # Per-target: fall alarm + moving
        for ti in range(1, 4):
            t_name = ""
            tnames = sensor_cfg.get("target_names") or []
            t_name = tnames[ti-1] if ti <= len(tnames) else f"Target {ti}"
            entities.append(MmwaveFallSensor  (coordinator, entry, sensor_cfg, ti, t_name, s_info))
            entities.append(MmwaveMovingSensor (coordinator, entry, sensor_cfg, ti, t_name, s_info))

    async_add_entities(entities)


# ═══════════════════════════════════════════════════════════════════════════════
# EXISTING
# ═══════════════════════════════════════════════════════════════════════════════
class BLEZoneSensor(BinarySensorEntity):
    _attr_should_poll   = False
    _attr_device_class  = BinarySensorDeviceClass.OCCUPANCY
    _attr_icon          = "mdi:vector-square"

    def __init__(self, coordinator, tracker, entry, dev_info):
        self._coordinator = coordinator; self._tracker = tracker
        self._entry = entry; self._attr_device_info = dev_info
        self._attr_unique_id = f"{entry.entry_id}_{tracker.device_id}_{SUFFIX_ZONE}"
        self._attr_name      = f"{tracker.device_name} Zone"

    @property
    def _state_dict(self): return self._tracker.state

    async def async_added_to_hass(self):
        signal = SIGNAL_FP_UPDATED.format(entry_id=self._entry.entry_id, device_id=self._tracker.device_id)
        self.async_on_remove(async_dispatcher_connect(self.hass, signal, self._handle_update))

    @callback
    def _handle_update(self): self.async_write_ha_state()

    @property
    def is_on(self): return self._state_dict.get("zone") is not None

    @property
    def extra_state_attributes(self):
        return {"zone_name": self._state_dict.get("zone"), "room": self._state_dict.get("room", "unknown"),
                "x_m": self._state_dict.get("x"), "y_m": self._state_dict.get("y")}


# ═══════════════════════════════════════════════════════════════════════════════
# MMWAVE BINARY SENSORS
# ═══════════════════════════════════════════════════════════════════════════════
class _MmwaveBinaryBase(BinarySensorEntity):
    _attr_should_poll = True

    def __init__(self, coordinator: BLEFloorCoordinator, entry: ConfigEntry,
                 sensor_cfg: dict, dev_info: DeviceInfo):
        self._coordinator      = coordinator
        self._entry            = entry
        self._sensor_cfg       = sensor_cfg
        self._attr_device_info = dev_info
        self._s_id             = sensor_cfg.get("id", "")

    async def async_added_to_hass(self):
        self.async_on_remove(
            async_dispatcher_connect(self.hass,
                SIGNAL_CFG_UPDATED.format(entry_id=self._entry.entry_id),
                self._handle_cfg_update)
        )

    @callback
    def _handle_cfg_update(self):
        for s in self._coordinator.mmwave_sensors:
            if s.get("id") == self._s_id:
                self._sensor_cfg = s; break
        self.async_write_ha_state()

    def _ha_float(self, entity_id: str):
        st = self.hass.states.get(entity_id)
        if st is None: return None
        try: return float(st.state)
        except (ValueError, TypeError): return None

    def _target_present(self, ti: int) -> bool:
        px = self._sensor_cfg.get("entity_prefix", "")
        if not px: return False
        x = self._ha_float(f"{px}_target_{ti}_x")
        y = self._ha_float(f"{px}_target_{ti}_y")
        if x is None or y is None: return False
        return abs(x) > 1 or y > 10


class MmwavePresenceSensor(_MmwaveBinaryBase):
    _attr_device_class = BinarySensorDeviceClass.OCCUPANCY
    _attr_icon         = "mdi:motion-sensor"

    def __init__(self, coordinator, entry, sensor_cfg, dev_info):
        super().__init__(coordinator, entry, sensor_cfg, dev_info)
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_presence"
        self._attr_name      = f"{sensor_cfg.get('name', self._s_id)} Präsenz"

    @property
    def is_on(self) -> bool:
        return any(self._target_present(ti) for ti in range(1, 4))

    @property
    def extra_state_attributes(self):
        count = sum(1 for ti in range(1, 4) if self._target_present(ti))
        return {
            "active_targets": count,
            "sensor_name":    self._sensor_cfg.get("name", ""),
            "entity_prefix":  self._sensor_cfg.get("entity_prefix", ""),
        }


class MmwaveFallSensor(_MmwaveBinaryBase):
    _attr_device_class = BinarySensorDeviceClass.PROBLEM
    _attr_icon         = "mdi:account-alert"

    def __init__(self, coordinator, entry, sensor_cfg, ti, t_name, dev_info):
        super().__init__(coordinator, entry, sensor_cfg, dev_info)
        self._ti     = ti
        self._t_name = t_name
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_t{ti}_fall"
        self._attr_name      = f"{sensor_cfg.get('name', self._s_id)} {t_name} Sturz-Alarm"

    @property
    def is_on(self) -> bool:
        fall_cache = getattr(self._coordinator, "mmwave_fall_cache", None) or {}
        state = fall_cache.get(f"{self._s_id}_{self._ti}", {})
        return state.get("phase") == "alarm"

    @property
    def extra_state_attributes(self):
        import time
        fall_cache = getattr(self._coordinator, "mmwave_fall_cache", None) or {}
        state = fall_cache.get(f"{self._s_id}_{self._ti}", {})
        still_since = state.get("still_since_ts")
        still_secs  = round((time.time()*1000 - still_since)/1000) if still_since else 0
        return {
            "fall_phase":     state.get("phase", "normal"),
            "still_seconds":  still_secs,
            "target_name":    self._t_name,
            "alarm_delay_s":  self._sensor_cfg.get("fall_alarm_delay", 30),
        }


class MmwaveMovingSensor(_MmwaveBinaryBase):
    _attr_device_class = BinarySensorDeviceClass.MOTION
    _attr_icon         = "mdi:walk"

    def __init__(self, coordinator, entry, sensor_cfg, ti, t_name, dev_info):
        super().__init__(coordinator, entry, sensor_cfg, dev_info)
        self._ti     = ti
        self._t_name = t_name
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_t{ti}_moving"
        self._attr_name      = f"{sensor_cfg.get('name', self._s_id)} {t_name} Bewegung"

    @property
    def is_on(self) -> bool:
        if not self._target_present(self._ti): return False
        px = self._sensor_cfg.get("entity_prefix", "")
        if not px: return False
        speed = self._ha_float(f"{px}_target_{self._ti}_speed")
        return abs(speed or 0) > 0.08

    @property
    def extra_state_attributes(self):
        px = self._sensor_cfg.get("entity_prefix", "")
        attrs = {"target_name": self._t_name, "present": self._target_present(self._ti)}
        if px:
            for key in ["speed", "angle", "direction"]:
                v = self.hass.states.get(f"{px}_target_{self._ti}_{key}")
                attrs[key] = v.state if v else None
        return attrs
