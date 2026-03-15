"""Number platform for BLE Indoor Positioning.

Provides writable number entities that let the user configure auto-calibration
age thresholds directly from the HA UI (dashboard, automations, voice).

Entities per floor (ConfigEntry):
  - number.{floor}_auto_fp_max_age      Auto-cal prints: max age in days
  - number.{floor}_manual_fp_max_age    Manual prints:   max age in days
"""
from __future__ import annotations

from homeassistant.components.number import (
    NumberEntity,
    NumberMode,
    RestoreNumber,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    DOMAIN, NAME,
    OPT_AUTO_CAL_MAX_AGE,
    OPT_AUTO_CAL_MANUAL_AGE,
    DEFAULT_MAX_AGE_DAYS,
    DEFAULT_MANUAL_AGE_DAYS,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    floor_name = entry.data.get("floor_name", "Floor")

    dev_info = DeviceInfo(
        identifiers={(DOMAIN, entry.entry_id)},
        name=floor_name,
        manufacturer="BLE Positioning",
        model="Floor",
    )

    from .coordinator import BLEFloorCoordinator
    coordinator: BLEFloorCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([
        BLEAutoFpAgeNumber  (entry, dev_info, floor_name),
        BLEManualFpAgeNumber(entry, dev_info, floor_name),
    ])
    _extend_setup(async_add_entities, coordinator, entry, dev_info)


# ── Base ──────────────────────────────────────────────────────────────────────
class _BLEAgeNumber(RestoreNumber, NumberEntity):
    """Base class: persists value via HA state machine and writes to entry.options."""

    _attr_should_poll  = False
    _attr_mode         = NumberMode.BOX
    _attr_native_min_value = 1
    _attr_native_max_value = 3650
    _attr_native_step  = 1
    _attr_native_unit_of_measurement = "d"   # days

    _opt_key:      str = ""
    _default_val:  int = 7

    def __init__(
        self,
        entry: ConfigEntry,
        dev_info: DeviceInfo,
        floor_name: str,
    ) -> None:
        self._entry      = entry
        self._floor_name = floor_name
        self._attr_device_info = dev_info
        self._attr_unique_id   = f"{entry.entry_id}_{self._opt_key}"
        # Initial value from entry.options (survives HA restarts via options)
        self._attr_native_value = float(
            entry.options.get(self._opt_key, self._default_val)
        )

    async def async_added_to_hass(self) -> None:
        """Restore last known value on startup."""
        await super().async_added_to_hass()
        if (last := await self.async_get_last_number_data()) is not None:
            self._attr_native_value = last.native_value

    async def async_set_native_value(self, value: float) -> None:
        """Called when the user changes the number in the UI."""
        self._attr_native_value = value
        # Persist into entry.options so coordinator picks it up immediately
        new_opts = {**self._entry.options, self._opt_key: int(value)}
        self.hass.config_entries.async_update_entry(
            self._entry, options=new_opts
        )
        self.async_write_ha_state()


# ── Concrete entities ──────────────────────────────────────────────────────────
class BLEAutoFpAgeNumber(_BLEAgeNumber):
    _opt_key     = OPT_AUTO_CAL_MAX_AGE
    _default_val = DEFAULT_MAX_AGE_DAYS

    @property
    def name(self) -> str:
        return f"{self._floor_name} Auto-Fingerprint Maximalalter"

    _attr_icon = "mdi:autorenew-off"


class BLEManualFpAgeNumber(_BLEAgeNumber):
    _opt_key     = OPT_AUTO_CAL_MANUAL_AGE
    _default_val = DEFAULT_MANUAL_AGE_DAYS

    @property
    def name(self) -> str:
        return f"{self._floor_name} Manueller Fingerprint Maximalalter"

    _attr_icon = "mdi:fingerprint-off"


# ══════════════════════════════════════════════════════════════════════════════
# EXTENDED: mmWave + PTZ Number Entities
# ══════════════════════════════════════════════════════════════════════════════
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.core import callback as ha_callback
from .const import SIGNAL_CFG_UPDATED
from .coordinator import BLEFloorCoordinator


def _extend_setup(async_add_entities, coordinator, entry, floor_dev):
    entities = []
    for s in (coordinator.mmwave_sensors or []):
        s_id   = s.get("id", "")
        s_name = s.get("name", s_id)
        s_dev  = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_mmwave_{s_id}")},
            name=f"mmWave - {s_name}",
            manufacturer="BLE Positioning", model="mmWave Sensor",
            via_device=(DOMAIN, entry.entry_id),
        )
        entities.append(MmwaveFallDelayNumber (coordinator, entry, s, s_dev))
        entities.append(MmwaveMountHeightNumber(coordinator, entry, s, s_dev))
    for cam in (coordinator.ptz_cameras or []):
        cam_id   = cam.get("id", "")
        cam_name = cam.get("name", cam_id)
        cam_dev  = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_ptz_{cam_id}")},
            name=f"PTZ - {cam_name}",
            manufacturer="BLE Positioning", model="PTZ Kamera",
            via_device=(DOMAIN, entry.entry_id),
        )
        entities.append(PtzTourDwellNumber(coordinator, entry, cam, cam_dev))
    async_add_entities(entities)


class _LiveNumber(NumberEntity):
    _attr_should_poll = False
    _attr_mode        = NumberMode.BOX

    def __init__(self, coordinator, entry, dev_info):
        self._coordinator = coordinator
        self._entry       = entry
        self._attr_device_info = dev_info

    async def async_added_to_hass(self):
        self.async_on_remove(async_dispatcher_connect(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self._entry.entry_id),
            self._on_update,
        ))

    @ha_callback
    def _on_update(self):
        self.async_write_ha_state()


class MmwaveFallDelayNumber(_LiveNumber):
    _attr_icon = "mdi:timer-alert"
    _attr_native_unit_of_measurement = "s"
    _attr_native_min_value = 5.0
    _attr_native_max_value = 300.0
    _attr_native_step = 5.0

    def __init__(self, coordinator, entry, s_cfg, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._s_cfg = s_cfg
        self._s_id  = s_cfg.get("id", "")
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_fall_delay"
        self._attr_name = f"mmWave {s_cfg.get('name', self._s_id)} Sturz-Alarm Verzoegerung"

    @ha_callback
    def _on_update(self):
        for s in (self._coordinator.mmwave_sensors or []):
            if s.get("id") == self._s_id:
                self._s_cfg = s; break
        self.async_write_ha_state()

    @property
    def native_value(self):
        return float(self._s_cfg.get("fall_alarm_delay", 30))

    async def async_set_native_value(self, value):
        self._s_cfg["fall_alarm_delay"] = int(value)
        await self._coordinator.async_update_mmwave_sensors(self._coordinator.mmwave_sensors)
        self.async_write_ha_state()


class MmwaveMountHeightNumber(_LiveNumber):
    _attr_icon = "mdi:ruler"
    _attr_native_unit_of_measurement = "m"
    _attr_native_min_value = 0.5
    _attr_native_max_value = 5.0
    _attr_native_step = 0.1

    def __init__(self, coordinator, entry, s_cfg, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._s_cfg = s_cfg
        self._s_id  = s_cfg.get("id", "")
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_mount_height"
        self._attr_name = f"mmWave {s_cfg.get('name', self._s_id)} Montagehoehe"

    @ha_callback
    def _on_update(self):
        for s in (self._coordinator.mmwave_sensors or []):
            if s.get("id") == self._s_id:
                self._s_cfg = s; break
        self.async_write_ha_state()

    @property
    def native_value(self):
        return float(self._s_cfg.get("mount_height_m", 2.0))

    async def async_set_native_value(self, value):
        self._s_cfg["mount_height_m"] = round(value, 1)
        await self._coordinator.async_update_mmwave_sensors(self._coordinator.mmwave_sensors)
        self.async_write_ha_state()


class PtzTourDwellNumber(_LiveNumber):
    _attr_icon = "mdi:timer-play"
    _attr_native_unit_of_measurement = "s"
    _attr_native_min_value = 1.0
    _attr_native_max_value = 60.0
    _attr_native_step = 1.0

    def __init__(self, coordinator, entry, cam_cfg, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._cam_cfg = cam_cfg
        self._cam_id  = cam_cfg.get("id", "")
        self._attr_unique_id = f"{entry.entry_id}_ptz_{self._cam_id}_tour_dwell"
        self._attr_name = f"PTZ {cam_cfg.get('name', self._cam_id)} Tour-Verweildauer"

    @ha_callback
    def _on_update(self):
        for c in (self._coordinator.ptz_cameras or []):
            if c.get("id") == self._cam_id:
                self._cam_cfg = c; break
        self.async_write_ha_state()

    @property
    def native_value(self):
        return float(self._cam_cfg.get("tour_dwell_s", 5))

    async def async_set_native_value(self, value):
        self._cam_cfg["tour_dwell_s"] = int(value)
        await self._coordinator.async_update_ptz_cameras(self._coordinator.ptz_cameras)
        self.async_write_ha_state()
