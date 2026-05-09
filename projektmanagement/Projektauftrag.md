# Projektauftrag: HTLBets

**Dokumenttyp:** Projektauftrag  
**Projekt:** HTLBets  
**Version:** 1.1  
**Status:** aktualisiert  
**Datum:** 09.05.2026

---

## 1. Projektbezeichnung

**HTLBets – Minigame-Plattform für HTL-Schüler:innen**

HTLBets ist eine PC-first Webplattform, auf der berechtigte Nutzer:innen Minispiele spielen können. Das Projekt dient ausschließlich Demonstrations-, Lern- und Entwicklungszwecken.

---

## 2. Projektauftraggeber

| Rolle | Name / Organisation                                 |
|---|-----------------------------------------------------|
| Projektauftraggeber | HTL / betreuende Lehrperson                         |
| Auftragnehmer | Projektteam HTLBets                                 |
| Projektleitung | `IDK SORRY ME PLS`                                  |
| Projektteam | `Maksym Rvachov und Oleksii Shovkoplias`            |
| Zielgruppe | Schüler:innen mit berechtigter Schul-E-Mail-Adresse |

---

## 3. Projekthintergrund

Im Rahmen des Unterrichts soll eine moderne, interaktive Webanwendung geplant, umgesetzt und dokumentiert werden. Das Projekt soll zeigen, wie eine Plattform mit Benutzeranmeldung, Guthaben, Echtzeit-Spielzuständen, Profilverwaltung, Spielhistorie und einfachen Administrationsfunktionen aufgebaut werden kann.

HTLBets verwendet ausschließlich virtuelle Credits. Es werden keine Echtgeld-Wetten, keine Zahlungen, keine Auszahlungen und keine monetären Einsätze angeboten. Das Projekt bleibt damit klar als Schul-,  und Lernprojekt abgegrenzt.

---

## 4. Projektendergebnis

Am Projektende liegt eine abnahmefähige Webanwendung mit folgender Dokumentation vor:

| Ergebnis | Messbare Eigenschaft |
|---|---|
| Mobile-first Weboberfläche | Bedienbar auf Smartphone-Breite sowie auf Desktop-Bildschirmen |
| Benutzerzugang | Anmeldung nur für berechtigte Schul-E-Mail-Adressen möglich |
| Authentifizierungsablauf | Erster Login per Code; danach Passwort-Login möglich |
| Credit-System | Neue Nutzer:innen erhalten ein Startguthaben; Guthaben ändert sich nachvollziehbar |
| Roulette | Realtime-Roulette mit gemeinsamem Tisch, Countdown und sichtbaren Einsätzen |
| Blackjack | Blackjack ist spielbar |
| Poker | Multiplayer-Poker mit öffentlichen und privaten Tischen ist verfügbar |
| Profilfunktionen | Benutzername, Historie und tägliche Belohnungen sind verfügbar |
| Administrationsbereich | Admin-Nutzer:innen können Nutzer:innen suchen und Guthaben verwalten |
| Sicherheitsabgrenzung | Keine Echtgeldfunktion, keine Zahlungsfunktion, keine Auszahlung und keine monetären Einsätze |
| Qualitätssicherung | Anwendung kann lokal gestartet werden; vorhandene Builds und Tests laufen ohne bekannte kritische Fehler |
| Projektdokumentation | README und Projektauftrag sind im Repository abgelegt |

---

## 5. Projektziele

### 5.1 Hauptziel

Ziel des Projekts ist die Entwicklung einer funktionsfähigen Minigame-Plattform für HTL-Schüler:innen, bei der Nutzer:innen nach Anmeldung mit virtuellen Credits spielen, ihre Historie einsehen und an mehreren Spielmodi teilnehmen können.

### 5.2 Teilziele

| Nr. | Ziel | Messkriterium |
|---|---|---|
| Z1 | Nutzer:innen können sich mit einer berechtigten Schul-E-Mail-Adresse anmelden. | Anmeldung mit gültiger Adresse funktioniert; unberechtigte Adressen werden abgewiesen. |
| Z2 | Der Login-Ablauf ist zweistufig. | Erster Login erfolgt per Code; danach kann ein Passwort gesetzt und verwendet werden. |
| Z3 | Neue Nutzer:innen erhalten ein Startguthaben. | Startguthaben wird automatisch gesetzt. |
| Z4 | Roulette ist als Realtime-Spiel verfügbar. | Mehrere Nutzer:innen sehen denselben Tischzustand und dieselbe Runde. |
| Z5 | Blackjack ist als Spiel verfügbar. | Typische Aktionen wie Ziehen und Stehen bleiben funktionieren. |
| Z6 | Poker ist als Multiplayer-Spiel verfügbar. | Öffentliche und private Tische können verwendet werden. |
| Z7 | Spielausgänge sind nachvollziehbar. | Ergebnisse werden im Frontend angezeigt und in der Historie gespeichert. |
| Z8 | Die Oberfläche ist für mobile Nutzung optimiert. | Kernfunktionen sind auf Smartphone-Größe bedienbar. |
| Z9 | Es gibt einfache tägliche Belohnungen und Benutzerprofilfunktionen. | Daily Rewards, Benutzername und Profilansicht funktionieren. |
| Z10 | Eine einfache Administration ist vorhanden. | Admin-Nutzer:innen können Nutzer:innen finden und Guthaben verwalten. |
| Z11 | Die Anwendung ist vorführbar. | Projekt kann lokal oder in einer Umgebung gestartet und präsentiert werden. |

### 5.3 Nicht-Projektziele / Abgrenzung

Nicht Bestandteil dieses Projekts sind:

- Echtgeld-Glücksspiel
- Zahlungen, Einzahlungen oder Auszahlungen
- Monetäre Wetten oder finanzielle Gewinne
- Veröffentlichung als öffentliches Casino- oder Wettprodukt
- Rechtliche Zertifizierung für Glücksspielbetrieb
- Poker auf professionellem Echtgeld-Casino-Niveau
- Native Apps für App Store oder Play Store
- Langfristiger Produktivbetrieb mit echtem Kundensupport

---

## 6. Projektbeschreibung

HTLBets wird als Webplattform umgesetzt. Nutzer:innen melden sich mit einer berechtigten Schul-E-Mail-Adresse an und erhalten ein virtuelles Guthaben. Beim ersten Login erfolgt die Anmeldung per E-Mail-Code; danach kann ein Passwort gesetzt werden. Mit dem Guthaben können Nutzer:innen in einer mobilen Oberfläche Minispiele spielen.

Roulette läuft als gemeinsamer Echtzeit-Tisch mit sichtbaren Einsätzen. Blackjack ist als klassisches Einzelspiel verfügbar. Poker bietet öffentliche und private Tische mit Buy-in-Logik und Multiplayer-Tischansicht. Zusätzlich gibt es Profilfunktionen, eine Spielhistorie, tägliche Belohnungen sowie einen einfachen Administrationsbereich.

Die Projektarbeit umfasst:

1. Planung der Anforderungen und Projektabgrenzung
2. Entwurf der Benutzerführung
3. Umsetzung von Anmeldung und Nutzerverwaltung
4. Umsetzung des Guthabens und der Rewards
5. Umsetzung der Spielmodi und Echtzeitlogik
6. Umsetzung von Historie und Admin-Funktionen
7. Test, Fehlerbehebung und Dokumentation
8. Abnahme und Präsentation

Technische Implementierungsdetails werden nicht im Projektauftrag festgelegt, sondern in den technischen Unterlagen und im Quellcode beschrieben.

---

## 7. Projektphasen / Meilensteine

| Phase | Ergebnis | Soll-Termin | Freigabe durch |
|---|---|---:|---|
| 1. Projektstart | Projektauftrag erstellt und abgestimmt | 28.04.2026 | Auftraggeber / Lehrperson |
| 2. Anforderungsanalyse | Funktionsumfang, Nicht-Ziele und Akzeptanzkriterien festgelegt | 05.05.2026 | Projektleitung |
| 3. UI- und Ablaufkonzept | Bedienkonzept für Login, Spiele, Profil und Admin | 12.05.2026 | Projektteam |
| 4. Grundfunktionen | Anmeldung, Nutzerstatus und Guthaben funktionieren | 19.05.2026 | Projektleitung |
| 5. Spielfunktionen I | Roulette und Blackjack spielbar | 02.06.2026 | Projektteam |
| 6. Spielfunktionen II | Multiplayer-Poker und Tischlogik integriert | 12.06.2026 | Projektteam |
| 7. Zusatzfunktionen | Profil, Rewards, Admin und Historie abgeschlossen | 20.06.2026 | Projektleitung |
| 8. Abnahmeversion | Version ist vorführbar und dokumentiert | 26.06.2026 | Auftraggeber / Lehrperson |
| 9. Projektabschluss | Präsentation, Reflexion und finale Abgabe | 30.06.2026 | Auftraggeber / Lehrperson |

---

## 8. Projektstart / Projektende

| Punkt | Beschreibung |
|---|---|
| Offizieller Projektstart | 28.04.2026, nach Freigabe bzw. Unterzeichnung dieses Projektauftrags |
| Auslösendes Ereignis | Auftrag zur Erstellung einer Minigame-Plattform im Rahmen des Unterrichts |
| Geplantes Projektende | 30.06.2026 |
| Abschlussereignis | Abnahme der Version, Abgabe der Dokumentation und Präsentation des Projekts |

---

## 9. Projektressourcen

### 9.1 Personal

| Rolle | Aufgaben |
|---|---|
| Projektleitung | Planung, Koordination, Terminüberwachung, Kommunikation mit Auftraggeber |
| Frontend-Verantwortliche:r | Benutzeroberfläche, Responsive Design, Spiele-UI |
| Backend-/Realtime-Verantwortliche:r | Nutzerverwaltung, Spiellogik, Socket-Kommunikation, Credit-System |
| Qualitätssicherung | Tests, Fehlerdokumentation, Abnahmekriterien |
| Dokumentation | README, Projektauftrag, Präsentationsunterlagen |

### 9.2 Infrastruktur und Material

| Ressource | Beschreibung |
|---|---|
| Entwicklungsgeräte | Schul- oder Privatgeräte der Teammitglieder |
| Versionsverwaltung | Git-Repository für Quellcode und Dokumentation |
| Testgeräte | Mindestens ein Smartphone-Browser und ein Desktop-Browser |
| Entwicklungsumgebung | Lokale Entwicklungsumgebung mit Node.js, Docker und PostgreSQL |
| Kommunikationsmittel | Unterricht, Chat oder Projektbesprechungen |

### 9.3 Kostenrahmen

| Kostenart | Erwartete Kosten |
|---|---:|
| Softwarelizenzen | 0 € bei Verwendung frei verfügbarer Werkzeuge |
| Hardware | 0 € zusätzliche Kosten, vorhandene Geräte werden genutzt |
| Betrieb / Hosting | 0 € bis geringfügig, sofern bestehende Infrastruktur verwendet wird |
| Externe Dienstleistungen | Nicht vorgesehen |

---

## 10. Projektrisiken

| Risiko | Auswirkung | Wahrscheinlichkeit | Gegenmaßnahme |
|---|---|---:|---|
| Unklare Abgrenzung zu echtem Glücksspiel | Missverständnisse über Zweck und rechtliche Einordnung | Mittel | Klare Dokumentation: nur Credits, kein Echtgeld, keine Zahlungen |
| Funktionsumfang wird zu groß | Terminverzug und unfertige Kernfunktionen | Mittel | Fokus auf stabile Kernfunktionen; Erweiterungen klar priorisieren |
| Echtzeitlogik verhält sich instabil | Nutzer:innen sehen inkonsistente Spielzustände | Mittel | Server-seitige Spiellogik zentral halten und gezielt testen |
| Mobile Darstellung ist unübersichtlich | Schlechte Bedienbarkeit bei der Abnahme | Mittel | Mobile-first Design laufend testen |
| Historie oder Guthaben werden fehlerhaft gespeichert | Ergebnisse nicht nachvollziehbar | Niedrig bis mittel | Testfälle für Spielrunden, Balance und Verlauf erstellen |
| Authentifizierungsablauf ist unklar | Nutzer:innen können sich nicht zuverlässig anmelden | Mittel | Login-Flow früh testen und dokumentieren |
| Sicherheitslücken oder Manipulation von Credits | Ergebnisse sind nicht vertrauenswürdig | Mittel | Kritische Spiel- und Guthabenlogik im Backend halten |
| Zeitmangel kurz vor Abgabe | Qualitätsverlust und fehlende Dokumentation | Mittel | Meilensteine einhalten und Dokumentation laufend pflegen |

---

## 11. Projektorganisation

| Bereich | Zuständigkeit               |
|---|-----------------------------|
| Auftraggeber | HTL / betreuende Lehrperson |
| Projektleitung | `IDK SORRY ME PLS`          |
| Entwicklung | Projektteam HTLBets         |
| Qualitätssicherung | `Projektteam HTLBets`          |
| Dokumentation | `Projektteam HTLBets`          |
| Abnahme | Auftraggeber / Lehrperson   |

### Kommunikationsregeln

- Projektfortschritt wird regelmäßig im Team abgestimmt.
- Offene Punkte werden schriftlich im Repository, in Issues oder in einer gemeinsamen Aufgabenliste festgehalten.
- Änderungen am Projektumfang müssen mit der Projektleitung und dem Auftraggeber abgestimmt werden.
- Vor der Abgabe wird geprüft, ob alle Muss-Ziele erfüllt und alle Nicht-Ziele eingehalten wurden.

---

## 12. Abnahmekriterien

Das Projekt gilt als erfolgreich abgeschlossen, wenn folgende Kriterien erfüllt sind:

- Die Anwendung kann gestartet und vorgeführt werden.
- Eine berechtigte Nutzerin bzw. ein berechtigter Nutzer kann sich anmelden.
- Das Guthaben wird angezeigt und verändert sich nach Spielrunden nachvollziehbar.
- Roulette, Blackjack und Poker sind in einer Version verwendbar.
- Eine Spielhistorie zeigt abgeschlossene Spielrunden.
- Daily Rewards und grundlegende Profilfunktionen sind vorhanden.
- Ein einfacher Admin-Bereich ist vorhanden.
- Die Oberfläche ist auf Smartphone-Größe bedienbar.
- Es gibt keine Funktionen für Echtgeld, Zahlungen, Auszahlungen oder monetäre Wetten.
- Die Dokumentation ist im Repository abgelegt.
- Auftraggeber bzw. Lehrperson nehmen die Version ab.

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
| 1.1 | 09.05.2026 | Aktualisierung auf aktuellen Projektstand mit Poker, Profil, Rewards und Admin | Projektteam HTLBets |
