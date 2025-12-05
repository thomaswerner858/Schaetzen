# Das Schätzduell

Ein interaktives Multiplayer-Schätzspiel basierend auf React, Firebase und Airtable.

## Funktionen

- **Echtzeit-Lobby:** Warten auf Mitspieler.
- **Synchronisierter Timer:** Alle Spieler schätzen gleichzeitig.
- **Hybride Daten:** Spielstatus via Firestore, Fragen via Airtable.
- **Responsive UI:** Optimiert für Mobile und Desktop.

## Einrichtung & GitHub Verknüpfung

Da du die Dateien bereits lokal hast, musst du sie nun mit deinem GitHub-Repository verknüpfen.

1. **Terminal öffnen:** Öffne dein Terminal im Ordner dieses Projekts.

2. **Git initialisieren (falls noch nicht geschehen):**
   ```bash
   git init
   git add .
   git commit -m "Initialer Projektstart"
   ```

3. **Mit deinem Repository verknüpfen:**
   Ersetze `DEIN_USER` und `DEIN_REPO_NAME` mit deinen echten Daten (die URL findest du auf GitHub unter dem grünen "Code"-Button):
   ```bash
   git remote add origin https://github.com/DEIN_USER/DEIN_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

## Installation & Start (für andere Entwickler)

1. Abhängigkeiten installieren:
   ```bash
   npm install
   ```

2. Konfiguration anpassen:
   Öffne `constants.ts` und trage deine API-Keys ein:
   - Firebase Config
   - Airtable API Key & Base ID

3. Entwicklungsserver starten:
   ```bash
   npm run dev
   ```

## Tech Stack

- React 18
- Tailwind CSS
- Firebase Firestore (Realtime DB)
- Airtable (CMS)
- Vite (Build Tool)
