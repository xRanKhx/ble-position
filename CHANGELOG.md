# Changelog

## v4.1.0 (2026-03-18)
### ⚡ Elektro-Modul: Vollständiger Baukasten
- **Drag & Drop** – alle Elemente frei positionierbar
- **Größen-Anpassung** – Resize-Handle (Ecke ziehen)
- **Leitungen ziehen** – Verbindungsmodus: Knoten antippen → zweiten antippen
- **Schalter-Nodes** – zeigen Entity-Zustand (AN/AUS) + Messwert
- **Power-Skala** – Überschuss oben, dynamische Segmentierung
- **Automations-Simulator** – Testmodus mit Zeitraffer, kein HA-Zugriff
- **Multi-System** – jedes System hat eigene Elemente & Konfiguration
- **HACS-ready** – direkt via GitHub installierbar

## v4.0.0 (2026-03-18)
- ElektroModul v4: Power-Fluss, Abzweigungen, KI-Analyse, Saison-Modus

## v3.6.0
- ElektroModul v3: HA-Import, Entity-Picker, Multi-System, Log, dynamische KI

## v4.1.1 (2026-03-18)
### Bugfixes
- **Elektro Drag & Drop**: `onDragStart/Move/End` wurden nie aufgerufen → Canvas-Events jetzt korrekt an Modul delegiert
- **Elektro Resize**: Resize-Handle jetzt funktional (Ecke des selektierten Elements ziehen)
- **Elektro Leitungen ziehen**: `onTap` in `_onCanvasClick` eingehängt → Verbindungsmodus funktioniert
- **Deko Entity speichert nicht**: `_saveDecoNow()` nach jeder Entity-/Label-/Größen-Änderung aufgerufen
- **Deko Position nach Drag**: `_saveDecoNow()` beim Drag-Ende → Position bleibt nach Neustart
- **Canvas-Rotation**: `ctx.rotate()` im Aquarell-Modus ohne `save()/restore()` rotierte den gesamten Canvas → gefixt

## v4.2.0 (2026-03-18)
### Solar-Forecast & Wetter
- **Forecast-Panel**: Frei positionierbares, resize-bares Panel über dem Canvas
  - Vordergrund/Hintergrund wählbar per Klick auf Badge
  - Drag via obere Leiste, Resize via untere-rechte Ecke
  - Balkendiagramm mit Stunden-Prognose, Spitzenzeit-Marker
- **Wetter-Hintergrund-Canvas**: Sonne (mit Strahlen + Pulsringen), Mond + Sterne, Wolken, Regen, Nebel
  - Sonnenstand-Bogen zeigt Tagesverlauf
  - Temperaturanzeige oben rechts
- **Forecast-Bedingungen** für Automationen:
  - `forecast_today_gt/lt`: Wenn heute > X kWh erwartet
  - `forecast_tomorrow_gt`: Morgen > X kWh
  - `forecast_peak_before`: Spitzenstunde vor HH:MM
  - `weather_is`: Wetterbedingung (sunny, cloudy, rainy...)
- **KI-Analyse**: Forecast-basierte Insights (Sonnentag, schlechter Tag, morgen besser)

### Leitungen
- **Automatischer Wert**: Entity am Quell-Node → automatisch auf Leitung angezeigt
- **Dicke proportional zu Watt**: je mehr Leistung, desto dicker und leuchtender
- **Überschreibbar**: sensorKey auf Leitung hat Vorrang

## v4.3.0 (2026-03-18)
### Forecast-Panel komplett neu
- **Mehrere Panels**: Unbegrenzt viele Forecast-Panels, frei positioniert (auch nebeneinander, untereinander, überall)
- **Mehrere Anlagen pro Panel**: Ost/West/Süd-Anlage als eigene Quelle mit eigener Farbe + Entities
- **Sidebar-Editor**: Kein Canvas-Grab nötig – alles per Sidebar (Name, Entities, Farbe, Sichtbarkeit)
- **Canvas-Interaktion**: Panel im Canvas antippen → selektiert; Drag-Handle (obere Leiste) zum Verschieben; Resize-Handle (Ecke unten rechts) für Größe
- **Diagramm-Inhalt**:
  - Gelbe Linie = Sonnenstandbogen (animiert, zeigt aktuelle Position ★)
  - Graue Gauss-Kurve = Forecast-Ertragsprofil (aus today-kWh + Spitzenzeit)
  - Goldene Balken = Solar-Prognose stündlich (vergangen = transparent, jetzt = hell)
  - Grüner Schichtbalken = Akku laden (aus battery_w Entity)
  - Roter Schichtbalken = Akku entladen (negativer battery_w)
  - Blauer Balken nach unten = Verbrauch (load_w Entity)
  - Spitzenstunde-Marker ★ mit Uhrzeit
- **Wetter-Hintergrund**: Vollständig überarbeitete Wetter-Animation über das gesamte Canvas

## v4.3.1 (2026-03-18)
### Forecast-Panel: Panorama + Ost/West
- **Panorama** (1 Anlage): Stündlicher Wetter-Hintergrund – jede Stunde hat eigenes Sky-Bild
  (Morgenrot, Tagblau, Wolken, Regen, Nacht+Mond+Sterne). Sonne steigt und sinkt sichtbar.
  Solar-Balken wachsen aus der Dunkelzone. Grüner Ist-Punkt zeigt aktuellen Ertrag.
- **Ost/West** (mehrere Anlagen): gleicher Wetter-Hintergrund, aber jede Anlage hat
  eigene farbige Balken-Gruppe + Kurve + Peak-Marker. Man sieht sofort warum
  Ost morgens und West abends liefert. Gesamtertrag rechts unten.
- Automatische Umschaltung: 1 Quelle → Panorama, 2+ Quellen → Ost/West
- Stündliche Forecast-Daten werden über weather.get_forecasts (HA 2023.9+) geladen

## v4.3.2 (2026-03-22)
### Bugfix: Wetter wird angezeigt
- weather.get_forecasts via WebSocket (hass.callWS) statt callService → funktioniert korrekt
- _refreshData ist jetzt async + wird mit await aufgerufen
- Fallback auf attributes.forecast für ältere HA-Versionen
- Warn-Log wenn Weather-Entity nicht gefunden (zeigt verfügbare Entities)

## v4.4.0 (2026-03-22)
### Modul-System – separate Dateien
- **Module als separate .js Dateien** in /modules/ Ordner
  - elektro.js, energie.js, pool.js
  - Werden per fetch() lazy geladen statt per eval() aus eingebettetem String
  - Card: 1.25 MB → 1.09 MB (166 KB Module ausgelagert)
- **Versions-Anzeige in Sidebar (⚙ OPT → Module)**
  - Card-Hauptversion oben
  - Pro Modul: Version, Ladezeit, Status (✅/❌/⟳)
- **Auto-Update-Erkennung** (alle 5 Minuten)
  - HEAD-Request prüft Last-Modified Header
  - Badge "⟳ Update verfügbar" erscheint automatisch
- **Hot-Reload** per Klick – kein HA-Neustart nötig
- **RAM/CPU-Ersparnis**: inaktive Module = 0 KB, 0 CPU, kein onPoll

### Installation
Samba: /config/www/ble_positioning/ ersetzen
- ble-positioning-card.js (Haupt-Card)
- modules/elektro.js
- modules/energie.js
- modules/pool.js

HACS: automatisch per GitHub Release
