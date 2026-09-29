# Research: najlepsze praktyki w grach idle arcade (web i mobile)

Wrzesień 2026. Cztery równoległe przeglądy (ok. 350 wyszukiwań i pobranych stron): design gatunku,
wymagania Poki i technika webowa, monetyzacja i retencja na mobile, UX i skargi graczy. Źródła
pierwotne tam, gdzie się dało (dokumentacja Poki i CrazyGames, blogi wydawców), do tego rozbiory gier
robione przez osoby trzecie (arpubrothers, Azur Games, Udonis, Gamigion) i recenzje ze sklepów (przez
agregatory, więc liczby są przybliżone). Wnioski własne są oznaczone jako takie.

## Najważniejsze liczby

| Co | Wartość | Źródło |
|---|---|---|
| Poki, test na 500 graczach | średnio ≥ 3 min gry i ≥ 25% sesji dłuższych niż 3 min | developers.poki.com/guide/player-fit-test |
| Poki, cel | ≥ 65% wejść kończy się grą; ≥ 10 min dla gier zarządzania (średnia Poki: 70% i 6 min) | developers.poki.com/guide/how-testing-works |
| Poki, udane gry | sesje 11–20 min | pocketgamer.biz (wywiad z COO Poki) |
| Czas ładowania | Stickman Hook: 29,5 s → 3,7 s podniosło konwersję z 50% do 72%; każdy MB to kilka % graczy mniej | poki.com/blog/what-makes-high-quality-browser-game |
| Top-20 idle arcade (mobile) | D1 48–52%, D7 7–13%, ok. 25 min gry pierwszego dnia | Sensor Tower i Homa (gamedevreports) |
| Monkey Mart (web) | pierwszy sklep 20–25 min, gracz ma „wsiąknąć” w 5–10 min; łagodniejsza krzywa niż na mobile | defold.com/2023/03/22/Monkey-Mart-is-bananas |
| My Perfect Hotel, 1. sesja | zatrudnianie 1:46, pierwszy sprzątacz 4:20, automatyczna recepcja 9:26, poziom hotelu ok. 12:00 | arpubrothers.com |

Nasze tempo z symulatora (pierwsza dzielnica 1:15, pierwszy pracownik 3:00, automatyzacja ok. 9 min,
następna lokacja ok. 20 min) mieści się w widełkach gatunku. Paczka ok. 800 KB (160 KB gzip JS) jest
wzorcowa pod względem ładowania.

## Co już robimy zgodnie z praktyką (sprawdzone w kodzie)

- Brak ekranu tytułowego, gracz od razu gra; samouczek wizualny (strzałka) zamiast ścian tekstu.
- `gameplayStart` przy pierwszym ruchu, `gameplayStop` na pauzie i ekranach; pauza pod Esc, Spacją i P;
  klawisze po `KeyboardEvent.code` (działa na AZERTY); strzałki i spacja nie przewijają strony.
- Nagradzane reklamy jako pola w świecie (turbo ×2, pomocnik) i ×2 zarobków offline; przyciski nie są
  zielone, mają 🎬, zwykła opcja jest tak samo duża.
- Pływający joystick z martwą strefą i bazą idącą za palcem; lekkie wychylenie = ostrożny chód.
- Kamera pokazuje nowo odblokowane pola; przy wysokim stosie oddala się, żeby było go widać w całości.
- Dzielnice mają kolor i symbol (daltoniści); zapis w `localStorage` w try/catch, zapis przy ukryciu karty
  i `pagehide`; zarobki offline z limitem 2 h.
- Kruche paczki pojawiają się dopiero po 3 minutach, gdy podstawowa pętla jest opanowana.
- Pion na telefonach działa, napisy są powiększone, róg z przyciskiem Poki jest wolny.
- 11 języków (EFIGS, turecki, rosyjski, portugalski, polski, niderlandzki); miniatury 1080×1080 bez tekstu,
  animowana 5 s w 60 kl./s; stały krok symulacji (działa tak samo przy 144 Hz).

## Naprawione od razu (niezgodności z Poki i ryzyka techniczne)

- **Własny licznik reklam** („nie w pierwszych 5 minutach”) usunięty: Poki sam decyduje o częstotliwości;
  przerwa reklamowa nie jest też wywoływana przy starcie gry (okno zarobków offline).
- **Komunikat „reklama niedostępna”** usunięty: Poki wymaga, żeby przy nieudanej reklamie nie było ani
  nagrody, ani komunikatu.
- **Utrata kontekstu WebGL** (częsta na telefonach przy przełączaniu aplikacji): atlas tekstur żył tylko na
  GPU i po odzyskaniu kontekstu postacie i paczki znikały. Teraz ma kopię na canvasie i wraca
  (sprawdzone przez `WEBGL_lose_context`).
- **Dźwięk na iOS**: odblokowanie także na `pointerup`/`touchend`/`keydown` (na dotyku `pointerdown` nie
  jest gestem użytkownika) i wznawianie ze stanu „interrupted”.
- **Ostrożny chód bez trzymania klawisza**: przełącznik C obok Shift (zalecenie dostępności; trzymanie
  klawisza męczy).
- Drobny losowy rozrzut wysokości powtarzanych dźwięków (mniej męczy ucho).

## Rekomendacje dla Fragile Express

### P1: największy wpływ na czas gry i powroty

1. **Praca, która zostaje graczowi po automatyzacji.** W hitach gracz ma zawsze coś „swojego”: goście VIP
   (My Perfect Hotel), roboty do ładowania co 3 min (Pizza Ready), budzenie pracowników (Monkey Mart). U nas
   pracownicy robią wszystko, łącznie z kruchymi paczkami, więc między automatyzacją (ok. 9 min) a
   przeprowadzką (ok. 20 min) gra robi się pasywna. Propozycja: kruche ×3 i ekspresowe zostają graczowi
   (pracownicy je omijają), co wzmacnia nasz wyróżnik. Wymaga przestrojenia tempa w symulatorze.
2. **Pasek postępu lokacji** („Poczta 9/14”) i świętowanie każdego etapu. Burger Please dodał paski
   postępu (razem z innymi zmianami D1 wzrosło z 44% do 50%); gracze chcą widzieć, ile brakuje do celu.
3. **Stały „następny cel” po samouczku i podpowiedzi wąskich gardeł** („Vany czekają: zatrudnij
   ładowacza”, „Regał pełny”). Kolibri podniósł retencję kontekstowymi podpowiedziami wskazującymi wąskie
   gardło. Mamy tylko strzałkę do stać-nas-na-to kamieni milowych.
4. **Nagradzane reklamy w momencie potrzeby.** Najczęściej oglądana w My Perfect Hotel jest paczka
   gotówki leżąca w świecie. Propozycje: „paczka gotówki”, gdy gracz stoi na polu, na które go nie stać;
   „folia bąbelkowa” (3 min bez chybotania kruchych paczek, gra naszym wyróżnikiem); powrót pola po
   60–120 s. Poki zaleca oferować nagrodę wtedy, gdy jest potrzebna, i pilnować balansu.
5. **Więcej naturalnych pauz na przerwy reklamowe.** Poki na miękkim starcie oczekuje co najmniej jednej
   reklamy na aktywnego gracza dziennie; u nas przerwa zdarza się głównie przy przeprowadzce. Naturalne
   miejsce: krótki ekran podsumowania po ukończeniu etapu lokacji (z punktu 2) z przyciskiem „Dalej”.

### P2: głębia i powody do powrotu

6. **3 zadania dzienne i 7-dniowy kalendarz** liczący dni obecności (bez zerowania serii), nagroda dnia 7
   duża, podwajana reklamą (Supersonic, My Perfect Hotel). Zadania oparte na naszym wyróżniku: „dowieź 10
   kruchych bez stłuczki”, „5 ekspresów na czas”.
7. **Kosmetyki**: czapki i kamizelki kuriera, malowanie vanów; za kamienie milowe, dzień 7 kalendarza,
   reklamy (Monkey Mart ma 20+ czapek, Poki poleca kosmetyki jako cele).
8. **Więcej treści**: 5+ lokacji, każda z nowym typem przesyłek (chłodnia, gabaryty), lekki prestiż
   („gwiazdki franczyzy” jako mnożnik), okresowe wydarzenie. Poki promuje gry, które są aktualizowane.
9. **Ulepszenie „nocna zmiana”**: limit zarobków offline 2 → 4 → 8 h (limit jest powodem, żeby wracać).

### P3: szlif

10. Haptyka na Androidzie (10–20 ms przy zakupie i stłuczce, z przełącznikiem; iOS Safari tego nie obsługuje).
11. `prefers-reduced-motion`: wyłączenie wstrząsu kamery.
12. Opcja stałego joysticka (prośby w recenzjach Monkey Mart).
13. Słabe telefony: wyłączony antialias na mobile, test na tanim Androidzie i Chromebooku 4 GB, `BitmapText`
    dla często zmienianych liczników.
14. Opcjonalnie `PokiSDK.movePill()` zamiast przesuwania licznika monet; czcionki CJK przy rozszerzaniu
    języków.

## Czego unikać (najczęstsze skargi graczy)

- Częste reklamy pełnoekranowe (skarga numer jeden we wszystkich tytułach) i reklamy blokujące postęp.
- Nagłe ściany cenowe (np. skok z 5 tys. na 80 tys. w My Perfect Hotel).
- Pracownicy, którzy stoją z pełnymi rękami, blokują się albo wymagają ciągłego pilnowania.
- Wolny chód na starcie, małe udźwigi, długie trasy między stanowiskami.
- Utrata postępu i nieudane zapisy.
- Wymuszone ruchy kamery (My Perfect Hotel); nasze pokazy nowych pól trwają 2,4 s i blokują sterowanie
  tylko na 0,4 s, niech tak zostanie.
- Monotonia: każda lokacja jako ta sama pętla bez nowego elementu.

## Główne źródła

- Poki: developers.poki.com/guide/ (requirements-quality, sdk-overview, monetization, engagement,
  easy-access, how-testing-works, player-fit-test, web-fit-test, release-process, accounts, localization,
  game-thumbnail, your-game-page); poki.com/blog/building-web-browser-games-2026;
  poki.com/blog/what-makes-high-quality-browser-game
- CrazyGames: docs.crazygames.com (requirements/technical, requirements/ads, resources/basic-launch-metrics,
  resources/midgame-ads-pacing)
- Monkey Mart: defold.com/2023/03/22/Monkey-Mart-is-bananas/; poki.com/en/g/monkey-mart
- Rozbiory: arpubrothers.com/blog/burger-please-deconstruction-of-the-game/,
  arpubrothers.com/blog/my-perfect-hotel-arcade-idle-deconstruction/,
  pocketgamer.biz/under-the-hood-deconstructing-the-top-hypercasual-games/,
  gamigion.com/pizza-ready-by-supercent-comprehensive-breakdown/, blog.udonis.co (Burger Please, My Perfect Hotel)
- Wydawcy i benchmarki: supersonic.com/learn/blog/how-to-ideate-and-build-a-profitable-idle-arcade-game/,
  supersonic.com/learn/blog/getting-started-with-basic-hybrid-casual-liveops,
  gameanalytics.com/blog/making-a-hit-idle-game-eight-lessons-from-kolibri-games,
  gamedevreports.substack.com/p/sensor-tower-and-homa-games-arcade,
  unity.com/blog/understanding-the-impact-of-rewarded-ads-on-iap-retention-and-engagement
- UX i dostępność: developer.apple.com/design/human-interface-guidelines/game-controls,
  gameaccessibilityguidelines.com/full-list/, github.com/yoannmoinet/nipplejs,
  developer.android.com/develop/ui/views/haptics/haptics-principles
- Technika: webkit.org/blog/10218/, webkit.org/blog/14403/,
  developer.chrome.com/docs/web-platform/page-lifecycle-api, github.com/pixijs/pixijs/pull/12170
