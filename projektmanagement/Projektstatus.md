# Projektstatus: HTLBets

**Stand:** 22.05.2026  
**Status:** funktionsfähige Demo-Version vorhanden, Schwerpunkt auf QA, Dokumentation und Abgabe

---

## 1. Kurzüberblick

HTLBets ist aktuell als funktionsfähige Demo-Plattform mit mehreren Spielmodi, Authentifizierung, Profilbereich, Daily Rewards, Karten-Deck-System, Realtime-Mehrspielerfunktionen und Admin-Dashboard vorhanden.

Die Anwendung kann lokal gestartet werden. Build und vorhandene Tests laufen aktuell erfolgreich durch.

---

## 2. Bereits umgesetzt

### Benutzer und Plattform

- Login mit Schul-E-Mail
- erster Login per Code
- späterer Login per Passwort
- Profil mit Username und Avatar
- persönlicher Verlauf
- Daily Rewards
- Leaderboard

### Spiele

- Roulette
- Blackjack
- Poker mit öffentlichen und privaten Tischen
- Miner
- Crash
- Slots
- Ochko
- Mafia mit Raumlogik, Rollenphasen sowie optionalem Text-/Video-Modus

### Karten-Deck-System

- Deck-Katalog
- Deck-Kauf
- Deck-Auswahl
- Admin-Import von Decks
- Standard-Deck-Umschaltung
- Deck-Zuweisung an einzelne Nutzer:innen

### Admin-Bereich

- Nutzer:innen suchen
- Guthaben ändern
- Historie prüfen
- Decks vergeben oder direkt ausrüsten
- Nutzer:innen sperren / entsperren
- Nutzerdaten zurücksetzen
- Accounts löschen
- Spiele aktivieren / deaktivieren

---

## 3. Technischer Stand

| Bereich | Stand |
|---|---|
| Frontend | Angular-Anwendung mit Routing, Guards und Admin-Seite |
| Backend | Express + TypeScript + Prisma |
| Datenbank | PostgreSQL |
| Realtime | Socket.io für gemeinsame Spielzustände |
| Lokale Entwicklung | `npm run dev` mit gemeinsamem Bootstrap |
| Dokumentation | README sowie Projektmanagement-Unterlagen vorhanden und erweitert |

---

## 4. Qualitätssicherung

Zum Stand dieses Dokuments wurden erfolgreich ausgeführt:

- `npm run build`
- `npm run test`

Zusätzlich existieren automatisierte Tests im Projekt, insbesondere für Backend-Logik, Services und ausgewählte Frontend-Bausteine.

---

## 5. Offene bzw. nächste sinnvolle Schritte

- manuelle End-QA der wichtigsten Benutzerflüsse
- Review der Projektunterlagen mit Lehrperson
- Feinschliff der Abgabeunterlagen und Präsentation
- finale Endabnahme vorbereiten

---

## 6. Risiken im aktuellen Stand

| Risiko | Einschätzung |
|---|---|
| Dokumentation läuft Features hinterher | wurde reduziert, bleibt aber beobachtbar |
| Viele Spielmodi erhöhen Testaufwand | weiterhin relevant |
| Realtime- und Admin-Funktionen brauchen saubere Endkontrolle | weiterhin relevant |
| Video-/Audio-Funktionen in Mehrspieler-Modi sind technisch empfindlicher | weiterhin relevant |

---

## 7. Fazit

HTLBets ist nicht mehr nur ein Grundgerüst, sondern bereits eine breit ausgebaute Demo-Plattform mit vollständigem Kernumfang für die Vorführung.  
Der aktuelle Schwerpunkt liegt weniger auf fehlenden Kernfeatures als auf Konsistenz der Dokumentation, End-QA, Feinschliff und sauberer Abgabe.
