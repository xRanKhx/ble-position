"""BLE Indoor Positioning – Integration root."""
from __future__ import annotations

import logging
import pathlib
import voluptuous as vol

from homeassistant.components.http import HomeAssistantView
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError

from .const import (
    SERVICE_PTZ_TRACK, SERVICE_FALL_ALARM_RESET, SERVICE_MMWAVE_PROFILE_RESET,
    OPT_AUTO_CAL_MAX_AGE, OPT_AUTO_CAL_MANUAL_AGE,
    DOMAIN,
    SERVICE_CAPTURE_FP, SERVICE_CLEAR_FP,
)
from .coordinator import BLEFloorCoordinator

_LOGGER   = logging.getLogger(__name__)
PLATFORMS = ["sensor", "number", "binary_sensor", "select", "button", "switch"]

_FRONTEND_DIR = pathlib.Path(__file__).parent / "frontend"
_CARD_JS      = _FRONTEND_DIR / "ble-positioning-card.js"
_TRACKER_JS   = _FRONTEND_DIR / "ble-positioning-tracker.js"
_CARD_URL          = "/ble_positioning/ble-positioning-card.js"    # internal static
_TRACKER_URL       = "/ble_positioning/ble-positioning-tracker.js" # internal static
# Cache-busting: version appended at runtime in async_setup_entry
_CARD_LOCAL_URL      = "/local/ble_positioning/ble-positioning-card.js"      # Lovelace
_TRACKER_LOCAL_URL   = "/local/ble_positioning/ble-positioning-tracker.js"  # Lovelace
# View-Card entfernt (war überflüssiger Wrapper für ble-positioning-card)
_WWW_SUBDIR        = "ble_positioning"  # all www files live in /config/www/ble_positioning/

# Version aus manifest.json – einmalig beim Modul-Import geladen
try:
    import json as _json
    _ver = _json.loads((pathlib.Path(__file__).parent / "manifest.json").read_text()).get("version", "0")
except Exception:
    _ver = "0"


# ─────────────────────────────────────────────────────────────────────────────

async def _async_register_services(hass) -> None:
    """Register BLE Positioning automation services."""
    import voluptuous as vol
    from homeassistant.core import ServiceCall
    from homeassistant.exceptions import HomeAssistantError
    from homeassistant.helpers.dispatcher import async_dispatcher_send

    async def handle_ptz_track(call: ServiceCall) -> None:
        entry_id  = call.data.get("entry_id", "")
        camera_id = call.data.get("camera_id", "")
        mode      = call.data.get("mode")
        target_x  = call.data.get("floor_x")
        target_y  = call.data.get("floor_y")
        coord = _get_coordinator(hass, entry_id)
        if not coord: raise HomeAssistantError(f"Entry nicht gefunden")
        for cam in coord.ptz_cameras:
            if cam.get("id") == camera_id or not camera_id:
                if mode: cam["tracking_mode"] = mode
                if target_x is not None and target_y is not None:
                    cam["tracking_mode"] = "fixed"
                    cam["_override_x"] = float(target_x); cam["_override_y"] = float(target_y)
                await coord.async_update_ptz_cameras(coord.ptz_cameras)
                break

    async def handle_fall_reset(call: ServiceCall) -> None:
        entry_id  = call.data.get("entry_id", "")
        sensor_id = call.data.get("sensor_id", "")
        target_id = int(call.data.get("target_id", 0))
        coord = _get_coordinator(hass, entry_id)
        if not coord: raise HomeAssistantError("Entry nicht gefunden")
        hass.bus.async_fire("ble_positioning_fall_detected_reset",
            {"entry_id": entry_id, "sensor_id": sensor_id, "target_id": target_id})
        cache = getattr(coord, "mmwave_fall_cache", None) or {}
        key = f"{sensor_id}_{target_id}"
        if key in cache: cache[key]["phase"] = "normal"; cache[key]["alarmFired"] = False
        async_dispatcher_send(hass, f"ble_positioning_cfg_updated_{coord.entry.entry_id}")

    async def handle_profile_reset(call: ServiceCall) -> None:
        entry_id  = call.data.get("entry_id", "")
        sensor_id = call.data.get("sensor_id", "")
        target_id = int(call.data.get("target_id", 0))
        coord = _get_coordinator(hass, entry_id)
        if not coord: raise HomeAssistantError("Entry nicht gefunden")
        cache = getattr(coord, "mmwave_classify_cache", None) or {}
        cache.pop(f"{sensor_id}_{target_id}", None)

    schema_entry = vol.Schema({
        vol.Optional("entry_id", default=""): str,
        vol.Optional("sensor_id", default=""): str,
        vol.Optional("target_id", default=0): vol.Coerce(int),
    })

    hass.services.async_register(DOMAIN, "ptz_track", handle_ptz_track,
        schema=vol.Schema({
            vol.Optional("entry_id", default=""): str,
            vol.Optional("camera_id", default=""): str,
            vol.Optional("floor_x"): vol.Coerce(float),
            vol.Optional("floor_y"): vol.Coerce(float),
            vol.Optional("mode"): vol.In(["fixed","priority","tour","centroid"]),
        }))
    hass.services.async_register(DOMAIN, "fall_alarm_reset",     handle_fall_reset,    schema=schema_entry)
    hass.services.async_register(DOMAIN, "mmwave_profile_reset", handle_profile_reset, schema=schema_entry)


def _get_coordinator(hass, entry_id: str = ""):
    domain_data = hass.data.get(DOMAIN, {})
    if entry_id and entry_id in domain_data: return domain_data[entry_id]
    return next(iter(domain_data.values()), None) if domain_data else None


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up BLE Positioning from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # ── Migrate old flat www paths to new subdir (one-time, silent) ──────────
    await hass.async_add_executor_job(_migrate_www_paths, hass, entry)

    # Copy JS files to /config/www/ble_positioning/ using executor (non-blocking)
    await hass.async_add_executor_job(_copy_js_files, hass)

    # Register static path as fallback
    for url, path in [(_CARD_URL, _CARD_JS), (_TRACKER_URL, _TRACKER_JS)]:
        try:
            hass.http.register_static_path(url, str(path), cache_headers=False)
        except Exception:
            pass

    # ── Lovelace Resources: NUR LESEN + WARNEN, niemals löschen oder schreiben ──
    # KRITISCH: async_delete_item / async_create_item beim Start zerstört andere
    # Custom-Cards (advanced-camera-card, bubble-card usw.) weil HA beim ersten
    # Start noch nicht alle HACS-Resources geladen hat (Race Condition) und weil
    # async_items() eine Live-View zurückgibt die beim Iterieren + Mutieren
    # inkonsistent wird. Die JS-Dateien werden ausschließlich über register_static_path
    # (oben) und /config/www/ble_positioning/ bereitgestellt.
    # Ressourcen müssen einmalig manuell in HA → Einstellungen → Dashboards → Ressourcen
    # eingetragen werden ODER werden beim ersten Setup-Dialog automatisch eingetragen.
    try:
        lovelace = hass.data.get("lovelace")
        if lovelace and hasattr(lovelace, "resources"):
            existing_urls = {r.get("url", "").split("?")[0]
                             for r in lovelace.resources.async_items()}
            our_base_paths = {_CARD_LOCAL_URL, _TRACKER_LOCAL_URL}
            missing = our_base_paths - existing_urls
            if missing:
                _LOGGER.warning(
                    "BLE Positioning: Lovelace-Ressourcen fehlen – bitte einmalig manuell in "
                    "Einstellungen → Dashboards → Ressourcen eintragen: %s",
                    [f"{u}?v={_ver}" for u in missing]
                )
            else:
                _LOGGER.info("BLE Positioning: Lovelace-Ressourcen vorhanden – OK")
    except Exception as exc:
        _LOGGER.debug("BLE Positioning: Lovelace-Resource-Check fehlgeschlagen: %s", exc)

    # Create coordinator
    coordinator = BLEFloorCoordinator(hass, entry)
    await coordinator.async_setup()
    await coordinator.async_config_entry_first_refresh()
    hass.data[DOMAIN][entry.entry_id] = coordinator

    # Forward to sensor platform
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # HTTP API views
    for view_cls in [
        BLECardDataView, BLECaptureFPView, BLEClearFPView,
        BLEAddDeviceView, BLEUpdateDeviceView,
        BLEUpdateAlarmsView,
        BLEUpdateEnergyView,
        BLEUpdateOptionsView,
        BLEUpdateDekoView,
        BLEUpdateInfoSensorsView,
        BLEUpdateFloorsView,
        BLESetActiveFloorView,
        BLEExportFPView, BLEImportFPView,
        BLEUpdateScannersView, BLEUpdateRoomsView,
        BLEUpdateFloorView, BLEUpdateGridStepView,
        BLEUploadImageView, BLEClearImageView,
        BLEUpdateFpAgeView,
        BLEUpdateLightsView,
        BLECustomDesignsView,
        BLEMmwaveSensorsView,
    ]:
        hass.http.register_view(view_cls(coordinator, entry.entry_id))

    # Services
    _register_services(hass, coordinator)

    # Sidebar
    await _apply_sidebar(hass, entry)

    # Only reload on real options changes, not data changes
    entry.async_on_unload(entry.add_update_listener(_options_listener))
    return True



def _migrate_www_paths(hass, entry) -> None:
    """Move old flat www files into the ble_positioning subdir (v2.10.12 migration).

    Old layout:  /config/www/ble_floor_XXXXXXXX.jpg
                 /config/www/ble-positioning-card.js
    New layout:  /config/www/ble_positioning/ble_floor_XXXXXXXX.jpg
                 /config/www/ble_positioning/ble-positioning-card.js
    """
    import os, shutil
    www_root = os.path.join(hass.config.config_dir, "www")
    www_sub  = os.path.join(www_root, _WWW_SUBDIR)
    os.makedirs(www_sub, exist_ok=True)

    # Move JS files
    for js in ("ble-positioning-card.js", "ble-positioning-tracker.js"):
        old_path = os.path.join(www_root, js)
        new_path = os.path.join(www_sub,  js)
        if os.path.exists(old_path) and not os.path.exists(new_path):
            try:
                shutil.move(old_path, new_path)
                _LOGGER.info("BLE Positioning: migriert %s → www/%s/", js, _WWW_SUBDIR)
            except Exception as exc:
                _LOGGER.warning("BLE Positioning: Migration %s fehlgeschlagen: %s", js, exc)

    # Move floor image if stored with old flat path (no slash in stored value)
    stored_path = entry.data.get("image_path") or entry.options.get("image_path", "")
    if stored_path and "/" not in stored_path and stored_path.startswith("ble_floor_"):
        old_img = os.path.join(www_root, stored_path)
        new_img = os.path.join(www_sub,  stored_path)
        if os.path.exists(old_img) and not os.path.exists(new_img):
            try:
                shutil.move(old_img, new_img)
                _LOGGER.info("BLE Positioning: Bild migriert → www/%s/%s", _WWW_SUBDIR, stored_path)
            except Exception as exc:
                _LOGGER.warning("BLE Positioning: Bild-Migration fehlgeschlagen: %s", exc)

def _copy_js_files(hass: HomeAssistant) -> None:
    """Copy JS files to /config/www/ – always overwrite to ensure latest version."""
    import shutil, os
    www_dir = os.path.join(hass.config.config_dir, "www", _WWW_SUBDIR)
    os.makedirs(www_dir, exist_ok=True)
    for src_path, filename in [
        (_CARD_JS,    "ble-positioning-card.js"),
        (_TRACKER_JS, "ble-positioning-tracker.js"),

    ]:
        dst = os.path.join(www_dir, filename)
        try:
            shutil.copy2(str(src_path), dst)  # always overwrite
            _LOGGER.info("BLE Positioning: %s kopiert", filename)
        except Exception as exc:
            _LOGGER.warning("BLE Positioning: Konnte %s nicht kopieren: %s", filename, exc)


async def _options_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Called only when options change (sidebar toggle, algo settings).
    Data changes (rooms, scanners, floor) do NOT trigger this.
    NOTE: We intentionally do NOT reload the entry here – a full reload would
    cause HA to briefly unload/reload all Lovelace resources and can remove
    other custom dashboard cards from the UI. Sidebar changes take effect
    immediately via _apply_sidebar without a reload."""
    await _apply_sidebar(hass, entry)


async def _apply_sidebar(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Register or remove sidebar panel. Cleans up old yaml block if present."""
    import os, re

    enabled  = entry.options.get("sidebar_enabled", True)  # default True
    url_path = "ble-positioning-config"

    # Clean up old yaml block in executor (non-blocking file I/O)
    yaml_path = os.path.join(hass.config.config_dir, "configuration.yaml")
    await hass.async_add_executor_job(_clean_yaml_block, yaml_path)

    # Register / unregister via panel_custom API
    try:
        from homeassistant.components.panel_custom import async_register_panel
        from homeassistant.components.frontend import async_remove_panel

        already = url_path in hass.data.get("frontend_panels", {})

        if not already:
            try:
                await async_register_panel(
                    hass,
                    component_name    = "ble-positioning-card",
                    sidebar_title     = "BLE Positioning",
                    sidebar_icon      = "mdi:map-marker-radius",
                    frontend_url_path = url_path,
                    config            = {"entry_id": entry.entry_id},
                    require_admin     = False,
                    module_url        = f"/local/{_WWW_SUBDIR}/ble-positioning-card.js?v={_ver}",
                    embed_iframe      = False,
                )
            except TypeError:
                await async_register_panel(
                    hass,
                    webcomponent_name = "ble-positioning-card",
                    sidebar_title     = "BLE Positioning",
                    sidebar_icon      = "mdi:map-marker-radius",
                    frontend_url_path = url_path,
                    config            = {"entry_id": entry.entry_id},
                    require_admin     = False,
                    module_url        = f"/local/{_WWW_SUBDIR}/ble-positioning-card.js?v={_ver}",
                    embed_iframe      = False,
                )
            _LOGGER.info("BLE Positioning: Sidebar-Panel registriert")

        elif not enabled and already:
            async_remove_panel(hass, url_path)
            _LOGGER.info("BLE Positioning: Sidebar-Panel entfernt")

    except Exception as exc:
        _LOGGER.warning("BLE Positioning: Panel-Registrierung fehlgeschlagen: %s", exc)


def _clean_yaml_block(yaml_path: str) -> None:
    """Remove old BLE panel block from configuration.yaml – runs in executor."""
    import re, os
    try:
        if not os.path.exists(yaml_path):
            return
        txt = open(yaml_path, encoding="utf-8").read()
        if "BLE_POSITIONING_PANEL_START" not in txt:
            return
        cleaned = re.sub(
            r"\n?# BLE_POSITIONING_PANEL_START.*?# BLE_POSITIONING_PANEL_END\n?",
            "",
            txt,
            flags=re.DOTALL,
        )
        open(yaml_path, "w", encoding="utf-8").write(cleaned)
        _LOGGER.info("BLE Positioning: alter yaml-Panel-Block entfernt")
    except Exception as exc:
        _LOGGER.debug("BLE Positioning: yaml cleanup failed: %s", exc)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    coordinator: BLEFloorCoordinator = hass.data[DOMAIN][entry.entry_id]
    await coordinator.async_shutdown()
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return ok


# ─────────────────────────────────────────────────────────────────────────────
def _register_services(hass: HomeAssistant, coordinator: BLEFloorCoordinator) -> None:

    async def _capture(call: ServiceCall) -> None:
        dev_id  = call.data["device_id"]
        tracker = coordinator.trackers.get(dev_id)
        if not tracker:
            _LOGGER.error("capture_fingerprint: device '%s' not found", dev_id)
            return
        await tracker.async_capture_fingerprint(
            float(call.data["x"]), float(call.data["y"])
        )

    async def _clear(call: ServiceCall) -> None:
        dev_id  = call.data["device_id"]
        tracker = coordinator.trackers.get(dev_id)
        if not tracker:
            _LOGGER.error("clear_fingerprints: device '%s' not found", dev_id)
            return
        await tracker.async_clear_fingerprints()

    if not hass.services.has_service(DOMAIN, SERVICE_CAPTURE_FP):
        hass.services.async_register(
            DOMAIN, SERVICE_CAPTURE_FP, _capture,
            schema=vol.Schema({
                vol.Required("device_id"): str,
                vol.Required("x"):         vol.Coerce(float),
                vol.Required("y"):         vol.Coerce(float),
            }),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_CLEAR_FP):
        hass.services.async_register(
            DOMAIN, SERVICE_CLEAR_FP, _clear,
            schema=vol.Schema({vol.Required("device_id"): str}),
        )


# ─────────────────────────────────────────────────────────────────────────────
# HTTP Views
# ─────────────────────────────────────────────────────────────────────────────

class _Base(HomeAssistantView):
    requires_auth = True

    def __init__(self, coordinator: BLEFloorCoordinator, entry_id: str) -> None:
        self._c   = coordinator
        self._eid = entry_id

    def _check(self, entry_id: str) -> bool:
        return entry_id == self._eid


class BLECardDataView(_Base):
    url  = "/api/ble_positioning/{entry_id}/card_data"
    name = "api:ble:card_data"

    async def get(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        return self.json(self._c.get_card_data())


class BLECaptureFPView(_Base):
    url  = "/api/ble_positioning/{entry_id}/capture"
    name = "api:ble:capture"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d      = await request.json()
            dev_id = d["device_id"]
            mx, my = float(d["x"]), float(d["y"])
        except Exception:
            return self.json_message("Invalid body", 400)
        tracker = self._c.trackers.get(dev_id)
        if not tracker:
            return self.json_message(f"Device '{dev_id}' not found", 404)
        try:
            ok = await tracker.async_capture_fingerprint(mx, my)
        except Exception as exc:
            import traceback
            _LOGGER.error("BLE capture error: %s", traceback.format_exc())
            return self.json_message(f"Internal error: {exc}", 500)
        if ok:
            return self.json({"status": "ok", "fp_count": len(tracker.fingerprints)})
        return self.json_message("No sensor data", 503)


class BLEClearFPView(_Base):
    url  = "/api/ble_positioning/{entry_id}/clear"
    name = "api:ble:clear"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d      = await request.json()
            dev_id = d["device_id"]
        except Exception:
            return self.json_message("Invalid body", 400)
        tracker = self._c.trackers.get(dev_id)
        if not tracker:
            return self.json_message(f"Device '{dev_id}' not found", 404)
        await tracker.async_clear_fingerprints()
        return self.json({"status": "ok"})


class BLEExportFPView(_Base):
    url  = "/api/ble_positioning/{entry_id}/export"
    name = "api:ble:export"

    async def get(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        dev_id  = request.rel_url.query.get("device_id", "")
        tracker = self._c.trackers.get(dev_id)
        if not tracker:
            return self.json_message(f"Device '{dev_id}' not found", 404)
        return self.json({
            "version":      1,
            "device_id":    dev_id,
            "device_name":  tracker.device_name,
            "floor_w":      self._c.floor_w,
            "floor_h":      self._c.floor_h,
            "scanners":     self._c.scanners,
            "fingerprints": tracker.fingerprints,
        })


class BLEImportFPView(_Base):
    url  = "/api/ble_positioning/{entry_id}/import"
    name = "api:ble:import"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d      = await request.json()
            dev_id = d.get("device_id", "")
            fps    = d.get("fingerprints") or d.get("points") or []
        except Exception:
            return self.json_message("Invalid JSON", 400)
        tracker = self._c.trackers.get(dev_id)
        if not tracker:
            return self.json_message(f"Device '{dev_id}' not found", 404)
        count = await tracker.async_import_fingerprints(fps)
        return self.json({"status": "ok", "imported": count})


class BLEUpdateScannersView(_Base):
    url  = "/api/ble_positioning/{entry_id}/scanners"
    name = "api:ble:scanners"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d        = await request.json()
            scanners = d["scanners"]
        except Exception:
            return self.json_message("Invalid body", 400)
        await self._c.async_update_scanners(scanners)
        return self.json({"status": "ok", "count": len(scanners)})


class BLEAddDeviceView(_Base):
    url  = "/api/ble_positioning/{entry_id}/add_device"
    name = "api:ble:add_device"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d              = await request.json()
            device_id      = d["device_id"]
            device_name    = d["device_name"]
            entity_map     = d.get("entity_map", {})      # {scanner_key: dist_entity}
            entity_map_raw = d.get("entity_map_raw", {})  # {scanner_key: raw_entity}
        except Exception:
            return self.json_message("Invalid body", 400)

        if device_id in self._c.trackers:
            return self.json_message(f"Device '{device_id}' already exists", 409)

        device_cfg = {
            "device_id":          device_id,
            "device_name":        device_name,
            "scanner_entities":   entity_map,
            "scanner_entities_raw": entity_map_raw,
        }
        await self._c.async_add_device(device_cfg)
        return self.json({"status": "ok", "device_id": device_id})


class BLEUpdateDeviceView(_Base):
    url  = "/api/ble_positioning/{entry_id}/update_device"
    name = "api:ble:update_device"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d              = await request.json()
            device_id      = d["device_id"]
            device_name    = d.get("device_name")
            entity_map     = d.get("entity_map", {})
            entity_map_raw = d.get("entity_map_raw", {})
        except Exception:
            return self.json_message("Invalid body", 400)

        tracker = self._c.trackers.get(device_id)
        if not tracker:
            return self.json_message(f"Device '{device_id}' not found", 404)

        # Update in-memory + persistent config
        if device_name:
            tracker.device_name = device_name
            tracker.device_cfg["device_name"] = device_name
        if entity_map is not None:
            tracker.device_cfg["scanner_entities"] = entity_map
        if entity_map_raw is not None:
            tracker.device_cfg["scanner_entities_raw"] = entity_map_raw

        # Persist: update devices list in entry data
        devices = [
            {**dev, **(tracker.device_cfg if dev.get("device_id") == device_id else {})}
            for dev in self._c.devices
        ]
        self._c.devices = devices
        new_data = {**self._c.entry.data, "devices": devices}
        self._c.hass.config_entries.async_update_entry(self._c.entry, data=new_data)

        # Re-subscribe so new entities are tracked
        for unsub in self._c._unsubs:
            unsub()
        self._c._unsubs.clear()
        self._c._subscribe_scanners()
        tracker._prefill_vals()

        return self.json({"status": "ok", "device_id": device_id})


class BLEUpdateFloorsView(_Base):
    """CRUD for multi-floor config."""
    url  = "/api/ble_positioning/{entry_id}/floors"
    name = "api:ble:floors"

    async def get(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        return self.json({
            "floors":       self._c.floors,
            "active_floor": self._c.active_floor,
        })

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d = await request.json()
            floors       = d["floors"]
            active_floor = int(d.get("active_floor", 0))
        except Exception:
            return self.json_message("Invalid body", 400)
        await self._c.async_update_floors(floors, active_floor)
        return self.json({"status": "ok", "floors": len(floors), "active_floor": active_floor})


class BLESetActiveFloorView(_Base):
    url  = "/api/ble_positioning/{entry_id}/active_floor"
    name = "api:ble:active_floor"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d = await request.json()
            floor_idx = int(d["floor_idx"])
        except Exception:
            return self.json_message("Invalid body", 400)
        await self._c.async_set_active_floor(floor_idx)
        return self.json({"status": "ok", "active_floor": floor_idx})


class BLEUpdateInfoSensorsView(_Base):
    url  = "/api/ble_positioning/{entry_id}/info_sensors"
    name = "api:ble:info_sensors"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d       = await request.json()
            sensors = d["info_sensors"]
        except Exception:
            return self.json_message("Invalid body", 400)
        await self._c.async_update_info_sensors(sensors)
        return self.json({"status": "ok", "count": len(sensors)})


class BLEUpdateOptionsView(_Base):
    url  = "/api/ble_positioning/{entry_id}/options"
    name = "api:ble:options"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d = await request.json()
        except Exception:
            return self.json_message("Invalid body", 400)
        await self._c.async_update_options(
            d.get("options", {}),
            d.get("heating_rooms", {}),
            d.get("wall_height", None),
            d.get("wall_color", "__UNSET__"),
            d.get("wall_alpha", None)
        )
        return self.json({"status": "ok"})


class BLEUpdateDekoView(_Base):
    url  = "/api/ble_positioning/{entry_id}/deko"
    name = "api:ble:deko"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id): return self.json_message("Not found", 404)
        try: d = await request.json()
        except Exception: return self.json_message("Invalid body", 400)
        self._c.decos = d.get("decos", [])
        await self._c.async_save_floor_store()
        return self.json({"status": "ok"})


class BLEUpdateEnergyView(_Base):
    url  = "/api/ble_positioning/{entry_id}/energy"
    name = "api:ble:energy"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d            = await request.json()
            energy_lines = d["energy_lines"]
            batteries    = d["batteries"]
        except Exception:
            return self.json_message("Invalid body", 400)
        await self._c.async_update_energy(energy_lines, batteries)
        return self.json({"status": "ok"})


class BLEUpdateAlarmsView(_Base):
    url  = "/api/ble_positioning/{entry_id}/alarms"
    name = "api:ble:alarms"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d      = await request.json()
            alarms = d["alarms"]
        except Exception:
            return self.json_message("Invalid body", 400)
        await self._c.async_update_alarms(alarms)
        return self.json({"status": "ok", "count": len(alarms)})


class BLEUpdateRoomsView(_Base):
    url  = "/api/ble_positioning/{entry_id}/rooms"
    name = "api:ble:rooms"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d            = await request.json()
            rooms        = d["rooms"]
            doors        = d.get("doors", None)
            door_penalty = d.get("door_penalty", None)
            windows      = d.get("windows", None)
        except Exception:
            return self.json_message("Invalid body", 400)
        await self._c.async_update_rooms(rooms, doors, door_penalty, windows)
        return self.json({"status": "ok", "count": len(rooms)})


class BLEUpdateGridStepView(_Base):
    url  = "/api/ble_positioning/{entry_id}/grid_step"
    name = "api:ble:grid_step"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d    = await request.json()
            step = float(d["grid_step"])
        except Exception:
            return self.json_message("Invalid body", 400)
        if step < 0.1 or step > 5.0:
            return self.json_message("grid_step must be 0.1–5.0", 400)
        await self._c.async_update_grid_step(step)
        return self.json({"status": "ok", "grid_step": step})


class BLEUpdateFloorView(_Base):
    url  = "/api/ble_positioning/{entry_id}/floor"
    name = "api:ble:floor"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            d = await request.json()
            w = float(d["floor_w"])
            h = float(d["floor_h"])
        except Exception:
            return self.json_message("Invalid body", 400)
        if w < 1 or h < 1 or w > 500 or h > 500:
            return self.json_message("Invalid dimensions", 400)
        img_opacity = d.get("img_opacity")
        if img_opacity is not None:
            try: img_opacity = float(img_opacity)
            except: img_opacity = None
        await self._c.async_update_floor_size(w, h, img_opacity)
        return self.json({"status": "ok", "floor_w": w, "floor_h": h})


class BLEUploadImageView(_Base):
    """POST /api/ble_positioning/{entry_id}/upload_image  – multipart or raw bytes"""
    url  = "/api/ble_positioning/{entry_id}/upload_image"
    name = "api:ble:upload_image"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        import os, base64 as _b64

        hass    = self._c.hass
        www_dir = os.path.join(hass.config.config_dir, "www", _WWW_SUBDIR)
        await hass.async_add_executor_job(os.makedirs, www_dir, 0o755, True)

        try:
            data = await request.json()
            b64  = data.get("image_b64", "")
            ext  = data.get("ext", "png").lower().strip(".")
            if ext not in ("png", "jpg", "jpeg", "gif", "webp", "svg"):
                ext = "png"
            if not b64:
                return self.json_message("No image data", 400)
            raw = _b64.b64decode(b64)
        except Exception as exc:
            return self.json_message(f"Invalid body: {exc}", 400)

        filename = f"ble_floor_{entry_id[:8]}.{ext}"
        path     = os.path.join(www_dir, filename)

        def _write() -> None:
            with open(path, "wb") as fh:
                fh.write(raw)

        await hass.async_add_executor_job(_write)
        # Store as "ble_positioning/filename" so /local/ble_positioning/filename works
        await self._c.async_update_image_path(f"{_WWW_SUBDIR}/{filename}")
        return self.json({"status": "ok", "filename": filename})


class BLEClearImageView(_Base):
    """DELETE /api/ble_positioning/{entry_id}/upload_image"""
    url  = "/api/ble_positioning/{entry_id}/clear_image"
    name = "api:ble:clear_image"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        await self._c.async_update_image_path("")
        return self.json({"status": "ok"})


class BLEUpdateFpAgeView(_Base):
    """POST /api/ble_positioning/{entry_id}/fp_age
    Body: { auto_fp_max_age: int, manual_fp_max_age: int }
    Writes directly to entry.options so number entities and coordinator
    stay in sync without a reload.
    """
    url  = "/api/ble_positioning/{entry_id}/fp_age"
    name = "api:ble:fp_age"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            data = await request.json()
        except Exception:
            return self.json_message("Invalid JSON", 400)

        entry   = self._c.entry
        new_opts = dict(entry.options)

        if "auto_fp_max_age" in data:
            val = int(data["auto_fp_max_age"])
            if not (1 <= val <= 3650):
                return self.json_message("auto_fp_max_age out of range 1-3650", 400)
            new_opts[OPT_AUTO_CAL_MAX_AGE] = val

        if "manual_fp_max_age" in data:
            val = int(data["manual_fp_max_age"])
            if not (1 <= val <= 3650):
                return self.json_message("manual_fp_max_age out of range 1-3650", 400)
            new_opts[OPT_AUTO_CAL_MANUAL_AGE] = val

        # Update options WITHOUT triggering a reload (values are read live from opts)
        request.app["hass"].config_entries.async_update_entry(entry, options=new_opts)
        return self.json({"status": "ok",
                          "auto_fp_max_age":   new_opts.get(OPT_AUTO_CAL_MAX_AGE),
                          "manual_fp_max_age": new_opts.get(OPT_AUTO_CAL_MANUAL_AGE)})


class BLEOptsView(_Base):
    """POST /api/ble_positioning/{entry_id}/opts – Sync UI options to backend."""
    url  = "/api/ble_positioning/{entry_id}/opts"
    name = "api:ble:opts"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id): return self.json_message("Not found", 404)
        try: d = await request.json()
        except Exception: return self.json_message("Invalid body", 400)
        opts = d.get("opts", {})
        if not isinstance(opts, dict): return self.json_message("opts must be dict", 400)
        # Store in coordinator opts_cache
        if not self._c.opts_cache: self._c.opts_cache = {}
        self._c.opts_cache.update(opts)
        return self.json({"ok": True, "synced": list(opts.keys())})


class BLEPtzCamerasView(_Base):
    """POST /api/ble_positioning/{entry_id}/ptz_cameras"""
    url  = "/api/ble_positioning/{entry_id}/ptz_cameras"
    name = "api:ble:ptz_cameras"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id): return self.json_message("Not found", 404)
        try: d = await request.json()
        except Exception: return self.json_message("Invalid body", 400)
        cameras = d.get("cameras", [])
        await self._c.async_update_ptz_cameras(cameras)
        return self.json({"ok": True, "count": len(cameras)})


class BLEOnvifProxyView(_Base):
    """POST /api/ble_positioning/onvif_proxy – CORS-freier ONVIF Proxy"""
    url  = "/api/ble_positioning/onvif_proxy"
    name = "api:ble:onvif_proxy"
    requires_auth = True

    async def post(self, request, entry_id: str = ""):
        import aiohttp
        try: d = await request.json()
        except Exception: return self.json_message("Invalid body", 400)
        url  = d.get("url", "")
        soap = d.get("soap", "")
        user = d.get("user", "admin")
        pw   = d.get("pass", "")
        if not url or not soap:
            return self.json_message("Missing url or soap", 400)
        # SSRF-Schutz: nur private Netzwerk-IPs erlauben
        import ipaddress, urllib.parse
        try:
            parsed = urllib.parse.urlparse(url)
            host = parsed.hostname or ""
            try:
                ip = ipaddress.ip_address(host)
                if not (ip.is_private or ip.is_loopback or ip.is_link_local):
                    return self.json_message("Only private network IPs allowed", 403)
            except ValueError:
                # Hostname (kein IP) – erlauben für lokale Netzwerknamen wie 'camera.local'
                pass
        except Exception:
            return self.json_message("Invalid URL", 400)
        try:
            auth = aiohttp.BasicAuth(user, pw)
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=soap.encode(),
                    headers={"Content-Type":"application/soap+xml"},
                    auth=auth, timeout=aiohttp.ClientTimeout(total=3)) as resp:
                    body = await resp.text()
                    return self.json({"ok": resp.status < 300, "status": resp.status, "body": body[:500]})
        except Exception as e:
            return self.json({"ok": False, "error": str(e)})


class BLEMmwaveSensorsView(_Base):
    """POST /api/ble_positioning/{entry_id}/mmwave_sensors"""
    url  = "/api/ble_positioning/{entry_id}/mmwave_sensors"
    name = "api:ble:mmwave_sensors"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id): return self.json_message("Not found", 404)
        try: d = await request.json()
        except Exception: return self.json_message("Invalid body", 400)
        sensors = d.get("sensors", [])
        await self._c.async_update_mmwave_sensors(sensors)
        return self.json({"ok": True, "count": len(sensors)})


class BLECustomDesignsView(_Base):
    """POST /api/ble_positioning/{entry_id}/custom_designs
    Body: { designs: [ {id, name, type, shapes2d, shapes3d, ...} ] }
    """
    url  = "/api/ble_positioning/{entry_id}/custom_designs"
    name = "api:ble:custom_designs"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id): return self.json_message("Not found", 404)
        try: d = await request.json()
        except Exception: return self.json_message("Invalid body", 400)
        designs = d.get("designs", [])
        await self._c.async_update_custom_designs(designs)
        return self.json({"ok": True, "count": len(designs)})


class BLEUpdateLightsView(_Base):
    """POST /api/ble_positioning/{entry_id}/lights
    Body: { lights: [ {id, name, entity, mx, my} ... ] }
    Saves light sources to floor store – no reload needed.
    """
    url  = "/api/ble_positioning/{entry_id}/lights"
    name = "api:ble:lights"

    async def post(self, request, entry_id: str):
        if not self._check(entry_id):
            return self.json_message("Not found", 404)
        try:
            data = await request.json()
        except Exception:
            return self.json_message("Invalid JSON", 400)
        lights = data.get("lights", [])
        await self._c.async_update_lights(lights)
        return self.json({"status": "ok", "count": len(lights)})
