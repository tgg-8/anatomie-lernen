# Anatomie lernen – 3D-Anatomie für die Physiotherapie-Ausbildung

Eine Web-App (PWA) für das iPad: ein drehbares 3D-Modell des menschlichen Körpers.
Jede Struktur ist einzeln antippbar und hat ein Info-Panel auf Deutsch mit lateinischem Fachnamen.
Die App läuft in Safari, lässt sich auf den Home-Bildschirm legen und funktioniert nach dem ersten Laden auch offline.

> **Hinweis:** Reines Lernmodell. Ersetzt keine medizinische Beratung oder Diagnose und auch nicht den Unterricht oder die Lehrbücher der Schule.
> Die Texte sind Entwürfe („Entwurf – mit Schulbuch abgleichen“). Unsichere Angaben stehen als **„noch zu prüfen“** in der App.

## Stand

Alle Etappen sind in einer ersten Fassung eingebaut. Die **3D-Modelle sind vollständig**, die **Texte wachsen weiter**.

| Bereich | Stand |
|---|---|
| 3D-Ansicht: drehen (1 Finger), zoomen (Pinch), verschieben (2 Finger), Standardansichten, Zurücksetzen | ✅ |
| **9 Ebenen**: Haut, Unterhaut (schematisch), Faszien, oberflächliche Muskeln, tiefe Muskeln, Sehnen/Bänder/Kapseln, Knochen, Nerven und Gefäße, Organe – je an/aus und Transparenz | ✅ 1.774 Strukturen, 3.073 3D-Teile |
| Jede Struktur antippbar, ausblenden, transparent, isolieren, Beschriftung am Modell | ✅ |
| **Knochen**: alle mit Namen; ausführliche Texte für den Bewegungsapparat; 567 Markierungspunkte am Modell | ✅ |
| **Gelenke**: 12 Gelenke mit Gelenktyp, Achsen, Bewegungsumfang (Neutral-Null, mit Quelle), Kapsel-Band-Apparat, Ruhe-/Verriegelungsstellung | ✅ |
| **Muskeln**: 51 Muskeln bzw. Muskelanteile (u. a. Gesäß, Hüfte, Oberschenkel, Unterschenkel, Rotatorenmanschette, Schultergürtel, Oberarm, Bauch, Hals) mit Ursprung, Ansatz, Aktion, Innervation + Segment, Gefäßversorgung, Palpation, Synergisten/Antagonisten; Ursprungs- und Ansatzflächen am Knochen für 169 Muskeln | ✅ übrige Muskeln: Name + Nerv laut Modell |
| **Faszien**: Fascia lata, Tractus iliotibialis, Fascia thoracolumbalis, Plantar-/Palmaraponeurose, Retinacula u. a., mit Hinweis zur Evidenz von Faszienketten | ✅ |
| **Haut, Unterhaut**: Hautschichten als Feinbau-Schema; Unterhaut als klar gekennzeichnete schematische Schicht | ✅ |
| **Nerven, Gefäße, Organe**: alle als 3D-Teile mit Namen; Texte für die wichtigsten peripheren Nerven und einige Arterien/Organe | ✅ Texte teilweise |
| Detailstufen: Überblick / Details / Feinbau (Knochen, Muskel, Sehne/Band, Gelenk, Faszie, Haut, Nerv) | ✅ |
| Suche (auch Gelenke, Markierungen, Latein) und Baumansicht | ✅ |
| **Lernmodus**: Lernpfade nach Ausbildungsjahr, Quiz (antippen, benennen, Wissensfragen), Lernkarten mit Wiederholungsabstand, Merkliste, Export/Import | ✅ |
| Offline (Service Worker), Hell/Dunkel, Quer-/Hochformat | ✅ |

## Lernmodus – wo und wie

Oben rechts auf **„Lernen“** tippen (oder ☰ → Reiter „Lernen“).

- **Lernpfad:** *1. Jahr / 2. Jahr / 3. Jahr / Alles*. Mit einem Jahr zeigen Baumansicht und Quiz nur das, was bis dahin dran ist; *Alles* schaltet alles frei. Die Zuordnung ist ein Vorschlag (Feld `jahr` in den Texten) und lässt sich mit dem Stoffverteilungsplan der Schule anpassen.
- **Quiz:** Thema und Frageart wählen. *Antippen im Modell* („Tippe auf: M. gluteus medius“), *Struktur benennen* (eine Struktur leuchtet, vier Namen), *Wissensfragen* („Wo setzt … an?“, „Welcher Nerv versorgt …?“, „Welcher Gelenktyp …?“). Falsche Antworten werden automatisch Lernkarten.
- **Lernkarten:** Erst selbst überlegen, dann *Aufdecken* und mit *Nochmal / Schwer / Gut / Leicht* bewerten. Wiederholung nach 1, 2, 4, 8, 16, 32 Tagen.
- **Merkliste:** Im Info-Panel auf ☆ tippen.
- **Fortschritt** bleibt nur auf dem iPad gespeichert. Ab und zu über *Exportieren* sichern (z. B. in „Dateien“).

## Auf dem iPad testen

**Am einfachsten über GitHub Pages (kostenlos, HTTPS, nötig für die Offline-Funktion):**

1. Auf github.com im Repository **Settings → Pages** öffnen.
2. Unter „Build and deployment“ bei **Source** „Deploy from a branch“ wählen, Branch **`gh-pages`**, Ordner **`/ (root)`**, speichern.
3. Nach 1–2 Minuten ist die App erreichbar unter **https://tgg-8.github.io/anatomie-lernen/**.
4. Auf dem iPad in **Safari** öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“**.
5. Einmal mit Internet öffnen und kurz warten. Danach funktioniert die App auch ohne Internet.

**Alternativ lokal (braucht einen Rechner im selben WLAN):**
```bash
npm install
npm run build
npm run vorschau          # zeigt eine Adresse wie http://192.168.x.y:4173
```
Diese Adresse auf dem iPad in Safari öffnen. Ohne HTTPS funktioniert die Offline-Speicherung dort nicht, der Rest schon.

## Bedienung

- **Drehen:** ein Finger ziehen · **Zoomen:** zwei Finger spreizen · **Verschieben:** zwei Finger ziehen
- **Auswählen:** kurz antippen. Ins Leere tippen hebt die Auswahl auf.
- **☰ Ebenen:** Schichten ein-/ausblenden und mit dem Schieberegler durchsichtig machen. Was weniger als 50 % deckt, kann man „durchtippen“, um darunterliegende Strukturen zu wählen.
- **☰ Strukturen:** Baum nach Ebene und Region.
- **Info-Panel:** Detailstufe wählen. Bei „Details“ erscheinen blaue Punkte für die Knochenmarkierungen. Antippen zeigt den Namen.

## Wie die App aufgebaut ist

```
anatomie-lernen/
├─ index.html                 Grundgerüst der Seite
├─ src/
│  ├─ main.ts                 Startpunkt: verbindet Daten, 3D-Ansicht und Oberfläche
│  ├─ typen.ts                Datentypen (beschreiben die JSON-Dateien)
│  ├─ stil.css                Aussehen, Hell/Dunkel, Hoch-/Querformat
│  ├─ daten/laden.ts          lädt die JSON-Inhalte und verknüpft Texte mit Strukturen
│  ├─ daten/suche.ts          Suche (MiniSearch)
│  ├─ viewer/szene.ts         Three.js: Kamera, Licht, Touch-Gesten, Ansichten
│  ├─ viewer/modell.ts        lädt die Ebenen (GLB), Auswahl, Transparenz, Isolieren
│  ├─ viewer/beschriftung.ts  Beschriftungen und Markierungspunkte am Modell
│  └─ ui/                     Info-Panel, Ebenen-/Baum-Panel, Dialoge
├─ public/
│  ├─ modelle/*.glb           3D-Modelle pro Ebene (komprimiert, CC BY-SA 4.0)
│  ├─ inhalte/
│  │  ├─ ebenen.json          die 9 Ebenen (Reihenfolge, Farben, Verfügbarkeit)
│  │  ├─ texte/               VON HAND GEPFLEGT: knochen.json, namen_de.json, feinbau.json, quellen.json
│  │  └─ generiert/           automatisch erzeugt (Strukturliste, Markierungen) – nicht bearbeiten
│  └─ schemata/               schematische Zeichnungen (Feinbau)
├─ werkzeuge/                 Umwandlung der 3D-Modelle (läuft nicht auf dem iPad)
└─ tests/e2e.mjs              automatischer Browsertest
```

**Daten und Darstellung sind getrennt:** Jedes 3D-Teil heißt wie in Z-Anatomy (z. B. `Femur.l`).
`generiert/strukturen.json` ordnet es einer Struktur-ID zu (`femur`). Die Texte stehen in `texte/knochen.json` unter dem englischen Namen (`"Femur"`).

### Inhalte ergänzen oder korrigieren

1. Die passende Datei in `public/inhalte/texte/` öffnen: `knochen.json`, `muskeln.json`, `gelenke.json`, `faszien.json` oder `weitere.json` (Bänder, Nerven, Organe, allgemeine Texte je Strukturtyp). Den Eintrag suchen, z. B. `"Femur"` oder `"Gluteus medius muscle"`.
2. Felder ändern oder ergänzen. Knochen: `kurz`, `lage`, `form`, `markierungen`, `gelenke`, `muskeln`, `baender`, `tastbar`. Muskeln: `ursprung`, `ansatz`, `aktion`, `innervation`, `versorgung`, `tastbar`, `synergisten`, `antagonisten`. Für alle: `praxis`, `offen` (erscheint als „noch zu prüfen“), `jahr`. Der englische Name muss genau dem Modell entsprechen; `npm run daten` meldet Einträge ohne passende Struktur.
3. Ist ein Eintrag mit dem Schulbuch abgeglichen, `"status": "geprueft"` setzen. Dann verschwindet der Hinweis „Entwurf“.
4. Für viele gleichartige Knochen (Rippen, Wirbel, Fingerglieder) gibt es `vorlagen` mit einem Suchmuster.
5. Deutsche Namen stehen in `texte/namen_de.json`. Danach `npm run daten` ausführen.

### 3D-Modelle neu erzeugen

Das brauchst du nur, wenn sich die Ebenen-Einteilung ändern soll. Die fertigen Modelle liegen schon im Projekt.
```bash
# 1. Blender als Python-Modul installieren (kein Blender-Programm nötig)
python3 -m venv .venv && .venv/bin/pip install bpy==5.3.0
# 2. Z-Anatomy-Atlas laden und entpacken (Startup.blend, ca. 300 MB)
curl -LO https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/master/Z-Anatomy.zip
unzip Z-Anatomy.zip Z-Anatomy/Startup.blend
# 3. Exportieren, optimieren, Daten bauen
.venv/bin/python werkzeuge/blender_export.py Z-Anatomy/Startup.blend werkzeuge/export
npm run modelle:optimieren
cp werkzeuge/export/*.json werkzeuge/zwischenstand/
npm run daten
```
Welche Z-Anatomy-Sammlung in welche Ebene kommt, steht in `werkzeuge/export_konfig.json`.

### Entwickeln und testen

```bash
npm install
npm run dev        # Entwicklungsserver mit automatischem Neuladen
npm run build      # Typprüfung + fertige App in dist/
npm test           # automatischer Browsertest (nach npm run build), Bilder in tests/bilder/
```

## Technik

- **Three.js** (WebGL2): Darstellung, OrbitControls für die Touch-Gesten
- **three-mesh-bvh**: schnelles Antippen trotz ca. 450.000 Dreiecken
- **glTF/GLB mit Meshopt-Kompression**: alle Ebenen zusammen ca. 20 MB (Knochen 2,9 MB, Muskeln 5 MB, Nerven/Gefäße 4,4 MB …). Ebenen werden erst angezeigt, wenn man sie einschaltet; für den Offline-Betrieb werden beim ersten Besuch alle Dateien gespeichert.
- **Vite + TypeScript**, **vite-plugin-pwa** (Workbox) für Offline und Home-Bildschirm
- **MiniSearch** für die Suche
- Gezeichnet wird nur, wenn sich etwas bewegt. Das spart Akku und hält die Bildrate hoch.

## Ehrliche Einschränkungen

- **Leistung mit allen Ebenen gleichzeitig:** ca. 2,8 Mio. Dreiecke und ~5.000 Zeichenaufrufe. Auf dem iPad Air M2 sollte das laufen, aber eventuell nicht mit 60 FPS. Im normalen Gebrauch (einige Ebenen an) ist es deutlich weniger. Bitte auf dem Gerät prüfen.
- **Oberflächlich/tief** ist bei den Muskeln automatisch berechnet (sichtbarer Anteil von außen) und in Grenzfällen nicht identisch mit jeder Lehrbuch-Einteilung.
- **Texte**: Eigene Texte gibt es für 123 Knochen, 51 Muskeln bzw. Muskelanteile, 12 Gelenke, 18 Faszien/Aponeurosen/Retinacula, 10 periphere Nerven, 8 Bänder/Menisken sowie einige Arterien und Organe. Alle anderen Strukturen haben Namen (Deutsch/Latein) und einen allgemeinen Text zum Strukturtyp, gekennzeichnet als „nur allgemeiner Text“.
- **Niere und Innenohr fehlen** (Lizenz der Z-Anatomy-Teilmodelle erlaubt keine Weitergabe).

- **Getestet** ist automatisch in Chromium mit iPad-Bildschirmgröße und Software-Grafik. **Safari auf dem echten iPad ist noch nicht getestet** (keine Safari-Engine in der Testumgebung). Bitte Gesten, Bildrate und den Home-Bildschirm-Modus auf dem Gerät prüfen.
- **Männliches Modell:** Z-Anatomy enthält nur einen männlichen Körper.
- **Haut:** Im Modell gibt es nur die Hautoberfläche in Regionen; Epidermis, Dermis und Subcutis gibt es als Schema (Detailstufe „Feinbau“).
- **Unterhaut/Fettgewebe** fehlt im Modell und ist als schematische Schicht 7 mm unter der Haut angedeutet (klar gekennzeichnet).
- **Markierungspunkte** stammen aus Z-Anatomy und liegen nur auf einer Körperseite. Für die andere Seite werden sie gespiegelt.
- Einzelne Bänder fehlen im Z-Anatomy-Modell (z. B. Außen- und Innenbänder des oberen Sprunggelenks, Lig. patellae, Leistenband). Sie sind in den Texten beschrieben, aber nicht als 3D-Teil antippbar.

## Wie es weitergeht

Die Technik ist fertig. Ab jetzt geht es vor allem um **mehr und geprüfte Inhalte**:
- Texte für weitere Muskeln (Unterarm, Hand, Fuß, Rücken, Hals), Bänder und Nerven
- Lernpfade an den Stoffverteilungsplan der Schule anpassen
- Einträge nach dem Abgleich mit dem Schulbuch auf `"status": "geprueft"` setzen

## Lizenzen

- **Programmcode:** MIT (siehe `LICENSE`)
- **3D-Modelle und Markierungen** (`public/modelle`, `public/inhalte/generiert`): abgeleitet von Z-Anatomy → **CC BY-SA 4.0**
- **Lerntexte und Schemata** (`public/inhalte/texte`, `public/schemata`): **CC BY-SA 4.0**
- Details und Namensnennung: [QUELLEN_UND_LIZENZEN.md](QUELLEN_UND_LIZENZEN.md)
