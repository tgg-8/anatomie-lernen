# Anatomie lernen – 3D-Anatomie für die Physiotherapie-Ausbildung

Eine Web-App (PWA) für das iPad: ein drehbares 3D-Modell des menschlichen Körpers.
Jede Struktur ist einzeln antippbar und hat ein Info-Panel auf Deutsch mit lateinischem Fachnamen.
Die App läuft in Safari, lässt sich auf den Home-Bildschirm legen und funktioniert nach dem ersten Laden auch offline.

> **Hinweis:** Reines Lernmodell. Ersetzt keine medizinische Beratung oder Diagnose und auch nicht den Unterricht oder die Lehrbücher der Schule.
> Die Texte sind Entwürfe („Entwurf – mit Schulbuch abgleichen“). Unsichere Angaben stehen als **„noch zu prüfen“** in der App.

## Stand (Etappe 1: Prototyp)

| Funktion | Stand |
|---|---|
| 3D-Skelett: drehen (1 Finger), zoomen (Pinch), verschieben (2 Finger) | ✅ |
| Standardansichten vorne / hinten / links / rechts / oben, Ansicht zurücksetzen | ✅ |
| 277 Knochenteile einzeln antippbar, farbig hervorgehoben, Beschriftung am Modell | ✅ |
| Info-Panel für **jeden** Knochen (Deutsch, Latein, Englisch, Region, Typ) | ✅ |
| Ausführliche Texte (Funktion, Lage, Form, Markierungen, Gelenke, Muskeln, Bänder, Palpation) | ✅ für Bewegungsapparat: Becken, Bein, Fuß, Schulter, Arm, Hand, Wirbelsäule, Brustkorb; kurz für Schädel |
| 567 Knochenmarkierungen als antippbare Punkte am Modell (z. B. Trochanter major) | ✅ |
| Detailstufen: Überblick / Details / Feinbau (Schema Röhrenknochen) | ✅ |
| Ebenen-Steuerung (9 Ebenen, an/aus, Transparenz) | ✅ Steuerung steht; Inhalte: Haut, Bänder/Kapseln, Knochen |
| Einzelne Struktur ausblenden, transparent, isolieren | ✅ |
| Suche (Deutsch, Latein, Englisch, Wortanfänge, kleine Tippfehler) und Baumansicht | ✅ |
| Hell/Dunkel, Quer- und Hochformat, Safe Areas | ✅ |
| Offline (Service Worker) und „Zum Home-Bildschirm“ | ✅ |
| Lernmodus (Lernpfade, Quiz, Lernkarten) | ⏳ Etappe 7 |

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

1. `public/inhalte/texte/knochen.json` öffnen und den Eintrag suchen, z. B. `"Femur"`.
2. Felder ändern oder ergänzen: `kurz`, `lage`, `form`, `markierungen`, `gelenke`, `muskeln`, `baender`, `tastbar`, `praxis`, `offen`, `jahr`.
3. Ist ein Eintrag mit dem Schulbuch abgeglichen, `"status": "geprueft"` setzen. Dann verschwindet der Hinweis „Entwurf“.
4. Für viele gleichartige Knochen (Rippen, Wirbel, Fingerglieder) gibt es `vorlagen` mit einem Suchmuster.
5. Deutsche Namen stehen in `texte/namen_de.json`. Danach `npm run daten` ausführen.

### 3D-Modelle neu erzeugen

Das brauchst du nur, wenn neue Ebenen dazukommen. Die fertigen Modelle liegen schon im Projekt.
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
- **glTF/GLB mit Meshopt-Kompression**: Knochen 2,9 MB, Bänder 1,8 MB, Haut 1,3 MB. Ebenen werden erst geladen, wenn man sie einschaltet.
- **Vite + TypeScript**, **vite-plugin-pwa** (Workbox) für Offline und Home-Bildschirm
- **MiniSearch** für die Suche
- Gezeichnet wird nur, wenn sich etwas bewegt. Das spart Akku und hält die Bildrate hoch.

## Ehrliche Einschränkungen

- **Getestet** ist automatisch in Chromium mit iPad-Bildschirmgröße und Software-Grafik. **Safari auf dem echten iPad ist noch nicht getestet** (keine Safari-Engine in der Testumgebung). Bitte Gesten, Bildrate und den Home-Bildschirm-Modus auf dem Gerät prüfen.
- **Männliches Modell:** Z-Anatomy enthält nur einen männlichen Körper.
- **Haut:** Im Modell gibt es nur die Hautoberfläche in Regionen. Epidermis, Dermis und Subcutis kommen als Schema in Etappe 4.
- **Unterhaut/Fettgewebe** fehlt im Modell und wird als schematische Hülle ergänzt (klar gekennzeichnet).
- **Markierungspunkte** stammen aus Z-Anatomy und liegen nur auf einer Körperseite. Für die andere Seite werden sie gespiegelt.
- Einzelne Bänder (z. B. Lig. patellae, Außenbänder des Sprunggelenks, Leistenband) liegen in Z-Anatomy nicht in der Gelenk-Sammlung. Sie kommen in Etappe 2/3.

## Fahrplan

1. ✅ Prototyp: Skelett, Info-Panel, Ebenen-Steuerung, Suche, Offline
2. Gelenke und Bänder: Gelenktyp, Achsen, Bewegungsumfänge (Neutral-Null), Kapsel-Band-Apparat
3. Muskeln (oberflächlich/tief) mit Ursprung, Ansatz, Innervation; Ursprungs-/Ansatzflächen am Knochen
4. Faszien (inkl. Fascia lata, Tractus iliotibialis, Fascia thoracolumbalis), Haut-Feinbau, Unterhaut (Schema)
5. Nerven und Gefäße
6. Organe
7. Lernmodus: Lernpfade nach Ausbildungsjahr, Quiz („Tippe auf …“), Lernkarten mit Wiederholungsabstand, Merkliste

## Lizenzen

- **Programmcode:** MIT (siehe `LICENSE`)
- **3D-Modelle und Markierungen** (`public/modelle`, `public/inhalte/generiert`): abgeleitet von Z-Anatomy → **CC BY-SA 4.0**
- **Lerntexte und Schemata** (`public/inhalte/texte`, `public/schemata`): **CC BY-SA 4.0**
- Details und Namensnennung: [QUELLEN_UND_LIZENZEN.md](QUELLEN_UND_LIZENZEN.md)
