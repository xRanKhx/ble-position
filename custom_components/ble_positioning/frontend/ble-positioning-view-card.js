// BLE Positioning View Card v2.10.81
// Lovelace dashboard card that embeds the BLE Positioning panel
(function() {
  if (customElements.get('ble-positioning-view-card')) return;

  class BLEPositioningViewCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._card = null;
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._card) this._build();
      if (this._card) this._card.hass = hass;
    }

    setConfig(config) {
      this._config = config;
    }

    _build() {
      // Wait for ble-positioning-card to be defined
      if (!customElements.get('ble-positioning-card')) {
        customElements.whenDefined('ble-positioning-card').then(() => this._build());
        return;
      }
      const card = document.createElement('ble-positioning-card');
      if (this._config) card.setConfig(this._config);
      if (this._hass)   card.hass = this._hass;
      this.shadowRoot.innerHTML = '';
      this.shadowRoot.appendChild(card);
      this._card = card;
    }

    getCardSize() { return 8; }

    static getConfigElement() {
      return document.createElement('ble-positioning-card-editor');
    }

    static getStubConfig() {
      return { type: 'custom:ble-positioning-view-card' };
    }
  }

  customElements.define('ble-positioning-view-card', BLEPositioningViewCard);

  window.customCards = window.customCards || [];
  if (!window.customCards.find(c => c.type === 'ble-positioning-view-card')) {
    window.customCards.push({
      type: 'ble-positioning-view-card',
      name: 'BLE Positioning',
      description: 'BLE Indoor Positioning dashboard card',
      preview: false,
    });
  }
})();
