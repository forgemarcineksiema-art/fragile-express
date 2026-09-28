# Fragile Express — dokument projektowy

Sep 28, 2026 · @Marcin

## Koncepcja i hook

Fragile Express to tycoon w stylu Monkey Mart: prowadzisz sortownię paczek, nosisz je w stosie z taśmy na regały i do vanów, a potem automatyzujesz wszystko pracownikami i maszynami.

- **Hook:** kruche paczki płacą trzy razy więcej, ale pękają, gdy niesiesz ich więcej niż trzy albo biegniesz. Ta sama zabawa ryzykiem co w Fragile Van, tylko w innym gatunku.
- **Luka na Poki:** kategorie tycoon i idle są pełne gier z jedzeniem, sklepów, kopalni i farm, ale nie ma w nich sortowni ani firmy kurierskiej. Na telefonach ten motyw ma kilka sprawdzonych gier, więc pętla jest znana, a temat na Poki świeży ([Idle](https://poki.com/en/idle), [Tycoon](https://poki.com/en/tycoon)).
- **Wspólna marka:** ten sam van, te same paczki i ta sama nazwa "Fragile" co w pierwszej grze. Gracze szukający marki w Google to ruch, z którego zarobek w całości zostaje u nas ([Deal Types](https://sdk.poki.com/deals)).
- **Odbiorca:** 8–16 lat i casualowi dorośli. Satysfakcja z rosnących stosów paczek, wypełniających się regałów i odjeżdżających vanów.
- **Rola w portfolio:** główna gra na pieniądze. Najdłuższe sesje, najwięcej naturalnych miejsc na rewarded, gracze wracają do zapisanego magazynu.

## Pętla rozgrywki i sterowanie

Wszystko dzieje się przez chodzenie: wejście w strefę stacji samo przenosi paczki albo pieniądze, bez klikania. To ta sama zasada co w Monkey Mart, więc gracz rozumie ją w kilka sekund.

1. **Rozładunek:** ciężarówka zrzuca paczki na taśmę. Każda paczka ma kolor dzielnicy, do której jedzie.
2. **Zbieranie:** gracz podchodzi do końca taśmy i paczki same wskakują mu na stos, do limitu udźwigu (na start 6).
3. **Sortowanie:** przy regale w danym kolorze paczki tego koloru same schodzą ze stosu.
4. **Załadunek:** z regału gracz niesie paczki do vana swojej dzielnicy. Pełny van odjeżdża i zostawia na podłodze stos monet.
5. **Zbieranie pieniędzy:** przejście przez stos monet.
6. **Rozbudowa:** stanie na polu z ceną powoli pobiera monety, aż stacja, pracownik albo ulepszenie się odblokuje.

**Kruche paczki (od 3. minuty gry):**

- Mają ikonę szkła i płacą trzy razy więcej.
- Stos z kruchą paczką zaczyna się chwiać, gdy ma więcej niż 3 sztuki albo gdy gracz biegnie dłużej niż 2 sekundy. Pasek chybotania nad głową ostrzega zawczasu.
- Pełny pasek to pęknięcie górnej kruchej paczki: dźwięk szkła, odłamki, zero wypłaty za nią.

**Sterowanie:**

- **Desktop:** WASD lub strzałki to bieg. Przytrzymany Shift to ostrożny chód, bez chybotania.
- **Mobile:** wirtualny joystick w dowolnym miejscu ekranu. Małe wychylenie to chód, pełne to bieg.
- Esc lub spacja: pauza.

**Kamera:** widok z góry pod lekkim kątem, śledzi gracza. Przy odblokowaniu nowej strefy na chwilę pokazuje, co się pojawiło.

## Stacje, pracownicy, progresja i ekonomia

MVP ma trzy lokacje, każda na około 20 minut gry. Po zamknięciu lokacji gracz przenosi się do większej, z wyższymi stawkami za paczkę.

| Lokacja | Dzielnice | Mnożnik stawki | Nowy element |
| --- | --- | --- | --- |
| Poczta osiedlowa | 2 | ×1 | Kruche paczki |
| Sortownia miejska | 4 | ×4 | Paczki ekspresowe z licznikiem czasu, premia +50% |
| Hub regionalny | 6 | ×15 | Paczki XXL: gracz niesie tylko jedną naraz |

**Ulepszenia w każdej lokacji:**

- **Gracz:** udźwig (od 6 do 20 paczek), szybkość, stabilność stosu z kruchymi paczkami.
- **Pracownicy:** sortowacz (taśma na regał), ładowacz (regał do vana), zbieracz monet. Każdy ma własne ulepszenia udźwigu i szybkości.
- **Stacje:** nowe regały i dzielnice, szybsza taśma, drugi van na dzielnicę, większa pojemność vana (od 8 do 20).

**Ekonomia (wartości startowe):**

```latex
W = 5 \cdot M_{lok} \cdot (3 \text{ dla kruchej}) \qquad C_k = C_0 \cdot 1{,}35^{k}
```

W to wypłata za paczkę, a C to koszt k-tego poziomu danego ulepszenia. Koszty bazowe C₀ w pierwszej lokacji: udźwig 30, szybkość 40, nowa dzielnica 100, pracownik 150.

**Cele tempa (sprawdzane symulatorem):** pierwsza nowa dzielnica po około 90 s, pierwszy pracownik po około 3 min, pełna automatyzacja pierwszej lokacji po około 12 min, przejście do drugiej po około 20 min.

**Zarobek offline:** gdy wszystkie ogniwa lokacji mają pracowników, po powrocie gracz dostaje zarobek za czas nieobecności: połowa stawki automatów, maksymalnie 2 godziny. To główny powód do codziennych powrotów.

## Monetyzacja

Gra toczy się bez przerw, więc reklamy opieramy głównie na rewarded w strefach na podłodze, które gracz sam wybiera. commercialBreak dajemy tylko tam, gdzie gracz wraca do gry z ekranu.

**commercialBreak** przy powrocie do gry: zamknięcie pauzy, "Odbierz" na ekranie zarobku offline, "Kontynuuj" po przejściu do nowej lokacji. Nigdy przy otwieraniu ekranów. Pierwsze 5 minut bez reklam.

**rewardedBreak:**

| Miejsce | Nagroda | Rozmiar | Zwykła alternatywa |
| --- | --- | --- | --- |
| Ekran powrotu | Zarobek offline ×2 | medium | Odbierz (zielony) |
| Pole ulepszenia, za mało monet | Ulepszenie od razu, gdy brakuje najwyżej połowy ceny | medium | Gracz odchodzi z pola |
| Pole "Turbo" pojawiające się co około 3 min | Podwójne wypłaty przez 3 min | medium | Gracz odchodzi z pola |
| Pole "Pomocnik" | Dodatkowy pracownik na 3 min | small | Gracz odchodzi z pola |
| Nowa lokacja | Podwójne monety na start | large | Kontynuuj (zielony) |

**Zasady Poki jak w pozostałych grach:** na ekranach wyboru zwykły przycisk jest zielony, nie mniejszy i widoczny jednocześnie. Przycisk i pole z reklamą mają ikonę 🎬 i nie są zielone. Pole z reklamą pokazuje przed wejściem, co da, a reklama rusza dopiero po 1 s stania w nim. Nagroda działa od razu i tylko po udanym obejrzeniu. W trakcie reklamy gra jest zatrzymana, dźwięk wyciszony, a sterowanie zablokowane.

## Cele metryk Poki

To gra o zarządzaniu, więc mierzymy ją według poprzeczki Poki dla tego gatunku: ponad 10 minut średniego czasu gry.

| Metryka | Próg Poki | Nasz cel | Główna dźwignia |
| --- | --- | --- | --- |
| Średni czas gry (Player Fit) | > 3 min | 12+ min | Tempo odblokowań, kruche paczki, kolejne lokacje |
| Sesje powyżej 3 min | ≥ 25% | ≥ 55% | Pierwszy zakup w ciągu 30 s, pierwszy pracownik po 3 min |
| Konwersja do gry (Web Fit) | zalecane 65%+ | 75%+ | Gracz stoi przy taśmie od razu, bez menu |
| Rozmiar startowy | < 8 MB | < 4 MB | Postacie, paczki i magazyn rysowane kodem |
| Reklamy na DAU (soft release) | ≥ 1 | 2+ | Zarobek offline ×2, pola Turbo i ulepszeń |

**Najważniejsze w nagraniach playtestów:** czy gracz sam odkrywa, że chodzenie przenosi paczki, i czy kruche paczki bawią, czy frustrują. Jeśli frustrują, podnosimy limit stosu z 3 do 4, zanim zmienimy cokolwiek innego.

Źródła: [How testing works](https://developers.poki.com/guide/how-testing-works), [Release Process](https://sdk.poki.com/releaseprocess).

## Technologia i architektura

Stos jak w pozostałych grach: TypeScript, Vite, PixiJS v8 i poki-kit. Z Fragile Van bierzemy dodatkowo kod rysujący vana i paczki, żeby marka wyglądała spójnie.

**Kluczowa decyzja:** symulacja magazynu to czysty moduł TypeScript ze stałym krokiem, niezależny od renderu. Ten sam moduł napędza trzy rzeczy: grę, bezgłowy symulator tempa oraz wyliczenie zarobku offline z przepustowości automatów.

**Struktura kodu**

- `src/sim` — `Warehouse`, `Station` (taśma, regał, rampa vana, pole zakupu), `Carrier` (wspólny dla gracza i pracowników: stos, udźwig, chybotanie), `Worker` (automat stanów: idź po paczki, weź, idź do celu, odłóż), `Economy`, `Offline`.
- `src/game` — render z góry z sortowaniem po osi Y, stos paczek z animacją chybotania, joystick, kamera, efekty monet i odłamków.
- `src/ui` — HUD z monetami, pauza, ekran powrotu z zarobkiem offline, przejście między lokacjami.
- `locations/*.json` — układ lokacji: strefy, stacje, pola zakupu w kolejności odblokowań, ceny bazowe.
- `tools/pacing-sim` — skrypt Node, w którym prosty bot gra zachłannie (kupuje najtańsze dostępne ulepszenie) i wypisuje czas do każdego kamienia milowego z sekcji o ekonomii.

**Ruch pracowników:** układ lokacji jest otwarty, więc wystarczy graf punktów drogi zdefiniowany w JSON-ie zamiast pełnego wyszukiwania ścieżek.

**Zapis postępu:** lokacja, odblokowane stacje, poziomy ulepszeń, pracownicy, monety, znacznik czasu dla zarobku offline, ustawienia. Zapis co 10 s i przy każdym zakupie, w try/catch, z wersją schematu.

**Języki:** słownik od pierwszego dnia. Interfejs opiera się na ikonach i liczbach, więc tekstu jest bardzo mało.

## Zakres MVP i harmonogram

Pierwszą lokację (Poczta osiedlowa) wysyłamy do playtestów około 12. dnia. Dwie kolejne dobudowujemy w trakcie testów, bo Player Fit mierzy głównie pierwsze minuty gry.

1. **Dni 1–3:** poki-kit i kod vana z Fragile Van, `src/sim` z taśmą, regałami, rampą vana i polami zakupu, gracz ze stosem i joystickiem.
2. **Dni 4–7:** pracownicy (automat stanów, graf punktów drogi), ekonomia, symulator tempa i pierwsze strojenie do celów tempa.
3. **Dni 8–12:** kruche paczki z chybotaniem, pełna Poczta osiedlowa, zapis, zarobek offline, SDK, dźwięki. Upload, 10 nagrań z playtestów, pierwszy Player Fit.
4. **Dni 13–20:** poprawki z nagrań (najpierw pierwsze 3 minuty), Sortownia miejska z paczkami ekspresowymi, Hub regionalny z paczkami XXL, rewarded.
5. **Dni 21–24:** miniatura statyczna i animowana (van i chwiejący się stos kruchych paczek), tłumaczenia, rozmiar, drugi Player Fit, zgłoszenie do Web Fit.

**Poza MVP:** port lotniczy cargo z dronami jako czwarta lokacja, sezonowe paczki (święta, Halloween), skórki postaci.

**Czego nie robimy w MVP:** trybu wieloosobowego, prestiżu z trwałymi bonusami, trójwymiarowej grafiki.

## Prompt startowy dla Claude Code

Przed startem wyeksportuj ten dokument do `docs/DESIGN.md` i podaj ścieżkę do repozytorium Fragile Van (poki-kit oraz kod vana i paczek). Prompt obejmuje etap 1: rdzeń magazynu i gracza.

```markdown
Budujesz przeglądarkową grę "Fragile Express" (tycoon sortowni paczek w stylu Monkey Mart) na platformę Poki.com. To druga gra w świecie "Fragile" po Fragile Van. Jesteś jedynym programistą, ja jestem projektantem i testuję buildy.

## Źródło prawdy
Pełny dokument projektowy jest w `docs/DESIGN.md`. Przeczytaj go w całości przed pierwszą linijką kodu. Jeśli czegoś brakuje albo coś jest sprzeczne, zapytaj zamiast zgadywać.

## Gra w skrócie
- Widok z góry. Gracz chodzi po magazynie; wejście w strefę stacji samo przenosi paczki lub monety, bez klikania.
- Taśma rozładunkowa wypuszcza paczki w kolorach dzielnic. Gracz zbiera je w stos (udźwig na start 6), odkłada na regał swojego koloru, potem niesie do vana tej dzielnicy. Pełny van odjeżdża i zostawia stos monet.
- Stanie na polu z ceną powoli pobiera monety i odblokowuje stację, pracownika lub ulepszenie.
- Kruche paczki: płacą ×3; stos z kruchą paczką chybocze, gdy ma ponad 3 sztuki albo gracz biegnie dłużej niż 2 s. Pełny pasek chybotania = pęka górna krucha paczka.
- Pracownicy (sortowacz, ładowacz, zbieracz monet) to ten sam `Carrier` co gracz, sterowany automatem stanów.
- Wypłata: 5 × mnożnik lokacji (×3 dla kruchej). Koszt k-tego poziomu ulepszenia: C₀ × 1,35^k. Wartości startowe do strojenia.
- Sterowanie: WASD/strzałki = bieg, Shift = ostrożny chód; na dotyku joystick w dowolnym miejscu (małe wychylenie chód, pełne bieg). Esc lub spacja = pauza.

## Stos (nie zmieniaj bez pytania)
TypeScript strict, Vite, PixiJS v8, Vitest. Zero zapytań sieciowych poza skryptem Poki SDK. Postacie, paczki i magazyn rysowane kodem. Cel: build poniżej 4 MB.

## Wspólny kod
Z repozytorium Fragile Van (ścieżkę podam) skopiuj `src/core`, `src/poki` oraz kod rysujący vana i paczki. Nie zmieniaj API poki-kit. Jeśli czegoś brakuje, dopisz to tak, żeby dało się przenieść z powrotem.

## Twarde wymagania Poki
- Obszar gry 16:9 (bazowo 1031×580) na desktopie; na telefonie pełny ekran w poziomie i w pionie.
- `PokiSDK.init()` (gra startuje także przy błędzie), `gameLoadingFinished()` po załadowaniu.
- `gameplayStart()` przy pierwszym ruchu gracza, `gameplayStop()` przy pauzie i ekranach. Nigdy dwa takie same z rzędu, żadnych zdarzeń w trakcie reklamy.
- `commercialBreak()` tylko przy powrocie do gry z ekranu (pauza, zarobek offline, nowa lokacja), przed `gameplayStart()`. Pierwsze 5 minut bez reklam. Bez własnych liczników.
- `rewardedBreak({ size })`: nagroda tylko przy `success === true`. Na ekranach wyboru zwykły przycisk zielony, nie mniejszy, widoczny jednocześnie; przycisk i pole z reklamą z ikoną 🎬, nie zielone. Pole z reklamą startuje po 1 s stania w nim.
- W trakcie reklamy gra zatrzymana, dźwięk wyciszony, sterowanie zablokowane. localStorage w try/catch. Blokada przewijania strony.
- Żadnych linków zewnętrznych, ekranów powitalnych, obcych reklam ani zakupów.

## Architektura
- `src/sim`: czysty TypeScript, stały krok, zero zależności od renderu (`Warehouse`, `Station`, `Carrier`, `Worker`, `Economy`, `Offline`). Emituje zdarzenia do renderu.
- `src/game`: render z sortowaniem po Y, stos z chybotaniem, joystick, kamera, efekty.
- `src/ui`: HUD, pauza, ekran powrotu, przejście lokacji.
- `locations/*.json`: strefy, stacje, pola zakupu w kolejności odblokowań, graf punktów drogi, ceny bazowe.
- `tools/pacing-sim`: skrypt Node z botem kupującym zachłannie najtańsze ulepszenie.

## Zadanie teraz: etap 1
1. Zainicjuj projekt i skopiuj wspólny kod.
2. `src/sim` z testami: taśma, stos z limitem udźwigu, regały po kolorach, van z pojemnością i odjazdem, stos monet, pola zakupu pobierające monety w czasie.
3. Gracz z joystickiem i klawiaturą, kamera, render lokacji "Poczta osiedlowa" z 2 dzielnicami z pliku JSON.
4. Jeden typ pracownika (sortowacz) na automacie stanów po grafie punktów drogi.
5. `tools/pacing-sim`: wypisuje czas do pierwszej nowej dzielnicy, pierwszego pracownika i pełnej automatyzacji. Porównaj z celami tempa z dokumentu (90 s, 3 min, 12 min) i zaproponuj poprawki cen.

## Definicja ukończenia etapu 1
- Testy symulacji przechodzą, symulator tempa daje czytelny raport.
- Pętla taśma → regał → van → monety → zakup działa na desktopie i na telefonie, 60 FPS przy 4-krotnym spowolnieniu CPU w Chrome.
- Krótki raport: co działa, wyniki symulatora, plan na etap 2. Nie zaczynaj etapu 2 bez mojej zgody.

## Sposób pracy
Najpierw plan w punktach, potem kod. Małe commity. Kod i komentarze po angielsku, teksty tylko przez słownik i18n. Jeśli coś w projekcie wydaje ci się złe dla gracza, powiedz to wprost.
```
