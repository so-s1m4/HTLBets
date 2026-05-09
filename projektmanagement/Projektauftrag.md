# Projektauftrag: HTLBets

**Dokumenttyp:** Projektauftrag  
**Projekt:** HTLBets  
**Version:** 1.0  
**Status:** Entwurf zur Freigabe  
**Datum:** 28.04.2026  

---

## 1. Projektbezeichnung

**HTLBets – Demo-Minigame-Plattform für HTL-Schüler:innen**

HTLBets ist eine mobile-first Webplattform, auf der berechtigte Nutzer:innen mit reinen Demo-Credits Minispiele spielen können. Das Projekt dient ausschließlich Demonstrations-, Lern- und Entwicklungszwecken.

---

## 2. Projektauftraggeber

| Rolle | Name / Organisation |
|---|---|
| Projektauftraggeber | HTL / betreuende Lehrperson |
| Auftragnehmer | Projektteam HTLBets |
| Projektleitung | `[Name der Projektleitung eintragen]` |
| Projektteam | `[Teammitglieder eintragen]` |
| Zielgruppe | Schüler:innen mit berechtigter Schul-E-Mail-Adresse |

---

## 3. Projekthintergrund

Im Rahmen des Unterrichts soll eine moderne, mobile-first Webanwendung geplant und umgesetzt werden. Das Projekt soll zeigen, wie eine interaktive Plattform mit Benutzeranmeldung, Demo-Guthaben, Spielabläufen und Spielhistorie konzipiert werden kann.

HTLBets verwendet ausschließlich virtuelle Demo-Credits. Es werden keine Echtgeld-Wetten, keine Zahlungen, keine Auszahlungen und keine monetären Einsätze angeboten. Dadurch bleibt das Projekt klar als Schul-, Demo- und Lernprojekt abgegrenzt.

---

## 4. Projektendergebnis

Am Projektende liegt eine abnahmefähige Demo-Webanwendung mit folgender Dokumentation vor:

| Ergebnis | Messbare Eigenschaft |
|---|---|
| Mobile-first Weboberfläche | Bedienbar auf Smartphone-Breite ab ca. 390 px sowie auf Desktop-Bildschirmen |
| Benutzerzugang | Anmeldung nur für berechtigte Schul-E-Mail-Adressen möglich |
| Demo-Credit-System | Neue Nutzer:innen erhalten ein Startguthaben von 1000 Demo-Credits |
| Minispiele | Mindestens Roulette und Blackjack sind spielbar; Poker ist als vorbereiteter Prototyp bzw. Platzhalter vorhanden |
| Spielhistorie | Abgeschlossene Spielrunden werden mit Spieltyp, Einsatz, Ergebnis und Zeitpunkt nachvollziehbar gespeichert |
| Sicherheitsabgrenzung | Keine Echtgeldfunktion, keine Zahlungsfunktion, keine Auszahlung und keine monetären Einsätze |
| Qualitätssicherung | Anwendung kann lokal gestartet werden; vorhandene Tests und Builds laufen ohne bekannte kritische Fehler |
| Projektdokumentation | Projektauftrag, README und weitere technische Dokumentation sind im Repository abgelegt |

---

## 5. Projektziele

### 5.1 Hauptziel

Ziel des Projekts ist die Entwicklung einer funktionsfähigen Demo-Minigame-Plattform für HTL-Schüler:innen, bei der Nutzer:innen nach Anmeldung mit virtuellen Demo-Credits spielen und ihre Spielhistorie einsehen können.

### 5.2 Teilziele

| Nr. | Ziel | Messkriterium |
|---|---|---|
| Z1 | Nutzer:innen können sich mit einer berechtigten Schul-E-Mail-Adresse anmelden. | Anmeldung mit gültiger Adresse funktioniert; unberechtigte Adressen werden abgewiesen. |
| Z2 | Jede neue Nutzerin bzw. jeder neue Nutzer erhält ein Demo-Startguthaben. | Startguthaben beträgt 1000 Credits. |
| Z3 | Roulette ist als Demo-Spiel verfügbar. | Eine Spielrunde kann gestartet, abgeschlossen und im Verlauf gespeichert werden. |
| Z4 | Blackjack ist als Demo-Spiel verfügbar. | Nutzer:innen können typische Aktionen wie Karte ziehen oder stehen bleiben ausführen. |
| Z5 | Poker ist vorbereitet. | Es gibt eine sichtbare, abgegrenzte Poker-Funktion als Prototyp oder Platzhalter. |
| Z6 | Spielausgänge sind nachvollziehbar. | Ergebnisse werden nicht nur in der Oberfläche angezeigt, sondern auch in der Spielhistorie gespeichert. |
| Z7 | Die Oberfläche ist für mobile Nutzung optimiert. | Kernfunktionen sind auf Smartphone-Größe ohne horizontales Scrollen bedienbar. |
| Z8 | Die Anwendung ist vorführbar. | Projekt kann lokal oder in einer Demo-Umgebung gestartet und präsentiert werden. |

### 5.3 Nicht-Projektziele / Abgrenzung

Nicht Bestandteil dieses Projekts sind:

- Echtgeld-Glücksspiel
- Zahlungen, Einzahlungen oder Auszahlungen
- Monetäre Wetten oder finanzielle Gewinne
- Veröffentlichung als öffentliches Casino- oder Wettprodukt
- Rechtliche Zertifizierung für Glücksspielbetrieb
- Vollständige Umsetzung aller Poker-Regeln auf Produktionsniveau
- Native Apps für App Store oder Play Store
- Langfristiger Produktivbetrieb mit echtem Kundensupport

---

## 6. Projektbeschreibung

HTLBets wird als Demo-Webplattform umgesetzt. Nutzer:innen melden sich mit einer berechtigten Schul-E-Mail-Adresse an und erhalten ein virtuelles Guthaben. Mit diesem Guthaben können sie in einer mobilen Oberfläche Minispiele starten. Nach jeder abgeschlossenen Runde wird das Ergebnis angezeigt und in einer Historie gespeichert.

Der Schwerpunkt liegt auf einem klar abgegrenzten, vorführbaren Schulprojekt. Die Anwendung soll verständlich bedienbar sein, grundlegende Spiellogik demonstrieren und eine saubere Trennung zwischen Demo-Credits und echtem Geld einhalten.

Die Projektarbeit umfasst:

1. Planung der Anforderungen und Projektabgrenzung
2. Entwurf einer einfachen Benutzerführung
3. Umsetzung der Anmeldung und Nutzerverwaltung
4. Umsetzung des Demo-Guthabens
5. Umsetzung der Minispiele und Spielhistorie
6. Test, Fehlerbehebung und Dokumentation
7. Abnahme und Präsentation

Technische Implementierungsdetails werden nicht in diesem Projektauftrag festgelegt, sondern in den nachfolgenden technischen Dokumenten bzw. im Pflichtenheft beschrieben.

---

## 7. Projektphasen / Meilensteine

| Phase | Ergebnis | Soll-Termin | Freigabe durch |
|---|---|---:|---|
| 1. Projektstart | Projektauftrag erstellt und abgestimmt | 28.04.2026 | Auftraggeber / Lehrperson |
| 2. Anforderungsanalyse | Funktionsumfang, Nicht-Ziele und Akzeptanzkriterien festgelegt | 05.05.2026 | Projektleitung |
| 3. UI- und Ablaufkonzept | Mobile-first Bedienkonzept für Anmeldung, Spiele und Verlauf | 12.05.2026 | Projektteam |
| 4. Grundfunktionen | Anmeldung, Nutzerstatus und Demo-Guthaben funktionieren | 19.05.2026 | Projektleitung |
| 5. Spielfunktionen | Roulette und Blackjack spielbar; Poker vorbereitet | 02.06.2026 | Projektteam |
| 6. Verlauf und Qualität | Spielhistorie, Tests und Fehlerbehebung abgeschlossen | 16.06.2026 | Projektleitung |
| 7. Abnahmeversion | Demo-Version ist vorführbar und dokumentiert | 23.06.2026 | Auftraggeber / Lehrperson |
| 8. Projektabschluss | Präsentation, Reflexion und finale Abgabe | 30.06.2026 | Auftraggeber / Lehrperson |

---

## 8. Projektstart / Projektende

| Punkt | Beschreibung |
|---|---|
| Offizieller Projektstart | 28.04.2026, nach Freigabe bzw. Unterzeichnung dieses Projektauftrags |
| Auslösendes Ereignis | Auftrag zur Erstellung einer Demo-Minigame-Plattform im Rahmen des Unterrichts |
| Geplantes Projektende | 30.06.2026 |
| Abschlussereignis | Abnahme der Demo-Version, Abgabe der Dokumentation und Präsentation des Projekts |

> Hinweis: Falls die Schule andere Termine vorgibt, sind die Datumsangaben vor der Abgabe anzupassen.

---

## 9. Projektressourcen

### 9.1 Personal

| Rolle | Aufgaben |
|---|---|
| Projektleitung | Planung, Koordination, Terminüberwachung, Kommunikation mit Auftraggeber |
| Frontend-Verantwortliche:r | Benutzeroberfläche, mobile-first Layout, Bedienbarkeit |
| Backend-/Logik-Verantwortliche:r | Nutzerverwaltung, Spielabläufe, Demo-Credit-System |
| Qualitätssicherung | Tests, Fehlerdokumentation, Abnahmekriterien |
| Dokumentation | README, Projektauftrag, Präsentationsunterlagen |

### 9.2 Infrastruktur und Material

| Ressource | Beschreibung |
|---|---|
| Entwicklungsgeräte | Schul- oder Privatgeräte der Teammitglieder |
| Versionsverwaltung | Git-Repository für Quellcode und Dokumentation |
| Testgeräte | Mindestens ein Smartphone-Browser und ein Desktop-Browser |
| Entwicklungsumgebung | Lokale Entwicklungsumgebung der Teammitglieder |
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
| Unklare Abgrenzung zu echtem Glücksspiel | Missverständnisse über Zweck und rechtliche Einordnung | Mittel | Klare Dokumentation: nur Demo-Credits, kein Echtgeld, keine Zahlungen |
| Funktionsumfang wird zu groß | Terminverzug und unfertige Kernfunktionen | Mittel | Fokus auf Pflichtfunktionen; Poker nur als Prototyp/Platzhalter |
| Anmeldung oder E-Mail-Prüfung funktioniert nicht zuverlässig | Nutzer:innen können Demo nicht verwenden | Mittel | Früh testen und Alternativ-Testzugänge für Präsentation vorbereiten |
| Mobile Darstellung ist unübersichtlich | Schlechte Bedienbarkeit bei der Abnahme | Mittel | Mobile-first Design laufend auf Smartphone-Breite testen |
| Spielhistorie speichert Ergebnisse fehlerhaft | Ergebnisse nicht nachvollziehbar | Niedrig bis mittel | Testfälle für Spielrunden und Verlaufsanzeige erstellen |
| Zeitmangel kurz vor Abgabe | Qualitätsverlust und fehlende Dokumentation | Mittel | Meilensteine einhalten, Dokumentation parallel zur Umsetzung pflegen |
| Sicherheitslücken oder Manipulation von Demo-Credits | Demo-Ergebnisse sind nicht vertrauenswürdig | Mittel | Kritische Spiel- und Guthabenlogik nicht nur in der Oberfläche behandeln |
| Teammitglied fällt aus | Aufgaben bleiben liegen | Niedrig bis mittel | Aufgaben dokumentieren und Wissen im Team verteilen |

---

## 11. Projektorganisation

| Bereich | Zuständigkeit |
|---|---|
| Auftraggeber | HTL / betreuende Lehrperson |
| Projektleitung | `[Name eintragen]` |
| Entwicklung | Projektteam HTLBets |
| Qualitätssicherung | `[Name eintragen]` |
| Dokumentation | `[Name eintragen]` |
| Abnahme | Auftraggeber / Lehrperson |

### Kommunikationsregeln

- Projektfortschritt wird regelmäßig im Team abgestimmt.
- Offene Punkte werden schriftlich im Repository, in Issues oder in einer gemeinsamen Aufgabenliste festgehalten.
- Änderungen am Projektumfang müssen mit der Projektleitung und dem Auftraggeber abgestimmt werden.
- Vor der Abgabe wird geprüft, ob alle Muss-Ziele erfüllt und alle Nicht-Ziele eingehalten wurden.

---

## 12. Abnahmekriterien

Das Projekt gilt als erfolgreich abgeschlossen, wenn folgende Kriterien erfüllt sind:

- Die Demo-Anwendung kann gestartet und vorgeführt werden.
- Eine berechtigte Nutzerin bzw. ein berechtigter Nutzer kann sich anmelden.
- Das Demo-Guthaben wird angezeigt und verändert sich nach Spielrunden nachvollziehbar.
- Mindestens Roulette und Blackjack sind in einer Demo-Version spielbar.
- Eine Spielhistorie zeigt abgeschlossene Spielrunden.
- Die Oberfläche ist auf Smartphone-Größe bedienbar.
- Es gibt keine Funktionen für Echtgeld, Zahlungen, Auszahlungen oder monetäre Wetten.
- Die Dokumentation ist im Repository abgelegt.
- Auftraggeber bzw. Lehrperson nehmen die Demo-Version ab.

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
