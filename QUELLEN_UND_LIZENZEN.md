# Quellen, Lizenzen und Namensnennung

Stand: 14.11.2026. Alle Lizenzen wurden vor der Einbindung auf den Originalseiten geprüft.

## 3D-Modelle

### Z-Anatomy (Hauptquelle)
- **Was:** Blender-Atlas `Startup.blend` aus `Z-Anatomy.zip`. Daraus stammen alle 3D-Teile, ihre Namen, Gewebematerialien und die Ankerpunkte der Knochenmarkierungen.
- **Woher:** https://github.com/Z-Anatomy/Models-of-human-anatomy
- **Lizenz:** Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0), https://creativecommons.org/licenses/by-sa/4.0/
- **Namensnennung:** „Z-Anatomy – The libre 3D atlas of anatomy – CC-BY-SA 4.0“. Autoren laut Z-Anatomy: Gauthier Kervyn (Design, 3D, Anatomie), Marcin Zielinski (Blender-Add-on), Lluís Vinent (Unity), auf Grundlage von BodyParts3D (Kousaku Okubo).
- **Was wir geändert haben:** Modifikatoren angewendet, Geometrie vereinfacht (ca. 50 % der Dreiecke bei Knochen und Bändern), Meshopt-komprimiert, nach Ebenen aufgeteilt. Hilfsobjekte (Beschriftungen) entfernt. Markierungs-Ankerpunkte auf die Knochenoberfläche projiziert.
- **Folge (ShareAlike):** Die umgewandelten Modelle in `public/modelle/` und die Daten in `public/inhalte/generiert/` stehen ebenfalls unter **CC BY-SA 4.0**.

### Ausgeschlossene Teile (Lizenz passt nicht)
Z-Anatomy enthält zwei Modelle mit **nicht-kommerzieller** Lizenz. Sie werden vom Export-Skript automatisch ausgeschlossen (`lizenz_ausschluss` in `werkzeuge/export_konfig.json`):
- „Anatomy of the Inner Ear“ – University of Dundee School of Medicine – CC BY-NC-SA 4.0
- „Kidney“ – Lissie Cowley – CC BY-NC 4.0

Ebenfalls in Z-Anatomy als Referenz genannt und vor Etappe 5 (Nervensystem) noch zu prüfen: „Brainder“, „White matter“ (University of Washington), „Cranial Nerves and Foramina“ (University of Dundee, CAHID, CC BY 4.0).

### BodyParts3D (Grundlage von Z-Anatomy, Ausweichquelle)
- **Woher:** https://dbarchive.biosciencedbc.jp/en/bodyparts3d/
- **Lizenz:** seit 27.02.2025 **CC BY 4.0** (vorher CC BY-SA 2.1 Japan)
- **Namensnennung:** „BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International“

## Fachbegriffe

### Terminologia Anatomica 2 (TA2)
- Lateinische Namen über die Tabelle `TA2.csv` von Z-Anatomy (CC BY-SA 4.0), Grundlage: FIPAT, *Terminologia Anatomica*, 2. Auflage, 2019.
- Kopie im Projekt: `werkzeuge/quellen/TA2.csv`.

### Deutsche Namen
- Von Claude ergänzt (`public/inhalte/texte/namen_de.json` und Regeln in `werkzeuge/daten_bauen.mjs`). Bitte mit dem Schulbuch abgleichen.

## Lerntexte

- Die Texte in `public/inhalte/texte/` wurden von Claude aus anatomischem Standard-Lehrbuchwissen geschrieben. **Sie sind noch nicht von einer Fachperson gegengeprüft** und deshalb in der App als „Entwurf“ markiert.
- Referenz für Grundlagenwissen: OpenStax, *Anatomy and Physiology 2e* (2022), CC BY 4.0, https://openstax.org/details/books/anatomy-and-physiology-2e. Es wurden keine Texte daraus kopiert.
- Bewusst **nicht** übernommen: die Definitionen aus Z-Anatomy (aus Wikipedia, teils maschinell übersetzt).
- Angaben, die zwischen Lehrbüchern abweichen oder nicht gesichert sind (z. B. Antetorsionswinkel), stehen in `offen` und erscheinen als „noch zu prüfen“.
- Lizenz der Texte und Schemata: CC BY-SA 4.0.

## Software (Auswahl)

| Paket | Lizenz |
|---|---|
| three.js | MIT |
| three-mesh-bvh | MIT |
| MiniSearch | MIT |
| vite, vite-plugin-pwa, Workbox | MIT |
| glTF-Transform, meshoptimizer | MIT |
| Blender (`bpy`, nur für die Umwandlung) | GPL – wird nicht mit der App ausgeliefert |
