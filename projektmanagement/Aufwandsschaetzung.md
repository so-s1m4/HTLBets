# Aufwandsschätzung: HTLBets

**Dokumenttyp:** Aufwandsschätzung  
**Projekt:** HTLBets  
**Version:** 1.0  
**Status:** erstellt  
**Datum:** 22.05.2026

---

## 1. Ziel

Dieses Dokument schätzt den voraussichtlichen Gesamtaufwand für das Projekt **HTLBets**.  
Die Schätzung dient als Planungsgrundlage für:

- Projektumfang
- Zeitplanung
- Priorisierung
- Dokumentation gegenüber der Lehrperson

Die Aufwandsschätzung bezieht sich auf den im [Projektauftrag.md](/Users/s1m4/Documents/HTLBets/projektmanagement/Projektauftrag.md) und [Pflichtenheft.md](/Users/s1m4/Documents/HTLBets/projektmanagement/Pflichtenheft.md) beschriebenen Funktionsumfang.

---

## 2. Schätzmethode

Für dieses Projekt wurde eine **Bottom-up-Schätzung mit Drei-Punkt-Schätzwerten** verwendet.

Für jedes Arbeitspaket wurden drei Werte betrachtet:

- **O (optimistisch):** Aufwand bei glattem Verlauf
- **R (realistisch):** erwarteter Normalfall
- **P (pessimistisch):** Aufwand bei typischen Problemen oder Nacharbeit

Die gewichtete Schätzung wurde mit folgender Formel berechnet:

```text
E = (O + 4R + P) / 6
```

Diese Methode ist für ein Schulprojekt gut geeignet, weil sie:

- Unsicherheiten sichtbar macht
- technische Risiken berücksichtigt
- nicht nur den Best Case betrachtet

---

## 3. Annahmen

Die Schätzung basiert auf folgenden Annahmen:

1. Das Projekt wird von **zwei Personen** umgesetzt.
2. Es handelt sich um ein **Demo-/Unterrichtsprojekt**, nicht um ein produktives Echtgeldsystem.
3. Die Entwicklung erfolgt auf Basis des aktuellen Stacks:
   - Angular
   - Express / TypeScript
   - Prisma
   - PostgreSQL
   - Socket.IO
4. Die wichtigsten Risiken liegen in:
   - Realtime-Logik
   - Mehrspieler-Synchronisation
   - UI-Feinschliff
   - Dokumentation parallel zur Umsetzung
5. Die Schätzung umfasst **Planung, Implementierung, Tests, UI-Arbeit und Dokumentation**.

---

## 4. Arbeitspakete

| Nr. | Arbeitspaket | O (h) | R (h) | P (h) | E (h) |
|---|---|---:|---:|---:|---:|
| AP1 | Planung, Scope, Projektauftrag | 8 | 10 | 14 | 10.3 |
| AP2 | Grundarchitektur, Projektsetup, Workspaces, Docker | 10 | 14 | 20 | 14.3 |
| AP3 | Authentifizierung und Benutzerzugang | 14 | 20 | 30 | 20.7 |
| AP4 | Datenmodell, Prisma, Migrationen | 8 | 12 | 18 | 12.3 |
| AP5 | Roulette | 12 | 18 | 26 | 18.3 |
| AP6 | Blackjack | 10 | 14 | 20 | 14.3 |
| AP7 | Poker mit öffentlichen / privaten Tischen | 20 | 30 | 44 | 30.7 |
| AP8 | Miner, Crash und Slots | 16 | 24 | 34 | 24.3 |
| AP9 | Ochko und Mafia | 24 | 34 | 50 | 35.0 |
| AP10 | Profil, Historie, Daily Rewards, Leaderboard | 14 | 20 | 30 | 20.7 |
| AP11 | Card-Deck-System | 10 | 15 | 22 | 15.3 |
| AP12 | Admin-Bereich inkl. Spiel-Verfügbarkeit | 14 | 20 | 30 | 20.7 |
| AP13 | UI/UX, Responsive Design, Feinschliff | 12 | 18 | 28 | 18.7 |
| AP14 | Tests, Build-Fixes, QA | 12 | 18 | 28 | 18.7 |
| AP15 | Dokumentation, Abschluss, Abgabevorbereitung | 8 | 12 | 18 | 12.3 |

### Zwischensumme

**Geschätzter Basisaufwand:** `286.6 h`

---

## 5. Reserve / Puffer

Für ein Projekt mit mehreren Realtime-Spielen und Admin-Logik ist ein Risiko- und Nacharbeitspuffer sinnvoll.

Empfohlener Puffer:

- **15 % Reserve** auf den Basisaufwand

```text
286.6 h * 0.15 = 43.0 h
```

### Aufwand inkl. Puffer

| Wert | Stunden |
|---|---:|
| Basisaufwand | 286.6 h |
| Reserve / Puffer (15 %) | 43.0 h |
| **Gesamtaufwand** | **329.6 h** |

Gerundet:

- **ca. 330 Stunden Gesamtaufwand**

---

## 6. Aufwand pro Person

Bei zwei Teammitgliedern ergibt sich im Mittel:

| Teamgröße | Gesamtaufwand | Aufwand pro Person |
|---|---:|---:|
| 2 Personen | 330 h | 165 h |

Das ist ein realistischer Wert für ein größeres Schulprojekt mit:

- mehreren Spielmodi
- Realtime-Mehrspielerlogik
- Admin-Funktionen
- Dokumentation und Präsentationsvorbereitung

---

## 7. Aufwand nach Bereichen

Zur besseren Einordnung wurde der Aufwand zusätzlich fachlich gruppiert.

| Bereich | Enthaltene Arbeitspakete | Aufwand |
|---|---|---:|
| Planung und Architektur | AP1-AP4 | 57.6 h |
| Spieleentwicklung | AP5-AP9 | 122.6 h |
| Plattformfunktionen | AP10-AP11 | 36.0 h |
| Administration | AP12 | 20.7 h |
| UI/UX und QA | AP13-AP14 | 37.4 h |
| Dokumentation und Abschluss | AP15 | 12.3 h |
| **Gesamt ohne Puffer** |  | **286.6 h** |

---

## 8. Risikofaktoren

Folgende Punkte können den realen Aufwand erhöhen:

| Risiko | Einfluss auf Aufwand |
|---|---|
| Realtime-Bugs bei Mehrspieler-Spielen | hoch |
| UI-Nacharbeit auf mobilen Breiten | mittel |
| Build-/CI-Probleme vor Abgabe | mittel |
| Dokumentation läuft der Entwicklung hinterher | mittel |
| neue Feature-Wünsche kurz vor Abgabe | hoch |

Besonders betroffen sind:

- Poker
- Mafia
- Ochko
- Admin-Funktionen
- finale UI-Politur

---

## 9. Vergleich mit dem bisherigen Projektstand

Laut [Stundenaufzeichnung.md](/Users/s1m4/Documents/HTLBets/projektmanagement/Stundenaufzeichnung.md) wurden bereits dokumentierte Stunden erfasst.

Diese Stunden bilden jedoch:

- nicht immer die gesamte Implementierungsarbeit,
- nicht vollständig alle Entwicklungsblöcke,
- teilweise nur Planungs- und Dokumentationsaufwand

ab.

Die hier vorliegende Aufwandsschätzung ist daher als **projektweite Soll-Schätzung** zu verstehen und nicht als reine Auswertung der bisher protokollierten Ist-Stunden.

---

## 10. Fazit

Für HTLBets ergibt sich ein realistischer Projektaufwand von:

- **ca. 287 Stunden** ohne Reserve
- **ca. 330 Stunden** inklusive 15 % Puffer

Die größten Aufwandstreiber sind:

1. Mehrspieler- und Realtime-Logik
2. Anzahl der Spiele
3. Admin- und Plattformfunktionen
4. UI-Feinschliff und Abschlussphase

Damit ist der Umfang für ein ambitioniertes Schulprojekt gut begründet und nachvollziehbar dokumentiert.

---

## 11. Änderungsverlauf

| Version | Datum | Änderung |
|---|---|---|
| 1.0 | 22.05.2026 | Erstfassung der Aufwandsschätzung erstellt |
