# Projektstatus: HTLBets

**Stand:** 09.06.2026
**Status:** funktionsfähige Demo-Version mit neun sichtbaren Spielmodi; Schwerpunkt auf End-QA, Dokumentation und Abgabe

---

## 1. Kurzüberblick

HTLBets ist aktuell als funktionsfähige Demo-Plattform mit neun sichtbaren Spielmodi, Authentifizierung, Profilbereich, Daily Rewards, Karten-Deck-System, Realtime-Mehrspielerfunktionen und Admin-Dashboard vorhanden.

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
- Balatro-inspirierter Einzelspielmodus mit Blinds, Pokerhand-Wertung, Jokern, Consumables und Shop

Balatro ist derzeit bewusst clientseitig umgesetzt. Die interne Run-Währung ist vom persistierten Benutzer:innen-Guthaben getrennt.

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
| Media | WebRTC-Signaling über Socket.io für Poker und Mafia |
| Lokale Entwicklung | `npm run dev` mit gemeinsamem Bootstrap |
| Spielkatalog | Neun Spiele, zentral durch Admins aktivierbar/deaktivierbar |
| Dokumentation | README, API-Referenz und Projektmanagement-Unterlagen auf Stand 09.06.2026 |

---

## 4. Qualitätssicherung

Am 09.06.2026 wurden erfolgreich ausgeführt:

- `npm run build`
- `npm run test`
- Server: 10 Testdateien, 33 Tests erfolgreich
- Client: 2 Testdateien, 5 Tests erfolgreich

Beim Client-Build erscheint aktuell ein Node-Deprecation-Hinweis zu `module.register()`. Die Anwendung wird dennoch erfolgreich gebaut.

---

## 5. Offene bzw. nächste sinnvolle Schritte

- manuelle End-QA der wichtigsten Benutzerflüsse
- manuelle End-QA von Balatro sowie der zuletzt überarbeiteten Roulette-/Poker-Oberflächen
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
| Balatro-Zustand ist nicht serverseitig persistent | akzeptierte Demo-Grenze |

---

## 7. Fazit

HTLBets ist nicht mehr nur ein Grundgerüst, sondern bereits eine breit ausgebaute Demo-Plattform mit vollständigem Kernumfang für die Vorführung.  
Der aktuelle Schwerpunkt liegt weniger auf fehlenden Kernfeatures als auf Konsistenz der Dokumentation, End-QA, Feinschliff und sauberer Abgabe.
