"""Config flow – BLE Indoor Positioning.

Step structure
──────────────
user  →  floor        (name, dimensions, image path)
      →  devices      (add N tracked devices with their HA entities)
      →  options      (grid, KNN, EMA – can also be changed later)

Options flow (after setup):
  init  →  general opts (grid / KNN / EMA)
        →  auto_cal    (auto-calibration settings)
"""
from __future__ import annotations

import re
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

from .const import (
    DOMAIN, NAME,
    CONF_FLOOR_NAME, CONF_FLOOR_WIDTH, CONF_FLOOR_HEIGHT,
    CONF_IMAGE_PATH,
    CONF_DEVICES, CONF_DEVICE_ID, CONF_DEVICE_NAME,
    CONF_DEVICE_NEAREST_ENT, CONF_DEVICE_RSSI_ENT,
    CONF_SCANNERS, CONF_ROOMS,
    OPT_GRID_STEP, OPT_KNN_K, OPT_EMA_ALPHA,
    OPT_AUTO_CAL_ENABLED, OPT_AUTO_CAL_STILL_SEC,
    OPT_AUTO_CAL_MAX_MOVE, OPT_AUTO_CAL_WHEN,
    OPT_SIDEBAR,
    OPT_AUTO_CAL_FROM, OPT_AUTO_CAL_TO,
    OPT_AUTO_CAL_MAX_AGE, OPT_AUTO_CAL_MANUAL_AGE, OPT_AUTO_CAL_NOTIFY,
    WHEN_MISSING, WHEN_ALWAYS, WHEN_SCHEDULE,
    NOTIFY_NONE, NOTIFY_PERSISTENT, NOTIFY_MOBILE,
    DEFAULT_GRID_STEP, DEFAULT_KNN_K, DEFAULT_EMA_ALPHA,
    DEFAULT_STILL_SEC, DEFAULT_MAX_MOVE, DEFAULT_MAX_AGE_DAYS, DEFAULT_MANUAL_AGE_DAYS,
)

_DEVICE_ID_RE = re.compile(r"^[a-z0-9_]+$")


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9_]", "_", name.lower().strip())[:32]


def _validate_time(value: str) -> str:
    if not re.match(r"^\d{2}:\d{2}$", value):
        raise vol.Invalid("Format muss HH:MM sein")
    return value


# ─────────────────────────────────────────────────────────────────────────────
class BLEPositioningConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Multi-step config flow."""

    VERSION = 1

    def __init__(self) -> None:
        self._data: dict = {}   # accumulated across steps

    # ── Step 1: floor ──────────────────────────────────────────────────────────
    async def async_step_user(
        self, user_input: dict | None = None
    ) -> FlowResult:
        """Floor / building setup."""
        if self._async_current_entries():
            # Allow multiple entries (one per floor/building)
            pass

        errors: dict[str, str] = {}

        if user_input is not None:
            w = user_input.get(CONF_FLOOR_WIDTH, 0)
            h = user_input.get(CONF_FLOOR_HEIGHT, 0)
            if w <= 0 or h <= 0:
                errors["base"] = "invalid_floor_size"
            else:
                self._data.update({
                    CONF_FLOOR_NAME:   user_input[CONF_FLOOR_NAME],
                    CONF_FLOOR_WIDTH:  round(float(w), 2),
                    CONF_FLOOR_HEIGHT: round(float(h), 2),
                    CONF_IMAGE_PATH:   user_input.get(CONF_IMAGE_PATH, ""),
                    CONF_SCANNERS:     [],
                    CONF_ROOMS:        [],
                    CONF_DEVICES:      [],
                })
                return await self.async_step_init_options()

        schema = vol.Schema({
            vol.Required(CONF_FLOOR_NAME,   default="Erdgeschoss"):  str,
            vol.Required(CONF_FLOOR_WIDTH,  default=10.0):           vol.Coerce(float),
            vol.Required(CONF_FLOOR_HEIGHT, default=10.0):           vol.Coerce(float),
            vol.Optional(CONF_IMAGE_PATH,   default=""):             str,
        })
        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
            description_placeholders={"name": NAME},
        )

    # ── Step 2: devices – entfernt, Geräte werden über die Karte verwaltet ───────

    # ── Step 3: initial options ────────────────────────────────────────────────
    async def async_step_init_options(
        self, user_input: dict | None = None
    ) -> FlowResult:
        """Positioning algorithm options."""
        if user_input is not None:
            return self.async_create_entry(
                title=self._data[CONF_FLOOR_NAME],
                data=self._data,
                options={
                    OPT_GRID_STEP:  user_input.get(OPT_GRID_STEP,  DEFAULT_GRID_STEP),
                    OPT_KNN_K:      user_input.get(OPT_KNN_K,      DEFAULT_KNN_K),
                    OPT_EMA_ALPHA:  user_input.get(OPT_EMA_ALPHA,  DEFAULT_EMA_ALPHA),
                    OPT_AUTO_CAL_ENABLED: True,   # ON by default – improves accuracy over time
                },
            )

        schema = vol.Schema({
            vol.Optional(OPT_GRID_STEP, default=DEFAULT_GRID_STEP):
                vol.All(vol.Coerce(float), vol.Range(min=0.25, max=2.0)),
            vol.Optional(OPT_KNN_K, default=DEFAULT_KNN_K):
                vol.All(vol.Coerce(int), vol.Range(min=1, max=15)),
            vol.Optional(OPT_EMA_ALPHA, default=DEFAULT_EMA_ALPHA):
                vol.All(vol.Coerce(float), vol.Range(min=0.01, max=1.0)),
        })
        return self.async_show_form(
            step_id="init_options",
            data_schema=schema,
        )

    @staticmethod
    @callback
    def async_get_options_flow(entry: config_entries.ConfigEntry):
        return BLEPositioningOptionsFlow()


# ─────────────────────────────────────────────────────────────────────────────
class BLEPositioningOptionsFlow(config_entries.OptionsFlow):
    """Two-step options flow: general + auto-calibration."""

    def __init__(self) -> None:
        self._new_opts: dict = {}


    # ── Step 1: general ────────────────────────────────────────────────────────
    async def async_step_init(
        self, user_input: dict | None = None
    ) -> FlowResult:
        opts = self.config_entry.options

        if user_input is not None:
            self._new_opts.update(user_input)
            # Carry over auto-cal settings unchanged
            for k in [
                OPT_AUTO_CAL_ENABLED, OPT_AUTO_CAL_STILL_SEC,
                OPT_AUTO_CAL_MAX_MOVE, OPT_AUTO_CAL_WHEN,
                OPT_AUTO_CAL_FROM, OPT_AUTO_CAL_TO,
                OPT_AUTO_CAL_MAX_AGE, OPT_AUTO_CAL_MANUAL_AGE, OPT_AUTO_CAL_NOTIFY,
            ]:
                if k in opts:
                    self._new_opts.setdefault(k, opts[k])
            return await self.async_step_auto_cal()

        schema = vol.Schema({
            vol.Optional(OPT_GRID_STEP,
                default=opts.get(OPT_GRID_STEP,  DEFAULT_GRID_STEP)):
                vol.All(vol.Coerce(float), vol.Range(min=0.25, max=2.0)),
            vol.Optional(OPT_KNN_K,
                default=opts.get(OPT_KNN_K, DEFAULT_KNN_K)):
                vol.All(vol.Coerce(int), vol.Range(min=1, max=15)),
            vol.Optional(OPT_EMA_ALPHA,
                default=opts.get(OPT_EMA_ALPHA, DEFAULT_EMA_ALPHA)):
                vol.All(vol.Coerce(float), vol.Range(min=0.01, max=1.0)),
            vol.Optional(OPT_SIDEBAR,
                default=opts.get(OPT_SIDEBAR, False)):
                bool,
        }, extra=vol.ALLOW_EXTRA)
        return self.async_show_form(step_id="init", data_schema=schema)

    # ── Step 2: auto-cal ───────────────────────────────────────────────────────
    async def async_step_auto_cal(
        self, user_input: dict | None = None
    ) -> FlowResult:
        opts = self.config_entry.options

        if user_input is not None:
            self._new_opts.update(user_input)
            # Sidebar is handled by the update_listener in __init__.py
            return self.async_create_entry(title="", data=self._new_opts)

        schema = vol.Schema({
            vol.Optional(OPT_AUTO_CAL_ENABLED,
                default=opts.get(OPT_AUTO_CAL_ENABLED, True)):
                bool,
            vol.Optional(OPT_AUTO_CAL_STILL_SEC,
                default=opts.get(OPT_AUTO_CAL_STILL_SEC, DEFAULT_STILL_SEC)):
                vol.All(vol.Coerce(int), vol.Range(min=10, max=600)),
            vol.Optional(OPT_AUTO_CAL_MAX_MOVE,
                default=opts.get(OPT_AUTO_CAL_MAX_MOVE, DEFAULT_MAX_MOVE)):
                vol.All(vol.Coerce(float), vol.Range(min=0.1, max=3.0)),
            vol.Optional(OPT_AUTO_CAL_WHEN,
                default=opts.get(OPT_AUTO_CAL_WHEN, WHEN_MISSING)):
                vol.In([WHEN_MISSING, WHEN_ALWAYS, WHEN_SCHEDULE]),
            vol.Optional(OPT_AUTO_CAL_FROM,
                default=opts.get(OPT_AUTO_CAL_FROM, "02:00")):
                _validate_time,
            vol.Optional(OPT_AUTO_CAL_TO,
                default=opts.get(OPT_AUTO_CAL_TO, "05:00")):
                _validate_time,
            vol.Optional(OPT_AUTO_CAL_MAX_AGE,
                default=opts.get(OPT_AUTO_CAL_MAX_AGE, DEFAULT_MAX_AGE_DAYS)):
                vol.All(vol.Coerce(int), vol.Range(min=1, max=365)),
            vol.Optional(OPT_AUTO_CAL_MANUAL_AGE,
                default=opts.get(OPT_AUTO_CAL_MANUAL_AGE, DEFAULT_MANUAL_AGE_DAYS)):
                vol.All(vol.Coerce(int), vol.Range(min=1, max=3650)),
            vol.Optional("away_timeout_sec",
                default=opts.get("away_timeout_sec", 30)):
                vol.All(vol.Coerce(int), vol.Range(min=5, max=3600)),
            vol.Optional(OPT_AUTO_CAL_NOTIFY,
                default=opts.get(OPT_AUTO_CAL_NOTIFY, NOTIFY_NONE)):
                vol.In([NOTIFY_NONE, NOTIFY_PERSISTENT, NOTIFY_MOBILE]),
        }, extra=vol.ALLOW_EXTRA)
        return self.async_show_form(step_id="auto_cal", data_schema=schema)
