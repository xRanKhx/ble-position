"""Select platform – wählbare Optionen als HA-Entitäten.

Entitäten:
  Pro PTZ-Kamera:
    select.<floor>_ptz_<cam>_mode        – Tracking-Modus (fixed/priority/tour/centroid)

  Pro mmWave-Sensor:
    select.<floor>_mmwave_<s>_mount_type – Montage-Typ (ceiling/wall/floor)

  Global (Floor):
    select.<floor>_active_floor          – Aktives Stockwerk (Multi-Floor)
"""
from __future__ import annotations
import logging

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, SIGNAL_CFG_UPDATED
from .coordinator import BLEFloorCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: BLEFloorCoordinator = hass.data[DOMAIN][entry.entry_id]

    floor_dev = DeviceInfo(
        identifiers={(DOMAIN, entry.entry_id)},
        name=entry.data.get("floor_name", "BLE Positioning"),
        manufacturer="BLE Positioning", model="Floor",
    )

    entities: list[SelectEntity] = []

    # ── PTZ Tracking-Modus ────────────────────────────────────────────────────
    for cam in (coordinator.ptz_cameras or []):
        cam_dev = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_ptz_{cam.get('id','')}")},
            name=f"PTZ – {cam.get('name', cam.get('id',''))}",
            manufacturer="BLE Positioning", model="PTZ Kamera",
            via_device=(DOMAIN, entry.entry_id),
        )
        entities.append(PtzModeSel(coordinator, entry, cam, cam_dev))

    # ── mmWave Montage-Typ ────────────────────────────────────────────────────
    for s in (coordinator.mmwave_sensors or []):
        s_dev = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_mmwave_{s.get('id','')}")},
            name=f"mmWave – {s.get('name', s.get('id',''))}",
            manufacturer="BLE Positioning", model="mmWave Sensor",
            via_device=(DOMAIN, entry.entry_id),
        )
        entities.append(MmwaveMountSel(coordinator, entry, s, s_dev))

    async_add_entities(entities)


class _SelBase(SelectEntity):
    _attr_should_poll = False

    def __init__(self, coordinator: BLEFloorCoordinator, entry: ConfigEntry, dev_info: DeviceInfo):
        self._coordinator      = coordinator
        self._entry            = entry
        self._attr_device_info = dev_info

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self._entry.entry_id),
            self._on_update,
        ))

    @callback
    def _on_update(self) -> None:
        self.async_write_ha_state()


class PtzModeSel(_SelBase):
    """Tracking-Modus der PTZ-Kamera."""

    _attr_icon    = "mdi:cctv"
    _attr_options = ["fixed", "priority", "tour", "centroid"]
    _LABELS = {
        "fixed":    "📌 Fixziel",
        "priority": "⭐ Priorität",
        "tour":     "🔄 Tour",
        "centroid": "⊕ Mittelpunkt",
    }

    def __init__(self, coordinator, entry, cam_cfg, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._cam_cfg = cam_cfg
        self._cam_id  = cam_cfg.get("id", "")
        self._attr_unique_id = f"{entry.entry_id}_ptz_{self._cam_id}_mode"
        self._attr_name      = f"PTZ {cam_cfg.get('name', self._cam_id)} Modus"

    @callback
    def _on_update(self) -> None:
        # Refresh from coordinator
        for c in (self._coordinator.ptz_cameras or []):
            if c.get("id") == self._cam_id:
                self._cam_cfg = c
                break
        self.async_write_ha_state()

    @property
    def current_option(self) -> str:
        return self._cam_cfg.get("tracking_mode", "priority")

    async def async_select_option(self, option: str) -> None:
        self._cam_cfg["tracking_mode"] = option
        await self._coordinator.async_update_ptz_cameras(self._coordinator.ptz_cameras)
        self.async_write_ha_state()


class MmwaveMountSel(_SelBase):
    """Montage-Typ des mmWave-Sensors."""

    _attr_icon    = "mdi:radar"
    _attr_options = ["ceiling", "wall", "floor"]
    _LABELS = {"ceiling": "🔼 Decke", "wall": "⬜ Wand", "floor": "⬛ Boden"}

    def __init__(self, coordinator, entry, s_cfg, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._s_cfg = s_cfg
        self._s_id  = s_cfg.get("id", "")
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_mount_type"
        self._attr_name      = f"mmWave {s_cfg.get('name', self._s_id)} Montage"

    @callback
    def _on_update(self) -> None:
        for s in (self._coordinator.mmwave_sensors or []):
            if s.get("id") == self._s_id:
                self._s_cfg = s; break
        self.async_write_ha_state()

    @property
    def current_option(self) -> str:
        return self._s_cfg.get("mount_type", "wall")

    async def async_select_option(self, option: str) -> None:
        self._s_cfg["mount_type"] = option
        await self._coordinator.async_update_mmwave_sensors(self._coordinator.mmwave_sensors)
        self.async_write_ha_state()
