# Fragile Express — raport z budowy MVP

Stan na 29.09.2026. Zbudowane wszystkie trzy lokacje z dokumentu projektowego, a nie tylko etap 1, bo
zadanie brzmiało „stwórz tę grę”. Kod jest w repozytorium git z małymi commitami.

## Co działa

- **Pętla z Monkey Mart:** taśma → stos gracza → regał w kolorze dzielnicy → druga strona regału → van →
  stos monet → pola zakupu. Wszystko przez chodzenie, bez klikania.
- **Kruche paczki** od 3. minuty w Poczcie (od startu w kolejnych lokacjach): ikona szkła, wypłata ×3,
  chybotanie przy stosie > 3 albo biegu > 2 s, pasek nad stosem, pęknięcie górnej kruchej paczki z dźwiękiem
  szkła, odłamkami i wstrząsem kamery. Shift albo lekkie wychylenie drążka to ostrożny chód.
- **Paczki ekspresowe** (Sortownia, Hub) z licznikiem nad paczką i premią +50%, **paczki XXL** (Hub): tylko
  jedna naraz.
- **Pracownicy:** sortowacz, ładowacz i zbieracz monet na automatach stanów po grafie punktów drogi z JSON-a,
  każdy z ulepszeniami udźwigu i szybkości.
- **Stacje i ulepszenia:** nowe dzielnice, szybsza taśma, drugi van na dzielnicę, większe vany, udźwig,
  szybkość i stabilność gracza.
- **Trzy lokacje:** Poczta osiedlowa (2 dzielnice, ×1), Sortownia miejska (4, ×4), Hub regionalny
  (6 dzielnic, ×15, dwie taśmy). Przejście między nimi z ekranem nowej lokacji.
- **Zapis** co 10 s, przy każdym zakupie, pauzie i zamknięciu karty; wersja schematu i walidacja przy
  odczycie. **Zarobek offline:** połowa przepustowości automatów liczona tą samą symulacją, maks. 2 h.
- **Poki:** init, gameLoadingFinished, gameplayStart przy pierwszym ruchu, gameplayStop na pauzie,
  ekranach i reklamach, commercialBreak tylko przy powrocie do gry i nie w pierwszych 5 minutach, pięć
  miejsc rewarded z dokumentu. Sprawdzone z prawdziwym SDK w trybie debug: reklama nagradzana daje turbo,
  commercialBreak idzie przez SDK, a SDK samo pilnuje odstępów.
- **Sterowanie:** klawiatura i pływający joystick w dowolnym miejscu ekranu (także mysz). Esc, spacja lub P
  to pauza i wznowienie.
- **Samouczek** strzałką i jedną linijką tekstu przez pierwszą pętlę. Potem strzałka wskazuje kamień milowy,
  na który gracza stać. Kamera na chwilę pokazuje nową dzielnicę, biuro i pole przeprowadzki.
- **Dźwięk:** syntezowane efekty (zbieranie z rosnącą wysokością tonu, szkło, van, klakson, kasa) i lekka
  pętla muzyczna; wyciszane w reklamie i w ukrytej karcie.
- **Języki:** en, pl, de, es, fr, pt, it, tr, nl, ru. Test pilnuje, że każdy słownik ma wszystkie klucze i
  te same zmienne.
- **Testy:** 45 testów Vitest (symulacja: taśma, stos, regały, vany, monety, pola zakupu, pole rewarded,
  chybotanie, pracownicy, offline, zapis, nawigacja; i18n).

## Wyniki symulatora tempa

Bot zachłanny (kupuje najtańsze dostępne pole, ostrożnie nosi kruche paczki), mediana z 5 ziaren.

| Kamień milowy | Cel | Poczta | Sortownia | Hub |
| --- | --- | --- | --- | --- |
| Pierwszy zakup | ~0:30 | 0:15 | 0:03 | 0:07 |
| Pierwsza nowa dzielnica | ~1:30 | 1:27 | 4:06 | 6:22 |
| Pierwszy pracownik | ~3:00 | 3:17 | 1:49 | 2:06 |
| Pełna automatyzacja | ~12:00 | 9:19 | 9:34 | 12:52 |
| Przejście dalej | ~20:00 | 20:16 | 21:16 | ostatnia |

Bot jest sprawniejszy od człowieka: nie błądzi, nie tłucze kruchych paczek, wraca prosto po monety. U ludzi
automatyzacja przyjdzie więc później, pewnie bliżej 12 minut. Nową dzielnicę w Sortowni i Hubie celowo
postawiłem za pierwszym pracownikiem, bo gracz zna już pętlę i ma monety na start.

## Poprawki cen i zasad względem dokumentu

- **Pracownik:** C₀ 150 → 120 (pierwszy sortowacz 100, ładowacz 140, zbieracz 150). Przy 150 pierwszy
  pracownik wypadał po 3:50.
- **Stopniowanie ulepszeń:** każde pole ulepszenia ma listę `unlock`, czyli etap (liczbę kupionych kamieni
  milowych), na którym otwiera się kolejny poziom. Bez tego zachłanny gracz kupował w kółko tani udźwig, a
  nowa dzielnica przychodziła po 4 minutach zamiast po 90 s.
- **Pole płaci tylko, gdy gracz stoi.** Przejście przez pole nie pobiera monet. Dokument mówi „stanie”, a
  przypadkowe płacenie przy przechodzeniu przez biuro zjadało pieniądze na inny zakup.
- **Van przyjmuje tylko paczki z regału** (posortowane, z białą etykietą). Inaczej regał byłby zbędny, bo
  najszybciej byłoby nosić z taśmy prosto do vana.
- **Pełny regał „stempluje” paczkę w rękach gracza.** Bez tego gracz z pełnym stosem jednego koloru i pełnym
  regałem tego koloru utykał na zawsze. Bot trafił na to zakleszczenie w symulatorze.
- **Kurs vana:** 4 s w trasie + 2,2 s animacji. Przy dłuższym kursie gracz głównie stał przy rampie.
- **Większe lokacje mają bardziej doświadczonych pracowników** (Sortownia +1 udźwig i ×1,15 szybkości, Hub +2
  i ×1,3). Bez tego sortowacze byli wąskim gardłem, a taśmy stały pełne.
- **Paczka XXL płaci ×6.** Dokument nie podaje stawki, a zajmuje cały udźwig.
- **Pozostałe monety przechodzą do nowej lokacji** i dodają się do monet startowych.
- **Pierwsze 5 minut bez reklam** liczę z całego czasu gry, nie z sesji. Inaczej reklama przy „Odbierz” na
  ekranie powrotu nie mogłaby się pojawić nigdy. SDK Poki i tak odmawia commercialBreak przed pierwszym
  gameplayStart w sesji (sprawdzone w debugu), więc na starcie sesji to „Odbierz” nie pokaże reklamy.
- **Hub nie ma pola przeprowadzki.** Po wszystkich zakupach gra toczy się dalej.

## Co może być złe dla gracza (mówię wprost)

1. **Ostrożny chód całkiem wyłącza chybotanie**, tak jak w dokumencie. Limit 3 paczek groźny jest więc
   tylko przy biegu, a z Shiftem można nieść 20 kruchych bez ryzyka, tyle że o połowę wolniej. Jeśli
   nagrania pokażą, że kruche paczki nudzą, ustawcie `FRAGILE.carefulFactor` na ok. 0,3 w
   `src/sim/economy.ts`. Jeśli frustrują, dokument każe najpierw podnieść `safeCount` z 3 do 4.
2. **Zasada „van bierze tylko z regału”** może nie być oczywista. Samouczek uczy jej krok po kroku, ale
   warto patrzeć w nagraniach, czy ktoś nie próbuje nieść paczek z taśmy prosto do vana.
3. **Pokaz kamery zabiera sterowanie na ok. 2,4 s.** Przy dwóch odblokowaniach naraz jest to ok. 4 s.
   Czytelne, ale może irytować.
4. **Biuro ma w Poczcie docelowo 12 pól.** Trzyma to wszystko w jednym miejscu, ale gracz musi tam wracać
   po każde ulepszenie.

## Wydajność i rozmiar

- Build: **710 KB** (cel < 4 MB). Grafika i dźwięk w całości z kodu, jedyny zasób sieciowy to skrypt Poki SDK.
- Hub pod pełnym obciążeniem (131 paczek, 6 pracowników): logika 0,6 ms i render 1,0 ms na klatkę
  (mediana), 1,4 i 2,5 ms (p95), mierzone w Chrome bez spowolnienia. Po przeliczeniu na 4× spowolnienie CPU
  wychodzi ok. 6–16 ms, czyli w budżecie 60 FPS. Pomiaru w DevTools z włączonym throttlingiem trzeba jeszcze
  dokonać ręcznie, bo panel przeglądarki, w którym testowałem, nie ma tej opcji.
- Rozdzielczość renderu ograniczona do 2× devicePixelRatio. Tekstury siedzą w jednym atlasie, więc sprite'y
  się batchują.

## Czego brakuje

- **Repozytorium Fragile Van.** Nie ma go na dysku, więc poki-kit (`src/poki`), kod vana i paczek
  (`src/game/art.ts`) oraz helpery (`src/core`) napisałem od nowa, bez zależności od gry, tak żeby dało się
  je przenieść. Po podaniu ścieżki podmienię rysowanie vana na to z Fragile Van dla spójności marki.
- Miniatura animowana. Statyczną wersję roboczą (`promo/thumbnail_628.png`) i zrzut ekranu
  (`promo/screenshot.png`) generuje `__dev.thumbnails()` w `npm run dev`; ostateczną warto dopracować ręcznie.
- Pomiar 60 FPS przy 4× spowolnieniu CPU w Chrome DevTools i test na prawdziwym telefonie.
- Odsłuch dźwięków na urządzeniach: efekty są syntezowane, ale nie słyszałem ich na żywo.

## Proponowany następny krok

1. Upload na Poki (inspector) i 10 nagrań playtestów Poczty: czy gracze sami odkrywają, że chodzenie
   przenosi paczki, i czy kruche paczki bawią.
2. Strojenie z nagrań, najpierw pierwsze 3 minuty (ceny w `locations/poczta.json`, stałe w
   `src/sim/economy.ts`), zawsze z kontrolą w `npm run pacing`.
3. Miniatury, a potem drugi Player Fit.
