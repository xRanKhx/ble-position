"""Switch platform – Ein/Aus-Optionen als HA-Entitäten für Automationen.

Entitäten (alle pro Floor/Entry):
  Tracking & Anzeige:
    switch.<floor>_ptz_tracking          – PTZ Auto-Tracking
    switch.<floor>_mmwave_classify       – KI-Klassifikation
    switch.<floor>_mmwave_posture        – Haltungs-Erkennung
    switch.<floor>_mmwave_fall_detect    – Sturz-Erkennung
    switch.<floor>_mmwave_fall_sound     – Sturz-Alarm Sound
    switch.<floor>_mmwave_fusion         – Multi-Sensor Fusion
    switch.<floor>_show_analytics        – Aktivitäts-Tracking
    switch.<floor>_sleep_monitoring      – Schlaf-Monitoring
    switch.<floor>_person_id             – Personen-Wiedererkennung
    switch.<floor>_emergency_button      – Notfall-Button
    switch.<floor>_guest_mode            – Gast-Modus (Geräte ausblenden)
    switch.<floor>_night_mode            – Nacht-Modus
    switch.<floor>_show_3d               – 3D-Ansicht
    switch.<floor>_room_tap_light        – Raum-Tap → Licht steuern
    switch.<floor>_show_presence         – Anwesenheits-Overlay
    switch.<floor>_show_camera           – Kamera FOV-Overlay
    switch.<floor>_show_geofence         – Geofence-Alarm

  Pro PTZ-Kamera:
    switch.<cam>_ptz_alarm_override      – Sturz-Override (Kamera springt zum Alarm)
"""
from __future__ import annotations
import logging

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, SIGNAL_CFG_UPDATED
from .coordinator import BLEFloorCoordinator

_LOGGER = logging.getLogger(__name__)

# Alle globalen Opt-Toggles: (opt_key, name, icon, default)
_FLOOR_SWITCHES = [
    ("ptzTracking",      "PTZ Auto-Tracking",            "mdi:cctv",                   False),
    ("mmwaveClassify",   "KI Klassifikation",            "mdi:brain",                  True),
    ("mmwavePosture",    "Haltungs-Erkennung",           "mdi:human",                  True),
    ("mmwaveFallDetect", "Sturz-Erkennung",              "mdi:account-alert",          True),
    ("mmwaveFallSound",  "Sturz-Alarm Sound",            "mdi:bell-ring",              True),
    ("mmwaveFusion",     "Multi-Sensor Fusion",          "mdi:set-merge",              True),
    ("showAnalytics",    "Aktivitäts-Tracking",          "mdi:chart-bar",              True),
    ("showSleep",        "Schlaf-Monitoring",            "mdi:sleep",                  True),
    ("mmwavePersonID",   "Personen-Wiedererkennung",     "mdi:account-search",         False),
    ("showEmergencyBtn", "Notfall-Button",               "mdi:alarm-light",            False),
    ("guestMode",        "Gast-Modus",                   "mdi:account-off",            False),
    ("nightMode",        "Nacht-Modus",                  "mdi:weather-night",          True),
    ("show3D",           "3D-Ansicht",                   "mdi:cube-outline",           False),
    ("roomTapLight",     "Raum-Tap → Licht",             "mdi:ceiling-light",          False),
    ("showPresence",     "Anwesenheits-Overlay",         "mdi:radar",                  True),
    ("showCamera",       "Kamera FOV-Overlay",           "mdi:camera-outline",         True),
    ("showGeofence",     "Geofence-Alarm",               "mdi:map-marker-radius",      True),
    ("showMmwave",       "mmWave Overlay",               "mdi:motion-sensor",          True),
    ("showDayTime",      "Tageslicht-Animation",         "mdi:weather-sunny",          True),
    ("energyRoomCorr",   "Energie-Raum-Korrelation",     "mdi:lightning-bolt-outline", False),
    ("shadowSim",        "Schatten-Simulation",          "mdi:box-shadow",             False),
    ("zoomPan",          "Zoom & Pan",                   "mdi:magnify",                True),
    ("personAvatar",     "Personen-Avatar",              "mdi:face-man",               True),
    ("showRaumVerlauf",  "Raum-Verlauf Heatmap",         "mdi:map-clock",              False),
    ("showDeviceTrail",  "Geräte-Verlaufspfad",          "mdi:map-marker-path",        True),
    ("showRoomTemp",     "Raum-Temperatur",              "mdi:thermometer",            True),
]


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: BLEFloorCoordinator = hass.data[DOMAIN][entry.entry_id]
    floor_name = entry.data.get("floor_name", "BLE Positioning")

    floor_dev = DeviceInfo(
        identifiers={(DOMAIN, entry.entry_id)},
        name=floor_name,
        manufacturer="BLE Positioning", model="Floor",
    )

    entities: list[SwitchEntity] = []

    # Floor-level switches
    for opt_key, label, icon, default in _FLOOR_SWITCHES:
        entities.append(FloorOptSwitch(coordinator, entry, floor_dev, opt_key, label, icon, default))

    # Per-PTZ alarm-override switch
    for cam in (coordinator.ptz_cameras or []):
        cam_dev = DeviceInfo(
            identifiers={(DOMAIN, f"{entry.entry_id}_ptz_{cam.get('id','')}")},
            name=f"PTZ – {cam.get('name', cam.get('id',''))}",
            manufacturer="BLE Positioning", model="PTZ Kamera",
            via_device=(DOMAIN, entry.entry_id),
        )
        entities.append(PtzAlarmOverrideSwitch(coordinator, entry, cam, cam_dev))

    async_add_entities(entities)


class FloorOptSwitch(SwitchEntity):
    """One switch per UI option – state synced via coordinator opts_cache."""

    _attr_should_poll = False

    def __init__(
        self,
        coordinator: BLEFloorCoordinator,
        entry: ConfigEntry,
        dev_info: DeviceInfo,
        opt_key: str,
        label: str,
        icon: str,
        default: bool,
    ) -> None:
        self._coordinator = coordinator
        self._entry       = entry
        self._opt_key     = opt_key
        self._default     = default
        self._attr_device_info = dev_info
        self._attr_unique_id   = f"{entry.entry_id}_opt_{opt_key}"
        self._attr_name        = label
        self._attr_icon        = icon

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self._entry.entry_id),
            self._on_update,
        ))

    @callback
    def _on_update(self) -> None:
        self.async_write_ha_state()

    @property
    def is_on(self) -> bool:
        cache = getattr(self._coordinator, "opts_cache", None) or {}
        return cache.get(self._opt_key, self._default)

    async def async_turn_on(self, **kwargs) -> None:
        await self._set_opt(True)

    async def async_turn_off(self, **kwargs) -> None:
        await self._set_opt(False)

    async def _set_opt(self, value: bool) -> None:
        if not hasattr(self._coordinator, "opts_cache") or self._coordinator.opts_cache is None:
            self._coordinator.opts_cache = {}
        self._coordinator.opts_cache[self._opt_key] = value
        # Persist into entry options so card picks it up on reload
        new_opts = {**self._entry.options, f"ui_opt_{self._opt_key}": value}
        self.hass.config_entries.async_update_entry(self._entry, options=new_opts)
        # Fire HA event – frontend card listens and applies
        self.hass.bus.async_fire("ble_positioning_set_opt", {
            "entry_id": self._entry.entry_id,
            "opt_key":  self._opt_key,
            "value":    value,
        })
        async_dispatcher_send(self.hass, SIGNAL_CFG_UPDATED.format(entry_id=self._entry.entry_id))
        self.async_write_ha_state()

    @property
    def extra_state_attributes(self) -> dict:
        return {"opt_key": self._opt_key}


class PtzAlarmOverrideSwitch(SwitchEntity):
    """Sturz-Alarm Override für eine PTZ-Kamera."""

    _attr_should_poll = False
    _attr_icon        = "mdi:camera-control"

    def __init__(self, coordinator, entry, cam_cfg, dev_info):
        self._coordinator = coordinator
        self._entry       = entry
        self._cam_cfg     = cam_cfg
        self._cam_id      = cam_cfg.get("id", "")
        self._attr_device_info = dev_info
        self._attr_unique_id   = f"{entry.entry_id}_ptz_{self._cam_id}_alarm_override"
        self._attr_name        = f"PTZ {cam_cfg.get('name', self._cam_id)} Sturz-Override"

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self._entry.entry_id),
            self._on_update,
        ))

    @callback
    def _on_update(self) -> None:
        for c in (self._coordinator.ptz_cameras or []):
            if c.get("id") == self._cam_id:
                self._cam_cfg = c; break
        self.async_write_ha_state()

    @property
    def is_on(self) -> bool:
        return bool(self._cam_cfg.get("alarm_override", False))

    async def async_turn_on(self, **kwargs) -> None:
        self._cam_cfg["alarm_override"] = True
        await self._coordinator.async_update_ptz_cameras(self._coordinator.ptz_cameras)
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        self._cam_cfg["alarm_override"] = False
        await self._coordinator.async_update_ptz_cameras(self._coordinator.ptz_cameras)
        self.async_write_ha_state()
