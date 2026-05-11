# Projektstatus: HTLBets

**Stand:** 11.05.2026  
**Status:** in Umsetzung, lauffähige Demo-Version vorhanden

---

## 1. Kurzüberblick

HTLBets ist aktuell als funktionsfähige Demo-Plattform mit mehreren Spielmodi, Authentifizierung, Profilbereich, Daily Rewards, Karten-Deck-System und Admin-Dashboard vorhanden.

Die Anwendung kann lokal gestartet werden und die vorhandenen Builds laufen erfolgreich durch.

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

---

## 3. Technischer Stand

| Bereich | Stand |
|---|---|
| Frontend | Angular-Anwendung mit Routing, Guards und Admin-Seite |
| Backend | Express + TypeScript + Prisma |
| Datenbank | PostgreSQL |
| Realtime | Socket.io für gemeinsame Spielzustände |
| Lokale Entwicklung | `npm run dev` mit gemeinsamem Bootstrap |
| Dokumentation | README und Projektmanagement-Unterlagen aktualisiert |

---

## 4. Qualitätssicherung

Zum Stand dieses Dokuments wurden erfolgreich ausgeführt:

- `npm run build --workspace server`
- `npm run build --workspace client`

Zusätzlich existieren automatisierte Tests im Projekt, insbesondere für Backend-Logik und ausgewählte Spielflüsse.

---

## 5. Offene bzw. nächste sinnvolle Schritte

- manuelle UI-QA der finalen Admin-Seite nach Login
- Review der Projektunterlagen mit Lehrperson
- gegebenenfalls Gantt-, Stunden- oder Präsentationsunterlagen ergänzen
- Endabnahme vorbereiten

---

## 6. Risiken im aktuellen Stand

| Risiko | Einschätzung |
|---|---|
| Dokumentation läuft Features hinterher | wurde durch die aktuelle Überarbeitung reduziert |
| Viele Spielmodi erhöhen Testaufwand | weiterhin relevant |
| Realtime- und Admin-Funktionen brauchen saubere Endkontrolle | weiterhin relevant |

---

## 7. Fazit

HTLBets ist nicht mehr nur ein Grundgerüst, sondern bereits eine breit ausgebaute Demo-Plattform.  
Der aktuelle Schwerpunkt liegt weniger auf fehlenden Kernfeatures als auf Dokumentation, Feinabstimmung, QA und sauberer Abgabe.
