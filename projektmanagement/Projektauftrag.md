# Projektauftrag: HTLBets

**Dokumenttyp:** Projektauftrag  
**Projekt:** HTLBets  
**Version:** 1.4
**Status:** aktualisiert  
**Datum:** 09.06.2026

---

## 1. Projektbezeichnung

**HTLBets – Demo-Minigame-Plattform für HTL-Schüler:innen**

HTLBets ist eine Webplattform für Minispiele mit virtuellen Credits. Das Projekt dient ausschließlich Unterrichts-, Demonstrations- und Lernzwecken.

---

## 2. Projektauftraggeber

| Rolle | Name / Organisation |
|---|---|
| Projektauftraggeber | HTL / betreuende Lehrperson |
| Auftragnehmer | Projektteam HTLBets |
| Projektleitung | Maksym Rvachov |
| Projektteam | Maksym & Oleksii |
| Zielgruppe | Schüler:innen mit berechtigter Schul-E-Mail-Adresse |

---

## 3. Projekthintergrund

Im Rahmen des Unterrichts soll eine moderne Full-Stack-Webanwendung geplant, umgesetzt und dokumentiert werden. Das Projekt zeigt, wie Benutzerverwaltung, Authentifizierung, Guthabenlogik, Echtzeitkommunikation, Spielzustände und Administrationsfunktionen in einer zusammenhängenden Plattform umgesetzt werden können.

HTLBets verwendet ausschließlich virtuelle Credits. Es gibt keine Echtgeld-Wetten, keine Zahlungsabwicklung und keine Auszahlungen. Die Plattform ist damit klar als Schulprojekt und nicht als öffentliches Glücksspielprodukt abgegrenzt.

---

## 4. Projektendergebnis

Am Projektende liegt eine vorführbare Webanwendung mit folgender Dokumentation und Funktionalität vor:

| Ergebnis | Messbare Eigenschaft |
|---|---|
| Weboberfläche | Anwendung läuft im Browser und ist auf Desktop sowie auf mobilen Breiten nutzbar |
| Benutzerzugang | Anmeldung ist nur mit berechtigten Schul-E-Mail-Adressen möglich |
| Authentifizierungsablauf | Erster Login per Code, später Passwort-Login |
| Credit-System | Nutzer:innen erhalten ein Startguthaben und Guthabenänderungen sind nachvollziehbar |
| Roulette | Realtime-Roulette mit gemeinsamem Tischzustand |
| Blackjack | Einzelspiel ist spielbar |
| Poker | Multiplayer-Poker mit öffentlichen und privaten Tischen ist verfügbar |
| Weitere Spiele | Miner, Crash und Slots sind spielbar |
| Zusätzliche Mehrspieler-Spiele | Ochko und Mafia sind verfügbar |
| Zusätzlicher Einzelspielmodus | Balatro-inspirierter Run mit Blinds, Jokern und Shop ist verfügbar |
| Profilfunktionen | Profil, Avatar, Benutzername, Historie und Daily Rewards sind vorhanden |
| Card Decks | Kauf, Auswahl und Admin-Verwaltung von Karten-Decks sind vorhanden |
| Leaderboard | Ranglistenansichten für Demo-Kennzahlen sind verfügbar |
| Administrationsbereich | Admins können Nutzer:innen suchen, Guthaben ändern, Decks vergeben, Moderationsaktionen ausführen und Spiele aktivieren oder deaktivieren |
| Sicherheitsabgrenzung | Keine Echtgeldfunktion, keine Auszahlungs- oder Zahlungsfunktion |
| Qualitätssicherung | Builds und vorhandene Tests laufen lokal ohne bekannte kritische Fehler |
| Projektdokumentation | README und Projektmanagement-Unterlagen liegen im Repository |

---

## 5. Projektziele

### 5.1 Hauptziel

Ziel des Projekts ist die Entwicklung einer funktionsfähigen und vorführbaren Minigame-Plattform für HTL-Schüler:innen, bei der Nutzer:innen nach Anmeldung mit virtuellen Credits spielen, ihren Verlauf einsehen und mehrere Spielmodi verwenden können.

### 5.2 Teilziele

| Nr. | Ziel | Messkriterium |
|---|---|---|
| Z1 | Nutzer:innen können sich mit berechtigter Schul-E-Mail-Adresse anmelden. | Gültige Schuladresse funktioniert, unberechtigte Adressen werden abgewiesen. |
| Z2 | Der Login-Ablauf ist zweistufig. | Erster Login per Code, danach Passwort möglich. |
| Z3 | Neue Nutzer:innen erhalten ein Startguthaben. | Startguthaben wird automatisch gesetzt. |
| Z4 | Realtime-Spielzustände werden zentral im Backend geführt. | Mehrere Nutzer:innen sehen konsistente Zustände. |
| Z5 | Roulette, Blackjack und Poker sind verwendbar. | Kernaktionen der Spiele funktionieren nachvollziehbar. |
| Z6 | Miner, Crash und Slots ergänzen die Plattform als weitere Minigames. | Alle drei Modi lassen sich starten und beenden. |
| Z7 | Ergebnisse und Guthabenänderungen sind nachvollziehbar. | Historie und Balance-Updates werden gespeichert und angezeigt. |
| Z8 | Profil, Avatar, Daily Rewards und Leaderboard sind vorhanden. | Module sind im Frontend erreichbar und backendseitig angebunden. |
| Z9 | Deck-System für Spielkarten ist vorhanden. | Decks können verwaltet, gekauft, gewählt und vergeben werden. |
| Z10 | Eine Admin-Oberfläche für Moderation und Verwaltung ist vorhanden. | Suche, Balance, Deck-Zuweisung, Ban, Wipe und Delete sind möglich. |
| Z11 | Weitere Mehrspieler-Spiele ergänzen die Plattform. | Ochko und Mafia sind erreichbar und technisch eingebunden. |
| Z12 | Das Projekt ist lokal vorführbar. | `npm run dev`, Build, Tests und Dokumentation funktionieren. |
| Z13 | Ein roguelike Poker-Einzelspiel ergänzt den Umfang. | Balatro ist erreichbar, spielbar und vom persistenten Credit-System getrennt. |

### 5.3 Nicht-Projektziele / Abgrenzung

Nicht Bestandteil dieses Projekts sind:

- Echtgeld-Glücksspiel
- Zahlungen, Einzahlungen oder Auszahlungen
- Rechtliche Zertifizierung für Glücksspielbetrieb
- Mobile Native Apps
- öffentlicher Produktivbetrieb mit Support
- hochskalierter Dauerbetrieb

---

## 6. Projektbeschreibung

HTLBets wird als Angular-/Node.js-Webplattform umgesetzt. Nutzer:innen melden sich mit einer berechtigten Schul-E-Mail-Adresse an und erhalten ein virtuelles Guthaben. Beim ersten Login wird ein Code verwendet, danach kann ein Passwort gesetzt werden. Das Guthaben dient ausschließlich zu Demonstrationszwecken innerhalb der Spielmodi.

Die Plattform enthält mehrere Spiele mit unterschiedlichen Anforderungen:

1. Roulette mit gemeinsamem Echtzeit-Tisch
2. Blackjack als klassisches Einzelspiel
3. Poker mit öffentlichen und privaten Multiplayer-Tischen
4. Miner
5. Crash
6. Slots
7. Ochko als Multiplayer-Kartenspiel
8. Mafia als Rollen- und Raumspiel mit optionalem Text-/Video-Modus
9. Balatro als clientseitiger Einzelspiel-Run mit Blinds, Pokerhand-Wertung, Jokern, Consumables und Shop

Zusätzlich gibt es Profilfunktionen, Daily Rewards, Leaderboards, ein Card-Deck-System sowie einen Admin-Bereich. Im Admin-Bereich können Nutzerkonten gesucht, Guthaben angepasst, Karten-Decks vergeben und Moderationsmaßnahmen wie Ban, Wipe oder Delete ausgelöst werden. Außerdem kann die Verfügbarkeit einzelner Spiele zentral gesteuert werden.

Technische Detailentscheidungen werden nicht im Projektauftrag festgelegt, sondern im Quellcode, im README und in den ergänzenden Projektunterlagen beschrieben.

---

## 7. Projektphasen / Meilensteine

| Phase | Ergebnis | Soll-Termin | Freigabe durch |
|---|---|---:|---|
| 1. Projektstart | Projektauftrag erstellt und abgestimmt | 28.04.2026 | Auftraggeber / Lehrperson |
| 2. Analyse und Planung | Anforderungen, Risiken und Abgrenzung dokumentiert | 05.05.2026 | Projektleitung |
| 3. Grundarchitektur | Frontend, Backend, DB und Auth-Grundlagen eingerichtet | 09.05.2026 | Projektteam |
| 4. Kernspiele | Roulette, Blackjack und Poker integriert | 20.05.2026 | Projektteam |
| 5. Erweiterte Spiele | Miner, Crash und Slots integriert | 27.05.2026 | Projektteam |
| 6. Zusatzfunktionen | Profil, Rewards, Deck-System, Leaderboard und Historie abgeschlossen | 03.06.2026 | Projektleitung |
| 7. Admin-Funktionen | Admin-Dashboard mit Nutzer-, Deck- und Moderationsfunktionen abgeschlossen | 10.06.2026 | Projektleitung |
| 8. Abnahmeversion | Dokumentierte, vorführbare Gesamtversion | 20.06.2026 | Auftraggeber / Lehrperson |
| 9. Projektabschluss | Präsentation und finale Abgabe | 30.06.2026 | Auftraggeber / Lehrperson |

---

## 8. Projektstart / Projektende

| Punkt | Beschreibung |
|---|---|
| Offizieller Projektstart | 28.04.2026 |
| Auslösendes Ereignis | Unterrichtsprojekt zur Planung und Umsetzung einer interaktiven Webanwendung |
| Geplantes Projektende | 30.06.2026 |
| Abschlussereignis | Vorführung, Dokumentation und Abgabe |

---

## 9. Projektressourcen

### 9.1 Personal

| Rolle | Aufgaben |
|---|---|
| Projektleitung | Planung, Koordination, Priorisierung, Kommunikation |
| Frontend | Angular-Oberfläche, Responsive Layouts, Spiel-UI |
| Backend | Auth, Spiellogik, Admin-API, Echtzeitkommunikation |
| Datenhaltung | Prisma-Schema, PostgreSQL, Migrations |
| Qualitätssicherung | Tests, Build-Prüfung, manuelle Verifikation |
| Dokumentation | README, Projektauftrag, Projektstatus |

### 9.2 Infrastruktur und Material

| Ressource | Beschreibung |
|---|---|
| Entwicklungsgeräte | Schul- oder Privatgeräte der Teammitglieder |
| Versionsverwaltung | Git-Repository |
| Entwicklungsumgebung | Node.js, npm, Docker, PostgreSQL |
| Testumgebung | Lokale Browser auf Desktop und mobile Breiten |
| Kommunikation | Unterricht, Chat, gemeinsame Aufgabenlisten |

### 9.3 Kostenrahmen

| Kostenart | Erwartete Kosten |
|---|---:|
| Softwarelizenzen | 0 € bei Verwendung frei verfügbarer Werkzeuge |
| Hardware | 0 € zusätzliche Kosten |
| Hosting / Betrieb | gering bzw. Demo-Deployment |
| Externe Dienstleistungen | nicht vorgesehen |

---

## 10. Projektrisiken

| Risiko | Auswirkung | Wahrscheinlichkeit | Gegenmaßnahme |
|---|---|---:|---|
| Umfang wächst schneller als Dokumentation | Inkonsistente Projektunterlagen | Mittel | README und Projektstatus laufend aktualisieren |
| Echtzeitlogik verhält sich instabil | Falsche oder inkonsistente Spielzustände | Mittel | Zentrale Serverlogik und gezielte Tests |
| Mobile Darstellung leidet bei neuen Features | Schlechtere Bedienbarkeit | Mittel | UI-Review nach größeren Änderungen |
| Guthaben- oder Historienlogik ist fehlerhaft | Nachvollziehbarkeit leidet | Mittel | Backend-validierte Balance-Änderungen und Tests |
| Admin-Funktionen sind zu mächtig oder unklar | Gefahr unbeabsichtigter Änderungen | Mittel | Klare UI-Trennung und Audit-Einträge |
| Zeitmangel vor Abgabe | Fehlende QA oder unvollständige Doku | Mittel | Fokus auf lauffähige Kernversion und strukturierte Abschlussphase |

---

## 11. Projektorganisation

| Bereich | Zuständigkeit |
|---|---|
| Auftraggeber | HTL / betreuende Lehrperson |
| Projektleitung | Maksym Rvachov |
| Entwicklung | Projektteam HTLBets |
| Qualitätssicherung | Projektteam HTLBets |
| Dokumentation | Projektteam HTLBets |
| Abnahme | Auftraggeber / Lehrperson |

### Kommunikationsregeln

- Projektfortschritt wird regelmäßig im Team abgestimmt.
- Offene Punkte werden im Repository oder in einer gemeinsamen Aufgabenliste festgehalten.
- Änderungen am Projektumfang werden dokumentiert.
- Vor der Abgabe werden Build, Test und Dokumentation gemeinsam geprüft.

---

## 12. Abnahmekriterien

Das Projekt gilt als erfolgreich abgeschlossen, wenn folgende Kriterien erfüllt sind:

- Die Anwendung kann lokal gestartet und vorgeführt werden.
- Authentifizierung mit berechtigter Schul-E-Mail funktioniert.
- Guthaben wird angezeigt und ändert sich nachvollziehbar.
- Roulette, Blackjack, Poker, Miner, Crash, Slots, Ochko, Mafia und Balatro sind verwendbar.
- Historie, Profil, Rewards und Leaderboard sind erreichbar.
- Card-Deck-System ist nutzbar.
- Admin-Bereich ist vorhanden und bietet Verwaltungs- sowie Moderationsfunktionen.
- Es gibt keine Echtgeld- oder Zahlungsfunktion.
- Die Dokumentation ist im Repository abgelegt und aktuell.

---

## 13. Abschluss / Unterschriften

Mit der Unterzeichnung bestätigen Auftraggeber und Projektteam den beschriebenen Projektumfang, die Ziele, die Abgrenzungen und die Rahmenbedingungen.

| Rolle | Name | Datum | Unterschrift |
|---|---|---|---|
| Auftraggeber / Lehrperson |  |  |  |
| Projektleitung |  |  |  |
| Teammitglied |  |  |  |
| Teammitglied |  |  |  |

---

## 14. Änderungsverlauf

| Version | Datum | Änderung | Autor:in |
|---|---:|---|---|
| 1.0 | 28.04.2026 | Erstfassung des Projektauftrags | Projektteam HTLBets |
| 1.1 | 09.05.2026 | Aktualisierung auf Projektstand mit Poker, Profil, Rewards und Admin | Projektteam HTLBets |
| 1.2 | 11.05.2026 | Erweiterung auf Miner, Crash, Slots, Deck-System, Leaderboard und Moderation | Projektteam HTLBets |
| 1.3 | 22.05.2026 | Ergänzung um Ochko, Mafia sowie Admin-Steuerung der Spiel-Verfügbarkeit | Projektteam HTLBets |
| 1.4 | 09.06.2026 | Balatro und aktueller Neun-Spiele-Umfang ergänzt | Projektteam HTLBets |
