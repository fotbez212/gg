# PaintStock — Kontrola farb

Lokalna aplikacja webowa (PWA) do kontroli terminów ważności farb na dziale farb: skanowanie kodów kreskowych, wiele partii pod jednym kodem, kolorowe ostrzeżenia o terminach, lokalizacje, eksport/import. Bez kont, bez chmury, dane tylko na urządzeniu (IndexedDB).

> PaintStock jest niezależnym narzędziem. Nie jest produktem PPG i nie jest przez PPG autoryzowany.

## Jeden plik: `index.html`

Cała aplikacja, łącznie ze skanerem ZXing i ikoną, mieści się w **jednym pliku `index.html` (~500 KB)**. Wystarczy skopiować go na urządzenie, bez serwera, bez internetu i bez innych plików.

| Funkcja | Sam `index.html` z dysku |
|---|---|
| Lista, partie, kolory terminów, filtry | ✅ |
| Zapis danych | ✅ IndexedDB, a gdy przeglądarka go nie da, to `localStorage` |
| Skaner (BarcodeDetector lub wbudowany ZXing) | ✅ gdy przeglądarka udostępni aparat (zob. niżej) |
| Eksport CSV/JSON, import JSON | ✅ |
| OCR daty (Tesseract.js) | 🌐 jedyna funkcja wymagająca internetu (pobiera ~10–15 MB z CDN). Bez sieci datę wpisujesz ręcznie |

Pozostałe pliki w repo są **opcjonalne** i przydają się tylko przy serwowaniu przez http(s):

| Plik | Rola |
|---|---|
| `sw.js` | Service Worker: offline przy hostingu |
| `manifest.webmanifest`, `icons/` | Instalacja jako aplikacja (PWA) |

## Uruchomienie na urządzeniu

### 💻 Komputer (Chrome / Edge)
Skopiuj `index.html` gdziekolwiek i otwórz dwuklikiem. Chrome traktuje plik lokalny jako bezpieczny kontekst, więc kamera internetowa działa po udzieleniu zgody. Zweryfikowane w Chromium: skan EAN-13 z kamery, zapis w IndexedDB, dane po ponownym otwarciu, zero zapytań sieciowych.

### 📱 Android, wariant 1: otwarcie pliku
Skopiuj `index.html` do telefonu (np. do *Pobrane*) i otwórz go w Chrome z menedżera plików („Otwórz w…” → Chrome).

⚠️ **Nie zweryfikowano na fizycznym telefonie.** Chrome na Androidzie otwiera pliki przez adres `content://…`, a przeglądarka może wtedy ograniczyć dostęp do aparatu lub do zapisu danych. Aplikacja sama to wykrywa:
- *Ustawienia → O aplikacji* pokazuje, czy aparat jest dostępny i gdzie zapisywane są dane,
- jeśli zapis jest niemożliwy, na stronie głównej pojawia się czerwony komunikat,
- jeśli aparat jest zablokowany, kody wpisujesz ręcznie.

### 📱 Android, wariant 2 (pewny, nadal w 100% na telefonie): Termux
[Termux](https://termux.dev) (z F-Droid lub GitHub) uruchamia mini-serwer **na samym telefonie**, a `localhost` to bezpieczny kontekst, więc działa aparat, zapis danych, a nawet Service Worker:

```bash
termux-setup-storage            # jednorazowo: dostęp do pamięci telefonu
cd ~/storage/downloads          # folder z index.html
python -m http.server 8080      # (pkg install python, jeśli brak)
```

W Chrome otwórz `http://localhost:8080/index.html`. Nic nie wychodzi poza telefon. Używaj zawsze tego samego portu, bo dane są przypisane do adresu `localhost:8080`.

### Dlaczego aparat bywa zablokowany
`getUserMedia()` działa tylko w **bezpiecznym kontekście**: `https://`, `http://localhost` lub (w Chrome na komputerze) plik lokalny. Pod `http://192.168.x.x` aparat **nie zadziała** nigdy.

### Opcjonalnie: hosting HTTPS
Wrzucenie katalogu na GitHub Pages, Netlify itp. daje instalację jako aplikacja (PWA) i offline przez Service Worker. Dane i tak zostają tylko na urządzeniu.

### Przenoszenie danych
Dane są przypisane do sposobu otwarcia: plik z dysku, `localhost:8080` i hosting to trzy osobne „magazyny”. Przenosisz je przez *Ustawienia → Eksport JSON → Import JSON*.

## Skaner

- **Silniki:** natywny `BarcodeDetector` (Chrome na Androidzie z usługami Google Play), a gdy go brak, **ZXing** (JavaScript, np. Chrome na Linuksie/Windows, Firefox). Silnik można wymusić w ustawieniach.
- **Formaty:** EAN-13, EAN-8, Code 128, DataMatrix, o ile obsługuje je dany silnik. Lista aktywnych formatów jest pod podglądem.
- **Jeden odczyt na skan:** po wykryciu kodu detekcja jest blokowana do zamknięcia formularza, a ten sam kod jest ignorowany jeszcze przez 2,5 s (puszka zwykle jest wciąż w kadrze).
- **Latarka:** dostępna tylko gdy aparat zgłasza `torch` (większość Androidów; na komputerach zwykle brak).
- **Zwykły EAN nie zawiera daty ważności.** Datę i partię aplikacja odczytuje tylko z kodów **GS1** (DataMatrix/GS1-128) z identyfikatorami AI(17) i AI(10). Pole wypełnia się wtedy wstępnie i trzeba je potwierdzić. AI(11), czyli data produkcji, nigdy nie trafia do terminu.
- Aparat jest zwalniany przy wyjściu z zakładki Skaner, przejściu aplikacji w tło i zamknięciu strony.

## OCR daty (eksperymentalne)

Tesseract.js 5.1.1 (z CDN, przy pierwszym użyciu ok. 10–15 MB). Rozpoznaje `DD.MM.RRRR`, `DD-MM-RRRR`, `RRRR-MM-DD`, a z oznaczeniem niepewności także `DD.MM.RR` i `MM/RRRR`. Daty z opisem *PROD/MFG/data produkcji* są oznaczane jako produkcyjne i nie są podstawiane automatycznie. Każdy wynik trzeba zatwierdzić ręcznie. Skuteczność na nadrukach kropkowych (inkjet) jest ograniczona: pomaga zaznaczenie palcem samego nadruku i opcja „Nadruk kropkowy”. OCR offline działa po jednorazowym pobraniu (*Ustawienia → Przygotuj OCR*).

## Kolory terminów

| Dni do terminu | Wygląd | Status |
|---|---|---|
| > 31 | ciemna karta | W terminie |
| 8–31 | żółta | Do 31 dni |
| 1–7 | pomarańczowa | Do 7 dni |
| 0 (dziś) | czerwona | Termin mija dziś |
| < 0 | czerwona | **Do weryfikacji** (upływ okresu przechowywania ≠ zepsucie farby) |

Statystyka „Produkty z terminem do 31 dni” liczy produkty z partią w przedziale 0–31 dni. „Przeterminowane” liczy produkty z partią po terminie. Pod liczbą widać też liczbę partii i puszek.

## Dane

- IndexedDB (`paintstock`: `products`, `batches`, `meta`). Każda zmiana zapisuje się od razu, transakcyjnie. Gdy IndexedDB jest niedostępne (np. niektóre sposoby otwierania pliku), aplikacja automatycznie przechodzi na `localStorage` (limit ok. 5 MB, czyli tysiące partii).
- Niezapisany formularz jest zachowywany jako szkic, więc przetrwa nawet zabicie karty przez Androida podczas robienia zdjęcia do OCR.
- Aplikacja prosi o *trwałe przechowywanie* (`navigator.storage.persist`), żeby przeglądarka nie czyściła danych przy braku miejsca. Najpewniej działa to po instalacji jako PWA.
- **Kopia zapasowa:** eksport JSON (pełny, do ponownego importu) i CSV (do Excela, separator `;`, UTF-8 z BOM).
- Wyczyszczenie danych witryny w przeglądarce usuwa bazę, dlatego rób regularnie eksport JSON.

## Model danych

```text
product { id, barcode, name, manufacturer, capacity, description, demo, createdAt, updatedAt }
batch   { id, productId, lot, expiry: "RRRR-MM-DD", qty, zone, rack, shelf, notes, demo, createdAt, updatedAt }
```

Jeden produkt (kod) może mieć dowolnie wiele partii. Dodanie partii o istniejącym numerze nigdy jej nie nadpisuje: aplikacja pyta, czy dodać puszki do istniejącej partii, czy zapisać osobny wpis.

## Rozbudowa

ZXing 0.21.3 (`@zxing/library`, Apache-2.0) jest osadzony w `index.html` jako nieaktywny blok `<script type="text/plain" id="zxing-src">` i uruchamiany dopiero wtedy, gdy przeglądarka nie ma natywnego `BarcodeDetector`. Aktualizacja polega na podmianie zawartości tego bloku.

Kod w `index.html` jest podzielony na moduły-obiekty: `D` (daty), `DB` (IndexedDB), `Store` (stan), `Overlay`/`Router` (okna i historia, w tym przycisk Wstecz na Androidzie), `Home`, `Products`, `Detail`, `Form`, `Draft`, `Scanner`, `GS1`, `OCR`, `IO`, `Demo`, `SettingsView`, `App`. Przyciski działają przez delegację `data-action` → `App.actions`. Po zmianie plików aplikacji podbij `VERSION` w `sw.js`, żeby urządzenia pobrały nową wersję.
