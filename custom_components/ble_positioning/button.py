"""Button platform – Aktions-Trigger als HA-Entitäten.

Entitäten:
  Global:
    button.<floor>_snapshot_now          – Grundriss-Snapshot erstellen
    button.<floor>_analytics_reset       – Analytics-Daten zurücksetzen

  Pro mmWave-Sensor × Target:
    button.<sensor>_target_N_fall_reset  – Sturz-Alarm quittieren
    button.<sensor>_target_N_cls_reset   – KI-Klassifikations-Profil löschen

  Pro PTZ-Kamera:
    button.<cam>_ptz_home                – Kamera auf Home-Position fahren
"""
from __future__ import annotations
import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_send
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

    entities: list[ButtonEntity] = [
        SnapshotButton  (coordinator, entry, floor_dev),
        AnalyticsReset  (coordinator, entry, floor_dev),
    ]

    # Per mmWave sensor + target
    for s in (coordinator.mmwave_sensors or []):
        s_id   = s.get("id", "")
        s_name = s.get("name", s_id)
        s_dev  = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_mmwave_{s_id}")},
            name=f"mmWave – {s_name}",
            manufacturer="BLE Positioning", model="mmWave Sensor",
            via_device=(DOMAIN, entry.entry_id),
        )
        for ti in range(1, 4):
            tnames = s.get("target_names") or []
            t_name = tnames[ti-1] if ti <= len(tnames) else f"Target {ti}"
            entities.append(FallResetButton    (coordinator, entry, s, ti, t_name, s_dev))
            entities.append(ClsResetButton     (coordinator, entry, s, ti, t_name, s_dev))

    # Per PTZ camera
    for cam in (coordinator.ptz_cameras or []):
        cam_id   = cam.get("id", "")
        cam_name = cam.get("name", cam_id)
        cam_dev  = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_ptz_{cam_id}")},
            name=f"PTZ – {cam_name}",
            manufacturer="BLE Positioning", model="PTZ Kamera",
            via_device=(DOMAIN, entry.entry_id),
        )
        entities.append(PtzHomeButton(coordinator, entry, cam, cam_dev))

    async_add_entities(entities)


class _BtnBase(ButtonEntity):
    _attr_should_poll = False

    def __init__(self, coordinator: BLEFloorCoordinator, entry: ConfigEntry, dev_info: DeviceInfo):
        self._coordinator      = coordinator
        self._entry            = entry
        self._attr_device_info = dev_info


# ── Global ────────────────────────────────────────────────────────────────────
class SnapshotButton(_BtnBase):
    _attr_icon = "mdi:camera"
    _attr_name = "Snapshot erstellen"

    def __init__(self, coordinator, entry, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._attr_unique_id = f"{entry.entry_id}_snapshot_now"

    async def async_press(self) -> None:
        """Fire HA event – the frontend card listens and creates the snapshot."""
        self.hass.bus.async_fire("ble_positioning_snapshot_request", {
            "entry_id": self._entry.entry_id,
            "label": "HA-Automation",
        })
        _LOGGER.info("Snapshot requested via button entity")


class AnalyticsReset(_BtnBase):
    _attr_icon = "mdi:chart-bar-stacked"
    _attr_name = "Analytics zurücksetzen"

    def __init__(self, coordinator, entry, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._attr_unique_id = f"{entry.entry_id}_analytics_reset"

    async def async_press(self) -> None:
        self._coordinator.activity_day_cache = {}
        async_dispatcher_send(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self._entry.entry_id),
        )
        _LOGGER.info("Analytics cache cleared")


# ── mmWave per-target ─────────────────────────────────────────────────────────
class FallResetButton(_BtnBase):
    _attr_icon = "mdi:account-check"

    def __init__(self, coordinator, entry, s_cfg, ti, t_name, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._s_id   = s_cfg.get("id", "")
        self._ti     = ti
        self._t_name = t_name
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_t{ti}_fall_reset"
        self._attr_name      = f"{s_cfg.get('name', self._s_id)} {t_name} Sturz quittieren"

    async def async_press(self) -> None:
        key   = f"{self._s_id}_{self._ti}"
        cache = self._coordinator.mmwave_fall_cache or {}
        if key in cache:
            cache[key]["phase"]      = "normal"
            cache[key]["alarmFired"] = False
            cache[key]["still_since_ts"] = None
        self.hass.bus.async_fire("ble_positioning_fall_detected_reset", {
            "entry_id":  self._entry.entry_id,
            "sensor_id": self._s_id,
            "target_id": self._ti,
        })
        async_dispatcher_send(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self._entry.entry_id),
        )


class ClsResetButton(_BtnBase):
    _attr_icon = "mdi:brain"

    def __init__(self, coordinator, entry, s_cfg, ti, t_name, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._s_id   = s_cfg.get("id", "")
        self._ti     = ti
        self._t_name = t_name
        self._attr_unique_id = f"{entry.entry_id}_mmwave_{self._s_id}_t{ti}_cls_reset"
        self._attr_name      = f"{s_cfg.get('name', self._s_id)} {t_name} KI-Profil löschen"

    async def async_press(self) -> None:
        key   = f"{self._s_id}_{self._ti}"
        cache = self._coordinator.mmwave_classify_cache or {}
        cache.pop(key, None)
        async_dispatcher_send(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self._entry.entry_id),
        )
        _LOGGER.info("KI-Profil gelöscht: %s", key)


# ── PTZ ───────────────────────────────────────────────────────────────────────
class PtzHomeButton(_BtnBase):
    _attr_icon = "mdi:home-map-marker"

    def __init__(self, coordinator, entry, cam_cfg, dev_info):
        super().__init__(coordinator, entry, dev_info)
        self._cam_cfg = cam_cfg
        self._cam_id  = cam_cfg.get("id", "")
        self._attr_unique_id = f"{entry.entry_id}_ptz_{self._cam_id}_home"
        self._attr_name      = f"PTZ {cam_cfg.get('name', self._cam_id)} Home-Position"

    async def async_press(self) -> None:
        """Fährt PTZ-Kamera in Home-Position (0/0/Zoom=1) via HA service."""
        entity_id = self._cam_cfg.get("entity_id", "")
        if entity_id and self.hass.states.get(entity_id):
            try:
                await self.hass.services.async_call(
                    "camera", "turn_absolute",
                    {"entity_id": entity_id, "pan": 0, "tilt": 0, "zoom": 1},
                    blocking=False,
                )
            except Exception as e:
                _LOGGER.warning("PTZ Home fehlgeschlagen: %s", e)
        # Signal frontend to reset tracking target
        self.hass.bus.async_fire("ble_positioning_ptz_home", {
            "entry_id": self._entry.entry_id,
            "camera_id": self._cam_id,
        })
