"""BLE Positioning Coordinator.

Architecture
────────────
BLEFloorCoordinator   – 1 per config entry (= 1 floor / building)
  - Owns floor config: dimensions, image, scanners, rooms
  - Manages persistent storage of fingerprints (per device)
  - Subscribes to all scanner distance entities via HA state machine
  - Spawns one DeviceTracker per configured device

DeviceTracker         – 1 per tracked device (iPhone, tablet, …)
  - Owns per-device state: current distances, EMA position, room
  - Runs KNN estimate + auto-calibration loop
  - Fires SIGNAL_* to notify entities
"""
from __future__ import annotations

import logging
import math
import time
from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .const import (
    DOMAIN,
    CONF_FLOOR_WIDTH, CONF_FLOOR_HEIGHT,
    CONF_IMAGE_PATH,
    CONF_SCANNERS, CONF_ROOMS, CONF_DEVICES,
    CONF_SCANNER_ID, CONF_SCANNER_ENTITY,
    CONF_SCANNER_NEAREST, CONF_SCANNER_MX, CONF_SCANNER_MY,
    CONF_DEVICE_ID, CONF_DEVICE_NAME,
    CONF_DEVICE_NEAREST_ENT, CONF_DEVICE_RSSI_ENT,
    OPT_GRID_STEP, OPT_KNN_K, OPT_EMA_ALPHA,
    OPT_AUTO_CAL_ENABLED, OPT_AUTO_CAL_STILL_SEC,
    OPT_AUTO_CAL_MAX_MOVE, OPT_AUTO_CAL_WHEN,
    OPT_AUTO_CAL_FROM, OPT_AUTO_CAL_TO,
    OPT_AUTO_CAL_MAX_AGE, OPT_AUTO_CAL_MANUAL_AGE, OPT_AUTO_CAL_NOTIFY,
    WHEN_MISSING, WHEN_ALWAYS, WHEN_SCHEDULE,
    NOTIFY_NONE, NOTIFY_PERSISTENT, NOTIFY_MOBILE,
    STORAGE_VERSION, STORAGE_KEY_TPL,
    SIGNAL_FP_UPDATED, SIGNAL_CFG_UPDATED,
    DEFAULT_GRID_STEP, DEFAULT_KNN_K, DEFAULT_EMA_ALPHA,
    DEFAULT_STILL_SEC, DEFAULT_MAX_MOVE, DEFAULT_MAX_AGE_DAYS, DEFAULT_MANUAL_AGE_DAYS,
)

_LOGGER = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
class BLEFloorCoordinator(DataUpdateCoordinator):
    """Manages one floor/building with all its devices."""

    def __init__(self, hass: HomeAssistant, entry) -> None:
        super().__init__(
            hass, _LOGGER, name=DOMAIN,
            update_interval=timedelta(seconds=5),   # fallback poll
        )
        self.entry      = entry
        self._unsubs: list = []

        # ── Floor-level Store (rooms, doors, scanners, floor size) ──
        self._floor_store: Store = Store(
            hass, 1, f"{DOMAIN}_floor_{entry.entry_id}"
        )

        # ── Reload floor config from entry ────────────────────
        self._reload_config()

        # ── Per-device trackers ───────────────────────────────
        self.trackers: dict[str, DeviceTracker] = {}

    # ── Config helpers ────────────────────────────────────────

    def _reload_config(self) -> None:
        """Pull latest values from config entry (called on reload too)."""
        data = self.entry.data
        opts = self.entry.options

        self.floor_w:  float = data.get(CONF_FLOOR_WIDTH,  10.0)
        self.floor_h:  float = data.get(CONF_FLOOR_HEIGHT, 10.0)
        self.image_path: str = data.get(CONF_IMAGE_PATH,   "")
        self.scanners: list[dict] = data.get(CONF_SCANNERS, [])
        self.rooms:       list[dict] = data.get(CONF_ROOMS, [])
        # Multi-floor support
        # floors = [{id, name, floor_w, floor_h, rooms, doors, windows, lights, image_path, grid_step, scanners}]
        self.floors:      list[dict] = data.get("floors", [])
        self.active_floor: int       = data.get("active_floor", 0)
        self.doors:       list[dict] = data.get("doors", [])
        self.windows:     list[dict] = data.get("windows", [])
        self.door_penalty: bool      = data.get("door_penalty", True)
        self.lights:      list[dict] = []   # light sources – loaded from floor store
        self.devices:  list[dict] = data.get(CONF_DEVICES, [])
        self.alarms:        list[dict] = data.get("alarms",        [])
        self.info_sensors:  list[dict] = data.get("info_sensors",  [])
        self.wall_height:   float       = data.get("wall_height",   2.5)
        self.wall_color:    object      = data.get("wall_color",    None)
        self.wall_alpha:    float       = data.get("wall_alpha",    0.75)
        self.decos:         list[dict]  = data.get("decos",         [])
        self.custom_designs: list[dict] = data.get("custom_designs", [])
        self.mmwave_sensors: list[dict] = data.get("mmwave_sensors", [])
        self.ptz_cameras: list[dict] = data.get("ptz_cameras", [])
        # Runtime caches (populated by frontend via API, used by sensors)
        self.mmwave_classify_cache: dict = {}   # { "sensor_id_targetN": {cls, confidence, source} }
        self.mmwave_fall_cache: dict = {}        # { "sensor_id_targetN": {phase, still_since_ts, alarmFired} }
        self.activity_day_cache: dict = {}       # { "YYYY-MM-DD": {rooms:{}, sleep:{}} }
        self.opts_cache: dict = {}                   # { opt_key: bool } – synced from/to frontend
        self.energy_lines:  list[dict] = data.get("energy_lines",  [])
        self.batteries:     list[dict] = data.get("batteries",     [])
        self.options:       dict       = data.get("options",       {})
        self.heating_rooms: dict       = data.get("heating_rooms", {})
        self.grid_step: float = opts.get(OPT_GRID_STEP, DEFAULT_GRID_STEP)

        self._grid_points = self._build_grid()

    def _build_grid(self) -> list[tuple[float, float]]:
        step = self.grid_step
        pts: list[tuple[float, float]] = []
        x = 0.0
        while x <= self.floor_w + 1e-6:
            y = 0.0
            while y <= self.floor_h + 1e-6:
                mx, my = round(x, 2), round(y, 2)
                if self._in_any_room(mx, my):
                    pts.append((mx, my))
                y = round(y + step, 6)
            x = round(x + step, 6)
        return pts

    def _in_any_room(self, mx: float, my: float) -> bool:
        if not self.rooms:
            return True
        for r in self.rooms:
            if r["x1"] <= mx <= r["x2"] and r["y1"] <= my <= r["y2"]:
                return True
        return False

    def snap_to_grid(
        self, mx: float, my: float
    ) -> tuple[float, float] | None:
        best: tuple[float, float] | None = None
        best_d = float("inf")
        for pt in self._grid_points:
            d = math.dist((mx, my), pt)
            if d < best_d:
                best_d, best = d, pt
        return best if (best and best_d < self.grid_step * 0.75) else None

    def point_in_any_room(self, mx: float, my: float) -> str | None:
        """Return room name if point is in a room, else None."""
        for r in self.rooms:
            if r["x1"] <= mx <= r["x2"] and r["y1"] <= my <= r["y2"]:
                return r["name"]
        return None

    def logical_room_for_point(self, mx: float, my: float) -> str:
        """Return logical (grouped) room name. Grouped rooms share group_id."""
        for r in self.rooms:
            if r["x1"] <= mx <= r["x2"] and r["y1"] <= my <= r["y2"]:
                gid = r.get("group_id", "")
                if gid:
                    # Find group display name (first room in group)
                    for gr in self.rooms:
                        if gr.get("group_id") == gid:
                            return gr.get("group_name") or gr["name"]
                return r["name"]
        return "unknown"

    def nearest_door_distance(self, mx: float, my: float) -> float:
        """Return distance in meters to the nearest door. Infinity if no doors."""
        if not self.doors:
            return float("inf")
        return min(math.dist((mx, my), (d["x"], d["y"])) for d in self.doors)

    def rooms_share_group(self, room_a: str, room_b: str) -> bool:
        """True if two room names belong to the same logical group."""
        def gid(name):
            for r in self.rooms:
                if r["name"] == name:
                    return r.get("group_id", "")
            return None
        ga, gb = gid(room_a), gid(room_b)
        return bool(ga and ga == gb)

    def doors_between(self, room_a: str, room_b: str) -> list[dict]:
        """Return doors that connect room_a and room_b (or their groups)."""
        result = []
        for d in self.doors:
            conn = d.get("connects", [])
            if len(conn) >= 2:
                ra, rb = conn[0], conn[1]
                if {ra, rb} == {room_a, room_b}:
                    result.append(d)
                # Also match group members
                elif (self.rooms_share_group(ra, room_a) and
                      self.rooms_share_group(rb, room_b)):
                    result.append(d)
        return result

    def room_for_point(self, mx: float, my: float) -> str:
        """Find which room contains the given point. Uses a small tolerance for boundary cases."""
        tol = 0.05  # 5cm tolerance so points exactly on borders are included
        for r in self.rooms:
            if (r["x1"] - tol <= mx <= r["x2"] + tol and
                r["y1"] - tol <= my <= r["y2"] + tol):
                return r["name"]
        return "unknown"

    @property
    def grid_points(self) -> list[tuple[float, float]]:
        return self._grid_points

    # ── Lifecycle ─────────────────────────────────────────────

    async def async_setup(self) -> None:
        """Create device trackers and subscribe to entities."""
        # Load floor data from store (overrides entry.data for mutable fields)
        await self._load_floor_store()

        for dev in self.devices:
            tracker = DeviceTracker(self.hass, self, dev)
            await tracker.async_setup()
            self.trackers[dev[CONF_DEVICE_ID]] = tracker

        self._subscribe_scanners()

    async def _load_floor_store(self) -> None:
        """Load mutable floor data from HA store (doesn't trigger reload)."""
        stored = await self._floor_store.async_load()
        if not stored:
            return
        if "floor_w" in stored:
            self.floor_w = stored["floor_w"]
        if "floor_h" in stored:
            self.floor_h = stored["floor_h"]
        if "grid_step" in stored:
            self.grid_step = stored["grid_step"]
        if "scanners" in stored:
            self.scanners = stored["scanners"]
        if "rooms" in stored:
            self.rooms = stored["rooms"]
        if "doors" in stored:
            self.doors = stored["doors"]
        if "windows" in stored:
            self.windows = stored["windows"]
        if "door_penalty" in stored:
            self.door_penalty = stored["door_penalty"]
        if "image_path" in stored:
            self.image_path = stored["image_path"]
        if "lights" in stored:
            self.lights = stored["lights"]
        if "info_sensors" in stored:
            self.info_sensors = stored["info_sensors"]
        if "floors" in stored:
            self.floors = stored["floors"]
        if "active_floor" in stored:
            self.active_floor = stored["active_floor"]
        # ── Felder die gespeichert aber bisher nicht geladen wurden ─────────
        if "wall_height" in stored:
            self.wall_height = stored["wall_height"]
        if "wall_color" in stored:
            self.wall_color = stored["wall_color"]
        if "wall_alpha" in stored:
            self.wall_alpha = stored["wall_alpha"]
        if "decos" in stored:
            self.decos = stored["decos"]
        if "custom_designs" in stored:
            self.custom_designs = stored["custom_designs"]
        if "mmwave_sensors" in stored:
            self.mmwave_sensors = stored["mmwave_sensors"]
            _LOGGER.debug("BLE Positioning: %d mmWave-Sensoren geladen", len(self.mmwave_sensors))
        if "ptz_cameras" in stored:
            self.ptz_cameras = stored["ptz_cameras"]
        if "energy_lines" in stored:
            self.energy_lines = stored["energy_lines"]
        if "batteries" in stored:
            self.batteries = stored["batteries"]
        if "alarms" in stored:
            self.alarms = stored["alarms"]
        if "heating_rooms" in stored:
            self.heating_rooms = stored["heating_rooms"]
        if "options" in stored and not self.options:
            self.options = stored["options"]
        self._grid_points = self._build_grid()
        _LOGGER.debug("BLE Positioning: floor store geladen")

    async def _save_floor_store(self) -> None:
        """Persist mutable floor data without triggering a config entry reload."""
        await self._floor_store.async_save({
            "floor_w":        self.floor_w,
            "floor_h":        self.floor_h,
            "grid_step":      self.grid_step,
            "scanners":       self.scanners,
            "rooms":          self.rooms,
            "doors":          self.doors,
            "windows":        self.windows,
            "door_penalty":   self.door_penalty,
            "image_path":     self.image_path,
            "lights":         self.lights,
            "info_sensors":   self.info_sensors,
            "wall_height":    self.wall_height,
            "wall_color":     self.wall_color,
            "wall_alpha":     self.wall_alpha,
            "decos":          self.decos,
            "floors":         self.floors,
            "active_floor":   self.active_floor,
            "custom_designs": self.custom_designs,
            "mmwave_sensors": self.mmwave_sensors,
            "ptz_cameras":    self.ptz_cameras,
            "energy_lines":   self.energy_lines,
            "batteries":      self.batteries,
            "alarms":         self.alarms,
            "heating_rooms":  self.heating_rooms,
            "options":        self.options,
        })

    async def async_update_lights(self, lights: list) -> None:
        """Save light sources to floor store – no reload needed."""
        self.lights = lights
        await self._save_floor_store()

    def _lights_with_state(self) -> list:
        """Attach live HA state (on/off, brightness, rgb_color) to each light."""
        result = []
        for light in self.lights:
            entity_id = light.get("entity", "")
            state = self.hass.states.get(entity_id) if entity_id else None
            live = {
                "on":         False,
                "brightness": 0,
                "rgb":        None,
                "color_temp": None,
            }
            if state and state.state == "on":
                attrs = state.attributes
                live["on"]         = True
                live["brightness"] = attrs.get("brightness", 255)
                live["rgb"]        = attrs.get("rgb_color")   # [r,g,b] or None
                live["color_temp"] = attrs.get("color_temp")  # mireds or None
            result.append({**light, **live})
        return result

    async def async_shutdown(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        for tracker in self.trackers.values():
            await tracker.async_shutdown()
        self.trackers.clear()

    def _subscribe_scanners(self) -> None:
        """Subscribe to all scanner distance entities."""
        entity_ids: set[str] = set()
        for s in self.scanners:
            if eid := s.get(CONF_SCANNER_ENTITY):
                entity_ids.add(eid)
            if eid := s.get("entity_raw"):
                entity_ids.add(eid)
        # Also subscribe to per-device nearest / rssi AND device-specific scanner entities
        for dev in self.devices:
            if eid := dev.get(CONF_DEVICE_NEAREST_ENT):
                entity_ids.add(eid)
            if eid := dev.get(CONF_DEVICE_RSSI_ENT):
                entity_ids.add(eid)
            # Device-specific scanner entity overrides
            for eid in dev.get("scanner_entities", {}).values():
                if eid:
                    entity_ids.add(eid)
            for eid in dev.get("scanner_entities_raw", {}).values():
                if eid:
                    entity_ids.add(eid)

        if not entity_ids:
            return

        @callback
        def _on_state_change(event) -> None:
            eid   = event.data["entity_id"]
            state = event.data.get("new_state")
            if state is None:
                return
            # Fan out to all device trackers
            for tracker in self.trackers.values():
                tracker.on_entity_update(eid, state.state)

        unsub = async_track_state_change_event(
            self.hass, list(entity_ids), _on_state_change
        )
        self._unsubs.append(unsub)

    # ── Config mutations (called from services / Lovelace card) ──

    async def async_update_info_sensors(self, sensors: list[dict]) -> None:
        """Persist info sensors."""
        self.info_sensors = sensors
        await self._save_floor_store()
        from homeassistant.helpers.dispatcher import async_dispatcher_send
        async_dispatcher_send(self.hass, SIGNAL_CFG_UPDATED.format(entry_id=self.entry.entry_id))

    async def async_update_options(self, options: dict, heating_rooms: dict, wall_height=None, wall_color="__UNSET__", wall_alpha=None) -> None:
        """Persist UI options and heating room config."""
        self.options       = options
        self.heating_rooms = heating_rooms
        if wall_height is not None:
            self.wall_height = float(wall_height)
        if wall_color != "__UNSET__":
            self.wall_color = wall_color
        if wall_alpha is not None:
            self.wall_alpha = float(wall_alpha)
        new_data = {**self.entry.data, "options": options, "heating_rooms": heating_rooms}
        self.hass.config_entries.async_update_entry(self.entry, data=new_data)

    async def async_update_floors(self, floors: list[dict], active_floor: int = 0) -> None:
        """Update multi-floor configuration."""
        self.floors       = floors
        self.active_floor = active_floor
        # Also sync active floor data into primary fields for backwards compat
        if floors and 0 <= active_floor < len(floors):
            fl = floors[active_floor]
            if "floor_w" in fl:  self.floor_w = fl["floor_w"]
            if "floor_h" in fl:  self.floor_h = fl["floor_h"]
            if "rooms"   in fl:  self.rooms   = fl["rooms"]
            if "doors"   in fl:  self.doors   = fl["doors"]
            if "windows" in fl:  self.windows = fl["windows"]
            if "lights"  in fl:  self.lights  = fl["lights"]
            if "image_path" in fl: self.image_path = fl["image_path"]
            if "grid_step"  in fl: self.grid_step  = fl["grid_step"]
            self._grid_points = self._build_grid()
        await self._save_floor_store()
        from homeassistant.helpers.dispatcher import async_dispatcher_send
        async_dispatcher_send(self.hass, SIGNAL_CFG_UPDATED.format(entry_id=self.entry.entry_id))

    async def async_set_active_floor(self, floor_idx: int) -> None:
        """Switch active floor – syncs primary data fields."""
        await self.async_update_floors(self.floors, floor_idx)

    async def async_update_energy(self, energy_lines: list[dict], batteries: list[dict]) -> None:
        """Persist energy lines and batteries."""
        self.energy_lines = energy_lines
        self.batteries    = batteries
        new_data = {**self.entry.data, "energy_lines": energy_lines, "batteries": batteries}
        self.hass.config_entries.async_update_entry(self.entry, data=new_data)
        from homeassistant.helpers.dispatcher import async_dispatcher_send
        async_dispatcher_send(self.hass, SIGNAL_CFG_UPDATED.format(entry_id=self.entry.entry_id))

    async def async_update_ptz_cameras(self, cameras: list[dict]) -> None:
        """Persist PTZ camera configurations."""
        self.ptz_cameras = cameras
        await self._save_floor_store()

    async def async_update_mmwave_sensors(self, sensors: list[dict]) -> None:
        """Persist mmWave sensor configurations."""
        self.mmwave_sensors = sensors
        await self._save_floor_store()

    async def async_update_custom_designs(self, designs: list[dict]) -> None:
        """Persist custom user-defined designs."""
        self.custom_designs = designs
        await self._save_floor_store()

    async def async_update_alarms(self, alarms: list[dict]) -> None:
        """Persist alarm sensors."""
        self.alarms = alarms
        new_data = {**self.entry.data, "alarms": alarms}
        self.hass.config_entries.async_update_entry(self.entry, data=new_data)
        async_dispatcher_send(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self.entry.entry_id),
        )

    async def async_update_scanners(self, scanners: list[dict]) -> None:
        """Update scanners in memory + persistent store (no entry reload)."""
        self.scanners = scanners
        await self._save_floor_store()
        self._grid_points = self._build_grid()
        # Re-subscribe (new entities may have appeared)
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        self._subscribe_scanners()
        for tracker in self.trackers.values():
            tracker._prefill_vals()
        async_dispatcher_send(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self.entry.entry_id),
        )

    async def async_update_floor_size(self, floor_w: float, floor_h: float, img_opacity: float | None = None) -> None:
        """Update floor dimensions in memory + persistent store (no entry reload)."""
        self.floor_w = round(floor_w, 2)
        self.floor_h = round(floor_h, 2)
        if img_opacity is not None:
            new_data = {**self.entry.data, "img_opacity": round(float(img_opacity), 3)}
            self.hass.config_entries.async_update_entry(self.entry, data=new_data)
        await self._save_floor_store()
        self._grid_points = self._build_grid()
        async_dispatcher_send(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self.entry.entry_id),
        )
        _LOGGER.info("Floor size updated: %.1fm × %.1fm", floor_w, floor_h)

    async def async_update_grid_step(self, step: float) -> None:
        """Update grid step in memory + persistent store (no entry reload)."""
        self.grid_step = step
        await self._save_floor_store()
        self._grid_points = self._build_grid()
        async_dispatcher_send(self.hass, SIGNAL_CFG_UPDATED.format(entry_id=self.entry.entry_id))
        _LOGGER.info("Grid step updated: %.2fm → %d points", step, len(self._grid_points))

    async def async_update_rooms(self, rooms: list[dict], doors: list[dict] | None = None,
                               door_penalty: bool | None = None,
                               windows: list[dict] | None = None) -> None:
        """Update rooms/doors/windows in memory + persistent store (no entry reload)."""
        self.rooms = rooms
        if doors is not None:
            self.doors = doors
        if windows is not None:
            self.windows = windows
        if door_penalty is not None:
            self.door_penalty = door_penalty
        await self._save_floor_store()
        self._grid_points = self._build_grid()
        async_dispatcher_send(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self.entry.entry_id),
        )

    async def async_update_image_path(self, path: str) -> None:
        """Update floor background image path in store."""
        self.image_path = path
        await self._save_floor_store()
        async_dispatcher_send(
            self.hass,
            SIGNAL_CFG_UPDATED.format(entry_id=self.entry.entry_id),
        )

    async def async_add_device(self, device: dict) -> None:
        devices = list(self.devices) + [device]
        new_data = {**self.entry.data, CONF_DEVICES: devices}
        self.hass.config_entries.async_update_entry(self.entry, data=new_data)
        self.devices = devices
        tracker = DeviceTracker(self.hass, self, device)
        await tracker.async_setup()
        self.trackers[device[CONF_DEVICE_ID]] = tracker
        # Re-subscribe so device-specific entities are tracked immediately
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        self._subscribe_scanners()
        tracker._prefill_vals()

    # ── Coordinator update (fallback) ─────────────────────────

    async def _async_update_data(self) -> dict:
        return {
            dev_id: tracker.state
            for dev_id, tracker in self.trackers.items()
        }

    # ── Public helpers ────────────────────────────────────────

    def get_card_data(self) -> dict:
        """Return everything the Lovelace card needs in one call.
        Kept for backwards compatibility – merges all segments."""
        return {
            **self.get_card_data_base(),
            **self.get_card_data_tracking(),
            **self.get_card_data_mmwave(),
        }

    def get_card_data_base(self) -> dict:
        """Base segment: layout, lights, rooms, decos.
        Always needed regardless of active modules.
        Polled every second by all clients."""
        return {
            "entry_id":     self.entry.entry_id,
            "floor_name":   self.entry.data.get("floor_name", ""),
            "floor_w":      self.floor_w,
            "floor_h":      self.floor_h,
            "image_path":   self.image_path,
            "grid_step":    self.grid_step,
            "rooms":        self.rooms,
            "doors":        self.doors,
            "windows":      self.windows,
            "door_penalty": self.door_penalty,
            "lights":       self._lights_with_state(),
            "alarms":       self.alarms,
            "info_sensors": self.info_sensors,
            "wall_height":  self.wall_height,
            "wall_color":   self.wall_color,
            "wall_alpha":   self.wall_alpha,
            "decos":        self.decos,
            "img_opacity":  self.entry.data.get("img_opacity", 0.35),
            "energy_lines": self.energy_lines,
            "batteries":    self.batteries,
            "options":      self.options,
            "floors":       self.floors,
            "active_floor": self.active_floor,
            "custom_designs": self.custom_designs,
            "ptz_cameras":  self.ptz_cameras,
            "heating_rooms": self.heating_rooms,
        }

    def get_card_data_tracking(self) -> dict:
        """BLE tracking segment: devices, scanners, fingerprints.
        Only needed when BLE/tracking module is active.
        Skipping this saves: tracker.state calculation (RSSI→XY),
        sensor_vals reads, fingerprint serialization (~3KB/request)."""
        opts = self.entry.options
        return {
            "scanners": self.scanners,
            "auto_fp_max_age":   opts.get(OPT_AUTO_CAL_MAX_AGE,    DEFAULT_MAX_AGE_DAYS),
            "manual_fp_max_age": opts.get(OPT_AUTO_CAL_MANUAL_AGE, DEFAULT_MANUAL_AGE_DAYS),
            "devices": [
                {
                    "device_id":   did,
                    "device_name": tracker.device_name,
                    "scanner_entities":     tracker.device_cfg.get("scanner_entities", {}),
                    "scanner_entities_raw": tracker.device_cfg.get("scanner_entities_raw", {}),
                    **tracker.state,
                    "sensor_vals": {
                        **{
                            s.get(CONF_SCANNER_ENTITY, ""): tracker._vals.get(s.get(CONF_SCANNER_ENTITY, ""))
                            for s in self.scanners if s.get(CONF_SCANNER_ENTITY)
                        },
                        **{
                            eid: tracker._vals.get(eid)
                            for eid in tracker.device_cfg.get("scanner_entities", {}).values()
                            if eid
                        },
                    },
                }
                for did, tracker in self.trackers.items()
            ],
            "fp_counts": {
                did: len(tracker.fingerprints)
                for did, tracker in self.trackers.items()
            },
            "fingerprints": [
                {"mx": fp["mx"], "my": fp["my"], "device_id": did,
                 "auto": fp.get("auto", False), "ts": fp.get("ts", 0)}
                for did, tracker in self.trackers.items()
                for fp in tracker.fingerprints
            ],
        }

    def get_card_data_mmwave(self) -> dict:
        """mmWave segment: sensor positions, targets.
        Only needed when mmWave module is active.
        Skipping this saves: mmwave state reads (~1KB/request)."""
        return {
            "mmwave_sensors": self.mmwave_sensors,
        }


# ─────────────────────────────────────────────────────────────────────────────
class DeviceTracker:
    """Tracks one BLE device using KNN fingerprinting."""

    def __init__(
        self,
        hass: HomeAssistant,
        floor: BLEFloorCoordinator,
        device_cfg: dict,
    ) -> None:
        self.hass    = hass
        self.floor   = floor
        self.device_cfg = device_cfg
        self.device_id:   str = device_cfg[CONF_DEVICE_ID]
        self.device_name: str = device_cfg[CONF_DEVICE_NAME]

        self._store: Store = Store(
            hass, STORAGE_VERSION,
            STORAGE_KEY_TPL.format(
                entry_id=floor.entry.entry_id,
                device_id=self.device_id,
            ),
        )

        # ── Sensor cache ──────────────────────────────────────
        self._vals: dict[str, Any] = {}  # entity_id → float|str

        # ── EMA position ──────────────────────────────────────
        self._ema_x: float | None = None
        self._ema_y: float | None = None

        # ── Nearest hysteresis ────────────────────────────────
        self._nearest_raw: str   = ""
        self._nearest_since: float = 0.0
        self._nearest_confirmed: str = ""

        # ── Auto-cal state ────────────────────────────────────
        self._still_since: float | None = None
        self._last_pos: tuple[float, float] | None = None
        self._last_nearest: str = ""
        self._last_auto_cal: float = 0.0
        self._ac_count_today: int  = 0
        self._ac_last_date: str    = ""

        # ── Presence / away detection ─────────────────────
        self._rssi_ema: dict[str, float] = {}
        self._last_seen: float = time.monotonic()
        self._is_present: bool = True
        self._pos_history: list[tuple[float, float, float]] = []  # (x, y, ts)

        # ── Fingerprints ──────────────────────────────────────
        self.fingerprints: list[dict] = []

        # ── Exposed state ─────────────────────────────────────
        self.state: dict[str, Any] = self._blank_state()

    def _blank_state(self) -> dict:
        return {
            "room":          "unknown",
            "x":             0.0,
            "y":             0.0,
            "confidence":    0.0,
            "fp_count":      0,
            "still_seconds": 0.0,
            "ac_today":      0,
            "ac_last":       None,
            "rssi":          None,
            "present":       True,
        }

    # ── Lifecycle ─────────────────────────────────────────────

    async def async_setup(self) -> None:
        await self._load_fingerprints()
        # Pre-populate _vals from current HA states (don't wait for first change event)
        self._prefill_vals()

    def _prefill_vals(self) -> None:
        """Read current entity states into _vals cache."""
        entities: set[str] = set()
        # Device-specific entity overrides (set via prefix/add_device)
        for s in self.floor.scanners:
            if e := self._scanner_entity(s):
                entities.add(e)
            if e := self._scanner_entity_raw(s):
                entities.add(e)
        if e := self.device_cfg.get(CONF_DEVICE_NEAREST_ENT): entities.add(e)
        if e := self.device_cfg.get(CONF_DEVICE_RSSI_ENT):    entities.add(e)

        for eid in entities:
            state = self.hass.states.get(eid)
            if state is None:
                continue
            try:
                self._vals[eid] = float(state.state)
            except (ValueError, TypeError):
                self._vals[eid] = state.state
        _LOGGER.debug(
            "%s prefilled %d entity values: %s",
            self.device_name, len(self._vals),
            {k: v for k, v in self._vals.items()},
        )

    async def async_shutdown(self) -> None:
        pass  # storage is flushed on save

    # ── Entity update callback ────────────────────────────────

    @callback
    def on_entity_update(self, entity_id: str, value: str) -> None:
        """Called by floor coordinator whenever a relevant entity changes."""
        try:
            val = float(value)
            self._vals[entity_id] = val
            # Track last-seen time (any scanner reporting a real distance = present)
            # Only mark present if value is a plausible distance (< 30m)
            if val > 0 and val < 30:
                self._last_seen = time.monotonic()
                if not self._is_present:
                    self._is_present = True
                    _LOGGER.debug("%s: device back (dist %.1fm)", self.device_name, val)
        except (ValueError, TypeError):
            self._vals[entity_id] = value

        self._check_presence()
        self._update_nearest_hysteresis()
        self._compute_position()
        # FIX: Auto-cal max 1x/10s auslösen statt bei jedem Update
        now_t = time.monotonic()
        if now_t - getattr(self, "_last_cal_trigger", 0) >= 10.0:
            self._last_cal_trigger = now_t
            self.hass.async_create_task(self._maybe_auto_calibrate())
        self._fire_signal()

    def _check_presence(self) -> None:
        """Mark device as away if no scanner reported it recently (> 5 min)."""
        AWAY_TIMEOUT = float(self.floor.entry.options.get("away_timeout_sec", 30))
        now = time.monotonic()
        # Also check: if ALL scanner distances are very large (> 15m) → likely away
        dist_vals = []
        for s in self.floor.scanners:
            eid = self._scanner_entity(s)
            v = self._vals.get(eid)
            if isinstance(v, (int, float)):
                dist_vals.append(v)
        all_far = dist_vals and all(d > 15 for d in dist_vals)
        if all_far or (now - self._last_seen > AWAY_TIMEOUT):
            if self._is_present:
                self._is_present = False
                _LOGGER.debug("%s: device away", self.device_name)

    def _fire_signal(self) -> None:
        # FIX: Signal max 1x/500ms senden (Throttle gegen Frontend-Overload)
        import time as _time
        now_f = _time.monotonic()
        if now_f - getattr(self, "_last_signal", 0) < 0.5:
            return
        self._last_signal = now_f
        async_dispatcher_send(
            self.hass,
            SIGNAL_FP_UPDATED.format(
                entry_id=self.floor.entry.entry_id,
                device_id=self.device_id,
            ),
        )

    # ── Nearest-scanner hysteresis ────────────────────────────

    def _update_nearest_hysteresis(self) -> None:
        nearest_eid = self.device_cfg.get(CONF_DEVICE_NEAREST_ENT, "")
        if not nearest_eid:
            # Kein Nearest-Entity konfiguriert → trotzdem "confirmed" setzen
            # damit Auto-Cal nicht dauerhaft blockiert wird
            self._nearest_confirmed = "no_nearest_configured"
            return
        raw = str(self._vals.get(nearest_eid, ""))
        now = time.monotonic()
        if raw != self._nearest_raw:
            self._nearest_raw  = raw
            self._nearest_since = now
        if now - self._nearest_since >= 3.0:
            self._nearest_confirmed = raw

    def _room_from_nearest(self) -> str | None:
        lower = self._nearest_confirmed.lower()
        for s in self.floor.scanners:
            key = s.get(CONF_SCANNER_NEAREST, "")
            if key and key.lower() in lower:
                return self.floor.room_for_point(
                    s.get(CONF_SCANNER_MX, 0),
                    s.get(CONF_SCANNER_MY, 0),
                )
        return None

    # ── KNN ───────────────────────────────────────────────────

    def _scanner_entity(self, scanner: dict) -> str:
        """Get the device-specific distance entity for a scanner, fallback to scanner default."""
        sid = scanner.get("nearest_key") or scanner.get("id", "")
        overrides = self.device_cfg.get("scanner_entities", {})
        if sid and sid in overrides:
            return overrides[sid]
        return scanner.get(CONF_SCANNER_ENTITY, "")

    def _scanner_entity_raw(self, scanner: dict) -> str:
        """Get the device-specific raw entity for a scanner."""
        sid = scanner.get("nearest_key") or scanner.get("id", "")
        overrides_raw = self.device_cfg.get("scanner_entities_raw", {})
        if sid and sid in overrides_raw:
            return overrides_raw[sid]
        return scanner.get("entity_raw", "")


    def _scanner_distance(self, fp: dict) -> float:
        total = 0.0
        for s in self.floor.scanners:
            sid    = s[CONF_SCANNER_ID]
            entity = self._scanner_entity(s)
            va = self._vals.get(entity)
            vb = fp.get(sid)
            fa = float(va) if va is not None else 12.0
            fb = float(vb) if vb is not None else 12.0
            total += (fa - fb) ** 2
        return math.sqrt(total)

    def _knn_estimate(self) -> dict | None:
        fps = self.fingerprints
        if not fps:
            return None
        k   = min(self.floor.entry.options.get(OPT_KNN_K, DEFAULT_KNN_K), len(fps))
        ranked = sorted(fps, key=self._scanner_distance)[:k]
        w_sum = x_sum = y_sum = 0.0
        for fp in ranked:
            d = self._scanner_distance(fp)
            w = 1.0 / (d ** 2 + 0.01)
            x_sum += fp["mx"] * w
            y_sum += fp["my"] * w
            w_sum += w
        mx, my = x_sum / w_sum, y_sum / w_sum
        return {
            "x":          mx,
            "y":          my,
            "confidence": round(self._scanner_distance(ranked[0]), 3),
            "room":       self.floor.room_for_point(mx, my),
        }

    # ── Position compute ──────────────────────────────────────

    def _compute_position(self) -> None:
        opts  = self.floor.entry.options
        base_alpha = opts.get(OPT_EMA_ALPHA, DEFAULT_EMA_ALPHA)

        est = self._knn_estimate()
        if est:
            if self._ema_x is None:
                self._ema_x, self._ema_y = est["x"], est["y"]
            else:
                # Adaptive EMA: snap faster when movement is large, smooth when stable
                dist = math.dist((est["x"], est["y"]), (self._ema_x, self._ema_y))
                if dist > 2.0:
                    alpha = min(0.8, base_alpha * 4)   # big jump → snap quickly
                elif dist > 1.0:
                    alpha = min(0.6, base_alpha * 2.5) # medium move → faster
                else:
                    alpha = base_alpha                  # small drift → normal smoothing
                self._ema_x += alpha * (est["x"] - self._ema_x)
                self._ema_y += alpha * (est["y"] - self._ema_y)
            confidence = est["confidence"]

            # Room: use EMA position with door-penalty transition guard
            ema_room = self.floor.logical_room_for_point(self._ema_x, self._ema_y)
            if ema_room != "unknown":
                candidate = ema_room
            else:
                candidate = self.floor.logical_room_for_point(est["x"], est["y"])
                if candidate == "unknown":
                    candidate = self._room_from_nearest() or "unknown"

            # Door-penalty: only allow room change if near a door (optional feature)
            prev_room = self.state.get("room", "unknown")
            if (self.floor.door_penalty and
                candidate != "unknown" and
                prev_room != "unknown" and
                candidate != prev_room and
                self.floor.doors):          # only apply penalty if doors are defined
                door_dist = self.floor.nearest_door_distance(self._ema_x, self._ema_y)
                # Allow transition threshold: 1.5m from any door
                DOOR_THRESHOLD = 1.5
                if door_dist > DOOR_THRESHOLD:
                    candidate = prev_room   # stay in current room
            room = candidate
        else:
            # No fingerprints yet - nearest scanner is best we have
            room       = self._room_from_nearest() or "unknown"
            confidence = 0.0

        rssi_eid = self.device_cfg.get(CONF_DEVICE_RSSI_ENT, "")
        # Update position history and run stillness detection BEFORE state.update()
        # so that state["still_seconds"] is always current (no async race).
        now_m = time.monotonic()
        if self._ema_x is not None:
            self._pos_history.append((self._ema_x, self._ema_y, now_m))
            self._pos_history = [(x,y,t) for x,y,t in self._pos_history if now_m - t < 90]
            self._is_still_now()   # updates _still_since as side-effect

        # When away: expose None for x/y so frontend can hide the dot
        if not self._is_present:
            self._ema_x = None
            self._ema_y = None
        # Zone detection
        active_zone = None
        if self._ema_x is not None and self._ema_y is not None and room != "away":
            room_obj2 = next(
                (r for r in self.floor.rooms if r.get("name") == room), None
            )
            if room_obj2 and room_obj2.get("zones"):
                rw = room_obj2["x2"] - room_obj2["x1"]
                rh = room_obj2["y2"] - room_obj2["y1"]
                if rw > 0 and rh > 0:
                    rel_x = (self._ema_x - room_obj2["x1"]) / rw
                    rel_y = (self._ema_y - room_obj2["y1"]) / rh
                    for z in room_obj2["zones"]:
                        if (rel_x >= z.get("rx1", 0) and rel_x <= z.get("rx2", 1) and
                                rel_y >= z.get("ry1", 0) and rel_y <= z.get("ry2", 1)):
                            active_zone = z.get("name", "Zone")
                            break

        self.state.update({
            "room":          room if self._is_present else "away",
            "zone":          active_zone if self._is_present else None,
            "x":             round(self._ema_x, 2) if self._ema_x is not None else None,
            "y":             round(self._ema_y, 2) if self._ema_y is not None else None,
            "confidence":    confidence,
            "fp_count":      len(self.fingerprints),
            "still_seconds": round(now_m - self._still_since, 1)
                             if self._still_since else 0.0,
            "ac_today":      self._ac_count_today,
            "ac_last":       getattr(self, "_last_auto_cal_ts", None),
            "ac_last":       self._ac_last_date or None,
            "rssi":          self._vals.get(rssi_eid),
            "present":       self._is_present,
        })

    # ── Auto-calibration ──────────────────────────────────────

    def _is_still_now(self) -> bool:
        """Robust stillness detection using median-based spread over 30s window.

        BLE jitter can peak at ±2m. We use median-centre + RMS with outlier trimming.

        Bugfix history:
        - v2.10.10: Fixed broken median (xs/ys were sorted independently → wrong centre).
                    Fixed race: _still_since is now updated here (called from
                    _compute_position) so state["still_seconds"] is always current.
        """
        now_t = time.monotonic()
        window = [(x, y) for x, y, t in self._pos_history if now_t - t < 30.0]

        if len(window) < 5:
            self._still_since = None
            return False

        # ── Correct median: sort by x, take middle POINT (not separate x/y) ──
        sorted_by_x = sorted(window, key=lambda p: p[0])
        mid = len(sorted_by_x) // 2
        cx, cy = sorted_by_x[mid]  # median x-coordinate point as centre proxy

        # Use distance-sorted trimming to remove outliers (worst 15%)
        dists = sorted(window, key=lambda p: math.dist(p, (cx, cy)))
        trim = max(1, len(dists) // 7)   # remove worst ~15%
        trimmed = dists[:-trim]

        # RMS distance from centre
        rms = math.sqrt(sum(math.dist(p, (cx, cy))**2 for p in trimmed) / len(trimmed))

        is_still = rms < 0.8   # 0.8m RMS – BLE-Jitter berücksichtigt (war 0.6m)

        # ── Update _still_since HERE so state["still_seconds"] is always fresh ──
        if not is_still:
            self._still_since = None
        elif self._still_since is None:
            self._still_since = now_t

        _LOGGER.debug(
            "%s: stillness check – window=%d rms=%.2fm still=%s still_for=%.0fs",
            self.device_name, len(window), rms, is_still,
            (now_t - self._still_since) if self._still_since else 0,
        )
        return is_still


    @staticmethod
    def _room_optimal_step(room: dict, min_pts: int = 5) -> float:
        """Größter Rasterschritt der noch >= min_pts Punkte im Raum ergibt."""
        w = room["x2"] - room["x1"]
        h = room["y2"] - room["y1"]
        for step in [2.0, 1.5, 1.0, 0.75, 0.5, 0.25]:
            pts = 0
            y = room["y1"]
            while y <= room["y2"] + 1e-6:
                x = room["x1"]
                while x <= room["x2"] + 1e-6:
                    pts += 1
                    x = round(x + step, 6)
                y = round(y + step, 6)
            if pts >= min_pts:
                return step
        return 0.25

    @staticmethod
    def _next_finer_step(step: float) -> float | None:
        """Nächst-feinerer Rasterschritt, oder None wenn bereits am feinsten."""
        steps = [2.0, 1.5, 1.0, 0.75, 0.5, 0.25]
        try:
            idx = steps.index(step)
            return steps[idx + 1] if idx + 1 < len(steps) else None
        except ValueError:
            return None

    def _room_grid_points(self, room: dict, step: float) -> list[tuple[float, float]]:
        """Alle Rasterpunkte eines Raums bei gegebenem Schritt."""
        pts = []
        y = room["y1"]
        while y <= room["y2"] + 1e-6:
            x = room["x1"]
            while x <= room["x2"] + 1e-6:
                pts.append((round(x, 2), round(y, 2)))
                x = round(x + step, 6)
            y = round(y + step, 6)
        return pts

    async def _maybe_auto_calibrate(self) -> None:
        opts = self.floor.entry.options

        if self._ema_x is None:
            return

        now  = time.monotonic()

        # _still_since is maintained by _is_still_now() called from _compute_position.
        # Here we only check whether auto-cal conditions are met.
        if not opts.get(OPT_AUTO_CAL_ENABLED, True):  # default ON
            return

        if self._still_since is None:
            return   # not still

        # Nearest scanner: nur prüfen wenn auch konfiguriert.
        # Wenn kein nearest_entity gesetzt, überspringen wir den Guard –
        # Auto-Cal soll auch ohne Nearest-Entity funktionieren.
        nearest_eid = self.device_cfg.get("nearest_entity", "") or self.device_cfg.get("nearest_ent", "")
        if nearest_eid and self._nearest_confirmed == "":
            return

        when = opts.get(OPT_AUTO_CAL_WHEN, WHEN_MISSING)
        if when == WHEN_SCHEDULE:
            t_str = dt_util.now().strftime("%H:%M")
            if not (opts.get(OPT_AUTO_CAL_FROM, "02:00") <= t_str <= opts.get(OPT_AUTO_CAL_TO, "05:00")):
                return

        if now - self._still_since < opts.get(OPT_AUTO_CAL_STILL_SEC, DEFAULT_STILL_SEC):
            return

        # Aktuellen Raum des Geräts bestimmen
        current_room = self.floor.point_in_any_room(self._ema_x, self._ema_y)
        room_obj = next(
            (r for r in self.floor.rooms if r.get("name") == current_room),
            None
        ) if current_room else None

        # Adaptives Raster: feinstes Raster bestimmen das der Raum noch braucht
        # Starte mit dem optimalen Grob-Schritt, verfeinere solange alle Grobpunkte kalibriert sind
        if room_obj:
            coarse_step = self._room_optimal_step(room_obj)
            adaptive_step = coarse_step
            while True:
                coarse_pts = self._room_grid_points(room_obj, adaptive_step)
                calibrated = [
                    pt for pt in coarse_pts
                    if any(
                        abs(fp["mx"] - pt[0]) < 0.01 and abs(fp["my"] - pt[1]) < 0.01
                        for fp in self.fingerprints
                        if fp.get("device_id", self.device_id) == self.device_id
                    )
                ]
                if len(calibrated) < len(coarse_pts):
                    break  # noch Lücken auf diesem Level → hier aufnehmen
                finer = self._next_finer_step(adaptive_step)
                if finer is None:
                    break  # bereits am feinsten
                adaptive_step = finer
        else:
            adaptive_step = self.floor.grid_step

        # Snap auf adaptives Raster
        snapped = None
        if room_obj:
            pts = self._room_grid_points(room_obj, adaptive_step)
            best_d = float("inf")
            for pt in pts:
                d = math.dist((self._ema_x, self._ema_y), pt)
                if d < best_d:
                    best_d, snapped = d, pt
            if best_d > adaptive_step * 0.75:
                snapped = None
        if snapped is None:
            snapped = self.floor.snap_to_grid(self._ema_x, self._ema_y)
        if snapped is None:
            return

        max_age  = opts.get(OPT_AUTO_CAL_MAX_AGE, DEFAULT_MAX_AGE_DAYS)

        # Count fingerprints in same room as snapped point
        room_fps = [
            fp for fp in self.fingerprints
            if fp.get("device_id", self.device_id) == self.device_id
            and self.floor.point_in_any_room(fp["mx"], fp["my"])
            == self.floor.point_in_any_room(snapped[0], snapped[1])
            and self.floor.point_in_any_room(fp["mx"], fp["my"]) is not None
        ]
        MIN_PTS_PER_ROOM = 5
        room_ready = len(room_fps) >= MIN_PTS_PER_ROOM

        # Reduce still-time requirement when room needs more points (bootstrapping)
        effective_still = opts.get(OPT_AUTO_CAL_STILL_SEC, DEFAULT_STILL_SEC)
        if not room_ready:
            effective_still = max(10, effective_still // 3)  # 3x faster when bootstrapping

        if now - self._still_since < effective_still:
            return

        existing = next(
            (fp for fp in self.fingerprints
             if fp.get("device_id", self.device_id) == self.device_id
             and abs(fp["mx"] - snapped[0]) < 0.01 and abs(fp["my"] - snapped[1]) < 0.01),
            None,
        )

        # Skip if point already exists and is still "fresh enough".
        # Manual prints (auto=False) have their own configurable max age
        # (default 30 days) – separate from auto-prints (default 7 days).
        if room_ready and when == WHEN_MISSING and existing:
            age_days = (time.time() - existing.get("ts", 0)) / 86400
            is_manual = not existing.get("auto", False)
            if is_manual:
                effective_max_age = opts.get(OPT_AUTO_CAL_MANUAL_AGE, DEFAULT_MANUAL_AGE_DAYS)
            else:
                effective_max_age = max_age
            if age_days <= effective_max_age:
                return

        if now - self._last_auto_cal < 10.0:
            return

        await self.async_capture_fingerprint(snapped[0], snapped[1], auto=True)
        self._still_since = None

        today = dt_util.now().strftime("%Y-%m-%d")
        if today != self._ac_last_date:
            self._ac_count_today = 0
            self._ac_last_date   = today
        self._ac_count_today += 1
        self._last_auto_cal = now
        self._last_auto_cal_ts = time.time()

        _LOGGER.info(
            "Auto-calibrated %s @ (%.2f, %.2f)",
            self.device_name, snapped[0], snapped[1],
        )
        await self._send_notification(snapped[0], snapped[1])

    async def _send_notification(self, mx: float, my: float) -> None:
        notify = self.floor.entry.options.get(OPT_AUTO_CAL_NOTIFY, NOTIFY_NONE)
        msg    = f"Auto-kalibriert: {mx:.2f}m / {my:.2f}m ({self.device_name})"
        if notify == NOTIFY_PERSISTENT:
            await self.hass.services.async_call(
                "persistent_notification", "create",
                {"message": msg, "title": "BLE Positioning"},
            )
        elif notify == NOTIFY_MOBILE:
            await self.hass.services.async_call(
                "notify", "mobile_app",
                {"message": msg, "title": "BLE Positioning"},
                blocking=False,
            )

    # ── Fingerprint management ────────────────────────────────

    async def async_capture_fingerprint(
        self,
        mx: float,
        my: float,
        *,
        auto: bool = False,
    ) -> bool:
        fp: dict[str, Any] = {
            "mx": round(mx, 2),
            "my": round(my, 2),
            "ts": time.time(),
            "auto": auto,
        }
        for s in self.floor.scanners:
            entity = self._scanner_entity(s)
            val    = self._vals.get(entity)
            try:
                fp[s[CONF_SCANNER_ID]] = float(val) if val is not None else None
            except (ValueError, TypeError):
                fp[s[CONF_SCANNER_ID]] = None  # z.B. "unavailable" oder "unknown"

        missing = [s[CONF_SCANNER_ID] for s in self.floor.scanners if fp.get(s[CONF_SCANNER_ID]) is None]
        _LOGGER.debug("Capture %s @ (%.2f,%.2f) – vals: %s", self.device_name, mx, my, fp)
        if len(missing) == len(self.floor.scanners):
            _LOGGER.warning(
                "Capture skipped – no scanner data at all for %s. "
                "Missing entities: %s. Current _vals keys: %s",
                self.device_name,
                [self._scanner_entity(s) or "?" for s in self.floor.scanners],
                list(self._vals.keys()),
            )
            return False
        if missing:
            _LOGGER.warning(
                "%s: %d/%d scanner(s) missing data – capturing anyway with partial data: %s",
                self.device_name, len(missing), len(self.floor.scanners), missing,
            )

        # Replace existing point at same location
        self.fingerprints = [
            f for f in self.fingerprints
            if not (abs(f["mx"] - fp["mx"]) < 0.01 and abs(f["my"] - fp["my"]) < 0.01)
        ]
        self.fingerprints.append(fp)
        await self._save_fingerprints()
        self._fire_signal()
        return True

    async def async_clear_fingerprints(self) -> None:
        self.fingerprints.clear()
        await self._save_fingerprints()
        self._fire_signal()

    async def async_import_fingerprints(self, fps: list[dict]) -> int:
        self.fingerprints = fps
        await self._save_fingerprints()
        self._fire_signal()
        return len(fps)

    # ── Storage ───────────────────────────────────────────────

    async def _load_fingerprints(self) -> None:
        data = await self._store.async_load()
        if data:
            self.fingerprints = data.get("fingerprints", [])
            _LOGGER.debug(
                "Loaded %d fingerprints for %s",
                len(self.fingerprints), self.device_name,
            )

    async def _save_fingerprints(self) -> None:
        await self._store.async_save({"fingerprints": self.fingerprints})
