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
- Miniatury są nagrywane z gry przez `__dev.thumbnails()` (`npm run dev`): statyczna bez tekstu
  (`promo/thumbnail_1080.png`) i animowana (`promo/animated_thumbnail_1080.mp4`: 1080×1080, 60 fps, 5 s,
  3 sceny: bieg z chwiejnym stosem i stłuczka, załadunek i odjazd vana, cała hala w ruchu). Wymagania
  Poki: statyczna ≥ 628×628 bez tekstu; animowana MP4 1080×1080, ≥ 50 fps, 4–6 s, 2–3 sceny, bez UI.
- Pomiar 60 FPS przy 4× spowolnieniu CPU w Chrome DevTools i test na prawdziwym telefonie.
- Odsłuch dźwięków na urządzeniach: efekty są syntezowane, ale nie słyszałem ich na żywo.

## Proponowany następny krok

1. Upload na Poki (inspector) i 10 nagrań playtestów Poczty: czy gracze sami odkrywają, że chodzenie
   przenosi paczki, i czy kruche paczki bawią.
2. Strojenie z nagrań, najpierw pierwsze 3 minuty (ceny w `locations/poczta.json`, stałe w
   `src/sim/economy.ts`), zawsze z kontrolą w `npm run pacing`.
3. Miniatury, a potem drugi Player Fit.

## Druga runda (po uwagach z testu)

- **Vany:** kurs skrócony do 3 s, a przy rampie stoi paleta. Gdy vana nie ma, paczki idą na paletę i
  same ładują się do następnego vana, więc gracz i ładowacze nie stoją przy rampie. Nad paletą widać, za
  ile wróci van.
- **Płynność:** gracz i pracownicy przyspieszają i hamują zamiast skokowo zmieniać prędkość; przejście
  bieg ↔ ostrożny chód jest płynne. Zasady kruchych paczek bez zmian.
- **Fizyka stosu:** łańcuch sprężyn (każda paczka podąża za tą pod nią), więc stos zamiata przy ruszaniu i
  hamowaniu; paczki sprężynują przy lądowaniu, opadają po wyjęciu środkowej, na regałach i palecie leżą
  lekko krzywo, z ciężarówki spadają na taśmę.
- **Vany:** osobne koła na szprychach, zawieszenie (van przysiada przy każdej paczce i przy hamowaniu),
  cofanie do rampy ze światłami i piskiem, spaliny przy odjeździe.
- **Postacie:** dłonie trzymające stos, włosy, kask ładowacza, pochylenie w biegu, sprężynowanie kroku,
  mruganie, dymki („!” przy stłuczce, „$” przy kasie, powitanie nowego pracownika); przy chodzie bokiem
  stos jest trzymany przed postacią, więc widać twarz.
- **Otoczenie:** zegar, plakaty, tablica, mapa dzielnic i gaśnica na ścianie, światło z okien i lamp,
  przetarcia podłogi, winieta.
- **Ceny przestrojone** do szybszej pętli (symulator, mediana z 5 przebiegów): Poczta — pierwsza dzielnica
  1:15, pierwszy pracownik 3:03, automatyzacja 9:12, przejście 20:34; Sortownia — przejście 18:33.

## Trzecia runda

- **Rozładunek ciężarówki:** ciężarówka ma podniesione boczne drzwi z ładunkiem w środku; pracownik sięga
  do środka, odwraca się z paczką (od razu właściwego koloru i rodzaju, bo symulacja losuje następną paczkę
  z wyprzedzeniem) i podaje ją na taśmę. Silnik na biegu jałowym lekko drży i dymi.
- **Rekwizyty** z plików lokacji: wózki widłowe, palety w folii i stosy palet, wysokie regały z kartonami,
  automat z przekąskami, dystrybutor wody, ławka, szafki, kosze, pachołki, rośliny, wózek ręczny, waga do
  paczek i zakreskowane pola na podłodze. Stałe rekwizyty są przeszkodami dla gracza i pracowników.
- **Monety i wypłaty:** błyszczące monety, w locie wirują; przy dużych kwotach paczki banknotów; odbłyski na
  stosach. Wypłata z vana spada deszczem monet i stos rośnie, gdy lądują; zebrane monety lecą do licznika,
  który płynnie odlicza; zbieracz wysuwa szufladę kasy; większe napisy wypłat z monetą (i „×2” przy turbo);
  dźwięki brzęku i kasy.


## Czwarta runda

- **Postacie od nowa:** każda rola ma własny strój (kamizelki odblaskowe, kombinezon i kask ładowacza,
  kamizelka i torba zbieracza), cieniowane głowy z fryzurami, czapki z logo, osobne rękawy i przedramiona,
  kolorowe buty. Twarze mają nastroje: uśmiech przy zbieraniu monet i zakupie, zmartwienie gdy kruchy stos
  się chwieje (z kroplą potu), szok przy stłuczce, mruganie. W biegu spod butów lecą obłoczki kurzu.
- **Ulica przed budynkiem:** dwa pasy z przerywaną linią, krawężniki, chodniki, przejście dla pieszych,
  studzienki, ławki, kosze, donice i hydrant. Jeżdżą po niej auta w obu kierunkach; trzymają odstęp i
  hamują za wolniejszymi (tylko wizualnie, bez wpływu na grę).
- **Parkingi:** za budynkiem parking pracowników (auta zaparkowane przodem albo tyłem), na zachód od
  budynku parkingi między pasami ciężarówek (auta bokiem), w placu manewrowym rzędy aut na północnym i
  południowym końcu. Kolory aut losowane, ale stałe dla lokacji.
- **Plac manewrowy:** namalowane stanowiska z numerami ramp, żółta linia zatrzymania, przerywane pasy
  kolejki, słupki przy drzwiach ramp, „zęby” ustąp pierwszeństwa przy wyjeździe na ulicę.
- **Latarnie** wzdłuż parkingów, między rampami i po drugiej stronie ulicy; znaki „P”.
- Kamera widzi teraz więcej otoczenia (margines świata: prawo 400, góra 190, dół 230), bo ulica i parkingi
  są na tyle blisko, że gracz widzi je przy rampach i przy przedniej ścianie.
- Koszt: ok. 1,4 ms na klatkę (bez zmian), paczka 770 KB. Miniatury nagrane od nowa.

## Piąta runda: postacie od zera

Poprzednie modele były w stylu chibi: głowa szeroka jak tułów, duże błyszczące oczy z rumieńcami, widok z
boku zrobiony z przodu tułowia i doklejonej głowy z profilu, kończyny bez kolan i łokci. Teraz:

- **Proporcje dorosłego** (ok. 5 głów wysokości), mała głowa z szyją, prawdziwy profil z boku (czoło, nos,
  podbródek, ucho, tył głowy), twarze bez rumieńców i wielkich oczu: małe oczy, brwi, cień nosa, usta.
- **Osobne sylwetki tułowia** z przodu, z boku i z tyłu dla każdego stroju (koszulka polo kuriera z pasem
  odblaskowym, kamizelka odblaskowa sortowacza, ogrodniczki ładowacza, kamizelka z krawatem i torba
  zbieracza, bluza z kapturem pomocnika), z cieniowaniem.
- **Stawy:** udo–kolano–łydka–but i ramię–łokieć–przedramię–dłoń. Wysokość ciała wynika z nóg, więc
  stopa na ziemi zostaje na ziemi, a ciało opada przy szerokim kroku. Osobny cykl biegu i ostrożnego
  chodu, ręce pracują przeciwnie do nóg, dalsze kończyny ciemniejsze.
- **Różnorodność:** fryzury (krótka, jeż, bob, kucyk), zarost, sześć odcieni skóry, siedem kolorów włosów.
- **Noszenie:** ręce pod stosem; z boku stos trzymany przed sobą tak, że widać twarz; zbieracz niesie
  monety przed sobą.
- Narzędzie deweloperskie `lab.html` (tylko w trybie dev): wszystkie role, kierunki i fazy kroku.
- Koszt: ok. 2,3 ms na klatkę w Hubie, paczka 782 KB. Miniatury nagrane od nowa.

## Szósta runda: przegląd jako gracz i wydawca

Przegląd całej gry w 16:9 i poprawki tego, co najbardziej odstawało:

- **Paczki:** kartony z tektury falistej, większe (podstawa 30×14 zamiast 26×12, wysokość bez zmian,
  żeby wieże nie urosły). Dzielnica na szerokiej taśmie na wieku i dużej naklejce z przodu; kruche mają
  białą taśmę w czerwone pasy i etykietę z kieliszkiem, ekspresowe żółto-czarną taśmę i piorun,
  posortowane etykietę z kodem kreskowym na wieku. Sloty regału i palety rozstawione pod nowe kartony.
- **Magazyn:** posadzka z wylewanego betonu w dużych płytach z nacięciami dylatacyjnymi, plamami i
  śladami opon wózków; tylna ściana z paneli ze stalowymi słupami i lampami, cokołem i oprawionymi
  oknami; głowice słupów na ścianach bocznych; stalowe regały sortownicze w kolorze dzielnicy; lada
  obsługi z kasą; wykładzina z płytek w biurze.
- **Pora dnia** (8 minut gry na dobę): rano, dzień, złota godzina, zachód, noc, świt. Noc przyciemnia
  otoczenie (ziemia przez mieszanie multiply, auta, vany, ciężarówki i latarnie przez tint), magazyn
  zostaje oświetlony; świecą latarnie i lampy na słupach, jadące auta mają światła, okna pokazują niebo.
  Miniatury nagrywane są w południe.
- **Parkingi:** auta wjeżdżają alejką, skręcają na wolne miejsce i parkują; po jakimś czasie wycofują
  (albo wyjeżdżają przodem) i odjeżdżają.
- Powracający gracz ma od razu paczki na taśmie; komunikaty o kamieniach milowych są pod paskiem u góry,
  a nie na środku ekranu.
- Koszt: ok. 2,1–2,8 ms na klatkę w Hubie (statyczne podłoże we własnej grupie renderowania),
  paczka 794 KB.

## Siódma runda: wysokie stosy, telefony, dźwięk, parkingi zachodnie

- **Wysokie stosy:** gdy gracz niesie wysoką wieżę, kamera płynnie patrzy wyżej i oddala się (do 0,68×),
  żeby cały stos i pasek chybotania były na ekranie; wraca, gdy stos maleje.
- **Telefony w pionie:** napisy w świecie tworzone są do 1,45× większe, gdy ekran pokazuje świat w
  pomniejszeniu; ceny na polach zakupu mieszczą się w polu; na ekranach dotykowych licznik monet nie
  wchodzi w róg, w którym Poki pokazuje swój przycisk.
- **Dźwięk od nowa:** efekty brzmią fizycznie zamiast pisków (tektura, marimba rosnąca z wysokością stosu,
  dzwoneczki FM dla monet, silnik diesla vana, hamulce pneumatyczne, cichy sygnał cofania), kroki gracza,
  cichy szum hali i świerszcze w nocy. Dźwięki ze świata są w stereo według miejsca na ekranie i cichną
  poza nim, więc dalekie rampy nie hałasują; klakson tylko czasem. Kompresor na wyjściu zapobiega
  przesterowaniu. Poziomy zbalansowane pomiarem offline (RMS i szczyt każdego efektu). Nowa muzyka:
  groove 100 BPM (perkusja, bas, klawisze, zmieniające się melodie, forma 32 taktów, wyciszenie co trzeci
  przebieg), łagodniejsza w nocy i przytłumiona na pauzie.
- **Parkingi na zachodzie:** auta wjeżdżają z drogi dojazdowej prosto na miejsce, potem wycofują się,
  zawracają i odjeżdżają (albo wyjeżdżają przodem, jeśli wcześniej wjechały tyłem).
- Koszt: ok. 2,6–3,1 ms na klatkę w Hubie, paczka 798 KB.

## Ósma runda: praca dla gracza po automatyzacji, postęp lokacji, podpowiedzi

- **Zlecenia kurierskie** (wzór: zamówienia kurierskie w Burger Please). Po zatrudnieniu pierwszego
  pracownika co ok. 30–55 s przez drzwi w przedniej ścianie wchodzi kurier i staje na macie. Nad nim karta:
  2–4 paczki z różnych dzielnic (część kruchych), pasek czasu i nagroda. Gracz przynosi pasujące paczki (z taśmy albo
  regału), każda płaci 4× stawkę vana, a komplet dodaje 50% premii. Po czasie kurier odchodzi bez kary.
  Pracownicy go nie obsługują, więc gracz ma aktywną, opłacalną robotę, gdy magazyn działa sam; kruche
  paczki w zamówieniu są najcenniejsze. Automatyzacja, zarobki offline i tempo z symulatora bez zmian (bot
  kuriera ignoruje, kurier ma osobne losowanie). 6 nowych testów symulacji.
- **Karta celu** pod licznikiem monet: nazwa lokacji, etapy „2/9” z paskiem i następny kamień milowy z ceną
  (podświetlony, gdy gracza na niego stać). Po każdym etapie karta pulsuje i pojawia się „Etap n/m
  zaliczony!”. Karta pojawia się dopiero po samouczku.
- **Podpowiedzi o wąskich gardłach** ze strzałką do miejsca: kurier czeka, monety leżą przy rampie (bez
  zbieracza), regał pełny (bez ładowacza), taśma pełna (bez sortowacza). Każda pokazuje się do 7 s i
  potem odpoczywa 25 s.
- Na wąskich ekranach podpowiedzi i komunikaty są pod kartą celu, a nie na liczniku monet.
