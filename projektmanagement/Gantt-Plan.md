# Gantt-Plan: HTLBets

**Stand:** 22.05.2026  
**Projektzeitraum:** 28.04.2026 bis 30.06.2026

## Übersicht

Der folgende Plan basiert auf dem aktuellen Projektauftrag und bildet die vorgesehenen Phasen, Meilensteine und Abgabetermine für **HTLBets** ab.

```mermaid
gantt
    title HTLBets Projektplan
    dateFormat  YYYY-MM-DD
    axisFormat  %d.%m.

    section Planung
    Projektauftrag und Scope            :done, p1, 2026-04-28, 2026-05-05
    Analyse und Aufwandsschätzung       :done, p2, 2026-05-01, 2026-05-05

    section Architektur
    Grundarchitektur und Setup          :active, a1, 2026-05-06, 2026-05-09
    Auth, Datenmodell, Basis-API        :active, a2, 2026-05-07, 2026-05-12

    section Spiele
    Roulette, Blackjack, Poker          :g1, 2026-05-10, 2026-05-20
    Miner, Crash, Slots                 :g2, 2026-05-18, 2026-05-27
    Ochko und Mafia                     :g3, 2026-05-20, 2026-06-02

    section Plattform
    Profil, Rewards, Historie           :s1, 2026-05-19, 2026-06-01
    Leaderboard und Card-Deck-System    :s2, 2026-05-22, 2026-06-03

    section Administration
    Admin-Dashboard und User-Tools      :ad1, 2026-05-28, 2026-06-08
    Moderation, Decks und Game-Katalog  :ad2, 2026-06-03, 2026-06-10

    section Abschluss
    QA, Doku, Feinschliff               :q1, 2026-06-11, 2026-06-20
    Präsentation und Abgabe             :milestone, m1, 2026-06-30, 1d
```

## Meilensteine

| Meilenstein | Termin | Inhalt |
|---|---|---|
| Projektauftrag abgestimmt | 28.04.2026 | Projektstart und formeller Auftrag |
| Analyse und Planung abgeschlossen | 05.05.2026 | Anforderungen, Risiken, Aufwand |
| Grundarchitektur steht | 09.05.2026 | Frontend, Backend, DB, Auth-Basis |
| Kernspiele integriert | 20.05.2026 | Roulette, Blackjack, Poker |
| Erweiterte Spiele integriert | 27.05.2026 | Miner, Crash, Slots |
| Weitere Mehrspieler-Spiele integriert | 02.06.2026 | Ochko und Mafia |
| Zusatzfunktionen fertig | 03.06.2026 | Profil, Rewards, Historie, Decks |
| Admin-Funktionen fertig | 10.06.2026 | Suche, Balance, Decks, Moderation |
| Spielkatalog steuerbar | 10.06.2026 | Spiele aktivieren / deaktivieren |
| Abnahmeversion bereit | 20.06.2026 | Vorführbare Gesamtversion |
| Projektabschluss | 30.06.2026 | Präsentation und finale Abgabe |

## Hinweise

- Die Detailtermine können je nach Unterrichtsfortschritt leicht angepasst werden.
- Die Phasen überschneiden sich bewusst, weil Dokumentation, Entwicklung und QA parallel laufen.
- Der Plan berücksichtigt den erweiterten Scope mit Ochko, Mafia und steuerbarer Spiel-Verfügbarkeit.
- Für die finale Abgabe sollten `README`, Projektunterlagen und Build-Status gemeinsam geprüft werden.
