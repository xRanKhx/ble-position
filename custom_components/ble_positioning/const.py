"""Constants for BLE Indoor Positioning."""

DOMAIN = "ble_positioning"
NAME   = "BLE Indoor Positioning"

# ── Config entry keys (stored in entry.data) ─────────────────────────────────
CONF_FLOOR_NAME     = "floor_name"       # e.g. "Erdgeschoss"
CONF_FLOOR_WIDTH    = "floor_width"      # metres
CONF_FLOOR_HEIGHT   = "floor_height"     # metres
CONF_IMAGE_PATH     = "image_path"       # path under /local/
CONF_IMAGE_OFFSET_X = "image_offset_x"  # px – left margin inside image
CONF_IMAGE_OFFSET_Y = "image_offset_y"  # px – top margin inside image
CONF_IMAGE_FLOOR_W  = "image_floor_w"   # px – floor width inside image
CONF_IMAGE_FLOOR_H  = "image_floor_h"   # px – floor height inside image

# Scanner sub-dict keys
CONF_SCANNERS    = "scanners"   # list[ScannerDict]
CONF_SCANNER_ID  = "id"
CONF_SCANNER_NAME    = "name"
CONF_SCANNER_ENTITY  = "entity"        # filtered distance entity
CONF_SCANNER_RAW     = "entity_raw"    # unfiltered distance entity (optional)
CONF_SCANNER_NEAREST = "nearest_key"   # substring in nearest_scanner state
CONF_SCANNER_COLOR   = "color"
CONF_SCANNER_MX      = "mx"
CONF_SCANNER_MY      = "my"

# Room sub-dict keys
CONF_ROOMS      = "rooms"       # list[RoomDict]
CONF_ROOM_NAME  = "name"
CONF_ROOM_X1    = "x1"
CONF_ROOM_Y1    = "y1"
CONF_ROOM_X2    = "x2"
CONF_ROOM_Y2    = "y2"
CONF_ROOM_COLOR = "color"

# Device sub-dict keys  (per tracked device inside a floor)
CONF_DEVICES            = "devices"     # list[DeviceDict]
CONF_DEVICE_ID          = "device_id"
CONF_DEVICE_NAME        = "device_name"
CONF_DEVICE_NEAREST_ENT = "nearest_entity"
CONF_DEVICE_RSSI_ENT    = "rssi_entity"

# ── Options keys (stored in entry.options) ────────────────────────────────────
OPT_GRID_STEP       = "grid_step"
OPT_KNN_K           = "knn_k"
OPT_EMA_ALPHA       = "ema_alpha"
OPT_SIDEBAR         = "sidebar_enabled"

OPT_AUTO_CAL_ENABLED    = "auto_cal_enabled"
OPT_AUTO_CAL_STILL_SEC  = "auto_cal_still_sec"
OPT_AUTO_CAL_MAX_MOVE   = "auto_cal_max_move_m"
OPT_AUTO_CAL_WHEN       = "auto_cal_when"
OPT_AUTO_CAL_FROM       = "auto_cal_from"
OPT_AUTO_CAL_TO         = "auto_cal_to"
OPT_AUTO_CAL_MAX_AGE        = "auto_cal_max_age_days"
OPT_AUTO_CAL_MANUAL_AGE     = "auto_cal_manual_age_days"
OPT_AUTO_CAL_NOTIFY         = "auto_cal_notify"

# auto_cal_when values
WHEN_MISSING  = "missing"
WHEN_ALWAYS   = "always"
WHEN_SCHEDULE = "schedule"

# auto_cal_notify values
NOTIFY_NONE       = "none"
NOTIFY_PERSISTENT = "persistent"
NOTIFY_MOBILE     = "mobile"

# ── Defaults ─────────────────────────────────────────────────────────────────
DEFAULT_GRID_STEP           = 0.5
DEFAULT_KNN_K               = 3
DEFAULT_EMA_ALPHA           = 0.25
DEFAULT_STILL_SEC           = 30
DEFAULT_MAX_MOVE            = 0.4
DEFAULT_MAX_AGE_DAYS        = 7
DEFAULT_MANUAL_AGE_DAYS     = 30   # manual prints stay valid 30 days by default

# ── Storage ───────────────────────────────────────────────────────────────────
STORAGE_VERSION = 1
# Key pattern: ble_positioning_fp_{entry_id}_{device_id}
STORAGE_KEY_TPL = "ble_positioning_fp_{entry_id}_{device_id}"

# ── Services ──────────────────────────────────────────────────────────────────
SERVICE_CAPTURE_FP      = "capture_fingerprint"
SERVICE_CLEAR_FP        = "clear_fingerprints"
SERVICE_IMPORT_FP       = "import_fingerprints"
SERVICE_ADD_SCANNER     = "add_scanner"
SERVICE_REMOVE_SCANNER  = "remove_scanner"
SERVICE_ADD_ROOM        = "add_room"
SERVICE_ADD_SIDEBAR     = "add_to_sidebar"
SERVICE_REMOVE_SIDEBAR  = "remove_from_sidebar"

# ── Signals ───────────────────────────────────────────────────────────────────
SIGNAL_FP_UPDATED = "ble_positioning_fp_updated_{entry_id}_{device_id}"
SIGNAL_CFG_UPDATED = "ble_positioning_cfg_updated_{entry_id}"

# ── Entity unique_id suffixes ─────────────────────────────────────────────────
SUFFIX_ROOM         = "room"
SUFFIX_POS_X        = "pos_x"
SUFFIX_POS_Y        = "pos_y"
SUFFIX_CONFIDENCE   = "confidence"
SUFFIX_FP_COUNT     = "fp_count"
SUFFIX_AC_TODAY     = "auto_cal_today"
SUFFIX_STILL        = "still_seconds"
SUFFIX_MANUAL_AGE   = "manual_fp_age_days"
SUFFIX_ZONE         = "zone"
SUFFIX_ZONE_ACTIVE  = "zone_active"

# ── mmWave entity suffixes ────────────────────────────────────────────────────
SUFFIX_MMWAVE_PRESENCE       = "presence"
SUFFIX_MMWAVE_PRESENCE_COUNT = "presence_count"
SUFFIX_MMWAVE_CLASS          = "class"
SUFFIX_MMWAVE_POSTURE        = "posture"
SUFFIX_MMWAVE_SPEED          = "speed"
SUFFIX_MMWAVE_ROOM           = "room"
SUFFIX_MMWAVE_FALL           = "fall"
SUFFIX_MMWAVE_MOVING         = "moving"
SUFFIX_ANALYTICS_ACTIVE      = "analytics_active"

# ── Services ──────────────────────────────────────────────────────────────────
SERVICE_PTZ_TRACK            = "ptz_track"
SERVICE_FALL_ALARM_RESET     = "fall_alarm_reset"
SERVICE_MMWAVE_PROFILE_RESET = "mmwave_profile_reset"
