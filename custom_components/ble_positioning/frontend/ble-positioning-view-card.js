// BLE Positioning View Card – DEPRECATED
// This file is intentionally empty. The view-card has been merged into
// ble-positioning-card.js (use type: custom:ble-positioning-card instead).
// Remove any dashboard cards of type ble-positioning-view-card.
(function() {
  // Remove from customCards registry if somehow loaded
  if (window.customCards) {
    const idx = window.customCards.findIndex(c => c.type === 'ble-positioning-view-card');
    if (idx >= 0) window.customCards.splice(idx, 1);
  }
  // Register as stub to prevent errors if already in use
  if (!customElements.get('ble-positioning-view-card')) {
    class BLEPositioningViewCardStub extends HTMLElement {
      set hass(h) { if (!this._warned) { console.warn('BLE Positioning: ble-positioning-view-card is deprecated. Use ble-positioning-card instead.'); this._warned=true; } }
      setConfig(c) { this._config=c; }
      getCardSize() { return 1; }
    }
    customElements.define('ble-positioning-view-card', BLEPositioningViewCardStub);
  }
})();
